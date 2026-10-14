// The plan view at the real hub frame and headless Neovim boundaries.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';
import { connectUi, startDaemon, tempProject } from '../../hub/test/harness.ts';
import type { ItemView } from '../../hub/src/tracker/tracker.ts';
import type { EpicPlan } from '../../hub/src/tracker/plan.ts';
import { nvimOrSkip, startClient, type Client } from './harness.ts';
import { waitInitialSnapshots } from './readiness.ts';
const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';
async function setup(t: test.TestContext) {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[plan]\napproval = "human"\n');
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const create = async (title: string, kind: string, parent?: string) => {
    const result = await ui.request({ ...(['task'].includes(kind) ? { size: 'M' } : {}), type: 'task.create', title, kind, parent, body: '## Acceptance criteria\n- [ ] C1. Works' });
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
  await waitInitialSnapshots(client);
  await client.input(`<Esc>:Cland view item ${epic.id}<CR>`);
  await client.waitScreen(s => s.includes('Panels'), 'epic item');
  return { root, ui, epic, a, b, c, outside, plan, client };
}
async function planText(client: Client, id: string) {
  return client.lua<string>("return table.concat(vim.api.nvim_buf_get_lines(require('cland.plan').bufs[...],0,-1,false),'\\n')", id);
}
async function waitFor(predicate: () => Promise<boolean>, what: string) {
  // Yield to Neovim between lookups so queued navigation and receipt frames can run.
  const until = Date.now() + 5000;
  let ready = false;
  while (Date.now() < until) {
    ready = await predicate();
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.ok(ready, `${what} not ready within 5000 ms`);
}
async function openPlan(client: Client, id: string) {
  // Connected precedes the task/ladder snapshots. An early command is refused,
  // so waiting for plan text after issuing it cannot recover that navigation.
  await waitFor(() => client.lua<boolean>("local id=...; return require('cland.plan').owner(id) == id", id), `epic ${id} from task and tracker snapshots`);
  await client.input(`<Esc>:Cland view plan ${id}<CR>`);
}
async function waitPlan(client: Client, id: string, text: string) {
  await waitFor(() => client.lua<boolean>("local id,text=...; local view=require('cland.state').S.ui.view; local p=require('cland.plan'); local b,v=p.bufs[id],p.visits[id]; return view.kind == 'plan' and view.id == id and v ~= nil and not v.acknowledge and b ~= nil and vim.api.nvim_buf_is_valid(b) and table.concat(vim.api.nvim_buf_get_lines(b,0,-1,false),'\\n'):find(text,1,true) ~= nil", id, text), `plan showing ${text}`);
  assert.ok((await planText(client, id)).includes(text), text);
}

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
  await openPlan(client, epic.id);
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
  await openPlan(client, 'T-2');
  await client.waitScreen(s => s.includes('Plan of'), 'plan');
  await client.lua("local l=require('cland.layout'); if require('cland.state').S.ui.right then l.right_panel(require('cland.state').S.ui.right) end; if require('cland.state').S.ui.left then l.toggle_left() end");
  await waitPlan(client, 'T-2', 'stages:');
  let text = await planText(client, 'T-2');
  for (const fact of ['lead-2 [Lead]', 'codex', 'gpt-6-sol', 'idle', 'impl-3 [Implementer]', '✗ review']) assert.ok(text.includes(fact), fact);
  await client.lua("local l=require('cland.layout'); l.toggle_left(); vim.api.nvim_win_set_width(l.win.left,76); require('cland.state').changed()");
  await client.waitScreen(s=>s.includes('lead-2 [Lead]'), 'Lead role in panel');
  const panel = await client.lua<string>("return table.concat(vim.api.nvim_buf_get_lines(require('cland.panels').buf('items'),0,-1,false),'\\n')");
  assert.ok(panel.includes('lead-2 [Lead]'));
  await waitFor(() => client.lua<boolean>("local d=require('cland.item_view').detail['T-2']; return d ~= nil and not d.failed and type(d.body) == 'string'"), 'epic source detail before changing its fence');
  // Both source delimiters are accepted by the hub; the view must not restrict the excerpt to three backticks.
  await client.lua("local d=require('cland.item_view').detail['T-2']; d.body=...; require('cland.state').changed()", `## Plan\n\n\`\`\`\`yaml\n${source}\`\`\`\``);
  await client.lua("require('cland.plan').render('T-2')");
  await waitPlan(client, 'T-2', 'stages:');
  text = await planText(client, 'T-2');
  assert.ok(text.includes('presentation'));
});

