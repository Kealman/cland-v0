// T2 component: tracker rules at public APIs, sockets, CLI and in-process MCP.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { cland, connectUi, eventually, inProcessSpoke, projectHub, tempProject } from './harness.ts';

// Persistence proofs close and reopen the hub/store in this process.
const hubs = new Map<string, Awaited<ReturnType<typeof projectHub>>>();
const openHub: typeof projectHub = async (...args) => {
  const sha = 'a'.repeat(40);
  const hub = await projectHub(args[0], args[1], args[2], {
    git: async command => {
      if (command[0] === 'for-each-ref') return `${sha} refs/heads/dev\n${sha} refs/heads/t/test`;
      if (command[0] === 'rev-parse') return sha;
      if (command[0] === 'merge-base') return sha;
      if (command[0] === 'diff') return '';
      return null;
    }, readBase: async () => 'dev', ...args[3],
  });
  hubs.set(args[1], hub);
  args[0].after(() => { if (hubs.get(args[1]) === hub) hubs.delete(args[1]); });
  return hub;
};
const stopHub = async (root: string) => { await hubs.get(root)!.stop(); };
import { parseItem, serializeItem, verdictOfText, type ReviewScope } from '../src/tracker/item.ts';
import type { ItemView, ItemSummary } from '../src/tracker/tracker.ts';

async function task(root: string, ...args: string[]): Promise<{ item: ItemView; items: ItemSummary[]; commit?: { sha: string | null; source: string; note: string } }> {
  const r = await cland(root, 'task', ...args, '--json');
  assert.equal(r.code, 0, r.stderr);
  return JSON.parse(r.stdout);
}
const viewed = (root: string, id: string, ok: (item: ItemView) => boolean) => eventually('indexed verdict', async () => {
  const item = (await task(root, 'view', id)).item;
  return ok(item) ? item : undefined;
});

test('an existing hub database upgrades additively and legacy verdicts remain file evidence', async (t) => {
  const root = await tempProject(t);
  const sha = 'a'.repeat(40);
  const dir = join(root, '.cland');
  await mkdir(join(dir, 'tasks'), { recursive: true });
  // Fixture from the old schema, before commit headers and durable evidence existed.
  const db = new DatabaseSync(join(dir, 'hub.db'));
  db.exec(`create table tracker_verdicts (
    item_id text not null references tracker_items (id) on delete cascade, seq integer not null, verdict text not null, result text not null,
    by text not null, run text not null, author text not null, at text not null,
    primary key (item_id, seq));`);
  db.close();
  await writeFile(join(dir, 'tasks', 'T-1-legacy.md'), '---\nid: T-1\ntitle: Legacy\nbranch: t/test\n---\n\n## Comments\n\n### rev-1 · 2026-10-09T08:00:00.000Z\n\nverdict: review\nresult: clear\nby: rev-1 [reviewer]\nrun: legacy\n');
  await openHub(t, root);
  assert.equal((await task(root, 'list')).items[0]?.verdicts[0]?.source, 'file');
  assert.equal((await viewed(root, 'T-1', (i) => i.verdicts[0]?.current !== undefined)).verdicts[0]?.current, false);
  const r = await task(root, 'comment', 'T-1', 'checked', '--verdict', 'review', '--scope', 'full', '--result', 'clear', '--run', 'new');
  assert.equal(r.item.verdicts[1]?.source, 'hub');
  assert.equal(r.item.verdicts[1]?.commit, sha);
});


