// T2: real socket frames prove human-slot TTL and integrated/human/item queue order.
// FakeClock and semantic local completion receipts replace package workers; native
// compatibility leases, --force, fallback and signals stay in suite-human.
import { completeJournalLines } from './journal-lines.ts';
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectHub, connectUi, tempProject, inProcessSpoke, eventually } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { LocalExecutor } from '../src/executor/local.ts';
import type { Lease, RunRef, RunStatus } from '../src/executor/executor.ts';
import type { VerificationQueue } from '../src/protocol.ts';
import { onCleanup } from './process-cleanup.ts';

async function fixture(t: TestContext) {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const head = 'a'.repeat(40);
  const delivered: RunRef[] = [];
  const receipts = new Map<string, RunStatus>();
  let held = false;
  t.mock.method(LocalExecutor.prototype, 'start', async (_lease: Lease, run: RunRef) => { delivered.push(structuredClone(run)); });
  t.mock.method(LocalExecutor.prototype, 'status', async (lease: Lease) => receipts.get(lease.run) ?? { state: 'running' });
  t.mock.method(LocalExecutor.prototype, 'reap', async () => {});
  await mkdir(join(root, '.cland'));
  await writeFile(join(root, '.cland/config.toml'), '[verification]\ntest="true"\nexecutor="local"\nbudget=1\n');
  const hub = await projectHub(t, root, {}, { clock, durationContext: null,
    compatibility: { holder: async () => null, occupied: async () => held },
    candidate: { head: async () => head, tree: async () => 'b'.repeat(40), inspect: async () => ({ head, branch: 'dev', tree: 'b'.repeat(40), selection: { mode: 'hub-only', files: [], reason: 'human queue fixture' }, tierPlan: [], budgetBase: undefined }) },
  });
  const ui = await connectUi(t, hub.discovery, 'cli');
  for (const [name, role] of [['impl', 'implementer'], ['coord', 'coordinator'], ['rev', 'reviewer']] as const) {
    assert.equal((await ui.request({ type: 'role.set', session: name, role })).ok, true);
    const spoke = await inProcessSpoke(t, { discover: true, assignRole: false, cwd: root, name, sessionId: `human-${name}`, role });
    onCleanup(t, () => spoke.close()); await spoke.waitForPresence([name]);
  }
  const item = ((await ui.request({ type: 'task.create', title: 'Human queue', size: 'M', assignee: 'impl' })).value as { item: { id: string } }).item.id;
  const topic = ((await ui.request({ type: 'topic.create', title: 'Human queue', item })).value as { topic: { id: string } }).topic.id;
  const queue = async () => (await ui.request({ type: 'suite.queue' })).value as VerificationQueue;
  const tick = async (ms = 1000) => { await clock.advance(ms); await queue(); };
  const launch = async (name = 'impl') => {
    const result = await ui.request({ type: 'suite.start', as: { name, sessionId: `human-${name}`, shell: true }, mode: 'auto', fresh: true, cwd: root, report: topic, to: ['rev'] });
    assert.equal(result.ok, true, result.error);
    const job = result.value as { id: string; pid: number | null }; assert.equal(job.pid, null); return job;
  };
  const finish = async (id: string) => {
    assert.ok(delivered.some(run => run.id === id), 'observe executor start before completion');
    receipts.set(id, { state: 'done', code: 0, finished: clock.now().toISOString() });
    await tick();
  };
  const journal = async () => { await ui.request({ type: 'hub.status', flushLogs: true }); return completeJournalLines(await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).map(line => JSON.parse(line)); };
  const results = async () => ((await ui.request({ type: 'topic.history', topic })).value as { messages: { text: string }[] }).messages.filter(m => m.text.startsWith('suite result '));
  return { root, clock, discovery: hub.discovery, ui, queue, tick, launch, delivered, finish, journal, results, head, hold: (value: boolean) => { held = value; } };
}

