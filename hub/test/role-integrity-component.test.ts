// T2: same-title hub rules through real socket/MCP edges and in-process peers; native flow in scenarios/message-tracer and crew-launch.
import { FakeClock } from './fake-clock.ts';
import { test } from 'node:test';
import { EventEmitter, once } from 'node:events';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, eventually, inProcessSpoke, projectHub, tempProject, type FrameClient } from './harness.ts';

type Holder = { name: string; role: string | null; live: boolean };

type RoleList = { roles: Array<{ role: string; holders: Holder[] }>; coordinator: string | null };

const hubLog = (root: string) => readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8');

async function holders(ui: FrameClient, role: string): Promise<string[]> {
  const r = await ui.request({ type: 'role.list' });
  assert.equal(r.ok, true, r.error);
  return ((r.value as RoleList).roles.find((x) => x.role === role)?.holders ?? []).map((h) => h.name);
}

async function component(t: import('node:test').TestContext, root: string, options: { failSpawn?: boolean } = {}) {
  const events = new EventEmitter<{ 'refused-role': [Record<string, unknown>] }>();
  const hub = await projectHub(t, root, {}, { log: entry => {
    if (entry.event === 'refused-role') events.emit('refused-role', entry);
  } });
  const fake = hub.fakes.codex!;
  const peers = new Map<string, import('./harness.ts').Session>();
  const attach = async (process: import('../src/adapters/contract.ts').HarnessProcess, launchToken?: string) => {
    const peer = await inProcessSpoke(t, { discover: true, cwd: root, name: process.name, sessionId: process.sessionId, assignRole: false, ...(launchToken ? { launchToken } : {}) });
    peers.set(process.name, peer);
    if (process.role) {
      await peer.waitForPresence([process.name]);
    }
    return peer;
  };
  const watch = fake.watch.bind(fake);
  fake.watch = process => { watch(process); fake.idle(process.name); };
  const spawn = fake.spawn.bind(fake);
  fake.spawn = async (request, ...rest) => {
    const process = await spawn(request, ...rest);
    const peer = await attach(process, request.launchToken);
    if (options.failSpawn) { await peer.close(); throw new Error('refused the first turn'); }
    return process;
  };
  const resume = fake.resume.bind(fake);
  fake.resume = async (...args) => {
    const result = await resume(...args);
    if (result.found) await attach(result.process);
    return result;
  };
  const crash = async (name: string) => { await peers.get(name)?.close(); fake.crash(name); };
  return { ...hub, fake, peers, crash, events };
}

test('a Coordinator remembered past the queue TTL that reconnects after another took the role is refused it; the UI learns', async (t) => {
  const root = await tempProject(t);
  const queueTtlMs = 300;
  const clock = new FakeClock();
  const { discovery } = await projectHub(t, root, { CLAND_QUEUE_TTL_MS: String(queueTtlMs) }, { clock });
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);

  const old = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord-a', sessionId: 'sess-a', role: 'coordinator' });
  await ui.waitFor((f) => f.type === 'role.filled' && f.session === 'coord-a', 30_000);
  await old.close();
  await ui.waitFor((f) => f.type === 'role.vacant');
  // past the TTL the old holder no longer counts: the human gives the role to another session
  await clock.advance(1.2 * queueTtlMs);
  const set = await ui.request({ type: 'role.set', session: 'coord-b', role: 'coordinator' });
  assert.equal(set.ok, true, set.error);
  const b = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord-b', sessionId: 'sess-b', assignRole: false });
  t.after(() => b.close());
  await ui.waitFor((f) => f.type === 'role.filled' && f.session === 'coord-b', 30_000);

  // the old holder comes back: it is refused the role, not a second Coordinator
  const back = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord-a', sessionId: 'sess-a', assignRole: false });
  t.after(() => back.close());
  await eventually('refused', () => (/no role: .*coord-a/.test(back.log()) ? true : undefined));
  const revoked = await ui.waitFor((f) => f.type === 'session.role' && f.session === 'coord-a' && f.role === null && f.previous === 'coordinator');
  assert.match(String(revoked.reason), /coord-b/);
  assert.deepEqual(await holders(ui, 'coordinator'), ['coord-b']);
  const status = (await ui.request({ type: 'hub.status' })).value as { coordinator: string | null; sessions: Array<{ name: string }> };
  assert.equal(status.coordinator, 'coord-b');
  assert.ok(!status.sessions.some((s) => s.name === 'coord-a'), 'the stale holder stays off the hub');
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  assert.match(await hubLog(root), /"event":"role-superseded","session":"coord-a"/);
});

