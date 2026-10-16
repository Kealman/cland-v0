// Real Node reporter and runner boundary, with fixture-local admission leases.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { type TestContext } from 'node:test';
import { ownDirectory, ownProcess, pause } from './process-cleanup.ts';

const exec = promisify(execFile);
const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
async function fixture(t: TestContext, packageRun = false) {
  const cwd = await mkdtemp(join(tmpdir(), 'cland-duration-runner-'));
  ownDirectory(t, cwd);
  await mkdir(join(cwd, 'hub/test'), { recursive: true });
  const file = join(cwd, 'hub/test/fixture.test.ts');
  await writeFile(file, `import test from 'node:test';
test('parent', async t => { await t.test('child', () => new Promise(r => setTimeout(r, 100))); });
test('skipped', {skip: 'fixture platform'}, () => {});`);
  if (packageRun) {
    await writeFile(join(cwd, 'hub/test/shards.json'), JSON.stringify({ version: 1, tests: { 'hub/test/fixture.test.ts': 'machine' } }));
    await mkdir(join(cwd, 'nvim/test'), { recursive: true });
    for (const name of ['client', 'sessions']) await writeFile(join(cwd, `nvim/test/${name}.test.ts`), '// empty cross-package smoke fixture\n');
  }
  const start = (loadGate = false) => {
    const selection = { mode: 'hub-only', files: ['hub/test/fixture.test.ts'], reason: 'fixture task selection from hub', loadGate };
    const code = packageRun
      ? `import {runPackageSuite} from ${JSON.stringify(runner)}; process.exitCode = await runPackageSuite('auto', [], ${JSON.stringify({ cwd, lockDirs: { hub: join(cwd, 'lock'), nvim: join(cwd, 'nvim-lock') } })});`
      : `import {runSuite} from ${JSON.stringify(runner)}; process.exitCode = await runSuite([['--test', ${JSON.stringify(file)}]], ${JSON.stringify({ cwd, lockDir: join(cwd, 'lock'), selection })});`;
    const execution = exec(process.execPath, ['--input-type=module', '-e', code], { cwd, env: { ...process.env, NODE_TEST_CONTEXT: '', CLAND_TEST_SKIP_LOCK: '0', CLAND_SUITE_SELECTION: JSON.stringify(selection) } });
    ownProcess(t, execution.child.pid);
    const result = execution.then(
      r => ({ code: 0, output: r.stdout + r.stderr }),
      (e: { code: number; stdout: string; stderr: string }) => ({ code: e.code, output: e.stdout + e.stderr }),
    );
    return { child: execution.child, result };
  };
  const run = (loadGate = false) => start(loadGate).result;
  const manifest = { version: 1, source: { artifacts: [], commit: 'fixture' }, budget: { testSeconds: 0.05, fileSeconds: 60 }, files: {}, tests: {}, allow: {} };
  const path = join(cwd, 'hub/test/durations.json');
  return { run, start, manifest, path, cwd, file };
}

test('task load gate catches a one-in-three flake and repeats a stable new name five times alongside the phase', async t => {
  const { run, manifest, path, cwd, file } = await fixture(t, true);
  const journal = join(cwd, 'journal');
  await writeFile(file, `import test from 'node:test'; import assert from 'node:assert/strict'; import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
const journal = ${JSON.stringify(journal)};
test('stable [new].*', () => appendFileSync(journal, 'stable\\n'));
test('flaky', () => { const count = Number(readFileSync(journal, 'utf8').split('flaky').length); appendFileSync(journal, 'flaky\\n'); assert.notEqual(count % 3, 0); });
test('known load', async () => { writeFileSync(journal + '.running', 'yes'); const deadline = Date.now() + 3000; while (readFileSync(journal, 'utf8').split('stable').length < 3 && Date.now() < deadline) await new Promise(r => setTimeout(r, 20)); appendFileSync(journal, 'load done\\n'); });`);
  // An allowance grants duration, not admission past the new-test load gate.
  await writeFile(path, JSON.stringify({ ...manifest, budget: { testSeconds: 5, fileSeconds: 60 }, tests: { 'hub/test/fixture.test.ts::known load': 3 }, allow: { 'hub/test/fixture.test.ts::stable [new].*': { seconds: 0.01, reason: 'Fixture allowance is not a refreshed baseline.' } } }));
  const result = await run(true);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /load gate: hub\/test\/fixture.test.ts::stable \[new\]\.\* 5\/5 passed/);
  assert.match(result.output, /✖ load gate: hub\/test\/fixture.test.ts::flaky [0-4]\/5 passed/);
  assert.match(result.output, /suite duration .*load gate extra wall [\d.]+s/);
  const { suiteSummary } = await import('../src/hub/suites.ts');
  const summary = suiteSummary(result.output);
  assert.match(summary, /load gate: hub\/test\/fixture.test.ts::flaky [0-4]\/5 passed/);
  assert.match(summary, /load gate extra wall [\d.]+s/);
  const entries = (await readFile(journal, 'utf8')).trim().split('\n');
  assert.equal(entries.filter(line => line === 'stable').length, 6);
  assert.equal(entries.filter(line => line === 'flaky').length, 6);
  assert.equal(entries.filter(line => line === 'load done').length, 1);
  assert.ok(entries.indexOf('load done') > entries.indexOf('stable', entries.indexOf('stable') + 1), 'a repetition ran before the ordinary phase finished');
});

