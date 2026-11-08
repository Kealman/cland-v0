// T2: host health fed by synthetic tunnel transitions on the hub clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { HostRecords } from '../src/host/records.ts';
import { HostHealth, loseHost } from '../src/host/host-health.ts';
import { FakeClock } from './fake-clock.ts';
import { scratchMachine } from './init-machine.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
async function closeAll(steps:Array<()=>void|Promise<void>>):Promise<void>{
 const errors:unknown[]=[];for(const close of steps){try{await close();}catch(error){errors.push(error);}}
 if(errors.length)throw new AggregateError(errors,'fixture cleanup incomplete');
}
import { listHosts } from '../src/host/provision-host.ts';

test('three minutes down publishes one unreachable line and recovery preserves the host',async t=>{
 const f=await scratchMachine(t,{identity:false});
 const env=fixtureEnvironment(f.root,f.env,{CLAND_FAKE_HOST_ROOT:f.root});
 const db=new DatabaseSync(':memory:'),records=new HostRecords(db),clock=new FakeClock();
 let closeHealth=async()=>{},closeOwner=async()=>{};
 t.after(()=>closeAll([()=>closeHealth(),()=>closeOwner(),async()=>{await closeAll([()=>records.leases.close(),()=>db.close()]);}]));
 records.insert({id:'host-z',address:'fake-z',user:'agent',clientKeyPath:'unused',knownHosts:'unused'},'synthetic');
 records.provisions.ready({id:'host-z',pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:clock.now().toISOString(),state:'ready',machine:{id:'fake-z',address:'fake-z',architecture:'arm64',created:clock.now().toISOString()}});
 const lines:string[]=[];let checks=0;
 const health=new HostHealth({records,clock,env:{},notice:text=>{lines.push(text);},status:async()=>{checks++;return {state:'ready'};},lost:async()=>assert.fail('recovery must preserve the host'),error:error=>{throw error;}});
 closeHealth=()=>health.close();

 health.transition('host-z',true);
 await clock.advance(900000);assert.equal(checks,0);assert.equal(clock.pending,0);
 health.transition('host-z',false);
 await clock.advance(179999);assert.equal(records.provisions.get('host-z')!.state,'ready');assert.deepEqual(lines,[]);
 await clock.advance(1);
 assert.deepEqual(lines,['host host-z unreachable']);
 assert.equal((await listHosts(records,env))[0]!.state,'unreachable');
 assert.equal(records.provisions.occupied('agents'),1);
 health.transition('host-z',false);
 await clock.advance(1000);assert.equal(checks,1);
 health.transition('host-z',true);
 assert.equal(records.provisions.get('host-z')!.state,'ready');
 await clock.advance(900000);
 assert.deepEqual(lines,['host host-z unreachable']);
 assert.equal(records.get('host-z')!.state,'registered');
});

for(const gone of [false,true])test(`lost host invokes the confirmed deletion owner: provider gone=${gone}`,async t=>{
 const db=new DatabaseSync(':memory:'),records=new HostRecords(db),clock=new FakeClock();
 let closeHealth=async()=>{},closeOwner=async()=>{};
 t.after(()=>closeAll([()=>closeHealth(),()=>closeOwner(),async()=>{await closeAll([()=>records.leases.close(),()=>db.close()]);}]));

 records.insert({id:'host-z',address:'fake-z',user:'agent',clientKeyPath:'unused',knownHosts:'unused'},'synthetic');
 records.provisions.ready({id:'host-z',pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:clock.now().toISOString(),state:'ready',machine:{id:'fake-z',address:'fake-z',architecture:'arm64',created:clock.now().toISOString()}});
 const losses:string[]=[];
 const health=new HostHealth({records,clock,env:{},notice:()=>{},status:async()=>({state:gone?'gone':'ready'}),lost:async id=>{losses.push(id);},error:error=>{throw error;}});
 closeHealth=()=>health.close();

 health.transition('host-z',false);
 if(gone)await until(()=>losses.length===1,{what:'provider absence delivered to deletion owner'});
 else {await clock.advance(899999);assert.deepEqual(losses,[]);await clock.advance(1);}
 assert.deepEqual(losses,['host-z']);
});
import { until } from './until.ts';

