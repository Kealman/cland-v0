// T3: real fake-host agent, existing fake harness binaries and two test messengers.
// Host-create fixture drains hubs, watchdogs, transports and captured writers before roots.
import './cover-quiet.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,writeFile,unlink,open} from 'node:fs/promises';
import {join} from 'node:path';
import {fixture} from './host-create-fixture.ts';
import {testMessenger} from './fakes/messenger.ts';
import {eventually,testWaitMs} from './harness.ts';
import {Store} from '../src/hub/store.ts';
import type {HubCards} from '../src/hub/hub-cards.ts';
import type {HubFrame} from '../src/protocol.ts';
import {FakeHostProvider} from '../src/host/provider/fake.ts';
import {hostDirectory} from '../../shared/fake-host-directory.ts';
import {parseSignInClose} from '../src/host/agent/signin-types.ts';
import {nativeSignInTrace,NATIVE_CARD_INPUT} from './login-card-signin-trace.ts';
import {remoteRedactor} from '../src/remote/redact.ts';

function diagnostic(t:test.TestContext,f:Awaited<ReturnType<typeof fixture>>,store:Store,trace:ReturnType<typeof nativeSignInTrace>){
 let complete=false;const captured:Array<{directory:string;admission:string}>=[];
 f.beforeStop(async()=>{
  if(complete)return;
  const native=await Promise.all(captured.map(async({directory,admission})=>{
   try{const value=JSON.parse(await readFile(join(directory,admission+'.json'),'utf8'));return {admission,code:value.code,signal:value.signal,state:value.state};}
   catch{return {admission,outcome:'native close receipt unavailable'};}
  }));
  let tail='log unavailable';
  try{const file=await open(join(f.root,'.cland/log/hub.log'),'r');try{const info=await file.stat(),bytes=Buffer.alloc(Math.min(3000,info.size));await file.read(bytes,0,bytes.length,Math.max(0,info.size-bytes.length));tail=remoteRedactor([NATIVE_CARD_INPUT]).text(bytes.toString());}finally{await file.close();}}catch{}
  t.diagnostic(JSON.stringify({outcome:'native card integration incomplete',native:trace.diagnostics(),receiptFiles:native,logTail:tail,logins:store.hosts.logins.list().map(row=>({name:row.name,state:row.state}))}));
 });
 return {capture:(directory:string,admission:string)=>captured.push({directory,admission}),complete:()=>{complete=true;}};
}

function messenger(via:'telegram'|'discord'){
 const remote=testMessenger(via,via),frames:HubFrame[]=[],receive=remote.receive.bind(remote);
 remote.receive=frame=>{frames.push(frame);return receive(frame);};return {remote,frames};
}
async function noSentinel(root:string,secret:string){
 let bytes=0,files=0;
 async function scan(directory:string):Promise<string[]>{
  const matches:string[]=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
   const path=join(directory,entry.name);
   if(entry.isDirectory())matches.push(...await scan(path));
   else if(entry.isFile()){
    const content=await readFile(path);bytes+=content.length;
    assert.ok(++files<=10000&&bytes<=128*1024*1024,'bounded retention scan incomplete');
    if(content.includes(Buffer.from(secret)))matches.push(path);
   }
  }
  return matches;
 }
 return scan(root);
}

