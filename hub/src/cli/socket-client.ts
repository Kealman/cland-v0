// Typed CLI convenience API over the shared read-only transport.
import { askHubFrame } from '../../../shared/socket-client.ts';
export { askHubFrame, HubTimeout } from '../../../shared/socket-client.ts';
import type { Discovery } from '../project.ts';
import type { ClientRequest, HubStatus } from '../protocol.ts';

/** One request over the socket; rejects on a refusal, an error result, a closed socket or the timeout. */
export function askHub(d: Pick<Discovery, 'socket' | 'secret'>, type: ClientRequest['type'], timeoutMs = 3000): Promise<unknown> {
  return askHubFrame(d, { type }, timeoutMs);
}

/** The hub's status, or null when nothing answers on the socket. */
export async function probe(d: Pick<Discovery, 'socket' | 'secret'>, timeoutMs?: number): Promise<HubStatus | null> {
  try {
    return (await askHub(d, 'hub.status', timeoutMs)) as HubStatus;
  } catch {
    return null;
  }
}
