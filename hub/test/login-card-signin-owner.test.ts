// T2: card answers, real login completion and hub-clock cancellation with an injected interactive runner; no native processes.
import './cover-quiet.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../src/hub/store.ts';
import {HubCore} from '../src/hub/core.ts';
import {LoginCards} from '../src/host/login-cards.ts';
import {LoginCardSignIn} from '../src/host/login-card-signin.ts';
import {prepareLoginSignIn} from '../src/host/login-signin.ts';
import type {Host} from '../src/host/host.ts';
import type {HostProvider,Volume} from '../src/host/provider/provider.ts';
import {FakeClock} from './fake-clock.ts';
import {until} from './until.ts';
import {setImmediate as yieldLoop} from 'node:timers/promises';
import type {SignInRun,SignInClose} from '../src/host/host.ts';

test('a prompt emitted during held native start becomes actionable only with its captured input handle',async t=>{
 const store=new Store(':memory:'),clock=new FakeClock(),core=new HubCore({store,clock}),waits=new LoginCards(store,core.cards);
 const start=Promise.withResolvers<SignInRun>(),closed=Promise.withResolvers<SignInClose>();let outputObserved=false,input='';
 const handle:SignInRun={admission:'held-start',closed:closed.promise,write:async text=>{input=text;closed.resolve({admission:'held-start',state:'closed',code:0,signal:null});},cancel:async()=>{const value:SignInClose={admission:'held-start',state:'closed',code:null,signal:'SIGTERM'};closed.resolve(value);return value;}};
 const owner=new LoginCardSignIn({store,cards:core.cards,clock,registerSecret:()=>{},prepare:async()=>{
  const row=store.hosts.logins.insert({name:'held-login',harness:'claude-code',account:'held-login',kind:'disk',provider:'fake',region:'fake-1',volumeId:'v',snapshotIds:[],lastSignIn:null});
  return {host:'h',pending:{name:row.name,path:'/cland/auth/claude-code-held-login',complete:async code=>{if(code===0)return store.hosts.logins.transition(row.name,'ready');store.hosts.logins.markSignedOut(row.name,{reason:'sign-in failed',host:null});return store.hosts.logins.get(row.name)!;}}};
 },run:async(_input,output)=>{output({admission:'held-start',stream:'stdout',text:'https://login.example.test/claude\n'});outputObserved=true;return start.promise;}});
 let published:string|undefined,answerFailure:unknown;
 const unsubscribe=core.subscribe(event=>{
  if(event.type==='message'&&store.ask(event.message.id)?.hubKind==='login-signin-code'){
   published=event.message.id;
   try{core.cards.answer(store.ask(published)!,'SENTINEL-held-start',undefined,'neovim');}catch(error){answerFailure=error;}
  }
 });
 t.after(async()=>{unsubscribe();start.resolve(handle);closed.resolve({admission:'held-start',state:'closed',code:null,signal:'SIGTERM'});await owner.stop();store.close();});
 waits.reconcile([{pool:'agents',reason:'waiting for a login claude-code'} as never]);
 const create=JSON.parse(store.meta('login-wait-cards')!)[JSON.stringify(['agents','claude-code'])].id;
 core.cards.answer(store.ask(create)!,'Create one',1,'neovim');
 await until(()=>outputObserved,{what:'complete prompt emitted while native start is held'});
 assert.equal(store.openAsks().some(ask=>ask.hubKind==='login-signin-code'),false,'no actionable card before the input handle');
 start.resolve(handle);
 await until(()=>published!==undefined,{what:'card published after captured native input owner'});
 assert.equal(answerFailure,undefined,'the first answer during publication reaches its prearmed input owner');await owner.idle();
 assert.equal(input,'SENTINEL-held-start\n');assert.equal(store.hosts.logins.get('held-login')?.state,'ready');
});

