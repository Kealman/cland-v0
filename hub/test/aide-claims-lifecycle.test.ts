// T3: native Git processes create/reuse worktrees, publish reviewed refs/files and preserve refs on refusal.
// Claim, routing and verifier-independence rules are covered without Git in aide-claims.test.ts.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, eventually, inProcessSpoke, projectHub, tempProject } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { copyPreparedProject } from './prepared-project.ts';
import type { ItemView } from '../src/tracker/tracker.ts';
import type { TaskWorktree } from '../src/territory.ts';

const git = (cwd: string, ...args: string[]): string => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

async function project(t: TestContext) {
  const root = await tempProject(t, 'cland-aide-claims-');
  await copyPreparedProject(root);
  const clock = new FakeClock();
  const base = git(root, 'rev-parse', 'dev');
  let head = base;
  let branch: string | undefined;
  // Verdict facts follow the fixture's explicit Git writes, without background Git probes.
  const { discovery } = await projectHub(t, root, {}, {
    clock,
    hasTerritory: async () => true,
    readBase: async () => 'dev',
    git: async args => {
      if (args[0] === 'for-each-ref') return `${base} refs/heads/dev${branch ? `\n${head} refs/heads/${branch}` : ''}`;
      if (args[0] === 'rev-parse') {
        const ref = args.at(-1)?.replace(/\^\{commit\}$/, '');
        if (ref === 'dev' || ref === 'refs/heads/dev' || ref === base) return base;
        if (branch && (ref === branch || ref === `refs/heads/${branch}` || ref === head)) return head;
      }
      return null;
    },
  });
  const ui = await connectUi(t, discovery);
  const aide = await inProcessSpoke(t, { discover: true, cwd: root, name: 'aide-1', sessionId: 'aide-id', role: 'aide', clock });
  const rev = await inProcessSpoke(t, { discover: true, cwd: root, name: 'rev', sessionId: 'reviewer-id', role: 'reviewer', clock });
  t.after(async () => { await aide.close(); await rev.close(); });
  await aide.waitForPresence(['aide-1', 'rev']);
  const made = await aide.call<{ ok: boolean; item: ItemView }>('task.create', { size: 'M', title: 'Aide work' });
  assert.equal(made.ok, true);
  const id = made.item.id;
  assert.equal((await aide.call<{ ok: boolean }>('task.edit', { id, status: 'planned' })).ok, true);
  const claimed = await aide.call<{ ok: boolean; worktree: TaskWorktree; claim: ItemView['claim'] }>('task.claim', { id });
  assert.equal(claimed.ok, true);
  assert.ok(claimed.worktree);
  const work = claimed.worktree;
  await writeFile(join(work.path, 'feature.txt'), 'Aide work\n');
  git(work.path, 'add', 'feature.txt');
  git(work.path, 'commit', '-qm', 'Aide implements the item');
  branch = work.branch;
  head = git(work.path, 'rev-parse', 'HEAD');
  return { root, ui, aide, rev, id, work, claim: claimed.claim };
}

test('native Git creates and reuses the Aide worktree before publishing its reviewed merge', async t => {
  const { root, ui, aide, rev, id, work } = await project(t);
  assert.equal(work.branch, 't/T-1-aide-work');
  assert.equal(work.path, join(root, '.cland', 'worktrees', 'T-1'));
  assert.equal(work.base, 'dev');
  assert.equal(work.createdBranch, true);
  assert.equal(work.createdWorktree, true);
  assert.equal(git(work.path, 'branch', '--show-current'), work.branch);
  let view = await aide.call<{ item: ItemView }>('task.view', { id });
  assert.equal(view.item.branch, work.branch);
  const opened = await aide.call<{ ok: boolean; topic: { id: string } }>('topic.create', { item: id, title: 'Aide item' });
  assert.equal(opened.ok, true);
  const again = await aide.call<{ ok: boolean; worktree: TaskWorktree }>('task.claim', { id });
  assert.equal(again.ok, true);
  assert.equal(again.worktree.path, work.path);
  assert.equal(again.worktree.createdWorktree, false);
  await rev.call('task.comment', { id, verdict: 'review', scope: 'full', result: 'clear', run: 'aide-review' });
  await eventually('native merge review is ready', async () => {
    const current = await aide.call<{ item: ItemView }>('task.view', { id });
    return current.item.status === 'ready' ? true : undefined;
  });
  const merged = await ui.request({ type: 'merge', item: id }, 30_000);
  assert.equal(merged.ok, true, merged.error);
  const { commit } = merged.value as { commit: string };
  assert.equal(git(root, 'rev-parse', 'dev'), commit);
  assert.equal(git(join(root, '.cland', 'territory.git'), 'rev-parse', 'dev'), commit);
  assert.equal(await readFile(join(root, 'feature.txt'), 'utf8'), 'Aide work\n');
  assert.match(git(root, 'show', '-s', '--format=%B', commit), /Reviewed-by: rev \(aide-review\)$/);
  view = await aide.call<{ item: ItemView }>('task.view', { id });
  assert.equal(view.item.state, 'closed');
  assert.equal(view.item.status, 'done');
  assert.equal(view.item.claim, null);
  const history = await ui.request({ type: 'topic.history', topic: opened.topic.id });
  assert.equal((history.value as { topic: { status: string } }).topic.status, 'closed');
});

for (const kind of ['review', 'qa'] as const) {
  test(`a refused self-${kind} leaves native Git refs and the worktree branch intact`, async t => {
    const { root, ui, aide, rev, id, work } = await project(t);
    if (kind === 'qa') {
      const made = await ui.request({ type: 'task.create', title: 'Required QA', kind: 'epic' });
      assert.equal(made.ok, true, made.error);
      const epic = (made.value as { item: ItemView }).item.id;
      assert.equal((await ui.request({ type: 'task.link', item: id, parent: epic })).ok, true);
      const planned = await ui.request({ type: 'task.plan', item: epic, op: 'set', yaml: `stages:\n- name: Required QA\n  qa: {scope: affected, when: per-item}\n  lanes: [[${id}]]\n` });
      assert.equal(planned.ok, true, planned.error);
      assert.equal((await rev.call<{ ok: boolean }>('task.comment', { id, verdict: 'review', scope: 'full', result: 'clear', run: 'independent-review' })).ok, true);
      await eventually('independent review is current', async () => {
        const view = await aide.call<{ item: ItemView }>('task.view', { id });
        return view.item.verdicts[0]?.current === true ? true : undefined;
      });
    }
    assert.equal((await ui.request({ type: 'role.set', session: 'aide-1', role: kind === 'review' ? 'reviewer' : 'qa' })).ok, true);
    assert.equal((await aide.call<{ ok: boolean }>('task.comment', { id, verdict: kind, ...(kind === 'review' ? { scope: 'full' } : {}), result: 'clear', run: 'self-verdict' })).ok, true);
    const refs = git(root, 'show-ref');
    const gate = await ui.request({ type: 'merge', item: id }, 30_000);
    assert.equal(gate.ok, false, JSON.stringify(gate));
    assert.equal((gate as { code?: string }).code, `${kind}-claimant`);
    assert.equal(git(root, 'show-ref'), refs);
    assert.equal(git(work.path, 'branch', '--show-current'), work.branch);
  });
}
