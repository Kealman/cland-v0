// The hub as a project's daemon: the project's lock taken first, `.cland/` prepared, the store opened on
// `hub.db`, the WebSocket edge for spokes and the Unix socket edge for the UI bound, and the discovery file
// written last — a client that reads `hub.json` finds a hub that answers. Shutdown runs it backwards: the
// edges close, `hub.json` goes, and the lock is released last, so no successor binds before this hub is gone.
import { mkdirSync } from 'node:fs';
import { Store } from './store.ts';
import { createHub, type Hub } from './server.ts';
import { createSocketEdge, type SocketEdge } from './socket.ts';
import { ensureSkeleton, layout, removeDiscovery, writeDiscovery, type Discovery, type Layout } from '../project.ts';
import { acquireLock, HubLocked } from './lock.ts';
import { VERSION } from '../version.ts';
import { Tracker } from '../tracker/tracker.ts';
import type { LogFn } from '../log.ts';

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
  mkdirSync(l.dir, { recursive: true });
  // before anything is prepared: a second hub must not even write the secret
  let lock;
  try {
    lock = acquireLock(l.lock);
  } catch (err) {
    if (err instanceof HubLocked) throw new Error(`a hub already runs for ${root} (pid ${err.holder.pid} holds ${l.lock})`);
    throw err;
  }
  let secret: string;
  try {
    secret = ensureSkeleton(l);
  } catch (err) {
    lock.release();
    throw err;
  }

  const startedAt = new Date();
  // the tracker's index lives in the same file, in tables of its own; it is rebuilt from the item files here
  const tracker = new Tracker({ root, db: l.db, log });
  let hub!: Hub;
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
        status: () => ({ pid: process.pid, port: hub.port, socket: l.socket, version: VERSION, root, startedAt: startedAt.toISOString(), uptimeMs: Date.now() - startedAt.getTime() }),
        stop: () => void stop(),
      },
    });
  } catch (err) {
    tracker.stop();
    lock.release();
    throw err;
  }
  let resolveStopped!: () => void;
  const stopped = new Promise<void>((resolve) => (resolveStopped = resolve));
  let stopping: Promise<void> | null = null;
  let edge: SocketEdge | null = null;
  const stop = (): Promise<void> => {
    stopping ??= (async () => {
      log({ event: 'stopping' });
      await edge?.close();
      await hub.close();
      tracker.stop();
      // the discovery file and then the lock go last: a successor can only start once this hub is gone
      removeDiscovery(l.discovery, process.pid);
      lock.release();
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
    lock.release();
    throw err;
  }

  const discovery: Discovery = { socket: l.socket, port: hub.port, secret, pid: process.pid, version: VERSION };
  writeDiscovery(l.discovery, discovery);
  log({ event: 'serving', root, port: hub.port, socket: l.socket, pid: process.pid });
  return { layout: l, discovery, hub, stopped, stop };
}
