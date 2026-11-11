import { prepareLoginSignIn, reserveDiskLogin, loginSignInCommand, type LoginAddInput } from './login-signin.ts';
import { HostProviderRegistry } from './provider/registry.ts';
import { projectTag } from '../executor/droplet/droplet.ts';
import { sshConnectionArguments } from '../transport/ssh.ts';
import type { HostRecords } from './records.ts';
import type { HostPools } from './pools.ts';
import type { Host } from './host.ts';
import type { Clock } from '../hub/clock.ts';

/** Reuse any ready host, including full hosts; join a boot already admitted. */
export async function preparePoolLogin(o:{root:string;env:NodeJS.ProcessEnv;pools:HostPools['pools'];records:HostRecords;hosts:readonly Host[];clock:Clock;signal:AbortSignal;createHost:(pool:string)=>Promise<unknown>;runner?:typeof prepareLoginSignIn;pinHost?:(id:string)=>()=>void}, input:LoginAddInput) {
 const names=Object.keys(o.pools),pool=input.pool??(names.includes('agents')?'agents':names.length===1?names[0]:undefined);
 if(!pool||!Object.hasOwn(o.pools,pool))throw Error('choose a configured host pool');
 const settings=o.pools[pool]!;
 const admitted=reserveDiskLogin({logins:o.records.logins,harness:input.harness,name:input.name,account:input.account,providerName:settings.provider,region:settings.region});
 let nativeStarted=false,unpin=()=>{};
 try {
 const current=()=>[...o.records.provisions.active()].filter(row=>row.pool===pool);
 const ready=()=>current().find(row=>row.state==='ready');
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
 const authorize=()=>{
  o.signal.throwIfAborted();
  const live=o.records.provisions.get(record.id),registered=o.records.get(record.id);
  if(live?.state!=='ready'||registered?.state!=='registered'||!o.hosts.includes(host)||JSON.stringify({machine:live.machine,provider:live.provider,pool:live.pool,created:live.created,registration:registered})!==captured)throw Error('login host readiness or identity changed');
 };
 authorize();unpin=o.pinHost?.(record.id)??(()=>{});nativeStarted=true;
 const pending=await (o.runner??prepareLoginSignIn)({logins:o.records.logins,provider,host,machine:record.machine,project:o.root,tag:projectTag(o.root,o.root),region:settings.region,providerName:settings.provider,pool,harness:input.harness,name,account:input.account,clock:o.clock,admitted,authorize});
 const complete=pending.complete.bind(pending);
 pending.complete=code=>complete(code).finally(()=>{if(o.records.logins.get(name)?.state!=='creating')unpin();});
 try{authorize();}catch(error){await pending.complete(null);throw error;}
 return {pending,plan:{name:pending.name,host:record.id,command:'ssh',args:[...args,loginSignInCommand(input.harness,pending.path)]}};
 } catch(error) {
  if(!nativeStarted&&o.records.logins.get(admitted.name)?.state==='creating')o.records.logins.markSignedOut(admitted.name,{reason:'sign-in failed',host:null});
  if(o.records.logins.get(admitted.name)?.state!=='creating')unpin();
  throw error;
 }
}
