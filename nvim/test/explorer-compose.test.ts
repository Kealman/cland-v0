// T3: Coordinator delivery and real tracker topic binding from explorer text.
// Screen permutations live in explorer-compose-component.test.ts; workbench owns the shared real-hub flow.
import test from 'node:test';
import assert from 'node:assert/strict';
import { connectUi, spawnSpoke, startDaemon, tempProject } from '../../hub/test/harness.ts';
import { nvimOrSkip, startClient, type Client } from './harness.ts';
import { waitInitialSnapshots } from './readiness.ts';

const nvim = await nvimOrSkip();

const skip = 'skip' in nvim ? nvim.skip : false;

const bin = 'bin' in nvim ? nvim.bin : '';

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
  const c=await startClient(t,bin,root,{}, {centre:'explorer'});await c.rpc.request('nvim_ui_try_resize',200,50);await waitInitialSnapshots(c);
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
