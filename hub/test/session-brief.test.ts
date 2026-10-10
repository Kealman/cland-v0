// Launch ordering and replay at the frame and fake-harness seams; no private hub state is read.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { Sessions } from '../src/adapters/sessions.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { Store } from '../src/hub/store.ts';
import { createSocketEdge } from '../src/hub/socket.ts';
import { fixedRoles } from '../src/roles/config.ts';
import { connectSocket, connectUi, eventually, spawnSpoke, startHub, tempProject, TEST_SECRET, type SocketClient } from './harness.ts';

async function fixture(t: TestContext, root: string, options: { deferHello?: boolean; carried?: boolean; failFirstSpawn?: boolean; failBriefPublication?: boolean; failBriefCancellation?: boolean; failWatchOnce?: boolean } = {}) {
  await mkdir(join(root, '.cland'), { recursive: true });
  const db = join(root, '.cland', 'hub.db');
  let publicationFailed = false, cancellationFailed = false;
  const log = (entry: Record<string, unknown>) => {
    if (options.failBriefPublication && !publicationFailed && entry.event === 'send' && entry.from === 'hub') {
      publicationFailed = true;
      throw new Error('fixture brief publication failed');
    }
    if (options.failBriefCancellation && !cancellationFailed && entry.event === 'dropped' && entry.reason === 'launch failed') {
      cancellationFailed = true;
      throw new Error('fixture brief cancellation journal failed');
    }
  };
  const hub = await startHub({ store: new Store(db), roles: fixedRoles(), log });
  const socket = join(root, 'test.sock');
  const edge = await createSocketEdge({ path: socket, dispatcher: hub.dispatcher });
  const table = new ProcessTable(db);
  const sessions = new Sessions({ core: hub.core, table, root, log });
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    sessions.close();
    table.close();
    await edge.close();
    await hub.close();
  };
  t.after(close);
  let launchedPeer: SocketClient | undefined;
  let launchFrames: Array<Record<string, unknown>> = [];
  let nativeInput = '';
  let spawns = 0;
  let stops = 0, watches = 0;
  let launchToken: string | undefined;
  const open = async (launchToken?: string) => {
    const peer = await connectSocket(socket);
    t.after(() => peer.close());
    peer.send({ type: 'hello', protocol: 2, secret: TEST_SECRET, name: 'impl', sessionId: 'brief-session', cwd: root, ...(launchToken ? { launchToken } : {}) });
    return peer;
  };
  sessions.register({
    harness: 'fake',
    clauseAtSpawn: options.carried ?? false,
    capabilities: { history: 'none', usage: 'none', setModel: 'none', approvalRelay: 'none', states: { busy: 'none', idle: 'none', 'waiting for human': 'none', 'waiting for approval': 'none' } },
    spawn: async request => {
      launchToken = request.launchToken;
      spawns++;
      if (options.failFirstSpawn && spawns === 1) throw new Error('fixture refused the first spawn');
      if (options.carried) nativeInput = `${request.clause}\n\n${request.brief?.text}`;
      if (!options.deferHello) {
        launchedPeer = await open(request.launchToken);
        // Deliberately beat spawn acceptance: a real harness can connect before its launch returns.
        launchFrames = [await launchedPeer.next(), await launchedPeer.next()];
      }
      return { name: request.name, harness: 'fake', role: request.role, model: request.model, cwd: request.cwd, pid: null, harnessId: null, sessionId: 'brief-session', harnessSessionId: null, startedAt: new Date().toISOString(), status: 'running' };
    },
    resume: async process => ({ found: true, process, state: 'idle' }),
    stop: async () => { stops++; }, attachCommand: () => '',
    watch: () => { if (options.failWatchOnce && watches++ === 0) throw new Error('fixture watch failed'); },
    inject: async () => {}, confirm: () => {}, interpret: () => ({}), close: () => {},
  });
  sessions.releaseInterruptedLaunches();
  hub.dispatcher.useSessions(sessions);
  const ui = await connectUi(t, { socket, secret: TEST_SECRET });
  return { ui, open, close, hub: { url: hub.url }, spawns: () => spawns, stops: () => stops, launched: () => ({ peer: launchedPeer!, frames: launchFrames, nativeInput, launchToken }) };
}

