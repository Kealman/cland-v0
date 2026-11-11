// T2: native error classification and hub login signal ownership, no children.
import test from 'node:test';
import assert from 'node:assert/strict';
import { deadLoginReason } from '../src/host/login-signals.ts';
import { ClaudeCodeAdapter } from '../src/adapters/claude-code.ts';
import { SessionTracker } from '../src/adapters/opencode/state.ts';
import { tempProject } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { FakeClock } from './fake-clock.ts';
import type { HarnessProcess } from '../src/adapters/contract.ts';
import { LoginSignals } from '../src/host/login-signals.ts';
import { LoginRecords } from '../src/host/logins.ts';
import { DatabaseSync } from 'node:sqlite';
import { lifecycleNotice } from '../src/hub/agents-topic.ts';
import { LoginCards, type SignOutEpisode } from '../src/host/login-cards.ts';
import { HubCore } from '../src/hub/core.ts';
import { Store } from '../src/hub/store.ts';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectHub, connectUi } from './harness.ts';
import { fakeLockProcesses } from './fakes/lock-processes.ts';
import { testHost } from '../src/host/test-host.ts';
import { HostSecretStore } from '../src/host/records.ts';
import { fakeHarness } from './fakes/harness.ts';
import { onCleanup } from './process-cleanup.ts';
import type { AdapterHost } from '../src/adapters/contract.ts';

test('project startup recovers an episode committed before card and notice publication',async t=>{
 const root=await tempProject(t),clock=new FakeClock(Date.now()),processes=fakeLockProcesses().processes;
 const options={clock,processes,droplet:{processes}};
 const first=await projectHub(t,root,{},options);await first.stop();
 const store=new Store(join(root,'.cland/hub.db'));onCleanup(t,()=>store.close());store.hosts.logins.useClock(clock);
 store.hosts.logins.insert({name:'interrupted',harness:'opencode',account:'work',kind:'key',lastSignIn:null});
 store.hosts.logins.markSignedOut('interrupted',{reason:'sign-in failed',host:null});
 const episode=store.hosts.logins.get('interrupted')!.signedOut!;
 const second=await projectHub(t,root,{},options),ui=await connectUi(t,second.discovery,'cli');
 const inbox=(await ui.request({type:'inbox.list'})).value as {asks:Array<{id:string;question:string}>};
 assert.equal(inbox.asks.length,1);assert.equal(inbox.asks[0]!.question,'Login interrupted is signed out. Sign in again?');
 assert.ok(store.message(`login-signed-out:${episode.id}`));
 const id=inbox.asks[0]!.id;await second.stop();
 const third=await projectHub(t,root,{},options),next=await connectUi(t,third.discovery,'cli');
 const recovered=(await next.request({type:'inbox.list'})).value as {asks:Array<{id:string}>};
 assert.deepEqual(recovered.asks.map(ask=>ask.id),[id]);
});

test('notice retention does not republish a still-signed-out episode after restart',async t=>{
 const root=await tempProject(t),path=join(root,'metadata.db'),clock=new FakeClock();
 let store=new Store(path),core=new HubCore({store,clock}),sent=0;
 const episode:SignOutEpisode={id:'retained-episode',at:clock.now().toISOString(),host:'a',reason:'unauthorized'};
 const id=`login-signed-out:${episode.id}`;
 const options={episode:()=>episode,notice:()=>{sent++;core.noticeTo('agents',{id,kind:'login-signed-out',text:'work a unauthorized'});}};
 try {
 store.hosts.logins.insert({name:'work',harness:'opencode',account:'work',kind:'key',lastSignIn:null});store.hosts.logins.markSignedOut('work',{reason:'fixture signed out',host:null});
 new LoginCards(store,core.cards,options).signedOut('work');assert.ok(store.message(id));
 await clock.advance(1001);store.prune(clock.now().getTime(),1000);assert.equal(store.message(id),null);
 store.close();store=new Store(path);core=new HubCore({store,clock});
 new LoginCards(store,core.cards,options).recoverSignedOut([{name:'work'}]);
 assert.equal(sent,1);assert.equal(store.message(id),null);
 }finally{store.close();}
});