for(const fenced of [false,true])test(`shortened health clocks require the fake-host fence: ${fenced}`,async t=>{
 const db=new DatabaseSync(':memory:'),records=new HostRecords(db),clock=new FakeClock();
 let closeHealth=async()=>{},closeOwner=async()=>{};
 t.after(()=>closeAll([()=>closeHealth(),()=>closeOwner(),async()=>{await closeAll([()=>records.leases.close(),()=>db.close()]);}]));
 records.insert({id:'short',address:'fake',user:'agent',clientKeyPath:'unused',knownHosts:'unused'},'synthetic');
 records.provisions.ready({id:'short',pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:clock.now().toISOString(),state:'ready',machine:{id:'fake',address:'fake',architecture:'arm64',created:clock.now().toISOString()}});
 const f=await scratchMachine(t,{identity:false});
 const env=fixtureEnvironment(f.root,f.env,{...(fenced?{CLAND_FAKE_HOST_ROOT:f.root}:{}),CLAND_TEST_HOST_UNREACHABLE_MS:'30',CLAND_TEST_HOST_LOST_MS:'150'});
 let lost=0;const lines:string[]=[];
 const health=new HostHealth({records,clock,env,notice:s=>{lines.push(s);},status:async()=>({state:'ready'}),lost:async()=>{lost++;},error:error=>{throw error;}});
 closeHealth=()=>health.close();

 health.transition('short',false);
 await clock.advance(30);assert.equal(lines.length,fenced?1:0);
 await clock.advance(120);assert.equal(lost,fenced?1:0);
});

import { fakeLockProcesses } from './fakes/lock-processes.ts';
import { readHostLeaseFile } from '../src/host/host-leases.ts';
test('lost deadline joins renewal and publishes now before deletion ownership',async t=>{
 const f=await scratchMachine(t,{identity:false}),clock=new FakeClock(),db=new DatabaseSync(':memory:'),records=new HostRecords(db);
 t.after(async()=>{await closeAll([()=>records.leases.close(),()=>db.close()]);});
 await records.leases.create('host-z',{root:f.root,env:f.env,clock,processes:fakeLockProcesses().processes,leaseMs:3600000,caps:{shared:10,hosts:10},pool:'agents',size:'fake',priceHourly:0,billingMinimumMs:60000});
 await clock.advance(900000);
 await records.leases.expireNow('host-z',f.root,clock);
 assert.equal(records.leases.get('host-z')!.deadline,'2026-10-16T12:15:00.000Z');
 assert.equal(readHostLeaseFile(f.root,'host-z')!.deadline,'2026-10-16T12:15:00.000Z');
});

test('a restored unreachable host already up clears its retained outage state',async t=>{
 const db=new DatabaseSync(':memory:'),records=new HostRecords(db),clock=new FakeClock();
 let closeHealth=async()=>{},closeOwner=async()=>{};
 t.after(()=>closeAll([()=>closeHealth(),()=>closeOwner(),async()=>{await closeAll([()=>records.leases.close(),()=>db.close()]);}]));
 records.insert({id:'restored',address:'fake',user:'agent',clientKeyPath:'unused',knownHosts:'unused'},'synthetic');
 records.provisions.save({id:'restored',pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:clock.now().toISOString(),state:'unreachable',machine:{id:'fake',address:'fake',architecture:'arm64',created:clock.now().toISOString()}});
 const health=new HostHealth({records,clock,env:{},notice:()=>assert.fail('no new notice'),status:async()=>assert.fail('no provider check while up'),lost:async()=>assert.fail('no teardown'),error:error=>{throw error;}});
 closeHealth=()=>health.close();

 health.transition('restored',true);
 assert.equal(records.provisions.get('restored')!.state,'ready');
});