test('task load gate bounds eight new tests with parallel lanes and five sequential repetitions each', { timeout: process.env.CLAND_LOAD_GATE_SLOW_PROBE === '1' ? 600_000 : 30_000 }, async t => {
  const { run, manifest, path, cwd, file } = await fixture(t, true);
  // The optional slow probe measures T-557's eight-by-20-second acceptance case
  // through the same package boundary; ordinary regression runs stay short.
  const seconds = process.env.CLAND_LOAD_GATE_SLOW_PROBE === '1' ? 20 : 0.1;
  const journal = join(cwd, 'parallel-journal');
  await writeFile(file, `import test from 'node:test'; import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
const phase = ${JSON.stringify(journal + '.phase')};
const ordinary = !existsSync(phase);
if (ordinary) writeFileSync(phase, 'started');
for (let identity = 0; identity < 8; identity++) test('new ' + identity, async () => {
  appendFileSync(${JSON.stringify(journal)}, JSON.stringify({ identity, pid: process.pid, state: 'start' }) + '\\n');
  if (!ordinary && identity < 2) {
    // Hold the first two identities until both lanes have started. This proves
    // overlap independently of ordinary-phase duration or process startup speed.
    writeFileSync(${JSON.stringify(journal)} + '.ready-' + identity, 'ready');
    const peer = ${JSON.stringify(journal)} + '.ready-' + (1 - identity);
    const deadline = Date.now() + 15000;
    while (!existsSync(peer) && Date.now() < deadline) await new Promise(r => setTimeout(r, 20));
    if (!existsSync(peer)) throw new Error('second repetition lane did not reach the barrier');
  }
  await new Promise(r => setTimeout(r, ${seconds * 1000}));
  appendFileSync(${JSON.stringify(journal)}, JSON.stringify({ identity, pid: process.pid, state: 'done' }) + '\\n');
});`);
  await writeFile(path, JSON.stringify({ ...manifest, budget: { testSeconds: 30, fileSeconds: 200 } }));
  const result = await run(true);
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /load gate workers 2;/);
  const { suiteSummary } = await import('../src/hub/suites.ts');
  assert.match(suiteSummary(result.output), /load gate workers 2;/);
  const extraWall = Number(result.output.match(/load gate extra wall ([\d.]+)s/)?.[1]);
  assert.ok(extraWall < 300, result.output);
  t.diagnostic(`eight new tests, ${seconds}s each; ${result.output.split('\n').find(line => line.startsWith('suite duration '))}`);
  const entries = (await readFile(journal, 'utf8')).trim().split('\n').map(line => JSON.parse(line) as { identity: number; pid: number; state: string });
  const phasePid = entries.find(entry => entries.some(other => other.pid === entry.pid && other.identity !== entry.identity))!.pid;
  let active = 0;
  let peak = 0;
  let activeRepetitions = 0;
  let peakRepetitions = 0;
  const activeByIdentity = new Map<number, number>();
  for (const entry of entries) {
    active += entry.state === 'start' ? 1 : -1;
    peak = Math.max(peak, active);
    if (entry.pid !== phasePid) {
      activeRepetitions += entry.state === 'start' ? 1 : -1;
      peakRepetitions = Math.max(peakRepetitions, activeRepetitions);
      const count = (activeByIdentity.get(entry.identity) ?? 0) + (entry.state === 'start' ? 1 : -1);
      activeByIdentity.set(entry.identity, count);
      assert.ok(count <= 1, 'repetitions of one identity stay sequential');
    }
  }
  assert.equal(peakRepetitions, 2, 'both repetition lanes overlap independently of the ordinary phase');
  assert.equal(activeRepetitions, 0);
  assert.ok(peak <= 3, `at most two repetition lanes plus ordinary phase, observed ${peak}`);
  assert.equal(active, 0);
  for (let identity = 0; identity < 8; identity++) {
    assert.equal(entries.filter(entry => entry.identity === identity && entry.state === 'done').length, 6);
    assert.equal(new Set(entries.filter(entry => entry.identity === identity).map(entry => entry.pid)).size, 6, 'ordinary phase and five fresh processes');
    assert.ok(result.output.includes(`load gate: hub/test/fixture.test.ts::new ${identity} 5/5 passed`), result.output);
  }
});

