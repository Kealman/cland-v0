// Positive manifest: adding a test requires an explicit tier decision.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { glob, readFile } from 'node:fs/promises';
import { join, matchesGlob } from 'node:path';
import { treeSources } from './git-tree-sources.ts';
import { touchesMachineResources } from './test-lint.ts';
import { suiteLimits } from './suite-limits.ts';
import type { SuiteMode, SuiteSelection } from './suite-selection.ts';
import { HUB_SMOKE, NVIM_SMOKE, WEB_SMOKE } from './suite-selection.ts';
import { DURATION_MANIFEST, durationOwners, lintDurationManifest, readDurationManifest, type DurationManifest } from './suite-durations.ts';
import { QUARANTINE_MANIFEST, lintQuarantineManifest, readQuarantineManifest } from './suite-quarantine.ts';
import { lintDurationIdentities } from './suite-test-identities.ts';

export type Shard = 'free' | 'machine';
export type SuiteShard = { name: string; targets: string[]; resource: Shard; workers: number };
// Process fixtures use real ports and clocks even when each project directory is private.
// SQL .exec() and promise gates are hermetic; process launches and wall-clock waits are not.

const HUB_PATTERNS = ['hub/src/**/*.test.ts', 'hub/test/**/*.test.ts'];
const PATTERNS = [...HUB_PATTERNS, 'nvim/test/**/*.test.ts', 'web/test/**/*.test.ts'];
export const TIER_MANIFEST = 'hub/test/tiers.json';
const LEGACY_MANIFEST = 'hub/test/shards.json';
export type Tier = 'T1' | 'T2' | 'T3' | 'T4' | 'Web';
export type TierEntry = Tier | { tier: 'T3'; contract: string } | { tier: 'T3'; scenario: string };
export type LoadGuards = Record<string, string[]>;
export type TierManifest = { version: 1; tests: Record<string, TierEntry>; loadGuards?: LoadGuards };
// Inject recorded allowance provenance for in-process planners; production reads Git.
export type DurationHistory = { legacyKeys?: ReadonlySet<string> };

/** All manifest writers use path order, independent of insertion order or locale. */
export function serializeTierManifest(manifest: TierManifest): string {
  return JSON.stringify({ ...manifest, tests: Object.fromEntries(Object.keys(manifest.tests).sort().map(path => [path, manifest.tests[path]])) }, null, 2) + '\n';
}
type Manifest = { version?: number; tests?: Record<string, unknown>; loadGuards?: unknown };
export class ShardManifestError extends Error {
  readonly files: string[];
  constructor(message: string, files: string[] = []) { super(message); this.files = files; }
}

/** Location formatting only; admission policy stays in the manifest checkers.
 * The caller supplies the exact immutable or working source that failed. */
export async function shardRefusalLocations(error: ShardManifestError, source: (file: string) => Promise<string>): Promise<string[]> {
  const manifests = await Promise.all([TIER_MANIFEST, LEGACY_MANIFEST, DURATION_MANIFEST, QUARANTINE_MANIFEST].map(async file =>
    ({ file, lines: (await source(file).catch(() => '')).split('\n') })));
  return error.files.map(file => {
    for (const manifest of manifests) {
      const line = manifest.lines.findIndex(line => line.includes(JSON.stringify(file).slice(0, -1)));
      if (line >= 0) return `${manifest.file}:${line + 1} (${file})`;
      if (file === manifest.file) {
        const keys = manifest.lines.flatMap((text, index) => {
          const key = text.match(/^\s*("(?:[^"\\]|\\.)*")\s*:/)?.[1];
          try {
            const value: string = key ? JSON.parse(key) : '';
            return value && error.message.includes(value) ? [{ value, line: index + 1 }] : [];
          } catch { return []; }
        }).sort((a, b) => b.value.length - a.value.length);
        return `${file}:${keys[0]?.line ?? 1}`;
      }
    }
    return `${file}:1`;
  });
}

