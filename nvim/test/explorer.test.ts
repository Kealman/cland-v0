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

import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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

async function stub(t: test.TestContext, scenario = fixture, projectRoot?: string, centre: 'general' | 'explorer' = 'explorer') {
  const root = projectRoot ?? await tempProject(t);
  const controlPath = `${root}/stub.sock`;
  const c = await startClient(t,bin,root,{CLAND_HUB_TRANSPORT:'stdio',CLAND_COMMAND:JSON.stringify([process.execPath,STUB]),CLAND_STUB_SCENARIO_JSON:JSON.stringify(scenario),CLAND_STUB_CONTROL:controlPath},{centre});
  await c.rpc.request('nvim_ui_try_resize',200,50);
  if (scenario.holdSnapshots?.includes('task.list')) await c.waitScreen(s=>s.includes('hub: connected'),'connected with held item snapshot');
  else await waitInitialSnapshots(c);
  const control = (command:Record<string,unknown>) => new Promise<{requests:Array<{type:string;item?:string}>}>((resolve,reject) => {
    const socket = createConnection(controlPath); let data='';
    socket.setEncoding('utf8'); socket.on('error',reject);
    socket.on('data',chunk => { data+=chunk; if(data.includes('\n')) { socket.end(); resolve(JSON.parse(data)); } });
    socket.write(JSON.stringify(command)+'\n');
  });
  return {c,control,root};
}
async function text(c: Client) {
  return c.lua<string>("return table.concat(vim.api.nvim_buf_get_lines(require('cland.explorer').b,0,-1,false),'\\n')");
}
async function select(c:Client, key:string) {
  await c.lua("local key=...; local e=require('cland.explorer'); for r,row in ipairs(e.rows) do if row.key==key then vim.api.nvim_win_set_cursor(e.tree_win(),{r,0}); return end end; error('missing row '..key)",key);
}
async function cursor(c:Client) {
  return c.lua<string>("local e=require('cland.explorer'); return e.key_at(vim.api.nvim_win_get_cursor(e.tree_win())[1])");
}
async function at(c:Client, key:string) {
  await c.lua("local key=...; assert(vim.wait(5000,function() local e=require('cland.explorer'); return e.key_at(vim.api.nvim_win_get_cursor(e.tree_win())[1])==key end),'cursor '..key)",key);
}

test('outline keys skip detail and stage labels, respect counts and fold the leaf parent', {skip}, async t => {
  const {c}=await stub(t);
  await c.input('<Esc><Space>e');
  await c.waitScreen(s=>s.includes('First epic'),'release tree');
  await select(c,'R-1'); await c.input('j'); await at(c,'E-3');
  await c.input('3j'); await at(c,':direct:R-1');
  await c.input('3k'); await at(c,'E-3');
  await c.input('l'); await c.waitScreen(s=>s.includes('S1 the tree'),'epic unfolded');
  assert.equal(await cursor(c),'E-3');
  await c.input('l'); await at(c,'T-10');
  await c.input('6j'); await at(c,'T-17');
  await c.input('k'); await at(c,'T-15');
  await c.input('h'); await at(c,'E-3');
  await c.waitScreen(s=>!s.includes('Task in progress'),'parent folded');
  await c.input('l');
  await c.waitScreen(s=>s.includes('Task in progress'),'parent unfolded again');
  await c.input('lzo'); await at(c,'T-10');
  await c.input('zc'); await at(c,'E-3');
  await c.waitScreen(s=>!s.includes('Task in progress'),'zc on leaf folds parent');
  await c.input('l'); await c.waitScreen(s=>s.includes('Task in progress'),'za parent reopened');
  await c.input('l'); await at(c,'T-10');
  await c.input('za'); await at(c,'E-3');
  await c.waitScreen(s=>!s.includes('Task in progress'),'za on leaf folds parent');
  await c.input('zR'); await c.waitScreen(s=>s.includes('Task in progress')&&s.includes('○ T-6 Unscheduled task')&&s.includes('Direct task'),'all unfolded');
  await select(c,'T-10'); await c.input('zM'); await at(c,'E-3');
  await c.waitScreen(s=>!s.includes('Task in progress')&&!s.includes('○ T-6 Unscheduled task')&&s.includes('Unscheduled task'),'all folded with root preview');
  await select(c,'R-1'); await c.input('hzcza');
  await c.waitScreen(s=>s.includes('First epic'),'root stays unfolded');
  assert.ok((await text(c)).includes('First epic'),'root stays open');
});

