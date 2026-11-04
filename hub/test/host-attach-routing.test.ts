// T2: real session.attach frames with an in-process fake adapter and recording Host.
import test from 'node:test';
import { once } from 'node:events';
import { createConnection } from 'node:net';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { localHost } from '../src/host/local.ts';
import { terminalAttachCommand } from '../src/host/attach.ts';
import { remoteHostLayout } from '../src/host/remote-layout.ts';
import { hostPaths } from '../src/host/records.ts';
import { projectHub, tempProject } from './harness.ts';
import { sessionUi } from './session-credential-fixture.ts';
import { fixtureEnvironment } from './fixture-environment.ts';

test('host session.attach and list return pinned separate SSH command; prior local frame stays compatible',async t=>{
  const root=await tempProject(t);const paths=hostPaths(root,'f1');await mkdir(paths.directory,{recursive:true});
  await writeFile(paths.clientKeyPath,join(root,'key'));await writeFile(paths.secret,'planted-host-secret');
  const layout=remoteHostLayout(join(root,'host'));
  const record={id:'f1',transport:'ssh' as const,address:'host.example',user:'agent',state:'registered' as const};
  const command=terminalAttachCommand(root,record,layout,'worker');
  const host={...localHost(fixtureEnvironment(root,process.env)),name:'f1',terminalAttachCommand:(name:string)=>terminalAttachCommand(root,record,layout,name)};
  const hub=await projectHub(t,root,{}, {hosts:[host]});const ui=await sessionUi(t,hub.discovery);
  const launch=await ui.request({type:'session.launch',name:'worker',harness:'codex',host:'f1',cwd:root});assert.equal(launch.ok,true,launch.error);
  const attach=await ui.request({type:'session.attach',session:'worker'});assert.equal(attach.ok,true,attach.error);assert.deepEqual(attach.value,{command});
  const rows=(await ui.request({type:'session.list'})).value as {processes:Array<{name:string;attach:string}>};assert.equal(rows.processes.find(p=>p.name==='worker')?.attach,command);
  for(const value of ['-t','-a','-x','ControlPath=none','ClearAllForwardings=yes','StrictHostKeyChecking=yes',paths.knownHosts,'host attach'])assert.ok(command.includes(value),value);
  assert.doesNotMatch(command,/planted-host-secret|CLAND_HOST_SECRET|CLAND_LAUNCH_TOKEN/);
  const local=await ui.request({type:'session.launch',name:'local-worker',harness:'codex',cwd:root});assert.equal(local.ok,true,local.error);
  const prior=await ui.request({type:'session.attach',session:'local-worker'});assert.equal(prior.ok,true,prior.error);assert.doesNotMatch(JSON.stringify(prior.value),/ssh/);
});

for (const reason of ['host is revoked','ENOENT: client-key-path missing']) test(`unavailable terminal ${reason} preserves launch, list, snapshot and unrelated rows`,async t=>{
  const {frameClient}=await import('./harness.ts');const {onCleanup}=await import('./process-cleanup.ts');
  const root=await tempProject(t);
  const host={...localHost(fixtureEnvironment(root,process.env)),name:'f1',terminalAttachCommand:()=>{throw new Error(reason);}};
  const hub=await projectHub(t,root,{}, {hosts:[host]});const ui=await sessionUi(t,hub.discovery);
  for(const [name,placement] of [['worker','f1'],['other','local']]) {
    const launch=await ui.request({type:'session.launch',name,harness:'codex',host:placement,cwd:root});assert.equal(launch.ok,true,launch.error);
  }
  const list=await ui.request({type:'session.list'});assert.equal(list.ok,true,list.error);
  const processes=(list.value as {processes:Array<{name:string;attach:string|null}>}).processes;
  assert.equal(processes.find(p=>p.name==='worker')?.attach,null);assert.ok(processes.find(p=>p.name==='other')?.attach);
  const refused=await ui.request({type:'session.attach',session:'worker'});assert.equal(refused.ok,false);assert.ok(String(refused.error).includes(reason));
  const socket=createConnection(hub.discovery.socket);onCleanup(t,()=>socket.destroy());await once(socket,'connect',{signal:AbortSignal.timeout(2000)});socket.setEncoding('utf8');
  const snapshot=frameClient(line=>socket.write(line),fn=>socket.on('data',fn),()=>socket.destroy());
  const sessions=snapshot.waitFor(frame=>frame.type==='snapshot'&&frame.domain==='sessions');
  snapshot.send({type:'hello',protocol:2,secret:hub.discovery.secret,client:'ui',features:['snapshot']});
  const frame=await sessions;assert.deepEqual((frame.value as {processes:unknown[]}).processes,processes);
});
