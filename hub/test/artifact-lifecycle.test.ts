// Real hub frames and the daily job seam, with only filesystem/SQLite system boundaries faulted.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { fixedRoles } from '../src/roles/config.ts';
import { Store } from '../src/hub/store.ts';
import { ArtifactLifecycle, type ArtifactFiles } from '../src/hub/artifact-lifecycle.ts';
import type { Artifact } from '../src/protocol.ts';
import { createSocketEdge } from '../src/hub/socket.ts';
import { connectUi, eventually, startHub, tempProject, TEST_SECRET } from './harness.ts';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
}
async function fixture(t: TestContext, files: ArtifactFiles = fs, retentionDays = 0) {
  const root = await tempProject(t);
  const dbPath = join(root, 'hub.db');
  const records: Record<string, unknown>[] = [];
  let publicationLogFails = false;
  const failPublicationLog = () => { publicationLogFails = true; };
  const hub = await startHub({ store: new Store(dbPath), roles: fixedRoles(), artifactFiles: files, artifactRetentionDays: retentionDays,
    log: r => { records.push(r); if (publicationLogFails && r.event === 'listener-failed') throw new Error('publication error logger failed'); },
    control: { status: () => ({ root, pid: process.pid, port: 0, socket: '', version: 'test', startedAt: new Date().toISOString(), uptimeMs: 0 }), stop() {} },
  });
  t.after(() => hub.close());
  const socket = join(root, 'hub.sock');
  const edge = await createSocketEdge({ path: socket, dispatcher: hub.dispatcher });
  t.after(() => edge.close());
  const ui = await connectUi(t, { socket, secret: TEST_SECRET }, 'cli');
  const topic = ((await ui.request({ type: 'topic.create', title: 'Design' })).value as { topic: { id: string } }).topic.id;
  const a = ((await ui.request({ type: 'artifact.create', kind: 'note', title: 'Design', content: 'original bytes', topic })).value as { artifact: Artifact }).artifact;
  const entries = async () => ((await ui.request({ type: 'artifact.list' })).value as { artifacts: Artifact[] }).artifacts;
  const db = new DatabaseSync(dbPath);
  t.after(() => db.close());
  return { root, hub, ui, topic, a, entries, db, records, failPublicationLog };
}

test('a promotion copying while its topic closes preserves the promotion and excludes it from cleanup', async t => {
  const copying = deferred(), release = deferred();
  t.after(() => release.resolve());
  const f = await fixture(t, { ...fs, copyFile: async (...args) => { copying.resolve(); await release.promise; return fs.copyFile(...args); } });
  const operation = f.ui.request({ type: 'artifact.promote', artifact: f.a.id, path: 'docs/design.md' });
  await copying.promise;
  await f.ui.request({ type: 'topic.close', topic: f.topic });
  f.hub.prune(); // skip the reserved artifact
  release.resolve();
  assert.equal((await operation).ok, true);
  assert.equal((await f.entries())[0]?.promoted, 'docs/design.md');
  f.hub.prune();
  assert.equal(await fs.readFile(f.a.path, 'utf8'), 'original bytes');
  assert.equal(await fs.readFile(join(f.root, 'docs/design.md'), 'utf8'), 'original bytes');
});

test('closing before promotion copies the file and removes its archive mark', async t => {
  const f = await fixture(t);
  await f.ui.request({ type: 'topic.close', topic: f.topic });
  const result = await f.ui.request({ type: 'artifact.promote', artifact: f.a.id, path: 'docs/design.md' });
  assert.equal(result.ok, true);
  const a = (await f.entries())[0];
  assert.equal(a?.status, 'shared');
  assert.equal(a?.archivedAt, undefined);
  assert.equal(a?.promoted, 'docs/design.md');
});

test('promotion failure before copy and after copy leaves no destination or promotion mark', async t => {
  let failCopy = true;
  const f = await fixture(t, { ...fs, copyFile: async (...args) => { if (failCopy) throw new Error('copy failed'); return fs.copyFile(...args); } });
  const promote = () => f.ui.request({ type: 'artifact.promote', artifact: f.a.id, path: 'design.md' });
  assert.equal((await promote()).ok, false);
  await assert.rejects(fs.readFile(join(f.root, 'design.md')), { code: 'ENOENT' });
  failCopy = false;
  f.db.exec("create trigger reject_promote before update on artifacts when json_extract(new.value, '$.promoted') is not null begin select raise(ABORT, 'index failed'); end");
  assert.equal((await promote()).ok, false);
  await assert.rejects(fs.readFile(join(f.root, 'design.md')), { code: 'ENOENT' });
  assert.equal((await f.entries())[0]?.promoted, undefined);
  assert.equal(await fs.readFile(f.a.path, 'utf8'), 'original bytes');
  f.db.exec('drop trigger reject_promote');
  assert.equal((await promote()).ok, true, 'failure released the reservation');
});