test('Create one offers the Claude link and its secret answer completes one snapshot',async t=>{
 const store=new Store(':memory:'),clock=new FakeClock(),core=new HubCore({store,clock});
 store.hosts.logins.useClock(clock);
 const waits=new LoginCards(store,core.cards);
 const close=Promise.withResolvers<{admission:string;state:'closed';code:number;signal:null}>();
 const inputs:string[]=[],registered:string[]=[];let snapshots=0;
 const volume:Volume={id:'v',project:'/fixture',name:'v',region:'fake-1',sizeGiB:1,created:clock.now().toISOString(),attachedTo:null};
 const provider={createVolume:async()=>({state:'created',volume}),attachVolume:async()=>({state:'attached'}),detachVolume:async()=>({state:'detached'}),snapshotVolume:async()=>{snapshots++;return {state:'snapshotted',snapshot:{id:'s',volumeId:'v',created:clock.now().toISOString()}};}} as unknown as HostProvider;
 const host={name:'h',loginDisk:async()=>{},publishFile:async()=>true} as unknown as Host;
 const owner=new LoginCardSignIn({store,cards:core.cards,clock,registerSecret:text=>registered.push(text),prepare:async input=>({host:'h',pending:await prepareLoginSignIn({logins:store.hosts.logins,provider,host,machine:{id:'m',address:'fake',architecture:'arm64',created:volume.created},project:'/fixture',tag:'fixture',providerName:'fake',region:'fake-1',clock,...input})}),run:async(_input,output)=>{
  output({admission:'a',stream:'stdout',text:'https://login.example.test/claude — paste code:\n'});
  return {admission:'a',closed:close.promise,write:async text=>{inputs.push(text);close.resolve({admission:'a',state:'closed',code:0,signal:null});},cancel:async()=>{throw Error('unexpected cancel');}};
 }});
 t.after(async()=>{await owner.stop();store.close();});
 waits.reconcile([{pool:'agents',reason:'waiting for a login claude-code'} as never]);
 const create=JSON.parse(store.meta('login-wait-cards')!)[JSON.stringify(['agents','claude-code'])].id;
 core.cards.answer(store.ask(create)!,'Create one',1,'neovim');
 let codeCard:string|undefined;
 await until(()=>{codeCard=store.openAsks().find(a=>a.hubKind==='login-signin-code')?.id;return !!codeCard;},{what:'persisted sign-in-code card'});
 const card=store.ask(codeCard!)!;assert.equal(card.secret,true);assert.match(card.question,/https:\/\/login.example.test\/claude/);
 core.cards.answer(card,'SENTINEL-pasted-code',undefined,'neovim');
 await owner.idle();
 assert.deepEqual(inputs,['SENTINEL-pasted-code\n']);assert.deepEqual(registered,['SENTINEL-pasted-code']);
 assert.equal(store.hosts.logins.get('claude-code-1')?.state,'ready');assert.equal(snapshots,1);
 assert.equal(store.ask(codeCard!)?.state,'answered');
 assert.equal(JSON.stringify(store.ask(codeCard!)).includes('SENTINEL-pasted-code'),false);
});

test('unknown Create one outcome retains its mounted disk and reports the captured login and host once',async t=>{
 const store=new Store(':memory:'),clock=new FakeClock(),core=new HubCore({store,clock}),waits=new LoginCards(store,core.cards),notices:string[]=[];
 const lost=Promise.withResolvers<never>();let cleanup=0,mounted=true,attached='h',create='';
 const options={store,cards:core.cards,clock,registerSecret:()=>{},notice:(text:string)=>notices.push(text),prepare:async()=>{
  store.hosts.logins.insert({name:'new-login',harness:'claude-code',account:'new-login',kind:'disk',provider:'fake',region:'fake-1',volumeId:'kept',snapshotIds:[],lastSignIn:null});
  return {host:'h',pending:{name:'new-login',path:'/cland/auth/new-login',complete:async()=>{cleanup++;mounted=false;attached='';return {} as never;}}};
 },run:async(_input:unknown,output:(value:{admission:string;stream:'stdout';text:string})=>void)=>{
  const intent=store.cardSignIns.get(create)!;assert.equal(intent.login,'new-login');assert.equal(intent.host,'h');
  output({admission:'a',stream:'stdout',text:'https://login.example.test/claude\n'});
  return {admission:'a',closed:lost.promise,write:async()=>{},cancel:()=>lost.promise};
 }};
 const owner=new LoginCardSignIn(options);t.after(async()=>{await owner.stop();store.close();});
 waits.reconcile([{pool:'agents',reason:'waiting for a login claude-code'} as never]);create=JSON.parse(store.meta('login-wait-cards')!)[JSON.stringify(['agents','claude-code'])].id;
 core.cards.answer(store.ask(create)!,'Create one',1,'neovim');
 await until(()=>store.openAsks().some(card=>card.hubKind==='login-signin-code'),{what:'persisted code card before native loss'});
 const card=store.openAsks().find(card=>card.hubKind==='login-signin-code')!;
 lost.reject(Object.assign(Error('synthetic native loss'),{code:'CLAND_NATIVE_INCOMPLETE'}));await owner.idle();
 assert.equal(cleanup,0);assert.equal(mounted,true);assert.equal(attached,'h');
 const row=store.hosts.logins.get('new-login')!;assert.equal(row.state,'creating');assert.equal(row.kind==='disk'&&row.volumeId,'kept');
 assert.deepEqual(notices,['Login new-login on host h: sign-in outcome unknown']);const outcome=store.ask(card.id)!.outcome;assert.equal(outcome?.status==='answered'&&outcome.text,'sign-in outcome unknown');
 const reopened=new LoginCardSignIn(options);await reopened.idle();await reopened.stop();assert.equal(notices.length,1);
});

