import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { once } from 'node:events';
import { get, type ClientRequest, type IncomingMessage } from 'node:http';
import { WebSocket } from 'ws';
import { frameClient, type FrameClient } from './harness.ts';
import { onCleanup } from './process-cleanup.ts';
import { abortable, within } from '../src/executor/droplet/deadline.ts';
import type { Clock } from '../src/hub/clock.ts';
import { testSetupWaitMs } from './until.ts';

/** Register before the hub owner: even failed setup drains before SQLite/root disposal. */
export function cardWebOwner(t: TestContext) {
  const abort = new AbortController();
  const requests = new Set<ClientRequest>();
  const responses = new Set<IncomingMessage>();
  const sockets = new Set<WebSocket>();
  const pending = new Set<Promise<unknown>>();
  const closed = { requests: 0, responses: 0, sockets: 0 };
  const started = { requests: 0, responses: 0, sockets: 0 };
  const httpStarted = Promise.withResolvers<void>();
  const socketStarted = Promise.withResolvers<void>();
  const nativeSocketClosed = Promise.withResolvers<void>();
  const actual = Promise.withResolvers<FrameClient>();
  void actual.promise.catch(() => {});
  let joined = false;
  let observing = false;
  let disposing: Promise<void> | undefined;
  const own = <T>(work: Promise<T>): Promise<T> => {
    pending.add(work);
    void work.then(() => pending.delete(work), () => pending.delete(work));
    return work;
  };
  const stopNative = () => {
    for (const request of requests) request.destroy();
    for (const response of responses) response.destroy();
    for (const socket of sockets) if (socket.readyState !== WebSocket.CLOSED) socket.terminate();
  };
  const dispose = () => disposing ??= (async () => {
    abort.abort(new Error('card web setup cancelled'));
    stopNative();
    await within((async () => {
      while (pending.size) await Promise.allSettled([...pending]);
    })(), 2_000, undefined, () => new Error('card web native close/setup drain deadline reached'));
    joined = true;
  })();
  onCleanup(t, dispose);
  return {
    dispose,
    httpStarted: httpStarted.promise,
    socketStarted: socketStarted.promise,
    socketClosed: nativeSocketClosed.promise,
    actual: () => within(actual.promise, testSetupWaitMs()),
    receipts: () => ({ started: { ...started }, closed: { ...closed }, joined, observing, pending: pending.size }),
    start: async (local: FrameClient, options: { signal?: AbortSignal; setupClock?: Clock; setupTimeoutMs?: number; publishReady?: boolean; closeReceipt?: Promise<void> } = {}) => {
      assert.equal(started.requests, 0, 'one web acquisition per owner');
      const signal = AbortSignal.any([abort.signal, t.signal, ...(options.signal ? [options.signal] : [])]);
      const prerequisite = async <T>(what: string, receive: (timeoutMs: number) => Promise<T>): Promise<T> => {
        try { return await receive(testSetupWaitMs()); }
        catch (cause) {
          signal.throwIfAborted();
          throw new Error(`${what} receipt failed`, { cause });
        }
      };
      const ready = Promise.withResolvers<FrameClient>();
      // Arm the independent setup observer before starting any native work.
      observing = true;
      // Real socket setup tolerates worker load; fake-clock fault bounds stay exact.
      const observed = own(within(abortable(ready.promise, signal), testSetupWaitMs(options.setupClock, options.setupTimeoutMs), options.setupClock,
        () => new Error('card web setup receipt deadline reached')).finally(() => { observing = false; }));
      signal.addEventListener('abort', stopNative, { once: true });
      const native = own(Promise.resolve().then(async () => {
        signal.throwIfAborted();
        // Prerequisite receipts tolerate worker load; teardown cancels their timers.
        const link = await prerequisite('card web web.link result', timeoutMs => local.request({ type: 'web.link' }, timeoutMs, signal));
        assert.equal(link.ok, true, link.error);
        signal.throwIfAborted();
        const { url } = link.value as { url: string };
        const cookie = await new Promise<string>((resolve, reject) => {
          const request = get(url, { agent: false }, response => {
            responses.add(response); started.responses++;
            own(new Promise<void>(done => response.once('close', () => {
              responses.delete(response); closed.responses++; done();
            })));
            response.on('error', reject);
            response.on('end', () => resolve(response.headers['set-cookie']![0]!.split(';')[0]!));
            if (signal.aborted) response.destroy(); else response.resume();
          });
          requests.add(request); started.requests++;
          own(new Promise<void>(done => request.once('close', () => {
            requests.delete(request); closed.requests++; done();
          })));
          request.on('error', reject);
          request.on('close', () => { if (signal.aborted) reject(signal.reason); });
          httpStarted.resolve();
          if (signal.aborted) request.destroy();
        });
        signal.throwIfAborted();
        const origin = new URL(url).origin;
        const socket = new WebSocket(`${origin.replace('http:', 'ws:')}/ws`, { origin, headers: { Cookie: cookie } });
        sockets.add(socket); started.sockets++;
        own(new Promise<void>((done, reject) => socket.once('close', () => {
          nativeSocketClosed.resolve();
          void Promise.resolve(options.closeReceipt).then(() => {
            sockets.delete(socket); closed.sockets++; done();
          }, reject);
        })));
        socket.on('error', () => {});
        const opened = own(once(socket, 'open', { signal }));
        const client = frameClient(line => socket.send(line.trim()), fn => socket.on('message', data => fn(`${data.toString()}\n`)), () => socket.terminate());
        socketStarted.resolve();
        await opened;
        signal.throwIfAborted();
        const welcome = own(prerequisite('card web human welcome', timeoutMs => client.waitFor(frame => frame.type === 'welcome', timeoutMs, signal)));
        client.send({ type: 'hello', protocol: 2, client: 'human' });
        assert.equal((await abortable(welcome, signal)).name, 'human');
        return client;
      }));
      void native.then(client => {
        actual.resolve(client);
        if (options.publishReady !== false) ready.resolve(client);
      }, error => { actual.reject(error); ready.reject(error); });
      try { return await observed; }
      catch (error) { await dispose(); throw error; }
    },
  };
}
