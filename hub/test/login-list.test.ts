// T2: login list CLI and socket authority through projectHub; no native hosts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/hub/store.ts';
import { layout } from '../src/project.ts';
import { projectHub,tempProject,connectUi,cland,frameClient,inProcessSpoke } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { fakeLockProcesses } from './fakes/lock-processes.ts';

test('login list text and JSON expose rows and hosts, retained across hub restart',async t=>{
 const root=await tempProject(t);
 const options={clock:new FakeClock(Date.now()),processes:fakeLockProcesses().processes,droplet:{processes:fakeLockProcesses().processes}};
 let hub=await projectHub(t,root,{},options);
 const store=new Store(layout(root).db);
 try {
  store.hosts.logins.insert({name:'work',harness:'codex',account:'work-account',kind:'disk',provider:'fake',region:'fake-1',volumeId:'vol-1',snapshotIds:['snap-1'],lastSignIn:'2026-11-09T00:00:00Z'});
  store.hosts.logins.transition('work','ready');store.hosts.logins.bind('work',{host:'h1',role:'writer',volumeId:'vol-1'});
  store.hosts.logins.insert({name:'key',harness:'opencode',account:'key-account',kind:'key',lastSignIn:null});
 } finally {store.close();}
 const ui=await connectUi(t,hub.discovery,'cli');const before=await ui.request({type:'login.list'});
 assert.equal(before.ok,true,before.error);
 const json=await cland(root,'login','list','--json');assert.equal(json.code,0,json.stderr);assert.deepEqual(JSON.parse(json.stdout),before.value);
 const text=await cland(root,'login','list');assert.equal(text.code,0,text.stderr);
 for(const fact of ['work','codex','work-account','disk','true','in-use h1','fake','fake-1','vol-1','snap-1','2026-11-09T00:00:00Z','key','opencode','key-account','creating'])assert.ok(text.stdout.includes(fact),fact);
 await hub.stop();hub=await projectHub(t,root,{},options);
 const after=await (await connectUi(t,hub.discovery,'nvim')).request({type:'login.list'});assert.equal(after.ok,true,after.error);assert.deepEqual(after.value,before.value);
 const help=await cland(root,'login','--help');assert.equal(help.code,0);assert.match(help.stdout,/login list/);
 const bad=await cland(root,'login','list','--yaml');assert.equal(bad.code,1);assert.match(bad.stderr,/usage/);
});

test('login list refuses session, web and remote edges like host list',async t=>{
 const root=await tempProject(t);
 const hub=await projectHub(t,root,{}, {clock:new FakeClock(Date.now()),processes:fakeLockProcesses().processes,droplet:{processes:fakeLockProcesses().processes}});
 for(const edge of ['web','gateway']) {
  let receive=(_line:string)=>{};let open=true;
  const conversation=hub.dispatcher.open({send:frame=>receive(JSON.stringify(frame)+'\n'),close:()=>{open=false;},isOpen:()=>open},{edge,authenticated:true});
  const client=frameClient(line=>conversation.receive(line.trimEnd()),fn=>{receive=fn;},()=>{open=false;conversation.closed();},root);
  t.after(()=>client.close());client.send({type:'hello',protocol:2,client:'cli'});
  await client.waitFor(f=>f.type==='welcome');
  for(const type of ['host.list','login.list']){const r=await client.request({type});assert.equal(r.ok,false);assert.match(r.error!,edge==='web'?/CLI and Neovim/:/gateway/);}
 }
 const spoke=await inProcessSpoke(t,{cwd:root,discover:true,name:'worker',sessionId:'login-worker',role:'implementer'});
 const result=await spoke.call('session.list',{});assert.ok(result);
 const store=new Store(layout(root).db);const credential='fixture-session-credential';
 try {store.rememberSessionCredential('login-worker',credential);} finally {store.close();}
 const cli=await connectUi(t,hub.discovery,'cli');
 const granted=await cli.request({type:'role.set',session:'worker',role:'implementer'});assert.equal(granted.ok,true,granted.error);
 const actor={name:'worker',sessionId:'login-worker',shell:true,credential};
 const permitted=await cli.request({type:'session.list',as:actor});assert.equal(permitted.ok,true,permitted.error);
 for(const type of ['host.list','login.list']){
  const r=await cli.request({type,as:{name:'worker',sessionId:'login-worker',shell:true,credential}});assert.equal(r.ok,false);assert.match(r.error!,/only the human|human CLI/i);
 }
});
