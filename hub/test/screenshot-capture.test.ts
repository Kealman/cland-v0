// T1: capture scanner and emitted reporter diagnostics; no browser or fixture I/O.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spec, tap } from 'node:test/reporters';
import { captureStep, scanCapture } from '../../site/scripts/capture-safety.ts';

test('capture failures retain a failing outcome without emitting scanned text or navigation secrets', async () => {
  const secrets = ['planted-bearer', 'planted-token', 'planted-link', 'planted-cause', 'planted-custom'];
  const navigation = Object.assign(new Error('page.goto: failed\nCall log:\n - navigating to "http://fixture.test/auth?token=planted-link"', {
    cause: new Error('Bearer planted-cause'),
  }), { actual: 'token=planted-custom', env: { PRIVATE: 'planted-custom' } });
  for (const fail of [
    () => scanCapture('Visible DOM: Bearer planted-bearer', 'scratch-secret'),
    () => scanCapture('Visible DOM: token=planted-token', 'scratch-secret'),
    () => { throw navigation; },
  ]) {
    const error = await captureStep('desktop', fail).then(() => assert.fail('failure must stay rejected'), error => error);
    assert.ok(error instanceof Error, 'still a failure for node:test');
    const reported = Object.assign(new Error('test failed'), { cause: error, code: 'ERR_TEST_FAILURE', failureType: 'testCodeFailure' });
    const event = { type: 'test:fail' as const, data: { name: 'capture control', nesting: 0, testNumber: 1, details: { error: reported, duration_ms: 0 } } };
    const specReporter = new spec();
    specReporter.end(event);
    async function* events() { yield event; }
    for (const reporter of [specReporter, tap(events())]) {
      let diagnostic = '';
      for await (const chunk of reporter) diagnostic += String(chunk);
      assert.ok(diagnostic.length > 0, 'positive reporter output receipt');
      for (const secret of secrets) assert.equal(diagnostic.includes(secret), false, 'emitted diagnostic contains no planted secret');
      assert.match(diagnostic, /Screenshot capture failed during (?:desktop|scan)/);
    }
  }
});

test('capture scanner rejects bearer, token, one-use-link and exact-secret controls without retaining private actual values', () => {
  for (const text of ['Bearer planted-bearer', 'token=planted-token', 'http://fixture.test/auth?token=planted-link', 'scratch-secret']) {
    assert.throws(() => scanCapture(text, 'scratch-secret'), error => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, 'Screenshot capture failed during scan; private diagnostic withheld.');
      assert.equal('actual' in error, false);
      assert.equal('cause' in error, false);
      return true;
    });
  }
  assert.doesNotThrow(() => scanCapture('Checkout flow: 2 of 4 done', 'scratch-secret'));
});

test('capture boundary preserves success and rejects asynchronous navigation and cleanup failures with safe diagnostics', async () => {
  assert.equal(await captureStep('capture', () => 42), 42);
  for (const phase of ['sign-in', 'cleanup'] as const) {
    await assert.rejects(captureStep('capture', () => captureStep(phase, async () => {
      throw Object.assign(new Error('http://fixture.test/auth?token=planted-link'), { actual: 'Bearer planted-bearer' });
    })), error => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, `Screenshot capture failed during ${phase}; private diagnostic withheld.`);
      assert.equal('actual' in error, false);
      assert.equal('cause' in error, false);
      return true;
    });
  }
});
