// T1: reboot evidence is a pure comparison of persisted birth and authenticated hello.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hostBootChanged } from '../src/host/process-host.ts';

const before = '00000000-0000-4000-8000-000000000001';
const after = '00000000-0000-4000-8000-000000000002';
test('only a changed positive boot id proves a host reboot', () => {
  assert.equal(hostBootChanged(`linux:${before}:123`, after), true);
  assert.equal(hostBootChanged(`linux:${before}:123`, before), false);
  for (const hello of [null, undefined, '', 'unavailable', 'boot:other', '-'.repeat(36)]) {
    assert.equal(hostBootChanged(`linux:${before}:123`, hello), false);
  }
  for (const identity of [null, undefined, '', 'darwin:123', before, `linux:${before}`, `linux:${before}:unknown`, `linux:${'-'.repeat(36)}:123`]) {
    assert.equal(hostBootChanged(identity, after), false);
  }
});