test('reopening during cleanup unlink restores the retained bytes; promotion during deletion is refused', async t => {
  const deleting = deferred(), release = deferred();
  t.after(() => release.resolve());
  const f = await fixture(t, { ...fs, unlink: async path => {
    if (!String(path).endsWith('.retained')) { deleting.resolve(); await release.promise; }
    return fs.unlink(path);
  } });
  await f.ui.request({ type: 'topic.close', topic: f.topic });
  f.hub.prune();
  await deleting.promise;
  const promoted = await f.ui.request({ type: 'artifact.promote', artifact: f.a.id, path: 'design.md' });
  assert.equal(promoted.ok, false);
  assert.equal((promoted as { code?: string }).code, 'artifact-busy');
  await f.ui.request({ type: 'topic.send', topic: f.topic, text: 'Reopen' });
  release.resolve();
  await eventually('bytes restored after reopen', async () => await fs.readFile(f.a.path, 'utf8').catch(() => '') === 'original bytes' &&
    (await fs.readdir(join(f.root, '.cland/artifacts'))).every(p => !p.endsWith('.retained')) ? true : undefined);
  assert.equal((await f.entries())[0]?.status, 'shared');
  assert.equal((await f.entries())[0]?.fileDeleted, undefined);
});

test('reopening before cleanup leaves the shared file alone, and deletion before reopen stays deleted', async t => {
  const f = await fixture(t);
  await f.ui.request({ type: 'topic.close', topic: f.topic });
  await f.ui.request({ type: 'topic.send', topic: f.topic, text: 'Reopen' });
  f.hub.prune();
  assert.equal(await fs.readFile(f.a.path, 'utf8'), 'original bytes');
  await f.ui.request({ type: 'topic.close', topic: f.topic });
  f.hub.prune();
  await eventually('deletion committed', async () => (await f.entries())[0]?.fileDeleted ? true : undefined);
  await f.ui.request({ type: 'topic.send', topic: f.topic, text: 'Reopen again' });
  assert.equal((await f.entries())[0]?.fileDeleted, true);
  await assert.rejects(fs.readFile(f.a.path), { code: 'ENOENT' });
});

test('cleanup restores bytes on delete or index failure, retries, and preserves unexpired archives', async t => {
  let failDelete = true;
  const f = await fixture(t, { ...fs, unlink: async path => {
    if (failDelete && !String(path).endsWith('.retained')) throw new Error('delete failed');
    return fs.unlink(path);
  } });
  await f.ui.request({ type: 'topic.close', topic: f.topic });
  f.hub.prune();
  await eventually('delete failure reported', async () => f.records.find(r => r.event === 'artifact-cleanup-failed'));
  assert.equal(await fs.readFile(f.a.path, 'utf8'), 'original bytes');
  assert.equal((await f.entries())[0]?.fileDeleted, undefined);
  failDelete = false;
  f.db.exec("create trigger reject_deleted before update on artifacts when json_extract(new.value, '$.fileDeleted') = 1 begin select raise(ABORT, 'index failed'); end");
  f.records.length = 0;
  f.hub.prune();
  await eventually('index failure reported', async () => f.records.find(r => r.event === 'artifact-cleanup-failed'));
  assert.equal(await fs.readFile(f.a.path, 'utf8'), 'original bytes');
  assert.equal((await f.entries())[0]?.fileDeleted, undefined);
  f.db.exec('drop trigger reject_deleted');
  f.hub.prune();
  await eventually('retry commits deletion', async () => (await f.entries())[0]?.fileDeleted ? true : undefined);
  await assert.rejects(fs.readFile(f.a.path), { code: 'ENOENT' });

  const recent = await fixture(t, fs, 30);
  await recent.ui.request({ type: 'topic.close', topic: recent.topic });
  recent.hub.prune();
  assert.equal(await fs.readFile(recent.a.path, 'utf8'), 'original bytes');
  assert.equal((await recent.entries())[0]?.fileDeleted, undefined);
});

