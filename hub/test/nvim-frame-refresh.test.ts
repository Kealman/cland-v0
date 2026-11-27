// T1: fake capture runs and in-memory catalogs exercise recording admission.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertRecordingRun, refreshFrameCatalog } from './nvim-frame-refresh.ts';
import { recordingKey, type Recording } from '../../nvim/test/frame-fixtures.ts';
import { canonical, serializeRecordings } from '../../nvim/test/frame-fixtures.ts';
import { createFrameRecorder } from './nvim-frame-recorder.ts';
import { recordedOutput } from './nvim-frame-source.ts';
import { fixtureWork } from '../../test-support/fixture-work.ts';

test('debounced card selection cannot change the refreshed catalog or slices', async t => {
  const owner = fixtureWork();
  t.after(() => owner.close());
  await owner.run(async () => {
    const context = { at: '2026-10-14T10:00:00Z', items: [
      { id: 'R-1', kind: 'release', state: 'open', version: '0.1.0' },
      { id: 'T-654', kind: 'task', parent: 'R-1', state: 'open', body: '## Summary\nBenchmark row.' },
    ], tracker: {}, preferences: {}, visibility: {}, presence: [], processes: [] };
    const refreshes: string[] = [];
    for (const selected of [[], ['R-1', 'T-654']]) {
      const frames: Recording[] = [];
      let work = 0;
      const recorder = createFrameRecorder((op, input) => { work++; return recordedOutput(op, input); }, r => frames.push(r));
      recorder('config', { source: '' });
      recorder.cards(context, '/fixture');
      const eagerWork = work;
      assert.equal(eagerWork, 5, 'one config and two producer operations per item');
      assert.equal(frames.filter(r => r.operation === 'frame').length, 2);
      recorder.cards(structuredClone(context), '/fixture');
      assert.equal(work, eagerWork, 'identical contexts do no repeated producer work');
      for (const id of selected) {
        const item = context.items.find(item => item.id === id)!;
        const input = { body: String(item.body ?? ''), criteria: undefined };
        const normalized = canonical(input, '/fixture');
        const criteria = normalized.restore(recorder('criteria', normalized.input));
        const frame = { type: 'result', id: '@request@', ok: true, value: { item: { body: '', comments: [], verdicts: [], ...item, ...criteria as object, path: `.cland/tasks/${String(undefined)}` } } };
        const card = canonical({ ...context, frame, requestType: 'task.view' }, '/fixture', context.at);
        assert.deepEqual(recorder('frame', card.input), recordedOutput('frame', card.input));
      }
      await refreshFrameCatalog(['explorer.test.ts'], false, {
        catalog: {}, slices: new Map([['explorer.test.ts', {}]]), capture: async () => frames,
        normalize: r => [r], publish: async (catalog, slices) => { refreshes.push(serializeRecordings(catalog), serializeRecordings(slices.get('explorer.test.ts')!)); },
      });
    }
    assert.deepEqual(refreshes.slice(0, 2), refreshes.slice(2), 'zero or two optional selections publish identical bytes');
    const frames: Recording[] = [];
    let calls = 0;
    const recorder = createFrameRecorder((op, input) => { calls++; return recordedOutput(op, input); }, r => frames.push(r));
    recorder.cards(context, '/fixture');
    const changed = { ...context, items: context.items.map(item => item.id === 'T-654' ? { ...item, body: '## Summary\nChanged body.' } : item) };
    recorder.cards(changed, '/fixture');
    assert.equal(calls, 8, 'a changed context captures exactly two producer operations per item again');
    assert.ok(frames.some(r => JSON.stringify(r.output).includes('Changed body.')), 'new wire facts remain recorded');
    assert.throws(() => recorder('criteria', { body: 'not in this scenario' }), /outside its recorded scenario context/);
  });
});

