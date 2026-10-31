// T1: journal projection and retention recovery use the in-process Store checkpoint.
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { COORDINATOR_RETIRED } from '../src/hub/retirement.ts';
import { agentsRecord, replayAgentsRecord } from '../src/hub/agents-topic.ts';
import { AGENTS, AGENTS_JOURNAL_CHECKPOINT, HubCore } from '../src/hub/core.ts';
import { Journal } from '../src/hub/journal.ts';
import { Store } from '../src/hub/store.ts';
import { FakeClock } from './fake-clock.ts';

test('detaching an Agents recorder preserves queued notices for restart without reading the closed store', async () => {
  const records: Record<string, unknown>[] = [];
  const agents = agentsRecord();
  const core = new HubCore();
  agents.attach(core);
  agents.tap(entry => records.push(entry))({ event: 'role-assigned', session: 'late', role: 'implementer' });
  agents.attach(null);
  core.close();
  core.store.close();
  await new Promise<void>(resolve => setImmediate(resolve));
  const restarted = new HubCore();
  try {
    assert.equal(replayAgentsRecord(restarted, records), 1);
    assert.match(restarted.topicHistory(AGENTS.id).messages[0]!.text, /late assigned Implementer/);
    assert.equal(replayAgentsRecord(restarted, records), 0, 'the deferred notice still records exactly once');
  } finally { restarted.close(); restarted.store.close(); }
});

test('recovery never resurrects pruned notices when the newest checkpoint append was held at a crash', async t => {
  const old = { ts: '2020-01-01T00:00:00Z', event: 'role-assigned', session: 'old', role: 'implementer', agentsNotice: 'pruned' };
  let completed = `${JSON.stringify(old)}\n`;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const journal = new Journal('/memory', undefined, { open: async () => ({
    stat: async () => ({ size: 0 }), read: async () => ({ bytesRead: 0 }),
    write: async (buffer: Buffer, offset: number, length: number) => { await gate; completed += buffer.subarray(offset, offset + length).toString(); return { bytesWritten: length }; },
    close: async () => {},
  }) });
  const agents = agentsRecord();
  const core = new HubCore();
  t.after(() => { core.close(); core.store.close(); });
  agents.attach(core);
  agents.tap(journal.tap(() => {}))({ event: 'role-assigned', session: 'new', role: 'implementer' });
  await Promise.resolve();
  assert.ok(core.store.meta(AGENTS_JOURNAL_CHECKPOINT));
  const surviving = completed.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(replayAgentsRecord(core, surviving), 0);
  assert.equal(core.topicHistory(AGENTS.id).messages.some(message => message.id === 'pruned'), false);
  release();
  await journal.close();
});

for (const olderPrefix of [true, false]) {
  test(`recovery advances its boundary before a later run loses notice recording (older prefix: ${olderPrefix})`, t => {
    const core = new HubCore();
    t.after(() => { core.close(); core.store.close(); });
    const old = { event: 'role-assigned', session: 'old', role: 'implementer', agentsNotice: 'pruned' };
    core.store.setMeta(AGENTS_JOURNAL_CHECKPOINT, 'unflushed-checkpoint');
    const previous = olderPrefix ? [old] : [];
    assert.equal(replayAgentsRecord(core, previous), 0);
    // A subsequent run appended this record, but the Agents DB write failed before moving its checkpoint.
    const later = { event: 'role-assigned', session: 'later', role: 'implementer', agentsNotice: 'recover-later' };
    assert.equal(replayAgentsRecord(core, [...previous, later]), 1);
    assert.deepEqual(core.topicHistory(AGENTS.id).messages.map(message => message.id), ['recover-later']);
    assert.equal(replayAgentsRecord(core, [...previous, later]), 0, 'later notice recovers once');
  });
}

test('a journalled claim lost before projection recovers in order exactly once', async t => {
  const clock = new FakeClock();
  const store = new Store();
  t.after(() => store.close());
  const first = new HubCore({ store, clock });
  const records: Record<string, unknown>[] = [];
  const recorder = agentsRecord();
  recorder.attach(first);
  recorder.tap(entry => records.push(entry))({ event: 'task-claimed', id: 'T-1', session: 'alpha' });
  await Promise.resolve();
  const recorded = first.topicHistory(AGENTS.id).messages[0]!;
  assert.equal(records[0]!.agentsNotice, recorded.id, 'journal identity matches the projected claim');
  recorder.attach(null);
  first.close();
  const lost = { ...records[0], ts: clock.now().toISOString(), id: 'T-2', session: 'beta', agentsNotice: 'lost-claim' };
  const restarted = new HubCore({ store, clock });
  t.after(() => restarted.close());
  assert.equal(replayAgentsRecord(restarted, [...records, lost]), 1);
  assert.deepEqual(restarted.topicHistory(AGENTS.id).messages.map(m => m.text), ['alpha claimed T-1', 'beta claimed T-2']);
  assert.equal(replayAgentsRecord(restarted, [...records, lost]), 0);
});

