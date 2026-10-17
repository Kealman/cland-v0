// T2: remote verification orchestration uses an in-process provider and scripted machine.
// Git/ps fixture infrastructure remains until T-719; no hub, spoke, watchdog, ssh/scp or suite worker child.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixture } from './remote-fixture.ts';
import { DropletExecutor } from '../src/executor/droplet/droplet.ts';
import { join } from 'node:path';
import type { Message } from '../src/protocol.ts';
import { readLeases } from '../src/executor/droplet/lease.ts';

test('scripted remote verification acquires, delivers, starts, collects and releases on the hub clock', async t => {
  const f = await fixture(t, { machine: 'scripted' });
  assert.equal((await f.ui.request({ type: 'subscribe' })).ok, true);
  const submitted = await f.launch('--executor', 'droplet');
  assert.equal(typeof submitted.id, 'string', JSON.stringify(submitted));
  const reported = f.ui.waitFor(frame => frame.type === 'message' && (frame.message as Message).id === `suite:${submitted.id}`, 15000).then(frame => frame.message as Message);
  // Observe the durable start receipt before advancing the execution deadline.
  await Promise.race([f.machine.started(submitted.id), reported.then(report => { throw new Error(`remote run finished before its start receipt: ${report.text}`); })]);
  await f.ui.waitFor(frame => frame.type === 'verification.queue' && (frame.queue as { remote?: Array<{ id?: string }> }).remote?.some(run => run.id === submitted.id) === true);
  await f.clock.advance(1000);
  const report = await reported;
  assert.match(report.text, /exit 0/);
  assert.match(report.text, /linux/);
  assert.match(report.text, /tests 1; pass 1/);
  const steps = f.machine.calls.filter(call => call.run === submitted.id).map(call => call.step);
  for (const step of ['ready', 'deliver', 'start', 'status', 'log', 'release']) assert.ok(steps.includes(step), `${step} crossed its boundary`);
  assert.ok(steps.indexOf('deliver') < steps.indexOf('start'));
  assert.ok(steps.indexOf('log') < steps.indexOf('release'));
  assert.deepEqual(f.api.droplets, []);
  assert.deepEqual(f.api.keys, []);
  const [lease] = await readLeases(f.root);
  assert.equal(lease?.state, 'released');
  assert.equal(lease?.watchdog?.pid, 0, 'the host fake never armed a detached child');
  assert.equal(f.spoke.pid, 0);
  assert.equal(f.guard.pid, 0, 'the scripted fixture needs no reaper process');
  assert.equal(f.api.url, '', 'the provider has no HTTP listener');
});

test('scripted machines report red, lost and slow runs without a worker', async t => {
  const f = await fixture(t, { machine: 'scripted' });
  const executor = new DropletExecutor(f.root, undefined, undefined, f.env, undefined, f.dependencies);
  for (const outcome of ['red', 'lost', 'slow'] as const) {
    const lease = await executor.acquire({ id: outcome }, new Date(f.clock.now().getTime() + 100000).toISOString());
    f.machine.script({ outcome, afterMs: 50, failures: ['scripted failure: Ω'] });
    const ref = { id: outcome, cwd: f.root, head: 'candidate', mode: 'hub-only', log: join(f.root, 'log'), result: join(f.root, 'result'), gate: join(f.root, 'gate') };
    await executor.deliver(lease, ref);
    assert.equal((await executor.status(lease)).state, 'pending');
    await executor.start(lease, ref);
    if (outcome === 'lost') assert.deepEqual(await executor.status(lease), { state: 'lost', code: 1, cause: 'remote machine lost' });
    else {
      assert.equal((await executor.status(lease)).state, 'running');
      await f.clock.advance(51);
      if (outcome === 'red') {
        assert.equal((await executor.status(lease)).code, 1);
        const log = await executor.log(lease, 0);
        assert.match(log.text, /scripted failure: Ω/);
        assert.equal(log.next, Buffer.byteLength(log.text));
        assert.equal((await executor.log(lease, log.next)).text, '');
      } else {
        assert.equal((await executor.status(lease)).state, 'running');
        await executor.cancel(lease, 'SIGTERM');
        assert.equal((await executor.status(lease)).code, 1);
      }
    }
    await executor.release(lease);
    assert.equal(lease.state, 'released');
  }
  assert.deepEqual(f.api.droplets, []);
  assert.deepEqual(f.api.keys, []);
});
