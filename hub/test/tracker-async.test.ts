// T3: SIGKILL during tracker rename, six-second live serving, fatal exit and bounded hub stop.
import { onCleanup } from './process-cleanup.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import files from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { type ImportedIssue } from '../src/tracker/import-github.ts';
import { fixedRoles } from '../src/roles/config.ts';
import { Tracker } from '../src/tracker/tracker.ts';
import { cland, clandWithEnv, connectUi, connectWsUi, eventually, pidAlive, readDiscovery, spawnSpoke, startDaemon, startHub, tempProject } from './harness.ts';
import { taskWriteGate } from './tracker-write-gate.ts';

const human = { id: 'human', name: 'human', role: null };
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
};

for (const racing of ['close', 'claim', 'verdict'] as const) {
  test(`a comment racing a ${racing} loses neither operation`, async t => {
    const root = await tempProject(t);
    const entered = deferred();
    const release = deferred();
  onCleanup(t, () => release.resolve());
    let hold = false;
    const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db'), files: { ...files,
      rename: async (from, to) => {
        if (hold) { hold = false; entered.resolve(); await release.promise; }
        return files.rename(from, to);
      },
    } });
    onCleanup(t, () => tracker.stop());
    await tracker.create(human, { title: 'Raced' });
    hold = true;
    const writing = tracker.comment(human, 'T-1', 'first');
    await entered.promise;
    const raced = racing === 'close' ? tracker.close(human, 'T-1', 'done')
      : racing === 'claim' ? tracker.claim(human, 'T-1')
      : tracker.comment(human, 'T-1', 'reviewed', { verdict: 'review', scope: 'full', result: 'clear', run: 'review-one' });
    release.resolve();
    await Promise.all([writing, raced]);
    const view = await tracker.viewAsync('T-1');
    assert.equal(view.comments[0]?.text, 'first');
    if (racing === 'close') { assert.equal(view.state, 'closed'); assert.equal(view.comments[1]?.text, 'done'); }
    if (racing === 'claim') assert.equal(view.claim?.session, 'human');
    if (racing === 'verdict') { assert.equal(view.comments[1]?.text, 'reviewed'); assert.equal(view.verdicts[0]?.source, 'hub'); }
  });
}

for (const step of ['open', 'read', 'write', 'rename'] as const) {
  test(`${step} failure refuses a comment, preserves the old item, cleans the temporary file and releases its queue`, async t => {
    const root = await tempProject(t);
    let fail = false;
    const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db'), files: { ...files,
      open: async (...args) => {
        if (fail && step === 'open') throw new Error('disk open failed');
        const handle = await files.open(...args);
        if (fail && step === 'read') handle.read = async () => { throw new Error('disk read failed'); };
        return handle;
      },
      writeFile: async (...args) => {
        if (fail && step === 'write') { await files.writeFile(args[0], 'partial'); throw new Error('disk write failed'); }
        return files.writeFile(...args);
      },
      rename: async (...args) => {
        if (fail && step === 'rename') throw new Error('disk rename failed');
        return files.rename(...args);
      },
    } });
    onCleanup(t, () => tracker.stop());
    const item = await tracker.create(human, { title: 'Preserved' });
    const path = join(root, item.path);
    const old = await files.readFile(path, 'utf8');
    fail = true;
    await assert.rejects(tracker.comment(human, item.id, 'lost'), new RegExp(`disk ${step} failed`));
    assert.equal(await files.readFile(path, 'utf8'), old);
    assert.deepEqual((await files.readdir(join(root, '.cland', 'tasks'))).filter(n => n.endsWith('.tmp')), []);
    fail = false;
    await tracker.comment(human, item.id, 'retry');
    assert.deepEqual((await tracker.viewAsync(item.id)).comments.map(c => c.text), ['retry']);
  });
}


