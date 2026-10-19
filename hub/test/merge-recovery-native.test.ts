// T3: native Git publication/rollback and session-worktree cleanup; SIGKILL after ref movement proves process restart recovery.
import { onCleanup } from './process-cleanup.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { cland, flushProjectLogs, connectUi, eventually, killDaemon, inProcessSpoke, nativeProjectHub, startDaemon } from './harness.ts';
import { git, ok, json, project, task, review, refused } from './merge-native-support.ts';
import { observableProject } from './merge-support.ts';


test('a close write failure reports merged follow-up failure; retry closes and prunes without a second commit', async (t) => {
  const { root, ui, rev, discovery, stop } = await project(t);
  const work = await task(root);
  await review(rev, work.id);
  const topic = await ui.request({ type: 'topic.create', title: 'Retry parser', item: work.id });
  assert.equal(topic.ok, true, topic.error);
  const before = git(root, 'rev-parse', 'dev');
  const obstruction = join(root, '.cland', 'tasks', `.T-1-ship-the-parser.md.${discovery.pid}.tmp`);
  await mkdir(obstruction);
  const first = json<{ commit: string; followUp?: { step: string; error: string } }>(await cland(root, 'merge', work.id, '--json'));
  assert.equal(first.followUp?.step, 'close');
  assert.match(first.followUp?.error ?? '', /merged, follow-up failed: close/);
  assert.equal(git(root, 'rev-parse', 'dev'), first.commit);
  assert.equal(git(join(root, '.cland', 'territory.git'), 'rev-parse', 'dev'), first.commit);
  assert.equal(git(root, 'rev-list', '--count', `${before}..dev`), '1');
  assert.equal(json<{ item: { state: string } }>(await cland(root, 'task', 'view', work.id, '--json')).item.state, 'open');
  assert.ok(existsSync(work.path));
  await rm(obstruction, { recursive: true });
  // The prepared landing is durable across hub replacement, not just remembered by this request.
  await stop();
  const restarted = await nativeProjectHub(t, root, {}, { harnesses: 'fake' });
  const retryUi = await connectUi(t, restarted.discovery);
  const retry = json<{ commit: string; followUp?: unknown }>(await cland(root, 'merge', work.id, '--json'));
  assert.equal(retry.commit, first.commit);
  assert.equal(retry.followUp, undefined);
  assert.equal(git(root, 'rev-list', '--count', `${before}..dev`), '1');
  const closed = json<{ item: { state: string; claim: unknown; comments: Array<{ text: string }> } }>(await cland(root, 'task', 'view', work.id, '--json')).item;
  assert.equal(closed.state, 'closed');
  assert.equal(closed.claim, null);
  assert.equal(closed.comments.filter(c => c.text.includes(`Merged ${first.commit}`)).length, 1);
  // Closing succeeds before deferred session cleanup necessarily removes the worktree.
  await eventually('retried merge worktree cleanup', () => !existsSync(work.path) ? true : undefined);
  assert.equal(existsSync(work.path), false);
  const history = await retryUi.request({ type: 'topic.history', topic: (topic.value as { topic: { id: string } }).topic.id });
  assert.equal((history.value as { topic: { status: string } }).topic.status, 'closed');
  const again = json<{ commit: string; cleanup: string; followUp?: unknown }>(await cland(root, 'merge', 't-01', '--json'));
  assert.equal(again.commit, first.commit);
  assert.equal(again.cleanup, 'removed');
  assert.equal(again.followUp, undefined);
  assert.equal((await retryUi.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const journal = await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8');
  assert.match(journal, /"event":"merge-follow-up-failed"/);
  assert.doesNotMatch(journal, /"event":"merge-refused"/);
});


test('restart after local ref movement but before territory push republishes the prepared commit without another squash', async (t) => {
  const { root, rev, discovery } = await project(t, {}, startDaemon);
  const work = await task(root);
  await review(rev, work.id);
  const before = git(root, 'rev-parse', 'dev');
  const hook = join(root, '.git', 'hooks', 'pre-push');
  await writeFile(hook, '#!/bin/sh\nkill -KILL "$(ps -p "$PPID" -o ppid=)"\nexit 1\n', { mode: 0o755 });
  const interrupted = await cland(root, 'merge', work.id, '--json');
  assert.notEqual(interrupted.code, 0);
  await killDaemon(discovery.pid);
  const local = git(root, 'rev-parse', 'dev');
  assert.notEqual(local, before);
  assert.equal(git(join(root, '.cland', 'territory.git'), 'rev-parse', 'dev'), before);
  assert.equal(git(root, 'rev-list', '--count', `${before}..dev`), '1');
  await rm(hook);
  await startDaemon(t, root);
  // A reconnecting session can defer cleanup independently of publishing the
  // recovered commit. Keep that state observable instead of relying on timing.
  const holder = await inProcessSpoke(t, { discover: true, cwd: work.path, name: 'cleanup-peer', sessionId: 'cleanup-peer', role: 'implementer' });
  onCleanup(t, () => holder.close());
  await holder.waitForPresence(['cleanup-peer']);
  const retried = json<{ commit: string; cleanup: string; followUp?: unknown }>(await cland(root, 'merge', work.id, '--json'));
  const diagnostics = async () => {
    await flushProjectLogs(t, root);
    const journal = (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).split('\n').filter(line => /merge|worktree|cleanup-peer/.test(line));
    return `${JSON.stringify(retried)}\n${journal.join('\n')}`;
  };
  assert.equal(retried.commit, local);
  assert.equal(retried.followUp, undefined, await diagnostics());
  assert.equal(retried.cleanup, 'waiting for sessions', await diagnostics());
  assert.equal(git(root, 'rev-list', '--count', `${before}..dev`), '1');
  assert.equal(git(join(root, '.cland', 'territory.git'), 'rev-parse', 'dev'), local);
  await holder.close();
  try {
    await eventually('recovered merge worktree cleanup', () => !existsSync(work.path) && git(root, 'branch', '--list', work.branch) === '' ? true : undefined);
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${await diagnostics()}`, { cause: error });
  }
});


test('deferred cleanup preserves a worktree switched onto an unrelated branch and can finish once restored', async (t) => {
  const { root, ui, rev } = await project(t);
  // Keep the session alive to exercise deferred cleanup after an explicit stop.
  assert.equal((await ui.request({ type: 'crew.set', key: 'implementer.stop_after', value: 'never' })).ok, true);
  const work = await task(root);
  ok(await cland(root, 'session', 'launch', 'impl-1', '--role', 'implementer', '--harness', 'claude-code', '--item', work.id));
  await review(rev, work.id);
  const merged = json<{ commit: string; cleanup: string }>(await cland(root, 'merge', work.id, '--json'));
  assert.equal(merged.cleanup, 'waiting for sessions');
  git(work.path, 'switch', '-c', 'keep-this-branch');
  ok(await cland(root, 'session', 'stop', 'impl-1'));
  await eventually('branch mismatch recorded by deferred cleanup', async () => (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).includes('worktree branch changed since merge') ? true : undefined);
  assert.ok(existsSync(work.path));
  assert.notEqual(git(root, 'branch', '--list', 'keep-this-branch'), '');
  assert.notEqual(git(root, 'branch', '--list', work.branch), '');
  git(work.path, 'switch', work.branch);
  const retry = json<{ commit: string; cleanup: string }>(await cland(root, 'merge', work.id, '--json'));
  assert.equal(retry.commit, merged.commit);
  assert.equal(retry.cleanup, 'removed');
  await eventually('restored branch worktree cleanup', () => !existsSync(work.path) ? true : undefined);
  assert.equal(existsSync(work.path), false);
  assert.notEqual(git(root, 'branch', '--list', 'keep-this-branch'), '');
});

test('deferred cleanup keeps the task branch and worktree if its tip moved after landing', async (t) => {
  const { root, ui, rev } = await project(t);
  // Keep the session alive to exercise deferred cleanup after an explicit stop.
  assert.equal((await ui.request({ type: 'crew.set', key: 'implementer.stop_after', value: 'never' })).ok, true);
  const work = await task(root);
  ok(await cland(root, 'session', 'launch', 'impl-1', '--role', 'implementer', '--harness', 'claude-code', '--item', work.id));
  await review(rev, work.id);
  const merged = json<{ commit: string; cleanup: string }>(await cland(root, 'merge', work.id, '--json'));
  assert.equal(merged.cleanup, 'waiting for sessions');
  await writeFile(join(work.path, 'parser.txt'), 'additional unmerged work\n');
  git(work.path, 'commit', '-qam', 'After landing');
  const extra = git(work.path, 'rev-parse', 'HEAD');
  ok(await cland(root, 'session', 'stop', 'impl-1'));
  await eventually('moved tip reported as kept', async () => {
    const journal = await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8');
    if (journal.includes(`branch moved since merge (${extra}), kept`)) return true;
    assert.ok(existsSync(work.path), 'cleanup must keep the worktree holding new commits');
    return undefined;
  });
  assert.ok(existsSync(work.path));
  assert.equal(git(root, 'rev-parse', work.branch), extra);
  assert.equal(git(root, 'rev-parse', 'dev'), merged.commit);
  assert.equal(await readFile(join(work.path, 'parser.txt'), 'utf8'), 'additional unmerged work\n');
});


test('a rejected push with failed rollback remains landed and retry restores the root tree before publication completes', async (t) => {
  const { root, rev, stop } = await project(t);
  const work = await task(root);
  await review(rev, work.id);
  const before = git(root, 'rev-parse', 'dev');
  const hook = join(root, '.git', 'hooks', 'pre-push');
  await writeFile(hook, '#!/bin/sh\nprintf \'locked\n\' > "$(git rev-parse --git-path refs/heads/dev.lock)"\nexit 1\n', { mode: 0o755 });
  const result = json<{ commit: string; followUp?: { step: string; error: string } }>(await cland(root, 'merge', work.id, '--json'));
  assert.ok(result.followUp);
  assert.match(result.followUp.error, /rollback failed|publish pending/);
  assert.equal(git(root, 'rev-parse', 'dev'), result.commit);
  assert.equal(git(join(root, '.cland', 'territory.git'), 'rev-parse', 'dev'), before);
  assert.equal(git(root, 'write-tree'), git(root, 'rev-parse', `${before}^{tree}`));
  assert.equal(existsSync(join(root, 'parser.txt')), false);
  await flushProjectLogs(t, root);
  const journal = await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8');
  assert.doesNotMatch(journal, /"event":"merge-refused"/);
  await rm(hook);
  await rm(join(root, '.git', 'refs', 'heads', 'dev.lock'));
  await stop();
  await nativeProjectHub(t, root, {}, { harnesses: 'fake' });
  // The rollback receipt survives restart and refuses an index edited since that recorded rollback.
  await writeFile(join(root, 'README.md'), 'staged work to preserve\n');
  git(root, 'add', 'README.md');
  const staged = git(root, 'write-tree');
  const edited = json<{ commit: string; followUp?: { step: string } }>(await cland(root, 'merge', work.id, '--json'));
  assert.equal(edited.commit, result.commit);
  assert.equal(edited.followUp?.step, 'checkout');
  assert.equal(git(root, 'write-tree'), staged);
  assert.equal(await readFile(join(root, 'README.md'), 'utf8'), 'staged work to preserve\n');
  git(root, 'restore', '--source', before, '--staged', '--worktree', 'README.md');
  // Recovery must preserve new root work rather than overwrite it just to finish the prior landing.
  await writeFile(join(root, 'parser.txt'), 'local work to preserve\n');
  const obstructed = json<{ commit: string; followUp?: { step: string } }>(await cland(root, 'merge', work.id, '--json'));
  assert.equal(obstructed.commit, result.commit);
  assert.equal(obstructed.followUp?.step, 'checkout');
  assert.equal(await readFile(join(root, 'parser.txt'), 'utf8'), 'local work to preserve\n');
  assert.equal(git(join(root, '.cland', 'territory.git'), 'rev-parse', 'dev'), before);
  await rm(join(root, 'parser.txt'));
  const retry = json<{ commit: string; followUp?: unknown }>(await cland(root, 'merge', work.id, '--json'));
  assert.equal(retry.commit, result.commit);
  assert.equal(retry.followUp, undefined);
  assert.equal(git(root, 'rev-list', '--count', `${before}..dev`), '1');
  assert.equal(git(join(root, '.cland', 'territory.git'), 'rev-parse', 'dev'), result.commit);
  assert.equal(git(root, 'write-tree'), git(root, 'rev-parse', 'dev^{tree}'));
  assert.equal(git(root, 'diff', '--name-only'), '');
  assert.equal(await readFile(join(root, 'parser.txt'), 'utf8'), 'finished\n');
  // Publishing succeeds before deferred session cleanup necessarily removes the worktree.
  await eventually('retried rejected-push worktree cleanup', () => !existsSync(work.path) ? true : undefined);
  assert.equal(existsSync(work.path), false);
});

test('a published receipt remains landed when local rollback succeeds, and retry repairs the root ref and tree', async (t) => {
  const { root, rev } = await project(t);
  const work = await task(root);
  await review(rev, work.id);
  const before = git(root, 'rev-parse', 'dev');
  const hook = join(root, '.git', 'hooks', 'pre-push');
  await writeFile(hook, '#!/bin/sh\ngit -c core.hooksPath=/dev/null push .cland/territory.git refs/heads/dev:refs/heads/dev || exit 2\nexit 1\n', { mode: 0o755 });
  const result = json<{ commit: string; followUp?: unknown }>(await cland(root, 'merge', work.id, '--json'));
  assert.ok(result.followUp);
  assert.equal(git(root, 'rev-parse', 'dev'), before);
  assert.equal(git(join(root, '.cland', 'territory.git'), 'rev-parse', 'dev'), result.commit);
  assert.equal(git(root, 'write-tree'), git(root, 'rev-parse', `${before}^{tree}`));
  await rm(hook);
  const retry = json<{ commit: string; followUp?: unknown }>(await cland(root, 'merge', work.id, '--json'));
  assert.equal(retry.commit, result.commit);
  assert.equal(retry.followUp, undefined);
  assert.equal(git(root, 'rev-list', '--count', `${before}..dev`), '1');
  assert.equal(git(root, 'write-tree'), git(root, 'rev-parse', 'dev^{tree}'));
  assert.equal(await readFile(join(root, 'parser.txt'), 'utf8'), 'finished\n');
});


test('retrying a completed merge preserves staged deletion and reversion of its touched files', async (t) => {
  for (const file of ['parser.txt', 'README.md']) await t.test(file, async (t) => {
    const { root, rev } = await project(t);
    const work = await task(root, 'Ship changes', file);
    await review(rev, work.id);
    const merged = json<{ commit: string }>(await cland(root, 'merge', work.id, '--json'));
    if (file === 'parser.txt') git(root, 'rm', file);
    else {
      await writeFile(join(root, file), 'project\n');
      git(root, 'add', file);
    }
    const staged = git(root, 'write-tree');
    const retry = json<{ commit: string; followUp?: unknown }>(await cland(root, 'merge', work.id, '--json'));
    assert.equal(retry.commit, merged.commit);
    assert.equal(retry.followUp, undefined);
    assert.equal(git(root, 'write-tree'), staged, 'receipt recovery must keep staged edits');
    if (file === 'parser.txt') assert.equal(existsSync(join(root, file)), false);
    else assert.equal(await readFile(join(root, file), 'utf8'), 'project\n');
  });
});

test('native worktree and branch cleanup failures remain landed and retry safely', async (t) => {
  for (const step of ['cleanup', 'branch cleanup']) {
    await t.test(step, async t => {
      const { root, tracker, ui, rev, work } = await observableProject(t);
      await review(rev, work.id);
      const before = git(root, 'rev-parse', 'dev');
      const topic = await ui.request({ type: 'topic.create', title: 'Follow-ups', item: work.id });
      assert.equal(topic.ok, true, topic.error);
      let repair: () => void | Promise<void> = () => {};
      if (step === 'release') {
        const db = new DatabaseSync(join(root, '.cland', 'hub.db'));
        onCleanup(t, () => db.close());
        db.exec("create trigger fail_release before delete on tracker_claims begin select raise(abort, 'release failure'); end");
        repair = () => db.exec('drop trigger fail_release');
      } else if (step === 'topic close') {
        const db = new DatabaseSync(join(root, '.cland', 'hub.db'));
        onCleanup(t, () => db.close());
        db.exec("create trigger fail_topic before update of status on topics when old.item = 'T-1' begin select raise(abort, 'topic closure failure'); end");
        repair = () => db.exec('drop trigger fail_topic');
      } else if (step === 'branch cleanup') {
        const lock = join(root, '.git', 'refs', 'heads', `${work.branch}.lock`);
        await writeFile(lock, 'branch locked\n');
        repair = () => rm(lock);
      } else {
        await writeFile(join(work.path, 'parser.txt'), 'uncommitted work\n');
        repair = () => writeFile(join(work.path, 'parser.txt'), 'parser\n');
      }
      const response = await ui.request({ type: 'merge', item: work.id }, 30_000);
      assert.equal(response.ok, true, response.error);
      const first = response.value as { commit: string; followUp?: { step: string; error: string } };
      assert.equal(first.followUp?.step, step === 'branch cleanup' ? 'cleanup' : step);
      assert.ok(first.followUp?.error.includes('merged, follow-up failed:'));
      assert.equal(git(root, 'rev-parse', 'dev'), first.commit);
      assert.equal(tracker.view(work.id).state, 'closed');
      await repair();
      const retried = await ui.request({ type: 'merge', item: work.id }, 30_000);
      assert.equal(retried.ok, true, retried.error);
      const done = retried.value as { commit: string; followUp?: unknown };
      assert.equal(done.commit, first.commit);
      assert.equal(done.followUp, undefined);
      assert.equal(git(root, 'rev-list', '--count', `${before}..dev`), '1');
      assert.equal(tracker.view(work.id).claim, null);
      // Closing succeeds before deferred session cleanup necessarily removes the worktree.
      await eventually('retried follow-up worktree cleanup', () => !existsSync(work.path) ? true : undefined);
      assert.equal(existsSync(work.path), false);
      assert.equal(git(root, 'branch', '--list', work.branch), '');
      const history = await ui.request({ type: 'topic.history', topic: (topic.value as { topic: { id: string } }).topic.id });
      assert.equal((history.value as { topic: { status: string } }).topic.status, 'closed');
    });
  }
});