test('a launch brief follows welcome and clause, uses ordinary stages, and is not recreated on reconnect or restart', async t => {
  const root = await tempProject(t);
  const first = await fixture(t, root);
  assert.equal((await first.ui.request({ type: 'subscribe' })).ok, true);
  const brief = 'Implement the work from this one-time brief.';
  const result = await first.ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'fake', brief });
  assert.equal(result.ok, true, result.error);
  const { peer, frames } = first.launched();
  assert.deepEqual(frames.map(frame => frame.type), ['welcome', 'deliver']);
  const input = frames[1]!.message as { text: string; digest: Array<{ id: string; text: string }> };
  assert.match(input.digest[0]!.text, /you hold the role Implementer/);
  assert.equal(input.text, brief);
  const id = frames[1]!.id;
  const queued = await first.ui.waitFor(frame => frame.type === 'message' && (frame.message as { id: string }).id === id);
  assert.equal((queued.message as { stage: string }).stage, 'queued');
  peer.send({ type: 'ack', id });
  await eventually('brief injected', async () => {
    const history = (await first.ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Array<{ id: string; stage?: string }> };
    return history.messages.find(message => message.id === id)?.stage === 'injected' || undefined;
  });
  assert.deepEqual(first.ui.frames.filter(frame => frame.type === 'delivery' && frame.message === id).map(frame => frame.stage), ['delivered', 'injected']);
  peer.close();
  await eventually('session disconnected', async () => {
    const roles = (await first.ui.request({ type: 'role.list' })).value as { roles: Array<{ holders: Array<{ name: string; live: boolean }> }> };
    return !roles.roles.some(role => role.holders.some(holder => holder.name === 'impl' && holder.live)) || undefined;
  });

  const verifyNoReplay = async (f: Awaited<ReturnType<typeof fixture>>, text: string) => {
    const reconnected = await f.open();
    assert.equal((await reconnected.next()).type, 'welcome');
    const clause = await reconnected.next();
    assert.equal(clause.type, 'role');
    reconnected.send({ type: 'ack', id: clause.id });
    assert.equal((await f.ui.request({ type: 'topic.send', topic: 'general', to: ['impl'], text })).ok, true);
    const next = await reconnected.next();
    assert.equal(next.type, 'deliver');
    assert.equal((next.message as { text: string }).text, text, 'the next ordinary input is the new message, never the brief');
    reconnected.send({ type: 'ack', id: next.id });
    const history = (await f.ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Array<{ id: string; text: string; stage?: string }> };
    assert.deepEqual(history.messages.filter(message => message.text === brief).map(message => [message.id, message.stage]), [[id, 'injected']]);
    reconnected.close();
  };
  await verifyNoReplay(first, 'After reconnect');
  first.ui.close();
  await first.close();
  const second = await fixture(t, root);
  await verifyNoReplay(second, 'After hub restart');
});

test('a launch brief survives a hub restart before its first hello and is delivered in the first input once', async t => {
  const root = await tempProject(t);
  const first = await fixture(t, root, { deferHello: true });
  const brief = 'Begin after the hub restarted before the first hello.';
  const result = await first.ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'fake', brief });
  assert.equal(result.ok, true, result.error);
  first.ui.close();
  await first.close();

  const second = await fixture(t, root, { deferHello: true });
  const history = (await second.ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Array<{ id: string; text: string; stage?: string }> };
  const recorded = history.messages.filter(message => message.text === brief);
  assert.equal(recorded.length, 1, 'the requested brief is durable before the first hello');
  assert.equal(recorded[0]!.stage, 'queued');
  const peer = await second.open(first.launched().launchToken);
  assert.equal((await peer.next()).type, 'welcome');
  const frame = await peer.next();
  assert.equal(frame.type, 'deliver');
  assert.equal(frame.id, recorded[0]!.id);
  const input = frame.message as { text: string; digest: Array<{ text: string }> };
  assert.match(input.digest[0]!.text, /you hold the role Implementer/);
  assert.equal(input.text, brief);
  peer.send({ type: 'ack', id: frame.id });
  await eventually('recovered brief injected', async () => {
    const history = (await second.ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Array<{ id: string; stage?: string }> };
    return history.messages.find(message => message.id === frame.id)?.stage === 'injected' || undefined;
  });
  assert.equal((await second.ui.request({ type: 'topic.send', topic: 'general', to: ['impl'], text: 'Next input' })).ok, true);
  const next = await peer.next();
  assert.equal((next.message as { text: string }).text, 'Next input', 'the brief is delivered only once');
});

test('an unacknowledged brief retries after the current clause without the superseded launch role', async t => {
  const root = await tempProject(t);
  const f = await fixture(t, root);
  const brief = 'Start from the current role.';
  assert.equal((await f.ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'fake', brief })).ok, true);
  const original = f.launched();
  original.peer.close();
  await eventually('launch connection gone', async () => {
    const roles = (await f.ui.request({ type: 'role.list' })).value as { roles: Array<{ holders: Array<{ name: string; live: boolean }> }> };
    return !roles.roles.some(role => role.holders.some(holder => holder.name === 'impl' && holder.live)) || undefined;
  });
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'qa' })).ok, true);
  const peer = await f.open();
  const welcome = await peer.next();
  assert.equal(welcome.type, 'welcome');
  assert.equal(welcome.role, 'qa');
  const clause = await peer.next();
  assert.equal(clause.type, 'role', 'current authority comes before the ordinary brief retry');
  assert.match((clause.message as { text: string }).text, /you hold the role QA/);
  const retry = await peer.next();
  assert.equal(retry.type, 'deliver');
  assert.equal(retry.id, original.frames[1]!.id, 'retries the same message, never a recreated launch brief');
  const input = retry.message as { text: string; digest?: Array<{ text: string }> };
  assert.equal(input.text, brief);
  assert.ok(!input.digest?.some(note => note.text.includes('you hold the role Implementer')));
});

