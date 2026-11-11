import {settledLogin} from './settled-login-fixture.ts';
// T2: explicit human stop through a projectHub and directory-only fake provider.
import test from 'node:test';
import { hostGenerationKey } from '../src/adapters/processes.ts';
import type { HarnessProcess } from '../src/adapters/contract.ts';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { projectHub, tempProject, connectUi, cland, eventually } from './harness.ts';
import { testHost } from '../src/host/test-host.ts';
import { localHost } from '../src/host/local.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { HostSecretStore } from '../src/host/records.ts';
import type { HostRecords } from '../src/host/records.ts';
import type { Machine, ReleaseObserver } from '../src/host/provider/provider.ts';
import { FakeClock } from './fake-clock.ts';
import { FakeHostProvider } from '../src/host/provider/fake.ts';

for(const confirmed of [true,false])test(`C3 stop joins lease renewal and requires confirmed destroy: ${confirmed}`,async t=>{
 const root=await tempProject(t),clock=new FakeClock(Date.now());
 await mkdir(join(root,'.cland'),{recursive:true});
 await writeFile(join(root,'.cland/config.toml'),'[hosts.agents]\nprovider="fake"\nslots=4\nmin_hosts=0\n');
 const provider=new FakeHostProvider({env:fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root}),now:()=>clock.now().getTime()});
 const acquired=await provider.acquire({project:root,pool:'agents',architecture:'arm64',region:'fake'});assert.equal(acquired.state,'created');if(acquired.state!=='created')throw Error('fixture machine');
 const machine=acquired.machine,id='z-host',created=machine.created;
 const diskOps:string[]=[];
 let records!:HostRecords;
 const local=localHost(fixtureEnvironment(root,process.env));
 const hosts=['z-host','a-host'].map(id=>({...testHost(id,()=>{}),layout:local.layout,listFolder:async()=>[],realpath:local.realpath,statDirectory:async()=>({refusal:null,identity:null}),loginDisk:async(input:import('../src/host/agent/resource-types.ts').LoginDisk)=>{diskOps.push(input.op);}}));
 const hub=await projectHub(t,root,{CLAND_FAKE_HOST_ROOT:root},{clock,hosts,createHost:async o=>{records=o.records;return {id,pool:'agents',provider:'fake',size:'fake',region:'fake',created,state:'creating'};}});
 // Provided Hosts enter Sessions directly; publish the same recording inventory
 // to the transport owner used by shared destroy/login release.
 hub.hostOwner!.hosts.push(...hosts);
 const ui=await connectUi(t,hub.discovery,'cli');
 assert.equal((await ui.request({type:'host.create',pool:'agents'})).ok,true);
 const env=hub.hostEnvironment;
 Object.assign(hub.fakes.codex!,{releaseUnreachableGeneration:async(p:HarnessProcess)=>({generation:hostGenerationKey(p),released:true,dropped:[],forwardIds:[]})});
 records.provisions.save({id,pool:'agents',provider:'fake',size:'fake',region:'fake',created,state:'booting',machine});
 new HostSecretStore(root,records,()=>{}).register({id,address:machine.address,user:'fixture',clientKeyPath:'',knownHosts:''});
 records.provisions.ready({...records.provisions.get(id)!,state:'ready'});
 const createdVolume=await provider.createVolume({project:root,name:'stop-login',region:'fake',sizeGiB:1});assert.equal(createdVolume.state,'created');if(createdVolume.state!=='created')throw Error('fixture disk');
 assert.equal((await provider.attachVolume(createdVolume.volume,machine)).state,'attached');
 await settledLogin(records.logins,id,'codex',{provider:'fake',region:'fake',volumeId:createdVolume.volume.id});
 const launched=await ui.request({type:'session.launch',name:'stop-worker',harness:'codex',host:id,cwd:root});assert.equal(launched.ok,true,launched.error);
 const lease={root,env,clock,leaseMs:30000,caps:{shared:10,hosts:10},pool:'agents',size:'fake',priceHourly:0,billingMinimumMs:0};
 await records.leases.create(id,lease);
 records.leases.arm(id,lease,()=>true);
 const initialDeadline=records.leases.get(id)!.deadline;
 await clock.advance(7500);
 await eventually('renewed lease durable before explicit stop',()=>records.leases.get(id)!.deadline>initialDeadline?true:undefined);
 const deadline=records.leases.get(id)!.deadline;
 t.mock.method(FakeHostProvider.prototype,'release',async(_machine:Machine,confirm?:ReleaseObserver)=>{
  if(!confirmed)return {state:'incomplete' as const,reason:'held deletion'};
  confirm?.({resource:'machine',read:'machine absent'});confirm?.({resource:'key',read:'key absent'});
  return {state:'released' as const};
 });
 const result=await ui.request({type:'host.stop',host:id});assert.equal(result.ok,true,result.error);
 assert.equal((result.value as {state:string}).state,confirmed?'destroyed':'destroying');
 assert.deepEqual(diskOps,['umount']);
 const volumes=await provider.listVolumes({project:root});assert.ok(volumes.state==='listed');assert.equal(volumes.volumes[0]?.attachedTo,null);
 await clock.advance(10000);
 assert.equal(records.leases.get(id)?.deadline,confirmed?undefined:deadline);
 assert.equal(records.provisions.get(id)?.release,confirmed?'released':'incomplete');
 const rows=(await ui.request({type:'session.list'})).value as {processes:Array<{name:string;status:string}>};
 if(confirmed)assert.equal(rows.processes.find(p=>p.name==='stop-worker')?.status,'exited');
});
test('C5 host help lists status and stop',async t=>{
 const root=await tempProject(t),result=await cland(root,'host','--help');
 assert.equal(result.code,0,result.stderr);assert.match(result.stdout,/host status/);assert.match(result.stdout,/host stop <id>/);
});

test('C4 manual create refuses occupied max_hosts before publishing another row',async t=>{
 const {readHostPools}=await import('../src/host/pools.ts');
 const root=await tempProject(t);await mkdir(join(root,'.cland'),{recursive:true});
 await writeFile(join(root,'.cland/config.toml'),'[hosts.agents]\nprovider="fake"\nslots=4\nmin_hosts=0\nmax_hosts=1\n');
 let calls=0;
 const hub=await projectHub(t,root,{}, {createHost:async o=>{
  calls++;o.admit!('agents',readHostPools({agents:{provider:'fake',slots:4,min_hosts:0,max_hosts:1}}).pools.agents!);
  const row={id:'occupied',pool:'agents',provider:'fake',size:'fake',region:'fake',created:o.clock!.now().toISOString(),state:'creating' as const};o.records.provisions.save(row);return row;
 }});
 const ui=await connectUi(t,hub.discovery,'cli');
 assert.equal((await ui.request({type:'host.create'})).ok,true);
 const refused=await ui.request({type:'host.create'});assert.equal(refused.ok,false);assert.match(refused.error!,/max_hosts/);assert.equal(calls,2);
});
