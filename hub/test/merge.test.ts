import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { cland, clandWithEnv, connectUi, connectWsUi, eventually, fakeClaude, killDaemon, sleep, spawnSpoke, startDaemon, startHub, tempProject, type CliResult } from './harness.ts';
import { Store } from '../src/hub/store.ts';
import { parseItem, serializeItem } from '../src/tracker/item.ts';
import { fixedRoles } from '../src/roles/config.ts';
import { Tracker } from '../src/tracker/tracker.ts';
import { gitIn, type Git } from '../src/tracker/verdict-git.ts';

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const ok = (r: CliResult) => { assert.equal(r.code, 0, r.stderr || r.stdout); return r; };
const json = <T>(r: CliResult): T => JSON.parse(ok(r).stdout) as T;

async function project(t: TestContext, env: Record<string, string> = {}) {
  const root = await tempProject(t, 'cland-merge-');
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.name', 'Test');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'commit.gpgsign', 'false');
  await writeFile(join(root, 'README.md'), 'project\n');
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'Initial');
  ok(await cland(root, 'init'));
  const { discovery } = await startDaemon(t, root, env);
  const ui = await connectUi(t, discovery);
  const rev = await spawnSpoke({ discover: true, cwd: root, name: 'rev', sessionId: 'reviewer-id', role: 'reviewer' });
  t.after(() => rev.close());
  await rev.waitForPresence(['rev']);
  return { root, ui, rev, discovery };
}

async function task(root: string, title = 'Ship the parser', file = 'parser.txt') {
  const { item } = json<{ item: { id: string } }>(await cland(root, 'task', 'create', title, '--json'));
  const { worktree } = json<{ worktree: { path: string; branch: string } }>(await cland(root, 'task', 'claim', item.id, '--json'));
  await writeFile(join(worktree.path, file), 'first\n');
  git(worktree.path, 'add', file);
  git(worktree.path, 'commit', '-qm', 'First step');
  await writeFile(join(worktree.path, file), 'finished\n');
  git(worktree.path, 'commit', '-qam', 'Second step');
  return { id: item.id, ...worktree };
}

async function requireQa(root: string, ui: Awaited<ReturnType<typeof connectUi>>, id: string) {
  const result = await ui.request({ type: 'task.create', title: 'QA plan', kind: 'epic' });
  const epic = (result.value as { item: { id: string } }).item.id;
  ok(await cland(root, 'task', 'link', id, '--parent', epic));
  const plan = await ui.request({ type: 'task.plan', item: epic, op: 'set', yaml: `stages:\n- name: Required QA\n  qa: {scope: affected, when: per-item}\n  lanes: [[${id}]]\n` });
  assert.equal(plan.ok, true, plan.error);
}

