// Explorer roots through hub frames, registered keys and the headless screen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, startDaemon, tempProject } from '../../hub/test/harness.ts';
import { centreOf, nvimOrSkip, startClient, type Client } from './harness.ts';
import { waitInitialSnapshots } from './readiness.ts';
import type { Scenario } from './stub-hub.ts';
const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';
const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));
test('real hub summaries put a category and its ranked work under Categories', {skip}, async t=>{
  const root=await tempProject(t);
  await mkdir(join(root,'.cland'),{recursive:true});
  await writeFile(join(root,'.cland/config.toml'),'[tracker]\nlevels = [["release", "category"], ["epic"]]\n');
  const {discovery}=await startDaemon(t,root);const ui=await connectUi(t,discovery);
  const create=async(kind:string,title:string,parent?:string)=>{
    const reply=await ui.request({type:'task.create',kind,title,parent,...(kind==='task'?{size:'S'}:{})});
    assert.equal(reply.ok,true,reply.error);return (reply.value as {item:{id:string}}).item.id;
  };
  await create('release','Working with items');const category=await create('category','Tech debt');
  for(let n=1;n<=5;n++) await create('task',`Ranked debt ${n}`,category);
  const c=await startClient(t,bin,root);await c.rpc.request('nvim_ui_try_resize',200,50);await waitInitialSnapshots(c);
  await c.input('<Esc><Space>e');await c.waitScreen(s=>s.includes('Categories (1) · 5 open'),'real category summary');
  await select(c,':categories');await c.input('l');
  await c.waitScreen(s=>s.includes('Ranked debt 1')&&s.includes('Ranked debt 3')&&s.includes('2 more')&&!s.includes('Ranked debt 4'),'real top three');
  await select(c,`:more:${category}`);await c.input('l');await c.waitScreen(s=>s.includes('Ranked debt 5'),'real more unfolded');
});
const task = (n:number, rank:number, extra={}) => ({id:`T-${n}`,kind:'task',title:`Debt ${n}`,parent:'C-216',state:'open',status:'backlog',rank,...extra});
const fixture:Scenario = {
  crew:{config:{idle_from:['C-216']},summary:'idle from C-216'},
  tracker:{levels:['release','category','epic'],ladder:[['release','category'],['epic']]},
  items:[
    {id:'R-228',kind:'release',title:'Working with items',version:'0.1.2',state:'open'},
    {id:'C-219',kind:'category',title:'Ideas',state:'open',rank:1},
    {id:'C-218',kind:'category',title:'Follow-ups',state:'open',rank:2},
    {id:'C-217',kind:'category',title:'Bugs',state:'open',rank:3},
    {id:'C-216',kind:'category',title:'Tech debt',state:'open',rank:4},
    task(101,30),task(102,10),task(103,50),task(104,20),task(105,40),
    task(106,0,{state:'closed',status:'done',closed:'2026-10-13T02:00:00Z'}),
    task(107,100,{state:'closed',status:'done',closed:'2026-10-13T01:00:00Z'}),
    {id:'E-110',kind:'epic',title:'Bug collection',parent:'C-217',state:'open'},
    {id:'T-111',kind:'task',title:'Fix nested bug',parent:'E-110',state:'open',status:'review'},
    {id:'T-120',kind:'task',title:'Unscheduled task',state:'open',status:'planned',rank:1},
    {id:'M-121',kind:'map',title:'Explore the fog',state:'open',rank:100},
    {id:'T-122',kind:'task',title:'Closed root task',state:'closed',status:'done',closed:'2026-10-12T01:00:00Z'},
    {id:'R-300',kind:'release',title:'Later future',version:'0.3.0',state:'open',rank:1},
    {id:'R-301',kind:'release',title:'Next future',version:'0.2.0',state:'open',rank:100},
    {id:'R-200',kind:'release',title:'Previous release',version:'0.1.1',state:'closed',closed:'2026-10-12T01:00:00Z'},
    {id:'R-201',kind:'release',title:'Older release',version:'0.1.0',state:'closed',closed:'2026-10-11T01:00:00Z'},
    {id:'E-202',kind:'epic',title:'Archived epic',parent:'R-200',state:'closed',closed:'2026-10-12T00:00:00Z'},
    {id:'T-130',kind:'task',title:'Direct release task',parent:'R-228',state:'open',status:'planned'},
  ],processes:[{name:'coord',role:'coordinator',state:'idle',status:'running'}],
};
async function start(t:test.TestContext, scenario=fixture) {
  const root=await tempProject(t); const path=`${root}/stub.sock`;
  const c=await startClient(t,bin,root,{CLAND_HUB_TRANSPORT:'stdio',CLAND_COMMAND:JSON.stringify([process.execPath,STUB]),CLAND_STUB_SCENARIO_JSON:JSON.stringify(scenario),CLAND_STUB_CONTROL:path});
  await c.rpc.request('nvim_ui_try_resize',200,50); await waitInitialSnapshots(c);
  await c.input('<Esc><Space>e');
  await c.waitScreen(s=>s.includes('Categories (4)'),'root explorer');
  const control=(cmd:Record<string,unknown>)=>new Promise<{requests:Array<Record<string,unknown>>}>((resolve,reject)=>{
    const sock=createConnection(path);let data='';sock.setEncoding('utf8');sock.on('error',reject);
    sock.on('data',chunk=>{data+=chunk;if(data.includes('\n')){sock.end();resolve(JSON.parse(data));}});sock.write(JSON.stringify(cmd)+'\n');
  });
  return {c,control};
}
async function select(c:Client,key:string) {
  await c.lua("local key=...;local e=require('cland.explorer');vim.api.nvim_set_current_win(e.tree_win());for r,row in ipairs(e.rows) do if row.key==key then vim.api.nvim_win_set_cursor(e.tree_win(),{r,0});return end end;error('missing '..key)",key);
}
test('categories name their counts, open on the top three by rank, and D counts hidden done items', {skip}, async t=>{
  const {c}=await start(t);
  await c.waitScreen(s=>s.includes('Categories (4) · 6 open')&&s.includes('Tech debt 5 open')&&s.includes('Bugs 1 open'),'folded category counts');
  await select(c,':categories'); await c.input('l');
  const screen=await c.waitScreen(s=>s.includes('2 more')&&s.includes('5 open · 2 done')&&s.includes('Debt 107'),'top three and done');
  assert.ok(screen.indexOf('C-216 Tech debt')<screen.indexOf('C-217 Bugs'),'categories by id, not rank');
  assert.ok(screen.indexOf('Debt 102')<screen.indexOf('Debt 104')&&screen.indexOf('Debt 104')<screen.indexOf('Debt 101'),'top three by rank');
  assert.ok(!screen.includes('Debt 105')&&!screen.includes('Debt 103'),'remaining live items folded');
  assert.ok(screen.indexOf('Debt 107')<screen.indexOf('Debt 106'),'done items by closing time');
  await select(c,':more:C-216');await c.input('l');
  const more=await c.waitScreen(s=>s.includes('Debt 105')&&s.includes('Debt 103'),'more unfolded');
  assert.ok(more.indexOf('Debt 105')<more.indexOf('Debt 103'));
  await c.input('D');await c.waitScreen(s=>s.includes('D hides 2 done')&&!s.includes('Debt 106')&&!s.includes('Debt 107'),'done placeholder');
  await select(c,'E-110');await c.input('l');await c.waitScreen(s=>s.includes('Fix nested bug'),'epic inside category unfolds');
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"),[]);
});
test('idle work comes from the crew snapshot and changes live with its configured order', {skip}, async t=>{
  const {c,control}=await start(t);await select(c,':categories');await c.input('l');
  await c.waitScreen(s=>s.includes('idle work'),'snapshot idle mark');
  const marks=await c.lua<Array<{text:string;hl:string}>>("local e=require('cland.explorer');local out={};for _,m in ipairs(vim.api.nvim_buf_get_extmarks(e.b,vim.api.nvim_create_namespace('cland.explorer'),0,-1,{details=true})) do local d=m[4];local line=vim.api.nvim_buf_get_lines(e.b,m[2],m[2]+1,false)[1];out[#out+1]={text=line:sub(m[3]+1,d.end_col),hl=d.hl_group} end;return out");
  assert.ok(marks.some(m=>m.text.includes('idle work')&&m.hl==='ClandTeal'),'idle mark is teal');
  await control({emit:{type:'crew',config:{idle_from:[]},summary:'idle from none'}});
  await c.waitScreen(s=>!s.includes('idle work'),'idle mark removed without restart');
  await control({emit:{type:'crew',config:{idle_from:['C-217','C-216']},summary:'idle from C-217, C-216'}});
  const ordered=await c.waitScreen(s=>s.includes('idle work 1')&&s.includes('idle work 2'),'ordered idle marks');
  assert.match(ordered,/C-216 Tech debt[^\n]*idle work 2/);
  assert.match(ordered,/C-217 Bugs[^\n]*idle work 1/);
});
test('Unscheduled puts maps first; Other releases uses versions and A reveals closed roots newest first', {skip}, async t=>{
  const {c}=await start(t);
  await c.waitScreen(s=>s.includes('Unscheduled (2)')&&s.includes('M-121 Explore the fog')&&s.includes('T-120 Unscheduled task')&&s.includes('A shows them'),'folded root descriptions');
  await select(c,':unscheduled');await c.input('l');
  await c.waitScreen(s=>s.includes('○ M-121')&&s.includes('○ T-120'),'unscheduled unfolded');
  await select(c,':releases');await c.input('l');
  const open=await c.waitScreen(s=>s.includes('R-301 0.2.0')&&s.includes('R-300 0.3.0'),'open releases');
  assert.ok(open.indexOf('○ M-121')<open.indexOf('○ T-120'),'map precedes lower ranked task');
  assert.ok(open.indexOf('R-301 0.2.0')<open.indexOf('R-300 0.3.0'),'versions precede ranks');
  assert.ok(!open.includes('T-122')&&!open.includes('R-200')&&!open.includes('R-201'));
  await c.input('A');const archive=await c.waitScreen(s=>s.includes('T-122')&&s.includes('R-200')&&s.includes('R-201'),'archive roots');
  assert.ok(archive.indexOf('R-300 0.3.0')<archive.indexOf('R-200 0.1.1'),'closed releases follow open');
  assert.ok(archive.indexOf('R-200 0.1.1')<archive.indexOf('R-201 0.1.0'),'newest closed release first');
  await select(c,'R-200');await c.input('l');await c.waitScreen(s=>s.includes('Archived epic'),'archived release unfolds');
  await select(c,':releases');await c.input('A');await c.waitScreen(s=>!s.includes('R-200')&&!s.includes('T-122'),'archive hidden again');
});
async function cardRef(c:Client,id:string) {
  await c.lua("local id=...;local e=require('cland.explorer');for r,row in ipairs(e.card.info) do if row.ref==id then vim.api.nvim_win_set_cursor(e.card.win,{r,0});return end end;error('missing card reference '..id)",id);
}
async function revealed(c:Client,id:string) {
  await c.lua("local id=...;assert(vim.wait(5000,function() local e=require('cland.explorer');return vim.api.nvim_get_current_win()==e.tree_win() and e.key_at(vim.api.nvim_win_get_cursor(e.tree_win())[1])==id end),'revealed '..id)",id);
}
test('each virtual card describes its holdings, and Enter reveals category, more and direct references', {skip}, async t=>{
  const {c}=await start(t);
  for(const [key,description,id] of [
    [':categories','Categories hold items outside every release and epic.','C-216'],
    [':unscheduled','Items with no container','M-121'],
    [':releases','Other open releases','R-301'],
    [':direct:R-228','Tasks directly under R-228','T-130'],
    [':more:C-216','Remaining live items in C-216','T-105'],
  ]) {
    if(key===':more:C-216') {
      await select(c,':categories');await c.input('l');await c.waitScreen(s=>s.includes('2 more'),'category unfolded for more card');
    }
    await select(c,key!);await c.input('<CR>');
    await c.waitScreen(s=>s.includes(description!)&&s.includes('HOLDS'),'virtual card');
    await cardRef(c,id!);await c.input('<CR>');await revealed(c,id!);
  }
  await c.waitScreen(s=>s.includes('Debt 105')&&s.includes('Debt 103'),'reference below the top three opens more');
  await c.input('h');await c.waitScreen(s=>s.includes('▸ 2 more')&&!centreOf(s).includes('Debt 105')&&!centreOf(s).includes('Debt 103'),'more folded');
  await c.input('s');await c.waitScreen(s=>s.includes('C-216 Tech debt › 2 more'),'more scope breadcrumbs');
  await select(c,':more:C-216');await c.input('<CR>');await cardRef(c,'T-103');await c.input('<CR>');await revealed(c,'T-103');
  assert.equal(await c.lua("return require('cland.state').S.ui.view.id"),':more:C-216','reveal retains virtual scope');
});
test('root cards cap holdings at twelve with the remaining count', {skip}, async t=>{
  const extra=Array.from({length:12},(_,n)=>task(400+n,200+n,{parent:null,title:`Extra root ${n}`}));
  const {c}=await start(t,{...fixture,items:[...fixture.items!,...extra]});
  await select(c,':unscheduled');await c.input('A<CR>');
  await c.waitScreen(s=>s.includes('HOLDS · 15 ITEMS')&&s.includes('3 more · l unfolds'),'capped root card');
  const refs=await c.lua<string[]>("local e=require('cland.explorer');local ids={};for _,row in ipairs(e.card.info) do if row.ref then ids[#ids+1]=row.ref end end;return ids");
  assert.equal(refs.length,12);assert.ok(!refs.includes('T-122'),'last closed root is beyond cap');
});
test('root cards give done references a green glyph and done colour, and Enter reveals them', {skip}, async t=>{
  const {c}=await start(t);await select(c,':unscheduled');await c.input('A<CR>');
  await c.waitScreen(s=>s.includes('● T-122 Closed root task'),'done holding with glyph');
  const done=await c.lua<boolean>("local e=require('cland.explorer');for _,m in ipairs(vim.api.nvim_buf_get_extmarks(e.card.buf,vim.api.nvim_create_namespace('cland.explorer.card'),0,-1,{details=true})) do local d=m[4];local line=vim.api.nvim_buf_get_lines(e.card.buf,m[2],m[2]+1,false)[1];if d.hl_group=='ClandDone' and line:sub(m[3]+1,d.end_col):find('Closed root task',1,true) then return true end end;return false");
  assert.equal(done,true);
  await cardRef(c,'T-122');await c.input('<CR>');await revealed(c,'T-122');
});
test('m and M promote category work by message with the category container in the context', {skip}, async t=>{
  const {c,control}=await start(t);await select(c,':categories');await c.input('l');
  await c.waitScreen(s=>s.includes('Debt 102'),'category work');
  for(const [id,key] of [['C-216','m'],['T-102','M']] as const) {
    await select(c,id);await c.input(key);
    await c.waitScreen(s=>s.includes('rides with it, as the Coordinator receives it:'),'message context');
    await c.lua("assert(vim.wait(2000,function() return vim.api.nvim_get_mode().mode=='i' end),'composer insert mode')");
    await c.input('Please promote this<CR>');
    await c.waitScreen(s=>s.includes('sent to the Coordinator')&&!s.includes('rides with it'),'promotion sent');
  }
  const {requests}=await control({requests:true});
  const sends=requests.filter(f=>f.type==='topic.send');
  assert.equal(sends.length,2);assert.equal(sends[0]!.topic,'general');
  assert.match(String(sends[0]!.text),/C-216 · category · backlog · no container · rank 4 · Tech debt/);
  assert.match(String(sends[1]!.text),/T-102 · task · backlog · C-216 Tech debt · rank 10 · Debt 102/);
  assert.ok(requests.some(f=>f.type==='topic.create'&&f.item==='T-102'),'M creates the category item topic');
});
