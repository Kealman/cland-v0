// Admission policy over direct source facts. Reachability remains diagnostic.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setImmediate as yieldToRequests } from 'node:timers/promises';
import { treeSources } from './git-tree-sources.ts';
import type { LogFn } from './log.ts';
import type { TierManifest } from './suite-shards.ts';
import { testLintFacts, type TestLintFinding } from './test-lint.ts';

export const LINT_BASELINE = 'hub/test/lint-baseline.json';
const TIERS = 'hub/test/tiers.json';
export const lintCategories = ['wall-clock-wait', 'wall-clock-assertion', 'startDaemon', 'spawnSpoke', 'fakeClaude', 'fakeCodex', 'fakeOpenCode'] as const;
type Category = typeof lintCategories[number];
export type LintBaseline = { version: 1; files: Record<string, Partial<Record<Category, number>>> };
type Source = (file: string) => Promise<string>;
type Snapshot = { manifest?: TierManifest; baseline?: LintBaseline; source?: Source };
export type LintRefusal = { file: string; line: number; rule: string; message: string };

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
function validate(value: LintBaseline): void {
  if (value.version !== 1 || !value.files || typeof value.files !== 'object' || Array.isArray(value.files)) throw new Error('invalid lint baseline schema');
  for (const [file, counts] of Object.entries(value.files)) {
    if (!counts || typeof counts !== 'object' || Array.isArray(counts)) throw new Error(`invalid lint baseline counts: ${file}`);
    for (const [category, count] of Object.entries(counts)) {
      if (!lintCategories.includes(category as Category) || !Number.isSafeInteger(count) || count < 0) throw new Error(`invalid lint baseline count: ${file} [${category}]`);
    }
  }
}
function categories(facts: ReturnType<typeof testLintFacts>): Map<Category, TestLintFinding[]> {
  const map = new Map<Category, TestLintFinding[]>(lintCategories.map(category => [category, []]));
  for (const finding of facts.result.findings) if (finding.rule.startsWith('wall-clock')) map.get(finding.rule as Category)!.push(finding);
  for (const call of facts.calls) map.get(call.message as Category)!.push(call);
  return map;
}
/** Freeze current counts, or lower each existing allowance without ever raising one. */
export async function shrinkLintBaseline(manifest: TierManifest, source: Source, baseline?: LintBaseline): Promise<LintBaseline> {
  if (baseline) validate(baseline);
  const files: LintBaseline['files'] = {};
  for (const [file, entry] of Object.entries(manifest.tests).sort(([a], [b]) => a.localeCompare(b))) {
    const counts: LintBaseline['files'][string] = {};
    for (const [category, findings] of categories(testLintFacts(file, await source(file), entry))) {
      const count = baseline ? Math.min(baseline.files[file]?.[category] ?? 0, findings.length) : findings.length;
      if (count) counts[category] = count;
    }
    files[file] = counts;
  }
  return { version: 1, files };
}
export async function checkTestLint(input: Snapshot & { manifest: TierManifest; source: Source; base?: Snapshot }): Promise<LintRefusal[]> {
  const { manifest, source, baseline, base = {} } = input;
  const findings: LintRefusal[] = [];
  try { if (baseline) validate(baseline); if (base.baseline) validate(base.baseline); }
  catch (error) { return [{ file: LINT_BASELINE, line: 1, rule: 'lint-baseline', message: String(error) }]; }
  // Before the one-time freeze, history supplies the existing debt.
  const previous = base.baseline ?? (base.manifest && base.source ? await shrinkLintBaseline(base.manifest, base.source) : { version: 1 as const, files: {} });
  if (base.baseline && !baseline) findings.push({ file: LINT_BASELINE, line: 1, rule: 'lint-baseline', message: 'frozen baseline must not be removed' });
  for (const [file, counts] of Object.entries(baseline?.files ?? {})) for (const [category, count] of Object.entries(counts)) {
    if (count > (previous.files[file]?.[category as Category] ?? 0)) findings.push({ file: LINT_BASELINE, line: 1, rule: 'lint-baseline', message: `baseline grew: ${file} [${category}]` });
  }
  const allowance = baseline ?? previous;
  for (const [file, entry] of Object.entries(manifest.tests).sort(([a], [b]) => a.localeCompare(b))) {
    const facts = testLintFacts(file, await source(file), entry);
    const isNew = !base.manifest?.tests[file];
    if (isNew) findings.push(...facts.result.findings.filter(f => ['tier-import', 'tier-process', 't3-lifecycle'].includes(f.rule)));
    for (const [category, calls] of categories(facts)) {
      if (!category.startsWith('wall-clock') && facts.lifecycle) continue;
      const allowed = allowance.files[file]?.[category] ?? 0;
      for (const call of calls.slice(allowed)) findings.push({ ...call, rule: category, message: `${category} count ${calls.length} exceeds frozen allowance ${allowed}` });
    }
  }
  return findings;
}
async function optional(source: Source, path: string): Promise<string | undefined> {
  try { return await source(path); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT' || (error as { code?: unknown }).code === 128) return;
    throw error;
  }
}
async function snapshot(source: Source): Promise<Snapshot> {
  const [tiers, baseline] = await Promise.all([optional(source, TIERS), optional(source, LINT_BASELINE)]);
  return { source, ...(tiers ? { manifest: JSON.parse(tiers) } : {}), ...(baseline ? { baseline: JSON.parse(baseline) } : {}) };
}
async function treeSnapshot(cwd: string, tree: string, env?: NodeJS.ProcessEnv): Promise<Snapshot> {
  const value = await snapshot(async file => (await promisify(execFile)('git', ['show', `${tree}:${file}`], { cwd, env, maxBuffer: 16 * 1024 * 1024, timeout: 30_000 })).stdout);
  let sources: Promise<Source> | undefined;
  return { ...value, source: async file => {
    sources ??= treeSources(cwd, tree, Object.keys(value.manifest?.tests ?? {}), env);
    return (await sources)(file);
  } };
}

