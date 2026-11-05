// T2: real in-process controller sockets with held admissions/writers; no native workers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createConnection } from 'node:net';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tempProject, eventually } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { createFakeHost, serveFakeReboots } from './fakes/fake-host.ts';
import type { MasterReceipt } from './fakes/fake-ssh-common.ts';

async function setup(t:import('node:test').TestContext) {
  const root=await tempProject(t),machine=await createFakeHost(root,'one');
  const env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOSTS:'one',CLAND_FAKE_HOST_ROOT:root});
  return {machine,env,record:join(machine.directory,'reboot-control'),socket:join(machine.home,'.cland-host/reboot.sock')};
}
async function request(path:string,record:MasterReceipt) {
  const socket=createConnection(path);socket.on('error',()=>{});
  await new Promise<void>((resolve,reject)=>{socket.once('connect',resolve);socket.once('error',reject);});
  socket.end(JSON.stringify({operation:'reboot',forwards:[],owner:record.owner,token:record.token})+'\n');
  return socket;
}

test('initial publication failure closes its acquired listener before rejection', {timeout:5000}, async t=>{
  const f=await setup(t);
  await mkdir(f.record);
  await assert.rejects(serveFakeReboots('one',f.env),/EISDIR/);
  await assert.rejects(stat(f.socket),{code:'ENOENT'});
  assert.deepEqual((await readdir(f.machine.directory)).filter(name=>name.startsWith('reboot-control.')),[],'failed atomic publication removes its staging writer');
  assert.equal((await stat(f.record)).isDirectory(),true,'failed setup preserves the pre-existing destination');
});

test('close joins held admission and forbids reboot after owner observation', {timeout:5000}, async t=>{
  const f=await setup(t),release=Promise.withResolvers<void>();let entered=false,reboots=0;
  const controller=await serveFakeReboots('one',f.env,{beforeAdmission:async()=>{entered=true;await release.promise;},reboot:async()=>{reboots++;}});
  t.after(async()=>{release.resolve();await controller.close();});
  const socket=await request(f.socket,JSON.parse(await readFile(f.record,'utf8')) as MasterReceipt);
  t.after(()=>socket.destroy());
  await eventually('held admission entered',()=>entered||undefined,1000);
  let clientClosed=false;socket.once('close',()=>{clientClosed=true;});
  let closed=false;const closing=controller.close().then(()=>{closed=true;});
  await eventually('close destroys its accepted transport',()=>clientClosed||undefined,1000);
  assert.equal(closed,false,'a closed socket cannot stand in for the held admission');
  release.resolve();await closing;
  assert.equal(reboots,0,'closing is rechecked after asynchronous admission');
  await assert.rejects(stat(f.record),{code:'ENOENT'});await assert.rejects(stat(f.socket),{code:'ENOENT'});
});

test('disconnected client does not release held reboot or its publication writer', {timeout:5000}, async t=>{
  const f=await setup(t),release=Promise.withResolvers<void>();let entered=false;
  const receipt=join(f.machine.directory,'reboot-work-joined');
  const controller=await serveFakeReboots('one',f.env,{reboot:async()=>{entered=true;await release.promise;await writeFile(receipt,'joined');}});
  t.after(async()=>{release.resolve();await controller.close();});
  const socket=await request(f.socket,JSON.parse(await readFile(f.record,'utf8')) as MasterReceipt);
  await eventually('held reboot entered',()=>entered||undefined,1000);
  const disconnected=new Promise<void>(resolve=>socket.once('close',()=>resolve()));socket.destroy();await disconnected;
  let closed=false;const closing=controller.close().then(()=>{closed=true;});
  await new Promise<void>(resolve=>setImmediate(resolve));
  assert.equal(closed,false,'transport absence never settles the reboot writer');
  assert.ok(await stat(f.record),'ownership metadata remains while its producer is held');
  release.resolve();await closing;
  assert.equal(await readFile(receipt,'utf8'),'joined');
  await assert.rejects(stat(f.record),{code:'ENOENT'});await assert.rejects(stat(f.socket),{code:'ENOENT'});
});

test('failed held setup destroys accepted partial clients before rejecting', {timeout:5000}, async t=>{
  const f=await setup(t),release=Promise.withResolvers<void>();let listening=false;
  const starting=serveFakeReboots('one',f.env,{beforePublish:async()=>{listening=true;await release.promise;throw new Error('injected publication failure');}});
  void starting.catch(()=>{});
  t.after(async()=>{release.resolve();await starting.catch(()=>{});});
  await eventually('listener acquired before held publication',()=>listening||undefined,1000);
  const socket=createConnection(f.socket);socket.on('error',()=>{});t.after(()=>socket.destroy());
  await new Promise<void>((resolve,reject)=>{socket.once('connect',resolve);socket.once('error',reject);});
  let closed=false;socket.once('close',()=>{closed=true;});socket.write('{');
  release.resolve();await assert.rejects(starting,/injected publication failure/);
  await eventually('failed setup accepted client closed',()=>closed||undefined,1000);
  await assert.rejects(stat(f.socket),{code:'ENOENT'});await assert.rejects(stat(f.record),{code:'ENOENT'});
});
