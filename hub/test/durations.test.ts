import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { ownDirectory } from './process-cleanup.ts';

const exec = promisify(execFile);
const generator = fileURLToPath(new URL('./durations.ts', import.meta.url));
test('refresh takes per-test medians, sums file test-time, preserves reasons and removes deleted tests', async t => {
  const cwd = await mkdtemp(join(tmpdir(), 'cland-durations-'));
  ownDirectory(t, cwd);
  await mkdir(join(cwd, 'hub/test'), { recursive: true });
  const manifest = join(cwd, 'hub/test/durations.json');
  await writeFile(manifest, JSON.stringify({ version: 1, source: { artifacts: [], commit: 'old' }, budget: { testSeconds: 5, fileSeconds: 60 }, files: {}, tests: {}, allow: {
    'hub/test/one.test.ts::slow': { seconds: 6, reason: 'Exercises remote teardown through real processes.' },
    'hub/test/deleted.test.ts::gone': { seconds: 9, reason: 'Deleted.' },
  } }));
  const logs = [];
  for (const [index, seconds] of [6, 12, 9].entries()) {
    const log = join(cwd, `A-${index + 1}-green.log`);
    logs.push(log);
    await writeFile(log, `Head abc123\nsuite phase hub machine; locks held []\n` + [
      { file: 'hub/test/one.test.ts', name: 'slow', seconds },
      { file: 'hub/test/one.test.ts', name: 'new', seconds: 7 },
      { file: 'nvim/test/two.test.ts', name: 'fast', seconds: 1 },
    ].map(record => `suite timing ${JSON.stringify(record)}\n`).join('') + 'Finished: exit 0\n');
  }
  await exec(process.execPath, [generator, 'refresh', ...logs], { cwd });
  const result = JSON.parse(await readFile(manifest, 'utf8'));
  assert.deepEqual(result.source, { artifacts: ['A-1', 'A-2', 'A-3'], commit: 'abc123' });
  assert.deepEqual(result.files, { 'hub/test/one.test.ts': { seconds: 16, tests: 2 }, 'nvim/test/two.test.ts': { seconds: 1, tests: 1 } });
  assert.equal(result.tests['hub/test/one.test.ts::slow'], 9);
  assert.deepEqual(result.allow, {
    'hub/test/one.test.ts::new': { seconds: 7, reason: 'TODO' },
    'hub/test/one.test.ts::slow': { seconds: 9, reason: 'Exercises remote teardown through real processes.' },
  });
});

test('refresh falls back to top-level spec lines with file identities, excluding nested times and retaining skipped files', async t => {
  const cwd = await mkdtemp(join(tmpdir(), 'cland-durations-'));
  ownDirectory(t, cwd);
  await mkdir(join(cwd, 'hub/test'), { recursive: true });
  const log = join(cwd, 'A-4-legacy.log');
  await writeFile(log, `Worktree /old/root
Head old123
suite start {"file":"/old/root/hub/test/one.test.ts","name":"parent"}
  ✔ child (9000ms)
✔ parent (10000ms)
suite start {"file":"/old/root/nvim/test/two.test.ts","name":"skipped"}
﹣ skipped (0.1ms) # missing prerequisite
Finished: exit 0
`);
  await exec(process.execPath, [generator, 'refresh', log], { cwd });
  const result = JSON.parse(await readFile(join(cwd, 'hub/test/durations.json'), 'utf8'));
  assert.deepEqual(result.files, { 'hub/test/one.test.ts': { seconds: 10, tests: 1 }, 'nvim/test/two.test.ts': { seconds: 0.0001, tests: 1 } });
  assert.equal(result.tests['hub/test/one.test.ts::parent'], 10);
  assert.equal(result.tests['hub/test/one.test.ts::child'], undefined);
});

