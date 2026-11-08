import type { Clock } from '../hub/clock.ts';
import { clockDelay } from './clock-delay.ts';

export const HOST_BOOT_MS = 300000;
export function hostBootMs(env: NodeJS.ProcessEnv): number {
 const value=Number(env.CLAND_TEST_HOST_BOOT_MS);
 return env.CLAND_FAKE_HOST_ROOT && Number.isFinite(value) && value>0 ? Math.min(value,HOST_BOOT_MS) : HOST_BOOT_MS;
}
/** Both provider readiness and the pinned-key probe must succeed before the same deadline. */
export async function hostBootGate(clock:Clock,deadline:number,probe:(remainingMs:number,signal:AbortSignal)=>Promise<void>,signal?:AbortSignal):Promise<void> {
 const abort=new AbortController();
 const scoped=signal?AbortSignal.any([signal,abort.signal]):abort.signal;
 const timeout=()=>Error('pinned-key provisioning gate timed out');
 const timer=clock.setTimeout(()=>abort.abort(timeout()),Math.max(1,deadline-clock.now().getTime()));
 timer.unref();
 let failure='machine has not answered';
 try {
  for (;;) {
   signal?.throwIfAborted();
   if(clock.now().getTime()>=deadline)throw Error('pinned-key provisioning gate timed out: '+failure);
   try {await probe(deadline-clock.now().getTime(),scoped);if(clock.now().getTime()<deadline)return;}
   catch(error){failure=error instanceof Error?error.message:'probe outcome unavailable';}
   signal?.throwIfAborted();
   if(clock.now().getTime()>=deadline)throw Error('pinned-key provisioning gate timed out: '+failure);
   await clockDelay(clock,Math.min(250,deadline-clock.now().getTime()),signal);
  }
 } finally {clock.clearTimeout(timer);}
}

export class HostProviderRetry extends Error { readonly retryAt:string; constructor(reason:string,retryAt:string){super(reason);this.retryAt=retryAt;} }
