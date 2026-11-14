import type { DatabaseSync } from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import type { Machine, Volume, SnapshotVolumeResult } from './provider/provider.ts';
import {realClock, type Clock} from '../hub/clock.ts';

export type LoginStorageItem = {kind:'volume'|'snapshot';id:string;sizeGiB:number;created:string;deleted:string|null};
export type LoginStorage = {pool:string;items:LoginStorageItem[]};

export type ReaderOperation = {login:string;host:string;harness:string;provider:string;project:string;pool:string;region:string;machine:Machine;name:string;snapshot:string;phase:'creating'|'bound'|'deleting'|'deleted';volume?:Volume};

export type LoginBackup = { initialAt?: string; lastAt?: string; pending: boolean; retryAt?: string; releasing?: boolean; freeze?: {host:string; identity:string; volumeId:string}; receipt?: import('./provider/provider.ts').VolumeSnapshot; outcome?: string };
export type LoginState = 'creating' | 'ready' | 'in-use' | 'signed-out';
type Base = { name: string; harness: 'claude-code' | 'codex' | 'opencode'; account: string; state: LoginState; lastSignIn: string | null; storage?:LoginStorage; signedOut?:{id:string;reason:string;host:string|null;at:string;oneSignIn?:true} };
export type Login = Base & ({ kind: 'disk'; exclusive: boolean; provider: string; region: string; volumeId: string | null; snapshotIds: string[]; backup?: LoginBackup } | { kind: 'key' });
export type LoginInput = Omit<Base, 'state'> & ({ kind: 'disk'; exclusive?: boolean; provider: string; region: string; volumeId: string | null; snapshotIds: string[] } | { kind: 'key' });
export type LoginBinding = { login: string; host: string; role: 'writer' | 'reader'; volumeId: string | null; phase?: 'pending' | 'settled' };
type SignInBindingAuthority={writer:LoginBinding|null;episode:string|null;any:boolean};
type SignInHost={id:string;machine:Machine;identity?:string};
type SignInAdmission={id:string;state:'active'|'interrupted';volumeId:string;binding:SignInBindingAuthority;host?:SignInHost};
export type LoginBindingRefusalCode = 'disk-volume-required' | 'writer-volume-mismatch' | 'reader-volume-mismatch' | 'key-volume' | 'exclusive-writer' | 'writer-conflict';
export class LoginBindingRefused extends Error {
 readonly code: LoginBindingRefusalCode;
 constructor(code: LoginBindingRefusalCode, message: string) {
  super(message); this.name = 'LoginBindingRefused'; this.code = code;
 }
}
const transitions: Record<LoginState, readonly LoginState[]> = {
 creating: ['ready', 'signed-out'], ready: ['in-use','signed-out'], 'in-use': ['ready', 'signed-out'], 'signed-out': ['creating'],
};

// Shared SQL predicates keep native triggers and admission fences identical.
const pendingBindingSql=(prefix='')=>`${prefix}phase='pending'`;
const pendingReaderSql=(prefix='')=>`${prefix}phase in ('creating','deleted')`;
const capacityEligibleSql="pending_bindings=0 and (json_extract(record,'$.state')='ready' or (json_extract(record,'$.state')='in-use' and (json_extract(record,'$.kind')='key' or json_extract(record,'$.exclusive')=0))) and (json_extract(record,'$.kind')='key' or json_extract(record,'$.volumeId') is not null)";

const bindingRow = (row:Record<string,unknown>):LoginBinding => ({login:row.login as string,host:row.host as string,role:row.role as LoginBinding['role'],volumeId:row.volumeId as string|null,...(row.phase ? {phase:row.phase as NonNullable<LoginBinding['phase']>} : {})});

