import { remoteRedactor } from '../remote/redact.ts';
import type { DatabaseSync } from 'node:sqlite';
import { ConfiguredGateway, type MessengerFactory } from '../remote/configuration.ts';
import type { Secrets } from '../remote/secrets.ts';
import { Gateway, type Remote, type RemoteStates } from '../remote/gateway.ts';
import { PollerLease, nativePollerProcesses, type PollerProcesses } from '../remote/poller-lease.ts';
import type { DropletDependencies } from '../executor/droplet/dependencies.ts';
import { createWebEdge, type WebEdge } from './web-edge.ts';
import { realClock, type Clock, type ClockTimer } from './clock.ts';
// The hub as a project's daemon: the project's lock taken first, `.cland/` prepared, the store opened on
// `hub.db`, the WebSocket edge for spokes and the Unix socket edge for the UI bound, and the discovery file
// written last — a client that reads `hub.json` finds a hub that answers. Shutdown runs it backwards: the
// edges close, `hub.json` goes, and the lock is released last, so no successor binds before this hub is gone.
//
// A hub serving a UI over its stdio may run without the listeners (spec 4.2: sandboxed QA runs, where
// binding is forbidden). It still takes the lock — the store is one hub's alone — but writes no `hub.json`
// and plugs in no adapters: nothing could reach it, so it launches nothing.
import { AutostartDeferred, autostartDeferred, clearHubStop, markHubStop, type Starter } from './startup.ts';
import { AccountPoller } from '../accounts/poller.ts';
import { randomUUID, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { access, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { sweepOrphans } from '../orphans.ts';
import { VisibilityPreferenceFile } from './visibility-preferences.ts';
import { Store } from './store.ts';
import { createHubBase, createWebSocketEdge, type HubBase, type WebSocketEdge } from './server.ts';
import { createSocketEdge, type SocketEdge } from './socket.ts';
import { ensureSkeleton, layout, removeDiscovery, writeDiscovery, type Discovery, type Layout } from '../project.ts';
import { acquireLock, HubLocked, type LockProcessTable } from './lock.ts';
import { VERSION } from '../version.ts';
import { AGENTS } from './core.ts';
import { gitIn, type Git } from '../tracker/verdict-git.ts';
import { Tracker } from '../tracker/tracker.ts';
import type { TipSchedule } from '../tracker/freshness.ts';
import type { LogFn } from '../log.ts';
import { projectSessions, type ProjectSessions, type AdapterFactory } from '../adapters/index.ts';
import { CrewFile, crewSummary } from '../crew.ts';
import { RulebookFile } from '../rules/file.ts';
import { ProjectConfiguration } from './configuration.ts';
import { readProjectConfig } from '../init/config.ts';
import { Journal, journalPath, readJournal, eventRow, type JournalOpen, type JournalRecord } from './journal.ts';
import { agentsRecord, replayAgentsRecord } from './agents-topic.ts';
import { idleNotifyMs } from './inbox.ts';
import { RequestGuard } from './budget.ts';
import { jsonLinesLog } from '../log.ts';
import { TestLintWarmer } from '../test-lint-policy.ts';
import { hubPriority } from './priority.ts';
import { maintainProjectGit } from '../git-maintenance.ts';
import { MaintenanceRecoveryRequired, maintenanceRecoveryReporter, readMaintenanceOwner } from '../git-maintenance-owner.ts';
import { withTerritoryLockAsync } from '../territory.ts';

/**
 * Whether the hub binds its listeners (the WebSocket for spokes, the Unix socket for the UI and the CLI):
 * `required` fails the start when either cannot bind; `optional` tries, and when either fails closes both
 * and goes on without them (a stdio hub in a sandbox); `never` binds nothing.
 */
export type ListenMode = 'required' | 'optional' | 'never';

export type Daemon = {
  layout: Layout;
  /** What `hub.json` says; null when the hub has no listeners (and so wrote no `hub.json`). */
  discovery: Discovery | null;
  hub: HubBase;
  /** Production process log: asynchronous file appends; shared by every edge. */
  log: LogFn;
  /** Resolves once the daemon has stopped (by `stop`, or by a client's `hub.stop`). */
  stopped: Promise<void>;
  /** Fatal serving-time storage failure: the CLI must bound cleanup and exit non-zero. */
  storageFailed: Promise<void>;
  /** The CLI must exit rather than await an abandoned native storage operation. */
  readonly storageAbandoned: boolean;
  reload: () => Promise<import('./configuration.ts').ConfigReloadResult>;
  stop: () => Promise<void>;
};

export async function serveProject(root: string, options: { gatewayMessenger?: MessengerFactory; gatewayState?: RemoteStates; gatewayProcesses?: PollerProcesses; gatewayRemotes?: readonly Remote[]; gitMaintenanceRecovery?: (root: string, env: NodeJS.ProcessEnv) => Promise<void>; gitMaintenance?: typeof maintainProjectGit; artifactOpen?: typeof import('node:fs/promises').open; priorityProbe?: () => number; devT3Repository?: import('./dev-t3-probe.ts').ProbeRepository; publishRelease?: import('./dispatch.ts').DispatcherOptions['publishRelease']; batchRepository?: import('./merge-batch-territory.ts').BatchRepository; accountReader?: import('../accounts/poller.ts').AccountReader; lintWarmer?: Pick<TestLintWarmer, 'request' | 'close'>; compatibility?: import('../executor/local.ts').LocalCompatibility; territoryLock?: typeof import('../territory.ts').withTerritoryLockAsync; hasTerritory?: typeof import('../territory.ts').hasTerritory; openDatabase?: (path: string) => DatabaseSync; candidate?: import('./suite-candidate.ts').SuiteCandidate; selectSuite?: import('./dispatch.ts').DispatcherOptions['selectSuite']; durationContext?: import('../suite-duration-budget.ts').DurationBudgetContext | null; git?: Git; readBase?: (tips: ReadonlyMap<string, string>) => Promise<string | null>; processes?: LockProcessTable; droplet?: DropletDependencies; adapters?: AdapterFactory[]; clock?: Clock; log?: LogFn; flushLog?: () => Promise<void>; listen?: ListenMode; scheduleTips?: TipSchedule; journalOpen?: JournalOpen; env?: NodeJS.ProcessEnv; starter?: Starter; autostart?: boolean } = {}): Promise<Daemon> {

  const clock = options.clock ?? realClock;
  const env = options.env ?? process.env;
  const listen = options.listen ?? 'required';
  const l = layout(root);
  mkdirSync(l.dir, { recursive: true });
  // before anything is prepared: a second hub must not even write the secret
  let lock;
  try {
    lock = acquireLock(l.lock, options.processes);
  } catch (err) {
    if (err instanceof HubLocked) {
      throw new Error(`a hub already runs for ${root} (pid ${err.holder.pid} holds ${l.lock}); talk to it over its socket, or stop it first with \`cland hub stop\``);
    }
    throw err;
  }
  let secret: string;
  const remoteOutput = remoteRedactor();
  let resolveRemoteSecrets!: () => Secrets;
  let remoteSecrets: Secrets;
  try {
    // Recheck inside the lock: an automatic start may have begun before the stop marker existed.
    if (options.autostart && autostartDeferred(root)) throw new AutostartDeferred();
    if (!options.autostart) clearHubStop(root);
    // Only serving loads credentials; lightweight project/CLI reads keep their import budget.
    const { resolveSecrets, validateAndRegisterSecrets } = await import('../remote/secrets.ts');
    resolveRemoteSecrets = () => {
      const secrets = resolveSecrets(root, env);
      validateAndRegisterSecrets(secrets, remoteOutput);
      return secrets;
    };
    remoteSecrets = resolveRemoteSecrets();
    secret = ensureSkeleton(l);
  } catch (err) {
    lock.release();
    throw err;
  }
  // the journal (`.cland/journal.jsonl`), appended to across restarts, and the Agents record: both fed by the log
  // closure every part of the hub logs through, so a domain event is journalled and recorded by being logged
  const fatalLog = jsonLinesLog(line => process.stderr.write(line));
  let log: LogFn = options.log ?? fatalLog;
  const requestGuard = new RequestGuard({ log: entry => log(entry) });
  // Node's file-backed stderr writes synchronously. Production request logs go to a separate async queue;
  // stderr is reserved for a failed logging sink, startup diagnostics and other fatal errors.
  const processJournal = options.log ? null : new Journal(l.log, () => clock.now(), { log: fatalLog, guard: requestGuard });
  let starting = true;
  const processLog: LogFn = options.log ?? (entry => {
    // A stdio parent sees startup/listener diagnostics on its stderr pipe, as before.
    // Once serving, ordinary events (including audit/refusal) use the async append sink.
    if (starting || String(entry.event).startsWith('orphan-sweep-') || entry.event === 'orphan-ended' || entry.event === 'orphan-preserved') fatalLog(entry);
    else processJournal!.write(entry as { event: string } & Record<string, unknown>);
  });
  let startupStep: { step: string; started: number } | undefined = { step: 'reading startup journal', started: performance.now() };
  processLog({ event: 'hub-startup-step', step: startupStep.step, pid: process.pid });
  // The lock excludes another writer. New lifecycle notices are held by
  // agentsRecord, and new subagent records are indexed by Journal.write.
  let startupHistory = readJournal(journalPath(l.dir), { startupOnly: true });
  const journal = new Journal(journalPath(l.dir), () => clock.now(), { history: startupHistory, log: processLog, guard: requestGuard, ...(options.journalOpen ? { open: options.journalOpen } : {}) });
  const agents = agentsRecord();
  let hub!: HubBase;
  let gateway: Gateway | ConfiguredGateway | undefined;
  const tapped = agents.tap(journal.tap(processLog));
  log = entry => {
    // Keep the existing start receipts for failed-start diagnostics. A separate
    // completion names all work up to the next step, using real monotonic time
    // even when a fixture injects a scheduling clock.
    if (entry.event === 'hub-startup-step' || entry.event === 'serving') {
      const now = performance.now(), previous = startupStep;
      startupStep = entry.event === 'hub-startup-step' ? { step: String(entry.step), started: now } : undefined;
      if (previous) log({ event: 'hub-startup-step-completed', step: previous.step, durationMs: now - previous.started, pid: process.pid });
    }
    const record: JournalRecord = { ts: clock.now().toISOString(), ...entry, event: String(entry.event), eventsVersion: 1 };
    const row = eventRow(record);
    if (row) {
      const id = randomUUID();
      record.rowId = id;
      row.id = id;
    }
    tapped(record);
    if (row) hub?.core.publishJournalRow(row, record);
  };
  // Always close both sinks, including a failed journal, before releasing the lock.
  const closeLogs = async () => {
    let failure: unknown;
    try { await journal.close(); } catch (err) { failure = err; }
    try { await processJournal?.close(); } catch (err) { failure ??= err; }
    try { await options.flushLog?.(); } catch (err) { failure ??= err; }
    if (failure) throw failure;
  };
  journal.write({ event: 'hub-started', pid: process.pid, version: VERSION, root, starter: options.starter ?? { client: 'other', parentPid: process.ppid, cwd: process.cwd() } });

  const priority = hubPriority(options.priorityProbe);
  if (priority.warning) log({ event: 'hub-priority-warning', nice: priority.nice, ...priority.warning });

  const startedAt = clock.now();
  // the tracker's index lives in the same file, in tables of its own; it is rebuilt from the item files here
  // Tests only: consume a one-shot arm, acknowledge the completed temp write, and await release.
  const gateDir = env.CLAND_TEST_TASK_WRITE_GATE;
  const writeGate = gateDir ? async () => {
    try { await unlink(join(gateDir, 'armed')); }
    catch (err) { if ((err as NodeJS.ErrnoException).code === 'ENOENT') return; throw err; }
    await writeFile(join(gateDir, 'entered'), '');
    for (;;) {
      try { await access(join(gateDir, 'release')); return; }
      catch (err) { if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err; }
      await new Promise<void>(done => setTimeout(done, 10));
    }
  } : undefined;
  // tests only: how often verdict freshness reads the branch tips (the default is TIP_CHECK_MS)
  const tipCheckMs = Number(env.CLAND_TEST_TIP_CHECK_MS ?? 0);
  const storageStallMs = Number(env.CLAND_TEST_TRACKER_STALL_MS ?? 0);
  const storageFatalMs = Number(env.CLAND_TEST_TRACKER_FATAL_MS ?? 0);
  const stopTimeoutMs = Number(env.CLAND_TEST_TRACKER_STOP_MS ?? 0);
  let config: ReturnType<typeof readProjectConfig>;
  try {
    config = readProjectConfig(l.config, root, error => { if (/^verification\.(lifetime|run_timeout|daily_spend_usd)/.test(error)) throw new Error(error); log({ event: 'config-unreadable', file: l.config, error, keeping: 'the defaults' }); }, env);
  } catch (error) { await closeLogs(); lock.release(); throw error; }
  let failStorage!: () => void;
  const storageFailed = new Promise<void>(resolve => { failStorage = resolve; });
  const lintWarmer = options.lintWarmer ?? new TestLintWarmer(root, env, log);
  let devTip: string | null = null;
  const tracker = new Tracker({ onDevTip: head => { devTip = head; if (!starting) lintWarmer.request(head); }, clock, ...(options.openDatabase ? { openDatabase: options.openDatabase } : {}), now: () => clock.now(), env, git: options.git ?? gitIn(root, env), ...(options.readBase ? { readBase: options.readBase } : {}), onStorageFatal: operation => {
    if (starting || stopping) return;
    // Freeze admission and native/index continuations before yielding or announcing the failure.
    void tracker.stop({ stalled: operation });
    failStorage();
    const text = `tracker storage stalled: ${operation.operation} on ${operation.item ?? 'tracker-wide work'}; abandoning storage and exiting with code 1. Restart with \`cland hub start\` and inspect the item files before retrying outstanding writes.`;
    log({ event: 'tracker-storage-fatal', ...operation, text });
    fatalLog({ event: 'tracker-storage-fatal', ...operation, text });
    try {
      hub.core.noticeTo(AGENTS.id, { kind: 'tracker-storage-fatal', text, to: ['all'], detail: operation });
    } finally {
      // Give the notice's socket writes a turn before closing the edges.
      setImmediate(() => { void stop().catch(error => fatalLog({ event: 'stop-failed', error: String(error) })); });
    }
  }, planHistory: startupHistory, ...(config ? { levels: config.tracker.levels, storageFatalMs: config.tracker.fatalStallMs, qaDefault: config.plan.qaDefault, planApproval: config.plan.approval } : {}), ...(storageStallMs > 0 && Number.isFinite(storageStallMs) ? { storageStallMs } : {}), ...(storageFatalMs > 0 && storageFatalMs <= 2147483647 && Number.isFinite(storageFatalMs) ? { storageFatalMs } : {}), ...(stopTimeoutMs > 0 && Number.isFinite(stopTimeoutMs) ? { stopTimeoutMs } : {}), root, db: l.db, log, watchResumed: requestGuard.resumer('tracker.watch'), ...(writeGate ? { writeGate } : {}), ...(tipCheckMs > 0 ? { tipCheckMs } : {}), ...(options.scheduleTips ? { scheduleTips: options.scheduleTips } : {}) });
  // the role definitions: written with the defaults when the project has none, then watched
  const roles = new ProjectConfiguration(l, config, log, env, requestGuard.resumer('config.reload'), next => { hub.dispatcher.configure(next); tracker.configurePlanApproval(next.plan.approval); config = next; }, options.git ? () => options.git!(['log', '-1', '--format=%H', '--', '.cland/config.toml']) : undefined, async next => {
    const secrets = resolveRemoteSecrets();
    if (gateway instanceof ConfiguredGateway) await gateway.update(next, secrets);
    remoteSecrets = secrets;
  });
  // the hygiene thresholds of `.cland/config.toml`; the built-in defaults when it is missing or unreadable
  if (config) log({ event: 'config-loaded', path: l.config, hygiene: config.hygiene });
  const rules = new RulebookFile(l.rules, () => roles.get().keys(), log, requestGuard.resumer('rules.refresh'));
  const crew = new CrewFile(l.crew, log, config => hub?.core.publishCrew(config), tracker, requestGuard.resumer('crew.refresh'), clock);
  let adapters: ProjectSessions | null = null;
  let accountPoller: AccountPoller | null = null;
  let web: WebEdge | null = null;
  let store: Store;
  let ws: WebSocketEdge | null = null;
  let edge: SocketEdge | null = null;
  try {
    log({ event: 'hub-startup-step', step: 'indexing tracker', pid: process.pid });
    // Finish index recovery/migrations before exposing the hub, but do not queue
    // background readiness ahead of that barrier or the status listeners.
    const migrations = tracker.start({ deferReadyChecks: true });
    log({ event: 'hub-startup-step', step: 'settling tracker migrations', pid: process.pid });
    await migrations;
    log({ event: 'hub-startup-step', step: 'loading roles', pid: process.pid });
    await roles.start();
    log({ event: 'hub-startup-step', step: 'loading rules', pid: process.pid });
    await rules.start();
    log({ event: 'hub-startup-step', step: 'loading crew', pid: process.pid });
    await crew.start();
    log({ event: 'hub-startup-step', step: 'restoring recent events', pid: process.pid });
    // The live cache must share the journal's recent groups, including ones beyond the
    // first page. Read the tail before creating the core so startup log producers cannot
    // race restoration; the listeners and adapters start only after this cache is installed.
    const recent: import('../protocol.ts').EventRow[] = [];
    const cutoff = clock.now().getTime() - 60000;
    let before: string | undefined;
    try {
      while (true) {
        const page = await journal.events(before);
        let older = false;
        for (const row of page.rows) {
          if (Date.parse(row.ts) < cutoff) { older = true; break; }
          recent.push(row);
        }
        if (older || !page.more || page.before === null) break;
        before = page.before;
      }
    } catch (err) {
      // History restoration is optional. Journal retains its own error, so stop
      // still rejects and releases the project lock through the normal cleanup.
      log({ event: 'events-restore-failed', error: err instanceof Error ? err.message : String(err) });
    }
    log({ event: 'hub-startup-step', step: 'restoring hub state', pid: process.pid });
    store = new Store(l.db, options.openDatabase);
    log({ event: 'hub-startup-step', step: 'restoring core and suites', pid: process.pid });
    log({ event: 'hub-startup-storage', suiteJobsBytes: Buffer.byteLength(store.meta('suite-jobs') ?? '[]', 'utf8'), pid: process.pid });
    hub = createHubBase({
      deferExecutorRecovery: true,
      clock,
      secret,
      env,
      rules,
      journal,
      projectConfig: roles.config,
      ...(options.publishRelease ? { publishRelease: options.publishRelease } : {}),
      ...(options.hasTerritory ? { hasTerritory: options.hasTerritory } : {}),
      ...(options.devT3Repository ? { devT3Repository: options.devT3Repository } : {}),
      ...(options.batchRepository ? { batchRepository: options.batchRepository } : {}),
      ...(options.territoryLock ? { territoryLock: options.territoryLock } : {}),
      ...(options.git ? { git: options.git } : {}),
      ...(options.droplet ? { droplet: options.droplet } : {}),
      ...(options.selectSuite ? { selectSuite: options.selectSuite } : {}),
      verification: { ...(options.compatibility ? { compatibility: options.compatibility } : {}), ...(options.candidate ? { candidate: options.candidate } : {}), ...(options.durationContext !== undefined ? { durationContext: options.durationContext } : {}), executor: config?.verification.executor ?? 'local', localFallback: config?.verification.localFallback ?? true, lifetimeMs: config?.verification.lifetimeMs ?? 6600000, runTimeoutMs: config?.verification.runTimeoutMs ?? 4500000, runTimeout: config?.verification.runTimeout ?? '75m', cacheMaxAgeMs: config?.verification.cacheMaxAgeMs ?? 86400000, waitP90TargetMs: config?.verification.waitP90TargetMs ?? 1200000, budget: config?.verification.budget ?? 1, remoteBudget: config?.verification.remoteBudget ?? 4, shards: config?.verification.shards ?? 2, locks: [config?.verification.lockPath ?? '/tmp/cland-suite.lock', config?.verification.lockPath && config.verification.lockPath !== '/tmp/cland-suite.lock' ? `${config.verification.lockPath}-nvim` : '/tmp/cland-suite-nvim.lock'] },
      store,
      log,
      requestGuard,
      ...(config ? { rateLimit: config.hygiene.rateLimit, eventLimit: config.hygiene.eventLimit, loopBreaker: config.hygiene.loopBreaker, maxTextBytes: config.hygiene.maxTextBytes } : {}),
      tracker,
      roles,
      visibility: config?.visibility ?? {},
      visibilityPreferences: new VisibilityPreferenceFile(join(l.dir, 'ui.json')),
      crew,
      artifactRetentionDays: config?.artifacts.retentionDays ?? 30,
      ...(Number(env.CLAND_HEARTBEAT_MS) > 0 && Number.isFinite(Number(env.CLAND_HEARTBEAT_MS)) ? { heartbeatMs: Number(env.CLAND_HEARTBEAT_MS) } : {}),
      heartbeatRunTimeoutMs: Number(env.CLAND_TEST_EXECUTOR_RUN_TIMEOUT_MS) > 0 ? Number(env.CLAND_TEST_EXECUTOR_RUN_TIMEOUT_MS) : config?.verification.runTimeoutMs ?? 4500000,
      idleNotifyMs: idleNotifyMs(join(l.dir, 'config.toml'), env, log),
      // Tests may shorten the event window without changing the sixty-second default.
      ...(Number(env.CLAND_TEST_EVENT_WINDOW_MS) > 0 && Number.isFinite(Number(env.CLAND_TEST_EVENT_WINDOW_MS)) ? { eventWindowMs: Number(env.CLAND_TEST_EVENT_WINDOW_MS) } : {}),
      // tests only: how long a queued message and a remembered name last (the default is a day)
      ...(Number(env.CLAND_QUEUE_TTL_MS) > 0 ? { queueTtlMs: Number(env.CLAND_QUEUE_TTL_MS) } : {}),
      control: {
        remoteMuteDefault: () => roles.config().remote.muteDefault,
        remoteTest: async (messenger, pairing) => {
          if (!gateway) throw new Error('messenger test is unavailable; enable it with a token and a supported client');
          await gateway.test(messenger, pairing);
        },
        remoteStatus: () => ({ remotes: (['telegram', 'discord'] as const).map(messenger => {
          const remote = store.remotes.forMessenger(messenger);
          const traffic = gateway?.status(messenger);
          const status = remote.status();
          const token = remoteSecrets[`${messenger}.token`];
          // Public bot links survive generic URL masking only after host/shape validation
          // and exact credential masking of the non-scheme portion.
          const link = traffic?.botLink;
          const publicLink = link && /^https:\/\/(?:t\.me\/[A-Za-z0-9_]{5,32}|discord\.com\/(?:api\/)?oauth2\/authorize\?client_id=\d+&scope=bot&permissions=117824)$/.test(link)
            && remoteOutput.text(link.slice(8)) === link.slice(8) ? link : null;
          return { ...remoteOutput.value({
            messenger, token: { present: token !== undefined, fingerprint: token === undefined ? null : createHash('sha256').update(token).digest('hex').slice(0, 12) },
            pairing: remote.pairing(), connection: status.disabled ? 'disabled' as const : traffic?.connected ? 'connected' as const : 'disconnected' as const,
            reason: status.reason, lastInbound: traffic?.lastInbound ?? null, lastOutbound: traffic?.lastOutbound ?? null,
            outboxDepth: remote.outbox().filter(job => ['queued', 'sending', 'uncertain'].includes(job.state)).length,
            mute: remote.get('mute') === 'true',
          }), botLink: publicLink };
        }) }),
        pairingReplaced: (messenger, previous) => gateway?.pairingReplaced(messenger, previous),
        webSessions: () => {
          if (!web) throw new Error('the web edge is unavailable');
          return web.sessions();
        },
        webRevoke: id => {
          if (!web) throw new Error('the web edge is unavailable');
          return web.revoke(id);
        },
        webLink: qr => {
          if (!web?.status.available) throw new Error('the web edge is unavailable');
          return web.link(qr);
        },
        reload: resumed => roles.reload(resumed),
        setConfig: (key, value, resumed, authorize) => roles.set(key, value, resumed, authorize),
        setRoleLaunch: (role, fields, resumed, authorize) => roles.setRoleLaunch(role, fields, resumed, authorize),
        flushLogs: async () => { await journal.flush(); await processJournal?.flush(); await options.flushLog?.(); },
        // without listeners: port 0 and no socket
        status: () => ({
          pid: process.pid,
          priority,
          port: ws?.port ?? 0,
          ...(ws ? { spokeBind: ws.bind } : {}),
          ...(web ? { web: web.status } : {}),
          socket: edge ? l.socket : '',
          version: VERSION,
          root,
          startedAt: startedAt.toISOString(),
          config: roles.status(),
          crew: { config: crew.get(), summary: crewSummary(crew.get()) },
          keys: config?.keys ?? { layouts: [] },
          tracker: { levels: tracker.ladder.flat, ladder: tracker.ladder.levels.map(level => [...level]) },
          uptimeMs: clock.now().getTime() - startedAt.getTime(),
          harnesses: adapters?.sessions.list() ?? [],
        }),
        stop: () => { markHubStop(root); deliberateStop = true; void stop().catch(err => processLog({ event: 'stop-failed', error: err instanceof Error ? err.message : String(err) })); },
      },
    });
    hub.core.restoreJournalRows(recent);
  } catch (err) {
    await crew.stop();
    await rules.stop();
    await roles.stop();
    await tracker.stop();
    try { await closeLogs(); } finally { lock.release(); }
    throw err;
  }
  agents.attach(hub.core);
  log({ event: 'hub-startup-step', step: 'replaying agents journal', pid: process.pid });
  // notices a previous run journalled but died before recording (a crash between the two)
  try {
    replayAgentsRecord(hub.core, startupHistory, log);
  } catch (err) {
    log({ event: 'agents-record-failed', error: err instanceof Error ? err.message : String(err) });
  }
  startupHistory = [];
  let resolveStopped!: () => void;
  const stopped = new Promise<void>((resolve) => (resolveStopped = resolve));
  let stopping: Promise<void> | null = null;
  let deliberateStop = false;
  let sweep: Promise<void> | null = null;
  let maintenanceTimer: ClockTimer | null = null;
  let maintenance: Promise<void> | null = null;
  let maintenanceRecovery: Promise<void> | null = null;
  const maintenanceAbort = new AbortController();
  const reportOwner = (owner: import('../git-maintenance-owner.ts').MaintenanceOwner) => hub.core.noticeTo(AGENTS.id, { id: `git-maintenance-recovery:${owner.token}`, kind: 'report', to: ['coordinator'], text: `Git collector pid ${owner.pid} retains territory ownership; recovery could not confirm its group is gone. Serving and read-only requests remain available.`, detail: { event: 'git-maintenance-recovery-blocked', pid: owner.pid } });
  const unreportMaintenance = maintenanceRecoveryReporter(root, reportOwner);
  const maintenanceFailure = (error: unknown) => {
    log({ event: 'git-maintenance-failed', error: String(error) });
    if (error instanceof MaintenanceRecoveryRequired) reportOwner(error.owner);
  };
  const startMaintenanceRecovery = () => {
    maintenanceRecovery = (options.gitMaintenanceRecovery ?? (async () => {
      if (await readMaintenanceOwner(root)) await withTerritoryLockAsync(root, async () => {});
    }))(root, env);
    void maintenanceRecovery.catch(maintenanceFailure);
  };
  const scheduleMaintenance = () => {
    maintenanceTimer = clock.setTimeout(() => {
      maintenanceTimer = null;
      if (stopping) return;
      log({ event: 'git-maintenance-started' });
      maintenance = (maintenanceRecovery ?? Promise.resolve()).then(() => (options.gitMaintenance ?? maintainProjectGit)(root, key => store.meta(key), env, { signal: maintenanceAbort.signal }))
        .then(() => log({ event: 'git-maintenance-completed' }))
        .catch(maintenanceFailure);
    }, 30_000);
    maintenanceTimer.unref();
  };
  const stop = (): Promise<void> => {
    stopping ??= (async () => {
      const failures: unknown[] = [];
      const attempt = async (cleanup: () => unknown) => {
        try { await cleanup(); } catch (error) { failures.push(error); }
      };
      try {
        await attempt(() => log({ event: 'stopping' }));
        clock.clearTimeout(maintenanceTimer);
        maintenanceAbort.abort();
        // The collector's native close and receipt precede store/lock teardown.
        await attempt(() => maintenance);
        await attempt(() => maintenanceRecovery);
        unreportMaintenance();
        await attempt(() => gateway?.stop());
        // Stop the config/role owner once, joining reload before edges and storage close.
        await attempt(() => roles.stop());
        await attempt(() => edge?.close());
        await attempt(() => ws?.close());
        await attempt(() => web?.close());
        await attempt(() => sweep);
        await attempt(() => accountPoller?.close());
        // Both journal and session projections depend on the adapters' open table.
        await attempt(() => hub.core.close());
        await attempt(() => hub.dispatcher.close());
        await attempt(() => adapters?.close());
        await attempt(() => tracker.stop());
        await attempt(() => lintWarmer.close());
        await attempt(() => crew.stop());
        await attempt(() => agents.attach(null));
        await attempt(() => hub.close());
        await attempt(() => rules.stop());
        // Discovery and lock go last, including when an earlier disposer failed.
        await attempt(() => removeDiscovery(l.discovery, process.pid));
        await attempt(() => journal.write({ event: 'hub-stopped', pid: process.pid }));
        await attempt(() => log({ event: 'stopped' }));
        await attempt(closeLogs);
      } finally {
        await attempt(() => { if (deliberateStop) markHubStop(root); });
        await attempt(() => lock.release());
        resolveStopped();
      }
      if (failures.length === 1) throw failures[0];
      if (failures.length) throw new AggregateError(failures, 'hub cleanup failed', { cause: failures[0] });
    })();
    return stopping;
  };

  if (listen !== 'never') {
    try {
      log({ event: 'hub-startup-step', step: 'binding listeners', pid: process.pid });
      ws = await createWebSocketEdge(hub.dispatcher, { port: 0, host: '127.0.0.1', secret, log });
      edge = await createSocketEdge({ path: l.socket, dispatcher: hub.dispatcher, log });
    } catch (err) {
      // both listeners or none: a hub.json naming only half of them would send its readers to a dead end
      await ws?.close();
      ws = null;
      if (listen === 'required') {
        unreportMaintenance();
        await crew.stop();
        agents.attach(null);
        await hub.close();
        await tracker.stop();
        await rules.stop();
        await roles.stop();
        try { await closeLogs(); } finally { lock.release(); }
        throw err;
      }
      log({ event: 'listen-failed', error: err instanceof Error ? err.message : String(err), serving: 'stdio only' });
    }
  }

  const startGateway = async () => {
    const create = (remotes: readonly Remote[]) => new Gateway(hub.dispatcher, remotes, {
      state: options.gatewayState ?? store.remotes, log, redact: remoteOutput, pairing: hub.core.inbox.pairingCodes,
      lease: new PollerLease(store.remotes, { clock, processes: options.gatewayProcesses ?? nativePollerProcesses(env) }),
    });
    if (!options.gatewayMessenger && options.gatewayRemotes?.length) {
      gateway = create(options.gatewayRemotes);
      await gateway.start();
    } else {
      const { messengerFactory } = await import('../remote/messenger.ts');
      gateway = new ConfiguredGateway(options.gatewayMessenger ?? messengerFactory(env, remoteOutput, clock, { state: store.remotes, log }), create);
      await gateway.update(roles.config(), remoteSecrets);
    }
  };

  const primeInbox = () => {
    try { hub.core.inbox.needsYou(); }
    catch (error) { log({ event: 'inbox-failed', error: String(error) }); }
  };
  if (ws === null || edge === null) {
    try {
      await startGateway();
    } catch (error) {
      await stop();
      throw error;
    }
    primeInbox();
    log({ event: 'serving', root, pid: process.pid, listeners: false });
    startMaintenanceRecovery();
    scheduleMaintenance();
    starting = false;
    hub.dispatcher.startExecutorRecovery();
    tracker.resumeReadyChecks();
    lintWarmer.request(devTip);
    return { layout: l, discovery: null, hub, log, stopped, storageFailed, stop, reload: () => roles.reload(), get storageAbandoned() { return tracker.storageAbandoned; } };
  }

  log({ event: 'hub-startup-step', step: 'binding web listener', pid: process.pid });
  web = await createWebEdge({ root, store, log, projectName: () => roles.config().name, ...(options.artifactOpen ? { artifactOpen: options.artifactOpen } : {}), dispatcher: hub.dispatcher, clock, stateDir: l.dir, ...(config ? { port: config.web.port, bind: config.web.bind, origin: config.web.origin, ...(config.web.dist ? { dist: resolve(root, config.web.dist) } : {}) } : {}) });
  if (!web.status.available) log({ event: 'web-unavailable', ...web.status });

  // the adapters: launched harness sessions, re-found after a restart once the hub is reachable again
  try {
    log({ event: 'hub-startup-step', step: 'restoring sessions', pid: process.pid });
    adapters = projectSessions({ ...(options.openDatabase ? { openDatabase: options.openDatabase } : {}), core: hub.core, root, db: l.db, discoveryFile: l.discovery, log, tracker, env, cleanup: config?.sessions, ...(options.adapters ? { adapters: options.adapters } : {}) });
    hub.dispatcher.useSessions(adapters.sessions);
    await adapters.sessions.sweepArchive();
    await startGateway();
  } catch (error) {
    try { await stop(); }
    catch (cleanup) { throw new AggregateError([error, cleanup], 'hub adapter startup failed', { cause: error }); }
    throw error;
  }

  const discovery: Discovery = { root, socket: l.socket, port: ws.port, webPort: web.status.port, secret, pid: process.pid, version: VERSION };
  log({ event: 'hub-startup-step', step: 'publishing discovery', pid: process.pid });
  primeInbox();
  writeDiscovery(l.discovery, discovery);
  log({ event: 'serving', root, port: ws.port, socket: l.socket, pid: process.pid });
  adapters.sessions.markServing();
  startMaintenanceRecovery();
  scheduleMaintenance();
  starting = false;
  hub.dispatcher.startExecutorRecovery();
  tracker.resumeReadyChecks();
  lintWarmer.request(devTip);
  accountPoller = new AccountPoller(hub.core, adapters.sessions, root, log, env, clock, options.accountReader);
  hub.dispatcher.useAccountPoller(accountPoller);
  void adapters.sessions.resumeAll().then(() => {
    if (!stopping) { primeInbox(); accountPoller!.start(); }
  }).catch(error => log({ event: 'session-restore-failed', error: String(error) }));
  // Socket readiness never awaits cleanup. Reservations cover servers spawned before their row is published.
  sweep = new Promise<void>(resolve => setImmediate(resolve)).then(async () => {
    if (env.CLAND_TEST_SKIP_ORPHAN_SWEEP === '1') {
      log({ event: 'orphan-sweep-skipped', reason: 'test-fixture' });
      return;
    }
    log({ event: 'orphan-sweep-started' });
    const ended = await sweepOrphans(root, log, 'harness', { pending: () => stopping !== null || adapters!.sessions.lifecyclePending() });
    const fixtures = await sweepOrphans(root, log, 'fixture', { pending: () => stopping !== null, ...(env.CLAND_TEST_ORPHAN_ROOT ? { hubScopeRoot: env.CLAND_TEST_ORPHAN_ROOT } : {}) });
    log({ event: 'orphan-sweep-completed', ended: [...ended, ...fixtures].map(p => p.process.pid) });
  }).catch(err => log({ event: 'orphan-sweep-failed', reason: err instanceof Error ? err.message : 'OS process inspection failed; unverified candidates were preserved' }));
  return { layout: l, discovery, hub, log, stopped, storageFailed, stop, reload: () => roles.reload(), get storageAbandoned() { return tracker.storageAbandoned; } };
}
