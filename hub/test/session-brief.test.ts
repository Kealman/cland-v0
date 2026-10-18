// T3: native early-first-turn acknowledgement and owned-process stop after cancellation failure.
// Launch ordering and replay at the frame and fake-harness seams; no private hub state is read.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { fakeHarness } from './fakes/harness.ts';
import { Sessions } from '../src/adapters/sessions.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { Store } from '../src/hub/store.ts';
import { createSocketEdge } from '../src/hub/socket.ts';
import { fixedRoles } from '../src/roles/config.ts';
import { connectSocket, connectUi, eventually, startHub, tempProject, TEST_SECRET, type SocketClient } from './harness.ts';

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
  const flavour = options.carried ? 'codex' : 'claude-code';
  const fake = fakeHarness(flavour, { clock: hub.core.clock });
  const spawn = fake.spawn.bind(fake);
  fake.spawn = async (request, resumed, authorize) => {
    launchToken = request.launchToken;
    spawns++;
    if (options.failFirstSpawn && spawns === 1) throw new Error('fixture refused the first spawn');
    if (options.carried) nativeInput = `${request.clause}\n\n${request.brief?.text}`;
    if (!options.deferHello) {
      launchedPeer = await open(request.launchToken);
      // Deliberately beat spawn acceptance: a real harness can connect before its launch returns.
      launchFrames = [await launchedPeer.next(), await launchedPeer.next()];
    }
    return spawn({ ...request, sessionId: 'brief-session' }, resumed, authorize);
  };
  fake.scriptResume('impl', 'found');
  const stop = fake.stop.bind(fake);
  fake.stop = async (...args) => { stops++; await stop(...args); };
  const watch = fake.watch.bind(fake);
  fake.watch = process => {
    if (options.failWatchOnce && watches++ === 0) throw new Error('fixture watch failed');
    watch(process);
  };
  sessions.register(fake);
  sessions.releaseInterruptedLaunches();
  hub.dispatcher.useSessions(sessions);
  const ui = await connectUi(t, { socket, secret: TEST_SECRET });
  return { ui, open, close, flavour, hub: { url: hub.url }, spawns: () => spawns, stops: () => stops, launched: () => ({ peer: launchedPeer!, frames: launchFrames, nativeInput, launchToken }) };
}

const withRules = (brief: string) => `${brief}\n\nProject rules for your role\nNo project rules apply to your role.`;

test('a brief accepted in the native first turn before hello stays injected after a hub restart', async t => {
  const root = await tempProject(t);
  const first = await fixture(t, root, { deferHello: true, carried: true });
  const brief = 'This brief was already accepted in the native first turn.';
  const result = await first.ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: first.flavour, brief });
  assert.equal(result.ok, true, result.error);
  assert.match(first.launched().nativeInput, /you hold the role Implementer/);
  assert.ok(first.launched().nativeInput.endsWith(withRules(brief)));
  first.ui.close();
  await first.close();

  const second = await fixture(t, root, { deferHello: true, carried: true });
  const history = (await second.ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Array<{ id: string; text: string; stage?: string }> };
  const recorded = history.messages.filter(message => message.text === withRules(brief));
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

test('a brief cancellation error cannot skip the owned-process stop after a watch refusal', async t => {
  const root = await tempProject(t);
  const f = await fixture(t, root, { deferHello: true, failWatchOnce: true, failBriefCancellation: true });
  const refused = await f.ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: f.flavour, brief: 'Cancel with the failed launch.' });
  assert.equal(refused.ok, false);
  assert.equal(f.stops(), 1, 'brief settlement cannot bypass stopping the owned process');
  assert.match(refused.error!, /fixture watch failed/);
  assert.match(refused.error!, /brief cancellation journal failed/);
  const listed = (await f.ui.request({ type: 'session.list' })).value as { processes: unknown[]; pendingStops: unknown[] };
  assert.deepEqual(listed.processes, []);
  assert.equal(listed.pendingStops.length, 1, 'the failed settlement remains covered by its guarded cleanup receipt');
  const history = (await f.ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Array<{ text: string; stage?: string }> };
  assert.equal(history.messages.find(message => message.text === withRules('Cancel with the failed launch.'))?.stage, 'dropped');
  await eventually('brief cleanup receipt retried and settled', async () => {
    const listed = (await f.ui.request({ type: 'session.list' })).value as { pendingStops: unknown[] };
    return listed.pendingStops.length === 0 || undefined;
  }, 10_000);
  assert.equal(f.stops(), 1, 'receipt retry never stops an already stopped process again');
});
