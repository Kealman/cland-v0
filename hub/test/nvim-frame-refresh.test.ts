// T1: fake capture runs and in-memory catalogs exercise recording admission.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertRecordingRun, refreshFrameCatalog } from './nvim-frame-refresh.ts';
import { recordingKey, type Recording } from '../../nvim/test/frame-fixtures.ts';

const first: Recording = { operation: 'items', input: { page: 1 }, output: [] };
const second: Recording = { operation: 'items', input: { page: 2 }, output: [] };
const catalog = (frames: Recording[]) => Object.fromEntries(frames.map(r => [recordingKey(r.operation, r.input), r]));
const tap = (skipped: number) => `TAP version 13\n1..1\n# tests 1\n# pass ${1 - skipped}\n# fail 0\n# cancelled 0\n# skipped ${skipped}\n# todo 0\n`;

test('unavailable binary skips abort the whole refresh before any fixture is replaced', async () => {
  const stored = catalog([first, second]);
  const writes: unknown[] = [];
  let binaryAvailable = false;
  const io = {
    catalog: stored,
    slices: new Map([['first.test.ts', catalog([first])], ['unavailable.test.ts', catalog([second])]]),
    capture: async (file: string) => {
      assertRecordingRun(file, 0, tap(file === 'unavailable.test.ts' && !binaryAvailable ? 1 : 0));
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

test('zero or reduced file captures preserve catalog and slices in full and retained refreshes', async () => {
  for (const retain of [false, true]) for (const frames of [[], [first]]) {
    const writes: unknown[] = [];
    await assert.rejects(refreshFrameCatalog(['reduced.test.ts'], retain, {
      catalog: catalog([first, second]), slices: new Map([['reduced.test.ts', catalog([first, second])]]),
      capture: async () => frames, normalize: r => [r], publish: async next => { writes.push(next); },
    }), /reduced.test.ts recorded [01] frames; expected at least 2/);
    assert.deepEqual(writes, []);
  }
});

test('full refresh refuses a smaller catalog even without existing file slices', async () => {
  const writes: unknown[] = [];
  await assert.rejects(refreshFrameCatalog(['capture.test.ts'], false, {
    catalog: catalog([first, second]), slices: new Map(), capture: async () => [first],
    normalize: r => [r], publish: async next => { writes.push(next); },
  }), /capture.test.ts recorded 1 catalog frames; expected at least 2/);
  assert.deepEqual(writes, []);
});

test('recording requires a successful complete test receipt', () => {
  assert.doesNotThrow(() => assertRecordingRun('capture.test.ts', 0, tap(0)));
  for (const [code, output] of [[1, tap(0)], [null, tap(0)], [0, ''], [0, '# tests 0\n# skipped 0\n']] as const) {
    assert.throws(() => assertRecordingRun('capture.test.ts', code, output), /capture.test.ts/);
  }
});
