// T2: injected create checkpoint, directory provider and FakeClock; no native children.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { projectHub, tempProject, eventually } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { onCleanup } from './process-cleanup.ts';
import { fakeLockProcesses } from './fakes/lock-processes.ts';
import { FakeClock } from './fake-clock.ts';
import { FakeHostProvider } from '../src/host/provider/fake.ts';
import { Store } from '../src/hub/store.ts';
import { testHost } from '../src/host/test-host.ts';
import { HostSecretStore } from '../src/host/records.ts';
import { sessionUi } from './session-credential-fixture.ts';
import { releaseHostLogins } from '../src/host/login-release.ts';
import { readHostPools } from '../src/host/pools.ts';
import { testWaitMs } from './until.ts';

async function fixture(t:test.TestContext,clock=new FakeClock(Date.now()),limited=false) {
 const root=await tempProject(t);
 const env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root});
 const provider=new FakeHostProvider({env,now:()=>clock.now().getTime()});
 const machineResult=await provider.acquire({project:root,pool:'agents',region:'fake-1',architecture:'x86_64'});
 if(machineResult.state!=='created')throw Error('fixture machine failed');
 const machine=machineResult.machine;
 await mkdir(join(root,'.cland'),{recursive:true});
 const config={agents:{provider:'fake',size:'fake',region:'fake-1',slots:8,min_hosts:0,max_hosts:1}};
 await writeFile(join(root,'.cland/config.toml'),'[hosts.agents]\nprovider="fake"\nsize="fake"\nregion="fake-1"\nslots=8\nmin_hosts=0\nmax_hosts=1\n');
 await writeFile(join(root,'.cland/roles.toml'),'[implementer.launch]\npool="agents"\n');
 if(limited){
  const {AccountLimits}=await import('../src/accounts/limits.ts');
  const metadata=new Store(join(root,'.cland/hub.db'));
  try {new AccountLimits({read:key=>metadata.meta(key),write:(key,value)=>metadata.setMeta(key,value)}).mark('work',{since:clock.now().toISOString(),reason:'fixture exhausted',session:'previous',resetsAt:null});}
  finally {metadata.close();}
 }

 const mounts:string[]=[],gate=Promise.withResolvers<void>(),boot=Promise.withResolvers<void>();
 const host={...testHost(machine.id,()=>{}),realpath:async(p:string)=>p,statDirectory:async()=>({refusal:null,identity:null}),loginDisk:async(input:import('../src/host/agent/resource-types.ts').LoginDisk)=>{mounts.push(input.op);}};
 const creationAbort=new AbortController(),failureEntered=Promise.withResolvers<void>();
 let bindings:import('../src/host/login-binding.ts').ProvisionLoginWork|undefined;
 let completed=false,failure=false;const started=clock.now().getTime();
 onCleanup(t,()=>{boot.resolve();gate.resolve();});
 const hub=await projectHub(t,root,env as Record<string,string>,{hosts:[host],clock,processes:fakeLockProcesses().processes,droplet:{processes:fakeLockProcesses().processes},createHost:async options=>{
  options.admit?.('agents',readHostPools(config).pools.agents!);
  await boot.promise;
  const row={id:machine.id,pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:clock.now().toISOString(),machine,state:'connecting' as const};
  options.records.provisions.save(row);
  const binding=options.onConnecting?.(row,AbortSignal.any([options.signal!,creationAbort.signal]));
  bindings=binding;
  await gate.promise;
  if(failure){
   failureEntered.resolve();
   await binding?.failed();
   const finish=await releaseHostLogins({records:options.records,id:row.id,root,provider,machine,clock});
   await provider.release(machine);await finish();
   const result={...row,state:'failed' as const,release:'released' as const};options.records.provisions.save(result);completed=true;return result;
  }
  await clock.advance(1000);
  new HostSecretStore(root,options.records,()=>{}).register({id:machine.id,address:machine.address,user:'fixture',clientKeyPath:'',knownHosts:''});
  try {await binding?.ready();}
  catch {
   await binding?.failed();
   const finish=await releaseHostLogins({records:options.records,id:row.id,root,provider,machine,clock});
   await provider.release(machine);await finish();
   const result={...row,state:'failed' as const,release:'released' as const};options.records.provisions.save(result);completed=true;return result;
  }
  const result={...row,state:'ready' as const};options.records.provisions.ready(result);completed=true;return result;
 }});
 const store=new Store(join(root,'.cland/hub.db'));onCleanup(t,()=>store.close());
 const volume=await provider.createVolume({project:root,name:'work-codex',region:'fake-1',sizeGiB:1});if(volume.state!=='created')throw Error('fixture volume failed');
 store.hosts.logins.insert({name:'work-codex',harness:'codex',account:'work',kind:'disk',provider:'fake',region:'fake-1',volumeId:volume.volume.id,snapshotIds:[],lastSignIn:null});store.hosts.logins.transition('work-codex','ready');
 async function seed(harness:'claude-code'|'codex'|'opencode') {
  const made=await provider.createVolume({project:root,name:'work-'+harness,region:'fake-1',sizeGiB:1});if(made.state!=='created')throw Error('fixture volume failed');
  store.hosts.logins.insert({name:'work-'+harness,harness,account:'work',kind:'disk',provider:'fake',region:'fake-1',volumeId:made.volume.id,snapshotIds:[],lastSignIn:null});store.hosts.logins.transition('work-'+harness,'ready');return made.volume;
 }
 const ui=await sessionUi(t,hub.discovery,'cli');
 return {root,clock,provider,store,hub,ui,machine,mounts,host,gate,boot,seed,abort:()=>creationAbort.abort(),failureEntered:failureEntered.promise,joinBindings:()=>bindings!.ready(),fail:()=>{failure=true;},elapsed:()=>clock.now().getTime()-started,volume:volume.volume,completed:()=>completed};
}

