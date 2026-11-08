// T2: provider absence and durable lease recovery without native hosts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { scratchMachine } from './init-machine.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { FakeClock } from './fake-clock.ts';
import { Store } from '../src/hub/store.ts';
import { FakeHostProvider } from '../src/host/provider/fake.ts';
import { beforeDirectories } from './process-cleanup.ts';
import { reconcileHostLeases } from '../src/host/host-restart.ts';
import { spendPath } from '../src/executor/droplet/spend.ts';

const fixtureProcesses=fakeLockProcesses().processes;

for(const gone of [true,false])test(`restart settles only positive provider absence: gone=${gone}`,async t=>{
 const f=await scratchMachine(t,{identity:false}),clock=new FakeClock();
 const env=fixtureEnvironment(f.root,f.env,{CLAND_FAKE_HOST_ROOT:f.root});
 const store=new Store(join(f.root,'hub.db'));
 beforeDirectories(t,async()=>{await store.hosts.leases.close();store.close();});
 const provider=new FakeHostProvider({env,now:()=>clock.now().getTime()});
 const acquired=await provider.acquire({project:f.root,pool:'agents',architecture:'arm64'});
 assert.equal(acquired.state,'created');if(acquired.state!=='created')throw Error('fixture acquire failed');
 store.hosts.insert({id:'gone',address:acquired.machine.address,user:'agent',clientKeyPath:'unused',knownHosts:'unused'},'synthetic');
 store.hosts.provisions.ready({id:'gone',pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:clock.now().toISOString(),state:'ready',machine:acquired.machine});
 await store.hosts.leases.create('gone',{root:f.root,env,clock,processes:fixtureProcesses,leaseMs:3600000,caps:{shared:10,hosts:10},pool:'agents',size:'fake',priceHourly:2,billingMinimumMs:60000});
 await clock.advance(1800000);
 if(gone)assert.equal((await provider.release(acquired.machine)).state,'released');
 else t.mock.method(FakeHostProvider.prototype,'status',async()=>({state:'failed' as const,reason:'provider unavailable'}));
 await reconcileHostLeases({root:f.root,env,clock,records:store.hosts,processes:fixtureProcesses,log:()=>{}});
 if(!gone) {
  assert.equal(store.hosts.get('gone')?.state,'registered');
  assert.equal(store.hosts.provisions.get('gone')?.state,'ready');
  assert.ok(store.hosts.leases.get('gone'));
  assert.equal(JSON.parse(await readFile(spendPath(env),'utf8')).entries[0].cost,null);return;
 }
 assert.equal(store.hosts.get('gone')?.state,'revoked');
 assert.equal(store.hosts.provisions.get('gone')?.state,'destroyed');
 assert.ok(store.hosts.provisions.get('gone')?.machineDeletionRead);
 assert.equal(store.hosts.leases.get('gone'),null);
 assert.equal(JSON.parse(await readFile(spendPath(env),'utf8')).entries[0].cost,1);
});

import { restoreHostLeaseOwners } from '../src/host/host-restart.ts';
import { parseConfig } from '../src/init/config.ts';
import { until } from './until.ts';
for(const [lease,cadence] of [['1h',900000],['12h',3600000]] as const)test(`reopened lease renews at min(1h, ${lease}/4) with a live watchdog`,async t=>{
 const f=await scratchMachine(t,{identity:false}),clock=new FakeClock();
 const env=fixtureEnvironment(f.root,f.env,{CLAND_FAKE_HOST_ROOT:f.root});
 const file=join(f.root,'hub.db');let store=new Store(file);
 beforeDirectories(t,async()=>{await store.hosts.leases.close();store.close();});
 const config=parseConfig(`[hosts]\nlease="${lease}"\n[hosts.agents]\nprovider="fake"\nsize="fake"\nslots=8\n`,'fixture',env);
 const provider=new FakeHostProvider({env,now:()=>clock.now().getTime()});
 const acquired=await provider.acquire({project:f.root,pool:'agents',architecture:'arm64'});
 assert.equal(acquired.state,'created');if(acquired.state!=='created')throw Error('fixture acquire failed');
 store.hosts.insert({id:'busy',address:acquired.machine.address,user:'agent',clientKeyPath:'unused',knownHosts:'unused'},'synthetic');
 store.hosts.provisions.ready({id:'busy',pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:clock.now().toISOString(),state:'ready',machine:acquired.machine});
 await store.hosts.leases.create('busy',{root:f.root,env,clock,processes:fixtureProcesses,leaseMs:config.hosts.leaseMs,caps:{shared:10,hosts:10},pool:'agents',size:'fake',priceHourly:0,billingMinimumMs:60000});
 const watchdog={pid:123,startedUtc:clock.now().toISOString(),pidIdentity:'fixture-birth'};
 store.hosts.leases.checkpointWatchdog('busy',f.root,watchdog);
 const original=store.hosts.leases.get('busy')!.deadline;
 await store.hosts.leases.close();store.close();store=new Store(file);
 await restoreHostLeaseOwners({root:f.root,env,clock,records:store.hosts,config,processes:fixtureProcesses,inUse:()=>true,destroy:async()=>assert.fail('live in-use lease must not expire'),log:entry=>assert.fail(JSON.stringify(entry)),watchdogOptions:{processes:{alive:()=>true,identity:async()=> 'fixture-birth',started:async()=>watchdog.startedUtc,signal:()=>assert.fail('live watchdog must not be signalled')}}});
 assert.deepEqual(store.hosts.leases.get('busy')!.watchdog,watchdog);
 await clock.advance(cadence-1);assert.equal(store.hosts.leases.get('busy')!.deadline,original);
 await clock.advance(1);
 await until(()=>store.hosts.leases.get('busy')!.deadline!==original,{what:'restored renewal persisted'});
 assert.equal(Date.parse(store.hosts.leases.get('busy')!.deadline)-Date.parse(original),cadence);
});

