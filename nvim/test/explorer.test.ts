// Explorer behavior across the hub frame boundary and the headless screen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { connectUi, startDaemon, tempProject } from '../../hub/test/harness.ts';
import { nvimOrSkip, startClient } from './harness.ts';
import { waitInitialSnapshots } from './readiness.ts';
const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';

test('Space e and the explorer command open a release tree on real hub summaries', { skip }, async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const create = async (kind: string, title: string, parent?: string) => {
    const result = await ui.request({ type:'task.create', kind, title, parent, ...(kind === 'task' ? { size:'S' } : {}) });
    assert.equal(result.ok, true, result.error);
    return (result.value as {item:{id:string}}).item.id;
  };
  const release = await create('release', 'Working with items');
  const epic = await create('epic', 'The explorer', release);
  await create('task', 'Draw the tree', epic);
  const c = await startClient(t, bin, root);
  await c.rpc.request('nvim_ui_try_resize', 200, 50);
  await waitInitialSnapshots(c);
  await c.input('<Esc><Space>e');
  await c.waitScreen(s => s.includes('EXPLORER') && s.includes('The explorer') && s.includes('Categories (0)'), 'release explorer');
  assert.equal(await c.lua("return vim.b.cland_role"), 'explorer');
  await c.input(`:Cland explorer T-${epic.split('-')[1]}<CR>`);
  await c.waitScreen(s => s.includes('Draw the tree'), 'epic scoped using any prefix');
  assert.equal(await c.lua("return require('cland.state').S.ui.view.id"), epic);
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"), []);
  await c.input('<Space>?');
  await c.waitScreen(s => s.includes('Open explorer') && s.includes('␣e'), 'explorer key in registry help');
});

import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';
import type { Scenario } from './stub-hub.ts';
import type { Client } from './harness.ts';
const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));
const stages = [
  {name:'the tree', state:'open', qa:{scope:'none',when:'after-stage'},items:['T-10','T-11','T-12','T-13','T-14','T-15','T-16','T-18','T-19','T-20']},
  {name:'the card', state:'open', qa:{scope:'affected',when:'after-stage'},items:['T-17']},
];
const fixture: Scenario = { items: [
  {id:'R-1',kind:'release',title:'Working with items',version:'0.1.2',state:'open'},
  {id:'E-2',kind:'epic',title:'Second epic',parent:'R-1',rank:20,state:'open'},
  {id:'E-3',kind:'epic',title:'First epic',parent:'R-1',rank:10,state:'open',plan:{stages:stages.map(s => ({name:s.name,qa:s.qa,lanes:[s.items]}))},stages},
  {id:'E-4',kind:'epic',title:'Closed epic',parent:'R-1',rank:0,state:'closed',closed:'2025-12-01T10:00:00Z'},
  {id:'C-5',kind:'category',title:'Ideas',state:'open'},
  {id:'T-6',kind:'task',title:'Unscheduled task',status:'backlog',state:'open'},
  {id:'T-7',kind:'task',title:'Direct task',parent:'R-1',status:'planned',state:'open'},
  {id:'R-8',kind:'release',title:'Future release',version:'0.2.0',state:'open'},
  ...['in progress','review','qa','ready','planned','backlog','done','planned'].map((status,i) => ({
    id:`T-${10+i}`,kind:'task',title:`Task ${status}`,parent:'E-3',status,rank:i,state:status === 'done' ? 'closed' : 'open',
    closed:status === 'done' ? '2025-12-03T10:00:00Z' : undefined,
    claim:i===0||i===1 ? {session:'impl-10',role:'implementer'} : undefined,
    holds:i===1 ? [{session:'rev-11',role:'reviewer'}] : undefined,
    verdicts:i===0 ? [{verdict:'review',result:'clear'},{verdict:'review',result:'not clear'},{verdict:'qa',result:'clear'}] : [],
    criteria:{verified:2,total:3},
  })),
  {id:'T-18',kind:'task',title:'Legacy done',parent:'E-3',status:'done',state:'closed',updated:'2026-01-01T00:00:00Z'},
  {id:'T-19',kind:'task',title:'Earlier done',parent:'E-3',status:'done',state:'closed',closed:'2025-12-02T10:00:00Z',updated:'2026-10-13T00:00:00Z'},
  {id:'T-20',kind:'task',title:'Later done',parent:'E-3',status:'done',state:'closed',closed:'2025-12-04T10:00:00Z',updated:'2024-10-13T00:00:00Z'},
  {id:'T-21',kind:'task',title:'Blocked task',parent:'E-3',status:'planned',state:'open',blocked_by:['T-6']},
  {id:'T-22',kind:'task',title:'Planned epic task',parent:'E-2',status:'planned',state:'open'},
], processes:[{name:'coord',role:'coordinator',state:'idle',status:'running'}] };

