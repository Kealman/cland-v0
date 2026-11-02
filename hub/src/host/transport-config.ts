import { parseTransportKind } from './transport-kind.ts';

/** Interim validation only: E-1534 owns the rest of the hosts table. */
export function validateHostTransports(hosts: unknown): void {
  if (!hosts || typeof hosts !== 'object' || Array.isArray(hosts)) return;
  for (const [pool, value] of Object.entries(hosts)) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.hasOwn(value, 'transport')) continue;
    try { parseTransportKind((value as Record<string, unknown>).transport); }
    catch (error) { throw new Error(`hosts.${pool}.transport: ${(error as Error).message}`); }
  }
}