import { projectSshHosts } from '../src/host/registry.ts';
import { HostSecretStore } from '../src/host/records.ts';
import type { SshOptions } from '../src/transport/ssh.ts';
import type { HostTunnelStatus } from '../src/transport/transport.ts';
for(const laterLoss of [false,true])test(`registry replays the continuous outage start: later loss=${laterLoss}`,async t=>{
 const f=await scratchMachine(t,{identity:false}),clock=new FakeClock(),db=new DatabaseSync(':memory:'),records=new HostRecords(db);
 let closeHealth=async()=>{},closeOwner=async()=>{};
 beforeDirectories(t,()=>closeAll([()=>closeHealth(),()=>closeOwner(),async()=>{await records.leases.close();},()=>db.close()]));
 const env=fixtureEnvironment(f.root,f.env,{CLAND_FAKE_HOST_ROOT:f.root});
 let emit:NonNullable<SshOptions['onStatus']>|undefined;
 let state:HostTunnelStatus['state']='down';
 const status=():HostTunnelStatus=>({name:'host-z',state,since:null,reconnects:0,lastProbe:null});
 const owner=await projectSshHosts({root:f.root,env,records,clock,hubSocket:f.root+'/hub.sock',spokeSocket:f.root+'/spoke.sock',log:()=>{},
  createTransport:o=>{emit=o.onStatus;return {status,start:async()=>{},stop:async()=>{},forward:async()=>({socket:'unused'}),unforward:async()=>{}};},gitDaemon:async()=>({close:async()=>{}})});
 closeOwner=()=>owner.close();
 const registration=new HostSecretStore(f.root,records).register({id:'host-z',address:'fake-z',user:'agent',clientKeyPath:'unused',knownHosts:'unused'});
 await owner.add(registration);
 records.provisions.ready({id:'host-z',pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:clock.now().toISOString(),state:'ready',machine:{id:'fake-z',address:'fake-z',architecture:'arm64',created:clock.now().toISOString()}});
 const lines:string[]=[];
 const health=new HostHealth({records,clock,env,notice:s=>{lines.push(s);},status:async()=>({state:'ready'}),lost:async()=>assert.fail('unexpected expiry'),error:error=>{throw error;}});
 closeHealth=()=>health.close();

 await clock.advance(60000); // session/lease restore can take time; initial outage belongs to startup.
 if(laterLoss){state='up';emit!(status());await clock.advance(60000);state='down';emit!(status());await clock.advance(1000);state='connecting';emit!(status());}
 const unsubscribe=owner.subscribeStatus((id,up,at)=>health.transition(id,up,at));
 await clock.advance(laterLoss?178999:119999);assert.deepEqual(lines,[]);
 await clock.advance(1);assert.deepEqual(lines,['host host-z unreachable']);
 state='up';emit!(status());assert.equal(records.provisions.get('host-z')!.state,'ready');
 unsubscribe();
 state='down';emit!(status());await clock.advance(900000);
 assert.equal(records.provisions.get('host-z')!.state,'ready');
});

