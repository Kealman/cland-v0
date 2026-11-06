// T3: native Git preparation and agent restart cleanup are the lifecycle under test.
// Lifecycle: no prepared operation launches a process; close agents and drain prepared work before root removal.
import { observeCheckout } from '../src/host/agent/prepared-checkout.ts';
import { RefWatches } from '../src/host/agent/watch.ts';
import { serveAgent } from '../src/host/agent/server.ts';
import { testWaitMs } from './until.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tempProject, eventually } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { AgentProcesses } from '../src/host/agent/processes.ts';
import { PreparedOperations } from '../src/host/agent/prepared.ts';
import { checkpoint } from '../src/host/agent/storage.ts';
import { run } from '../src/host/agent/command.ts';

test('prepared spawn expires and cleans only its newly created empty log; existing log survives abort', async t => {
 const root=await tempProject(t),env=fixtureEnvironment(root,process.env);
 const processes=new AgentProcesses(root,env,()=>{});await processes.load();
 const prepared=new PreparedOperations(root,env,processes,30);await prepared.start();
 beforeDirectories(t,async()=>{await prepared.close();await processes.drain();});
 const path=join(root,'new.log');
 const args={command:process.execPath,args:['-e','process.exit()'],cwd:root,env:{},logFile:path};
 const admitted=await prepared.prepare('spawn',args);assert.ok(admitted.token);await access(path);
 await eventually('prepared log expiry removal',async()=>{try{await access(path);return undefined;}catch(error){return (error as NodeJS.ErrnoException).code==='ENOENT'||undefined;}},2000);
 await assert.rejects(prepared.commit(admitted.token!),/expired/);
 await writeFile(path,'existing');const existing=await prepared.prepare('spawn',args);await prepared.abort(existing.token!);assert.equal(await readFile(path,'utf8'),'existing');
});

test('restart consumes durable prepared log and Git cleanup plans before admission', async t => {
 const root=await tempProject(t),env=fixtureEnvironment(root,process.env);
 const processes=new AgentProcesses(root,env,()=>{});await processes.load();
 const directory=join(root,'prepared');await mkdir(directory);
 const path=join(root,'interrupted.log');await writeFile(path,'');
 const info=await (await import('node:fs/promises')).lstat(path);
 await checkpoint(join(directory,'11111111-1111-1111-1111-111111111111.json'),{kind:'spawn',phase:'prepared',args:{},cleanup:{path,dev:info.dev,ino:info.ino}});
 const repo=join(root,'repo');await mkdir(repo);
 const git=async(args:string[])=>{const result=await run('git',['-c','gc.auto=0',...args],env,10000,false,undefined,'utf8',repo);assert.equal(result.code,0,result.stderr);return result.stdout.trim();};
 await git(['init']);await git(['-c','user.name=Fixture','-c','user.email=fixture@example.test','commit','--allow-empty','-m','fixture']);
 const tree=join(root,'tree');await git(['worktree','add','-b','task',tree]);
 const treeInfo=await (await import('node:fs/promises')).lstat(tree);
 const checkout={root:repo,path:tree,directory:{dev:treeInfo.dev,ino:treeInfo.ino},tip:await git(['rev-parse','HEAD'])};
 await observeCheckout(env,checkout);
 await checkpoint(join(directory,'22222222-2222-2222-2222-222222222222.json'),{kind:'worktree',phase:'prepared',args:{root:repo,path:tree},checkout});
 const prepared=new PreparedOperations(root,env,processes);await prepared.start();
 beforeDirectories(t,async()=>{await prepared.close();await processes.drain();});
 await assert.rejects(access(path),{code:'ENOENT'});await assert.rejects(access(tree),{code:'ENOENT'});
});

