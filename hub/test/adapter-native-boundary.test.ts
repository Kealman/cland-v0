import test, { type TestContext } from 'node:test';
import { EventEmitter, once } from 'node:events';
import fsp from 'node:fs/promises';
import { AppServerClient } from '../src/adapters/codex/app-server.ts';
import { OpenCodeClient } from '../src/adapters/opencode/client.ts';
import { processStarted } from '../src/adapters/processes.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { CodexAdapter } from '../src/adapters/codex.ts';
import { OpenCodeAdapter } from '../src/adapters/opencode.ts';
import { ClaudeCodeAdapter } from '../src/adapters/claude-code.ts';
import type { AdapterHost } from '../src/adapters/contract.ts';
import { ToolForbidden } from '../src/roles/permissions.ts';
import { RequestGuard } from '../src/hub/budget.ts';
import { eventually, tempProject } from './harness.ts';
import { sessionRunDirectory, writeSessionCredential } from '../../shared/session-credential.ts';

async function guarded(work: () => Promise<void>): Promise<void> {
  const savedFs = Object.fromEntries(Object.entries(fs).filter(([key, value]) => key.endsWith('Sync') && typeof value === 'function'));
  const savedCp = { spawnSync: cp.spawnSync, execFileSync: cp.execFileSync, execSync: cp.execSync };
  const calls: string[] = [];
  try {
    for (const [native, saved] of [[fs, savedFs], [cp, savedCp]] as const) {
      for (const key of Object.keys(saved)) Object.assign(native, { [key]: () => { calls.push(key); throw new Error(`synchronous ${key} on guarded path`); } });
    }
    syncBuiltinESMExports();
    await work();
    assert.deepEqual(calls, [], 'no synchronous native call, even when its error was caught');
  } finally { Object.assign(fs, savedFs); Object.assign(cp, savedCp); syncBuiltinESMExports(); }
}

for (const Adapter of [CodexAdapter, OpenCodeAdapter, ClaudeCodeAdapter]) test(`${Adapter.name}: real launch failure crosses no synchronous native boundary`, async t => {
  const root = await tempProject(t);
  const host: AdapterHost = { root, discoveryFile: join(root, '.cland/hub.json'), node: process.execPath, cli: '', spoke: '', log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {} };
  const adapter = new Adapter(host, { bin: join(root, 'absent'), spawnDeadlineMs: 100 });
  t.after(() => adapter.close());
  await guarded(async () => { await assert.rejects(adapter.spawn({ name: 'impl', cwd: root, role: null, model: null })); });
});