test('card shutdown joins a held second native writer after the first writer fails',async t=>{
 const store=new Store(':memory:'),clock=new FakeClock(),core=new HubCore({store,clock});
 const fail=Promise.withResolvers<never>(),closed=Promise.withResolvers<{admission:string;state:'closed';code:null;signal:string}>(),reported=Promise.withResolvers<void>();
 let running=false,cancelled=false,secondCompleted=false,settled=false;
 const owner=new LoginCardSignIn({store,cards:core.cards,clock,registerSecret:()=>{},notice:()=>{reported.resolve();throw Error('synthetic notice write failure');},prepare:async input=>{
  if(input.pool==='first')return fail.promise;
  return {host:'h',pending:{name:'second',path:'/cland/auth/second',complete:async()=>{secondCompleted=true;return {} as never;}}};
 },run:async()=>{running=true;return {admission:'second',closed:closed.promise,write:async()=>{},cancel:()=>{cancelled=true;return closed.promise;}};}});
 t.after(async()=>{fail.reject(Error('fixture cleanup'));closed.resolve({admission:'second',state:'closed',code:null,signal:'SIGTERM'});await owner.stop().catch(()=>{});store.close();});
 for(const pool of ['first','second']){const id=core.cards.raise('login-create','general','Create?',['Create one'],false,{harness:'codex',pool});core.cards.answer(store.ask(id)!,'Create one',1,'neovim');}
 await until(()=>running,{what:'second native writer admitted'});
 const stopping=owner.stop().finally(()=>{settled=true;});void stopping.catch(()=>{});
 await until(()=>cancelled,{what:'second native cancellation requested'});fail.reject(Error('synthetic preparation failure'));await reported.promise;await yieldLoop();
 assert.equal(settled,false);assert.equal(secondCompleted,false);
 closed.resolve({admission:'second',state:'closed',code:null,signal:'SIGTERM'});await assert.rejects(stopping,/drainage failed/);assert.equal(secondCompleted,true);
});

test('a close without a native exit fact interrupts rather than authorizing disk cleanup',async t=>{
 const store=new Store(':memory:'),clock=new FakeClock(),core=new HubCore({store,clock}),waits=new LoginCards(store,core.cards);let completed=0,interrupted=0;
 const owner=new LoginCardSignIn({store,cards:core.cards,clock,registerSecret:()=>{},prepare:async()=>({host:'h',pending:{name:'work',path:'/cland/auth/work',complete:async()=>{completed++;return {} as never;},interrupt:async()=>{interrupted++;return {} as never;}}}),
  run:async()=>({admission:'a',closed:Promise.resolve({admission:'a',state:'closed',code:null,signal:null}),write:async()=>{},cancel:async()=>{throw Error('unexpected cancel');}})});
 t.after(async()=>{await owner.stop();store.close();});
 waits.reconcile([{pool:'agents',reason:'waiting for a login codex'} as never]);
 const create=JSON.parse(store.meta('login-wait-cards')!)[JSON.stringify(['agents','codex'])].id;
 core.cards.answer(store.ask(create)!,'Create one',1,'neovim');await owner.idle();
 assert.equal(completed,0);assert.equal(interrupted,1);
});

