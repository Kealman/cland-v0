// T1: source-import closure and recorder drift refusal; no live resources.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { nvimHubImports } from '../src/suite-selection.ts';
import { assertRecordings } from './nvim-fixture-check.ts';
import { recordedOutput } from './nvim-frame-source.ts';
import { canonical, packRecordings, unpackRecordings, replayFrame, selectRecordings, recordingReader } from '../../nvim/test/frame-fixtures.ts';
const root = fileURLToPath(new URL('../../', import.meta.url));
test('T2 Neovim import closures contain no hub runtime or harness', async () => {
  const { tests } = JSON.parse(await readFile(new URL('./tiers.json', import.meta.url), 'utf8'));
  const t2 = Object.keys(tests).filter(file => file.startsWith('nvim/') && (tests[file]?.tier ?? tests[file]) === 'T2');
  assert.ok(t2.length > 0);
  assert.deepEqual(await nvimHubImports(root, [...t2, 'nvim/test/stub-hub.ts']), []);
});
test('a planted hub frame change fails recorder drift until the fixtures are rewritten', async () => {
  const { status } = JSON.parse(await readFile(new URL('../../nvim/test/fixtures/live-protocol-frames.json', import.meta.url), 'utf8'));
  const recordings = { 'live-attach-config': { operation: 'config', input: { source: '' }, output: status } };
  const changed = (operation: string, input: unknown) => {
    const output = recordedOutput(operation, input);
    return operation === 'config' ? { ...output as object, plantedHubField: 'frame change' } : output;
  };
  assertRecordings(recordings);
  assert.throws(() => assertRecordings(recordings, changed), /fixture .* drifted/);
  const rewritten = Object.fromEntries(Object.entries(recordings).map(([key, record]) => [key, { ...record, output: changed(record.operation, record.input) }]));
  assertRecordings(rewritten, changed);
});

test('recordings bind transient paths and times while retaining their original wire values', () => {
  const macRoot = '/private/var/tmp/cland-sh-abc123/proj-shell';
  const linuxRoot = '/tmp/cland-sh-def456/proj-shell';
  const mac = { cwd: macRoot, attach: '/var/tmp/cland-sh-abc123/keylog', at: '2026-10-13T12:00:00.000Z', ts: '2026-10-12T12:00:00.000Z' };
  const linux = { cwd: linuxRoot, attach: '/tmp/cland-sh-def456/keylog', at: '2026-10-14T12:00:00.000Z', ts: '2026-10-13T12:00:00.000Z' };
  const a = canonical(mac, macRoot, mac.at), b = canonical(linux, linuxRoot, linux.at);
  assert.deepEqual(a.input, b.input, 'machine paths and current timestamps do not change the fixture key');
  assert.deepEqual(a.restore(a.input), mac);
  assert.deepEqual(b.restore(a.input), linux);
  const records = { example: { operation: 'frame', input: a.input, output: a.input } };
  assert.deepEqual(unpackRecordings(packRecordings(records)), records, 'interning retains the complete recording');
});

test('timestamp occurrences keep the same key across coincident and adjacent clock ticks', () => {
  const at = '2026-10-13T12:00:00.000Z';
  const coincident = { at, frame: { type: 'inbox', inbox: { requests: [{ since: at }, { since: at }] } } };
  const adjacent = structuredClone(coincident);
  adjacent.frame.inbox.requests[0]!.since = '2026-10-13T12:00:00.001Z';
  const a = canonical(coincident, '/fixture', at), b = canonical(adjacent, '/fixture', at);
  assert.deepEqual(a.input, b.input, 'clock coincidences cannot change a recording key');
  assert.deepEqual(a.restore(a.input), coincident);
  assert.deepEqual(b.restore(b.input), adjacent, 'each occurrence restores its own wire timestamp');
});

test('an unmatched recording names its operation and protocol request', () => {
  assert.throws(() => replayFrame('frame', { requestType: 'missing.request', frame: { type: 'result', value: 'not recorded' } }), /unrecorded protocol frame.*operation=frame.*request=missing.request.*key=/);
});

test('a per-file catalog retains complete requested frames and refuses a missing recording', () => {
  const records = {
    first: { operation: 'frame', input: { requestType: 'task.list' }, output: { items: [{ id: 'T-1', title: 'Shared task' }] } },
    second: { operation: 'frame', input: { requestType: 'task.view' }, output: { item: { id: 'T-1', title: 'Shared task' } } },
    unrelated: { operation: 'frame', input: {}, output: { text: 'Unrelated scenario' } },
  };
  const slice = selectRecordings(records, ['first', 'second', 'first']);
  assert.deepEqual(unpackRecordings(packRecordings(slice)), { first: records.first, second: records.second });
  assert.doesNotMatch(JSON.stringify(packRecordings(slice)), /Unrelated scenario/);
  assert.throws(() => selectRecordings(records, ['missing']), /missing.*run npm run test:nvim-fixtures/);
});

test('a slice loads the committed catalog once for a recorded interleaving and still refuses unknown frames', () => {
  const records = {
    first: { operation: 'frame', input: {}, output: { text: 'First frame' } },
    later: { operation: 'frame', input: {}, output: { text: 'Later frame' } },
  };
  let loads = 0;
  const read = recordingReader(packRecordings({ first: records.first }), () => {
    loads++;
    return packRecordings(records);
  });
  assert.deepEqual(read('first', 'frame', {}), { text: 'First frame' });
  assert.equal(loads, 0, 'normal slice reads do not parse the main catalog');
  assert.deepEqual(read('later', 'frame', {}), { text: 'Later frame' });
  assert.deepEqual(read('later', 'frame', {}), { text: 'Later frame' });
  assert.equal(loads, 1, 'the full catalog is cached after its first use');
  assert.throws(() => read('missing', 'frame', { requestType: 'task.view', frame: { type: 'result' } }), /operation=frame request=task.view key=missing/);
});
