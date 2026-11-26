// T1: retained wire deltas at the fake-clock and byte boundaries.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ModelRing } from '../src/hub/model-ring.ts';
import { FakeClock } from './fake-clock.ts';
import {publicationWork} from './publication-work.ts';

const delta = (seq: number) => ({ type: 'visibility' as const, epoch: 'epoch', seq });

test('publication accounting includes suffix fragments and small standalone or nested layer maps', () => {
  const work=publicationWork(JSON.stringify);
  work.start();
  assert.equal(work.stringify({epoch:'e',seq:1}),'{"epoch":"e","seq":1}');
  assert.equal(work.stringify({'T-2':null}),'{"T-2":null}');
  assert.equal(work.stringify({type:'task',layers:{'T-3':'now'}}),'{"type":"task","layers":{"T-3":"now"}}');
  // Fixed literal byte lengths: suffix 21, small map 12, task 38.
  assert.deepEqual(work.stop(),{encodedBytes:71,mapEntriesSerialized:2});
});

test('task replay preserves previous wire bytes with layers before or after sequence fields', t => {
  const ring = new ModelRing(new FakeClock());
  t.after(() => ring.close());
  const layers = { 'R-1': 'background' as const, 'T-2': 'now' as const };
  const full = { type: 'task' as const, id: 'T-2', item: null, layers, epoch: 'epoch', seq: 1 };
  const slim = { ...full, layers: { 'T-2': null } };
  const expected = '{"type":"task","id":"T-2","item":null,"layers":{"R-1":"background","T-2":"now"},"epoch":"epoch","seq":1}';
  assert.equal(ring.append(full, slim).full, expected);
  assert.deepEqual(ring.after(0, false), [expected]);
  assert.deepEqual(ring.after(0, true), ['{"type":"task","id":"T-2","item":null,"layers":{"T-2":null},"epoch":"epoch","seq":1}']);
  const reordered = { type: 'task' as const, id: 'T-2', item: null, epoch: 'epoch', seq: 2, layers };
  assert.equal(ring.append(reordered).full, '{"type":"task","id":"T-2","item":null,"epoch":"epoch","seq":2,"layers":{"R-1":"background","T-2":"now"}}');
});

test('a resume retains exactly fifteen minutes and accepts the last evicted number', t => {
  const clock = new FakeClock(0);
  const ring = new ModelRing(clock);
  t.after(() => ring.close());
  ring.append(delta(1));
  clock.block(1);
  ring.append(delta(2));
  clock.block(15 * 60 * 1000 - 1);
  assert.deepEqual(ring.after(0, false)?.map(value => JSON.parse(value)), [delta(1), delta(2)]);
  clock.block(1);
  assert.equal(ring.after(0, false), null);
  assert.deepEqual(ring.after(1, false)?.map(value => JSON.parse(value)), [delta(2)]);
  clock.block(1);
  assert.equal(ring.after(1, false), null);
  assert.deepEqual(ring.after(2, false), []);
  assert.equal(ring.after(3, false), null);
});

test('the ring caps UTF-8 wire bytes at four MiB including both negotiated shapes', t => {
  const ring = new ModelRing(new FakeClock());
  t.after(() => ring.close());
  // A session id is multibyte so character counts cannot stand in for bytes.
  const base = { ...delta(1), type: 'sessions.pruned' as const, sessionIds: [''], archived: 0 };
  const padding = 4 * 1024 * 1024 - Buffer.byteLength(JSON.stringify(base));
  const frame = { ...base, sessionIds: ['é'.repeat(Math.floor(padding / 2)) + 'x'.repeat(padding % 2)] };
  assert.equal(Buffer.byteLength(JSON.stringify(frame)), 4 * 1024 * 1024);
  ring.append(frame);
  assert.equal(ring.after(0, false)?.length, 1);
  ring.append(delta(2));
  assert.equal(ring.after(0, false), null);
  assert.deepEqual(ring.after(1, true)?.map(value => JSON.parse(value)), [delta(2)]);
  // Distinct slim/full strings count towards the same cap, rather than each getting 4 MiB.
  ring.append({ ...frame, seq: 3 }, { ...delta(3), type: 'visibility' });
  assert.equal(ring.after(2, false), null);
  assert.deepEqual(ring.after(3, false), []);
});

test('close is terminal when a late disconnect publication appends another model delta', () => {
  const clock = new FakeClock();
  const ring = new ModelRing(clock);
  ring.append(delta(1));
  ring.close();
  assert.equal(clock.pending, 0, 'close clears the current retention timer');
  ring.append(delta(2)); // a socket close can publish after the core starts shutting down
  assert.equal(clock.pending, 0, 'a closed ring cannot rearm retention');
  assert.equal(ring.after(1, false), null, 'a closed model stream has no resumable history');
  ring.close();
  assert.equal(clock.pending, 0);
});
