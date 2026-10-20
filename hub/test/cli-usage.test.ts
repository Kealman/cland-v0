// T1: exported help text is pure; no hub or CLI process is needed.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PUSH_USAGE } from '../src/cli/usage.ts';

test('push help names the Coordinator, Aide and human as allowed callers', () => {
  assert.equal(PUSH_USAGE, '  push [--json]         fast-forward territory dev to root dev; Coordinator’s or Aide’s shell, or human\n');
});
