// The hub as a project's daemon: `.cland/` prepared, the store opened on `hub.db`, the WebSocket edge for
// spokes and the Unix socket edge for the UI bound, and the discovery file written last — a client that
// reads `hub.json` finds a hub that answers.
import { Store } from './store.ts';
import { createHub, type Hub } from './server.ts';
import { createSocketEdge, type SocketEdge } from './socket.ts';
import { ensureSkeleton, layout, pidAlive, readDiscovery, removeDiscovery, writeDiscovery, type Discovery, type Layout } from '../project.ts';
import { VERSION } from '../version.ts';
import { Tracker } from '../tracker/tracker.ts';
import type { LogFn } from '../log.ts';
import { projectSessions, type ProjectSessions } from '../adapters/index.ts';

export type Daemon = {
  layout: Layout;
  discovery: Discovery;
  hub: Hub;
  /** Resolves once the daemon has stopped (by `stop`, or by a client's `hub.stop`). */
  stopped: Promise<void>;
  stop: () => Promise<void>;
};

export async function serveProject(root: string, options: { log?: LogFn } = {}): Promise<Daemon> {
  const log = options.log ?? (() => {});
  const l = layout(root);
  const secret = ensureSkeleton(l);
  const running = readDiscovery(l.discovery);
  if (running && running.pid !== process.pid && pidAlive(running.pid)) {
    throw new Error(`a hub already runs for ${root} (pid ${running.pid}, socket ${running.socket})`);
  }

  const startedAt = new Date();
  // the tracker's index lives in the same file, in tables of its own; it is rebuilt from the item files here
  const tracker = new Tracker({ root, db: l.db, log });
  let hub!: Hub;
  let adapters: ProjectSessions | null = null;
  try {
    tracker.start();
    hub = await createHub({
      port: 0,
      host: '127.0.0.1',
      secret,
      store: new Store(l.db),
      log,
      tracker,
      control: {
        status: () => ({
          pid: process.pid,
          port: hub.port,
          socket: l.socket,
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
    tracker.stop();
    throw err;
  }
  let resolveStopped!: () => void;
  const stopped = new Promise<void>((resolve) => (resolveStopped = resolve));
  let stopping: Promise<void> | null = null;
  let edge: SocketEdge | null = null;
  const stop = (): Promise<void> => {
    stopping ??= (async () => {
      log({ event: 'stopping' });
      // the discovery file goes first: from here on nobody is sent to a hub on its way out
      removeDiscovery(l.discovery, process.pid);
      await edge?.close();
      adapters?.close();
      await hub.close();
      tracker.stop();
      log({ event: 'stopped' });
      resolveStopped();
    })();
    return stopping;
  };

  try {
    edge = await createSocketEdge({ path: l.socket, dispatcher: hub.dispatcher, log });
  } catch (err) {
    await hub.close();
    tracker.stop();
    throw err;
  }

  // the adapters: launched harness sessions, re-found after a restart once the hub is reachable again
  adapters = projectSessions({ core: hub.core, root, db: l.db, discoveryFile: l.discovery, log });
  hub.dispatcher.useSessions(adapters.sessions);

  const discovery: Discovery = { socket: l.socket, port: hub.port, secret, pid: process.pid, version: VERSION };
  writeDiscovery(l.discovery, discovery);
  log({ event: 'serving', root, port: hub.port, socket: l.socket, pid: process.pid });
  void adapters.sessions.resumeAll();
  return { layout: l, discovery, hub, stopped, stop };
}
