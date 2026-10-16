import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, connectUi, projectHub, startDaemon, tempProject, type CliResult } from './harness.ts';
import { preparedReleaseProject } from './prepared-project.ts';
import type { ReleaseResult } from '../src/release.ts';

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const ok = (r: CliResult) => { assert.equal(r.code, 0, r.stderr || r.stdout); return r; };
const json = <T>(r: CliResult): T => JSON.parse(ok(r).stdout) as T;

async function project(t: TestContext, serve: typeof projectHub | typeof startDaemon = projectHub) {
  const { root, github } = await preparedReleaseProject(t, 'cland-release-item-');
  const { discovery } = await serve(t, root);
  const ui = await connectUi(t, discovery);
  const territory = join(root, '.cland', 'territory.git');
  return { root, github, territory, ui };
}

async function create(root: string, title: string, ...args: string[]) {
  return json<{ item: { id: string; path: string } }>(await cland(root, 'task', 'create', title, ...args, '--json')).item;
}

const refs = (...repos: string[]) => repos.map(repo => git(repo, 'show-ref')).join('\n');

test('release from an item refuses a missing version through the protocol and CLI without changing refs or the item', async t => {
  const { root, github, territory, ui } = await project(t);
  const item = await create(root, 'Next release', '--kind', 'release');
  const beforeRefs = refs(root, territory, github);
  const beforeItem = await readFile(join(root, item.path), 'utf8');
  const result = await ui.request({ type: 'release', item: item.id, dryRun: true }, 30_000);
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /R-1.*no version/);
  const cli = await cland(root, 'release', '--item', item.id, '--dry-run');
  assert.notEqual(cli.code, 0);
  assert.match(cli.stderr, /R-1.*no version/);
  assert.equal(refs(root, territory, github), beforeRefs);
  assert.equal(await readFile(join(root, item.path), 'utf8'), beforeItem);
});

test('release from an item names non-release items, mismatched versions and open descendants', async t => {
  const { root, github, territory, ui } = await project(t);
  const release = await create(root, 'Next release', '--kind', 'release', '--version', '0.2.0');
  const task = await create(root, 'Ordinary task', '--size', 'M');
  const refuse = async (item: string, error: RegExp, version?: string) => {
    const before = refs(root, territory, github);
    const result = await ui.request({ type: 'release', item, dryRun: true, ...(version === undefined ? {} : { version }) }, 30_000);
    assert.equal(result.ok, false);
    assert.match(result.error ?? '', error);
    const cli = await cland(root, 'release', ...(version === undefined ? [] : [version]), '--item', item, '--dry-run', '--json');
    assert.notEqual(cli.code, 0);
    assert.match(cli.stderr, error);
    assert.equal(refs(root, territory, github), before);
  };
  await refuse(task.id, /T-2.*not a release.*task/);
  await refuse('T-999', /no item T-999/);
  await refuse(release.id, /v0.3.0.*R-1.*v0.2.0/, 'v0.3.0');
  const epic = await create(root, 'Closed epic', '--kind', 'epic', '--parent', release.id);
  const child = await create(root, 'Open nested task', '--size', 'M', '--parent', epic.id);
  // The tracker permits legacy trees to remain readable; descendants must still block publication.
  const path = join(root, epic.path);
  await writeFile(path, (await readFile(path, 'utf8')).replace('state: open', 'state: closed'));
  ok(await cland(root, 'task', 'view', epic.id, '--json'));
  await refuse(release.id, /open children[\s\S]*T-4 Open nested task/);
  const direct = await create(root, 'Open epic', '--kind', 'epic', '--parent', release.id);
  await refuse(release.id, /open children[\s\S]*T-4 Open nested task[\s\S]*E-5 Open epic/);
  assert.equal(child.id, 'T-4');
  assert.equal(direct.id, 'E-5');
});