const adapters = [CodexAdapter, OpenCodeAdapter, ClaudeCodeAdapter];
// Only the external CLI/protocol is replaced. Files, process identity and termination remain native.
async function fixture(t: TestContext, Adapter: typeof adapters[number], pollMs = 600_000) {
  const root = await tempProject(t);
  const children: cp.ChildProcess[] = [];
  const nativeSpawn = cp.spawn;
  const nativeExec = cp.execFile;
  let fault = '';
  let identityRefused = false;
  let clientClosed = 0;
  const watchCalls: string[] = [];
  const launchEnvs: NodeJS.ProcessEnv[] = [];
  const launchArgv: string[][] = [];
  const events: Array<Record<string, unknown>> = [];
  let delay = () => {};
  let delayed = false;
  const resultDelay = () => { if (!delayed) { delayed = true; delay(); } };
  let claudeId = '';
  const child = (options: cp.SpawnOptions = {}) => {
    const source = fault === 'server-exit' ? "console.error('planted server exit'); process.exit(1)" : "if (Object.hasOwn(process.env, 'DIGITALOCEAN_TOKEN')) process.exit(61); setInterval(() => {}, 1000)";
    // cland-allow-child-env: native adapter spy forwards the product launch options under test; harness profiles and credentials are synthetic
    const p = nativeSpawn(process.execPath, ['-e', source], options);
    children.push(p);
    return p;
  };
  t.mock.method(cp, 'spawn', (_bin: string, _args: readonly string[], options: cp.SpawnOptions) => {
    // cland-allow-child-env: native adapter spy forwards the product launch options under test; harness profiles and credentials are synthetic
    if (_bin === 'ps' && _args[0] === '-o' && identityRefused) return nativeSpawn(process.execPath, ['-e', 'process.exit(1)'], options);
    // cland-allow-child-env: native adapter spy forwards the product launch options under test; harness profiles and credentials are synthetic
    if (_bin !== 'fake-harness') return nativeSpawn(_bin, _args, options);
    launchArgv.push([_bin, ..._args]);
    if (fault === 'spawn') throw new Error('planted spawn failure');
    launchEnvs.push(options.env ?? {});
    return child(options);
  });
  t.mock.method(cp, 'execFile', (bin: string, args: string[], options: cp.ExecFileOptions, callback: (error: { code: number } | null, stdout: string, stderr: string) => void) => {
    if (bin === 'fake-harness') launchArgv.push([bin, ...args]);
    if (bin === 'ps' && identityRefused) return setImmediate(() => callback({ code: 1 }, '', 'identity unavailable'));
    if (args[0] === '--version') return setImmediate(() => callback(null, 'codex 0.160.0', ''));
    if (args[0] === '--bg') {
      if (fault === 'bg') return setImmediate(() => callback({ code: 1 }, '', 'planted bg failure'));
      claudeId = args[args.indexOf('--session-id') + 1] ?? args[args.indexOf('--resume') + 1] ?? '';
      launchEnvs.push(options.env ?? {});
      child({ cwd: root, env: options.env, stdio: 'ignore' });
      return setImmediate(() => callback(null, 'claude attach abcdef12', ''));
    }
    if (args[0] === 'agents') watchCalls.push('agents');
    if (args[0] === 'agents') return setImmediate(() => callback(null, JSON.stringify([{ id: 'abcdef12', sessionId: claudeId, pid: children.at(-1)?.pid }]), ''));
    if (args[0] === 'stop') {
      const p = children.at(-1);
      if (p && p.exitCode === null && p.signalCode === null) { p.kill(); void once(p, 'exit').then(() => callback(null, '', '')); }
      else setImmediate(() => callback(null, '', ''));
      return;
    }
    // cland-allow-child-env: native adapter spy forwards the sealed product options and synthetic harness contract
    return Reflect.apply(nativeExec, cp, [bin, args, options, callback]);
  });
  syncBuiltinESMExports();
  const client = Object.assign(new EventEmitter(), {
    close: () => { clientClosed++; },
    request: async (method: string) => {
      if (fault === method) throw new Error(`planted ${method} failure`);
      if (method === 'turn/start') return { turn: { get id() { resultDelay(); return 'turn-1'; } } };
      return { thread: { id: 'thread-1', status: { type: 'idle' } } };
    },
  });
  t.mock.method(AppServerClient, 'connect', async (socket: string) => {
    watchCalls.push('connect');
    await fsp.writeFile(socket, 'socket placeholder');
    if (fault === 'connect') throw new Error('planted connect failure');
    return client;
  });
  t.mock.method(OpenCodeClient.prototype, 'createSession', async () => {
    if (fault === 'session') throw new Error('planted session failure');
    return { id: 'session-1', get model() { resultDelay(); return { providerID: 'test', id: 'model' }; } };
  });
  t.mock.method(OpenCodeClient.prototype, 'request', async () => {
    if (['no-answer', 'read-log', 'server-exit'].includes(fault)) throw new Error('server not ready');
    return { data: {} };
  });
  t.mock.method(OpenCodeClient.prototype, 'models', async () => [{ id: 'big-pickle', providerID: 'opencode', cost: [{ input: 0, output: 0 }], capabilities: { tools: true } }]);
  t.mock.method(OpenCodeClient.prototype, 'session', async () => ({ id: 'session-1' }));
  t.mock.method(OpenCodeClient.prototype, 'snapshot', async () => ({ running: false, permissions: [], forms: [] }));
  t.mock.method(OpenCodeClient.prototype, 'events', async (_event: unknown, _open: unknown, signal: AbortSignal) => { watchCalls.push('events'); if (!signal.aborted) await once(signal, 'abort'); });
  const host: AdapterHost = {
    root, discoveryFile: join(root, '.cland/hub.json'), node: process.execPath, cli: '', spoke: '',
    log: entry => { events.push(entry); if (entry.event === (Adapter === CodexAdapter ? 'harness-thread-started' : 'harness-launched')) delay(); if (fault === 'log' && entry.event === 'harness-launched') throw new Error('planted log failure'); },
    signal: () => {}, recordPid: () => {}, exited: () => {},
  };
  const adapter = new Adapter(host, { bin: 'fake-harness', env: { PATH: process.env.PATH, HOME: root, DIGITALOCEAN_TOKEN: 'test-token-not-real' }, spawnDeadlineMs: 1000, pollMs, stopGraceMs: 50 });
  t.after(async () => {
    adapter.close();
    for (const p of children) { if (p.exitCode === null && p.signalCode === null) { p.kill(); await once(p, 'exit'); } }
    t.mock.restoreAll(); syncBuiltinESMExports();
  });
  const request = { name: 'impl', cwd: root, role: null, model: 'test/model', sandbox: { mode: 'workspace-write' as const, writableRoots: [root], network: 'local' as const } };
  return { root, adapter, request, children, launchEnvs, launchArgv, events, watchCalls, disconnect: () => client.emit('close'), closedClients: () => clientClosed, refuseIdentity: (value: boolean) => { identityRefused = value; }, setDelay: (value: () => void) => { delay = value; }, setFault: (value: string) => { fault = value; } };
}

