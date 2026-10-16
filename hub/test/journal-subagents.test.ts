import test from 'node:test';
import assert from 'node:assert/strict';
import { rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Journal } from '../src/hub/journal.ts';
import { tempProject } from './harness.ts';

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
