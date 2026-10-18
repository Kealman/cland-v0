// T3: cold editor preference persistence and restart snapshot restoration.
// Screen permutations live in explorer-component.test.ts; workbench owns the shared real-hub flow.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tempProject } from '../../hub/test/harness.ts';
import { nvimOrSkip, startClient } from './harness.ts';
import { waitInitialSnapshots } from './readiness.ts';
import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import type { Scenario } from './stub-hub.ts';
import type { Client } from './harness.ts';

const nvim = await nvimOrSkip();

const skip = 'skip' in nvim ? nvim.skip : false;

const bin = 'bin' in nvim ? nvim.bin : '';

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

async function select(c:Client, key:string) {
  await c.lua("local key=...; local e=require('cland.explorer'); for r,row in ipairs(e.rows) do if row.key==key then vim.api.nvim_win_set_cursor(e.tree_win(),{r,0}); return end end; error('missing row '..key)",key);
}

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
