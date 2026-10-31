// T2 component: FakeClock drives hub rules; only the project fixtures retain real socket edges.
import { sessionClient, sessionUi as connectUi, sessionDispatcherUi as dispatcherUi } from './session-credential-fixture.ts';
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { frameClient, projectHub, tempProject, type FrameClient } from './harness.ts';
import { createHubBase, type HubBase } from '../src/hub/server.ts';
import { Store } from '../src/hub/store.ts';
import { beforeDirectories, onCleanup } from './process-cleanup.ts';
import { Tracker } from '../src/tracker/tracker.ts';
import { CrewFile } from '../src/crew.ts';
import { fixedRoles } from '../src/roles/config.ts';
import { FakeClock } from './fake-clock.ts';
import type { Dispatcher } from '../src/hub/dispatch.ts';
import type { SuiteJob } from '../src/hub/suites.ts';
import type { DropletLease } from '../src/executor/droplet/lease.ts';
import type { Message } from '../src/protocol.ts';
import { caseDeadlines } from './case-deadlines.ts';
import type { CoreOptions } from '../src/hub/core.ts';
import { readDurationAllowanceWarnings } from '../src/suite-durations.ts';

const heartbeat = (frame: Record<string, unknown>) => frame.type === 'message' && (frame.message as Message).detail?.event === 'heartbeat';
const notes = async (ui: FrameClient) => ((await ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Array<Message & { stage: string }> }).messages.filter(m => m.detail?.event === 'heartbeat');

async function nextHeartbeat(clock: FakeClock, ui: FrameClient, ms: number, matches: (message: Message) => boolean = () => true): Promise<Message> {
  const cursor = ui.frames.length;
  const receipt = ui.waitFor(frame => ui.frames.indexOf(frame) >= cursor && heartbeat(frame) && matches(frame.message as Message));
  // One due firing at the requested fake time; completion is the message receipt,
  // not the fake clock's I/O yield or the number of timer callbacks.
  clock.block(ms);
  await clock.advance(0);
  return (await receipt).message as Message;
}

test('Coordinator heartbeat delivers every allowance entering the 48-hour UTC expiry window', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock(Date.parse('2026-10-17T00:00:00Z') - 600);
  await mkdir(join(root, 'hub/test'), { recursive: true });
  const allow = Object.fromEntries(Array.from({ length: 12 }, (_, n) => [`hub/test/expiry.test.ts::case ${n}`, {
    seconds: 6, reason: 'Expiry fixture.', owner: `E-${n + 1}`, added: '2026-10-16', expires: '2026-10-19',
  }]));
  const manifest = { version: 1, source: { artifacts: [], commit: 'fixture' }, budget: { testSeconds: 5, fileSeconds: 60 }, files: {}, tests: {}, allow };
  await writeFile(join(root, 'hub/test/durations.json'), JSON.stringify(manifest));
  const { discovery, dispatcher, fakes } = await projectHub(t, root, { CLAND_HEARTBEAT_MS: '200' }, { clock, harnesses: 'fake' });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await ui.request({ type: 'session.launch', name: 'coord', role: 'coordinator', harness: 'claude-code' });
  assert.equal(launched.ok, true, launched.error);
  const p = (launched.value as { process: { sessionId: string } }).process;
  await protocolPeer(t, dispatcher, root, 'coord', p.sessionId, fakes['claude-code']!.spawns[0]!.launchToken);
  fakes['claude-code']!.idle('coord');
  const early = ui.waitFor(heartbeat);
  await clock.advance(400);
  assert.doesNotMatch(((await early).message as Message).text, /expiry.test.ts/);
  const warning = ui.waitFor(f => heartbeat(f) && (f.message as Message).text.includes('expiry.test.ts'));
  await clock.advance(200);
  const message = (await warning).message as Message;
  for (let n = 0; n < 12; n++) assert.ok(message.text.includes(`hub/test/expiry.test.ts::case ${n} · owner E-${n + 1} · expires 2026-10-19`), message.text);
  await ui.waitFor(f => f.type === 'delivery' && f.message === message.id && f.stage === 'injected');
  assert.ok(fakes['claude-code']!.injections.some(i => i.message.id === message.id));
});

// A protocol peer is enough for heartbeat routing; the MCP/spoke contract is tested elsewhere.
async function session(t: TestContext, hub: HubBase, root: string, ui: FrameClient, name: string, role: string, sessionId: string) {
  assert.equal((await ui.request({ type: 'role.set', session: name, role })).ok, true);
  return protocolPeer(t, hub.dispatcher, root, name, sessionId);
}