test('review scope is required through CLI and MCP, indexed and announced, while QA carries none', async t => {
  const root = await tempProject(t);
  const { discovery } = await openHub(t, root);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const { item } = await task(root, 'create', '--size', 'M', 'Scoped', '--branch', 't/test');
  const rev = await inProcessSpoke(t, { discover: true, cwd: root, name: 'scope-reviewer', role: 'reviewer' });
  t.after(() => rev.close());
  await rev.call('subscribe', { subject: { item: item.id }, events: ['task'] });
  const args = ['comment', item.id, 'Checked', '--verdict', 'review', '--result', 'clear', '--run', 'scope-cli'];
  const refused = await cland(root, 'task', ...args);
  assert.equal(refused.code, 1);
  assert.match(refused.stderr, /full, delta or evidence/);
  const invalid = await cland(root, 'task', ...args, '--scope', 'unknown');
  assert.equal(invalid.code, 1);
  assert.match(invalid.stderr, /full, delta or evidence/);
  const recorded = await task(root, ...args, '--scope', 'delta');
  assert.equal(recorded.item.verdicts[0]?.scope, 'delta');
  assert.equal((await task(root, 'view', item.id)).item.verdicts[0]?.scope, 'delta');
  assert.equal((await task(root, 'list')).items[0]?.verdicts[0]?.scope, 'delta');
  assert.match((await cland(root, 'task', 'view', item.id)).stdout, /scope delta/);
  const event = await ui.waitFor(f => f.type === 'task' && (f.item as ItemSummary)?.verdicts?.[0]?.scope === 'delta');
  assert.equal((event.item as ItemSummary).verdicts[0]?.scope, 'delta');
  await ui.waitFor(f => f.type === 'message' && String((f.message as { text: string }).text).includes('verdict posted review clear · delta · scope-cli'));
  const qa = await cland(root, 'task', 'comment', item.id, 'QA', '--verdict', 'qa', '--result', 'clear', '--run', 'scope-qa', '--scope', 'full');
  assert.equal(qa.code, 1);
  assert.match(qa.stderr, /QA verdict.*scope/i);
  const input = { id: item.id, text: 'Checked again', verdict: 'review', result: 'clear', run: 'scope-mcp' };
  const missing = await rev.call<{ ok: boolean; error: string }>('task.comment', input);
  assert.equal(missing.ok, false);
  assert.match(missing.error, /full, delta or evidence/);
  const result = await rev.call<{ ok: boolean; item: ItemView }>('task.comment', { ...input, scope: 'evidence' });
  assert.equal(result.ok, true);
  assert.equal(result.item.verdicts.at(-1)?.scope, 'evidence');
  assert.equal(result.item.verdicts.at(-1)?.source, 'hub');
  await ui.waitFor(f => f.type === 'task' && (f.item as ItemSummary)?.status === 'ready');
  const before = await readFile(join(root, item.path), 'utf8');
  const textMissing = await cland(root, 'task', 'comment', item.id, 'verdict: review\nresult: clear\nrun: text-missing');
  assert.equal(textMissing.code, 1);
  assert.match(textMissing.stderr, /full, delta or evidence/);
  assert.equal(await readFile(join(root, item.path), 'utf8'), before);
  const textQa = await cland(root, 'task', 'comment', item.id, 'verdict: qa\nresult: clear\nrun: text-qa\nscope: full');
  assert.equal(textQa.code, 1);
  assert.match(textQa.stderr, /QA verdict.*scope/i);
  const textInvalid = await cland(root, 'task', 'comment', item.id, 'verdict: review\nresult: clear\nrun: text-invalid\nscope: unknown');
  assert.equal(textInvalid.code, 1);
  assert.match(textInvalid.stderr, /full, delta or evidence/);
  assert.equal((await task(root, 'comment', item.id, 'verdict: review\nresult: clear\nrun: text-full\nscope: full')).item.verdicts.at(-1)?.scope, 'full');
  await rev.close();
  await stopHub(root);
  await openHub(t, root);
  const restarted = (await task(root, 'list')).items[0]!.verdicts;
  assert.deepEqual(restarted.map(v => [v.scope, v.source]), [['delta', 'hub'], ['evidence', 'hub'], ['full', 'hub']]);
});


