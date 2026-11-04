// T2: real process-owner persistence against scripted ps/proc and signal boundaries.
// Every PID is synthetic; no process is launched or signalled and no wall clock waits.
import test from 'node:test';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import files, {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import {promisify} from 'node:util';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fixtureEnvironment} from './fixture-environment.ts';

test('Claude owner retries retained pins across a live root replacement',async t=>{
 const boot='11111111-1111-1111-1111-111111111111',uid=process.getuid!();
 type Member={pid:number;parent:number;group:number;birth:number;unknown?:boolean};
 let rows:Member[]=[],deadlineMode=false;const signals:number[]=[];
 const started=(birth:number)=>`Mon Oct 05 12:00:0${birth} 2026`;
 const identity=(birth:number)=>`linux:${boot}:${process.platform==='linux'?birth:Date.parse(started(birth)+' UTC')}`;
 const read=files.readFile;
 t.mock.method(files,'readFile',(async(path,...args)=>{
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
 const originalExec=childProcess.execFile;
 childProcess.execFile=Object.assign(()=>assert.fail('only promisified native commands are expected'),{[promisify.custom]:execute}) as unknown as typeof childProcess.execFile;
 t.mock.method(process,'kill',(pid:number)=>{if(deadlineMode){assert.ok(pid===100||pid===101);signals.push(pid);return true;}assert.equal(pid,101,'replacement root and unowned members are never signalled');signals.push(pid);rows=rows.filter(row=>row.pid!==pid);return true;});
 syncBuiltinESMExports();t.after(()=>{childProcess.execFile=originalExec;t.mock.restoreAll();syncBuiltinESMExports();});
 const {AgentProcesses}=await import('../src/host/agent/processes.ts');
 const {ClaudeCodeAdapter}=await import('../src/adapters/claude-code.ts');
 const {CLAUDE_STOP_GRACE_MS}=await import('../src/host/agent/claude-stop.ts');
 // Advance the same Date used by every stop reader, only at the helper's injected pause boundary.
 t.mock.timers.enable({apis:['Date']});const timeout=globalThis.setTimeout;
 t.mock.method(globalThis,'setTimeout',((callback:(...args:unknown[])=>void,ms?:number,...args:unknown[])=>{
   if(ms!==10)return timeout(callback,ms,...args);
   t.mock.timers.tick(1000);queueMicrotask(()=>callback(...args));return {} as ReturnType<typeof setTimeout>;
 }) as typeof setTimeout);
 for(const mode of ['replacement','replacement plus unowned writer','unknown root','deadline retains row'] as const)await t.test(mode,async()=>{
   const root=await mkdtemp(join(tmpdir(),'claude-owner-'));let owner:InstanceType<typeof AgentProcesses>|undefined;
   try{
     await writeFile(join(root,'boot'),boot);const env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOSTS:'1',CLAND_HOST_BOOT_ID_FILE:join(root,'boot')});
     rows=[{pid:100,parent:1,group:100,birth:1},{pid:101,parent:100,group:100,birth:2}];signals.length=0;
     owner=new AgentProcesses(root,env,()=>{});await owner.load();const worker={pid:100,identity:identity(1)};assert.equal(await owner.identity(100),worker.identity,'scripted native observation before adoption');await owner.adopt(worker);
     deadlineMode=mode==='deadline retains row';
     if(!deadlineMode)rows=[{pid:100,parent:1,group:100,birth:3,...(mode==='unknown root'?{unknown:true}:{})},{pid:101,parent:1,group:100,birth:2},...(mode==='replacement plus unowned writer'?[{pid:102,parent:1,group:100,birth:4}]:[])];
     await owner.reconcile();
     if(deadlineMode){
       const states:Array<{source:string;state?:string}>=[],metadata=new Map<string,string>();
       const machine={name:'f1',adopt:async()=>{},stop:async()=>owner!.stop(worker)} as unknown as import('../src/host/host.ts').Host;
       const adapter=new ClaudeCodeAdapter({root,discoveryFile:join(root,'discovery'),node:process.execPath,cli:'unused',spoke:'unused',hostForProcess:()=>machine,log:()=>{},signal:(_id,state)=>states.push(state),recordPid:()=>{},exited:()=>assert.fail('deadline cannot publish exit'),adapterState:{read:key=>metadata.get(key)??null,write:(key,value)=>{metadata.set(key,value);}}},{env});
       const processRow:import('../src/adapters/contract.ts').HarnessProcess={host:'f1',name:'worker',harness:'claude-code',role:'implementer',model:null,cwd:root,pid:100,pidIdentity:identity(1),harnessId:'native-job',sessionId:'deadline-session',harnessSessionId:'native-session',startedAt:new Date().toISOString(),status:'running'};
       const before=Date.now();try{
         await assert.rejects(adapter.stop(processRow),/could not stop/);
         assert.equal(Date.now()-before,3*CLAUDE_STOP_GRACE_MS,'the exact stop deadline expires on the shared virtual clock'); // lint-allow-wall-clock: mocked Date advances only at the stop pause; this asserts logical deadline expiry without waiting wall time.
         assert.match(adapter.stateReason(processRow)!,/cleanup-incomplete/);assert.ok(states.some(state=>state.source==='cleanup-incomplete'&&state.state==='unknown'));
         assert.equal(owner.closed(worker),false);assert.ok(signals.includes(100)&&signals.includes(101),'both admitted births were attempted, not refused for missing identity');
       }finally{await adapter.close();}
     }else if(mode==='replacement'){
       const admitted=await owner.captureForStop(worker);assert.deepEqual(admitted.targets,[{pid:101,identity:identity(2)}],'owner admission retires the old root, while the live replacement stays in ps');
       assert.equal(await owner.stop({...worker,captured:admitted.targets}),true);assert.deepEqual(signals,[101]);assert.equal(owner.closed(worker),true);
       assert.deepEqual(rows,[{pid:100,parent:1,group:100,birth:3}],'the live replacement remains untouched after durable old-tree closure');
     }else{
       if(mode==='replacement plus unowned writer')await assert.rejects(owner.captureForStop(worker),/authority unknown/);
       else assert.equal((await owner.captureForStop(worker)).targets,null);
       assert.deepEqual(signals,[]);assert.equal(owner.closed(worker),false);
     }
     const ledger=JSON.parse(await readFile(join(root,'processes.json'),'utf8')) as Array<{authority:string;ended?:boolean}>;if(deadlineMode){assert.equal(ledger[0]!.ended===true,false,'deadline retains the durable native row');assert.equal(ledger.length,1);}
     assert.equal(ledger[0]!.authority,mode==='replacement'?'closed':mode==='unknown root'||deadlineMode?'owned':'unknown');
   }finally{await owner?.drain();await rm(root,{recursive:true,force:true});}
 });
});
