// Verifier holds and ready at the real hub frame / gate seams (T-121).
import { onCleanup } from './process-cleanup.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import nativeFiles from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import files, { readFile, writeFile } from 'node:fs/promises';
import { cland, clandWithEnv, connectUi, eventually, fakeClaude, pidAlive, sleep, spawnSpoke, startDaemon } from './harness.ts';
import { copyPreparedProject } from './prepared-project.ts';
import type { Presence } from '../src/protocol.ts';
import { taskWriteGate } from './tracker-write-gate.ts';
import { gitIn } from '../src/tracker/verdict-git.ts';
import { manualTips } from './freshness-harness.ts';
import { join } from 'node:path';
import { serveProject } from '../src/hub/daemon.ts';
import { Tracker, type ItemView } from '../src/tracker/tracker.ts';
import { agentsRecord } from '../src/hub/agents-topic.ts';
import { fixedRoles } from '../src/roles/config.ts';
import { connectWsUi, startHub, tempProject } from './harness.ts';

test('verifier holds move status beside the Implementer claim, and release on verdict or explicit release', async t => {
  const root = await tempProject(t);
  const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db') });
  onCleanup(t, () => tracker.stop());
  const hub = await startHub({ tracker, roles: fixedRoles() });
  onCleanup(t, () => hub.close());
  const ui = await connectWsUi(t, hub);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  for (const [session, role] of [['impl', 'implementer'], ['rev', 'reviewer'], ['qa-1', 'qa']] as const) {
    assert.equal((await ui.request({ type: 'role.set', session, role })).ok, true);
  }
  const made = await ui.request({ size: 'M', type: 'task.create', title: 'Verify', assignee: 'impl' });
  const item = (made.value as { item: ItemView }).item;
  assert.equal((await ui.request({ type: 'task.claim', item: item.id, as: { name: 'impl' } })).ok, true);
  const read = async () => (await ui.request({ type: 'task.view', item: item.id })).value as { item: ItemView & { holds: Array<{ session: string; role: string }> } };
  const claim = (await read()).item.claim;
  for (const [name, status] of [['rev', 'review'], ['qa-1', 'qa']] as const) {
    const held = await ui.request({ type: 'task.hold', item: item.id, as: { name } });
    assert.equal(held.ok, true, JSON.stringify(held));
    const view = (await read()).item;
    assert.equal(view.status, status);
    assert.equal(view.assignee, 'impl');
    assert.deepEqual(view.claim, claim);
    assert.equal(view.holds.some(h => h.session === name), true);
    const event = await ui.waitFor(f => f.type === 'task' && (f.item as typeof view | undefined)?.holds?.some(h => h.session === name) === true);
    assert.deepEqual((event.item as typeof view).claim, claim);
  }
  assert.equal((await read()).item.holds.length, 2);
  assert.equal((await ui.request({ type: 'task.comment', item: item.id, verdict: { verdict: 'review', scope: 'full', result: 'not clear', run: 'rev-1' }, as: { name: 'rev' } })).ok, true);
  assert.deepEqual((await read()).item.holds.map(h => h.session), ['qa-1']);
  assert.equal((await ui.request({ type: 'task.hold', item: item.id, release: true, as: { name: 'qa-1' } })).ok, true);
  assert.deepEqual((await read()).item.holds, []);
  assert.deepEqual((await read()).item.claim, claim);
  const denied = await ui.request({ type: 'task.hold', item: item.id, as: { name: 'impl' } });
  assert.equal(denied.ok, false);
});

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

async function repository(root: string) {
  await copyPreparedProject(root);
}

