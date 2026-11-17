// T2: login list CLI and socket authority through projectHub; no native hosts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/hub/store.ts';
import { layout } from '../src/project.ts';
import { projectHub,tempProject,connectUi,cland,frameClient,inProcessSpoke } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { fakeLockProcesses } from './fakes/lock-processes.ts';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {loginMetadataOwners} from './login-metadata-owners.ts';
import {existsSync} from 'node:fs';
import {ownDirectory} from './process-cleanup.ts';
import {testWaitMs} from './until.ts';
import {fixtureWork} from './fixture-work.ts';
import {within} from '../src/executor/droplet/deadline.ts';

test('recovered one-sign-in hint appears in the card, Agents notice and login list',async t=>{
 const root=await tempProject(t),clock=new FakeClock(Date.now()),owners=loginMetadataOwners(t,root);await mkdir(layout(root).dir,{recursive:true});const store=owners.store(new Store(layout(root).db));
 store.hosts.logins.useClock(clock);
 for(const name of ['first','second']){store.hosts.logins.insert({name,harness:'opencode',account:'shared',kind:'key',lastSignIn:null});store.hosts.logins.transition(name,'ready');store.hosts.logins.markSignedOut(name,{reason:'provider.auth',host:'h'});}
 const episode=store.hosts.logins.get('second')!.signedOut!;
 const hub=await owners.start(()=>projectHub(t,root,{}, {clock,processes:fakeLockProcesses().processes,droplet:{processes:fakeLockProcesses().processes}}));
 const ui=await connectUi(t,hub.discovery,'cli');
 const inbox=(await ui.request({type:'inbox.list'})).value as {asks:{question:string}[]};
 const hint='This account seems to allow one sign-in: set exclusive or add an account.';
 assert.ok(inbox.asks.some(ask=>ask.question.includes('second')&&ask.question.includes(hint)));
 assert.ok(store.message(`login-signed-out:${episode.id}`)!.text.includes(hint));
 const list=await cland(root,'login','list');assert.equal(list.code,0,list.stderr);assert.ok(list.stdout.includes(hint));
});

for(const fault of ['before-hub','hub-drain'] as const)test(`login fixture retains borrowed-store ownership after ${fault} failure`,async t=>{
 const body=fixtureWork(t),events:string[]=[];let fail=true,needsRecovery=false,owners:ReturnType<typeof loginMetadataOwners>|undefined;
 // Register recovery before acquisition, including a failed or late fake start.
 body.release(async()=>{fail=false;if(needsRecovery&&owners){await owners.start(async()=>({stop:async()=>{events.push('hub closed');}}));needsRecovery=false;}});
 await body.run(async work=>{
  const parent=await work.root(()=>tempProject(t));
  // The outer root owns the callback. This inner root exercises the helper's
  // removal guard independently, without asking the body to join itself.
  const {root,remove}=await work.step(async()=>{const root=join(parent,'metadata');await mkdir(root);return {root,remove:ownDirectory(t,root)};});
  owners=await work.acquire(async()=>loginMetadataOwners(t,root),owner=>owner.close());
  const owned=owners;
  owned.store({close:()=>{events.push('store closed');}});
  if(fault==='before-hub'){
   needsRecovery=true;
   await work.step(()=>assert.rejects(owned.start(async()=>{throw Error('planted setup refusal');}),/setup refusal/));
   await work.step(()=>assert.rejects(owned.close(),/root retained/));
  }else{
   const failure=Error('planted hub drain refusal');
   await work.step(()=>owned.start(async()=>({stop:async()=>{events.push('hub stop');if(fail)throw failure;events.push('hub closed');}})));
   await work.step(()=>assert.rejects(owned.close(),error=>error instanceof AggregateError&&error.errors.includes(failure)));
  }
  await work.step(()=>assert.rejects(remove(),/root retained/));
  assert.deepEqual(events,fault==='before-hub'?[]:['hub stop']);assert.ok(existsSync(root));assert.throws(owned.assertReleased,/root retained/);
  fail=false;
  if(needsRecovery){await work.step(()=>owned.start(async()=>({stop:async()=>{events.push('hub closed');}})));needsRecovery=false;}
  await work.step(()=>owned.close());owned.assertReleased();
  assert.deepEqual(events,fault==='before-hub'?['hub closed','store closed']:['hub stop','hub stop','hub closed','store closed']);
  await work.step(remove);assert.equal(existsSync(root),false);
 });
});

