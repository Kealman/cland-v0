// The Claude Code adapter's edges: the order of a session's signals, which launch a signal belongs to, deliveries
// that wait across a launch, a rename or an unconfirmed inject, resume under a reused pid, and a stop that fails.
// As in `claude-code-adapter.test.ts`: a real daemon, the fake Claude Code at the harness process boundary, the
// real `cland hook` processes, and a scripted UI on the daemon's socket. Nothing inside the hub is mocked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { withDiscoveredPid, CLI_ENTRY, FAKE_CLAUDE_DIR, clandWithEnv, clauseAnswered, connectUi, eventually, fakeClaude, killDaemon, pidAlive, sleep, spawnSpoke, startDaemon, tempProject, type FrameClient, NO_PS } from './harness.ts';

type Presence = { name: string; sessionId: string; state: string };
type Harness = { name: string; pid: number | null; harnessId: string | null; sessionId: string; harnessSessionId: string | null; status: string; state: string };
type Status = { sessions: Presence[]; harnesses: Harness[] };

async function status(ui: FrameClient): Promise<Status> {
  const r = await ui.request({ type: 'hub.status' });
  assert.equal(r.ok, true, r.error);
  return r.value as Status;
}

const harness = async (ui: FrameClient, name: string): Promise<Harness> => {
  const h = (await status(ui)).harnesses.find((x) => x.name === name);
  assert.ok(h, `no harness row ${name}`);
  return h;
};

async function launch(ui: FrameClient, name: string, extra: Record<string, unknown> = {}): Promise<Harness> {
  const r = await ui.request({ type: 'session.launch', name, ...extra }, 30_000);
  assert.equal(r.ok, true, r.error);
  return (r.value as { process: Harness }).process;
}

const presentAs = (ui: FrameClient, name: string, state: string) =>
  eventually(`${name} present as ${state}`, async () => ((await status(ui)).sessions.find((s) => s.name === name)?.state === state ? true : undefined));

const hubLog = (root: string) => readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8');

/** A launched session's first turn, its role clause, is over: answered, and a pushed busy then idle seen after
 *  `mark` (the turn's late signals can no longer move the state: a later idle outranks them). */
async function clauseTurnDone(ui: FrameClient, name: string, mark: number): Promise<void> {
  await clauseAnswered(ui, name);
  await eventually(`${name}: the clause turn's busy, then idle`, () => {
    const events = ui.frames.slice(mark).filter((f) => f.type === 'session.state' && f.session === name);
    const busy = events.findIndex((e) => e.state === 'busy' && e.source !== 'poll');
    return busy >= 0 && events.slice(busy + 1).some((e) => e.state === 'idle') ? true : undefined;
  });
  await presentAs(ui, name, 'idle');
}

/** The id of the role clause the hub recorded for `name` (the latest one). */
const clauseId = (root: string, name: string) =>
  eventually(`the clause of ${name} recorded`, async () => [...(await hubLog(root)).matchAll(new RegExp(`"event":"role-clause","session":"${name}"[^\\n]*"id":"([^"]+)"`, 'g'))].at(-1)?.[1]);

const sendGeneral = async (ui: FrameClient, text: string): Promise<string> => {
  const sent = await ui.request({ type: 'topic.send', topic: 'general', text });
  assert.equal(sent.ok, true, sent.error);
  return (sent.value as { message: { id: string } }).message.id;
};

const injected = (ui: FrameClient, id: string, timeoutMs = 15_000) => ui.waitFor((f) => f.type === 'delivery' && f.message === id && f.stage === 'injected', timeoutMs);

/**
 * One `cland hook <event>` as a harness runs it, the payload on stdin; `done` resolves when it exited (it waits for
 * the hub's answer). `slowStartMs` holds the process up before `cland` runs, as a loaded machine does; `started`
 * resolves once the process is running (its start time, the signal's time, is behind it), whatever the machine's load.
 */
