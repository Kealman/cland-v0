// T1: durable culprit search with a fake failing-file runner; no processes or clock waits.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/hub/store.ts';
import { DevT3Search, type ProbeReceipt, type SearchReport } from '../src/hub/dev-t3-search.ts';
import type { DevT3Result } from '../src/hub/dev-t3-result.ts';
import { suiteUnit } from './suite-unit-fixture.ts';

test('search contains a throwing blocked notice and retries its report on the next timer tick', async t => {
  const f = await suiteUnit(t);
  const logs: Record<string, unknown>[] = [];
  let reported = false;
  const search = new DevT3Search(f.store, {
    currentDev: async () => 'm8',
    probe: async () => assert.fail('empty search has no probes'),
    report: async () => { if (!reported) throw new Error('search report failed'); },
    blocked: () => { throw new Error('blocked notice failed'); },
    log: entry => { logs.push(entry); },
  });
  t.after(() => search.close(f.clock));
  search.accept({ ...redResult(), failingFiles: [] });
  await assert.doesNotReject(search.tick());
  assert.equal(f.store.meta('dev-t3-search-error'), 'Error: search report failed');
  assert.ok(logs.some(entry => entry.event === 'dev-t3-search-report-failed' && entry.error === 'Error: blocked notice failed'));
  reported = true;
  search.start(f.clock);
  await f.clock.advance(1000);
  await search.tick();
  assert.equal(JSON.parse(f.store.meta('dev-t3-searches')!)[0].reported, true);
});

export const redResult = (): DevT3Result => ({ event: 'verification-dev-t3-result', run: 'red-run', head: 'm8', tree: 'red-tree', previousGreenHead: 'baseline', previousGreenRun: 'green-run', merges: Array.from({ length: 8 }, (_, i) => ({ head: `m${i + 1}`, subject: `Merge T-${i + 1}` })), result: 'red', failingFiles: ['hub/test/regression.test.ts', 'nvim/test/pre-existing.test.ts'], artifact: 'A-1', path: '/logs/red' });

test('search bisects each failing file and excludes pre-existing failures across restart', async t => {
  const root = await mkdtemp(join(tmpdir(), 'dev-t3-search-'));
  let store = new Store(join(root, 'hub.db'));
  t.after(async () => { store.close(); await rm(root, { recursive: true, force: true }); });
  const calls: Array<{ head: string; file: string }> = [], reports: SearchReport[] = [];
  const boundary = { currentDev: async () => 'm8', probe: async (_input: DevT3Result, head: string, file: string): Promise<ProbeReceipt> => {
    calls.push({ head, file });
    return { head, file, run: `probe-${calls.length}`, result: file.startsWith('nvim/') || head !== 'baseline' && Number(head.slice(1)) >= 5 ? 'red' : 'green', artifact: `A-${calls.length + 1}`, path: '/logs/probe' };
  }, report: async (report: SearchReport) => { reports.push(report); } };
  let search = new DevT3Search(store, boundary);
  search.accept(redResult());
  for (let i = 0; i < 6; i++) await search.tick();
  // Reopen after the green boundary confirmation; only the red side remains.
  store.close(); store = new Store(join(root, 'hub.db')); search = new DevT3Search(store, boundary);
  for (let i = 0; i < 20 && !reports.length; i++) await search.tick();
  assert.equal(reports.length, 1);
  assert.deepEqual(reports[0]!.files.map(f => [f.file, f.result, f.culprit?.head]), [
    ['hub/test/regression.test.ts', 'culprit', 'm5'], ['nvim/test/pre-existing.test.ts', 'pre-existing', undefined],
  ]);
  assert.deepEqual(calls.filter(c => c.file.startsWith('hub/')).map(c => c.head), ['m8', 'baseline', 'm4', 'm6', 'm5', 'm4', 'm5']);
  assert.deepEqual(calls.filter(c => c.file.startsWith('nvim/')).map(c => c.head), ['m8', 'baseline']);
  search.accept(redResult()); await search.tick();
  assert.equal(reports.length, 1, 'replayed result never files or reports twice');
});

test('search reports unavailable evidence without blame and still recognizes red-head flakes', async t => {
  const root = await mkdtemp(join(tmpdir(), 'dev-t3-search-'));
  const store = new Store(join(root, 'hub.db'));
  t.after(async () => { store.close(); await rm(root, { recursive: true, force: true }); });
  const cases = [
    { name: 'no baseline', previousGreenHead: null, merges: null, result: 'red', expected: 'inconclusive' },
    { name: 'flake without baseline', previousGreenHead: null, merges: null, result: 'green', expected: 'flake' },
    { name: 'cancelled runner', result: 'inconclusive', expected: 'inconclusive' },
    { name: 'mismatched head', result: 'red', wrongHead: true, expected: 'inconclusive' },
  ] as const;
  const reports: SearchReport[] = [];
  for (const scenario of cases) {
    const input = { ...redResult(), run: scenario.name, failingFiles: ['hub/test/regression.test.ts'], ...('merges' in scenario ? { merges: scenario.merges, previousGreenHead: scenario.previousGreenHead } : {}) };
    const search = new DevT3Search(store, { currentDev: async () => 'm8', probe: async (_input, head, file) => ({ head: 'wrongHead' in scenario ? 'wrong' : head, file, run: 'probe', result: scenario.result, artifact: 'A-2', path: '/log' }), report: async report => { reports.push(report); } });
    search.accept(input);
    for (let i = 0; i < 5 && !reports.some(report => report.input.run === scenario.name); i++) await search.tick();
    const file = reports.find(report => report.input.run === scenario.name)!.files[0]!;
    assert.equal(file.result, scenario.expected, scenario.name); assert.equal(file.culprit, undefined);
  }
});

