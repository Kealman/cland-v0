// T2: lease database, machine-local ledger and watchdog file; no native provider or transport.
import test from 'node:test';
import { beforeDirectories, onCleanup } from './process-cleanup.ts';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { scratchMachine } from './init-machine.ts';
import { FakeClock } from './fake-clock.ts';
import { HostLeases, hostLeasePath, readHostLeaseFile } from '../src/host/host-leases.ts';
import { spendPath } from '../src/executor/droplet/spend.ts';

test('lease and pinned pool reservation precede acquire; cap refusal leaves no lease', async t => {
 const f=await scratchMachine(t,{identity:false}),clock=new FakeClock(),db=new DatabaseSync(':memory:');
 const leases=new HostLeases(db);
 beforeDirectories(t,async()=>{await leases.close();db.close();});
 const options={root:f.root,env:f.env,clock,leaseMs:3600000,caps:{shared:10,hosts:3},priceHourly:2,billingMinimumMs:60000,pool:'agents',size:'fake'};
 await leases.create('host-1',options);
 assert.equal(leases.get('host-1')?.deadline,'2026-10-16T13:00:00.000Z');
 assert.equal(readHostLeaseFile(f.root,'host-1')!.deadline,leases.get('host-1')!.deadline);
 const ledger=JSON.parse(await readFile(spendPath(f.env),'utf8'));
 assert.equal(ledger.entries[0].pool,'agents');assert.equal(ledger.entries[0].reservation,2);
 await assert.rejects(leases.create('host-2',options),/hosts daily spend cap/);
 assert.equal(leases.get('host-2'),null);
});

import { until } from './until.ts';
test('renewal cadence raises reservation only while in use; close drains renewal',async t=>{
 const f=await scratchMachine(t,{identity:false}),clock=new FakeClock(),db=new DatabaseSync(':memory:');
 const leases=new HostLeases(db);beforeDirectories(t,async()=>{await leases.close();db.close();});
 const o={root:f.root,env:f.env,clock,leaseMs:3600000,caps:{shared:10,hosts:10},priceHourly:2,billingMinimumMs:60000,pool:'agents',size:'fake'};
 await leases.create('busy',o);let busy=true;
 leases.arm('busy',o,()=>busy);
 await clock.advance(899999);assert.equal(leases.get('busy')!.deadline,'2026-10-16T13:00:00.000Z');
 await clock.advance(1);
 await until(()=>leases.get('busy')!.deadline==='2026-10-16T13:15:00.000Z',{what:'renewed deadline persisted'});
 assert.equal(readHostLeaseFile(f.root,'busy')!.deadline,'2026-10-16T13:15:00.000Z');
 assert.equal(JSON.parse(await readFile(spendPath(f.env),'utf8')).entries[0].reservation,2.5);
 busy=false;await clock.advance(900000);await leases.close();
 assert.equal(leases.get('busy')!.deadline,'2026-10-16T13:15:00.000Z');
 await leases.release('busy',o);
 assert.equal(leases.get('busy'),null);
 assert.equal(JSON.parse(await readFile(spendPath(f.env),'utf8')).entries[0].cost,1);
});

