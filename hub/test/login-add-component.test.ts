// T2: projectHub socket ownership and failure routing with an injected sign-in runner.
import test from 'node:test';
import assert from 'node:assert/strict';
import { projectHub, tempProject, connectUi, eventually, testWaitMs } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { fakeLockProcesses } from './fakes/lock-processes.ts';
import { createHubBase } from '../src/hub/server.ts';
import { Store } from '../src/hub/store.ts';
import { Suites } from '../src/hub/suites.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { parseConfig } from '../src/init/config.ts';
import { frameClient, type FrameClient } from './harness.ts';
import { onCleanup } from './process-cleanup.ts';
import { join } from 'node:path';

for(const outcome of ['disconnect','failure','success'] as const) test(`login add ${outcome} settles only its admitted connection`,async t=>{
 const root=await tempProject(t);let closed=0;
 const hub=await projectHub(t,root,{}, {clock:new FakeClock(Date.now()),processes:fakeLockProcesses().processes,droplet:{processes:fakeLockProcesses().processes},prepareLogin:async o=>{
  o.records.logins.insert({name:'work',harness:'codex',account:'work',kind:'disk',provider:'fake',region:'fake-1',volumeId:'volume-sentinel',snapshotIds:[],lastSignIn:null});
  let complete:Promise<import('../src/host/logins.ts').Login>|undefined;
  return {plan:{name:'work',host:'host-a',command:'ssh',args:['-t','host-a','codex login --device-auth']},pending:{name:'work',path:'/cland/auth/codex-work',complete:code=>complete??=Promise.resolve().then(()=>{closed++;if(code===0)return o.records.logins.transition('work','ready');o.records.logins.markSignedOut('work',{reason:'sign-in failed',host:null});return o.records.logins.get('work')!;})}};
 }});
 const terminal=await connectUi(t,hub.discovery,'cli'),observer=await connectUi(t,hub.discovery,'cli');
 const add=await terminal.request({type:'login.add',harness:'codex'});assert.equal(add.ok,true,add.error);
 const during=await observer.request({type:'login.list'});const row=(during.value as any[])[0];assert.equal(row.state,'creating');assert.deepEqual(row.bindings,[]);
 const forged=await observer.request({type:'login.signed-in',name:'work',code:0});assert.equal(forged.ok,false);assert.equal(closed,0);
 if(outcome==='disconnect')terminal.close();
 else {const completed=await terminal.request({type:'login.signed-in',name:'work',code:outcome==='success'?0:7});assert.equal(completed.ok,true,completed.error);}
 const rows=await eventually('sign-in terminal outcome persisted',async()=>{
  const result=await observer.request({type:'login.list'});const rows=result.value as any[];
  return rows[0]?.state===(outcome==='success'?'ready':'signed-out')?rows:undefined;
 },testWaitMs());
 assert.equal(rows[0].volumeId,'volume-sentinel');assert.deepEqual(rows[0].bindings,[]);assert.equal(closed,1);
});

test('login add preparation failure reaches CLI without a terminal plan',async t=>{
 const root=await tempProject(t);
 const hub=await projectHub(t,root,{}, {clock:new FakeClock(Date.now()),processes:fakeLockProcesses().processes,droplet:{processes:fakeLockProcesses().processes},prepareLogin:async()=>{throw Error('sentinel preparation refused');}});
 const ui=await connectUi(t,hub.discovery,'cli');
 const result=await ui.request({type:'login.add',harness:'codex'});assert.equal(result.ok,false);assert.match(result.error!,/sentinel preparation refused/);
});

test('dispatcher shutdown joins every login closer and still closes the suite owner after failure',async t=>{
 const root=await tempProject(t),store=new Store(join(root,'hub.db'));
 const events:string[]=[],gate=Promise.withResolvers<void>(),entered=Promise.withResolvers<void>();
 const clients:FrameClient[]=[];
 let base:ReturnType<typeof createHubBase>|undefined;
 onCleanup(t,async()=>{gate.resolve();for(const client of clients)client.close();if(base)await base.close();else store.close();});
 t.mock.method(Suites.prototype,'close',async()=>{events.push('suite closed');});
 base=createHubBase({store,clock:new FakeClock(Date.now()),secret:'sentinel',env:fixtureEnvironment(root,process.env),projectConfig:()=>parseConfig('','fixture',fixtureEnvironment(root,process.env)),control:{status:()=>({root}),stop:async()=>{}} as unknown as import('../src/hub/dispatch.ts').Control,prepareLogin:async(o,input)=>{
  const name=input.name!;o.records.logins.insert({name,harness:'codex',account:name,kind:'disk',provider:'fake',region:'fake-1',volumeId:null,snapshotIds:[],lastSignIn:null});
  return {plan:{name,host:'host-a',command:'ssh',args:[]},pending:{name,path:'/cland/auth/codex-'+name,complete:async()=>{
   if(name==='second'){entered.resolve();await gate.promise;}
   events.push(name+' closed');throw Error(name+' native cleanup failed');
  }}};
 }});
 base.dispatcher.hostOwner={hosts:[]} as unknown as NonNullable<typeof base.dispatcher.hostOwner>;
 for(const name of ['first','second']){
  let receive=(_line:string)=>{},open=true;
  const conversation=base.dispatcher.open({send:frame=>receive(JSON.stringify(frame)+'\n'),close:()=>{open=false;},isOpen:()=>open},{edge:'socket',authenticated:true});
  const client=frameClient(line=>conversation.receive(line.trimEnd()),fn=>{receive=fn;},()=>{open=false;conversation.closed();},root);clients.push(client);
  client.send({type:'hello',protocol:2,client:'cli'});await client.waitFor(frame=>frame.type==='welcome');
  const added=await client.request({type:'login.add',harness:'codex',name});assert.equal(added.ok,true,added.error);
 }
 const closing=base.dispatcher.close();void closing.catch(()=>{});
 await entered.promise;gate.resolve();
 await assert.rejects(closing,error=>error instanceof AggregateError&&error.errors.length===2&&error.errors.some(e=>String(e).includes('first native'))&&error.errors.some(e=>String(e).includes('second native')));
 assert.deepEqual(events,['first closed','second closed','suite closed']);
});
