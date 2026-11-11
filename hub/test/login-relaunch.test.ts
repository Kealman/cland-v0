// T2: renewal success and the real session relaunch owner with in-process adapters.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sessions } from '../src/adapters/sessions.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { HubCore } from '../src/hub/core.ts';
import { localHost } from '../src/host/local.ts';
import { fakeHarness } from './fakes/harness.ts';
import { tempProject } from './harness.ts';
import { beforeDirectories, guardDirectoryRemoval, onCleanup } from './process-cleanup.ts';
import { until, testWaitMs } from './until.ts';
import { FakeClock } from './fake-clock.ts';
import { readHostPools } from '../src/host/pools.ts';
import { prepareExistingLoginSignIn } from '../src/host/login-signin.ts';
import { LoginSnapshots } from '../src/host/login-snapshots.ts';
import type { Host } from '../src/host/host.ts';
import type { HostProvider } from '../src/host/provider/provider.ts';

/** Prearm joins before acquisition; incomplete writers retain storage and the root. */
function relaunchOwners(t: test.TestContext, root: string) {
 const writers: Array<()=>unknown> = [], stores: Array<()=>unknown> = [], pending = new Set<()=>unknown>();
 const add = (list: Array<()=>unknown>, close: ()=>unknown) => { list.push(close); pending.add(close); };
 const close = async () => {
  const errors: unknown[] = [];
  for (const join of [...writers].reverse()) if (pending.has(join)) try { await join(); pending.delete(join); } catch (error) { errors.push(error); }
  if (!writers.some(join=>pending.has(join))) for (const join of [...stores].reverse()) if (pending.has(join)) try { await join(); pending.delete(join); } catch (error) { errors.push(error); }
  if (errors.length) throw new AggregateError(errors, 'relaunch fixture drainage incomplete');
 };
 guardDirectoryRemoval(root,()=>{if(pending.size)throw Error('relaunch fixture root retained');});beforeDirectories(t,close);
 return {writer:(join:()=>unknown)=>add(writers,join),store:(join:()=>unknown)=>add(stores,join),close};
}

for (const outcome of ['disabled','enabled','failed','interrupted'] as const) test(`renewal ${outcome} relaunches only the signed-in host and harness after durable success`, async t => {
 const root=await tempProject(t),owners=relaunchOwners(t,root),clock=new FakeClock();
 const core=new HubCore({clock});owners.store(()=>core.store.close());owners.store(()=>core.close());
 const table=new ProcessTable(':memory:',clock);owners.store(()=>table.close());
 let enabled=false;
 const host={...localHost(),statDirectory:async()=>({refusal:null,identity:null})};
 const sessions=new Sessions({root,core,table,hosts:[host],hostPools:()=>readHostPools({relaunch_after_signin:enabled})});
 owners.writer(()=>sessions.close());
 const codex=fakeHarness('codex',{clock}),other=fakeHarness('opencode',{clock});sessions.register(codex);sessions.register(other);
 const logins=core.store.hosts.logins;logins.useClock(clock);
 const volume={id:'v',name:'disk',project:root,region:'fake-1',sizeGiB:1,created:clock.now().toISOString(),attachedTo:'m'};
 const diskHost={name:'local',loginDisk:async()=>{}} as unknown as Host;
 const provider={listVolumes:async()=>({state:'listed',volumes:[volume]}),snapshotVolume:async()=>({state:'snapshotted',snapshot:{id:'s',volumeId:'v',created:clock.now().toISOString()}})} as unknown as HostProvider;
 const snapshots=new LoginSnapshots({logins,clock,resolve:async()=>({host:diskHost,provider,volume,identity:'local'})});
 owners.writer(()=>snapshots.close());
 const before=[];
 for(const [name,harness] of [['first','codex'],['second','codex'],['other','opencode'],['elsewhere','codex'],['stopped','codex']] as const){
  const row=await sessions.launch({name,harness,cwd:root,role:null,model:null});before.push(table.get(row.name)!);
 }
 await sessions.stop('stopped');codex.stops.length=0;
 table.put({...table.get('elsewhere')!,host:'elsewhere'});
 logins.insert({name:'work',harness:'codex',account:'work',kind:'disk',provider:'fake',region:'fake-1',volumeId:'v',snapshotIds:[],lastSignIn:null});logins.transition('work','ready');logins.bind('work',{host:'local',role:'writer',volumeId:'v'});logins.markSignedOut('work',{reason:'unauthorized',host:'local'});
 let hooks=0;
 const pending=await prepareExistingLoginSignIn({logins,name:'work',host:diskHost,provider,volume,machine:{id:'m',address:'fake',architecture:'x86_64',created:volume.created},identity:'local',clock,snapshots,authorize:()=>{},afterSignIn:async(host,harness)=>{
  hooks++;assert.equal(logins.get('work')?.state,'in-use');assert.ok(logins.get('work')?.lastSignIn);await sessions.relaunchAfterSignIn(host,harness);
 }});
 enabled=outcome!=='disabled'; // the success hook reads the current switch, not preparation's value
 if(outcome==='interrupted')await pending.interrupt!();else await pending.complete(outcome==='failed'?7:0);
 if(outcome==='enabled'){
  assert.equal(hooks,1);assert.deepEqual(codex.resumes.map(r=>r.process.name),['first','second']);
  for(const original of before.slice(0,2)){
   const row=table.get(original.name)!;assert.equal(row.cwd,original.cwd);assert.equal(row.harnessSessionId,original.harnessSessionId);assert.equal(row.sessionId,original.sessionId);assert.equal(row.status,'running');
  }
  await pending.complete(0);assert.equal(hooks,1,'duplicate completion shares the success hook');
 }else {assert.deepEqual(codex.resumes,[]);assert.equal(hooks,outcome==='disabled'?1:0);}
 assert.equal(table.get('stopped')?.status,'stopped');
 assert.deepEqual(other.resumes,[]);assert.deepEqual(codex.stops.map(p=>p.name),outcome==='enabled'?['first','second']:[]);
 assert.deepEqual(table.get('elsewhere'),{...before[3]!,host:'elsewhere'});assert.deepEqual(table.get('other'),before[2]);
});

