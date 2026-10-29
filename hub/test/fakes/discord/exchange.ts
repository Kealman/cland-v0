import { mkdtemp, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Clock } from '../../../src/hub/clock.ts';
import type { TestContext } from 'node:test';
import { DiscordApi } from '../../../src/remote/discord-api.ts';
import { within } from '../../../src/executor/droplet/deadline.ts';
import { onCleanup, beforeDirectories, ownDirectory } from '../../process-cleanup.ts';
import { discordFixtureOwner, DISCORD_TEST_TOKEN } from './fake-api.ts';

/** Native operation bounds stay live while the injected scheduling clock is frozen. */
export function discordExchangeOwner(t: TestContext, options: Parameters<typeof discordFixtureOwner>[1] & { timeoutMs?: number; drainClock?: Clock } = {}) {
  const abort = new AbortController();
  const pending = new Set<Promise<unknown>>();
  const stops: Array<() => void | Promise<void>> = [];
  const drained: Array<() => void> = [];
  const drainReceipts: Array<{ phase: 'stop' | 'fake' | 'native'; elapsedMs: number; outcome: 'complete' | 'incomplete' }> = [];
  const measure = async (phase: 'stop' | 'fake' | 'native', action: () => Promise<unknown>) => {
    const started = performance.now();
    let outcome: 'complete' | 'incomplete' = 'incomplete';
    try { await action(); outcome = 'complete'; }
    finally { drainReceipts.push({ phase, elapsedMs: performance.now() - started, outcome }); }
  };
  let closing: Promise<void> | undefined;
  let fixture: ReturnType<typeof discordFixtureOwner> | undefined;
  const close = (): Promise<void> => {
    if (closing) return closing;
    const attempt = (async () => {
      abort.abort(new Error('Discord exchange disposed: aborted'));
      const results = await Promise.allSettled([
        measure('stop', () => within(Promise.all(stops.map(stop => Promise.resolve().then(stop))), 2000, options.drainClock, () => new Error('Discord exchange stop incomplete'))),
        measure('fake', async () => { await fixture?.close(); }),
        measure('native', () => within((async () => { while (pending.size) await Promise.allSettled([...pending]); })(), 2000, options.drainClock, () => new Error('Discord exchange native drainage incomplete'))),
      ]);
      const failures = results.filter(r => r.status === 'rejected').map(r => r.reason);
      if (failures.length) throw new AggregateError(failures, `Discord exchange disposal incomplete: ${JSON.stringify(drainReceipts)}`);
      for (const finish of drained) finish();
    })();
    closing = attempt;
    // An incomplete owner retains its root; after real settlement the same barrier retries.
    void attempt.catch(() => { if (closing === attempt) closing = undefined; });
    return attempt;
  };
  const project = async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), 'cland-discord-exchange-')));
    const remove = ownDirectory(t, root, { beforeRemove: close });
    return { root, remove };
  };
  // Owner precedes acquisition, observers, controls, native requests and root cleanup.
  onCleanup(t, close);
  beforeDirectories(t, close);
  fixture = discordFixtureOwner(t, { ...options, signal: options.signal ? AbortSignal.any([abort.signal, options.signal]) : abort.signal });
  const run = <T>(action: (signal: AbortSignal) => Promise<T>): Promise<T> => {
    const native = Promise.resolve().then(() => { abort.signal.throwIfAborted(); return action(abort.signal); });
    pending.add(native); void native.catch(() => {});
    void native.finally(() => pending.delete(native)).catch(() => {});
    const timeout = new Error('Discord exchange operation incomplete');
    const bounded = within(native, 2000, undefined, () => timeout)
      .catch(async error => { if (error === timeout) await close(); throw error; });
    void bounded.catch(() => {});
    return bounded;
  };
  const start = async () => {
    const fake = await run(() => fixture!.start());
    const client = new DiscordApi(DISCORD_TEST_TOKEN, { apiRoot: fake.url, ...(options.clock ? { clock: options.clock } : {}), ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}) });
    const optionAt: Record<string, number> = { getCurrentApplication: 0, getGatewayBot: 0, getChannel: 1, getMessage: 2, listMessages: 2,
      createMessage: 2, editMessage: 3, addReaction: 3, callback: 3, update: 3, modal: 3, defer: 2, editOriginal: 3, followup: 3, listCommands: 1, putCommands: 2 };
    // Only the public client seam is wrapped; each operation is owned before it starts.
    const api = new Proxy(client, { get(target, key) {
      const value = Reflect.get(target, key);
      if (typeof value !== 'function') return value;
      const index = optionAt[String(key)];
      if (index === undefined) return value.bind(target);
      return (...args: unknown[]) => run(signal => {
        const supplied = args[index] as { signal?: AbortSignal } | undefined;
        args[index] = { ...supplied, signal: supplied?.signal ? AbortSignal.any([signal, supplied.signal]) : signal };
        return value.apply(target, args);
      });
    } });
    return { fake, api, run, project, signal: abort.signal, close, stop: (action: () => void | Promise<void>) => stops.push(action),
      afterDrain: (action: () => void) => drained.push(action), pending: () => pending.size };
  };
  return { start, close, run, project, drainReceipts: () => drainReceipts.map(receipt => ({ ...receipt })), receipts: () => fixture!.receipts(), listening: () => run(() => fixture!.listening()), pending: () => pending.size };
}
