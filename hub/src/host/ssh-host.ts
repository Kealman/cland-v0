import { memoryFloorDetails, type MemoryFloorDetails } from './agent/memory.ts';
import { REF_FLUSH_CAPABILITY } from './agent/watch.ts';
import { MissingClaudeGeneration } from './host.ts';
import { CLAUDE_LAUNCH_CAPABILITY } from './agent/claude.ts';
import { randomUUID } from 'node:crypto';
import { AgentClient, updateRefWatch, readRefWatchStatus } from './agent-client.ts';
import { PREPARED_HOST_CAPABILITY } from './agent/protocol.ts';
import { remoteCommandEnvironment } from './command-environment.ts';
import type { Host, HostCommand, HostLaunchLayout, HostCapturedProcess } from './host.ts';
import type { SshTransport } from '../transport/ssh.ts';
import type { AgentEvent } from './agent/protocol.ts';
import type { PreparedOutcome } from './agent/prepared.ts';

export class HostMemoryFloorRefusal extends Error {
  readonly code = 'memory-floor';
  readonly availableBytes: number;
  readonly floorBytes: number;
  readonly host: string;
  constructor(host: string, details: MemoryFloorDetails) {
    super(`host ${host}: available memory ${details.availableBytes} bytes is below floor ${details.floorBytes} bytes`);
    this.name = 'HostMemoryFloorRefusal'; this.host = host;
    this.availableBytes = details.availableBytes; this.floorBytes = details.floorBytes;
  }
}

