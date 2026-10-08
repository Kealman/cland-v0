// The Agents topic as the record, the journal and hygiene (spec 4.2 and 4.5, #34): a real hub daemon in a temporary
// project, scripted spokes over MCP, a UI client speaking the frames, `cland` as its own process, restarts through
// `cland hub stop` and `start`. Nothing inside the hub is reached into.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, clandWithEnv, clauseAnswered, connectUi, eventually, fakeClaude, spawnSpoke, startDaemon, startHub, tempProject, type FrameClient, type Session } from './harness.ts';

type Message = { id: string; topic: string; from: string; fromKind: string; fromRole?: string; to: string[]; text: string; ts: string; replyTo?: string; kind?: string; detail?: Record<string, unknown> };
type Refusal = { code: string; rule: string; until?: string };
type Outcome = { to: string; outcome: string; reason?: string; refusal?: Refusal };
type Send = { ok: boolean; error?: string; refusal?: Refusal; outcomes?: Outcome[] };

/** The kinds a lifecycle notice in Agents may carry; nothing else from the hub ever lands there. */
const LIFECYCLE = new Set(['session-start', 'session-stop', 'session-death', 'role-assign', 'role-revoke', 'claim', 'release', 'handover', 'mute', 'unmute', 'refusal']);

async function ok<T>(ui: FrameClient, frame: { type: string } & Record<string, unknown>): Promise<T> {
  const r = await ui.request(frame, 15_000);
  assert.equal(r.ok, true, `${frame.type}: ${r.error}`);
  return r.value as T;
}

const history = async (ui: FrameClient, topic: string) => (await ok<{ messages: Message[] }>(ui, { type: 'topic.history', topic, limit: 200 })).messages;

async function spoke(t: TestContext, root: string, name: string, role: string): Promise<Session> {
  const s = await spawnSpoke({ discover: true, cwd: root, name, sessionId: `sess-${name}`, role });
  t.after(() => s.close());
  return s;
}

async function writeConfig(root: string, hygiene: Record<string, number>): Promise<void> {
  await mkdir(join(root, '.cland'), { recursive: true });
  const lines = Object.entries(hygiene).map(([k, v]) => `${k} = ${v}`);
  await writeFile(join(root, '.cland', 'config.toml'), `[project]\nname = "journal-test"\n\n[hygiene]\n${lines.join('\n')}\n`);
}

/** Every line of the journal, each parsed (a line that does not parse fails the test). */
async function journalLines(root: string): Promise<Array<Record<string, unknown> & { ts: string; event: string }>> {
  const text = await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8');
  assert.ok(text.endsWith('\n'), 'every record is a whole line');
  return text
    .split('\n')
    .filter((l) => l !== '')
    .map((l, i) => {
      try {
        return JSON.parse(l) as Record<string, unknown> & { ts: string; event: string };
      } catch {
        throw new Error(`journal line ${i + 1} is not JSON: ${l}`);
      }
    });
}

async function restart(t: TestContext, root: string): Promise<FrameClient> {
  const stopped = await cland(root, 'hub', 'stop');
  assert.equal(stopped.code, 0, stopped.stderr);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  await ok(ui, { type: 'subscribe' });
  return ui;
}

