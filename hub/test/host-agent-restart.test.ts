// T3: supervised native agent death/version replacement and detached harness survival across SSH.
// Lifecycle: isolated fake host HOME/Git, joined Host/carrier/supervisor, final process census before root removal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { mkdir, readFile, writeFile, readdir, unlink, rmdir, realpath } from 'node:fs/promises';
import { sshHostFixture } from './ssh-host-fixture.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { ownProcess } from './process-cleanup.ts';
import { randomUUID } from 'node:crypto';
import { eventually, fakeClaude } from './harness.ts';
import { testWaitMs } from './until.ts';
import { AgentClient, restoreAdoptedWorkers } from '../src/host/agent-client.ts';
import { sshHost } from '../src/host/ssh-host.ts';
import { deliverRuntime, runtimeBundle, agentBundle, deliverAgent, retainAgentVersions, INSTALL_AGENT, agentVersionHandoff } from '../src/host/code-delivery.ts';
import { verifyAgentPackage } from '../src/host/agent/package.ts';
import { hostControl } from './fakes/fake-host.ts';
const supervisor=new URL('../src/host/agent/supervisor.sh',import.meta.url).pathname;
const cli=new URL('../bin/cland.ts',import.meta.url).pathname;
// C1 measures kill-to-reconciled table; version delivery instead joins several
// native installations, replay controls and upgrades, each with setup receipts.
const KILL_TO_RECONCILED_TABLE_MS=5000;
const VERSION_DELIVERY_TIMEOUT_MS=testWaitMs(90_000);
// T-1730 migration: whole-runtime handoffs need installed production dependencies.
// The native installer boundary is offline; no registry/network is exercised.
async function offlineRuntime(f:Awaited<ReturnType<typeof sshHostFixture>>) {
 const bin=join(f.root,'offline-bin');await mkdir(bin);
 await writeFile(join(bin,'npm'),`#!/bin/sh\nln -s '${new URL('../../node_modules',import.meta.url).pathname}' node_modules\n`,{mode:0o700});
 const execute=f.transport.execute.bind(f.transport);
 f.transport.execute=script=>execute(`export PATH='${bin}':"$PATH"\n`+script);
}

