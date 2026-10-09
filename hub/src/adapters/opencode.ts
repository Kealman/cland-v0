// The OpenCode adapter (spec 4.3, research `harness-surfaces` §3; built against opencode v2.0.24). OpenCode 2.x
// runs every session on a server the host can join, so everything goes through that server:
//
//   spawn    a standalone `opencode serve --hostname 127.0.0.1 --port 0` per session, detached, in the session's
//            cwd (`./opencode/server.ts`): the spoke is an MCP server of the generated config the server reads
//            from `OPENCODE_CONFIG`; the server has a password of its own (`OPENCODE_PASSWORD`). Then
//            `POST /api/session {title, model, location}` creates the session; the model is a launch parameter,
//            else a free one the server lists (`GET /api/model`). The process table keeps the server's pid, its
//            url (`harnessId`) and the session's id (`harnessSessionId`, `ses_…`).
//   attach   the OpenCode TUI as a client of that server, on that session, in its directory: `opencode --server <url> --session <id> <cwd>`,
//            with the password read from its file into `OPENCODE_PASSWORD` (never on the command line).
//   inject   `POST /api/session/{id}/prompt {text, delivery}`: `steer` while the session runs a turn, `queue`
//            otherwise. The server's reply is the durably admitted inbox item: that is the confirmation.
//   state    the event stream `GET /api/event` (`./opencode/state.ts`), one subscription per server, with a
//            snapshot (`/api/session/active`, pending permissions and forms) each time it (re)connects; the
//            server's pid is checked every poll, and a dead one is `unknown`.
//   stop     SIGTERM to the server (which ends its MCP servers, the spoke among them).
//   resume   the pid alive and the server answering for the recorded session; else, with `relaunch`, a new server
//            on the same config and password, and the same session (OpenCode keeps sessions in its own database;
//            a session it lost is created again under its id).
import { randomUUID } from 'node:crypto';
import { existsSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Message, SessionState, TopicRef } from '../protocol.ts';
import { envelope, envelopeIds, type AdapterHost, type Capabilities, type HarnessAdapter, type HarnessProcess, type Interpretation, type ResumeResult, type SpawnRequest } from './contract.ts';
import { formatModel, OpenCodeClient, parseModel, pickFreeModel, type ModelRef } from './opencode/client.ts';
import { prepareFiles, readPassword, serverFiles, startServer, type ServerFiles } from './opencode/server.ts';
import { SessionTracker, type Change } from './opencode/state.ts';
import { processAlive, sameProcess, signalProcess } from './processes.ts';

export const OPENCODE = 'opencode';

export const OPENCODE_CAPABILITIES: Capabilities = {
  // the session's messages are readable (`GET /api/session/{id}/message`), but cland does not read them in v0
  history: 'none',
  // `session.step.ended` carries each assistant message's tokens and cost
  usage: 'reliable',
  // `POST /api/session/{id}/model` exists; the contract has no setModel yet
  setModel: 'none',
  // approvals stay in the OpenCode TUI in v0 (spec 4.3)
  approvalRelay: 'none',
  states: {
    // session.execution.started / succeeded | failed | interrupted, reported by the server
    busy: 'reliable',
    idle: 'reliable',
    // derived: running plus a pending `permission.asked` (the server has no waiting status)
    'waiting for approval': 'heuristic',
    // derived: running plus a pending `form.created`
    'waiting for human': 'heuristic',
  },
};

export type OpenCodeOptions = {
  /** The `opencode` executable: `CLAND_OPENCODE_BIN`, else `opencode` on the PATH. */
  bin?: string;
  /** How often the servers' pids are checked, ms. */
  pollMs?: number;
  /** How long an inject waits for the server's reply, ms. */
  injectTimeoutMs?: number;
  /** How long a launch waits for the server to listen, ms. */
  spawnDeadlineMs?: number;
  env?: NodeJS.ProcessEnv;
};

