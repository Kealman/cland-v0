// T1: private invite capture is a pure stream boundary; no native imports.
import test from 'node:test';
import assert from 'node:assert/strict';
import { privateInviteCapture } from '../../qa/support/invite-capture.ts';

test('invite capture withholds a credential split across chunks and proves its scan control', () => {
  const capture = privateInviteCapture();
  const link = ['http://127.0.0.1:1234/auth?', 'token=', 'a'.repeat(64)].join('');
  capture.write('first\n' + link.slice(0, 24));
  capture.write(link.slice(24) + '\nlast');
  const result = capture.finish();
  assert.equal(result.text, 'first\n<one-time invite link withheld>\nlast');
  assert.equal(result.links, 1);
  assert.equal(result.positiveControl, true);
  assert.equal(result.text.includes(link), false);
  assert.throws(() => capture.assertAbsent([link]), /capture contains private invite/);
  capture.assertAbsent([result.text]);
});

test('invite capture refuses oversized unterminated input before retaining it', () => {
  const capture = privateInviteCapture();
  assert.throws(() => capture.write('x'.repeat(1024 * 1024 + 1)), /byte budget/);
  assert.equal(capture.finish().text, '');
});
