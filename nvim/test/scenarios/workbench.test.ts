// T3 scenario: Neovim attach, composer delivery, thread ask/artifact, explorer and plan approval.
// Rule coverage (T1/T2): hub/test/routing.test.ts, nvim/test/explorer-summary.test.ts, nvim/test/events.test.ts.
// Hub process starts: 0; sequential projectHub fixtures; real headless Neovim is the process boundary. Only one hub is live at a time.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, projectHub, spawnSpoke, tempProject } from '../../../hub/test/harness.ts';
import { centreOf, clock, startClient, type Client } from '../harness.ts';
import { waitInitialSnapshots } from '../readiness.ts';
import { setup, planText, waitPlan, bin, skip } from '../plan-support.ts';
const composerLines = (c: { lua: <T>(code: string) => Promise<T> }) => c.lua<string[]>("return vim.api.nvim_buf_get_lines(vim.fn.bufnr('cland://composer/general'), 0, -1, false)");
const notice = (s: string): boolean => /^   ▲ /m.test(centreOf(s));
async function select(c:Client, key:string) {
  await c.lua("local key=...; local e=require('cland.explorer'); for r,row in ipairs(e.rows) do if row.key==key then vim.api.nvim_win_set_cursor(e.tree_win(),{r,0}); return end end; error('missing row '..key)",key);
}
async function cursor(c:Client) {
  return c.lua<string>("local e=require('cland.explorer'); return e.key_at(vim.api.nvim_win_get_cursor(e.tree_win())[1])");
}

test('a message typed in the composer shows queued, reaches a coordinator with the topic, and turns delivered; the reply shows with sender and time', { skip }, async (t) => {
  const root = await tempProject(t);
  await projectHub(t, root);
  const c = await startClient(t, bin, root);
  await c.waitScreen((s) => centreOf(s).includes('No messages in General yet.') && !notice(s), 'the empty General thread, connected');

  await c.input('hello<CR>');
  const queued = await c.waitScreen((s) => /^[▎▌] you → coordinator {2}\d\d:\d\d · message +⌁ queued $/m.test(centreOf(s)) && /^[▎▌] hello +$/m.test(centreOf(s)), 'hello, queued');
  assert.equal(notice(queued), false, 'no notice: the client is connected');
  assert.deepEqual(await composerLines(c), ['› '], 'the composer is empty again');

  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'sess-coord' });
  t.after(() => coord.close());
  const event = await coord.waitForEvent((e) => e.params.content === 'hello', 15_000);
  assert.equal(event.params.meta?.topic, 'general');
  assert.equal(event.params.meta?.topic_title, 'General');
  assert.equal(event.params.meta?.from_kind, 'human');
  await c.waitScreen((s) => /^[▎▌] you → coordinator {2}\d\d:\d\d · message +✓ delivered $/m.test(centreOf(s)), 'hello, delivered');

  const reply = await coord.call<{ ok: boolean }>('send', { text: 'hello, human' });
  assert.equal(reply.ok, true);
  const [last] = (await coord.call<{ messages: Array<{ ts: string; text: string }> }>('history', { limit: 1 })).messages;
  assert.equal(last?.text, 'hello, human');
  const screen = await c.waitScreen((s) => centreOf(s).includes('hello, human'), 'the reply');
  assert.match(centreOf(screen), new RegExp(`^[▎▌] coord \\[Coordinator\\] → you {2}${clock(last?.ts ?? '')} · report *$`, 'm'), 'sender [Role], local time and kind');
  assert.match(centreOf(screen), /^[▎▌] hello, human *$/m);
  // the human's message keeps its stage; the agent's has none
  assert.match(centreOf(screen), /^[▎▌] you → coordinator {2}\d\d:\d\d · message +✓ delivered $/m);
});

