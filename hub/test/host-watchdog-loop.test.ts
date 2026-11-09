import { hostLockProcesses } from './host-admission-fixture.ts';
// T2: provider files, lease mirror and machine-local ledger with an injected clock; no native child.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { fixtureEnvironment } from './fixture-environment.ts';
import { scratchMachine } from './init-machine.ts';
import { beforeDirectories } from './process-cleanup.ts';
import { FakeClock } from './fake-clock.ts';
import { HostLeases } from '../src/host/host-leases.ts';
import { FakeHostProvider } from '../src/host/provider/fake.ts';
import { runHostWatchdog as runWorker, hostWatchdogPaths } from '../src/host/host-watchdog.ts';
import { spendPath } from '../src/executor/droplet/spend.ts';

const runHostWatchdog=(...args:Parameters<typeof runWorker>)=>{args[5]={...args[5],processes:hostLockProcesses};return runWorker(...args);};

test('watchdog follows the published renewal and confirms machine/key absence before settling hosts spend',async t=>{
 const f=await scratchMachine(t,{identity:false}),clock=new FakeClock(),db=new DatabaseSync(':memory:');
 const leases=new HostLeases(db);beforeDirectories(t,async()=>{await leases.close();db.close();});
 const env=fixtureEnvironment(f.root,f.env,{CLAND_FAKE_HOST_ROOT:f.root});
 const provider=new FakeHostProvider({env,now:()=>clock.now().getTime()});
 const acquired=await provider.acquire({project:f.root,pool:'agents',architecture:'arm64'});
 assert.equal(acquired.state,'created');if(acquired.state!=='created')return;
 const o={root:f.root,env,clock,processes:hostLockProcesses,leaseMs:30000,caps:{shared:10,hosts:10},priceHourly:2,billingMinimumMs:60000,pool:'agents',size:'fake'};
 await leases.create('host-1',o);
 let sleeps=0;
 await runHostWatchdog({root:f.root,id:'host-1',provider:'fake',machine:acquired.machine},env,clock,async ms=>{sleeps++;await clock.advance(ms);if(clock.now().getTime()===Date.parse('2026-10-16T12:00:15Z'))await leases.renew('host-1',o);if(clock.now().getTime()===Date.parse('2026-10-16T12:00:30Z'))assert.equal((await provider.status(acquired.machine)).state,'ready','old deadline leaves renewed machine live');});
 assert.ok(sleeps>0);assert.equal(clock.now().toISOString(),'2026-10-16T12:00:45.000Z');
 assert.equal((await provider.status(acquired.machine)).state,'gone');
 const receipt=JSON.parse(await readFile(hostWatchdogPaths(f.root,'host-1').receipt,'utf8'));
 assert.deepEqual(receipt.reads.map((r:{resource:string})=>r.resource).sort(),['key','machine']);
 const ledger=JSON.parse(await readFile(spendPath(env),'utf8'));
 assert.equal(ledger.entries[0].category,'hosts');assert.equal(ledger.entries[0].cost,2/60);
});

import { mkdir } from 'node:fs/promises';
import { hostLeasePath, readHostLeaseFile } from '../src/host/host-leases.ts';
test('watchdog uses the earlier file deadline when database renewal publication fails',async t=>{
 const f=await scratchMachine(t,{identity:false}),clock=new FakeClock(),db=new DatabaseSync(':memory:');
 const leases=new HostLeases(db);beforeDirectories(t,async()=>{await leases.close();db.close();});
 const env=fixtureEnvironment(f.root,f.env,{CLAND_FAKE_HOST_ROOT:f.root});
 const provider=new FakeHostProvider({env,now:()=>clock.now().getTime()});
 const acquired=await provider.acquire({project:f.root,pool:'agents',architecture:'arm64'});
 assert.equal(acquired.state,'created');if(acquired.state!=='created')return;
 const o={root:f.root,env,clock,processes:hostLockProcesses,leaseMs:30000,caps:{shared:10,hosts:10},priceHourly:2,billingMinimumMs:60000,pool:'agents',size:'fake'};
 await leases.create('broken',o);await clock.advance(15000);
 await mkdir(hostLeasePath(f.root,'broken')+'.next');
 await assert.rejects(leases.renew('broken',o),/publication failed/);
 assert.equal(leases.get('broken')!.deadline,'2026-10-16T12:00:45.000Z');
 assert.equal(readHostLeaseFile(f.root,'broken')!.deadline,'2026-10-16T12:00:30.000Z');
 await runHostWatchdog({root:f.root,id:'broken',provider:'fake',machine:acquired.machine},env,clock,ms=>clock.advance(ms));
 assert.equal(clock.now().toISOString(),'2026-10-16T12:00:30.000Z');
 assert.equal((await provider.status(acquired.machine)).state,'gone');
});

