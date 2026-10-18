// T1: reporter events and package report text keep infrastructure outcomes out
// of assertion/quarantine identities, including serialized before-hook causes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { resolve } from 'node:path';
import Reporter from './quarantine-reporter.ts';
import { AdmissionTimeout } from '../src/test-admission-outcome.ts';
import type { QuarantineReceipt } from '../src/suite-quarantine.ts';
import { suiteSummary } from '../src/hub/suites.ts';
import { failingTests } from '../src/hub/shared-defects.ts';

test('package reporting counts one timed-out admission without failed test identities', async () => {
  const file = 'hub/test/busy.test.ts';
  const timeout = new AdmissionTimeout(15000);
  // The wire shape is intentional: a Node reporter receives serialized errors,
  // so instanceof alone cannot classify a failed before hook.
  const hook = { message: 'failed running before hook', failureType: 'hookFailed', cause: { code: timeout.code, message: timeout.message } };
  const events = ['first registered test', 'second registered test'].map(name => ({ type: 'test:fail', data: { name, file: resolve(file), line: 1, nesting: 0, details: { error: hook } } }));
  const reporter = Readable.from([...events, { type: 'test:fail', data: { name: 'ordinary assertion', file: resolve(file), line: 1, nesting: 0, details: { error: { failureType: 'testCodeFailure' } } } }]).pipe(new Reporter());
  let text = '';
  for await (const chunk of reporter) text += chunk;
  const receipt = JSON.parse(text) as QuarantineReceipt;
  assert.deepEqual(receipt.admissionTimeouts, [{ file, message: timeout.message }]);
  assert.deepEqual(receipt.failures, [{ file, name: 'ordinary assertion' }]);
  assert.equal(receipt.excused, 0);
  const log = `suite test failures ${JSON.stringify(receipt.failures)}\nsuite admission timeouts ${JSON.stringify(receipt.admissionTimeouts)}\n`;
  assert.deepEqual(failingTests(log), ['hub/test/busy.test.ts::ordinary assertion']);
  const summary = suiteSummary(log);
  assert.match(summary, /admission timeouts 1/);
  assert.match(summary, /not a test result/);
  assert.doesNotMatch(summary, /first registered test|second registered test/);
  assert.match(summary, /Failures:\nhub\/test\/busy.test.ts::ordinary assertion/);
});

test('a top-level admission failure finalizes earlier nested assertions before a later quarantine pass', async () => {
  const file = 'hub/test/mixed.test.ts';
  const previous = process.env.CLAND_TEST_QUARANTINE;
  let reporter: Reporter;
  try {
    process.env.CLAND_TEST_QUARANTINE = JSON.stringify({ version: 1, tests: { [`${file}::later quarantined pass`]: { owner: 'T-758', reason: 'Planted control.', added: '2026-10-18', expires: '2026-10-19' } } });
    reporter = new Reporter();
  } finally {
    if (previous === undefined) delete process.env.CLAND_TEST_QUARANTINE;
    else process.env.CLAND_TEST_QUARANTINE = previous;
  }
  const events = [
    { type: 'test:fail', data: { file: resolve(file), line: 2, name: 'ordinary child', nesting: 1, details: { error: { failureType: 'testCodeFailure', message: 'ordinary assertion' } } } },
    { type: 'test:fail', data: { file: resolve(file), line: 1, name: 'admission parent', nesting: 0, details: { error: new AdmissionTimeout(15000) } } },
    { type: 'test:pass', data: { file: resolve(file), line: 3, name: 'later quarantined pass', nesting: 0, details: {} } },
  ];
  Readable.from(events).pipe(reporter);
  let text = '';
  for await (const chunk of reporter) text += chunk;
  const receipt = JSON.parse(text) as QuarantineReceipt;
  assert.deepEqual(receipt.failures, [{ file, name: 'ordinary child' }]);
  assert.equal(receipt.excused, 0, 'a later pass cannot consume an earlier assertion');
  assert.deepEqual(receipt.results.map(result => result.outcome), ['pass']);
  assert.equal(receipt.admissionTimeouts?.length, 1);
});