import { mkdir, writeFile } from 'node:fs/promises';
import { HostRecords, HostSecretStore } from '../src/host/records.ts';
import { createHost, destroyHost } from '../src/host/provision-host.ts';
import { FakeHostProvider } from '../src/host/provider/fake.ts';
import { poolImageKey } from '../src/host/provider/pool-image.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
test('create cap refusal never calls acquire and destroy holds lease until both deletion reads',async t=>{
 const f=await scratchMachine(t,{identity:false}),clock=new FakeClock(),db=new DatabaseSync(':memory:'),records=new HostRecords(db);
 beforeDirectories(t,async()=>{await records.leases.close();db.close();});
 const env=fixtureEnvironment(f.root,f.env,{CLAND_FAKE_HOST_ROOT:f.root});
 await mkdir(join(f.root,'.cland/run/hosts'),{recursive:true});
 await writeFile(join(f.root,'.cland/config.toml'),'[hosts]\ndaily_spend_usd=0\nlease="1h"\n[hosts.agents]\nprovider="fake"\nsize="fake"\nslots=8\n');
 await writeFile(join(f.root,'.cland/run/hosts/agents-image.json'),JSON.stringify({key:await poolImageKey(f.root,env,'fake')}));
 const provider=new FakeHostProvider({env,now:()=>clock.now().getTime()});
 const charged={...provider,declarations:{...provider.declarations,prices:{fake:{livePerHour:2,idleComputePerHour:0,idlePerHour:0}}},createAdmission:()=>({state:'allowed' as const}),acquire:async()=>{assert.fail('cap refusal must precede provider acquire');}} as unknown as NonNullable<Parameters<typeof createHost>[0]['provider']>;
 await assert.rejects(createHost({root:f.root,env,clock,records,provider:charged,owner:{} as Parameters<typeof createHost>[0]['owner']}),/hosts daily spend cap/);
 assert.equal(db.prepare('select count(*) as n from host_leases').get()!.n,0);
 const o={root:f.root,env,clock,leaseMs:3600000,caps:{shared:10,hosts:10},priceHourly:2,billingMinimumMs:60000,pool:'agents',size:'fake'};
 await records.leases.create('held',o);
 const acquired=await provider.acquire({project:f.root,pool:'agents',architecture:'arm64'});assert.equal(acquired.state,'created');if(acquired.state!=='created')return;
 records.provisions.save({id:'held',pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:clock.now().toISOString(),state:'failed',machine:acquired.machine});
 const realRelease=provider.release.bind(provider);
 t.mock.method(provider,'release',async()=>({state:'incomplete' as const,reason:'no confirming read'}));
 const input={root:f.root,id:'held',env,clock,records,provider,owner:{} as Parameters<typeof destroyHost>[0]['owner'],log:()=>{}};
 assert.equal((await destroyHost(input)).release,'incomplete');assert.ok(records.leases.get('held'));
 assert.equal(JSON.parse(await readFile(spendPath(env),'utf8')).entries[0].cost,null);
 t.mock.method(provider,'release',realRelease);
 await clock.advance(1800000);
 assert.equal((await destroyHost(input)).state,'destroyed');assert.equal(records.leases.get('held'),null);
 assert.equal(JSON.parse(await readFile(spendPath(env),'utf8')).entries[0].cost,1);
});

import { acquireLockAsync } from '../src/hub/lock.ts';
import { projectSshHosts } from '../src/host/registry.ts';
test('registry shutdown joins a ledger-blocked renewal before database close',async t=>{
 const f=await scratchMachine(t,{identity:false}),clock=new FakeClock(),db=new DatabaseSync(':memory:'),records=new HostRecords(db);
 const owner=await projectSshHosts({root:f.root,clock,records,env:f.env,hubSocket:join(f.root,'h.sock'),spokeSocket:join(f.root,'s.sock'),log:()=>{}});
 const o={root:f.root,env:f.env,clock,leaseMs:3600000,caps:{shared:10,hosts:10},priceHourly:2,billingMinimumMs:60000,pool:'agents',size:'fake'};
 await records.leases.create('busy',o);
 const lock=await acquireLockAsync(spendPath(f.env)+'.lock');
 let closing:Promise<void>|undefined,closed=false;
 beforeDirectories(t,async()=>{await lock.release();await clock.advance(60000);await closing;await owner.close();if(db.isOpen)db.close();});
 records.leases.arm('busy',o,()=>true);
 await clock.advance(900000);
 closing=owner.close().then(()=>{closed=true;db.close();});
 assert.equal(closed,false);
 await lock.release();
 // Drive only contention backoff; completion is the owner's joined close promise.
 for(let n=0;n<60&&!closed;n++)await clock.advance(1000);
 await until(()=>closed,{what:'registry close and database close complete'});
 const after=await readFile(spendPath(f.env),'utf8');
 assert.equal(JSON.parse(after).entries[0].reservation,2.5);
 await clock.advance(3600000);
 assert.equal(await readFile(spendPath(f.env),'utf8'),after);
});

