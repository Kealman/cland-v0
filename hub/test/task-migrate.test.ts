import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { cland, clandWithEnv, connectUi, spawnSpoke, startDaemon, tempProject } from './harness.ts';
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

test('migration preview through real hub, spokes and CLI plans changes without tracker writes', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const create = async (fields: Record<string, unknown>) => {
    const result = await ui.request({ type: 'task.create', ...fields });
    assert.equal(result.ok, true, JSON.stringify(result));
  };
  await create({ title: 'Release: v0.1.1', kind: 'release', version: '0.1.1' });
  await create({ title: 'Epic: Feature', kind: 'epic', parent: 'T-1' });
  await create({ title: 'Tech debt', kind: 'epic' });
  await create({ title: 'Task: Unscheduled debt', labels: ['tech-debt'] });
  await create({ title: 'Scheduled debt', labels: ['tech-debt'], parent: 'T-3', blocked_by: ['T-2'] });
  for (const [name, role] of [['coord', 'coordinator'], ['impl', 'implementer']] as const) {
    const spoke = await spawnSpoke({ discover: true, cwd: root, name, role, sessionId: `sess-${name}` });
    t.after(() => spoke.close());
    await spoke.waitForPresence([name]);
  }
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const beforeFiles = await filesSnapshot(root);
  const beforeIndex = indexSnapshot(root);
  const beforeJournal = await readFile(join(root, '.cland/journal.jsonl'), 'utf8');
  const plain = await cland(root, 'task', 'migrate', '--dry-run');
  assert.equal(plain.code, 0, plain.stderr);
  assert.match(plain.stdout, /rename T-1-release-v0-1-1.md → R-1-release-v0-1-1.md/);
  assert.match(plain.stdout, /parent T-5: T-3 → C-3/);
  assert.match(plain.stdout, /category C-3 Tech debt: epic → category/);
  assert.match(plain.stdout, /category create C-6-bugs.md/);
  assert.match(plain.stdout, /label T-4: remove tech-debt/);
  assert.match(plain.stdout, /move T-4: no parent → C-3/);
  const json = await cland(root, 'task', 'migrate', '--dry-run', '--json');
  assert.equal(json.code, 0, json.stderr);
  const plan: MigrationPlan = JSON.parse(json.stdout);
  assert.deepEqual(plan.ids.map(c => c.to), ['R-1', 'E-2', 'C-3']);
  assert.deepEqual(plan.categories.map(c => c.id), ['C-3', 'C-6', 'C-7', 'C-8']);
  const coord = await clandWithEnv(root, { CLAND_SESSION_NAME: 'coord', CLAND_SESSION_ID: 'sess-coord' }, 'task', 'migrate', '--dry-run', '--json');
  assert.equal(coord.code, 0, coord.stderr);
  assert.deepEqual(JSON.parse(coord.stdout), plan);
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  assert.deepEqual(await filesSnapshot(root), beforeFiles);
  assert.deepEqual(indexSnapshot(root), beforeIndex);
  const delta = (await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).slice(beforeJournal.length).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  assert.ok(delta.some(row => row.event === 'audit' && row.tool === 'task.migrate'));
  assert.ok(delta.every(row => row.event === 'audit'), JSON.stringify(delta));
  const refused = await clandWithEnv(root, { CLAND_SESSION_NAME: 'impl', CLAND_SESSION_ID: 'sess-impl' }, 'task', 'migrate', '--dry-run');
  assert.equal(refused.code, 1);
  assert.match(refused.stderr, /forbidden: task.migrate.*Coordinator or the human/);
  const frameRefused = await ui.request({ type: 'task.migrate', dryRun: true, as: { name: 'impl', sessionId: 'sess-impl', shell: true } });
  assert.equal(frameRefused.ok, false);
  assert.ok('code' in frameRefused);
  assert.equal(frameRefused.code, 'forbidden');
  const missingFlag = await cland(root, 'task', 'migrate');
  assert.equal(missingFlag.code, 1);
  assert.match(missingFlag.stderr, /migration itself is not built yet/);
  assert.equal((await ui.request({ type: 'task.migrate', dryRun: false })).ok, false);
});
