// T3: the real verify CLI reads a native Git candidate and previews admission without starting an executor.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, connectUi, eventually, nativeProjectHub as projectHub, tempProject } from './harness.ts';
import { packageShards, serializeTierManifest } from '../src/suite-shards.ts';
import { planTierReport, tierPlanWorkers, tierReport, type SuiteDryRun } from '../src/suite-tier-report.ts';
import { lintTests, testLintReport } from '../src/test-lint.ts';
import { Store } from '../src/hub/store.ts';
import { Suites, suiteSummary, type SuiteJob } from '../src/hub/suites.ts';
import { onCleanup, beforeDirectories } from './process-cleanup.ts';
import { rememberProject } from '../src/executor/droplet/spend.ts';
import { fakeDigitalOcean } from './fakes/digitalocean/fake-api.ts';
import type { HubStatus, VerificationQueue } from '../src/protocol.ts';

async function planted(t: TestContext) {
  const root = await tempProject(t, 'cland-tier-report-');
  const tests = { 'hub/test/a.test.ts': 'T1', 'hub/test/b.test.ts': 'T2', 'hub/test/c.test.ts': 'T3', 'nvim/test/editor.test.ts': 'T4' } as const;
  for (const path of Object.keys(tests)) {
    await mkdir(join(root, path, '..'), { recursive: true });
    await writeFile(join(root, path), '');
  }
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, 'hub/test/b.test.ts'), 'sleep(10);');
  await writeFile(join(root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests }));
  await writeFile(join(root, 'hub/test/durations.json'), JSON.stringify({ version: 1, source: { artifacts: [], commit: 'planted' }, budget: { testSeconds: 5, fileSeconds: 60 }, tests: {}, allow: {}, files: {
    'hub/test/a.test.ts': { seconds: 200, tests: 2 }, 'hub/test/b.test.ts': { seconds: 300, tests: 3 },
    'hub/test/c.test.ts': { seconds: 400, tests: 4 }, 'nvim/test/editor.test.ts': { seconds: 100, tests: 1 },
  } }));
  return root;
}

test('CLI dry-run prints admission and planned tiers without queueing or reserving spend', async t => {
  const root = await planted(t);
  const api = await fakeDigitalOcean('dry-run-fixture');
  onCleanup(t, () => api.close());
  const spend = join(root, '.cland/executor-state/spend.json');
  // Settle startup bookkeeping before taking the byte-for-byte spend baseline.
  await rememberProject(root, { CLAND_EXECUTOR_STATE: join(root, '.cland/executor-state') });
  await writeFile(join(root, '.gitignore'), '.cland/\n');
  const git = async (...args: string[]) => promisify(execFile)('git', args, { cwd: root });
  await git('init', '-qb', 'dev');
  await git('config', 'user.name', 'Tier fixture'); await git('config', 'user.email', 'fixture@example.invalid');
  await git('add', '.'); await git('commit', '-qm', 'planted baseline');
  await writeFile(join(root, '.cland/config.toml'), '[verification]\nworkers=2\n[verification.droplet]\nsize="c-8"\nregions=["lon1"]\n');
  const { discovery } = await projectHub(t, root, { DIGITALOCEAN_TOKEN: 'dry-run-fixture', CLAND_DIGITALOCEAN_API: api.url });
  const ui = await connectUi(t, discovery);
  const before = (await ui.request({ type: 'hub.status' })).value as HubStatus;
  const beforeSpend = await readFile(spend, 'utf8').catch(() => null);
  const output = await cland(root, 'verify', '--dry-run', '--executor', 'droplet');
  assert.equal(output.code, 0, output.stderr);
  assert.match(output.stdout, /verification dry-run/);
  assert.match(output.stdout, /test lint \(report only\): 2 findings in 2 files/);
  assert.match(output.stdout, /test lint tier: hub\/test\/b.test.ts: T2; qualifies T2/);
  assert.match(output.stdout, /mode full; .*deciding files/s);
  assert.match(output.stdout, /^planned tiers: T1, T2, T3$/m);
  assert.doesNotMatch(output.stdout, /^tier T4:/m);
  assert.match(output.stdout, /tier T1: files 1; tests 2 planned; observed unavailable; projected wall 200 s at 1 workers; wall budget 120 s; over wall \(report only\)/);
  assert.match(output.stdout, /tier share: T1\+T2 55.556 % of 900 s \(T3 400 s, T4 0 s\)/);
  const priority = ['tier T1:', 'tier T2:', 'tier T3:', 'tier share:',
    'test lint (report only):', 'budget legacy allowances:', 'test lint finding:', 'test lint tier:'];
  let previous = -1;
  for (const line of priority) {
    const at = output.stdout.indexOf(line);
    assert.ok(at > previous, `missing or out of order: ${line}\n${output.stdout}`);
    previous = at;
  }
  // MCP uses this same suite.start request and receives the structured report.
  const frame = await ui.request({ type: 'suite.start', dryRun: true, mode: 'auto', cwd: root, executor: 'droplet' });
  assert.equal(frame.ok, true, frame.error);
  const report = frame.value as SuiteDryRun;
  assert.equal(report.dryRun, true);
  assert.deepEqual(report.tiers.map(row => row.tier), ['T1', 'T2', 'T3']);
  assert.deepEqual(((await ui.request({ type: 'hub.status' })).value as HubStatus).suites, before.suites);
  const queue = (await ui.request({ type: 'suite.queue' })).value as VerificationQueue;
  assert.deepEqual(queue.waiters, []); assert.deepEqual(queue.remote, []); assert.equal(queue.holder, null);
  assert.deepEqual(await readdir(join(root, '.cland/run/suites')).catch(() => []), []);
  assert.deepEqual(await readdir(join(root, '.cland/run/executor/leases')).catch(() => []), []);
  assert.equal(await readFile(spend, 'utf8').catch(() => null), beforeSpend);
  assert.ok(api.requests.every(row => row.method === 'GET'), 'dry-run makes no provider mutations');
  assert.deepEqual(api.droplets, []);
  // The same admission lint still refuses an invalid working manifest.
  await writeFile(join(root, 'hub/test/tiers.json'), '{');
  const refusal = await cland(root, 'verify', '--dry-run');
  assert.notEqual(refusal.code, 0); assert.match(refusal.stderr, /verify-tiers/);
});