test('revoking the Coordinator during a promotion rolls back its copy and releases the reservation', async t => {
  const copying = deferred(), release = deferred();
  t.after(() => release.resolve());
  const f = await fixture(t, { ...fs, copyFile: async (...args) => { copying.resolve(); await release.promise; return fs.copyFile(...args); } });
  assert.equal((await f.ui.request({ type: 'role.set', session: 'coord', role: 'coordinator' })).ok, true);
  const operation = f.ui.request({ type: 'artifact.promote', artifact: f.a.id, path: 'design.md', as: { name: 'coord' } });
  await copying.promise;
  const busy = await f.ui.request({ type: 'artifact.promote', artifact: f.a.id, path: 'other.md' });
  assert.equal((busy as { code?: string }).code, 'artifact-busy');
  await f.ui.request({ type: 'role.clear', session: 'coord' });
  release.resolve();
  const result = await operation;
  assert.equal(result.ok, false);
  assert.equal((result as { code?: string }).code, 'forbidden');
  await assert.rejects(fs.readFile(join(f.root, 'design.md')), { code: 'ENOENT' });
  assert.equal((await f.entries())[0]?.promoted, undefined);
  assert.equal((await f.ui.request({ type: 'artifact.promote', artifact: f.a.id, path: 'design.md' })).ok, true);
});

test('a retained recovery link restores bytes even when the topic reopened before the next sweep', async t => {
  const f = await fixture(t);
  await f.ui.request({ type: 'topic.close', topic: f.topic });
  await fs.link(f.a.path, f.a.path + '.retained');
  await fs.unlink(f.a.path); // the on-disk state of an interrupted cleanup, before its index write
  await f.ui.request({ type: 'topic.send', topic: f.topic, text: 'Reopen before sweep' });
  f.hub.prune();
  await eventually('interrupted cleanup recovered for open topic', async () => await fs.readFile(f.a.path, 'utf8').catch(() => '') === 'original bytes' ? true : undefined);
  assert.equal((await f.entries())[0]?.status, 'shared');
  assert.equal((await f.entries())[0]?.fileDeleted, undefined);
});

test('a failed retention housekeeping step is retried without blocking deletion of other artifacts', async t => {
  let failBackupRemoval = true;
  const f = await fixture(t, { ...fs, unlink: async path => {
    if (failBackupRemoval && String(path).endsWith('.retained')) throw new Error('backup delete failed');
    return fs.unlink(path);
  } });
  const another = ((await f.ui.request({ type: 'artifact.create', kind: 'file', title: 'Another', content: 'more bytes', topic: f.topic })).value as { artifact: Artifact }).artifact;
  await f.ui.request({ type: 'topic.close', topic: f.topic });
  f.hub.prune();
  await eventually('all eligible entries deleted despite housekeeping failures', async () => (await f.entries()).every(a => a.fileDeleted) ? true : undefined);
  assert.equal(await fs.readFile(f.a.path + '.retained', 'utf8'), 'original bytes');
  assert.equal(await fs.readFile(another.path + '.retained', 'utf8'), 'more bytes');
  failBackupRemoval = false;
  f.hub.prune();
  await eventually('retained backups removed on retry', async () => (await fs.readdir(join(f.root, '.cland/artifacts'))).length === 0 ? true : undefined);
});

test('a failed promotion rollback names the unindexed copy when both the index and filesystem refuse writes', async t => {
  const f = await fixture(t, { ...fs, unlink: async path => {
    if (String(path).endsWith('design.md')) throw new Error('rollback denied');
    return fs.unlink(path);
  } });
  f.db.exec("create trigger reject_promote before update on artifacts when json_extract(new.value, '$.promoted') is not null begin select raise(ABORT, 'index failed'); end");
  const result = await f.ui.request({ type: 'artifact.promote', artifact: f.a.id, path: 'design.md' });
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /rollback could not remove .*design.md; remove this unindexed copy before retrying/);
  assert.equal((await f.entries())[0]?.promoted, undefined);
  assert.equal(await fs.readFile(join(f.root, 'design.md'), 'utf8'), 'original bytes');
});