import { spawn } from 'node:child_process';
import { AgentClient } from '../src/host/agent-client.ts';
import { sshHostFixture } from './ssh-host-fixture.ts';
import { ownProcess, beforeDirectories } from './process-cleanup.ts';
// Setup envelopes include every sequential observation, a final hello attempt
// that can finish after its polling deadline, and fixed command/cleanup headroom.
const agentAdmissionSetupMs=testWaitMs(10000);
const watchStartupSetupMs=testWaitMs();
const agentRequestMs=10000;
const fixtureAndCleanupHeadroomMs=30000;
const heldStartupTimeoutMs=2*watchStartupSetupMs+agentAdmissionSetupMs+2*agentRequestMs+fixtureAndCleanupHeadroomMs;
// Two launches each observe identity and hello; five preparation/Git requests
// plus a final in-flight hello on each launch use the fixed request allowance.
const nativeRestartTimeoutMs=4*agentAdmissionSetupMs+7*agentRequestMs+fixtureAndCleanupHeadroomMs;

// T-1704 fixes test observation: agent.pid records identity before admission.
// Only retry the read-only hello; never replay an unknown preparation outcome.
async function connectPreparedAgent(socket:string,secret:string,pid:number):Promise<AgentClient> {
 const result=await eventually('authenticated agent admission for observed launch',async()=>{
  try{return {client:await AgentClient.connect(socket,secret)};}catch(error){
   if(error instanceof Error&&error.message==='agent closed')return undefined;
   return {error};
  }
 },agentAdmissionSetupMs);
 if('error' in result)throw result.error;
 const {client}=result;
 if(client.hello.pid!==pid){await client.close();assert.equal(client.hello.pid,pid);}
 return client;
}

test('prepared restart observation waits through identity publication before agent admission', {timeout:heldStartupTimeoutMs}, async t=>{
 const f=await sshHostFixture(t);await f.host.close();await f.transport.stop();await f.agent.close();
 await (await import('node:fs/promises')).unlink(join(f.fake.run,'agent.pid'));
 let entered=false,released=false,refused=0;
 const nativeStart=RefWatches.prototype.start;
 t.mock.method(RefWatches.prototype,'start',async function(this:RefWatches){
  entered=true;await eventually('release held watch startup',()=>released||undefined,watchStartupSetupMs);await nativeStart.call(this);
 });
 const nativeConnect=AgentClient.connect;
 t.mock.method(AgentClient,'connect',async (...args:Parameters<typeof nativeConnect>)=>{
  try{return await nativeConnect(...args);}catch(error){
   if(error instanceof Error&&error.message==='agent closed'){refused++;released=true;await starting;}
   throw error;
  }
 });
 const starting=serveAgent({runDir:f.fake.run,secret:f.secrets.readSecret('f1'),version:'test',env:f.env});
 let client:AgentClient|undefined;
 f.addCleanup(async()=>{released=true;await client?.close();await (await starting).close();});
 await eventually('watch startup entered after identity checkpoint',()=>entered||undefined,watchStartupSetupMs);
 const receipt=JSON.parse(await readFile(join(f.fake.run,'agent.pid'),'utf8'));
 assert.equal(receipt.pid,process.pid);assert.equal(typeof receipt.identity,'string');
 client=await connectPreparedAgent(join(f.fake.run,'agent.sock'),f.secrets.readSecret('f1'),receipt.pid);
 await starting;
 assert.equal(refused,1,'one hello reaches the held pre-admission boundary');
 assert.equal(client.hello.pid,process.pid);
 assert.ok(await client.request('identity',{pid:process.pid},agentRequestMs));
});