test('retention pruning every lifecycle notice preserves the no-replay checkpoint', async t => {
  const clock = new FakeClock();
  const store = new Store();
  t.after(() => store.close());
  const first = new HubCore({ store, clock });
  const records: Record<string, unknown>[] = [];
  const recorder = agentsRecord();
  recorder.attach(first);
  recorder.tap(entry => records.push(entry))({ event: 'role-assigned', session: 'alpha', role: 'implementer' });
  recorder.tap(entry => records.push(entry))({ event: 'task-claimed', session: 'alpha', id: 'T-1' });
  await Promise.resolve();
  assert.equal(first.topicHistory(AGENTS.id).messages.length, 2);
  await clock.advance(1001);
  store.prune(clock.now().getTime(), 1000);
  assert.deepEqual(first.topicHistory(AGENTS.id).messages, []);
  recorder.attach(null); first.close();
  const restarted = new HubCore({ store, clock });
  t.after(() => restarted.close());
  const logs: Record<string, unknown>[] = [];
  assert.equal(replayAgentsRecord(restarted, records, entry => logs.push(entry)), 0);
  assert.deepEqual(restarted.topicHistory(AGENTS.id).messages, []);
  assert.equal(logs.some(entry => entry.event === 'agents-record-replayed'), false);
});


test('a deduplicated General retirement notice preserves pending Agents replay across Store reopen', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cland-retirement-checkpoint-'));
  const file = join(root, 'hub.db');
  let core = new HubCore({ store: new Store(file) });
  const recorder = agentsRecord();
  const records: Record<string, unknown>[] = [];
  try {
    recorder.attach(core);
    const log = recorder.tap(entry => records.push(entry));
    log({ event: 'role-assigned', session: 'coord', role: 'coordinator' });
    await Promise.resolve();
    const checkpoint = core.store.meta(AGENTS_JOURNAL_CHECKPOINT);
    assert.ok(checkpoint);
    log({ event: 'harness-exited', session: 'coord', harness: 'claude-code', reason: 'retired' });
    const notice = { id: 'claude-retired:session:job', kind: COORDINATOR_RETIRED, text: 'Resume with cland session resume coord --relaunch' };
    core.noticeInTopic('general', notice);
    core.noticeInTopic('general', notice);
    recorder.attach(null); // Simulate shutdown before the queued lifecycle projection runs.
    core.close();
    core.store.close();
    core = new HubCore({ store: new Store(file) });
    assert.equal(core.store.meta(AGENTS_JOURNAL_CHECKPOINT), checkpoint);
    assert.equal(replayAgentsRecord(core, records), 1);
    assert.equal(replayAgentsRecord(core, records), 0);
    assert.equal(core.topicHistory('general').messages.filter(m => m.id === notice.id).length, 1);
    assert.equal(core.topicHistory(AGENTS.id).messages.filter(m => m.kind === 'session-death').length, 1);
  } finally {
    recorder.attach(null);
    core.close();
    core.store.close();
    await Promise.resolve(); // Detached projection settles before storage removal.
    await rm(root, { recursive: true, force: true });
  }
});

test('a stalled verifier diagnostic preserves pending Agents replay and deduplicates after reopen', async () => {
  const { Tracker } = await import('../src/tracker/tracker.ts');
  const { trackerItems } = await import('../src/hub/topics.ts');
  const root = await mkdtemp(join(tmpdir(), 'cland-stalled-checkpoint-'));
  const file = join(root, 'hub.db');
  const clock = new FakeClock();
  const tracker = new Tracker({ root, db: join(root, 'tracker.db'), git: async () => null, now: () => clock.now() });
  const actor = { id: 'coord-id', name: 'coord', role: 'coordinator' };
  let core = new HubCore({ store: new Store(file), items: trackerItems(tracker), clock });
  const recorder = agentsRecord();
  const records: Record<string, unknown>[] = [];
  try {
    const item = await tracker.create(actor, { title: 'Stalled review', size: 'S' });
    const hello = core.hello({ type: 'hello', protocol: 2, sessionId: actor.id, name: actor.name, role: actor.role, cwd: root }, () => true);
    assert.equal(hello.ok, true);
    recorder.attach(core);
    const log = recorder.tap(entry => records.push(entry));
    log({ event: 'role-assigned', session: 'coord', role: 'coordinator' });
    await Promise.resolve();
    const checkpoint = core.store.meta(AGENTS_JOURNAL_CHECKPOINT);
    assert.ok(checkpoint);
    assert.equal(core.sendFromSession('coord', ['reviewer'], `review request ${item.id}`).outcomes[0]?.outcome, 'queued');
    clock.block(1001);
    log({ event: 'harness-exited', session: 'coord', harness: 'codex', reason: 'fixture' });
    core.refreshPresence(); // Record diagnostic while the lifecycle projection is still pending.
    assert.equal(core.topicHistory('agents').messages.filter(m => m.detail?.outcome === 'stalled').length, 1);
    recorder.attach(null);
    core.close();
    core.store.close();
    core = new HubCore({ store: new Store(file), items: trackerItems(tracker), clock });
    assert.equal(core.store.meta(AGENTS_JOURNAL_CHECKPOINT), checkpoint);
    assert.equal(replayAgentsRecord(core, records), 1);
    core.refreshPresence();
    assert.equal(core.topicHistory('agents').messages.filter(m => m.detail?.outcome === 'stalled').length, 1);
    assert.equal(core.topicHistory('agents').messages.filter(m => m.kind === 'session-death').length, 1);
  } finally {
    recorder.attach(null);
    core.close();
    core.store.close();
    await tracker.stop();
    await Promise.resolve();
    await rm(root, { recursive: true, force: true });
  }
});
