import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'smol-toml';
import { parseConfig } from '../../init/config.ts';
import { hash, recipeDigest, staleParts, type PrepareKey } from '../../executor/droplet/prepare.ts';
import { durableJson } from '../../executor/droplet/lease.ts';
import { readHostPools, type HarnessPins } from '../transport-config.ts';
import { HostProviderRegistry } from './registry.ts';

// base is deliberately constant: project code is delivered at ready, not baked.
export type PoolImageKey = PrepareKey & { harnesses: HarnessPins };
export type PoolPrepared = { pool: string; state: 'current' | 'prepared'; changed: string[] };
const pending = new Map<string, Promise<PoolPrepared[]>>();
export function preparePools(root: string, pool: string | undefined, env: NodeJS.ProcessEnv): Promise<PoolPrepared[]> {
  // Serialize all pool requests for one project, including overlapping all/single calls.
  const previous = pending.get(root) ?? Promise.resolve([]);
  const work = previous.catch(() => []).then(() => prepare(root, pool, env));
  pending.set(root, work);
  void work.finally(() => { if (pending.get(root) === work) pending.delete(root); }).catch(() => {});
  return work;
}
async function optional(path: string): Promise<Buffer | undefined> {
  try { return await readFile(path); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw e; }
}
async function prepare(root: string, pool: string | undefined, env: NodeJS.ProcessEnv): Promise<PoolPrepared[]> {
  const text = await readFile(join(root, '.cland/config.toml'), 'utf8');
  const { pools, harnesses } = readHostPools(parse(text).hosts);
  const names = Object.keys(pools).sort();
  if (pool !== undefined && !Object.hasOwn(pools, pool)) throw new Error(`unknown pool ${pool}; configured pools: ${names.join(', ') || 'none'}`);
  const provisionPath = parseConfig(text, 'project', env).verification.provision;
  const lock = await optional(join(root, 'package-lock.json'));
  const key: PoolImageKey = { node: process.version, base: 'pool', recipe: await recipeDigest(), ...(lock ? { lock: hash(lock) } : {}), ...(provisionPath ? { provisionPath, provision: hash(await readFile(join(root, provisionPath))) } : {}), harnesses };
  const registry = new HostProviderRegistry({ env });
  const results: PoolPrepared[] = [];
  for (const name of pool === undefined ? names : [pool]) {
    const path = join(root, '.cland/run/hosts', name + '-image.json');
    const old = await optional(path);
    const record = old ? JSON.parse(old.toString()) as { key: PoolImageKey } : null;
    const changed = record ? [...staleParts(record, key), ...(JSON.stringify(record.key.harnesses) === JSON.stringify(harnesses) ? [] : ['harnesses'])] : ['node', 'lock', 'recipe', 'provision', 'harnesses'].filter(part => Object.hasOwn(key, part));
    const result = await registry.resolve(pools[name]!).prepare({ pool: name, key });
    if (result.state === 'failed') throw new Error(`${name}: ${result.reason}`);
    await mkdir(join(root, '.cland/run/hosts'), { recursive: true, mode: 0o700 });
    await durableJson(path, { key });
    results.push({ pool: name, state: result.state, changed });
  }
  return results;
}