function tierOf(entry: unknown): Tier | undefined {
  if (entry === 'T1' || entry === 'T2' || entry === 'T3' || entry === 'T4' || entry === 'Web') return entry;
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

function loadGuardsOf(manifest: Manifest): LoadGuards {
  if (!Object.hasOwn(manifest, 'loadGuards')) return {};
  const guards = manifest.loadGuards;
  const invalid = (detail: string): never => { throw new ShardManifestError(`invalid loadGuards in ${TIER_MANIFEST}: ${detail}`, [TIER_MANIFEST]); };
  if (!guards || typeof guards !== 'object' || Array.isArray(guards)) return invalid('expected a source-glob to T4 test-file array map');
  const soak = new Set(Object.entries(manifest.tests ?? {}).filter(([, entry]) => tierOf(entry) === 'T4').map(([path]) => path));
  for (const [pattern, files] of Object.entries(guards)) {
    if (!pattern.trim() || pattern !== pattern.trim() || pattern.startsWith('/') || pattern.includes('\\') || pattern.split('/').some(part => part === '' || part === '.' || part === '..')) return invalid(`source glob must be repository-relative: ${JSON.stringify(pattern)}`);
    if (!Array.isArray(files) || !files.length) return invalid(`${pattern} needs a nonempty T4 test-file array`);
    for (const file of files) if (typeof file !== 'string' || !soak.has(file)) return invalid(`${pattern} names a missing or non-T4 test: ${JSON.stringify(file)}`);
  }
  return guards as LoadGuards;
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
    if (path.startsWith('web/') !== (tier === 'Web')) throw new ShardManifestError(`Web classification requires a web/test path: ${path}`, [path]);
    tiers.set(path, tier);
  }
  if (!legacy) loadGuardsOf(manifest);
  const groups: Record<Shard, string[]> = { free: [], machine: [] };
  for (const path of paths) {
    const resource = tiers.get(path) === 'T1' ? 'free' : 'machine';
    if (resource === 'free' && touchesMachineResources(path, await source(path))) throw new ShardManifestError(`${legacy ? 'free hub' : 'T1'} test touches machine resources: ${path}; classify it as ${legacy ? 'machine' : 'T3'}`, [path]);
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

/** Optional source-glob to T4 guard map; legacy projects have no read-path guards. */
export async function readTierLoadGuards(cwd: string): Promise<LoadGuards> {
  const entry = await readManifest(cwd);
  return entry && !entry.legacy ? loadGuardsOf(entry.manifest) : {};
}

export async function hubShards(cwd: string, smoke = false, workers?: number, history: DurationHistory = {}): Promise<SuiteShard[]> {
  await lintDurations(cwd, history);
  const entry = await readManifest(cwd);
  const paths = [];
  for await (const path of glob(entry && !entry.legacy ? PATTERNS : HUB_PATTERNS, { cwd })) paths.push(path);
  return classify(paths, entry ? entry.manifest : { version: 1, tests: {} }, path => readFile(join(cwd, path), 'utf8'), smoke, workers ?? (await suiteLimits(cwd)).workers, entry?.legacy);
}

/** Only projects with a manifest opt in. Admission also covers dirty test files. */
export async function lintHubShards(cwd: string, history: DurationHistory = {}): Promise<void> {
  await lintDurations(cwd, history);
  if (await readManifest(cwd)) await hubShards(cwd, false, undefined, history);
}

/** Judge the branch's additions, independent of allowances retired later on dev. */
async function legacyDurationKeys(git: (args: string[]) => Promise<string>, head = 'HEAD', base = 'origin/dev'): Promise<Set<string> | undefined> {
  let ref: string;
  try { ref = (await git(['merge-base', base, head])).trim(); }
  catch { ref = head; } // Standalone repositories may not have origin/dev.
  try {
    const manifest = JSON.parse(await git(['show', `${ref}:${DURATION_MANIFEST}`])) as DurationManifest;
    // The original schema predates the one-time migration. Thereafter only
    // explicitly legacy keys survive; new expiring entries cannot convert.
    return new Set(Object.entries(manifest.allow).filter(([, entry]) => !manifest.budget.T1 || entry.legacy).map(([key]) => key));
  } catch {
    // A baseline without durations grants no legacy exceptions. An uncommitted
    // standalone repository has no history to judge yet.
    try {
      await git(['rev-parse', '--verify', ref]);
      return new Set();
    } catch { return undefined; }
  }
}

/** Inspect the immutable merge result, including dev-only files, without touching any checkout. */
export async function lintHubShardTree(cwd: string, tree: string, env: NodeJS.ProcessEnv = process.env, history: { head: string; base?: string } = { head: tree }): Promise<void> {
  const exec = promisify(execFile);
  const git = async (args: string[]) => (await exec('git', args, { cwd, env, timeout: 30_000, maxBuffer: 16 * 1024 * 1024 })).stdout;
  const paths = (await git(['ls-tree', '-r', '--name-only', '-z', tree, '--', 'hub/src', 'hub/test', 'nvim/test', 'web/test'])).split('\0').filter(Boolean);
  // T1 validation reads every source even when direct facts are warm. One
  // batch avoids a serial Git process startup per test on the refusal path.
  let sources: Promise<(file: string) => Promise<string>> | undefined;
  const source = async (path: string) => {
    sources ??= treeSources(cwd, tree, paths.filter(path => PATTERNS.some(pattern => matchesGlob(path, pattern))
      || [TIER_MANIFEST, LEGACY_MANIFEST, DURATION_MANIFEST, QUARANTINE_MANIFEST].includes(path)), env);
    return (await sources)(path);
  };
  if (paths.includes(DURATION_MANIFEST)) {
    try {
      const durationSource = await source(DURATION_MANIFEST);
      const manifest = JSON.parse(durationSource) as DurationManifest;
      lintDurationManifest(manifest);
      const ownerCwd = (await git(['rev-parse', '--show-toplevel'])).trim();
      const legacyKeys = await legacyDurationKeys(git, history.head, history.base);
      lintDurationManifest(manifest, { source: durationSource, owners: await durationOwners(ownerCwd, manifest), ...(legacyKeys ? { legacyKeys } : {}) });
      await lintDurationIdentities(manifest, path => paths.includes(path) && PATTERNS.some(pattern => matchesGlob(path, pattern)) ? source(path) : Promise.resolve(undefined));
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

async function lintDurations(cwd: string, history: DurationHistory): Promise<void> {
  try {
    const manifest = await readDurationManifest(cwd);
    if (manifest) {
      lintDurationManifest(manifest);
      const git = async (args: string[]) => (await promisify(execFile)('git', args, { cwd, timeout: 30_000, maxBuffer: 16 * 1024 * 1024 })).stdout;
      const legacyKeys = history.legacyKeys ?? await legacyDurationKeys(git);
      lintDurationManifest(manifest, { source: await readFile(join(cwd, DURATION_MANIFEST), 'utf8'), owners: await durationOwners(cwd, manifest), ...(legacyKeys ? { legacyKeys } : {}) });
      const paths = new Set<string>();
      for await (const path of glob(PATTERNS, { cwd })) paths.add(path);
      await lintDurationIdentities(manifest, async path => {
        if (!paths.has(path)) return undefined;
        try { return await readFile(join(cwd, path), 'utf8'); }
        catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
      });
    }
  } catch (error) { throw new ShardManifestError(error instanceof Error ? error.message : String(error), [DURATION_MANIFEST]); }
  try { await readQuarantineManifest(cwd); }
  catch (error) { throw new ShardManifestError(error instanceof Error ? error.message : String(error), [QUARANTINE_MANIFEST]); }
}

/** Package cadence excludes soak files unless the admitted selection enables them. */
export async function packageShards(cwd: string, mode: SuiteMode, selection?: { files: string[]; nvim: boolean }, coverage?: SuiteSelection, options: DurationHistory & { executor?: 'local' | 'droplet'; workers?: number } = {}): Promise<SuiteShard[]> {
  const phases = await unfilteredPackageShards(cwd, mode, selection, coverage, options);
  if (coverage?.durationCheck) {
    const assignments = await readTierAssignments(cwd);
    // Changed process files are independent of function coverage and smoke sets.
    // Remove any earlier occurrence before appending, so each file runs once.
    const changed = coverage.durationCheck.files.filter(file => ['T3', 'T4'].includes(assignments?.get(file) ?? ''));
    for (const phase of phases) {
      const targets: string[] = [];
      for await (const file of glob(phase.targets, { cwd })) if (!changed.includes(file)) targets.push(file);
      phase.targets = targets;
    }
    for (const prefix of ['hub/', 'nvim/']) {
      const targets = changed.filter(file => file.startsWith(prefix));
      if (targets.length) phases.push({ name: `${prefix === 'hub/' ? 'hub' : 'Neovim'} changed duration`, targets, resource: 'machine', workers: options.workers ?? (await suiteLimits(cwd, options.executor)).workers });
    }
  }
  const webFiles = [...await readTierAssignments(cwd) ?? []].filter(([, tier]) => tier === 'Web').map(([file]) => file).sort();
  if (webFiles.length && coverage?.web !== 'none' && (!selection || selection.nvim)) {
    const full = coverage?.web === 'all' || coverage?.web !== 'smoke' && (mode === 'full' || mode === 'web-only');
    const web: SuiteShard = { name: full ? 'Web' : 'Web smoke', targets: full ? webFiles : WEB_SMOKE.filter(file => webFiles.includes(file)), resource: 'machine', workers: options.executor === 'droplet' ? 4 : 2 };
    const index = phases.findIndex(phase => phase.name.startsWith('Neovim'));
    phases.splice(index < 0 ? phases.length : index, 0, web);
  }
  if (coverage?.tiers) {
    const tiers = await readTierAssignments(cwd);
    if (!tiers) throw new ShardManifestError('batch requires tier assignments', [TIER_MANIFEST]);
    const planned: SuiteShard[] = [];
    for (const phase of phases) {
      const targets: string[] = [];
      for await (const file of glob(phase.targets, { cwd })) if ((tiers.get(file) === 'Web' || coverage.tiers.includes(tiers.get(file)! as NonNullable<SuiteSelection['tiers']>[number])) && (!coverage.durationCheck || !['T3', 'T4'].includes(tiers.get(file)!) || coverage.durationCheck.files.includes(file))) targets.push(file);
      if (targets.length) planned.push({ ...phase, targets: targets.sort() });
    }
    // Coverage restricts T2 only. Every task proves the whole T1 rule set,
    // including when the diff selects only Neovim or a single hub function.
    if (coverage.durationCheck && coverage.tiers.includes('T1') || coverage.tiers.length === 2 && coverage.tiers.includes('T1') && coverage.tiers.includes('T2')) {
      const units = [...tiers].filter(([, tier]) => tier === 'T1').map(([file]) => file).sort();
      for (const phase of planned) phase.targets = phase.targets.filter(file => !units.includes(file));
      if (units.length) planned.unshift({ name: 'T1 whole', targets: units, resource: 'free', workers: 1 });
    }
    return planned.filter(phase => phase.targets.length);
  }
  if (coverage?.soak) return phases;
  const tiers = await readTierAssignments(cwd);
  const soak = [...tiers ?? []].filter(([, tier]) => tier === 'T4').map(([file]) => file);
  if (!soak.length) return phases;
  const planned: SuiteShard[] = [];
  for (const phase of phases) {
    if (!soak.some(file => phase.targets.some(target => matchesGlob(file, target)))) { planned.push(phase); continue; }
    const targets: string[] = [];
    for await (const file of glob(phase.targets, { cwd })) if (tiers?.get(file) !== 'T4') targets.push(file);
    if (targets.length) planned.push({ ...phase, targets: targets.sort() });
  }
  return planned;
}

async function unfilteredPackageShards(cwd: string, mode: SuiteMode, selection?: { files: string[]; nvim: boolean }, coverage?: SuiteSelection, options: DurationHistory & { executor?: 'local' | 'droplet'; workers?: number } = {}): Promise<SuiteShard[]> {
  const workers = options.workers ?? (await suiteLimits(cwd, options.executor)).workers;
  if (!Number.isSafeInteger(workers) || workers < 1) throw new Error('workers must be a positive integer');
  if (selection) {
    const shards = await hubShards(cwd, false, workers, options);
    const known = new Set(shards.flatMap(shard => shard.targets));
    for (const file of selection.files) if (!known.has(file)) throw new ShardManifestError(`unknown explicit hub shard file: ${file}`, [file]);
    return [...shards.map(shard => ({ ...shard, targets: shard.targets.filter(file => selection.files.includes(file)) })).filter(shard => shard.targets.length),
      ...(selection.nvim ? [{ name: 'Neovim', targets: coverage?.nvimTests ?? ['nvim/test/**/*.test.ts'], resource: 'machine' as const, workers }] : [])];
  }
  if (mode === 'hub-selected') {
    const shards = await hubShards(cwd, false, workers, options);
    const known = new Set(shards.flatMap(shard => shard.targets));
    if (!coverage?.tests?.length) throw new ShardManifestError('selected hub tests missing');
    for (const test of coverage.tests) if (!known.has(test)) throw new ShardManifestError(`unknown selected hub test: ${test}`, [test]);
    return [...shards.map(shard => ({ ...shard, name: `${shard.name} selected`, targets: shard.targets.filter(file => coverage.tests!.includes(file)) })).filter(shard => shard.targets.length),
      { name: coverage.nvimFull ? 'Neovim' : coverage.nvimTests ? 'Neovim selected' : 'Neovim smoke', targets: coverage.nvimFull ? ['nvim/test/**/*.test.ts'] : coverage.nvimTests ?? NVIM_SMOKE, resource: 'machine', workers }];
  }
  return [...await hubShards(cwd, mode === 'nvim-only' || mode === 'web-only', workers, options), { name: coverage?.nvimTests ? 'Neovim selected' : mode === 'hub-only' || mode === 'web-only' ? 'Neovim smoke' : 'Neovim', targets: coverage?.nvimTests ?? (mode === 'hub-only' || mode === 'web-only' ? NVIM_SMOKE : ['nvim/test/**/*.test.ts']), resource: 'machine', workers }];
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
