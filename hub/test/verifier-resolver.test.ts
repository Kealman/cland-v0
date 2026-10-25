// T1: the production routing resolver runs over in-memory presence, holds and tracker records.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HubCore, type Connection } from '../src/hub/core.ts';
import { trackerItems } from '../src/hub/topics.ts';
import { verifierRequest } from '../src/hub/verifier-request.ts';
import { Tracker, type Actor } from '../src/tracker/tracker.ts';
import type { HarnessProcessView, Message } from '../src/protocol.ts';
import { FakeClock } from './fake-clock.ts';

async function resolver(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'cland-verifier-resolver-'));
  const tracker = new Tracker({ root, db: join(root, 'tracker.db'), git: async () => null });
  const clock = new FakeClock();
  const core = new HubCore({ clock, items: trackerItems(tracker), sessionHolds: id => tracker.sessionHolds(id), rateLimit: { max: 100, windowMs: 60_000 }, loopBreaker: { max: 100, windowMs: 60_000, muteMs: 60_000 } });
  t.after(async () => { core.close(); core.store.close(); await tracker.stop(); await rm(root, { recursive: true, force: true }); });
  const received = new Map<string, Message[]>();
  const connections = new Map<string, Connection>();
  const actor = (name: string, role: string): Actor => ({ id: `${name}-id`, name, role });
  const peer = (name: string, role: string) => {
    received.set(name, []);
    const hello = core.hello({ type: 'hello', protocol: 2, sessionId: `${name}-id`, name, role, cwd: root }, message => { received.get(name)!.push(message); return true; });
    assert.equal(hello.ok, true);
    if (!hello.ok) throw new Error('hello refused');
    connections.set(name, hello.connection);
    core.setSessionState(`${name}-id`, name, 'idle', 'fixture');
    assert.equal(core.sessionState(`${name}-id`), 'idle');
    return actor(name, role);
  };
  const ack = (name: string) => { for (const message of received.get(name)!) { core.ack(connections.get(name)!, message.id); core.markInjected(message.id, name); } };
  const send = (from: string, role: string, text: string, topic?: string) => core.sendFromSession(from, [role], text, undefined, topic);
  const coord = peer('coord', 'coordinator');
  return { root, tracker, core, clock, received, connections, actor, peer, ack, send, coord };
}

test('the shared request matcher accepts detail after the item and refuses a glued or buried id', () => {
  assert.deepEqual(verifierRequest('review request T-12'), { kind: 'review', item: 'T-12' });
  assert.deepEqual(verifierRequest('review request T-12 — branch t/T-12, head d4e5f6'), { kind: 'review', item: 'T-12' });
  assert.deepEqual(verifierRequest('qa request E-9: qa/briefs/E-9.md'), { kind: 'qa', item: 'E-9' });
  assert.deepEqual(verifierRequest('qa request E-9 stage first\nBrief'), { kind: 'qa', item: 'E-9' });
  assert.deepEqual(verifierRequest('review request 12\r\nBuild'), { kind: 'review', item: '12' });
  for (const text of ['review request T-12abc', 'review request T-0', 'review request', 'note: review request T-12', ' review request T-12', 'review requests T-12']) {
    assert.equal(verifierRequest(text), null, JSON.stringify(text));
  }
});

test('default session rows keep current work after cached process facts become stale', async t => {
  const { root, tracker, core, clock, peer, ack, send, coord } = await resolver(t);
  const reviewer = peer('rev', 'reviewer');
  ack('rev');
  const item = await tracker.create(coord, { title: 'Current session work', size: 'S' });
  const process: HarnessProcessView = {
    name: 'rev', sessionId: 'rev-id', role: 'reviewer', harness: 'codex', model: null,
    cwd: root, item: null, pid: null, harnessId: null, harnessSessionId: null,
    startedAt: clock.now().toISOString(), status: 'running', state: 'idle', attach: null, holds: [],
  };
  core.seedProcess(process);
  assert.equal(send('coord', 'reviewer', `review request ${item.id}`).outcomes[0]?.outcome, 'delivered');
  ack('rev');
  const row = () => core.sessionRows().find(row => row.name === 'rev')!;
  assert.deepEqual(row().pending, { item: item.id, kind: 'review' });
  await tracker.hold(reviewer, item.id);
  core.refreshPresence();
  const holds = tracker.sessionHolds(reviewer.id);
  assert.equal(holds.length, 1);
  assert.deepEqual(row().holds, holds, 'new holds replace cached empty work');
  core.seedProcess({ ...process, pending: { item: item.id, kind: 'review' }, holds });
  await tracker.hold(reviewer, item.id, true);
  core.clearPendingVerification('rev', item.id);
  core.refreshPresence();
  assert.equal(row().pending, undefined, 'cleared pending work is not restored from the cache');
  assert.deepEqual(row().holds, [], 'released holds are not restored from the cache');
});

