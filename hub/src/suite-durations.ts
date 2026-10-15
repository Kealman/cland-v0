import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const DURATION_MANIFEST = 'hub/test/durations.json';
export type TestTiming = { file: string; name: string; seconds: number };
export type DurationManifest = {
  version: 1;
  source: { artifacts: string[]; commit: string };
  budget: { testSeconds: number; fileSeconds: number };
  files: Record<string, { seconds: number; tests: number }>;
  tests: Record<string, number>;
  allow: Record<string, { file?: true; seconds: number; reason: string }>;
};
export const timingKey = (test: TestTiming): string => `${test.file}::${test.name}`;
export type DurationRegression = { key: string; before: number; now: number; budget?: number };
const seconds = (value: number) => Number(value.toFixed(3)).toString();

export function checkDurations(tests: TestTiming[], manifest: DurationManifest): { failures: string[]; regressions: DurationRegression[] } {
  const failures: string[] = [];
  const regressions: DurationRegression[] = [];
  const over = (key: string, now: number, budget: number) => failures.push(`duration budget: ${key} ${seconds(now)} s > ${seconds(budget)} s (add to ${DURATION_MANIFEST} with a reason)`);
  const compare = (key: string, now: number, before: number | undefined, budget: number) => {
    if (now > budget) {
      if (before === undefined) over(key, now, budget);
      else regressions.push({ key, before, now, budget });
    } else if (before !== undefined && now - before >= 1 && now >= before * 1.5) regressions.push({ key, before, now });
  };
  for (const test of tests) {
    const key = timingKey(test);
    compare(key, test.seconds, manifest.tests[key] ?? manifest.allow[key]?.seconds, manifest.budget.testSeconds);
  }
  for (const [path, file] of Object.entries(fileTimings(tests))) {
    compare(path, file.seconds, manifest.files[path]?.seconds ?? manifest.allow[path]?.seconds, manifest.budget.fileSeconds);
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

export function lintDurationManifest(manifest: DurationManifest): void {
  const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
  const time = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  if (!object(manifest) || manifest.version !== 1 || !object(manifest.budget) || !time(manifest.budget.testSeconds) || manifest.budget.testSeconds <= 0 || !time(manifest.budget.fileSeconds) || manifest.budget.fileSeconds <= 0 || !object(manifest.files) || !object(manifest.tests) || !object(manifest.allow)) throw new Error(`invalid duration manifest: ${DURATION_MANIFEST}`);
  for (const [key, entry] of Object.entries(manifest.allow)) {
    if (!object(entry) || !time(entry.seconds) || (key.includes('::') ? entry.file !== undefined : entry.file !== true)) throw new Error(`invalid duration allowance: ${key}`);
    if (typeof entry.reason !== 'string' || !entry.reason.trim() || /\bTODO\b/i.test(entry.reason)) throw new Error(`duration allowance needs a non-TODO reason: ${key}`);
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
