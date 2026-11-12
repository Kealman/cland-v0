import { signInCommand } from './agent/signin-command.ts';
import { snapshotLoginDisk, fenceLostLoginRelease, type LoginSnapshots } from './login-snapshots.ts';
import type { Host } from './host.ts';
import type { Login, LoginRecords } from './logins.ts';
import type { HostProvider, Machine, Volume } from './provider/provider.ts';
import type { Clock } from '../hub/clock.ts';
import { loginMount } from './login-binding.ts';
import type {HostRecords} from './records.ts';
import {sameVolume} from './login-reader.ts';

/** Startup only: invalidate lost terminal owners without native effects or success inference. */
export function recoverLoginSignIns(records:HostRecords):void {
 let after='';
 for(;;){const page=records.logins.activeSignIns(after);if(!page.length)break;for(const name of page)records.logins.interruptSignIn(name);after=page.at(-1)!;}
 let host='';for(;;){const next=records.logins.signInHostAfter(host);if(!next)break;settleLoginSignInsForHost(records,next);host=next;}
}
/** A detached volume cannot settle a terminal writer. Use the release owner's persisted receipt. */
export function settleLoginSignInsForHost(records:HostRecords,id:string):void {
 const provision=records.provisions.get(id);
 if(provision?.machine&&provision.machineDeletionRead)records.logins.settleSignInHost(id,provision.machine,(name,captured)=>{
  const row=records.logins.get(name);
  if(row?.kind==='disk'&&row.backup?.freeze){
   if(!row.signedOut||row.backup.freeze.host!==captured.id||!captured.identity||row.backup.freeze.identity!==captured.identity)return false;
   // The store-clock episode supplies snapshot bookkeeping time; only the
   // exact-machine deletion receipt above authorizes this settlement.
   fenceLostLoginRelease(records.logins,name,Date.parse(row.signedOut.at),{preserveRelease:true});
  }
  return true;
 });
}

/** Reuse the mounted writer; session and binding ownership never move. */
export async function prepareExistingLoginSignIn(o:{logins:LoginRecords;name:string;provider:HostProvider;host:Host;volume:Volume;machine:Machine;identity:string;clock:Clock;snapshots:LoginSnapshots;authorize:()=>void;authorizeCleanup?:()=>void;admission?:string;cleanup?:()=>Promise<void>;afterSignIn?:(host:string,harness:Login['harness'])=>Promise<void>}):Promise<LoginSignIn> {
 if(!o.identity||!o.machine?.id)throw Error('sign-in host identity required');
 const row=o.logins.get(o.name);
 if(row?.kind!=='disk'||row.volumeId!==o.volume.id||!o.host.loginDisk)throw Error('sign-in disk unavailable');
 o.authorize();
 const binding=o.logins.signInBinding(o.name);
 const admission=o.admission??o.logins.beginSignIn(o.name),path=loginMount(row);
 o.logins.captureSignInHost(o.name,admission,{id:o.host.name,machine:o.machine,identity:o.identity});
 const authorize=()=>{o.authorize();o.logins.assertSignInAdmission(o.name,admission);o.logins.assertSignInBinding(o.name,binding);};
 const validate=async(attachedTo=o.volume.attachedTo)=>{
  authorize();const inventory=await o.provider.listVolumes({project:o.volume.project});authorize();
  const live=inventory.state==='listed'?inventory.volumes.find(volume=>volume.id===o.volume.id):undefined;
  if(!live||!sameVolume(live,o.volume)||live.attachedTo!==attachedTo)throw Error('sign-in volume birth or attachment changed');
 };
 await validate();
 let completion:Promise<Login>|undefined;
 return {name:o.name,path,interrupt(){return completion??=Promise.resolve().then(()=>{
  o.logins.interruptSignIn(o.name,admission);return o.logins.get(o.name)!;
 });},complete(code){return completion??=(async()=>{
  authorize();
  if(code===0){
   const result=await o.snapshots.signIn(o.name,admission,{provider:o.provider,volume:o.volume,host:o.host,identity:o.identity,mounted:true,authorize,validate,authorizeCleanup:o.authorizeCleanup??o.authorize});
   if(result.state!=='snapshotted'&&result.state!=='refused')throw Error(`sign-in snapshot ${result.state}`);
  }
  if(o.cleanup)await o.cleanup();
  await validate(o.cleanup?null:o.volume.attachedTo);
  if(code===0){
   const row=o.logins.finishSignIn(o.name,admission,o.clock.now().toISOString());
   await o.afterSignIn?.(o.host.name,row.harness);
   return row;
  }
  o.logins.markSignedOut(o.name,{reason:'sign-in failed',host:null});return o.logins.get(o.name)!;
 })();}};
}

