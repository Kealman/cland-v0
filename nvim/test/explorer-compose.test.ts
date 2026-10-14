// The human's explorer messages at the frame boundary, driven with Neovim keys.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';
import { connectUi, spawnSpoke, startDaemon, tempProject } from '../../hub/test/harness.ts';
import { nvimOrSkip, startClient, type Client } from './harness.ts';
import { waitInitialSnapshots } from './readiness.ts';
import type { Scenario } from './stub-hub.ts';
const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';
const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));
const task = (n:number, extra = {}) => ({id:`T-${n}`,kind:'task',title:`Task ${n}`,parent:'E-276',rank:n*10,state:'open',status:'planned',...extra});
const fixture:Scenario = {items:[
  {id:'R-228',kind:'release',title:'Working with items',version:'0.1.2',state:'open'},
  {id:'E-276',kind:'epic',title:'The explorer and the card',parent:'R-228',rank:2760,state:'open'},
  task(355),task(356),task(357),task(358,{state:'closed',status:'done'}),
],processes:[{name:'coord',role:'coordinator',state:'idle',status:'running'}]};
type Frame = {type:string;topic?:string;text?:string;to?:string[];item?:string;title?:string};
async function start(t:test.TestContext, scenario=fixture) {
  const root=await tempProject(t); const path=`${root}/stub.sock`;
  const c=await startClient(t,bin,root,{CLAND_HUB_TRANSPORT:'stdio',CLAND_COMMAND:JSON.stringify([process.execPath,STUB]),CLAND_STUB_SCENARIO_JSON:JSON.stringify(scenario),CLAND_STUB_CONTROL:path});
  await c.rpc.request('nvim_ui_try_resize',200,50); await waitInitialSnapshots(c);
  await c.input('<Esc><Space>e');
  await c.waitScreen(s=>s.includes('Categories (0)'),'root explorer');
  await c.input(':Cland explorer E-276<CR>');
  await c.waitScreen(s=>s.includes('T-355'),'scoped explorer');
  const control=(cmd:Record<string,unknown>)=>new Promise<{requests:Frame[]}>((resolve,reject)=>{
    const sock=createConnection(path);let data='';sock.setEncoding('utf8');sock.on('error',reject);
    sock.on('data',chunk=>{data+=chunk;if(data.includes('\n')){sock.end();resolve(JSON.parse(data));}});sock.write(JSON.stringify(cmd)+'\n');
  });
  return {c,control};
}
async function select(c:Client,id:string) {
  await c.lua("local id=...;local e=require('cland.explorer');vim.api.nvim_set_current_win(e.tree_win());for r,row in ipairs(e.rows) do if row.key==id then vim.api.nvim_win_set_cursor(e.tree_win(),{r,0});return end end;error('missing '..id)",id);
}
async function send(c:Client,key:string,text:string) {
  await c.input(key);await c.waitScreen(s=>s.includes('rides with it, as the Coordinator receives it:'),'context float');
  await c.lua("assert(vim.wait(2000,function() return vim.api.nvim_get_mode().mode=='i' end),'insert')");
  await c.input(text+'<CR>');await c.waitScreen(s=>!s.includes('rides with it')&&s.includes('sent to the Coordinator'),'accepted message');
}
test('a real Coordinator receives explorer text from the human; M binds the real tracker topic', {skip}, async t=>{
  const root=await tempProject(t);const {discovery}=await startDaemon(t,root);const ui=await connectUi(t,discovery);
  const create=async(kind:string,title:string,parent?:string)=>{
    const reply=await ui.request({type:'task.create',kind,title,parent,...(kind==='task'?{size:'S'}:{})});
    assert.equal(reply.ok,true,reply.error);return (reply.value as {item:{id:string}}).item.id;
  };
  const release=await create('release','Working with items');const epic=await create('epic','The explorer',release);const item=await create('task','Message this',epic);
  const coord=await spawnSpoke({discover:true,cwd:root,name:'coord',role:'coordinator',sessionId:'compose-coord'});t.after(()=>coord.close());
  const c=await startClient(t,bin,root);await c.rpc.request('nvim_ui_try_resize',200,50);await waitInitialSnapshots(c);
  await c.input(`<Esc>:Cland explorer ${epic}<CR>`);await c.waitScreen(s=>s.includes('Message this'),'real item');await select(c,item);
  await send(c,'m','Please plan this');
  const message=await coord.waitForEvent(e=>e.params.content.startsWith('Please plan this\n\nfrom the explorer'));
  assert.equal(message.params.meta?.from_kind,'human');assert.equal(message.params.meta?.topic,'general');assert.ok(message.params.content.includes('\n'+item+' · task ·'));
  await send(c,'M','Discuss in its topic');
  const bound=await coord.waitForEvent(e=>e.params.content.startsWith('Discuss in its topic\n\nfrom the explorer'));
  assert.equal(bound.params.meta?.from_kind,'human');assert.notEqual(bound.params.meta?.topic,'general');assert.equal(bound.params.meta?.topic_item,item);
  const topics=await ui.request({type:'topic.list'});assert.equal(topics.ok,true);
  assert.equal((topics.value as {topics:Array<{id:string;item:string}>}).topics.find(topic=>topic.item===item)?.id,bound.params.meta?.topic);
});
test('m sends the human text, scope and display id to General through topic.send', {skip}, async t=>{
  const {c,control}=await start(t);await select(c,'T-355');await send(c,'m','Please prioritize this');
  const frames=(await control({requests:true})).requests.filter(f=>f.type==='topic.send');
  assert.equal(frames.length,1);assert.equal(frames[0]?.topic,'general');assert.deepEqual(frames[0]?.to,['coordinator']);
  assert.equal(frames[0]?.text,'Please prioritize this\n\nfrom the explorer · scope R-228 0.1.2 Working with items › E-276 The explorer and the card\nT-355 · task · planned · E-276 The explorer and the card · rank 3550 · Task 355');
  await select(c,'T-355');await send(c,'Vjjm','Please schedule these');
  const selected=(await control({requests:true})).requests.filter(f=>f.type==='topic.send')[1];
  assert.equal(selected?.topic,'general');assert.match(selected?.text ?? '',/3 items selected/);
  assert.deepEqual(selected?.text?.split('\n').filter(line=>line.startsWith('T-')).map(line=>line.split(' · ')[0]),['T-355','T-356','T-357']);
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"),[]);
});
test('card m includes its cursor line; M creates a bound topic then reuses it', {skip}, async t=>{
  const {c,control}=await start(t);await select(c,'T-355');await c.input('<CR>');
  await c.waitScreen(s=>s.includes('M creates T-355'),'card message line');
  assert.equal(await c.lua("local b=require('cland.explorer').card.buf;return vim.api.nvim_buf_get_lines(b,-2,-1,false)[1]"),"m  message the Coordinator in General · M creates T-355's topic");
  const line=await c.lua<string>('return vim.trim(vim.api.nvim_get_current_line())');
  await send(c,'m','Card note');
  let frames=(await control({requests:true})).requests.filter(f=>f.type==='topic.send');
  assert.ok(frames[0]?.text?.endsWith('\ncard line: '+line));
  await send(c,'M','Discuss here');
  const requests=(await control({requests:true})).requests;
  const create=requests.find(f=>f.type==='topic.create');
  assert.equal(create?.item,'T-355');assert.equal(create?.title,'T-355 Task 355');
  frames=requests.filter(f=>f.type==='topic.send');assert.notEqual(frames[1]?.topic,'general');
  await c.waitScreen(s=>s.includes("M in T-355's topic"),'bound card topic');
  await send(c,'M','Continue');
  const final=(await control({requests:true})).requests;
  assert.equal(final.filter(f=>f.type==='topic.create').length,1);
  assert.equal(final.filter(f=>f.type==='topic.send')[2]?.topic,frames[1]?.topic);
});
test('closed and virtual rows refuse M, while Esc and refused sends keep the draft', {skip}, async t=>{
  const {c,control}=await start(t);
  await select(c,'T-358');await c.input('M');
  await c.waitScreen(s=>s.includes('T-358 is closed: a closed item gets no topic; m sends to General'),'closed refusal');
  assert.equal(await c.lua('return vim.b.cland_role'),'explorer');
  await c.input('<Esc><Space><Space>');await c.waitScreen(s=>s.includes('Categories (0)'),'roots');
  await select(c,':categories');await c.input('M');await c.waitScreen(s=>s.includes('this row has no item'),'virtual refusal');
  assert.equal((await control({requests:true})).requests.filter(f=>f.type==='topic.create'||f.type==='topic.send').length,0);
  await c.input(':Cland explorer E-276<CR>');await c.waitScreen(s=>s.includes('Task 355'),'scope restored');await select(c,'T-355');
  await c.input('m');await c.waitScreen(s=>s.includes('rides with it'),'composer');await c.input('Keep this draft<Esc>');
  await c.waitScreen(s=>!s.includes('rides with it'),'closed composer');await c.input('m');await c.waitScreen(s=>s.includes('Keep this draft'),'retained draft');
  await control({set:{send:'refuse'}});await c.input('<CR>');await c.waitScreen(s=>s.includes('not sent')&&s.includes('draft is kept'),'refused send');
  await c.input('m');await c.waitScreen(s=>s.includes('Keep this draft'),'draft after refusal');await c.input('<Esc>');
});
test('V selections go to General for both keys, skip stage labels and retain selection drafts', {skip}, async t=>{
  const stages=[{name:'first',state:'open',items:['T-355'],qa:{scope:'none',when:'after-stage'}},{name:'second',state:'open',items:['T-356','T-357','T-358'],qa:{scope:'none',when:'after-stage'}}];
  const scenario:Scenario={...fixture,items:fixture.items!.map(it=>it.id==='E-276'?{...it,stages,plan:{stages:stages.map(s=>({...s,lanes:[s.items]}))}}:it)};
  const {c,control}=await start(t,scenario);await select(c,'T-355');await c.input('V3jm');await c.waitScreen(s=>s.includes('3 items selected'),'selection context');
  await c.input('Please schedule these<Esc>');await c.waitScreen(s=>!s.includes('rides with it'),'close draft');
  await select(c,'T-355');await c.input('V3jM');await c.waitScreen(s=>s.includes('Please schedule these'),'selection draft');
  await c.input('<CR>');await c.waitScreen(s=>s.includes('sent to the Coordinator in General'),'selection sent');
  const frames=(await control({requests:true})).requests;
  assert.equal(frames.filter(f=>f.type==='topic.create').length,0);
  const frame=frames.find(f=>f.type==='topic.send');assert.equal(frame?.topic,'general');
  assert.equal(frame?.text,'Please schedule these\n\nfrom the explorer · scope R-228 0.1.2 Working with items › E-276 The explorer and the card · 3 items selected\nT-355 · task · planned · E-276 The explorer and the card · rank 3550 · Task 355\nT-356 · task · planned · E-276 The explorer and the card · rank 3560 · Task 356\nT-357 · task · planned · E-276 The explorer and the card · rank 3570 · Task 357');
});
test('a 300-row selection keeps whole item lines and cuts remaining ids within 8192 UTF-8 bytes', {skip}, async t=>{
  const scenario:Scenario={...fixture,items:[...fixture.items!.slice(0,2),...Array.from({length:300},(_,i)=>task(355+i,{title:'Task '+(355+i)+' — '+ '界'.repeat(70)}))]};
  const {c,control}=await start(t,scenario);await select(c,'T-355');await send(c,'V299jm','Batch note');
  const frame=(await control({requests:true})).requests.find(f=>f.type==='topic.send');const text=frame?.text ?? '';
  assert.ok(Buffer.byteLength(text)<=8192);assert.match(text,/300 items selected/);assert.match(text,/… and \d+ more: T-\d+/);assert.ok(!text.includes('�'));
  const lines=text.split('\n').filter(l=>l.startsWith('T-'));assert.ok(lines.length>0&&lines.length<300);assert.ok(lines.every(l=>l.endsWith('界'.repeat(70))));
  assert.match(text,new RegExp(`… and ${300-lines.length} more:`));
});
test('Shift-Enter sends multiple lines, q keeps a normal-mode draft, and disconnection keeps unsent text', {skip}, async t=>{
  const {c,control}=await start(t);await select(c,'T-355');
  await send(c,'m','First line<S-CR>Second line');
  assert.ok((await control({requests:true})).requests.find(f=>f.type==='topic.send')?.text?.startsWith('First line\nSecond line\n\nfrom the explorer'));
  await c.input('m');await c.waitScreen(s=>s.includes('rides with it'),'composer');await c.input('Unsent draft');
  // Ctrl-\\ Ctrl-N is Neovim's native return to Normal without the composer's Esc action.
  await c.input('<C-\\><C-n>q');await c.waitScreen(s=>!s.includes('rides with it'),'q closed composer');
  await c.input('m');await c.waitScreen(s=>s.includes('Unsent draft'),'q draft retained');
  await control({exit:true});
  await c.lua("assert(vim.wait(1000,function() return not require('cland').client:connected() end),'stub disconnected')");
  await c.input('<CR>');await c.waitScreen(s=>s.includes('hub is not connected; the draft is kept'),'disconnected draft');
  await c.input('m');await c.waitScreen(s=>s.includes('Unsent draft'),'draft after disconnect');
});
test('selection context uses derived container status and plain parent titles, skipping virtual roots', {skip}, async t=>{
  const scenario:Scenario={...fixture,items:fixture.items!.map(it=>it.id==='T-355'?{...it,status:'in progress'}:it)};
  const {c,control}=await start(t,scenario);await c.input('<Space><Space>');await c.waitScreen(s=>s.includes('Categories (0)'),'root scope');
  await select(c,'E-276');await send(c,'V3jM','Look at this scope');
  const frame=(await control({requests:true})).requests.find(f=>f.type==='topic.send');
  assert.equal(frame?.topic,'general');assert.equal(frame?.text,'Look at this scope\n\nfrom the explorer · scope R-228 0.1.2 Working with items · 1 item selected\nE-276 · epic · in work · R-228 Working with items · rank 2760 · The explorer and the card');
});
test('new topic titles stop at the hub cap without splitting emoji', {skip}, async t=>{
  const title='😀'.repeat(110);const scenario:Scenario={...fixture,items:fixture.items!.map(it=>it.id==='T-355'?{...it,title}:it)};
  const {c,control}=await start(t,scenario);await select(c,'T-355');await send(c,'M','Topic note');
  const frame=(await control({requests:true})).requests.find(f=>f.type==='topic.create');
  assert.equal(frame?.title,'T-355 '+'😀'.repeat(97));assert.equal(frame?.title?.length,200);
});