test('scopes carry breadcrumbs and back restores the originating row and preceding centre view', {skip}, async t => {
  const {c}=await stub(t);
  await c.input('<Esc><Space>g<Esc><Space>e');
  await c.waitScreen(s=>s.includes('First epic'),'release tree');
  await select(c,'E-3'); await c.input('s');
  await c.waitScreen(s=>s.includes('R-1 0.1.2 Working with items › E-3 First epic')&&s.includes('Task in progress'),'epic scope breadcrumbs');
  await at(c,'E-3');
  await c.input('hzcza'); await c.waitScreen(s=>s.includes('Task in progress'),'scope root stays unfolded'); assert.ok((await text(c)).includes('Task in progress'),'scope root stays open');
  await c.input('<Space><Space>'); await at(c,'E-3');
  await c.waitScreen(s=>s.includes('Categories (1)'),'back to release tree');
  await c.input('l'); await c.waitScreen(s=>s.includes('Task in progress'),'expand epic');
  await select(c,'T-17'); await c.input('s'); await at(c,'T-17');
  await c.waitScreen(s=>s.includes('› E-3 First epic')&&!s.includes('Categories (1)'),'leaf scopes to its epic');
  await c.input('<Space><Space>'); await at(c,'T-17');
  await select(c,':direct:R-1'); await c.input('s');
  await c.waitScreen(s=>s.includes('R-1 0.1.2 Working with items › Direct tasks')&&s.includes('T-7 Direct task'),'virtual scope breadcrumbs');
  await c.input('<Space><Space>'); await at(c,':direct:R-1');
  await select(c,':unscheduled'); await c.input('s');
  await c.waitScreen(s=>s.includes('EXPLORER Unscheduled')&&s.includes('Unscheduled task'),'virtual root scope');
  await c.input('<Space><Space>'); await at(c,':unscheduled');
  await c.input('<Space><Space>');
  await c.waitScreen(s=>s.includes('General ·')&&!s.includes('EXPLORER'),'root back to previous centre');
});

test('D hides done items across the tree and A exposes archived roots with scope-only counts', {skip}, async t => {
  const {c}=await stub(t,{...fixture,items:[...fixture.items!,
    {id:'R-30',kind:'release',title:'Archived release',state:'closed',version:'0.0.1',rank:0},
    {id:'T-31',kind:'task',title:'Archived unscheduled task',state:'closed',status:'done'},
    {id:'T-32',kind:'task',title:'Category done task',parent:'C-5',state:'closed',status:'done'},
  ]});
  await c.input('<Esc><Space>e');
  await c.waitScreen(s=>s.includes('done shown · 5 · D'),'folded descendants counted in release');
  await c.input('zR'); await c.waitScreen(s=>s.includes('Category done task'),'all roots unfolded');
  await select(c,'T-16'); await c.input('D'); await at(c,'E-3');
  await c.waitScreen(s=>s.includes('done hidden · 5 · D')&&!s.includes('Closed epic')&&!s.includes('Category done task')&&!s.includes('Task done'),'done hidden globally');
  await c.input('s'); await c.waitScreen(s=>s.includes('done hidden · 4 · D'),'epic count ignores other roots');
  await c.input('<Space><Space>'); await at(c,'E-3');
  await c.input('D'); await c.waitScreen(s=>s.includes('done shown · 5 · D')&&s.includes('Task done'),'done restored');
  await c.input('A'); await c.waitScreen(s=>s.includes('Archived release')&&s.includes('Archived unscheduled task'),'archive roots shown');
  const archived=await text(c);
  assert.ok(archived.indexOf('Future release')<archived.indexOf('Archived release'),'live releases precede archived ones');
  await select(c,'R-30'); await c.input('A'); await at(c,':releases');
  await c.waitScreen(s=>!s.includes('Archived release')&&!s.includes('Archived unscheduled task'),'archive roots hidden');
  await c.input('s'); await c.waitScreen(s=>s.includes('EXPLORER Other releases')&&s.includes('done shown · 0 · D'),'virtual scope done count');
  await c.input('A'); await c.waitScreen(s=>s.includes('Archived release')&&s.includes('done shown · 1 · D'),'archived scope count');
  await c.input('D'); await c.waitScreen(s=>!s.includes('Archived release')&&s.includes('done hidden · 1 · D'),'count independent of done filter');
});

