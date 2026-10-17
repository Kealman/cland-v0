// T3 lifecycle: real Node test-runner assertion failure and cancellation execute registered
// stop owners before hub/directory teardown, even when the cancelled body never reaches finally.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tempProject } from './harness.ts';
import { onCleanup, ownProcess } from './process-cleanup.ts';

const component = new URL('./session-stop-races-component.test.ts', import.meta.url);

test('held stop cleanup survives assertion failure and test-runner cancellation', async t => {
  const root = await tempProject(t);
  const original = await readFile(component, 'utf8');
  for (const mode of ['failure', 'cancellation'] as const) {
    const evidence = join(root, `${mode}.json`);
    const fixture = join(root, `${mode}.test.ts`);
    const probe = `
  const proof = { held: false, requestSettled: false, finallyReached: false };
  onCleanup(t, async () => {
    assert.equal(proof.held, true);
    assert.equal(proof.requestSettled, true);
    assert.equal(proof.finallyReached, ${mode === 'failure'}, 'cancellation hooks do not depend on body finally');
    assert.equal(fake.stop, stopAdapter, 'restore before socket/hub teardown');
    assert.equal(fake.stops.length, 1, 'admitted adapter work completed');
    assert.deepEqual(waits.pending, [], 'no owned fake wait survives');
    await writeFile(${JSON.stringify(evidence)}, JSON.stringify({ root, ...proof }));
  });
`;
    const boundary = "      assert.equal(answered, false, 'stop waits for the adapter completion receipt');";
    const planted = `
      assert.equal(waits.pending.length, 1, 'the failure/cancellation happens while held');
      proof.held = true;
      ${mode === 'failure' ? "assert.fail('controlled pre-release assertion failure');" : "controller.abort(new Error('controlled test cancellation')); await new Promise(() => {});"}
`;
    assert.ok(original.includes(boundary), 'plant at the pre-release assertion boundary');
    const source = original
      .replace(/from '(\.{1,2}\/[^']+)'/g, (_, relative: string) => `from '${new URL(relative, component).href}'`)
      .replace("test('manual and post-merge stops remain stopped across graceful and forced completion', async t => {", "const controller = new AbortController();\ntest('controlled stop teardown', { signal: controller.signal }, async t => {")
      .replace("for (const stop of ['manual', 'post-merge'] as const) for (const forced of [false, true])", "for (const stop of ['manual'] as const) for (const forced of [false])")
      .replace('  const ui = await connectUi(t, discovery);', probe + '  const ui = await connectUi(t, discovery);')
      .replace('.then(result => { answered = true;', '.then(result => { proof.requestSettled = true; answered = true;')
      .replace('} finally { await drain(); }', '} finally { proof.finallyReached = true; await drain(); }')
      .replace(boundary, boundary + planted);
    await writeFile(fixture, source);
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const resultReady = Promise.withResolvers<{ code: number | string; output: string }>();
    const child = execFile(process.execPath, ['--test', '--test-reporter=tap', fixture], { timeout: 15_000, env, signal: t.signal }, (error, stdout, stderr) => {
      resultReady.resolve({ code: error ? (error as NodeJS.ErrnoException).code ?? 'signal' : 0, output: stdout + stderr });
    });
    const closed = new Promise<void>(resolve => child.once('close', () => resolve()));
    const stopChild = ownProcess(t, child.pid);
    // Abort can report an error before close: join OS teardown, close and the result callback.
    onCleanup(t, async () => { await stopChild(); await closed; await resultReady.promise; });
    const result = await resultReady.promise;
    await closed;
    assert.equal(result.code, 1, result.output);
    assert.match(result.output, mode === 'failure' ? /controlled pre-release assertion failure/ : /controlled test cancellation/);
    assert.doesNotMatch(result.output, /asynchronous activity|fixture cleanup failed|owned resources remain/i);
    const receipt = JSON.parse(await readFile(evidence, 'utf8')) as { root: string; held: boolean; requestSettled: boolean };
    assert.equal(receipt.held, true);
    assert.equal(receipt.requestSettled, true);
    await assert.rejects(access(receipt.root), { code: 'ENOENT' }, 'fixture removal follows the completed cleanup receipt');
  }
});
