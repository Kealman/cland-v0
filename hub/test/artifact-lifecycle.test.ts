// Real hub frames and the daily job seam, with only filesystem/SQLite system boundaries faulted.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { fixedRoles } from '../src/roles/config.ts';
import { Sessions } from '../src/adapters/sessions.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { Store } from '../src/hub/store.ts';
import { ArtifactLifecycle, type ArtifactFiles } from '../src/hub/artifact-lifecycle.ts';
import { PROTOCOL_VERSION, type Message, type Artifact } from '../src/protocol.ts';
import { createSocketEdge } from '../src/hub/socket.ts';
import { connectSocket, connectUi, eventually, startHub, tempProject, TEST_SECRET } from './harness.ts';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
}
async function fixture(t: TestContext, files: ArtifactFiles = fs, retentionDays = 0, eventLimitMax = 120, folder = false) {
  const root = await tempProject(t);
  const dbPath = join(root, 'hub.db');
  const records: Record<string, unknown>[] = [];
  let publicationLogFails = false;
  let postLogFails = false;
  let eventLogFails = false;
  const failEventLog = () => { eventLogFails = true; };
  const failPost = (fail: boolean) => { postLogFails = fail; };
  const failPublicationLog = () => { publicationLogFails = true; };
  const hub = await startHub({ store: new Store(dbPath), roles: fixedRoles(), artifactFiles: files, artifactRetentionDays: retentionDays, eventLimit: { max: eventLimitMax, windowMs: 600_000 },
    log: r => { records.push(r); if (eventLogFails && r.event === 'event-delivery') throw new Error('event journal failed'); if (postLogFails && r.event === 'human-send') throw new Error('post failed inside artifact transaction'); if (publicationLogFails && r.event === 'listener-failed') throw new Error('publication error logger failed'); },
    control: { status: () => ({ root, pid: process.pid, port: 0, socket: '', version: 'test', startedAt: new Date().toISOString(), uptimeMs: 0 }), stop() {} },
  });
  t.after(() => hub.close());
  const socket = join(root, 'hub.sock');
  const edge = await createSocketEdge({ path: socket, dispatcher: hub.dispatcher });
  t.after(() => edge.close());
  const ui = await connectUi(t, { socket, secret: TEST_SECRET }, 'cli');
  const topic = ((await ui.request({ type: 'topic.create', title: 'Design' })).value as { topic: { id: string } }).topic.id;
  await ui.request({ type: 'role.set', session: 'coord', role: 'coordinator' });
  const a = ((await ui.request({ type: 'artifact.create', as: { name: 'coord' }, kind: 'note', title: 'Design', content: 'original bytes', topic, ...(folder ? { folder: true } : {}) })).value as { artifact: Artifact }).artifact;
  const entries = async () => ((await ui.request({ type: 'artifact.list' })).value as { artifacts: Artifact[] }).artifacts;
  const db = new DatabaseSync(dbPath);
  t.after(() => db.close());
  return { root, hub, ui, topic, a, entries, db, records, failPublicationLog, failPost, failEventLog };
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
  const another = ((await f.ui.request({ type: 'artifact.create', kind: 'file', title: 'Another', content: 'more bytes', as: { name: 'coord' }, topic: f.topic })).value as { artifact: Artifact }).artifact;
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
  const shared = ((await f.ui.request({ type: 'artifact.create', kind: 'note', title: 'Shared', content: 'shared bytes', as: { name: 'coord' }, topic: f.topic })).value as { artifact: Artifact }).artifact;
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

test('artifact subscriptions publish only after the existing artifact/post transaction commits', async t => {
  const f = await fixture(t);
  await f.ui.request({ type: 'subscribe' });
  await f.ui.request({ type: 'role.set', session: 'observer', role: 'reviewer' });
  const socket = await connectSocket(join(f.root, 'hub.sock'));
  t.after(() => socket.close());
  socket.send({ type: 'hello', protocol: PROTOCOL_VERSION, secret: TEST_SECRET, sessionId: 'observer-id', name: 'observer', cwd: f.root });
  assert.equal((await socket.next()).type, 'welcome');
  assert.equal((await f.ui.request({ type: 'event.subscribe', as: { name: 'observer' }, subject: { topic: f.topic }, events: ['artifact'] })).ok, true);
  f.failPost(true);
  const failed = await f.ui.request({ type: 'artifact.create', kind: 'note', title: 'Rolled back', content: 'bytes', topic: f.topic });
  assert.equal(failed.ok, false);
  assert.equal((await f.entries()).length, 1);
  const history = await f.ui.request({ type: 'topic.history', topic: 'agents' });
  assert.equal((history.value as { messages: Message[] }).messages.filter(m => m.kind === 'event').length, 0);
  assert.equal(f.records.filter(r => r.event === 'event-delivery').length, 0);
  f.failPost(false);
  const accepted = await f.ui.request({ type: 'artifact.create', kind: 'note', title: 'Committed', content: 'bytes', topic: f.topic });
  assert.equal(accepted.ok, true, accepted.error);
  const after = await f.ui.request({ type: 'topic.history', topic: 'agents' });
  const events = (after.value as { messages: Message[] }).messages.filter(m => m.kind === 'event');
  assert.deepEqual(events.map(m => m.text), ['event · artifact · A-2 created · Committed', 'event · artifact · A-2 shared · Committed']);
});


test('event publication faults preserve reopened artifact bytes and the whole turn/now fan-out', async t => {
  const f = await fixture(t, fs, 30);
  await f.ui.request({ type: 'topic.close', topic: f.topic });
  const table = new ProcessTable();
  const sessions = new Sessions({ core: f.hub.core, table, root: f.root });
  t.after(() => { sessions.close(); table.close(); });
  for (const [name, digest] of [['held', 'turn'], ['steered', 'now']] as const) {
    if (digest === 'now') table.put({ name, sessionId: `${name}-id`, harness: 'codex', role: 'reviewer', model: null, cwd: f.root, pid: null, harnessId: null, harnessSessionId: null, startedAt: new Date().toISOString(), status: 'running', item: null });
    await f.ui.request({ type: 'role.set', session: name, role: 'reviewer' });
    const socket = await connectSocket(join(f.root, 'hub.sock'));
    t.after(() => socket.close());
    socket.send({ type: 'hello', protocol: PROTOCOL_VERSION, secret: TEST_SECRET, sessionId: `${name}-id`, name, cwd: f.root });
    assert.equal((await socket.next()).type, 'welcome');
    assert.equal((await f.ui.request({ type: 'event.subscribe', as: { name }, subject: { topic: f.topic }, events: ['artifact'], digest })).ok, true);
  }
  f.failEventLog();
  const result = await f.ui.request({ type: 'artifact.create', kind: 'note', title: 'Retained commit', content: 'new retained bytes', topic: f.topic });
  assert.equal(result.ok, true, result.error);
  const created = (result.value as { artifact: Artifact }).artifact;
  assert.equal(await fs.readFile(created.path, 'utf8'), 'new retained bytes');
  const history = await f.ui.request({ type: 'topic.history', topic: 'agents' });
  const events = (history.value as { messages: Message[] }).messages.filter(m => m.kind === 'event');
  for (const name of ['held', 'steered']) assert.deepEqual(events.filter(m => m.to.includes(name)).map(m => m.text), [
    'event · artifact · A-1 shared · Design',
    'event · artifact · A-2 created · Retained commit',
    'event · artifact · A-2 shared · Retained commit',
  ]);
  assert.ok(f.records.some(r => r.event === 'publication-failed'));
});


test('failure recording the now group rolls back every recipient and their event allowance', async t => {
  const f = await fixture(t, fs, 30, 1);
  const table = new ProcessTable();
  const sessions = new Sessions({ core: f.hub.core, table, root: f.root });
  t.after(() => { sessions.close(); table.close(); });
  for (const [name, digest] of [['held', 'turn'], ['steered', 'now']] as const) {
    if (digest === 'now') table.put({ name, sessionId: `${name}-id`, harness: 'codex', role: 'reviewer', model: null, cwd: f.root, pid: null, harnessId: null, harnessSessionId: null, startedAt: new Date().toISOString(), status: 'running', item: null });
    await f.ui.request({ type: 'role.set', session: name, role: 'reviewer' });
    const socket = await connectSocket(join(f.root, 'hub.sock'));
    t.after(() => socket.close());
    socket.send({ type: 'hello', protocol: PROTOCOL_VERSION, secret: TEST_SECRET, sessionId: `${name}-id`, name, cwd: f.root });
    assert.equal((await socket.next()).type, 'welcome');
    assert.equal((await f.ui.request({ type: 'event.subscribe', as: { name }, subject: { topic: f.topic }, events: ['artifact'], digest })).ok, true);
  }
  f.db.exec("create trigger reject_now before insert on messages when new.notice = 'event' and json_extract(new.notice_detail, '$.digest') = 'now' begin select raise(ABORT, 'now group refused'); end");
  const first = await f.ui.request({ type: 'artifact.create', kind: 'note', title: 'Faulted occurrence', content: 'committed bytes', topic: f.topic });
  assert.equal(first.ok, true, first.error);
  const history = await f.ui.request({ type: 'topic.history', topic: 'agents' });
  assert.deepEqual((history.value as { messages: Message[] }).messages.filter(m => m.kind === 'event'), []);
  assert.equal(await fs.readFile((first.value as { artifact: Artifact }).artifact.path, 'utf8'), 'committed bytes');
  f.db.exec('drop trigger reject_now');
  assert.equal((await f.ui.request({ type: 'artifact.create', kind: 'note', title: 'Retry allowance', content: 'retry bytes', topic: f.topic })).ok, true);
  const after = await f.ui.request({ type: 'topic.history', topic: 'agents' });
  const events = (after.value as { messages: Message[] }).messages.filter(m => m.kind === 'event');
  for (const name of ['held', 'steered']) assert.deepEqual(events.filter(m => m.to.includes(name)).map(m => m.text), ['event · artifact · A-3 created · Retry allowance']);
});


test('folder cleanup rolls back a failed index commit and recovers interrupted retention after reopen', async t => {
  const f = await fixture(t, fs, 0, 120, true);
  const entry = join(f.a.path, 'index.md');
  await f.ui.request({ type: 'topic.close', topic: f.topic });
  f.db.exec("create trigger reject_folder_delete before update on artifacts when json_extract(new.value, '$.fileDeleted') = 1 begin select raise(ABORT, 'index failed'); end");
  f.hub.prune();
  await eventually('folder index failure reported', async () => f.records.find(r => r.event === 'artifact-cleanup-failed'));
  assert.equal(await fs.readFile(entry, 'utf8'), 'original bytes');
  assert.equal((await f.entries())[0]?.fileDeleted, undefined);
  f.db.exec('drop trigger reject_folder_delete');
  await fs.rename(f.a.path, f.a.path + '.retained');
  await f.ui.request({ type: 'topic.send', topic: f.topic, text: 'Recover interrupted sweep' });
  f.hub.prune();
  await eventually('folder recovered', async () => await fs.readFile(entry, 'utf8').catch(() => '') === 'original bytes' ? true : undefined);
  assert.equal((await f.entries())[0]?.status, 'shared');
  await f.ui.request({ type: 'topic.close', topic: f.topic });
  f.hub.prune();
  await eventually('folder deleted after retry', async () => (await f.entries())[0]?.fileDeleted ? true : undefined);
  await assert.rejects(fs.readFile(entry), { code: 'ENOENT' });
});

test('keeping a folder during the retention rename restores all its files', async t => {
  const renaming = deferred(), release = deferred(); t.after(() => release.resolve());
  const f = await fixture(t, { ...fs, rename: async (...args) => {
    if (String(args[1]).endsWith('.retained')) { renaming.resolve(); await release.promise; }
    return fs.rename(...args);
  } }, 0, 120, true);
  await f.ui.request({ type: 'topic.close', topic: f.topic });
  f.hub.prune(); await renaming.promise;
  assert.equal((await f.ui.request({ type: 'artifact.keep', artifact: f.a.id })).ok, true);
  release.resolve();
  await eventually('kept folder restored', async () => await fs.readFile(join(f.a.path, 'index.md'), 'utf8').catch(() => '') === 'original bytes' && !(await fs.readdir(join(f.root, '.cland/artifacts'))).some(n => n.endsWith('.retained')) ? true : undefined);
  assert.equal((await f.entries())[0]?.kept, true);
  assert.equal((await f.entries())[0]?.fileDeleted, undefined);
});

test('move index failures retain the original; a committed redirect survives an unlink failure and retries housekeeping', async t => {
  let failUnlink = false;
  const f = await fixture(t, { ...fs, unlink: async path => {
    if (failUnlink && String(path).endsWith('design.md')) throw new Error('unlink failed');
    return fs.unlink(path);
  } });
  const folder = ((await f.ui.request({ type: 'artifact.create', as: { name: 'coord' }, kind: 'note', title: 'Folder', folder: true, content: '# Entry', topic: f.topic })).value as { artifact: Artifact }).artifact;
  f.db.exec("create trigger reject_move before update on artifacts when json_extract(new.value, '$.status') = 'moved' begin select raise(ABORT, 'index failed'); end");
  assert.equal((await f.ui.request({ type: 'artifact.move', artifact: f.a.id, folder: folder.id, name: 'note.md' })).ok, false);
  assert.equal(await fs.readFile(f.a.path, 'utf8'), 'original bytes');
  await assert.rejects(fs.readFile(join(folder.path, 'note.md')), { code: 'ENOENT' });
  f.db.exec('drop trigger reject_move'); failUnlink = true;
  const moved = await f.ui.request({ type: 'artifact.move', artifact: f.a.id, folder: folder.id, name: 'note.md' });
  assert.equal(moved.ok, true);
  assert.match((moved.value as { followUp: { error: string } }).followUp.error, /unlink failed/);
  assert.equal((await f.entries()).length, 1);
  assert.equal(await fs.readFile(join(folder.path, 'note.md'), 'utf8'), 'original bytes');
  failUnlink = false; f.hub.prune();
  await eventually('old file path cleaned after commit', async () => await fs.lstat(f.a.path).then(() => undefined, () => true));
});

test('a refused folder publication rolls back its directory and id reservation', async t => {
  const f = await fixture(t);
  f.failPost(true);
  const create = () => f.ui.request({ type: 'artifact.create', kind: 'note', title: 'Folder', topic: f.topic, folder: true, entry: 'notes/start.md', content: 'new bytes' });
  assert.equal((await create()).ok, false);
  assert.deepEqual(await fs.readdir(join(f.root, '.cland/artifacts')), ['A-1-design.md']);
  assert.equal((await f.entries()).length, 1);
  f.failPost(false);
  const accepted = await create();
  assert.equal(accepted.ok, true);
  const a = (accepted.value as { artifact: Artifact }).artifact;
  assert.equal(a.id, 'A-2');
  assert.equal(await fs.readFile(join(a.path, a.entry!), 'utf8'), 'new bytes');
});

test('folder promotion rolls back partial copies and failed index writes, then permits retry', async t => {
  let failCopy = true;
  const f = await fixture(t, { ...fs, copyFile: async (...args) => {
    await fs.copyFile(...args);
    if (failCopy) throw new Error('copy interrupted after bytes were written');
  } }, 30, 120, true);
  await fs.mkdir(join(f.a.path, 'details'));
  await fs.writeFile(join(f.a.path, 'details', 'data.txt'), 'detail bytes');
  const destination = join(f.root, 'docs', 'notes');
  const promote = () => f.ui.request({ type: 'artifact.promote', artifact: f.a.id, path: 'docs/notes' });
  assert.equal((await promote()).ok, false);
  await assert.rejects(fs.lstat(destination), { code: 'ENOENT' });
  assert.equal((await f.entries())[0]?.promoted, undefined);
  failCopy = false;
  f.db.exec("create trigger reject_folder_promote before update on artifacts when json_extract(new.value, '$.promoted') is not null begin select raise(ABORT, 'index failed'); end");
  assert.equal((await promote()).ok, false);
  await assert.rejects(fs.lstat(destination), { code: 'ENOENT' });
  assert.equal((await f.entries())[0]?.promoted, undefined);
  assert.equal(await fs.readFile(join(f.a.path, 'index.md'), 'utf8'), 'original bytes');
  f.db.exec('drop trigger reject_folder_promote');
  assert.equal((await promote()).ok, true);
  assert.equal(await fs.readFile(join(destination, 'details', 'data.txt'), 'utf8'), 'detail bytes');
});

test('folder promotion reserves its tree, rolls back revoked authority, and survives a topic close', async t => {
  const copying = deferred(), release = deferred(); t.after(() => release.resolve());
  const f = await fixture(t, { ...fs, copyFile: async (...args) => {
    copying.resolve(); await release.promise; return fs.copyFile(...args);
  } }, 0, 120, true);
  const operation = f.ui.request({ type: 'artifact.promote', artifact: f.a.id, path: 'docs/notes', as: { name: 'coord' } });
  await copying.promise;
  const busy = await f.ui.request({ type: 'artifact.promote', artifact: f.a.id, path: 'docs/other' });
  assert.equal((busy as { code?: string }).code, 'artifact-busy');
  await f.ui.request({ type: 'role.clear', session: 'coord' });
  release.resolve();
  assert.equal((await operation as { code?: string }).code, 'forbidden');
  await assert.rejects(fs.lstat(join(f.root, 'docs/notes')), { code: 'ENOENT' });
  await f.ui.request({ type: 'topic.close', topic: f.topic });
  assert.equal((await f.ui.request({ type: 'artifact.promote', artifact: f.a.id, path: 'docs/notes' })).ok, true);
  f.hub.prune();
  assert.equal(await fs.readFile(join(f.a.path, 'index.md'), 'utf8'), 'original bytes');
  assert.equal((await f.entries())[0]?.promoted, 'docs/notes');
  assert.equal((await f.entries())[0]?.status, 'shared');
});

test('folder promotion preserves occupied directories and refuses symlinks added after creation', async t => {
  const f = await fixture(t, fs, 30, 120, true);
  const occupied = join(f.root, 'docs/occupied');
  await fs.mkdir(occupied, { recursive: true }); await fs.writeFile(join(occupied, 'index.md'), 'existing notes');
  const request = (path: string) => f.ui.request({ type: 'artifact.promote', artifact: f.a.id, path });
  assert.equal((await request('docs/occupied')).ok, false);
  assert.equal(await fs.readFile(join(occupied, 'index.md'), 'utf8'), 'existing notes');
  const outside = await tempProject(t);
  await fs.writeFile(join(outside, 'secret.md'), 'outside bytes');
  await fs.symlink(outside, join(f.root, 'escape'));
  assert.equal((await request('escape/notes')).ok, false);
  await assert.rejects(fs.lstat(join(outside, 'notes')), { code: 'ENOENT' });
  await fs.symlink(join(outside, 'secret.md'), join(f.a.path, 'linked.md'));
  assert.equal((await request('docs/notes')).ok, false);
  await assert.rejects(fs.lstat(join(f.root, 'docs/notes')), { code: 'ENOENT' });
  assert.equal((await f.entries())[0]?.promoted, undefined);
  await fs.unlink(join(f.a.path, 'linked.md'));
  await fs.unlink(join(f.a.path, 'index.md'));
  assert.equal((await request('docs/notes')).ok, false, 'an edited folder must still have its entry');
  await assert.rejects(fs.lstat(join(f.root, 'docs/notes')), { code: 'ENOENT' });
});

test('an Aide losing its role during human folder promotion is refused and rolls back the complete tree', async t => {
  const copying = deferred(), release = deferred(); t.after(() => release.resolve());
  const f = await fixture(t, { ...fs, copyFile: async (...args) => {
    await fs.copyFile(...args); copying.resolve(); await release.promise;
  } }, 30);
  const made = await f.ui.request({ type: 'artifact.create', kind: 'note', title: 'Human notes', topic: f.topic, folder: true, content: 'protected entry' });
  assert.equal(made.ok, true);
  const folder = (made.value as { artifact: Artifact }).artifact;
  await fs.mkdir(join(folder.path, 'details')); await fs.writeFile(join(folder.path, 'details', 'note.md'), 'protected detail');
  await f.ui.request({ type: 'role.set', session: 'notes-aide', role: 'aide' });
  await f.ui.request({ type: 'role.clear', session: 'coord' });
  const operation = f.ui.request({ type: 'artifact.promote', artifact: folder.id, path: 'docs/notes', as: { name: 'notes-aide' } });
  await copying.promise;
  assert.equal((await f.ui.request({ type: 'role.set', session: 'notes-aide', role: 'coordinator' })).ok, true);
  release.resolve();
  const result = await operation;
  assert.equal(result.ok, false);
  assert.equal((result as { code?: string }).code, 'forbidden');
  assert.match(result.error ?? '', /agents cannot change/);
  await assert.rejects(fs.lstat(join(f.root, 'docs/notes')), { code: 'ENOENT' });
  const current = (await f.entries()).find(a => a.id === folder.id);
  assert.equal(current?.promoted, undefined);
  assert.equal(current?.status, folder.status);
  assert.equal(await fs.readFile(join(folder.path, 'index.md'), 'utf8'), 'protected entry');
  assert.equal(await fs.readFile(join(folder.path, 'details/note.md'), 'utf8'), 'protected detail');
  await f.ui.request({ type: 'role.set', session: 'notes-aide', role: 'aide' });
  assert.equal((await f.ui.request({ type: 'artifact.promote', artifact: folder.id, path: 'docs/notes', as: { name: 'notes-aide' } })).ok, true, 'rollback releases the reservation for an authorized retry');
});
