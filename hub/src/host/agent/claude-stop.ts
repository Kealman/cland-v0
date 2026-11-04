import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { observeProcesses, type Observation } from './native.ts';
import type { ProcessTarget } from './processes.ts';
const exec=promisify(execFile);
export const CLAUDE_STOP_GRACE_MS=3000;
type Facts={snapshot:()=>Promise<ClaudeStopMember[]>;observe:typeof observeProcesses;now:()=>number;pause:()=>Promise<void>;diagnostic:(reason:string)=>void;admission:ClaudeStopAdmission;unresolved:(reason:string)=>Promise<void>};
export type ClaudeStopMember={pid:number;parent:number;group:number;uid:number};
export type ClaudeStopAdmission={readonly initial:ReadonlySet<number>};
export const processTargetKey=(targets:readonly ProcessTarget[]|undefined)=>(targets??[]).map(target=>`${target.pid}:${target.identity}`).sort().join('|');
/** Unknown is not an exit. One native re-read may resolve it; there is no polling retry. */
export async function observeClaudeProcesses(pids:number[],env:NodeJS.ProcessEnv,observe:typeof observeProcesses=observeProcesses):Promise<Map<number,Observation>> {
  const requested=[...new Set(pids)],proof=await observe(requested,env);
  const unknown=[...proof].filter(([,value])=>!value.identity&&!value.ended).map(([pid])=>pid);
  if(unknown.length){const reread=await observe(unknown,env);for(const pid of unknown){const value=reread.get(pid);if(value)proof.set(pid,value);}}
  return proof;
}
/** A positive exit/replacement settles the old birth and never authorizes its replacement. */
export function claudePinnedTargets(targets:readonly ProcessTarget[],proof:ReadonlyMap<number,Observation>):ProcessTarget[]|null {
  const live:ProcessTarget[]=[];
  for(const target of targets){const observed=proof.get(target.pid);if(observed?.identity===target.identity)live.push(target);else if(!observed?.ended&&!observed?.identity)return null;}
  return live;
}
export async function claudeProcessMembers(env:NodeJS.ProcessEnv,pids?:readonly number[]):Promise<ClaudeStopMember[]> {
  const fields='pid=,ppid=,pgid=,uid=';
  let stdout:string;
  try{stdout=(await exec('ps',pids?['-p',pids.join(','),'-o',fields]:['-axo',fields],{env,timeout:3000,maxBuffer:8*1024*1024})).stdout;}
  catch(error){if((error as {code?:number;stdout?:string}).code===1&&!(error as {stdout?:string}).stdout?.trim())return [];throw error;}
  const members=stdout.trim().split('\n').filter(Boolean).map(line=>{const [pid,parent,group,uid]=line.trim().split(/\s+/).map(Number);return {pid:pid!,parent:parent!,group:group!,uid:uid!};});
  if(members.some(row=>!Number.isSafeInteger(row.pid)||!Number.isSafeInteger(row.uid)))throw new Error('Claude process observation incomplete');
  return members;
}
/** A different live root birth is outside this tree; its numeric PID grants no authority. */
export function claudeRootReplacement(root:ProcessTarget,pid:number,proof:ReadonlyMap<number,Observation>):boolean {
  const identity=proof.get(pid)?.identity;
  return pid===root.pid&&!!identity&&identity!==root.identity;
}
/** Only observed parent chains through pinned live births grant new descendant authority. */
export function claudeDescendantCapture(root:ProcessTarget,original:readonly ProcessTarget[],initial:ReadonlySet<number>,rows:readonly ClaudeStopMember[],proof:ReadonlyMap<number,Observation>):{targets:ProcessTarget[]}|{reason:string} {
  const pinned=claudePinnedTargets(original,proof);if(!pinned)return {reason:'captured descendant birth unavailable'};
  const owned=new Map(pinned.map(target=>[target.pid,target])),uid=process.getuid?.();
  if(pinned.some(target=>rows.some(row=>row.pid===target.pid&&row.uid!==uid)))return {reason:'captured process UID differs'};
  const anchored=new Set(pinned.map(target=>target.pid));
  let changed=true;
  while(changed){changed=false;for(const row of rows)if(!anchored.has(row.pid)&&anchored.has(row.parent)&&!proof.get(row.pid)?.ended){
    if(initial.has(row.pid))return {reason:'new descendant was present before stop admission'};
    if(row.uid!==uid)return {reason:'new descendant UID differs'};
    const identity=proof.get(row.pid)?.identity;if(!identity)return {reason:'new descendant birth unavailable'};
    owned.set(row.pid,{pid:row.pid,identity});anchored.add(row.pid);changed=true;
  }}
  if(rows.some(row=>row.group===root.pid&&!owned.has(row.pid)&&!proof.get(row.pid)?.ended&&!claudeRootReplacement(root,row.pid,proof)))return {reason:'unowned reparented group member remains'};
  return {targets:[...owned.values()]};
}
/** Stop the pinned spawner, converge on owned births, then join every writer within the stop deadline. */
export async function stopClaude(root:ProcessTarget,original:readonly ProcessTarget[],env:NodeJS.ProcessEnv,signal:(targets:readonly ProcessTarget[],signal:NodeJS.Signals)=>Promise<boolean>,graceMs=CLAUDE_STOP_GRACE_MS, checkpoint:(targets:readonly ProcessTarget[])=>Promise<void>=async()=>{}, facts?:Partial<Facts>):Promise<ProcessTarget[]|null> {
  const snapshot=facts?.snapshot ?? (()=>claudeProcessMembers(env));
  const observe=(pids:number[],environment:NodeJS.ProcessEnv)=>observeClaudeProcesses(pids,environment,facts?.observe),now=facts?.now ?? Date.now;
  const incomplete=(reason:string):null=>{facts?.diagnostic?.(reason);return null;};
  const deadline=now()+3*graceMs;
  const initialRows=await snapshot(),agentUid=process.getuid?.();
  if(original.some(target=>initialRows.some(row=>row.pid===target.pid&&row.uid!==agentUid)))return incomplete('captured process UID differs');
  const initial=facts?.admission?.initial??new Set(initialRows.map(row=>row.pid));
  const checkedSignal=async(targets:readonly ProcessTarget[],kind:NodeJS.Signals)=>{const rows=await snapshot();if(now()>=deadline)return false;if(targets.some(target=>rows.some(row=>row.pid===target.pid&&row.uid!==agentUid)))return false;return signal(targets,kind);};
  const owned=new Map(original.map(row=>[row.pid,row]));
  const admissionProof=await observe([...owned.keys(),root.pid],env);
  const rootProof=admissionProof.get(root.pid);
  const pins=claudePinnedTargets(original,admissionProof);
  if(!pins)return incomplete('captured descendant birth unavailable');
  const rootLive=rootProof?.identity===root.identity;
  if(!rootLive&&(!rootProof?.ended&&!rootProof?.identity||!pins.some(target=>target.pid!==root.pid)))return incomplete('root birth unavailable without retained live descendants');
  owned.clear();for(const target of pins)owned.set(target.pid,target);
  if(processTargetKey(pins)!==processTargetKey(original))await checkpoint(pins);
  // A retry retains exact child births after positive root exit/replacement; never signal its replacement.
  if(rootLive&&!await checkedSignal([root],'SIGTERM'))return incomplete('root TERM was not confirmed');
  const remaining=async():Promise<ProcessTarget[]|null>=>{
    const rows=await snapshot();
    const proof=await observe([...owned.keys(),...rows.map(row=>row.pid)],env);
    const acquired=claudeDescendantCapture(root,[...owned.values()],initial,rows,proof);
    if('reason' in acquired){
      await facts?.unresolved?.(acquired.reason);
      return incomplete(acquired.reason);
    }
    const changed=acquired.targets.length!==owned.size||acquired.targets.some(target=>owned.get(target.pid)?.identity!==target.identity);
    owned.clear();for(const target of acquired.targets)owned.set(target.pid,target);
    if(changed)await checkpoint([...owned.values()]);
    return [...owned.values()];
  };
  // Each phase shares the existing total stop bound; no recapture count fences a busy root.
  let previous:string|undefined;
  for(const escalation of [null,'SIGTERM','SIGKILL'] as const){
    const phaseDeadline=Math.min(deadline,now()+graceMs);
    let signalled:string|undefined;
    while(now()<phaseDeadline){
      const live=await remaining();if(!live)return null;
      if(now()>=deadline)return incomplete('stop deadline expired during capture');
      const key=processTargetKey(live),stable=key===previous;previous=key;
      if(!live.length&&!stable)continue;
      if(stable){
        if(!live.length)return [];
        if(escalation&&signalled!==key){
          const targets=escalation==='SIGTERM'?live.filter(target=>target.pid!==root.pid):live;
          if(targets.length&&!await checkedSignal(targets,escalation))return incomplete('descendant signal was not confirmed');
          signalled=key;continue;
        }
      }
      await (facts?.pause?.() ?? new Promise<void>(resolve=>setTimeout(resolve,10)));
    }
  }
  return incomplete('stop deadline expired before stable tree closure');
}