for(const mismatch of [false,true])test(`C1-C3 ${mismatch?'version delivery':'kill-agent'} reconnect reads retained table without signalling harness`,{timeout:mismatch?VERSION_DELIVERY_TIMEOUT_MS:20000},async t=>{
 const f=await sshHostFixture(t);await f.host.close();
 f.env.CLAND_SCP_BIN=new URL('./fakes/fake-scp.ts',import.meta.url).pathname;
 const env=fixtureEnvironment(f.root,process.env,{...f.env,CLAND_HOST_RUN_DIR:f.fake.run,CLAND_HOST_SECRET:f.secrets.readSecret('f1'),CLAND_VERSION_OVERRIDE:'old'});
 const codeRoot=join(f.fake.home,'.cland-host/code');
 if(mismatch){await offlineRuntime(f);await deliverAgent({transport:f.transport,node:process.execPath,codeRoot,version:'old'});await unlink(join(codeRoot,'restart'));}
 await f.agent.close();
 const initial=mismatch?[join(codeRoot,'old/hub/src/host/agent/supervisor.sh'),f.fake.run,process.execPath,join(codeRoot,'old/hub/src/host/agent/entry.ts')]:[supervisor,f.fake.run,process.execPath,cli,'host','serve'];
 const child=spawn('sh',initial,{cwd:f.fake.home,env:fixtureEnvironment(f.root,process.env,env),stdio:['ignore','ignore','pipe']});
 let tail='';child.stderr?.on('data',bytes=>{tail=(tail+bytes.toString()).slice(-2000);});t.after(()=>{if(tail)t.diagnostic(tail);});
 const clean=ownProcess(undefined,child.pid);f.addCleanup(clean);
 let direct=await eventually('supervised agent readiness',()=>AgentClient.connect(f.paths.agentSocket,f.secrets.readSecret('f1')).catch(()=>undefined));
 f.addCleanup(()=>direct.close());
 const signalReceipt=join(f.fake.home,'signals'),ready=join(f.fake.home,'harness-ready');
 const command={command:process.execPath,args:['-e',`const fs=require('fs');for(const s of ['SIGTERM','SIGINT','SIGHUP','SIGUSR1','SIGUSR2'])process.on(s,()=>fs.appendFileSync(process.argv[1],s+'\\n'));fs.writeFileSync(process.argv[2],'ready');setInterval(()=>{},1000)`,signalReceipt,ready],cwd:f.fake.home,env:fixtureEnvironment(f.root,process.env,f.env)};
 const worker=await direct.request('spawn',command) as {pid:number;identity:string};
 await eventually('harness running receipt',()=>readFile(ready,'utf8').catch(()=>undefined));
 const originalAgent=direct.hello.pid;
 if(mismatch)await writeFile(join(f.fake.run,'agent.pid'),JSON.stringify(worker)); // inherited worker metadata grants no restart authority
 let tables:Array<{pid:number;identity:string;alive:boolean}[]>=[], deliveries=0;
 const sourceRoot=join(f.root,'source');
 const sourceBundle=await agentBundle('new');
 for(const file of sourceBundle.files){await mkdir(dirname(join(sourceRoot,file.path)),{recursive:true});await writeFile(join(sourceRoot,file.path),Buffer.from(file.bytes,'base64'));}
 const planted='synthetic-secret-value-1605';
 await writeFile(join(sourceRoot,'.env'),planted);await writeFile(join(sourceRoot,'hub/src/host/agent/account.json'),planted);
 assert.equal(await readFile(join(sourceRoot,'.env'),'utf8'),planted,'planted source-tree positive control');
 await writeFile(join(sourceRoot,'hub/src/host/agent/closure.json'),await readFile(new URL('../src/host/agent/closure.json',import.meta.url)));
 const closureBundle=await agentBundle('new',sourceRoot);
 // T-1730 migration: handoff sources use the whole runtime; closure secret-exclusion control stays legacy.
 const bundle=mismatch?await runtimeBundle('new'):closureBundle;
 assert.ok(bundle.files.length>10);assert.ok(bundle.files.some(file=>file.path.endsWith('/bootstrap.ts')));
 for(const file of closureBundle.files)assert.ok(!Buffer.from(file.bytes,'base64').includes(Buffer.from(planted)));
 let injected=false,lostInstallReply=false,lostPublicationReply=false;
 const transport={copyFile:async(source:string,destination:string)=>{deliveries++;await f.transport.copyFile(source,destination);},execute:async(script:string)=>{
  if(!injected&&script.includes('restart.new')){injected=true;throw new Error('injected publication interruption after install');}
  await f.transport.execute(script);
  // T-1730 migration: drop the actual successful runtime installer reply, never a reuse probe.
  if(script.includes('runtime manifest hash')&&script.includes('.runtime-input-')&&!lostInstallReply){
   assert.equal(JSON.parse(await readFile(join(codeRoot,'new/runtime-manifest.json'),'utf8')).version,'new');
   lostInstallReply=true;throw new Error('injected lost accepted install reply');
  }
  if(!lostPublicationReply&&script.includes('restart.new')){
   await eventually('accepted replacement durable readiness before lost publication reply',async()=>{try{return JSON.parse(await readFile(join(codeRoot,'applied.json'),'utf8')).version==='new'||undefined;}catch{return undefined;}},testWaitMs());
   lostPublicationReply=true;throw new Error('injected lost accepted restart-publication reply');
  }
 }};
 const handoff=agentVersionHandoff({transport,node:process.execPath,codeRoot,version:'new',bundle});
 const host=sshHost({name:'f1',transport:f.transport,layout:f.layout,expectedVersion:mismatch?'new':'old',updateAgent:handoff.update,agentReady:handoff.ready,connect:()=>AgentClient.connect(f.paths.agentSocket,f.secrets.readSecret('f1')),onTable:rows=>{tables.push(rows as typeof tables[number]);}});
 f.addCleanup(()=>host.close());
 if(!mismatch) {
  await eventually('initial table receipt',()=>tables.length||undefined);
  tables=[];
  const start=performance.now();await hostControl('kill-agent','f1',env);
  await eventually('replacement table receipt within five seconds',()=>tables.find(rows=>rows.some(row=>row.pid===worker.pid&&row.identity===worker.identity&&row.alive)),KILL_TO_RECONCILED_TABLE_MS);
  assert.ok(performance.now()-start<KILL_TO_RECONCILED_TABLE_MS); // lint-allow-wall-clock: C1 measures kill-to-reconciled running table, not hello.
 } else {
  await eventually('new version retained table',()=>tables.find(rows=>rows.some(row=>row.pid===worker.pid&&row.identity===worker.identity&&row.alive)),testWaitMs());
  assert.equal(deliveries,1); // T-1730 migration: digest reuse avoids repeated whole-runtime upload.
  assert.equal(lostInstallReply,true);assert.equal(injected,true);assert.equal(lostPublicationReply,true);
  await verifyAgentPackage(join(codeRoot,'new'),'new');
  // T-1730 migration: handoff persists runtime-manifest rather than agent-manifest.
  const installedManifest=await readFile(join(codeRoot,'new/runtime-manifest.json'),'utf8');assert.ok(!installedManifest.includes(planted));
  assert.ok((await readdir(join(codeRoot,'new'))).includes('node_modules'),'T-1730 migration: whole runtime installs dependencies');
  await retainAgentVersions({transport:f.transport,node:process.execPath,codeRoot,version:'new',previous:'old'});
 }
 await direct.close();direct=await AgentClient.connect(f.paths.agentSocket,f.secrets.readSecret('f1'));
 assert.notEqual(direct.hello.pid,originalAgent);assert.equal(direct.hello.version,mismatch?'new':'old');
 if(mismatch){
   const applied=JSON.parse(await readFile(join(codeRoot,'applied.json'),'utf8'));
   assert.equal(applied.pid,direct.hello.pid);
   await agentVersionHandoff({transport:f.transport,node:process.execPath,codeRoot,version:'new',bundle}).update('old',new AbortController().signal); // T-1730 migration: replay the whole-runtime selection
   const replay=await eventually('duplicate selection durable no-replay receipt',async()=>{try{const result=JSON.parse(await readFile(join(codeRoot,'restart-result.json'),'utf8'));return result.version==='new'&&result.outcome==='already-selected'?result:undefined;}catch{return undefined;}},testWaitMs());
   assert.equal(replay.pid,applied.pid);assert.equal(replay.identity,applied.identity);
   assert.equal((await direct.request('hello',{protocol:1,secret:f.secrets.readSecret('f1')}) as {pid:number}).pid,applied.pid);
   const output=join(f.fake.home,'delivered-spawn');
   const launched=await direct.request('spawn',{command:process.execPath,args:['-e',"require('fs').writeFileSync(process.argv[1],'done')",output],cwd:f.fake.home,env:fixtureEnvironment(f.root,process.env,f.env)}) as {pid:number;identity:string};
   await eventually('delivered bootstrap durable completion',async()=>{
     const receipts=await direct.request('native-receipts',{}) as Array<{pid:number;identity:string;code:number}>;
     return receipts.find(row=>row.pid===launched.pid&&row.identity===launched.identity&&row.code===0);
   });
   assert.equal(await readFile(output,'utf8'),'done');
 }
 if(mismatch){
  await host.close();
  let previous='new';
  for(const version of ['third','fourth']){
   await direct.close();
   await agentVersionHandoff({transport:f.transport,node:process.execPath,codeRoot,version}).update(previous,new AbortController().signal); // T-1730 migration: consecutive runtime versions
   direct=await eventually('consecutive upgrade hello '+version,async()=>{const next=await AgentClient.connect(f.paths.agentSocket,f.secrets.readSecret('f1')).catch(()=>undefined);if(next&&next.hello.version!==version){await next.close();return undefined;}return next;},testWaitMs());
   const rows=await direct.request('processes',{}) as Array<{pid:number;identity:string;alive:boolean}>;
   assert.ok(rows.some(row=>row.pid===worker.pid&&row.identity===worker.identity&&row.alive));
   await retainAgentVersions({transport:f.transport,node:process.execPath,codeRoot,version,previous});
   assert.ok(!(await readdir(codeRoot)).includes('old'),'original supervisor version was pruned');
   previous=version;
  }
 }
 assert.equal(await direct.request('alive',worker),true);
 assert.equal(await readFile(signalReceipt,'utf8').catch(()=>''),'');
 assert.ok(tables.some(rows=>rows.some(row=>row.pid===worker.pid&&row.identity===worker.identity&&row.alive)));
});