test('mid-way plan preserves stage QA marks, outlines active lanes and dims planned stages', { skip }, async t => {
  const root = await tempProject(t);
  const plan: EpicPlan = { stages: [
    { name: 'landed schema', qa: { scope: 'affected', when: 'after-stage' }, lanes: [['T-3']] },
    { name: 'panels in work', qa: { scope: 'affected', when: 'after-stage' }, lanes: [['T-4']] },
    { name: 'future polish', qa: { scope: 'none', when: 'per-item' }, lanes: [['T-5']] },
  ] };
  const scenario = {
    tracker: { levels: ['release', 'epic'] },
    roles: [{ role: 'implementer', label: 'Implementer' }],
    processes: [{ name: 'impl-4', role: 'implementer', status: 'running', state: 'busy', holds: [{ item: 'T-4', role: 'item' }], usage: { total: { cost: 1.25 } } }],
    items: [
      { id: 'T-1', kind: 'release', title: 'Release', state: 'open' },
      { id: 'T-2', kind: 'epic', title: 'Midway', state: 'open', parent: 'T-1', plan, approval: { state: 'not required' }, stages: [
        { name: 'landed schema', state: 'closed', verdict: { verdict: 'qa', result: 'clear', run: 'qa-schema-2' } },
        { name: 'panels in work', state: 'open', verdict: { verdict: 'qa', result: 'not clear', run: 'qa-panels-1' } },
        { name: 'future polish', state: 'open' },
      ] },
      { id: 'T-3', kind: 'task', title: 'Schema', state: 'closed', status: 'done', parent: 'T-2', body: '## Acceptance criteria\n- [x] C1. Works\n  - verified: qa-2 [qa] · run qa-schema-2 · 2026-10-11T07:00Z' },
      { id: 'T-4', kind: 'task', title: 'Panels', state: 'open', status: 'in progress', parent: 'T-2', claim: { session: 'impl-4', role: 'implementer' } },
      { id: 'T-5', kind: 'task', title: 'Polish', state: 'open', status: 'planned', parent: 'T-2' },
    ],
  };
  const client = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, fileURLToPath(new URL('./stub-hub.ts', import.meta.url))]), CLAND_STUB_SCENARIO_JSON: JSON.stringify(scenario) });
  await client.waitScreen(s => s.includes('hub: connected'), 'connected');
  await client.rpc.request('nvim_ui_try_resize', 200, 65);
  await openPlan(client, 'T-2');
  await waitPlan(client, 'T-2', 'qa-schema-2');
  const text = await planText(client, 'T-2');
  for (const fact of ['S1 · landed schema · closed', 'S2 · panels in work · in work', 'S3 · future polish · planned', '1/1', 'qa-panels-1 · not clear', 'round 1', 'impl-4 [Implementer] · busy', 'stage 2 of 3', 'Cost so far: $1.25']) assert.ok(text.includes(fact), fact);
  const marks = await client.lua<Array<[number, number, number, { hl_group: string }]>>("return vim.api.nvim_buf_get_extmarks(require('cland.plan').bufs['T-2'],vim.api.nvim_get_namespaces()['cland.plan'],0,-1,{details=true})");
  const lines = text.split('\n');
  assert.ok(marks.some(m => lines[m[1]]?.includes('future polish') && m[3].hl_group === 'ClandDim'));
  assert.ok(marks.some(m => lines[m[1]]?.includes('panels in work') && m[3].hl_group === 'ClandTeal'));
});

