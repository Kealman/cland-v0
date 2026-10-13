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
import { continueWith, wait, untimed } from './continuations.ts';
import type { Resumed } from '../hub/worktrees.ts';
import { randomUUID } from 'node:crypto';
import { existsSync, renameSync } from 'node:fs';
import { FailedLaunches, LaunchFiles } from './launch-files.ts';
import { dirname } from 'node:path';
import type { Message, SessionState, SessionUsage, TopicRef } from '../protocol.ts';
import { addUsage } from './usage.ts';
import { envelope, envelopeIds, type AdapterHost, type Capabilities, type HarnessAdapter, type HarnessProcess, type Interpretation, type ResumeResult, type SpawnRequest } from './contract.ts';
import { formatModel, KNOWN_GOOD_FREE_MODELS, OpenCodeClient, parseModel, pickFreeModel, type ModelRef, type PermissionRequest } from './opencode/client.ts';
import { prepareFiles, readPassword, serverFiles, startServer, type ServerFiles } from './opencode/server.ts';
import { SessionTracker, type Change } from './opencode/state.ts';
import { processAlive } from './processes.ts';
import { endProcess } from '../system-processes.ts';



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
  /** Grace before a verified process tree is killed. */
  stopGraceMs?: number;
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
type Watch = { process: HarnessProcess; client: OpenCodeClient; tracker: SessionTracker; abort: AbortController; inbox: Map<string, string[]>; turnMessages: Set<string> };

export class OpenCodeAdapter implements HarnessAdapter {
  readonly harness = OPENCODE;
  readonly capabilities = OPENCODE_CAPABILITIES;
  readonly #host: AdapterHost;
  readonly #recoveries: FailedLaunches;
  readonly #bin: string;
  readonly #pollMs: number;
  readonly #stopGraceMs: number;
  readonly #injectTimeoutMs: number;
  readonly #spawnDeadlineMs: number;
  readonly #env: NodeJS.ProcessEnv;
  readonly #clandDir: string;
  readonly #watched = new Map<string, Watch>();
  readonly #watching = new Map<string, object>();
  readonly #usage = new Map<string, SessionUsage>();
  #timer: NodeJS.Timeout | null = null;
  #closed = false;
  readonly #stopping = new Set<string>();

