import type { Clock } from '../hub/clock.ts';

/** Lifecycle polling uses the owner's clock and releases its timer on cancellation. */
export function clockDelay(clock:Clock, ms:number, signal?:AbortSignal):Promise<void> {
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(signal.reason);return;}
  const abort=()=>{clock.clearTimeout(timer);reject(signal?.reason);};
  const timer=clock.setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
  signal?.addEventListener('abort',abort,{once:true});
 });
}