test('a moved item keeps watch marks and its reason until the next plan visit, with a saved last-look receipt', { skip }, async t => {
  const { root, ui, client, epic, b, plan } = await setup(t);
  await client.input('gp');
  await waitPlan(client, epic.id, 'registry and sessions');
  await client.lua("local id=...; assert(vim.wait(5000,function() local v=require('cland.plan').visits[id]; return v and not v.acknowledge end,20))", epic.id);
  await client.input(`<Esc>:Cland view item ${epic.id}<CR>`);
  const changed = structuredClone(plan);
  changed.stages[0]!.lanes = changed.stages[0]!.lanes.filter(lane => !lane.includes(b.id));
  changed.stages[1]!.lanes.push([b.id]);
  assert.equal((await ui.request({ type: 'task.plan', item: epic.id, op: 'set', yaml: stringify(changed), reason: 'Keep panel work together' })).ok, true);
  await client.input('gp');
  await waitPlan(client, epic.id, 'Keep panel work together');
  let text = await planText(client, epic.id);
  assert.ok(text.includes(`${b.id} moved from S1 to S2`));
  assert.ok(text.includes('△ changed'));
  const watch = await client.lua<Array<[number, number, number, { hl_group: string }]>>("return vim.api.nvim_buf_get_extmarks(require('cland.plan').bufs[...],vim.api.nvim_get_namespaces()['cland.plan'],0,-1,{details=true})", epic.id);
  assert.ok(watch.some(m => m[3].hl_group === 'ClandPlanChange'));
  assert.equal(await client.lua("return vim.api.nvim_get_hl(0,{name='ClandPlanChange'}).fg"), 0xc2a15e);
  await client.input(`<Esc>:Cland view item ${epic.id}<CR>`);
  await waitFor(() => client.lua<boolean>("local view=require('cland.state').S.ui.view; return view.kind == 'item' and view.id == ...", epic.id), 'item before next plan visit');
  await client.input('gp');
  await waitPlan(client, epic.id, 'plan view');
  text = await planText(client, epic.id);
  assert.ok(!text.includes('△ changed'), 'next visit clears the attention marks');
  assert.ok(text.includes('Keep panel work together'), 'history keeps the reason after acknowledgement');
  await client.lua("require('cland.ui').flush()");
  const saved = JSON.parse(await readFile(join(root, '.cland/ui.json'), 'utf8'));
  assert.ok(saved.plan_seen[`T-${epic.id.split('-')[1]}`]);
  const reconnected = await startClient(t, bin, root);
  await reconnected.waitScreen(s => s.includes('hub: connected') && s.includes('Panels'), 'second client has the epic before navigation');
  await openPlan(reconnected, epic.id);
  await waitPlan(reconnected, epic.id, 'Keep panel work together');
  assert.ok(!(await planText(reconnected, epic.id)).includes('△ changed'), 'saved receipt survives a new workbench');
  await client.input('<Esc>:Cland view board<CR>');
  await client.lua("local l=require('cland.layout'); if not require('cland.state').S.ui.left then l.toggle_left() end; vim.api.nvim_win_set_width(l.win.left,76)");
  await client.lua("vim.api.nvim_set_current_win(require('cland.layout').win.left)");
  await client.input(`/^ ▸.*${epic.id}<CR>zo`);
  await client.waitScreen(s => s.includes(`${b.id} S2 ›`), 'stage tag on ordinary board');
});

test('done status without a merge receipt cannot close a stage in the view', { skip }, async t => {
  const { ui, client, epic, c } = await setup(t);
  assert.equal((await ui.request({ type: 'task.edit', item: c.id, status: 'done' })).ok, true);
  const shown = (await ui.request({ type: 'task.plan', item: epic.id, op: 'show' })).value as { stages: Array<{ state: string }> };
  assert.equal(shown.stages[1]?.state, 'open');
  await client.input('gp');
  await waitPlan(client, epic.id, 'S2 · plan view · planned');
  assert.ok(!(await planText(client, epic.id)).includes('S2 · plan view · closed'));
  await waitPlan(client, epic.id, 'QA runs: 2 to come');
  assert.ok((await planText(client, epic.id)).includes('0/1 merged'));
});