async function protocolPeer(t: TestContext, dispatcher: Pick<Dispatcher, 'open'>, root: string, name: string, sessionId: string, launchToken?: string) {
  let receive = (_line: string) => {};
  let open = true;
  const conversation = dispatcher.open({
    send: frame => {
      receive(`${JSON.stringify(frame)}\n`);
      if (frame.type === 'role' || frame.type === 'deliver') queueMicrotask(() => peer.send({ type: 'ack', id: frame.id }));
    },
    close: () => { open = false; }, isOpen: () => open,
  }, { authenticated: true, edge: 'socket' });
  const peer = frameClient(line => conversation.receive(line.trimEnd()), fn => { receive = fn; }, () => { if (open) { open = false; conversation.closed(); } }, root);
  onCleanup(t, () => peer.close());
  peer.send({ type: 'hello', protocol: 2, name, sessionId, cwd: root, ...(launchToken ? { launchToken } : {}) });
  await peer.waitFor(frame => frame.type === 'welcome');
  await peer.waitFor(frame => frame.type === 'role');
  return peer;
}

async function fixture(t: TestContext, heartbeatMs: number, options: { runTimeoutMs?: number; durationWarnings?: CoreOptions['durationWarnings']; sentinel?: boolean; clock?: FakeClock } = {}) {
  const root = await tempProject(t);
  const clock = options.clock ?? new FakeClock();
  const tracker = new Tracker({ git: async () => null, readBase: async () => null, root, db: join(root, 'tracker.db'), now: () => clock.now() });
  tracker.start();
  const crew = new CrewFile(join(root, '.cland/crew.toml'), () => {}, () => {}, tracker);
  await crew.start();
  const hub = createHubBase({ hasTerritory: async () => false, secret: 'heartbeat', clock, store: new Store(), tracker, crew, roles: fixedRoles(), heartbeatMs, ...(options.durationWarnings ? { durationWarnings: options.durationWarnings } : {}), ...(options.runTimeoutMs !== undefined ? { heartbeatRunTimeoutMs: options.runTimeoutMs } : {}) });
  beforeDirectories(t, async () => {
    try { await hub.close(); }
    finally { try { await crew.stop(); } finally { await tracker.stop(); } }
  });
  const { dispatcherUi: rawDispatcherUi } = await import('./harness.ts');
  const ui = sessionClient(await rawDispatcherUi(t, hub.dispatcher, root), hub.core.store);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const coord = await session(t, hub, root, ui, 'coord', 'coordinator', 'stable-coord');
  if (options.sentinel) {
    assert.equal((await ui.request({ type: 'crew.set', key: 'qa.heartbeat', value: '1m' })).ok, true);
    await session(t, hub, root, ui, 'quality', 'qa', 'stable-quality');
  }
  // The first scheduler tick observes a connected session and establishes its schedule.
  await clock.advance(heartbeatMs / 4);
  return { root, clock, tracker, crew, hub, ui, coord };
}

test('a held manifest read uses the heartbeat firing clock at the 48-hour boundary', async t => {
  const run = caseDeadlines(t);
  const clock = new FakeClock(Date.parse('2026-10-17T00:00:00Z') - 500);
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let root = '';
  const f = await fixture(t, 100, { clock, sentinel: true, durationWarnings: async now => {
    entered.resolve();
    await release.promise;
    return readDurationAllowanceWarnings(root, now);
  } });
  root = f.root;
  await mkdir(join(root, 'hub/test'), { recursive: true });
  await writeFile(join(root, 'hub/test/durations.json'), JSON.stringify({ version: 1,
    source: { artifacts: [], commit: 'fixture' }, budget: { testSeconds: 5, fileSeconds: 60 }, files: {}, tests: {}, allow: {
      'hub/test/expiry.test.ts::held': { seconds: 6, reason: 'Held fixture.', owner: 'E-1', added: '2026-10-16', expires: '2026-10-19' },
    } }));
  await clock.advance(100);
  await run.wait('manifest read entered before warning window', () => entered.promise);
  clock.block(375); // Cross into the window while the manifest read is held.
  const completed = f.ui.waitFor(frame => heartbeat(frame) && (frame.message as Message).to.includes('quality'));
  release.resolve();
  await completed;
  const message = (await notes(f.ui)).find(m => m.to.includes('coord'))!;
  assert.equal(message.ts, '2026-10-17T00:00:00.000Z');
  assert.match(message.text, /duration allowance expiring within 48h: hub\/test\/expiry.test.ts::held · owner E-1/);
});

