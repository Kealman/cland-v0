// T3: one Claude Code process/spoke frame proof confirms native ordered digest consumption.
// Harness-specific steering transport is covered by codex-adapter and opencode-adapter;
// subscription rules and restart permutations live in subscriptions/subscription-hygiene (T2).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import type { Message } from '../src/protocol.ts';
import { clandWithEnv, clauseAnswered, connectUi, eventually, fakeClaude, killDaemon, nativeProjectHub as projectHub, spawnSpoke, tempProject, withDiscoveredPid } from './harness.ts';

test('Claude Code consumes one ordered subscription digest through the native frame', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t, { pollMs: 10_000 });
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await ui.request({ type: 'session.launch', name: 'coord', role: 'coordinator', harness: 'claude-code' }, 30_000);
  assert.equal(launched.ok, true, launched.error);
  const p = await withDiscoveredPid(ui, (launched.value as { process: { pid: number; sessionId: string; harnessId: string } }).process);
  t.after(() => killDaemon(p.pid));
  await clauseAnswered(ui, 'coord');
  const idle = () => eventually('native clause/turn completion', async () => {
    const result = await ui.request({ type: 'hub.status', history: true, flushLogs: true });
    return (result.value as { harnesses: Array<{ name: string; state: string }> }).harnesses.some(p => p.name === 'coord' && p.state === 'idle') || undefined;
  });
  await idle();
  const sender = await spawnSpoke({ cwd: root, discover: true, name: 'impl', sessionId: 'sender' });
  t.after(() => sender.close());
  await sender.waitForPresence(['impl', 'coord']);
  const made = await ui.request({ size: 'M', type: 'task.create', title: 'Harness subscription' });
  const item = (made.value as { item: { id: string } }).item;
  const subscribed = await clandWithEnv(root, fake.env, 'subscribe', 'item', item.id, '--event', 'task', '--as', 'coord', '--json');
  assert.equal(subscribed.code, 0, subscribed.stderr);
  await sender.call('send', { to: ['coord'], text: 'initial progress before', kind: 'progress' });
  assert.equal((await ui.request({ type: 'task.edit', item: item.id, status: 'planned' })).ok, true);
  const eventText = `event · task · ${item.id} status changed backlog → planned`;
  const recorded = await ui.waitFor(f => f.type === 'message' && (f.message as Message).text === eventText);
  await sender.call('send', { to: ['coord'], text: 'initial progress after', kind: 'progress' });
  const inputLog = () => fake.log(p.harnessId);
  // The queued receipt plus the completed clause turn makes this a bounded negative.
  await idle();
  assert.equal((await inputLog()).includes(eventText), false);
  const report = 'initial report releases events';
  await sender.call('send', { to: ['coord'], text: report });
  const log = await eventually('mixed digest consumed by Claude', async () => {
    const log = await inputLog();
    return log.includes(report) && log.includes(eventText) ? log : undefined;
  });
  const before = log.indexOf('initial progress before'), event = log.indexOf(eventText), after = log.indexOf('initial progress after'), end = log.indexOf(report);
  assert.ok(before < event && event < after && after < end);
  const id = (recorded.message as Message).id;
  await ui.waitFor(f => f.type === 'delivery' && f.message === id && f.stage === 'injected');
  await eventually('every native digest member injected', async () => {
    const result = await ui.request({ type: 'topic.history', topic: 'agents' });
    const messages = (result.value as { messages: Array<{ text: string; stage?: string }> }).messages;
    return ['initial progress before', eventText, 'initial progress after', report].every(text => messages.some(m => m.text === text && m.stage === 'injected')) || undefined;
  });
  await idle();
  assert.equal((await inputLog()).split('Turn digest (3 entries, oldest first):').length - 1, 1);
  assert.equal((await ui.request({ type: 'hub.status', history: true, flushLogs: true })).ok, true);
  const journal = (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.ok(journal.some(e => e.event === 'event-delivery' && e.id === id));
  assert.ok(journal.some(e => e.event === 'injected' && e.id === id));
  assert.ok(journal.filter(e => e.event === 'event-delivery').every(e => e.text === undefined));
  assert.equal(JSON.stringify(journal).includes(eventText), false);
});
