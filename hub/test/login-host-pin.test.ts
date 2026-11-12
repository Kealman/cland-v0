// T2: metadata, injected sign-in runner and FakeClock; owned directory cleanup, no native children.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HostRecords, HostSecretStore } from '../src/host/records.ts';
import { settleLoginSignInsForHost } from '../src/host/login-signin.ts';
import type { CreateVolumeOptions, Volume, Machine } from '../src/host/provider/provider.ts';
import { preparePoolLogin } from '../src/host/login-add.ts';
import { PoolRuntime } from '../src/host/pool-runtime.ts';
import { readHostPools } from '../src/host/pools.ts';
import { FakeHostProvider } from '../src/host/provider/fake.ts';
import { FakeClock } from './fake-clock.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { ownDirectory, onCleanup } from './process-cleanup.ts';
import { fakeLockProcesses } from './fakes/lock-processes.ts';
import type { Host } from '../src/host/host.ts';

async function fixture(t:test.TestContext,actualMachine=false) {
 const allocated=await mkdtemp(join(tmpdir(),'login-pin-'));ownDirectory(t,allocated);const root=await realpath(allocated);
 const db=new DatabaseSync(':memory:'),clock=new FakeClock(Date.now());
 let records:HostRecords|undefined;
 const owners:Array<()=>unknown|Promise<unknown>>=[];
 onCleanup(t,async()=>{
  const failures:unknown[]=[];
  try{for(const close of owners.reverse())try{await close();}catch(error){failures.push(error);}
   try{await records?.leases.close();}catch(error){failures.push(error);}
  }finally{db.close();}
  if(failures.length)throw new AggregateError(failures,'pin fixture cleanup failed');
 });
 records=new HostRecords(db);
 const env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root}),provider=new FakeHostProvider({env,now:()=>clock.now().getTime()});
 let machine:Machine={id:'machine-a',address:'fake-a',architecture:'arm64',created:clock.now().toISOString()};
 if(actualMachine){const acquired=await provider.acquire({project:root,pool:'agents',architecture:'arm64',region:'lon1'});assert.equal(acquired.state,'created');if(acquired.state!=='created')throw Error('fixture machine unavailable');machine=acquired.machine;}
 new HostSecretStore(root,records).register({id:'host-a',address:machine.address,user:'runner',clientKeyPath:'scratch-key',knownHosts:'scratch-pin'});
 records.provisions.ready({id:'host-a',pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:machine.created,state:'ready',machine});
 const settings=readHostPools({agents:{provider:'fake',slots:1,min_hosts:0,idle_stop:'1m'}});
 return {root,records,clock,settings,env,provider,machine,defer:(close:()=>unknown|Promise<unknown>)=>owners.push(close)};
}
for(const code of [0,1,null])test(`terminal outcome ${code} holds its host through cleanup and releases the pin`,async t=>{
 const f=await fixture(t),pins=new Set<string>();
 const prepared=await preparePoolLogin({...f,pools:f.settings.pools,hosts:[{name:'host-a'} as Host],signal:new AbortController().signal,createHost:async()=>{throw Error('must reuse ready host');},pinHost:id=>{pins.add(id);return()=>{pins.delete(id);};},runner:async input=>{
  assert.equal(pins.has('host-a'),true);
  assert.equal(input.logins.get(input.name!)?.state,'creating');
  return {name:input.name!,path:'/cland/auth/codex-work',complete:async exit=>{
   assert.equal(pins.has('host-a'),true);
   if(exit===0)return input.logins.transition(input.name!,'ready');input.logins.markSignedOut(input.name!,{reason:'sign-in failed',host:null});return input.logins.get(input.name!)!;
  }};
 }},{harness:'codex'});
 assert.equal(pins.has('host-a'),true);await prepared.pending.complete(code);assert.equal(pins.has('host-a'),false);
});
for(const name of ['INVALID','work',''])test(`login admission refuses ${name||'empty name'} before host creation or pinning`,async t=>{
 const f=await fixture(t);
 f.records.provisions.save({...f.records.provisions.get('host-a')!,state:'destroyed'});
 if(name==='work')f.records.logins.insert({name,harness:'codex',account:name,kind:'disk',provider:'fake',region:'fake-1',volumeId:null,snapshotIds:[],lastSignIn:null});
 let acquired=0,pinned=0;
 await assert.rejects(preparePoolLogin({...f,pools:f.settings.pools,hosts:[],signal:new AbortController().signal,createHost:async()=>{acquired++;},pinHost:()=>{pinned++;return()=>{};}},{harness:'codex',name}),/name/);
 assert.equal(acquired,0);assert.equal(pinned,0);
 assert.equal(f.records.logins.get('work')?.state,name==='work'?'creating':undefined);
});
test('a pinned host renews its lease and idle-stop waits for unpinning',async t=>{
 const f=await fixture(t);let pinned=true;
 const runtime=new PoolRuntime(()=>f.settings,f.records,()=>true,()=>[]);f.defer(()=>runtime.close());
 const destroyed:string[]=[];
 runtime.start(async()=>{}, {clock:f.clock,busyHost:()=>pinned,declarations:()=>new FakeHostProvider({env:f.env}).declarations,destroy:async id=>{destroyed.push(id);f.records.provisions.save({...f.records.provisions.get(id)!,state:'destroyed'});}});
 const lease={root:f.root,env:f.env,clock:f.clock,processes:fakeLockProcesses().processes,leaseMs:30000,caps:{shared:10,hosts:10},pool:'agents',size:'fake',priceHourly:0,billingMinimumMs:1000};
 await f.records.leases.create('host-a',lease);const before=f.records.leases.get('host-a')!.deadline;
 f.records.leases.arm('host-a',lease,()=>runtime.inUse('host-a'));
 await f.clock.advance(7500);await f.records.leases.stop('host-a');
 assert.ok(f.records.leases.get('host-a')!.deadline>before,'durable lease renewed while pinned');
 await f.clock.advance(60000);assert.deepEqual(destroyed,[]);
 pinned=false;runtime.reconcile();await f.clock.advance(60000);await runtime.close();
 assert.deepEqual(destroyed,['host-a']);
});

