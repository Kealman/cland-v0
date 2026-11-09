import { readFile } from 'node:fs/promises';
import { statSync, readFileSync } from 'node:fs';
import { readHostLeaseFile, hostLeasePath, type HostLease } from './host-leases.ts';
import { hostWatchdogPaths } from './host-watchdog.ts';
import { watchdogAlive, type WatchdogOptions } from '../executor/droplet/watchdog.ts';
import { hostSpendReservation, spendPath } from '../executor/droplet/spend.ts';
import { admissionFence } from './admission-fence.ts';
import type { HostCreateAdmission } from './provider/provider.ts';
import type { DropletLease } from '../executor/droplet/lease.ts';
type Effect=<T>(work:()=>Promise<T>)=>Promise<T>;
const issued=new WeakMap<object,Effect>();
export const issuedHostAdmission=(value:HostCreateAdmission)=>issued.has(value);
export const hostAdmissionTag=(id:string)=>'cland-lease-'+id;
export class HostAdmissionUnavailable extends Error {}
export function hostAdmissionEffect<T>(admission:HostCreateAdmission,work:()=>Promise<T>):Promise<T> {
 const owner=issued.get(admission);if(!owner)throw new HostAdmissionUnavailable('host admission not issued');return owner(work);
}
type AdmissionOwner=WatchdogOptions & {currentLease:()=>HostLease|null};
const stamp=(path:string)=>{const s=statSync(path,{bigint:true});return `${s.dev}:${s.ino}:${s.size}:${s.mtimeNs}:${s.ctimeNs}`;};
/** A capability identifies its owner; it never substitutes for current backing.
 * Every API effect re-reads authoritative lease, mirror, native birth and spend.
 * Final synchronous checks and invocation have no intervening await. */
export async function hostCreateAdmission(root:string,id:string,provider:string,env:NodeJS.ProcessEnv,options:AdmissionOwner,project=root):Promise<HostCreateAdmission> {
 const live=admissionFence(root,id);
 const inspect=async()=>{
  if(!live())throw new HostAdmissionUnavailable('host admission revoked');
  const lease=readHostLeaseFile(root,id),authoritative=options.currentLease();
  if(!lease||!authoritative||lease.pool!==authoritative.pool||lease.deadline!==authoritative.deadline||Date.parse(lease.deadline)<=(options.clock?.now()??new Date()).getTime())throw new HostAdmissionUnavailable('host create requires an unexpired authoritative lease');
  const source=JSON.parse(await readFile(hostWatchdogPaths(root,id).input,'utf8'));
  if(source.root!==root||source.id!==id||source.provider!==provider||source.pool!==lease.pool||source.project!==project||source.deadline!==lease.deadline)throw new HostAdmissionUnavailable('host watchdog admission identity mismatch');
  const mirror=JSON.parse(await readFile(hostLeasePath(root,id),'utf8')),watchdog=mirror.watchdog;
  if(!watchdog||JSON.stringify(watchdog)!==JSON.stringify(authoritative.watchdog))throw new HostAdmissionUnavailable('host watchdog checkpoint mismatch');
  const before=stamp(spendPath(env));
  let reservation:NonNullable<HostCreateAdmission['reservation']>;
  try{reservation=await hostSpendReservation(root,id,env);}catch(error){throw new HostAdmissionUnavailable('host create requires an unsettled hosts reservation',{cause:error});}
  if(before!==stamp(spendPath(env))||reservation.pool!==lease.pool||reservation.deadline!==lease.deadline)throw new HostAdmissionUnavailable('host reservation changed');
  if(!await watchdogAlive({watchdog} as DropletLease,env,options))throw new HostAdmissionUnavailable('host create requires an armed watchdog');
  return {lease,watchdog,reservation,ledgerStamp:before};
 };
 const initial=await inspect();
 const admission=Object.freeze({provider,root,project,lease:Object.freeze(initial.lease),watchdog:Object.freeze({...initial.watchdog}),reservation:Object.freeze(initial.reservation)});
 issued.set(admission,async work=>{
  try {
   const current=await inspect();
   const authoritative=options.currentLease(),mirror=JSON.parse(readFileSync(hostLeasePath(root,id),'utf8'));
   if(!live()||!authoritative||JSON.stringify(authoritative)!==JSON.stringify({...current.lease,watchdog:current.watchdog})||mirror.deadline!==current.lease.deadline||JSON.stringify(mirror.watchdog)!==JSON.stringify(current.watchdog)||stamp(spendPath(env))!==current.ledgerStamp||Date.parse(current.lease.deadline)<=(options.clock?.now()??new Date()).getTime())throw new HostAdmissionUnavailable('host admission backing changed');
   return work();
  }catch(error){if(error instanceof HostAdmissionUnavailable)throw error;throw new HostAdmissionUnavailable('host admission backing unavailable',{cause:error});}
 });
 return admission;
}
