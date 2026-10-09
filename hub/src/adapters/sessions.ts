// The hub's side of the adapters: launching sessions, the process table, each session's state, and the
// delivery pipeline's last stage. Transport-free; `./requests.ts` puts frames on it.
//
//   delivered → inject: when a session's spoke accepts a message (stage `delivered`), the session's adapter
//   injects it; the adapter's confirmation moves it to `injected`. An unconfirmed inject stays `delivered`, is
//   logged, and is retried at the session's next `idle` (and when its in-session bridge connects).
//
//   state: signals from inside the session (`session.signal`, sent by `cland hook`) and the adapter's own poll.
//   A signal older than the last one applied is dropped; a polled one counts only while no push signal came
//   for a while (or nothing is known yet). The model's `status` tool never reaches here.
//
//   launch: a signal or a bridge names the launch it comes from (the cland session id the hooks and the mod
//   were started with). One from an earlier launch under the same name is ignored: it never touches the row
//   of the process that replaced it. A signal never revives a row that is not running (only resume does).
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { nameRefusal, ROLE_NAMES, withRole } from '../names.ts';
import type { HubCore } from '../hub/core.ts';
import type { HarnessProcessView, SessionState } from '../protocol.ts';
import type { LogFn } from '../log.ts';
import { InjectUncertain, type AdapterHost, type Capabilities, type HarnessAdapter, type HarnessProcess, type InjectFrame, type StateSignal } from './contract.ts';
import { ProcessTable, processStarted } from './processes.ts';
import { clauseText } from '../roles/clause.ts';

/** A signal posted from inside a session (`cland hook <event>`). */
export type SignalFrame = { session?: string; sessionId?: string; launch?: string; event: string; at?: number; payload?: Record<string, unknown> };

export type LaunchRequest = { name: string; role?: string | null; model?: string | null; harness?: string; cwd?: string; effort?: string | null };

/** A launch directory refused before the role is reserved or the harness is spawned. */
export class InvalidLaunchCwd extends Error {}

export type SessionsOptions = {
  core: HubCore;
  table: ProcessTable;
  root: string;
  log?: LogFn;
  /** How long after a push signal a polled signal is still ignored, ms. */
  pushTrustMs?: number;
};

export const DEFAULT_HARNESS = 'claude-code';

export class Sessions {
  readonly #core: HubCore;
  readonly #table: ProcessTable;
  readonly #root: string;
  readonly #log: LogFn;
  readonly #pushTrustMs: number;
  readonly #adapters = new Map<string, HarnessAdapter>();
  /** By session id: when the last applied signal happened, and when the last push signal arrived. */
  readonly #lastAt = new Map<string, number>();
  readonly #lastPush = new Map<string, number>();
  /** Claude's hook/mod turn-start confirmations identify the input even when StopFailure arrives late. */
  readonly #turnMessages = new Map<string, Map<number, string[]>>();
  /** Injects in flight, `<session id>:<message id>`, with when each went out: a retry never doubles one. A
   *  retry asked for while one is in flight — by an idle the harness fired after it went out, or a bridge
   *  that connected — is remembered (`again`) and made when it ends unconfirmed, so no trigger is lost. */
  readonly #inflight = new Map<string, { sentAt: number; again: boolean }>();
  /** Launches in progress by name, with the signals that arrived before the process-table row (the harness's
   *  SessionStart hook can beat the launch's own return): replayed once the row is written. */
  readonly #launching = new Map<string, SignalFrame[]>();
  /** Bridges that connected during their session's launch: registered once the row is written. */
  readonly #earlyBridges = new Map<string, Array<() => void>>();
  /** The role each launch is for, until its session's first hello (which may beat the process-table row), and
   *  whether the launch's first turn carried the clause (Codex). Taken once. */
  readonly #firstHello = new Map<string, { role: string; carried: boolean }>();
  /** While the hub vacates a dead session's role: the process table keeps the role a relaunch takes back. */
  #vacating = false;

