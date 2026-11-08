// T2: pool scaling through launch/config frames, injected create and provided Hosts; no children.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectHub, tempProject, eventually } from './harness.ts';
import { sessionUi } from './session-credential-fixture.ts';
import { testHost } from '../src/host/test-host.ts';
import { localHost } from '../src/host/local.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { onCleanup } from './process-cleanup.ts';
import { readHostPools } from '../src/host/pools.ts';
import { HostSecretStore } from '../src/host/records.ts';

async function fixture(t:test.TestContext,min=0,max=1,prepare?:ReturnType<typeof Promise.withResolvers<void>>) {
 const root=await tempProject(t);
 await mkdir(join(root,'.cland'),{recursive:true});
 await writeFile(join(root,'.cland/config.toml'),`# managed by cland
[hosts.agents]\nprovider="fake"\nslots=1\nmin_hosts=${min}\nmax_hosts=${max}\n`);
 await writeFile(join(root,'.cland/roles.toml'),'[implementer.launch]\npool="agents"\n');
 const local=localHost(fixtureEnvironment(root,process.env));
 const hosts=['a','b'].map(name=>({...testHost(name,()=>{}),realpath:local.realpath,statDirectory:async()=>({refusal:null,identity:null})}));
 let records:import('../src/host/records.ts').HostRecords;
 let closing=false,completed=0;
 const creates:string[]=[],gates:Array<()=>void>=[];
 onCleanup(t,()=>{closing=true;prepare?.resolve();for(const release of gates)release();});
 const hub=await projectHub(t,root,{}, {hosts,createHost:options=>(async()=>{
  records=options.records;
  const id=['a','b'][creates.length]!;creates.push(id);
  const row={id,pool:'agents',provider:'fake',size:'fake',region:'fake',created:options.clock!.now().toISOString(),state:'booting' as const,machine:{id,address:id,architecture:'x86_64' as const,created:options.clock!.now().toISOString()}};
  await prepare?.promise;
  options.admit?.('agents',readHostPools({agents:{provider:'fake',slots:1,min_hosts:min,max_hosts:max}}).pools.agents!);
  options.records.provisions.save(row);
  await new Promise<void>(resolve=>{gates.push(resolve);if(closing)resolve();options.signal?.addEventListener('abort',()=>resolve(),{once:true});});
  if(options.signal?.aborted)return {...row,state:'failed' as const};
  new HostSecretStore(root,options.records,()=>{}).register({id,address:id,user:'fixture',clientKeyPath:'',knownHosts:''});
  const ready={...row,state:'ready' as const};options.records.provisions.ready(ready);return ready;
 })().finally(()=>{completed++;})});
 await writeFile(join(root,'.cland/config.toml'),'# managed by cland\n'+await readFile(join(root,'.cland/config.toml'),'utf8'));
 const ui=await sessionUi(t,hub.discovery,'cli');
 const launch=(name:string)=>ui.request({type:'session.launch',name,role:'implementer',harness:'codex'});
 const waiting=async()=>((await ui.request({type:'session.list'})).value as {waiting:Array<{reason:string}>}).waiting;
 return {root,hub,ui,creates,gates,launch,waiting,completed:()=>completed,inventory:()=>records.provisions.list(),destroying:()=>records.provisions.save({...records.provisions.get('a')!,state:'destroying'})};
}
test('C1 startup maintains min_hosts without a launch',async t=>{
 const f=await fixture(t,1);
 await eventually('minimum host create admitted',()=>f.creates.length===1?true:undefined);
 assert.deepEqual(f.creates,['a']);f.gates[0]!();
});
test('C2/C4 booting counts toward max and two launches share one new host',async t=>{
 const f=await fixture(t);
 await Promise.all(['one','two'].map(f.launch));
 await eventually('both waits name durable booting host',async()=>{const rows=await f.waiting();return rows.length===2&&rows.every(row=>row.reason==='waiting for host a to boot')?true:undefined;});
 assert.deepEqual(f.creates,['a']);
 f.gates[0]!();
 await eventually('both launches placed',async()=>f.hub.fakes.codex!.spawns.length===2?true:undefined);
 assert.deepEqual(f.hub.fakes.codex!.spawns.map(row=>row.host),['a','a']);
 assert.deepEqual(await f.waiting(),[]);
});
test('C3 raising max_hosts places a waiting launch without restart',async t=>{
 const f=await fixture(t);
 await f.launch('one');
 await eventually('first host creating',()=>f.gates.length===1?true:undefined);f.gates[0]!();
 await eventually('first launch placed',()=>f.hub.fakes.codex!.spawns.length===1?true:undefined);
 await f.launch('two');await f.launch('three');
 assert.equal((await f.waiting())[0]!.reason,'waiting for a host');
 const changed=await f.ui.request({type:'config.set',key:'hosts.agents.max_hosts',value:2});
 assert.equal(changed.ok,true,changed.error);
 await eventually('second host durable boot wait',async()=>{const rows=await f.waiting();return rows[0]?.reason==='waiting for host b to boot'?true:undefined;});
 assert.deepEqual(f.creates,['a','b']);f.gates[1]!();
 await eventually('third launch placed',()=>f.hub.fakes.codex!.spawns.length===3?true:undefined);
 assert.equal(f.hub.fakes.codex!.spawns.at(-1)!.host,'b');
});
test('C5 overflow never exceeds max_hosts',async t=>{
 const f=await fixture(t);
 await Promise.all(['one','two','three','four','five'].map(f.launch));
 await eventually('booting receipt',async()=>{const rows=await f.waiting();return rows.length===5&&rows.every(row=>row.reason==='waiting for host a to boot')?true:undefined;});
 assert.deepEqual(f.creates,['a']);f.gates[0]!();
 await eventually('capacity used and overflow retained',async()=>f.hub.fakes.codex!.spawns.length===2&&(await f.waiting()).every(row=>row.reason==='waiting for a host')?true:undefined);
 assert.equal((await f.waiting()).length,3);assert.deepEqual(f.creates,['a']);
});