for(const deletion of [true,false])test(`native Claude card creates and renews one disk across both remotes with ${deletion?'deletion':'one fallback'}`,{timeout:testWaitMs(60000)},async t=>{
 const telegram=messenger('telegram'),discord=messenger('discord');
 const {deleteMessage:_delete,...unsupported}=telegram.remote;
 let cards!:HubCards;
 const trace=nativeSignInTrace();
 const f=await fixture(t,{cardSignIn:{prepareLogin:trace.prepare,gatewayRemotes:[deletion?telegram.remote:unsupported,discord.remote],registerHubCards:value=>{cards=value;}}});
 const store=f.own(new Store(join(f.root,'.cland/hub.db'))),provider=new FakeHostProvider({env:f.env});
 const evidence=diagnostic(t,f,store,trace);
 const secret=NATIVE_CARD_INPUT,control=join(f.root,'retention-control');
 await writeFile(control,secret);assert.deepEqual(await noSentinel(f.root,secret),[control]);await unlink(control);
 const create=cards.raise('login-create','general','Create one?',['Create one','Not now'],false,{pool:'agents',harness:'claude-code'});
 const accepted=await telegram.remote.client.request({type:'topic.answer',ask:create,option:1});assert.equal(accepted.ok,true,accepted.error);
 const code=await eventually('native Claude code card persisted',()=>store.openAsks().find(ask=>ask.hubKind==='login-signin-code'));
 assert.equal(code.secret,true);assert.match(code.question,/https:\/\/login.example.test\/claude/);
 const creating=store.hosts.logins.get('claude-code-1')!;assert.equal(creating.state,'creating');assert.equal(creating.kind,'disk');
 if(creating.kind!=='disk'||!creating.volumeId)throw Error('native creating volume unavailable');
 const volume=creating.volumeId;
 const firstHosts=store.hosts.provisions.list();assert.equal(firstHosts.length,1);const host=firstHosts[0]!;
 assert.ok(host.machine);assert.equal(host.pool,'agents');
 const runs=join(hostDirectory(f.root,host.machine!.id),'home/.cland-host/run/signins');
 const firstAdmission=(code.payload as {admission:string}).admission;
 evidence.capture(runs,firstAdmission);
 const reply=telegram.remote.client.waitFor(frame=>frame.type==='result'&&frame.id==='native-code');
 telegram.remote.upload({type:'topic.answer',id:'native-code',ask:code.id,text:secret},{chatId:'101',messageId:'native-first'},[]);
 assert.equal((await reply).ok,true);
 const ready=await eventually('native Claude ready and one snapshot persisted',()=>{const row=store.hosts.logins.get(creating.name);return row?.state==='ready'&&row.kind==='disk'&&row.snapshotIds.length===1?row:undefined;});
 assert.equal(ready.volumeId,volume);assert.ok(ready.lastSignIn);
 const firstClose=JSON.parse(await readFile(join(runs,firstAdmission+'.json'),'utf8'));
 assert.deepEqual(parseSignInClose(firstClose,firstAdmission),{admission:firstAdmission,state:'closed',code:0,signal:null});
 for(const {frames} of [telegram,discord])await eventually('exact first code card folded on remote',()=>frames.some(frame=>frame.type==='ask'&&frame.ask===code.id&&frame.card.state==='answered')?true:undefined);
 await eventually('native first secret-message effect observed',()=>deletion?telegram.remote.deleted.length===1:telegram.remote.testLines.length===1);
 assert.deepEqual(telegram.remote.deleted,deletion?[{chatId:'101',messageId:'native-first'}]:[]);
 assert.equal(telegram.remote.testLines.length,deletion?0:1);
 const loginPath=join(f.root,'volumes',volume+'.contents/login.json');
 const firstLogin=JSON.parse(await readFile(loginPath,'utf8'));assert.equal(firstLogin.dead,false);
 await writeFile(loginPath,JSON.stringify({...firstLogin,dead:true}));
 store.hosts.logins.markSignedOut(ready.name,{reason:'native test sign-out',host:null});
 const episode=store.hosts.logins.get(ready.name)!.signedOut!.id;
 const renew=cards.raise('login-signin','general','Sign in again?',['Sign in again','Not now'],false,{login:ready.name,episode});
 const renewed=await discord.remote.client.request({type:'topic.answer',ask:renew,option:1});assert.equal(renewed.ok,true,renewed.error);
 const again=await eventually('native renewed code card persisted',()=>store.openAsks().find(ask=>ask.hubKind==='login-signin-code'));
 const secondAdmission=(again.payload as {admission:string}).admission;assert.notEqual(secondAdmission,firstAdmission);
 evidence.capture(runs,secondAdmission);
 const secondReply=discord.remote.client.waitFor(frame=>frame.type==='result'&&frame.id==='native-renew');
 discord.remote.upload({type:'topic.answer',id:'native-renew',ask:again.id,text:secret},{chatId:'202',messageId:'native-second'},[]);assert.equal((await secondReply).ok,true);
 await eventually('native renewed disk ready',()=>store.hosts.logins.get(ready.name)?.state==='ready'?true:undefined);
 assert.equal(store.hosts.logins.get(ready.name)!.kind==='disk'&&(store.hosts.logins.get(ready.name) as typeof ready).volumeId,volume);
 assert.deepEqual(store.hosts.provisions.list().map(row=>row.id),[host.id]);
 assert.equal(JSON.parse(await readFile(loginPath,'utf8')).dead,false);
 assert.equal(parseSignInClose(JSON.parse(await readFile(join(runs,secondAdmission+'.json'),'utf8')),secondAdmission).code,0);
 for(const {remote,frames} of [telegram,discord]){
  await eventually('exact renewed code card folded on remote',()=>frames.some(frame=>frame.type==='ask'&&frame.ask===again.id&&frame.card.state==='answered')?true:undefined);
  const inbox=await remote.client.request({type:'inbox.list'});assert.equal(inbox.ok,true);assert.equal(JSON.stringify(inbox.value).includes(again.id),false);
  assert.equal(JSON.stringify(frames).includes(secret),false);
 }
 await eventually('renewed Discord secret message deleted',()=>discord.remote.deleted.length===1?true:undefined);
 const inventory=await provider.listVolumes({project:f.root});assert.equal(inventory.state,'listed');if(inventory.state==='listed'){assert.equal(inventory.volumes.length,1);assert.equal(inventory.volumes[0]!.attachedTo,null);}
 assert.doesNotMatch(await readFile(join(f.root,'login-calls.jsonl'),'utf8'),/logout/);
 await f.hub.stop();assert.deepEqual(await noSentinel(f.root,secret),[],'no pasted input in any retained fixture file');evidence.complete();
});

