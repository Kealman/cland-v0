// Admission policy over direct source facts. Reachability remains diagnostic.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { realClock, type Clock } from './hub/clock.ts';
import { LintWarmQueue } from './test-lint-warm-queue.ts';
import { startLintAnalysis, type LintAnalysis, type LintSource, type LintWarmReceipt } from './test-lint-worker-runner.ts';
import { treeSources } from './git-tree-sources.ts';
import type { LogFn } from './log.ts';
import type { TierManifest } from './suite-shards.ts';
import { cacheTestLintFacts, testLintFacts, type TestLintFinding } from './test-lint.ts';

export const LINT_BASELINE = 'hub/test/lint-baseline.json';
const TIERS = 'hub/test/tiers.json';
export const lintCategories = ['wall-clock-wait', 'wall-clock-assertion', 'startDaemon', 'spawnSpoke', 'fakeClaude', 'fakeCodex', 'fakeOpenCode'] as const;
type Category = typeof lintCategories[number];
export type LintBaseline = { version: 1; files: Record<string, Partial<Record<Category, number>>>; conditionWait?: Record<string, number> };
type Source = (file: string) => Promise<string>;
type Snapshot = { manifest?: TierManifest; baseline?: LintBaseline; source?: Source };
export type LintRefusal = { file: string; line: number; rule: string; message: string };

export class TestLintReadError extends Error {}