test('accepted card intent interrupted before follow-up reports once on owner recovery',async t=>{
 const store=new Store(':memory:'),clock=new FakeClock(),core=new HubCore({store,clock}),waits=new LoginCards(store,core.cards);
 const notices:string[]=[];let prepared=0;
 const options={store,cards:core.cards,clock,registerSecret:()=>{},notice:(text:string)=>notices.push(text),prepare:async()=>{prepared++;throw Error('must not replay');},run:async()=>{throw Error('must not spawn');}};
 const first=new LoginCardSignIn(options);t.after(async()=>{await first.stop();store.close();});
 waits.reconcile([{pool:'agents',reason:'waiting for a login codex'} as never]);
 const create=JSON.parse(store.meta('login-wait-cards')!)[JSON.stringify(['agents','codex'])].id;
 const hold=t.mock.method(store,'afterCommit',()=>{});
 core.cards.answer(store.ask(create)!,'Create one',1,'neovim');hold.mock.restore();
 const recovered=new LoginCardSignIn(options);await recovered.idle();await recovered.stop();
 const again=new LoginCardSignIn(options);await again.idle();await again.stop();
 assert.equal(prepared,0);assert.equal(notices.length,1);assert.match(notices[0]!,/interrupted/i);
});

for(const admitted of [false,true])test(`runner refusal ${admitted?'without proof interrupts':'with not-admitted proof completes failed'}`,async t=>{
 const store=new Store(':memory:'),clock=new FakeClock(),core=new HubCore({store,clock}),waits=new LoginCards(store,core.cards);
 let completed=0,interrupted=0;
 const owner=new LoginCardSignIn({store,cards:core.cards,clock,registerSecret:()=>{},prepare:async input=>{
  const row=store.hosts.logins.insert({name:'refused',harness:input.harness,account:'refused',kind:'disk',provider:'fake',region:'fake-1',volumeId:'v',snapshotIds:[],lastSignIn:null});
  return {host:'h',pending:{name:row.name,path:'/cland/auth/refused',complete:async code=>{assert.equal(code,null);completed++;store.hosts.logins.markSignedOut(row.name,{reason:'sign-in failed',host:null});return store.hosts.logins.get(row.name)!;},interrupt:async()=>{interrupted++;store.hosts.logins.markSignedOut(row.name,{reason:'sign-in interrupted',host:'h'});return store.hosts.logins.get(row.name)!;}}};
 },run:async()=>{throw Object.assign(Error('unavailable'),admitted?{}:{nativeAdmission:'not-admitted',code:'CLAND_SIGNIN_UNAVAILABLE'});}});
 t.after(async()=>{await owner.stop();store.close();});
 waits.reconcile([{pool:'agents',reason:'waiting for a login codex'} as never]);
 const create=JSON.parse(store.meta('login-wait-cards')!)[JSON.stringify(['agents','codex'])].id;
 core.cards.answer(store.ask(create)!,'Create one',1,'neovim');await owner.idle();
 assert.equal(completed,admitted?0:1);assert.equal(interrupted,admitted?1:0);
});

for(const format of ['device label','one-time prompt'])test(`Codex ${format} output raises its code card and closes ready without an answer`,async t=>{
 const store=new Store(':memory:'),clock=new FakeClock(),core=new HubCore({store,clock}),waits=new LoginCards(store,core.cards);
 let deviceCard:string|undefined;
 const unsubscribe=core.subscribe(event=>{if(event.type==='message'&&store.ask(event.message.id)?.hubKind==='login-signin-code')deviceCard=event.message.id;});
 t.after(unsubscribe);
 const owner=new LoginCardSignIn({store,cards:core.cards,clock,registerSecret:()=>{throw Error('device sign-in needs no input');},prepare:async input=>{
  const row=store.hosts.logins.insert({name:'device',harness:input.harness,account:'device',kind:'disk',provider:'fake',region:'fake-1',volumeId:'v',snapshotIds:[],lastSignIn:null});
  return {host:'h',pending:{name:row.name,path:'/cland/auth/device',complete:async code=>{assert.equal(code,0);return store.hosts.logins.transition(row.name,'ready');}}};
 },run:async(_input,output)=>{
  output({admission:'device',stream:'stdout',text:format==='device label'?'https://login.example.test/codex Device code: FAKE':'https://auth.openai.com/codex/device\n2. Enter this one-time code (expires in 15 minutes)\n\nFAKE'});
  assert.equal(store.openAsks().some(card=>card.hubKind==='login-signin-code'),false,'wait for the complete code token');
  output({admission:'device',stream:'stdout',text:'-1234\n'});
  return {admission:'device',closed:Promise.resolve({admission:'device',state:'closed',code:0,signal:null}),write:async()=>{throw Error('no device input');},cancel:async()=>{throw Error('unexpected cancel');}};
 }});
 t.after(async()=>{await owner.stop();store.close();});
 waits.reconcile([{pool:'agents',reason:'waiting for a login codex'} as never]);
 const create=JSON.parse(store.meta('login-wait-cards')!)[JSON.stringify(['agents','codex'])].id;
 core.cards.answer(store.ask(create)!,'Create one',1,'neovim');await owner.idle();
 assert.equal(store.hosts.logins.get('device')?.state,'ready');
 const cards=store.openAsks();assert.equal(cards.length,0);
 assert.ok(deviceCard);assert.match(store.ask(deviceCard)!.question,/FAKE-1234/);assert.equal(store.ask(deviceCard)!.state,'withdrawn');
});

