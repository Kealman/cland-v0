import { glob, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectRoot } from './project.ts';
import { parseItem } from './tracker/item.ts';
import type { Tier } from './suite-shards.ts';

export const DURATION_MANIFEST = 'hub/test/durations.json';
export type TierBudget = { testSeconds: number; fileSeconds: number; wallSeconds: number };
export type TestTiming = { file: string; name: string; seconds: number };
export const TIER_BUDGETS = {
  T1: { testSeconds: 0.5, fileSeconds: 10, wallSeconds: 120 },
  T2: { testSeconds: 2, fileSeconds: 30, wallSeconds: 480 },
  T3: { testSeconds: 10, fileSeconds: 120, wallSeconds: 900 },
  T4: null,
};
export type DurationManifest = {
  version: 1;
  source: { artifacts: string[]; commit: string };
  budget: { mode?: 'report' | 'enforce'; testSeconds: number; fileSeconds: number; T1?: TierBudget; T2?: TierBudget; T3?: TierBudget; T4?: null };
  files: Record<string, { seconds: number; tests: number }>;
  tests: Record<string, number>;
  allow: Record<string, { file?: true; seconds: number; reason: string; owner?: string; added?: string; expires?: string; legacy?: true }>;
};
export const timingKey = (test: TestTiming): string => `${test.file}::${test.name}`;
export type DurationRegression = { key: string; before: number; now: number; budget?: number };
const seconds = (value: number) => Number(value.toFixed(3)).toString();

export function checkDurations(tests: TestTiming[], manifest: DurationManifest, tiers: Record<string, Tier> = {}): { failures: string[]; regressions: DurationRegression[] } {
  const failures: string[] = [];
  const regressions: DurationRegression[] = [];
  const over = (key: string, now: number, budget: number) => failures.push(`duration budget: ${key} ${seconds(now)} s > ${seconds(budget)} s (add to ${DURATION_MANIFEST} with a reason)`);
  const compare = (key: string, now: number, before: number | undefined, budget: number) => {
    if (now > budget) {
      if (before === undefined) over(key, now, budget);
      else regressions.push({ key, before, now, budget });
    } else if (before !== undefined && now - before >= 1 && now >= before * 1.5) regressions.push({ key, before, now });
  };
  const enforce = (key: string, file: string, now: number, kind: 'testSeconds' | 'fileSeconds') => {
    const tier = tiers[file];
    if (!tier) { failures.push(`duration budget: missing tier for ${file}`); return; }
    const budget = (manifest.budget[tier] ?? TIER_BUDGETS[tier])?.[kind];
    if (budget === undefined || now <= budget || now <= (manifest.allow[key]?.seconds ?? -1)) return;
    failures.push(`duration budget: ${key} ${seconds(now)} s > ${seconds(budget)} s (${tier}) (add to ${DURATION_MANIFEST} with a reason)`);
  };
  for (const test of tests) {
    const key = timingKey(test);
    if (manifest.budget.mode === 'enforce') enforce(key, test.file, test.seconds, 'testSeconds');
    else compare(key, test.seconds, manifest.tests[key] ?? manifest.allow[key]?.seconds, manifest.budget.testSeconds);
  }
  for (const [path, file] of Object.entries(fileTimings(tests))) {
    if (manifest.budget.mode === 'enforce') enforce(path, path, file.seconds, 'fileSeconds');
    else compare(path, file.seconds, manifest.files[path]?.seconds ?? manifest.allow[path]?.seconds, manifest.budget.fileSeconds);
  }
  return { failures, regressions };
}

export function durationRegressions(regressions: DurationRegression[]): string[] {
  // Smoke repeats or retries do not consume another slot in the report.
  const byTest = new Map<string, DurationRegression>();
  for (const regression of regressions) {
    if (!byTest.has(regression.key) || byTest.get(regression.key)!.now < regression.now) byTest.set(regression.key, regression);
  }
  return [...byTest.values()].sort((a, b) => (b.now - b.before) - (a.now - a.before) || a.key.localeCompare(b.key)).slice(0, 5)
    .map(r => `duration regression ${r.key} ${seconds(r.before)} s → ${seconds(r.now)} s${r.budget === undefined ? '' : ` (over budget: ${seconds(r.budget)} s)`}`);
}

export async function readDurationManifest(cwd: string): Promise<DurationManifest | null> {
  try {
    const manifest = JSON.parse(await readFile(join(cwd, DURATION_MANIFEST), 'utf8')) as DurationManifest;
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error(`invalid duration manifest: ${DURATION_MANIFEST}`);
    return manifest;
  }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}

