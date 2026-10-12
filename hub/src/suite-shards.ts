// Positive manifest: adding a test requires an explicit resource decision.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { glob, readFile } from 'node:fs/promises';
import { join, matchesGlob } from 'node:path';
import type { SuiteMode } from './suite-selection.ts';
import { HUB_SMOKE, NVIM_SMOKE } from './suite-selection.ts';

export type Shard = 'free' | 'machine';
export type SuiteShard = { name: string; targets: string[]; resource: Shard; workers: number };
// Process fixtures use real ports and clocks even when each project directory is private.
// SQL .exec() and promise gates are hermetic; process launches and wall-clock waits are not.
const MACHINE = /node:(?:child_process|net|http|https|dgram|timers)|(?:from\s*|import\s*\()['"][^'"]*(?:harness|process-cleanup)[^'"]*['"]|\b(?:setTimeout|setInterval|sleep|pause|delay)\s*\(|\.listen\s*\(|\/tmp\/cland-suite(?:-nvim)?\.lock\b|\bnvim\b/;

const PATTERNS = ['hub/src/**/*.test.ts', 'hub/test/**/*.test.ts'];
const MANIFEST = 'hub/test/shards.json';
type Manifest = { version?: number; tests?: Record<string, unknown> };
export class ShardManifestError extends Error {
  readonly files: string[];
  constructor(message: string, files: string[] = []) { super(message); this.files = files; }
}

async function classify(paths: string[], manifest: Manifest, source: (path: string) => Promise<string>, smoke: boolean): Promise<SuiteShard[]> {
  paths.sort();
  if (manifest.version !== 1 || !manifest.tests || typeof manifest.tests !== 'object' || Array.isArray(manifest.tests)) throw new ShardManifestError('invalid hub shard manifest');
  const tests = manifest.tests;
  const unclassified = paths.filter(path => tests[path] !== 'free' && tests[path] !== 'machine');
  if (unclassified.length) throw new ShardManifestError(`unclassified hub tests: ${unclassified.join(', ')}; add explicit classifications to ${MANIFEST} (machine is the conservative choice):\n${unclassified.map(path => `    ${JSON.stringify(path)}: "machine",`).join('\n')}`, unclassified);
  const groups: Record<Shard, string[]> = { free: [], machine: [] };
  for (const path of paths) {
    const shard = tests[path] === 'free' ? 'free' : 'machine';
    if (shard === 'free' && MACHINE.test(await source(path))) throw new ShardManifestError(`free hub test touches machine resources: ${path}; classify it as machine`, [path]);
    if (!smoke || HUB_SMOKE.includes(path)) groups[shard].push(path);
  }
  for (const path of Object.keys(tests)) if (!paths.includes(path)) throw new ShardManifestError(`hub shard manifest names missing test: ${path}`, [path]);
  return (['free', 'machine'] as const).filter(resource => groups[resource].length).map(resource => ({ name: `hub ${resource}${smoke ? ' smoke' : ''}`, resource, workers: resource === 'free' ? 1 : 4, targets: groups[resource] }));
}

export async function hubShards(cwd: string, smoke = false): Promise<SuiteShard[]> {
  const paths = [];
  for await (const path of glob(PATTERNS, { cwd })) paths.push(path);
  const manifest = await readFile(join(cwd, MANIFEST), 'utf8').then(text => JSON.parse(text) as Manifest, () => ({ version: 1, tests: {} }));
  return classify(paths, manifest, path => readFile(join(cwd, path), 'utf8'), smoke);
}

/** Only projects with a manifest opt into hub sharding. Admission also covers dirty test files. */
export async function lintHubShards(cwd: string): Promise<void> {
  try { await readFile(join(cwd, MANIFEST)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
  await hubShards(cwd);
}

/** Inspect the immutable merge result, including dev-only files, without touching any checkout. */
export async function lintHubShardTree(cwd: string, tree: string): Promise<void> {
  const exec = promisify(execFile);
  const git = async (args: string[]) => (await exec('git', args, { cwd, timeout: 30_000, maxBuffer: 16 * 1024 * 1024 })).stdout;
  const paths = (await git(['ls-tree', '-r', '--name-only', '-z', tree, '--', 'hub/src', 'hub/test'])).split('\0').filter(Boolean);
  if (!paths.includes(MANIFEST)) return;
  const source = (path: string) => git(['show', `${tree}:${path}`]);
  await classify(paths.filter(path => PATTERNS.some(pattern => matchesGlob(path, pattern))), JSON.parse(await source(MANIFEST)) as Manifest, source, false);
}

export async function packageShards(cwd: string, mode: SuiteMode): Promise<SuiteShard[]> {
  return [...await hubShards(cwd, mode === 'nvim-only'), { name: mode === 'hub-only' ? 'Neovim smoke' : 'Neovim', targets: mode === 'hub-only' ? NVIM_SMOKE : ['nvim/test/**/*.test.ts'], resource: 'machine', workers: 4 }];
}
