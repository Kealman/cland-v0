// T2: real process-owner persistence against scripted ps/proc and signal boundaries.
// Every PID is synthetic; no process is launched or signalled and no wall clock waits.
import test, {mock} from 'node:test';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import files, {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import {promisify} from 'node:util';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fixtureEnvironment} from './fixture-environment.ts';
import {caseDeadlines} from './case-deadlines.ts';
import {beforeDirectories,guardDirectoryRemoval,ownDirectory,afterCleanup} from './process-cleanup.ts';

test('Claude owner retries retained pins across a live root replacement',async t=>{
 const scope=caseDeadlines(t,{ownership:{beforeDirectories,guardDirectoryRemoval}});
 const originalWork=new Set<Promise<unknown>>();
 const track=<T>(work:Promise<T>):Promise<T>=>{
   originalWork.add(work);void work.then(()=>originalWork.delete(work),()=>originalWork.delete(work));return work;
 };
 const own=<T>(operation:Parameters<typeof scope.run<T>>[0])=>track(scope.run(operation));
 const setup=<T>(name:string,run:()=>Promise<T>)=>scope.wait(name,()=>track(Promise.resolve().then(run)));
 await own(async()=>{
 const boot='11111111-1111-1111-1111-111111111111',uid=process.getuid!();
 type Member={pid:number;parent:number;group:number;birth:number;unknown?:boolean};
 let rows:Member[]=[],deadlineMode=false;const signals:number[]=[];
 const started=(birth:number)=>`Mon Oct 05 12:00:0${birth} 2026`;
 const identity=(birth:number)=>`linux:${boot}:${process.platform==='linux'?birth:Date.parse(started(birth)+' UTC')}`;
 const read=files.readFile;
 mock.method(files,'readFile',(async(path,...args)=>{
   if(path==='/proc/sys/kernel/random/boot_id')return boot;
   const match=/^\/proc\/(\d+)\/stat$/.exec(String(path));
   if(!match)return read(path,...args);
   const row=rows.find(row=>row.pid===Number(match[1]));
   if(!row)throw Object.assign(new Error('synthetic exit'),{code:'ENOENT'});
   if(row.unknown)throw Object.assign(new Error('synthetic unreadable birth'),{code:'EACCES'});
   return `${row.pid} (fixture) S ${row.parent} ${row.group} ${Array(16).fill('0').join(' ')} ${row.birth} 0`;
 }) as typeof files.readFile);
 const execute=async(bin:string,args:string[])=>{
   assert.equal(bin,'ps','all native command execution is intercepted');
   const fields=args.includes('-o')?args[args.indexOf('-o')+1]:args[1],selected=args.includes('-p')?args[args.indexOf('-p')+1]!.split(',').map(Number):undefined;
   const members=rows.filter(row=>!selected||selected.includes(row.pid));
   let stdout:string;
   if(fields==='pid=,lstart=,stat='){
     if(members.some(row=>row.unknown))return {stdout:'unreadable synthetic listing',stderr:''};
     stdout=members.map(row=>`${row.pid} ${started(row.birth)} S`).join('\n');
   }else if(fields==='pid=,ppid=,pgid=,uid=')stdout=members.map(row=>`${row.pid} ${row.parent} ${row.group} ${uid}`).join('\n');
   else {assert.equal(fields,'pid=,ppid=,pgid=,rss=,%cpu=,stat=');stdout=members.map(row=>`${row.pid} ${row.parent} ${row.group} 1 0 S`).join('\n');}
   return {stdout,stderr:''};
 };
 const originalExec=childProcess.execFile,originalShell=childProcess.exec;
 const attempts:string[]=[],controls:string[]=[];let controlling=true;
 afterCleanup(t,async()=>{
   // Context mocks would auto-restore even when bounded cleanup failed. This
   // standalone tracker stays installed unless every original producer joined.
   await scope.wait('original fixture work join',async()=>{
     while(originalWork.size)await Promise.allSettled([...originalWork]);
   });
   try{assert.deepEqual(attempts,[],'no native launch attempts after callback/drain/directory cleanup');}
   finally{childProcess.execFile=originalExec;childProcess.exec=originalShell;mock.restoreAll();mock.timers.reset();syncBuiltinESMExports();}
 });
 const refuse=(boundary:string)=>{(controlling?controls:attempts).push(boundary);throw new Error('native launch forbidden: '+boundary);};
 mock.method(childProcess,'spawn',()=>refuse('spawn'));
 const nativePrototype=childProcess.ChildProcess.prototype as childProcess.ChildProcess & {spawn(options:unknown):unknown};
 mock.method(nativePrototype,'spawn',()=>refuse('prototype.spawn'));
 childProcess.exec=Object.assign(()=>refuse('exec'),{[promisify.custom]:async()=>refuse('exec.custom')}) as unknown as typeof childProcess.exec;
 // cland-allow-child-env: positive control reaches only the installed throwing launch guard
 assert.throws(()=>childProcess.spawn('fixture-launch-guard'),/native launch forbidden/);
 // cland-allow-child-env: positive control reaches only the throwing exec callback guard
 assert.throws(()=>childProcess.exec('fixture-launch-guard'),/native launch forbidden/);
 // cland-allow-child-env: positive control reaches only the throwing exec promisify guard
 await assert.rejects(promisify(childProcess.exec)('fixture-launch-guard'),/native launch forbidden/);
 childProcess.execFile=Object.assign(()=>refuse('execFile'),{[promisify.custom]:execute}) as unknown as typeof childProcess.execFile;
 // cland-allow-child-env: positive control reaches only the throwing execFile callback guard
 assert.throws(()=>childProcess.execFile('fixture-launch-guard'),/native launch forbidden/);
 assert.throws(()=>nativePrototype.spawn.call(new childProcess.ChildProcess(),{}),/native launch forbidden/);
 assert.deepEqual(controls,['spawn','exec','exec.custom','execFile','prototype.spawn']);
 controlling=false;
 mock.method(process,'kill',(pid:number,signal?:number|string)=>{
   if(signal===0){if(rows.some(row=>row.pid===pid))return true;throw Object.assign(new Error('synthetic native absence'),{code:'ESRCH'});}
   if(deadlineMode){assert.ok(pid===100||pid===101);signals.push(pid);return true;}assert.equal(pid,101,'replacement root and unowned members are never signalled');signals.push(pid);rows=rows.filter(row=>row.pid!==pid);return true;
 });
 syncBuiltinESMExports();
 const {AgentProcesses}=await import('../src/host/agent/processes.ts');
 const {ClaudeCodeAdapter}=await import('../src/adapters/claude-code.ts');
 const {CLAUDE_STOP_GRACE_MS}=await import('../src/host/agent/claude-stop.ts');
 const {observeLinuxProcess}=await import('../src/host/agent/native.ts');
 // Advance the same Date used by every stop reader, only at the helper's injected pause boundary.
 mock.timers.enable({apis:['Date']});const timeout=globalThis.setTimeout;
 mock.method(globalThis,'setTimeout',((callback:(...args:unknown[])=>void,ms?:number,...args:unknown[])=>{
   if(ms!==10)return timeout(callback,ms,...args);
   mock.timers.tick(1000);queueMicrotask(()=>callback(...args));return {} as ReturnType<typeof setTimeout>;
 }) as typeof setTimeout);
 for(const mode of ['replacement','replacement plus unowned writer','unknown root','deadline retains row'] as const)await t.test(mode,()=>own(async step=>{
   const root=await step(()=>setup('owner fixture setup',async()=>{
     const root=await mkdtemp(join(tmpdir(),'claude-owner-'));scope.adoptRoot(root);scope.fixtures.after(ownDirectory(undefined,root));return root;
   }));let owner:InstanceType<typeof AgentProcesses>|undefined;
   try{
     const {env,worker}=await step(()=>setup('owner admission setup',async()=>{
     await writeFile(join(root,'boot'),boot);const env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOSTS:'1',CLAND_HOST_BOOT_ID_FILE:join(root,'boot')});
     rows=[{pid:100,parent:1,group:100,birth:1},{pid:101,parent:100,group:100,birth:2}];signals.length=0;
     owner=new AgentProcesses(root,env,()=>{});await owner.load();const worker={pid:100,identity:identity(1)};assert.equal(await owner.identity(100),worker.identity,'scripted native observation before adoption');await owner.adopt(worker);
     return {env,worker};
     }));
     deadlineMode=mode==='deadline retains row';
     if(!deadlineMode)rows=[{pid:100,parent:1,group:100,birth:3,...(mode==='unknown root'?{unknown:true}:{})},{pid:101,parent:1,group:100,birth:2},...(mode==='replacement plus unowned writer'?[{pid:102,parent:1,group:100,birth:4}]:[])];
     await step(()=>owner!.reconcile());
     if(deadlineMode){
       const states:Array<{source:string;state?:string}>=[],metadata=new Map<string,string>();
       const machine={name:'f1',adopt:async()=>{},stop:async()=>owner!.stop(worker)} as unknown as import('../src/host/host.ts').Host;
       const adapter=new ClaudeCodeAdapter({root,discoveryFile:join(root,'discovery'),node:process.execPath,cli:'unused',spoke:'unused',hostForProcess:()=>machine,log:()=>{},signal:(_id,state)=>states.push(state),recordPid:()=>{},exited:()=>assert.fail('deadline cannot publish exit'),adapterState:{read:key=>metadata.get(key)??null,write:(key,value)=>{metadata.set(key,value);}}},{env});
       const processRow:import('../src/adapters/contract.ts').HarnessProcess={host:'f1',name:'worker',harness:'claude-code',role:'implementer',model:null,cwd:root,pid:100,pidIdentity:identity(1),harnessId:'native-job',sessionId:'deadline-session',harnessSessionId:'native-session',startedAt:new Date().toISOString(),status:'running'};
       const before=Date.now();try{
         await step(()=>assert.rejects(adapter.stop(processRow),/could not stop/));
         assert.equal(Date.now()-before,3*CLAUDE_STOP_GRACE_MS,'the exact stop deadline expires on the shared virtual clock'); // lint-allow-wall-clock: mocked Date advances only at the stop pause; this asserts logical deadline expiry without waiting wall time.
         assert.match(adapter.stateReason(processRow)!,/cleanup-incomplete/);assert.ok(states.some(state=>state.source==='cleanup-incomplete'&&state.state==='unknown'));
         assert.equal(owner!.closed(worker),false);assert.ok(signals.includes(100)&&signals.includes(101),'both admitted births were attempted, not refused for missing identity');
       }finally{await adapter.close();}
     }else if(mode==='replacement'){
       assert.deepEqual(await step(()=>observeLinuxProcess(101,boot,async()=>{throw Object.assign(new Error('hidden live child'),{code:'ENOENT'});})),{identity:null,ended:false},'a hidden but live captured child remains unknown');
       assert.deepEqual(signals,[],'successful signal-zero never terminates the hidden child');
       const admitted=await step(()=>owner!.captureForStop(worker));assert.deepEqual(admitted.targets,[{pid:101,identity:identity(2)}],'owner admission retires the old root, while the live replacement stays in ps');
       assert.equal(await step(()=>owner!.stop({...worker,captured:admitted.targets})),true);assert.deepEqual(signals,[101]);assert.equal(owner!.closed(worker),true);
       assert.deepEqual(rows,[{pid:100,parent:1,group:100,birth:3}],'the live replacement remains untouched after durable old-tree closure');
       assert.deepEqual(await step(()=>observeLinuxProcess(101,boot,()=>files.readFile('/proc/101/stat','utf8'))),{identity:null,ended:true},'fake proc exit requires the captured child native absence receipt on every platform');
       assert.deepEqual(signals,[101],'signal-zero observation never sends another termination');
     }else{
       if(mode==='replacement plus unowned writer')await step(()=>assert.rejects(owner!.captureForStop(worker),/authority unknown/));
       else assert.equal((await step(()=>owner!.captureForStop(worker))).targets,null);
       assert.deepEqual(signals,[]);assert.equal(owner!.closed(worker),false);
     }
     const ledger=JSON.parse(await step(()=>readFile(join(root,'processes.json'),'utf8'))) as Array<{authority:string;ended?:boolean}>;if(deadlineMode){assert.equal(ledger[0]!.ended===true,false,'deadline retains the durable native row');assert.equal(ledger.length,1);}
     assert.equal(ledger[0]!.authority,mode==='replacement'?'closed':mode==='unknown root'||deadlineMode?'owned':'unknown');
   }finally{await owner?.drain();}
 }));
 });
});