test('C4 corrupt and escaping bundles never become selectable',{timeout:10000},async t=>{
 const f=await sshHostFixture(t);f.env.CLAND_SCP_BIN=new URL('./fakes/fake-scp.ts',import.meta.url).pathname;
 const codeRoot=join(f.fake.home,'.cland-host/code');
 const good=await agentBundle('invalid');
 for(const file of [{...good.files[0]!,path:'../../escaped'},{...good.files[0]!,sha256:'0'.repeat(64)}]) {
  await assert.rejects(deliverAgent({transport:f.transport,node:process.execPath,codeRoot,version:'invalid',bundle:{version:'invalid',files:[file]}}),/execute failed/);
 }
 assert.ok(!(await readdir(codeRoot)).includes('invalid'));
 await assert.rejects(readFile(join(codeRoot,'restart')),{code:'ENOENT'});
 await assert.rejects(readFile(join(f.fake.home,'escaped')),{code:'ENOENT'});
 assert.ok(INSTALL_AGENT.includes('sha256'));
});

test('Host close joins installation and fences a late restart publication',{timeout:10000},async t=>{
 const f=await sshHostFixture(t);await f.host.close();
 f.env.CLAND_SCP_BIN=new URL('./fakes/fake-scp.ts',import.meta.url).pathname;
 const codeRoot=join(f.fake.home,'.cland-host/code');
 let installed=false,calls=0,release!:()=>void;
 const gate=new Promise<void>(resolve=>{release=resolve;});
 const transport={copyFile:f.transport.copyFile.bind(f.transport),execute:async(script:string)=>{
  await f.transport.execute(script);
  if(++calls===2){installed=true;await gate;}
 }};
 const host=sshHost({name:'f1',transport:f.transport,layout:f.layout,expectedVersion:'shutdown',connect:()=>AgentClient.connect(f.paths.agentSocket,f.secrets.readSecret('f1')),updateAgent:async(_,signal)=>deliverAgent({transport,node:process.execPath,codeRoot,version:'shutdown',signal})});
 f.addCleanup(async()=>{release();await host.close();});
 await eventually('installed package boundary held before restart',()=>installed||undefined,5000);
 const closing=host.close();release();await closing;
 await verifyAgentPackage(join(codeRoot,'shutdown'),'shutdown');
 await assert.rejects(readFile(join(codeRoot,'restart')),{code:'ENOENT'});
 await assert.rejects(host.identity(process.pid),/closed/);
});

