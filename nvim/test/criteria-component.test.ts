// T2: screen permutations consume committed protocol frames through stub-client.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nvimOrSkip, startClient, type Client } from './stub-client.ts';
import { waitInitialSnapshots } from './readiness.ts';
import { tempProject } from './fixture.ts';

const nvim = await nvimOrSkip();

const skip = 'skip' in nvim ? nvim.skip : false;

const bin = 'bin' in nvim ? nvim.bin : '';

const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));

const AT = '2026-10-10T10:00Z';

async function buffer(c: Client, module = 'item_view') {
  return c.lua<string[]>(`local m=require('cland.'..(...)); local b=...=='item_view' and m.bufs['T-2'] or m.b; return vim.api.nvim_buf_get_lines(b,0,-1,false)`, module);
}

async function widths(c: Client, module: string) {
  return c.lua<{ width: number; widths: number[] }>(`local name=...; local m=require('cland.'..name); local b=name=='item_view' and m.bufs['T-2'] or name=='panels' and m.buf('items') or m.b; local w=vim.fn.bufwinid(b); local lines=vim.api.nvim_buf_get_lines(b,0,-1,false); local widths={}; for _,line in ipairs(lines) do widths[#widths+1]=vim.api.nvim_strwidth(line) end; for _,mark in ipairs(vim.api.nvim_buf_get_extmarks(b,-1,0,-1,{details=true})) do if mark[4].end_col then assert(mark[4].end_col<=#lines[mark[2]+1]) end end; return {width=vim.api.nvim_win_get_width(w),widths=widths}`, module);
}

test('hub marks drive item glyphs, authors and notes; legacy checked boxes stay open at 80 and 120 columns', { skip }, async t => {
  const root = await tempProject(t);
  const marks = [
    { id: 'C1', text: 'Open legacy', checked: true, marks: [] },
    { id: 'C2', text: 'Done criterion', marks: [{kind:'done',by:'impl-2',at:AT}] },
    { id: 'C3', text: 'Verified criterion', marks: [{kind:'done',by:'impl-2',at:AT},{kind:'verified',by:'rev-2 [reviewer]',at:AT,run:'r-2'}] },
    { id: 'C4', text: 'Failed criterion', marks: [{kind:'failed',by:'qa-2 [qa]',at:AT,note:'Reconnect loses the clause.'}] },
  ];
  const c = await startClient(t, bin, root, {CLAND_HUB_TRANSPORT:'stdio',CLAND_COMMAND:JSON.stringify([process.execPath,STUB]),CLAND_STUB_SCENARIO_JSON:JSON.stringify({items:[{id:'T-2',kind:'task',title:'Criteria display',state:'open',status:'in progress',file:'T-2.md',body:'## Acceptance criteria\n- [x] Source checkbox must be replaced\n## Notes\nNotes survive.',criteria:marks}]})});
  await c.waitScreen(s=>s.includes('hub: connected'),'connected');
  await waitInitialSnapshots(c);
  await c.input('<Esc>:Cland view item T-2<CR>');
  await c.waitScreen(s=>s.includes('Open legacy'),'criteria');
  for (const width of [80,120]) {
    await c.rpc.request('nvim_ui_try_resize',width,45);
    await c.waitScreen(s=>s.includes('Reconnect loses the clause.'),'failure note after resize');
    const text=(await buffer(c)).join('\n');
    for(const expected of ['○ C1. Open legacy','◐ C2. Done criterion','● C3. Verified criterion','✗ C4. Failed criterion','done: impl-2','verified: rev-2 [Reviewer]','run r-2','failed: qa-2 [QA]','Reconnect loses the clause.','Notes survive.']) assert.ok(text.includes(expected),expected);
    assert.ok(!text.includes('Source checkbox'));
    const budget=await widths(c,'item_view'); assert.ok(budget.widths.every(w=>w<=budget.width),`item fits ${width}: ${JSON.stringify(budget)}`);
  }
});

