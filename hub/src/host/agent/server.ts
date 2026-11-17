import { availableMemory, memoryFloorDetails, requireSpawnMemory } from './memory.ts';
import { loginDiskOperation } from './login-disk.ts';
import { signIns } from './signin.ts';
import { SIGNIN_CAPABILITY, signInRefusalFields } from './signin-types.ts';
import { refPushOwner } from './ref-push.ts';
import { RefWatches, REF_FLUSH_CAPABILITY, REF_WATCH_CAPABILITY, REF_WATCH_STATUS_CAPABILITY } from './watch.ts';
import { claudeLaunches, CLAUDE_LAUNCH_CAPABILITY, CLAUDE_RESTORE_CAPABILITY } from './claude.ts';
import { processUsage } from './process-usage.ts';
import { remoteCommandEnvironment, loginExecutionEnvironment } from './command-environment.ts';
import { PreparedOperations } from './prepared.ts';
import { createConnection, createServer } from 'node:net';
import type { Socket } from 'node:net';
import { mkdir, chmod, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { totalmem } from 'node:os';
import type { ProcessHooks } from './processes.ts';
import { AgentProcesses } from './processes.ts';
import { agentBootId, observeProcesses } from './native.ts';
import { timingSafeEqual, randomUUID } from 'node:crypto';
import { checkpoint, checkpointRecovery, type CheckpointRecoveryIO } from './storage.ts';
import { run as runCommand, CommandOutput } from './command.ts';
import { agentOperations, parseAgentRun } from './operations.ts';
import { AGENT_PROTOCOL, PREPARED_HOST_CAPABILITY, MAX_LINE_BYTES, LineDecoder, parseRequest } from './protocol.ts';
export type AgentOptions = { checkpointRecoveryIO?:CheckpointRecoveryIO; checkpointCodeDir?:string; loginDiskCommand?: typeof runCommand; runDir: string; secret: string; version: string; env?: NodeJS.ProcessEnv; memoryIntervalMs?: number; processHooks?: ProcessHooks; socketChmod?: (path: string) => Promise<void>; cleanupError?: (error: unknown) => void; afterOperation?: (operation: string, connection: Socket) => void; beforeRunCancel?: (token: string) => Promise<void>; runStarted?: (token: string, connection: Socket, signal:AbortSignal) => void | Promise<void> };
export async function serveAgent(options: AgentOptions) {
  if (!options.secret) throw new Error('host secret required');
  // Invalid fake-host configuration must not begin recovery or acquire resources.
  const bootId = await agentBootId(options.env ?? process.env);
  await mkdir(options.runDir, { recursive: true, mode: 0o700 });
  await chmod(options.runDir, 0o700);
  const socket = join(options.runDir, 'agent.sock');
  // A killed agent leaves its Unix path behind. Refuse an active listener.
  await new Promise<void>((resolve, reject) => {
    const probe = createConnection(socket);
    probe.once('connect', () => { probe.destroy(); reject(new Error('agent already running')); });
    probe.once('error', error => {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') resolve();
      else if (code === 'ECONNREFUSED') void unlink(socket).then(resolve, reject);
      else reject(error);
    });
  });
  const connections = new Set<Socket>();
  const checkpointCleanup = checkpointRecovery([
    {directory:options.checkpointCodeDir??join(options.runDir,'../code'),basenames:['applied.json','restart-result.json']},
    {directory:options.runDir},
  ], async pids => {
    const observations = await observeProcesses(pids, options.env ?? process.env);
    return new Set([...observations].filter(([, proof]) => proof.ended).map(([pid]) => pid));
  },options.checkpointRecoveryIO,options.cleanupError);
  const authenticatedConnections = new Set<Socket>();
  const broadcast = (frame: unknown) => { for (const peer of authenticatedConnections) if (!peer.destroyed) peer.write(JSON.stringify(frame) + "\n"); };
  const processes = new AgentProcesses(options.runDir, options.env ?? process.env, broadcast, options.processHooks);
  const claude = claudeLaunches(options.runDir, options.env ?? process.env);
  const adoptedGenerations=new Set<string>();
  const adoptGeneration=async(worker:import('./claude.ts').ClaudeReceipt)=>{
    if(worker.released||await processes.confirmedClosed(worker))return true;
    if(!adoptedGenerations.has(worker.generation)){
      const closed=await processes.adopt(worker);
      if(closed)return true;
      adoptedGenerations.add(worker.generation);
    }
    return false;
  };
  let restoring:Promise<import('./claude.ts').ClaudeRestoreOutcome>|undefined;
  const restoreClaude=()=>restoring??=(async()=>{
    await processes.reconcile();
    return claude.restore(worker=>processes.confirmedClosed(worker),async worker=>{await adoptGeneration(worker);});
  })().finally(()=>{restoring=undefined;});
  const watches = new RefWatches(options.runDir, options.env ?? process.env, broadcast, refPushOwner(processes,options.env ?? process.env,options.runDir));
  const operations = agentOperations(options.env ?? process.env);
  await processes.load();
  const prepared = new PreparedOperations(options.runDir, options.env ?? process.env, processes);
  await prepared.start();
  const loginDisk = loginDiskOperation(options.env ?? process.env, processes, async(input,work)=>{
    const token=randomUUID();
    return prepared.runCommand(token,randomUUID(),{operation:'login-disk',...input},work);
  },()=>prepared.assertMutable(),options.env?.CLAND_FAKE_HOSTS?options.loginDiskCommand:undefined);
  let memoryWork = Promise.resolve();
  let memoryTimer: NodeJS.Timeout | undefined;
  let recoveryTimer: NodeJS.Timeout | undefined;
  let admitting = false;
  const pending = new Set<Promise<void>>();
  const cleanupFailures = new Set<unknown>();
  const signinFailures = new Set<unknown>();
  const retain = (work:Promise<void>) => {
    const observed:Promise<void>=work.catch(error=>{cleanupFailures.add(error);try{options.cleanupError?.(error);}catch{}}).then(()=>{pending.delete(observed);});
    pending.add(observed);
  };
  const server = createServer(connection => {
    if (!admitting) { connection.destroy(); return; }
    connections.add(connection);
    connection.on('close', () => { connections.delete(connection); authenticatedConnections.delete(connection); });
    connection.on('error', () => {});
    let authenticated = false, chain = Promise.resolve();
    const signin=signIns(options.runDir,options.env??process.env,processes,()=>loginDisk.enterMutation(),frame=>{if(!connection.destroyed)connection.write(JSON.stringify(frame)+'\n');});
    connection.once('close',()=>{retain(signin.close().catch(error=>{signinFailures.add(error);throw error;}));});
    const owned = new Set<string>();
    const fileOwners = new Set<string>();
    connection.once('close', () => { for (const token of fileOwners) prepared.fenceCommand(token); });
    const commands = new Map<string, AbortController>();
    const cancelled = new Set<string>();
    connection.once('close', () => {for(const [token,controller] of commands){
      prepared.fenceCommand(token);
      retain((async()=>{try{await options.beforeRunCancel?.(token);}finally{controller.abort();}})());
    }});
    connection.once('close', () => { retain(chain.then(async () => {
      const failures:unknown[]=[];
      for(const token of owned) {try{await prepared.abort(token);owned.delete(token);}catch(error){failures.push(error);}}
      if(failures.length)throw new AggregateError(failures,'connection prepared cleanup incomplete');
    })); });
    const decoder = new LineDecoder();
    connection.on('data', (chunk: Buffer) => {
      let lines: string[];
      try { lines = decoder.push(chunk); } catch { connection.destroy(); return; }
      for (const line of lines) {
        // Input and cancel must bypass an unmount waiting for this writer's close.
        if(authenticated){
          try{const request=parseRequest(line);if(request.op==='signin-write'||request.op==='signin-cancel'){
            retain((async()=>{try{const result=await (request.op==='signin-write'?signin.write(request.args):signin.cancel(request.args));if(!connection.destroyed)connection.write(JSON.stringify({id:request.id,ok:true,result})+'\n');}
            catch(error){if(!connection.destroyed)connection.write(JSON.stringify({id:request.id,ok:false,error:error instanceof Error?error.message:'sign-in failed'})+'\n');}})());
            continue;
          }}catch{}
        }
        // Cancellation must reach the in-flight command before the serial reply queue.
        if(authenticated) {
          try {const request=parseRequest(line); if(request.op === 'cancel-run') {const token=String(request.args.token);cancelled.add(token);commands.get(token)?.abort();}} catch {}
        }
        chain = chain.then(async () => {
          if (connection.destroyed || connection.writableEnded) return;
          let id: string | null = null;
          try {
            const request = parseRequest(line); id = request.id;
            if (request.op === 'hello') {
              const secret = request.args.secret;
              const valid = typeof secret === 'string' && Buffer.byteLength(secret) === Buffer.byteLength(options.secret) && timingSafeEqual(Buffer.from(secret), Buffer.from(options.secret));
              if (!valid || request.args.protocol !== AGENT_PROTOCOL) throw new Error('hello secret or protocol refused');
              authenticated = true; authenticatedConnections.add(connection);
              connection.write(JSON.stringify({ id, ok: true, result: { protocol: AGENT_PROTOCOL, version: options.version, pid: process.pid, bootId, capabilities: [SIGNIN_CAPABILITY, PREPARED_HOST_CAPABILITY, CLAUDE_LAUNCH_CAPABILITY, CLAUDE_RESTORE_CAPABILITY, REF_WATCH_CAPABILITY, REF_WATCH_STATUS_CAPABILITY, REF_FLUSH_CAPABILITY] } }) + '\n');
            } else {
              if (!authenticated) throw new Error('hello required');
              let result: unknown;
              if(['spawn','run','run-host','writeFile','publishFile','appendFile','makeDirectory','removePath','worktreeAdd','worktreeRemove'].includes(request.op))prepared.assertMutable();
              const releaseMutation=request.op==='login-disk'||['identity','alive','processes','native-receipts','processUsage','cancel-run','settle-prepared','watch-status','signin-start'].includes(request.op)?()=>{}:loginDisk.enterMutation(['stop','signal','prepare-stop','abort-prepared','remove-claude','forget-claude','unwatch'].includes(request.op));
              try { switch (request.op) {
                case 'signin-start':result=await signin.start(request.args);break;
                case 'watch-status': result=watches.status();break;
                case 'watch': await watches.watch(String(request.args.path),String(request.args.branch));result=null;break;
                case 'worktreeRemove': result=await watches.remove(String(request.args.path),String(request.args.root),async()=>{await operations.worktreeRemove!(request.args);return null;});break;
                case 'unwatch': await watches.unwatch(String(request.args.path));result=null;break;
                case 'flush': await watches.flush(typeof request.args.path==='string'?request.args.path:undefined);result=null;break;
                case 'restore-claude': {const outcome=await restoreClaude();result=request.args.report===true?outcome:null;break;}
                case 'adopt-claude': {
                  const worker=await claude.receipt(String(request.args.generation),worker=>processes.confirmedClosed(worker));
                  const closed=await adoptGeneration(worker);
                  result={process:{pid:worker.pid,pidStarted:worker.identity,pidIdentity:worker.identity},job:worker.job,session:worker.session,...(closed?{closed:true}:{}),...(worker.released?{released:true}:{})};break;
                }
                case 'forget-claude': await claude.forget(String(request.args.generation));adoptedGenerations.delete(String(request.args.generation));result=null;break;
                case 'remove-claude': await claude.remove(String(request.args.generation),worker=>processes.releaseAdoption(worker),worker=>processes.confirmedClosed(worker));adoptedGenerations.delete(String(request.args.generation));result=null;break;
                case 'native-receipts': result = processes.completionReceipts(); break;
                case 'processUsage': result = await processUsage(options.env ?? process.env); break;
                case 'login-disk': result = await loginDisk(request.args); break;
                case 'cancel-run': cancelled.delete(String(request.args.token)); result = null; break;
                case 'run-host': {
                  const token=typeof request.args.token==='string'?request.args.token:randomUUID();
                  const recoveryKey=typeof request.args.recoveryKey==='string'?request.args.recoveryKey:randomUUID();
                  const controller=new AbortController();
                  if(commands.has(token))throw new Error('command already admitted');
                  const {token:_token,recoveryKey:_recovery,...command}=request.args;
                  let parsed:ReturnType<typeof parseAgentRun>;
                  try{parsed=parseAgentRun({...command,env:remoteCommandEnvironment({...options.env??process.env,...command.env as NodeJS.ProcessEnv})});}
                  catch(error){throw Object.assign(error instanceof Error?error:new Error(String(error)),{code:'CLAND_AGENT_ADMISSION_REFUSED'});}
                  commands.set(token,controller);if(cancelled.delete(token))controller.abort();
                  try {result=await prepared.runCommand(token,recoveryKey,command,async()=>{
                    if(connection.destroyed)prepared.fenceCommand(token);
                    await options.runStarted?.(token,connection,controller.signal);
                    parsed={...parsed,env:await loginExecutionEnvironment(parsed.env,options.env??process.env)};
                    if(typeof command.claudeGeneration==='string'){await requireSpawnMemory(options.runDir,options.env??process.env);return claude.launch(parsed,command.claudeGeneration,controller.signal);}
                    return await runCommand(parsed.command,parsed.args,parsed.env,parsed.timeoutMs,false,controller.signal,'utf8',parsed.cwd,new CommandOutput(MAX_LINE_BYTES));
                  });} finally {commands.delete(token);}
                  break;
                }
                case 'prepare-publishFile': result = await prepared.prepare('publishFile', request.args); break;
                case 'prepare-appendFile': result = await prepared.prepare('appendFile', request.args); break;
                case 'prepare-spawn': result = await prepared.prepare('spawn', request.args); break;
                case 'prepare-stop': result = await prepared.prepare('stop', request.args); break;
                case 'prepare-worktree': result = await prepared.prepare('worktree', request.args); break;
                case 'commit-prepared': if (!owned.has(String(request.args.token))) throw new Error('prepared operation not owned'); result = await prepared.commit(String(request.args.token), request.args.install !== false); owned.delete(String(request.args.token)); fileOwners.delete(String(request.args.token)); break;
                case 'settle-prepared': result = await prepared.settle(String(request.args.token),String(request.args.recoveryKey)); break;
                case 'abort-prepared': if (!owned.has(String(request.args.token))) throw new Error('prepared operation not owned'); result = await prepared.abort(String(request.args.token)); owned.delete(String(request.args.token)); fileOwners.delete(String(request.args.token)); break;
                case 'spawn': result = await processes.spawn(request.args); break;
                case 'identity': result = await processes.identity(Number(request.args.pid)); break;
                case 'alive': result = await processes.alive(request.args); break;
                case 'signal': result = await processes.signal(request.args); break;
                case 'stop': result = await processes.stop(request.args); break;
                case 'processes': result = await processes.processes(); break;
                default: {
                  const operation = Object.hasOwn(operations, request.op) ? operations[request.op] : undefined;
                  if (!operation) throw new Error('unknown operation');
                  result = await operation(request.args);
                }
              }
              } finally {releaseMutation();}
              if (request.op.startsWith('prepare-') && result && typeof result === 'object' && Object.hasOwn(result, 'token') && typeof (result as {token?:unknown}).token === 'string') { const token = (result as {token:string}).token; owned.add(token); if (request.op === 'prepare-publishFile' || request.op === 'prepare-appendFile') fileOwners.add(token); }
              options.afterOperation?.(request.op,connection);
              const reply = JSON.stringify({ id, ok: true, result });
              if (Buffer.byteLength(reply) > MAX_LINE_BYTES) throw new Error('agent result exceeds frame cap');
              connection.write(reply + '\n');
            }
          } catch (error) {
            const frame = JSON.stringify({ id, ok: false, ...memoryFloorDetails(error), ...signInRefusalFields(error), error: error instanceof Error ? error.message : 'operation failed', ...(typeof (error as NodeJS.ErrnoException)?.code === 'string' ? {code:(error as NodeJS.ErrnoException).code} : {}) }) + '\n';
            if (!authenticated || /hello secret/.test(error instanceof Error ? error.message : '')) connection.end(frame); else connection.write(frame);
          }
        });
        retain(chain);
      }
    });
  });
  const close = async () => {
    admitting = false; clearInterval(memoryTimer); clearTimeout(recoveryTimer);
    let checkpointFailure:unknown;
    const checkpointClosing=checkpointCleanup.close().catch(error=>{checkpointFailure=error;});
    const peerCloses=[...connections].map(connection=>connection.closed?Promise.resolve():new Promise<void>(resolve=>connection.once('close',resolve)));
    for (const connection of connections) connection.destroy();
    await Promise.all(peerCloses);
    if (server.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await memoryWork;
    while(pending.size) await Promise.all([...pending]);
    const failures:unknown[]=[];
    await checkpointClosing;if(checkpointFailure)failures.push(checkpointFailure);
    try{await watches.close();}catch(error){failures.push(error);}
    try{await prepared.close();cleanupFailures.clear();}catch(error){failures.push(error);}
    try{await processes.drain();}catch(error){failures.push(error);}
    failures.push(...cleanupFailures);
    failures.push(...signinFailures);
    if(failures.length)throw new AggregateError(failures,'agent cleanup incomplete');
  };
  try {
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(socket, resolve); });
    await (options.socketChmod ? options.socketChmod(socket) : chmod(socket, 0o600));
    memoryTimer = setInterval(() => { memoryWork = memoryWork.then(async () => {
      await processes.reconcile();
      const availableBytes = await availableMemory(options.runDir, options.env ?? process.env);
      if(availableBytes===null)return;
      broadcast({ event: "memory", totalBytes: totalmem(), availableBytes });
    }).catch(() => {}); }, options.memoryIntervalMs ?? 5000);
    const identity = await processes.identity(process.pid);
    if (!identity) throw new Error('agent birth identity unavailable');
    await checkpoint(join(options.runDir, 'agent.pid'), { pid: process.pid, identity });
    await watches.start();
    admitting = true;
    recoveryTimer = setTimeout(() => { memoryWork = memoryWork.then(() => processes.reconcile()).catch(() => {}); }, 0);
    checkpointCleanup.start();
    return { socket, close };
  } catch (error) { await close(); throw error; }
}
