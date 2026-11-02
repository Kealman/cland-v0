// T1: pure directory precedence and unchanged spend location.
import test from 'node:test';
import assert from 'node:assert/strict';
import { userStateDirectory, legacySpendPath } from '../src/state-paths.ts';
import { spendPath } from '../src/executor/droplet/spend.ts';
import { join } from 'node:path';
test('per-user state precedence preserves executor override, XDG and HOME fallbacks', () => {
  for (const [env, expected] of [
    [{ HOME: '/scratch/home' }, '/scratch/home/.local/state/cland'],
    [{ HOME: '/scratch/home', XDG_STATE_HOME: '/scratch/state' }, '/scratch/state/cland'],
    [{ HOME: '/scratch/home', XDG_STATE_HOME: '/scratch/state', CLAND_EXECUTOR_STATE: '/scratch/override' }, '/scratch/override'],
    [{ HOME: '/scratch/home', XDG_STATE_HOME: '' }, '/scratch/home/.local/state/cland'],
  ] as const) {
    assert.equal(userStateDirectory(env), expected);
    assert.equal(spendPath(env), join(expected, 'spend.json'));
  }
  assert.equal(legacySpendPath({ HOME: '/scratch/home' }), '/scratch/home/.cland/executor/spend.json');
  assert.equal(legacySpendPath({ CLAND_EXECUTOR_STATE: '/scratch/override' }), null);
});
