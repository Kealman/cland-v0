import type {Clock, ClockTimer} from '../hub/clock.ts';
import type {Login, LoginRecords} from './logins.ts';
import type {Host} from './host.ts';
import type {HostProvider, Volume, SnapshotVolumeResult,Machine} from './provider/provider.ts';

export function snapshotHostIdentity(machine:Machine|undefined,created:string|undefined,registration:unknown):string {
 return JSON.stringify({machine,created,registration});
}

const DAY = 24*60*60*1000;
type Disk = Extract<Login,{kind:'disk'}>;
export type SnapshotTarget = {
 provider:HostProvider; volume:Volume; host?:Host; identity?:string;
 authorize?:()=>void; authorizeCleanup?:()=>void;
 mounted?:boolean;
 validate?:()=>Promise<void>;
};
type Control = {installThaw:(thaw:()=>Promise<void>)=>void};
function disk(logins:LoginRecords,name:string):Disk {
 const row=logins.get(name);if(!row||row.kind!=='disk')throw Error('login has no disk');return row;
}
function checkpoint(logins:LoginRecords,name:string,patch:Partial<NonNullable<Disk['backup']>>):void {
 const row=disk(logins,name);logins.updateBackup(name,{pending:true,...row.backup,...patch});
}
async function recoverThaw(logins:LoginRecords,name:string,target:SnapshotTarget):Promise<void> {
 const intent=disk(logins,name).backup?.freeze;if(!intent)return;
 if(intent.volumeId!==target.volume.id||intent.host!==target.host?.name||intent.identity!==(target.identity??target.host?.name??''))throw Error('recorded freeze target identity changed');
 target.authorizeCleanup?.();
 if(!target.host?.loginDisk)throw Error('recorded freeze host unavailable');
 const row=disk(logins,name);
 await target.host.loginDisk({op:'thaw',volume:target.volume.name,path:`/cland/auth/${row.harness}-${name}`});
 target.authorizeCleanup?.();
 const {freeze:_freeze,...backup}=disk(logins,name).backup!;
 logins.updateBackup(name,backup);
}
/** Freeze intent precedes native admission; a receipt precedes thaw and publication.
 * A release can join thaw independently of an accepted provider operation. */
export async function snapshotLoginDisk(logins:LoginRecords,name:string,target:SnapshotTarget,clock:Clock,control?:Control):Promise<SnapshotVolumeResult> {
 let row=disk(logins,name);
 if(row.volumeId!==target.volume.id)throw Error('login volume identity changed');
 if(row.backup?.receipt&&row.backup.receipt.volumeId!==target.volume.id)throw Error('snapshot receipt volume mismatch');
 const authorize=()=>{target.authorize?.();if(disk(logins,name).volumeId!==target.volume.id)throw Error('login volume identity changed');};
 await target.validate?.();authorize();
 if(row.backup?.freeze)await recoverThaw(logins,name,target);
 authorize();row=disk(logins,name);
 if(row.snapshotIds.length>2) {
  await pruneSnapshots(logins,row,target.provider,authorize);
  const found=await target.provider.getSnapshot(row.snapshotIds.at(-1)!);authorize();
  if(found.state!=='found')throw Error('retained backup receipt unavailable');
  return {state:'snapshotted',snapshot:found.snapshot};
 }
 let result:SnapshotVolumeResult|undefined;
 const recovered=row.backup?.receipt;
 if(recovered){result={state:'snapshotted',snapshot:recovered};logins.settleSnapshotAdmission(name,result,target.volume);}
 else {
  authorize();checkpoint(logins,name,{pending:true});
  let thaw:(()=>Promise<void>)|undefined;
  try {
   if(target.mounted||target.volume.attachedTo!==null&&row.state!=='creating') {
    if(!target.host?.loginDisk)throw Error('attached login snapshot requires its mounted host');
    authorize();checkpoint(logins,name,{freeze:{host:target.host.name,identity:target.identity??target.host.name,volumeId:target.volume.id}});
    const settled=Promise.withResolvers<void>();let thawing:Promise<void>|undefined;
    thaw=()=>thawing??=(async()=>{await settled.promise;await recoverThaw(logins,name,target);})();
    control?.installThaw(thaw);
    try {await target.host.loginDisk({op:'freeze',volume:target.volume.name,path:`/cland/auth/${row.harness}-${row.name}`});}
    finally {settled.resolve();}
    authorize();
   }
   await target.validate?.();authorize();logins.beginSnapshotAdmission(name,target.volume.id);
   result=await target.provider.snapshotVolume(target.volume,{authorize});
   logins.settleSnapshotAdmission(name,result,target.volume);
   // A rejected authority check still records the admitted effect's outcome;
   // publication and pruning remain fenced until a current owner reconciles it.
   if(result.state==='snapshotted'&&result.snapshot.volumeId!==target.volume.id)throw Error('snapshot receipt volume mismatch');
   try {await target.validate?.();authorize();}
   catch(error) {
    if(disk(logins,name).volumeId===target.volume.id)checkpoint(logins,name,{...(result.state==='snapshotted'?{receipt:result.snapshot}:result.state==='refused'?{retryAt:result.retryAt}:{}),pending:true,outcome:String(error)});throw error;
   }
   if(result.state==='snapshotted')checkpoint(logins,name,{receipt:result.snapshot,pending:true});
  } finally {if(thaw)await thaw();}
 }
 authorize();row=disk(logins,name);
 if(result.state==='snapshotted') {
  const ids=row.snapshotIds.includes(result.snapshot.id)?row.snapshotIds:[...row.snapshotIds,result.snapshot.id];
  const {receipt:_receipt,...backup}=row.backup??{pending:true};
  logins.updateBackup(name,{...backup,lastAt:result.snapshot.created,pending:ids.length>2},ids);
  await pruneSnapshots(logins,disk(logins,name),target.provider,authorize);
 } else checkpoint(logins,name,{pending:true,retryAt:result.state==='refused'?result.retryAt:new Date(clock.now().getTime()+60000).toISOString()});
 return result;
}