test('a digit in the thread answers through the real hub with answer_to; the ask and next chip share a header', { skip }, async t => {
  const root = await tempProject(t);
  await projectHub(t, root);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const asked = await coord.call<{ok: boolean; ask: string}>('ask', { topic: 'general', question: 'Which scope?', options: ['Whole diff', 'Fix only'] });
  assert.equal(asked.ok, true);
  await coord.call('artifact.create', { topic: 'general', kind: 'note', title: 'Review evidence', content: 'Evidence for the choice.' });
  const c = await startClient(t, bin, root);
  await c.waitScreen(s => s.includes('Review evidence') && s.includes('Which scope?'), 'real ask and chip');
  await c.input('<Esc>');
  await c.lua(`
    local t=require('cland.views').topic('general').thread
    vim.api.nvim_set_current_win(require('cland.layout').centre())
    for row in ipairs(t.info) do if t:ask_at(row) then vim.api.nvim_win_set_cursor(0,{row,0}); break end end
  `);
  await c.input('2');
  await coord.waitForEvent(e => e.params.meta?.from_kind === 'human' && e.params.content === 'Fix only' && e.params.meta.answer_to === asked.ask);
  await c.waitScreen(s => s.includes('┃ ✓ 2  Fix only') && s.includes('ask · ✓ answered'), 'answer in place');
  assert.deepEqual(await c.lua(`
    local t=require('cland.views').topic('general').thread
    local ask=t.by_id[...]
    local b=t.block_of[ask.id]
    local headers,targets=0,0
    for _,i in ipairs(b.info) do if i.head then headers=headers+1 end; if i.ask then targets=targets+1 end end
    return {messages=#b.msgs,headers=headers,open_targets=targets,artifact=b.msgs[2].artifact.id}
  `, asked.ask), {messages: 3, headers: 2, open_targets: 0, artifact: 'A-1'});
  await c.lua(`
    local t=require('cland.views').topic('general').thread
    for row,i in ipairs(t.info) do if i.artifact then vim.api.nvim_win_set_cursor(0,{row,0}); break end end
  `);
  await c.input('<CR>');
  await c.waitScreen(s => s.includes('Evidence for the choice.'), 'grouped chip opens its durable source');
});

test('Space e and the explorer command open a release tree on real hub summaries', { skip }, async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  const create = async (kind: string, title: string, parent?: string) => {
    const result = await ui.request({ type:'task.create', kind, title, parent, ...(kind === 'task' ? { size:'S' } : {}) });
    assert.equal(result.ok, true, result.error);
    return (result.value as {item:{id:string}}).item.id;
  };
  const release = await create('release', 'Working with items');
  const epic = await create('epic', 'The explorer', release);
  const task = await create('task', 'Draw the tree', epic);
  await ui.request({type:'task.edit',item:task,status:'planned'});
  const c = await startClient(t, bin, root, {}, {centre:'explorer'});
  await c.rpc.request('nvim_ui_try_resize', 200, 50);
  await waitInitialSnapshots(c);
  await c.input('<Esc><Space>e');
  await c.waitScreen(s => s.includes('EXPLORER') && s.includes('The explorer') && s.includes('Categories (0)'), 'release explorer');
  assert.equal(await c.lua("return vim.b.cland_role"), 'explorer');
  await c.input(`:Cland explorer T-${epic.split('-')[1]}<CR>`);
  await c.waitScreen(s => s.includes('Draw the tree'), 'epic scoped using any prefix');
  assert.equal(await c.lua("return require('cland.state').S.ui.view.id"), epic);
  await select(c,task); await c.input('<CR>h');
  assert.equal((await ui.request({type:'task.edit',item:task,status:'in progress'})).ok,true);
  await c.lua("local id=...;assert(vim.wait(5000,function() return require('cland.state').item(id).status=='in progress' end))",task);
  assert.equal(await cursor(c),task,'real task frames preserve cursor identity');
  assert.equal(await c.lua("return require('cland.explorer').card.key"),task);
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"), []);
  await c.input('<Space>?');
  await c.waitScreen(s => s.includes('Open explorer') && s.includes('␣e'), 'explorer key in registry help');
});

test('graph nodes show stages from a plan accepted by the real hub', { skip }, async t => {
  const { client, epic, a, b, c } = await setup(t);
  await client.input(`<Esc>:Cland graph ${epic.id}<CR>`);
  await client.waitScreen(s => s.includes(`${a.id} S1`) && s.includes(`${b.id} S1`) && s.includes(`${c.id} S2`), 'real plan stage tags');
});