  constructor(host: AdapterHost, options: OpenCodeOptions = {}) {
    this.#host = host;
    this.#recoveries = new FailedLaunches(host.log, 1000, host.durableLaunchRecovery);
    this.#bin = options.bin ?? process.env.CLAND_OPENCODE_BIN ?? 'opencode';
    this.#pollMs = options.pollMs ?? 5000;
    this.#stopGraceMs = options.stopGraceMs ?? 5000;
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
  #config(name: string, role: string | null, sessionId: string, launchToken?: string): Record<string, unknown> {
    const environment: Record<string, string> = {
      CLAND_HUB_FILE: this.#host.discoveryFile,
      CLAND_SESSION_ID: sessionId,
      CLAND_SESSION_NAME: name,
      ...(launchToken ? { CLAND_LAUNCH_TOKEN: launchToken } : {}),
      // the adapter injects: the spoke only accepts deliveries
      CLAND_DELIVERY: 'adapter',
      ...(role ? { CLAND_ROLE: role } : {}),
    };
    return { $schema: 'https://opencode.ai/config.json', mcp: { servers: { cland: { type: 'local', command: [this.#host.node, this.#host.spoke], environment } } } };
  }

  async #launch(p: Pick<HarnessProcess, 'name' | 'role' | 'model' | 'cwd' | 'sessionId' | 'harnessSessionId'>, relaunch: boolean, resumed: Resumed = untimed, launchToken?: string, authorize: () => void = () => {}, retainConversation = false): Promise<HarnessProcess> {
    return continueWith((function* (this: OpenCodeAdapter): Generator<Promise<unknown>, HarnessProcess, unknown> {
      this.#recoveries.assertAvailable(p.name, p.sessionId);
      const files = this.#files(p.name);
      const transaction = new LaunchFiles(resumed);
      let pid: number | undefined;
      try {
        const password = yield* wait(prepareFiles(this.#clandDir, files, this.#config(p.name, p.role, p.sessionId, launchToken), !relaunch, transaction, resumed, entry => this.#host.log(entry)));
        yield* wait(transaction.file(files.log, true));
        const started = yield* wait(startServer({ bin: this.#bin, cwd: p.cwd, env: this.#env, files, password, deadlineMs: this.#spawnDeadlineMs, resumed, authorize, transaction, log: this.#host.log, stopGraceMs: this.#stopGraceMs }));
        pid = started.pid;
        const { url } = started;
        const client = new OpenCodeClient(url, password);
        let model: ModelRef | null = p.model ? parseModel(p.model) : null;
        let session = p.harnessSessionId ? yield* wait(client.session(p.harnessSessionId)) : null;
        if (relaunch && !session) throw new Error(`cannot resume OpenCode conversation ${p.harnessSessionId}: session not found`);
        if (retainConversation) {
          if (!session) throw new Error(`cannot retain OpenCode conversation ${p.harnessSessionId}: session not found`);
          const conversation = session.id;
          authorize();
          yield* wait(client.moveSession(conversation, p.cwd));
          const deadline = Date.now() + this.#spawnDeadlineMs;
          while (session?.location?.directory !== p.cwd) {
            if (Date.now() >= deadline) throw new Error(`OpenCode conversation ${conversation} did not move to ${p.cwd}`);
            yield* wait(new Promise(resolve => setTimeout(resolve, 50)));
            const moved = yield* wait(client.session(conversation));
            if (!moved) throw new Error(`OpenCode conversation ${conversation} disappeared during handoff`);
            session = moved;
          }
          authorize();
        }
        if (!session) {
          if (!model)
            model = yield* wait(this.#freeModel(client, resumed));
          authorize();
          session = yield* wait(client.createSession({ ...(p.harnessSessionId ? { id: p.harnessSessionId } : {}), title: p.name, model, directory: p.cwd }));
        }
        const chosen = session.model ? formatModel(session.model) : model ? formatModel(model) : p.model;
        this.#host.log({ event: 'harness-launched', harness: this.harness, session: p.name, url, pid, harnessSessionId: session.id, model: chosen, relaunch });
        transaction.commit();
        return { ...p, harness: this.harness, model: chosen ?? null, pid, harnessId: url, harnessSessionId: session.id, startedAt: new Date().toISOString(), status: 'running' };
      } catch (err) {
        // a server whose session could not be made is of no use: it does not outlive the failed launch
        return yield* wait(this.#recoveries.failed(p.sessionId, p.name, transaction, err, () => {}));
      }
    }).call(this), resumed);
  }

  /** A cold catalog can be nonempty before Zen arrives. Choose a known-good model immediately; otherwise wait
   *  for a nonempty catalog to stay unchanged for 1 s, within a 10 s budget including requests and sleeps. */
  async #freeModel(client: OpenCodeClient, resumed: Resumed = untimed): Promise<ModelRef | null> {
    return continueWith((function* (this: OpenCodeAdapter): Generator<Promise<unknown>, ModelRef | null, unknown> {
      const deadline = Date.now() + 10000;
      let catalog = '';
      let stableSince = Date.now();
      let choice: ModelRef | null = null;
      while (Date.now() < deadline) {
        const models = yield* wait(client.models(Math.max(1, deadline - Date.now())).catch(() => null));
        if (models) {
          const current = JSON.stringify(models);
          if (current !== catalog) {
            catalog = current;
            stableSince = Date.now();
          }
          choice = pickFreeModel(models);
          if (choice && KNOWN_GOOD_FREE_MODELS.includes(formatModel(choice)))
            return choice;
          if (models.length && Date.now() - stableSince >= 1000)
            return choice;
        }
        const remaining = deadline - Date.now();
        if (remaining > 0)
          yield* wait(new Promise((r) => setTimeout(r, Math.min(200, remaining))));
      }
      return choice;
    }).call(this), resumed);
  }

  spawn(request: SpawnRequest, resumed: Resumed = untimed, authorize: () => void = () => {}): Promise<HarnessProcess> {
    return this.#launch({ name: request.name, role: request.role, model: request.model, cwd: request.cwd, sessionId: request.sessionId ?? randomUUID(), harnessSessionId: request.resumeConversation ?? null }, false, resumed, request.launchToken, authorize, request.resumeConversation !== undefined);
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

  async #client(p: HarnessProcess): Promise<OpenCodeClient> {
    const watched = this.#watched.get(p.sessionId);
    if (watched && watched.client.url === p.harnessId) return watched.client;
    const password = await readPassword(this.#files(p.name));
    if (!p.harnessId || !password) throw new Error(`no server url or password recorded for ${p.name}`);
    return new OpenCodeClient(p.harnessId, password);
  }

  async inject(p: HarnessProcess, message: Message, topic: TopicRef | null): Promise<void> {
    if (!p.harnessSessionId) throw new Error(`no OpenCode session recorded for ${p.name}`);
    const tracker = this.#watched.get(p.sessionId)?.tracker;
    // during a turn the message steers it (at the next step boundary); otherwise it is queued as the next turn
    const delivery = tracker?.running ? 'steer' : 'queue';
    const admitted = await (await this.#client(p)).prompt(p.harnessSessionId, envelope(message, topic), delivery, this.#injectTimeoutMs);
    if (!admitted?.id) throw new Error('the server admitted no inbox item');
    this.#host.log({ event: 'opencode-prompt', session: p.name, id: message.id, inbox: admitted.id, delivery });
  }

  /** OpenCode confirms through the prompt API's reply: nothing comes back through the hub. */
  confirm(): void {}

  /** No signal is posted from inside an OpenCode session: its state comes from the event stream. */
  interpret(): Interpretation {
    return {};
  }

  usage(p: HarnessProcess): SessionUsage | null {
    return this.#usage.get(p.sessionId) ?? null;
  }

  forget(sessionId: string): void { this.unwatch(sessionId); this.#usage.delete(sessionId); }

  // ---------------------------------------------------------------- watch: the event stream and liveness

  watch(p: HarnessProcess): void {
    this.#unwatch(p.sessionId);
    const ticket = {};
    this.#watching.set(p.sessionId, ticket);
    void this.#watch(p, ticket);
  }

  async #watch(p: HarnessProcess, ticket: object): Promise<void> {
    if (!p.harnessId || !p.harnessSessionId) return;
    const password = await readPassword(this.#files(p.name));
    if (this.#closed || this.#watching.get(p.sessionId) !== ticket) return;
    if (!password) {
      this.#host.log({ event: 'opencode-no-password', session: p.name });
      return;
    }
    const w: Watch = { process: p, client: new OpenCodeClient(p.harnessId, password), tracker: new SessionTracker(p.harnessSessionId), abort: new AbortController(), inbox: new Map(), turnMessages: new Set() };
    this.#watched.set(p.sessionId, w);
    void this.#subscribe(w);
    if (!this.#timer) {
      this.#timer = setInterval(() => this.#checkPids(), this.#pollMs);
      this.#timer.unref();
    }
  }

  #apply(w: Watch, change: Change, at: number): void {
    if (change.model) this.#host.signal(w.process.sessionId, { model: change.model, source: 'sse', at });
    if (change.ended) {
      const messages = [...w.turnMessages];
      w.turnMessages.clear();
      if (change.turnError) this.#host.turnFailed?.(w.process.sessionId, change.turnError, messages);
    }
    if (change.usage) {
      this.#usage.set(w.process.sessionId, addUsage(this.#usage.get(w.process.sessionId), change.usage));
      this.#host.usageChanged?.(w.process.sessionId);
    }
    if (change.state) this.#host.signal(w.process.sessionId, { state: change.state, source: 'sse', at, ...(change.approvalCommand !== undefined ? { approvalCommand: change.approvalCommand } : {}) });
  }

  #describePermission(w: Watch, request: PermissionRequest): void {
    const pending = w.tracker.permissions.get(request.id);
    if (!pending) return;
    void w.client.approvalCommand(w.tracker.sessionId, request).then(command => {
      if (this.#watched.get(w.process.sessionId) !== w) return;
      this.#apply(w, w.tracker.describePermission(pending, command), Date.now());
    });
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
            if (e.type === 'session.created' && d.parentID === w.tracker.sessionId) {
              const model = d.model as ModelRef | undefined;
              this.#host.signal(w.process.sessionId, { source: 'sse', at: e.created ?? Date.now(), subagent: {
                ...(typeof d.sessionID === 'string' ? { id: d.sessionID } : {}),
                ...(typeof d.agent === 'string' ? { type: d.agent } : {}),
                ...(model && typeof model.id === 'string' && typeof model.providerID === 'string' ? { model: formatModel(model) } : {}),
              } });
            }
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
            if (e.type === 'permission.asked' && d.sessionID === w.tracker.sessionId && typeof d.id === 'string') this.#describePermission(w, { ...d, id: d.id });
          },
          () => {
            failures = 0;
            // the stream is live-only: what it missed comes from a snapshot taken once it is open
            w.client
              .snapshot(w.tracker.sessionId)
              .then((s) => {
                this.#apply(w, w.tracker.reset(s), Date.now());
                for (const permission of s.permissions) this.#describePermission(w, permission);
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
      // The stream is volatile: an execution may have finished while disconnected. None of its inputs
      // can safely be attributed to the next observed execution, including queued inbox items.
      w.turnMessages.clear();
      w.inbox.clear();
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
    if (this.#stopping.has(w.process.sessionId)) return;
    if (this.#watched.get(w.process.sessionId) !== w) return;
    this.#unwatch(w.process.sessionId);
    this.#host.exited(w.process.sessionId, detail);
  }

  #unwatch(sessionId: string): void {
    this.#watching.delete(sessionId);
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

  unwatch(sessionId: string): void { this.#unwatch(sessionId); }

  // ---------------------------------------------------------------- stop, resume

  async stop(p: HarnessProcess, resumed: Resumed = untimed, authorize: () => void = () => {}): Promise<void> {
    this.#stopping.add(p.sessionId);
    let ended = false;
    try {
      if (!await endProcess(p, (entry) => this.#host.log({ ...entry, harness: this.harness, session: p.name }), this.#stopGraceMs, undefined, { resumed, authorize, allowReused: p.status === 'exited' })) throw new Error(`could not stop "${p.name}": its process identity cannot be verified; it is still watched`);
      ended = true;
    } finally {
      resumed(() => {
        if (ended) this.#unwatch(p.sessionId);
        this.#stopping.delete(p.sessionId);
      });
    }
  }

  async resume(p: HarnessProcess, options: { relaunch?: boolean; resumed?: Resumed } = {}): Promise<ResumeResult> {
    return continueWith((function* (this: OpenCodeAdapter): Generator<Promise<unknown>, ResumeResult, unknown> {
      const resumed = options.resumed ?? untimed;
      this.#recoveries.assertAvailable(p.name, p.sessionId);
      let reason: string;
      if (!(yield* wait(processAlive(p, options.resumed))))
        reason = p.pid !== null && pidAlive(p.pid) ? `the server's pid ${p.pid} belongs to another process now` : `the server's pid ${p.pid ?? '?'} is gone`;
      else if (!p.harnessId || !p.harnessSessionId)
        reason = 'no server url or session recorded';
      else {
        const password = yield* wait(readPassword(this.#files(p.name), resumed));
        if (!password)
          reason = 'the server password file is gone';
        else {
          const client = new OpenCodeClient(p.harnessId, password);
          try {
            const session = yield* wait(client.session(p.harnessSessionId));
            if (session) {
              const tracker = new SessionTracker(p.harnessSessionId);
              tracker.reset(yield* wait(client.snapshot(p.harnessSessionId)));
              return { found: true, process: { ...p, status: 'running' }, state: tracker.state() };
            }
            reason = `the server at ${p.harnessId} does not know session ${p.harnessSessionId}`;
          }
          catch (err) {
            reason = `the server at ${p.harnessId} does not answer: ${err instanceof Error ? err.message : String(err)}`;
          }
        }
      }
      if (!options.relaunch)
        return { found: false, reason };
      yield* wait(this.stop(p, options.resumed));
      const process_ = yield* wait(this.#launch({ name: p.name, role: p.role, model: p.model, cwd: p.cwd, sessionId: p.sessionId, harnessSessionId: p.harnessSessionId }, true, resumed));
      return { found: true, process: process_, state: 'unknown' as SessionState };
    }).call(this), options.resumed ?? untimed);
  }

  close(): void {
    this.#recoveries.close();
    this.#closed = true;
    this.#watching.clear();
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
    for (const w of this.#watched.values()) w.abort.abort();
    this.#watched.clear();
  }
}
