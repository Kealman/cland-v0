// T2: timeout receipts cross the in-process provider and hub with FakeClock;
// the scripted machine plants completed tests beside tests that never complete.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture } from './remote-fixture.ts';
import { onCleanup } from './process-cleanup.ts';
import { drive } from './remote-clock.ts';
import type { Message } from '../src/protocol.ts';

test('run timeout retains completed results beside every unfinished test', async t => {
  const script = { outcome: 'red' as const, code: 124, afterMs: 11000, log: '' };
  const f = await fixture(t, { machine: 'scripted', script, config: 'lifetime="15m"\nrun_timeout="11s"\ntest_timeout="8s"' });
  // Oversized metadata forces the bounded delivery path; hung identities remain mandatory.
  f.candidate.branch = 'oversized-' + 'x'.repeat(9000);
  const observing = Promise.withResolvers<void>(), resume = Promise.withResolvers<void>(), completed = Promise.withResolvers<void>();
  const status = f.dependencies.run!.status.bind(f.dependencies.run);
  onCleanup(t, () => resume.resolve());
  t.mock.method(f.dependencies.run!, 'status', async (...args: Parameters<typeof status>) => {
    if ((await status(...args)).state === 'running') {
      observing.resolve();
      await resume.promise;
    }
    const receipt = await status(...args);
    if (receipt.state === 'done') completed.resolve();
    return receipt;
  });
  assert.equal((await f.ui.request({ type: 'subscribe' })).ok, true);
  const job = await f.launch('--executor', 'droplet');
  const report = f.ui.waitFor(frame => frame.type === 'message' && (frame.message as Message).id === `suite:${job.id}`).then(frame => frame.message as Message);
  await f.machine.started(job.id);
  await f.ui.waitFor(frame => {
    const verify = (frame.item as { verify?: { id: string; state: string } } | undefined)?.verify;
    return frame.type === 'task' && verify?.id === job.id && verify.state === 'running';
  });
  const at = f.clock.now().getTime();
  const row = (event: string, id: string, file: string, name: string, extra = {}) =>
    `suite progress ${JSON.stringify({ event, id, file, name, at, nesting: 0, ...extra })}\n`;
  script.log = row('start', 'one', 'hub/test/first.test.ts', 'oldest hang')
    + row('finish', 'one', 'hub/test/first.test.ts', 'oldest hang', { outcome: 'cancelled', seconds: 11, timedOut: true })
    + row('start', 'two', 'hub/test/second.test.ts', 'completed green')
    + row('finish', 'two', 'hub/test/second.test.ts', 'completed green', { outcome: 'pass', seconds: 0.2 })
    + row('start', 'three', 'hub/test/second.test.ts', 'completed red')
    + row('finish', 'three', 'hub/test/second.test.ts', 'completed red', { outcome: 'fail', seconds: 0.3 })
    + row('start', 'four', 'hub/test/last.test.ts', 'younger hang', { at: at + 5000 })
    + row('start', 'override', 'hub/test/override.test.ts', 'long explicit override')
    + row('start', 'unknown', 'hub/test/unknown.test.ts', 'unknown budget');
  // Hold an observed status request across the scripted timeout. This avoids
  // relying on periodic polling I/O finishing within a FakeClock.advance call.
  await f.clock.advance(1000);
  await Promise.race([observing.promise, report.then(() => { throw new Error('run finished before the controlled status observation'); })]);
  f.clock.block(at + 11000 - f.clock.now().getTime());
  resume.resolve();
  await drive(f, Promise.race([completed.promise, report.then(() => { throw new Error('run reported before its completion receipt'); })]));
  const result = await drive(f, report);
  assert.match(result.text, /exit 124[^\n]*\ntimeout: 2 tests completed, 1 failed\nhung: hub\/test\/first.test.ts :: oldest hang \(running 11 s\)/);
  assert.match(result.text, /in flight: hub\/test\/last.test.ts :: younger hang \(running 6 s\)/);
  assert.match(result.text, /in flight: hub\/test\/override.test.ts :: long explicit override \(running 11 s\)/);
  assert.match(result.text, /in flight: hub\/test\/unknown.test.ts :: unknown budget \(running 11 s\)/);
  assert.match(result.text, /completed before interruption: tests 2; pass 1; fail 1/);
  assert.ok(Buffer.byteLength(result.text) <= 8192);
  assert.ok(result.text.indexOf('completed before interruption:') < result.text.indexOf('Branch '), 'interruption summary precedes optional metadata');
  const receipt = JSON.parse(await readFile(join(f.root, '.cland/run/suites', job.id, 'result.json'), 'utf8'));
  assert.deepEqual(receipt.progress.unfinished.map(({ file, name, runningSeconds }: { file: string; name: string; runningSeconds: number }) => ({ file, name, runningSeconds })), [
    { file: 'hub/test/first.test.ts', name: 'oldest hang', runningSeconds: 11 },
    { file: 'hub/test/override.test.ts', name: 'long explicit override', runningSeconds: 11 },
    { file: 'hub/test/unknown.test.ts', name: 'unknown budget', runningSeconds: 11 },
    { file: 'hub/test/last.test.ts', name: 'younger hang', runningSeconds: 6 },
  ]);
  assert.deepEqual(receipt.progress.completed.map(({ name, outcome }: { name: string; outcome: string }) => ({ name, outcome })), [
    { name: 'completed green', outcome: 'pass' }, { name: 'completed red', outcome: 'fail' },
  ]);
  const log = await readFile(result.artifacts![0]!.path, 'utf8');
  assert.ok(log.includes(script.log), 'streamed completions are retained without a phase summary');
  assert.match(log, /hung: hub\/test\/first.test.ts :: oldest hang \(running 11 s\)/);
  assert.deepEqual(f.api.droplets, []);
});