for (const qaRequired of [false, true]) {
  test(`ready and the merge gate agree on one fixture: stale patch, unchanged rebase, qa_default per-item=${qaRequired}`, async t => {
    const root = await tempProject(t);
    await repository(root);
    if (qaRequired) await writeFile(join(root, '.cland/config.toml'), '[plan]\nqa_default = {scope = "affected", when = "per-item"}\n');
    const { discovery } = await startDaemon(t, root, { CLAND_TEST_TIP_CHECK_MS: '250' });
    const ui = await connectUi(t, discovery);
    assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
    const rev = await spawnSpoke({ discover: true, cwd: root, name: 'rev', sessionId: 'rev-id', role: 'reviewer' });
    const qa = await spawnSpoke({ discover: true, cwd: root, name: 'qa-1', role: 'qa' });
    onCleanup(t, () => rev.close()); onCleanup(t, () => qa.close());
    const made = await ui.request({ size: 'M', type: 'task.create', title: 'Ready fixture' });
    const item = (made.value as { item: ItemView }).item;
    const claimed = await ui.request({ type: 'task.claim', item: item.id });
    const work = (claimed.value as { worktree: { path: string; branch: string } }).worktree;
    await writeFile(join(work.path, 'feature'), 'reviewed\n');
    git(work.path, 'add', 'feature');
    git(work.path, 'commit', '-qm', 'Feature');
    const reviewed = git(work.path, 'rev-parse', 'HEAD');
    const read = async () => ((await ui.request({ type: 'task.view', item: item.id })).value as { item: ItemView }).item;
    const status = async (expected: string) => {
      await eventually(expected, async () => (await read()).status === expected ? true : undefined);
      assert.match(await readFile(join(root, item.path), 'utf8'), new RegExp(`status: ${expected}\\n`));
    };
    const verdict = async (who: typeof rev, kind: 'review' | 'qa', run: string) => {
      const result = await who.call<{ ok: boolean; error?: string }>('task.comment', { id: item.id, verdict: kind, ...(kind === 'review' ? { scope: 'full' } : {}), result: 'clear', run });
      assert.equal(result.ok, true, result.error);
    };
    await verdict(rev, 'review', 'reviewed');
    if (qaRequired) {
      await eventually('current review', async () => (await read()).verdicts[0]?.current === true ? true : undefined);
      assert.notEqual((await read()).status, 'ready');
      const refused = await ui.request({ type: 'merge', item: item.id }, 30_000);
      assert.deepEqual([refused.ok, (refused as { code?: string }).code], [false, 'qa-missing']);
      await verdict(qa, 'qa', 'qa-reviewed');
    }
    await status('ready');
    const readyEvent = await ui.waitFor(f => f.type === 'task' && (f.item as ItemView | undefined)?.id === item.id && (f.item as ItemView).status === 'ready');
    assert.equal((readyEvent.item as ItemView).verdicts[0]?.current, true);
    // Repeated verification of an unchanged patch still follows the gate's existing clear evidence.
    for (const verifier of qaRequired ? [rev, qa] : [rev]) {
      const held = await verifier.call<{ ok: boolean; holds: ItemView['holds'] }>('task.hold', { id: item.id });
      assert.equal(held.ok, true);
      assert.equal(held.holds.length, 1);
      const released = await verifier.call<{ ok: boolean; holds: ItemView['holds'] }>('task.hold', { id: item.id, release: true });
      assert.equal(released.ok, true);
      assert.deepEqual(released.holds, []);
      await status('ready');
      assert.equal((await read()).verdicts.every(v => v.current === true), true);
    }
    // A failed criterion must remain in progress even while the old clear verdict is fresh.
    await ui.request({ type: 'task.edit', item: item.id, body: '## Acceptance criteria\n- [ ] C1. The patch works' });
    const failed = await rev.call<{ item: ItemView }>('task.criterion', { id: item.id, op: 'fail', criterion: 'C1', note: 'Still broken' });
    assert.equal(failed.item.status, 'in progress');
    await ui.request({ type: 'task.edit', item: item.id, title: 'Failure remains in progress' });
    await sleep(600); // allow background readiness/freshness work to settle
    assert.equal((await read()).status, 'in progress');
    await ui.request({ type: 'task.edit', item: item.id, body: '' });
    await status('ready');
    await writeFile(join(work.path, 'feature'), 'changed\n');
    git(work.path, 'commit', '-qam', 'Changed patch');
    await status('in progress');
    const refused = await ui.request({ type: 'merge', item: item.id }, 30_000);
    assert.deepEqual([refused.ok, (refused as { code?: string }).code], [false, 'review-stale']);
    // Restore the reviewed patch, then rebase it onto an unrelated base commit.
    git(work.path, 'reset', '--soft', reviewed);
    git(work.path, 'restore', '--staged', '--worktree', '.');
    await writeFile(join(root, 'base'), 'unrelated\n');
    git(root, 'add', 'base');
    git(root, 'commit', '-qm', 'Base moved');
    assert.equal((await cland(root, 'push')).code, 0);
    git(work.path, 'rebase', 'dev');
    assert.notEqual(git(work.path, 'rev-parse', 'HEAD'), reviewed);
    await status('ready');
    const before = git(root, 'rev-parse', 'dev');
    let mergeAttempt = 0;
    const requestMerge = () => {
      const id = `rebased-merge-${++mergeAttempt}`;
      ui.send({ type: 'merge', item: item.id, id });
      return id;
    };
    let mergeId = requestMerge();
    const merged = await eventually('rebased gate accepts', () => {
      // Observe one in-flight result; only a settled pending refusal permits another merge request.
      const result = ui.frames.find(f => f.type === 'result' && f.id === mergeId);
      if (!result) return undefined;
      if (typeof result.code === 'string' && result.code.endsWith('-pending')) {
        mergeId = requestMerge();
        return undefined;
      }
      assert.equal(result.ok, true, JSON.stringify(result));
      return result;
    });
    assert.equal(merged.ok, true);
    assert.notEqual(git(root, 'rev-parse', 'dev'), before);
    assert.equal((await read()).status, 'done');
  });
}

// Pause at the existing native file boundary; the hub still serves frames while the write waits.
for (const pauseAt of ['write', 'evidence'] as const) {
test(`a commit landing during ready ${pauseAt} cannot publish ready for an unreviewed patch`, async t => {
  const root = await tempProject(t);
  await repository(root);
  const tips = manualTips();
  let entered!: () => void;
  let release!: () => void;
  const paused = new Promise<void>(done => { entered = done; });
  const released = new Promise<void>(done => { release = done; });
  onCleanup(t, () => release());
  let pause = false;
  let readEvidence = 0;
  const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db'), scheduleTips: tips.scheduleTips, files: { ...files,
    readFile: async (...args) => {
      const text = await files.readFile(...args);
      if (readEvidence > 0 && String(args[0]).endsWith('.md') && --readEvidence === 0) { entered(); await released; }
      return text;
    },
    writeFile: async (path, text) => {
      await files.writeFile(path, text);
      if (pause && text.includes('status: ready\n')) {
        pause = false;
        if (pauseAt === 'write') { entered(); await released; }
        else readEvidence = 2;
      }
    },
  } });
  tracker.start();
  onCleanup(t, () => tracker.stop());
  await tips.refresh();
  const hub = await startHub({ tracker, roles: fixedRoles() });
  onCleanup(t, () => hub.close());
  const ui = await connectWsUi(t, hub);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  assert.equal((await ui.request({ type: 'role.set', session: 'rev', role: 'reviewer' })).ok, true);
  const rev = await spawnSpoke({ hub, name: 'rev', role: 'reviewer' });
  onCleanup(t, () => rev.close());
  const made = await ui.request({ size: 'M', type: 'task.create', title: 'Race' });
  const item = (made.value as { item: ItemView }).item;
  const claimed = await ui.request({ type: 'task.claim', item: item.id });
  const work = (claimed.value as { worktree: { path: string } }).worktree;
  await writeFile(join(work.path, 'feature'), 'reviewed\n');
  git(work.path, 'add', 'feature');
  git(work.path, 'commit', '-qm', 'Reviewed');
  pause = true;
  assert.equal((await rev.call<{ ok: boolean }>('task.comment', { id: item.id, verdict: 'review', scope: 'full', result: 'clear', run: 'race' })).ok, true);
  await paused;
  await writeFile(join(work.path, 'feature'), 'unreviewed\n');
  git(work.path, 'commit', '-qam', 'Commit during ready');
  const at = ui.frames.length;
  release();
  await eventually('stale', async () => {
    const result = await ui.request({ type: 'task.view', item: item.id });
    const view = (result.value as { item: ItemView }).item;
    return view.verdicts[0]?.current === false && view.status !== 'ready' ? true : undefined;
  });
  assert.equal(ui.frames.slice(at).some(f => f.type === 'task' && (f.item as ItemView | undefined)?.status === 'ready'), false);
  const gate = await ui.request({ type: 'merge', item: item.id }, 30_000);
  assert.deepEqual([gate.ok, (gate as { code?: string }).code], [false, 'review-stale']);
});

}