import { join } from 'node:path';
import { Store } from '../src/hub/store.ts';
import { createHubBase } from '../src/hub/server.ts';
import { Sessions } from '../src/adapters/sessions.ts';
import { ProcessTable, hostGenerationKey } from '../src/adapters/processes.ts';
import { fakeHarness } from './fakes/harness.ts';
import { localHost } from '../src/host/local.ts';
import { destroyHost } from '../src/host/provision-host.ts';
import { FakeHostProvider } from '../src/host/provider/fake.ts';
import { parseConfig } from '../src/init/config.ts';
import { beforeDirectories } from './process-cleanup.ts';
for(const outcome of ['recovered','lost','gone','mirror-failure'])test(`outage settles sessions and roles: ${outcome}`,async t=>{
 const gone=outcome==='gone';
 const f=await scratchMachine(t,{identity:false}),clock=new FakeClock();
 const env=fixtureEnvironment(f.root,f.env,{CLAND_FAKE_HOST_ROOT:f.root});
 const store=new Store(join(f.root,'hub.db'));
 let closeHealth=async()=>{},closeSessions=async()=>{},closeOwner=async()=>{},closeTable=()=>{},closeBase:()=>void|Promise<void>=()=>store.close();
 beforeDirectories(t,()=>closeAll([()=>closeHealth(),()=>closeSessions(),()=>closeOwner(),()=>closeTable(),()=>closeBase()]));
 const base=createHubBase({secret:'synthetic',store,clock,env});closeBase=()=>base.close();
 const config=parseConfig('[hosts]\nlease="30s"\n[hosts.agents]\nprovider="fake"\nsize="fake"\nslots=8\nmin_hosts=0\n','fixture',env);
 const table=new ProcessTable(':memory:',clock);closeTable=()=>table.close();
 const host={...localHost(env),name:'z-busy',listFolder:async()=>[],processes:async()=>[]};
 const sessions=new Sessions({root:f.root,core:base.core,table,hosts:[host],transportClock:clock,recoveryClock:clock,hostPools:()=>config.hosts});
 closeSessions=async()=>{await sessions.close();};
 const adapter=fakeHarness('codex',{clock});sessions.register(adapter);
 Object.assign(adapter,{releaseUnreachableGeneration:async(p:Parameters<typeof hostGenerationKey>[0])=>({generation:hostGenerationKey(p),released:true,dropped:[],forwardIds:[]})});
 const provider=new FakeHostProvider({env,now:()=>clock.now().getTime()});
 const acquired=await provider.acquire({project:f.root,pool:'agents',architecture:'arm64'});
 assert.equal(acquired.state,'created');if(acquired.state!=='created')throw Error('fixture acquire failed');
 store.hosts.insert({id:host.name,address:acquired.machine.address,user:'agent',clientKeyPath:'unused',knownHosts:'unused'},'synthetic');
 store.hosts.provisions.ready({id:host.name,pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:clock.now().toISOString(),state:'ready',machine:acquired.machine});
 store.hosts.insert({id:'a-spare',address:'spare',user:'agent',clientKeyPath:'unused',knownHosts:'unused'},'synthetic');
 store.hosts.provisions.ready({id:'a-spare',pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:clock.now().toISOString(),state:'ready',machine:{...acquired.machine,id:'spare',address:'spare'}});
 const p={...await adapter.spawn({name:'busy',cwd:f.root,role:null,model:null}),host:host.name};table.put(p);
 await store.hosts.leases.create(host.name,{root:f.root,env,clock,processes:fakeLockProcesses().processes,leaseMs:3600000,caps:{shared:10,hosts:10},pool:'agents',size:'fake',priceHourly:0,billingMinimumMs:60000});
 let watchdogRunning=true;
 const watchdogProcesses={alive:()=>watchdogRunning,identity:async()=> 'live-watchdog',started:async()=>null,signal:()=>{watchdogRunning=false;}};
 store.hosts.leases.checkpointWatchdog(host.name,f.root,{pid:123,startedUtc:clock.now().toISOString(),pidIdentity:'live-watchdog'});

 const owner=await projectSshHosts({root:f.root,records:store.hosts,clock,env,provided:[host],hubSocket:join(f.root,'h.sock'),spokeSocket:join(f.root,'s.sock'),settle:id=>base.dispatcher.revokeHost(id),onRemove:id=>sessions.removeHost(id),log:()=>{}});
 closeOwner=()=>owner.close();
 base.dispatcher.hostOwner=owner;


 await base.dispatcher.restoreSessions(sessions,async()=>{});
 store.rememberSession('busy',clock.now().getTime());store.rememberRole('busy','implementer');
 const failures:unknown[]=[],errors:unknown[]=[];
 if(outcome==='mirror-failure')await mkdir(hostLeasePath(f.root,host.name)+'.next');
 const health=new HostHealth({records:store.hosts,clock,env,notice:()=>{},error:error=>{errors.push(error);},
 status:async()=>({state:gone?'gone':'ready'}),lost:async id=>{
  assert.equal(sessions.hostInUse(id),true,'busy reverse-lexical host remains known to the lease owner');
  result=await loseHost({root:f.root,id,records:store.hosts,env,clock,inUse:host=>sessions.hostInUse(host),processes:fakeLockProcesses().processes,watchdogOptions:{processes:watchdogProcesses},provider,owner,settleDeleted:(id,read)=>sessions.hostDeleted(id,read),log:entry=>{if(entry.event==='host-lease-publication-failed')failures.push(entry);}});
 }});
 let result:Awaited<ReturnType<typeof destroyHost>>|undefined;
 closeHealth=()=>health.close();
 health.transition(host.name,false);
 if(!gone){
  await clock.advance(180000);assert.equal(table.get('busy')!.status,'running');assert.equal(store.roleOf('busy'),'implementer');
  if(outcome==='recovered'){
   health.transition(host.name,true);await clock.advance(900000);
   assert.equal(table.get('busy')!.status,'running');assert.equal(store.roleOf('busy'),'implementer');
   assert.equal(store.hosts.provisions.get(host.name)!.state,'ready');assert.equal(result,undefined);return;
  }
  await clock.advance(720000);
 }
 await until(()=>result!==undefined||errors.length>0,{what:'outage confirmed deletion producer completed'});
 assert.deepEqual(errors,[]);assert.equal(result?.state,'destroyed');assert.ok(result?.machineDeletionRead);
 assert.equal(failures.length,outcome==='mirror-failure'?1:0);
 assert.equal(watchdogRunning,false);
 assert.equal(table.get('busy')!.status,'exited');assert.equal(store.roleOf('busy'),null);assert.equal(store.hosts.leases.get(host.name),null);
});