const sq = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`;
const bare = (s: string): string => (/^[\w@%+=:,./-]+$/.test(s) ? s : sq(s));

const pidAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
};

/** One watched session: its server's client, the event subscription, and what the stream says. */
type Watch = { process: HarnessProcess; client: OpenCodeClient; tracker: SessionTracker; abort: AbortController; usage: Record<string, unknown> | null; inbox: Map<string, string[]>; turnMessages: Set<string> };

export class OpenCodeAdapter implements HarnessAdapter {
  readonly harness = OPENCODE;
  readonly capabilities = OPENCODE_CAPABILITIES;
  readonly #host: AdapterHost;
  readonly #bin: string;
  readonly #pollMs: number;
  readonly #injectTimeoutMs: number;
  readonly #spawnDeadlineMs: number;
  readonly #env: NodeJS.ProcessEnv;
  readonly #clandDir: string;
  readonly #watched = new Map<string, Watch>();
  #timer: NodeJS.Timeout | null = null;
  #closed = false;

  constructor(host: AdapterHost, options: OpenCodeOptions = {}) {
    this.#host = host;
    this.#bin = options.bin ?? process.env.CLAND_OPENCODE_BIN ?? 'opencode';
    this.#pollMs = options.pollMs ?? 5000;
    this.#injectTimeoutMs = options.injectTimeoutMs ?? 30_000;
    this.#spawnDeadlineMs = options.spawnDeadlineMs ?? 30_000;
    const env: NodeJS.ProcessEnv = {};
    // cland's own variables stay out, and so does a password or config meant for another OpenCode server
    for (const [k, v] of Object.entries(options.env ?? process.env)) if (!k.startsWith('CLAND_') && !['OPENCODE_CONFIG', 'OPENCODE_CONFIG_CONTENT', 'OPENCODE_PASSWORD'].includes(k)) env[k] = v;
    this.#env = env;
    this.#clandDir = dirname(host.discoveryFile);
  }

  #files(name: string): ServerFiles {
    return serverFiles(this.#clandDir, name);
  }

  // ---------------------------------------------------------------- launch

  /** The OpenCode config the session's server reads: the spoke as a local MCP server, with the session's identity. */
  #config(name: string, role: string | null, sessionId: string): Record<string, unknown> {
    const environment: Record<string, string> = {
      CLAND_HUB_FILE: this.#host.discoveryFile,
      CLAND_SESSION_ID: sessionId,
      CLAND_SESSION_NAME: name,
      // the adapter injects: the spoke only accepts deliveries
      CLAND_DELIVERY: 'adapter',
      ...(role ? { CLAND_ROLE: role } : {}),
    };
    return { $schema: 'https://opencode.ai/config.json', mcp: { servers: { cland: { type: 'local', command: [this.#host.node, this.#host.spoke], environment } } } };
  }

  async #launch(p: Pick<HarnessProcess, 'name' | 'role' | 'model' | 'cwd' | 'sessionId' | 'harnessSessionId'>, relaunch: boolean): Promise<HarnessProcess> {
    const files = this.#files(p.name);
    const password = prepareFiles(this.#clandDir, files, this.#config(p.name, p.role, p.sessionId), !relaunch);
    const { pid, url } = await startServer({ bin: this.#bin, cwd: p.cwd, env: this.#env, files, password, deadlineMs: this.#spawnDeadlineMs });
    const client = new OpenCodeClient(url, password);
    try {
      let model: ModelRef | null = p.model ? parseModel(p.model) : null;
      let session = p.harnessSessionId ? await client.session(p.harnessSessionId) : null;
      if (!session) {
        if (!model) model = await this.#freeModel(client);
        session = await client.createSession({ ...(p.harnessSessionId ? { id: p.harnessSessionId } : {}), title: p.name, model, directory: p.cwd });
      }
      const chosen = session.model ? formatModel(session.model) : model ? formatModel(model) : p.model;
      this.#host.log({ event: 'harness-launched', harness: this.harness, session: p.name, url, pid, harnessSessionId: session.id, model: chosen, relaunch });
      return { ...p, harness: this.harness, model: chosen ?? null, pid, harnessId: url, harnessSessionId: session.id, startedAt: new Date().toISOString(), status: 'running' };
    } catch (err) {
      // a server whose session could not be made is of no use: it does not outlive the failed launch
      if (pidAlive(pid)) process.kill(pid, 'SIGTERM');
      throw err;
    }
  }

  /** A free model from the server's catalog. A fresh server lists none until its catalog has loaded (observed with
   *  v2.0.24: an empty list for the first moments), so an empty answer is asked again for a while. */
  async #freeModel(client: OpenCodeClient): Promise<ModelRef | null> {
    const deadline = Date.now() + 10_000;
    for (;;) {
      const models = await client.models().catch(() => []);
      if (models.length || Date.now() > deadline) return pickFreeModel(models);
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  spawn(request: SpawnRequest): Promise<HarnessProcess> {
    return this.#launch({ name: request.name, role: request.role, model: request.model, cwd: request.cwd, sessionId: randomUUID(), harnessSessionId: null }, false);
  }

  /** The session was renamed: its files (config, password, log) move with it, so attach and resume find them. */
  renamed(p: HarnessProcess, from: string): void {
    const source = this.#files(from).dir;
    const target = this.#files(p.name).dir;
    if (!existsSync(source) || existsSync(target)) return;
    renameSync(source, target);
    const w = this.#watched.get(p.sessionId);
    if (w) w.process = { ...w.process, name: p.name };
  }

  attachCommand(p: HarnessProcess): string {
    const bin = this.#bin === 'opencode' ? 'opencode' : bare(this.#bin);
    const password = this.#files(p.name).password;
    // in the session's directory: a TUI elsewhere makes the server open an instance there, whose MCP servers start a
    // second spoke for the session, which replaces the one the session's tool calls go through
    return `OPENCODE_PASSWORD="$(cat ${sq(password)})" ${bin} --server ${bare(p.harnessId ?? '')} --session ${bare(p.harnessSessionId ?? '')} ${sq(p.cwd)}`;
  }

  // ---------------------------------------------------------------- inject

  #client(p: HarnessProcess): OpenCodeClient {
    const watched = this.#watched.get(p.sessionId);
    if (watched && watched.client.url === p.harnessId) return watched.client;
    const password = readPassword(this.#files(p.name));
    if (!p.harnessId || !password) throw new Error(`no server url or password recorded for ${p.name}`);
    return new OpenCodeClient(p.harnessId, password);
  }

  async inject(p: HarnessProcess, message: Message, topic: TopicRef | null): Promise<void> {
    if (!p.harnessSessionId) throw new Error(`no OpenCode session recorded for ${p.name}`);
    const tracker = this.#watched.get(p.sessionId)?.tracker;
    // during a turn the message steers it (at the next step boundary); otherwise it is queued as the next turn
    const delivery = tracker?.running ? 'steer' : 'queue';
    const admitted = await this.#client(p).prompt(p.harnessSessionId, envelope(message, topic), delivery, this.#injectTimeoutMs);
    if (!admitted?.id) throw new Error('the server admitted no inbox item');
    this.#host.log({ event: 'opencode-prompt', session: p.name, id: message.id, inbox: admitted.id, delivery });
  }

  /** OpenCode confirms through the prompt API's reply: nothing comes back through the hub. */
  confirm(): void {}

  /** No signal is posted from inside an OpenCode session: its state comes from the event stream. */
  interpret(): Interpretation {
    return {};
  }

  usage(p: HarnessProcess): Record<string, unknown> | null {
    return this.#watched.get(p.sessionId)?.usage ?? null;
  }

  // ---------------------------------------------------------------- watch: the event stream and liveness

  watch(p: HarnessProcess): void {
    this.#unwatch(p.sessionId);
    if (!p.harnessId || !p.harnessSessionId) return;
    const password = readPassword(this.#files(p.name));
    if (!password) {
      this.#host.log({ event: 'opencode-no-password', session: p.name });
      return;
    }
    const w: Watch = { process: p, client: new OpenCodeClient(p.harnessId, password), tracker: new SessionTracker(p.harnessSessionId), abort: new AbortController(), usage: null, inbox: new Map(), turnMessages: new Set() };
    this.#watched.set(p.sessionId, w);
    void this.#subscribe(w);
    if (!this.#timer) {
      this.#timer = setInterval(() => this.#checkPids(), this.#pollMs);
      this.#timer.unref();
    }
  }

  #apply(w: Watch, change: Change, at: number): void {
    if (change.ended) {
      const messages = [...w.turnMessages];
      w.turnMessages.clear();
      if (change.turnError) this.#host.turnFailed?.(w.process.sessionId, change.turnError, messages);
    }
    if (change.usage) w.usage = change.usage;
    if (change.state) this.#host.signal(w.process.sessionId, { state: change.state, source: 'sse', at });
  }

  /** Keep one subscription to the server's events, re-opened (with a fresh snapshot) until the session is unwatched. */
  async #subscribe(w: Watch): Promise<void> {
    let failures = 0;
    while (!this.#closed && this.#watched.get(w.process.sessionId) === w) {
      try {
        await w.client.events(
          (e) => {
            // An admission can queue the next turn: only delivered inbox items fed this execution.
            const d = e.data ?? {};
            if (d.sessionID === w.tracker.sessionId && typeof d.inboxID === 'string') {
              if (e.type === 'session.inbox.enqueued') {
                const text = (d.item as { payload?: { text?: unknown } } | undefined)?.payload?.text;
                if (typeof text === 'string') w.inbox.set(d.inboxID, envelopeIds(text));
              } else if (e.type === 'session.inbox.delivered' || e.type === 'session.inbox.cancelled') {
                if (e.type === 'session.inbox.delivered') for (const id of w.inbox.get(d.inboxID) ?? []) w.turnMessages.add(id);
                w.inbox.delete(d.inboxID);
              }
            }
            this.#apply(w, w.tracker.apply(e), e.created ?? Date.now());
          },
          () => {
            failures = 0;
            // the stream is live-only: what it missed comes from a snapshot taken once it is open
            w.client
              .snapshot(w.tracker.sessionId)
              .then((s) => {
                this.#apply(w, w.tracker.reset(s), Date.now());
                // the stream is back: what failed to inject while it was down is retried, state change or not
                this.#host.reconnected?.(w.process.sessionId);
              })
              .catch((err: unknown) => this.#host.log({ event: 'opencode-snapshot-failed', session: w.process.name, error: err instanceof Error ? err.message : String(err) }));
          },
          w.abort.signal,
        );
      } catch (err) {
        if (w.abort.signal.aborted) return;
        failures++;
        if (failures === 1) this.#host.log({ event: 'opencode-events-failed', session: w.process.name, error: err instanceof Error ? err.message : String(err) });
      }
      if (w.abort.signal.aborted) return;
      w.tracker.forget();
      // a stream that ends with its server is a crash, not a reconnect
      if (w.process.pid !== null && !pidAlive(w.process.pid)) {
        this.#gone(w, `pid ${w.process.pid} is gone`);
        return;
      }
      await new Promise((r) => setTimeout(r, Math.min(2000, 100 * 2 ** Math.min(failures, 5))));
    }
  }

  #checkPids(): void {
    for (const w of [...this.#watched.values()]) if (w.process.pid !== null && !pidAlive(w.process.pid)) this.#gone(w, `pid ${w.process.pid} is gone`);
  }

  #gone(w: Watch, detail: string): void {
    if (this.#watched.get(w.process.sessionId) !== w) return;
    this.#unwatch(w.process.sessionId);
    this.#host.exited(w.process.sessionId, detail);
  }

  #unwatch(sessionId: string): void {
    const w = this.#watched.get(sessionId);
    if (w) {
      w.abort.abort();
      this.#watched.delete(sessionId);
    }
    if (this.#watched.size === 0 && this.#timer) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  // ---------------------------------------------------------------- stop, resume

  async stop(p: HarnessProcess): Promise<void> {
    this.#unwatch(p.sessionId);
    // only the server the hub started: a pid reused by another process is never signalled
    if (!signalProcess(p, 'SIGTERM', this.#host.log)) return;
    const deadline = Date.now() + 5000;
    while (sameProcess(p) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
    signalProcess(p, 'SIGKILL', this.#host.log);
  }

  async resume(p: HarnessProcess, options: { relaunch?: boolean } = {}): Promise<ResumeResult> {
    let reason: string;
    if (!processAlive(p)) reason = p.pid !== null && pidAlive(p.pid) ? `the server's pid ${p.pid} belongs to another process now` : `the server's pid ${p.pid ?? '?'} is gone`;
    else if (!p.harnessId || !p.harnessSessionId) reason = 'no server url or session recorded';
    else {
      const password = readPassword(this.#files(p.name));
      if (!password) reason = 'the server password file is gone';
      else {
        const client = new OpenCodeClient(p.harnessId, password);
        try {
          const session = await client.session(p.harnessSessionId);
          if (session) {
            const tracker = new SessionTracker(p.harnessSessionId);
            tracker.reset(await client.snapshot(p.harnessSessionId));
            return { found: true, process: { ...p, status: 'running' }, state: tracker.state() };
          }
          reason = `the server at ${p.harnessId} does not know session ${p.harnessSessionId}`;
        } catch (err) {
          reason = `the server at ${p.harnessId} does not answer: ${err instanceof Error ? err.message : String(err)}`;
        }
      }
    }
    if (!options.relaunch) return { found: false, reason };
    signalProcess(p, 'SIGTERM', this.#host.log);
    const process_ = await this.#launch({ name: p.name, role: p.role, model: p.model, cwd: p.cwd, sessionId: p.sessionId, harnessSessionId: p.harnessSessionId }, true);
    return { found: true, process: process_, state: 'unknown' as SessionState };
  }

  close(): void {
    this.#closed = true;
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
    for (const w of this.#watched.values()) w.abort.abort();
    this.#watched.clear();
  }
}