test('a current hub review lands one squash commit in the root and territory, closes the item and topic, and removes its worktree and branch', async (t) => {
  const { root, ui, rev } = await project(t);
  const work = await task(root);
  const topic = await ui.request({ type: 'topic.create', title: 'Parser', item: work.id });
  assert.equal(topic.ok, true, topic.error);
  const before = git(root, 'rev-parse', 'dev');
  assert.equal((await rev.call<{ ok: boolean }>('task.comment', { id: work.id, verdict: 'review', result: 'clear', run: 'rev-1' })).ok, true);
  await eventually('ready without criteria', async () => {
    const v = json<{ item: { status: string; criteria: unknown[] } }>(await cland(root, 'task', 'view', work.id, '--json'));
    assert.deepEqual(v.item.criteria, []);
    return v.item.status === 'ready' ? true : undefined;
  });
  const merged = json<{ commit: string; base: string }>(await cland(root, 'merge', work.id, '--json'));
  assert.equal(merged.base, 'dev');
  assert.equal(git(root, 'rev-list', '--count', `${before}..dev`), '1');
  assert.equal(git(root, 'rev-parse', 'HEAD'), merged.commit);
  assert.equal(git(join(root, '.cland', 'territory.git'), 'rev-parse', 'dev'), merged.commit);
  assert.equal(await readFile(join(root, 'parser.txt'), 'utf8'), 'finished\n');
  assert.equal(git(root, 'show', '-s', '--format=%B', merged.commit), 'Ship the parser (T-1)\n\nItem: T-1\nReviewed-by: rev (rev-1)');
  const view = json<{ item: { state: string; claim: unknown; comments: Array<{ text: string }> } }>(await cland(root, 'task', 'view', work.id, '--json'));
  assert.equal(view.item.state, 'closed');
  assert.equal(view.item.claim, null);
  assert.ok(view.item.comments.at(-1)?.text.includes(merged.commit));
  assert.equal(existsSync(work.path), false);
  assert.equal(git(root, 'branch', '--list', work.branch), '');
  const history = await ui.request({ type: 'topic.history', topic: (topic.value as { topic: { id: string } }).topic.id });
  assert.equal((history.value as { topic: { status: string } }).topic.status, 'closed');
  const agents = await ui.request({ type: 'topic.history', topic: 'agents' });
  assert.ok((agents.value as { messages: Array<{ text: string }> }).messages.some((m) => m.text.includes(merged.commit)));
  assert.match(await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8'), /"event":"task-merged"/);
});

async function review(rev: Awaited<ReturnType<typeof spawnSpoke>>, id: string, result = 'clear', run = 'rev-1') {
  const r = await rev.call<{ ok: boolean; error?: string }>('task.comment', { id, verdict: 'review', result, run });
  assert.equal(r.ok, true, r.error);
}

async function refused(ui: Awaited<ReturnType<typeof connectUi>>, root: string, id: string, code: string, files?: string[]) {
  const refs = git(root, 'show-ref');
  const r = await ui.request({ type: 'merge', item: id }, 30_000);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal((r as { code?: string }).code, code, r.error);
  if (files) assert.deepEqual((r as { files?: string[] }).files, files);
  assert.equal(git(root, 'show-ref'), refs, 'a gate refusal moves no ref');
  return r;
}

test('an in-flight legacy item reaches ready and merge only after every criterion is done and verified', async (t) => {
  const { root, ui, rev } = await project(t);
  const work = await task(root);
  const impl = await spawnSpoke({ discover: true, cwd: root, name: 'impl', sessionId: 'impl-id', role: 'implementer' });
  t.after(() => impl.close());
  ok(await cland(root, 'task', 'claim', work.id, '--release'));
  ok(await cland(root, 'task', 'edit', work.id, '--assignee', 'impl'));
  const claimed = await impl.call<{ ok: boolean; error?: string }>('task.claim', { id: work.id });
  assert.equal(claimed.ok, true, claimed.error);
  const read = async () => json<{ item: { path: string; status: string; criteria: Array<{ id: string | null }>; verdicts: Array<{ current?: boolean }> } }>(await cland(root, 'task', 'view', work.id, '--json')).item;
  const file = join(root, (await read()).path);
  await writeFile(file, await readFile(file, 'utf8') + '\n## Acceptance criteria\n\n- [x] Parses input\n- [ ] Reports errors\n');
  await review(rev, work.id);
  await eventually('current legacy review', async () => (await read()).verdicts[0]?.current);
  const legacy = await refused(ui, root, work.id, 'criteria-incomplete');
  assert.match(legacy.error!, /Parses input.*not done.*not verified/s);
  assert.match(legacy.error!, /Reports errors.*not done.*not verified/s);
  assert.match(legacy.error!, /Implementer.*done.*--verified/s);
  assert.match(legacy.error!, /ids.*first/i);
  assert.notEqual((await read()).status, 'ready');

  const done = async (criterion: string) => {
    const result = await impl.call<{ ok: boolean; error?: string }>('task.criterion', { id: work.id, op: 'done', criterion });
    assert.equal(result.ok, true, result.error);
  };
  const verify = async (verified: string, run: string) => {
    ok(await clandWithEnv(root, { CLAND_SESSION_NAME: 'rev', CLAND_SESSION_ID: 'reviewer-id' }, 'task', 'comment', work.id, 'Checked', '--verdict', 'review', '--result', 'clear', '--run', run, '--verified', verified));
  };
  await done('C1');
  assert.deepEqual((await read()).criteria.map(c => c.id), ['C1', 'C2']);
  await verify('C2', 'rev-partial');
  const partial = await refused(ui, root, work.id, 'criteria-incomplete');
  assert.match(partial.error!, /C1.*Parses input.*not verified/);
  assert.match(partial.error!, /C2.*Reports errors.*not done/);
  assert.notEqual((await read()).status, 'ready');
  await done('C2');
  const unverified = await refused(ui, root, work.id, 'criteria-incomplete');
  assert.match(unverified.error!, /C1.*not verified/);
  assert.doesNotMatch(unverified.error!, /C2/);
  await verify('all', 'rev-all');
  await eventually('criteria ready', async () => (await read()).status === 'ready' ? true : undefined);
  const merged = json<{ commit: string }>(await cland(root, 'merge', work.id, '--json'));
  assert.equal(git(root, 'rev-parse', 'dev'), merged.commit);
  assert.equal((await read()).status, 'done');
});

test('adding or failing a criterion revokes ready; done and separate verification restore it', async (t) => {
  const { root, ui, rev } = await project(t);
  const work = await task(root);
  const read = async () => json<{ item: { status: string } }>(await cland(root, 'task', 'view', work.id, '--json')).item;
  const status = async (expected: string) => eventually(expected, async () => (await read()).status === expected ? true : undefined);
  await review(rev, work.id);
  await status('ready');
  ok(await cland(root, 'task', 'criterion', work.id, 'add', 'Handles empty input'));
  await status('in progress');
  const open = await refused(ui, root, work.id, 'criteria-incomplete');
  assert.match(open.error!, /C1.*Handles empty input.*not done.*not verified/);
  ok(await cland(root, 'task', 'criterion', work.id, 'done', 'C1'));
  await refused(ui, root, work.id, 'criteria-incomplete');
  const verified = await rev.call<{ ok: boolean; error?: string }>('task.criterion', { id: work.id, op: 'verify', criterion: 'C1', run: 'separate-verification' });
  assert.equal(verified.ok, true, verified.error);
  await status('ready');
  const failed = await rev.call<{ ok: boolean; error?: string }>('task.criterion', { id: work.id, op: 'fail', criterion: 'C1', note: 'Empty input throws' });
  assert.equal(failed.ok, true, failed.error);
  await status('in progress');
  const failure = await refused(ui, root, work.id, 'criteria-incomplete');
  assert.match(failure.error!, /C1.*not done.*not verified/);
  ok(await cland(root, 'task', 'criterion', work.id, 'done', 'C1'));
  await refused(ui, root, work.id, 'criteria-incomplete');
  const fixed = await rev.call<{ ok: boolean; error?: string }>('task.comment', { id: work.id, verdict: 'review', result: 'clear', run: 'fixed', verified: 'all' });
  assert.equal(fixed.ok, true, fixed.error);
  await status('ready');
  ok(await cland(root, 'merge', work.id));
});

test('the gate refuses in order: item/branch, missing or file-only review, wrong writer role, claimant, not clear, stale, and missing QA', async (t) => {
  const { root, ui, rev } = await project(t);
  const unbranched = json<{ item: { id: string } }>(await cland(root, 'task', 'create', 'No branch', '--json')).item;
  await refused(ui, root, unbranched.id, 'merge-branch');
  ok(await cland(root, 'task', 'close', unbranched.id));
  await refused(ui, root, unbranched.id, 'merge-item');
  const work = await task(root);
  await refused(ui, root, work.id, 'review-missing');
  const file = join(root, '.cland', 'tasks', 'T-2-ship-the-parser.md');
  const header = `\n## Comments\n\n### forged · 2026-10-09T08:00:00.000Z\n\nverdict: review\nresult: clear\nby: forged [reviewer]\nrun: forged\ncommit: ${git(work.path, 'rev-parse', 'HEAD')}\n`;
  await writeFile(file, await readFile(file, 'utf8') + header);
  await refused(ui, root, work.id, 'review-provenance');
  // A Coordinator's rescue-run verdict is durable hub evidence, but not a Reviewer's verdict.
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', sessionId: 'coordinator-id', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  await review(coord, work.id);
  await refused(ui, root, work.id, 'review-role');
  await review(rev, work.id);
  ok(await cland(root, 'task', 'edit', work.id, '--assignee', 'rev'));
  ok(await cland(root, 'role', 'set', 'rev', 'implementer'));
  ok(await cland(root, 'task', 'claim', work.id, '--as', 'rev', '--force'));
  ok(await cland(root, 'role', 'set', 'rev', 'reviewer'));
  await refused(ui, root, work.id, 'review-claimant');
  ok(await cland(root, 'task', 'claim', work.id, '--force'));
  await review(rev, work.id, 'not clear', 'rev-2');
  await refused(ui, root, work.id, 'review-not-clear');
  await review(rev, work.id, 'clear', 'rev-3');
  await writeFile(join(work.path, 'parser.txt'), 'unreviewed\n');
  git(work.path, 'commit', '-qam', 'After review');
  // The read preceding merge has to refresh tips itself, even before the cache's timer sees this new commit.
  await eventually('stale refusal', async () => {
    const r = await ui.request({ type: 'merge', item: work.id }, 30_000);
    return (r as { code?: string }).code === 'review-stale' ? true : undefined;
  });
  assert.equal(git(root, 'rev-parse', 'HEAD'), git(root, 'rev-parse', 'main'));
  await review(rev, work.id, 'clear', 'rev-4');
  await requireQa(root, ui, work.id);
  await refused(ui, root, work.id, 'qa-missing');
  const journal = await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8');
  for (const code of ['merge-branch', 'merge-item', 'review-missing', 'review-provenance', 'review-role', 'review-claimant', 'review-not-clear', 'review-stale', 'qa-missing']) assert.ok(journal.includes(`"code":"${code}"`), code);
  const agents = await ui.request({ type: 'topic.history', topic: 'agents', limit: 200 });
  assert.ok((agents.value as { messages: Array<{ text: string }> }).messages.some((m) => m.text.includes('review-claimant')));
});

test('conflicts name the files, touched local edits refuse, and unrelated edits survive a merge', async (t) => {
  const { root, ui, rev } = await project(t);
  const conflict = await task(root, 'Conflicting readme', 'README.md');
  await review(rev, conflict.id);
  await writeFile(join(root, 'README.md'), 'on dev\n');
  git(root, 'commit', '-qam', 'Dev readme');
  ok(await cland(root, 'push'));
  await refused(ui, root, conflict.id, 'merge-conflict', ['README.md']);
  const work = await task(root, 'New parser');
  await review(rev, work.id);
  await writeFile(join(root, 'parser.txt'), 'local untracked\n');
  await refused(ui, root, work.id, 'merge-dirty', ['parser.txt']);
  const { rm } = await import('node:fs/promises');
  await rm(join(root, 'parser.txt'));
  await writeFile(join(root, 'README.md'), 'local readme\n');
  // A staged unrelated change also survives: the gate doesn't require the whole root to be clean.
  git(root, 'add', 'README.md');
  const merged = json<{ commit: string }>(await cland(root, 'merge', work.id, '--json'));
  assert.equal(git(root, 'rev-parse', 'dev'), merged.commit);
  assert.equal(await readFile(join(root, 'README.md'), 'utf8'), 'local readme\n');
  assert.equal(git(root, 'diff', '--cached', '--name-only'), 'README.md');
});

test('Per-item plan QA uses the latest clear current QA evidence and includes its session and run; role moves preserve verdict provenance', async (t) => {
  const { root, ui, rev } = await project(t);
  const work = await task(root);
  await requireQa(root, ui, work.id);
  const qa = await spawnSpoke({ discover: true, cwd: root, name: 'qa-1', sessionId: 'qa-id', role: 'qa' });
  t.after(() => qa.close());
  await qa.waitForPresence(['qa-1', 'rev']);
  // QA cannot record a review header through either surface, regardless of the text's by: line.
  const wrong = await qa.call<{ ok: boolean; code: string }>('task.comment', { id: work.id, verdict: 'review', result: 'clear', run: 'wrong-role' });
  assert.equal(wrong.code, 'forbidden');
  await review(rev, work.id);
  const qaVerdict = async (result: string, run: string) => {
    const r = await qa.call<{ ok: boolean; error?: string }>('task.comment', { id: work.id, verdict: 'qa', result, run });
    assert.equal(r.ok, true, r.error);
  };
  await qaVerdict('not clear', 'qa-1');
  await refused(ui, root, work.id, 'qa-not-clear');
  await qaVerdict('clear', 'qa-2');
  await writeFile(join(work.path, 'parser.txt'), 'qa has not seen this\n');
  git(work.path, 'commit', '-qam', 'More work');
  await review(rev, work.id, 'clear', 'rev-2');
  await eventually('QA stale', async () => {
    const r = await ui.request({ type: 'merge', item: work.id }, 30_000);
    return (r as { code?: string }).code === 'qa-stale' ? true : undefined;
  });
  await qaVerdict('clear', 'qa-3');
  ok(await cland(root, 'role', 'set', 'rev', 'implementer'));
  ok(await cland(root, 'role', 'set', 'qa-1', 'implementer'));
  const r = json<{ commit: string }>(await cland(root, 'merge', work.id, '--json'));
  assert.match(git(root, 'show', '-s', '--format=%B', r.commit), /Reviewed-by: rev \(rev-2\)\nQA-by: qa-1 \(qa-3\)$/);
});

test('the permission table refuses Implementer, Reviewer and QA on spoke and CLI; only the human shell overrides verdicts', async (t) => {
  const { root, ui, rev } = await project(t);
  const work = await task(root);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', sessionId: 'coord-id', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord', 'rev']);
  for (const role of ['implementer', 'reviewer', 'qa']) {
    ok(await cland(root, 'role', 'set', 'rev', role));
    const refusedSpoke = await rev.call<{ ok: boolean; code: string; permission: string }>('merge', { item: work.id });
    assert.deepEqual([refusedSpoke.ok, refusedSpoke.code, refusedSpoke.permission], [false, 'forbidden', 'merge']);
    const refusedCli = await clandWithEnv(root, { CLAND_SESSION_NAME: 'rev', CLAND_SESSION_ID: 'reviewer-id' }, 'merge', work.id);
    assert.equal(refusedCli.code, 1);
    assert.match(refusedCli.stderr, /forbidden: merge/);
  }
  const asCoord = { CLAND_SESSION_NAME: 'coord', CLAND_SESSION_ID: 'coord-id' };
  const rejected = await clandWithEnv(root, asCoord, 'merge', work.id, '--override', 'rescue');
  assert.equal(rejected.code, 1);
  assert.match(rejected.stderr, /only the human may override/);
  const invalid = await cland(root, 'merge', work.id, '--override', '  ');
  assert.equal(invalid.code, 1);
  assert.match(invalid.stderr, /override needs a reason/);
  ok(await cland(root, 'task', 'criterion', work.id, 'add', 'Works offline'));
  await refused(ui, root, work.id, 'criteria-incomplete');
  const overridden = json<{ commit: string }>(await cland(root, 'merge', work.id, '--override', 'Human checked rescue output', '--json'));
  const item = json<{ item: { comments: Array<{ text: string }> } }>(await cland(root, 'task', 'view', work.id, '--json')).item;
  assert.match(item.comments.at(-1)?.text ?? '', /Human override: Human checked rescue output/);
  assert.equal(git(root, 'show', '-s', '--format=%B', overridden.commit), 'Ship the parser (T-1)\n\nItem: T-1');
  const agents = await ui.request({ type: 'topic.history', topic: 'agents', limit: 200 });
  assert.equal((agents.value as { messages: Array<{ kind: string; text: string }> }).messages.filter((m) => m.kind === 'refusal' && /tried merge/.test(m.text)).length, 7);
  const journal = await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8');
  assert.match(journal, /"override":"Human checked rescue output"/);
  const skipped = journal.split('\n').filter(Boolean).map(line => JSON.parse(line) as { event: string; id?: string; criteria?: string[]; override?: string }).filter(event => event.event === 'merge-criteria-overridden');
  assert.ok(skipped.length > 0);
  assert.ok(skipped.every(event => event.id === work.id && event.override === 'Human checked rescue output'));
  assert.deepEqual(skipped[0]!.criteria, ['C1: Works offline (not done, not verified)']);
});

