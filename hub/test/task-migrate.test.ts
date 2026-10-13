import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { preparedProject } from './prepared-project.ts';
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { cland, clandWithEnv, connectUi, eventually, flushProjectLogs, killDaemon, spawnSpoke, startDaemon, tempProject } from './harness.ts';
import type { MigrationPlan } from '../src/tracker/migrate.ts';

const indexSnapshot = (root: string) => {
  const db = new DatabaseSync(join(root, '.cland/hub.db'), { readOnly: true });
  try {
    const tables = db.prepare("select name from sqlite_master where type = 'table' and name like 'tracker_%' order by name").all();
    return tables.map(row => [row.name, db.prepare(`select * from "${String(row.name)}" order by rowid`).all()]);
  } finally { db.close(); }
};

const filesSnapshot = async (root: string) => {
  const dir = join(root, '.cland/tasks');
  return Promise.all((await readdir(dir)).sort().map(async name => [name, await readFile(join(dir, name), 'utf8')]));
};

test('offline closed backfill previews receipt, journal and commit sources and changes only closed lines once', async t => {
  const root = await preparedProject(t);
  await startDaemon(t, root);
  // Seed the categories in a separate maintenance window so this plan contains only closing times.
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  assert.equal((await cland(root, 'task', 'migrate')).code, 0);
  await startDaemon(t, root);
  const items: Array<{ id: string; path: string }> = [];
  for (const title of ['receipt', 'journal', 'commit', 'unresolved', 'already']) {
    const made = await cland(root, 'task', 'create', '--size', 'M', title, '--json');
    assert.equal(made.code, 0, made.stderr);
    const item = JSON.parse(made.stdout).item;
    items.push(item);
    assert.equal((await cland(root, 'task', 'close', item.id)).code, 0);
  }
  await flushProjectLogs(t, root);
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  // Legacy tracker copy: strip the new field and remove newer closes from the copied journal.
  for (const item of items.slice(0, 4)) {
    const path = join(root, item.path);
    await writeFile(path, (await readFile(path, 'utf8')).replace(/^closed:.*\n/m, '').replace(/^labels: \[\]/m, 'labels: [] # retain this hand formatting').replace(/^title: /m, 'title:   '));
  }
  const journal = join(root, '.cland/journal.jsonl');
  await writeFile(journal, [
    { event: 'task-written', op: 'close', id: items[0]!.id, ts: '2026-10-02T10:00:00.000Z' },
    { event: 'task-written', op: 'close', id: items[1]!.id, ts: '2026-10-01T10:00:00.000Z' },
    { event: 'task-written', op: 'close', id: items[1]!.id, ts: '2026-10-02T10:00:00.000Z' },
    { event: 'task-written', op: 'edit', id: items[3]!.id, ts: '2026-10-03T10:00:00.000Z' },
  ].map(r => JSON.stringify(r)).join('\n') + '\n');
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const commitTime = execFileSync('git', ['show', '-s', '--format=%cI', commit], { cwd: root, encoding: 'utf8' }).trim();
  const db = new DatabaseSync(join(root, '.cland/hub.db'));
  try {
    for (const [index, mergedAt] of [[0, '2026-10-03T10:00:00.000Z'], [1, null], [2, null]] as const) {
      db.prepare('insert into tracker_merges (item_id, branch, tip, base, commit_sha, merged_at) values (?, ?, ?, ?, ?, ?)').run(items[index]!.id, `t/${items[index]!.id}`, commit, 'dev', commit, mergedAt);
    }
  } finally { db.close(); }
  const before = await filesSnapshot(root), beforeIndex = indexSnapshot(root);
  const preview = await cland(root, 'task', 'migrate', '--dry-run', '--json');
  assert.equal(preview.code, 0, preview.stderr);
  const plan: MigrationPlan = JSON.parse(preview.stdout);
  assert.deepEqual(plan.closed.map(c => [c.item, c.time, c.source]), [
    [items[0]!.id, '2026-10-03T10:00:00.000Z', 'receipt'], [items[1]!.id, '2026-10-02T10:00:00.000Z', 'journal'], [items[2]!.id, commitTime, 'commit'],
  ]);
  assert.deepEqual(plan.unresolved.map(c => [c.item, c.field]), [[items[3]!.id, 'closed']]);
  assert.deepEqual(await filesSnapshot(root), before);
  assert.deepEqual(indexSnapshot(root), beforeIndex);
  assert.match((await cland(root, 'task', 'migrate', '--dry-run')).stdout, /closed T-\d+: .* \(receipt\)/);
  const applied = await cland(root, 'task', 'migrate', '--json');
  assert.equal(applied.code, 0, applied.stderr);
  assert.deepEqual(JSON.parse(applied.stdout), plan);
  const after = await filesSnapshot(root);
  assert.deepEqual(after.map(([name, text]) => [name, text!.replace(/^closed:.*\n/m, '')]), before.map(([name, text]) => [name, text!.replace(/^closed:.*\n/m, '')]));
  const noOpIndex = indexSnapshot(root);
  const rerun = await cland(root, 'task', 'migrate');
  assert.equal(rerun.code, 0, rerun.stderr);
  assert.match(rerun.stdout, /^nothing to do\n/);
  assert.match(rerun.stdout, /unresolved closed/);
  assert.deepEqual(await filesSnapshot(root), after);
  assert.deepEqual(indexSnapshot(root), noOpIndex);
  await startDaemon(t, root);
  const view = await cland(root, 'task', 'view', items[0]!.id, '--json');
  assert.equal(JSON.parse(view.stdout).item.closed, '2026-10-03T10:00:00.000Z');
});

