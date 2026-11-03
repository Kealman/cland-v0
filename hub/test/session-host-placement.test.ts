// T2: Host placement admission through projectHub frames; fake harnesses, no native children.
import test from 'node:test';
import assert from 'node:assert/strict';
import { projectHub, tempProject } from './harness.ts';
import { sessionUi } from './session-credential-fixture.ts';

test('unknown launch Host is refused by name before reservation or spawn; legacy launch defaults local', async t => {
  const root = await tempProject(t);
  const hub = await projectHub(t, root);
  const ui = await sessionUi(t, hub.discovery);
  const rejected = await ui.request({ type: 'session.launch', name: 'worker', role: 'implementer', harness: 'codex', host: 'missing-host' });
  assert.equal(rejected.ok, false);
  assert.match(String(rejected.error), /unknown host.*missing-host/);
  assert.equal(hub.fakes.codex!.spawns.length, 0);
  const itemRefusal = await ui.request({ type: 'session.launch', name: 'item-worker', role: 'implementer', harness: 'codex', host: 'missing-host', item: 'T-999999' });
  assert.equal(itemRefusal.ok, false);
  assert.match(String(itemRefusal.error), /unknown host.*missing-host/);
  const invalid = await ui.request({ type: 'session.launch', name: 'invalid-host', host: 12 });
  assert.equal(invalid.ok, false);
  const rows = await ui.request({ type: 'session.list' });
  assert.deepEqual((rows.value as { processes: unknown[] }).processes, []);
  // Reusing the refused name through the previous wire shape also proves admission released nothing behind.
  const accepted = await ui.request({ type: 'session.launch', name: 'worker', role: 'implementer', harness: 'codex' });
  assert.equal(accepted.ok, true, accepted.error);
  assert.equal(hub.fakes.codex!.spawns.length, 1);
});

for (const role of ['coordinator', 'aide']) test(`${role} launch, relaunch and fresh resume refuse a test Host before effects`, async t => {
  const { ProcessTable } = await import('../src/adapters/processes.ts');
  const { fakeHarness } = await import('./fakes/harness.ts');
  const { mkdir } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const table = new ProcessTable(join(root, '.cland/hub.db'));
  const row = { ...await fakeHarness('codex').spawn({ name: 'retained', role, model: null, cwd: root }), host: 't1', status: 'stopped' as const };
  table.put(row);
  table.close();
  const operations: unknown[] = [];
  const hub = await projectHub(t, root, { CLAND_TEST_HOSTS: 't1' }, { log: entry => { if (entry.event === 'test-host-operation') operations.push(entry); } });
  const ui = await sessionUi(t, hub.discovery);
  for (const frame of [
    { type: 'session.launch', name: 'new-holder', role, harness: 'codex', host: 't1' },
    { type: 'session.resume', session: row.name, relaunch: true },
    { type: 'session.resume', session: row.name, fresh: true },
  ]) {
    const result = await ui.request(frame);
    assert.equal(result.ok, false);
    assert.match(String(result.error), /Coordinator and Aide.*only on the local host/);
  }
  assert.equal(hub.fakes.codex!.spawns.length, 0);
  assert.equal(hub.fakes.codex!.resumes.length, 0);
  assert.equal(hub.fakes.codex!.stops.length, 0);
  assert.deepEqual(operations, []);
  const local = await ui.request({ type: 'session.launch', name: 'new-holder', role, harness: 'codex' });
  assert.equal(local.ok, true, local.error);
});