test('three live Reviewers resolve one request with affinity, fallback and queued assignment', async t => {
  const { tracker, core, received, connections, peer, actor, ack, send, coord } = await resolver(t);
  const impl = peer('impl', 'implementer');
  for (const name of ['rev-1', 'rev-2', 'rev-3']) peer(name, 'reviewer');
  const item = await tracker.create(coord, { title: 'Single verifier', size: 'M', assignee: 'impl' });
  await tracker.claim(impl, item.id);
  const topic = await core.createTopic('Single verifier', item.id, 'impl');
  const request = (text: string) => send('impl', 'reviewer', text, topic.id);
  const first = `review request ${item.id}\nFirst build`;
  const sent = request(first);
  assert.equal(sent.outcomes[0]?.outcome, 'delivered');
  assert.equal(sent.outcomes[0]?.resolvedTo, 'rev-1');
  assert.deepEqual(sent.message.to, ['rev-1']);
  assert.deepEqual(core.topicHistory(topic.id).messages.find(m => m.text === first)?.to, ['rev-1']);
  ack('rev-1');
  assert.equal(request(`review request ${item.id}\nRepeat before hold`).outcomes[0]?.resolvedTo, 'rev-1');
  await tracker.hold(actor('rev-1', 'reviewer'), item.id);
  await tracker.comment(actor('rev-1', 'reviewer'), item.id, '', { verdict: 'review', scope: 'full', result: 'not clear', run: 'first-build' });
  const fixed = request(`review request ${item.id}\nFixed build`);
  assert.equal(fixed.outcomes[0]?.resolvedTo, 'rev-1');
  assert.deepEqual(fixed.message.to, ['rev-1']);
  assert.deepEqual(request('Reviewer pool update').message.to, ['rev-1', 'rev-2', 'rev-3']);
  for (const name of ['rev-1', 'rev-2', 'rev-3']) ack(name);
  const other = await tracker.create(coord, { title: 'Other review', size: 'M' });
  await tracker.hold(actor('rev-2', 'reviewer'), other.id);
  core.disconnect(connections.get('rev-1')!);
  const fallback = request(`review request ${item.id}\nPrevious reviewer stopped`);
  assert.equal(fallback.outcomes[0]?.resolvedTo, 'rev-3');
  assert.deepEqual(fallback.message.to, ['rev-3']);
  ack('rev-3');
  await tracker.hold(actor('rev-3', 'reviewer'), item.id);
  const waiting = await tracker.create(coord, { title: 'Waiting review', size: 'M' });
  const text = `review request ${waiting.id}\nAll holders occupied`;
  const unavailable = send('coord', 'reviewer', text);
  assert.equal(unavailable.outcomes[0]?.outcome, 'queued');
  assert.match(unavailable.outcomes[0]!.reason!, /next free live verifier/);
  await tracker.hold(actor('rev-2', 'reviewer'), other.id, true);
  core.refreshPresence();
  assert.deepEqual(core.topicHistory('agents').messages.find(m => m.text === text)?.to, ['rev-2']);
  assert.equal(received.get('rev-2')!.filter(m => m.text === text).length, 1);
  assert.ok(received.get('coord')!.some(m => m.kind === 'verifier-request' && m.text.includes(`for ${waiting.id} assigned to rev-2`)));
  assert.equal(send('coord', '@reviewer', `review request ${waiting.id}\nA holder freed`).outcomes[0]?.resolvedTo, 'rev-2');
});

test('a first line that continues after the item is one verifier request, never a role broadcast', async t => {
  const { tracker, core, received, peer, actor, ack, send, coord } = await resolver(t);
  const impl = peer('impl', 'implementer');
  for (const name of ['rev-1', 'rev-2', 'rev-3']) peer(name, 'reviewer');
  for (const name of ['qa-1', 'qa-2']) peer(name, 'qa');
  const item = await tracker.create(coord, { title: 'Continued first line', size: 'M', assignee: 'impl' });
  await tracker.claim(impl, item.id);
  const topic = await core.createTopic('Continued first line', item.id, 'impl');
  const review = `review request ${item.id} — session usage totals persist across restarts`;
  const sent = send('impl', 'reviewer', review, topic.id);
  assert.equal(sent.outcomes[0]?.outcome, 'delivered');
  assert.equal(sent.outcomes[0]?.resolvedTo, 'rev-1');
  assert.deepEqual(sent.message.to, ['rev-1']);
  assert.deepEqual(received.get('rev-1')!.map(m => m.text), [review]);
  for (const name of ['rev-2', 'rev-3']) assert.equal(received.get(name)!.filter(m => m.text === review).length, 0, `${name} never receives one verifier request`);
  ack('rev-1');
  assert.deepEqual(core.sessionRows().find(row => row.name === 'rev-1')?.pending, { item: item.id, kind: 'review' });
  assert.deepEqual(core.sessionRows().find(row => row.name === 'rev-2')?.pending, undefined);
  const qa = `qa request ${item.id}: qa/briefs/${item.id}.md, build at the reviewed head`;
  const qaSent = send('impl', 'qa', qa, topic.id);
  assert.equal(qaSent.outcomes[0]?.outcome, 'delivered');
  assert.equal(qaSent.outcomes[0]?.resolvedTo, 'qa-1');
  assert.deepEqual(qaSent.message.to, ['qa-1']);
  ack('qa-1');
  assert.deepEqual(core.sessionRows().find(row => row.name === 'qa-1')?.pending, { item: item.id, kind: 'qa' });
  // Queueing reads the same first line: a busy pool waits for one verifier instead of broadcasting.
  for (const name of ['rev-1', 'rev-2', 'rev-3']) await tracker.hold(actor(name, 'reviewer'), item.id);
  core.refreshPresence();
  const waiting = await tracker.create(coord, { title: 'Queued continued first line', size: 'M' });
  const queued = `review request ${waiting.id} — all holders busy`;
  const result = send('coord', 'reviewer', queued);
  assert.equal(result.outcomes[0]?.outcome, 'queued');
  assert.match(result.outcomes[0]!.reason!, /next free live verifier/);
  assert.deepEqual(core.topicHistory('agents').messages.find(m => m.text === queued)?.to, ['reviewer'], 'the queued request waits for one verifier');
  await tracker.hold(actor('rev-2', 'reviewer'), item.id, true);
  core.refreshPresence();
  assert.deepEqual(core.topicHistory('agents').messages.find(m => m.text === queued)?.to, ['rev-2']);
  assert.equal(received.get('rev-2')!.filter(m => m.text === queued).length, 1);
  for (const name of ['rev-1', 'rev-3']) assert.equal(received.get(name)!.filter(m => m.text === queued).length, 0, `${name} stays out of the queued request`);
  ack('rev-2');
  assert.deepEqual(core.sessionRows().find(row => row.name === 'rev-2')?.pending, { item: waiting.id, kind: 'review' });
});

