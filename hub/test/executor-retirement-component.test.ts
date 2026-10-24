// T2: retirement probes authenticate real project sockets; control routing uses
// the embedded hub and CLI, without provider resources or a hub subprocess.
import { sessionUi as connectUi, sessionClandWithEnv as clandWithEnv } from './session-credential-fixture.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { projectHub, tempProject, inProcessSpoke } from './harness.ts';
import { scratchMachine, legacyLedger } from './init-machine.ts';
import { spendPath, retireLegacySpend } from '../src/executor/droplet/spend.ts';
import { registeredHubSpendStatus } from '../src/executor/droplet/spend-hubs.ts';
import { DropletExecutor } from '../src/executor/droplet/droplet.ts';
import { FakeClock } from './fake-clock.ts';

test('retirement checks authenticated live status on registered hubs and refuses an unavailable project', async t => {
  const machine = await scratchMachine(t, { identity: false });
  const root = join(machine.root, 'project');
  await mkdir(root);
  await legacyLedger(machine, [{ project: root, lease: 'settled', run: 'settled', size: 'c-8', reservation: 2, cost: 2,
    created: '2026-10-16T10:00:00Z', deadline: '2026-10-16T11:00:00Z', released: '2026-10-16T11:00:00Z' }]);
  const clock = new FakeClock();
  const hub = await projectHub(t, root, { ...machine.env, DIGITALOCEAN_TOKEN: '', CLAND_EXECUTOR_STATE: dirname(spendPath(machine.env)) } as Record<string, string>, { clock });
  assert.deepEqual(await registeredHubSpendStatus(root), { path: spendPath(machine.env), legacyRetirement: 1 });
  const inspect = DropletExecutor.prototype.inspect;
  const oldStatus = t.mock.method(DropletExecutor.prototype, 'inspect', async function (this: DropletExecutor) {
    const result = await inspect.call(this);
    const { legacyRetirement: _capability, ...spend } = result.spend;
    return { ...result, spend } as Awaited<ReturnType<typeof inspect>>;
  });
  try {
    await assert.rejects(retireLegacySpend(true, machine.env, clock, { alive: () => true, started: () => 'fixture' }), /does not support the legacy retirement marker/);
    await assert.rejects(readFile(join(dirname(spendPath(machine.env)), 'spend-retirement.json')), { code: 'ENOENT' });
  } finally { oldStatus.mock.restore(); }
  const result = await retireLegacySpend(true, machine.env, clock, { alive: () => true, started: () => 'fixture' });
  assert.equal(JSON.parse(await readFile(result.receipt, 'utf8')).event, 'executor-spend-retired');
  await hub.stop();
  await assert.rejects(registeredHubSpendStatus(root), /absent|ENOENT|ECONNREFUSED/);
});

test('retirement control routes confirmation from the CLI and is reserved for the human and Coordinator', async t => {
  const root = await tempProject(t, 'retirement-routing-');
  const hub = await projectHub(t, root, { DIGITALOCEAN_TOKEN: '' });
  const ui = await connectUi(t, hub.discovery);
  const confirmations: boolean[] = [];
  t.mock.method(DropletExecutor.prototype, 'retireLegacy', async (confirmed: boolean, authorize: () => void) => {
    authorize(); confirmations.push(confirmed);
    if (!confirmed) throw new Error('requires --confirm-registered-hubs; registered projects: /fixture');
    return { path: '/fixture/state/spend.json', receipt: '/fixture/state/spend-retirement.json', projects: ['/fixture'], summary: 'retired' };
  });
  for (const role of ['implementer', 'reviewer', 'qa', 'coordinator'] as const) {
    const name = `retire-${role}`;
    assert.equal((await ui.request({ type: 'role.set', session: name, role })).ok, true);
    const spoke = await inProcessSpoke(t, { discover: true, assignRole: false, cwd: root, name, role, sessionId: name });
    await spoke.waitForPresence([name]);
    const result = await ui.request({ type: 'executor.retire-legacy', confirmRegisteredHubs: true, as: { name, sessionId: name, shell: true } });
    assert.equal(result.ok, role === 'coordinator', result.error);
    if (role !== 'coordinator') assert.match(result.error!, /forbidden.*executor\.retire-legacy/);
  }
  const refused = await clandWithEnv(root, {}, 'executor', 'retire-legacy', '--json');
  assert.equal(refused.code, 1);
  assert.match(refused.stderr, /--confirm-registered-hubs.*registered projects/);
  const retired = await clandWithEnv(root, {}, 'executor', 'retire-legacy', '--confirm-registered-hubs', '--json');
  assert.equal(retired.code, 0, retired.stderr);
  assert.equal(JSON.parse(retired.stdout).summary, 'retired');
  assert.deepEqual(confirmations, [true, false, true]);
});
