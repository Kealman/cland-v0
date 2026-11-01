// T2: Claude Code commands and settings use a recording Host; no native harness runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ClaudeCodeAdapter } from '../src/adapters/claude-code.ts';
import type { AdapterHost } from '../src/adapters/contract.ts';
import type { HostCommand } from '../src/host/host.ts';
import { localHost } from '../src/host/local.ts';
import { tempProject } from './harness.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import { fixtureEnvironment } from './fixture-environment.ts';

test('Claude launch, directory discovery and settings reach the selected Host with unchanged command inputs', async t => {
  const root = await tempProject(t);
  const commands: HostCommand[] = [];
  const reads: string[] = [];
  const machine = { ...localHost(), run: async (command: HostCommand) => {
    commands.push(command);
    return { code: 0, stdout: command.args[0] === '--bg' ? 'claude attach abcdef12' : '[]', stderr: '' };
  }, readFile: async (path: string) => { reads.push(path); return Buffer.from('{"worktree":{"bgIsolation":"worktree"}}'); } };
  const host: AdapterHost = { root, discoveryFile: join(root, 'hub.json'), node: '/fixture/node', cli: '/fixture/cli', spoke: '/fixture/spoke', log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {}, hostForLaunch: () => machine, hostForProcess: () => machine };
  const adapter = new ClaudeCodeAdapter(host, { bin: '/no-native-claude', env: fixtureEnvironment(root, process.env), pollMs: 600_000 });
  t.after(() => adapter.close());
  const row = await adapter.spawn({ name: 'worker', role: null, model: 'sonnet', cwd: root, sessionId: 'fixture-session', effort: 'high', launchToken: 'fixture-launch' });
  await adapter.stop(row);
  assert.deepEqual(commands.map(c => c.args[0]), ['--bg', 'agents', 'stop']);
  assert.deepEqual(commands[1]!.args, ['agents', '--json']);
  assert.deepEqual(commands[2]!.args, ['stop', 'abcdef12']);
  assert.deepEqual(commands[0]!.args.slice(0, 9), ['--bg', '--session-id', 'fixture-session', '--name', 'worker', '--model', 'sonnet', '--effort', 'high']);
  assert.ok(commands.every(c => c.command === '/no-native-claude' && c.cwd === root && c.env.DISABLE_AUTOUPDATER === '1'));
  assert.equal(commands[0]!.env.CLAND_LAUNCH_TOKEN, 'fixture-launch');
  assert.equal(commands[1]!.env.CLAND_LAUNCH_TOKEN, undefined);
  assert.deepEqual(reads.sort(), [join(root, '.claude/settings.json'), join(root, '.claude/settings.local.json')].sort());
  const args = commands[0]!.args;
  const settings = JSON.parse(await readFile(args[args.indexOf('--settings') + 1]!, 'utf8'));
  assert.equal(settings.worktree, undefined, 'Host settings preserve the human isolation override');
});

test('Claude identities, resume fallback, signed-out liveness and stop stay on the row Host', async t => {
  const root = await tempProject(t);
  const calls: string[] = [];
  let listed = true;
  const machine = { ...localHost(),
    run: async (command: HostCommand) => {
      calls.push(command.args[0]!);
      return { code: 0, stdout: command.args[0] === '--bg' ? 'claude attach abcdef12' : command.args[0] === 'agents' ? JSON.stringify(listed ? [{ id: 'abcdef12', sessionId: 'native', pid: 987654, status: 'idle' }] : []) : '', stderr: '' };
    },
    identity: async (pid: number) => { calls.push(`identity:${pid}`); return { pid, pidStarted: 'host-start', pidIdentity: 'linux:fixture:birth' }; },
    alive: async (p: { pid: number | null }) => { calls.push(`alive:${p.pid}`); return true; },
    stop: async (p: { pid: number | null }, options?: { beforeSignal?: () => Promise<void> }) => { calls.push(`stop:${p.pid}`); await options?.beforeSignal?.(); return true; },
    readFile: async () => Buffer.from('{}'),
  };
  const { FakeClock } = await import('./fake-clock.ts');
  const clock = new FakeClock();
  const host: AdapterHost = { root, discoveryFile: join(root, 'hub.json'), node: '/fixture/node', cli: '/fixture/cli', spoke: '/fixture/spoke', log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {}, hostForLaunch: () => machine, hostForProcess: () => machine };
  const adapter = new ClaudeCodeAdapter(host, { clock, bin: '/no-native-claude', env: fixtureEnvironment(root, process.env), agentsMs: 1, pollMs: 600_000 });
  t.after(() => adapter.close());
  const row = await adapter.spawn({ name: 'worker', role: null, model: null, cwd: root });
  assert.equal(row.pidStarted, 'host-start');
  assert.equal(row.pidIdentity, 'linux:fixture:birth');
  assert.equal((await adapter.resume(row)).found, true);
  listed = false;
  await clock.advance(2);
  const missingFlight = adapter.resume(row);
  await new Promise<void>(resolve => setImmediate(resolve));
  await clock.advance(2);
  const missing = await missingFlight;
  assert.equal(missing.found, false);
  if (!missing.found) assert.equal(missing.alive, true);
  adapter.interpret('turn-end', { hook_event_name: 'StopFailure', error: 'authentication_failed' }, row);
  assert.equal((await adapter.resume(row)).found, true, 'signed-out native discovery still uses Host liveness');
  await adapter.stop(row);
  assert.ok(calls.filter(c => c === 'identity:987654').length >= 2);
  assert.ok(calls.filter(c => c === 'alive:987654').length >= 2);
  assert.deepEqual(calls.slice(-2), ['stop:987654', 'stop'], 'Host captures ownership before the native stop');
});

