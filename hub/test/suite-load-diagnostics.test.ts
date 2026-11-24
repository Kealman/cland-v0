// T1: pure diagnostic serialization and redaction; no processes or real time.
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadDiagnostic, redactLoadDiagnostic } from '../src/suite-load-diagnostics.ts';
import LoadGateReporter from './load-gate-reporter.ts';
import cleanupReporter from './hub-cleanup-reporter.ts';

test('diagnostic receipts mask unknown credential contexts before truncating retained bytes', async () => {
  const reporter = new LoadGateReporter({ PRIVATE: 'fixture-env-value' });
  const location = { file: import.meta.filename, line: 7, column: 1, nesting: 0 };
  const credentials = 'Bearer fixture-bearer-value\nAuthorization: Basic fixture-header-value\ntoken=fixture-token-value\napi_key="fixture-key-value"';
  assert.match(credentials, /fixture-bearer-value.*\nAuthorization: Basic fixture-header-value/);
  reporter.write({ type: 'test:fail', data: { ...location, name: 'credential facts', details: { error: new Error('assertion') } } });
  reporter.end({ type: 'test:diagnostic', data: { ...location, message: credentials + '\nfixture-env-value\nowner count 2\n' + '界'.repeat(30_000) + '\nargv: fixture-invocation' } });
  let output = '';
  for await (const chunk of reporter) output += String(chunk);
  assert.doesNotMatch(output, /fixture-(?:bearer|header|token|key|env)-value|fixture-invocation/);
  const line = output.trim().split('\n')[1]!;
  assert.match(line, /owner count 2/);
  assert.match(line, /\[redacted\]/);
  assert.match(line, /\[truncated\]/);
  assert.ok(Buffer.byteLength(line + '\n') <= 65536);
});

test('failure formatting masks unknown credential contexts from diagnostic lines independently', async () => {
  const { serializeLoadGateFailure } = await import('../src/suite-load-diagnostics.ts');
  const record = { file: 'hub/test/fixture.test.ts', name: 'credential facts', diagnosticLine: 'Bearer fixture-bearer-value\nAuthorization: Basic fixture-header-value\ntoken=fixture-token-value\napi_key="fixture-key-value"\nfixture-env-value\nowner count 2\nargv: fixture-invocation' };
  const output = serializeLoadGateFailure({ repetition: 2 }, [record], { PRIVATE: 'fixture-env-value' });
  assert.doesNotMatch(output, /fixture-(?:bearer|header|token|key|env)-value|fixture-invocation/);
  assert.equal(JSON.parse(output).repetition, 2);
  assert.match(JSON.parse(output).diagnosticLines[0].diagnosticLine, /owner count 2/);
});

test('load diagnostic lines retain their producer identity in repetition receipts and failure logs', async () => {
  const reporter = new LoadGateReporter({});
  const location = { file: import.meta.filename, line: 12, column: 3, nesting: 0 };
  reporter.write({ type: 'test:fail', data: { ...location, name: 'owner stopped', details: { error: new Error('assertion') } } });
  // Node drains diagnostics after the result, even when diagnostic() preceded failure.
  reporter.end({ type: 'test:diagnostic', data: { ...location, message: 'remaining owners: 2', level: 'info' } });
  let output = '';
  for await (const chunk of reporter) output += String(chunk);
  const records = output.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(records.length, 2);
  assert.deepEqual(records[1], { file: 'hub/test/suite-load-diagnostics.test.ts', name: 'owner stopped', diagnosticLine: 'remaining owners: 2' });
  const { serializeLoadGateFailure } = await import('../src/suite-load-diagnostics.ts');
  const failure = JSON.parse(serializeLoadGateFailure({ file: records[0].file, name: 'owner stopped', repetition: 3, diagnostics: [{ error: records[0].diagnostic }] }, records, {}));
  assert.equal(failure.repetition, 3);
  assert.equal(failure.diagnostics[0].error.message, 'assertion');
  assert.deepEqual(failure.diagnosticLines, [records[1]]);
});

