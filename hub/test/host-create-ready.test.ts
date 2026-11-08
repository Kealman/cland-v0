// T3: native pinned SSH admission, delivered runtime, supervisor, tunnel and OpenCode lifecycle.
// projectHub owns the hub; beforeDirectories stops it then joins every fixture process before removal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { projectHub, cland, connectUi, eventually, testWaitMs } from './harness.ts';
import { cleanupOwnedProcesses, fixtureProcessCensus, onCleanup, guardDirectoryRemoval, ownDirectory } from './process-cleanup.ts';
import { hostCloneRoot } from '../src/host/clone.ts';
import { hostDirectory } from '../../shared/fake-host-directory.ts';
import { createHost, listHosts } from '../src/host/provision-host.ts';
import { FakeHostProvider } from '../src/host/provider/fake.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { Store } from '../src/hub/store.ts';
import { fixture } from './host-create-fixture.ts';
const SETUP_MS=testWaitMs(60000);
function fixtureStore(_t:test.TestContext,f:Awaited<ReturnType<typeof fixture>>) {
 return f.own(new Store(join(f.root,'.cland/hub.db')));
}
function holdCreate(_t:test.TestContext,f:Awaited<ReturnType<typeof fixture>>,store:Store) {
 const owner=f.hub.hostOwner!,controller=new AbortController(),gate=Promise.withResolvers<void>();
 let entered=false,settled=false,completed:Awaited<ReturnType<typeof createHost>>|undefined;
 const runtime={...owner,ready:async(id:string,signal?:AbortSignal)=>{await owner.ready(id,signal);entered=true;await gate.promise;}};
 const reached=eventually('last readiness boundary held or producer completed',()=>entered||settled?true:undefined,SETUP_MS);
 let creating:Promise<Awaited<ReturnType<typeof createHost>>>|undefined;
 f.beforeStop(async()=>{controller.abort();gate.resolve();await creating?.catch(()=>{});});
 creating=createHost({root:f.root,pool:'agents',env:f.hub.hostEnvironment,records:store.hosts,owner:runtime,signal:controller.signal}).then(record=>{completed=record;return record;}).finally(()=>{settled=true;});
 void creating.catch(()=>{});
 return {controller,gate,creating,reached,get entered(){return entered;},get settled(){return settled;},get completed(){return completed;}};
}
test('C1/C2 create reaches ready with clone and tunnel and runs OpenCode; list shows declared facts', {timeout:SETUP_MS},async t=>{
 const f=await fixture(t);
 const created=await cland(f.root,'host','create','agents');assert.equal(created.code,0,created.stderr);
 const record=JSON.parse(created.stdout);assert.equal(record.state,'ready',JSON.stringify(record));
 const fake=hostDirectory(f.root,record.machine.id),home=join(fake,'home');
 const clone=hostCloneRoot(join(home,'.cland-host/run'),f.root);
 await access(join(clone,'.git/config'));
 const host=f.hub.hostOwner!.hosts.find(h=>h.name===record.id)!;
 assert.equal((await host.statDirectory(home)).refusal,null);
 // Scripted OpenCode uses a Unix server; map its selected fake port like opencode-remote.
 await writeFile(join(fake,'ports.json'),JSON.stringify({'12345':join(home,'session.sock')}));
 host.freePort=async()=>12345;
 const spawn=host.spawn.bind(host);
 host.spawn=(command,options)=>spawn({...command,env:{...command.env,FAKE_OPENCODE_HOME:join(home,'native'),FAKE_OPENCODE_SOCKET:join(home,'session.sock'),FAKE_OPENCODE_TURN_MS:'30'}},options);
 await writeFile(join(f.root,'.cland/roles.toml'),'[implementer.launch]\npool="agents"\n');
 const ui=await connectUi(t,f.hub.discovery,'cli');
 const table=f.own(new ProcessTable(join(f.root,'.cland/hub.db')));
 let cancelObservation=false,observed:Promise<ReturnType<typeof table.get>>|undefined;
 f.beforeStop(async()=>{cancelObservation=true;await observed?.catch(()=>null);});
 observed=eventually('created OpenCode native receipt persisted',()=>{if(cancelObservation)return null;const row=table.get('created-worker');return row?.status==='running'&&row.pid&&row.harnessSessionId?row:undefined;},SETUP_MS);
 const [worker,launch]=await Promise.all([observed,ui.request({type:'session.launch',name:'created-worker',harness:'opencode',role:'implementer',cwd:home,model:'opencode/fake-paid'},SETUP_MS)]);
 assert.equal(launch.ok,true,launch.error);assert.ok(worker);
 assert.equal(worker.host,record.id);assert.equal(await host.alive(worker),true);
 const listed=await cland(f.root,'host','list');assert.equal(listed.code,0,listed.stderr);
 const row=JSON.parse(listed.stdout)[0];
 for(const [key,value] of Object.entries({id:record.id,pool:'agents',provider:'fake',size:'fake',region:'fake-1',state:'ready',livePerHour:0}))assert.equal(row[key],value);
 assert.ok(row.uptime>=0);
 const stopped=await ui.request({type:'session.stop',session:'created-worker'},SETUP_MS);assert.equal(stopped.ok,true,stopped.error);
 await f.hub.stop();
 assert.equal(f.env.CLAND_FAKE_HOSTS,undefined,'fresh environment has no acquired membership');
 const reopened=await projectHub(t,f.root,f.env);f.stops.push(()=>reopened.stop());
 assert.ok(reopened.hostEnvironment.CLAND_FAKE_HOSTS?.split(',').includes(record.machine.address),'startup restores the durable machine address');
 const registrations=fixtureStore(t,f);
 assert.deepEqual(registrations.hosts.list().map(row=>row.id),[record.id],'no second physical-address registration');
 const reopenedHost=reopened.hostOwner!.hosts.find(row=>row.name===record.id)!;
 await eventually('fresh-daemon host authenticated again',async()=>{try{return (await reopenedHost.statDirectory(home)).refusal===null?true:undefined;}catch{return undefined;}},SETUP_MS);
 assert.equal((await reopenedHost.statDirectory(home)).refusal,null);
});
test('C3 mismatched prelude key never registers or starts a supervisor and releases machine after gate', {timeout:SETUP_MS},async t=>{
 const f=await fixture(t),store=fixtureStore(t,f);
 const provider=new FakeHostProvider({env:f.hub.hostEnvironment});
 const acquire=provider.acquire.bind(provider);
 t.mock.method(provider,'acquire',async (options:Parameters<typeof provider.acquire>[0])=>{const result=await acquire(options);if(result.state==='created')await writeFile(join(hostDirectory(f.root,result.machine.id),'host-key.pub'),'ssh-ed25519 WRONG');return result;});
 const record=await createHost({root:f.root,pool:'agents',env:f.hub.hostEnvironment,records:store.hosts,owner:f.hub.hostOwner!,provider,gateMs:300});
 assert.equal(record.state,'failed');assert.match(record.reason!,/pinned-key.*timed out/);assert.match(record.reason!,/provision command exit=.* signal=/);assert.equal(record.release,'released');
 assert.equal(store.hosts.get(record.id),null);
 assert.ok(!f.hub.hostEnvironment.CLAND_FAKE_HOSTS?.split(',').includes(record.machine!.address),'failed gate never publishes shared membership');
 assert.equal((await provider.status(record.machine!)).state,'gone');
 await assert.rejects(access(join(hostDirectory(f.root,record.machine!.id),'home/.cland-host/run/supervisor.lock/pid')),{code:'ENOENT'});
 assert.equal((await listHosts(store.hosts,f.hub.hostEnvironment))[0]?.state,'failed');
});