test('provider replies are fenced by the outage and flapping checks are rate bounded',async t=>{
 const db=new DatabaseSync(':memory:'),records=new HostRecords(db),clock=new FakeClock();
 let closeHealth=async()=>{},closeOwner=async()=>{};
 t.after(()=>closeAll([()=>closeHealth(),()=>closeOwner(),async()=>{await closeAll([()=>records.leases.close(),()=>db.close()]);}]));
 records.insert({id:'flap',address:'fake',user:'agent',clientKeyPath:'unused',knownHosts:'unused'},'synthetic');
 records.provisions.ready({id:'flap',pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:clock.now().toISOString(),state:'ready',machine:{id:'fake',address:'fake',architecture:'arm64',created:clock.now().toISOString()}});
 const reply=Promise.withResolvers<{state:'gone'}>();let checks=0,losses=0;
 const health=new HostHealth({records,clock,env:{},notice:()=>{},status:()=>{checks++;return reply.promise;},lost:async()=>{losses++;},error:error=>{throw error;}});
 closeHealth=()=>health.close();
 const drainHealth=closeHealth;closeHealth=async()=>{reply.resolve({state:'gone'});await drainHealth();};
 health.transition('flap',false);health.transition('flap',true);health.transition('flap',false);
 assert.equal(checks,1);
 reply.resolve({state:'gone'});await clock.advance(1);assert.equal(losses,0);
 health.transition('flap',true);await clock.advance(60000);health.transition('flap',false);
 await until(()=>losses===1,{what:'new outage provider absence processed'});assert.equal(checks,2);
});