for (const competitor of ['stop','archive','resume'] as const) test(`sign-in relaunch yields to queued ${competitor} at lifecycle admission`, async t => {
 const root=await tempProject(t),owners=relaunchOwners(t,root),clock=new FakeClock(Date.now());
 const core=new HubCore({clock});owners.store(()=>core.store.close());owners.store(()=>core.close());
 const table=new ProcessTable(':memory:',clock);owners.store(()=>table.close());
 const sessions=new Sessions({root,core,table,hosts:[{...localHost(),statDirectory:async()=>({refusal:null,identity:null})}],hostPools:()=>readHostPools({relaunch_after_signin:true})});
 owners.writer(()=>sessions.close());
 const fake=fakeHarness('codex',{clock});sessions.register(fake);
 const gate=Promise.withResolvers<void>(),entered=Promise.withResolvers<void>();
 onCleanup(t,()=>gate.resolve());
 await sessions.launch({name:'worker',harness:'codex',cwd:root,role:null,model:null});
 const stop=fake.stop.bind(fake);let held=true;
 fake.stop=async(...args)=>{if(held){held=false;entered.resolve();await gate.promise;}return stop(...args);};
 const first=competitor==='resume'?sessions.resume('worker',true):sessions.stop('worker');
 await until(()=>held===false,{what:'competing stop entered its native boundary',timeoutMs:testWaitMs()});
 const archive=competitor==='archive'?sessions.archive('worker','human'):Promise.resolve();
 const automatic=sessions.relaunchAfterSignIn('local','codex');
 await clock.advance(1);gate.resolve();await first;await archive;
 const settled=table.get('worker')!;
 await automatic;
 assert.deepEqual(table.get('worker'),settled);
 assert.equal(fake.resumes.length,competitor==='resume'?1:0);
 assert.equal(fake.stops.length,1);
 assert.equal(table.get('worker')?.status,competitor==='resume'?'running':'stopped');
 assert.equal(!!table.get('worker')?.archivedAt,competitor==='archive');
});

test('relaunch fixture attempts all writer joins and retains storage after incomplete cleanup',async t=>{
 const root=await tempProject(t),owners=relaunchOwners(t,root),events:string[]=[];let fail=true;
 owners.store(()=>{events.push('storage');});owners.writer(()=>{events.push('sessions');});owners.writer(()=>{events.push('snapshots');if(fail)throw Error('held writer');});
 await assert.rejects(owners.close(),/drainage incomplete/);assert.deepEqual(events,['snapshots','sessions']);
 fail=false;await owners.close();assert.deepEqual(events,['snapshots','sessions','snapshots','storage']);
});
test('relaunch fixture setup failure still closes acquired storage',async t=>{
 const root=await tempProject(t),owners=relaunchOwners(t,root),events:string[]=[];
 assert.throws(()=>{owners.store(()=>{events.push('storage');});throw Error('setup rejected');},/setup rejected/);
 await owners.close();assert.deepEqual(events,['storage']);
});