import { unlink, writeFile } from 'node:fs/promises';
import { hostLeasePath, readHostLeaseFile } from '../src/host/host-leases.ts';
for(const fault of ['missing','malformed','earlier-expired','earlier-live'] as const)test(`watchdog recovery preserves effective mirror deadline: ${fault}`,async t=>{
 const f=await scratchMachine(t,{identity:false}),clock=new FakeClock();
 const env=fixtureEnvironment(f.root,f.env,{CLAND_FAKE_HOST_ROOT:f.root});
 const store=new Store(join(f.root,'hub.db'));
 beforeDirectories(t,async()=>{await store.hosts.leases.close();store.close();});
 const config=parseConfig('[hosts]\nlease="1h"\n[hosts.agents]\nprovider="fake"\nsize="fake"\nslots=8\n','fixture',env);
 const provider=new FakeHostProvider({env,now:()=>clock.now().getTime()});
 const acquired=await provider.acquire({project:f.root,pool:'agents',architecture:'arm64'});
 assert.equal(acquired.state,'created');if(acquired.state!=='created')throw Error('fixture acquire failed');
 store.hosts.provisions.save({id:'mirror',pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:clock.now().toISOString(),state:'failed',machine:acquired.machine});
 await store.hosts.leases.create('mirror',{root:f.root,env,clock,processes:fixtureProcesses,leaseMs:3600000,caps:{shared:10,hosts:10},pool:'agents',size:'fake',priceHourly:0,billingMinimumMs:60000});
 const row=store.hosts.leases.get('mirror')!,path=hostLeasePath(f.root,'mirror');
 if(fault==='missing')await unlink(path);
 else if(fault==='malformed')await writeFile(path,'{');
 else await writeFile(path,JSON.stringify({...row,deadline:new Date(clock.now().getTime()+(fault==='earlier-live'?60000:0)).toISOString()}));
 const before=store.hosts.leases.effective('mirror',f.root,clock)!;
 let destroyed=0,arms=0;
 // A positively absent watchdog exercises replacement through a native-free owner.
 store.hosts.leases.checkpointWatchdog('mirror',f.root,{pid:123,startedUtc:clock.now().toISOString(),pidIdentity:'fixture-birth'});
 // Restore the fault after seeding the identity; checkpoint publication is itself
 // the operation under regression, not fixture setup permission to repair it.
 if(fault==='missing')await unlink(path);
 else if(fault==='malformed')await writeFile(path,'{');
 else await writeFile(path,JSON.stringify({...row,deadline:before.deadline}));
 await restoreHostLeaseOwners({root:f.root,env,clock,records:store.hosts,config,processes:fixtureProcesses,inUse:()=>true,destroy:async()=>{destroyed++;},log:()=>{},watchdogOptions:{processes:{alive:()=>false,identity:async()=>null,started:async()=>null,signal:()=>assert.fail('no native signal')}},armWatchdog:async()=>{arms++;return {pid:124,startedUtc:clock.now().toISOString(),pidIdentity:'replacement'};}});
 if(fault==='earlier-live') {
  assert.equal(destroyed,0);assert.equal(arms,1);assert.equal(readHostLeaseFile(f.root,'mirror')!.deadline,before.deadline);
 }else {
  await until(()=>destroyed===1,{what:"expired restoration reached destroy owner"});assert.equal(arms,1);
  assert.equal(store.hosts.leases.effective('mirror',f.root,clock)!.expired,true);
 }
});

