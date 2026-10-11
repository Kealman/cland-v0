import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, connectUi, startDaemon, tempProject, type CliResult } from './harness.ts';
import type { ReleaseResult } from '../src/release.ts';

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const ok = (r: CliResult) => { assert.equal(r.code, 0, r.stderr || r.stdout); return r; };
const json = <T>(r: CliResult): T => JSON.parse(ok(r).stdout) as T;

async function project(t: TestContext) {
  const root = await tempProject(t, 'cland-release-item-');
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.name', 'Test');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'commit.gpgsign', 'false');
  await writeFile(join(root, 'README.md'), 'project\n');
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'Initial');
  const github = await tempProject(t, 'cland-github-');
  git(root, 'clone', '-q', '--bare', '.', github);
  git(root, 'remote', 'add', 'origin', github);
  ok(await cland(root, 'init'));
  git(root, 'checkout', '-q', 'dev');
  const { discovery } = await startDaemon(t, root);
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
  assert.match(result.error ?? '', /T-1.*no version/);
  const cli = await cland(root, 'release', '--item', item.id, '--dry-run');
  assert.notEqual(cli.code, 0);
  assert.match(cli.stderr, /T-1.*no version/);
  assert.equal(refs(root, territory, github), beforeRefs);
  assert.equal(await readFile(join(root, item.path), 'utf8'), beforeItem);
});

test('release from an item names non-release items, mismatched versions and open descendants', async t => {
  const { root, github, territory, ui } = await project(t);
  const release = await create(root, 'Next release', '--kind', 'release', '--version', '0.2.0');
  const task = await create(root, 'Ordinary task');
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
  await refuse(release.id, /v0.3.0.*T-1.*v0.2.0/, 'v0.3.0');
  const epic = await create(root, 'Closed epic', '--kind', 'epic', '--parent', release.id);
  const child = await create(root, 'Open nested task', '--parent', epic.id);
  // The tracker permits legacy trees to remain readable; descendants must still block publication.
  const path = join(root, epic.path);
  await writeFile(path, (await readFile(path, 'utf8')).replace('state: open', 'state: closed'));
  ok(await cland(root, 'task', 'view', epic.id, '--json'));
  await refuse(release.id, /open children[\s\S]*T-4 Open nested task/);
  const direct = await create(root, 'Open epic', '--kind', 'epic', '--parent', release.id);
  await refuse(release.id, /open children[\s\S]*T-4 Open nested task[\s\S]*T-5 Open epic/);
  assert.equal(child.id, 'T-4');
  assert.equal(direct.id, 'T-5');
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
  const expected = 'Highlights for people.\n\n### Compatibility\n\nKeep existing workflows.\n\nT-2 Parser: Ship v0.2.0 with fast parsing.\n\nRecord release plan\nPolish the parser';
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

test('item previews support SemVer and empty Notes, and cannot publish before item release completion is available', async t => {
  const { root, github, territory, ui } = await project(t);
  const item = await create(root, 'Preview release', '--kind', 'release', '--version', '1.0.0-rc.1+build.2');
  git(root, 'commit', '--allow-empty', '-qm', 'Ready for preview');
  const before = refs(root, territory, github);
  const preview = json<ReleaseResult>(await cland(root, 'release', '--item', item.id, '--dry-run', '--json'));
  assert.equal(preview.version, 'v1.0.0-rc.1+build.2');
  assert.equal(preview.notes, 'Ready for preview');
  const result = await ui.request({ type: 'release', item: item.id }, 30_000);
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /T-1.*require --dry-run/);
  assert.equal(refs(root, territory, github), before);
});