test('simultaneous Coordinator spoke merges serialize and the second commit includes the first task', async (t) => {
  const { root, rev } = await project(t);
  const one = await task(root, 'First task', 'one.txt');
  const two = await task(root, 'Second task', 'two.txt');
  await review(rev, one.id);
  await review(rev, two.id);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', sessionId: 'coord-id', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord', 'rev']);
  const before = git(root, 'rev-parse', 'dev');
  const results = await Promise.all([one, two].map((w) => coord.call<{ ok: boolean; commit: string; error?: string }>('merge', { item: w.id })));
  for (const r of results) assert.equal(r.ok, true, r.error);
  assert.equal(git(root, 'rev-list', '--count', `${before}..dev`), '2');
  const first = results[0]!.commit;
  const second = results[1]!.commit;
  assert.equal(git(root, 'rev-parse', `${second}^`), first);
  assert.equal(git(root, 'rev-parse', `${first}^`), before);
  assert.equal(git(root, 'rev-parse', 'dev'), second);
  assert.equal(git(join(root, '.cland', 'territory.git'), 'rev-parse', 'dev'), second);
  assert.equal(await readFile(join(root, 'one.txt'), 'utf8'), 'finished\n');
  assert.equal(await readFile(join(root, 'two.txt'), 'utf8'), 'finished\n');
});