for(const action of ['close','quiesce'] as const)test(`held mismatched acquisition after ${action} closes its client without delivery`,{timeout:10000},async t=>{
 const f=await sshHostFixture(t);await f.host.close();
 let entered=false,closed=false,updates=0,release!:()=>void;
 const gate=new Promise<void>(resolve=>{release=resolve;});
 const host=sshHost({name:'f1',transport:f.transport,layout:f.layout,expectedVersion:'replacement',updateAgent:async()=>{updates++;},connect:async()=>{
  const client=await AgentClient.connect(f.paths.agentSocket,f.secrets.readSecret('f1'));
  client.once('closed',()=>{closed=true;});entered=true;await gate;return client;
 }});
 f.addCleanup(async()=>{release();await host.close();});
 await eventually('mismatch acquisition held after authenticated hello',()=>entered||undefined,5000);
 const stopping=action==='close'?host.close():Promise.resolve(host.quiesce());
 release();await stopping;
 await eventually('late acquisition socket native close',()=>closed||undefined,3000);
 assert.equal(updates,0);
});


test('registry loads in scratch runtime with development packages unavailable',{timeout:10000},async t=>{
 const f=await sshHostFixture(t);
 const receipt=join(f.fake.home,'startup-complete');
 const target=new URL('../src/host/registry.ts',import.meta.url).href;
 const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
 const deny=Object.keys(pkg.devDependencies).filter(key=>!Object.hasOwn(pkg.dependencies,key));
 const script=`import {registerHooks} from 'node:module';import {writeFile} from 'node:fs/promises';const deny=new Set(JSON.parse(process.argv[1]));registerHooks({resolve(spec,context,next){const name=spec.startsWith('@')?spec.split('/').slice(0,2).join('/'):spec.split('/')[0];if(deny.has(name))throw new Error('development package unavailable: '+name);return next(spec,context);}});let blocked=false;try{await import('typescript');}catch(error){blocked=String(error).includes('development package unavailable');}if(!blocked)throw new Error('missing development-package denial control');await import(process.argv[2]);await writeFile(process.argv[3],'loaded');`;
 const child=spawn(process.execPath,['--input-type=module','-e',script,JSON.stringify(deny),target,receipt],{cwd:f.fake.home,env:fixtureEnvironment(f.root,process.env),stdio:['ignore','ignore','pipe']});
 let exit:{code:number|null;signal:string|null}|undefined,tail='';
 child.stderr.on('data',bytes=>{tail=(tail+bytes.toString()).slice(-2000);});
 child.once('close',(code,signal)=>{exit={code,signal};});
 f.addCleanup(ownProcess(undefined,child.pid));
 await eventually('compiler-free registry import native completion',()=>exit,5000);
 assert.deepEqual(exit,{code:0,signal:null},tail);
 assert.equal(await readFile(receipt,'utf8'),'loaded');
});


