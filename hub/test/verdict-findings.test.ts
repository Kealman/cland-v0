import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseItem, serializeItem } from '../src/tracker/item.ts';
import type { ItemView } from '../src/tracker/tracker.ts';
import { cland, connectUi, flushProjectLogs, nativeProjectHub as projectHub, spawnSpoke, tempProject } from './harness.ts';

const findings = [
  { severity: 'high', text: 'Drops a verdict', file: 'hub/src/tracker/tracker.ts', line: 42 },
  { severity: 'medium', text: 'Omits counts' },
  { severity: 'low', text: 'Explain the field: use @ consistently', file: 'hub/README.md', line: 12 },
];
const counts = { high: 1, medium: 1, low: 1 };

test('verdict headers preserve findings, derive counts and leave legacy counts unknown', () => {
  const legacy = '---\nid: T-1\nkind: task\ntitle: Findings\nstate: open\n---\n\n## Comments\n\n### reviewer · 2026-10-15T10:00:00.000Z\n\nverdict: review\nresult: not clear\nby: reviewer [reviewer]\nrun: legacy\nscope: full\n\nReview notes.\n';
  const old = parseItem(legacy);
  assert.equal(old.comments[0]!.verdict!.findings, undefined);
  assert.equal(old.comments[0]!.verdict!.findingCounts, undefined);
  assert.deepEqual(parseItem(serializeItem(old)), old);
  // A stale or forged count never overrides the entries.
  const text = legacy.replace('scope: full', `scope: full\nfindings: ${JSON.stringify(findings)}\nfinding_counts: {"high":99}`);
  const item = parseItem(text);
  assert.deepEqual(item.comments[0]!.verdict!.findings, findings);
  assert.deepEqual(item.comments[0]!.verdict!.findingCounts, counts);
  assert.deepEqual(parseItem(serializeItem(item)), item);
  assert.match(serializeItem(item), /finding_counts: {"high":1,"medium":1,"low":1}/);
  assert.throws(() => parseItem(text.replace(JSON.stringify(findings), 'not-json')), /invalid verdict findings/);
});

