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
import { stopHostWatchdog } from '../src/host/host-watchdog.ts';
import { watchdogAlive } from '../src/executor/droplet/watchdog.ts';
import { OpenCodeAdapter } from '../src/adapters/opencode.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { spendPath } from '../src/executor/droplet/spend.ts';
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
  host.freePort=async()=>12345;
  const spawn=host.spawn.bind(host);
  host.spawn=(command,options)=>spawn({...command,env:{...command.env,FAKE_OPENCODE_HOME:join(home,'native'),FAKE_OPENCODE_SOCKET:join(home,'session.sock'),FAKE_OPENCODE_TURN_MS:'30'}},options);
 }
 const ui=await connectUi(t,f.hub.discovery,'cli');
 for(const [index,record] of records.entries()) {
  const launched=await ui.request({type:'session.launch',name:'worker-'+index,harness:'opencode',host:record.id,cwd:join(hostDirectory(f.root,record.machine.id),'home'),model:'opencode/fake-paid',...(index===1?{role:'implementer'}:{})},SETUP_MS);
  assert.equal(launched.ok,true,launched.error);
  await eventually('native worker persisted',()=>{const row=table.get('worker-'+index);return row?.status==='running'&&row.pid&&row.harnessSessionId?row:undefined;},SETUP_MS);
 }
 const live=records[0]!,gone=records[1]!;
 const liveWatchdog=store.hosts.leases.get(live.id)!.watchdog!;
 await f.hub.stop();
 const provider=new FakeHostProvider({env:f.env});
 assert.equal((await provider.release(gone.machine)).state,'released');
 await writeFile(join(f.root,'.cland/config.toml'),(await readFile(join(f.root,'.cland/config.toml'),'utf8')).replace('min_hosts=0','min_hosts=1'));
 const reopen=async()=>{
  const hub=await projectHub(t,f.root,f.env as Record<string,string>,{adapters:[boundary=>new OpenCodeAdapter(boundary,{bin:new URL('./fakes/opencode/opencode',import.meta.url).pathname,env:fixtureEnvironment(f.root,f.env),stopGraceMs:50})]});
  f.stops.push(()=>hub.stop());return hub;
 };
 let reopened=await reopen();
 await eventually('deleted host session durably exited',()=>table.get('worker-1')?.status==='exited'?true:undefined,SETUP_MS);
 assert.equal(table.get('worker-0')?.status,'running');
 const restartedUi=await connectUi(t,reopened.discovery,'cli');
 const roles=(await restartedUi.request({type:'role.list'})).value as {roles:Array<{role:string;holders:unknown[]}>};
 assert.equal(roles.roles.find(role=>role.role==='implementer')!.holders.length,0);
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
});
