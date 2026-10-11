// A launch with an item never overwrites a claim another session took while the harness started (rev-cc on T-58): it
// is refused and the session it started is stopped. A real tracker, and a stand-in for the sessions whose launch lets
// another session claim the item meanwhile.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Tracker } from '../tracker/tracker.ts';
import { TaskWorktrees, type SessionCwd } from './worktrees.ts';
import { provisionTerritory, removeTaskWorktree } from '../territory.ts';
import { Report } from '../init/files.ts';
import type { Sessions } from '../adapters/sessions.ts';
import type { HarnessProcessView } from '../protocol.ts';

test('an offline Lead successor adopts its provisional claim before its first hello', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-worktrees-adopt-'));
  let now = 0;
  const tracker = new Tracker({ root, db: join(root, 'hub.db'), now: () => new Date(++now * 1000) });
  t.after(async () => {
    await tracker.stop();
    await rm(root, { recursive: true, force: true });
  });
  await tracker.create({ id: 'human', name: 'human', role: null }, { title: 'Handed-over node', kind: tracker.levels[1]! });
  const before = (await tracker.claim({ id: 'name:later', name: 'later', role: 'lead' }, 'T-1')).claim;
  assert.ok(before);
  const process = { name: 'later', role: 'lead', sessionId: 'sess-later', cwd: root, item: 'T-1' } as HarnessProcessView;
  let published = false;
  tracker.useSessionIdentity(id => published && id === 'name:later' ? process.sessionId : id);
  // The adapter returns its proven identity without any spoke hello to adopt it first.
  const sessions = { retainedPool: () => false, launch: async () => { published = true; return process; }, stop: async () => process } as unknown as Sessions;
  const launched = await new TaskWorktrees({ tracker }).launch(sessions, { name: 'later', role: 'lead', item: 'T-1' });
  assert.deepEqual(launched.claim, { ...before, sessionId: 'sess-later' });
});

test('a claim another session takes during the launch refuses it: the claim stays, the new session is stopped', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'cland-worktrees-unit-'));
  const tracker = new Tracker({ root, db: join(root, 'hub.db') });
  t.after(async () => {
    await tracker.stop();
    await rm(root, { recursive: true, force: true });
  });
  // no territory here: the launch goes to the project root, which is all this race needs
  await tracker.create({ id: 'human', name: 'human', role: null }, { title: 'Contested', kind: 'task' });
  await tracker.claim({ id: 'sess-coord', name: 'coord', role: 'coordinator' }, 'T-1');
  const process = { name: 'impl-1', role: 'implementer', sessionId: 'sess-impl-1', cwd: root, item: null } as HarnessProcessView;
  const stopped: string[] = [];
  const sessions = {
    retainedPool: () => false,
    launch: async () => {
      await tracker.claim({ id: 'sess-impl-9', name: 'impl-9', role: 'implementer' }, 'T-1', { force: true });
      return process;
    },
    stop: async (name: string) => {
      stopped.push(name);
      return { ...process, status: 'stopped' };
    },
  } as unknown as Sessions;

  await assert.rejects(
    new TaskWorktrees({ tracker }).launch(sessions, { name: 'impl-1', role: 'implementer', item: 'T-1' }),
    /T-1 is claimed by impl-9 \(implementer\), taken while impl-1 started: launch refused, the claim stays with its holder; impl-1 was stopped/,
  );
  assert.deepEqual(stopped, ['impl-1']);
  assert.equal(tracker.view('T-1').claim?.session, 'impl-9');

  // the Coordinator's claim, still in place after the spawn, is taken over as before
  await tracker.claim({ id: 'sess-coord', name: 'coord', role: 'coordinator' }, 'T-1', { force: true });
  const quiet = { retainedPool: () => false, launch: async () => process } as unknown as Sessions;
  const taken = await new TaskWorktrees({ tracker }).launch(quiet, { name: 'impl-1', role: 'implementer', item: 'T-1' });
  assert.equal(taken.claim?.session, 'impl-1');
});

