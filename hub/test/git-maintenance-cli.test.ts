// T3: real normal hub.stop must let the CLI exit beside a still-live handed-off collector.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CLI_ENTRY, connectUi, eventually, isolateVerification, pidAlive, readDiscovery, tempProject } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { fixtureCommand } from './git-maintenance-fixture.ts';
import { beforeDirectories, ownProcess } from './process-cleanup.ts';
import { readMaintenanceOwner, recoverMaintenanceOwner } from '../src/git-maintenance-owner.ts';

test('normal hub.stop exits the real CLI while durable handoff retains a live native collector', async t => {
  const root = await tempProject(t);
  const env = fixtureEnvironment(root, process.env);
  await isolateVerification(root);
  await fixtureCommand(t, root, 'git', ['-c', 'gc.auto=0', 'init', '-q', '-b', 'dev']);
  await writeFile(join(root, 'source'), 'owned fixture');
  await fixtureCommand(t, root, 'git', ['-c', 'gc.auto=0', 'add', 'source']);
  await fixtureCommand(t, root, 'git', ['-c', 'gc.auto=0', 'commit', '-qm', 'Initial']);
  const capture = join(root, 'live-collector.json'), killed = join(root, 'kill-attempt.json');
  const collector = join(root, 'live-collector.mjs'), preload = join(root, 'observe-cli.mjs');
  await writeFile(collector, `
    import { spawn } from 'node:child_process';
    import { writeFileSync } from 'node:fs';
    import { fixtureEnvironment } from ${JSON.stringify(new URL('./fixture-environment.ts', import.meta.url).href)};
    const child = spawn(process.execPath, ['-e', 'process.send("ready"); setInterval(() => {}, 1000)'], {
      env: fixtureEnvironment(${JSON.stringify(root)}, process.env), stdio: ['ignore', 'inherit', 'inherit', 'ipc']
    });
    child.once('message', () => {
      writeFileSync(${JSON.stringify(join(root, '.git/gc.pid'))}, process.pid + ' ' + ${JSON.stringify(hostname())} + '\\n');
      writeFileSync(${JSON.stringify(capture)}, JSON.stringify([process.pid, child.pid]));
    });
  `);
  await writeFile(preload, `
    import cp from 'node:child_process';
    import { syncBuiltinESMExports } from 'node:module';
    import { createHook } from 'node:async_hooks';
    import { writeFileSync } from 'node:fs';
    import { realClock } from ${JSON.stringify(new URL('../src/hub/clock.ts', import.meta.url).href)};
    if (process.argv[1] === ${JSON.stringify(CLI_ENTRY)} && process.argv[3] === 'serve') {
      const timeout = realClock.setTimeout.bind(realClock);
      realClock.setTimeout = (callback, ms) => timeout(callback, ms === 30000 && callback.toString().includes('git-maintenance-started') ? 1 : ms);
      const spawn = cp.spawn, nativeKill = process.kill.bind(process);
      let collectorPid, observing = false;
      const resources = [];
      createHook({ init(_id, type, _trigger, resource) {
        if (observing && (type === 'PROCESSWRAP' || type === 'PIPEWRAP')) resources.push({ type, resource });
      } }).enable();
      cp.spawn = (bin, args, options) => {
        if (args?.some(value => String(value).endsWith('/owned-exec.ts')) && args.includes('gc')) {
          observing = true;
          try {
            const child = spawn(bin, [args[0], process.execPath, ${JSON.stringify(collector)}], options);
            collectorPid = child.pid;
            process.send({ type: 'owned-collector', pid: child.pid });
            return child;
          } finally { observing = false; }
        }
        return spawn(bin, args, options);
      };
      process.kill = (pid, signal) => {
        if (pid === -collectorPid && signal === 'SIGKILL') {
          writeFileSync(${JSON.stringify(killed)}, JSON.stringify({ pid: collectorPid, refs: resources.map(({ type, resource }) => ({ type, referenced: resource.hasRef() })) }));
          return true; // The fixture deliberately holds the real group through handoff.
        }
        return nativeKill(pid, signal);
      };
      syncBuiltinESMExports();
    }
  `);
  await mkdir(join(root, '.cland/log'), { recursive: true });
  const log = join(root, '.cland/log/cli-exit.log'), fd = openSync(log, 'a');
  const ready = eventually('native collector and descendant readiness', async () => {
    try { return JSON.parse(await readFile(capture, 'utf8')) as number[]; } catch { return undefined; }
  }, 5000);
  const child = spawn(process.execPath, [CLI_ENTRY, 'hub', 'serve'], {
    cwd: root, detached: true, stdio: ['ignore', fd, fd, 'ipc'],
    env: fixtureEnvironment(root, env, { NODE_OPTIONS: `--import=${pathToFileURL(preload).href}`, CLAND_TEST_SKIP_ORPHAN_SWEEP: '1', CLAND_TEST_FIXTURE_ROOT: root, CLAND_EXECUTOR_STATE: join(root, '.cland/executor-state'), CLAND_CLAUDE_BIN: '/missing/claude', CLAND_CODEX_BIN: '/missing/codex', CLAND_OPENCODE_BIN: '/missing/opencode' }),
  });
  closeSync(fd);
  ownProcess(t, child.pid);
  child.on('message', value => {
    if (value && typeof value === 'object' && 'type' in value && value.type === 'owned-collector' && 'pid' in value && typeof value.pid === 'number') ownProcess(t, value.pid);
  });
  let nativeExit: { code: number | null; signal: NodeJS.Signals | null } | undefined;
  const closed = new Promise<void>(resolve => child.once('close', (code, signal) => { nativeExit = { code, signal }; resolve(); }));
  beforeDirectories(t, async () => { await closed; await recoverMaintenanceOwner(root, env); });
  try {
    const pids = await ready;
    for (const pid of pids) ownProcess(t, pid);
    const discovery = await readDiscovery(root);
    const ui = await connectUi(t, discovery);
    assert.equal((await ui.request({ type: 'hub.status' })).ok, true);
    const owner = await readMaintenanceOwner(root);
    assert.equal(owner?.pid, pids[0]);
    // Arm exit observation/deadline before triggering this end-to-end stop check.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const exited = Promise.race([closed, new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('normal hub.stop left the CLI alive past its bounded handoff')), 2000); })]); // lint-allow-wall-clock: bound the actual native CLI exit after normal hub.stop
    try {
      assert.equal((await ui.request({ type: 'hub.stop' })).ok, true);
      await exited;
    } finally { clearTimeout(timer); }
    assert.deepEqual(nativeExit, { code: 0, signal: null });
    assert.equal(pidAlive(discovery.pid), false, 'the real CLI was reaped');
    const attempt = JSON.parse(await readFile(killed, 'utf8')) as { pid: number; refs: Array<{ type: string; referenced: boolean }> };
    assert.equal(attempt.pid, pids[0]);
    assert.ok(attempt.refs.some(ref => ref.type === 'PROCESSWRAP' && ref.referenced));
    assert.ok(attempt.refs.filter(ref => ref.type === 'PIPEWRAP' && ref.referenced).length >= 2, 'genuinely referenced native pipes existed at cancellation');
    for (const pid of pids) assert.equal(pidAlive(pid), true, 'parent observation release never claims collector death');
    assert.equal((await readMaintenanceOwner(root))?.pid, pids[0]);
    await recoverMaintenanceOwner(root, env);
    assert.equal(await readMaintenanceOwner(root), null);
    for (const pid of pids) assert.equal(pidAlive(pid), false);
  } catch (error) {
    const tail = (await readFile(log, 'utf8').catch(() => '(no native log)')).slice(-4096);
    throw new Error(`${error instanceof Error ? error.message : String(error)}; native hub outcome ${JSON.stringify(nativeExit ?? 'incomplete')}; diagnostic tail: ${tail}`);
  }
});
