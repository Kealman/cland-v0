// T3: failed assertions and unreaped children require real native close and root fences.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFile, stat } from 'node:fs/promises';
import { fixtureEnvironment } from './fixture-environment.ts';
import { ownDirectory, ownProcess } from './process-cleanup.ts';
import { eventually } from './until.ts';
import { parseLinuxStat } from '../src/host/agent/proc-stat.ts';
import { waitForCrash } from './crash-wait.ts';
import { crashProcess } from './crash-wait-native.ts';
import { handoverCase, handoverChild } from './handover-case.ts';

test('forced handover assertion reports and closes', async t => {
  const owner = handoverCase(t);
  await owner.run(async step => {
    const root = await step('forced-failure root', () => owner.root());
    const script = fileURLToPath(new URL('./lead-handover-process.test.ts', import.meta.url));
    const child = await step('forced-failure child acquisition', async () => handoverChild(owner, root,
      () => spawn(process.execPath, ['--test', '--test-reporter=tap', script], {
        cwd: root, detached: true,
        env: fixtureEnvironment(root, process.env, { TMPDIR: root, NODE_TEST_CONTEXT: undefined, CLAND_TEST_HANDOVER_FAILURE: 'after-crash' }),
        stdio: ['ignore', 'pipe', 'pipe'],
      })));
    assert.deepEqual(await step('forced-failure native receipt', () => child.observe()), { code: 1, signal: null });
    assert.match(child.diagnostic(), /controlled handover assertion failure/);
    assert.match(child.diagnostic(), /# fail 1/);
  });
});

test('crash observation accepts a real unreaped Linux child', {
  skip: process.platform !== 'linux' ? 'requires Linux procfs zombie receipt' : false,
}, async t => {
  const owner = handoverCase(t);
  await owner.run(async step => {
    const root = await step('zombie root', () => owner.root());
    const environment = new URL('./fixture-environment.ts', import.meta.url).href;
    let receipt: { pid: number } | undefined;
    const worker = await step('zombie parent acquisition', async () => {
      const worker = handoverChild(owner, root, () => spawn(process.execPath, ['--input-type=module', '-e', `
        import { spawn } from 'node:child_process';
        import { fixtureEnvironment } from ${JSON.stringify(environment)};
        const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
          env: fixtureEnvironment(process.cwd(), process.env), stdio: 'ignore',
        });
        child.once('spawn', () => process.send({ pid: child.pid }, () => process.kill(process.pid, 'SIGSTOP')));
      `], { cwd: root, detached: true, env: fixtureEnvironment(root, process.env), stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }));
      worker.child.once('message', message => { receipt = message as { pid: number }; });
      return worker;
    });
    const child = await step('native child receipt', () => eventually('native child launch receipt', () => receipt));
    const stopChild = await step('child native ownership', () => owner.acquire('child ownership capture', async () => ownProcess(undefined, child.pid), stop => stop()));
    await step('stopped parent receipt', () => eventually('parent stopped before child termination', async () =>
      parseLinuxStat(await readFile(`/proc/${worker.child.pid}/stat`, 'utf8'))?.state === 'T' ? true : undefined));
    await step('child termination', stopChild);
    const probe = crashProcess(child.pid);
    assert.doesNotThrow(() => process.kill(child.pid, 0), 'positive control: PID still exists');
    assert.equal(await step('zombie exit receipt', () => waitForCrash(probe, { signal: owner.signal })), 'exited');
    assert.equal(probe.exited(), true, 'native owner reports zombie exit');
  });
});

test('partial native acquisition retains its root across rejected close', async t => {
  const supervisor = handoverCase(t);
  let refuse = true;
  supervisor.releaseOnClose(() => { refuse = false; });
  await supervisor.run(async step => {
    const owner = handoverCase(supervisor.fixtures);
    supervisor.requireClose(() => owner.close());
    let root = '';
    await assert.rejects(owner.run(async acquire => {
      root = await acquire('partial-acquisition root', () => owner.root());
      await acquire('partially returned native child', async () => handoverChild(owner, root,
        () => spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
          cwd: root, detached: true, env: fixtureEnvironment(root, process.env), stdio: 'ignore',
        }), {
          afterCapture: () => { throw new Error('controlled partial native acquisition failure'); },
          beforeClose: () => { if (refuse) throw new Error('controlled native close rejection'); },
        }));
    }), /controlled partial native acquisition failure/);
    const remove = ownDirectory(undefined, root);
    await assert.rejects(owner.close(), /controlled native close rejection/);
    await assert.rejects(remove(), /resource close unconfirmed/);
    assert.equal((await stat(root)).isDirectory(), true, 'real guarded cleanup retains the root');
    await assert.rejects(owner.restore(), /resource close unconfirmed/);
    refuse = false;
    await step('repaired native close', () => owner.close());
    await step('guarded removal after native close', remove);
    await assert.rejects(stat(root), { code: 'ENOENT' });
  });
});