test('below-budget slowdown regressions require both thresholds and the report keeps five; new files still fail', async () => {
  const { checkDurations, durationRegressions } = await import('../src/suite-durations.ts');
  const { logTimings } = await import('./durations.ts');
  const { suiteSummary } = await import('../src/hub/suites.ts');
  const manifest = { version: 1 as const, source: { artifacts: [], commit: 'base' }, budget: { testSeconds: 60, fileSeconds: 60 }, files: {}, tests: {
    'hub/test/one.test.ts::absolute': 0.5, 'hub/test/one.test.ts::relative': 10, 'hub/test/one.test.ts::edge': 2,
    ...Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`hub/test/one.test.ts::r${i}`, 2])),
  }, allow: {} };
  const records = logTimings([
    { file: 'hub/test/one.test.ts', name: 'absolute', seconds: 1.49 },
    { file: 'hub/test/one.test.ts', name: 'relative', seconds: 14.99 },
    { file: 'hub/test/one.test.ts', name: 'edge', seconds: 3 },
    ...Array.from({ length: 6 }, (_, i) => ({ file: 'hub/test/one.test.ts', name: `r${i}`, seconds: 4 + i })),
  ].map(record => `suite timing ${JSON.stringify(record)}`).join('\n'));
  const checked = checkDurations(records, manifest);
  assert.deepEqual(checked.failures, []);
  assert.equal(checked.regressions.some(r => r.key.endsWith('::absolute') || r.key.endsWith('::relative')), false);
  assert.equal(checked.regressions.some(r => r.key.endsWith('::edge')), true, 'equality at 1 s / 50% is included');
  const lines = durationRegressions(checked.regressions);
  assert.equal(lines.length, 5);
  assert.match(lines[0]!, /::r5 2 s → 9 s/);
  const summary = suiteSummary('ℹ tests 9\nℹ pass 9\n' + lines.join('\n') + '\nsuite budget overhead 1.20 ms\n');
  assert.ok(summary.includes(lines.join('\n')));
  assert.match(summary, /suite budget overhead 1.20 ms/);
  const file = checkDurations([{ file: 'hub/test/large.test.ts', name: 'a', seconds: 31 }, { file: 'hub/test/large.test.ts', name: 'b', seconds: 31 }], { ...manifest, allow: {
    'hub/test/large.test.ts::a': { seconds: 31, reason: 'Multi-process lifecycle.' }, 'hub/test/large.test.ts::b': { seconds: 31, reason: 'Restart lifecycle.' },
  } });
  assert.deepEqual(file.failures, ['duration budget: hub/test/large.test.ts 62 s > 60 s (add to hub/test/durations.json with a reason)']);
});

test('TODO allowances are refused by working-tree and immutable-tree shard admission, even without shards', async t => {
  const { lintHubShards, lintHubShardTree } = await import('../src/suite-shards.ts');
  const cwd = await mkdtemp(join(tmpdir(), 'cland-durations-'));
  ownDirectory(t, cwd);
  await mkdir(join(cwd, 'hub/test'), { recursive: true });
  const path = join(cwd, 'hub/test/durations.json');
  const manifest = { version: 1, source: { artifacts: [], commit: 'fixture' }, budget: { testSeconds: 5, fileSeconds: 60 }, files: {}, tests: {}, allow: {
    'hub/test/one.test.ts::slow': { seconds: 6, reason: 'TODO' },
  } };
  await writeFile(path, JSON.stringify(manifest));
  await assert.rejects(lintHubShards(cwd), /duration.*TODO.*hub\/test\/one.test.ts::slow/);
  const git = async (...args: string[]) => (await exec('git', args, { cwd })).stdout.trim();
  await git('init', '--initial-branch=dev');
  await git('config', 'user.name', 'Duration test'); await git('config', 'user.email', 'duration@example.invalid');
  await git('add', '.'); await git('commit', '-m', 'unfinished allowance');
  await assert.rejects(lintHubShardTree(cwd, 'HEAD'), /duration.*TODO/);
  manifest.allow['hub/test/one.test.ts::slow'].reason = 'Real multi-process cancellation and restart.';
  await writeFile(path, JSON.stringify(manifest));
  await lintHubShards(cwd);
  await assert.rejects(lintHubShardTree(cwd, 'HEAD'), /duration.*TODO/, 'working reasons cannot repair an immutable candidate');
  await git('add', '.'); await git('commit', '-m', 'reasoned allowance');
  await lintHubShardTree(cwd, 'HEAD');
});

