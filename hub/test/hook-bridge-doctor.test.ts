// Doctor's CLI seam preserves bridges with any existing discovery file.
import { fixtureEnvironment } from './fixture-environment.ts';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { CLI_ENTRY, clandWithEnv, pidAlive, tempProject } from './harness.ts';
import { ownProcess } from './process-cleanup.ts';

test('doctor lists and ends only own bridges with missing hub files, preserving existing and ambiguous paths', async t => {
  const root = await tempProject(t);
  const missing = join(root, 'removed/.cland/hub.json');
  const present = join(root, 'live/.cland/hub.json');
  await mkdir(join(root, 'live/.cland'), { recursive: true });
  await writeFile(present, '{}'); // Even a malformed file is preserved.
  const children = [missing, present, join(root, 'ambiguous path/.cland/hub.json')].map(file => {
    const child = spawn(process.execPath, [CLI_ENTRY, 'hook', 'bridge', '--session', 'impl', '--hub-file', file], { env: fixtureEnvironment(root, process.env), cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    ownProcess(t, child.pid);
    child.stdout.resume(); child.stderr.resume();
    return child;
  });
  const report = await clandWithEnv(root, {}, 'doctor', '--json');
  const checks = (JSON.parse(report.stdout) as { checks: Array<{ name: string; detail: string }> }).checks.filter(c => c.name === 'orphan bridge');
  assert.equal(checks.length, 1, report.stdout);
  assert.match(checks[0]!.detail, new RegExp(`pid ${children[0]!.pid}`));
  assert.ok(children.every(child => pidAlive(child.pid!)), 'listing is read-only');
  const fixed = await clandWithEnv(root, {}, 'doctor', '--fix', '--json');
  assert.match(fixed.stdout, new RegExp(`ended pid ${children[0]!.pid}`));
  assert.equal(pidAlive(children[0]!.pid!), false);
  assert.equal(pidAlive(children[1]!.pid!), true);
  assert.equal(pidAlive(children[2]!.pid!), true);
});
