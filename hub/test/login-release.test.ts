// T2: destroy boundary with directory provider, recording Host and FakeClock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { Store } from '../src/hub/store.ts';
import { HostHealth, loseHost } from '../src/host/host-health.ts';
import { destroyHost } from '../src/host/provision-host.ts';
import { installLoginRelease } from '../src/host/login-release.ts';
import { FakeHostProvider } from '../src/host/provider/fake.ts';
import { testHost } from '../src/host/test-host.ts';
import { tempProject, eventually } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { onCleanup } from './process-cleanup.ts';
import { testWaitMs } from './until.ts';

async function fixture(t:test.TestContext,count=1,installed=true,clock=new FakeClock(Date.now())) {
 const root=await tempProject(t);
 const env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root});
 const store=new Store(join(root,'hub.db'));const teardown=new AsyncDisposableStack();
 onCleanup(t,()=>teardown.disposeAsync());teardown.defer(()=>store.close());
 const own=(step:()=>unknown|Promise<unknown>)=>teardown.defer(async()=>{await step();});
 const provider=new FakeHostProvider({env,now:()=>clock.now().getTime()});
 const acquired=await provider.acquire({project:root,pool:'agents',architecture:'x86_64',region:'fake-1'});
 if(acquired.state!=='created')throw Error('fixture acquisition failed');
 const machine=acquired.machine,id=machine.id,events:string[]=[],notices:string[]=[];
 store.hosts.insert({id,address:machine.address,user:'agent',clientKeyPath:'unused',knownHosts:'unused'},'synthetic');
 store.hosts.provisions.ready({id,pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:machine.created,state:'ready',machine});
 const host={...testHost(id,()=>{}),loginDisk:async(_input:import('../src/host/agent/resource-types.ts').LoginDisk)=>{events.push('umount');}};
 for(let i=0;i<count;i++) {
  const result=await provider.createVolume({project:root,name:'login-'+i,region:'fake-1',sizeGiB:1});
  if(result.state!=='created')throw Error('fixture volume failed');
  await provider.attachVolume(result.volume,machine);
  store.hosts.logins.insert({name:'login-'+i,harness:'codex',account:'work',kind:'disk',provider:'fake',region:'fake-1',volumeId:result.volume.id,snapshotIds:[],lastSignIn:null});
  store.hosts.logins.transition('login-'+i,'ready');store.hosts.logins.bind('login-'+i,{host:id,role:'writer',volumeId:result.volume.id,phase:'settled'});
 }
 if(installed)installLoginRelease(store.hosts,{host:()=>host,beginRelease:async()=>{events.push('fence');},onReleased:()=>{events.push('ready');},notice:text=>notices.push(text)});
 const release=provider.release.bind(provider);t.mock.method(provider,'release',async(...args:Parameters<typeof release>)=>{events.push('delete');return release(...args);});
 const detach=provider.detachVolume.bind(provider);t.mock.method(provider,'detachVolume',async(...args:Parameters<typeof detach>)=>{events.push('detach');return detach(...args);});
 const input={root,id,env,clock,records:store.hosts,provider,owner:{hosts:[host],remove:async()=>({inventoryComplete:true,timedOut:false,leftovers:[]})} as unknown as Parameters<typeof destroyHost>[0]['owner'],log:()=>{}};
 return {input,store,host,provider,events,notices,own};
}
test('host stop unmounts and detaches the same volume before deletion',async t=>{
 const f=await fixture(t),before=f.store.hosts.logins.get('login-0');
 const result=await destroyHost(f.input);
 assert.equal(result.state,'destroyed');assert.deepEqual(f.events,['fence','umount','detach','ready','delete']);
 assert.deepEqual(f.store.hosts.logins.get('login-0'),{...before,state:'ready'});
 assert.deepEqual(f.store.hosts.logins.bindings('login-0'),[]);
});
test('two login unmounts run concurrently before detach',async t=>{
 const f=await fixture(t,2),gate=Promise.withResolvers<void>();let entered=0;
 f.host.loginDisk=async()=>{entered++;await gate.promise;};
 const work=destroyHost(f.input);f.own(async()=>{gate.resolve();await work;});
 await eventually('both unmounts entered',()=>entered===2?true:undefined,testWaitMs());
 assert.equal(f.events.includes('detach'),false);gate.resolve();assert.equal((await work).state,'destroyed');
});
test('writers remaining retain host and binding and emit one notice',async t=>{
 const f=await fixture(t);f.host.loginDisk=async()=>{throw Object.assign(Error('writers remain'),{code:'writers-remain'});};
 for(let i=0;i<2;i++)assert.equal((await destroyHost(f.input)).release,'incomplete');
 assert.equal(f.events.includes('delete'),false);assert.equal(f.store.hosts.logins.get('login-0')?.state,'in-use');
 assert.equal(f.notices.length,1);assert.match(f.notices[0]!,new RegExp(f.input.id));assert.match(f.notices[0]!,/login-0/);
});
for(const pending of [false,true])test(`lost host retains ${pending?'pending binding':'settled binding until detached inventory'}`,async t=>{
 const f=await fixture(t);
 if(pending){f.store.hosts.logins.unbind('login-0',f.input.id);const row=f.store.hosts.logins.get('login-0')!;if(row.kind!=='disk')throw Error('fixture disk');f.store.hosts.logins.bind(row.name,{host:f.input.id,role:'writer',volumeId:row.volumeId,phase:'pending'});}
 const list=f.provider.listVolumes.bind(f.provider);let attached=true;
 t.mock.method(f.provider,'listVolumes',async(...args:Parameters<typeof list>)=>{const result=await list(...args);if(attached&&result.state==='listed')return {...result,volumes:result.volumes.map(v=>({...v,attachedTo:f.input.id}))};return result;});
 const result=await destroyHost({...f.input,lost:true});
 assert.equal(f.events.includes('umount'),false);assert.equal(f.events.includes('detach'),false);
 assert.equal(f.store.hosts.logins.get('login-0')?.state,'in-use');
 if(pending){assert.equal(result.state,'destroyed');assert.equal(f.store.hosts.logins.bindings('login-0')[0]?.phase,'pending');}
 else {assert.equal(result.release,'incomplete');attached=false;assert.equal((await destroyHost({...f.input,lost:true})).state,'destroyed');assert.equal(f.store.hosts.logins.get('login-0')?.state,'ready');}
});
test('snapshot thaw refusal prevents unmount and machine deletion',async t=>{
 const f=await fixture(t);installLoginRelease(f.store.hosts,{host:()=>f.host,beginRelease:async()=>{throw Error('thaw unconfirmed');},onReleased:()=>{},notice:()=>{}});
 assert.equal((await destroyHost(f.input)).release,'incomplete');assert.deepEqual(f.events,[]);
});
test('host without logins requires no release owner',async t=>{
 const f=await fixture(t,0,false);assert.equal((await destroyHost(f.input)).state,'destroyed');assert.deepEqual(f.events,['delete']);
});

