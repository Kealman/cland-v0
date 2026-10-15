import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, connectUi, connectWsUi, eventually, fakeClaude, fakeCodex, sleep, spawnSpoke, startDaemon, startHub, tempProject, clauseAnswered, withDiscoveredPid } from './harness.ts';
import { fixture as remoteFixture } from './remote-fixture.ts';
import { fixture as suiteFixture } from './suite-fixture.ts';
import { Tracker } from '../src/tracker/tracker.ts';
import { CrewFile } from '../src/crew.ts';
import { fixedRoles } from '../src/roles/config.ts';
import type { Message } from '../src/protocol.ts';

const heartbeat = (frame: Record<string, unknown>) => frame.type === 'message' && (frame.message as Message).detail?.event === 'heartbeat';

test('an idle Coordinator wakes for a heartbeat with a digest, without adding a needs-you', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const { discovery } = await startDaemon(t, root, { ...fake.env, CLAND_HEARTBEAT_MS: '300', CLAND_IDLE_NOTIFY_MS: '60' });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await ui.request({ type: 'session.launch', name: 'coord', role: 'coordinator', harness: 'claude-code' });
  assert.equal(launched.ok, true, launched.error);
  const p = await withDiscoveredPid(ui, (launched.value as { process: { pid: number; sessionId: string } }).process);
  await clauseAnswered(ui, 'coord');
  const before = await ui.request({ type: 'inbox.list' });
  const fired = await eventually('idle session is stale in its heartbeat', () => ui.frames.find(f => heartbeat(f) && (f.message as Message).text.includes('coord idle · age')));
  const message = fired.message as Message;
  assert.match(message.text, /In flight[\s\S]*Stale/);
  await ui.waitFor(f => f.type === 'message' && (f.message as Message).from === 'coord' && (f.message as Message).text.includes('In flight'));
  const after = await ui.request({ type: 'inbox.list' });
  assert.equal((after.value as { needsYou: number }).needsYou, (before.value as { needsYou: number }).needsYou);
  const events = await ui.request({ type: 'events.list', filter: { kinds: ['heartbeat'] } });
  assert.ok(JSON.stringify(events.value).includes('in flight'));
  assert.ok(p.sessionId);
});


test('busy and approval-waiting Coordinators coalesce heartbeats into the next turn without steering', async t => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t, { turnMs: 200 });
  const { discovery } = await startDaemon(t, root, { ...fake.env, CLAND_HEARTBEAT_MS: '100' });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  await ui.request({ type: 'crew.set', key: 'coordinator.heartbeat', value: 'off' });
  const launched = await ui.request({ type: 'session.launch', name: 'coord', role: 'coordinator', harness: 'codex' });
  assert.equal(launched.ok, true, launched.error);
  const p = (launched.value as { process: { pid: number; sessionId: string } }).process;
  await eventually('Coordinator idle', async () => {
    const listing = await ui.request({ type: 'session.list' });
    return (listing.value as { processes: Array<{ state: string }> }).processes[0]?.state === 'idle' || undefined;
  });
  await ui.request({ type: 'topic.send', topic: 'general', to: ['coord'], text: 'needs approval' });
  await eventually('Coordinator busy', async () => {
    const listing = await ui.request({ type: 'session.list' });
    return (listing.value as { processes: Array<{ state: string }> }).processes[0]?.state === 'busy' || undefined;
  });
  await ui.request({ type: 'crew.set', key: 'coordinator.heartbeat', value: '1m' });
  const busyHeartbeat = await ui.waitFor(heartbeat);
  assert.equal((busyHeartbeat.message as Message).detail?.digest, 'turn');
  await ui.waitFor(f => f.type === 'session.state' && f.state === 'waiting for approval');
  await eventually('three approval-waiting heartbeat firings', () => ui.frames.filter(heartbeat).length >= 3 || undefined);
  await ui.request({ type: 'topic.send', topic: 'general', to: ['coord'], text: 'a steered report' });
  await ui.request({ type: 'crew.set', key: 'coordinator.heartbeat', value: 'off' });
  const notes = ui.frames.filter(heartbeat).map(f => f.message as Message);
  assert.ok(notes.every(m => m.detail?.digest === 'turn'));
  const history = await ui.request({ type: 'topic.history', topic: 'agents' });
  const pending = (history.value as { messages: Array<Message & { stage: string }> }).messages.filter(m => m.detail?.event === 'heartbeat' && m.stage === 'queued');
  assert.equal(pending.length, 1);
  assert.equal(pending[0]!.id, notes.at(-1)!.id);
  assert.doesNotMatch(await fake.log(p.pid), /heartbeat · coord/, 'the blocked turn receives no heartbeat input');
  await writeFile(join(fake.home, 'approve'), 'yes');
  await eventually('approval answered', async () => {
    const listing = await ui.request({ type: 'session.list' });
    return (listing.value as { processes: Array<{ state: string }> }).processes[0]?.state === 'idle' || undefined;
  });
  await ui.request({ type: 'topic.send', topic: 'general', to: ['coord'], text: 'the next turn' });
  await eventually('one heartbeat in the next turn', async () => {
    const log = await fake.log(p.pid);
    return log.includes('the next turn') && log.includes('heartbeat · coord') ? log : undefined;
  });
  const log = await fake.log(p.pid);
  assert.equal((log.match(/heartbeat · coord/g) ?? []).length, 1);
  assert.doesNotMatch(log, /steered[^\n]*heartbeat/);
});

