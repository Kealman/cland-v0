// T1: a stalled transport reports its unsent bytes; only the model stream pauses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ModelOutput } from '../src/hub/model-output.ts';
import type { HubFrame } from '../src/protocol.ts';

test('passing four MiB of unsent bytes sends one resync and holds model writes until resume', () => {
  const frames: HubFrame[] = [];
  let bytes = 0;
  const output = new ModelOutput({
    bufferedBytes: () => bytes,
    send: frame => { frames.push(frame); bytes += Buffer.byteLength(JSON.stringify(frame)); },
    isOpen: () => true,
  });
  const delta = { type: 'visibility' as const, epoch: 'epoch', seq: 1 };
  const size = Buffer.byteLength(JSON.stringify(delta));
  bytes = 4 * 1024 * 1024 - size;
  assert.equal(output.send(delta), true, 'exactly the limit is allowed');
  assert.equal(output.send({ ...delta, seq: 2 }), false);
  assert.equal(output.send({ ...delta, seq: 3 }), false);
  assert.deepEqual(frames, [delta, { type: 'resync', reason: 'queue-limit' }]);
  bytes = 0; // reader drains the transport queue
  assert.equal(output.send({ ...delta, seq: 2 }), false, 'drain alone does not restart a paused model');
  output.resume();
  assert.equal(output.send({ ...delta, seq: 2 }), true);
  assert.deepEqual(frames.at(-1), { ...delta, seq: 2 });
});

test('transport framing bytes crossing the limit after a write also resync the model', () => {
  let bytes = 0;
  const frames: HubFrame[] = [];
  const output = new ModelOutput({
    bufferedBytes: () => bytes,
    send: frame => { frames.push(frame); bytes += Buffer.byteLength(JSON.stringify(frame)) + 1; },
    isOpen: () => true,
  });
  const delta = { type: 'visibility' as const, epoch: 'epoch', seq: 1 };
  bytes = 4 * 1024 * 1024 - Buffer.byteLength(JSON.stringify(delta));
  output.send(delta);
  assert.deepEqual(frames, [delta, { type: 'resync', reason: 'queue-limit' }]);
});
