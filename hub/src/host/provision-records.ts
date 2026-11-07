import type { DatabaseSync } from 'node:sqlite';
import type { Machine } from './provider/provider.ts';
export type ProvisionState = 'creating'|'booting'|'connecting'|'cloning'|'ready'|'failed'|'destroying'|'destroyed';
export type ProvisionRecord = { id:string; pool:string; provider:string; size:string; region:string; created:string; state:ProvisionState; machine?:Machine; reason?:string; machineDeletionRead?:string; release?:'released'|'incomplete' };
/** Shares the registration database: final readiness and revocation serialize in SQLite. */
export class ProvisionRecords {
 readonly #db:DatabaseSync;
 constructor(db:DatabaseSync) {
  this.#db=db;
  db.exec(`create table if not exists provisioned_hosts (id text primary key, record text not null);
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
 *registered():Iterable<ProvisionRecord> {
  for(const row of this.#db.prepare(`select p.record from hosts h join provisioned_hosts p on p.id=h.id
   where h.state='registered'`).iterate())yield JSON.parse(String(row.record)) as ProvisionRecord;
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
  this.#db.prepare('insert into provisioned_hosts(id,record) values(?,?) on conflict(id) do update set record=excluded.record').run(record.id,JSON.stringify(record));
 }
 ready(record:ProvisionRecord):void {
  if(record.state!=='ready'||!record.machine)throw Error('ready requires a machine registration');
  const result=this.#db.prepare(`insert into provisioned_hosts(id,record)
   select ?,? where exists(select 1 from hosts where id=? and address=? and state='registered')
   on conflict(id) do update set record=excluded.record`).run(record.id,JSON.stringify(record),record.id,record.machine.address);
  if(result.changes!==1)throw Error('host registration revoked or changed before readiness');
 }
}