test('long leases renew hourly and a refused extension retains the old database and file deadline',async t=>{
 const f=await scratchMachine(t,{identity:false}),clock=new FakeClock(),db=new DatabaseSync(':memory:'),leases=new HostLeases(db);
 beforeDirectories(t,async()=>{await leases.close();db.close();});
 const o={root:f.root,env:f.env,clock,leaseMs:43200000,caps:{shared:24,hosts:24},priceHourly:2,billingMinimumMs:60000,pool:'agents',size:'fake'};
 await leases.create('long',o);let failed=false;
 leases.arm('long',o,()=>true,()=>{failed=true;});
 await clock.advance(3599999);assert.equal(leases.get('long')!.deadline,'2026-10-17T00:00:00.000Z');
 await clock.advance(1);await until(()=>failed,{what:'hourly renewal cap refusal observed'});
 assert.equal(leases.get('long')!.deadline,'2026-10-17T00:00:00.000Z');
 assert.equal(readHostLeaseFile(f.root,'long')!.deadline,'2026-10-17T00:00:00.000Z');
 assert.equal(JSON.parse(await readFile(spendPath(f.env),'utf8')).entries[0].reservation,24);
});

test('failed mirror publication retains the earlier deadline after database renewal',async t=>{
 const f=await scratchMachine(t,{identity:false}),clock=new FakeClock(),db=new DatabaseSync(':memory:'),leases=new HostLeases(db);
 beforeDirectories(t,async()=>{await leases.close();db.close();});
 const o={root:f.root,env:f.env,clock,leaseMs:3600000,caps:{shared:10,hosts:10},priceHourly:2,billingMinimumMs:60000,pool:'agents',size:'fake'};
 await leases.create('mirror',o);
 await mkdir(hostLeasePath(f.root,'mirror')+'.next');
 await clock.advance(900000);
 await assert.rejects(leases.renew('mirror',o));
 assert.equal(leases.get('mirror')!.deadline,'2026-10-16T13:15:00.000Z');
 assert.equal(readHostLeaseFile(f.root,'mirror')!.deadline,'2026-10-16T13:00:00.000Z');
});

test('publication retry uses effective deadline and expiry calls confirmed destruction once',async t=>{
 const f=await scratchMachine(t,{identity:false}),clock=new FakeClock(),db=new DatabaseSync(':memory:'),records=new HostRecords(db),env=fixtureEnvironment(f.root,f.env,{CLAND_FAKE_HOST_ROOT:f.root});
 let unblock=()=>{};const leases=records.leases;beforeDirectories(t,async()=>{unblock();await leases.close();db.close();});
 const o={root:f.root,env,clock,leaseMs:30000,caps:{shared:10,hosts:10},priceHourly:2,billingMinimumMs:60000,pool:'agents',size:'fake'};
 await leases.create('expiry',o);
 const provider=new FakeHostProvider({env,now:()=>clock.now().getTime()});
 const acquired=await provider.acquire({project:f.root,pool:'agents',architecture:'arm64'});if(acquired.state!=='created')throw Error('fixture acquire');
 records.insert({id:'expiry',address:acquired.machine.address,user:'agent',clientKeyPath:'unused',knownHosts:'unused'},'synthetic');
 records.provisions.ready({id:'expiry',pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:clock.now().toISOString(),state:'ready',machine:acquired.machine});
 await mkdir(hostLeasePath(f.root,'expiry')+'.next');
 const failures:unknown[]=[];let destroys=0;
 const deletion=Promise.withResolvers<void>(),nativeRelease=provider.release.bind(provider);
 unblock=()=>deletion.resolve();
 t.mock.method(provider,'release',async(machine:Parameters<typeof provider.release>[0],confirm?:Parameters<typeof provider.release>[1])=>{await deletion.promise;return nativeRelease(machine,confirm);});
 leases.arm('expiry',o,()=>true,e=>failures.push(e),async()=>{destroys++;await destroyHost({root:f.root,id:'expiry',clock,env,records,provider,owner:{remove:async()=>({state:'complete'})} as unknown as Parameters<typeof destroyHost>[0]['owner'],log:()=>{}});});
 await clock.advance(7500);await until(()=>failures.length===1,{what:'typed publication failure'});
 assert.equal((failures[0] as {code:string}).code,'host-lease-publication');
 assert.equal(leases.effective('expiry',f.root,clock)?.deadline,'2026-10-16T12:00:30.000Z');
 await clock.advance(1000);await until(()=>failures.length===2,{what:'next tick retries publication'});
 for(let n=0;n<22;n++){await clock.advance(1000);await new Promise<void>(resolve=>setImmediate(resolve));}
 await clock.advance(500);
 await until(()=>records.provisions.get('expiry')?.state==='destroying',{what:'expiry fences placement before deletion'});
 assert.equal(JSON.parse(await readFile(spendPath(env),'utf8')).entries[0].cost,null);assert.ok(leases.get('expiry'));
 deletion.resolve();
 await until(()=>records.provisions.get('expiry')?.state==='destroyed',{what:'expiry confirmed destruction persisted'});
 assert.equal(destroys,1);assert.equal(leases.get('expiry'),null);
 assert.notEqual(JSON.parse(await readFile(spendPath(env),'utf8')).entries[0].cost,null);
});