test('a task run report keeps its green exit when planted tiers exceed the wall budget', async t => {
  const root = await planted(t);
  const selection = { mode: 'full', files: [], reason: 'task report fixture' } as const;
  const plan = await planTierReport(root, { ...selection, files: [] }, 2);
  const store = new Store(join(root, 'hub.db'));
  const log = join(root, 'suite.log');
  const lint = testLintReport(await lintTests(root)).join('\n') + '\n';
  await writeFile(log, lint + '# tests 2\n# pass 2\nsuite timing {"file":"hub/test/a.test.ts","name":"first","seconds":0.25}\nsuite timing {"file":"hub/test/b.test.ts","name":"second","seconds":0.5}\n');
  const job: SuiteJob = { id: 'tier-result', executor: 'droplet', mode: 'auto', cwd: root, topic: 'fixture', to: [], actor: null,
    head: 'head', branch: 'task', log, result: join(root, 'result.json'), gate: join(root, 'gate'), pid: null, started: null,
    outcome: { code: 0, cause: '' }, cleaned: true, artifact: null, reported: false, error: null, state: 'finished', workers: 2,
    tierPlan: plan, selection: { ...selection, files: [] } };
  store.setMeta('suite-jobs', JSON.stringify([job]));
  const published = Promise.withResolvers<{ job: Readonly<SuiteJob>; text: string }>();
  const suites = new Suites(store, root, async job => published.resolve({ job, text: suiteSummary(await readFile(job.log, 'utf8')) }), { locks: [join(root, 'fixture.lock')] });
  beforeDirectories(t, async () => { await suites.close(); store.close(); });
  const report = await eventually('recovered run report', () => suites.status().find(row => row.reported));
  assert.equal(report.outcome?.code, 0);
  const result = await published.promise;
  assert.match(result.text, /tier T1: files 1; tests 1; observed 0.25 s; projected wall 200 s at 1 workers; wall budget 120 s; over wall \(report only\)/);
  assert.match(result.text, /tier T2: files 1; tests 1; observed 0.5 s/);
  assert.match(result.text, /tier share: T1\+T2 55.556 % of 900 s \(T3 400 s, T4 0 s\)/);
  assert.doesNotMatch(result.text, /^tier T4:/m);
  assert.equal(result.job.outcome?.code, 0);
  assert.match(result.text, /test lint \(report only\): 2 findings in 2 files/);
  assert.doesNotMatch(result.text, /^test lint (?:finding|tier):/m);
  assert.match(result.text, /test lint detail: 4 tier lines; 2 finding lines; log/);
  assert.match(await readFile(log, 'utf8'), /b.test.ts:1 \[wall-clock-wait\]/);
  assert.match(await readFile(log, 'utf8'), /test lint tier: hub\/test\/b.test.ts: T2; qualifies T2/);
  assert.equal((await readFile(log, 'utf8')).split('test lint (report only):').length - 1, 1);
  assert.equal((await readFile(log, 'utf8')).split('tier T1:').length - 1, 1);
});