test('explorer preferences debounce to ui.json and reopen after a cold workbench start', {skip}, async t => {
  const {c,root}=await stub(t);
  await c.input('<Esc><Space>e'); await c.waitScreen(s=>s.includes('First epic'),'release tree');
  await select(c,'E-2'); await c.input('zc');
  await select(c,'E-3'); await c.input('l'); await c.waitScreen(s=>s.includes('Task in progress'),'unfold to save');
  await c.input('s'); await c.waitScreen(s=>s.includes('› E-3 First epic'),'scope to save');
  await c.input('DA'); await c.waitScreen(s=>s.includes('done hidden · 4 · D')&&!s.includes('Task done'),'preferences changed');
  await c.lua(`assert(vim.wait(5000,function()
    local ok,data=pcall(function() return vim.json.decode(table.concat(vim.fn.readfile(require('cland.state').S.root..'/.cland/ui.json'),'\\n')) end)
    return ok and data.explorer and data.explorer.scope=='E-3' and data.explorer.archive and data.explorer.hide_done
  end)); require('cland.ui').flush()`);
  const saved=JSON.parse(await readFile(`${root}/.cland/ui.json`,'utf8'));
  assert.equal(saved.version,2);
  assert.deepEqual(saved.explorer,{folds:{'E-2':false,'E-3':true},scope:'E-3',hide_done:true,archive:true,card_width:null});
  await c.lua("vim.cmd('qa!')").catch(()=>{}); await c.rpc.closed;
  // A valid but stale fold is cleaned once the new workbench knows its tracker.
  saved.explorer.folds['E-999']=true;
  saved.explorer.folds['E-10']=true; // T-10 exists, but its old prefix is not a held item id.
  saved.future_preference={kept:true};
  await writeFile(`${root}/.cland/ui.json`,JSON.stringify(saved));
  const {c:fresh}=await stub(t,fixture,root);
  assert.equal(await fresh.lua("return require('cland.state').S.ui.view.id"),'E-3','startup uses the kept scope');
  assert.equal(await fresh.lua("return vim.b.cland_role"),'explorer');
  await fresh.input('<Esc><Space>e');
  await fresh.waitScreen(s=>s.includes('› E-3 First epic')&&s.includes('done hidden · 4 · D'),'cold scope and D restored');
  await fresh.lua("require('cland.ui').changed(); require('cland.ui').flush()");
  const restored=JSON.parse(await readFile(`${root}/.cland/ui.json`,'utf8'));
  assert.deepEqual(restored.explorer,{folds:{'E-2':false,'E-3':true},scope:'E-3',hide_done:true,archive:true,card_width:null});
  assert.deepEqual(restored.future_preference,{kept:true});
  await fresh.input('<Space><Space><Space>e');
  await fresh.waitScreen(s=>s.includes('› E-3 First epic'),'Space e reopens saved scope');
  await fresh.input(':Cland explorer R-1<CR>');
  await fresh.waitScreen(s=>s.includes('EXPLORER R-1')&&s.includes('Task in progress')&&!s.includes('Task done')&&!s.includes('Planned epic task'),'saved human folds restored at release');
});

