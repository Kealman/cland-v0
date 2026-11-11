import {settledLogin,capacityLogin} from './settled-login-fixture.ts';
// T2: pool retry lifecycle with real inventory, fake provider and hub clock; no children.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tempProject, eventually } from './harness.ts';
import { Store } from '../src/hub/store.ts';
import { PoolRuntime } from '../src/host/pool-runtime.ts';
import { readHostPools } from '../src/host/pools.ts';
import { FakeClock } from './fake-clock.ts';
import { onCleanup } from './process-cleanup.ts';

test('C3 provider retry time holds capacity creation without a cascade',async t=>{
 const root=await tempProject(t),store=new Store(join(root,'hub.db')),clock=new FakeClock();
 const settings=readHostPools({agents:{provider:'fake',slots:1,min_hosts:1,max_hosts:1}});
 const runtime=new PoolRuntime(()=>settings,store.hosts,()=>true,()=>[]);
 onCleanup(t,async()=>{await runtime.close();store.close();});
 let calls=0;
 runtime.start(async()=>{calls++;return {state:'failed',retryAt:new Date(clock.now().getTime()+120000).toISOString()};},{clock,declarations:()=>{throw Error('unused');},destroy:async()=>{}});
 await eventually('first refusal returned',()=>calls===1?true:undefined);
 await clock.advance(119999);assert.equal(calls,1);
 await clock.advance(1);await eventually('one retry admitted',()=>calls===2?true:undefined);
 assert.equal(calls,2);
});

import { hostBootGate, hostBootMs } from '../src/host/boot-gate.ts';
import { FakeHostProvider } from '../src/host/provider/fake.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { destroyHost } from '../src/host/provision-host.ts';
import { lifecycleNotice } from '../src/hub/agents-topic.ts';

for (const mode of ['neverBoot','pinned-key'] as const) test(`C1/C2 ${mode} fails at five minutes and deletion is confirmed`,async t=>{
 const root=await tempProject(t),store=new Store(join(root,'hub.db')),clock=new FakeClock();
 const env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root});
 const provider=new FakeHostProvider({env,now:()=>clock.now().getTime(),neverBoot:mode==='neverBoot'});
 const acquired=await provider.acquire({project:root,pool:'agents',architecture:'arm64'});
 assert.equal(acquired.state,'created');if(acquired.state!=='created')throw Error('fixture acquire');
 const row={id:'host-test',pool:'agents',provider:'fake',size:'fake',region:'fake',created:clock.now().toISOString(),state:'booting' as const,machine:acquired.machine};
 store.hosts.provisions.save(row);
 const abort=new AbortController();let probes=0,outcome='pending';
 const gate=hostBootGate(clock,clock.now().getTime()+300000,async()=>{probes++;if((await provider.status(acquired.machine)).state!=='ready')throw Error('booting');throw Error('pinned key unavailable');},abort.signal).then(()=>{outcome='ready';},e=>{outcome=String(e);});
 onCleanup(t,async()=>{abort.abort();await gate;await store.hosts.leases.close();store.close();});
 await eventually('initial probe completed',()=>probes>0?true:undefined);
 await clock.advance(299999);assert.equal(outcome,'pending');
 await clock.advance(1);await gate;assert.match(outcome,/provisioning gate timed out/);
 const deleted=await destroyHost({root,id:row.id,env,clock,records:store.hosts,provider,owner:{} as Parameters<typeof destroyHost>[0]['owner'],log:()=>{}});
 assert.equal(deleted.state,'destroyed');assert.ok(deleted.machineDeletionRead);
 assert.equal((await provider.status(acquired.machine)).state,'gone');
});

test('C5 boot shortening is fenced to fake hosts',()=>{
 assert.equal(hostBootMs({CLAND_TEST_HOST_BOOT_MS:'7'}),300000);
 assert.equal(hostBootMs({CLAND_FAKE_HOST_ROOT:'/fake',CLAND_TEST_HOST_BOOT_MS:'7'}),7);
 for(const value of ['0','-1','NaN'])assert.equal(hostBootMs({CLAND_FAKE_HOST_ROOT:'/fake',CLAND_TEST_HOST_BOOT_MS:value}),300000);
});

test('boot failure lifecycle notice names the host and addresses only Coordinator',()=>{
 const notice=lifecycleNotice({event:'host-boot-failed',host:'host-test',pool:'agents',reason:'boot timeout'},name=>name);
 assert.equal(notice?.kind,'host-boot-failed');assert.deepEqual(notice.to,['coordinator']);assert.match(notice.text,/host-test/);
});