test('cancellation keeps unfinished identities at the cancellation time through cleanup', async t => {
  const script = { outcome: 'slow' as const, log: '' };
  const f = await fixture(t, { machine: 'scripted', script });
  assert.equal((await f.ui.request({ type: 'subscribe' })).ok, true);
  const job = await f.launch('--executor', 'droplet');
  const reported = f.ui.waitFor(frame => frame.type === 'message' && (frame.message as Message).id === `suite:${job.id}`).then(frame => frame.message as Message);
  await f.machine.started(job.id);
  const at = f.clock.now().getTime();
  const row = (event: string, extra = {}) => `suite progress ${JSON.stringify({ event, id: 'cancelled-test', file: 'hub/test/hanging.test.ts', name: 'never resolves', nesting: 0, at, ...extra })}\n`;
  script.log = row('start');
  const cancel = f.dependencies.run!.cancel.bind(f.dependencies.run);
  t.mock.method(f.dependencies.run!, 'cancel', async (...args: Parameters<typeof cancel>) => {
    await cancel(...args);
    // Cancellation acknowledgements and lease cleanup do not extend runtime.
    f.clock.block(5000);
    script.log += row('finish', { outcome: 'cancelled', seconds: 10, at: f.clock.now().getTime() });
  });
  f.clock.block(10000);
  const cancelled = await f.ui.request({ type: 'suite.cancel', suite: job.id });
  assert.equal(cancelled.ok, true, cancelled.error);
  const result = await drive(f, reported);
  assert.match(result.text, /exit 143[^\n]*\nin flight: hub\/test\/hanging.test.ts :: never resolves \(running 10 s\)/);
  const receipt = JSON.parse(await readFile(join(f.root, '.cland/run/suites', job.id, 'result.json'), 'utf8'));
  assert.equal(receipt.progress.unfinished[0].runningSeconds, 10);
  assert.deepEqual(receipt.progress.completed, []);
  const log = await readFile(result.artifacts![0]!.path, 'utf8');
  assert.ok(log.includes('"outcome":"cancelled"'), 'the final raw bytes are collected before deriving the receipt');
  assert.equal((log.match(/^in flight: /gm) ?? []).length, 1);
});

test('soak deadline reports zero failures before its short in-flight test', async t => {
  const script = { outcome: 'red' as const, code: 124, afterMs: 300000, log: '' };
  const f = await fixture(t, { machine: 'scripted', script, config: 'lifetime="15m"\nrun_timeout="5m"' });
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated', fetchedDev: f.candidate.head };
  const job = await f.launch('all', '--fresh', '--occasion', 'soak');
  await drive(f, f.machine.started(job.id));
  const at = f.clock.now().getTime();
  const row = (event: string, id: string, name: string, extra = {}) => `suite progress ${JSON.stringify({ event, id, file: 'hub/test/example.test.ts', name, nesting: 0, at, ...extra })}\n`;
  script.log = row('finish', 'green', 'completed', { outcome: 'pass', seconds: 1 })
    + row('start', 'in-flight', 'still running', { at: at + 299000 });
  f.clock.block(300000);
  await f.clock.advance(1000); await drive(f, f.verificationSettled());
  const history = ((await f.ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: Message[] }).messages;
  const result = history.find(message => message.id === `suite:${job.id}`);
  assert.ok(result, 'observe the completed soak report in General');
  assert.match(result.text, /^suite result [^\n]+\nall exit 124[^\n]*\ntimeout: 1 tests completed, 0 failed\nin flight:.*still running/);
  assert.doesNotMatch(result.text, /hung:/);
});