test('immutable candidate admission uses the owning Git environment for tree and source reads', async t => {
  const { lintHubShardTree } = await import('../src/suite-shards.ts');
  const roots = await Promise.all([0, 1].map(async i => {
    const cwd = await mkdtemp(join(tmpdir(), 'cland-admission-env-'));
    ownDirectory(t, cwd);
    await mkdir(join(cwd, 'hub/test'), { recursive: true });
    await writeFile(join(cwd, 'hub/test/durations.json'), JSON.stringify({ version: 1, source: { artifacts: [], commit: 'fixture' }, budget: { testSeconds: 5, fileSeconds: 60 }, files: {}, tests: {}, allow: {
      'hub/test/one.test.ts::slow': { seconds: 6, reason: i === 0 ? 'TODO' : 'Real process teardown.' },
    } }));
    await exec('git', ['init', '-q'], { cwd });
    await exec('git', ['add', '.'], { cwd });
    await exec('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Owned candidate'], { cwd });
    return cwd;
  }));
  const environments = roots.map(cwd => ({ ...process.env, GIT_DIR: join(cwd, '.git'), GIT_WORK_TREE: cwd }));
  await assert.doesNotReject(lintHubShardTree(roots[0]!, 'HEAD', environments[1]));
  await assert.rejects(lintHubShardTree(roots[1]!, 'HEAD', environments[0]), /duration.*TODO/);
});

test('pre-start-reporter logs map literal and template titles from test sources without guessing ambiguous names', async t => {
  const cwd = await mkdtemp(join(tmpdir(), 'cland-durations-'));
  ownDirectory(t, cwd);
  await mkdir(join(cwd, 'hub/test'), { recursive: true });
  await writeFile(join(cwd, 'hub/test/one.test.ts'), "test('literal title', () => {}); test(`case ${kind} succeeds`, () => {});");
  const log = join(cwd, 'A-5-old.log');
  await writeFile(log, 'Head old123\n✔ literal title (2000ms)\n✔ case alpha succeeds (3000ms)\nFinished: exit 0\n');
  await exec(process.execPath, [generator, 'refresh', log], { cwd });
  const result = JSON.parse(await readFile(join(cwd, 'hub/test/durations.json'), 'utf8'));
  assert.deepEqual(result.files, { 'hub/test/one.test.ts': { seconds: 5, tests: 2 } });
  await writeFile(join(cwd, 'hub/test/two.test.ts'), "test('literal title', () => {});");
  await assert.rejects(exec(process.execPath, [generator, 'refresh', log], { cwd }), /ambiguous legacy test/);
});

for (const path of ['hub/src/suite-durations.ts', 'hub/test/duration-reporter.ts']) {
  test(`${path} changes require both package phases`, async () => {
    const { chooseSuiteMode } = await import('../src/suite-selection.ts');
    assert.equal(chooseSuiteMode([path]), 'full');
  });
}

test('refresh prunes tests absent from the newest log and creates a reason placeholder for over-budget files', async t => {
  const cwd = await mkdtemp(join(tmpdir(), 'cland-durations-'));
  ownDirectory(t, cwd);
  await mkdir(join(cwd, 'hub/test'), { recursive: true });
  const old = join(cwd, 'A-6-old.log'), latest = join(cwd, 'A-7-latest.log');
  const log = (tests: Array<{ file: string; name: string; seconds: number }>) => 'Head latest123\n' + tests.map(record => `suite timing ${JSON.stringify(record)}\n`).join('') + 'Finished: exit 0\n';
  await writeFile(old, log([{ file: 'hub/test/deleted.test.ts', name: 'gone', seconds: 8 }]));
  await writeFile(latest, log([{ file: 'hub/test/large.test.ts', name: 'a', seconds: 31 }, { file: 'hub/test/large.test.ts', name: 'b', seconds: 31 }]));
  await exec(process.execPath, [generator, 'refresh', old, latest], { cwd });
  const result = JSON.parse(await readFile(join(cwd, 'hub/test/durations.json'), 'utf8'));
  assert.equal(result.tests['hub/test/deleted.test.ts::gone'], undefined);
  assert.deepEqual(result.allow['hub/test/large.test.ts'], { file: true, seconds: 62, reason: 'TODO' });
  await writeFile(latest, log([{ file: 'hub/test/large.test.ts', name: 'a', seconds: 31 }]).replace('exit 0', 'exit 1'));
  await assert.rejects(exec(process.execPath, [generator, 'refresh', latest], { cwd }), /not a green integrated log/);
});

test('legacy cross-file equal titles refuse refresh regardless of completion order; explicit records keep both identities', async () => {
  const { logTimings } = await import('./durations.ts');
  const legacy = `Worktree /old/root
suite start {"file":"/old/root/hub/test/a.test.ts","name":"same"}
suite start {"file":"/old/root/hub/test/b.test.ts","name":"same"}
✔ same (1000ms)
✔ same (10000ms)
`;
  assert.throws(() => logTimings(legacy), /ambiguous legacy test: same/);
  const explicit = [
    { file: 'hub/test/b.test.ts', name: 'same', seconds: 1 },
    { file: 'hub/test/a.test.ts', name: 'same', seconds: 10 },
  ];
  assert.deepEqual(logTimings(legacy + explicit.map(record => `suite timing ${JSON.stringify(record)}\n`).join('')), explicit);
});