test('destroying host fences max_hosts and takes no placement',async t=>{
 const f=await fixture(t);
 await f.launch('one');
 await eventually('create held',()=>f.gates.length===1?true:undefined);f.gates[0]!();
 await eventually('first placed',()=>f.hub.fakes.codex!.spawns.length===1?true:undefined);
 f.destroying();
 const waiting=await f.launch('two');assert.equal(waiting.ok,true,waiting.error);
 assert.equal((await f.waiting())[0]!.reason,'waiting for a host');
 assert.deepEqual(f.creates,['a']);assert.equal(f.hub.fakes.codex!.spawns.length,1);
});

test('manual and automatic create race admits exactly one durable row at max_hosts',async t=>{
 const prepare=Promise.withResolvers<void>();const f=await fixture(t,0,1,prepare);
 const launch=await f.launch('one');assert.equal(launch.ok,true,launch.error);
 const manual=f.ui.request({type:'host.create',pool:'agents'});
 void manual.catch(()=>{});
 const cleanup=async()=>{prepare.resolve();for(const release of f.gates)release();await manual.catch(()=>{});};
 onCleanup(t,cleanup);
 await eventually('both producers at prepared-image seam',()=>f.creates.length===2?true:undefined);
 prepare.resolve();
 await eventually('one durable booting row',()=>f.inventory().length>=1?true:undefined);
 for(const release of f.gates)release();
 await manual;
 assert.equal(f.inventory().length,1);
 assert.equal(f.gates.length,1,'loser never publishes or acquires');
});
test('invalid item demand cannot start a billable create',async t=>{
 const f=await fixture(t);
 const refused=await f.ui.request({type:'session.launch',name:'invalid-item',item:'T-999999999',role:'implementer',harness:'codex'});
 assert.equal(refused.ok,false);
 assert.deepEqual(f.creates,[]);
 assert.deepEqual(await f.waiting(),[]);
});
for(const pending of [true,false])test(`failed ${pending?'pending acquisition':'incomplete release'} holds max across config and restart`,async t=>{
 const {Store}=await import('../src/hub/store.ts');
 const root=await tempProject(t);await mkdir(join(root,'.cland'),{recursive:true});
 await writeFile(join(root,'.cland/config.toml'),'[hosts.agents]\nprovider="fake"\nslots=1\nmin_hosts=0\nmax_hosts=1\n');
 await writeFile(join(root,'.cland/roles.toml'),'[implementer.launch]\npool="agents"\n');
 const store=new Store(join(root,'.cland/hub.db'));
 store.hosts.provisions.save({id:'unresolved',pool:'agents',provider:'fake',size:'fake',region:'fake',created:new Date().toISOString(),state:'failed',...(pending?{acquisition:'pending' as const}:{machine:{id:'unresolved',address:'unresolved',architecture:'arm64' as const,created:new Date().toISOString()},release:'incomplete' as const})});
 store.close();let creates=0;
 for(let cycle=0;cycle<2;cycle++){
  const hub=await projectHub(t,root,{}, {createHost:async()=>{creates++;throw new Error('unexpected provider acquisition');}});
  await writeFile(join(root,'.cland/config.toml'),'# managed by cland\n'+await readFile(join(root,'.cland/config.toml'),'utf8'));
  const ui=await sessionUi(t,hub.discovery,'cli');
  if(cycle===0)assert.equal((await ui.request({type:'session.launch',name:'retained-wait',role:'implementer',harness:'codex'})).ok,true);
  const changed=await ui.request({type:'config.set',key:'hosts.agents.max_hosts',value:1});assert.equal(changed.ok,true,changed.error);
  const list=(await ui.request({type:'session.list'})).value as {waiting:unknown[]};
  assert.equal(list.waiting.length,1);assert.equal(creates,0);await hub.stop();
 }
});
test('lowered max is rechecked after asynchronous preparation before row admission',async t=>{
 const prepare=Promise.withResolvers<void>();const f=await fixture(t,0,1,prepare);
 const launch=await f.launch('one');assert.equal(launch.ok,true);
 await eventually('creator entered preparation',()=>f.creates.length===1?true:undefined);
 const changed=await f.ui.request({type:'config.set',key:'hosts.agents.max_hosts',value:0});assert.equal(changed.ok,true,changed.error);
 prepare.resolve();
 await eventually('pre-row refusal completed',()=>f.completed()===1?true:undefined);
 assert.deepEqual(f.inventory(),[]);assert.equal(f.gates.length,0);
});