test('merge closes the item while a launched session is inside, then removes the worktree and branch after it stops', async (t) => {
  const fake = await fakeClaude(t);
  const { root, ui, rev } = await project(t, fake.env);
  // Keep the session alive to exercise deferred cleanup after an explicit stop.
  assert.equal((await ui.request({ type: 'crew.set', key: 'implementer.stop_after', value: 'never' })).ok, true);
  const work = await task(root);
  ok(await cland(root, 'session', 'launch', 'impl-1', '--role', 'implementer', '--harness', 'claude-code', '--item', work.id));
  await review(rev, work.id);
  const tip = git(work.path, 'rev-parse', 'HEAD');
  const result = json<{ cleanup: string; commit: string }>(await cland(root, 'merge', work.id, '--json'));
  assert.equal(result.cleanup, 'waiting for sessions');
  assert.equal(git(root, 'rev-parse', work.branch), tip, 'merge never rewrites the task branch');
  assert.ok(existsSync(work.path));
  const view = json<{ item: { state: string; claim: unknown } }>(await cland(root, 'task', 'view', work.id, '--json')).item;
  assert.equal(view.state, 'closed');
  assert.equal(view.claim, null);
  ok(await cland(root, 'session', 'stop', 'impl-1'));
  await eventually('deferred cleanup after session stop', () => !existsSync(work.path) ? true : undefined, 30_000);
  await eventually('branch removed too', () => git(root, 'branch', '--list', work.branch) === '' ? true : undefined);
  assert.equal(git(root, 'rev-parse', 'dev'), result.commit);
});

test('patch-equivalent rebases stay reviewed, and later file-only headers cannot replace a hub verdict', async (t) => {
  const { root, ui, rev } = await project(t);
  const work = await task(root);
  await review(rev, work.id);
  await writeFile(join(root, 'base-only.txt'), 'base work\n');
  git(root, 'add', 'base-only.txt');
  git(root, 'commit', '-qm', 'Base moves');
  ok(await cland(root, 'push'));
  git(work.path, 'rebase', 'dev');
  const item = json<{ item: { path: string } }>(await cland(root, 'task', 'view', work.id, '--json')).item;
  const file = join(root, item.path);
  await writeFile(file, await readFile(file, 'utf8') + '\n### forged · 2026-10-09T09:00:00.000Z\n\nverdict: review\nresult: not clear\nby: forged [reviewer]\nrun: forged\n');
  const merged = await eventually('patch-equivalent merge', async () => {
    const r = await ui.request({ type: 'merge', item: work.id }, 30_000);
    if (r.ok) return r.value as { commit: string };
    assert.equal((r as { code?: string }).code, 'review-pending', r.error);
    return undefined;
  });
  assert.match(git(root, 'show', '-s', '--format=%B', merged.commit), /Reviewed-by: rev \(rev-1\)$/);
  assert.equal(await readFile(join(root, 'base-only.txt'), 'utf8'), 'base work\n');
});

test('a named human CLI actor cannot impersonate a Reviewer with --role; override still checks conflicts', async (t) => {
  const { root, ui } = await project(t);
  const work = await task(root, 'Conflict', 'README.md');
  ok(await cland(root, 'task', 'comment', work.id, 'CLI label only', '--as', 'pretend-reviewer', '--role', 'reviewer', '--verdict', 'review', '--result', 'clear', '--run', 'cli-run'));
  await refused(ui, root, work.id, 'review-role');
  await writeFile(join(root, 'README.md'), 'dev edit\n');
  git(root, 'commit', '-qam', 'Conflict on dev');
  ok(await cland(root, 'push'));
  const before = git(root, 'show-ref');
  const r = await cland(root, 'merge', work.id, '--override', 'Human checked');
  assert.equal(r.code, 1);
  assert.match(r.stderr, /merge-conflict.*README.md/);
  assert.equal(git(root, 'show-ref'), before);
});

