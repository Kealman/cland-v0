import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withDiscoveredPid, assignRole, clandWithEnv, clauseAnswered, connectSocket, connectUi, connectWsUi, eventually, fakeClaude, fakeCodex, killDaemon, sleep, spawnSpoke, startDaemon, startHub, tempProject, TEST_SECRET, type FrameClient } from './harness.ts';
import { PROTOCOL_VERSION, type Message } from '../src/protocol.ts';
import { WebSocket } from 'ws';

const read = (path: string) => readFile(path, 'utf8').catch(() => '');
type Process = { pid: number; sessionId: string; harnessId: string; harnessSessionId: string };
const idle = (ui: FrameClient) => eventually('coord idle', async () => {
  const r = await ui.request({ type: 'hub.status' });
  return (r.value as { harnesses: Array<{ name: string; state: string }> }).harnesses.some(p => p.name === 'coord' && p.state === 'idle') ? true : undefined;
});

test('progress stays queued and reaches the spoke in one ordered digest with the next report', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const sender = await spawnSpoke({ cwd: root, discover: true, name: 'impl', sessionId: 'sender' });
  const receiver = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'receiver' });
  t.after(async () => { await sender.close(); await receiver.close(); });
  await sender.waitForPresence(['impl', 'coord']);
  await receiver.waitForPresence(['impl', 'coord']);
  const mark = receiver.events.length;
  for (const text of ['first note', 'second note', 'third note']) {
    const sent = await sender.call<{ ok: boolean; outcomes: Array<{ outcome: string }> }>('send', { to: ['coord'], text, kind: 'progress' });
    assert.equal(sent.ok, true);
    assert.equal(sent.outcomes[0]?.outcome, 'queued');
  }
  await sleep(150);
  assert.equal(receiver.events.slice(mark).length, 0, 'held progress emits no channel notification');
  assert.equal((await sender.call<{ ok: boolean }>('send', { to: ['coord'], text: 'bad kind', kind: 'typo' })).ok, false);
  await sender.call('send', { to: ['coord'], text: 'finished' });
  const digest = await receiver.waitForEvent(e => e.params.content.includes('finished'));
  assert.match(digest.params.content, /first note[\s\S]*second note[\s\S]*third note[\s\S]*finished/);
  assert.equal(receiver.events.slice(mark).length, 1);
  const messages = await eventually('progress digest acknowledged by the spoke', async () => {
    const history = await ui.request({ type: 'topic.history', topic: 'agents' });
    const messages = (history.value as { messages: Array<{ text: string; kind?: string; stage?: string }> }).messages;
    return ['first note', 'second note', 'third note', 'finished'].every(text => messages.some(m => m.text === text && m.stage === 'delivered')) ? messages : undefined;
  });
  assert.equal(messages.find(m => m.text === 'finished')?.kind, 'report');
  for (const text of ['first note', 'second note', 'third note']) assert.equal(messages.find(m => m.text === text)?.stage, 'delivered');
  for (const kind of ['question', 'decision']) {
    await sender.call('send', { to: ['coord'], text: kind, kind });
    await receiver.waitForEvent(e => e.params.content === kind);
  }
});

