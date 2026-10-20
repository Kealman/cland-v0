// T3 scenario: CLI detached startup serves status and tracker then stops.
// Rule coverage (T1/T2): hub/test/init-config.test.ts, hub/test/project-probes.test.ts.
// Hub process starts: 1 observed detached hub. Only one hub is live at a time.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { CLI_ENTRY, eventually, isolateVerification, pidAlive, readDiscovery, tempProject } from '../harness.ts';
import { beforeDirectories, ownProcess } from '../process-cleanup.ts';

const smokeName = 'hub startup serves status within 10 seconds, serves a tracker request and stops';
const startupMs = Number(process.env.CLAND_TEST_SMOKE_BUDGET_MS) || 10_000;
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
