// T3: package worker exit, crash and load-repetition lifecycle receipts keep
// quarantine distinct from infrastructure failures across real Node processes.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { type TestContext } from 'node:test';
import { ownDirectory, ownProcess } from './process-cleanup.ts';
import { suiteSummary } from '../src/hub/suites.ts';
import { failingTests } from '../src/hub/shared-defects.ts';
import { lintHubShards, lintHubShardTree } from '../src/suite-shards.ts';

const exec = promisify(execFile);
const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
async function fixture(t: TestContext, source: string, loadGate = false) {
  const cwd = await mkdtemp(join(tmpdir(), 'cland-quarantine-'));
  ownDirectory(t, cwd);
  await mkdir(join(cwd, 'hub/test'), { recursive: true });
  await writeFile(join(cwd, 'hub/test/fixture.test.ts'), source);
  const added = new Date().toISOString().slice(0, 10);
  const expires = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  await writeFile(join(cwd, 'hub/test/quarantine.json'), JSON.stringify({ version: 1, tests: {
    'hub/test/fixture.test.ts::known flake': { owner: 'T-657', reason: 'Planted regression fixture.', added, expires },
  } }));
  if (loadGate) await writeFile(join(cwd, 'hub/test/durations.json'), JSON.stringify({ version: 1, budget: { testSeconds: 5, fileSeconds: 60 }, tests: {}, files: {}, allow: {} }));
  const code = `import { runSuite } from ${JSON.stringify(runner)}; process.exitCode = await runSuite([['--test', 'hub/test/fixture.test.ts']], ${JSON.stringify({ cwd, force: true, selection: { mode: 'hub-only', files: [], reason: 'fixture', loadGate } })});`;
  const child = exec(process.execPath, ['--input-type=module', '-e', code], { cwd });
  ownProcess(t, child.child.pid);
  return child.then(r => ({ code: 0, output: r.stdout + r.stderr }), (e: { code: number; stdout: string; stderr: string }) => ({ code: e.code, output: e.stdout + e.stderr }));
}

test('a quarantined failure still runs, reports separately and leaves the run green', async t => {
  const result = await fixture(t, `import test from 'node:test'; test('known flake', () => { throw new Error('planted failure'); });`);
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /planted failure/);
  const summary = suiteSummary(result.output);
  assert.match(summary, /Quarantine:\nquarantine fail hub\/test\/fixture.test.ts::known flake/);
  assert.doesNotMatch(summary, /Failures:/);
  assert.deepEqual(failingTests(result.output), []);
});

test('a quarantined pass is reported and an ordinary failure remains red', async t => {
  const result = await fixture(t, `import test from 'node:test'; test('known flake', () => {}); test('ordinary failure', () => { throw new Error('ordinary failure'); });`);
  assert.equal(result.code, 1, result.output);
  const summary = suiteSummary(result.output);
  assert.match(summary, /quarantine pass hub\/test\/fixture.test.ts::known flake/);
  assert.match(summary, /Failures:\n.*ordinary failure/);
  assert.deepEqual(failingTests(result.output), ['hub/test/fixture.test.ts::ordinary failure']);
});

test('task load repetitions run quarantined tests without making their known failure red', async t => {
  const result = await fixture(t, `import test from 'node:test'; test('known flake', () => { throw new Error('planted failure'); });`, true);
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /quarantine load gate: hub\/test\/fixture.test.ts::known flake 0\/5 passed; 5\/5 quarantined failures/);
  assert.doesNotMatch(suiteSummary(result.output), /Failures:/);
});

test('a process crash remains red even after a quarantined test failed', async t => {
  const result = await fixture(t, `import test from 'node:test'; test('known flake', () => { throw new Error('planted failure'); }); test('crash', () => process.exit(3));`);
  assert.equal(result.code, 1, result.output);
  assert.match(suiteSummary(result.output), /Failures:/);
});

test('an admission timeout cannot be quarantined and reports no failed assertion identities', async t => {
  const outcome = new URL('../src/test-admission-outcome.ts', import.meta.url).href;
  const result = await fixture(t, `import {test, before} from 'node:test'; import {AdmissionTimeout} from ${JSON.stringify(outcome)}; before(() => { throw new AdmissionTimeout(15000); }); test('known flake', () => { throw Error('body must not run'); }); test('another registered test', () => { throw Error('body must not run'); });`, true);
  assert.notEqual(result.code, 0, result.output);
  assert.match(result.output, /admission timed out after 15 s: project hub busy; not a test result/);
  assert.doesNotMatch(result.output, /Error: body must not run/);
  assert.match(suiteSummary(result.output), /admission timeouts 11/);
  assert.match(result.output, /load gate admission blocked:/);
  assert.doesNotMatch(suiteSummary(result.output), /Failures:|quarantine fail/);
  assert.deepEqual(failingTests(result.output), []);
});

