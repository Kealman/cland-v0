// T3: native disconnected spoke startup, stdin EOF death and reconnection of child spokes across a hub outage.
import { fixtureEnvironment } from './fixture-environment.ts';
import { ownProcess } from './process-cleanup.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { DOCUMENTED_TOOLS, SPOKE_ENTRY, startHub, spawnSpoke, TEST_SECRET, tempProject, until } from './harness.ts';
import { createHub } from '../src/hub/server.ts';

test('a spoke not started through cland stays alive, serves its tools, and answers "not connected to a cland hub"', async () => {
  const hub = await startHub();
  const spoke = await spawnSpoke({ hub, unconfigured: true });
  try {
    const { tools } = await spoke.client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), [...DOCUMENTED_TOOLS]);
    const who = await spoke.call<{ ok: boolean; error?: string }>('who');
    assert.equal(who.ok, false);
    assert.match(who.error ?? '', /not connected to a cland hub: CLAND_HUB_URL and CLAND_HUB_SECRET are not set/);
    assert.equal(spoke.events.length, 0);
  } finally {
    await spoke.close();
    await hub.close();
  }
});

test('a spoke survives a hub outage: tools report it, and it reconnects when the hub is back', async () => {
  const first = await startHub();
  const port = first.port;
  const alpha = await spawnSpoke({ hub: first, name: 'alpha', sessionId: 'sess-a' });
  const beta = await spawnSpoke({ hub: first, name: 'beta', sessionId: 'sess-b' });
  try {
    await alpha.waitForPresence(['alpha', 'beta']);
    await first.close();
    let down: { ok: boolean; error?: string } = { ok: true };
    await until(async () => {
      down = await alpha.call('send', { to: ['beta'], text: 'still there?' });
      return !down.ok;
    }, { what: 'the child spoke reports the hub outage' });
    assert.match(down.error ?? '', /unreachable|not connected|closed/);

    const second = await createHub({ port, host: '127.0.0.1', secret: TEST_SECRET });
    try {
      await alpha.waitForPresence(['alpha', 'beta'], 10_000);
      const sent = await alpha.call<{ ok: boolean; outcomes: Array<{ outcome: string }> }>('send', { to: ['beta'], text: 'back?' });
      assert.equal(sent.outcomes[0]?.outcome, 'delivered');
      await beta.waitForEvent((e) => e.params.content === 'back?');
    } finally {
      await second.close();
    }
  } finally {
    await alpha.close();
    await beta.close();
  }
});

test('a spoke whose session vanished (stdin ended without an MCP close) exits instead of haunting the hub', async (t) => {
  const root = await tempProject(t);
  const child = spawn(process.execPath, [SPOKE_ENTRY], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'], env: fixtureEnvironment(root, process.env, { PATH: process.env.PATH ?? '', TEST_SUITE_RUN_ID: process.env.TEST_SUITE_RUN_ID ?? '' }) });
  ownProcess(t, child.pid);
  const stderr: string[] = [];
  child.stderr.on('data', (c: Buffer) => stderr.push(c.toString()));
  const exited = new Promise<number | null>((resolve) => child.on('exit', (code) => resolve(code)));
  await until(() => /not connected to a cland hub/.test(stderr.join('')), { what: 'the spoke finished disconnected startup with stdin open' });
  assert.equal(child.exitCode, null, 'alive while its stdin is open');
  child.stdin.end();
  const code = await Promise.race([exited, new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 3000))]); // lint-allow-wall-clock: bound the native EOF exit receipt
  assert.equal(code, 0, `exit code (stderr: ${stderr.join('')})`);
  assert.match(stderr.join(''), /stdin (ended|closed) — exiting/);
});
