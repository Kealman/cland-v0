// T2: durable indexed card obligations and hub-clock retry, no native processes.
import './cover-quiet.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../src/hub/store.ts';
import {SecretAnswerCleanupOwner} from '../src/remote/secret-answer.ts';
import {FakeClock} from './fake-clock.ts';
import {until} from './until.ts';
import {HubCore} from '../src/hub/core.ts';
import {LoginCardSignIn} from '../src/host/login-card-signin.ts';
import {Gateway} from '../src/remote/gateway.ts';
import {testMessenger} from './fakes/messenger.ts';
import {setImmediate as yieldLoop} from 'node:timers/promises';
import type {SecretAnswerCleanup} from '../src/remote/state.ts';
import {DiscordRemote} from '../src/remote/discord.ts';
import type {DiscordApi} from '../src/remote/discord-api.ts';

test('secret cleanup recovers captured ingress without a repeated update and retries on the hub clock',async t=>{
 const store=new Store(':memory:'),clock=new FakeClock(),state=store.remotes.forMessenger('telegram');
 const ingress={chatId:'101',messageId:'native',messengerUserId:'human-id'};
 state.admitSecretAnswerCleanup('native-hash',ingress);
 let attempts=0;
 const owner=new SecretAnswerCleanupOwner({state:store.remotes,clock,perform:async(via,captured)=>{
  assert.equal(via,'telegram');assert.deepEqual(captured,ingress);attempts++;if(attempts===1)throw Error('synthetic transport failure');
 }});
 t.after(async()=>{await owner.stop();store.close();});owner.start(['telegram']);
 await until(()=>attempts===1&&state.secretAnswerCleanup('native-hash')!.attempts===1,{what:'persisted first cleanup retry'});
 assert.equal(state.get('gateway.secret-answer:native-hash'),null);
 await clock.advance(1000);
 await until(()=>state.secretAnswerCleanup('native-hash')===null,{what:'durable recovered cleanup completion'});
 assert.equal(attempts,2);assert.equal(state.get('gateway.secret-answer:native-hash'),'done');
});

test('Discord adapter stop joins its native deletion after cancellation',async t=>{
 const held=Promise.withResolvers<boolean>(),clock=new FakeClock();let aborted=false,settled=false;
 const api={onError:()=>()=>{},onExchange:()=>()=>{},deleteMessage:(_chat:string,_message:string,options:{signal:AbortSignal})=>{options.signal.addEventListener('abort',()=>{aborted=true;},{once:true});return held.promise;}} as unknown as DiscordApi;
 const remote=new DiscordRemote(api,'SENTINEL-test-only',clock);
 const deleting=remote.deleteMessage({chatId:'101',messageId:'native'});
 t.after(async()=>{held.resolve(true);await Promise.allSettled([deleting,remote.stop()]);});
 const stopping=remote.stop().then(()=>{settled=true;});await until(()=>aborted,{what:'native deletion cancellation observed'});await yieldLoop();
 assert.equal(settled,false);held.resolve(true);assert.equal(await deleting,true);await stopping;assert.equal(settled,true);
});

test('card recovery retires a positively completed login without an unknown-outcome notice',async t=>{
 const store=new Store(':memory:'),clock=new FakeClock(),core=new HubCore({store,clock}),notices:string[]=[];
 store.hosts.logins.insert({name:'complete',harness:'codex',account:'complete',kind:'disk',provider:'fake',region:'fake-1',volumeId:'kept',snapshotIds:[],lastSignIn:clock.now().toISOString()});store.hosts.logins.transition('complete','ready');
 const card=core.cards.raise('login-signin-code','general','Device sign-in',['Cancel'],false,{login:'complete'});
 store.cardSignIns.put('accepted',{input:{harness:'codex',pool:'agents'},at:clock.now().getTime(),login:'complete',host:'h',card});
 const owner=new LoginCardSignIn({store,cards:core.cards,clock,registerSecret:()=>{},notice:text=>notices.push(text),prepare:async()=>{throw Error('no replay');},run:async()=>{throw Error('no replay');}});
 t.after(async()=>{await owner.stop();store.close();});await owner.idle();assert.deepEqual(notices,[]);assert.equal(store.cardSignIns.get('accepted'),null);assert.equal(store.ask(card)!.state,'withdrawn');assert.equal(store.hosts.logins.get('complete')!.state,'ready');
});

