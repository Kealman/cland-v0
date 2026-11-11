// T3: two fake hosts run native fake OpenCode children through prepared agent spawn.
// Lifecycle: join native stop, clients and agents before closing storage and disposing roots.
import './cover-quiet.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, unlink, mkdir, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { FakeHostProvider } from '../src/host/provider/fake.ts';
import { hostDirectory } from '../../shared/fake-host-directory.ts';
import { serveAgent } from '../src/host/agent/server.ts';
import { AgentClient } from '../src/host/agent-client.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { loginFixtureOwners } from './login-fixture-owners.ts';
import { Store } from '../src/hub/store.ts';
import { LoginBinder } from '../src/host/login-binding.ts';
import { writeLoginKey, loginKeyEnvironment } from '../src/host/login-keys.ts';
import { remoteRedactor, redactFrame } from '../src/remote/redact.ts';
import { ownProcess, onCleanup, guardDirectoryRemoval } from './process-cleanup.ts';
import { until, testWaitMs } from './until.ts';
import { FakeClock } from './fake-clock.ts';
import { projectHub, tempProject, connectUi, eventually } from './harness.ts';
import { OpenCodeAdapter } from '../src/adapters/opencode.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { sshHost } from '../src/host/ssh-host.ts';
import { HostSecretStore } from '../src/host/records.ts';
import { readProjectConfig } from '../src/init/config.ts';
import { projectTag } from '../src/executor/droplet/droplet.ts';
import { layout } from '../src/project.ts';
import { remoteDiscovery } from '../src/host/discovery.ts';
import { fakeLockProcesses } from './fakes/lock-processes.ts';
import type { HarnessProcess } from '../src/adapters/contract.ts';

