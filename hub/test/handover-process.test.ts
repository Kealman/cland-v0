// T3: a real busy harness receives mid-turn revocation and its next tool call is refused.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { clauseAnswered, connectUi, eventually, fakeClaude, spawnSpoke, nativeProjectHub as projectHub, tempProject, type ChannelEvent, type FrameClient, type Session } from './harness.ts';
import { onCleanup } from './process-cleanup.ts';

type Audit = { event: 'audit'; session: string; role: string | null; tool: string; args: Record<string, unknown>; outcome: string; permission?: string };

const NOTE = { goals_now: 'Ship T-1.', work_in_flight: 'T-1 importer, half done.', open_decisions: 'Closed issues: import or not.', waiting_on: 'The human, on the release date.' };

const isRole = (e: ChannelEvent) => e.params.meta?.kind === 'role';

const audits = async (root: string, ui: FrameClient): Promise<Audit[]> => {
  const flushed = await ui.request({ type: 'hub.status', flushLogs: true });
  assert.equal(flushed.ok, true, JSON.stringify(flushed));
  return (await readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8'))
    .split('\n')
    .filter((l) => l.includes('"event":"audit"'))
    .map((l) => JSON.parse(l) as Audit);
};

/** A hub notice in the Agents topic, as the subscribed UI sees it. */
const agentsNotice = (ui: FrameClient, text: RegExp | string) =>
  ui.waitFor((f) => {
    const m = f.message as { from?: string; topic?: string; text?: string } | undefined;
    return f.type === 'message' && m?.from === 'hub' && m.topic === 'agents' && (typeof text === 'string' ? m.text === text : text.test(m.text ?? ''));
  });

const coordinator = async (ui: FrameClient) => ((await ui.request({ type: 'hub.status' })).value as { coordinator: string | null }).coordinator;

async function setup(t: TestContext, env: Record<string, string> = {}) {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root, env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const spawn = async (name: string, role: string): Promise<Session> => {
    const s = await spawnSpoke({ discover: true, cwd: root, name, sessionId: `sess-${name}`, role });
    onCleanup(t, () => s.close());
    await s.waitForEvent((e) => isRole(e) && e.params.meta?.role === role, 30_000);
    return s;
  };
  return { root, ui, spawn };
}
test('revocation mid-turn: the human reassigns while the launched Coordinator is busy; its next call is refused and the revocation reaches it', async (t) => {
  // T3: the live harness must stay mid-turn until the human's reassignment is observed.
  const fake = await fakeClaude(t, { awaitSignals: true });
  const { root, ui, spawn } = await setup(t, fake.env);
  const launched = (await ui.request({ type: 'session.launch', name: 'coord', role: 'coordinator', model: 'claude-fake-1' }, 30_000)) as { ok: boolean; error?: string; value?: { process: { harnessId: string } } };
  assert.equal(launched.ok, true, launched.error);
  const job = launched.value?.process.harnessId as string;
  await clauseAnswered(ui, 'coord', 30_000);
  const b = await spawn('next', 'implementer');

  // Hold only this turn, after the initial role-clause answer.
  const hold = join(fake.home, 'jobs', `${job}.turn-hold`);
  await writeFile(hold, '');
  // a turn: the human asks the Coordinator; the fake waits at the barrier before `send`
  const asked = await ui.request({ type: 'topic.send', topic: 'general', text: 'Plan the week' });
  assert.equal(asked.ok, true, asked.error);
  const askedId = (asked.value as { message: { id: string } }).message.id;
  await eventually('the turn started', async () => ((await fake.log(job)).includes('submitted: <channel') && (await fake.log(job)).includes('Plan the week') ? true : undefined));
  const turnId = await eventually('the turn held', async () => /turn held: (\w+)/.exec(await fake.log(job))?.[1]);
  await ui.waitFor((f) => f.type === 'session.state' && f.session === 'coord' && f.state === 'busy');

  // mid-turn, the human hands the role to B with a note
  const moved = await ui.request({ type: 'role.set', session: 'next', role: 'coordinator', note: NOTE });
  assert.equal(moved.ok, true, moved.error);
  const clause = await b.waitForEvent((e) => isRole(e) && e.params.meta?.role === 'coordinator', 15_000);
  assert.equal(clause.params.meta?.handover_from, 'human');
  assert.equal(await coordinator(ui), 'next');

  await rm(hold);
  await eventually('the held turn released', async () => (await fake.log(job)).includes(`turn released: ${turnId}`) ? true : undefined);
  // the turn ends: A's answer (a `send` to the human) is refused, it no longer holds a role
  await eventually('the answer refused', async () => (/tool send → .*"code":"forbidden"/.test(await fake.log(job)) ? true : undefined), 20_000);
  assert.match(await fake.log(job), /tool send → .*"role":null,"reason":"a session with no role has no tools"/);
  await agentsNotice(ui, 'coord tried send to the human: forbidden (a session with no role has no tools)');
  const refused = (await audits(root, ui)).find((r) => r.session === 'coord' && r.tool === 'send' && r.outcome === 'forbidden' && r.args.replyTo === askedId);
  assert.equal(refused?.role, null);
  // and the revocation reached the session, injected as its next turn
  await eventually('the revocation injected', async () => (/submitted: <channel [^\n]*from="hub"[^\n]*>\ncland hub: coord no longer holds the role Coordinator \(handed over to next\)/.test(await fake.log(job)) ? true : undefined), 20_000);
  // the process table follows: the relaunch would start roleless
  const list = (await ui.request({ type: 'session.list' })).value as { processes: Array<{ name: string; role: string | null }>; coordinator: string | null };
  assert.deepEqual([list.processes.find((p) => p.name === 'coord')?.role, list.coordinator], [null, 'next']);
});