test('agent-to-agent messages are recorded in Agents with sender, role and time, General shows nothing of them, and a reply in Agents addresses the sender', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const alpha = await spoke(t, root, 'alpha', 'implementer');
  const beta = await spoke(t, root, 'beta', 'reviewer');
  await alpha.waitForPresence(['alpha', 'beta']);
  const ui = await connectUi(t, discovery);
  await ok(ui, { type: 'subscribe' });

  const sent = await alpha.call<Send>('send', { to: ['beta'], text: 'T-1 is ready for review' });
  assert.equal(sent.outcomes?.[0]?.outcome, 'delivered', JSON.stringify(sent));
  const event = await ui.waitFor((f) => f.type === 'message' && (f.message as Message).text === 'T-1 is ready for review');
  assert.equal((event.topic as { id: string }).id, 'agents');
  const first = event.message as Message;
  assert.equal(first.from, 'alpha');
  assert.equal(first.fromRole, 'implementer');
  assert.ok(!Number.isNaN(Date.parse(first.ts)), first.ts);
  assert.deepEqual(first.to, ['beta']);
  assert.equal((await beta.call<Send>('send', { to: ['alpha'], text: 'on it', reply_to: first.id })).ok, true);

  const agents = await eventually('both messages in Agents', async () => {
    const m = await history(ui, 'agents');
    return m.filter((x) => x.fromKind === 'agent').length === 2 ? m : undefined;
  });
  const exchanged = agents.filter((m) => m.fromKind === 'agent');
  assert.deepEqual(
    exchanged.map((m) => [m.from, m.fromRole, m.to.join(','), m.text]),
    [
      ['alpha', 'implementer', 'beta', 'T-1 is ready for review'],
      ['beta', 'reviewer', 'alpha', 'on it'],
    ],
  );
  // the human's own topics show nothing of it
  assert.deepEqual(await history(ui, 'general'), []);
  for (const f of ui.frames) if (f.type === 'message') assert.equal((f.topic as { id: string }).id, 'agents', JSON.stringify(f));

  // the human writes into Agents only as a reply, which addresses the sender of the message replied to
  const plain = await ui.request({ type: 'topic.send', topic: 'agents', text: 'hello agents' });
  assert.equal(plain.ok, false);
  assert.match(plain.error ?? '', /read-only/);
  const reply = await ok<{ message: Message; outcomes: Outcome[] }>(ui, { type: 'topic.send', topic: 'agents', text: 'keep it small, please', replyTo: first.id });
  assert.deepEqual(reply.message.to, ['alpha']);
  assert.equal(reply.message.replyTo, first.id);
  assert.equal(reply.message.topic, 'agents');
  assert.deepEqual(reply.outcomes.map((o) => `${o.to}:${o.outcome}`), ['alpha:delivered']);
  const got = await alpha.waitForEvent((e) => e.params.content === 'keep it small, please');
  assert.equal(got.params.meta?.from, 'human');
  assert.equal(got.params.meta?.topic, 'agents');
  assert.equal(beta.events.some((e) => e.params.content === 'keep it small, please'), false, 'only the sender is addressed');
  // a hub notice has no sender to answer
  const notice = (await history(ui, 'agents')).find((m) => m.fromKind === 'hub');
  assert.ok(notice, 'the role assignments are recorded as notices');
  const toNotice = await ui.request({ type: 'topic.send', topic: 'agents', text: 'who are you?', replyTo: notice.id });
  assert.equal(toNotice.ok, false);
  assert.match(toNotice.error ?? '', /no sender to answer/);
});

test('lifecycle events land in Agents as notices with kinds — role assignment and revocation, a claim and its release, a session start and stop — and no tool-level noise does', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ok(ui, { type: 'subscribe' });
  const alpha = await spoke(t, root, 'alpha', 'implementer');
  await alpha.waitForPresence(['alpha']);

  // a role that may claim any item under #30's permission table
  await ok(ui, { type: 'role.set', session: 'alpha', role: 'coordinator' });
  assert.equal((await clandWithEnv(root, fake.env, 'task', 'create', 'Journal the hub')).code, 0);
  assert.equal((await alpha.call<{ ok: boolean }>('task.claim', { id: 'T-1' })).ok, true);
  assert.equal((await alpha.call<{ ok: boolean }>('task.claim', { id: 'T-1', release: true })).ok, true);
  await ok(ui, { type: 'role.clear', session: 'alpha' });

  const launched = await ui.request({ type: 'session.launch', name: 'coord-1', role: 'coordinator' }, 30_000);
  assert.equal(launched.ok, true, launched.error);
  await clauseAnswered(ui, 'coord-1');
  assert.equal((await ui.request({ type: 'session.stop', session: 'coord-1' }, 15_000)).ok, true);

  const notices = await eventually('the notices in Agents', async () => {
    const n = (await history(ui, 'agents')).filter((m) => m.fromKind === 'hub');
    return n.some((m) => m.kind === 'session-stop') ? n : undefined;
  });
  const kinds = notices.map((m) => m.kind);
  for (const kind of ['role-assign', 'claim', 'release', 'role-revoke', 'session-start', 'session-stop']) assert.ok(kinds.includes(kind), `${kind} in ${kinds.join(', ')}`);
  const text = (kind: string, match: RegExp) => assert.ok(notices.some((m) => m.kind === kind && match.test(m.text)), `${kind} ~ ${match}: ${JSON.stringify(notices.map((m) => [m.kind, m.text]))}`);
  text('role-assign', /^alpha assigned Coordinator \(was Implementer\)$/);
  text('claim', /^alpha \[Coordinator\] claimed T-1$/);
  text('release', /^T-1 released \(held by alpha\)$/);
  text('role-revoke', /^alpha no longer holds Coordinator: revoked by the human$/);
  text('session-start', /^coord-1 \[Coordinator\] started \(claude-code/);
  text('session-stop', /^coord-1( \[Coordinator\])? stopped$/);
  text('role-assign', /^coord-1 took Coordinator at launch/);
  // every hub message in Agents is a lifecycle notice; the session's states, its hooks, the acks and the injections
  // that happened all along (the clause turn, the stop) are not
  for (const m of notices) assert.ok(m.kind !== undefined && LIFECYCLE.has(m.kind), `not a lifecycle kind: ${JSON.stringify(m)}`);
  assert.ok(notices.every((m) => m.to.length === 0), 'a lifecycle notice is for reading: it addresses nobody');
  // a notice is shown to the UI as it happens
  assert.ok(ui.frames.some((f) => f.type === 'message' && (f.message as Message).kind === 'claim'));
  // #30's audit records go through the log closure, so the journal has them: the spoke's claim and the UI's role.set
  const audits = await eventually('audit records in the journal', async () => {
    const a = (await journalLines(root)).filter((l) => l.event === 'audit');
    return a.some((l) => l.session === 'alpha' && l.tool === 'task.claim') && a.some((l) => l.session === 'human' && l.tool === 'role.set') ? a : undefined;
  });
  assert.ok(audits.every((l) => l.outcome === 'ok' || l.outcome === 'forbidden' || l.outcome === 'error'), JSON.stringify(audits));
});