test('provider gone receipt skips unmount and frees only detached disk',async t=>{
 const f=await fixture(t);const release=f.provider.release.bind(f.provider);await release(f.input.records.provisions.get(f.input.id)!.machine!);
 const result=await destroyHost(f.input);assert.equal(result.state,'destroyed');assert.equal(f.events.includes('umount'),false);assert.equal(f.store.hosts.logins.get('login-0')?.state,'ready');
});
test('concurrent stop callers join one release',async t=>{
 const f=await fixture(t);const [a,b]=await Promise.all([destroyHost(f.input),destroyHost(f.input)]);assert.equal(a.state,'destroyed');assert.equal(b.state,'destroyed');assert.equal(f.events.filter(e=>e==='delete').length,1);
});

for(const gone of [false,true])test(`health ${gone?'gone receipt':'15-minute loss'} reaches login release`,async t=>{
 const f=await fixture(t);let completed=false;
 const health=new HostHealth({records:f.store.hosts,clock:f.input.clock,env:f.input.env,notice:()=>{},status:async()=>({state:gone?'gone':'ready'}),error:error=>{throw error;},lost:async id=>{await loseHost({...f.input,id,inUse:()=>false,log:()=>{}});completed=true;}});
 f.own(()=>health.close());health.transition(f.input.id,false);
 if(!gone){await f.input.clock.advance(899999);assert.equal(f.events.includes('delete'),false);await f.input.clock.advance(1);}
 await eventually('health deletion and login release completed',()=>completed?true:undefined,testWaitMs());
 assert.equal(f.store.hosts.provisions.get(f.input.id)?.state,'destroyed');assert.equal(f.store.hosts.logins.get('login-0')?.state,'ready');assert.equal(f.events.includes('umount'),false);
});
test('refusal then hard deadline emits exactly one destruction notice after detached read',async t=>{
 const clock=new FakeClock(Date.now()),f=await fixture(t,1,true,clock);f.host.loginDisk=async()=>{throw Error('writers remain');};
 assert.equal((await destroyHost(f.input)).release,'incomplete');assert.equal(f.notices.length,1);
 const release=f.provider.release.bind(f.provider);let completed=false,work:Promise<void>|undefined;
 f.own(async()=>{await work;});
 clock.setTimeout(()=>{work=(async()=>{await release(f.input.records.provisions.get(f.input.id)!.machine!);await destroyHost(f.input);completed=true;})();},900000);
 await f.input.clock.advance(899999);assert.equal(f.notices.length,1);assert.equal(f.store.hosts.logins.get('login-0')?.state,'in-use');
 await f.input.clock.advance(1);await eventually('deadline deletion reconciled',()=>completed?true:undefined,testWaitMs());
 assert.equal(f.store.hosts.logins.get('login-0')?.state,'ready');assert.equal(f.notices.length,2);assert.match(f.notices[1]!,/login-0.*deadline|deadline.*login-0/);
 assert.ok(f.notices[1]!.includes(f.input.id));await destroyHost(f.input);assert.equal(f.notices.length,2);
});