test('a transient control context records cards without demand and defers invalid projection faults', async t => {
  const owner = fixtureWork();
  t.after(() => owner.close());
  await owner.run(async () => {
    const frames: Recording[] = [];
    const recorder = createFrameRecorder(recordedOutput, r => frames.push(r));
    const context = { at: '2026-10-14T10:00:00Z', items: [{ id: 'T-654', kind: 'task', state: 'open', body: 'Transient control state' }] };
    recorder.controlContext(() => context, '/fixture');
    assert.equal(frames.filter(r => r.operation === 'frame').length, 1, 'the control boundary records the card even when selection is coalesced away');
    const count = frames.length;
    recorder.controlContext(() => { throw new Error('invalid tracker'); }, '/fixture');
    assert.equal(frames.length, count, 'invalid setup leaves capture unchanged');
    assert.throws(() => recorder.cards({ ...context, tracker: { ladder: 1 } }, '/fixture'), /levels must/);
  });
});

test('a failed recorder append refuses its control context and all later capture publication', async t => {
  const owner = fixtureWork();
  t.after(() => owner.close());
  await owner.run(async () => {
    for (const failAt of [1, 2]) for (const nestedRead of [false, true]) {
      let appends = 0;
      const failure = new Error('recording storage unavailable');
      const recorder = createFrameRecorder((op, input) => op === 'criteria' ? {} : input, () => {
        if (++appends === failAt) throw failure;
      });
      const context = { at: '2026-10-14T10:00:00Z', items: [{ id: 'T-654', kind: 'task', state: 'open' }] };
      assert.throws(() => recorder.controlContext(() => {
        if (nestedRead) recorder('config', { source: '' });
        return context;
      }, '/fixture'), error => error === failure);
      const publications: unknown[] = [];
      await assert.rejects(refreshFrameCatalog(['failed-capture.test.ts'], false, {
        catalog: {}, slices: new Map(), capture: async () => {
          recorder('config', { source: '' });
          return [];
        }, normalize: r => [r], publish: async next => { publications.push(next); },
      }), error => error === failure);
      assert.equal(appends, failAt, 'a later operation cannot resume a failed capture');
      assert.deepEqual(publications, [], 'failed capture never publishes a catalog');
    }
  });
});

const first: Recording = { operation: 'items', input: { page: 1 }, output: [] };
const second: Recording = { operation: 'items', input: { page: 2 }, output: [] };
const catalog = (frames: Recording[]) => Object.fromEntries(frames.map(r => [recordingKey(r.operation, r.input), r]));
const tap = ({ tests = 1, skipped = 0, pass = tests - skipped, fail = 0, cancelled = 0, todo = 0 }:
  Partial<Record<'tests' | 'skipped' | 'pass' | 'fail' | 'cancelled' | 'todo', number>> = {}) =>
  `TAP version 13\n1..${tests}\n# tests ${tests}\n# pass ${pass}\n# fail ${fail}\n# cancelled ${cancelled}\n# skipped ${skipped}\n# todo ${todo}\n`;

test('unavailable binary skips abort the whole refresh before any fixture is replaced', async () => {
  const stored = catalog([first, second]);
  const writes: unknown[] = [];
  let binaryAvailable = false;
  const io = {
    catalog: stored,
    slices: new Map([['first.test.ts', catalog([first])], ['unavailable.test.ts', catalog([second])]]),
    capture: async (file: string) => {
      assertRecordingRun(file, 0, tap({ skipped: file === 'unavailable.test.ts' && !binaryAvailable ? 1 : 0 }));
      return [file === 'first.test.ts' ? first : second];
    },
    normalize: (r: Recording) => [r],
    publish: async (next: unknown, slices: unknown) => { writes.push({ next, slices }); },
  };
  await assert.rejects(refreshFrameCatalog(['first.test.ts', 'unavailable.test.ts'], false, io), /unavailable.test.ts.*1 skipped/);
  assert.deepEqual(writes, []);
  assert.deepEqual(stored, catalog([first, second]));
  binaryAvailable = true;
  assert.equal(await refreshFrameCatalog(['first.test.ts', 'unavailable.test.ts'], false, io), 2);
  assert.deepEqual(writes, [{ next: stored, slices: io.slices }]);
});