test('item review headers round-trip all scopes and preserve unscoped legacy bytes', () => {
  const legacy = '---\nid: T-1\nkind: task\ntitle: Old review\nstate: open\nstatus: backlog\nlabels: []\nassignee: null\nparent: null\nblocked_by: []\ntopic: null\nbranch: null\ncreated: 2026-10-09T08:00:00.000Z\nupdated: 2026-10-09T08:00:00.000Z\n---\n\n## Comments\n\n### rev · 2026-10-09T08:00:00.000Z\n\nverdict: review\nresult: clear\nby: rev [reviewer]\nrun: old\ncommit: abcdef12\n\nChecked.\n';
  const item = parseItem(legacy, 'T-1-old-review.md');
  assert.equal(item.comments[0]?.verdict?.scope, undefined);
  assert.equal(serializeItem(item), legacy);
  for (const scope of ['full', 'delta', 'evidence'] as ReviewScope[]) {
    item.comments[0]!.verdict!.scope = scope;
    const serialized = serializeItem(item);
    assert.match(serialized, new RegExp(`run: old\\ncommit: abcdef12\\nscope: ${scope}\\n`));
    assert.equal(parseItem(serialized, 'T-1-old-review.md').comments[0]?.verdict?.scope, scope);
    assert.equal(verdictOfText(serialized.slice(serialized.indexOf('verdict:')))?.scope, scope);
  }
});


test('scope migration preserves authenticated legacy reviews and scope edits lose provenance', async t => {
  const root = await tempProject(t);
  const sha = 'a'.repeat(40);
  const dir = join(root, '.cland');
  await mkdir(join(dir, 'tasks'), { recursive: true });
  const at = '2026-10-09T08:00:00.000Z';
  const file = join(dir, 'tasks', 'T-1-legacy.md');
  await writeFile(file, `---\nid: T-1\ntitle: Legacy\nbranch: t/test\n---\n\n## Comments\n\n### rev · ${at}\n\nverdict: review\nresult: clear\nby: rev [reviewer]\nrun: old\ncommit: ${sha}\n\nChecked.\n`);
  // Pre-scope durable schema and fingerprint: adding an absent field must not invalidate old evidence.
  const db = new DatabaseSync(join(dir, 'hub.db'));
  db.exec('create table tracker_written_verdicts (item_id text not null, comment_key text not null, verdict text not null, result text not null, run text not null, commit_sha text, session_id text not null, role text, at text not null, primary key (item_id, comment_key))');
  const key = createHash('sha256').update(JSON.stringify(['rev', at, 'review', 'clear', 'rev [reviewer]', 'old', sha, 'Checked.'])).digest('hex');
  db.prepare('insert into tracker_written_verdicts values (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('T-1', key, 'review', 'clear', 'old', sha, 'legacy-reviewer', 'reviewer', at);
  db.close();
  await openHub(t, root);
  for (const verdict of [(await task(root, 'view', 'T-1')).item.verdicts[0]!, (await task(root, 'list')).items[0]!.verdicts[0]!]) {
    assert.equal(verdict.scope, undefined);
    assert.equal(verdict.source, 'hub');
    assert.deepEqual(verdict.writer, { sessionId: 'legacy-reviewer', role: 'reviewer' });
  }
  const reviewer = await inProcessSpoke(t, { discover: true, cwd: root, name: 'new-reviewer', role: 'reviewer' });
  t.after(() => reviewer.close());
  const written = await reviewer.call<{ ok: boolean; item: ItemView }>('task.comment', { id: 'T-1', text: 'New check', verdict: 'review', result: 'not clear', run: 'scoped', scope: 'full' });
  assert.equal(written.ok, true);
  assert.equal(written.item.verdicts.at(-1)?.source, 'hub');
  await writeFile(file, (await readFile(file, 'utf8')).replace('scope: full', 'scope: delta'));
  const changed = await viewed(root, 'T-1', i => i.verdicts.at(-1)?.scope === 'delta');
  assert.equal(changed.verdicts[0]?.source, 'hub');
  assert.equal(changed.verdicts.at(-1)?.source, 'file');
});