test('the configured task base is the merge target and a root on a different branch refuses before landing', async (t) => {
  const { root, ui, rev } = await project(t);
  git(join(root, '.cland', 'territory.git'), 'config', 'cland.taskBase', 'main');
  const work = await task(root);
  await review(rev, work.id);
  await refused(ui, root, work.id, 'merge-checkout');
  git(root, 'switch', 'main');
  const dev = git(root, 'rev-parse', 'dev');
  const merged = json<{ commit: string; base: string }>(await cland(root, 'merge', work.id, '--json'));
  assert.equal(merged.base, 'main');
  assert.equal(git(root, 'rev-parse', 'HEAD'), merged.commit);
  assert.equal(git(join(root, '.cland', 'territory.git'), 'rev-parse', 'main'), merged.commit);
  assert.equal(git(root, 'rev-parse', 'dev'), dev);
});

test('merge measures a synchronous close subscriber after awaited Git as one resumed stretch', async (t) => {
  const clock = { now: 0 };
  const { tracker, ui, rev, records, work } = await observableProject(t, undefined, clock);
  await review(rev, work.id);
  let measured = false;
  tracker.onChange(change => {
    if (!measured && change.id === work.id && change.item?.state === 'closed') {
      measured = true;
      clock.now += 400;
    }
  });
  records.length = 0;
  const response = await ui.request({ type: 'merge', item: work.id }, 30_000);
  assert.equal(response.ok, true, response.error);
  assert.equal(measured, true, 'the real close event reached its synchronous subscriber');
  const close = records.filter(r => r.event === 'slow-request' && r.tool === 'merge');
  assert.deepEqual(close.map(r => [r.phase, r.ms]), [['resumed', 400]]);
});

test('freshness uses configured main after an unchanged task is rebased while dev lags', async (t) => {
  const { root, ui, rev } = await project(t);
  git(join(root, '.cland', 'territory.git'), 'config', 'cland.taskBase', 'main');
  git(root, 'switch', 'main');
  const work = await task(root);
  await review(rev, work.id);
  await writeFile(join(root, 'base-only.txt'), 'main work\n');
  git(root, 'add', 'base-only.txt');
  git(root, 'commit', '-qm', 'Main moves while dev lags');
  git(work.path, 'rebase', 'main');
  const merged = await eventually('main-based unchanged patch', async () => {
    const r = await ui.request({ type: 'merge', item: work.id }, 30_000);
    if (r.ok) return r.value as { base: string };
    assert.equal((r as { code?: string }).code, 'review-pending', r.error);
    return undefined;
  });
  assert.equal(merged.base, 'main');
});

test('a failed integration ref update restores the root index and worktree and preserves unrelated staged changes', async (t) => {
  const { root, rev } = await project(t);
  const work = await task(root);
  await review(rev, work.id);
  await writeFile(join(root, 'README.md'), 'local staged work\n');
  git(root, 'add', 'README.md');
  const beforeRefs = git(root, 'show-ref');
  const beforeStatus = git(root, 'status', '--porcelain');
  const beforeIndex = git(root, 'write-tree');
  await writeFile(join(root, '.git', 'refs', 'heads', 'dev.lock'), 'held\n');
  const r = await cland(root, 'merge', work.id);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /dev.lock/);
  assert.equal(git(root, 'show-ref'), beforeRefs);
  assert.equal(git(root, 'status', '--porcelain'), beforeStatus);
  assert.equal(git(root, 'write-tree'), beforeIndex);
  assert.equal(existsSync(join(root, 'parser.txt')), false);
  assert.equal(json<{ item: { state: string } }>(await cland(root, 'task', 'view', work.id, '--json')).item.state, 'open');
  await rm(join(root, '.git', 'refs', 'heads', 'dev.lock'));
  await writeFile(join(root, 'README.md'), 'later unrelated staged work\n');
  git(root, 'add', 'README.md');
  const retry = json<{ followUp?: unknown }>(await cland(root, 'merge', work.id, '--json'));
  assert.equal(retry.followUp, undefined);
  assert.equal(await readFile(join(root, 'README.md'), 'utf8'), 'later unrelated staged work\n');
});

async function indexLockProject(t: TestContext, failure: 'transient-lock' | 'persistent-lock' | 'crash-before-ref' = 'transient-lock') {
  const bin = await tempProject(t, 'cland-index-lock-bin-');
  const realGit = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
  await writeFile(join(bin, 'git'), `#!${process.execPath}\nimport { spawnSync } from 'node:child_process';\nimport { existsSync, writeFileSync, rmSync } from 'node:fs';\nconst args = process.argv.slice(2);\nconst marker = '.cland/checkout-mutated';\nconst failed = '.cland/write-tree-failed';\nif (process.env.CLAND_TEST_KILL_BEFORE_REF === '1' && args[0] === 'update-ref' && args[1] === 'refs/heads/dev') { writeFileSync('.cland/before-ref-crash', 'crashed'); process.kill(process.ppid, 'SIGKILL'); process.exit(1); }\nconst fail = process.env.CLAND_TEST_KILL_BEFORE_REF !== '1' && args[0] === 'write-tree' && existsSync(marker) && !existsSync(failed);\nif (fail) { writeFileSync('.git/index.lock', 'held'); writeFileSync(failed, 'failed'); }\nconst result = spawnSync(${JSON.stringify(realGit)}, args, { stdio: 'inherit' });\nif (args[0] === 'read-tree' && args[1] === '-m' && result.status === 0) writeFileSync(marker, 'changed');\nif (fail && process.env.CLAND_TEST_KEEP_INDEX_LOCK !== '1') rmSync('.git/index.lock');\nprocess.exit(result.status ?? 1);\n`, { mode: 0o755 });
  return project(t, { PATH: `${bin}:${process.env.PATH ?? ''}`, CLAND_TEST_KEEP_INDEX_LOCK: failure === 'persistent-lock' ? '1' : '0', CLAND_TEST_KILL_BEFORE_REF: failure === 'crash-before-ref' ? '1' : '0' });
}