test('item dry-run previews its Notes, epic deliverables and existing commit notes in order and stays read-only', async t => {
  const { root, github, territory, ui } = await project(t);
  const release = await create(root, 'Next release', '--kind', 'release', '--version', '0.2.0', '--body', '## Goal\n\nA release goal.\n\n## Notes\n\nHighlights for people.\n\n### Compatibility\n\nKeep existing workflows.\n\n## Other\n\nDo not publish this section.');
  const epic = await create(root, 'Parser', '--kind', 'epic', '--parent', release.id, '--body', '```md\n## Goal\nWrong deliverable.\n```\n\n## Goal\n\nShip v0.2.0 with\nfast parsing. More implementation details.\n\n## Other\n\nNot a goal.');
  ok(await cland(root, 'task', 'close', epic.id, '--override', 'fixture has no QA criteria'));
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'Record release plan');
  git(root, 'commit', '--allow-empty', '-qm', 'Polish the parser');
  const beforeRefs = refs(root, territory, github);
  const beforeItem = await readFile(join(root, release.path), 'utf8');
  const beforeEpic = await readFile(join(root, epic.path), 'utf8');
  const expected = 'Highlights for people.\n\n### Compatibility\n\nKeep existing workflows.\n\nE-2 Parser: Ship v0.2.0 with fast parsing.\n\nRecord release plan\nPolish the parser';
  const result = await ui.request({ type: 'release', item: release.id, dryRun: true }, 30_000);
  assert.equal(result.ok, true, result.error);
  const preview = result.value as ReleaseResult;
  assert.equal(preview.version, 'v0.2.0');
  assert.equal(preview.notes, expected);
  assert.equal(preview.dryRun, true);
  assert.equal(preview.commit, git(root, 'rev-parse', 'dev'));
  assert.equal(preview.refs[1], 'refs/tags/v0.2.0:refs/tags/v0.2.0');
  const cli = json<ReleaseResult>(await cland(root, 'release', 'v0.2.0', '--item', release.id, '--dry-run', '--json'));
  assert.deepEqual(cli, preview);
  const plain = ok(await cland(root, 'release', '--item', release.id, '--dry-run'));
  assert.match(plain.stdout, /^Would release v0.2.0 at /);
  assert.ok(plain.stdout.includes(expected));
  assert.equal(refs(root, territory, github), beforeRefs);
  assert.equal(await readFile(join(root, release.path), 'utf8'), beforeItem);
  assert.equal(await readFile(join(root, epic.path), 'utf8'), beforeEpic);
  assert.equal(git(root, 'status', '--porcelain'), '');
  await assert.rejects(readFile(join(root, '.cland', 'release.tmp')), { code: 'ENOENT' });
});

test('an item release publishes its notes and annotated tag, closes with a tag comment and leaves the next release open', async t => {
  const { root, github, territory } = await project(t);
  const notes = 'Verified in v0.1.1 (D19):\n- T-109 C1: the key-encoding matrix in real Ghostty and tmux terminals.\n- T-111 M7: the Coordinator following through on an Aide decision with a real model.';
  const item = await create(root, 'Current release', '--kind', 'release', '--version', '1.0.0-rc.1+build.2', '--body', `## Notes\n\n${notes}`);
  const next = await create(root, 'Next release', '--kind', 'release', '--version', '1.0.1');
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'Record release plans');
  const dev = git(root, 'rev-parse', 'dev');
  const preview = json<ReleaseResult>(await cland(root, 'release', '--item', item.id, '--dry-run', '--json'));
  const result = json<ReleaseResult>(await cland(root, 'release', '--item', item.id, '--json'));
  assert.equal(result.version, 'v1.0.0-rc.1+build.2');
  assert.equal(result.commit, dev);
  assert.equal(result.notes, preview.notes);
  assert.ok(result.notes.includes(notes));
  assert.equal(result.followUp, undefined);
  for (const repo of [root, territory, github]) {
    assert.equal(git(repo, 'rev-parse', 'main'), dev);
    assert.equal(git(repo, 'rev-parse', `${result.version}^{}`), dev);
    assert.equal(git(repo, 'cat-file', '-t', result.version), 'tag');
    assert.equal(git(repo, 'for-each-ref', '--format=%(contents)', `refs/tags/${result.version}`), result.notes);
  }
  const view = json<{ item: { state: string; comments: Array<{ author: string; text: string }> } }>(await cland(root, 'task', 'view', item.id, '--json')).item;
  assert.equal(view.state, 'closed');
  assert.equal(view.comments.length, 1);
  assert.equal(view.comments[0]!.author, 'human');
  assert.ok(view.comments[0]!.text.includes(result.version));
  assert.ok(view.comments[0]!.text.includes(dev));
  const open = json<{ items: Array<{ id: string }> }>(await cland(root, 'task', 'list', '--kind', 'release', '--state', 'open', '--json'));
  assert.deepEqual(open.items.map(i => i.id), [next.id]);
  await assert.rejects(readFile(join(root, '.cland', 'release.tmp')), { code: 'ENOENT' });
});