test('native agent restart cleans actual unfinished spawn and worktree preparations before publishing readiness', {timeout:nativeRestartTimeoutMs}, async t => {
 const f=await sshHostFixture(t);await f.host.close();await f.transport.stop();await f.agent.close();
 let client: AgentClient | undefined;
 const children: Array<{cleanup:()=>Promise<void>;closed:Promise<void>}> = [];
 f.addCleanup(async()=>{await client?.close();for(const child of children){await child.cleanup();await child.closed;}});
 const start=async()=>{
  const child=spawn(process.execPath,[new URL('../bin/cland.ts',import.meta.url).pathname,'host','serve'],{
   cwd:f.fake.home,
   env:fixtureEnvironment(f.root,f.env,{CLAND_FAKE_HOSTS:'f1',CLAND_HOST_BOOT_ID_FILE:f.fake.bootId,CLAND_HOST_RUN_DIR:f.fake.run,CLAND_HOST_SECRET:f.secrets.readSecret('f1')}),
   stdio:['ignore','ignore','pipe'],
  });
  let tail='';child.stderr.on('data',bytes=>{tail=(tail+bytes.toString()).slice(-4096);});
  const closed=new Promise<void>((resolve,reject)=>{child.once('error',reject);child.once('close',()=>resolve());});
  const cleanup=ownProcess(undefined,child.pid);children.push({cleanup,closed});
  await eventually('native agent durable readiness for observed launch',async()=>{
   if(child.exitCode !== null || child.signalCode !== null) throw new Error(`agent readiness incomplete (code ${child.exitCode}, signal ${child.signalCode}): ${tail}`);
   try{const receipt=JSON.parse(await readFile(join(f.fake.run,'agent.pid'),'utf8'));return receipt.pid===child.pid&&typeof receipt.identity==='string'||undefined;}catch{return undefined;}
  },agentAdmissionSetupMs);
  assert.ok(child.pid,'observed native agent launch PID');
  client=await connectPreparedAgent(join(f.fake.run,'agent.sock'),f.secrets.readSecret('f1'),child.pid);
  assert.equal(client.hello.pid,child.pid);return {child,closed};
 };
 const first=await start();const log=join(f.fake.home,'interrupted.log');
 await client!.request('prepare-spawn',{command:process.execPath,args:['-e','process.exit()'],cwd:f.fake.home,env:{},logFile:log},agentRequestMs);
 const repo=join(f.fake.home,'repo');await mkdir(repo);
 const git=async(args:string[])=>{const result=await client!.request('run-host',{command:'git',args:['-c','gc.auto=0',...args],cwd:repo,env:{}},agentRequestMs) as {code:number;stderr:string;stdout:string};assert.equal(result.code,0,result.stderr);return result.stdout.trim();};
 await git(['init']);await git(['commit','--allow-empty','-m','fixture']);await git(['branch','task']);
 const tree=join(f.fake.home,'tree');await client!.request('prepare-worktree',{root:repo,path:tree,branch:'task'},agentRequestMs);
 await access(log);await access(tree);
 first.child.kill('SIGKILL');await first.closed;await client!.close();
 await start();
 await assert.rejects(access(log),{code:'ENOENT'});await assert.rejects(access(tree),{code:'ENOENT'});
});

test('prepared Git work expires without installing or leaving a checkout', async t => {
 const root=await tempProject(t),env=fixtureEnvironment(root,process.env),repo=join(root,'repo');await mkdir(repo);
 const git=async(args:string[])=>{const result=await run('git',['-c','gc.auto=0',...args],env,10000,false,undefined,'utf8',repo);assert.equal(result.code,0,result.stderr);return result.stdout.trim();};
 await git(['init']);await git(['commit','--allow-empty','-m','fixture']);await git(['branch','task']);
 const processes=new AgentProcesses(root,env,()=>{});await processes.load();
 const prepared=new PreparedOperations(root,env,processes,30);await prepared.start();beforeDirectories(t,async()=>{await prepared.close();await processes.drain();});
 const path=join(root,'tree'),admitted=await prepared.prepare('worktree',{root:repo,path,branch:'task'});await access(path);
 await eventually('prepared Git expiry cleanup',async()=>{try{await access(path);return undefined;}catch(error){return (error as NodeJS.ErrnoException).code==='ENOENT'||undefined;}},2000);
 await assert.rejects(access(path),{code:'ENOENT'});await assert.rejects(prepared.commit(admitted.token!),/expired/);
});

