// T3: real host-create fixture Git/setup and projectHub startup under held teardown boundaries.
// Lifecycle: release held continuations, join acquired hubs and native owners, then remove roots.
import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {stat,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {fixture} from './host-create-fixture.ts';
import {hostFixtureOwner} from './host-fixture-owner.ts';
import {scenarioReplyOwner} from './scenario-reply-owner.ts';
import {onCleanup} from './process-cleanup.ts';
import {within} from '../src/executor/droplet/deadline.ts';
import {FakeClock} from './fake-clock.ts';
import {testMessenger} from './fakes/messenger.ts';
import {testWaitMs,waitTimeoutMs} from './until.ts';

// Run the actual registered cleanup phases while the outer test retains its release owner.
function controlledContext(){
 const hooks:Array<()=>unknown|Promise<unknown>>=[];
 const abort=new AbortController();let disposed:Promise<void>|undefined,cursor=0;
 const context={signal:abort.signal,after:(hook:()=>unknown|Promise<unknown>)=>{hooks.push(hook);}} as TestContext;
 const cancel=()=>abort.abort(Error('controlled fixture is closing'));
 const dispose=()=>disposed??=(async()=>{
  cancel();const failures:unknown[]=[];
  while(cursor<hooks.length){const hook=hooks[cursor++]!;try{await hook();}catch(error){failures.push(error);}}
  if(failures.length)throw new AggregateError(failures,'controlled fixture cleanup failed');
 })().finally(()=>{disposed=undefined;});
 return {context,dispose,cancel};
}
const bounded=<T>(work:Promise<T>)=>within(work,waitTimeoutMs(testWaitMs(5000)));

/** Install before admission; callbacks capture late assignments and every join is attempted. */
function controlCleanup(t:TestContext,release:()=>void,owners:Array<()=>unknown|Promise<unknown>>,last:()=>unknown|Promise<unknown>=()=>{}){
 let disposal:Promise<void>|undefined;
 const dispose=()=>disposal??=(async()=>{
  const failures:unknown[]=[];
  try{release();}catch(error){failures.push(error);}
  const results=await Promise.allSettled(owners.map(owner=>Promise.resolve().then(owner)));
  for(const result of results)if(result.status==='rejected')failures.push(result.reason);
  try{await last();}catch(error){failures.push(error);}
  if(failures.length)throw new AggregateError(failures,'control cleanup failed');
 })();
 t.after(dispose);return dispose;
}

test('held fixture setup joins its last write before storage and root teardown',{timeout:testWaitMs(60000)},async t=>{
 const c=controlledContext(),entered=Promise.withResolvers<string>(),release=Promise.withResolvers<void>();
 const cancelled=Promise.withResolvers<void>(),storage=Promise.withResolvers<void>();
 let storageClosed=false,written=false,starting:Promise<unknown>|undefined,disposing:Promise<void>|undefined;
 controlCleanup(t,()=>{release.resolve();c.cancel();},[()=>c.dispose(),()=>starting?.catch(()=>{}),()=>disposing],()=>c.dispose());
 starting=fixture(c.context,{setup:async(root,_env,signal)=>{
  signal.addEventListener('abort',()=>cancelled.resolve(),{once:true});entered.resolve(root);
  await release.promise;await writeFile(join(root,'late-setup-write'),'joined');written=true;
 }});
 void starting.catch(()=>{});
 const root=await bounded(entered.promise);
 onCleanup(c.context,()=>{storageClosed=true;storage.resolve();});
 disposing=c.dispose();void disposing.catch(()=>{});
 assert.equal(await bounded(Promise.race([cancelled.promise.then(()=>'cancelled'),storage.promise.then(()=>'storage')])), 'cancelled');
 assert.equal(storageClosed,false,'storage is held while setup still owns a write');
 assert.equal((await stat(root)).isDirectory(),true);
 release.resolve();await assert.rejects(starting,/closing/);await bounded(disposing);
 assert.equal(written,true,'the held final write completed before removal');
 assert.equal(storageClosed,true);
 await assert.rejects(stat(root),{code:'ENOENT'});
});

test('held fixture restart joins startup before closing handles and rejects later starts',{timeout:testWaitMs(60000)},async t=>{
 const c=controlledContext(),release=Promise.withResolvers<void>(),entered=Promise.withResolvers<void>();
 const cancelled=Promise.withResolvers<void>();let signal:AbortSignal|undefined,starting:Promise<unknown>|undefined,disposing:Promise<void>|undefined,initializing:ReturnType<typeof fixture>|undefined;
 controlCleanup(t,()=>{release.resolve();c.cancel();},[()=>c.dispose(),()=>initializing?.catch(()=>{}),()=>starting?.catch(()=>{}),()=>disposing],()=>c.dispose());
 initializing=fixture(c.context,{setup:async(_root,_env,ownerSignal)=>{signal=ownerSignal;}});
 const f=await initializing;
 const db=f.own(new DatabaseSync(join(f.root,'cleanup-proof.db')));
 await f.hub.stop();
 const receipt:PromiseLike<void>={then:(resolve,reject)=>{entered.resolve();return release.promise.then(resolve,reject);}};
 starting=f.start(undefined,receipt);void starting.catch(()=>{});
 await bounded(entered.promise);
 signal!.addEventListener('abort',()=>cancelled.resolve(),{once:true});
 disposing=c.dispose();void disposing.catch(()=>{});
 await bounded(cancelled.promise);
 assert.equal(db.isOpen,true,'storage stays open until the startup continuation joins');
 assert.equal((await stat(f.root)).isDirectory(),true);
 await assert.rejects(f.start(),/closing/);
 release.resolve();await assert.rejects(starting,/closing/);await bounded(disposing);
 assert.equal(db.isOpen,false);await assert.rejects(stat(f.root),{code:'ENOENT'});
});

test('late restart acquisition stops its returned hub exactly once before close completes',async t=>{
 const owner=hostFixtureOwner(),entered=Promise.withResolvers<void>(),release=Promise.withResolvers<void>();
 let stops=0,closed=false,starting:Promise<unknown>|undefined,disposing:Promise<void>|undefined;
 controlCleanup(t,()=>release.resolve(),[()=>owner.close(),()=>starting?.catch(()=>{}),()=>disposing]);
 starting=owner.start(async()=>{entered.resolve();await release.promise;return {stop:async()=>{stops++;closed=true;}};});
 void starting.catch(()=>{});
 await bounded(entered.promise);
 disposing=owner.close();void disposing.catch(()=>{});
 assert.equal(owner.signal.aborted,true);assert.equal(owner.closed(),false);
 release.resolve();await assert.rejects(starting,/closing/);await bounded(disposing);
 assert.equal(closed,true);assert.equal(stops,1);assert.equal(owner.closed(),true);
});

for(const id of ['code-1','bob-answer'])test(`thrown ${id} upload joins its armed result and every other receipt`,async t=>{
 const clock=new FakeClock(),owner=scenarioReplyOwner(clock),remote=testMessenger();
 const entered=Promise.withResolvers<void>();
 let other:Promise<unknown>|undefined,loop:Promise<void>|undefined,upload:Promise<unknown>|undefined;
 controlCleanup(t,()=>{},[()=>owner.close(),()=>other?.catch(()=>{}),()=>upload?.catch(()=>{}),()=>remote.stop(),()=>loop]);
 other=owner.exchange('other',()=>entered.resolve());void other.catch(()=>{});
 await bounded(entered.promise);
 remote.start(()=>{assert.equal(clock.pending,2,'both receipt timers were armed before upload');throw Error('planted upload failure');});
 loop=remote.run();
 upload=owner.exchange(id,()=>remote.upload({type:'topic.answer',id,ask:'fixture-ask',option:1},{chatId:'101',messageId:id},[]));
 await assert.rejects(upload,/planted upload failure/);
 await owner.close();await assert.rejects(other,/closed/);
 await clock.advance(5001);assert.equal(clock.pending,0);
 await assert.rejects(owner.exchange('after-close',()=>assert.fail('closed owner admitted an upload')),/closed/);
});

test('synchronous remote result completes the pre-armed receipt and cancels its timer',async t=>{
 const clock=new FakeClock(),owner=scenarioReplyOwner(clock);
 let ready:ReturnType<typeof owner.exchange>|undefined;
 controlCleanup(t,()=>{},[()=>owner.close(),()=>ready?.catch(()=>{})]);
 ready=owner.exchange('ready',()=>owner.receive({type:'result',id:'ready',ok:true,value:null}));
 const result=await ready;
 assert.equal(result.ok,true);await owner.close();await clock.advance(5001);assert.equal(clock.pending,0);
});

test('control cleanup drains hooks registered after cancelled fixture initialization',{timeout:testWaitMs(60000)},async t=>{
 const c=controlledContext(),lateClosed=Promise.withResolvers<void>();
 let starting:Promise<unknown>|undefined;
 const dispose=controlCleanup(t,()=>c.cancel(),[()=>c.dispose(),()=>starting?.catch(()=>{})],()=>c.dispose());
 starting=(async()=>{
  try{return await fixture(c.context);}
  finally{c.context.after(()=>lateClosed.resolve());}
 })();
 void starting.catch(()=>{});
 // Cancellation is admitted before tempProject's asynchronous continuation returns.
 await bounded(dispose());await assert.rejects(starting,/closing/);
 await bounded(lateClosed.promise);
});

test('control cleanup releases first and attempts every join after one rejects',async t=>{
 const c=controlledContext(),release=Promise.withResolvers<void>();
 let work:Promise<void>|undefined,joined=false,tail=false;
 // Independent outer fallback is installed before the deliberately failing control.
 t.after(async()=>{release.resolve();await Promise.allSettled([c.dispose(),work]);});
 controlCleanup(c.context,()=>release.resolve(),[
  ()=>{throw Error('planted join failure');},
  ()=>work,
 ],()=>{tail=true;});
 work=(async()=>{await release.promise;joined=true;})();
 await assert.rejects(bounded(c.dispose()),/controlled fixture cleanup failed/);
 assert.equal(joined,true,'the other admitted owner joined despite the rejected cleanup');
 assert.equal(tail,true,'the late-hook pass was attempted after every join');
});
