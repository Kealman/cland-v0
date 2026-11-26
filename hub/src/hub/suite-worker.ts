import { SUITE_INFRASTRUCTURE_EXIT, suiteCommandOutcome } from '../suite-infrastructure.ts';
import * as timingFs from 'node:fs';
import { readTimingReceipts, parseTimingReceipts } from '../suite-timing-receipts.ts';
import { withoutExecutorCredentials } from '../../../shared/executor-credentials.ts';
import { verificationSteps, verificationStepCommand } from '../verification-plan.ts';
import { receiptStep, type TierReceipt } from '../verification-tier-receipts.ts';
// Detached from both the CLI and the hub. Completion is a durable receipt, not a socket callback.
import { execFile } from 'node:child_process';
import { readFile, access, rename, writeFile } from 'node:fs/promises';
import { realClock } from '../../../shared/clock.ts';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { platform as osPlatform, arch, release } from 'node:os';
import type { Platform, RunRef } from '../executor/executor.ts';
import { candidateTree } from '../verification-tree.ts';
import { processStartedAsync } from './lock.ts';
import { SuiteTicketLost, acquireBroker, sweepLease, type Lease } from '../suite-lock.ts';
import { selectionTransport } from '../suite-selection.ts';
import { clandRunner, recordedCommands } from '../verification-commands.ts';
import { suiteCommand, SuiteCommandPublicationError, type SuiteInspectionReceipt } from '../suite-command.ts';
import { compatibilityCleanupCause, runWorkerWithAdmission } from '../suite-worker-admission.ts';
export { compatibilityCleanupCause } from '../suite-worker-admission.ts';

export function compatibilityCleanupOutcome(selected: { code: number; cause: string } | null, error: unknown) {
  return suiteCommandOutcome(selected?.code ?? 1, compatibilityCleanupCause(selected?.cause ?? '', error));
}

const workerNative = { processStartedAsync, suiteCommand };
export async function suiteWorker(input: string, native = workerNative): Promise<void> {
  const job = JSON.parse(await readFile(input, 'utf8')) as RunRef;
  let signal: NodeJS.Signals | null = null;
  for (const name of ['SIGINT', 'SIGTERM'] as const) process.on(name, () => {
    if (signal) return;
    signal = name;
    // The worker owns this detached group; npm and the package lock runner receive the signal too.
    try { process.kill(-process.pid, name); } catch { /* command supervisor also receives this signal */ }
  });
  await runWorkerWithAdmission({
    gate: () => access(job.gate).then(() => true, () => false),
    signal: () => signal, clock: realClock,
    run: () => runAdmittedWorker(job, () => signal, native),
    log: line => { process.stdout.write(line); },
    diagnostic: line => { process.stderr.write(`${line}\n`); },
    persist: async receipt => {
      await writeFile(`${job.result}.tmp`, JSON.stringify(receipt), { mode: 0o600 });
      await rename(`${job.result}.tmp`, job.result);
    },
  });
}

