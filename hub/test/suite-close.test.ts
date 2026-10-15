import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { integrated } from './close-run-fixture.ts';
import { clandWithEnv } from './harness.ts';

test('occasion refuses implementers and task heads; an integrated Coordinator close uses two droplets and one merged result', async t => {
  const f = await integrated(t, 'daily_spend_usd=3');
  const request = (...args: string[]) => clandWithEnv(f.root, f.actor, 'verify', 'all', '--fresh', '--report', f.topic, '--to', 'impl', '--json', ...args);
  const denied = await request('--occasion', 'stage');
  assert.equal(denied.code, 1);
  assert.match(denied.stderr, /occasion.*Coordinator|occasion.*coordinator/);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  await f.git('checkout', 'task-candidate');
  const task = await request('--occasion', 'stage');
  assert.equal(task.code, 1);
  assert.match(task.stderr, /integrated dev/);
  await f.git('checkout', 'dev');
  let reservationChecked = false;
  f.api.beforeCreate(async () => {
    if (reservationChecked) return;
    reservationChecked = true;
    const ledger = JSON.parse(await readFile(join(f.root, '.cland/executor-state/spend.json'), 'utf8')) as { entries: { reservation: number; cost: number | null }[] };
    assert.equal(ledger.entries.filter(e => e.cost === null).length, 2, 'all shards reserved before either provider create');
    assert.equal(ledger.entries.filter(e => e.cost === null).reduce((sum, e) => sum + e.reservation, 0), 0.125);
  });
  const submitted = await request('--occasion', 'stage');
  assert.equal(submitted.code, 0, submitted.stderr);
  const job = JSON.parse(submitted.stdout);
  const result = await f.result(job.id);
  assert.match(result.text, /exit 0/);
  assert.match(result.text, /occasion stage/);
  assert.match(result.text, /tests 2; pass 2/);
  assert.match(result.text, /shard duration .*shard-1.*c-8.*[\d.]+s.*cost \$/);
  assert.match(result.text, /shard duration .*shard-2.*c-8.*[\d.]+s.*cost \$/);
  assert.match(result.text, /total cost \$/);
  assert.match(result.text, /suite duration [\d.]+s; overall wall from admission through collection/);
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 2);
  assert.deepEqual(f.api.droplets, []);
  assert.equal((await f.messages(job.id)).length, 1);
  const artifacts = (await f.ui.request({ type: 'artifact.list', topic: f.topic })).value as { artifacts: { title: string; path: string }[] };
  assert.ok(artifacts.artifacts.some(a => a.title.includes('shard-1')));
  assert.ok(artifacts.artifacts.some(a => a.title.includes('shard-2')));
  const selected: Array<{ files: string[]; nvim: boolean }> = [];
  for (const artifact of artifacts.artifacts.filter(a => /shard-[12]/.test(a.title))) {
    const log = await readFile(artifact.path, 'utf8');
    selected.push(JSON.parse(log.match(/^SELECTION=(.*)$/m)![1]!).shard);
  }
  assert.deepEqual(selected.sort((a, b) => a.files[0]!.localeCompare(b.files[0]!)), [
    { files: ['hub/test/one.test.ts'], nvim: false },
    { files: ['hub/test/two.test.ts'], nvim: true },
  ]);
  const ledger = JSON.parse(await readFile(join(f.root, '.cland/executor-state/spend.json'), 'utf8'));
  assert.ok(ledger.entries.every((e: { cost: number | null }) => e.cost !== null));
  const executor = (await f.ui.request({ type: 'executor.status' })).value as { taggedDroplets: number; leases: unknown[]; spend: { spent: number; reserved: number; cap: number } };
  assert.equal(executor.taggedDroplets, 0, 'hub-observed provider cland tag listing is empty');
  assert.deepEqual(executor.leases, []);
  assert.equal(executor.spend.cap, 3);
  assert.equal(executor.spend.reserved, 0);
  assert.ok(executor.spend.spent > 0 && executor.spend.spent < 3);
});

