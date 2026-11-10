import type {HostRecords} from './records.ts';
import type {Clock,ClockTimer} from '../hub/clock.ts';
import type {LoginReleaseHooks} from './login-release.ts';
import {hasLoginReleaseObligation,hasReaderReleaseObligation} from './login-release-policy.ts';
export const LOGIN_RELEASE_RETRY_MS=1000;
export const LOGIN_RELEASE_RETRY_MAX_MS=30000;
/** One in-flight retry per host. Persisted deletion receipts seed bounded recovery. */
export class LoginReleaseOwner {
 readonly hooks:LoginReleaseHooks;
 readonly #records:HostRecords;
 readonly #timers=new Map<string,ClockTimer>();
 readonly #attempts=new Map<string,number>();
 readonly #work=new Set<Promise<unknown>>();
 readonly #recovery:Promise<void>;
 readonly #removeReaderRelease:()=>void;
 #closed=false;
 constructor(records:HostRecords,hooks:LoginReleaseHooks){
  this.#records=records;this.hooks=hooks;this.#removeReaderRelease=records.logins.onReaderRelease(hooks.onReleased);this.#recovery=this.#recover();
 }
 async #recover():Promise<void>{
  if(!this.hooks.retry||!this.hooks.clock)return;
  let after='';
  while(!this.#closed){
   const hosts=this.#records.logins.boundHosts(after,64);
   for(const id of hosts){const provision=this.#records.provisions.get(id);if(provision?.machineDeletionRead||provision&&['destroying','destroyed','failed'].includes(provision.state)&&hasReaderReleaseObligation(this.#records,id))this.schedule(id);}
   if(hosts.length<64)return;
   after=hosts.at(-1)!;await Promise.resolve();
  }
 }
 track<T>(work:Promise<T>):Promise<T>{
  this.#work.add(work);void work.finally(()=>this.#work.delete(work)).catch(()=>{});return work;
 }
 schedule(id:string):void {
  const {clock,retry}=this.hooks;
  if(this.#closed||!clock||!retry||this.#timers.has(id))return;
  const attempt=this.#attempts.get(id)??0;this.#attempts.set(id,attempt+1);
  const delay=Math.min(LOGIN_RELEASE_RETRY_MAX_MS,LOGIN_RELEASE_RETRY_MS*2**Math.min(attempt,5));
  const timer=clock.setTimeout(()=>{
   this.#timers.delete(id);
   const work=Promise.resolve().then(()=>retry(id)).catch(()=>{}).finally(()=>{
    if(this.#records.provisions.get(id)?.state==='destroyed'&&!hasLoginReleaseObligation(this.#records,id))this.#attempts.delete(id);
    else this.schedule(id);
   });
   this.track(work);
  },delay);timer.unref();this.#timers.set(id,timer);
 }
 async close():Promise<void>{
  this.#closed=true;for(const timer of this.#timers.values())this.hooks.clock!.clearTimeout(timer);this.#timers.clear();
  await this.#recovery;await Promise.allSettled([...this.#work]);
  this.#removeReaderRelease();
 }
}
