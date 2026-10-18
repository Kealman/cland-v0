// T3: native welcome ordering, held transport and process exit publication.
// Subscribed UI frames at the transport boundary: presence, process rows and coalesced usage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectUi, connectWsUi, eventually, fakeClaude, spawnSpoke, startDaemon, startHub, tempProject, withDiscoveredPid } from './harness.ts';
import type { HarnessProcessView, Presence, SessionUsage } from '../src/protocol.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { Sessions } from '../src/adapters/sessions.ts';

const presence = (f: Record<string, unknown>): Presence[] => f.sessions as Presence[];

const row = (f: Record<string, unknown>): HarnessProcessView => f.process as HarnessProcessView;

test('rename before the spoke welcome waits; after welcome its process event survives a held transport', async t => {
  const root = await tempProject(t);
  const hub = await startHub();
  t.after(() => hub.close());
  const table = new ProcessTable();
  const sessions = new Sessions({ core: hub.core, table, root });
  t.after(() => { sessions.close(); table.close(); });
  table.put({ name: 'coord', harness: 'test', role: 'coordinator', model: null, cwd: root,
    pid: null, pidStarted: null, harnessId: null, sessionId: 'held-coord', harnessSessionId: null,
    startedAt: new Date().toISOString(), status: 'running' });
  let releaseWelcome: (() => void) | undefined;
  const publication = Promise.withResolvers<() => void>();
  const open = hub.dispatcher.open.bind(hub.dispatcher);
  t.mock.method(hub.dispatcher, 'open', (wire: Parameters<typeof open>[0], transport: Parameters<typeof open>[1]) => open({
    ...wire,
    send: frame => {
      if (frame.type === 'welcome' && frame.name === 'coord') releaseWelcome = () => wire.send(frame);
      else if (frame.type === 'session.process' && frame.process.name === 'renamed-coord') publication.resolve(() => wire.send(frame));
      else wire.send(frame);
    },
  }, transport));
  const ui = await connectWsUi(t, hub);
  await ui.request({ type: 'subscribe' });
  const spoke = await spawnSpoke({ hub, name: 'coord', sessionId: 'held-coord', role: 'coordinator' });
  t.after(() => spoke.close());
  await ui.waitFor(f => f.type === 'presence' && presence(f).some(p => p.sessionId === 'held-coord'));
  assert.ok(releaseWelcome, 'the hub welcomed the spoke, but the transport holds that frame');
  let settled = false;
  const pending = spoke.call<{ ok: boolean; name?: string; error?: string }>('rename', { name: 'renamed-coord' }).then(value => { settled = true; return value; });
  // A later MCP request is a transport barrier: the rename has reached the spoke, with no welcome yet.
  await spoke.client.listTools();
  assert.equal(settled, false, 'a call before welcome waits instead of returning an outage');
  assert.equal(ui.frames.some(f => f.type === 'session.process' && row(f).name === 'renamed-coord'), false);
  releaseWelcome();
  const renamed = await pending;
  assert.equal(renamed.ok, true, renamed.error);
  assert.equal(renamed.name, 'renamed-coord');
  const published = ui.waitFor(f => f.type === 'session.process' && row(f).sessionId === 'held-coord' && row(f).name === 'renamed-coord');
  // The existing event deadline bounds capture too; publication may precede or follow the reply.
  const releasePublication = await Promise.race([publication.promise, published.then(() => assert.fail('the process frame escaped the transport hold'))]);
  assert.equal(ui.frames.some(f => f.type === 'session.process' && row(f).name === 'renamed-coord'), false);
  releasePublication();
  assert.equal(row(await published).name, 'renamed-coord');
});

test('process rows publish launch, model, role, rename, exit and stop; usage bursts publish latest totals per session', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const processes: HarnessProcessView[] = [];
  const baseline = new Map<string, number>();
  for (const name of ['coord', 'impl']) {
    const launched = await ui.request({ type: 'session.launch', name, harness: 'claude-code', role: name === 'coord' ? 'coordinator' : 'implementer' });
    assert.equal(launched.ok, true, launched.error);
    const p = (launched.value as { process: HarnessProcessView }).process;
    processes.push(p);
    await ui.waitFor((f) => f.type === 'session.process' && row(f).sessionId === p.sessionId && row(f).status === 'running');
    // Launch admission precedes the role-clause turn; give its hooks their own completion bound.
    await eventually(`${name} initial turn completed`, async () => (await fake.log(p.harnessId!)).includes('session.measure done') || undefined);
    const usage = await ui.waitFor((f) => f.type === 'session.usage' && f.sessionId === p.sessionId);
    baseline.set(p.sessionId, (usage.usage as SessionUsage).total?.outputTokens ?? 0);
  }
  const mark = ui.frames.length;
  // One burst for two launches: neither session can suppress the other's trailing update.
  await Promise.all(processes.flatMap((p) => Array.from({ length: 20 }, () => ui.request({ type: 'session.signal', session: p.name, launch: p.sessionId, event: 'mod-turn-complete', payload: { usage: { output_tokens: 2 } } }))));
  for (const p of processes) {
    await ui.waitFor((f) => f.type === 'session.usage' && f.sessionId === p.sessionId && (f.usage as SessionUsage).total?.outputTokens === (baseline.get(p.sessionId) ?? 0) + 40);
    assert.equal(ui.frames.slice(mark).filter((f) => f.type === 'session.usage' && f.sessionId === p.sessionId).length, 1, 'twenty reports coalesced to latest totals');
  }
  const impl = processes[1]!;
  await ui.request({ type: 'session.signal', session: impl.name, launch: impl.sessionId, event: 'session-start', payload: { model: 'changed-model' } });
  await ui.waitFor((f) => f.type === 'session.process' && row(f).sessionId === impl.sessionId && row(f).model === 'changed-model');
  await ui.request({ type: 'role.set', session: impl.name, role: 'qa' });
  await ui.waitFor((f) => f.type === 'session.process' && row(f).sessionId === impl.sessionId && row(f).role === 'qa');
  const coord = processes[0]!;
  const spoke = await spawnSpoke({ cwd: root, discover: true, name: coord.name, sessionId: coord.sessionId, role: 'coordinator' });
  t.after(() => spoke.close());
  await spoke.waitForPresence([coord.name]);
  const renamed = await spoke.call<{ ok: boolean; error?: string }>('rename', { name: 'renamed-coord' });
  assert.equal(renamed.ok, true, renamed.error);
  await ui.waitFor((f) => f.type === 'session.process' && row(f).sessionId === coord.sessionId && row(f).name === 'renamed-coord');
  const discovered = await withDiscoveredPid(ui, coord);
  process.kill(discovered.pid, 'SIGKILL');
  const exited = await ui.waitFor((f) => f.type === 'session.process' && row(f).sessionId === coord.sessionId && row(f).status === 'exited');
  assert.equal(row(exited).attach, null);
  assert.equal(row(exited).state, 'unknown');
  await ui.request({ type: 'session.stop', session: impl.name });
  const stopped = await ui.waitFor((f) => f.type === 'session.process' && row(f).sessionId === impl.sessionId && row(f).status === 'stopped');
  assert.equal(row(stopped).attach, null);
});
