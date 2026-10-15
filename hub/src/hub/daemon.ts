// The hub as a project's daemon: the project's lock taken first, `.cland/` prepared, the store opened on
// `hub.db`, the WebSocket edge for spokes and the Unix socket edge for the UI bound, and the discovery file
// written last — a client that reads `hub.json` finds a hub that answers. Shutdown runs it backwards: the
// edges close, `hub.json` goes, and the lock is released last, so no successor binds before this hub is gone.
//
// A hub serving a UI over its stdio may run without the listeners (spec 4.2: sandboxed QA runs, where
// binding is forbidden). It still takes the lock — the store is one hub's alone — but writes no `hub.json`
// and plugs in no adapters: nothing could reach it, so it launches nothing.
import { AccountPoller } from '../accounts/poller.ts';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { access, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sweepOrphans } from '../orphans.ts';
import { VisibilityPreferenceFile } from './visibility-preferences.ts';
import { Store } from './store.ts';
import { createHubBase, createWebSocketEdge, type HubBase, type WebSocketEdge } from './server.ts';
import { createSocketEdge, type SocketEdge } from './socket.ts';
import { ensureSkeleton, layout, removeDiscovery, writeDiscovery, type Discovery, type Layout } from '../project.ts';
import { acquireLock, HubLocked } from './lock.ts';
import { VERSION } from '../version.ts';
import { AGENTS } from './core.ts';
import { Tracker } from '../tracker/tracker.ts';
import type { TipSchedule } from '../tracker/freshness.ts';
import type { LogFn } from '../log.ts';
import { projectSessions, type ProjectSessions } from '../adapters/index.ts';
import { CrewFile, crewSummary } from '../crew.ts';
import { RulebookFile } from '../rules/file.ts';
import { RolesFile } from '../roles/config.ts';
import { readProjectConfig } from '../init/config.ts';
import { Journal, journalPath, readJournal, eventRow, type JournalOpen, type JournalRecord } from './journal.ts';
import { agentsRecord, replayAgentsRecord } from './agents-topic.ts';
import { idleNotifyMs } from './inbox.ts';
import { RequestGuard } from './budget.ts';
import { jsonLinesLog } from '../log.ts';

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
  stop: () => Promise<void>;
};

