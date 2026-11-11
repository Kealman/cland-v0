// T2: socket API instrumentation proves no network; filesystem fake, no processes or real-time waits.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, stat, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hostProviderContract, type ProviderScenario } from './host-provider-contract.ts';
import type { AcquireOptions, HostArchitecture } from '../src/host/provider/provider.ts';
import { FakeHostProvider } from '../src/host/provider/fake.ts';
import { HostProviderRegistry } from '../src/host/provider/registry.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { removeFixtureSockets } from '../../shared/fixture-sockets.ts';
import { hostDirectory } from '../../shared/fake-host-directory.ts';

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'hp-'));
  t.after(async () => { await removeFixtureSockets(root); await rm(root, { recursive: true, force: true }); });
  let time = Date.parse('2026-11-06T00:00:00Z');
  const env = fixtureEnvironment(root, {}, { CLAND_FAKE_HOST_ROOT: root });
  return { root, env, now: () => time, advance: (ms: number) => { time += ms; } };
}
const request = { project: 'contract', pool: 'agents', architecture: 'x86_64' as const };
async function contractFactory(t: TestContext, scenario: ProviderScenario, architecture?: HostArchitecture) {
  const f = await fixture(t);
  const defaults = new FakeHostProvider({ env: f.env, now: f.now }).declarations;
  const provider = new FakeHostProvider({ env: f.env, now: f.now,
    declarations: { ...defaults, architectures: architecture ? [architecture] : defaults.architectures },
    bootDelayMs: scenario === 'delayed-boot' ? 200 : 0, neverBoot: scenario === 'never-boot',
    failAcquire: scenario === 'failed-acquire', ignoreDelete: scenario === 'ignored-delete',
    ...(scenario === 'refused' ? { refuseUntil: new Date(f.now() + 1000).toISOString() } : {}),
  });
  if (architecture) {
    const acquire = provider.acquire.bind(provider);
    t.mock.method(provider, 'acquire', async (options: AcquireOptions) => {
      assert.equal(options.architecture, architecture);
      return acquire(options);
    });
  }
  return { provider, admissionEffects:async()=> (await readdir(f.root,{recursive:true})).sort(), ready: async () => { f.advance(200); } };
}
hostProviderContract('fake', (t, scenario) => contractFactory(t, scenario), (name, run) => test(name, run));
for (const architecture of ['arm64', 'x86_64'] as const) {
  hostProviderContract(`fake ${architecture} only`, (t, scenario) => contractFactory(t, scenario, architecture), (name, run) => test(name, run));
}

