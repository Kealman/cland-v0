// T2: scheduler spend admission, sealed ledger and hub notices; fake provider/clock only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tempProject } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { FakeClock } from './fake-clock.ts';
import { reserveHostSpend, renewHostSpend, inspectSpend } from '../src/executor/droplet/spend.ts';

import { fakeLockProcesses } from './fakes/lock-processes.ts';
const lockProcesses = fakeLockProcesses().processes;

test('admitted host renews beyond hosts sub-cap while shared cap still applies',async t=>{
 const root=await tempProject(t),env=fixtureEnvironment(root,process.env),clock=new FakeClock();
 const created=clock.now().toISOString();
 const host={project:root,lease:'live',pool:'agents',size:'fake',priceHourly:1,billingMinimumMs:0,created,deadline:new Date(clock.now().getTime()+3600000).toISOString()};
 const caps={shared:3,hosts:1};
 await reserveHostSpend(host,caps,env,{clock,processes:lockProcesses});
 await renewHostSpend(root,'live',new Date(clock.now().getTime()+7200000).toISOString(),caps,env,{clock,processes:lockProcesses});
 assert.equal((await inspectSpend(3,env,clock,lockProcesses)).reserved,2);
 await assert.rejects(renewHostSpend(root,'live',new Date(clock.now().getTime()+14400000).toISOString(),caps,env,{clock,processes:lockProcesses}),/daily spend cap/);
 assert.equal((await inspectSpend(3,env,clock,lockProcesses)).reserved,2);
});

import { projectHub, eventually } from './harness.ts';
import { sessionUi } from './session-credential-fixture.ts';
import { mkdir,writeFile,readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spendPath } from '../src/executor/droplet/spend.ts';

test('80 percent General warning survives restart and repeats only on a new UTC day',async t=>{
 const root=await tempProject(t),env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root}),clock=new FakeClock(Date.now());
 await mkdir(join(root,'.cland'),{recursive:true});
 await writeFile(join(root,'.cland/config.toml'),'[hosts]\ndaily_spend_usd=1\n[hosts.agents]\nprovider="fake"\nslots=1\nmin_hosts=0\n');
 const created=clock.now().toISOString();
 let hub=await projectHub(t,root,env,{clock,droplet:{processes:lockProcesses},processes:lockProcesses});
 const deadline=new Date(clock.now().getTime()+3600000).toISOString();
 await reserveHostSpend({project:root,lease:'live',pool:'agents',size:'fake',priceHourly:0.8,billingMinimumMs:0,created,deadline},{shared:100,hosts:1},env,{clock,processes:lockProcesses});
 let ui=await sessionUi(t,hub.discovery,'cli');
 const warnings=async()=>{const reply=await ui.request({type:'topic.history',topic:'general'});return (reply.value as {messages:Array<{text:string}>}).messages.filter(m=>m.text.includes('hosts daily spend'));};
 await eventually('durable 80 percent General warning',async()=> (await warnings()).length===1?true:undefined);
 await hub.stop();
 hub=await projectHub(t,root,env,{clock,droplet:{processes:lockProcesses},processes:lockProcesses});ui=await sessionUi(t,hub.discovery,'cli');
 await renewHostSpend(root,'live',deadline,{shared:100,hosts:1},env,{clock,processes:lockProcesses});assert.equal((await warnings()).length,1);
 clock.block(86400000);
 await renewHostSpend(root,'live',new Date(clock.now().getTime()+3600000).toISOString(),{shared:100,hosts:1},env,{clock,processes:lockProcesses});
 await eventually('new UTC day warning includes carried reservation',async()=> (await warnings()).length===2?true:undefined);
 assert.equal((await warnings()).length,2);
});

import { Store } from '../src/hub/store.ts';
import { PoolRuntime, PoolCapacityUnavailable } from '../src/host/pool-runtime.ts';
import { readHostPools } from '../src/host/pools.ts';
import { onCleanup } from './process-cleanup.ts';