test('Not now remains folded for its durable episode after card-owner reconstruction',()=>{
 const store=new Store(':memory:'),core=new HubCore({store,clock:new FakeClock()});
 const episode:SignOutEpisode={id:'declined-episode',at:'2026-11-11T00:00:00Z',host:'a',reason:'provider.auth'};
 try {
 store.hosts.logins.insert({name:'work',harness:'opencode',account:'work',kind:'key',lastSignIn:null});store.hosts.logins.markSignedOut('work',{reason:'fixture signed out',host:null});
 const options={episode:()=>episode};let service=new LoginCards(store,core.cards,options);service.signedOut('work');
 const previous=JSON.parse(store.meta('login-signin-cards')!).work;
 core.cards.answer(store.ask(previous.id)!,'Not now',2,'neovim');
 service=new LoginCards(store,core.cards,options);service.recoverSignedOut([{name:'work'}]);
 assert.deepEqual(JSON.parse(store.meta('login-signin-cards')!).work,previous);
 assert.equal(store.ask(previous.id)!.state,'answered');
 }finally{store.close();}
});

test('signed-out rows missing durable episode identity refuse recovery explicitly',t=>{
 const store=new Store(':memory:'),core=new HubCore({store,clock:new FakeClock()});
 try {
 store.hosts.logins.insert({name:'work',harness:'opencode',account:'work',kind:'key',lastSignIn:null});store.hosts.logins.markSignedOut('work',{reason:'fixture signed out',host:null});
 const get=store.hosts.logins.get.bind(store.hosts.logins);
 t.mock.method(store.hosts.logins,'get',(name:string)=>{const row=get(name);return row?{...row,signedOut:{id:'',at:'2026-11-11T00:00:00Z',reason:'corrupt',host:null}}:row;});
 const cards=new LoginCards(store,core.cards);
 assert.throws(()=>cards.recoverSignedOut([{name:'work'}]),/signed-out episode identity missing/);
 assert.equal(store.meta('login-signin-cards'),null);
 }finally{store.close();}
});

for(const fault of ['before-card','after-card','after-notice'] as const) test(`signed-out reconstruction repairs publication ${fault}`,async t=>{
 const root=await tempProject(t),path=join(root,'metadata.db');
 const episode:SignOutEpisode={id:'fault-episode',at:'2026-11-11T00:00:00Z',host:'a',reason:'unauthorized'};
 const id=`login-signed-out:${episode.id}`;
 let store=new Store(path),core=new HubCore({store,clock:new FakeClock()});
 const notices:string[]=[];
 const options={episode:()=>episode,notice:(name:string,e:SignOutEpisode)=>{
  if(store.message(id))return;
  if(fault==='after-card'&&fail)throw Error('planted notice admission failure');
  core.noticeTo('agents',{id,kind:'login-signed-out',to:['coordinator'],text:`${name} ${e.host} ${e.reason}`});store.afterCommit(()=>{notices.push(id);},error=>{throw error;});
  if(fault==='after-notice'&&fail)throw Error('planted failure after notice receipt');
 }};
 let fail=true;
 try {
 store.hosts.logins.insert({name:'work',harness:'opencode',account:'work',kind:'key',lastSignIn:null});store.hosts.logins.markSignedOut('work',{reason:'fixture signed out',host:null});
 const service=new LoginCards(store,core.cards,options);
 const original=core.cards.raise.bind(core.cards);
 const mock=t.mock.method(core.cards,'raise',(...args:Parameters<typeof original>)=>{if(fault==='before-card'&&fail)throw Error('planted card failure');return original(...args);});
 assert.throws(()=>service.signedOut('work'),/planted/);mock.mock.restore();
 const previous=JSON.parse(store.meta('login-signin-cards')??'{}').work;
 assert.equal(Boolean(previous),fault!=='before-card');
 store.close();store=new Store(path);core=new HubCore({store,clock:new FakeClock()});fail=false;
 const recovered=new LoginCards(store,core.cards,options);
 recovered.recoverSignedOut([{name:'work'}]);recovered.recoverSignedOut([{name:'work'}]);
 const current=JSON.parse(store.meta('login-signin-cards')!).work;
 assert.equal(store.ask(current.id)!.state,'open');assert.equal(current.episode,episode.id);
 if(previous)assert.equal(current.id,previous.id);
 assert.ok(store.message(id));assert.equal(notices.length,1);
 }finally{store.close();}
});