test('invalid explorer preferences reset alone and are reported while other ui.json keys survive', {skip}, async t => {
  for(const invalid of [false,[],{folds:{'E-0':true}},{folds:{'E-3':'open'}},{scope:42},{hide_done:'yes'},{archive:1},{card_width:'wide'}]) {
    const root=await tempProject(t);
    await mkdir(`${root}/.cland`,{recursive:true});
    await writeFile(`${root}/.cland/ui.json`,JSON.stringify({version:2,panels:{left:false,right:'inbox',dock:false},sizes:{right:46},items_filter:'all',explorer:invalid,future_preference:{kept:true}}));
    const {c}=await stub(t,fixture,root);
    assert.equal(await c.lua("return require('cland.state').S.ui.right"),'inbox');
    assert.match(String(await c.lua("return require('cland.state').S.flash.text")),/invalid explorer.*defaults/);
    await c.input('<Esc><Space>e'); await c.waitScreen(s=>s.includes('done shown · 5 · D'),'invalid explorer default');
    await c.input('D'); await c.waitScreen(s=>s.includes('done hidden · 5 · D'),'default can change');
    await c.lua("require('cland.ui').changed(); require('cland.ui').flush()");
    const saved=JSON.parse(await readFile(`${root}/.cland/ui.json`,'utf8'));
    assert.deepEqual(saved.explorer,{folds:{},scope:null,hide_done:true,archive:false,card_width:null});
    assert.equal(saved.items_filter,'all'); assert.deepEqual(saved.sizes,{right:46});
    assert.deepEqual(saved.future_preference,{kept:true});
    await c.lua("vim.cmd('qa!')").catch(()=>{}); await c.rpc.closed;
  }
});

test('the explorer registry, key help and status hint advertise every outline action', {skip}, async t => {
  const {c}=await stub(t);
  await c.input('<Esc><Space>e');
  await c.waitScreen(s=>s.includes('l h fold · s scope · ␣␣ back · D done · A archive')&&s.includes('m General · M topic'),'explorer status hint');
  const actions=await c.lua<Array<{id:string;title:string;key:string}>>("local out={}; for _,a in ipairs(require('cland.actions').all()) do if a.id:match('^explorer:') then out[#out+1]={id=a.id,title=a.title,key=a.key} end end; return out");
  assert.deepEqual(actions.map(a=>a.id).sort(),['<CR>','j','k','l','h','za','zo','zc','zR','zM','s','D','A','zb','m','M'].map(k=>`explorer:${k}`).sort());
  for(const action of actions) { assert.ok(action.title.length>0); assert.ok(action.key.endsWith('in explorer')); }
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"),[]);
  await c.input('<Space>?');
  const screen=await c.waitScreen(s=>s.includes('zR zM all')&&s.includes('za/zo/zc')&&s.includes('D done · A archive'),'explorer keys in help');
  assert.ok(screen.includes('Open explorer'));
  assert.ok(screen.includes('m General · M item topic (creates if absent)'));
  assert.ok(screen.includes('V selection: m/M General with item context'));
  assert.ok(screen.includes('S-↵ newline · Esc/q close, keep draft'));
});
async function highlights(c:Client, id:string) {
  return c.lua<string[]>(`local id=...; local e=require('cland.explorer'); local row; for r,info in ipairs(e.rows) do if info.key==id then row=r-1 end end; local groups={}; for _,m in ipairs(vim.api.nvim_buf_get_extmarks(e.b,vim.api.nvim_create_namespace('cland.explorer'),{row,0},{row,-1},{details=true})) do groups[#groups+1]=m[4].hl_group end; return groups`,id);
}

test('release rows, derived glyphs, rank then close order, folded roots and za cursor identity', {skip}, async t => {
  const {c,control}=await stub(t);
  await c.input('<Esc><Space>s<Space>e');
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
  assert.equal(requests.filter(r=>r.type==='task.view'&&r.item?.startsWith('T-')).length,0,'tree never fetches detail for unselected tasks');
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
  await c.waitScreen(s=>s.includes('EXPLORER R-1')&&s.includes('done shown · 1 · D'),'release-only done count');
  await c.input(':Cland explorer C-3<CR>');
  await c.waitScreen(s=>s.includes('EXPLORER C-3')&&s.includes('done shown · 1 · D'),'scoped category count');
});

