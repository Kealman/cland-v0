import { parseAgentFile } from './operations.ts';
import { fileOperations } from './files.ts';
import { randomUUID } from 'node:crypto';
import { open, lstat, opendir, mkdir, unlink, readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { isAbsolute, resolve, join } from 'node:path';
import type { FileHandle } from 'node:fs/promises';
import { boundedCommandResult, nativeCommandIncomplete, type run as runCheckoutCommand, type RunResult } from './command.ts';
import { checkpoint } from './storage.ts';
import { worktreeOperations } from './worktrees.ts';
import { worktreeInstall } from './worktree-install.ts';
import type { AgentProcesses, ProcessTarget } from './processes.ts';
import { remoteCommandEnvironment } from './command-environment.ts';
import { reserveCheckout, observeCheckout, validateCheckout, cleanupCheckout } from './prepared-checkout.ts';
import type { CheckoutOwnership, FileBirth } from './prepared-checkout.ts';

type Phase = 'preparing' | 'git-running' | 'prepared' | 'committing';
type Plan = { kind: 'spawn' | 'worktree' | 'stop' | 'run' | 'publishFile' | 'appendFile'; phase: Phase; args: Record<string, unknown>; recoveryKey?: string; cleanup?: FileBirth & {path:string}; checkout?: CheckoutOwnership; targets?: ProcessTarget[] };
export type PreparedOutcome = {state:'accepted';result:unknown} | {state:'failed';error:string} | {state:'pending';reason:string};
type Pending = { deadline: number; plan: Plan; log?: FileHandle; timer?: NodeJS.Timeout };
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT';
/** Tokens bind commits to admission; durable results reconcile a lost accepted reply. */
export class PreparedOperations {
  #directory: string; #results: string; #env: NodeJS.ProcessEnv; #processes: AgentProcesses;
  #pending = new Map<string, Pending>();
  #work = Promise.resolve();
  #closed = false;
  #failures = new Map<string, Error>();
  #fenced = new Set<string>();
  #commands = new Map<string,Promise<RunResult>>();
  fenceCommand(token:string) {if(this.#pending.has(token))this.#fenced.add(token);}
  assertMutable() {if(this.#fenced.size||this.#failures.size)throw Object.assign(new Error('agent prepared ownership incomplete; reconcile before mutation'),{code:'CLAND_AGENT_ADMISSION_REFUSED'});}
  #hooks: {worktreeAdd?: ReturnType<typeof worktreeOperations>['worktreeAdd']; checkoutRun?: typeof runCheckoutCommand};
  readonly timeoutMs: number;
  constructor(run: string, env: NodeJS.ProcessEnv, processes: AgentProcesses, timeoutMs = 10000, hooks: {worktreeAdd?: ReturnType<typeof worktreeOperations>['worktreeAdd']; checkoutRun?: typeof runCheckoutCommand} = {}) {
    this.#hooks=hooks;this.timeoutMs=timeoutMs; this.#directory=join(run,'prepared'); this.#results=join(run,'prepared-results'); this.#env=env; this.#processes=processes;
  }
  #serial<T>(work: () => Promise<T>): Promise<T> {const result=this.#work.then(work);this.#work=result.then(()=>{},()=>{});return result;}
  #path(token:string) {if(!/^[a-f0-9-]{36}$/.test(token)) throw new Error('invalid prepared token');return join(this.#directory,token+'.json');}
  async #readPlan(token:string):Promise<Plan|null> {try{return JSON.parse(await readFile(this.#path(token),'utf8'));}catch(error){if(missing(error)) return null;throw error;}}
  async #outcome(token:string):Promise<{recoveryKey?:string;outcome:PreparedOutcome}|null> {this.#path(token);try{return JSON.parse(await readFile(join(this.#results,token+'.json'),'utf8'));}catch(error){if(missing(error)) return null;throw error;}}
  async #saveOutcome(token:string,plan:Plan,outcome:PreparedOutcome) {await checkpoint(join(this.#results,token+'.json'),{...(plan.recoveryKey?{recoveryKey:plan.recoveryKey}:{}),outcome});}
  async #removePlan(token:string) {await unlink(this.#path(token)).catch(error=>{if(!missing(error)){this.#fenced.add(token);this.#failures.set(token,error instanceof Error?error:new Error(String(error)));throw error;}});this.#pending.delete(token);this.#failures.delete(token);this.#fenced.delete(token);}
  async start() {
    await mkdir(this.#directory,{recursive:true,mode:0o700}); await mkdir(this.#results,{recursive:true,mode:0o700});
    const entries=await opendir(this.#directory);
    for await(const entry of entries) {
      if(!entry.isFile()||!/^[a-f0-9-]{36}\.json$/.test(entry.name)) continue;
      const token=entry.name.slice(0,-5),plan=(await this.#readPlan(token))!;
      this.#pending.set(token,{deadline:Infinity,plan});
      const saved=await this.#outcome(token);
      if(saved?.outcome.state==='accepted') {await this.#removePlan(token);continue;}
      if(plan.phase==='committing') {
        const outcome=await this.#recoverCommit(token,plan);
        if(outcome.state==='pending') {this.#fenced.add(token);this.#pending.set(token,{deadline:Infinity,plan});continue;}
      } else if(plan.phase==='git-running') {
        // The crashed agent did not join this native Git command. Keep its storage fenced.
        this.#fenced.add(token);this.#pending.set(token,{deadline:Infinity,plan});continue;
      } else {
        await this.#cleanup(token,plan);
        await this.#saveOutcome(token,plan,{state:'failed',error:'prepared operation expired on agent restart'});
      }
      await this.#removePlan(token);
    }
  }
  /** Persist before every Git inspection/mutation, not only worktree creation. */
  async #gitBoundary<T>(token:string,plan:Plan,work:()=>Promise<T>):Promise<T> {
    if(plan.phase==='git-running')throw new Error('prepared Git writer completion unknown; cleanup incomplete');
    const previous=plan.phase,alreadyFenced=this.#fenced.has(token);
    plan.phase='git-running';this.#fenced.add(token);
    await checkpoint(this.#path(token),plan);
    const restore=async()=>{
      plan.phase=previous;
      try {await checkpoint(this.#path(token),plan);}
      catch(error){plan.phase='git-running';throw error;}
      if(!alreadyFenced&&!this.#failures.has(token))this.#fenced.delete(token);
    };
    let result:T;
    try {result=await work();}
    catch(error) {
      if((error as NodeJS.ErrnoException).code==='CLAND_NATIVE_INCOMPLETE') {
        this.#failures.set(token,error instanceof Error?error:new Error(String(error)));throw error;
      }
      await restore();throw error;
    }
    await restore();return result;
  }
  async #cleanup(token:string,plan:Plan) {
    if(plan.phase==='git-running') throw new Error('prepared Git writer completion unknown; cleanup incomplete');
    if(plan.cleanup) {
      const info=await lstat(plan.cleanup.path).catch(error=>{if(!missing(error))throw error;return null;});
      if(info&&info.dev===plan.cleanup.dev&&info.ino===plan.cleanup.ino&&info.size===0) await unlink(plan.cleanup.path);
    }
    if(plan.checkout) {const completed=plan.phase==='prepared'||plan.phase==='committing';await this.#gitBoundary(token,plan,()=>cleanupCheckout(this.#env,plan.checkout!,completed,this.#hooks.checkoutRun));}
  }
  prepare(kind:Plan['kind'],args:Record<string,unknown>) {return this.#serial(async()=>{
    if(this.#closed) throw new Error('agent closing');
    this.assertMutable();
    const {operationId,recoveryKey,...rawArgs}=args;
    const token=typeof operationId==='string'?operationId:randomUUID();this.#path(token);
    if(await this.#readPlan(token)||await this.#outcome(token))throw new Error('operation already admitted; reconcile');
    if(args.env&&typeof args.env==='object'&&!Array.isArray(args.env)) rawArgs.env=remoteCommandEnvironment(args.env as NodeJS.ProcessEnv);
    const plan:Plan={kind,phase:'preparing',args:rawArgs,...(typeof recoveryKey==='string'?{recoveryKey}:{})};
    args=rawArgs;
    let log:FileHandle|undefined;
    const pending:Pending={deadline:Infinity,plan};this.#pending.set(token,pending);
    try {
      await checkpoint(this.#path(token),plan);
    if(kind==='publishFile'||kind==='appendFile') parseAgentFile(args,kind);
    if(kind==='spawn') {
      args={...args,env:remoteCommandEnvironment(args.env as NodeJS.ProcessEnv)};
      const env=remoteCommandEnvironment({...this.#env,...args.env as NodeJS.ProcessEnv});
      if(typeof args.command!=='string'||typeof args.cwd!=='string') throw new Error('invalid spawn');
      const candidates=isAbsolute(args.command)?[args.command]:args.command.includes('/')?[resolve(args.cwd,args.command)]:(env.PATH??'').split(':').map(path=>resolve(args.cwd as string,path,args.command as string));
      let found=false;for(const candidate of candidates){try{await access(candidate,constants.X_OK);found=true;break;}catch{}}
      if(!found) throw new Error('command unavailable');
    }
      if(kind==='spawn'&&args.logFile!==undefined) {
        if(typeof args.logFile!=='string') throw new Error('invalid logFile');
        try{log=await open(args.logFile,'ax',0o600);const info=await log.stat();plan.cleanup={path:args.logFile,dev:info.dev,ino:info.ino};}
        catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;log=await open(args.logFile,'a');}
      }
      if(log)pending.log=log;
      if(kind==='stop') {
        const captured=await this.#processes.captureForStop(args);
        if(captured.closed||!captured.targets) {await this.#removePlan(token);return {token:null,settled:captured.closed};}
        plan.targets=captured.targets;
      }
      if(kind==='worktree') {
        await this.#gitBoundary(token,plan,async()=>{const checkout=await reserveCheckout(this.#env,args,this.#hooks.checkoutRun);if(checkout)plan.checkout=checkout;});
        await checkpoint(this.#path(token),plan);
        await this.#gitBoundary(token,plan,()=> (this.#hooks.worktreeAdd??worktreeOperations(this.#env).worktreeAdd)({...args,root:String(args.root),path:String(args.path),branch:String(args.branch),beforeInstall:()=>false}));
        plan.phase='prepared';
        if(plan.checkout) await this.#gitBoundary(token,plan,()=>observeCheckout(this.#env,plan.checkout!,this.#hooks.checkoutRun));
      }
      plan.phase='prepared';await checkpoint(this.#path(token),plan);
      pending.deadline=Date.now()+this.timeoutMs;
      pending.timer=setTimeout(()=>{void this.abort(token).catch(error=>{this.#failures.set(token,error instanceof Error?error:new Error(String(error)));});},this.timeoutMs);
      this.#pending.set(token,pending);return {token,targets:plan.targets};
    } catch(error) {
      this.#fenced.add(token);await log?.close();await this.#cleanup(token,plan);await this.#saveOutcome(token,plan,{state:'failed',error:String(error)});await this.#removePlan(token);throw error;
    }
  });}
  async #recoverCommit(token:string,plan:Plan):Promise<PreparedOutcome> {
    if(plan.kind==='publishFile'||plan.kind==='appendFile')return {state:'pending',reason:'file commit completion unknown; never replay'};
    if(plan.kind==='run')return {state:'pending',reason:'native command completion unknown'};
    if(plan.kind==='spawn') {
      const native=await this.#processes.operationReceipt(token);
      if(native.state==='pending') return native;
      const outcome:PreparedOutcome=native.state==='accepted'?native:{state:'failed',error:native.error};
      await this.#saveOutcome(token,plan,outcome);return outcome;
    }
    if(plan.kind==='stop') {
      const closed=await this.#processes.captureForStop(plan.args);
      if(!closed.closed) return {state:'pending',reason:'stop tree completion unknown'};
      const outcome:PreparedOutcome={state:'accepted',result:true};await this.#saveOutcome(token,plan,outcome);return outcome;
    }
    await this.#cleanup(token,plan);
    const outcome:PreparedOutcome={state:'failed',error:'worktree commit interrupted; owned checkout cleaned'};
    await this.#saveOutcome(token,plan,outcome);return outcome;
  }
  commit(token:string,install=true) {return this.#serial(async()=>{
    const pending=this.#pending.get(token);if(!pending)throw new Error('prepared operation expired or unavailable');
    if(Date.now()>=pending.deadline) {await this.#abort(token);throw new Error('prepared operation expired');}
    clearTimeout(pending.timer);const {plan}=pending;if(plan.phase==='git-running')throw new Error('prepared Git writer completion unknown; cleanup incomplete');plan.phase='committing';await checkpoint(this.#path(token),plan);
    let fileCompleted = false;
    try {
      let result:unknown;
      if(plan.kind==='publishFile'||plan.kind==='appendFile') {
        const {path,bytes,options}=parseAgentFile(plan.args,plan.kind);
        if(plan.kind==='publishFile') result=await fileOperations.publishFile(path,bytes,options);
        else {await fileOperations.appendFile(path,bytes);result=null;}
        fileCompleted = true;
      } else if(plan.kind==='spawn') {
        const cleanup=plan.cleanup;delete plan.cleanup;await checkpoint(this.#path(token),plan);
        try {result=await this.#processes.spawn({...plan.args,env:remoteCommandEnvironment({...this.#env,...plan.args.env as NodeJS.ProcessEnv})},pending.log,{launchId:token,accepted:async result=>{await this.#saveOutcome(token,plan,{state:'accepted',result});}});}
        catch(error){if(!(await this.#outcome(token))&&cleanup)plan.cleanup=cleanup;throw error;}
      } else if(plan.kind==='stop') result=await this.#processes.stop({...plan.args,captured:plan.targets});
      else {if(plan.checkout)await this.#gitBoundary(token,plan,()=>validateCheckout(this.#env,plan.checkout!,this.#hooks.checkoutRun));const warning=install?await worktreeInstall(String(plan.args.root),String(plan.args.path)):undefined;result=warning?{warning}:{};}
      await this.#saveOutcome(token,plan,{state:'accepted',result});
      try{await pending.log?.close();}catch(error){if(plan.kind!=='spawn')throw error;}
      await this.#removePlan(token);return result;
    } catch(error) {
      const saved=await this.#outcome(token);
      if(saved?.outcome.state==='accepted') {await this.#removePlan(token);return saved.outcome.result;}
      if (fileCompleted) {
        this.#fenced.add(token);this.#failures.set(token,error instanceof Error?error:new Error(String(error)));throw error;
      }
      this.#fenced.add(token);await pending.log?.close();
      await this.#cleanup(token,plan);await this.#saveOutcome(token,plan,{state:'failed',error:String(error)});await this.#removePlan(token);throw error;
    }
  });}
  settle(token:string,recoveryKey:string) {return this.#serial(async():Promise<PreparedOutcome>=>{
    const saved=await this.#outcome(token);
    if(saved){if(!saved.recoveryKey||saved.recoveryKey!==recoveryKey)throw new Error('prepared recovery not owned');if(this.#pending.has(token)||this.#fenced.has(token))await this.#removePlan(token);return saved.outcome;}
    const plan=await this.#readPlan(token);
    if(!plan) {
      const completed=await this.#outcome(token);
      if(completed){if(completed.recoveryKey!==recoveryKey)throw new Error('prepared recovery not owned');return completed.outcome;}
      return {state:'failed',error:'operation not admitted'};
    }
    if(!plan.recoveryKey||plan.recoveryKey!==recoveryKey)throw new Error('prepared recovery unavailable or not owned');
    if(plan.phase==='committing') {const outcome=await this.#recoverCommit(token,plan);if(outcome.state!=='pending')await this.#removePlan(token);return outcome;}
    if(plan.phase==='git-running')return {state:'pending',reason:'prepared Git writer completion unknown'};
    await this.#abort(token);return (await this.#outcome(token))!.outcome;
  });}
  async #abort(token:string) {
    const pending=this.#pending.get(token);if(!pending)return;
    this.#fenced.add(token);
    if(pending.plan.phase==='committing') throw new Error('commit outcome unknown; reconcile before cleanup');
    clearTimeout(pending.timer);
    try {await pending.log?.close();await this.#cleanup(token,pending.plan);
      await this.#saveOutcome(token,pending.plan,{state:'failed',error:'prepared operation aborted'});await this.#removePlan(token);
    } catch(error){this.#failures.set(token,error instanceof Error?error:new Error(String(error)));throw error;}
  }
  abort(token:string) {return this.#serial(()=>this.#abort(token));}
  async runCommand(token:string,recoveryKey:string,args:Record<string,unknown>,work:()=>Promise<RunResult>):Promise<RunResult> {
    await this.#serial(async()=>{
      if(this.#closed)throw Object.assign(new Error('agent closing'),{code:'CLAND_AGENT_ADMISSION_REFUSED'});
      this.assertMutable();this.#path(token);
      if(await this.#readPlan(token)||await this.#outcome(token))throw new Error('command already admitted; reconcile');
      const plan:Plan={kind:'run',phase:'committing',args,recoveryKey};
      this.#pending.set(token,{deadline:Infinity,plan});
      try{await checkpoint(this.#path(token),plan);}catch(error){this.#fenced.add(token);throw error;}
    });
    const pending=this.#pending.get(token)!;
    const running=Promise.resolve().then(work).then(async result=>{
      if(nativeCommandIncomplete(result)){this.#fenced.add(token);throw Object.assign(new Error(result.error),{code:'CLAND_NATIVE_INCOMPLETE'});}
      result=boundedCommandResult(result);
      await this.#saveOutcome(token,pending.plan,{state:'accepted',result});await this.#removePlan(token);return result;
    }).catch(error=>{this.#fenced.add(token);this.#failures.set(token,error instanceof Error?error:new Error(String(error)));throw error;});
    this.#commands.set(token,running);
    try{return await running;}finally{this.#commands.delete(token);}
  }
  async close() {
    this.#closed=true;await this.#work;const failures:unknown[]=[];
    await Promise.allSettled([...this.#commands.values()]);
    for(const token of this.#pending.keys()){try{await this.abort(token);}catch(error){failures.push(error);}}
    failures.push(...this.#failures.values());
    for(const token of this.#fenced)failures.push(new Error(`prepared ownership incomplete: ${token}`));
    if(failures.length)throw new AggregateError(failures,'prepared cleanup incomplete');
  }
}
