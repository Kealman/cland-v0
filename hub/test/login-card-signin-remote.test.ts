// T2: authenticated gateway secret answers and native message identity; no native processes.
import './cover-quiet.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {projectHub,tempProject} from './harness.ts';
import {FakeClock} from './fake-clock.ts';
import {fakeLockProcesses} from './fakes/lock-processes.ts';
import {testMessenger} from './fakes/messenger.ts';
import {Gateway} from '../src/remote/gateway.ts';
import {remoteRedactor} from '../src/remote/redact.ts';
import type {Conversation} from '../src/hub/dispatch.ts';
import type {Host} from '../src/host/host.ts';
import type {HubCards} from '../src/hub/hub-cards.ts';
import {Store} from '../src/hub/store.ts';
import {join} from 'node:path';
import {TelegramPrompts} from '../src/remote/telegram-prompts.ts';
import type {TelegramOutbox} from '../src/remote/telegram-outbox.ts';
import type {InboxAsk,HubFrame} from '../src/protocol.ts';
import {until} from './until.ts';
import {loginCardFixtureOwners} from './login-card-fixture.ts';

for(const deletion of [true,false])test(`secret card native replay retains message identity with ${deletion?'deletion':'one fallback notice'}`,async t=>{
 let cards!:HubCards;
 const root=await tempProject(t),owners=loginCardFixtureOwners(t,root),clock=new FakeClock(Date.now()),processes=fakeLockProcesses().processes;
 const hub=await owners.start(()=>projectHub(t,root,{}, {clock,processes,droplet:{processes},registerHubCards:service=>{cards=service;}}));
 const store=owners.store(new Store(join(root,'.cland/hub.db')));
 const platform=testMessenger(),{deleteMessage:_delete,...unsupported}=platform,remote=deletion?platform:unsupported,redact=remoteRedactor(),frames:string[]=[];let calls=0,received='';
 let cleanupAtReply:unknown;
 const receive=remote.receive.bind(remote);
 remote.receive=frame=>{if(frame.type==='result'&&frame.id==='first'&&frame.ok){const identity='remote-'+createHash('sha256').update(JSON.stringify(['telegram','101','native-one'])).digest('hex');cleanupAtReply=store.remotes.forMessenger('telegram').secretAnswerCleanup(identity);}return receive(frame);};
 const gateway=owners.gateway(new Gateway({open:(peer,transport)=>{
  const conversation=hub.dispatcher.open(peer,transport);
  return {...conversation,receive:(...args:Parameters<Conversation['receive']>)=>{frames.push(args[0]);conversation.receive(...args);}};
 }},[remote],{redact,secretCard:id=>cards.isSecret(id),secretAnswers:store.remotes,clock}));
 await gateway.start();
 const secret='SENTINEL-card-code';
 cards.onAnswer('test-secret',(_payload,answer)=>{calls++;received=answer;redact.register([answer]);return 'Read';});
 const id=cards.raise('test-secret','general','Paste code',[],true,null,true);
 const ingress={chatId:'101',messageId:'native-one'};
 for(const request of ['first','replay']){
  const result=remote.client.waitFor(f=>f.type==='result'&&f.id===request);
  remote.upload({type:'topic.answer',id:request,ask:id,text:secret},ingress,[]);
  assert.equal((await result).ok,true);
 }
 assert.equal(received,secret);received='';assert.equal(calls,1);
 assert.deepEqual((cleanupAtReply as {ingress:unknown}).ingress,ingress,'cleanup ingress is durable before the success reply');
 assert.equal(frames.join('\n').includes(secret),false);
 const identity='remote-'+createHash('sha256').update(JSON.stringify(['telegram','101','native-one'])).digest('hex');
 const receipt=store.remotes.forMessenger('telegram').get('gateway.answer:'+identity)!;
 assert.ok(receipt);assert.equal(receipt.includes(secret),false);assert.equal(receipt.includes(createHash('sha256').update(secret).digest('hex')),false);
 const distinct=remote.client.waitFor(f=>f.type==='result'&&f.id==='distinct');
 remote.upload({type:'topic.answer',id:'distinct',ask:id,text:secret},{...ingress,messageId:'native-two'},[]);
 assert.equal((await distinct).ok,false);assert.equal(calls,1);
 await until(()=>store.remotes.forMessenger('telegram').get('gateway.secret-answer:'+identity)==='done',{what:'cleanup completion before native identity replay'});
 const changedActor=remote.client.waitFor(f=>f.type==='result'&&f.id==='changed-native-actor');
 remote.upload({type:'topic.answer',id:'changed-native-actor',ask:id,text:secret},{...ingress,messengerUserId:'different-native-user'},[]);
 assert.equal((await changedActor).ok,false,'native ingress identity remains pinned after cleanup completion');
 let ordinary='';cards.onAnswer('ordinary',(_payload,answer)=>{ordinary=answer;return 'Read';});
 const normal=cards.raise('ordinary','general','Ordinary question',[],true,null);
 const ordinaryResult=remote.client.waitFor(f=>f.type==='result'&&f.id==='ordinary');
 remote.upload({type:'topic.answer',id:'ordinary',ask:normal,text:secret},{...ingress,messageId:'native-three'},[]);
 assert.equal((await ordinaryResult).ok,true);assert.equal(ordinary,'[redacted]','non-secret handlers never receive the raw side channel');
 await gateway.stop();assert.deepEqual(remote.deleted,deletion?[ingress]:[]);assert.equal(remote.testLines.length,deletion?0:1);
});

