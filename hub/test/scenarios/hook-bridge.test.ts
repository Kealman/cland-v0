import { fixtureEnvironment } from '../fixture-environment.ts';
// T3 scenario: bridge reattaches then expires while its native mod parent remains alive.
// Rule coverage (T1/T2): hub/test/bridge-grace.test.ts, hub/test/mod-bridge.test.ts.
// Hub process starts: 0; two sequential projectHub instances. Only one hub is live at a time.
// CLI lifecycle seam: a real bridge, real project hub, and OS process exit.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import test from 'node:test';
import { CLI_ENTRY, connectUi, eventually, fakeClaude, pidAlive, nativeProjectHub as projectHub, tempProject, withDiscoveredPid } from '../harness.ts';
import { systemProcesses } from '../../src/system-processes.ts';
import { ownProcess } from '../process-cleanup.ts';

test('a bridge exits after its real hub stops even while its parent and stdout remain alive', { timeout: 20_000 }, async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  // The adapter strips CLAND_* from the native environment; the fake restores
  // this test-only bridge knob for its mod-owned child.
  fake.env.FAKE_CLAUDE_BRIDGE_GRACE_MS = '2000';
  const hub = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, hub.discovery);
  const launch = await ui.request({ type: 'session.launch', name: 'impl', harness: 'claude-code' }, 30_000);
  assert.equal(launch.ok, true, launch.error);
  const harness = await withDiscoveredPid(ui, (launch.value as { process: { sessionId: string } }).process);
  const child = spawn(process.execPath, [CLI_ENTRY, 'hook', 'bridge', '--session', 'impl', '--hub-file', join(root, '.cland/hub.json')], { cwd: root, env: fixtureEnvironment(root, process.env, { CLAND_TEST_BRIDGE_GRACE_MS: '2000' }), stdio: ['ignore', 'pipe', 'pipe'] });
  ownProcess(t, child.pid);
  let output = '';
  child.stdout.on('data', chunk => { output += String(chunk); });
  child.stderr.resume();
  await eventually('bridge attached', () => output.includes('"type":"bridged"') ? true : undefined);
  ui.close();
  await hub.stop();
  // The same bridge reads the new discovery and attaches after a short restart.
  const restarted = await projectHub(t, root, fake.env);
  await eventually('bridge reattached after restart', () => output.split('"type":"bridged"').length >= 3 ? true : undefined);
  await restarted.stop();
  await eventually('bridge exits within its test reconnect grace plus polling tolerance', () => child.exitCode !== null ? true : undefined, 5000);
  assert.match(output, /"type":"bridge-expired"/);
  assert.equal(child.exitCode, 0);
  assert.equal(pidAlive(child.pid!), false, 'the bridge PID has been reaped');
  // The mod's no-restart decision is proven deterministically in mod-bridge.test.ts.
  // Here inspect its live harness parent at the real bridge-exit boundary.
  assert.equal(pidAlive(harness.pid), true, 'the fake harness stays alive during the no-restart observation');
  const hasBridge = async () => (await systemProcesses()).some(row => row.parent === harness.pid && /cland\.ts\s+hook\s+bridge/.test(row.command));
  await eventually('the mod-owned bridge also expires', async () => !await hasBridge() ? true : undefined, 5000);
  assert.equal(await hasBridge(), false);
  assert.equal(pidAlive(harness.pid), true, 'the harness remains alive after its bridge expires');
});
