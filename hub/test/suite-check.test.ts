// T3: npm check completion and cancellation reap retained writers before fixture removal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, access, writeFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { suiteCheckCommand } from '../src/suite-check.ts';
import { suiteCommands } from '../src/hub/suite-worker.ts';
import { ownDirectory, ownProcess, beforeDirectories, onCleanup, cleanupProcesses } from './process-cleanup.ts';
import { eventually } from './harness.ts';
import { suiteSummary } from '../src/hub/suites.ts';

async function bounded<T>(operation: Promise<T>, boundary: string, milliseconds: number): Promise<T> {
  const signal = AbortSignal.timeout(milliseconds);
  let abort: () => void = () => {};
  const deadline = new Promise<never>((_, reject) => {
    abort = () => reject(new Error(`check fixture deadline: ${boundary}`));
    signal.addEventListener('abort', abort, { once: true });
  });
  try { return await Promise.race([operation, deadline]); }
  finally { signal.removeEventListener('abort', abort); }
}

function ownedCheck(t: import('node:test').TestContext, cwd: string, args: string[], signal = t.signal) {
  const child = spawn('npm', args, { cwd, timeout: 10_000, signal, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '', failure = '';
  child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
  child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
  const closed = new Promise<{ code: number; stdout: string; stderr: string }>(resolve => {
    child.on('error', error => { failure = error.message; });
    child.once('close', code => resolve({ code: failure ? 1 : code ?? 1, stdout, stderr: failure || stderr }));
  });
  let stopNpm: () => Promise<void>;
  const writers: Array<() => Promise<void>> = [];
  let stopping: Promise<void> | undefined;
  const stop = () => stopping ??= (async () => {
    const errors: unknown[] = [];
    for (const writer of writers) try { await bounded(writer(), 'writer process cleanup', 5000); } catch (error) { errors.push(error); }
    try { await bounded(stopNpm(), 'npm process cleanup', 5000); } catch (error) { errors.push(error); }
    // npm can no longer fork. The owned root also covers writers whose startup
    // receipt/PID has not reached the caller, including separate process groups.
    try { await bounded(cleanupProcesses(cwd, [], undefined, undefined, []), 'fixture-root process discovery cleanup', 5000); } catch (error) { errors.push(error); }
    try { await bounded(closed, 'inherited pipe close after process cleanup', 2000); }
    catch (error) {
      errors.push(error);
      // A missing close is a failure, but retained fixture pipes must not hang Node.
      child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy();
    }
    if (errors.length) throw new AggregateError(errors, `check fixture cleanup failed: ${errors.map(error => error instanceof Error ? error.message : String(error)).join('; ')}`);
  })();
  // Run the ordered shutdown before the individual safety-owner callbacks.
  onCleanup(t, stop);
  stopNpm = ownProcess(t, child.pid);
  beforeDirectories(t, stop);
  const result = bounded(closed, 'npm command completion', 10_000);
  void result.catch(() => {}); // May reject while a different receipt is awaited.
  return { child, result, stop,
    ownWriter: (pid: number, completion: Promise<void>) => {
      const cleanup = ownProcess(t, pid);
      void completion.catch(() => {});
      writers.push(async () => { await cleanup(); await bounded(completion, 'retained writer reaped by its parent', 2000); });
    },
  };
}
async function checkRoot(t: import('node:test').TestContext, prefix: string) {
  const cwd = await realpath(await mkdtemp(join(tmpdir(), prefix)));
  const dispose = ownDirectory(undefined, cwd);
  let command: ReturnType<typeof ownedCheck> | undefined;
  let removed = false;
  const remove = async () => {
    if (removed) return;
    // Preserve the root if ownership cleanup fails; never remove a live writer's root.
    if (command) await command.stop();
    // Also cover a setup failure before ownedCheck could return and attach.
    await bounded(cleanupProcesses(cwd, [], undefined, undefined, []), 'root safety cleanup before removal', 5000);
    await dispose();
    removed = true;
  };
  beforeDirectories(t, remove);
  return { cwd, remove, attach: (next: ReturnType<typeof ownedCheck>) => command = next };
}

function receipt(t: import('node:test').TestContext, command: ReturnType<typeof ownedCheck>, marker: string) {
  return new Promise<void>((resolve, reject) => {
    const signal = AbortSignal.any([t.signal, AbortSignal.timeout(5000)]);
    let output = '';
    const finish = (error?: Error) => {
      command.child.stdout?.off('data', data);
      command.child.off('close', close);
      signal.removeEventListener('abort', abort);
      if (error) reject(error); else resolve();
    };
    const data = (chunk: Buffer) => { output += chunk.toString(); if (output.includes(marker)) finish(); };
    const close = () => finish(new Error(`check closed before ${marker}`));
    const abort = () => finish(new Error(`check receipt deadline or test cancellation before ${marker}`));
    command.child.stdout?.on('data', data);
    command.child.once('close', close);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}

async function interruptedScripts(cwd: string, heldStartup = false) {
  const writer = `import { writeFileSync, watch } from 'node:fs';
writeFileSync('writer', String(process.pid));
process.on('SIGTERM', () => { writeFileSync('stopped', 'yes'); console.log('CHECK-STOPPED'); });
const hold = watch('writer', () => {});
console.log(process.argv[2] === 'startup-held' ? 'WRITER-STARTUP-HELD' : 'CHECK-HELD');`;
  await writeFile(join(cwd, 'writer.mjs'), writer);
  // Separate process group models a retained writer after npm's group exits.
  const launcher = `import { spawn } from 'node:child_process'; import { watch } from 'node:fs';
process.on('SIGTERM', () => {});
const writer = spawn(process.execPath, ['writer.mjs', ${JSON.stringify(heldStartup ? 'startup-held' : 'ready')}], { detached: true, stdio: ['ignore', 'inherit', 'inherit'] });
writer.once('exit', () => console.log('WRITER-REAPED'));
writer.unref(); const hold = watch('writer.mjs', () => {});`;
  await writeFile(join(cwd, 'launcher.mjs'), launcher);
  await writeFile(join(cwd, 'package.json'), JSON.stringify({ scripts: { check: 'node launcher.mjs' } }));
}

test('check runs the report lint once after typecheck and preserves a green exit with findings', async t => {
  const root = await checkRoot(t, 'cland-check-');
  const { cwd } = root;
  await mkdir(join(cwd, 'hub/test'), { recursive: true });
  await writeFile(join(cwd, 'hub/test/a.test.ts'), 'sleep(25);');
  await writeFile(join(cwd, 'hub/test/tiers.json'), JSON.stringify({ version: 1, tests: { 'hub/test/a.test.ts': 'T2' } }));
  const original = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as { scripts: Record<string, string> };
  const script = fileURLToPath(new URL('./lint-tests.ts', import.meta.url));
  await writeFile(join(cwd, 'package.json'), JSON.stringify({ scripts: {
    check: original.scripts.check,
    typecheck: 'node -e "console.log(\'TYPECHECK-COMPLETE\')"',
    'test:lint': `node ${JSON.stringify(script)} ${JSON.stringify(cwd)}`,
  } }));
  const check = await suiteCheckCommand(cwd);
  assert.deepEqual(check, ['run', 'check']);
  assert.deepEqual(suiteCommands({ mode: 'auto' }, check), [['run', 'check'], ['test']]);
  const command = root.attach(ownedCheck(t, cwd, check));
  const { code, stdout, stderr } = await command.result;
  assert.equal(code, 0, stderr);
  await command.stop();
  assert.equal(stdout.split('test lint (report only):').length - 1, 1);
  assert.ok(stdout.indexOf('TYPECHECK-COMPLETE') < stdout.indexOf('test lint (report only):'));
  assert.match(stdout, /test lint \(report only\): 1 findings in 1 files/);
  assert.match(suiteSummary(stdout), /test lint tier: hub\/test\/a.test.ts: T2; qualifies T2/);
  await writeFile(join(cwd, 'package.json'), JSON.stringify({ scripts: { typecheck: 'true', test: 'true' } }));
  assert.deepEqual(await suiteCheckCommand(cwd), ['run', 'typecheck'], 'older candidates retain their command and host-gate identity');
});


test('interrupted check CLI closes its held writer before removing the fixture', async t => {
  const root = await checkRoot(t, 'cland-check-abort-');
  const { cwd, remove } = root;
  await interruptedScripts(cwd);
  const controller = new AbortController();
  const command = root.attach(ownedCheck(t, cwd, ['run', 'check'], AbortSignal.any([t.signal, controller.signal])));
  await receipt(t, command, 'CHECK-HELD');
  const pid = Number(await readFile(join(cwd, 'writer'), 'utf8'));
  command.ownWriter(pid, receipt(t, command, 'WRITER-REAPED')); // Capture while live; join reaping before npm exits.
  assert.doesNotThrow(() => process.kill(pid, 0), 'retained writer remains live before cancellation');
  // Registered cleanup is deliberately SIGKILL. Observe the writer's completed
  // signal handler before cancellation/cleanup, independent of npm propagation.
  const stopped = receipt(t, command, 'CHECK-STOPPED');
  process.kill(pid, 'SIGTERM');
  await stopped;
  controller.abort();
  await command.stop();
  assert.notEqual((await command.result).code, 0);
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  assert.equal(await readFile(join(cwd, 'stopped'), 'utf8'), 'yes', 'writer could still use its root during signal handling');
  await remove();
  await assert.rejects(access(cwd), { code: 'ENOENT' });
});


test('startup cancellation reaps an unregistered detached writer before root removal', async t => {
  const root = await checkRoot(t, 'cland-check-startup-');
  const { cwd, remove } = root;
  await interruptedScripts(cwd, true);
  const controller = new AbortController();
  const command = root.attach(ownedCheck(t, cwd, ['run', 'check'], AbortSignal.any([t.signal, controller.signal])));
  await receipt(t, command, 'WRITER-STARTUP-HELD');
  const pid = Number(await readFile(join(cwd, 'writer'), 'utf8'));
  // Observe only: never call ownWriter. Startup ownership comes from the root.
  assert.doesNotThrow(() => process.kill(pid, 0));
  controller.abort();
  await command.stop();
  await eventually('startup writer PID to be reaped', () => {
    try { process.kill(pid, 0); return undefined; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') return true; throw error; }
  }, 2000);
  assert.notEqual((await command.result).code, 0);
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  await access(cwd);
  await remove();
  await assert.rejects(access(cwd), { code: 'ENOENT' });
});
