// The plan view at the real hub frame and headless Neovim boundaries.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';
import { connectUi, startDaemon, tempProject } from '../../hub/test/harness.ts';
import type { ItemView } from '../../hub/src/tracker/tracker.ts';
import type { EpicPlan } from '../../hub/src/tracker/plan.ts';
import { nvimOrSkip, startClient, type Client } from './harness.ts';
const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';
async function setup(t: test.TestContext) {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const create = async (title: string, kind: string, parent?: string) => {
    const result = await ui.request({ type: 'task.create', title, kind, parent, body: '## Acceptance criteria\n- [ ] C1. Works' });
    assert.equal(result.ok, true, result.error);
    const item = (result.value as { item: ItemView }).item;
    if (kind === 'task') assert.equal((await ui.request({ type: 'task.edit', item: item.id, status: 'planned' })).ok, true);
    return item;
  };
  const release = await create('Release', 'release');
  const epic = await create('Panels', 'epic', release.id);
  const a = await create('Registry', 'task', epic.id), b = await create('Sessions', 'task', epic.id), c = await create('Plan UI', 'task', epic.id);
  const outside = await create('External blocker', 'task', release.id);
  assert.equal((await ui.request({ type: 'task.link', item: a.id, blocked_by: [outside.id] })).ok, true);
  const plan: EpicPlan = {
    stages: [
      { name: 'registry and sessions', qa: { scope: 'affected', when: 'after-stage' }, lanes: [[a.id], [b.id]] },
      { name: 'plan view', qa: { scope: 'full', when: 'per-item' }, lanes: [[c.id]] },
    ],
    items: { [b.id]: { qa: { scope: 'none', when: 'per-item' } }, [c.id]: { qa_criteria: ['C1'] } },
  };
  assert.equal((await ui.request({ type: 'task.plan', item: epic.id, op: 'set', yaml: stringify(plan) })).ok, true);
  const client = await startClient(t, bin, root);
  await client.waitScreen(s => s.includes('hub: connected'), 'connected');
  await client.input(`<Esc>:Cland view item ${epic.id}<CR>`);
  await client.waitScreen(s => s.includes('Panels'), 'epic item');
  return { root, ui, epic, a, b, c, outside, plan, client };
}
async function planText(client: Client, id: string) {
  return client.lua<string>("return table.concat(vim.api.nvim_buf_get_lines(require('cland.plan').bufs[...],0,-1,false),'\\n')", id);
}
async function waitPlan(client: Client, id: string, text: string) {
  await client.lua("local id,text=...; return vim.wait(5000,function() local b=require('cland.plan').bufs[id]; return b and table.concat(vim.api.nvim_buf_get_lines(b,0,-1,false),'\\n'):find(text,1,true) end,20)", id, text);
  assert.ok((await planText(client, id)).includes(text), text);
}

test('graph nodes show stages from a plan accepted by the real hub', { skip }, async t => {
  const { client, epic, a, b, c } = await setup(t);
  await client.input(`<Esc>:Cland graph ${epic.id}<CR>`);
  await client.waitScreen(s => s.includes(`${a.id} S1`) && s.includes(`${b.id} S1`) && s.includes(`${c.id} S2`), 'real plan stage tags');
});

test('gp shows stages, lanes, overrides, gates and scoped stage tags; a keeps the real hub refusal visible', { skip }, async t => {
  const { root, client, epic, a, b, c, outside } = await setup(t);
  await client.input('gp');
  await client.waitScreen(s => s.includes('Plan of') && s.includes('registry and sessions'), 'plan opened by gp');
  await waitPlan(client, epic.id, 'QA criteria: C1');
  const text = await planText(client, epic.id);
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
  await client.waitScreen(s => s.includes('task.plan op must be set or show'), 'approval refused by current hub');
  assert.equal(await planText(client, epic.id), text, 'refused approval never changes the card');
  assert.equal(await readFile(join(root, epic.path), 'utf8'), sourceBefore);
  assert.deepEqual(await client.lua("return require('cland.actions').audit()"), []);
  for (const columns of [80, 120, 200]) {
    await client.rpc.request('nvim_ui_try_resize', columns, 45);
    const fits = await client.lua<boolean>(`local b=require('cland.plan').bufs[...]; local w=vim.api.nvim_win_get_width(vim.fn.bufwinid(b)); for _,line in ipairs(vim.api.nvim_buf_get_lines(b,0,-1,false)) do if vim.api.nvim_strwidth(line)>w then return false end end; return true`, epic.id);
    assert.ok(fits, `plan fits ${columns} columns`);
  }
});