test('an index lock during post-checkout write-tree restores the staged tree, file bytes and status before refusing', async (t) => {
  for (const file of ['parser.txt', 'README.md']) await t.test(file, async (t) => {
    const { root, rev } = await indexLockProject(t);
    const work = await task(root, 'Ship changes', file);
    await review(rev, work.id);
    await writeFile(join(root, 'local.txt'), 'unrelated staged bytes\n');
    git(root, 'add', 'local.txt');
    const refs = git(root, 'show-ref');
    const indexTree = git(root, 'write-tree');
    const status = git(root, 'status', '--porcelain');
    const readme = await readFile(join(root, 'README.md'));
    const local = await readFile(join(root, 'local.txt'));
    const result = await cland(root, 'merge', work.id);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /index.lock/);
    assert.ok(existsSync(join(root, '.cland', 'write-tree-failed')), 'real Git write-tree must run with the lock held');
    assert.equal(git(root, 'show-ref'), refs);
    assert.equal(git(root, 'write-tree'), indexTree);
    assert.equal(git(root, 'status', '--porcelain'), status);
    assert.deepEqual(await readFile(join(root, 'README.md')), readme);
    assert.deepEqual(await readFile(join(root, 'local.txt')), local);
    if (file === 'parser.txt') assert.equal(existsSync(join(root, file)), false);
  });
});

test('a blocked prelanding restore reports its durable recovery receipt and repairs before a later merge', async (t) => {
  const { root, ui, rev, discovery } = await indexLockProject(t, 'persistent-lock');
  const work = await task(root);
  await review(rev, work.id);
  await writeFile(join(root, 'README.md'), 'unrelated staged bytes\n');
  git(root, 'add', 'README.md');
  const before = git(root, 'rev-parse', 'dev');
  const result = await ui.request({ type: 'merge', item: work.id }, 30_000);
  assert.equal(result.ok, false);
  const failed = result as { code?: string; recovery?: { commit: string; base: string }; error?: string };
  assert.equal(failed.code, 'merge-recovery', failed.error);
  assert.equal(failed.recovery?.base, 'dev');
  assert.match(failed.error ?? '', /checkout recovery pending/);
  assert.equal(git(root, 'rev-parse', 'dev'), before);
  assert.equal(git(join(root, '.cland', 'territory.git'), 'rev-parse', 'dev'), before);
  assert.equal(await readFile(join(root, 'parser.txt'), 'utf8'), 'finished\n');
  const db = new DatabaseSync(join(root, '.cland', 'hub.db'));
  const receipt = db.prepare('select commit_sha, checkout_recovery from tracker_merges where item_id = ?').get(work.id);
  db.close();
  assert.equal(receipt?.commit_sha, failed.recovery?.commit);
  assert.ok(receipt?.checkout_recovery);
  const journal = await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8');
  assert.match(journal, /"event":"merge-recovery-pending"/);
  assert.doesNotMatch(journal, /"event":"merge-refused"/);
  await rm(join(root, '.git', 'index.lock'));
  await killDaemon(discovery.pid);
  await startDaemon(t, root);
  const retry = json<{ commit: string; followUp?: unknown }>(await cland(root, 'merge', work.id, '--json'));
  assert.equal(retry.followUp, undefined);
  assert.equal(git(root, 'rev-list', '--count', `${before}..dev`), '1');
  assert.equal(git(join(root, '.cland', 'territory.git'), 'rev-parse', 'dev'), retry.commit);
  assert.equal(await readFile(join(root, 'README.md'), 'utf8'), 'unrelated staged bytes\n');
  assert.equal(await readFile(join(root, 'parser.txt'), 'utf8'), 'finished\n');
  assert.equal(json<{ item: { state: string } }>(await cland(root, 'task', 'view', work.id, '--json')).item.state, 'closed');
});

test('a crash before the integration ref moves retains checkout recovery and can merge after restart', async (t) => {
  const { root, rev, discovery } = await indexLockProject(t, 'crash-before-ref');
  const work = await task(root);
  await review(rev, work.id);
  const before = git(root, 'rev-parse', 'dev');
  const interrupted = await cland(root, 'merge', work.id);
  assert.notEqual(interrupted.code, 0);
  await killDaemon(discovery.pid);
  assert.ok(existsSync(join(root, '.cland', 'before-ref-crash')));
  assert.equal(git(root, 'rev-parse', 'dev'), before);
  assert.equal(git(join(root, '.cland', 'territory.git'), 'rev-parse', 'dev'), before);
  assert.equal(await readFile(join(root, 'parser.txt'), 'utf8'), 'finished\n');
  const db = new DatabaseSync(join(root, '.cland', 'hub.db'));
  const receipt = db.prepare('select checkout_recovery from tracker_merges where item_id = ?').get(work.id);
  db.close();
  assert.ok(receipt?.checkout_recovery, 'unlanded mutation must retain its durable checkout snapshot');
  await startDaemon(t, root);
  const retry = json<{ commit: string; followUp?: unknown }>(await cland(root, 'merge', work.id, '--json'));
  assert.equal(retry.followUp, undefined);
  assert.equal(git(root, 'rev-list', '--count', `${before}..dev`), '1');
  assert.equal(git(join(root, '.cland', 'territory.git'), 'rev-parse', 'dev'), retry.commit);
});