async function pruneSnapshots(logins:LoginRecords,row:Disk,provider:HostProvider,authorize:()=>void):Promise<void> {
 const ids=[...row.snapshotIds];
 while(ids.length>2) {
  authorize();const deleted=await provider.deleteSnapshot(ids[0]!);authorize();
  if(deleted.state!=='deleted')throw Error('snapshot deletion unconfirmed');
  logins.deleteStorage(row.name,'snapshot',ids[0]!);
  ids.shift();logins.updateBackup(row.name,{...row.backup,pending:ids.length>2},ids);
 }
}
function dueAt(row:Login, now:number):number {
 if(row.kind!=='disk'||!['ready','in-use'].includes(row.state))return Infinity;
 if(row.backup?.freeze)return Date.parse(row.backup.retryAt??new Date(now).toISOString());
 if(row.backup?.releasing)return Infinity;
 if(row.backup?.pending)return Date.parse(row.backup.retryAt??new Date(now).toISOString());
 return row.state==='in-use'?Date.parse(row.backup?.lastAt??row.lastSignIn??row.backup?.initialAt??new Date(now).toISOString())+DAY:Infinity;
}

/** Early gone-host startup has no scheduler yet; retain the same lost-kernel fence. */
export function fenceLostLoginRelease(logins:LoginRecords,name:string,now:number,options?:{preserveRelease?:boolean}):void {
 const row=disk(logins,name),{freeze,...backup}=row.backup??{pending:false};
 logins.updateBackup(name,{...backup,releasing:options?.preserveRelease?backup.releasing??false:true,pending:backup.pending||dueAt(row,now)<=now,...(freeze?{outcome:'freeze abandoned with lost host: '+JSON.stringify(freeze)}:{})});
}

