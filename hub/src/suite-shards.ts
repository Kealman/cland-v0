// Positive manifest: adding a test requires an explicit resource decision.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { glob, readFile } from 'node:fs/promises';
import { join, matchesGlob } from 'node:path';
import type { SuiteMode, SuiteSelection } from './suite-selection.ts';
import { HUB_SMOKE, NVIM_SMOKE } from './suite-selection.ts';
import { DURATION_MANIFEST, lintDurationManifest, readDurationManifest, type DurationManifest } from './suite-durations.ts';

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
  await lintDurations(cwd);
  const paths = [];
  for await (const path of glob(PATTERNS, { cwd })) paths.push(path);
  const manifest = await readFile(join(cwd, MANIFEST), 'utf8').then(text => JSON.parse(text) as Manifest, () => ({ version: 1, tests: {} }));
  return classify(paths, manifest, path => readFile(join(cwd, path), 'utf8'), smoke);
}

/** Only projects with a manifest opt into hub sharding. Admission also covers dirty test files. */
export async function lintHubShards(cwd: string): Promise<void> {
  await lintDurations(cwd);
  try { await readFile(join(cwd, MANIFEST)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
  await hubShards(cwd);
}

/** Inspect the immutable merge result, including dev-only files, without touching any checkout. */
export async function lintHubShardTree(cwd: string, tree: string, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const exec = promisify(execFile);
  const git = async (args: string[]) => (await exec('git', args, { cwd, env, timeout: 30_000, maxBuffer: 16 * 1024 * 1024 })).stdout;
  const paths = (await git(['ls-tree', '-r', '--name-only', '-z', tree, '--', 'hub/src', 'hub/test'])).split('\0').filter(Boolean);
  const source = (path: string) => git(['show', `${tree}:${path}`]);
  if (paths.includes(DURATION_MANIFEST)) {
    try { lintDurationManifest(JSON.parse(await source(DURATION_MANIFEST)) as DurationManifest); }
    catch (error) { throw new ShardManifestError(error instanceof Error ? error.message : String(error), [DURATION_MANIFEST]); }
  }
  if (!paths.includes(MANIFEST)) return;
  await classify(paths.filter(path => PATTERNS.some(pattern => matchesGlob(path, pattern))), JSON.parse(await source(MANIFEST)) as Manifest, source, false);
}

async function lintDurations(cwd: string): Promise<void> {
  try {
    const manifest = await readDurationManifest(cwd);
    if (manifest) lintDurationManifest(manifest);
  } catch (error) { throw new ShardManifestError(error instanceof Error ? error.message : String(error), [DURATION_MANIFEST]); }
}

export async function packageShards(cwd: string, mode: SuiteMode, selection?: { files: string[]; nvim: boolean }, coverage?: SuiteSelection): Promise<SuiteShard[]> {
  if (selection) {
    const shards = await hubShards(cwd);
    const known = new Set(shards.flatMap(shard => shard.targets));
    for (const file of selection.files) if (!known.has(file)) throw new ShardManifestError(`unknown explicit hub shard file: ${file}`, [file]);
    return [...shards.map(shard => ({ ...shard, targets: shard.targets.filter(file => selection.files.includes(file)) })).filter(shard => shard.targets.length),
      ...(selection.nvim ? [{ name: 'Neovim', targets: ['nvim/test/**/*.test.ts'], resource: 'machine' as const, workers: 4 }] : [])];
  }
  if (mode === 'hub-selected') {
    const shards = await hubShards(cwd);
    const known = new Set(shards.flatMap(shard => shard.targets));
    if (!coverage?.tests?.length) throw new ShardManifestError('selected hub tests missing');
    for (const test of coverage.tests) if (!known.has(test)) throw new ShardManifestError(`unknown selected hub test: ${test}`, [test]);
    return [...shards.map(shard => ({ ...shard, name: `${shard.name} selected`, targets: shard.targets.filter(file => coverage.tests!.includes(file)) })).filter(shard => shard.targets.length),
      { name: coverage.nvimFull ? 'Neovim' : 'Neovim smoke', targets: coverage.nvimFull ? ['nvim/test/**/*.test.ts'] : NVIM_SMOKE, resource: 'machine', workers: 4 }];
  }
  return [...await hubShards(cwd, mode === 'nvim-only'), { name: mode === 'hub-only' ? 'Neovim smoke' : 'Neovim', targets: mode === 'hub-only' ? NVIM_SMOKE : ['nvim/test/**/*.test.ts'], resource: 'machine', workers: 4 }];
}

/** Longest-processing-time placement; ties are stable so a plan is reproducible. */
export function balanceCloseShards(files: string[], durations: DurationManifest['files'], count: number): Array<{ files: string[]; hubSeconds: number; nvim: boolean; seconds: number }> {
  if (!Number.isSafeInteger(count) || count < 1) throw new Error('shard count must be a positive integer');
  const known = Object.values(durations).map(file => file.seconds).sort((a, b) => a - b);
  const median = known.length ? known.length % 2 ? known[Math.floor(known.length / 2)]! : (known[known.length / 2 - 1]! + known[known.length / 2]!) / 2 : 1;
  const weight = (file: string) => durations[file]?.seconds ?? median;
  const shards = Array.from({ length: count }, () => ({ files: [] as string[], hubSeconds: 0, nvim: false, seconds: 0 }));
  const lightest = () => shards.reduce((best, shard) => shard.hubSeconds < best.hubSeconds ? shard : best);
  for (const file of [...files].sort((a, b) => weight(b) - weight(a) || a.localeCompare(b))) {
    const shard = lightest(); shard.files.push(file); shard.hubSeconds += weight(file); shard.seconds = shard.hubSeconds;
  }
  const nvim = lightest(); nvim.nvim = true;
  nvim.seconds += Object.entries(durations).filter(([file]) => file.startsWith('nvim/')).reduce((sum, [, value]) => sum + value.seconds, 0);
  return shards;
}
