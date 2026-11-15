import type { LockProcessTable } from '../src/hub/lock.ts';
export const hostLockProcesses:LockProcessTable={alive:pid=>pid===process.pid,started:()=> 'scripted lock identity'};
import { parsePoolName } from '../src/host/pool-name.ts';
import type { TestContext } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { HostLeases } from '../src/host/host-leases.ts';
import { hostCreateAdmission } from '../src/host/create-admission.ts';
import { durableJson } from '../src/executor/droplet/lease.ts';
import { hostWatchdogPaths } from '../src/host/host-watchdog.ts';
import type { Clock } from '../src/hub/clock.ts';
import type { DigitalOceanHostProvider } from '../src/host/provider/digitalocean.ts';
import type { AcquireOptions, HostCreateAdmission } from '../src/host/provider/provider.ts';
import { beforeDirectories } from './process-cleanup.ts';
const admissionOwners=new WeakMap<TestContext,Set<()=>Promise<void>>>();
/** Provider work drains first, all issuance owners next, API/root disposal last. */
export function ownAdmissionApi(t:TestContext,api:{close(options?:{retainRoot?:boolean}):Promise<void>},beforeClose?:()=>Promise<void>):void {
 beforeDirectories(t,async()=>{
  const failures:unknown[]=[];
  try{await beforeClose?.();}catch(error){failures.push(error);}
  // Fence every owner synchronously before joining. This also runs on signals,
  // whose beforeDirectories path bypasses ordinary TestContext after hooks.
  const results=await Promise.allSettled([...admissionOwners.get(t)??[]].map(close=>close()));
  for(const result of results)if(result.status==='rejected')failures.push(result.reason);
  try{await api.close({retainRoot:failures.length>0});}catch(error){failures.push(error);}
  if(failures.length)throw new AggregateError(failures,'admission API cleanup incomplete');
 });
}
/** Script only native birth observation; real lease/mirror/ledger and issuer.
 * Each acquisition has its own lease identity, including concurrent requests. */
export function admissionFixture(t:TestContext,root:string,env:NodeJS.ProcessEnv,clock:Clock) {
 const db=new DatabaseSync(':memory:'),leases=new HostLeases(db);
 let closed=false,closing:Promise<void>|undefined;
 const close=()=>{
  if(closing)return closing;
  closed=true;
  closing=(async()=>{await issuing;await leases.close();db.close();})();
  return closing;
 };
 const owners=admissionOwners.get(t)??new Set();
 admissionOwners.set(t,owners);owners.add(close);
 // Standalone owners still drain; API owners join this same completion earlier.
 beforeDirectories(t,close);
 let birth:string|null='scripted-birth',alive=true;
 const processes={started:async()=> 'scripted',identity:async()=> birth,alive:()=>alive,signal:()=>{alive=false;}};
 // Setup must not contend on a spend-lock backoff in an undriven FakeClock.
 // Only receipt issuance queues here; provider acquires still overlap.
 let issuing:Promise<unknown>=Promise.resolve();
 const issue=(project:string,pool:string,providerName='digitalocean'):Promise<HostCreateAdmission>=>{
 if(closed)return Promise.reject(Error('admission fixture is closed'));
 const pending=issuing.then(async()=>{
  const id='host-'+randomUUID();
  await leases.create(id,{root,env,clock,processes:hostLockProcesses,leaseMs:43200000,caps:{shared:10000,hosts:10000},pool,size:'c-8',priceHourly:0,billingMinimumMs:60000});
  const lease=leases.get(id)!;
  const path=hostWatchdogPaths(root,id).input;await mkdir(dirname(path),{recursive:true});
  await durableJson(path,{root,id,provider:providerName,project,pool,deadline:lease.deadline});
  leases.checkpointWatchdog(id,root,{pid:123,startedUtc:'scripted',pidIdentity:'scripted-birth'});
  return hostCreateAdmission(root,id,providerName,env,{clock,processes,currentLease:()=>leases.currentAdmission(id)},project);
 });
 issuing=pending.catch(()=>{});
 return pending;
 };
 return {issue,close,leases,processes,retire:async(id:string)=>{await (await import('../src/host/host-watchdog.ts')).retireHostWatchdog(root,id,leases.get(id)?.watchdog,env,{clock,processes});},loseWatchdog:()=>{birth=null;},async wrap(provider:DigitalOceanHostProvider){
  const acquire=provider.acquire.bind(provider),createAdmission=provider.createAdmission.bind(provider);
  const base=await issue(root,'agents');
  provider.createAdmission=(admission=base)=>createAdmission(admission);
  provider.acquire=async(options:AcquireOptions)=>{try{parsePoolName(options.pool);}catch{return acquire(options); }return acquire({...options,admission:options.admission??await issue(options.project,options.pool)});};
  return provider;
 }};
}