test('load receipts attribute shared cases to their runner entry and retain older event locations', async () => {
  const reporter = new LoadGateReporter({});
  for (const entryFile of [import.meta.filename, undefined]) reporter.write({ type: 'test:pass', data: {
    nesting: 0, file: import.meta.filename.replace('suite-load-diagnostics.test.ts', 'contract.ts'),
    entryFile, line: 5, name: 'shared case', details: {},
  } });
  reporter.end();
  let output = '';
  for await (const chunk of reporter) output += String(chunk);
  assert.deepEqual(output.trim().split('\n').map(row => JSON.parse(row).file), [
    'hub/test/suite-load-diagnostics.test.ts', 'hub/test/contract.ts',
  ]);
});

test('diagnostic retention redacts before its byte bound and drains excess lines', async () => {
  const reporter = new LoadGateReporter({ PRIVATE: 'private-first\nprivate-second' });
  const location = { file: import.meta.filename, line: 8, column: 2, nesting: 0 };
  reporter.write({ type: 'test:pass', data: { ...location, name: 'bounded facts', details: {} } });
  reporter.write({ type: 'test:diagnostic', data: { ...location, message: 'private-first\\nprivate-second\nargv: pretend invocation\nprivate continuation' } });
  for (let index = 0; index < 30; index++) reporter.write({ type: 'test:diagnostic', data: { ...location, message: '界"\\'.repeat(4096) } });
  reporter.end({ type: 'test:fail', data: { ...location, name: 'final assertion', details: { error: new Error('still observed') } } });
  let output = '';
  for await (const chunk of reporter) output += String(chunk);
  const lines = output.trim().split('\n');
  const records = lines.map(line => JSON.parse(line));
  const kept = lines.filter(line => JSON.parse(line).diagnosticLine !== undefined);
  assert.ok(kept.length > 1, 'positive retention before excess');
  assert.ok(kept.length < 31, 'excess is discarded');
  assert.ok(Buffer.byteLength(kept.join('\n') + '\n') <= 65536);
  assert.equal(records[1].diagnosticLine, '[redacted]\nargv: [redacted]');
  assert.match(kept.at(-1)!, /\[truncated\]/);
  assert.doesNotMatch(output, /private-first|private-second|pretend invocation|private continuation/);
  assert.equal(records.at(-1).diagnostic.message, 'still observed');
});

test('diagnostics distinguish nested producers and wrapper entries without claiming unowned summaries', async () => {
  const reporter = new LoadGateReporter({});
  const location = { file: import.meta.filename, line: 4, column: 1 };
  for (const [entryFile, nesting, name] of [[import.meta.filename, 0, 'outer'], [import.meta.filename, 1, 'nested'], [import.meta.filename.replace('.test.ts', '-wrapper.test.ts'), 0, 'wrapper']] as const) {
    const data = { ...location, entryFile, nesting };
    reporter.write({ type: 'test:pass', data: { ...data, name, details: {} } });
    reporter.write({ type: 'test:diagnostic', data: { ...data, message: `${name} facts` } });
  }
  reporter.end({ type: 'test:diagnostic', data: { file: import.meta.filename, nesting: 0, message: 'tests 3' } });
  let output = '';
  for await (const chunk of reporter) output += String(chunk);
  const records = output.trim().split('\n').map(line => JSON.parse(line)).filter(row => row.diagnosticLine !== undefined);
  assert.deepEqual(records.map(row => [row.name, row.diagnosticLine]), [['outer', 'outer facts'], ['nested', 'nested facts'], ['wrapper', 'wrapper facts']]);
  assert.equal(records[2].file, 'hub/test/suite-load-diagnostics-wrapper.test.ts');
});