test('C3 adopted Claude worker survives version replacement with receipt authority and no signal',{timeout:20000},async t=>{
 const f=await sshHostFixture(t),fake=await fakeClaude(t,{awaitSignals:true,ignoreTerm:true});
 await offlineRuntime(f); // T-1730 migration: adopted-worker handoff now installs whole runtime
 f.env.CLAND_SCP_BIN=new URL('./fakes/fake-scp.ts',import.meta.url).pathname;
 const generation=randomUUID(),settings=join(f.fake.run,'sessions','a'.repeat(64),generation,'settings.json');
 await mkdir(dirname(settings),{recursive:true,mode:0o700});
 await writeFile(settings,JSON.stringify({env:fake.env,hooks:{SessionStart:[],SessionEnd:[]}}),{mode:0o600});
 const workerEnv=fixtureEnvironment(f.root,process.env,{...fake.env,CLAUDE_CONFIG_DIR:fake.home});
 const result=await f.host.launchClaude!({command:new URL('./fakes/claude-code/claude',import.meta.url).pathname,args:['--bg','--name','restart-worker','--settings',settings],cwd:f.fake.home,env:workerEnv},generation);
 assert.equal(result.code,0,result.error??result.stderr);
 const adopted=await f.host.adopt!(generation);
 assert.ok(adopted.process.pidIdentity);assert.equal(adopted.closed,undefined);
 await eventually('adopted Claude native ready before replacement',async()=>(await fake.log(adopted.job)).includes('session ready')||undefined,3000);
 const codeRoot=join(f.fake.home,'.cland-host/code');
 await deliverAgent({transport:f.transport,node:process.execPath,codeRoot,version:'old'});await unlink(join(codeRoot,'restart'));
 await f.host.close();await f.agent.close();
 const env=fixtureEnvironment(f.root,process.env,{...f.env,CLAND_HOST_RUN_DIR:f.fake.run,CLAND_HOST_SECRET:f.secrets.readSecret('f1')});
 const supervisor=spawn('sh',[join(codeRoot,'old/hub/src/host/agent/supervisor.sh'),f.fake.run,process.execPath,join(codeRoot,'old/hub/src/host/agent/entry.ts')],{cwd:f.fake.home,env,stdio:'ignore'});
 f.addCleanup(ownProcess(undefined,supervisor.pid));
 type Row={pid:number;identity:string;alive:boolean;authority:string;adopted?:boolean};
 let oldRows:Row[]|undefined,newRows:Row[]|undefined;
 const connect=()=>AgentClient.connect(f.paths.agentSocket,f.secrets.readSecret('f1'));
 const old=sshHost({name:'f1',transport:f.transport,layout:f.layout,restoreAdoptedWorkers,connect,onTable:rows=>{oldRows=rows as Row[];}});f.addCleanup(()=>old.close());
 await eventually('old supervised agent freshly restores generation before version update',()=>oldRows?.find(row=>row.pid===adopted.process.pid&&row.identity===adopted.process.pidIdentity&&row.alive&&row.adopted&&row.authority==='owned'),5000);
 await old.close();
 const handoff=agentVersionHandoff({transport:f.transport,node:process.execPath,codeRoot,version:'new'});
 const replacement=sshHost({name:'f1',transport:f.transport,layout:f.layout,expectedVersion:'new',restoreAdoptedWorkers,connect,updateAgent:handoff.update,agentReady:handoff.ready,onTable:rows=>{newRows=rows as Row[];}});f.addCleanup(()=>replacement.close());
 await eventually('new agent table contains receipt-restored running Claude worker',()=>newRows?.find(row=>row.pid===adopted.process.pid&&row.identity===adopted.process.pidIdentity&&row.alive&&row.adopted&&row.authority==='owned'),7000);
 const client=await connect();f.addCleanup(()=>client.close());
 assert.equal(client.hello.version,'new');
 assert.equal(await client.request('alive',{pid:adopted.process.pid,identity:adopted.process.pidIdentity}),true);
 assert.doesNotMatch(await fake.log(adopted.job),/ignored SIGTERM/);
 const durable=JSON.parse(await readFile(join(f.fake.run,'processes.json'),'utf8')) as Row[];
 assert.ok(durable.some(row=>row.pid===adopted.process.pid&&row.identity===adopted.process.pidIdentity&&row.adopted&&row.authority==='owned'));
});

