// T2: host state on the real socket edge with an in-process hub and fake clock.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { projectHub, tempProject, connectSocket } from './harness.ts';
import { FakeClock } from './fake-clock.ts';

test('hosts state connects with empty pools on previous and featured wire shapes', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const legacy = await connectSocket(discovery.socket);
  t.after(() => legacy.close());
  legacy.send({ type: 'hello', protocol: 2, client: 'ui', secret: discovery.secret });
  assert.equal((await legacy.next()).type, 'welcome');
  assert.equal((await legacy.next()).type, 'remote.state');
  assert.deepEqual(await legacy.next(1000), { type: 'hosts.state', pools: [] });
  legacy.send({type:'topic.list',id:'old-request'});
  const reply=await legacy.next(1000);
  assert.equal(reply.type,'result');assert.equal(reply.id,'old-request');assert.equal(reply.ok,true);
  const featured = await connectSocket(discovery.socket);
  t.after(() => featured.close());
  featured.send({ type: 'hello', protocol: 2, client: 'ui', secret: discovery.secret, features: ['snapshot'] });
  let pools: unknown;
  for (;;) {
    const frame = await featured.next(1000);
    if (frame.type === 'snapshot' && frame.domain === 'sessions') pools = (frame.value as { hosts?: unknown }).hosts;
    if (frame.type === 'snapshot.end') break;
  }
  assert.deepEqual(pools, []);
});

import { DatabaseSync } from 'node:sqlite';
import { HostRecords } from '../src/host/records.ts';
import { readHostPools } from '../src/host/pools.ts';
import { HostsState } from '../src/host/hosts-state.ts';

test('host projection allows only public facts and coalesces changes within one second', async t => {
  const db = new DatabaseSync(':memory:');
  const records = new HostRecords(db), clock = new FakeClock();
  records.provisions.save({ id: 'fake-1', pool: 'agents', provider: 'fake', size: 's-2vcpu-4gb', region: 'lon1',
    state: 'booting', created: clock.now().toISOString(), machine: {id:'native-secret', address:'private-address', architecture:'x86_64', created:clock.now().toISOString()} });
  const frames: unknown[] = [];
  const state = new HostsState({clock,records,settings:()=>readHostPools({agents:{provider:'fake',min_hosts:0}}),
    processes:()=>[], usage:()=>({usedMilli:1500,promisedMilli:500}),
    price:()=>0.1, outage:()=>null, failure:()=>null, publish:rows=>frames.push(rows)});
  t.after(async () => {await state.close();db.close();});
  await state.start();
  const pool = state.read()[0]!;
  assert.equal(pool.hostCount,1);
  assert.equal(pool.maxHosts,2);
  assert.equal(pool.slotsUsed,2);
  assert.equal(pool.slotsTotal,8);
  assert.deepEqual(pool.hosts,[{id:'fake-1',size:'s-2vcpu-4gb',region:'lon1',state:'booting',created:clock.now().toISOString(),sessions:[],priceHourly:0.1,spendToday:0}]);
  assert.doesNotMatch(JSON.stringify(pool),/private-address|native-secret|volumeId|clientKeyPath/);
  records.provisions.save({...records.provisions.get('fake-1')!,state:'cloning'});
  await clock.advance(999);
  assert.equal(frames.length,1);
  await clock.advance(1);
  assert.equal(state.read()[0]!.hosts[0]!.state,'cloning');
  assert.equal(frames.length,2);
  assert.equal(state.read()[0]!.hosts[0]!.spendToday,0);
  await clock.advance(59001);
  assert.equal(state.read()[0]!.hosts[0]!.spendToday,0.1/60);
});

import { HostHealth } from '../src/host/host-health.ts';
import { PoolRuntime } from '../src/host/pool-runtime.ts';
import { eventually } from './harness.ts';

test('tunnel loss alerts before unreachable and clears on recovery', async t => {
  const db = new DatabaseSync(':memory:');
  const records = new HostRecords(db), clock = new FakeClock();
  records.insert({id:'up',address:'private',user:'fixture',clientKeyPath:'private-key',knownHosts:'private-known'},'sentinel');
  records.provisions.ready({id:'up',pool:'agents',provider:'fake',size:'fake',region:'lon1',state:'ready',created:clock.now().toISOString(),machine:{id:'native',address:'private',architecture:'arm64',created:clock.now().toISOString()}});
  const lines: string[] = [];
  const health = new HostHealth({records,clock,env:{},changed:()=>state.changed(),notice:s=>lines.push(s),status:async()=>({state:'ready'}),lost:async()=>assert.fail('no expiry'),error:error=>assert.fail(String(error))});
  const state = new HostsState({clock,records,settings:()=>readHostPools({agents:{provider:'fake',min_hosts:0}}),processes:()=>[],usage:()=>({usedMilli:0,promisedMilli:0}),price:()=>null,outage:id=>health.outageSince(id),failure:()=>null,publish:()=>{}});
  t.after(async()=>{await state.close();await health.close();db.close();});
  await state.start();
  const since = clock.now().toISOString();
  health.transition('up',false);
  await clock.advance(1000);
  assert.deepEqual(state.read()[0]!.alert,{kind:'outage',host:'up',since});
  assert.equal(records.provisions.get('up')!.state,'ready');
  assert.deepEqual(lines,[]);
  health.transition('up',true);
  await clock.advance(1000);
  assert.equal(state.read()[0]!.alert,null);
});