test('failed unknown-outcome notice retains its intent for one later recovery publication',async t=>{
 const store=new Store(':memory:'),clock=new FakeClock(),core=new HubCore({store,clock}),notices:string[]=[];
 let refused=true;
 const options={store,cards:core.cards,clock,registerSecret:()=>{},notice:(text:string)=>{if(refused)throw Error('synthetic notice persistence failure');notices.push(text);},prepare:async()=>{
  store.hosts.logins.insert({name:'unknown',harness:'codex',account:'unknown',kind:'disk',provider:'fake',region:'fake-1',volumeId:'kept',snapshotIds:[],lastSignIn:null});return {host:'h',pending:{name:'unknown',path:'/cland/auth/unknown',complete:async()=>{throw Error('no cleanup');}}};
 },run:async()=>({admission:'a',closed:Promise.resolve({admission:'a',state:'closed' as const,code:null,signal:null}),write:async()=>{},cancel:async()=>{throw Error('no cancellation');}})};
 const owner=new LoginCardSignIn(options);t.after(async()=>{await owner.stop().catch(()=>{});store.close();});
 const id=core.cards.raise('login-create','general','Create?',['Create one'],false,{harness:'codex',pool:'agents'});core.cards.answer(store.ask(id)!,'Create one',1,'neovim');
 await assert.rejects(owner.idle(),/drainage failed/);assert.ok(store.cardSignIns.get(id));assert.equal(store.hosts.logins.get('unknown')!.state,'creating');await owner.stop().catch(()=>{});
 refused=false;const recovered=new LoginCardSignIn(options);await recovered.idle();await recovered.stop();assert.equal(store.cardSignIns.get(id),null);assert.deepEqual(notices,['Login unknown on host h: sign-in outcome unknown']);
});

test('Gateway shutdown joins a held second deletion after the first durable checkpoint fails',async t=>{
 const store=new Store(':memory:'),clock=new FakeClock(),state=store.remotes.forMessenger('telegram'),remote=testMessenger();
 const first=Promise.withResolvers<void>(),second=Promise.withResolvers<void>(),failed=Promise.withResolvers<void>();
 let starts=0,secondClosed=false,settled=false;
 remote.deleteMessage=async ingress=>{starts++;if(ingress.messageId==='one')await first.promise;else {await second.promise;secondClosed=true;}return true;};
 for(const messageId of ['one','two'])state.admitSecretAnswerCleanup(messageId,{chatId:'101',messageId});
 const finish=state.finishSecretAnswer.bind(state);
 // Each forMessenger() creates a view on the same DB; inject the producer's persistence failure through the shared view factory.
 const records={forMessenger:()=>state};
 t.mock.method(state,'finishSecretAnswer',(row:SecretAnswerCleanup)=>{if(row.id==='one'){failed.resolve();throw Error('synthetic checkpoint failure');}finish(row);});
 const gateway=new Gateway({open:()=>({receive:()=>{},closed:()=>{},drainUploads:async()=>{}})},[remote],{clock,secretAnswers:records});
 t.after(async()=>{first.resolve();second.resolve();await gateway.stop().catch(()=>{});await until(()=>state.secretAnswerCleanup('two')===null,{what:'second cleanup checkpoint before storage close'});store.close();});
 await gateway.start();await until(()=>starts===2,{what:'both deletion writers admitted'});
 const stopping=gateway.stop().finally(()=>{settled=true;});void stopping.catch(()=>{});
 first.resolve();await failed.promise;await yieldLoop();assert.equal(settled,false);assert.equal(remote.stopped,false);assert.equal(secondClosed,false);
 second.resolve();await assert.rejects(stopping,/gateway shutdown failed/);assert.equal(secondClosed,true);assert.equal(remote.stopped,true);
 assert.ok(state.secretAnswerCleanup('one'));assert.equal(state.secretAnswerCleanup('two'),null);
});