import { writeFile } from 'node:fs/promises';
test('retained receipt without confirming reads cannot settle a live host',async t=>{
 const f=await scratchMachine(t,{identity:false}),clock=new FakeClock(),db=new DatabaseSync(':memory:');
 const leases=new HostLeases(db);beforeDirectories(t,async()=>{await leases.close();db.close();});
 const env=fixtureEnvironment(f.root,f.env,{CLAND_FAKE_HOST_ROOT:f.root});
 const provider=new FakeHostProvider({env,now:()=>clock.now().getTime()});
 const acquired=await provider.acquire({project:f.root,pool:'agents',architecture:'arm64'});
 assert.equal(acquired.state,'created');if(acquired.state!=='created')return;
 const o={root:f.root,env,clock,processes:hostLockProcesses,leaseMs:30000,caps:{shared:10,hosts:10},priceHourly:2,billingMinimumMs:60000,pool:'agents',size:'fake'};
 await leases.create('invalid',o);
 await writeFile(hostWatchdogPaths(f.root,'invalid').receipt,JSON.stringify({confirmedAt:clock.now().toISOString(),reads:[]}));
 await assert.rejects(runHostWatchdog({root:f.root,id:'invalid',provider:'fake',machine:acquired.machine},env,clock,ms=>clock.advance(ms)),/invalid host absence receipt/);
 assert.equal((await provider.status(acquired.machine)).state,'ready');
 const ledger=JSON.parse(await readFile(spendPath(env),'utf8'));
 assert.equal(ledger.entries[0].cost,null);
});

import { recordHostAbsence, retireHostWatchdog } from '../src/host/host-watchdog.ts';
test('receipt publication conflict preserves the first bound absence and fences a mismatched machine',async t=>{
 const f=await scratchMachine(t,{identity:false}),clock=new FakeClock();
 const input={root:f.root,id:'receipt',provider:'fake',machine:{id:'machine-1',address:'machine-1',architecture:'arm64' as const,created:clock.now().toISOString()}};
 const reads=[{resource:'machine' as const,read:'machine absent'},{resource:'key' as const,read:'key absent'}];
 const first=await recordHostAbsence(input,clock,reads);
 await clock.advance(1000);assert.deepEqual(await recordHostAbsence(input,clock,reads),first);
 await assert.rejects(recordHostAbsence({...input,machine:{...input.machine,id:'other'}},clock,reads),/invalid host absence receipt/);
 assert.deepEqual(JSON.parse(await readFile(hostWatchdogPaths(f.root,input.id).receipt,'utf8')),first);
});
test('unknown recovered watchdog retains its input and lease identity without signals',async t=>{
 const f=await scratchMachine(t,{identity:false}),clock=new FakeClock(),db=new DatabaseSync(':memory:');
 const leases=new HostLeases(db);beforeDirectories(t,async()=>{await leases.close();db.close();});
 const o={root:f.root,env:f.env,clock,processes:hostLockProcesses,leaseMs:30000,caps:{shared:10,hosts:10},priceHourly:2,billingMinimumMs:60000,pool:'agents',size:'fake'};
 await leases.create('held',o);
 const watchdog={pid:123,startedUtc:'fixture',pidIdentity:'original'};
 leases.checkpointWatchdog('held',f.root,watchdog);
 const input=hostWatchdogPaths(f.root,'held').input;await writeFile(input,'retained worker input');
 const signals:NodeJS.Signals[]=[];
 await assert.rejects(retireHostWatchdog(f.root,'held',watchdog,f.env,{clock,processes:{started:async()=>null,identity:async()=>null,alive:()=>true,signal:(_pid,signal)=>{signals.push(signal);}}}),/watchdog stop unconfirmed/);
 assert.equal(await readFile(input,'utf8'),'retained worker input');assert.deepEqual(leases.get('held')!.watchdog,watchdog);assert.deepEqual(signals,[]);
});
