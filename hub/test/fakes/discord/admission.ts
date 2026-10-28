import { EventEmitter } from 'node:events';
import type { TestContext } from 'node:test';
import type { Clock } from '../../../src/hub/clock.ts';
import { abortable, within } from '../../../src/executor/droplet/deadline.ts';
import { beforeDirectories, onCleanup } from '../../process-cleanup.ts';

type Scheduled = { connection: number; delay: number };
/** Pre-armed client diagnostic observer; no replay from timestamps or status. */
export function discordAdmissionObserver(t: TestContext, options: { setupClock?: Clock; publish?: boolean } = {}) {
  const events = new EventEmitter(); const lifetime = new AbortController();
  const pending = new Set<Promise<Scheduled>>();
  const close = async () => {
    lifetime.abort(new Error('Discord admission observation aborted'));
    await Promise.allSettled([...pending]);
  };
  onCleanup(t, close); beforeDirectories(t, close);
  return {
    log(entry: Record<string, unknown>) {
      if (options.publish !== false && entry.event === 'discord-identify-scheduled') events.emit('scheduled', entry);
    },
    observe(connection: number, signal?: AbortSignal): Promise<Scheduled> {
      const found = Promise.withResolvers<Scheduled>();
      const receive = (entry: Scheduled) => { if (entry.connection === connection) found.resolve(entry); };
      events.on('scheduled', receive);
      const observed = within(abortable(found.promise, AbortSignal.any([t.signal, lifetime.signal, ...(signal ? [signal] : [])])),
        2000, options.setupClock, () => new Error('Discord Identify admission receipt deadline reached'))
        .finally(() => { events.off('scheduled', receive); pending.delete(observed); });
      pending.add(observed); void observed.catch(() => {});
      return observed;
    },
    pending: () => pending.size,
    listeners: () => events.listenerCount('scheduled'),
    close,
  };
}