test('full hosts cap keeps demand waiting without provider acquisition or ledger entry and retains busy host',async t=>{
 const root=await tempProject(t),env=fixtureEnvironment(root,process.env),clock=new FakeClock();
 const store=new Store(join(root,'hub.db'));
 let runtime:PoolRuntime|undefined;
 onCleanup(t,async()=>{try{await runtime?.close();}finally{try{await store.hosts.leases.close();}finally{store.close();}}});
 const settings=readHostPools({weights:{codex:1},daily_spend_usd:1,agents:{provider:'fake',slots:1,min_hosts:0,max_hosts:2}});
 const created=clock.now().toISOString();
 const options={root,env,clock,processes:lockProcesses,leaseMs:3600000,caps:{shared:10,hosts:1},pool:'agents',size:'fake',priceHourly:1,billingMinimumMs:0};
 await store.hosts.leases.create('live',options);
 store.hosts.insert({id:'live',address:'fake',user:'agent',clientKeyPath:'',knownHosts:''},'fixture');
 store.hosts.provisions.ready({id:'live',pool:'agents',provider:'fake',size:'fake',region:'fake',created,state:'ready',machine:{id:'live',address:'fake',architecture:'arm64',created}});
 const processes=[{key:'session',host:'live',harness:'codex'}];
 runtime=new PoolRuntime(()=>settings,store.hosts,()=>true,()=>processes);
 let providerCalls=0,refused=false;
 runtime.start(async()=>{
  try{await store.hosts.leases.create('second',options);}catch(error){assert.match(String(error),/hosts daily spend cap/);refused=true;throw error;}
  providerCalls++;return {state:'ready'};
 },{clock,declarations:()=>{throw Error('busy host must stay');},destroy:async()=>{throw Error('busy host must stay');}});
 let waiting:PoolCapacityUnavailable|undefined;
 try{runtime.reserve('agents','codex');}catch(error){assert.ok(error instanceof PoolCapacityUnavailable);waiting=error;}
 assert.equal(waiting?.reason,'waiting for a host');runtime.demand(waiting!,()=>{});
 await eventually('second reservation refused',()=>refused?true:undefined);
 assert.equal(providerCalls,0);
 assert.equal(JSON.parse(await readFile(spendPath(env),'utf8')).entries.length,1);
 assert.equal(store.hosts.leases.get('second'),null);
 assert.equal(runtime.inUse('live'),true);
 assert.equal(store.hosts.provisions.get('live')?.state,'ready');assert.equal(processes.length,1);
 await clock.advance(900000);await store.hosts.leases.renew('live',options);
 assert.ok(Date.parse(store.hosts.leases.get('live')!.deadline)>Date.parse(created)+3600000);
 assert.throws(()=>runtime.reserve('agents','codex'),PoolCapacityUnavailable);
});

test('cap-refused scheduler launch remains in the durable waiting list through retry',async t=>{
 const root=await tempProject(t),env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root}),clock=new FakeClock(Date.now());
 await mkdir(join(root,'.cland'),{recursive:true});
 await writeFile(join(root,'.cland/config.toml'),'[hosts]\ndaily_spend_usd=1\n[hosts.agents]\nprovider="fake"\nslots=1\nmin_hosts=0\nmax_hosts=2\n');
 await writeFile(join(root,'.cland/roles.toml'),'[implementer.launch]\npool="agents"\n');
 const created=clock.now().toISOString();
 const input={project:root,lease:'existing',pool:'agents',size:'fake',priceHourly:1,billingMinimumMs:0,created,deadline:new Date(clock.now().getTime()+3600000).toISOString()};
 await reserveHostSpend(input,{shared:10,hosts:1},env,{clock,processes:lockProcesses});
 let refusals=0,providerCalls=0,startupSweepCompleted=false;
 const hub=await projectHub(t,root,env,{clock,droplet:{processes:lockProcesses},processes:lockProcesses,log:entry=>{if(entry.event==='executor-sweep'&&entry.failures===0)startupSweepCompleted=true;},createHost:async options=>{
  try{await reserveHostSpend({...input,lease:'candidate'},{shared:10,hosts:1},env,{clock,processes:lockProcesses});}
  catch(error){refusals++;throw error;}
  providerCalls++;throw Error('unexpected provider acquisition');
 }});
 // Startup recovery can hold the spend lock; its backoff uses this same fake clock.
 await eventually('startup executor sweep completed',()=>startupSweepCompleted?true:undefined);
 await assert.rejects(readFile(spendPath(env)+'.lock','utf8'),{code:'ENOENT'});
 const ui=await sessionUi(t,hub.discovery,'cli');
 const reply=await ui.request({type:'session.launch',name:'waiting',role:'implementer',harness:'codex'});
 assert.equal(reply.ok,true);
 await eventually('first cap refusal',()=>refusals===1?true:undefined);
 const waiting=async()=>((await ui.request({type:'session.list'})).value as {waiting:Array<{reason:string}>}).waiting;
 assert.equal((await waiting()).length,1);assert.equal((await waiting())[0]!.reason,'waiting for a host');
 await clock.advance(60000);await eventually('retry cap refusal',()=>refusals===2?true:undefined);
 assert.equal((await waiting()).length,1);assert.equal(providerCalls,0);
 assert.equal(JSON.parse(await readFile(spendPath(env),'utf8')).entries.length,1);
});