import { rmdir } from 'node:fs/promises';
test('successful next-tick publication retry moves effective expiry beyond the old deadline',async t=>{
 const f=await scratchMachine(t,{identity:false}),clock=new FakeClock(),db=new DatabaseSync(':memory:'),leases=new HostLeases(db);
 beforeDirectories(t,async()=>{await leases.close();db.close();});
 const o={root:f.root,env:f.env,clock,leaseMs:30000,caps:{shared:10,hosts:10},priceHourly:2,billingMinimumMs:60000,pool:'agents',size:'fake'};
 await leases.create('retry',o);await mkdir(hostLeasePath(f.root,'retry')+'.next');
 let failures=0,expired=0;
 leases.arm('retry',o,()=>true,()=>{failures++;},async()=>{expired++;});
 await clock.advance(7500);await until(()=>failures===1,{what:'first failed publication'});
 await rmdir(hostLeasePath(f.root,'retry')+'.next');
 await clock.advance(1000);await until(()=>readHostLeaseFile(f.root,'retry')!.deadline==='2026-10-16T12:00:37.500Z',{what:'successful retry published'});
 assert.deepEqual(leases.effective('retry',f.root,clock),{deadline:'2026-10-16T12:00:37.500Z',expired:false});
 await clock.advance(21500);
 assert.equal(expired,0);assert.equal(failures,1);
});

