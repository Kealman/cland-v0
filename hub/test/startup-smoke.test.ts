// T3 real detached lifecycle: an embedded hub cannot prove the CLI startup path.
// The listening hang keeps a 10 s budget to reach its first connection on a loaded runner;
// the pre-discovery hang needs only 2 s because it holds before daemon startup.
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { CLI_ENTRY, eventually, isolateVerification, pidAlive, readDiscovery, tempProject } from './harness.ts';
import { beforeDirectories, ownProcess } from './process-cleanup.ts';

const smokeName = 'hub startup serves status within 10 seconds, serves a tracker request and stops';
const startupMs = Number(process.env.CLAND_TEST_SMOKE_BUDGET_MS) || 10_000;

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
    const child = execFile(process.execPath, ['--test', '--test-reporter=tap', `--test-name-pattern=^${smokeName}$`, fileURLToPath(import.meta.url)], { env, timeout: 20_000 }, (error, stdout, stderr) => {
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
  const env: NodeJS.ProcessEnv = { ...process.env, CLAND_TEST_SMOKE_BUDGET_MS: '10000', NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${pathToFileURL(preload).href}` };
  delete env.NODE_TEST_CONTEXT;
  const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    execFile(process.execPath, ['--test', '--test-reporter=tap', `--test-name-pattern=^${smokeName}$`, fileURLToPath(import.meta.url)], { env, timeout: 20_000 }, (error, stdout, stderr) => {
      if (error && typeof error.code !== 'number') reject(new Error('planted-hang smoke did not exit within 20 seconds'));
      else resolve({ code: error ? error.code as number : 0, stdout, stderr });
    });
  });
  assert.equal(result.code, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /hub startup smoke failed within 10000 ms; last startup log event: planted-startup-hang/);
  // Allow two seconds for fixture teardown/reporting beyond the ten-second readiness budget.
  const duration = /duration_ms: ([\d.]+)/.exec(result.stdout);
  assert.ok(duration, result.stdout);
  assert.ok(Number(duration[1]) < 12000, result.stdout);
});

test(smokeName, async t => {
  const root = await tempProject(t);
  await isolateVerification(root);
  const observer = join(root, 'observe-daemon-spawn.mjs');
  await writeFile(observer, `
    import childProcess from 'node:child_process';
    import { syncBuiltinESMExports } from 'node:module';
    if (process.argv[2] === 'hub' && process.argv[3] === 'start') {
      const spawn = childProcess.spawn;
      childProcess.spawn = function(command, args, options) {
        const child = spawn.call(this, command, args, options);
        if (args?.[1] === 'hub' && args?.[2] === 'serve' && child.pid !== undefined) {
          process.send({ type: 'startup-daemon', pid: child.pid });
        }
        return child;
      };
      syncBuiltinESMExports();
    }
  `);
  const env: NodeJS.ProcessEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('CLAND_')));
  Object.assign(env, { DIGITALOCEAN_TOKEN: '', CLAND_EXECUTOR_STATE: join(root, '.cland/executor-state'), CLAND_TEST_SKIP_ORPHAN_SWEEP: '1',
    NODE_OPTIONS: `--import=${pathToFileURL(observer).href} ${process.env.NODE_OPTIONS ?? ''}` });
  let daemonPid: number | undefined;
  const cli = (args: string[], timeout: number): Promise<string> => new Promise((resolve, reject) => {
    const expires = performance.now() + timeout;
    const child = spawn(process.execPath, [CLI_ENTRY, ...args], { cwd: root, env, stdio: ['ignore', 'pipe', 'ignore', 'ipc'] });
    ownProcess(t, child.pid);
    let stdout = '';
    child.stdout!.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
    child.on('message', message => {
      if (!message || typeof message !== 'object' || !('type' in message) || message.type !== 'startup-daemon' || !('pid' in message) || typeof message.pid !== 'number') return;
      daemonPid = message.pid;
      const pid = daemonPid;
      ownProcess(t, pid); // Own the actual detached child before discovery or readiness can exist.
      beforeDirectories(t, async () => {
        await eventually('startup daemon is gone before fixture removal', () => !pidAlive(pid), 3000);
        assert.equal(pidAlive(pid), false);
        assert.equal((await stat(root)).isDirectory(), true);
        t.diagnostic(`startup cleanup: pid ${pid} gone before fixture removal`);
      });
    });
    const timer = setTimeout(() => child.kill('SIGKILL'), Math.max(0, expires - performance.now()));
    child.once('error', () => { clearTimeout(timer); reject(new Error(`CLI ${args.slice(0, 2).join(' ')} could not spawn`)); });
    child.once('close', code => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(`CLI ${args.slice(0, 2).join(' ')} failed or timed out`));
      else resolve(stdout);
    });
  });
  const deadline = performance.now() + startupMs;
  const remaining = () => {
    const ms = Math.floor(deadline - performance.now());
    if (ms <= 0) throw new Error('startup deadline expired');
    return ms;
  };
  try {
    await cli(['hub', 'start'], remaining());
    assert.equal(typeof daemonPid, 'number', 'the detached daemon spawn was observed');
    const status = JSON.parse(await cli(['hub', 'status', '--json'], remaining()));
    assert.equal(status.root, root);
    assert.equal(status.pid, daemonPid, 'the served status belongs to the observed detached daemon');
  } catch {
    let lastEvent = '(none recorded)';
    const log = await readFile(join(root, '.cland/log/hub.log'), 'utf8').catch(() => '');
    for (const line of log.split('\n').reverse()) {
      try {
        const entry: unknown = JSON.parse(line);
        if (entry && typeof entry === 'object' && 'event' in entry && typeof entry.event === 'string') {
          lastEvent = entry.event;
          break;
        }
      } catch { /* Non-JSON stderr is not a startup event. */ }
    }
    throw new Error(`hub startup smoke failed within ${startupMs} ms; last startup log event: ${lastEvent}`);
  }
  const tracker = JSON.parse(await cli(['task', 'list', '--json'], 3000));
  assert.deepEqual(tracker.items, []);
  const discovery = await readDiscovery(root);
  await cli(['hub', 'stop'], 12_000);
  await eventually('startup smoke daemon PID is gone', () => !pidAlive(discovery.pid), 3000);
  assert.equal(pidAlive(discovery.pid), false);
  await assert.rejects(stat(join(root, '.cland', 'hub.json')), { code: 'ENOENT' });
  await assert.rejects(stat(discovery.socket), { code: 'ENOENT' });
});