for(const [name,receipt] of [
 ['unknown',undefined],
 ['inventory unknown',{inventoryComplete:false,timedOut:false,leftovers:[]}],
 ['timed out',{inventoryComplete:true,timedOut:true,leftovers:[]}],
 ['leftovers',{inventoryComplete:true,timedOut:false,leftovers:[{generation:'held-generation',session:'worker',remaining:['worker'],reason:'held'}]}],
 ['complete',{inventoryComplete:true,timedOut:false,leftovers:[]}],
] as const)test(`failed readiness releases only after positive settlement: ${name}`,{timeout:SETUP_MS},async t=>{
 const f=await fixture(t),store=fixtureStore(t,f);
 const owner=f.hub.hostOwner!,provider=new FakeHostProvider({env:f.hub.hostEnvironment});
 const runtime={...owner,ready:async(id:string,signal?:AbortSignal)=>{await owner.ready(id,signal);throw Error('held readiness failure');},remove:async(id:string)=>{await owner.remove(id);return receipt;}};
 const record=await createHost({root:f.root,pool:'agents',env:f.hub.hostEnvironment,records:store.hosts,owner:runtime,provider});
 assert.equal(record.state,'failed');assert.match(record.reason!,/held readiness failure/);
 assert.equal(record.release,name==='complete'?'released':'incomplete');
 assert.equal((await provider.status(record.machine!)).state,name==='complete'?'gone':'ready');
 assert.equal(store.hosts.provisions.get(record.id)?.release,record.release);
});