test('the fifteen-minute limit waits for the matching cancellation close before signing out',async t=>{
 const store=new Store(':memory:'),clock=new FakeClock(),core=new HubCore({store,clock});store.hosts.logins.useClock(clock);
 const waits=new LoginCards(store,core.cards),cancelled=Promise.withResolvers<void>();
 const closed=Promise.withResolvers<{admission:string;state:'closed';code:null;signal:string}>();let writes=0,cancelCardState:string|undefined;
 const owner=new LoginCardSignIn({store,cards:core.cards,clock,registerSecret:()=>{},prepare:async input=>{
  const row=store.hosts.logins.insert({name:'work',harness:input.harness,account:'work',kind:'disk',provider:'fake',region:'fake-1',volumeId:'kept-volume',snapshotIds:[],lastSignIn:null});
  return {host:'h',pending:{name:row.name,path:'/cland/auth/work',complete:async code=>{assert.equal(code,null);store.hosts.logins.markSignedOut(row.name,{reason:'sign-in failed',host:null});return store.hosts.logins.get(row.name)!;}}};
 },run:async(_input,output)=>{
  output({admission:'a',stream:'stdout',text:'https://login.example.test/claude\n'});
  return {admission:'a',closed:closed.promise,write:async()=>{writes++;},cancel:()=>{cancelCardState=store.ask(id)?.state;cancelled.resolve();return closed.promise;}};
 }});
 t.after(async()=>{closed.resolve({admission:'a',state:'closed',code:null,signal:'SIGTERM'});await owner.stop();store.close();});
 waits.reconcile([{pool:'agents',reason:'waiting for a login claude-code'} as never]);
 const create=JSON.parse(store.meta('login-wait-cards')!)[JSON.stringify(['agents','claude-code'])].id;
 core.cards.answer(store.ask(create)!,'Create one',1,'neovim');
 await until(()=>store.openAsks().some(a=>a.hubKind==='login-signin-code'),{what:'persisted code card before timeout'});
 const id=store.openAsks().find(a=>a.hubKind==='login-signin-code')!.id;
 const before=store.hosts.logins.get('work');
 await clock.advance(900000);await cancelled.promise;
 assert.equal(store.ask(id)?.state,'withdrawn','expiry withdraws the code card before native close');
 assert.equal(cancelCardState,'withdrawn','card withdrawal precedes native cancel admission');
 const outcome=store.ask(id)!.outcome;assert.equal(outcome?.status==='answered'&&outcome.text,'sign-in timed out; closing');
 assert.throws(()=>core.cards.answer(store.ask(id)!,'SENTINEL-after-expiry',undefined,'neovim'),/hub card handler failed/);
 assert.equal(writes,0,'no input reaches a cancelling native run');
 assert.deepEqual(store.hosts.logins.get('work'),before,'state and disk identity stay unchanged while close is held');
 closed.resolve({admission:'a',state:'closed',code:null,signal:'SIGTERM'});await owner.idle();
 const row=store.hosts.logins.get('work')!;assert.equal(row.state,'signed-out');assert.equal(row.kind==='disk'&&row.volumeId,'kept-volume');
 assert.equal(store.ask(id)?.state,'withdrawn');
});
