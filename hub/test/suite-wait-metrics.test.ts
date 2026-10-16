import test from 'node:test';
import assert from 'node:assert/strict';
import { queueWaitMetrics } from '../src/hub/verification-wait.ts';
import { Suites, type SuiteJob } from '../src/hub/suites.ts';
import { Store } from '../src/hub/store.ts';
import { join } from 'node:path';
import { tempProject, projectHub, cland } from './harness.ts';
import type { LogEntry } from '../src/log.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parseConfig, renderConfig } from '../src/init/config.ts';
import type { VerificationQueue, HubStatus } from '../src/protocol.ts';
import { Journal } from '../src/hub/journal.ts';

const NOW = Date.parse('2026-10-16T06:00:00Z');
const HOUR = 3_600_000;
const iso = (time: number) => new Date(time).toISOString();
const run = (executor: 'local' | 'droplet', waitMs: number, finished = NOW - HOUR) => ({
  executor, queued: iso(finished - waitMs - 1000), admittedAt: iso(finished - 1000), completedAt: iso(finished), finished: iso(finished),
});
const completedJob = (root: string): SuiteJob => ({
  ...run('local', 60_000, NOW - 23.5 * HOUR), id: 'completed', mode: 'hub-only', cwd: root, topic: 'topic', to: [], actor: null,
  head: 'head', branch: 'branch', log: join(root, 'run.log'), result: join(root, 'result.json'), gate: join(root, 'gate'),
  pid: null, started: null, outcome: { code: 0, cause: '' }, artifact: null, reported: true, error: null, cleaned: true, state: 'finished',
});

test('queue wait windows separate effective executors and exclude cache hits and unadmitted cancellations', () => {
  const jobs = [
    run('local', 10_000), run('local', 30_000), run('droplet', 120_000),
    { ...run('local', 50_000), requestedExecutor: 'droplet' as const },
    // Durable finish keeps a restored old run outside 24h despite late recovery.
    { ...run('droplet', 600_000, NOW - 25 * HOUR), completedAt: iso(NOW) },
    { ...run('local', 0), cached: { run: 'prior', head: 'head', tree: 'tree' } },
    { executor: 'local' as const, queued: iso(NOW - HOUR), completedAt: iso(NOW), cancelled: true },
    { ...run('droplet', 9_000_000), parentRun: 'parent' },
    { ...run('local', 9_000_000), admittedAt: 'unknown' },
    run('local', 9_000_000, NOW + HOUR),
  ];
  const metrics = queueWaitMetrics(jobs, NOW, 1_200_000);
  assert.equal(metrics.targetP90Ms, 1_200_000);
  assert.deepEqual(metrics.last24Hours, {
    local: { count: 3, cacheHits: 1, p50Ms: 30_000, p90Ms: 50_000 },
    droplet: { count: 1, cacheHits: 0, p50Ms: 120_000, p90Ms: 120_000 },
  });
  assert.deepEqual(metrics.last50Runs.droplet, { count: 2, cacheHits: 0, p50Ms: 360_000, p90Ms: 600_000 });
});

test('last 50 is bounded independently per executor, with cache counts and nulls for empty samples', () => {
  const jobs = Array.from({ length: 60 }, (_, i) => run('local', (i + 1) * 1000, NOW - (60 - i) * 1000));
  const metrics = queueWaitMetrics([...jobs, run('droplet', 90_000)], NOW, 900_000);
  assert.deepEqual(metrics.last50Runs.local, { count: 50, cacheHits: 0, p50Ms: 35_500, p90Ms: 55_000 });
  assert.deepEqual(metrics.last24Hours.local, { count: 60, cacheHits: 0, p50Ms: 30_500, p90Ms: 54_000 });
  assert.deepEqual(metrics.last50Runs.droplet, { count: 1, cacheHits: 0, p50Ms: 90_000, p90Ms: 90_000 });
  assert.deepEqual(queueWaitMetrics([], NOW, 900_000).last24Hours.local, { count: 0, cacheHits: 0, p50Ms: null, p90Ms: null });
  const cached = { ...run('local', 0, NOW - 30 * HOUR), completedAt: iso(NOW), cached: { run: 'old', head: 'head', tree: 'tree' } };
  assert.deepEqual(queueWaitMetrics([cached], NOW, 900_000).last24Hours.local, { count: 0, cacheHits: 1, p50Ms: null, p90Ms: null });
});

