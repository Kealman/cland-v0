import test from 'node:test';
import assert from 'node:assert/strict';
import { open, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Journal, readJournal } from '../src/hub/journal.ts';
import { tempProject } from './harness.ts';

test('startup journal selection retains plan, subagent and checkpoint records including escaped JSON keys', async t => {
  const root = await tempProject(t), path = join(root, 'journal.jsonl');
  const plan = { event: 'task-plan-changed', id: 'E-1' };
  const approved = { event: 'task-plan-approved', id: 'E-1' };
  const child = { event: 'subagent-launched', item: 'T-1' };
  const checkpoint = { event: 'legacy-event', agentsNotice: 'checkpoint-id' };
  await writeFile(path, [
    JSON.stringify({ event: 'audit', text: 'Ordinary retained output' }), JSON.stringify(plan), JSON.stringify(approved),
    String.raw`{"\u0065vent":"subagent-launched","item":"T-1"}`,
    String.raw`{"event":"legacy-event","agents\u004eotice":"checkpoint-id"}`,
    JSON.stringify({ event: 'audit', text: '"subagent-launched"' }), 'null', 'damaged record',
  ].join('\n'));
  assert.deepEqual(readJournal(path, { startupOnly: true }), [plan, approved, child, checkpoint]);
});

test('a supplied durable prefix restores subagents without rereading the startup journal', async t => {
  const root = await tempProject(t), path = join(root, 'journal.jsonl');
  const first = { event: 'subagent-launched', item: 'T-1', ts: '2026-10-15T20:00:00Z', session: 'impl', sessionId: 'parent', harness: 'codex', model: 'child-model' };
  await writeFile(path, JSON.stringify(first) + '\n');
  const journal = new Journal(path, undefined, { history: [first], open: async () => {
    const file = await open(path, 'a+');
    await rename(path, join(root, 'owned-journal.jsonl'));
    return file;
  } });
  t.after(() => journal.close());
  const { event: _event, item: _item, ...child } = first;
  assert.deepEqual(await journal.subagents('T-1'), [child]);
  journal.write({ ...first, model: 'live-model' });
  assert.deepEqual(await journal.subagents('T-1'), [child, { ...child, model: 'live-model' }]);
});

test('sub-agent lookups use restored and incrementally appended rows without reopening the journal', async t => {
  const root = await tempProject(t);
  const path = join(root, 'journal.jsonl');
  const archived = join(root, 'open-journal.jsonl');
  const parent = { session: 'impl', sessionId: 'parent', harness: 'codex' };
  const first = { ts: '2026-10-15T20:00:00Z', ...parent, model: 'child-model', agentId: 'first', agentType: 'Explore' };
  const unknown = { ts: '2026-10-15T21:00:00Z', ...parent, model: 'unreported' };
  await writeFile(path, [
    JSON.stringify({ event: 'subagent-launched', item: 'T-1', ...first }),
    'malformed record',
    JSON.stringify(null),
    JSON.stringify({ event: 'session-usage', item: 'T-1', ...first }),
    JSON.stringify({ event: 'subagent-launched', item: 'T-2', ...first }),
    JSON.stringify({ event: 'subagent-launched', item: 'T-1', session: 'missing required fields' }),
    JSON.stringify({ event: 'subagent-launched', item: 'T-1', ...unknown, model: '' }),
  ].join('\n')); // Startup repairs the newline before the first append.
  const journal = new Journal(path);
  t.after(() => journal.close());
  await journal.flush();
  // A live hub owns the open descriptor. Moving its path makes any per-query
  // stat/open/stream fail while normal appends remain available through that handle.
  await rename(path, archived);
  const read = await Promise.all([journal.subagents('T-1'), journal.subagents('T-2'), journal.subagents('T-3')]);
  assert.deepEqual(read, [[first, unknown], [first], []]);
  read[0]![0]!.model = 'mutated by caller';
  assert.deepEqual(await journal.subagents('T-1'), [first, unknown]);
  const live = { ts: '2026-10-16T00:00:00Z', ...parent, model: 'live-model', agentId: 'live' };
  const pending = { event: 'subagent-launched', item: 'T-1', ...live };
  journal.write(pending);
  pending.model = 'mutated after write';
  assert.deepEqual(await journal.subagents('T-1'), [first, unknown, live]);
  await journal.close();
  await rename(archived, path);
  const restarted = new Journal(path);
  t.after(() => restarted.close());
  assert.deepEqual(await restarted.subagents('T-1'), [first, unknown, live]);
});
