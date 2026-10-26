import { createServer, type Socket } from 'node:net';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { beforeDirectories } from '../process-cleanup.ts';
import { abortable, within } from '../../src/executor/droplet/deadline.ts';
import { realClock, type Clock } from '../../src/hub/clock.ts';

type Options = { clock?: Clock; signal?: AbortSignal; publishListening?: boolean };

/** Own native receipts before listen, including failed or abandoned setup. */
export function legacyRemoteHubFixture(t: TestContext, root: string, options: Options = {}) {
  const socket = join(root, 'legacy.sock');
  const peers = new Map<Socket, Promise<void>>();
  const requests: string[] = [];
  const writes = new Set<Promise<unknown>>();
  const nativeListening = Promise.withResolvers<void>();
  const listening = Promise.withResolvers<void>();
  const closed = Promise.withResolvers<void>();
  const lifetime = new AbortController();
  let didListen = false, didClose = false, invoked = false;
  let disposing: Promise<void> | undefined;
  let starting: Promise<{ requests: string[] }> | undefined;
  const server = createServer(peer => {
    const receipt = Promise.withResolvers<void>();
    peers.set(peer, receipt.promise);
    peer.once('close', () => { peers.delete(peer); receipt.resolve(); });
    peer.on('error', () => { peer.destroy(); });
    peer.setEncoding('utf8');
    let pending = '';
    if (lifetime.signal.aborted) { peer.destroy(); return; }
    peer.on('data', chunk => {
      pending += chunk;
      for (let end; (end = pending.indexOf('\n')) >= 0;) {
        let frame: { type: string; id?: string };
        try { frame = JSON.parse(pending.slice(0, end)); }
        catch { peer.destroy(); return; }
        pending = pending.slice(end + 1);
        if (frame.type === 'hello') peer.write(JSON.stringify({ type: 'welcome', name: 'cli', presence: [] }) + '\n');
        else {
          requests.push(frame.type);
          peer.write(JSON.stringify(frame.type === 'pairing.approve'
            ? { type: 'result', id: frame.id, ok: true, value: { pairing: { userId: '12345', chatId: '23456', guildId: null, name: 'Old hub human' } } }
            : { type: 'result', id: frame.id, ok: false, error: 'invalid request' }) + '\n');
        }
      }
    });
  });
  // These observers outlive setup: abort can race a native listening event.
  server.once('listening', () => {
    didListen = true; nativeListening.resolve();
    if (options.publishListening !== false) listening.resolve();
  });
  server.once('close', () => { didClose = true; closed.resolve(); });
  server.on('error', error => { listening.reject(new Error(`legacy hub listen failed: ${(error as NodeJS.ErrnoException).code ?? 'unknown'}`)); });
  void listening.promise.catch(() => {});
  const dispose = () => disposing ??= (async () => {
    lifetime.abort(new Error('legacy hub fixture disposed'));
    const peerReceipts = [...peers.values()];
    for (const peer of peers.keys()) peer.destroy();
    let closing: Promise<void> = Promise.resolve();
    if (invoked && !didClose) {
      server.close(error => {
        // A refused bind owns no listener. This is a native close callback,
        // separate from the positive close event required after a successful bind.
        if (error && (error as NodeJS.ErrnoException).code === 'ERR_SERVER_NOT_RUNNING' && !didListen) closed.resolve();
      });
      closing = within(closed.promise, 1000, realClock, () => new Error('legacy hub close receipt incomplete after 1000 ms'));
    }
    const results = await Promise.allSettled([closing,
      within(Promise.all(peerReceipts), 1000, realClock, () => new Error('legacy hub peer close incomplete after 1000 ms')),
      within(Promise.allSettled([...writes]), 1000, realClock, () => new Error('legacy hub write drainage incomplete after 1000 ms')),
    ]);
    const failures = results.filter(result => result.status === 'rejected').map(result => result.reason);
    if (failures.length) throw new AggregateError(failures, 'legacy hub disposal incomplete');
  })();
  beforeDirectories(t, dispose);
  const start = () => starting ??= (async () => {
    const signal = AbortSignal.any([t.signal, lifetime.signal, ...(options.signal ? [options.signal] : [])]);
    try {
      signal.throwIfAborted();
      const ready = within(abortable(listening.promise, signal), 1000, options.clock ?? realClock,
        () => new Error('legacy hub listening receipt deadline reached'));
      void ready.catch(() => {});
      invoked = true;
      server.listen({ path: socket, signal: lifetime.signal });
      await ready;
      signal.throwIfAborted();
      const writing = (async () => {
        await mkdir(join(root, '.cland'), { recursive: true });
        signal.throwIfAborted();
        await writeFile(join(root, '.cland/hub.json'), JSON.stringify({ root, socket, port: 0, secret: 'fixture', pid: process.pid, version: 'test' }));
      })();
      writes.add(writing);
      try { await writing; } finally { writes.delete(writing); }
      signal.throwIfAborted();
      return { requests };
    } catch (error) { await dispose(); throw error; }
  })();
  return { start, dispose, listening: () => nativeListening.promise,
    receipts: () => ({ listening: didListen, closed: didClose, peers: peers.size, writers: writes.size }) };
}

/** Previous wire shape: approval exists; dedicated remote management frames do not. */
export async function legacyRemoteHub(t: TestContext, root: string) {
  return legacyRemoteHubFixture(t, root).start();
}
