// T1: frozen pre-refactor bytes cover every existing named help export.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { frozenUsage } from './cli-usage-fixture.ts';
import * as usage from '../src/cli/usage.ts';

test('all command usage exports retain their pre-refactor bytes', () => {
  const expected = frozenUsage();
  assert.deepEqual({ ...usage }, expected);
});
