// T4 harness self-test: real owner death, watchdog teardown and writer cleanup.
import { fixtureEnvironment } from './fixture-environment.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { eventually, pidAlive, tempProject } from './harness.ts';
import { beforeDirectories, cleanupProcesses, ownDirectory, ownProcess } from './process-cleanup.ts';
import { rm } from 'node:fs/promises';

for (const mode of ['timeout', 'SIGTERM', 'watchdog-SIGKILL', 'watchdog-teardown'] as const) {
  test(`remote fixture cleans up after owner ${mode}`, async t => {
    // Keep the real socket inside its project on macOS's 100-byte socket limit.
    const scratch = await tempProject(t, 'rf-', '/tmp');
    beforeDirectories(t, () => cleanupProcesses(scratch, [], undefined, undefined, []));
    const child = spawn(process.execPath, [fileURLToPath(new URL('./remote-fixture-parent.ts', import.meta.url)), mode], { env: fixtureEnvironment(scratch, process.env, { TMPDIR: scratch, NODE_TEST_CONTEXT: '' }), stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    ownProcess(t, child.pid);
    let output = '';
    child.stdout!.on('data', chunk => { output += chunk; });
    child.stderr!.on('data', chunk => { output += chunk; });
    let ready: { root: string; territory: string; api: string; hub: number; guard: number; watchdogs: number[] } | undefined;
    child.on('message', message => { ready = message as typeof ready; });
    let exited = false;
    let exitCode: number | null = null;
    child.once('exit', code => { exitCode = code; exited = true; });
    const f = await eventually('fixture owner publishes its live hub', () => {
      assert.ok(!exited || ready, output);
      return ready;
    }, 20000);
    // Failure cleanup belongs to this test, but runs only after its assertions.
    for (const dir of [f.root, f.territory, f.api]) if (existsSync(dir)) ownDirectory(t, dir);
    for (const pid of [f.hub, f.guard, ...f.watchdogs]) ownProcess(t, pid);
    assert.ok(pidAlive(f.hub));
    if (mode.startsWith('SIG')) child.kill(mode as NodeJS.Signals);
    if (mode.startsWith('watchdog-SIG')) child.kill(mode.slice('watchdog-'.length) as NodeJS.Signals);
    if (mode === 'watchdog-teardown') {
      assert.ok(f.watchdogs.length > 0);
      process.kill(f.hub, 'SIGTERM');
      await eventually('fixture hub stops before teardown', () => !pidAlive(f.hub) ? true : undefined, 5000);
      assert.ok(f.watchdogs.every(pidAlive), 'production watchdog independence is preserved until fixture teardown');
      child.send('finish');
    }
    if (mode === 'timeout') child.send('continue');
    await eventually('owner exits', () => exited ? true : undefined, 10000);
    if (mode === 'watchdog-teardown') assert.equal(exitCode, 0, output);
    if (mode === 'timeout') {
      assert.equal(exitCode, 1, output);
      assert.match(output, /timed out after 10000ms/);
    }
    await eventually('fixture hub exits after its owner', () => !pidAlive(f.hub) ? true : undefined, 5000);
    assert.equal(pidAlive(f.hub), false);
    await eventually('fixture watchdogs and reaper exit', () => [f.guard, ...f.watchdogs].every(pid => !pidAlive(pid)) ? true : undefined, 10000);
    assert.ok([f.guard, ...f.watchdogs].every(pid => !pidAlive(pid)));
    await eventually('fixture directories removed after writers exit', () => [f.root, f.territory, f.api].every(dir => !existsSync(dir)) ? true : undefined, 5000);
    for (const dir of [f.root, f.territory, f.api]) assert.equal(existsSync(dir), false);
  });
}

for (const loss of ['owner', 'directory'] as const) test(`file-polling fake exits after losing its ${loss}`, async t => {
  const scratch = await tempProject(t, 'poll-owner-');
  beforeDirectories(t, () => cleanupProcesses(scratch, [], undefined, undefined, []));
  const root = await tempProject(t, 'poll-root-', scratch);
  const owner = spawn(process.execPath, [fileURLToPath(new URL('./remote-fixture-parent.ts', import.meta.url)), 'file-worker', root], { env: fixtureEnvironment(root, process.env, { TMPDIR: scratch, NODE_TEST_CONTEXT: '' }), stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  ownProcess(t, owner.pid);
  let worker: number | undefined;
  owner.on('message', message => { worker = (message as { worker: number }).worker; });
  const pid = await eventually('file-polling worker ready', () => worker, 10000);
  ownProcess(t, pid);
  assert.ok(pidAlive(pid));
  if (loss === 'owner') owner.kill('SIGKILL');
  // This fake only reads the directory: removing it is the behavior under test.
  else await rm(root, { recursive: true });
  await eventually('file-polling worker observes its lost resource', () => !pidAlive(pid) ? true : undefined, 5000);
  assert.equal(pidAlive(pid), false);
});
