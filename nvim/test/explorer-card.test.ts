import test from 'node:test';
import assert from 'node:assert/strict';
import { connectUi, startDaemon, tempProject } from '../../hub/test/harness.ts';
import { nvimOrSkip, startClient, type Client } from './harness.ts';
import { waitInitialSnapshots } from './readiness.ts';
import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import type { Scenario } from './stub-hub.ts';
const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';
const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));
async function card(c: Client) {
  return c.lua<string>("local b=require('cland.explorer').card.buf; return b and table.concat(vim.api.nvim_buf_get_lines(b,0,-1,false),'\\n') or ''");
}
async function select(c:Client,key:string) {
  await c.lua("local key=...; local e=require('cland.explorer'); for r,row in ipairs(e.rows) do if row.key==key then vim.api.nvim_win_set_cursor(e.tree_win(),{r,0}); return end end; error('missing row '..key)",key);
}
async function shown(c:Client,id:string,text:string) {
  await c.lua("local id,text=...; assert(vim.wait(5000,function() local e=require('cland.explorer'); return e.card.key==id and e.card.lines and table.concat(e.card.lines,'\\n'):find(text,1,true)~=nil end),'card '..id)",id,text);
}

test('the explorer card reads parsed body from a real hub and Enter/h preserve the tree cursor', {skip}, async t => {
  const root=await tempProject(t);
  const {discovery}=await startDaemon(t,root);
  const ui=await connectUi(t,discovery);
  const create=async(kind:string,title:string,parent?:string,body?:string)=> {
    const result=await ui.request({type:'task.create',kind,title,parent,body,...(kind==='task'?{size:'S'}:{})});
    assert.equal(result.ok,true,result.error); return (result.value as {item:{id:string}}).item.id;
  };
  const r=await create('release','Working with items');
  const e=await create('epic','Explorer',r);
  const id=await create('task','Show human summary',e,'## Summary\nThe card starts with the human picture.\n\n## Agents\nDo not draw this body.');
  const c=await startClient(t,bin,root); await c.rpc.request('nvim_ui_try_resize',200,50); await waitInitialSnapshots(c);
  await c.input('<Esc><Space>e'); await c.waitScreen(s=>s.includes('Explorer'),'explorer');
  await c.input('zR'); await select(c,id); await shown(c,id,'human picture.');
  await c.waitScreen(s=>s.includes('CARD')&&s.includes('human picture.'),'card screen');
  assert.ok(!(await card(c)).includes('Do not draw this body'));
  const cursor=await c.lua("return vim.api.nvim_win_get_cursor(require('cland.explorer').tree_win())");
  const winbar=await c.lua<string>("local e=require('cland.explorer'); return vim.api.nvim_eval_statusline(e.card_winbar(e.card.win),{winid=e.card.win,maxwidth=vim.api.nvim_win_get_width(e.card.win),use_winbar=true}).str");
  assert.ok(winbar.includes('CARD')&&winbar.includes('focus · h back'),'card header preserves focus/back keys');
  await c.input('<CR>'); assert.equal(await c.lua('return vim.b.cland_role'),'card');
  await c.input('jkh'); assert.equal(await c.lua('return vim.b.cland_role'),'explorer');
  assert.deepEqual(await c.lua("return vim.api.nvim_win_get_cursor(require('cland.explorer').tree_win())"),cursor);
});