test('cold launch attaches while connecting and reuses the mounted login after ready',async t=>{
 const f=await fixture(t);
 const launch=await f.ui.request({type:'session.launch',name:'cold',harness:'codex',role:'implementer'});assert.equal(launch.ok,true,launch.error); f.boot.resolve();
 await eventually('volume attached during connecting',async()=>{const r=await f.provider.listVolumes({project:f.root});return r.state==='listed'&&r.volumes[0]?.attachedTo===f.machine.id?true:undefined;},testWaitMs());
 assert.equal(f.store.hosts.provisions.get(f.machine.id)?.state,'connecting');assert.deepEqual(f.mounts,[]);
 assert.equal(f.store.hosts.logins.bindings('work-codex')[0]?.phase,'pending');
 f.gate.resolve();
 await eventually('native spawn after ready',()=>f.completed()&&f.hub.fakes.codex!.spawns.length===1?true:undefined,testWaitMs());
 assert.deepEqual(f.mounts,['mount']);assert.equal(f.store.hosts.logins.bindings('work-codex')[0]?.phase,'settled');
});


test('two waiting harnesses attach before cloning finishes',async t=>{
 const f=await fixture(t);await f.seed('claude-code');
 for(const [name,harness] of [['one','codex'],['two','claude-code']])assert.equal((await f.ui.request({type:'session.launch',name,harness,role:'implementer'})).ok,true);
 f.boot.resolve();
 await eventually('both volumes attached',async()=>{const r=await f.provider.listVolumes({project:f.root});return r.state==='listed'&&r.volumes.length===2&&r.volumes.every(v=>v.attachedTo===f.machine.id)?true:undefined;},testWaitMs());
 assert.deepEqual(f.mounts,[]);f.gate.resolve();
 await eventually('both native launches',()=>f.hub.fakes.codex!.spawns.length===1&&f.hub.fakes['claude-code']!.spawns.length===1?true:undefined,testWaitMs());
 assert.deepEqual(f.mounts,['mount','mount']);
});