test('a root switched during real merge-tree preparation is refused without changing the checkout or refs', async (t) => {
  const { root, ui, rev } = await project(t);
  await writeFile(join(root, '.gitattributes'), 'driver.txt merge=cland-test\n');
  await writeFile(join(root, 'driver.txt'), 'initial\n');
  git(root, 'add', '.gitattributes', 'driver.txt');
  git(root, 'commit', '-qm', 'A merge driver');
  const work = await task(root, 'Driver task', 'driver.txt');
  await review(rev, work.id);
  await writeFile(join(root, 'driver.txt'), 'on dev\n');
  git(root, 'commit', '-qam', 'Dev changes the same file');
  ok(await cland(root, 'push'));
  git(root, 'branch', 'other');
  const { mkdir } = await import('node:fs/promises');
  const dir = join(root, '.cland', 'scratch');
  await mkdir(dir, { recursive: true });
  const marker = join(dir, 'merging');
  const release = join(dir, 'continue');
  const driver = join(dir, 'merge-driver.mjs');
  await writeFile(driver, `import { existsSync, writeFileSync } from 'node:fs';\nimport { setTimeout } from 'node:timers/promises';\nwriteFileSync(${JSON.stringify(marker)}, 'ready');\nconst deadline = Date.now() + 20000;\nwhile (!existsSync(${JSON.stringify(release)}) && Date.now() < deadline) await setTimeout(10);\nwriteFileSync(process.argv[2], 'combined\\n');\n`);
  git(root, 'config', 'merge.cland-test.driver', `"${process.execPath}" "${driver}" %A`);
  const refs = git(root, 'show-ref');
  const merging = ui.request({ type: 'merge', item: work.id }, 30_000);
  await eventually('real Git merge driver running', () => existsSync(marker) ? true : undefined);
  git(root, 'switch', 'other');
  const index = git(root, 'write-tree');
  await writeFile(release, 'go');
  const r = await merging;
  assert.equal(r.ok, false);
  assert.equal((r as { code?: string }).code, 'merge-checkout', r.error);
  assert.equal(git(root, 'show-ref'), refs);
  assert.equal(git(root, 'branch', '--show-current'), 'other');
  assert.equal(git(root, 'write-tree'), index);
  assert.equal(await readFile(join(root, 'driver.txt'), 'utf8'), 'on dev\n');
});


test('deleting any durable hub verdict refuses with the missing run and commit, without reviving an older clear', async (t) => {
  const { root, ui, rev } = await project(t);
  const work = await task(root);
  await review(rev, work.id, 'clear', 'older-clear');
  const older = json<{ item: { path: string } }>(await cland(root, 'task', 'view', work.id, '--json')).item;
  const file = join(root, older.path);
  const clearText = await readFile(file, 'utf8');
  await review(rev, work.id, 'not clear', 'deleted-not-clear');
  const tip = git(work.path, 'rev-parse', 'HEAD');
  const intact = parseItem(await readFile(file, 'utf8'), 'T-1-ship-the-parser.md');
  intact.comments.reverse();
  await writeFile(file, serializeItem(intact));
  await refused(ui, root, work.id, 'review-not-clear');
  await writeFile(file, clearText);
  const r = await refused(ui, root, work.id, 'verdict-missing');
  assert.match(r.error ?? '', /deleted-not-clear/);
  assert.ok(r.error?.includes(tip));
  // Even an older missing record blocks: durable history must remain present in the file.
  await review(rev, work.id, 'clear', 'new-clear');
  await refused(ui, root, work.id, 'verdict-missing');
});

test('a close write failure reports merged follow-up failure; retry closes and prunes without a second commit', async (t) => {
  const { root, ui, rev, discovery } = await project(t);
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
  await killDaemon(discovery.pid);
  const restarted = await startDaemon(t, root);
  const retryUi = await connectUi(t, restarted.discovery);
  const retry = json<{ commit: string; followUp?: unknown }>(await cland(root, 'merge', work.id, '--json'));
  assert.equal(retry.commit, first.commit);
  assert.equal(retry.followUp, undefined);
  assert.equal(git(root, 'rev-list', '--count', `${before}..dev`), '1');
  const closed = json<{ item: { state: string; claim: unknown; comments: Array<{ text: string }> } }>(await cland(root, 'task', 'view', work.id, '--json')).item;
  assert.equal(closed.state, 'closed');
  assert.equal(closed.claim, null);
  assert.equal(closed.comments.filter(c => c.text.includes(`Merged ${first.commit}`)).length, 1);
  assert.equal(existsSync(work.path), false);
  const history = await retryUi.request({ type: 'topic.history', topic: (topic.value as { topic: { id: string } }).topic.id });
  assert.equal((history.value as { topic: { status: string } }).topic.status, 'closed');
  const again = json<{ commit: string; cleanup: string; followUp?: unknown }>(await cland(root, 'merge', 't-01', '--json'));
  assert.equal(again.commit, first.commit);
  assert.equal(again.cleanup, 'removed');
  assert.equal(again.followUp, undefined);
  const journal = await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8');
  assert.match(journal, /"event":"merge-follow-up-failed"/);
  assert.doesNotMatch(journal, /"event":"merge-refused"/);
});

/** Real Git and a real network hub; the injected runner only pauses real reads, never replaces their answers. */
async function observableProject(t: TestContext, run?: (real: Git) => Git, clock?: { now: number }, sink?: (entry: Record<string, unknown>) => void) {
  const root = await tempProject(t, 'cland-merge-observe-');
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.name', 'Test');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'commit.gpgsign', 'false');
  await writeFile(join(root, 'README.md'), 'project\n');
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'Initial');
  ok(await cland(root, 'init'));
  const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db'), git: run?.(gitIn(root)) ?? gitIn(root) });
  const records: Array<Record<string, unknown>> = [];
  const hub = await startHub({ tracker, store: new Store(join(root, '.cland', 'hub.db')), roles: fixedRoles(), log: r => { sink?.(r); records.push(r); }, ...(clock ? { guard: { now: () => clock.now } } : {}) });
  t.after(async () => { await hub.close(); await tracker.stop(); });
  const ui = await connectWsUi(t, hub);
  const human = { id: 'human', name: 'human', role: null };
  const id = (await tracker.create(human, { title: 'Observed parser' })).id;
  await tracker.claim(human, id);
  // The claim frame uses the same real worktree path as the daemon seam.
  const claimed = await ui.request({ type: 'task.claim', item: id });
  assert.equal(claimed.ok, true, claimed.error);
  const worktree = (claimed.value as { worktree: { path: string; branch: string } }).worktree;
  await writeFile(join(worktree.path, 'parser.txt'), 'parser\n');
  git(worktree.path, 'add', 'parser.txt');
  git(worktree.path, 'commit', '-qm', 'Parser');
  assert.equal((await ui.request({ type: 'role.set', session: 'rev', role: 'reviewer' })).ok, true);
  const rev = await spawnSpoke({ hub, cwd: root, name: 'rev', sessionId: 'observed-rev', role: 'reviewer' });
  t.after(() => rev.close());
  await rev.waitForPresence(['rev']);
  return { root, tracker, hub, ui, rev, records, work: { id, ...worktree } };
}

