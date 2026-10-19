import { verificationSteps, verificationStepCommand } from '../verification-plan.ts';
// Detached from both the CLI and the hub. Completion is a durable receipt, not a socket callback.
import { execFile } from 'node:child_process';
import { readFile, access, rename, writeFile } from 'node:fs/promises';
import { setTimeout as pause } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { platform as osPlatform, arch, release } from 'node:os';
import type { Platform, RunRef } from '../executor/executor.ts';
import { candidateTree } from '../verification-tree.ts';
import { processStartedAsync } from './lock.ts';
import { acquireBroker, sweepLease, type Lease } from '../suite-lock.ts';
import { selectionTransport } from '../suite-selection.ts';
import { recordedCommands } from '../verification-commands.ts';
import { suiteCommand } from '../suite-command.ts';

export function compatibilityCleanupCause(cause: string, error: unknown): string {
  const cleanup = `compatibility cleanup failed: ${String(error)}`;
  return cause ? `${cause}; ${cleanup}` : cleanup;
}

export async function suiteWorker(input: string): Promise<void> {
  const job = JSON.parse(await readFile(input, 'utf8')) as RunRef;
  let signal: NodeJS.Signals | null = null;
  for (const name of ['SIGINT', 'SIGTERM'] as const) process.on(name, () => {
    if (signal) return;
    signal = name;
    // The worker owns this detached group; npm and the package lock runner receive the signal too.
    try { process.kill(-process.pid, name); } catch { /* command supervisor also receives this signal */ }
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
  let platform: Platform | undefined;
  const leases: Lease[] = [];
  const token = randomUUID();
  const dirs = job.locks ?? ['/tmp/cland-suite.lock', '/tmp/cland-suite-nvim.lock'];
  try {
    const started = await processStartedAsync(process.pid);
    if (!started) throw new Error('cannot establish compatibility lease identity');
    const holder = { pid: process.pid, started, startedUtc: await processStartedAsync(process.pid, undefined, undefined, 'UTC'), token, since: new Date().toISOString(), worktree: job.cwd, ...(job.integrated ? { integrated: job.id } : {}) };
    if (admitted && !signal) leases.push(...await acquireBroker(dirs, () => signal !== null, holder));
    const checkHead = async () => {
      const head = await promisify(execFile)('git', ['rev-parse', 'HEAD'], { cwd: job.cwd }).then(r => r.stdout.trim(), () => 'unknown');
      if (job.head && head !== job.head && !(job.integrated && job.tree)) throw new Error(`cancelled: submitted head ${job.head} changed to ${head}; submit verification again`);
      if (job.tree && await candidateTree(job.cwd, job.integrated ? undefined : head) !== job.tree) throw new Error('cancelled: candidate tree changed or worktree became dirty; submit verification again');
    };
    await checkHead();
    // Pre-V1 branches do not know how to borrow a worker lease. Protect their typecheck,
    // then let their unchanged package runner take the legacy locks itself.
    const runner = await readFile(join(job.cwd, 'hub', 'test', 'run-suite.ts'), 'utf8').catch(() => null);
    const borrowable = runner === null || runner.includes('inheritedLease');
    const node = (await promisify(execFile)('node', ['--version'], { cwd: job.cwd, env: process.env })).stdout.trim();
    const nvim = await readFile(join(job.cwd, 'nvim', 'NVIM_VERSION'), 'utf8').then(text => text.trim(), () => 'none');
    platform = { os: osPlatform(), arch: arch(), release: release(), node, nvim };
    process.stdout.write(`platform ${platform.os} ${platform.arch} ${platform.release} · Node ${node} · Neovim ${nvim}\n`);
    const commands = recordedCommands(job);
    if (!admitted) code = 1;
    if (!commands.check) process.stdout.write('check: not set\n');
    for (const step of (admitted ? verificationSteps(commands) : [])) {
      const { name, command: line } = step;
      if (name !== 'check' && !borrowable) for (const lease of leases.splice(0).reverse()) await lease.release();
      if (signal) break;
      if (name === 'check') process.stdout.write('typecheck: local\n');
      process.stdout.write(`\n$ ${line}\n`);
      const env: NodeJS.ProcessEnv = { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' };
      env.CLAND_SUITE_EXECUTOR = 'local';
      if (job.limits) { env.CLAND_SUITE_LIMITS = JSON.stringify(job.limits); env.CLAND_SUITE_LIMITS_CWD = job.cwd; }
      if (job.workers !== undefined) env.CLAND_SUITE_WORKERS = String(job.workers);
      else delete env.CLAND_SUITE_WORKERS;
      delete env.NODE_TEST_CONTEXT;
      delete env.CLAND_TEST_SKIP_LOCK;
      delete env.CLAND_SUITE_LEASE;
      if (leases.length && borrowable) env.CLAND_SUITE_LEASE = JSON.stringify({ dirs, pid: holder.pid, started, token: holder.token });
      // One durable decision feeds the package runner and the result, even after restart.
      delete env.CLAND_SUITE_SELECTION;
      delete env.CLAND_SUITE_SELECTION_FILE;
      if (job.selection) {
        const path = join(dirname(job.result), 'selection.json');
        const transport = selectionTransport(job.selection, path);
        if (transport.file) await writeFile(path, transport.file, { mode: 0o600 });
        Object.assign(env, transport.env);
      }
      if (job.selection?.recordCoverage && name !== 'check') env.CLAND_COVERAGE_OUTPUT = join(dirname(job.result), 'coverage-map.json');
      else delete env.CLAND_COVERAGE_OUTPUT;
      if (commands.plan && name !== 'check') env.CLAND_COVERAGE_APPEND = '1';
      else delete env.CLAND_COVERAGE_APPEND;
      const outcome = await suiteCommand(verificationStepCommand(step), job.cwd, env);
      code = outcome.code;
      cause = outcome.cause;
      if (code !== 0) break;
    }
    if (admitted && !signal && code === 0) await checkHead();
  } catch (error) { code = 1; cause = error instanceof Error ? error.message : String(error); }
  finally {
    try {
      if (leases.length) await sweepLease(dirs, token);
      for (const lease of leases.reverse()) await lease.release();
    } catch (error) { code = 1; cause = compatibilityCleanupCause(cause, error); }
  }
  if (signal) { code = signal === 'SIGINT' ? 130 : 143; cause = `worker interrupted by ${signal}`; }
  process.stdout.write(`\nFinished: exit ${code}${cause ? `; ${cause}` : ''}\n`);
  await writeFile(`${job.result}.tmp`, JSON.stringify({ code, cause, finished: new Date().toISOString(), ...(platform ? { platform } : {}) }), { mode: 0o600 });
  await rename(`${job.result}.tmp`, job.result);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await suiteWorker(process.argv[2]!);