for (const harness of ['claude-code', 'codex', 'opencode']) {
  test(`${harness}: three progress notes start no turn, one ordered digest reaches the next report, including across restart`, async (t) => {
    const root = await tempProject(t);
    // Suppress fallback polls so progress delivery follows the staged pushed state.
    const fake = harness === 'claude-code' ? await fakeClaude(t, { pollMs: 10_000 }) : harness === 'codex' ? await fakeCodex(t, { pollMs: 10_000 }) : null;
    const home = fake?.home ?? join(root, '.fake-opencode');
    const env = fake?.env ?? {
      PATH: `${fileURLToPath(new URL('./fakes/opencode', import.meta.url))}:${process.env.PATH ?? ''}`,
      FAKE_OPENCODE_HOME: home, FAKE_OPENCODE_TURN_MS: '30', CLAND_ADAPTER_POLL_MS: '10000', CLAND_INJECT_TIMEOUT_MS: '5000',
    };
    const first = await startDaemon(t, root, env);
    let ui = await connectUi(t, first.discovery);
    await ui.request({ type: 'subscribe' });
    const launch = await ui.request({ type: 'session.launch', name: 'coord', role: 'coordinator', harness }, 30_000);
    assert.equal(launch.ok, true, launch.error);
    const p = await withDiscoveredPid(ui, (launch.value as { process: Process }).process);
    t.after(() => killDaemon(p.pid));
    const inputLog = () => read(harness === 'claude-code' ? join(home, 'jobs', `${p.harnessId}.log`) : harness === 'codex' ? join(home, 'log', `${p.pid}.log`) : join(home, 'prompts', `${p.harnessSessionId}.log`));
    if (harness !== 'codex') await clauseAnswered(ui, 'coord'); // Codex starts with a plain clause input, which the fake does not answer.
    await idle(ui);
    const sender = await spawnSpoke({ cwd: root, discover: true, name: 'impl', sessionId: 'sender' });
    t.after(() => sender.close());
    await sender.waitForPresence(['impl', 'coord']);
    for (const restart of [false, true]) {
      const notes = [1, 2, 3].map(i => `${restart ? 'durable' : 'initial'} progress ${i}`);
      for (const text of notes) await sender.call('send', { to: ['coord'], text, kind: 'progress' });
      await sleep(400);
      assert.equal((await inputLog()).includes(notes[0]!), false, 'no progress reaches the harness alone');
      if (restart) {
        ui.close();
        assert.equal((await clandWithEnv(root, env, 'hub', 'stop')).code, 0);
        const second = await startDaemon(t, root, env);
        ui = await connectUi(t, second.discovery);
        await ui.request({ type: 'subscribe' });
        await sender.waitForPresence(['impl', 'coord']);
        await eventually('session resumed', async () => (await read(join(root, '.cland', 'log', 'hub.log'))).includes('"event":"session-resumed","session":"coord"') ? true : undefined);
        await idle(ui);
        await sleep(400);
        assert.equal((await inputLog()).includes(notes[0]!), false, 'reconnect and role clauses leave progress held');
      }
      const report = `${restart ? 'durable' : 'initial'} report finished`;
      await sender.call('send', { to: ['coord'], text: report, kind: 'report' });
      const batch = await eventually('digest admitted by the harness', async () => {
        const log = await inputLog();
        const at = log.indexOf(`Progress digest (3 notes, oldest first):\n`);
        const start = restart ? log.indexOf(`Progress digest (3 notes, oldest first):\n`, at + 1) : at;
        return start >= 0 && log.slice(start).includes(report) ? log.slice(start) : undefined;
      });
      assert.ok(batch.indexOf(notes[0]!) < batch.indexOf(notes[1]!) && batch.indexOf(notes[1]!) < batch.indexOf(notes[2]!) && batch.indexOf(notes[2]!) < batch.indexOf(report), 'digest preserves send order before the report');
      const history = await eventually('all digest members injected', async () => {
        const r = await ui.request({ type: 'topic.history', topic: 'agents' });
        const messages = (r.value as { messages: Array<{ text: string; stage?: string }> }).messages;
        return [...notes, report].every(text => messages.some(m => m.text === text && m.stage === 'injected')) ? messages : undefined;
      });
      assert.equal(history.filter(m => m.text === report).length, 1);
      await idle(ui);
      const log = await inputLog();
      assert.equal(log.split('Progress digest (3 notes, oldest first):').length - 1, restart ? 2 : 1, 'one harness input per digest');
    }
    for (const kind of ['question', 'decision']) {
      const text = `${harness} ${kind} starts a turn`;
      await sender.call('send', { to: ['coord'], text, kind });
      await ui.waitFor(f => f.type === 'message' && (f.message as Message).text === `pong: ${text}`, 15_000);
      await idle(ui);
    }
    assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
    const journal = await read(join(root, '.cland', 'journal.jsonl'));
    assert.match(journal, /"event":"send"[^\n]*"kind":"progress"/);
    assert.match(journal, /"event":"send"[^\n]*"kind":"report"/);
  });
}