for(const withOrphan of [false,true])test(`Claude exit during agent downtime keeps ${withOrphan?'unresolved':'closed'} generation isolated from healthy recovery`,{timeout:20000},async t=>{
 const {serveAgent}=await import('../src/host/agent/server.ts');
 const {observeProcesses}=await import('../src/host/agent/native.ts');
 const f=await sshHostFixture(t),fake=await fakeClaude(t,{awaitSignals:false});
 const marker=join(f.fake.home,'orphan-hook-ready'),script=join(f.fake.home,'orphan-hook.cjs');
 await writeFile(script,"const fs=require('fs');process.on('SIGTERM',()=>{});fs.writeFileSync(process.argv[2],String(process.pid));setInterval(()=>{},1000);");
 const quote=(value:string)=>"'"+value.replaceAll("'","'\\''")+"'";
 const workers=[];
 for(const name of ['exiting','healthy']){
  const generation=randomUUID(),settings=join(f.fake.run,'sessions','a'.repeat(64),generation,'settings.json');
  await mkdir(dirname(settings),{recursive:true,mode:0o700});
  const hooks=withOrphan&&name==='exiting'?[{hooks:[{type:'command',async:true,command:[process.execPath,script,marker].map(quote).join(' ')}]}]:[];
  await writeFile(settings,JSON.stringify({env:fake.env,hooks:{SessionStart:[],SessionEnd:hooks}}),{mode:0o600});
  const env=fixtureEnvironment(f.root,process.env,{...fake.env,CLAUDE_CONFIG_DIR:fake.home});
  const result=await f.host.launchClaude!({command:new URL('./fakes/claude-code/claude',import.meta.url).pathname,args:['--bg','--name',name,'--settings',settings],cwd:f.fake.home,env},generation);
  assert.equal(result.code,0,result.error??result.stderr);
  const worker=await f.host.adopt!(generation);workers.push({generation,settings,...worker});
  await eventually(name+' worker native ready',async()=>(await fake.log(worker.job)).includes('session ready')||undefined,3000);
 }
 const [exiting,healthy]=workers;assert.ok(exiting&&healthy);
 await f.host.close();await f.agent.close();
 const hookReady=withOrphan?eventually('downtime SessionEnd writer durable PID',async()=>{try{return Number(await readFile(marker,'utf8'))||undefined;}catch{return undefined;}},3000):undefined;
 const rootExited=eventually('downtime root native exit before any new agent',async()=>(await observeProcesses([exiting.process.pid!],f.env)).get(exiting.process.pid!)?.ended||undefined,3000);
 assert.equal((await observeProcesses([exiting.process.pid!],f.env)).get(exiting.process.pid!)?.identity,exiting.process.pidIdentity);
 process.kill(exiting.process.pid!,'SIGTERM');
 const hookPid=await hookReady;if(hookPid)f.addCleanup(ownProcess(undefined,hookPid));
 await rootExited;
 const before=JSON.parse(await readFile(join(f.fake.run,'processes.json'),'utf8')) as Array<{pid:number;ended?:boolean}>;
 assert.notEqual(before.find(row=>row.pid===exiting.process.pid)?.ended,true,'no old-agent confirmedClosed checkpoint exists');
 const signals:number[]=[];
 const agent=await serveAgent({runDir:f.fake.run,secret:f.secrets.readSecret('f1'),version:'recovered',env:f.env,memoryIntervalMs:600000,processHooks:{beforeSignals:async targets=>{signals.push(...targets.map(target=>target.pid));}}});f.addCleanup(()=>agent.close());
 let table:unknown[]|undefined,report:import('../src/host/agent/claude.ts').ClaudeRestoreOutcome|null|undefined;
 const recovered=sshHost({name:'f1',transport:f.transport,layout:f.layout,restoreAdoptedWorkers:client=>restoreAdoptedWorkers(client,value=>{report=value;}),connect:()=>AgentClient.connect(f.paths.agentSocket,f.secrets.readSecret('f1')),onTable:rows=>{table=rows;}});f.addCleanup(()=>recovered.close());
 await eventually('healthy worker recovery table despite vanished unrelated root',()=>table?.find(value=>{const row=value as {pid:number;identity:string;alive:boolean;authority:string};return row.pid===healthy.process.pid&&row.identity===healthy.process.pidIdentity&&row.alive&&row.authority==='owned';}),5000);
 const client=await AgentClient.connect(f.paths.agentSocket,f.secrets.readSecret('f1'));f.addCleanup(()=>client.close());
 if(withOrphan){
  await assert.rejects(client.request('remove-claude',{generation:exiting.generation}),/cleanup ownership incomplete/);
  assert.ok(report?.incomplete.some(entry=>entry.generation===exiting.generation&&entry.stage==='receipt'),'unresolved generation is explicitly reported');
  assert.ok((await observeProcesses([hookPid!],f.env)).get(hookPid!)?.identity,'unowned hook remains alive');
  assert.equal(JSON.parse(await readFile(join(f.fake.run,'claude',exiting.generation+'.json'),'utf8')).released,undefined);
  assert.ok(await readFile(exiting.settings,'utf8'));
 }else{
  assert.ok(report&&!report.incomplete.some(entry=>entry.generation===exiting.generation));
  const settled=await recovered.adopt!(exiting.generation);assert.equal(settled.closed,true);
  const {release,forget}=settled;assert.ok(release&&forget);
  await release();
  assert.equal(JSON.parse(await readFile(join(f.fake.run,'claude',exiting.generation+'.json'),'utf8')).released,true);
  await unlink(exiting.settings);await rmdir(dirname(exiting.settings));await forget();
  await assert.rejects(readFile(join(f.fake.run,'claude',exiting.generation+'.json')),{code:'ENOENT'});
 }
 assert.equal(await client.request('restore-claude',{}),null,'legacy request keeps its null wire result');
 const proof=join(f.fake.home,'healthy-mutation');await recovered.writeFile(proof,Buffer.from('available'));
 assert.equal(await readFile(proof,'utf8'),'available');
 assert.deepEqual(signals,[]);
});