test('task load gate honors a configured single lane', async t => {
  const { run, manifest, path, cwd, file } = await fixture(t);
  await mkdir(join(cwd, '.cland'));
  await writeFile(join(cwd, '.cland/config.toml'), '[verification]\nload_gate_workers=1\n');
  await writeFile(file, `import test from 'node:test'; test('new', () => {});`);
  await writeFile(path, JSON.stringify(manifest));
  const result = await run(true);
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /load gate workers 1;/);
  assert.match(result.output, /load gate: hub\/test\/fixture.test.ts::new 5\/5 passed/);
});

test('task load gate leaves known tests alone and integrated runs add no repetitions', async t => {
  const { run, manifest, path, cwd, file } = await fixture(t);
  const journal = join(cwd, 'journal');
  await writeFile(file, `import test from 'node:test'; import { appendFileSync } from 'node:fs'; test('known', () => appendFileSync(${JSON.stringify(journal)}, 'ran\\n'));`);
  await writeFile(path, JSON.stringify({ ...manifest, tests: { 'hub/test/fixture.test.ts::known': 0.01 } }));
  const task = await run(true);
  assert.equal(task.code, 0, task.output);
  assert.doesNotMatch(task.output, /load gate start:/);
  await writeFile(path, JSON.stringify(manifest));
  const integrated = await run();
  assert.equal(integrated.code, 0, integrated.output);
  assert.doesNotMatch(integrated.output, /load gate/);
  assert.equal(await readFile(journal, 'utf8'), 'ran\nran\n');
});

for (const kind of ['static', 'runtime']) {
  test(`a ${kind} prerequisite-skipped new test is reported as skipped, not load-gated`, async t => {
    const { run, manifest, path, file } = await fixture(t);
    await writeFile(file, kind === 'static'
      ? `import test from 'node:test'; test('requires binary', {skip: 'fixture binary unavailable'}, () => {});`
      : `import test from 'node:test'; test('requires binary', t => t.skip('fixture binary unavailable'));`);
    await writeFile(path, JSON.stringify(manifest));
    const result = await run(true);
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /load gate: hub\/test\/fixture.test.ts::requires binary skipped, not load-gated; 5\/5 skipped; reasons: \["fixture binary unavailable"\]/);
    assert.doesNotMatch(result.output, /requires binary 5\/5 passed/);
    const { suiteSummary } = await import('../src/hub/suites.ts');
    assert.match(suiteSummary(result.output), /requires binary skipped, not load-gated/);
  });
}

test('a skipped new test cannot satisfy the load gate with a green process exit', async t => {
  const { run, manifest, path, file } = await fixture(t);
  await writeFile(file, `import test from 'node:test'; test('not executed', {skip: true}, () => {});`);
  await writeFile(path, JSON.stringify(manifest));
  const result = await run(true);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /✖ load gate: hub\/test\/fixture.test.ts::not executed 0\/5 passed/);
});

