// T1: fake capture runs and in-memory catalogs exercise recording admission.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertRecordingRun, refreshFrameCatalog } from './nvim-frame-refresh.ts';
import { recordingKey, type Recording } from '../../nvim/test/frame-fixtures.ts';

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