import { acquireLockAsync } from '../src/hub/lock.ts';
import { spendPath } from '../src/executor/droplet/spend.ts';
test('loss waits for ledger-blocked renewal before publishing the watchdog deadline',async t=>{
 const f=await scratchMachine(t,{identity:false}),clock=new FakeClock(),db=new DatabaseSync(':memory:'),records=new HostRecords(db);
 const processes=fakeLockProcesses().processes;
 const o={root:f.root,env:f.env,clock,processes,leaseMs:3600000,caps:{shared:10,hosts:10},pool:'agents',size:'fake',priceHourly:0,billingMinimumMs:60000};
 await records.leases.create('held',o);
 const lock=await acquireLockAsync(spendPath(f.env)+'.lock',undefined,undefined,undefined,processes);
 let expiring:Promise<void>|undefined,expired=false;
 beforeDirectories(t,async()=>{await lock.release();await clock.advance(60000);await expiring;await records.leases.close();db.close();});
 records.leases.arm('held',o,()=>true);
 await clock.advance(900000);
 const previous=records.leases.get('held')!.deadline;
 expiring=records.leases.expireNow('held',f.root,clock).then(()=>{expired=true;});
 assert.equal(expired,false);assert.equal(records.leases.get('held')!.deadline,previous);
 await lock.release();
 for(let n=0;n<60&&!expired;n++)await clock.advance(1000);
 await until(()=>expired,{what:'loss expiry joined renewal and persisted both deadlines'});
 const deadline=records.leases.get('held')!.deadline;
 assert.equal(readHostLeaseFile(f.root,'held')!.deadline,deadline);
 assert.ok(Date.parse(deadline)>=Date.parse('2026-10-16T12:15:00Z'));
 assert.ok(Date.parse(deadline)<=clock.now().getTime());
 await clock.advance(3600000);assert.equal(records.leases.get('held')!.deadline,deadline);
});

import { mkdir } from 'node:fs/promises';
import { hostLeasePath } from '../src/host/host-leases.ts';

