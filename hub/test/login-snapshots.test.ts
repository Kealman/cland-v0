// T2: fake provider filesystem and hub clock; no native processes.
import test, {type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {LoginRecords} from '../src/host/logins.ts';
import {LoginSnapshots} from '../src/host/login-snapshots.ts';
import {FakeHostProvider} from '../src/host/provider/fake.ts';
import {FakeClock} from './fake-clock.ts';
import {fixtureEnvironment} from './fixture-environment.ts';
import {ownDirectory,onCleanup} from './process-cleanup.ts';
import {until} from './until.ts';

async function fixture(t:TestContext,signedIn=true){
 const root=await mkdtemp(join(tmpdir(),'login-snapshots-'));let db:DatabaseSync;
 ownDirectory(t,root,{beforeRemove:async()=>{assert.equal(db.isOpen,false,'database closes before root removal');}});
 db=new DatabaseSync(':memory:');
 const schedulers=new Set<LoginSnapshots>();
 const own=(scheduler:LoginSnapshots)=>{schedulers.add(scheduler);return scheduler;};
 let disposing:Promise<void>|undefined;
 const dispose=()=>disposing??=(async()=>{for(const scheduler of schedulers)await scheduler.close();db.close();})();
 onCleanup(t,dispose);
 const clock=new FakeClock(),logins=new LoginRecords(db);
 const provider=new FakeHostProvider({env:fixtureEnvironment(root,{}, {CLAND_FAKE_HOST_ROOT:root}),now:()=>clock.now().getTime(),snapshotWindowMs:1000});
 const created=await provider.createVolume({project:'test',name:'disk',region:'fake-1',sizeGiB:1});
 assert.equal(created.state,'created');if(created.state!=='created')throw Error('create');
 logins.insert({name:'work',harness:'codex',account:'work',kind:'disk',provider:'fake',region:'fake-1',volumeId:created.volume.id,snapshotIds:[],lastSignIn:signedIn?clock.now().toISOString():null});
 logins.transition('work','ready');
 const snapshots=new LoginSnapshots({logins,clock,resolve:async()=>({provider,volume:created.volume})});
 own(snapshots);
 return {dispose,db,own,logins,provider,clock,snapshots,volume:created.volume};
}
test('third confirmed backup retains only the newest two snapshots',async t=>{
 const f=await fixture(t);
 await f.snapshots.snapshot('work');
 const first=f.logins.get('work')!;assert.ok(first.kind==='disk');assert.equal(first.snapshotIds.length,1);
 await f.clock.advance(1000);await f.snapshots.snapshot('work');
 await f.clock.advance(1000);await f.snapshots.snapshot('work');
 const row=f.logins.get('work')!;assert.ok(row.kind==='disk');assert.equal(row.snapshotIds.length,2);assert.ok(!row.snapshotIds.includes(first.snapshotIds[0]!));
 const list=await f.provider.listSnapshots(f.volume);assert.equal(list.state,'listed');if(list.state==='listed')assert.deepEqual(list.snapshots.map(s=>s.id),row.snapshotIds);
});

test('in-use backup runs at 24 hours under freeze and thaw, including snapshot failure',async t=>{
 const f=await fixture(t),events:string[]=[];
 const host={name:'host-a',loginDisk:async({op}:{op:string})=>{events.push(op);}} as unknown as import('../src/host/host.ts').Host;
 const machine=await f.provider.acquire({project:'test',pool:'agents',architecture:'arm64',region:'fake-1'});assert.ok(machine.state==='created');
 await f.provider.attachVolume(f.volume,machine.machine);
 f.logins.bind('work',{host:'host-a',role:'writer',volumeId:f.volume.id});
 await f.snapshots.close();
 const scheduler=new LoginSnapshots({logins:f.logins,clock:f.clock,resolve:async()=>({provider:f.provider,volume:{...f.volume,attachedTo:machine.machine.id},host})});f.own(scheduler);
 await f.clock.advance(24*60*60*1000-1);assert.deepEqual(events,[]);
 await f.clock.advance(1);
 await until(()=>events.length===2,{what:'daily backup thaw receipt'});
 assert.deepEqual(events,['freeze','thaw']);
 const row=f.logins.get('work')!;assert.ok(row.kind==='disk');assert.equal(row.snapshotIds.length,1);
 t.mock.method(f.provider,'snapshotVolume',async()=>({state:'failed',reason:'sentinel failure'}));
 await f.clock.advance(24*60*60*1000);
 await until(()=>events.length===4,{what:'failed backup thaw receipt'});
 assert.deepEqual(events,['freeze','thaw','freeze','thaw']);
 assert.equal((f.logins.get('work') as typeof row).backup?.pending,true);
});

test('rate limit persists exact retry deadline and restart resumes detached backup',async t=>{
 const f=await fixture(t);await f.snapshots.snapshot('work');
 const refused=await f.snapshots.snapshot('work');assert.equal(refused.state,'refused');
 await f.snapshots.close();
 const scheduler=new LoginSnapshots({logins:f.logins,clock:f.clock,resolve:async()=>({provider:f.provider,volume:f.volume})});f.own(scheduler);
 await f.clock.advance(999);
 let row=f.logins.get('work')!;assert.ok(row.kind==='disk');assert.equal(row.snapshotIds.length,1);
 await f.clock.advance(1);
 await until(()=>{const row=f.logins.get('work');return row?.kind==='disk'&&row.snapshotIds.length===2;},{what:'retry snapshot persisted'});
 row=f.logins.get('work')!;assert.ok(row.kind==='disk');assert.equal(row.backup?.pending,false);
});

test('release notification returns before detached provider work and key login names its missing disk',async t=>{
 const f=await fixture(t);await f.snapshots.snapshot('work');
 await f.snapshots.snapshot('work');
 const gate=Promise.withResolvers<void>();let entered=false;
 const original=f.provider.snapshotVolume.bind(f.provider);
 t.mock.method(f.provider,'snapshotVolume',async (volume:import('../src/host/provider/provider.ts').Volume)=>{entered=true;await gate.promise;return original(volume);});

 assert.equal(f.snapshots.onReleased('work',{volumeId:f.volume.id}),undefined);
 try{await f.clock.advance(1000);await until(()=>entered,{what:'detached provider request entered'});}finally{gate.resolve();}
 await until(()=>{const row=f.logins.get('work');return row?.kind==='disk'&&row.snapshotIds.length===2;},{what:'detached backup confirmed'});
 f.logins.insert({name:'key',harness:'opencode',account:'key',kind:'key',lastSignIn:null});f.logins.transition('key','ready');
 await assert.rejects(f.snapshots.snapshot('key'),/key login has no disk/);
});

test('due backup survives a stopped hub and release makes a ready detached disk eligible',async t=>{
 const f=await fixture(t);await f.snapshots.snapshot('work');await f.snapshots.close();
 f.logins.bind('work',{host:'host-a',role:'writer',volumeId:f.volume.id});
 await f.clock.advance(24*60*60*1000);
 f.logins.unbind('work','host-a');
 const scheduler=new LoginSnapshots({logins:f.logins,clock:f.clock,resolve:async()=>({provider:f.provider,volume:f.volume})});f.own(scheduler);
 scheduler.onReleased('work',{volumeId:f.volume.id});
 await f.clock.advance(1);
 await until(()=>{const row=f.logins.get('work');return row?.kind==='disk'&&row.snapshotIds.length===2;},{what:'due released disk snapshot persisted',timeoutMs:1000});
});

for(const outcome of ['rate','failed'] as const)test(`sign-in snapshot ${outcome} preserves its terminal outcome`,async t=>{
 const f=await fixture(t);
 const {prepareLoginSignIn}=await import('../src/host/login-signin.ts');
 const acquired=await f.provider.acquire({project:'test',pool:'agents',architecture:'arm64',region:'fake-1'});assert.ok(acquired.state==='created');
 const pending=await prepareLoginSignIn({logins:f.logins,provider:f.provider,host:{loginDisk:async()=>{},publishFile:async()=>true} as unknown as import('../src/host/host.ts').Host,machine:acquired.machine,project:'test',tag:'test',region:'fake-1',providerName:'fake',harness:'codex',clock:f.clock,name:'signin'});
 const original=f.provider.snapshotVolume.bind(f.provider);
 t.mock.method(f.provider,'snapshotVolume',async()=>outcome==='rate'?{state:'refused',reason:'rate limited',retryAt:new Date(f.clock.now().getTime()+1000).toISOString()}:{state:'failed',reason:'sentinel failure'});
 if(outcome==='failed')await assert.rejects(pending.complete(0),/snapshot failed: sentinel failure/);
 else await pending.complete(0);
 let row=f.logins.get('signin')!;assert.ok(row.kind==='disk');assert.equal(row.state,outcome==='rate'?'ready':'signed-out');assert.equal(row.backup?.pending,true);
 if(outcome==='rate'){
  await f.snapshots.close();
  t.mock.method(f.provider,'snapshotVolume',original);
  const scheduler=new LoginSnapshots({logins:f.logins,clock:f.clock,resolve:async disk=>{
   const list=await f.provider.listVolumes({project:'test'});assert.ok(list.state==='listed');return {provider:f.provider,volume:list.volumes.find(volume=>volume.id===disk.volumeId)!};
  }});f.own(scheduler);
  await f.clock.advance(1000);
  await until(()=>{const row=f.logins.get('signin');return row?.kind==='disk'&&row.snapshotIds.length===1;},{what:'sign-in backup retry persisted'});
  row=f.logins.get('signin')!;assert.equal(row.state,'ready');
 }
});

test('snapshot refuses a resolved disk with a different durable volume identity',async t=>{
 const f=await fixture(t);await f.snapshots.close();let calls=0;
 t.mock.method(f.provider,'snapshotVolume',async()=>{calls++;throw Error('wrong volume called');});
 const scheduler=new LoginSnapshots({logins:f.logins,clock:f.clock,resolve:async()=>({provider:f.provider,volume:{...f.volume,id:'other-volume'}})});f.own(scheduler);
 await assert.rejects(scheduler.snapshot('work'),/volume identity changed/);assert.equal(calls,0);
});

test('unfinished pruning resumes retained snapshot deletion without creating another backup',async t=>{
 const f=await fixture(t);await f.snapshots.snapshot('work');await f.clock.advance(1000);await f.snapshots.snapshot('work');await f.clock.advance(1000);
 const original=f.provider.deleteSnapshot.bind(f.provider);
 t.mock.method(f.provider,'deleteSnapshot',async()=>({state:'incomplete',reason:'sentinel retained snapshot'}));
 await assert.rejects(f.snapshots.snapshot('work'),/deletion unconfirmed/);
 let row=f.logins.get('work')!;assert.ok(row.kind==='disk');assert.equal(row.snapshotIds.length,3);
 t.mock.method(f.provider,'deleteSnapshot',original);
 t.mock.method(f.provider,'snapshotVolume',async()=>{throw Error('must finish pruning before a new backup');});
 await f.snapshots.close();
 const scheduler=new LoginSnapshots({logins:f.logins,clock:f.clock,resolve:async()=>({provider:f.provider,volume:f.volume})});f.own(scheduler);
 await f.clock.advance(60000);
 await until(()=>{const row=f.logins.get('work');return row?.kind==='disk'&&row.snapshotIds.length===2;},{what:'retained deletion receipt persisted',timeoutMs:1000});
});

 test('legacy in-use row without a sign-in timestamp keeps one persisted daily deadline',async t=>{
 const f=await fixture(t,false);
 f.logins.bind('work',{host:'host-a',role:'writer',volumeId:f.volume.id});
 await f.snapshots.close();
 f.own(new LoginSnapshots({logins:f.logins,clock:f.clock,resolve:async()=>({provider:f.provider,volume:f.volume})}));
 await f.clock.advance(24*60*60*1000);
 await until(()=>{const row=f.logins.get('work');return row?.kind==='disk'&&row.snapshotIds.length===1;},{what:'legacy first daily backup',timeoutMs:1000});
 });

test('freeze that takes effect then rejects is still thawed and recorded',async t=>{
 const f=await fixture(t);await f.snapshots.close();const events:string[]=[];
 const host={name:'host-a',loginDisk:async({op}:{op:string})=>{events.push(op);if(op==='freeze')throw Error('lost freeze reply');}} as unknown as import('../src/host/host.ts').Host;
 const scheduler=f.own(new LoginSnapshots({logins:f.logins,clock:f.clock,resolve:async()=>({provider:f.provider,volume:{...f.volume,attachedTo:'machine-a'},host})}));
 await assert.rejects(scheduler.snapshot('work'),/lost freeze reply/);
 assert.deepEqual(events,['freeze','thaw']);
});

test('release joins a held freeze and thaw before provider snapshot starts',async t=>{
 const f=await fixture(t);await f.snapshots.close();
 const frozen=Promise.withResolvers<void>(),providerGate=Promise.withResolvers<void>();let freezeEntered=false,providerEntered=false;const events:string[]=[];
 const host={name:'host-a',loginDisk:async({op}:{op:string})=>{events.push(op);if(op==='freeze'){freezeEntered=true;await frozen.promise;}}} as unknown as import('../src/host/host.ts').Host;
 t.mock.method(f.provider,'snapshotVolume',async()=>{providerEntered=true;await providerGate.promise;return {state:'failed',reason:'released'};});
 const scheduler=f.own(new LoginSnapshots({logins:f.logins,clock:f.clock,resolve:async()=>({provider:f.provider,volume:{...f.volume,attachedTo:'machine-a'},host})}));
 const work=scheduler.snapshot('work');void work.catch(()=>{});
 try{
  await until(()=>freezeEntered,{what:'freeze request admitted'});
  let released=false;const release=scheduler.beginRelease('work').then(()=>{released=true;});
  await assert.rejects(scheduler.snapshot('work'),/releasing/);assert.equal(released,false);
  frozen.resolve();await until(()=>released,{what:'release thaw settled'});await release;
  assert.deepEqual(events,['freeze','thaw']);assert.equal(providerEntered,false);
 }finally{frozen.resolve();providerGate.resolve();await work.catch(()=>{});}
});

test('startup thaws a retained freeze and publishes its captured snapshot without another provider request',async t=>{
 const f=await fixture(t);await f.snapshots.close();
 const taken=await f.provider.snapshotVolume(f.volume);assert.ok(taken.state==='snapshotted');
 f.logins.updateBackup('work',{pending:true,freeze:{host:'host-a',identity:'generation-a',volumeId:f.volume.id},receipt:taken.snapshot});
 const events:string[]=[];
 const host={name:'host-a',loginDisk:async({op}:{op:string})=>{events.push(op);}} as unknown as import('../src/host/host.ts').Host;
 t.mock.method(f.provider,'snapshotVolume',async()=>{throw Error('duplicate after crash');});
 f.own(new LoginSnapshots({logins:f.logins,clock:f.clock,resolve:async()=>({provider:f.provider,volume:{...f.volume,attachedTo:'machine-a'},host,identity:'generation-a'})}));
 await f.clock.advance(1);
 await until(()=>{const row=f.logins.get('work');return row?.kind==='disk'&&row.snapshotIds.length===1&&!row.backup?.freeze;},{what:'recovered thaw and snapshot receipt persisted'});
 assert.deepEqual(events,['thaw']);
});

for(const boundary of ['resolve','freeze','provider'] as const)test(`ownership change after ${boundary} await fences publication and later effects`,async t=>{
 const f=await fixture(t);await f.snapshots.close();const gate=Promise.withResolvers<void>();let entered=false;const events:string[]=[];
 const pause=async()=>{entered=true;await gate.promise;};
 const host={name:'host-a',loginDisk:async({op}:{op:string})=>{events.push(op);if(op==='freeze'&&boundary==='freeze')await pause();}} as unknown as import('../src/host/host.ts').Host;
 const original=f.provider.snapshotVolume.bind(f.provider);
 t.mock.method(f.provider,'snapshotVolume',async(volume:import('../src/host/provider/provider.ts').Volume)=>{events.push('snapshot');if(boundary==='provider')await pause();return original(volume);});
 const scheduler=f.own(new LoginSnapshots({logins:f.logins,clock:f.clock,resolve:async()=>{if(boundary==='resolve')await pause();return {provider:f.provider,volume:{...f.volume,attachedTo:'machine-a'},host};}}));
 const work=scheduler.snapshot('work');void work.catch(()=>{});
 try{
  await until(()=>entered,{what:`${boundary} receipt held`});
  f.logins.bind('work',{host:'replacement',role:'writer',volumeId:f.volume.id});
 }finally{gate.resolve();}
 await assert.rejects(work,/ownership changed/);
 const row=f.logins.get('work')!;assert.ok(row.kind==='disk');assert.deepEqual(row.snapshotIds,[]);
 assert.deepEqual(events,boundary==='resolve'?[]:boundary==='freeze'?['freeze','thaw']:['freeze','snapshot','thaw']);
 assert.equal(Boolean(row.backup?.receipt),boundary==='provider');
});

for(const failThaw of [false,true])test(`release during held provider I/O retains ${failThaw?'unconfirmed':'confirmed'} thaw outcome`,async t=>{
 const f=await fixture(t);await f.snapshots.close();const gate=Promise.withResolvers<void>();let entered=false;const events:string[]=[];
 const host={name:'host-a',loginDisk:async({op}:{op:string})=>{events.push(op);if(op==='thaw'&&failThaw)throw Error('unconfirmed thaw');}} as unknown as import('../src/host/host.ts').Host;
 t.mock.method(f.provider,'snapshotVolume',async()=>{entered=true;await gate.promise;return {state:'failed',reason:'held provider released'};});
 const scheduler=f.own(new LoginSnapshots({logins:f.logins,clock:f.clock,resolve:async()=>({provider:f.provider,volume:{...f.volume,attachedTo:'machine-a'},host})}));
 const work=scheduler.snapshot('work');void work.catch(()=>{});
 try{
  await until(()=>entered,{what:'provider snapshot held'});
  if(failThaw)await assert.rejects(scheduler.beginRelease('work'),/unconfirmed thaw/);
  else {let released=false;const release=scheduler.beginRelease('work').then(()=>{released=true;});await until(()=>released,{what:'release thaw receipt before provider completes'});await release;}
  await assert.rejects(scheduler.snapshot('work'),/releasing/);
  const row=f.logins.get('work');assert.ok(row?.kind==='disk'&&row.backup?.releasing);assert.equal(Boolean(row.backup.freeze),failThaw);
 }finally{gate.resolve();await work.catch(()=>{});}
 assert.deepEqual(events,['freeze','thaw']);
});

 test('fixture cleanup joins held snapshot work before database and root disposal',async t=>{
 const f=await fixture(t),gate=Promise.withResolvers<void>();let entered=false;
 t.mock.method(f.provider,'snapshotVolume',async()=>{entered=true;await gate.promise;return {state:'failed',reason:'fixture closure'};});
 const work=f.snapshots.snapshot('work');void work.catch(()=>{});
 try{
  await until(()=>entered,{what:'fixture provider effect held'});
  const closing=f.dispose();assert.equal(f.db.isOpen,true);
  gate.resolve();await work;await closing;assert.equal(f.db.isOpen,false);
 }finally{gate.resolve();await work.catch(()=>{});}
 });

test('startup keeps a freeze fenced when its host generation is replaced',async t=>{
 const f=await fixture(t);await f.snapshots.close();let effects=0;
 f.logins.updateBackup('work',{pending:true,freeze:{host:'host-a',identity:'old-generation',volumeId:f.volume.id}});
 const host={name:'host-a',loginDisk:async()=>{effects++;}} as unknown as import('../src/host/host.ts').Host;
 t.mock.method(f.provider,'snapshotVolume',async()=>{effects++;throw Error('unowned provider request');});
 let reported=false;
 f.own(new LoginSnapshots({logins:f.logins,clock:f.clock,report:()=>{reported=true;},resolve:async()=>({provider:f.provider,volume:{...f.volume,attachedTo:'machine-a'},host,identity:'replacement-generation'})}));
 await f.clock.advance(1);await until(()=>reported,{what:'replaced freeze owner refusal recorded'});
 const row=f.logins.get('work');assert.ok(row?.kind==='disk'&&row.backup?.freeze);assert.equal(effects,0);
});

test('retained snapshot receipt from another volume is refused before publication',async t=>{
 const f=await fixture(t);await f.snapshots.close();
 f.logins.updateBackup('work',{pending:true,receipt:{id:'old-snapshot',volumeId:'old-volume',created:f.clock.now().toISOString()}});
 const scheduler=f.own(new LoginSnapshots({logins:f.logins,clock:f.clock,resolve:async()=>({provider:f.provider,volume:f.volume})}));
 await assert.rejects(scheduler.snapshot('work'),/snapshot receipt volume mismatch/);
 const row=f.logins.get('work');assert.ok(row?.kind==='disk');assert.deepEqual(row.snapshotIds,[]);
});

test('changing volume cannot transplant an in-flight snapshot outcome onto a new disk',async t=>{
 const f=await fixture(t);await f.snapshots.close();const gate=Promise.withResolvers<void>();let accepted=false;
 const original=f.provider.snapshotVolume.bind(f.provider);
 t.mock.method(f.provider,'snapshotVolume',async(volume:import('../src/host/provider/provider.ts').Volume,options:import('../src/host/provider/provider.ts').SnapshotVolumeOptions)=>{const result=await original(volume,options);accepted=true;await gate.promise;return result;});
 const scheduler=f.own(new LoginSnapshots({logins:f.logins,clock:f.clock,resolve:async()=>({provider:f.provider,volume:f.volume})}));
 const work=scheduler.snapshot('work');void work.catch(()=>{});
 try{
  await until(()=>accepted,{what:'old volume snapshot accepted before reply'});
  f.logins.bind('work',{host:'host-a',role:'writer',volumeId:f.volume.id});f.logins.transition('work','signed-out');f.logins.transition('work','creating');
  assert.throws(()=>f.logins.updateCreatingDisk('work',{volumeId:'replacement-volume'}),/snapshot ownership/);
 }finally{gate.resolve();await work.catch(()=>{});}
 const row=f.logins.get('work');assert.ok(row?.kind==='disk');assert.equal(row.volumeId,f.volume.id);assert.deepEqual(row.snapshotIds,[]);
});

test('successful provider send queued before release is refused at its final send boundary',async t=>{
 const f=await fixture(t);await f.snapshots.close();const gate=Promise.withResolvers<void>();let queued=false;
 const original=f.provider.snapshotVolume.bind(f.provider);
 t.mock.method(f.provider,'snapshotVolume',async(volume:import('../src/host/provider/provider.ts').Volume,options:import('../src/host/provider/provider.ts').SnapshotVolumeOptions)=>{queued=true;await gate.promise;return original(volume,options);});
 const events:string[]=[];
 const host={name:'host-a',loginDisk:async({op}:{op:string})=>{events.push(op);}} as unknown as import('../src/host/host.ts').Host;
 const scheduler=f.own(new LoginSnapshots({logins:f.logins,clock:f.clock,resolve:async()=>({provider:f.provider,volume:{...f.volume,attachedTo:'machine-a'},host})}));
 const work=scheduler.snapshot('work');void work.catch(()=>{});
 try{
  await until(()=>queued,{what:'successful snapshot send queued'});
  let released=false;const releasing=scheduler.beginRelease('work').then(()=>{released=true;});
  await until(()=>released,{what:'thaw completed while send still queued'});await releasing;
 }finally{gate.resolve();}
 await assert.rejects(work,/ownership changed/);
 assert.deepEqual(events,['freeze','thaw']);
 assert.deepEqual(await f.provider.listSnapshots(f.volume),{state:'listed',snapshots:[]});
});