/** Best-effort preparation, never an admission verdict. Coalesce dev moves and
 * yield before each file so startup and foreground requests remain responsive. */
export class TestLintWarmer {
  #pending: string | null = null;
  #warming: string | null = null;
  #warmed: string | null = null;
  #closed = false;
  #work: Promise<void> | null = null;
  readonly #cwd: string;
  readonly #env: NodeJS.ProcessEnv;
  readonly #log: LogFn;
  constructor(cwd: string, env: NodeJS.ProcessEnv, log: LogFn = () => {}) {
    this.#cwd = cwd; this.#env = env; this.#log = log;
  }
  request(head: string | null): void {
    if (this.#closed || !head || head === this.#warmed) return;
    if (head === this.#warming) { this.#pending = null; return; }
    this.#pending = head;
    this.#work ??= this.#drain().finally(() => {
      this.#work = null;
      if (this.#pending && !this.#closed) this.request(this.#pending);
    });
  }
  async #drain(): Promise<void> {
    while (!this.#closed && this.#pending) {
      const head = this.#pending;
      this.#pending = null;
      this.#warming = head;
      try {
        await yieldToRequests();
        if (this.#closed) return;
        const value = await treeSnapshot(this.#cwd, head, this.#env);
        const entries = Object.entries(value.manifest?.tests ?? {});
        let completed = true;
        for (const [file, entry] of entries) {
          const text = await value.source!(file);
          await yieldToRequests();
          if (this.#closed || this.#pending) { completed = false; break; }
          testLintFacts(file, text, entry);
        }
        if (completed && !this.#closed) {
          this.#warmed = head;
          this.#log({ event: 'test-lint-warmed', head, files: entries.length });
        }
      } catch (error) { if (!this.#closed) this.#log({ event: 'test-lint-warm-failed', head, error: String(error) }); }
      finally { this.#warming = null; }
    }
  }
  async close(): Promise<void> {
    this.#closed = true;
    this.#pending = null;
    await this.#work;
  }
}
/** Both gates judge the same immutable sources; dirty admission also judges disk. */
export async function testLintPolicy(cwd: string, options: { tree?: string; head?: string; base?: string; env?: NodeJS.ProcessEnv } = {}): Promise<LintRefusal[]> {
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
    const [current, base] = await Promise.all([
      options.tree ? treeSnapshot(cwd, options.tree, options.env) : snapshot(file => readFile(join(cwd, file), 'utf8')),
      (options.base ?? baseRef) ? treeSnapshot(cwd, options.base ?? baseRef!, options.env) : Promise.resolve({} as Snapshot),
    ]);
    if (!current.manifest) return base.baseline ? [{ file: TIERS, line: 1, rule: 'lint-baseline', message: 'tier manifest must not be removed while lint baseline is frozen' }] : [];
    if (!base.baseline && current.baseline) {
      // During the first baseline's publication, dev can move underneath its
      // branch without owning the freeze yet. Keep that validated first freeze;
      // do not silently derive a new allowance from the advanced merge base.
      const introduced = (await git(['log', '--reverse', '--format=%H', '--diff-filter=A', options.head ?? 'HEAD', '--', LINT_BASELINE]).catch(() => '')).split('\n').find(Boolean);
      if (introduced) {
        const frozen = await treeSnapshot(cwd, introduced, options.env);
        if (!frozen.manifest || !frozen.baseline) return [{ file: LINT_BASELINE, line: 1, rule: 'lint-baseline', message: 'original freeze requires a tier manifest and baseline' }];
        const parent = await git(['rev-parse', `${introduced}^`]).catch(() => introduced);
        const before = await treeSnapshot(cwd, parent, options.env);
        // Validate the seed against its own original debt before trusting it.
        // A root commit seeds from its sources; an inflated seed still refuses.
        const invalid = await checkTestLint({ manifest: frozen.manifest, source: frozen.source!, baseline: frozen.baseline,
          base: { ...(before.manifest ? { manifest: before.manifest } : {}), source: before.source! } });
        if (invalid.length) return invalid;
        base.baseline = frozen.baseline;
      }
    }
    return await checkTestLint({ ...current, manifest: current.manifest, source: current.source!, base });
  } catch (error) {
    return [{ file: LINT_BASELINE, line: 1, rule: 'lint-baseline', message: `cannot read test lint policy: ${String(error)}` }];
  }
}
export async function shrinkTestLint(cwd: string): Promise<void> {
  const source: Source = file => readFile(join(cwd, file), 'utf8');
  const current = await snapshot(source);
  if (!current.manifest || !current.baseline) throw new Error('shrink requires the frozen lint baseline and tier manifest');
  await writeFile(join(cwd, LINT_BASELINE), JSON.stringify(await shrinkLintBaseline(current.manifest, source, current.baseline), null, 2) + '\n');
}