test('equal-time plan history keeps later moves after the saved receipt', { skip }, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/ui.json'), JSON.stringify({ version: 2, panels: { left: false, right: null, dock: false }, sizes: {}, items_filter: 'board', current_release: null, plan_seen: { 'T-2': 'b' } }));
  const before: EpicPlan = { stages: [
    { name: 'schema', qa: { scope: 'none', when: 'per-item' }, lanes: [['T-3']] },
    { name: 'panels', qa: { scope: 'none', when: 'per-item' }, lanes: [['T-4']] },
  ] };
  const after: EpicPlan = structuredClone(before);
  after.stages[0]!.lanes = [['T-4']]; after.stages[1]!.lanes = [['T-3']];
  const ts = '2026-10-11T07:00:00.000Z';
  const history = [
    { id: 'a', ts, event: 'changed', by: 'lead-1', previous: null, plan: before },
    { id: 'b', ts, event: 'approved', by: 'human' },
    { id: 'c', ts, event: 'changed', by: 'lead-1', previous: before, plan: after, reason: 'Move for panel integration' },
    { id: 'd', ts, event: 'approved', by: 'human' },
  ];
  const scenario = { tracker: { levels: ['release', 'epic'] }, items: [
    { id: 'T-1', kind: 'release', state: 'open', title: 'Release' },
    { id: 'T-2', kind: 'epic', state: 'open', parent: 'T-1', title: 'Tied times', plan: after, planHistory: history },
    { id: 'T-3', kind: 'task', state: 'open', parent: 'T-2', status: 'planned', title: 'Schema' },
    { id: 'T-4', kind: 'task', state: 'open', parent: 'T-2', status: 'planned', title: 'Panels' },
  ] };
  const client = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, fileURLToPath(new URL('./stub-hub.ts', import.meta.url))]), CLAND_STUB_SCENARIO_JSON: JSON.stringify(scenario) });
  await client.waitScreen(s => s.includes('hub: connected'), 'connected');
  await openPlan(client, 'T-2');
  await waitPlan(client, 'T-2', 'T-3 moved from S1 to S2');
  assert.ok((await planText(client, 'T-2')).includes('Move for panel integration'));
});

test(':restart of a plan with unseen changes records its restored visit', { skip }, async t => {
  const { root, ui, client, epic, b, plan } = await setup(t);
  await client.input('gp');
  await waitPlan(client, epic.id, 'registry and sessions');
  await client.lua("local id=...; assert(vim.wait(5000,function() local v=require('cland.plan').visits[id]; return v and not v.acknowledge end,20))", epic.id);
  const originalReceipt = await client.lua<string>("local s=require('cland.state'); return s.S.ui.plan_seen['T-'..s.item_number(...)]", epic.id);
  const changed = structuredClone(plan);
  changed.stages[0]!.lanes = changed.stages[0]!.lanes.filter(lane => !lane.includes(b.id));
  changed.stages[1]!.lanes.push([b.id]);
  assert.equal((await ui.request({ type: 'task.plan', item: epic.id, op: 'set', yaml: stringify(changed), reason: 'New changes while the view is open' })).ok, true);
  await waitPlan(client, epic.id, 'New changes while the view is open');
  assert.equal(await client.lua<string>("local s=require('cland.state'); return s.S.ui.plan_seen['T-'..s.item_number(...)]", epic.id), originalReceipt);
  const moved = client.restarted();
  await client.input('<Esc>:restart<CR>');
  await moved;
  await waitPlan(client, epic.id, 'New changes while the view is open');
  assert.ok((await planText(client, epic.id)).includes('△ changed'), 'the restored visit displays outstanding marks');
  await client.lua("require('cland.ui').flush()");
  const saved = JSON.parse(await readFile(join(root, '.cland/ui.json'), 'utf8'));
  const shown = (await ui.request({ type: 'task.plan', item: epic.id, op: 'show' })).value as { history: Array<{ id: string }> };
  assert.equal(saved.plan_seen[`T-${epic.id.split('-')[1]}`], shown.history.at(-1)?.id, 'restored view records the new last look');
  await client.input(`<Esc>:Cland view item ${epic.id}<CR>gp`);
  await waitPlan(client, epic.id, 'plan view');
  assert.ok(!(await planText(client, epic.id)).includes('△ changed'), 'reopening does not repeat already-seen marks');
});