async function stub(t: test.TestContext, scenario = fixture) {
  const root = await tempProject(t);
  const controlPath = `${root}/stub.sock`;
  const c = await startClient(t,bin,root,{CLAND_HUB_TRANSPORT:'stdio',CLAND_COMMAND:JSON.stringify([process.execPath,STUB]),CLAND_STUB_SCENARIO_JSON:JSON.stringify(scenario),CLAND_STUB_CONTROL:controlPath});
  await c.rpc.request('nvim_ui_try_resize',200,50);
  if (scenario.holdSnapshots?.includes('task.list')) await c.waitScreen(s=>s.includes('hub: connected'),'connected with held item snapshot');
  else await waitInitialSnapshots(c);
  const control = (command:Record<string,unknown>) => new Promise<{requests:Array<{type:string;item?:string}>}>((resolve,reject) => {
    const socket = createConnection(controlPath); let data='';
    socket.setEncoding('utf8'); socket.on('error',reject);
    socket.on('data',chunk => { data+=chunk; if(data.includes('\n')) { socket.end(); resolve(JSON.parse(data)); } });
    socket.write(JSON.stringify(command)+'\n');
  });
  return {c,control};
}
async function text(c: Client) {
  return c.lua<string>("return table.concat(vim.api.nvim_buf_get_lines(require('cland.explorer').b,0,-1,false),'\\n')");
}
async function select(c:Client, key:string) {
  await c.lua("local key=...; local e=require('cland.explorer'); for r,row in ipairs(e.rows) do if row.key==key then vim.api.nvim_win_set_cursor(e.tree_win(),{r,0}); return end end; error('missing row '..key)",key);
}
async function highlights(c:Client, id:string) {
  return c.lua<string[]>(`local id=...; local e=require('cland.explorer'); local row; for r,info in ipairs(e.rows) do if info.key==id then row=r-1 end end; local groups={}; for _,m in ipairs(vim.api.nvim_buf_get_extmarks(e.b,vim.api.nvim_create_namespace('cland.explorer'),{row,0},{row,-1},{details=true})) do groups[#groups+1]=m[4].hl_group end; return groups`,id);
}