test('a brief accepted in the native first turn before hello stays injected after a hub restart', async t => {
  const root = await tempProject(t);
  const first = await fixture(t, root, { deferHello: true, carried: true });
  const brief = 'This brief was already accepted in the native first turn.';
  const result = await first.ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'fake', brief });
  assert.equal(result.ok, true, result.error);
  assert.match(first.launched().nativeInput, /you hold the role Implementer/);
  assert.ok(first.launched().nativeInput.endsWith(brief));
  first.ui.close();
  await first.close();

  const second = await fixture(t, root, { deferHello: true, carried: true });
  const history = (await second.ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Array<{ id: string; text: string; stage?: string }> };
  const recorded = history.messages.filter(message => message.text === brief);
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0]!.stage, 'injected', 'the accepted first input is durably settled before hello');
  const peer = await second.open(first.launched().launchToken);
  assert.equal((await peer.next()).type, 'welcome');
  const clause = await peer.next();
  assert.equal(clause.type, 'role');
  peer.send({ type: 'ack', id: clause.id });
  const notice = await peer.next();
  assert.equal(notice.id, recorded[0]!.id);
  peer.send({ type: 'ack', id: notice.id });
  assert.equal((await second.ui.request({ type: 'topic.send', topic: 'general', to: ['impl'], text: 'Next input' })).ok, true);
  assert.equal(((await peer.next()).message as { text: string }).text, 'Next input');
});

test('a refused launch drops its brief and releases held notes to the next successful launch input', async t => {
  const root = await tempProject(t);
  const f = await fixture(t, root, { failFirstSpawn: true });
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'implementer' })).ok, true);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'sender', role: 'coordinator' })).ok, true);
  const sender = await spawnSpoke({ hub: f.hub, cwd: root, name: 'sender', role: 'coordinator' });
  t.after(() => sender.close());
  await sender.waitForPresence(['sender']);
  assert.equal((await sender.call<{ ok: boolean }>('send', { to: ['impl'], kind: 'progress', text: 'Keep this held progress note.' })).ok, true);
  const refused = await f.ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'fake', brief: 'Refused first brief.' });
  assert.equal(refused.ok, false);
  assert.match(refused.error!, /fixture refused/);
  const history = (await f.ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Array<{ text: string; stage?: string }> };
  assert.equal(history.messages.find(message => message.text === 'Refused first brief.')?.stage, 'dropped');
  const next = await f.ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'fake', brief: 'Successful second brief.' });
  assert.equal(next.ok, true, next.error);
  const input = f.launched().frames[1]!.message as { text: string; digest: Array<{ text: string }> };
  assert.equal(input.text, 'Successful second brief.');
  assert.ok(input.digest.some(note => note.text === 'Keep this held progress note.'), 'cancellation must not strand notes in a dropped batch');
});

test('a launch refused by brief publication cannot feed its brief to a successful same-name retry', async t => {
  const root = await tempProject(t);
  const f = await fixture(t, root, { failBriefPublication: true });
  const refused = await f.ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'fake', brief: 'Refused publication brief.' });
  assert.equal(refused.ok, false);
  assert.match(refused.error!, /fixture brief publication failed/);
  assert.equal(f.spawns(), 0, 'publication refusal is before native spawn');
  const current = await f.ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'fake', brief: 'Current launch brief.' });
  assert.equal(current.ok, true, current.error);
  const input = f.launched().frames[1]!.message as { text: string; digest: Array<{ text: string }> };
  assert.match(input.digest[0]!.text, /you hold the role Implementer/);
  assert.equal(input.text, 'Current launch brief.');
  assert.ok(!input.digest.some(note => note.text === 'Refused publication brief.'));
  const history = (await f.ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Array<{ text: string; stage?: string }> };
  assert.equal(history.messages.find(message => message.text === 'Refused publication brief.')?.stage, 'dropped');
});

test('a brief cancellation error cannot skip the owned-process stop after a watch refusal', async t => {
  const root = await tempProject(t);
  const f = await fixture(t, root, { deferHello: true, failWatchOnce: true, failBriefCancellation: true });
  const refused = await f.ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'fake', brief: 'Cancel with the failed launch.' });
  assert.equal(refused.ok, false);
  assert.equal(f.stops(), 1, 'brief settlement cannot bypass stopping the owned process');
  assert.match(refused.error!, /fixture watch failed/);
  assert.match(refused.error!, /brief cancellation journal failed/);
  const listed = (await f.ui.request({ type: 'session.list' })).value as { processes: unknown[]; pendingStops: unknown[] };
  assert.deepEqual(listed.processes, []);
  assert.equal(listed.pendingStops.length, 1, 'the failed settlement remains covered by its guarded cleanup receipt');
  const history = (await f.ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Array<{ text: string; stage?: string }> };
  assert.equal(history.messages.find(message => message.text === 'Cancel with the failed launch.')?.stage, 'dropped');
  await eventually('brief cleanup receipt retried and settled', async () => {
    const listed = (await f.ui.request({ type: 'session.list' })).value as { pendingStops: unknown[] };
    return listed.pendingStops.length === 0 || undefined;
  }, 10_000);
  assert.equal(f.stops(), 1, 'receipt retry never stops an already stopped process again');
});
