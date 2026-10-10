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
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { nameRefusal, ROLE_NAMES, withRole } from '../names.ts';
import type { HubCore } from '../hub/core.ts';
import type { HarnessProcessView, SessionState } from '../protocol.ts';
import type { LogFn } from '../log.ts';
import { InjectUncertain, type AdapterHost, type Capabilities, type HarnessAdapter, type HarnessProcess, type InjectFrame, type LaunchPolicy, type ResumeResult, type StateSignal } from './contract.ts';
import { ProcessTable, processStarted } from './processes.ts';
import type { Resumed } from '../hub/worktrees.ts';
import { clauseText } from '../roles/clause.ts';

/** A signal posted from inside a session (`cland hook <event>`). */
export type SignalFrame = { session?: string; sessionId?: string; launch?: string; event: string; at?: number; payload?: Record<string, unknown> };

/** `item`: the item whose task worktree `cwd` is (set by `TaskWorktrees.launch`, `src/hub/worktrees.ts`). */
export type LaunchRequest = { name: string; role?: string | null; model?: string | null; harness?: string; cwd?: string; effort?: string | null; item?: string | null };

/** A launch directory refused before the harness is spawned; its admission reservation is rolled back. */
export class InvalidLaunchCwd extends Error {}

export type SessionsOptions = {
  core: HubCore;
  table: ProcessTable;
  root: string;
  log?: LogFn;
  /** How long after a push signal a polled signal is still ignored, ms. */
  pushTrustMs?: number;
};

/** At most one latest usage snapshot per session per second, with a trailing update. */
export const USAGE_EVENT_MS = 1000;

