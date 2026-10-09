// The hub as a project's daemon: the project's lock taken first, `.cland/` prepared, the store opened on
// `hub.db`, the WebSocket edge for spokes and the Unix socket edge for the UI bound, and the discovery file
// written last — a client that reads `hub.json` finds a hub that answers. Shutdown runs it backwards: the
// edges close, `hub.json` goes, and the lock is released last, so no successor binds before this hub is gone.
//
// A hub serving a UI over its stdio may run without the listeners (spec 4.2: sandboxed QA runs, where
// binding is forbidden). It still takes the lock — the store is one hub's alone — but writes no `hub.json`
// and plugs in no adapters: nothing could reach it, so it launches nothing.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Store } from './store.ts';
import { createHubBase, createWebSocketEdge, type HubBase, type WebSocketEdge } from './server.ts';
import { createSocketEdge, type SocketEdge } from './socket.ts';
import { ensureSkeleton, layout, removeDiscovery, writeDiscovery, type Discovery, type Layout } from '../project.ts';
import { acquireLock, HubLocked } from './lock.ts';
import { VERSION } from '../version.ts';
import { Tracker } from '../tracker/tracker.ts';
import type { LogFn } from '../log.ts';
import { projectSessions, type ProjectSessions } from '../adapters/index.ts';
import { RolesFile } from '../roles/config.ts';
import { readProjectConfig } from '../init/config.ts';
import { Journal, journalPath, readJournal } from './journal.ts';
import { agentsRecord, replayAgentsRecord } from './agents-topic.ts';
import { idleNotifyMs } from './inbox.ts';

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
  /** Resolves once the daemon has stopped (by `stop`, or by a client's `hub.stop`). */
  stopped: Promise<void>;
  stop: () => Promise<void>;
};

export async function serveProject(root: string, options: { log?: LogFn; listen?: ListenMode } = {}): Promise<Daemon> {
  const processLog = options.log ?? (() => {});
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
  const journal = new Journal(journalPath(l.dir));
  const agents = agentsRecord();
  const log: LogFn = agents.tap(journal.tap(processLog));
  journal.write({ event: 'hub-started', pid: process.pid, version: VERSION, root });

  const startedAt = new Date();
  // the tracker's index lives in the same file, in tables of its own; it is rebuilt from the item files here
  const writePauseMs = Number(process.env.CLAND_TEST_TASK_WRITE_PAUSE_MS ?? 0);
  const tracker = new Tracker({ root, db: l.db, log, ...(writePauseMs > 0 ? { writePauseMs } : {}) });
  // the role definitions: written with the defaults when the project has none, then watched
  const roles = new RolesFile(l.roles, log);
  // the hygiene thresholds of `.cland/config.toml`; the built-in defaults when it is missing or unreadable
  const config = readProjectConfig(l.config, root);
  if (config) log({ event: 'config-loaded', path: l.config, hygiene: config.hygiene });
  let hub!: HubBase;
  let adapters: ProjectSessions | null = null;
  let ws: WebSocketEdge | null = null;
  let edge: SocketEdge | null = null;
  try {
    tracker.start();
    roles.start();
    hub = createHubBase({
      secret,
      store: new Store(l.db),
      log,
      ...(config ? { rateLimit: config.hygiene.rateLimit, loopBreaker: config.hygiene.loopBreaker, maxTextBytes: config.hygiene.maxTextBytes } : {}),
      tracker,
      roles,
      idleNotifyMs: idleNotifyMs(join(l.dir, 'config.toml'), process.env, log),
      // tests only: how long a queued message and a remembered name last (the default is a day)
      ...(Number(process.env.CLAND_QUEUE_TTL_MS) > 0 ? { queueTtlMs: Number(process.env.CLAND_QUEUE_TTL_MS) } : {}),
      control: {
        // without listeners: port 0 and no socket
        status: () => ({
          pid: process.pid,
          port: ws?.port ?? 0,
          socket: edge ? l.socket : '',
          version: VERSION,
          root,
          startedAt: startedAt.toISOString(),
          uptimeMs: Date.now() - startedAt.getTime(),
          harnesses: adapters?.sessions.list() ?? [],
        }),
        stop: () => void stop(),
      },
    });
  } catch (err) {
    roles.stop();
    tracker.stop();
    journal.close();
    lock.release();
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
  const stop = (): Promise<void> => {
    stopping ??= (async () => {
      log({ event: 'stopping' });
      await edge?.close();
      await ws?.close();
      adapters?.close();
      await hub.close();
      tracker.stop();
      roles.stop();
      // the discovery file and then the lock go last: a successor can only start once this hub is gone
      removeDiscovery(l.discovery, process.pid);
      journal.write({ event: 'hub-stopped', pid: process.pid });
      journal.close();
      lock.release();
      log({ event: 'stopped' });
      resolveStopped();
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
        await hub.close();
        tracker.stop();
        roles.stop();
        journal.close();
        lock.release();
        throw err;
      }
      log({ event: 'listen-failed', error: err instanceof Error ? err.message : String(err), serving: 'stdio only' });
    }
  }

  if (ws === null || edge === null) {
    log({ event: 'serving', root, pid: process.pid, listeners: false });
    return { layout: l, discovery: null, hub, stopped, stop };
  }

  // the adapters: launched harness sessions, re-found after a restart once the hub is reachable again
  adapters = projectSessions({ core: hub.core, root, db: l.db, discoveryFile: l.discovery, log });
  hub.dispatcher.useSessions(adapters.sessions);
  adapters.sessions.releaseInterruptedLaunches();

  const discovery: Discovery = { root, socket: l.socket, port: ws.port, secret, pid: process.pid, version: VERSION };
  writeDiscovery(l.discovery, discovery);
  log({ event: 'serving', root, port: ws.port, socket: l.socket, pid: process.pid });
  void adapters.sessions.resumeAll();
  return { layout: l, discovery, hub, stopped, stop };
}