test('prepared tokens belong to their admitting connection and abort leaves no log', {timeout:15000}, async t=>{
 const f=await sshHostFixture(t),first=await AgentClient.connect(f.paths.agentSocket,f.secrets.readSecret('f1')),second=await AgentClient.connect(f.paths.agentSocket,f.secrets.readSecret('f1'));
 f.addCleanup(async()=>{await first.close();await second.close();});
 const path=join(f.fake.home,'owned.log');const admitted=await first.request('prepare-spawn',{command:process.execPath,args:['-e','process.exit()'],cwd:f.fake.home,env:{},logFile:path}) as {token:string};
 await assert.rejects(second.request('commit-prepared',{token:admitted.token}),/not owned/);await access(path);
 await first.request('abort-prepared',{token:admitted.token});await assert.rejects(access(path),{code:'ENOENT'});
});

test('prepared Git cleanup handles failed add and pre-create restart, and preserves a replacement checkout',async t=>{
 const root=await tempProject(t),env=fixtureEnvironment(root,process.env),repo=join(root,'repo');await mkdir(repo);
 const git=async(args:string[])=>{const result=await run('git',['-c','gc.auto=0',...args],env,10000,false,undefined,'utf8',repo);assert.equal(result.code,0,result.stderr);return result.stdout.trim();};
 await git(['init']);await git(['commit','--allow-empty','-m','fixture']);await git(['branch','task']);
 const processes=new AgentProcesses(root,env,()=>{});await processes.load();const prepared=new PreparedOperations(root,env,processes);await prepared.start();
 beforeDirectories(t,async()=>{await prepared.close();await processes.drain();});
 const elsewhere=join(root,'elsewhere');await git(['worktree','add','-b','used',elsewhere]);
 const failed=join(root,'failed');await assert.rejects(prepared.prepare('worktree',{root:repo,path:failed,branch:'used'}),/already (?:checked out|used by worktree)/);await assert.rejects(access(failed),{code:'ENOENT'});
 const path=join(root,'owned'),admitted=await prepared.prepare('worktree',{root:repo,path,branch:'task'});
 await git(['worktree','remove',path]);await git(['commit','--allow-empty','-m','replacement']);await git(['worktree','add','-b','replacement',path]);
 await assert.rejects(prepared.abort(admitted.token!),/replaced|changed/);await access(path);await assert.rejects(prepared.close(),/cleanup incomplete/);
 await git(['worktree','remove',path]);await prepared.abort(admitted.token!);await prepared.close();
 const token='33333333-3333-3333-3333-333333333333';await checkpoint(join(root,'prepared',token+'.json'),{kind:'worktree',phase:'preparing',args:{root:repo,path:join(root,'never-created'),branch:'task'}});
 const restart=new PreparedOperations(root,env,processes);await restart.start();await restart.close();
 const again=new PreparedOperations(root,env,processes);await again.start();await again.close();
});

test('disconnect cleanup failure stays owned, agent stays observable, and close retries before success',{timeout:15000},async t=>{
 const f=await sshHostFixture(t),client=await AgentClient.connect(f.paths.agentSocket,f.secrets.readSecret('f1'));
 f.addCleanup(()=>client.close());
 const repo=join(f.fake.home,'repo');await mkdir(repo);
 const git=async(args:string[])=>{const result=await client.request('run-host',{command:'git',args:['-c','gc.auto=0',...args],cwd:repo,env:{}}) as {code:number;stderr:string};assert.equal(result.code,0,result.stderr);};
 await git(['init']);await git(['commit','--allow-empty','-m','fixture']);await git(['branch','task']);
 const path=join(f.fake.home,'tree');await client.request('prepare-worktree',{root:repo,path,branch:'task'});await writeFile(join(path,'dirty'),'keep');
 await client.close();await eventually('observed cleanup rejection retained by agent',()=>f.cleanupErrors[0],5000);
 const observer=await AgentClient.connect(f.paths.agentSocket,f.secrets.readSecret('f1'));f.addCleanup(()=>observer.close());
 assert.equal(observer.hello.pid,process.pid);assert.ok(await observer.request('identity',{pid:process.pid}));
 await assert.rejects(observer.request('writeFile',{path:join(path,'forbidden'),bytes:Buffer.from('bad').toString('base64')}),/ownership incomplete/);
 await assert.rejects(observer.request('run-host',{command:process.execPath,args:['-e','process.exit()'],cwd:repo,env:{}}),/ownership incomplete/);
 await assert.rejects(f.agent.close(),/agent cleanup incomplete/);assert.equal(await readFile(join(path,'dirty'),'utf8'),'keep');
 await (await import('node:fs/promises')).unlink(join(path,'dirty'));await f.agent.close();await assert.rejects(access(path),{code:'ENOENT'});
});