test('probe proof rejects skipped, interrupted and incomplete execution', async () => {
  const { probeResult } = await import('../src/hub/dev-t3-probe.ts');
  const file = 'hub/test/regression.test.ts';
  const job = { state: 'finished' as const, outcome: { code: 0, cause: '' } };
  const row = { event: 'finish', id: 'test', file, name: 'regression', at: 1, nesting: 0, outcome: 'pass', seconds: 0.01 };
  const progress = (override: object) => `suite progress ${JSON.stringify({ ...row, ...override })}\n`;
  const good = progress({});
  assert.equal(probeResult(job, good, file).result, 'green');
  for (const log of ['', progress({ outcome: 'skip' }), progress({ outcome: 'todo' }), good + progress({ outcome: 'fail', id: 'child', nesting: 1 }), good + progress({ event: 'start', id: 'pending' }), good + 'suite progress {broken}\n', good + progress({ outcome: 'cancelled', id: 'cancelled' })]) assert.equal(probeResult(job, log, file).result, 'inconclusive', log);
  for (const override of [{ cancelled: true }, { timedOut: true }, { requesterDied: true }, { cached: { head: 'h', tree: 't', run: 'r' } }]) assert.equal(probeResult({ ...job, ...override }, good, file).result, 'inconclusive');
  const failed = `suite test failures ${JSON.stringify([{ file, name: 'regression' }])}\n`;
  assert.equal(probeResult({ ...job, outcome: { code: 1, cause: '' } }, failed, file).result, 'red');
  assert.equal(probeResult({ ...job, outcome: { code: 1, cause: '' } }, failed, 'nvim/test/other.test.ts').result, 'inconclusive');
});

test('a reopened probe observes its admitted worker receipt without another checkout or run', async t => {
  const { suiteUnit } = await import('./suite-unit-fixture.ts');
  const { DevT3Probes } = await import('../src/hub/dev-t3-probe.ts');
  const f = await suiteUnit(t, { executor: 'droplet', machineReceiptsOnly: true });
  const input = redResult(), file = input.failingFiles[0]!;
  let checkouts = 0, removals = 0;
  const repository = { contains: async () => true, identity: async () => f.candidate.tree, checkout: async () => { checkouts++; f.candidate.head = input.head; }, remove: async () => { removals++; } };
  let probes = new DevT3Probes(f.store, f.suites, f.root, {}, repository);
  assert.equal(await probes.probe(input, input.head, file), null);
  const id = f.suites.status()[0]!.id;
  await f.suites.settled(); await f.machine.waits.run(f.machine.started(id));
  await f.reopen(); probes = new DevT3Probes(f.store, f.suites, f.root, {}, repository);
  assert.equal(await probes.probe(input, input.head, file), null);
  await f.finish(id, 1, `suite test failures ${JSON.stringify([{ file, name: 'regression' }])}\n`);
  const result = await probes.probe(input, input.head, file);
  assert.equal(result!.result, 'red'); assert.equal(result!.run, id);
  assert.equal(f.suites.status().length, 1); assert.equal(checkouts, 1); assert.equal(removals, 1);
});


test('probe proof keeps known Linux exclusions partial and rejects missing or unexplained skip evidence', async () => {
  const { probeResult } = await import('../src/hub/dev-t3-probe.ts');
  const { suiteEvidence } = await import('../src/suite-log.ts');
  const file = 'nvim/test/qa.test.ts';
  const platform = { os: 'linux', arch: 'x64', release: 'fixture', node: 'v24.13.0', nvim: 'v0.12.5' };
  const job = { state: 'finished' as const, outcome: { code: 0, cause: '' }, platform };
  const finish = (id: string, name: string, outcome: string) => `suite progress ${JSON.stringify({ event: 'finish', id, file, name, at: 1, nesting: 0, type: 'test', outcome, seconds: 0.01 })}\n`;
  const pass = finish('pass', 'executed test', 'pass');
  const skip = finish('skip', 'sandbox test', 'skip');
  const detail = (reason: string, name = 'sandbox test') => `suite skip ${JSON.stringify({ file, name, reason })}\n`;
  const reason = 'needs macOS sandbox-exec';
  assert.deepEqual(probeResult(job, suiteEvidence(pass + skip + detail(reason)), file), {
    result: 'partial', executed: 'green', platform, platformSkips: [{ name: 'sandbox test', reason }],
  });
  for (const log of [pass + skip, pass + detail(reason), skip + detail(reason), pass + skip + detail('test marked skip without a reason'),
    pass + skip + detail('network unavailable'), pass + skip + detail(reason, 'different test'), pass + skip + 'suite skip {broken}\n']) {
    assert.equal(probeResult(job, log, file).result, 'inconclusive', log);
  }
  assert.equal(probeResult({ ...job, platform: { ...platform, os: 'darwin' } }, pass + skip + detail(reason), file).result, 'inconclusive');
  assert.equal(probeResult({ state: job.state, outcome: job.outcome }, pass + skip + detail(reason), file).result, 'inconclusive');
});