test('an unacked digest keeps its membership across reconnect while newer progress waits for another report', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  await assignRole(root, 'coord', 'coordinator');
  const connect = async () => {
    const socket = await connectSocket(discovery.socket);
    t.after(() => socket.close());
    socket.send({ type: 'hello', protocol: PROTOCOL_VERSION, secret: discovery.secret, sessionId: 'receiver', cwd: root, name: 'coord' });
    assert.equal((await socket.next()).type, 'welcome');
    const role = await socket.next();
    assert.equal(role.type, 'role');
    socket.send({ type: 'ack', id: (role.message as Message).id });
    return socket;
  };
  const first = await connect();
  const sender = await spawnSpoke({ cwd: root, discover: true, name: 'impl', sessionId: 'sender' });
  t.after(() => sender.close());
  await sender.waitForPresence(['coord', 'impl']);
  await sender.call('send', { to: ['coord'], text: 'earlier note', kind: 'progress' });
  await sender.call('send', { to: ['coord'], text: 'first report' });
  const original = (await first.next()).message as Message;
  assert.deepEqual(original.digest?.map(m => m.text), ['earlier note']);
  await sender.call('send', { to: ['coord'], text: 'later note', kind: 'progress' });
  first.close();
  await first.closed;
  const second = await connect();
  const repeated = (await second.next()).message as Message;
  assert.deepEqual(repeated, original, 'lost acknowledgement replays the exact input, never a growing digest');
  second.send({ type: 'ack', id: repeated.id });
  // Unknown kinds are refused by the hub itself, in addition to MCP validation.
  second.send({ type: 'send', id: 'bad-kind', to: ['impl'], text: 'bad', kind: 'typo' });
  assert.equal((await second.next()).ok, false);
  await sender.call('send', { to: ['coord'], text: 'second report' });
  const next = (await second.next()).message as Message;
  assert.equal(next.text, 'second report');
  assert.deepEqual(next.digest?.map(m => m.text), ['later note']);
});

test('an uncertain harness admission holds the whole digest; a later report cannot take it, and retry uses the same batch', async t => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t, { injectTimeoutMs: 1200 });
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await ui.request({ type: 'session.launch', name: 'coord', role: 'coordinator', harness: 'codex' }, 30_000);
  assert.equal(launched.ok, true);
  const p = (launched.value as { process: Process }).process;
  await idle(ui);
  const sender = await spawnSpoke({ cwd: root, discover: true, name: 'impl', sessionId: 'sender' });
  t.after(() => sender.close());
  await sender.waitForPresence(['coord', 'impl']);
  await sender.call('send', { to: ['coord'], text: 'please lose the answer', kind: 'progress' });
  await sender.call('send', { to: ['coord'], text: 'uncertain report' });
  await eventually('whole digest uncertain', async () => {
    const log = await read(join(root, '.cland', 'log', 'hub.log'));
    return log.split('"event":"inject-uncertain"').length - 1 === 2 ? true : undefined;
  });
  const r = await ui.request({ type: 'topic.history', topic: 'agents' });
  const messages = (r.value as { messages: Message[] }).messages;
  const report = messages.find(m => m.text === 'uncertain report')!;
  const note = messages.find(m => m.text === 'please lose the answer')!;
  await idle(ui);
  await sender.call('send', { to: ['coord'], text: 'new progress', kind: 'progress' });
  await sender.call('send', { to: ['coord'], text: 'new report' });
  await eventually('second digest taken', async () => (await fake.log(p.pid)).includes('new report') ? true : undefined);
  await idle(ui);
  assert.equal((await fake.log(p.pid)).split('Progress digest (1 notes, oldest first):').length - 1, 2, 'uncertain digest was never automatically replayed or folded into another report');
  const retried = await ui.request({ type: 'session.retry', session: 'coord', message: note.id });
  assert.equal(retried.ok, true, retried.error);
  for (const id of [note.id, report.id]) await ui.waitFor(f => f.type === 'delivery' && f.message === id && f.stage === 'injected', 15_000);
  assert.equal((await fake.log(p.pid)).split('Progress digest (1 notes, oldest first):').length - 1, 3, 'manual retry admitted exactly the original batch once more');
});