test('foreground merge freshness fan-out after Git is measured as a resumed 400 ms stretch', async (t) => {
  const clock = { now: 0 };
  const { root, tracker, ui, rev, records, work } = await observableProject(t, undefined, clock);
  await review(rev, work.id);
  const created = await ui.request({ type: 'task.create', title: 'A branch that will appear', branch: 't/later' });
  assert.equal(created.ok, true, created.error);
  const id = (created.value as { item: { id: string } }).item.id;
  const tip = git(work.path, 'rev-parse', 'HEAD');
  assert.equal((await rev.call<{ ok: boolean }>('task.comment', { id, verdict: 'review', result: 'clear', run: 'later', commit: tip })).ok, true);
  await eventually('missing branch settled stale', async () => {
    await tracker.refreshFreshness();
    return tracker.view(id).verdicts[0]?.current === false ? true : undefined;
  });
  // Drain the last write's background poke; creating a Git branch schedules no tracker work.
  await sleep(100);
  await tracker.refreshFreshness();
  git(root, 'branch', 't/later', tip);
  // A real task-event subscriber is a public boundary; only the guard clock is synthetic.
  tracker.onChange(change => { if (change.id === id) clock.now += 400; });
  const response = await ui.request({ type: 'merge', item: work.id }, 30_000);
  assert.equal(response.ok, true, response.error);
  assert.ok(records.some(r => r.event === 'slow-request' && r.tool === 'merge' && r.phase === 'resumed' && Number(r.ms) >= 400), JSON.stringify(records));
});

test('a verdict whose session changes role while Git resolves uses the role and permissions at its write', async (t) => {
  for (const role of ['implementer', 'coordinator']) await t.test(role, async t => {
    const reached = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    let paused = false;
    const { root, tracker, ui, rev, work } = await observableProject(t, real => async (args, input) => {
      if (paused && args[0] === 'rev-parse') { reached.resolve(); await release.promise; }
      return real(args, input);
    });
    paused = true;
    const writing = rev.call<{ ok: boolean; code?: string; error?: string }>('task.comment', { id: work.id, verdict: 'review', result: 'clear', run: 'role-await' });
    await reached.promise;
    assert.equal((await ui.request({ type: 'role.set', session: 'rev', role })).ok, true);
    release.resolve();
    const result = await writing;
    if (role === 'implementer') {
      assert.equal(result.ok, false, JSON.stringify(result));
      assert.equal(result.code, 'forbidden');
      await refused(ui, root, work.id, 'review-missing');
    } else {
      assert.equal(result.ok, true, result.error);
      const verdict = tracker.view(work.id).verdicts[0];
      assert.equal(verdict?.writer?.role, 'coordinator');
      assert.equal(verdict?.by, 'rev [coordinator]');
      await refused(ui, root, work.id, 'review-role');
    }
  });
});

test('release, topic closure and cleanup failures remain merged and retry the remaining steps', async (t) => {
  for (const step of ['release', 'topic close', 'cleanup', 'branch cleanup']) {
    await t.test(step, async t => {
      const { root, tracker, ui, rev, work } = await observableProject(t);
      await review(rev, work.id);
      const before = git(root, 'rev-parse', 'dev');
      const topic = await ui.request({ type: 'topic.create', title: 'Follow-ups', item: work.id });
      assert.equal(topic.ok, true, topic.error);
      let repair: () => void | Promise<void> = () => {};
      if (step === 'release') {
        const db = new DatabaseSync(join(root, '.cland', 'hub.db'));
        t.after(() => db.close());
        db.exec("create trigger fail_release before delete on tracker_claims begin select raise(abort, 'release failure'); end");
        repair = () => db.exec('drop trigger fail_release');
      } else if (step === 'topic close') {
        const db = new DatabaseSync(join(root, '.cland', 'hub.db'));
        t.after(() => db.close());
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
      assert.equal(existsSync(work.path), false);
      assert.equal(git(root, 'branch', '--list', work.branch), '');
      const history = await ui.request({ type: 'topic.history', topic: (topic.value as { topic: { id: string } }).topic.id });
      assert.equal((history.value as { topic: { status: string } }).topic.status, 'closed');
    });
  }
});


test('restart after local ref movement but before territory push republishes the prepared commit without another squash', async (t) => {
  const { root, rev, discovery } = await project(t);
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
  const retried = json<{ commit: string; followUp?: unknown }>(await cland(root, 'merge', work.id, '--json'));
  assert.equal(retried.commit, local);
  assert.equal(retried.followUp, undefined);
  assert.equal(git(root, 'rev-list', '--count', `${before}..dev`), '1');
  assert.equal(git(join(root, '.cland', 'territory.git'), 'rev-parse', 'dev'), local);
  assert.equal(existsSync(work.path), false);
});

test('a failed external log sink still returns the landed commit and retries only follow-ups', async (t) => {
  let failing = true;
  const { root, ui, rev, work } = await observableProject(t, undefined, undefined, entry => {
    if (failing && ['task-merged', 'merge-follow-up-failed'].includes(String(entry.event))) throw new Error('record sink unavailable');
  });
  await review(rev, work.id);
  const before = git(root, 'rev-parse', 'dev');
  const first = await ui.request({ type: 'merge', item: work.id }, 30_000);
  assert.equal(first.ok, true, first.error);
  const result = first.value as { commit: string; followUp?: { step: string } };
  assert.equal(result.followUp?.step, 'record');
  assert.equal(git(root, 'rev-parse', 'dev'), result.commit);
  failing = false;
  const retry = await ui.request({ type: 'merge', item: work.id }, 30_000);
  assert.equal(retry.ok, true, retry.error);
  assert.equal((retry.value as { commit: string }).commit, result.commit);
  assert.equal(git(root, 'rev-list', '--count', `${before}..dev`), '1');
});

test('deferred cleanup preserves a worktree switched onto an unrelated branch and can finish once restored', async (t) => {
  const fake = await fakeClaude(t);
  const { root, ui, rev } = await project(t, fake.env);
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
  assert.equal(existsSync(work.path), false);
  assert.notEqual(git(root, 'branch', '--list', 'keep-this-branch'), '');
});


test('deferred cleanup keeps the task branch and worktree if its tip moved after landing', async (t) => {
  const fake = await fakeClaude(t);
  const { root, ui, rev } = await project(t, fake.env);
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
  const { root, rev, discovery } = await project(t);
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
  const journal = await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8');
  assert.doesNotMatch(journal, /"event":"merge-refused"/);
  await rm(hook);
  await rm(join(root, '.git', 'refs', 'heads', 'dev.lock'));
  await killDaemon(discovery.pid);
  await startDaemon(t, root);
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
