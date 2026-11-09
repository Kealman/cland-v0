import { invalidateHostAdmission } from './admission-fence.ts';
import type { LockProcessTable } from '../hub/lock.ts';
import type { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { Clock, ClockTimer } from '../hub/clock.ts';
import { cancelHostSpend, reserveHostSpend, renewHostSpend, settleHostSpend, type HostSpendCaps } from '../executor/droplet/spend.ts';

export class HostLeasePublicationError extends Error { readonly code='host-lease-publication'; constructor(id:string,cause:unknown){super(`host ${id} lease publication failed`,{cause});} }
export type HostLease = { id:string; pool:string; created:string; deadline:string; watchdog?:import('./host-watchdog.ts').HostWatchdogIdentity };
export const hostLeasePath=(root:string,id:string)=>{
 if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(id))throw Error('invalid host lease id');
 return join(root,'.cland/run/host-leases',id+'.json');
};
/** Watchdog boundary: missing file is absence of a mirror, never a lease extension. */
export function readHostLeaseFile(root:string,id:string):HostLease|null {
 const path=hostLeasePath(root,id);
 let source:string;
 try {source=readFileSync(path,'utf8');}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}
 const row=JSON.parse(source) as HostLease;
 if(!row||row.id!==id||typeof row.pool!=='string'||!Number.isFinite(Date.parse(row.created))||!Number.isFinite(Date.parse(row.deadline))||Date.parse(row.deadline)<Date.parse(row.created))throw Error('invalid host lease mirror');
 return {id:row.id,pool:row.pool,created:row.created,deadline:row.deadline};
}
type LeaseOptions={processes?:LockProcessTable;root:string;env:NodeJS.ProcessEnv;clock:Clock;leaseMs:number;caps:HostSpendCaps;pool:string;size:string;priceHourly:number;billingMinimumMs:number};
/** Database is authoritative; ledger first, database second, mirror last. */
export class HostLeases {
 readonly #db:DatabaseSync;
 readonly #expiries=new Set<Promise<void>>();
 readonly #owners=new Map<string,{stop():void;done:Promise<void>}>();
 constructor(db:DatabaseSync){this.#db=db;db.exec('create table if not exists host_leases(id text primary key,pool text not null,created text not null,deadline text not null,released text); create table if not exists host_lease_watchdogs(id text primary key, identity text not null)');}
 get(id:string):HostLease|null{const row=this.#db.prepare('select id,pool,created,deadline from host_leases where id=?').get(id) as HostLease|undefined;if(!row)return null;const identity=this.#db.prepare('select identity from host_lease_watchdogs where id=?').get(id);return identity?{...row,watchdog:JSON.parse(String(identity.identity))}:row;}
 currentAdmission(id:string):HostLease|null {const row=this.#db.prepare('select released from host_leases where id=?').get(id);return row&&row.released===null?this.get(id):null;}
 *active():Iterable<HostLease>{for(const row of this.#db.prepare('select id from host_leases order by id').iterate()){const lease=this.get(String(row.id));if(lease)yield lease;}}
 checkpointWatchdog(id:string,root:string,watchdog:NonNullable<HostLease['watchdog']>,mirrorDeadline?:string):void{if(!this.get(id))throw Error('unknown host lease');this.#db.prepare('insert into host_lease_watchdogs(id,identity) values(?,?) on conflict(id) do update set identity=excluded.identity').run(id,JSON.stringify(watchdog));const row=this.get(id)!;this.#mirror(root,{...row,deadline:new Date(Math.min(Date.parse(row.deadline),Date.parse(mirrorDeadline??row.deadline))).toISOString()});}
 #mirror(root:string,row:HostLease){try {const path=hostLeasePath(root,row.id);mkdirSync(dirname(path),{recursive:true,mode:0o700});writeFileSync(path+'.next',JSON.stringify(row),{mode:0o600});renameSync(path+'.next',path);}catch(error){throw new HostLeasePublicationError(row.id,error);}}
 effective(id:string,root:string,clock:Clock):{deadline:string;expired:boolean;failure?:HostLeasePublicationError}|null {
  const row=this.get(id);if(!row)return null;
  try {const file=readHostLeaseFile(root,id);const deadline=new Date(Math.min(Date.parse(row.deadline),Date.parse(file?.deadline??row.created))).toISOString();return {deadline,expired:clock.now().getTime()>=Date.parse(deadline)};}
  catch(error){return {deadline:row.created,expired:true,failure:new HostLeasePublicationError(id,error)};}
 }
 async create(id:string,o:LeaseOptions):Promise<void>{
  hostLeasePath(o.root,id);
  if(!Number.isFinite(o.leaseMs)||o.leaseMs<30000)throw Error('host lease must be at least 30s');
  const created=o.clock.now().toISOString(),deadline=new Date(o.clock.now().getTime()+o.leaseMs).toISOString();
  await reserveHostSpend({project:o.root,lease:id,pool:o.pool,size:o.size,priceHourly:o.priceHourly,billingMinimumMs:o.billingMinimumMs,created,deadline},o.caps,o.env,o.processes?{clock:o.clock,processes:o.processes}:{clock:o.clock});
  this.#db.prepare('insert into host_leases(id,pool,created,deadline) values(?,?,?,?)').run(id,o.pool,created,deadline);
  this.#mirror(o.root,{id,pool:o.pool,created,deadline});
 }
 async renew(id:string,o:LeaseOptions):Promise<void>{
  const row=this.get(id);if(!row)return;
  const deadline=new Date(o.clock.now().getTime()+o.leaseMs).toISOString();
  if(deadline<=row.deadline)return;
  await renewHostSpend(o.root,id,deadline,o.caps,o.env,o.processes?{clock:o.clock,processes:o.processes}:{clock:o.clock});
  this.#db.prepare('update host_leases set deadline=? where id=?').run(deadline,id);
  this.#mirror(o.root,{...row,deadline});
 }
 arm(id:string,o:LeaseOptions,inUse:()=>boolean,onError:(error:unknown)=>void=error=>{console.error(error);},onExpired:()=>Promise<void>=async()=>{}):void{
  if(this.#owners.has(id))throw Error('host renewal already armed');
  let publicationPending=false,stopped=false,timer:ClockTimer|undefined,expiryTimer:ClockTimer|undefined,due=o.clock.now().getTime()+Math.min(3600000,o.leaseMs/4);
  const owner={stop:()=>{stopped=true;o.clock.clearTimeout(timer);o.clock.clearTimeout(expiryTimer);},done:Promise.resolve()};
  const expire=()=>{if(stopped)return;owner.stop();const work=onExpired().catch(onError).finally(()=>this.#expiries.delete(work));this.#expiries.add(work);};
  const schedule=()=>{
   if(stopped)return;
   const effective=this.effective(id,o.root,o.clock);if(!effective)return;
   if(effective.expired){if(effective.failure)onError(effective.failure);expire();return;}
   o.clock.clearTimeout(expiryTimer);expiryTimer=o.clock.setTimeout(expire,Date.parse(effective.deadline)-o.clock.now().getTime());expiryTimer.unref();
   timer=o.clock.setTimeout(()=>{
    const current=this.effective(id,o.root,o.clock);if(current?.expired){if(current.failure)onError(current.failure);expire();return;}
    owner.done=(async()=>{if(publicationPending){const row=this.get(id);if(row)this.#mirror(o.root,row);publicationPending=false;}else if(inUse())await this.renew(id,o);due=o.clock.now().getTime()+Math.min(3600000,o.leaseMs/4);})().catch(error=>{onError(error);publicationPending=error instanceof HostLeasePublicationError;due=o.clock.now().getTime()+(publicationPending?1000:Math.min(3600000,o.leaseMs/4));}).finally(schedule);
   },Math.max(1,Math.min(due,Date.parse(effective.deadline))-o.clock.now().getTime()));timer.unref();
  };
  this.#owners.set(id,owner);schedule();
 }
 /** Join renewal before shortening the authoritative lease and its watchdog mirror. */
 async expireNow(id:string,root:string,clock:Clock):Promise<void>{
  invalidateHostAdmission(root,id);
  await this.stop(id);const row=this.get(id);if(!row)return;
  const deadline=new Date(Math.min(Date.parse(row.deadline),clock.now().getTime())).toISOString();
  this.#db.prepare('update host_leases set deadline=? where id=?').run(deadline,id);
  try{this.#mirror(root,{...row,deadline});}
  catch(error){
   // A failed shortening must not prevent primary deletion. Keep its mirror
   // retry owned until publication, release or shutdown; never renew here.
   let stopped=false,timer:ClockTimer|undefined;
   const owner={stop:()=>{stopped=true;clock.clearTimeout(timer);},done:Promise.resolve()};
   const schedule=()=>{if(stopped)return;timer=clock.setTimeout(()=>{
    if(stopped)return;
    const current=this.get(id);
    if(!current){owner.stop();this.#owners.delete(id);return;}
    try{this.#mirror(root,current);owner.stop();this.#owners.delete(id);}
    catch{schedule();}
   },1000);timer.unref();};
   this.#owners.set(id,owner);schedule();throw error;
  }
 }
 async stop(id:string):Promise<void>{const owner=this.#owners.get(id);if(!owner)return;owner.stop();await owner.done;this.#owners.delete(id);}
 async close():Promise<void>{for(const owner of this.#owners.values())owner.stop();await Promise.all([...this.#owners.values()].map(owner=>owner.done));this.#owners.clear();await Promise.all([...this.#expiries]);}
 /** Cancellation authority comes from the durable admission checkpoint, never a timer or caller flag. */
 async cancel(id:string,o:Pick<LeaseOptions,'root'|'env'|'clock'|'processes'>):Promise<void>{
  invalidateHostAdmission(o.root,id);
  await this.stop(id);
  const stored=this.#db.prepare('select record from provisioned_hosts where id=?').get(id);
  const record=stored?JSON.parse(String(stored.record)):null;
  if(!record?.nonAcquisition||record.machine||record.acquisition)throw Error('durable non-acquisition receipt required');
  await cancelHostSpend({project:o.root,lease:id},record.nonAcquisition,o.env,o.processes?{clock:o.clock,processes:o.processes}:{clock:o.clock});
  try {rmSync(hostLeasePath(o.root,id),{force:true});}catch(error){if(!['ENOENT','ENOTDIR'].includes((error as NodeJS.ErrnoException).code??''))throw error;}
  this.#db.prepare('delete from host_lease_watchdogs where id=?').run(id);
  this.#db.prepare('delete from host_leases where id=?').run(id);
 }
 /** Caller supplies a positive absence receipt; unknown outcomes must never call this. */
 async release(id:string,o:Pick<LeaseOptions,'root'|'env'|'clock'|'processes'>,confirmedAt?:string):Promise<void>{
  invalidateHostAdmission(o.root,id);
  const released=confirmedAt??o.clock.now().toISOString();
  await this.stop(id);const row=this.get(id);if(!row)return;
  this.#db.prepare('update host_leases set released=coalesce(released,?) where id=?').run(released,id);
  const receipt=this.#db.prepare('select released from host_leases where id=?').get(id)!;
  await settleHostSpend(o.root,id,String(receipt.released),o.env,o.processes?{clock:o.clock,processes:o.processes}:{clock:o.clock});
  rmSync(hostLeasePath(o.root,id),{force:true});
  this.#db.prepare('delete from host_lease_watchdogs where id=?').run(id);
  this.#db.prepare('delete from host_leases where id=?').run(id);
 }
}