test('native Codex card completes device sign-in without an answer',{timeout:testWaitMs(60000)},async t=>{
 const telegram=messenger('telegram');let cards!:HubCards;
 const trace=nativeSignInTrace();
 const f=await fixture(t,{cardSignIn:{prepareLogin:trace.prepare,gatewayRemotes:[telegram.remote],registerHubCards:value=>{cards=value;}}});
 const store=f.own(new Store(join(f.root,'.cland/hub.db')));
 const evidence=diagnostic(t,f,store,trace);
 const create=cards.raise('login-create','general','Create one?',['Create one','Not now'],false,{pool:'agents',harness:'codex'});
 const accepted=await telegram.remote.client.request({type:'topic.answer',ask:create,option:1});assert.equal(accepted.ok,true,accepted.error);
 const ready=await eventually('native Codex ready and snapshot persisted',()=>{const row=store.hosts.logins.get('codex-1');return row?.state==='ready'&&row.kind==='disk'&&row.snapshotIds.length===1?row:undefined;});
 const delivered=await eventually('native Codex link and device code delivered',()=>telegram.frames.find(frame=>frame.type==='message'&&frame.message.text.includes('https://login.example.test/codex')&&frame.message.text.includes('FAKE-1234')));
 assert.equal(delivered.type,'message');if(delivered.type!=='message')throw Error('missing exact Codex card');
 const card=store.ask(delivered.message.id)!;assert.equal(card.hubKind,'login-signin-code');assert.equal(card.secret,false);assert.equal(card.state,'withdrawn');
 const host=store.hosts.provisions.list()[0]!,admission=(card.payload as {admission:string}).admission;
 evidence.capture(join(hostDirectory(f.root,host.machine!.id),'home/.cland-host/run/signins'),admission);
 const close=JSON.parse(await readFile(join(hostDirectory(f.root,host.machine!.id),'home/.cland-host/run/signins',admission+'.json'),'utf8'));
 assert.equal(parseSignInClose(close,admission).code,0);assert.equal(ready.storage?.pool,'agents');assert.ok(ready.volumeId);
 assert.equal(JSON.parse(await readFile(join(f.root,'volumes',ready.volumeId!+'.contents/login.json'),'utf8')).dead,false);
 assert.equal(telegram.remote.deleted.length,0,'device flow needs no pasted answer');
 evidence.complete();
});

test('native cancelled Claude card closes its admitted writer before failed disk completion',{timeout:testWaitMs(60000)},async t=>{
 const telegram=messenger('telegram');let cards!:HubCards;
 const trace=nativeSignInTrace();
 const f=await fixture(t,{cardSignIn:{prepareLogin:trace.prepare,gatewayRemotes:[telegram.remote],registerHubCards:value=>{cards=value;}}});
 const store=f.own(new Store(join(f.root,'.cland/hub.db')));
 const evidence=diagnostic(t,f,store,trace);
 const create=cards.raise('login-create','general','Create one?',['Create one','Not now'],false,{pool:'agents',harness:'claude-code'});
 const accepted=await telegram.remote.client.request({type:'topic.answer',ask:create,option:1});assert.equal(accepted.ok,true,accepted.error);
 const card=await eventually('native cancel code card persisted',()=>store.openAsks().find(ask=>ask.hubKind==='login-signin-code'));
 const admission=(card.payload as {admission:string}).admission,row=store.hosts.logins.get('claude-code-1')!;assert.equal(row.kind,'disk');
 const declined=await telegram.remote.client.request({type:'topic.answer',ask:card.id,declined:true,reason:'Cancel sign-in'});assert.equal(declined.ok,true,declined.error);
 const signedOut=await eventually('native cancellation durable signed-out receipt',()=>{const login=store.hosts.logins.get(row.name);return login?.state==='signed-out'&&login.kind==='disk'?login:undefined;});
 assert.equal(signedOut.volumeId,row.kind==='disk'&&row.volumeId);assert.equal(signedOut.snapshotIds.length,0);
 const host=store.hosts.provisions.list()[0]!;
 evidence.capture(join(hostDirectory(f.root,host.machine!.id),'home/.cland-host/run/signins'),admission);
 const close=JSON.parse(await readFile(join(hostDirectory(f.root,host.machine!.id),'home/.cland-host/run/signins',admission+'.json'),'utf8'));
 assert.equal(parseSignInClose(close,admission).state,'closed');assert.notEqual(close.code,0);
 const inventory=await new FakeHostProvider({env:f.env}).listVolumes({project:f.root});assert.equal(inventory.state,'listed');if(inventory.state==='listed')assert.equal(inventory.volumes[0]!.attachedTo,null);
 evidence.complete();
});