test('Claude close joins an in-flight Host liveness observation before releasing the adapter', async t => {
  const root = await tempProject(t);
  const { FakeClock } = await import('./fake-clock.ts');
  const clock = new FakeClock();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<boolean>();
  const machine = { ...localHost(), alive: () => { entered.resolve(); return release.promise; } };
  const host: AdapterHost = { root, discoveryFile: join(root, 'hub.json'), node: '', cli: '', spoke: '', log: () => {}, signal: () => assert.fail('no signal after close'), recordPid: () => {}, exited: () => assert.fail('no exit after close'), hostForProcess: () => machine };
  const adapter = new ClaudeCodeAdapter(host, { clock, env: fixtureEnvironment(root, process.env), pollMs: 5 });
  t.after(async () => { release.resolve(true); await adapter.close(); });
  adapter.watch({ name: 'worker', harness: 'claude-code', role: null, model: null, cwd: root, sessionId: 'fixture', harnessId: null, harnessSessionId: null, pid: 987654, startedAt: clock.now().toISOString(), status: 'running' });
  await clock.advance(5);
  await within(entered.promise, 5000);
  let closed = false;
  const closing = Promise.resolve(adapter.close()).then(() => { closed = true; });
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(closed, false, 'Host observation remains owned until it settles');
  release.resolve(false);
  await within(closing, 5000);
  assert.equal(closed, true);
  assert.equal(clock.pending, 0, 'the completed dead-PID observation schedules no work after close');
});

for (const boundary of ['signed-out alive', 'listed identity', 'fallback alive', 'directory delay'] as const) test(`Claude close joins and fences resume at ${boundary}`, async t => {
  const root = await tempProject(t);
  const { FakeClock } = await import('./fake-clock.ts');
  const clock = new FakeClock();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const row = { name: 'worker', harness: 'claude-code', role: null, model: null, cwd: root, sessionId: 'fixture', harnessId: 'job', harnessSessionId: 'native', pid: 987654, pidStarted: 'host-start', pidIdentity: 'host-birth', startedAt: clock.now().toISOString(), status: 'running' as const };
  const machine = { ...localHost(),
    run: async () => ({ code: 0, stdout: boundary === 'listed identity' ? JSON.stringify([{ id: 'job', sessionId: 'native', pid: row.pid }]) : '[]', stderr: '' }),
    identity: async () => { if (boundary === 'listed identity') { entered.resolve(); await release.promise; } return { pid: row.pid, pidStarted: row.pidStarted, pidIdentity: row.pidIdentity }; },
    alive: async () => { entered.resolve(); await release.promise; return true; },
  };
  const state = new Map<string, string>();
  const host: AdapterHost = { root, discoveryFile: join(root, 'hub.json'), node: '', cli: '', spoke: '', log: () => {}, signal: () => assert.fail('no late resume signal'), recordPid: () => {}, exited: () => assert.fail('no late resume exit'), hostForProcess: () => machine, adapterState: { read: key => state.get(key) ?? null, write: (key, value) => { state.set(key, value); } } };
  const adapter = new ClaudeCodeAdapter(host, { clock, env: fixtureEnvironment(root, process.env), agentsMs: boundary === 'directory delay' ? 30_000 : 0, pollMs: 600_000 });
  t.after(async () => { release.resolve(); await clock.advance(30_001); await adapter.close(); });
  if (boundary === 'signed-out alive') adapter.interpret('turn-end', { hook_event_name: 'StopFailure', error: 'authentication_failed' }, row);
  const resuming = adapter.resume(row);
  const rejected = assert.rejects(resuming, /Claude adapter is closed/);
  void rejected.catch(() => {});
  if (boundary === 'directory delay') {
    const { eventually } = await import('./harness.ts');
    await eventually('completed directory snapshot persisted before delay', () => [...state.values()].some(value => value.includes('"entries":[]')) ? true : undefined);
    await new Promise<void>(resolve => setImmediate(resolve));
  } else await within(entered.promise, 5000);
  let closed = false;
  const closing = Promise.resolve(adapter.close()).then(() => { closed = true; });
  await new Promise<void>(resolve => setImmediate(resolve));
  if (boundary !== 'directory delay') assert.equal(closed, false, 'close owns the held Host resume observation');
  release.resolve();
  await within(Promise.all([closing, rejected]), 5000);
  assert.equal(closed, true);
  assert.equal(clock.pending, 0, 'resume owns no remaining schedule timers');
});

