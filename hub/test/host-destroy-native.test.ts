// T3: native SSH, tunnel loss and OpenCode settlement at provider deletion reads.
// Fixture closes the hub and all observed writers before deleting disposable roots.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { writeFile, access } from 'node:fs/promises';
import { readHostLeaseFile } from '../src/host/host-leases.ts';
import { watchdogAlive } from '../src/executor/droplet/watchdog.ts';
import type { DropletLease } from '../src/executor/droplet/lease.ts';
import { fixture } from './host-create-fixture.ts';
import { cland, connectUi, eventually, testWaitMs, flushProjectLogs } from './harness.ts';
import { hostDirectory } from '../../shared/fake-host-directory.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import type { Machine, ReleaseObserver } from '../src/host/provider/provider.ts';
import { FakeHostProvider } from '../src/host/provider/fake.ts';
import { mountedSettledLogin } from './settled-login-fixture.ts';
import { spawn } from 'node:child_process';
import { scratchMachine } from './init-machine.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { beforeDirectories, guardDirectoryRemoval } from './process-cleanup.ts';
import { caseDeadlines } from './case-deadlines.ts';
import { Store } from '../src/hub/store.ts';
import { realClock } from '../src/hub/clock.ts';
import { armWatchdog } from '../src/executor/droplet/watchdog.ts';
import { destroyHost } from '../src/host/provision-host.ts';

