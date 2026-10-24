// T2: public demo frames with a held scripted delivery and an injected provider; no real machines.
import assert from 'node:assert/strict';
import test from 'node:test';
import { eventually } from './harness.ts';
import { fixture } from './remote-fixture.ts';
import { startDemo } from './demo-start.ts';

test('demo status stays provisioning until delivery makes exec usable', async t => {
  const f = await fixture(t, { machine: 'scripted', env: { CLAND_TEST_EXECUTOR_SWEEP_MS: '600000' } });
  const epic = ((await f.ui.request({ type: 'task.create', title: 'Provisioning demo', kind: 'epic' })).value as { item: { id: string } }).item.id;
  const resume = Promise.withResolvers<void>();
  let deliveryLease: string | undefined;
  const deliver = f.dependencies.run!.deliver;
  t.mock.method(f.dependencies.run!, 'deliver', async (...args: Parameters<typeof deliver>) => {
    deliveryLease = args[0].lease;
    await resume.promise;
    return deliver(...args);
  });
  const command = t.mock.method(f.dependencies.machine!, 'result', async () => ({ code: 0, stdout: 'demo ready\n', stderr: '' }));
  // Arm the bounded delivery observer before starting; it proves the exact hold,
  // rather than guessing readiness from a provider launch or elapsed time.
  const held = eventually('demo delivery is held', () => deliveryLease);
  const starting = startDemo(t, f.root, f.ui, { epic });
  void starting.catch(() => {});
  try {
    const lease = await held;
    const status = await f.ui.request({ type: 'demo.status', epic });
    assert.equal(status.ok, true, status.error);
    const value = status.value as { state: string; lease: string; commit: string; summary: string };
    assert.equal(value.lease, lease);
    assert.equal(value.commit, f.key.base);
    assert.equal(value.state, 'provisioning');
    assert.match(value.summary, /provisioning/);
    const refused = await f.ui.request({ type: 'demo.exec', epic, command: ['printf', 'demo ready\n'] });
    assert.equal(refused.ok, false);
    assert.equal(command.mock.callCount(), 0, 'no command runs during delivery');
  } finally {
    resume.resolve();
    await starting;
  }
  const status = await f.ui.request({ type: 'demo.status', epic });
  assert.equal(status.ok, true, status.error);
  assert.equal((status.value as { state: string }).state, 'active');
  assert.match((status.value as { summary: string }).summary, / active;/);
  const executed = await f.ui.request({ type: 'demo.exec', epic, command: ['printf', 'demo ready\n'] });
  assert.equal(executed.ok, true, executed.error);
  assert.deepEqual(executed.value, { code: 0, stdout: 'demo ready\n', stderr: '' });
  assert.equal(command.mock.callCount(), 1);
});

test('demo exec names its provisioning lease during provider creation and delivery', async t => {
  const f = await fixture(t, { machine: 'scripted', env: { CLAND_TEST_EXECUTOR_SWEEP_MS: '600000' } });
  const epic = ((await f.ui.request({ type: 'task.create', title: 'Held demo', kind: 'epic' })).value as { item: { id: string } }).item.id;
  const exec = () => f.ui.request({ type: 'demo.exec', epic, command: ['true'] });
  const missing = await exec();
  assert.equal(missing.ok, false);
  assert.match(missing.error!, /no active demo lease/);
  const createGate = Promise.withResolvers<void>(), deliveryGate = Promise.withResolvers<void>();
  let creating = false, delivering = false;
  f.api.beforeCreate(async () => { creating = true; await createGate.promise; });
  const deliver = f.dependencies.run!.deliver;
  t.mock.method(f.dependencies.run!, 'deliver', async (...args: Parameters<typeof deliver>) => {
    delivering = true;
    await deliveryGate.promise;
    return deliver(...args);
  });
  const command = t.mock.method(f.dependencies.machine!, 'result', async () => ({ code: 0, stdout: '', stderr: '' }));
  const heldCreate = eventually('demo provider create is held', () => creating ? true : undefined);
  const heldDelivery = eventually('demo delivery is held', () => delivering ? true : undefined);
  const starting = startDemo(t, f.root, f.ui, { epic });
  void starting.catch(() => {});
  const provisioning = async () => {
    const status = await f.ui.request({ type: 'demo.status', epic });
    assert.equal(status.ok, true, status.error);
    const value = status.value as { state: string; lease: string; commit: string; summary: string };
    assert.equal(value.state, 'provisioning');
    assert.match(value.summary, /provisioning/);
    assert.equal(value.commit, f.key.base);
    const refused = await exec();
    assert.equal(refused.ok, false);
    assert.match(refused.error!, /provisioning/);
    assert.ok(refused.error!.includes(value.lease), 'refusal names the lease shown by status');
    assert.ok(refused.error!.includes(epic));
    assert.ok(refused.error!.includes(value.commit));
    assert.match(refused.error!, /wait/);
    assert.doesNotMatch(refused.error!, /no active demo lease/);
    assert.equal(command.mock.callCount(), 0);
    return value.lease;
  };
  try {
    await heldCreate;
    const lease = await provisioning();
    createGate.resolve();
    await heldDelivery;
    assert.equal(await provisioning(), lease, 'both phases name the same lease');
  } finally {
    createGate.resolve(); deliveryGate.resolve();
    await starting;
    await heldDelivery;
  }
  const stopped = await f.ui.request({ type: 'demo.stop', epic });
  assert.equal(stopped.ok, true, stopped.error);
  assert.equal((stopped.value as { state: string }).state, 'released');
  const released = await f.ui.request({ type: 'demo.status', epic });
  assert.equal(released.ok, true, released.error);
  assert.equal((released.value as { state: string }).state, 'released');
  const refused = await exec();
  assert.equal(refused.ok, false);
  assert.match(refused.error!, /no active demo lease/);
  assert.equal(command.mock.callCount(), 0);
});
