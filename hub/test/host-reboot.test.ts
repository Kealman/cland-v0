// T2: authenticated boot evidence retires persisted native generations without native operations.
import { testWaitMs } from './until.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sessions } from '../src/adapters/sessions.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { HubCore } from '../src/hub/core.ts';
import { testHost } from '../src/host/test-host.ts';
import { fakeHarness, FAKE_FLAVOURS } from './fakes/harness.ts';
import { FakeClock } from './fake-clock.ts';
import { tempProject } from './harness.ts';
const oldBoot = '00000000-0000-4000-8000-000000000001';
const newBoot = '00000000-0000-4000-8000-000000000002';
for (const pending of [false, true, 'stopped'] as const) test(`changed boot retires mixed rows and preserves obligations; pending=${pending}`, async t => {
  const root = await tempProject(t), clock = new FakeClock(Date.now()), core = new HubCore({clock});
  const table = new ProcessTable(':memory:',clock), calls: string[] = [], logs: Record<string,unknown>[] = [];
  const hosts = ['local','f1','f2'].map(name=>testHost(name,event=>calls.push(`${name}:${event.operation}`)));
  const rows = [];
  for (const flavour of FAKE_FLAVOURS) {
    const adapter = fakeHarness(flavour,{clock});
    const row = {...await adapter.spawn({name:flavour,cwd:root,role:null,model:null}),host:'f1',pid:process.pid,pidIdentity:`linux:${oldBoot}:123`};
    table.put(row); rows.push(row);
    if (pending === 'stopped') table.update(row.name,{status:'stopped'});
    if (pending === true) table.pendingStop({process:row,error:'cleanup-incomplete: unknown authority',files:{undo:[{kind:'remove',path:'/remote/private'}],children:[]},stages:{stopped:false,rowRemoved:false,roleRolledBack:false}});
  }
  const other = {...rows[0]!,name:'other',sessionId:'other',host:'f2'}; table.put(other);
  const sessions = new Sessions({root,core,table,hosts,recoveryClock:clock,log:entry=>logs.push(entry)});
  for (const flavour of FAKE_FLAVOURS) {
    const adapter = fakeHarness(flavour,{clock});
    adapter.resume = async()=>{throw new Error('unavailable tunnel is not a reboot');};
    adapter.stop = async()=>{throw new Error('native stop forbidden');};
    sessions.register(adapter);
  }
  t.after(async()=>{await sessions.close();table.close();core.close();core.store.close();});
  await sessions.resumeHost('f1',oldBoot);
  assert.equal(table.all().filter(p=>p.status==='exited').length,0);
  await sessions.resumeHost('f1',newBoot);
  await sessions.resumeHost('f1',newBoot); // Repeated readiness must not reset a pending row to stopped.
  for (const row of rows) assert.equal(table.get(row.name)?.status,'exited');
  assert.equal(table.get('other')?.status,'running');
  assert.equal(logs.filter(e=>e.event==='harness-exited'&&e.detail==='host rebooted').length,3);
  assert.equal([...table.retainedHostGenerations('f1')].filter(r=>r.nativeClosure==='confirmed').length,3);
  if (pending === true) {
    await clock.advance(5000);
    assert.equal(table.pendingStops().length,3);
    assert.ok(table.pendingStops().every(e=>e.hostRebooted?.bootId===newBoot&&e.files?.undo.length===1));
  }
  assert.deepEqual(calls,[],'reboot retirement never calls any Host, including local');
});

test('boot readiness during suspended resume fences its stale running result', async t => {
  const { localHost } = await import('../src/host/local.ts');
  const { fixtureEnvironment } = await import('./fixture-environment.ts');
  const { eventually } = await import('./harness.ts');
  const root=await tempProject(t), core=new HubCore(), table=new ProcessTable();
  const entered=Promise.withResolvers<void>(), release=Promise.withResolvers<void>();
  const remote={...testHost('f1',()=>{}),layout:localHost(fixtureEnvironment(root,{})).layout,statDirectory:async()=>({refusal:null,identity:null})};
  const adapter=fakeHarness('codex'), p={...await adapter.spawn({name:'held',cwd:root,role:null,model:null}),host:'f1',pid:123,pidStarted:'123',pidIdentity:`linux:${oldBoot}:123`};
  table.put(p);
  const sessions=new Sessions({root,core,table,hosts:[remote]});
  adapter.resume=async()=>{entered.resolve();await release.promise;return {found:true,process:p,state:'idle'};};
  sessions.register(adapter);
  t.after(async()=>{release.resolve();await sessions.close();table.close();core.close();core.store.close();});
  let inResume=false;void entered.promise.then(()=>{inResume=true;});
  const work=sessions.resumeHost('f1',oldBoot);
  await eventually('suspended native resume',()=>inResume||undefined,testWaitMs());
  const ready=sessions.resumeHost('f1',newBoot);
  assert.equal(ready,work);
  assert.equal(table.get('held')?.status,'exited','reboot proof publishes before held native result');
  release.resolve();await ready;
  assert.equal(table.get('held')?.status,'exited','stale found result cannot resurrect old birth');
  assert.equal([...table.retainedHostGenerations('f1')].length,1);
});

test('stopped reboot retirement streams archived rows and yields after 32 candidates', async t => {
  const root=await tempProject(t),core=new HubCore(),table=new ProcessTable();
  const sessions=new Sessions({root,core,table,hosts:[testHost('f1',()=>assert.fail('no Host operation')),testHost('f2',()=>assert.fail('no Host operation'))]});
  sessions.register(fakeHarness('codex'));
  t.after(async()=>{await sessions.close();table.close();core.close();core.store.close();});
  const base=await fakeHarness('codex').spawn({name:'base',cwd:root,role:null,model:null});
  for(let i=0;i<100;i++)table.put({...base,name:'old-'+i,sessionId:'old-'+i,host:'f1',pid:123,pidIdentity:`linux:${oldBoot}:${i+1}`,status:'stopped',archivedAt:new Date().toISOString()});
  table.put({...base,name:'other',sessionId:'other',host:'f2',status:'stopped',pidIdentity:`linux:${oldBoot}:1`});
  table.put({...base,name:'current',sessionId:'current',host:'f1',status:'stopped',pidIdentity:`linux:${newBoot}:1`});
  let candidates=0;const iterate=table.stoppedOnHost.bind(table);
  table.stoppedOnHost=function*(host){for(const p of iterate(host)){candidates++;yield p;}};
  const firstYield=new Promise<number>(resolve=>setImmediate(()=>resolve(table.all().filter(p=>p.status==='exited').length)));
  const work=sessions.resumeHost('f1',newBoot);
  assert.equal(sessions.resumeHost('f1'),work,'stopped history shares the per-host recovery flight');
  const exitedAtYield=await firstYield;
  assert.equal(candidates,32,'one event-loop slice performs at most 32 stopped candidates');
  assert.ok(exitedAtYield>0&&exitedAtYield<=32,'retirement checkpoints progress before yielding');
  await work;
  assert.equal(table.all().filter(p=>p.status==='exited').length,100);
  assert.equal(table.get('other')?.status,'stopped');assert.equal(table.get('current')?.status,'stopped');
});
