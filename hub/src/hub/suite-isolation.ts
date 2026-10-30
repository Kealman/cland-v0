import type { SystemProcess } from '../process-table.ts';
import { fixtureOwnedRoots } from '../../../shared/fixture-roots.ts';
import { createHash } from 'node:crypto';
import { pidAlive } from '../project.ts';
import { processStartedAsync } from './lock.ts';
import { processPaths } from '../process-paths.ts';
import { processIdentityAsync } from '../process-identity.ts';
import { isAbsolute, relative, resolve, join, dirname } from 'node:path';
import { realpathSync } from 'node:fs';
import type { SuiteJob } from './suites.ts';

function contained(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel === '' || rel !== '..' && !rel.startsWith('../') && !isAbsolute(rel);
}
/** Check ancestors as well as lexical paths: a scratch symlink grants no authority. */
function inside(root: string, path: string): boolean {
  let canonicalRoot: string;
  try { canonicalRoot = realpathSync(root); } catch { return false; }
  if (!contained(resolve(root), resolve(path)) && !contained(canonicalRoot, resolve(path))) return false;
  let ancestor = resolve(path);
  for (;;) {
    try { return contained(canonicalRoot, realpathSync(ancestor)); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') return false;
      const parent = dirname(ancestor);
      if (parent === ancestor) return false;
      ancestor = parent;
    }
  }
}
const pathFields = new Set(['cwd', 'log', 'result', 'gate', 'locks']);
export function outsideSuitePath(root: string, value: unknown, field = '', env: NodeJS.ProcessEnv = {}): boolean {
  const roots = fixtureOwnedRoots(root, env);
  const scan = (part: unknown, key: string): boolean => {
    if (typeof part === 'string') return (isAbsolute(part) || pathFields.has(key)) && !roots.some(owned => inside(owned, part));
    if (Array.isArray(part)) return part.some(child => scan(child, key));
    if (part && typeof part === 'object') return Object.entries(part).some(([name, child]) => scan(child, name));
    return false;
  };
  return scan(value, field);
}
/** A copied receipt retains historical facts, never execution or recovery authority. */
export function sealSuiteJob(job: SuiteJob, root: string): SuiteJob {
  const scrub = (value: unknown, field = ''): unknown => {
    if (typeof value === 'string' && (isAbsolute(value) || pathFields.has(field))) return join(root, 'excluded-suite-path');
    if (Array.isArray(value)) return value.map(part => scrub(part, field));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, part]) => [key, scrub(part, key)]));
    return value;
  };
  const completed = job.reported && job.cleaned && !job.accountingPending && job.outcome != null
    && (job.state === undefined || job.state === 'finished');
  const sealed = scrub(job) as SuiteJob;
  delete sealed.lease; delete sealed.config; delete sealed.commands; delete sealed.hostGate;
  delete sealed.shards; delete sealed.locks;
  sealed.artifact = null;
  sealed.pid = null; sealed.started = null;
  sealed.state = 'finished'; sealed.cleaned = true; sealed.reported = true;
  sealed.accountingPending = false;
  if (!completed) sealed.outcome = { code: 1, cause: 'isolated copy: unfinished recovery excluded', notRun: 'infrastructure' };
  return sealed;
}

/** Apply after artifact redirects resolve, immediately before a native log reader. */
export function isolatedSuiteEvidencePath(root: string, id: string, path: string, env: NodeJS.ProcessEnv = {}): string {
  if (outsideSuitePath(root, path, 'log', env)) throw new Error(`isolated verification refused evidence for ${id}: resolved path outside root`);
  return path;
}