test('a process crash after temporary write leaves the previous item intact; restart ignores the stray temporary file', async t => {
  const root = await tempProject(t);
  const db = join(root, '.cland', 'hub.db');
  const tracker = new Tracker({ root, db });
  const item = await tracker.create(human, { title: 'Crash safe' });
  const old = await files.readFile(join(root, item.path), 'utf8');
  await tracker.stop();
  const script = `
    import files from 'node:fs/promises';
    import { Tracker } from ${JSON.stringify(new URL('../src/tracker/tracker.ts', import.meta.url).href)};
    const tracker = new Tracker({ root: ${JSON.stringify(root)}, db: ${JSON.stringify(db)}, files: {
      ...files, rename: async () => { process.kill(process.pid, 'SIGKILL'); }
    } });
    await tracker.comment(${JSON.stringify(human)}, ${JSON.stringify(item.id)}, 'interrupted');
  `;
  await assert.rejects(promisify(execFile)(process.execPath, ['--input-type=module', '-e', script]), err => (err as NodeJS.ErrnoException & { signal?: string }).signal === 'SIGKILL');
  assert.equal(await files.readFile(join(root, item.path), 'utf8'), old);
  assert.ok((await files.readdir(join(root, '.cland', 'tasks'))).some(n => n.endsWith('.tmp')));
  const restarted = new Tracker({ root, db });
  onCleanup(t, () => restarted.stop());
  restarted.start();
  assert.deepEqual(restarted.list().map(i => i.id), [item.id]);
  assert.equal((await restarted.viewAsync(item.id)).comments.length, 0);
});


const imported: ImportedIssue = { number: 1, url: 'https://example.com/1', title: 'Imported', body: '', labels: [], state: 'open', assignee: null, parent: null, blocked_by: [], comments: [], created: '2026-01-01T00:00:00.000Z' };

for (const operation of ['create', 'edit', 'close', 'comment', 'link', 'import', 'topic'] as const) {
  test(`hub ${operation} rechecks a revoked grant after temporary write and refuses before rename`, async t => {
    const root = await tempProject(t);
    const entered = deferred();
    const release = deferred();
  onCleanup(t, () => release.resolve());
    let hold = false;
    const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db'), files: { ...files, writeFile: async (...args) => {
      await files.writeFile(...args);
      if (hold) { hold = false; entered.resolve(); await release.promise; }
    } } });
    onCleanup(t, () => tracker.stop());
    const item = await tracker.create(human, { title: 'Preserved', kind: 'spec' });
    const old = await files.readFile(join(root, item.path), 'utf8');
    const definitions = new Map(fixedRoles().get());
    const role = definitions.get('coordinator')!;
    definitions.set('coordinator', { ...role, permissions: { tools: [...role.permissions.tools, 'task.import'] } });
    const hub = await startHub({ tracker, roles: fixedRoles(definitions) });
    onCleanup(t, () => hub.close());
    const ui = await connectWsUi(t, hub);
    assert.equal((await ui.request({ type: 'role.set', session: 'coord', role: 'coordinator' })).ok, true);
    const frames = {
      create: { type: 'task.create', title: 'Refused', kind: 'spec' },
      edit: { type: 'task.edit', item: item.id, title: 'Refused' },
      close: { type: 'task.close', item: item.id },
      comment: { type: 'task.comment', item: item.id, text: 'Refused' },
      link: { type: 'task.link', item: item.id, branch: 'refused' },
      import: { type: 'task.import', repo: 'test/project', issues: [imported] },
      topic: { type: 'topic.create', title: 'Refused', item: item.id },
    };
    hold = true;
    const writing = ui.request({ ...frames[operation], as: { name: 'coord' } });
    await Promise.race([entered.promise, writing.then(answer => { throw new Error(`write answered before pause: ${JSON.stringify(answer)}`); })]);
    assert.equal((await ui.request({ type: 'role.clear', session: 'coord' })).ok, true);
    release.resolve();
    const answer = await writing;
    assert.equal(answer.ok, false, JSON.stringify(answer));
    assert.match(answer.error ?? '', /forbidden|no role|may not|permission/i);
    assert.equal(await files.readFile(join(root, item.path), 'utf8'), old);
    assert.equal(tracker.list().length, 1);
    assert.deepEqual((await files.readdir(join(root, '.cland', 'tasks'))).filter(n => n.endsWith('.tmp')), []);
  });
}

