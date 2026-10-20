// T3: doctor --fix reaps a deleted project's live hub process while preserving another root's hub.
// Run alongside orphan-servers.test.ts: each doctor's deleted-project sweep owns only its fixture root.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { findOrphans } from '../src/orphans.ts';
import { clandWithEnv, eventually, pidAlive, projectHub, startDaemon, tempProject } from './harness.ts';

test('doctor --fix under one fixture root preserves another deleted-project hub', async t => {
  const scope = await tempProject(t, 'cland-doctor-scope-');
  const root = await tempProject(t, 'live-', scope);
  const removed = await tempProject(t, 'removed-', scope);
  const other = await tempProject(t, 'cland-other-doctor-');
  // This case asserts doctor cleanup, not startup cleanup. The default skips
  // startup sweeping so only the explicit doctor owns the deletion boundary.
  const owned = await startDaemon(t, removed);
  const foreign = await startDaemon(t, other);
  // Keep both hubs alive for the sweep assertions; their .cland/run writes can race rm on Linux.
  // Retry transient removal errors with at most 2.75 s of linear backoff per fixture.
  await rm(removed, { recursive: true, maxRetries: 10, retryDelay: 50 });
  await rm(other, { recursive: true, maxRetries: 10, retryDelay: 50 });
  // Embedded startup sweeping is a separate launch path from startDaemon. Arm
  // its completion observer before launch, then prove it preserves both targets.
  const entries: Array<Record<string, unknown>> = [];
  await projectHub(t, root, { CLAND_TEST_SKIP_ORPHAN_SWEEP: '0' }, { log: entry => entries.push(entry) });
  await eventually('embedded startup sweep completed', () => entries.some(entry => entry.event === 'orphan-sweep-completed') ? true : undefined);
  assert.equal(pidAlive(owned.discovery.pid), true, 'embedded startup does not consume doctor’s deleted-project target');
  assert.equal(pidAlive(foreign.discovery.pid), true, 'embedded startup preserves another fixture’s deleted-project hub');
  const candidates = await findOrphans(root, true, undefined, scope);
  assert.ok(candidates.some(p => p.process.pid === owned.discovery.pid && p.kind === 'hub'));
  assert.equal(candidates.some(p => p.process.pid === foreign.discovery.pid), false, 'another fixture must not enter this doctor’s sweep');
  const fixed = await clandWithEnv(root, { CLAND_TEST_ORPHAN_ROOT: scope }, 'doctor', '--fix', '--json');
  assert.match(fixed.stdout, new RegExp(`ended pid ${owned.discovery.pid}`));
  assert.equal(pidAlive(owned.discovery.pid), false);
  assert.equal(pidAlive(foreign.discovery.pid), true, 'a deleted project outside the fixture root survives');
});