import { createHubBase } from '../src/hub/server.ts';
import { Sessions } from '../src/adapters/sessions.ts';
import { ProcessTable, hostGenerationKey } from '../src/adapters/processes.ts';
import { fakeHarness } from './fakes/harness.ts';
import { projectSshHosts } from '../src/host/registry.ts';
import { localHost } from '../src/host/local.ts';
import { destroyHost } from '../src/host/provision-host.ts';
test('startup attaches session settlement before an already-expired lease enters destruction',async t=>{
 const f=await scratchMachine(t,{identity:false}),clock=new FakeClock();
 const env=fixtureEnvironment(f.root,f.env,{CLAND_FAKE_HOST_ROOT:f.root});
 const store=new Store(join(f.root,'hub.db')),base=createHubBase({secret:'synthetic',store,clock,env});
 const config=parseConfig('[hosts]\nlease="30s"\n[hosts.agents]\nprovider="fake"\nsize="fake"\nslots=8\nmin_hosts=0\n','fixture',env);
 const table=new ProcessTable(':memory:',clock);
 const host={...localHost(env),name:'expired',listFolder:async()=>[],processes:async()=>[]};
 const sessions=new Sessions({root:f.root,core:base.core,table,hosts:[host],transportClock:clock,recoveryClock:clock,hostPools:()=>config.hosts});
 const adapter=fakeHarness('codex',{clock});sessions.register(adapter);
 Object.assign(adapter,{releaseUnreachableGeneration:async(p:Parameters<typeof hostGenerationKey>[0])=>({generation:hostGenerationKey(p),released:true,dropped:[],forwardIds:[]})});
 const provider=new FakeHostProvider({env,now:()=>clock.now().getTime()});
 const acquired=await provider.acquire({project:f.root,pool:'agents',architecture:'arm64'});
 assert.equal(acquired.state,'created');if(acquired.state!=='created')throw Error('fixture acquire failed');
 store.hosts.insert({id:host.name,address:acquired.machine.address,user:'agent',clientKeyPath:'unused',knownHosts:'unused'},'synthetic');
 store.hosts.provisions.ready({id:host.name,pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:clock.now().toISOString(),state:'ready',machine:acquired.machine});
 const p={...await adapter.spawn({name:'busy',cwd:f.root,role:null,model:null}),host:host.name};table.put(p);
 await store.hosts.leases.create(host.name,{root:f.root,env,clock,processes:fixtureProcesses,leaseMs:30000,caps:{shared:10,hosts:10},pool:'agents',size:'fake',priceHourly:0,billingMinimumMs:60000});
 let watchdogRunning=true;
 const watchdogProcesses={alive:()=>watchdogRunning,identity:async()=> 'live-watchdog',started:async()=>null,signal:()=>{watchdogRunning=false;}};
 store.hosts.leases.checkpointWatchdog(host.name,f.root,{pid:123,startedUtc:clock.now().toISOString(),pidIdentity:'live-watchdog'});
 await clock.advance(30000);
 const owner=await projectSshHosts({root:f.root,records:store.hosts,clock,env,provided:[host],hubSocket:join(f.root,'h.sock'),spokeSocket:join(f.root,'s.sock'),settle:id=>base.dispatcher.revokeHost(id),onRemove:id=>sessions.removeHost(id),log:()=>{}});
 base.dispatcher.hostOwner=owner;
 beforeDirectories(t,async()=>{await sessions.close();await owner.close();table.close();await base.close();});
 let releaseObserved=false;
 const release=provider.release.bind(provider);
 t.mock.method(provider,'release',async(...[machine,confirm]:Parameters<typeof provider.release>)=>{releaseObserved=true;assert.notEqual(table.get('busy')!.status,'running','provider deletion follows session settlement');return release(machine,confirm);});
 let result:Awaited<ReturnType<typeof destroyHost>>|undefined;
 await base.dispatcher.restoreSessions(sessions,()=>restoreHostLeaseOwners({root:f.root,env,clock,records:store.hosts,config,processes:fixtureProcesses,inUse:id=>sessions.hostInUse(id),destroy:async id=>{assert.equal(sessions.hostInUse(id),true,'recorded running session is known to the lease owner');result=await destroyHost({root:f.root,id,records:store.hosts,env,clock,processes:fixtureProcesses,watchdogOptions:{processes:watchdogProcesses},provider,owner,settleDeleted:(id,read)=>sessions.hostDeleted(id,read),log:()=>{}});},watchdogOptions:{processes:watchdogProcesses},armWatchdog:async()=>assert.fail('live watchdog must not re-arm'),log:()=>{}}));
 await until(()=>result!==undefined,{what:'startup expiry producer completed'});
 assert.equal(result?.state,'destroyed');assert.equal(releaseObserved,true);
 assert.equal(watchdogRunning,false,'captured watchdog closed through its injected owner');
 assert.equal(table.get('busy')!.status,'exited');assert.equal(store.hosts.leases.get(host.name),null);
});