test('offline migration matches its preview, preserves prose and resolves old ids after a real hub restart', async t => {
  const root = await tempProject(t);
  // New creates already use canonical prefixes; the migration preview needs actual legacy source files.
  const dir = join(root, '.cland/tasks');
  await mkdir(dir, { recursive: true });
  const fixtures = [
    ['T-1-release-v0-1-1.md', 1, 'release', 'Release: v0.1.1', 'version: 0.1.1\n'],
    ['T-2-epic-feature.md', 2, 'epic', 'Epic: Feature', 'parent: T-1\n'],
    ['T-3-tech-debt.md', 3, 'epic', 'Tech debt', ''],
    ['T-4-task-unscheduled-debt.md', 4, 'task', 'Task: Unscheduled debt', 'status: backlog\nlabels: [tech-debt]\n'],
    ['T-5-scheduled-debt.md', 5, 'task', 'Scheduled debt', 'status: backlog\nlabels: [tech-debt]\nparent: T-3\nblocked_by: [T-2]\n'],
  ] as const;
  for (const [file, n, kind, title, extra] of fixtures) {
    await writeFile(join(dir, file), `---\nid: T-${n}\nkind: ${kind}\ntitle: ${JSON.stringify(title)}\nstate: open\n${extra}---\n`);
  }
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  for (const [name, role] of [['coord', 'coordinator'], ['impl', 'implementer']] as const) {
    const spoke = await spawnSpoke({ discover: true, cwd: root, name, role, sessionId: `sess-${name}` });
    t.after(() => spoke.close());
    await spoke.waitForPresence([name]);
  }
  const running = await cland(root, 'task', 'migrate', '--dry-run');
  assert.equal(running.code, 1);
  assert.match(running.stderr, /hub.*running|stop.*hub/);
  const frameRefused = await ui.request({ type: 'task.migrate', dryRun: true });
  assert.equal(frameRefused.ok, false);
  await killDaemon(discovery.pid);
  const beforeFiles = await filesSnapshot(root);
  const beforeIndex = indexSnapshot(root);
  const plain = await cland(root, 'task', 'migrate', '--dry-run');
  assert.equal(plain.code, 0, plain.stderr);
  assert.match(plain.stdout, /rename T-1-release-v0-1-1.md → R-1-release-v0-1-1.md/);
  assert.match(plain.stdout, /category create C-6-bugs.md/);
  const json = await cland(root, 'task', 'migrate', '--dry-run', '--json');
  assert.equal(json.code, 0, json.stderr);
  const plan: MigrationPlan = JSON.parse(json.stdout);
  assert.deepEqual(plan.ids.map(c => c.to), ['R-1', 'E-2', 'C-3']);
  assert.deepEqual(plan.categories.map(c => c.id), ['C-3', 'C-6', 'C-7', 'C-8']);
  assert.deepEqual(await filesSnapshot(root), beforeFiles);
  assert.deepEqual(indexSnapshot(root), beforeIndex);
  const coord = await clandWithEnv(root, { CLAND_SESSION_NAME: 'coord', CLAND_SESSION_ID: 'sess-coord' }, 'task', 'migrate', '--dry-run', '--json');
  assert.equal(coord.code, 0, coord.stderr);
  assert.deepEqual(JSON.parse(coord.stdout), plan);
  const refused = await clandWithEnv(root, { CLAND_SESSION_NAME: 'impl', CLAND_SESSION_ID: 'sess-impl' }, 'task', 'migrate');
  assert.equal(refused.code, 1);
  assert.match(refused.stderr, /Coordinator or the human/);
  const applied = await cland(root, 'task', 'migrate', '--json');
  assert.equal(applied.code, 0, applied.stderr);
  assert.deepEqual(JSON.parse(applied.stdout), plan);
  const after = await filesSnapshot(root);
  const db = new DatabaseSync(join(root, '.cland/hub.db'), { readOnly: true });
  try {
    const rows = db.prepare('select file, kind, title, parent from tracker_items order by n').all();
    assert.deepEqual(rows.map(row => row.file), ['R-1-release-v0-1-1.md', 'E-2-epic-feature.md', 'C-3-tech-debt.md', 'T-4-task-unscheduled-debt.md', 'T-5-scheduled-debt.md', 'C-6-bugs.md', 'C-7-follow-ups.md', 'C-8-ideas.md']);
    assert.deepEqual(rows.map(row => row.kind), ['release', 'epic', 'category', 'task', 'task', 'category', 'category', 'category']);
    assert.deepEqual(rows.map(row => row.title), ['v0.1.1', 'Feature', 'Tech debt', 'Unscheduled debt', 'Scheduled debt', 'Bugs', 'Follow-ups', 'Ideas']);
  } finally { db.close(); }
  for (const [file, text] of beforeFiles) {
    const renamed = plan.renames.find(r => r.from === file)?.to ?? file;
    const migrated = after.find(([name]) => name === renamed)![1]!;
    assert.equal(migrated.slice(migrated.indexOf('\n---', 4) + 4), text!.slice(text!.indexOf('\n---', 4) + 4));
  }
  const noopIndex = indexSnapshot(root);
  const noop = await cland(root, 'task', 'migrate');
  assert.equal(noop.code, 0, noop.stderr);
  assert.equal(noop.stdout.trim(), 'nothing to do');
  assert.deepEqual(await filesSnapshot(root), after);
  assert.deepEqual(indexSnapshot(root), noopIndex);
  const restarted = await startDaemon(t, root);
  const newUi = await connectUi(t, restarted.discovery);
  const view = await cland(root, 'task', 'view', 'T-3', '--json');
  assert.equal(view.code, 0, view.stderr);
  assert.equal(JSON.parse(view.stdout).item.id, 'C-3');
  const list = await cland(root, 'task', 'list', '--json');
  assert.equal(list.code, 0, list.stderr);
  assert.deepEqual(JSON.parse(list.stdout).items.map((i: { id: string }) => i.id), ['R-1', 'E-2', 'C-3', 'T-4', 'T-5', 'C-6', 'C-7', 'C-8']);
  assert.equal((await newUi.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const rows = (await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  const records = rows.filter(row => row.event === 'task-migrated');
  assert.equal(records.length, 1);
  assert.equal(records[0].by, 'human');
  assert.equal(records[0].counts.renames, 3);
});

// Lock and recovery fixtures are on disk because the command deliberately cannot
// run in the serving hub. No test-only production hook is involved.
test('offline migration refuses disk locks and recovery records without changing files or the index', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland/tasks'), { recursive: true });
  await writeFile(join(root, '.cland/tasks/T-1-epic.md'), '---\nid: T-1\nkind: epic\ntitle: "Epic: Work"\nstate: open\n---\nBody T-1\n');
  const { discovery } = await startDaemon(t, root);
  await killDaemon(discovery.pid);
  const before = await filesSnapshot(root), index = indexSnapshot(root);
  const cases = [
    ['.cland/territory.lock', /merge or territory operation/],
    ['.cland/tracker.lock', /tracker write/],
    ['.cland/tasks/.criterion-capture-1234.json', /criterion capture/],
    ['.cland/tasks/.T-1-epic.md.123.tmp', /tracker write/],
    ['.cland/sync.tmp', /sync recovery/],
    ['.cland/release.tmp', /release recovery/],
  ] as const;
  const { rm } = await import('node:fs/promises');
  for (const [path, reason] of cases) {
    await writeFile(join(root, path), '{}');
    for (const args of [[], ['--dry-run']]) {
      const result = await cland(root, 'task', 'migrate', ...args);
      assert.equal(result.code, 1, result.stdout);
      assert.match(result.stderr, reason);
    }
    await rm(join(root, path));
    assert.deepEqual(await filesSnapshot(root), before);
    assert.deepEqual(indexSnapshot(root), index);
  }
  const db = new DatabaseSync(join(root, '.cland/hub.db'));
  db.prepare('insert into tracker_merges (item_id, branch, tip, base, commit_sha, merged_at) values (?, ?, ?, ?, ?, ?)').run('T-1', 'task', 'tip', 'dev', 'commit', new Date().toISOString());
  db.close();
  const pending = await cland(root, 'task', 'migrate');
  assert.equal(pending.code, 1);
  assert.match(pending.stderr, /merge receipt prepared but unfinished/);
  assert.deepEqual(await filesSnapshot(root), before);
  const clear = new DatabaseSync(join(root, '.cland/hub.db'));
  clear.exec('delete from tracker_merges'); clear.close();
  await writeFile(join(root, '.cland/config.toml'), '[tracker]\nlevels = ["release", "epic"]\n');
  const ladder = await cland(root, 'task', 'migrate');
  assert.equal(ladder.code, 1);
  assert.match(ladder.stderr, /cland update.*restart the hub/);
  assert.deepEqual(await filesSnapshot(root), before);
  assert.deepEqual(indexSnapshot(root), index);
});

test('a renamed file with its old id completes after interruption without duplicate numbers', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland/tasks'), { recursive: true });
  const prose = '\nBody T-1.\n\n## Comments\n\n### human · 2026-01-01T00:00:00Z\n\nKeep T-1 here.\n';
  await writeFile(join(root, '.cland/tasks/R-1-old-slug.md'), '---\nid: T-1\nkind: release\ntitle: "Release: Ship"\nstate: open\ncreated: 2026-01-01T00:00:00Z\nupdated: 2026-01-01T00:00:00Z\ncustom: untouched\n---\n' + prose);
  const run = await cland(root, 'task', 'migrate', '--json');
  assert.equal(run.code, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout).renames, []);
  const files = await filesSnapshot(root);
  assert.equal(files.filter(([name]) => name!.includes('-1-')).length, 1);
  const text = await readFile(join(root, '.cland/tasks/R-1-old-slug.md'), 'utf8');
  assert.ok(text.endsWith(prose));
  assert.match(text, /custom: untouched/);
  assert.match(text, /id: R-1/);
  const restarted = await startDaemon(t, root);
  const ui = await connectUi(t, restarted.discovery);
  const view = await ui.request({ type: 'task.view', item: 'T-1' });
  assert.equal(view.ok, true, view.error);
  assert.equal((view.value as { item: { id: string } }).item.id, 'R-1');
});

