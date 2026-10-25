// Shared T2/T4 explorer case: sealed recorded-client requests and rendered row identity.
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { nvimOrSkip, startClient, type Client } from './stub-client.ts';
import { waitInitialSnapshots } from './readiness.ts';
import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';
import type { Scenario } from './stub-hub.ts';
import { tempProject } from './fixture.ts';

const nvim = await nvimOrSkip();
export const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';
const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));

export const stages = [
  {name:'the tree', state:'open', qa:{scope:'none',when:'after-stage'},items:['T-10','T-11','T-12','T-13','T-14','T-15','T-16','T-18','T-19','T-20']},
  {name:'the card', state:'open', qa:{scope:'affected',when:'after-stage'},items:['T-17']},
];

export const fixture: Scenario = { items: [
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

export async function stub(t: TestContext, scenario = fixture, projectRoot?: string, centre: 'general' | 'explorer' = 'explorer', screenPollMs = 40) {
  const root = projectRoot ?? await tempProject(t);
  const controlPath = `${root}/stub.sock`;
  const c = await startClient(t,bin,root,{CLAND_HUB_TRANSPORT:'stdio',CLAND_COMMAND:JSON.stringify([process.execPath,STUB]),CLAND_STUB_SCENARIO_JSON:JSON.stringify(scenario),CLAND_STUB_CONTROL:controlPath},{centre,screenPollMs});
  await c.rpc.request('nvim_ui_try_resize',200,50);
  if (scenario.holdSnapshots?.includes('task.list')) await c.waitScreen(s=>s.includes('hub: connected'),'connected with held item snapshot');
  else await waitInitialSnapshots(c);
  const control = (command:Record<string,unknown>) => new Promise<{requests:Array<{type:string;item?:string;state?:string;projection?:string}>}>((resolve,reject) => {
    const socket = createConnection(controlPath); let data='';
    socket.setEncoding('utf8'); socket.on('error',reject);
    socket.on('data',chunk => { data+=chunk; if(data.includes('\n')) { socket.end(); resolve(JSON.parse(data)); } });
    socket.write(JSON.stringify(command)+'\n');
  });
  return {c,control,root};
}

export async function text(c: Client) {
  return c.lua<string>("return table.concat(vim.api.nvim_buf_get_lines(require('cland.explorer').b,0,-1,false),'\\n')");
}

export async function select(c:Client, key:string) {
  await c.lua("local key=...; local e=require('cland.explorer'); for r,row in ipairs(e.rows) do if row.key==key then vim.api.nvim_win_set_cursor(e.tree_win(),{r,0}); return end end; error('missing row '..key)",key);
}

async function highlights(c:Client, id:string) {
  return c.lua<string[]>(`local id=...; local e=require('cland.explorer'); local row; for r,info in ipairs(e.rows) do if info.key==id then row=r-1 end end; local groups={}; for _,m in ipairs(vim.api.nvim_buf_get_extmarks(e.b,vim.api.nvim_create_namespace('cland.explorer'),{row,0},{row,-1},{details=true})) do groups[#groups+1]=m[4].hl_group end; return groups`,id);
}

export async function releaseRowsAndCursorIdentity(t: TestContext): Promise<void> {
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
  for(const expected of ['in work · 4 of 10 merged (loaded) · review only','S2 the card  planned','not in the plan','✓ done  in the order they closed','rev-11','impl-10','✗ review r2','✓ qa','2/3','merged 2025-12-03','◌ T-21','blocked by T-6']) assert.ok(tasks.includes(expected),expected);
  assert.ok(tasks.indexOf('Legacy done')<tasks.indexOf('Earlier done')&&tasks.indexOf('Earlier done')<tasks.indexOf('Task done')&&tasks.indexOf('Task done')<tasks.indexOf('Later done'));
  await c.lua(`assert(vim.wait(5000,function()
    local e=require('cland.explorer')
    return e.card.drawn_key=='E-3' and table.concat(e.card.lines or {},'\\n'):find('in its tasks',1,true)~=nil
  end),'settled E-3 verdict card')
  local done=false
  require('cland.item_view').client:request({type='hub.status'},function() done=true end)
  assert(vim.wait(5000,function() return done end),'request stream drained after card render')`);
  const requests=(await control({requests:true})).requests;
  t.diagnostic('settled E-3 task.view requests: '+JSON.stringify(requests.filter(r=>r.type==='task.view')));
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
}