test('a launched verifier stop releases its hub hold and preserves the Implementer claim', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  assert.equal((await ui.request({ type: 'role.set', session: 'impl', role: 'implementer' })).ok, true);
  const made = await ui.request({ size: 'M', type: 'task.create', title: 'Stop verifier', assignee: 'impl' });
  const item = (made.value as { item: ItemView }).item;
  assert.equal((await ui.request({ type: 'task.claim', item: item.id, as: { name: 'impl' } })).ok, true);
  const launched = await ui.request({ type: 'session.launch', name: 'rev', role: 'reviewer', harness: 'claude-code' }, 30_000);
  assert.equal(launched.ok, true, launched.error);
  const held = await ui.request({ type: 'task.hold', item: item.id, as: { name: 'rev' } });
  assert.equal(held.ok, true, JSON.stringify(held));
  const read = async () => ((await ui.request({ type: 'task.view', item: item.id })).value as { item: ItemView }).item;
  const claim = (await read()).claim;
  assert.equal((await read()).holds.length, 1);
  assert.equal((await ui.request({ type: 'session.stop', session: 'rev' }, 15_000)).ok, true);
  await eventually('released hold', async () => (await read()).holds.length === 0 ? true : undefined);
  assert.deepEqual((await read()).claim, claim);
  await ui.waitFor(f => f.type === 'task' && (f.item as ItemView | undefined)?.id === item.id && (f.item as ItemView).holds.length === 0 && (f.item as ItemView).status === 'review');
});

for (const pauseAt of ['queue', 'write'] as const) {
  test(`a verifier hold rechecks role after its ${pauseAt} await`, async t => {
    const root = await tempProject(t);
    let enter!: () => void;
    let release!: () => void;
    const entered = new Promise<void>(done => { enter = done; });
    const released = new Promise<void>(done => { release = done; });
    onCleanup(t, () => release());
    let pause = false;
    const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db'), files: { ...files,
      writeFile: async (...args) => {
        await files.writeFile(...args);
        if (pause) { pause = false; enter(); await released; }
      },
    } });
    onCleanup(t, () => tracker.stop());
    const hub = await startHub({ tracker, roles: fixedRoles() });
    onCleanup(t, () => hub.close());
    const ui = await connectWsUi(t, hub);
    assert.equal((await ui.request({ type: 'role.set', session: 'rev', role: 'reviewer' })).ok, true);
    const made = await ui.request({ size: 'M', type: 'task.create', title: 'Revoked hold' });
    const item = (made.value as { item: ItemView }).item;
    pause = true;
    const earlier = pauseAt === 'queue' ? ui.request({ type: 'task.comment', item: item.id, text: 'Earlier' }) : null;
    if (earlier) await entered;
    const holding = ui.request({ type: 'task.hold', item: item.id, as: { name: 'rev' } });
    if (!earlier) await entered;
    assert.equal((await ui.request({ type: 'role.clear', session: 'rev' })).ok, true);
    release();
    if (earlier) assert.equal((await earlier).ok, true);
    const refused = await holding;
    assert.equal(refused.ok, false);
    const view = ((await ui.request({ type: 'task.view', item: item.id })).value as { item: ItemView }).item;
    assert.equal(view.status, 'backlog');
    assert.deepEqual(view.holds, []);
  });
}


for (const outcome of ['unchanged', 'changed', 'failed'] as const) {
  test(`pending freshness preserves ready, then settles ${outcome}`, async t => {
    const root = await tempProject(t);
    await repository(root);
    const tips = manualTips();
    const real = gitIn(root);
    let enter!: () => void;
    let release!: () => void;
    const entered = new Promise<void>(done => { enter = done; });
    const released = new Promise<void>(done => { release = done; });
    onCleanup(t, () => release());
    let pause = false;
    const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db'), scheduleTips: tips.scheduleTips,
      git: async (args, input) => {
        if (pause && args[0] === 'patch-id') {
          pause = false; enter(); await released;
          if (outcome === 'failed') throw new Error('patch-id timed out');
        }
        return real(args, input);
      },
    });
    tracker.start();
    onCleanup(t, () => tracker.stop());
    await tips.refresh();
    const hub = await startHub({ tracker, roles: fixedRoles() });
    onCleanup(t, () => hub.close());
    const ui = await connectWsUi(t, hub);
    assert.equal((await ui.request({ type: 'role.set', session: 'rev', role: 'reviewer' })).ok, true);
    const rev = await spawnSpoke({ hub, name: 'rev', role: 'reviewer' });
    onCleanup(t, () => rev.close());
    const made = await ui.request({ size: 'M', type: 'task.create', title: 'Pending fixture' });
    const item = (made.value as { item: ItemView }).item;
    const claimed = await ui.request({ type: 'task.claim', item: item.id });
    const work = (claimed.value as { worktree: { path: string } }).worktree;
    await writeFile(join(work.path, 'feature'), 'reviewed\n');
    git(work.path, 'add', 'feature');
    git(work.path, 'commit', '-qm', 'Reviewed');
    assert.equal((await rev.call<{ ok: boolean }>('task.comment', { id: item.id, verdict: 'review', scope: 'full', result: 'clear', run: 'pending' })).ok, true);
    const read = async () => ((await ui.request({ type: 'task.view', item: item.id })).value as { item: ItemView }).item;
    await eventually('ready', async () => (await read()).status === 'ready' ? true : undefined);
    if (outcome === 'changed') {
      await writeFile(join(work.path, 'feature'), 'changed\n');
      git(work.path, 'commit', '-qam', 'Changed');
    } else git(work.path, 'commit', '--amend', '-qm', 'Same patch new commit');
    pause = true;
    await tips.refresh();
    await entered;
    const pending = await read();
    assert.equal(pending.verdicts[0]?.current, undefined);
    assert.equal(pending.status, 'ready');
    const gatePending = await ui.request({ type: 'merge', item: item.id }, 30_000);
    assert.deepEqual([gatePending.ok, (gatePending as { code?: string }).code], [false, 'review-pending']);
    release();
    await eventually('settled', async () => {
      const view = await read();
      return view.verdicts[0]?.current === (outcome === 'unchanged') && view.status === (outcome === 'unchanged' ? 'ready' : 'in progress') ? true : undefined;
    });
    if (outcome !== 'unchanged') {
      const refused = await ui.request({ type: 'merge', item: item.id }, 30_000);
      assert.deepEqual([refused.ok, (refused as { code?: string }).code], [false, 'review-stale']);
    }
  });
}