test('a missed heartbeat survives hub restart and fires once rather than replaying missed intervals', async t => {
  const root = await tempProject(t);
  const env = { CLAND_HEARTBEAT_MS: '300' };
  let { discovery } = await startDaemon(t, root, env);
  let ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', sessionId: 'stable-coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  await eventually('first firing recorded', async () => {
    const history = await ui.request({ type: 'topic.history', topic: 'agents' });
    return (history.value as { messages: Message[] }).messages.some(m => m.detail?.event === 'heartbeat') || undefined;
  });
  ui.close();
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  await sleep(950); // Negative: three intervals pass while no hub can fire.
  ({ discovery } = await startDaemon(t, root, env));
  ui = await connectUi(t, discovery);
  const history = await eventually('one overdue firing after restart', async () => {
    const result = await ui.request({ type: 'topic.history', topic: 'agents' });
    const notes = (result.value as { messages: Message[] }).messages.filter(m => m.detail?.event === 'heartbeat');
    return notes.length >= 2 ? notes : undefined;
  });
  assert.equal(history.length, 2, 'the missed intervals produce exactly one firing');
  assert.ok(Date.parse(history[1]!.ts) - Date.parse(history[0]!.ts) >= 950);
});

test('the digest ages review and ready items and open asks, caps both sections, and includes claimed sessions', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root, { CLAND_HEARTBEAT_MS: '200' });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', sessionId: 'digest-coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  await ui.request({ type: 'crew.set', key: 'coordinator.heartbeat', value: 'off' });
  const items: string[] = [];
  for (let i = 0; i < 12; i++) {
    const created = await ui.request({ type: 'task.create', size: 'S', title: `Digest item ${i}`, assignee: `impl-${i}` });
    assert.equal(created.ok, true, created.error);
    const id = (created.value as { item: { id: string } }).item.id;
    items.push(id);
    assert.equal((await ui.request({ type: 'role.set', session: `impl-${i}`, role: 'implementer' })).ok, true);
    const claimed = await ui.request({ type: 'task.claim', item: id, as: { name: `impl-${i}` } });
    assert.equal(claimed.ok, true, claimed.error);
    assert.equal((await ui.request({ type: 'task.edit', item: id, status: i === 0 ? 'review' : 'ready' })).ok, true);
  }
  const asked = await coord.call<{ ok: boolean }>('ask', { topic: 'general', question: 'Which repair should wait?', options: ['one', 'two'] });
  assert.equal(asked.ok, true);
  const before = ui.frames.length;
  await ui.request({ type: 'crew.set', key: 'coordinator.heartbeat', value: '1m' });
  const matured = await eventually('all rows age through one interval', () => ui.frames.slice(before).find(f => heartbeat(f) && Number((f.message as Message).detail?.stale) === 13));
  const message = matured.message as Message;
  assert.equal(message.detail?.inFlight, 13);
  assert.match(message.text, new RegExp(`${items[0]} review.*impl-0`));
  assert.match(message.text, new RegExp(`${items[0]} review without a pending request or verdict at its head · age`));
  assert.match(message.text, /ready, not merged · age/);
  assert.equal((message.text.match(/and 3 more/g) ?? []).length, 2);
  assert.equal(message.text.split('Stale (13)')[1]!.split('\n').filter(line => line.startsWith('- ')).length, 11);
  await ui.request({ type: 'task.edit', item: items[0], status: 'planned' });
  await ui.request({ type: 'task.edit', item: items[0], status: 'review' });
  const reset = ui.frames.length;
  await eventually('new review state gets a fresh full interval', () => ui.frames.slice(reset).find(f => heartbeat(f) && Number((f.message as Message).detail?.stale) === 12));
});