function hook(root: string, event: string, o: { session: string; launch?: string; payload?: Record<string, unknown>; slowStartMs?: number }): { started: Promise<void>; done: Promise<void> } {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith('CLAND_')) env[k] = v;
  const MARK = 'cland-test-hook-started';
  env.NODE_OPTIONS = `--import=data:text/javascript,${encodeURIComponent(`process.stderr.write(${JSON.stringify(`${MARK}\n`)}); const t = Date.now(); while (Date.now() - t < ${o.slowStartMs ?? 0});`)}`;
  const args = [CLI_ENTRY, 'hook', event, '--session', o.session, ...(o.launch ? ['--launch', o.launch] : []), '--hub-file', join(root, '.cland', 'hub.json')];
  let markStarted!: () => void;
  const started = new Promise<void>((resolve) => (markStarted = resolve));
  const done = new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, env, stdio: ['pipe', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', (c: Buffer) => {
      err += String(c);
      if (err.includes(MARK)) markStarted();
      const rest = String(c).replace(`${MARK}\n`, '');
      if (rest) process.stderr.write(rest);
    });
    child.on('error', reject);
    child.on('close', () => {
      markStarted();
      resolve();
    });
    child.stdin.end(JSON.stringify(o.payload ?? {}));
  });
  return { started, done };
}

test('signal order is the order the harness fired them: a Stop whose hook process started slowly does not outrank the next turn start', async (t) => {
  const root = await tempProject(t);
  // Suppress fallback polls so delayed hook ordering alone controls the staged state.
  const fake = await fakeClaude(t, { pollMs: 10_000 });
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const mark = ui.frames.length;
  const launched = await launch(ui, 'coord', { role: 'coordinator' });
  await clauseTurnDone(ui, 'coord', mark);

  // the Stop of a turn fires first, but its process takes 1.5 s to start; the next turn's start fires after it
  const stop = hook(root, 'turn-end', { session: 'coord', launch: launched.sessionId, slowStartMs: 1500 });
  await stop.started; // the harness fired it: its process runs (and stalls)
  await sleep(150); // the gap between the two events the harness fired
  await hook(root, 'turn-start', { session: 'coord', launch: launched.sessionId }).done;
  await presentAs(ui, 'coord', 'busy');
  await stop.done;
  assert.equal((await harness(ui, 'coord')).state, 'busy', 'the older Stop arrived last and was dropped');
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  assert.match(await hubLog(root), /"event":"signal-stale","session":"coord","state":"idle","source":"hook"/);
});

