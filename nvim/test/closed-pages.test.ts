// T3: copied live tracker through production frames and a real headless Neovim.
import test from 'node:test';
import assert from 'node:assert/strict';
import {join,resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {copyStartupTracker} from './startup-budget-support.ts';
import {nvimOrSkip,startClient} from './harness.ts';
import {tempProject,projectHub,connectUi} from '../../hub/test/harness.ts';
import {fixtureEnvironment} from '../../test-support/fixture-environment.ts';
import {serializeItem} from '../../hub/src/tracker/item.ts';

const found=await nvimOrSkip();
const skip='skip' in found?found.skip:false,bin='bin' in found?found.bin:'';

test('copied tracker explorer, board and card render closed children from parent pages', {skip}, async t=>{
  const root=await tempProject(t);
  await copyStartupTracker(resolve(import.meta.dirname,'../../.cland/tasks'),root);
  const at='2026-10-21T12:00:00Z';
  for(const [id,kind,parent,state] of [
    ['R-900001','release',null,'open'],['E-900002','epic','R-900001','open'],
    ...Array.from({length:105},(_,n)=>[`T-${900003+n}`,'task','E-900002','closed']),
  ] as Array<[string,string,string|null,'open'|'closed']>) {
    await writeFile(join(root,`.cland/tasks/${id}-page.md`),serializeItem({
      fm:{id,kind,parent,title:id==='E-900002'?'Paged copied epic':id,state,labels:[],assignee:null,blocked_by:[],topic:null,branch:null,created:at,updated:at,
        ...(kind==='task'?{status:'done' as const,size:'S' as const}:kind==='release'?{version:'99.0.0'}:{})},body:'## Summary\n\nPaged closed child card.',comments:[],
    }));
  }
  const env=fixtureEnvironment(root,process.env);
  for(const key of ['HOME','XDG_CONFIG_HOME','XDG_STATE_HOME','XDG_DATA_HOME','XDG_CACHE_HOME']) await mkdir(env[key]!,{recursive:true});
  const hub=await projectHub(t,root,env);
  const c=await startClient(t,bin,root,env,{centre:'explorer'});
  await c.rpc.request('nvim_ui_try_resize',240,50);
  await c.waitScreen(s=>s.includes('R-377'),'initial copied tracker');
  await c.lua("require('cland.state').S.ui.current_release='R-900001';require('cland.state').changed()");
  await c.waitScreen(s=>/E-900002.*Paged copied epic/.test(s),'copied epic row');
  assert.equal(await c.lua("return require('cland.state').item('T-900107')~=nil"),false);
  await c.lua("require('cland.explorer').set_open('E-900002',true)");
  await c.waitScreen(s=>/T-900107.*T-900107/.test(s),'last paged closed child row');
  const count=await c.lua<number>("local n=0;for _,it in ipairs(require('cland.state').S.items) do if it.parent=='E-900002' and it.kind=='task' then n=n+1 end end;return n");
  assert.equal(count,105);
  const explorer=await c.lua<string>("return table.concat(vim.api.nvim_buf_get_lines(require('cland.explorer').b,0,-1,false),'\\n')");
  assert.match(explorer,/T-900107/);assert.match(explorer,/105\//);
  assert.deepEqual(await c.lua("local n=require('cland.state').item('E-900002').child_counts;return {n.done,n.total}"),[105,105]);
  await c.lua("require('cland.layout').show({kind='board'},{insert=false})");
  await c.waitScreen(s=>{const lines=s.split('\n');const header=lines.findIndex(line=>line.includes('DONE'));return header>=0&&/105/.test(lines[header+1]??'');},'board closed count after page receipt');
  const board=await c.lua<{done:number;count:number}>("local v=require('cland.vboard').compose();return {done=v.done,count=#v.columns.done}");
  assert.equal(board.done,105);assert.equal(board.count,105);
  await c.lua("require('cland.layout').show({kind='explorer',id='E-900002'},{insert=false});require('cland.explorer').set_open('E-900002',true)");
  await c.waitScreen(s=>s.includes('Paged copied epic'),'explorer restored');
  await c.lua("local e=require('cland.explorer');for n,r in ipairs(e.rows) do if r.key=='T-900003' then vim.api.nvim_win_set_cursor(e.tree_win(),{n,0});break end end;e.focus_card()");
  await c.waitScreen(s=>s.includes('Paged closed child card.'),'closed child card body');
  const ui=await connectUi(t,hub.discovery);
  const reopen=c.waitScreen(s=>/T-900003/.test(s)&&s.includes('planned'),'reopened child row');void reopen.catch(()=>{});
  assert.equal((await ui.request({type:'task.edit',item:'T-900003',state:'open',status:'planned'})).ok,true);
  await reopen;
});