test('acknowledged secret cleanup survives component reopen without another native update',async t=>{
 const root=await tempProject(t),owners=loginCardFixtureOwners(t,root),clock=new FakeClock(Date.now()),processes=fakeLockProcesses().processes;
 let cards!:HubCards;
 const options={clock,processes,droplet:{processes},registerHubCards:(service:HubCards)=>{cards=service;service.onAnswer('reopen',()=> 'Read');}};
 const firstHub=await owners.start(()=>projectHub(t,root,{},options)),firstRemote=testMessenger();owners.store(new Store(join(root,'.cland/hub.db')));
 const first=owners.gateway(new Gateway(firstHub.dispatcher,[firstRemote],{secretCard:id=>cards.isSecret(id),clock}));await first.start();
 const ask=cards.raise('reopen','general','Paste code',[],true,null,true),ingress={chatId:'101',messageId:'native-reopen'};
 const result=firstRemote.client.waitFor(frame=>frame.type==='result'&&frame.id==='accepted');
 firstRemote.upload({type:'topic.answer',id:'accepted',ask,text:'SENTINEL-first-delivery'},ingress,[]);assert.equal((await result).ok,true);
 assert.equal(firstRemote.deleted.length,0,'no cleanup worker in the first component');
 await owners.close();
 const secondHub=await owners.start(()=>projectHub(t,root,{},options)),secondStore=owners.store(new Store(join(root,'.cland/hub.db'))),secondRemote=testMessenger();
 const second=owners.gateway(new Gateway(secondHub.dispatcher,[secondRemote],{secretCard:id=>cards.isSecret(id),secretAnswers:secondStore.remotes,clock}));await second.start();
 await until(()=>secondRemote.deleted.length===1,{what:'startup cleanup without update replay'});
 assert.deepEqual(secondRemote.deleted,[ingress]);
 const identity='remote-'+createHash('sha256').update(JSON.stringify(['telegram','101','native-reopen'])).digest('hex');
 await until(()=>secondStore.remotes.forMessenger('telegram').get('gateway.secret-answer:'+identity)==='done',{what:'durable reopened cleanup receipt'});
 assert.equal(secondStore.remotes.forMessenger('telegram').secretAnswerCleanup(identity),null);
});

