// T2: hub-computed topic and session rows through the public frame protocol.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createConnection } from 'node:net';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { frameClient, inProcessSpoke, projectHub, tempProject, type FrameClient } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { onCleanup } from './process-cleanup.ts';
import type { HarnessProcessView } from '../src/protocol.ts';

async function modelClient(t: TestContext, discovery: { socket: string; secret: string }, features = ['snapshot', 'numbered-deltas', 'slim-frames']): Promise<FrameClient> {
  const socket = createConnection(discovery.socket);
  onCleanup(t, () => socket.destroy());
  await once(socket, 'connect', { signal: AbortSignal.timeout(2000) });
  socket.setEncoding('utf8');
  const ui = frameClient(line => socket.write(line), fn => socket.on('data', fn), () => socket.destroy());
  const end = ui.waitFor(f => f.type === 'snapshot.end');
  ui.send({ type: 'hello', protocol: 2, secret: discovery.secret, client: 'ui', features });
  await end;
  return ui;
}

test('message deltas carry authoritative unread counts and last message times, and topic.read resets them', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const { discovery } = await projectHub(t, root, {}, { clock });
  const ui = await modelClient(t, discovery);
  const agent = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', sessionId: 'coord-id', role: 'coordinator' });
  await agent.waitForPresence(['coord']);
  const made = await ui.request({ type: 'topic.create', title: 'Unread projection' });
  assert.equal(made.ok, true, made.error);
  const topic = (made.value as { topic: { id: string } }).topic.id;
  for (let unread = 1; unread <= 3; unread++) {
    await clock.advance(1000);
    const changed = ui.waitFor(f => f.type === 'message' && (f.message as { text: string }).text === `Update ${unread}`);
    assert.equal((await agent.call<{ ok: boolean }>('send', { topic, text: `Update ${unread}` })).ok, true);
    const frame = await changed;
    assert.equal((frame.topic as { unread: number }).unread, unread);
    assert.equal((frame.topic as { lastMessageAt: string }).lastMessageAt, clock.now().toISOString());
  }
  const mark = ui.frames.length;
  const read = ui.waitFor(f => ui.frames.indexOf(f) >= mark && f.type === 'topic' && (f.topic as { id: string; unread: number }).id === topic && (f.topic as { unread: number }).unread === 0);
  assert.equal((await ui.request({ type: 'topic.read', topic })).ok, true);
  const reset = (await read).topic as { unread: number; lastMessageAt: string };
  assert.equal(reset.unread, 0);
  assert.equal(reset.lastMessageAt, clock.now().toISOString());
  await clock.advance(1000);
  const sent = ui.waitFor(f => f.type === 'message' && (f.message as { text: string }).text === 'Human reply');
  assert.equal((await ui.request({ type: 'topic.send', topic, text: 'Human reply' })).ok, true);
  const human = (await sent).topic as { unread: number; lastMessageAt: string };
  assert.equal(human.unread, 0);
  assert.equal(human.lastMessageAt, clock.now().toISOString());
});

test('snapshot-only subscribers receive unmanaged rows and removals with distinct unknown identities', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await modelClient(t, discovery, ['snapshot']);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const first = await inProcessSpoke(t, { discover: true, cwd: root, name: 'first', sessionId: 'unknown', role: 'reviewer' });
  const second = await inProcessSpoke(t, { discover: true, cwd: root, name: 'second', sessionId: 'unknown', role: 'reviewer' });
  await second.waitForPresence(['first', 'second']);
  const added = await ui.waitFor(f => f.type === 'session.row' && f.key === 'name:second');
  assert.equal((added.row as { launched: boolean }).launched, false);
  const removal = ui.waitFor(f => f.type === 'session.row' && f.key === 'name:first' && f.row === null);
  await first.close();
  assert.equal((await removal).row, null);
  const snapshot = await modelClient(t, discovery);
  const rows = (snapshot.frames.find(f => f.type === 'snapshot' && f.domain === 'sessions')!.value as { rows: Array<{ key: string }> }).rows;
  assert.deepEqual(rows.map(row => row.key), ['name:second']);
});