/** Copied PID/birth facts alone grant no authority over a process outside the fixture. */
export async function isolatedSuiteProcessOwned(root: string, job: SuiteJob, env: NodeJS.ProcessEnv): Promise<{ owned: false } | { owned: true; identity?: string }> {
  if (!job.pid) return { owned: true };
  const resource = job.lease?.resource as { identity?: string | null } | undefined;
  try {
    let exited = false;
    const identity = await processIdentityAsync(job.pid, env, undefined, () => { exited = true; });
    // Absence permits receipt/report recovery, never grants a new live signal target.
    if (exited || !pidAlive(job.pid)) return { owned: true };
    if (!identity || resource?.identity && resource.identity !== identity) return { owned: false };
    // Older rows have a captured ps start but no native birth. Bind that surviving
    // receipt to the observed owned cwd and stable native birth before restoring.
    if (!resource?.identity && (!job.started || await processStartedAsync(job.pid, undefined, undefined, undefined, env) !== job.started)) return { owned: false };
    const paths = await processPaths(job.pid, Date.now() + 3000);
    if (paths.cwd === null || !fixtureOwnedRoots(root, env).some(owned => inside(owned, paths.cwd!)) || await processIdentityAsync(job.pid, env) !== identity) return { owned: false };
    return { owned: true, identity };
  } catch { return { owned: false }; }
}

/** Publish an explicit unavailable receipt using only new files owned by this hub. */
export function isolatedUnavailableReport(job: SuiteJob, root: string, now: string): SuiteJob {
  const report = sealSuiteJob(job, root);
  const dir = join(root, '.cland', 'run', 'isolated-reports', createHash('sha256').update(job.id).digest('hex'));
  report.cwd = root; report.log = join(dir, 'suite.log');
  report.result = join(dir, 'result.json'); report.gate = join(dir, 'gate');
  report.reported = false; report.error = null; report.finished ??= now;
  report.outcome = { code: 1, cause: 'log unavailable (outside isolated root)', notRun: 'infrastructure' };
  report.budgetReported = true; report.tierReported = true; report.progressReported = true;
  delete report.cached;
  return report;
}

/** A gone leader's group is not an authority grant. Validate every live tree or
 * same-group member before TERM can forward or escalation can signal a child. */
export type SuiteLaunchAuthority = { pid: number; identity: string; births: Map<number, string> };
export async function isolatedSuiteSignalTargets(root: string, targets: SystemProcess[], snapshot: SystemProcess[], env: NodeJS.ProcessEnv, launch?: SuiteLaunchAuthority): Promise<boolean> {
  const pids = new Set(targets.map(row => row.pid)), groups = new Set(targets.map(row => row.group));
  const roots = fixtureOwnedRoots(root, env);
  const live: SystemProcess[] = [];
  for (const row of snapshot.filter(row => pids.has(row.pid) || groups.has(row.group))) {
    let exited = false;
    const identity = await processIdentityAsync(row.pid, env, undefined, () => { exited = true; });
    if (exited || !pidAlive(row.pid)) continue;
    if (!row.identity || identity !== row.identity) return false;
    live.push(row);
  }
  // Only a native ancestry observed from this executor's own launch can extend
  // its authority. A group number, persisted lease or newly reused PID cannot.
  const admitted = new Map(live.filter(row => launch?.births.get(row.pid) === row.identity).map(row => [row.pid, row.identity!]));
  for (let changed = true; changed;) {
    changed = false;
    for (const row of live) if (!admitted.has(row.pid) && admitted.has(row.parent)) {
      admitted.set(row.pid, row.identity!); changed = true;
    }
  }
  for (const row of live) {
    const paths = await processPaths(row.pid, Date.now() + 3000);
    if (!admitted.has(row.pid) && (!paths.cwd || !roots.some(owned => inside(owned, paths.cwd!)))) return false;
    if (await processIdentityAsync(row.pid, env) !== row.identity) return false;
  }
  for (const [pid, birth] of admitted) launch?.births.set(pid, birth);
  return true;
}

/** One legacy default for admission and report-only classification. */
export function suiteRecoveryState(job: Pick<SuiteJob, 'state' | 'outcome' | 'reported'>): NonNullable<SuiteJob['state']> {
  return job.state ?? (job.outcome || job.reported ? 'finished' : 'running');
}