test('plan changes refresh both view and stage tags; d composes to the epic Lead and e opens ## Plan', { skip }, async t => {
  const { root, ui, epic, a, b, plan, client } = await setup(t);
  await client.input('gp');
  await client.waitScreen(s => s.includes('registry and sessions'), 'original plan');
  const changed = structuredClone(plan);
  changed.stages[0]!.lanes = [[a.id]];
  changed.stages[1]!.lanes.push([b.id]);
  changed.stages[1]!.name = 'changed plan view';
  assert.equal((await ui.request({ type: 'task.plan', item: epic.id, op: 'set', yaml: stringify(changed) })).ok, true);
  await waitPlan(client, epic.id, 'changed plan view');
  await client.waitScreen(s => s.includes(`${b.id} S2`), 'updated stage tag');
  const source = await readFile(join(root, epic.path), 'utf8');
  await writeFile(join(root, epic.path), source.replace('scope: full', 'scope: broken'));
  await waitPlan(client, epic.id, 'Previous accepted plan kept:');
  assert.ok((await planText(client, epic.id)).includes('changed plan view'));
  await writeFile(join(root, epic.path), source);
  await client.lua("local id=...; assert(vim.wait(5000,function() return not require('cland.plan').detail[id].planError end,20))", epic.id);
  await client.input('d');
  await client.waitScreen(s => s.includes(`@lead ${epic.id}`), 'Lead discussion draft');
  assert.equal(await client.lua("return require('cland.state').S.ui.view.kind"), 'thread');
  await client.input('Please explain the second stage.<CR>');
  await client.waitScreen(s => s.includes('Please explain the second stage.'), 'discussion sent');
  const topic = await client.lua<string>("return require('cland.state').S.ui.view.id");
  const history = await ui.request({ type: 'topic.history', topic });
  assert.equal(history.ok, true);
  const messages = (history.value as { messages: { text: string }[] }).messages;
  assert.ok(messages.some(m => m.text === `@lead ${epic.id} Please explain the second stage.`));
  await client.input(`<Esc>:Cland view plan ${epic.id}<CR>`);
  await client.waitScreen(s => s.includes('Plan of'), 'plan from command');
  await client.input('e');
  assert.equal(await client.lua('return vim.api.nvim_buf_get_name(0)'), join(root, epic.path));
  assert.equal(await client.lua('return vim.api.nvim_get_current_line()'), '## Plan');
  await client.input(`<Esc>:Cland view item ${epic.id}<CR>`);
  await client.waitScreen(s => s.includes('Panels'), 'item view');
  await client.input('<Space>p>Open its epic plan<CR>');
  await client.waitScreen(s => s.includes('Plan of'), 'plan from palette');
});


test('a planned child leaving the epic invalidates its former plan on reparent and removal', { skip }, async t => {
  const { root, epic, a, client } = await setup(t);
  await client.input('gp');
  await client.waitScreen(s => s.includes('registry and sessions'), 'original plan');
  const path = join(root, a.path);
  const source = await readFile(path, 'utf8');
  await writeFile(path, source.replace(`parent: ${epic.id}`, 'parent: null'));
  await waitPlan(client, epic.id, `${a.id}: plan item is not under epic`);
  await writeFile(path, source);
  await client.lua("local id=...; assert(vim.wait(5000,function() return not require('cland.plan').detail[id].planError end,20))", epic.id);
  await unlink(path);
  await waitPlan(client, epic.id, `${a.id}: no such`);
  assert.ok((await planText(client, epic.id)).includes('Previous accepted plan kept:'));
});

test('the plan shows Lead metadata and lane claim/verdict marks, including role labels and long source fences', { skip }, async t => {
  const root = await tempProject(t);
  const plan: EpicPlan = { stages: [{ name: 'presentation', qa: { scope: 'none', when: 'per-item' }, lanes: [['T-3'], ['T-4']] }] };
  const source = stringify(plan);
  const scenario = {
    tracker: { levels: ['release', 'epic'] },
    roles: [{ role: 'lead', label: 'Lead' }, { role: 'implementer', label: 'Implementer' }],
    processes: [{ name: 'lead-2', role: 'lead', status: 'running', state: 'idle', harness: 'codex', model: 'gpt-6-sol' }, { name: 'impl-3', role: 'implementer', status: 'running', state: 'busy' }],
    items: [
      { id: 'T-1', kind: 'release', title: 'Release', state: 'open' },
      { id: 'T-2', kind: 'epic', title: 'Panels', parent: 'T-1', state: 'open', file: 'T-2.md', claim: { session: 'lead-2', role: 'lead' }, plan, body: `## Plan\n\n~~~~yaml\n${source}~~~~` },
      { id: 'T-3', kind: 'task', title: 'Claimed row', parent: 'T-2', state: 'open', status: 'in progress', claim: { session: 'impl-3', role: 'implementer' } },
      { id: 'T-4', kind: 'task', title: 'Failed row', parent: 'T-2', state: 'open', status: 'review', verdicts: [{ verdict: 'review', result: 'not clear' }] },
    ],
  };
  const client = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, fileURLToPath(new URL('./stub-hub.ts', import.meta.url))]), CLAND_STUB_SCENARIO_JSON: JSON.stringify(scenario) });
  await client.waitScreen(s => s.includes('hub: connected'), 'connected');
  await client.input('<Esc>:Cland view plan T-2<CR>');
  await client.waitScreen(s => s.includes('Plan of'), 'plan');
  await client.lua("local l=require('cland.layout'); if require('cland.state').S.ui.right then l.right_panel(require('cland.state').S.ui.right) end; if require('cland.state').S.ui.left then l.toggle_left() end");
  await waitPlan(client, 'T-2', 'stages:');
  let text = await planText(client, 'T-2');
  for (const fact of ['lead-2 [Lead]', 'codex', 'gpt-6-sol', 'idle', 'impl-3 [Implementer]', '✗ review']) assert.ok(text.includes(fact), fact);
  await client.lua("local l=require('cland.layout'); l.toggle_left(); vim.api.nvim_win_set_width(l.win.left,76); require('cland.state').changed()");
  await client.waitScreen(s=>s.includes('lead-2 [Lead]'), 'Lead role in panel');
  const panel = await client.lua<string>("return table.concat(vim.api.nvim_buf_get_lines(require('cland.panels').buf('items'),0,-1,false),'\\n')");
  assert.ok(panel.includes('lead-2 [Lead]'));
  // Both source delimiters are accepted by the hub; the view must not restrict the excerpt to three backticks.
  await client.lua("local d=require('cland.item_view').detail['T-2']; d.body=...; require('cland.state').changed()", `## Plan\n\n\`\`\`\`yaml\n${source}\`\`\`\``);
  await client.lua("require('cland.plan').render('T-2')");
  await waitPlan(client, 'T-2', 'stages:');
  text = await planText(client, 'T-2');
  assert.ok(text.includes('presentation'));
});
