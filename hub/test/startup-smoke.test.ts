// T3 real detached lifecycle: an embedded hub cannot prove the CLI startup path.
// The injected listening hang allows 5 s to reach its first connection;
// the pre-discovery hang needs only 2 s because it holds before daemon startup.
import { runnerFixtureEnvironment } from './fixture-environment.ts';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { eventually, pidAlive, tempProject } from './harness.ts';
import { beforeDirectories, ownProcess } from './process-cleanup.ts';

const smokeName = 'hub startup serves status within 10 seconds, serves a tracker request and stops';

test('a pre-discovery startup hang stops its daemon before removing the fixture', async t => {
  const root = await tempProject(t);
  const receipt = join(root, 'hung-daemon.json');
  const preload = join(root, 'pre-discovery-hang.mjs');
  await writeFile(preload, `
    import { writeFileSync } from 'node:fs';
    if (process.argv[2] === 'hub' && process.argv[3] === 'serve') {
      writeFileSync(${JSON.stringify(receipt)}, JSON.stringify({ pid: process.pid, root: process.cwd() }));
      process.stderr.write(JSON.stringify({ event: 'planted-pre-discovery-hang' }) + '\\n');
      setInterval(() => {}, 60000);
      await new Promise(() => {}); // Hold before importing the daemon or publishing discovery.
    }
  `);
  const env: NodeJS.ProcessEnv = { ...process.env, CLAND_TEST_SMOKE_BUDGET_MS: '2000', TMPDIR: root, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${pathToFileURL(preload).href}` };
  delete env.NODE_TEST_CONTEXT;
  const running = new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = execFile(process.execPath, ['--test', '--test-reporter=tap', `--test-name-pattern=^${smokeName}$`, fileURLToPath(new URL('./scenarios/startup-smoke.test.ts', import.meta.url))], { env: runnerFixtureEnvironment(root, env), timeout: 20_000 }, (error, stdout, stderr) => {
      if (error && typeof error.code !== 'number') reject(new Error('pre-discovery smoke did not exit within 20 seconds'));
      else resolve({ code: error ? error.code as number : 0, stdout, stderr });
    });
    ownProcess(t, child.pid);
  });
  void running.catch(() => {});
  const daemon = await eventually('pre-discovery daemon entered its hold', async () => JSON.parse(await readFile(receipt, 'utf8')), 5000);
  ownProcess(t, daemon.pid); // Capture the live fixture identity even when the regression is red.
  const result = await running;
  assert.equal(result.code, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /hub startup smoke failed within 2000 ms; last startup log event: planted-pre-discovery-hang/);
  assert.equal(pidAlive(daemon.pid), false, 'a pre-discovery daemon must be gone when its smoke exits');
  assert.match(result.stdout, new RegExp(`startup cleanup: pid ${daemon.pid} gone before fixture removal`));
  await assert.rejects(stat(daemon.root), { code: 'ENOENT' });
  const duration = /duration_ms: ([\d.]+)/.exec(result.stdout);
  assert.ok(duration, result.stdout);
  assert.ok(Number(duration[1]) < 4000, result.stdout);
});

test('a planted listening startup hang fails the smoke within its bound and names the last log event', async t => {
  const root = await tempProject(t);
  const preload = join(root, 'silent-startup.mjs');
  await writeFile(preload, `
    import { Server } from 'node:net';
    if (process.argv[2] === 'hub' && process.argv[3] === 'serve') {
      const emit = Server.prototype.emit;
      Server.prototype.emit = function(event, ...args) {
        if (event === 'connection') {
          process.stderr.write(JSON.stringify({ event: 'planted-startup-hang' }) + '\\n');
          process.stderr.write('unstructured diagnostic after the last event\\n');
          // A genuine blocked event loop cannot welcome the client or emit later
          // metrics over the planted last event. The smoke must kill this daemon.
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
          return true;
        }
        return emit.call(this, event, ...args);
      };
    }
  `);
  const env: NodeJS.ProcessEnv = { ...process.env, CLAND_TEST_SMOKE_BUDGET_MS: '5000', NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${pathToFileURL(preload).href}` };
  delete env.NODE_TEST_CONTEXT;
  const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = execFile(process.execPath, ['--test', '--test-reporter=tap', `--test-name-pattern=^${smokeName}$`, fileURLToPath(new URL('./scenarios/startup-smoke.test.ts', import.meta.url))], { env: runnerFixtureEnvironment(root, env), timeout: 20_000 }, (error, stdout, stderr) => {
      if (error && typeof error.code !== 'number') reject(new Error('planted-hang smoke did not exit within 20 seconds'));
      else resolve({ code: error ? error.code as number : 0, stdout, stderr });
    });
    ownProcess(t, child.pid);
    let closed = false;
    child.once('close', () => { closed = true; });
    beforeDirectories(t, async () => {
      await eventually('listening-hang worker closed before fixture removal', () => closed, 3000);
      assert.equal(closed, true);
      assert.equal((await stat(root)).isDirectory(), true);
      t.diagnostic('listening-hang worker closed before fixture removal');
    });
  });
  assert.equal(result.code, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /hub startup smoke failed within 5000 ms; last startup log event: planted-startup-hang/);
  // Allow two seconds for fixture teardown/reporting beyond the injected readiness budget.
  const duration = /duration_ms: ([\d.]+)/.exec(result.stdout);
  assert.ok(duration, result.stdout);
  assert.ok(Number(duration[1]) < 7000, result.stdout);
});