test('a report queued to a vacant role picks up its recipient\'s held progress when the recipient reconnects', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const sender = await spawnSpoke({ cwd: root, discover: true, name: 'impl', sessionId: 'sender' });
  const receiver = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'receiver' });
  t.after(() => sender.close());
  await sender.waitForPresence(['impl', 'coord']);
  await sender.call('send', { to: ['coord'], text: 'held before disconnect', kind: 'progress' });
  await receiver.close();
  await eventually('Coordinator disconnected', async () => {
    const r = await sender.call<{ sessions: Array<{ name: string }> }>('who');
    return r.sessions.some(s => s.name === 'coord') ? undefined : true;
  });
  const queued = await ui.request({ type: 'topic.send', topic: 'general', text: 'human report for vacant role', to: ['coordinator'] });
  assert.equal(queued.ok, true, queued.error);
  const reconnected = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'receiver' });
  t.after(() => reconnected.close());
  const delivery = await reconnected.waitForEvent(e => e.params.content.includes('human report for vacant role'));
  assert.match(delivery.params.content, /held before disconnect[\s\S]*human report for vacant role/);
});

test('expired held progress is dropped and journalled before a fresh report can bind it', async t => {
  let now = 2000;
  const log: Array<Record<string, unknown>> = [];
  const hub = await startHub({ now: () => new Date(now), queueTtlMs: 1000, log: e => { log.push(e); } });
  t.after(() => hub.close());
  const sender = await spawnSpoke({ hub, name: 'sender', sessionId: 'sender' });
  const receiver = await spawnSpoke({ hub, name: 'receiver', sessionId: 'receiver' });
  t.after(async () => { await sender.close(); await receiver.close(); });
  await sender.waitForPresence(['sender', 'receiver']);
  await sender.call('send', { to: ['receiver'], text: 'expired note', kind: 'progress' });
  now = 4000;
  await sender.call('send', { to: ['receiver'], text: 'fresh report' });
  const report = await receiver.waitForEvent(e => e.params.content.includes('fresh report'));
  assert.equal(report.params.content, 'fresh report');
  const ui = await connectWsUi(t, hub);
  const history = await ui.request({ type: 'topic.history', topic: 'agents' });
  const expired = (history.value as { messages: Array<Message & { stage?: string }> }).messages.find(m => m.text === 'expired note')!;
  assert.equal(expired.stage, 'dropped');
  assert.ok(log.some(e => e.event === 'dropped' && e.id === expired.id && e.reason === 'queue ttl'), 'the existing journalled dropped event records the expiry');
});

test('prune preserves every member of a pending digest, then expires the batch together at its trigger\'s TTL', async t => {
  let now = 2000;
  const hub = await startHub({ now: () => new Date(now), queueTtlMs: 1000, retentionMs: 100 });
  t.after(() => hub.close());
  const sender = await spawnSpoke({ hub, name: 'sender', sessionId: 'sender' });
  const receiver = await spawnSpoke({ hub, name: 'receiver', sessionId: 'receiver' });
  t.after(() => sender.close());
  await sender.waitForPresence(['sender', 'receiver']);
  await receiver.close();
  const ui = await connectWsUi(t, hub);
  await eventually('receiver offline', async () => {
    const r = await sender.call<{ sessions: Array<{ name: string }> }>('who');
    return r.sessions.some(s => s.name === 'receiver') ? undefined : true;
  });
  await sender.call('send', { to: ['receiver'], text: 'older batch note', kind: 'progress' });
  now = 2200;
  await sender.call('send', { to: ['receiver'], text: 'newer trigger' });
  now = 2400;
  assert.equal(hub.prune(), 0, 'retention cannot truncate a queued digest');
  let history = await ui.request({ type: 'topic.history', topic: 'agents' });
  assert.deepEqual((history.value as { messages: Message[] }).messages.map(m => m.text), ['older batch note', 'newer trigger']);
  now = 3001; // the note's original TTL passed, but its trigger is still within TTL
  assert.equal(hub.prune(), 0, 'a bound note follows the trigger lifetime');
  now = 3201;
  assert.equal(hub.prune(), 2, 'the whole expired batch is now eligible for retention');
  history = await ui.request({ type: 'topic.history', topic: 'agents' });
  assert.deepEqual((history.value as { messages: Message[] }).messages, []);
  const reconnected = await spawnSpoke({ hub, name: 'receiver', sessionId: 'receiver' });
  t.after(() => reconnected.close());
  await reconnected.waitForPresence(['sender', 'receiver']);
  await sleep(100);
  assert.equal(reconnected.events.length, 0, 'expiry never delivers a partial batch');
});

