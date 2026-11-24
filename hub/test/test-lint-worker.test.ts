// T3: real worker analysis and native exit remain owned through cancellation and observer failure.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { startLintAnalysis, type LintAnalysis } from '../src/test-lint-worker-runner.ts';
import { checkTestLint } from '../src/test-lint-policy.ts';
import { cacheTestLintFacts, testLintFacts } from '../src/test-lint.ts';
import { stageCase } from './stage-case-fixture.ts';
import { eventually, testSetupWaitMs } from './until.ts';
import { type ChildProcess, type spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { FakeClock } from './fake-clock.ts';
import { stat } from 'node:fs/promises';
import { tempProject } from './harness.ts';
import { ownDirectory } from './process-cleanup.ts';
import { analysisParent } from './lint-analysis-parent-fixture.ts';

const sources = () => Array.from({ length: 300 }, (_, n) => ({ file: `hub/test/worker-${n}.test.ts`, text: 'sleep(10);\n', entry: 'T1' as const }));

test('analysis isolates suite preloads and enforces its heap cap under a large parent heap', async t => {
  const owner = stageCase(t, { native: true });
  await owner.wait('whole parent callback', () => owner.run(async step => {
    const root = await step(() => owner.wait('parent root setup', () => tempProject(owner.fixtures), testSetupWaitMs()));
    owner.adoptRoot(root);
    const parent = analysisParent(owner, root);
    assert.ok(await step(() => owner.wait('nested analysis startup', () => parent.ready, testSetupWaitMs())) > 0);
    const receipt = await step(() => owner.wait('large-heap parent result and nested close', () => parent.result, testSetupWaitMs() * 2));
    assert.equal(parent.state().nestedClosed, true);
    assert.equal(receipt.files, 1);
    assert.ok(receipt.heapSizeLimitBytes > 256 * 1024 * 1024);
    assert.ok(receipt.heapSizeLimitBytes <= 320 * 1024 * 1024, `effective analysis heap ${receipt.heapSizeLimitBytes} exceeds 320 MiB total heap bound`);
    t.diagnostic(`isolated analysis effective heap_size_limit ${receipt.heapSizeLimitBytes} bytes under parent NODE_OPTIONS=8192 MiB`);
  }), testSetupWaitMs() * 4);
});

test('parent cleanup retains the root and forbids escalation until nested native close is observed', async t => {
  const supervisor = stageCase(t, { native: true });
  let fixture: ReturnType<typeof analysisParent> | undefined;
  supervisor.releaseOnClose(() => { fixture?.release(); });
  await supervisor.wait('whole nested ownership control', () => supervisor.run(async step => {
    const owner = stageCase(t, { native: true });
    supervisor.requireClose(() => owner.close());
    let root = '';
    await step(() => owner.wait('nested fixture acquisition', () => owner.run(async step => {
      root = await step(() => owner.wait('held parent root setup', () => tempProject(owner.fixtures), testSetupWaitMs()));
      owner.adoptRoot(root);
      fixture = analysisParent(owner, root, true);
      await step(() => owner.wait('nested native close deliberately held', () => fixture!.held, testSetupWaitMs()));
    }), testSetupWaitMs() * 2));
    const remove = ownDirectory(undefined, root);
    fixture!.refuseMissing();
    await assert.rejects(owner.close(), /nested child close receipt missing/);
    await assert.rejects(remove(), /stage resource close unconfirmed/);
    assert.equal((await stat(root)).isDirectory(), true, 'real removal guard retains the root');
    assert.equal(fixture!.state().escalations, 0, 'no parent SIGKILL before nested native-close receipt');
    fixture!.release();
    await step(() => supervisor.wait('released nested native-close receipt', () => fixture!.nested, testSetupWaitMs()));
    await step(() => supervisor.wait('retry parent cleanup after positive receipt', () => owner.close(), testSetupWaitMs() * 2));
    assert.equal(fixture!.state().parentClosed, true);
    await step(() => supervisor.wait('guarded fixture removal after nested close', remove, testSetupWaitMs()));
    await assert.rejects(stat(root), { code: 'ENOENT' });
  }), testSetupWaitMs() * 6);
});

test('early native failure rejects startup with its original error and exit receipt', async t => {
  const owner = stageCase(t); // Positive native launch guard covers the injected boundary.
  await owner.wait('whole fake callback', () => owner.run(async () => {
    const native: Error & { code: string; exit?: unknown; stage?: string } = Object.assign(new Error('controlled native launch failure'), { code: 'ENOENT' });
    const child = new EventEmitter() as ChildProcess;
    child.stderr = new PassThrough();
    const analysis = startLintAnalysis([], () => {}, { launch: (() => {
      queueMicrotask(() => { child.emit('error', native); child.emit('close', 1, null); });
      return child;
    }) as typeof spawn });
    await assert.rejects(analysis.ready, error => error === native);
    await assert.rejects(analysis.result, error => error === native);
    assert.deepEqual(await analysis.closed, { code: 1, signal: null });
    assert.deepEqual(native.exit, { code: 1, signal: null });
    assert.equal(native.stage, 'startup');
  }), testSetupWaitMs());
});

test('missing startup receipt terminates then kills and joins the captured child', async t => {
  const owner = stageCase(t);
  await owner.wait('whole fake deadline callback', () => owner.run(async () => {
    const clock = new FakeClock();
    const signals: string[] = [];
    const child = new EventEmitter() as ChildProcess;
    child.stderr = new PassThrough();
    child.kill = signal => {
      signals.push(String(signal));
      if (signal === 'SIGKILL') queueMicrotask(() => child.emit('close', null, 'SIGKILL'));
      return true;
    };
    const analysis = startLintAnalysis([], () => {}, { clock, startupMs: 100, stopMs: 50, launch: (() => child) as typeof spawn });
    let settled = false;
    void analysis.result.then(() => { settled = true; }, () => { settled = true; });
    await clock.advance(100);
    assert.deepEqual(signals, ['SIGTERM']); assert.equal(settled, false);
    await clock.advance(50);
    await assert.rejects(analysis.ready, /startup receipt missing after 100 ms/);
    await assert.rejects(analysis.result, /startup receipt missing after 100 ms/);
    assert.deepEqual(await analysis.closed, { code: null, signal: 'SIGKILL' });
    assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']);
  }), testSetupWaitMs());
});

function latency(now: () => number) {
  let last = now(), largestGap = 0, ticks = 0;
  const sample = () => { const at = now(); largestGap = Math.max(largestGap, at - last); last = at; };
  return { tick() { sample(); ticks++; }, finish() {
    sample();
    assert.ok(ticks > 0, 'foreground timer fired while worker analysis was active');
    assert.ok(largestGap < 1000, `foreground latency ${largestGap} ms exceeds 1000 ms behaviour bound`);
    return { ticks, largestGap };
  } };
}

function ownedAnalysis(t: TestContext) {
  const owner = stageCase(t, { native: true });
  let analysis: LintAnalysis | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let observedExit = false;
  owner.releaseOnClose(() => { void analysis?.close(); });
  owner.requireClose(async () => { if (analysis) {
    await owner.wait('analysis child native close', () => analysis!.close(), testSetupWaitMs() * 2);
    assert.equal(observedExit, true);
  } });
  owner.fixtures.after(() => { assert.ok(!analysis || observedExit, 'interval retained until native exit'); clearInterval(timer); });
  return { owner, launch(started: (threadId: number) => void) {
    analysis = startLintAnalysis(sources(), started, { startupMs: testSetupWaitMs(), analysisMs: testSetupWaitMs() * 2, stopMs: testSetupWaitMs() });
    void analysis.closed.then(() => { observedExit = true; });
    void analysis.result.catch(() => {});
    return analysis;
  }, interval(callback: () => void) { timer = setInterval(callback, 10); timer.unref(); }, exited: () => observedExit };
}

test('worker analysis leaves foreground timers responsive and preserves admission facts', async t => {
  const f = ownedAnalysis(t);
  await f.owner.wait('whole callback', () => f.owner.run(async step => {
    let meter: ReturnType<typeof latency> | undefined;
    let finished = false;
    f.interval(() => { if (!finished) meter?.tick(); });
    const analysis = f.launch(() => { meter = latency(() => performance.now()); });
    assert.ok(await step(() => f.owner.wait('analysis child startup receipt', () => analysis.ready, testSetupWaitMs())) > 0);
    const receipt = await step(() => f.owner.wait('worker completion and exit', async () => {
      const receipt = await analysis.result;
      const measured = meter!.finish();
      finished = true;
      t.diagnostic(`${measured.ticks} foreground ticks; largest gap ${measured.largestGap} ms; sampled heap ${receipt.peakHeapBytes} bytes`);
      return receipt;
    }, testSetupWaitMs()));
    assert.equal(f.exited(), true, 'facts accepted only after native exit');
    assert.equal(receipt.files, 300);
    assert.ok(receipt.peakHeapBytes > 0);
    const entries = sources();
    const manifest = { version: 1 as const, tests: Object.fromEntries(entries.map(e => [e.file, e.entry])) };
    const source = async () => 'sleep(10);\n';
    const cold = await checkTestLint({ manifest, source });
    cacheTestLintFacts(receipt.facts);
    assert.deepEqual(await checkTestLint({ manifest, source }), cold);
    assert.deepEqual(testLintFacts(entries[0]!.file, entries[0]!.text, 'T1').result.findings.map(f => f.rule), ['wall-clock-wait']);
  }), testSetupWaitMs());
});

test('latency measurement rejects a terminal stall after earlier responsive ticks', () => {
  let now = 0;
  const meter = latency(() => now);
  now = 10; meter.tick();
  now = 1010;
  assert.throws(() => meter.finish(), /foreground latency 1000 ms exceeds/);
});

for (const mode of ['cancel', 'throw'] as const) test(`worker ${mode} joins native exit before releasing its observer`, async t => {
  const supervisor = stageCase(t, { native: true });
  await supervisor.wait('whole callback', () => supervisor.run(async step => {
    const abort = new AbortController();
    const context = new Proxy(t, { get(target, key) {
      if (key === 'signal') return abort.signal;
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
    const f = ownedAnalysis(context);
    supervisor.releaseOnClose(() => { abort.abort(); });
    supervisor.requireClose(() => f.owner.close());
    const primary = new Error('controlled started observer failure');
    let analysis: LintAnalysis | undefined;
    const running = f.owner.run(async () => {
      f.interval(() => {});
      analysis = f.launch(() => { if (mode === 'throw') throw primary; });
      await analysis.result;
    });
    const rejected = assert.rejects(running, mode === 'throw' ? error => error === primary : /lint analysis cancelled/);
    const admitted = await step(() => eventually('analysis admitted', () => analysis, { timeoutMs: testSetupWaitMs() }));
    await step(() => supervisor.wait('analysis child started', () => admitted.ready, testSetupWaitMs()));
    if (mode === 'cancel') abort.abort(new Error('controlled TestContext cancellation'));
    await step(() => supervisor.wait('rejected producer joined native exit', () => rejected, testSetupWaitMs()));
    assert.equal(f.exited(), true, 'rejection follows native worker exit');
    await step(() => supervisor.wait('observer owner closed', () => f.owner.close(), testSetupWaitMs()));
  }), testSetupWaitMs());
});