import { LoginSnapshots } from '../src/host/login-snapshots.ts';
for(const lost of [true,false])test(`held freeze on ${lost?'lost':'gone'} host is abandoned without host calls`,async t=>{
 const f=await fixture(t);const row=f.store.hosts.logins.get('login-0');assert.ok(row?.kind==='disk');
 f.store.hosts.logins.updateBackup(row.name,{pending:false,freeze:{host:f.input.id,identity:'captured',volumeId:row.volumeId!}});
 const scheduler=new LoginSnapshots({logins:f.store.hosts.logins,clock:f.input.clock,resolve:async()=>{throw Error('lost host must not be resolved');}});f.own(()=>scheduler.close());
 installLoginRelease(f.store.hosts,{host:()=>{throw Error('lost host must not be called');},beginRelease:(name,options)=>scheduler.beginRelease(name,options),onReleased:(name,receipt)=>scheduler.onReleased(name,receipt),notice:()=>{}});
 if(!lost)await f.provider.release(f.input.records.provisions.get(f.input.id)!.machine!);
 assert.equal((await destroyHost({...f.input,lost})).state,'destroyed');
 const next=f.store.hosts.logins.get(row.name);assert.ok(next?.kind==='disk');assert.equal(next.backup?.freeze,undefined);assert.match(next.backup?.outcome??'',/abandoned with lost host/);assert.equal(next.state,'ready');
});

