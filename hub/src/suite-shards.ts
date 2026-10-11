// Positive manifest: adding a test requires an explicit resource decision.
import { glob, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SuiteMode } from './suite-selection.ts';
import { HUB_SMOKE, NVIM_SMOKE } from './suite-selection.ts';

export type Shard = 'free' | 'machine';
export type SuiteShard = { name: string; targets: string[]; resource: Shard; workers: number };
// Process fixtures use real ports and clocks even when each project directory is private.
// SQL .exec() and promise gates are hermetic; process launches and wall-clock waits are not.
const MACHINE = /node:(?:child_process|net|http|https|dgram|timers)|(?:from\s*|import\s*\()['"][^'"]*(?:harness|process-cleanup)[^'"]*['"]|\b(?:setTimeout|setInterval|sleep|pause|delay)\s*\(|\.listen\s*\(|\/tmp\/cland-suite(?:-nvim)?\.lock\b|\bnvim\b/;

export async function hubShards(cwd: string, smoke = false): Promise<SuiteShard[]> {
  const paths = [];
  for await (const path of glob(['hub/src/**/*.test.ts', 'hub/test/**/*.test.ts'], { cwd })) paths.push(path);
  paths.sort();
  const manifest: { version?: number; tests?: Record<string, unknown> } = await readFile(join(cwd, 'hub/test/shards.json'), 'utf8').then(text => JSON.parse(text) as { version?: number; tests?: Record<string, unknown> }, () => ({ version: 1, tests: {} }));
  if (manifest.version !== 1 || !manifest.tests || typeof manifest.tests !== 'object' || Array.isArray(manifest.tests)) throw new Error('invalid hub shard manifest');
  const groups: Record<Shard, string[]> = { free: [], machine: [] };
  for (const path of paths) {
    const shard = manifest.tests[path];
    if (shard !== 'free' && shard !== 'machine') throw new Error(`unclassified hub test: ${path}`);
    if (shard === 'free' && MACHINE.test(await readFile(join(cwd, path), 'utf8'))) throw new Error(`free hub test touches machine resources: ${path}; classify it as machine`);
    if (!smoke || HUB_SMOKE.includes(path)) groups[shard].push(path);
  }
  for (const path of Object.keys(manifest.tests)) if (!paths.includes(path)) throw new Error(`hub shard manifest names missing test: ${path}`);
  return (['free', 'machine'] as const).filter(resource => groups[resource].length).map(resource => ({ name: `hub ${resource}${smoke ? ' smoke' : ''}`, resource, workers: resource === 'free' ? 1 : 4, targets: groups[resource] }));
}

export async function packageShards(cwd: string, mode: SuiteMode): Promise<SuiteShard[]> {
  return [...await hubShards(cwd, mode === 'nvim-only'), { name: mode === 'hub-only' ? 'Neovim smoke' : 'Neovim', targets: mode === 'hub-only' ? NVIM_SMOKE : ['nvim/test/**/*.test.ts'], resource: 'machine', workers: 4 }];
}