/** A Git project on its territory (`provisionTerritory`, as `cland init` runs it), with a real tracker. */
async function territoryProject(t: TestContext, sessions: () => SessionCwd[]) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cland-worktrees-race-')));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 'test@example.com');
  git('config', 'commit.gpgsign', 'false');
  await writeFile(join(root, 'README.md'), 'project\n');
  git('add', '.');
  git('commit', '-qm', 'Initial');
  provisionTerritory(new Report(root), root);
  const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db') });
  t.after(async () => {
    await tracker.stop();
    await rm(root, { recursive: true, force: true });
  });
  return { root, git, tracker, worktrees: new TaskWorktrees({ tracker, sessions }) };
}

const HUMAN = { id: 'human', name: 'human', role: null };

test('merged cleanup restores the worktree when the branch moves between removal and CAS deletion', async (t) => {
  const { root, git, tracker, worktrees } = await territoryProject(t, () => []);
  await tracker.create(HUMAN, { title: 'Raced cleanup', kind: 'task' });
  const { worktree } = await worktrees.afterClaim('T-1', 'human');
  assert.ok(worktree);
  const tip = git('rev-parse', worktree.branch);
  const next = git('commit-tree', `${tip}^{tree}`, '-p', tip, '-m', 'Unmerged work');
  let checks = 0;
  await assert.rejects(removeTaskWorktree(root, 'T-1', () => {
    if (++checks === 2) git('update-ref', `refs/heads/${worktree.branch}`, next, tip);
  }, { branch: worktree.branch, tip }), new RegExp(`branch moved since merge \\(${next}\\), kept`));
  assert.equal(git('rev-parse', worktree.branch), next);
  assert.ok(existsSync(worktree.path));
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: worktree.path, encoding: 'utf8' }).trim(), next);
});

test('prune checks again under the lock: an item reopened, or a session entering, while it read Git keeps its worktree (rev-6 on T-58)', async (t) => {
  // the sessions as the hub sees them: whatever the test makes happen while the listing reads Git
  let during: () => SessionCwd[] = () => [];
  const { root, git, tracker, worktrees } = await territoryProject(t, () => during());
  for (const title of ['Reopened', 'Entered', 'Gone']) await tracker.create(HUMAN, { title, kind: 'task' });
  for (const id of ['T-1', 'T-2', 'T-3']) assert.ok((await worktrees.afterClaim(id, 'human')).worktree, id);
  for (const id of ['T-1', 'T-2', 'T-3']) await tracker.close(HUMAN, id);
  const path = (id: string) => join(root, '.cland', 'worktrees', id);

  // after the listing, while prune removes T-3 (Git under the lock): T-1 is reopened and impl-2 enters T-2's worktree.
  // The listing saw both closed and empty; the checks right before their removals see what changed.
  let calls = 0;
  during = () => {
    calls++;
    if (calls === 1) return [];
    if (calls === 2) {
      const file = join(root, tracker.view('T-1').path);
      writeFileSync(file, readFileSync(file, 'utf8').replace('state: closed', 'state: open'));
      return [];
    }
    return [{ name: 'impl-2', cwd: join(path('T-2'), 'src') }];
  };
  const r = await worktrees.prune(['T-3', 'T-1', 'T-2']);
  assert.deepEqual(r.removed.map((x) => x.item), ['T-3']);
  assert.deepEqual(r.failed, [
    { item: 'T-1', error: 'T-1 is open now: prune removes only the worktrees of closed items' },
    { item: 'T-2', error: 'T-2: impl-2 now stands inside its worktree' },
  ]);
  assert.ok(existsSync(path('T-1')));
  assert.ok(existsSync(path('T-2')));
  assert.equal(existsSync(path('T-3')), false);
  assert.notEqual(git('branch', '--list', 't/T-1-reopened'), '');
  assert.notEqual(git('branch', '--list', 't/T-2-entered'), '');
  assert.equal(git('branch', '--list', 't/T-3-gone'), '');
});

