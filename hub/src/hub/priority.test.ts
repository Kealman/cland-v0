// T1: injected OS niceness facts, without changing the test runner's priority.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hubPriority } from './priority.ts';

test('startup priority warns only for positive niceness', () => {
  for (const nice of [-20, -1, 0, 1, 5, 19]) {
    let probes = 0;
    const priority = hubPriority(() => { probes++; return nice; });
    assert.equal(probes, 1);
    assert.equal(priority.nice, nice);
    assert.equal(Boolean(priority.warning), nice > 0);
    if (nice > 0) {
      assert.match(priority.warning!.detail, new RegExp(`below normal priority \\(nice ${nice}\\)`));
      assert.match(priority.warning!.detail, /inherited.*zsh BG_NICE.*background jobs/);
      assert.match(priority.warning!.fix, /restart at nice 0.*foreground shell.*unsetopt BG_NICE.*cland hub stop.*cland hub start.*without `&`/);
    }
  }
});

test('an unavailable priority probe leaves niceness unknown', () => {
  assert.deepEqual(hubPriority(() => { throw new Error('unavailable'); }), { nice: null });
});
