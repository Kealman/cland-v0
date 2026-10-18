// T2: item identities, authority and persistence use in-process hubs and spokes.
import { FakeClock } from './fake-clock.ts';
import { onCleanup } from './process-cleanup.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { connectUi, connectWsUi, inProcessSpoke, projectHub, startHub, tempProject, TEST_SECRET } from './harness.ts';
import type { Artifact, Message } from '../src/protocol.ts';
import { Tracker } from '../src/tracker/tracker.ts';
import { fixedRoles } from '../src/roles/config.ts';
import { createSocketEdge } from '../src/hub/socket.ts';
import { Store } from '../src/hub/store.ts';

test('Reviewer reports resolve to the item claimant; unclaimed reports resolve to the Coordinator', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await connectUi(t, discovery);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  const impl = await inProcessSpoke(t, { cwd: root, discover: true, name: 'impl', role: 'implementer', sessionId: 'impl-id' });
  const rev = await inProcessSpoke(t, { cwd: root, discover: true, name: 'rev', role: 'reviewer', sessionId: 'rev-id' });
  onCleanup(t, () => coord.close()); onCleanup(t, () => impl.close()); onCleanup(t, () => rev.close());
  await coord.waitForPresence(['coord', 'impl', 'rev']);
  await rev.waitForEvent(e => e.params.meta?.kind === 'role' && e.params.content.includes('`to: ["lead T-<n>"]`'));
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Item lead', assignee: 'impl' });
  assert.equal((await impl.call<{ ok: boolean }>('task.claim', { id: item.id })).ok, true);
  const text = `review not clear ${item.id}`;
  const sent = await rev.call<{ ok: boolean; outcomes: Array<{ to: string; outcome: string }> }>('send', { to: [`@lead ${item.id}`], text });
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.deepEqual(sent.outcomes, [{ to: `lead ${item.id}`, outcome: 'delivered' }]);
  const delivered = await impl.waitForEvent(e => e.params.content.includes(text));
  assert.equal(delivered.params.meta?.to, 'impl');
  assert.equal(coord.events.some(e => e.params.content.includes(text)), false);
  const history = await ui.request({ type: 'topic.history', topic: 'agents' });
  assert.deepEqual((history.value as { messages: Message[] }).messages.find(m => m.text === text)?.to, ['impl']);

  assert.equal((await impl.call<{ ok: boolean }>('task.claim', { id: item.id, release: true })).ok, true);
  const fallback = `review clear ${item.id}`;
  await rev.call('send', { to: [`lead ${item.id}`], text: fallback });
  await coord.waitForEvent(e => e.params.content.includes(fallback));
  const after = await ui.request({ type: 'topic.history', topic: 'agents' });
  assert.deepEqual((after.value as { messages: Message[] }).messages.find(m => m.text === fallback)?.to, ['coord']);
});

test('verdict events use the lead explicit subscription and QA reports use the same item address', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await connectUi(t, discovery);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  const impl = await inProcessSpoke(t, { cwd: root, discover: true, name: 'impl', role: 'implementer', sessionId: 'impl-id' });
  const qa = await inProcessSpoke(t, { cwd: root, discover: true, name: 'qa-one', role: 'qa', sessionId: 'qa-id' });
  onCleanup(t, () => coord.close()); onCleanup(t, () => impl.close()); onCleanup(t, () => qa.close());
  await qa.waitForPresence(['coord', 'impl', 'qa-one']);
  await qa.waitForEvent(e => e.params.meta?.kind === 'role' && e.params.content.includes('`to: ["lead T-<n>"]`'));
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'QA lead', assignee: 'impl' });
  await impl.call('task.claim', { id: item.id });
  await impl.call('subscribe', { subject: { item: item.id }, events: ['task'] });
  assert.equal((await qa.call<{ ok: boolean }>('task.comment', { id: item.id, verdict: 'qa', result: 'not clear', run: 'lead-qa' })).ok, true);
  await qa.call('send', { to: [`lead ${item.id}`], text: `qa not clear ${item.id}` });
  const delivered = await impl.waitForEvent(e => e.params.content.includes(`qa not clear ${item.id}`));
  assert.match(delivered.params.content, /verdict posted qa not clear · lead-qa/);
  assert.equal(coord.events.some(e => e.params.content.includes('verdict posted qa')), false);
  const history = await ui.request({ type: 'topic.history', topic: 'agents' });
  const verdict = (history.value as { messages: Message[] }).messages.find(m => m.kind === 'event' && m.text.includes('verdict posted qa'));
  assert.deepEqual(verdict?.to, ['impl']);
});

