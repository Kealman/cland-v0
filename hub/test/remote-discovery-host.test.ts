// T3: real fake SSH master and host agent; no network or real SSH.
// The fixture records and joins every child and checks its process census before removal.
import test, {type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { sshHostFixture } from './ssh-host-fixture.ts';
import { projectHub, connectUi, eventually, clandWithEnv } from './harness.ts';
import { projectSshHosts } from '../src/host/registry.ts';
import { SshTransport } from '../src/transport/ssh.ts';
import { remoteHostLayout } from '../src/host/remote-layout.ts';
import { Store } from '../src/hub/store.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { layout } from '../src/project.ts';
import { runSpoke } from '../src/spoke/spoke.ts';
import { fixtureEnvironment } from './fixture-environment.ts';

async function discoveryFixture(t: TestContext) {
 const f = await sshHostFixture(t, {startTransport:false});
 await writeFile(join(f.root,'.cland/secret'),'a'.repeat(64),{mode:0o600});
 const hub = await projectHub(t,f.root);
 assert.equal(hub.discovery.secret,'a'.repeat(64),'planted project secret positive control');
 f.addCleanup(()=>hub.stop());
 const store = new Store(join(f.root,'.cland/hub.db'));
 const table = new ProcessTable(join(f.root,'.cland/hub.db'));
 f.addCleanup(async()=>{table.close();store.close();});
 const record = f.records.get('f1')!;
 const secret = f.secrets.readSecret('f1');
 store.hosts.insert({...record,clientKeyPath:'/fake',knownHosts:'fake'},secret);
 const remote = remoteHostLayout(f.fake.home,{node:process.execPath,cli:new URL('../bin/cland.ts',import.meta.url).pathname,spoke:new URL('../bin/cland-spoke.ts',import.meta.url).pathname});
 const open = () => projectSshHosts({root:f.root,records:f.records,hubSocket:layout(f.root).socket,spokeSocket:layout(f.root).spokeSocket,env:f.env,log:()=>{},configurations:{f1:{home:f.fake.home,layout:remote,supervisor:f.supervisor}},gitDaemon:async()=>({close:async()=>{}}),createTransport:o=>new SshTransport({...o,reconnectDelayMs:()=>10,readinessPollMs:5,readinessTimeoutMs:3000,beforeReadyTimeoutMs:3000})});
 let owner = await open();
 f.addCleanup(()=>owner.close());
 const ready = () => eventually('published discovery and carrier ready',async()=>{try{return await owner.hosts[0]!.fileType(remote.discoveryFile)==='file'||undefined;}catch{return undefined;}},3000);
 await ready();
 const bytes = await readFile(remote.discoveryFile,'utf8');
 assert.equal((await stat(remote.discoveryFile)).mode & 0o777,0o600);
 const discovery = JSON.parse(bytes);
 assert.equal(discovery.secret,secret);
 assert.notEqual(secret,hub.discovery.secret,'project bearer positive control differs');
 assert.equal(bytes.includes(hub.discovery.secret),false);
 assert.equal(discovery.pid,undefined);assert.equal(discovery.port,undefined);
 for(const path of [discovery.socket,discovery.spoke.slice(8,-2)]) assert.ok(Buffer.byteLength(path)+1<=104,path);
 const restartCarrier = async()=>{await owner.close();owner=await open();await ready();};
 const startSpoke = async()=>{
  const ui = await connectUi(t,hub.discovery,'cli');
  const launch = await ui.request({type:'session.launch',name:'worker',role:'implementer',harness:'claude-code'});
  assert.equal(launch.ok,true,launch.error);
  const row = table.get('worker')!;
  table.put({...row,host:'f1'});
  const token = hub.fakes['claude-code']!.spawns.at(-1)!.launchToken!;
  const [clientTransport,serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({name:'fake-harness',version:'test'},{capabilities:{}});
  let log='';
  const override=join(f.fake.home,'client-discovery.json');
  await writeFile(override,bytes,{mode:0o600});
  const runtime = await runSpoke(fixtureEnvironment(f.root,f.env,{CLAND_HUB_FILE:override,CLAND_SESSION_NAME:row.name,CLAND_SESSION_ID:row.sessionId,CLAND_LAUNCH_TOKEN:token,CLAND_HUB_RECONNECT_MS:'10'}),{transport:serverTransport,cwd:f.fake.home,exit:()=>{},log:line=>{log+=line+'\n';}});
  f.addCleanup(async()=>{await runtime.hub?.stop();await client.close();await runtime.server.close();});
  await client.connect(clientTransport);
  await eventually('role holding remote spoke welcome',()=>runtime.hub?.state.kind==='connected'||undefined,2000);
  assert.ok(await runtime.hub!.request({type:'session.list'}));
  return {runtime,override,log:()=>log};
 };
 return {f,hub,store,remote,bytes,discovery,ready,startSpoke,restartCarrier,closeCarrier:()=>owner.close()};
}

test('C2 remote spoke rereads discovery before reconnect', {timeout:10000}, async t=>{
 const d=await discoveryFixture(t);const spoke=await d.startSpoke();
 await writeFile(spoke.override,JSON.stringify({...d.discovery,secret:'synthetic-invalid-host-secret'}));
 await d.restartCarrier();
 await eventually('changed discovery secret refused on reconnect',()=>spoke.runtime.hub?.lastRefusal?.includes('401')||undefined,2000);
 await writeFile(spoke.override,d.bytes);
 await eventually('spoke restored after carrier restart',()=>spoke.runtime.hub?.state.kind==='connected'||undefined,3000);
 assert.equal(await readFile(d.remote.discoveryFile,'utf8'),d.bytes);
});

test('C4 remote discovery stays private and byte-stable across hub restart', {timeout:10000},async t=>{
 const d=await discoveryFixture(t);
 await d.closeCarrier();await d.hub.stop();
 const restarted=await projectHub(t,d.f.root,{}, {hosts:[d.f.host]});
 d.f.addCleanup(()=>restarted.stop());
 await d.restartCarrier();
 assert.equal(await readFile(d.remote.discoveryFile,'utf8'),d.bytes);
 assert.equal((await stat(d.remote.discoveryFile)).mode & 0o777,0o600);
});

test('C5 credentialed remote spoke next hello is refused after host revoke', {timeout:10000},async t=>{
 const d=await discoveryFixture(t);const spoke=await d.startSpoke();
 const revoked=await clandWithEnv(d.f.root,{},'host','revoke','f1');
 assert.equal(revoked.code,0,revoked.stderr);
 await eventually('revoked next hello refusal',()=>/revok|401|403/.test(spoke.log()+' '+spoke.runtime.hub?.lastRefusal)||undefined,2000);
 assert.notEqual(spoke.runtime.hub?.state.kind,'connected',spoke.log());
 assert.match(spoke.runtime.hub?.lastRefusal ?? spoke.log(),/revok|401|403/);
 assert.equal(d.store.hosts.get('f1')?.state,'revoked');
});

test('readiness timeout aborts and drains before autonomous retry', {timeout:10000}, async t=>{
 const f=await sshHostFixture(t);await f.transport.stop();
 let calls=0;let writerJoined=false;
 const carrier=new SshTransport({root:f.root,record:f.records.get('f1')!,secrets:f.secrets,hubSocket:layout(f.root).socket,spokeSocket:layout(f.root).spokeSocket,remoteRun:f.fake.run,supervisor:f.supervisor,agentCommand:['stub'],env:f.env,beforeReadyTimeoutMs:10,beforeReadyDrainMs:50,reconnectDelayMs:()=>10,beforeReady:async signal=>{
  calls++;
  if(calls===1) {await new Promise<void>(resolve=>signal.addEventListener('abort',()=>{writerJoined=true;resolve();},{once:true}));}
  else assert.equal(writerJoined,true,'retry follows positive writer drain');
 }});
 f.addCleanup(()=>carrier.stop());await carrier.start();
 await eventually('autonomous retry publishes up',()=>carrier.status().state==='up'||undefined,3000);
 assert.equal(calls,2);assert.equal(writerJoined,true);assert.equal(carrier.status().reconnects,1);
 await carrier.stop();assert.equal(carrier.status().state,'down');
});

test('undrained readiness fences ownership and stop reports cleanup incomplete', {timeout:10000}, async t=>{
 const f=await sshHostFixture(t);await f.transport.stop();
 let release!:()=>void;let calls=0;let aborted=false;let writerJoined=false;
 const gate=new Promise<void>(resolve=>{release=resolve;});
 const carrier=new SshTransport({root:f.root,record:f.records.get('f1')!,secrets:f.secrets,hubSocket:layout(f.root).socket,spokeSocket:layout(f.root).spokeSocket,remoteRun:f.fake.run,supervisor:f.supervisor,agentCommand:['stub'],env:f.env,beforeReadyTimeoutMs:10,beforeReadyDrainMs:10,reconnectDelayMs:()=>10,beforeReady:async signal=>{calls++;signal.addEventListener('abort',()=>{aborted=true;},{once:true});await gate;writerJoined=true;}});
 // Only fixture disposal releases this noncooperating writer, after assertions.
 f.addCleanup(async()=>{release();await carrier.stop();assert.equal(writerJoined,true);});
 await carrier.start();
 await eventually('explicit incomplete cleanup receipt',()=>carrier.status().reason==='host readiness cleanup incomplete'||undefined,2000);
 assert.equal(aborted,true);assert.equal(writerJoined,false);assert.equal(calls,1);
 assert.equal(carrier.status().state,'connecting');assert.equal(carrier.status().reconnects,0);
 await assert.rejects(carrier.stop(),/cleanup incomplete/);
 assert.equal(carrier.status().state,'connecting');assert.equal(calls,1);
});

import { publishRemoteDiscovery, remoteDiscovery } from '../src/host/discovery.ts';
import { drained } from '../src/transport/readiness.ts';
test('publication RPC timeout retains writer until a positive same-stream drain receipt',async()=>{
 let release!:()=>void;let barrierEntered=false;let reads=0;
 const gate=new Promise<void>(resolve=>{release=resolve;});
 const publication=publishRemoteDiscovery({request:async op=>{
  if(op==='writeFile')throw new Error('agent request timed out; outcome unknown');
  if(reads++===0)throw Object.assign(new Error('absent'),{code:'ENOENT'});
  barrierEntered=true;await gate;return Buffer.from('written').toString('base64');
 }},'/unused',remoteDiscovery('/tmp/run','synthetic-host'));
 const outcome=assert.rejects(publication,/outcome unknown/);
 await eventually('same-stream drain requested',()=>barrierEntered||undefined,1000);
 assert.equal(await drained(publication,10),false,'timeout is not writer completion');
 release();await outcome;
 assert.equal(await drained(publication,10),true);
});

import { AgentClient } from '../src/host/agent-client.ts';
import { tunnelStatuses } from '../src/transport/transport.ts';
test('changed discovery keeps the prior private bytes and reports connecting refusal', {timeout:10000},async t=>{
 const f=await sshHostFixture(t);await f.transport.stop();
 const candidate=remoteDiscovery(f.fake.run,f.secrets.readSecret('f1'));
 const file=join(f.fake.run,'hub.json');
 const prior=JSON.stringify({...candidate,secret:'synthetic-prior-host-secret'});
 await writeFile(file,prior,{mode:0o600});
 const carrier=new SshTransport({root:f.root,record:f.records.get('f1')!,secrets:f.secrets,hubSocket:layout(f.root).socket,spokeSocket:layout(f.root).spokeSocket,remoteRun:f.fake.run,supervisor:f.supervisor,agentCommand:['stub'],env:f.env,reconnectDelayMs:()=>100,beforeReady:async signal=>{
  const client=await AgentClient.connect(f.paths.agentSocket,f.secrets.readSecret('f1'));
  try {await publishRemoteDiscovery(client,file,candidate,signal);} finally {await client.close();}
 }});
 f.addCleanup(()=>carrier.stop());await carrier.start();
 await eventually('changed publication refusal',()=>tunnelStatuses(f.root,[f.records.get('f1')!])[0]?.reason==='host discovery differs; atomic replacement required'||undefined,2000);
 assert.equal(carrier.status().state,'connecting');
 assert.equal(await readFile(file,'utf8'),prior);
 assert.equal((await stat(file)).mode&0o777,0o600);
});
