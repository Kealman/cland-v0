// T2: screen permutations consume committed protocol frames through stub-client.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';
import type { EpicPlan } from '../../hub/src/tracker/plan.ts';
import { startClient } from './stub-client.ts';
import { planText, waitFor, openPlan, waitPlan, bin, skip } from './plan-view-support.ts';
import { tempProject } from './fixture.ts';

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
