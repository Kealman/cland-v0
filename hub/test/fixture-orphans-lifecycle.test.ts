// T3: worktree cleanup reaps a real headless Neovim and its stdio stub before deleting their cwd.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { nvimOrSkip, startClient, tempProject } from '../../nvim/test/stub-client.ts';
import { findFixtureOrphans, removeWorktreeWithFixtures } from '../src/fixture-processes.ts';
import { startDaemon, tempProject as hubProject } from './harness.ts';
import { pidAlive } from '../src/project.ts';

const nvim = await nvimOrSkip();
test('worktree removal reaps the receipt-bearing headless client and stub before deleting their root', { skip: 'skip' in nvim ? nvim.skip : false }, async t => {
  if (!('bin' in nvim)) return;
  const root = await tempProject(t);
  await mkdir(join(root, '.git'));
  const client = await startClient(t, nvim.bin, root, {
    CLAND_HUB_TRANSPORT: 'stdio',
    CLAND_COMMAND: JSON.stringify([process.execPath, fileURLToPath(new URL('../../nvim/test/stub-hub.ts', import.meta.url))]),
    CLAND_STUB_SCENARIO_JSON: '{}',
  });
  const fixtures = await findFixtureOrphans(root, undefined, undefined, root);
  assert.ok(fixtures.some(p => p.process.pid === client.process.pid), 'Neovim retains its inherited ownership descriptor');
  assert.equal(fixtures.length, 2, 'the stub holds its own PID-bound receipt');
  await removeWorktreeWithFixtures(root, async () => {
    for (const fixture of fixtures) assert.equal(pidAlive(fixture.process.pid), false, 'each owned writer is gone before directory removal');
    await rm(root, { recursive: true });
  });
});


test('worktree removal stops an explicitly owned fixture hub before deleting its project', async t => {
  const root = await hubProject(t);
  const { discovery } = await startDaemon(t, root);
  const fixtures = await findFixtureOrphans(root, undefined, undefined, root);
  assert.ok(fixtures.some(p => p.process.pid === discovery.pid));
  await removeWorktreeWithFixtures(root, async () => {
    assert.equal(pidAlive(discovery.pid), false, 'fixture hub finished shutdown before root removal');
    await rm(root, { recursive: true });
  });
});
