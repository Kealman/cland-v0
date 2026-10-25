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
import { startShell, requestsOf, waitHeldSnapshot } from './shell-fixture.ts';

for (const action of ['gp', ':Cland view plan T-12<CR>']) {
  for (const outcome of ['epic', 'unparented', 'missing']) {
    const inEpic = outcome === 'epic';
    for (const last of ['hub.status', 'task.list']) {
      test(`early ${action}: ${inEpic ? 'opens the epic plan' : `reports ${outcome}`} after ${last} arrives last`, { skip }, async t => {
        const c = await startShell(t, s => {
          s.holdSnapshots = ['hub.status', 'task.list'];
          s.tracker = { levels: ['release', 'epic'] };
          if (outcome === 'missing') s.items = s.items!.filter(it => it.id !== 'T-12');
          if (inEpic) {
            s.items![0]!.parent = 'T-2';
            s.items!.push({ id: 'T-1', kind: 'release', state: 'open', title: 'Release' },
              { id: 'T-2', kind: 'epic', parent: 'T-1', state: 'open', title: 'Panels' });
          }
        }, {}, false);
        for (const type of ['hub.status', 'task.list']) await waitHeldSnapshot(c, type);
        // An explicit card supplies gp's subject even while its index is held.
        await c.input('<Esc>:Cland view item T-12<CR>');
        await c.waitScreen(s => s.includes('T-12: no such item in the tracker'), 'selected card before snapshots');
        await c.input(action);
        const first = last === 'hub.status' ? 'task.list' : 'hub.status';
        await c.control({ releaseSnapshots: [first] });
        await c.lua("require('cland').client:request({type='rule.list'},function() vim.g.plan_barrier=true end); assert(vim.wait(5000,function() return vim.g.plan_barrier end))");
        assert.equal(await c.lua("return require('cland.state').S.ui.view.kind"), 'item', 'one snapshot cannot resolve the plan');
        assert.doesNotMatch(await c.lua<string>("return (require('cland.state').S.flash or {}).text or ''"), /select an epic|not an epic/, 'no premature refusal');
        await c.control({ releaseSnapshots: [last] });
        if (inEpic) {
          await c.waitScreen(s => s.includes('Plan of T-2 Panels'), 'deferred plan opens');
          assert.equal(await c.lua("return require('cland.state').S.ui.view.id"), 'T-2');
          assert.equal((await requestsOf(c, 'task.plan')).length, 1, 'one navigation fetches one plan');
        } else {
          await c.waitScreen(s => s.includes('T-12') && s.includes(outcome === 'missing' ? 'not in the tracker' : 'not an epic or in one'), 'settled no-epic notice');
          assert.equal(await c.lua("return require('cland.state').S.ui.view.kind"), 'item');
          assert.equal((await requestsOf(c, 'task.plan')).length, 0);
        }
      });
    }
  }
}

for (const next of ['another plan', 'another view', 'away and back', 'snapshot failure']) {
  test(`deferred plan navigation respects ${next}`, { skip }, async t => {
    const c = await startShell(t, s => { s.holdSnapshots = ['hub.status', 'task.list']; }, {}, false);
    for (const type of ['hub.status', 'task.list']) await waitHeldSnapshot(c, type);
    await c.input('<Esc>:Cland view plan T-404<CR>');
    if (next === 'another plan') await c.input(':Cland view plan T-12<CR>');
    if (next === 'another view' || next === 'away and back') {
      await c.input(':Cland view inbox<CR>');
      await c.waitScreen(s => s.includes('Inbox · full width'), 'newer navigation before release');
      if (next === 'away and back') {
        await c.input('<Space><Space>');
        await c.waitScreen(s => s.includes('Starting T-12') && !s.includes('Inbox · full width'), 'returned to original view before release');
      }
    }
    await c.control({ releaseSnapshots: ['task.list'], ...(next === 'snapshot failure' ? { snapshotError: 'held item snapshot failed' } : {}) });
    await c.control({ releaseSnapshots: ['hub.status'] });
    // A receipt after both callbacks makes the unchanged-view assertion meaningful.
    await c.lua("require('cland').client:request({type='rule.list'},function() vim.g.plan_barrier=true end); assert(vim.wait(5000,function() return vim.g.plan_barrier end))");
    if (next === 'another view' || next === 'away and back') {
      assert.equal(await c.lua("return require('cland.state').S.ui.view.kind"), next === 'another view' ? 'inbox' : 'thread');
      assert.doesNotMatch(await c.lua<string>("return (require('cland.state').S.flash or {}).text or ''"), /plan:/);
    } else {
      const notice = await c.lua<string>("return (require('cland.state').S.flash or {}).text or ''");
      assert.equal(notice, next === 'another plan' ? 'plan: T-12 is not an epic or in one' : 'plan: items: held item snapshot failed');
    }
    assert.equal((await requestsOf(c, 'task.plan')).length, 0);
  });
}

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
  await waitFor(() => client.lua<boolean>("return require('cland.marks').plan('T-2') == 'd'"), 'shared equal-time plan receipt acknowledged');
  assert.equal(await client.lua("return require('cland.marks').plan('T-2')"), 'd');
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
