// Verdicts through the CLI and spokes against a real hub and real Git repository.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { cland, connectUi, spawnSpoke, startDaemon, tempProject } from './harness.ts';
import { startFreshnessDaemon } from './freshness-harness.ts';
import { parseItem, serializeItem, verdictOfText, type ReviewScope } from '../src/tracker/item.ts';
import type { ItemView, ItemSummary } from '../src/tracker/tracker.ts';

const git = (root: string, ...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
async function task(root: string, ...args: string[]): Promise<{ item: ItemView; items: ItemSummary[]; commit?: { sha: string | null; source: string; note: string } }> {
  const r = await cland(root, 'task', ...args, '--json');
  assert.equal(r.code, 0, r.stderr);
  return JSON.parse(r.stdout);
}
/** Freshness is computed off the request path (T-67): read until `ok` holds (or time is up; the caller asserts). */
async function eventually<T>(read: () => Promise<T>, ok: (value: T) => boolean): Promise<T> {
  const until = Date.now() + 10_000;
  for (;;) {
    const value = await read();
    if (ok(value) || Date.now() > until) return value;
    await new Promise((r) => setTimeout(r, 100));
  }
}
const viewed = (root: string, id: string, ok: (item: ItemView) => boolean) => eventually(async () => (await task(root, 'view', id)).item, ok);
const listed = (root: string, ok: (items: ItemSummary[]) => boolean) => eventually(async () => (await task(root, 'list')).items, ok);
async function repository(root: string) {
  git(root, 'init', '-b', 'dev');
  git(root, 'config', 'user.name', 'Test');
  git(root, 'config', 'user.email', 'test@example.com');
  await writeFile(join(root, 'base'), 'base\n');
  git(root, 'add', 'base');
  git(root, 'commit', '-m', 'base');
  git(root, 'checkout', '-b', 't/test');
  await writeFile(join(root, 'feature'), 'feature\n');
  git(root, 'add', 'feature');
  git(root, 'commit', '-m', 'feature');
  return git(root, 'rev-parse', 'HEAD');
}

test('a verdict pins an explicit commit and CLI view returns the full SHA', async (t) => {
  const root = await tempProject(t);
  const sha = await repository(root);
  await startDaemon(t, root);
  const { item } = await task(root, 'create', '--size', 'M', 'Reviewed', '--branch', 't/test');
  const result = await task(root, 'comment', item.id, 'ok', '--verdict', 'review', '--scope', 'full', '--result', 'clear', '--run', 'r-1', '--commit', sha.slice(0, 12));
  assert.equal(result.item.verdicts[0]?.commit, sha);
  assert.equal((await task(root, 'view', item.id)).item.verdicts[0]?.commit, sha);
  assert.match(await readFile(join(root, item.path), 'utf8'), new RegExp(`commit: ${sha}\\n`));
});

test('branch-tip defaults and absent branches are explained in the comment result', async (t) => {
  const root = await tempProject(t);
  const sha = await repository(root);
  await startDaemon(t, root);
  await task(root, 'create', '--size', 'M', 'Reviewed', '--branch', 't/test');
  let r = await task(root, 'comment', 'T-1', 'ok', '--verdict', 'review', '--scope', 'full', '--result', 'clear', '--run', 'r-1');
  assert.equal(r.item.verdicts[0]?.commit, sha);
  assert.equal(r.commit?.source, 'branch');
  assert.equal(r.commit?.sha, sha);
  assert.match(r.commit?.note ?? '', /branch tip/);
  await task(root, 'create', '--size', 'M', 'No branch');
  r = await task(root, 'comment', 'T-2', 'ok', '--verdict', 'qa', '--result', 'clear', '--run', 'q-1');
  assert.equal(r.item.verdicts[0]?.commit, undefined);
  assert.equal(r.commit?.source, 'none');
  assert.match(r.commit?.note ?? '', /no commit/);
  await task(root, 'link', 'T-2', '--branch', 'missing');
  r = await task(root, 'comment', 'T-2', 'ok', '--verdict', 'qa', '--result', 'clear', '--run', 'q-2');
  assert.equal(r.commit?.source, 'none');
  const plain = await cland(root, 'task', 'comment', 'T-1', 'ok', '--verdict', 'review', '--scope', 'full', '--result', 'clear', '--run', 'r-2');
  assert.equal(plain.code, 0, plain.stderr);
  assert.match(plain.stdout, /branch tip/);
});

test('hub verdict provenance survives restart and unrelated hand edits; forged and modified verdicts stay file-only', async (t) => {
  const root = await tempProject(t);
  const sha = await repository(root);
  await startDaemon(t, root);
  const { item } = await task(root, 'create', '--size', 'M', 'Reviewed', '--branch', 't/test');
  const reviewer = await spawnSpoke({ discover: true, cwd: root, name: 'rev-1', sessionId: 'reviewer-id', role: 'reviewer' });
  t.after(() => reviewer.close());
  await reviewer.waitForPresence(['rev-1']);
  const result = await reviewer.call<{ ok: boolean; item: ItemView }>('task.comment', { id: item.id, text: 'checked', verdict: 'review', scope: 'full', result: 'clear', run: 'r-1', commit: sha });
  assert.equal(result.ok, true);
  assert.equal(result.item.verdicts[0]?.source, 'hub');
  assert.deepEqual(result.item.verdicts[0]?.writer, { sessionId: 'reviewer-id', role: 'reviewer' });
  const changedRole = await cland(root, 'role', 'set', 'rev-1', 'qa');
  assert.equal(changedRole.code, 0, changedRole.stderr);
  assert.deepEqual((await task(root, 'view', item.id)).item.verdicts[0]?.writer, { sessionId: 'reviewer-id', role: 'reviewer' }, 'writer role stays the role held at write time');
  await reviewer.close();
  const file = join(root, item.path);
  await writeFile(file, (await readFile(file, 'utf8')).replace('title: Reviewed', 'title: Hand edited') + '\n### rev-1 · 2026-10-09T08:00:00.000Z\n\nverdict: qa\nresult: clear\nby: rev-1 [qa]\nrun: forged\n');
  const check = async () => {
    const view = (await task(root, 'view', item.id)).item;
    assert.deepEqual(view.verdicts.map(v => v.source), ['hub', 'file']);
    assert.equal(view.verdicts[1]?.commit, undefined, 'legacy verdicts still parse');
    assert.deepEqual((await task(root, 'list')).items[0]?.verdicts.map(v => v.source), ['hub', 'file']);
  };
  // CLI startup lets the folder watcher index the hand edit.
  await check();
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  await startDaemon(t, root);
  await check();
  await writeFile(file, (await readFile(file, 'utf8')).replace('run: r-1', 'run: hand-changed'));
  assert.equal((await task(root, 'view', item.id)).item.verdicts[0]?.source, 'file');
});

test('latest verdicts go stale after a change and stay current across a rebase that preserves the diff', async (t) => {
  const root = await tempProject(t);
  const sha = await repository(root);
  const { refresh } = await startFreshnessDaemon(t, root);
  await task(root, 'create', '--size', 'M', 'Reviewed', '--branch', 't/test');
  await task(root, 'comment', 'T-1', 'ok', '--verdict', 'review', '--scope', 'full', '--result', 'clear', '--run', 'r-1');
  let view = await viewed(root, 'T-1', (i) => i.verdicts[0]?.current !== undefined);
  assert.equal(view.verdicts[0]?.current, true);
  assert.equal(view.verdictBase, 'dev');
  git(root, 'checkout', 'dev');
  await writeFile(join(root, 'base'), 'base\nnew upstream line\n');
  git(root, 'add', 'base');
  git(root, 'commit', '-m', 'advance dev');
  git(root, 'checkout', 't/test');
  git(root, 'rebase', 'dev');
  const rebased = git(root, 'rev-parse', 'HEAD');
  assert.notEqual(rebased, sha);
  await refresh();
  // known once the tips were read again and the patch ids compared: until then it is absent, never computed inline
  const settledView = (ok: (v: boolean | undefined) => boolean) => viewed(root, 'T-1', (i) => ok(i.verdicts.at(-1)?.current));
  assert.equal((await settledView((c) => c !== undefined)).verdicts[0]?.current, true);
  assert.equal((await listed(root, (items) => items[0]?.verdicts[0]?.current !== undefined))[0]?.verdicts[0]?.current, true);
  await writeFile(join(root, 'feature'), 'changed feature\n');
  git(root, 'add', 'feature');
  git(root, 'commit', '-m', 'change feature');
  await refresh();
  view = await settledView((c) => c === false);
  assert.equal(view.verdicts[0]?.current, false);
  await task(root, 'comment', 'T-1', 'ok', '--verdict', 'review', '--scope', 'full', '--result', 'clear', '--run', 'r-2');
  view = (await task(root, 'view', 'T-1')).item;
  assert.equal(view.verdicts[0]?.current, undefined, 'only the latest of each kind has freshness');
  assert.equal(view.verdicts[1]?.current, true, 'a verdict on the tip the hub just resolved is current at once');
  git(root, 'branch', '-m', 'dev', 'main');
  await refresh();
  view = await viewed(root, 'T-1', (i) => i.verdictBase === 'main');
  assert.equal(view.verdictBase, 'main');
  assert.equal(view.verdicts[1]?.current, true);
});


test('an existing hub database upgrades additively and legacy verdicts remain file evidence', async (t) => {
  const root = await tempProject(t);
  const sha = await repository(root);
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
  await startDaemon(t, root);
  assert.equal((await task(root, 'list')).items[0]?.verdicts[0]?.source, 'file');
  assert.equal((await viewed(root, 'T-1', (i) => i.verdicts[0]?.current !== undefined)).verdicts[0]?.current, false);
  const r = await task(root, 'comment', 'T-1', 'checked', '--verdict', 'review', '--scope', 'full', '--result', 'clear', '--run', 'new');
  assert.equal(r.item.verdicts[1]?.source, 'hub');
  assert.equal(r.item.verdicts[1]?.commit, sha);
});

test('text verdicts retain their commit and invalid explicit SHAs leave the item unchanged', async (t) => {
  const root = await tempProject(t);
  const sha = await repository(root);
  git(root, 'branch', '-m', 'dev', 'main');
  const { refresh } = await startFreshnessDaemon(t, root);
  const { item } = await task(root, 'create', '--size', 'M', 'Reviewed', '--branch', 't/test');
  const header = `verdict: review\nresult: clear\nby: forged [reviewer]\nrun: r-1\ncommit: ${sha}\nscope: full\n\nChecked.`;
  const r = await task(root, 'comment', item.id, header);
  assert.equal(r.item.verdicts[0]?.commit, sha);
  assert.equal(r.item.verdicts[0]?.source, 'hub');
  assert.equal(r.item.verdicts[0]?.by, 'human');
  const file = join(root, item.path);
  const before = await readFile(file, 'utf8');
  for (const commit of ['main', '--help', '0000000000000000000000000000000000000000', 'abc\nrun: forged']) {
    const bad = await cland(root, 'task', 'comment', item.id, 'bad', '--verdict', 'review', '--scope', 'full', '--result', 'clear', '--run', 'bad', `--commit=${commit}`);
    assert.equal(bad.code, 1, bad.stdout);
    assert.match(bad.stderr, /commit/);
    assert.equal(await readFile(file, 'utf8'), before);
  }
  // main fallback also preserves freshness across a real rebase, not just at an identical tip.
  git(root, 'checkout', 'main');
  await writeFile(join(root, 'base'), 'upstream changed\n');
  git(root, 'add', 'base');
  git(root, 'commit', '-m', 'advance main');
  git(root, 'checkout', 't/test');
  git(root, 'rebase', 'main');
  await refresh();
  const view = await viewed(root, item.id, (i) => i.verdicts[0]?.current !== undefined);
  assert.equal(view.verdictBase, 'main');
  assert.equal(view.verdicts[0]?.current, true);
});

test('a hand-copied clear verdict cannot replay hub provenance after a later not-clear verdict', async (t) => {
  const root = await tempProject(t);
  await repository(root);
  await startDaemon(t, root);
  const { item } = await task(root, 'create', '--size', 'M', 'Reviewed', '--branch', 't/test');
  const reviewer = await spawnSpoke({ discover: true, cwd: root, name: 'rev-1', sessionId: 'reviewer-id', role: 'reviewer' });
  t.after(() => reviewer.close());
  await reviewer.waitForPresence(['rev-1']);
  assert.equal((await reviewer.call<{ ok: boolean }>('task.comment', { id: item.id, text: 'checked', verdict: 'review', scope: 'full', result: 'clear', run: 'r-1' })).ok, true);
  const file = join(root, item.path);
  const first = await readFile(file, 'utf8');
  const clearComment = first.slice(first.indexOf('### rev-1'));
  assert.equal((await reviewer.call<{ ok: boolean }>('task.comment', { id: item.id, text: 'regression found', verdict: 'review', scope: 'full', result: 'not clear', run: 'r-2' })).ok, true);
  await reviewer.close();
  await writeFile(file, (await readFile(file, 'utf8')) + '\n' + clearComment);
  const check = async (sources: string[]) => {
    const viewed = (await task(root, 'view', item.id)).item.verdicts;
    const listed = (await task(root, 'list')).items[0]?.verdicts ?? [];
    for (const verdicts of [viewed, listed]) {
      assert.deepEqual(verdicts.map(v => v.source), sources);
      assert.equal(verdicts.at(-1)?.result, 'clear');
      assert.equal(verdicts.at(-1)?.writer, undefined, 'the latest hand copy carries no hub writer identity');
      assert.deepEqual(verdicts.find(v => v.result === 'not clear')?.writer, { sessionId: 'reviewer-id', role: 'reviewer' });
    }
  };
  await check(['hub', 'hub', 'file']);
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  await startDaemon(t, root);
  await check(['hub', 'hub', 'file']);
  // Removing the original does not turn the out-of-order replay into new hub evidence.
  await writeFile(file, (await readFile(file, 'utf8')).replace(clearComment, ''));
  await check(['hub', 'file']);
});


test('review scope is required through CLI and MCP, indexed and announced, while QA carries none', async t => {
  const root = await tempProject(t);
  await repository(root);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const { item } = await task(root, 'create', '--size', 'M', 'Scoped', '--branch', 't/test');
  const rev = await spawnSpoke({ discover: true, cwd: root, name: 'scope-reviewer', role: 'reviewer' });
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
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  await startDaemon(t, root);
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
  const sha = await repository(root);
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
  await startDaemon(t, root);
  for (const verdict of [(await task(root, 'view', 'T-1')).item.verdicts[0]!, (await task(root, 'list')).items[0]!.verdicts[0]!]) {
    assert.equal(verdict.scope, undefined);
    assert.equal(verdict.source, 'hub');
    assert.deepEqual(verdict.writer, { sessionId: 'legacy-reviewer', role: 'reviewer' });
  }
  const reviewer = await spawnSpoke({ discover: true, cwd: root, name: 'new-reviewer', role: 'reviewer' });
  t.after(() => reviewer.close());
  const written = await reviewer.call<{ ok: boolean; item: ItemView }>('task.comment', { id: 'T-1', text: 'New check', verdict: 'review', result: 'not clear', run: 'scoped', scope: 'full' });
  assert.equal(written.ok, true);
  assert.equal(written.item.verdicts.at(-1)?.source, 'hub');
  await writeFile(file, (await readFile(file, 'utf8')).replace('scope: full', 'scope: delta'));
  const changed = await viewed(root, 'T-1', i => i.verdicts.at(-1)?.scope === 'delta');
  assert.equal(changed.verdicts[0]?.source, 'hub');
  assert.equal(changed.verdicts.at(-1)?.source, 'file');
});