for (const Adapter of adapters) test(`${Adapter.name}: identity unwatch ends poll and reconnect loops without signalling`, async t => {
  const f = await fixture(t, Adapter, 25);
  const p = await f.adapter.spawn(f.request);
  let pidChecks = 0;
  const kill = process.kill.bind(process);
  t.mock.method(process, 'kill', (pid: number, signal?: string | number) => {
    if (pid === p.pid && signal === 0) pidChecks++;
    return kill(pid, signal);
  });
  f.adapter.watch(p);
  await new Promise(resolve => setTimeout(resolve, 100));
  if (Adapter === CodexAdapter) assert.ok(f.closedClients() === 0);
  f.adapter.unwatch(p.sessionId);
  await new Promise(resolve => setTimeout(resolve, 100)); // Let any in-flight inspection finish.
  const calls = f.watchCalls.length + pidChecks;
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.equal(f.watchCalls.length + pidChecks, calls, 'no poll, stream subscription or reconnect survives unwatch');
  assert.ok(f.children.every(child => child.exitCode === null && child.signalCode === null), 'unwatch signals no harness process');
  if (Adapter === CodexAdapter) assert.ok(f.closedClients() > 0);
});

test('Codex identity disposal closes an in-flight reconnect without restoring its watcher', async t => {
  const f = await fixture(t, CodexAdapter, 25);
  const p = await f.adapter.spawn(f.request);
  const connect = AppServerClient.connect;
  let entered!: () => void;
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { entered = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  t.after(() => release());
  t.mock.method(AppServerClient, 'connect', async (...args: Parameters<typeof connect>) => {
    entered();
    await gate;
    return connect(...args);
  });
  f.adapter.watch(p);
  f.disconnect();
  await waiting;
  f.adapter.unwatch(p.sessionId);
  const closed = f.closedClients();
  release();
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.ok(f.closedClients() > closed, 'late connection is disposed after the identity was removed');
  const calls = f.watchCalls.length;
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.equal(f.watchCalls.length, calls, 'no reconnect loop is restored');
  assert.ok(f.children.every(child => child.exitCode === null && child.signalCode === null));
});

for (const Adapter of adapters) test(`${Adapter.name}: successful spawn, watch, live resume, stop and relaunch use no synchronous native call`, async t => {
  const f = await fixture(t, Adapter);
  await guarded(async () => {
    const request = { ...f.request, account: 'work', accountEnv: { DIGITALOCEAN_TOKEN: 'test-token-not-real' } };
    let p = await f.adapter.spawn(request);
    assert.ok(f.launchEnvs.length > 0);
    p.pidStarted ??= await processStarted(p.pid!);
    f.adapter.watch(p);
    assert.ok(f.adapter.attachCommand(p));
    assert.ok(!f.adapter.attachCommand(p).includes('test-token-not-real'), 'attach shell argv excludes provider credentials');
    assert.equal((await f.adapter.resume(p)).found, true);
    await f.adapter.stop(p);
    const relaunched = await f.adapter.resume({ ...p, status: 'stopped' }, { relaunch: true });
    assert.equal(relaunched.found, true);
    if (relaunched.found) { p = relaunched.process; p.pidStarted = await processStarted(p.pid!); await f.adapter.stop(p); }
    for (const env of f.launchEnvs) assert.equal(Object.hasOwn(env, 'DIGITALOCEAN_TOKEN'), false, 'launched and relaunched fake sessions have no provider credential');
    assert.ok(f.launchArgv.length > 0);
    assert.equal(f.launchArgv.some(args => args.some(arg => arg.includes('test-token-not-real'))), false, 'native launch and control argv exclude provider credentials');
  });
});

for (const Adapter of adapters) test(`${Adapter.name}: a planted synchronous call in the real spawn continuation is caught`, async t => {
  const f = await fixture(t, Adapter);
  const native = cp.spawn;
  const nativeExec = cp.execFile;
  // Plant at the adapter's actual native process boundary, including a swallowed error.
  const planted = () => { try { fs.statSync(f.root); } catch {} };
  // cland-allow-child-env: native adapter spy forwards the sealed product options and synthetic harness contract
  if (Adapter === ClaudeCodeAdapter) t.mock.method(cp, 'execFile', (bin: string, args: string[], options: cp.ExecFileOptions, callback: (error: cp.ExecFileException | null, stdout: string, stderr: string) => void) => { if (args[0] === '--bg') planted(); return Reflect.apply(nativeExec, cp, [bin, args, options, callback]); });
  // cland-allow-child-env: native adapter spy forwards the product launch options under test; harness profiles and credentials are synthetic
  else t.mock.method(cp, 'spawn', (bin: string, args: string[], options: cp.SpawnOptions) => { planted(); return native(bin, args, options); });
  syncBuiltinESMExports();
  await assert.rejects(guarded(async () => { await f.adapter.spawn(f.request); }), /no synchronous native call/);
});

test('OpenCode rollback waits for its owned child exit receipt before undoing files', async t => {
  const f = await fixture(t, OpenCodeAdapter);
  f.setFault('no-answer');
  const receipt = Promise.withResolvers<void>();
  let held = false;
  let undoBeforeReceipt = false;
  const spawn = cp.spawn;
  t.mock.method(cp, 'spawn', (...args: Parameters<typeof cp.spawn>) => {
    // cland-allow-child-env: native rollback spy forwards the sealed product options so child exit remains observable
    const child = Reflect.apply(spawn, cp, args);
    if (args[0] !== 'fake-harness') return child;
    const emit = child.emit.bind(child);
    t.mock.method(child, 'emit', (event: string | symbol, ...values: unknown[]) => {
      if (event !== 'exit') return emit(event, ...values);
      // Model the interval between OS disappearance and libuv's child-exit receipt.
      // Keep the real process, identity probes and signals; delay only its receipt.
      const code = child.exitCode;
      const signal = child.signalCode;
      Object.assign(child, { exitCode: null, signalCode: null });
      held = true;
      void receipt.promise.then(() => {
        Object.assign(child, { exitCode: code, signalCode: signal }); held = false;
        emit(event, ...values);
      });
      return true;
    });
    return child;
  });
  for (const method of ['rm', 'rmdir'] as const) {
    const native = fsp[method];
    t.mock.method(fsp, method, (...args: unknown[]) => {
      if (held && String(args[0]).startsWith(join(f.root, '.cland', 'opencode'))) undoBeforeReceipt = true;
      return Reflect.apply(native, fsp, args);
    });
  }
  syncBuiltinESMExports();
  const launch = assert.rejects(f.adapter.spawn(f.request), /did not answer/);
  try {
    await eventually('OS confirms the owned child ended', () => f.events.some(e => e.event === 'harness-ended') ? true : undefined);
    assert.equal(held, true, 'the native exit receipt remains deliberately pending');
    assert.equal(undoBeforeReceipt, false, 'resource rollback waits for the native exit receipt');
  } finally { receipt.resolve(); await launch; }
  assert.ok(f.children.every(p => p.exitCode !== null || p.signalCode !== null));
});

for (const Adapter of adapters) {
  const faults = Adapter === CodexAdapter ? ['mkdir', 'policy-dir', 'log-dir', 'rm', 'log-stat', 'open', 'close', 'spawn', 'connect', 'thread/start', 'turn/start', 'log'] : Adapter === OpenCodeAdapter ? ['mkdir', 'session-dir', 'ignore', 'ignore-partial', 'ignore-link', 'ignore-append', 'config', 'config-partial', 'password', 'password-partial', 'chmod', 'log-stat', 'open', 'close', 'spawn', 'read-log', 'server-exit', 'no-answer', 'session', 'log'] : ['bg', 'log'];
  for (const fault of faults) test(`${Adapter.name}: failure at ${fault} leaves no session files or live child`, async t => {
    const f = await fixture(t, Adapter);
    if (['mkdir', 'rm', 'chmod', 'open'].includes(fault)) {
      const method = fault as 'mkdir' | 'rm' | 'chmod' | 'open';
      const native = fsp[method];
      let fired = false;
      t.mock.method(fsp, method, (...args: unknown[]) => { if (!fired) { fired = true; return Promise.reject(new Error(`planted ${fault} failure`)); } return Reflect.apply(native, fsp, args); });
      syncBuiltinESMExports();
    } else if (['policy-dir', 'log-dir', 'session-dir'].includes(fault)) {
      const native = fsp.mkdir;
      let matches = 0;
      const suffix = fault === 'policy-dir' ? 'cland-run' : fault === 'log-dir' ? '/log' : '/impl';
      t.mock.method(fsp, 'mkdir', (...args: unknown[]) => {
        if (String(args[0]).endsWith(suffix) && ++matches === (fault === 'session-dir' ? 2 : 1)) return Promise.reject(new Error(`planted ${fault} failure`));
        return Reflect.apply(native, fsp, args);
      });
      syncBuiltinESMExports();
    } else if (fault === 'read-log') {
      f.setFault(fault);
      const native = fsp.readFile;
      t.mock.method(fsp, 'readFile', (...args: unknown[]) => { if (String(args[0]).endsWith('serve.log')) return Promise.reject(new Error('planted log-read failure')); return Reflect.apply(native, fsp, args); });
      syncBuiltinESMExports();
    } else if (fault === 'log-stat') {
      const native = fsp.stat;
      t.mock.method(fsp, 'stat', (...args: unknown[]) => { if (String(args[0]).endsWith('.log')) return Promise.reject(new Error('planted log-stat failure')); return Reflect.apply(native, fsp, args); });
      syncBuiltinESMExports();
    } else if (fault === 'ignore-link') {
      t.mock.method(fsp, 'link', async () => { throw new Error(`planted ${fault} failure`); });
      syncBuiltinESMExports();
    } else if (['ignore', 'ignore-partial', 'ignore-append', 'config', 'password', 'config-partial', 'password-partial'].includes(fault)) {
      if (fault === 'ignore-append') {
        await fsp.mkdir(join(f.root, '.cland/opencode'), { recursive: true });
        await fsp.writeFile(join(f.root, '.cland/opencode/.gitignore'), '#');
      }
      const native = fsp.writeFile;
      let fired = false;
      t.mock.method(fsp, 'writeFile', (...args: unknown[]) => {
        const suffix = fault.startsWith('ignore') ? '.gitignore' : fault.startsWith('config') ? 'opencode.json' : 'password';
        if (!fired && String(args[0]).endsWith(suffix)) {
          fired = true;
          if (fault.endsWith('-partial')) return Reflect.apply(native, fsp, [args[0], fault === 'ignore-partial' ? '#' : args[1], ...args.slice(2)]).then(() => { throw new Error(`planted ${fault} failure`); });
          return Promise.reject(new Error(`planted ${fault} failure`));
        }
        return Reflect.apply(native, fsp, args);
      });
      syncBuiltinESMExports();
    } else if (fault === 'close') {
      const native = fsp.open;
      t.mock.method(fsp, 'open', async (...args: unknown[]) => {
        const handle = await Reflect.apply(native, fsp, args);
        const close = handle.close.bind(handle);
        t.mock.method(handle, 'close', async () => { await close(); throw new Error('planted close failure'); });
        return handle;
      });
      syncBuiltinESMExports();
    } else f.setFault(fault);
    await guarded(async () => { await assert.rejects(f.adapter.spawn(f.request), /planted|did not answer/); });
    assert.equal(await fsp.access(join(f.root, '.cland/log/codex-impl.log')).then(() => true, () => false), false);
    assert.equal(await fsp.access(join(f.root, '.cland/opencode/impl')).then(() => true, () => false), false);
    assert.deepEqual(await fsp.readdir(join(f.root, '.cland/run')).catch(() => []), []);
    assert.equal((await fsp.readdir(join(f.root, '.cland/opencode')).catch(() => [])).some(file => file.startsWith('.stage-')), false);
    assert.ok(f.children.every(p => p.exitCode !== null || p.signalCode !== null), 'owned child has exited before rollback returns');
  });
}

for (const existing of [false, true]) test(`ClaudeCodeAdapter: partial private settings failure ${existing ? 'restores previous files' : 'removes new files'} while preserving credentials and peers`, async t => {
  const f = await fixture(t, ClaudeCodeAdapter);
  const sessionId = 'owned-private-settings';
  const clandDir = join(f.root, '.cland');
  await writeSessionCredential(clandDir, sessionId, 'synthetic-owned-credential');
  await writeSessionCredential(clandDir, 'peer-session', 'synthetic-peer-credential');
  const directory = sessionRunDirectory(clandDir, sessionId);
  const peer = sessionRunDirectory(clandDir, 'peer-session');
  const credential = await fsp.readFile(join(directory, 'credential.json'));
  const peerCredential = await fsp.readFile(join(peer, 'credential.json'));
  const files = ['mcp.json', 'settings.json'].map(file => join(directory, file));
  if (existing) for (const file of files) await fsp.writeFile(file, 'previous private settings', { mode: 0o600 });
  const before = existing ? await Promise.all(files.map(async file => ({ content: await fsp.readFile(file), mode: (await fsp.stat(file)).mode }))) : [];
  const native = fsp.writeFile;
  let fired = false;
  t.mock.method(fsp, 'writeFile', async (...args: unknown[]) => {
    if (!fired && String(args[0]) === files[1]) {
      fired = true;
      await Reflect.apply(native, fsp, [args[0], 'partial settings', ...args.slice(2)]);
      throw new Error('planted partial private settings failure');
    }
    return Reflect.apply(native, fsp, args);
  });
  syncBuiltinESMExports();
  await guarded(async () => { await assert.rejects(f.adapter.spawn({ ...f.request, sessionId }), /planted partial private settings failure/); });
  assert.equal(fired, true);
  assert.equal(f.children.length, 0, 'private staging fails before the native launch');
  assert.deepEqual(await fsp.readFile(join(directory, 'credential.json')), credential);
  assert.deepEqual(await fsp.readFile(join(peer, 'credential.json')), peerCredential);
  if (existing) {
    for (const [i, file] of files.entries()) {
      assert.deepEqual(await fsp.readFile(file), before[i]!.content);
      assert.equal((await fsp.stat(file)).mode, before[i]!.mode);
    }
  } else assert.deepEqual(await fsp.readdir(directory), ['credential.json']);
});

for (const Adapter of adapters) test(`${Adapter.name}: result conversion and logging share one resumed scope`, async t => {
  const f = await fixture(t, Adapter);
  let clock = 0;
  const records: Array<Record<string, unknown>> = [];
  const guard = new RequestGuard({ now: () => clock, log: entry => records.push(entry) });
  f.setDelay(() => { clock += 150; });
  if (Adapter === ClaudeCodeAdapter) {
    const parse = ClaudeCodeAdapter.parseBackgroundId;
    t.mock.method(ClaudeCodeAdapter, 'parseBackgroundId', (text: string) => { clock += 150; return parse(text); });
  }
  await f.adapter.spawn(f.request, guard.resumer('session.launch', 'test'));
  assert.deepEqual(records.filter(entry => entry.event === 'slow-request').map(entry => [entry.tool, entry.phase, entry.ms]), [['session.launch', 'resumed', 300]]);
});

for (const Adapter of [CodexAdapter, OpenCodeAdapter]) test(`${Adapter.name}: failed relaunch restores existing files and removes its new socket`, async t => {
  const f = await fixture(t, Adapter);
  const p = await f.adapter.spawn(f.request);
  p.pidStarted ??= await processStarted(p.pid!);
  await f.adapter.stop(p);
  const files = Adapter === CodexAdapter ? [join(f.root, '.cland/log/codex-impl.log')] : ['opencode.json', 'password', 'serve.log'].map(file => join(f.root, '.cland/opencode/impl', file));
  const before = await Promise.all(files.map(async file => ({ file, content: await fsp.readFile(file), mode: (await fsp.stat(file)).mode })));
  if (Adapter === CodexAdapter) f.setFault('thread/resume');
  else t.mock.method(OpenCodeClient.prototype, 'session', async () => { throw new Error('planted resume-session failure'); });
  await guarded(async () => { await assert.rejects(f.adapter.resume({ ...p, status: 'stopped' }, { relaunch: true }), /planted/); });
  for (const b of before) { assert.deepEqual(await fsp.readFile(b.file), b.content); assert.equal((await fsp.stat(b.file)).mode, b.mode); }
  assert.deepEqual(await fsp.readdir(join(f.root, '.cland/run')).catch(() => []), []);
  assert.ok(f.children.every(p => p.exitCode !== null || p.signalCode !== null));
});


test('OpenCode default-model selection uses no synchronous native call', async t => {
  const f = await fixture(t, OpenCodeAdapter);
  await guarded(async () => { await f.adapter.spawn({ ...f.request, model: null }); });
});


for (const Adapter of [CodexAdapter, OpenCodeAdapter]) test(`${Adapter.name}: unverified failed child retains resources and supervision until verified exit`, async t => {
  const f = await fixture(t, Adapter);
  f.refuseIdentity(true);
  f.setFault(Adapter === CodexAdapter ? 'turn/start' : 'session');
  await guarded(async () => { await assert.rejects(f.adapter.spawn(f.request), /cleanup is pending.*supervised/); });
  const log = Adapter === CodexAdapter ? join(f.root, '.cland/log/codex-impl.log') : join(f.root, '.cland/opencode/impl/serve.log');
  assert.ok((await fsp.stat(log)).isFile());
  assert.equal(f.children[0]!.exitCode, null);
  assert.equal(f.children[0]!.signalCode, null);
  assert.ok(f.events.some(entry => entry.event === 'launch-recovery-pending'));
  if (Adapter === CodexAdapter) assert.equal(f.closedClients(), 0, 'the live connection remains owned while the child survives');
  await assert.rejects(f.adapter.spawn(f.request), /still supervised/);
  assert.equal(f.children.length, 1, 'pending ownership blocks another launch on the same resources');
  await new Promise(resolve => setTimeout(resolve, 1100)); // Negative: span the one-second launch-recovery retry without releasing unverified resources.
  assert.ok((await fsp.stat(log)).isFile(), 'supervision retries preserve resources while the child still cannot be verified');
  const child = f.children[0]!;
  child.kill(); await once(child, 'exit');
  const deadline = Date.now() + 5000;
  while (!f.events.some(entry => entry.event === 'launch-recovered') && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
  assert.ok(f.events.some(entry => entry.event === 'launch-recovered'));
  assert.equal(await fsp.access(log).then(() => true, () => false), false);
  if (Adapter === CodexAdapter) assert.equal(f.closedClients(), 1);
});

test('OpenCode repairs an existing partial ignore before creating config/password', async t => {
  const f = await fixture(t, OpenCodeAdapter);
  await fsp.mkdir(join(f.root, '.cland/opencode'), { recursive: true });
  await fsp.writeFile(join(f.root, '.cland/opencode/.gitignore'), '#');
  await guarded(async () => { await f.adapter.spawn(f.request); });
  assert.match(await fsp.readFile(join(f.root, '.cland/opencode/.gitignore'), 'utf8'), /\n\*\n$/);
});

test('OpenCode appends the wildcard while preserving an existing ignore edited after its read', async t => {
  const f = await fixture(t, OpenCodeAdapter);
  const ignore = join(f.root, '.cland/opencode/.gitignore');
  await fsp.mkdir(join(f.root, '.cland/opencode'), { recursive: true });
  await fsp.writeFile(ignore, '#');
  const native = fsp.readFile;
  t.mock.method(fsp, 'readFile', async (...args: unknown[]) => {
    const content = await Reflect.apply(native, fsp, args);
    if (String(args[0]) === ignore) await fsp.writeFile(ignore, 'concurrent-custom-ignore\n');
    return content;
  });
  syncBuiltinESMExports();
  await guarded(async () => { await f.adapter.spawn(f.request); });
  const content = await native(ignore, 'utf8');
  assert.match(content, /^concurrent-custom-ignore\n/);
  assert.ok(content.split('\n').includes('*'));
});

test('OpenCode leaves an existing wildcard untouched', async t => {
  const f = await fixture(t, OpenCodeAdapter);
  const ignore = join(f.root, '.cland/opencode/.gitignore');
  const before = '# custom contents\n*\r\n';
  await fsp.mkdir(join(f.root, '.cland/opencode'), { recursive: true });
  await fsp.writeFile(ignore, before);
  const native = fsp.writeFile;
  t.mock.method(fsp, 'writeFile', (...args: unknown[]) => {
    if (String(args[0]) === ignore) throw new Error('must not write an existing wildcard');
    return Reflect.apply(native, fsp, args);
  });
  syncBuiltinESMExports();
  await guarded(async () => { await f.adapter.spawn(f.request); });
  assert.equal(await fsp.readFile(ignore, 'utf8'), before);
});

test('OpenCode retries a partial append without replacing the existing ignore contents', async t => {
  const f = await fixture(t, OpenCodeAdapter);
  const root = join(f.root, '.cland/opencode');
  const ignore = join(root, '.gitignore');
  await fsp.mkdir(root, { recursive: true }); await fsp.writeFile(ignore, '# custom');
  const native = fsp.writeFile;
  let partial = true;
  t.mock.method(fsp, 'writeFile', (...args: unknown[]) => {
    if (partial && String(args[0]) === ignore) {
      partial = false;
      return Reflect.apply(native, fsp, [args[0], '\n', ...args.slice(2)]).then(() => { throw new Error('partial append EIO'); });
    }
    return Reflect.apply(native, fsp, args);
  });
  syncBuiltinESMExports();
  await guarded(async () => { await assert.rejects(f.adapter.spawn(f.request), /partial append EIO/); });
  assert.equal(await fsp.readFile(ignore, 'utf8'), '# custom\n');
  assert.equal(await fsp.access(join(root, 'impl')).then(() => true, () => false), false);
  await guarded(async () => { await f.adapter.spawn(f.request); });
  const content = await fsp.readFile(ignore, 'utf8');
  assert.match(content, /^# custom\n/);
  assert.ok(content.split('\n').includes('*'));
});

test('OpenCode preserves an ignore created during staging, adds its missing wildcard and warns', async t => {
  const f = await fixture(t, OpenCodeAdapter);
  const root = join(f.root, '.cland/opencode');
  const ignore = join(root, '.gitignore');
  const native = fsp.writeFile;
  t.mock.method(fsp, 'writeFile', (...args: unknown[]) => Reflect.apply(native, fsp, args).then(async () => {
    if (String(args[0]).includes('.stage-')) await native(ignore, 'custom-ignore\n');
  }));
  syncBuiltinESMExports();
  await guarded(async () => { await f.adapter.spawn(f.request); });
  const content = await fsp.readFile(ignore, 'utf8');
  assert.match(content, /^custom-ignore\n/);
  assert.ok(content.split('\n').includes('*'));
  assert.ok(f.events.some(entry => entry.event === 'opencode-ignore-conflict' && entry.path === ignore));
  assert.equal((await fsp.readdir(root)).some(file => file.startsWith('.stage-')), false);
});

test('OpenCode no-clobber publication preserves an ignore created after its final read', async t => {
  const f = await fixture(t, OpenCodeAdapter);
  const ignore = join(f.root, '.cland/opencode/.gitignore');
  const native = fsp.link;
  t.mock.method(fsp, 'link', async (...args: unknown[]) => {
    await fsp.writeFile(ignore, 'late-custom-ignore\n');
    return Reflect.apply(native, fsp, args);
  });
  syncBuiltinESMExports();
  await guarded(async () => { await f.adapter.spawn(f.request); });
  const content = await fsp.readFile(ignore, 'utf8');
  assert.match(content, /^late-custom-ignore\n/);
  assert.ok(content.split('\n').includes('*'));
  assert.ok(f.events.some(entry => entry.event === 'opencode-ignore-conflict'));
});


test('OpenCode partial shared-metadata write is removed and a retry publishes the complete ignore', async t => {
  const f = await fixture(t, OpenCodeAdapter);
  const native = fsp.writeFile;
  let partial = true;
  t.mock.method(fsp, 'writeFile', (...args: unknown[]) => {
    if (partial && String(args[0]).endsWith('.gitignore')) {
      partial = false;
      return Reflect.apply(native, fsp, [args[0], '#', ...args.slice(2)]).then(() => { throw new Error('partial metadata EIO'); });
    }
    return Reflect.apply(native, fsp, args);
  });
  syncBuiltinESMExports();
  await guarded(async () => { await assert.rejects(f.adapter.spawn(f.request), /partial metadata EIO/); });
  assert.equal(await fsp.access(join(f.root, '.cland/opencode/.gitignore')).then(() => true, () => false), false);
  await guarded(async () => { await f.adapter.spawn(f.request); });
  assert.match(await fsp.readFile(join(f.root, '.cland/opencode/.gitignore'), 'utf8'), /\n\*\n$/);
  assert.equal((await fsp.readdir(join(f.root, '.cland/opencode'))).some(file => file.startsWith('.stage-')), false);
});


for (const Adapter of [CodexAdapter, OpenCodeAdapter]) test(`${Adapter.name}: pending cleanup retains a typed native admission refusal`, async t => {
  const f = await fixture(t, Adapter);
  f.refuseIdentity(true);
  const refusal = new ToolForbidden('lead', 'session.launch', 'Lead level at epic T-1: outside your subtree');
  await guarded(async () => {
    await assert.rejects(f.adapter.spawn(f.request, undefined, () => { if (f.children.length) throw refusal; }), error => {
      assert.equal(error, refusal);
      assert.match(refusal.message, /cleanup is pending.*supervised/);
      assert.equal(refusal.permission, 'session.launch');
      assert.equal(refusal.role, 'lead');
      assert.match(refusal.reason, /epic T-1.*subtree/);
      return true;
    });
  });
  assert.equal(f.children[0]!.exitCode, null);
  assert.ok(f.events.some(entry => entry.event === 'launch-recovery-pending'));
  await assert.rejects(f.adapter.spawn(f.request), /still supervised/);
  // An identity unavailable at capture cannot become trusted later; verified child exit makes rollback safe.
  const child = f.children[0]!;
  child.kill(); await once(child, 'exit');
  const deadline = Date.now() + 5000;
  while (!f.events.some(entry => entry.event === 'launch-recovered') && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
  assert.ok(f.events.some(entry => entry.event === 'launch-recovered'));
  assert.ok(f.children.every(p => p.exitCode !== null || p.signalCode !== null));
});
