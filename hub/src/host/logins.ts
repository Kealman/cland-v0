import type { DatabaseSync } from 'node:sqlite';

export type LoginBackup = { initialAt?: string; lastAt?: string; pending: boolean; retryAt?: string; releasing?: boolean; freeze?: {host:string; identity:string; volumeId:string}; receipt?: import('./provider/provider.ts').VolumeSnapshot; outcome?: string };
export type LoginState = 'creating' | 'ready' | 'in-use' | 'signed-out';
type Base = { name: string; harness: 'claude-code' | 'codex' | 'opencode'; account: string; state: LoginState; lastSignIn: string | null };
export type Login = Base & ({ kind: 'disk'; exclusive: boolean; provider: string; region: string; volumeId: string | null; snapshotIds: string[]; backup?: LoginBackup } | { kind: 'key' });
export type LoginInput = Omit<Base, 'state'> & ({ kind: 'disk'; exclusive?: boolean; provider: string; region: string; volumeId: string | null; snapshotIds: string[] } | { kind: 'key' });
export type LoginBinding = { login: string; host: string; role: 'writer' | 'reader'; volumeId: string | null; phase?: 'pending' | 'settled' };
export type LoginBindingRefusalCode = 'disk-volume-required' | 'writer-volume-mismatch' | 'reader-volume-mismatch' | 'key-volume' | 'exclusive-writer' | 'writer-conflict';
export class LoginBindingRefused extends Error {
 readonly code: LoginBindingRefusalCode;
 constructor(code: LoginBindingRefusalCode, message: string) {
  super(message); this.name = 'LoginBindingRefused'; this.code = code;
 }
}
const transitions: Record<LoginState, readonly LoginState[]> = {
 creating: ['ready', 'signed-out'], ready: ['in-use'], 'in-use': ['ready', 'signed-out'], 'signed-out': ['creating'],
};

const bindingRow = (row:Record<string,unknown>):LoginBinding => ({login:row.login as string,host:row.host as string,role:row.role as LoginBinding['role'],volumeId:row.volumeId as string|null,...(row.phase ? {phase:row.phase as NonNullable<LoginBinding['phase']>} : {})});

