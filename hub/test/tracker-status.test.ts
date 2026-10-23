// T3: verdict-gated native Git merge publication; retained write/grant race regressions.
import { fixtureEnvironment } from './fixture-environment.ts';
import { onCleanup } from './process-cleanup.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import files, { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, connectUi, connectWsUi, spawnSpoke, nativeProjectHub as projectHub, startHub, tempProject } from './harness.ts';
import { copyPreparedProject } from './prepared-project.ts';
import { Tracker } from '../src/tracker/tracker.ts';
import { fixedRoles } from '../src/roles/config.ts';

type Item = { id: string; kind: string; state: string; status?: string; path: string };


test('merge preserves its gate and publishes done with closed state', async t => {
  const root = await tempProject(t);
  const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { env: fixtureEnvironment(cwd, process.env), cwd, encoding: 'utf8' }).trim();
  await copyPreparedProject(root);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const made = await ui.request({ size: 'M', type: 'task.create', title: 'Merge status' });
  const item = (made.value as { item: Item }).item;
  const claimed = await ui.request({ type: 'task.claim', item: item.id });
  const worktree = (claimed.value as { worktree: { path: string } }).worktree;
  await writeFile(join(worktree.path, 'feature.txt'), 'finished\n');
  git(worktree.path, 'add', 'feature.txt');
  git(worktree.path, 'commit', '-qm', 'Feature');
  assert.equal((await ui.request({ type: 'task.edit', item: item.id, status: 'ready' })).ok, true);
  const refused = await ui.request({ type: 'merge', item: item.id }, 30_000);
  assert.deepEqual([refused.ok, (refused as { code?: string }).code], [false, 'review-missing'], 'status never bypasses the gate');
  const rev = await spawnSpoke({ discover: true, cwd: root, name: 'rev', role: 'reviewer' });
  onCleanup(t, () => rev.close());
  assert.equal((await rev.call<{ ok: boolean }>('task.comment', { id: item.id, verdict: 'review', scope: 'full', result: 'clear', run: 'status-merge' })).ok, true);
  const merged = await cland(root, 'merge', item.id, '--json');
  assert.equal(merged.code, 0, merged.stderr);
  const view = await ui.request({ type: 'task.view', item: item.id });
  assert.deepEqual([(view.value as { item: Item }).item.status, (view.value as { item: Item }).item.state], ['done', 'closed']);
  const event = await ui.waitFor(f => f.type === 'task' && (f.item as Item | undefined)?.id === item.id && (f.item as Item).status === 'done');
  assert.equal((event.item as Item).state, 'closed');
});


for (const operation of ['claim', 'review'] as const) {
  test(`${operation} rechecks a revoked grant after file I/O and leaves status and claim intact`, async t => {
    const root = await tempProject(t);
    let enter!: () => void;
    let release!: () => void;
    const entered = new Promise<void>(done => { enter = done; });
    const released = new Promise<void>(done => { release = done; });
    onCleanup(t, () => release());
    let hold = false;
    const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db'), files: { ...files,
      writeFile: async (...args) => {
        await files.writeFile(...args);
        if (hold) { hold = false; enter(); await released; }
      },
    } });
    onCleanup(t, () => tracker.stop());
    const hub = await startHub({ tracker, roles: fixedRoles() });
    onCleanup(t, () => hub.close());
    const ui = await connectWsUi(t, hub);
    assert.equal((await ui.request({ type: 'role.set', session: 'impl', role: 'implementer' })).ok, true);
    const made = await ui.request({ size: 'M', type: 'task.create', title: 'Preserved', assignee: 'impl' });
    const item = (made.value as { item: Item }).item;
    if (operation === 'review') assert.equal((await ui.request({ type: 'task.claim', item: item.id, as: { name: 'impl' } })).ok, true);
    const before = await readFile(join(root, item.path), 'utf8');
    const old = await ui.request({ type: 'task.view', item: item.id });
    hold = true;
    const writing = ui.request({ type: operation === 'claim' ? 'task.claim' : 'task.edit', item: item.id,
      ...(operation === 'review' ? { status: 'review' } : {}), as: { name: 'impl' } });
    await Promise.race([entered, writing.then(result => { throw new Error(`answered before native write pause: ${JSON.stringify(result)}`); })]);
    assert.equal((await ui.request({ type: 'role.clear', session: 'impl' })).ok, true);
    release();
    const refused = await writing;
    assert.deepEqual([refused.ok, (refused as { code?: string }).code], [false, 'forbidden']);
    assert.equal(await readFile(join(root, item.path), 'utf8'), before);
    const after = await ui.request({ type: 'task.view', item: item.id });
    assert.deepEqual(after.value, old.value);
  });
}

for (const pause of ['queue', 'write'] as const) {
  test(`review rechecks the live claim after its ${pause} await, even when the caller keeps its role`, async t => {
    const root = await tempProject(t);
    let enter!: () => void;
    let release!: () => void;
    const entered = new Promise<void>(done => { enter = done; });
    const released = new Promise<void>(done => { release = done; });
    onCleanup(t, () => release());
    let hold = false;
    const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db'), files: { ...files,
      writeFile: async (...args) => {
        await files.writeFile(...args);
        if (hold) { hold = false; enter(); await released; }
      },
    } });
    onCleanup(t, () => tracker.stop());
    const hub = await startHub({ tracker, roles: fixedRoles() });
    onCleanup(t, () => hub.close());
    const ui = await connectWsUi(t, hub);
    assert.equal((await ui.request({ type: 'role.set', session: 'impl', role: 'implementer' })).ok, true);
    assert.equal((await ui.request({ type: 'role.set', session: 'next', role: 'qa' })).ok, true);
    const impl = await spawnSpoke({ hub, name: 'impl', sessionId: 'impl-id', role: 'implementer' });
    const next = await spawnSpoke({ hub, name: 'next', sessionId: 'next-id', role: 'qa' });
    onCleanup(t, () => impl.close()); onCleanup(t, () => next.close());
    await impl.waitForPresence(['impl', 'next']);
    const made = await ui.request({ size: 'M', type: 'task.create', title: 'Held', assignee: 'impl' });
    const item = (made.value as { item: Item }).item;
    assert.equal((await impl.call<{ ok: boolean }>('task.claim', { id: item.id })).ok, true);
    hold = true;
    const earlier = pause === 'queue' ? ui.request({ type: 'task.comment', item: item.id, text: 'Earlier write' }) : null;
    if (earlier) await entered;
    const writing = ui.request({ type: 'task.edit', item: item.id, status: 'review', as: { name: 'impl' } });
    if (!earlier) await Promise.race([entered, writing.then(result => { throw new Error(`answered before native pause: ${JSON.stringify(result)}`); })]);
    // An exclusive role handover transfers this session's claims; restore its Implementer role afterward.
    assert.equal((await ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
    assert.equal((await ui.request({ type: 'role.set', session: 'next', role: 'coordinator', move: true })).ok, true);
    assert.equal((await ui.request({ type: 'role.set', session: 'impl', role: 'implementer' })).ok, true);
    release();
    if (earlier) assert.equal((await earlier).ok, true);
    const denied = await writing;
    assert.deepEqual([denied.ok, (denied as { code?: string }).code], [false, 'forbidden']);
    const view = await ui.request({ type: 'task.view', item: item.id });
    const value = (view.value as { item: Item & { claim: { sessionId: string } } }).item;
    assert.deepEqual([value.status, value.state, value.claim.sessionId], ['in progress', 'open', 'next-id']);
  });
}
