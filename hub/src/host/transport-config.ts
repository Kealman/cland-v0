import { parsePoolName } from './pool-name.ts';
import { parseTransportKind } from './transport-kind.ts';

/** Interim validation only: E-1534 owns the rest of the hosts table. */
export function validateHostTransports(hosts: unknown): void {
  if (!hosts || typeof hosts !== 'object' || Array.isArray(hosts)) return;
  for (const [pool, value] of Object.entries(hosts)) {
    if (pool === 'harnesses') continue;
    parsePoolName(pool);
    if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.hasOwn(value, 'transport')) continue;
    try { parseTransportKind((value as Record<string, unknown>).transport); }
    catch (error) { throw new Error(`hosts.${pool}.transport: ${(error as Error).message}`); }
  }
}

export type HarnessPins = Partial<Record<'claude-code' | 'codex' | 'opencode', string>>;
export type HostPool = { provider: string; size: string; region: string; transport: 'ssh' };
export function readHostPools(hosts: unknown): { pools: Record<string, HostPool>; harnesses: HarnessPins } {
  if (hosts === undefined) return { pools: {}, harnesses: {} };
  if (!hosts || typeof hosts !== 'object' || Array.isArray(hosts)) throw new Error('hosts must be a table');
  const table = hosts as Record<string, unknown>;
  const pins = table.harnesses ?? {};
  if (!pins || typeof pins !== 'object' || Array.isArray(pins) || Object.entries(pins).some(([id, pin]) => !['claude-code', 'codex', 'opencode'].includes(id) || typeof pin !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(pin))) throw new Error('hosts.harnesses requires claude-code, codex or opencode ids with exact x.y.z versions');
  const pools: Record<string, HostPool> = Object.create(null);
  for (const [name, entry] of Object.entries(table)) {
    if (name === 'harnesses') continue;
    parsePoolName(name);
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error(`invalid host pool: ${name}`);
    const value = entry as Record<string, unknown>;
    for (const key of ['provider', 'size', 'region']) if (typeof value[key] !== 'string' || !value[key].trim()) throw new Error(`hosts.${name}.${key} required`);
    const transport = parseTransportKind(value.transport ?? 'ssh');
    if (transport !== 'ssh') throw new Error(`hosts.${name}.transport must be ssh`);
    pools[name] = { provider: value.provider as string, size: value.size as string, region: value.region as string, transport };
  }
  return { pools, harnesses: Object.fromEntries(Object.entries(pins).sort(([a], [b]) => a.localeCompare(b))) as HarnessPins };
}
