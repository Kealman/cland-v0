import { withoutExecutorCredentials } from '../../../shared/executor-credentials.ts';
import { harnessBinary } from '../doctor/harnesses.ts';
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
//   inject   `POST /api/session/{id}/prompt {id, text, delivery}`: `steer` while the session runs a turn, `queue`
//            otherwise. The server's reply is the durably admitted inbox item: that is the confirmation.
//   state    the event stream `GET /api/event` (`./opencode/state.ts`), one subscription per server, with a
//            snapshot (`/api/session/active`, pending permissions and forms) each time it (re)connects; the
//            server's pid is checked every poll, and a dead one is `unknown`.
//   stop     SIGTERM to the server (which ends its MCP servers, the spoke among them).
//   resume   the pid alive and the server answering for the recorded session; else, with `relaunch`, a new server
//            on the same config and password, and the same session (OpenCode keeps sessions in its own database;
//            a session it lost is created again under its id).
import { accountEnvironment, accountPrefix, clandOpenCodeDatabase, openCodeDatabase } from '../accounts/registry.ts';
import { continueWith, wait, untimed } from './continuations.ts';
import type { Resumed } from '../hub/worktrees.ts';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, renameSync } from 'node:fs';
import { FailedLaunches, LaunchFiles } from './launch-files.ts';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import type { ApprovalChoice, ApprovalOutcome, Message, SessionState, SessionUsage, TopicRef } from '../protocol.ts';
import { addUsage } from './usage.ts';
import { envelope, envelopeIds, type AdapterHost, type Capabilities, type HarnessAdapter, type HarnessProcess, type Interpretation, type LaunchPolicy, type ResumeResult, type SpawnRequest } from './contract.ts';
import { sessionPolicy } from './opencode/policy.ts';
import { formatModel, HttpError, KNOWN_GOOD_FREE_MODELS, OpenCodeClient, parseModel, permissionRequest, pickFreeModel, type ModelRef, type PermissionRequest, type ServerEvent } from './opencode/client.ts';
import { prepareFiles, readPassword, serverFiles, startServer, type ServerFiles } from './opencode/server.ts';
import { realClock, type Clock, type ClockTimer } from '../hub/clock.ts';
import { SessionTracker, type Change } from './opencode/state.ts';
import { processAlive } from './processes.ts';
import { endProcess } from '../system-processes.ts';



export const OPENCODE = 'opencode';

export const OPENCODE_CLAUSE_AT_SPAWN = false;

