// Durable hub-owned suite jobs. A worker can outlive hub shutdown; restart watches its receipt/PID.
import { spawn, execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { open, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pidAlive } from '../project.ts';
import { promisify } from 'node:util';
import type { Store } from './store.ts';
import { systemProcesses, endProcess } from '../system-processes.ts';
import { processStartedAsync } from './lock.ts';
import { selectPackageSuite, describeSelection, type SuiteSelection, type SuiteRequest } from '../suite-selection.ts';

export type SuiteActor = { name: string; sessionId: string; shell: true };
export type SuiteJob = {
  id: string; mode: string; cwd: string; topic: string; to: string[]; actor: SuiteActor | null;
  head: string; branch: string; log: string; result: string; gate: string;
  pid: number | null; started: string | null; outcome: { code: number; cause: string } | null;
  artifact: string | null; reported: boolean; error: string | null; cleaned?: boolean;
  selection?: SuiteSelection;
};
const KEY = 'suite-jobs';
const exec = promisify(execFile);
export function suiteSummary(log: string): string {
  const text = log.replace(/\x1b\[[0-9;]*m/g, '');
  const counts = new Map<string, number>();
  for (const match of text.matchAll(/^(?:#|ℹ) (tests|pass|fail|cancelled|skipped|todo) (\d+)\s*$/gm)) counts.set(match[1]!, (counts.get(match[1]!) ?? 0) + Number(match[2]));
  const failures = text.split('\n').filter(line => /^(?:\s*not ok \d+|✖ )/.test(line)).slice(0, 12).map(line => line.slice(0, 200));
  return `${counts.size ? [...counts].map(([k, v]) => `${k} ${v}`).join('; ') : 'counts unavailable (suite did not finish)'}${failures.length ? `\nFailures:\n${failures.join('\n')}` : ''}`;
}

export class Suites {
  readonly #store: Store;
  readonly #root: string;
  readonly #report: (job: Readonly<SuiteJob>, checkpointArtifact: (id: string) => void) => Promise<void>;
  readonly #jobs: SuiteJob[];
  readonly #timer: ReturnType<typeof setInterval>;
  #checking: Promise<void> | null = null;
  readonly #starting = new Set<Promise<unknown>>();
  #closed = false;
  readonly #launching = new Set<string>();
  constructor(store: Store, root: string, report: (job: Readonly<SuiteJob>, checkpointArtifact: (id: string) => void) => Promise<void>) {
    this.#store = store; this.#root = root; this.#report = report;
    this.#jobs = JSON.parse(store.meta(KEY) ?? '[]') as SuiteJob[];
    this.#timer = setInterval(() => { void this.#check(); }, 1000);
    this.#timer.unref();
  }
  #save = () => { this.#store.setMeta(KEY, JSON.stringify(this.#jobs)); };
  start(input: Pick<SuiteJob, 'mode' | 'cwd' | 'topic' | 'to' | 'actor'>, authorize: () => void): Promise<{ id: string; pid: number; topic: string; position: number }> {
    if (this.#closed) return Promise.reject(new Error('hub is closing'));
    const work = this.#start(input, authorize);
    this.#starting.add(work);
    void work.finally(() => this.#starting.delete(work)).catch(() => {});
    return work;
  }
  async #start(input: Pick<SuiteJob, 'mode' | 'cwd' | 'topic' | 'to' | 'actor'>, authorize: () => void): Promise<{ id: string; pid: number; topic: string; position: number }> {
    const identity = input.actor?.sessionId ?? 'human';
    if (this.#jobs.some(job => !job.reported && !job.outcome && (job.actor?.sessionId ?? 'human') === identity)) throw new Error('this session already has a suite queued or running');
    const id = randomUUID();
    const dir = join(this.#root, '.cland', 'run', 'suites', id);
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const git = async (args: string[]) => exec('git', args, { cwd: input.cwd }).then(r => r.stdout.trim(), () => 'unknown');
    const [head, branch, selection] = await Promise.all([git(['rev-parse', 'HEAD']), git(['branch', '--show-current']), selectPackageSuite(input.cwd, input.mode as SuiteRequest)]);
    authorize();
    // Recheck after I/O: concurrent submissions cannot both reserve a session.
    if (this.#jobs.some(job => !job.reported && !job.outcome && (job.actor?.sessionId ?? 'human') === identity)) throw new Error('this session already has a suite queued or running');
    const job: SuiteJob = { ...input, selection, id, head, branch, log: join(dir, 'suite.log'), result: join(dir, 'result.json'), gate: join(dir, 'ready'), pid: null, started: null, outcome: null, artifact: null, reported: false, error: null };
    this.#launching.add(id); this.#jobs.push(job); this.#save();
    try {
      await writeFile(join(dir, 'job.json'), JSON.stringify(job), { mode: 0o600 });
      await writeFile(job.log, `Suite ${id} · ${input.mode}\n${describeSelection(selection)}\nWorktree ${input.cwd}\nBranch ${branch}\nHead ${head}\nStarted ${new Date().toISOString()}\n`, { mode: 0o600 });
      const fd = await open(job.log, 'a');
      try {
        authorize();
        const env = { ...process.env };
        // Package scripts need a fresh Node test context.
        delete env.NODE_TEST_CONTEXT;
        const child = spawn(process.execPath, [fileURLToPath(new URL('./suite-worker.ts', import.meta.url)), join(dir, 'job.json')], { cwd: input.cwd, env, detached: true, stdio: ['ignore', fd.fd, fd.fd] });
        child.once('error', error => { if (this.#closed) return; job.outcome = { code: 1, cause: `worker could not start: ${error.message}` }; this.#save(); });
        child.once('close', (code, signal) => {
          if (this.#closed) return;
          if (signal || code !== 0) job.outcome ??= { code: code ?? 1, cause: signal ? `worker killed by ${signal}` : `worker exited ${code}` };
          // A zero worker exit is a pass only when its durable package result exists.
          this.#save(); void this.#check();
        });
        child.unref();
        job.pid = child.pid ?? null;
        job.started = job.pid ? await processStartedAsync(job.pid) : null;
        this.#save();
        if (!job.pid || !job.started) throw new Error('cannot establish suite worker process identity');
        authorize();
        await writeFile(job.gate, 'ready');
      } finally { await fd.close(); }
    } catch (error) {
      // Keep the failure receipt: the inspector only terminates identity-verified processes.
      job.outcome = { code: 1, cause: error instanceof Error ? error.message : String(error) }; this.#save();
      throw error;
    } finally { this.#launching.delete(id); }
    return { id, pid: job.pid ?? 0, topic: job.topic, position: this.#jobs.filter(j => !j.outcome && !j.reported).length };
  }
  #check(): Promise<void> {
    if (this.#checking) return this.#checking;
    if (this.#closed) return Promise.resolve();
    this.#checking = this.#inspect().catch(() => { /* saved errors are retried on the next tick */ }).finally(() => { this.#checking = null; });
    return this.#checking;
  }
  async #inspect(): Promise<void> {
    for (const job of this.#jobs) {
      if (this.#closed) return;
      if (job.reported || this.#launching.has(job.id)) continue;
      try {
        const receipt = await readFile(job.result, 'utf8').then(text => JSON.parse(text) as { code: number; cause: string }, () => null);
        if (receipt) job.outcome = receipt;
        if (!job.outcome) {
          if (job.pid && pidAlive(job.pid)) {
            const current = await processStartedAsync(job.pid);
            if (job.started === null || current === null || current === job.started) continue;
          }
          job.outcome = { code: 1, cause: 'worker disappeared (killed or crashed without an exit receipt)' };
        }
        this.#save();
        if (job.outcome.code !== 0 && !job.cleaned) {
          if (job.pid && !job.started && pidAlive(job.pid)) throw new Error('suite cleanup waiting for a verified worker identity; process preserved');
          if (job.pid && job.started) {
            // Launch failures can leave the worker live; endProcess rechecks its positive PID
            // immediately before signalling. Missing/reused leaders preserve unrelated processes.
            if (!await endProcess({ pid: job.pid, pidStarted: job.started }, () => {}, 500, undefined, { allowReused: true })) throw new Error('suite cleanup could not verify the worker identity');
            const rows = await systemProcesses();
            const leader = rows.find(row => row.pid === job.pid);
            if (!leader || leader.started === job.started) {
              for (const row of rows.filter(row => row.group === job.pid && row.pid !== job.pid)) {
                if (!await endProcess({ pid: row.pid, pidStarted: row.started }, () => {}, 500, undefined, { allowReused: true })) throw new Error('suite crash cleanup could not verify a surviving process');
              }
            }
          }
          job.cleaned = true; this.#save();
        }
        await this.#report(job, id => {
          if (job.artifact !== null && job.artifact !== id) throw new Error('suite artifact checkpoint already settled');
          job.artifact = id; this.#save();
        });
        job.reported = true; job.error = null; this.#save();
      } catch (error) { job.error = error instanceof Error ? error.message : String(error); this.#save(); }
    }
  }
  status(): Array<Pick<SuiteJob, 'id' | 'pid' | 'topic' | 'reported' | 'outcome' | 'error'>> { return this.#jobs.map(({ id, pid, topic, reported, outcome, error }) => ({ id, pid, topic, reported, outcome, error })); }
  async close(): Promise<void> { this.#closed = true; clearInterval(this.#timer); await Promise.allSettled(this.#starting); await this.#checking; }
}