test('a six-second tracker write warns, completes and leaves the hub serving', async t => {
  const root = await tempProject(t);
  const gate = await taskWriteGate(t, root);
  const { discovery } = await startDaemon(t, root, gate.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'task.create', title: 'Slow', size: 'S' })).ok, true);
  await gate.arm();
  ui.send({ type: 'task.comment', id: 'slow', item: 'T-1', text: 'completed after warning' });
  await gate.entered();
  await new Promise(done => setTimeout(done, 6000));
  assert.equal(pidAlive(discovery.pid), true, 'a warning must not terminate the hub');
  const status = (await ui.request({ type: 'hub.status', flushLogs: true })).value as { tracker: { storage: { stalled: boolean; active: { operation: string; item: string }; } } };
  assert.equal(status.tracker.storage.stalled, true);
  assert.equal(status.tracker.storage.active.operation, 'comment');
  assert.equal(status.tracker.storage.active.item, 'T-1');
  const logPath = join(root, '.cland', 'log', 'hub.log');
  assert.match(await files.readFile(logPath, 'utf8'), /tracker-storage-stalled.*comment.*T-1/);
  await gate.release();
  assert.equal((await ui.waitFor(f => f.type === 'result' && f.id === 'slow')).ok, true);
  const view = await ui.request({ type: 'task.view', item: 'T-1' });
  assert.equal(view.ok, true);
  assert.deepEqual((view.value as { item: { comments: { text: string }[] } }).item.comments.map(c => c.text), ['completed after warning']);
  const recovered = (await ui.request({ type: 'hub.status', flushLogs: true })).value as { tracker: { storage: { stalled: boolean } } };
  assert.equal(recovered.tracker.storage.stalled, false);
  assert.doesNotMatch(await files.readFile(logPath, 'utf8'), /tracker-storage-fatal|tracker-storage-abandoned/);
});

for (const releaseAtStall of [false, true]) {
  test(`a serving storage stall exits non-zero with native write ${releaseAtStall ? 'released' : 'held'}, tells sessions and the workbench, and preserves acknowledged writes`, async t => {
    const root = await tempProject(t);
    const gate = await taskWriteGate(t, root);
    // Exercise both the project setting and the independent fatal test override.
    if (releaseAtStall) await files.writeFile(join(root, '.cland', 'config.toml'), '[tracker]\nfatal_stall = "1s"\n');
    const serving = clandWithEnv(root, {
      ...gate.env, CLAND_TEST_TRACKER_STALL_MS: '100',
      ...(!releaseAtStall ? { CLAND_TEST_TRACKER_FATAL_MS: '500' } : {}), CLAND_TEST_SKIP_ORPHAN_SWEEP: '1',
    }, 'hub', 'serve');
    // Observe the foreground CLI's actual exit status, rather than only a vanished daemon PID.
    const discovery = await eventually('foreground hub is serving', () => readDiscovery(root));
    onCleanup(t, async () => { if (pidAlive(discovery.pid)) await cland(root, 'hub', 'stop'); await serving; });
    assert.equal((await cland(root, 'task', 'create', '--size', 'M', 'Stalled')).code, 0);
    assert.equal((await cland(root, 'task', 'create', '--size', 'M', 'Other')).code, 0);
    assert.equal((await cland(root, 'task', 'comment', 'T-1', 'committed before stall')).code, 0);
    const spoke = await spawnSpoke({ discover: true, cwd: root, name: 'observer' });
    onCleanup(t, () => spoke.close());
    await spoke.waitForPresence(['observer']);
    const ui = await connectUi(t, discovery);
    await ui.request({ type: 'subscribe' });
    await gate.arm();
    ui.send({ type: 'task.comment', id: 'held', item: 'T-1', text: 'held comment' });
    await gate.entered();
    ui.send({ type: 'task.comment', id: 'queued', item: 'T-2', text: 'queued before stall' });
    const queuedRefusal = ui.waitFor(f => f.type === 'result' && f.id === 'queued');
    const heldRefusal = ui.waitFor(f => f.type === 'result' && f.id === 'held');
    const started = performance.now();
    const notice = await ui.waitFor(f => f.type === 'message' && /tracker storage stalled/.test(JSON.stringify(f)), 3000);
    assert.match(JSON.stringify(notice), /comment.*T-1/);
    const warning = await ui.waitFor(f => f.type === 'event' && /tracker storage stalled/.test(JSON.stringify(f)));
    assert.equal((warning.row as { warning: boolean }).warning, true);
    await spoke.waitForEvent(e => /tracker storage stalled.*comment.*T-1/.test(JSON.stringify(e)), 3000);
    // Race a released native write and new admission against the fatal shutdown.
    ui.send({ type: 'task.comment', id: 'late', item: 'T-2', text: 'after stall' });
    if (releaseAtStall) await gate.release();
    for (const refusal of await Promise.all([heldRefusal, queuedRefusal])) {
      assert.equal(refusal.ok, false);
      assert.match(String(refusal.error), /stall.*comment.*T-1/);
    }
    const result = await serving;
    assert.ok(performance.now() - started < 4000, 'the storage deadline must terminate the hub promptly');
    assert.equal(result.code, 1, result.stderr);
    assert.match(result.stderr, /tracker storage stalled.*comment.*T-1/);
    const log = await files.readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8');
    assert.match(log, /tracker-storage-abandoned/);
    assert.match(log, /tracker-storage-fatal/);
    await startDaemon(t, root);
    const restartedUi = await connectUi(t, await readDiscovery(root));
    const events = await restartedUi.request({ type: 'events.list', filter: { warnings: true } });
    assert.match(JSON.stringify(events.value), /tracker storage stalled.*comment.*T-1/);
    const first = await cland(root, 'task', 'view', 'T-1', '--json');
    assert.equal(first.code, 0, first.stderr);
    assert.deepEqual(JSON.parse(first.stdout).item.comments.map((c: { text: string }) => c.text), ['committed before stall']);
    const second = await cland(root, 'task', 'view', 'T-2', '--json');
    assert.equal(second.code, 0, second.stderr);
    assert.deepEqual(JSON.parse(second.stdout).item.comments, []);
  });
}