/** Project metadata only: harness files and key material never enter this store. */
export class LoginRecords {
 private readonly listeners = new Set<()=>void>();
 onChange(listener:()=>void):()=>void { this.listeners.add(listener); return ()=>this.listeners.delete(listener); }
 updateBackup(name:string, backup:LoginBackup, snapshotIds?:string[]):void {
  const row=this.required(name); if(row.kind!=='disk')throw Error('key login has no disk');
  this.save({...row,backup,...(snapshotIds ? {snapshotIds} : {})});
 }
 private readonly db: DatabaseSync;
 constructor(db: DatabaseSync) {
  this.db = db;
  db.exec(`create table if not exists logins (name text primary key, record text not null);
   create table if not exists login_bindings (login text not null references logins(name), host text not null, role text not null, volume_id text, primary key(login,host));`);
  if (!db.prepare('pragma table_info(login_bindings)').all().some(row=>row.name==='phase')) db.exec('alter table login_bindings add column phase text');
  db.exec('savepoint login_launch_selection_migration');
  try {
   if(!db.prepare('pragma table_info(login_bindings)').all().some(row=>row.name==='harness')){
    db.exec("alter table login_bindings add column harness text; update login_bindings set harness=(select json_extract(record,'$.harness') from logins where logins.name=login_bindings.login)");
   }
   db.exec("create index if not exists login_bindings_launch on login_bindings(host,harness,login); create index if not exists login_ready_launch on logins(json_extract(record,'$.state'),json_extract(record,'$.kind'),json_extract(record,'$.harness'),json_extract(record,'$.provider'),json_extract(record,'$.region'),json_extract(record,'$.account'),name)");
   db.exec('release login_launch_selection_migration');
  }catch(error){db.exec('rollback to login_launch_selection_migration; release login_launch_selection_migration');throw error;}

 }
 get(name: string): Login | null {
  const row = this.db.prepare('select record from logins where name=?').get(name);
  return row ? JSON.parse(String(row.record)) as Login : null;
 }
 list(): Login[] { return this.db.prepare('select record from logins order by name').all().map(row => JSON.parse(String(row.record)) as Login); }
 free(): Login[] { return this.list().filter(row => row.state === 'ready'); }
 /** Sign-in owners publish native receipts while the login remains unavailable. */
 updateCreatingDisk(name: string, update: {volumeId?: string; snapshotIds?: string[]; lastSignIn?: string}): void {
  const row = this.required(name);
  if (row.kind !== 'disk' || row.state !== 'creating') throw Error('disk login must be creating');
  if(update.volumeId!==undefined&&update.volumeId!==row.volumeId&&(row.backup?.pending||row.backup?.freeze||row.backup?.receipt))throw Error('login volume has retained snapshot ownership');
  this.save({...row,...update});
 }
 bindings(name: string): LoginBinding[] {
  return this.db.prepare('select login,host,role,volume_id as volumeId,phase from login_bindings where login=? order by host').all(name).map(bindingRow);
 }
 /** Indexed launch reads decode at most two held records or one ready candidate. */
 selectForLaunch(input:{host:string;harness:string;provider:string;region:string;account:string|null}):{held:Array<{login:Login;binding:LoginBinding}>;ready:Login|null} {
  const held=this.db.prepare('select l.record,b.login,b.host,b.role,b.volume_id as volumeId,b.phase from login_bindings b indexed by login_bindings_launch join logins l on l.name=b.login where b.host=? and b.harness=? order by b.login limit 2').all(input.host,input.harness).map(row=>({login:JSON.parse(String(row.record)) as Login,binding:bindingRow(row)}));
  if(held.length)return {held,ready:null};
  const sql="select record from logins indexed by login_ready_launch where json_extract(record,'$.state')='ready' and json_extract(record,'$.kind')='disk' and json_extract(record,'$.harness')=? and json_extract(record,'$.provider')=? and json_extract(record,'$.region')=?"+(input.account===null?'':" and json_extract(record,'$.account')=?")+(input.account===null?" order by json_extract(record,'$.account'),name limit 1":" order by name limit 1");
  const parameters=[input.harness,input.provider,input.region,...(input.account===null?[]:[input.account])];
  const row=this.db.prepare(sql).get(...parameters);
  return {held,ready:row?JSON.parse(String(row.record)) as Login:null};
 }
 insert(input: LoginInput): Login {
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(input.name)) throw Error('login name must match [a-z0-9][a-z0-9-]{0,31}');
  if (this.get(input.name)) throw Error('login name must be unique in the project');
  if (!['claude-code','codex','opencode'].includes(input.harness)) throw Error('login harness must be claude-code, codex or opencode');
  if (input.kind !== 'disk' && input.kind !== 'key') throw Error('login kind must be disk or key');
  if (input.kind === 'key' && (input.harness !== 'opencode' || ['volumeId','snapshotIds','exclusive','provider','region'].some(key => Object.hasOwn(input,key)))) throw Error('key logins require opencode and have no disk properties');
  const base: Base = {name:input.name,harness:input.harness,account:input.account,lastSignIn:input.lastSignIn,state:'creating'};
  const row: Login = input.kind === 'key' ? {...base,kind:'key'} : {...base,kind:'disk',exclusive:input.exclusive ?? true,provider:input.provider,region:input.region,volumeId:input.volumeId,snapshotIds:[...input.snapshotIds]};
  this.db.prepare('insert into logins values (?,?)').run(row.name,JSON.stringify(row));
  return row;
 }
 transition(name: string, state: LoginState, binding?: Omit<LoginBinding,'login'>): Login {
  const row = this.required(name);
  if (!transitions[row.state].includes(state)) throw Error(`login ${name} cannot transition from ${row.state} to ${state}`);
  if (state === 'in-use' && !binding) throw Error(`login ${name} in ${row.state} requires a binding for in-use`);
  this.atomic(() => {
   if (binding && state === 'in-use') this.addBinding(row,binding);
   if (state !== 'in-use') this.db.prepare('delete from login_bindings where login=?').run(name);
   this.save({...row,state});
  });
  return this.required(name);
 }
 bind(name: string, binding: Omit<LoginBinding,'login'>): void {
  const row = this.required(name);
  if (row.state === 'ready') { this.transition(name,'in-use',binding); return; }
  if (row.state !== 'in-use') throw Error(`login ${name} cannot bind in ${row.state}`);
  this.addBinding(row,binding);
 }
 settleBinding(name: string, host: string): void {
  const result=this.db.prepare("update login_bindings set phase='settled' where login=? and host=? and phase='pending'").run(name,host);
  if(result.changes!==1)throw Error('pending login binding missing');
 }
 unbind(name: string, host: string): void {
  this.required(name);
  this.atomic(() => {
   this.db.prepare('delete from login_bindings where login=? and host=?').run(name,host);
   const row = this.required(name);
   if (row.state === 'in-use' && !this.bindings(name).length) this.save({...row,state:'ready'});
  });
 }
 private addBinding(row: Login, binding: Omit<LoginBinding,'login'>): void {
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
  this.db.prepare('insert into login_bindings(login,host,role,volume_id,phase,harness) values (?,?,?,?,?,?)').run(row.name,binding.host,binding.role,binding.volumeId,binding.phase ?? null,row.harness);
 }
 private required(name: string): Login { const row = this.get(name); if (!row) throw Error('unknown login: '+name); return row; }
 private save(row: Login): void { this.db.prepare('update logins set record=? where name=?').run(JSON.stringify(row),row.name); for(const listener of this.listeners)listener(); }
 private atomic(work: () => void): void {
  this.db.exec('savepoint login_change');
  try { work(); this.db.exec('release login_change'); }
  catch (error) { this.db.exec('rollback to login_change; release login_change'); throw error; }
 }
}
