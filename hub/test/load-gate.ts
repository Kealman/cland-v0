import { spawn } from 'node:child_process';
import { open, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StringDecoder } from 'node:string_decoder';
import { timingKey, type DurationManifest } from '../src/suite-durations.ts';
import { captureProcess, cleanupOwnedProcesses, pause, type ProcessIdentity } from './process-cleanup.ts';
import type { LoadGateEvent } from './load-gate-reporter.ts';

export const loadGateReporter = fileURLToPath(new URL('./load-gate-reporter.ts', import.meta.url));

/** One extra lane, with fresh processes and exact name matching. Repeat
 * coordinators retain the owned root as cwd, making them recovery anchors
 * even if the package runner dies before publishing their identities. */
export async function runLoadGate(options: {
  discovery: string; root: string; cwd: string; env: NodeJS.ProcessEnv;
  manifest: DurationManifest; timeoutMs: number; phase: Promise<number>;
  interrupted: () => boolean; active: Set<ProcessIdentity>;
}): Promise<{ failed: boolean; extraWallMs: number }> {
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
  while (!options.interrupted()) {
    const events = await discover();
    for (const event of events) {
      const key = timingKey({ ...event, seconds: 0 });
      if (seen.has(key) || Object.hasOwn(options.manifest.tests, key)) continue;
      seen.add(key);
      let passed = 0;
      const pattern = `^${event.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
      process.stderr.write(`load gate start: ${key}; five repetitions alongside phase\n`);
      for (let repetition = 0; repetition < 5 && !options.interrupted(); repetition++) {
        const receipt = join(options.root, `load-${sequence++}.jsonl`);
        const gate = `${receipt}.start`;
        const env: NodeJS.ProcessEnv = { ...options.env, CLAND_LOAD_GATE_START: gate };
        delete env.NODE_V8_COVERAGE;
        delete env.CLAND_SUITE_SELECTION;
        const child = spawn(process.execPath, ['--import', bootstrap, '--test', `--test-timeout=${options.timeoutMs}`, `--test-name-pattern=${pattern}`, `--test-reporter=${loadGateReporter}`, `--test-reporter-destination=${receipt}`, resolve(options.cwd, event.file)], { cwd: options.root, env, detached: true, stdio: ['ignore', 'inherit', 'inherit'] });
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
        try {
          if (options.interrupted()) await cleanupOwnedProcesses([identity]);
          else await writeFile(gate, 'ready');
          const code = await done;
          const records = await readFile(receipt, 'utf8').then(text => text.trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as LoadGateEvent), error => { if (error.code === 'ENOENT') return []; throw error; });
          const results = records.filter(record => record.file === event.file && record.name === event.name && record.passed !== undefined);
          if (code === 0 && results.length === 1 && results[0]!.passed) passed++;
        } finally {
          await cleanupOwnedProcesses([identity]);
          options.active.delete(identity);
        }
      }
      failed ||= passed !== 5;
      process.stderr.write(`${passed === 5 ? '' : '✖ '}load gate: ${key} ${passed}/5 passed\n`);
    }
    // One final drain after the reporter's process exits catches its last names.
    if (phaseFinished !== undefined && !events.length) break;
    if (!events.length) await pause(25);
  }
  return { failed, extraWallMs: phaseFinished === undefined ? 0 : performance.now() - phaseFinished };
}