test('a human claim falls back to Coordinator and item addressing preserves ordinary send permissions', async t => {
  const root = await tempProject(t);
  const tracker = new Tracker({ git: async () => null, readBase: async () => null, root, db: join(root, '.cland', 'hub.db') });
  tracker.start();
  onCleanup(t, () => tracker.stop());
  const roles = new Map(fixedRoles().get());
  const reviewer = roles.get('reviewer')!;
  roles.set('reviewer', { ...reviewer, permissions: { tools: ['send:human', 'who'] } });
  const hub = await startHub({ clock: new FakeClock(), hasTerritory: async () => false, tracker, roles: fixedRoles(roles) });
  onCleanup(t, () => hub.close());
  const ui = await connectWsUi(t, hub);
  await ui.request({ type: 'role.set', session: 'coord', role: 'coordinator' });
  await ui.request({ type: 'role.set', session: 'rev', role: 'reviewer' });
  const coord = await inProcessSpoke(t, { hub, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  const rev = await inProcessSpoke(t, { hub, name: 'rev', role: 'reviewer', sessionId: 'rev-id' });
  onCleanup(t, () => coord.close()); onCleanup(t, () => rev.close());
  await coord.waitForPresence(['coord', 'rev']);
  const made = await ui.request({ size: 'M', type: 'task.create', title: 'Human claim' });
  const item = (made.value as { item: { id: string } }).item;
  assert.equal((await ui.request({ type: 'task.claim', item: item.id })).ok, true);
  const refused = await rev.call<{ ok: boolean; permission: string }>('send', { to: [`lead ${item.id}`], text: 'agents are outside my grant' });
  assert.equal(refused.ok, false);
  assert.equal(refused.permission, 'send:agents');
  const sent = await ui.request({ type: 'topic.send', topic: 'general', to: [`lead ${item.id}`], text: 'the human claim is not an agent target' });
  assert.equal(sent.ok, true, sent.error);
  assert.deepEqual((sent.value as { message: Message }).message.to, ['coord']);
  await coord.waitForEvent(e => e.params.content.includes('the human claim is not an agent target'));
});

for (const change of ['claim', 'identity', 'close'] as const) {
  test(`attachment I/O resolves the item lead after the ${change} changes, immediately before recording`, async t => {
    const root = await tempProject(t);
    const tracker = new Tracker({ git: async () => null, readBase: async () => null, root, db: join(root, '.cland', 'hub.db') });
    tracker.start();
    onCleanup(t, () => tracker.stop());
    let entered!: () => void;
    let release!: () => void;
    const reading = new Promise<void>(resolve => { entered = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    onCleanup(t, () => release());
    const hub = await startHub({ clock: new FakeClock(), hasTerritory: async () => false, tracker, roles: fixedRoles(),
      env: { DIGITALOCEAN_TOKEN: '', CLAND_EXECUTOR_STATE: join(root, '.cland/executor-state') },
      readArtifact: async path => { const bytes = await readFile(path); entered(); await gate; return bytes; },
      control: { status: () => ({ root, pid: process.pid, port: 0, socket: '', version: 'test', startedAt: new Date().toISOString(), uptimeMs: 0 }), stop() {} },
    });
    onCleanup(t, () => hub.close());
    const socket = join(root, 'hub.sock');
    const edge = await createSocketEdge({ path: socket, dispatcher: hub.dispatcher });
    onCleanup(t, () => edge.close());
    const ui = await connectUi(t, { socket, secret: TEST_SECRET });
    for (const [session, role] of [['first', 'implementer'], ['second', 'implementer'], ['rev', 'reviewer']]) {
      assert.equal((await ui.request({ type: 'role.set', session, role })).ok, true);
    }
    const made = await ui.request({ size: 'M', type: 'task.create', title: 'Deferred lead', assignee: 'first' });
    const item = (made.value as { item: { id: string } }).item;
    const opened = await ui.request({ type: 'topic.create', title: 'Deferred review' });
    const topic = (opened.value as { topic: { id: string } }).topic.id;
    assert.equal((await ui.request({ type: 'task.claim', item: item.id, as: { name: 'first' } })).ok, true);
    const rev = await inProcessSpoke(t, { hub, name: 'rev', role: 'reviewer', sessionId: 'rev-id' });
    onCleanup(t, () => rev.close());
    await rev.waitForPresence(['rev']);
    const madeArtifact = await ui.request({ type: 'artifact.create', kind: 'note', title: 'Review', topic, content: 'Review evidence' });
    assert.equal(madeArtifact.ok, true, madeArtifact.error);
    const artifact = (madeArtifact.value as { artifact: Artifact }).artifact;
    const text = `deferred ${change} report`;
    const sending = rev.call<{ ok: boolean; error?: string }>('send', { to: [`@lead ${item.id}`], topic, text, artifacts: [artifact.id] });
    await reading;
    if (change === 'claim') {
      assert.equal((await ui.request({ type: 'task.claim', item: item.id, release: true, as: { name: 'first' } })).ok, true);
      await ui.request({ type: 'task.edit', item: item.id, assignee: 'second' });
      assert.equal((await ui.request({ type: 'task.claim', item: item.id, as: { name: 'second' } })).ok, true);
    }
    if (change === 'close') assert.equal((await ui.request({ type: 'task.close', item: item.id })).ok, true);
    const recipient = await inProcessSpoke(t, { hub, name: change === 'claim' ? 'second' : 'first', role: 'implementer', sessionId: 'recipient-real' });
    onCleanup(t, () => recipient.close());
    await recipient.waitForPresence([change === 'claim' ? 'second' : 'first', 'rev']);
    release();
    const sent = await sending;
    assert.equal(sent.ok, change !== 'close', sent.error);
    const history = await ui.request({ type: 'topic.history', topic });
    const recorded = (history.value as { messages: Message[] }).messages.find(m => m.text === text);
    if (change === 'close') {
      assert.match(sent.error!, new RegExp(`${item.id} is closed: address coordinator instead`));
      assert.equal(recorded, undefined);
    } else {
      assert.deepEqual(recorded?.to, [change === 'claim' ? 'second' : 'first']);
      await recipient.waitForEvent(e => e.params.content.includes(text));
    }
  });
}

for (const cleanup of ['normal', 'interrupted'] as const) {
  test(`failed adoption preserves the renamed claimant across restart and releases the alias after ${cleanup} cleanup`, async t => {
    const root = await tempProject(t);
    const db = join(root, '.cland', 'hub.db');
    let tracker = new Tracker({ git: async () => null, readBase: async () => null, root, db });
    tracker.start();
    onCleanup(t, () => tracker.stop());
    let hub = await startHub({ clock: new FakeClock(), hasTerritory: async () => false, tracker, store: new Store(db), roles: fixedRoles() });
    onCleanup(t, () => hub.close());
    let ui = await connectWsUi(t, hub);
    await ui.request({ type: 'role.set', session: 'impl', role: 'implementer' });
    await ui.request({ type: 'role.set', session: 'rev', role: 'reviewer' });
    const made = await ui.request({ size: 'M', type: 'task.create', title: 'Provisional lead', assignee: 'impl' });
    const item = (made.value as { item: { id: string } }).item;
    assert.equal((await ui.request({ type: 'task.claim', item: item.id, as: { name: 'impl' } })).ok, true);
    const prepare = DatabaseSync.prototype.prepare;
    let blocked = true;
    let cleanupBlocked = false;
    let failures = 0;
    t.mock.method(DatabaseSync.prototype, 'prepare', function (this: DatabaseSync, sql: string) {
      if (cleanupBlocked && sql.startsWith('delete from meta where key = ? and value = ?')) throw new Error('alias cleanup deliberately failed');
      if (blocked && sql.startsWith('update tracker_written_verdicts set session_id')) {
        failures++;
        throw new Error('SQLite adoption deliberately failed');
      }
      return prepare.call(this, sql);
    });
    let impl = await inProcessSpoke(t, { hub, name: 'impl', role: 'implementer', sessionId: 'impl-real' });
    let rev = await inProcessSpoke(t, { hub, name: 'rev', role: 'reviewer', sessionId: 'rev-real' });
    onCleanup(t, () => blocked = false); onCleanup(t, () => impl.close()); onCleanup(t, () => rev.close());
    await rev.waitForPresence(['impl', 'rev']);
    assert.ok(failures > 0);
    const before = await ui.request({ type: 'task.view', item: item.id });
    assert.equal((before.value as { item: { claim: { sessionId: string } } }).item.claim.sessionId, 'name:impl');
    // Only the Coordinator can rename; the existing Implementer claim keeps its identity and provenance.
    assert.equal((await ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
    const renamed = await impl.call<{ ok: boolean; error?: string }>('rename', { name: 'renamed' });
    assert.equal(renamed.ok, true, renamed.error);
    const text = 'report through authoritative identity';
    const sent = await rev.call<{ ok: boolean; outcomes: Array<{ outcome: string }> }>('send', { to: [`@lead ${item.id}`], text });
    assert.equal(sent.ok, true, JSON.stringify(sent));
    assert.equal(sent.outcomes[0]?.outcome, 'delivered');
    await impl.waitForEvent(e => e.params.content.includes(text));
    const history = await ui.request({ type: 'topic.history', topic: 'agents' });
    assert.deepEqual((history.value as { messages: Message[] }).messages.find(m => m.text === text)?.to, ['renamed']);
    const fenced = await impl.call<{ ok: boolean; error: string }>('task.claim', { id: item.id, release: true });
    assert.equal(fenced.ok, false);
    assert.match(fenced.error, /adoption deliberately failed/);
    const collision = await impl.call<{ ok: boolean; error: string }>('rename', { name: 'impl' });
    assert.equal(collision.ok, false);
    assert.match(collision.error, /pending session identity adoption/);
    await impl.close();
    await rev.close();
    ui.close();
    await hub.close();
    await tracker.stop();
    tracker = new Tracker({ git: async () => null, readBase: async () => null, root, db });
    tracker.start();
    hub = await startHub({ clock: new FakeClock(), hasTerritory: async () => false, tracker, store: new Store(db), roles: fixedRoles() });
    ui = await connectWsUi(t, hub);
    impl = await inProcessSpoke(t, { hub, name: 'renamed', role: 'coordinator', sessionId: 'impl-real' });
    rev = await inProcessSpoke(t, { hub, name: 'rev', role: 'reviewer', sessionId: 'rev-real' });
    await rev.waitForPresence(['renamed', 'rev']);
    const stillFenced = await impl.call<{ ok: boolean; error: string }>('task.comment', { id: item.id, text: 'Before retry.' });
    assert.equal(stillFenced.ok, false);
    assert.match(stillFenced.error, /adoption deliberately failed/);
    assert.equal((await impl.call<{ ok: boolean }>('rename', { name: 'impl' })).ok, false);
    await rev.call('send', { to: [`@lead ${item.id}`], text: 'after restart before retry' });
    await impl.waitForEvent(e => e.params.content.includes('after restart before retry'));
    blocked = false;
    cleanupBlocked = cleanup === 'interrupted';
    const retried = await impl.call<{ ok: boolean; error?: string }>('task.comment', { id: item.id, text: 'Retry adoption.' });
    assert.equal(retried.ok, !cleanupBlocked, retried.error);
    if (cleanupBlocked) {
      assert.match(retried.error!, /alias cleanup deliberately failed/);
      await impl.close();
      await rev.close();
      ui.close();
      await hub.close();
      await tracker.stop();
      cleanupBlocked = false;
      tracker = new Tracker({ git: async () => null, readBase: async () => null, root, db });
      tracker.start();
      hub = await startHub({ clock: new FakeClock(), hasTerritory: async () => false, tracker, store: new Store(db), roles: fixedRoles() });
      ui = await connectWsUi(t, hub);
      impl = await inProcessSpoke(t, { hub, name: 'renamed', role: 'coordinator', sessionId: 'impl-real' });
      rev = await inProcessSpoke(t, { hub, name: 'rev', role: 'reviewer', sessionId: 'rev-real' });
      await rev.waitForPresence(['renamed', 'rev']);
    }
    const after = await ui.request({ type: 'task.view', item: item.id });
    assert.equal((after.value as { item: { claim: { sessionId: string } } }).item.claim.sessionId, 'impl-real');
    assert.equal((await rev.call<{ ok: boolean }>('send', { to: [`@lead ${item.id}`], text: 'after successful adoption' })).ok, true);
    await impl.waitForEvent(e => e.params.content.includes('after successful adoption'));
    assert.equal((await impl.call<{ ok: boolean }>('rename', { name: 'impl' })).ok, true, 'completed adoption releases the preserved alias');
    await rev.call('send', { to: [`@lead ${item.id}`], text: 'after the name is available again' });
    await impl.waitForEvent(e => e.params.content.includes('after the name is available again'));
    assert.equal((await impl.call<{ ok: boolean }>('rename', { name: 'final' })).ok, true);
    assert.equal((await ui.request({ type: 'role.set', session: 'impl', role: 'implementer' })).ok, true);
    const another = await ui.request({ size: 'M', type: 'task.create', title: 'Recycled provisional name', assignee: 'impl' });
    const second = (another.value as { item: { id: string } }).item;
    assert.equal((await ui.request({ type: 'task.claim', item: second.id, as: { name: 'impl' } })).ok, true);
    const secondView = await ui.request({ type: 'task.view', item: second.id });
    assert.equal((secondView.value as { item: { claim: { sessionId: string } } }).item.claim.sessionId, 'name:impl', 'the recycled name cannot adopt the previous claimant identity');
    const recycled = await inProcessSpoke(t, { hub, name: 'impl', role: 'implementer', sessionId: 'recycled-real' });
    onCleanup(t, () => recycled.close());
    await recycled.waitForPresence(['impl', 'final', 'rev']);
    await rev.call('send', { to: [`lead ${second.id}`], text: 'for the new claimant' });
    await recycled.waitForEvent(e => e.params.content.includes('for the new claimant'));
    assert.equal(impl.events.some(e => e.params.content.includes('for the new claimant')), false);
  });
}

test('a recorded lead recipient survives claim replacement and hub restart', async t => {
  const root = await tempProject(t);
  let served = await projectHub(t, root, {}, { clock: new FakeClock() });
  let { discovery } = served;
  let ui = await connectUi(t, discovery);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  const first = await inProcessSpoke(t, { cwd: root, discover: true, name: 'first', role: 'implementer', sessionId: 'first-id' });
  const second = await inProcessSpoke(t, { cwd: root, discover: true, name: 'second', role: 'implementer', sessionId: 'second-id' });
  onCleanup(t, () => coord.close()); onCleanup(t, () => first.close()); onCleanup(t, () => second.close());
  await coord.waitForPresence(['coord', 'first', 'second']);
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Fixed recipient', assignee: 'first' });
  await first.call('task.claim', { id: item.id });
  const text = 'recorded for the first claimant';
  await coord.call('send', { to: [`@lead ${item.id}`], text, kind: 'progress' });
  assert.equal((await first.call<{ ok: boolean }>('task.claim', { id: item.id, release: true })).ok, true);
  await coord.call('task.edit', { id: item.id, assignee: 'second' });
  assert.equal((await second.call<{ ok: boolean }>('task.claim', { id: item.id })).ok, true);
  ui.close();
  await served.stop();
  served = await projectHub(t, root, {}, { clock: new FakeClock() });
  ({ discovery } = served);
  ui = await connectUi(t, discovery);
  await coord.waitForPresence(['coord', 'first', 'second']);
  await coord.call('send', { to: ['first'], text: 'first next turn' });
  const delivered = await first.waitForEvent(e => e.params.content.includes('first next turn'));
  assert.match(delivered.params.content, /recorded for the first claimant/);
  await coord.call('send', { to: [`lead ${item.id}`], text: 'second next turn' });
  const current = await second.waitForEvent(e => e.params.content.includes('second next turn'));
  assert.doesNotMatch(current.params.content, /recorded for the first claimant/);
  const history = await ui.request({ type: 'topic.history', topic: 'agents' });
  const messages = (history.value as { messages: Message[] }).messages;
  assert.deepEqual(messages.find(m => m.text === text)?.to, ['first']);
  assert.deepEqual(messages.find(m => m.text === 'second next turn')?.to, ['second']);
});

test('human @lead mentions reach the claimant, with explicit errors for closed, unknown and malformed items', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await connectUi(t, discovery);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  const impl = await inProcessSpoke(t, { cwd: root, discover: true, name: 'impl', role: 'implementer', sessionId: 'impl-id' });
  onCleanup(t, () => coord.close()); onCleanup(t, () => impl.close());
  await coord.waitForPresence(['coord', 'impl']);
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Human routing', assignee: 'impl' });
  await impl.call('task.claim', { id: item.id });
  const human = await ui.request({ type: 'topic.send', topic: 'general', text: `@lead ${item.id}, please explain the review.` });
  assert.equal(human.ok, true, human.error);
  assert.deepEqual((human.value as { message: Message }).message.to, ['impl']);
  await impl.waitForEvent(e => e.params.content.includes('please explain the review'));
  assert.equal((await impl.call<{ ok: boolean }>('send', { topic: 'general', text: 'The human addressed me.' })).ok, true);
  for (const to of ['lead T-999', 'lead T-0', 'lead T-bad']) {
    const refused = await coord.call<{ ok: boolean; error: string }>('send', { to: [to], text: 'late report' });
    assert.equal(refused.ok, false);
    assert.match(refused.error, /coordinator instead/);
    assert.ok(refused.error.includes(to.startsWith('lead ') ? to.slice(5) : to));
  }
  await coord.call('task.close', { id: item.id });
  const closed = await ui.request({ type: 'topic.send', topic: 'general', text: `@lead ${item.id} late report` });
  assert.equal(closed.ok, false);
  assert.match(closed.error!, new RegExp(`${item.id} is closed: address coordinator instead`));
});
