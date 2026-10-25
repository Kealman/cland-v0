// T1: pure publication policy; no processes, sockets or wall-clock waits.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertPublishable, validateDemoResult } from '../../.agents/skills/qa/qa-demo-policy.ts';

test('demo PASS requires every independently expected fact key, including false and zero facts', () => {
  const result = { result: 'PASS', evidence: [], facts: { connected: true, count: 0, replayed: false } };
  assert.doesNotThrow(() => validateDemoResult(result, 0, ['connected', 'count', 'replayed']));
  assert.throws(() => validateDemoResult(result, 0, ['connected', 'finished']), /missing expected fact/);
  assert.throws(() => validateDemoResult({ ...result, facts: { finished: null } }, 0, ['finished']), /missing expected fact/);
  assert.throws(() => validateDemoResult({ ...result, facts: Object.create({ finished: true }) }, 0, ['finished']), /missing expected fact/);
  for (const malformed of [null, {}, 'finished', ['']]) assert.throws(() => validateDemoResult(result, 0, malformed), /invalid expected fact/);
});

test('demo publication refuses sign-in links, bearer credentials and provider keys without echoing values', () => {
  // Obviously fake values constructed here, never passed through child argv.
  const fake = 'fixture'.repeat(10);
  const secrets = [
    `http://127.0.0.1:7777/auth?token=${fake}`,
    ['sk', 'proj', fake].join('-'), ['dop', 'v1', fake].join('_'), ['ghp', fake].join('_'),
    `Authorization: ${['Bear', 'er'].join('')} ${fake}`,
    `${['OPENAI', 'API', 'KEY'].join('_')}=${fake}`,
  ];
  for (const text of secrets) {
    let message = '';
    try { assertPublishable(text); } catch (error) { message = (error as Error).message; }
    assert.equal(message.includes('secret scan refused publication'), true);
    assert.equal(message.includes(fake), false, 'diagnostic contains no matched value');
    assert.throws(() => assertPublishable(encodeURIComponent(text)), /secret scan refused publication/);
  }
  assert.doesNotThrow(() => assertPublishable('General\n{"connected":true,"count":0}'));
});

test('demo policy accepts the previous headless wire shape and empty error fields', () => {
  assert.doesNotThrow(() => validateDemoResult({ result: 'PASS', evidence: ['grid.txt'], message: 'legacy case' }, 0));
  assert.doesNotThrow(() => validateDemoResult({ result: 'PASS', evidence: [], error: null, steps: [{ error: '' }], errors: [], stepErrors: false }, 0));
});

test('demo publication scans JSON-escaped whitespace in text captures as well as parsed metadata', () => {
  const fake = 'opaque-fixture'.repeat(5);
  for (const whitespace of ['\t', '\n']) {
    const metadata = { message: `${['Bear', 'er'].join('')}${whitespace}${fake}` };
    assert.throws(() => assertPublishable(metadata), /secret scan refused publication/);
    assert.throws(() => assertPublishable(JSON.stringify(metadata)), /secret scan refused publication/);
  }
});

test('demo PASS refuses recorded step errors and nonzero native exits', () => {
  for (const detail of [{ error: 'step failed' }, { steps: [{ error: 'caught exception' }] }, { stepErrors: ['failed'] }, { facts: { done: { error: 'failed' } } }]) {
    assert.throws(() => validateDemoResult({ result: 'PASS', evidence: [], ...detail }, 0), /step error/);
  }
  assert.throws(() => validateDemoResult({ result: 'PASS', evidence: [] }, 1), /nonzero/);
});
