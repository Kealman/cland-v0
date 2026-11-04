// T3: fake SSH + scripted Claude exercise native worker adoption, hooks and mod bridge.
// Native processes are required to prove detached worker capture and joined stop; fixture owns every writer.
import test, {type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import { readFile, symlink, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { sshHostFixture } from './ssh-host-fixture.ts';
import { projectHub, connectUi, fakeClaude, eventually } from './harness.ts';
import { ClaudeCodeAdapter } from '../src/adapters/claude-code.ts';
import { Store } from '../src/hub/store.ts';
import { writeFile } from 'node:fs/promises';
import { SshTransport } from '../src/transport/ssh.ts';
import { layout } from '../src/project.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { sshHost } from '../src/host/ssh-host.ts';
import { AgentClient } from '../src/host/agent-client.ts';
import { FakeClock } from './fake-clock.ts';
import { observeProcesses } from '../src/host/agent/native.ts';
import { systemProcesses } from '../src/system-processes.ts';

async function remoteClaudeFixture(t:TestContext, options:{failPrune?:boolean;failedResult?:boolean;failedAdoption?:boolean;stopCrash?:boolean;rollback?:boolean;settings?:(settings:{hooks:{SessionEnd:unknown[]}})=>void;awaitSignals?:boolean;setup?:(f:Awaited<ReturnType<typeof sshHostFixture>>,fake:Awaited<ReturnType<typeof fakeClaude>>)=>Promise<void>}={}) {
 const f=await sshHostFixture(t,{startTransport:false});
 const fake=await fakeClaude(t,{awaitSignals:options.awaitSignals??true,stopCrash:options.stopCrash??false});
 await options.setup?.(f,fake);
 const code=join(f.fake.home,'code');await symlink(new URL('../../',import.meta.url).pathname,code);
 const remote={...f.layout,node:process.execPath,cli:join(code,'hub/bin/cland.ts'),spoke:join(code,'hub/bin/cland-spoke.ts'),modDir:join(code,'hub/mod/cland')};
 let carrier:SshTransport,launchedAdapter:ClaudeCodeAdapter;let credential='';let pruneFaultInjected=false;let releaseClaude:(()=>Promise<void>)|undefined;
 const machine=sshHost({name:'f1',layout:remote,transport:{status:()=>carrier.status(),forward:(...args)=>carrier.forward(...args),unforward:(...args)=>carrier.unforward(...args)},connect:()=>AgentClient.connect(f.paths.agentSocket,f.secrets.readSecret('f1'))});
 const launchClaude=machine.launchClaude!.bind(machine);
 machine.launchClaude=async(command,generation)=>{const path=command.args[command.args.indexOf('--settings')+1]!;const settings=JSON.parse(await readFile(path,'utf8'));credential=settings.env.CLAND_LAUNCH_TOKEN;if(options.settings){options.settings(settings);await writeFile(path,JSON.stringify(settings),{mode:0o600});}const result=await launchClaude(command,generation);if(options.failedResult&&!failureInjected){failureInjected=true;throw Object.assign(new Error('planted lost launch result'),{code:'CLAND_NATIVE_INCOMPLETE'});}return result;};
 let stopGate:{entered:ReturnType<typeof Promise.withResolvers<void>>;release:ReturnType<typeof Promise.withResolvers<void>>}|undefined;
 let failureInjected=false,allowFailedStop=!options.failedAdoption&&!options.failedResult;
 const stop=machine.stop.bind(machine);machine.stop=async(...args)=>{if(!allowFailedStop)return false;const gate=stopGate;if(gate){gate.entered.resolve();await gate.release.promise;stopGate=undefined;}return stop(...args);};
 const adopt=machine.adopt!.bind(machine);machine.adopt=async generation=>{const receipt=await adopt(generation);releaseClaude=receipt.release;if(options.failedAdoption&&!failureInjected){failureInjected=true;throw Object.assign(new Error('planted lost adoption reply'),{code:'CLAND_NATIVE_INCOMPLETE'});}if(options.rollback){await eventually('worker startup joined before rollback trigger',async()=>(await fake.log(receipt.job)).includes('session ready')||undefined,2000);const closing=launchedAdapter.close();if(closing)void closing.catch(()=>{});}return receipt;};
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
 const startHub=()=>projectHub(t,f.root,{}, {hosts:[machine],adapters:[factory]});
 const hub=await startHub();
 const {setRoleKey}=await import('../src/roles/editor.ts');const rolesFile=join(f.root,'.cland/roles.toml');await writeFile(rolesFile,setRoleKey(await readFile(rolesFile,'utf8'),'implementer','launch','writable_roots',['.']));
 f.addCleanup(()=>hub.stop());
 const store=new Store(join(f.root,'.cland/hub.db'));f.addCleanup(async()=>store.close());
 const record=f.records.get('f1')!,secret=f.secrets.readSecret('f1');store.hosts.insert({...record,clientKeyPath:'/fake',knownHosts:'fake'},secret);
 await writeFile(remote.discoveryFile,JSON.stringify({remote:true,version:'test',secret,socket:join(f.fake.run,'hub.sock'),spoke:`ws+unix:${join(f.fake.run,'spoke.sock')}:/`}),{mode:0o600});
 carrier=new SshTransport({root:f.root,record,secrets:f.secrets,hubSocket:layout(f.root).socket,spokeSocket:layout(f.root).spokeSocket,remoteRun:f.fake.run,supervisor:f.supervisor,agentCommand:['stub'],env:f.env,readinessPollMs:5,reconnectDelayMs:()=>10});
 f.addCleanup(()=>carrier.stop());await carrier.start();await eventually('carrier up',()=>carrier.status().state==='up'||undefined,3000);
 const ui=await connectUi(t,hub.discovery);await ui.request({type:'subscribe'});
 const reply=await ui.request({type:'session.launch',name:'worker',harness:'claude-code',role:'implementer',host:'f1',cwd:f.fake.home},10000);
 assert.equal(reply.ok,!options.rollback&&!options.failedAdoption&&!options.failedResult,reply.error);
 const row=(reply.value as {process:{pid:number;pidIdentity:string;harnessId:string}}|undefined)?.process!;
 return {f,fake,machine,remote,clock,ui,hub,startHub,row,launchError:reply.error,expectIncompleteClose:(operation:string)=>{expectedIncompleteOperation=operation;},allowFailedStop:()=>{allowFailedStop=true;},holdFailedStop:()=>{const gate={entered:Promise.withResolvers<void>(),release:Promise.withResolvers<void>()};stopGate=gate;return gate;},nativeAlive,aliveReceipts:()=>aliveReceipts,credential:()=>credential,releaseClaude:()=>releaseClaude?.()};
}

async function joinInitialHookWriters(d:Awaited<ReturnType<typeof remoteClaudeFixture>>):Promise<void>{
 const rows=await systemProcesses(undefined,undefined,undefined,false,d.f.env);
 const pids=rows.filter(row=>row.group===d.row.pid&&row.command.includes(d.remote.cli)&&/\bhook\s+(?!bridge(?:\s|$))/.test(row.command.replaceAll("'",'').replaceAll('"',''))).map(row=>row.pid);
 if(!pids.length)return;
 const pins=await eventually('initial hook native birth or exit receipts',async()=>{const proof=await observeProcesses(pids,d.f.env);return pids.every(pid=>proof.get(pid)?.identity||proof.get(pid)?.ended)?proof:undefined;},1000);
 const exits=await eventually('initial hook writers positively exited',async()=>{
   const proof=await observeProcesses(pids,d.f.env);
   return pids.every(pid=>proof.get(pid)?.ended||!!pins.get(pid)?.identity&&!!proof.get(pid)?.identity&&proof.get(pid)!.identity!==pins.get(pid)!.identity)?proof:undefined;
 },1000);
 assert.ok(pids.every(pid=>exits.get(pid)?.ended||!!pins.get(pid)?.identity&&!!exits.get(pid)?.identity&&exits.get(pid)!.identity!==pins.get(pid)!.identity),'every captured initial hook birth has a positive exit receipt');
}

test('remote Claude frame launch adopts its worker and delivers through host hooks and bridge', {timeout:15000},async t=>{
 const {f,fake,machine,remote,clock,ui,hub,row,nativeAlive,aliveReceipts,releaseClaude}=await remoteClaudeFixture(t);
 const rows=JSON.parse(await readFile(join(f.fake.run,'processes.json'),'utf8')) as Array<{pid:number;identity:string}>;
 row.pidIdentity=(await machine.identity(row.pid))!.pidIdentity!;
 assert.ok(rows.some(worker=>worker.pid===row.pid&&worker.identity===row.pidIdentity));
 assert.match(row.pidIdentity,/^linux:/);assert.equal(await machine.alive(row),true);
 const mark=ui.frames.length;
 await ui.request({type:'topic.send',topic:'general',text:'@worker remote hello',to:['worker']});
 await eventually('remote answer',()=>ui.frames.find(frame=>frame.type==='message'&&JSON.stringify(frame).includes('pong:'))||undefined,5000);
 await eventually('both native turns completed',async()=>((await fake.log(row.harnessId)).match(/session.measure done/g)??[]).length>=2||undefined,2000);
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
 for(let i=0;i<4;i++){const previous=aliveReceipts();await clock.advance(5);await eventually('Host liveness poll completed',()=>aliveReceipts()>previous||undefined,1000);}
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

for(const asynchronous of [false,true])test(asynchronous?'Claude hook born across root exit remains unacquired':'Claude TERM-resistant SessionEnd hook is captured and killed by native birth', {timeout:10000},async t=>{
 const {ownProcess}=await import('./process-cleanup.ts');
 const {stopClaude,claudeProcessMembers}=await import('../src/host/agent/claude-stop.ts');
 let marker='';let extraHook:unknown;
 const d=await remoteClaudeFixture(t,{awaitSignals:!asynchronous,settings:settings=>{settings.hooks.SessionEnd.push({hooks:[extraHook]});},setup:async(f)=>{
   marker=join(f.fake.home,'hook-ready');const script=join(f.fake.home,'session-end.cjs');
   await writeFile(script,"const fs=require('fs');process.on('SIGTERM',()=>{});fs.writeFileSync(process.argv[2],String(process.pid));setInterval(()=>{},1000);");
   const quote=(value:string)=>"'"+value.replaceAll("'","'\\''")+"'";
   extraHook={type:'command',command:[process.execPath,script,marker].map(quote).join(' '),async:asynchronous};
 }});
 await eventually('worker startup completed',async()=>(await d.fake.log(d.row.harnessId)).includes('session ready')||undefined,2000);
 const root=(await d.machine.identity(d.row.pid))!;
 await eventually('initial model turn completed',async()=>(await d.fake.log(d.row.harnessId)).includes('session.measure done')||undefined,2000);
 const connection=await AgentClient.connect(d.f.paths.agentSocket,d.f.secrets.readSecret('f1'));d.f.addCleanup(()=>connection.close());
 const captured=await eventually('durable live worker tree capture',async()=>{const result=await connection.request('prepare-stop',{pid:root.pid,identity:root.pidIdentity}) as {token:string|null;targets?:Array<{pid:number;identity:string}>};return result.token&&result.targets?{token:result.token,targets:result.targets}:undefined;},2000);
 if(captured.token)await connection.request('abort-prepared',{token:captured.token});
 assert.ok(captured.targets,'captured running worker');
 const diagnostics:string[]=[],checkpoints:number[][]=[],signals:Array<{pid:number;signal:string}>=[];let termSent=false,rootExitConfirmed=false;
 const ready=eventually('SessionEnd native hook PID receipt',async()=>{try{return Number(await readFile(marker,'utf8'))||undefined;}catch{return undefined;}},2000);
 const stopping=stopClaude({pid:root.pid!,identity:root.pidIdentity!},captured.targets,d.f.env,async(targets,signal)=>{
   for(const target of [...targets].reverse()){
     const observed=await d.machine.identity(target.pid);if(!observed)continue;if(observed.pidIdentity!==target.identity)return false;
     try{process.kill(target.pid,signal);signals.push({pid:target.pid,signal});if(target.pid===root.pid&&signal==='SIGTERM')termSent=true;}catch(error){if((error as NodeJS.ErrnoException).code!=='ESRCH'||await d.machine.identity(target.pid)!==null)throw error;}
   }return true;
 },300,async targets=>{checkpoints.push(targets.map(target=>target.pid));},{diagnostic:reason=>diagnostics.push(reason),snapshot:async()=>{
   if(asynchronous&&termSent){await eventually('native root exit before late-hook acquisition census',async()=>(await observeProcesses([root.pid!],d.f.env)).get(root.pid!)?.ended||undefined,1000);rootExitConfirmed=true;}
   return claudeProcessMembers(d.f.env);
 }});
 const pid=await ready;d.f.addCleanup(ownProcess(undefined,pid));
 const result=await stopping;
 if(asynchronous){assert.equal(rootExitConfirmed,true);assert.equal(result,null);assert.equal(signals.some(row=>row.pid===pid),false);assert.ok(await d.machine.identity(pid),'uncaptured writer remains alive for independent cleanup');}
 else {assert.ok(result,diagnostics.join('; '));assert.ok(checkpoints.some(rows=>rows.includes(pid)));assert.ok(signals.some(row=>row.pid===pid&&row.signal==='SIGKILL'));assert.equal(await d.machine.identity(pid),null);}
});

test('remote Claude failed adoption handshake joins rollback and removes its credential copies only',async t=>{
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
 for(const root of [d.f.fake.home,d.fake.home])for(const path of await files(root))assert.equal((await readFile(path)).includes(credential),false,'rollback scan contains no token');
 assert.deepEqual((await readdir(join(d.fake.home,'jobs'))).filter(path=>/^[^.]+\.json$/.test(path)),['sibling.json']);
 assert.equal(await readFile(join(d.fake.home,'jobs','sibling.json'),'utf8'),'{}');
});

test('agent restart does not inherit Claude dynamic child acquisition from its serialized marker',async t=>{
 const {serveAgent}=await import('../src/host/agent/server.ts');
 const {ownProcess}=await import('./process-cleanup.ts');
 let marker='',hook:unknown;
 const d=await remoteClaudeFixture(t,{settings:settings=>settings.hooks.SessionEnd.push({hooks:[hook]}),setup:async(f)=>{
   marker=join(f.fake.home,'recovery-hook-ready');const script=join(f.fake.home,'recovery-hook.cjs');
   await writeFile(script,"const fs=require('fs');process.on('SIGTERM',()=>{});fs.writeFileSync(process.argv[2],String(process.pid));setInterval(()=>{},1000);");
   const quote=(value:string)=>"'"+value.replaceAll("'","'\\''")+"'";
   hook={type:'command',command:[process.execPath,script,marker].map(quote).join(' ')};
 }});
 await eventually('initial turn settled before restart',async()=>(await d.fake.log(d.row.harnessId)).includes('session.measure done')||undefined,2000);
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
 const ready=eventually('recovered owner SessionEnd PID',async()=>{try{return Number(await readFile(marker,'utf8'))||undefined;}catch{return undefined;}},2000);
 const stopping=client.request('stop',{pid:root.pid,identity:root.pidIdentity});
 const pid=await ready;d.f.addCleanup(ownProcess(undefined,pid));
 assert.equal(await stopping,false,'recovered marker grants no dynamic capture authority');
 assert.equal(signalled.includes(pid),false);assert.ok(await client.request('identity',{pid}),'unowned hook remains alive for independent cleanup');
});

test('hub restart after tree closure re-adopts its durable generation and releases the job',async t=>{
 const {ProcessTable}=await import('../src/adapters/processes.ts');
 const d=await remoteClaudeFixture(t);
 await eventually('worker turn settled before closure',async()=>(await d.fake.log(d.row.harnessId)).includes('session.measure done')||undefined,2000);
 const table=new ProcessTable(join(d.f.root,'.cland/hub.db'));d.f.addCleanup(async()=>table.close());
 const process=table.get('worker')!;
 const records=(await readdir(join(d.f.fake.run,'claude'))).filter(path=>path.endsWith('.json'));
 const generation=records[0]!.slice(0,-5);
 const job=join(d.fake.home,'jobs',d.row.harnessId+'.json');
 assert.equal(await d.machine.stop(process),true);
 assert.equal((await stat(job)).isFile(),true,'tree closure retains native job metadata');
 await d.hub.stop();
 const restarted=await d.startHub();d.f.addCleanup(()=>restarted.stop());
 await eventually('durable recovered cleanup retired the row',()=>table.get('worker')?.status==='exited'||table.get('worker')?.status==='stopped'||undefined,3000);
 await assert.rejects(stat(job),{code:'ENOENT'});
 await assert.rejects(stat(join(d.f.fake.run,'claude',generation+'.json')),{code:'ENOENT'});
 const scan=async(root:string):Promise<void>=>{for(const entry of await readdir(root,{withFileTypes:true})){
   const path=join(root,entry.name);if(entry.isDirectory())await scan(path);else if(entry.isFile())assert.equal((await readFile(path)).includes(d.credential()),false,'recovered cleanup leaves no credential copy');
 }};
 await scan(d.f.fake.home);await scan(d.fake.home);
});

for(const mode of ['release','release-restart','forget-restart'] as const)test(`lost native ${mode} reply settles without replaying native stop`,async t=>{
 const d=await remoteClaudeFixture(t);let treeStops=0;const stop=d.machine.stop.bind(d.machine);d.machine.stop=async(...args)=>{treeStops++;return stop(...args);};
 await eventually('native turn settled before release fault',async()=>(await d.fake.log(d.row.harnessId)).includes('session.measure done')||undefined,2000);
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
   await eventually('durable cleanup retired the recovered generation',()=>table.get('worker')?.status==='exited'||table.get('worker')?.status==='stopped'||undefined,3000);
 }
 assert.equal(treeStops,1,'released recovery never signals processes');
 assert.equal((await d.fake.calls()).filter(call=>call.args[0]==='stop').length,before);
 for(const root of [d.f.fake.home,d.fake.home])for(const path of await files(root))assert.equal((await readFile(path)).includes(d.credential()),false);
});

test('late SessionEnd after the recovery snapshot never grants an adopted closed receipt',async t=>{
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
 await eventually('initial turn completed before held capture',async()=>(await d.fake.log(d.row.harnessId)).includes('session.measure done')||undefined,2000);
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
   const ready=eventually('late SessionEnd durable PID',async()=>{try{return Number(await readFile(marker,'utf8'))||undefined;}catch{return undefined;}},2000);
   process.kill(root.pid!,'SIGTERM');
   const pid=await ready;d.f.addCleanup(ownProcess(undefined,pid));
   await eventually('root positively absent with the late hook still alive',async()=>!await d.machine.identity(root.pid!)||undefined,1000);
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

for(const failing of [false,true])test(`terminal remote PID settlement ${failing?'holds the row on native failure':'cleans before publishing exit'} without recurring CLI`,{timeout:10000},async t=>{
 const d=await remoteClaudeFixture(t,{stopCrash:failing});
 await eventually('worker ready before terminal event',async()=>(await d.fake.log(d.row.harnessId)).includes('session.measure done')||undefined,2000);
 const rolesBefore=await d.ui.request({type:'role.list'});
 if(failing)await writeFile(join(d.fake.home,'logged-out'),'');
 const before=(await d.fake.calls()).length;
 const absent=eventually('terminal root PID observed absent',async()=>!await d.machine.identity(d.row.pid)||undefined,2000);
 process.kill(d.row.pid,'SIGTERM');await absent;
 const rows=async()=>{const result=await d.ui.request({type:'session.list'});return (result.value as {processes:Array<{name:string;status:string;stateReason?:string}>}).processes;};
 const settled=await eventually('terminal settlement durable row',async()=>{
   await d.clock.advance(5);const row=(await rows()).find(row=>row.name==='worker');
   return row&&(failing?row.stateReason?.includes('native job stop is unconfirmed'):row.status==='exited')?row:undefined;
 },2500);
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

for(const mode of ['descendant','reparented','retirement'] as const)test(mode==='retirement'?'pinned native hook exit between prepare and commit settles without a manual re-stop':mode==='reparented'?'an unowned reparented child stays unacquired across explicit stops':'adopted Claude settles one descendant born between stop capture and commit before any signal',async t=>{
 const reparented=mode==='reparented',retiring=mode==='retirement';
 const {ownProcess}=await import('./process-cleanup.ts');
 let trigger='',ready='',childReady='',childExit='',hook:unknown,exitHook:unknown;
 const d=await remoteClaudeFixture(t,{awaitSignals:false,settings:settings=>{
   const hooks=settings.hooks as unknown as Record<string,Array<{hooks:Array<{async?:boolean}>}>>;
   hooks.SessionStart!.push({hooks:[hook as {async?:boolean}]});hooks.SessionEnd!.push({hooks:[exitHook as {async?:boolean}]});
   for(const entry of hooks.SessionEnd!)for(const command of entry.hooks)command.async=false;
 },setup:async f=>{
   trigger=join(f.fake.home,'churn-trigger');ready=join(f.fake.home,'churn-parent-ready');childReady=join(f.fake.home,'churn-child-ready');childExit=join(f.fake.home,'churn-child-exit');
   const script=join(f.fake.home,'churn.cjs'),builder=new URL('./fixture-environment.ts',import.meta.url).pathname;
   await writeFile(script,`const fs=require('fs'),{spawn}=require('child_process'),{pathToFileURL}=require('url');\n(async()=>{const [trigger,ready,childReady,childExit,builder,root]=process.argv.slice(2);const {fixtureEnvironment}=await import(pathToFileURL(builder));let started=false;const watcher=fs.watch(require('path').dirname(trigger),()=>{if(started||!fs.existsSync(trigger))return;started=true;watcher.close();${retiring?'process.exit(0);':`const descendant=spawn(process.execPath,['-e',"const fs=require('fs'),end=process.argv[2];const watcher=fs.watch(require('path').dirname(end),()=>{if(fs.existsSync(end))watcher.close();});fs.writeFileSync(process.argv[1],String(process.pid));",childReady,childExit],{env:fixtureEnvironment(root,process.env),stdio:'ignore'});${reparented?'descendant.unref();process.exit(0);':''}`}});fs.writeFileSync(ready,String(process.pid));})().catch(error=>{console.error(error);process.exitCode=1;});\n`);
   const quote=(value:string)=>"'"+value.replaceAll("'","'\\''")+"'";
   hook={type:'command',command:[process.execPath,script,trigger,ready,childReady,childExit,builder,f.root].map(quote).join(' '),async:true};
   exitHook={type:'command',command:[process.execPath,'-e',"require('fs').writeFileSync(process.argv[1],'done')",childExit].map(quote).join(' ')};
 }});
 const parent=await eventually('native churn producer armed',async()=>{try{return Number(await readFile(ready,'utf8'))||undefined;}catch{return undefined;}},2000);
 await eventually('initial turn completed before stop capture',async()=>(await d.fake.log(d.row.harnessId)).includes('session.measure done')||undefined,2000);
 await joinInitialHookWriters(d);
 const original=d.machine.stop.bind(d.machine);let child=0,admissions=0,childCleanup:ReturnType<typeof ownProcess>|undefined;
 d.machine.stop=(row,options)=>original(row,{...options,beforeSignal:async tree=>{
   admissions++;if(reparented&&admissions>1)return;assert.equal(admissions,1,'the admitted stop is never replayed');
   if(retiring){
     assert.ok(tree.some(target=>target.pid===parent),'the retiring hook belongs to the approved pinned tree');
     const gone=eventually('pinned hook native exit before commit',async()=>(await observeProcesses([parent],d.f.env)).get(parent)?.ended||undefined,1000);
     child=parent;await writeFile(trigger,'go');await gone;return;
   }
   const born=eventually('post-capture child native PID',async()=>{try{const pid=Number(await readFile(childReady,'utf8'));return pid&&await d.machine.identity(pid)?pid:undefined;}catch{return undefined;}},1000);
   await writeFile(trigger,'go');child=await born;childCleanup=ownProcess(undefined,child);d.f.addCleanup(async()=>{await childCleanup?.();});
   if(reparented)await eventually('captured parent positively absent before commit',async()=>!await d.machine.identity(parent)||undefined,1000);
   assert.equal(tree.some(target=>target.pid===child),false,'child was absent from the approved capture');
 }});
 const result=await d.ui.request({type:'session.stop',session:'worker'},5000);
 if(reparented){
   assert.equal(result.ok,false);assert.match(result.error!,/could not stop/);assert.equal(admissions,1);
   assert.ok(await d.machine.identity(child));assert.ok(await d.machine.identity(d.row.pid));
   const again=await d.ui.request({type:'session.stop',session:'worker'},5000);assert.equal(again.ok,false,'explicit re-stop cannot promote an unowned orphan');assert.equal(admissions,1);
   assert.ok(await d.machine.identity(child));assert.equal((await d.fake.calls()).filter(call=>call.args[0]==='stop').length,0);
   const rows=(await d.ui.request({type:'session.list'})).value as {processes:Array<{name:string;status:string;stateReason?:string}>};const row=rows.processes.find(row=>row.name==='worker')!;assert.equal(row.status,'running');assert.match(row.stateReason!,/cleanup-incomplete/);
   const roles=(await d.ui.request({type:'role.list'})).value as {roles:Array<{role:string;holders:Array<{name:string}>}>};assert.ok(roles.roles.find(role=>role.role==='implementer')?.holders.some(holder=>holder.name==='worker'));
   await childCleanup?.();const settled=await d.ui.request({type:'session.stop',session:'worker'},5000);assert.equal(settled.ok,true,settled.error);assert.equal(admissions,2);
 }else{assert.equal(result.ok,true,result.error);assert.equal(admissions,1);}
 assert.equal(await d.machine.identity(child),null,'owned cleanup has joined the child by pinned birth');
 assert.equal((await d.fake.calls()).filter(call=>call.args[0]==='stop').length,1);
});

for(const mode of ['adoption','result','missing-receipt','missing-state','prune-failure'] as const)test(`failed Claude launch restart ${mode}`,async t=>{
 const missing=mode==='missing-receipt'||mode==='missing-state';
 const {ProcessTable}=await import('../src/adapters/processes.ts');const {unlink}=await import('node:fs/promises');
 const d=await remoteClaudeFixture(t,mode==='result'?{failedResult:true}:{failedAdoption:true,failPrune:mode==='prune-failure'});
 const table=new ProcessTable(join(d.f.root,'.cland/hub.db'));d.f.addCleanup(async()=>table.close());
 const pending=table.pendingStops()[0]!;assert.ok(pending,'failed launch has a durable owner: '+d.launchError);assert.equal(pending.process.host,'f1');
 assert.deepEqual(pending.files?.undo,[],'private MCP/settings are outside generic rollback');assert.deepEqual(pending.files?.children,[],'generic process stop cannot bypass Claude settlement');
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
   const receipt=await eventually('missing generation durable cleanup-incomplete cause',()=>{const entry=table.pendingStops()[0];return entry&&entry.error.includes('cleanup-incomplete')?entry:undefined;},2000);
   assert.equal(receipt.process.sessionId,sid);assert.equal(receipt.ownership!.credential,credential);
   const roles=(await ui.request({type:'role.list'})).value as {roles:Array<{holders:Array<{name:string}>}>};assert.ok(roles.roles.some(role=>role.holders.some(holder=>holder.name==='worker')));
   assert.ok((await readFile(join(generation.privateDirectory,'settings.json'),'utf8')).includes(credential));assert.ok(await d.machine.identity(generation.pid));
 }else{
   await eventually('durable native settlement completed',()=>table.pendingStops().length===0||undefined,2500);
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
     await eventually('post-clear marker pruned after restart',()=>!metadata.meta('claude-failed:'+sid)||undefined,1500);
     assert.deepEqual(JSON.parse(metadata.meta('launch-settlement-prunes')!),[]);assert.equal(table.pendingStops().length,0);assert.equal(nativeStops,0);assert.equal(adopts,0);assert.equal((await d.fake.calls()).length,calls,'orphan marker prune performs no native work');
   }else{assert.equal(metadata.meta('claude-failed:'+sid),'');assert.deepEqual(JSON.parse(metadata.meta('launch-settlement-prunes')!),[]);}
 }
});