test('stop treats a captured process reaped between ps and birth observation as closed',{timeout:10000},async t=>{
 const root=await tempProject(t),boot=join(root,'boot'),release=join(root,'release'),ready=join(root,'ready');await writeFile(boot,'11111111-1111-1111-1111-111111111111');
 const env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOSTS:'f1',CLAND_HOST_BOOT_ID_FILE:boot});
 let pid=0,reached=false,independentCleanup=async()=>{};const receipts:Array<{pid:number;event:string}>=[];
 const processes=new AgentProcesses(root,env,event=>{if(event.event==='process-exited')receipts.push(event);},{beforeRemainingObservation:async pids=>{
  if(reached||!pids.includes(pid))return;reached=true;await writeFile(release,'exit');
  await eventually('native close receipt before second birth observation',()=>receipts.find(event=>event.pid===pid),5000);
 }});await processes.load();
 beforeDirectories(t,async()=>{await writeFile(release,'exit');await independentCleanup();await processes.drain();});
 const child=await processes.spawn({command:process.execPath,args:['-e',`const fs=require('fs');process.on('SIGTERM',()=>{});fs.writeFileSync(process.argv[1],'ready');setInterval(()=>{if(fs.existsSync(process.argv[2]))process.exit(0)},10)`,ready,release],cwd:root,env});pid=child.pid;independentCleanup=ownProcess(undefined,pid);
 await eventually('signal handler durable readiness',async()=>{try{return await readFile(ready,'utf8')==='ready'||undefined;}catch{return undefined;}},5000);
 assert.equal(await processes.stop(child),true);assert.equal(reached,true);
});

test('failed prepare retains its held native writer obligation and close cannot report success',{timeout:10000},async t=>{
 const root=await tempProject(t),env=fixtureEnvironment(root,process.env),repo=join(root,'repo'),path=join(root,'tree');await mkdir(repo);
 const git=async(args:string[])=>{const result=await run('git',['-c','gc.auto=0',...args],env,10000,false,undefined,'utf8',repo);assert.equal(result.code,0,result.stderr);};
 await git(['init']);await git(['commit','--allow-empty','-m','fixture']);await git(['branch','task']);
 const processes=new AgentProcesses(root,env,()=>{});await processes.load();let cleanup=async()=>{},closed=Promise.resolve();
 const marker=join(path,'writer');
 const prepared=new PreparedOperations(root,env,processes,10000,{worktreeAdd:async()=>{
  const writer=spawn(process.execPath,['-e',`const fs=require('fs');let n=0;setInterval(()=>fs.writeFileSync(process.argv[1],String(++n)),10)`,marker],{cwd:root,env:fixtureEnvironment(root,env),detached:true,stdio:'ignore'});
  closed=new Promise<void>((resolve,reject)=>{writer.once('close',()=>resolve());writer.once('error',reject);});cleanup=ownProcess(undefined,writer.pid);
  await eventually('held native writer durable receipt',async()=>{try{return Number(await readFile(marker,'utf8'))||undefined;}catch{return undefined;}},5000);
  throw Object.assign(new Error('native cleanup incomplete'),{code:'CLAND_NATIVE_INCOMPLETE'});
 }});await prepared.start();
 beforeDirectories(t,async()=>{await cleanup();await closed;await processes.drain();await prepared.close().catch(()=>{});});
 await assert.rejects(prepared.prepare('worktree',{root:repo,path,branch:'task'}),/writer completion unknown/);
 assert.throws(()=>prepared.assertMutable(),/ownership incomplete/);await assert.rejects(prepared.close(),/cleanup incomplete/);
 const before=Number(await readFile(marker,'utf8'));
 await eventually('writer still progresses after close refuses incomplete cleanup',async()=>Number(await readFile(marker,'utf8'))>before||undefined,5000);
});

