import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processGroupGone } from '../../nvim/test/process-group.ts';

test('only ESRCH confirms the Neovim process group is gone', () => {
  const probe = (code: string) => (pid: number, signal: 0) => {
    assert.equal(pid, -123);
    assert.equal(signal, 0);
    throw Object.assign(new Error('probe failed'), { code });
  };
  assert.equal(processGroupGone(123, probe('ESRCH')), true);
  assert.equal(processGroupGone(123, () => true), false);
  for (const code of ['EPERM', 'EIO']) {
    assert.throws(() => processGroupGone(123, probe(code)), new RegExp(code));
  }
});