test('wide and combining criteria text and marks fit 80/120 layouts; repeated headings render the list once', { skip }, async t => {
  const root = await tempProject(t);
  const wide = '界'.repeat(100);
  const combining = 'e\u0301'.repeat(160);
  const c = await startClient(t, bin, root, {
    CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]),
    CLAND_STUB_SCENARIO_JSON: JSON.stringify({items:[{
      id:'T-2', kind:'task', title:'Unicode criteria', state:'open', status:'in progress', file:'T-2.md',
      body:'## Acceptance criteria\n- [ ] C1. First\n## Notes\nKeep these notes.\n## Acceptance criteria\n- [ ] C2. Second',
      criteria:[
        {id:'C1',text:wide,marks:[{kind:'failed',by:'qa-2 [qa]',at:AT,note:wide + combining}]},
        {id:'C2',text:combining,marks:[]},
      ],
    }]})
  });
  await c.waitScreen(s=>s.includes('hub: connected'),'connected');
  await waitInitialSnapshots(c);
  await c.lua("local l=require('cland.layout'); l.preset('steady'); l.right_panel('inbox')");
  await c.input('<Esc>:Cland view item T-2<CR>');
  await c.waitScreen(s=>s.includes('✗ C1.'),'Unicode criterion rendered');
  for (const width of [80,120]) {
    await c.rpc.request('nvim_ui_try_resize',width,45);
    await c.waitScreen(s=>s.includes('✗ C1.'),'Unicode after resize');
    const budget=await widths(c,'item_view');
    assert.equal(budget.width,width,'full-width item composes at 79/119 cells');
    assert.ok(budget.widths.every(w=>w<=budget.width),`Unicode rows fit ${width}: ${JSON.stringify(budget)}`);
    const rendered=(await buffer(c)).join('\n');
    assert.equal((rendered.match(/C1\. /g) ?? []).length,1);
    assert.equal((rendered.match(/C2\. /g) ?? []).length,1);
    assert.equal((rendered.match(/ACCEPTANCE CRITERIA/g) ?? []).length,1);
    assert.ok(rendered.includes('Keep these notes.'));
    // All codepoints, including combining marks, survive the split.
    assert.equal((rendered.match(/界/g) ?? []).length,200);
    assert.equal((rendered.match(/\u0301/g) ?? []).length,320);
    const targets = await c.lua<number>(`local m=require('cland.item_view'); local n=0; for row,ref in pairs(m.criterion_rows['T-2']) do local line=vim.api.nvim_buf_get_lines(m.bufs['T-2'],row-1,row,false)[1]; if line:find('界',1,true) then assert(ref.id=='C1'); n=n+1 end end; return n`);
    assert.ok(targets>2,'wrapped criterion text and mark continuations retain their target');
  }
});

test('verdict thread shows structured verified and failed criteria, including notes and clear report marks', { skip }, async t => {
  const root=await tempProject(t);
  const report=(id:string,text:string,criteria?:unknown[])=>({id,from:'hub',fromKind:'hub',kind:'report',detail:{item:'T-2',session:'rev-2',verdict:'review',result:id==='v2'?'not clear':'clear',run:'r-2'},to:[],topic:'general',ts:AT,text,criteria});
  const c=await startClient(t,bin,root,{CLAND_HUB_TRANSPORT:'stdio',CLAND_COMMAND:JSON.stringify([process.execPath,STUB]),CLAND_STUB_SCENARIO_JSON:JSON.stringify({messages:{general:[report('v1','T-2 review clear · rev-2 [reviewer] · run r-2',[{id:'C1',mark:'verified'}]),report('v2','T-2 review not clear · rev-2 [reviewer] · run r-2',[{id:'C2',mark:'failed',note:'The criterion lost its marks.'},{id:'C3',mark:'verified'}]),report('v3','qa clear T-2\nC99 verified')]}})});
  await c.waitScreen(s=>s.includes('C2 failed'),'marked verdict');
  for(const width of [80,120]) {
    await c.rpc.request('nvim_ui_try_resize',width,45);
    await c.lua("require('cland.layout').preset('charting'); if require('cland.state').S.ui.left then require('cland.layout').toggle_left() end");
    await c.waitScreen(s=>s.includes('● C1 verified') && s.includes('✗ C2 failed') && s.includes('C2: The criterion lost its marks.'),'structured marks at resized grid');
    assert.ok(!(await c.screen()).join('\n').includes('C99'),'unstructured report text is not parsed');
  }
});