export function lintDurationManifest(manifest: DurationManifest, options: { now?: number; owners?: Record<string, string>; legacyKeys?: ReadonlySet<string> } = {}): void {
  const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
  const time = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  if (!object(manifest) || manifest.version !== 1 || !object(manifest.budget) || !time(manifest.budget.testSeconds) || manifest.budget.testSeconds <= 0 || !time(manifest.budget.fileSeconds) || manifest.budget.fileSeconds <= 0 || !object(manifest.files) || !object(manifest.tests) || !object(manifest.allow)) throw new Error(`invalid duration manifest: ${DURATION_MANIFEST}`);
  if (manifest.budget.mode !== undefined && manifest.budget.mode !== 'report' && manifest.budget.mode !== 'enforce') throw new Error('invalid duration budget mode: expected report or enforce');
  for (const tier of ['T1', 'T2', 'T3'] as const) {
    const budget = manifest.budget[tier];
    if (budget !== undefined && (!object(budget) || ![budget.testSeconds, budget.fileSeconds, budget.wallSeconds].every(value => time(value) && value > 0))) throw new Error(`invalid duration tier budget: ${tier}`);
  }
  if (manifest.budget.T4 !== undefined && manifest.budget.T4 !== null) throw new Error('invalid duration tier budget: T4');
  const now = options.now ?? Date.now();
  const date = (value: unknown): number => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value ? Date.parse(value) : NaN;
  for (const [key, entry] of Object.entries(manifest.allow)) {
    if (!object(entry) || !time(entry.seconds) || (key.includes('::') || key === 'T3' ? entry.file !== undefined : entry.file !== true)) throw new Error(`invalid duration allowance: ${key}`);
    if (typeof entry.reason !== 'string' || !entry.reason.trim() || /\bTODO\b/i.test(entry.reason)) throw new Error(`duration allowance needs a non-TODO reason: ${key}`);
    if (typeof entry.owner !== 'string' || !/^[A-Z]+-[1-9]\d*$/.test(entry.owner)) throw new Error(`duration allowance needs an open owner item: ${key}`);
    if (options.owners && options.owners[entry.owner] !== 'open') throw new Error(`duration allowance has ${options.owners[entry.owner] === 'closed' ? 'closed' : 'unknown'} owner ${entry.owner}: ${key}`);
    if (entry.legacy !== undefined && entry.legacy !== true) throw new Error(`invalid legacy duration allowance: ${key}`);
    if (entry.legacy === true) {
      if (options.legacyKeys && !options.legacyKeys.has(key)) throw new Error(`new duration allowance cannot be legacy: ${key}`);
      if (entry.owner !== 'E-677' || entry.added !== undefined || entry.expires !== undefined) throw new Error(`legacy duration allowance needs owner E-677 and expires on owner closure: ${key}`);
    } else {
      const added = date(entry.added), expires = date(entry.expires);
      if (!Number.isFinite(added) || !Number.isFinite(expires) || added > now || expires <= added || expires - added > 7 * 86_400_000) throw new Error(`duration allowance needs valid dates at most seven days apart: ${key}`);
      if (now >= expires) throw new Error(`expired duration allowance: ${key}`);
    }
  }
  for (const [key, value] of Object.entries(manifest.tests)) if (!time(value)) throw new Error(`invalid duration baseline: ${key}`);
  for (const [key, value] of Object.entries(manifest.files)) if (!object(value) || !time(value.seconds) || !Number.isInteger(value.tests) || value.tests < 0) throw new Error(`invalid duration file baseline: ${key}`);
}

export function fileTimings(tests: TestTiming[]): DurationManifest['files'] {
  const files: DurationManifest['files'] = {};
  for (const test of tests) {
    const file = files[test.file] ??= { seconds: 0, tests: 0 };
    file.seconds += test.seconds; file.tests++;
  }
  return files;
}

/** Admission checks ownership in the live authoritative tracker, including linked worktrees. */
export async function durationOwners(cwd: string, manifest: DurationManifest): Promise<Record<string, string>> {
  const owners: Record<string, string> = {};
  for (const owner of new Set(Object.values(manifest.allow).map(entry => entry.owner))) {
    if (!owner || !/^[A-Z]+-[1-9]\d*$/.test(owner)) continue;
    for await (const path of glob(`.cland/tasks/${owner}-*.md`, { cwd: projectRoot(cwd) })) {
      const item = parseItem(await readFile(join(projectRoot(cwd), path), 'utf8'));
      if (item.fm.id === owner) owners[owner] = item.fm.state;
    }
  }
  return owners;
}
