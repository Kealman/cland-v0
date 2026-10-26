// T1: pure diagnostic serialization and redaction; no processes or real time.
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadDiagnostic, redactLoadDiagnostic } from '../src/suite-load-diagnostics.ts';
import LoadGateReporter from './load-gate-reporter.ts';

test('a reasoned platform skip supplies five skipped receipts while a boolean skip supplies no proof', async () => {
  const otherPlatform = process.platform === 'linux' ? 'darwin' : 'linux';
  const skip = process.platform !== otherPlatform ? 'requires the other platform' : false;
  for (const [value, expected] of [[skip, 5], [true, 0]] as const) {
    const reporter = new LoadGateReporter({});
    for (let repetition = 0; repetition < 5; repetition++) reporter.write({ type: 'test:pass', data: {
      nesting: 0, file: import.meta.filename, line: 1, name: 'platform prerequisite', skip: value, details: {},
    } });
    reporter.end();
    let output = '';
    for await (const chunk of reporter) output += String(chunk);
    const receipts = output.trim().split('\n').map(line => JSON.parse(line));
    assert.equal(receipts.length, 5);
    assert.equal(receipts.filter(receipt => receipt.skipReason === 'requires the other platform').length, expected);
    assert.ok(receipts.every(receipt => receipt.passed === false && receipt.diagnostic === undefined));
  }
});

test('load diagnostics retain assertions and causes without arbitrary error properties', () => {
  const assertion = new Error('expected a completion receipt');
  assertion.name = 'AssertionError';
  const wrapper = Object.assign(new Error('test failed', { cause: assertion }), {
    code: 'ERR_TEST_FAILURE', failureType: 'testCodeFailure',
    env: { PRIVATE: 'never serialize this' }, spawnargs: ['private invocation'],
  });
  const diagnostic = loadDiagnostic(wrapper);
  assert.equal(diagnostic.code, 'ERR_TEST_FAILURE');
  assert.equal(diagnostic.cause?.name, 'AssertionError');
  assert.equal(diagnostic.cause?.message, 'expected a completion receipt');
  assert.match(diagnostic.cause?.stack ?? '', /at .*suite-load-diagnostics.test.ts:/);
  assert.doesNotMatch(JSON.stringify(diagnostic), /never serialize|private invocation/);
});

test('load diagnostics redact environment values and labelled command lines', () => {
  const diagnostic = redactLoadDiagnostic({ message: 'assertion abc\nexpected receipt\ncommand line: pretend executable --private', stack: 'AssertionError: abc\n at fixture.test.ts:7:9' }, { PRIVATE: 'abc', SHORT: '7', EMPTY: '' });
  assert.equal(diagnostic.message, 'assertion [redacted]\nexpected receipt\ncommand line: [redacted]');
  assert.equal(diagnostic.stack, 'AssertionError: [redacted]\n at fixture.test.ts:[redacted]:9');
  for (const label of ['Command failed', 'argv', 'spawnargs']) {
    assert.equal(redactLoadDiagnostic(`${label}: private invocation`, {}), `${label}: [redacted]`);
  }
});

test('load diagnostics redact multiline invocations and escaped environment values while retaining frames', () => {
  const message = 'assertion "private-first\\nprivate-second"\nCommand failed: fixture invocation\nprivate-command-continuation';
  const result = redactLoadDiagnostic({ message, stack: `Error: ${message}\n    at fixture.test.ts:42:9` }, { PRIVATE: 'private-first\nprivate-second' });
  assert.equal(result.message, 'assertion "[redacted]"\nCommand failed: [redacted]');
  assert.equal(result.stack, 'Error: assertion "[redacted]"\nCommand failed: [redacted]\n    at fixture.test.ts:42:9');
});

test('the reporter receipt redacts multiline command tails and escaped environment values', async () => {
  const reporter = new LoadGateReporter({ PRIVATE: 'private-first\nprivate-second' });
  const error = new Error('assertion "private-first\\nprivate-second"\nCommand failed: fixture invocation\n    at private-command-continuation');
  reporter.end({ type: 'test:fail', data: { nesting: 0, file: import.meta.filename, line: 1, name: 'planted', details: { error } } });
  let receipt = '';
  for await (const chunk of reporter) receipt += String(chunk);
  assert.doesNotMatch(receipt, /private-first|private-second|fixture invocation|private-command-continuation/);
  const record = JSON.parse(receipt);
  assert.equal(record.diagnostic.message, 'assertion "[redacted]"\nCommand failed: [redacted]');
  assert.match(record.diagnostic.stack, /at .*suite-load-diagnostics.test.ts:/);
});