test('future per-item QA excludes only evidence accepted by the hub gate', { skip }, async t => {
  const root = await tempProject(t);
  const plan: EpicPlan = { stages: [{ name: 'panels', qa: { scope: 'full', when: 'per-item' }, lanes: [['T-3', 'T-4', 'T-5', 'T-6', 'T-7', 'T-8', 'T-9', 'T-10', 'T-11']] }] };
  const scenario = { tracker: { levels: ['release', 'epic'] }, items: [
    { id: 'T-1', kind: 'release', state: 'open', title: 'Release' },
    { id: 'T-2', kind: 'epic', state: 'open', parent: 'T-1', title: 'QA remaining', plan, stages: [{ name: 'panels', state: 'open' }] },
    { id: 'T-3', kind: 'task', state: 'open', parent: 'T-2', status: 'ready', title: 'Current clear', qaSatisfied: true, verdicts: [{ verdict: 'qa', result: 'clear', current: true, run: 'qa-current' }] },
    { id: 'T-4', kind: 'task', state: 'open', parent: 'T-2', status: 'review', title: 'Stale clear', verdicts: [{ verdict: 'qa', result: 'clear', current: false, run: 'qa-stale' }] },
    { id: 'T-5', kind: 'task', state: 'open', parent: 'T-2', status: 'review', title: 'Freshness unknown', verdicts: [{ verdict: 'qa', result: 'clear', run: 'qa-unknown' }] },
    { id: 'T-6', kind: 'task', state: 'open', parent: 'T-2', status: 'in progress', title: 'Latest failed', verdicts: [{ verdict: 'qa', result: 'clear', current: true, run: 'qa-earlier' }, { verdict: 'qa', result: 'not clear', current: true, run: 'qa-failed' }] },
    { id: 'T-7', kind: 'task', state: 'open', parent: 'T-2', status: 'review', title: 'File-only clear', qaSatisfied: false, verdicts: [{ verdict: 'qa', result: 'clear', current: true, source: 'file', run: 'forged' }] },
    { id: 'T-8', kind: 'task', state: 'open', parent: 'T-2', status: 'ready', title: 'Accepted hub QA before file failure', qaSatisfied: true, verdicts: [{ verdict: 'qa', result: 'clear', source: 'hub', run: 'accepted' }, { verdict: 'qa', result: 'not clear', source: 'file', run: 'later-file' }] },
    { id: 'T-9', kind: 'task', state: 'open', parent: 'T-2', status: 'review', title: 'Human-shell hub clear', qaSatisfied: false, verdicts: [{ verdict: 'qa', result: 'clear', current: true, source: 'hub', writer: { sessionId: 'human', role: 'qa' }, run: 'human-qa' }] },
    { id: 'T-10', kind: 'task', state: 'open', parent: 'T-2', status: 'done', title: 'Manual done, no landing', merged: false, qaSatisfied: false },
    { id: 'T-11', kind: 'task', state: 'closed', parent: 'T-2', status: 'done', title: 'Merged task, branch removed', merged: true, qaSatisfied: false },
  ] };
  const client = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, fileURLToPath(new URL('./stub-hub.ts', import.meta.url))]), CLAND_STUB_SCENARIO_JSON: JSON.stringify(scenario) });
  await client.waitScreen(s => s.includes('hub: connected'), 'connected');
  await openPlan(client, 'T-2');
  await waitPlan(client, 'T-2', 'QA runs: 6 to come');
  assert.ok((await planText(client, 'T-2')).includes('QA runs: 9 so far'));
  assert.ok((await planText(client, 'T-2')).includes('1/9 merged'));
});