test('stop during hold rename releases the hold after publication on the tracker queue', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const priorEnv = process.env;
  process.env = { ...process.env, ...fake.env };
  let unpause = () => {};
  const daemon = await serveProject(root, { log: () => {} });
  onCleanup(t, () => unpause()); onCleanup(t, () => daemon.stop()); onCleanup(t, () => process.env = priorEnv);
  const ui = await connectUi(t, daemon.discovery!);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  assert.equal((await ui.request({ type: 'session.launch', name: 'rev', role: 'reviewer', harness: 'claude-code' }, 30_000)).ok, true);
  // The launch answer can precede the spoke's hello, which adopts the verifier's identity.
  await ui.waitFor(f => f.type === 'presence' && (f.sessions as Presence[]).some(s => s.name === 'rev' && s.role === 'reviewer'));
  const made = await ui.request({ size: 'M', type: 'task.create', title: 'Stop during hold' });
  const item = (made.value as { item: ItemView }).item;
  let enter!: () => void;
  let release!: () => void;
  const entered = new Promise<void>(done => { enter = done; });
  const released = new Promise<void>(done => { release = done; });
  const rename = files.rename;
  unpause = () => { files.rename = rename; release(); };
  onCleanup(t, unpause);
  let pause = true;
  files.rename = async (...args) => {
    await rename(...args);
    if (pause && String(args[1]) === join(root, item.path)) { pause = false; enter(); await released; }
  };
  const holding = ui.request({ type: 'task.hold', item: item.id, as: { name: 'rev' } });
  await Promise.race([entered, holding.then(result => { throw new Error(`hold answered before rename pause: ${JSON.stringify(result)}`); })]);
  assert.equal((await ui.request({ type: 'session.stop', session: 'rev' }, 15_000)).ok, true);
  release();
  assert.equal((await holding).ok, true);
  const view = ((await ui.request({ type: 'task.view', item: item.id })).value as { item: ItemView }).item;
  assert.deepEqual(view.holds, []);
});


test('a hand edit during ready Git refresh converges to the edited verdicts without restoring old evidence', async t => {
  const root = await tempProject(t);
  await repository(root);
  const real = gitIn(root);
  let enter!: () => void;
  let release!: () => void;
  const entered = new Promise<void>(done => { enter = done; });
  const released = new Promise<void>(done => { release = done; });
  onCleanup(t, () => release());
  let pause = false;
  const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db'), files: { ...files,
    writeFile: async (path, text) => {
      await files.writeFile(path, text);
      if (text.includes('status: ready\n')) pause = true;
    },
  }, git: async (args, input) => {
    const out = await real(args, input);
    if (pause && args[0] === 'for-each-ref') { pause = false; enter(); await released; }
    return out;
  } });
  tracker.start();
  onCleanup(t, () => tracker.stop());
  const hub = await startHub({ tracker, roles: fixedRoles() });
  onCleanup(t, () => hub.close());
  const ui = await connectWsUi(t, hub);
  assert.equal((await ui.request({ type: 'role.set', session: 'rev', role: 'reviewer' })).ok, true);
  const rev = await spawnSpoke({ hub, name: 'rev', role: 'reviewer' });
  onCleanup(t, () => rev.close());
  const made = await ui.request({ size: 'M', type: 'task.create', title: 'Hand edited readiness' });
  const item = (made.value as { item: ItemView }).item;
  const claimed = await ui.request({ type: 'task.claim', item: item.id });
  const work = (claimed.value as { worktree: { path: string } }).worktree;
  await writeFile(join(work.path, 'feature'), 'reviewed\n');
  git(work.path, 'add', 'feature');
  git(work.path, 'commit', '-qm', 'Reviewed');
  assert.equal((await rev.call<{ ok: boolean }>('task.comment', { id: item.id, verdict: 'review', scope: 'full', result: 'clear', run: 'hand-edit' })).ok, true);
  await entered;
  const path = join(root, item.path);
  const text = await readFile(path, 'utf8');
  await writeFile(path, text.replace('result: clear', 'result: not clear'));
  release();
  await eventually('edited evidence indexed', async () => {
    const view = ((await ui.request({ type: 'task.view', item: item.id })).value as { item: ItemView }).item;
    return view.verdicts[0]?.source === 'file' && view.verdicts[0].result === 'not clear' && view.status !== 'ready' ? true : undefined;
  });
  assert.match(await readFile(path, 'utf8'), /result: not clear/);
  const gate = await ui.request({ type: 'merge', item: item.id }, 30_000);
  assert.deepEqual([gate.ok, (gate as { code?: string }).code], [false, 'verdict-missing']);
});