for (const change of ['rename', 'role', 'stop', 'prune', 'disable'] as const) test(`held heartbeat warning read rechecks ${change} before publishing`, async t => {
  const run = caseDeadlines(t);
  const entered = Promise.withResolvers<void>();
  const warnings = Promise.withResolvers<string[]>();
  const f = await fixture(t, 100, { sentinel: true, durationWarnings: () => { entered.resolve(); return warnings.promise; } });
  const process = { name: 'coord', sessionId: 'stable-coord', role: 'coordinator', harness: 'fake', model: null, cwd: f.root,
    item: null, pid: null, harnessId: null, harnessSessionId: null, startedAt: f.clock.now().toISOString(), status: 'running' as const,
    state: 'idle' as const, attach: null };
  f.hub.core.publishProcess(process);
  // Both role schedules were established before the read is held. The QA
  // heartbeat is a public receipt that this tick has passed the Coordinator.
  await f.clock.advance(100);
  await run.wait('duration warning read entered', () => entered.promise);
  if (change === 'rename') assert.equal((await f.coord.request({ type: 'rename', name: 'coord-new' })).ok, true);
  if (change === 'role') assert.equal((await f.ui.request({ type: 'role.clear', session: 'coord' })).ok, true);
  if (change === 'stop') f.hub.core.publishProcess({ ...process, status: 'stopped' });
  if (change === 'prune') f.hub.core.pruneProcess(process);
  if (change === 'disable') assert.equal((await f.ui.request({ type: 'crew.set', key: 'coordinator.heartbeat', value: 'off' })).ok, true);
  const completed = f.ui.waitFor(frame => heartbeat(frame) && (frame.message as Message).to.includes('quality'));
  warnings.resolve(['held warning']);
  await completed;
  const messages = await notes(f.ui);
  assert.equal(messages.filter(m => m.to.includes('coord')).length, 0, 'no stale heartbeat is recorded or delivered');
  if (change === 'rename') {
    const renamed = messages.filter(m => m.to.includes('coord-new'));
    assert.equal(renamed.length, 1);
    assert.match(renamed[0]!.text, /^heartbeat · coord-new ·/);
    assert.match(renamed[0]!.text, /held warning/);
  }
  if (change === 'role' || change === 'stop') {
    if (change === 'role') assert.equal((await f.ui.request({ type: 'role.set', session: 'coord', role: 'coordinator' })).ok, true);
    else f.hub.core.publishProcess(process);
    const overdue = f.ui.waitFor(frame => heartbeat(frame) && (frame.message as Message).to.includes('coord'));
    await f.clock.advance(25);
    await overdue;
    assert.equal((await notes(f.ui)).filter(m => m.to.includes('coord')).length, 1, 'discarded publication did not advance the due schedule');
  }
});

// Digest tests consume the scheduler's durable facts, not executor process lifecycles.
function job(clock: FakeClock, root: string, id: string, fields: Partial<SuiteJob> = {}): SuiteJob {
  return { id, mode: 'auto', executor: 'local', cwd: root, topic: 'agents', to: ['impl'],
    actor: { name: 'impl', sessionId: 'impl-id', shell: true }, head: 'head', branch: 'task', log: '', result: '', gate: '',
    pid: null, started: clock.now().toISOString(), outcome: null, artifact: null, reported: false, error: null, state: 'running', ...fields };
}