test('complete concurrent targets publish despite scheduling-dependent slice and catalog frame counts', async () => {
  for (const retain of [false, true]) for (const sliced of [false, true]) {
    const writes: unknown[] = [];
    const capturedFiles: string[] = [];
    const files = ['concurrent.test.ts', 'peer.test.ts'];
    const count = await refreshFrameCatalog(files, retain, {
      catalog: catalog([first, second]),
      slices: sliced ? new Map(files.map(file => [file, catalog([first, second])])) : new Map(),
      capture: async file => {
        // Both targets finish, but coalesced requests yield fewer distinct frames.
        const targets = await Promise.all([Promise.resolve(first), Promise.resolve(first)]);
        assertRecordingRun(file, 0, tap({ tests: 2 }));
        capturedFiles.push(file);
        return targets;
      },
      normalize: r => [r],
      publish: async (next, slices) => { writes.push({ next, slices }); },
    });
    assert.deepEqual(capturedFiles, files, 'every requested file completed before publication');
    assert.equal(count, retain ? 2 : 1);
    assert.deepEqual(writes, [{
      next: catalog(retain ? [first, second] : [first]),
      slices: sliced ? new Map(files.map(file => [file, catalog([first])])) : new Map(),
    }]);
  }
});

test('recording requires a successful complete test receipt', () => {
  assert.doesNotThrow(() => assertRecordingRun('capture.test.ts', 0, tap()));
  for (const [code, output] of [[1, tap()], [null, tap()], [0, ''], [0, '# tests 0\n# skipped 0\n']] as const) {
    assert.throws(() => assertRecordingRun('capture.test.ts', code, output), /capture.test.ts/);
  }
});

test('a skipped file or incomplete consumer test refuses publication even after another file completed', async () => {
  const receipts = [
    tap({ tests: 0 }), // Whole file selected no tests.
    tap({ tests: 2, skipped: 1 }), // One of the consumer assertions was skipped.
    tap({ pass: 0, todo: 1 }),
    tap({ pass: 0, cancelled: 1 }),
    tap({ pass: 0, fail: 1 }),
    tap({ tests: 2, pass: 1 }), // A success exit alone is not completeness proof.
    tap().replace('# pass 1\n', ''),
  ];
  for (const retain of [false, true]) for (const receipt of receipts) {
    const stored = catalog([first, second]);
    const slices = new Map([['complete.test.ts', catalog([first])], ['incomplete.test.ts', catalog([second])]]);
    const writes: unknown[] = [];
    await assert.rejects(refreshFrameCatalog(['complete.test.ts', 'incomplete.test.ts'], retain, {
      catalog: stored, slices,
      capture: async file => {
        assertRecordingRun(file, 0, file === 'incomplete.test.ts' ? receipt : tap());
        return [file === 'complete.test.ts' ? first : second];
      },
      normalize: r => [r], publish: async next => { writes.push(next); },
    }), /incomplete.test.ts/, receipt);
    assert.deepEqual(writes, []);
    assert.deepEqual(stored, catalog([first, second]));
    assert.deepEqual(slices.get('incomplete.test.ts'), catalog([second]));
  }
});

test('a recording consumer with no prior slice still refuses zero frames', async () => {
  for (const retain of [false, true]) {
    const writes: unknown[] = [];
    await assert.rejects(refreshFrameCatalog(['new-consumer.test.ts'], retain, {
      catalog: catalog([first]), slices: new Map(), capture: async () => [],
      normalize: r => [r], publish: async next => { writes.push(next); },
    }), /new-consumer.test.ts recorded 0 frames; expected at least 1/);
    assert.deepEqual(writes, []);
  }
});

test('empty consumer discovery refuses publication', async () => {
  const writes: unknown[] = [];
  await assert.rejects(refreshFrameCatalog([], false, {
    catalog: catalog([first]), slices: new Map(), capture: async () => [first],
    normalize: r => [r], publish: async next => { writes.push(next); },
  }), /no consumer files/);
  assert.deepEqual(writes, []);
});