for (const release of ['verdict', 'explicit'] as const) {
  test(`hello adopts a pre-hello verifier hold and claim; ${release} releases that hold`, async t => {
    const root = await tempProject(t);
    const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db') });
    onCleanup(t, () => tracker.stop());
    const hub = await startHub({ tracker, roles: fixedRoles() });
    onCleanup(t, () => hub.close());
    const ui = await connectWsUi(t, hub);
    assert.equal((await ui.request({ type: 'role.set', session: 'rev', role: 'implementer' })).ok, true);
    const made = await ui.request({ size: 'M', type: 'task.create', title: 'Pre-hello verification', assignee: 'rev' });
    const item = (made.value as { item: ItemView }).item;
    const claimed = await ui.request({ type: 'task.claim', item: item.id, as: { name: 'rev' } });
    assert.equal(claimed.ok, true, JSON.stringify(claimed));
    assert.equal((await ui.request({ type: 'role.set', session: 'rev', role: 'reviewer' })).ok, true);
    assert.equal((await ui.request({ type: 'task.hold', item: item.id, as: { name: 'rev' } })).ok, true);
    const read = async () => ((await ui.request({ type: 'task.view', item: item.id })).value as { item: ItemView }).item;
    const before = await read();
    assert.equal(before.holds[0]?.sessionId, 'name:rev');
    const rev = await spawnSpoke({ hub, name: 'rev', sessionId: 'rev-adopted', role: 'reviewer' });
    onCleanup(t, () => rev.close());
    await rev.waitForPresence(['rev']);
    const adopted = await read();
    assert.equal(adopted.holds[0]?.sessionId, 'rev-adopted');
    assert.equal(adopted.holds[0]?.heldAt, before.holds[0]?.heldAt);
    assert.equal(adopted.claim?.sessionId, 'rev-adopted');
    assert.equal(adopted.claim?.claimedAt, before.claim?.claimedAt);
    const result = release === 'verdict'
      ? await rev.call<{ ok: boolean }>('task.comment', { id: item.id, verdict: 'review', scope: 'full', result: 'not clear', run: 'adopted' })
      : await rev.call<{ ok: boolean }>('task.hold', { id: item.id, release: true });
    assert.equal(result.ok, true);
    assert.deepEqual((await read()).holds, []);
    assert.deepEqual((await read()).claim, adopted.claim);
  });
}

for (const mode of ['timing', 'timing-parented', 'retry'] as const) {
  const timing = mode !== 'retry';
  test(`ready ${timing ? `counts parse, decision and mutation admission as one continuation${mode === 'timing-parented' ? ' with a release parent' : ''}` : 'retries invalidated preparations with bounded backoff'}`, async t => {
    const root = await tempProject(t);
    await repository(root);
    // Keep the folder watcher dormant at its native boundary while measuring this continuation.
    // Watcher parsing is a separate continuation with its own existing timing coverage.
    if (timing) {
      const quiet = await tempProject(t);
      const watch = nativeFiles.watch;
      t.mock.method(nativeFiles, 'watch', () => watch(quiet, () => {}));
      syncBuiltinESMExports();
      onCleanup(t, () => t.mock.restoreAll()); onCleanup(t, () => syncBuiltinESMExports());
    }
    const tips = manualTips();
    const records: Array<Record<string, unknown>> = [];
    const agents = agentsRecord();
    let fail = true;
    let clock = 0;
    let slowParse = false;
    let slowOpen = false;
    let armRead = false;
    let readyId: string | null = null;
    let disrupt = 0;
    const attempts: number[] = [];
    const { RequestGuard } = await import('../src/hub/budget.ts');
    const guard = new RequestGuard({ now: () => clock, log: r => records.push(r) });
    const replace = String.prototype.replace;
    t.mock.method(String.prototype, 'replace', function (this: string, ...args: Parameters<typeof replace>) {
      if (slowParse && this.includes('Ready continuation')) { slowParse = false; slowOpen = true; clock += 200; }
      return replace.apply(this, args);
    });
    const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db'), scheduleTips: tips.scheduleTips,
      watchResumed: guard.resumer('tracker.ready', 'timing'),
      log: agents.tap(entry => { if (entry.event === 'task-written' && entry.op === 'verdict') armRead = true; }),
      files: { ...files,
        readFile: async (...args) => {
          const text = await files.readFile(...args);
          if (timing && armRead && text.includes('result: clear') && tracker.list().find(row => row.id === readyId)?.verdicts[0]?.current === true) { armRead = false; slowParse = true; }
          if (disrupt) { disrupt--; return `${text}\n`; }
          return text;
        },
        open: (...args) => {
          if (slowOpen) { slowOpen = false; clock += 100; }
          return files.open(...args);
        },
        writeFile: async (path, text) => {
          await files.writeFile(path, text);
          if (mode === 'retry' && fail && text.includes('status: ready\n')) { attempts.push(performance.now()); disrupt = 2; }
        },
      },
    });
    tracker.start();
    onCleanup(t, () => tracker.stop());
    const hub = await startHub({ tracker, roles: fixedRoles() });
    onCleanup(t, () => hub.close());
    agents.attach(hub.core);
    const ui = await connectWsUi(t, hub);
    assert.equal((await ui.request({ type: 'role.set', session: 'rev', role: 'reviewer' })).ok, true);
    const rev = await spawnSpoke({ hub, name: 'rev', role: 'reviewer' });
    onCleanup(t, () => rev.close());
    const made = await ui.request({ size: 'M', type: 'task.create', title: 'Ready continuation' });
    const item = (made.value as { item: ItemView }).item;
    readyId = item.id;
    if (mode === 'timing-parented') {
      const parent = await ui.request({ type: 'task.create', title: 'Release parent', kind: 'release' });
      assert.equal(parent.ok, true, parent.error);
      const release = (parent.value as { item: ItemView }).item;
      const linked = await ui.request({ type: 'task.link', item: item.id, parent: release.id });
      assert.equal(linked.ok, true, linked.error);
    }
    const claimed = await ui.request({ type: 'task.claim', item: item.id });
    const work = (claimed.value as { worktree: { path: string } }).worktree;
    await writeFile(join(work.path, 'feature'), 'reviewed\n');
    git(work.path, 'add', 'feature');
    git(work.path, 'commit', '-qm', 'Reviewed');
    await tips.refresh();
    assert.equal((await rev.call<{ ok: boolean }>('task.comment', { id: item.id, verdict: 'review', scope: 'full', result: 'clear', run: mode })).ok, true);
    if (timing) {
      await eventually('ready', async () => tracker.list().find(row => row.id === readyId)?.status === 'ready' ? true : undefined);
      assert.deepEqual(records.filter(r => r.event === 'slow-request').map(r => [r.tool, r.phase, r.ms]), [['tracker.ready', 'resumed', 300]], JSON.stringify({ clock, slowParse, slowOpen, armRead }));
    } else {
      await eventually('ready retried', async () => attempts.length >= 2 ? true : undefined);
      await new Promise<void>(done => setTimeout(done, 250));
      assert.ok(attempts.length <= 4, `unbounded retries: ${attempts.length}`);
      assert.ok(attempts.every((at, i) => i === 0 || at - attempts[i - 1]! >= 40), 'every retry backs off');
      await eventually('retry limit', async () => attempts.length >= 10 ? true : undefined, 20_000);
      await new Promise<void>(done => setTimeout(done, 1100));
      assert.equal(attempts.length, 10, 'attempts stop at the limit');
      const history = await ui.request({ type: 'topic.history', topic: 'agents' });
      const messages = (history.value as { messages: Array<{ kind?: string; text: string }> }).messages;
      const paused = messages.filter(m => m.kind === 'ready-paused');
      assert.equal(paused.length, 1);
      assert.match(paused[0]!.text, /T-1.*readiness evidence changed/);
      fail = false;
      assert.equal((await ui.request({ type: 'task.edit', item: item.id, body: 'new item event' })).ok, true);
      await eventually('event restarts ready', async () => tracker.list().find(row => row.id === readyId)?.status === 'ready' ? true : undefined);
    }
  });
}


