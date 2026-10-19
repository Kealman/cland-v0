// Typed CLI convenience API over the shared read-only transport.
import { askHubFrame, probeHub } from '../../../shared/socket-client.ts';
export { askHubFrame, HubTimeout } from '../../../shared/socket-client.ts';
import type { Discovery } from '../project.ts';
import type { ClientRequest } from '../protocol.ts';

/** One request over the socket; rejects on a refusal, an error result, a closed socket or the timeout. */
export function askHub(d: Pick<Discovery, 'socket' | 'secret'>, type: ClientRequest['type'], timeoutMs = 3000): Promise<unknown> {
  return askHubFrame(d, { type }, timeoutMs);
}

/** Authenticated liveness, independent of full status collection and its payload. */
export async function probe(d: Pick<Discovery, 'socket' | 'secret'>, timeoutMs?: number): Promise<boolean> {
  try {
    await probeHub(d, timeoutMs);
    return true;
  } catch {
    return false;
  }
}