for (const cause of ['cap', 'slots'] as const) test(`close run falls back whole with one warning when limited by ${cause}`, async t => {
  const f = await integrated(t, cause === 'cap' ? 'daily_spend_usd=0.1' : '', cause === 'slots' ? 1 : 2);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  const submitted = await clandWithEnv(f.root, f.actor, 'verify', 'all', '--fresh', '--occasion', 'stage', '--report', f.topic, '--json');
  assert.equal(submitted.code, 0, submitted.stderr);
  const job = JSON.parse(submitted.stdout);
  assert.match((await f.result(job.id)).text, /exit 0/);
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 1);
  const history = (await f.ui.request({ type: 'topic.history', topic: f.topic })).value as { messages: { text: string; severity?: string }[] };
  const notices = history.messages.filter(m => m.text.startsWith('sharding skipped:'));
  assert.deepEqual(notices.map(m => [m.text, m.severity]), [[cause === 'cap' ? 'sharding skipped: daily spend cap $0.1 would be exceeded' : 'sharding skipped: fewer than 2 remote slots free', 'warn']]);
  assert.deepEqual(f.api.droplets, []);
});

test('ordinary integrated batch uses one slot and its green tree serves a later release occasion cache hit', async t => {
  const f = await integrated(t);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  const batch = await f.spoke.call<{ ok: boolean; id: string }>('verify', { mode: 'all', cwd: f.root, report: f.topic, fresh: true });
  assert.equal(batch.ok, true);
  assert.match((await f.result(batch.id)).text, /exit 0/);
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 1);
  const close = await f.spoke.call<{ ok: boolean; id: string; cached?: { run: string } }>('verify', { mode: 'all', cwd: f.root, report: f.topic, occasion: 'release' });
  assert.equal(close.ok, true);
  assert.equal(close.cached?.run, batch.id);
  const result = await f.result(close.id);
  assert.match(result.text, /occasion release/);
  assert.match(result.text, /cached/);
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 1, 'cache hit provisions no shards');
});

test('QA can request epic through MCP but stage, release, task heads and non-full occasions are refused', async t => {
  const f = await integrated(t);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'qa' })).ok, true);
  const verify = (args: Record<string, unknown>) => f.spoke.call<{ ok: boolean; id: string; error?: string }>('verify', { mode: 'all', cwd: f.root, report: f.topic, to: ['impl'], fresh: true, ...args });
  for (const occasion of ['stage', 'release']) {
    const refused = await verify({ occasion });
    assert.equal(refused.ok, false);
    assert.match(refused.error!, /occasion requires the Coordinator/);
  }
  await f.git('checkout', 'task-candidate');
  const task = await verify({ occasion: 'epic' });
  assert.equal(task.ok, false); assert.match(task.error!, /integrated dev/);
  await f.git('checkout', 'dev');
  const reduced = await verify({ occasion: 'epic', mode: 'hub' });
  assert.equal(reduced.ok, false); assert.match(reduced.error!, /full request/);
  const job = await verify({ occasion: 'epic' });
  assert.equal(job.ok, true, job.error);
  assert.match((await f.result(job.id)).text, /occasion epic/);
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 2);
});

test('occasion refuses stale origin/dev proof when the required fresh fetch fails', async t => {
  const f = await integrated(t);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  assert.equal(await f.git('rev-parse', 'HEAD'), await f.git('rev-parse', 'origin/dev'), 'the stale local tracking ref matches HEAD');
  await f.git('remote', 'set-url', 'origin', join(f.root, 'unavailable-origin.git'));
  const result = await f.spoke.call<{ ok: boolean; id: string; error?: string }>('verify', { mode: 'all', cwd: f.root, report: f.topic, to: ['impl'], fresh: true, executor: 'local', occasion: 'stage' });
  if (result.ok) await f.result(result.id); // keep a red run's tiny worker owned through completion
  assert.equal(result.ok, false, 'an unavailable fetch must not authorize an occasion using a stale ref');
  assert.match(result.error!, /fresh.*dev|fetch.*unavailable/i);
  const q = (await f.ui.request({ type: 'suite.queue' })).value as { waiters: unknown[]; remote: unknown[] };
  assert.deepEqual(q.waiters, []); assert.deepEqual(q.remote, []);
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 0);
});
