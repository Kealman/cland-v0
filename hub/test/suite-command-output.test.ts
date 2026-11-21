// T1: pure protected capture, with deterministic chunk/byte boundaries.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ProtectedCommandCapture, COMMAND_CAPTURE_BYTES, COMMAND_TAIL_BYTES } from '../src/suite-command-output.ts';

test('command tail redacts complete capture before cutting away a credential prefix', () => {
  const capture = new ProtectedCommandCapture();
  capture.write('Author');
  capture.write('ization: Bear');
  capture.write('er ' + 'private-fixture-value'.repeat(1400));
  capture.write('\nsrc/parser.ts:7: finding\n');
  const tail = capture.finish();
  assert.doesNotMatch(tail, /private-fixture-value/);
  assert.match(tail, /src\/parser.ts:7: finding/);
  assert.ok(Buffer.byteLength(tail) <= COMMAND_TAIL_BYTES);
  const unicode = new ProtectedCommandCapture();
  unicode.write('é'.repeat(COMMAND_TAIL_BYTES) + 'x');
  assert.ok(Buffer.byteLength(unicode.finish()) <= COMMAND_TAIL_BYTES);
  assert.doesNotMatch(unicode.finish(), /\uFFFD/);
});

test('command capture withholds oversized output while draining without retaining a raw suffix', () => {
  const capture = new ProtectedCommandCapture();
  capture.write('token=' + 'x'.repeat(COMMAND_CAPTURE_BYTES));
  for (let i = 0; i < 20; i++) {
    capture.write('private-fixture-value'.repeat(1000));
    assert.ok(capture.retainedBytes <= COMMAND_CAPTURE_BYTES);
  }
  assert.match(capture.finish(), /output withheld/);
  assert.doesNotMatch(capture.finish(), /private-fixture-value/);
  const combined = new ProtectedCommandCapture();
  combined.write('x'.repeat(COMMAND_CAPTURE_BYTES - 10));
  assert.match(combined.finish('cause'.repeat(10)), /output withheld/);
  assert.equal(combined.retainedBytes, 0);
});
