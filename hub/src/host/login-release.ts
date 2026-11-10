import { LoginReleaseOwner } from './login-release-owner.ts';
import { fenceLostLoginRelease } from './login-snapshots.ts';
import { realClock, type Clock } from '../hub/clock.ts';
import type { HostRecords } from './records.ts';
import type { Host } from './host.ts';
import type { HostProvider, Machine } from './provider/provider.ts';
import { loginMount } from './login-binding.ts';
import { deleteReaderVolume, recoverReaderCreation } from './login-reader.ts';
export type LoginReleaseHooks={clock?:Clock;retry?:(id:string)=>Promise<unknown>;host:(id:string)=>Host|undefined;beginRelease:(name:string,options?:{hostLost?:boolean})=>Promise<void>;onReleased:(name:string,receipt:{volumeId:string})=>void;notice:(text:string)=>void};
const owners=new WeakMap<HostRecords,LoginReleaseOwner>();
const notices=new WeakMap<HostRecords,Set<string>>();
export function installLoginRelease(records:HostRecords,hooks:LoginReleaseHooks):LoginReleaseOwner {const owner=new LoginReleaseOwner(records,hooks);owners.set(records,owner);return owner;}
export function trackLoginRelease<T>(records:HostRecords,work:Promise<T>):Promise<T>{return owners.get(records)?.track(work)??work;}
/** Fences every disk before native work; joins every parallel release even on refusal. */
export async function releaseHostLogins(input:{records:HostRecords;id:string;root:string;provider:HostProvider;machine:Machine;lost?:boolean;clock?:Clock}):Promise<()=>Promise<void>> {
 const {records,id,provider,machine}=input,owner=owners.get(records),hooks=owner?.hooks;
 const hostBindings=records.logins.forHost(id);
 for(const operation of records.logins.readersForHost(id))if(operation.phase==='creating'||(operation.phase==='deleting'||operation.phase==='deleted')&&!hostBindings.some(binding=>binding.login===operation.login)){
  try{
  if(operation.provider!==records.provisions.get(id)?.provider&&records.provisions.get(id))throw Error('reader provider ownership changed');
  if(operation.machine.id!==machine.id||operation.machine.created!==machine.created||operation.project!==input.root)throw Error('reader machine ownership changed');
  if(operation.phase==='creating')await recoverReaderCreation(records.logins,operation,provider);
  else await deleteReaderVolume(records.logins,operation,provider);
  }catch(error){owner?.schedule(id);throw error;}
 }
 const bindings=hostBindings.filter(binding=>binding.phase!=='pending');
 const disks=bindings.flatMap(binding=>{const login=records.logins.get(binding.login);return login?.kind==='disk'?[{binding,login}]:[];});
 const report=(name:string,deleted=false)=>{let seen=notices.get(records);if(!seen){seen=new Set();notices.set(records,seen);}const base=id+':'+name;if(deleted&&seen.has(base))return;const key=base+(deleted?':detach':'');if(!seen.has(key)){seen.add(key);hooks?.notice(deleted?`host ${id}: deletion confirmed; login ${name} detach unconfirmed; binding retained`:`host ${id}: login ${name} release unconfirmed; host and binding retained`);}};
 const lost=input.lost===true||(disks.length>0&&(await provider.status(machine)).state==='gone')||!!hooks&&(()=>{const host=hooks.host(id);return !host||host.loginDiskReachable?.()===false;})();
 const finishReader=async(binding:(typeof bindings)[number],login:(typeof disks)[number]['login'],volume?:import('./provider/provider.ts').Volume)=>{
  let operation=records.logins.readerOperation(login.name,id);
  if(operation?.phase!=='deleting'&&operation?.phase!=='deleted'){
   if(!volume)throw Error('reader detach receipt missing');
   if(!operation){
    operation={login:login.name,host:id,harness:login.harness,provider:login.provider,region:login.region,project:input.root,pool:records.provisions.get(id)?.pool??'',machine,name:volume.name,snapshot:'',phase:'creating'};
    records.logins.beginReader(operation);
   }
   if(binding.volumeId!==volume.id)throw Error('reader volume identity changed');
   operation={...operation,volume,phase:'deleting'};records.logins.saveReader(operation);
  }
  await deleteReaderVolume(records.logins,operation,provider);
 };
 const fences=await Promise.allSettled(disks.map(async({binding,login})=>{
  if(binding.role==='reader')return;
  try {if(!hooks){if(!lost)throw Error('login release owner unavailable');fenceLostLoginRelease(records.logins,login.name,(input.clock??realClock).now().getTime());}else await hooks.beginRelease(login.name,{hostLost:lost});}
  catch(error){report(login.name);throw error;}
 }));
 if(fences.some(result=>result.status==='rejected'))throw Error('login release unconfirmed');
 const results=await Promise.allSettled(disks.map(async({binding,login})=>{
  try {
   if(lost)return;
   if(!hooks)throw Error('login release owner unavailable');
   const retained=records.logins.readerOperation(login.name,id);
   if(binding.role==='reader'&&(retained?.phase==='deleting'||retained?.phase==='deleted')){await finishReader(binding,login);return;}
   const host=hooks.host(id);
   if(!host?.loginDisk)throw Error('login-disk unavailable');
   const inventory=await provider.listVolumes({project:input.root});
   const volume=inventory.state==='listed'?inventory.volumes.find(v=>v.id===binding.volumeId):undefined;
   if(!volume)throw Error('login volume unavailable');
   await host.loginDisk({op:'umount',volume:volume.name,path:loginMount(login)});
   if((await provider.detachVolume(volume,machine)).state!=='detached')throw Error('login detach unconfirmed');
   if(binding.role==='reader'){await finishReader(binding,login,volume);return;}
   records.logins.unbind(login.name,id);
   if(records.logins.get(login.name)?.state==='ready')hooks.onReleased(login.name,{volumeId:login.volumeId!});
  }catch(error){report(login.name);throw error;}
 }));
 if(results.some(result=>result.status==='rejected'))throw Error('login release unconfirmed');
 return async()=>{
  if(!lost||!disks.length||!hooks)return;
  const inventory=await provider.listVolumes({project:input.root}).catch(()=>({state:'failed' as const,reason:'login volume inventory unavailable'}));
  let incomplete=false;
  for(const {binding,login} of disks){
   const retained=records.logins.readerOperation(login.name,id);
   if(binding.role==='reader'&&(retained?.phase==='deleting'||retained?.phase==='deleted')){
    try{await finishReader(binding,login);}catch{incomplete=true;report(login.name,true);}continue;
   }
   const volume=inventory.state==='listed'?inventory.volumes.find(v=>v.id===binding.volumeId):undefined;
   if(!volume||volume.attachedTo!==null){incomplete=true;report(login.name,true);continue;}
   if(binding.role==='reader'){
    try{await finishReader(binding,login,volume);}catch{incomplete=true;report(login.name,true);}continue;
   }
   records.logins.unbind(login.name,id);
   if(records.logins.get(login.name)?.state==='ready')hooks!.onReleased(login.name,{volumeId:login.volumeId!});
   const seen=notices.get(records),key=id+':'+login.name;
   if(seen?.has(key)&&!seen.has(key+':destroyed')){seen.add(key+':destroyed');hooks!.notice(`host ${id}: login ${login.name} detached after deadline destruction; binding cleared`);}
  }
  if(incomplete){owner?.schedule(id);throw Error('login detach unconfirmed');}
 };
}