test('release rows, derived glyphs, rank then close order, folded roots and za cursor identity', {skip}, async t => {
  const {c,control}=await stub(t);
  await c.input('<Esc><Space>e');
  await c.waitScreen(s=>s.includes('First epic')&&s.includes('S1')&&s.includes('Categories (1)'), 'release with cached stages');
  const shown=await text(c);
  for(const expected of ['◐ R-1 0.1.2 Working with items','tasks 4/14','◐ E-3 First epic','○ E-2 Second epic','● E-4 Closed epic','Direct tasks (1)','Unscheduled (1)','Other releases (1)','closed 2025-12-01','coord']) assert.ok(shown.includes(expected),expected);
  assert.ok(shown.indexOf('First epic')<shown.indexOf('Second epic')&&shown.indexOf('Second epic')<shown.indexOf('Closed epic'));
  assert.ok((await highlights(c,'E-4')).includes('ClandDone'));
  assert.ok((await highlights(c,'E-2')).includes('ClandText'));
  await select(c,'E-3'); await c.input('za');
  await c.waitScreen(s=>s.includes('S1 the tree')&&s.includes('Blocked task'), 'epic expanded');
  assert.equal(await c.lua("local e=require('cland.explorer'); return e.key_at(vim.api.nvim_win_get_cursor(e.tree_win())[1])"),'E-3');
  const tasks=await text(c);
  for(const expected of ['in work · 4 of 10 merged · review only','S2 the card  planned','not in the plan','✓ done  in the order they closed','rev-11','impl-10','✗ review r2','✓ qa','2/3','merged 2025-12-03','◌ T-21','blocked by T-6']) assert.ok(tasks.includes(expected),expected);
  assert.ok(tasks.indexOf('Legacy done')<tasks.indexOf('Earlier done')&&tasks.indexOf('Earlier done')<tasks.indexOf('Task done')&&tasks.indexOf('Task done')<tasks.indexOf('Later done'));
  const requests=(await control({requests:true})).requests;
  assert.equal(requests.filter(r=>r.type==='task.view').length,0,'tree never fetches item detail');
  assert.equal(requests.filter(r=>r.type==='task.plan'&&r.item==='E-3').length,1,'visible epic plan fetched once');
  const before=await c.lua("return require('cland.explorer').writes");
  await c.lua("local done=false; local s=require('cland.state'); s.on_change(function() done=true end); s.changed(); assert(vim.wait(1000,function() return done end))");
  assert.equal(await c.lua("return require('cland.explorer').writes"),before,'no buffer rewrite on unchanged redraw');
  for(const width of [120,80]) {
    await c.rpc.request('nvim_ui_try_resize',width,50);
    await c.lua(`assert(vim.wait(5000,function() local e=require('cland.explorer'); return e.window_width==vim.api.nvim_win_get_width(e.tree_win()) end)); local e=require('cland.explorer'); local w=e.tree_win(); assert(not vim.wo[w].wrap); for _,line in ipairs(vim.api.nvim_buf_get_lines(e.b,0,-1,false)) do assert(vim.api.nvim_strwidth(line)<vim.api.nvim_win_get_width(w)) end`);
    assert.ok(!(await text(c)).split('\n')[0]!.includes('lead'));
  }
  await c.rpc.request('nvim_ui_try_resize',200,50);
  await select(c,'E-3');
  await control({emit:{type:'task',id:'E-2',item:fixture.items!.find(it=>it.id==='E-2'),siblings:['E-2','E-3','E-4','T-7']}});
  await c.lua(`assert(vim.wait(5000,function() local e=require('cland.explorer'); local text=table.concat(e.lines,'\\n'); return text:find('Second epic',1,true)<text:find('First epic',1,true) end))`);
  assert.equal(await c.lua("local e=require('cland.explorer'); return e.key_at(vim.api.nvim_win_get_cursor(e.tree_win())[1])"),'E-3','rank frame keeps cursor identity');
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"),[]);
});

test('a release with no epics derives from direct tasks and the virtual roots unfold to plain rows', {skip}, async t => {
  const {c}=await stub(t,{items:[
    {id:'R-1',kind:'release',title:'Direct release',state:'open'},
    {id:'T-2',kind:'task',title:'Reviewing direct task',parent:'R-1',state:'open',status:'review'},
    {id:'C-3',kind:'category',title:'Ideas',state:'open'},
    {id:'T-4',kind:'task',title:'Unscheduled task',state:'open',status:'backlog'},
    {id:'Q-5',kind:'question',title:'Unscheduled question',state:'open'},
  ]});
  await c.input('<Esc><Space>e');
  await c.waitScreen(s=>s.includes('◐ R-1 Direct release')&&s.includes('Direct tasks (1)'), 'direct-only release');
  assert.ok(!(await text(c)).includes('Reviewing direct task'));
  await select(c,':direct:R-1'); await c.input('za');
  await c.waitScreen(s=>s.includes('Reviewing direct task'),'direct tasks unfolded');
  await select(c,':categories'); await c.input('za');
  await c.waitScreen(s=>s.includes('C-3 Ideas'),'open category rows');
  await select(c,':unscheduled'); await c.input('za');
  await c.waitScreen(s=>s.includes('T-4 Unscheduled task')&&s.includes('○ Q-5 Unscheduled question'),'unscheduled rows');
  await c.input('jk');
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"),[]);
});

