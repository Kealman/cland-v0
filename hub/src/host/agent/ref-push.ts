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
        if(receipt.state==='pending')return {state:'unknown'};
        native=receipt.result;await rebind?.(native);
      }
      const candidate=await processes.operationRecord(pending.id);
      if(candidate&&(candidate.pid!==native.pid||candidate.identity!==native.identity))return {state:'unknown'};
      const row=candidate?.pid===native.pid&&candidate.identity===native.identity?candidate:undefined;
      let receipt:{launchId:string;pid:number;identity:string;head:string;complete:boolean;result:RunResult}|undefined;
      try{receipt=JSON.parse(await readFile(join(runDir,'ref-push',pending.id+'.json'),'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')return {state:'unknown'};}
      const completed=receipt?.complete===true&&receipt.launchId===pending.id&&receipt.pid===native.pid&&receipt.identity===native.identity&&receipt.head===pending.head;
      if(row?.authority==='unknown'&&!completed)return {state:'unknown',cause:'native authority unknown; producer result missing'};
      const targets=[native,...row?.targets??[]];
      const observed=await observeNative(targets.map(target=>target.pid),env);
      const rootProof=observed.get(native.pid);
      if(!completed&&(rootProof?.ended||rootProof?.identity&&rootProof.identity!==native.identity))return {state:'unknown',cause:'producer result missing; native cleanup retained'};
      if(targets.some(target=>{const proof=observed.get(target.pid);return !proof?.ended&&!proof?.identity;}))return {state:'unknown'};
      if(targets.some(target=>observed.get(target.pid)?.identity===target.identity))return {state:row?'running':'unknown'};
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
