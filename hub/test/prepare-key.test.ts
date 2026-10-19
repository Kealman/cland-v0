// T1: snapshot key compatibility and optional-part comparisons are pure rules.
import assert from 'node:assert/strict';
import test from 'node:test';
import { keyHash, sameKey, staleParts, type PrepareKey, type Snapshot } from '../src/executor/droplet/prepare.ts';

const full = { node: 'v24.13.0', nvim: { tag: 'v0.12.5', digest: 'bce0f56eda1f1b1db6eee8f4133d7a38813ea07933837dd1777411ca384c6875' }, lock: 'b'.repeat(64), base: 'c'.repeat(40) };

test('four-part prepare keys retain the existing snapshot hash', () => {
  // Recorded from the pre-T-669 implementation; existing snapshots must stay current.
  assert.equal(keyHash(full), '7599b8d463c5');
  assert.equal(sameKey(full, structuredClone(full)), true);
  assert.deepEqual(staleParts({ key: full } as Snapshot, structuredClone(full)), []);
});

test('absent prepare parts compare as none and become stale only when added or removed', () => {
  const bare: PrepareKey = { node: full.node, base: full.base };
  assert.equal(sameKey(bare, { ...bare }), true);
  assert.deepEqual(staleParts({ key: bare } as Snapshot, { ...bare }), []);
  assert.equal(sameKey(bare, full), false);
  assert.equal(sameKey(full, bare), false);
  assert.deepEqual(staleParts({ key: bare } as Snapshot, full), ['lock', 'nvim']);
  assert.deepEqual(staleParts({ key: full } as Snapshot, bare), ['lock', 'nvim']);
});