for (const scenario of [
  { name: 'a whitespace skip reason', options: { skip: '  ' } },
  { name: 'a TODO', options: { todo: 'not implemented' } },
]) {
  test(`the load gate rejects ${scenario.name}`, async t => {
    const { run, manifest, path, file } = await fixture(t);
    await writeFile(file, `import test from 'node:test'; test('not executed', ${JSON.stringify(scenario.options)}, () => {});`);
    await writeFile(path, JSON.stringify(manifest));
    const result = await run(true);
    assert.equal(result.code, 1, result.output);
    assert.match(result.output, /✖ load gate: hub\/test\/fixture.test.ts::not executed 0\/5 passed/);
    assert.doesNotMatch(result.output, /skipped, not load-gated/);
  });
}

for (const outcome of ['pass', 'fail']) {
  test(`the load gate rejects reasoned skips mixed with ${outcome} receipts`, async t => {
    const { run, manifest, path, file, cwd } = await fixture(t);
    const journal = join(cwd, 'attempts');
    await writeFile(file, `import test from 'node:test'; import assert from 'node:assert/strict'; import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const journal = ${JSON.stringify(journal)};
test('mixed prerequisite', t => { const attempt = existsSync(journal) ? Number(readFileSync(journal, 'utf8')) : 0; writeFileSync(journal, String(attempt + 1));
if (attempt % 2 === 0) t.skip('fixture prerequisite absent'); else if (${JSON.stringify(outcome)} === 'fail') assert.fail('fixture failure'); });`);
    await writeFile(path, JSON.stringify(manifest));
    const result = await run(true);
    assert.equal(result.code, 1, result.output);
    assert.match(result.output, /✖ load gate: hub\/test\/fixture.test.ts::mixed prerequisite [0-4]\/5 passed/);
    assert.doesNotMatch(result.output, /skipped, not load-gated/);
    assert.equal(await readFile(journal, 'utf8'), '6', 'ordinary phase and all five gated repetitions ran');
  });
}

for (const signal of ['SIGTERM', 'SIGKILL'] as const) {
  test(`${signal} during a load repetition reaps it before removing the phase root`, { timeout: 10_000 }, async t => {
    const { run, start, manifest, path, cwd, file } = await fixture(t);
    const marker = join(cwd, 'repeat.json');
    await writeFile(file, `import test from 'node:test'; import { existsSync, writeFileSync } from 'node:fs';
for (let identity = 0; identity < 2; identity++) test('held repetition ' + identity, async () => {
const marker = ${JSON.stringify(marker)} + identity;
if (!existsSync(marker + '.first')) { writeFileSync(marker + '.first', 'yes'); return; }
writeFileSync(marker, JSON.stringify({pid: process.pid, root: process.env.TMPDIR})); await new Promise(r => setTimeout(r, 60000)); });`);
    await writeFile(path, JSON.stringify(manifest));
    const suite = start(true);
    const until = async (condition: () => Promise<boolean> | boolean) => {
      const deadline = Date.now() + 4000;
      while (!await condition() && Date.now() < deadline) await pause(20);
      assert.ok(await condition(), 'bounded lifecycle observation');
    };
    await until(async () => (await Promise.all([0, 1].map(identity => readFile(marker + identity, 'utf8').catch(() => '')))).every(Boolean));
    const repeated = await Promise.all([0, 1].map(async identity => JSON.parse(await readFile(marker + identity, 'utf8')) as { pid: number; root: string }));
    for (const worker of repeated) ownProcess(t, worker.pid);
    const exited = new Promise<void>(resolve => suite.child.once('exit', () => resolve()));
    suite.child.kill(signal);
    await exited;
    if (signal === 'SIGTERM') {
      const stopped = await suite.result;
      assert.equal(stopped.code, 143, stopped.output);
    }
    else {
      await writeFile(file, `import test from 'node:test'; test('successor', () => {});`);
      const successor = await run();
      assert.equal(successor.code, 0, successor.output);
      assert.match(successor.output, /taking over stale suite lock/);
    }
    await suite.result;
    const gone = () => repeated.every(worker => { try { process.kill(worker.pid, 0); return false; } catch (error) { return (error as NodeJS.ErrnoException).code === 'ESRCH'; } });
    await until(gone);
    assert.ok(gone(), 'both exact repeat workers are gone');
    assert.equal(await stat(repeated[0]!.root).catch(error => { if (error.code === 'ENOENT') return null; throw error; }), null);
  });
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