  constructor(options: SessionsOptions) {
    this.#core = options.core;
    this.#table = options.table;
    this.#root = options.root;
    this.#log = options.log ?? (() => {});
    this.#pushTrustMs = options.pushTrustMs ?? 15_000;
    this.#core.onDelivered((messageId, _name, sessionId) => this.#inject(sessionId, messageId));
    // a session's hello gets the role it was launched for (spec 4.4): a requested role alone is not enough
    this.#core.launchedRole((name, sessionId) => {
      // the launch's first hello, taken once: a reconnect gets the clause again, injected
      const first = this.#firstHello.get(name);
      if (first) {
        this.#firstHello.delete(name);
        return { role: first.role, first: true, carried: first.carried };
      }
      const row = this.#table.bySessionId(sessionId);
      return row ? { role: row.role, first: false, carried: false } : null;
    });
    // the human's assignment or revocation is what a relaunch starts with: the row is found by the session's id,
    // never by a name (a renamed session's row is renamed with it, and a name may have been reused)
    this.#unsubscribe = this.#core.subscribe((event) => {
      if (event.type !== 'session.role' || this.#vacating) return;
      const row = this.#rowOfName(event.session);
      if (row) this.#table.update(row.name, { role: event.role });
    });
    // a rename moves the session's row to its new name
    this.#unrename = this.#core.onRenamed((from, to, sessionId) => {
      const before = this.#table.bySessionId(sessionId);
      if (!before || !this.#table.rename(sessionId, to)) return;
      this.#log({ event: 'process-renamed', from: before.name, to, sessionId });
      const after = this.#table.get(to);
      try {
        if (after) this.#adapters.get(after.harness)?.renamed?.(after, before.name);
      } catch (err) {
        this.#log({ event: 'process-rename-failed', session: to, error: err instanceof Error ? err.message : String(err) });
      }
    });
  }

  readonly #unsubscribe: () => void;
  readonly #unrename: () => void;

  /** The process-table row of the session that holds `name` now: by its session id (live, else as the store remembers it). */
  #rowOfName(name: string): HarnessProcess | null {
    const id = this.#core.presence().find((p) => p.name === name)?.sessionId ?? this.#core.store.sessionIdOf(name);
    const byId = id ? this.#table.bySessionId(id) : null;
    if (byId) return byId;
    const byName = this.#table.get(name);
    // a row under this name whose session is another one the store knows under another name is not this one's
    return byName && (id === null || byName.sessionId === id) ? byName : null;
  }

  /** The live Coordinator, or null ("no coordinator"). */
  coordinator(): string | null {
    return this.#core.coordinator();
  }

  /** The callbacks an adapter is built with, bound to this hub. */
  host(fields: Pick<AdapterHost, 'discoveryFile' | 'node' | 'cli' | 'spoke'>): AdapterHost {
    return {
      ...fields,
      root: this.#root,
      log: this.#log,
      signal: (sessionId, signal) => this.#signal(sessionId, signal, false),
      turnFailed: (sessionId, error, messages) => this.#turnFailed(sessionId, error, messages),
      exited: (sessionId, detail) => this.#exited(sessionId, detail),
      reconnected: (sessionId) => {
        const p = this.#table.bySessionId(sessionId);
        if (!p || p.status !== 'running') return;
        this.#log({ event: 'adapter-reconnected', session: p.name });
        this.#retry(p);
      },
      recordPid: (sessionId, pid) => {
        const p = this.#table.bySessionId(sessionId);
        if (p) this.#table.update(p.name, { pid, pidStarted: processStarted(pid) });
      },
    };
  }

  register(adapter: HarnessAdapter): void {
    this.#adapters.set(adapter.harness, adapter);
  }

  adapter(harness: string): HarnessAdapter {
    const a = this.#adapters.get(harness);
    if (!a) throw new Error(`no adapter for harness "${harness}" (known: ${[...this.#adapters.keys()].join(', ') || 'none'})`);
    return a;
  }

  // ---------------------------------------------------------------- views

  view(p: HarnessProcess): HarnessProcessView {
    const adapter = this.#adapters.get(p.harness);
    const usage = adapter?.usage?.(p) ?? null;
    return {
      name: p.name,
      harness: p.harness,
      role: p.role,
      label: withRole(p.name, p.role),
      model: p.model,
      cwd: p.cwd,
      pid: p.pid,
      harnessId: p.harnessId,
      sessionId: p.sessionId,
      harnessSessionId: p.harnessSessionId,
      startedAt: p.startedAt,
      status: p.status,
      state: p.status === 'running' ? this.#core.sessionState(p.sessionId) : 'unknown',
      attach: p.status === 'running' && adapter ? adapter.attachCommand(p) : null,
      ...(usage ? { usage } : {}),
    };
  }

  list(): HarnessProcessView[] {
    return this.#table.all().map((p) => this.view(p));
  }

  /** Each adapter's capability table (spec 4.3): what it can do and how far each state signal is trusted. */
  capabilities(): Record<string, Capabilities> {
    return Object.fromEntries([...this.#adapters.values()].map((a) => [a.harness, a.capabilities]));
  }

  #process(name: string): HarnessProcess {
    const p = this.#table.get(name);
    if (!p) throw new Error(`no session "${name}" was launched by this hub`);
    return p;
  }

  // ---------------------------------------------------------------- launch, attach, stop, resume

  async launch(request: LaunchRequest): Promise<HarnessProcessView> {
    const cwd = resolve(this.#root, request.cwd ?? '.');
    const refusal = nameRefusal(request.name, new Set(['human']));
    if (refusal) throw new Error(refusal);
    const role = request.role ?? null;
    if (role !== null && !ROLE_NAMES.includes(role)) throw new Error(`unknown role "${role}" (roles: ${ROLE_NAMES.join(', ')})`);
    // the role's launch defaults (roles.toml, read as it is now): the harness, and the model and effort meant for it
    const defaults = role !== null ? (this.#core.roles?.get().get(role)?.launch ?? null) : null;
    const harness = request.harness ?? defaults?.harness ?? DEFAULT_HARNESS;
    const forHarness = defaults !== null && defaults.harness === harness;
    const model = request.model ?? (forHarness ? defaults.model : null);
    const effort = request.effort ?? (forHarness ? defaults.effort : null);
    const existing = this.#table.get(request.name);
    if (existing?.status === 'running') throw new Error(`session "${request.name}" is already running (${existing.harness}, pid ${existing.pid ?? '?'}); stop it first`);
    if (this.#core.presence().some((p) => p.name === request.name)) throw new Error(`name "${request.name}" is in use by a live session`);
    if (this.#launching.has(request.name)) throw new Error(`session "${request.name}" is being launched`);
    const adapter = this.adapter(harness);
    let directory = false;
    try {
      directory = statSync(cwd).isDirectory();
    } catch {
      // A missing or inaccessible path is a typed launch refusal, independent of the harness.
    }
    if (!directory) throw new InvalidLaunchCwd(`launch cwd "${cwd}" is not an accessible directory`);
    // the role is reserved before anything is spawned: a second launch for an exclusive role is refused right here,
    // and a launch that fails gives back what it reserved (its early hello's grant included)
    const reservation = role !== null && this.#core.roles ? this.#core.reserveLaunchRole(request.name, role) : null;
    // a test's crash between the reservation and the spawn (the next start gives the role back)
    if (process.env.CLAND_TEST_CRASH_AT === 'launch-reserved') process.kill(process.pid, 'SIGKILL');
    this.#launching.set(request.name, []);
    const clause = role !== null && this.#core.roles ? clauseText(request.name, role, this.#core.roles.get().get(role)) : null;
    if (role !== null) this.#firstHello.set(request.name, { role, carried: clause !== null && adapter.clauseAtSpawn === true });
    let early: SignalFrame[] = [];
    let p: HarnessProcess;
    try {
      p = await adapter.spawn({ name: request.name, role, model, cwd, ...(effort ? { effort } : {}), ...(clause !== null ? { clause } : {}) });
      p = { ...p, pidStarted: p.pidStarted ?? (p.pid !== null ? processStarted(p.pid) : null) };
      this.#table.put(p);
      if (reservation) this.#core.launchSettled(request.name);
    } catch (err) {
      this.#earlyBridges.delete(request.name);
      this.#firstHello.delete(request.name);
      if (role !== null && reservation) this.#core.releaseLaunchRole(request.name, role, reservation.previous);
      throw err;
    } finally {
      early = this.#launching.get(request.name) ?? [];
      this.#launching.delete(request.name);
    }
    this.#lastAt.delete(p.sessionId);
    this.#lastPush.delete(p.sessionId);
    adapter.watch(p);
    this.#log({ event: 'session-launched', session: p.name, harness: p.harness, pid: p.pid, harnessId: p.harnessId, sessionId: p.sessionId, harnessSessionId: p.harnessSessionId, model: p.model, effort, role: p.role, early: early.length });
    // the bridges first: the early SessionStart's idle retries what the spoke accepted, through them
    for (const connect of this.#earlyBridges.get(p.name) ?? []) connect();
    this.#earlyBridges.delete(p.name);
    for (const frame of early) this.signal(frame);
    return this.view(this.#table.get(p.name) ?? p);
  }

  attachCommand(name: string): string {
    const p = this.#process(name);
    if (p.status !== 'running') throw new Error(`session "${name}" is not running (${p.status})`);
    return this.adapter(p.harness).attachCommand(p);
  }

  async stop(name: string): Promise<HarnessProcessView> {
    const p = this.#process(name);
    await this.adapter(p.harness).stop(p);
    this.#table.update(name, { status: 'stopped' });
    this.#core.setSessionState(p.sessionId, name, 'unknown', 'stopped');
    this.#log({ event: 'session-stopped', session: name, harness: p.harness });
    this.#vacate(p, 'its session was stopped');
    return this.view(this.#process(name));
  }

  /** Re-find one session (or relaunch it); a session that cannot be re-found is `unknown` and journalled. */
  async resume(name: string, relaunch = false): Promise<{ found: boolean; reason?: string; process: HarnessProcessView }> {
    const p = this.#process(name);
    const adapter = this.adapter(p.harness);
    const r = await adapter.resume(p, { relaunch });
    if (!r.found) {
      if (p.status === 'running') this.#exited(p.sessionId, r.reason);
      return { found: false, reason: r.reason, process: this.view(this.#process(name)) };
    }
    // what the row says now, not the snapshot the resume started from: a role assigned or revoked, or a rename,
    // while the adapter worked stays as it was made
    const current = this.#table.bySessionId(p.sessionId) ?? p;
    const pidStarted = r.process.pid === current.pid ? (current.pidStarted ?? (r.process.pid !== null ? processStarted(r.process.pid) : null)) : r.process.pid !== null ? processStarted(r.process.pid) : null;
    const process: HarnessProcess = { ...r.process, name: current.name, role: current.role, pidStarted };
    this.#table.put(process);
    adapter.watch(process);
    this.#log({ event: 'session-resumed', session: name, harness: p.harness, pid: r.process.pid, state: r.state, relaunched: relaunch && p.status !== 'running' });
    if (r.state !== 'unknown') this.#signal(p.sessionId, { state: r.state, source: 'resume', at: Date.now() }, false);
    return { found: true, process: this.view(process) };
  }

  /** At the hub's start, before any frame is read: the roles reserved by launches the hub died in are given back. */
  releaseInterruptedLaunches(): void {
    this.#core.releaseInterruptedLaunches((name) => this.#table.get(name)?.status === 'running');
  }

  /** At the hub's start: every process the table says runs is re-found or marked gone. */
  async resumeAll(): Promise<void> {
    for (const p of this.#table.running()) {
      try {
        await this.resume(p.name);
      } catch (err) {
        this.#log({ event: 'resume-failed', session: p.name, error: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  // ---------------------------------------------------------------- signals from inside the session

  /** Find the process a hook or the mod speaks for: by its launch (the cland session id; the row may have been
   *  renamed since), else by the cland name it was launched with, else the harness's session id. */
  #signalled(session: string | undefined, sessionId: string | undefined, launch?: string): HarnessProcess | null {
    const byLaunch = launch ? this.#table.bySessionId(launch) : null;
    if (byLaunch && byLaunch.sessionId === launch) return byLaunch;
    const byName = session ? this.#table.get(session) : null;
    if (byName) return byName;
    return sessionId ? this.#table.bySessionId(sessionId) : null;
  }

  /**
   * `cland hook <event>` posted a signal: a state, the model, usage, a confirmed inject. A signal for a session
   * the hub did not launch is logged and ignored (its state stays `unknown`).
   */
  signal(frame: SignalFrame): { applied: boolean; state?: SessionState; buffered?: true } {
    const launching = frame.session !== undefined ? this.#launching.get(frame.session) : undefined;
    if (launching) {
      launching.push(frame);
      return { applied: false, buffered: true };
    }
    const p = this.#signalled(frame.session, frame.sessionId, frame.launch);
    if (!p) {
      this.#log({ event: 'signal-unmatched', session: frame.session ?? null, hookEvent: frame.event });
      return { applied: false };
    }
    if (frame.launch !== undefined && frame.launch !== p.sessionId) {
      this.#log({ event: 'signal-other-launch', session: p.name, hookEvent: frame.event });
      return { applied: false };
    }
    const adapter = this.adapter(p.harness);
    const payload = frame.payload ?? {};
    if (frame.event === 'injected') {
      const id = typeof payload.message === 'string' ? payload.message : null;
      if (id) this.#confirm(p, id);
      return { applied: true };
    }
    // the harness's own conversation id, as its hooks carry it (a `/clear` starts a new one)
    const harnessSessionId = typeof payload.session_id === 'string' ? payload.session_id : null;
    if (harnessSessionId && harnessSessionId !== (p.harnessSessionId ?? p.sessionId)) this.#table.update(p.name, { harnessSessionId });
    const meaning = adapter.interpret(frame.event, payload);
    const at = frame.at ?? Date.now();
    if (frame.event === 'turn-start' || frame.event === 'mod-turn-start') {
      const starts = this.#turnMessages.get(p.sessionId) ?? new Map<number, string[]>();
      starts.set(at, meaning.confirms ?? []);
      this.#turnMessages.set(p.sessionId, starts);
    }
    for (const id of meaning.confirms ?? []) this.#confirm(p, id);
    if (meaning.model && meaning.model !== p.model) this.#table.update(p.name, { model: meaning.model });
    if (meaning.usage) adapter.noteUsage?.(p, meaning.usage);
    if (meaning.turnError) {
      // Async hooks can arrive after later turns; attribute by when they fired, even if idle is stale.
      const starts = [...(this.#turnMessages.get(p.sessionId) ?? [])].filter(([started]) => started <= at).sort(([a], [b]) => b - a);
      this.#turnFailed(p.sessionId, meaning.turnError, starts[0]?.[1] ?? []);
    }
    if (!meaning.state) return { applied: false };
    const applied = this.#signal(p.sessionId, { state: meaning.state, source: frame.event.startsWith('mod-') ? 'mod' : 'hook', at: frame.at ?? Date.now() }, true);
    return { applied, state: this.#core.sessionState(p.sessionId) };
  }

  #signal(sessionId: string, signal: StateSignal, push: boolean): boolean {
    const p = this.#table.bySessionId(sessionId);
    if (!p || p.status !== 'running') return false;
    const now = Date.now();
    const current = this.#core.sessionState(sessionId);
    if (push) {
      if (signal.at < (this.#lastAt.get(sessionId) ?? 0)) {
        this.#log({ event: 'signal-stale', session: p.name, state: signal.state, source: signal.source });
        return false;
      }
      this.#lastPush.set(sessionId, now);
    } else if (current !== 'unknown' && now - (this.#lastPush.get(sessionId) ?? 0) < this.#pushTrustMs) {
      // a push signal is fresher than any poll
      return false;
    }
    // only push signals order each other: a poll reads a snapshot, and a hook that started before it still counts
    if (push) this.#lastAt.set(sessionId, Math.max(signal.at, this.#lastAt.get(sessionId) ?? 0));
    const name = this.#core.connectionOf(sessionId)?.name ?? p.name;
    const changed = this.#core.setSessionState(sessionId, name, signal.state, signal.source);
    // the next idle — a transition, not every poll that finds it idle — retries what was never confirmed
    if (signal.state === 'idle' && changed) this.#retry(p, signal.at);
    return changed;
  }

  #turnFailed(sessionId: string, error: string, messages: string[]): void {
    const p = this.#table.bySessionId(sessionId);
    if (!p || p.status !== 'running') return;
    const text = `${this.#core.label(p.name)}: its turn failed: ${error}`;
    const senders = new Set<string>();
    for (const id of messages) {
      const message = this.#core.store.message(id);
      if (message?.fromKind === 'agent') senders.add(message.from);
    }
    // The lifecycle log feeds Agents through its journalled notice path; that notice also feeds the inbox.
    this.#log({ event: 'turn-failed', session: p.name, harness: p.harness, error, text, messages });
    for (const sender of senders) this.#core.notify(sender, text);
  }

  #exited(sessionId: string, detail: string): void {
    const p = this.#table.bySessionId(sessionId);
    if (!p || p.status !== 'running') return;
    this.#table.update(p.name, { status: 'exited' });
    // journalled (`journal.ts`) and recorded in Agents as a death (`agents-topic.ts`)
    this.#log({ event: 'harness-exited', session: p.name, harness: p.harness, pid: p.pid, detail });
    this.#core.setSessionState(sessionId, p.name, 'unknown', 'process');
    this.#vacate(p, 'its harness exited');
  }

  /** A dead holder leaves its role vacant (spec 4.4); the process table keeps it for a relaunch. */
  #vacate(p: HarnessProcess, reason: string): void {
    this.#turnMessages.delete(p.sessionId);
    this.#vacating = true;
    try {
      this.#core.vacateRole(this.#core.connectionOf(p.sessionId)?.name ?? p.name, reason);
    } finally {
      this.#vacating = false;
    }
  }

  // ---------------------------------------------------------------- the bridge and inject

  /** An in-session bridge (the mod) connected for `session` (from `launch`, when it says); returns its
   *  disconnect. What waited is retried. */
  bridge(session: string, send: (frame: InjectFrame) => boolean, launch?: string): () => void {
    if (this.#launching.has(session)) {
      // the mod can connect before the launch returns: the row it belongs to is not written yet
      let disconnect: (() => void) | null = null;
      let closed = false;
      const connect = () => {
        if (closed) return;
        try {
          disconnect = this.bridge(session, send, launch);
        } catch (err) {
          this.#log({ event: 'bridge-refused', session, error: err instanceof Error ? err.message : String(err) });
        }
      };
      this.#earlyBridges.set(session, [...(this.#earlyBridges.get(session) ?? []), connect]);
      return () => {
        closed = true;
        disconnect?.();
      };
    }
    const byLaunch = launch !== undefined ? this.#table.bySessionId(launch) : null;
    const p = byLaunch && byLaunch.sessionId === launch ? byLaunch : this.#process(session);
    if (launch !== undefined && launch !== p.sessionId) throw new Error(`this bridge belongs to an earlier launch of "${session}"`);
    const adapter = this.adapter(p.harness);
    if (!adapter.bridge) throw new Error(`the ${p.harness} adapter takes no bridge`);
    const disconnect = adapter.bridge(p, send);
    this.#log({ event: 'bridge-connected', session });
    this.#retry(p);
    return () => {
      disconnect();
      this.#log({ event: 'bridge-closed', session });
    };
  }

  #confirm(p: HarnessProcess, messageId: string): void {
    this.adapter(p.harness).confirm(p, messageId);
    const name = this.#core.connectionOf(p.sessionId)?.name ?? p.name;
    this.#core.markInjected(messageId, name);
  }

  /** Everything the session's spoke accepted and its adapter has not confirmed: injected again. */
  #retry(p: HarnessProcess, at?: number): void {
    const name = this.#core.connectionOf(p.sessionId)?.name ?? p.name;
    for (const m of this.#core.store.uninjected(name)) this.#inject(p.sessionId, m.id, at);
  }

  /** `at`: when the idle that asks for this happened; an idle from before an inject in flight went out is no
   *  news to it (that inject already counted on it). */
  #inject(sessionId: string, messageId: string, at?: number): void {
    const p = this.#table.bySessionId(sessionId);
    // a session no adapter launched has nobody to inject: its messages stay `delivered`
    if (!p || p.status !== 'running') return;
    const key = `${sessionId}:${messageId}`;
    const inflight = this.#inflight.get(key);
    if (inflight) {
      if (at === undefined || at > inflight.sentAt) inflight.again = true;
      return;
    }
    const message = this.#core.store.message(messageId);
    if (!message) return;
    const adapter = this.#adapters.get(p.harness);
    if (!adapter) return;
    const flight = { sentAt: Date.now(), again: false };
    this.#inflight.set(key, flight);
    const topic = message.topic !== undefined ? this.#core.topicRef(message.topic) : null;
    adapter
      .inject(p, message, topic)
      .then(() => this.#core.markInjected(messageId, this.#core.connectionOf(sessionId)?.name ?? p.name))
      .catch((err: unknown) => {
        // the request reached the harness and no answer came: never replayed on its own
        if (err instanceof InjectUncertain) this.#core.markUncertain(messageId, this.#core.connectionOf(sessionId)?.name ?? p.name, err.message);
        else this.#log({ event: 'inject-unconfirmed', session: p.name, id: messageId, error: err instanceof Error ? err.message : String(err) });
      })
      .finally(() => {
        this.#inflight.delete(key);
        // a retry was asked for meanwhile (a bridge connected, the session went idle): made now, if the
        // message still waits for this session
        if (!flight.again) return;
        const name = this.#core.connectionOf(sessionId)?.name ?? p.name;
        if (this.#core.store.uninjected(name).some((m) => m.id === messageId)) this.#inject(sessionId, messageId);
      });
  }

  /**
   * The human sends an uncertain delivery again (`session.retry`): the adapter could not tell whether the turn
   * started, so only a person decides to risk it twice.
   */
  retry(session: string, messageId: string): { retried: true } {
    const p = this.#rowOfName(session) ?? this.#process(session);
    if (p.status !== 'running') throw new Error(`session "${session}" is not running (${p.status})`);
    const name = this.#core.connectionOf(p.sessionId)?.name ?? p.name;
    if (!this.#core.retryUncertain(messageId, name)) throw new Error(`no uncertain delivery of message "${messageId}" to "${name}": only a message whose inject got no answer is retried by hand`);
    this.#inject(p.sessionId, messageId);
    return { retried: true };
  }

  close(): void {
    this.#turnMessages.clear();
    for (const a of this.#adapters.values()) a.close();
    this.#core.onDelivered(null);
    this.#core.launchedRole(null);
    this.#unsubscribe();
    this.#unrename();
  }
}
