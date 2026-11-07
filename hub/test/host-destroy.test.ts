// T2: local CLI unknown-id admission without native hosts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tempProject, projectHub, cland, eventually } from './harness.ts';

test('C4 destroy refuses an unknown id',async t=>{
 const root=await tempProject(t);await projectHub(t,root);
 const result=await cland(root,'host','destroy','unknown');
 assert.equal(result.code,1);assert.match(result.stderr,/unknown host/);
});

import { FakeHostProvider } from '../src/host/provider/fake.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { hostDirectory } from '../../shared/fake-host-directory.ts';
import { access } from 'node:fs/promises';
import { join } from 'node:path';

test('release names confirming machine and key reads, including an already gone machine',async t=>{
 const root=await tempProject(t),env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root});
 const provider=new FakeHostProvider({env});
 const acquired=await provider.acquire({project:root,pool:'agents',architecture:'arm64'});
 assert.equal(acquired.state,'created');if(acquired.state!=='created')throw Error('fixture acquisition failed');
 for(let n=0;n<2;n++) {
  const reads:Array<{resource:string;read:string}>=[];
  assert.equal((await provider.release(acquired.machine,receipt=>reads.push(receipt))).state,'released');
  assert.deepEqual(reads.map(r=>r.resource),['machine','key']);
  assert.ok(reads.every(r=>r.read.length>0));
 }
 await assert.rejects(access(join(hostDirectory(root,acquired.machine.id),'client-key')),{code:'ENOENT'});
});

import { Store } from '../src/hub/store.ts';
import { destroyHost } from '../src/host/provision-host.ts';
import { onCleanup } from './process-cleanup.ts';
for(const outcome of ['missing','throw'] as const)test(`destroy requires confirming reads: ${outcome}`,async t=>{
 const root=await tempProject(t),env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root});
 const store=new Store(join(root,'hub.db'));onCleanup(t,()=>store.close());
 const provider=new FakeHostProvider({env});
 const result=await provider.acquire({project:root,pool:'agents',architecture:'arm64'});
 assert.equal(result.state,'created');if(result.state!=='created')throw Error('fixture acquisition failed');
 store.hosts.provisions.save({id:'held',pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:new Date().toISOString(),state:'failed',machine:result.machine});
 t.mock.method(provider,'release',async()=>{if(outcome==='throw')throw Error('read failed');return {state:'released' as const};});
 let settled=0;
 const record=await destroyHost({root,id:'held',env,records:store.hosts,provider,owner:{} as Parameters<typeof destroyHost>[0]['owner'],settleDeleted:()=>{settled++;},log:()=>{}});
 assert.equal(record.state,'destroying');assert.match(record.reason!,/deletion not confirmed/);assert.equal(settled,0);
});

test('restarted ambiguous acquisition without a machine stays deletion not confirmed',async t=>{
 const root=await tempProject(t),store=new Store(join(root,'hub.db'));onCleanup(t,()=>store.close());
 store.hosts.provisions.save({id:'unknown-effect',pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:new Date().toISOString(),state:'creating'});
 store.hosts.provisions.reconcileInterrupted();
 const record=await destroyHost({root,id:'unknown-effect',env:fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root}),records:store.hosts,owner:{} as Parameters<typeof destroyHost>[0]['owner'],log:()=>{}});
 assert.equal(record.state,'destroying');assert.match(record.reason!,/deletion not confirmed/);
});

