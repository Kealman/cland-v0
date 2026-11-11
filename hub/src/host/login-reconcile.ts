import type {HostRecords} from './records.ts';
import type {Clock,ClockTimer} from '../hub/clock.ts';
import type {HostProvider,Volume} from './provider/provider.ts';
import type {Login,LoginBinding} from './logins.ts';
import {releaseDetachedLoginBinding} from './login-release.ts';

type Options={root:string;records:HostRecords;clock:Clock;provider:(name:string)=>HostProvider;notice:(text:string)=>void;log:(entry:Record<string,unknown>)=>void};
type Candidate={disk:Extract<Login,{kind:'disk'}>;version:string|null;binding?:LoginBinding;episode?:string|null};
const diskIdentity=(row:Login)=>{const {backup:_backup,storage:_storage,...rest}=row as Extract<Login,{kind:'disk'}>;return JSON.stringify(rest);};
/** Candidate pages precede each provider read. A private store revision fences
 * stale inventory, including same-clock sign-in/rebind episodes. */
export class LoginReconciliation {
 private work:Promise<void>|undefined;
 private timer:ClockTimer|undefined;
 private closed=false;
 private readonly noticed=new Set<string>();
 private readonly unmatched=new Set<string>();
 private readonly options:Options;
 constructor(options:Options){this.options=options;}
 start():Promise<void>{
  if(this.closed)return Promise.resolve();if(this.work)return this.work;
  const work=this.pass();this.work=work;
  void work.finally(()=>{this.work=undefined;}).catch(()=>{});return work;
 }
 private async page(candidates:Candidate[]):Promise<boolean>{
  const o=this.options,r=o.records.logins;let retry=false;
  for(const name of new Set(candidates.map(c=>c.disk.provider))){
   let provider:HostProvider,listed:Volume[];
   try{
    provider=o.provider(name);const inventory=await provider.listVolumes({project:o.root});
    if(inventory.state!=='listed')throw Error('volume inventory unavailable');listed=inventory.volumes;
   }catch{
    retry=true;if(!this.noticed.has(name)){this.noticed.add(name);o.notice(`login reconciliation: ${name} volume inventory unavailable; logins unchanged, retry pending`);}continue;
   }
   const volumes=new Map(listed.map(v=>[v.id,v]));
   for(const volume of listed){
    const key=JSON.stringify([name,volume.id]);
    if(!this.unmatched.has(key)&&!r.hasVolume(name,volume.id)){this.unmatched.add(key);o.log({event:'login-reconcile-unmatched-volume',provider:name,volume:volume.id});}
   }
   for(const candidate of candidates){
    const {disk,binding}=candidate;if(disk.provider!==name)continue;
    const current=r.get(disk.name);
    const unchanged=binding
     ?current&&diskIdentity(current)===diskIdentity(disk)&&r.bindingEpisode(binding.login,binding.host)===candidate.episode
     :r.reconciliationVersion(disk.name)===candidate.version;
    if(!unchanged){retry=true;continue;}
    if(r.hasPendingBinding(disk.name))continue;
    if(!binding){
     if(!disk.volumeId||!volumes.has(disk.volumeId))r.markSignedOut(disk.name,{reason:'volume missing',host:null});
     continue;
    }
    const retained=binding.role==='reader'?r.readerOperation(binding.login,binding.host):null;
    // A persisted deleting intent already owns a positive detach boundary. List
    // omission still needs the reader owner's exact-id deletion confirmation.
    const volume=(binding.volumeId?volumes.get(binding.volumeId):undefined)
     ??(retained?.phase==='deleting'&&retained.volume?{...retained.volume,attachedTo:null}:undefined);
    const host=o.records.provisions.get(binding.host);
    const gone=!host||['destroyed','destroying','failed'].includes(host.state)||!!host.machineDeletionRead;
    if(!volume||volume.attachedTo!==null){if(gone)retry=true;continue;}
    try{
     await releaseDetachedLoginBinding({records:o.records,binding,episode:candidate.episode!,volume,provider,root:o.root});
    }catch{o.log({event:'login-reconcile-pending',login:disk.name,host:binding.host});retry=true;}
   }
  }
  return retry;
 }
 private async pass():Promise<void>{
  const r=this.options.records.logins;let retry=false,after='';
  while(!this.closed){
   const disks=[...r.reconciliationDisks(after,64)];if(!disks.length)break;
   retry=await this.page(disks.map(disk=>({disk,version:r.reconciliationVersion(disk.name)})))||retry;after=disks.at(-1)!.name;
  }
  let cursor={login:'',host:''};
  while(!this.closed){
   const bindings=r.reconciliationBindings(cursor,64);if(!bindings.length)break;
   const candidates:Candidate[]=[];
   for(const binding of bindings){const disk=r.get(binding.login);if(disk?.kind==='disk'&&disk.state!=='creating')candidates.push({disk,binding,episode:r.bindingEpisode(binding.login,binding.host),version:r.reconciliationVersion(disk.name)});}
   retry=await this.page(candidates)||retry;const last=bindings.at(-1)!;cursor={login:last.login,host:last.host};
  }
  if(retry&&!this.closed&&!this.timer){this.timer=this.options.clock.setTimeout(()=>{this.timer=undefined;void this.start().catch(error=>this.options.log({event:'login-reconcile-failed',error:String(error)}));},1000);this.timer.unref();}
 }
 async close():Promise<void>{this.closed=true;if(this.timer)this.options.clock.clearTimeout(this.timer);this.timer=undefined;await this.work;}
}
