// T1: atomic framing and UTF-8 size boundaries; no hub, I/O or real time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snapshotFrames } from '../src/hub/snapshot.ts';
import { MAX_FRAME_BYTES, SNAPSHOT_LIMITS, type SnapshotDomain, type SnapshotValues } from '../src/protocol.ts';
import { defaultCrew } from '../src/crew.ts';

function empty(): SnapshotValues {
  return {
    tracker: { levels: [], ladder: [], prefixes: {} }, items: { items: [] },
    sessions: { rows: [], processes: [], presence: [], archived: 0, roles: { roles: [], coordinator: null }, crew: { config: defaultCrew(), summary: '' }, coordinator: null, verification: null },
    topics: { topics: [] }, inbox: { asks: [], approvals: [], plans: [], requests: [], messages: [], waiting: [], needsYou: 0 },
    events: { rows: [], before: null, more: false }, accounts: { registry: '', accounts: [] },
  };
}

for (const domain of Object.keys(SNAPSHOT_LIMITS) as SnapshotDomain[]) {
  test(`snapshot refuses ${domain} overflow before returning any frames`, () => {
    const values = empty();
    Object.assign(values[domain], { padding: 'é'.repeat(SNAPSHOT_LIMITS[domain] / 2) });
    const result = snapshotFrames(values, 'epoch', 42);
    assert.ok('refusal' in result);
    assert.ok(!Object.hasOwn(result, 'frames'));
    assert.equal(result.refusal.code, 'frame-too-large');
    if (result.refusal.code !== 'frame-too-large') assert.fail('expected size refusal');
    assert.equal(result.refusal.domain, domain);
    assert.ok(result.refusal.bytes > result.refusal.limit);
    assert.ok(result.refusal.limit <= MAX_FRAME_BYTES);
  });
}

test('a frame exactly at its byte cap is accepted; one extra byte refuses it', () => {
  const values = empty();
  const initial = snapshotFrames(values, 'epoch', 1);
  assert.ok('frames' in initial);
  const accounts = initial.frames.find(f => f.type === 'snapshot' && f.domain === 'accounts')!;
  values.accounts.registry = 'x'.repeat(SNAPSHOT_LIMITS.accounts - Buffer.byteLength(JSON.stringify(accounts)));
  const full = snapshotFrames(values, 'epoch', 1);
  assert.ok('frames' in full);
  assert.equal(Buffer.byteLength(JSON.stringify(full.frames.at(-2))), SNAPSHOT_LIMITS.accounts);
  values.accounts.registry += 'x';
  const refused = snapshotFrames(values, 'epoch', 1);
  assert.ok('refusal' in refused);
});