test('destroy joins a delayed native watchdog after positive non-acquisition',{timeout:30000},async t=>{
 let ready=false,term=false,closed=false,returned=false;
 let child:ReturnType<typeof spawn>|undefined;
 let store:Store|undefined;
 let destroying:ReturnType<typeof destroyHost>|undefined;
 const scope=caseDeadlines(t,{ownership:{beforeDirectories,guardDirectoryRemoval},releaseOnClose:()=>{child?.kill('SIGKILL');}});
 // This first hook follows the whole callback join and precedes root disposal.
 scope.fixtures.after(async()=>{if(child){child.kill('SIGKILL');await eventually('fake watchdog native close before fixture disposal',()=>closed?true:undefined,5000);}await destroying;if(store){await store.hosts.leases.close();store.close();}});
 await scope.run(async step=>{
 const f=await step(()=>scratchMachine(scope.fixtures,{identity:false}));scope.adoptRoot(f.root);
 const env=fixtureEnvironment(f.root,f.env,{CLAND_FAKE_HOST_ROOT:f.root});
 const records=await step(async()=>{store=new Store(join(f.root,'fixture.db'));return store.hosts;});
 const watchdog=await step(()=>armWatchdog(f.root,env,{launch:()=>{
  child=spawn(process.execPath,['-e',`process.on('SIGTERM',()=>process.send('term'));process.on('message',()=>process.exit(0));process.send('ready');`],{cwd:f.root,env:fixtureEnvironment(f.root,env,{}),stdio:['ignore','ignore','ignore','ipc']});
  child.on('message',message=>{if(message==='ready')ready=true;if(message==='term')term=true;});
  child.once('close',()=>{closed=true;});return child;
 }}));
 await step(()=>eventually('native fake watchdog ready',()=>ready?true:undefined,5000));
 const created=new Date().toISOString();
 await step(()=>records.leases.create('late',{root:f.root,env,clock:realClock,leaseMs:60000,caps:{shared:10,hosts:10},priceHourly:0,billingMinimumMs:0,pool:'agents',size:'fake'}));
 await step(async()=>{
 records.leases.checkpointWatchdog('late',f.root,watchdog);
 records.provisions.save({id:'late',pool:'agents',provider:'fake',size:'fake',region:'fake',created,state:'failed',nonAcquisition:{kind:'not-called',at:created}});
 destroying=destroyHost({root:f.root,id:'late',env,records,owner:{} as Parameters<typeof destroyHost>[0]['owner'],log:()=>{}}).then(result=>{returned=true;return result;});
 });
 await step(()=>eventually('watchdog stop admitted or destroy returned',()=>term||returned?true:undefined,5000));
 assert.equal(returned,false,'destroy cannot return before the watchdog closes');
 assert.equal(closed,false,'fake watchdog holds its native exit until released');
 await step(async()=>{child!.send('release');});
 const result=await step(()=>destroying!);
 assert.equal(result.state,'destroyed');assert.equal(closed,true,'destroy joins the native close receipt');
 assert.equal(await step(()=>watchdogAlive({watchdog} as DropletLease,env)),false);
 });
});
const SETUP_MS=testWaitMs(60000);
// Twelve sequential setup allowances plus 120s for exact CLI behaviour and joined cleanup.
const OUTER_MS=12*SETUP_MS+120000;
for(const down of [false,true])test(`C1/C2/C3 destroy settles native session after confirming deletion; tunnel down=${down}`,{timeout:OUTER_MS},async t=>{
 const f=await fixture(t);
 const created=await cland(f.root,'host','create','agents');assert.equal(created.code,0,created.stderr);
 const record=JSON.parse(created.stdout);assert.equal(record.state,'ready');
 const leaseFile=JSON.parse(await (await import('node:fs/promises')).readFile((await import('../src/host/host-leases.ts')).hostLeasePath(f.root,record.id),'utf8'));
 assert.ok(leaseFile.watchdog?.pidIdentity);assert.equal(await watchdogAlive(leaseFile as DropletLease,f.env),true);
 const fake=hostDirectory(f.root,record.machine.id),home=join(fake,'home');
 const host=f.hub.hostOwner!.hosts.find(h=>h.name===record.id)!;
 await writeFile(join(fake,'ports.json'),JSON.stringify({'12345':join(home,'session.sock')}));
 host.freePort=async()=>12345;
 const spawn=host.spawn.bind(host);
 host.spawn=(command,options)=>spawn({...command,env:{...command.env,FAKE_OPENCODE_HOME:join(home,'native'),FAKE_OPENCODE_SOCKET:join(home,'session.sock'),FAKE_OPENCODE_TURN_MS:'30'}},options);
 const ui=await connectUi(t,f.hub.discovery,'cli');
 const table=f.own(new ProcessTable(join(f.root,'.cland/hub.db')));
 const {Store}=await import('../src/hub/store.ts');const store=f.own(new Store(join(f.root,'.cland/hub.db')));
 await mountedSettledLogin({root:f.root,env:f.env,records:store.hosts.logins,host,machine:record.machine,beforeStop:f.beforeStop,afterNativeJoin:f.afterNativeJoin});
 const launch=await ui.request({type:'session.launch',name:'destroy-worker',harness:'opencode',host:record.id,cwd:home,model:'opencode/fake-paid'},SETUP_MS);assert.equal(launch.ok,true,launch.error);
 await eventually('native worker persisted',()=>{const row=table.get('destroy-worker');return row?.status==='running'&&row.pid&&row.harnessSessionId?true:undefined;},SETUP_MS);
 assert.equal(host.loginDiskReachable?.(),true,'existing admitted tunnel is reachable');
 if(down) {
  // Keep the machine/native worker live but make all new transport acquisition fail.
  await writeFile(join(fake,'host-key.pub'),'ssh-ed25519 WRONG');
  await (host as typeof host & {close():Promise<void>}).close();
  assert.equal(host.loginDiskReachable?.(),false,'closed Host is unreachable without a new wait');
 }
 const release=FakeHostProvider.prototype.release;
 const inventoryGate=Promise.withResolvers<void>();let inventoryHeld=false,deletionObserved=false;
 let deleting:ReturnType<typeof cland>|undefined;
 f.beforeStop(async()=>{inventoryGate.resolve();await deleting;});
 const listVolumes=FakeHostProvider.prototype.listVolumes;
 t.mock.method(FakeHostProvider.prototype,'listVolumes',async function(this:FakeHostProvider,...args:Parameters<typeof listVolumes>){
  if(down&&deletionObserved){inventoryHeld=true;await inventoryGate.promise;}
  return listVolumes.apply(this,args);
 });
 let held=down;
 t.mock.method(FakeHostProvider.prototype,'release',async function(this:FakeHostProvider,machine:Machine,confirm?:ReleaseObserver){
  if(held) {
   assert.notEqual(table.get('destroy-worker')?.status,'exited','remove without native receipt stays fenced');
   return release.call(new FakeHostProvider({env:f.hub.hostEnvironment,ignoreDelete:true}),machine,confirm);
  }
  return release.call(this,machine,receipt=>{if(receipt.resource==='machine')deletionObserved=true;confirm?.(receipt);});
 });
 if(down) {
  const first=await cland(f.root,'host','destroy',record.id);assert.equal(first.code,1,first.stderr);
  assert.notEqual(table.get('destroy-worker')?.status,'exited');
  const listed=await cland(f.root,'host','list');assert.match(listed.stdout,/deletion not confirmed/);
  held=false;
 }
 deleting=cland(f.root,'host','destroy',record.id);
 if(down){
  await eventually('T-1779 tunnel-down session exits while volume inventory is held',()=>inventoryHeld&&table.get('destroy-worker')?.status==='exited'?true:undefined,SETUP_MS);
  assert.equal(store.hosts.logins.forHost(record.id).length,1,'disk remains bound while inventory is held');
 }
 inventoryGate.resolve();const destroyed=await deleting;assert.equal(destroyed.code,0,destroyed.stderr);assert.equal(JSON.parse(destroyed.stdout).state,'destroyed');
 assert.equal(table.get('destroy-worker')?.status,'exited');
 assert.equal(await watchdogAlive(leaseFile as DropletLease,f.env),false,'confirmed destroy joins the watchdog');
 assert.equal(readHostLeaseFile(f.root,record.id),null);
 await assert.rejects(access(join(fake,'client-key')),{code:'ENOENT'});
 await flushProjectLogs(t,f.root);
 const {readFile}=await import('node:fs/promises');
 const events=(await readFile(join(f.root,'.cland/log/hub.log'),'utf8')).split('\n').filter(Boolean).map(line=>JSON.parse(line)).filter(e=>e.event==='host-destroy');
 assert.deepEqual(events.map(e=>e.resource),['machine','key']);assert.ok(events.every(e=>e.read));
});