test('live removal restores the next key, then the previous key, and keeps the card on the cursor', {skip}, async t => {
  const {c,control}=await stub(t);
  await c.input('<Esc>:Cland explorer E-3<CR>');
  await c.waitScreen(s=>s.includes('Task planned'),'scoped tasks');
  await select(c,'T-14'); await c.input('<CR>h');
  await c.waitScreen(s=>s.includes('CARD') && s.includes('T-14 · task'),'card on selected item');
  await control({emit:{type:'task',id:'T-14'}});
  await at(c,'T-15');
  await c.lua("assert(vim.wait(5000,function() return require('cland.explorer').card.key=='T-15' end))");
  await select(c,'T-20');
  await control({emit:{type:'task',id:'T-20'}});
  await at(c,'T-16');
});

test('status and stage changes move a row while its cursor and cached card keep the item', {skip}, async t => {
  const {c,control}=await stub(t);
  await c.input(':Cland explorer E-3<CR>');
  await c.waitScreen(s=>s.includes('Task planned'),'scoped stage rows');
  await select(c,'T-14'); await c.input('<CR>h');
  await c.lua("assert(vim.wait(5000,function() return require('cland.item_view').detail['T-14'] ~= nil end))");
  const movedStages=stages.map((s,i)=>({...s,items:i===0?s.items.filter(id=>id!=='T-14'):[...s.items,'T-14']}));
  const changed=fixture.items!.map(it=>it.id==='T-14'?{...it,status:'in progress',updated:'2026-10-14T09:30:00Z'}:it.id==='E-3'?{...it,stages:movedStages,updated:'2026-10-14T09:30:00Z'}:it);
  await control({set:{items:changed}});
  await control({emits:changed.filter(it=>it.id==='T-14'||it.id==='E-3').map(item=>({type:'task',id:item.id,item}))});
  await c.lua("assert(vim.wait(5000,function() local e=require('cland.explorer'); local t=table.concat(e.lines,'\\n'); return t:find('S2 the card',1,true)<t:find('Task planned',1,true) end))");
  assert.equal(await cursor(c),'T-14');
  assert.equal(await c.lua("return require('cland.explorer').card.key"),'T-14');
  await c.lua("assert(vim.wait(5000,function() return require('cland.item_view').detail['T-14'].seen=='2026-10-14T09:30:00Z' end))");
  const requests=(await control({requests:true})).requests.filter(r=>r.type==='task.view'&&r.item==='T-14').length;
  const renders=await c.lua<number>("return require('cland.explorer').renders");
  await control({emit:{type:'task',id:'T-14',item:changed.find(it=>it.id==='T-14')}});
  await c.lua("local n=...; assert(vim.wait(5000,function() return require('cland.explorer').renders>n end))",renders);
  assert.equal((await control({requests:true})).requests.filter(r=>r.type==='task.view'&&r.item==='T-14').length,requests,'same updated does not refetch task.view');
  await c.input('<Space><Space>');
  await c.waitScreen(s=>s.includes('EXPLORER R-1'),'scope history returns to root');
  const reparented={...changed.find(it=>it.id==='T-14')!,parent:'E-2',updated:'2026-10-14T09:31:00Z'};
  // Reveal the original task under E-3, while its future parent E-2 stays folded.
  await c.input(':Cland explorer R-1<CR>');
  await select(c,'E-3'); await c.input('l');
  await c.waitScreen(s=>s.includes('Task planned'),'task visible before reparenting');
  await select(c,'T-14');
  await control({emit:{type:'task',id:'T-14',item:reparented}});
  await at(c,'E-2');
  await c.lua("assert(vim.wait(5000,function() return require('cland.explorer').card.key=='E-2' end))");
});

