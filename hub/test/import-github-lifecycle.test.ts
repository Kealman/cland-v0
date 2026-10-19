// T3: the CLI refuses a native Git project when the hub is absent (native Git exits and CLI discovery).
// Successful imports and repository-selection rules live in import-github.test.ts (T2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cland, tempProject } from './harness.ts';

test('import-github refuses a native Git project when no hub is running', async t => {
  const root = await tempProject(t, 'cland-import-');
  const REPO = 'acme/widgets';
  // Native Git fixture creation remains at the native boundary, outside T2 workers.
  assert.equal(spawnSync('git', ['init', '-q'], { cwd: root }).status, 0);
  assert.equal(spawnSync('git', ['remote', 'add', 'origin', `git@github.com:${REPO}.git`], { cwd: root }).status, 0);
  const noHub = await cland(root, 'task', 'import-github', '--repo', 'acme/widgets');
  assert.equal(noHub.code, 1);
  assert.match(noHub.stderr, /no hub running/);
});
