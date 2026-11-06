// T3: runtime SSH carrier and Git daemon lifecycle, including hub restart.
// The fake transport uses native forwarding children; sshHostFixture joins all writers before removal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { access } from 'node:fs/promises';
import { sshHostFixture } from './ssh-host-fixture.ts';
import { projectHub, connectUi, eventually, testWaitMs } from './harness.ts';
import { Store } from '../src/hub/store.ts';
import { ProcessTable } from '../src/adapters/processes.ts';

const SETUP_MS=testWaitMs(45000);
const LAUNCH_MS=5000;
test('C1/C2 runtime host joins without restart and removal settles rows and closes carrier and Git', {timeout:SETUP_MS},async t=>{
 const f=await sshHostFixture(t,{startTransport:false});
 const hub=await projectHub(t,f.root,{...f.env,CLAND_FAKE_HOSTS:''},{hostConfigurations:{f1:{layout:f.layout,supervisor:f.supervisor}}});
 f.addCleanup(()=>hub.stop());
 const store=new Store(join(f.root,'.cland/hub.db')),table=new ProcessTable(join(f.root,'.cland/hub.db'));
 f.addCleanup(async()=>{table.close();store.close();});
 const record=store.hosts.insert({...f.records.get('f1')!,clientKeyPath:'/fake',knownHosts:'fake'},f.secrets.readSecret('f1'));
 hub.hostEnvironment.CLAND_FAKE_HOSTS='f1';
 assert.ok(hub.hostOwner);
 await hub.hostOwner.add(record);
 const host=hub.hostOwner.hosts[0]!;
 await eventually('runtime carrier up',async()=>{try{return (await host.statDirectory(f.fake.home)).refusal===null||undefined;}catch{return undefined;}},SETUP_MS);
 const ui=await connectUi(t,hub.discovery,'cli');
 const observed=eventually('durable runtime session row',()=>table.get('runtime-worker')?.status==='running'&&table.get('runtime-worker')||undefined,LAUNCH_MS);
 let running;
 try {
   const launched=await ui.request({type:'session.launch',name:'runtime-worker',harness:'codex',cwd:f.fake.home,host:'f1'},LAUNCH_MS);
   assert.equal(launched.ok,true,launched.error);
 } finally { running=await observed; }
 assert.equal(running.host,'f1');
 const settlement=await hub.hostOwner.remove('f1') as {leftovers:unknown[];timedOut:boolean};
 assert.equal(settlement.timedOut,false);assert.deepEqual(settlement.leftovers,[]);
 assert.equal(store.hosts.get('f1')?.state,'revoked');
 assert.equal(table.get('runtime-worker')?.status,'stopped');
 await assert.rejects(host.statDirectory(f.fake.home),/closed|revoked|not up/);
 await assert.rejects(access(f.paths.gitSocket),{code:'ENOENT'});
 assert.deepEqual(hub.hostOwner.hosts,[]);
});

test('C3 runtime registered host reopens on the next hub start', {timeout:SETUP_MS},async t=>{
 const f=await sshHostFixture(t,{startTransport:false});
 const options={hostConfigurations:{f1:{layout:f.layout,supervisor:f.supervisor}}};
 const first=await projectHub(t,f.root,{...f.env,CLAND_FAKE_HOSTS:''},options);f.addCleanup(()=>first.stop());
 const store=new Store(join(f.root,'.cland/hub.db'));f.addCleanup(async()=>store.close());
 const record=store.hosts.insert({...f.records.get('f1')!,clientKeyPath:'/fake',knownHosts:'fake'},f.secrets.readSecret('f1'));
 first.hostEnvironment.CLAND_FAKE_HOSTS='f1';
 await first.hostOwner!.add(record);
 await eventually('first runtime carrier up',async()=>{try{return (await first.hostOwner!.hosts[0]!.statDirectory(f.fake.home)).refusal===null||undefined;}catch{return undefined;}},SETUP_MS);
 await first.stop();
 const second=await projectHub(t,f.root,f.env,options);f.addCleanup(()=>second.stop());
 const reopened=second.hostOwner!.hosts[0]!;
 await eventually('reopened carrier up',async()=>{try{return (await reopened.statDirectory(f.fake.home)).refusal===null||undefined;}catch{return undefined;}},SETUP_MS);
 assert.equal(reopened.name,'f1');assert.equal(store.hosts.get('f1')?.state,'registered');
});
