// T1: eligibility consumes recorded cover identities; no process or wall-clock work.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sameSuiteSelection } from '../src/suite-selection.ts';
import { eligibleLoadRerun, recentCoverGreens } from '../src/suite-load-rerun.ts';

test('only one macOS cover repetition failure of a recent green identity qualifies', () => {
  const base = { platform: 'darwin', cover: true, ordinaryFailed: false, failures: [{ identity: 'a', repetition: 2, timeout: false }], recent: ['a'] };
  assert.equal(eligibleLoadRerun(base), 'a');
  for (const patch of [{ platform: 'linux' }, { cover: false }, { ordinaryFailed: true }, { recent: [] }, { failures: [] }, { failures: [...base.failures, ...base.failures] }, { failures: [{ identity: 'a', repetition: 2, timeout: true }] }]) {
    assert.equal(eligibleLoadRerun({ ...base, ...patch }), null);
  }
});

test('recent evidence is at most five completed covers within seven days and requires positive pass identities', () => {
  const now = Date.parse('2026-10-30T00:00:00Z');
  const cover = { completed: now - 1, green: true, identities: ['a'] };
  assert.deepEqual(recentCoverGreens([cover], now), ['a']);
  assert.deepEqual(recentCoverGreens([{ ...cover, completed: now - 7 * 86400000 - 1 }, { ...cover, green: false }, { ...cover, identities: [] }], now), []);
  assert.deepEqual(recentCoverGreens([cover, ...Array.from({ length: 5 }, () => ({ ...cover, green: false, identities: [] }))], now), []);
});

// An older running hub sends no advisory context; the client still accepts it.
test('previous selection wire shape remains usable without rerun evidence', () => {
  const previous = { mode: 'full' as const, files: [], reason: 'legacy' };
  assert.equal(sameSuiteSelection(previous, { ...previous }), true);
  assert.equal(previous.mode, 'full');
});

test('native retry serialization redacts raw nested diagnostics and bounds their retained tail', async () => {
  const { serializeLoadRerunReceipt } = await import('../src/suite-load-rerun.ts');
  const raw = { results: [{ diagnostic: { message: 'sensitive-fixture-1461 argv: command-tail-1461' } }] };
  assert.match(JSON.stringify(raw), /sensitive-fixture-1461/);
  assert.match(JSON.stringify(raw), /command-tail-1461/);
  const text = serializeLoadRerunReceipt({ code: 1, signal: null, timedOut: false }, raw, { SECRET: 'sensitive-fixture-1461' });
  assert.doesNotMatch(text, /sensitive-fixture-1461|command-tail-1461/);
  assert.match(text, /redacted/);
  assert.equal(JSON.parse(text).code, 1);
  const huge = JSON.parse(serializeLoadRerunReceipt({ code: 1 }, { message: 'x'.repeat(100000) }, {}));
  assert.ok(huge.diagnosticTail.length <= 65536);
});
