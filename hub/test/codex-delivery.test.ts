// The Codex adapter's delivery edge cases (Codex review of #26): an inject whose answer never came is `uncertain` and
// never replayed on its own (only the human's `session.retry` sends it again); a connection to the app-server that
// was lost and came back retries what failed meanwhile, whatever the state; the launch's effort reaches the
// app-server. Against a real daemon with the fake Codex (`test/fakes/codex`) and the UI on the Unix socket.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { clandWithEnv, connectUi, eventually, fakeCodex, sleep, startDaemon, tempProject, type FrameClient } from './harness.ts';

type Harness = { name: string; pid: number | null; state: string };
type Notification = { kind: string; text: string; session?: string };

const hubLog = (root: string) => readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8');

async function launch(ui: FrameClient, name: string, extra: Record<string, unknown> = {}): Promise<Harness> {
  const r = await ui.request({ type: 'session.launch', name, harness: 'codex', ...extra }, 30_000);
  assert.equal(r.ok, true, r.error);
  return (r.value as { process: Harness }).process;
}

const idle = (ui: FrameClient, name: string) =>
  eventually(`${name} idle`, async () => {
    const s = ((await ui.request({ type: 'hub.status' })).value as { sessions: Array<{ name: string; state: string }> }).sessions.find((x) => x.name === name);
    return s?.state === 'idle' ? s : undefined;
  });

async function send(ui: FrameClient, text: string, to: string): Promise<string> {
  const r = await ui.request({ type: 'topic.send', topic: 'general', text, to: [to] });
  assert.equal(r.ok, true, r.error);
  return (r.value as { message: { id: string } }).message.id;
}

const pongs = (ui: FrameClient, text: string) => ui.frames.filter((f) => f.type === 'message' && (f.message as { text: string }).text === `pong: ${text}`).length;

test('an inject whose answer never came is uncertain: never replayed at the next idle, noted in the inbox, sent again only by session.retry', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t, { injectTimeoutMs: 1500 });
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const coord = await launch(ui, 'coord', { role: 'coordinator' });
  await idle(ui, 'coord');

  const text = 'please lose the answer';
  const id = await send(ui, text, 'coord');
  // the turn runs (its pong comes back) but turn/start's result never does
  await ui.waitFor((f) => f.type === 'message' && (f.message as { text: string }).text === `pong: ${text}`, 15_000);
  await eventually('uncertain', async () => ((await hubLog(root)).includes(`"event":"inject-uncertain","id":"${id}"`) ? true : undefined));
  // the session went idle after the turn: nothing is replayed
  await idle(ui, 'coord');
  await sleep(1500);
  assert.equal(pongs(ui, text), 1, 'the message ran once');
  assert.equal(((await fake.log(coord.pid as number)).match(/item: <channel [^\n]*>\nplease lose the answer/g) ?? []).length, 1);
  assert.ok(!ui.frames.some((f) => f.type === 'delivery' && f.message === id && f.stage === 'injected'));
  const inbox = (await ui.request({ type: 'inbox.list' })).value as { notifications: Notification[] };
  const note = inbox.notifications.find((n) => n.kind === 'delivery-uncertain');
  assert.ok(note, JSON.stringify(inbox.notifications));
  assert.equal(note.session, 'coord');
  assert.match(note.text, new RegExp(`cland session retry coord ${id}`));

  // the human decides to send it again, through the CLI
  const retried = await clandWithEnv(root, fake.env, 'session', 'retry', 'coord', id);
  assert.equal(retried.code, 0, retried.stderr);
  await ui.waitFor((f) => f.type === 'delivery' && f.message === id && f.stage === 'injected', 15_000);
  await eventually('a second pong', () => (pongs(ui, text) === 2 ? true : undefined));
  // a message that is not uncertain is refused
  const again = await ui.request({ type: 'session.retry', session: 'coord', message: id });
  assert.equal(again.ok, false);
  assert.match(again.error ?? '', /no uncertain delivery/);
});

test('a lost connection to an idle app-server: what failed to inject meanwhile is retried when the connection is back', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t, { env: { FAKE_CODEX_REFUSE_MS: '2500' } });
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const coord = await launch(ui, 'coord', { role: 'coordinator' });
  await idle(ui, 'coord');

  process.kill(coord.pid as number, 'SIGUSR2');
  await eventually('the hub lost the connection', async () => ((await hubLog(root)).includes('"event":"harness-reconnect-failed"') ? true : undefined));
  const id = await send(ui, 'are you there', 'coord');
  await eventually('the inject failed', async () => ((await hubLog(root)).includes(`"event":"inject-unconfirmed","session":"coord","id":"${id}"`) ? true : undefined));
  // the connection comes back; the session was idle and stays idle: no transition, and still the message goes in
  await ui.waitFor((f) => f.type === 'delivery' && f.message === id && f.stage === 'injected', 15_000);
  await ui.waitFor((f) => f.type === 'message' && (f.message as { text: string }).text === 'pong: are you there', 15_000);
});

test("the launch's effort reaches the app-server with the first turn", async (t) => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  // Reviewer's launch defaults: codex, effort high
  const rev = await launch(ui, 'rev-1', { role: 'reviewer' });
  await idle(ui, 'rev-1');
  assert.match(await fake.log(rev.pid as number), /turn\/start input effort=high/);
  const given = await launch(ui, 'impl-1', { role: 'implementer', effort: 'low' });
  await idle(ui, 'impl-1');
  assert.match(await fake.log(given.pid as number), /turn\/start input effort=low/);
});

for (const [what, text] of [
  ['an answer that is not JSON', 'please garble the answer'],
  ['a connection dropped instead of the answer', 'please drop the connection'],
] as const) {
  test(`${what} after turn/start was accepted is uncertain: the turn is never replayed`, async (t) => {
    const root = await tempProject(t);
    const fake = await fakeCodex(t, { env: { FAKE_CODEX_REFUSE_MS: '300' } });
    const { discovery } = await startDaemon(t, root, fake.env);
    const ui = await connectUi(t, discovery);
    assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
    const coord = await launch(ui, 'coord', { role: 'coordinator' });
    await idle(ui, 'coord');

    const id = await send(ui, text, 'coord');
    await ui.waitFor((f) => f.type === 'message' && (f.message as { text: string }).text === `pong: ${text}`, 15_000);
    await eventually('uncertain', async () => ((await hubLog(root)).includes(`"event":"inject-uncertain","id":"${id}"`) ? true : undefined));
    // the connection is back and the session idle: nothing is replayed
    await idle(ui, 'coord');
    await sleep(1500);
    assert.equal(pongs(ui, text), 1, 'the message ran once');
    assert.equal(((await fake.log(coord.pid as number)).match(new RegExp(`item: <channel [^\\n]*>\\n${text}`, 'g')) ?? []).length, 1);
    assert.ok(!ui.frames.some((f) => f.type === 'delivery' && f.message === id && f.stage === 'injected'));
  });
}


test('a shared artifact injected into Codex names its id and durable path in the envelope', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const coord = await launch(ui, 'coord', { role: 'coordinator' });
  await idle(ui, 'coord');
  const result = await ui.request({ type: 'artifact.create', kind: 'note', title: 'Review note', content: 'Findings', topic: 'general' });
  assert.equal(result.ok, true, result.error);
  const a = (result.value as { artifact: { id: string; path: string } }).artifact;
  await eventually('artifact envelope in Codex', async () => {
    const log = await fake.log(coord.pid as number);
    return log.includes(`artifact_id="${a.id}"`) && log.includes(`artifact_path="${a.path}"`) ? true : undefined;
  });
});
