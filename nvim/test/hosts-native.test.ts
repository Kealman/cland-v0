// T3: fake-provider provisioning and native fake SSH loss reach real Neovim over projectHub.
// Lifecycle: host-create fixture drains hub, SSH, agent and watchdogs; child scope joins Neovim first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from '../../hub/test/host-create-fixture.ts';
import { cland, testWaitMs } from '../../hub/test/harness.ts';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { hostDirectory } from '../../shared/fake-host-directory.ts';
import { controlRequest, hostOwner } from '../../hub/test/fakes/fake-ssh-common.ts';
import { nvimOrSkip, startClient } from './harness.ts';
import { waitInitialSnapshots } from './readiness.ts';
const nvim=await nvimOrSkip(),skip='skip' in nvim?nvim.skip:false,bin='bin' in nvim?nvim.bin:'';
test('fake host tunnel loss renders red within one second and recovery clears the native pool row',{skip,timeout:testWaitMs(60000)},async t=>{
  const f=await fixture(t);
  const created=await cland(f.root,'host','create','agents');assert.equal(created.code,0,created.stderr);
  const record=JSON.parse(created.stdout);assert.equal(record.state,'ready');
  await t.test('rendered host transport receipts',async child=>{
    const c=await startClient(child,bin,f.root,{}, {screenPollMs:10});await waitInitialSnapshots(c);
    await c.lua("vim.api.nvim_set_current_win(require('cland.layout').win.right);vim.api.nvim_win_set_width(0,115)");
    await c.waitScreen(s=>s.includes('agents 1/2 hosts'),'native configured host pool');
    const marks=()=>c.lua<Array<{text:string;group:string}>>(`local b=require('cland.panels').bufs.sessions;local out={};local ls=vim.api.nvim_buf_get_lines(b,0,-1,false)
      for _,m in ipairs(vim.api.nvim_buf_get_extmarks(b,vim.api.nvim_create_namespace('cland.panels'),0,-1,{details=true})) do out[#out+1]={text=ls[m[2]+1]:sub(m[3]+1,m[4].end_col),group=m[4].hl_group} end;return out`);
    const directory=hostDirectory(f.root,record.machine.address);
    const master=JSON.parse(await readFile(join(directory,'master-control'),'utf8'));
    const owner=await hostOwner(directory);
    const red=c.waitScreen(s=>s.includes(record.id+' unreachable'),'native host outage',1000);void red.catch(()=>{});
    await writeFile(join(directory,'gone'),'fixture outage');
    await controlRequest(master.control,{operation:'kill-master',forwards:[],owner,token:master.token});
    await red;
    assert.ok((await marks()).some(m=>m.text.includes(record.id+' unreachable')&&m.group==='ClandRed'));
    const healthy=c.waitScreen(s=>s.includes('agents 1/2 hosts')&&!s.includes(record.id+' unreachable'),'native recovery',testWaitMs(15000));void healthy.catch(()=>{});
    await unlink(join(directory,'gone'));await healthy;
    assert.ok((await marks()).some(m=>m.text.includes('agents')&&m.group==='ClandDim'));
  });
});
