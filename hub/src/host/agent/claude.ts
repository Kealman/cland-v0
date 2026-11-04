import { readFile, mkdir, lstat, realpath, unlink } from 'node:fs/promises';
import { join, resolve, dirname, basename } from 'node:path';
import { claudeProcessMembers } from './claude-stop.ts';
import { checkpoint } from './storage.ts';
import { observeProcesses } from './native.ts';
import { run, type RunResult } from './command.ts';
import { hostClaudeConfigDirectory } from './state-paths.ts';

export function claudeBackgroundId(stdout:string):string|null {
  return /claude attach (\S+)/.exec(stdout)?.[1]?.replace(/[`'".,]+$/, '') ?? /\(([0-9a-f]{6,})\)/.exec(stdout)?.[1] ?? /\b([0-9a-f]{8})\b/.exec(stdout)?.[1] ?? null;
}
export function claudeConfigRefusal(info:{directory:boolean;symlink:boolean;uid:number;mode:number},uid=process.getuid?.()):string|null {
  return !info.directory||info.symlink||info.uid!==uid||(info.mode&0o777)!==0o700 ? 'Claude account config root must be an agent-owned directory with mode 0700' : null;
}
export const isClaudeJobId=(value:unknown):value is string=>typeof value==='string'&&/^[a-zA-Z0-9_][a-zA-Z0-9_-]*$/.test(value);
export const CLAUDE_LAUNCH_CAPABILITY = 'claude-launch-adopt-v1';
type ConfigRoot={path:string;dev:number;ino:number};
export type ClaudeReceipt = { privateDirectory:string; released?:true; config:ConfigRoot; jobs?:ConfigRoot;  generation: string; pid: number; identity: string; uid: number; job: string; session: string };
type Command = { command: string; args: readonly string[]; cwd: string; env: NodeJS.ProcessEnv; timeoutMs?: number | undefined };
type Dependencies = { closed(worker:ClaudeReceipt):boolean; configRoot(path:string):Promise<ConfigRoot>; run(command: Command, signal?: AbortSignal): Promise<RunResult>; identity(pid: number): Promise<string | null>; uid(pid: number): Promise<number | null> };
export function claudeLaunches(directory: string, env: NodeJS.ProcessEnv, overrides: Partial<Dependencies> = {}) {
  const deps: Dependencies = {
    closed:()=>false,
    configRoot: async path=>{
      const canonical=await realpath(path),info=await lstat(path);
      const refusal=claudeConfigRefusal({directory:info.isDirectory(),symlink:info.isSymbolicLink(),uid:info.uid,mode:info.mode});if(refusal)throw new Error(refusal);
      return {path:canonical,dev:info.dev,ino:info.ino};
    },
    run: (c, signal) => run(c.command,c.args,c.env,c.timeoutMs,false,signal,'utf8',c.cwd),
    identity: async pid => (await observeProcesses([pid],env)).get(pid)?.identity ?? null,
    uid: async pid => {
      try{return (await claudeProcessMembers(env,[pid]))[0]?.uid ?? null;}catch{return null;}
    }, ...overrides,
  };
  const operations=new Map<string,Promise<unknown>>(),writers=new Map<string,Promise<unknown>>();
  function operation<T>(generation:string,kind:string,work:()=>Promise<T>):Promise<T>{
    const key=generation+':'+kind,active=operations.get(key);if(active)return active as Promise<T>;
    const result=(writers.get(generation)??Promise.resolve()).catch(()=>{}).then(work);
    operations.set(key,result);writers.set(generation,result);
    const done=()=>{if(operations.get(key)===result)operations.delete(key);if(writers.get(generation)===result)writers.delete(generation);};
    void result.then(done,done);return result;
  }
  const path = (generation: string) => {
    if(!/^[a-f0-9-]{36}$/.test(generation))throw new Error('invalid Claude generation');
    return join(directory,'claude',generation+'.json');
  };
  async function receipt(generation:string,closed:(worker:{pid:number;identity:string})=>boolean|Promise<boolean>=()=>false):Promise<ClaudeReceipt> {
    let record:ClaudeReceipt;
    try{record=JSON.parse(await readFile(path(generation),'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')throw Object.assign(new Error('Claude generation receipt missing'),{code:'CLAND_CLAUDE_GENERATION_MISSING'});throw new Error('Claude worker receipt unavailable');}
    if(Object.hasOwn(record,'phase'))throw new Error('Claude launch cleanup-incomplete: native worker receipt pending');
    if(record.generation!==generation || !isClaudeJobId(record.job) || !Number.isSafeInteger(record.pid) || record.uid!==process.getuid?.() || !record.released && !(await closed(record)) && (await deps.uid(record.pid)!==record.uid || await deps.identity(record.pid)!==record.identity))throw new Error('Claude worker identity mismatch');
    return record;
  }
  return {
    receipt,
    remove: (generation:string,settled?:(worker:ClaudeReceipt)=>Promise<void>,confirmed:(worker:ClaudeReceipt)=>boolean|Promise<boolean>=deps.closed)=>operation(generation,'release',async()=>{
      let record:ClaudeReceipt;
      try{record=JSON.parse(await readFile(path(generation),'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
      if(record.generation!==generation)throw new Error('Claude generation ownership mismatch');
      if(Object.hasOwn(record,'phase'))throw new Error('Claude launch cleanup-incomplete: native worker receipt pending');
      if(record.released){await settled?.(record);return;}
      if(record.generation!==generation || !isClaudeJobId(record.job) || !(await confirmed(record)))throw new Error('Claude job cleanup ownership incomplete');
      const config=await deps.configRoot(record.config.path);
      if(config.dev!==record.config.dev || config.ino!==record.config.ino)throw new Error('Claude account config root changed');
      if(record.jobs){
        let info;try{info=await lstat(record.jobs.path);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
        if(info){
          if(!info.isDirectory()||info.isSymbolicLink()||info.dev!==record.jobs.dev||info.ino!==record.jobs.ino)throw new Error('Claude jobs directory changed');
          await unlink(join(record.jobs.path,record.job+'.json')).catch(error=>{if(error.code!=='ENOENT')throw error;});
        }
      }
      await checkpoint(path(generation),{...record,released:true});
      await settled?.(record);}),
    forget:(generation:string)=>operation(generation,'forget',async()=>{
      let record:ClaudeReceipt;try{record=JSON.parse(await readFile(path(generation),'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
      if(!record.released || record.generation!==generation)throw new Error('Claude generation release incomplete');
      try{await lstat(record.privateDirectory);throw new Error('Claude private generation deletion incomplete');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
      await unlink(path(generation)).catch(error=>{if(error.code!=='ENOENT')throw error;});
    }),
    launch: (command:Command,generation:string,signal?:AbortSignal):Promise<RunResult> => operation(generation,'launch',async()=>{
      let entered=false;
      try {
      const target=path(generation);
      const config=await deps.configRoot(hostClaudeConfigDirectory(command.env,env));
      const jobPath=join(config.path,'jobs');
      await mkdir(jobPath,{mode:0o700}).catch(error=>{if(error.code!=='EEXIST')throw error;});
      const jobInfo=await lstat(jobPath);
      if(!jobInfo.isDirectory()||jobInfo.isSymbolicLink()||jobInfo.uid!==process.getuid?.())throw new Error('Claude jobs directory must be agent-owned and real');
      const jobs:ConfigRoot={path:jobPath,dev:jobInfo.dev,ino:jobInfo.ino};
      const settings=command.args[command.args.indexOf('--settings')+1];
      if(!settings)throw new Error('Claude private settings path missing');
      const privateDirectory=dirname(resolve(settings));
      if(basename(privateDirectory)!==generation || !/^[a-f0-9]{64}$/.test(basename(dirname(privateDirectory))) || dirname(dirname(privateDirectory))!==join(directory,'sessions'))throw new Error('Claude private settings path invalid');
      await mkdir(join(directory,'claude'),{recursive:true,mode:0o700});
      try{await readFile(target);throw new Error('Claude generation already admitted');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
      const pending={generation,phase:'launching',privateDirectory,config,jobs,uid:process.getuid?.()};
      await checkpoint(target,pending);
      entered=true;
      const background=await deps.run(command,signal);
      if(background.code!==0 || background.error)return {...background,error:'Claude launch cleanup incomplete: launch outcome unavailable'};
      const parsedJob=claudeBackgroundId(background.stdout),job=isClaudeJobId(parsedJob)?parsedJob:null;
      await checkpoint(target,{...pending,...(job?{job}:{}),reason:'discovery pending'});
      const listed=await deps.run({...command,args:['agents','--json']},signal);
      let rows: Array<{id?:string;sessionId?:string;pid?:number}> = [];
      try {const parsed:unknown=JSON.parse(listed.stdout);if(!Array.isArray(parsed))throw new Error();rows=parsed;}catch {/* invalid output fails closed below */}
      const matches=rows.filter(row=>row && job && row.id===job);
      if(!job || listed.code!==0 || listed.error || matches.length!==1 || !Number.isSafeInteger(matches[0]?.pid) || typeof matches[0]?.sessionId!=='string') {
        // Native stop is requested, but without a pinned worker its outcome cannot grant cleanup authority.
        await checkpoint(target,{...pending,...(job?{job}:{}),reason:'worker discovery incomplete',nativeStopRequested:!!job});
        if(job){const stopped=await deps.run({...command,args:['stop',job]},undefined);await checkpoint(target,{...pending,job,reason:'worker discovery incomplete',nativeStopRequested:true,nativeStopCode:stopped.code});}
        return {code:1,stdout:'',stderr:'Claude launch discovery incomplete',error:'Claude launch cleanup incomplete: worker identity unavailable'};
      }
      const worker=matches[0]!,pid=worker.pid!;
      const identity=await deps.identity(pid),uid=await deps.uid(pid);
      if(!identity || uid!==process.getuid?.())return {code:1,stdout:'',stderr:'',error:'Claude launch cleanup incomplete: worker identity mismatch'};
      const currentJobs=await lstat(jobPath);
      if(!currentJobs.isDirectory()||currentJobs.isSymbolicLink()||currentJobs.uid!==jobInfo.uid||currentJobs.dev!==jobs.dev||currentJobs.ino!==jobs.ino)throw new Error('Claude jobs directory changed');
      const record:ClaudeReceipt={privateDirectory,generation,pid,identity,uid:uid!,job:job!,session:worker.sessionId!,config,jobs};
      await mkdir(join(directory,'claude'),{recursive:true,mode:0o700});
      await checkpoint(target,record);
      return background;
      }catch(error){return {code:1,stdout:'',stderr:'',error:entered?'Claude launch cleanup incomplete: native launch receipt unavailable':`Claude launch refused: ${error instanceof Error?error.message:'invalid launch'}`};}
    }),
  };
}