async function admissionFixture(t:test.TestContext){
 const f=await scratchMachine(t,{identity:false}),clock=new FakeClock(),db=new DatabaseSync(':memory:'),records=new HostRecords(db);
 beforeDirectories(t,async()=>{await records.leases.close();db.close();});
 const env=fixtureEnvironment(f.root,f.env,{CLAND_FAKE_HOST_ROOT:f.root});
 await mkdir(join(f.root,'.cland/run/hosts'),{recursive:true});
 await writeFile(join(f.root,'.cland/config.toml'),'[hosts]\nlease="30s"\n[hosts.agents]\nprovider="fake"\nsize="fake"\nslots=8\n');
 await writeFile(join(f.root,'.cland/run/hosts/agents-image.json'),JSON.stringify({key:await poolImageKey(f.root,env,'fake')}));
 const fake=new FakeHostProvider({env,now:()=>clock.now().getTime()});let calls=0;
 const provider={...fake,declarations:{...fake.declarations,prices:{fake:{livePerHour:2,idleComputePerHour:0,idlePerHour:0}}},createAdmission:()=>({state:'allowed' as const}),acquire:async()=>{calls++;throw Error('unexpected acquire');}} as unknown as NonNullable<Parameters<typeof createHost>[0]['provider']>;
 return {...f,clock,db,records,env,provider,get calls(){return calls;},input:{root:f.root,env,clock,records,provider,owner:{} as Parameters<typeof createHost>[0]['owner']}};
}
for(const failure of ['lease-db','mirror','provision-db'] as const)test(`initial ${failure} failure preserves admission ownership and never leaks a reservation`,async t=>{
 const f=await admissionFixture(t);
 if(failure==='lease-db')f.db.exec("create trigger fail_lease before insert on host_leases begin select raise(abort,'injected lease write');end");
 if(failure==='provision-db')f.db.exec("create trigger fail_provision before insert on provisioned_hosts begin select raise(abort,'injected provision write');end");
 if(failure==='mirror')await writeFile(join(f.root,'.cland/run/host-leases'),'blocked');
 await assert.rejects(createHost(f.input));assert.equal(f.calls,0);
 const ledger=await readFile(spendPath(f.env),'utf8').then(JSON.parse).catch((e:NodeJS.ErrnoException)=>{if(e.code==='ENOENT')return {entries:[]};throw e;});
 assert.equal(ledger.entries.filter((e:{cost:number|null})=>e.cost===null).length,0);
 for(const entry of ledger.entries)assert.equal(entry.cost,0);
 assert.equal(f.db.prepare('select count(*) as n from host_leases').get()!.n,0);
 if(failure!=='provision-db')assert.equal(f.records.provisions.list()[0]?.release,'released');
});
test('pre-acquire callback failure cancels the pinned reservation at zero',async t=>{
 const f=await admissionFixture(t);
 const result=await createHost({...f.input,onCreating:()=>{throw Error('injected pre-acquire failure');}});
 assert.equal(f.calls,0);assert.equal(result.release,'released');
 assert.equal(JSON.parse(await readFile(spendPath(f.env),'utf8')).entries[0].cost,0);
});

test('ledger-held admission past its deadline never acquires or publishes ready',async t=>{
 const f=await admissionFixture(t);
 await mkdir(join(f.env.XDG_STATE_HOME!,'cland'),{recursive:true});
 // Seed the ledger directory through a separate positively cancelled admission.
 const {reserveHostSpend,cancelHostSpend}=await import('../src/executor/droplet/spend.ts');
 const created=f.clock.now().toISOString();
 await reserveHostSpend({project:f.root,lease:'seed',pool:'agents',size:'fake',priceHourly:0,billingMinimumMs:60000,created,deadline:new Date(f.clock.now().getTime()+30000).toISOString()},{shared:5,hosts:3},f.env,{clock:f.clock});
 await cancelHostSpend({project:f.root,lease:'seed'},{kind:'not-called',at:created},f.env,{clock:f.clock});
 const lock=await acquireLockAsync(spendPath(f.env)+'.lock');let creating:ReturnType<typeof createHost>|undefined,done=false;
 onCleanup(t,async()=>{await lock.release();await f.clock.advance(30000);await until(async()=>{if(!done)await f.clock.advance(1);return done;},{what:"held creation cleanup completed"});await creating;});
 const owned=until(()=>f.records.provisions.list().length===1,{what:'creation identity persisted before admission'});
 creating=createHost(f.input).finally(()=>{done=true;});await owned;
 await f.clock.advance(30000);await lock.release();
 for(let n=0;n<60&&!done;n++)await f.clock.advance(1000);
 await until(()=>done,{what:'expired admission completed'});
 const record=await creating;assert.equal(record.state,'failed');assert.match(record.reason!,/expired/);assert.equal(record.release,'released');assert.equal(f.calls,0);
 assert.equal(f.records.leases.get(record.id),null);
 assert.equal(JSON.parse(await readFile(spendPath(f.env),'utf8')).entries.find((e:{lease:string})=>e.lease===record.id).cost,0);
});
for(const failure of ['malformed','unreadable'] as const)test(`published mirror ${failure} is an owned typed expiry and shutdown drains`,async t=>{
 const f=await admissionFixture(t),leases=f.records.leases;
 const o={root:f.root,env:f.env,clock:f.clock,leaseMs:30000,caps:{shared:5,hosts:3},priceHourly:2,billingMinimumMs:60000,pool:'agents',size:'fake'};
 await leases.create('broken',o);const errors:unknown[]=[];let expired=0,stopped=0;
 const owner=await projectSshHosts({root:f.root,clock:f.clock,records:f.records,env:f.env,hubSocket:join(f.root,'h.sock'),spokeSocket:join(f.root,'s.sock'),log:()=>{},createTransport:()=>({start:async()=>{},stop:async()=>{stopped++;},status:()=>({name:'broken',state:'up',since:null,lastProbe:null,reconnects:0}),forward:async()=>({socket:'unused'}),unforward:async()=>{}}),gitDaemon:async()=>({close:async()=>{}})});
 onCleanup(t,()=>owner.close());
 await owner.add(new HostSecretStore(f.root,f.records).register({id:'broken',address:'broken',user:'agent',clientKeyPath:'unused',knownHosts:'unused'}));
 leases.arm('broken',o,()=>true,e=>errors.push(e),async()=>{expired++;});
 const path=hostLeasePath(f.root,'broken');
 if(failure==='malformed')await writeFile(path,'{');
 else {await (await import('node:fs/promises')).unlink(path);await mkdir(path);}
 await f.clock.advance(7500);
 await owner.close();assert.equal(stopped,1);assert.equal(expired,1);assert.equal((errors[0] as {code:string}).code,'host-lease-publication');
 assert.equal(leases.effective('broken',f.root,f.clock)?.expired,true);
 assert.equal(JSON.parse(await readFile(spendPath(f.env),'utf8')).entries[0].cost,null);
});

