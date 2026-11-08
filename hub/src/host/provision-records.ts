import { positiveNonAcquisition } from './acquisition-receipt.ts';
import type { DatabaseSync } from 'node:sqlite';
import type { Machine } from './provider/provider.ts';
export type ProvisionState = 'creating'|'booting'|'connecting'|'cloning'|'ready'|'failed'|'destroying'|'destroyed';
export const ACTIVE_PROVISION_STATES: readonly ProvisionState[] = ['creating','booting','connecting','cloning','ready','destroying'];
export type ProvisionRecord = { acquisition?:'pending'|'acquired'; nonAcquisition?:import('../executor/droplet/spend.ts').HostNonAcquisitionReceipt; id:string; pool:string; provider:string; size:string; region:string; created:string; state:ProvisionState; machine?:Machine; reason?:string; machineDeletionRead?:string; release?:'released'|'incomplete' };
// This partial index narrows to acquisition anomalies, never parsing receipt dates.
const unresolvedSql = "json_extract(record,'$.state')='failed' and coalesce(json_extract(record,'$.release'),'')!='released'";
/** Shares the registration database: final readiness and revocation serialize in SQLite. */
export class ProvisionRecords {
 readonly #listeners = new Set<(id:string, previous:ProvisionState|null, state:ProvisionState)=>void>();
 onChange(listener:(id:string, previous:ProvisionState|null, state:ProvisionState)=>void):()=>void { this.#listeners.add(listener); return ()=>{this.#listeners.delete(listener);}; }
 /** Call only after the owning SQL write commits. Observer failures cannot undo it. */
 changed(id:string,previous:ProvisionState|null):void {
  const state=this.get(id)?.state;
  if(!state||state===previous)return;
  for(const listener of this.#listeners) { try {listener(id,previous,state);} catch {} }
 }
 readonly #db:DatabaseSync;
 constructor(db:DatabaseSync) {
  this.#db=db;
  db.exec(`create table if not exists provisioned_hosts (id text primary key, record text not null);
   drop index if exists provisioned_occupied_pool;
   create index if not exists provisioned_unreleased_failed_pool on provisioned_hosts(json_extract(record,'$.pool')) where ${unresolvedSql};
   create index if not exists provisioned_pool_ready on provisioned_hosts(json_extract(record,'$.state'),json_extract(record,'$.pool'),id);
   create index if not exists provisioned_host_states on provisioned_hosts(json_extract(record,'$.state'));
   create index if not exists host_registration_states on hosts(state,id);
   create index if not exists provisioned_fake_addresses on provisioned_hosts(json_extract(record,'$.provider'),json_extract(record,'$.machine.address'));
   create index if not exists provisioned_fake_ids on provisioned_hosts(json_extract(record,'$.provider'),json_extract(record,'$.machine.id'));`);
 }
 /** Captured physical identities stay provision-owned even without a registration. */
 ownsFakeAddress(address:string):boolean {
  return Boolean(this.#db.prepare(`select 1 from provisioned_hosts
   where json_extract(record,'$.provider')='fake' and json_extract(record,'$.machine.address')=?
   union all select 1 from provisioned_hosts
   where json_extract(record,'$.provider')='fake' and json_extract(record,'$.machine.id')=? limit 1`).get(address,address));
 }
 reconcileInterrupted():void {
  this.#db.prepare(`update provisioned_hosts set record=json_set(record,'$.state','failed','$.release','incomplete',
   '$.reason','provision interrupted during '||json_extract(record,'$.state')||'; machine retained for reconciliation')
   where json_extract(record,'$.state') in ('creating','booting','connecting','cloning')`).run();
 }
 /** Billable or unresolved ownership, separate from placeable inventory. */
 occupied(pool:string):number {
  let count=Number(this.#db.prepare(`select count(*) as count from provisioned_hosts where json_extract(record,'$.pool')=? and json_extract(record,'$.state') in (${ACTIVE_PROVISION_STATES.map(()=>'?').join(',')})`).get(pool,...ACTIVE_PROVISION_STATES)!.count);
  for(const row of this.#db.prepare(`select record from provisioned_hosts where json_extract(record,'$.pool')=? and ${unresolvedSql}`).iterate(pool)) {
   const record=JSON.parse(String(row.record)) as ProvisionRecord;
   if(record.machine||record.acquisition||!record.nonAcquisition||!positiveNonAcquisition(record.nonAcquisition))count++;
  }
  return count;
 }
 /** Indexed current inventory; terminal history is never read or decoded. */
 *active():Iterable<ProvisionRecord> {
  for(const row of this.#db.prepare(`select record from provisioned_hosts where json_extract(record,'$.state') in (${ACTIVE_PROVISION_STATES.map(()=>'?').join(',')}) order by id`).iterate(...ACTIVE_PROVISION_STATES))yield JSON.parse(String(row.record)) as ProvisionRecord;
 }
 *registered():Iterable<ProvisionRecord> {
  for(const row of this.#db.prepare(`select p.record from hosts h join provisioned_hosts p on p.id=h.id
   where h.state='registered'`).iterate())yield JSON.parse(String(row.record)) as ProvisionRecord;
 }
 /** Bounded current-pool selection for manual creates held by min_hosts. */
 heldByMinimum(id:string,pool:string,count:number):boolean {
  return this.#db.prepare(`select id from provisioned_hosts where json_extract(record,'$.state')='ready' and json_extract(record,'$.pool')=? order by id limit ?`).all(pool,count).some(row=>row.id===id);
 }
 get(id:string):ProvisionRecord|null {
  const row=this.#db.prepare('select record from provisioned_hosts where id=?').get(id);
  return row?JSON.parse(String(row.record)) as ProvisionRecord:null;
 }
 list():ProvisionRecord[] {
  return this.#db.prepare('select record from provisioned_hosts order by id').all().map(row=>JSON.parse(String(row.record)) as ProvisionRecord);
 }
 save(record:ProvisionRecord):void {
  if(record.state==='ready')throw Error('ready requires the registration checkpoint');
  const previous=this.get(record.id)?.state??null;
  this.#db.prepare('insert into provisioned_hosts(id,record) values(?,?) on conflict(id) do update set record=excluded.record').run(record.id,JSON.stringify(record));
  this.changed(record.id,previous);
 }
 ready(record:ProvisionRecord):void {
  if(record.state!=='ready'||!record.machine)throw Error('ready requires a machine registration');
  const previous=this.get(record.id)?.state??null;
  const result=this.#db.prepare(`insert into provisioned_hosts(id,record)
   select ?,? where exists(select 1 from hosts where id=? and address=? and state='registered')
   on conflict(id) do update set record=excluded.record`).run(record.id,JSON.stringify(record),record.id,record.machine.address);
  if(result.changes!==1)throw Error('host registration revoked or changed before readiness');
  this.changed(record.id,previous);
 }
}
