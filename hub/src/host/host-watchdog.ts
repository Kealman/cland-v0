import { positiveProviderNonAcquisition, type ProviderNonAcquisitionReceipt } from './acquisition-receipt.ts';
import { cancelHostSpend } from '../executor/droplet/spend.ts';
import { invalidateHostAdmission } from './admission-fence.ts';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, link, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { realClock, type Clock } from '../hub/clock.ts';
import { armWatchdog, stopWatchdog, watchdogStopped, type WatchdogOptions } from '../executor/droplet/watchdog.ts';
import type { DropletLease } from '../executor/droplet/lease.ts';
import { durableJson } from '../executor/droplet/lease.ts';
import { settleHostSpend } from '../executor/droplet/spend.ts';
import { HostProviderRegistry } from './provider/registry.ts';
import type { Machine, ReleaseRead } from './provider/provider.ts';
import { hostLeasePath, readHostLeaseFile } from './host-leases.ts';
import { clockDelay } from './clock-delay.ts';

export type HostWatchdogIdentity = NonNullable<DropletLease['watchdog']>;
export type HostWatchdogInput = { root:string; id:string; provider:string; machine:Machine };
export type HostWatchdogAdmission = {root:string;id:string;provider:string;project:string;pool:string;deadline:string;machine?:Machine};
export const hostWatchdogPaths=(root:string,id:string)=>{
 const base=hostLeasePath(root,id);
 return {input:base+'.watchdog-input',receipt:base+'.watchdog-receipt',nonAcquisition:base+'.watchdog-non-acquisition'};
};
export async function armHostWatchdog(input:HostWatchdogInput|HostWatchdogAdmission,env:NodeJS.ProcessEnv,options:WatchdogOptions={}):Promise<HostWatchdogIdentity> {
 const path=hostWatchdogPaths(input.root,input.id).input;
 await mkdir(dirname(path),{recursive:true,mode:0o700});
 await durableJson(path,input);
 return armWatchdog(path,env,{...options,launch:()=>spawn(process.execPath,[fileURLToPath(import.meta.url),path],{env,detached:true,stdio:'ignore'})});
}
/** Reuses executor ownership probes and escalation; never signals an unproved PID. */
export class HostWatchdogStopIncomplete extends Error {
 readonly code='watchdog-stop-incomplete' as const;
 constructor(cause?:unknown){super('host watchdog stop incomplete (watchdog stop unconfirmed); identity and input retained',{cause});}
}
export async function stopHostWatchdog(watchdog:HostWatchdogIdentity|undefined,env:NodeJS.ProcessEnv,options:WatchdogOptions={}):Promise<void> {
 if(!watchdog)return;
 try {
  await stopWatchdog({watchdog} as DropletLease,env,options);
  if(!await watchdogStopped(watchdog,env,options))throw new HostWatchdogStopIncomplete();
 }catch(error){if(error instanceof HostWatchdogStopIncomplete)throw error;throw new HostWatchdogStopIncomplete(error);}
}

export async function retireHostWatchdog(root:string,id:string,watchdog:HostWatchdogIdentity|undefined,env:NodeJS.ProcessEnv,options:WatchdogOptions={}):Promise<void> {
 invalidateHostAdmission(root,id);
 await stopHostWatchdog(watchdog,env,options);
 try {await unlink(hostWatchdogPaths(root,id).input);}catch(error){if(!['ENOENT','ENOTDIR'].includes((error as NodeJS.ErrnoException).code??''))throw error;}
}

export type HostAbsenceReceipt=HostWatchdogInput & {confirmedAt:string;reads:ReleaseRead[]};
/** Both readers use the captured acquisition identity, never file location alone. */
export function parseHostAbsenceReceipt(value:unknown,input:HostWatchdogInput):HostAbsenceReceipt {
 const row=value as Partial<HostAbsenceReceipt>|null;
 if(!row||row.root!==input.root||row.id!==input.id||row.provider!==input.provider||
  !row.machine||(['id','address','architecture','created'] as const).some(key=>row.machine![key]!==input.machine[key])||
  typeof row.confirmedAt!=='string'||!Number.isFinite(Date.parse(row.confirmedAt))||Date.parse(row.confirmedAt)<Date.parse(input.machine.created)||
  !Array.isArray(row.reads)||row.reads.some(read=>!read||!['machine','key'].includes(read.resource)||typeof read.read!=='string'||!read.read.trim())||
  !row.reads.some(read=>read.resource==='machine')||!row.reads.some(read=>read.resource==='key'))throw Error('invalid host absence receipt');
 return row as HostAbsenceReceipt;
}
async function readHostAbsence(input:HostWatchdogInput|HostWatchdogAdmission):Promise<HostAbsenceReceipt|undefined> {
 let source:string;
 try {source=await readFile(hostWatchdogPaths(input.root,input.id).receipt,'utf8');}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
 try {
  const row=JSON.parse(source);
  if(!input.machine) {
   if(!('project' in input)||row.project!==input.project||row.pool!==input.pool||row.deadline!==input.deadline||!row.machine)throw Error('admission receipt mismatch');
   return parseHostAbsenceReceipt(row,{...input,machine:row.machine});
  }
  return parseHostAbsenceReceipt(row,{...input,machine:input.machine});
 }catch{throw Error('invalid host absence receipt');}
}
/** First confirmed absence wins across hub and worker. Only complete, bound
 * evidence is publishable or reusable; an invalid retained file stays fenced. */
