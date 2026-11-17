import { parsePoolName } from './pool-name.ts';
import { parseTransportKind, type TransportKind } from './transport-kind.ts';
import { durationMs } from '../duration.ts';

export const POOL_KEYS = ['provider', 'size', 'region', 'transport', 'slots', 'min_hosts', 'max_hosts', 'idle_stop', 'spread'] as const;
export type HarnessPins = Partial<Record<'claude-code' | 'codex' | 'opencode', string>>;
export type HostPool = { provider: string; size: string; region: string; transport: TransportKind; slots: number; minHosts: number; maxHosts: number; idleStop: string; idleStopMs: number; spread: boolean };
export type HostPools = { pools: Record<string, HostPool>; harnesses: HarnessPins; dailySpendUsd: number; lease: string; leaseMs: number; relaunchAfterSignIn: boolean; weights?: Record<string, number> };
const GLOBAL_KEYS = ['harnesses', 'daily_spend_usd', 'lease', 'weights', 'relaunch_after_signin'];
const SIZE_SLOTS: Record<string, number> = { 's-2vcpu-4gb': 4, 's-4vcpu-8gb': 8 };
function table(value: unknown, key: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value instanceof Date) throw new Error(`${key} must be a table`);
  return value as Record<string, unknown>;
}
function text(value: unknown, key: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${key} requires a nonempty string`);
  return value;
}
function number(value: unknown, key: string, zero = false, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || (zero ? value < 0 : value <= 0) || (integer && !Number.isSafeInteger(value))) throw new Error(`${key} requires a ${zero ? 'nonnegative' : 'positive'} ${integer ? 'integer' : 'number'}`);
  return value;
}
function duration(value: unknown, key: string): [string, number] {
  try { const source = text(value, key); return [source, durationMs(source)]; }
  catch (error) { throw new Error(`${key}: ${(error as Error).message}`); }
}
export class HostConfigurationError extends Error {}

export function readHostPools(hosts: unknown): HostPools {
  try { return parseHostPools(hosts); }
  catch (error) { throw new HostConfigurationError((error as Error).message, { cause: error }); }
}

/** Whole-table parser shared by project loading, settings writes and provider callers. */
function parseHostPools(hosts: unknown): HostPools {
  const source = hosts === undefined ? {} : table(hosts, 'hosts');
  const relaunchAfterSignIn = source.relaunch_after_signin === undefined ? false : source.relaunch_after_signin;
  if (typeof relaunchAfterSignIn !== 'boolean') throw new Error('hosts.relaunch_after_signin must be a boolean');
  const dailySpendUsd = number(source.daily_spend_usd ?? 3, 'hosts.daily_spend_usd', true);
  const [lease, leaseMs] = duration(source.lease ?? '12h', 'hosts.lease');
  if (leaseMs < 30000) throw new Error('hosts.lease must be at least 30s');
  const pins = table(source.harnesses ?? {}, 'hosts.harnesses');
  if (Object.entries(pins).some(([id, pin]) => !['claude-code', 'codex', 'opencode'].includes(id) || typeof pin !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(pin))) throw new Error('hosts.harnesses requires claude-code, codex or opencode ids with exact x.y.z versions');
  const weights = source.weights === undefined ? undefined : Object.fromEntries(Object.entries(table(source.weights, 'hosts.weights')).map(([id, value]) => {
    if (!['claude-code', 'codex', 'opencode'].includes(id)) throw new Error(`hosts.weights.${id}: expected claude-code, codex or opencode`);
    return [id, number(value, `hosts.weights.${id}`)];
  }));
  const pools: Record<string, HostPool> = Object.create(null);
  for (const [name, entry] of Object.entries(source)) {
    if (GLOBAL_KEYS.includes(name)) continue;
    parsePoolName(name);
    const value = table(entry, `hosts.${name}`), key = `hosts.${name}`;
    const provider = text(value.provider, `${key}.provider`);
    const size = text(value.size ?? 's-4vcpu-8gb', `${key}.size`);
    const region = text(value.region ?? 'lon1', `${key}.region`);
    let transport: TransportKind;
    try { transport = parseTransportKind(value.transport ?? 'ssh'); }
    catch (error) { throw new Error(`${key}.transport: ${(error as Error).message}`); }
    const slots = number(value.slots ?? (Object.hasOwn(SIZE_SLOTS, size) ? SIZE_SLOTS[size] : undefined), `${key}.slots`);
    const minHosts = number(value.min_hosts ?? (name === 'agents' ? 1 : 0), `${key}.min_hosts`, true, true);
    const maxHosts = number(value.max_hosts ?? 2, `${key}.max_hosts`, true, true);
    if (minHosts > maxHosts) throw new Error(`${key}.min_hosts must not exceed ${key}.max_hosts`);
    const [idleStop, idleStopMs] = duration(value.idle_stop ?? '20m', `${key}.idle_stop`);
    const spread = value.spread ?? false;
    if (typeof spread !== 'boolean') throw new Error(`${key}.spread must be a boolean`);
    pools[name] = { provider, size, region, transport, slots, minHosts, maxHosts, idleStop, idleStopMs, spread };
  }
  return { pools, relaunchAfterSignIn, harnesses: Object.fromEntries(Object.entries(pins).sort(([a], [b]) => a.localeCompare(b))) as HarnessPins, dailySpendUsd, lease, leaseMs, ...(weights === undefined ? {} : { weights }) };
}

export function hostPoolsDocument(hosts: HostPools): Record<string, unknown> {
  return { ...(hosts.relaunchAfterSignIn ? { relaunch_after_signin: true } : {}), daily_spend_usd: hosts.dailySpendUsd, lease: hosts.lease,
    ...(Object.keys(hosts.harnesses).length ? { harnesses: hosts.harnesses } : {}),
    ...(hosts.weights === undefined ? {} : { weights: hosts.weights }),
    ...Object.fromEntries(Object.entries(hosts.pools).map(([name, p]) => [name, { provider: p.provider, size: p.size, region: p.region, transport: p.transport, slots: p.slots, min_hosts: p.minHosts, max_hosts: p.maxHosts, idle_stop: p.idleStop, spread: p.spread }])) };
}

/** Shared default selection for provisioning and its result observer. */
export function selectHostPool(pools: Readonly<Record<string, unknown>>, requested?: string): string | undefined {
  const names=Object.keys(pools).sort();
  return requested??(names.includes('agents')?'agents':names.length===1?names[0]:undefined);
}