test('card intent recovery pages only captured active records off the startup turn',async t=>{
 const store=new Store(':memory:'),clock=new FakeClock(),core=new HubCore({store,clock});
 for(let n=0;n<1000;n++)store.setMeta(`retained-card-history:${n}`,'synthetic unrelated history');
 for(let n=0;n<130;n++)store.cardSignIns.put(`card-${n}`,{input:{harness:'codex',pool:'agents'},at:clock.now().getTime()});
 let reads=0,decoded=0,notices=0;const page=store.cardSignIns.page.bind(store.cardSignIns);
 t.mock.method(store.cardSignIns,'page',(after:number,through:number,limit?:number)=>{const rows=page(after,through,limit);reads++;decoded+=rows.length;assert.ok(rows.length<=64);return rows;});
 const owner=new LoginCardSignIn({store,cards:core.cards,clock,registerSecret:()=>{},notice:()=>{notices++;},prepare:async()=>{throw Error('no native replay');},run:async()=>{throw Error('no native replay');}});
 t.after(async()=>{await owner.stop();store.close();});assert.equal(reads,0,'recovery work stays off the startup turn');
 store.cardSignIns.put('new-admission',{input:{harness:'codex',pool:'agents'},at:clock.now().getTime()});
 await owner.idle();assert.equal(notices,130);assert.equal(decoded,130);assert.ok(reads<=4);assert.ok(store.cardSignIns.get('new-admission'));
});

test('secret cleanup startup bounds indexed pages and shares concurrent work per native message',async t=>{
 const store=new Store(':memory:'),clock=new FakeClock(),state=store.remotes.forMessenger('telegram');
 for(let n=0;n<1000;n++)state.set(`retained-history:${n}`,'synthetic unrelated history');
 for(let n=0;n<130;n++)state.admitSecretAnswerCleanup(`id-${n}`,{chatId:'101',messageId:String(n)});
 const page=state.secretAnswersPage.bind(state),get=state.secretAnswerCleanup.bind(state);let reads=0,decoded=0,attempts=0;
 t.mock.method(state,'secretAnswersPage',(after:number,through:number,limit?:number)=>{const rows=page(after,through,limit);reads++;decoded+=rows.length;assert.ok(rows.length<=64);return rows;});
 t.mock.method(state,'secretAnswerCleanup',(id:string)=>{const row=get(id);if(row)decoded++;return row;});
 const owner=new SecretAnswerCleanupOwner({state:{forMessenger:()=>state},clock,perform:async()=>{attempts++;}});
 t.after(async()=>{await owner.stop();store.close();});owner.start(['telegram']);assert.equal(reads,0);
 const first=owner.run('telegram','id-0');assert.equal(owner.run('telegram','id-0'),first,'concurrent native-message cleanup shares its owner');await first;
 await until(()=>state.get('gateway.secret-answer:id-129')==='done',{what:'all admitted cleanup pages checkpointed'});await owner.stop();
 assert.equal(attempts,130);assert.ok(decoded<=260);assert.ok(reads<=4);assert.equal(state.get('retained-history:999'),'synthetic unrelated history');
});

test('recovered unknown new-login intent keeps disk ownership and publishes the named cut once',async t=>{
 const store=new Store(':memory:'),clock=new FakeClock(),core=new HubCore({store,clock}),notices:string[]=[];
 store.hosts.logins.insert({name:'new-login',harness:'claude-code',account:'new-login',kind:'disk',provider:'fake',region:'fake-1',volumeId:'kept',snapshotIds:[],lastSignIn:null});
 const card=core.cards.raise('login-signin-code','general','Use the sign-in link',[],true,{login:'new-login'},true);
 store.cardSignIns.put('accepted',{input:{harness:'claude-code',pool:'agents'},at:clock.now().getTime(),login:'new-login',host:'captured-host',card});
 const options={store,cards:core.cards,clock,registerSecret:()=>{},notice:(text:string)=>notices.push(text),prepare:async()=>{throw Error('no native replay');},run:async()=>{throw Error('no native replay');}};
 const owner=new LoginCardSignIn(options);t.after(async()=>{await owner.stop();store.close();});await owner.idle();
 assert.equal(store.hosts.logins.get('new-login')!.state,'creating');const outcome=store.ask(card)!.outcome;assert.equal(outcome?.status==='answered'&&outcome.text,'sign-in outcome unknown');
 assert.deepEqual(notices,['Login new-login on host captured-host: sign-in outcome unknown']);
 const again=new LoginCardSignIn(options);await again.idle();await again.stop();assert.equal(notices.length,1);
});