test('rapid same-clock sign-outs replace the old card and keep distinct notice receipts',()=>{
 const store=new Store(':memory:'),core=new HubCore({store,clock:new FakeClock()});
 let episode:SignOutEpisode={id:'episode-one',at:'2026-11-11T00:00:00Z',host:'a',reason:'unauthorized'};
 const options={episode:()=>episode,notice:(name:string,e:SignOutEpisode)=>{const id=`login-signed-out:${e.id}`;if(!store.message(id))core.noticeTo('agents',{id,kind:'login-signed-out',to:['coordinator'],text:`${name} ${e.host} ${e.reason}`});}};
 try {
 const records=store.hosts.logins;
 records.insert({name:'work',harness:'opencode',account:'work',kind:'key',lastSignIn:null});records.markSignedOut('work',{reason:'fixture signed out',host:null});
 const first=new LoginCards(store,core.cards,options);first.signedOut('work');
 const old=JSON.parse(store.meta('login-signin-cards')!).work;
 records.transition('work','creating');records.transition('work','ready');
 // No queued ready observer runs before the next episode; the clock stays fixed.
 records.transition('work','in-use',{host:'a',role:'writer',volumeId:null});records.markSignedOut('work',{reason:'fixture signed out',host:null});
 episode={...episode,id:'episode-two'};first.signedOut('work');
 const current=JSON.parse(store.meta('login-signin-cards')!).work;
 assert.notEqual(current.id,old.id);assert.equal(store.ask(old.id)!.state,'withdrawn');
 assert.equal(current.episode,'episode-two');
 assert.ok(store.message('login-signed-out:episode-one'));assert.ok(store.message('login-signed-out:episode-two'));
 }finally{store.close();}
});

test('hub login-dead callback persists sign-out and routes the next launch away without stopping existing sessions',async t=>{
 const root=await tempProject(t),clock=new FakeClock(Date.now());
 await mkdir(join(root,'.cland'),{recursive:true});
 await writeFile(join(root,'.cland/config.toml'),'[hosts.agents]\nprovider="fake"\nsize="fake"\nregion="fake-1"\nslots=8\n');
 await writeFile(join(root,'.cland/roles.toml'),'[implementer.launch]\npool="agents"\n');
 let boundary!:AdapterHost;
 const host=(name:string)=>({...testHost(name,()=>{}),realpath:async(path:string)=>path,statDirectory:async()=>({refusal:null,identity:null})});
 const adapters:ReturnType<typeof fakeHarness>[]=[];
 const hub=await projectHub(t,root,{}, {clock,processes:fakeLockProcesses().processes,droplet:{processes:fakeLockProcesses().processes},hosts:[host('a'),host('b')],adapters:[h=>{boundary=h;const adapter=fakeHarness('codex',{host:h,clock});const spawn=adapter.spawn.bind(adapter);adapter.spawn=async(...args)=>({...await spawn(...args),host:args[0].host??'local'});adapters.push(adapter);return adapter;}]});
 const store=new Store(join(root,'.cland/hub.db'));onCleanup(t,()=>store.close());
 for(const id of ['a','b']) {
  new HostSecretStore(root,store.hosts,()=>{}).register({id,address:id,user:'fixture',clientKeyPath:'',knownHosts:''});
  store.hosts.provisions.ready({id,pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:clock.now().toISOString(),state:'ready',machine:{id,address:id,architecture:'x86_64',created:clock.now().toISOString()}});
  store.hosts.logins.insert({name:id,harness:'codex',account:id,kind:'disk',provider:'fake',region:'fake-1',volumeId:`v-${id}`,snapshotIds:[],lastSignIn:null});
  store.hosts.logins.transition(id,'ready');store.hosts.logins.bind(id,{host:id,role:'writer',volumeId:`v-${id}`,phase:'settled'});
 }
 const ui=await connectUi(t,hub.discovery,'cli');
 const launch=async(name:string)=>{const reply=await ui.request({type:'session.launch',name,role:'implementer',harness:'codex'});assert.equal(reply.ok,true,reply.error);return (reply.value as {process:HarnessProcess}).process;};
 const first=await launch('first');
 assert.equal(first.host,'a',JSON.stringify(first));
 boundary.loginDead!(first.sessionId,{reason:'unauthorized'});
 assert.equal(store.hosts.logins.get('a')!.state,'signed-out');
 assert.equal(store.hosts.logins.bindings('a')[0]!.host,'a');
 const next=await launch('next');assert.equal(next.host,'b');
 assert.deepEqual(adapters.flatMap(adapter=>adapter.stops),[]);
 const sessions=(await ui.request({type:'session.list'})).value as {processes:HarnessProcess[]};
 assert.equal(sessions.processes.find(row=>row.name==='first')!.status,'running');
});