function delayedAttachment(t:test.TestContext,clock:FakeClock) {
 let entered=false,closed=false;
 const releases=new Set<()=>void>(),flights=new Set<Promise<unknown>>();
 const close=async()=>{
  closed=true;
  for(const release of releases)release();
  await Promise.allSettled([...flights]);
 };
 // Register before any override invocation, including calls admitted after setup fails.
 onCleanup(t,close);
 const attach=FakeHostProvider.prototype.attachVolume;
 t.mock.method(FakeHostProvider.prototype,'attachVolume',function(this:FakeHostProvider,...args:Parameters<typeof attach>){
  const work=(async()=>{
   if(closed)throw Error('fixture attachment owner closed');
   entered=true;
   const released=Promise.withResolvers<void>();
   const timer=clock.setTimeout(()=>released.resolve(),500); // lint-allow-wall-clock: injected FakeClock; no native timer, cancelled and joined by close.
   releases.add(released.resolve);
   try {
    await released.promise;
    if(closed)throw Error('fixture attachment owner closed');
    return await attach.apply(this,args);
   }finally {clock.clearTimeout(timer);releases.delete(released.resolve);}
  })();
  flights.add(work);void work.finally(()=>flights.delete(work)).catch(()=>{});return work;
 });
 return {entered:()=>entered,close};
}

test('login preparation adds no hub-clock time to simulated cloning',async t=>{
 const times:number[]=[];
 for(const login of [false,true])await t.test(login?'with login':'without demand',async scope=>{
  const clock=new FakeClock(Date.now());
  const f=await fixture(scope,clock);const delayed=login?delayedAttachment(scope,clock):undefined;
  const work=f.ui.request(login?{type:'session.launch',name:'clocked',harness:'codex',role:'implementer'}:{type:'host.create',pool:'agents'});
  if(login)assert.equal((await work).ok,true);
  f.boot.resolve();
  if(login)await eventually('attachment started before clone work',()=>delayed?.entered()?true:undefined,testWaitMs());
  f.gate.resolve();
  await eventually('host ready receipt',()=>f.completed()?true:undefined,testWaitMs());
  const result=await work;assert.equal(result.ok,true,result.error);times.push(f.elapsed());
 });
 assert.deepEqual(times,[1000,1000]);
});

for(const attached of [false,true])test(`boot failure ${attached?'after':'before'} attachment preserves the ready disk`,async t=>{
 const f=await fixture(t);
 if(!attached)t.mock.method(FakeHostProvider.prototype,'attachVolume',async()=>({state:'refused',reason:'machine unavailable'} as const));
 await f.ui.request({type:'session.launch',name:'failed',harness:'codex',role:'implementer'});f.boot.resolve();
 await eventually('binding preparation receipt',()=>f.store.hosts.logins.get('work-codex')?.state===(attached?'in-use':'ready')&&f.store.hosts.provisions.get(f.machine.id)?.state==='connecting'?true:undefined,testWaitMs());
 if(attached)await eventually('attached disk',async()=>{const r=await f.provider.listVolumes({project:f.root});return r.state==='listed'&&r.volumes[0]?.attachedTo===f.machine.id?true:undefined;},testWaitMs());
 f.fail();f.gate.resolve();await eventually('failed creation joined',()=>f.completed()?true:undefined,testWaitMs());
 assert.equal(f.store.hosts.logins.get('work-codex')?.state,'ready');assert.deepEqual(f.store.hosts.logins.bindings('work-codex'),[]);
 const r=await f.provider.listVolumes({project:f.root});assert.equal(r.state,'listed');if(r.state==='listed'){assert.equal(r.volumes[0]?.id,f.volume.id);assert.equal(r.volumes[0]?.attachedTo,null);}
});