import { PoolRuntime } from '../src/host/pool-runtime.ts';
import { readHostPools } from '../src/host/pools.ts';
for(const spare of [false,true])for(const recover of [false,true])test(`idle stop and outage grace retain a 30s lease: spare=${spare} recover=${recover}`,async t=>{
 const f=await scratchMachine(t,{identity:false}),clock=new FakeClock(),db=new DatabaseSync(':memory:'),records=new HostRecords(db);
 let closeHealth=async()=>{},closeRuntime:()=>void|Promise<void>=()=>{};
 beforeDirectories(t,()=>closeAll([()=>closeHealth(),()=>closeRuntime(),()=>records.leases.close(),()=>db.close()]));
 const env=fixtureEnvironment(f.root,f.env,{CLAND_FAKE_HOST_ROOT:f.root}),provider=new FakeHostProvider({env,now:()=>clock.now().getTime()});
 const acquired=await provider.acquire({project:f.root,pool:'agents',architecture:'arm64'});
 assert.equal(acquired.state,'created');if(acquired.state!=='created')throw Error('fixture acquire failed');
 const id='z-idle';
 records.insert({id,address:acquired.machine.address,user:'agent',clientKeyPath:'unused',knownHosts:'unused'},'synthetic');
 records.provisions.ready({id,pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:clock.now().toISOString(),state:'ready',machine:acquired.machine});
 if(spare){records.insert({id:'a-spare',address:'spare',user:'agent',clientKeyPath:'unused',knownHosts:'unused'},'synthetic');records.provisions.ready({...records.provisions.get(id)!,id:'a-spare',machine:{...acquired.machine,address:'spare'}});}
 const settings=readHostPools({agents:{provider:'fake',slots:8,min_hosts:1,max_hosts:3,idle_stop:'30s'}});
 const runtime=new PoolRuntime(()=>settings,records,host=>!health.holds(host),()=>[],()=>{},host=>health.holds(host));closeRuntime=()=>runtime.close();
 const o={root:f.root,env,clock,processes:fakeLockProcesses().processes,leaseMs:30000,caps:{shared:10,hosts:10},pool:'agents',size:'fake',priceHourly:0,billingMinimumMs:60000};
 await records.leases.create(id,o);
 const lines:string[]=[];let destroyed:Awaited<ReturnType<typeof loseHost>>|undefined,creates=0,idleStops=0;
 const health=new HostHealth({records,clock,env,notice:s=>{lines.push(s);},status:async()=>({state:'ready'}),error:error=>{throw error;},lost:async host=>{destroyed=await loseHost({...o,id:host,records,provider,inUse:id=>runtime.inUse(id),owner:{remove:async id=>{records.revoke(id);}} as Parameters<typeof loseHost>[0]['owner'],log:()=>{}});}});closeHealth=()=>health.close();
 runtime.start(async()=>{creates++;return {state:'ready'};},{clock,declarations:()=>provider.declarations,destroy:async()=>{idleStops++;}});
 health.transition(id,false);runtime.reconcile();assert.equal(runtime.inUse(id),true);assert.throws(()=>runtime.reserve('agents','codex',id),/no room/);
 records.leases.arm(id,o,()=>runtime.inUse(id),error=>{throw error;},async()=>assert.fail('lease/watchdog must not preempt Health grace'));
 for(let elapsed=7500;elapsed<=(recover?600000:900000);elapsed+=7500){
  const previous=records.leases.get(id)?.deadline;
  await clock.advance(7500);
  if(elapsed===900000)break;
  await until(()=>records.leases.get(id)!.deadline!==previous,{what:'grace renewal deadline persisted'});
  if(elapsed===210000){assert.equal(records.provisions.get(id)!.state,'unreachable');assert.equal(runtime.inUse(id),true);assert.equal(destroyed,undefined);assert.equal(creates,0);}
 }
 assert.deepEqual(lines,['host z-idle unreachable']);assert.equal(creates,0);assert.equal(idleStops,0,'idle destruction owner never admitted during outage grace');
 if(recover){health.transition(id,true);assert.equal(records.provisions.get(id)!.state,'ready');assert.equal(health.holds(id),false);assert.equal(destroyed,undefined);}
 else {await until(()=>destroyed!==undefined,{what:'Health confirmed the 15-minute deletion'});assert.equal(destroyed!.state,'destroyed');assert.equal(records.leases.get(id),null);}
});

import { rmdir } from 'node:fs/promises';
test('failed lease shortening retains an owned next-tick mirror retry',async t=>{
 const f=await scratchMachine(t,{identity:false}),clock=new FakeClock(),db=new DatabaseSync(':memory:'),records=new HostRecords(db);
 beforeDirectories(t,()=>closeAll([()=>records.leases.close(),()=>db.close()]));
 const o={root:f.root,env:f.env,clock,processes:fakeLockProcesses().processes,leaseMs:3600000,caps:{shared:10,hosts:10},pool:'agents',size:'fake',priceHourly:0,billingMinimumMs:60000};
 await records.leases.create('retry',o);await clock.advance(900000);
 const previous=readHostLeaseFile(f.root,'retry')!.deadline;
 await mkdir(hostLeasePath(f.root,'retry')+'.next');
 await assert.rejects(records.leases.expireNow('retry',f.root,clock),{code:'host-lease-publication'});
 assert.equal(records.leases.get('retry')!.deadline,'2026-10-16T12:15:00.000Z');
 assert.equal(readHostLeaseFile(f.root,'retry')!.deadline,previous);
 await rmdir(hostLeasePath(f.root,'retry')+'.next');
 await clock.advance(999);assert.equal(readHostLeaseFile(f.root,'retry')!.deadline,previous);
 await clock.advance(1);assert.equal(readHostLeaseFile(f.root,'retry')!.deadline,'2026-10-16T12:15:00.000Z');
 await records.leases.close();assert.equal(clock.pending,0);
});