test('QA affinity ignores copied and reordered verdict headers and retains stage request affinity', async t => {
  const { root, tracker, core, peer, ack, send, coord } = await resolver(t);
  const first = peer('qa-1', 'qa');
  const second = peer('qa-2', 'qa');
  const item = await tracker.create(coord, { title: 'QA affinity', size: 'M' });
  await tracker.comment(first, item.id, '', { verdict: 'qa', result: 'not clear', run: 'older-qa' });
  await tracker.comment(second, item.id, '', { verdict: 'qa', result: 'not clear', run: 'previous-qa' });
  const file = join(root, item.path);
  const original = await readFile(file, 'utf8');
  const firstHeader = original.indexOf('### qa-1');
  const secondHeader = original.indexOf('### qa-2');
  assert.ok(firstHeader >= 0 && secondHeader > firstHeader);
  const older = original.slice(firstHeader, secondHeader);
  const latest = original.slice(secondHeader);
  await writeFile(file, original.slice(0, firstHeader) + latest + '\n' + older + '\n'
    + older.replace(/### qa-1 · \S+/, '### qa-1 · 2099-01-01T00:00:00.000Z').replace('run: older-qa', 'run: copied-qa'));
  await tracker.rescanAsync();
  assert.deepEqual(tracker.view(item.id).verdicts.map(v => v.run), ['previous-qa', 'older-qa', 'copied-qa']);
  const text = `qa request ${item.id}\nCommitted brief and fixed build`;
  const result = send('coord', '@qa', text);
  assert.equal(result.outcomes[0]?.resolvedTo, 'qa-2');
  assert.deepEqual(core.topicHistory('agents').messages.find(m => m.text === text)?.to, ['qa-2']);
  ack('qa-2');
  const epic = await tracker.create(coord, { title: 'Stage QA', kind: 'epic' });
  const stage = send('coord', 'qa', `qa request ${epic.id} stage first\nStage brief`);
  assert.equal(stage.outcomes[0]?.resolvedTo, 'qa-1');
  assert.equal(send('coord', 'qa', `qa request ${epic.id} stage first\nRepeat stage brief`).outcomes[0]?.resolvedTo, 'qa-1');
});

test('an uncertain tracker outage notice does not reserve an idle Reviewer', async t => {
  const { tracker, core, received, connections, peer, ack, send, coord } = await resolver(t);
  peer('rev', 'reviewer');
  ack('rev');
  core.setSessionState('rev-id', 'rev', 'busy', 'fixture');
  const notice = core.noticeTo('agents', {
    kind: 'tracker-storage-fatal', to: ['all'],
    text: 'tracker storage stalled: planned check on T-467; abandoning storage and exiting with code 1.',
  })!;
  core.ack(connections.get('rev')!, notice);
  assert.equal(core.markUncertain(notice, 'rev', 'hub connection closed before the admission answer'), true);
  const item = await tracker.create(coord, { title: 'Review after outage', size: 'S' });
  const text = `review request ${item.id}\nRecovered build`;
  assert.equal(send('coord', 'reviewer', text).outcomes[0]?.outcome, 'queued');
  core.setSessionState('rev-id', 'rev', 'idle', 'fixture');
  assert.deepEqual(core.topicHistory('agents').messages.find(m => m.text === text)?.to, ['rev']);
  assert.equal(received.get('rev')!.filter(m => m.text === text).length, 1);
  assert.equal(received.get('rev')!.filter(m => m.id === notice).length, 1, 'the uncertain notice is not replayed');
});