/** Project metadata only: harness files and key material never enter this store. */
export class LoginRecords {
 private clock:Clock=realClock;
 private clockSet=false;
 /** Active disks only; retained signed-out history is never decoded at startup. */
 *reconciliationDisks(after='',limit=64):IterableIterator<Extract<Login,{kind:'disk'}>> {
  this.pageLimit(limit);
  for(const row of this.db.prepare("select record from logins indexed by login_reconciliation where name>? and json_extract(record,'$.kind')='disk' and json_extract(record,'$.state') in ('ready','in-use') order by name limit ?").iterate(after,limit))yield JSON.parse(String(row.record));
 }
 reconciliationBindings(after={login:'',host:''},limit=64):LoginBinding[]{
  this.pageLimit(limit);
  return this.db.prepare("select login,host,role,volume_id as volumeId,phase from login_bindings indexed by login_reconcile_bindings where (phase is null or phase='settled') and (login,host)>(?,?) order by login,host limit ?").all(after.login,after.host,limit).map(bindingRow);
 }
 binding(name:string,host:string):LoginBinding|null {
  const row=this.db.prepare('select login,host,role,volume_id as volumeId,phase from login_bindings where login=? and host=?').get(name,host);return row?bindingRow(row):null;
 }
 bindingEpisode(name:string,host:string):string|null {return this.db.prepare('select episode from login_bindings where login=? and host=?').get(name,host)?.episode as string??null;}
 reconciliationVersion(name:string):string|null {return this.db.prepare('select revision from logins where name=?').get(name)?.revision as string??null;}
 hasVolume(provider:string,id:string):boolean{
  return !!this.db.prepare("select 1 from logins indexed by login_volume where json_extract(record,'$.provider')=? and json_extract(record,'$.volumeId')=? limit 1").get(provider,id)
   ||!!this.db.prepare("select 1 from login_bindings b indexed by login_binding_volume join logins l on l.name=b.login where b.volume_id=? and json_extract(l.record,'$.provider')=? limit 1").get(id,provider)
   ||!!this.db.prepare("select 1 from login_readers indexed by login_reader_volume where json_extract(record,'$.provider')=? and json_extract(record,'$.volume.id')=? limit 1").get(provider,id);
 }
 private pageLimit(limit:number):void{if(!Number.isSafeInteger(limit)||limit<1||limit>64)throw Error('login page limit must be 1..64');}
 useClock(clock:Clock):void {if(this.clockSet&&this.clock!==clock)throw Error('login clock already set');this.clock=clock;this.clockSet=true;}
 recordStorage(name:string,pool:string,item:LoginStorageItem):void {
  const row=this.required(name);if(row.kind!=='disk')throw Error('key login has no storage');
  if(!pool||!item.id||!['volume','snapshot'].includes(item.kind)||!Number.isFinite(item.sizeGiB)||item.sizeGiB<=0||!Number.isFinite(Date.parse(item.created))||item.deleted!==null&&!Number.isFinite(Date.parse(item.deleted)))throw Error('invalid login storage receipt');
  if(row.storage&&row.storage.pool!==pool)throw Error('login storage pool changed');
  const items=[...(row.storage?.items??[])];
  if(!items.some(old=>old.kind===item.kind&&old.id===item.id))items.push(item);
  this.saveStorage({...row,storage:{pool,items:this.pruneStorage(items)}});
 }
 deleteStorage(name:string,kind:LoginStorageItem['kind'],id:string):void {
  const row=this.required(name);if(!row.storage)return;
  this.saveStorage({...row,storage:{...row.storage,items:this.pruneStorage(row.storage.items.map(item=>item.kind===kind&&item.id===id?{...item,deleted:item.deleted??this.clock.now().toISOString()}:item))}});
 }
 private saveStorage(row:Login):void {
  const items=row.storage!.items;
  const through=items.some(item=>item.deleted===null)?'9999-12-31T23:59:59.999Z':items.length?new Date(Math.max(...items.map(item=>Date.parse(item.deleted!)))).toISOString():null;
  this.atomic(()=>{
   this.db.prepare('update logins set record=?,storage_pool=?,storage_through=? where name=?').run(JSON.stringify(row),row.storage!.pool,through,row.name);
   this.changed(row.name);
  });
 }
 private pruneStorage(items:LoginStorageItem[]):LoginStorageItem[] {
  const month=this.clock.now().toISOString().slice(0,7)+'-01T00:00:00.000Z';
  return items.filter(item=>item.deleted===null||Date.parse(item.deleted)>=Date.parse(month));
 }
 /** Capacity work is capped at the pool limit and uses the launch eligibility index. */
 capacity(input:{harness:string;provider:string;region:string},max:number):number {
  if(max===0||!this.selectCapacityLogin(input))return 0;
  const sql=`select record from logins indexed by login_capacity_launch where ${capacityEligibleSql} and json_extract(record,'$.harness')=? and json_extract(record,'$.kind')=?`;
  const key=this.db.prepare(sql+" and json_extract(record,'$.provider') is null and json_extract(record,'$.region') is null limit 1").get(input.harness,'key');
  if(key)return max;
  const shared=this.db.prepare(sql.replace('indexed by login_capacity_launch','indexed by login_capacity_shared')+" and json_extract(record,'$.provider')=? and json_extract(record,'$.region')=? and json_extract(record,'$.exclusive')=0 limit 1").get(input.harness,'disk',input.provider,input.region);
  if(shared)return max;
  return this.db.prepare(sql+" and json_extract(record,'$.provider')=? and json_extract(record,'$.region')=? limit ?").all(input.harness,'disk',input.provider,input.region,max).length;
 }
 /** Actual eligible identities, independent of the host admission limit. */
 freeCount(input:{harness:string;provider:string;region:string;account?:string|null}):number {
  const accountClause=input.account?" and json_extract(record,'$.account')=?":"";
  const accountParameters=input.account?[input.account]:[];
  const sql=`select count(*) as n from logins indexed by login_capacity_launch where ${capacityEligibleSql} and json_extract(record,'$.harness')=? and json_extract(record,'$.kind')=?`+accountClause;
  const keys=this.db.prepare(sql+" and json_extract(record,'$.provider') is null and json_extract(record,'$.region') is null").get(input.harness,'key',...accountParameters)!;
  const disks=this.db.prepare(sql+" and json_extract(record,'$.provider')=? and json_extract(record,'$.region')=?").get(input.harness,'disk',...accountParameters,input.provider,input.region)!;
  return Number(keys.n)+Number(disks.n);
 }
 /** Aggregate metadata only: no retained login records or private storage identities are decoded. */
 poolSummary(provider:string,region:string,hosts:readonly string[]):Record<string,{inUse:number;usable:number;signedOut:number}> {
  const result:Record<string,{inUse:number;usable:number;signedOut:number}>={};
  for(const harness of ['claude-code','codex','opencode']) {
   const count=(states:readonly string[])=>Number(this.db.prepare(`select count(*) as n from logins where json_extract(record,'$.harness')=? and
    json_extract(record,'$.state') in (${states.map(()=>'?').join(',')}) and
    (json_extract(record,'$.kind')='key' or (json_extract(record,'$.provider')=? and json_extract(record,'$.region')=?))`).get(harness,...states,provider,region)!.n);
   const names=new Set(hosts.flatMap(host=>this.forHost(host).map(binding=>binding.login)));
   let inUse=0;
   for(const name of names){const login=this.get(name);if(login?.harness===harness&&login.state!=='signed-out'&&login.state!=='creating'&&
    (login.kind==='key'||login.provider===provider&&login.region===region))inUse++;}
   const usable=count(['ready','in-use']),signedOut=count(['signed-out']);
   result[harness]={inUse,usable,signedOut};
  }
  return result;
 }
 harnesses():string[] {return ['claude-code','codex','opencode'].filter(harness=>this.db.prepare("select 1 from logins indexed by login_harnesses where json_extract(record,'$.harness')=? limit 1").get(harness)!==undefined);}
 *storageRows(monthStart:string):Generator<Login> {for(const row of this.db.prepare('select record from logins indexed by login_storage_current where storage_through>=?').iterate(monthStart))yield JSON.parse(String(row.record)) as Login;}
 private readerRelease:((name:string,receipt:{volumeId:string})=>void)|undefined;
 onReaderRelease(listener:(name:string,receipt:{volumeId:string})=>void):()=>void {
  this.readerRelease=listener;return ()=>{if(this.readerRelease===listener)this.readerRelease=undefined;};
 }
 private readonly listeners = new Set<(name:string)=>void>();
 onChange(listener:(name:string)=>void):()=>void { this.listeners.add(listener); return ()=>this.listeners.delete(listener); }
 private changed(name:string):void { this.db.prepare('update logins set revision=? where name=?').run(randomUUID(),name);for(const listener of this.listeners)listener(name); }
 updateBackup(name:string, backup:LoginBackup, snapshotIds?:string[]):void {
  const row=this.required(name); if(row.kind!=='disk')throw Error('key login has no disk');
  this.save({...row,backup,...(snapshotIds ? {snapshotIds} : {})});
 }
 private readonly db: DatabaseSync;
 constructor(db: DatabaseSync) {
  this.db = db;
  db.exec('create table if not exists login_signout_window (identity text primary key, at integer not null)');
  db.exec('create index if not exists login_signout_expiry on login_signout_window(at)');
  db.exec(`create table if not exists logins (name text primary key, record text not null);
   create table if not exists login_bindings (login text not null references logins(name), host text not null, role text not null, volume_id text, primary key(login,host));`);
  if(!db.prepare('pragma table_info(logins)').all().some(row=>row.name==='sign_in'))db.exec('alter table logins add column sign_in text');
  db.exec("create index if not exists login_signin_active on logins(name) where json_extract(sign_in,'$.state')='active'; create index if not exists login_signin_host on logins(json_extract(sign_in,'$.host.id'),name) where sign_in is not null");
  if(!db.prepare('pragma table_info(logins)').all().some(row=>row.name==='revision'))db.exec("alter table logins add column revision text not null default ''");
  if (!db.prepare('pragma table_info(login_bindings)').all().some(row=>row.name==='phase')) db.exec('alter table login_bindings add column phase text');
  if(!db.prepare('pragma table_info(logins)').all().some(row=>row.name==='removing'))db.exec('alter table logins add column removing integer not null default 0');
  if(!db.prepare('pragma table_info(logins)').all().some(row=>row.name==='snapshot_admission'))db.exec('alter table logins add column snapshot_admission text');
  if(!db.prepare('pragma table_info(logins)').all().some(row=>row.name==='removal_volume'))db.exec('alter table logins add column removal_volume text');
  if(!db.prepare('pragma table_info(login_bindings)').all().some(row=>row.name==='episode'))db.exec("alter table login_bindings add column episode text not null default ''");
  db.exec('create index if not exists login_bindings_pending on login_bindings(login,phase)');
  db.exec("create index if not exists login_writer on login_bindings(login) where role='writer'");
  db.exec("create index if not exists login_reconcile_bindings on login_bindings(login,host) where phase is null or phase='settled'");
  db.exec("create index if not exists login_reconciliation on logins(name) where json_extract(record,'$.kind')='disk' and json_extract(record,'$.state') in ('ready','in-use')");
  db.exec('create table if not exists login_readers(login text not null,host text not null,harness text not null,phase text not null,record text not null,primary key(login,host)); create unique index if not exists login_readers_host on login_readers(host,harness); create index if not exists login_readers_pending on login_readers(login,phase)');
  db.exec("create index if not exists login_volume on logins(json_extract(record,'$.provider'),json_extract(record,'$.volumeId')); create index if not exists login_binding_volume on login_bindings(volume_id,login); create index if not exists login_reader_volume on login_readers(json_extract(record,'$.provider'),json_extract(record,'$.volume.id'))");
  db.exec("create index if not exists login_reader_launch on logins(json_extract(record,'$.state'),json_extract(record,'$.kind'),json_extract(record,'$.exclusive'),json_extract(record,'$.harness'),json_extract(record,'$.provider'),json_extract(record,'$.region'),json_extract(record,'$.account'),name)");
  db.exec('savepoint login_launch_selection_migration');
  try {
   if(!db.prepare('pragma table_info(login_bindings)').all().some(row=>row.name==='harness')){
    db.exec("alter table login_bindings add column harness text; update login_bindings set harness=(select json_extract(record,'$.harness') from logins where logins.name=login_bindings.login)");
   }
   db.exec("create index if not exists login_bindings_host on login_bindings(host,login); create index if not exists login_bindings_launch on login_bindings(host,harness,login); create index if not exists login_ready_keys on logins(json_extract(record,'$.harness'),json_extract(record,'$.account'),name) where json_extract(record,'$.state')='ready' and json_extract(record,'$.kind')='key'; create index if not exists login_key_names on logins(name) where json_extract(record,'$.kind')='key'; create index if not exists login_ready_launch on logins(json_extract(record,'$.state'),json_extract(record,'$.kind'),json_extract(record,'$.harness'),json_extract(record,'$.provider'),json_extract(record,'$.region'),json_extract(record,'$.account'),name)");
   if(!db.prepare('pragma table_info(logins)').all().some(row=>row.name==='pending_bindings')){
    db.exec('alter table logins add column pending_bindings integer not null default 0 check(pending_bindings>=0)');
    db.exec(`update logins set pending_bindings=(select count(*) from login_bindings b where b.login=logins.name and ${pendingBindingSql('b.')})+(select count(*) from login_readers r where r.login=logins.name and ${pendingReaderSql('r.')})`);
   }
   for(const [table,predicate] of [['login_bindings',pendingBindingSql],['login_readers',pendingReaderSql]] as const){
    db.exec(`create trigger if not exists ${table}_capacity_insert after insert on ${table} when ${predicate('new.')} begin update logins set pending_bindings=pending_bindings+1 where name=new.login; end;
     create trigger if not exists ${table}_capacity_delete after delete on ${table} when ${predicate('old.')} begin update logins set pending_bindings=pending_bindings-1 where name=old.login; end;
     create trigger if not exists ${table}_capacity_update after update of phase,login on ${table} begin
      update logins set pending_bindings=pending_bindings-1 where name=old.login and ${predicate('old.')};
      update logins set pending_bindings=pending_bindings+1 where name=new.login and ${predicate('new.')}; end;`);
   }
   db.exec(`create index if not exists login_capacity_shared on logins(json_extract(record,'$.harness'),json_extract(record,'$.kind'),json_extract(record,'$.provider'),json_extract(record,'$.region')) where ${capacityEligibleSql} and json_extract(record,'$.exclusive')=0`);
   if(!db.prepare('pragma table_info(logins)').all().some(row=>row.name==='storage_through')){
    db.exec('alter table logins add column storage_pool text; alter table logins add column storage_through text');
    db.exec("update logins set storage_pool=json_extract(record,'$.storage.pool'),storage_through=case when exists(select 1 from json_each(record,'$.storage.items') where json_extract(value,'$.deleted') is null) then '9999-12-31T23:59:59.999Z' else (select max(strftime('%Y-%m-%dT%H:%M:%fZ',json_extract(value,'$.deleted'))) from json_each(record,'$.storage.items')) end where json_type(record,'$.storage')='object'");
   }
   db.exec('drop index if exists login_storage');
   db.exec("create index if not exists login_storage_current on logins(storage_through,storage_pool) where storage_through is not null; create index if not exists login_harnesses on logins(json_extract(record,'$.harness'))");
   db.exec(`create index if not exists login_capacity_launch on logins(json_extract(record,'$.harness'),json_extract(record,'$.kind'),json_extract(record,'$.provider'),json_extract(record,'$.region'),json_extract(record,'$.account'),name) where ${capacityEligibleSql}`);
   db.exec('release login_launch_selection_migration');
  }catch(error){db.exec('rollback to login_launch_selection_migration; release login_launch_selection_migration');throw error;}

 }
 /** Snapshot owner only: every provider send retains its volume identity until settled. */
 beginSnapshotAdmission(name:string,volumeId:string):void {
  this.assertSnapshotSettled(name);
  const row=this.required(name);if(row.kind!=='disk'||row.volumeId!==volumeId)throw Error('snapshot volume identity changed');
  this.db.prepare('update logins set snapshot_admission=? where name=?').run(volumeId,name);
 }
 /** The owner supplies a positive non-send or snapshot receipt, never an inventory omission. */
 settleSnapshotAdmission(name:string,result:SnapshotVolumeResult,volume?:Pick<Volume,'id'|'sizeGiB'>):void {
  if(result.state==='failed')return;
  const row=this.required(name);
  const admitted=this.db.prepare('select snapshot_admission from logins where name=?').get(name)?.snapshot_admission;
  if(result.state==='snapshotted'){
   if(row.kind!=='disk'||!volume||volume.id!==row.volumeId||result.snapshot.volumeId!==volume.id||admitted&&admitted!==volume.id)throw Error('snapshot admission identity changed');
   if(!admitted){
    if(JSON.stringify(row.backup?.receipt)!==JSON.stringify(result.snapshot))throw Error('snapshot admission missing');
    // Repair an older retained receipt through the same fenced owner transaction.
    this.db.prepare('update logins set snapshot_admission=? where name=?').run(volume.id,name);
   }
  }else if(!admitted)throw Error('snapshot admission missing');
  try {
   this.atomic(()=>{
    if(result.state==='snapshotted'){
     const live=this.required(name);if(live.kind!=='disk')throw Error('login has no disk');
     this.updateBackup(name,{...live.backup,pending:true,receipt:result.snapshot});
     if(live.storage)this.recordStorage(name,live.storage.pool,{kind:'snapshot',id:result.snapshot.id,sizeGiB:volume!.sizeGiB,created:result.snapshot.created,deleted:null});
    }
    this.db.prepare('update logins set snapshot_admission=null where name=?').run(name);
   });
  }catch(error){
   // Failed accounting must retain the positive receipt for owner recovery,
   // without settling the admission rolled back by the failed transaction.
   if(result.state==='snapshotted'){
    const live=this.required(name);if(live.kind==='disk')this.updateBackup(name,{...live.backup,pending:true,receipt:result.snapshot});
   }
   throw error;
  }
 }
 /** Shared read fence; removal and reconciliation never settle the snapshot owner's intent. */
 assertSnapshotSettled(name:string):void {
  if(this.db.prepare('select snapshot_admission from logins where name=?').get(name)?.snapshot_admission)throw Error('login snapshot outcome requires reconciliation');
 }
 /** Removal ownership survives incomplete provider effects and restart. */
 isRemoving(name:string):boolean {return !!this.db.prepare('select removing from logins where name=?').get(name)?.removing;}
 assertNotRemoving(name:string):void {
  if(this.isRemoving(name))throw Error(`login ${name}: removal in progress; retry login remove`);
 }
 beginRemove(name:string):Login {
  return this.atomicValue(()=>{
   this.assertNotSigningIn(name);
   const row=this.required(name),bindings=this.bindings(name);
   if(bindings.length||row.state==='in-use')throw Error(`login ${name} is in use on host ${bindings.map(b=>b.host).join(', ')||'unknown'}`);
   if(row.state==='creating')throw Error(`login ${name}: sign-in is running`);
   if(this.hasPendingBinding(name))throw Error(`login ${name}: pending binding outcome unknown`);
   this.db.prepare('update logins set removing=1 where name=?').run(name);
   if(row.state==='ready')this.markSignedOut(name,{reason:'removing',host:null});
   else this.changed(name);
   return this.required(name);
  });
 }
 removalVolume(name:string,volume?:Volume):Volume|null {
  const row=this.required(name);if(row.kind!=='disk')throw Error('login has no disk');
  if(volume){if(volume.id!==row.volumeId)throw Error('removal volume identity changed');this.db.prepare('update logins set removal_volume=? where name=?').run(JSON.stringify(volume),name);}
  const retained=this.db.prepare('select removal_volume from logins where name=?').get(name)?.removal_volume;
  return retained?JSON.parse(String(retained)) as Volume:null;
 }
 confirmRemovedResource(name:string,kind:'volume'|'snapshot',id:string):void {
  this.atomic(()=>{
   this.deleteStorage(name,kind,id);
   const row=this.required(name);if(row.kind!=='disk')throw Error('login has no disk');
   this.save({...row,...(kind==='volume'?{volumeId:null}:{snapshotIds:row.snapshotIds.filter(value=>value!==id)})});
  });
 }
 remove(name:string):void {
  this.atomic(()=>{
   const row=this.required(name);
   if(!this.isRemoving(name))throw Error('login removal claim missing');
   if(this.bindings(name).length||this.hasPendingBinding(name)||row.state==='creating'||row.state==='in-use')throw Error(`login ${name}: still owned`);
   this.assertSnapshotSettled(name);
   if(row.kind==='disk'&&(row.volumeId||row.snapshotIds.length||row.backup?.freeze||row.backup?.receipt))throw Error(`login ${name}: storage remains`);
   this.db.prepare('delete from logins where name=?').run(name);this.changed(name);
  });
 }
 private atomicValue<T>(work:()=>T):T {let result!:T;this.atomic(()=>{result=work();});return result;}
 get(name: string): Login | null {
  const row = this.db.prepare('select record from logins where name=?').get(name);
  return row ? JSON.parse(String(row.record)) as Login : null;
 }
 *signedOutRows():Generator<Login> {
  for(const row of this.db.prepare("select record from logins indexed by login_ready_launch where json_extract(record,'$.state')='signed-out'").iterate())yield JSON.parse(String(row.record)) as Login;
 }
 list(): Login[] { return this.db.prepare('select record from logins order by name').all().map(row => JSON.parse(String(row.record)) as Login); }
 free(): Login[] { return this.list().filter(row => row.state === 'ready'); }
 /** Sign-in owners publish native receipts while the login remains unavailable. */
 updateCreatingDisk(name: string, update: {volumeId?: string; snapshotIds?: string[]; lastSignIn?: string}): void {
  const row = this.required(name);
  if (row.kind !== 'disk' || row.state !== 'creating') throw Error('disk login must be creating');
  if(update.volumeId!==undefined&&update.volumeId!==row.volumeId&&this.signInAdmission(name))throw Error('login volume has a retained sign-in admission');
  if(update.volumeId!==undefined&&update.volumeId!==row.volumeId&&(row.backup?.pending||row.backup?.freeze||row.backup?.receipt))throw Error('login volume has retained snapshot ownership');
  this.save({...row,...update});
 }
 bindings(name: string): LoginBinding[] {
  return this.db.prepare('select login,host,role,volume_id as volumeId,phase from login_bindings where login=? order by host').all(name).map(bindingRow);
 }
 hasBindings(name:string):boolean {return this.db.prepare('select 1 from login_bindings where login=? limit 1').get(name)!==undefined;}
 signInBinding(name:string):SignInBindingAuthority {
  const row=this.db.prepare("select login,host,role,volume_id as volumeId,phase,episode from login_bindings indexed by login_writer where login=? and role='writer' limit 1").get(name);
  return {writer:row?bindingRow(row):null,episode:row?.episode as string??null,any:!!row||this.hasBindings(name)};
 }
 assertSignInBinding(name:string,captured:ReturnType<LoginRecords['signInBinding']>):void {
  const live=this.signInBinding(name);
  if(JSON.stringify(live)!==JSON.stringify(captured))throw Error('sign-in writer binding episode changed');
 }
 /** Only bound disks participate; indexed cursor pages decode no retained login rows. */
 boundHosts(after:string,limit:number):string[] {
  if(!Number.isSafeInteger(limit)||limit<1||limit>64)throw Error('bound host page limit must be 1..64');
  const bound=this.db.prepare("select distinct b.host from login_bindings b indexed by login_bindings_host join logins l on l.name=b.login where b.host>? and (b.phase is null or b.phase='settled') and json_extract(l.record,'$.kind')='disk' order by b.host limit ?").all(after,limit).map(row=>String(row.host));
  const readers=this.db.prepare("select distinct host from login_readers where host>? and phase<>'bound' order by host limit ?").all(after,limit).map(row=>String(row.host));
  return [...new Set([...bound,...readers])].sort().slice(0,limit);
 }
 /** Indexed host release lookup; does not decode unrelated login history. */
 forHost(host:string):LoginBinding[] {
  return this.db.prepare('select login,host,role,volume_id as volumeId,phase from login_bindings where host=? order by login').all(host).map(bindingRow);
 }
 /** Existence only: bounded output and indexed work even for many settled readers. */
 hasPendingBinding(name:string):boolean {
  return this.db.prepare(`select 1 from login_bindings where login=? and ${pendingBindingSql()} limit 1`).get(name)!==undefined || this.db.prepare(`select 1 from login_readers where login=? and ${pendingReaderSql()} limit 1`).get(name)!==undefined;
 }
 readerOperation(login:string,host:string):ReaderOperation|null {
  const row=this.db.prepare('select record from login_readers where login=? and host=?').get(login,host);return row?JSON.parse(String(row.record)):null;
 }
 readerForHost(host:string,harness:string):ReaderOperation|null {
  const row=this.db.prepare('select record from login_readers where host=? and harness=?').get(host,harness);return row?JSON.parse(String(row.record)):null;
 }
 readersForHost(host:string):ReaderOperation[] {
  return this.db.prepare('select record from login_readers where host=? order by harness').all(host).map(row=>JSON.parse(String(row.record)) as ReaderOperation);
 }
 beginReader(operation:ReaderOperation):void {
  this.assertNotRemoving(operation.login);
  const login=this.required(operation.login);
  if(login.kind!=='disk'||login.exclusive||operation.phase!=='creating'||operation.volume||operation.harness!==login.harness||operation.provider!==login.provider||operation.region!==login.region)throw Error('invalid reader admission');
  this.db.prepare('insert into login_readers values(?,?,?,?,?)').run(operation.login,operation.host,operation.harness,operation.phase,JSON.stringify(operation));this.changed(operation.login);
 }
 saveReader(operation:ReaderOperation):void {
  const old=this.readerOperation(operation.login,operation.host);
  if(!old||old.name!==operation.name||old.provider!==operation.provider||old.project!==operation.project||old.machine.id!==operation.machine.id||old.machine.created!==operation.machine.created)throw Error('reader ownership changed');
  if(operation.volume&&(operation.volume.name!==old.name||operation.volume.project!==old.project||operation.volume.region!==old.region||old.volume&&old.volume.id!==operation.volume.id))throw Error('reader volume identity changed');
  if(operation.volume&&operation.phase!=='deleted')this.recordStorage(operation.login,this.required(operation.login).storage?.pool??operation.pool,{kind:'volume',id:operation.volume.id,sizeGiB:operation.volume.sizeGiB,created:operation.volume.created,deleted:null});
  if(operation.volume&&operation.phase==='deleted')this.deleteStorage(operation.login,'volume',operation.volume.id);
  this.db.prepare('update login_readers set phase=?,record=? where login=? and host=?').run(operation.phase,JSON.stringify(operation),operation.login,operation.host);this.changed(operation.login);
 }
 refuseReader(operation:ReaderOperation):void {
  const current=this.readerOperation(operation.login,operation.host);
  if(current?.phase!=='creating'||current.volume||JSON.stringify(current)!==JSON.stringify(operation))throw Error('reader refusal ownership changed');
  this.db.prepare('delete from login_readers where login=? and host=?').run(operation.login,operation.host);this.changed(operation.login);
 }
 bindReader(operation:ReaderOperation):void {
  if(!operation.volume)throw Error('reader volume missing');
  this.atomic(()=>{this.bind(operation.login,{host:operation.host,role:'reader',volumeId:operation.volume!.id,phase:'pending'});this.saveReader({...operation,phase:'bound'});});
 }
 completeReader(operation:ReaderOperation):void {
  const current=this.readerOperation(operation.login,operation.host);
  if(current?.name!==operation.name||current.phase!=='deleted')throw Error('reader deletion receipt missing');
  this.atomic(()=>{
   this.unbind(operation.login,operation.host);
   const row=this.required(operation.login);
   if(row.kind==='disk'&&row.state==='ready'){
    if(this.readerRelease)this.readerRelease(row.name,{volumeId:row.volumeId!});
    else if(row.backup?.releasing)throw Error('reader snapshot release owner unavailable');
   }
   this.db.prepare('delete from login_readers where login=? and host=?').run(operation.login,operation.host);this.changed(operation.login);
  });
 }
 /** Stream only ready key identities; non-ready metadata has no launchable secret. */
 *keyNames():Generator<string> {
  for(const row of this.db.prepare("select name from logins indexed by login_key_names where json_extract(record,'$.kind')='key' and json_extract(record,'$.state')='ready' order by name").iterate())yield String(row.name);
 }
 /** Bounded host/harness ownership read shared by binding and placement. */
 heldForLaunch(input:{host:string;harness:string}):Array<{login:Login;binding:LoginBinding}> {
  return this.db.prepare('select l.record,b.login,b.host,b.role,b.volume_id as volumeId,b.phase from login_bindings b indexed by login_bindings_launch join logins l on l.name=b.login where b.host=? and b.harness=? order by b.login limit 2').all(input.host,input.harness).map(row=>({login:JSON.parse(String(row.record)) as Login,binding:bindingRow(row)}));
 }
 /** Indexed launch reads decode at most two held records or one ready candidate. */
 selectForLaunch(input:{host:string;harness:string;provider:string;region:string;account:string|null}):{held:Array<{login:Login;binding:LoginBinding}>;ready:Login|null} {
  const held=this.heldForLaunch(input);
  if(held.length)return {held,ready:null};
  const sql="select record from logins indexed by login_ready_launch where json_extract(record,'$.state')='ready' and not exists (select 1 from login_readers where login=logins.name and phase in ('creating','deleted')) and json_extract(record,'$.kind')='disk' and json_extract(record,'$.harness')=? and json_extract(record,'$.provider')=? and json_extract(record,'$.region')=?"+(input.account===null?'':" and json_extract(record,'$.account')=?")+(input.account===null?" order by json_extract(record,'$.account'),name limit 1":" order by name limit 1");
  const parameters=[input.harness,input.provider,input.region,...(input.account===null?[]:[input.account])];
  const keySql="select record from logins indexed by login_ready_keys where json_extract(record,'$.state')='ready' and json_extract(record,'$.kind')='key' and json_extract(record,'$.harness')=?"+(input.account===null?"":" and json_extract(record,'$.account')=?")+(input.account===null?" order by json_extract(record,'$.account'),name limit 1":" order by name limit 1");
  const row=(input.harness==='opencode' ? this.db.prepare(keySql).get(input.harness,...(input.account===null?[]:[input.account])) : undefined) ?? this.db.prepare(sql).get(...parameters) ?? this.db.prepare(sql.replace('indexed by login_ready_launch','indexed by login_reader_launch').replace("json_extract(record,'$.state')='ready'","json_extract(record,'$.state')='in-use' and json_extract(record,'$.exclusive')=0 and not exists (select 1 from login_bindings where login=logins.name and phase='pending')")).get(...parameters);
  return {held,ready:row?JSON.parse(String(row.record)) as Login:null};
 }
 /** Bounded capacity lookup: one ready regional disk or an unlimited shared login. */
 selectCapacityLogin(input:{harness:string;provider:string;region:string;account?:string|null}):Login|null {
  const accountClause=input.account?" and json_extract(record,'$.account')=?":"";
  const accountParameters=input.account?[input.account]:[];
  const sql=`select record from logins indexed by login_capacity_launch where ${capacityEligibleSql} and json_extract(record,'$.harness')=? and json_extract(record,'$.kind')=?`;
  const key=this.db.prepare(sql+" and json_extract(record,'$.provider') is null and json_extract(record,'$.region') is null"+accountClause+" limit 1").get(input.harness,'key',...accountParameters);
  const row=key??this.db.prepare(sql+" and json_extract(record,'$.provider')=? and json_extract(record,'$.region')=?"+accountClause+" limit 1").get(input.harness,'disk',input.provider,input.region,...accountParameters);
  return row?JSON.parse(String(row.record)) as Login:null;
 }
 insert(input: LoginInput): Login {
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(input.name)) throw Error('login name must match [a-z0-9][a-z0-9-]{0,31}');
  if (this.get(input.name)) throw Error('login name must be unique in the project');
  if (!['claude-code','codex','opencode'].includes(input.harness)) throw Error('login harness must be claude-code, codex or opencode');
  if (input.kind !== 'disk' && input.kind !== 'key') throw Error('login kind must be disk or key');
  if (input.kind === 'key' && (input.harness !== 'opencode' || ['volumeId','snapshotIds','exclusive','provider','region'].some(key => Object.hasOwn(input,key)))) throw Error('key logins require opencode and have no disk properties');
  const base: Base = {name:input.name,harness:input.harness,account:input.account,lastSignIn:input.lastSignIn,state:'creating'};
  const row: Login = input.kind === 'key' ? {...base,kind:'key'} : {...base,kind:'disk',exclusive:input.exclusive ?? true,provider:input.provider,region:input.region,volumeId:input.volumeId,snapshotIds:[...input.snapshotIds]};
  this.db.prepare('insert into logins(name,record) values (?,?)').run(row.name,JSON.stringify(row));
  return row;
 }
 setExclusive(name:string,exclusive:boolean):Login {
  if(typeof exclusive!=='boolean')throw Error('exclusive must be true or false');
  const row=this.required(name);
  if(row.kind!=='disk')throw Error('key login has no exclusive flag');
  if(this.hasPendingBinding(name))throw Error(`login ${name}: outcome unknown`);
  if(row.state==='in-use')throw Error(`login ${name} is ${row.state}`);
  this.save({...row,exclusive});return this.required(name);
 }
 markSignedOut(name:string,receipt:{reason:string;host:string|null}):void {
  const row=this.required(name);
  if(row.state!=='creating'&&row.state!=='ready'&&row.state!=='in-use')throw Error(`login ${name} cannot mark signed out from ${row.state}`);
  this.atomic(()=>{
   this.db.prepare('update logins set sign_in=null where name=?').run(name);
   const now=this.clock.now().getTime(),identity=JSON.stringify(row.account?['account',row.account]:['login',row.name]);
   const operational=row.state!=='creating'&&!!receipt.host;
   const previous=operational?this.db.prepare('select at from login_signout_window where identity=?').get(identity)?.at as number|undefined:undefined;
   const oneSignIn=operational&&previous!==undefined&&now>=previous&&now-previous<86400000;
   if(operational)this.db.prepare('insert into login_signout_window(identity,at) values (?,?) on conflict(identity) do update set at=excluded.at').run(identity,now);
   this.db.prepare('delete from login_signout_window where identity in (select identity from login_signout_window indexed by login_signout_expiry where at<=? order by at limit 64)').run(now-86400000);
   this.save({...row,state:'signed-out',signedOut:{id:randomUUID(),reason:receipt.reason,host:receipt.host,at:this.clock.now().toISOString(),...(oneSignIn?{oneSignIn:true}:{})}});
  });
 }
 /** New disk acquisition joins the same terminal owner after its volume is persisted. */
 beginAddSignIn(name:string,host:SignInHost):string {
  let admission='';
  this.atomic(()=>{
   const row=this.required(name);this.assertSignInSettled(name);this.assertNotSigningIn(name);
   if(row.kind!=='disk'||!row.volumeId||row.state!=='creating'||this.hasBindings(name))throw Error('new sign-in requires an unbound creating disk');
   admission=randomUUID();this.saveSignIn(name,{id:admission,state:'active',volumeId:row.volumeId,binding:this.signInBinding(name),host});
  });return admission;
 }
 /** Sign-in owns a durable admission without releasing existing disk users. */
 beginSignIn(name:string):string {
  let admission='';
  this.atomic(()=>{
   const row=this.required(name);this.assertSignInSettled(name);
   this.assertNotSigningIn(name);
   if(row.kind!=='disk'||!row.volumeId||row.state!=='signed-out')throw Error('sign-in requires a signed-out disk login');
   admission=randomUUID();this.saveSignIn(name,{id:admission,state:'active',volumeId:row.volumeId,binding:this.signInBinding(name)});
   const {signedOut,...rest}=row;this.save({...rest,state:'creating'});
  });return admission;
 }
 finishSignIn(name:string,admission:string,lastSignIn:string):Login {
  this.atomic(()=>{
   const row=this.required(name);this.assertSignInSettled(name);
   this.assertSignInAdmission(name,admission);
   if(!Number.isFinite(Date.parse(lastSignIn)))throw Error('invalid sign-in receipt time');
   this.db.prepare('update logins set sign_in=null where name=?').run(name);
   this.save({...row,lastSignIn,state:this.hasBindings(name)?'in-use':'ready'});
  });return this.required(name);
 }
 assertSignInAdmission(name:string,admission:string):void {
  const owner=this.signInAdmission(name);
  if(this.required(name).state!=='creating'||owner?.state!=='active'||owner.id!==admission)throw Error('sign-in admission changed');
  if(!owner.binding)throw Error('sign-in binding admission missing');
  this.assertSignInBinding(name,owner.binding);
  this.assertNotRemoving(name);
  const row=this.required(name);
  if(row.kind!=='disk'||row.volumeId!==owner.volumeId)throw Error('sign-in volume admission changed');
  if(row.kind==='disk'&&row.backup?.releasing)throw Error('login is releasing');
 }
 private signInAdmission(name:string):SignInAdmission|null {
  const value=this.db.prepare('select sign_in from logins where name=?').get(name)?.sign_in;
  return value?JSON.parse(String(value)) as SignInAdmission:null;
 }
 private saveSignIn(name:string,owner:SignInAdmission):void {this.db.prepare('update logins set sign_in=? where name=?').run(JSON.stringify(owner),name);}
 captureSignInHost(name:string,admission:string,host:SignInHost):void {
  this.atomic(()=>{this.assertSignInAdmission(name,admission);const owner=this.signInAdmission(name)!;if(owner.host&&(owner.host.id!==host.id||JSON.stringify(owner.host.machine)!==JSON.stringify(host.machine)||owner.host.identity!==undefined&&owner.host.identity!==host.identity))throw Error('sign-in host admission changed');this.saveSignIn(name,{...owner,host});});
 }
 signInFenceReason(name:string):string {
  const owner=this.signInAdmission(name);
  return owner?.state==='interrupted'&&owner.host?`Previous sign-in may still be running on host ${owner.host.id}; its idle stop or cland host destroy must confirm machine deletion before signing in again.`:'';
 }
 assertNotSigningIn(name:string):void {
  const interrupted=this.signInFenceReason(name);if(interrupted)throw Error(interrupted);
  if(this.signInAdmission(name))throw Error(`login ${name}: sign-in is running; requires a signed-out disk login`);
 }
 activeSignIns(after='',limit=64):string[] {
  this.pageLimit(limit);return this.db.prepare("select name from logins indexed by login_signin_active where name>? and json_extract(sign_in,'$.state')='active' order by name limit ?").all(after,limit).map(row=>String(row.name));
 }
 signInHostAfter(after:string):string|null {
  return this.db.prepare("select json_extract(sign_in,'$.host.id') as host from logins indexed by login_signin_host where sign_in is not null and json_extract(sign_in,'$.host.id')>? order by json_extract(sign_in,'$.host.id') limit 1").get(after)?.host as string??null;
 }
 interruptSignIn(name:string,admission?:string):void {
  this.atomic(()=>{const owner=this.signInAdmission(name);if(admission&&owner?.id!==admission)throw Error('sign-in admission changed');if(owner?.state!=='active')return;this.markSignedOut(name,{reason:'sign-in interrupted',host:owner.host?.id??null});if(owner.host)this.saveSignIn(name,{...owner,state:'interrupted'});});
 }
 /** Only the release owner calls this after reading its persisted machine receipt. */
 settleSignInHost(host:string,machine:Machine,settleFreeze?:(name:string,host:SignInHost)=>boolean):void {
  let after='';
  for(;;){
   const page=this.db.prepare("select name,sign_in from logins indexed by login_signin_host where sign_in is not null and json_extract(sign_in,'$.host.id')=? and name>? order by name limit 64").all(host,after);if(!page.length)return;
   for(const item of page){const owner=JSON.parse(String(item.sign_in)) as SignInAdmission;if(JSON.stringify(owner.host?.machine)!==JSON.stringify(machine))continue;this.atomic(()=>{const name=String(item.name);this.interruptSignIn(name);if(settleFreeze?.(name,owner.host!)===false)return;this.db.prepare('update logins set sign_in=null where name=?').run(name);this.changed(name);});}
   after=String(page.at(-1)!.name);
  }
 }
 private assertSignInSettled(name:string):void {
  this.assertNotRemoving(name);this.assertSnapshotSettled(name);
  const row=this.required(name);
  if(this.hasPendingBinding(name))throw Error('login pending binding outcome unknown');
  if(row.kind==='disk'&&(row.backup?.releasing||row.backup?.freeze||row.backup?.receipt))throw Error('login snapshot or release outcome requires reconciliation');
 }
 transition(name: string, state: LoginState, binding?: Omit<LoginBinding,'login'>): Login {
  this.assertNotRemoving(name);
  const row = this.required(name);
  if(state==='signed-out')throw Error(`login ${name} from ${row.state}: use markSignedOut for signed-out`);
  if (!transitions[row.state].includes(state)) throw Error(`login ${name} cannot transition from ${row.state} to ${state}`);
  if (state === 'in-use' && !binding) throw Error(`login ${name} in ${row.state} requires a binding for in-use`);
  this.atomic(() => {
   if (binding && state === 'in-use') this.addBinding(row,binding);
   if (state !== 'in-use') this.db.prepare('delete from login_bindings where login=?').run(name);
   const {signedOut,...rest}=row;
   this.save({...rest,...(state!=='creating'&&signedOut?{signedOut}:{}),state});
  });
  return this.required(name);
 }
 bind(name: string, binding: Omit<LoginBinding,'login'>): void {
  const row = this.required(name);
  if (row.state === 'ready') { this.transition(name,'in-use',binding); return; }
  if (row.state !== 'in-use') throw Error(`login ${name} cannot bind in ${row.state}`);
  this.addBinding(row,binding);
  this.changed(name);
 }
 settleBinding(name: string, host: string): void {
  const result=this.db.prepare("update login_bindings set phase='settled' where login=? and host=? and phase='pending'").run(name,host);
  if(result.changes!==1)throw Error('pending login binding missing');
  this.changed(name);
 }
 unbind(name: string, host: string): void {
  this.required(name);
  this.atomic(() => {
   this.db.prepare('delete from login_bindings where login=? and host=?').run(name,host);
   const row = this.required(name);
   if (row.state === 'in-use' && !this.db.prepare('select 1 from login_bindings where login=? limit 1').get(name)) this.save({...row,state:'ready'});
   else this.changed(name);
  });
 }
 private addBinding(row: Login, binding: Omit<LoginBinding,'login'>): void {
  this.assertNotRemoving(row.name);
  if (!binding.host || !['reader','writer'].includes(binding.role)) throw Error('login binding requires a host and writer or reader role');
  const existing = this.bindings(row.name);
  if (row.kind === 'key' && binding.volumeId !== null) throw new LoginBindingRefused('key-volume','key login bindings have no volume');
  if (row.kind === 'disk') {
   if (binding.volumeId === null) throw new LoginBindingRefused('disk-volume-required','disk login binding requires a volume');
   if (binding.role === 'writer' && binding.volumeId !== row.volumeId) throw new LoginBindingRefused('writer-volume-mismatch','writer volume must equal the login volume');
   if (binding.role === 'reader' && binding.volumeId === row.volumeId) throw new LoginBindingRefused('reader-volume-mismatch','reader volume must differ from the login volume');
  }
  if (row.kind === 'disk' && row.exclusive && (existing.length || binding.role !== 'writer')) throw new LoginBindingRefused('exclusive-writer','exclusive login requires a single writer');
  if (binding.role === 'writer' && existing.some(b => b.role === 'writer')) throw new LoginBindingRefused('writer-conflict','login already has a writer');
  this.db.prepare('insert into login_bindings(login,host,role,volume_id,phase,harness,episode) values (?,?,?,?,?,?,?)').run(row.name,binding.host,binding.role,binding.volumeId,binding.phase ?? null,row.harness,randomUUID());
 }
 private required(name: string): Login { const row = this.get(name); if (!row) throw Error('unknown login: '+name); return row; }
 private save(row: Login): void { this.db.prepare('update logins set record=? where name=?').run(JSON.stringify(row),row.name); this.changed(row.name); }
 private atomic(work: () => void): void {
  this.db.exec('savepoint login_change');
  try { work(); this.db.exec('release login_change'); }
  catch (error) { this.db.exec('rollback to login_change; release login_change'); throw error; }
 }
}