for(const binding of ['injected','Host.signIn'])test(binding==='injected'?'test messenger signs a disk in again through the shared injected preparation entry':'test messenger signs a disk in again through the default Host.signIn operation',async t=>{
 const root=await tempProject(t),owners=loginCardFixtureOwners(t,root),clock=new FakeClock(Date.now()),remote=testMessenger();let cards!:HubCards,received='',prepares=0;
 const closed=Promise.withResolvers<{admission:string;state:'closed';code:0;signal:null}>();
 const start:NonNullable<Host['signIn']>=async(input,output)=>{
   assert.equal(input.path,'/cland/auth/claude-code-renew');
   output({admission:'a',stream:'stdout',text:'https://login.example.test/claude\n'});
   return {admission:'a',closed:closed.promise,write:async text=>{received=text;closed.resolve({admission:'a',state:'closed',code:0,signal:null});},cancel:async()=>{throw Error('unexpected cancel');}};
 };
 const hub=await owners.start(()=>projectHub(t,root,{}, {clock,processes:fakeLockProcesses().processes,droplet:{processes:fakeLockProcesses().processes},gatewayRemotes:[remote],registerHubCards:service=>{cards=service;},
  prepareLogin:async(o,input)=>{
   prepares++;assert.equal(input.signin,true);assert.equal(input.name,'renew');
   const admission=o.records.logins.beginSignIn('renew');
   return {nativeHost:{name:'h',signIn:start} as Host,plan:{name:'renew',host:'h',command:'ssh',args:[]},pending:{name:'renew',path:'/cland/auth/claude-code-renew',complete:async code=>{assert.equal(code,0);return o.records.logins.finishSignIn('renew',admission,clock.now().toISOString());}}};
  },...(binding==='injected'?{runLoginSignIn:async(input,output)=>{assert.equal(input.host,'h');return start(input,output);}}:{})}));
 hub.hostOwner!.hosts.push({name:'h',signIn:async()=>{throw Error('display-name lookup must not replace the captured Host');}} as unknown as Host);
 const store=owners.store(new Store(join(root,'.cland/hub.db')));
 store.hosts.logins.insert({name:'renew',harness:'claude-code',account:'renew',kind:'disk',provider:'fake',region:'fake-1',volumeId:'same-volume',snapshotIds:[],lastSignIn:null});
 store.hosts.logins.markSignedOut('renew',{reason:'fixture signed out',host:null});
 const episode=store.hosts.logins.get('renew')!.signedOut!.id;
 const id=cards.raise('login-signin','general','Sign in again?',['Sign in again','Not now'],false,{login:'renew',episode});
 assert.equal((await remote.client.request({type:'topic.answer',ask:id,option:1})).ok,true);
 let code:InboxAsk|undefined;
 await until(async()=>{const result=await remote.client.request({type:'inbox.list'});code=(result.value as {asks:InboxAsk[]}).asks.find(ask=>ask.secret);return !!code;},{what:'injected code card on messenger'});
 assert.match(code!.question,/https:\/\/login.example.test\/claude/,'the messenger receives the sign-in link');
 const result=remote.client.waitFor(f=>f.type==='result'&&f.id==='code');
 remote.upload({type:'topic.answer',id:'code',ask:code!.id,text:'SENTINEL-injected-code'},{chatId:'101',messageId:'pasted-code'},[]);
 assert.equal((await result).ok,true);
 await until(()=>store.hosts.logins.get('renew')?.state==='ready',{what:'durable injected renewed state'});
 assert.equal(prepares,1);assert.equal(received,'SENTINEL-injected-code\n');
 const row=store.hosts.logins.get('renew')!;assert.equal(row.kind==='disk'&&row.volumeId,'same-volume');
 assert.equal(store.ask(code!.id)!.state,'answered');await hub.stop();assert.equal(remote.deleted.length,1);
});