test('the post-copy confinement check refuses and removes bytes redirected outside by a replaced parent', async t => {
  const copying = deferred(), release = deferred();
  t.after(() => release.resolve());
  const f = await fixture(t, { ...fs, copyFile: async (...args) => { copying.resolve(); await release.promise; return fs.copyFile(...args); } });
  const outside = await tempProject(t);
  const operation = f.ui.request({ type: 'artifact.promote', artifact: f.a.id, path: 'docs/design.md' });
  await copying.promise;
  await fs.rename(join(f.root, 'docs'), join(f.root, 'previous-docs'));
  await fs.symlink(outside, join(f.root, 'docs'));
  release.resolve();
  const result = await operation;
  assert.equal(result.ok, false);
  assert.equal((result as { code?: string }).code, 'artifact-path');
  assert.equal((await f.entries())[0]?.promoted, undefined);
  assert.deepEqual(await fs.readdir(outside), []);
});

test('retention deletes expired archives after their closed topic is deleted', async t => {
  const f = await fixture(t);
  await f.ui.request({ type: 'topic.close', topic: f.topic });
  assert.equal((await f.ui.request({ type: 'topic.delete', topic: f.topic })).ok, true);
  f.hub.prune();
  await eventually('archive expires without its topic', async () => (await f.entries())[0]?.fileDeleted ? true : undefined);
  await assert.rejects(fs.readFile(f.a.path), { code: 'ENOENT' });
});

test('post-commit promotion publication failure keeps both bytes and mark and reports a follow-up', async t => {
  const f = await fixture(t);
  const lifecycle = new ArtifactLifecycle(f.hub.core.store, f.root, () => { throw new Error('publication failed'); });
  const result = await lifecycle.promote(f.a.id, 'design.md', () => {});
  assert.equal(result.artifact.promoted, 'design.md');
  assert.match(result.followUp?.error ?? '', /publication failed/);
  assert.equal(await fs.readFile(join(f.root, 'design.md'), 'utf8'), 'original bytes');
  assert.equal((await f.entries())[0]?.promoted, 'design.md');
  const retry = await f.ui.request({ type: 'artifact.promote', artifact: f.a.id, path: 'retry.md' });
  assert.equal(retry.ok, false);
  assert.match(retry.error ?? '', /already promoted/);
  assert.equal(await fs.readFile(join(f.root, 'design.md'), 'utf8'), 'original bytes');
});

test('subscriber and publication-error-logger faults cannot undo promotion, archive or reopen commits', async t => {
  const f = await fixture(t);
  const shared = ((await f.ui.request({ type: 'artifact.create', kind: 'note', title: 'Shared', content: 'shared bytes', topic: f.topic })).value as { artifact: Artifact }).artifact;
  f.failPublicationLog();
  f.hub.core.subscribe(e => { if (e.type === 'artifact') throw new Error('subscriber failed'); });
  assert.equal((await f.ui.request({ type: 'artifact.promote', artifact: f.a.id, path: 'design.md' })).ok, true);
  assert.equal(await fs.readFile(join(f.root, 'design.md'), 'utf8'), 'original bytes');
  assert.equal((await f.ui.request({ type: 'topic.close', topic: f.topic })).ok, true);
  assert.equal((await f.entries()).find(a => a.id === shared.id)?.status, 'archived');
  assert.equal((await f.ui.request({ type: 'topic.send', topic: f.topic, text: 'Reopen' })).ok, true);
  assert.equal((await f.entries()).find(a => a.id === shared.id)?.status, 'shared');
  assert.equal(await fs.readFile(shared.path, 'utf8'), 'shared bytes');
  assert.equal((await f.entries()).find(a => a.id === f.a.id)?.promoted, 'design.md');
});

test('a cleanup notification failure after the index commit keeps deletion consistent and permits retry', async t => {
  const f = await fixture(t);
  await f.ui.request({ type: 'topic.close', topic: f.topic });
  const lifecycle = new ArtifactLifecycle(f.hub.core.store, f.root, () => { throw new Error('publication failed'); });
  await assert.rejects(lifecycle.cleanup(0), /publication failed/);
  assert.equal((await f.entries())[0]?.fileDeleted, true);
  await assert.rejects(fs.readFile(f.a.path), { code: 'ENOENT' });
  assert.equal(await fs.readFile(f.a.path + '.retained', 'utf8'), 'original bytes');
  await lifecycle.cleanup(0);
  await assert.rejects(fs.readFile(f.a.path + '.retained'), { code: 'ENOENT' });
  assert.equal((await f.entries())[0]?.fileDeleted, true);
});
