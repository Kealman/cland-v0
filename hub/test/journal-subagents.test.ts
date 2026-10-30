import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFile, open, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Journal, readJournal, readStartupJournal } from '../src/hub/journal.ts';
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


test('streamed startup selection matches synchronous selection across constructed byte boundaries', async t => {
  const root = await tempProject(t), path = join(root, 'journal.jsonl');
  // Constructed wire examples include CRLF, escaped keys/values, malformed JSON,
  // false candidates, multi-byte UTF-8 split at a chunk and an unfinished tail.
  const text = [
    JSON.stringify({ event: 'audit', text: 'x'.repeat(65500) + '🧭' }),
    JSON.stringify({ ts: '2026-10-01', event: 'task-plan-changed', plan: '🧭'.repeat(40000) }),
    String.raw`{"\u0065vent":"subagent-launched","item":"T-1"}`,
    String.raw`{"event":"task-plan-\u0061pproved","id":"E-1"}`,
    String.raw`{"event":"legacy","agents\u004eotice":"receipt"}`,
    '{"event":"subagent-launched",', 'null', 'false', '3',
    JSON.stringify({ event: 'audit', text: '"subagent-launched"' }),
    JSON.stringify({ event: 'legacy', agentsNotice: '' }),
    JSON.stringify({ event: 'subagent-launched', item: 'T-2' }),
  ].join('\r\n');
  await writeFile(path, text);
  const expected = readJournal(path, { startupOnly: true });
  assert.equal(expected.length, 6);
  assert.deepEqual(await readStartupJournal(path), expected);
});

test('concurrent startup readers share one scan and subsequent reads see appends and recover from failures', async t => {
  const root = await tempProject(t), path = join(root, 'journal.jsonl');
  assert.deepEqual(await readStartupJournal(path), []);
  await writeFile(path, '{"event":"subagent-launched","item":"T-1"}\n');
  const first = readStartupJournal(path), second = readStartupJournal(path);
  assert.equal(first, second, 'one in-flight operation, including open/stat/read/close');
  assert.deepEqual(await first, [{ event: 'subagent-launched', item: 'T-1' }]);
  await appendFile(path, '{"event":"task-plan-approved","id":"E-1"}');
  assert.equal((await readStartupJournal(path)).length, 2);
  await assert.rejects(readStartupJournal(root));
  await assert.rejects(readStartupJournal(root));
});

test('startup selection scans over 300 MiB with less than 1 MiB of buffered input work', async t => {
  const root = await tempProject(t), path = join(root, 'journal.jsonl');
  const line = JSON.stringify({ event: 'audit', text: 'ordinary '.repeat(100) }) + '\n';
  const block = line.repeat(1024);
  const file = await open(path, 'w');
  let bytes = 0;
  try {
    while (bytes < 300 * 1024 * 1024) {
      await file.writeFile(block); bytes += Buffer.byteLength(block);
    }
    const tail = '{"event":"subagent-launched","item":"T-1"}';
    await file.writeFile(tail); bytes += Buffer.byteLength(tail);
  } finally { await file.close(); }
  const stats = { bytesRead: 0, peakBufferedBytes: 0 };
  const records = await readStartupJournal(path, stats);
  assert.equal(stats.bytesRead, bytes);
  assert.ok(bytes >= 300 * 1024 * 1024);
  assert.ok(stats.peakBufferedBytes < 1024 * 1024, JSON.stringify(stats));
  assert.deepEqual(records, [{ event: 'subagent-launched', item: 'T-1' }]);
});


test('startup selection preserves a sanitized recorded journal subset', async t => {
  const root = await tempProject(t), path = join(root, 'journal.jsonl');
  const recorded = await readFile(new URL('./fixtures/startup-journal.jsonl', import.meta.url), 'utf8');
  await writeFile(path, recorded);
  const reference = readJournal(path, { startupOnly: true });
  assert.deepEqual(reference.map(row => row.event), ['role-clause', 'subagent-launched']);
  assert.deepEqual(await readStartupJournal(path), reference);
});
