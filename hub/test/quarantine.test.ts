import assert from 'node:assert/strict';
import test from 'node:test';
import { lintQuarantineManifest, recordQuarantineResults, type QuarantineHistory, type QuarantineResult } from '../src/suite-quarantine.ts';

test('quarantine requires an owner, a reason and at most seven days, and expiry names the test', () => {
  const identity = 'hub/test/example.test.ts::known flake';
  const entry = { owner: 'T-657', reason: 'Two independent flaky runs; isolated 5/5 green.', added: '2026-10-16', expires: '2026-10-23' };
  const manifest = { version: 1, tests: { [identity]: entry } };
  const now = Date.parse('2026-10-16T12:00:00Z');
  assert.doesNotThrow(() => lintQuarantineManifest(manifest, now));
  for (const invalid of [{ owner: '' }, { reason: 'TODO' }, { expires: '2026-10-24' }, { added: '2026-02-30' }]) {
    assert.throws(() => lintQuarantineManifest({ ...manifest, tests: { [identity]: { ...entry, ...invalid } } }, now), /hub\/test\/example.test.ts::known flake/);
  }
  assert.throws(() => lintQuarantineManifest(manifest, Date.parse('2026-10-23T00:00:00Z')), /expired quarantine: hub\/test\/example.test.ts::known flake/);
});

test('twenty distinct recorded green results clear quarantine; failures and skips reset it and cache hits do not count', () => {
  const result: QuarantineResult = { file: 'hub/test/example.test.ts', name: 'known flake', outcome: 'pass', entry: { owner: 'T-657', reason: 'Known flake.', added: '2026-10-16', expires: '2026-10-23' } };
  let history: QuarantineHistory = {};
  const record = (id: string, results = [result], cached = false) => {
    const next = recordQuarantineResults(history, id, results, cached);
    history = next.history;
    return next.lines.join('\n');
  };
  for (let i = 0; i < 19; i++) assert.doesNotMatch(record(`green-${i}`), /cleared/);
  assert.doesNotMatch(record('green-18'), /cleared/, 'report retries count once');
  assert.doesNotMatch(record('cached', [result], true), /cleared/, 'cache reuse supplies no fresh observation');
  assert.match(record('green-19'), /cleared.*20 consecutive green/);
  assert.doesNotMatch(record('failed', [{ ...result, outcome: 'fail' }]), /cleared/);
  for (let i = 0; i < 19; i++) assert.doesNotMatch(record(`again-${i}`), /cleared/);
  assert.doesNotMatch(record('skipped', [{ ...result, outcome: 'skip' }]), /cleared/);
  assert.doesNotMatch(record('after-skip'), /cleared/);
  for (let i = 0; i < 19; i++) record(`last-${i}`);
  assert.match(record('last-19'), /cleared/);
  assert.doesNotMatch(record('new-entry', [{ ...result, entry: { ...result.entry, added: '2026-10-17' } }]), /cleared/, 'a renewed entry starts a new streak');
});