test('an idle Coordinator wakes for a heartbeat with a digest, without adding a needs-you', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const { discovery, dispatcher, fakes } = await projectHub(t, root, { CLAND_HEARTBEAT_MS: '300', CLAND_IDLE_NOTIFY_MS: '60' }, { clock, harnesses: 'fake' });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await ui.request({ type: 'session.launch', name: 'coord', role: 'coordinator', harness: 'claude-code' });
  assert.equal(launched.ok, true, launched.error);
  const p = (launched.value as { process: { sessionId: string } }).process;
  await protocolPeer(t, dispatcher, root, 'coord', p.sessionId, fakes['claude-code']!.spawns[0]!.launchToken);
  fakes['claude-code']!.idle('coord');
  const before = await ui.request({ type: 'inbox.list' });
  await clock.advance(300);
  const fired = await ui.waitFor(f => heartbeat(f) && (f.message as Message).text.includes('coord idle · age'));
  const message = fired.message as Message;
  assert.match(message.text, /In flight[\s\S]*Stale/);
  // The native adapter receipt proves the digest reached the Coordinator's input.
  await ui.waitFor(f => f.type === 'delivery' && f.message === message.id && f.stage === 'injected');
  assert.ok(fakes['claude-code']!.injections.some(i => i.message.id === message.id && i.message.text.includes('In flight')));
  const after = await ui.request({ type: 'inbox.list' });
  assert.equal((after.value as { needsYou: number }).needsYou, (before.value as { needsYou: number }).needsYou);
  const events = await ui.request({ type: 'events.list', filter: { kinds: ['heartbeat'] } });
  assert.ok(JSON.stringify(events.value).includes('in flight'));
  assert.ok(p.sessionId);
});

test('busy and approval-waiting Coordinators coalesce heartbeats into the next turn without steering', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const { discovery, dispatcher, fakes } = await projectHub(t, root, { CLAND_HEARTBEAT_MS: '100' }, { clock, harnesses: 'fake' });
  const fake = fakes.codex!;
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  await ui.request({ type: 'crew.set', key: 'coordinator.heartbeat', value: 'off' });
  const launched = await ui.request({ type: 'session.launch', name: 'coord', role: 'coordinator', harness: 'codex' });
  assert.equal(launched.ok, true, launched.error);
  const p = (launched.value as { process: { sessionId: string } }).process;
  await protocolPeer(t, dispatcher, root, 'coord', p.sessionId, fake.spawns[0]!.launchToken);
  fake.idle('coord');
  await ui.request({ type: 'topic.send', topic: 'general', to: ['coord'], text: 'needs approval' });
  fake.busy('coord');
  await ui.request({ type: 'crew.set', key: 'coordinator.heartbeat', value: '1m' });
  await clock.advance(100);
  const busyHeartbeat = await ui.waitFor(heartbeat);
  assert.equal((busyHeartbeat.message as Message).detail?.digest, 'turn');
  fake.waitingForApproval('coord');
  await ui.waitFor(f => f.type === 'session.state' && f.state === 'waiting for approval');
  for (let n = 0; n < 3; n++) await nextHeartbeat(clock, ui, 100);
  assert.ok(ui.frames.filter(heartbeat).length >= 3);
  await ui.request({ type: 'topic.send', topic: 'general', to: ['coord'], text: 'a steered report' });
  await ui.request({ type: 'crew.set', key: 'coordinator.heartbeat', value: 'off' });
  const heartbeats = ui.frames.filter(heartbeat).map(f => f.message as Message);
  assert.ok(heartbeats.every(m => m.detail?.digest === 'turn'));
  const pending = (await notes(ui)).filter(m => m.stage === 'queued');
  assert.equal(pending.length, 1);
  assert.equal(pending[0]!.id, heartbeats.at(-1)!.id);
  const injectedHeartbeats = () => fake.injections.flatMap(i => [i.message, ...(i.message.digest ?? [])]).filter(m => m.text.includes('heartbeat · coord'));
  assert.equal(injectedHeartbeats().length, 0, 'the blocked turn receives no heartbeat input');
  fake.idle('coord');
  await ui.request({ type: 'topic.send', topic: 'general', to: ['coord'], text: 'the next turn' });
  const next = fake.injections.find(i => i.message.text.includes('the next turn'))!;
  await ui.waitFor(f => f.type === 'delivery' && f.message === next.message.id && f.stage === 'injected');
  assert.equal(injectedHeartbeats().length, 1);
  assert.ok(next.message.digest?.some(m => m.id === pending[0]!.id));
  assert.ok(fake.injections.filter(i => i.message.text.includes('a steered report')).every(i => !i.message.digest?.some(m => m.text.includes('heartbeat · coord'))));
});