test('merged session rows carry newest verifier work with +N, requested work, waiting age, account and usage', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const config = join(root, 'config');
  await mkdir(join(config, 'cland'), { recursive: true });
  await writeFile(join(config, 'cland/accounts.toml'), '[accounts.fixture]\nharness = "claude-code"\n');
  const { discovery, fakes } = await projectHub(t, root, { XDG_CONFIG_HOME: config }, { clock, accountReader: async () => [] });
  const ui = await modelClient(t, discovery);
  const ids: string[] = [];
  for (const title of ['First hold', 'Second hold', 'Requested work']) {
    const made = await ui.request({ type: 'task.create', title, size: 'S' });
    assert.equal(made.ok, true, made.error);
    ids.push((made.value as { item: { id: string } }).item.id);
  }
  const launched = await ui.request({ type: 'session.launch', name: 'rev', role: 'reviewer', harness: 'claude-code', account: 'fixture' });
  assert.equal(launched.ok, true, launched.error);
  const process = (launched.value as { process: HarnessProcessView }).process;
  const rev = await inProcessSpoke(t, { discover: true, cwd: root, name: 'rev', sessionId: process.sessionId, role: 'reviewer' });
  await rev.waitForPresence(['rev']);
  for (const id of ids.slice(0, 2)) {
    await clock.advance(1000);
    const mark = ui.frames.length;
    const changed = ui.waitFor(f => ui.frames.indexOf(f) >= mark && f.type === 'session.row' && (f.row as { item?: string } | null)?.item === id);
    assert.equal((await rev.call<{ ok: boolean }>('task.hold', { id })).ok, true);
    await changed;
    assert.equal((await ui.request({ type: 'hub.status' })).ok, true);
    assert.equal(ui.frames.slice(mark).filter(f => f.type === 'session.row' && f.key === process.sessionId).length, 1);
  }
  const usage = { total: { inputTokens: 100, outputTokens: 23, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 123, cost: 0.25 } };
  fakes['claude-code']!.feedUsage('rev', usage);
  const waiting = await ui.request({ type: 'session.signal', session: 'rev', event: 'permission', at: clock.now().getTime(), payload: { tool_name: 'Bash', approvalCommand: 'touch approved' } });
  assert.equal(waiting.ok, true, waiting.error);
  const stateSince = clock.now().toISOString();
  await clock.advance(2000);
  const snapshot = await modelClient(t, discovery);
  const sessions = snapshot.frames.find(f => f.type === 'snapshot' && f.domain === 'sessions')!.value as { rows: Array<Record<string, unknown>>; processes: HarnessProcessView[]; presence: Array<{ name: string }> };
  assert.ok(Array.isArray(sessions.rows), 'snapshot supplies complete session rows');
  const row = sessions.rows.find(row => row.name === 'rev')!;
  assert.equal(row.item, ids[1]);
  assert.equal(row.itemKind, 'review');
  assert.equal(row.additionalHolds, 1);
  assert.equal(row.itemRequested, false);
  assert.equal(row.state, 'waiting for approval');
  assert.equal(row.stateSince, stateSince);
  assert.equal(row.approvalCommand, 'touch approved');
  assert.equal(row.account, 'fixture');
  assert.deepEqual(row.usage, usage);
  assert.equal((row.presence as { name: string }).name, 'rev');
  assert.equal(sessions.processes[0]!.name, 'rev');
  assert.equal(sessions.presence[0]!.name, 'rev');
  for (const id of ids.slice(0, 2)) assert.equal((await rev.call<{ ok: boolean }>('task.hold', { id, release: true })).ok, true);
  await ui.request({ type: 'topic.send', topic: 'general', to: ['rev'], text: `review request ${ids[2]}` });
  await rev.waitForEvent(e => e.params.content === `review request ${ids[2]}`);
  const requested = await ui.waitFor(f => f.type === 'session.row' && (f.row as Record<string, unknown> | null)?.item === ids[2]);
  assert.equal((requested.row as Record<string, unknown>).itemRequested, true);
  assert.equal((requested.row as Record<string, unknown>).itemKind, 'review');
});

test('presence and process changes each publish one complete merged row matching a fresh snapshot', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const { discovery, fakes } = await projectHub(t, root, {}, { clock });
  const ui = await modelClient(t, discovery);
  const launch = await ui.request({ type: 'session.launch', name: 'worker', harness: 'claude-code', role: 'coordinator' });
  assert.equal(launch.ok, true, launch.error);
  const process = (launch.value as { process: HarnessProcessView }).process;
  const worker = await inProcessSpoke(t, { discover: true, cwd: root, name: 'worker', sessionId: process.sessionId, role: 'coordinator' });
  await worker.waitForPresence(['worker']);
  await ui.waitFor(f => f.type === 'session.row' && (f.row as { presence?: unknown } | null)?.presence != null);
  const compare = async (action: () => unknown, predicate: (row: Record<string, unknown>) => boolean) => {
    const mark = ui.frames.length;
    const changed = ui.waitFor(f => ui.frames.indexOf(f) >= mark && f.type === 'session.row' && f.key === process.sessionId && f.row !== null && predicate(f.row as Record<string, unknown>));
    await action();
    const delta = await changed;
    const snapshot = await modelClient(t, discovery);
    const rows = (snapshot.frames.find(f => f.type === 'snapshot' && f.domain === 'sessions')!.value as { rows: Array<Record<string, unknown>> }).rows;
    assert.deepEqual(delta.row, rows.find(row => row.key === process.sessionId));
    // The later snapshot and this ordered result fence completed publications.
    assert.equal((await ui.request({ type: 'hub.status' })).ok, true);
    assert.equal(ui.frames.slice(mark).filter(f => f.type === 'session.row' && f.key === process.sessionId).length, 1);
    return delta.row as Record<string, unknown>;
  };
  const presence = await compare(async () => {
    assert.equal((await worker.call<{ ok: boolean }>('status', { text: 'Inspecting rows' })).ok, true);
  }, row => (row.presence as { status: string }).status === 'Inspecting rows');
  assert.equal(presence.harness, 'claude-code');
  const changed = await compare(() => fakes['claude-code']!.model('worker', 'updated-model'), row => row.model === 'updated-model');
  assert.equal((changed.presence as { status: string }).status, 'Inspecting rows');
  const renamed = await compare(async () => {
    assert.equal((await worker.call<{ ok: boolean }>('rename', { name: 'renamed' })).ok, true);
  }, row => row.name === 'renamed');
  assert.equal(renamed.key, process.sessionId);
  const disconnected = await compare(() => worker.close(), row => row.presence === null);
  assert.equal(disconnected.launched, true);
});