for (const mode of ['commit inspection','abort removal','restart removal'] as const) test(`prepared ${mode} fences an unjoined Git writer across retries and restart`,{timeout:15000},async t=>{
 const root=await tempProject(t),env=fixtureEnvironment(root,process.env),repo=join(root,'repo'),path=join(root,'tree');await mkdir(repo);
 const git=async(args:string[])=>{const result=await run('git',['-c','gc.auto=0',...args],env,10000,false,undefined,'utf8',repo);assert.equal(result.code,0,result.stderr);return result.stdout.trim();};
 await git(['init']);await git(['commit','--allow-empty','-m','fixture']);await git(['branch','task']);
 const processes=new AgentProcesses(root,env,()=>{});await processes.load();
 let armed=false,launches=0,cleanup=async()=>{},closed=Promise.resolve();const marker=join(root,'writer');
 const checkoutRun:typeof run=async(...args)=>{
  if(!armed)return run(...args);
  const removing=args[1].includes('remove');
  if(mode==='commit inspection'||removing){
   launches++;
   const writer=spawn(process.execPath,['-e',`const fs=require('fs');let n=0;setInterval(()=>fs.writeFileSync(process.argv[1],String(++n)),10)`,marker],{cwd:root,env:fixtureEnvironment(root,env),detached:true,stdio:'ignore'});
   const previousCleanup=cleanup,previousClosed=closed;
   const currentCleanup=ownProcess(undefined,writer.pid),currentClosed=new Promise<void>((resolve,reject)=>{writer.once('close',()=>resolve());writer.once('error',reject);});
   cleanup=async()=>{await previousCleanup();await currentCleanup();};closed=Promise.all([previousClosed,currentClosed]).then(()=>{});
   await eventually('held Git writer durable receipt',async()=>{try{return Number(await readFile(marker,'utf8'))||undefined;}catch{return undefined;}},5000);
   return {code:null,stdout:'',stderr:'',error:'native cleanup incomplete: held writer'};
  }
  return run(...args);
 };
 const prepared=new PreparedOperations(root,env,processes,10000,{checkoutRun});
 let token='44444444-4444-4444-4444-444444444444';const recoveryKey='fixture-recovery';
 const restarted=new PreparedOperations(root,env,processes,10000,{checkoutRun});
 beforeDirectories(t,async()=>{await cleanup();await closed;await prepared.close().catch(()=>{});await restarted.close().catch(()=>{});await processes.drain();});
 if(mode==='restart removal'){
  await git(['worktree','add',path,'task']);
  const info=await (await import('node:fs/promises')).lstat(path);
  const checkout={root:repo,path,directory:{dev:info.dev,ino:info.ino},tip:await git(['rev-parse','HEAD'])};await observeCheckout(env,checkout);
  await mkdir(join(root,'prepared'),{recursive:true});
  await checkpoint(join(root,'prepared',token+'.json'),{kind:'worktree',phase:'committing',args:{root:repo,path,branch:'task'},checkout,recoveryKey});
  armed=true;await assert.rejects(prepared.start(),/cleanup incomplete/);
 }else{
  await prepared.start();token=(await prepared.prepare('worktree',{root:repo,path,branch:'task',recoveryKey})).token!;armed=true;
  await assert.rejects(mode==='commit inspection'?prepared.commit(token,false):prepared.abort(token),/cleanup incomplete|writer completion unknown/);
 }
 assert.equal(launches,1,'no cleanup retry after the native writer became unknown');
 assert.equal(JSON.parse(await readFile(join(root,'prepared',token+'.json'),'utf8')).phase,'git-running','restart sees the writer fence');
 assert.throws(()=>prepared.assertMutable(),/ownership incomplete/);
 assert.deepEqual(await prepared.settle(token,recoveryKey),{state:'pending',reason:'prepared Git writer completion unknown'});
 await assert.rejects(prepared.close(),/cleanup incomplete/);
 await restarted.start();assert.throws(()=>restarted.assertMutable(),/ownership incomplete/);
 await assert.rejects(restarted.abort(token),/writer completion unknown/);
 await assert.rejects(restarted.commit(token,false),/writer completion unknown/);
 await assert.rejects(restarted.close(),/cleanup incomplete/);
 assert.equal(launches,1);await access(path);
 const before=Number(await readFile(marker,'utf8'));await eventually('unjoined writer remains live while cleanup refuses',async()=>Number(await readFile(marker,'utf8'))>before||undefined,5000);
});