test('search refuses identical exclusions observed on different executor architectures', async t => {
  const store = new Store(); t.after(() => store.close());
  const platform = { os: 'linux', arch: 'x64', release: 'fixture', node: 'v24.13.0', nvim: 'v0.12.5' };
  const reports: SearchReport[] = [];
  let sequence = 0;
  const search = new DevT3Search(store, {
    currentDev: async () => 'm8',
    probe: async (_input, head, file) => ({ head, file, run: `probe-${++sequence}`, artifact: 'A-1', path: '/log',
      result: 'partial', executed: head === 'baseline' ? 'green' : 'red',
      platform: { ...platform, arch: head === 'baseline' ? 'arm64' : 'x64' },
      platformSkips: [{ name: 'sandbox test', reason: 'needs macOS sandbox-exec' }],
    }),
    report: async report => { reports.push(report); },
  });
  search.accept({ ...redResult(), failingFiles: ['nvim/test/qa.test.ts'] });
  for (let i = 0; i < 4 && !reports.length; i++) await search.tick();
  assert.equal(reports.length, 1);
  assert.equal(reports[0]!.files[0]!.result, 'inconclusive');
  assert.match(reports[0]!.files[0]!.reason!, /platform changed/);
  assert.equal(reports[0]!.files[0]!.culprit, undefined);
});


test('search skips history and reports a file already fixed at current dev', async t => {
  const store = new Store(); t.after(() => store.close());
  const reports: SearchReport[] = [];
  const calls: string[] = [];
  const search = new DevT3Search(store, {
    currentDev: async () => 'fixed-tip',
    probe: async (_input, head, file) => {
      calls.push(head);
      return { head, file, run: 'tip-run', result: 'green', artifact: 'A-2', path: '/logs/tip' };
    },
    report: async report => { reports.push(report); },
  });
  search.accept({ ...redResult(), failingFiles: ['hub/test/regression.test.ts'] });
  for (let i = 0; i < 15 && !reports.length; i++) await search.tick();
  assert.equal(reports.length, 1);
  assert.equal(reports[0]!.files[0]!.result, 'already-fixed');
  assert.match(reports[0]!.files[0]!.reason!, /already fixed on dev at fixed-tip/);
  assert.deepEqual(calls, ['fixed-tip'], 'fixed files acquire no historical probes');
  assert.equal(reports[0]!.files[0]!.receipts[0]!.run, 'tip-run');
});


test('search revalidates an already fixed file when dev moves back to red before reporting', async t => {
  const store = new Store(); t.after(() => store.close());
  const reports: SearchReport[] = [];
  let tip = 'fixed-tip', sequence = 0;
  const search = new DevT3Search(store, {
    currentDev: async () => tip,
    probe: async (_input, head, file) => ({ head, file, run: `probe-${++sequence}`, result: head === 'fixed-tip' || head === 'baseline' ? 'green' : 'red', artifact: 'A-2', path: '/log' }),
    report: async report => { reports.push(report); },
  });
  search.accept({ ...redResult(), merges: [{ head: 'm8', subject: 'Regression' }], failingFiles: ['hub/test/regression.test.ts'] });
  await search.tick();
  tip = 'new-red-tip';
  for (let i = 0; i < 15 && !reports.length; i++) await search.tick();
  assert.equal(reports.length, 1);
  assert.equal(reports[0]!.files[0]!.result, 'culprit');
  assert.equal(reports[0]!.files[0]!.tip!.head, tip);
  assert.equal(reports[0]!.files[0]!.tip!.result, 'red');
});


test('an older checkpoint without a tip receipt cannot file before current dev is checked', async t => {
  const store = new Store(); t.after(() => store.close());
  const input = { ...redResult(), failingFiles: ['hub/test/regression.test.ts'] };
  const file = input.failingFiles[0]!;
  store.setMeta('dev-t3-searches', JSON.stringify([{ input, files: [{ file, low: 3, high: 4,
    phase: 'confirm-red', receipts: [], result: 'culprit', culprit: input.merges![4] }] }]));
  const reports: SearchReport[] = [];
  let probes = 0;
  const search = new DevT3Search(store, {
    currentDev: async () => 'fixed-tip',
    probe: async (_input, head, file) => {
      probes++;
      return { head, file, run: 'tip-run', result: 'green', artifact: 'A-2', path: '/tip' };
    },
    report: async report => { reports.push(report); },
  });
  await search.tick(); await search.tick();
  assert.equal(probes, 1);
  assert.equal(reports.length, 1);
  assert.equal(reports[0]!.files[0]!.result, 'already-fixed');
  assert.equal(reports[0]!.files[0]!.culprit, undefined);
});