test('a folded burst rebuilds once without writes; visible counts write once; hidden trees do no work', {skip}, async t => {
  const closed=Array.from({length:20},(_,i)=>({id:`T-${100+i}`,kind:'task',title:'Folded closed task',parent:'E-4',state:'closed',status:'done'}));
  const {c,control}=await stub(t,{...fixture,items:[...fixture.items!,...closed]});
  await select(c,'E-2'); await c.input('<CR>h');
  await c.lua("assert(vim.wait(5000,function() return require('cland.explorer').card.drawn_key=='E-2' and not next(require('cland.item_view').pending) and not next(require('cland.plan').pending) end))");
  const counts=()=>c.lua<number[]>("local e=require('cland.explorer');return {e.renders,e.writes,e.card.writes}");
  const before=await counts();
  await control({emits:closed.map(it=>({type:'task',id:it.id,item:{...it,title:'Changed hidden title',updated:'batch'}}))});
  await c.lua("local n=...;assert(vim.wait(5000,function() local e=require('cland.explorer');return require('cland.state').item('T-119').updated=='batch' and e.renders>n end))",before[0]);
  const after=await counts();
  assert.equal(after[0],before[0]!+1,'one coalesced render per burst');
  assert.deepEqual(after.slice(1),before.slice(1),'no tree or card write after the state barrier');
  await control({emit:{type:'task',id:'T-119',item:{...closed[19],status:'review',state:'open',updated:'count'}}});
  await c.lua("local n=...;assert(vim.wait(5000,function() return require('cland.explorer').renders>n end))",after[0]);
  assert.equal((await counts())[1],after[1]!+1,'a changed visible count writes exactly once');
  await c.input('<Space>g');
  await c.waitScreen(s=>s.includes('General')&&!s.includes('EXPLORER'),'hidden explorer');
  const hidden=await counts();
  await control({emit:{type:'crew',config:{idle_from:[]},summary:'changed while hidden'}});
  await c.lua("assert(vim.wait(5000,function() return require('cland.state').S.crew.summary=='changed while hidden' end)); local done=false;require('cland.state').on_change(function() done=true end);require('cland.state').changed();assert(vim.wait(5000,function() return done end))");
  assert.deepEqual(await counts(),hidden,'a hidden explorer does not rebuild');
  await c.lua("require('cland.layout').show_split_view({kind='explorer',id='E-2'})");
  await c.waitScreen(s=>s.includes('Planned epic task'),'explorer visible in a split');
  const split=await counts();
  await control({emit:{type:'task',id:'T-22',item:{...fixture.items!.find(it=>it.id==='T-22'),title:'Changed split task'}}});
  await c.waitScreen(s=>s.includes('Changed split task'),'live split task');
  assert.ok((await counts())[0]!>split[0]!);
});

function benchFixture(): Scenario {
  const statuses=['backlog','planned','in progress','review','qa','ready','done'];
  const tasks=Array.from({length:260},(_,i)=>({id:`T-${100+i}`,kind:'task',title:`Benchmark task ${i}`,parent:`E-${2+Math.floor(i/26)}`,rank:i,status:statuses[i%7],state:i%7===6?'closed':'open',updated:'2026-10-14T00:00:00Z'}));
  return {items:[
    {id:'R-1',kind:'release',title:'Benchmark release',version:'0.1.2',state:'open'},
    ...Array.from({length:10},(_,i)=>{
      const ids=tasks.filter(t=>t.parent===`E-${2+i}`).map(t=>t.id);
      const stages=[{name:'build',state:'open',items:ids.slice(0,13)},{name:'finish',state:'open',items:ids.slice(13)}];
      return {id:`E-${2+i}`,kind:'epic',title:`Benchmark epic ${i}`,parent:'R-1',state:'open',rank:i,stages,plan:{stages:stages.map(s=>({name:s.name,qa:{scope:'none',when:'after-stage'},lanes:[s.items]}))}};
    }),
    ...tasks,
    ...Array.from({length:4},(_,i)=>({id:`C-${400+i}`,kind:'category',title:['Bugs','Tech debt','Follow-ups','Ideas'][i],state:'open'})),
    ...Array.from({length:7},(_,i)=>({id:`T-${410+i}`,kind:'task',title:`Category task ${i}`,parent:`C-${400+i%4}`,state:'open',status:'backlog'})),
    {id:'M-420',kind:'map',title:'Future work',state:'open'},
    ...Array.from({length:15},(_,i)=>({id:`T-${430+i}`,kind:'task',title:`Unscheduled ${i}`,status:'backlog',state:'open'})),
    ...Array.from({length:2},(_,i)=>({id:`R-${450+i}`,kind:'release',title:`Closed release ${i}`,version:`0.0.${i}`,state:'closed',closed:'2025-12-01T00:00:00Z'})),
  ]};
}

