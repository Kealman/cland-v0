// T1: syntax-level executor interface contract, without workers or a hub.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fakeOnlyFixture } from './fake-only-fixture.ts';
import { join } from 'node:path';
import ts from 'typescript';

test('bootstrap ignores ungated binary overrides at every command boundary', async t => fakeOnlyFixture(t, async root => {
  const { provisionSsh } = await import('../src/host/provision-ssh.ts');
  const record = { machine: { address: '192.0.2.1' }, ssh: { clientKeyPath: join(root, 'key'), knownHosts: 'pinned-fixture-key', user: 'agent' } } as Parameters<typeof provisionSsh>[0];
  const calls: string[] = [];
  const transport = await provisionSsh(record, join(root, 'known_hosts'), { CLAND_SSH_BIN: 'untrusted-ssh', CLAND_SCP_BIN: 'untrusted-scp' }, async bin => { calls.push(bin); });
  await transport.probe(1000);
  await transport.execute('true');
  await transport.copyFile('input', 'output');
  assert.deepEqual(calls, ['ssh', 'ssh', 'scp']);
  const { EXECUTOR_TRANSPORT_MARKER } = await import('../src/host/ssh-binaries.ts');
  await writeFile(join(root, EXECUTOR_TRANSPORT_MARKER), root);
  for (const gate of [
    { CLAND_TEST_EXECUTOR_TRANSPORT: '1', CLAND_TEST_FAKE_MACHINE_ROOT: root },
    { CLAND_FAKE_HOST_ROOT: root },
  ]) {
    calls.length = 0;
    const gatedRecord = { ...record, ssh: { ...record.ssh!, environment: { CLAND_FAKE_HOSTS: 'provider-machine' } } };
    const gated = await provisionSsh(gatedRecord, join(root, 'known_hosts'), { CLAND_SSH_BIN: 'fixture-ssh', CLAND_SCP_BIN: 'fixture-scp', ...gate }, async bin => { calls.push(bin); });
    await gated.probe(1000); await gated.execute('true'); await gated.copyFile('input', 'output');
    assert.deepEqual(calls, ['fixture-ssh', 'fixture-ssh', 'fixture-scp']);
  }
}));

test('fake provider publishes a transport marker with or without an existing directory owner', async t => fakeOnlyFixture(t, async () => {
  const { fakeDigitalOcean } = await import('./fakes/digitalocean/fake-api.ts');
  const { FakeClock } = await import('./fake-clock.ts');
  const { EXECUTOR_TRANSPORT_MARKER } = await import('../src/host/ssh-binaries.ts');
  for (const explicit of [false, true]) {
    const hooks: Array<() => Promise<void>> = [];
    const owner = { after: (close: () => Promise<void>) => { hooks.push(close); } } as import('node:test').TestContext;
    const api = await fakeDigitalOcean('synthetic-provider', { machine: 'scripted', transport: 'scripted', clock: new FakeClock(), ...(explicit ? { testContext: owner } : {}) });
    try {
      assert.equal(await readFile(join(api.stateRoot, EXECUTOR_TRANSPORT_MARKER), 'utf8'), api.stateRoot);
      assert.equal(hooks.length > 0, explicit);
    } finally {
      await api.close();
      for (const close of hooks) await close();
    }
  }
}));

test('the executor contract has nine operations and no backend-specific identifiers', async t => fakeOnlyFixture(t, async root => {
  const source = await readFile(new URL('../src/executor/executor.ts', import.meta.url), 'utf8');
  const file = ts.createSourceFile('executor.ts', source, ts.ScriptTarget.Latest, true);
  const identifiers: string[] = [];
  function visit(node: ts.Node): void {
    if (ts.isIdentifier(node)) identifiers.push(node.text);
    ts.forEachChild(node, visit);
  }
  visit(file);
  for (const forbidden of ['ssh', 'scp', 'host', 'address', 'key']) assert.ok(!identifiers.includes(forbidden), forbidden);
  const contract = file.statements.find((node): node is ts.InterfaceDeclaration => ts.isInterfaceDeclaration(node) && node.name.text === 'Executor')!;
  assert.deepEqual(contract.members.map(member => member.name!.getText(file)), ['acquire', 'prepare', 'deliver', 'start', 'status', 'log', 'cancel', 'release', 'reap']);
  assert.match(source, /'paused'/);
}));