test('an old note bound near its TTL still delivers with a fresh trigger after the note\'s original expiry', async t => {
  let now = 2000;
  const hub = await startHub({ now: () => new Date(now), queueTtlMs: 1000, retentionMs: 100 });
  t.after(() => hub.close());
  const sender = await spawnSpoke({ hub, name: 'sender', sessionId: 'sender' });
  const receiver = await spawnSpoke({ hub, name: 'receiver', sessionId: 'receiver' });
  t.after(() => sender.close());
  await sender.waitForPresence(['sender', 'receiver']);
  await receiver.close();
  await eventually('receiver offline', async () => {
    const r = await sender.call<{ sessions: Array<{ name: string }> }>('who');
    return r.sessions.some(s => s.name === 'receiver') ? undefined : true;
  });
  await sender.call('send', { to: ['receiver'], text: 'near TTL note', kind: 'progress' });
  now = 2900;
  await sender.call('send', { to: ['receiver'], text: 'fresh trigger' });
  now = 3100;
  assert.equal(hub.prune(), 0);
  const reconnected = await spawnSpoke({ hub, name: 'receiver', sessionId: 'receiver' });
  t.after(() => reconnected.close());
  const batch = await reconnected.waitForEvent(e => e.params.content.includes('fresh trigger'));
  assert.match(batch.params.content, /near TTL note[\s\S]*fresh trigger/);
  assert.equal(reconnected.events.length, 1);
});

test('rename refuses a target with queued deliveries and preserves two differently bound copies of the same progress', async t => {
  const hub = await startHub();
  t.after(() => hub.close());
  const ui = await connectWsUi(t, hub);
  const sender = await spawnSpoke({ hub, name: 'sender', sessionId: 'sender' });
  const b = await spawnSpoke({ hub, name: 'b', sessionId: 'b' });
  t.after(() => sender.close());
  await b.waitForPresence(['b']);
  await b.close();
  const a = new WebSocket(hub.url, { headers: { authorization: `Bearer ${TEST_SECRET}` } });
  t.after(() => a.terminate());
  const frames: Array<Record<string, unknown>> = [];
  a.on('message', data => { frames.push(JSON.parse(data.toString())); });
  await new Promise<void>(resolve => a.once('open', resolve));
  a.send(JSON.stringify({ type: 'hello', protocol: PROTOCOL_VERSION, name: 'a', role: 'coordinator', sessionId: 'a', cwd: '/' }));
  await eventually('A welcomed', () => frames.some(f => f.type === 'welcome') ? true : undefined);
  await sender.waitForPresence(['sender', 'a']);
  await sender.call('send', { to: ['a', 'b'], text: 'shared P', kind: 'progress' });
  await sender.call('send', { to: ['a'], text: 'R1' });
  await sender.call('send', { to: ['b'], text: 'R2' });
  const first = await eventually('R1 sent without ack', () => frames.find(f => f.type === 'deliver')?.message as Message | undefined);
  assert.equal(first.text, 'R1');
  assert.deepEqual(first.digest?.map(m => m.text), ['shared P']);
  a.send(JSON.stringify({ type: 'rename', id: 'rename', name: 'b' }));
  const refusal = await eventually('rename refused', () => frames.find(f => f.type === 'result' && f.id === 'rename'));
  assert.equal(refusal.ok, false);
  assert.match(String(refusal.error), /"b".*2 unacknowledged/);
  a.send(JSON.stringify({ type: 'ack', id: first.id }));
  const restoredB = await spawnSpoke({ hub, name: 'b', sessionId: 'b' });
  t.after(() => restoredB.close());
  const second = await restoredB.waitForEvent(e => e.params.content.includes('R2'));
  assert.match(second.params.content, /shared P[\s\S]*R2/);
  assert.equal(second.params.content.includes('R1'), false);
  await eventually('both batches accepted', async () => {
    const history = await ui.request({ type: 'topic.history', topic: 'agents' });
    const messages = (history.value as { messages: Array<Message & { stage?: string }> }).messages;
    return ['shared P', 'R1', 'R2'].every(text => messages.some(m => m.text === text && m.stage === 'delivered')) ? true : undefined;
  });
  assert.equal(frames.filter(f => f.type === 'deliver').length, 1);
  assert.equal(restoredB.events.filter(e => e.params.content.includes('R2')).length, 1);
});
