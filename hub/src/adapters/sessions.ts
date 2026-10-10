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
import { readFile, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { nameRefusal, ROLE_NAMES, withRole } from '../names.ts';
import { UNKNOWN_SESSION, type HubCore } from '../hub/core.ts';
import type { HarnessProcessView, Message, SessionState } from '../protocol.ts';
import type { LogFn } from '../log.ts';
import { InjectUncertain, type AdapterHost, type Capabilities, type HarnessAdapter, type HarnessProcess, type InjectFrame, type LaunchPolicy, type ResumeResult, type StateSignal } from './contract.ts';
import { ProcessTable, processStarted, type PendingStop } from './processes.ts';
import type { Resumed } from '../hub/worktrees.ts';
import { clauseText } from '../roles/clause.ts';
import { systemProcesses } from '../system-processes.ts';

/** A signal posted from inside a session (`cland hook <event>`). */
export type SignalFrame = { session?: string; sessionId?: string; launch?: string; event: string; at?: number; payload?: Record<string, unknown> };

/** `item`: the item whose task worktree `cwd` is (set by `TaskWorktrees.launch`, `src/hub/worktrees.ts`). */
export type LaunchRequest = { name: string; role?: string | null; model?: string | null; harness?: string; cwd?: string; effort?: string | null; item?: string | null; brief?: string };

/** A launch directory refused before the harness is spawned; its admission reservation is rolled back. */
export class InvalidLaunchCwd extends Error {}

type LaunchOwnership = { name: string; prior: string | null; existingIds: Set<string>; sessionIds: Set<string>; anonymousSessionId: string | null; returnedId: string | null };

function launchIdentityRefusal(launch: LaunchOwnership, id: string): string | null {
  if (id === UNKNOWN_SESSION) return `launch "${launch.name}" must prove a stable session identity, not unknown`;
  return launch.existingIds.has(id) ? `launch "${launch.name}" cannot prove pre-existing session identity (${id}); use the launch's new identity` : null;
}

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
  readonly #firstHello = new Map<string, { role: string | null; carried: boolean; acceptedId: string | null }>();
  /** Credential-keyed provenance retains every proven early/returned identity until settlement. */
  readonly #launchIdentities = new Map<string, LaunchOwnership>();
  readonly #unhello: () => void;
  /** While the hub vacates a dead session's role: the process table keeps the role a relaunch takes back. */
  #vacating = false;
  readonly #usageTimers = new Map<string, ReturnType<typeof setTimeout>>();
  readonly #unprocess: () => void;
  #closed = false;
  #resuming = 0;
  readonly #pendingStops = new Map<string, PendingStop>();
  readonly #stoppingLaunches = new Set<string>();
  #stopRetry: ReturnType<typeof setInterval> | null = null;
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
  lifecyclePending(): boolean { return this.#launching.size > 0 || this.#resuming > 0 || this.#lifecycle.size > 0 || this.#pendingStops.size > 0; }

  constructor(options: SessionsOptions) {
    this.#core = options.core;
    this.#table = options.table;
    this.#root = options.root;
    this.#log = options.log ?? (() => {});
    this.#pushTrustMs = options.pushTrustMs ?? 15_000;
    // Recovery must select the persisted recipient's delivery mode before recording its final event.
    this.#core.eventSteering(id => { const p = this.#table.bySessionId(id); return p?.harness === 'codex' || p?.harness === 'opencode'; });
    for (const entry of this.#table.pendingStops()) this.#pendingStops.set(entry.process.sessionId, entry);
    this.#core.launchIdentity((credential, id) => {
      const pending = [...this.#pendingStops.values()].find(entry => entry.ownership?.credential === credential);
      if (pending?.ownership) {
        // Once cleanup begins, only receipt-committed identities may receive a grant,
        // including while the original spawn call is still awaiting its stop.
        const proven = pending.ownership.sessionIds;
        const candidate = proven.includes(id) ? id : pending.ownership.anonymousSessionId ?? pending.process.sessionId;
        if (candidate === UNKNOWN_SESSION || !proven.includes(candidate)) return { refusal: `pending launch "${pending.process.name}" has no proven stable session identity; cleanup is pending` };
        return { name: pending.process.name, sessionId: candidate, prove: () => {} };
      }
      const launch = this.#launchIdentities.get(credential);
      if (launch) {
        const proven = id === UNKNOWN_SESSION ? launch.anonymousSessionId ?? launch.returnedId ?? randomUUID() : id;
        const refusal = launchIdentityRefusal(launch, proven);
        if (refusal) return { refusal };
        return { name: launch.name, sessionId: proven, prove: () => {
          if (id === UNKNOWN_SESSION) launch.anonymousSessionId ??= proven;
          launch.sessionIds.add(proven);
        } };
      }
      const accepted = this.#firstHello.get(credential)?.acceptedId;
      const name = accepted ? this.#core.store.nameOfSession(accepted) : null;
      if (accepted && name) return { name, sessionId: accepted, prove: () => {} };
      return null;
    });
    this.#unhello = this.#core.onSessionHello((_name, _id, credential) => {
      if (!credential) return;
      this.#firstHello.delete(credential);
    });
    this.#core.pendingLaunch(id => {
      return [...this.#pendingStops.values()].find(entry => (!entry.ownership && entry.process.sessionId === id) || entry.ownership?.sessionIds.includes(id) || (entry.priorSessionId ?? entry.rollback?.previousSessionId) === id)?.process.name
        ?? [...this.#launchIdentities.values()].find(identity => identity.prior === id || identity.sessionIds.has(id))?.name
        ?? null;
    });
    this.#unprocess = this.#table.subscribe((p) => {
      // Quarantined status is not a verified exit. Metadata changes must leave the
      // final fact to cleanup, which publishes it only after the original process is gone.
      if (!this.#pendingStops.has(p.sessionId)) {
        if (p.status !== 'running') for (const [credential, first] of this.#firstHello) if (first.acceptedId === p.sessionId) this.#firstHello.delete(credential);
        this.#core.publishProcess(this.view(p));
      }
    });
    this.#core.onDelivered((messageId, _name, sessionId) => this.#inject(sessionId, messageId));
    // a session's hello gets the role it was launched for (spec 4.4): a requested role alone is not enough
    this.#core.launchedRole((_name, sessionId, token) => {
      // the launch's first hello, taken once: a reconnect gets the clause again, injected
      const first = token ? this.#firstHello.get(token) : undefined;
      if (first && token && first.acceptedId === null) {
        return { role: first.role, first: true, carried: first.carried };
      }
      const row = sessionId !== UNKNOWN_SESSION ? this.#table.bySessionId(sessionId) : null;
      // Acceptance retires the first grant. A late hello uses the current row/held role;
      // only its unchanged first-turn clause may still need a carried notice.
      return row ? { role: row.role, first: false, carried: first?.acceptedId === sessionId && first.role === row.role && first.carried } : null;
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
    // An active snapshot emits nothing; terminal recovery waits for the fully configured startup sequence.
    for (const p of this.#table.running()) if (!this.#pendingStops.has(p.sessionId)) this.#core.rememberProcess(this.view(p));
  }

  readonly #unsubscribe: () => void;
  readonly #unrename: () => void;

  /** The process-table row of the session that holds `name` now: by its session id (live, else as the store remembers it). */
  #rowOfName(name: string): HarnessProcess | null {
    const id = this.#core.presence().find((p) => p.name === name)?.sessionId ?? this.#core.store.sessionIdOf(name);
    return id && id !== UNKNOWN_SESSION ? this.#table.bySessionId(id) : null;
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
    for (const entry of this.#pendingStops.values()) if (entry.process.harness === adapter.harness && !entry.stages.stopped && !entry.stopIntent) {
      try { adapter.watch(entry.process); }
      catch (error) { this.#log({ event: 'launch-recovery-pending', session: entry.process.name, sessionId: entry.process.sessionId, error: String(error) }); }
    }
    this.#retryStops();
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
      holds: this.#core.sessionHolds(p),
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
    return this.#table.all().filter(p => !this.#pendingStops.has(p.sessionId)).map((p) => this.view(p));
  }

  /** Durable failed launches remain supervised pending stop, apart from accepted process rows. */
  pendingStops(): Array<{ process: HarnessProcess; state: 'pending stop'; error: string }> {
    return [...this.#pendingStops.values()].map(({ process, error }) => ({ process, error, state: 'pending stop' }));
  }

  #retryStops(): void {
    if (this.#stopRetry || !this.#pendingStops.size || this.#closed) return;
    this.#stopRetry = setInterval(() => {
      for (const entry of this.#pendingStops.values()) void this.#stopFailedLaunch(entry).catch(() => {});
    }, 5000);
    this.#stopRetry.unref();
  }

  #settleFailedLaunch(entry: PendingStop): void {
    const { process, rollback } = entry;
    const proven = entry.ownership ? entry.ownership.sessionIds : [process.sessionId];
    const rollbackIds = proven.length ? proven : [null];
    const checkpoint = (id: string | null) => id === null || id === process.sessionId ? process.sessionId : `${process.sessionId}:${id}`;
    // A failed persistence attempt must not erase ownership after stop succeeds. Retry the whole
    // transition and row removal before releasing the role and clearing the recovery receipt.
    this.#table.pendingStop(entry);
    this.adapter(process.harness).unwatch?.(process.sessionId);
    if (!entry.stages.rowRemoved) {
      // A published launch has a terminal transition even when later setup fails. The
      // core commits its final fan-out, subscription closure and checkpoint together.
      if (entry.published) {
        const row = this.#table.bySessionId(process.sessionId);
        this.#core.publishProcess(this.view(row?.sessionId === process.sessionId ? row : process));
      }
      this.#table.removePendingRow(entry);
    }
    if (!entry.stages.roleRolledBack) {
      if (rollback) for (const id of rollbackIds) this.#core.releaseLaunchRole(process.name, rollback.role, rollback.previous, 'launch-failed', id, rollback.previousSessionId, checkpoint(id));
      entry.stages.roleRolledBack = true;
      this.#table.pendingStop(entry);
    }
    // Brief settlement belongs to this receipt's launch credential. A failure here keeps the stopped
    // process's receipt for retry; it never bypasses the owned-process stop above.
    if (entry.ownership) this.#core.cancelLaunchBrief(entry.ownership.credential);
    this.#table.clearPendingStop(process.sessionId);
    for (const id of rollbackIds) this.#core.store.clearMeta(`launch-role-rollback:${checkpoint(id)}`);
    this.#pendingStops.delete(process.sessionId);
    this.#core.publishCleanup(process.sessionId, false);
    if (!this.#pendingStops.size && this.#stopRetry) { clearInterval(this.#stopRetry); this.#stopRetry = null; }
  }

  async #stopFailedLaunch(entry: PendingStop, resumed: Resumed = untimed): Promise<void> {
    const p = entry.process;
    if (this.#stoppingLaunches.has(p.sessionId) || this.#closed) return;
    this.#stoppingLaunches.add(p.sessionId);
    try {
      let preparationError: unknown;
      resumed(() => {
        // One failed persistence/watch operation must not skip the ownership-verified stop attempt.
        try { this.#table.pendingStop(entry); } catch (error) { preparationError = error; }
        if (!entry.stages.stopped && !entry.stopIntent) try { this.adapter(p.harness).watch(p); } catch (error) { preparationError ??= error; }
        try { this.#core.publishCleanup(p.sessionId, true); } catch (error) { preparationError ??= error; }
      });
      try {
        if (!entry.stages.stopped) {
          const recovering = entry.stopIntent === true;
          resumed(() => { entry.stopIntent = true; this.#table.pendingStop(entry); });
          let gone = false;
          if (recovering) {
            const rows = await systemProcesses(resumed);
            gone = resumed(() => {
              if (p.pid === null) throw new Error('failed launch process identity is unknown; cleanup remains pending');
              const current = rows.find(row => row.pid === p.pid);
              if (!current) return true;
              if (!p.pidStarted) throw new Error('failed launch start identity is unknown; cleanup remains pending');
              return current.started !== p.pidStarted;
            });
          }
          if (!gone) {
            if (recovering) resumed(() => {
              try { this.adapter(p.harness).watch(p); } catch (error) { preparationError ??= error; }
            });
            await resumed(() => this.adapter(p.harness).stop(p, resumed));
          } else resumed(() => this.adapter(p.harness).unwatch?.(p.sessionId));
          resumed(() => { entry.stages.stopped = true; this.#table.pendingStop(entry); });
        }
      }
      catch (error) {
        if (preparationError) throw new Error(`${String(error)}; recovery preparation failed: ${String(preparationError)}`);
        throw error;
      }
      resumed(() => this.#settleFailedLaunch(entry));
    } finally { resumed(() => this.#stoppingLaunches.delete(p.sessionId)); }
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
    const role = request.role ?? this.#core.store.roleOf(request.name);
    const effectiveRequest = { ...request, role };
    if (role !== null && !ROLE_NAMES.includes(role)) throw new Error(`unknown role "${role}" (roles: ${ROLE_NAMES.join(', ')})`);
    const existing = this.#table.get(request.name);
    if (existing?.status === 'running') throw new Error(`session "${request.name}" is already running (${existing.harness}, pid ${existing.pid ?? '?'}); stop it first`);
    const reserved = this.#core.nameReservation(request.name);
    if (reserved) throw new Error(reserved);
    if ([...this.#pendingStops.values()].some(entry => entry.process.name === request.name)) throw new Error(`failed launch of "${request.name}" is still supervised; cleanup is pending`);
    if (this.#launching.has(request.name)) throw new Error(`session "${request.name}" is being launched`);
    const existingIds = this.#core.sessionIds();
    for (const process of this.#table.all()) existingIds.add(process.sessionId);
    for (const entry of this.#pendingStops.values()) {
      existingIds.add(entry.process.sessionId);
      for (const id of entry.ownership?.sessionIds ?? []) existingIds.add(id);
    }
    existingIds.delete(UNKNOWN_SESSION);
    // Ticket every named role before I/O: even a nonexclusive cached definition may become exclusive at fresh.
    const admission = role !== null ? this.#core.admitRole(request.name, role) : null;
    const slot = this.#lifecycleSlot(existing?.sessionId ?? `new:${request.name}`);
    let reservation: { previous: string | null; previousSessionId: string | null } | null = null;
    const launching: SignalFrame[] = [];
    this.#launching.set(request.name, launching);
    const priorIdentity = existing?.sessionId ?? this.#core.store.sessionIdOf(request.name);
    const launchToken = randomUUID();
    const identity: LaunchOwnership = { name: request.name, prior: priorIdentity === UNKNOWN_SESSION ? null : priorIdentity, existingIds, sessionIds: new Set(), anonymousSessionId: null, returnedId: null };
    this.#launchIdentities.set(launchToken, identity);
    const abort = () => {
      if (this.#launching.get(request.name) !== launching) return;
      this.#launching.delete(request.name);
      this.#earlyBridges.delete(request.name);
      this.#firstHello.delete(launchToken);
      this.#launchIdentities.delete(launchToken);
      if (role !== null && reservation) this.#core.releaseLaunchRole(request.name, role, reservation.previous, 'launch-failed', null, reservation.previousSessionId);
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
      const brief = request.brief === undefined ? undefined : await this.#resolveBrief(request.name, request.brief, resumed, authorize);
      return await resumed(() => {
        // Re-read the grant and exclusivity after stat, with refusal and rollback in this same timed stretch.
        try {
          authorize();
          admission?.validate();
          if (request.role == null && this.#core.store.roleOf(request.name) !== role) throw new Error(`session "${request.name}" changed role while launching; retry the launch`);
          const reserved = this.#core.nameReservation(request.name);
          if (reserved) throw new Error(reserved);
          if (!info?.isDirectory()) throw new InvalidLaunchCwd(`launch cwd "${cwd}" is not an accessible directory`);
          reservation = role !== null && this.#core.roles ? this.#core.reserveLaunchRole(request.name, role) : null;
          if (process.env.CLAND_TEST_CRASH_AT === 'launch-reserved') process.kill(process.pid, 'SIGKILL');
          return this.#spawnLaunch(effectiveRequest, cwd, resumed, reservation, () => admission?.release(), launchToken, identity, brief);
        } catch (err) { abort(); throw err; }
      });
    } catch (err) {
      // Await failures (fresh I/O or spawn preparation) resume here; synchronous refusals already rolled back.
      if (this.#launching.get(request.name) !== launching) throw err;
      return resumed(() => { abort(); throw err; });
    } finally { resumed(() => slot.release()); }
  }

  async #resolveBrief(name: string, source: string, resumed: Resumed, authorize: () => void): Promise<Message> {
    let text = source;
    if (/^A-\d+$/.test(source)) {
      const artifact = resumed(() => {
        authorize();
        const artifact = this.#core.store.artifact(source);
        if (!artifact || artifact.fileDeleted) throw new Error(`unknown or unavailable brief artifact "${source}"`);
        return artifact;
      });
      let content: string;
      try { content = await readFile(artifact.path, 'utf8'); }
      catch { return resumed(() => { throw new Error(`cannot read brief artifact "${source}"`); }); }
      text = resumed(() => {
        authorize();
        const current = this.#core.store.artifact(source);
        if (!current || current.fileDeleted || current.path !== artifact.path) throw new Error(`brief artifact "${source}" changed while reading`);
        return content;
      });
    }
    return resumed(() => {
      authorize();
      if (!text.trim()) throw new Error('a launch brief must not be empty');
      if (!this.#core.textFits(text)) throw new Error('a launch brief exceeds the message size limit');
      return { id: randomUUID(), from: 'hub', fromKind: 'hub', via: 'hub', to: [name], text, ts: new Date().toISOString(), topic: 'agents', kind: 'report' };
    });
  }

  async #spawnLaunch(request: LaunchRequest, cwd: string, resumed: Resumed, reservation: { previous: string | null; previousSessionId: string | null } | null, releaseAdmission: () => void, launchToken: string, identity: LaunchOwnership, brief?: Message): Promise<HarnessProcessView> {
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
    this.#firstHello.set(launchToken, { role, carried: clause !== null && adapter.clauseAtSpawn === true, acceptedId: null });
    const item = request.item ?? null;
    let owned: HarnessProcess | null = null;
    let conflict = false;
    let accepted = false;
    try {
      if (brief) this.#core.recordLaunchBrief(brief, launchToken, clause !== null && adapter.clauseAtSpawn === true);
      owned = await adapter.spawn({ name: request.name, launchToken, role, model, cwd, ...(effort ? { effort } : {}), ...(clause !== null ? { clause } : {}), ...(brief && clause !== null ? { brief } : {}), ...(item !== null ? { item } : {}), ...policy }, resumed);
      resumed(() => {
        const proven = !launchIdentityRefusal(identity, owned!.sessionId);
        if (proven) identity.sessionIds.add(owned!.sessionId);
        identity.returnedId = owned!.sessionId;
        // Returning from a carried spawn confirms the native first turn, independently of the hello timing.
        if (proven && brief && clause !== null && adapter.clauseAtSpawn === true) this.#core.completeCarriedBrief(launchToken, owned!.sessionId);
      });
      // Retain ownership before the PID probe too: a thrown probe still owes cleanup of this process.
      const pidStarted = owned.pidStarted ?? (owned.pid !== null ? await processStarted(owned.pid, undefined, resumed) : null);
      const p: HarnessProcess = { ...owned, item, pidStarted };
      owned = p;
      return resumed(() => {
        const proofRefusal = launchIdentityRefusal(identity, p.sessionId);
        if (proofRefusal) throw new Error(proofRefusal);
        const refusal = this.#core.nameReservation(request.name, p.sessionId);
        if (refusal) { conflict = true; throw new Error(refusal); }
        this.#core.rememberLaunchIdentity(p.name, p.sessionId, launchToken);
        if (this.#core.roles) p.role = this.#core.store.roleOf(p.name);
        this.#table.put(p);
        adapter.watch(p);
        if (reservation) this.#core.launchSettled(request.name);
        this.#lastAt.delete(p.sessionId);
        this.#lastPush.delete(p.sessionId);
        this.#log({ event: 'session-launched', session: p.name, harness: p.harness, pid: p.pid, harnessId: p.harnessId, sessionId: p.sessionId, harnessSessionId: p.harnessSessionId, model: p.model, effort, role: p.role, cwd: p.cwd, ...(p.item ? { item: p.item } : {}), early: this.#launching.get(p.name)?.length ?? 0 });
        const early = this.#launching.get(request.name) ?? [];
        this.#launching.delete(request.name);
        for (const connect of this.#earlyBridges.get(p.name) ?? []) connect();
        this.#earlyBridges.delete(p.name);
        for (const frame of early) this.signal(frame);
        const view = this.view(this.#table.get(p.name) ?? p);
        const first = this.#firstHello.get(launchToken);
        if (first) {
          // An early credentialed hello consumed the grant (and announced it). Otherwise acceptance
          // retires it here: announce only the unchanged launch role, before a late hello uses the row.
          if (this.#core.roles && first.acceptedId === null && first.role !== null && first.role === p.role) {
            this.#log({ event: 'role-taken-at-launch', session: p.name, sessionId: p.sessionId, role: p.role });
          }
          first.acceptedId = p.sessionId;
        }
        accepted = true;
        return view;
      });
    } catch (cause) {
      let detail = cause instanceof Error ? cause.message : String(cause);
      if (owned) {
        const process: HarnessProcess = { ...owned, item, status: 'stopped' };
        const entry: PendingStop = { process, error: detail, priorSessionId: conflict ? null : identity.prior, ownership: { credential: launchToken, sessionIds: [...identity.sessionIds], anonymousSessionId: identity.anonymousSessionId }, stages: { stopped: false, rowRemoved: false, roleRolledBack: false }, ...(role !== null && reservation ? { rollback: { role, previous: reservation.previous, previousSessionId: conflict ? null : reservation.previousSessionId } } : {}) };
        resumed(() => {
          this.#pendingStops.set(process.sessionId, entry);
          this.#retryStops();
        });
        try { await this.#stopFailedLaunch(entry, resumed); }
        catch (error) { detail += `; spawned process cleanup failed: ${error instanceof Error ? error.message : String(error)}; cleanup is pending and the failed launch remains supervised`; }
      }
      return resumed(() => {
        // Returned processes own their rollback through the durable stage receipt, including failures.
        if (!owned && brief) {
          try { this.#core.cancelLaunchBrief(launchToken); }
          catch (error) { detail += `; brief cleanup failed: ${error instanceof Error ? error.message : String(error)}`; }
        }
        if (role !== null && reservation && !owned) {
          const proven = [...identity.sessionIds];
          for (const id of proven.length ? proven : [null]) this.#core.releaseLaunchRole(request.name, role, reservation.previous, 'launch-failed', id, reservation.previousSessionId);
        }
        if (cause instanceof Error) { cause.message = detail; throw cause; }
        throw new Error(detail);
      });
    } finally {
      resumed(() => {
        this.#earlyBridges.delete(request.name);
        if (!accepted) this.#firstHello.delete(launchToken);
        this.#launching.delete(request.name);
        this.#launchIdentities.delete(launchToken);
        releaseAdmission();
      });
    }
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

  /** After all adapters/callbacks are installed, reconcile terminal rows and interrupted launch reservations. */
  releaseInterruptedLaunches(): void {
    const processes = this.#table.all().filter(p => !this.#pendingStops.has(p.sessionId)).map(p => this.view(p));
    // Recovery must know every lead's durable status before routing any verifier's final event.
    for (const process of processes) this.#core.seedProcess(process);
    // A verified stop is authoritative even while its published row awaits cleanup.
    for (const entry of this.#pendingStops.values()) if (entry.published && entry.stages.stopped) this.#core.seedProcess(this.view({ ...entry.process, status: 'stopped' }));
    for (const process of processes) this.#core.rememberProcess(process);
    this.#core.releaseInterruptedLaunches((name) => this.#table.get(name)?.status === 'running' || [...this.#pendingStops.values()].some(entry => entry.process.name === name));
  }

  /** At the hub's start: every process the table says runs is re-found or marked gone. */
  async resumeAll(): Promise<void> {
    for (const entry of [...this.#pendingStops.values()]) {
      try { await this.#stopFailedLaunch(entry); }
      catch (error) { this.#log({ event: 'launch-recovery-pending', session: entry.process.name, sessionId: entry.process.sessionId, error: String(error) }); }
    }
    for (const p of this.#table.running()) {
      if (this.#pendingStops.has(p.sessionId)) continue;
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
    if (this.#pendingStops.has(sessionId)) {
      const entry = this.#pendingStops.get(sessionId)!;
      entry.stages.stopped = true;
      this.#table.pendingStop(entry);
      this.#settleFailedLaunch(entry);
      return;
    }
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
    const name = this.#core.connectionOf(p.sessionId)?.name ?? p.name;
    this.adapter(p.harness).confirm(p, this.#core.store.deliveryRoot(messageId, name));
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
    const message = this.#core.store.deliveryMessage(messageId, this.#core.connectionOf(sessionId)?.name ?? p.name);
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
    this.#inject(p.sessionId, this.#core.store.deliveryRoot(messageId, name));
    return { retried: true };
  }

  close(): void {
    this.#closed = true;
    if (this.#stopRetry) clearInterval(this.#stopRetry);
    this.#stopRetry = null;
    for (const a of this.#adapters.values()) a.close();
    this.#core.onDelivered(null);
    this.#core.launchedRole(null);
    this.#core.pendingLaunch(null);
    this.#core.launchIdentity(null);
    this.#unhello();
    this.#unsubscribe();
    this.#unprocess();
    for (const timer of this.#usageTimers.values()) clearTimeout(timer);
    this.#usageTimers.clear();
    this.#unrename();
  }
}