for(const rateLimited of [false,true]) test(`pool create stays alerted through backoff and clears after success: rate limit=${rateLimited}`, async t => {
  const db=new DatabaseSync(':memory:'),records=new HostRecords(db),clock=new FakeClock();
  const settings=readHostPools({agents:{provider:'fake',min_hosts:1}});
  let calls=0;
  const runtime=new PoolRuntime(()=>settings,records,()=>true,()=>[],()=>state.changed());
  const state=new HostsState({clock,records,settings:()=>settings,processes:()=>[],usage:()=>({usedMilli:0,promisedMilli:0}),price:()=>null,outage:()=>null,failure:pool=>runtime.failure(pool),publish:()=>{}});
  t.after(async()=>{await runtime.close();await state.close();db.close();});
  await state.start();
  runtime.start(async()=>{
    calls++;
    if(calls===1)return {state:'failed',reason:'fake provider capacity refused',...(rateLimited?{retryAt:new Date(clock.now().getTime()+60000).toISOString()}:{})};
    records.insert({id:'retry',address:'private',user:'fixture',clientKeyPath:'private-key',knownHosts:'private-known'},'sentinel');
    const row={id:'retry',pool:'agents',provider:'fake',size:'fake',region:'lon1',state:'ready' as const,created:clock.now().toISOString(),machine:{id:'native',address:'private',architecture:'arm64' as const,created:clock.now().toISOString()}};
    records.provisions.ready(row);return row;
  },{clock,declarations:()=>{throw Error('unused');},destroy:async()=>{}});
  await eventually('pool failure published',()=>runtime.failure('agents')?true:undefined);
  await clock.advance(1000);
  assert.deepEqual(state.read()[0]!.alert,{kind:'provider',reason:'fake provider capacity refused'});
  await clock.advance(59000);
  await eventually('successful retry persisted',()=>records.provisions.get('retry')?.state==='ready'?true:undefined);
  await clock.advance(1000);
  assert.equal(state.read()[0]!.alert,null);
  assert.equal(state.read()[0]!.hostCount,1);
});

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi } from './harness.ts';
import { testHost } from '../src/host/test-host.ts';
import { localHost } from '../src/host/local.ts';
import { HostSecretStore } from '../src/host/records.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { settledLogin } from './settled-login-fixture.ts';
import { fakeLockProcesses } from './fakes/lock-processes.ts';

