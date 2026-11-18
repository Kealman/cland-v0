import { hostLeaseRenewable } from './provision-records.ts';
import type { LockProcessTable } from '../hub/lock.ts';
import type { HostRecords } from './records.ts';
import type { Clock } from '../hub/clock.ts';
import type { ProjectConfig } from '../init/config.ts';
import { HostProviderRegistry } from './provider/registry.ts';
import { destroyHost } from './provision-host.ts';
import { armHostWatchdog, stopHostWatchdog } from './host-watchdog.ts';
import type { WatchdogOptions } from '../executor/droplet/watchdog.ts';
import { watchdogStopped } from '../executor/droplet/watchdog.ts';

type Recovery={processes?:LockProcessTable;root:string;env:NodeJS.ProcessEnv;clock:Clock;records:HostRecords;log:(entry:Record<string,unknown>)=>void};
/** Before transports open: only positive provider absence permits the authority
 * cut. The ordinary destroy owner still obtains both confirming release reads. */
export async function reconcileHostLeases(o:Recovery):Promise<void> {
 const providers=new HostProviderRegistry({env:o.env,digitalocean:{root:o.root},now:()=>o.clock.now().getTime()});
 for(const lease of o.records.leases.active()) {
  const record=o.records.provisions.get(lease.id);
  if(!record?.machine)continue;
  try {
   const provider=providers.resolve(record);
   if((await provider.status(record.machine)).state!=='gone')continue;
   await destroyHost({...o,id:record.id,provider,owner:{remove:async(id:string)=>{o.records.revoke(id,o.clock.now().toISOString());}} as Parameters<typeof destroyHost>[0]['owner']});
  }catch(error){o.log({event:'host-restart-pending',host:lease.id,error:String(error)});}
 }
}

/** After sessions exist, before scaling starts. Renewals use the shared in-use
 * predicate, including placement promises and deterministic minimum hosts. */
export async function restoreHostLeaseOwners(o:Recovery & {armWatchdog?:typeof armHostWatchdog;watchdogOptions?:WatchdogOptions;config:ProjectConfig;inUse:(id:string)=>boolean;destroy:(id:string)=>Promise<unknown>}):Promise<void> {
 const providers=new HostProviderRegistry({env:o.env,digitalocean:{root:o.root},now:()=>o.clock.now().getTime()});
 for(const lease of o.records.leases.active()) {
  const record=o.records.provisions.get(lease.id);
  if(!record?.machine)continue;
  try {
   const effective=o.records.leases.effective(record.id,o.root,o.clock);
   if(!effective)continue;
   // Unknown native birth on a live PID stays fenced; never create a duplicate.
   if(!lease.watchdog||await watchdogStopped(lease.watchdog,o.env,{...o.watchdogOptions,clock:o.clock})) {
    const watchdog=await (o.armWatchdog??armHostWatchdog)({root:o.root,id:record.id,provider:record.provider,machine:record.machine},o.env,{clock:o.clock});
    try{o.records.leases.checkpointWatchdog(record.id,o.root,watchdog,effective.deadline);}
    catch(error){await stopHostWatchdog(watchdog,o.env,{clock:o.clock});throw error;}
   }
   const declarations=providers.resolve(record).declarations;
   if('state' in declarations||!declarations.prices[record.size])throw Error('host billing declaration unavailable');
   o.records.leases.arm(record.id,{root:o.root,env:o.env,clock:o.clock,...(o.processes?{processes:o.processes}:{}),leaseMs:o.config.hosts.leaseMs,caps:{shared:o.config.verification.dailySpendUsd,hosts:o.config.hosts.dailySpendUsd},pool:record.pool,size:record.size,priceHourly:declarations.prices[record.size]!.livePerHour+declarations.extraAddressPerHour,billingMinimumMs:declarations.billingMinimumMs},()=>hostLeaseRenewable(o.records.provisions.get(record.id)?.state)&&o.inUse(record.id),error=>o.log({event:'host-renewal-failed',host:record.id,error:String(error)}),async()=>{await o.destroy(record.id);});
  }catch(error){o.log({event:'host-restart-pending',host:lease.id,error:String(error)});}
 }
}