test('gp shows stages, lanes, overrides, gates and scoped stage tags; a approves through the real hub', { skip }, async t => {
  const { root, ui, client, epic, a, b, c, outside } = await setup(t);
  await client.input('gp');
  await client.waitScreen(s => s.includes('Plan of') && s.includes('registry and sessions'), 'plan opened by gp');
  await waitPlan(client, epic.id, 'QA criteria: C1');
  const text = await planText(client, epic.id);
  assert.ok(!text.includes('· in work ·'), 'before-start stages stay planned');
  for (const expected of ['S1 · registry and sessions', 'lane 1', 'lane 2', 'QA: affected · after stage', 'override: QA none · review only', 'Gate:', 'starts when S1 closes', 'full · per item', 'QA runs: 2 planned', 'Estimated QA cost: [cost]', 'External blocker', 'stages:']) assert.ok(text.includes(expected), expected);
  const panel = await client.lua<string>("return table.concat(vim.api.nvim_buf_get_lines(require('cland.panels').buf('items'),0,-1,false),'\\n')");
  assert.match(panel, new RegExp(`${a.id} S1 ›`));
  assert.match(panel, new RegExp(`${b.id} S1 ›`));
  assert.match(panel, new RegExp(`${c.id} S2 ›`));
  assert.ok(!panel.includes(outside.id), 'external task stays outside the filtered panel');
  // The two first-stage lanes occupy columns on the same line, not a flattened list.
  assert.ok(text.split('\n').some(line => line.includes(a.id) && line.includes(b.id)));
  const sourceBefore = await readFile(join(root, epic.path), 'utf8');
  await client.input('a');
  await waitPlan(client, epic.id, '✓ approved by human');
  assert.ok(text.includes('awaiting your approval'));
  assert.notEqual(await readFile(join(root, epic.path), 'utf8'), sourceBefore);
  const approved = (await ui.request({ type: 'task.plan', op: 'show', item: epic.id })).value as { approval: { state: string } };
  assert.equal(approved.approval.state, 'approved');
  assert.deepEqual(await client.lua("return require('cland.actions').audit()"), []);
  for (const columns of [80, 120, 200]) {
    await client.rpc.request('nvim_ui_try_resize', columns, 45);
    const fits = await client.lua<boolean>(`local b=require('cland.plan').bufs[...]; local w=vim.api.nvim_win_get_width(vim.fn.bufwinid(b)); for _,line in ipairs(vim.api.nvim_buf_get_lines(b,0,-1,false)) do if vim.api.nvim_strwidth(line)>w then return false end end; return true`, epic.id);
    assert.ok(fits, `plan fits ${columns} columns`);
  }
});

// T3 recorder: real hub frames establish the attach snapshot contract, and the
// hub-side producer checks every projection consumed by the stub T2 clients.
test('recorded protocol fixtures match the live hub attach frames', async t => {
  const { fixtureOutput } = await import('../../../hub/test/nvim-frame-source.ts');
  const { checkRecordings, checkLiveFrames } = await import('../../../hub/test/nvim-fixture-check.ts');
  const { FakeClock } = await import('../../../hub/test/fake-clock.ts');
  const { STUB_NOW } = await import('../fixtures/clock.ts');
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock(Date.parse(STUB_NOW)) });
  const ui = await connectUi(t, discovery);
  const request = async (frame: Record<string, unknown>) => {
    const result = await ui.request(frame as { type: string });
    assert.equal(result.ok, true, result.error);
    return result.value as Record<string, unknown>;
  };
  const status = await request({ type: 'hub.status' });
  const tracker = status.tracker as Record<string, unknown>;
  const created = await request({ type: 'task.create', title: 'Recorded task', size: 'S', body: '## Acceptance criteria\n- [ ] C1. Recorded criterion\n' });
  const item = created.item as { id: string };
  const snapshots = {
    status: { keys: status.keys, tracker: { levels: tracker.levels, ladder: tracker.ladder, prefixes: tracker.prefixes } },
    items: await request({ type: 'task.list' }),
    view: await request({ type: 'task.view', item: item.id }),
    inbox: await request({ type: 'inbox.list' }),
  };
  const stable = JSON.parse(JSON.stringify(snapshots).replaceAll(root, '@root@'));
  assert.deepEqual(fixtureOutput('config', { source: '' }), stable.status, 'stub config recordings use the real attach contract');
  const liveItem = stable.view.item;
  const details = fixtureOutput('criteria', { body: liveItem.body, criteria: liveItem.criteria }) as Record<string, unknown>;
  assert.deepEqual(details.criteria, liveItem.criteria);
  assert.deepEqual(details.criteriaCounts, liveItem.criteriaCounts);
  await checkLiveFrames(stable);
  await checkRecordings();
});