test('a published item release retries its pinned build after tracker closure fails and refuses a different or missing item', async t => {
  const { root, github, territory } = await project(t, startDaemon);
  const item = await create(root, 'Current release', '--kind', 'release', '--version', '0.1.0');
  const other = await create(root, 'Different release', '--kind', 'release', '--version', '0.1.0');
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'Release plans');
  const dev = git(root, 'rev-parse', 'dev');
  const discovery = JSON.parse(await readFile(join(root, '.cland', 'hub.json'), 'utf8')) as { pid: number };
  const obstruction = join(root, '.cland', 'tasks', `.${item.path.split('/').at(-1)}.${discovery.pid}.tmp`);
  await mkdir(obstruction);
  const first = json<ReleaseResult>(await cland(root, 'release', '--item', item.id, '--json'));
  assert.match(first.followUp?.error ?? '', /released; follow-up failed/);
  for (const repo of [root, territory, github]) assert.equal(git(repo, 'rev-parse', 'main'), dev);
  const publishedTag = git(github, 'rev-parse', 'v0.1.0');
  assert.equal(json<{ item: { state: string } }>(await cland(root, 'task', 'view', item.id, '--json')).item.state, 'open');
  const receipt = await readFile(join(root, '.cland', 'release.tmp'), 'utf8');
  const before = refs(root, territory, github);
  for (const args of [['v0.1.0'], ['--item', other.id]]) {
    const wrong = await cland(root, 'release', ...args);
    assert.notEqual(wrong.code, 0);
    assert.match(wrong.stderr, /pending release.*R-1/);
    assert.equal(refs(root, territory, github), before);
  }
  await rm(obstruction, { recursive: true });
  git(root, 'commit', '--allow-empty', '-qm', 'Later dev work');
  ok(await cland(root, 'hub', 'stop'));
  await startDaemon(t, root);
  const retry = json<ReleaseResult>(await cland(root, 'release', '--item', item.id, '--json'));
  assert.equal(retry.followUp, undefined);
  assert.equal(retry.commit, first.commit);
  assert.equal(retry.notes, first.notes);
  // Model a crash after the item write but before receipt deletion: replay must not duplicate the comment.
  await writeFile(join(root, '.cland', 'release.tmp'), receipt);
  const closedRetry = json<ReleaseResult>(await cland(root, 'release', '--item', item.id, '--json'));
  assert.equal(closedRetry.commit, first.commit);
  assert.equal(closedRetry.followUp, undefined);
  assert.equal(git(github, 'rev-parse', 'v0.1.0'), publishedTag);
  const view = json<{ item: { state: string; comments: Array<{ text: string }> } }>(await cland(root, 'task', 'view', item.id, '--json')).item;
  assert.equal(view.state, 'closed');
  assert.equal(view.comments.filter(c => c.text.includes('Released v0.1.0')).length, 1);
  assert.equal(json<{ item: { state: string } }>(await cland(root, 'task', 'view', other.id, '--json')).item.state, 'open');
  await assert.rejects(readFile(join(root, '.cland', 'release.tmp')), { code: 'ENOENT' });
});

