// T-56: the human filters the Agents log against a real hub, then follows live entries and shortcuts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectUi, spawnSpoke, startDaemon, tempProject, type FrameClient } from '../../hub/test/harness.ts';
import { centreOf, nvimOrSkip, startClient } from './harness.ts';

const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';

async function ok<T>(ui: FrameClient, frame: { type: string } & Record<string, unknown>): Promise<T> {
  const r = await ui.request(frame);
  assert.equal(r.ok, true, r.error);
  return r.value as T;
}

test('f completes items and sessions, filters history and live notices; F clears; L opens from an item or session row', { skip }, async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  await ok(ui, { type: 'task.create', title: 'First', assignee: 'alpha' });
  await ok(ui, { type: 'task.create', title: 'Second', assignee: 'other' });
  const topic = (await ok<{ topic: { id: string } }>(ui, { type: 'topic.create', title: 'First topic', item: 'T-1' })).topic;
  const alpha = await spawnSpoke({ discover: true, cwd: root, name: 'alpha', sessionId: 'sess-alpha', role: 'implementer' });
  t.after(() => alpha.close());
  const other = await spawnSpoke({ discover: true, cwd: root, name: 'other', sessionId: 'sess-other', role: 'implementer' });
  t.after(() => other.close());
  const beta = await spawnSpoke({ discover: true, cwd: root, name: 'beta', sessionId: 'sess-beta', role: 'reviewer' });
  t.after(() => beta.close());
  await alpha.waitForPresence(['alpha', 'other', 'beta']);
  await alpha.call('task.claim', { id: 'T-1' });
  await other.call('task.claim', { id: 'T-2' });
  await beta.call('send', { to: ['alpha'], text: 'message to alpha' });
  const c = await startClient(t, bin, root);
  await c.waitScreen((s) => s.includes('General') && s.includes('alpha [Implementer]'), 'connected workbench');
  await c.input('<Esc><Space>L');
  await c.waitScreen((s) => centreOf(s).includes('claimed T-2'), 'unfiltered history');
  await c.input('fT-1<Tab><CR>');
  let s = await c.waitScreen((s) => centreOf(s).includes('AGENTS · T-1') && centreOf(s).includes('claimed T-1'), 'item filter');
  assert.ok(!centreOf(s).includes('claimed T-2'));
  assert.ok(!centreOf(s).includes('message to alpha'));
  await alpha.call('send', { topic: topic.id, to: ['beta'], text: 'in first topic' });
  await c.waitScreen((s) => centreOf(s).includes('in "First topic"'), 'matching bound-topic notice');
  await other.call('task.claim', { id: 'T-2', release: true });
  await alpha.call('task.claim', { id: 'T-1', release: true });
  s = await c.waitScreen((s) => centreOf(s).includes('T-1 released'), 'matching live notice');
  assert.ok(!centreOf(s).includes('T-2 released'));
  await c.input('F');
  s = await c.waitScreen((s) => centreOf(s).includes('T-2 released') && centreOf(s).includes('message to alpha'), 'filter cleared and omitted traffic restored');
  assert.ok(!centreOf(s).includes('AGENTS · T-1'));
  await c.input('fal<Tab><CR>');
  s = await c.waitScreen((s) => centreOf(s).includes('AGENTS · alpha') && centreOf(s).includes('message to alpha'), 'session completion and filter');
  assert.ok(!centreOf(s).includes('claimed T-2'));
  await other.call('send', { to: ['beta'], text: 'only other' });
  await alpha.call('send', { to: ['beta'], text: 'live from alpha' });
  s = await c.waitScreen((s) => centreOf(s).includes('live from alpha'), 'matching live sender');
  assert.ok(!centreOf(s).includes('only other'));
  await c.input(':Cland view item T-2<CR>');
  await c.waitScreen((s) => centreOf(s).includes('T-2 · open'), 'item view');
  await c.input('L');
  s = await c.waitScreen((s) => centreOf(s).includes('AGENTS · T-2') && centreOf(s).includes('T-2 released'), 'L from item');
  assert.ok(!centreOf(s).includes('live from alpha'));
  await c.input('<Space>s<Space>s');
  await c.input('gg/beta<CR>L');
  s = await c.waitScreen((s) => centreOf(s).includes('AGENTS · beta') && centreOf(s).includes('only other'), 'L from session row');
  assert.ok(centreOf(s).includes('message to alpha'));
  assert.ok(!centreOf(s).includes('claimed T-1'));
});
