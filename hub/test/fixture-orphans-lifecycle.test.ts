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
import { processPaths } from '../src/process-paths.ts';
import { systemProcesses } from '../src/system-processes.ts';
import { readFixtureReceipt } from '../../shared/fixture-ownership.ts';
import { eventually } from '../../nvim/test/fixture.ts';

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
  const pid = client.process.pid!;
  // Separate OS descriptor evidence from PID/birth matching: a classifier miss
  // does not establish that exec closed the descriptor. /proc on Linux, lsof on macOS.
  const receipts = (await Promise.all((await processPaths(pid)).files.map(readFixtureReceipt)))
    .filter(receipt => receipt?.pid === pid);
  assert.equal(receipts.length, 1, 'Neovim retains its inherited private ownership descriptor');
  const row = (await systemProcesses(undefined, undefined, [pid])).find(row => row.pid === pid);
  assert.ok(row, 'Neovim still has its native process identity');
  const born = Math.floor(Date.parse(row.started) / 1000);
  assert.ok(born >= receipts[0]!.born.min && born <= receipts[0]!.born.max,
    `native ${process.platform} ps birth ${born} fits child receipt ${JSON.stringify(receipts[0]!.born)}`);
  const fixtures = await eventually('both client and stub publish OS-visible PID-bound receipts', async () => {
    const fixtures = await findFixtureOrphans(root, undefined, undefined, root);
    return fixtures.some(p => p.process.pid === pid) && fixtures.length === 2 ? fixtures : undefined;
  });
  assert.ok(fixtures.some(p => p.process.pid === pid), 'Neovim has a matching PID/birth ownership receipt');
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