for(const name of ['work','constructor']) test(`sign-in card for ${name} is once per sign-out, survives reconstruction, and folds on ready`,()=>{
 const store=new Store(':memory:'),core=new HubCore({store,clock:new FakeClock()});
 try {
 const logins=store.hosts.logins;
 logins.insert({name,harness:'opencode',account:'work',kind:'key',lastSignIn:null});logins.markSignedOut(name,{reason:'fixture signed out',host:null});
 let episode={id:'one',at:'2026-11-11T00:00:00Z',host:'a',reason:'provider.auth'};
 const options={episode:()=>episode};
 let cards=new LoginCards(store,core.cards,options);
 cards.signedOut(name);cards.signedOut(name);
 const first=JSON.parse(store.meta('login-signin-cards')!);
 assert.equal(store.ask(first[name].id)!.question,`Login ${name} is signed out. Sign in again?`);
 assert.deepEqual(store.ask(first[name].id)!.options,['Sign in again','Not now']);
 cards=new LoginCards(store,core.cards,options);cards.signedOut(name);
 assert.deepEqual(JSON.parse(store.meta('login-signin-cards')!),first);
 logins.transition(name,'creating');logins.transition(name,'ready');cards.loginChanged(name);
 assert.equal(store.ask(first[name].id)!.state,'withdrawn');
 assert.deepEqual(JSON.parse(store.meta('login-signin-cards')!),{});
 logins.transition(name,'in-use',{host:'a',role:'writer',volumeId:null});logins.markSignedOut(name,{reason:'fixture signed out',host:null});episode={...episode,id:'two'};cards.signedOut(name);
 assert.notEqual(JSON.parse(store.meta('login-signin-cards')!)[name],first[name]);
 }finally{store.close();}
});

test('reader reports sign out the bound login once and local or unrelated reports do nothing',()=>{
 const db=new DatabaseSync(':memory:'),records=new LoginRecords(db);
 try {
 records.insert({name:'work',harness:'codex',account:'work',kind:'disk',provider:'fake',region:'fake-1',volumeId:'v1',snapshotIds:['s1'],exclusive:false,lastSignIn:null});records.transition('work','ready');
 records.bind('work',{host:'writer',role:'writer',volumeId:'v1'});records.bind('work',{host:'reader',role:'reader',volumeId:'v2'});
 const marks:unknown[]=[],cards:string[]=[];
 const service=new LoginSignals({records,markSignedOut:(...args)=>{marks.push(args);records.markSignedOut(args[0],{reason:'fixture signed out',host:null});},signedOut:name=>cards.push(name)});
 const row={sessionId:'one',host:'reader',harness:'codex',login:'work'} as HarnessProcess;
 service.report({...row,host:'local'},{reason:'unauthorized'});
 service.report({...row,host:'unrelated'},{reason:'unauthorized'});
 service.report({...row,harness:'opencode'},{reason:'provider.auth'});
 assert.deepEqual(marks,[]);
 service.report(row,{reason:'unauthorized'});service.report({...row,sessionId:'two'},{reason:'unauthorized'});
 assert.deepEqual(marks[0],['work',{reason:'unauthorized',host:'reader'}]);assert.deepEqual(cards,['work']);
 const notice=lifecycleNotice({event:'login-signed-out',login:'work',host:'reader',reason:'unauthorized'},name=>name)!;
 assert.equal(notice.kind,'login-signed-out');assert.deepEqual(notice.to,['coordinator']);
 assert.match(notice.text,/work/);assert.match(notice.text,/reader/);assert.match(notice.text,/unauthorized/);
 }finally{db.close();}
});