test('unknown acquisition cannot cancel its durable owned reservation',async t=>{
 const f=await admissionFixture(t),o={root:f.root,env:f.env,clock:f.clock,leaseMs:30000,caps:{shared:5,hosts:3},priceHourly:2,billingMinimumMs:60000,pool:'agents',size:'fake'};
 f.records.provisions.save({id:'unknown',pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:f.clock.now().toISOString(),state:'failed',acquisition:'pending',release:'incomplete'});
 await f.records.leases.create('unknown',o);
 await assert.rejects(f.records.leases.cancel('unknown',o),/durable non-acquisition receipt/);
 assert.ok(f.records.leases.get('unknown'));
 assert.equal(JSON.parse(await readFile(spendPath(f.env),'utf8')).entries[0].cost,null);
});

test('forced early body exit joins held admission before storage closes',async t=>{
 let joined=false,storage:DatabaseSync|undefined;
 await t.test('scope exits with ledger admission still held',async child=>{
  const f=await admissionFixture(child);storage=f.db;
  const {reserveHostSpend,cancelHostSpend}=await import('../src/executor/droplet/spend.ts');
  const at=f.clock.now().toISOString();
  await reserveHostSpend({project:f.root,lease:'seed',pool:'agents',size:'fake',priceHourly:0,billingMinimumMs:60000,created:at,deadline:new Date(f.clock.now().getTime()+30000).toISOString()},{shared:5,hosts:3},f.env,{clock:f.clock});
  await cancelHostSpend({project:f.root,lease:'seed'},{kind:'not-called',at},f.env,{clock:f.clock});
  const lock=await acquireLockAsync(spendPath(f.env)+'.lock');let creating:ReturnType<typeof createHost>|undefined,done=false;
  onCleanup(child,async()=>{
   await lock.release();await f.clock.advance(30000);await until(async()=>{if(!done)await f.clock.advance(1);return done;},{what:"early-exit creation joined"});
   const record=await creating;joined=f.db.isOpen&&record?.release==='released';
  });
  const observed=until(()=>f.records.provisions.list().length===1,{what:'early-exit creation admitted to durable owner'});
  creating=createHost({...f.input,onCreating:()=>{throw Error('pre-acquire failure');}}).finally(()=>{done=true;});void creating.catch(()=>{});
  await observed;
  assert.throws(()=>assert.fail('forced fixture body failure before ledger release'));
 });
 assert.equal(joined,true);assert.equal(storage?.isOpen,false);
});