test('a human slot reserves admission briefly and releases a client that never takes its lease', async t => {
  const f = await fixture(t);
  const client = await connectUi(t, f.discovery, 'cli');
  const input = { type: 'suite.slot', mode: 'hub-only', cwd: f.root, head: 'fixture-head', pid: process.pid, token: 'abandoned-human' };
  assert.equal((await client.request(input)).ok, true);
  await eventually('human reservation admitted', async () => (await f.queue()).holder?.session === 'human' ? true : undefined);
  assert.equal((await f.queue()).holder?.kind, 'hand run');
  await f.tick(10000);
  await eventually('human grace expired', async () => (await f.journal()).find(e => e.event === 'verification-human-left' && e.reason === 'admission grace expired'));
  assert.equal((await f.queue()).holder, null);
  assert.equal((await client.request(input)).ok, false, 'an expired client cannot silently restart its abandoned request');
});

test('frames admit integrated dev, then a human slot, then ranked item work', async t => {
  const f = await fixture(t);
  f.hold(true);
  const ranked = await f.launch();
  const human = await connectUi(t, f.discovery, 'cli');
  const slot = await human.request({ type: 'suite.slot', mode: 'hub-only', cwd: f.root, head: 'fixture-head', pid: process.pid, token: 'priority-human' });
  assert.equal(slot.ok, true, slot.error);
  const humanId = (slot.value as { id: string }).id;
  const integrated = await f.launch('coord');
  assert.deepEqual((await f.queue()).waiters.map(w => w.id), [integrated.id, humanId, ranked.id]);
  f.hold(false); await f.tick();
  await eventually('integrated dev admitted first', async () => (await f.queue()).holder?.id === integrated.id ? true : undefined);
  await eventually('first executor start receipt', () => f.delivered.length === 1 ? true : undefined);
  assert.deepEqual(f.delivered.map(run => run.id), [integrated.id]);
  assert.deepEqual((await f.queue()).waiters.map(w => w.id), [humanId, ranked.id]);
  await f.finish(integrated.id);
  await eventually('human admitted second', async () => (await f.queue()).holder?.id === humanId ? true : undefined);
  assert.equal((await f.queue()).holder?.session, 'human');
  assert.deepEqual((await f.queue()).waiters.map(w => w.id), [ranked.id]);
  assert.deepEqual(f.delivered.map(run => run.id), [integrated.id], 'ranked worker has not started');
  human.close();
  await eventually('ranked item admitted last', async () => (await f.queue()).holder?.id === ranked.id ? true : undefined);
  await eventually('second executor start receipt', () => f.delivered.length === 2 ? true : undefined);
  assert.deepEqual(f.delivered.map(run => run.id), [integrated.id, ranked.id]);
  assert.deepEqual((await f.queue()).waiters, []);
  await f.finish(ranked.id);
  await eventually('both exact-head results posted', async () => (await f.results()).length === 2 ? true : undefined);
  for (const result of await f.results()) { assert.match(result.text, /exit 0/); assert.ok(result.text.includes(`head ${f.head}`)); }
});

test('human slots retain enqueue order ahead of ranked item requests', async t => {
  const f = await fixture(t);
  f.hold(true);
  const first = await connectUi(t, f.discovery, 'cli');
  const input = { type: 'suite.slot', mode: 'hub-only', cwd: f.root, head: 'fixture-head', pid: process.pid, token: 'first-human' };
  const a = (await first.request(input)).value as { id: string };
  const job = await f.launch();
  const second = await connectUi(t, f.discovery, 'cli');
  const b = (await second.request({ ...input, token: 'second-human' })).value as { id: string };
  assert.deepEqual((await f.queue()).waiters.map(w => w.id), [a.id, b.id, job.id]);
  first.close(); second.close();
  await eventually('both human sockets left', async () => (await f.queue()).waiters.length === 1 ? true : undefined);
  f.hold(false); await f.tick();
  await eventually('ranked executor started', () => f.delivered.some(run => run.id === job.id) ? true : undefined);
  await f.finish(job.id);
  await eventually('ranked worker finished', async () => (await f.results())[0]);
});
