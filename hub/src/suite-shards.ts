// Positive manifest: adding a test requires an explicit tier decision.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { glob, readFile } from 'node:fs/promises';
import { join, matchesGlob } from 'node:path';
import { suiteLimits } from './suite-limits.ts';
import type { SuiteMode, SuiteSelection } from './suite-selection.ts';
import { HUB_SMOKE, NVIM_SMOKE } from './suite-selection.ts';
import { DURATION_MANIFEST, durationOwners, lintDurationManifest, readDurationManifest, type DurationManifest } from './suite-durations.ts';
import { QUARANTINE_MANIFEST, lintQuarantineManifest, readQuarantineManifest } from './suite-quarantine.ts';

export type Shard = 'free' | 'machine';
export type SuiteShard = { name: string; targets: string[]; resource: Shard; workers: number };
// Process fixtures use real ports and clocks even when each project directory is private.
// SQL .exec() and promise gates are hermetic; process launches and wall-clock waits are not.
const MACHINE = /node:(?:child_process|net|http|https|dgram|timers)|(?:from\s*|import\s*\()['"][^'"]*(?:harness|process-cleanup)[^'"]*['"]|\b(?:setTimeout|setInterval|sleep|pause|delay)\s*\(|\.listen\s*\(|\/tmp\/cland-suite(?:-nvim)?\.lock\b|\bnvim\b/;

const HUB_PATTERNS = ['hub/src/**/*.test.ts', 'hub/test/**/*.test.ts'];
const PATTERNS = [...HUB_PATTERNS, 'nvim/test/**/*.test.ts'];
export const TIER_MANIFEST = 'hub/test/tiers.json';
const LEGACY_MANIFEST = 'hub/test/shards.json';
export type Tier = 'T1' | 'T2' | 'T3' | 'T4';
export type TierEntry = Tier | { tier: 'T3'; contract: string } | { tier: 'T3'; scenario: string };
export type TierManifest = { version: 1; tests: Record<string, TierEntry> };

/** All manifest writers use path order, independent of insertion order or locale. */
export function serializeTierManifest(manifest: TierManifest): string {
  return JSON.stringify({ ...manifest, tests: Object.fromEntries(Object.keys(manifest.tests).sort().map(path => [path, manifest.tests[path]])) }, null, 2) + '\n';
}
type Manifest = { version?: number; tests?: Record<string, unknown> };
export class ShardManifestError extends Error {
  readonly files: string[];
  constructor(message: string, files: string[] = []) { super(message); this.files = files; }
}

function tierOf(entry: unknown): Tier | undefined {
  if (entry === 'T1' || entry === 'T2' || entry === 'T3' || entry === 'T4') return entry;
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
  const value = entry as Record<string, unknown>;
  const keys = Object.keys(value);
  const label = keys.includes('contract') ? 'contract' : 'scenario';
  if (value.tier === 'T3' && keys.length === 2 && keys.includes('tier') && typeof value[label] === 'string' && value[label].trim()) return 'T3';
}

function parseManifest(text: string, path: string): Manifest {
  try { return JSON.parse(text) as Manifest; }
  catch { throw new ShardManifestError(`invalid test manifest JSON: ${path}`, [path]); }
}

async function classify(paths: string[], manifest: Manifest, source: (path: string) => Promise<string>, smoke: boolean, workers = 4, legacy = false): Promise<SuiteShard[]> {
  paths.sort();
  const manifestPath = legacy ? LEGACY_MANIFEST : TIER_MANIFEST;
  if (!manifest || manifest.version !== 1 || !manifest.tests || typeof manifest.tests !== 'object' || Array.isArray(manifest.tests)) throw new ShardManifestError(`invalid test manifest: ${manifestPath}`, [manifestPath]);
  const tests = manifest.tests;
  const keys = Object.keys(tests);
  // Old branches never promised sorted resource maps; preserve their admission contract.
  if (!legacy) for (let i = 1; i < keys.length; i++) if (keys[i]! < keys[i - 1]!) throw new ShardManifestError(`test tier map is not sorted by path: ${keys[i]} (before ${keys[i - 1]})`, [keys[i]!]);
  const unclassified = paths.filter(path => !Object.hasOwn(tests, path));
  if (unclassified.length) throw new ShardManifestError(`unclassified ${legacy ? 'hub tests' : 'tests'}: ${unclassified.join(', ')}; add explicit classifications to ${manifestPath} (${legacy ? 'machine' : 'T3'} is the conservative choice):\n${unclassified.map(path => `    ${JSON.stringify(path)}: "${legacy ? 'machine' : 'T3'}",`).join('\n')}`, unclassified);
  const tiers = new Map<string, Tier>();
  for (const path of keys) {
    if (!paths.includes(path)) throw new ShardManifestError(`test manifest names missing test: ${path}`, [path]);
    const tier = legacy ? tests[path] === 'free' ? 'T1' : tests[path] === 'machine' ? 'T3' : undefined : tierOf(tests[path]);
    if (!tier) throw new ShardManifestError(`invalid ${legacy ? 'resource' : 'tier or tier object'} for test: ${path}`, [path]);
    tiers.set(path, tier);
  }
  const groups: Record<Shard, string[]> = { free: [], machine: [] };
  for (const path of paths) {
    const resource = tiers.get(path) === 'T1' ? 'free' : 'machine';
    if (resource === 'free' && MACHINE.test(await source(path))) throw new ShardManifestError(`${legacy ? 'free hub' : 'T1'} test touches machine resources: ${path}; classify it as ${legacy ? 'machine' : 'T3'}`, [path]);
    // Neovim is validated in the same manifest, but retains its existing package phase.
    if (path.startsWith('hub/') && (!smoke || HUB_SMOKE.includes(path))) groups[resource].push(path);
  }
  return (['free', 'machine'] as const).filter(resource => groups[resource].length).map(resource => ({ name: `hub ${resource}${smoke ? ' smoke' : ''}`, resource, workers: resource === 'free' ? 1 : workers, targets: groups[resource] }));
}

async function readManifest(cwd: string): Promise<{ manifest: Manifest; legacy: boolean } | undefined> {
  for (const [path, legacy] of [[TIER_MANIFEST, false], [LEGACY_MANIFEST, true]] as const) {
    let text: string;
    try { text = await readFile(join(cwd, path), 'utf8'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error; }
    return { manifest: parseManifest(text, path), legacy };
  }
}

/** Report readers share the validated manifest's current/legacy tier interpretation. */
export async function readTierAssignments(cwd: string): Promise<Map<string, Tier> | null> {
  const entry = await readManifest(cwd);
  if (!entry) return null;
  const tiers = new Map<string, Tier>(Object.entries(entry.manifest.tests ?? {}).map(([path, value]) => [path,
    entry.legacy ? value === 'free' ? 'T1' : 'T3' : tierOf(value)!]));
  // Legacy admission classified only hub tests, but its package plan still runs
  // Neovim. Give those files the same conservative tier as the machine phase.
  if (entry.legacy) for await (const path of glob('nvim/test/**/*.test.ts', { cwd })) tiers.set(path, 'T3');
  return tiers;
}

export async function hubShards(cwd: string, smoke = false, workers?: number): Promise<SuiteShard[]> {
  await lintDurations(cwd);
  const entry = await readManifest(cwd);
  const paths = [];
  for await (const path of glob(entry && !entry.legacy ? PATTERNS : HUB_PATTERNS, { cwd })) paths.push(path);
  return classify(paths, entry ? entry.manifest : { version: 1, tests: {} }, path => readFile(join(cwd, path), 'utf8'), smoke, workers ?? (await suiteLimits(cwd)).workers, entry?.legacy);
}

/** Only projects with a manifest opt in. Admission also covers dirty test files. */
export async function lintHubShards(cwd: string): Promise<void> {
  await lintDurations(cwd);
  if (await readManifest(cwd)) await hubShards(cwd);
}

/** Only allowances present before the migration may use the legacy exception. */
async function legacyDurationKeys(git: (args: string[]) => Promise<string>): Promise<Set<string> | undefined> {
  for (const ref of ['origin/dev', 'HEAD']) {
    try {
      const manifest = JSON.parse(await git(['show', `${ref}:${DURATION_MANIFEST}`])) as DurationManifest;
      // The original schema predates the one-time migration. Thereafter only
      // explicitly legacy keys survive; new expiring entries cannot convert.
      return new Set(Object.entries(manifest.allow).filter(([, entry]) => !manifest.budget.T1 || entry.legacy).map(([key]) => key));
    } catch { /* A new repository may not have a committed baseline yet. */ }
  }
  return undefined;
}

/** Inspect the immutable merge result, including dev-only files, without touching any checkout. */
export async function lintHubShardTree(cwd: string, tree: string, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const exec = promisify(execFile);
  const git = async (args: string[]) => (await exec('git', args, { cwd, env, timeout: 30_000, maxBuffer: 16 * 1024 * 1024 })).stdout;
  const paths = (await git(['ls-tree', '-r', '--name-only', '-z', tree, '--', 'hub/src', 'hub/test', 'nvim/test'])).split('\0').filter(Boolean);
  const source = (path: string) => git(['show', `${tree}:${path}`]);
  if (paths.includes(DURATION_MANIFEST)) {
    try {
      const manifest = JSON.parse(await source(DURATION_MANIFEST)) as DurationManifest;
      lintDurationManifest(manifest);
      const ownerCwd = (await git(['rev-parse', '--show-toplevel'])).trim();
      const legacyKeys = await legacyDurationKeys(git);
      lintDurationManifest(manifest, { owners: await durationOwners(ownerCwd, manifest), ...(legacyKeys ? { legacyKeys } : {}) });
    }
    catch (error) { throw new ShardManifestError(error instanceof Error ? error.message : String(error), [DURATION_MANIFEST]); }
  }
  if (paths.includes(QUARANTINE_MANIFEST)) {
    try { lintQuarantineManifest(JSON.parse(await source(QUARANTINE_MANIFEST))); }
    catch (error) { throw new ShardManifestError(error instanceof Error ? error.message : String(error), [QUARANTINE_MANIFEST]); }
  }
  const manifestPath = paths.includes(TIER_MANIFEST) ? TIER_MANIFEST : paths.includes(LEGACY_MANIFEST) ? LEGACY_MANIFEST : undefined;
  if (!manifestPath) return;
  const legacy = manifestPath === LEGACY_MANIFEST;
  await classify(paths.filter(path => (legacy ? HUB_PATTERNS : PATTERNS).some(pattern => matchesGlob(path, pattern))), parseManifest(await source(manifestPath), manifestPath), source, false, 4, legacy);
}

async function lintDurations(cwd: string): Promise<void> {
  try {
    const manifest = await readDurationManifest(cwd);
    if (manifest) {
      lintDurationManifest(manifest);
      const git = async (args: string[]) => (await promisify(execFile)('git', args, { cwd, timeout: 30_000, maxBuffer: 16 * 1024 * 1024 })).stdout;
      const legacyKeys = await legacyDurationKeys(git);
      lintDurationManifest(manifest, { owners: await durationOwners(cwd, manifest), ...(legacyKeys ? { legacyKeys } : {}) });
    }
  } catch (error) { throw new ShardManifestError(error instanceof Error ? error.message : String(error), [DURATION_MANIFEST]); }
  try { await readQuarantineManifest(cwd); }
  catch (error) { throw new ShardManifestError(error instanceof Error ? error.message : String(error), [QUARANTINE_MANIFEST]); }
}

export async function packageShards(cwd: string, mode: SuiteMode, selection?: { files: string[]; nvim: boolean }, coverage?: SuiteSelection, options: { executor?: 'local' | 'droplet'; workers?: number } = {}): Promise<SuiteShard[]> {
  const workers = options.workers ?? (await suiteLimits(cwd, options.executor)).workers;
  if (!Number.isSafeInteger(workers) || workers < 1) throw new Error('workers must be a positive integer');
  if (selection) {
    const shards = await hubShards(cwd, false, workers);
    const known = new Set(shards.flatMap(shard => shard.targets));
    for (const file of selection.files) if (!known.has(file)) throw new ShardManifestError(`unknown explicit hub shard file: ${file}`, [file]);
    return [...shards.map(shard => ({ ...shard, targets: shard.targets.filter(file => selection.files.includes(file)) })).filter(shard => shard.targets.length),
      ...(selection.nvim ? [{ name: 'Neovim', targets: ['nvim/test/**/*.test.ts'], resource: 'machine' as const, workers }] : [])];
  }
  if (mode === 'hub-selected') {
    const shards = await hubShards(cwd, false, workers);
    const known = new Set(shards.flatMap(shard => shard.targets));
    if (!coverage?.tests?.length) throw new ShardManifestError('selected hub tests missing');
    for (const test of coverage.tests) if (!known.has(test)) throw new ShardManifestError(`unknown selected hub test: ${test}`, [test]);
    return [...shards.map(shard => ({ ...shard, name: `${shard.name} selected`, targets: shard.targets.filter(file => coverage.tests!.includes(file)) })).filter(shard => shard.targets.length),
      { name: coverage.nvimFull ? 'Neovim' : 'Neovim smoke', targets: coverage.nvimFull ? ['nvim/test/**/*.test.ts'] : NVIM_SMOKE, resource: 'machine', workers }];
  }
  return [...await hubShards(cwd, mode === 'nvim-only', workers), { name: mode === 'hub-only' ? 'Neovim smoke' : 'Neovim', targets: mode === 'hub-only' ? NVIM_SMOKE : ['nvim/test/**/*.test.ts'], resource: 'machine', workers }];
}

/** Longest-processing-time placement, including Neovim as one indivisible job. */
export function balanceCloseShards(files: string[], durations: DurationManifest['files'], count: number): Array<{ files: string[]; hubSeconds: number; nvim: boolean; seconds: number }> {
  if (!Number.isSafeInteger(count) || count < 1) throw new Error('shard count must be a positive integer');
  const known = Object.values(durations).map(file => file.seconds).sort((a, b) => a - b);
  const median = known.length ? known.length % 2 ? known[Math.floor(known.length / 2)]! : (known[known.length / 2 - 1]! + known[known.length / 2]!) / 2 : 1;
  const weight = (file: string) => durations[file]?.seconds ?? median;
  const shards = Array.from({ length: count }, () => ({ files: [] as string[], hubSeconds: 0, nvim: false, seconds: 0 }));
  const nvimSeconds = Object.entries(durations).filter(([file]) => file.startsWith('nvim/')).reduce((sum, [, value]) => sum + value.seconds, 0);
  const jobs: Array<{ file: string | null; seconds: number }> = [...files.map(file => ({ file, seconds: weight(file) })), { file: null, seconds: nvimSeconds }];
  // Reserve the whole Neovim phase before smaller hub files fill its shard.
  // File-name ties and the first lightest shard keep the plan reproducible.
  for (const job of jobs.sort((a, b) => b.seconds - a.seconds || (a.file ?? '').localeCompare(b.file ?? ''))) {
    const shard = shards.reduce((best, shard) => shard.seconds < best.seconds ? shard : best);
    if (job.file === null) shard.nvim = true;
    else { shard.files.push(job.file); shard.hubSeconds += job.seconds; }
    shard.seconds += job.seconds;
  }
  return shards;
}