test('the digest includes running and queued runs and ages timeouts and ended runs without results', async t => {
  const f = await suiteFixture(t, 'node -e "const fs=require(\'fs\');const p=setInterval(()=>{if(fs.existsSync(\'finish\'))clearInterval(p)},20)"', undefined, '', { CLAND_HEARTBEAT_MS: '100', CLAND_TEST_EXECUTOR_RUN_TIMEOUT_MS: '100' });
  const coord = await spawnSpoke({ cwd: f.root, discover: true, name: 'coord', sessionId: 'run-digest-coord', role: 'coordinator' });
  t.after(() => coord.close());
  const first = await f.launch('auto');
  const digest = async (pattern: RegExp) => eventually('run facts in heartbeat', async () => {
    const history = await f.ui.request({ type: 'topic.history', topic: 'agents' });
    return (history.value as { messages: Message[] }).messages.find(m => m.detail?.event === 'heartbeat' && pattern.test(m.text));
  }, 2500);
  const running = await digest(new RegExp(`run ${first.id} past its timeout · age`));
  assert.match(running.text, new RegExp(`run ${first.id} running · impl`));
  const secondResult = await f.ui.request({ type: 'suite.start', mode: 'auto', cwd: f.root, report: f.topic, to: ['impl'] });
  assert.equal(secondResult.ok, true, secondResult.error);
  const second = secondResult.value as { id: string };
  const queued = await digest(new RegExp(`run ${second.id} queued · human`));
  assert.ok(queued);
  assert.equal((await f.ui.request({ type: 'role.clear', session: 'impl' })).ok, true);
  await writeFile(join(f.root, 'finish'), 'done');
  await digest(new RegExp(`run ${first.id} ended without a posted result · age`));
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'implementer' })).ok, true);
  // The second queued worker can start while the first result is withheld.
  // Settle both runs before the embedded hub's strict resource check.
  await eventually('both digest runs post their results', async () => (await f.results()).length === 2 || undefined);
});


test('open asks show their age while a queued review request suppresses the missing-review row', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root, { CLAND_HEARTBEAT_MS: '150' });
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', sessionId: 'ask-digest-coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const created = await coord.call<{ item: { id: string } }>('task.create', { size: 'S', title: 'Pending review' });
  const id = created.item.id;
  await ui.request({ type: 'task.edit', item: id, status: 'review' });
  await coord.call('send', { to: ['reviewer'], text: `review request ${id}\nBranch and source to review` });
  await coord.call('ask', { topic: 'general', question: 'A decision is still needed', options: ['yes', 'no'] });
  const aged = await eventually('open ask age in heartbeat', async () => {
    const history = await ui.request({ type: 'topic.history', topic: 'agents' });
    return (history.value as { messages: Message[] }).messages.find(m => m.detail?.event === 'heartbeat' && /ask .* unanswered · age/.test(m.text));
  });
  assert.match(aged.text, /A decision is still needed/);
  assert.doesNotMatch(aged.text, new RegExp(`${id} review without`));
});

test('live remote leases appear in the heartbeat beside their verification run', async t => {
  const f = await remoteFixture(t, { env: { CLAND_HEARTBEAT_MS: '100' } });
  const coord = await spawnSpoke({ cwd: f.root, discover: true, name: 'coord', sessionId: 'lease-digest-coord', role: 'coordinator' });
  t.after(() => coord.close());
  const job = await f.launch();
  const digest = await eventually('live lease in heartbeat', async () => {
    const history = await f.ui.request({ type: 'topic.history', topic: 'agents' });
    return (history.value as { messages: Message[] }).messages.find(m => m.detail?.event === 'heartbeat' && /lease cland-.* · (creating|active) · expires/.test(m.text));
  });
  assert.match(digest.text, new RegExp(`run ${job.id}`));
  await f.result(job.id);
});

