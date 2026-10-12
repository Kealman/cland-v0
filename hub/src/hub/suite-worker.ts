// Detached from both the CLI and the hub. Completion is a durable receipt, not a socket callback.
import { spawn, execFile } from 'node:child_process';
import { readFile, access, rename, writeFile } from 'node:fs/promises';
import { setTimeout as pause } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { candidateTree } from '../verification-tree.ts';
import { processStartedAsync } from './lock.ts';
import { acquireBroker, sweepLease, type Lease } from '../suite-lock.ts';
import type { SuiteSelection } from '../suite-selection.ts';

export async function suiteWorker(input: string): Promise<void> {
  const job = JSON.parse(await readFile(input, 'utf8')) as { cwd: string; mode: string; gate: string; result: string; selection?: SuiteSelection; locks?: string[]; head?: string; queued?: string; tree?: string | null };
  let signal: NodeJS.Signals | null = null;
  let active: ReturnType<typeof spawn> | undefined;
  for (const name of ['SIGINT', 'SIGTERM'] as const) process.on(name, () => {
    if (signal) return;
    signal = name;
    // The worker owns this detached group; npm and the package lock runner receive the signal too.
    try { process.kill(-process.pid, name); } catch { active?.kill(name); }
  });
  const admissionDeadline = Date.now() + 15000;
  let admitted = false;
  while (!(admitted = await access(job.gate).then(() => true, () => false))) {
    if (signal || Date.now() >= admissionDeadline) break;
    await pause(25);
  }
  if (admitted && job.queued) process.stdout.write(`verification queue wait ${((Date.now() - Date.parse(job.queued)) / 1000).toFixed(2)}s\n`);
  let code = 0;
  let cause = admitted ? '' : 'hub stopped before worker admission completed';
  const leases: Lease[] = [];
  const token = randomUUID();
  const dirs = job.locks ?? ['/tmp/cland-suite.lock', '/tmp/cland-suite-nvim.lock'];
  try {
    const started = await processStartedAsync(process.pid);
    if (!started) throw new Error('cannot establish compatibility lease identity');
    const holder = { pid: process.pid, started, startedUtc: await processStartedAsync(process.pid, undefined, undefined, 'UTC'), token, since: new Date().toISOString(), worktree: job.cwd };
    if (admitted && !signal) leases.push(...await acquireBroker(dirs, () => signal !== null, holder));
    const checkHead = async () => {
      const head = await promisify(execFile)('git', ['rev-parse', 'HEAD'], { cwd: job.cwd }).then(r => r.stdout.trim(), () => 'unknown');
      if (job.head && head !== job.head) throw new Error(`cancelled: submitted head ${job.head} changed to ${head}; submit verification again`);
      if (job.tree && await candidateTree(job.cwd, head) !== job.tree) throw new Error('cancelled: candidate tree changed or worktree became dirty; submit verification again');
    };
    await checkHead();
    // Pre-V1 branches do not know how to borrow a worker lease. Protect their typecheck,
    // then let their unchanged package runner take the legacy locks itself.
    const runner = await readFile(join(job.cwd, 'hub', 'test', 'run-suite.ts'), 'utf8').catch(() => null);
    const borrowable = runner === null || runner.includes('inheritedLease');
    const commands = [['run', 'typecheck'], ...(job.selection?.mode === 'full' ? [['test']] : job.mode === 'hub' ? [['test', '--workspace', 'hub']] : job.mode === 'nvim' ? [['run', 'test:nvim']] : [['test']])];
    if (!admitted) code = 1;
    for (const [index, args] of (admitted ? commands : []).entries()) {
      if (index === 1 && !borrowable) for (const lease of leases.splice(0).reverse()) await lease.release();
      if (signal) break;
      process.stdout.write(`\n$ npm ${args.join(' ')}\n`);
      const env: NodeJS.ProcessEnv = { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' };
      delete env.NODE_TEST_CONTEXT;
      delete env.CLAND_TEST_SKIP_LOCK;
      delete env.CLAND_SUITE_LEASE;
      if (leases.length && borrowable) env.CLAND_SUITE_LEASE = JSON.stringify({ dirs, pid: holder.pid, started, token: holder.token });
      // One durable decision feeds the package runner and the result, even after restart.
      if (job.selection) env.CLAND_SUITE_SELECTION = JSON.stringify(job.selection);
      else delete env.CLAND_SUITE_SELECTION;
      active = spawn('npm', args, { cwd: job.cwd, env, stdio: ['ignore', 'inherit', 'inherit'] });
      const outcome = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
        active!.once('error', reject);
        active!.once('close', (code, signal) => resolve({ code, signal }));
      });
      active = undefined;
      code = outcome.code ?? 1;
      if (outcome.signal) cause = `npm terminated by ${outcome.signal}`;
      if (code !== 0) break;
    }
    if (admitted && !signal && code === 0) await checkHead();
  } catch (error) { code = 1; cause = error instanceof Error ? error.message : String(error); }
  finally {
    try {
      if (leases.length) await sweepLease(dirs, token);
      for (const lease of leases.reverse()) await lease.release();
    } catch (error) { code = 1; cause = `compatibility cleanup failed: ${String(error)}`; }
  }
  if (signal) { code = signal === 'SIGINT' ? 130 : 143; cause = `worker interrupted by ${signal}`; }
  process.stdout.write(`\nFinished: exit ${code}${cause ? `; ${cause}` : ''}\n`);
  await writeFile(`${job.result}.tmp`, JSON.stringify({ code, cause, finished: new Date().toISOString() }), { mode: 0o600 });
  await rename(`${job.result}.tmp`, job.result);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await suiteWorker(process.argv[2]!);