test('hourly verification-wait journal values match queue snapshots and do not repeat after restart (fake clock)', async t => {
  const root = await tempProject(t, 'cland-wait-clock-');
  const database = join(root, 'hub.db');
  let store = new Store(database);
  store.setMeta('suite-jobs', JSON.stringify([completedJob(root)]));
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: NOW });
  const journal = new Journal(join(root, 'journal.jsonl'));
  const entries: LogEntry[] = [];
  const restore = () => new Suites(store, root, async () => assert.fail('completed request must not rerun'), {
    locks: [join(root, 'suite.lock')], waitP90TargetMs: 900_000,
    log: journal.tap(entry => { if (entry.event === 'verification-wait') entries.push(entry); }),
  });
  let suites = restore();
  t.after(async () => { try { await suites.close(); } finally { store.close(); await journal.close(); } });
  const check = (index: number) => {
    const { event, at, ...metrics } = entries[index]!;
    assert.equal(event, 'verification-wait');
    assert.equal(at, iso(Date.now()));
    assert.deepEqual(metrics, suites.snapshot().metrics.queueWait);
    assert.equal(metrics.targetP90Ms, 900_000);
  };
  t.mock.timers.tick(1000);
  assert.equal(entries.length, 1, 'first tick records the current hour');
  check(0);
  assert.deepEqual(suites.snapshot().metrics.queueWait?.last24Hours.local, { count: 1, cacheHits: 0, p50Ms: 60_000, p90Ms: 60_000 });
  t.mock.timers.tick(HOUR - 2000);
  assert.equal(entries.length, 1, 'no duplicates within the hour');
  t.mock.timers.tick(1000);
  assert.equal(entries.length, 2);
  check(1);
  assert.deepEqual(suites.snapshot().metrics.queueWait?.last24Hours.local, { count: 0, cacheHits: 0, p50Ms: null, p90Ms: null });
  await suites.close(); store.close();
  store = new Store(database);
  suites = restore();
  t.mock.timers.tick(1000);
  assert.equal(entries.length, 2, 'durable hour checkpoint suppresses restart duplicates');
  t.mock.timers.tick(HOUR - 1000);
  assert.equal(entries.length, 3);
  check(2);
  await journal.flush();
  const persisted = (await readFile(journal.path, 'utf8')).trim().split('\n').filter(Boolean)
    .map(line => JSON.parse(line) as LogEntry).filter(entry => entry.event === 'verification-wait');
  assert.deepEqual(persisted.map(({ ts, ...entry }) => entry), entries, 'hourly samples reach the durable journal');
});

test('queue wait target defaults, validates positive durations and survives config rendering', () => {
  assert.equal(parseConfig('', 'test').verification.waitP90TargetMs, 1_200_000);
  const config = parseConfig('[verification]\nwait_p90_target="15m"\n', 'test');
  assert.equal(config.verification.waitP90TargetMs, 900_000);
  assert.equal(parseConfig(renderConfig(config), 'test').verification.waitP90TargetMs, 900_000);
  for (const value of ['"0m"', '"oops"', '20']) {
    assert.throws(() => parseConfig(`[verification]\nwait_p90_target=${value}\n`, 'test'), /verification.wait_p90_target.*positive duration/);
  }
});

test('verify queue and hub status expose matching windows, configured target, and cache counts', async t => {
  const root = await tempProject(t, 'cland-wait-visible-');
  await mkdir(join(root, '.cland'));
  await writeFile(join(root, '.cland/config.toml'), '[verification]\nwait_p90_target="15m"\n');
  const finished = Date.now() - 60_000;
  const local = { ...completedJob(root), ...run('local', 120_000, finished) };
  const remote = { ...local, ...run('droplet', 1_200_000, finished), id: 'droplet' };
  const cached = { ...local, id: 'cached', cached: { run: local.id, head: local.head, tree: 'tree' } };
  const store = new Store(join(root, '.cland/hub.db'));
  try { store.setMeta('suite-jobs', JSON.stringify([local, remote, cached])); }
  finally { store.close(); }
  await projectHub(t, root);
  const queue = await cland(root, 'verify', 'queue', '--json');
  assert.equal(queue.code, 0, queue.stderr);
  const status = await cland(root, 'hub', 'status', '--json');
  assert.equal(status.code, 0, status.stderr);
  const metrics = (JSON.parse(queue.stdout) as VerificationQueue).metrics.queueWait;
  assert.deepEqual(metrics, (JSON.parse(status.stdout) as HubStatus).verification?.metrics.queueWait);
  assert.equal(metrics?.targetP90Ms, 900_000);
  assert.deepEqual(metrics?.last24Hours.local, { count: 1, cacheHits: 1, p50Ms: 120_000, p90Ms: 120_000 });
  assert.deepEqual(metrics?.last50Runs.droplet, { count: 1, cacheHits: 0, p50Ms: 1_200_000, p90Ms: 1_200_000 });
  const text = await cland(root, 'verify', 'queue');
  assert.equal(text.code, 0, text.stderr);
  assert.match(text.stdout, /queue wait target: p90 < 900s/);
  assert.match(text.stdout, /24h local: p50 120s \/ p90 120s.*1 samples.*1 cache hits/);
  assert.match(text.stdout, /last 50 droplet: p50 1200s \/ p90 1200s.*1 samples.*0 cache hits/);
  const configPath = join(root, '.cland/config.toml');
  const loadedConfig = await readFile(configPath, 'utf8');
  const editedConfig = loadedConfig.replace(/wait_p90_target\s*=\s*"15m"/, 'wait_p90_target="5m"');
  assert.notEqual(editedConfig, loadedConfig);
  await writeFile(configPath, editedConfig);
  const target = async () => ((JSON.parse((await cland(root, 'hub', 'status', '--json')).stdout) as HubStatus).verification?.metrics.queueWait?.targetP90Ms);
  assert.equal(await target(), 900_000, 'metrics use the loaded snapshot until config reload');
  const reloaded = await cland(root, 'hub', 'reload');
  assert.equal(reloaded.code, 0, reloaded.stderr);
  assert.equal(await target(), 300_000, 'successful reload updates the metrics target');
  await writeFile(configPath, editedConfig.replace('"5m"', '"0m"'));
  assert.notEqual((await cland(root, 'hub', 'reload')).code, 0);
  assert.equal(await target(), 300_000, 'failed reload retains the last good metrics target');
});
