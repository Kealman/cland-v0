// T3 scenario: atomic release push and sync against a bare GitHub remote.
// Rule coverage (T1/T2): hub/test/merge-policy.test.ts, hub/test/demo-release-component.test.ts; remaining release refusals in hub/test/release.test.ts (native Git).
// Hub process starts: 0; one projectHub per release/sync step. Only one hub is live at a time.
import { releaseCover } from '../release-support.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland } from '../harness.ts';
import { git, ok, project, merged, clean, collaborator } from '../release-support.ts';

test('release atomically publishes dev and an annotated tag with item titles, then advances local and territory main', async (t) => {
  const { root, github, territory } = await project(t);
  await merged(root, 'Ship the parser', 'GLOSSARY.md');
  await merged(root, 'Ship the renderer', 'README.md');
  git(root, 'commit', '--allow-empty', '-qm', 'Record release metadata');
  const dev = git(root, 'rev-parse', 'dev');
  await releaseCover(root);
  ok(await cland(root, 'release', 'v0.1.0'));
  for (const repo of [root, github, territory]) assert.equal(git(repo, 'rev-parse', 'main'), dev);
  assert.equal(git(github, 'cat-file', '-t', 'v0.1.0'), 'tag');
  assert.equal(git(github, 'rev-parse', 'v0.1.0^{}'), dev);
  assert.equal(git(github, 'for-each-ref', '--format=%(contents)', 'refs/tags/v0.1.0'), 'T-1 Ship the parser\nT-2 Ship the renderer\nRecord release metadata');
  assert.equal(git(root, 'rev-parse', 'v0.1.0'), git(github, 'rev-parse', 'v0.1.0'));
});

test('sync imports GitHub main and replays unreleased dev commits, updating the root and territory without a GitHub push', async (t) => {
  const { root, github, territory } = await project(t);
  await merged(root, 'Ship the parser', 'GLOSSARY.md');
  await clean(root);
  const oldDev = git(root, 'rev-parse', 'dev');
  const remote = await collaborator(t, github, 'collaborator.txt', 'from github\n');
  ok(await cland(root, 'sync'));
  assert.equal(git(root, 'rev-parse', 'main'), remote);
  assert.equal(git(territory, 'rev-parse', 'main'), remote);
  assert.equal(git(github, 'rev-parse', 'main'), remote);
  assert.notEqual(git(root, 'rev-parse', 'dev'), oldDev);
  assert.equal(git(root, 'rev-parse', 'HEAD'), git(root, 'rev-parse', 'dev'));
  assert.equal(git(territory, 'rev-parse', 'dev'), git(root, 'rev-parse', 'dev'));
  assert.equal(git(root, 'show', 'dev:collaborator.txt'), 'from github');
  assert.equal(await readFile(join(root, 'collaborator.txt'), 'utf8'), 'from github\n');
  assert.equal(await readFile(join(root, 'GLOSSARY.md'), 'utf8'), 'finished\n');
  assert.match(git(root, 'log', '--format=%B', 'main..dev'), /Item: T-1/);
  assert.equal(git(root, 'status', '--porcelain'), '');
});