for(const action of ['revoke','shutdown'] as const)test(`held final readiness cannot publish ready after ${action}`,{timeout:SETUP_MS},async t=>{
 const f=await fixture(t),store=fixtureStore(t,f);
 const held=holdCreate(t,f,store);await held.reached;assert.equal(held.entered,true,JSON.stringify(held.completed));
 const pending=store.hosts.provisions.list().find(row=>row.state==='cloning')!;assert.ok(pending);
 if(action==='revoke') {
  const ui=await connectUi(t,f.hub.discovery,'cli');const revoked=await ui.request({type:'host.revoke',host:pending.id},SETUP_MS);assert.equal(revoked.ok,true,revoked.error);
  assert.equal(store.hosts.get(pending.id)?.state,'revoked');
 } else held.controller.abort();
 held.gate.resolve();const record=await held.creating;
 assert.equal(record.state,'failed');assert.equal(store.hosts.provisions.get(record.id)?.state,'failed');
 assert.equal(store.hosts.get(record.id)?.state,'revoked','failed readiness never reopens authority');
});

test('forced fixture body failure joins held creation before storage and root disposal',{timeout:SETUP_MS},async t=>{
 let held:ReturnType<typeof holdCreate>|undefined,store:Store|undefined,root:string|undefined,storeClosed=false;
 let emergency:Promise<void>|undefined;
 const drain=()=>emergency??=(async()=>{
  if(held){held.controller.abort();held.gate.resolve();await held.creating.catch(()=>{});}
  if(store&&!storeClosed)store.close();
  if(root&&await access(root).then(()=>true,()=>false)) {
   await cleanupOwnedProcesses(fixtureProcessCensus(root));
   await eventually('emergency fixture native closure',()=>fixtureProcessCensus(root!).filter(p=>p.pid!==process.pid).length===0?true:undefined,testWaitMs());
   await ownDirectory(undefined,root)();
  }
 })();
 onCleanup(t,drain);
 await t.test('scope ends after forced failure with the last readiness gate held',async scope=>{
  const f=await fixture(scope);root=f.root;store=fixtureStore(scope,f);
  const close=store.close.bind(store);
  store.close=()=>{assert.equal(held?.settled??true,true,'storage cannot close before held creation joins');close();storeClosed=true;};
  held=holdCreate(scope,f,store);
  // The negative control preserves the root rather than deleting beneath a live writer.
  guardDirectoryRemoval(root,()=>assert.equal(held?.settled,true,'root cannot be removed before held creation joins'));
  await held.reached;assert.equal(held.entered,true,JSON.stringify(held.completed));
  await assert.rejects(async()=>{throw Error('forced fixture body failure');},/forced fixture body failure/);
  // Return with the gate held: only the registered fixture owner may release/join it.
 });
 const beforeFallback=held?.completed,closedBeforeFallback=storeClosed;
 await drain();
 assert.equal(beforeFallback?.state,'failed','registered cleanup joins the aborted producer');
 assert.equal(closedBeforeFallback,true,'registered cleanup closes storage after that receipt');
 await assert.rejects(access(root!),{code:'ENOENT'});
});
