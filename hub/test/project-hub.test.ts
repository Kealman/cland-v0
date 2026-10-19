// T2: independent production adapter environments with an injected command edge and FakeClock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { connectUi, projectHub, tempProject } from './harness.ts';
import { FakeClock } from './fake-clock.ts';

test('two project hubs keep their adapter timing environments independent under injected scheduling', async t => {
  const calls: Array<{ args: string[]; directory: string | undefined }> = [];
  const sessions = new Map<string, Array<{ id: string; sessionId: string; status: string }>>();
  // Retain the production environment-to-adapter wiring; replace only the CLI edge.
  t.mock.method(cp, 'execFile', (bin: string, args: string[], options: cp.ExecFileOptions, callback: (error: Error | null, stdout: string, stderr: string) => void) => {
    assert.equal(bin, 'fixture-claude', 'no native process escapes the injected edge');
    const directory = options.env!.CLAUDE_CONFIG_DIR!;
    calls.push({ args, directory });
    const rows = sessions.get(directory) ?? [];
    sessions.set(directory, rows);
    queueMicrotask(() => {
      if (args[0] === '--bg') {
        const id = `background-${sessions.size}`;
        rows.push({ id, sessionId: args[args.indexOf('--session-id') + 1]!, status: 'idle' });
        callback(null, `claude attach ${id}`, '');
      } else if (args[0] === 'agents') callback(null, JSON.stringify(rows), '');
      else if (args[0] === 'stop') {
        rows.splice(rows.findIndex(row => row.id === args[1]), 1);
        callback(null, '', '');
      } else assert.fail(`unexpected Claude command ${args[0]}`);
    });
    return {};
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  const instances: Array<{ ui: Awaited<ReturnType<typeof connectUi>>; clock: FakeClock; directory: string }> = [];
  for (const agentsMs of [50, 3000]) {
    const root = await tempProject(t);
    const clock = new FakeClock();
    const directory = join(root, 'claude');
    const { discovery } = await projectHub(t, root, {
      CLAND_CLAUDE_BIN: 'fixture-claude', CLAND_ADAPTER_POLL_MS: '50',
      CLAND_CLAUDE_AGENTS_MS: String(agentsMs), CLAUDE_CONFIG_DIR: directory,
    }, { clock, harnesses: 'native' });
    const ui = await connectUi(t, discovery);
    const launched = await ui.request({ type: 'session.launch', name: 'impl', harness: 'claude-code', role: 'implementer' });
    assert.equal(launched.ok, true, launched.error);
    instances.push({ ui, clock, directory });
  }
  const polls = (index: number) => calls.filter(call => call.directory === instances[index]!.directory && call.args[0] === 'agents');
  const before = polls(0).length;
  for (const { clock } of instances) await clock.advance(150);
  assert.ok(polls(0).length >= before + 3, 'fast hub polls three times while slow hub waits for its own interval');
  assert.equal(polls(1).length, 1, 'slow instance keeps its 3000 ms schedule');
  for (const { ui } of instances) assert.equal((await ui.request({ type: 'session.stop', session: 'impl' })).ok, true);
});