test('unknown rollback retains pending binding without retrying detach',async t=>{
 const f=await fixture(t);let detaches=0;
 t.mock.method(FakeHostProvider.prototype,'detachVolume',async()=>{detaches++;return {state:'incomplete',reason:'fixture unknown'} as const;});
 await f.ui.request({type:'session.launch',name:'unknown',harness:'codex',role:'implementer'});f.boot.resolve();
 await eventually('attached disk',async()=>{const r=await f.provider.listVolumes({project:f.root});return r.state==='listed'&&r.volumes[0]?.attachedTo===f.machine.id?true:undefined;},testWaitMs());
 f.fail();f.gate.resolve();await eventually('failed creation joined',()=>f.completed()?true:undefined,testWaitMs());
 assert.equal(detaches,1);assert.equal(f.store.hosts.logins.get('work-codex')?.state,'in-use');assert.equal(f.store.hosts.logins.bindings('work-codex')[0]?.phase,'pending');
});

test('host ready and native admission wait for the mount receipt',async t=>{
 const f=await fixture(t),mount=Promise.withResolvers<void>();let entered=false;
 onCleanup(t,()=>mount.resolve());f.host.loginDisk=async()=>{entered=true;await mount.promise;};
 await f.ui.request({type:'session.launch',name:'held',harness:'codex',role:'implementer'});f.boot.resolve();f.gate.resolve();
 await eventually('mount entered',()=>entered?true:undefined,testWaitMs());
 assert.equal(f.store.hosts.provisions.get(f.machine.id)?.state,'connecting');assert.equal(f.hub.fakes.codex!.spawns.length,0);
 mount.resolve();await eventually('settled mount and launch',()=>f.completed()&&f.hub.fakes.codex!.spawns.length===1?true:undefined,testWaitMs());
 assert.equal(f.store.hosts.logins.bindings('work-codex')[0]?.phase,'settled');
});


test('missing login refuses the waiting launch while the healthy host stays ready',async t=>{
 const f=await fixture(t);
 f.store.hosts.logins.bind('work-codex',{host:'another-host',role:'writer',volumeId:f.volume.id});
 const launch=await f.ui.request({type:'session.launch',name:'no-login',harness:'codex',role:'implementer'});assert.equal(launch.ok,true,launch.error);
 f.boot.resolve();f.gate.resolve();
 await eventually('creation completion persisted',()=>f.completed()?true:undefined,testWaitMs());
 assert.equal(f.store.hosts.provisions.get(f.machine.id)?.state,'ready');
 await eventually('ordinary launch refusal clears wait',async()=>{const r=await f.ui.request({type:'session.list'});return (r.value as {waiting:unknown[]}).waiting.length===0?true:undefined;},testWaitMs());
 assert.equal(f.hub.fakes.codex!.spawns.length,0);
 assert.equal((await f.provider.status(f.machine)).state,'ready');
});


test('cancelled captured wait cannot attach after held inventory completes',async t=>{
 const f=await fixture(t),inventory=Promise.withResolvers<void>();let entered=false,attaches=0;
 const list=FakeHostProvider.prototype.listVolumes,attach=FakeHostProvider.prototype.attachVolume;
 onCleanup(t,()=>inventory.resolve());
 t.mock.method(FakeHostProvider.prototype,'listVolumes',async function(this:FakeHostProvider,...args:Parameters<typeof list>){entered=true;await inventory.promise;return list.apply(this,args);});
 t.mock.method(FakeHostProvider.prototype,'attachVolume',async function(this:FakeHostProvider,...args:Parameters<typeof attach>){attaches++;return attach.apply(this,args);});
 assert.equal((await f.ui.request({type:'session.launch',name:'cancelled',harness:'codex',role:'implementer'})).ok,true);f.boot.resolve();
 await eventually('inventory request admitted',()=>entered?true:undefined,testWaitMs());
 const stopped=await f.ui.request({type:'session.stop',session:'cancelled'});assert.equal(stopped.ok,true,stopped.error);
 inventory.resolve();f.gate.resolve();await eventually('healthy host completion',()=>f.completed()?true:undefined,testWaitMs());
 assert.equal(attaches,0);assert.equal(f.store.hosts.provisions.get(f.machine.id)?.state,'ready');
 assert.equal(f.store.hosts.logins.get('work-codex')?.state,'ready');assert.deepEqual(f.mounts,[]);assert.equal(f.hub.fakes.codex!.spawns.length,0);
});


