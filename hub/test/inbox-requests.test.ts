// T3: native command approval receipt enters and leaves the inbox.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cland, connectUi, eventually, fakeClaude, nativeProjectHub as projectHub, spawnSpoke, tempProject } from './harness.ts';
import type { Inbox } from '../src/protocol.ts';

async function ok<T>(ui: Awaited<ReturnType<typeof connectUi>>, frame: { type: string } & Record<string, unknown>): Promise<T> {
  const result = await ui.request(frame);
  assert.equal(result.ok, true, `${frame.type}: ${result.error}`);
  return result.value as T;
}

test('asks and a fake harness command approval wait with ages, then journal each leave reason once', async t => {
  const root = await tempProject(t);
  // Keep pushed approval and idle states authoritative throughout the inbox assertions.
  const fake = await fakeClaude(t, { pollMs: 60_000, pushTrustMs: 120_000 });
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'sess-coord' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const a = await coord.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Answer?', options: [] });
  const topic = (await ok<{ topic: { id: string } }>(ui, { type: 'topic.create', title: 'Withdraw' })).topic.id;
  const b = await coord.call<{ ok: boolean; ask: string }>('ask', { topic, question: 'Withdraw?', options: [] });
  const cancelledTopic = (await ok<{ topic: { id: string } }>(ui, { type: 'topic.create', title: 'Cancel' })).topic.id;
  const c = await coord.call<{ ok: boolean; ask: string }>('ask', { topic: cancelledTopic, question: 'Cancel?', options: [] });
  assert.ok(a.ok && b.ok && c.ok);
  await ok(ui, { type: 'session.launch', name: 'worker', role: 'implementer', harness: 'claude-code' });
  await eventually('worker idle', async () => {
    const status = await ok<{ sessions: Array<{ name: string; state: string }> }>(ui, { type: 'hub.status' });
    return status.sessions.some(s => s.name === 'worker' && s.state === 'idle') || undefined;
  });
  await ok(ui, { type: 'session.signal', session: 'worker', event: 'permission', at: Date.now(), payload: { tool_name: 'Bash', approvalCommand: 'git status' } });
  const before = await ok<Inbox>(ui, { type: 'inbox.list' });
  assert.equal(before.needsYou, 4);
  assert.deepEqual(before.asks.map(row => row.id), [c.ask, b.ask, a.ask]);
  assert.ok(before.asks.every(row => Date.parse(row.ts)));
  assert.equal(before.approvals[0]?.command, 'git status');
  assert.ok(Date.parse(before.approvals[0]!.since));
  await ok(ui, { type: 'topic.answer', ask: a.ask, text: 'Yes' });
  await ok(ui, { type: 'topic.resolve', topic });
  await ok(ui, { type: 'topic.close', topic: cancelledTopic });
  await ok(ui, { type: 'session.signal', session: 'worker', event: 'tool-done', at: Date.now(), payload: {} });
  assert.equal((await ok<Inbox>(ui, { type: 'inbox.list' })).needsYou, 0);
  // A repeated snapshot must not write a second departure.
  const archive = await ok<Inbox>(ui, { type: 'inbox.list', archive: true });
  assert.equal(archive.archive?.find(r => r.kind === 'approval')?.text, 'git status', 'the archive retains the command after approval metadata is cleared');
  await ok(ui, { type: 'hub.status', flushLogs: true });
  const records = (await cland(root, 'hub', 'journal', '--json')).stdout.trim().split('\n').map(line => JSON.parse(line) as { event: string; kind: string; reason: string });
  assert.deepEqual(records.filter(r => r.event === 'inbox-departure').map(r => `${r.kind}:${r.reason}`).sort(), ['approval:answered', 'ask:answered', 'ask:cancelled', 'ask:withdrawn']);
});