test('a missed heartbeat survives hub restart and fires once rather than replaying missed intervals', async t => {
  const root = await tempProject(t);
  const db = join(root, 'heartbeat.db');
  const clock = new FakeClock();
  let hub = createHubBase({ hasTerritory: async () => false, secret: 'heartbeat', store: new Store(db), roles: fixedRoles(), heartbeatMs: 300, clock });
  beforeDirectories(t, () => hub.close());
  let ui = await dispatcherUi(t, hub.dispatcher, root);
  await ui.request({ type: 'subscribe' });
  const coord = await session(t, hub, root, ui, 'coord', 'coordinator', 'stable-coord');
  await clock.advance(75); // Establish the connected session's schedule.
  assert.equal((await notes(ui)).length, 0);
  await clock.advance(300);
  await ui.waitFor(heartbeat);
  assert.equal((await notes(ui)).length, 1);
  coord.close(); ui.close();
  await hub.close();
  await clock.advance(975); // More than three intervals pass with no hub to fire them.
  hub = createHubBase({ hasTerritory: async () => false, secret: 'heartbeat', store: new Store(db), roles: fixedRoles(), heartbeatMs: 300, clock });
  ui = await dispatcherUi(t, hub.dispatcher, root);
  await ui.request({ type: 'subscribe' });
  await clock.advance(75);
  await ui.waitFor(heartbeat);
  assert.equal((await notes(ui)).length, 2, 'the missed intervals produce exactly one firing');
  // Repeated scheduler ticks before the next full interval cannot replay the backlog.
  await clock.advance(299);
  assert.equal((await notes(ui)).length, 2, 'no replay before the next full interval');
  await clock.advance(1);
  assert.equal((await notes(ui)).length, 3, 'the next interval produces one ordinary firing');
});

test('the digest ages review and ready items and open asks, caps both sections, and includes claimed sessions', async t => {
  const { clock, ui, coord } = await fixture(t, 200);
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
  const asked = await coord.request({ type: 'ask', topic: 'general', question: 'Which repair should wait?', options: ['one', 'two'] });
  assert.equal(asked.ok, true);
  const before = ui.frames.length;
  await ui.request({ type: 'crew.set', key: 'coordinator.heartbeat', value: '1m' });
  await clock.advance(400);
  const matured = await ui.waitFor(f => ui.frames.indexOf(f) >= before && heartbeat(f) && Number((f.message as Message).detail?.stale) === 13);
  const message = matured.message as Message;
  assert.equal(message.detail?.inFlight, 13);
  assert.match(message.text, new RegExp(`${items[0]} review.*impl-0`));
  assert.match(message.text, new RegExp(`${items[0]} review without a pending request or verdict at its head · age`));
  assert.match(message.text, /ready, not merged · age/);
  assert.equal((message.text.match(/and 3 more/g) ?? []).length, 2);
  assert.equal(message.text.split('Stale (13)')[1]!.split('\n').filter(line => line.startsWith('- ')).length, 11);
});

test('the digest includes running and queued runs and ages timeouts and ended runs without results', async t => {
  const { clock, root, hub, ui } = await fixture(t, 100, { runTimeoutMs: 100 });
  const first = job(clock, root, 'running');
  hub.core.store.setMeta('suite-jobs', JSON.stringify([first]));
  await nextHeartbeat(clock, ui, 200, m => /run running running · impl[\s\S]*run running past its timeout · age/.test(m.text));
  const running = (await notes(ui)).find(m => /run running running · impl[\s\S]*run running past its timeout · age/.test(m.text));
  assert.ok(running, 'timeout and running facts occur together');
  assert.match(running.text, /run running running · impl/);
  const second = job(clock, root, 'queued', { state: 'queued', actor: null, started: null });
  hub.core.store.setMeta('suite-jobs', JSON.stringify([first, second]));
  await nextHeartbeat(clock, ui, 100, m => /run queued queued · human/.test(m.text));
  assert.ok((await notes(ui)).some(m => /run queued queued · human/.test(m.text)));
  // Completion and withheld publication are independent durable facts. No worker is needed.
  first.outcome = { code: 0, cause: 'exit' };
  first.finished = clock.now().toISOString();
  hub.core.store.setMeta('suite-jobs', JSON.stringify([first, second]));
  await nextHeartbeat(clock, ui, 100, m => /run running ended without a posted result · age/.test(m.text));
  assert.ok((await notes(ui)).some(m => /run running ended without a posted result · age/.test(m.text)));
});