for (const kind of ['publishFile', 'appendFile']) test(`restart retains interrupted ${kind} commit without replay`, async t => {
 const root=await tempProject(t),env=fixtureEnvironment(root,process.env);
 const processes=new AgentProcesses(root,env,()=>{});await processes.load();
 const directory=join(root,'prepared');await mkdir(directory);
 const token='11111111-1111-1111-1111-111111111111',recoveryKey='synthetic-recovery';
 const path=join(root,'effect');await writeFile(path,'once');
 const plan={kind,phase:'committing',args:{path,bytes:Buffer.from('once').toString('base64')},recoveryKey};
 await checkpoint(join(directory,token+'.json'),plan);
 const prepared=new PreparedOperations(root,env,processes);await prepared.start();
 beforeDirectories(t,async()=>{await assert.rejects(prepared.close(),/cleanup incomplete/);await processes.drain();});
 assert.throws(()=>prepared.assertMutable(),/ownership incomplete/);
 assert.deepEqual(await prepared.settle(token,recoveryKey),{state:'pending',reason:'file commit completion unknown; never replay'});
 await assert.rejects(prepared.settle(token,'wrong-owner'),/not owned/);
 assert.equal(await readFile(path,'utf8'),'once');
 assert.deepEqual(JSON.parse(await readFile(join(directory,token+'.json'),'utf8')),plan);
});

import { fileOperations } from '../src/host/agent/files.ts';
test('completed append retains ownership when its durable result cannot be written', async t => {
 const root=await tempProject(t),env=fixtureEnvironment(root,process.env);
 const processes=new AgentProcesses(root,env,()=>{});await processes.load();
 const prepared=new PreparedOperations(root,env,processes);await prepared.start();
 beforeDirectories(t,async()=>{await assert.rejects(prepared.close(),/cleanup incomplete/);await processes.drain();});
 const path=join(root,'effect'),recoveryKey='synthetic-recovery';
 const admission=await prepared.prepare('appendFile',{path,bytes:Buffer.from('once').toString('base64'),recoveryKey});
 const native=fileOperations.appendFile;
 t.mock.method(fileOperations,'appendFile',async (...args: Parameters<typeof native>)=>{
   await native(...args);
   await mkdir(join(root,'prepared-results',admission.token!+'.json.new'));
 });
 await assert.rejects(prepared.commit(admission.token!),/EISDIR/);
 assert.throws(()=>prepared.assertMutable(),/ownership incomplete/);
 assert.deepEqual(await prepared.settle(admission.token!,recoveryKey),{state:'pending',reason:'file commit completion unknown; never replay'});
 assert.equal(await readFile(path,'utf8'),'once');
 assert.equal(JSON.parse(await readFile(join(root,'prepared',admission.token!+'.json'),'utf8')).phase,'committing');
});
