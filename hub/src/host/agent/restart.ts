import { observeProcesses } from './native.ts';
import type { Observation } from './native.ts';
/** The supervisor supplies the birth captured from its own direct native launch,
 * never a persisted agent.pid or caller-selected worker. */
export async function signalAgentChild(pid:number,birth:string,env:NodeJS.ProcessEnv,observe=(pid:number)=>observeProcesses([pid],env).then(rows=>rows.get(pid)),signal:(pid:number)=>void=(pid:number)=>{process.kill(pid,'SIGTERM');}):Promise<boolean> {
  if(!Number.isSafeInteger(pid)||pid<=1||!birth)return false;
  const current:Observation|undefined=await observe(pid);
  if(!current||current.ended||current.identity!==birth)return false;
  signal(pid);return true;
}
