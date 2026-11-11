// T3: two native fake SSH hosts and an OpenCode worker survive a hub/carrier
// restart. Provider deletion, watchdog re-arm and joined cleanup require native
// lifecycle evidence; projectHub owns each hub, fixture drains all writers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { fixture } from './host-create-fixture.ts';
import { cland, connectUi, projectHub, eventually, testWaitMs } from './harness.ts';
import { Store } from '../src/hub/store.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { FakeHostProvider } from '../src/host/provider/fake.ts';
import { hostDirectory } from '../../shared/fake-host-directory.ts';
import { stopHostWatchdog,runHostWatchdog,hostWatchdogPaths } from '../src/host/host-watchdog.ts';
import {realClock} from '../src/hub/clock.ts';
import {hostLeasePath} from '../src/host/host-leases.ts';
import {fakeLockProcesses} from './fakes/lock-processes.ts';
import { watchdogAlive } from '../src/executor/droplet/watchdog.ts';
import { OpenCodeAdapter } from '../src/adapters/opencode.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { spendPath } from '../src/executor/droplet/spend.ts';
import { mountedSettledLogin } from './settled-login-fixture.ts';
import {loginFilePath} from '../src/host/agent/fake-login-mount.ts';
import { ProvisionRecords, type ProvisionState } from '../src/host/provision-records.ts';
const SETUP_MS=testWaitMs(60000);
test('restart keeps the live host and exits the deleted host, settles spend, and restores watchdog ownership',{timeout:12*SETUP_MS},async t=>{
 const f=await fixture(t),store=f.own(new Store(join(f.root,'.cland/hub.db'))),table=f.own(new ProcessTable(join(f.root,'.cland/hub.db')));
 const records=[];
 for(let n=0;n<2;n++) {
  const created=await cland(f.root,'host','create','agents');assert.equal(created.code,0,created.stderr);
  const record=JSON.parse(created.stdout);assert.equal(record.state,'ready');records.push(record);
  const fake=hostDirectory(f.root,record.machine.id),home=join(fake,'home');
  await writeFile(join(fake,'ports.json'),JSON.stringify({'12345':join(home,'session.sock')}));
  const host=f.hub.hostOwner!.hosts.find(host=>host.name===record.id)!;
  await mountedSettledLogin({root:f.root,env:f.env,records:store.hosts.logins,host,machine:record.machine,beforeStop:f.beforeStop,afterNativeJoin:f.afterNativeJoin});
  const login=store.hosts.logins.forHost(record.id)[0]!;
  await host.writeFile(`/cland/auth/opencode-${login.login}/login.json`,Buffer.from(JSON.stringify({name:login.login,token:'sentinel-login',generation:0,signIn:{at:realClock.now().toISOString(),host:record.id},lastRotation:null,dead:false,turns:[]})),{mode:0o600});
  host.freePort=async()=>12345;
  const spawn=host.spawn.bind(host);
  host.spawn=(command,options)=>spawn({...command,env:{...command.env,FAKE_LOGIN_ENABLED:'1',FAKE_LOGIN_HOST:record.id,FAKE_OPENCODE_HOME:join(home,'native'),FAKE_OPENCODE_SOCKET:join(home,'session.sock'),FAKE_OPENCODE_TURN_MS:'30'}},options);
 }
 const ui=await connectUi(t,f.hub.discovery,'cli');
 for(const [index,record] of records.entries()) {
  const launched=await ui.request({type:'session.launch',name:'worker-'+index,harness:'opencode',host:record.id,cwd:join(hostDirectory(f.root,record.machine.id),'home'),model:'opencode/fake-paid',...(index===1?{role:'implementer'}:{})},SETUP_MS);
  assert.equal(launched.ok,true,launched.error);
  await eventually('native worker persisted',()=>{const row=table.get('worker-'+index);return row?.status==='running'&&row.pid&&row.harnessSessionId?row:undefined;},SETUP_MS);
 }
 const rotated=new Map<string,Uint8Array>();
 for(const [index,record] of records.entries()){
  const host=f.hub.hostOwner!.hosts.find(host=>host.name===record.id)!,binding=store.hosts.logins.forHost(record.id)[0]!;
  const path=`/cland/auth/opencode-${binding.login}`;
  const loginHome=await loginFilePath(path,fixtureEnvironment(f.root,f.env,{CLAND_FAKE_HOSTS:record.machine.id,CLAND_FAKE_HOST_ROOT:f.root,CLAND_HOST_BOOT_ID_FILE:join(hostDirectory(f.root,record.machine.id),'boot-id')}));
  assert.ok(loginHome.startsWith(f.root+'/'),'fake login path belongs to this disposable project');
  const result=await host.run({command:process.execPath,args:[new URL('./fakes/opencode/fake-opencode.ts',import.meta.url).pathname,'run','before restart','--session',table.get('worker-'+index)!.harnessSessionId!],cwd:join(hostDirectory(f.root,record.machine.id),'home'),env:fixtureEnvironment(f.root,f.env,{FAKE_LOGIN_HOME:loginHome,FAKE_LOGIN_ENABLED:'1',FAKE_LOGIN_HOST:record.id}),timeoutMs:SETUP_MS});
  assert.equal(result.code,0,result.stderr);
  const bytes=await host.readFile(join(path,'login.json')),file=JSON.parse(Buffer.from(bytes).toString('utf8'));
  assert.equal(file.generation,1);assert.equal(file.turns[0].session,table.get('worker-'+index)!.harnessSessionId);
  rotated.set(record.id,bytes);
 }
 const live=records[0]!,gone=records[1]!;
 const goneStates:ProvisionState[]=[];
 const changed=ProvisionRecords.prototype.changed;
 // Arm before restart; every Store instance publishes this hook after commit.
 t.mock.method(ProvisionRecords.prototype,'changed',function(this:ProvisionRecords,id:string,previous:ProvisionState|null){
  const state=this.get(id)?.state;
  if(id===gone.id&&state&&state!==previous)goneStates.push(state);
  return changed.call(this,id,previous);
 });
 const liveWatchdog=store.hosts.leases.get(live.id)!.watchdog!;
 await f.hub.stop();
 const provider=new FakeHostProvider({env:f.env});
 const goneLogin=store.hosts.logins.forHost(gone.id)[0]!;
 // Execute the production watchdog against the fake provider after its hub has
 // stopped. The mirror expires relative to the real hub clock, without a deadline wait.
 const goneLease=store.hosts.leases.get(gone.id)!;
 await stopHostWatchdog(goneLease.watchdog,f.env);
 await writeFile(hostLeasePath(f.root,gone.id),JSON.stringify({...goneLease,deadline:new Date(realClock.now().getTime()-1).toISOString()}));
 await runHostWatchdog({root:f.root,id:gone.id,provider:'fake',machine:gone.machine},f.env,realClock,async()=>{throw Error('watchdog deletion must settle');},undefined,{provider,processes:fakeLockProcesses().processes});
 const absence=JSON.parse(await readFile(hostWatchdogPaths(f.root,gone.id).receipt,'utf8'));
 assert.deepEqual(absence.reads.map((r:{resource:string})=>r.resource).sort(),['key','machine']);
 let detachedInventory=false,volumeReads=0;const listVolumes=FakeHostProvider.prototype.listVolumes;
 t.mock.method(FakeHostProvider.prototype,'listVolumes',async function(this:FakeHostProvider,...args:Parameters<typeof listVolumes>){
  volumeReads++;const result=await listVolumes.apply(this,args);
  return !detachedInventory&&result.state==='listed'?{...result,volumes:result.volumes.map(volume=>volume.id===goneLogin.volumeId?{...volume,attachedTo:gone.machine.id}:volume)}:result;
 });
 await writeFile(join(f.root,'.cland/config.toml'),(await readFile(join(f.root,'.cland/config.toml'),'utf8')).replace('min_hosts=0','min_hosts=1'));
 const reopen=async()=>{
  const hub=await projectHub(t,f.root,f.env as Record<string,string>,{adapters:[boundary=>new OpenCodeAdapter(boundary,{bin:new URL('./fakes/opencode/opencode',import.meta.url).pathname,env:fixtureEnvironment(f.root,f.env),stopGraceMs:50})]});
  f.stops.push(()=>hub.stop());return hub;
 };
 let reopened=await reopen();
 await eventually('deleted host session durably exited',()=>table.get('worker-1')?.status==='exited'?true:undefined,SETUP_MS);
 assert.equal(table.get('worker-0')?.status,'running');
 assert.equal(store.hosts.logins.get(goneLogin.login)?.state,'in-use','T-1779 gone-host session exited before detached disk receipt');
 detachedInventory=true;
 try {await eventually('T-1779 destroyed host disk reconciles after session exit',()=>store.hosts.logins.get(goneLogin.login)?.state==='ready'?true:undefined,SETUP_MS);}
 catch(error){const row=store.hosts.logins.get(goneLogin.login),provision=store.hosts.provisions.get(gone.id);t.diagnostic(JSON.stringify({boundary:'T-1779 disk retry incomplete',volumeReads,state:provision?.state,release:provision?.release,deletionReceipt:!!provision?.machineDeletionRead,loginState:row?.state,releasing:row?.kind==='disk'?row.backup?.releasing:null,pending:row?.kind==='disk'?row.backup?.pending:null,bindings:store.hosts.logins.bindings(goneLogin.login).length}));throw error;}
 assert.equal((store.hosts.logins.get(goneLogin.login) as {volumeId:string}).volumeId,goneLogin.volumeId,'C1 preserves the rotated login volume');
 const liveBinding=store.hosts.logins.forHost(live.id)[0]!;
 assert.equal(store.hosts.logins.get(liveBinding.login)?.state,'in-use','C2 live login stays bound');
 assert.equal(liveBinding.volumeId,(store.hosts.logins.get(liveBinding.login) as {volumeId:string}).volumeId);
 const restartedUi=await connectUi(t,reopened.discovery,'cli');
 const liveHost=reopened.hostOwner!.hosts.find(host=>host.name===live.id)!;
 const liveLoginPath=`/cland/auth/opencode-${liveBinding.login}/login.json`;
 // C2: read through the Host's loginFilePath validation at the retained native
 // machine generation. No spoke/MCP turn is needed for this persistence proof.
 const afterRestart=await liveHost.readFile(liveLoginPath);
 assert.equal(liveHost.loginDiskReachable?.(),true);
 assert.ok(Buffer.from(afterRestart).equals(Buffer.from(rotated.get(live.id)!)),'post-restart mounted disk contains the exact fake-harness rotation');
 assert.deepEqual(store.hosts.provisions.get(live.id)?.machine,live.machine);
 const roles=(await restartedUi.request({type:'role.list'})).value as {roles:Array<{role:string;holders:unknown[]}>};
 assert.equal(roles.roles.find(role=>role.role==='implementer')!.holders.length,0);
 // Detached login readiness precedes the release owner's durable provision
 // settlement. Observe that boundary before checking its lease and spend.
 await eventually('deleted host provision durably destroyed',()=>store.hosts.provisions.get(gone.id)?.state==='destroyed'?true:undefined,SETUP_MS);
 assert.equal(store.hosts.leases.get(gone.id),null);
 const ledger=JSON.parse(await readFile(spendPath(f.env),'utf8'));
 const settled=ledger.entries.find((entry:{lease:string})=>entry.lease===gone.id);
 assert.ok(settled,'exact host lease ledger entry exists');
 assert.equal(settled.cost,0,'fake provider declares zero cost');
 assert.ok(Number.isFinite(Date.parse(settled.released)),'settled spend has a release receipt');
 assert.equal(store.hosts.provisions.get(gone.id)?.state,'destroyed');
 assert.deepEqual(store.hosts.leases.get(live.id)!.watchdog,liveWatchdog,'live watchdog is reused');
 assert.equal(await watchdogAlive({watchdog:liveWatchdog} as Parameters<typeof watchdogAlive>[0],f.env),true);
 // A second restart proves absence, rather than an ambiguous birth probe, re-arms.
 await reopened.stop();await stopHostWatchdog(liveWatchdog,f.env);
 reopened=await reopen();
 const replacement=store.hosts.leases.get(live.id)!.watchdog!;
 assert.notDeepEqual(replacement,liveWatchdog);
 assert.equal(await watchdogAlive({watchdog:replacement} as Parameters<typeof watchdogAlive>[0],f.env),true);
 const again=await connectUi(t,reopened.discovery,'cli');
 await again.request({type:'session.list'});
 assert.equal(store.hosts.provisions.list().length,2,'minimum uses restored inventory without another acquire');
 assert.equal(store.hosts.provisions.occupied('agents'),1);
 await reopened.stop(); // Join release retries before evaluating terminal history.
 const firstDestroyed=goneStates.indexOf('destroyed');
 assert.notEqual(firstDestroyed,-1,'gone provision published durable destruction');
 assert.deepEqual(goneStates.slice(firstDestroyed),['destroyed'],'destroyed provision never leaves its terminal state');
});