const git = (root: string, ...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
for (const editContainer of [false, true]) test(`an older task branch lands after migration (container edit: ${editContainer})`, async t => {
  const root = await preparedProject(t);
  const dir = join(root, '.cland/tasks');
  await mkdir(dir, { recursive: true });
  const container = 'T-1-legacy-epic.md';
  const prose = '\n' + 'Unchanged legacy prose T-1.\n'.repeat(40);
  await writeFile(join(dir, container), '---\nid: T-1\nkind: epic\ntitle: "Epic: Old container"\nstate: open\n---\n' + prose);
  await writeFile(join(dir, 'T-2-work.md'), '---\nid: T-2\nkind: task\ntitle: Work\nstate: open\nstatus: backlog\nparent: T-1\n---\n');
  git(root, 'add', '.cland/tasks'); git(root, 'commit', '-qm', 'Legacy tracker');
  let { discovery } = await startDaemon(t, root);
  assert.equal((await cland(root, 'push')).code, 0);
  const claim = await cland(root, 'task', 'claim', 'T-2', '--json');
  assert.equal(claim.code, 0, claim.stderr);
  const work = JSON.parse(claim.stdout).worktree;
  await writeFile(join(work.path, 'feature.txt'), 'Migrated branch works\n');
  git(work.path, 'add', 'feature.txt');
  if (editContainer) {
    await writeFile(join(work.path, '.cland/tasks', container), (await readFile(join(work.path, '.cland/tasks', container), 'utf8')) + 'Branch prose edit.\n');
    git(work.path, 'add', '.cland/tasks');
  }
  git(work.path, 'commit', '-qm', 'Feature on old tracker');
  git(work.path, 'push', '-q', 'origin', work.branch);
  const linked = await cland(work.path, 'task', 'migrate');
  assert.equal(linked.code, 1);
  assert.match(linked.stderr, /project root.*linked worktree/);
  await killDaemon(discovery.pid);
  const migration = await cland(root, 'task', 'migrate', '--json');
  assert.equal(migration.code, 0, migration.stderr);
  const migrated = await filesSnapshot(root);
  git(root, 'add', '.cland/tasks');
  assert.match(git(root, 'diff', '--cached', '--stat', '-M'), /legacy-epic/);
  git(root, 'commit', '-qm', 'Prefix migration');
  ({ discovery } = await startDaemon(t, root));
  assert.equal((await cland(root, 'push')).code, 0);
  const rev = await spawnSpoke({ discover: true, cwd: root, name: 'rev', role: 'reviewer', sessionId: 'sess-rev' });
  t.after(() => rev.close());
  await rev.waitForPresence(['rev']);
  const verdict = await rev.call<{ ok: boolean; error?: string }>('task.comment', { id: 'T-2', verdict: 'review', result: 'clear', run: 'migration-merge' });
  assert.equal(verdict.ok, true, verdict.error);
  await eventually('review ready', async () => {
    const view = await cland(root, 'task', 'view', 'T-2', '--json');
    return JSON.parse(view.stdout).item.status === 'ready' ? true : undefined;
  });
  const merged = await cland(root, 'merge', 'T-2', '--json');
  if (editContainer && merged.code !== 0) {
    assert.match(merged.stderr, /merge-conflict.*legacy-epic/s);
  } else {
    assert.equal(merged.code, 0, merged.stderr);
    assert.equal(await readFile(join(root, 'feature.txt'), 'utf8'), 'Migrated branch works\n');
    const renamed = await readFile(join(dir, 'E-1-legacy-epic.md'), 'utf8');
    const expected = migrated.find(([name]) => name === 'E-1-legacy-epic.md')![1]!;
    assert.equal(renamed, expected + (editContainer ? 'Branch prose edit.\n' : ''));
    for (const [name, text] of migrated) if (name !== 'T-2-work.md' && name !== 'E-1-legacy-epic.md') assert.equal(await readFile(join(dir, name!), 'utf8'), text);
    const closed = await cland(root, 'task', 'view', 'T-2', '--json');
    assert.equal(JSON.parse(closed.stdout).item.merged, true);
    assert.match(await readFile(join(dir, 'T-2-work.md'), 'utf8'), /Merged/);
  }
  assert.ok(!(await readdir(dir)).includes(container));
  assert.equal((await readdir(dir)).filter(name => /^[A-Z]-1-/.test(name)).length, 1);
});

test('fully migrated files repair a stale final index row, then a clean rerun writes nothing', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland/tasks'), { recursive: true });
  await writeFile(join(root, '.cland/tasks/T-1-release.md'), '---\nid: T-1\nkind: release\ntitle: "Release: Ship"\nstate: open\n---\nKeep T-1.\n');
  const initial = await cland(root, 'task', 'migrate', '--json');
  assert.equal(initial.code, 0, initial.stderr);
  const beforeFiles = await filesSnapshot(root), beforeIndex = indexSnapshot(root);
  const fileTimes = () => Promise.all(beforeFiles.map(async ([name]) => [name, (await stat(join(root, '.cland/tasks', name!), { bigint: true })).mtimeNs]));
  const beforeTimes = await fileTimes();
  const db = new DatabaseSync(join(root, '.cland/hub.db'));
  // Simulate file publication completing before its derived index write. The
  // already-migrated tree has no file-plan steps left on the next invocation.
  db.prepare('delete from tracker_items where n = ?').run(5);
  db.prepare('update tracker_items set hash = ? where n = ?').run('stale', 1);
  db.close();
  const preview = await cland(root, 'task', 'migrate', '--dry-run', '--json');
  assert.equal(preview.code, 0, preview.stderr);
  assert.ok(Object.entries(JSON.parse(preview.stdout)).every(([, changes]) => Array.isArray(changes) && changes.length === 0));
  const staleIndex = indexSnapshot(root);
  const resumed = await cland(root, 'task', 'migrate', '--json');
  assert.equal(resumed.code, 0, resumed.stderr);
  assert.deepEqual(JSON.parse(resumed.stdout), JSON.parse(preview.stdout));
  assert.deepEqual(await filesSnapshot(root), beforeFiles);
  assert.deepEqual(await fileTimes(), beforeTimes);
  const recoveredIndex = indexSnapshot(root);
  assert.notDeepEqual(recoveredIndex, staleIndex);
  const rows = recoveredIndex.find(([name]) => name === 'tracker_items')![1] as Array<{ file: string; hash: string }>;
  const original = beforeIndex.find(([name]) => name === 'tracker_items')![1] as Array<{ file: string; hash: string }>;
  assert.deepEqual(rows.map(row => [row.file, row.hash]).sort(), original.map(row => [row.file, row.hash]).sort());
  const beforeLog = await readFile(join(root, '.cland/log/hub.log'), 'utf8');
  const beforeJournal = await readFile(join(root, '.cland/journal.jsonl'), 'utf8');
  const clean = await cland(root, 'task', 'migrate');
  assert.equal(clean.code, 0, clean.stderr);
  assert.equal(clean.stdout.trim(), 'nothing to do');
  assert.deepEqual(await filesSnapshot(root), beforeFiles);
  assert.deepEqual(indexSnapshot(root), recoveredIndex);
  assert.deepEqual(await fileTimes(), beforeTimes);
  assert.equal(await readFile(join(root, '.cland/log/hub.log'), 'utf8'), beforeLog);
  assert.equal(await readFile(join(root, '.cland/journal.jsonl'), 'utf8'), beforeJournal);
});

