// T2: pool lifecycle with SQLite inventory, fake clock and injected lifecycle owner; no children.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tempProject, eventually } from './harness.ts';
import { onCleanup } from './process-cleanup.ts';
import { HostSecretStore } from '../src/host/records.ts';
import { Store } from '../src/hub/store.ts';
import { PoolRuntime } from '../src/host/pool-runtime.ts';
import { readHostPools } from '../src/host/pools.ts';
import { FakeClock } from './fake-clock.ts';
import { FakeHostProvider } from '../src/host/provider/fake.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { destroyHost } from '../src/host/provision-host.ts';

async function fixture(t:test.TestContext,minimum=1,billing=60000,declarationsMode:'sync'|'async'|'throw-once'='sync',ids=['z','a']) {
 const root=await tempProject(t),store=new Store(join(root,'hub.db')),clock=new FakeClock();
 const env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root});
 const provider=new FakeHostProvider({env,now:()=>clock.now().getTime(),declarations:{prices:{fake:{livePerHour:0,idleComputePerHour:0}},stoppedBills:true,billingGranularityMs:1000,billingMinimumMs:billing,tokenConfinement:'resource',apiRequestsPerMinute:60,machineLimit:10,architectures:['arm64'],extraAddressPerHour:0}});
 const settings=readHostPools({agents:{provider:'fake',slots:1,min_hosts:minimum,max_hosts:3,idle_stop:'1m'}});
 const processes:Array<{key:string;host:string;harness:string}>=[];
 for(const id of ids) {
  const acquired=await provider.acquire({project:root,pool:'agents',architecture:'arm64'});
  assert.equal(acquired.state,'created');if(acquired.state!=='created')throw Error('fixture acquire failed');
  store.hosts.insert({id,address:acquired.machine.address,user:'fixture',clientKeyPath:'',knownHosts:''},'fixture');
  const created=clock.now().toISOString();
  store.hosts.provisions.ready({id,pool:'agents',provider:'fake',size:'fake',region:'fake',created,state:'ready',machine:acquired.machine});
 }
 const runtime=new PoolRuntime(()=>settings,store.hosts,()=>true,()=>processes);
 onCleanup(t,async()=>{await runtime.close();store.close();});
 const destroyed:string[]=[];let reads=0;
 runtime.start(async()=>{throw Error('unexpected create');},{clock,declarations:()=>{reads++;if(declarationsMode==='throw-once'&&reads===1)throw Error('fixture declarations temporarily unavailable');return declarationsMode==='async'?Promise.resolve(provider.declarations):provider.declarations;},destroy:async(id:string)=>{
  const result=await destroyHost({root,id,env,clock,records:store.hosts,provider,owner:{remove:async(id:string)=>{store.hosts.revoke(id);}} as Parameters<typeof destroyHost>[0]['owner'],log:()=>{}});
  assert.equal(result.state,'destroyed');destroyed.push(id);
 }});
 return {runtime,clock,processes,destroyed,store,settings,reads:()=>reads};
}
test('C1 idle host is destroyed at one minute while min_hosts stays',async t=>{
 const f=await fixture(t);
 await f.clock.advance(59999);assert.deepEqual(f.destroyed,[]);
 await f.clock.advance(1);await eventually('confirmed destruction',()=>f.destroyed.includes('z')?true:undefined);assert.deepEqual(f.destroyed,['z']);
 assert.equal(f.store.hosts.provisions.get('z')!.state,'destroyed');
 await f.clock.advance(120000);assert.equal(f.store.hosts.provisions.get('a')!.state,'ready');
});
test('C2 billing minimum delays destruction beyond idle_stop',async t=>{
 const f=await fixture(t,1,180000);
 await f.clock.advance(179999);assert.deepEqual(f.destroyed,[]);
 await f.clock.advance(1);await eventually('confirmed destruction',()=>f.destroyed.includes('z')?true:undefined);assert.deepEqual(f.destroyed,['z']);
});
test('C3 running host stays beyond idle_stop and billing minimum',async t=>{
 const f=await fixture(t);
 f.processes.push({key:'worker',host:'z',harness:'codex'});f.runtime.reconcile();
 await f.clock.advance(3600000);await eventually('idle peer destroyed',()=>f.destroyed.includes('a')?true:undefined);
 assert.equal(f.store.hosts.provisions.get('z')!.state,'ready');
 assert.deepEqual(f.destroyed,['a'],'busy reverse-lexical host holds minimum');
});
test('C4 session gained during idle wait restarts the full wait after exit',async t=>{
 const f=await fixture(t,0);
 await f.clock.advance(30000);
 f.processes.push({key:'worker',host:'z',harness:'codex'});f.runtime.reconcile();
 await f.clock.advance(30000);await eventually('idle peer destroyed',()=>f.destroyed.includes('a')?true:undefined);assert.deepEqual(f.destroyed,['a']);
 f.processes.length=0;f.runtime.reconcile();
 await f.clock.advance(59999);assert.equal(f.store.hosts.provisions.get('z')!.state,'ready');
 await f.clock.advance(1);await eventually('restarted idle destruction',()=>f.destroyed.includes('z')?true:undefined);assert.deepEqual(f.destroyed,['a','z']);
});
test('placement promise resets idle wait even if released before the old timer',async t=>{
 const f=await fixture(t,0);
 await f.clock.advance(30000);
 const held=f.runtime.reserve('agents','codex','z');
 await f.clock.advance(10000);held.release();f.runtime.reconcile();
 await f.clock.advance(20000);assert.equal(f.store.hosts.provisions.get('z')!.state,'ready');
 await f.clock.advance(40000);await eventually('released promise destruction',()=>f.destroyed.includes('z')?true:undefined);assert.deepEqual(f.destroyed,['a','z']);
});
test('simultaneous deadlines never stop below a raised minimum',async t=>{
 const f=await fixture(t,0);
 await f.clock.advance(30000);f.settings.pools.agents!.minHosts=1;f.runtime.configure();
 await f.clock.advance(30000);await eventually('excess destruction',()=>f.destroyed.includes('z')?true:undefined);assert.deepEqual(f.destroyed,['z']);
});