test('C4 retries double to thirty minutes and ready resets the failure streak',async t=>{
 const root=await tempProject(t),store=new Store(join(root,'hub.db')),clock=new FakeClock();
 const settings=readHostPools({agents:{provider:'fake',slots:1,min_hosts:1,max_hosts:1}});
 let calls=0,ready=false;
 const runtime=new PoolRuntime(()=>settings,store.hosts,()=>true,()=>[]);
 onCleanup(t,async()=>{await runtime.close();store.close();});
 runtime.start(async()=>{calls++;if(ready){store.hosts.insert({id:'ready',address:'ready',user:'fixture',clientKeyPath:'',knownHosts:''},'fixture');store.hosts.provisions.ready({id:'ready',machine:{id:'ready',address:'ready',architecture:'arm64',created:clock.now().toISOString()},pool:'agents',provider:'fake',size:'fake',region:'fake',created:clock.now().toISOString(),state:'ready'});return {state:'ready'};}return {state:'failed'};},{clock,declarations:()=>{throw Error('unused');},destroy:async()=>{}});
 await eventually('initial failure',()=>calls===1?true:undefined);
 for(const delay of [60000,120000,240000,480000,960000,1800000,1800000]){
  const before=calls;await clock.advance(delay-1);assert.equal(calls,before);
  await clock.advance(1);await eventually('next failure',()=>calls===before+1?true:undefined);
 }
 ready=true;await clock.advance(1800000);await eventually('ready receipt',()=>store.hosts.provisions.get('ready')?.state==='ready'?true:undefined);
 store.hosts.provisions.save({...store.hosts.provisions.get('ready')!,state:'destroyed'});ready=false;runtime.reconcile();
 const before=calls;await eventually('new failure after ready',()=>calls>before?true:undefined);
 const failed=calls;await clock.advance(59999);assert.equal(calls,failed);await clock.advance(1);await eventually('reset minute retry',()=>calls===failed+1?true:undefined);
});

import { mkdir,writeFile } from 'node:fs/promises';
import { projectHub } from './harness.ts';
import { sessionUi } from './session-credential-fixture.ts';

for(const mode of ['neverBoot','pinned-key','refuseUntil'] as const)test(`waiting launch survives ${mode} with one failure notice and bounded retry`,async t=>{
 const root=await tempProject(t),clock=new FakeClock(Date.now());
 await mkdir(join(root,'.cland'),{recursive:true});
 await writeFile(join(root,'.cland/config.toml'),'[hosts.agents]\nprovider="fake"\nslots=1\nmin_hosts=0\nmax_hosts=1\n');
 await writeFile(join(root,'.cland/roles.toml'),'[implementer.launch]\npool="agents"\n');
 const env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root});
 const provider=new FakeHostProvider({env,now:()=>clock.now().getTime(),neverBoot:mode==='neverBoot',...(mode==='refuseUntil'?{refuseUntil:new Date(clock.now().getTime()+120000).toISOString()}: {})});
 let inventory!:import('../src/host/records.ts').HostRecords;
 let calls=0,probes=0;const aborted=new AbortController();
 // Register cancellation before hub cleanup, which joins the creator.
 onCleanup(t,()=>aborted.abort());
 const hub=await projectHub(t,root,{CLAND_FAKE_HOST_ROOT:root}, {clock,createHost:async options=>{
  inventory=options.records;calls++;options.admit?.('agents',readHostPools({agents:{provider:'fake',slots:1,min_hosts:0,max_hosts:1}}).pools.agents!);
  const acquired=await provider.acquire({project:root,pool:'agents',architecture:'arm64'});
  if(acquired.state!=='created')return {state:'failed',retryAt:'retryAt' in acquired?acquired.retryAt:undefined} as Awaited<ReturnType<typeof import('../src/host/provision-host.ts').createHost>>;
  const row={id:'failure-'+calls,pool:'agents',provider:'fake',size:'fake',region:'fake',created:clock.now().toISOString(),state:'booting' as const,machine:acquired.machine};
  options.records.provisions.save(row);
  try{await hostBootGate(clock,clock.now().getTime()+300000,async()=>{probes++;if((await provider.status(acquired.machine)).state!=='ready')throw Error('booting');throw Error('pinned key never answers');},AbortSignal.any([aborted.signal,options.signal!]));}catch{}
  const failed={...row,state:'failed' as const,reason:'fixture boot failure'};options.records.provisions.save(failed);return failed;
 }});
 const metadata=new Store(join(root,'.cland/hub.db'));onCleanup(t,()=>metadata.close());capacityLogin(metadata.hosts.logins);
 const ui=await sessionUi(t,hub.discovery,'cli');
 const launched=await ui.request({type:'session.launch',name:'waiting',role:'implementer',harness:'codex'});assert.equal(launched.ok,true);
 await eventually('provider admission',()=>calls===1&&(mode==='refuseUntil'||probes>0)?true:undefined);
 const waiting=async()=>((await ui.request({type:'session.list'})).value as {waiting:unknown[]}).waiting;
 assert.equal((await waiting()).length,1);
 if(mode==='refuseUntil'){
  await clock.advance(119999);assert.equal(calls,1);await clock.advance(1);await eventually('retry acquire',()=>calls===2?true:undefined);
 }else{
  await clock.advance(299999);assert.equal(inventory.provisions.get('failure-1')?.state,'booting');
  await clock.advance(1);
  await eventually('confirmed deletion persisted',()=>inventory.provisions.get('failure-1')?.state==='destroyed'?true:undefined);
  const notices=async()=>{const result=await ui.request({type:'topic.history',topic:'agents'});return (result.value as {messages:Array<{kind:string;text:string}>}).messages.filter(row=>row.kind==='host-boot-failed');};
  await eventually('one Agents notice',async()=>(await notices()).length===1?true:undefined);
  assert.match((await notices())[0]!.text,/failure-1/);
  await clock.advance(59999);assert.equal(calls,1);await clock.advance(1);await eventually('minute retry',()=>calls===2?true:undefined);
  assert.equal((await notices()).length,1);
 }
 assert.equal((await waiting()).length,1);assert.equal(hub.fakes.codex!.spawns.length,0);
});

