// T3: native Git and cland CLI process starts prove atomic remote publication, following release ancestry checks and ref-failure recovery; the hub stays in-process.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { cland, eventually } from './harness.ts';
import { project, git, clean, json } from './release-support.ts';

test('publish previews exact tips, publishes only marketing commits and preserves dev for the next release', async t => {
  const { root, github, territory } = await project(t);
  const { item } = json<{ item: { id: string } }>(await cland(root, 'task', 'create', '--size', 'S', 'Marketing', '--json'));
  await clean(root);
  // Inherited dev code must never leak into the cherry-picked public history (D56).
  await writeFile(join(root, 'private-code.ts'), 'unreleased\n');
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'Unreleased product work');
  const oldDev = git(root, 'rev-parse', 'dev');
  const oldMain = git(github, 'rev-parse', 'main');
  git(github, 'branch', 'site', oldMain);
  git(root, 'checkout', '-qb', 'marketing');
  await mkdir(join(root, 'site'));
  for (const text of ['First marketing change\n', 'Second marketing change\n']) {
    await writeFile(join(root, 'site/index.html'), text);
    git(root, 'add', 'site/index.html');
    git(root, 'commit', '-qm', text.trim());
  }
  const source = git(root, 'rev-parse', 'HEAD');
  git(root, 'checkout', '-q', 'dev');
  const before = [root, github, territory].map(repo => git(repo, 'show-ref'));
  const preview = json<import('../src/territory-publish.ts').PublishResult>(await cland(root, 'publish', 'marketing', '--item', item.id, '--dry-run', '--json'));
  assert.equal(preview.commits.length, 2);
  assert.deepEqual(preview.paths, ['site/index.html']);
  assert.deepEqual([root, github, territory].map(repo => git(repo, 'show-ref')), before);
  const result = json<import('../src/territory-publish.ts').PublishResult>(await cland(root, 'publish', 'marketing', '--item', item.id, '--json'));
  assert.equal(result.followUp, undefined);
  assert.equal(result.main, preview.main);
  assert.equal(result.dev, preview.dev);
  assert.equal(git(github, 'rev-parse', 'main'), result.main);
  assert.equal(git(github, 'rev-parse', 'site'), result.main);
  assert.equal(git(github, 'rev-list', '--count', `${oldMain}..main`), '2');
  assert.equal(git(github, 'ls-tree', '--name-only', 'main', 'private-code.ts'), '');
  assert.equal(git(github, 'merge-base', '--is-ancestor', oldMain, result.main), '');
  for (const repo of [root, territory]) {
    assert.equal(git(repo, 'rev-parse', 'main'), result.main);
    assert.equal(git(repo, 'rev-parse', 'dev'), result.dev);
    for (const tip of [oldDev, source, result.main]) assert.equal(git(repo, 'merge-base', '--is-ancestor', tip, 'dev'), '');
  }
  const { item: view } = json<{ item: { comments: Array<{ text: string }> } }>(await cland(root, 'task', 'view', item.id, '--json'));
  assert.ok(view.comments.some(comment => comment.text.includes(`Published marketing marketing at ${result.main}`)));
  await clean(root);
  await import('./release-support.ts').then(({ releaseCover }) => releaseCover(root));
  const release = await cland(root, 'release', 'v0.1.0', '--dry-run', '--json');
  assert.equal(release.code, 0, release.stderr);
});

