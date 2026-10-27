import assert from 'node:assert/strict';
import { test } from 'node:test';
import { remoteRedactor } from './redact.ts';

test('remote redaction replaces overlapping registered secrets once without rewriting markers', () => {
  const redact = remoteRedactor(['', 'redact', 'fixture[secret]', 'fixture', 'fixture[secret]']);
  assert.equal(redact('failure fixture[secret] redact fixture'), 'failure [redacted] [redacted] [redacted]');
});

test('remote redaction scrubs URLs, Bearer credentials and quoted token/key assignments in one pass', () => {
  const redact = remoteRedactor(['redact']);
  assert.equal(redact('failed https://messenger.invalid/private Bearer fixture-value token="two words" API_KEY=fixture-value'),
    'failed [redacted] [redacted] [redacted] [redacted]');
  assert.equal(remoteRedactor(['https'])('failed https://messenger.invalid/private'), 'failed [redacted]', 'a short registered value cannot hide a URL from scrubbing');
});

test('remote diagnostics flatten control characters and bound the retained reason after redaction', () => {
  const redact = remoteRedactor(['private-value']);
  assert.equal(redact('failed\nprivate-value\u0000next'), 'failed [redacted] next');
  assert.equal(redact('x'.repeat(1000)).length, 500);
});

test('only hub output can mask endpoint and attach metadata while identifiers stay strict', async () => {
  const { redactFrame, redactHubFrame } = await import('./redact.ts');
  const redact = remoteRedactor(['synthetic-private-value']);
  const process = { harnessId: 'http://127.0.0.1:1234/synthetic-private-value', attach: 'opencode --server http://127.0.0.1:1234/synthetic-private-value' };
  const output = redactHubFrame({ type: 'result', id: 'metadata', ok: true, value: { process } }, redact.text);
  assert.deepEqual(output, { type: 'result', id: 'metadata', ok: true, value: { process: { harnessId: '[redacted]', attach: 'opencode --server [redacted]' } } });
  assert.throws(() => redactFrame({ type: 'inbox.list', id: 'metadata', ...process }, redact.text), /protocol routing/);
  assert.throws(() => redactHubFrame({ type: 'result', id: 'synthetic-private-value', ok: true, value: {} }, redact.text), /protocol routing/);
});