test('roles have independent heartbeat schedules, renaming retains identity, and revocation stops firing', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root, { CLAND_HEARTBEAT_MS: '150' });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'crew.set', key: 'qa.heartbeat', value: '1m' });
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', sessionId: 'rename-stable', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const history = async () => ((await ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Message[] }).messages.filter(m => m.detail?.event === 'heartbeat');
  await eventually('Coordinator schedule started', async () => (await history()).length || undefined);
  assert.equal((await coord.call<{ ok: boolean }>('rename', { name: 'coord-renamed' })).ok, true);
  const qa = await spawnSpoke({ cwd: root, discover: true, name: 'quality', sessionId: 'qa-stable', role: 'qa' });
  t.after(() => qa.close());
  await qa.waitForPresence(['coord-renamed', 'quality']);
  const both = await eventually('both roles have their own firings', async () => {
    const notes = await history();
    return notes.some(m => m.text.startsWith('heartbeat · coord-renamed')) && notes.some(m => m.text.startsWith('heartbeat · quality')) ? notes : undefined;
  });
  assert.ok(both.some(m => m.text.startsWith('heartbeat · coord ·')));
  const who = await coord.call<{ sessions: Array<{ name: string; sessionId: string }> }>('who');
  assert.equal(who.sessions.find(s => s.name === 'coord-renamed')?.sessionId, 'rename-stable');
  await ui.request({ type: 'role.clear', session: 'coord-renamed' });
  const afterClear = (await history()).filter(m => m.text.startsWith('heartbeat · coord-renamed')).length;
  const qaCount = (await history()).filter(m => m.text.startsWith('heartbeat · quality')).length;
  await eventually('two QA intervals after revocation', async () => (await history()).filter(m => m.text.startsWith('heartbeat · quality')).length >= qaCount + 2 || undefined);
  assert.equal((await history()).filter(m => m.text.startsWith('heartbeat · coord-renamed')).length, afterClear);
});


test('watched review and ready transitions wait a full interval even when a hand edit retains an old updated date', async t => {
  const root = await tempProject(t);
  let clock: number | undefined;
  const now = () => new Date(clock ?? Date.now());
  const tracker = new Tracker({ root, db: join(root, '.cland/hub.db'), now });
  tracker.start();
  t.after(() => tracker.stop());
  const crew = new CrewFile(join(root, '.cland/crew.toml'), () => {}, () => {}, tracker);
  await crew.start();
  t.after(() => crew.stop());
  const hub = await startHub({ tracker, crew, roles: fixedRoles(), heartbeatMs: 200, now });
  t.after(() => hub.close());
  const ui = await connectWsUi(t, hub);
  await ui.request({ type: 'subscribe' });
  await ui.request({ type: 'role.set', session: 'coord', role: 'coordinator' });
  const coord = await spawnSpoke({ hub, name: 'coord', sessionId: 'retained-updated-coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  await ui.waitFor(heartbeat);
  clock = Date.now(); // Freeze age while real watcher I/O observes both transitions.
  await ui.request({ type: 'crew.set', key: 'coordinator.heartbeat', value: 'off' });
  const items: Array<{ id: string; file: string; status: string }> = [];
  for (const status of ['review', 'ready']) {
    const created = await ui.request({ type: 'task.create', size: 'S', title: `Watched ${status}` });
    assert.equal(created.ok, true, created.error);
    items.push({ ...(created.value as { item: { id: string; file: string } }).item, status });
  }
  clock += 250; // The paused schedule is overdue before either watched transition.
  for (const item of items) {
    const path = join(root, '.cland/tasks', item.file);
    const source = await readFile(path, 'utf8');
    await writeFile(path, source.replace(/^status: backlog$/m, `status: ${item.status}`).replace(/^updated:.*$/m, 'updated: \"2020-01-01T00:00:00.000Z\"'));
    const edited = await ui.waitFor(frame => frame.type === 'task' && (frame.item as { id?: string; status?: string } | null)?.id === item.id && (frame.item as { status?: string }).status === item.status);
    assert.equal((edited.item as { updated: string }).updated, '2020-01-01T00:00:00.000Z');
  }
  const cursor = ui.frames.length;
  await ui.request({ type: 'crew.set', key: 'coordinator.heartbeat', value: '1m' });
  const first = await eventually('overdue firing after the watched transitions', () => ui.frames.slice(cursor).find(heartbeat));
  assert.equal((first.message as Message).detail?.stale, 0, 'an old updated date does not age a newly observed state');
  clock += 200;
  await eventually('both watched states age through a full interval', () => ui.frames.slice(cursor).find(f => heartbeat(f) && (f.message as Message).detail?.stale === 2));
});
