import { linuxBirthBootId } from './identity.ts';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { RunResult } from './command.ts';
import { join } from 'node:path';
import { remoteCommandEnvironment } from './command-environment.ts';
import type { AgentProcesses, ProcessTarget } from './processes.ts';
import { observeProcesses } from './native.ts';
export type PushAdmission = { id: string; head: string; signature: string; started: number; native?: ProcessTarget; notice?: string };
export type PushObservation = { state: 'running' | 'unknown'; cause?:string } | {state:'gone'; code:number|null; signal:string|null; result?:RunResult};
export type RefPushOwner = {
  spawn(path:string,args:string[],logFile:string,pending:PushAdmission,accepted:(native:ProcessTarget)=>Promise<void>):Promise<void>;
  observe(pending:PushAdmission,rebind?:(native:ProcessTarget)=>Promise<void>):Promise<PushObservation>;
  stop(pending:PushAdmission):Promise<boolean>;
  closed?(pending:PushAdmission):Promise<boolean>;
};
export function refPushEnvironment(base:NodeJS.ProcessEnv,proxy?:string){
  const env=remoteCommandEnvironment(base);
  for(const key of Object.keys(env))if(key.startsWith('GIT_'))delete env[key];
  env.GIT_CONFIG_NOSYSTEM='1';env.GIT_CONFIG_GLOBAL='/dev/null';if(proxy)env.GIT_PROXY_COMMAND=proxy;return env;
}
/** Existing launch ledger owns admission, bootstrap release and captured native births. No second process ledger. */
export function refPushOwner(processes:AgentProcesses,env:NodeJS.ProcessEnv,runDir:string,observeNative=observeProcesses):RefPushOwner {
  const pushEnv=refPushEnvironment(env,join(runDir,'ref-git-proxy'));
  return {
    async spawn(path,args,logFile,pending,accepted) {
      await processes.spawn({command:process.execPath,args:[fileURLToPath(new URL('./ref-push-worker.ts',import.meta.url)),runDir,pending.id,path,JSON.stringify(args)],cwd:path,env:pushEnv,logFile},undefined, {launchId:pending.id,accepted});
    },
    async observe(pending,rebind) {
      let native=pending.native;
      if(!native){
        const receipt=await processes.operationReceipt(pending.id);
        if(receipt.state==='failed')return {state:'gone',code:null,signal:null};
        if(receipt.state==='pending')return {state:'unknown',cause:'native producer admission receipt pending'};
        native=receipt.result;await rebind?.(native);
      }
      const candidate=await processes.operationRecord(pending.id);
      if(candidate&&(candidate.pid!==native.pid||candidate.identity!==native.identity)){
        const fields: string[] = [];
        if(candidate.pid!==native.pid)fields.push('pid');
        if(candidate.identity!==native.identity){
          const admittedBoot=linuxBirthBootId(native.identity),candidateBoot=linuxBirthBootId(candidate.identity);
          fields.push(admittedBoot&&candidateBoot&&admittedBoot!==candidateBoot?'boot':'identity');
        }
        return {state:'unknown',cause:'native producer admission mismatch: '+fields.join(', ')};
      }
      const row=candidate?.pid===native.pid&&candidate.identity===native.identity?candidate:undefined;
      const targets=[native,...row?.targets??[]];
      const observed=await observeNative(targets.map(target=>target.pid),env);
      // The worker checkpoints before exit. Read after the native census so an
      // ENOENT sampled while it was running cannot fence its completed result.
      let receipt:{launchId:string;pid:number;identity:string;head:string;complete:boolean;result:RunResult}|undefined;
      try{receipt=JSON.parse(await readFile(join(runDir,'ref-push',pending.id+'.json'),'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')return {state:'unknown',cause:'native producer receipt unreadable'};}
      const completed=receipt?.complete===true&&receipt.launchId===pending.id&&receipt.pid===native.pid&&receipt.identity===native.identity&&receipt.head===pending.head;
      if(row?.authority==='unknown'&&!completed)return {state:'unknown',cause:'native authority unknown; producer result missing'};
      const rootProof=observed.get(native.pid);
      if(!completed&&(rootProof?.ended||rootProof?.identity&&rootProof.identity!==native.identity))return {state:'unknown',cause:'producer result missing; native cleanup retained'};
      if(targets.some(target=>{const proof=observed.get(target.pid);return !proof?.ended&&!proof?.identity;}))return {state:'unknown',cause:'native producer target identity unobservable'};
      if(targets.some(target=>observed.get(target.pid)?.identity===target.identity))return row?{state:'running'}:{state:'unknown',cause:'native producer ledger missing for observed target'};
      // Observation grants no signal authority. A replaced birth settles only the captured target.
      if(!completed)return {state:'unknown',cause:'producer result missing'};
      return {state:'gone',code:receipt!.result.code,signal:null,result:receipt!.result};
    },
    async closed(pending){const row=await processes.operationRecord(pending.id);return !!pending.native&&row?.pid===pending.native.pid&&row.identity===pending.native.identity&&row.authority==='closed'&&row.ended===true;},
    async stop(pending) {
      const row=await processes.operationRecord(pending.id);
      return !!pending.native&&row?.pid===pending.native.pid&&row.identity===pending.native.identity&&await processes.stop(pending.native);
    },
  };
}