for (const role of ['coordinator', 'aide']) for (const action of ['set', 'move'])
  test(`${role} ${action} refuses the durable remote target without moving roles`, async t => {
    const { ProcessTable } = await import('../src/adapters/processes.ts');
    const { fakeHarness } = await import('./fakes/harness.ts');
    const { mkdir } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const root = await tempProject(t);
    await mkdir(join(root, '.cland'), { recursive: true });
    const table = new ProcessTable(join(root, '.cland/hub.db'));
    const row = { ...await fakeHarness('codex').spawn({ name: 'remote-target', role: 'implementer', model: null, cwd: root }), host: 't1', status: 'stopped' as const };
    table.put(row);
    table.close();
    const hub = await projectHub(t, root, { CLAND_TEST_HOSTS: 't1' });
    const ui = await sessionUi(t, hub.discovery);
    if (action !== 'set') {
      const holder = await ui.request({ type: 'session.launch', name: 'holder', role, harness: 'codex' });
      assert.equal(holder.ok, true, holder.error);
    }
    const before = await ui.request({ type: 'role.list' });
    const result = await ui.request({ type: 'role.set', session: row.name, role, ...(action === 'move' ? { move: true } : {}) });
    assert.equal(result.ok, false);
    assert.match(String(result.error), /Coordinator and Aide.*only on the local host/);
    const after = await ui.request({ type: 'role.list' });
    assert.deepEqual(after.value, before.value);
  });

test('another role reaches the selected test Host spawn and keeps its refusal', async t => {
  const { testHost } = await import('../src/host/test-host.ts');
  const { fakeHarness } = await import('./fakes/harness.ts');
  const root = await tempProject(t);
  const operations: unknown[] = [];
  const remote = { ...testHost('t1', e => operations.push(e.operation)), statDirectory: async () => ({ refusal: null, identity: null }) };
  operations.length = 0;
  const hub = await projectHub(t, root, {}, { hosts: [remote], adapters: [(host, clock) => {
    const adapter = fakeHarness('codex', { clock });
    const spawn = adapter.spawn.bind(adapter);
    adapter.spawn = async (request, resumed, authorize) => {
      const machine = host.hostForLaunch!(request);
      if (machine.name !== 'local') await machine.spawn({ command: '/fixture/harness', args: [], cwd: request.cwd, env: {} });
      return spawn(request, resumed, authorize);
    };
    return adapter;
  }] });
  const ui = await sessionUi(t, hub.discovery);
  const result = await ui.request({ type: 'session.launch', name: 'remote-worker', harness: 'codex', role: 'implementer', host: 't1' });
  assert.equal(result.ok, false);
  assert.match(String(result.error), /test host t1 refuses spawn/);
  assert.deepEqual(operations, ['spawn']);
});


test('a successful registered Host launch persists placement and fresh resume keeps it', async t => {
  const { testHost } = await import('../src/host/test-host.ts');
  const { ProcessTable } = await import('../src/adapters/processes.ts');
  const { join } = await import('node:path');
  const root = await tempProject(t);
  const remote = { ...testHost('t1', () => {}), statDirectory: async () => ({ refusal: null, identity: null }) };
  const hub = await projectHub(t, root, {}, { hosts: [remote] });
  const ui = await sessionUi(t, hub.discovery);
  const launched = await ui.request({ type: 'session.launch', name: 'worker', harness: 'codex', role: 'implementer', host: 't1' });
  assert.equal(launched.ok, true, launched.error);
  assert.equal(hub.fakes.codex!.spawns[0]?.host, 't1');
  const table = new ProcessTable(join(root, '.cland/hub.db'));
  try {
    assert.equal(table.get('worker')?.host, 't1');
    const stopped = await ui.request({ type: 'session.stop', session: 'worker' });
    assert.equal(stopped.ok, true, stopped.error);
    const fresh = await ui.request({ type: 'session.resume', session: 'worker', fresh: true });
    assert.equal(fresh.ok, true, fresh.error);
    assert.equal(hub.fakes.codex!.spawns[1]?.host, 't1');
    assert.equal(table.get('worker')?.host, 't1');
    assert.equal(table.get('worker')?.sessionId, (launched.value as { process: { sessionId: string } }).process.sessionId);
  } finally { table.close(); }
});