import { LOGIN_RELEASE_RETRY_MS } from '../src/host/login-release-owner.ts';
function retryOwner(f:Awaited<ReturnType<typeof fixture>>,records=f.store.hosts){
 const owner=installLoginRelease(records,{clock:f.input.clock,retry:id=>destroyHost({...f.input,id,records}),host:()=>f.host,beginRelease:async()=>{},onReleased:()=>{},notice:text=>f.notices.push(text)});
 f.own(()=>owner.close());return owner;
}
test('destroyed host release retry settles disk without a provision write',async t=>{
 const f=await fixture(t,1,false),records=f.store.hosts;
 await f.provider.release(f.input.records.provisions.get(f.input.id)!.machine!);
 records.revoke(f.input.id);
 records.provisions.save({...records.provisions.get(f.input.id)!,state:'destroyed',release:'released',machineDeletionRead:'confirmed absent'});
 const terminal=records.provisions.get(f.input.id),states:string[]=[],writes:string[]=[];
 const save=records.provisions.save.bind(records.provisions);
 t.mock.method(records.provisions,'save',(record:Parameters<typeof save>[0])=>{writes.push(record.state);return save(record);});
 const owner=installLoginRelease(records,{clock:f.input.clock,retry:id=>destroyHost({...f.input,id}),host:()=>undefined,beginRelease:async()=>{states.push(records.provisions.get(f.input.id)!.state);},onReleased:()=>{states.push(records.provisions.get(f.input.id)!.state);},notice:()=>{}});
 f.own(()=>owner.close());
 await f.input.clock.advance(LOGIN_RELEASE_RETRY_MS);
 await eventually('destroyed host retry released disk',()=>records.logins.get('login-0')?.state==='ready'?true:undefined,testWaitMs());
 await owner.close();
 assert.deepEqual(writes,[],'terminal provision receives no retry writes');
 assert.ok(states.length>=2,'release callbacks ran');
 assert.deepEqual([...new Set(states)],['destroyed'],'every release callback observes terminal destruction');
 assert.deepEqual(records.provisions.get(f.input.id),terminal);
 assert.deepEqual(records.logins.forHost(f.input.id),[]);
});
async function delayedDetach(t:test.TestContext){
 const f=await fixture(t);let attached=true,reads=0;
 const list=f.provider.listVolumes.bind(f.provider);
 t.mock.method(f.provider,'listVolumes',async(...args:Parameters<typeof list>)=>{reads++;const result=await list(...args);return attached&&result.state==='listed'?{...result,volumes:result.volumes.map(v=>({...v,attachedTo:f.input.id}))}:result;});
 return {...f,detached:()=>{attached=false;},reads:()=>reads};
}
test('automatic detached retry stops after positive inventory',async t=>{
 const f=await delayedDetach(t);retryOwner(f);
 assert.equal((await destroyHost({...f.input,lost:true})).release,'incomplete');
 f.detached();await f.input.clock.advance(LOGIN_RELEASE_RETRY_MS);
 await eventually('automatic retry persisted ready',()=>f.store.hosts.logins.get('login-0')?.state==='ready'?true:undefined,testWaitMs());
 const reads=f.reads();await f.input.clock.advance(120000);assert.equal(f.reads(),reads);assert.equal(f.store.hosts.provisions.get(f.input.id)?.state,'destroyed');
});
test('restart recovers detached retry without decoding retained login history',async t=>{
 const f=await delayedDetach(t),owner=retryOwner(f);
 for(let i=0;i<500;i++){f.store.hosts.logins.insert({name:'old-'+i,harness:'codex',account:'old',kind:'disk',provider:'fake',region:'fake-1',volumeId:'retained',snapshotIds:[],lastSignIn:null});f.store.hosts.logins.markSignedOut('old-'+i,{reason:'fixture signed out',host:null});}
 await destroyHost({...f.input,lost:true});await owner.close();f.detached();
 const reopened=new Store(join(f.input.root,'hub.db'));f.own(()=>reopened.close());
 t.mock.method(reopened.hosts.logins,'list',()=>{throw Error('full list forbidden');});let decodes=0;const get=reopened.hosts.logins.get.bind(reopened.hosts.logins);t.mock.method(reopened.hosts.logins,'get',(name:string)=>{decodes++;return get(name);});
 retryOwner(f,reopened.hosts);assert.equal(decodes,0,'recovery cursor decodes no login records');
 await f.input.clock.advance(LOGIN_RELEASE_RETRY_MS);await eventually('restart retry persisted destroyed',()=>reopened.hosts.provisions.get(f.input.id)?.state==='destroyed'?true:undefined,testWaitMs());
 assert.ok(decodes<12,`only bound disk decoded, got ${decodes}`);assert.equal(reopened.hosts.logins.get('login-0')?.state,'ready');
});
test('close joins held retry before storage closes',async t=>{
 const f=await delayedDetach(t),owner=retryOwner(f);await destroyHost({...f.input,lost:true});
 const gate=Promise.withResolvers<void>(),list=f.provider.listVolumes.bind(f.provider);let entered=false,closed=false;
 t.mock.method(f.provider,'listVolumes',async(...args:Parameters<typeof list>)=>{entered=true;await gate.promise;return list(...args);});
 f.own(async()=>{gate.resolve();await owner.close();});await f.input.clock.advance(LOGIN_RELEASE_RETRY_MS);
 await eventually('retry inventory held',()=>entered?true:undefined,testWaitMs());
 const closing=owner.close().then(()=>{closed=true;});assert.equal(closed,false);assert.ok(f.store.hosts.logins.get('login-0'));gate.resolve();await closing;
 const reads=f.reads();await f.input.clock.advance(120000);assert.equal(f.reads(),reads);
});
test('forced fixture body failure joins held destroy and health before SQLite close',async t=>{
 let joined=false,storageClosed=false;
 await t.test('caught failure retains ordered teardown',async scope=>{
  const f=await fixture(scope),gate=Promise.withResolvers<void>();let entered=false;
  const close=f.store.close.bind(f.store);f.store.close=()=>{assert.equal(joined,true);storageClosed=true;close();};
  f.host.loginDisk=async()=>{entered=true;await gate.promise;};const work=destroyHost(f.input);
  f.own(async()=>{gate.resolve();await work;joined=true;});
  await eventually('held native release before forced failure',()=>entered?true:undefined,testWaitMs());
  await assert.rejects(async()=>{throw Error('forced body failure');},/forced body failure/);
 });assert.equal(joined,true);assert.equal(storageClosed,true);
});

