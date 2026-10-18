import { spawn } from 'node:child_process';
import { appendFile, open, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StringDecoder } from 'node:string_decoder';
import { redactLoadDiagnostic } from '../src/suite-load-diagnostics.ts';
import { timingKey, type DurationManifest } from '../src/suite-durations.ts';
import { captureProcess, cleanupOwnedProcesses, pause, type ProcessIdentity } from './process-cleanup.ts';
import type { LoadGateEvent } from './load-gate-reporter.ts';
import type { QuarantineManifest, QuarantineReceipt } from '../src/suite-quarantine.ts';
import { admissionTimeoutMessage } from '../src/test-admission-outcome.ts';

export const loadGateReporter = fileURLToPath(new URL('./load-gate-reporter.ts', import.meta.url));

/** Bounded lanes across identities, with sequential fresh processes per name. Repeat
 * coordinators retain the owned root as cwd, making them recovery anchors
 * even if the package runner dies before publishing their identities. */
export async function runLoadGate(options: {
  discovery: string; root: string; cwd: string; env: NodeJS.ProcessEnv;
  manifest: DurationManifest; timeoutMs: number; workers: number; phase: Promise<number>;
  quarantine?: QuarantineManifest | null;
  interrupted: () => boolean; active: Set<ProcessIdentity>;
}): Promise<{ failed: boolean; extraWallMs: number }> {
  if (!Number.isSafeInteger(options.workers) || options.workers < 1) throw new Error('load gate workers must be a positive integer');
  process.stderr.write(`load gate workers ${options.workers}; five sequential repetitions per new test\n`);
  let phaseFinished: number | undefined;
  void options.phase.then(() => { phaseFinished = performance.now(); }, () => { phaseFinished = performance.now(); });
  const seen = new Set<string>();
  let failed = false;
  let offset = 0;
  let pending = '';
  const decoder = new StringDecoder('utf8');
  let sequence = 0;
  const bootstrap = join(options.root, 'load-bootstrap.mjs');
  await writeFile(bootstrap, `import { access } from 'node:fs/promises'; import { setTimeout } from 'node:timers/promises';
if (process.env.NODE_TEST_CONTEXT === 'child-v8') {
  delete process.env.CLAND_LOAD_GATE_START;
  process.chdir(${JSON.stringify(options.cwd)});
} else {
  while (!await access(process.env.CLAND_LOAD_GATE_START).then(() => true, () => false)) await setTimeout(25);
}`);
  // Keep an offset rather than rereading the whole growing phase stream.
  const discover = async (): Promise<LoadGateEvent[]> => {
    const stream = await open(options.discovery, 'r').catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (!stream) return [];
    try {
      const buffer = Buffer.alloc(65536);
      for (;;) {
        const { bytesRead } = await stream.read(buffer, 0, buffer.length, offset);
        if (!bytesRead) break;
        pending += decoder.write(buffer.subarray(0, bytesRead)); offset += bytesRead;
      }
      const lines = pending.split('\n'); pending = lines.pop()!;
      return lines.filter(Boolean).map(line => JSON.parse(line) as LoadGateEvent);
    } finally { await stream.close(); }
  };
  const queued: LoadGateEvent[] = [];
  const running = new Set<Promise<void>>();
  let error: unknown;
  const repeat = async (event: LoadGateEvent): Promise<void> => {
    const key = timingKey({ ...event, seconds: 0 });
    let passed = 0;
    let skipped = 0;
    let excused = 0;
    let admissions = 0;
    let ordinaryFailure = false;
    const quarantine = options.quarantine?.tests[key];
    const skipReasons = new Set<string>();
    const pattern = `^${event.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
    process.stderr.write(`load gate start: ${key}; five repetitions alongside phase\n`);
    for (let repetition = 0; repetition < 5 && !options.interrupted(); repetition++) {
      const receipt = join(options.root, `load-${sequence++}.jsonl`);
      const quarantinePath = `${receipt}.quarantine`;
      const gate = `${receipt}.start`;
      const env: NodeJS.ProcessEnv = { ...options.env, CLAND_LOAD_GATE_START: gate };
      const tierReceipt = `${receipt}.tiers`;
      if (env.CLAND_TEST_TIER_ASSIGNMENTS) env.CLAND_TEST_TIER_REPORT = tierReceipt;
      delete env.NODE_V8_COVERAGE;
      delete env.CLAND_SUITE_SELECTION;
      const reporters = quarantine ? [`--test-reporter=${fileURLToPath(new URL('./quarantine-reporter.ts', import.meta.url))}`, `--test-reporter-destination=${quarantinePath}`] : [];
      const child = spawn(process.execPath, ['--import', bootstrap, ...(env.CLAND_TEST_TIER_ASSIGNMENTS ? ['--import', fileURLToPath(new URL('./tier-bootstrap.mjs', import.meta.url))] : []), '--test', `--test-timeout=${options.timeoutMs}`, `--test-name-pattern=${pattern}`, `--test-reporter=${loadGateReporter}`, `--test-reporter-destination=${receipt}`, ...reporters, resolve(options.cwd, event.file)], { cwd: options.root, env, detached: true, stdio: ['ignore', 'inherit', 'inherit'] });
      const done = new Promise<number>((resolve, reject) => {
        child.once('error', reject);
        child.once('exit', (code) => resolve(code ?? 1));
      });
      const identity = captureProcess(child.pid);
      if (!identity) {
        // Observe spawn errors, then let the owned-root sweep reap a live
        // coordinator still waiting at its bootstrap barrier.
        void done.catch(() => {});
        throw new Error('cannot establish load gate runner identity');
      }
      options.active.add(identity);
      let timer: NodeJS.Timeout | undefined;
      let timedOut = false;
      try {
        if (options.interrupted()) await cleanupOwnedProcesses([identity]);
        else await writeFile(gate, 'ready');
        // Node's timeout cannot force a coordinator with leaked handles to exit.
        // Give its own timeout a small reporting grace, then reap the owned tree.
        const deadline = new Promise<null>(resolve => {
          timer = setTimeout(() => resolve(null), options.timeoutMs + 250);
        });
        const outcome = await Promise.race([done, deadline]);
        timedOut = outcome === null;
        clearTimeout(timer);
        if (timedOut) await cleanupOwnedProcesses([identity]);
        const code = await done;
        const tierText = env.CLAND_TEST_TIER_ASSIGNMENTS ? await readFile(tierReceipt, 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error; }) : '';
        const tierFailed = tierText.split('\n').some(line => line.startsWith('tier-mismatch {') && JSON.parse(line.slice('tier-mismatch '.length)).mode === 'enforce');
        // Preserve the phase's single deduplicated list, but decide this worker's
        // policy before applying assertion quarantine or accepting a passing test.
        if (tierText && options.env.CLAND_TEST_TIER_REPORT) await appendFile(options.env.CLAND_TEST_TIER_REPORT, tierText);
        const records = await readFile(receipt, 'utf8').then(text => text.split('\n').slice(0, -1).filter(Boolean).map(line => JSON.parse(line) as LoadGateEvent), error => { if (error.code === 'ENOENT') return []; throw error; });
        const results = records.filter(record => record.file === event.file && record.name === event.name && record.passed !== undefined);
        const diagnostics = records.filter(record => record.diagnostic).map(record => ({ name: record.name, error: record.diagnostic! }));
        const admission = records.map(record => admissionTimeoutMessage(record.diagnostic)).find(message => message !== null);
        if (admission) {
          admissions++;
          process.stdout.write(`suite admission timeouts ${JSON.stringify([{ file: event.file, message: admission }])}\n`);
          const ordinary = diagnostics.some(record => !admissionTimeoutMessage(record.error) && record.error.failureType !== 'subtestsFailed');
          if (!ordinary && !tierFailed && !timedOut && code === 1) continue;
        }
        if (!admission && !tierFailed && !timedOut && code === 0 && results.length === 1) {
          const result = results[0]!;
          if (result.passed) passed++;
          else if (result.skipReason) { skipped++; skipReasons.add(result.skipReason); }
        }
        let quarantined = false;
        if (!admission && !tierFailed && !timedOut && code === 1 && quarantine && results.length === 1) {
          const checked = JSON.parse(await readFile(quarantinePath, 'utf8')) as QuarantineReceipt;
          if (checked.complete && checked.cancelled === 0 && !checked.failures.length && checked.excused > 0) {
            excused++;
            quarantined = true;
            for (const result of checked.results) if (result.outcome === 'fail') process.stdout.write(`suite quarantine ${JSON.stringify(result)}\n`);
          }
        }
        const success = !admission && !tierFailed && !timedOut && code === 0 && results.length === 1 && (results[0]!.passed || results[0]!.skipReason);
        if (!success) {
          ordinaryFailure ||= !quarantined;
          const failure = redactLoadDiagnostic({ file: event.file, name: event.name, repetition: repetition + 1,
            status: timedOut ? 'timed out (outer deadline)' : 'failed',
            ...(timedOut ? { timeoutMs: options.timeoutMs, graceMs: 250 } : {}),
            diagnostics: diagnostics.length ? diagnostics : [{ name: event.name, error: { message: tierFailed ? 'enforced resource tier violation' : `runner exit ${code}; expected one passing receipt, received ${results.length}` } }],
          }, options.env);
          process.stderr.write(`load gate failure ${JSON.stringify(failure)}\n`);
        }
      } finally {
        clearTimeout(timer);
        await cleanupOwnedProcesses([identity]);
        options.active.delete(identity);
      }
    }
    failed ||= passed + excused !== 5 && skipped !== 5;
    if (admissions) process.stderr.write(`load gate admission blocked: ${event.file}; ${admissions} admission timeouts; not test results\n`);
    if (admissions && !ordinaryFailure) return;
    if (skipped === 5) process.stderr.write(`load gate: ${key} skipped, not load-gated; 5/5 skipped; reasons: ${JSON.stringify([...skipReasons])}\n`);
    else if (excused && passed + excused === 5) process.stderr.write(`quarantine load gate: ${key} ${passed}/5 passed; ${excused}/5 quarantined failures\n`);
    else process.stderr.write(`${passed === 5 ? '' : '✖ '}load gate: ${key} ${passed}/5 passed\n`);
  };
  try {
    while (!options.interrupted() && error === undefined) {
      const events = await discover();
      for (const event of events) {
        // Only enqueue records discover identities; nested failures are diagnostics.
        if (event.passed !== undefined || event.diagnostic) continue;
        const key = timingKey({ ...event, seconds: 0 });
        if (seen.has(key) || Object.hasOwn(options.manifest.tests, key)) continue;
        seen.add(key);
        queued.push(event);
      }
      while (queued.length && running.size < options.workers && !options.interrupted() && error === undefined) {
        const event = queued.shift()!;
        const task = repeat(event).catch(cause => { error ??= cause; }).finally(() => { running.delete(task); });
        running.add(task);
      }
      // A final drain after reporter exit catches the last names. Keep discovery
      // moving while lanes run so a slow identity cannot serialize later ones.
      if (phaseFinished !== undefined && !events.length && !queued.length && !running.size) break;
      await pause(25);
    }
  } finally {
    // Do not let the runner sweep a shared root while another lane still writes.
    await Promise.all(running);
  }
  if (error !== undefined) throw error;
  return { failed, extraWallMs: phaseFinished === undefined ? 0 : performance.now() - phaseFinished };
}