const fixture: Scenario={coordinator:'coord',processes:[{name:'coord',role:'coordinator',status:'running',state:'idle'}],items:[
  {id:'R-1',kind:'release',title:'Working with items',version:'0.1.2',state:'open'},
  {id:'E-2',kind:'epic',title:'The explorer',parent:'R-1',state:'open',plan:{stages:[{name:'Card',lanes:[['T-10','T-11']],qa:{scope:'none',when:'after-stage'}}]},stages:[{name:'Card',items:['T-10','T-11'],state:'open'}]},
  {id:'T-10',kind:'task',title:'Written summary task',parent:'E-2',state:'open',status:'review',rank:1,layer:'watch',labels:['nvim','ready-for-agent'],size:'L',updated:'2026-01-01T00:00:00Z',body:'## Summary\nThe written human picture.\n\n## Work\nAgents only.',claim:{session:'impl',role:'implementer'},holds:[{session:'rev',role:'reviewer',heldAt:'2026-01-01T10:00:00Z'}]},
  {id:'T-11',kind:'task',title:'Fallback summary task',parent:'E-2',state:'open',status:'planned',rank:2,layer:'now',body:'## Parent\nE-2\n\n## Problem\nFound by qa-1 in the demo. The fallback human picture. Second sentence. Third omitted.'},
  ...Array.from({length:20},(_,i)=>({id:`T-${30+i}`,kind:'task',title:`Passing task ${i}`,parent:'E-2',state:'open',status:'planned',rank:10+i,body:`## Summary\nResting on task ${i}.`})),
  {id:'C-3',kind:'category',title:'Ideas',state:'open'},
  {id:'T-4',kind:'task',title:'A category task',parent:'C-3',state:'open',status:'planned'},
],topics:[{id:'general',title:'General',status:'open',standing:true},{id:'topic-10',title:'Discuss task',item:'T-10',status:'open'}],messages:{general:[{id:'m-1',ts:new Date().toISOString(),from:'human',fromKind:'human',via:'spoke',to:['human'],topic:'general',kind:'report',text:'Work on T-11 here.'}]}};
async function stub(t:test.TestContext,scenario=fixture,projectRoot?:string) {
  const root=projectRoot??await tempProject(t), controlPath=root+'/stub.sock';
  const c=await startClient(t,bin,root,{CLAND_HUB_TRANSPORT:'stdio',CLAND_COMMAND:JSON.stringify([process.execPath,STUB]),CLAND_STUB_SCENARIO_JSON:JSON.stringify(scenario),CLAND_STUB_CONTROL:controlPath});
  await c.rpc.request('nvim_ui_try_resize',200,50); await waitInitialSnapshots(c);
  const control=(cmd:Record<string,unknown>)=>new Promise<{requests:Array<{type:string;item?:string}>}>((resolve,reject)=> {
    const s=createConnection(controlPath); let data=''; s.setEncoding('utf8'); s.on('error',reject); s.on('data',chunk=>{data+=chunk;if(data.includes('\n')){s.end();resolve(JSON.parse(data));}});s.write(JSON.stringify(cmd)+'\n');
  });
  return {c,root,control};
}

test('card follows rows with written or fallback summaries and task/container facts', {skip}, async t=> {
  const {c}=await stub(t); await c.input('<Esc><Space>e'); await c.waitScreen(s=>s.includes('The explorer'),'tree');
  await c.input('zR'); await select(c,'T-10'); await shown(c,'T-10','written human picture.');
  let text=await card(c);
  for(const expected of ['R-1 0.1.2 Working with items','E-2','S1','Written summary task','SUMMARY','FACTS','review','now','nvim','ready-for-agent','L','impl [Implementer]','rev [Reviewer]','since','1st of 22 in E-2']) assert.ok(text.includes(expected),expected+'\n'+text);
  assert.ok(!text.includes('fallback from')); assert.ok(!text.includes('Agents only'));
  await select(c,'T-11'); await shown(c,'T-11','fallback human picture.'); text=await card(c);
  assert.ok(text.includes('fallback from ## Problem · no ## Summary yet'));
  assert.ok(await c.lua("local e=require('cland.explorer'); for _,m in ipairs(e.card.marks) do if m[4]=='ClandFaint' and e.card.lines[m[1]+1]:find('fallback from',1,true) then return true end end; return false"),'fallback provenance is dimmed'); assert.ok(!text.includes('Found by')); assert.ok(!text.includes('Third omitted'));
  await c.input('l'); assert.equal(await c.lua('return vim.b.cland_role'),'card');
  assert.match(await c.lua<string>("return require('cland.motions').context().item"),/T-11/);
  await c.input('<Space><Space>'); assert.equal(await c.lua('return vim.b.cland_role'),'explorer');
  await select(c,'E-2'); await shown(c,'E-2',', derived'); text=await card(c);
  for(const expected of ['in work, derived','now','coord','T-10','impl [Implementer]','rev [Reviewer]']) assert.ok(text.includes(expected),expected+'\n'+text);
  await select(c,':categories'); await shown(c,':categories','C-3 Ideas');
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"),[]);
});

test('rapid j movement fetches only the rested row, reuses cached details and refreshes on updated', {skip}, async t=> {
  const {c,control}=await stub(t);
  await c.input('<Esc><Space>e'); await c.waitScreen(s=>s.includes('The explorer'),'tree');
  await c.input('zR'); await select(c,'T-10'); await shown(c,'T-10','written human picture.');
  const before=(await control({requests:true})).requests.length;
  await c.input('j'.repeat(21)); await shown(c,'T-49','Resting on task 19.');
  const views=(await control({requests:true})).requests.slice(before).filter(r=>r.type==='task.view');
  assert.deepEqual(views.map(r=>r.item),['T-49'],'passed rows never fetch detail');
  const tick=await c.lua("return vim.api.nvim_buf_get_changedtick(require('cland.explorer').card.buf)");
  await c.input('kj'); await shown(c,'T-49','Resting on task 19.');
  // A unrelated hub redraw also leaves the card's actual buffer unchanged.
  await control({emit:{type:'task',id:'T-4',item:{id:'T-4',kind:'task',title:'Changed category task',parent:'C-3',state:'open',status:'planned'}}});
  await c.lua("assert(vim.wait(3000,function() return require('cland.state').item('T-4').title=='Changed category task' end))");
  assert.equal(await c.lua("return vim.api.nvim_buf_get_changedtick(require('cland.explorer').card.buf)"),tick);
  await select(c,'T-10'); await shown(c,'T-10','written human picture.');
  assert.equal((await control({requests:true})).requests.filter(r=>r.type==='task.view'&&r.item==='T-10').length,1);
  const changed={...fixture.items!.find(i=>i.id==='T-10'),updated:'2026-01-02T00:00:00Z',body:'## Summary\nUpdated human picture.'};
  await control({set:{items:fixture.items!.map(i=>i.id==='T-10'?changed:i)},emit:{type:'task',id:'T-10',item:changed}});
  await shown(c,'T-10','Updated human picture.');
  assert.equal((await control({requests:true})).requests.filter(r=>r.type==='task.view'&&r.item==='T-10').length,2);
});

