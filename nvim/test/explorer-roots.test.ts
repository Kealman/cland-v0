// T3: real hub category summary and ranked child delivery.
// Screen permutations live in explorer-roots-component.test.ts; workbench owns the shared real-hub flow.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, startDaemon, tempProject } from '../../hub/test/harness.ts';
import { nvimOrSkip, startClient, type Client } from './harness.ts';
import { waitInitialSnapshots } from './readiness.ts';

const nvim = await nvimOrSkip();

const skip = 'skip' in nvim ? nvim.skip : false;

const bin = 'bin' in nvim ? nvim.bin : '';

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
  const c=await startClient(t,bin,root,{}, {centre:'explorer'});await c.rpc.request('nvim_ui_try_resize',200,50);await waitInitialSnapshots(c);
  await c.input('<Esc><Space>e');await c.waitScreen(s=>s.includes('Categories (1) · 5 open'),'real category summary');
  await select(c,':categories');await c.input('l');
  await c.waitScreen(s=>s.includes('Ranked debt 1')&&s.includes('Ranked debt 3')&&s.includes('2 more')&&!s.includes('Ranked debt 4'),'real top three');
  await select(c,`:more:${category}`);await c.input('l');await c.waitScreen(s=>s.includes('Ranked debt 5'),'real more unfolded');
});

async function select(c:Client,key:string) {
  await c.lua("local key=...;local e=require('cland.explorer');vim.api.nvim_set_current_win(e.tree_win());for r,row in ipairs(e.rows) do if row.key==key then vim.api.nvim_win_set_cursor(e.tree_win(),{r,0});return end end;error('missing '..key)",key);
}