export const OPENCODE_CAPABILITIES: Capabilities = {
  terminal: 'none',
  launchPolicy: 'rules, not a sandbox',
  // the session's messages are readable (`GET /api/session/{id}/message`), but cland does not read them in v0
  history: 'none',
  // `session.step.ended` carries each assistant message's tokens and cost
  usage: 'reliable',
  // `POST /api/session/{id}/model` exists; the contract has no setModel yet
  setModel: 'none',
  // Human-only answers through the permission reply endpoint; shape drift stays in the TUI.
  approvalRelay: 'reliable',
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
  /** Watch scheduling; native HTTP and process-lifecycle deadlines remain real. */
  clock?: Clock;
  /** Experiment: deliver hub role clauses as a replaceable instruction entry. Default false. */
  roleInstructions?: boolean;
  /** Grace before a verified process tree is killed. */
  stopGraceMs?: number;
  /** The `opencode` executable: `CLAND_OPENCODE_BIN`, PATH, then the installer folders. */
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

type WatchedApproval = { tracker: SessionTracker; reported: boolean; validation?: number; answerIn?: 'hub' | 'tui'; answering?: boolean; outcome?: ApprovalOutcome };

/** One watched session: its server's client, the event subscription, and what the stream says. */
type Watch = { process: HarnessProcess; client: OpenCodeClient; tracker: SessionTracker; children: Map<string, SessionTracker>; approvals: Map<string, WatchedApproval>; owners: Map<string, string>; abort: AbortController; inbox: Map<string, string[]>; turnMessages: Set<string> };
/** PID supervision survives missing native connection material. One attempt per session may read it. */
type WatchTicket = { process: HarnessProcess; pending: boolean; warned: boolean };

export class OpenCodeAdapter implements HarnessAdapter {
  readonly harness = OPENCODE;
  readonly capabilities = OPENCODE_CAPABILITIES;
  readonly clauseAtSpawn = OPENCODE_CLAUSE_AT_SPAWN;
  readonly #host: AdapterHost;
  readonly #clock: Clock;
  readonly #recoveries: FailedLaunches;
  readonly #bin: string;
  readonly #pollMs: number;
  readonly #stopGraceMs: number;
  readonly #injectTimeoutMs: number;
  readonly #roleInstructions: boolean;
  readonly #spawnDeadlineMs: number;
  readonly #env: NodeJS.ProcessEnv;
  readonly #processEnv: NodeJS.ProcessEnv;
  readonly #clandDir: string;
  readonly #watched = new Map<string, Watch>();
  readonly #watching = new Map<string, WatchTicket>();
  readonly #usage = new Map<string, SessionUsage>();
  #timer: ClockTimer | null = null;
  #closed = false;
  readonly #stopping = new Set<string>();

  constructor(host: AdapterHost, options: OpenCodeOptions = {}) {
    this.#host = host;
    this.#clock = options.clock ?? realClock;
    this.#roleInstructions = options.roleInstructions ?? false;
    this.#processEnv = options.env ?? process.env;
    this.#recoveries = new FailedLaunches(host.log, 1000, host.durableLaunchRecovery);
    this.#bin = options.bin ?? harnessBinary('opencode', this.#processEnv);
    this.#pollMs = options.pollMs ?? 5000;
    this.#stopGraceMs = options.stopGraceMs ?? 5000;
    this.#injectTimeoutMs = options.injectTimeoutMs ?? 30_000;
    this.#spawnDeadlineMs = options.spawnDeadlineMs ?? 30_000;
    const env: NodeJS.ProcessEnv = {};
    // cland's own variables stay out, and so does a password or config meant for another OpenCode server
    for (const [k, v] of Object.entries(withoutExecutorCredentials(options.env ?? process.env))) if (!k.startsWith('CLAND_') && !['OPENCODE_CONFIG', 'OPENCODE_CONFIG_CONTENT', 'OPENCODE_PASSWORD', 'OPENCODE_DB', 'XDG_DATA_HOME'].includes(k)) env[k] = v;
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

  async #launch(p: Pick<HarnessProcess, 'name' | 'role' | 'model' | 'cwd' | 'sessionId' | 'harnessSessionId' | 'account' | 'accountEnv' | 'item' | 'effort'> & LaunchPolicy, relaunch: boolean, resumed: Resumed = untimed, launchToken?: string, authorize: () => void = () => {}, retainConversation = false): Promise<HarnessProcess> {
    return continueWith((function* (this: OpenCodeAdapter): Generator<Promise<unknown>, HarnessProcess, unknown> {
      this.#recoveries.assertAvailable(p.name, p.sessionId);
      p = { ...p, accountEnv: p.accountEnv ?? { OPENCODE_DB: clandOpenCodeDatabase(this.#processEnv) } };
      const files = this.#files(p.name);
      const transaction = new LaunchFiles(resumed);
      let pid: number | undefined;
      try {
        const password = yield* wait(prepareFiles(this.#clandDir, files, this.#config(p.name, p.role, p.sessionId, launchToken), !relaunch, transaction, resumed, entry => this.#host.log(entry)));
        yield* wait(transaction.file(files.log, true));
        const started = yield* wait(startServer({ bin: this.#bin, cwd: p.cwd, env: withoutExecutorCredentials(accountEnvironment(this.#env, p.accountEnv)), files, password, deadlineMs: this.#spawnDeadlineMs, resumed, authorize, transaction, log: this.#host.log, stopGraceMs: this.#stopGraceMs }));
        pid = started.pid;
        const { url } = started;
        const client = new OpenCodeClient(url, password);
        const policy = { ...sessionPolicy(p), warnings: [] as string[] };
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
          if (p.effort && !model?.variant) {
            const models = yield* wait(client.models().catch(() => null));
            const entry = models?.find(entry => entry.providerID === model?.providerID && entry.id === model.id);
            if (model && entry?.variants?.some(variant => variant.id === p.effort)) model = { ...model, variant: p.effort };
            else policy.warnings.push(`effort ${p.effort}: ${model ? formatModel(model) : 'the default model'} has no matching catalog variant${models === null ? ' (catalog unavailable)' : ''}; using no variant`);
          }
          authorize();
          session = yield* wait(client.createSession({ ...(p.harnessSessionId ? { id: p.harnessSessionId } : {}), title: p.name, model, directory: p.cwd, permissions: policy.rules }));
        } else {
          policy.rules = session.permissions ?? [];
          policy.warnings.push('Existing conversation retains its native permission rules and model variant');
        }
        const chosen = session.model ? formatModel(session.model) : model ? formatModel(model) : p.model;
        this.#host.log({ event: 'harness-launched', harness: this.harness, session: p.name, url, pid, harnessSessionId: session.id, model: chosen, database: openCodeDatabase(p.accountEnv ?? {}), policy, relaunch });
        transaction.commit();
        return { ...p, harness: this.harness, model: chosen ?? null, launchPolicy: policy, pid, harnessId: url, harnessSessionId: session.id, startedAt: new Date().toISOString(), status: 'running' };
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
    return this.#launch({ account: request.account ?? null, accountEnv: request.accountEnv ?? null, name: request.name, role: request.role, model: request.model, cwd: request.cwd, sessionId: request.sessionId ?? randomUUID(), harnessSessionId: request.resumeConversation ?? null, item: request.item ?? null, effort: request.effort ?? null, approval: request.approval ?? null, sandbox: request.sandbox ?? null, permissions: request.permissions ?? null }, false, resumed, request.launchToken, authorize, request.resumeConversation !== undefined);
  }

  /** The session was renamed: its files (config, password, log) move with it, so attach and resume find them. */
  renamed(p: HarnessProcess, from: string): void {
    const ticket = this.#watching.get(p.sessionId);
    if (ticket) ticket.process = { ...ticket.process, name: p.name };
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
    return accountPrefix(p.accountEnv) + `OPENCODE_PASSWORD="$(cat ${sq(password)})" ${bin} --server ${bare(p.harnessId ?? '')} --session ${bare(p.harnessSessionId ?? '')} ${sq(p.cwd)}`;
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
    const client = await this.#client(p);
    if (this.#roleInstructions) {
      const isClause = (m: Message) => m.fromKind === 'hub' && m.from === 'hub' && m.kind === 'role';
      const clauses = [...(message.digest ?? []).filter(isClause), ...(isClause(message) ? [message] : [])];
      if (clauses.length) {
        try {
          // A stable key replaces assignment, handover and revocation alike; retries cannot append stale roles.
          const latest = clauses.at(-1)!;
          await client.roleInstruction(p.harnessSessionId, envelope({ ...latest, digest: [] }, null), this.#injectTimeoutMs);
          if (isClause(message)) return;
          message = { ...message, digest: (message.digest ?? []).filter(m => !isClause(m)) };
        } catch {
          // A failed PUT may leave an earlier role (or an unacknowledged new write) installed.
          // Only confirmed deletion permits message fallback; cleanup failure leaves delivery unconfirmed.
          await client.clearRoleInstruction(p.harnessSessionId, this.#injectTimeoutMs);
          this.#host.log({ event: 'opencode-instructions-fallback', session: p.name, id: message.id });
        }
      }
    }
    const tracker = this.#watched.get(p.sessionId)?.tracker;
    // during a turn the message steers it (at the next step boundary); otherwise it is queued as the next turn
    const delivery = (message.detail?.event === 'heartbeat' || message.digest?.some(note => note.detail?.event === 'heartbeat')) ? 'queue' : tracker?.running ? 'steer' : 'queue';
    // Keep the native admission identity stable across lost replies and distinct for broadcast recipients.
    const id = `msg_${createHash('sha256').update(JSON.stringify([message.id, p.sessionId])).digest('hex')}`;
    const admitted = await client.prompt(p.harnessSessionId, envelope(message, topic), delivery, this.#injectTimeoutMs, id);
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

  async answerApproval(p: HarnessProcess, requestId: string, answer: { choice: ApprovalChoice; note?: string }): Promise<{ noteDelivered: boolean }> {
    const w = this.#watched.get(p.sessionId);
    const tracker = w && [w.tracker, ...w.children.values()].find(t => t.permissions.has(requestId));
    if (!w || !tracker) throw new Error('no pending OpenCode permission; waiting for the harness outcome');
    const approval = w.approvals.get(requestId);
    if (!approval?.reported) throw new Error('the OpenCode approval subject is still being validated');
    if (approval.answerIn !== 'hub') throw new Error('this approval stays in the harness TUI');
    approval.answering = true;
    try {
      await w.client.request('POST', `/api/session/${encodeURIComponent(tracker.sessionId)}/permission/${encodeURIComponent(requestId)}/reply`, {
        decision: answer.choice === 'deny' ? 'reject' : answer.choice,
        ...(answer.note !== undefined ? { message: answer.note } : {}),
      });
    } catch (error) {
      if (approval) {
        approval.answering = false;
        if (approval.outcome) {
          const outcome = approval.outcome;
          delete approval.outcome;
          this.#closePermission(w, requestId, outcome);
        }
      }
      // Native error bodies can contain permission metadata; only safe categories leave the adapter.
      const category = error instanceof HttpError ? `HTTP ${error.status}${error.status === 404 ? '; not found' : ''}` : 'transport';
      throw new Error(`OpenCode permission reply failed (${category}); waiting for the harness outcome`);
    }
    if (approval) {
      approval.answering = false;
      // A successful reply confirms our own choice. A different observed choice won externally.
      if (approval.outcome && approval.outcome.choice !== answer.choice) {
        const outcome = approval.outcome;
        delete approval.outcome;
        this.#closePermission(w, requestId, outcome);
      } else if (approval.outcome) {
        w.approvals.delete(requestId);
        w.owners.delete(requestId);
        this.#saveOwners(w);
      }
    }
    return { noteDelivered: true };
  }

  watch(p: HarnessProcess): void {
    if (this.#closed) return;
    this.#unwatch(p.sessionId);
    const ticket: WatchTicket = { process: p, pending: false, warned: false };
    this.#watching.set(p.sessionId, ticket);
    if (!this.#timer) {
      this.#timer = this.#clock.setInterval(() => this.#checkPids(), this.#pollMs);
      this.#timer.unref();
    }
    void this.#watch(ticket);
  }

  async #watch(ticket: WatchTicket): Promise<void> {
    const p = ticket.process;
    if (ticket.pending || this.#closed || this.#watching.get(p.sessionId) !== ticket || this.#watched.has(p.sessionId)) return;
    if (!p.harnessId || !p.harnessSessionId) return;
    ticket.pending = true;
    try {
      const password = await readPassword(this.#files(p.name));
      if (this.#closed || this.#watching.get(p.sessionId) !== ticket) return;
      if (!password) {
        if (!ticket.warned) this.#host.log({ event: 'opencode-no-password', session: ticket.process.name });
        ticket.warned = true;
        return;
      }
      const owners = new Map<string, string>(JSON.parse(this.#host.adapterState?.read(`opencode.approvalOwners:${p.sessionId}`) ?? '[]') as Array<[string, string]>);
      const children = new Map([...owners.values()].filter(id => id !== p.harnessSessionId).map(id => [id, new SessionTracker(id)]));
      const w: Watch = { process: ticket.process, client: new OpenCodeClient(p.harnessId, password), tracker: new SessionTracker(p.harnessSessionId), children, approvals: new Map(), owners, abort: new AbortController(), inbox: new Map(), turnMessages: new Set() };
      this.#watched.set(p.sessionId, w);
      void this.#subscribe(w);
    } finally { ticket.pending = false; }
  }

  #apply(w: Watch, change: Change, at: number): void {
    if (change.limitHit) this.#host.limitHit?.(w.process.sessionId, change.limitHit);
    if (change.model) this.#host.signal(w.process.sessionId, { model: change.model, source: 'sse', at });
    if (change.ended) {
      const messages = [...w.turnMessages];
      w.turnMessages.clear();
      if (change.rejection) {
        const rejection = change.rejection;
        // The human may reply before the waiting-state command lookup finishes. Recover it for the report too.
        void w.client.approvalCommand(w.tracker.sessionId, rejection.request).then(command => {
          const description = command === rejection.request.action ? rejection.approvalCommand ?? command : command ?? rejection.approvalCommand;
          this.#host.turnFailed?.(w.process.sessionId, `Approval rejected${description ? `: ${description}` : ''}`, messages);
        });
      } else if (change.turnError) this.#host.turnFailed?.(w.process.sessionId, change.turnError, messages);
    }
    if (change.serverShutdown) { this.#gone(w, 'opencode server shutdown'); return; }
    if (change.usage) {
      this.#usage.set(w.process.sessionId, addUsage(this.#usage.get(w.process.sessionId), change.usage));
      this.#host.usageChanged?.(w.process.sessionId);
    }
    if (change.state) {
      const trackers = [w.tracker, ...w.children.values()];
      const permission = trackers.find(t => t.permissions.size)?.permissions.values().next().value;
      const state = permission ? 'waiting for approval' : trackers.some(t => t.forms.size) ? 'waiting for human' : trackers.some(t => t.running) ? 'busy' : 'idle';
      this.#host.signal(w.process.sessionId, { state, source: 'sse', at, ...(permission?.approvalCommand !== undefined ? { approvalCommand: permission.approvalCommand } : {}) });
    }
  }

  #describePermission(w: Watch, request: PermissionRequest, tracker = w.tracker): void {
    const pending = tracker.permissions.get(request.id);
    if (!pending) return;
    let approval = w.approvals.get(request.id);
    if (!approval) {
      approval = { tracker, reported: false };
      w.approvals.set(request.id, approval);
      if (tracker !== w.tracker) { w.owners.set(request.id, tracker.sessionId); this.#saveOwners(w); }
    }
    const current = approval;
    const validation = (current.validation ?? 0) + 1;
    current.validation = validation;
    current.reported = false;
    delete current.answerIn;
    void w.client.approvalDetails(tracker.sessionId, request).then(({ command, subject }) => {
      if (this.#watched.get(w.process.sessionId) !== w || w.approvals.get(request.id) !== current || current.validation !== validation) return;
      // A late description may finish a closed record, but cannot change a later waiting episode.
      this.#apply(w, tracker.describePermission(pending, command), this.#clock.now().getTime());
      if (current.reported) return;
      current.answerIn = subject ? 'hub' : 'tui';
      this.#host.approvalRequested?.(w.process.sessionId, {
        id: request.id, kind: request.action === 'shell' ? 'command' : 'other',
        subject: subject ?? {}, choices: subject ? ['once', 'always', 'deny'] : [], answerIn: subject ? 'hub' : 'tui',
      });
      current.reported = true;
      if (!subject) this.#host.log({ event: 'opencode-approval-shape', severity: 'warn', session: w.process.name, request: request.id });
      if (current.outcome) {
        const outcome = current.outcome;
        delete current.outcome;
        this.#closePermission(w, request.id, outcome);
      }
    });
  }

  #saveOwners(w: Watch): void {
    this.#host.adapterState?.write(`opencode.approvalOwners:${w.process.sessionId}`, JSON.stringify([...w.owners]));
  }

  #closePermission(w: Watch, id: string, outcome: ApprovalOutcome): void {
    const approval = w.approvals.get(id);
    if (!approval || approval.outcome) return;
    if (!approval.reported || approval.answering) { approval.outcome = outcome; return; }
    w.approvals.delete(id);
    w.owners.delete(id);
    this.#saveOwners(w);
    this.#host.approvalClosed?.(w.process.sessionId, id, outcome);
  }

  #permissionEvent(w: Watch, tracker: SessionTracker, event: ServerEvent): void {
    const d = event.data ?? {};
    if (d.sessionID !== tracker.sessionId) return;
    const id = typeof d.requestID === 'string' ? d.requestID : typeof d.id === 'string' ? d.id : undefined;
    const reply = d.reply;
    const choice = reply === 'reject' ? 'deny' : reply === 'once' || reply === 'always' ? reply : 'answered in the harness';
    const all = () => [...w.approvals].filter(([, a]) => a.tracker === tracker).map(([id]) => id);
    const ids = event.type === 'permission.replied' ? reply === 'reject' ? all() : id ? [id] : []
      : ['session.execution.succeeded', 'session.execution.failed', 'session.execution.interrupted'].includes(event.type) ? all() : [];
    for (const requestId of ids) this.#closePermission(w, requestId, {
      choice: event.type === 'permission.replied' ? choice : 'withdrawn', by: 'harness', via: 'harness', at: new Date(event.created ?? this.#clock.now().getTime()).toISOString(),
    });
  }

  /** Keep one subscription to the server's events, re-opened (with a fresh snapshot) until the session is unwatched. */
  async #subscribe(w: Watch): Promise<void> {
    let failures = 0;
    while (!this.#closed && this.#watched.get(w.process.sessionId) === w) {
      let streamCurrent = true;
      let snapshotEvents: ServerEvent[] | null = [];
      try {
        await w.client.events(
          (e) => {
            const raw = e.data ?? {};
            if (e.type === 'permission.asked' && (raw.sessionID === w.tracker.sessionId || typeof raw.sessionID === 'string' && w.children.has(raw.sessionID))) {
              e = { ...e, data: { sessionID: raw.sessionID, ...permissionRequest(raw) } };
            }
            snapshotEvents?.push(e);
            // An admission can queue the next turn: only delivered inbox items fed this execution.
            const d = e.data ?? {};
            if (e.type === 'session.moved' && d.sessionID === w.tracker.sessionId && w.process.item) {
              const location = d.location as { directory?: unknown } | undefined;
              if (typeof location?.directory === 'string') {
                const directory = resolve(location.directory, typeof d.subpath === 'string' ? d.subpath : '');
                const path = relative(w.process.cwd, directory);
                if (path === '..' || path.startsWith('../') || isAbsolute(path)) this.#host.signal(w.process.sessionId, { source: 'sse', at: e.created ?? this.#clock.now().getTime(), moved: { directory } });
              }
            }
            if (e.type === 'session.created' && d.parentID === w.tracker.sessionId) {
              const model = d.model as ModelRef | undefined;
              if (typeof d.sessionID === 'string' && !w.children.has(d.sessionID)) {
                const child = new SessionTracker(d.sessionID);
                if (model && typeof model.id === 'string' && typeof model.providerID === 'string') child.model = formatModel(model);
                w.children.set(d.sessionID, child);
              }
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
            const form = d.form as { sessionID?: string } | undefined;
            const sid = typeof d.sessionID === 'string' ? d.sessionID : form?.sessionID;
            const child = sid ? w.children.get(sid) : undefined;
            if (child) {
              this.#permissionEvent(w, child, e);
              const change = child.apply(e);
              // A child's model and execution boundaries belong to that child, not the parent turn.
              this.#apply(w, { ...(change.usage ? { usage: change.usage } : {}), ...(change.state ? { state: change.state } : {}) }, e.created ?? Date.now());
              if (e.type === 'permission.asked' && typeof d.id === 'string') this.#describePermission(w, { ...d, id: d.id }, child);
            }
            this.#permissionEvent(w, w.tracker, e);
            this.#apply(w, w.tracker.apply(e), e.created ?? Date.now());
            if (e.type === 'permission.asked' && d.sessionID === w.tracker.sessionId && typeof d.id === 'string') this.#describePermission(w, { ...d, id: d.id });
          },
          () => {
            failures = 0;
            // the stream is live-only: what it missed comes from a snapshot taken once it is open
            Promise.all([w.tracker, ...w.children.values()].map(async tracker => ({ tracker, snapshot: await w.client.snapshot(tracker.sessionId) })))
              .then(snapshots => {
                if (!streamCurrent || this.#watched.get(w.process.sessionId) !== w || w.abort.signal.aborted) return;
                // Publish the whole family together: a parent's idle snapshot must not briefly clear
                // a child's approval and trigger delivery retries before that child's snapshot arrives.
                for (const { tracker, snapshot } of snapshots) tracker.reset(snapshot);
                // SSE stays live while HTTP snapshots are in flight. Replay only tracker state:
                // usage, launch records and turn completion were already published on arrival.
                for (const event of snapshotEvents ?? []) for (const { tracker } of snapshots) tracker.apply(event);
                snapshotEvents = null;
                for (const [id, approval] of w.approvals) if (!approval.tracker.permissions.has(id)) {
                  this.#closePermission(w, id, { choice: 'answered in the harness', by: 'harness', via: 'harness', at: this.#clock.now().toISOString() });
                }
                this.#apply(w, { state: w.tracker.state() }, Date.now());
                for (const { tracker } of snapshots) for (const permission of tracker.permissions.values()) this.#describePermission(w, permission.request, tracker);
                for (const [id, owner] of w.owners) if (!(w.children.get(owner)?.permissions.has(id))) w.owners.delete(id);
                this.#saveOwners(w);
                this.#host.approvalsReconciled?.(w.process.sessionId, snapshots.flatMap(({ tracker }) => [...tracker.permissions.keys()]));
                // the stream is back: what failed to inject while it was down is retried, state change or not
                this.#host.reconnected?.(w.process.sessionId);
              })
              .catch((err: unknown) => {
                snapshotEvents = null;
                this.#host.log({ event: 'opencode-snapshot-failed', session: w.process.name, error: err instanceof Error ? err.message : String(err) });
              });
          },
          w.abort.signal,
        );
      } catch (err) {
        if (w.abort.signal.aborted) return;
        failures++;
        if (failures === 1) this.#host.log({ event: 'opencode-events-failed', session: w.process.name, error: err instanceof Error ? err.message : String(err) });
      }
      streamCurrent = false;
      snapshotEvents = null;
      if (w.abort.signal.aborted) return;
      // The stream is volatile: an execution may have finished while disconnected. None of its inputs
      // can safely be attributed to the next observed execution, including queued inbox items.
      w.turnMessages.clear();
      w.inbox.clear();
      w.tracker.forget();
      for (const child of w.children.values()) child.forget();
      // a stream that ends with its server is a crash, not a reconnect
      if (w.process.pid !== null && !pidAlive(w.process.pid)) {
        this.#gone(w, `pid ${w.process.pid} is gone`);
        return;
      }
      await new Promise<void>((r) => this.#clock.setTimeout(r, Math.min(2000, 100 * 2 ** Math.min(failures, 5))));
    }
  }

  #checkPids(): void {
    for (const ticket of [...this.#watching.values()]) {
      const p = ticket.process;
      if (this.#stopping.has(p.sessionId)) continue;
      if (p.pid !== null && !pidAlive(p.pid)) {
        this.#unwatch(p.sessionId);
        this.#host.exited(p.sessionId, `pid ${p.pid} is gone`);
      } else if (!this.#watched.has(p.sessionId)) void this.#watch(ticket);
    }
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
    if (this.#watching.size === 0 && this.#timer) {
      this.#clock.clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  unwatch(sessionId: string): void { this.#unwatch(sessionId); }

  // ---------------------------------------------------------------- stop, resume

  async stop(p: HarnessProcess, resumed: Resumed = untimed, authorize: () => void = () => {}): Promise<void> {
    this.#stopping.add(p.sessionId);
    let ended = false;
    try {
      if (!await endProcess(p, (entry) => this.#host.log({ ...entry, harness: this.harness, session: p.name }), this.#stopGraceMs, undefined, { env: this.#processEnv, resumed, authorize, allowReused: p.status === 'exited' })) throw new Error(`could not stop "${p.name}": its process identity cannot be verified; it is still watched`);
      ended = true;
    } finally {
      resumed(() => {
        if (ended) this.#unwatch(p.sessionId);
        this.#stopping.delete(p.sessionId);
      });
    }
  }

  async resume(p: HarnessProcess, options: { relaunch?: boolean; authorize?: () => void; policy?: LaunchPolicy; resumed?: Resumed } = {}): Promise<ResumeResult> {
    return continueWith((function* (this: OpenCodeAdapter): Generator<Promise<unknown>, ResumeResult, unknown> {
      const resumed = options.resumed ?? untimed;
      this.#recoveries.assertAvailable(p.name, p.sessionId);
      let reason: string;
      if (!(yield* wait(processAlive(p, options.resumed, this.#processEnv))))
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
        return { found: false, reason, alive: yield* wait(processAlive(p, resumed, this.#processEnv)) };
      yield* wait(this.stop(p, options.resumed));
      const process_ = yield* wait(this.#launch({ account: p.account ?? null, accountEnv: p.accountEnv ?? null, name: p.name, role: p.role, model: p.model, cwd: p.cwd, sessionId: p.sessionId, harnessSessionId: p.harnessSessionId, item: p.item ?? null, effort: p.effort ?? null, ...options.policy }, true, resumed, undefined, options.authorize));
      return { found: true, process: process_, state: 'unknown' as SessionState };
    }).call(this), options.resumed ?? untimed);
  }

  close(): void {
    this.#recoveries.close();
    this.#closed = true;
    this.#watching.clear();
    if (this.#timer) this.#clock.clearInterval(this.#timer);
    this.#timer = null;
    for (const w of this.#watched.values()) w.abort.abort();
    this.#watched.clear();
  }
}