type Options = { terminalAttachCommand?: (name: string) => string; watchStatus?: (rows:Array<{path:string;branch:string;state:string;cause?:string}>)=>void; expectedVersion?: string; agentReady?: () => Promise<void>; restoreAdoptedWorkers?: (client:AgentClient) => Promise<void>; updateAgent?: (previousVersion: string, signal:AbortSignal) => Promise<void>; onTable?: (rows: unknown[], bootId: string) => void; log?: (entry: Record<string, unknown>) => void; available?: () => boolean; codeDirectory?: string; name: string; transport: Pick<SshTransport, 'status' | 'forward' | 'unforward'>; connect: () => Promise<AgentClient>; layout: HostLaunchLayout };
/** No fallback to native hub operations, including while connecting or disconnected. */
export function sshHost(o: Options): Host & { close(): Promise<void>; quiesce(): void } {
  let closed = false;
  let quiescing = false;
  const acquisitionAbort=new AbortController();
  const unknown = new Set<string>();
  const waits = new Map<NodeJS.Timeout, () => void>();
  let completionTimer: NodeJS.Timeout | undefined;
  let completionWork: Promise<void> | undefined;
  const pause = () => new Promise<void>(resolve => {
    if(closed||quiescing){resolve();return;}
    const timer=setTimeout(()=>{waits.delete(timer);resolve();},500);waits.set(timer,resolve);
  });
  const incomplete = (token:string) => Object.assign(new Error(`host ${o.name}: tunnel outcome unknown for ${token}; storage remains fenced`),{code:'CLAND_HOST_OUTCOME_UNKNOWN',operation:token});
  const cancelPending = () => {quiescing=true;acquisitionAbort.abort();for(const [timer,resolve] of waits){clearTimeout(timer);resolve();}waits.clear();};

  let client: AgentClient | undefined, connecting: Promise<AgentClient> | undefined;
  let observer:AgentClient|undefined,observing:Promise<AgentClient>|undefined;
  const ownedClients=new Set<AgentClient>(),closeErrors=new Map<AgentClient,unknown>();
  const closeConnection=async(value:AgentClient)=>{
    try{await value.close();ownedClients.delete(value);closeErrors.delete(value);}
    catch(error){if(ownedClients.has(value))closeErrors.set(value,error);throw error;}
  };
  const lostConnection=async(value:AgentClient,token:string)=>{unknown.add(token);if(client===value)client=undefined;await closeConnection(value).catch(()=>{});};
  const completions = new Map<string, (value: {code: number | null; signal: string | null}) => void>();
  const receipts = new Map<string, AgentEvent & {event:'process-exited'}>();
  const key = (pid: number, identity: string) => `${pid}:${identity}`;
  const event = (frame: AgentEvent) => {
    if(frame.event==='ref-watch-status'){o.watchStatus?.(frame.watches);return;}
    if (frame.event === 'ref-moved') { o.log?.(frame); return; }
    if (frame.event !== 'process-exited') return;
    const id = key(frame.pid, frame.identity), resolve = completions.get(id);
    if (resolve) { completions.delete(id); resolve({ code: frame.code, signal: frame.signal }); }
    else {receipts.set(id, frame); if(receipts.size>256) receipts.delete(receipts.keys().next().value!);}
  };
  const check = () => { if(o.available && !o.available()) throw new Error(`host ${o.name}: tunnel admission revoked`); if(closed) throw new Error(`host ${o.name}: tunnel Host closed`); if (o.transport.status().state !== 'up') throw new Error(`host ${o.name}: tunnel is not up${o.codeDirectory ? `; requires code directory ${o.codeDirectory}` : ''}`); };
  const request = (connection: AgentClient, op: string, args: Record<string, unknown>, timeoutMs?: number) => {
    check(); return connection.request(op, args, timeoutMs);
  };
  // Preserve the client contract while checking authority at every helper request.
  const admitted = (connection: AgentClient): AgentClient => new Proxy(connection,{get(target,key){
    if(key==='request')return (op:string,args:Record<string,unknown>,timeoutMs?:number)=>request(connection,op,args,timeoutMs);
    const value:unknown=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  }});
  const connected = async () => {
    check();
    if (client) return client;
    let acquired:AgentClient|undefined;
    connecting ??= o.connect().then(async value => {
      acquired=value;ownedClients.add(value);
      check();
      if(o.expectedVersion && value.hello.version!==o.expectedVersion) {
        acquisitionAbort.signal.throwIfAborted();
        const previous=value.hello.version;
        await closeConnection(value);
        if(!o.updateAgent)throw new Error(`host ${o.name}: version mismatch and code delivery unavailable`);
        acquisitionAbort.signal.throwIfAborted();
        check();
        await o.updateAgent(previous,acquisitionAbort.signal);
        throw new Error(`host ${o.name}: waiting for updated agent`);
      }
      value.once('closed',()=>{ownedClients.delete(value);closeErrors.delete(value);if(client===value)client=undefined;scheduleCompletions();});
      if(closed){await closeConnection(value);throw new Error(`host ${o.name}: tunnel Host closed during acquisition`);}
      if (!value.hello.capabilities?.includes(PREPARED_HOST_CAPABILITY)) { await closeConnection(value); throw new Error(`host ${o.name}: tunnel agent missing capability ${PREPARED_HOST_CAPABILITY}`); }
      value.on('event', event);
      await readRefWatchStatus(admitted(value),o.watchStatus);
      if(!quiescing)await o.restoreAdoptedWorkers?.(admitted(value));
      check();
      const table = await request(value,'processes',{}) as unknown[];
      const rows=await request(value,'native-receipts',{}) as AgentEvent[];
      if(closed){if(client===value)client=undefined;await closeConnection(value);throw new Error(`host ${o.name}: tunnel Host closed during acquisition`);}
      for(const row of rows)event(row);
      check();
      await o.agentReady?.();
      check();
      client = value;
      o.onTable?.(table, value.hello.bootId);
      return value;
    }).catch(async error => {if(acquired&&acquired!==client)await closeConnection(acquired).catch(()=>{});throw error;}).finally(() => { connecting = undefined; });
    return connecting;
  };
  // Observations must not wait for a held process checkpoint on the serial
  // recovery stream: a stop owner may need identity to release that checkpoint.
  const observed=async()=>{
    check();if(observer)return observer;
    observing??=o.connect().then(async value=>{
      ownedClients.add(value);
      value.once('closed',()=>{ownedClients.delete(value);closeErrors.delete(value);if(observer===value)observer=undefined;});
      try{
        check();
        if(!value.hello.capabilities?.includes(PREPARED_HOST_CAPABILITY))throw new Error(`host ${o.name}: tunnel agent missing capability ${PREPARED_HOST_CAPABILITY}`);
        observer=value;return value;
      }catch(error){await closeConnection(value);throw error;}
    }).finally(()=>{observing=undefined;});
    return observing;
  };
  const observations=new Set(['identity','stat','fileType','statDirectory','realpath','readFile','listFolder','occupants','processUsage']);
  function scheduleCompletions() {
    if(closed||quiescing||completionTimer||completionWork)return;
    completionTimer=setTimeout(()=>{
      completionTimer=undefined;
      completionWork=(async()=>{
        try {const connection=await connected();const rows=await request(connection,'native-receipts',{}) as AgentEvent[];for(const row of rows)event(row);}catch{/* A missing receipt stays pending through carrier recovery. */}
      })().finally(()=>{completionWork=undefined;scheduleCompletions();});
    },500);
    completionTimer.unref();
  }
  const mutation = () => {check();if(quiescing)throw new Error(`host ${o.name}: tunnel Host quiescing`);if(unknown.size)throw incomplete(unknown.values().next().value!);};
  const settle = async <T>(token:string,recoveryKey:string):Promise<T> => {
    unknown.add(token);
    for(;;) {
      if(o.available && !o.available())throw new Error(`host ${o.name}: tunnel admission revoked`);
      if(closed||quiescing)throw incomplete(token);
      let outcome:PreparedOutcome|undefined;
      try{outcome=await request(await connected(),'settle-prepared',{token,recoveryKey}) as PreparedOutcome;}catch{/* No terminal outcome: keep the admitted operation fenced. */}
      if(outcome?.state==='accepted'){unknown.delete(token);return outcome.result as T;}
      if(outcome?.state==='failed'){unknown.delete(token);const memory=memoryFloorDetails(outcome);if(memory)throw new HostMemoryFloorRefusal(o.name,memory);throw new Error(`host ${o.name}: tunnel agent confirmed failure: ${outcome.error}`);}
      await pause();
    }
  };
  const rpc = async <T>(op: string, args: Record<string, unknown> = {}, timeoutMs?: number): Promise<T> => {
    check();
    try { return await request(await (observations.has(op)?observed():connected()),op, args, timeoutMs) as T; }
    catch (error) { throw Object.assign(new Error(`host ${o.name}: tunnel agent ${op}: ${(error as Error).message}`), {code:(error as NodeJS.ErrnoException).code}); }
  };
  const prepared = async <T>(kind:string,args:Record<string,unknown>,callback?:(targets:HostCapturedProcess[])=>Promise<boolean|void>|boolean|void):Promise<T|false> => {
    if(kind!=='stop')mutation();
    const connection=await connected(),token=randomUUID(),recoveryKey=randomUUID();
    let result:{token:string|null;targets?:{pid:number;identity:string}[];settled?:T};
    try{result=await request(connection,`prepare-${kind}`,{...args,operationId:token,recoveryKey}) as typeof result;}
    catch(error) {if((error as NodeJS.ErrnoException).code==='CLAND_AGENT_ADMISSION_REFUSED')throw error;await lostConnection(connection,token);return settle<T>(token,recoveryKey);}
    if(!result.token)return result.settled??false;
    try {
      const install=await callback?.((result.targets??[]).map(row=>({pid:row.pid,pidStarted:row.identity,pidIdentity:row.identity})));
      check();if(client!==connection)throw new Error(`host ${o.name}: tunnel changed during preparation`);
      try{return await request(connection,'commit-prepared',{token:result.token,install:install!==false},60000) as T;}
      catch{await lostConnection(connection,token);return settle<T>(token,recoveryKey);}
    } catch(error) {
      // Abort is complete only after its cleanup receipt; a lost abort also reconciles.
      try{await request(connection,'abort-prepared',{token:result.token});}
      catch{await lostConnection(connection,token);try{await settle<T>(token,recoveryKey);}catch(settlement){if(unknown.has(token))throw settlement;}}
      throw error;
    }
  };
  const claudeProcesses = new Set<string>();
  const claudeCommands = new WeakMap<HostCommand,string>();
  const wire = (command: HostCommand) => {
    if(command.signal?.aborted)throw Object.assign(new Error('cancelled before send'),{code:'CLAND_AGENT_ADMISSION_REFUSED'});
    return { ...(claudeCommands.has(command)?{claudeGeneration:claudeCommands.get(command)}:{}),command:command.command,args:command.args,cwd:command.cwd,env:remoteCommandEnvironment(command.env),...(command.timeoutMs === undefined ? {} : {timeoutMs:command.timeoutMs}),...(command.logFile ? {logFile:command.logFile} : {}) };
  };
  const host: Host & {close():Promise<void>;quiesce():void} = {
    name:o.name, ...(o.terminalAttachCommand ? {terminalAttachCommand:o.terminalAttachCommand} : {}), limitPolls:false, layout: () => Object.freeze({...o.layout}),
    flushBranch: async (path,branch) => {
      mutation();
      const connection=await connected();
      if(!connection.hello.capabilities?.includes(REF_FLUSH_CAPABILITY)) throw new Error('agent ref-flush-v1 capability unavailable');
      await request(connection,'flush',{path},75000);
      let rows:Array<{path:string;branch:string;state:string;cause?:string}>=[];
      await readRefWatchStatus(admitted(connection),value=>{rows=value;});
      const row=rows?.find(row=>row.path===path&&row.branch===branch);
      if(!row||row.state!=='watching') throw new Error(`watch ${path}: ${row?.cause??'watch unavailable'}`);
    },
    writeFile: async (path,bytes,options) => { mutation(); await rpc('writeFile',{path,bytes:Buffer.from(bytes).toString('base64'),options}); },
    publishFile: (path,bytes,options) => prepared<boolean>('publishFile',{path,bytes:Buffer.from(bytes).toString('base64'),options}),
    appendFile: async (path,bytes) => {await prepared<null>('appendFile',{path,bytes:Buffer.from(bytes).toString('base64')});},
    stat: path => rpc('stat',{path}),
    makeDirectory: async (path,mode) => {mutation();await rpc('makeDirectory',{path,mode});},
    removePath: async (path,options) => {mutation();await rpc('removePath',{path,options});},
    freePort: () => rpc('freePort'),
    forward: async (session,endpoint) => {check(); return o.transport.forward(session,endpoint);},
    unforward: async session => {check(); await o.transport.unforward(session);},
    spawn: async (command,options) => {
      if(o.codeDirectory && await rpc('fileType',{path:o.codeDirectory}) !== 'directory') throw new Error(`host ${o.name}: tunnel agent missing version directory ${o.codeDirectory}`);
      const result = await prepared<{pid:number;identity:string;warning?:string}>('spawn',wire(command),() => options?.authorize?.());
      if (!result) throw new Error(`host ${o.name}: tunnel spawn not prepared`);
      if(result.warning){try{o.log?.({event:'host-spawn-log-close-failed',pid:result.pid,error:result.warning});}catch{/* Diagnostics cannot discard native ownership. */}}
      const id = key(result.pid,result.identity);
      const exited = new Promise<{code:number|null;signal:string|null}>(resolve => { const receipt = receipts.get(id); if (receipt) {receipts.delete(id);resolve(receipt);} else completions.set(id,resolve); });
      scheduleCompletions();
      return {pid:result.pid,exited};
    },
    launchClaude: async (command,generation) => {
      const connection=await connected();
      if(!connection.hello.capabilities?.includes(CLAUDE_LAUNCH_CAPABILITY))throw new Error(`host ${o.name}: tunnel agent missing capability ${CLAUDE_LAUNCH_CAPABILITY}`);
      claudeCommands.set(command,generation);
      try{
        const result=await host.run(command);
        if(result.claudeAdmission?.generation===generation&&result.claudeAdmission.outcome==='refused-before-spawn')throw Object.assign(new Error(result.error||'Claude launch refused before spawn'),{code:'CLAND_AGENT_ADMISSION_REFUSED'});
        return result;
      }finally{claudeCommands.delete(command);}
    },
    adopt: async generation => {
      const connection=await connected();
      if(!connection.hello.capabilities?.includes(CLAUDE_LAUNCH_CAPABILITY))throw new Error(`host ${o.name}: tunnel agent missing capability ${CLAUDE_LAUNCH_CAPABILITY}`);
      const admission='claude-adopt:'+generation;
      const forget=async()=>{const key='claude-forget:'+generation;try{await rpc('forget-claude',{generation});unknown.delete(key);unknown.delete(admission);}catch(error){unknown.add(key);throw new Error('Claude forget cleanup incomplete',{cause:error});}};
      try {
        const result=await rpc<{process:import('./host.ts').HostProcess;job:string;session:string;closed?:boolean;released?:boolean}>('adopt-claude',{generation});
        unknown.delete(admission);if(result.process.pid!==null&&result.process.pidIdentity)claudeProcesses.add(key(result.process.pid,result.process.pidIdentity));return {...result,release:async()=>{
          const release='claude-release:'+generation;
          try{await rpc('remove-claude',{generation});unknown.delete(release);}catch(error){unknown.add(release);throw new Error('Claude release cleanup incomplete',{cause:error});}
        },forget};
      }catch(error){unknown.add(admission);if((error as NodeJS.ErrnoException).code==='CLAND_CLAUDE_GENERATION_MISSING')throw new MissingClaudeGeneration(generation,forget);throw Object.assign(new Error('Claude adoption cleanup incomplete: worker receipt unavailable',{cause:error}),{code:'CLAND_NATIVE_INCOMPLETE'});}
    },
    run: async command => {
      mutation();
      const args=wire(command),connection=await connected(),token=randomUUID(),recoveryKey=randomUUID();
      const abort=()=>{try{void request(connection,'cancel-run',{token}).catch(()=>{});}catch{/* Revoked authority cannot cancel through the agent. */}};
      command.signal?.addEventListener('abort',abort,{once:true});
      try {
        const result=request(connection,'run-host',{...args,token,recoveryKey},(command.timeoutMs ?? 20000)+2000);
        if(command.signal?.aborted) abort();
        return await result as Awaited<ReturnType<Host['run']>>;
      } catch(error) {
        if((error as NodeJS.ErrnoException).code==='CLAND_AGENT_ADMISSION_REFUSED')throw error;
        if((error as NodeJS.ErrnoException).code==='CLAND_NATIVE_INCOMPLETE'){unknown.add(token);throw error;}
        await lostConnection(connection,token);return settle<Awaited<ReturnType<Host['run']>>>(token,recoveryKey);
      }
      finally {command.signal?.removeEventListener('abort',abort);}
    },
    identity: async pid => {const identity = await rpc<string|null>('identity',{pid}); return identity ? {pid,pidStarted:identity,pidIdentity:identity} : null;},
    alive: async row => {
      if (row.pid === null) {check();return false;}
      const observed = await host.identity(row.pid);
      return !!observed && (row.pidIdentity != null ? observed.pidIdentity === row.pidIdentity : row.pidStarted != null ? observed.pidStarted === row.pidStarted : true);
    },
    stop: async (row,options) => {
      check(); if (row.pid === null) return true;
      if (!row.pidIdentity) return false;
      const deadline=Date.now()+1000;
      for(;;){
        let admitted=false;
        const result = await prepared<boolean>('stop',{pid:row.pid,identity:row.pidIdentity}, async tree => { admitted=true;options?.authorize?.(tree); await options?.beforeSignal?.(tree); });
        if (result) options?.log?.({event:'harness-ended',pid:row.pid});
        // A tokenless refusal made no native stop attempt. Reconcile capture only;
        // never replay a committed stop whose signal outcome is unknown.
        if(result||admitted||!claudeProcesses.has(key(row.pid,row.pidIdentity))||Date.now()>=deadline)return result;
        await pause();
      }
    },
    statDirectory: path => rpc('statDirectory',{path}),
    realpath: path => rpc('realpath',{path}),
    fileType: path => rpc('fileType',{path}),
    readFile: async path => Buffer.from(await rpc<string>('readFile',{path}),'base64'),
    listFolder: path => rpc('listFolder',{path}),
    worktreeAdd: async options => {
      const {beforeInstall,...args} = options;
      const result = await prepared<{warning?:string;checkout?:import('./agent/prepared-checkout.ts').CheckoutOwnership}>('worktree',args,async () => beforeInstall?.());
      if (!result) throw new Error(`host ${o.name}: tunnel worktree not prepared`);
      try {const connection=await connected();if(!options.detached&&options.branch.startsWith('t/'))await updateRefWatch(admitted(connection),'watch',{path:options.path,branch:options.branch});}
      catch(error){throw Object.assign(error instanceof Error?error:new Error(String(error)),{code:'CLAND_HOST_OUTCOME_UNKNOWN'});}
      return result;
    },
    worktreeRemove: async options => {mutation();await rpc('worktreeRemove',options);},
    occupants: (path,sessions) => rpc('occupants',{path,sessions}),
    processes: () => rpc('processUsage'),
    quiesce: cancelPending,
    close: async () => {
      closed=true;cancelPending();clearTimeout(completionTimer);completionTimer=undefined;client=undefined;observer=undefined;
      for(const value of [...ownedClients])await closeConnection(value).catch(()=>{});
      await Promise.all([connecting?.catch(()=>{}),observing?.catch(()=>{})]);await completionWork;
      for(const value of [...ownedClients])await closeConnection(value).catch(()=>{});
      const failures=[...closeErrors.values()];
      if(unknown.size)failures.push(incomplete(unknown.values().next().value!));
      if(failures.length===1)throw failures[0];
      if(failures.length)throw new AggregateError(failures,`host ${o.name}: tunnel cleanup incomplete`);
    },
  };
  scheduleCompletions();
  return host;
}
