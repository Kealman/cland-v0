import { prepareLoginSignIn, prepareExistingLoginSignIn, reserveDiskLogin, loginSignInCommand, type LoginAddInput, type LoginSignIn } from './login-signin.ts';
import { HostProviderRegistry } from './provider/registry.ts';
import { projectTag } from '../executor/droplet/droplet.ts';
import { sshConnectionArguments } from '../transport/ssh.ts';
import type { HostRecords } from './records.ts';
import type { HostPools } from './pools.ts';
import type { Host } from './host.ts';
import type { Clock } from '../hub/clock.ts';
import {snapshotHostIdentity,type LoginSnapshots} from './login-snapshots.ts';
import { assertPaidTerms } from './paid-terms.ts';
import { hostPoolDocument } from './pools.ts';

/** Reuse any ready host, including full hosts; join a boot already admitted. */
export async function preparePoolLogin(o:{root:string;env:NodeJS.ProcessEnv;pools:HostPools['pools'];records:HostRecords;hosts:readonly Host[];clock:Clock;signal:AbortSignal;createHost:(pool:string)=>Promise<unknown>;runner?:typeof prepareLoginSignIn;snapshots?:LoginSnapshots;pinHost?:(id:string)=>()=>void;afterSignIn?:(host:string,harness:LoginAddInput['harness'])=>Promise<void>}, input:LoginAddInput & {signin?:boolean}):Promise<{pending:LoginSignIn;nativeHost?:Host;plan:{name:string;host:string;command:string;args:string[]}}> {
 if(input.signin&&!o.snapshots)throw Error('login snapshots unavailable');
 const existing=input.signin&&input.name?o.records.logins.get(input.name):null;
 if(input.signin&&(!existing||existing.kind!=='disk'))throw Error('sign-in requires an existing disk login');
 const binding=existing?o.records.logins.signInBinding(existing.name):undefined,writer=binding?.writer;
 if(binding?.any&&!writer)throw Error('sign-in writer host unavailable');
 if(writer){const pool=o.records.provisions.get(writer.host)?.pool;if(!pool)throw Error('sign-in writer pool unavailable');input={...input,pool};}
 else if(existing?.storage)input={...input,pool:existing.storage.pool};
 const names=Object.keys(o.pools),pool=input.pool??(names.includes('agents')?'agents':names.length===1?names[0]:undefined);
 if(!pool||!Object.hasOwn(o.pools,pool))throw Error('choose a configured host pool');
 const settings=o.pools[pool]!;
 assertPaidTerms(input.expectedTerms, { pool: hostPoolDocument(settings) });
 if(existing?.kind==='disk'&&(existing.provider!==settings.provider||existing.region!==settings.region))throw Error('sign-in pool does not match login');
 const admission=existing?o.records.logins.beginSignIn(existing.name):undefined;
 const admitted=existing?o.records.logins.get(existing.name)!:reserveDiskLogin({logins:o.records.logins,harness:input.harness,name:input.name,account:input.account,providerName:settings.provider,region:settings.region});
 let nativeStarted=false,unpin=()=>{};
 try {
 const current=()=>[...o.records.provisions.active()].filter(row=>row.pool===pool);
 const ready=()=>current().find(row=>row.state==='ready'&&(!writer||row.id===writer.host));
 if(writer&&!ready())throw Error('sign-in writer host is not ready');
 if(!ready()) {
  if(current().some(row=>['creating','booting','connecting','cloning'].includes(row.state))) {
   await new Promise<void>((resolve,reject)=>{
    const done=(error?:Error)=>{unsubscribe();o.clock.clearTimeout(timer);o.signal.removeEventListener('abort',abort);error?reject(error):resolve();};
    const check=()=>{if(ready())done();else if(!current().some(row=>['creating','booting','connecting','cloning'].includes(row.state)))done(Error('pool host boot failed'));};
    const abort=()=>done(Error('login host preparation stopped'));
    const unsubscribe=o.records.provisions.onChange(check);
    const timer=o.clock.setTimeout(()=>done(Error('login host readiness timed out')),300000);
    o.signal.addEventListener('abort',abort,{once:true});
    if(o.signal.aborted)abort();else check();
   });
  } else {
   if(o.records.provisions.occupied(pool)>=settings.maxHosts)throw Error(`pool ${pool} reached max_hosts ${settings.maxHosts}`);
   await o.createHost(pool);
  }
 }
 o.signal.throwIfAborted();
 const record=ready();
 if(!record?.machine)throw Error('pool has no ready host');
 const host=o.hosts.find(host=>host.name===record.id),registration=o.records.get(record.id);
 if(!host||!registration)throw Error('ready host is unavailable');
 if(!o.runner&&!host.loginDisk)throw Error('host does not support login-disk');
 const args=['-t',...sshConnectionArguments(o.root,registration),'-o','ControlPath=none','-o','ControlMaster=no','-o','ClearAllForwardings=yes',`${registration.user}@${registration.address}`];
 const provider=new HostProviderRegistry({env:o.env,now:()=>o.clock.now().getTime(),digitalocean:{root:o.root,clock:o.clock,pool}}).resolve(settings);
 const name=admitted.name;
 const captured=JSON.stringify({machine:record.machine,provider:record.provider,pool:record.pool,created:record.created,registration});
 const identity=snapshotHostIdentity(record.machine,record.created,registration);
 const authorizeCleanup=()=>{
  const live=o.records.provisions.get(record.id),registered=o.records.get(record.id);
  if(!live||!o.hosts.includes(host)||JSON.stringify({machine:live.machine,provider:live.provider,pool:live.pool,created:live.created,registration:registered})!==captured)throw Error('login host identity changed');
 };
 const authorize=()=>{
  o.signal.throwIfAborted();
  const live=o.records.provisions.get(record.id),registered=o.records.get(record.id);
  if(live?.state!=='ready'||registered?.state!=='registered'||!o.hosts.includes(host)||JSON.stringify({machine:live.machine,provider:live.provider,pool:live.pool,created:live.created,registration:registered})!==captured)throw Error('login host readiness or identity changed');
  if(admission)o.records.logins.assertSignInAdmission(admitted.name,admission);
  if(binding)o.records.logins.assertSignInBinding(admitted.name,binding);
 };
 authorize();if(admission)o.records.logins.captureSignInHost(name,admission,{id:record.id,machine:record.machine,identity});unpin=o.pinHost?.(record.id)??(()=>{});nativeStarted=true;
 const pending=await (async()=>{
  if(writer&&admission){
   const inventory=await provider.listVolumes({project:o.root});authorize();
   const volume=inventory.state==='listed'?inventory.volumes.find(v=>v.id===writer.volumeId):undefined;
   if(!volume||volume.attachedTo!==record.machine!.id)throw Error('sign-in writer volume identity changed');
   return prepareExistingLoginSignIn({logins:o.records.logins,name,provider,host,volume,machine:record.machine!,identity,clock:o.clock,snapshots:o.snapshots!,authorize,authorizeCleanup,admission,...(o.afterSignIn?{afterSignIn:o.afterSignIn}:{})});
  }
  return (o.runner??prepareLoginSignIn)({logins:o.records.logins,provider,host,machine:record.machine!,identity,project:o.root,tag:projectTag(o.root,o.root),region:settings.region,providerName:settings.provider,pool,harness:input.harness,name,account:input.account,clock:o.clock,admitted,authorize,authorizeCleanup,...(o.afterSignIn?{afterSignIn:o.afterSignIn}:{}),...(o.snapshots?{snapshots:o.snapshots}:{}),...(admission?{admission}:{})});
 })();
 const complete=pending.complete.bind(pending);
 pending.complete=code=>complete(code).finally(()=>{if(o.records.logins.get(name)?.state!=='creating')unpin();});
 if(pending.interrupt){const interrupt=pending.interrupt.bind(pending);pending.interrupt=()=>interrupt().finally(()=>{if(o.records.logins.get(name)?.state!=='creating')unpin();});}
 try{authorize();}catch(error){await (pending.interrupt?.()??pending.complete(null));throw error;}
 return {pending,nativeHost:host,plan:{name:pending.name,host:record.id,command:'ssh',args:[...args,loginSignInCommand(input.harness,pending.path)]}};
 } catch(error) {
  if(!nativeStarted&&o.records.logins.get(admitted.name)?.state==='creating')o.records.logins.markSignedOut(admitted.name,{reason:'sign-in failed',host:null});
  if(o.records.logins.get(admitted.name)?.state!=='creating')unpin();
  throw error;
 }
}