test('an explicit admission timeout preserves a later assertion failure in the same worker file', async t => {
  const outcome = new URL('../src/test-admission-outcome.ts', import.meta.url).href;
  const result = await fixture(t, `import test from 'node:test'; import {AdmissionTimeout} from ${JSON.stringify(outcome)}; test('known flake', () => { throw new AdmissionTimeout(15000); }); test('ordinary assertion', () => { throw Error('ordinary failure after admission'); });`);
  assert.notEqual(result.code, 0, result.output);
  assert.match(suiteSummary(result.output), /admission timeouts 1/);
  assert.deepEqual(failingTests(result.output), ['hub/test/fixture.test.ts::ordinary assertion']);
  assert.match(suiteSummary(result.output), /Failures:\nhub\/test\/fixture.test.ts::ordinary assertion/);
});

test('a parent admission timeout cannot attach its earlier failed child to a later quarantined pass', async t => {
  const outcome = new URL('../src/test-admission-outcome.ts', import.meta.url).href;
  const result = await fixture(t, `import test from 'node:test'; import {AdmissionTimeout} from ${JSON.stringify(outcome)}; test('admission parent', async t => { await t.test('ordinary child', () => { throw Error('ordinary child failure'); }); throw new AdmissionTimeout(15000); }); test('known flake', () => {});`);
  assert.notEqual(result.code, 0, result.output);
  assert.match(suiteSummary(result.output), /admission timeouts 1/);
  assert.match(suiteSummary(result.output), /quarantine pass/);
  assert.deepEqual(failingTests(result.output), ['hub/test/fixture.test.ts::ordinary child']);
});

test('load repetitions retain ordinary failures beside separate admission attempts', async t => {
  const outcome = new URL('../src/test-admission-outcome.ts', import.meta.url).href;
  const result = await fixture(t, `import test from 'node:test'; import {existsSync, readFileSync, writeFileSync} from 'node:fs'; import {AdmissionTimeout} from ${JSON.stringify(outcome)};
const counter = new URL('./attempts', import.meta.url);
test('mixed repetitions', async t => {
  const attempt = existsSync(counter) ? Number(readFileSync(counter, 'utf8')) : 0;
  writeFileSync(counter, String(attempt + 1));
  if (attempt === 0) return;
  if (attempt === 1) throw new AdmissionTimeout(15000);
  if (attempt === 2) { await t.test('ordinary child', () => { throw Error('nested ordinary repetition failure'); }); throw new AdmissionTimeout(15000); }
  throw Error('ordinary repetition failure');
});`, true);
  assert.notEqual(result.code, 0, result.output);
  assert.match(suiteSummary(result.output), /admission timeouts 2/);
  assert.deepEqual(failingTests(result.output), ['hub/test/fixture.test.ts::mixed repetitions']);
  const failures = result.output.split('\n').filter(line => line.startsWith('load gate failure '));
  assert.equal(failures.length, 4, 'mixed worker and three ordinary workers retain diagnostics');
  assert.match(failures.join('\n'), /nested ordinary repetition failure/);
  assert.match(suiteSummary(result.output), /Failures:\n✖ load gate:.*mixed repetitions 0\/5 passed/);
});

test('quarantine follows the exact file and name and accounts for nested failures in its top-level test', async t => {
  const result = await fixture(t, `import test from 'node:test'; test('known flake', async t => { await t.test('child', () => { throw new Error('nested failure'); }); }); test('known flake suffix', () => { throw new Error('ordinary failure'); });`);
  assert.equal(result.code, 1, result.output);
  const summary = suiteSummary(result.output);
  assert.match(summary, /quarantine fail hub\/test\/fixture.test.ts::known flake/);
  assert.match(summary, /Failures:\nhub\/test\/fixture.test.ts::known flake suffix/);
  assert.deepEqual(failingTests(result.output), ['hub/test/fixture.test.ts::known flake suffix']);
});

test('working-tree and immutable-tree admission reject invalid quarantine even without a shard manifest', async t => {
  const cwd = await mkdtemp(join(tmpdir(), 'cland-quarantine-admission-'));
  ownDirectory(t, cwd);
  await mkdir(join(cwd, 'hub/test'), { recursive: true });
  const path = join(cwd, 'hub/test/quarantine.json');
  const entry = { owner: 'T-657', reason: 'Planted expiry.', added: '2020-01-01', expires: '2020-01-08' };
  const manifest = { version: 1, tests: { 'hub/test/fixture.test.ts::known flake': entry } };
  await writeFile(path, JSON.stringify(manifest));
  await assert.rejects(lintHubShards(cwd), /expired quarantine: hub\/test\/fixture.test.ts::known flake/);
  const git = async (...args: string[]) => exec('git', args, { cwd });
  await git('init', '--initial-branch=dev');
  await git('config', 'user.name', 'Quarantine test');
  await git('config', 'user.email', 'quarantine@example.invalid');
  await git('add', '.'); await git('commit', '-m', 'expired quarantine');
  await assert.rejects(lintHubShardTree(cwd, 'HEAD'), /expired quarantine: hub\/test\/fixture.test.ts::known flake/);
  await writeFile(path, JSON.stringify({ ...manifest, tests: { 'hub/test/fixture.test.ts::known flake': { ...entry, owner: '' } } }));
  await assert.rejects(lintHubShards(cwd), /owner ticket: hub\/test\/fixture.test.ts::known flake/);
});
