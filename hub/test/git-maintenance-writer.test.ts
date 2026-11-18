// T1: captured writer receipt policy; no native imports or launches.
import test from 'node:test';
import assert from 'node:assert/strict';
import { writerReceipt } from './git-maintenance-writer.ts';

const captured = { pid: 123, birth: 'captured-native-birth', group: 100 };
test('an independent absence receipt retains the captured writer lifetime', () => {
  assert.deepEqual(writerReceipt(captured, { kind: 'absent' }), { pid: 123, birth: 'captured-native-birth', group: 100, kind: 'reaped' });
});
test('a replacement writer never inherits the captured lifetime receipt', () => {
  assert.equal(writerReceipt(captured, { kind: 'present', birth: 'replacement-native-birth' }), undefined);
  assert.equal(captured.birth, 'captured-native-birth');
});
test('missing native identity never becomes an exit receipt', () => {
  assert.equal(writerReceipt(captured, { kind: 'present' }), undefined);
  assert.equal(writerReceipt(captured, { kind: 'present', birth: captured.birth }), undefined);
});
