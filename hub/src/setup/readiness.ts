import timers from 'node:timers/promises';
import type { RemoteStatusRow, RemoteVia } from '../protocol.ts';
import type { SetupHub } from './hub.ts';

/** Configuration completion can precede native readiness. Reuse the loaded row until it settles. */
export async function waitForRemote(client: SetupHub, messenger: RemoteVia, status: RemoteStatusRow | undefined,
  signal?: AbortSignal): Promise<RemoteStatusRow | undefined> {
  const deadline = Date.now() + 10_000;
  while (client.remotes && status?.token.present && status.connection === 'disconnected' && Date.now() < deadline) {
    await timers.setTimeout(Math.min(50, deadline - Date.now()), undefined, signal ? { signal } : undefined);
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    try {
      // Keep ownership until the bounded native read settles, also on cancellation.
      const next = (await client.remotes(Math.min(3000, remaining))).remotes.find(row => row.messenger === messenger);
      signal?.throwIfAborted();
      if (Date.now() > deadline) break;
      status = next;
    } catch (error) {
      signal?.throwIfAborted();
      if (Date.now() >= deadline) break;
      throw error;
    }
  }
  return status;
}