test('Claude remote hooks report login death; local hooks retain their signed-out latch',async t=>{
 const root=await tempProject(t), hits:unknown[]=[];
 const adapter=new ClaudeCodeAdapter({root,discoveryFile:'',node:process.execPath,cli:'',spoke:'',log:()=>{},signal:()=>{},recordPid:()=>{},exited:()=>{},loginDead:(...args)=>hits.push(args)}, {clock:new FakeClock(),env:fixtureEnvironment(root,process.env)});
 t.after(()=>adapter.close());
 const row={sessionId:'remote-session',name:'remote',host:'pool-host',harness:'claude-code',role:null,model:null,cwd:root,pid:null,harnessId:null,harnessSessionId:null,startedAt:new Date().toISOString(),status:'running',accountEnv:{CLAUDE_CONFIG_DIR:root}} as HarnessProcess;
 for(const error of ['authentication_failed','Login expired','OAuth token revoked','HTTP 401']) adapter.interpret('turn-end',{hook_event_name:'StopFailure',error},row);
 assert.deepEqual(hits.map((h:any)=>h[1].reason),['authentication_failed','Login expired','OAuth token revoked','401']);
 assert.equal(adapter.stateReason(row),null);
 const local={...row,sessionId:'local-session',host:'local'};
 adapter.interpret('turn-end',{hook_event_name:'StopFailure',error:'authentication_failed'},local);
 assert.equal(hits.length,4);
 assert.equal(adapter.stateReason(local),'signed-out');
});

test('OpenCode stream classifies provider.auth only for the owning session',()=>{
 const tracker=new SessionTracker('one');
 assert.deepEqual(tracker.apply({type:'session.execution.failed',data:{sessionID:'other',error:{type:'provider.auth'}}}),{});
 assert.deepEqual(tracker.apply({type:'session.execution.failed',data:{sessionID:'one',error:{type:'provider.auth'}}}).loginDead,{reason:'provider.auth'});
 assert.equal(tracker.apply({type:'session.execution.failed',data:{sessionID:'one',error:{type:'provider.quota'}}}).loginDead,undefined);
});

for (const [harness, error, reason] of [
 ['claude-code', {error:'authentication_failed'}, 'authentication_failed'],
 ['claude-code', {error_details:'Login expired'}, 'Login expired'],
 ['claude-code', {message:'OAuth token revoked'}, 'OAuth token revoked'],
 ['claude-code', {status:401}, '401'],
 ['codex', {message:'refresh_token_reused'}, 'refresh_token_reused'],
 ['codex', {codexErrorInfo:'unauthorized'}, 'unauthorized'],
 ['codex', {httpStatus:401}, '401'],
 ['opencode', {type:'provider.auth'}, 'provider.auth'],
] as const) test(`${harness} classifies dead login ${reason}`, () => {
 assert.equal(deadLoginReason(harness,error),reason);
});

test('ordinary failures, model output and other harness signals are not dead logins',()=>{
 for(const harness of ['claude-code','codex','opencode']) {
  for(const error of [{message:'rate limit 429'}, {status:500}, {output:'Login expired'}, {message:'4012 tokens'}, null])
   assert.equal(deadLoginReason(harness,error),undefined);
 }
 assert.equal(deadLoginReason('codex',{type:'provider.auth'}),undefined);
 assert.equal(deadLoginReason('opencode',{status:401}),undefined);
});
