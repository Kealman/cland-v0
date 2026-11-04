import { fileURLToPath } from 'node:url';
import { readFile, stat, mkdir, rm } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { checkpoint } from './storage.ts';
import { run, boundedCommandResult, type RunResult } from './command.ts';
import { fileOperations } from './files.ts';
import { refPushEnvironment } from './ref-push.ts';
import { HOST_ORIGIN } from './protocol.ts';
import type { RefPushOwner, PushAdmission } from './ref-push.ts';
export const REF_FLUSH_CAPABILITY = 'ref-flush-v1';
export const REF_WATCH_CAPABILITY = 'ref-watch-v1';
export const REF_WATCH_STATUS_CAPABILITY = 'ref-watch-status-v1';
type Watch = { path:string; branch:string; signature?:string; head?:string; remote?:string; pending?:PushAdmission; result?:RunResult; decision?:string; recovering?:boolean; fences?:PushAdmission[]; fencedCause?:string; removal?:{root:string;dev:number;ino:number} };
type LiveWatch = Watch & { files?:string[]; observed?:string; notice?:string };
type Hooks = { git?:(path:string,args:string[])=>Promise<RunResult>; metadata?:(path:string[])=>Promise<string>; beforePush?:(head:string)=>Promise<void>; beforeCheckpoint?:(rows:Watch[])=>Promise<void>; afterSettlement?:()=>Promise<void> };
/** One projection for direct status and every checkpoint event, including failed peer observations. */
export function refWatchStatuses(rows:Iterable<{path:string;branch:string;fencedCause?:string;pending?:{notice?:string};notice?:string}>){
  return [...rows].map(row=>{const cause=row.fencedCause??row.pending?.notice??row.notice;return {path:row.path,branch:row.branch,state:cause?'fenced':'watching',...(cause?{cause}:{})};});
}
/** Current watch checkpoints, never retained reflog history. One owner serializes admission and settlement. */
export class RefWatches {
  #rows=new Map<string,LiveWatch>();
  #tail:Promise<unknown>=Promise.resolve();
  #timer?:NodeJS.Timeout;
  #closed=false;
  #env:NodeJS.ProcessEnv;
  #runDir:string;
  #emit:(frame:unknown)=>void;
  #owner:RefPushOwner;
  #hooks:Hooks;
  constructor(runDir:string,env:NodeJS.ProcessEnv,emit:(frame:unknown)=>void,owner:RefPushOwner,hooks:Hooks={}) {
    this.#runDir=runDir;this.#env=refPushEnvironment(env,join(runDir,'ref-git-proxy'));this.#emit=emit;this.#owner=owner;this.#hooks=hooks;
  }
  #serial<T>(work:()=>Promise<T>):Promise<T>{const result=this.#tail.then(work);this.#tail=result.catch(()=>{});return result;}
  #git(path:string,args:string[]){return this.#hooks.git?.(path,args)??run('git',['-c','gc.auto=0',...args],this.#env,30000,false,undefined,'utf8',path);}
  #record(row:LiveWatch):Watch {const {path,branch,signature,head,remote,pending,result,decision,recovering,fences,fencedCause,removal}=row;return {path,branch,...(signature===undefined?{}:{signature}),...(head===undefined?{}:{head}),...(remote===undefined?{}:{remote}),...(pending?{pending}:{}),...(result?{result}:{}),...(decision?{decision}:{}),...(recovering?{recovering:true}:{}),...(fences?.length?{fences}:{}),...(fencedCause?{fencedCause}:{}),...(removal?{removal}:{})};}
  async #save(rows=this.#rows.values()){const snapshot=[...rows],records=snapshot.map(row=>this.#record(row));await this.#hooks.beforeCheckpoint?.(records);await checkpoint(join(this.#runDir,'ref-watches.json'),records);this.#emit({event:'ref-watch-status',watches:refWatchStatuses(snapshot)});}
  status(){return refWatchStatuses(this.#rows.values());}
  async #resolve(row:Watch):Promise<string[]> {
    if(!isAbsolute(row.path)||!row.branch.startsWith('t/'))throw new Error('watch requires absolute task worktree path and t/ branch');
    const valid=await this.#git(row.path,['check-ref-format',`refs/heads/${row.branch}`]);
    if(valid.code!==0||valid.error)throw new Error('invalid watch branch');
    const files:string[]=[];
    for(const name of [`refs/heads/${row.branch}`,`logs/refs/heads/${row.branch}`,'packed-refs']) {
      const result=await this.#git(row.path,['rev-parse','--git-path',name]);
      if(result.code!==0||result.error)throw new Error('watch cannot resolve Git metadata');
      files.push(resolve(row.path,result.stdout.trim()));
    }
    return files;
  }
  async start(poll=true){
    const rows:Watch[]=JSON.parse(await readFile(join(this.#runDir,'ref-watches.json'),'utf8').catch(error=>{if(error.code==='ENOENT')return '[]';throw error;}));
    const quote=(value:string)=>"'"+value.replaceAll("'","'\\''")+"'";
    const wrapper=`#!/bin/sh\nexec ${quote(process.execPath)} ${quote(fileURLToPath(new URL('./git-proxy.ts',import.meta.url)))} ${quote(join(this.#runDir,'git.sock'))} \"$@\"\n`;
    await fileOperations.publishFile(join(this.#runDir,'ref-git-proxy'),Buffer.from(wrapper),{mode:0o700,replace:true});
    // Startup only loads current checkpoints. Native resolution/recovery belongs to the background scan.
    for(const row of rows)this.#rows.set(row.path,{...row,recovering:row.recovering||!!row.pending});
    const tick=()=>{if(this.#closed)return;this.#timer=setTimeout(()=>{void this.#serial(()=>this.#scan(false)).catch(()=>{}).finally(tick);},200);this.#timer.unref();};if(poll)tick();
  }
  watch(path:string,branch:string){return this.#serial(async()=>{
    if(this.#closed)throw new Error('watches closed');
    if(this.#rows.get(path)?.branch===branch)return;
    const row={path,branch,files:await this.#resolve({path,branch})};
    const candidate=new Map(this.#rows);candidate.set(path,row);await this.#save(candidate.values());this.#rows=candidate;
  });}
  unwatch(path:string){return this.#serial(async()=>{await this.#drain(path);const candidate=new Map(this.#rows);candidate.delete(path);await this.#save(candidate.values());this.#rows=candidate;});}
  async #removed(row:LiveWatch):Promise<boolean>{
    if(!row.removal)return false;
    const info=await stat(row.path).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
    if(info){if(info.dev!==row.removal.dev||info.ino!==row.removal.ino)throw new Error('worktree replacement retained');return false;}
    const listed=await this.#git(row.removal.root,['worktree','list','--porcelain']);
    if(listed.code!==0||listed.error)throw new Error('worktree removal observation incomplete');
    return !listed.stdout.split('\n').includes(`worktree ${row.path}`);
  }
  /** Directory identity and positive Git-index absence settle checkpoint/reply loss without replaying deletion. */
  remove(path:string,root:string,work:()=>Promise<null>){return this.#serial(async()=>{
    const row=this.#rows.get(path);
    if(!row)return work();
    await this.#drain(path);
    if(!row.removal){const info=await stat(path);row.removal={root,dev:info.dev,ino:info.ino};await this.#save();}
    if(!await this.#removed(row)){
      try{await work();}catch(error){
        if((error as NodeJS.ErrnoException).code!=='CLAND_NATIVE_INCOMPLETE'){delete row.removal;await this.#save();}throw error;
      }
    }
    if(!await this.#removed(row))throw new Error('worktree removal not observed');
    const candidate=new Map(this.#rows);candidate.delete(path);await this.#save(candidate.values());this.#rows=candidate;return null;
  });}
  scan(){return this.#serial(()=>this.#scan(true));}
  flush(path?:string){return this.#serial(async()=>{await this.#scan(true);await this.#drain(path);if(path!==undefined){const row=this.#rows.get(path);if(!row||row.notice||row.fencedCause||row.pending||!row.result||row.result.code!==0||row.result.error)throw new Error(`watch ${path}: ${row?.notice??row?.fencedCause??row?.result?.error??(row?.result?.stderr||`push unconfirmed (exit ${row?.result?.code??'unknown'})`)}`);}});}
  async #drain(path?:string){
    for(const row of this.#rows.values())if(path===undefined||row.path===path){
      for(const fence of row.fences??[]){
        const state=await this.#owner.observe(fence);
        if(state.state!=='gone'&&!await this.#owner.closed?.(fence))throw new Error(`watch ${row.path}: retained producer cleanup incomplete`);
        await rm(join(this.#runDir,'ref-push',fence.id+'.log'),{force:true});await rm(join(this.#runDir,'ref-push',fence.id+'.json'),{force:true});
      }
      if(row.fences?.length){delete row.fences;await this.#save();}
    }
    const deadline=Date.now()+35000;
    while([...this.#rows.values()].some(row=>(path===undefined||row.path===path)&&row.pending)){
      for(const row of this.#rows.values())if((path===undefined||row.path===path)&&row.pending){
        if(!await this.#settle(row)&&row.pending?.notice)throw new Error(`watch ${row.path}: ${row.pending.notice}`);
      }
      if(Date.now()>=deadline)throw new Error('watch push drain incomplete');
      if([...this.#rows.values()].some(row=>(path===undefined||row.path===path)&&row.pending))await new Promise(resolve=>setTimeout(resolve,20));
    }
  }
  #event(row:LiveWatch,head:string,result:RunResult){this.#emit({event:'ref-moved',path:row.path,branch:row.branch,head,result});}
  async #route(row:LiveWatch){
    const origin=await this.#git(row.path,['remote','get-url','--push','--all','origin']);
    const proxy=await this.#git(row.path,['config','core.gitProxy']);
    if(origin.code!==0||origin.stdout.trim()!==HOST_ORIGIN||proxy.code!==0||proxy.stdout.trim()!==join(this.#runDir,'git-proxy'))throw new Error('watch requires owned socket origin and run/git-proxy');
  }
  #transportArgs(){return ['-c',`core.gitProxy=${join(this.#runDir,'ref-git-proxy')}`,'-c','remote.origin.proxy=','-c','protocol.allow=never','-c','protocol.git.allow=always'];}
  async #remote(row:LiveWatch){
    const result=await this.#git(row.path,[...this.#transportArgs(),'ls-remote',HOST_ORIGIN,`refs/heads/${row.branch}`]);
    if(result.code!==0||result.error)throw new Error('watch remote ref observation incomplete');
    return result.stdout.trim().split(/\s/)[0]??'';
  }
  async #leaseDecision(row:LiveWatch,pending:PushAdmission,result:RunResult){
    // One fetch after a failed/unknown push. It both supplies remote objects and records the observed tip.
    await this.#route(row);
    const ref=`refs/heads/${row.branch}`,local=`refs/cland/ref-watch/${pending.id}`;
    const fetched=await this.#git(row.path,[...this.#transportArgs(),'fetch','--no-tags','--no-write-fetch-head',HOST_ORIGIN,`+${ref}:${local}`]);
    if(fetched.code!==0||fetched.error){row.decision='remote fetch incomplete';return result;}
    const tip=await this.#git(row.path,['rev-parse','--verify',local]);
    if(tip.code!==0||tip.error){row.decision='remote tip incomplete';return result;}
    row.remote=tip.stdout.trim();
    const ancestor=await this.#git(row.path,['merge-base','--is-ancestor',pending.head,row.remote]);
    row.decision=ancestor.error||ancestor.code!==0&&ancestor.code!==1?'remote ancestry incomplete':ancestor.code===0?'remote at or past captured head':'remote differs; push reported';
    await this.#git(row.path,['update-ref','-d',local]);
    return result;
  }
  async #settle(row:LiveWatch):Promise<boolean>{
    const pending=row.pending;if(!pending)return true;
    const previous={...row};
    const state=await this.#owner.observe(pending,async native=>{pending.native=native;await this.#save();});
    if(state.state!=='gone'){
      if(state.state==='running'&&Date.now()-pending.started<30000)return false;
      if(state.state==='running'&&await this.#owner.stop(pending))return false;
      const notice=state.state==='unknown'?state.cause??'native push identity unknown':'native push cleanup incomplete';
      if(pending.notice!==notice){pending.notice=notice;row.fencedCause=notice;await this.#save();this.#event(row,pending.head,{code:null,stdout:'',stderr:'',error:notice});}
      return false;
    }
    let result:RunResult=state.result??{code:state.code,stdout:'',stderr:'',...(state.signal?{error:`native signal ${state.signal}`}:state.code===null?{error:'native exit outcome unknown; remote reconciliation recorded separately'}:{})};
    if(state.code===0){row.remote=pending.head;row.decision='native push confirmed';}
    else result=await this.#leaseDecision(row,pending,result);
    if(result.code===0||row.decision==='remote at or past captured head')delete row.fencedCause;
    row.head=pending.head;row.signature=pending.signature;delete row.notice;row.result=boundedCommandResult(result);delete row.pending;
    if(row.recovering){delete row.head;delete row.signature;}
    try{await this.#save();}catch(error){this.#rows.set(row.path,previous);throw error;}
    this.#event(row,pending.head,row.result);
    await rm(join(this.#runDir,'ref-push',pending.id+'.log'),{force:true});await rm(join(this.#runDir,'ref-push',pending.id+'.json'),{force:true});await this.#hooks.afterSettlement?.();return true;
  }
  async #scan(force:boolean){
    for(const row of this.#rows.values())try{
      if(row.removal){if(await this.#removed(row)){const candidate=new Map(this.#rows);candidate.delete(row.path);await this.#save(candidate.values());this.#rows=candidate;}continue;}
      if(row.pending){
        await this.#settle(row);
        if(row.pending){
          if(!row.pending.notice)continue;
          const current=await this.#git(row.path,['rev-parse','--verify',`refs/heads/${row.branch}`]);
          if(current.code!==0||current.error||current.stdout.trim()===row.pending.head)continue;
          row.fences=[...row.fences??[],row.pending];delete row.pending;delete row.head;delete row.signature;await this.#save();
        }
      }
      row.files??=await this.#resolve(row);
      const signature=await (this.#hooks.metadata?.(row.files)??Promise.all(row.files.map(async path=>{const info=await stat(path).catch(error=>{if(error.code==='ENOENT')return null;throw error;});return info?`${info.ino}:${info.size}:${info.mtimeMs}`:'missing';})).then(values=>values.join('|')));
      if(signature===row.signature&&!row.notice)continue;
      const stable=row.observed===signature;row.observed=signature;if(!force&&!stable)continue;
      const tip=await this.#git(row.path,['rev-parse','--verify',`refs/heads/${row.branch}`]);
      if(tip.code!==0||tip.error)throw new Error('watch head observation incomplete');
      const head=tip.stdout.trim();
      if(row.recovering&&row.remote){
        const past=await this.#git(row.path,['merge-base','--is-ancestor',head,row.remote]);
        if(past.error||(past.code!==0&&past.code!==1))throw new Error('recovery ancestry observation incomplete');
        if(past.code===0){row.head=head;row.signature=signature;row.decision='recovery remote already at or past current head';delete row.notice;delete row.recovering;await this.#save();continue;}
      }
      delete row.recovering;
      if(head===row.head){delete row.notice;row.signature=signature;await this.#save();continue;}
      await this.#route(row);row.remote??=await this.#remote(row);
      const pending:PushAdmission={id:randomUUID(),head,signature,started:Date.now()};row.pending=pending;await this.#save();
      await this.#hooks.beforePush?.(head);
      await mkdir(join(this.#runDir,'ref-push'),{recursive:true,mode:0o700});
      await this.#owner.spawn(row.path,[...this.#transportArgs(),'push','--no-verify',`--force-with-lease=refs/heads/${row.branch}:${row.remote}`,HOST_ORIGIN,`${head}:refs/heads/${row.branch}`],join(this.#runDir,'ref-push',pending.id+'.log'),pending,async native=>{pending.native=native;await this.#save();});
    }catch(error){const notice=error instanceof Error?error.message:String(error);if(row.notice!==notice){row.notice=notice;this.#event(row,row.pending?.head??row.head??'',{code:null,stdout:'',stderr:'',error:`watch incomplete: ${notice}`});this.#emit({event:'ref-watch-status',watches:this.status()});}}
  }
  async close(){this.#closed=true;clearTimeout(this.#timer);await this.#serial(()=>this.#drain());}
}