test('offline size backfill uses explicit decisions, previews without writes and applies once', async t => {
  const root = await preparedProject(t);
  await startDaemon(t, root);
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  assert.equal((await cland(root, 'task', 'migrate')).code, 0);
  const dir = join(root, '.cland/tasks');
  for (const [n, kind, state, size] of [[328, 'task', 'open', ''], [329, 'task', 'open', 'size: XL\n'], [330, 'task', 'closed', ''], [331, 'task', 'open', ''], [332, 'epic', 'open', '']] as const) {
    await writeFile(join(dir, `${kind === 'epic' ? 'E' : 'T'}-${n}-legacy.md`), `---\nid: T-${n}\nkind: ${kind}\ntitle: Legacy\nstate: ${state}\n${kind === 'task' ? `status: ${state === 'closed' ? 'done' : 'backlog'}\n` : ''}${size}labels: [] # keep my formatting\n---\n\n## Summary\n\nLegacy body.\n`);
  }
  // Get canonical prefixes and index in sync before the isolated size backfill.
  assert.equal((await cland(root, 'task', 'migrate')).code, 0);
  const sizesFile = join(root, 'sizes.json');
  await writeFile(sizesFile, JSON.stringify({ 'E-328': 'M', 'T-329': 'S', 'T-330': 'L' }));
  const beforeFiles = await filesSnapshot(root), beforeDb = indexSnapshot(root);
  const preview = await cland(root, 'task', 'migrate', '--sizes', sizesFile, '--dry-run', '--json');
  assert.equal(preview.code, 0, preview.stderr);
  const plan = JSON.parse(preview.stdout) as MigrationPlan;
  assert.deepEqual(plan.sizes.map(c => [c.item, c.size]), [['T-328', 'M']]);
  assert.ok(plan.unresolved.some(c => c.item === 'T-331' && c.field === 'size'));
  assert.deepEqual(await filesSnapshot(root), beforeFiles);
  assert.deepEqual(indexSnapshot(root), beforeDb);
  const applied = await cland(root, 'task', 'migrate', '--sizes', sizesFile, '--json');
  assert.equal(applied.code, 0, applied.stderr);
  assert.deepEqual(JSON.parse(applied.stdout), plan);
  const changed = await filesSnapshot(root);
  for (const [file, text] of beforeFiles) {
    const after = changed.find(([name]) => name === file)![1];
    assert.equal(file!.startsWith('T-328-') ? after!.replace(/^size: M\n/m, '') : after, text, file);
  }
  const dbAfter = indexSnapshot(root);
  const rerun = await cland(root, 'task', 'migrate', '--sizes', sizesFile);
  assert.equal(rerun.code, 0, rerun.stderr);
  assert.match(rerun.stdout, /nothing to do/);
  assert.deepEqual(await filesSnapshot(root), changed);
  assert.deepEqual(indexSnapshot(root), dbAfter);
  for (const invalid of [{ 'T-332': 'S' }, { '999': 'L' }, { '328': 'XXL' }, { 'T-328': 'M', 'E-328': 'L' }]) {
    await writeFile(sizesFile, JSON.stringify(invalid));
    const refused = await cland(root, 'task', 'migrate', '--sizes', sizesFile);
    assert.equal(refused.code, 1);
    assert.match(refused.stderr, /sizes file/);
    assert.deepEqual(await filesSnapshot(root), changed);
    assert.deepEqual(indexSnapshot(root), dbAfter);
  }
  await startDaemon(t, root);
  for (const id of ['T-328', 'E-328', '328']) {
    const result = await cland(root, 'task', 'view', id, '--json');
    assert.equal(result.code, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).item.size, 'M');
  }
  const live = await cland(root, 'task', 'migrate', '--sizes', sizesFile, '--dry-run');
  assert.equal(live.code, 1);
  assert.match(live.stderr, /hub is running/);
});
