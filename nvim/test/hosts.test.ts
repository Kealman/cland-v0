// T2: recorded hosts.state frames drive isolated headless Neovim and existing fold keys.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startShell, skip } from './shell-fixture.ts';
import { STUB_NOW } from './fixtures/clock.ts';
import type { HostsStatePool } from '../../hub/src/protocol.ts';
const pools: HostsStatePool[] = [{ name:'agents',provider:'fake',region:'fake-1',hostCount:1,maxHosts:4,slotsUsed:2,slotsTotal:8,
  logins:{'claude-code':{inUse:2,usable:3,signedOut:1},codex:{inUse:1,usable:1,signedOut:0},opencode:{inUse:0,usable:2,signedOut:0}},alert:null,
  hosts:[{id:'fake-1',size:'fake-size',region:'fake-1',state:'ready',created:new Date(Date.parse(STUB_NOW)-3600000).toISOString(),sessions:['worker'],priceHourly:0.07,spendToday:0.12}] },
  { name:'spare',provider:'fake',region:'fake-2',hostCount:0,maxHosts:2,slotsUsed:0,slotsTotal:0,logins:{},alert:null,hosts:[] }];
test('Hosts follows Remotes, wraps pool facts, folds with za and clears pushed alerts', {skip}, async t => {
  const c=await startShell(t,s=>{s.accounts=[];s.processes=[];});
  await c.lua("vim.api.nvim_set_current_win(require('cland.layout').win.right);vim.api.nvim_win_set_width(0,115)");
  await c.lua(`local original=os.time;os.time=function(t) if t then return original(t) end return ${Date.parse(STUB_NOW)/1000} end`);
  const lines=()=>c.lua<string[]>("return vim.api.nvim_buf_get_lines(require('cland.panels').bufs.sessions,0,-1,false)");
  assert.ok(!(await lines()).some(l=>l.includes('Hosts')),'previous hub shape');
  await c.control({emit:{type:'remote.state',remotes:[{messenger:'telegram',enabled:true,connection:'connected',pairedName:null,mute:false,outboxDepth:0,lastError:null,offlineSince:null}]}});
  await c.control({emit:{type:'hosts.state',pools}});
  const shown=await c.waitScreen(s=>s.includes('agents 1/4 hosts')&&s.includes('spare 0/2 hosts'),'pool rows',1000);
  assert.ok(shown.indexOf('Remotes')<shown.indexOf('Hosts'));
  assert.match((await lines()).join('\n'),/2\/8 slots.*logins claude 2\/3.*codex 1\/1.*opencode 0\/2/);
  await c.input('<Esc>gg/Hosts<CR>za');
  await c.waitScreen(s=>s.includes('fake-size')&&s.includes('$0.070/h')&&s.includes('$0.120 today'),'expanded host facts',1000);
  assert.match((await lines()).join('\n'),/fake-1.*fake-size.*fake-1.*up 1h 0m.*sessions worker/);
  await c.input('za');
  await c.waitScreen(s=>s.includes('▸ Hosts'),'folded header',1000);
  assert.ok(!(await lines()).some(l=>l.includes('fake-size')));
  const marks=()=>c.lua<Array<{text:string;group:string}>>(`local b=require('cland.panels').bufs.sessions;local out={};local ls=vim.api.nvim_buf_get_lines(b,0,-1,false)
    for _,m in ipairs(vim.api.nvim_buf_get_extmarks(b,vim.api.nvim_create_namespace('cland.panels'),0,-1,{details=true})) do out[#out+1]={text=ls[m[2]+1]:sub(m[3]+1,m[4].end_col),group=m[4].hl_group} end;return out`);
  for(const alert of [{kind:'outage',host:'fake-1',since:STUB_NOW},{kind:'provider',reason:'fake capacity refused'}]) {
    const text=alert.kind==='outage'?'fake-1 unreachable':'fake capacity refused';
    const red=c.waitScreen(s=>s.includes(text),'alerted pool within one second',1000);void red.catch(()=>{});
    await c.control({emit:{type:'hosts.state',pools:[{...pools[0],alert},pools[1]]}});await red;
    assert.ok((await marks()).some(m=>m.text.includes(text)&&m.group==='ClandRed'));
  }
  await c.control({emit:{type:'hosts.state',pools}});
  await c.waitScreen(s=>s.includes('agents 1/4 hosts')&&!s.includes('fake capacity refused'),'recovered pool',1000);
  assert.ok((await marks()).some(m=>m.text.includes('agents')&&m.group==='ClandDim'));
  await c.control({emit:{type:'hosts.state',pools:[]}});
  await c.lua("assert(vim.wait(1000,function() local p=require('cland.panels');local ls=vim.api.nvim_buf_get_lines(p.bufs.sessions,0,-1,false);return #require('cland.state').S.hosts==0 and not table.concat(ls,'\\n'):find('Hosts',1,true) end))");
  assert.ok(!(await lines()).some(l=>l.includes('Hosts')));
});
