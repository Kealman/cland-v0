// Durable hub-owned suite jobs. A worker can outlive hub shutdown; restart watches its receipt/PID.
import { spawn, execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { open, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pidAlive } from '../project.ts';
import { promisify } from 'node:util';
import type { SuiteStatus } from '../protocol.ts';
import type { LogFn } from '../log.ts';
import type { Store } from './store.ts';
import { systemProcesses, endProcess } from '../system-processes.ts';
import { processStartedAsync } from './lock.ts';
import { compatibilityOccupied } from '../suite-lock.ts';
import { selectPackageSuite, describeSelection, type SuiteSelection, type SuiteRequest } from '../suite-selection.ts';

export type SuiteActor = { name: string; sessionId: string; shell: true };
export type SuiteJob = {
  id: string; mode: string; cwd: string; topic: string; to: string[]; actor: SuiteActor | null;
  head: string; branch: string; log: string; result: string; gate: string;
  pid: number | null; started: string | null; outcome: { code: number; cause: string } | null;
  artifact: string | null; reported: boolean; error: string | null; cleaned?: boolean;
  cancelled?: boolean;
  selection?: SuiteSelection;
  integrated?: boolean;
  queued?: string; priority?: number; item?: string | null;
  state?: 'queued' | 'launching' | 'running' | 'finished';
  locks?: string[]; requesterDied?: boolean;
};
export type SuiteSchedulerOptions = { budget?: number; locks?: string[]; requesterDead?: (actor: SuiteActor) => boolean; log?: LogFn };
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
  readonly #inspecting = new Map<string, Promise<void>>();
  readonly #starting = new Set<Promise<unknown>>();
  #closed = false;
  readonly #launching = new Set<string>();
  readonly #budget: number;
  readonly #options: SuiteSchedulerOptions;
  constructor(store: Store, root: string, report: (job: Readonly<SuiteJob>, checkpointArtifact: (id: string) => void) => Promise<void>, options: SuiteSchedulerOptions = {}) {
    this.#options = options;
    this.#budget = Math.min(options.budget ?? 1, 1);
    if ((options.budget ?? 1) > 1) options.log?.({ event: 'verification-budget-capped', configured: options.budget, effective: this.#budget, reservedFor: 'T-215' });
    this.#store = store; this.#root = root; this.#report = report;
    this.#jobs = JSON.parse(store.meta(KEY) ?? '[]') as SuiteJob[];
    for (const job of this.#jobs) job.state ??= job.outcome || job.reported ? 'finished' : 'running';
    this.#timer = setInterval(() => { void this.#check(); }, 1000);
    this.#timer.unref();
  }
  #save = () => { this.#store.setMeta(KEY, JSON.stringify(this.#jobs)); };
  #active = (job: SuiteJob) => !job.reported && (!job.outcome || (job.outcome.code !== 0 && !job.cleaned));
  async cancel(id: string | undefined, actor: SuiteActor | null, authorize: () => void): Promise<{ id: string; topic: string; cancelled: true }> {
    if (this.#closed) throw new Error('hub is closing');
    authorize();
    const job = id ? this.#jobs.find(job => job.id === id)
      : this.#jobs.findLast(job => this.#active(job) && (job.actor?.sessionId ?? null) === (actor?.sessionId ?? null));
    if (!job) throw new Error(id ? `no suite named ${id}` : 'this session has no suite queued or running');
    if (actor && job.actor?.sessionId !== actor.sessionId) throw new Error('cannot cancel another session’s suite; only the human may cancel any run');
    // Reconcile only this run. Other submissions, cleanup and reports must not delay cancellation.
    await this.#inspectJob(job);
    if (this.#closed) throw new Error('hub is closing');
    authorize();
    if (!job.cancelled) {
      if (job.outcome || job.reported) throw new Error('suite already finished');
      // Persist before signalling: restart, late receipts and reporting retries retain this outcome.
      job.cancelled = true; job.outcome = { code: 143, cause: 'cancelled' }; this.#save();
    }
    void this.#inspectJob(job);
    return { id: job.id, topic: job.topic, cancelled: true };
  }
  start(input: Pick<SuiteJob, 'mode' | 'cwd' | 'topic' | 'to' | 'actor'> & { priority?: number; item?: string | null; integrated?: boolean }, authorize: () => void): Promise<{ id: string; pid: number | null; topic: string; position: number }> {
    if (this.#closed) return Promise.reject(new Error('hub is closing'));
    const work = this.#start(input, authorize);
    this.#starting.add(work);
    void work.finally(() => this.#starting.delete(work)).catch(() => {});
    return work;
  }
  async #start(input: Pick<SuiteJob, 'mode' | 'cwd' | 'topic' | 'to' | 'actor'> & { priority?: number; item?: string | null; integrated?: boolean }, authorize: () => void): Promise<{ id: string; pid: number | null; topic: string; position: number }> {
    const identity = input.actor?.sessionId ?? 'human';
    if (this.#jobs.some(job => this.#active(job) && (job.actor?.sessionId ?? 'human') === identity)) throw new Error('this session already has a suite queued or running');
    const id = randomUUID();
    const dir = join(this.#root, '.cland', 'run', 'suites', id);
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const git = async (args: string[]) => exec('git', args, { cwd: input.cwd }).then(r => r.stdout.trim(), () => 'unknown');
    const [head, branch, selection] = await Promise.all([git(['rev-parse', 'HEAD']), git(['branch', '--show-current']), selectPackageSuite(input.cwd, input.mode as SuiteRequest)]);
    authorize();
    // Recheck after I/O: concurrent submissions cannot both reserve a session.
    if (this.#jobs.some(job => this.#active(job) && (job.actor?.sessionId ?? 'human') === identity)) throw new Error('this session already has a suite queued or running');
    const job: SuiteJob = { ...input, integrated: input.integrated === true && branch === 'dev', queued: new Date().toISOString(), priority: input.priority ?? Number.MAX_SAFE_INTEGER, state: 'queued', locks: this.#options.locks ?? ['/tmp/cland-suite.lock', '/tmp/cland-suite-nvim.lock'], selection, id, head, branch, log: join(dir, 'suite.log'), result: join(dir, 'result.json'), gate: join(dir, 'ready'), pid: null, started: null, outcome: null, artifact: null, reported: false, error: null };
    // Persist the complete request before acknowledging it. No waiting worker exists.
    await writeFile(job.log, `Suite ${id} · ${input.mode}\n${describeSelection(selection)}\nWorktree ${input.cwd}\nBranch ${branch}\nHead ${head}\nQueued ${job.queued}\n`, { mode: 0o600 });
    authorize();
    if (this.#closed) throw new Error('hub is closing');
    if (this.#jobs.some(j => this.#active(j) && (j.actor?.sessionId ?? 'human') === identity)) throw new Error('this session already has a suite queued or running');
    this.#jobs.push(job); this.#save();
    await this.#check();
    return { id, pid: job.pid, topic: job.topic, position: job.state === 'queued' ? this.#queue().findIndex(j => j.id === id) + 1 : 1 };
  }
  #queue(): SuiteJob[] {
    return this.#jobs.filter(j => j.state === 'queued' && !j.outcome).sort((a, b) => Number(b.integrated === true) - Number(a.integrated === true) || (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER) || (a.queued ?? '').localeCompare(b.queued ?? ''));
  }
  async #launch(job: SuiteJob): Promise<void> {
    const dir = join(this.#root, '.cland', 'run', 'suites', job.id);
    job.state = 'launching'; this.#launching.add(job.id); this.#save();
    const admit = () => { if (job.outcome) throw new Error('suite cancelled before worker admission'); };
    try {
      // A queued build cannot silently turn into a different tested head.
      const head = await exec('git', ['rev-parse', 'HEAD'], { cwd: job.cwd }).then(r => r.stdout.trim(), () => 'unknown');
      if (head !== job.head) throw new Error(`cancelled: queued head changed from ${job.head} to ${head}; submit verification again`);
      await writeFile(join(dir, 'job.json'), JSON.stringify(job), { mode: 0o600 });
      const fd = await open(job.log, 'a');
      try {
        admit();
        const env = { ...process.env };
        // Package scripts need a fresh Node test context.
        delete env.NODE_TEST_CONTEXT;
        delete env.CLAND_SUITE_LEASE;
        const child = spawn(process.execPath, [fileURLToPath(new URL('./suite-worker.ts', import.meta.url)), join(dir, 'job.json')], { cwd: job.cwd, env, detached: true, stdio: ['ignore', fd.fd, fd.fd] });
        child.once('error', error => { if (this.#closed) return; job.outcome ??= { code: 1, cause: `worker could not start: ${error.message}` }; this.#save(); });
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
        admit();
        job.state = 'running'; this.#save();
        await writeFile(job.gate, 'ready');
      } finally { await fd.close(); }
    } catch (error) {
      // Keep the failure receipt: the inspector only terminates identity-verified processes.
      job.outcome ??= { code: 1, cause: error instanceof Error ? error.message : String(error) }; this.#save();
    } finally { this.#launching.delete(job.id); if (job.cancelled) void this.#inspectJob(job); }
  }
  #check(): Promise<void> {
    if (this.#checking) return this.#checking;
    if (this.#closed) return Promise.resolve();
    this.#checking = this.#tick().catch(error => { this.#options.log?.({ event: 'verification-admission-blocked', error: String(error) }); }).finally(() => { this.#checking = null; });
    return this.#checking;
  }
  async #tick(): Promise<void> {
    await Promise.all(this.#jobs.map(job => this.#inspectJob(job)));
    if (this.#closed) return;
    const active = this.#jobs.filter(j => !j.reported && (j.state !== 'queued' && !j.outcome || j.outcome && j.outcome.code !== 0 && !j.cleaned)).length;
    if (active >= this.#budget) return;
    const next = this.#queue()[0];
    if (next && !await compatibilityOccupied(next.locks!) && !this.#closed && next.state === 'queued' && !next.outcome) await this.#launch(next);
  }
  #inspectJob(job: SuiteJob): Promise<void> {
    const pending = this.#inspecting.get(job.id);
    if (pending) return pending;
    if (this.#closed || job.reported || this.#launching.has(job.id)) return Promise.resolve();
    const work = this.#inspect(job).catch(() => { /* saved errors are retried on the next tick */ }).finally(() => { this.#inspecting.delete(job.id); });
    this.#inspecting.set(job.id, work);
    return work;
  }
  async #inspect(job: SuiteJob): Promise<void> {
    if (job.state === 'queued' && !job.outcome) {
      if (!job.actor || !this.#options.requesterDead?.(job.actor)) return;
      job.requesterDied = true;
      job.outcome = { code: 130, cause: 'cancelled: requester died before admission' };
    }
    try {
      const receipt = await readFile(job.result, 'utf8').then(text => JSON.parse(text) as { code: number; cause: string }, () => null);
      if (receipt && !job.cancelled && !job.requesterDied) job.outcome = receipt;
      if (!job.outcome) {
        if (job.pid && pidAlive(job.pid)) {
          const current = await processStartedAsync(job.pid);
          if (job.started === null || current === null || current === job.started) return;
        }
        job.outcome = { code: 1, cause: 'worker disappeared (killed or crashed without an exit receipt)' };
      }
      job.state = 'finished'; this.#save();
      if (job.outcome.code !== 0 && !job.cleaned) {
        if (job.pid && !job.started && pidAlive(job.pid)) throw new Error('suite cleanup waiting for a verified worker identity; process preserved');
        if (job.pid && job.started) {
          // Launch failures can leave the worker live; endProcess rechecks its positive PID
          // immediately before signalling. Missing/reused leaders preserve unrelated processes.
          if (!await endProcess({ pid: job.pid, pidStarted: job.started }, () => {}, job.cancelled ? 10000 : 500, undefined, { allowReused: true })) throw new Error('suite cleanup could not verify the worker identity');
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
  requesterExited(sessionId: string): void {
    for (const job of this.#jobs) {
      if (job.actor?.sessionId !== sessionId || job.state !== 'queued' || job.outcome) continue;
      job.requesterDied = true;
      job.outcome = { code: 130, cause: 'cancelled: requester died before admission' };
    }
    this.#save(); void this.#check();
  }
  status(): SuiteStatus[] {
    return this.#jobs.map(job => ({
      id: job.id, pid: job.pid, topic: job.topic, reported: job.reported, outcome: job.outcome, error: job.error,
      state: job.state ?? 'running', queued: job.queued ?? null, priority: job.priority ?? null,
      item: job.item ?? null, head: job.head, branch: job.branch, integrated: job.integrated ?? false,
      ...(job.selection ? { selection: job.selection } : {}),
    }));
  }
  async close(): Promise<void> { this.#closed = true; clearInterval(this.#timer); await Promise.allSettled(this.#starting); await this.#checking; await Promise.allSettled(this.#inspecting.values()); }
}