type Harness = { name: string; role: string | null; pid: number | null; sessionId: string; status: string; state: string };

async function processes(ui: FrameClient): Promise<Harness[]> {
  const r = await ui.request({ type: 'session.list' });
  assert.equal(r.ok, true, r.error);
  return (r.value as { processes: Harness[] }).processes;
}

async function launchCodex(ui: FrameClient, name: string, extra: Record<string, unknown> = {}) {
  return ui.request({ type: 'session.launch', name, harness: 'codex', ...extra }, 30_000);
}

const presentAs = (ui: FrameClient, name: string, state: string) =>
  eventually(`${name} present as ${state}`, async () => {
    const s = ((await ui.request({ type: 'hub.status' })).value as { sessions: Array<{ name: string; state: string; role: string | null }> }).sessions.find((x) => x.name === name);
    return s?.state === state ? s : undefined;
  });

test('two launches for the Coordinator at once: the role is reserved before the spawn, so the second is refused at once', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await component(t, root);
  const ui = await connectUi(t, discovery);
  const [one, two] = await Promise.all([launchCodex(ui, 'coord-1', { role: 'coordinator' }), launchCodex(ui, 'coord-2', { role: 'coordinator' })]);
  assert.equal(one.ok, true, one.error);
  assert.equal(two.ok, false);
  assert.match(two.error ?? '', /crew\.coordinator: singleton size 1 reached \(coord-1\)/);
  // the human's assignment is refused as well
  const set = await ui.request({ type: 'role.set', session: 'other', role: 'coordinator' });
  assert.match(set.error ?? '', /held by coord-1/);
  await presentAs(ui, 'coord-1', 'idle');
  assert.deepEqual(await holders(ui, 'coordinator'), ['coord-1']);
  assert.deepEqual((await processes(ui)).map((p) => p.name), ['coord-1']);
});

test('a launch that fails after its spoke connected gives the role back: no Coordinator is left reserved offline', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await component(t, root, { failSpawn: true });
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const failed = await launchCodex(ui, 'coord', { role: 'coordinator' });
  assert.equal(failed.ok, false);
  assert.match(failed.error ?? '', /refused the first turn/);
  // the spoke had connected (an early hello) and taken the role; it is rolled back
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  assert.ok((await hubLog(root)).includes('"event":"hello","name":"coord"'), 'the spoke said hello before the first turn failed');
  await eventually('no holder', async () => ((await holders(ui, 'coordinator')).length === 0 ? true : undefined));
  assert.equal(((await ui.request({ type: 'hub.status' })).value as { coordinator: string | null }).coordinator, null);
  const set = await ui.request({ type: 'role.set', session: 'next', role: 'coordinator' });
  assert.equal(set.ok, true, set.error);
});

