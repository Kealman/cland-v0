// T3: real worker launch and CLI stop enforce live-subtree authority and reparenting.
import { claudeLaunchIdentity } from './claude-launch-fixture.ts';
import { sessionUi as connectUi, sessionClandWithEnv as clandWithEnv } from './session-credential-fixture.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeClaude, spawnSpoke, nativeProjectHub as projectHub, tempProject, withDiscoveredPid, eventually } from './harness.ts';
import type { HarnessProcessView } from '../src/protocol.ts';

test('Lead launches and stops only sessions serving its live subtree', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  const create = async (title: string, kind = 'task', parent?: string) => (await coord.call<{ item: { id: string } }>('task.create', { ...(['task'].includes(kind) ? { size: 'M' } : {}), title, kind, parent })).item.id;
  const epic = await create('Own epic', 'epic');
  const other = await create('Other epic', 'epic');
  const own = await create('Own task', 'task', epic);
  const foreign = await create('Foreign task', 'task', other);
  const launched = await coord.call<{ ok: boolean; process: HarnessProcessView }>('session.launch', { name: 'lead-1', role: 'lead', item: epic, harness: 'claude-code' });
  assert.equal(launched.ok, true);
  // Wait for the native MCP spoke before connecting the observer.
  await ui.waitFor(f => f.type === 'session.usage' && f.sessionId === launched.process.sessionId);
  const lead = await spawnSpoke({ cwd: root, discover: true, name: 'lead-1', ...(await claudeLaunchIdentity(fake, 'lead-1')), sessionId: launched.process.sessionId, assignRole: false });
  t.after(() => lead.close());
  const stop = (name: string) => clandWithEnv(root, { CLAND_SESSION_NAME: 'lead-1', CLAND_SESSION_ID: launched.process.sessionId }, 'session', 'stop', name);
  await lead.waitForPresence(['coord', 'lead-1']);
  const launch = (name: string, item?: string) => lead.call<{ ok: boolean; code?: string; reason?: string; process: HarnessProcessView }>('session.launch', { name, role: 'implementer', harness: 'claude-code', item });
  const worker = await launch('own-worker', own);
  assert.equal(worker.ok, true, worker.reason);
  assert.equal(worker.process.item, own);
  for (const [name, item] of [['foreign-worker', foreign], ['unbound-worker', undefined]]) {
    const denied = await launch(name!, item);
    assert.equal(denied.ok, false);
    assert.equal(denied.code, 'forbidden');
    assert.match(denied.reason!, new RegExp(`Lead.*epic ${epic}.*subtree`));
  }
  const elsewhere = await coord.call<{ ok: boolean }>('session.launch', { name: 'foreign-worker', role: 'implementer', item: foreign, harness: 'claude-code' });
  assert.equal(elsewhere.ok, true);
  const stopForeign = await ui.request({ type: 'session.stop', session: 'foreign-worker', as: { name: 'lead-1' } });
  assert.equal(stopForeign.ok, false);
  assert.match(stopForeign.error!, /subtree/);
  const ownProcess = await withDiscoveredPid(ui, worker.process);
  assert.equal((await stop('own-worker')).code, 0);
  await eventually('the stopped worker PID is gone', () => { try { process.kill(ownProcess.pid, 0); return undefined; } catch { return true; } });
  assert.throws(() => process.kill(ownProcess.pid, 0), /ESRCH/);
  // Reparenting takes effect on the next request; launch history grants nothing.
  assert.equal((await coord.call<{ ok: boolean }>('task.link', { id: foreign, parent: epic })).ok, true);
  assert.equal((await stop('foreign-worker')).code, 0);
  assert.equal((await fake.sessions()).some(s => s.name === 'unbound-worker'), false);
});
