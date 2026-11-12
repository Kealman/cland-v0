// T2: authenticated web frames and injected sign-in handles; no native processes.
import './cover-quiet.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {projectHub,tempProject,connectUi,flushProjectLogs} from './harness.ts';
import {fakeLockProcesses} from './fakes/lock-processes.ts';
import {FakeClock} from './fake-clock.ts';
import {FakeHostProvider} from '../src/host/provider/fake.ts';
import {Store} from '../src/hub/store.ts';
import {loginCardFixtureOwners} from './login-card-fixture.ts';
import {testMessenger} from './fakes/messenger.ts';
import {authenticatedWeb} from './web-frame-client.ts';
import {until} from './until.ts';
import {defaultConfig,renderConfig} from '../src/init/config.ts';
import type {SignInClose} from '../src/host/host.ts';

async function fixture(t:test.TestContext,harness:'codex'|'claude-code'='codex',users=false){
 const root=await tempProject(t),owners=loginCardFixtureOwners(t,root),clock=new FakeClock(Date.now()),processes=fakeLockProcesses().processes,remote=testMessenger();
 await mkdir(join(root,'.cland'),{recursive:true});await writeFile(join(root,'.cland/config.toml'),'# managed by cland 0.3.2\n'+renderConfig(defaultConfig('Web hosts fixture')));
 const closed=Promise.withResolvers<SignInClose>();let received='',prepares=0;
 const hub=await owners.start(()=>projectHub(t,root,{CLAND_FAKE_HOST_ROOT:root}, {clock,processes,droplet:{processes},gatewayRemotes:[remote],
  prepareLogin:async(o,input)=>{
   prepares++;const name=input.name??'web-login';
   if(!input.signin)o.records.logins.insert({name,harness:input.harness,account:name,kind:'disk',provider:'fake',region:'fake-1',volumeId:'v',snapshotIds:[],lastSignIn:null});
   const admission=input.signin?o.records.logins.beginSignIn(name):null;
   return {plan:{name,host:'fake-host',command:'ssh',args:[]},pending:{name,path:'/cland/auth/'+name,complete:async code=>{
    if(code===0)return admission?o.records.logins.finishSignIn(name,admission,clock.now().toISOString()):o.records.logins.transition(name,'ready');
    o.records.logins.markSignedOut(name,{reason:'fixture closed',host:null});return o.records.logins.get(name)!;
   }}};
  },runLoginSignIn:async(input,output)=>{
   assert.equal(input.host,'fake-host');
   output({admission:'web-run',stream:'stdout',text:harness==='codex'?'https://login.example.test/codex Device code: FAKE-1234\n':'https://login.example.test/claude\n'});
   return {admission:'web-run',closed:closed.promise,write:async text=>{received=text;closed.resolve({admission:'web-run',state:'closed',code:0,signal:null});},cancel:async()=>{const receipt:SignInClose={admission:'web-run',state:'closed',code:null,signal:'SIGTERM'};closed.resolve(receipt);return receipt;}};
  }}));
 const store=owners.store(new Store(join(root,'.cland/hub.db'))),local=await connectUi(t,hub.discovery,'cli');
 await writeFile(join(root,'.cland/config.toml'),'# managed by cland 0.3.2\n'+await readFile(join(root,'.cland/config.toml'),'utf8'));
 if(users){const mode=await local.request({type:'auth.mode',mode:'users'});assert.equal(mode.ok,true,mode.error);}
 const web=await authenticatedWeb(t,local);
 return {root,store,web,local,hub,remote,finish:()=>closed.resolve({admission:'web-run',state:'closed',code:0,signal:null}),received:()=>received,prepares:()=>prepares};
}

for(const harness of ['codex','claude-code'] as const)for(const signin of [false,true])test(`web ${signin?'signin':'add'} ${harness} returns its persisted card before completion`,async t=>{
 const f=await fixture(t,harness);
 if(signin){f.store.hosts.logins.insert({name:'renew',harness,account:'renew',kind:'disk',provider:'fake',region:'fake-1',volumeId:'v',snapshotIds:[],lastSignIn:null});f.store.hosts.logins.markSignedOut('renew',{reason:'fixture signout',host:null});}
 const result=await f.web.request(signin?{type:'login.signin',name:'renew'}:{type:'login.add',pool:'agents',harness});
 assert.equal(result.ok,true,result.error);
 const value=result.value as {name:string;card:string};assert.equal(value.name,signin?'renew':'web-login');
 const card=f.store.ask(value.card)!;assert.equal(card.hubKind,'login-signin-code');assert.match(card.question,/https:\/\/login.example.test/);
 assert.equal(f.store.hosts.logins.get(value.name)?.state,'creating');
 if(harness==='codex')f.finish();
 if(harness==='claude-code'){
  assert.equal((await f.web.request({type:'topic.answer',ask:value.card,text:'SENTINEL-web-code'})).ok,true);
 }
 await until(()=>f.store.hosts.logins.get(value.name)?.state==='ready',{what:'durable ready login'});
 assert.equal(f.prepares(),1);assert.equal(f.received(),harness==='claude-code'?'SENTINEL-web-code\n':'');
 assert.deepEqual((await f.web.request({type:'login.list'})).value,(await f.local.request({type:'login.list'})).value);
});