test('late Claude start and StopFailure hooks keep failure notes with their own turn sender', async (t) => {
  const root = await tempProject(t);
  // Suppress fallback polls so delayed hook ordering alone controls the staged state.
  const fake = await fakeClaude(t, { pollMs: 600_000 });
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const mark = ui.frames.length;
  const launched = await launch(ui, 'coord', { role: 'coordinator' });
  await clauseTurnDone(ui, 'coord', mark);
  const a = await spawnSpoke({ cwd: root, discover: true, name: 'sender-a', role: 'implementer' });
  const b = await spawnSpoke({ cwd: root, discover: true, name: 'sender-b', role: 'reviewer' });
  t.after(async () => { await a.close(); await b.close(); });
  await a.waitForPresence(['sender-a']);
  await b.waitForPresence(['sender-b']);
  await a.call('send', { to: ['coord'], text: 'first turn' });
  await ui.waitFor((f) => f.type === 'message' && (f.message as { text: string }).text === 'pong: first turn');
  await presentAs(ui, 'coord', 'idle');
  await b.call('send', { to: ['coord'], text: 'second turn' });
  const first = await ui.waitFor((f) => f.type === 'message' && (f.message as { from: string; text: string }).from === 'sender-a');
  const second = await ui.waitFor((f) => f.type === 'message' && (f.message as { from: string; text: string }).from === 'sender-b');
  const firstId = (first.message as { id: string }).id;
  const secondId = (second.message as { id: string }).id;
  await eventually('both inputs answered', () => ui.frames.filter((f) => f.type === 'message' && (f.message as { from: string; text: string }).from === 'coord' && ['pong: first turn', 'pong: second turn'].includes((f.message as { text: string }).text)).length === 2 ? true : undefined);
  const at = Date.now() + 10_000;
  const signal = (event: string, payload: Record<string, unknown>) => hook(root, event, { session: 'coord', launch: launched.sessionId, payload }).done;
  await signal('turn-start', { at, prompt_id: 'first', ids: [firstId] });
  await signal('turn-start', { at: at + 2000, prompt_id: 'second', ids: [secondId] });
  await signal('turn-start', { at: at + 100, prompt_id: 'first', ids: [firstId] }); // A's older hook arrives after B's
  await signal('turn-end', { at: at + 1000, prompt_id: 'first', hook_event_name: 'StopFailure', error: 'server_error', error_details: 'first turn failed' });
  await a.waitForEvent((e) => e.params.content.includes('its turn failed: first turn failed'));
  assert.equal(b.events.some((e) => e.params.content.includes('its turn failed: first turn failed')), false);
  assert.equal((await harness(ui, 'coord')).state, 'busy', 'the older failure is reported without replacing the newer busy');
  await signal('turn-end', { at: at + 3000, prompt_id: 'second', hook_event_name: 'StopFailure', error: 'server_error', error_details: 'second turn failed' });
  await b.waitForEvent((e) => e.params.content.includes('its turn failed: second turn failed'));
  assert.equal(a.events.some((e) => e.params.content.includes('its turn failed: second turn failed')), false);

  await t.test('failure before its start hook reports immediately and later notifies the matching prompt sender', async () => {
    await signal('turn-start', { prompt_id: 'prior', ids: [firstId] });
    await signal('turn-end', { prompt_id: 'late-start', hook_event_name: 'StopFailure', error: 'failure before start' });
    await ui.waitFor((f) => f.type === 'message' && (f.message as { kind?: string; text: string }).kind === 'turn-failed' && (f.message as { text: string }).text.includes('failure before start'));
    assert.equal(a.events.some((e) => e.params.content.includes('its turn failed: failure before start')), false);
    assert.equal(b.events.some((e) => e.params.content.includes('its turn failed: failure before start')), false);
    await signal('turn-start', { prompt_id: 'late-start', ids: [secondId] });
    await b.waitForEvent((e) => e.params.content.includes('its turn failed: failure before start'));
    assert.equal(a.events.some((e) => e.params.content.includes('its turn failed: failure before start')), false);
  });

  await t.test('bounded prompt history discards unresolved old attribution without guessing', async () => {
    await signal('turn-end', { prompt_id: 'expired', hook_event_name: 'StopFailure', error: 'expired failure' });
    for (let i = 0; i < 128; i++) await ui.request({ type: 'session.signal', session: 'coord', launch: launched.sessionId, event: 'turn-start', payload: { prompt_id: `recent-${i}`, ids: [secondId] } });
    await signal('turn-start', { prompt_id: 'expired', ids: [firstId] });
    await signal('turn-end', { prompt_id: 'recent-127', hook_event_name: 'StopFailure', error: 'recent failure' });
    await b.waitForEvent((e) => e.params.content.includes('its turn failed: recent failure'));
    assert.equal(a.events.some((e) => e.params.content.includes('its turn failed: expired failure')), false);
  });
});