async function composedKeyLaunch(t:test.TestContext,failEarly=false){
 const root=await tempProject(t,'key-composed-'),owners=loginFixtureOwners(t);
 let storeClosed=false,tableClosed=false,joined=false;
 guardDirectoryRemoval(root,()=>{if(!joined)throw Error('composed owners have not joined; root retained');});
 onCleanup(t,async()=>{await owners.disposeAsync();joined=true;});
 const clock=new FakeClock(Date.now()),env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root});
 await mkdir(join(root,'.cland'),{recursive:true});
 await writeFile(join(root,'.cland/config.toml'),'[hosts.agents]\nprovider="fake"\nsize="fake"\nslots=8\nregion="fake-1"\n');
 const project=projectTag(root,readProjectConfig(join(root,'.cland/config.toml'),root)!.name);
 // These values and the encryption key are generated only in this disposable project.
 const values=['SENTINEL-composed-key-1788','SENTINEL-composed-key-1788-rotated'];
 writeLoginKey(root,project,'work',values[0]!);
 const store=new Store(join(root,'.cland/hub.db'));owners.defer(async()=>{await access(root);store.close();storeClosed=true;});
 store.hosts.logins.insert({name:'work',harness:'opencode',account:'work',kind:'key',lastSignIn:null});store.hosts.logins.transition('work','ready');
 const provider=new FakeHostProvider({env,now:()=>clock.now().getTime()});
 const argv:string[][]=[],plans:string[]=[],preparedPlans:string[]=[];
 const nativeCloses=new Map<number,{code:number|null;signal:string|null}>();
 async function machine(){
  const acquired=await provider.acquire({project:root,pool:'agents',region:'fake-1',architecture:'x86_64'});if(acquired.state!=='created')throw Error('fixture acquire');
  const native=acquired.machine,directory=hostDirectory(root,native.id),home=join(directory,'home'),runDir=join(home,'.cland-host/run'),socket=join(home,'session.sock');
  const hostEnv=fixtureEnvironment(root,env,{CLAND_FAKE_HOSTS:native.id,CLAND_HOST_BOOT_ID_FILE:join(directory,'boot-id'),FAKE_OPENCODE_HOME:join(home,'native'),FAKE_OPENCODE_SOCKET:socket,FAKE_OPENCODE_KEY_PROOF:'1'});
  const options={runDir,secret:`fixture-${native.id}`,version:'test',env:hostEnv,processHooks:{beforeBootstrap:async(directory:string)=>{const plan=await readFile(join(directory,'plan.json'),'utf8');plans.push(plan);const parsed=JSON.parse(plan);argv.push([process.execPath,'bootstrap.ts',directory],[parsed.command,...parsed.args]);for(const value of values)assert.equal(plan.includes(value),false);assert.equal(Object.hasOwn(parsed,'env'),false);}}};
  let server=await serveAgent(options);owners.defer(()=>server.close());
  const secrets=new HostSecretStore(root,store.hosts,()=>{});
  secrets.register({id:native.id,address:native.address,user:'fixture',clientKeyPath:'',knownHosts:''});
  store.hosts.provisions.ready({id:native.id,pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:native.created,state:'ready',machine:native});
  const hostLayout={runDirectory:join(home,'run'),logDirectory:join(home,'logs'),discoveryFile:join(home,'discovery.json'),node:process.execPath,cli:resolve('hub/bin/cland.ts'),spoke:resolve('hub/bin/cland-spoke.ts')};
  await writeFile(hostLayout.discoveryFile,JSON.stringify({...remoteDiscovery(runDir,secrets.readSecret(native.id)),socket:layout(root).socket,spoke:`ws+unix:${layout(root).spokeSocket}:/`}));
  const open=()=>sshHost({name:native.id,transport:{status:()=>({name:native.id,state:'up' as const,since:clock.now().toISOString(),lastProbe:null,reconnects:0}),forward:async()=>({socket}),unforward:async()=>{}},layout:hostLayout,connect:()=>AgentClient.connect(server.socket,options.secret)});
  let owner=open();owners.defer(()=>owner.close());
  function host(){return {...owner,spawn:async(command:Parameters<typeof owner.spawn>[0],admission?:Parameters<typeof owner.spawn>[1])=>{
   argv.push([command.command,...command.args]);
   const child=await owner.spawn(command,{...admission,authorize:async()=>{
    admission?.authorize?.();
    const files=await readdir(join(runDir,'prepared'));
    for(const file of files){const plan=await readFile(join(runDir,'prepared',file),'utf8');if(JSON.parse(plan).kind!=='spawn')continue;preparedPlans.push(plan);for(const value of values)assert.equal(plan.includes(value),false);}
   }});
   const stopNative=ownProcess(undefined,child.pid);
   owners.defer(async()=>{await stopNative();await until(()=>nativeCloses.has(child.pid),{what:'fixture native close before shared root disposal'});});
   void child.exited.then(exit=>{nativeCloses.set(child.pid,exit);});
   return child;
  }};}
  return {directory,home,native,host,receipt:async(row:HarnessProcess,value:string)=>{
   const expected=createHash('sha256').update(value).digest('hex');
   await eventually('exact fake OpenCode native key digest',async()=>{try{return JSON.parse(await readFile(join(home,'native/servers',`${row.pid}.json`),'utf8')).keyDigest===expected?true:undefined;}catch{return undefined;}});
   assert.equal(await owner.alive(row),true);
  },restart:async()=>{await owner.close();await server.close();await unlink(socket).catch(error=>{if(error.code!=='ENOENT')throw error;});server=await serveAgent(options);owner=open();}};
 }
 const a=await machine(),b=await machine();
 async function hub(){return projectHub(t,root,env,{clock,hosts:[a.host(),b.host()],processes:fakeLockProcesses().processes,droplet:{processes:fakeLockProcesses().processes},adapters:[boundary=>new OpenCodeAdapter(boundary,{bin:resolve('hub/test/fakes/opencode/opencode'),env,clock,stopGraceMs:1000})]});}
 let runtime=await hub();owners.defer(()=>runtime.stop());
 let ui=await connectUi(t,runtime.discovery,'cli');
 const table=new ProcessTable(join(root,'.cland/hub.db'),clock);owners.defer(async()=>{await access(root);table.close();tableClosed=true;});
 const cleanupReceipt=()=>({root,storeClosed:()=>storeClosed,tableClosed:()=>tableClosed,nativeCloses});
 const rows:HarnessProcess[]=[];
 for(const [name,host] of [['key-a',a],['key-b',b]] as const){
  const launched=await ui.request({type:'session.launch',name,harness:'opencode',account:'work',host:host.native.id,cwd:host.home,model:'opencode/fake-paid'});
  assert.equal(launched.ok,true,launched.error);
  const row=table.get(name)!;assert.ok(row);rows.push(row);assert.equal(row.login,'work');assert.deepEqual(row.accountEnv,{});await host.receipt(row,values[0]!);
  if(failEarly){await assert.rejects(async()=>{throw Error('forced composed fixture body failure');},/forced composed fixture body failure/);return cleanupReceipt();}
 }
 assert.ok(preparedPlans.length>=2);assert.ok(plans.length>=2);
 async function scan(directory:string):Promise<string[]>{const found:string[]=[];for(const entry of await readdir(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())found.push(...await scan(path));else if(entry.isFile()){const bytes=await readFile(path);if(values.some(value=>bytes.includes(Buffer.from(value))))found.push(path.slice(root.length+1));}}return found;}
 // The planted control is hub-local, outside both fake host directories.
 await writeFile(join(root,'scan-positive'),values[0]!);assert.deepEqual(await scan(root),['scan-positive']);await unlink(join(root,'scan-positive'));
 assert.deepEqual(await scan(root),[]);assert.equal(values.some(value=>JSON.stringify(argv).includes(value)),false);
 const listed=await ui.request({type:'session.list'});assert.equal(values.some(value=>JSON.stringify(listed).includes(value)),false);
 for(const row of rows){const stopped=await ui.request({type:'session.stop',session:row.name});assert.equal(stopped.ok,true,stopped.error);await until(()=>nativeCloses.has(row.pid!),{what:'stopped fake OpenCode native close'});assert.deepEqual(nativeCloses.get(row.pid!),{code:0,signal:null});}
 await runtime.stop();await a.restart();await b.restart();
 await unlink(join(root,'.cland/auth/work.key'));writeLoginKey(root,project,'work',values[1]!);
 runtime=await hub();ui=await connectUi(t,runtime.discovery,'cli');
 const resumed=await ui.request({type:'session.resume',session:'key-a',relaunch:true},testWaitMs()).catch(async error=>{const files=await readdir(join(a.home,'opencode/key-a')).catch(()=>[]);const tail=await readFile(join(a.home,'opencode/key-a/serve.log'),'utf8').catch(()=>'');throw Error('incomplete persisted resume: '+String(error)+' native close receipts: '+JSON.stringify([...nativeCloses])+' files: '+JSON.stringify(files)+' tail: '+remoteRedactor(values).text(tail.slice(-2000)));});assert.equal(resumed.ok,true,resumed.error);
 const next=table.get('key-a')!;assert.equal(next.sessionId,rows[0]!.sessionId);assert.equal(next.harnessSessionId,rows[0]!.harnessSessionId);assert.notEqual(next.pid,rows[0]!.pid);await a.receipt(next,values[1]!);
 assert.deepEqual(next.accountEnv,{});assert.deepEqual(store.hosts.logins.bindings('work'),[]);assert.equal(store.hosts.logins.get('work')!.state,'ready');
 assert.deepEqual(await scan(root),[]);assert.equal(values.some(value=>JSON.stringify(argv).includes(value)),false);
 assert.equal((await ui.request({type:'session.stop',session:'key-a'})).ok,true);await until(()=>nativeCloses.has(next.pid!),{what:'resumed fake OpenCode native close'});assert.deepEqual(nativeCloses.get(next.pid!),{code:0,signal:null});await runtime.stop();
 assert.deepEqual(await scan(root),[]);
 for(const file of ['hub.db','log/hub.log','journal.jsonl'])assert.ok((await readFile(join(root,'.cland',file))).length>0,`${file} existed and was scanned`);
 return cleanupReceipt();
}

