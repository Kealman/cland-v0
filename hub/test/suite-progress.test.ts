// T1: execution-order reporter events and receipt reduction use FakeClock, no worker.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { TestEvent } from 'node:test/reporters';
import skipReporter from './skip-reporter.ts';
import { FakeClock } from './fake-clock.ts';
import { suiteProgress, progressLines } from '../src/suite-progress.ts';

async function* events(rows: TestEvent[]) { yield* rows; }

test('execution completion is streamed before any ordered pass or reporter flush', async () => {
  const file = '/project/hub/test/example.test.ts';
  const start = { file, name: 'finished behind hang', nesting: 0, line: 9, column: 1, type: 'test' as const, testId: 1 };
  const clock = new FakeClock();
  // Stop consuming before source EOF: the log must already contain the finish.
  const report = skipReporter(events([
    // The outer file and its first test have IDs from different Node workers.
    { type: 'test:dequeue', data: { ...start, name: 'hub/test/example.test.ts', line: 1 } },
    { type: 'test:dequeue', data: start },
    { type: 'test:complete', data: { ...start, testNumber: 2, details: { passed: true, duration_ms: 250 } } },
  ]), { cwd: '/project', clock, timings: true });
  let log = '';
  for (let n = 0; n < 6 && !log.includes('"event":"finish"'); n++) {
    const row = await report.next();
    assert.equal(row.done, false, 'completion must precede exit-only skip details');
    log += row.value;
  }
  assert.match(log, /suite progress .*"event":"finish".*"outcome":"pass"/);
  assert.match(log, /suite timing .*"seconds":0.25/);
  const receipt = suiteProgress(log, clock.now().getTime());
  assert.equal(receipt!.completed[0]!.name, 'finished behind hang');
  assert.deepEqual(receipt!.unfinished.map(row => row.name), ['hub/test/example.test.ts']);
  await report.return('');
});

test('a recovered report retains the durable partial result after machine deletion', async t => {
  const { suiteUnit } = await import('./suite-unit-fixture.ts');
  const f = await suiteUnit(t, { executor: 'droplet', durationContext: null });
  const job = await f.launch();
  await f.machine.waits.run(f.machine.started(job.id));
  await f.suites.settled();
  const at = f.clock.now().getTime();
  const identity = { id: 'a', file: 'hub/test/a.test.ts', name: 'hung', nesting: 0 };
  const log = `suite progress ${JSON.stringify({ ...identity, event: 'start', at })}\n`
    + `suite progress ${JSON.stringify({ ...identity, event: 'finish', at: at + 11000, outcome: 'cancelled', seconds: 11, timedOut: true })}\n`;
  f.clock.block(11000);
  f.beforeReport(async () => { throw new Error('reporting unavailable'); });
  await f.finish(job.id, 1, log, false);
  await f.suites.settled();
  const { readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const path = join(f.root, '.cland/run/suites', job.id, 'result.json');
  const before = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(before.progress.unfinished.length, 1);
  assert.equal(before.progress.unfinished[0].timedOut, true);
  assert.deepEqual(f.api.droplets, []);
  await f.reopen();
  f.beforeReport(async () => {});
  await f.tick();
  await f.machine.waits.run(f.result(job.id));
  const after = JSON.parse(await readFile(path, 'utf8'));
  assert.deepEqual(after.progress, before.progress);
  assert.equal(((await f.log(job.id)).match(/^hung: /gm) ?? []).length, 1);
});

test('merged child logs retain each machine interruption time', () => {
  const start = (id: string, at: number) => `suite progress ${JSON.stringify({ event: 'start', id, at, file: 'hub/test/same.test.ts', name: 'hang', nesting: 0 })}\n`;
  const log = start('child-one', 1000) + 'suite interruption {"at":"1970-01-01T00:00:06.000Z"}\n'
    + start('child-two', 20000) + 'suite interruption {"at":"1970-01-01T00:00:30.000Z"}\n';
  assert.deepEqual(suiteProgress(log, 60000)!.unfinished.map(row => [row.id, row.runningSeconds]), [
    ['child-two', 10], ['child-one', 5],
  ]);
});

test('duration receipts count test bodies once without their outer file envelope', async () => {
  const { default: DurationReporter } = await import('./duration-reporter.ts');
  const file = `${process.env.TEST_SUITE_CWD ?? process.cwd()}/hub/test/example.test.ts`;
  const reporter = new DurationReporter();
  let output = '';
  reporter.on('data', row => { output += String(row); });
  const data = { file, name: file, nesting: 0, line: 1, column: 1, testNumber: 1, details: { passed: true, duration_ms: 1000 } };
  reporter.write({ type: 'test:complete', data });
  reporter.write({ type: 'test:complete', data: { ...data, name: 'body', line: 9, details: { passed: true, duration_ms: 250 } } });
  assert.deepEqual(output.trim().split('\n').map(row => JSON.parse(row)), [
    { file: 'hub/test/example.test.ts', name: 'body', seconds: 0.25, outcome: 'pass' },
  ]);
  reporter.destroy();
});

// T1: native timeout evidence identifies the effective test budget; parent
// cancellation and absent metadata cannot prove an individual test timed out.
test('only an observed native test timeout establishes a hang', async () => {
  const cases = [
    { name: 'default timeout', elapsed: 11000, failureType: 'testTimeoutFailure', message: 'test timed out after 8000ms', hung: true },
    { name: 'ten minute override', elapsed: 180000, failureType: 'cancelledByParent', message: 'test did not finish before its parent', hung: false },
    { name: 'unknown budget', elapsed: 180000, failureType: undefined, message: '', hung: false },
  ];
  for (const entry of cases) {
    const clock = new FakeClock();
    const start = { file: '/project/hub/test/example.test.ts', name: entry.name, nesting: 0, line: 9, column: 1, type: 'test' as const, testId: 1 };
    async function* source(): AsyncGenerator<TestEvent> {
      yield { type: 'test:dequeue', data: start };
      clock.block(entry.elapsed);
      if (entry.failureType) {
        const details = { passed: false, duration_ms: entry.elapsed, error: Object.assign(new Error(entry.message), { failureType: entry.failureType, code: 'ERR_TEST_FAILURE', cause: new Error(entry.message) }) };
        yield { type: 'test:complete', data: { ...start, testNumber: 1, details } };
      }
    }
    let log = '';
    for await (const line of skipReporter(source(), { cwd: '/project', clock })) log += line;
    const receipt = suiteProgress(log, clock.now().getTime())!;
    const text = progressLines(receipt).join('\n');
    assert.match(text, entry.hung ? /^hung:/ : /^in flight:/, entry.name);
    assert.deepEqual(receipt.completed, [], 'an interrupted body never counts as completed');
  }
});
