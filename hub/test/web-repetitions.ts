// Whole-file Web admission is separate from duration measurements and the normal
// identity load gate. Call only while holding the runner's machine lease.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { Worker } from 'node:worker_threads';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { admittedWebRepetitions, repeatWebFiles, webRepeatSummary } from '../src/web-repetitions.ts';
import { prepareRunnerFixture } from './fixture-directories.ts';
import { runnerFixtureEnvironment } from './fixture-environment.ts';
import { captureProcess, cleanupOwnedProcesses, type ProcessIdentity } from './process-cleanup.ts';

export async function runWebRepetitions(options: { files: string[] | undefined; planned: string[]; root: string; cwd: string; env: NodeJS.ProcessEnv;
  interrupted: () => boolean; active: Set<ProcessIdentity>; emit: (line: string) => void }): Promise<void> {
  const { root, cwd, emit } = options;
  const files = admittedWebRepetitions(options.files, options.planned, emit);
  if (!files) return;
  if (!files.length) { await repeatWebFiles([], async () => { throw new Error('empty plan'); }, emit, options.interrupted); return; }
  await prepareRunnerFixture(root);
  const state = new Int32Array(new SharedArrayBuffer(8));
  const load = new Worker(`const { parentPort, workerData } = require('node:worker_threads');
const state = new Int32Array(workerData);
parentPort.postMessage('ready');
while (!Atomics.load(state, 0)) { let n = 0; for (let i = 0; i < 100000; i++) n += Math.sqrt(i); Atomics.add(state, 1, 1); }`,
    { eval: true, workerData: state.buffer, env: runnerFixtureEnvironment(root, options.env) });
  const exited = once(load, 'exit');
  void exited.catch(() => {}); // Observed below even when setup fails first.
  const ready = once(load, 'message');
  let readyTimer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([ready, new Promise<never>((_, reject) => { readyTimer = setTimeout(() => reject(new Error('Web CPU load setup exceeded 5 s')), 5000); })]);
    clearTimeout(readyTimer);
    await repeatWebFiles(files, async (file, repetition, worker) => {
      const owned = join(root, `web-repeat-${files.indexOf(file)}-${repetition}`);
      await mkdir(owned);
      await prepareRunnerFixture(owned);
      const receipt = join(owned, 'summary.json');
      const bootstrap = join(owned, 'bootstrap.mjs');
      const gate = join(owned, 'start');
      // Parent and child both stay in an owned cwd; tests resolve source imports
      // from the candidate while fixture ownership remains per repetition.
      await writeFile(bootstrap, `import { access } from 'node:fs/promises'; import { setTimeout } from 'node:timers/promises';
while (!await access(${JSON.stringify(gate)}).then(() => true, () => false)) await setTimeout(25);
process.chdir(${JSON.stringify(cwd)});`);
      if (options.interrupted()) return { code: 143, complete: false, passed: 0, failed: 0, skipped: 0, cpu: false };
      const env: NodeJS.ProcessEnv = { ...options.env, TMPDIR: owned, TMP: owned, TEMP: owned, CLAND_TEST_TIMING_RECEIPTS: '0' };
      delete env.NODE_TEST_CONTEXT;
      delete env.CLAND_TEST_QUARANTINE_RECEIPT;
      delete env.CLAND_TEST_TIER_REPORT;
      const before = Atomics.load(state, 1);
      const child = spawn(process.execPath, ['--import', bootstrap, '--test', '--test-concurrency=1', '--test-timeout=180000',
        `--test-reporter=${fileURLToPath(new URL('./web-repetition-reporter.ts', import.meta.url))}`, `--test-reporter-destination=${receipt}`, resolve(cwd, file)],
        { cwd: owned, env: runnerFixtureEnvironment(owned, env), detached: true, stdio: ['ignore', 'ignore', 'pipe'] });
      let tail = '';
      child.stderr!.on('data', chunk => { tail = (tail + String(chunk)).slice(-4000); });
      const closed = once(child, 'close');
      const done = new Promise<number>((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve(code ?? 1)); });
      const identity = captureProcess(child.pid);
      if (!identity) { void done.catch(() => {}); throw new Error('cannot establish Web repetition process identity'); }
      options.active.add(identity);
      let timer: NodeJS.Timeout | undefined;
      try {
        if (options.interrupted()) await cleanupOwnedProcesses([identity]);
        else await writeFile(gate, 'ready');
        const code = await Promise.race([done, new Promise<number>(resolve => { timer = setTimeout(() => resolve(124), 180_250); })]);
        clearTimeout(timer);
        await cleanupOwnedProcesses([identity]);
        await closed;
        const summary = webRepeatSummary(await readFile(receipt, 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error; }));
        if (code || !summary.complete || summary.failed || summary.skipped) emit(`load gate Web diagnostic ${JSON.stringify({ file, repetition, worker, code, stderr: tail })}`);
        return { ...summary, code, cpu: Atomics.load(state, 1) > before && load.threadId !== -1 };
      } finally {
        clearTimeout(timer);
        await cleanupOwnedProcesses([identity]);
        await closed;
        options.active.delete(identity);
      }
    }, emit, options.interrupted);
  } finally {
    clearTimeout(readyTimer);
    Atomics.store(state, 0, 1);
    await load.terminate();
    await exited;
  }
}