test('only a changed pool configuration resets its backoff, including no-argument configure',async t=>{
 const root=await tempProject(t),store=new Store(join(root,'hub.db')),clock=new FakeClock();
 const settings=readHostPools({agents:{provider:'fake',slots:1,min_hosts:1,max_hosts:1},other:{provider:'fake',slots:1,min_hosts:0}});
 const runtime=new PoolRuntime(()=>settings,store.hosts,()=>true,()=>[]);let calls=0;
 onCleanup(t,async()=>{await runtime.close();store.close();});
 runtime.start(async()=>{calls++;return {state:'failed'};},{clock,declarations:()=>{throw Error('unused');},destroy:async()=>{}});
 await eventually('failure',()=>calls===1?true:undefined);await clock.advance(1);
 settings.pools.other!.slots=2;runtime.configure();await clock.advance(1);assert.equal(calls,1);
 settings.pools.agents!.slots=2;runtime.configure();await eventually('changed pool retries now',()=>calls===2?true:undefined);
});

for(const reset of ['configure','ready'] as const)test(`provider not-before survives ${reset} reset`,async t=>{
 const root=await tempProject(t),store=new Store(join(root,'hub.db')),clock=new FakeClock();
 const settings=readHostPools({agents:{provider:'fake',slots:1,min_hosts:1,max_hosts:2}});let calls=0;
 const runtime=new PoolRuntime(()=>settings,store.hosts,()=>true,()=>[]);
 onCleanup(t,async()=>{await runtime.close();store.close();});
 runtime.start(async()=>{calls++;return {state:'failed',retryAt:new Date(clock.now().getTime()+120000).toISOString()};},{clock,declarations:()=>{throw Error('unused');},destroy:async()=>{}});
 await eventually('provider refusal',()=>calls===1?true:undefined);await clock.advance(1);
 if(reset==='configure'){settings.pools.agents!.slots=2;runtime.configure();}
 else {
  store.hosts.insert({id:'peer',address:'peer',user:'fixture',clientKeyPath:'',knownHosts:''},'fixture');
  store.hosts.provisions.ready({id:'peer',machine:{id:'peer',address:'peer',architecture:'arm64',created:clock.now().toISOString()},pool:'agents',provider:'fake',size:'fake',region:'fake',created:clock.now().toISOString(),state:'ready'});
  store.hosts.provisions.save({...store.hosts.provisions.get('peer')!,state:'destroyed'});runtime.reconcile();
 }
 await clock.advance(119998);assert.equal(calls,1);await clock.advance(1);await eventually('retry at provider time',()=>calls===2?true:undefined);
});