test('bench reports build and buffer medians for 300 items fully unfolded and restores the human view', {skip}, async t => {
  const scenario=benchFixture(); assert.equal(scenario.items!.length,300);
  const {c}=await stub(t,scenario);
  await c.input('zR');
  await c.waitScreen(s=>s.includes('Benchmark task 0'),'all epic plans unfolded');
  await c.lua("assert(vim.wait(5000,function() return vim.tbl_count(require('cland.plan').detail)==10 and not next(require('cland.plan').pending) end))");
  await select(c,'T-100'); await c.input('<CR>h');
  await c.lua("assert(vim.wait(5000,function() return require('cland.item_view').detail['T-100'] ~= nil end))");
  const before=await c.lua("return vim.deepcopy(require('cland.explorer').ui())");
  const results=await c.lua<Array<{label:string;rows:number;model_ms:number;draw_ms:number}>>("return require('cland.explorer').bench(25,'T-100')");
  t.diagnostic(`300-item bench (ms): ${JSON.stringify(results)}`);
  assert.equal(results.length,3);
  assert.ok(results[1]!.rows>300,'fully unfolded includes every item and the stage labels');
  assert.ok(results[1]!.model_ms<75,`loose CI build bound: ${results[1]!.model_ms} ms; QA checks 15 ms on dev`);
  for(const result of results) assert.ok(result.model_ms>0 && result.draw_ms>0);
  assert.deepEqual(await c.lua("return require('cland.explorer').ui()"),before);
  assert.equal(await cursor(c),'T-100');
  assert.equal(await c.lua("return require('cland.explorer').card.key"),'T-100');
});

test('cold startup shows loading then selects the release without entering the composer', {skip}, async t => {
  const {c,control}=await stub(t,{...fixture,holdSnapshots:['task.list']});
  await control({waitSnapshot:'task.list'});
  await c.waitScreen(s=>s.includes('EXPLORER')&&s.includes('loading the items…'),'startup explorer loading');
  assert.equal(await c.mode(),'n');
  await control({releaseSnapshots:['task.list']});
  await c.waitScreen(s=>s.includes('EXPLORER R-1')&&s.includes('Explorer · R-1'),'startup bars name explorer');
  await at(c,'R-1');
  assert.equal(await c.lua("return vim.b.cland_role"),'explorer');
});


test('the harness default opens General while a preset and a restart snapshot keep their centre', {skip}, async t => {
  const {c,root}=await stub(t,fixture,undefined,'general');
  assert.equal(await c.lua("return vim.b.cland_role"),'composer');
  assert.equal(await c.lua("return require('cland.state').S.ui.view.id"),'general');
  await c.input('<Esc>:Cland preset steady<CR>');
  await c.waitScreen(s=>s.includes('BOARD'),'steady centre');
  await c.lua("require('cland.ui').flush();vim.cmd('qa!')").catch(()=>{}); await c.rpc.closed;
  const {c:preset}=await stub(t,fixture,root);
  assert.equal(await preset.lua("return require('cland.state').S.ui.view.kind"),'board','preset startup stays unchanged');
  // Exercise M.start's restart path with the production snapshot format in this isolated process.
  await preset.lua(`
    local cland=require('cland');local s=require('cland.state');local snap=s.snapshot()
    snap.view={kind='inbox'}
    require('cland.restart').save(snap);cland.client:stop()
    cland.start({root=s.S.root,transport='stdio',cli={vim.env.CLAND_NODE or 'node',...},restore=true})
  `,STUB);
  await preset.waitScreen(s=>s.includes('Inbox · full width'),'snapshot centre restored');
  assert.equal(await preset.lua("return require('cland.state').S.ui.view.kind"),'inbox');
  assert.equal(await preset.mode(),'n');
});