// v0.4 is the first host release: V1 deliberately uses this item's ready sources.
test('T-1730 supervisor launches verified generation after version pointer changes',{timeout:testWaitMs(30000)},async t=>{
 const f=await sshHostFixture(t);await f.host.close();await offlineRuntime(f);
 f.env.CLAND_SCP_BIN=new URL('./fakes/fake-scp.ts',import.meta.url).pathname;
 const codeRoot=join(f.fake.home,'.cland-host/code');
 for(const version of ['V1','V2'])await deliverRuntime({transport:f.transport,codeRoot,node:process.execPath,version});
 const verified=await realpath(join(codeRoot,'V2'));
 const unverified=join(codeRoot,'.runtime-V2-unverified'),bad=join(f.root,'unverified-launched'),swapped=join(f.root,'pointer-swapped');
 await mkdir(join(unverified,'hub/src/host/agent'),{recursive:true});
 await writeFile(join(unverified,'hub/src/host/agent/entry.ts'),`import fs from 'node:fs';fs.writeFileSync(${JSON.stringify(bad)},'launched');setInterval(()=>{},1000);`);
 const wrapper=join(f.root,'node-wrapper');
 const swap=`const fs=require('node:fs');const target=${JSON.stringify(join(codeRoot,'V2'))};fs.symlinkSync(${JSON.stringify(unverified)},target+'.next');fs.renameSync(target+'.next',target);fs.writeFileSync(${JSON.stringify(swapped)},'swapped');`;
 const quote=(value:string)=>"'"+value.replaceAll("'","'\\''")+"'";
 await writeFile(wrapper,`#!/bin/sh\ncase "$*" in *signalAgentChild*) '${process.execPath}' -e ${quote(swap)} ;; esac\nexec '${process.execPath}' "$@"\n`,{mode:0o700});
 await f.agent.close();
 const child=spawn('sh',[join(codeRoot,'V1/hub/src/host/agent/supervisor.sh'),f.fake.run,process.execPath,join(codeRoot,'V1/hub/src/host/agent/entry.ts')],{cwd:f.fake.home,env:fixtureEnvironment(f.root,process.env,{...f.env,CLAND_HOST_NODE:wrapper,CLAND_HOST_RUN_DIR:f.fake.run,CLAND_HOST_SECRET:f.secrets.readSecret('f1')}),stdio:'ignore'});
 f.addCleanup(ownProcess(undefined,child.pid));
 const applied=join(codeRoot,'applied.json');
 await eventually('V1 durable readiness before pointer race',async()=>{try{return JSON.parse(await readFile(applied,'utf8')).version==='V1'||undefined;}catch{return undefined;}},testWaitMs());
 await agentVersionHandoff({transport:f.transport,codeRoot,node:process.execPath,version:'V2'}).update('V1',new AbortController().signal);
 const result=await eventually('verified generation readiness or unverified launch receipt',async()=>{
  if(await readFile(bad,'utf8').catch(()=>''))return 'unverified';
  try{if(JSON.parse(await readFile(applied,'utf8')).version==='V2')return 'verified';}catch{}
 },testWaitMs());
 assert.equal(await readFile(swapped,'utf8'),'swapped','positive pointer-swap receipt');
 assert.equal(await realpath(join(codeRoot,'V2')),await realpath(unverified));
 assert.equal(result,'verified','supervisor must launch the generation verified before the signal');
 const client=await AgentClient.connect(f.paths.agentSocket,f.secrets.readSecret('f1'));f.addCleanup(()=>client.close());
 assert.equal(client.hello.version,'V2');
 assert.ok(await readFile(join(verified,'hub/src/host/agent/entry.ts'))); // original verified generation remains readable
 await assert.rejects(readFile(bad),{code:'ENOENT'});
});