import { Sessions } from '../src/adapters/sessions.ts';
import { ProcessTable, hostGenerationKey } from '../src/adapters/processes.ts';
import { HubCore } from '../src/hub/core.ts';
import { fakeHarness } from './fakes/harness.ts';
import { beforeDirectories } from './process-cleanup.ts';
import { testWaitMs } from './until.ts';
async function settlementFixture(t:test.TestContext) {
 const root=await tempProject(t),core=new HubCore(),table=new ProcessTable(':memory:');
 const drains:Array<()=>Promise<void>>=[];
 onCleanup(t,async()=>{for(const drain of drains)await drain();});
 const sessions=new Sessions({root,core,table});
 const adapter=fakeHarness('codex');sessions.register(adapter);
 beforeDirectories(t,async()=>{await sessions.close();table.close();core.close();core.store.close();});
 core.store.hosts.insert({id:'f1',address:'f1',user:'agent',clientKeyPath:'unused',knownHosts:'unused'},'synthetic');core.store.hosts.revoke('f1');
 core.store.hosts.provisions.save({id:'f1',pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:new Date().toISOString(),state:'destroying',machineDeletionRead:'machine gone'});
 const p={...await adapter.spawn({name:'worker',role:null,model:null,cwd:root}),host:'f1',pid:123,pidIdentity:'old-birth'};
 table.put(p);
 return {core,table,sessions,adapter,p,beforeStop:(drain:()=>Promise<void>)=>drains.push(drain)};
}
test('held deleted-generation release preserves an onward replacement row and pending stop',{timeout:3*testWaitMs()},async t=>{
 const f=await settlementFixture(t),gate=Promise.withResolvers<void>(),entered={value:false};
 let deleting:Promise<void>|undefined;f.beforeStop(async()=>{gate.resolve();await deleting;});
 Object.assign(f.adapter,{releaseUnreachableGeneration:async()=>{entered.value=true;await gate.promise;return {generation:hostGenerationKey(f.p),released:true,dropped:[],forwardIds:[]};}});
 deleting=f.sessions.hostDeleted('f1','machine gone');
 await eventually('captured local release entered',()=>entered.value?true:undefined,testWaitMs());
 const replacement={...f.p,host:'f2',pid:456,pidIdentity:'new-birth'};f.table.put(replacement);
 f.table.pendingStop({process:replacement,error:'held new stop',stages:{stopped:false,rowRemoved:false,roleRolledBack:false},preserveRow:true});
 gate.resolve();await deleting;
 assert.equal(f.table.get('worker')?.status,'running');assert.equal(f.table.get('worker')?.host,'f2');assert.equal(f.table.pendingStops()[0]?.process.pidIdentity,'new-birth');
});
test('deleted host drains retained generation after its display row moved',async t=>{
 const f=await settlementFixture(t);f.table.retainHostGeneration(f.p,'unknown');
 f.table.put({...f.p,host:'f2',pid:456,pidIdentity:'new-birth'});
 const released:string[]=[];
 Object.assign(f.adapter,{releaseUnreachableGeneration:async(p:typeof f.p)=>{released.push(hostGenerationKey(p));return {generation:hostGenerationKey(p),released:true,dropped:[],forwardIds:[]};}});
 await f.sessions.hostDeleted('f1','machine gone');
 assert.deepEqual(released,[hostGenerationKey(f.p)]);assert.deepEqual([...f.table.retainedHostGenerations('f1')],[]);assert.equal(f.table.get('worker')?.status,'running');
});
for(const wrong of ['generation','forward-owner'])test(`deleted host refuses incomplete local release receipt: ${wrong}`,async t=>{
 const f=await settlementFixture(t);
 Object.assign(f.adapter,{releaseUnreachableGeneration:async()=>({generation:wrong==='generation'?'wrong':hostGenerationKey(f.p),released:true,dropped:[],forwardIds:wrong==='forward-owner'?['unknown-forward']:[]})});
 await assert.rejects(f.sessions.hostDeleted('f1','machine gone'),/receipt|owner unavailable/);
 assert.equal(f.table.get('worker')?.status,'running');
});


test('forced held-release body failure joins deletion before session and storage cleanup',{timeout:4*testWaitMs()},async t=>{
 let completed=false,closedAfterJoin=false;
 await t.test('return with deletion held after a caught forced assertion',async scope=>{
  const f=await settlementFixture(scope),gate=Promise.withResolvers<void>();let entered=false;
  let deleting:Promise<void>|undefined;
  f.beforeStop(async()=>{gate.resolve();await deleting;});
  const close=f.table.close.bind(f.table);
  f.table.close=()=>{assert.equal(completed,true,'storage closes after deletion producer');closedAfterJoin=true;close();};
  Object.assign(f.adapter,{releaseUnreachableGeneration:async()=>{entered=true;await gate.promise;return {generation:hostGenerationKey(f.p),released:true,dropped:[],forwardIds:[]};}});
  deleting=f.sessions.hostDeleted('f1','machine gone').then(()=>{completed=true;});
  await eventually('forced-failure deletion held',()=>entered?true:undefined,testWaitMs());
  await assert.rejects(async()=>{throw Error('forced fixture assertion');},/forced fixture assertion/);
 });
 assert.equal(completed,true);assert.equal(closedAfterJoin,true);
});