export class TestLintError extends Error {
  readonly files: string[];
  readonly findings: LintRefusal[];
  constructor(findings: LintRefusal[]) {
    super(findings.map(f => `${f.file}:${f.line} [${f.rule}] ${f.message}`).join('\n'));
    this.findings = findings;
    this.files = [...new Set(findings.map(f => f.file))];
  }
}
export const lintRefusalLines = (findings: LintRefusal[]) => findings.map(f => `test lint refusal: ${f.file}:${f.line} [${f.rule}] ${f.message}`);
function validate(value: LintBaseline, advisory = false): void {
  if (advisory && value.conditionWait !== undefined && (!value.conditionWait || typeof value.conditionWait !== 'object' || Array.isArray(value.conditionWait) || Object.values(value.conditionWait).some(count => !Number.isSafeInteger(count) || count < 0))) throw new Error('invalid condition wait baseline');
  if (value.version !== 1 || !value.files || typeof value.files !== 'object' || Array.isArray(value.files)) throw new Error('invalid lint baseline schema');
  for (const [file, counts] of Object.entries(value.files)) {
    if (!counts || typeof counts !== 'object' || Array.isArray(counts)) throw new Error(`invalid lint baseline counts: ${file}`);
    for (const [category, count] of Object.entries(counts)) {
      if (!lintCategories.includes(category as Category) || !Number.isSafeInteger(count) || count < 0) throw new Error(`invalid lint baseline count: ${file} [${category}]`);
    }
  }
}
function categories(facts: ReturnType<typeof testLintFacts>): Map<Category | 'condition-wait', TestLintFinding[]> {
  const map = new Map<Category | 'condition-wait', TestLintFinding[]>([...lintCategories, 'condition-wait' as const].map(category => [category, []]));
  for (const finding of facts.result.findings) if (finding.rule.startsWith('wall-clock')) map.get(finding.reportOnly ? 'condition-wait' : finding.rule as Category)!.push(finding);
  for (const call of facts.calls) map.get(call.message as Category)!.push(call);
  return map;
}
/** Freeze current counts, or lower each existing allowance without ever raising one. */
export async function shrinkLintBaseline(manifest: TierManifest, source: Source, baseline?: LintBaseline): Promise<LintBaseline> {
  if (baseline) validate(baseline, true);
  const files: LintBaseline['files'] = {};
  const conditionWait: Record<string, number> = {};
  for (const [file, entry] of Object.entries(manifest.tests).sort(([a], [b]) => a.localeCompare(b))) {
    const counts: LintBaseline['files'][string] = {};
    for (const [category, findings] of categories(testLintFacts(file, await source(file), entry))) {
      if (category === 'condition-wait') {
        const count = baseline ? Math.min(baseline.conditionWait?.[file] ?? 0, findings.length) : findings.length;
        if (count) conditionWait[file] = count;
        continue;
      }
      const count = baseline ? Math.min(baseline.files[file]?.[category] ?? 0, findings.length) : findings.length;
      if (count) counts[category] = count;
    }
    files[file] = counts;
  }
  return { version: 1, files, conditionWait };
}
export async function checkTestLint(input: Snapshot & { manifest: TierManifest; source: Source; base?: Snapshot; reportOnly?: boolean }): Promise<LintRefusal[]> {
  const { manifest, source, baseline, base = {} } = input;
  const findings: LintRefusal[] = [];
  try { if (baseline) validate(baseline, input.reportOnly); if (base.baseline) validate(base.baseline, input.reportOnly); }
  catch (error) { return [{ file: LINT_BASELINE, line: 1, rule: 'lint-baseline', message: String(error) }]; }
  // Before the one-time freeze, history supplies the existing debt.
  const previous = base.baseline ?? (base.manifest && base.source ? await shrinkLintBaseline(base.manifest, base.source) : { version: 1 as const, files: {} });
  if (base.baseline && !baseline) findings.push({ file: LINT_BASELINE, line: 1, rule: 'lint-baseline', message: 'frozen baseline must not be removed' });
  for (const [file, counts] of Object.entries(baseline?.files ?? {})) for (const [category, count] of Object.entries(counts)) {
    if (count > (previous.files[file]?.[category as Category] ?? 0)) findings.push({ file: LINT_BASELINE, line: 1, rule: 'lint-baseline', message: `baseline grew: ${file} [${category}]` });
  }
  const allowance = baseline ?? previous;
  // Absence means zero, including first publication and a removed/exhausted map.
  // Seeding an advisory allowance must itself remain visible in report mode.
  if (input.reportOnly) {
    for (const [file, count] of Object.entries(baseline?.conditionWait ?? {})) {
      if (count > (previous.conditionWait?.[file] ?? 0)) findings.push({ file: LINT_BASELINE, line: 1, rule: 'wall-clock-wait', message: `condition wait baseline grew: ${file} (report only)` });
    }
  }
  for (const [file, entry] of Object.entries(manifest.tests).sort(([a], [b]) => a.localeCompare(b))) {
    const facts = testLintFacts(file, await source(file), entry);
    if (input.reportOnly) {
      const calls = categories(facts).get('condition-wait')!;
      const allowed = allowance.conditionWait?.[file] ?? 0;
      for (const call of calls.slice(allowed)) findings.push({ ...call, message: `condition-wait count ${calls.length} exceeds frozen allowance ${allowed} (report only)` });
      continue;
    }
    const isNew = !base.manifest?.tests[file];
    if (isNew) findings.push(...facts.result.findings.filter(f => ['tier-import', 'tier-process', 't3-lifecycle'].includes(f.rule)));
    const counts = categories(facts);
    const tier = typeof entry === 'string' ? entry : entry.tier;
    let headerRefusal = false;
    if (!isNew && (tier === 'T3' || tier === 'T4') && !facts.lifecycle) {
      const oldEntry = base.manifest!.tests[file]!;
      const lostLifecycle = base.source && testLintFacts(file, await base.source(file), oldEntry).lifecycle;
      const processGrowth = [...counts].some(([category, calls]) =>
        category !== 'condition-wait' && !category.startsWith('wall-clock') && calls.length > (allowance.files[file]?.[category] ?? 0));
      if (lostLifecycle || processGrowth) {
        findings.push({ file, line: 1, rule: 't3-lifecycle', message: `first comment block must name the process behaviour: ${tier}: <behaviour>` });
        headerRefusal = true;
      }
    }
    for (const [category, calls] of counts) {
      if (category === 'condition-wait') continue;
      if (!category.startsWith('wall-clock') && (facts.lifecycle || headerRefusal)) continue;
      const allowed = allowance.files[file]?.[category] ?? 0;
      for (const call of calls.slice(allowed)) findings.push({ ...call, rule: category, message: `${category} count ${calls.length} exceeds frozen allowance ${allowed}` });
    }
  }
  return findings;
}
async function optional(source: Source, path: string): Promise<string | undefined> {
  try { return await source(path); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
}
/** Keep every admitted read owned until the whole group has settled. */
async function settledReads<T extends readonly unknown[]>(reads: { [K in keyof T]: Promise<T[K]> }): Promise<T> {
  const results = await Promise.allSettled(reads);
  const failed = results.find(result => result.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
  return results.map(result => (result as PromiseFulfilledResult<unknown>).value) as unknown as T;
}
async function snapshot(source: Source): Promise<Snapshot> {
  const [tiers, baseline] = await settledReads([optional(source, TIERS), optional(source, LINT_BASELINE)]);
  return { source, ...(tiers ? { manifest: JSON.parse(tiers) } : {}), ...(baseline ? { baseline: JSON.parse(baseline) } : {}) };
}
async function treeSnapshot(cwd: string, tree: string, env?: NodeJS.ProcessEnv): Promise<Snapshot> {
  // A missing path is established by the tree listing, never by Git's generic
  // exit 128 (which can also mean an unavailable repository or object read).
  const policy = await treeSources(cwd, tree, [TIERS, LINT_BASELINE], env);
  const value = await snapshot(policy);
  let sources: Promise<Source> | undefined;
  return { ...value, source: async file => {
    sources ??= treeSources(cwd, tree, Object.keys(value.manifest?.tests ?? {}), env);
    return (await sources)(file);
  } };
}

/** Best-effort preparation, never an admission verdict. One isolate per quiet tip. */
export class TestLintWarmer {
  readonly #queue: LintWarmQueue;
  #active: LintAnalysis | undefined;
  #closing = false;
  constructor(cwd: string, env: NodeJS.ProcessEnv, log: LogFn = () => {}, options: {
    clock?: Clock; quietMs?: number;
    analyze?: (entries: LintSource[]) => Promise<LintWarmReceipt>;
    start?: typeof startLintAnalysis;
  } = {}) {
    this.#queue = new LintWarmQueue(options.clock ?? realClock, async head => {
      const began = performance.now();
      try {
        const value = await treeSnapshot(cwd, head, env);
        const sources: LintSource[] = [];
        for (const [file, entry] of Object.entries(value.manifest?.tests ?? {})) {
          sources.push({ file, entry, text: await value.source!(file) });
        }
        if (this.#closing) return;
        let receipt: LintWarmReceipt;
        if (options.analyze) receipt = await options.analyze(sources);
        else {
          this.#active = (options.start ?? startLintAnalysis)(sources);
          try { receipt = await this.#active.result; }
          finally { this.#active = undefined; }
        }
        cacheTestLintFacts(receipt.facts);
        log({ event: 'test-lint-warmed', head, files: receipt.files, wallMs: performance.now() - began,
          peakHeapBytes: receipt.peakHeapBytes, heapSizeLimitBytes: receipt.heapSizeLimitBytes,
          memoryScope: 'analysis child heap sampled after each file', oldGenerationLimitMb: 256 });
      } catch (error) {
        const native = error && typeof error === 'object' ? error as { stage?: string; exit?: unknown; diagnostic?: string } : {};
        log({ event: 'test-lint-warm-failed', head, wallMs: performance.now() - began, peakHeapBytes: null,
          stage: native.stage ?? null, nativeExit: native.exit ?? null, diagnostic: native.diagnostic ?? null, error: String(error) });
        throw error;
      }
    }, options.quietMs);
  }
  request(head: string | null): void { this.#queue.request(head); }
  async close(): Promise<void> {
    this.#closing = true;
    const drained = this.#queue.close();
    await this.#active?.close();
    await drained;
  }
}
/** Both gates judge the same immutable sources; dirty admission also judges disk. */
export async function testLintPolicy(cwd: string, options: { tree?: string; head?: string; base?: string; env?: NodeJS.ProcessEnv; readFailures?: 'throw'; reportOnly?: boolean } = {}): Promise<LintRefusal[]> {
  const git = async (args: string[]) => (await promisify(execFile)('git', args, { cwd, env: options.env, maxBuffer: 16 * 1024 * 1024, timeout: 30_000 })).stdout.trimEnd();
  let baseRef: string | undefined;
  // The hub advances the shared local dev branch; origin/dev can be stale or
  // absent until a fetch. Keep the remote fallback for clones without local dev.
  for (const ref of options.base ? [options.base] : ['refs/heads/dev', 'origin/dev']) {
    try { baseRef = await git(['merge-base', ref, options.head ?? 'HEAD']); break; }
    catch { /* try the next available integration ref */ }
  }
  if (!baseRef) try { baseRef = await git(['rev-parse', options.head ?? 'HEAD']); } catch { /* standalone fixture */ }
  try {
    const [current, base] = await settledReads([
      options.tree ? treeSnapshot(cwd, options.tree, options.env) : snapshot(file => readFile(join(cwd, file), 'utf8')),
      (options.base ?? baseRef) ? treeSnapshot(cwd, options.base ?? baseRef!, options.env) : Promise.resolve({} as Snapshot),
    ]);
    if (!current.manifest) return base.baseline ? [{ file: TIERS, line: 1, rule: 'lint-baseline', message: 'tier manifest must not be removed while lint baseline is frozen' }] : [];
    if (!base.baseline && current.baseline) {
      // During the first baseline's publication, dev can move underneath its
      // branch without owning the freeze yet. Keep that validated first freeze;
      // do not silently derive a new allowance from the advanced merge base.
      const introduced = (await git(['log', '--reverse', '--format=%H', '--diff-filter=A', options.head ?? 'HEAD', '--', LINT_BASELINE])).split('\n').find(Boolean);
      if (introduced) {
        const frozen = await treeSnapshot(cwd, introduced, options.env);
        if (!frozen.manifest || !frozen.baseline) return [{ file: LINT_BASELINE, line: 1, rule: 'lint-baseline', message: 'original freeze requires a tier manifest and baseline' }];
        // A successful parent listing positively distinguishes a root commit.
        const parents = (await git(['rev-list', '--parents', '-n', '1', introduced])).split(/\s+/);
        if (parents[0] !== introduced) throw new Error(`invalid Git parent response: ${introduced}`);
        const parent = parents[1] ?? introduced;
        const before = await treeSnapshot(cwd, parent, options.env);
        // Validate the seed against its own original debt before trusting it.
        // A root commit seeds from its sources; an inflated seed still refuses.
        const invalid = await checkTestLint({ manifest: frozen.manifest, source: frozen.source!, baseline: frozen.baseline,
          base: { ...(before.manifest ? { manifest: before.manifest } : {}), source: before.source! } });
        if (invalid.length) return invalid;
        base.baseline = frozen.baseline;
      }
    }
    return await checkTestLint({ ...current, manifest: current.manifest, source: current.source!, base, reportOnly: options.reportOnly ?? false });
  } catch (error) {
    if (options.readFailures === 'throw' && !(error instanceof SyntaxError)) throw new TestLintReadError(`cannot read test lint policy: ${String(error)}`, { cause: error });
    return [{ file: LINT_BASELINE, line: 1, rule: 'lint-baseline', message: `cannot read test lint policy: ${String(error)}` }];
  }
}
export async function shrinkTestLint(cwd: string): Promise<void> {
  const source: Source = file => readFile(join(cwd, file), 'utf8');
  const current = await snapshot(source);
  if (!current.manifest || !current.baseline) throw new Error('shrink requires the frozen lint baseline and tier manifest');
  await writeFile(join(cwd, LINT_BASELINE), JSON.stringify(await shrinkLintBaseline(current.manifest, source, current.baseline), null, 2) + '\n');
}
