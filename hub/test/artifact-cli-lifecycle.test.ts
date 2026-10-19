// T3: native Git HEAD/index stay unchanged when the artifact CLI promotes a folder into the checkout.
// Folder contents, source retention and permission rules are covered in artifact-cli.test.ts (T2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, projectHub, tempProject } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { gitIn } from '../src/tracker/verdict-git.ts';
import type { Artifact } from '../src/protocol.ts';

test('artifact CLI promotion leaves native Git HEAD and index untouched', async t => {
  const root = await tempProject(t);
  const git = gitIn(root);
  await git(['init', '-q', '-b', 'main']);
  await git(['config', 'user.name', 'Test']); await git(['config', 'user.email', 'test@example.com']);
  await writeFile(join(root, 'base'), 'base'); await git(['add', 'base']); await git(['commit', '-qm', 'base']);
  const head = await git(['rev-parse', 'HEAD']), index = await git(['ls-files', '--stage']);
  await projectHub(t, root, {}, { clock: new FakeClock() });
  const result = await cland(root, 'artifact', 'new', '--kind', 'note', '--title', 'v0.2 notes', '--topic', 'general', '--folder', '--content', '# v0.2', '--json');
  assert.equal(result.code, 0, result.stderr);
  const a: Artifact = JSON.parse(result.stdout).artifact;
  const promoted = await cland(root, 'artifact', 'promote', a.id, 'docs/v0.2-notes', '--json');
  assert.equal(promoted.code, 0, promoted.stderr);
  assert.equal(await git(['rev-parse', 'HEAD']), head); assert.equal(await git(['ls-files', '--stage']), index);
});
