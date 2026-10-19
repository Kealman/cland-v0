// T2: recorded history frames and live traffic; independent hub filtering in nvim-agents-filters-rules.test.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { centreOf } from './stub-client.ts';
import { proc, skip, startShell, ts } from './shell-fixture.ts';
import type { Shell } from './shell-fixture.ts';

const msg = (id: string, from: string, to: string[], text: string, kind = 'report', detail = {}) => ({
  id, from, fromKind: 'agent', fromRole: from === 'beta' ? 'reviewer' : 'implementer', via: 'spoke',
  to, text, kind, detail, ts: ts(1), topic: 'agents',
});
async function traffic(c: Shell, row: ReturnType<typeof msg>, history: ReturnType<typeof msg>[]) {
  history.push(row);
  await c.control({ set: { messages: { agents: history } }, emit: { type: 'message', topic: { id: 'agents', title: 'Agents' }, message: row } });
}
test('recorded Agents history supports completion, live filters, clearing and shortcuts', { skip }, async (t) => {
  const history = [
    msg('claim-1', 'alpha', [], 'T-1 claimed T-1', 'claim', { item: 'T-1', session: 'alpha' }),
    msg('claim-2', 'other', [], 'T-2 claimed T-2', 'claim', { item: 'T-2', session: 'other' }),
    msg('report-1', 'beta', ['alpha'], 'message to alpha'),
  ];
  const c = await startShell(t, s => {
    s.processes = ['alpha', 'other', 'beta'].map(name => proc(name, name === 'beta' ? 'reviewer' : 'implementer', 'idle'));
    s.messages!.agents = history;
    s.items = [1, 2].map(n => ({ id: `T-${n}`, kind: 'task', title: n === 1 ? 'First' : 'Second', state: 'open', labels: [], blocked_by: [], claim: null }));
  });
  await c.input('<Esc><Space>L');
  await c.waitScreen((s) => centreOf(s).includes('claimed T-2'), 'unfiltered history');
  await c.input('fT-1<Tab><CR>');
  let s = await c.waitScreen((s) => centreOf(s).includes('AGENTS · T-1') && centreOf(s).includes('claimed T-1'), 'item filter');
  assert.ok(!centreOf(s).includes('claimed T-2'));
  assert.ok(!centreOf(s).includes('message to alpha'));
  await traffic(c, msg('bound', 'alpha', ['beta'], 'in "First topic"', 'agent-message', { item: 'T-1', topic: 'first' }), history);
  await c.waitScreen((s) => centreOf(s).includes('in "First topic"'), 'matching bound-topic notice');
  await traffic(c, msg('release-2', 'other', [], 'T-2 released', 'release', { item: 'T-2', session: 'other' }), history);
  await traffic(c, msg('release-1', 'alpha', [], 'T-1 released', 'release', { item: 'T-1', session: 'alpha' }), history);
  s = await c.waitScreen((s) => centreOf(s).includes('T-1 released'), 'matching live notice');
  assert.ok(!centreOf(s).includes('T-2 released'));
  await c.input('F');
  s = await c.waitScreen((s) => centreOf(s).includes('T-2 released') && centreOf(s).includes('message to alpha'), 'filter cleared and omitted traffic restored');
  assert.ok(!centreOf(s).includes('AGENTS · T-1'));
  await c.input('fal<Tab><CR>');
  s = await c.waitScreen((s) => centreOf(s).includes('AGENTS · alpha') && centreOf(s).includes('message to alpha'), 'session completion and filter');
  assert.ok(!centreOf(s).includes('claimed T-2'));
  await traffic(c, msg('other', 'other', ['beta'], 'only other'), history);
  await traffic(c, msg('alpha', 'alpha', ['beta'], 'live from alpha'), history);
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

test('recorded Agents frames exclude another pair’s loop metadata from a loop session', { skip }, async (t) => {
  const history = [msg('role', 'hub', [], 'loop assigned Implementer', 'role-assign', { session: 'loop' })];
  const c = await startShell(t, s => {
    s.processes = ['loop', 'alpha', 'beta'].map(name => proc(name, name === 'beta' ? 'reviewer' : 'implementer', 'idle'));
    s.messages!.agents = history;
  });
  await c.input('<Esc><Space>L');
  await c.waitScreen((s) => centreOf(s).includes('loop assigned Implementer'), 'history loaded');
  await c.input('floop<CR>');
  await c.waitScreen((s) => centreOf(s).includes('AGENTS · loop'), 'loop session filter');
  await traffic(c, msg('first', 'alpha', ['beta'], 'first'), history);
  await traffic(c, msg('mute', 'hub', ['alpha', 'beta'], 'muted: loop', 'event', { rule: 'loop' }), history);
  await traffic(c, msg('sentinel', 'loop', ['beta'], 'loop sentinel'), history);
  const screen = await c.waitScreen((s) => centreOf(s).includes('loop sentinel'), 'matching live entry after unrelated mute');
  assert.ok(!centreOf(screen).includes('muted:'), 'the rule named loop does not name the session loop');
});
