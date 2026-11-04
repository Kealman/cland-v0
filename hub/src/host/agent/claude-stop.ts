import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { observeProcesses, type Observation } from './native.ts';
import type { ProcessTarget } from './processes.ts';
const exec=promisify(execFile);
type Facts={snapshot:()=>Promise<ClaudeStopMember[]>;observe:typeof observeProcesses;now:()=>number;pause:()=>Promise<void>;diagnostic:(reason:string)=>void;admission:ClaudeStopAdmission};
export type ClaudeStopMember={pid:number;parent:number;group:number;uid:number};
export type ClaudeStopAdmission={readonly initial:ReadonlySet<number>;take():boolean};
/** Created inside one admitted stop; neither the budget nor its closure is persisted or transmitted. */
export function claudeStopAdmission(initial:ReadonlySet<number>):ClaudeStopAdmission {
  let available=true;
  return {initial:new Set(initial),take:()=>{if(!available)return false;available=false;return true;}};
}
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
/** One authority rule for pre-signal recapture and post-TERM acquisition. */
export function claudeDescendantCapture(root:ProcessTarget,original:readonly ProcessTarget[],initial:ReadonlySet<number>,rows:readonly ClaudeStopMember[],proof:ReadonlyMap<number,Observation>):{targets:ProcessTarget[]}|{reason:string} {
  const pinned=claudePinnedTargets(original,proof);if(!pinned)return {reason:'captured descendant birth unavailable'};
  const owned=new Map(pinned.map(target=>[target.pid,target])),uid=process.getuid?.();
  if(pinned.some(target=>rows.some(row=>row.pid===target.pid&&row.uid!==uid)))return {reason:'captured process UID differs'};
  const liveRoot=proof.get(root.pid)?.identity===root.identity;
  const anchored=new Set(pinned.map(target=>target.pid));
  let changed=true;
  while(changed){changed=false;for(const row of rows)if(!anchored.has(row.pid)&&anchored.has(row.parent)&&!proof.get(row.pid)?.ended){
    if(!liveRoot)return {reason:'root birth ended before new descendant capture'};
    if(initial.has(row.pid))return {reason:'new descendant was present before stop admission'};
    if(row.uid!==uid)return {reason:'new descendant UID differs'};
    const identity=proof.get(row.pid)?.identity;if(!identity)return {reason:'new descendant birth unavailable'};
    owned.set(row.pid,{pid:row.pid,identity});anchored.add(row.pid);changed=true;
  }}
  if(rows.some(row=>row.group===root.pid&&!owned.has(row.pid)&&!proof.get(row.pid)?.ended))return {reason:'unowned reparented group member remains'};
  return {targets:[...owned.values()]};
}
/** Claude can start SessionEnd writers after TERM. Only live-root ancestry grants new authority. */
export async function stopClaude(root:ProcessTarget,original:readonly ProcessTarget[],env:NodeJS.ProcessEnv,signal:(targets:readonly ProcessTarget[],signal:NodeJS.Signals)=>Promise<boolean>,graceMs=3000, checkpoint:(targets:readonly ProcessTarget[])=>Promise<void>=async()=>{}, facts?:Partial<Facts>):Promise<ProcessTarget[]|null> {
  const snapshot=facts?.snapshot ?? (()=>claudeProcessMembers(env));
  const observe=(pids:number[],environment:NodeJS.ProcessEnv)=>observeClaudeProcesses(pids,environment,facts?.observe),now=facts?.now ?? Date.now;
  const incomplete=(reason:string):null=>{facts?.diagnostic?.(reason);return null;};
  const initialRows=await snapshot(),agentUid=process.getuid?.();
  if(original.some(target=>initialRows.some(row=>row.pid===target.pid&&row.uid!==agentUid)))return incomplete('captured process UID differs');
  let initial=new Set(initialRows.map(row=>row.pid));
  const checkedSignal=async(targets:readonly ProcessTarget[],kind:NodeJS.Signals)=>{const rows=await snapshot();if(targets.some(target=>rows.some(row=>row.pid===target.pid&&row.uid!==agentUid)))return false;return signal(targets,kind);};
  const owned=new Map(original.map(row=>[row.pid,row]));
  const admissionProof=await observe([...owned.keys(),...initialRows.map(row=>row.pid)],env);
  if(admissionProof.get(root.pid)?.identity!==root.identity)return incomplete('root birth ended before stop signals');
  let admission=claudeDescendantCapture(root,original,facts?.admission?.initial??initial,initialRows,admissionProof);
  if('reason' in admission)return incomplete(admission.reason);
  const added=admission.targets.some(target=>!original.some(previous=>previous.pid===target.pid&&previous.identity===target.identity));
  if(added){
    if(!facts?.admission?.take())return incomplete('pre-signal recapture budget already spent');
    const rows=await snapshot(),proof=await observe([...admission.targets.map(target=>target.pid),...rows.map(row=>row.pid)],env);
    if(proof.get(root.pid)?.identity!==root.identity)return incomplete('root birth ended before recapture checkpoint');
    const expected=claudePinnedTargets(admission.targets,proof);
    if(!expected)return incomplete('recapture member birth unavailable');
    const fresh=claudeDescendantCapture(root,admission.targets,facts.admission.initial,rows,proof);
    if('reason' in fresh)return incomplete(fresh.reason);
    if(processTargetKey(fresh.targets)!==processTargetKey(expected))return incomplete('second pre-signal descendant churn');
    admission=fresh;initial=new Set(rows.map(row=>row.pid));
  }
  owned.clear();for(const target of admission.targets)owned.set(target.pid,target);
  if(processTargetKey([...owned.values()])!==processTargetKey(original))await checkpoint([...owned.values()]);
  if(!await checkedSignal([root],'SIGTERM'))return incomplete('root TERM was not confirmed');
  const remaining=async():Promise<ProcessTarget[]|null>=>{
    const rows=await snapshot();
    const proof=await observe([...owned.keys(),...rows.map(row=>row.pid)],env);
    const acquired=claudeDescendantCapture(root,[...owned.values()],initial,rows,proof);
    if('reason' in acquired)return incomplete(acquired.reason);
    const changed=acquired.targets.length!==owned.size||acquired.targets.some(target=>owned.get(target.pid)?.identity!==target.identity);
    owned.clear();for(const target of acquired.targets)owned.set(target.pid,target);
    if(changed)await checkpoint([...owned.values()]);
    return [...owned.values()];
  };
  for(const escalation of [null,'SIGTERM','SIGKILL'] as const){
    let live=await remaining();if(!live)return null;if(!live.length)return [...owned.values()];
    if(escalation){const targets=escalation==='SIGTERM'?live.filter(target=>target.pid!==root.pid):live;if(targets.length&&!await checkedSignal(targets,escalation))return null;}
    const deadline=now()+graceMs;
    while(now()<deadline){
      live=await remaining();if(!live)return null;if(!live.length)return [...owned.values()];
      await (facts?.pause?.() ?? new Promise<void>(resolve=>setTimeout(resolve,10)));
    }
  }
  return null;
}
