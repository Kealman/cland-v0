import type { TestContext } from 'node:test';
import { within } from '../src/executor/droplet/deadline.ts';
import { onCleanup } from './process-cleanup.ts';

/** Hold the owned handler after a successful native reply, before it can finish. */
export function nativeReplyHold(t: TestContext) {
  const entered = Promise.withResolvers<void>(), released = Promise.withResolvers<void>();
  onCleanup(t, () => released.resolve());
  return {
    entered: () => within(entered.promise, 1500),
    release: () => released.resolve(),
    pause: async () => { entered.resolve(); await within(released.promise, 1500); },
  };
}
