// T3: proves a real detached watchdog survives its database owner and deletes a
// fake provider machine without a hub. Cleanup joins the owned native child
// before removing the fixture; no real provider network or transport is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { scratchMachine } from './init-machine.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { beforeDirectories, guardDirectoryRemoval } from './process-cleanup.ts';
import { eventually, testWaitMs } from './harness.ts';
import { realClock } from '../src/hub/clock.ts';
import { HostLeases } from '../src/host/host-leases.ts';
import { FakeHostProvider } from '../src/host/provider/fake.ts';
import { armHostWatchdog, stopHostWatchdog, hostWatchdogPaths } from '../src/host/host-watchdog.ts';
import { spendPath } from '../src/executor/droplet/spend.ts';

const SETUP_MS=testWaitMs(60000),ARM_MS=10000,RECEIPT_MS=35000,LEDGER_MS=testWaitMs(),STOP_MS=20000,CLEANUP_MS=testWaitMs(60000);
// Outer envelopes sum distinct phase budgets; the lease itself remains 30000ms.
const OWNER_OUTER_MS=SETUP_MS+ARM_MS+RECEIPT_MS+LEDGER_MS+2*STOP_MS+CLEANUP_MS;
const FIXTURE_MS=SETUP_MS,CREATE_MS=30000,HUB_STOP_MS=SETUP_MS;
const HUB_OUTER_MS=FIXTURE_MS+CREATE_MS+HUB_STOP_MS+RECEIPT_MS+2*STOP_MS+CLEANUP_MS;

test('detached watchdog outlives the lease database owner and confirms deletion at a 30 second deadline', {timeout:OWNER_OUTER_MS},async t=>{
 const f=await scratchMachine(t,{identity:false});
 const env=fixtureEnvironment(f.root,f.env,{CLAND_FAKE_HOST_ROOT:f.root});
 const provider=new FakeHostProvider({env});
 const acquired=await provider.acquire({project:f.root,pool:'agents',architecture:'arm64'});
 assert.equal(acquired.state,'created');if(acquired.state!=='created')return;
 const db=new DatabaseSync(':memory:'),leases=new HostLeases(db);
 const o={root:f.root,env,clock:realClock,leaseMs:30000,caps:{shared:10,hosts:10},priceHourly:2,billingMinimumMs:60000,pool:'agents',size:'fake'};
 let watchdog:Awaited<ReturnType<typeof armHostWatchdog>>|undefined,closed=false;
 let retired=false;guardDirectoryRemoval(f.root,()=>{if(!retired)throw Error('watchdog closure unconfirmed; root retained');});
 beforeDirectories(t,async()=>{
  const errors:unknown[]=[];
  try{await stopHostWatchdog(watchdog,env);retired=true;}catch(error){errors.push(error);}
  try{if(!closed){await leases.close();db.close();closed=true;}}catch(error){errors.push(error);retired=false;}
  if(errors.length)throw new AggregateError(errors,'watchdog fixture drain failed');
 });
 await leases.create('host-1',o);
 watchdog=await armHostWatchdog({root:f.root,id:'host-1',provider:'fake',machine:acquired.machine},env);
 leases.checkpointWatchdog('host-1',f.root,watchdog);
 assert.deepEqual(leases.get('host-1')!.watchdog,watchdog);
 assert.ok(watchdog.pidIdentity);
 await leases.close();db.close();closed=true;
 const receiptPath=hostWatchdogPaths(f.root,'host-1').receipt;
 const receipt=await eventually('durable watchdog absence receipt',async()=>{try{return JSON.parse(await readFile(receiptPath,'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return undefined;throw e;}},RECEIPT_MS);
 assert.deepEqual(receipt.reads.map((r:{resource:string})=>r.resource).sort(),['key','machine']);
 assert.equal((await provider.status(acquired.machine)).state,'gone');
 await eventually('host spend settled',async()=>{const ledger=JSON.parse(await readFile(spendPath(env),'utf8'));return ledger.entries[0]?.cost!==null?ledger:undefined;},LEDGER_MS);
 const ledger=JSON.parse(await readFile(spendPath(env),'utf8'));
 assert.equal(ledger.entries[0].category,'hosts');assert.equal(ledger.entries[0].cost,2/60);
 await stopHostWatchdog(watchdog,env);
});

import { fixture } from './host-create-fixture.ts';
import { cland } from './harness.ts';
import { hostLeasePath } from '../src/host/host-leases.ts';
import { watchdogAlive } from '../src/executor/droplet/watchdog.ts';
import type { DropletLease } from '../src/executor/droplet/lease.ts';
test('host create arms a watchdog which deletes its machine after the hub stops', {timeout:HUB_OUTER_MS},async t=>{
 const f=await fixture(t,{lease:'30s'});
 const created=await cland(f.root,'host','create','agents');assert.equal(created.code,0,created.stderr);
 const record=JSON.parse(created.stdout);assert.equal(record.state,'ready',JSON.stringify(record));
 const lease=JSON.parse(await readFile(hostLeasePath(f.root,record.id),'utf8')) as DropletLease;
 assert.ok(lease.watchdog?.pidIdentity);assert.equal(await watchdogAlive(lease,f.env),true);
 await f.hub.stop();
 assert.equal(await watchdogAlive(lease,f.env),true,'hub stop leaves the detached worker running');
 const receipt=await eventually('watchdog receipt after hub shutdown',async()=>{try{return JSON.parse(await readFile(hostWatchdogPaths(f.root,record.id).receipt,'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return undefined;throw error;}},RECEIPT_MS);
 assert.deepEqual(receipt.reads.map((r:{resource:string})=>r.resource).sort(),['key','machine']);
 assert.equal((await new FakeHostProvider({env:f.env}).status(record.machine)).state,'gone');
 await stopHostWatchdog(lease.watchdog,f.env);
 assert.equal(await watchdogAlive(lease,f.env),false);
});