test('loading summary retains facts and deferred detail answers update the card', {skip}, async t=> {
  const {c,control}=await stub(t,{...fixture,holdSnapshots:['task.view']});
  await c.input('<Esc><Space>e'); await c.waitScreen(s=>s.includes('The explorer'),'tree');
  await c.input('zR'); await select(c,'T-10'); await shown(c,'T-10',"loading the agents' text…");
  assert.ok((await card(c)).includes('impl [Implementer]'));
  await control({set:{holdSnapshots:[]},releaseSnapshots:['task.view']});
  await shown(c,'T-10','written human picture.');
});

test('gi reveals the thread reference without changing folds, keeps containing scope and gI/palette open v0.1', {skip}, async t=> {
  const {c,control}=await stub(t);
  await c.waitScreen(s=>s.includes('Work on T-11 here.'),'thread reference');
  await c.input('<Esc><C-w>kgg/T-11<CR>');
  const folds=await c.lua("return require('cland.explorer').ui().folds");
  await c.input('gi'); await shown(c,'T-11','fallback human picture.');
  assert.equal(await c.lua("return require('cland.state').S.ui.view.kind"),'explorer');
  assert.equal(await c.lua("local e=require('cland.explorer'); return e.key_at(vim.api.nvim_win_get_cursor(e.tree_win())[1])"),'T-11');
  assert.deepEqual(await c.lua("return require('cland.explorer').ui().folds"),folds);
  await c.input('gI'); await c.waitScreen(s=>s.includes('T-11 · item')&&s.includes('Found by qa-1'),'v0.1 full item view');
  assert.equal(await c.lua("return require('cland.explorer').card.win"),null);
  await c.input('<Space><Space>'); await shown(c,'T-11','fallback human picture.');
  await c.input('s'); await c.waitScreen(s=>s.includes('R-1 0.1.2 Working with items › E-2 The explorer'),'scope');
  await select(c,'T-10'); await c.input('gi'); await shown(c,'T-10','written human picture.');
  assert.equal(await c.lua("return require('cland.state').S.ui.view.id"),'E-2');
  await c.input('<CR>gp'); await c.waitScreen(s=>s.includes('PLAN')&&s.includes('Card'),'card gp uses its item');
  await c.input('<Space><Space>'); await shown(c,'T-10','written human picture.');
  await c.input('<CR>gt'); await c.waitScreen(s=>s.includes('Discuss task'),'card gt uses its item');
  await c.input('<Space><Space>'); await shown(c,'T-10','written human picture.');
  await c.input('<CR>gs'); await c.waitScreen(s=>s.includes('no session named impl'),'card gs uses its claimant');
  // Palette item picks retain their established full-body view.
  await c.input('<Space>p'); await c.input('#Written summary task');
  await c.waitScreen(s=>s.includes('Written summary task'),'palette item');
  await c.input('<CR>'); await c.waitScreen(s=>s.includes('T-10 · item')&&s.includes('Agents only.'),'palette v0.1 item');
  assert.ok((await control({requests:true})).requests.some(r=>r.type==='task.view'&&r.item==='T-10'));
});

