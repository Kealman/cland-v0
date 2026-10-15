// Run alongside orphan-servers.test.ts: each doctor's deleted-project sweep owns only its fixture root.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { findOrphans } from '../src/orphans.ts';
import { clandWithEnv, pidAlive, startDaemon, tempProject } from './harness.ts';

test('doctor --fix under one fixture root preserves another deleted-project hub', async t => {
  const scope = await tempProject(t, 'cland-doctor-scope-');
  const root = await tempProject(t, 'live-', scope);
  const removed = await tempProject(t, 'removed-', scope);
  const other = await tempProject(t, 'cland-other-doctor-');
  const owned = await startDaemon(t, removed, {}, { sweep: true });
  const foreign = await startDaemon(t, other, {}, { sweep: true });
  await rm(removed, { recursive: true });
  await rm(other, { recursive: true });
  const candidates = await findOrphans(root, true, undefined, scope);
  assert.ok(candidates.some(p => p.process.pid === owned.discovery.pid));
  assert.equal(candidates.some(p => p.process.pid === foreign.discovery.pid), false, 'another fixture must not enter this doctor’s sweep');
  const fixed = await clandWithEnv(root, { CLAND_TEST_ORPHAN_ROOT: scope }, 'doctor', '--fix', '--json');
  assert.match(fixed.stdout, new RegExp(`ended pid ${owned.discovery.pid}`));
  assert.equal(pidAlive(owned.discovery.pid), false);
  assert.equal(pidAlive(foreign.discovery.pid), true, 'a deleted project outside the fixture root survives');
});