test('open asks show their age while a queued review request suppresses the missing-review row', async t => {
  const { clock, ui, coord } = await fixture(t, 150);
  const created = await coord.request({ type: 'task.create', size: 'S', title: 'Pending review' });
  assert.equal(created.ok, true, created.error);
  const id = (created.value as { item: { id: string } }).item.id;
  await ui.request({ type: 'task.edit', item: id, status: 'review' });
  await coord.request({ type: 'send', to: ['reviewer'], text: `review request ${id} — branch and source to review` });
  await coord.request({ type: 'ask', topic: 'general', question: 'A decision is still needed', options: ['yes', 'no'] });
  await nextHeartbeat(clock, ui, 300, m => /ask .* unanswered · age/.test(m.text));
  const aged = (await notes(ui)).find(m => /ask .* unanswered · age/.test(m.text))!;
  assert.match(aged.text, /A decision is still needed/);
  assert.doesNotMatch(aged.text, new RegExp(`${id} review without`));
});

test('bare and prefixed continued requests suppress the missing-review row while an unrelated review stays stale', async t => {
  const { clock, ui, coord } = await fixture(t, 150);
  const create = async (title: string) => {
    const created = await coord.request({ type: 'task.create', size: 'S', title });
    assert.equal(created.ok, true, created.error);
    return (created.value as { item: { id: string } }).item.id;
  };
  const canonical = await create('Canonical continued request');
  const bare = await create('Bare number continued request');
  const aliased = await create('Alternate prefix continued request');
  const unrelated = await create('Review without a request');
  for (const id of [canonical, bare, aliased, unrelated]) assert.equal((await ui.request({ type: 'task.edit', item: id, status: 'review' })).ok, true);
  const number = (id: string) => id.replace(/^[A-Za-z]-/, '');
  const queued = async (text: string) => {
    const sent = await coord.request({ type: 'send', to: ['reviewer'], text });
    assert.equal(sent.ok, true, sent.error);
    assert.equal((sent.value as { outcomes: Array<{ outcome: string }> }).outcomes[0]?.outcome, 'queued', text);
  };
  await queued(`review request ${canonical} — canonical detail`);
  await queued(`review request ${number(bare)} — bare number detail`);
  await queued(`review request C-${number(aliased)} — alternate prefix detail`);
  const stale = () => new RegExp(`${unrelated} review without`);
  await nextHeartbeat(clock, ui, 300, m => stale().test(m.text));
  const digest = (await notes(ui)).find(m => stale().test(m.text))!;
  for (const id of [canonical, bare, aliased]) assert.doesNotMatch(digest.text, new RegExp(`${id} review without`), `${id} has a queued continued request`);
});

test('live remote leases appear in the heartbeat beside their verification run', async t => {
  const { clock, root, hub, ui } = await fixture(t, 100);
  const lease: DropletLease = { kind: 'droplet', provider: 'digitalocean', lease: 'live', run: 'remote', name: 'cland-heartbeat',
    created: clock.now().toISOString(), deadline: new Date(clock.now().getTime() + 1000).toISOString(), resource: 123,
    tags: ['cland'], size: 'test', region: 'test', priceHourly: 0, keyName: 'test', state: 'active', keyId: 1 };
  const remote = job(clock, root, 'remote', { executor: 'droplet', lease });
  hub.core.store.setMeta('suite-jobs', JSON.stringify([remote]));
  hub.core.store.setMeta('executor-leases', JSON.stringify([lease]));
  await nextHeartbeat(clock, ui, 100, m => /lease cland-.* · (creating|active) · expires/.test(m.text));
  const digest = (await notes(ui)).find(m => /lease cland-.* · (creating|active) · expires/.test(m.text))!;
  assert.ok(digest);
  assert.match(digest.text, new RegExp(`run ${remote.id}`));
});