test('fake boot knob cannot extend the fixed deadline',()=>{
 assert.equal(hostBootMs({CLAND_FAKE_HOST_ROOT:'/fake',CLAND_TEST_HOST_BOOT_MS:'600000'}),300000);
});

for(const phase of ['status','ssh'] as const)test(`identified ${phase} probe is cancelled and joined at the absolute boot deadline`,async()=>{
 const clock=new FakeClock();let entered=false,closed=false,outcome='pending';
 const gate=hostBootGate(clock,clock.now().getTime()+300000,async(_remaining,signal)=>{
  entered=true;
  try{await new Promise<void>((_resolve,reject)=>{signal.addEventListener('abort',()=>reject(signal.reason),{once:true});});}
  finally{closed=true;}
 }).then(()=>{outcome='ready';},error=>{outcome=String(error);});
 await eventually('probe entered',()=>entered?true:undefined);
 await clock.advance(299999);assert.equal(outcome,'pending');assert.equal(closed,false);
 await clock.advance(1);await gate;assert.equal(closed,true);assert.match(outcome,/provisioning gate timed out/);
});

test('cleanup refusal retains its record while a ready sibling places waiting launches',async t=>{
 const root=await tempProject(t),clock=new FakeClock(Date.now());
 await mkdir(join(root,'.cland'),{recursive:true});
 await writeFile(join(root,'.cland/config.toml'),'# managed by cland\n[hosts]\nweights={codex=1}\n[hosts.agents]\nprovider="fake"\nslots=1\nmin_hosts=0\nmax_hosts=3\n');
 await writeFile(join(root,'.cland/roles.toml'),'[implementer.launch]\npool="agents"\n');
 const {testHost}=await import('../src/host/test-host.ts');const {localHost}=await import('../src/host/local.ts');const {HostSecretStore}=await import('../src/host/records.ts');
 const local=localHost(fixtureEnvironment(root,process.env));
 let records!:import('../src/host/records.ts').HostRecords,calls=0;
 const hub=await projectHub(t,root,{CLAND_FAKE_HOST_ROOT:root},{clock,hosts:[{...testHost('ready',()=>{}),realpath:local.realpath,statDirectory:async()=>({refusal:null,identity:null})}],createHost:async options=>{
  records=options.records;calls++;const row={id:'retained-'+calls,pool:'agents',provider:'unavailable-provider',size:'fake',region:'fake',created:clock.now().toISOString(),state:'failed' as const,acquisition:'acquired' as const,machine:{id:'captured-'+calls,address:'captured-'+calls,architecture:'x86_64' as const,created:clock.now().toISOString()}};
  records.provisions.save(row);return row;
 }});
 const metadata=new Store(join(root,'.cland/hub.db'));onCleanup(t,()=>metadata.close());capacityLogin(metadata.hosts.logins);
 const ui=await sessionUi(t,hub.discovery,'cli');
 assert.equal((await ui.request({type:'session.launch',name:'sibling-launch',role:'implementer',harness:'codex'})).ok,true);
 await eventually('typed cleanup refusal persisted',()=>records?.provisions.get('retained-1')?.failure?.code==='cleanup-unavailable'?true:undefined);
 const failed=records.provisions.get('retained-1')!;assert.equal(failed.release,'incomplete');assert.equal(failed.acquisition,'acquired');assert.equal(records.provisions.occupied('agents'),1);
 await clock.advance(59999);assert.equal(calls,1);
 new HostSecretStore(root,records,()=>{}).register({id:'ready',address:'ready',user:'fixture',clientKeyPath:'',knownHosts:''});
 settledLogin(records.logins,'ready','codex',{provider:'fake',region:'fake'});
 records.provisions.ready({id:'ready',pool:'agents',provider:'fake',size:'fake',region:'fake',created:clock.now().toISOString(),state:'ready',machine:{id:'ready',address:'ready',architecture:'x86_64',created:clock.now().toISOString()}});
 await eventually('ready sibling accepts waiting launch',()=>hub.fakes.codex!.spawns.some(row=>row.name==='sibling-launch'&&row.host==='ready')?true:undefined);
 assert.equal(records.provisions.get('retained-1')?.failure?.code,'cleanup-unavailable');
 assert.equal((await ui.request({type:'session.launch',name:'more-capacity',role:'implementer',harness:'codex'})).ok,true);
 // The ready checkpoint reset boot backoff, allowing the third occupied slot.
 await eventually('another slot admitted without a pool-wide fence',()=>records.provisions.get('retained-2')?.failure?.code==='cleanup-unavailable'?true:undefined);
 const history=(await ui.request({type:'topic.history',topic:'agents'})).value as {messages:Array<{kind:string}>};
 assert.equal(history.messages.filter(row=>row.kind==='host-boot-failed').length,2);
 assert.equal(calls,2);assert.equal(records.provisions.occupied('agents'),3);
 await hub.stop(); // confirmed drainage, including retry timer ownership
});