for(const boundary of ['failure','abort'] as const)test(`${boundary} fences attach while provisioning inventory is held`,async t=>{
 const f=await fixture(t),inventory=Promise.withResolvers<void>();let entered=false,attaches=0;
 const list=FakeHostProvider.prototype.listVolumes,attach=FakeHostProvider.prototype.attachVolume;
 onCleanup(t,()=>inventory.resolve());
 t.mock.method(FakeHostProvider.prototype,'listVolumes',async function(this:FakeHostProvider,...args:Parameters<typeof list>){entered=true;await inventory.promise;return list.apply(this,args);});
 t.mock.method(FakeHostProvider.prototype,'attachVolume',async function(this:FakeHostProvider,...args:Parameters<typeof attach>){attaches++;return attach.apply(this,args);});
 assert.equal((await f.ui.request({type:'session.launch',name:'interrupted',harness:'codex',role:'implementer'})).ok,true);f.boot.resolve();
 await eventually('inventory request admitted',()=>entered?true:undefined,testWaitMs());
 if(boundary==='failure'){f.fail();f.gate.resolve();await f.failureEntered;inventory.resolve();}
 else {f.abort();inventory.resolve();await f.joinBindings();f.fail();f.gate.resolve();}
 await eventually('failed creation durable completion',()=>f.completed()?true:undefined,testWaitMs());
 await eventually('failed host deletion checkpoint',()=>f.store.hosts.provisions.get(f.machine.id)?.state==='destroyed'?true:undefined,testWaitMs());
 assert.equal(attaches,0);assert.equal(f.store.hosts.provisions.get(f.machine.id)?.state,'destroyed');
 assert.equal(f.store.hosts.logins.get('work-codex')?.state,'ready');assert.equal(f.hub.fakes.codex!.spawns.length,0);
});


test('forced setup failure drains a late scheduled attachment before hub and root cleanup',async t=>{
 await t.test('scope catches setup failure after cloning and before attachment completes',async scope=>{
  const clock=new FakeClock(Date.now()),f=await fixture(scope,clock),inventory=Promise.withResolvers<void>();
  const list=FakeHostProvider.prototype.listVolumes;let cloningComplete=false;
  const advance=clock.advance.bind(clock);
  scope.mock.method(clock,'advance',async(ms:number)=>{await advance(ms);if(ms===1000)cloningComplete=true;});
  onCleanup(scope,()=>inventory.resolve());
  scope.mock.method(FakeHostProvider.prototype,'listVolumes',async function(this:FakeHostProvider,...args:Parameters<typeof list>){await inventory.promise;return list.apply(this,args);});
  const delayed=delayedAttachment(scope,clock);
  let stopped=false;
  onCleanup(scope,async()=>{
   const stopping=f.hub.stop().finally(()=>{stopped=true;});
   try {await eventually('hub shutdown joined late attachment',()=>stopped?true:undefined,testWaitMs());}
   finally {if(!stopped)await advance(500);await stopping;}
   assert.equal(stopped,true);
  });
  await assert.rejects(async()=>{
   assert.equal((await f.ui.request({type:'session.launch',name:'setup-failed',harness:'codex',role:'implementer'})).ok,true);
   f.boot.resolve();f.gate.resolve();await eventually('simulated clone completion',()=>cloningComplete?true:undefined,testWaitMs());
   inventory.resolve();await eventually('late attachment admitted',()=>delayed.entered()?true:undefined,testWaitMs());
   throw Error('forced setup failure');
  },/forced setup failure/);
 });
});


