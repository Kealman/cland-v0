// T3: real Git commit and index identities remain unchanged across artifact promotion; the artifact rules are T2 in artifacts.test.ts.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import type { Artifact } from '../src/protocol.ts';
import { gitIn } from '../src/tracker/verdict-git.ts';
import { cland, connectUi, projectHub, tempProject } from './harness.ts';

test('human promotes artifact bytes into the repo without changing Git and refuses confined or occupied paths', async (t) => {
  const root = await tempProject(t);
  const git = gitIn(root);
  assert.equal(await git(['init', '-q', '-b', 'main']), '');
  await git(['config', 'user.name', 'Test']);
  await git(['config', 'user.email', 'test@example.com']);
  await writeFile(join(root, 'base'), 'base');
  await git(['add', 'base']);
  await git(['commit', '-qm', 'base']);
  const head = await git(['rev-parse', 'HEAD']);
  const index = await git(['ls-files', '--stage']);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  const made = await ui.request({ type: 'artifact.create', kind: 'note', title: 'Design', content: '# Design', topic: 'general' });
  const a = (made.value as { artifact: Artifact }).artifact;
  const result = await cland(root, 'artifact', 'promote', a.id, 'docs/design.md', '--json');
  assert.equal(result.code, 0, result.stderr);
  assert.equal(await readFile(join(root, 'docs/design.md'), 'utf8'), '# Design');
  assert.equal(JSON.parse(result.stdout).artifact.promoted, 'docs/design.md');
  assert.equal(await git(['rev-parse', 'HEAD']), head);
  assert.equal(await git(['ls-files', '--stage']), index);
  assert.match((await cland(root, 'artifact', 'list')).stdout, /promoted: docs\/design.md/);
  assert.equal((await cland(root, 'artifact', 'promote', a.id, 'docs/again.md')).code, 1);
});