test('web login reads reach local handlers and forbidden host and key frames name their rule',async t=>{
 const {web,local}=await fixture(t);
 for(const type of ['login.list','login.snapshot','login.remove']){
  const a=await web.request({type,name:'missing'}),b=await local.request({type,name:'missing'});
  assert.equal(a.ok,b.ok);assert.equal(a.error,b.error);assert.deepEqual(a.value,b.value);
 }
 for(const frame of [{type:'login.add',kind:'key',harness:'codex'},...['host.create','host.destroy','host.prepare','host.revoke','login.set','login.signed-in','host.status','host.list'].map(type=>({type,host:'fake-host',name:'missing'}))]){
  const result=await web.request(frame);assert.equal(result.ok,false);assert.match(result.error!,/CLI|Neovim|stdin/);
 }
});

test('users-mode web host actions audit the transport-resolved user in log and journal',async t=>{
 const f=await fixture(t,'codex',true);
 const user=(await f.local.request({type:'user.list'})).value as {users:Array<{id:string}>};
 const types=['login.list','login.snapshot','login.remove','host.stop','login.add','login.signin'];
 for(const type of types)await f.web.request({type,name:'missing',host:'missing',pool:'agents',harness:'codex',userId:'spoof'});
 await flushProjectLogs(t,f.root);
 for(const path of ['log/hub.log','journal.jsonl']){
  const rows=(await readFile(join(f.root,'.cland',path),'utf8')).trim().split('\n').map(line=>JSON.parse(line));
  for(const type of types){const row=rows.findLast(row=>row.event==='audit'&&row.tool===type);assert.ok(row,type);assert.equal(row.userId,user.users[0]!.id);}
 }
});

 test('every host and login frame refuses sessions and messenger ingress',async t=>{
  const f=await fixture(t);
  const launched=await f.local.request({type:'session.launch',name:'worker',role:'implementer',harness:'codex'});assert.equal(launched.ok,true,launched.error);
  const row=(launched.value as {sessionId:string});
  const credential=f.hub.fakes.codex!.spawns.at(-1)!.launchToken!;
  for(const type of ['host.create','host.status','host.stop','host.list','host.prepare','host.destroy','host.revoke','login.list','login.set','login.add','login.signin','login.signed-in','login.snapshot','login.remove']){
   const input={type,host:'missing',name:'missing',harness:'codex',pool:'agents',exclusive:true,code:0};
   for(const client of [f.remote.client,f.local]){
    const result=await client.request({...input,...(client===f.local?{as:{name:'worker',sessionId:row.sessionId,shell:true,credential}}:{})});
    assert.equal(result.ok,false,type);assert.match(result.error!,/forbidden|human|local|permission|authority/i);
   }
  }

 });

 test('web snapshot and removal retain the local success shapes and durable storage receipts',async t=>{
  const f=await fixture(t),provider=new FakeHostProvider({env:f.hub.hostEnvironment});
  const created=await provider.createVolume({project:f.root,name:'disk',region:'fake-1',sizeGiB:1});assert.equal(created.state,'created');if(created.state!=='created')throw Error('fixture volume');
  f.store.hosts.logins.insert({name:'disk',harness:'codex',account:'disk',kind:'disk',provider:'fake',region:'fake-1',volumeId:created.volume.id,snapshotIds:[],lastSignIn:null});f.store.hosts.logins.transition('disk','ready');
  const snap=await f.web.request({type:'login.snapshot',name:'disk'});assert.equal(snap.ok,true,snap.error);
  const row=f.store.hosts.logins.get('disk');assert.ok(row?.kind==='disk');assert.equal(row.snapshotIds.length,1);
  const removed=await f.web.request({type:'login.remove',name:'disk'});assert.equal(removed.ok,true,removed.error);assert.deepEqual(removed.value,{removed:'disk'});
  assert.equal(f.store.hosts.logins.get('disk'),null);assert.deepEqual(await provider.listVolumes({project:f.root}),{state:'listed',volumes:[]});
  assert.equal((await provider.getSnapshot(row.snapshotIds[0]!)).state,'failed');
 });

for(const existing of [true,false])test(`web add projects declared fields with hidden renewal mode: existing ${existing}`,async t=>{
 const f=await fixture(t,'claude-code');
 if(existing){f.store.hosts.logins.insert({name:'projected',harness:'codex',account:'projected',kind:'disk',provider:'fake',region:'fake-1',volumeId:'v',snapshotIds:[],lastSignIn:null});f.store.hosts.logins.markSignedOut('projected',{reason:'fixture signout',host:null});}
 const result=await f.web.request({type:'login.add',harness:'claude-code',pool:'agents',name:'projected',signin:true,unexpected:'discard'});
 if(existing){assert.equal(result.ok,false);assert.equal(f.store.hosts.logins.get('projected')?.state,'signed-out');assert.equal(f.store.hosts.logins.get('projected')?.harness,'codex');return;}
 assert.equal(result.ok,true,result.error);
 const intent=f.store.cardSignIns.page(0,f.store.cardSignIns.through())[0]!;
 assert.deepEqual(intent.input,{harness:'claude-code',pool:'agents',name:'projected'});
 const value=result.value as {card:string};assert.equal((await f.web.request({type:'topic.answer',ask:value.card,text:'SENTINEL-projection-code'})).ok,true);
 await until(()=>f.store.hosts.logins.get('projected')?.state==='ready',{what:'projected add completes as new disk'});
 assert.equal(f.received(),'SENTINEL-projection-code\n');
});