// Pure environment policy: no process or real credential is needed.
test('executor credentials are stripped by name without reading values or changing the API environment', async t => fakeOnlyFixture(t, async root => {
  const { withoutExecutorCredentials } = await import('../../shared/executor-credentials.ts');
  const { machineEnv } = await import('../src/executor/droplet/machine.ts');
  const { suiteTestEnv } = await import('../src/verification-occasion.ts');
  const base = { PATH: '/fixture/bin', ANTHROPIC_API_KEY: 'test-harness-key' };
  const names = ['DIGITALOCEAN_TOKEN', 'CLAND_TELEGRAM_TOKEN', 'CLAND_DISCORD_TOKEN', 'ELEVENLABS_API_KEY', 'XAI_API_KEY'];
  for (const name of names) Object.defineProperty(base, name, { enumerable: true, get: () => { throw new Error('credential value must not be read'); } });
  for (const filter of [withoutExecutorCredentials, machineEnv, suiteTestEnv.bind(null, undefined)]) {
    const env = filter(base);
    for (const name of names) assert.equal(Object.hasOwn(env, name), false, name);
    assert.equal(env.PATH, '/fixture/bin');
    assert.equal(env.ANTHROPIC_API_KEY, 'test-harness-key', 'harness authentication remains available');
    assert.equal(Object.hasOwn(base, 'DIGITALOCEAN_TOKEN'), true, 'hub API environment is intact');
  }
}));

test('machine ignores binary overrides without both fake-host controls', async t => fakeOnlyFixture(t, async root => {
  const { Machine } = await import('../src/executor/droplet/machine.ts');
  const lease = { lease: 'fixture', run: 'fixture', address: '127.0.0.1' } as Parameters<InstanceType<typeof Machine>['exec']>[0];
  for (const gate of [{}, { CLAND_FAKE_HOSTS: 'executor' }, { CLAND_FAKE_HOST_ROOT: '/fixture' }, { CLAND_FAKE_HOSTS: '', CLAND_FAKE_HOST_ROOT: '/fixture' }]) {
    const calls: string[] = [];
    const machine = new Machine('/fixture', { CLAND_SSH_BIN: 'untrusted-ssh', CLAND_SCP_BIN: 'untrusted-scp', ...gate }, async bin => {
      calls.push(bin);
      return { stdout: JSON.stringify({ stdout: '', stderr: '', code: 0 }) };
    });
    await machine.exec(lease, 'true', { timeoutMs: 10 });
    await machine.result(lease, 'true', 10);
    await machine.put(lease, '/fixture/input', 'input');
    await machine.get(lease, 'output', '/fixture/output');
    assert.deepEqual(calls, ['ssh', 'ssh', 'scp', 'scp']);
  }
}));

