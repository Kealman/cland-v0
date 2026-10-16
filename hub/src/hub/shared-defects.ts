import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { AGENTS, type HubCore } from './core.ts';
import type { SuiteJob } from './suites.ts';

/** Stable file::test identities from package-runner failure receipts.
 * Node's final spec summary pairs a declaration location with a failure title;
 * assertion stack locations deliberately do not participate in identity.
 */
export function failingTests(log: string): string[] {
  const failures = new Set<string>();
  let file: string | undefined;
  const add = (file: string, name: string) => failures.add(`${file}::${name.replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/g, '<timestamp>')}`);
  for (const line of log.replace(/\x1b\[[0-9;]*m/g, '').split('\n')) {
    const gate = /^✖ load gate: (.+?)::(.+) ([0-4])\/5 passed\s*$/.exec(line);
    if (gate) { add(gate[1]!, gate[2]!); continue; }
    const location = /^test at (.+):\d+:\d+\s*$/.exec(line);
    if (location) {
      // Runners execute in scratch roots; absolute and ../ paths carry the
      // candidate's package path after its checkout prefix.
      file = /(?:^|\/)((?:hub|nvim)\/(?:test|src)\/.+)$/.exec(location[1]!)?.[1];
      continue;
    }
    const failed = /^✖ (.+) \([\d.]+m?s\)\s*$/.exec(line);
    if (file && failed) { add(file, failed[1]!); file = undefined; }
  }
  return [...failures];
}

const KEY = 'shared-defect-history';
const RETENTION = 72 * 60 * 60 * 1000;
const exec = promisify(execFile);
type FailureRun = { id: string; branch: string; head: string; item: string; artifact: string; path: string; at: number; base: string | null; lastChanged: string | null };
type History = Array<{ identity: string; runs: FailureRun[]; notifiedAt?: number }>;

/** Report candidates, never verdicts. State and notice commit together so parallel
 * completions and reporter retries cannot create duplicate notices. */
export async function reportSharedDefects(core: HubCore, job: Readonly<SuiteJob>, log: string, artifact: { id: string; path: string }, authorize: () => unknown, now = Date.now()): Promise<void> {
  const cutoff = now - RETENTION;
  const at = Date.parse(job.completedAt ?? job.finished ?? '') || now;
  const eligible = /^T-\d+$/.test(job.item ?? '') && job.branch && !['dev', 'unknown', 'HEAD'].includes(job.branch) && !job.integrated && !job.cached && !job.cancelled && !job.requesterDied && job.outcome && job.outcome.code !== 0 && at >= cutoff;
  const identities = eligible ? failingTests(log) : [];
  const provenance = new Map<string, { base: string | null; lastChanged: string | null }>();
  if (identities.length) {
    const git = async (...args: string[]) => (await exec('git', args, { cwd: job.cwd, timeout: 5000, maxBuffer: 64 * 1024 })).stdout.trim();
    const base = await git('merge-base', job.selection?.fetchedDev ?? 'origin/dev', job.head).catch(() => null);
    for (const identity of identities) {
      const file = identity.split('::')[0]!;
      if (provenance.has(file)) continue;
      const lastChanged = base ? await git('log', '-1', '--format=%H', base, '--', file).catch(() => null) : null;
      provenance.set(file, { base, lastChanged: lastChanged || null });
    }
  }
  authorize(); // Git I/O may outlive the caller's current permissions.
  core.store.transaction(() => {
    const history = (JSON.parse(core.store.meta(KEY) ?? '[]') as History).map(entry => ({
      ...entry, runs: entry.runs.filter(run => run.at >= cutoff),
      ...(entry.notifiedAt !== undefined && entry.notifiedAt < cutoff ? { notifiedAt: undefined } : {}),
    })).filter(entry => entry.runs.length || entry.notifiedAt !== undefined);
    for (const identity of identities) {
      let entry = history.find(entry => entry.identity === identity);
      if (!entry) { entry = { identity, runs: [] }; history.push(entry); }
      if (!entry.runs.some(run => run.id === job.id)) entry.runs.push({ id: job.id, branch: job.branch, head: job.head, item: job.item!, artifact: artifact.id, path: artifact.path, at, ...provenance.get(identity.split('::')[0]!)! });
      const first = entry.runs[0]!;
      const second = entry.runs.find(run => run.branch !== first.branch);
      if (!second || entry.notifiedAt !== undefined) continue;
      const runs = [first, second];
      const text = `shared-defect candidate ${identity}\n${runs.map(run => `Run ${run.id} · ${run.item} · branch ${run.branch} · head ${run.head}\nLog ${run.artifact}: ${run.path}\ntest file last changed ${run.lastChanged ?? 'unavailable'} · dev merge-base ${run.base ?? 'unavailable'}`).join('\n')}\nCoordinator: triage and post one shared fix; affected Implementers report to their item lead and hold diagnosis.`;
      const id = `shared-defect:${createHash('sha256').update(`${identity}:${first.id}`).digest('hex')}`;
      if (!core.noticeTo(AGENTS.id, { id, kind: 'shared-defect', to: ['coordinator'], text: core.boundedText(text), detail: { event: 'shared-defect', identity, runs } })) throw new Error('shared-defect notice topic unavailable');
      entry.notifiedAt = now;
    }
    core.store.setMeta(KEY, JSON.stringify(history));
  });
}