import { writeFile, mkdir } from 'node:fs/promises';
test('fake volume inventory ignores an in-progress atomic write but refuses corrupt canonical records',async t=>{
 const f=await fixture(t),row=f.store.hosts.logins.get('login-0');assert.ok(row?.kind==='disk');
 await writeFile(join(f.input.root,'volumes',row.volumeId+'.json.00000000-0000-0000-0000-000000000000.tmp'),'{');
 const listed=await f.provider.listVolumes({project:f.input.root});assert.equal(listed.state,'listed');if(listed.state==='listed')assert.equal(listed.volumes.length,1);
 await writeFile(join(f.input.root,'volumes',row.volumeId+'.json'),'{');
 assert.deepEqual(await f.provider.listVolumes({project:f.input.root}),{state:'failed',reason:'fake volume list failed'});
});
test('reachable held freeze with refused thaw still blocks release',async t=>{
 const f=await fixture(t),row=f.store.hosts.logins.get('login-0');assert.ok(row?.kind==='disk');
 const inventory=await f.provider.listVolumes({project:f.input.root});assert.ok(inventory.state==='listed');const volume=inventory.volumes[0]!;
 f.store.hosts.logins.updateBackup(row.name,{pending:false,freeze:{host:f.input.id,identity:'captured',volumeId:row.volumeId!}});
 f.host.loginDisk=async input=>{f.events.push(input.op);throw Error('thaw refused');};
 const scheduler=new LoginSnapshots({logins:f.store.hosts.logins,clock:f.input.clock,resolve:async()=>({provider:f.provider,volume,host:f.host,identity:'captured'})});f.own(()=>scheduler.close());
 installLoginRelease(f.store.hosts,{host:()=>f.host,beginRelease:(name,options)=>scheduler.beginRelease(name,options),onReleased:(name,receipt)=>scheduler.onReleased(name,receipt),notice:()=>{}});
 assert.equal((await destroyHost(f.input)).release,'incomplete');assert.deepEqual(f.events,['thaw']);assert.equal(f.store.hosts.logins.get(row.name)?.state,'in-use');
});
test('refusal then deleted attached inventory and automatic detach emit two total notices',async t=>{
 const f=await delayedDetach(t);retryOwner(f);f.host.loginDisk=async()=>{throw Error('writers remain');};
 assert.equal((await destroyHost(f.input)).release,'incomplete');assert.equal(f.notices.length,1);
 await f.provider.release(f.input.records.provisions.get(f.input.id)!.machine!);
 assert.equal((await destroyHost(f.input)).release,'incomplete');assert.equal(f.notices.length,1,'attached inventory retry does not add an intermediate notice');
 f.detached();await f.input.clock.advance(LOGIN_RELEASE_RETRY_MS);
 await eventually('terminal release notice persisted',()=>f.store.hosts.provisions.get(f.input.id)?.state==='destroyed'?true:undefined,testWaitMs());
 assert.equal(f.notices.length,2);assert.match(f.notices[1]!,/deadline destruction/);assert.ok(f.notices[1]!.includes(f.input.id));assert.match(f.notices[1]!,/login-0/);
 await f.input.clock.advance(120000);assert.equal(f.notices.length,2);
});
test('unreachable tunnel deletes and settles session before held volume reconciliation',async t=>{
 const f=await fixture(t),gate=Promise.withResolvers<void>();let read=false,settled=false;
 Object.assign(f.host,{loginDiskReachable:()=>false});f.host.loginDisk=async()=>{throw Error('unreachable host must not be called');};
 const list=f.provider.listVolumes.bind(f.provider);t.mock.method(f.provider,'listVolumes',async(...args:Parameters<typeof list>)=>{read=true;await gate.promise;return list(...args);});
 const work=destroyHost({...f.input,settleDeleted:()=>{settled=true;}});f.own(async()=>{gate.resolve();await work;});
 await eventually('session settlement precedes held volume read',()=>read&&settled?true:undefined,testWaitMs());
 assert.equal(f.store.hosts.logins.get('login-0')?.state,'in-use');gate.resolve();assert.equal((await work).state,'destroyed');assert.equal(f.store.hosts.logins.get('login-0')?.state,'ready');
});