async function runAdmittedWorker(job: RunRef, signal: () => NodeJS.Signals | null, native: typeof workerNative) {
  if (job.queued) process.stdout.write(`verification queue wait ${((Date.now() - Date.parse(job.queued)) / 1000).toFixed(2)}s; wall interval\n`);
  let code = 0;
  const inspections: Array<{ commandId: string; receipt: SuiteInspectionReceipt }> = [];
  const tierReceipts: TierReceipt[] = [];
  let cause = '';
  let selected: { code: number; cause: string } | null = null;
  let currentCommandId: string | null = null;
  let platform: Platform | undefined;
  const leases: Lease[] = [];
  const token = randomUUID();
  const dirs = job.locks ?? ['/tmp/cland-suite.lock', '/tmp/cland-suite-nvim.lock'];
  try {
    const started = await native.processStartedAsync(process.pid);
    if (!started) throw new Error('cannot establish compatibility lease identity');
    const holder = { pid: process.pid, started, startedUtc: await native.processStartedAsync(process.pid, undefined, undefined, 'UTC'), token, since: new Date().toISOString(), worktree: job.cwd, ...(job.integrated ? { integrated: job.id } : {}) };
    if (!signal()) leases.push(...await acquireBroker(dirs, () => signal() !== null, holder));
    const checkHead = async () => {
      const head = await promisify(execFile)('git', ['rev-parse', 'HEAD'], { cwd: job.cwd }).then(r => r.stdout.trim(), () => 'unknown');
      if (job.head && head !== job.head && !(job.integrated && job.tree)) throw new Error(`cancelled: submitted head ${job.head} changed to ${head}; submit verification again`);
      if (job.tree && await candidateTree(job.cwd, job.integrated ? undefined : head) !== job.tree) throw new Error('cancelled: candidate tree changed or worktree became dirty; submit verification again');
    };
    await checkHead();
    // Pre-V1 branches do not know how to borrow a worker lease. Protect their typecheck,
    // then let their unchanged package runner take the legacy locks itself.
    const runner = await clandRunner(job.cwd);
    const borrowable = runner === null || runner.inheritedLease;
    const node = (await promisify(execFile)('node', ['--version'], { cwd: job.cwd, env: withoutExecutorCredentials(process.env) })).stdout.trim();
    const nvim = await readFile(join(job.cwd, 'nvim', 'NVIM_VERSION'), 'utf8').then(text => text.trim(), () => 'none');
    platform = { os: osPlatform(), arch: arch(), release: release(), node, nvim };
    process.stdout.write(`platform ${platform.os} ${platform.arch} ${platform.release} · Node ${node} · Neovim ${nvim}\n`);
    const commands = recordedCommands(job);
    if (!commands.check) process.stdout.write('check: not set\n');
    for (const step of verificationSteps(commands)) {
      const { name, command: line } = step;
      if (name !== 'check' && !borrowable) for (const lease of leases.splice(0).reverse()) await lease.release();
      if (signal()) break;
      if (name === 'check') process.stdout.write('typecheck: local\n');
      process.stdout.write(`\n$ ${line}\n`);
      const commandId = randomUUID();
      currentCommandId = commandId;
      process.stdout.write(`suite command start ${JSON.stringify({ id: commandId, name, line })}\n`);
      const env: NodeJS.ProcessEnv = { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' };
      env.CLAND_TIMING_OUTPUT = join(dirname(job.result), 'timing-receipts.json');
      env.CLAND_TIMING_OWNER = JSON.stringify({ run: job.id, head: job.head, tree: job.tree ?? '', command: line, step: name });
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
      env.CLAND_SUITE_CAUSE_FILE = join(dirname(job.result), 'command-cause');
      const outcome = await receiptStep(tierReceipts, job, step, () => native.suiteCommand(verificationStepCommand(step), job.cwd, withoutExecutorCredentials(env), undefined,
        receipt => inspections.push({ commandId, receipt })));
      code = outcome.code;
      cause = outcome.cause;
      if (code !== 0) selected = { code, cause };
      process.stdout.write(`\nsuite command end ${commandId} ${outcome.code}\n`);
      if (code !== 0) break;
    }
    if (!signal() && code === 0) await checkHead();
    // A successful command becomes the worker result after candidate validation.
    selected ??= { code, cause };
  } catch (error) {
    if (error instanceof SuiteCommandPublicationError && currentCommandId && !inspections.some(row => row.commandId === currentCommandId)) {
      inspections.push({ commandId: currentCommandId, receipt: error.inspection });
    }
    if (selected) { code = selected.code; cause = `${selected.cause}; secondary diagnostic: worker completion failed: ${String(error)}`; }
    else {
      code = error instanceof SuiteTicketLost ? SUITE_INFRASTRUCTURE_EXIT : 1;
      cause = error instanceof SuiteTicketLost ? `suite infrastructure: ${error.message}` : error instanceof Error ? error.message : String(error);
      selected = { code, cause };
    }
  }
  finally {
    try {
      // The hub captures descendants before interrupting us. Preserve ownership
      // until it confirms their death; a detached child may still write the root.
      if (!signal()) {
        if (leases.length) await sweepLease(dirs, token);
        for (const lease of leases.reverse()) await lease.release();
      }
    } catch (error) { ({ code, cause } = compatibilityCleanupOutcome(selected ? { code, cause } : null, error)); }
  }
  const timingReceipts = readTimingReceipts(timingFs, join(dirname(job.result), 'timing-receipts.json'), parseTimingReceipts);
  return { code, cause, tierReceipts, ...(timingReceipts ? { timingReceipts } : {}), ...(platform ? { platform } : {}), ...(inspections.length ? { inspections } : {}) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await suiteWorker(process.argv[2]!);
