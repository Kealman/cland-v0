import assert from 'node:assert/strict';
import { Store } from '../src/hub/store.ts';
import { TelegramApi, type TgUpdate } from '../src/remote/telegram-api.ts';
import { TelegramRemote } from '../src/remote/telegram.ts';
import type { Remote } from '../src/remote/gateway.ts';
import { telegramControl, TELEGRAM_TEST_TOKEN } from './fakes/telegram/fake-api.ts';
import { FakeClock } from './fake-clock.ts';

export const pairing = { userId: '101', chatId: '101', guildId: null, name: 'Fixture human' };
export async function control<T>(url: string, op: string, params?: object): Promise<T> {
  const response = await telegramControl<T>(url, op, params);
  assert.equal(response.status, 200);
  return response.body;
}

// The next item owns the mirror handler. This fixture uses the real frame port
// and resolves only on topic.send's durable result, never on submission.
export function nativeRemote(store: Store, url: string, clock: FakeClock) {
  const state = store.remotes.forMessenger('telegram');
  let send: (frame: Record<string, unknown>) => void;
  let next = 0;
  const pending = new Map<string, { resolve: () => void; reject: (error: Error) => void }>();
  const handled: number[] = [];
  const remote = new TelegramRemote(new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: url, clock }), clock, {
    store: state,
    handlers: [{ accepts: () => true, handle: async (update: TgUpdate, signal) => {
      const id = `poll-test-${++next}`;
      const stored = new Promise<void>((resolve, reject) => pending.set(id, { resolve, reject }));
      send({ type: 'topic.send', id, topic: 'general', text: update.message?.text ?? 'accepted update' });
      const abort = () => { pending.get(id)?.reject(new Error('fixture handler cancelled')); pending.delete(id); };
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
      try { await stored; handled.push(update.update_id); }
      finally { signal.removeEventListener('abort', abort); pending.delete(id); }
    } }],
  });
  const gateway: Remote = {
    id: remote.id, via: remote.via,
    start: (port, pair, signal) => { send = port; return remote.start(port, pair, signal); },
    receive: frame => {
      if (frame.type !== 'result') return;
      const waiting = pending.get(frame.id);
      pending.delete(frame.id);
      if (frame.ok) waiting?.resolve(); else waiting?.reject(new Error(frame.error));
    },
    run: () => remote.run(), stop: () => remote.stop(), status: () => remote.status(),
  };
  return { gateway, handled, state };
}