test('cancelled durable demand cannot publish a host after preparation',async t=>{
 const prepare=Promise.withResolvers<void>();const f=await fixture(t,0,1,prepare);
 assert.equal((await f.launch('cancelled')).ok,true);
 await eventually('creation preparation entered',()=>f.creates.length===1?true:undefined);
 assert.equal((await f.ui.request({type:'session.stop',session:'cancelled'})).ok,true);
 prepare.resolve();
 await eventually('cancelled create settled before publication',()=>f.completed()===1?true:undefined);
 assert.deepEqual(f.inventory(),[]);assert.equal(f.gates.length,0);
});

test('removed pool is rechecked before a prepared creator publishes its row',async t=>{
 const prepare=Promise.withResolvers<void>();const f=await fixture(t,0,1,prepare);
 assert.equal((await f.launch('removed-pool')).ok,true);
 await eventually('creator holds image checks',()=>f.creates.length===1?true:undefined);
 const {parse,stringify}=await import('smol-toml');
 const document=parse(await readFile(join(f.root,'.cland/config.toml'),'utf8'));delete document.hosts;
 await writeFile(join(f.root,'.cland/config.toml'),'# managed by cland\n'+stringify(document));
 const reload=await f.ui.request({type:'hub.reload'});assert.equal(reload.ok,true,reload.error);
 prepare.resolve();
 await eventually('removed-pool producer settled',()=>f.completed()===1?true:undefined);
 assert.deepEqual(f.inventory(),[]);assert.equal(f.gates.length,0);
});
test('Lead without item cannot persist demand or create a host',async t=>{
 const f=await fixture(t);
 await writeFile(join(f.root,'.cland/roles.toml'),'[lead.launch]\npool="agents"\n');
 const result=await f.ui.request({type:'session.launch',name:'invalid-lead',role:'lead',harness:'codex'});
 assert.equal(result.ok,false);assert.deepEqual(f.creates,[]);assert.deepEqual(await f.waiting(),[]);
});
test('invalid item-worker name cannot persist demand or create a host',async t=>{
 const f=await fixture(t);const made=await f.ui.request({type:'task.create',title:'Valid waiting item',size:'S'});
 assert.equal(made.ok,true,made.error);const item=(made.value as {item:{id:string}}).item.id;
 const result=await f.ui.request({type:'session.launch',name:'human',role:'implementer',harness:'codex',item});
 assert.equal(result.ok,false);assert.deepEqual(f.creates,[]);assert.deepEqual(await f.waiting(),[]);
});
test('removed custom role cannot publish a host after held image preparation',async t=>{
 const prepare=Promise.withResolvers<void>();const f=await fixture(t,0,1,prepare);
 await writeFile(join(f.root,'.cland/roles.toml'),'[custom.worker]\nclause="Fixture worker"\n[custom.worker.launch]\nharness="codex"\npool="agents"\n');
 const initialReload=await f.ui.request({type:'hub.reload'});assert.equal(initialReload.ok,true,initialReload.error);
 const result=await f.ui.request({type:'session.launch',name:'custom-wait',role:'worker',harness:'codex'});assert.equal(result.ok,true,result.error);
 await eventually('custom creator at image preparation',()=>f.creates.length===1?true:undefined);
 await writeFile(join(f.root,'.cland/roles.toml'),'[implementer.launch]\npool="agents"\n');
 const reload=await f.ui.request({type:'hub.reload'});assert.equal(reload.ok,true,reload.error);
 prepare.resolve();
 // Release a mistakenly admitted row too, so a red assertion cannot strand the fixture.
 await eventually('custom admission completed or incorrectly published',()=>f.completed()===1||f.gates.length?true:undefined);
 for(const release of f.gates)release();
 assert.deepEqual(f.inventory(),[]);assert.equal(f.gates.length,0);
});
test('memory-refused ready host with spare weight does not create another host',async t=>{
 const {HostMemoryFloorRefusal}=await import('../src/host/ssh-host.ts');
 const f=await fixture(t,0,2);assert.equal((await f.launch('one')).ok,true);
 await eventually('first host booting',()=>f.gates.length===1?true:undefined);f.gates[0]!();
 await eventually('first process durable',()=>f.hub.fakes.codex!.spawns.length===1?true:undefined);
 const adapter=f.hub.fakes.codex!,spawn=adapter.spawn.bind(adapter);
 adapter.spawn=async()=>{throw new HostMemoryFloorRefusal('a',{code:'memory-floor',availableBytes:1,floorBytes:1300000000});};
 onCleanup(t,()=>{adapter.spawn=spawn;});
 const result=await f.launch('memory-wait');assert.equal(result.ok,true,result.error);
 const reload=await f.ui.request({type:'config.set',key:'hosts.agents.max_hosts',value:2});assert.equal(reload.ok,true,reload.error);
 const rows=await f.waiting();assert.equal(rows.length,1);assert.match(rows[0]!.reason,/host a, available memory 1 bytes/);
 assert.deepEqual(f.creates,['a']);
});