import { projectHub } from './harness.ts';
import { testHost } from '../src/host/test-host.ts';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { sessionUi } from './session-credential-fixture.ts';
for (const minimum of [false,true]) test(`hub config ${minimum?'min_hosts':'idle_stop'} hot apply reaches confirmed destruction through the lifecycle owner`,async t=>{
 const root=await tempProject(t),clock=new FakeClock();
 const env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root});
 await mkdir(join(root,'.cland'),{recursive:true});
 await writeFile(join(root,'.cland/config.toml'),'[hosts.agents]\nprovider="fake"\nslots=1\nmin_hosts=0\nidle_stop="20m"\n');
 const host={...testHost('idle-fixture',()=>{}),layout:()=>({discoveryFile:join(root,'.cland/hub.json'),node:'',cli:'',spoke:'',runDirectory:join(root,'.cland/run'),logDirectory:join(root,'.cland/log')}),listFolder:async()=>[]};
 const hub=await projectHub(t,root,env,{clock,hosts:[host]});
 const store=new Store(join(root,'.cland/hub.db'));
 onCleanup(t,async()=>{await hub.stop();store.close();});
 const provider=new FakeHostProvider({env,now:()=>clock.now().getTime()});
 const acquired=await provider.acquire({project:root,pool:'agents',architecture:'arm64'});
 assert.equal(acquired.state,'created');if(acquired.state!=='created')throw Error('fixture acquire failed');
 const machine=acquired.machine,id='idle-fixture';
 new HostSecretStore(root,store.hosts,()=>{}).register({id,address:machine.address,user:'fixture',clientKeyPath:'',knownHosts:''});
 store.hosts.provisions.ready({id,pool:'agents',provider:'fake',size:'fake',region:'fake',created:clock.now().toISOString(),state:'ready',machine});
 await writeFile(join(root,'.cland/config.toml'),'# managed by cland\n'+await readFile(join(root,'.cland/config.toml'),'utf8'));
 const ui=await sessionUi(t,hub.discovery,'cli');
 const changed=await ui.request({type:'config.set',key:'hosts.agents.idle_stop',value:'1m'});assert.equal(changed.ok,true,changed.error);assert.equal((changed.value as {applies:string}).applies,'now');
 if(minimum) {
  const kept=await ui.request({type:'config.set',key:'hosts.agents.min_hosts',value:1});assert.equal((kept.value as {applies:string}).applies,'now');
  await clock.advance(60000);assert.equal(store.hosts.provisions.get(id)!.state,'ready');
  const lowered=await ui.request({type:'config.set',key:'hosts.agents.min_hosts',value:0});assert.equal((lowered.value as {applies:string}).applies,'now');
 }
 await clock.advance(59999);assert.equal(store.hosts.provisions.get(id)!.state,'ready');
 await clock.advance(1);
 await eventually('hub confirmed destroyed provision',()=>store.hosts.provisions.get(id)?.state==='destroyed'?true:undefined).catch(error=>{throw new Error(JSON.stringify(store.hosts.provisions.get(id)),{cause:error});});
 assert.equal(store.hosts.provisions.get(id)!.release,'released');
});

test('asynchronous provider declarations are shared and precede idle destruction',async t=>{
 const f=await fixture(t,0,60000,'async');
 await f.clock.advance(59999);assert.deepEqual(f.destroyed,[]);
 await f.clock.advance(1);await eventually('both confirmed destructions',()=>f.destroyed.length===2?true:undefined);
 assert.deepEqual(f.destroyed.sort(),['a','z']);assert.equal(f.reads(),1);
});

test('synchronous declaration failure retries after 60 seconds without external reconciliation',async t=>{
 const f=await fixture(t,0,60000,'throw-once',['z']);
 await f.clock.advance(59999);assert.deepEqual(f.destroyed,[]);
 await f.clock.advance(1);
 await eventually('throw-once provider recovered and confirmed destruction',()=>f.destroyed.length===1?true:undefined);
 assert.equal(f.reads(),2);assert.deepEqual(f.destroyed,['z']);
});
