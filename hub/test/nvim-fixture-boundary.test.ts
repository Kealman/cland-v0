// T1: source-import closure and recorder drift refusal; no live resources.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { nvimHubImports } from '../src/suite-selection.ts';
import { assertRecordings } from './nvim-fixture-check.ts';
import { recordedOutput } from './nvim-frame-source.ts';
import { canonical, frameRecordingInput, FRAME_FIXTURES, parseRecordings, recordingKey, packRecordings, unpackRecordings, replayFrame, selectRecordings, recordingReader, serializeRecordings } from '../../nvim/test/frame-fixtures.ts';
import { fixtureWork } from '../../test-support/fixture-work.ts';
const root = fileURLToPath(new URL('../../', import.meta.url));
test('the complete catalog fits the hub Git read limit and round-trips every recording', async t => {
  const owner = fixtureWork();
  t.after(() => owner.close());
  await owner.run(async () => {
    const source = await readFile(FRAME_FIXTURES, 'utf8');
    assert.ok(Buffer.byteLength(source) < 16 * 1024 * 1024, 'complete catalog must fit the existing 16 MiB hub Git reader');
    const records = parseRecordings(source);
    const encoded = serializeRecordings(records);
    const fingerprint = (text: string) => createHash('sha256').update(text).digest('hex');
    assert.equal(fingerprint(encoded), fingerprint(source), 'full decode/re-encode retains every catalog byte, key, input and output');
  });
});
test('the catalog has one record per normalized explorer input', async () => {
  const records = parseRecordings(await readFile(FRAME_FIXTURES,'utf8'));
  const keys = Object.values(records).map(r=>recordingKey(r.operation,frameRecordingInput(r.input)));
  assert.equal(new Set(keys).size,keys.length,'duplicate normalized recording keys');
  assert.deepEqual(Object.keys(records).sort(),keys.sort(),'catalog keys use normalized inputs');
});
test('explorer result recordings ignore unrelated archive rows and retain changed wire facts', () => {
  const items = [{id:'R-1',kind:'release',state:'open',version:'0.2.0'}, {id:'E-2',kind:'epic',parent:'R-1',state:'closed'}, {id:'T-3',kind:'task',parent:'E-2',state:'open',status:'review'}];
  const archive = [{id:'R-30',kind:'release',state:'closed',updated:'2026-01-01T00:00:00Z'}, {id:'T-31',kind:'task',state:'closed'}, {id:'T-32',kind:'task',state:'closed',parent:'C-5'}];
  for (const requestType of ['task.plan','task.view']) {
    const frame = {type:'result',ok:true,id:'@request@',value:requestType==='task.plan'?{id:'E-2',plan:null}:{item:items[2]}};
    const before = {requestType,frame,items};
    const after = {...before,items:[...items,...archive]};
    assert.deepEqual(recordedOutput('frame',before),recordedOutput('frame',after));
    const a=canonical(before,'/fixture').input, b=canonical(after,'/fixture').input;
    const records=Object.fromEntries([a,b].map(input=>[recordingKey('frame',input),{operation:'frame',input,output:recordedOutput('frame',input)}]));
    assert.equal(Object.keys(records).length,1,'one canonical entry across archive states');
    const read=recordingReader(packRecordings(records));
    for(const input of [a,b]) assert.deepEqual(read(recordingKey('frame',input),'frame',input),recordedOutput('frame',before));
    const value=requestType==='task.plan'?{id:'E-2',plan:{stages:[{name:'Changed plan'}]}}:{item:{...items[2],title:'Changed wire fact'}};
    const changed=canonical({...before,frame:{...frame,value}},'/fixture').input;
    assert.notEqual(recordingKey('frame',a),recordingKey('frame',changed));
    assert.notDeepEqual(recordedOutput('frame',a),recordedOutput('frame',changed));
    if(requestType==='task.view') {
      assert.notDeepEqual(recordedOutput('frame',a),recordedOutput('frame',canonical({...before,items:items.filter(item=>item.id!=='E-2')},'/fixture').input),'closed ancestor carries active membership');
      assert.notDeepEqual(recordedOutput('frame',a),recordedOutput('frame',canonical({...before,items:[...items,{id:'R-4',kind:'release',state:'open',version:'0.1.0'}]},'/fixture').input),'current release selection remains relevant');
    }
  }
});
test('metadata migration reindexes timestamp slots after pruning archived context', () => {
  const input={at:'@recent:0@',frame:{type:'result',value:{item:{id:'T-3',updated:'@recent:1@'}}},items:[{id:'R-30',state:'closed',updated:'@old:2@'},{id:'T-3',state:'open',updated:'@recent:3@'}],requestType:'task.view'};
  const migrated=frameRecordingInput(input) as typeof input;
  assert.equal(migrated.items[0]!.updated,'@recent:2@');
  assert.deepEqual(migrated.frame,input.frame,'wire frame tokens precede context and remain unchanged');
  assert.deepEqual(frameRecordingInput(migrated),migrated);
});
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

test('recordings match both macOS temp aliases for root and parent paths', () => {
  const expected = { attach: '@parent@/keylog', cwd: '@root@' };
  for (const [privateBase, publicBase] of [['/private/tmp', '/tmp'], ['/private/var/tmp', '/var/tmp']]) {
    for (const base of [privateBase, publicBase]) for (const wireBase of [privateBase, publicBase]) {
      const root = `${base}/cland-sh-abc123/proj-shell`;
      const frame = { cwd: `${wireBase}/cland-sh-abc123/proj-shell`, attach: `${wireBase}/cland-sh-abc123/keylog` };
      const normalized = canonical(frame, root);
      assert.deepEqual(normalized.input, expected, `root ${base}, wire ${wireBase}`);
      assert.deepEqual(normalized.restore(expected), frame, 'replay preserves the original wire spelling');
    }
  }
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

test('compact and previous hash node IDs replay together across a slice fallback', async t => {
  const owner = fixtureWork();
  t.after(() => owner.close());
  await owner.run(async () => {
    const own = { first: { operation: 'frame', input: {}, output: { text: 'Slice output' } } };
    const all = { ...own, later: { operation: 'frame', input: {}, output: { text: 'Catalog output' } } };
    const compact = (records: typeof own | typeof all) => JSON.parse(serializeRecordings(records));
    assert.equal(serializeRecordings(Object.fromEntries(Object.entries(all).reverse())), serializeRecordings(all), 'input enumeration cannot change serialized bytes');
    assert.deepEqual(unpackRecordings(packRecordings(all)), all, 'the previous full-hash node format remains readable');
    for (const [slice, catalog] of [[compact(own), packRecordings(all)], [packRecordings(own), compact(all)]]) {
      const read = recordingReader(slice, () => catalog);
      assert.deepEqual(read('first', 'frame', {}), own.first.output);
      assert.deepEqual(read('later', 'frame', {}), all.later.output);
      assert.deepEqual(read('first', 'frame', {}), own.first.output, 'local node IDs remain scoped to their decoder');
    }
  });
});
