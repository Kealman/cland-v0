// T2: demo admission, shared slots and verdict cleanup use an in-process provider and scripted machine.
import test from 'node:test';
import assert from 'node:assert/strict';
import { eventually, inProcessSpoke } from './harness.ts';
import { drive } from './remote-clock.ts';
import { fixture } from './remote-fixture.ts';
import { startDemo } from './demo-start.ts';

test('demo daily cap refuses before creating any droplet', async t => {
  const f = await fixture(t, { machine: 'scripted', config: 'daily_spend_usd = 0.001\n' });
  const epic = ((await f.ui.request({ type: 'task.create', title: 'Capped demo', kind: 'epic' })).value as { item: { id: string } }).item.id;
  const started = await f.ui.request({ type: 'demo.start', epic });
  assert.equal(started.ok, false); assert.match(started.error ?? '', /cap|spend|budget/);
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 0);
});

test('demo authorization, shared slot refusals and verdict cleanup use the same tagged lease', async t => {
  const f = await fixture(t, { machine: 'scripted', config: 'remote_budget = 1\n' });
  const { root, ui, api } = f;
  const create = async (title: string) => ((await ui.request({ type: 'task.create', title, kind: 'epic' })).value as { item: { id: string } }).item.id;
  const epic = await create('First demo'), other = await create('Other demo');
  const before = api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length;
  const forbidden = await ui.request({ type: 'demo.start', as: { name: 'impl', sessionId: 'remote-impl', shell: true }, epic });
  assert.equal(forbidden.ok, false); assert.match(forbidden.error ?? '', /forbidden/);
  assert.equal(api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, before);
  const qa = await inProcessSpoke(t, { discover: true, cwd: root, name: 'qa-demo', sessionId: 'demo-qa', role: 'qa' }); t.after(() => qa.close());
  await qa.waitForPresence(['qa-demo']);
  const as = { name: 'qa-demo', sessionId: 'demo-qa', shell: true as const };
  const noHold = await ui.request({ type: 'demo.start', as, epic });
  assert.equal(noHold.ok, false); assert.match(noHold.error ?? '', /forbidden/);
  assert.equal((await qa.call<{ ok: boolean }>('task.hold', { id: epic })).ok, true);
  const start = await drive(f, startDemo(t, root, ui, { as, epic }));
  assert.equal(start.ok, true, start.error);
  const blocked = await ui.request({ type: 'demo.start', epic: other });
  assert.equal(blocked.ok, false); assert.match(blocked.error ?? '', /remote budget full/);
  assert.equal(api.droplets.length, 1);
  assert.equal((await qa.call<{ ok: boolean }>('task.comment', { id: epic, verdict: 'qa', result: 'clear', run: 'demo-cleanup' })).ok, true);
  await drive(f, eventually('verdict destroys demo droplet', async () => api.droplets.length === 0 ? true : undefined));
  assert.ok(api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').every(r => (r.body!.tags as string[]).includes('cland')));
});