test('placement, exit, login state and hot pool settings push socket replacements', async t => {
  const root=await tempProject(t),clock=new FakeClock();
  await mkdir(join(root,'.cland'),{recursive:true});
  await writeFile(join(root,'.cland/config.toml'),'# managed by cland\n[hosts.agents]\nprovider="fake"\nslots=4\nmin_hosts=0\nregion="fake-1"\n');
  const local=localHost(fixtureEnvironment(root,process.env));
  const host={...testHost('fake-host',()=>{}),realpath:local.realpath,statDirectory:async()=>({refusal:null,identity:null})};
  let records!:HostRecords;
  const processes=fakeLockProcesses().processes;
  const hub=await projectHub(t,root,{CLAND_FAKE_HOST_ROOT:root},{clock,hosts:[host],processes,droplet:{processes},createHost:async o=>{
    records=o.records;
    return {id:'seed',pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:clock.now().toISOString(),state:'creating'};
  }});
  await writeFile(join(root,'.cland/config.toml'),'# managed by cland\n'+await readFile(join(root,'.cland/config.toml'),'utf8'));
  const ui=await connectUi(t,hub.discovery,'cli');
  assert.equal((await ui.request({type:'subscribe'})).ok,true);
  assert.equal((await ui.request({type:'host.create'})).ok,true);
  new HostSecretStore(root,records,()=>{}).register({id:host.name,address:host.name,user:'fixture',clientKeyPath:'',knownHosts:''});
  await settledLogin(records.logins,host.name,'codex',{provider:'fake',region:'fake-1',project:root,clock});
  records.provisions.ready({id:host.name,pool:'agents',provider:'fake',size:'s-4vcpu-8gb',region:'fake-1',created:clock.now().toISOString(),state:'ready',machine:{id:host.name,address:host.name,architecture:'arm64',created:clock.now().toISOString()}});
  const observe=async(action:()=>Promise<unknown>,predicate:(pool:import('../src/protocol.ts').HostsStatePool)=>boolean)=>{
    const boundary=ui.frames.length;
    const receipt=ui.waitFor(frame=>ui.frames.indexOf(frame)>=boundary&&frame.type==='hosts.state'&&predicate((frame.pools as import('../src/protocol.ts').HostsStatePool[])[0]!),1000);
    void receipt.catch(()=>{});
    await action();await clock.advance(1000);return receipt;
  };
  const placed=await observe(async()=>{const r=await ui.request({type:'session.launch',name:'worker',harness:'codex',host:host.name,cwd:root});assert.equal(r.ok,true,r.error);},pool=>pool.hosts[0]?.sessions.includes('worker')??false);
  const pool=(placed.pools as import('../src/protocol.ts').HostsStatePool[])[0]!;
  assert.equal(pool.slotsUsed,0.5);
  assert.deepEqual(pool.logins.codex,{inUse:1,usable:1,signedOut:0});
  await observe(async()=>{const r=await ui.request({type:'session.stop',session:'worker'});assert.equal(r.ok,true,r.error);},pool=>pool.hosts[0]?.sessions.length===0&&pool.slotsUsed===0);
  await observe(async()=>{
    records.logins.insert({name:'portable',harness:'opencode',account:'work',kind:'key',lastSignIn:null});
    records.logins.transition('portable','ready');
    records.logins.bind('portable',{host:host.name,role:'writer',volumeId:null});
  },pool=>pool.logins.opencode?.inUse===1&&pool.logins.opencode.usable===1);
  await observe(async()=>{records.logins.markSignedOut('codex-fake-host',{reason:'fixture expired',host:host.name});},pool=>pool.logins.codex?.signedOut===1);
  const configured=await observe(async()=>{const r=await ui.request({type:'config.set',key:'hosts.agents.max_hosts',value:3});assert.equal(r.ok,true,r.error);},pool=>pool.maxHosts===3);
  const featured=await connectSocket(hub.discovery.socket);
  t.after(()=>featured.close());
  featured.send({type:'hello',protocol:2,client:'ui',secret:hub.discovery.secret,features:['snapshot']});
  let snapshot:unknown;
  for(;;){const frame=await featured.next(1000);if(frame.type==='snapshot'&&frame.domain==='sessions')snapshot=(frame.value as {hosts:unknown}).hosts;if(frame.type==='snapshot.end')break;}
  assert.deepEqual(snapshot,configured.pools);
  assert.equal((configured.pools as import('../src/protocol.ts').HostsStatePool[])[0]!.logins.codex!.usable,0);
});

test('pre-acquisition and confirmed machine deletion never accrue live spend', async t => {
  const db=new DatabaseSync(':memory:'),records=new HostRecords(db),clock=new FakeClock();
  const state=new HostsState({clock,records,settings:()=>readHostPools({agents:{provider:'fake',min_hosts:0}}),processes:()=>[],usage:()=>({usedMilli:0,promisedMilli:0}),price:()=>0.1,outage:()=>null,failure:()=>null,publish:()=>{}});
  t.after(async()=>{await state.close();db.close();});
  records.provisions.save({id:'pending',pool:'agents',provider:'fake',size:'fake',region:'lon1',state:'creating',created:new Date(clock.now().getTime()-3600000).toISOString()});
  records.provisions.save({id:'gone',pool:'agents',provider:'fake',size:'fake',region:'lon1',state:'destroying',created:new Date(clock.now().getTime()-3600000).toISOString(),machine:{id:'gone-native',address:'private',architecture:'arm64',created:new Date(clock.now().getTime()-3600000).toISOString()},machineDeletionRead:clock.now().toISOString()});
  await state.start();
  assert.deepEqual(state.read()[0]!.hosts.map(h=>[h.id,h.spendToday]),[['gone',0],['pending',0]]);
});