test('bounded hub stop reports abandonment of a held tracker write', async t => {
  const root = await tempProject(t);
  const gate = await taskWriteGate(t, root);
  const { discovery } = await startDaemon(t, root, {
    ...gate.env, CLAND_TEST_TRACKER_STALL_MS: '60000', CLAND_TEST_TRACKER_STOP_MS: '30',
  });
  assert.equal((await cland(root, 'task', 'create', '--size', 'M', 'Stalled')).code, 0);
  const path = join(root, '.cland', 'tasks', 'T-1-stalled.md');
  const before = await files.readFile(path, 'utf8');
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  await gate.arm();
  ui.send({ type: 'task.comment', id: 'held', item: 'T-1', text: 'held comment' });
  await gate.entered();
  const start = performance.now();
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  assert.ok(performance.now() - start < 4000, 'stop must not wait for the held write or CLI kill fallback');
  assert.equal(pidAlive(discovery.pid), false);
  const log = await files.readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8');
  assert.match(log, /tracker-storage-abandoned/);
  assert.equal(await files.readFile(path, 'utf8'), before, 'a held temporary write was never published');
});

for (const held of ['watch read', 'import reserve'] as const) {
  test(`shutdown also abandons a held ${held} without late index work`, async t => {
    const root = await tempProject(t);
    const entered = deferred(), release = deferred();
    let hold = false;
    const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db'), stopTimeoutMs: 20,
      files: { ...files,
        readFile: async (...args) => {
          const text = await files.readFile(...args);
          if (hold && held === 'watch read') { hold = false; entered.resolve(); await release.promise; }
          return text;
        },
        readdir: async (...args) => {
          const names = await files.readdir(...args);
          if (hold && held === 'import reserve') { hold = false; entered.resolve(); await release.promise; }
          return names;
        },
      },
    });
    onCleanup(t, () => release.resolve()); onCleanup(t, () => tracker.stop());
    await tracker.create(human, { title: 'Held read' });
    hold = true;
    const work = held === 'watch read' ? tracker.rescanAsync()
      : tracker.serializeImports(batch => batch.reserveIdAsync(callback => callback()), callback => callback());
    const refused = assert.rejects(work, /tracker storage abandoned/);
    await entered.promise;
    await tracker.stop();
    await refused;
    release.resolve();
    await new Promise(done => setImmediate(done));
    assert.equal(tracker.storageStatus().abandoned[0]?.operation, held === 'watch read' ? 'rescan' : 'import');
  });
}