test('consecutive retained cleanup failures preserve the exponential backoff streak',async t=>{
 const root=await tempProject(t),store=new Store(join(root,'hub.db')),clock=new FakeClock();
 const settings=readHostPools({agents:{provider:'fake',slots:1,min_hosts:1,max_hosts:3}});let calls=0;
 const runtime=new PoolRuntime(()=>settings,store.hosts,()=>true,()=>[]);
 onCleanup(t,async()=>{try{await runtime.close();}finally{store.close();}});
 runtime.start(async()=>{calls++;const row={id:'failed-'+calls,pool:'agents',provider:'missing',size:'fake',region:'fake',created:clock.now().toISOString(),state:'failed' as const,acquisition:'acquired' as const,machine:{id:'native-'+calls,address:'native-'+calls,architecture:'arm64' as const,created:clock.now().toISOString()}};store.hosts.provisions.save(row);return row;},{clock,declarations:()=>{throw Error('unused');},destroy:async()=>{throw Error('provider unavailable');}});
 await eventually('first retained failure',()=>store.hosts.provisions.get('failed-1')?.failure?.code==='cleanup-unavailable'?true:undefined);
 await clock.advance(59999);assert.equal(calls,1);await clock.advance(1);
 await eventually('second retained failure',()=>store.hosts.provisions.get('failed-2')?.failure?.code==='cleanup-unavailable'?true:undefined);
 await clock.advance(119999);assert.equal(calls,2);
 await clock.advance(1);await eventually('third retained failure',()=>store.hosts.provisions.get('failed-3')?.failure?.code==='cleanup-unavailable'?true:undefined);
 assert.equal(calls,3);
});

for(const completion of ['destroyed','released','replacement','ready'] as const)test(`rejected cleanup preserves a newer ${completion} checkpoint`,async t=>{
 const root=await tempProject(t),store=new Store(join(root,'hub.db')),clock=new FakeClock();
 const settings=readHostPools({agents:{provider:'fake',slots:1,min_hosts:1,max_hosts:1}});
 const hold=Promise.withResolvers<never>();let entered=false,completed=0,notices=0;
 const runtime=new PoolRuntime(()=>settings,store.hosts,()=>true,()=>[],()=>{completed++;});
 onCleanup(t,async()=>{hold.reject(Error('fixture cleanup'));try{await runtime.close();}finally{store.close();}});
 runtime.start(async()=>{const row={id:'captured',pool:'agents',provider:'fake',size:'fake',region:'fake',created:clock.now().toISOString(),state:'failed' as const,acquisition:'acquired' as const,machine:{id:'native',address:'native',architecture:'arm64' as const,created:clock.now().toISOString()}};store.hosts.provisions.save(row);return row;},{clock,declarations:()=>{throw Error('unused');},failed:()=>{notices++;},destroy:async()=>{entered=true;return hold.promise;}});
 await eventually('cleanup owner entered',()=>entered?true:undefined);
 const row=store.hosts.provisions.get('captured')!;
 const checkpoint:typeof row=completion==='replacement'?{...row,created:new Date(clock.now().getTime()+1).toISOString(),machine:{...row.machine!,id:'replacement',address:'replacement'}}:{...row,state:completion==='destroyed'?'destroyed':'failed',release:'released',machineDeletionRead:'confirmed native absence'};
 if(completion==='ready'){store.hosts.insert({id:'captured',address:'native',user:'fixture',clientKeyPath:'',knownHosts:''},'fixture');checkpoint.state='ready';delete checkpoint.release;delete checkpoint.machineDeletionRead;store.hosts.provisions.ready(checkpoint);}else store.hosts.provisions.save(checkpoint);
 hold.reject(Error('earlier cleanup outcome unavailable'));
 await eventually('flight settled after rejection',()=>completed===1?true:undefined);
 assert.deepEqual(store.hosts.provisions.get('captured'),checkpoint);
 assert.equal(notices,0);
});