test('manual create refusal alerts and unrelated outage recovery cannot settle it', async t => {
  const root=await tempProject(t),clock=new FakeClock();
  await mkdir(join(root,'.cland'),{recursive:true});
  await writeFile(join(root,'.cland/config.toml'),'[hosts.agents]\nprovider="fake"\nmin_hosts=0\n');
  let records!:HostRecords,calls=0;
  const hub=await projectHub(t,root,{}, {clock,createHost:async o=>{
    records=o.records;calls++;
    if(calls===1)return {id:'denied',pool:'agents',provider:'fake',size:'fake',region:'lon1',created:clock.now().toISOString(),state:'failed',reason:'manual provider refusal',retryAt:new Date(clock.now().getTime()+60000).toISOString()};
    return {id:'success',pool:'agents',provider:'fake',size:'fake',region:'lon1',created:clock.now().toISOString(),state:'ready'};
  }});
  const ui=await connectUi(t,hub.discovery,'cli');
  await ui.request({type:'subscribe'});
  const observe=(predicate:(pool:import('../src/protocol.ts').HostsStatePool)=>boolean)=>{const boundary=ui.frames.length;const pending=ui.waitFor(f=>ui.frames.indexOf(f)>=boundary&&f.type==='hosts.state'&&predicate((f.pools as import('../src/protocol.ts').HostsStatePool[])[0]!),1000);void pending.catch(()=>{});return pending;};
  const alerted=observe(pool=>pool.alert?.kind==='provider');
  await ui.request({type:'host.create',pool:'agents'});await clock.advance(1000);
  assert.deepEqual(((await alerted).pools as import('../src/protocol.ts').HostsStatePool[])[0]!.alert,{kind:'provider',reason:'manual provider refusal'});
  records.insert({id:'existing',address:'private',user:'fixture',clientKeyPath:'private-key',knownHosts:'private-known'},'sentinel');
  const row={id:'existing',pool:'agents',provider:'fake',size:'fake',region:'lon1',created:clock.now().toISOString(),machine:{id:'native',address:'private',architecture:'arm64' as const,created:clock.now().toISOString()}};
  records.provisions.save({...row,state:'unreachable'});
  records.provisions.ready({...row,state:'ready'});
  const retained=observe(pool=>pool.hostCount===1);
  await clock.advance(1000);
  assert.equal(((await retained).pools as import('../src/protocol.ts').HostsStatePool[])[0]!.alert?.kind,'provider');
  const cleared=observe(pool=>pool.alert===null);
  await ui.request({type:'host.create',pool:'agents'});await clock.advance(1000);
  assert.equal(((await cleared).pools as import('../src/protocol.ts').HostsStatePool[])[0]!.alert,null);
});

import { fakeDigitalOcean } from './fakes/digitalocean/fake-api.ts';
import { DigitalOceanHostProvider } from '../src/host/provider/digitalocean.ts';
import { onCleanup } from './process-cleanup.ts';

test('workbench prices come from the admitted DigitalOcean declaration checkpoint', async t => {
  const root=await tempProject(t),clock=new FakeClock();
  const api=await fakeDigitalOcean('provider-sentinel-secret',{machine:'scripted',clock});
  onCleanup(t,()=>api.close());
  api.account.droplet_limit=10;
  const provider=new DigitalOceanHostProvider({root,env:fixtureEnvironment(root,{}, {CLAND_FAKE_HOST_ROOT:root}),api:api.provider,clock});
  const declarations=await provider.refreshDeclarations();
  assert.ok(!('state' in declarations));
  if('state' in declarations)throw Error('fake declarations unavailable');
  await mkdir(join(root,'.cland'),{recursive:true});
  await writeFile(join(root,'.cland/config.toml'),'[hosts.agents]\nprovider="digitalocean"\nsize="c-8"\nslots=8\nmin_hosts=0\n');
  const processes=fakeLockProcesses().processes;
  const hub=await projectHub(t,root,{}, {clock,processes,droplet:{processes},createHost:async o=>{
    const row={id:'priced',pool:'agents',provider:'digitalocean',size:'c-8',region:'lon1',state:'booting' as const,created:clock.now().toISOString(),machine:{id:'native-private',address:'address-private',architecture:'x86_64' as const,created:clock.now().toISOString()}};
    await o.records.leases.create(row.id,{root,env:o.env,clock,processes,leaseMs:60000,caps:{shared:100,hosts:100},pool:'agents',size:'c-8',priceHourly:declarations.prices['c-8']!.livePerHour+declarations.extraAddressPerHour,billingMinimumMs:60000});
    o.records.provisions.save(row);return row;
  }});
  const ui=await connectUi(t,hub.discovery,'cli');await ui.request({type:'subscribe'});
  const receipt=ui.waitFor(f=>f.type==='hosts.state'&&(f.pools as import('../src/protocol.ts').HostsStatePool[])[0]?.hosts[0]?.priceHourly===0.25,1000);void receipt.catch(()=>{});
  assert.equal((await ui.request({type:'host.create',pool:'agents'})).ok,true);
  await clock.advance(1000);
  const host=((await receipt).pools as import('../src/protocol.ts').HostsStatePool[])[0]!.hosts[0]!;
  assert.equal(host.priceHourly,0.25);assert.equal(host.spendToday,0);
  assert.doesNotMatch(JSON.stringify(host),/native-private|address-private|provider-sentinel-secret/);
});