test('while a launch for an item is under way, a prune leaves its worktree alone and a second launch for it is refused', async (t) => {
  const { root, tracker, worktrees } = await territoryProject(t, () => []);
  await tracker.create(HUMAN, { title: 'Launching', kind: 'task' });
  const path = join(root, '.cland', 'worktrees', 'T-1');
  const process = { name: 'impl-1', role: 'implementer', sessionId: 'sess-impl-1', cwd: path, item: 'T-1' } as HarnessProcessView;
  let pruned: Awaited<ReturnType<TaskWorktrees['prune']>> | null = null;
  const sessions = {
    retainedPool: () => false,
    // while the harness starts, the item is closed and the human prunes it
    launch: async () => {
      await assert.rejects(worktrees.launch(sessions, { name: 'impl-3', role: 'implementer', item: 'T-1' }), /^Error: T-1: another session is being launched for it$/);
      await tracker.close(HUMAN, 'T-1');
      pruned = await worktrees.prune(['T-1']);
      const file = join(root, tracker.view('T-1').path);
      writeFileSync(file, readFileSync(file, 'utf8').replace('state: closed', 'state: open'));
      return process;
    },
  } as unknown as Sessions;
  const launched = await worktrees.launch(sessions, { name: 'impl-1', role: 'implementer', item: 'T-1' });
  assert.equal(launched.worktree?.path, path);
  assert.equal(launched.claim?.session, 'impl-1');
  assert.deepEqual(pruned, { removed: [], failed: [{ item: 'T-1', error: 'T-1: a session is being launched in its worktree' }] });
  assert.ok(existsSync(path));
});

test('two launches for one item at once: only one goes on; its failed spawn releases only its own reservation, and a prune during the next launch is still refused (rev-6 on T-58)', async (t) => {
  const { root, tracker, worktrees } = await territoryProject(t, () => []);
  await tracker.create(HUMAN, { title: 'Twice', kind: 'task' });
  const path = join(root, '.cland', 'worktrees', 'T-1');
  const spawning = Promise.withResolvers<void>();
  const failSpawn = Promise.withResolvers<void>();
  const spawned: string[] = [];
  const first = {
    retainedPool: () => false,
    launch: async () => {
      spawned.push('impl-1');
      spawning.resolve();
      await failSpawn.promise;
      throw new Error('the harness did not start');
    },
  } as unknown as Sessions;
  const second = {
    retainedPool: () => false,
    launch: async () => {
      spawned.push('impl-2');
      return { name: 'impl-2', role: 'implementer', sessionId: 'sess-impl-2', cwd: path, item: 'T-1' } as HarnessProcessView;
    },
  } as unknown as Sessions;

  // both asked before the first worktree exists: the reservation is taken in the queued step, so the second is refused
  const a = worktrees.launch(first, { name: 'impl-1', role: 'implementer', item: 'T-1' });
  const b = worktrees.launch(second, { name: 'impl-2', role: 'implementer', item: 'T-1' });
  await assert.rejects(b, /^Error: T-1: another session is being launched for it$/);
  await spawning.promise;
  await tracker.close(HUMAN, 'T-1');
  assert.deepEqual((await worktrees.prune(['T-1'])).failed, [{ item: 'T-1', error: 'T-1: a session is being launched in its worktree' }]);
  await tracker.edit(HUMAN, 'T-1', { state: 'open' });
  // the first spawn fails: its cleanup releases its own reservation, nothing else
  failSpawn.resolve();
  await assert.rejects(a, /the harness did not start/);
  assert.deepEqual(spawned, ['impl-1']);

  // the next launch reserves the item afresh: a prune while it spawns is refused, and it ends with the claim
  let prunedDuring: Awaited<ReturnType<TaskWorktrees['prune']>> | null = null;
  const third = {
    retainedPool: () => false,
    launch: async () => {
      await tracker.close(HUMAN, 'T-1');
      prunedDuring = await worktrees.prune(['T-1']);
      const file = join(root, tracker.view('T-1').path);
      writeFileSync(file, readFileSync(file, 'utf8').replace('state: closed', 'state: open'));
      return { name: 'impl-2', role: 'implementer', sessionId: 'sess-impl-2', cwd: path, item: 'T-1' } as HarnessProcessView;
    },
  } as unknown as Sessions;
  const launched = await worktrees.launch(third, { name: 'impl-2', role: 'implementer', item: 'T-1' });
  assert.deepEqual(prunedDuring, { removed: [], failed: [{ item: 'T-1', error: 'T-1: a session is being launched in its worktree' }] });
  assert.equal(launched.claim?.session, 'impl-2');
  assert.ok(existsSync(path));
  // once that launch is done the item is no longer reserved: closed, it can be pruned
  await tracker.close(HUMAN, 'T-1');
  assert.deepEqual((await worktrees.prune(['T-1'])).removed.map((r) => r.item), ['T-1']);
});