for (const stopConfirmed of [true, false]) test(stopConfirmed ? 'Claude close stops a relaunched native job held at identity and removes its private launch files' : 'Claude close reports incomplete relaunch cleanup and retains private files when Host stop refuses', async t => {
  const root = await tempProject(t);
  const { FakeClock } = await import('./fake-clock.ts');
  const clock = new FakeClock();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let nativeRunning = false;
  let settingsFile = '';
  const stopped: number[] = [];
  const machine = { ...localHost(),
    readFile: async () => Buffer.from('{}'),
    run: async (command: HostCommand) => {
      if (command.args[0] === '--bg') { nativeRunning = true; settingsFile = command.args[command.args.indexOf('--settings') + 1]!; return { code: 0, stdout: 'claude attach new-job', stderr: '' }; }
      if (command.args[0] === 'stop') { if (command.args[1] === 'new-job') nativeRunning = false; return { code: 0, stdout: '', stderr: '' }; }
      return { code: 0, stdout: JSON.stringify(nativeRunning ? [{ id: 'new-job', sessionId: 'native', pid: 987654 }] : []), stderr: '' };
    },
    identity: async (pid: number) => { entered.resolve(); await release.promise; return { pid, pidStarted: 'host-start', pidIdentity: 'host-birth' }; },
    stop: async (p: { pid: number | null }, options?: { beforeSignal?: () => Promise<void> }) => { stopped.push(p.pid!); await options?.beforeSignal?.(); return stopConfirmed; },
  };
  const host: AdapterHost = { root, discoveryFile: join(root, 'hub.json'), node: '', cli: '', spoke: '', log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {}, hostForLaunch: () => machine, hostForProcess: () => machine };
  const adapter = new ClaudeCodeAdapter(host, { clock, env: fixtureEnvironment(root, process.env), agentsMs: 0 });
  t.after(async () => { release.resolve(); try { await adapter.close(); } catch (error) { if (stopConfirmed) throw error; } });
  const resuming = adapter.resume({ name: 'worker', harness: 'claude-code', role: null, model: null, cwd: root, sessionId: 'fixture', harnessId: 'old-job', harnessSessionId: 'native', pid: null, startedAt: clock.now().toISOString(), status: 'running' }, { relaunch: true });
  const rejected = assert.rejects(resuming, /Claude adapter is closed/);
  void rejected.catch(() => {});
  await within(entered.promise, 5000);
  assert.equal(nativeRunning, true);
  assert.ok(await readFile(settingsFile, 'utf8'));
  let closed = false;
  const closing = Promise.resolve(adapter.close()).then(() => { closed = true; });
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(closed, false);
  const closeReceipt = stopConfirmed ? closing : assert.rejects(closing, /Claude launch cleanup incomplete.*new-job.*987654/);
  release.resolve();
  await within(Promise.all([closeReceipt, rejected]), 5000);
  assert.equal(closed, stopConfirmed, 'unconfirmed cleanup never returns a successful close');
  assert.equal(nativeRunning, false, 'the accepted new native job receives its stop');
  assert.deepEqual(stopped, [987654]);
  if (stopConfirmed) await assert.rejects(readFile(settingsFile), { code: 'ENOENT' });
  else assert.ok(await readFile(settingsFile, 'utf8'), 'failed cleanup retains its private files and owner record');
  assert.equal(clock.pending, 0);
});