for(const boundary of ['attached','mounting'] as const)test(`cancelled wait at ${boundary} rolls back the same disk before host readiness`,async t=>{
 const f=await fixture(t),mount=Promise.withResolvers<void>();let mounting=false;
 onCleanup(t,()=>mount.resolve());
 f.host.loginDisk=async input=>{f.mounts.push(input.op);if(input.op==='mount'){mounting=true;await mount.promise;}};
 assert.equal((await f.ui.request({type:'session.launch',name:'cancel-late',harness:'codex',role:'implementer'})).ok,true);f.boot.resolve();
 if(boundary==='mounting'){f.gate.resolve();await eventually('mount admitted',()=>mounting?true:undefined,testWaitMs());}
 else await eventually('attached disk receipt',async()=>{const r=await f.provider.listVolumes({project:f.root});return r.state==='listed'&&r.volumes[0]?.attachedTo===f.machine.id?true:undefined;},testWaitMs());
 const result=await f.ui.request({type:'session.stop',session:'cancel-late'});assert.equal(result.ok,true,result.error);
 mount.resolve();f.gate.resolve();await eventually('host ready after rollback',()=>f.completed()?true:undefined,testWaitMs());
 assert.equal(f.store.hosts.provisions.get(f.machine.id)?.state,'ready');assert.equal(f.store.hosts.logins.get('work-codex')?.state,'ready');
 assert.deepEqual(f.store.hosts.logins.bindings('work-codex'),[]);assert.equal(f.hub.fakes.codex!.spawns.length,0);
 const r=await f.provider.listVolumes({project:f.root});assert.equal(r.state,'listed');if(r.state==='listed')assert.equal(r.volumes[0]?.attachedTo,null);
 assert.deepEqual(f.mounts,boundary==='mounting'?['mount','umount']:[]);
});

test('changed role account during mount releases the captured disk and launches with the current pin',async t=>{
 const f=await fixture(t),mount=Promise.withResolvers<void>();let mounting=false;
 onCleanup(t,()=>mount.resolve());
 await writeFile(join(f.root,'.cland/roles.toml'),'[implementer.launch]\npool="agents"\nharness="codex"\naccount="work"\n');
 const loaded=await f.ui.request({type:'hub.reload'});assert.equal(loaded.ok,true,loaded.error);
 const made=await f.provider.createVolume({project:f.root,name:'other-codex',region:'fake-1',sizeGiB:1});if(made.state!=='created')throw Error('fixture volume failed');
 f.store.hosts.logins.insert({name:'other-codex',harness:'codex',account:'other',kind:'disk',provider:'fake',region:'fake-1',volumeId:made.volume.id,snapshotIds:[],lastSignIn:null});f.store.hosts.logins.transition('other-codex','ready');
 f.host.loginDisk=async input=>{f.mounts.push(input.op);if(input.op==='mount'&&input.volume===f.volume.name){mounting=true;await mount.promise;}};
 assert.equal((await f.ui.request({type:'session.launch',name:'changed-pin',harness:'codex',role:'implementer'})).ok,true);f.boot.resolve();f.gate.resolve();
 await eventually('old account mount admitted',()=>mounting?true:undefined,testWaitMs());
 await writeFile(join(f.root,'.cland/roles.toml'),'[implementer.launch]\npool="agents"\nharness="codex"\naccount="other"\n');
 const reload=await f.ui.request({type:'hub.reload'});assert.equal(reload.ok,true,reload.error);mount.resolve();
 await eventually('current account native spawn',()=>f.hub.fakes.codex!.spawns[0]?.account==='other'?true:undefined,testWaitMs());
 assert.equal(f.store.hosts.provisions.get(f.machine.id)?.state,'ready');assert.equal(f.store.hosts.logins.get('work-codex')?.state,'ready');
 assert.deepEqual(f.store.hosts.logins.bindings('work-codex'),[]);assert.equal(f.store.hosts.logins.bindings('other-codex')[0]?.phase,'settled');
 assert.deepEqual(f.mounts,['mount','umount','mount']);
});