test('destroy joins an admitted held acquisition and prevents ready resurrection',{timeout:OUTER_MS},async t=>{
 const f=await fixture(t);
 const {Store}=await import('../src/hub/store.ts');const store=f.own(new Store(join(f.root,'.cland/hub.db')));
 const {createHost}=await import('../src/host/provision-host.ts');
 const provider=new FakeHostProvider({env:f.hub.hostEnvironment});
 const acquire=provider.acquire.bind(provider),gate=Promise.withResolvers<void>(),entered={value:false};
 t.mock.method(provider,'acquire',async(options:Parameters<typeof acquire>[0])=>{const result=await acquire(options);entered.value=true;await gate.promise;return result;});
 let creating:ReturnType<typeof createHost>|undefined,destroying:ReturnType<typeof cland>|undefined;
 f.beforeStop(async()=>{gate.resolve();await creating;await destroying;});
 creating=createHost({root:f.root,pool:'agents',env:f.hub.hostEnvironment,records:store.hosts,owner:f.hub.hostOwner!,provider});
 await eventually('provider acquisition held with durable machine',()=>entered.value?true:undefined,SETUP_MS);
 const pending=store.hosts.provisions.list().find(row=>row.state==='creating')!;assert.ok(pending);
 destroying=cland(f.root,'host','destroy',pending.id);
 await eventually('destroy intent checkpointed',()=>store.hosts.provisions.get(pending.id)?.state==='destroying'?true:undefined,SETUP_MS);
 gate.resolve();await creating;
 const result=await destroying;assert.equal(result.code,0,result.stdout+result.stderr);
 assert.equal(store.hosts.provisions.get(pending.id)?.state,'destroyed');
 assert.notEqual(store.hosts.get(pending.id)?.state,'registered');
 assert.equal((await provider.status(store.hosts.provisions.get(pending.id)!.machine!)).state,'gone');
});
