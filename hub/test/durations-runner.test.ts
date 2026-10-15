// Real Node reporter and runner boundary, with fixture-local admission leases.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { type TestContext } from 'node:test';
import { ownDirectory } from './process-cleanup.ts';

const exec = promisify(execFile);
const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
async function fixture(t: TestContext) {
  const cwd = await mkdtemp(join(tmpdir(), 'cland-duration-runner-'));
  ownDirectory(t, cwd);
  await mkdir(join(cwd, 'hub/test'), { recursive: true });
  const file = join(cwd, 'hub/test/fixture.test.ts');
  await writeFile(file, `import test from 'node:test';
test('parent', async t => { await t.test('child', () => new Promise(r => setTimeout(r, 100))); });
test('skipped', {skip: 'fixture platform'}, () => {});`);
  const run = async () => {
    const code = `import {runSuite} from ${JSON.stringify(runner)}; process.exitCode = await runSuite([['--test', ${JSON.stringify(file)}]], ${JSON.stringify({ cwd, lockDir: join(cwd, 'lock') })});`;
    return await exec(process.execPath, ['--input-type=module', '-e', code], { cwd, env: { ...process.env, NODE_TEST_CONTEXT: '', CLAND_TEST_SKIP_LOCK: '0' } }).then(
      r => ({ code: 0, output: r.stdout + r.stderr }),
      (e: { code: number; stdout: string; stderr: string }) => ({ code: e.code, output: e.stdout + e.stderr }),
    );
  };
  const manifest = { version: 1, source: { artifacts: [], commit: 'fixture' }, budget: { testSeconds: 0.05, fileSeconds: 60 }, files: {}, tests: {}, allow: {} };
  const path = join(cwd, 'hub/test/durations.json');
  return { run, manifest, path };
}

test('runner emits top-level timings, fails test budgets, accepts reasons and disables without a manifest', async t => {
  const { run, manifest, path } = await fixture(t);
  const absent = await run();
  assert.equal(absent.code, 0, absent.output);
  assert.doesNotMatch(absent.output, /suite timing |suite budget overhead/);
  // An existing file never exempts a new test name within that file.
  const withKnownFile = { ...manifest, files: { 'hub/test/fixture.test.ts': { seconds: 0.1, tests: 1 } } };
  await writeFile(path, JSON.stringify(withKnownFile));
  const failed = await run();
  assert.equal(failed.code, 1, failed.output);
  assert.match(failed.output, /duration budget: hub\/test\/fixture.test.ts::parent .* > 0.05 s/);
  const timings = failed.output.split('\n').filter(line => line.startsWith('suite timing ')).map(line => JSON.parse(line.slice('suite timing '.length)));
  assert.deepEqual(timings.map(record => record.name), ['parent', 'skipped']);
  assert.ok(timings[0].seconds >= 0.1);
  assert.equal(timings[0].file, 'hub/test/fixture.test.ts');
  assert.match(failed.output, /suite budget overhead [\d.]+ ms/);
  assert.doesNotMatch(failed.output, /MaxListenersExceededWarning/, 'the extra reporter does not produce a spurious listener warning');
  const allowed = { ...withKnownFile, allow: { 'hub/test/fixture.test.ts::parent': { seconds: 0.1, reason: 'Real nested reporter fixture.' } } };
  await writeFile(path, JSON.stringify(allowed));
  const passed = await run();
  assert.equal(passed.code, 0, passed.output);
  assert.doesNotMatch(passed.output, /duration budget:/);
  assert.match(passed.output, /duration regression hub\/test\/fixture.test.ts::parent .*over budget/);
});

test('runner sums file test-time and requires a separate reasoned file allowance', async t => {
  const { run, manifest, path } = await fixture(t);
  const allowed = manifest;
  await writeFile(path, JSON.stringify({ ...allowed, budget: { testSeconds: 5, fileSeconds: 0.05 } }));
  const fileFailed = await run();
  assert.equal(fileFailed.code, 1, fileFailed.output);
  assert.match(fileFailed.output, /duration budget: hub\/test\/fixture.test.ts [\d.]+ s > 0.05 s/);
  await writeFile(path, JSON.stringify({ ...allowed, allow: { ...allowed.allow, 'hub/test/fixture.test.ts': { file: true, seconds: 0.1, reason: 'Real nested reporter fixture file.' } }, budget: { testSeconds: 5, fileSeconds: 0.05 } }));
  const filePassed = await run();
  assert.equal(filePassed.code, 0, filePassed.output);
  assert.doesNotMatch(filePassed.output, /duration budget:/);
});

test('a known over-budget test reports without an allowance or failure', async t => {
  const { run, manifest, path } = await fixture(t);
  await writeFile(path, JSON.stringify({ ...manifest, tests: { 'hub/test/fixture.test.ts::parent': 0.1 } }));
  const result = await run();
  assert.equal(result.code, 0, result.output);
  assert.doesNotMatch(result.output, /duration budget:/);
  assert.match(result.output, /duration regression hub\/test\/fixture.test.ts::parent .*\(over budget: 0.05 s\)/);
});

test('a known over-budget file reports without an allowance or failure', async t => {
  const { run, manifest, path } = await fixture(t);
  await writeFile(path, JSON.stringify({ ...manifest, budget: { testSeconds: 5, fileSeconds: 0.05 }, files: { 'hub/test/fixture.test.ts': { seconds: 0.2, tests: 2 } } }));
  const result = await run();
  assert.equal(result.code, 0, result.output);
  assert.doesNotMatch(result.output, /duration budget:/);
  assert.match(result.output, /duration regression hub\/test\/fixture.test.ts [\d.]+ s → [\d.]+ s \(over budget: 0.05 s\)/);
});