test('fake machine has independent home, run, boot identity and pinned key', async t => {
  const f = await fixture(t), p = new FakeHostProvider({ env: f.env, now: f.now });
  const a = await p.acquire(request), b = await p.acquire(request);
  assert.equal(a.state, 'created'); assert.equal(b.state, 'created');
  if (a.state !== 'created' || b.state !== 'created') return;
  const dir = hostDirectory(f.root, a.machine.id);
  assert.ok((await stat(join(dir, 'home/.cland-host/run'))).isDirectory());
  assert.equal((await stat(join(dir, 'home/.cland-host/run'))).mode & 0o777, 0o700);
  assert.match(await readFile(join(dir, 'host-key.pub'), 'utf8'), /^ssh-ed25519 /);
  assert.notEqual(await readFile(join(dir, 'boot-id'), 'utf8'), await readFile(join(hostDirectory(f.root, b.machine.id), 'boot-id'), 'utf8'));
});
test('configured boot delay and refusal use typed states and the fixture clock', async t => {
  const f = await fixture(t);
  const p = new FakeHostProvider({ env: f.env, now: f.now, bootDelayMs: 200 });
  const a = await p.acquire(request); assert.equal(a.state, 'created');
  if (a.state !== 'created') return;
  assert.deepEqual(await p.status(a.machine), { state: 'booting' });
  f.advance(199); assert.deepEqual(await p.status(a.machine), { state: 'booting' });
  f.advance(1); assert.deepEqual(await p.status(a.machine), { state: 'ready' });
  const retryAt = new Date(f.now() + 100).toISOString();
  const limited = new FakeHostProvider({ env: f.env, now: f.now, refuseUntil: retryAt });
  assert.deepEqual(await limited.acquire(request), { state: 'refused', reason: 'fake capacity unavailable', retryAt });
  f.advance(100); assert.equal((await limited.acquire(request)).state, 'created');
});
test('never-boot and failed creation are typed failures and remain reapable', async t => {
  const f = await fixture(t), p = new FakeHostProvider({ env: f.env, now: f.now, neverBoot: true });
  const a = await p.acquire(request); assert.equal(a.state, 'created');
  if (a.state !== 'created') return;
  f.advance(1_000_000);
  assert.deepEqual(await p.status(a.machine), { state: 'failed', reason: 'fake machine will not boot' });
  assert.deepEqual(await p.release(a.machine), { state: 'released' });
  assert.deepEqual(await new FakeHostProvider({ env: f.env, failAcquire: true }).acquire(request), { state: 'failed', reason: 'fake create failed' });
});
test('ignored delete is incomplete after confirming read, including reap and restart', async t => {
  const f = await fixture(t), p = new FakeHostProvider({ env: f.env, now: f.now, ignoreDelete: true });
  const a = await p.acquire(request); assert.equal(a.state, 'created');
  if (a.state !== 'created') return;
  assert.deepEqual(await p.release(a.machine), { state: 'incomplete', reason: 'fake machine still exists after delete' });
  assert.equal((await p.status(a.machine)).state, 'ready');
  assert.deepEqual(await p.reap(request), { state: 'reaped', released: [], incomplete: [a.machine.id] });
  const restarted = new FakeHostProvider({ env: f.env, now: f.now });
  assert.deepEqual(await restarted.reap(request), { state: 'reaped', released: [a.machine.id], incomplete: [] });
});
test('registry refuses fake outside its test environment and caches registered providers', async t => {
  const f = await fixture(t);
  for (const env of [{}, { CLAND_FAKE_HOST_ROOT: 'relative' }]) {
    assert.throws(() => new HostProviderRegistry({ env }).resolve({ provider: 'fake' }), /absolute CLAND_FAKE_HOST_ROOT test environment/);
  }
  const registry = new HostProviderRegistry({ env: f.env });
  const p = registry.resolve({ provider: 'fake' });
  assert.equal(p, registry.resolve({ provider: 'fake' }));
  registry.register('another', () => p);
  assert.equal(registry.resolve({ provider: 'another' }), p);
  assert.throws(() => registry.register('fake', () => p), /already registered/);
  assert.throws(() => registry.resolve({ provider: 'absent' }), /unknown host provider/);
});
test('fake opens no network socket for any lifecycle operation', async t => {
  const net = await import('node:net');
  const tls = await import('node:tls');
  const forbidden = () => { throw new Error('network forbidden'); };
  const server = t.mock.method(net.default, 'createServer', forbidden);
  const listen = t.mock.method(net.default.Server.prototype, 'listen', forbidden);
  const connect = t.mock.method(net.default.Socket.prototype, 'connect', forbidden);
  const secure = t.mock.method(tls.default, 'connect', forbidden);
  const fetch = t.mock.method(globalThis, 'fetch', forbidden);
  assert.throws(() => net.default.createServer(), /network forbidden/);
  assert.throws(() => new net.default.Server().listen(0), /network forbidden/);
  assert.throws(() => new net.default.Socket().connect(1), /network forbidden/);
  assert.throws(() => tls.default.connect(1), /network forbidden/);
  assert.throws(() => globalThis.fetch('http://127.0.0.1:1'), /network forbidden/);
  for (const mock of [server, listen, connect, secure, fetch]) mock.mock.resetCalls();
  const f = await fixture(t), p = new HostProviderRegistry({ env: f.env }).resolve({ provider: 'fake' });
  assert.equal((await p.prepare()).state, 'prepared');
  const a = await p.acquire(request); assert.equal(a.state, 'created');
  if (a.state !== 'created') return;
  assert.equal((await p.status(a.machine)).state, 'ready');
  assert.deepEqual(await p.release(a.machine), { state: 'released' });
  assert.deepEqual(await p.reap(request), { state: 'reaped', released: [], incomplete: [] });
  for (const mock of [server, listen, connect, secure, fetch]) assert.equal(mock.mock.callCount(), 0);
});
test('reap never calls a missing machine record a successful sweep', async t => {
  const f = await fixture(t), p = new FakeHostProvider({ env: f.env });
  const a = await p.acquire(request); assert.equal(a.state, 'created');
  if (a.state !== 'created') return;
  await rm(join(hostDirectory(f.root, a.machine.id), 'provider.json'));
  assert.deepEqual(await p.reap(request), { state: 'failed', reason: 'fake reap read failed' });
});
test('missing provider metadata cannot turn a retained machine into released', async t => {
  const f = await fixture(t), p = new FakeHostProvider({ env: f.env });
  const a = await p.acquire(request); assert.equal(a.state, 'created');
  if (a.state !== 'created') return;
  await rm(join(hostDirectory(f.root, a.machine.id), 'provider.json'));
  assert.deepEqual(await p.status(a.machine), { state: 'failed', reason: 'fake machine read failed' });
  assert.equal((await p.release(a.machine)).state, 'incomplete');
});
test('fake declarations include paid address in idle price and destroy billed stopped machines', async t => {
  const f = await fixture(t);
  const declarations = {
    prices: { small: { livePerHour: 0.1, idleComputePerHour: 0.02 } },
    stoppedBills: true, billingGranularityMs: 1000, billingMinimumMs: 60_000,
    tokenConfinement: 'project' as const, apiRequestsPerMinute: 17, machineLimit: 5,
    architectures: ['arm64' as const], extraAddressPerHour: 0.01, volumePerGiBMonth: 0, snapshotPerGiBMonth: 0,
  };
  const p = new FakeHostProvider({ env: f.env, declarations });
  assert.ok(p.declarations.prices.small);
  assert.equal(p.declarations.prices.small.idlePerHour, 0.03);
  assert.equal(p.declarations.stopAction, 'destroy');
  assert.equal(p.declarations.apiRequestsPerMinute, 17);
  assert.equal(new FakeHostProvider({ env: f.env, declarations: { ...declarations, stoppedBills: false } }).declarations.stopAction, 'stop');
  assert.throws(() => new FakeHostProvider({ env: f.env, declarations: { ...declarations, billingMinimumMs: 1001 } }), /invalid host provider declaration/);
});

test('fake refuses acquisition outside its declared architectures', async t => {
  const f = await fixture(t);
  const defaults = new FakeHostProvider({ env: f.env }).declarations;
  const provider = new FakeHostProvider({ env: f.env, now: f.now, declarations: { ...defaults, architectures: ['arm64'] } });
  assert.deepEqual(await provider.acquire(request), { state: 'failed', reason: 'fake architecture unsupported' });
  assert.deepEqual(await provider.reap(request), { state: 'reaped', released: [], incomplete: [] });
});

test('fake provider refuses underscore pools consistently with config', async t => {
  const f = await fixture(t);
  const provider = new FakeHostProvider({ env: f.env, now: f.now });
  assert.equal((await provider.acquire({ ...request, pool: 'agents_1' })).state, 'failed');
  assert.equal((await provider.reap({ ...request, pool: 'agents_1' })).state, 'failed');
});
