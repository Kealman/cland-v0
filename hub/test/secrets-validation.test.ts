// T1: resolved credential validation at the shared resolver boundary; no platform or URL parser.
import './cover-quiet.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as secrets from '../src/remote/secrets.ts';
import { remoteRedactor } from '../src/remote/redact.ts';

const valid = `123456:${'made_up_'.repeat(4)}`;

test('resolved Telegram tokens are refused with fixed diagnostics before provider setup', () => {
  const validate = secrets.validateSecrets;
  for (const value of ['', `0:${'a'.repeat(24)}`, `01:${'a'.repeat(24)}`, `123:${'a'.repeat(23)}`, `123:${'a'.repeat(77)}`, `123:${'a'.repeat(24)}\n`, 'https://invalid.invalid/private', `123:${'a'.repeat(24)}!`, `${'1'.repeat(18)}:${'a'.repeat(24)}`]) {
    let reason = '';
    try { validate({ 'telegram.token': value }); }
    catch (error) { reason = (error as Error).message; }
    assert.ok(reason === 'telegram.token: invalid token format (at most 80 characters)', 'malformed token receives a fixed value-free refusal');
    assert.ok(!value || !reason.includes(value), 'diagnostic does not echo credential');
  }
  for (const value of [valid, `1:${'a'.repeat(24)}`, `${'1'.repeat(17)}:${'a'.repeat(62)}`]) {
    assert.doesNotThrow(() => validate({ 'telegram.token': value }));
  }
  assert.doesNotThrow(() => validate({ 'discord.token': 'opaque ! punctuation', 'speech.xai_key': 'opaque-key' }));
  assert.doesNotThrow(() => validate({}));
});

test('registration retains every resolved credential across reload and isolates projects', () => {
  const first = remoteRedactor();
  const second = remoteRedactor();
  const register = secrets.validateAndRegisterSecrets;
  const values: secrets.Secrets = {
    'telegram.token': valid, 'discord.token': 'opaque-made-up-discord',
    'speech.elevenlabs_key': 'made-up-elevenlabs', 'speech.xai_key': 'made-up-xai',
  };
  register(values, first);
  const text = Object.values(values).join(' ');
  assert.ok(first(text) === '[redacted] [redacted] [redacted] [redacted]', 'all four resolved values are masked');
  const rotated = { ...values, 'discord.token': 'rotated-made-up-discord' };
  register(rotated, first);
  assert.ok(first(`${text} ${rotated['discord.token']}`) === '[redacted] [redacted] [redacted] [redacted] [redacted]', 'old and rotated values are masked');
  assert.ok(second.text(text) === text, 'another project never receives registered values');
  assert.throws(() => register({ 'telegram.token': 'malformed-private-fixture' }, first), /invalid token format/);
  assert.equal(first.text('malformed-private-fixture'), 'malformed-private-fixture', 'invalid configuration is never registered');
  const document = `${'paragraph\n'.repeat(100)}${valid}\nend`;
  assert.ok(first.text(document) === `${'paragraph\n'.repeat(100)}[redacted]\nend`, 'persistence output keeps full document layout and length');
  assert.ok(JSON.stringify(first.value({ text: valid, rows: [rotated['discord.token'], 5, null] })) === JSON.stringify({ text: '[redacted]', rows: ['[redacted]', 5, null] }), 'nested output keeps JSON structure with masked strings');
});

test('opaque credentials beginning with a redaction marker are fully masked on repeated writes', () => {
  const output = remoteRedactor();
  const opaque = '[redacted]made-up-private-suffix';
  secrets.validateAndRegisterSecrets({ 'discord.token': opaque, 'speech.xai_key': 'redact' }, output);
  assert.ok(output.text(`failed ${opaque}`) === 'failed [redacted]', 'the complete opaque value wins over the marker prefix');
  assert.equal(output.text(output.text(`failed ${opaque}`)), 'failed [redacted]');
  const overlapping = remoteRedactor(['redacted]made-up-tail', '[']);
  assert.ok(overlapping.text('[redacted]made-up-tail') === '[redacted]', 'an input marker cannot hide a credential that crosses its boundary');
  assert.equal(overlapping.text('[redacted]'), '[redacted]', 'a short credential inside a marker does not alter it');
});