test('a rejected item publication preserves the open release and every ref, then closes only on a successful retry', async t => {
  const { root, github, territory } = await project(t);
  const item = await create(root, 'Current release', '--kind', 'release', '--version', '0.1.0');
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'Release plan');
  const before = refs(root, territory, github);
  const source = await readFile(join(root, item.path), 'utf8');
  const hook = join(github, 'hooks', 'pre-receive');
  await writeFile(hook, '#!/bin/sh\necho "Release rejected by fixture" >&2\nexit 1\n', { mode: 0o755 });
  const rejected = await cland(root, 'release', '--item', item.id);
  assert.notEqual(rejected.code, 0);
  assert.match(rejected.stderr, /Release rejected by fixture/);
  assert.equal(refs(root, territory, github), before);
  assert.equal(await readFile(join(root, item.path), 'utf8'), source);
  await rm(hook);
  ok(await cland(root, 'release', '--item', item.id));
  assert.equal(json<{ item: { state: string } }>(await cland(root, 'task', 'view', item.id, '--json')).item.state, 'closed');
});

test('a release without --item keeps release items and their Notes untouched', async t => {
  const { root, github } = await project(t);
  const item = await create(root, 'Current release', '--kind', 'release', '--version', '0.1.0', '--body', '## Notes\n\nItem-only notes.');
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'Release plan');
  const source = await readFile(join(root, item.path), 'utf8');
  const result = json<ReleaseResult>(await cland(root, 'release', 'v0.1.0', '--json'));
  assert.equal(result.notes, 'Release plan');
  assert.equal(git(github, 'for-each-ref', '--format=%(contents)', 'refs/tags/v0.1.0'), 'Release plan');
  assert.equal(await readFile(join(root, item.path), 'utf8'), source);
});

test('lock cleanup failure after item closure retains the receipt for a same-item retry', async t => {
  const { root, github, territory } = await project(t);
  const item = await create(root, 'Current release', '--kind', 'release', '--version', '0.1.0');
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'Release plan');
  const dev = git(root, 'rev-parse', 'dev');
  const lock = join(root, '.cland', 'territory.lock');
  const hook = join(github, 'hooks', 'post-receive');
  const quote = (path: string) => "'" + path.replaceAll("'", "'\\''") + "'";
  // GitHub has accepted main/tag; replace the held lock with a directory so its final ownership read fails.
  await writeFile(hook, `#!/bin/sh\nrm -f ${quote(lock)}\nmkdir ${quote(lock)}\n`, { mode: 0o755 });
  const first = json<ReleaseResult>(await cland(root, 'release', '--item', item.id, '--json'));
  assert.equal(first.followUp?.step, 'lock-release');
  assert.match(first.followUp?.error ?? '', /released; follow-up failed.*EISDIR/s);
  const closed = json<{ item: { state: string; comments: Array<{ text: string }> } }>(await cland(root, 'task', 'view', item.id, '--json')).item;
  assert.equal(closed.state, 'closed');
  assert.equal(closed.comments.filter(c => c.text.includes('Released v0.1.0')).length, 1);
  const receipt = JSON.parse(await readFile(join(root, '.cland', 'release.tmp'), 'utf8')) as { item: string; commit: string };
  assert.equal(receipt.item, item.id);
  assert.equal(receipt.commit, dev);
  const tag = git(github, 'rev-parse', 'v0.1.0');
  for (const repo of [root, territory, github]) assert.equal(git(repo, 'rev-parse', 'main'), dev);
  await rm(hook);
  await rm(lock, { recursive: true });
  git(root, 'commit', '--allow-empty', '-qm', 'Later dev work');
  const retry = json<ReleaseResult>(await cland(root, 'release', '--item', item.id, '--json'));
  assert.equal(retry.followUp, undefined);
  assert.equal(retry.commit, dev);
  assert.equal(git(github, 'rev-parse', 'v0.1.0'), tag);
  const retried = json<{ item: { state: string; comments: Array<{ text: string }> } }>(await cland(root, 'task', 'view', item.id, '--json')).item;
  assert.equal(retried.state, 'closed');
  assert.deepEqual(retried.comments, closed.comments);
  await assert.rejects(readFile(join(root, '.cland', 'release.tmp')), { code: 'ENOENT' });
});