test('a looping pair trips the breaker at the configured threshold: both get the typed refusal, Agents shows the mute, it survives a restart until `cland hub unmute`; a changed threshold applies at the next start; the journal only grows', async (t) => {
  const root = await tempProject(t);
  await writeConfig(root, { loop_breaker_max: 3, loop_breaker_window_minutes: 5, loop_breaker_mute_minutes: 10, rate_limit_max: 100 });
  const { discovery } = await startDaemon(t, root);
  let ui = await connectUi(t, discovery);
  await ok(ui, { type: 'subscribe' });
  const alpha = await spoke(t, root, 'alpha', 'implementer');
  const beta = await spoke(t, root, 'beta', 'reviewer');
  await alpha.waitForPresence(['alpha', 'beta']);
  const firstLines = await journalLines(root);
  assert.equal(firstLines[0]?.event, 'hub-started');

  const say = (from: Session, to: string, text: string) => from.call<Send>('send', { to: [to], text });
  for (const [i, [from, to]] of ([[alpha, 'beta'], [beta, 'alpha'], [alpha, 'beta']] as const).entries()) {
    const r = await say(from, to, `thanks ${i}`);
    assert.equal(r.outcomes?.[0]?.outcome, 'delivered', `message ${i}: ${JSON.stringify(r)}`);
  }
  const tripped = await say(beta, 'alpha', 'no, thank you');
  const refusal = tripped.outcomes?.[0];
  assert.equal(refusal?.outcome, 'refused', JSON.stringify(tripped));
  assert.match(refusal?.reason ?? '', /^loop breaker: beta ↔ alpha exchanged more than 3 messages in 5 min/);
  assert.equal(refusal?.refusal?.code, 'hygiene');
  assert.equal(refusal?.refusal?.rule, 'loop');
  const until = refusal?.refusal?.until as string;
  assert.ok(Date.parse(until) > Date.now() + 9 * 60_000, until);
  // both parties hear of it, typed
  for (const s of [alpha, beta]) {
    const e = await s.waitForEvent((x) => x.params.meta?.kind === 'mute');
    const detail = JSON.parse(e.params.meta?.detail ?? '{}') as Refusal & { pair: string[] };
    assert.deepEqual({ code: detail.code, rule: detail.rule, until: detail.until, pair: detail.pair }, { code: 'hygiene', rule: 'loop', until, pair: ['alpha', 'beta'] });
  }
  // and Agents shows the mute
  const mute = (await history(ui, 'agents')).find((m) => m.kind === 'mute');
  assert.ok(mute, 'the mute is in Agents');
  assert.match(mute.text, /^alpha \[Implementer\] ↔ beta \[Reviewer\] muted: .*cland hub unmute alpha beta/);
  assert.equal((await say(alpha, 'beta', 'one more')).outcomes?.[0]?.outcome, 'refused', 'both directions');

  // the mute survives a restart
  ui = await restart(t, root);
  await alpha.waitForPresence(['alpha', 'beta']);
  const afterRestart = await say(alpha, 'beta', 'still there?');
  assert.equal(afterRestart.outcomes?.[0]?.outcome, 'refused', JSON.stringify(afterRestart));
  assert.equal(afterRestart.outcomes?.[0]?.refusal?.until, until, 'the same mute, not a new one');

  // until a person lifts it
  const lifted = await cland(root, 'hub', 'unmute', 'alpha', 'beta');
  assert.equal(lifted.code, 0, lifted.stderr);
  assert.match(lifted.stdout, /^unmuted alpha ↔ beta/);
  assert.equal((await say(alpha, 'beta', 'back to work')).outcomes?.[0]?.outcome, 'delivered');
  await eventually('the unmute in Agents', async () => ((await history(ui, 'agents')).some((m) => m.kind === 'unmute') ? true : undefined));
  const again = await ok<{ lifted: boolean }>(ui, { type: 'hygiene.unmute', a: 'alpha', b: 'beta' });
  assert.equal(again.lifted, false, 'nothing left to lift');

  // a lower threshold in config.toml applies at the next start (the pair's count, one message since the UI's unmute
  // cleared it, is persisted too)
  await writeConfig(root, { loop_breaker_max: 1, loop_breaker_window_minutes: 5, loop_breaker_mute_minutes: 10, rate_limit_max: 100 });
  assert.equal((await say(beta, 'alpha', 'before the restart')).outcomes?.[0]?.outcome, 'delivered', 'the running hub keeps the threshold it started with');
  ui = await restart(t, root);
  await alpha.waitForPresence(['alpha', 'beta']);
  const second = await say(alpha, 'beta', 'over the new threshold');
  assert.equal(second.outcomes?.[0]?.outcome, 'refused', JSON.stringify(second));
  assert.match(second.outcomes?.[0]?.reason ?? '', /more than 1 messages in 5 min/);

  // the journal: every line JSON, append-only across the restarts, every event of the run
  const lines = await journalLines(root);
  assert.ok(lines.length > firstLines.length);
  assert.deepEqual(lines.slice(0, firstLines.length), firstLines, 'the earlier lines survive as they were');
  assert.equal(lines.filter((l) => l.event === 'hub-started').length, 3);
  assert.equal(lines.filter((l) => l.event === 'hub-stopped').length, 2);
  for (const event of ['config-loaded', 'hello', 'send', 'acked', 'role-assigned', 'loop-breaker', 'unmuted', 'send-refused']) assert.ok(lines.some((l) => l.event === event), `${event} journalled`);
  const sends = lines.filter((l) => l.event === 'send');
  assert.ok(sends.every((l) => typeof l.id === 'string' && typeof l.bytes === 'number' && Array.isArray(l.to) && !('text' in l)), 'messages are journalled as metadata, never their text');
  assert.ok(!lines.some((l) => JSON.stringify(l).includes('back to work')));
  for (const l of lines) assert.ok(!Number.isNaN(Date.parse(l.ts)), JSON.stringify(l));
  // `cland hub journal` reads it, filtered
  const read = await cland(root, 'hub', 'journal', '--kind', 'loop-breaker,unmuted', '--json');
  assert.equal(read.code, 0, read.stderr);
  const filtered = read.stdout.trim().split('\n').map((l) => JSON.parse(l) as { event: string });
  assert.ok(filtered.length >= 3 && filtered.every((r) => r.event === 'loop-breaker' || r.event === 'unmuted'), read.stdout);
  const human = await cland(root, 'hub', 'journal', '--since', '1h', '--kind', 'hub-started');
  assert.equal(human.stdout.trim().split('\n').length, 3, human.stdout);
  assert.match(human.stdout, /^\S+ {2}hub-started {2}pid=\d+/);
});

test('hygiene refusals are typed: the size cap and the rate limit refuse the send itself, with code, rule and reason', async (t) => {
  const hub = await startHub({ rateLimit: { max: 1, windowMs: 60_000 }, maxTextBytes: 64 });
  t.after(() => hub.close());
  const alpha = await spawnSpoke({ hub, name: 'alpha', sessionId: 'sess-a' });
  t.after(() => alpha.close());
  const beta = await spawnSpoke({ hub, name: 'beta', sessionId: 'sess-b' });
  t.after(() => beta.close());
  await alpha.waitForPresence(['alpha', 'beta']);
  const big = await alpha.call<Send>('send', { to: ['beta'], text: 'x'.repeat(65) });
  assert.equal(big.ok, false);
  assert.deepEqual(big.refusal, { code: 'hygiene', rule: 'size' });
  assert.equal((await alpha.call<Send>('send', { to: ['beta'], text: 'one' })).ok, true);
  const chatty = await alpha.call<Send>('send', { to: ['beta'], text: 'two' });
  assert.equal(chatty.ok, false);
  assert.match(chatty.error ?? '', /^rate limit: 1 messages in 1 min/);
  assert.deepEqual(chatty.refusal, { code: 'hygiene', rule: 'rate' });
});