test('an epic-only ladder shows no open release and lists its root epic as unscheduled', {skip}, async t => {
  const {c}=await stub(t,{items:[{id:'E-1',kind:'epic',title:'Root epic',state:'open'}],tracker:{levels:['epic']}});
  await c.input('<Esc><Space>e');
  await c.waitScreen(s=>s.includes('no open release')&&s.includes('Unscheduled (1)'), 'empty answered snapshot');
  assert.ok(!(await text(c)).includes('loading the items'));
});

test('loading is distinct from an answered empty list', {skip}, async t => {
  const {c,control}=await stub(t,{items:[],holdSnapshots:['task.list']});
  await control({waitSnapshot:'task.list'});
  await c.input('<Esc><Space>e');
  await c.waitScreen(s=>s.includes('loading the items…'),'unanswered item snapshot');
  await control({releaseSnapshots:['task.list']});
  await c.waitScreen(s=>s.includes('no open release')&&!s.includes('loading the items…'),'answered empty snapshot');
});

test('configured root kinds keep release rows, epics and direct tasks in the outline', {skip}, async t => {
  const {c}=await stub(t,{tracker:{levels:['initiative','epic']},items:[
    {id:'I-1',kind:'initiative',title:'Configured release',version:'0.3.0',state:'open'},
    {id:'E-2',kind:'epic',title:'Configured epic',parent:'I-1',state:'open'},
    {id:'T-3',kind:'task',title:'Epic task',parent:'E-2',state:'open',status:'planned'},
    {id:'T-4',kind:'task',title:'Direct task',parent:'I-1',state:'open',status:'review'},
    {id:'I-5',kind:'initiative',title:'Future configured release',version:'0.4.0',state:'open'},
  ]});
  await c.input('<Esc><Space>e');
  await c.waitScreen(s=>s.includes('○ I-1 0.3.0 Configured release')&&s.includes('E-2 Configured epic')&&s.includes('Direct tasks (1)')&&s.includes('Other releases (1)'),'configured root outline');
  assert.ok((await text(c)).includes('tasks 0/2'));
  assert.ok(!(await text(c)).includes('no open release'));
  await select(c,':direct:I-1'); await c.input('za');
  await c.waitScreen(s=>s.includes('T-4 Direct task'),'configured direct task');
});

test('the root winbar counts done nodes only under its named release', {skip}, async t => {
  const {c}=await stub(t,{items:[
    {id:'R-1',kind:'release',title:'Current release',version:'0.1.0',state:'open'},
    {id:'T-2',kind:'task',title:'Release done',parent:'R-1',status:'done',state:'closed',closed:'2025-12-01T00:00:00Z'},
    {id:'C-3',kind:'category',title:'Ideas',state:'open'},
    {id:'T-4',kind:'task',title:'Category done',parent:'C-3',status:'done',state:'closed',closed:'2025-12-01T00:00:00Z'},
    {id:'R-5',kind:'release',title:'Future release',version:'0.2.0',state:'open'},
    {id:'T-6',kind:'task',title:'Future done',parent:'R-5',status:'done',state:'closed',closed:'2025-12-01T00:00:00Z'},
  ]});
  await c.input('<Esc><Space>e');
  await c.waitScreen(s=>s.includes('EXPLORER R-1')&&s.includes('● 1 done'),'release-only done count');
  await c.input(':Cland explorer C-3<CR>');
  await c.waitScreen(s=>s.includes('EXPLORER C-3')&&s.includes('● 1 done'),'scoped category count');
});