test('composed key launches on two hosts resume a persisted conversation after hub and agent restart',async t=>{await composedKeyLaunch(t);});

test('composed fixture early failure joins native and storage before root disposal',async t=>{
 let receipt:Awaited<ReturnType<typeof composedKeyLaunch>>|undefined;
 await t.test('scope ends with a live composed server after body failure',async scope=>{receipt=await composedKeyLaunch(scope,true);});
 assert.ok(receipt);assert.equal(receipt.storeClosed(),true);assert.equal(receipt.tableClosed(),true);assert.equal(receipt.nativeCloses.size,1);assert.deepEqual([...receipt.nativeCloses.values()],[{code:null,signal:'SIGKILL'}]);
 await assert.rejects(access(receipt.root),{code:'ENOENT'});
});

test('two fake hosts receive a key only at spawn and retain no plaintext through agent restart',async t=>{
 const owners=loginFixtureOwners(t),root=await mkdtemp(join(tmpdir(),'key-spawn-'));owners.directory(root);
 const sentinel='SENTINEL-only-native-key-1788', digest=createHash('sha256').update(sentinel).digest('hex');
 const clock=new FakeClock(Date.now()),env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root});
 const provider=new FakeHostProvider({env,now:()=>clock.now().getTime()});
 const store=new Store(join(root,'hub.db'));owners.defer(()=>store.close());
 const binder=new LoginBinder(store.hosts.logins);owners.defer(()=>binder.close());
 writeLoginKey(root,'fixture-project','work',sentinel);
 store.hosts.logins.insert({name:'work',harness:'opencode',account:'work',kind:'key',lastSignIn:null});
 const original=store.hosts.logins.transition('work','ready');
 const redact=remoteRedactor();
 const argv:string[][]=[];
 async function host(){
  const acquired=await provider.acquire({project:root,pool:'agents',region:'fake-1',architecture:'x86_64'});if(acquired.state!=='created')throw Error('fixture acquire');
  const machine=acquired.machine,directory=hostDirectory(root,machine.id),runDir=join(directory,'home/.cland-host/run');
  const hostEnv=fixtureEnvironment(root,env,{CLAND_FAKE_HOSTS:machine.id,CLAND_HOST_BOOT_ID_FILE:join(directory,'boot-id'),MARKER:'public-retained',FAKE_OPENCODE_KEY_PROOF:'1'});
  const options={runDir,secret:'fixture-secret',version:'test',env:hostEnv};
  let server=await serveAgent(options);owners.defer(()=>server.close());
  let client=await AgentClient.connect(server.socket,'fixture-secret');owners.defer(()=>client.close());
  async function launch(){
   const bound=await binder.bind({host:{name:machine.id},machine,provider:()=>{throw Error('key must not use disks');},providerName:'fake',region:'fake-1',pool:'agents',project:root,harness:'opencode',account:'work',validate:()=>{},checkAccount:()=>{}});
   assert.deepEqual(bound.accountEnv,{});
   const args=['key-proof'];argv.push(args);
   const logFile=join(directory,'proof.log');
   const prepared=await client.request('prepare-spawn',{command:resolve('hub/test/fakes/opencode/opencode'),args,cwd:directory,logFile,env:{MARKER:hostEnv.MARKER,...loginKeyEnvironment(root,'fixture-project',store.hosts.logins,redact.register,bound.login)}}) as {token:string};
   const plan=await readFile(join(runDir,'prepared',prepared.token+'.json'),'utf8');
   assert.ok(plan.includes('public-retained'));assert.equal(plan.includes(sentinel),false);
   const child=await client.request('commit-prepared',{token:prepared.token}) as {pid:number;identity:string};
   owners.defer(ownProcess(undefined,child.pid));let stopped=false;const stop=async()=>{if(!stopped){assert.equal(await client.request('stop',child),true);stopped=true;}};owners.defer(stop);
   await until(async()=>{try{return (await readFile(logFile,'utf8')).trim().endsWith(digest);}catch{return false;}},{what:'fake OpenCode key digest receipt'}).catch(async error=>{throw new Error(String(error)+' tail: '+redact.text((await readFile(logFile,'utf8')).slice(-1000)));});
   assert.equal(await client.request('alive',child),true);
   return stop;
  }
  return {launch,restart:async()=>{await client.close();await server.close();server=await serveAgent(options);client=await AgentClient.connect(server.socket,'fixture-secret');}};
 }
 await writeFile(join(root,'scan-positive'),sentinel);
 assert.deepEqual(await scan(root),['scan-positive']);await unlink(join(root,'scan-positive'));
 const a=await host(),b=await host();const stopA=await a.launch();await b.launch();
 assert.deepEqual(store.hosts.logins.get('work'),original);assert.deepEqual(store.hosts.logins.bindings('work'),[]);
 async function scan(directory:string):Promise<string[]>{const found:string[]=[];for(const entry of await readdir(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())found.push(...await scan(path));else if(entry.isFile()&&(await readFile(path)).includes(Buffer.from(sentinel)))found.push(path.slice(root.length+1));}return found;}
 assert.equal(JSON.stringify(argv).includes(sentinel),false);assert.deepEqual(await scan(root),[]);
 assert.equal(JSON.stringify(redactFrame({type:'error',error:`failure ${sentinel}`},redact)).includes(sentinel),false);
 await stopA();await a.restart();await a.launch();assert.deepEqual(await scan(root),[]);
 assert.deepEqual(store.hosts.logins.get('work'),original);
});
