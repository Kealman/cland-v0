import { fixtureEnvironment } from './fixture-environment.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncBuiltinESMExports } from 'node:module';
import { acquireLockAsync, processStartedAsync } from '../src/hub/lock.ts';
import { sweepOrphans } from '../src/orphans.ts';
import { tempProject } from './harness.ts';

test('the project sweep lock excludes another process and releases for the next sweep', async t => {
  const root = await tempProject(t);
  const path = join(root, '.cland', 'run', 'orphan-sweep.lock');
  await mkdir(join(root, '.cland', 'run'), { recursive: true });
  const lock = await acquireLockAsync(path);
  try {
    const entry = fileURLToPath(new URL('../src/orphans.ts', import.meta.url));
    const doctor = fileURLToPath(new URL('../src/cli/doctor.ts', import.meta.url));
    const source = `import assert from 'node:assert/strict';
import { sweepOrphans } from ${JSON.stringify(entry)};
import { runDoctor } from ${JSON.stringify(doctor)};
await assert.rejects(sweepOrphans(${JSON.stringify(root)}, () => {}), /sweep busy/);
await runDoctor(['--json', '--fix'], ${JSON.stringify(root)}, { ...process.env, PATH: '' });`;
    const { stdout } = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', source], { env: fixtureEnvironment(root, process.env), timeout: 5000 });
    const report = JSON.parse(stdout) as { checks: Array<{ detail: string; fix?: string }> };
    assert.ok(report.checks.some(check => /sweep busy/.test(check.detail) && /wait for the active sweep/.test(check.fix ?? '')));
  } finally { await lock.release(); }
  assert.deepEqual(await sweepOrphans(root, () => {}), []);
  await assert.rejects(access(path), { code: 'ENOENT' });
});

test('a sweep recovers a stale reused-PID lock without touching its live replacement', async t => {
  const root = await tempProject(t);
  const path = join(root, '.cland', 'run', 'orphan-sweep.lock');
  await mkdir(join(root, '.cland', 'run'), { recursive: true });
  const started = await processStartedAsync(process.pid);
  assert.ok(started);
  await writeFile(path, JSON.stringify({ pid: process.pid, started: 'not this process', token: 'stale-fixture' }));
  assert.deepEqual(await sweepOrphans(root, () => {}), []);
  assert.equal(await processStartedAsync(process.pid), started);
  await assert.rejects(access(path), { code: 'ENOENT' });
});

test('a live acquisition guard cannot keep a sweep waiting beyond its shared deadline', async t => {
  const root = await tempProject(t);
  const guard = join(root, '.cland', 'run', 'orphan-sweep.lock.break');
  await mkdir(guard, { recursive: true });
  const started = await processStartedAsync(process.pid);
  assert.ok(started);
  await writeFile(join(guard, 'abcdef.owner'), JSON.stringify({ pid: process.pid, started }));
  const before = Date.now();
  await assert.rejects(sweepOrphans(root, () => {}, 'harness', { deadline: Date.now() + 100 }), /deadline/);
  assert.ok(Date.now() - before < 1000, 'guard contention uses the sweep deadline');
});

test('directory removal during sweep lock acquisition is skipped, while intact directories retain ENOENT', async t => {
  const fs = (await import('node:fs/promises')).default;
  const originalMkdir = fs.mkdir;
  for (const removed of ['root', '.cland', '.cland/run', null]) {
    const root = await tempProject(t);
    const entries: Array<Record<string, unknown>> = [];
    const failure = Object.assign(new Error('guard fixture disappeared'), { code: 'ENOENT' });
    const mocked = t.mock.method(fs, 'mkdir', async (...args: Parameters<typeof originalMkdir>) => {
      if (String(args[0]).includes('orphan-sweep.lock.break.')) {
        if (removed) {
          await fs.rm(removed === 'root' ? root : join(root, removed), { recursive: true });
          return originalMkdir(...args); // the real guard mkdir sees its vanished parent
        }
        throw failure;
      }
      return originalMkdir(...args);
    });
    syncBuiltinESMExports();
    try {
      if (removed) {
        assert.deepEqual(await sweepOrphans(root, entry => entries.push(entry)), []);
        await assert.rejects(fs.stat(removed === 'root' ? root : join(root, removed)), { code: 'ENOENT' });
        if (removed !== 'root') assert.ok(await fs.stat(root), 'project root remains during partial deletion');
        assert.ok(entries.some(entry => entry.event === 'orphan-sweep-skipped' && entry.reason === 'project-removed'));
      } else {
        await assert.rejects(sweepOrphans(root, entry => entries.push(entry)), err => err === failure);
        assert.ok(await fs.stat(root));
        assert.equal(entries.some(entry => entry.event === 'orphan-sweep-skipped'), false);
      }
    } finally { mocked.mock.restore(); syncBuiltinESMExports(); }
  }
});
