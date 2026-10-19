// T1: command resolution preserves the existing suite's mode and selection rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { verificationCommands } from '../src/verification-commands.ts';

test('verification resolves the existing npm lines for every request', () => {
  for (const [mode, command] of [
    ['auto', 'npm test'], ['all', 'npm test'],
    ['hub', 'npm test --workspace hub'], ['nvim', 'npm run test:nvim'],
  ] as const) {
    assert.deepEqual(verificationCommands({ mode }), { check: 'npm run typecheck', test: command });
    assert.deepEqual(verificationCommands({ mode, selection: { mode: 'full', files: [], reason: 'full' } }), { check: 'npm run typecheck', test: 'npm test' });
  }
});


test('verification retains the candidate expanded check line', () => {
  assert.deepEqual(verificationCommands({ mode: 'auto' }, 'npm run check'), { check: 'npm run check', test: 'npm test' });
});
