// T1: hosts parser and managed rendering are pure boundaries.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readHostPools } from '../src/host/transport-config.ts';
import { defaultConfig, parseConfig, renderConfig } from '../src/init/config.ts';

test('host pools default capacity, agent minimum and global policy', () => {
  const hosts = readHostPools({ agents: { provider: 'fake' }, qa: { provider: 'fake', size: 's-2vcpu-4gb' } });
  assert.deepEqual(hosts.pools.agents, { provider: 'fake', size: 's-4vcpu-8gb', region: 'lon1', transport: 'ssh', slots: 8, minHosts: 1, maxHosts: 2, idleStop: '20m', idleStopMs: 1200000, spread: false });
  assert.equal(hosts.pools.qa!.slots, 4);
  assert.equal(hosts.pools.qa!.minHosts, 0);
  assert.equal(hosts.dailySpendUsd, 3);
  assert.equal(hosts.leaseMs, 43200000);
});

test('hosts rendering adds global defaults without creating a pool and upgrades old config', () => {
  const generated = renderConfig(defaultConfig('fixture'));
  assert.match(generated, /\[hosts\]\ndaily_spend_usd = 3\nlease = "12h"/);
  assert.equal(Object.keys(parseConfig(generated, '', {}).hosts.pools).length, 0);
  const old = '# managed by cland\n[hosts]\nharnesses={codex="1.2.3"}\n[hosts.qa]\nprovider="fake"\n';
  const upgraded = parseConfig(renderConfig(parseConfig(old, 'fixture', {}), old), '', {});
  assert.equal(upgraded.hosts.pools.qa!.slots, 8);
  assert.deepEqual(upgraded.hosts.harnesses, { codex: '1.2.3' });
});

for (const [key, value] of Object.entries({ provider: '', size: false, region: '', slots: 0, min_hosts: -1, max_hosts: 0.5, idle_stop: 'never', spread: 'true', transport: 'outbound' })) {
  test(`host pool refuses invalid ${key} naming its key`, () => {
    assert.throws(() => readHostPools({ qa: { provider: 'fake', [key]: value } }), new RegExp(`hosts.qa.${key}`));
  });
}
for (const [key, value] of Object.entries({ daily_spend_usd: -1, lease: '29s', weights: { codex: 0 }, harnesses: { codex: 'latest' } })) {
  test(`hosts refuses invalid ${key} naming its key`, () => {
    assert.throws(() => readHostPools({ [key]: value }), new RegExp(`hosts.${key}`));
  });
}
test('required provider, custom size slots, lease boundary and explicit overrides', () => {
  assert.throws(() => readHostPools({ qa: {} }), /hosts.qa.provider/);
  assert.throws(() => readHostPools({ qa: { provider: 'fake', size: 'custom' } }), /hosts.qa.slots/);
  const parsed = readHostPools({ daily_spend_usd: 5, lease: '30s', weights: { codex: 0.5 }, qa: { provider: 'fake', size: 'custom', region: 'fake-1', slots: 1.5, min_hosts: 2, max_hosts: 4, idle_stop: '30s', spread: true } });
  assert.equal(parsed.leaseMs, 30000);
  assert.equal(parsed.dailySpendUsd, 5);
  assert.deepEqual(parsed.weights, { codex: 0.5 });
  assert.deepEqual(parsed.pools.qa, { provider: 'fake', size: 'custom', region: 'fake-1', transport: 'ssh', slots: 1.5, minHosts: 2, maxHosts: 4, idleStop: '30s', idleStopMs: 30000, spread: true });
  assert.throws(() => readHostPools({ agents: { provider: 'fake', max_hosts: 0 } }), /hosts.agents.min_hosts.*hosts.agents.max_hosts/);
});