import { reconcileHostLeases } from '../src/host/host-restart.ts';
import { fakeLockProcesses } from './fakes/lock-processes.ts';
test('gone startup revokes and settles spend before installed owner reconciles destroyed host disk',async t=>{
 const f=await fixture(t,1,false),processes=fakeLockProcesses().processes;
 await f.store.hosts.leases.create(f.input.id,{root:f.input.root,env:f.input.env,clock:f.input.clock,processes,leaseMs:3600000,caps:{shared:10,hosts:10},pool:'agents',size:'fake',priceHourly:0,billingMinimumMs:0});
 const row=f.store.hosts.logins.get('login-0');assert.ok(row?.kind==='disk');
 f.store.hosts.logins.updateBackup(row.name,{pending:false,freeze:{host:f.input.id,identity:'old-kernel',volumeId:row.volumeId!}});
 await f.provider.release(f.input.records.provisions.get(f.input.id)!.machine!);
 let reads=0,detached=false;const list=FakeHostProvider.prototype.listVolumes;
 t.mock.method(FakeHostProvider.prototype,'listVolumes',async function(this:FakeHostProvider,...args:Parameters<typeof list>){reads++;const result=await list.apply(this,args);return !detached&&result.state==='listed'?{...result,volumes:result.volumes.map(v=>({...v,attachedTo:f.input.id}))}:result;});
 await reconcileHostLeases({root:f.input.root,env:f.input.env,clock:f.input.clock,records:f.store.hosts,processes,log:()=>{}});
 assert.equal(reads,0,'startup does not await volume inventory');
 assert.equal(f.store.hosts.get(f.input.id)?.state,'revoked');assert.equal(f.store.hosts.provisions.get(f.input.id)?.state,'destroyed');assert.ok(f.store.hosts.provisions.get(f.input.id)?.machineDeletionRead);assert.equal(f.store.hosts.leases.get(f.input.id),null);assert.equal(f.store.hosts.logins.get(row.name)?.state,'in-use');
 const reopened=new Store(join(f.input.root,'hub.db'));f.own(()=>reopened.close());
 const scheduler=new LoginSnapshots({logins:reopened.hosts.logins,clock:f.input.clock,resolve:async()=>{throw Error('lost host resolution forbidden');}});f.own(()=>scheduler.close());
 let retryCompleted=false;
 const owner=installLoginRelease(reopened.hosts,{clock:f.input.clock,retry:async id=>{try{return await destroyHost({...f.input,id,records:reopened.hosts});}finally{retryCompleted=true;}},host:()=>undefined,beginRelease:(name,options)=>scheduler.beginRelease(name,options),onReleased:(name,receipt)=>scheduler.onReleased(name,receipt),notice:()=>{}});f.own(()=>owner.close());
 await f.input.clock.advance(LOGIN_RELEASE_RETRY_MS);await eventually('destroyed host attached inventory retry completed',()=>retryCompleted?true:undefined,testWaitMs());
 assert.ok(reads>0);assert.equal(reopened.hosts.provisions.get(f.input.id)?.state,'destroyed');assert.equal(reopened.hosts.provisions.get(f.input.id)?.release,'released');
 assert.equal(reopened.hosts.logins.get(row.name)?.state,'in-use');detached=true;
 await f.input.clock.advance(2*LOGIN_RELEASE_RETRY_MS);await eventually('later detached inventory releases disk',()=>reopened.hosts.logins.get(row.name)?.state==='ready'?true:undefined,testWaitMs());
 const final=reopened.hosts.logins.get(row.name);assert.ok(final?.kind==='disk');assert.equal(final.backup?.releasing,false);assert.equal(final.backup?.freeze,undefined);
});

