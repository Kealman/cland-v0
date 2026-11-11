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
import {loginMetadataOwners} from './login-metadata-owners.ts';
import {prepareExistingLoginSignIn,type LoginSignIn} from '../src/host/login-signin.ts';
import type {Host} from '../src/host/host.ts';
import type {HostProvider} from '../src/host/provider/provider.ts';

for(const outcome of ['disconnect','hub stop','interrupt','exit success','exit failure','exit null','disconnect after receipt'] as const)test(`renewal terminal ${outcome} distinguishes native close receipt from owner loss`,async t=>{
 const root=await tempProject(t),owners=loginMetadataOwners(t,root),clock=new FakeClock(Date.now()),processes=fakeLockProcesses().processes,events:string[]=[];
 const volume={id:'v',name:'disk',project:root,region:'fake-1',sizeGiB:1,created:clock.now().toISOString(),attachedTo:'m'},machine={id:'m',address:'fake',architecture:'x86_64' as const,created:volume.created};
 const host={name:'writer',loginDisk:async({op}:{op:string})=>{events.push(op);}} as unknown as Host;
 const snapshotGate=Promise.withResolvers<void>();onCleanup(t,()=>snapshotGate.resolve());
 const provider={listVolumes:async()=>({state:'listed',volumes:[volume]}),snapshotVolume:async()=>{events.push('snapshot');if(outcome==='disconnect after receipt')await snapshotGate.promise;return {state:'snapshotted',snapshot:{id:'s',volumeId:'v',created:clock.now().toISOString()}};}} as unknown as HostProvider;
 let pending:LoginSignIn|undefined;
 const hub=await owners.start(()=>projectHub(t,root,{}, {clock,processes,droplet:{processes},prepareLogin:async o=>{
  pending=await prepareExistingLoginSignIn({logins:o.records.logins,name:'work',host,provider,volume,machine,identity:'writer',clock,snapshots:o.snapshots!,authorize:()=>{}});
  return {pending,plan:{name:'work',host:'writer',command:'ssh',args:[]}};
 }}));
 const store=owners.store(new Store(join(root,'.cland/hub.db'))),r=store.hosts.logins;r.useClock(clock);
 r.insert({name:'work',harness:'codex',account:'work',kind:'disk',provider:'fake',region:'fake-1',volumeId:'v',snapshotIds:[],lastSignIn:null});r.transition('work','ready');r.bind('work',{host:'writer',role:'writer',volumeId:'v'});r.markSignedOut('work',{reason:'unauthorized',host:'writer'});const bindings=r.bindings('work');
 const terminal=await connectUi(t,hub.discovery,'cli'),other=await connectUi(t,hub.discovery,'cli');
 assert.equal((await terminal.request({type:'login.signin',name:'work'})).ok,true);
 assert.equal((await other.request({type:'login.signed-in',name:'work',code:0})).ok,false,'a different connection owns no close receipt');
 assert.equal(r.get('work')?.state,'creating');
 if(outcome==='disconnect after receipt'){
  terminal.send({type:'login.signed-in',id:'native-close-receipt',name:'work',code:0});
  await eventually('close-confirmed renewal admitted its provider snapshot',()=>events.includes('snapshot')||undefined,testWaitMs());
  terminal.close();snapshotGate.resolve();
 }
 else if(outcome==='disconnect')terminal.close();
 else if(outcome==='hub stop')await hub.stop();
 else if(outcome==='interrupt'){
  const interrupt=(pending as LoginSignIn&{interrupt?:()=>Promise<unknown>}).interrupt;assert.ok(interrupt,'renewal owns an interruption path');await interrupt();
  assert.equal((await terminal.request({type:'login.signed-in',name:'work',code:0})).ok,false,'a late frame owns no interrupted entry');
 }else {const result=await terminal.request({type:'login.signed-in',name:'work',code:outcome==='exit success'?0:outcome==='exit null'?null:7});assert.equal(result.ok,true,result.error);}
 const success=outcome==='exit success'||outcome==='disconnect after receipt',expected=success?'in-use':'signed-out';
 await eventually('durable renewal terminal outcome',()=>r.get('work')?.state===expected||undefined,testWaitMs());
 const row=r.get('work')!;assert.deepEqual(r.bindings('work'),bindings);
 if(outcome.startsWith('exit')||success){assert.equal(r.signInFenceReason('work'),'');if(success){assert.ok(row.lastSignIn);assert.deepEqual(events,['freeze','snapshot','thaw']);}else {assert.equal(row.signedOut?.reason,'sign-in failed');assert.ok(r.beginSignIn('work'),'native close permits the next signer');}}
 else {assert.equal(row.signedOut?.reason,'sign-in interrupted');assert.equal(row.signedOut?.host,'writer');assert.throws(()=>r.beginSignIn('work'),/may still be running on host writer/);assert.deepEqual(events,[],'owner loss performs no native cleanup or snapshot');}
});

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