test('a signal from an earlier launch under the same name changes nothing of the process that replaced it', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  // the Coordinator: the fake answers its clause to the human, which only the Coordinator may (#30)
  const first = await launch(ui, 'impl-1', { role: 'coordinator', harness: 'claude-code' });
  await presentAs(ui, 'impl-1', 'idle');
  await killDaemon((await withDiscoveredPid(ui, first)).pid);
  await eventually('the first process gone', async () => ((await harness(ui, 'impl-1')).status === 'exited' ? true : undefined));

  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const mark = ui.frames.length;
  const second = await launch(ui, 'impl-1', { role: 'coordinator', harness: 'claude-code' });
  await clauseTurnDone(ui, 'impl-1', mark);
  const row = await harness(ui, 'impl-1');
  assert.equal(row.sessionId, second.sessionId);

  // the first launch's hooks, late: its own conversation id, a turn start
  await hook(root, 'session-start', { session: 'impl-1', launch: first.sessionId, payload: { session_id: first.harnessSessionId } }).done;
  await hook(root, 'turn-start', { session: 'impl-1', launch: first.sessionId, payload: { session_id: first.harnessSessionId } }).done;
  const after = await harness(ui, 'impl-1');
  assert.equal(after.harnessSessionId, row.harnessSessionId, "the replacement keeps its own conversation id");
  assert.equal(after.state, 'idle', 'and its own state');
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  assert.match(await hubLog(root), /"event":"signal-other-launch","session":"impl-1"/);
});

test('a late SessionStart does not revive a session whose process is gone', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const launched = await launch(ui, 'impl-1', { role: 'implementer', harness: 'claude-code' });
  await presentAs(ui, 'impl-1', 'idle');
  await killDaemon((await withDiscoveredPid(ui, launched)).pid);
  await eventually('the process gone', async () => ((await harness(ui, 'impl-1')).status === 'exited' ? true : undefined));

  await hook(root, 'session-start', { session: 'impl-1', launch: launched.sessionId, payload: { session_id: launched.harnessSessionId } }).done;
  const row = await harness(ui, 'impl-1');
  assert.equal(row.status, 'exited');
  assert.equal(row.state, 'unknown');
});

test("a message the spoke accepted during the launch is injected once the launch's early bridge and SessionStart are in", async (t) => {
  const root = await tempProject(t);
  // `--bg` returns only after the SessionStart hook ran and the mod's bridge was answered: both wait for the row
  const fake = await fakeClaude(t, { lateBg: 'bridged' });
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  // no coordinator yet: the message waits for the role, and the launching session's spoke takes it
  const id = await sendGeneral(ui, 'waiting for you');
  await launch(ui, 'coord', { role: 'coordinator' });
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  assert.match(await hubLog(root), /"event":"session-launched".*"early":1/, 'the early SessionStart was replayed');
  await injected(ui, id);
  await ui.waitFor((f) => f.type === 'message' && (f.message as { text: string }).text === 'pong: waiting for you', 15_000);
});

test('an idle that comes while an inject waits for its confirmation retries it once that inject gave up', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t, { injectTimeoutMs: 3000, dropFirst: true });
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  await launch(ui, 'coord', { role: 'coordinator' });
  await presentAs(ui, 'coord', 'idle');

  // the first prompt, the role clause, is dropped inside the harness: never confirmed, it waits 3 s
  const clause = await clauseId(root, 'coord');
  const second = await sendGeneral(ui, 'second'); // its turn ends idle while the clause still waits
  await injected(ui, second);
  // no other turn, no other trigger: the idle that came during the clause's wait is not lost
  await eventually('the clause injected', async () => ((await hubLog(root)).includes(`"event":"injected","id":"${clause}"`) ? true : undefined));
  await clauseAnswered(ui, 'coord');
});

