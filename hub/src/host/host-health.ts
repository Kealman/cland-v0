import { destroyHost } from './provision-host.ts';
import { HostLeasePublicationError } from './host-leases.ts';
import { realClock } from '../hub/clock.ts';
import type { Clock, ClockTimer } from '../hub/clock.ts';
import type { HostRecords } from './records.ts';
import type { MachineStatus } from './provider/provider.ts';

type Options = {
 records:HostRecords; clock:Clock; env:NodeJS.ProcessEnv;
 notice:(text:string)=>void;
 status:(id:string)=>Promise<MachineStatus>;
 lost:(id:string)=>Promise<void>;
 error:(error:unknown)=>void;
};
type Outage = { warning:ClockTimer; terminal?:ClockTimer; settling?:boolean };
/** Owns outage timers and provider reads; tunnel loss alone never exits a session. */
export class HostHealth {
 readonly #o:Options;
 readonly #outages=new Map<string,Outage>();
 readonly #lastCheck=new Map<string,number>();
 readonly #work=new Set<Promise<void>>();
 readonly #unsubscribe:()=>void;
 #closed=false;
 constructor(options:Options){
  this.#o=options;
  this.#unsubscribe=options.records.provisions.onChange((id,_previous,state)=>{
   if(state==='ready'||state==='unreachable')return;
   const outage=this.#outages.get(id);
   options.clock.clearTimeout(outage?.warning);options.clock.clearTimeout(outage?.terminal);
   this.#outages.delete(id);this.#lastCheck.delete(id);
  });
 }
 holds(id:string):boolean{return !this.#closed&&this.#outages.has(id)&&!this.#outages.get(id)!.settling;}
 transition(id:string,up:boolean,at:Date=this.#o.clock.now()):void {
  if(this.#closed)return;
  const o=this.#o,row=o.records.provisions.get(id),outage=this.#outages.get(id);
  if(!row||!['ready','unreachable'].includes(row.state))return;
  if(up){
   if(outage?.settling)return;
   o.clock.clearTimeout(outage?.warning);o.clock.clearTimeout(outage?.terminal);this.#outages.delete(id);
   if(row.state==='unreachable')o.records.provisions.ready({...row,state:'ready'});
   return;
  }
  if(outage)return;
  const bound=(key:string,normal:number)=>{
   const value=Number(o.env[key]);
   return o.env.CLAND_FAKE_HOST_ROOT&&Number.isSafeInteger(value)&&value>0&&value<normal?value:normal;
  };
  const remaining=(duration:number)=>Math.max(1,at.getTime()+duration-o.clock.now().getTime());
  const current:Outage={warning:o.clock.setTimeout(()=>{
   const row=o.records.provisions.get(id);
   if(this.#outages.get(id)!==current||!row||row.state!=='ready')return;
   o.records.provisions.save({...row,state:'unreachable'});
   o.notice(`host ${id} unreachable`);
  },remaining(bound('CLAND_TEST_HOST_UNREACHABLE_MS',180000)))};
  current.warning.unref();this.#outages.set(id,current);
  const lose=()=>{
   if(this.#closed||this.#outages.get(id)!==current||current.settling)return;
   current.settling=true;o.clock.clearTimeout(current.warning);o.clock.clearTimeout(current.terminal);
   this.#own(o.lost(id));
  };
  current.terminal=o.clock.setTimeout(lose,remaining(bound('CLAND_TEST_HOST_LOST_MS',900000)));current.terminal.unref();
  const now=o.clock.now().getTime();
  if(now-(this.#lastCheck.get(id)??-Infinity)>=60000){
   this.#lastCheck.set(id,now);
   this.#own(o.status(id).then(status=>{if(status.state==='gone')lose();}));
  }
 }
 #own(work:Promise<void>):void {const handled=work.catch(this.#o.error).finally(()=>this.#work.delete(handled));this.#work.add(handled);}
 async close():Promise<void>{this.#closed=true;this.#unsubscribe();for(const outage of this.#outages.values()){this.#o.clock.clearTimeout(outage.warning);this.#o.clock.clearTimeout(outage.terminal);}this.#outages.clear();await Promise.all([...this.#work]);}
}

/** Loss owns the primary destroy even when watchdog publication needs a retry. */
export async function loseHost(o:Omit<Parameters<typeof destroyHost>[0],'log'> & {inUse:(id:string)=>boolean;log:(entry:Record<string,unknown>)=>void}) {
 o.log({event:'host-lost',host:o.id,inUse:o.inUse(o.id)});
 try{await o.records.leases.expireNow(o.id,o.root,o.clock??realClock);}
 catch(error){
  if(!(error instanceof HostLeasePublicationError))throw error;
  o.log({event:'host-lease-publication-failed',host:o.id,code:error.code,error:String(error)});
 }
 return destroyHost(o);
}