import { projectHub } from './harness.ts';
test('dispatcher composition recovers a destroyed host disk from durable startup records',async t=>{
 const root=await tempProject(t),clock=new FakeClock(Date.now()),env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root});
 const provider=new FakeHostProvider({env,now:()=>clock.now().getTime()});const acquired=await provider.acquire({project:root,pool:'agents',architecture:'x86_64',region:'fake-1'});assert.ok(acquired.state==='created');
 const made=await provider.createVolume({project:root,name:'recover',region:'fake-1',sizeGiB:1});assert.ok(made.state==='created');await provider.attachVolume(made.volume,acquired.machine);
 await mkdir(join(root,'.cland'),{recursive:true});
 const metadata=new Store(join(root,'.cland/hub.db'));try{
  metadata.hosts.insert({id:acquired.machine.id,address:acquired.machine.address,user:'agent',clientKeyPath:'unused',knownHosts:'unused'},'sentinel');metadata.hosts.revoke(acquired.machine.id);
  metadata.hosts.provisions.save({id:acquired.machine.id,pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:acquired.machine.created,state:'destroyed',machine:acquired.machine,machineDeletionRead:'confirmed gone',release:'released'});
  metadata.hosts.logins.insert({name:'recover',harness:'codex',account:'work',kind:'disk',provider:'fake',region:'fake-1',volumeId:made.volume.id,snapshotIds:[],lastSignIn:clock.now().toISOString()});metadata.hosts.logins.transition('recover','ready');metadata.hosts.logins.bind('recover',{host:acquired.machine.id,role:'writer',volumeId:made.volume.id,phase:'settled'});
 }finally{metadata.close();}
 await provider.release(acquired.machine);
 await projectHub(t,root,{CLAND_FAKE_HOST_ROOT:root},{clock,processes:fakeLockProcesses().processes,droplet:{processes:fakeLockProcesses().processes}});
 const store=new Store(join(root,'.cland/hub.db'));onCleanup(t,()=>store.close());
 await clock.advance(LOGIN_RELEASE_RETRY_MS);await eventually('composed release owner reaches terminal retry receipt',()=>{const row=store.hosts.provisions.get(acquired.machine.id);return store.hosts.logins.get('recover')?.state==='ready'||row?.release==='incomplete'?true:undefined;},testWaitMs());
 assert.equal(store.hosts.logins.get('recover')?.state,'ready',JSON.stringify({provision:store.hosts.provisions.get(acquired.machine.id)?.state,release:store.hosts.provisions.get(acquired.machine.id)?.release}));
});