test('CLI and MCP verdicts expose all severities, clear lows and explicit empty findings in views and journal', async t => {
  const root = await tempProject(t);
  await projectHub(t, root);
  const reviewer = await spawnSpoke({ discover: true, cwd: root, name: 'rev-findings', role: 'reviewer' });
  t.after(() => reviewer.close());
  await reviewer.waitForPresence(['rev-findings']);
  const created = await cland(root, 'task', 'create', 'Findings', '--size', 'S', '--json');
  assert.equal(created.code, 0, created.stderr);
  const item: ItemView = JSON.parse(created.stdout).item;
  const verdict = await cland(root, 'task', 'comment', item.id, 'All findings recorded.', '--verdict', 'review', '--scope', 'full', '--result', 'not clear', '--run', 'cli',
    '--finding', 'high:Drops a verdict@hub/src/tracker/tracker.ts:42', '--finding', 'medium:Omits counts', '--finding', 'low:Explain the field: use @ consistently@hub/README.md:12', '--json');
  assert.equal(verdict.code, 0, verdict.stderr);
  const viewed = await cland(root, 'task', 'view', item.id, '--json');
  const stored: ItemView = JSON.parse(viewed.stdout).item;
  assert.deepEqual(stored.verdicts[0]!.findings, findings);
  assert.deepEqual(stored.verdicts[0]!.findingCounts, counts);
  assert.equal(stored.verdicts[0]!.source, 'hub');
  assert.deepEqual(stored.comments[0]!.verdict!.findings, findings);
  const listed = await reviewer.call<{ items: ItemView[] }>('task.list');
  assert.deepEqual(listed.items[0]!.verdicts[0]!.findings, findings);
  assert.deepEqual(listed.items[0]!.verdicts[0]!.findingCounts, counts);
  // Both public writers reject contradictory review evidence without appending a comment.
  const beforeRefusals = await readFile(join(root, item.path), 'utf8');
  for (const severity of ['high', 'medium']) {
    const entry = { severity, text: `Unresolved ${severity} bug` };
    const toolRefusal = await reviewer.call<{ ok: boolean; error: string }>('task.comment', { id: item.id, verdict: 'review', result: 'clear', run: 'bad-clear', scope: 'full', findings: [entry] });
    assert.equal(toolRefusal.ok, false);
    assert.match(toolRefusal.error, /record not clear instead/);
    assert.ok(toolRefusal.error.includes(`${severity}: Unresolved ${severity} bug`));
    const cliRefusal = await cland(root, 'task', 'comment', item.id, '--verdict', 'review', '--scope', 'full', '--result', 'clear', '--run', 'bad-clear-cli', '--finding', `${severity}:Unresolved ${severity} bug`);
    assert.equal(cliRefusal.code, 1);
    assert.match(cliRefusal.stderr, /record not clear instead/);
    assert.ok(cliRefusal.stderr.includes(`${severity}: Unresolved ${severity} bug`));
    assert.equal(await readFile(join(root, item.path), 'utf8'), beforeRefusals);
  }
  const low = [{ severity: 'low', text: 'Document the default', file: 'hub/README.md' }];
  const clear = await reviewer.call<{ item: ItemView }>('task.comment', { id: item.id, verdict: 'review', result: 'clear', run: 'low-only', scope: 'full', findings: low });
  assert.equal(clear.item.verdicts.at(-1)!.result, 'clear');
  assert.deepEqual(clear.item.verdicts.at(-1)!.findings, low);
  assert.deepEqual(clear.item.verdicts.at(-1)!.findingCounts, { high: 0, medium: 0, low: 1 });
  const plain = await cland(root, 'task', 'view', item.id);
  assert.match(plain.stdout, /findings: 1 high, 1 medium, 1 low/);
  assert.match(plain.stdout, /low: Document the default @hub\/README.md/);
  const empty = await reviewer.call<{ item: ItemView }>('task.comment', { id: item.id, verdict: 'review', result: 'clear', run: 'none', scope: 'evidence', findings: [] });
  assert.deepEqual(empty.item.verdicts.at(-1)!.findings, []);
  assert.deepEqual(empty.item.verdicts.at(-1)!.findingCounts, { high: 0, medium: 0, low: 0 });
  const file = await readFile(join(root, item.path), 'utf8');
  assert.match(file, /findings: \[\]\nfinding_counts: {"high":0,"medium":0,"low":0}/);
  await flushProjectLogs(t, root);
  const logs = (await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  const records = logs.filter(e => e.event === 'notification' && e.kind === 'verdict' && e.item === item.id);
  assert.equal(records.length, 3);
  assert.deepEqual(records[0].findings, findings);
  assert.deepEqual(records[0].findingCounts, counts);
  assert.deepEqual(records[1].findings, low);
  assert.deepEqual(records[2].findingCounts, { high: 0, medium: 0, low: 0 });
  const qa = await cland(root, 'task', 'comment', item.id, '--verdict', 'qa', '--result', 'clear', '--run', 'qa-unchanged', '--finding', 'high:QA result validation unchanged', '--json');
  assert.equal(qa.code, 0, qa.stderr);
  const qaView: ItemView = JSON.parse(qa.stdout).item;
  assert.equal(qaView.verdicts.at(-1)!.result, 'clear');
  assert.deepEqual(qaView.verdicts.at(-1)!.findingCounts, { high: 1, medium: 0, low: 0 });

});

test('invalid findings refuse atomically and text headers carry findings through restart and evidence checks', async t => {
  const root = await tempProject(t);
  const hub = await projectHub(t, root);
  const ui = await connectUi(t, hub.discovery);
  const created = await cland(root, 'task', 'create', 'Validation', '--size', 'S', '--json');
  assert.equal(created.code, 0, created.stderr);
  const item: ItemView = JSON.parse(created.stdout).item;
  const file = join(root, item.path);
  const original = await readFile(file, 'utf8');
  const invalid = [null, {}, ['low:bad'], [{ severity: 'critical', text: 'bad' }], [{ severity: 'low', text: ' ' }], [{ severity: 'low', text: 'bad', line: 1 }], [{ severity: 'low', text: 'bad', file: 'x', line: 0 }], [{ severity: 'low', text: 'bad', file: 'x', line: 1.5 }], [{ severity: 'low', text: 'bad', file: '' }], [{ severity: 'low', text: 'bad', file: 'x\ny' }]];
  for (const findings of invalid) {
    const refused = await ui.request({ type: 'task.comment', item: item.id, text: '', verdict: { verdict: 'review', result: 'clear', run: 'bad', scope: 'full', findings } });
    assert.equal(refused.ok, false, JSON.stringify(findings));
    assert.match(refused.error!, /finding/);
    assert.equal(await readFile(file, 'utf8'), original);
  }
  for (const finding of ['critical:bad', 'low:', 'low:bad@x:0']) {
    const refused = await cland(root, 'task', 'comment', item.id, '--verdict', 'review', '--scope', 'full', '--result', 'clear', '--run', 'bad-cli', '--finding', finding);
    assert.notEqual(refused.code, 0);
    assert.match(refused.stderr, /finding/);
  }
  const malformed = await ui.request({ type: 'task.comment', item: item.id, text: 'verdict: review\nresult: clear\nrun: broken\nscope: full\nfindings: no-json' });
  assert.equal(malformed.ok, false);
  assert.match(malformed.error!, /invalid verdict findings/);
  const header = `verdict: review\nresult: not clear\nrun: from-text\nscope: full\nfindings: ${JSON.stringify(findings)}\n\nReview notes.`;
  const recorded = await ui.request({ type: 'task.comment', item: item.id, text: header });
  assert.equal(recorded.ok, true, recorded.error);
  const before: ItemView = JSON.parse((await cland(root, 'task', 'view', item.id, '--json')).stdout).item;
  assert.deepEqual(before.verdicts[0]!.findings, findings);
  assert.equal(before.verdicts[0]!.source, 'hub');
  // Stop the first writer before rebuilding the index in a second hub.
  ui.close();
  await hub.stop();
  const restarted = await projectHub(t, root);
  const after: ItemView = JSON.parse((await cland(root, 'task', 'view', item.id, '--json')).stdout).item;
  assert.deepEqual(after.verdicts[0]!.findings, findings);
  assert.deepEqual(after.verdicts[0]!.findingCounts, counts);
  assert.equal(after.verdicts[0]!.source, 'hub');
  await restarted.stop();
  const altered = (await readFile(file, 'utf8')).replace('Drops a verdict', 'Changed finding');
  await writeFile(file, altered);
  await projectHub(t, root);
  const changed: ItemView = JSON.parse((await cland(root, 'task', 'view', item.id, '--json')).stdout).item;
  assert.equal(changed.verdicts[0]!.source, 'file');
});
