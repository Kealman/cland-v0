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


test('capture redaction preserves JSON lines and suite timing records with synthetic credentials', () => {
  const planted = 'synthetic-capture-private-\\-"-value';
  const redact = remoteRedactor([planted]);
  for (const secret of ['https://messenger.invalid/private?token=synthetic-url-value', 'Bearer synthetic-bearer-value', 'token="synthetic token value"', planted]) {
    const record = { file: 'fixture.test.ts', name: secret, rows: [secret, { detail: secret }], seconds: 1, ok: true, empty: null };
    const json = JSON.stringify(record);
    assert.ok(json.includes(JSON.stringify(secret).slice(1, -1)), 'positive control: capture contains the planted value');
    for (const prefix of ['', 'suite timing ']) {
      const output = redact.text(prefix + json);
      const parsed = JSON.parse(output.slice(prefix.length));
      assert.deepEqual(parsed, { ...record, name: '[redacted]', rows: ['[redacted]', { detail: '[redacted]' }] });
      assert.ok(!output.includes(JSON.stringify(secret).slice(1, -1)), 'complete planted value is absent');
      assert.equal(redact.text(output), output, 'repeated capture writes remain stable');
      assert.equal(redact(prefix + json), output, 'bounded diagnostic shares the structure-preserving path');
    }
  }
});


test('capture redaction retains mixed line endings and conservative non-JSON controls', () => {
  const redact = remoteRedactor(['synthetic-registered-value']);
  const line = JSON.stringify({ name: 'Bearer synthetic-value', count: 3 });
  const input = `plain synthetic-registered-value\r\nsuite timing ${line}\r\n${line}\nBearer\nsynthetic-multiline-value`;
  assert.ok(input.includes('synthetic-multiline-value'), 'positive control precedes filtering');
  assert.equal(redact.text(input), 'plain [redacted]\r\nsuite timing {"name":"[redacted]","count":3}\r\n{"name":"[redacted]","count":3}\n[redacted]');
  assert.equal(redact.text('Bearer {\"private\":\"synthetic-value\"}'), '[redacted]');
  assert.equal(redact.text('Bearer\n{\"private\":\"synthetic-value\"}'), '[redacted]');
  assert.equal(remoteRedactor(['{\"private\":1}']).text('{\"private\":1}'), '"[redacted]"');
  assert.equal(redact.text('token={\"private\":\"synthetic-value\"}'), '[redacted]');
  assert.equal(redact.text('incomplete {"name":"Bearer synthetic-value'), 'incomplete {"name":"[redacted]');
});


test('capture JSON masks registered keys while structured protocol values retain schema keys', () => {
  const secret = 'synthetic-key-private-value';
  const redact = remoteRedactor([secret]);
  const record = { [secret]: secret, stable: 1 };
  const input = JSON.stringify(record);
  assert.ok(input.includes(secret), 'positive control: planted key and value exist');
  assert.deepEqual(JSON.parse(redact.text(input)), { '[redacted]': '[redacted]', stable: 1 });
  assert.deepEqual(redact.value(record), { [secret]: '[redacted]', stable: 1 });
});


test('root JSON strings preserve quotes around URL, Bearer and registered credentials', () => {
  const secret = 'synthetic-root-private-value';
  const redact = remoteRedactor([secret]);
  for (const value of ['https://messenger.invalid/private', 'Bearer synthetic-value', 'token="synthetic value"', secret]) {
    const input = JSON.stringify(value);
    assert.equal(JSON.parse(input), value, 'positive control: credential is planted');
    assert.equal(JSON.parse(redact.text(input)), '[redacted]');
  }
});

test('nested registered serialized credentials cannot survive JSON capture normalization', () => {
  const secret = '{"private":1}';
  const redact = remoteRedactor([secret]);
  for (const input of ['{"wrapped":{"private":1},"ok":true}', '[{"private":1},true]']) {
    assert.ok(input.includes(secret), 'positive control: complete structured secret exists');
    const output = redact.text(input);
    assert.ok(!output.includes(secret), 'complete registered span must be absent');
    assert.equal(JSON.parse(output), '[redacted]', 'a credential spanning syntax masks the entire JSON payload');
  }
});

test('bracketed raw capture lines stay within a linear regex scan-byte budget', t => {
  const input = 'ordinary [message]\n'.repeat(200);
  const redact = remoteRedactor();
  const original = RegExp.prototype.exec;
  let bytes = 0;
  t.mock.method(RegExp.prototype, 'exec', function(this: RegExp, value: string) {
    if (this.source.includes('bearer') && this.lastIndex === 0) bytes += value.length;
    return original.call(this, value);
  });
  assert.equal(redact.text(input), input);
  assert.ok(bytes > 0, 'positive control: production credential regex was observed');
  assert.ok(bytes <= input.length * 4, `credential regex scanned ${bytes} bytes for ${input.length} input bytes`);
});


test('original noncanonical structured registered spans mask JSON before normalization', () => {
  const secret = '{"private": "synthetic-value"}';
  const input = '{"wrapped":' + secret + ',"ok":true}';
  assert.ok(input.includes(secret), 'positive control: original formatted credential exists');
  const redact = remoteRedactor();
  redact.register([secret]);
  const output = redact.text(input);
  assert.equal(JSON.parse(output), '[redacted]');
  assert.ok(!output.includes('synthetic-value'), 'normalization cannot expose credential contents');
});

test('registered spans crossing JSON records mask every intersected payload', () => {
  const secret = 'alpha"}\n{"detail":"omega';
  const input = '{"detail":"' + secret + '"}\n';
  assert.ok(input.includes(secret), 'positive control: multiline credential exists');
  const output = remoteRedactor([secret]).text(input);
  assert.deepEqual(output.trimEnd().split('\n').map(line => JSON.parse(line)), ['[redacted]', '[redacted]']);
  assert.ok(!output.includes('alpha') && !output.includes('omega'), 'neither credential fragment is exposed');
});


test('original registered spans also govern adjacent raw-text emission slices', () => {
  for (const [secret, input] of [
    ['alpha"}\nplain omega', '{"detail":"alpha"}\nplain omega tail'],
    ['plain alpha\n{"detail":"omega', 'plain alpha\n{"detail":"omega"}'],
  ]) {
    assert.ok(input!.includes(secret!), 'positive control: cross-boundary credential exists');
    const output = remoteRedactor([secret!]).text(input!);
    assert.ok(!output.includes('alpha') && !output.includes('omega'), 'raw slices never release credential fragments');
  }
  const secret = 'synthetic-contained-value';
  const input = JSON.stringify({ detail: secret, ok: true });
  assert.ok(input.includes(secret), 'positive control: string-contained credential exists');
  assert.deepEqual(JSON.parse(remoteRedactor([secret]).text(input)), { detail: '[redacted]', ok: true });
});


test('numeric-looking strings retain snowflake precision through every redaction API', () => {
  const redact = remoteRedactor();
  const snowflake = '90071992547410001';
  for (const value of [snowflake, '1e3', '-0', '90071992547410003']) {
    assert.equal(redact.text(value), value);
    assert.equal(redact(value), value);
    assert.deepEqual(redact.value({ id: value }), { id: value });
  }
});