export async function serveProject(root: string, options: { log?: LogFn; listen?: ListenMode; scheduleTips?: TipSchedule; journalOpen?: JournalOpen } = {}): Promise<Daemon> {

  const listen = options.listen ?? 'required';
  const l = layout(root);
  mkdirSync(l.dir, { recursive: true });
  // before anything is prepared: a second hub must not even write the secret
  let lock;
  try {
    lock = acquireLock(l.lock);
  } catch (err) {
    if (err instanceof HubLocked) {
      throw new Error(`a hub already runs for ${root} (pid ${err.holder.pid} holds ${l.lock}); talk to it over its socket, or stop it first with \`cland hub stop\``);
    }
    throw err;
  }
  let secret: string;
  try {
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
  const processJournal = options.log ? null : new Journal(l.log, undefined, { log: fatalLog, guard: requestGuard });
  let starting = true;
  const processLog: LogFn = options.log ?? (entry => {
    // A stdio parent sees startup/listener diagnostics on its stderr pipe, as before.
    // Once serving, ordinary events (including audit/refusal) use the async append sink.
    if (starting || String(entry.event).startsWith('orphan-sweep-') || entry.event === 'orphan-ended' || entry.event === 'orphan-preserved') fatalLog(entry);
    else processJournal!.write(entry as { event: string } & Record<string, unknown>);
  });
  const journal = new Journal(journalPath(l.dir), undefined, { log: processLog, guard: requestGuard, ...(options.journalOpen ? { open: options.journalOpen } : {}) });
  const agents = agentsRecord();
  let hub!: HubBase;
  const tapped = agents.tap(journal.tap(processLog));
  log = entry => {
    const record: JournalRecord = { ts: new Date().toISOString(), ...entry, event: String(entry.event), eventsVersion: 1 };
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
    if (failure) throw failure;
  };
  journal.write({ event: 'hub-started', pid: process.pid, version: VERSION, root });

  const startedAt = new Date();
  // the tracker's index lives in the same file, in tables of its own; it is rebuilt from the item files here
  // Tests only: consume a one-shot arm, acknowledge the completed temp write, and await release.
  const gateDir = process.env.CLAND_TEST_TASK_WRITE_GATE;
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
  const tipCheckMs = Number(process.env.CLAND_TEST_TIP_CHECK_MS ?? 0);
  const storageStallMs = Number(process.env.CLAND_TEST_TRACKER_STALL_MS ?? 0);
  const storageFatalMs = Number(process.env.CLAND_TEST_TRACKER_FATAL_MS ?? 0);
  const stopTimeoutMs = Number(process.env.CLAND_TEST_TRACKER_STOP_MS ?? 0);
  let config: ReturnType<typeof readProjectConfig>;
  try {
    config = readProjectConfig(l.config, root, error => { if (/^verification\.(lifetime|run_timeout|daily_spend_usd)/.test(error)) throw new Error(error); log({ event: 'config-unreadable', file: l.config, error, keeping: 'the defaults' }); });
  } catch (error) { await closeLogs(); lock.release(); throw error; }
  let failStorage!: () => void;
  const storageFailed = new Promise<void>(resolve => { failStorage = resolve; });
  const tracker = new Tracker({ onStorageFatal: operation => {
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
  }, planHistory: readJournal(journalPath(l.dir), { kinds: ['task-plan-changed', 'task-plan-approved'] }), ...(config ? { levels: config.tracker.levels, storageFatalMs: config.tracker.fatalStallMs, qaDefault: config.plan.qaDefault, planApproval: config.plan.approval } : {}), ...(storageStallMs > 0 && Number.isFinite(storageStallMs) ? { storageStallMs } : {}), ...(storageFatalMs > 0 && storageFatalMs <= 2147483647 && Number.isFinite(storageFatalMs) ? { storageFatalMs } : {}), ...(stopTimeoutMs > 0 && Number.isFinite(stopTimeoutMs) ? { stopTimeoutMs } : {}), root, db: l.db, log, watchResumed: requestGuard.resumer('tracker.watch'), ...(writeGate ? { writeGate } : {}), ...(tipCheckMs > 0 ? { tipCheckMs } : {}), ...(options.scheduleTips ? { scheduleTips: options.scheduleTips } : {}) });
  // the role definitions: written with the defaults when the project has none, then watched
  const roles = new RolesFile(l.roles, log, undefined, requestGuard.resumer('roles.refresh'));
  // the hygiene thresholds of `.cland/config.toml`; the built-in defaults when it is missing or unreadable
  if (config) log({ event: 'config-loaded', path: l.config, hygiene: config.hygiene });
  const rules = new RulebookFile(l.rules, () => roles.get().keys(), log, requestGuard.resumer('rules.refresh'));
  const crew = new CrewFile(l.crew, log, config => hub?.core.publishCrew(config), tracker, requestGuard.resumer('crew.refresh'));
  let adapters: ProjectSessions | null = null;
  let accountPoller: AccountPoller | null = null;
  let ws: WebSocketEdge | null = null;
  let edge: SocketEdge | null = null;
  try {
    tracker.start();
    await tracker.rescanAsync();
    await roles.start();
    await rules.start();
    await crew.start();
    // The live cache must share the journal's recent groups, including ones beyond the
    // first page. Read the tail before creating the core so startup log producers cannot
    // race restoration; the listeners and adapters start only after this cache is installed.
    const recent: import('../protocol.ts').EventRow[] = [];
    const cutoff = Date.now() - 60000;
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
    hub = createHubBase({
      secret,
      rules,
      journal,
      verification: { executor: config?.verification.executor ?? 'local', lifetimeMs: config?.verification.lifetimeMs ?? 6600000, runTimeoutMs: config?.verification.runTimeoutMs ?? 4500000, runTimeout: config?.verification.runTimeout ?? '75m', cacheMaxAgeMs: config?.verification.cacheMaxAgeMs ?? 86400000, budget: config?.verification.budget ?? 1, remoteBudget: config?.verification.remoteBudget ?? 4, locks: [config?.verification.lockPath ?? '/tmp/cland-suite.lock', config?.verification.lockPath && config.verification.lockPath !== '/tmp/cland-suite.lock' ? `${config.verification.lockPath}-nvim` : '/tmp/cland-suite-nvim.lock'] },
      store: new Store(l.db),
      log,
      requestGuard,
      ...(config ? { rateLimit: config.hygiene.rateLimit, eventLimit: config.hygiene.eventLimit, loopBreaker: config.hygiene.loopBreaker, maxTextBytes: config.hygiene.maxTextBytes } : {}),
      tracker,
      roles,
      visibility: config?.visibility ?? {},
      visibilityPreferences: new VisibilityPreferenceFile(join(l.dir, 'ui.json')),
      crew,
      artifactRetentionDays: config?.artifacts.retentionDays ?? 30,
      ...(Number(process.env.CLAND_HEARTBEAT_MS) > 0 && Number.isFinite(Number(process.env.CLAND_HEARTBEAT_MS)) ? { heartbeatMs: Number(process.env.CLAND_HEARTBEAT_MS) } : {}),
      heartbeatRunTimeoutMs: Number(process.env.CLAND_TEST_EXECUTOR_RUN_TIMEOUT_MS) > 0 ? Number(process.env.CLAND_TEST_EXECUTOR_RUN_TIMEOUT_MS) : config?.verification.runTimeoutMs ?? 4500000,
      idleNotifyMs: idleNotifyMs(join(l.dir, 'config.toml'), process.env, log),
      // Tests may shorten the event window without changing the sixty-second default.
      ...(Number(process.env.CLAND_TEST_EVENT_WINDOW_MS) > 0 && Number.isFinite(Number(process.env.CLAND_TEST_EVENT_WINDOW_MS)) ? { eventWindowMs: Number(process.env.CLAND_TEST_EVENT_WINDOW_MS) } : {}),
      // tests only: how long a queued message and a remembered name last (the default is a day)
      ...(Number(process.env.CLAND_QUEUE_TTL_MS) > 0 ? { queueTtlMs: Number(process.env.CLAND_QUEUE_TTL_MS) } : {}),
      control: {
        flushLogs: async () => { await journal.flush(); await processJournal?.flush(); },
        // without listeners: port 0 and no socket
        status: () => ({
          pid: process.pid,
          port: ws?.port ?? 0,
          socket: edge ? l.socket : '',
          version: VERSION,
          root,
          startedAt: startedAt.toISOString(),
          crew: { config: crew.get(), summary: crewSummary(crew.get()) },
          keys: config?.keys ?? { layouts: [] },
          tracker: { levels: tracker.ladder.flat, ladder: tracker.ladder.levels.map(level => [...level]) },
          uptimeMs: Date.now() - startedAt.getTime(),
          harnesses: adapters?.sessions.list() ?? [],
        }),
        stop: () => { void stop().catch(err => processLog({ event: 'stop-failed', error: err instanceof Error ? err.message : String(err) })); },
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
  // notices a previous run journalled but died before recording (a crash between the two)
  try {
    replayAgentsRecord(hub.core, readJournal(journalPath(l.dir)), log);
  } catch (err) {
    log({ event: 'agents-record-failed', error: err instanceof Error ? err.message : String(err) });
  }
  let resolveStopped!: () => void;
  const stopped = new Promise<void>((resolve) => (resolveStopped = resolve));
  let stopping: Promise<void> | null = null;
  let sweep: Promise<void> | null = null;
  const stop = (): Promise<void> => {
    stopping ??= (async () => {
      log({ event: 'stopping' });
      await edge?.close();
      await ws?.close();
      await sweep;
      await accountPoller?.close();
      // Both journal and session projections depend on the adapters' open table.
      hub.core.close();
      await hub.dispatcher.close();
      adapters?.close();
      await tracker.stop();
      await crew.stop();
      await hub.close();
      await rules.stop();
      await roles.stop();
      // the discovery file and then the lock go last: a successor can only start once this hub is gone
      removeDiscovery(l.discovery, process.pid);
      journal.write({ event: 'hub-stopped', pid: process.pid });
      log({ event: 'stopped' });
      try { await closeLogs(); }
      finally {
        lock.release();
        resolveStopped();
      }
    })();
    return stopping;
  };

  if (listen !== 'never') {
    try {
      ws = await createWebSocketEdge(hub.dispatcher, { port: 0, host: '127.0.0.1', secret, log });
      edge = await createSocketEdge({ path: l.socket, dispatcher: hub.dispatcher, log });
    } catch (err) {
      // both listeners or none: a hub.json naming only half of them would send its readers to a dead end
      await ws?.close();
      ws = null;
      if (listen === 'required') {
        await crew.stop();
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

  if (ws === null || edge === null) {
    log({ event: 'serving', root, pid: process.pid, listeners: false });
    starting = false;
    return { layout: l, discovery: null, hub, log, stopped, storageFailed, stop, get storageAbandoned() { return tracker.storageStatus().abandoned.length > 0; } };
  }

  // the adapters: launched harness sessions, re-found after a restart once the hub is reachable again
  adapters = projectSessions({ core: hub.core, root, db: l.db, discoveryFile: l.discovery, log, tracker, cleanup: config?.sessions });
  hub.dispatcher.useSessions(adapters.sessions);
  adapters.sessions.sweepArchive();

  const discovery: Discovery = { root, socket: l.socket, port: ws.port, secret, pid: process.pid, version: VERSION };
  writeDiscovery(l.discovery, discovery);
  log({ event: 'serving', root, port: ws.port, socket: l.socket, pid: process.pid });
  starting = false;
  accountPoller = new AccountPoller(hub.core, adapters.sessions, root, log);
  hub.dispatcher.useAccountPoller(accountPoller);
  void adapters.sessions.resumeAll().then(() => { if (!stopping) accountPoller!.start(); });
  // Socket readiness never awaits cleanup. Reservations cover servers spawned before their row is published.
  sweep = new Promise<void>(resolve => setImmediate(resolve)).then(async () => {
    if (process.env.CLAND_TEST_SKIP_ORPHAN_SWEEP === '1') {
      log({ event: 'orphan-sweep-skipped', reason: 'test-fixture' });
      return;
    }
    log({ event: 'orphan-sweep-started' });
    const ended = await sweepOrphans(root, log, 'harness', { pending: () => stopping !== null || adapters!.sessions.lifecyclePending() });
    log({ event: 'orphan-sweep-completed', ended: ended.map(p => p.process.pid) });
  }).catch(err => log({ event: 'orphan-sweep-failed', reason: err instanceof Error ? err.message : 'OS process inspection failed; unverified candidates were preserved' }));
  return { layout: l, discovery, hub, log, stopped, storageFailed, stop, get storageAbandoned() { return tracker.storageStatus().abandoned.length > 0; } };
}