const untimed: Resumed = (work) => work();

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
  readonly #usageTimers = new Map<string, ReturnType<typeof setTimeout>>();
  readonly #unprocess: () => void;
  #closed = false;
  #resuming = 0;
  readonly #lifecycle = new Map<string, Promise<void>>();

  /** Reserve synchronously; queued operations re-read the row by its stable identity after admission. */
  #lifecycleSlot(identity: string): { ready: Promise<void> | undefined; release: () => void } {
    const ready = this.#lifecycle.get(identity);
    let done!: () => void;
    const tail = new Promise<void>(resolve => { done = resolve; });
    this.#lifecycle.set(identity, tail);
    return { ready, release: () => {
      if (this.#lifecycle.get(identity) === tail) this.#lifecycle.delete(identity);
      done();
    } };
  }

  /** The spawn-to-row gap is protected by these reservations, including relaunches. */
  lifecyclePending(): boolean { return this.#launching.size > 0 || this.#resuming > 0 || this.#lifecycle.size > 0; }

  constructor(options: SessionsOptions) {
    this.#core = options.core;
    this.#table = options.table;
    this.#root = options.root;
    this.#log = options.log ?? (() => {});
    this.#pushTrustMs = options.pushTrustMs ?? 15_000;
    this.#unprocess = this.#table.subscribe((p) => this.#core.publishProcess(this.view(p)));
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
      usageChanged: (sessionId) => this.#usageChanged(sessionId),
      signal: (sessionId, signal) => this.#signal(sessionId, signal, false),
      turnFailed: (sessionId, error, messages) => this.#turnFailed(sessionId, error, messages),
      notifyFailureSenders: (sessionId, error, messages) => this.#notifyTurnSenders(sessionId, error, messages),
      exited: (sessionId, detail) => this.#exited(sessionId, detail),
      reconnected: (sessionId) => {
        const p = this.#table.bySessionId(sessionId);
        if (!p || p.status !== 'running') return;
        this.#log({ event: 'adapter-reconnected', session: p.name });
        this.#retry(p);
      },
      recordPid: (sessionId, pid) => {
        const p = this.#table.bySessionId(sessionId);
        if (p) {
          this.#table.update(p.name, { pid, pidStarted: null });
          void processStarted(pid).then(started => {
            if (this.#closed) return;
            const current = this.#table.bySessionId(sessionId);
            if (current?.pid === pid && current.status === 'running') this.#table.update(current.name, { pidStarted: started });
          });
        }
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
    const approvalCommand = p.status === 'running' ? this.#core.sessionApprovalCommand(p.sessionId) : undefined;
    return {
      name: p.name,
      harness: p.harness,
      role: p.role,
      label: withRole(p.name, p.role),
      model: p.model,
      cwd: p.cwd,
      item: p.item ?? null,
      pid: p.pid,
      harnessId: p.harnessId,
      sessionId: p.sessionId,
      harnessSessionId: p.harnessSessionId,
      startedAt: p.startedAt,
      status: p.status,
      state: p.status === 'running' ? this.#core.sessionState(p.sessionId) : 'unknown',
      ...(approvalCommand !== undefined ? { approvalCommand } : {}),
      attach: p.status === 'running' && adapter ? adapter.attachCommand(p) : null,
      ...(usage ? { usage } : {}),
    };
  }

  #usageChanged(sessionId: string): void {
    if (this.#usageTimers.has(sessionId)) return;
    const timer = setTimeout(() => {
      this.#usageTimers.delete(sessionId);
      const p = this.#table.bySessionId(sessionId);
      const usage = p && this.#adapters.get(p.harness)?.usage?.(p);
      if (p && usage) this.#core.publishUsage(p.name, sessionId, usage);
    }, USAGE_EVENT_MS);
    timer.unref();
    this.#usageTimers.set(sessionId, timer);
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

  /** The role's approval and sandbox (roles.toml as it is now), the writable roots resolved against the project
   *  root. They belong to the role, whatever harness the launch chose: an adapter whose harness takes none ignores them. */
  #launchPolicy(role: string | null): LaunchPolicy {
    const defaults = role !== null ? (this.#core.roles?.get().get(role)?.launch ?? null) : null;
    if (defaults === null) return {};
    const sandbox = defaults.sandbox && { ...defaults.sandbox, writableRoots: defaults.sandbox.writableRoots.map((r) => resolve(this.#root, r)) };
    return { ...(defaults.approval ? { approval: defaults.approval } : {}), ...(sandbox ? { sandbox } : {}) };
  }

  async launch(request: LaunchRequest, resumed: Resumed = untimed, authorize: () => void = () => {}): Promise<HarnessProcessView> {
    authorize();
    const refusal = nameRefusal(request.name, new Set(['human']));
    if (refusal) throw new Error(refusal);
    const role = request.role ?? null;
    if (role !== null && !ROLE_NAMES.includes(role)) throw new Error(`unknown role "${role}" (roles: ${ROLE_NAMES.join(', ')})`);
    const existing = this.#table.get(request.name);
    if (existing?.status === 'running') throw new Error(`session "${request.name}" is already running (${existing.harness}, pid ${existing.pid ?? '?'}); stop it first`);
    if (this.#core.presence().some((p) => p.name === request.name)) throw new Error(`name "${request.name}" is in use by a live session`);
    if (this.#launching.has(request.name)) throw new Error(`session "${request.name}" is being launched`);
    // Ticket every named role before I/O: even a nonexclusive cached definition may become exclusive at fresh.
    const admission = role !== null ? this.#core.admitRole(request.name, role) : null;
    const slot = this.#lifecycleSlot(existing?.sessionId ?? `new:${request.name}`);
    let reservation: { previous: string | null } | null = null;
    const launching: SignalFrame[] = [];
    this.#launching.set(request.name, launching);
    const abort = () => {
      if (this.#launching.get(request.name) !== launching) return;
      this.#launching.delete(request.name);
      this.#earlyBridges.delete(request.name);
      this.#firstHello.delete(request.name);
      if (role !== null && reservation) this.#core.releaseLaunchRole(request.name, role, reservation.previous);
      admission?.release();
    };
    try {
      if (slot.ready) await slot.ready;
      if (this.#core.roles?.fresh) await this.#core.roles.fresh(resumed);
      const checking = resumed(() => {
        try {
          if (this.#closed) throw new Error('the hub is closing');
          if (slot.ready) {
            const current = this.#table.get(request.name);
            if (current?.status === 'running' || (existing && current?.sessionId !== existing.sessionId)) throw new Error(`session "${request.name}" changed while waiting for its lifecycle slot`);
          }
          if (this.#core.roles?.fresh) { authorize(); admission?.validate(); }
          const cwd = resolve(this.#root, request.cwd ?? '.');
          return { cwd, info: stat(cwd) };
        } catch (err) { abort(); throw err; }
      });
      const cwd = checking.cwd;
      let info;
      try { info = await checking.info; } catch { info = null; }
      return await resumed(() => {
        // Re-read the grant and exclusivity after stat, with refusal and rollback in this same timed stretch.
        try {
          authorize();
          admission?.validate();
          if (!info?.isDirectory()) throw new InvalidLaunchCwd(`launch cwd "${cwd}" is not an accessible directory`);
          reservation = role !== null && this.#core.roles ? this.#core.reserveLaunchRole(request.name, role) : null;
          if (process.env.CLAND_TEST_CRASH_AT === 'launch-reserved') process.kill(process.pid, 'SIGKILL');
          return this.#spawnLaunch(request, cwd, resumed, reservation, () => admission?.release());
        } catch (err) { abort(); throw err; }
      });
    } catch (err) {
      // Await failures (fresh I/O or spawn preparation) resume here; synchronous refusals already rolled back.
      if (this.#launching.get(request.name) !== launching) throw err;
      return resumed(() => { abort(); throw err; });
    } finally { resumed(() => slot.release()); }
  }

  async #spawnLaunch(request: LaunchRequest, cwd: string, resumed: Resumed, reservation: { previous: string | null } | null, releaseAdmission: () => void): Promise<HarnessProcessView> {
    const role = request.role ?? null;
    // the role's launch defaults (roles.toml, read as it is now): the harness, and the model and effort meant for it
    const defaults = role !== null ? (this.#core.roles?.get().get(role)?.launch ?? null) : null;
    const harness = request.harness ?? defaults?.harness ?? DEFAULT_HARNESS;
    const forHarness = defaults !== null && defaults.harness === harness;
    const model = request.model ?? (forHarness ? defaults.model : null);
    const effort = request.effort ?? (forHarness ? defaults.effort : null);
    const policy = this.#launchPolicy(role);
    const adapter = this.adapter(harness);
    const clause = role !== null && this.#core.roles ? clauseText(request.name, role, this.#core.roles.get().get(role)) : null;
    if (role !== null) this.#firstHello.set(request.name, { role, carried: clause !== null && adapter.clauseAtSpawn === true });
    const item = request.item ?? null;
    let spawned: { process: HarnessProcess } | { error: unknown };
    try {
      const process = await adapter.spawn({ name: request.name, role, model, cwd, ...(effort ? { effort } : {}), ...(clause !== null ? { clause } : {}), ...(item !== null ? { item } : {}), ...policy }, resumed);
      const pidStarted = process.pidStarted ?? (process.pid !== null ? await processStarted(process.pid, undefined, resumed) : null);
      spawned = { process: { ...process, pidStarted } };
    } catch (err) {
      spawned = { error: err };
    }
    // Publication, cleanup, watch and replay form one continuous stretch after spawn settles.
    return resumed(() => {
      let early: SignalFrame[] = [];
      let p: HarnessProcess;
      try {
        if ('error' in spawned) throw spawned.error;
        const process = spawned.process;
        p = { ...process, item, pidStarted: process.pidStarted ?? null };
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
        releaseAdmission();
      }
      this.#lastAt.delete(p.sessionId);
      this.#lastPush.delete(p.sessionId);
      adapter.watch(p);
      this.#log({ event: 'session-launched', session: p.name, harness: p.harness, pid: p.pid, harnessId: p.harnessId, sessionId: p.sessionId, harnessSessionId: p.harnessSessionId, model: p.model, effort, role: p.role, cwd: p.cwd, ...(p.item ? { item: p.item } : {}), early: early.length });
      // the bridges first: the early SessionStart's idle retries what the spoke accepted, through them
      for (const connect of this.#earlyBridges.get(p.name) ?? []) connect();
      this.#earlyBridges.delete(p.name);
      for (const frame of early) this.signal(frame);
      return this.view(this.#table.get(p.name) ?? p);
    });
  }

  attachCommand(name: string): string {
    const p = this.#process(name);
    if (p.status !== 'running') throw new Error(`session "${name}" is not running (${p.status})`);
    return this.adapter(p.harness).attachCommand(p);
  }

  async stop(name: string, resumed: Resumed = untimed, authorize: () => void = () => {}): Promise<HarnessProcessView> {
    authorize();
    const identity = this.#process(name).sessionId;
    const slot = this.#lifecycleSlot(identity);
    let released = false;
    let p: HarnessProcess;
    try {
      if (slot.ready) await slot.ready;
      await resumed(() => {
        authorize();
        const current = this.#table.bySessionId(identity);
        if (!current) throw new Error(`session "${name}" was replaced while waiting for its lifecycle slot`);
        p = current;
        return this.adapter(p.harness).stop(p, resumed);
      });
      return resumed(() => {
        try {
          const current = this.#table.bySessionId(p.sessionId) ?? p;
          this.#table.update(current.name, { status: 'stopped' });
          if (process.env.CLAND_TEST_CRASH_AT === 'stop-recorded') process.kill(process.pid, 'SIGKILL');
          this.#core.setSessionState(p.sessionId, current.name, 'unknown', 'stopped');
          this.#log({ event: 'session-stopped', session: current.name, harness: p.harness });
          this.#vacate(current, 'its session was stopped');
          return this.view(this.#process(current.name));
        } finally { released = true; slot.release(); }
      });
    } finally { if (!released) resumed(() => slot.release()); }
  }

  /** Re-find one session (or relaunch it); a session that cannot be re-found is `unknown` and journalled. */
  async resume(name: string, relaunch = false, resumed: Resumed = untimed, authorize: () => void = () => {}): Promise<{ found: boolean; reason?: string; process: HarnessProcessView }> {
    authorize();
    const identity = this.#process(name).sessionId;
    const slot = this.#lifecycleSlot(identity);
    this.#resuming++;
    try {
      if (slot.ready) await slot.ready;
      if (relaunch && this.#core.roles?.fresh) await this.#core.roles.fresh(resumed);
      return await resumed(() => {
        if (this.#closed) throw new Error('the hub is closing');
        authorize();
        const current = this.#table.bySessionId(identity);
        if (!current) throw new Error(`session "${name}" was replaced while waiting for its lifecycle slot`);
        return this.#resume(current.name, relaunch, resumed);
      });
    } finally { resumed(() => { this.#resuming--; slot.release(); }); }
  }

  async #resume(name: string, relaunch: boolean, resumed: Resumed): Promise<{ found: boolean; reason?: string; process: HarnessProcessView }> {
    let p = this.#process(name);
    const adapter = this.adapter(p.harness);
    // a relaunch is a new harness process on the same conversation, whatever became of the old one: one that
    // still runs is stopped first (its row keeps the role: this is not the session's end, so nothing is vacated)
    // the row as it is now, by the session's id: while the adapter works the session may rename itself (the
    // Coordinator does), and its row then stands under the new name
    const row = (): HarnessProcess => this.#table.bySessionId(p.sessionId) ?? p;
    let resuming: Promise<ResumeResult>;
    if (relaunch && p.status === 'running') {
      await adapter.stop(p, resumed);
      resuming = resumed(() => {
        this.#table.update(row().name, { status: 'stopped' });
        this.#log({ event: 'session-stopped', session: row().name, harness: p.harness, relaunching: true });
        p = row();
        // The adapter's synchronous prefix belongs to this stretch, up to its next await.
        return adapter.resume(p, { relaunch, resumed, policy: this.#launchPolicy(p.role) });
      });
    } else {
      resuming = adapter.resume(p, { relaunch, resumed, policy: this.#launchPolicy(p.role) });
    }
    const r = await resuming;
    const publish = (found: Extract<ResumeResult, { found: true }>, pidStarted: string | null) => {
      // Re-read after any identity probe: a rename, item or role change made while awaiting stays in place.
      const current = row();
      const process: HarnessProcess = { ...found.process, name: current.name, role: current.role, item: current.item ?? null, pidStarted };
      this.#table.put(process);
      adapter.watch(process);
      this.#core.publishProcess(this.view(process));
      this.#log({ event: 'session-resumed', session: process.name, harness: p.harness, pid: found.process.pid, state: found.state, relaunched: relaunch && p.status !== 'running' });
      if (found.state !== 'unknown') this.#signal(p.sessionId, { state: found.state, source: 'resume', at: Date.now() }, false);
      return { found: true, process: this.view(process) };
    };
    const settled = resumed(() => {
      if (!r.found) {
        if (p.status === 'running') this.#exited(p.sessionId, r.reason);
        return { answer: { found: false, reason: r.reason, process: this.view(row()) } };
      }
      const current = row();
      const cached = r.process.pid === current.pid ? current.pidStarted : null;
      // Cached identities publish in this same stretch; only an actual OS probe introduces another await.
      if (cached != null || r.process.pid === null) return { answer: publish(r, cached ?? null) };
      return { identity: processStarted(r.process.pid, undefined, resumed), resumed: r };
    });
    if ('answer' in settled) return settled.answer!;
    const pidStarted = await settled.identity;
    return resumed(() => publish(settled.resumed, pidStarted));
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
    // the harness tried to make a worktree of its own and was refused (`cland hook worktree-create`): a record, no state
    if (frame.event === 'worktree-refused') {
      this.#log({ event: 'worktree-refused', session: p.name, worktree: typeof payload.worktree === 'string' ? payload.worktree : null, requested: typeof payload.name === 'string' ? payload.name : null, ...(p.item ? { item: p.item } : {}) });
      return { applied: true };
    }
    if (frame.event === 'injected') {
      const id = typeof payload.message === 'string' ? payload.message : null;
      if (id) this.#confirm(p, id);
      return { applied: true };
    }
    // the harness's own conversation id, as its hooks carry it (a `/clear` starts a new one)
    const harnessSessionId = typeof payload.session_id === 'string' ? payload.session_id : null;
    if (harnessSessionId && harnessSessionId !== (p.harnessSessionId ?? p.sessionId)) this.#table.update(p.name, { harnessSessionId });
    const meaning = adapter.interpret(frame.event, payload, p);
    for (const id of meaning.confirms ?? []) this.#confirm(p, id);
    if (meaning.model && meaning.model !== p.model) this.#table.update(p.name, { model: meaning.model });
    if (meaning.usage) {
      adapter.noteUsage?.(p, meaning.usage);
      this.#usageChanged(p.sessionId);
    }
    if (meaning.turnError) {
      const error = meaning.turnError;
      this.#turnFailed(p.sessionId, error, []);
      // A failure may beat its input's confirmation. The adapter reconciles them by harness identity.
      if (meaning.failureMessages) void meaning.failureMessages.then((messages) => this.#notifyTurnSenders(p.sessionId, error, messages));
    }
    if (!meaning.state) return { applied: false };
    const applied = this.#signal(p.sessionId, { state: meaning.state, source: frame.event.startsWith('mod-') ? 'mod' : 'hook', at: frame.at ?? Date.now(), ...(meaning.approvalCommand !== undefined ? { approvalCommand: meaning.approvalCommand } : {}) }, true);
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
    const changed = this.#core.setSessionState(sessionId, name, signal.state, signal.source, signal.approvalCommand);
    // the next idle — a transition, not every poll that finds it idle — retries what was never confirmed
    if (signal.state === 'idle' && changed) this.#retry(p, signal.at);
    return changed;
  }

  #turnFailed(sessionId: string, error: string, messages: string[]): void {
    const p = this.#table.bySessionId(sessionId);
    if (!p || p.status !== 'running') return;
    const text = `${this.#core.label(p.name)}: its turn failed: ${error}`;
    // The lifecycle log feeds Agents through its journalled notice path; that notice also feeds the inbox.
    this.#log({ event: 'turn-failed', session: p.name, harness: p.harness, error, text, messages });
    this.#notifyTurnSenders(sessionId, error, messages);
  }

  #notifyTurnSenders(sessionId: string, error: string, messages: string[]): void {
    const p = this.#table.bySessionId(sessionId);
    if (!p || p.status !== 'running') return;
    const text = `${this.#core.label(p.name)}: its turn failed: ${error}`;
    const senders = new Set<string>();
    for (const id of messages) {
      const message = this.#core.store.message(id);
      if (message?.fromKind === 'agent') senders.add(message.from);
    }
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
    this.#closed = true;
    for (const a of this.#adapters.values()) a.close();
    this.#core.onDelivered(null);
    this.#core.launchedRole(null);
    this.#unsubscribe();
    this.#unprocess();
    for (const timer of this.#usageTimers.values()) clearTimeout(timer);
    this.#usageTimers.clear();
    this.#unrename();
  }
}