test('removed role while inventory is held cannot consume a login or fail the host',async t=>{
 const f=await fixture(t),inventory=Promise.withResolvers<void>();let entered=false,attaches=0;
 onCleanup(t,()=>inventory.resolve());
 await writeFile(join(f.root,'.cland/roles.toml'),'[custom.worker]\nclause="Fixture worker"\n[custom.worker.launch]\nharness="codex"\npool="agents"\n');
 const loaded=await f.ui.request({type:'hub.reload'});assert.equal(loaded.ok,true,loaded.error);
 const list=FakeHostProvider.prototype.listVolumes,attach=FakeHostProvider.prototype.attachVolume;
 t.mock.method(FakeHostProvider.prototype,'listVolumes',async function(this:FakeHostProvider,...args:Parameters<typeof list>){entered=true;await inventory.promise;return list.apply(this,args);});
 t.mock.method(FakeHostProvider.prototype,'attachVolume',async function(this:FakeHostProvider,...args:Parameters<typeof attach>){attaches++;return attach.apply(this,args);});
 assert.equal((await f.ui.request({type:'session.launch',name:'removed-role',harness:'codex',role:'worker'})).ok,true);f.boot.resolve();
 await eventually('inventory request admitted',()=>entered?true:undefined,testWaitMs());
 await writeFile(join(f.root,'.cland/roles.toml'),'[implementer.launch]\npool="agents"\n');
 const reload=await f.ui.request({type:'hub.reload'});assert.equal(reload.ok,true,reload.error);
 inventory.resolve();f.gate.resolve();await eventually('host creation complete',()=>f.completed()?true:undefined,testWaitMs());
 assert.equal(attaches,0);assert.equal(f.store.hosts.provisions.get(f.machine.id)?.state,'ready');assert.equal(f.store.hosts.logins.get('work-codex')?.state,'ready');
});


test('selected account limit refuses the wait while preserving the healthy host and free disk',async t=>{
 const f=await fixture(t,new FakeClock(Date.now()),true);
 assert.equal((await f.ui.request({type:'session.launch',name:'limited-cold',harness:'codex',role:'implementer'})).ok,true);
 f.boot.resolve();f.gate.resolve();await eventually('host creation completed',()=>f.completed()?true:undefined,testWaitMs());
 assert.equal(f.store.hosts.provisions.get(f.machine.id)?.state,'ready');assert.equal(f.store.hosts.logins.get('work-codex')?.state,'ready');assert.deepEqual(f.mounts,[]);
 await eventually('limited wait refused',async()=>{const r=await f.ui.request({type:'session.list'});return (r.value as {waiting:unknown[]}).waiting.length===0?true:undefined;},testWaitMs());
 assert.equal(f.hub.fakes.codex!.spawns.length,0);assert.equal((await f.provider.status(f.machine)).state,'ready');
});

test('unknown attachment keeps the pending fence and healthy host without spawning',async t=>{
 const f=await fixture(t);let attaches=0;
 t.mock.method(FakeHostProvider.prototype,'attachVolume',async()=>{attaches++;return {state:'failed',reason:'fixture unknown attachment'} as const;});
 assert.equal((await f.ui.request({type:'session.launch',name:'unknown-cold',harness:'codex',role:'implementer'})).ok,true);
 f.boot.resolve();f.gate.resolve();await eventually('host creation completed',()=>f.completed()?true:undefined,testWaitMs());
 assert.equal(f.store.hosts.provisions.get(f.machine.id)?.state,'ready');assert.equal(f.store.hosts.logins.bindings('work-codex')[0]?.phase,'pending');assert.deepEqual(f.mounts,[]);
 await eventually('pending login refuses wait',async()=>{const r=await f.ui.request({type:'session.list'});return (r.value as {waiting:unknown[]}).waiting.length===0?true:undefined;},testWaitMs());
 assert.equal(attaches,1);assert.equal(f.hub.fakes.codex!.spawns.length,0);
});

test('attachment delay owner rejects calls admitted after its cleanup',async t=>{
 const clock=new FakeClock(Date.now()),f=await fixture(t,clock),delay=delayedAttachment(t,clock);
 await delay.close();
 await assert.rejects(f.provider.attachVolume(f.volume,f.machine),/fixture attachment owner closed/);
 assert.equal(delay.entered(),false);
 const inventory=await f.provider.listVolumes({project:f.root});assert.equal(inventory.state,'listed');
 if(inventory.state==='listed')assert.equal(inventory.volumes[0]?.attachedTo,null);
});