export async function recordHostAbsence(input:HostWatchdogInput,clock:Clock,reads:ReleaseRead[]):Promise<HostAbsenceReceipt> {
 let bound:HostWatchdogInput=input;
 try {
  const admission=JSON.parse(await readFile(hostWatchdogPaths(input.root,input.id).input,'utf8')) as HostWatchdogInput|HostWatchdogAdmission;
  if(admission.root!==input.root||admission.id!==input.id||admission.provider!==input.provider)throw Error('host absence admission mismatch');
  if(admission.machine)parseHostAbsenceReceipt({...input,confirmedAt:clock.now().toISOString(),reads},{...admission,machine:admission.machine});
  else if(!('project' in admission)||typeof admission.project!=='string'||typeof admission.pool!=='string'||!Number.isFinite(Date.parse(admission.deadline)))throw Error('invalid host absence admission');
  bound={...admission,...input};
 }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 const receipt=parseHostAbsenceReceipt({...bound,confirmedAt:clock.now().toISOString(),reads},input);
 const path=hostWatchdogPaths(input.root,input.id).receipt,candidate=path+'.'+randomUUID();
 await mkdir(dirname(path),{recursive:true,mode:0o700});
 await durableJson(candidate,receipt);
 try {try {await link(candidate,path);}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;}}
 finally {await unlink(candidate);}
 return (await readHostAbsence(input))!;
}
/** No hub database: only the atomic deadline mirror and immutable machine identity.
 * Missing/broken publication cannot extend a lease. Failed deletion retries retain
 * the same identity, and settlement always uses the durable absence timestamp. */
export async function runHostWatchdog(admission:HostWatchdogInput|HostWatchdogAdmission,env:NodeJS.ProcessEnv,clock:Clock=realClock,wait:(ms:number)=>Promise<void>=ms=>clockDelay(clock,ms),signal?:AbortSignal,options:{processes?:import('../hub/lock.ts').LockProcessTable;provider?:import('./provider/provider.ts').HostProvider;report?:(message:string)=>void}={}):Promise<void> {
 const timing={clock,...(options.processes?{processes:options.processes}:{})};
 const provider=options.provider??new HostProviderRegistry({env,digitalocean:{root:admission.root},now:()=>clock.now().getTime()}).resolve(admission);
 let input:HostWatchdogInput|undefined=admission.machine?{...admission,machine:admission.machine}:undefined;
 let reported=false;
 const reportOnce=async(message:string)=>{
  if(reported)return;
  const path=hostWatchdogPaths(admission.root,admission.id).input+'.report';let exists=false;
  try{await readFile(path);exists=true;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  if(!exists){await durableJson(path,{message,at:clock.now().toISOString()});(options.report??console.error)(message);}
  reported=true;
 };
 let receipt=await readHostAbsence(admission);
 let nonAcquisition:ProviderNonAcquisitionReceipt|undefined;
 const scope='project' in admission?{lease:admission.id,project:admission.project,pool:admission.pool}:undefined;
 if(scope){try{const row=JSON.parse(await readFile(hostWatchdogPaths(admission.root,admission.id).nonAcquisition,'utf8'));if(!positiveProviderNonAcquisition(row,scope))throw Error('invalid host non-acquisition receipt');nonAcquisition=row;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}

 while(!signal?.aborted) {
  if(nonAcquisition){if(nonAcquisition.orphan)await reportOnce('host watchdog '+admission.id+': non-billable key orphan '+nonAcquisition.orphan.keyName+'; '+nonAcquisition.orphan.reason);try{await cancelHostSpend({project:admission.root,lease:admission.id},nonAcquisition,env,timing);return;}catch{await wait(1000);continue;}}
  if(!receipt) {
   let remaining=0;
   try {const lease=readHostLeaseFile(admission.root,admission.id);remaining=lease?Date.parse(lease.deadline)-clock.now().getTime():0;}catch {/* unreadable mirror never extends */}
   if(remaining>0){await wait(Math.min(1000,remaining));continue;}
   if(!input) {
    try {const machine='project' in admission?await provider.findAdmission?.(admission.project,admission.pool,admission.id):undefined;if(machine)input={...admission,machine};}catch {/* discovery failure never authorizes deletion */}
    if(!input&&scope&&provider.releaseAdmission){
     const result=await provider.releaseAdmission(scope.project,scope.pool,scope.lease);
     if(result.state==='released'&&positiveProviderNonAcquisition(result.nonAcquisition,scope)){
      await durableJson(hostWatchdogPaths(admission.root,admission.id).nonAcquisition,result.nonAcquisition);nonAcquisition=result.nonAcquisition;continue;
     }
    }
    if(!input){await reportOnce('host watchdog '+admission.id+': exact admission machine unavailable; retained');await wait(1000);continue;}
   }
   const reads:ReleaseRead[]=[];
   try {
    const result=await provider.release(input.machine,read=>reads.push(read));
    if(result.state==='released'&&reads.some(r=>r.resource==='machine')&&reads.some(r=>r.resource==='key')) {
     receipt=await recordHostAbsence(input,clock,reads);
    }
   }catch {/* Retain acquisition and retry through the same provider. */}
  }
  if(receipt) {
   // Persist absence before ledger publication; retries use this exact timestamp.
   try {await settleHostSpend(admission.root,admission.id,receipt.confirmedAt,env,timing);return;}catch {/* retain receipt for retry */}
  }
  await wait(1000);
 }
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
 const abort=new AbortController();
 const stop=()=>abort.abort();process.on('SIGTERM',stop);process.on('SIGINT',stop);
 try {
  const input=JSON.parse(await readFile(process.argv[2]!,'utf8')) as HostWatchdogInput;
  await runHostWatchdog(input,process.env,realClock,ms=>clockDelay(realClock,ms,abort.signal).catch(error=>{if(!abort.signal.aborted)throw error;}),abort.signal);
 }catch{process.exitCode=1;}
 finally {process.off('SIGTERM',stop);process.off('SIGINT',stop);}
}
