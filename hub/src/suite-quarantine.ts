import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AdmissionTimeoutReceipt } from './test-admission-outcome.ts';

export const QUARANTINE_MANIFEST = 'hub/test/quarantine.json';
export type QuarantineEntry = { owner: string; reason: string; added: string; expires: string };
export type QuarantineManifest = { version: 1; tests: Record<string, QuarantineEntry> };
export type QuarantineResult = { file: string; name: string; outcome: 'pass' | 'fail' | 'skip'; entry: QuarantineEntry };
export type TestFailure = { file: string; name: string };
export type QuarantineReceipt = { complete: boolean; cancelled: number; failures: TestFailure[]; results: QuarantineResult[]; excused: number; admissionTimeouts?: AdmissionTimeoutReceipt[] };

/** Structured runner records take precedence over Node's raw diagnostic rendering. */
export function suiteTestFailures(log: string): TestFailure[] | null {
  const lines = log.split('\n').filter(line => line.startsWith('suite test failures '));
  return lines.length ? lines.flatMap(line => JSON.parse(line.slice('suite test failures '.length)) as TestFailure[]) : null;
}

export function quarantineResults(log: string): QuarantineResult[] {
  return log.split('\n').filter(line => line.startsWith('suite quarantine ')).map(line => JSON.parse(line.slice('suite quarantine '.length)) as QuarantineResult);
}

export function quarantineSummary(results: QuarantineResult[]): string[] {
  return results.map(r => `quarantine ${r.outcome} ${r.file}::${r.name} · owner ${r.entry.owner} · expires ${r.entry.expires}`);
}

export type QuarantineHistory = Record<string, { entry: string; runs: Array<{ id: string; outcome: QuarantineResult['outcome'] }> }>;

/** One observation per identity and real run. Smoke repeats are conservative:
 * any failure or skip breaks the streak, even if another phase passed. */
export function recordQuarantineResults(history: QuarantineHistory, id: string, results: QuarantineResult[], cached = false): { history: QuarantineHistory; lines: string[] } {
  const next = structuredClone(history);
  const byIdentity = new Map<string, QuarantineResult>();
  const rank = { pass: 0, skip: 1, fail: 2 };
  for (const result of results) {
    const key = `${result.file}::${result.name}`;
    const previous = byIdentity.get(key);
    if (!previous || rank[result.outcome] > rank[previous.outcome]) byIdentity.set(key, result);
  }
  const lines: string[] = [];
  for (const [key, result] of byIdentity) {
    const fingerprint = JSON.stringify(result.entry);
    let entry = next[key];
    if (!entry || entry.entry !== fingerprint) entry = { entry: fingerprint, runs: [] };
    if (!cached) {
      if (!entry.runs.some(run => run.id === id)) entry.runs.push({ id, outcome: result.outcome });
      entry.runs = entry.runs.slice(-20);
      next[key] = entry;
    }
    let greens = 0;
    for (const run of entry.runs.toReversed()) { if (run.outcome !== 'pass') break; greens++; }
    lines.push(`${quarantineSummary([result])[0]} · ${greens === 20 ? 'cleared · ' : ''}${greens} consecutive green${cached ? ' (cached; no new observation)' : ''}`);
  }
  return { history: next, lines };
}

export function lintQuarantineManifest(manifest: unknown, now = Date.now()): asserts manifest is QuarantineManifest {
  const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
  if (!object(manifest) || manifest.version !== 1 || !object(manifest.tests)) throw new Error(`invalid quarantine manifest: ${QUARANTINE_MANIFEST}`);
  const date = (value: unknown): number => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value ? Date.parse(value) : NaN;
  for (const [key, entry] of Object.entries(manifest.tests)) {
    const file = key.split('::')[0]!;
    if (!/^(?:hub|nvim)\/(?:test|src)\/[^:]+\.test\.ts::\S.*$/.test(key) || file.includes('\\') || file.split('/').some(part => !part || part === '.' || part === '..') || !object(entry)) throw new Error(`invalid quarantine: ${key}`);
    if (typeof entry.owner !== 'string' || !/^T-[1-9]\d*$/.test(entry.owner)) throw new Error(`quarantine needs an owner ticket: ${key}`);
    if (typeof entry.reason !== 'string' || !entry.reason.trim() || /\bTODO\b/i.test(entry.reason)) throw new Error(`quarantine needs a non-TODO reason: ${key}`);
    const added = date(entry.added), expires = date(entry.expires);
    if (!Number.isFinite(added) || !Number.isFinite(expires) || added > now || expires <= added || expires - added > 7 * 86_400_000) throw new Error(`quarantine needs valid dates at most seven days apart: ${key}`);
    if (now >= expires) throw new Error(`expired quarantine: ${key}`);
  }
}

export async function readQuarantineManifest(cwd: string): Promise<QuarantineManifest | null> {
  let manifest: unknown;
  try { manifest = JSON.parse(await readFile(join(cwd, QUARANTINE_MANIFEST), 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  lintQuarantineManifest(manifest);
  return manifest;
}