export type LoginAddInput = {harness: Login['harness']; kind?: 'disk'|'key'; name?: string; account?: string; pool?: string};
export type LoginSignIn = {name: string; path: string; complete(code: number|null): Promise<Login>;interrupt?:()=>Promise<Login>};
const quote = (s:string) => "'"+s.replaceAll("'", "'\\''")+"'";
/** Reserve the creating row before any asynchronous host or provider effect. */
export function reserveDiskLogin(o:{logins:LoginRecords;harness:Login['harness'];name?:string|undefined;account?:string|undefined;providerName:string;region:string}):Login {
 let name=o.name;
 if(name===undefined){let n=1;while(o.logins.get(`${o.harness}-${n}`))n++;name=`${o.harness}-${n}`;}
 return o.logins.insert({name,harness:o.harness,account:o.account??name,kind:'disk',provider:o.providerName,region:o.region,volumeId:null,snapshotIds:[],lastSignIn:null});
}
/** Only paths and public harness arguments enter the terminal command. */
export function loginSignInCommand(harness: Login['harness'], path: string): string {
 const plan=signInCommand({harness,path});
 return `${plan.key}=${quote(plan.value)} ${plan.command} ${plan.args.join(' ')}`;
}
/** Caller owns host selection and terminal lifetime. No disk reads or logout. */
export async function prepareLoginSignIn(o: {
 logins: LoginRecords; provider: HostProvider; host: Host; machine: Machine;
 project: string; tag: string; region: string; providerName: string; pool?: string;
 harness: Login['harness']; name?: string | undefined; account?: string | undefined; clock: Clock;
 admitted?: Login; authorize?:()=>void; authorizeCleanup?:()=>void; admission?:string; snapshots?:LoginSnapshots;identity?:string;afterSignIn?:(host:string,harness:Login['harness'])=>Promise<void>;
}): Promise<LoginSignIn> {
 if (!o.host.loginDisk) throw Error('host does not support login-disk');
 if(o.admission&&(!o.snapshots||!o.identity))throw Error('renewal snapshot owner identity required');
 const admitted=o.admitted??reserveDiskLogin(o),name=admitted.name;
 if(admitted.state!=='creating'||admitted.kind!=='disk'||(admitted.volumeId!==null&&!o.admission)||admitted.harness!==o.harness||JSON.stringify(o.logins.get(name))!==JSON.stringify(admitted))throw Error('login admission changed before sign-in');
 let addAdmission:string|undefined;
 const authorize=()=>{o.authorize?.();if(addAdmission)o.logins.assertSignInAdmission(name,addAdmission);};
 const path=`/cland/auth/${o.harness}-${name}`;
 let volume:Volume|undefined, attached=false, mountAttempted=false, uncertain=false;
 const cleanup=async()=>{
  if(volume && mountAttempted) await o.host.loginDisk!({op:'umount',volume:volume.name,path});
  if(volume && attached) { const result=await o.provider.detachVolume(volume,o.machine); if(result.state!=='detached') throw Error(`login detach ${result.state}`); }
 };
 try {
  // The additive admission is consumed by providers that support login acquisition.
  const options={project:o.project,name:`${o.tag}-${name}`,region:o.region,sizeGiB:1,...(o.pool?{admission:{login:name,project:o.project,pool:o.pool}}:{})};
  authorize();
  if(o.admission){
   const inventory=await o.provider.listVolumes({project:o.project});authorize();
   volume=inventory.state==='listed'?inventory.volumes.find(v=>v.id===admitted.volumeId):undefined;
   if(!volume||volume.attachedTo!==null)throw Error('sign-in volume is unavailable or attached');
  }else{
   uncertain=true;
   const created=await o.provider.createVolume(options);
   uncertain=created.state==='failed';
   if(created.state!=='created') throw Error(`login volume ${created.state}: ${created.reason}`);
   volume=created.volume; o.logins.updateCreatingDisk(name,{volumeId:volume.id});
   if(o.pool)o.logins.recordStorage(name,o.pool,{kind:'volume',id:volume.id,sizeGiB:volume.sizeGiB,created:volume.created,deleted:null});
  }
  authorize();
  if(!o.admission)addAdmission=o.logins.beginAddSignIn(name,{id:o.host.name,machine:o.machine,...(o.identity?{identity:o.identity}:{})});
  uncertain=true;
  const attachment=await o.provider.attachVolume(volume,o.machine);
  uncertain=attachment.state==='failed';
  if(attachment.state!=='attached') throw Error(`login attach ${attachment.state}: ${attachment.reason}`);
  attached=true;
  authorize();
  mountAttempted=true;
  await o.host.loginDisk({op:'mount',volume:volume.name,path});
  authorize();
  if(!o.admission&&o.harness==='codex'&&!await o.host.publishFile(path+'/config.toml',Buffer.from('cli_auth_credentials_store = "file"\n'),{mode:0o600})) throw Error('Codex sign-in requires a new file-store config');
  authorize();
 } catch(error) {
  if(addAdmission&&(uncertain||attached||mountAttempted)){
   // Rejected or abandoned preparation owns the same captured-machine fence,
   // even when no terminal plan could be returned to the dispatcher.
   o.logins.interruptSignIn(name,addAdmission);
  }else if(!uncertain){await cleanup();o.logins.markSignedOut(name,{reason:'sign-in failed',host:null});}
  throw error;
 }
 if(o.admission){
  if(!o.snapshots)throw Error('login snapshots unavailable');
  return prepareExistingLoginSignIn({logins:o.logins,name,provider:o.provider,host:o.host,volume:{...volume!,attachedTo:o.machine.id},machine:o.machine,identity:o.identity!,clock:o.clock,snapshots:o.snapshots,authorize,...(o.authorizeCleanup?{authorizeCleanup:o.authorizeCleanup}:{}),admission:o.admission,cleanup,...(o.afterSignIn?{afterSignIn:o.afterSignIn}:{})});
 }
 const authorizeCompletion=()=>{o.logins.assertSignInAdmission(name,addAdmission!);(o.authorizeCleanup??o.authorize)?.();};
 let completion:Promise<Login>|undefined;
 return {name,path,interrupt(){return completion??=Promise.resolve().then(()=>{
  o.logins.interruptSignIn(name,addAdmission);return o.logins.get(name)!;
 });},complete(code) {
  return completion??= (async()=>{
   authorizeCompletion();
   await o.host.loginDisk!({op:'umount',volume:volume!.name,path});
   authorizeCompletion();
   let failure:Error|undefined;
   if(code===0) {
    const snapshot=await snapshotLoginDisk(o.logins,name,{provider:o.provider,volume:volume!,authorize:authorizeCompletion},o.clock);
    if(snapshot.state!=='snapshotted'&&snapshot.state!=='refused') failure=Error(`login snapshot ${snapshot.state}: ${snapshot.reason}`);
   }
   authorizeCompletion();
   const detached=await o.provider.detachVolume(volume!,o.machine);
   authorizeCompletion();
   if(detached.state!=='detached') throw Error(`login detach ${detached.state}`);
   if(code===0&&!failure)o.logins.finishSignIn(name,addAdmission!,o.clock.now().toISOString());else o.logins.markSignedOut(name!,{reason:'sign-in failed',host:null});
   const row=o.logins.get(name!)!;
   if(failure) throw failure;
   return row;
  })();
 }};
}
