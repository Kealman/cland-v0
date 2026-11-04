// T4: a separate native spoke is necessary to measure its resident set rather than the test hub's.
// One spoke process; projectHub stays in-process. Observe welcome before the required 10 s idle sample.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { projectHub, tempProject, spawnSpoke, eventually } from './harness.ts';
import { fixtureProcessCensus } from './process-cleanup.ts';
import { fixtureEnvironment, scratchGitEnvironment } from './fixture-environment.ts';

test('spoke RSS after welcome and ten idle seconds (measurement only)', { timeout: 45000 }, async t => {
  const root = await tempProject(t, 'spoke-rss-');
  const { discovery } = await projectHub(t, root);
  const spoke = await spawnSpoke({ discover: true, cwd: root, name: 'footprint', role: 'implementer' });
  t.after(() => spoke.close());
  await eventually('native spoke consumes welcome', () => /connected to the hub as footprint/.test(spoke.log()) ? true : undefined);
  await delay(10000); // lint-allow-wall-clock: C2 measures RSS after ten native idle seconds, not a scheduler boundary
  let rssBytes: number | null = null;
  let unavailable: string | null = null;
  try {
    if (process.platform === 'linux') {
      const status = await readFile(`/proc/${spoke.pid}/status`, 'utf8');
      const value = /^VmRSS:\s+(\d+)\s+kB$/m.exec(status);
      if (value) rssBytes = Number(value[1]) * 1024;
    } else {
      const env = fixtureEnvironment(root, scratchGitEnvironment(root, process.env, { excludesFile: join(root, "git-excludes") }));
      const { stdout } = await promisify(execFile)('ps', ['-o', 'rss=', '-p', String(spoke.pid)], { env, cwd: root });
      const value = Number(stdout.trim());
      if (Number.isFinite(value) && value > 0) rssBytes = value * 1024;
    }
  } catch (error) { unavailable = String(error); }
  t.diagnostic(JSON.stringify({ measurement: 'spoke-idle-rss', platform: process.platform, arch: process.arch,
    node: process.version, rssBytes, unavailable, idleMs: 10000, version: discovery.version,
    excludes: 'hub and test runner; no tools/list or tools/call before sample' }));
  assert.match(spoke.log(), /connected to the hub as footprint/);
  await spoke.close();
  assert.deepEqual(fixtureProcessCensus(root), [], 'native spoke reaped before root removal');
});
