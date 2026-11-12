import {setImmediate as yieldLoop} from 'node:timers/promises';
import type {RemoteVia} from '../protocol.ts';
import type {RemoteIngress} from './ingress.ts';
import type {RemoteState} from './state.ts';
import {realClock,type Clock,type ClockTimer} from '../hub/clock.ts';
type Options={state:Pick<RemoteState,'forMessenger'>;clock?:Clock;perform:(via:RemoteVia,ingress:RemoteIngress)=>Promise<void>;report?:()=>void};

/** Active indexed obligations admitted with the answer before its reply.
 * Recovery and retries never need the native update or its answer text again. */
export class SecretAnswerCleanupOwner {
 readonly #o:Options;
 readonly #clock:Clock;
 readonly #work=new Map<string,Promise<void>>();
 readonly #timers=new Map<string,ClockTimer>();
 readonly #failures=new Map<string,unknown>();
 #recovery:Promise<void>|undefined;
 #stopped=false;
 constructor(o:Options){this.#o=o;this.#clock=o.clock??realClock;}
 start(vias:readonly RemoteVia[]):void{
  if(this.#recovery)return;
  const cuts=[...new Set(vias)].map(via=>({via,through:this.#o.state.forMessenger(via).secretAnswersThrough()}));
  this.#recovery=(async()=>{
   await yieldLoop();
   for(const {via,through} of cuts){
    let after=0;
    while(!this.#stopped){const page=this.#o.state.forMessenger(via).secretAnswersPage(after,through);if(!page.length)break;
     await Promise.allSettled(page.map(row=>this.run(via,row.id)));after=page.at(-1)!.seq;await yieldLoop();
    }
   }
  })().catch(error=>{this.#failures.set('recovery',error);this.#o.report?.();});
 }
 run(via:RemoteVia,id:string):Promise<void>{
  if(this.#stopped)return Promise.resolve();
  const key=JSON.stringify([via,id]),prior=this.#work.get(key);if(prior)return prior;
  const state=this.#o.state.forMessenger(via),row=state.secretAnswerCleanup(id);if(!row)return Promise.resolve();
  const schedule=(at:number)=>{
   if(this.#stopped||this.#timers.has(key))return;
   this.#timers.set(key,this.#clock.setTimeout(()=>{this.#timers.delete(key);void this.run(via,id).catch(()=>{});},Math.max(1,at-this.#clock.now().getTime())));
  };
  if(row.nextAt>this.#clock.now().getTime()){schedule(row.nextAt);return Promise.resolve();}
  const work=Promise.resolve().then(async()=>{
   try{await this.#o.perform(via,row.ingress);}
   catch{
    const next=this.#clock.now().getTime()+Math.min(30000,1000*2**Math.min(row.attempts,5));
    state.retrySecretAnswer(row,next);schedule(next);this.#o.report?.();return;
   }
   state.finishSecretAnswer(row);this.#failures.delete(key);
  }).catch(error=>{this.#failures.set(key,error);this.#o.report?.();throw error;}).finally(()=>{this.#work.delete(key);});
  this.#work.set(key,work);return work;
 }
 async stop():Promise<void>{
  this.#stopped=true;for(const timer of this.#timers.values())this.#clock.clearTimeout(timer);this.#timers.clear();
  await this.#recovery;
  while(this.#work.size)await Promise.allSettled([...this.#work.values()]);
  if(this.#failures.size)throw new AggregateError([...this.#failures.values()],'secret answer cleanup incomplete');
 }
}