for(const boundary of ['create','attach','mount','publish','replacement'] as const)test(`sign-in revalidates captured host authority after ${boundary}`,async t=>{
 const f=await fixture(t,true),effects:string[]=[];let pinned=false;
 const provider=f.provider,machine=f.machine,provision=f.records.provisions.get('host-a')!;
 const change=(at:string)=>{
  effects.push(at);
  if(at===boundary)f.records.provisions.save({...f.records.provisions.get('host-a')!,state:'destroying'});
  if(boundary==='replacement'&&at==='create'){const row=f.records.provisions.get('host-a')!;f.records.provisions.ready({...row,state:'ready',machine:{...row.machine!,created:new Date(Date.parse(row.machine!.created)+1).toISOString()}});}
 };
 const create=FakeHostProvider.prototype.createVolume,attach=FakeHostProvider.prototype.attachVolume,detach=FakeHostProvider.prototype.detachVolume;
 t.mock.method(FakeHostProvider.prototype,'createVolume',async function(this:FakeHostProvider,input:CreateVolumeOptions){const result=await create.call(this,input);change('create');return result;});
 t.mock.method(FakeHostProvider.prototype,'attachVolume',async function(this:FakeHostProvider,volume:Volume,machine:Machine){const result=await attach.call(this,volume,machine);change('attach');return result;});
 t.mock.method(FakeHostProvider.prototype,'detachVolume',async function(this:FakeHostProvider,volume:Volume,machine:Machine){effects.push('detach');return detach.call(this,volume,machine);});
 const host={name:'host-a',loginDisk:async({op}:{op:string})=>{change(op);},publishFile:async()=>{change('publish');return true;}} as unknown as Host;
 await assert.rejects(preparePoolLogin({...f,pools:f.settings.pools,hosts:[host],signal:new AbortController().signal,createHost:async()=>{throw Error('unexpected host');},pinHost:()=>{pinned=true;return()=>{pinned=false;};}},{harness:'codex',name:'work'}),/readiness or identity changed/);
 assert.equal(f.records.logins.get('work')?.state,'signed-out');assert.equal(pinned,false);
 assert.deepEqual(effects,{
  create:['create'],replacement:['create'],attach:['create','attach'],mount:['create','attach','mount'],publish:['create','attach','mount','publish'],
 }[boundary]);
 const row=f.records.logins.get('work')!;assert.equal(row.kind,'disk');if(row.kind!=='disk')throw Error('fixture disk missing');
 const inventory=await provider.listVolumes({project:f.root});assert.equal(inventory.state,'listed');if(inventory.state!=='listed')throw Error('volume inventory unavailable');
 if(boundary==='create'||boundary==='replacement'){
  assert.equal(row.signedOut?.reason,'sign-in failed');assert.equal(f.records.logins.signInFenceReason('work'),'');assert.equal(inventory.volumes.find(v=>v.id===row.volumeId)?.attachedTo,null);
 }else{
  assert.equal(row.signedOut?.reason,'sign-in interrupted');assert.equal(row.signedOut?.host,'host-a');assert.equal(inventory.volumes.find(v=>v.id===row.volumeId)?.attachedTo,machine.id);
  assert.throws(()=>f.records.logins.beginSignIn('work'),/may still be running/);
  f.records.provisions.save({...provision,state:'destroyed'});settleLoginSignInsForHost(f.records,'host-a');assert.throws(()=>f.records.logins.beginSignIn('work'),/may still be running/,'no deletion receipt');
  f.records.provisions.save({...provision,state:'destroyed',machine:{...machine,created:new Date(Date.parse(machine.created)+1).toISOString()},machineDeletionRead:'replacement receipt'});settleLoginSignInsForHost(f.records,'host-a');assert.throws(()=>f.records.logins.beginSignIn('work'),/may still be running/,'different birth');
  let deletionRead:string|undefined;
  const released=await provider.release(machine,receipt=>{if(receipt.resource==='machine')deletionRead=receipt.read;});assert.equal(released.state,'released');assert.ok(deletionRead);
  f.records.provisions.save({...provision,state:'destroyed',machineDeletionRead:deletionRead});settleLoginSignInsForHost(f.records,'host-a');
  const after=await provider.listVolumes({project:f.root});assert.equal(after.state,'listed');if(after.state!=='listed')throw Error('settled volume inventory unavailable');assert.equal(after.volumes.find(v=>v.id===row.volumeId)?.attachedTo,null);
  assert.equal(f.records.logins.signInFenceReason('work'),'');const settled=f.records.logins.get('work');assert.equal(settled?.state,'signed-out');assert.equal(settled?.kind==='disk'&&settled.volumeId,row.volumeId);assert.ok(f.records.logins.beginSignIn('work'));
 }
});


test('login add creates a host while its only login is still creating',async t=>{
 const f=await fixture(t);const original=f.records.provisions.get('host-a')!;
 f.records.provisions.save({...original,state:'destroyed'});let creates=0;
 const prepared=await preparePoolLogin({...f,pools:f.settings.pools,hosts:[{name:'host-a'} as Host],signal:new AbortController().signal,createHost:async()=>{creates++;assert.equal(f.records.logins.get('work')?.state,'creating');f.records.provisions.ready(original);},runner:async input=>({name:input.name!,path:'/cland/auth/codex-work',complete:async()=>input.logins.transition(input.name!,'ready')})},{harness:'codex',name:'work'});
 assert.equal(creates,1);await prepared.pending.complete(0);assert.equal(f.records.logins.get('work')?.state,'ready');
});