test('spoke launch forwards Host placement and Coordinator handover refuses its remote row', async t => {
  const { inProcessSpoke } = await import('./harness.ts');
  const { testHost } = await import('../src/host/test-host.ts');
  const root = await tempProject(t);
  const remote = { ...testHost('t1', () => {}), statDirectory: async () => ({ refusal: null, identity: null }) };
  const hub = await projectHub(t, root, {}, { hosts: [remote] });
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  await coord.waitForPresence(['coord']);
  const unknown = await coord.call<{ ok: boolean; error?: string }>('session.launch', { name: 'missing', harness: 'codex', host: 'missing-host' });
  assert.equal(unknown.ok, false);
  assert.match(String(unknown.error), /unknown host.*missing-host/);
  assert.equal(hub.fakes.codex!.spawns.length, 0);
  const launched = await coord.call<{ ok: boolean; error?: string }>('session.launch', { name: 'remote-worker', role: 'implementer', harness: 'codex', host: 't1' });
  assert.equal(launched.ok, true, launched.error);
  assert.equal(hub.fakes.codex!.spawns[0]?.host, 't1');
  const handover = await coord.call<{ ok: boolean; error?: string }>('role.handover', {
    to: 'remote-worker', note: { goals_now: 'continue', work_in_flight: 'none', open_decisions: 'none', waiting_on: 'none' },
  });
  assert.equal(handover.ok, false);
  assert.match(String(handover.error), /Coordinator and Aide.*only on the local host/);
  const ui = await sessionUi(t, hub.discovery);
  const roles = (await ui.request({ type: 'role.list' })).value as { roles: Array<{ role: string; holders: Array<{ name: string }> }> };
  assert.ok(roles.roles.find(r => r.role === 'coordinator')?.holders.some(h => h.name === 'coord'));
});

test('production OpenCode launch refuses unsupported nonlocal shared-ignore preparation without fallback', async t => {
  const { OpenCodeAdapter } = await import('../src/adapters/opencode.ts');
  const { fixtureEnvironment } = await import('./fixture-environment.ts');
  const { testHost } = await import('../src/host/test-host.ts');
  const root = await tempProject(t);
  const operations: string[] = [];
  const launches: Array<{ host: string; role: string | undefined }> = [];
  const { localHost } = await import('../src/host/local.ts');
  const fileHost = localHost(fixtureEnvironment(root, process.env));
  const recording = (name: string) => {
    const machine = testHost(name, e => operations.push(`${name}:${e.operation}`));
    return {
      ...machine,
      // Reach the explicit nonlocal file-preparation boundary in scratch storage.
      layout: fileHost.layout,
      makeDirectory: fileHost.makeDirectory,
      writeFile: fileHost.writeFile,
      removePath: fileHost.removePath,
      freePort: fileHost.freePort,
      statDirectory: async () => ({ refusal: null, identity: null }),
      spawn: async (command: import('../src/host/host.ts').HostCommand) => {
        launches.push({ host: name, role: command.env.CLAND_ROLE });
        return machine.spawn(command);
      },
    };
  };
  const hosts = [recording('local'), recording('t1')];
  operations.length = 0;
  const hub = await projectHub(t, root, {}, { hosts, adapters: [host => new OpenCodeAdapter(host, {
    bin: '/fixture/no-native-opencode', env: fixtureEnvironment(root, process.env),
  })] });
  const ui = await sessionUi(t, hub.discovery);
  const reply = await ui.request({ type: 'session.launch', name: 'remote-opencode', role: 'implementer', harness: 'opencode', host: 't1' });
  assert.equal(reply.ok, false);
  assert.match(String(reply.error), /nonlocal OpenCode shared ignore.*T-1644/);
  assert.ok(!operations.includes('t1:spawn'));
  assert.deepEqual(launches, []);
  assert.ok(!operations.includes('local:spawn'), 'placement never falls back to local spawn');
  const listed = await ui.request({ type: 'session.list' });
  assert.deepEqual((listed.value as { processes: unknown[] }).processes, []);
});