test('restart reconciles a stop recorded before queued hold cleanup, preserving claims, status and direct holds', async t => {
  const root = await tempProject(t);
  await repository(root);
  const fake = await fakeClaude(t);
  const gate = await taskWriteGate(t, root);
  const first = await startDaemon(t, root, { ...fake.env, ...gate.env, CLAND_TEST_CRASH_AT: 'stop-recorded' });
  const ui = await connectUi(t, first.discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  assert.equal((await ui.request({ type: 'role.set', session: 'impl', role: 'implementer' })).ok, true);
  const made = await ui.request({ size: 'M', type: 'task.create', title: 'Reconcile holds', assignee: 'impl' });
  const item = (made.value as { item: ItemView }).item;
  assert.equal((await ui.request({ type: 'task.claim', item: item.id, as: { name: 'impl' } })).ok, true);
  assert.equal((await ui.request({ type: 'session.launch', name: 'rev', role: 'reviewer', harness: 'claude-code' }, 30_000)).ok, true);
  await ui.waitFor(f => f.type === 'presence' && (f.sessions as Presence[]).some(s => s.name === 'rev' && s.role === 'reviewer'));
  assert.equal((await ui.request({ type: 'task.hold', item: item.id, as: { name: 'rev' } })).ok, true);
  const direct = await spawnSpoke({ discover: true, cwd: root, name: 'direct', sessionId: 'direct-reviewer', role: 'reviewer' });
  onCleanup(t, () => direct.close());
  assert.equal((await direct.call<{ ok: boolean }>('task.hold', { id: item.id })).ok, true);
  assert.equal((await ui.request({ type: 'role.set', session: 'unknown-rev', role: 'reviewer' })).ok, true);
  assert.equal((await ui.request({ type: 'task.hold', item: item.id, as: { name: 'unknown-rev' } })).ok, true);
  const before = ((await ui.request({ type: 'task.view', item: item.id })).value as { item: ItemView }).item;
  assert.equal(before.holds.length, 3);
  // Hold the tracker queue across the process-row write, so cleanup cannot publish before the crash.
  await gate.arm();
  const writing = ui.request({ type: 'task.comment', item: item.id, text: 'paused native write' }).catch(() => null);
  await gate.entered();
  const stopping = ui.request({ type: 'session.stop', session: 'rev' }).catch(() => null);
  await eventually('hub crashed after stop row', async () => !pidAlive(first.discovery.pid) ? true : undefined);
  await Promise.all([writing, stopping]);
  ui.close();
  const second = await startDaemon(t, root, fake.env);
  const ui2 = await connectUi(t, second.discovery);
  const after = await eventually('stopped hold reconciled', async () => {
    const view = ((await ui2.request({ type: 'task.view', item: item.id })).value as { item: ItemView }).item;
    return view.holds.length === 2 ? view : undefined;
  });
  assert.deepEqual(after.claim, before.claim);
  assert.equal(after.status, 'review');
  assert.deepEqual(after.holds, before.holds.filter(h => h.session !== 'rev'));
  const status = await ui2.request({ type: 'hub.status' });
  assert.equal((status.value as { harnesses: Array<{ name: string; status: string }> }).harnesses.find(p => p.name === 'rev')?.status, 'stopped');
  assert.equal((await ui2.request({ type: 'task.hold', item: item.id, release: true, as: { name: 'unknown-rev' } })).ok, true);
  const released = ((await ui2.request({ type: 'task.view', item: item.id })).value as { item: ItemView }).item;
  assert.equal(released.status, after.status, 'reconciliation and explicit release preserve verification still owed');
});

for (const header of [false, true]) {
  test(`hello adopts existing verdict provenance and keeps self-review refused (${header ? 'text header' : 'structured'})`, async t => {
    const root = await tempProject(t);
    await repository(root);
    const tips = manualTips();
    const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db'), scheduleTips: tips.scheduleTips });
    tracker.start();
    onCleanup(t, () => tracker.stop());
    const hub = await startHub({ tracker, roles: fixedRoles() });
    onCleanup(t, () => hub.close());
    const ui = await connectWsUi(t, hub);
    assert.equal((await ui.request({ type: 'role.set', session: 'rev', role: 'implementer' })).ok, true);
    const made = await ui.request({ size: 'M', type: 'task.create', title: 'Pre-hello verdict', assignee: 'rev' });
    const item = (made.value as { item: ItemView }).item;
    const claimed = await ui.request({ type: 'task.claim', item: item.id, as: { name: 'rev' } });
    const work = (claimed.value as { worktree: { path: string } }).worktree;
    await writeFile(join(work.path, 'feature'), 'reviewed\n');
    git(work.path, 'add', 'feature');
    git(work.path, 'commit', '-qm', 'Reviewed');
    await tips.refresh();
    assert.equal((await ui.request({ type: 'role.set', session: 'rev', role: 'reviewer' })).ok, true);
    assert.equal((await ui.request({ type: 'task.hold', item: item.id, as: { name: 'rev' } })).ok, true);
    const verdict = await ui.request({ type: 'task.comment', item: item.id, as: { name: 'rev' }, ...(header
      ? { text: 'verdict: review\nresult: clear\nby: rev [reviewer]\nrun: before-hello\nscope: full\n' }
      : { verdict: { verdict: 'review', scope: 'full', result: 'clear', run: 'before-hello' } }) });
    assert.equal(verdict.ok, true, JSON.stringify(verdict));
    const before = await ui.request({ type: 'merge', item: item.id }, 30_000);
    assert.deepEqual([before.ok, (before as { code?: string }).code], [false, 'review-claimant']);
    const rev = await spawnSpoke({ hub, name: 'rev', sessionId: 'rev-real', role: 'reviewer' });
    onCleanup(t, () => rev.close());
    await rev.waitForPresence(['rev']);
    const view = ((await ui.request({ type: 'task.view', item: item.id })).value as { item: ItemView }).item;
    assert.equal(view.claim?.sessionId, 'rev-real');
    assert.equal(view.verdicts[0]?.writer?.sessionId, 'rev-real');
    assert.equal(view.verdicts[0]?.writer?.role, 'reviewer');
    assert.notEqual(view.status, 'ready');
    assert.deepEqual(view.holds, []);
    const after = await ui.request({ type: 'merge', item: item.id }, 30_000);
    assert.deepEqual([after.ok, (after as { code?: string }).code], [false, 'review-claimant']);
  });
}

test('failed SQLite identity adoption fences verifier work and a retry adopts cleanly without self-review', async t => {
  const root = await tempProject(t);
  await repository(root);
  const tips = manualTips();
  const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db'), scheduleTips: tips.scheduleTips });
  tracker.start();
  onCleanup(t, () => tracker.stop());
  const hub = await startHub({ tracker, roles: fixedRoles() });
  onCleanup(t, () => hub.close());
  const ui = await connectWsUi(t, hub);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  assert.equal((await ui.request({ type: 'role.set', session: 'rev', role: 'implementer' })).ok, true);
  const made = await ui.request({ size: 'M', type: 'task.create', title: 'Failed adoption', assignee: 'rev' });
  const item = (made.value as { item: ItemView }).item;
  const claimed = await ui.request({ type: 'task.claim', item: item.id, as: { name: 'rev' } });
  const work = (claimed.value as { worktree: { path: string } }).worktree;
  await writeFile(join(work.path, 'feature'), 'reviewed\n');
  git(work.path, 'add', 'feature');
  git(work.path, 'commit', '-qm', 'Reviewed');
  await tips.refresh();
  assert.equal((await ui.request({ type: 'role.set', session: 'rev', role: 'reviewer' })).ok, true);
  assert.equal((await ui.request({ type: 'task.hold', item: item.id, as: { name: 'rev' } })).ok, true);
  assert.equal((await ui.request({ type: 'task.comment', item: item.id, as: { name: 'rev' }, verdict: { verdict: 'review', scope: 'full', result: 'clear', run: 'before-failure' } })).ok, true);
  const { DatabaseSync } = await import('node:sqlite');
  const prepare = DatabaseSync.prototype.prepare;
  let block = true;
  let failures = 0;
  // The native SQLite boundary fails after the earlier identity updates inside the transaction.
  t.mock.method(DatabaseSync.prototype, 'prepare', function (this: InstanceType<typeof DatabaseSync>, sql: string) {
    if (block && sql.startsWith('update tracker_written_verdicts set session_id')) {
      failures++;
      throw Object.assign(new Error('SQLITE_BUSY during adoption'), { code: 'SQLITE_BUSY' });
    }
    return prepare.call(this, sql);
  });
  const rev = await spawnSpoke({ hub, name: 'rev', sessionId: 'rev-real', role: 'reviewer' });
  onCleanup(t, () => rev.close());
  await rev.waitForPresence(['rev']);
  const read = async () => ((await ui.request({ type: 'task.view', item: item.id })).value as { item: ItemView }).item;
  assert.ok(failures >= 1);
  assert.equal((await read()).claim?.sessionId, 'name:rev', 'the failed transaction rolled back');
  const evidence = tracker.mergeView(item.id);
  assert.equal(evidence.claim?.sessionId, 'rev-real', 'gate evidence resolves the authoritative hello identity before durable adoption');
  assert.equal(evidence.verdicts[0]?.writer?.sessionId, 'rev-real');
  const refused = await rev.call<{ ok: boolean; error?: string }>('task.comment', { id: item.id, verdict: 'review', scope: 'full', result: 'clear', run: 'after-failure' });
  assert.equal(refused.ok, false, JSON.stringify(refused));
  assert.match(refused.error ?? '', /adoption.*SQLITE_BUSY/);
  const held = await rev.call<{ ok: boolean }>('task.hold', { id: item.id });
  assert.equal(held.ok, false, 'holds are fenced too');
  assert.equal((await read()).verdicts.length, 1, 'no verdict persisted under a half-adopted identity');
  assert.notEqual((await read()).status, 'ready');
  const gate = await ui.request({ type: 'merge', item: item.id }, 30_000);
  assert.deepEqual([gate.ok, (gate as { code?: string }).code], [false, 'review-claimant']);
  block = false;
  assert.equal((await rev.call<{ ok: boolean }>('task.hold', { id: item.id })).ok, true, 'next work retries adoption before proceeding');
  const adopted = await read();
  assert.equal(adopted.claim?.sessionId, 'rev-real');
  assert.equal(adopted.verdicts[0]?.writer?.sessionId, 'rev-real');
  assert.equal(adopted.holds[0]?.sessionId, 'rev-real');
  assert.equal((await rev.call<{ ok: boolean }>('task.comment', { id: item.id, verdict: 'review', scope: 'full', result: 'clear', run: 'after-retry' })).ok, true);
  const after = await ui.request({ type: 'merge', item: item.id }, 30_000);
  assert.deepEqual([after.ok, (after as { code?: string }).code], [false, 'review-claimant']);
  assert.notEqual((await read()).status, 'ready');
  assert.equal(ui.frames.some(f => f.type === 'task' && (f.item as ItemView | undefined)?.status === 'ready'), false);
});


for (const legacyClaim of [false, true]) {
test(`restart rebuilds failed-adoption fences before real-id CLI releases or verdicts (legacy claim=${legacyClaim})`, async t => {
  const root = await tempProject(t);
  await repository(root);
  const tips = manualTips();
  let daemon = await serveProject(root, { log: () => {}, scheduleTips: tips.scheduleTips });
  onCleanup(t, () => daemon.stop());
  const ui = await connectUi(t, daemon.discovery!);
  assert.equal((await ui.request({ type: 'role.set', session: 'rev', role: 'implementer' })).ok, true);
  const made = await ui.request({ size: 'M', type: 'task.create', title: 'Restart adoption', assignee: 'rev' });
  const item = (made.value as { item: ItemView }).item;
  const claimed = await ui.request({ type: 'task.claim', item: item.id, as: { name: 'rev' } });
  const work = (claimed.value as { worktree: { path: string } }).worktree;
  await writeFile(join(work.path, 'feature'), 'reviewed\n');
  git(work.path, 'add', 'feature');
  git(work.path, 'commit', '-qm', 'Reviewed');
  await tips.refresh();
  assert.equal((await ui.request({ type: 'role.set', session: 'rev', role: 'reviewer' })).ok, true);
  assert.equal((await ui.request({ type: 'task.comment', item: item.id, as: { name: 'rev' }, verdict: { verdict: 'review', scope: 'full', result: 'clear', run: 'before-restart' } })).ok, true);
  assert.equal((await ui.request({ type: 'task.hold', item: item.id, as: { name: 'rev' } })).ok, true);
  const { DatabaseSync } = await import('node:sqlite');
  const prepare = DatabaseSync.prototype.prepare;
  let block = true;
  let failures = 0;
  t.mock.method(DatabaseSync.prototype, 'prepare', function (this: InstanceType<typeof DatabaseSync>, sql: string) {
    if (block && sql.startsWith('update tracker_written_verdicts set session_id')) {
      failures++;
      throw Object.assign(new Error('SQLITE_BUSY during adoption'), { code: 'SQLITE_BUSY' });
    }
    return prepare.call(this, sql);
  });
  const rev = await spawnSpoke({ discover: true, cwd: root, name: 'rev', sessionId: 'rev-real', role: 'reviewer' });
  onCleanup(t, () => rev.close());
  await rev.waitForPresence(['rev']);
  const before = ((await ui.request({ type: 'task.view', item: item.id })).value as { item: ItemView }).item;
  assert.ok(failures >= 1);
  assert.equal(before.claim?.sessionId, 'name:rev');
  assert.equal(before.holds[0]?.sessionId, 'name:rev');
  let legacyId: string | undefined;
  if (legacyClaim) {
    assert.equal((await ui.request({ type: 'role.set', session: 'legacy', role: 'implementer' })).ok, true);
    const made = await ui.request({ size: 'M', type: 'task.create', title: 'Legacy identity', assignee: 'legacy' });
    legacyId = (made.value as { item: ItemView }).item.id;
    assert.equal((await ui.request({ type: 'task.claim', item: legacyId, as: { name: 'legacy' } })).ok, true);
    const legacy = await spawnSpoke({ discover: true, cwd: root, name: 'legacy', sessionId: 'legacy-real', role: 'implementer' });
    onCleanup(t, () => legacy.close());
    await legacy.waitForPresence(['legacy']);
    await ui.request({ type: 'task.view', item: legacyId });
    await legacy.close();
  }
  await rev.close();
  await daemon.stop();
  if (legacyClaim) {
    const db = new DatabaseSync(join(root, '.cland', 'hub.db'));
    db.prepare('update tracker_claims set session_id = null where item_id = ?').run(legacyId!);
    db.close();
  }
  // There is no fresh spoke hello: CLI calls use the identity retained by the hub store.
  daemon = await serveProject(root, { log: () => {}, scheduleTips: tips.scheduleTips });
  const ui2 = await connectUi(t, daemon.discovery!);
  const env = { CLAND_SESSION_NAME: 'rev', CLAND_SESSION_ID: 'rev-real' };
  const refused = await clandWithEnv(root, env, 'task', 'hold', item.id, '--release', '--json');
  assert.notEqual(refused.code, 0, 'startup failure reconstructs a fence before release');
  assert.match(refused.stderr, /adoption.*SQLITE_BUSY/);
  block = false;
  if (legacyId) {
    const release = await clandWithEnv(root, { CLAND_SESSION_NAME: 'legacy', CLAND_SESSION_ID: 'legacy-real' }, 'task', 'claim', legacyId, '--release');
    assert.equal(release.code, 0, release.stderr);
  }
  const released = await clandWithEnv(root, env, 'task', 'hold', item.id, '--release', '--json');
  assert.equal(released.code, 0, released.stderr);
  assert.deepEqual((JSON.parse(released.stdout) as { holds: ItemView['holds'] }).holds, []);
  const read = async () => ((await ui2.request({ type: 'task.view', item: item.id })).value as { item: ItemView }).item;
  const adopted = await read();
  assert.equal(adopted.claim?.sessionId, 'rev-real');
  assert.equal(adopted.claim?.claimedAt, before.claim?.claimedAt);
  assert.equal(adopted.verdicts[0]?.writer?.sessionId, 'rev-real');
  assert.equal((await clandWithEnv(root, env, 'task', 'hold', item.id)).code, 0);
  const verdict = await clandWithEnv(root, env, 'task', 'comment', item.id, 'after restart', '--verdict', 'review', '--scope', 'full', '--result', 'clear', '--run', 'after-restart');
  assert.equal(verdict.code, 0, verdict.stderr);
  assert.deepEqual((await read()).holds, []);
  const gate = await ui2.request({ type: 'merge', item: item.id }, 30_000);
  assert.deepEqual([gate.ok, (gate as { code?: string }).code], [false, 'review-claimant']);
  assert.notEqual((await read()).status, 'ready');
  assert.equal((await ui2.request({ type: 'role.set', session: 'rev', role: 'implementer' })).ok, true);
  const claimRelease = await clandWithEnv(root, env, 'task', 'claim', item.id, '--release');
  assert.equal(claimRelease.code, 0, claimRelease.stderr);
  assert.equal((await read()).claim, null);
});

}