test('a session renamed while a message waits for its inject still gets it, and its confirmation counts', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t, { injectTimeoutMs: 1000, dropFirst: true });
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  await launch(ui, 'coord', { role: 'coordinator' });
  await presentAs(ui, 'coord', 'idle');

  // the first prompt, the role clause, is dropped inside the harness: delivered, never injected
  const clause = await clauseId(root, 'coord');
  await eventually('the clause inject given up', async () => ((await hubLog(root)).includes(`"event":"inject-unconfirmed","session":"coord","id":"${clause}"`) ? true : undefined));
  const rename = await sendGeneral(ui, 'rename to pool-1'); // the session renames itself in this turn
  await injected(ui, rename);
  await presentAs(ui, 'pool-1', 'idle');
  // retried at the next idle under the new name, and its confirmation finds it
  await eventually('the clause injected', async () => ((await hubLog(root)).includes(`"event":"injected","id":"${clause}","session":"pool-1"`) ? true : undefined));
  await clauseAnswered(ui, 'pool-1');
});

test('resume never adopts another session that reuses the pid: no identity match, no resume', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const launched = await launch(ui, 'coord', { role: 'coordinator' });
  await presentAs(ui, 'coord', 'idle');
  const discovered = await withDiscoveredPid(ui, launched);
  ui.close();
  assert.equal((await clandWithEnv(root, fake.env, 'hub', 'stop')).code, 0);

  // the session dies while no hub runs, and its pid is taken by another session (the table is made to say so)
  await killDaemon(discovered.pid);
  await new Promise<void>((resolve) =>
    execFile(join(FAKE_CLAUDE_DIR, 'claude'), ['--bg', '--name', 'other'], { cwd: root, env: { ...process.env, ...fake.env } }, () => resolve()),
  );
  const other = (await fake.sessions()).find((s) => s.name === 'other');
  assert.ok(other && pidAlive(other.pid));
  const db = new DatabaseSync(join(root, '.cland', 'hub.db'));
  db.prepare('update harness_processes set pid = ? where name = ?').run(other.pid, 'coord');
  db.close();

  const second = await startDaemon(t, root, fake.env);
  const ui2 = await connectUi(t, second.discovery);
  const row = await eventually('coord not resumed', async () => {
    const h = (await status(ui2)).harnesses.find((x) => x.name === 'coord');
    return h?.status === 'exited' ? h : undefined;
  });
  assert.equal(row.state, 'unknown');
  assert.equal((await ui2.request({ type: 'hub.status', flushLogs: true })).ok, true);
  assert.doesNotMatch(await hubLog(root), /"event":"session-resumed","session":"coord"/);
  assert.ok(pidAlive(other.pid), 'the other session is left alone');
});

test('a stop whose `claude stop` fails falls back to SIGTERM and stops the session', { skip: NO_PS }, async (t) => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t, { stopCrash: true, stopGraceMs: 1000 });
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const launched = await launch(ui, 'coord', { role: 'coordinator' });
  await presentAs(ui, 'coord', 'idle');
  const discovered = await withDiscoveredPid(ui, launched);
  const r = await ui.request({ type: 'session.stop', session: 'coord' }, 15_000);
  assert.equal(r.ok, true, r.error);
  assert.equal((r.value as { process: Harness }).process.status, 'stopped');
  assert.ok(!pidAlive(discovered.pid));
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  assert.match(await hubLog(root), /"event":"harness-stop-failed","session":"coord"/);
  assert.doesNotMatch(await hubLog(root), /"event":"harness-exited"/, 'a stop is no crash');
});

test('stop kills a Claude Code process that ignores SIGTERM and waits for its exit', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t, { stopCrash: true, ignoreTerm: true, stopGraceMs: 500 });
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const launched = await launch(ui, 'coord', { role: 'coordinator' });
  await presentAs(ui, 'coord', 'idle');
  const discovered = await withDiscoveredPid(ui, launched);
  const r = await ui.request({ type: 'session.stop', session: 'coord' }, 15_000);
  assert.equal(r.ok, true, r.error);
  assert.equal((await harness(ui, 'coord')).status, 'stopped');
  assert.equal(pidAlive(discovered.pid), false, 'stop returns only after exit');
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  assert.match(await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8'), /"event":"harness-ended"/);
});