test('login fixture closes the Store only after the hub joins and removes its root',{timeout:testWaitMs(2000)},async t=>{
 const body=fixtureWork(t),events:string[]=[],joined=Promise.withResolvers<void>(),stopping=Promise.withResolvers<void>();
 body.release(()=>joined.resolve());
 let root:string|undefined;
 await body.run(async work=>{
  root=await work.root(()=>tempProject(t));
  const owners=await work.acquire(async()=>loginMetadataOwners(t,root!),owner=>owner.close());
  owners.store({close:()=>{events.push('store closed');}});
  await work.step(()=>owners.start(async()=>({stop:async()=>{events.push('hub stop');stopping.resolve();await joined.promise;events.push('hub closed');}})));
  const closing=owners.close();void closing.catch(()=>{});
  await work.step(()=>within(stopping.promise,testWaitMs(2000)));
  assert.deepEqual(events,['hub stop']);assert.ok(existsSync(root));
  joined.resolve();await work.step(()=>closing);
  assert.deepEqual(events,['hub stop','hub closed','store closed']);owners.assertReleased();
 });
 assert.ok(root);assert.equal(existsSync(root),false);
});

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

test('login frames retain session and remote refusals with selective web authority',async t=>{
 const root=await tempProject(t);
 const hub=await projectHub(t,root,{}, {clock:new FakeClock(Date.now()),processes:fakeLockProcesses().processes,droplet:{processes:fakeLockProcesses().processes}});
 for(const edge of ['web','gateway']) {
  let receive=(_line:string)=>{};let open=true;
  const conversation=hub.dispatcher.open({send:frame=>receive(JSON.stringify(frame)+'\n'),close:()=>{open=false;},isOpen:()=>open},{edge,authenticated:true});
  const client=frameClient(line=>conversation.receive(line.trimEnd()),fn=>{receive=fn;},()=>{open=false;conversation.closed();},root);
  t.after(()=>client.close());client.send({type:'hello',protocol:2,client:'cli'});
  await client.waitFor(f=>f.type==='welcome');
  for(const type of ['host.list','login.list','login.remove','login.set','login.snapshot','login.add','login.signin','login.signed-in']){
   const r=await client.request({type,harness:'codex',name:'work',exclusive:false,code:0});
   if(edge==='web'&&['login.list','login.remove','login.snapshot','login.add','login.signin'].includes(type)){
    if(type==='login.list'){assert.equal(r.ok,true);assert.deepEqual(r.value,[]);}
    else {assert.equal(r.ok,false);assert.doesNotMatch(r.error!,/CLI and Neovim/);}
   }else {assert.equal(r.ok,false);assert.match(r.error!,edge==='web'?/CLI and Neovim/:/gateway/);}
  }
  if(edge==='web'){const key=await client.request({type:'login.add',harness:'opencode',kind:'key'});assert.equal(key.ok,false);assert.match(key.error!,/stdin/);}
 }
 const spoke=await inProcessSpoke(t,{cwd:root,discover:true,name:'worker',sessionId:'login-worker',role:'implementer'});
 const result=await spoke.call('session.list',{});assert.ok(result);
 const store=new Store(layout(root).db);const credential='fixture-session-credential';
 try {store.rememberSessionCredential('login-worker',credential);} finally {store.close();}
 const cli=await connectUi(t,hub.discovery,'cli');
 const granted=await cli.request({type:'role.set',session:'worker',role:'implementer'});assert.equal(granted.ok,true,granted.error);
 const actor={name:'worker',sessionId:'login-worker',shell:true,credential};
 const permitted=await cli.request({type:'session.list',as:actor});assert.equal(permitted.ok,true,permitted.error);
 for(const type of ['host.list','login.list','login.remove','login.set','login.snapshot','login.add','login.signed-in']){
  const r=await cli.request({type,harness:'codex',name:'work',exclusive:false,code:0,as:{name:'worker',sessionId:'login-worker',shell:true,credential}});assert.equal(r.ok,false);assert.match(r.error!,/only the human|human CLI/i);
 }
});
