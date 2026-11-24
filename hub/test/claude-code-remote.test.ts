// T3: fake SSH + scripted Claude exercise native worker adoption, hooks and mod bridge.
// Native processes are required to prove detached worker capture and joined stop; fixture owns every writer.
import test, {type TestContext} from 'node:test';
import { assertFakeClaudeCensus } from './fake-claude-census.ts';
import assert from 'node:assert/strict';
import { testWaitMs, waitTimeoutMs } from './until.ts';
import { readFile, symlink, readdir, stat, chmod, mkdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { sshHostFixture } from './ssh-host-fixture.ts';
import { projectHub, connectUi, fakeClaude, eventually, startDaemon, killDaemon } from './harness.ts';
import { ClaudeCodeAdapter } from '../src/adapters/claude-code.ts';
import { Store } from '../src/hub/store.ts';
import { writeFile } from 'node:fs/promises';
import { SshTransport } from '../src/transport/ssh.ts';
import { layout } from '../src/project.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { sshHost } from '../src/host/ssh-host.ts';
import { AgentClient } from '../src/host/agent-client.ts';
import { FakeClock } from './fake-clock.ts';
import { realClock, type Clock } from '../src/hub/clock.ts';
import { observeProcesses } from '../src/host/agent/native.ts';
import { systemProcesses } from '../src/system-processes.ts';
import { spawn } from 'node:child_process';
import { ownProcess } from './process-cleanup.ts';
import { deliverRuntime, agentVersionHandoff } from '../src/host/code-delivery.ts';
import { recoveryScanOwner } from './recovery-scan.ts';
import { stageCase } from './stage-case-fixture.ts';
import { fenceFixtureCleanup } from './process-cleanup.ts';
import type { FixtureLifecycle } from './fixture-lifecycle.ts';
import { fixtureResource } from './fixture-lifecycle.ts';
import { ownedDatabases } from './owned-tracker.ts';
import { DatabaseSync } from 'node:sqlite';
import { abortable, within } from '../src/executor/droplet/deadline.ts';

/** The inner owner is the subject of close/repair assertions. Only this outer
 * owner receives test aborts; its original callback includes the entire proof.
 * Inner hooks and restoration cannot run until that continuation is joined. */
function proofOwner(t:TestContext, options:{clock?:Clock;timeoutMs?:number}={}) {
 fenceFixtureCleanup(t);
 const supervisor=stageCase(t,{native:true});
 const innerSignal=new AbortController().signal;
 const fixtures=new Proxy(supervisor.fixtures,{get(target,key){
   return key==='signal'?innerSignal:Reflect.get(target,key,target);
 }});
 return {close:supervisor.close,releaseOnClose:supervisor.releaseOnClose,
   run:(body:(inner:TestContext)=>Promise<void>)=>{
     const producer=supervisor.run(()=>body(fixtures));
     return within(abortable(producer,t.signal),options.timeoutMs??waitTimeoutMs(testWaitMs(120_000)),options.clock,()=>new Error('whole fixture proof observation expired')).catch(error=>{
       // Observation ends, ownership does not. This releases holds and joins
       // producer before the inner cleanup/restoration hooks can execute.
       void supervisor.close().catch(()=>{});
       throw error;
     });
   },
 };
}

function remoteStore(f:Pick<Awaited<ReturnType<typeof sshHostFixture>>,'root'|'addCleanup'>, lifecycle?:FixtureLifecycle, open?: (path:string)=>DatabaseSync) {
 let store:Store|undefined;
 const ownedOpen=ownedDatabases({requireClose:close=>{f.addCleanup(fixtureResource(lifecycle,close));}},()=>{store?.close();return undefined;});
 store=new Store(join(f.root,'.cland/hub.db'),path=>ownedOpen(path,open));
 return store;
}

async function remoteClaudeFixture(t:TestContext, options:{lifecycle?:FixtureLifecycle;memoryFloor?:boolean;upgrade?:boolean;nativeRefusal?:'aborted'|'spawn-error'|'pre-wire';sentAbort?:boolean;lostNativeReply?:boolean;refuseRoot?:boolean;failPrune?:boolean;failedResult?:boolean;failedAdoption?:boolean;stopCrash?:boolean;rollback?:boolean;settings?:(settings:{hooks:{SessionEnd:unknown[]}})=>void;awaitSignals?:boolean;signals?:Array<{pid:number;identity:string}>;stopHooks?:Pick<import('../src/host/agent/processes.ts').ProcessHooks,'beforeRemainingObservation'|'beforeSignals'>;setup?:(f:Awaited<ReturnType<typeof sshHostFixture>>,fake:Awaited<ReturnType<typeof fakeClaude>>)=>Promise<void>}={}) {
 let replySocket:import('node:net').Socket|undefined,nativeAbortHeld=false;
 const f=await sshHostFixture(t,{...(options.lifecycle?{lifecycle:options.lifecycle}:{}),startTransport:false,...(options.nativeRefusal==='aborted'?{beforeRun:async(signal:AbortSignal)=>{
   if(nativeAbortHeld)return;nativeAbortHeld=true;
   await eventually('native admission held until cancellation observed',()=>signal.aborted||undefined,testWaitMs());
   assert.equal(signal.aborted,true,'native execution is released only after positive cancellation');
 }}:{}),...(options.sentAbort?{afterOperation:(op:string,socket:import('node:net').Socket)=>{if(op==='run-host'&&!replySocket){replySocket=socket;socket.cork();}}}:{}),...(options.signals||options.stopHooks?{processHooks:{...options.stopHooks,...(options.signals?{beforeSignals:async(targets:readonly {pid:number;identity:string}[])=>{options.signals!.push(...targets);await options.stopHooks?.beforeSignals?.(targets);}}:{})}}:{})});
 const fake=await fakeClaude(t,{...(options.lifecycle?{lifecycle:options.lifecycle}:{}),awaitSignals:options.awaitSignals??true,stopCrash:options.stopCrash??false});
 await options.setup?.(f,fake);
 let code=join(f.fake.home,'code');
 if(options.upgrade){
  await f.transport.start();await eventually('upgrade carrier up',()=>f.transport.status().state==='up'||undefined,testWaitMs());
  const codeRoot=join(f.fake.home,'.cland-host/code'),bin=join(f.root,'offline-bin');await mkdir(bin);
  await writeFile(join(bin,'npm'),`#!/bin/sh\nln -s '${new URL('../../node_modules',import.meta.url).pathname}' node_modules\n`,{mode:0o700});
  const execute=f.transport.execute.bind(f.transport);
  f.transport.execute=script=>execute(`export PATH='${bin}':"$PATH"\n`+script);
  f.env.CLAND_SCP_BIN=new URL('./fakes/fake-scp.ts',import.meta.url).pathname;
  await deliverRuntime({transport:f.transport,codeRoot,node:process.execPath,version:'V1'});
  await f.host.close();await f.agent.close();
  const child=spawn('sh',[join(codeRoot,'V1/hub/src/host/agent/supervisor.sh'),f.fake.run,process.execPath,join(codeRoot,'V1/hub/src/host/agent/entry.ts')],{cwd:f.fake.home,env:fixtureEnvironment(f.root,process.env,{...f.env,CLAND_HOST_RUN_DIR:f.fake.run,CLAND_HOST_SECRET:f.secrets.readSecret('f1')}),stdio:'ignore'});
  f.addCleanup(ownProcess(undefined,child.pid));
  await eventually('V1 supervised readiness',async()=>{try{return JSON.parse(await readFile(join(codeRoot,'applied.json'),'utf8')).version==='V1'||undefined;}catch{return undefined;}},testWaitMs());
  const handoff=agentVersionHandoff({transport:f.transport,codeRoot,node:process.execPath,version:'V2'});
  await handoff.update('V1',new AbortController().signal);
  await eventually('V2 durable agent readiness',async()=>{try{return JSON.parse(await readFile(join(codeRoot,'applied.json'),'utf8')).version==='V2'||undefined;}catch{return undefined;}},testWaitMs());
  const upgraded=await AgentClient.connect(f.paths.agentSocket,f.secrets.readSecret('f1'));
  assert.equal(upgraded.hello.version,'V2');await upgraded.close();await handoff.ready();
  await f.transport.stop();
  code=join(codeRoot,'V2');
 }else await symlink(new URL('../../',import.meta.url).pathname,code);
 const remote={...f.layout,node:process.execPath,cli:join(code,'hub/bin/cland.ts'),spoke:join(code,'hub/bin/cland-spoke.ts'),modDir:join(code,'hub/mod/cland')};
 let carrier:SshTransport,launchedAdapter:ClaudeCodeAdapter;let credential='';let pruneFaultInjected=false;let releaseClaude:(()=>Promise<void>)|undefined;
 const machine=sshHost({name:'f1',layout:remote,transport:{status:()=>carrier.status(),forward:(...args)=>carrier.forward(...args),unforward:(...args)=>carrier.unforward(...args)},connect:()=>AgentClient.connect(f.paths.agentSocket,f.secrets.readSecret('f1'))});
 let lostToken='';
 if(options.lostNativeReply||options.sentAbort||options.nativeRefusal==='aborted'){
   const request=AgentClient.prototype.request;
   t.mock.method(AgentClient.prototype,'request',async function(this:AgentClient,...args:Parameters<AgentClient['request']>){
     const pending=request.apply(this,args);
     if(options.nativeRefusal==='aborted'&&args[0]==='run-host'&&typeof args[1].claudeGeneration==='string'&&!failureInjected){
       failureInjected=true;
       // Arm native cancellation on the same socket before its serial run begins.
       const cancelled=request.call(this,'cancel-run',{token:args[1].token});
       const result=await pending;await cancelled;return result;
     }
     const result=await pending.catch(error=>{if(options.sentAbort&&args[0]==='run-host'){lostToken=String(args[1].token);throw Object.assign(new Error('sent abort reply unavailable'),{code:'CLAND_NATIVE_INCOMPLETE'});}throw error;});
     if((options.lostNativeReply||options.sentAbort)&&args[0]==='run-host'&&typeof args[1].claudeGeneration==='string'&&!lostToken){lostToken=String(args[1].token);throw Object.assign(new Error('planted lost native reply after PID receipt'),{code:'CLAND_NATIVE_INCOMPLETE'});}
     return result;
   });
 }
 const launchClaude=machine.launchClaude!.bind(machine);
 const sentController=new AbortController();
 machine.launchClaude=async(command,generation)=>{const path=command.args[command.args.indexOf('--settings')+1]!;const settings=JSON.parse(await readFile(path,'utf8'));credential=settings.env.CLAND_LAUNCH_TOKEN;if(options.settings){options.settings(settings);await writeFile(path,JSON.stringify(settings),{mode:0o600});}const refuse=options.nativeRefusal==='spawn-error'&&!failureInjected;if(refuse)failureInjected=true;const preWire=options.nativeRefusal==='pre-wire'&&!failureInjected;if(preWire)failureInjected=true;
 const pending=launchClaude(preWire?{...command,signal:AbortSignal.abort()}:refuse?{...command,command:join(f.fake.home,'cleanup incomplete missing-claude')}:options.sentAbort?{...command,signal:sentController.signal}:command,generation);
 if(options.sentAbort&&!failureInjected){failureInjected=true;await eventually('native reply corked after worker persistence',()=>replySocket||undefined,testWaitMs());sentController.abort();replySocket!.destroy();}
 const result=await pending;if(options.failedResult&&!failureInjected){failureInjected=true;throw Object.assign(new Error('planted lost launch result'),{code:'CLAND_NATIVE_INCOMPLETE'});}return result;};
 let stopGate:{entered:ReturnType<typeof Promise.withResolvers<void>>;release:ReturnType<typeof Promise.withResolvers<void>>}|undefined;
 let failureInjected=false,allowFailedStop=!options.failedAdoption&&!options.failedResult&&!options.lostNativeReply&&!options.sentAbort;
 const stop=machine.stop.bind(machine);machine.stop=async(...args)=>{if(!allowFailedStop)return false;const gate=stopGate;if(gate){gate.entered.resolve();await gate.release.promise;stopGate=undefined;}return stop(...args);};
 const adopt=machine.adopt!.bind(machine);machine.adopt=async generation=>{const receipt=await adopt(generation);releaseClaude=receipt.release;if(options.failedAdoption&&!failureInjected){failureInjected=true;throw Object.assign(new Error('planted lost adoption reply'),{code:'CLAND_NATIVE_INCOMPLETE'});}if(options.rollback){await eventually('worker startup joined before rollback trigger',async()=>(await fake.log(receipt.job)).includes('session ready')||undefined);const closing=launchedAdapter.close();if(closing)void closing.catch(()=>{});}return receipt;};
 let expectedIncompleteOperation:string|undefined;
 f.addCleanup(async()=>{if(expectedIncompleteOperation)await assert.rejects(machine.close(),error=>(error as {code?:string;operation?:string}).code==='CLAND_HOST_OUTCOME_UNKNOWN'&&(error as {operation?:string}).operation===expectedIncompleteOperation);else await machine.close();});
 let aliveReceipts=0;
 const nativeAlive=machine.alive.bind(machine);
 machine.alive=async row=>{const result=await nativeAlive(row);aliveReceipts++;return result;};
 const clock=new FakeClock();
 const env=fixtureEnvironment(f.root,f.env,{...fake.env,HOME:f.fake.home,CLAUDE_CONFIG_DIR:fake.home});
 const factory=(host:import('../src/adapters/contract.ts').AdapterHost)=>{
   const adapter=launchedAdapter=new ClaudeCodeAdapter(host,{clock:{now:()=>new Date(),setInterval:clock.setInterval.bind(clock),clearInterval:clock.clearInterval.bind(clock),setTimeout:clock.setTimeout.bind(clock),clearTimeout:clock.clearTimeout.bind(clock)},bin:new URL('./fakes/claude-code/claude',import.meta.url).pathname,pollMs:5,reexecGraceMs:1});
   const forget=adapter.forget.bind(adapter);adapter.forget=id=>{if(options.failPrune&&!pruneFaultInjected){pruneFaultInjected=true;throw new Error('planted post-clear prune interruption');}forget(id);};
   const spawn=adapter.spawn.bind(adapter);adapter.spawn=request=>spawn({...request,accountEnv:env});return adapter;
 };
 const startHub=()=>projectHub(t,f.root,{}, {...(options.lifecycle?{lifecycle:options.lifecycle}:{}),hosts:[machine],adapters:[factory]});
 const hub=await startHub();
 const {setRoleKey}=await import('../src/roles/editor.ts');const rolesFile=join(f.root,'.cland/roles.toml');await writeFile(rolesFile,setRoleKey(await readFile(rolesFile,'utf8'),'implementer','launch','writable_roots',['.']));
 f.addCleanup(()=>hub.stop());
 const store=remoteStore(f,options.lifecycle);
 const record=f.records.get('f1')!,secret=f.secrets.readSecret('f1');store.hosts.insert({...record,clientKeyPath:'/fake',knownHosts:'fake'},secret);
 await writeFile(remote.discoveryFile,JSON.stringify({remote:true,version:'test',secret,socket:join(f.fake.run,'hub.sock'),spoke:`ws+unix:${join(f.fake.run,'spoke.sock')}:/`}),{mode:0o600});
 carrier=new SshTransport({root:f.root,record,secrets:f.secrets,hubSocket:layout(f.root).socket,spokeSocket:layout(f.root).spokeSocket,remoteRun:f.fake.run,supervisor:f.supervisor,agentCommand:['stub'],env:f.env,readinessPollMs:5,reconnectDelayMs:()=>10});
 f.addCleanup(()=>carrier.stop());await carrier.start();await eventually('carrier up',()=>carrier.status().state==='up'||undefined);
 const ui=await connectUi(t,hub.discovery);await ui.request({type:'subscribe'});
 if(options.refuseRoot)await chmod(fake.home,0o755);
 const reply=await ui.request({type:'session.launch',name:'worker',harness:'claude-code',role:'implementer',host:'f1',cwd:f.fake.home},10000);
 assert.equal(reply.ok,!options.rollback&&!options.failedAdoption&&!options.failedResult&&!options.refuseRoot&&!options.nativeRefusal&&!options.lostNativeReply&&!options.sentAbort&&!options.memoryFloor,reply.error);
 if(options.lostNativeReply||options.sentAbort)expectedIncompleteOperation=lostToken;
 const row=(reply.value as {process:{pid:number;pidIdentity:string;harnessId:string}}|undefined)?.process!;
 return {f,fake,machine,nativeLaunchClaude:launchClaude,remote,clock,ui,hub,startHub,row,launchError:reply.error,expectIncompleteClose:(operation:string)=>{expectedIncompleteOperation=operation;},allowFailedStop:()=>{allowFailedStop=true;},holdFailedStop:()=>{const gate={entered:Promise.withResolvers<void>(),release:Promise.withResolvers<void>()};stopGate=gate;return gate;},nativeAlive,aliveReceipts:()=>aliveReceipts,credential:()=>credential,releaseClaude:()=>releaseClaude?.()};
}

for(const name of ['worker','second'])test(`remote Claude pre-spawn root refusal permits immediate ${name==='worker'?'same-name':'different-name'} launch`,{timeout:8 * testWaitMs() + 120000},async t=>{
 const d=await remoteClaudeFixture(t,{refuseRoot:true});
 assert.match(d.launchError!,/account config root.*0700/);
 assert.equal((await d.fake.calls()).filter(call=>call.args[0]==='--bg').length,0,'refused generation never entered native spawn');
 const {ProcessTable}=await import('../src/adapters/processes.ts');
 const table=new ProcessTable(join(d.f.root,'.cland/hub.db'));d.f.addCleanup(async()=>table.close());
 assert.deepEqual(table.pendingStops(),[],'pre-spawn refusal settled failed-launch supervision');
 await chmod(d.fake.home,0o700);
 const reply=await d.ui.request({type:'session.launch',name,harness:'claude-code',role:'implementer',host:'f1',cwd:d.f.fake.home},testWaitMs());
 assert.equal(reply.ok,true,reply.error);
 const row=(reply.value as {process:{pid:number;pidIdentity:string}}).process;
 const birth=await d.machine.identity(row.pid);
 const workers=JSON.parse(await readFile(join(d.f.fake.run,'processes.json'),'utf8')) as Array<{pid:number;identity:string}>;
 assert.ok(workers.some(worker=>worker.pid===row.pid&&worker.identity===birth?.pidIdentity),'successful relaunch has durable native ownership');
 const stopped=await d.ui.request({type:'session.stop',session:name},testWaitMs());assert.equal(stopped.ok,true,stopped.error);
});

for(const mode of ['aborted','spawn-error','pre-wire','lost-reply','sent-abort'] as const)for(const name of ['worker','second'])test(`remote Claude native ${mode} ${name==='worker'?'same-name':'different-name'} retry`,{timeout:8 * testWaitMs() + 120000},async t=>{
 const unknown=mode==='lost-reply'||mode==='sent-abort';
 const d=await remoteClaudeFixture(t,mode==='sent-abort'?{sentAbort:true}:mode==='lost-reply'?{lostNativeReply:true}:{nativeRefusal:mode});
 const calls=(await d.fake.calls()).filter(call=>call.args[0]==='--bg');
 assert.equal(calls.length,unknown?1:0,'native call receipt distinguishes executed from absent spawn');
 if(!unknown&&mode!=='pre-wire')assert.deepEqual(await readdir(join(d.f.fake.run,'claude')),[],'no-process terminal reply follows pending checkpoint removal');
 const reply=await d.ui.request({type:'session.launch',name,harness:'claude-code',role:'implementer',host:'f1',cwd:d.f.fake.home},testWaitMs());
 if(unknown){
   assert.equal(reply.ok,false);assert.match(reply.error!,name==='worker'?/failed launch of "worker" is still supervised; cleanup is pending/:/tunnel outcome unknown for .*; storage remains fenced/);
   const workers=JSON.parse(await readFile(join(d.f.fake.run,'processes.json'),'utf8')) as Array<{pid:number;identity:string}>;
   assert.ok(workers.some(worker=>worker.pid>0&&worker.identity),'lost reply follows persisted native PID');
 }else{
   assert.equal(reply.ok,true,'initial: '+d.launchError+'; retry: '+reply.error);
   const {ProcessTable}=await import('../src/adapters/processes.ts');const table=new ProcessTable(join(d.f.root,'.cland/hub.db'));d.f.addCleanup(async()=>table.close());
   assert.deepEqual(table.pendingStops(),[]);
   const row=(reply.value as {process:{pid:number}}).process,birth=await d.machine.identity(row.pid);
   const workers=JSON.parse(await readFile(join(d.f.fake.run,'processes.json'),'utf8')) as Array<{pid:number;identity:string}>;
   assert.ok(workers.some(worker=>worker.pid===row.pid&&worker.identity===birth?.pidIdentity));
   const stopped=await d.ui.request({type:'session.stop',session:name},testWaitMs());assert.equal(stopped.ok,true,stopped.error);
 }
});

async function joinInitialHookWriters(d:Awaited<ReturnType<typeof remoteClaudeFixture>>, timeoutMs:number):Promise<void>{
 const rows=await systemProcesses(undefined,undefined,undefined,false,d.f.env);
 const pids=rows.filter(row=>row.group===d.row.pid&&row.command.includes(d.remote.cli)&&/\bhook\s+(?!bridge(?:\s|$))/.test(row.command.replaceAll("'",'').replaceAll('"',''))).map(row=>row.pid);
 if(!pids.length)return;
 const pins=await eventually('initial hook native birth or exit receipts',async()=>{const proof=await observeProcesses(pids,d.f.env);return pids.every(pid=>proof.get(pid)?.identity||proof.get(pid)?.ended)?proof:undefined;},timeoutMs);
 const exits=await eventually('initial hook writers positively exited',async()=>{
   const proof=await observeProcesses(pids,d.f.env);
   return pids.every(pid=>proof.get(pid)?.ended||!!pins.get(pid)?.identity&&!!proof.get(pid)?.identity&&proof.get(pid)!.identity!==pins.get(pid)!.identity)?proof:undefined;
 },timeoutMs);
 assert.ok(pids.every(pid=>exits.get(pid)?.ended||!!pins.get(pid)?.identity&&!!exits.get(pid)?.identity&&exits.get(pid)!.identity!==pins.get(pid)!.identity),'every captured initial hook birth has a positive exit receipt');
}

test('T-1730 C2 upgraded runtime launches Claude with connected mod bridge',{timeout:8 * testWaitMs() + 120000},async t=>{
 fenceFixtureCleanup(t);
 const scope=stageCase(t,{native:true});
 await scope.wait('upgraded whole callback',()=>scope.run(async step=>{
 let gate='',started='';
 const d=await scope.wait('upgraded fixture setup',()=>step(()=>remoteClaudeFixture(scope.fixtures,{lifecycle:scope,upgrade:true,awaitSignals:false,setup:async(f,fake)=>{
   gate=join(f.root,'hook-release');started=join(f.root,'hook-started');
   const preload=join(f.root,'held-hook.mjs');
   await writeFile(preload,`import fs from 'node:fs';
if(process.argv.includes('mod-turn-start')&&!fs.existsSync(${JSON.stringify(gate)}))await new Promise(resolve=>{const check=()=>{if(fs.existsSync(${JSON.stringify(gate)})){watcher.close();resolve();}};const watcher=fs.watch(${JSON.stringify(f.root)},check);fs.writeFileSync(${JSON.stringify(started)},String(process.pid));check();});\n`);
   fake.env.NODE_OPTIONS+=' --import='+preload;
   scope.releaseOnClose(()=>{writeFileSync(gate,'release');});
 }})),waitTimeoutMs(testWaitMs(60_000)));
 const {ui,fake,row}=d;
 await ui.request({type:'topic.send',topic:'general',text:'@worker upgraded hello',to:['worker']});
 await eventually('upgraded Claude bridge delivers answer',()=>ui.frames.find(frame=>frame.type==='message'&&JSON.stringify(frame).includes('pong:'))||undefined,testWaitMs());
 await eventually('upgraded native turn completed',async()=>(await fake.log(row.harnessId)).includes('session.measure done')||undefined,testWaitMs());
 const pid=await eventually('held hook native PID',async()=>Number(await readFile(started,'utf8').catch(()=>''))||undefined,testWaitMs());
 assert.ok((await observeProcesses([pid],d.f.env)).get(pid)?.identity,'completed turn can still have a held native hook');
 await writeFile(gate,'release');
 await joinInitialHookWriters(d,testWaitMs());
 assert.equal((await observeProcesses([pid],d.f.env)).get(pid)?.ended,true,'completed turn joins its fire-and-forget hook');
 assert.ok(ui.frames.some(frame=>frame.type==='message'&&JSON.stringify(frame).includes('pong:')));
 }),waitTimeoutMs(testWaitMs(120_000)));
});

for(const boundary of ['timeout','abort'])test(`remote proof supervisor joins its ${boundary} continuation before inner cleanup`,async t=>{
 const abort=new AbortController(),hooks:Array<()=>Promise<void>>=[];
 const controlled={name:`controlled ${boundary} proof`,signal:abort.signal,after:(hook:()=>Promise<void>)=>hooks.push(hook)} as unknown as TestContext;
 const clock=new FakeClock(Date.now()); // Only the observation timer uses this clock.
 const owner=proofOwner(controlled,{clock,timeoutMs:1});
 const setup=Promise.withResolvers<void>(),hold=Promise.withResolvers<void>(),continued=Promise.withResolvers<void>(),resume=Promise.withResolvers<void>();
 const marker={value:'original'};
 let released=false,proofDone=false,closed=false;
 owner.releaseOnClose(()=>{released=true;hold.resolve();});
 t.after(async()=>{hold.resolve();resume.resolve();await owner.close();for(const hook of hooks)await hook();});
 const result=owner.run(async inner=>{
   fenceFixtureCleanup(inner);
   const scope=stageCase(inner,{native:true});
   await scope.run(async()=>{scope.patch(marker,'value','held');scope.requireClose(async()=>{closed=true;});});
   setup.resolve();
   await hold.promise;
   assert.equal(inner.signal.aborted,false,'outer cancellation retains exclusive cleanup authority');
   continued.resolve(); // Positive receipt: the proof resumed after cancellation.
   await resume.promise;
   proofDone=true;
 });
 const rejected=assert.rejects(result,boundary==='timeout'?/whole fixture proof observation expired/:/controlled proof abort/);
 await within(setup.promise,waitTimeoutMs(testWaitMs()),undefined,()=>new Error('proof control setup incomplete'));
 if(boundary==='timeout')await clock.advance(1);else abort.abort(new Error('controlled proof abort'));
 await rejected;
 await within(continued.promise,waitTimeoutMs(testWaitMs()),undefined,()=>new Error('cancelled proof continuation missing'));
 assert.equal(released,true);
 assert.equal(proofDone,false);
 assert.equal(closed,false,'inner required close waits for the retained proof continuation');
 assert.equal(marker.value,'held','inner restoration cannot run while the proof is held');
 const cleanup=owner.close();
 resume.resolve();
 await cleanup;
 assert.equal(proofDone,true);
 assert.equal(closed,true);
 assert.equal(marker.value,'original','restoration follows joined proof and positive inner close');
});

for(const rejected of ['SSH','Claude'])test(`shared remote fixtures retain both roots until a rejected ${rejected} close is repaired`, {timeout:8 * testWaitMs()},async t=>{
 const owner=proofOwner(t);
 await owner.run(async t=>{
 fenceFixtureCleanup(t);
 const scope=stageCase(t,{native:true});
 let refuse=true;
 owner.releaseOnClose(()=>{refuse=false;});
 let f:Awaited<ReturnType<typeof sshHostFixture>>|undefined;
 let fake:Awaited<ReturnType<typeof fakeClaude>>|undefined;
 const removers=new Map<string,()=>Promise<void>>();
 const lifecycle:FixtureLifecycle={requireClose:scope.requireClose,adoptRoot:(root,remove)=>{scope.adoptRoot(root);removers.set(root,remove);}};
 await scope.wait('repair control whole setup',()=>scope.run(async step=>{
   f=await scope.wait('repair SSH setup',()=>step(()=>sshHostFixture(scope.fixtures,{lifecycle,startTransport:false,afterNativeJoin:async()=>{if(refuse&&rejected==='SSH')throw new Error('controlled fixture close rejected');}})),waitTimeoutMs(testWaitMs()));
   fake=await scope.wait('repair Claude setup',()=>step(()=>fakeClaude(scope.fixtures,{lifecycle,writerClock:{...realClock,now:()=>{if(refuse&&rejected==='Claude')throw new Error('controlled Claude close rejected');return new Date();}}})),waitTimeoutMs(testWaitMs()));
 }),waitTimeoutMs(testWaitMs(60_000)));
 // Exercise the real required-close fence; repair after observing retention.
 try {
   await assert.rejects(scope.close(),rejected==='SSH'?/SSH fixture cleanup incomplete/:/controlled Claude close rejected/);
   for(const root of [f!.root,fake!.home])await scope.wait('registered removal refuses unconfirmed close',()=>assert.rejects(removers.get(root)!(),/resource close unconfirmed/),waitTimeoutMs(testWaitMs()));
   assert.equal((await stat(f!.root)).isDirectory(),true);
   assert.equal((await stat(fake!.home)).isDirectory(),true);
   await assert.rejects(scope.restore(),/resource close unconfirmed/);
 } finally { refuse=false; }
 await scope.close();
 await assert.rejects(stat(f!.root),{code:'ENOENT'});
 await assert.rejects(stat(fake!.home),{code:'ENOENT'});
 await scope.restore();
 });
});

for(const rejected of ['hub','Store','already-closed Store'])test(`remote fixture partial ${rejected} acquisition keeps both roots until required close`,{timeout:8 * testWaitMs()},async t=>{
 const owner=proofOwner(t);
 await owner.run(async t=>{
 fenceFixtureCleanup(t);
 const scope=stageCase(t,{native:true});
 const removers=new Map<string,()=>Promise<void>>();
 const lifecycle:FixtureLifecycle={requireClose:scope.requireClose,adoptRoot:(root,remove)=>{scope.adoptRoot(root);removers.set(root,remove);}};
 let refuse=true,closed=false;
 owner.releaseOnClose(()=>{refuse=false;});
 const partial:FixtureLifecycle={...lifecycle,requireClose:close=>scope.requireClose(async()=>{if(refuse)throw new Error('controlled partial close rejected');await close();closed=true;})};
 let f:Awaited<ReturnType<typeof sshHostFixture>>|undefined,fake:Awaited<ReturnType<typeof fakeClaude>>|undefined,db:DatabaseSync|undefined,closeCalls=0;
 await scope.wait('partial acquisition whole setup',()=>scope.run(async step=>{
   f=await scope.wait('partial SSH setup',()=>step(()=>sshHostFixture(scope.fixtures,{lifecycle,startTransport:false})),waitTimeoutMs(testWaitMs()));
   fake=await scope.wait('partial Claude setup',()=>step(()=>fakeClaude(scope.fixtures,{lifecycle})),waitTimeoutMs(testWaitMs()));
   if(rejected==='hub')await scope.wait('partial hub rejection',()=>assert.rejects(step(()=>projectHub(scope.fixtures,f!.root,{}, {lifecycle:partial,configureTracker:()=>{throw new Error('controlled hub constructor rejected');}})),/controlled hub constructor rejected/),waitTimeoutMs(testWaitMs()));
   else assert.throws(()=>remoteStore(f!,partial,path=>{
     db=new DatabaseSync(path);
     const nativeClose=db.close.bind(db);
     scope.patch(db,'close',()=>{closeCalls++;nativeClose();});
     scope.patch(db,'function',()=>{throw new Error('controlled Store constructor rejected');});
     return db;
   }),/controlled Store constructor rejected/);
   // Model a constructor which already closed its handle before returning
   // the rejection. A newer Store may itself have supplied that receipt.
   if(rejected==='already-closed Store'&&db!.isOpen)db!.close();
 }),waitTimeoutMs(testWaitMs(60_000)));
 try {
   await assert.rejects(scope.close(),/controlled partial close rejected/);
   assert.equal(closed,false,'the rejected required close has no positive receipt');
   for(const root of [f!.root,fake!.home]){
     await scope.wait('partial acquisition registered removal refused',()=>assert.rejects(removers.get(root)!(),/resource close unconfirmed/),waitTimeoutMs(testWaitMs()));
     assert.equal((await stat(root)).isDirectory(),true);
   }
   await assert.rejects(scope.restore(),/resource close unconfirmed/);
 } finally { refuse=false; }
 await scope.close();
 assert.equal(closed,true,'the registered partial owner positively returned from close');
 if(db){assert.equal(db.isOpen,false);assert.equal(closeCalls,1,'constructor-owned closure must not be repeated');}
 for(const root of [f!.root,fake!.home])await assert.rejects(stat(root),{code:'ENOENT'});
 await scope.restore();
 });
});

test('remote Claude frame launch adopts its worker and delivers through host hooks and bridge', {timeout:8 * testWaitMs() + 120000},async t=>{
 const {f,fake,machine,remote,clock,ui,hub,row,nativeAlive,aliveReceipts,releaseClaude}=await remoteClaudeFixture(t);
 const rows=JSON.parse(await readFile(join(f.fake.run,'processes.json'),'utf8')) as Array<{pid:number;identity:string}>;
 row.pidIdentity=(await machine.identity(row.pid))!.pidIdentity!;
 assert.ok(rows.some(worker=>worker.pid===row.pid&&worker.identity===row.pidIdentity));
 assert.match(row.pidIdentity,/^linux:/);assert.equal(await machine.alive(row),true);
 const mark=ui.frames.length;
 await ui.request({type:'topic.send',topic:'general',text:'@worker remote hello',to:['worker']});
 await eventually('remote answer',()=>ui.frames.find(frame=>frame.type==='message'&&JSON.stringify(frame).includes('pong:'))||undefined,testWaitMs());
 await eventually('both native turns completed',async()=>((await fake.log(row.harnessId)).match(/session.measure done/g)??[]).length>=2||undefined);
 const signals=ui.frames.slice(mark).filter(frame=>frame.type==='session.state'&&frame.session==='worker');
 assert.ok(signals.some(frame=>frame.state==='busy'&&frame.source==='hook'));
 assert.ok(signals.some(frame=>frame.state==='idle'&&frame.source==='hook'));
 const privateDirectory=join(remote.runDirectory,'sessions');
 const allFiles=async(directory:string):Promise<string[]>=>{
   const found:string[]=[];for(const entry of await readdir(directory,{withFileTypes:true})){
     const path=join(directory,entry.name);if(entry.isDirectory())found.push(...await allFiles(path));else if(entry.isFile())found.push(path);
   }return found;
 };
 const privateFiles=(await allFiles(privateDirectory)).filter(path=>path.endsWith('.json'));
 const mcp=JSON.parse(await readFile(privateFiles.find(path=>path.endsWith('/mcp.json'))!,'utf8'));
 const settings=JSON.parse(await readFile(privateFiles.find(path=>path.endsWith('/settings.json'))!,'utf8'));
 assert.equal(mcp.mcpServers.cland.command,remote.node);assert.deepEqual(mcp.mcpServers.cland.args,[remote.spoke]);
 assert.equal(mcp.mcpServers.cland.env.CLAND_HUB_FILE,remote.discoveryFile);
 assert.equal(settings.env.CLAND_HUB_FILE,remote.discoveryFile);assert.equal(settings.env.CLAND_CLI,remote.cli);assert.equal(settings.env.CLAND_NODE,remote.node);
 assert.ok(JSON.stringify(settings.hooks).includes(remote.discoveryFile));assert.ok(JSON.stringify(settings.hooks).includes(remote.cli));
 const discovery=JSON.parse(await readFile(remote.discoveryFile,'utf8'));assert.equal(discovery.secret,f.secrets.readSecret('f1'));assert.notEqual(discovery.secret,hub.discovery.secret);assert.equal((await stat(fake.home)).mode&0o777,0o700);
 const credential=mcp.mcpServers.cland.env.CLAND_LAUNCH_TOKEN;
 assert.ok(credential);
 const scan=async()=>{
   const matches:string[]=[];for(const path of [...await allFiles(f.fake.home),...await allFiles(fake.home)])if((await readFile(path)).includes(credential))matches.push(path);return matches.sort();
 };
 const jobFile=join(fake.home,'jobs',row.harnessId+'.json');
 assert.deepEqual(await scan(),[...privateFiles,jobFile].sort());
 const sibling=join(fake.home,'jobs','sibling.json');await writeFile(sibling,'sibling-job');
 for(const path of privateFiles)assert.equal((await stat(path)).mode&0o777,0o600);
 assert.ok(privateFiles.every(path=>path.startsWith(f.fake.home+'/')));
 const before=(await fake.calls()).length;
 for(let i=0;i<4;i++){const previous=aliveReceipts();await clock.advance(5);await eventually('Host liveness poll completed',()=>aliveReceipts()>previous||undefined,{ timeoutMs: 1000, behaviour: "post-signal receipt deadline" });}
 assert.equal((await fake.calls()).length,before,'polls spawn no short-lived Claude command');
 assert.equal((await fake.calls()).filter(call=>call.args[0]==='agents').length,1);
 const stopped=await ui.request({type:'session.stop',session:'worker'},10000);assert.equal(stopped.ok,true,stopped.error);
 assert.equal(await nativeAlive(row),false);
 await releaseClaude();await releaseClaude();
 assert.deepEqual(await scan(),[]);
 await assert.rejects(stat(jobFile),{code:'ENOENT'});assert.equal(await readFile(sibling,'utf8'),'sibling-job');
 for(const path of privateFiles)await assert.rejects(stat(path),{code:'ENOENT'});
});

test('older host agent refuses Claude launch capability before starting a command',async t=>{
 const f=await sshHostFixture(t);
 const older=sshHost({name:'f1',layout:f.layout,transport:f.transport,connect:async()=>{
   const client=await AgentClient.connect(f.paths.agentSocket,f.secrets.readSecret('f1'));
   client.hello.capabilities=client.hello.capabilities?.filter(value=>value!=='claude-launch-adopt-v1') ?? [];return client;
 }});f.addCleanup(()=>older.close());
 await assert.rejects(older.launchClaude!({command:'/never-run',args:['--bg'],env:{},cwd:f.fake.home},'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),/missing capability claude-launch-adopt-v1/);
});

for(const asynchronous of [false,true])test(asynchronous?'Claude hook born across root exit remains unacquired':'Claude TERM-resistant SessionEnd hook is captured and killed by native birth', {timeout:8 * testWaitMs() + 120000},async t=>{
 const {ownProcess}=await import('./process-cleanup.ts');
 const {stopClaude,claudeProcessMembers,CLAUDE_STOP_GRACE_MS}=await import('../src/host/agent/claude-stop.ts');
 let marker='';let extraHook:unknown;
 const d=await remoteClaudeFixture(t,{awaitSignals:!asynchronous,settings:settings=>{settings.hooks.SessionEnd.push({hooks:[extraHook]});},setup:async(f)=>{
   marker=join(f.fake.home,'hook-ready');const script=join(f.fake.home,'session-end.cjs');
   await writeFile(script,"const fs=require('fs');process.on('SIGTERM',()=>{});fs.writeFileSync(process.argv[2],String(process.pid));setInterval(()=>{},1000);");
   const quote=(value:string)=>"'"+value.replaceAll("'","'\\''")+"'";
   extraHook={type:'command',command:[process.execPath,script,marker].map(quote).join(' '),async:asynchronous};
 }});
 await eventually('worker startup completed',async()=>(await d.fake.log(d.row.harnessId)).includes('session ready')||undefined);
 const root=(await d.machine.identity(d.row.pid))!;
 await eventually('initial model turn completed',async()=>(await d.fake.log(d.row.harnessId)).includes('session.measure done')||undefined);
 const connection=await AgentClient.connect(d.f.paths.agentSocket,d.f.secrets.readSecret('f1'));d.f.addCleanup(()=>connection.close());
 const captured=await eventually('durable live worker tree capture',async()=>{const result=await connection.request('prepare-stop',{pid:root.pid,identity:root.pidIdentity}) as {token:string|null;targets?:Array<{pid:number;identity:string}>};return result.token&&result.targets?{token:result.token,targets:result.targets}:undefined;});
 if(captured.token)await connection.request('abort-prepared',{token:captured.token});
 assert.ok(captured.targets,'captured running worker');
 const diagnostics:string[]=[],checkpoints:number[][]=[],signals:Array<{pid:number;signal:string}>=[];let termSent=false,rootExitConfirmed=false;
 const ready=eventually('SessionEnd native hook PID receipt',async()=>{try{return Number(await readFile(marker,'utf8'))||undefined;}catch{return undefined;}},{ timeoutMs: 2000, behaviour: "post-signal receipt deadline" });
 const stopping=stopClaude({pid:root.pid!,identity:root.pidIdentity!},captured.targets,d.f.env,async(targets,signal)=>{
   for(const target of [...targets].reverse()){
     const observed=await d.machine.identity(target.pid);if(!observed)continue;if(observed.pidIdentity!==target.identity)return false;
     try{process.kill(target.pid,signal);signals.push({pid:target.pid,signal});if(target.pid===root.pid&&signal==='SIGTERM')termSent=true;}catch(error){if((error as NodeJS.ErrnoException).code!=='ESRCH'||await d.machine.identity(target.pid)!==null)throw error;}
   }return true;
 },asynchronous?300:CLAUDE_STOP_GRACE_MS,async targets=>{checkpoints.push(targets.map(target=>target.pid));},{diagnostic:reason=>diagnostics.push(reason),snapshot:async()=>{
   if(asynchronous&&termSent){await eventually('native root exit before late-hook acquisition census',async()=>(await observeProcesses([root.pid!],d.f.env)).get(root.pid!)?.ended||undefined,{ timeoutMs: 1000, behaviour: "post-signal receipt deadline" });rootExitConfirmed=true;}
   return claudeProcessMembers(d.f.env);
 }});
 const pid=await ready;d.f.addCleanup(ownProcess(undefined,pid));
 const result=await stopping;
 if(asynchronous){assert.equal(rootExitConfirmed,true);assert.equal(result,null);assert.equal(signals.some(row=>row.pid===pid),false);assert.ok(await d.machine.identity(pid),'uncaptured writer remains alive for independent cleanup');}
 else {assert.ok(result,diagnostics.join('; '));assert.ok(checkpoints.some(rows=>rows.includes(pid)));assert.ok(signals.some(row=>row.pid===pid&&row.signal==='SIGKILL'));assert.equal(await d.machine.identity(pid),null);}
});

test('remote Claude failed adoption handshake joins rollback and removes its credential copies only',{timeout:8 * testWaitMs() + 120000},async t=>{
 const d=await remoteClaudeFixture(t,{rollback:true,setup:async(_f,fake)=>{
   const {mkdir}=await import('node:fs/promises');await mkdir(join(fake.home,'jobs'));
   await writeFile(join(fake.home,'jobs','sibling.json'),'{}');
 }});
 const credential=d.credential();assert.ok(credential);
 const files=async(directory:string):Promise<string[]>=>{
   const result:string[]=[];for(const entry of await readdir(directory,{withFileTypes:true})){
     const path=join(directory,entry.name);if(entry.isDirectory())result.push(...await files(path));else if(entry.isFile())result.push(path);
   }return result;
 };
 for(const root of [d.f.fake.home,d.fake.home]){
   const scanned=await files(root);
   assert.ok(scanned.length>0,'rollback scan inspected retained fixture files');
   for(const path of scanned)assert.equal((await readFile(path)).includes(credential),false,'rollback scan contains no token');
 }
 assert.deepEqual((await readdir(join(d.fake.home,'jobs'))).filter(path=>/^[^.]+\.json$/.test(path)),['sibling.json']);
 assert.equal(await readFile(join(d.fake.home,'jobs','sibling.json'),'utf8'),'{}');
});

test('agent restart does not inherit Claude dynamic child acquisition from its serialized marker',{timeout:8 * testWaitMs() + 120000},async t=>{
 const {serveAgent}=await import('../src/host/agent/server.ts');
 const {ownProcess}=await import('./process-cleanup.ts');
 let marker='',hook:unknown;
 const d=await remoteClaudeFixture(t,{settings:settings=>settings.hooks.SessionEnd.push({hooks:[hook]}),setup:async(f)=>{
   marker=join(f.fake.home,'recovery-hook-ready');const script=join(f.fake.home,'recovery-hook.cjs');
   await writeFile(script,"const fs=require('fs');process.on('SIGTERM',()=>{});fs.writeFileSync(process.argv[2],String(process.pid));setInterval(()=>{},1000);");
   const quote=(value:string)=>"'"+value.replaceAll("'","'\\''")+"'";
   hook={type:'command',command:[process.execPath,script,marker].map(quote).join(' ')};
 }});
 await eventually('initial turn settled before restart',async()=>(await d.fake.log(d.row.harnessId)).includes('session.measure done')||undefined);
 const root=(await d.machine.identity(d.row.pid))!;
 const beforeRestart=await AgentClient.connect(d.f.paths.agentSocket,d.f.secrets.readSecret('f1'));
 try {
   const plan=await beforeRestart.request('prepare-stop',{pid:root.pid,identity:root.pidIdentity}) as {token:string|null};
   assert.ok(plan.token,'the pre-restart tree has a durable capture');await beforeRestart.request('abort-prepared',{token:plan.token});
 }finally{await beforeRestart.close();}
 await d.f.agent.close();
 const signalled:number[]=[];
 const restarted=await serveAgent({runDir:d.f.fake.run,secret:d.f.secrets.readSecret('f1'),version:'test',env:d.f.env,processHooks:{beforeSignals:async targets=>{signalled.push(...targets.map(target=>target.pid));}}});d.f.addCleanup(()=>restarted.close());
 const client=await AgentClient.connect(d.f.paths.agentSocket,d.f.secrets.readSecret('f1'));d.f.addCleanup(()=>client.close());
 const ready=eventually('recovered owner SessionEnd PID',async()=>{try{return Number(await readFile(marker,'utf8'))||undefined;}catch{return undefined;}},{ timeoutMs: 2000, behaviour: "post-signal receipt deadline" });
 const stopping=client.request('stop',{pid:root.pid,identity:root.pidIdentity});
 const pid=await ready;d.f.addCleanup(ownProcess(undefined,pid));
 assert.equal(await stopping,false,'recovered marker grants no dynamic capture authority');
 assert.equal(signalled.includes(pid),false);assert.ok(await client.request('identity',{pid}),'unowned hook remains alive for independent cleanup');
});

test('hub restart after tree closure re-adopts its durable generation and releases the job',{timeout:8 * testWaitMs() + 120000},async t=>{
 const owner=recoveryScanOwner(t),{scope}=owner;
 await scope.run(async admit=>{
 const {ProcessTable}=await import('../src/adapters/processes.ts');
 const d=await scope.wait('remote recovery fixture setup',()=>admit(()=>remoteClaudeFixture(scope.fixtures)));
 owner.adoptRoot(d.f.root);owner.adoptRoot(d.fake.home);
 await scope.wait('native recovery action',()=>admit(async()=>{
 await eventually('worker turn settled before closure',async()=>(await d.fake.log(d.row.harnessId)).includes('session.measure done')||undefined);
 const table=new ProcessTable(join(d.f.root,'.cland/hub.db'));d.f.addCleanup(async()=>table.close());
 const process=table.get('worker')!;
 const records=(await readdir(join(d.f.fake.run,'claude'))).filter(path=>path.endsWith('.json'));
 const generation=records[0]!.slice(0,-5);
 const job=join(d.fake.home,'jobs',d.row.harnessId+'.json');
 assert.equal(await d.machine.stop(process),true);
 assert.equal((await stat(job)).isFile(),true,'tree closure retains native job metadata');
 await d.hub.stop();
 const restarted=await d.startHub();d.f.addCleanup(()=>restarted.stop());
 await eventually('durable recovered cleanup retired the row',()=>table.get('worker')?.status==='exited'||table.get('worker')?.status==='stopped'||undefined,{ timeoutMs: 3000, behaviour: "post-signal receipt deadline" });
 await assert.rejects(stat(job),{code:'ENOENT'});
 await assert.rejects(stat(join(d.f.fake.run,'claude',generation+'.json')),{code:'ENOENT'});
 }));
 await admit(()=>owner.scan([d.f.fake.home,d.fake.home],d.credential()));
 });
});

for(const mode of ['release','release-restart','forget-restart'] as const)test(`lost native ${mode} reply settles without replaying native stop`,{timeout:8 * testWaitMs() + 120000},async t=>{
 const d=await remoteClaudeFixture(t);let treeStops=0;const stop=d.machine.stop.bind(d.machine);d.machine.stop=async(...args)=>{treeStops++;return stop(...args);};
 // Setup includes native hook subprocesses (the mod allows 15s per post),
 // rather than a two-second product turn-latency guarantee.
 await eventually('native turn settled before release fault',async()=>(await d.fake.log(d.row.harnessId)).includes('session.measure done')||undefined);
 if(mode==='forget-restart')d.f.dropNextForgetReply();else d.f.dropNextReleaseReply();
 const first=await d.ui.request({type:'session.stop',session:'worker'},5000);
 assert.equal(first.ok,false);assert.match(first.error!,mode==='forget-restart'?/forget cleanup incomplete/:/release cleanup incomplete/);
 const jobs=join(d.fake.home,'jobs',d.row.harnessId+'.json');await assert.rejects(stat(jobs),{code:'ENOENT'},'agent accepted release before reply loss');
 const files=async(root:string):Promise<string[]>=>{const result:string[]=[];for(const entry of await readdir(root,{withFileTypes:true})){
   const path=join(root,entry.name);if(entry.isDirectory())result.push(...await files(path));else if(entry.isFile())result.push(path);
 }return result;};
 const privateFiles=(await files(join(d.remote.runDirectory,'sessions'))).filter(path=>path.endsWith('.json'));
 assert.equal(privateFiles.length,mode==='forget-restart'?0:2);
 for(const path of privateFiles)assert.equal((await readFile(path)).includes(d.credential()),true);
 const before=(await d.fake.calls()).filter(call=>call.args[0]==='stop').length;assert.equal(before,1);
 if(mode==='release'){
   const second=await d.ui.request({type:'session.stop',session:'worker'},5000);assert.equal(second.ok,true,second.error);
 }else{
   await d.hub.stop();const restarted=await d.startHub();d.f.addCleanup(()=>restarted.stop());
   const {ProcessTable}=await import('../src/adapters/processes.ts');const table=new ProcessTable(join(d.f.root,'.cland/hub.db'));d.f.addCleanup(async()=>table.close());
   await eventually('durable cleanup retired the recovered generation',()=>table.get('worker')?.status==='exited'||table.get('worker')?.status==='stopped'||undefined,{ timeoutMs: 3000, behaviour: "post-signal receipt deadline" });
 }
 assert.equal(treeStops,1,'released recovery never signals processes');
 assert.equal((await d.fake.calls()).filter(call=>call.args[0]==='stop').length,before);
 for(const root of [d.f.fake.home,d.fake.home])for(const path of await files(root))assert.equal((await readFile(path)).includes(d.credential()),false);
});

test('late SessionEnd after the recovery snapshot never grants an adopted closed receipt',{timeout:8 * testWaitMs() + 120000},async t=>{
 const {serveAgent}=await import('../src/host/agent/server.ts');
 const {ownProcess}=await import('./process-cleanup.ts');
 const {within}=await import('../src/executor/droplet/deadline.ts');
 let marker='',hook:unknown;
 const d=await remoteClaudeFixture(t,{awaitSignals:false,settings:settings=>settings.hooks.SessionEnd.push({hooks:[hook]}),setup:async f=>{
   marker=join(f.fake.home,'late-hook-ready');const script=join(f.fake.home,'late-hook.cjs');
   await writeFile(script,"const fs=require('fs');process.on('SIGTERM',()=>{});fs.writeFileSync(process.argv[2],String(process.pid));setInterval(()=>{},1000);");
   const quote=(value:string)=>"'"+value.replaceAll("'","'\\''")+"'";
   hook={type:'command',command:[process.execPath,script,marker].map(quote).join(' '),async:true};
 }});
 await eventually('initial turn completed before held capture',async()=>(await d.fake.log(d.row.harnessId)).includes('session.measure done')||undefined);
 const root=(await d.machine.identity(d.row.pid))!;
 await d.f.agent.close();
 const entered=Promise.withResolvers<void>(),release=Promise.withResolvers<void>();let armed=false;
 const signalled:number[]=[];
 const restarted=await serveAgent({runDir:d.f.fake.run,secret:d.f.secrets.readSecret('f1'),version:'test',env:d.f.env,processHooks:{beforeCheckpoint:async phase=>{if(armed&&phase==='recover'){armed=false;entered.resolve();await release.promise;}},beforeSignals:async targets=>{signalled.push(...targets.map(target=>target.pid));}}});d.f.addCleanup(()=>restarted.close());
 const client=await AgentClient.connect(d.f.paths.agentSocket,d.f.secrets.readSecret('f1'));d.f.addCleanup(()=>client.close());
 const generations=(await readdir(join(d.f.fake.run,'claude'))).filter(name=>name.endsWith('.json'));assert.equal(generations.length,1);
 const generation=generations[0]!.slice(0,-5);
 await client.request('adopt-claude',{generation});
 armed=true;const preparing=client.request('prepare-stop',{pid:root.pid,identity:root.pidIdentity});
 try{
   await within(entered.promise,1000);
   const ready=eventually('late SessionEnd durable PID',async()=>{try{return Number(await readFile(marker,'utf8'))||undefined;}catch{return undefined;}},{ timeoutMs: 2000, behaviour: "post-signal receipt deadline" });
   process.kill(root.pid!,'SIGTERM');
   const pid=await ready;d.f.addCleanup(ownProcess(undefined,pid));
   await eventually('root positively absent with the late hook still alive',async()=>!await d.machine.identity(root.pid!)||undefined,{ timeoutMs: 1000, behaviour: "post-signal receipt deadline" });
   release.resolve();
   const result=await within(preparing,1000) as {settled?:boolean;token?:string};
   assert.notEqual(result.settled,true,'an uncaptured live writer prevents a closed receipt');
   if(result.token)await client.request('abort-prepared',{token:result.token});
   await assert.rejects(client.request('remove-claude',{generation}),/cleanup ownership incomplete/);
   assert.ok(await d.machine.identity(pid));assert.equal(signalled.includes(pid),false);
   const record=JSON.parse(await readFile(join(d.f.fake.run,'claude',generation+'.json'),'utf8'));
   assert.notEqual(record.released,true);assert.ok((await readFile(join(record.privateDirectory,'settings.json'),'utf8')).includes(d.credential()));
 }finally{release.resolve();await Promise.allSettled([preparing]);}
});

for(const failing of [false,true])test(`terminal remote PID settlement ${failing?'holds the row on native failure':'cleans before publishing exit'} without recurring CLI`,{timeout:8 * testWaitMs() + 120000},async t=>{
 const d=await remoteClaudeFixture(t,{stopCrash:failing});
 await eventually('worker ready before terminal event',async()=>(await d.fake.log(d.row.harnessId)).includes('session.measure done')||undefined);
 const rolesBefore=await d.ui.request({type:'role.list'});
 if(failing)await writeFile(join(d.fake.home,'logged-out'),'');
 const before=(await d.fake.calls()).length;
 const absent=eventually('terminal root PID observed absent',async()=>!await d.machine.identity(d.row.pid)||undefined,{ timeoutMs: 2000, behaviour: "post-signal receipt deadline" });
 process.kill(d.row.pid,'SIGTERM');await absent;
 const rows=async()=>{const result=await d.ui.request({type:'session.list'});return (result.value as {processes:Array<{name:string;status:string;stateReason?:string}>}).processes;};
 const settled=await eventually('terminal settlement durable row',async()=>{
   await d.clock.advance(5);const row=(await rows()).find(row=>row.name==='worker');
   return row&&(failing?row.stateReason?.includes('native job stop is unconfirmed'):row.status==='exited')?row:undefined;
 },{ timeoutMs: 2500, behaviour: "post-signal receipt deadline" });
 const calls=(await d.fake.calls()).slice(before);assert.equal(calls.filter(call=>call.args[0]==='stop').length,1);
 assert.equal(calls.filter(call=>call.args[0]==='agents').length,failing?1:0);
 const generations=await readdir(join(d.f.fake.run,'claude'));
 if(failing){assert.equal(settled.status,'running');assert.deepEqual(((await d.ui.request({type:'role.list'})).value as {roles:Array<{role:string;holders:Array<{name:string}>}>}).roles.map(role=>[role.role,role.holders.map(holder=>holder.name)]),(rolesBefore.value as {roles:Array<{role:string;holders:Array<{name:string}>}>}).roles.map(role=>[role.role,role.holders.map(holder=>holder.name)]));assert.equal(generations.length,1);}
 else assert.deepEqual(generations,[]);
 const scan=async(directory:string):Promise<string[]>=>{
   const result:string[]=[];for(const entry of await readdir(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())result.push(...await scan(path));else if(entry.isFile()&&(await readFile(path)).includes(d.credential()))result.push(path);}return result;
 };
 const tokens=[...await scan(d.f.fake.home),...await scan(d.fake.home)];assert.equal(tokens.length,failing?3:0);
 const count=(await d.fake.calls()).length;
 for(let i=0;i<4;i++){await d.clock.advance(5);await rows();}
 assert.equal((await d.fake.calls()).length,count,'terminal settlement does not become a recurring native poll');
});

for(const mode of ['descendant','reparented','retirement'] as const)test(mode==='retirement'?'pinned native hook exit between prepare and commit settles without a manual re-stop':mode==='reparented'?'an unowned reparented child stays unacquired across explicit stops':'adopted Claude settles one descendant born between stop capture and commit before any signal',{timeout:8 * testWaitMs() + 120000},async t=>{
 const reparented=mode==='reparented',retiring=mode==='retirement';
 const signalled:Array<{pid:number;identity:string}>=[];
 const {ownProcess}=await import('./process-cleanup.ts');
 let trigger='',ready='',childReady='',childExit='',hook:unknown,exitHook:unknown;
 const d=await remoteClaudeFixture(t,{awaitSignals:false,...(reparented?{signals:signalled}:{}),settings:settings=>{
   const hooks=settings.hooks as unknown as Record<string,Array<{hooks:Array<{async?:boolean}>}>>;
   hooks.SessionStart!.push({hooks:[hook as {async?:boolean}]});hooks.SessionEnd!.push({hooks:[exitHook as {async?:boolean}]});
   for(const entry of hooks.SessionEnd!)for(const command of entry.hooks)command.async=false;
 },setup:async f=>{
   trigger=join(f.fake.home,'churn-trigger');ready=join(f.fake.home,'churn-parent-ready');childReady=join(f.fake.home,'churn-child-ready');childExit=join(f.fake.home,'churn-child-exit');
   const script=join(f.fake.home,'churn.cjs'),builder=new URL('./fixture-environment.ts',import.meta.url).pathname;
   await writeFile(script,`const fs=require('fs'),{spawn}=require('child_process'),{pathToFileURL}=require('url');\n(async()=>{const [trigger,ready,childReady,childExit,builder,root]=process.argv.slice(2);const {fixtureEnvironment}=await import(pathToFileURL(builder));let started=false;const watcher=fs.watch(require('path').dirname(trigger),()=>{if(started||!fs.existsSync(trigger))return;started=true;watcher.close();${retiring?'process.exit(0);':`const descendant=spawn(process.execPath,['-e',"const fs=require('fs'),end=process.argv[2];const watcher=fs.watch(require('path').dirname(end),()=>{if(fs.existsSync(end))watcher.close();});fs.writeFileSync(process.argv[1],String(process.pid));",childReady,childExit],{env:fixtureEnvironment(root,process.env),stdio:'ignore'});${reparented?'descendant.unref();process.exit(0);':''}`}});fs.writeFileSync(ready,String(process.pid));})().catch(error=>{console.error(error);process.exitCode=1;});\n`);
   const quote=(value:string)=>"'"+value.replaceAll("'","'\\''")+"'";
   hook={type:'command',command:[process.execPath,script,trigger,ready,childReady,childExit,builder,f.root].map(quote).join(' '),async:true};
   exitHook={type:'command',command:[process.execPath,'-e',reparented?"void 0":"require('fs').writeFileSync(process.argv[1],'done')",childExit].map(quote).join(' ')};
 }});
 const parent=await eventually('native churn producer armed',async()=>{try{return Number(await readFile(ready,'utf8'))||undefined;}catch{return undefined;}});
 await eventually('initial turn completed before stop capture',async()=>(await d.fake.log(d.row.harnessId)).includes('session.measure done')||undefined);
 await joinInitialHookWriters(d,testWaitMs());
 const pinnedRoot=reparented?await d.machine.identity(d.row.pid):null;if(reparented)assert.ok(pinnedRoot?.pidIdentity);
 const original=d.machine.stop.bind(d.machine);let child=0,admissions=0,childCleanup:ReturnType<typeof ownProcess>|undefined;
 d.machine.stop=(row,options)=>original(row,{...options,beforeSignal:async tree=>{
   admissions++;if(reparented&&admissions>1)return;assert.equal(admissions,1,'the admitted stop is never replayed');
   if(retiring){
     assert.ok(tree.some(target=>target.pid===parent),'the retiring hook belongs to the approved pinned tree');
     const gone=eventually('pinned hook native exit before commit',async()=>(await observeProcesses([parent],d.f.env)).get(parent)?.ended||undefined,{ timeoutMs: 1000, behaviour: "post-signal receipt deadline" });
     child=parent;await writeFile(trigger,'go');await gone;return;
   }
   const born=eventually('post-capture child native PID',async()=>{try{const pid=Number(await readFile(childReady,'utf8'));return pid&&await d.machine.identity(pid)?pid:undefined;}catch{return undefined;}},{ timeoutMs: 1000, behaviour: "post-signal receipt deadline" });
   await writeFile(trigger,'go');child=await born;childCleanup=ownProcess(undefined,child);d.f.addCleanup(async()=>{await childCleanup?.();});
   if(reparented)await eventually('captured parent positively absent before commit',async()=>!await d.machine.identity(parent)||undefined,{ timeoutMs: 1000, behaviour: "post-signal receipt deadline" });
   assert.equal(tree.some(target=>target.pid===child),false,'child was absent from the approved capture');
 }});
 const result=await d.ui.request({type:'session.stop',session:'worker'},5000);
 if(reparented){
   assert.equal(result.ok,false);assert.match(result.error!,/could not stop/);assert.equal(admissions,1);
   assert.ok(await d.machine.identity(child),'unowned writer lifetime is independent of SessionEnd');
   const {AgentProcesses}=await import('../src/host/agent/processes.ts');const {mkdir}=await import('node:fs/promises');
   const restoredRoot=join(d.f.fake.home,'restored-orphan-observer');await mkdir(restoredRoot);
   await writeFile(join(restoredRoot,'processes.json'),await readFile(join(d.f.fake.run,'processes.json')));
   let restoredSignals=0;
   const restored=new AgentProcesses(restoredRoot,fixtureEnvironment(restoredRoot,d.f.env),()=>{},{beforeSignals:async()=>{restoredSignals++;}});
   await restored.load();d.f.addCleanup(()=>restored.drain());
   const held={pid:d.row.pid,identity:pinnedRoot!.pidIdentity};
   await assert.rejects(restored.captureForStop(held),/authority unknown/,'serialized state grants no signal or closure authority');
   const again=await d.ui.request({type:'session.stop',session:'worker'},5000);assert.equal(again.ok,false,'explicit re-stop cannot promote an unowned orphan');assert.equal(admissions,1);
   assert.ok(await d.machine.identity(child));assert.equal((await d.fake.calls()).filter(call=>call.args[0]==='stop').length,0);
   const rows=(await d.ui.request({type:'session.list'})).value as {processes:Array<{name:string;status:string;stateReason?:string}>};const row=rows.processes.find(row=>row.name==='worker')!;assert.equal(row.status,'running');assert.match(row.stateReason!,/cleanup-incomplete/);
   const roles=(await d.ui.request({type:'role.list'})).value as {roles:Array<{role:string;holders:Array<{name:string}>}>};assert.ok(roles.roles.find(role=>role.role==='implementer')?.holders.some(holder=>holder.name==='worker'));
   assert.equal(signalled.some(target=>target.pid===child),false,'no signal ever reaches the unowned orphan');
   assert.ok(signalled.some(target=>target.pid===d.row.pid&&target.identity===pinnedRoot!.pidIdentity),'root TERM uses the pinned birth');
   await childCleanup?.();
   await assert.rejects(restored.captureForStop(held),/authority unknown/,"positive absence grants no closure authority");
   assert.equal(restoredSignals,0,'recovered observations grant no signal authority');
   const heldAgain=await d.ui.request({type:'session.stop',session:'worker'},5000);assert.equal(heldAgain.ok,false,'independent orphan cleanup cannot prove closure');assert.match(heldAgain.error!,/authority unknown/);assert.equal(admissions,1,'unknown authority never admits another signal');
   const heldRows=JSON.parse(await readFile(join(d.f.fake.run,'processes.json'),'utf8')) as Array<{pid:number;authority:string;ended?:boolean}>;assert.ok(heldRows.some(row=>row.pid===d.row.pid&&row.authority==='unknown'&&!row.ended));
 }else{assert.equal(result.ok,true,result.error);assert.equal(admissions,1);}
 assert.equal(await d.machine.identity(child),null,'owned cleanup has joined the child by pinned birth');
 assert.equal((await d.fake.calls()).filter(call=>call.args[0]==='stop').length,reparented?0:1);
});

for(const mode of ['adoption','result','missing-receipt','missing-state','prune-failure'] as const)test(`failed Claude launch restart ${mode}`,{timeout:8 * testWaitMs() + 120000},async t=>{
 const missing=mode==='missing-receipt'||mode==='missing-state';
 const {ProcessTable}=await import('../src/adapters/processes.ts');const {unlink}=await import('node:fs/promises');
 const d=await remoteClaudeFixture(t,mode==='result'?{failedResult:true}:{failedAdoption:true,failPrune:mode==='prune-failure'});
 const table=new ProcessTable(join(d.f.root,'.cland/hub.db'));d.f.addCleanup(async()=>table.close());
 const pending=table.pendingStops()[0]!;assert.ok(pending,'failed launch has a durable owner: '+d.launchError);assert.equal(pending.process.host,'f1');
 assert.deepEqual(pending.files?.undo,[],'private MCP/settings are outside generic rollback');assert.deepEqual(pending.files?.children,[],'generic process stop cannot bypass Claude settlement');
 if(mode==='result'){
   const retry=await d.ui.request({type:'session.launch',name:'worker',harness:'claude-code',role:'implementer',host:'f1',cwd:d.f.fake.home},testWaitMs());
   assert.equal(retry.ok,false);assert.match(retry.error!,/failed launch of "worker" is still supervised; cleanup is pending/);
 }
 const sid=pending.process.sessionId,credential=pending.ownership!.credential;
 assert.equal(credential,d.credential(),'the pending owner retains the original launch credential');
 const generation=JSON.parse(await readFile(join(d.f.fake.run,'claude',(await readdir(join(d.f.fake.run,'claude')))[0]!),'utf8')) as {generation:string;privateDirectory:string;pid:number};
 assert.ok((await readFile(join(generation.privateDirectory,'settings.json'),'utf8')).includes(credential));
 const held=await d.ui.request({type:'role.list'});assert.ok((held.value as {roles:Array<{holders:Array<{name:string}>}>}).roles.some(role=>role.holders.some(holder=>holder.name==='worker')));
 await d.hub.stop();
 if(mode==='missing-receipt'){await unlink(join(d.f.fake.run,'claude',generation.generation+'.json'));d.expectIncompleteClose('claude-adopt:'+generation.generation);}
 if(mode==='missing-state'){const state=new Store(join(d.f.root,'.cland/hub.db'));state.clearMeta('claude-failed:'+sid);state.close();}
 d.allowFailedStop();
 const gate=!missing?d.holdFailedStop():undefined;const starting=d.startHub();
 if(gate){const {within}=await import('../src/executor/droplet/deadline.ts');try{await within(gate.entered.promise,2000);const heldStore=new Store(join(d.f.root,'.cland/hub.db'));assert.equal(heldStore.roleOf('worker'),'implementer','role remains held while native settlement is outstanding');heldStore.close();assert.equal(table.pendingStops().length,1);assert.ok(await d.machine.identity(generation.pid));assert.ok((await readFile(join(generation.privateDirectory,'settings.json'),'utf8')).includes(credential));}finally{gate.release.resolve();}}
 const restarted=await starting;d.f.addCleanup(()=>restarted.stop());const ui=await connectUi(t,restarted.discovery);
 if(missing){
   const receipt=await eventually('missing generation durable cleanup-incomplete cause',()=>{const entry=table.pendingStops()[0];return entry&&entry.error.includes('cleanup-incomplete')?entry:undefined;},{ timeoutMs: 2000, behaviour: "post-signal receipt deadline" });
   assert.equal(receipt.process.sessionId,sid);assert.equal(receipt.ownership!.credential,credential);
   const roles=(await ui.request({type:'role.list'})).value as {roles:Array<{holders:Array<{name:string}>}>};assert.ok(roles.roles.some(role=>role.holders.some(holder=>holder.name==='worker')));
   assert.ok((await readFile(join(generation.privateDirectory,'settings.json'),'utf8')).includes(credential));assert.ok(await d.machine.identity(generation.pid));
 }else{
   await eventually('durable native settlement completed',()=>table.pendingStops().length===0||undefined,{ timeoutMs: 2500, behaviour: "post-signal receipt deadline" });
   assert.equal(await d.machine.identity(generation.pid),null);await assert.rejects(stat(generation.privateDirectory),{code:'ENOENT'});
   assert.deepEqual(await readdir(join(d.f.fake.run,'claude')),[]);assert.equal((await d.fake.calls()).filter(call=>call.args[0]==='--bg').length,1,'unknown launch is never replayed');
   const roles=(await ui.request({type:'role.list'})).value as {roles:Array<{holders:Array<{name:string}>}>};assert.equal(roles.roles.some(role=>role.holders.some(holder=>holder.name==='worker')),false);
   const scan=async(root:string):Promise<void>=>{for(const entry of await readdir(root,{withFileTypes:true})){const path=join(root,entry.name);if(entry.isDirectory())await scan(path);else if(entry.isFile())assert.equal((await readFile(path)).includes(credential),false);}};
   await scan(d.f.fake.home);await scan(d.fake.home);
   const metadata=new Store(join(d.f.root,'.cland/hub.db'));d.f.addCleanup(async()=>metadata.close());
   if(mode==='prune-failure'){
     assert.equal(JSON.parse(metadata.meta('claude-failed:'+sid)!).phase,'settled','post-clear interruption retains the terminal marker');
     assert.deepEqual(JSON.parse(metadata.meta('launch-settlement-prunes')!),[[sid,'claude-code']]);
     const calls=(await d.fake.calls()).length;let nativeStops=0,adopts=0;const stop=d.machine.stop.bind(d.machine),adopt=d.machine.adopt!.bind(d.machine);
     d.machine.stop=(...args)=>{nativeStops++;return stop(...args);};d.machine.adopt=generation=>{adopts++;return adopt(generation);};
     await restarted.stop();const third=await d.startHub();d.f.addCleanup(()=>third.stop());
     await eventually('post-clear marker pruned after restart',()=>!metadata.meta('claude-failed:'+sid)||undefined,{ timeoutMs: 1500, behaviour: "post-signal receipt deadline" });
     assert.deepEqual(JSON.parse(metadata.meta('launch-settlement-prunes')!),[]);assert.equal(table.pendingStops().length,0);assert.equal(nativeStops,0);assert.equal(adopts,0);assert.equal((await d.fake.calls()).length,calls,'orphan marker prune performs no native work');
   }else{assert.equal(metadata.meta('claude-failed:'+sid),'');assert.deepEqual(JSON.parse(metadata.meta('launch-settlement-prunes')!),[]);}
 }
});

for(const boundary of ['mid-turn','completed turn'] as const)test(`remote Claude root-first stop ${boundary}`,{timeout:8 * testWaitMs() + 120000},async t=>{
 let d:Awaited<ReturnType<typeof remoteClaudeFixture>>,arm='',request='',ready='',childReady='',release='',startHook:unknown,endHook:unknown,admitted=false;
 let completed=0;
 d=await remoteClaudeFixture(t,boundary==='mid-turn'?{setup:async f=>{
   arm=join(f.fake.home,'held-turn-arm');request=join(f.fake.home,'held-turn-spawn');ready=join(f.fake.home,'held-turn-ready');childReady=join(f.fake.home,'held-turn-child');release=join(f.fake.home,'held-turn-release');
   const script=join(f.fake.home,'held-turn.cjs'),builder=new URL('./fixture-environment.ts',import.meta.url).pathname;
   await writeFile(script,`const fs=require('fs'),{spawn}=require('child_process'),{pathToFileURL}=require('url');
(async()=>{const [arm,request,ready,childReady,release,builder,root]=process.argv.slice(2);if(!fs.existsSync(arm))return;const {fixtureEnvironment}=await import(pathToFileURL(builder));let input='';for await(const chunk of process.stdin)input+=chunk;const turn=JSON.parse(input);let child,closing=false;
const watcher=fs.watch(require('path').dirname(arm),()=>{if(fs.existsSync(release)&&!closing){closing=true;watcher.close();if(child){child.once('close',()=>process.exit(0));child.kill();}else process.exit(0);}else if(fs.existsSync(request)&&!child&&!closing){child=spawn(process.execPath,['-e',"require('fs').writeFileSync(process.argv[1],String(process.pid));setInterval(()=>{},1000);",childReady],{env:fixtureEnvironment(root,process.env),stdio:'ignore'});}});
fs.writeFileSync(ready,JSON.stringify({pid:process.pid,turnId:turn.prompt_id,session:turn.session_id}));})().catch(error=>{console.error(error);process.exitCode=1;});`);
   const quote=(value:string)=>"'"+value.replaceAll("'","'\\''")+"'";
   startHook={type:'command',command:[process.execPath,script,arm,request,ready,childReady,release,builder,f.root].map(quote).join(' ')};
   endHook={type:'command',command:[process.execPath,'-e',"require('fs').writeFileSync(process.argv[1],'release')",release].map(quote).join(' ')};
 },settings:settings=>{
   const hooks=settings.hooks as unknown as Record<string,Array<{hooks:unknown[]}>>;
   hooks.UserPromptSubmit!.push({hooks:[startHook]});hooks.SessionEnd!.push({hooks:[endHook]});
 },stopHooks:{beforeSignals:async targets=>{
   if(!targets.some(target=>target.pid===d.row.pid)||admitted)return;
   const turn=JSON.parse(await readFile(ready,'utf8')) as {pid:number;turnId:string;session:string};
   assert.ok(turn.turnId);assert.equal(turn.session,JSON.parse(await readFile(join(d.fake.home,'jobs',d.row.harnessId+'.json'),'utf8')).sessionId);
   assert.equal(((await d.fake.log(d.row.harnessId)).match(/session.measure done/g)??[]).length,completed,'the same native turn cannot complete while its hook is held');
   assert.ok((await observeProcesses([turn.pid],d.f.env)).get(turn.pid)?.identity,'the held hook is native and live at signal admission');
   const born=eventually('hook spawns a new writer at root TERM admission',async()=>{try{const pid=Number(await readFile(childReady,'utf8'));return pid&&(await observeProcesses([pid],d.f.env)).get(pid)?.identity?pid:undefined;}catch{return undefined;}},{ timeoutMs: 2000, behaviour: "post-signal receipt deadline" });void born.catch(()=>{});
   await writeFile(request,'spawn');const child=await born;
   const members=await systemProcesses(undefined,undefined,undefined,false,d.f.env);
   assert.ok(members.some(row=>row.pid===child&&row.parent===turn.pid),'fresh native writer belongs to the held hook');
   await assert.rejects(stat(release),{code:'ENOENT'},'only SessionEnd releases the held producer');admitted=true;
 }}}:{});
 await eventually('initial native turn completion',async()=>(await d.fake.log(d.row.harnessId)).includes('session.measure done')||undefined);
 await joinInitialHookWriters(d,testWaitMs());
 completed=((await d.fake.log(d.row.harnessId)).match(/session.measure done/g)??[]).length;
 if(boundary==='mid-turn')await writeFile(arm,'armed');
 const completion=boundary==='completed turn'?eventually('fresh native turn completion',async()=>((await d.fake.log(d.row.harnessId)).match(/session.measure done/g)??[]).length>completed||undefined,testWaitMs()):undefined;
 void completion?.catch(()=>{});
 const held=boundary==='mid-turn'?eventually('fresh native hook holds this turn',async()=>{try{return JSON.parse(await readFile(ready,'utf8')) as {turnId:string};}catch{return undefined;}},testWaitMs()):undefined;void held?.catch(()=>{});
 const mark=d.ui.frames.length;
 const busy=eventually('fresh native turn busy hook',()=>d.ui.frames.slice(mark).find(frame=>frame.type==='session.state'&&frame.session==='worker'&&frame.state==='busy'&&frame.source==='hook')||undefined,testWaitMs());void busy.catch(()=>{});
 const delivery=await d.ui.request({type:'topic.send',topic:'general',text:'@worker root-first fresh turn',to:['worker']});assert.equal(delivery.ok,true,delivery.error);
 await busy;
 if(boundary==='completed turn'){await completion;await joinInitialHookWriters(d,testWaitMs());}else await held;
 const result=await d.ui.request({type:'session.stop',session:'worker'},10000);assert.equal(result.ok,true,result.error);
 if(boundary==='mid-turn')assert.equal(admitted,true,'the live native producer spawned at root TERM admission');
 assert.equal(await d.nativeAlive(d.row),false,'the captured root birth is gone after one explicit stop');
 const rows=JSON.parse(await readFile(join(d.f.fake.run,'processes.json'),'utf8')) as Array<{pid:number;ended?:boolean;authority?:string}>;
 assert.ok(rows.some(row=>row.pid===d.row.pid&&row.ended&&row.authority==='closed'),'durable tree closure precedes success');
});

for(const detached of [false,true])test(detached?'remote Claude orphan detached-child escape retains unknown authority':'remote Claude exit-time orphan stays held after independent cleanup',{timeout:8 * testWaitMs() + 120000},async t=>{
 const {ownProcess}=await import('./process-cleanup.ts');
 let d:Awaited<ReturnType<typeof remoteClaudeFixture>>|undefined,marker='',escape='',escaped='',hook:unknown,gated=false;
 const signals:Array<{pid:number;identity:string}>=[];
 d=await remoteClaudeFixture(t,{awaitSignals:false,signals,settings:settings=>settings.hooks.SessionEnd.push({hooks:[hook]}),setup:async f=>{
   marker=join(f.fake.home,'exit-orphan');const script=join(f.fake.home,'exit-orphan.cjs');
   escape=join(f.fake.home,'orphan-escape');escaped=join(f.fake.home,'escaped-child');
   await writeFile(script,`const fs=require('fs'),{spawn}=require('child_process'),{pathToFileURL}=require('url');
(async()=>{const [marker,escape,escaped,builder,root]=process.argv.slice(2);const {fixtureEnvironment}=await import(pathToFileURL(builder));const watcher=fs.watch(require('path').dirname(escape),()=>{if(!fs.existsSync(escape))return;watcher.close();const child=spawn(process.execPath,['-e',"require('fs').writeFileSync(process.argv[1],String(process.pid));setInterval(()=>{},1000);",escaped],{env:fixtureEnvironment(root,process.env),detached:true,stdio:'ignore'});child.unref();process.exit(0);});fs.writeFileSync(marker,String(process.pid));})().catch(error=>{console.error(error);process.exitCode=1;});`);
   const quote=(value:string)=>"'"+value.replaceAll("'","'\\''")+"'";
   hook={type:'command',command:[process.execPath,script,marker,escape,escaped,new URL('./fixture-environment.ts',import.meta.url).pathname,f.root].map(quote).join(' '),async:true};
 },stopHooks:{beforeRemainingObservation:async()=>{
   if(gated||!d||!signals.some(target=>target.pid===d!.row.pid))return;
   await eventually('native root exit before first post-TERM census',async()=>(await observeProcesses([d!.row.pid],d!.f.env)).get(d!.row.pid)?.ended||undefined,{ timeoutMs: 2000, behaviour: "post-signal receipt deadline" });
   await eventually('orphan native PID and birth receipt',async()=>{try{const pid=Number(await readFile(marker,'utf8'));return (await observeProcesses([pid],d!.f.env)).get(pid)?.identity||undefined;}catch{return undefined;}},{ timeoutMs: 2000, behaviour: "post-signal receipt deadline" });
   gated=true;
 }}});
 await eventually('startup turn completed',async()=>(await d!.fake.log(d!.row.harnessId)).includes('session.measure done')||undefined);
 await joinInitialHookWriters(d,testWaitMs());
 const ready=eventually('independent exit-time writer PID',async()=>{try{return Number(await readFile(marker,'utf8'))||undefined;}catch{return undefined;}},{ timeoutMs: 3000, behaviour: "post-signal receipt deadline" });void ready.catch(()=>{});
 const stopping=d.ui.request({type:'session.stop',session:'worker'},10000);
 const pid=await ready,cleanup=ownProcess(undefined,pid);d.f.addCleanup(cleanup);
 const result=await stopping;assert.equal(gated,true);assert.equal(result.ok,false,result.error);assert.match(result.error!,/could not stop/);
 const orphanIdentity=(await observeProcesses([pid],d.f.env)).get(pid)?.identity;assert.ok(orphanIdentity,'orphan is alive at refusal');
 assert.equal(signals.some(target=>target.pid===pid),false,'no signal ever reaches the exit-time orphan');
 const rows=(await d.ui.request({type:'session.list'})).value as {processes:Array<{name:string;status:string;stateReason?:string}>};
 const row=rows.processes.find(row=>row.name==='worker')!;assert.equal(row.status,'running');assert.match(row.stateReason!,/cleanup-incomplete/);
 const roles=(await d.ui.request({type:'role.list'})).value as {roles:Array<{role:string;holders:Array<{name:string}>}>};assert.ok(roles.roles.find(role=>role.role==='implementer')?.holders.some(holder=>holder.name==='worker'));
 let escapedPid=0;
 if(detached){
   const born=eventually('detached escape child native receipt',async()=>{try{const pid=Number(await readFile(escaped,'utf8'));return pid&&(await observeProcesses([pid],d!.f.env)).get(pid)?.identity?pid:undefined;}catch{return undefined;}},{ timeoutMs: 2000, behaviour: "post-signal receipt deadline" });void born.catch(()=>{});
   await writeFile(escape,'escape');escapedPid=await born;d.f.addCleanup(ownProcess(undefined,escapedPid));
   await eventually('rejected orphan exits after detached fork',async()=>(await observeProcesses([pid],d!.f.env)).get(pid)?.ended||undefined,{ timeoutMs: 2000, behaviour: "post-signal receipt deadline" });
   const members=await systemProcesses(undefined,undefined,undefined,false,d.f.env);assert.ok(members.some(row=>row.pid===escapedPid&&row.group===escapedPid&&row.parent!==pid),'escaped writer outlives the rejected parent in a new native group');
 }else await cleanup();
 const {claudeProcessMembers}=await import('../src/host/agent/claude-stop.ts');
 const known=(JSON.parse(await readFile(join(d.f.fake.run,'processes.json'),'utf8')) as Array<{pid:number;identity:string;targets?:Array<{pid:number;identity:string}>}>).find(row=>row.pid===d!.row.pid)!;
 const pins=[{pid:known.pid,identity:known.identity},...(known.targets??[]),{pid,identity:orphanIdentity}];
 await eventually('all listed births and the old root group positively gone',async()=>{
   const proof=await observeProcesses(pins.map(target=>target.pid),d!.f.env);
   return pins.every(target=>proof.get(target.pid)?.ended||!!target.identity&&!!proof.get(target.pid)?.identity&&proof.get(target.pid)!.identity!==target.identity)&&!(await claudeProcessMembers(d!.f.env)).some(member=>member.group===d!.row.pid)||undefined;
 },{ timeoutMs: 2000, behaviour: "post-signal receipt deadline" });
 if(detached)assert.ok((await observeProcesses([escapedPid],d.f.env)).get(escapedPid)?.identity,'escaped writer survives every old birth and group');
 const held=await d.ui.request({type:'session.stop',session:'worker'},10000);assert.equal(held.ok,false,'absence of known births cannot prove session closure');assert.match(held.error!,/authority unknown/);
 assert.equal(await d.nativeAlive(d.row),false);assert.equal(signals.some(target=>target.pid===pid||target.pid===escapedPid),false,'unknown ownership adds no signal authority');
 const ledger=JSON.parse(await readFile(join(d.f.fake.run,'processes.json'),'utf8')) as Array<{pid:number;ended?:boolean;authority?:string}>;assert.ok(ledger.some(row=>row.pid===d!.row.pid&&row.authority==='unknown'&&!row.ended),'unknown row remains held after listed births disappear');
 const heldRoles=(await d.ui.request({type:'role.list'})).value as {roles:Array<{role:string;holders:Array<{name:string}>}>};assert.ok(heldRoles.roles.find(role=>role.role==='implementer')?.holders.some(holder=>holder.name==='worker'));
});

test('remote Claude retained hook retries after the pinned root exited',{timeout:8 * testWaitMs() + 120000},async t=>{
 let d:Awaited<ReturnType<typeof remoteClaudeFixture>>|undefined,marker='',hook:unknown,interrupted=false;
 const signals:Array<{pid:number;identity:string}>=[];
 d=await remoteClaudeFixture(t,{awaitSignals:false,signals,setup:async f=>{
   marker=join(f.fake.home,'retained-hook');const script=join(f.fake.home,'retained-hook.cjs');
   await writeFile(script,"require('fs').writeFileSync(process.argv[2],String(process.pid));setInterval(()=>{},1000);");
   const quote=(value:string)=>"'"+value.replaceAll("'","'\\''")+"'";
   hook={type:'command',command:[process.execPath,script,marker].map(quote).join(' '),async:true};
 },settings:settings=>{
   const hooks=settings.hooks as unknown as Record<string,Array<{hooks:unknown[]}>>;hooks.SessionStart!.push({hooks:[hook]});
 },stopHooks:{beforeRemainingObservation:async()=>{
   if(interrupted||!d||!signals.some(target=>target.pid===d!.row.pid))return;
   await eventually('first stop positively observes root exit',async()=>(await observeProcesses([d!.row.pid],d!.f.env)).get(d!.row.pid)?.ended||undefined,{ timeoutMs: 2000, behaviour: "post-signal receipt deadline" });
   await joinInitialHookWriters(d,/* behaviour: post-root-exit join deadline */ 1000);interrupted=true;
   throw new Error('injected interruption after root exit with retained hook');
 }}});
 const pid=await eventually('retained hook native PID',async()=>{try{const pid=Number(await readFile(marker,'utf8'));return pid&&(await observeProcesses([pid],d!.f.env)).get(pid)?.identity?pid:undefined;}catch{return undefined;}});
 await eventually('startup turn done',async()=>(await d!.fake.log(d!.row.harnessId)).includes('session.measure done')||undefined);await joinInitialHookWriters(d,testWaitMs());
 const first=await d.ui.request({type:'session.stop',session:'worker'},10000);assert.equal(first.ok,false);assert.match(first.error!,/injected interruption/);assert.equal(interrupted,true);
 assert.equal(await d.nativeAlive(d.row),false);const identity=(await observeProcesses([pid],d.f.env)).get(pid)?.identity;assert.ok(identity,'retained child outlives the root');
 const before=signals.length;
 const retried=await d.ui.request({type:'session.stop',session:'worker'},10000);assert.equal(retried.ok,true,retried.error);
 assert.ok(signals.slice(before).some(target=>target.pid===pid&&target.identity===identity),'retry signals the exact retained hook birth');assert.equal(signals.slice(before).some(target=>target.pid===d!.row.pid),false,'retry never signals a vanished root');
 assert.equal((await observeProcesses([pid],d.f.env)).get(pid)?.ended,true);
 const rows=JSON.parse(await readFile(join(d.f.fake.run,'processes.json'),'utf8')) as Array<{pid:number;ended?:boolean;authority?:string}>;assert.ok(rows.some(row=>row.pid===d!.row.pid&&row.ended&&row.authority==='closed'),'retained-hook closure is durable before success');
});


// The CLI-started process must build its own registry: an injected Host/layout masks this regression.
test('CLI-started hub launches a Claude item on a fake host with its mod bridge connected', {timeout: testWaitMs(120000)}, async t => {
 const fake = await fakeClaude(t,{awaitSignals:true});
 const f = await sshHostFixture(t,{startTransport:false,env:fake.env});
 const env = fixtureEnvironment(f.root, f.env, {...f.env, ...fake.env, CLAND_CLAUDE_BIN:new URL('./fakes/claude-code/claude',import.meta.url).pathname, CLAUDE_CONFIG_DIR:fake.home});
 const {territoryGitAsync,territoryPath,refreshTerritoryHook} = await import('../src/territory.ts');
 const {mkdir} = await import('node:fs/promises');
 await mkdir(join(f.root,'claude'),{recursive:true,mode:0o700});
 const git = (cwd:string,args:string[])=>territoryGitAsync(cwd,args,false,undefined,fixtureEnvironment(f.root,env));
 await git(f.root,['init','--initial-branch=dev']);
 await writeFile(join(f.root,'seed'),'seed'); await writeFile(join(f.root,'.gitignore'),'.cland\nnode_modules\n');
 await git(f.root,['add','.']);await git(f.root,['commit','-m','seed']);
 await mkdir(join(f.root,'.cland'),{recursive:true});
 await git(f.root,['clone','--bare',f.root,territoryPath(f.root)]);await refreshTerritoryHook(f.root);
 const store = new Store(join(f.root,'.cland/hub.db'));
 const record=f.records.get('f1')!;
 store.hosts.insert({...record,clientKeyPath:'/fake',knownHosts:'fake'},f.secrets.readSecret('f1'));store.close();
 const {discovery}=await startDaemon(t,f.root,env as Record<string,string>);
 f.addCleanup(()=>killDaemon(discovery.pid));
 const {setRoleKey}=await import('../src/roles/editor.ts');
 const rolesFile=join(f.root,'.cland/roles.toml');
 await writeFile(rolesFile,setRoleKey(await readFile(rolesFile,'utf8'),'implementer','launch','writable_roots',['.']));
 const ui=await connectUi(t,discovery);await ui.request({type:'subscribe'});
 await eventually('CLI registry carrier ready',async()=>{
   const status=(await ui.request({type:'hub.status'})).value as {hosts:Array<{name:string;state:string}>};
   return status.hosts.some(host=>host.state==='up')||undefined;
 },testWaitMs()).catch(async error=>{t.diagnostic(JSON.stringify((await ui.request({type:'hub.status'})).value));t.diagnostic((await readFile(join(f.root,'.cland/log/hub.log'),'utf8')).slice(-6000));throw error;});
 const created=await ui.request({type:'task.create',size:'S',title:'Claude remote layout regression'});assert.equal(created.ok,true,created.error);
 const item=(created.value as {item:{id:string}}).item.id;
 const made=await ui.request({type:'artifact.create',kind:'prompt',title:'Claude layout brief',topic:'general',content:'Exercise the remote mod bridge.'});assert.equal(made.ok,true,made.error);
 const brief=(made.value as {artifact:{id:string}}).artifact.id;
 const reply=await ui.request({type:'session.launch',name:'worker',harness:'claude-code',role:'implementer',host:'f1',item,brief},testWaitMs(60000));
 assert.equal(reply.ok,true,reply.error);
 const row=(reply.value as {process:{sessionId:string;harnessId:string;status:string;cwd:string;item:string}}).process;
 assert.equal(row.status,'running');assert.equal(row.item,item);
 const {ProcessTable}=await import('../src/adapters/processes.ts');
 const table=new ProcessTable(join(f.root,'.cland/hub.db'));
 try {assert.equal(table.get('worker')!.host,'f1');} finally {table.close();}
 const receipt=await eventually('exact native worker mod bridge acknowledged through tunnel',async()=>{
   const log=await fake.log(row.harnessId);return log.includes('mod bridge bridged')?log:undefined;
 },testWaitMs());
 assert.match(receipt,/mod bridge bridged/);
 const status=(await ui.request({type:'hub.status'})).value as {sessions:Array<{name:string;sessionId:string}>};
 assert.ok(status.sessions.some(session=>session.name==='worker'&&session.sessionId===row.sessionId));
 const stopped=await ui.request({type:'session.stop',session:'worker'},testWaitMs());assert.equal(stopped.ok,true,stopped.error);
});

for(const mode of ['aborted','throw','no-pid-error','pid-existed'] as const)test(`native command admission receipt ${mode}`,async t=>{
 const {run}=await import('../src/host/agent/command.ts');
 const {tempProject}=await import('./harness.ts');const root=await tempProject(t),env=fixtureEnvironment(root,process.env),commandTimeoutMs=testWaitMs();
 const bin=mode==='throw'?'\0':mode==='no-pid-error'?join(root,'missing-native-command'):process.execPath;
 const result=await run(bin,['-e','process.exit(1)'],env,commandTimeoutMs,false,mode==='aborted'?AbortSignal.abort():undefined,'utf8',root);
 assert.equal(result.nativeAdmission,mode==='pid-existed'?undefined:'no-process');
 if(mode==='pid-existed')assert.equal(result.code,1,'a native PID existed even though the command failed');
});


test('remote Claude memory floor refuses actual launchClaude with no process then admits exact floor', {timeout:8 * testWaitMs() + 120000}, async t=>{
  const d=await remoteClaudeFixture(t,{memoryFloor:true,setup:async f=>{
    await writeFile(join(f.fake.directory,'available-memory'),JSON.stringify({availableBytes:1200000000}));
  }});
  assert.match(d.launchError!,/available memory 1200000000 bytes/);
  assert.equal((await d.fake.calls()).filter(call=>call.args[0]==='--bg').length,0);
  assert.deepEqual(JSON.parse(await readFile(join(d.f.fake.run,'processes.json'),'utf8').catch(error=>{if(error.code==='ENOENT')return '[]';throw error;})),[]);
  await assert.rejects(d.nativeLaunchClaude({command:process.execPath,args:[],cwd:d.f.fake.home,env:d.f.env},'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), (error:any)=>error.code==='memory-floor'&&error.host==='f1'&&error.availableBytes===1200000000);
  await writeFile(join(d.f.fake.directory,'available-memory'),JSON.stringify({availableBytes:1300000000}));
  const reply=await d.ui.request({type:'session.launch',name:'worker',harness:'claude-code',role:'implementer',host:'f1',cwd:d.f.fake.home},testWaitMs());
  assert.equal(reply.ok,true,reply.error);
  const row=(reply.value as {process:{pid:number;pidIdentity:string}}).process;
  const birth=await d.machine.identity(row.pid);
  const worker=await eventually('exact-floor durable native worker ownership',async()=>{
    const workers=JSON.parse(await readFile(join(d.f.fake.run,'processes.json'),'utf8')) as Array<{pid:number;identity:string}>;
    return workers.find(worker=>worker.pid===row.pid&&worker.identity===birth?.pidIdentity);
  },testWaitMs());
  assert.equal(worker.pid,row.pid);assert.equal(worker.identity,birth?.pidIdentity);
  const stopped=await d.ui.request({type:'session.stop',session:'worker'},testWaitMs());assert.equal(stopped.ok,true,stopped.error);
});

test('Claude remote file ends with no fake sessions or spokes', assertFakeClaudeCensus);
