import { processHost } from '../src/host/process-host.ts';
// T3: the Host process contract crosses a real fake-SSH carrier and agent socket.
// Lifecycle: capture native fixture processes, stop carrier/agent, join census before deleting roots.
import test from 'node:test';
import { sshHost } from '../src/host/ssh-host.ts';
import assert from 'node:assert/strict';
test('ssh Host refuses a down tunnel without native side effects', async () => {
  const host = sshHost({ name: 'f1', transport: { status: () => ({ state: 'down' }) } } as never);
  await assert.rejects(host.identity(process.pid), /f1.*tunnel/);
});

import { hostContract } from './host-contract.ts';
import { sshHostFixture } from './ssh-host-fixture.ts';
test('ssh Host runs every shared Host behavioral contract through fake ssh', {timeout:120000}, async t => {
 const f = await sshHostFixture(t);
 const cases: Array<[string,()=>Promise<void>]> = [];
 hostContract(() => f.host, (name, run) => cases.push([name,run]), {name:'f1',limitPolls:false,layout:f.layout,endpoints:[{socket:f.fake.home+'/session.sock'},{port:12345}],forward:endpoint=>assert.deepEqual(endpoint,{socket:f.paths.sessionSocket('session-id')})},f.faults);
 for (const [name,run] of cases) await t.test(name,run);
});

import { readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { fixtureProcessCensus } from './process-cleanup.ts';
import { eventually } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
test('C2 explicit additions merge with agent base while planted hub tokens never reach spawned process', {timeout:15000}, async t => {
 const f = await sshHostFixture(t);
 const planted = {DIGITALOCEAN_TOKEN:'synthetic-do',CLAND_TELEGRAM_TOKEN:'synthetic-tg',CLAND_DISCORD_TOKEN:'synthetic-discord',CLAND_HUB_SECRET:'synthetic-project'};
 const env = fixtureEnvironment(f.root,process.env,{...planted,EXPLICIT:'allowed'});
 // The controlled source map plants only synthetic values before either filter.
 assert.equal(Object.values(planted).filter(v=>v.startsWith('synthetic-')).length,4);
 const controlOutput=join(f.root,'control-environment.json');
 const control=await AgentClient.connect(f.paths.agentSocket,f.secrets.readSecret('f1'));
 f.addCleanup(()=>control.close());
 const receipts: Array<{event:string;pid:number;identity:string}>=[];
 control.on('event',frame=>receipts.push(frame));
 // Raw and prepared agent paths retain a neutral value and remove planted credentials.
 const baseline=await control.request('spawn',{command:process.execPath,args:['-e',`require('fs').writeFileSync(process.argv[1],JSON.stringify(process.env))`,controlOutput],cwd:f.root,env:{...env,...planted}}) as {pid:number;identity:string};
 await eventually('positive-control native completion',()=>receipts.find(row=>row.event==='process-exited'&&row.pid===baseline.pid&&row.identity===baseline.identity),5000);
 const detected=JSON.parse(await readFile(controlOutput,'utf8'));
 assert.equal(detected.EXPLICIT,'allowed');
 for(const key of Object.keys(planted)) assert.equal(detected[key],undefined,key);
 const output=join(f.root,'environment.json');
 const child=await f.host.spawn({command:process.execPath,args:['-e',`require('fs').writeFileSync(process.argv[1],JSON.stringify(process.env))`,output],cwd:f.root,env:{...env,...planted}});
 assert.deepEqual(await child.exited,{code:0,signal:null});
 const received=JSON.parse(await readFile(output,'utf8'));
 assert.equal(received.EXPLICIT,'allowed');
 for(const key of Object.keys(planted)) assert.equal(received[key],undefined,key);
 assert.equal(received.CLAND_HOST_SECRET,undefined);
 // Exercise the production OpenCode adapter over the same real agent spawn boundary.
 const {OpenCodeAdapter} = await import('../src/adapters/opencode.ts');
 const {OpenCodeClient} = await import('../src/adapters/opencode/client.ts');
 const opencodeOutput=join(f.fake.home,'opencode-environment.json');
 const bin=join(f.fake.home,'fake-opencode');
 await writeFile(bin,`#!${process.execPath}\nrequire('fs').writeFileSync(process.env.CAPTURE,JSON.stringify(process.env));setInterval(()=>{},1000);\n`,{mode:0o700});
 t.mock.method(OpenCodeClient.prototype,'request',async (_method:string,path:string)=>{
   if(path==='/api/session/active') {await eventually('OpenCode native env capture',async()=>{try{return JSON.parse(await readFile(opencodeOutput,'utf8'));}catch{return undefined;}},2000);return {data:{}};}
   if(path==='/api/session')return {data:{id:'fake-host-session'}};
   throw new Error(`unexpected ${path}`);
 });
 const adapter=new OpenCodeAdapter({root:f.root,discoveryFile:join(f.root,'unused.json'),node:process.execPath,cli:'/cli',spoke:'/spoke',hostForLaunch:()=>f.host,hostForProcess:()=>f.host,log:()=>{},signal:()=>{},exited:()=>{},recordPid:()=>{}},{bin,env:{...env,...planted},stopGraceMs:10});
 f.addCleanup(()=>adapter.close());
 const row=await adapter.spawn({name:'worker',sessionId:'opencode-fixture',role:'implementer',model:'openai/gpt-5.2',cwd:f.fake.home,accountEnv:{CAPTURE:opencodeOutput,EXPLICIT:'opencode-allowed',...planted}});
 try {
   const captured=JSON.parse(await readFile(opencodeOutput,'utf8'));
   assert.equal(captured.EXPLICIT,'opencode-allowed');
   for(const key of Object.keys(planted))assert.equal(captured[key],undefined,key);
   assert.equal(captured.CLAND_HOST_SECRET,undefined);
   assert.equal(await readFile(join(f.fake.home,'opencode/.gitignore'),'utf8'),'# managed by cland: generated OpenCode configs and server passwords, never committed\n*\n');
 } finally {await adapter.stop(row);}

});
test('C4 down tunnel refuses every operation with host/tunnel reason and starts no process or file writer', {timeout:15000}, async t => {
 const f = await sshHostFixture(t); await f.transport.stop();
 const path=join(f.root,'must-not-exist');
 const before=fixtureProcessCensus(f.root).map(p=>[p.pid,p.identity]);
 const command={command:process.execPath,args:['-e',`require('fs').writeFileSync(process.argv[1],'bad')`,path],cwd:f.root,env:{}};
 const operations=[()=>f.host.spawn(command),()=>f.host.run(command),()=>f.host.identity(process.pid),()=>f.host.alive({pid:process.pid}),()=>f.host.stop({pid:process.pid,pidIdentity:'linux:other:1'}),()=>f.host.writeFile(path,Buffer.from('bad')),()=>f.host.makeDirectory(path),()=>f.host.removePath(path),()=>f.host.freePort(),()=>f.host.forward('x',{port:12345}),()=>f.host.unforward('x'),()=>f.host.statDirectory(path),()=>f.host.realpath(path),()=>f.host.fileType(path),()=>f.host.readFile(path),()=>f.host.listFolder(path),()=>f.host.occupants(path,[]),()=>f.host.processes(),()=>f.host.worktreeAdd({root:f.root,path,branch:'x'}),()=>f.host.worktreeRemove({root:f.root,path})];
 for(const operation of operations) await assert.rejects(operation,/f1.*tunnel/);
 assert.deepEqual(fixtureProcessCensus(f.root).map(p=>[p.pid,p.identity]),before);
 await assert.rejects(access(path),{code:'ENOENT'});
});

import { ClaudeCodeAdapter } from '../src/adapters/claude-code.ts';
import { CodexAdapter } from '../src/adapters/codex.ts';
import { OpenCodeAdapter } from '../src/adapters/opencode.ts';
import type { HostCommand } from '../src/host/host.ts';
import type { AdapterHost } from '../src/adapters/contract.ts';
for(const [name,Adapter] of Object.entries({claude:ClaudeCodeAdapter,codex:CodexAdapter})) test(`C2 ${name} adapter sends no planted hub-only key through the SSH agent`,{timeout:15000},async t=>{
 const f=await sshHostFixture(t);const output=join(f.root,'adapter-env.json');
 const env=fixtureEnvironment(f.root,process.env,{HUB_ONLY:'synthetic-hub-only'});
 assert.equal(env.HUB_ONLY,'synthetic-hub-only','pre-change source map positive control');
 const execute=async(command:HostCommand):Promise<never>=>{
  const child=await f.host.spawn({...command,command:process.execPath,args:['-e',`require('fs').writeFileSync(process.argv[1],JSON.stringify(process.env))`,output]});
  assert.deepEqual(await child.exited,{code:0,signal:null});throw Object.assign(new Error('observed fake harness boundary'),name==='claude'?{code:'CLAND_AGENT_ADMISSION_REFUSED'}:{});
 };
 const machine={...f.host,layout:()=>({...f.layout,modDir:join(f.fake.home,'mod')}),launchClaude:execute,run:async(command:HostCommand)=>command.args[0]==='--version'?{code:0,stdout:'codex 0.160.0',stderr:''}:execute(command),spawn:execute};
 const host:AdapterHost={root:f.root,discoveryFile:join(f.root,'hub.json'),node:process.execPath,cli:'/hub/cli',spoke:'/hub/spoke',hostForLaunch:()=>machine,...(name==='claude'?{hostForProcess:()=>machine}:{}),log:()=>{},signal:()=>{},exited:()=>{},recordPid:()=>{}};
 const adapter=new Adapter(host,{env,bin:'/fake/harness',pollMs:600000});f.addCleanup(async()=>{await adapter.close();});
 await assert.rejects(adapter.spawn({name:'worker',host:'f1',sessionId:'synthetic-session',role:null,model:null,cwd:f.fake.home}),/observed fake harness boundary/);
 if(name==='claude')await assert.rejects(f.host.launchClaude!({command:'/never-run',args:['--bg'],cwd:f.fake.home,env:{CLAUDE_CONFIG_DIR:join(f.root,'missing-private-config')}},'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),{code:'CLAND_AGENT_ADMISSION_REFUSED',message:/Claude launch refused/});
 const received=JSON.parse(await readFile(output,'utf8'));assert.equal(received.HUB_ONLY,undefined);
});

test('OpenCode nonlocal missing executable fails after Host file preparation and leaves no process',{timeout:15000},async t=>{
 const f=await sshHostFixture(t);const before=fixtureProcessCensus(f.root).map(p=>[p.pid,p.identity]);
 const host:AdapterHost={root:f.root,discoveryFile:join(f.root,'hub.json'),node:process.execPath,cli:'/hub/cli',spoke:'/hub/spoke',hostForLaunch:()=>f.host,log:()=>{},signal:()=>{},exited:()=>{},recordPid:()=>{}};
 const adapter=new OpenCodeAdapter(host,{env:fixtureEnvironment(f.root,process.env,{HUB_ONLY:'synthetic-hub-only'}),bin:'/fake/harness',pollMs:600000});f.addCleanup(async()=>{await adapter.close();});
 await assert.rejects(adapter.spawn({name:'worker',host:'f1',role:null,model:null,cwd:f.fake.home}),/command unavailable/);
 assert.deepEqual(fixtureProcessCensus(f.root).map(p=>[p.pid,p.identity]),before);
});

import { AgentClient } from '../src/host/agent-client.ts';
import { projectSshHosts } from '../src/host/registry.ts';
import { tunnelStatuses } from '../src/transport/transport.ts';
import { projectHub, connectUi, tempProject } from './harness.ts';
import { fakeHarness } from './fakes/harness.ts';
test('C3 registered SSH Hosts coexist with local and CLAND_TEST_HOSTS; host f1 launch reaches its agent',{timeout:20000},async t=>{
 const f=await sshHostFixture(t);await f.host.close();await f.transport.stop();
 const registry=await projectSshHosts({root:f.root,records:f.records,hubSocket:join(f.root,'hub.sock'),spokeSocket:join(f.root,'spoke.sock'),env:f.env,log:()=>{},configurations:{f1:{home:f.fake.home,layout:f.layout,supervisor:f.supervisor}}});
 f.addCleanup(registry.close);assert.deepEqual(registry.hosts.map(h=>h.name),['f1']);
 await eventually('registry tunnel up',()=>tunnelStatuses(f.root,f.records.list())[0]?.state==='up'||undefined,10000);
 const marker=join(f.fake.home,'registry-launch');const root=await tempProject(t);
 const hub=await projectHub(t,root,{CLAND_TEST_HOSTS:'t1'},{hosts:registry.hosts,adapters:[(host,clock)=>{
  const adapter=fakeHarness('codex',{host,clock});const spawn=adapter.spawn.bind(adapter);
  adapter.spawn=async request=>{
   assert.equal(host.hostForLaunch!({...request,host:'local'}).name,'local');assert.equal(host.hostForLaunch!({...request,host:'t1'}).name,'t1');
   const machine=host.hostForLaunch!(request);assert.equal(machine.name,'f1');
   const child=await machine.spawn({command:process.execPath,args:['-e',`require('fs').writeFileSync(process.argv[1],'f1-agent')`,marker],cwd:f.fake.home,env:{}});assert.deepEqual(await child.exited,{code:0,signal:null});
   return spawn(request);
  };return adapter;
 }]});
 f.addCleanup(hub.stop);
 const ui=await connectUi(t,hub.discovery);const result=await ui.request({type:'session.launch',name:'worker',harness:'codex',host:'f1'});
 assert.equal(result.ok,true,result.error);assert.equal(await readFile(marker,'utf8'),'f1-agent');
});

test('ssh Host command cancellation waits for native completion and cleanup',{timeout:15000},async t=>{
 const f=await sshHostFixture(t),controller=new AbortController(),marker=join(f.fake.home,'run-ready');
 const result=f.host.run({command:process.execPath,args:['-e',`require('fs').writeFileSync(process.argv[1],String(process.pid));setInterval(()=>{},1000)`,marker],cwd:f.fake.home,env:{},signal:controller.signal});
 const pid=await eventually('remote command durable readiness',async()=>{try{return Number(await readFile(marker,'utf8'))||undefined;}catch{return undefined;}},5000);
 controller.abort();const completed=await result;assert.match(completed.error!,/cancelled/);
 assert.equal(await f.host.identity(pid),null,'run completion follows native process absence');
});

test('missing installed version refuses spawn naming its directory and starts no process',{timeout:15000},async t=>{
 const f=await sshHostFixture(t),missing=join(f.fake.home,'missing-version');
 const host=sshHost({name:'f1',transport:f.transport,layout:f.layout,codeDirectory:missing,connect:()=>AgentClient.connect(f.paths.agentSocket,f.secrets.readSecret('f1'))});f.addCleanup(()=>host.close());
 const before=fixtureProcessCensus(f.root).map(p=>[p.pid,p.identity]);
 await assert.rejects(host.spawn({command:process.execPath,args:['-e','process.exit()'],cwd:f.fake.home,env:{}}),error=>String(error).includes(missing)&&/missing version directory/.test(String(error)));
 assert.deepEqual(fixtureProcessCensus(f.root).map(p=>[p.pid,p.identity]),before);
});

test('accepted spawn reconciles its durable token after the commit reply is dropped',{timeout:15000},async t=>{
 const f=await sshHostFixture(t),marker=join(f.fake.home,'once');f.dropNextCommitReply();
 const child=await f.host.spawn({command:process.execPath,args:['-e',`require('fs').appendFileSync(process.argv[1],'once\\n');process.exitCode=7`,marker],cwd:f.fake.home,env:{}});
 let receipt:unknown;void child.exited.then(value=>{receipt=value;});
 await eventually('reconciled native completion',()=>receipt,5000);
 assert.deepEqual(receipt,{code:7,signal:null});assert.equal(await readFile(marker,'utf8'),'once\n');
});

import { controlRequest, hostOwner } from './fakes/fake-ssh-common.ts';
import type { MasterReceipt } from './fakes/fake-ssh-common.ts';
import { unlink } from 'node:fs/promises';
test('spawn completion reconnects after carrier loss without another Host call',{timeout:20000},async t=>{
 const f=await sshHostFixture(t),release=join(f.fake.home,'exit-now'),gone=join(f.fake.directory,'gone');
 f.addCleanup(async()=>{await unlink(gone).catch(error=>{if(error.code!=='ENOENT')throw error;});f.transport.wake();});
 const child=await f.host.spawn({command:process.execPath,args:['-e',`const fs=require('fs');setInterval(()=>{if(fs.existsSync(process.argv[1]))process.exit(7)},10)`,release],cwd:f.fake.home,env:{}});
 let receipt:unknown;void child.exited.then(value=>{receipt=value;});
 const master=JSON.parse(await readFile(join(f.fake.directory,'master-control'),'utf8')) as MasterReceipt;
 const owner=await hostOwner(f.fake.directory);assert.deepEqual(master.owner,owner);
 await writeFile(gone,'gone');await controlRequest(master.control,{operation:'kill-master',forwards:[],owner,token:master.token});
 await eventually('carrier reports down',()=>f.transport.status().state==='down'||undefined,5000);
 await writeFile(release,'exit');
 await eventually('native exit durably checkpointed while disconnected',async()=>{const rows=JSON.parse(await readFile(join(f.fake.run,'processes.json'),'utf8'));return rows.some((row:{pid:number;rootExitObserved?:boolean;code?:number})=>row.pid===child.pid&&row.rootExitObserved&&row.code===7)||undefined;},5000);
 assert.equal(receipt,undefined);await unlink(gone);f.transport.wake();
 await eventually('autonomous completion recovery',()=>receipt,10000);assert.deepEqual(receipt,{code:7,signal:null});
});

test('stop closes retained descendants after its recorded root has exited',{timeout:15000},async t=>{
 const f=await sshHostFixture(t),release=join(f.fake.home,'root-exit'),ready=join(f.fake.home,'descendant');
 const child=await f.host.spawn({command:process.execPath,args:['-e',`const fs=require('fs');const c=require('child_process').spawn(process.execPath,['-e',"setInterval(()=>{},1000)"],{stdio:'ignore'});fs.writeFileSync(process.argv[2],String(c.pid));setInterval(()=>{if(fs.existsSync(process.argv[1]))process.exit(0)},10)`,release,ready],cwd:f.fake.home,env:{}});
 const owned=await f.host.identity(child.pid);assert.ok(owned?.pidIdentity);
 f.addCleanup(async()=>{await f.host.stop(owned);});
 const pid=await eventually('descendant durable readiness',async()=>{try{return Number(await readFile(ready,'utf8'))||undefined;}catch{return undefined;}},5000);
 const observer=await AgentClient.connect(f.paths.agentSocket,f.secrets.readSecret('f1'));f.addCleanup(()=>observer.close());
 await observer.request('processes',{}); // Capture intact ancestry before the root exits.
 await writeFile(release,'exit');assert.deepEqual(await child.exited,{code:0,signal:null});
 assert.equal(await f.host.identity(child.pid),null);assert.ok(await f.host.identity(pid));
 assert.equal(await processHost(f.host).stop(owned),true);assert.equal(await f.host.identity(pid),null);
});

test('unknown accepted spawn fences rollback mutations until its exact outcome reconciles',{timeout:15000},async t=>{
 const f=await sshHostFixture(t),marker=join(f.fake.home,'live-writer'),hold=f.holdSettlementReplies();
 f.addCleanup(async()=>{hold.release();});f.dropNextCommitReply();
 const launch=f.host.spawn({command:process.execPath,args:['-e',`require('fs').writeFileSync(process.argv[1],'owned');setInterval(()=>{},1000)`,marker],cwd:f.fake.home,env:{}});
 await eventually('lost accepted reply enters reconciliation',()=>hold.attempts()||undefined,5000);
 await eventually('accepted writer durable marker',async()=>{try{return await readFile(marker,'utf8')==='owned'||undefined;}catch{return undefined;}},5000);
 await assert.rejects(f.host.removePath(marker),error=>(error as NodeJS.ErrnoException).code==='CLAND_HOST_OUTCOME_UNKNOWN');assert.equal(await readFile(marker,'utf8'),'owned');
 hold.release();const child=await launch,owner=await f.host.identity(child.pid);assert.ok(owner?.pidIdentity);
 assert.equal(await f.host.stop(owner),true);assert.deepEqual(await child.exited,{code:null,signal:'SIGTERM'});
});

test('Host.run stream loss remains fenced until native cancellation has a durable completion',{timeout:15000},async t=>{
 const f=await sshHostFixture(t),hold=f.holdRunCancellation(),marker=join(f.fake.home,'command-writer');
 f.addCleanup(async()=>{hold.release();});
 const running=f.host.run({command:process.execPath,args:['-e',`require('fs').writeFileSync(process.argv[1],String(process.pid));setInterval(()=>{},1000)`,marker],cwd:f.fake.home,env:{}});
 const pid=await eventually('command writer durable readiness',async()=>{try{return Number(await readFile(marker,'utf8'))||undefined;}catch{return undefined;}},5000);
 hold.disconnect();await eventually('native cancellation boundary held',()=>hold.entered()||undefined,5000);
 await assert.rejects(f.host.removePath(marker),/outcome unknown/);assert.ok(await f.host.identity(pid));
 hold.release();const result=await running;assert.match(result.error!,/cancelled/);assert.equal(await f.host.identity(pid),null);
 const receipt=JSON.parse(await readFile(join(f.fake.run,'prepared-results',hold.token()+'.json'),'utf8'));assert.equal(receipt.outcome.state,'accepted');assert.match(receipt.outcome.result.error,/cancelled/);
});

test('Host.run shutdown reports incomplete while its disconnected native writer is still held',{timeout:15000},async t=>{
 const f=await sshHostFixture(t),hold=f.holdRunCancellation(),marker=join(f.fake.home,'shutdown-writer');
 const host=sshHost({name:'f1',transport:f.transport,layout:f.layout,connect:()=>AgentClient.connect(f.paths.agentSocket,f.secrets.readSecret('f1'))});
 f.addCleanup(async()=>{hold.release();await host.close().catch(error=>{if((error as NodeJS.ErrnoException).code!=='CLAND_HOST_OUTCOME_UNKNOWN')throw error;});});
 const result=host.run({command:process.execPath,args:['-e',`require('fs').writeFileSync(process.argv[1],String(process.pid));setInterval(()=>{},1000)`,marker],cwd:f.fake.home,env:{}}).then(value=>({value}),error=>({error}));
 const pid=await eventually('shutdown writer durable readiness',async()=>{try{return Number(await readFile(marker,'utf8'))||undefined;}catch{return undefined;}},5000);
 hold.disconnect();await eventually('shutdown cancellation held',()=>hold.entered()||undefined,5000);
 await assert.rejects(host.removePath(marker),/outcome unknown/);assert.ok(await f.host.identity(pid));
 await assert.rejects(host.close(),error=>(error as NodeJS.ErrnoException).code==='CLAND_HOST_OUTCOME_UNKNOWN');assert.ok('error' in await result);
 hold.release();await eventually('disconnected command durable cleanup receipt',async()=>{try{const receipt=JSON.parse(await readFile(join(f.fake.run,'prepared-results',hold.token()+'.json'),'utf8'));return receipt.outcome.state==='accepted'||undefined;}catch{return undefined;}},5000);
 assert.equal(await f.host.identity(pid),null);
});

test('invalid command admission leaves no native work or permanent Host fence',{timeout:15000},async t=>{
 const f=await sshHostFixture(t);
 await assert.rejects(f.host.run({command:'',args:[],cwd:f.fake.home,env:{}}),/command must be a nonempty string/);
 const result=await f.host.run({command:process.execPath,args:['-e',"process.stdout.write('still-available')"],cwd:f.fake.home,env:{}});
 assert.equal(result.code,0);assert.equal(result.stdout,'still-available');
});

for(const dropped of [false,true]) test(`Host.run settles oversized escaped output with native exit facts${dropped?' after reply loss':''}`,{timeout:15000},async t=>{
 const f=await sshHostFixture(t);if(dropped)f.dropNextRunReply();
 let completed:Awaited<ReturnType<typeof f.host.run>>|undefined,failure:unknown;
 const running=f.host.run({command:process.execPath,args:['-e',`process.stdout.write(('"\\\\\\n').repeat(400000)+'stdout-end');process.stderr.write('stderr-end');process.exitCode=17;`],cwd:f.fake.home,env:{}}).then(result=>{completed=result;},error=>{failure=error;});
 f.addCleanup(async()=>{f.host.quiesce();await running;});
 await eventually('bounded command terminal result from the agent',()=>{if(failure)throw failure;return completed;},5000);
 assert.equal(completed!.code,17);assert.match(completed!.error??'',/output exceeds agent frame cap/);
 assert.ok(completed!.stdout.endsWith('stdout-end'));assert.ok(completed!.stderr.endsWith('stderr-end'));
 const follow=await f.host.run({command:process.execPath,args:['-e',"process.stdout.write('unfenced')"],cwd:f.fake.home,env:{}});
 assert.deepEqual(follow,{code:0,stdout:'unfenced',stderr:''});
});

for (const operation of ['publishFile', 'appendFile'] as const) test(`Host ${operation} settles lost accepted reply without duplicate bytes`, {timeout: 4000}, async t => {
  const f = await sshHostFixture(t), path = join(f.fake.home, 'file-effect');
  const hold = f.holdSettlementReplies(); f.addCleanup(async () => hold.release());
  f.dropNextCommitReply();
  let completed = false;
  const writing = f.host[operation](path, Buffer.from('once')).then(result => { completed = true; return result; });
  await eventually('accepted file reply lost and reconciliation requested', () => hold.attempts() || undefined, 2000);
  assert.equal(completed, false);
  await assert.rejects(f.host.removePath(path), /outcome unknown/);
  assert.equal(await readFile(path, 'utf8'), 'once');
  hold.release();
  assert.equal(await writing, operation === 'publishFile' ? true : undefined);
  assert.equal(await readFile(path, 'utf8'), 'once');
  await f.host.removePath(path);
});

import { fileOperations } from '../src/host/agent/files.ts';
for (const operation of ['publishFile', 'appendFile'] as const) test(`Host ${operation} retains a held native writer across stream loss`, {timeout: 4000}, async t => {
  const f = await sshHostFixture(t), path = join(f.fake.home, 'held-file-effect');
  const native = fileOperations[operation];
  let release!: () => void, entered = false;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const request = AgentClient.prototype.request;
  let commit: AgentClient | undefined, completed = false;
  t.mock.method(AgentClient.prototype, 'request', function(this: AgentClient, op: string, args: Record<string, unknown>, timeout?: number) {
    if (op === 'commit-prepared') commit = this;
    return request.call(this, op, args, timeout);
  });
  t.mock.method(fileOperations, operation, async (...args: Parameters<typeof native>) => {
    if (args[0] === path) { entered = true; await gate; }
    return (native as (...args: Parameters<typeof native>) => Promise<unknown>)(...args);
  });
  f.addCleanup(async () => { release(); await writing; });
  const writing = f.host[operation](path, Buffer.from('once')).then(result => { completed = true; return result; });
  await eventually('native file writer entered', () => entered || undefined, 1500);
  assert.ok(commit); await commit.close();
  await eventually('held file owner enters SSH unknown fence', async () => {
    try { await f.host.removePath(join(f.fake.home, 'unrelated')); return undefined; }
    catch (error) { return /outcome unknown/.test(String(error)) || undefined; }
  }, 2000);
  assert.equal(completed, false);
  const stranger = await AgentClient.connect(f.paths.agentSocket, f.secrets.readSecret('f1'));
  try { await assert.rejects(stranger.request('removePath', {path}), /ownership incomplete/); }
  finally { await stranger.close(); }
  release();
  assert.equal(await writing, operation === 'publishFile' ? true : undefined);
  assert.equal(await readFile(path, 'utf8'), 'once');
  await f.host.removePath(path);
});

test('SSH LaunchFiles refuses an older agent without stat before any file mutation', {timeout:4000}, async t => {
 const f=await sshHostFixture(t),path=join(f.fake.home,'existing-launch-file');
 await writeFile(path,'original',{mode:0o640});
 const nativeRequest=AgentClient.prototype.request;
 const requests:string[]=[];
 // Replay the old agent's unknown-operation reply on the actual authenticated wire.
 t.mock.method(AgentClient.prototype,'request',function(this:AgentClient,op:string,args:Record<string,unknown>,timeout?:number){
   requests.push(op);
   return nativeRequest.call(this,op==='stat'?'legacy-agent-without-stat':op,args,timeout);
 });
 const {LaunchFiles}=await import('../src/adapters/launch-files.ts');
 const files=new LaunchFiles(undefined,f.host);
 await assert.rejects(files.write(path,Buffer.from('replacement'),0o600),/host f1: tunnel agent stat: unknown operation/);
 assert.deepEqual(requests.filter(op=>!['hello','native-receipts'].includes(op)),['stat']);
 assert.deepEqual(await files.snapshot(),{undo:[],children:[]});
 assert.equal(await readFile(path,'utf8'),'original');
 assert.equal((await (await import('node:fs/promises')).stat(path)).mode&0o777,0o640);
});