import { PoolRuntime } from '../src/host/pool-runtime.ts';
import { readHostPools } from '../src/host/pools.ts';
for(const minimum of [1,2])test(`reopened minimum-host scheduler completes admitted work: minimum=${minimum}`,async t=>{
 const f=await scratchMachine(t,{identity:false}),clock=new FakeClock(),file=join(f.root,'hub.db');
 let store=new Store(file);
 beforeDirectories(t,async()=>{await store.hosts.leases.close();store.close();});
 store.hosts.insert({id:'restored',address:'restored',user:'agent',clientKeyPath:'unused',knownHosts:'unused'},'synthetic');
 store.hosts.provisions.ready({id:'restored',pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:clock.now().toISOString(),state:'ready',machine:{id:'restored',address:'restored',architecture:'arm64',created:clock.now().toISOString()}});
 store.close();store=new Store(file);
 const settings=readHostPools({agents:{provider:'fake',size:'fake',slots:8,min_hosts:minimum,max_hosts:2}});
 let attempts=0,completed=0;
 const runtime=new PoolRuntime(()=>settings,store.hosts,()=>true,()=>[]);
 runtime.start(async()=>{attempts++;try{return {state:'ready'};}finally{completed++;}});
 // close joins every admitted #scale flight, including an asynchronous creator.
 // This positive owner-drain receipt precedes the final absence/count assertions.
 await runtime.close();
 assert.equal(attempts,minimum-1);assert.equal(completed,minimum-1);
 assert.equal(store.hosts.provisions.occupied('agents'),1);
 assert.deepEqual([...store.hosts.provisions.active()].map(row=>row.id),['restored']);
});

import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { fakeLockProcesses } from './fakes/lock-processes.ts';
test('lease spend lifecycle uses injected lock births with a positive no-native control',async t=>{
 const f=await scratchMachine(t,{identity:false}),clock=new FakeClock(),store=new Store(join(f.root,'hub.db'));
 const lock=fakeLockProcesses();
 let native=0;
 const trap=()=>{native++;throw Error('native process forbidden by component control');};
 const spawnHook=t.mock.method(cp,'spawn',trap);
 for(const method of ['spawnSync','exec','execSync','execFile','execFileSync','fork'] as const)t.mock.method(cp,method,trap);
 syncBuiltinESMExports();
 beforeDirectories(t,async()=>{await store.hosts.leases.close();store.close();t.mock.restoreAll();syncBuiltinESMExports();});
 // Prove the guard is installed and rejects attempts without calling a native API.
 assert.equal(cp.spawn,spawnHook);
 assert.throws(trap,/native process forbidden/);
 assert.equal(native,1);native=0;
 const o={root:f.root,env:f.env,clock,processes:lock.processes,leaseMs:3600000,caps:{shared:10,hosts:10},pool:'agents',size:'fake',priceHourly:2,billingMinimumMs:60000};
 await store.hosts.leases.create('isolated',o);
 await clock.advance(900000);await store.hosts.leases.renew('isolated',o);
 await store.hosts.leases.release('isolated',o);
 store.hosts.provisions.save({id:'cancelled',pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:clock.now().toISOString(),state:'failed',nonAcquisition:{kind:'not-called',at:clock.now().toISOString()}});
 await store.hosts.leases.create('cancelled',o);await store.hosts.leases.cancel('cancelled',o);
 assert.equal(native,0,'lease reserve/renew/settle never launches a native process');
 assert.ok(lock.reads.some(read=>read.kind==='started'),'real spend boundary used the injected process table');
 assert.equal(store.hosts.leases.get('isolated'),null);assert.equal(store.hosts.leases.get('cancelled'),null);
 assert.equal(JSON.parse(await readFile(spendPath(f.env),'utf8')).entries[0].cost,0.5);
});