test('only new exact identities fail budgets; known entries report even inside a known file', async () => {
  const { checkDurations } = await import('../src/suite-durations.ts');
  const manifest = { version: 1 as const, source: { artifacts: [], commit: 'base' }, budget: { testSeconds: 5, fileSeconds: 60 },
    files: { 'hub/test/one.test.ts': { seconds: 6, tests: 1 } }, tests: { 'hub/test/one.test.ts::known': 6 }, allow: {} };
  const checked = checkDurations([{ file: 'hub/test/one.test.ts', name: 'known', seconds: 6.2 }, { file: 'hub/test/one.test.ts', name: 'new', seconds: 6.2 }], manifest);
  assert.deepEqual(checked.failures, ['duration budget: hub/test/one.test.ts::new 6.2 s > 5 s (add to hub/test/durations.json with a reason)']);
  assert.ok(checked.regressions.some(r => r.key === 'hub/test/one.test.ts::known'), 'known over-budget test reports even below the slowdown threshold');
  const file = checkDurations([{ file: 'hub/test/large.test.ts', name: 'known', seconds: 62 }], { ...manifest, files: { 'hub/test/large.test.ts': { seconds: 65, tests: 1 } }, tests: { 'hub/test/large.test.ts::known': 65 } });
  assert.deepEqual(file.failures, []);
  assert.ok(file.regressions.some(r => r.key === 'hub/test/large.test.ts'), 'known over-budget file reports even when faster');
});

test('refresh updates known slow baselines without adding TODOs but a new test inside their file still needs a reason', async t => {
  const cwd = await mkdtemp(join(tmpdir(), 'cland-durations-'));
  ownDirectory(t, cwd);
  await mkdir(join(cwd, 'hub/test'), { recursive: true });
  const path = join(cwd, 'hub/test/durations.json');
  await writeFile(path, JSON.stringify({ version: 1, source: { artifacts: [], commit: 'before' }, budget: { testSeconds: 5, fileSeconds: 10 }, files: { 'hub/test/one.test.ts': { seconds: 1, tests: 1 } }, tests: { 'hub/test/one.test.ts::known': 1 }, allow: {} }));
  const log = join(cwd, 'A-8-green.log');
  await writeFile(log, 'Head after\n' + [{ file: 'hub/test/one.test.ts', name: 'known', seconds: 6.1 }, { file: 'hub/test/one.test.ts', name: 'new', seconds: 6.2 }].map(record => `suite timing ${JSON.stringify(record)}\n`).join('') + 'Finished: exit 0\n');
  await exec(process.execPath, [generator, 'refresh', log], { cwd });
  const result = JSON.parse(await readFile(path, 'utf8'));
  assert.deepEqual(result.files['hub/test/one.test.ts'], { seconds: 12.3, tests: 2 });
  assert.equal(result.tests['hub/test/one.test.ts::known'], 6.1);
  assert.deepEqual(result.allow, { 'hub/test/one.test.ts::new': { seconds: 6.2, reason: 'TODO' } });
});

test('over-budget notices and below-budget slowdowns share five slots ranked by seconds over baseline', async () => {
  const { checkDurations, durationRegressions } = await import('../src/suite-durations.ts');
  const file = 'hub/test/one.test.ts';
  const tests = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`${file}::k${i}`, 6]));
  tests[`${file}::slow`] = 2;
  const manifest = { version: 1 as const, source: { artifacts: [], commit: 'base' }, budget: { testSeconds: 5, fileSeconds: 60 }, files: {}, tests, allow: {} };
  const checked = checkDurations([...Array.from({ length: 6 }, (_, i) => ({ file, name: `k${i}`, seconds: 6.1 + i })), { file, name: 'slow', seconds: 4 }], manifest);
  assert.deepEqual(checked.failures, []);
  const lines = durationRegressions(checked.regressions);
  assert.equal(lines.length, 5);
  assert.match(lines[0]!, /::k5 6 s → 11.1 s \(over budget: 5 s\)/);
  assert.match(lines[4]!, /::slow 2 s → 4 s$/);
  assert.equal(lines.some(line => line.includes('::k0 ') || line.includes('::k1 ')), false);
});
