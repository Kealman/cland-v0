// T2: real adapter launch orchestration with recording Hosts; no native launch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { fakeOnlyFixture } from './fake-only-fixture.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { FakeClock } from './fake-clock.ts';
import type { Host, HostCommand } from '../src/host/host.ts';
import type { AdapterHost, HarnessProcess } from '../src/adapters/contract.ts';

for (const target of ['local', 'recording-remote']) for (const harness of ['claude-code', 'codex', 'opencode'] as const) for (const restored of [false, true]) {
  test(`${harness} final ${target} ${restored ? 'restored row' : 'new role'} launch strips executor transport controls`, async t => fakeOnlyFixture(t, async root => {
    const { recordingHost } = await import('./recording-host.ts');
    const env = fixtureEnvironment(root, {}, { CLAND_TEST_EXECUTOR_TRANSPORT: '1', CLAND_TEST_FAKE_MACHINE_ROOT: root });
    const poison = { CLAND_TEST_EXECUTOR_TRANSPORT: '1', CLAND_TEST_FAKE_MACHINE_ROOT: root, RETAINED: 'fixture' };
    const frames: HostCommand[] = [];
    const exits: Array<(r: { code: number | null; signal: string | null }) => void> = [];
    let launched = false;
    const machine: Host = { ...recordingHost(root), name: target,
      freePort: async () => 12345,
      forward: async () => ({ socket: join(root, 'fake-forward.sock') }),
      run: async command => {
        frames.push(command);
        if (command.args[0] === '--bg') { launched = true; return { code: 0, stdout: 'claude attach fixture-job', stderr: '' }; }
        if (command.args[0] === 'stop') launched = false;
        return { code: 0, stdout: command.args[0] === '--version' ? 'codex 0.160.0' : JSON.stringify(launched ? [{ id: 'fixture-job', sessionId: 'native', pid: 987654 }] : []), stderr: '' };
      },
      spawn: async command => { frames.push(command); launched = true; return { pid: 987654, exited: new Promise(resolve => exits.push(resolve)) }; },
      identity: async pid => ({ pid, pidStarted: 'fixture-start', pidIdentity: 'fixture-birth' }),
      alive: async () => false,
      stop: async (_row, options) => { options?.authorize?.([]); await options?.beforeSignal?.([]); launched = false; exits.splice(0).forEach(resolve => resolve({ code: 0, signal: null })); return true; },
      readFile: async () => Buffer.from('{}'),
    };
    const boundary: AdapterHost = { root, discoveryFile: join(root, 'hub.json'), node: '/fixture/node', cli: '/fixture/cli', spoke: '/fixture/spoke', log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {}, hostForLaunch: () => machine, hostForProcess: () => machine };
    const clock = new FakeClock();
    let adapter: import('../src/adapters/contract.ts').HarnessAdapter;
    if (harness === 'claude-code') {
      const { ClaudeCodeAdapter } = await import('../src/adapters/claude-code.ts');
      adapter = new ClaudeCodeAdapter(boundary, { env, clock, bin: 'fixture-claude', agentsMs: 0 });
    } else if (harness === 'codex') {
      const { CodexAdapter } = await import('../src/adapters/codex.ts');
      const { ScriptedCodex } = await import('./fakes/scripted-codex.ts');
      const native = new ScriptedCodex(); native.thread = 'native';
      native.handlers.set('thread/start', () => ({ thread: { id: 'native', status: { type: 'idle' } } }));
      adapter = new CodexAdapter(boundary, { env, clock, bin: 'fixture-codex', connect: async () => native });
    } else {
      const { OpenCodeAdapter } = await import('../src/adapters/opencode.ts');
      const { OpenCodeClient } = await import('../src/adapters/opencode/client.ts');
      t.mock.method(OpenCodeClient.prototype, 'request', async (_method: string, path: string) => {
        if (path === '/api/session/active') return { data: {} };
        if (path === '/api/session' || path === '/api/session/native') return { data: { id: 'native' } };
        throw Error(`unexpected fake request ${path}`);
      });
      adapter = new OpenCodeAdapter(boundary, { env, clock, bin: 'fixture-opencode' });
    }
    try {
      if (restored) {
        const row: HarnessProcess = { harness, host: target, name: 'worker', role: 'implementer', model: 'openai/gpt-5.2', cwd: root, sessionId: 'fixture', harnessId: harness === 'codex' ? join(root, 'missing.sock') : 'old-job', harnessSessionId: 'native', pid: target === 'local' ? null : 987650, pidStarted: 'fixture-start', pidIdentity: 'fixture-birth', status: 'exited', startedAt: clock.now().toISOString(), accountEnv: poison };
        const result = await adapter.resume(row, { relaunch: true });
        assert.equal(result.found, true);
      } else {
        await adapter.spawn({ name: 'worker', role: 'implementer', model: 'openai/gpt-5.2', cwd: root, accountEnv: poison, secretEnv: poison });
      }
      const launches = frames.filter(frame => ['--bg', 'app-server', 'serve'].includes(frame.args[0]!));
      assert.equal(launches.length, 1, 'actual final role launch frame observed');
      for (const frame of frames) {
        assert.equal(frame.env.CLAND_TEST_EXECUTOR_TRANSPORT, undefined);
        assert.equal(frame.env.CLAND_TEST_FAKE_MACHINE_ROOT, undefined);
        assert.equal(frame.env.RETAINED, 'fixture');
      }
    } finally { await adapter.close(); }
  }));
}