/** One owner per login; shutdown joins native/provider work before storage closes. */
type Options = {logins:LoginRecords;clock:Clock;resolve:(row:Disk)=>Promise<SnapshotTarget>;report?:(error:unknown)=>void};
type Running = {promise:Promise<SnapshotVolumeResult>; prepared:Promise<void>; admission?:string;thaw?:()=>Promise<void>};
export class LoginSnapshots {
 private readonly options:Options;
 private readonly work=new Map<string,Running>();
 private readonly releases=new Set<Promise<void>>();
 private readonly timers=new Map<string,ClockTimer>();
 private stopped=false;
 private scheduling=false;
 private readonly unsubscribe:()=>void;
 constructor(options:Options) {
  this.options=options;
  this.unsubscribe=options.logins.onChange(name=>this.schedule(name));
  for(const row of options.logins.list())this.schedule(row.name);
 }
 snapshot(name:string):Promise<SnapshotVolumeResult> {
  if(this.stopped)return Promise.reject(Error('login snapshots stopped'));
  const row=this.options.logins.get(name);
  if(!row)return Promise.reject(Error('unknown login: '+name));
  if(row.kind!=='disk')return Promise.reject(Error('key login has no disk'));
  if(row.backup?.releasing)return Promise.reject(Error('login is releasing'));
  return this.launch(name);
 }
 /** Renewal shares freeze/thaw, release and shutdown ownership with scheduled work. */
 signIn(name:string,admission:string,target:SnapshotTarget):Promise<SnapshotVolumeResult> {
  if(this.stopped)return Promise.reject(Error('login snapshots stopped'));
  this.options.logins.assertSignInAdmission(name,admission);
  const active=this.work.get(name);
  if(active&&active.admission!==admission)return active.promise.then(()=>{},()=>{}).then(()=>this.signIn(name,admission,target));
  if(!active)this.options.logins.assertSnapshotSettled(name);
  return this.launch(name,{admission,target});
 }
 private launch(name:string,renewal?:{admission:string;target:SnapshotTarget}):Promise<SnapshotVolumeResult> {
  const row=disk(this.options.logins,name);
  if(!renewal&&!['ready','in-use'].includes(row.state))return Promise.reject(Error('login must be ready or in-use'));
  if(this.deferPending(name))return Promise.reject(Error('login snapshot deferred: pending binding'));
  const active=this.work.get(name);if(active)return active.promise;
  const bindings=renewal?undefined:JSON.stringify(this.options.logins.bindings(name));
  const prepared=Promise.withResolvers<void>();
  const running:Running={promise:Promise.resolve({state:'failed',reason:'not started'}),prepared:prepared.promise,...(renewal?{admission:renewal.admission}:{})};
  checkpoint(this.options.logins,name,{pending:true});
  running.promise=Promise.resolve().then(async()=>{
   const target=renewal?.target??await this.options.resolve(row);
   const authorize=()=>{
    target.authorize?.();const live=disk(this.options.logins,name);
    if(live.state!==row.state||live.volumeId!==row.volumeId||live.backup?.releasing||!renewal&&JSON.stringify(this.options.logins.bindings(name))!==bindings)throw Error('login snapshot ownership changed or releasing');
    if(renewal)this.options.logins.assertSignInAdmission(name,renewal.admission);
   };
   if(disk(this.options.logins,name).backup?.freeze) {
    let recovering:Promise<void>|undefined;
    running.thaw=()=>recovering??=recoverThaw(this.options.logins,name,target);
    prepared.resolve();await running.thaw();
   }
   prepared.resolve();authorize();
   // Revalidate admission inventory separately from the native effect's own
   // validation below; a held admission read must not bless a changed disk.
   await target.validate?.();authorize();
   return snapshotLoginDisk(this.options.logins,name,{...target,authorize},this.options.clock,{installThaw:thaw=>{running.thaw=thaw;}});
  }).then(result=>{if(result.state==='failed')this.options.report?.(Error('login snapshot failed: '+result.reason));return result;}).catch(error=>{
   const live=this.options.logins.get(name);
   if(live?.kind==='disk'&&live.volumeId===row.volumeId)checkpoint(this.options.logins,name,{pending:true,retryAt:live.backup?.retryAt&&Date.parse(live.backup.retryAt)>this.options.clock.now().getTime()?live.backup.retryAt:new Date(this.options.clock.now().getTime()+60000).toISOString(),outcome:String(error)});
   this.options.report?.(error);throw error;
  }).finally(()=>{prepared.resolve();this.work.delete(name);this.schedule(name);});
  this.work.set(name,running);return running.promise;
 }
 private deferPending(name:string,requested=true):boolean {
  if(!this.options.logins.hasPendingBinding(name))return false;
  const row=disk(this.options.logins,name),outcome='login snapshot deferred: pending binding';
  const pending=requested||row.backup?.pending===true;
  if(row.backup?.pending!==pending||row.backup.outcome!==outcome)checkpoint(this.options.logins,name,{pending,outcome});
  return true;
 }
 /** Fence admission before release; join only freeze/thaw, never provider I/O. */
 beginRelease(name:string,options?:{hostLost?:boolean}):Promise<void> {
  if(this.stopped)return Promise.reject(Error('login snapshots stopped'));
  const work=this.release(name,options);this.releases.add(work);
  void work.finally(()=>this.releases.delete(work)).catch(()=>{});return work;
 }
 private async release(name:string,options?:{hostLost?:boolean}):Promise<void> {
  if(options?.hostLost){fenceLostLoginRelease(this.options.logins,name,this.options.clock.now().getTime());return;}
  const row=disk(this.options.logins,name);
  checkpoint(this.options.logins,name,{releasing:true,pending:row.backup?.pending===true||dueAt(row,this.options.clock.now().getTime())<=this.options.clock.now().getTime()});
  const held=disk(this.options.logins,name).backup;
  if(!held?.freeze)return;
  const running=this.work.get(name);
  if(running){await running.prepared;if(running.thaw)await running.thaw();}
  else {const target=await this.options.resolve(disk(this.options.logins,name));await recoverThaw(this.options.logins,name,target);}
  if(disk(this.options.logins,name).backup?.freeze)throw Error('login thaw remains unconfirmed');
 }
 /** Removal must join accepted snapshot I/O as well as thaw before deleting storage. */
 async beginRemoval(name:string):Promise<void> {
  const active=this.work.get(name);
  await this.beginRelease(name);
  let unknown=false;
  if(active)await active.promise.then(result=>{unknown=result.state==='failed';},()=>{unknown=true;});
  const row=disk(this.options.logins,name);
  if(unknown&&!row.backup?.receipt)throw Error('login snapshot outcome requires reconciliation');
  if(row.backup?.freeze)throw Error('login snapshot thaw requires reconciliation');
  if(row.backup?.receipt){
   const {receipt,...backup}=row.backup;
   const target=await this.options.resolve(row);
   this.options.logins.settleSnapshotAdmission(name,{state:'snapshotted',snapshot:receipt},target.volume);
   this.options.logins.updateBackup(name,{...backup,releasing:true},[...new Set([...row.snapshotIds,receipt.id])]);
  }
  this.options.logins.assertSnapshotSettled(name);
 }
 /** Called after deletion and confirmed detach; does not await snapshot I/O. */
 onReleased(name:string,receipt:{volumeId:string}):void {
  const row=disk(this.options.logins,name);
  if(row.volumeId!==receipt.volumeId||!['ready','signed-out'].includes(row.state)||this.options.logins.hasBindings(name)||row.backup?.freeze)throw Error('snapshot release requires the detached login receipt');
  const due=Date.parse(row.backup?.lastAt??row.lastSignIn??row.backup?.initialAt??this.options.clock.now().toISOString())+DAY;
  checkpoint(this.options.logins,name,{releasing:false,pending:row.backup?.pending===true||due<=this.options.clock.now().getTime()});this.schedule(name);
 }
 private schedule(name:string):void {
  if(this.scheduling)return;
  this.options.clock.clearTimeout(this.timers.get(name));this.timers.delete(name);
  if(this.stopped)return;
  this.scheduling=true;
  const now=this.options.clock.now().getTime();let next=Infinity;
  const row=this.options.logins.get(name);
  if(row?.kind==='disk'&&['ready','in-use'].includes(row.state)&&!this.work.has(name)) {
   if(row.state==='in-use'&&!row.backup?.lastAt&&!row.lastSignIn&&!row.backup?.initialAt)checkpoint(this.options.logins,row.name,{pending:row.backup?.pending??false,initialAt:new Date(now).toISOString()});
   next=Math.min(next,dueAt(this.options.logins.get(row.name)!,now));
   if(this.deferPending(name,next<=now)&&next<=now){this.scheduling=false;return;}
  }
  this.scheduling=false;if(!Number.isFinite(next))return;
  const timer=this.options.clock.setTimeout(()=>{
   this.timers.delete(name);
   const now=this.options.clock.now().getTime();
   const row=this.options.logins.get(name);
   if(row&&dueAt(row,now)<=now&&!this.work.has(name))void this.launch(name).catch(()=>{});
   this.schedule(name);
  },Math.max(1,next-now));timer.unref();this.timers.set(name,timer);
 }
 async close():Promise<void>{this.stopped=true;this.unsubscribe();for(const timer of this.timers.values())this.options.clock.clearTimeout(timer);this.timers.clear();await Promise.allSettled([...Array.from(this.work.values(),work=>work.promise),...this.releases]);}
}