test('roles have independent heartbeat schedules, renaming retains identity, and revocation stops firing', async t => {
  const { clock, root, hub, ui, coord } = await fixture(t, 150);
  hub.core.setSessionState('stable-coord', 'coord', 'idle', 'test adapter');
  await ui.request({ type: 'crew.set', key: 'qa.heartbeat', value: '1m' });
  await nextHeartbeat(clock, ui, 200, m => m.text.startsWith('heartbeat · coord ·'));
  assert.equal((await coord.request({ type: 'rename', name: 'coord-renamed' })).ok, true);
  await session(t, hub, root, ui, 'quality', 'qa', 'qa-stable');
  hub.core.setSessionState('qa-stable', 'quality', 'idle', 'test adapter');
  await nextHeartbeat(clock, ui, 300, m => m.text.startsWith('heartbeat · coord-renamed'));
  await nextHeartbeat(clock, ui, 150, m => m.text.startsWith('heartbeat · quality'));
  const both = await notes(ui);
  assert.ok(both.some(m => m.text.startsWith('heartbeat · coord-renamed')));
  assert.ok(both.some(m => m.text.startsWith('heartbeat · quality')));
  assert.ok(both.some(m => m.text.startsWith('heartbeat · coord ·')));
  const who = (await coord.request({ type: 'who' })).value as { sessions: Array<{ name: string; sessionId: string }> };
  assert.equal(who.sessions.find(s => s.name === 'coord-renamed')?.sessionId, 'stable-coord');
  await ui.request({ type: 'role.clear', session: 'coord-renamed' });
  const afterClear = (await notes(ui)).filter(m => m.text.startsWith('heartbeat · coord-renamed')).length;
  const qaCount = (await notes(ui)).filter(m => m.text.startsWith('heartbeat · quality')).length;
  for (let n = 0; n < 2; n++) await nextHeartbeat(clock, ui, 150, m => m.text.startsWith('heartbeat · quality'));
  assert.ok((await notes(ui)).filter(m => m.text.startsWith('heartbeat · quality')).length >= qaCount + 2);
  assert.equal((await notes(ui)).filter(m => m.text.startsWith('heartbeat · coord-renamed')).length, afterClear);
});

test('watched review and ready transitions wait a full interval even when a hand edit retains an old updated date', async t => {
  const { root, clock, ui } = await fixture(t, 200);
  await clock.advance(200);
  await ui.waitFor(heartbeat);
  await ui.request({ type: 'crew.set', key: 'coordinator.heartbeat', value: 'off' });
  const items: Array<{ id: string; file: string; status: string }> = [];
  for (const status of ['review', 'ready']) {
    const created = await ui.request({ type: 'task.create', size: 'S', title: `Watched ${status}` });
    assert.equal(created.ok, true, created.error);
    items.push({ ...(created.value as { item: { id: string; file: string } }).item, status });
  }
  await clock.advance(250); // The paused schedule is overdue before either watched transition.
  for (const item of items) {
    const path = join(root, '.cland/tasks', item.file);
    const source = await readFile(path, 'utf8');
    await writeFile(path, source.replace(/^status: backlog$/m, `status: ${item.status}`).replace(/^updated:.*$/m, 'updated: \"2020-01-01T00:00:00.000Z\"'));
    const edited = await ui.waitFor(frame => frame.type === 'task' && (frame.item as { id?: string; status?: string } | null)?.id === item.id && (frame.item as { status?: string }).status === item.status);
    assert.equal((edited.item as { updated: string }).updated, '2020-01-01T00:00:00.000Z');
  }
  const cursor = ui.frames.length;
  await ui.request({ type: 'crew.set', key: 'coordinator.heartbeat', value: '1m' });
  await clock.advance(50);
  const first = await ui.waitFor(f => ui.frames.indexOf(f) >= cursor && heartbeat(f));
  assert.equal((first.message as Message).detail?.stale, 0, 'an old updated date does not age a newly observed state');
  await clock.advance(200);
  await ui.waitFor(f => ui.frames.indexOf(f) >= cursor && heartbeat(f) && (f.message as Message).detail?.stale === 2);
});

test('held duration warning work cannot stall verifier queue diagnostics', async t => {
  const run = caseDeadlines(t);
  const entered = Promise.withResolvers<void>();
  const warnings = Promise.withResolvers<string[]>();
  try {
    const f = await fixture(t, 100, { durationWarnings: () => { entered.resolve(); return warnings.promise; } });
    await f.clock.advance(100);
    await run.wait('warning read held before queue admission', () => entered.promise);
    const item = await f.tracker.create({ id: 'stable-coord', name: 'coord', role: 'coordinator' }, { title: 'Queued during warning read', size: 'S' });
    const sent = f.hub.core.sendFromSession('coord', ['reviewer'], `review request ${item.id}`);
    assert.equal(sent.outcomes[0]?.outcome, 'queued');
    await f.clock.advance(1001);
    const rows = f.hub.core.topicHistory('agents').messages.filter(m => m.detail?.request === sent.message.id && m.detail?.outcome === 'stalled');
    assert.equal(rows.length, 1, 'durable queue diagnostic precedes release of warning work');
    await f.clock.advance(1000);
    assert.equal(f.hub.core.topicHistory('agents').messages.filter(m => m.detail?.request === sent.message.id && m.detail?.outcome === 'stalled').length, 1);
  } finally { warnings.resolve([]); }
});
