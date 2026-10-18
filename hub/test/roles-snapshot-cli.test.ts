// T3 integration: the real CLI stays connected while role assignment reads configuration
// beyond its 3 s discovery probe deadline. The deliberate 3.1 s delay needs a real CLI clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { RolesFile } from '../src/roles/config.ts';
import { DEFAULT_ROLES_TOML } from '../src/roles/default-roles.ts';
import { createHubBase } from '../src/hub/server.ts';
import { createSocketEdge } from '../src/hub/socket.ts';
import { writeDiscovery } from '../src/project.ts';
import { cland, sleep, tempProject } from './harness.ts';

test('role set CLI waits for a configuration read beyond the short socket probe budget', async t => {
  const root = await tempProject(t);
  const path = join(root, '.cland', 'roles.toml');
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(path, DEFAULT_ROLES_TOML);
  // Keep refresh on the assignment path, rather than a background interval.
  t.mock.timers.enable({ apis: ['setInterval'] });
  let slow = false;
  const roles = new RolesFile(path, () => {}, async file => {
    if (slow) await sleep(3100); // lint-allow-wall-clock: real CLI must outlive the 3 s discovery probe budget
    return readFile(file, 'utf8');
  });
  await roles.start();
  const hub = createHubBase({ secret: 'test', roles });
  const socket = join(root, 'hub.sock');
  const edge = await createSocketEdge({ path: socket, dispatcher: hub.dispatcher });
  t.after(async () => { await edge.close(); await hub.close(); await roles.stop(); });
  writeDiscovery(join(root, '.cland', 'hub.json'), { root, socket, port: 0, secret: 'test', pid: process.pid, version: 'test' });
  slow = true;

  const result = await cland(root, 'role', 'set', 'rev', 'reviewer');
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /^rev \[Reviewer\] \(offline\): role set/);
  assert.equal(hub.core.roleList().roles.find(role => role.role === 'reviewer')?.holders[0]?.name, 'rev');
});