test('tier projections use weighted file placement and preserve selected smoke scope', async t => {
  const root = await planted(t);
  await writeFile(join(root, 'hub/test/d.test.ts'), '');
  const manifest = JSON.parse(await readFile(join(root, 'hub/test/tiers.json'), 'utf8'));
  manifest.tests['hub/test/d.test.ts'] = 'T2';
  await writeFile(join(root, 'hub/test/tiers.json'), serializeTierManifest(manifest));
  const durations = JSON.parse(await readFile(join(root, 'hub/test/durations.json'), 'utf8'));
  durations.files['hub/test/d.test.ts'] = { seconds: 100, tests: 1 };
  await writeFile(join(root, 'hub/test/durations.json'), JSON.stringify(durations));
  const selection = { mode: 'full' as const, files: [], reason: 'projection fixture' };
  const plan = await planTierReport(root, selection, 2);
  const component = plan.find(row => row.tier === 'T2')!;
  assert.equal(component.seconds, 400);
  assert.equal(component.projectedWall, 300, 'one 300-second file cannot split across two workers');
  assert.equal(tierPlanWorkers(plan, 1).find(row => row.tier === 'T2')!.projectedWall, 400);
  assert.equal(tierPlanWorkers(plan, 4).find(row => row.tier === 'T1')!.workers, 1);
  const selected = await planTierReport(root, { ...selection, mode: 'hub-selected', tests: ['hub/test/d.test.ts'] }, 2);
  assert.deepEqual(selected.flatMap(row => row.files), ['hub/test/d.test.ts'], 'unplanned files and absent smoke files do not enter the census');
});


test('legacy preview includes planned Neovim in T3 accounting without changing execution', async t => {
  const root = await planted(t);
  await rm(join(root, 'hub/test/tiers.json'));
  await writeFile(join(root, 'hub/test/shards.json'), JSON.stringify({ version: 1, tests: {
    'hub/test/a.test.ts': 'free', 'hub/test/b.test.ts': 'machine', 'hub/test/c.test.ts': 'machine',
  } }));
  assert.deepEqual(await packageShards(root, 'full', undefined, undefined, { workers: 2 }), [
    { name: 'hub free', resource: 'free', workers: 1, targets: ['hub/test/a.test.ts'] },
    { name: 'hub machine', resource: 'machine', workers: 2, targets: ['hub/test/b.test.ts', 'hub/test/c.test.ts'] },
    { name: 'Neovim', resource: 'machine', workers: 2, targets: ['nvim/test/**/*.test.ts'] },
  ]);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  const frame = await ui.request({ type: 'suite.start', mode: 'all', dryRun: true, cwd: root, workers: 2 });
  assert.equal(frame.ok, true, frame.error);
  const preview = frame.value as SuiteDryRun;
  assert.deepEqual(preview.tiers.map(row => ({ tier: row.tier, files: row.files, tests: row.tests })), [
    { tier: 'T1', files: ['hub/test/a.test.ts'], tests: 2 },
    { tier: 'T3', files: ['hub/test/b.test.ts', 'hub/test/c.test.ts', 'nvim/test/editor.test.ts'], tests: 8 },
  ]);
  assert.match(preview.lines.join('\n'), /tier T3: files 3; tests 8 planned; observed unavailable; projected wall 500 s at 2 workers/);
  assert.ok(preview.lines.includes('tier share: T1+T2 20 % of 1000 s (T3 800 s, T4 0 s)'));
  const report = suiteSummary(tierReport(preview.tiers, [{ file: 'nvim/test/editor.test.ts', name: 'editor', seconds: 1.5 }]).join('\n'));
  assert.match(report, /tier T3: files 3; tests 1; observed 1.5 s; projected wall 500 s/);
  assert.match(report, /tier share: T1\+T2 20 % of 1000 s \(T3 800 s, T4 0 s\)$/);
  assert.deepEqual(((await ui.request({ type: 'hub.status' })).value as HubStatus).suites, []);
});