test('a role changed while a relaunch is under way stays changed: resume never writes back the role it started from', async (t) => {
  const root = await tempProject(t);
  const f = await component(t, root);
  const { discovery } = f;
  const ui = await connectUi(t, discovery);
  const launched = await launchCodex(ui, 'coord', { role: 'coordinator' });
  assert.equal(launched.ok, true, launched.error);
  await presentAs(ui, 'coord', 'idle');
  await f.crash('coord');
  await eventually('exited', async () => ((await processes(ui)).find((p) => p.name === 'coord')?.status === 'exited' ? true : undefined));
  const history = await ui.request({ type: 'topic.history', topic: 'general' });
  assert.equal(history.ok, true, history.error);
  const notices = (history.value as { messages: Array<{ text: string; kind: string }> }).messages.filter(m => m.kind === 'coordinator-exited');
  assert.equal(notices.length, 1, 'the fake harness exit reaches General after the spoke has disconnected');
  assert.match(notices[0]!.text, /coord.*harness exited at.*Coordinator role was released/);
  assert.ok(notices[0]!.text.includes('cland session resume coord --relaunch'));

  // the relaunch and the human's assignment race: the assignment lands while the adapter starts the new app-server
  const [resumed, set] = await Promise.all([ui.request({ type: 'session.resume', session: 'coord', relaunch: true }, 30_000), ui.request({ type: 'role.set', session: 'coord', role: 'implementer' })]);
  assert.equal(set.ok, true, set.error);
  assert.equal(resumed.ok, true, resumed.error);
  assert.equal((await processes(ui)).find((p) => p.name === 'coord')?.role, 'implementer');
  const present = await presentAs(ui, 'coord', 'idle');
  assert.equal(present.role, 'implementer');
});

test('a renamed session keeps its revocation: its process-table row follows the rename, and a relaunch is not granted the old role', async (t) => {
  const root = await tempProject(t);
  const f = await component(t, root);
  const { discovery } = f;
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const launched = await launchCodex(ui, 'coord', { role: 'coordinator' });
  assert.equal(launched.ok, true, launched.error);
  await presentAs(ui, 'coord', 'idle');
  // the session renames itself (its model calls `rename`)
  assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text: 'rename to boss', to: ['coord'] })).ok, true);
  const peer = f.peers.get('coord')!;
  assert.equal((await peer.call<{ ok: boolean }>('rename', { name: 'boss' })).ok, true);
  assert.equal((await peer.call<{ ok: boolean }>('send', { topic: 'general', text: 'pong: rename to boss' })).ok, true);
  await ui.waitFor(frame => frame.type === 'message' && (frame.message as { from: string; text: string }).from === 'boss' && (frame.message as { text: string }).text === 'pong: rename to boss');
  const rows = await processes(ui);
  assert.deepEqual(rows.map((p) => [p.name, p.role]), [['boss', 'coordinator']]);

  // the human revokes it; it dies; a relaunch under its name is not granted the role back
  assert.equal((await ui.request({ type: 'role.clear', session: 'boss' })).ok, true);
  assert.equal((await processes(ui)).find((p) => p.name === 'boss')?.role, null);
  await f.peers.get('coord')!.close();
  f.fake.crash('boss');
  await eventually('exited', async () => ((await processes(ui)).find((p) => p.name === 'boss')?.status === 'exited' ? true : undefined));
  // Resume acknowledges the adapter, not the new spoke's hello. Observe the refusal
  // before flushing its asynchronous log sink; a loaded relaunch can exceed 15 s.
  const refusal = once(f.events, 'refused-role', { signal: AbortSignal.timeout(30_000) });
  const [resumed, [refused]] = await Promise.all([
    ui.request({ type: 'session.resume', session: 'boss', relaunch: true }, 30_000),
    refusal,
  ]);
  assert.equal(resumed.ok, true, resumed.error);
  assert.equal(refused.name, 'boss');
  assert.equal(refused.sessionId, (launched.value as { process: Harness }).process.sessionId);
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  assert.match(await hubLog(root), /"event":"refused-role","name":"boss"/);
  const status = (await ui.request({ type: 'hub.status' })).value as { sessions: Array<{ name: string }>; coordinator: string | null };
  assert.equal(status.coordinator, null);
  assert.ok(!status.sessions.some((s) => s.name === 'boss'));
});