test('a task published through cland publish counts as merged and closes its plan stage', async t => {
  const { root } = await project(t);
  const { item: epic } = json<{ item: { id: string } }>(await cland(root, 'task', 'create', '--kind', 'epic', 'Published epic', '--json'));
  const { item: task } = json<{ item: { id: string } }>(await cland(root, 'task', 'create', '--size', 'S', '--parent', epic.id, '--branch', 'marketing', 'Marketing', '--json'));
  const planFile = join(root, 'plan.yaml');
  await writeFile(planFile, stringify({ stages: [{ name: 'marketing', qa: { scope: 'none', when: 'per-item' }, lanes: [[task.id]] }] }));
  const planned = await cland(root, 'task', 'plan', 'set', epic.id, '--file', planFile, '--json');
  assert.equal(planned.code, 0, planned.stderr);
  await clean(root);
  git(root, 'checkout', '-qb', 'marketing');
  await mkdir(join(root, 'site'), { recursive: true });
  await writeFile(join(root, 'site/index.html'), 'Published marketing copy\n');
  git(root, 'add', 'site/index.html');
  git(root, 'commit', '-qm', 'Marketing copy');
  git(root, 'checkout', '-q', 'dev');
  const published = json<{ followUp?: { step: string; error: string }; dev: string }>(await cland(root, 'publish', 'marketing', '--item', task.id, '--json'));
  assert.equal(published.followUp, undefined, published.followUp?.error);
  // A publish landing is not a pending merge recovery: dev still pushes while the item is open.
  const pushed = await cland(root, 'push');
  assert.equal(pushed.code, 0, pushed.stderr);
  const closed = await cland(root, 'task', 'close', task.id);
  assert.equal(closed.code, 0, closed.stderr);
  const { item } = json<{ item: { merged?: boolean } }>(await cland(root, 'task', 'view', task.id, '--json'));
  assert.equal(item.merged, true, 'the published task reports its dev landing');
  const shown = await eventually('published stage closes with both platform covers', async () => {
    const view = json<{ stages: Array<{ state: string; merged: number; total: number }> }>(await cland(root, 'task', 'plan', 'show', epic.id, '--json'));
    return view.stages[0]?.state === 'closed' ? view : undefined;
  });
  assert.equal(shown.stages[0]?.merged, 1);
  assert.equal(shown.stages[0]?.total, 1);
  assert.equal(shown.stages[0]?.state, 'closed');
});

test('publish recovers a published tip after local ref failure without republishing or duplicating its comment', async t => {
  const { root, github } = await project(t);
  const { item } = json<{ item: { id: string } }>(await cland(root, 'task', 'create', '--size', 'S', 'Marketing', '--json'));
  await clean(root);
  git(root, 'checkout', '-qb', 'marketing');
  await writeFile(join(root, 'README.md'), 'Marketing\n');
  git(root, 'add', 'README.md');
  git(root, 'commit', '-qm', 'Marketing');
  git(root, 'checkout', '-q', 'dev');
  const lock = join(root, '.git/refs/heads/main.lock');
  await writeFile(lock, 'fixture obstruction');
  const first = json<import('../src/territory-publish.ts').PublishResult>(await cland(root, 'publish', 'marketing', '--item', item.id, '--json'));
  assert.equal(first.followUp?.step, 'sync');
  const publicRefs = git(github, 'show-ref');
  for (const args of [['release', 'v0.1.0', '--dry-run'], ['sync'], ['push']]) {
    const refused = await cland(root, ...args);
    assert.notEqual(refused.code, 0);
    assert.match(refused.stderr, /finish pending cland publish/);
  }
  await rm(lock);
  const retry = json<import('../src/territory-publish.ts').PublishResult>(await cland(root, 'publish', 'marketing', '--item', item.id, '--json'));
  assert.equal(retry.followUp, undefined);
  assert.equal(retry.main, first.main);
  assert.equal(retry.dev, first.dev);
  assert.equal(git(github, 'show-ref'), publicRefs);
  const { item: view } = json<{ item: { comments: Array<{ text: string }> } }>(await cland(root, 'task', 'view', item.id, '--json'));
  assert.equal(view.comments.filter(comment => comment.text.includes('Published marketing')).length, 1);
});

test('an atomic GitHub refusal leaves both public refs and dev untouched, then recovers the prepared publication', async t => {
  const { root, github, territory } = await project(t);
  const { item } = json<{ item: { id: string } }>(await cland(root, 'task', 'create', '--size', 'S', 'Marketing', '--json'));
  await clean(root);
  git(github, 'branch', 'site', 'main');
  git(root, 'checkout', '-qb', 'marketing');
  await writeFile(join(root, 'README.md'), 'Approved marketing\n');
  git(root, 'add', 'README.md');
  git(root, 'commit', '-qm', 'Marketing');
  git(root, 'checkout', '-q', 'dev');
  const hook = join(github, 'hooks/update');
  await writeFile(hook, '#!/bin/sh\n[ "$1" != refs/heads/site ]\n');
  await chmod(hook, 0o755);
  const before = [root, github, territory].map(repo => git(repo, 'show-ref'));
  const refused = await cland(root, 'publish', 'marketing', '--item', item.id);
  assert.notEqual(refused.code, 0);
  assert.deepEqual([root, github, territory].map(repo => git(repo, 'show-ref')), before);
  await rm(hook);
  const retry = json<import('../src/territory-publish.ts').PublishResult>(await cland(root, 'publish', 'marketing', '--item', item.id, '--json'));
  assert.equal(retry.followUp, undefined);
  assert.equal(git(github, 'rev-parse', 'main'), retry.main);
  assert.equal(git(github, 'rev-parse', 'site'), retry.main);
});
