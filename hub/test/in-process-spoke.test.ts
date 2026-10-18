// T2: the real spoke's MCP surface and projectHub's real WebSocket, without a child process.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inProcessSpoke, projectHub, tempProject, waitForAbsence } from './harness.ts';
import { FakeClock } from './fake-clock.ts';

test('MCP initialization reports the root package version served by the project hub', { timeout: 5000 }, async t => {
  const version = (JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string }).version;
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const spoke = await inProcessSpoke(t, { discover: true, cwd: root, name: 'version', role: 'implementer' });
  assert.deepEqual(spoke.client.getServerVersion(), { name: 'cland', version });
  assert.equal(discovery.version, version);
});

test('an in-process role-bearing caller reads a task and delivers channel events', async t => {
  const root = await tempProject(t);
  await projectHub(t, root, {}, { clock: new FakeClock(), harnesses: 'fake' });
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  const reviewer = await inProcessSpoke(t, { discover: true, cwd: root, name: 'rev', role: 'reviewer', sessionId: 'rev-id' });
  assert.equal(coord.pid, 0, 'there is no child PID to signal');
  const clause = await reviewer.waitForEvent(e => e.params.meta?.kind === 'role');
  assert.equal(clause.params.meta?.role, 'reviewer');
  const made = await coord.call<{ ok: boolean; item: { id: string } }>('task.create', { title: 'In-process work', size: 'S' });
  assert.equal(made.ok, true);
  const viewed = await reviewer.call<{ ok: boolean; item: { title: string } }>('task.view', { id: made.item.id });
  assert.equal(viewed.ok, true);
  assert.equal(viewed.item.title, 'In-process work');
  const sent = await coord.call<{ ok: boolean }>('send', { to: ['rev'], text: 'inspect this task' });
  assert.equal(sent.ok, true);
  const event = await reviewer.waitForEvent(e => e.params.content === 'inspect this task');
  assert.equal(event.params.meta?.from_role, 'coordinator');
  assert.equal(event.params.meta?.to, 'rev');
  await reviewer.close();
  await reviewer.close();
  await waitForAbsence(coord, 'rev');
  assert.equal((await coord.call<{ ok: boolean }>('who')).ok, true, 'closing a spoke leaves this process and its other spokes alive');
  // Automatic teardown closes coord before projectHub checks for surviving handles/listeners.
});

test('closing an in-process channel disposes pending waits without exiting its host', async t => {
  const root = await tempProject(t);
  await projectHub(t, root, {}, { clock: new FakeClock(), harnesses: 'fake' });
  const exit = t.mock.method(process, 'exit', () => { throw new Error('a spoke must not exit its host'); });
  const stdinListeners = ['end', 'close'].map(event => process.stdin.rawListeners(event));
  for (const state of ['connecting', 'connected', 'unconfigured'] as const) {
    const spoke = await inProcessSpoke(t, state === 'unconfigured'
      ? { unconfigured: true, cwd: await tempProject(t) }
      : { discover: true, cwd: root, name: state, sessionId: state });
    if (state === 'connected') await spoke.waitForPresence([state]);
    const waiting = assert.rejects(spoke.waitForEvent(e => e.params.content === 'never sent'), /spoke closed/);
    // Closing the MCP peer exercises the production onclose/exit seam, before fixture cleanup.
    await spoke.client.close();
    await waiting;
    await spoke.close();
    await spoke.close();
  }
  assert.equal(exit.mock.callCount(), 0);
  assert.deepEqual(['end', 'close'].map(event => process.stdin.rawListeners(event)), stdinListeners);
});