test('card widths use the centre formula, manual resize persists separately, and other views close it', {skip}, async t=> {
  const {c,root}=await stub(t);
  await c.input('<Esc><Space>e'); await c.waitScreen(s=>s.includes('CARD'),'card window');
  assert.ok(await c.lua("local e=require('cland.explorer');return vim.w[e.card.win].cland_card==true and require('cland.layout').centre()~=e.card.win"));
  const sizes=await c.lua("local l=require('cland.layout');local e=require('cland.explorer');return {vim.api.nvim_win_get_width(l.centre()),vim.api.nvim_win_get_width(e.card.win)}") as number[];
  assert.deepEqual(sizes,[86,62],'149 centre columns give a 62-column card plus one separator');
  assert.ok(sizes[0]!>=30);
  assert.equal(await c.lua("return vim.wo[require('cland.explorer').card.win].wrap"),false);
  await c.lua("local e=require('cland.explorer'); vim.api.nvim_win_set_width(e.card.win,48)");
  await c.lua("assert(vim.wait(3000,function() return require('cland.explorer').ui().card_width==48 end))");
  await c.lua("require('cland.ui').flush()");
  const saved=JSON.parse(await readFile(root+'/.cland/ui.json','utf8'));
  assert.equal(saved.explorer.card_width,48); assert.equal(saved.sizes.card,undefined); assert.equal(saved.sizes.right,undefined);
  await c.input('<Space>b'); await c.waitScreen(s=>s.includes('BOARD')&&!s.includes('CARD'),'board closes card');
  assert.equal(await c.lua("return require('cland.explorer').card.win"),null);
  await c.input('<Space><Space>'); await c.waitScreen(s=>s.includes('CARD'),'card returns');
  assert.equal(await c.lua("return vim.api.nvim_win_get_width(require('cland.explorer').card.win)"),48);
  await c.rpc.request('nvim_ui_try_resize',120,40);
  await c.waitScreen(s=>s.includes('CARD'),'narrow card');
  assert.ok(await c.lua("local e=require('cland.explorer');return vim.api.nvim_win_get_width(e.tree_win())>=30"));
  assert.equal(await c.lua("return require('cland.explorer').ui().card_width"),48,'screen constraint keeps preference');
  await c.input(':qa!<CR>');
  const restarted=await stub(t,fixture,root); await restarted.c.input('<Esc><Space>e'); await restarted.c.waitScreen(s=>s.includes('CARD'),'cold start card');
  assert.equal(await restarted.c.lua("return vim.api.nvim_win_get_width(require('cland.explorer').card.win)"),48);
});


test('gi reveals category, direct and archived items beyond the current scope without persisting filters or folds', {skip}, async t=> {
  const archived={id:'R-90',kind:'release',title:'Archived release',state:'closed',version:'0.0.1'};
  const old={id:'T-91',kind:'task',title:'Archived task',parent:'R-90',state:'closed',status:'done',body:'## Summary\nArchived human picture.'};
  const direct={id:'T-92',kind:'task',title:'Direct task',parent:'R-1',state:'open',status:'planned',body:'## Summary\nDirect human picture.'};
  const {c,root}=await stub(t,{...fixture,items:[...fixture.items!,archived,old,direct]});
  await c.input('<Esc>:Cland explorer E-2<CR>'); await c.waitScreen(s=>s.includes('The explorer'),'epic scope');
  await c.input('D');
  const prefs=await c.lua("local e=require('cland.explorer').ui();return {folds=e.folds,hide_done=e.hide_done,archive=e.archive}");
  for(const [id,summary] of [['T-4','no summary'],['T-92','Direct human picture.'],['T-91','Archived human picture.']]) {
    await c.input(':Cland view item '+id+'<CR>gi'); await shown(c,id!,summary!);
    assert.equal(await c.lua("return require('cland.state').S.ui.view.kind"),'explorer');
    assert.equal(await c.lua("return require('cland.state').S.ui.view.id"),null,'outside the scope opens root');
    assert.equal(await c.lua("local e=require('cland.explorer');return e.key_at(vim.api.nvim_win_get_cursor(e.tree_win())[1])"),id);
    assert.deepEqual(await c.lua("local e=require('cland.explorer').ui();return {folds=e.folds,hide_done=e.hide_done,archive=e.archive}"),prefs);
  }
  await c.lua("require('cland.ui').flush()");
  const persisted=JSON.parse(await readFile(root+'/.cland/ui.json','utf8'));
  assert.deepEqual(persisted.explorer.folds,{}); assert.equal(persisted.explorer.hide_done,true); assert.equal(persisted.explorer.archive,false);
});


test('gi keeps a virtual scope containing a done target even while D hides that target', {skip}, async t=> {
  const done={id:'T-93',kind:'task',title:'Done direct task',parent:'R-1',state:'closed',status:'done',body:'## Summary\nDone human picture.'};
  const {c}=await stub(t,{...fixture,items:[...fixture.items!,done]});
  await c.input('<Esc><Space>e'); await c.waitScreen(s=>s.includes('Direct tasks'),'direct root');
  await select(c,':direct:R-1'); await c.input('sD');
  await c.waitScreen(s=>s.includes('done hidden'),'filtered virtual scope');
  await c.input(':Cland view item T-93<CR>gi'); await shown(c,'T-93','Done human picture.');
  assert.equal(await c.lua("return require('cland.state').S.ui.view.id"),':direct:R-1');
  assert.equal(await c.lua("return require('cland.explorer').ui().hide_done"),true);
});
