// T3: real hub parsed item body delivered to the explorer card.
// Screen permutations live in explorer-card-component.test.ts; workbench owns the shared real-hub flow.
import test from 'node:test';
import assert from 'node:assert/strict';
import { connectUi, startDaemon, tempProject } from '../../hub/test/harness.ts';
import { nvimOrSkip, startClient, type Client } from './harness.ts';
import { waitInitialSnapshots } from './readiness.ts';

const nvim = await nvimOrSkip();

const skip = 'skip' in nvim ? nvim.skip : false;

const bin = 'bin' in nvim ? nvim.bin : '';

async function card(c: Client) {
  return c.lua<string>("local b=require('cland.explorer').card.buf; return b and table.concat(vim.api.nvim_buf_get_lines(b,0,-1,false),'\\n') or ''");
}

async function select(c:Client,key:string) {
  await c.lua("local key=...; local e=require('cland.explorer'); for r,row in ipairs(e.rows) do if row.key==key then vim.api.nvim_win_set_cursor(e.tree_win(),{r,0}); return end end; error('missing row '..key)",key);
}

async function shown(c:Client,id:string,text:string) {
  await c.lua("local id,text=...; local e=require('cland.explorer'); assert(vim.wait(5000,function() return e.card.key==id and e.card.lines and table.concat(e.card.lines,'\\n'):find(text,1,true)~=nil end),'card '..id..' expects '..text..'\\n'..table.concat(e.card.lines or {},'\\n'))",id,text);
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
  const c=await startClient(t,bin,root,{}, {centre:'explorer'}); await c.rpc.request('nvim_ui_try_resize',200,50); await waitInitialSnapshots(c);
  await c.input('<Esc><Space>e'); await c.waitScreen(s=>s.includes('Explorer'),'explorer');
  await c.input('zR'); await c.waitScreen(s=>s.split('\n').some(line=>line.trimStart().startsWith('○ '+id+' Show human summary')),'expanded task row'); await select(c,id); await shown(c,id,'human picture.');
  await c.waitScreen(s=>s.includes('CARD')&&s.includes('human picture.'),'card screen');
  assert.ok(!(await card(c)).includes('Do not draw this body'));
  const cursor=await c.lua("return vim.api.nvim_win_get_cursor(require('cland.explorer').tree_win())");
  const winbar=await c.lua<string>("local e=require('cland.explorer'); return vim.api.nvim_eval_statusline(e.card_winbar(e.card.win),{winid=e.card.win,maxwidth=vim.api.nvim_win_get_width(e.card.win),use_winbar=true}).str");
  assert.ok(winbar.includes('CARD')&&winbar.includes(id)&&winbar.includes('task')&&winbar.includes('backlog'),'card header preserves item identity');
  for(const key of ['↵','h','zb','gt','gs','gp']) assert.ok(winbar.includes(key),'card header key '+key);
  await c.input('<CR>'); await c.lua("assert(vim.wait(5000,function() return vim.b.cland_role=='card' end),'card focused')"); assert.equal(await c.lua('return vim.b.cland_role'),'card');
  await c.input('jkh'); await c.lua("assert(vim.wait(5000,function() return vim.b.cland_role=='explorer' end),'tree focused')"); assert.equal(await c.lua('return vim.b.cland_role'),'explorer');
  assert.deepEqual(await c.lua("return vim.api.nvim_win_get_cursor(require('cland.explorer').tree_win())"),cursor);
});