test('concurrent wrappers sharing a source keep distinct timing, progress and failure identities', async () => {
  const { default: DurationReporter } = await import('./duration-reporter.ts');
  const { default: skipReporter } = await import('./skip-reporter.ts');
  const { default: QuarantineReporter } = await import('./quarantine-reporter.ts');
  const { suiteProgress } = await import('../src/suite-progress.ts');
  const cwd = process.env.TEST_SUITE_CWD ?? process.cwd();
  const rows = ['first', 'second'].map(name => ({ file: `${cwd}/hub/test/contract.ts`,
    entryFile: `${cwd}/hub/test/${name}.test.ts`, name: 'shared', line: 5, column: 1,
    nesting: 0, testNumber: 1, type: 'test' as const, details: { passed: false, duration_ms: 250,
      error: Object.assign(new Error('assertion'), { failureType: 'testCodeFailure', code: 'ERR_TEST_FAILURE', cause: new Error('assertion') }) } }));
  const durations = new DurationReporter();
  const quarantine = new QuarantineReporter();
  for (const data of rows) {
    durations.write({ type: 'test:complete', data });
    quarantine.write({ type: 'test:fail', data });
  }
  durations.end(); quarantine.end();
  let timing = '', failures = '', progress = '';
  for await (const chunk of durations) timing += String(chunk);
  for await (const chunk of quarantine) failures += String(chunk);
  async function* events() {
    for (const data of rows) {
      yield { type: 'test:dequeue' as const, data };
      yield { type: 'test:complete' as const, data };
    }
  }
  for await (const chunk of skipReporter(events(), { cwd })) progress += chunk;
  const expected = ['hub/test/first.test.ts', 'hub/test/second.test.ts'];
  assert.deepEqual(progress.split('\n').filter(line => line.startsWith('suite start ')).map(line => JSON.parse(line.slice('suite start '.length)).file), rows.map(row => row.entryFile));
  assert.deepEqual(timing.trim().split('\n').map(row => JSON.parse(row)).filter(row => row.file).map(row => row.file), expected);
  assert.deepEqual(JSON.parse(failures).failures.map((row: { file: string }) => row.file), expected);
  assert.deepEqual(suiteProgress(progress, 0)!.completed.map(row => row.file), expected);
});

test('cleanup reporter waits for a held failure receipt and retains the assertion outcome', async () => {
  const held = Promise.withResolvers<void>();
  const entered = Promise.withResolvers<void>();
  const assertion = Object.assign(new Error('arbitrary rendered wording'), {
    code: 'ERR_ASSERTION', actual: { resources: ['Timeout'], listeners: [] },
    expected: { resources: [], listeners: [] }, operator: 'deepStrictEqual',
  });
  async function* events() {
    entered.resolve();
    await held.promise;
    yield { type: 'test:fail', data: { name: 'leaked hub timer', details: {
      error: Object.assign(new Error('hook failed', { cause: assertion }), { failureType: 'hookFailed' }),
    } } };
  }
  let reported = false;
  const reporting = cleanupReporter(events()).next().then(receipt => { reported = true; return receipt; });
  await entered.promise;
  assert.equal(reported, false, 'an entered producer supplies no outcome before its held receipt');
  held.resolve();
  const receipt = JSON.parse((await reporting).value!);
  assert.equal(receipt.name, 'leaked hub timer');
  assert.equal(receipt.error.failureType, 'hookFailed');
  assert.deepEqual(receipt.error.cause, { code: 'ERR_ASSERTION',
    actual: { resources: ['Timeout'], listeners: [] },
    expected: { resources: [], listeners: [] }, operator: 'deepStrictEqual' });
});

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

test('reboot CLI diagnostics redact a credential crossing the tail boundary before truncation', async () => {
  const { rebootCliFailure } = await import('./reboot-cli-diagnostic.ts');
  const { remoteRedactor } = await import('../src/remote/redact.ts');
  const secret = 'planted-private-value';
  const stderr = 'prefix' + secret + 'x'.repeat(8182);
  assert.ok(stderr.slice(-8192).includes(secret.slice(-10)), 'positive control: clipping first exposes credential suffix');
  const error = rebootCliFailure({code: 7, signal: 'SIGTERM', stderr}, remoteRedactor([secret]));
  assert.equal(error.message, 'fake reboot CLI exit 7 signal SIGTERM; stderr: ' + ('prefix[redacted]' + 'x'.repeat(8182)).slice(-8192));
  assert.ok(!error.message.includes(secret.slice(-10)));
  const receipt = redactLoadDiagnostic(loadDiagnostic(error), {});
  assert.equal(receipt.message, error.message, 'suite preserves native exit and sanitized stderr');
});
