// T3: observe native close and failure receipts for file-level hook failures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { caseDeadlines } from './case-deadlines.ts';
import { beforeDirectories, guardDirectoryRemoval, ownDirectory, onCleanup, fenceFixtureCleanup } from './process-cleanup.ts';
import { testDeadlineMs } from './until.ts';
import { fixtureEnvironment } from './fixture-environment.ts';

for (const mode of ['direct', 'suite serial', 'suite parallel']) test(`${mode} reports a failing file-level after hook despite inherited worker context`, async t => {
  let closing = false;
  let stop = () => {};
  const owner = caseDeadlines(t, {
    timeoutMs: testDeadlineMs(30_000),
    ownership: { beforeDirectories, guardDirectoryRemoval },
    releaseOnClose: () => { closing = true; stop(); },
  });
  fenceFixtureCleanup(owner.fixtures);
  await owner.run(async step => {
    const root = await step(() => owner.wait('setup: allocate and adopt root', async () => {
      const root = await mkdtemp(join(tmpdir(), 'cland-after-hook-'));
      ownDirectory(owner.fixtures, root);
      owner.adoptRoot(root);
      return root;
    }));
    const file = join(root, 'after.test.mjs');
    await step(() => owner.wait('setup: write hook fixture', () => writeFile(file, `import test, {after} from 'node:test';
import assert from 'node:assert/strict';
test('body passes', () => {});
after(() => { console.log('hook executed'); assert.equal(1, 0, 'leftover placeholder'); });`)));
    const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
    const args = mode === 'direct' ? ['--test', file] : ['--input-type=module', '-e',
      `import {runSuite} from ${JSON.stringify(runner)}; process.exitCode = await runSuite([['--test', '--test-concurrency=${mode === 'suite serial' ? 1 : 2}', ${JSON.stringify(file)}]], ${JSON.stringify({cwd:root, lockDir:join(root, 'lock')})});`];
    const child = await step(() => owner.wait('setup: launch and adopt native child', async () => {
      const process = spawn(globalThis.process.execPath, args, {
        cwd: root, env: fixtureEnvironment(root, { ...globalThis.process.env, NODE_TEST_CONTEXT: 'child-v8' }), stdio: ['ignore', 'pipe', 'pipe'],
      });
      let output = '';
      process.stdout.on('data', b => { output += b; });
      process.stderr.on('data', b => { output += b; });
      const closed = new Promise<{code: number | null; signal: NodeJS.Signals | null}>((resolve, reject) => {
        process.once('error', reject);
        process.once('close', (code, signal) => resolve({code, signal}));
      });
      stop = () => {
        if (process.exitCode === null && process.signalCode === null) process.kill('SIGTERM');
      };
      onCleanup(owner.fixtures, async () => { stop(); await closed; });
      // Even a launch that settles after cancellation is captured and stopped.
      if (closing) stop();
      return {process, closed, output: () => output};
    }));
    const receipt = await step(() => owner.wait('native completion: child close', () => child.closed)).catch(error => {
      t.diagnostic(JSON.stringify({ incomplete: 'native completion', code: child.process.exitCode,
        signal: child.process.signalCode, tail: child.output().slice(-4096) }));
      throw error;
    });
    assert.deepEqual(receipt, {code: 1, signal: null}, child.output());
    assert.match(child.output(), /hook executed/);
    assert.match(child.output(), /leftover placeholder/);
    assert.match(child.output(), /fail 1/);
    if (mode !== 'direct') {
      const failures = JSON.parse(/^suite test failures (.+)$/m.exec(child.output())![1]!) as Array<{file: string; name: string}>;
      assert.equal(failures.length, 1);
      assert.equal(failures[0]!.file, 'after.test.mjs');
      assert.ok(failures[0]!.name.endsWith('/after.test.mjs'));
    }
  });
});
