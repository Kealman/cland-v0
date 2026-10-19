// T1: durable culprit search with a fake failing-file runner; no processes or clock waits.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/hub/store.ts';
import { DevT3Search, type ProbeReceipt, type SearchReport } from '../src/hub/dev-t3-search.ts';
import type { DevT3Result } from '../src/hub/dev-t3-result.ts';

export const redResult = (): DevT3Result => ({ event: 'verification-dev-t3-result', run: 'red-run', head: 'm8', tree: 'red-tree', previousGreenHead: 'baseline', previousGreenRun: 'green-run', merges: Array.from({ length: 8 }, (_, i) => ({ head: `m${i + 1}`, subject: `Merge T-${i + 1}` })), result: 'red', failingFiles: ['hub/test/regression.test.ts', 'nvim/test/pre-existing.test.ts'], artifact: 'A-1', path: '/logs/red' });

test('search bisects each failing file and excludes pre-existing failures across restart', async t => {
  const root = await mkdtemp(join(tmpdir(), 'dev-t3-search-'));
  let store = new Store(join(root, 'hub.db'));
  t.after(async () => { store.close(); await rm(root, { recursive: true, force: true }); });
  const calls: Array<{ head: string; file: string }> = [], reports: SearchReport[] = [];
  const boundary = { probe: async (_input: DevT3Result, head: string, file: string): Promise<ProbeReceipt> => {
    calls.push({ head, file });
    return { head, file, run: `probe-${calls.length}`, result: file.startsWith('nvim/') || head !== 'baseline' && Number(head.slice(1)) >= 5 ? 'red' : 'green', artifact: `A-${calls.length + 1}`, path: '/logs/probe' };
  }, report: async (report: SearchReport) => { reports.push(report); } };
  let search = new DevT3Search(store, boundary);
  search.accept(redResult());
  await search.tick();
  store.close(); store = new Store(join(root, 'hub.db')); search = new DevT3Search(store, boundary);
  for (let i = 0; i < 20 && !reports.length; i++) await search.tick();
  assert.equal(reports.length, 1);
  assert.deepEqual(reports[0]!.files.map(f => [f.file, f.result, f.culprit?.head]), [
    ['hub/test/regression.test.ts', 'culprit', 'm5'], ['nvim/test/pre-existing.test.ts', 'pre-existing', undefined],
  ]);
  assert.deepEqual(calls.filter(c => c.file.startsWith('hub/')).map(c => c.head), ['m8', 'baseline', 'm4', 'm6', 'm5']);
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
    const search = new DevT3Search(store, { probe: async (_input, head, file) => ({ head: 'wrongHead' in scenario ? 'wrong' : head, file, run: 'probe', result: scenario.result, artifact: 'A-2', path: '/log' }), report: async report => { reports.push(report); } });
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
  const repository = { identity: async () => f.candidate.tree, checkout: async () => { checkouts++; f.candidate.head = input.head; }, remove: async () => { removals++; } };
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
