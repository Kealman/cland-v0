import { snapshotLoginDisk } from './login-snapshots.ts';
import type { Host } from './host.ts';
import type { Login, LoginRecords } from './logins.ts';
import type { HostProvider, Machine, Volume } from './provider/provider.ts';
import type { Clock } from '../hub/clock.ts';
import { mountedOpenCodeDatabase } from '../accounts/registry.ts';

export type LoginAddInput = {harness: Login['harness']; kind?: 'disk'|'key'; name?: string; account?: string; pool?: string};
export type LoginSignIn = {name: string; path: string; complete(code: number|null): Promise<Login>};
const quote = (s:string) => "'"+s.replaceAll("'", "'\\''")+"'";
/** Reserve the creating row before any asynchronous host or provider effect. */
export function reserveDiskLogin(o:{logins:LoginRecords;harness:Login['harness'];name?:string|undefined;account?:string|undefined;providerName:string;region:string}):Login {
 let name=o.name;
 if(name===undefined){let n=1;while(o.logins.get(`${o.harness}-${n}`))n++;name=`${o.harness}-${n}`;}
 return o.logins.insert({name,harness:o.harness,account:o.account??name,kind:'disk',provider:o.providerName,region:o.region,volumeId:null,snapshotIds:[],lastSignIn:null});
}
/** Only paths and public harness arguments enter the terminal command. */
export function loginSignInCommand(harness: Login['harness'], path: string): string {
 switch(harness) {
  case 'claude-code': return `CLAUDE_CONFIG_DIR=${quote(path)} claude auth login`;
  case 'codex': return `CODEX_HOME=${quote(path)} codex login --device-auth`;
  case 'opencode': return `OPENCODE_DB=${quote(mountedOpenCodeDatabase(path))} opencode auth login`;
 }
}
/** Caller owns host selection and terminal lifetime. No disk reads or logout. */
export async function prepareLoginSignIn(o: {
 logins: LoginRecords; provider: HostProvider; host: Host; machine: Machine;
 project: string; tag: string; region: string; providerName: string; pool?: string;
 harness: Login['harness']; name?: string | undefined; account?: string | undefined; clock: Clock;
 admitted?: Login; authorize?:()=>void;
}): Promise<LoginSignIn> {
 if (!o.host.loginDisk) throw Error('host does not support login-disk');
 const admitted=o.admitted??reserveDiskLogin(o),name=admitted.name;
 if(admitted.state!=='creating'||admitted.kind!=='disk'||admitted.volumeId!==null||admitted.harness!==o.harness||JSON.stringify(o.logins.get(name))!==JSON.stringify(admitted))throw Error('login admission changed before sign-in');
 const authorize=()=>o.authorize?.();
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
  uncertain=true;
  const created=await o.provider.createVolume(options);
  uncertain=created.state==='failed';
  if(created.state!=='created') throw Error(`login volume ${created.state}: ${created.reason}`);
  volume=created.volume; o.logins.updateCreatingDisk(name,{volumeId:volume.id});
  if(o.pool)o.logins.recordStorage(name,o.pool,{kind:'volume',id:volume.id,sizeGiB:volume.sizeGiB,created:volume.created,deleted:null});
  authorize();
  uncertain=true;
  const attachment=await o.provider.attachVolume(volume,o.machine);
  uncertain=attachment.state==='failed';
  if(attachment.state!=='attached') throw Error(`login attach ${attachment.state}: ${attachment.reason}`);
  attached=true;
  authorize();
  mountAttempted=true;
  await o.host.loginDisk({op:'mount',volume:volume.name,path});
  authorize();
  if(o.harness==='codex'&&!await o.host.publishFile(path+'/config.toml',Buffer.from('cli_auth_credentials_store = "file"\n'),{mode:0o600})) throw Error('Codex sign-in requires a new file-store config');
  authorize();
 } catch(error) {
  if(!uncertain){await cleanup();o.logins.markSignedOut(name,{reason:'sign-in failed',host:null});}
  throw error;
 }
 let completion:Promise<Login>|undefined;
 return {name,path,complete(code) {
  return completion??= (async()=>{
   await o.host.loginDisk!({op:'umount',volume:volume!.name,path});
   let failure:Error|undefined;
   if(code===0) {
    const snapshot=await snapshotLoginDisk(o.logins,name,{provider:o.provider,volume:volume!,authorize},o.clock);
    if(snapshot.state!=='snapshotted'&&snapshot.state!=='refused') failure=Error(`login snapshot ${snapshot.state}: ${snapshot.reason}`);
   }
   const detached=await o.provider.detachVolume(volume!,o.machine);
   if(detached.state!=='detached') throw Error(`login detach ${detached.state}`);
   if(code===0&&!failure) o.logins.updateCreatingDisk(name!,{lastSignIn:o.clock.now().toISOString()});
   if(code===0&&!failure)o.logins.transition(name!,'ready');else o.logins.markSignedOut(name!,{reason:'sign-in failed',host:null});
   const row=o.logins.get(name!)!;
   if(failure) throw failure;
   return row;
  })();
 }};
}