test('test messenger preserves only the stored sign-in link and masks other URLs and registered bytes',async t=>{
 const root=await tempProject(t),owners=loginCardFixtureOwners(t,root),clock=new FakeClock(Date.now()),remote=testMessenger(),redact=remoteRedactor(['SENTINEL-link-secret']);let cards!:HubCards;
 const processes=fakeLockProcesses().processes;
 const hub=await owners.start(()=>projectHub(t,root,{}, {clock,processes,droplet:{processes},registerHubCards:service=>{cards=service;}}));
 const frames:HubFrame[]=[],receive=remote.receive.bind(remote);remote.receive=frame=>{frames.push(frame);return receive(frame);};
 const gateway=owners.gateway(new Gateway(hub.dispatcher,[remote],{redact,signInLink:id=>cards.signInLink(id)}));await gateway.start();
 const allowed='https://login.example.test/claude',other='https://untrusted.example.test/path';
 const safe=cards.raise('login-signin-code','general',`Sign in: ${allowed} Extra: ${other}`,[],true,{harness:'claude-code',url:allowed},true);
 const secretLink=allowed+'?code=SENTINEL-link-secret';
 const secret=cards.raise('login-signin-code','general',`Sign in: ${secretLink}`,[],true,{harness:'claude-code',url:secretLink},true);
 const ordinary=cards.raise('other-kind','general',`Sign in: ${allowed}`,[],true,{harness:'claude-code',url:allowed});
 const wrongOrigin=cards.raise('login-signin-code','general',`Sign in: ${other}`,[],true,{harness:'claude-code',url:other},true);
 const longer=cards.raise('login-signin-code','general',`Sign in: ${allowed}/different`,[],true,{harness:'claude-code',url:allowed},true);
 const result=await remote.client.request({type:'inbox.list'});assert.equal(result.ok,true);
 const asks=(result.value as {asks:InboxAsk[]}).asks;
 assert.equal(asks.find(ask=>ask.id===safe)!.question,`Sign in: ${allowed} Extra: [redacted]`);
 for(const id of [secret,ordinary,wrongOrigin,longer])assert.equal(asks.find(ask=>ask.id===id)!.question,'Sign in: [redacted]');
 assert.equal(JSON.stringify(asks).includes('SENTINEL-link-secret'),false);
 await until(()=>frames.some(frame=>frame.type==='message'&&frame.message.id===safe),{what:'exact sign-in card message delivered to test messenger'});
 const message=frames.find(frame=>frame.type==='message'&&frame.message.id===safe);assert.equal(message?.type==='message'&&message.message.text,`Sign in: ${allowed} Extra: [redacted]`);
 assert.equal(JSON.stringify(frames).includes(other),false);assert.equal(JSON.stringify(frames).includes('SENTINEL-link-secret'),false);
});

test('card fixture setup failure and failed gateway close keep storage owned until all safe joins settle',async t=>{
 const root=await tempProject(t),owners=loginCardFixtureOwners(t,root),events:string[]=[];
 let refused=true;
 owners.gateway({stop:async()=>{events.push('first');if(refused)throw Error('synthetic close refusal');}});
 owners.gateway({stop:async()=>{events.push('second');}});
 owners.store({close:()=>{events.push('store');}});
 await assert.rejects(async()=>{throw Error('synthetic setup failure after acquisition');},/setup failure/);
 await assert.rejects(owners.close(),/drainage failed/);
 assert.deepEqual(events,['first','second']);assert.throws(owners.assertReleased,/root retained/);
 refused=false;await owners.close();owners.assertReleased();assert.deepEqual(events,['first','second','first','store']);
});

test('Telegram secret prompt checkpoint retains native ingress and drops code text and hash',async t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 const state=store.remotes.forMessenger('telegram'),secret='SENTINEL-telegram-code',at=new Date().toISOString();
 const ask={id:'secret',from:'hub',question:'Paste code',options:[],free:true,secret:true,topic:{id:'general',title:'General'},label:'hub',ts:at,since:at} as InboxAsk;
 let received='';
 const prompts=new TelegramPrompts(state,{send:async()=>{}} as unknown as TelegramOutbox,
  async<T>()=>({asks:[ask]} as T),async(fields,ingress,stored)=>{received=String(fields.text);assert.deepEqual(ingress,{chatId:'101',messageId:'20'});stored();});
 prompts.prepare('press','101',55,ask,'other');
 const update={update_id:1,message:{message_id:20,date:Math.floor(Date.now()/1000),chat:{id:101,type:'private' as const},text:secret}};
 const signal=new AbortController().signal;
 assert.equal(prompts.handler.accepts(update),true);await prompts.handler.handle(update,signal);
 assert.equal(received,secret);received='';
 const receipt=state.get('telegram.answer-input:101:20')!;
 assert.deepEqual(JSON.parse(receipt).input,{field:'text',identity:{chatId:'101',messageId:'20'}});
 assert.equal(receipt.includes(secret),false);assert.equal(receipt.includes(createHash('sha256').update(secret).digest('hex')),false);
 await prompts.handler.handle(update,signal);assert.equal(received,secret);
});