test('executor transport gate needs both controls and a matching scratch marker', async t => fakeOnlyFixture(t, async root => {
  const { sshBinaries, EXECUTOR_TRANSPORT_MARKER } = await import('../src/host/ssh-binaries.ts');
  const overrides = { CLAND_SSH_BIN: 'fixture-ssh', CLAND_SCP_BIN: 'fixture-scp' };
  const enabled = { ...overrides, CLAND_TEST_EXECUTOR_TRANSPORT: '1', CLAND_TEST_FAKE_MACHINE_ROOT: root };
  assert.deepEqual(sshBinaries(enabled), { ssh: 'ssh', scp: 'scp' });
  await writeFile(join(root, EXECUTOR_TRANSPORT_MARKER), 'wrong-root');
  assert.deepEqual(sshBinaries(enabled), { ssh: 'ssh', scp: 'scp' });
  await writeFile(join(root, EXECUTOR_TRANSPORT_MARKER), root);
  for (const gate of [{}, { CLAND_TEST_EXECUTOR_TRANSPORT: '1' }, { CLAND_TEST_FAKE_MACHINE_ROOT: root }, { CLAND_TEST_EXECUTOR_TRANSPORT: 'true', CLAND_TEST_FAKE_MACHINE_ROOT: root }, { CLAND_TEST_EXECUTOR_TRANSPORT: '1', CLAND_TEST_FAKE_MACHINE_ROOT: 'relative' }]) {
    assert.deepEqual(sshBinaries({ ...overrides, ...gate }), { ssh: 'ssh', scp: 'scp' });
  }
  assert.deepEqual(sshBinaries(enabled), { ssh: 'fixture-ssh', scp: 'fixture-scp' });
}));

test('role launch filtering drops executor transport authority while fixture hubs retain explicit controls', async t => fakeOnlyFixture(t, async root => {
  const { withoutExecutorTransportOverrides } = await import('../../shared/executor-credentials.ts');
  const { fixtureEnvironment } = await import('./fixture-environment.ts');
  const base = { PATH: '/fixture/bin', CLAND_TEST_EXECUTOR_TRANSPORT: '1', CLAND_TEST_FAKE_MACHINE_ROOT: '/fixture' };
  assert.deepEqual(withoutExecutorTransportOverrides(base), { PATH: '/fixture/bin' });
  const inherited = fixtureEnvironment('/fixture', base);
  assert.equal(inherited.CLAND_TEST_EXECUTOR_TRANSPORT, undefined);
  assert.equal(inherited.CLAND_TEST_FAKE_MACHINE_ROOT, undefined);
  const explicit = fixtureEnvironment('/fixture', {}, base);
  assert.equal(explicit.CLAND_TEST_EXECUTOR_TRANSPORT, '1');
  assert.equal(explicit.CLAND_TEST_FAKE_MACHINE_ROOT, '/fixture');
  assert.equal(base.CLAND_TEST_EXECUTOR_TRANSPORT, '1');
}));

test('machine command and copy argv never serialize the executor environment', async t => fakeOnlyFixture(t, async root => {
  const { Machine } = await import('../src/executor/droplet/machine.ts');
  const { EXECUTOR_TRANSPORT_MARKER } = await import('../src/host/ssh-binaries.ts');
  await writeFile(join(root, EXECUTOR_TRANSPORT_MARKER), root);
  const calls: string[][] = [];
  const machine = new Machine('/fixture', { DIGITALOCEAN_TOKEN: 'test-token-not-real', CLAND_TEST_EXECUTOR_TRANSPORT: '1', CLAND_TEST_FAKE_MACHINE_ROOT: root, CLAND_SSH_BIN: 'fixture-ssh', CLAND_SCP_BIN: 'fixture-scp' }, async (bin, args, options) => {
    calls.push([bin, ...args]);
    assert.equal(Object.hasOwn(options.env, 'DIGITALOCEAN_TOKEN'), false);
    return { stdout: JSON.stringify({ stdout: '', stderr: '', code: 0 }) };
  });
  const lease = { lease: 'fixture', run: 'fixture', address: '127.0.0.1' } as Parameters<InstanceType<typeof Machine>['exec']>[0];
  await machine.exec(lease, 'true', { timeoutMs: 10 });
  await machine.result(lease, 'true', 10);
  await machine.put(lease, '/fixture/input', 'input');
  await machine.get(lease, 'output', '/fixture/output');
  assert.deepEqual(calls.map(args => args[0]), ['fixture-ssh', 'fixture-ssh', 'fixture-scp', 'fixture-scp']);
  assert.equal(calls.some(args => args.some(arg => arg.includes('test-token-not-real'))), false);
}));