import fsPromises from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { onHostSpendChange, settleHostSpend, cancelHostSpend } from '../src/executor/droplet/spend.ts';

test('mutation notices reuse loaded ledger with no observer reads and unsubscribe retires owner',async t=>{
 const root=await tempProject(t),env=fixtureEnvironment(root,process.env),clock=new FakeClock();
 const path=spendPath(env),originalRead=fsPromises.readFile;
 let reads=0;
 t.mock.method(fsPromises,'readFile',async(...args:Parameters<typeof fsPromises.readFile>)=>{
  if(String(args[0])===path)reads++;
  return originalRead(...args);
 });
 syncBuiltinESMExports();
 onCleanup(t,()=>{t.mock.restoreAll();syncBuiltinESMExports();});
 const snapshots:Array<{spent:number;reserved:number;pools:string[]}>=[];
 const stop=onHostSpendChange(env,root,value=>snapshots.push(value));
 onCleanup(t,stop);
 const created=clock.now().toISOString();
 const input={project:root,lease:'live',pool:'agents',size:'fake',priceHourly:1,billingMinimumMs:0,created,deadline:new Date(clock.now().getTime()+3600000).toISOString()};
 const caps={shared:10,hosts:5},timing={clock,processes:lockProcesses};
 await reserveHostSpend(input,caps,env,timing);
 assert.equal(reads,1);assert.equal(snapshots.length,1);assert.equal(snapshots[0]!.reserved,1);
 await renewHostSpend(root,'live',new Date(clock.now().getTime()+7200000).toISOString(),caps,env,timing);
 assert.equal(reads,2);assert.equal(snapshots[1]!.reserved,2);
 await settleHostSpend(root,'live',new Date(clock.now().getTime()+1800000).toISOString(),env,timing);
 assert.equal(reads,3);assert.equal(snapshots[2]!.spent,0.5);assert.equal(snapshots[2]!.reserved,0);
 await reserveHostSpend({...input,lease:'cancelled',pool:'builders'},caps,env,timing);
 assert.equal(reads,4);assert.deepEqual(snapshots[3]!.pools,['agents','builders']);
 await cancelHostSpend({project:root,lease:'cancelled'},{kind:'not-called',at:created},env,timing);
 assert.equal(reads,5);assert.equal(snapshots[4]!.spent,0.5);assert.equal(snapshots[4]!.reserved,0);
 stop();
 const replacement:Array<unknown>=[];
 const stopReplacement=onHostSpendChange(env,root,value=>replacement.push(value));onCleanup(t,stopReplacement);
 stop(); // Retired owner cleanup must not remove the replacement registry.
 await reserveHostSpend({...input,lease:'replacement'},caps,env,timing);
 assert.equal(reads,6);assert.equal(snapshots.length,5);assert.equal(replacement.length,1);
});
