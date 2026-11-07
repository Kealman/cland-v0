// T3: native SSH, tunnel loss and OpenCode settlement at provider deletion reads.
// Fixture closes the hub and all observed writers before deleting disposable roots.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { writeFile, access } from 'node:fs/promises';
import { fixture } from './host-create-fixture.ts';
import { cland, connectUi, eventually, testWaitMs, flushProjectLogs } from './harness.ts';
import { hostDirectory } from '../../shared/fake-host-directory.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import type { Machine, ReleaseObserver } from '../src/host/provider/provider.ts';
import { FakeHostProvider } from '../src/host/provider/fake.ts';
const SETUP_MS=testWaitMs(60000);
// Twelve sequential setup allowances plus 120s for exact CLI behaviour and joined cleanup.
const OUTER_MS=12*SETUP_MS+120000;
for(const down of [false,true])test(`C1/C2/C3 destroy settles native session after confirming deletion; tunnel down=${down}`,{timeout:OUTER_MS},async t=>{
 const f=await fixture(t);
 const created=await cland(f.root,'host','create','agents');assert.equal(created.code,0,created.stderr);
 const record=JSON.parse(created.stdout);assert.equal(record.state,'ready');
 const fake=hostDirectory(f.root,record.machine.id),home=join(fake,'home');
 const host=f.hub.hostOwner!.hosts.find(h=>h.name===record.id)!;
 await writeFile(join(fake,'ports.json'),JSON.stringify({'12345':join(home,'session.sock')}));
 host.freePort=async()=>12345;
 const spawn=host.spawn.bind(host);
 host.spawn=(command,options)=>spawn({...command,env:{...command.env,FAKE_OPENCODE_HOME:join(home,'native'),FAKE_OPENCODE_SOCKET:join(home,'session.sock'),FAKE_OPENCODE_TURN_MS:'30'}},options);
 const ui=await connectUi(t,f.hub.discovery,'cli');
 const table=f.own(new ProcessTable(join(f.root,'.cland/hub.db')));
 const launch=await ui.request({type:'session.launch',name:'destroy-worker',harness:'opencode',host:record.id,cwd:home,model:'opencode/fake-paid'},SETUP_MS);assert.equal(launch.ok,true,launch.error);
 await eventually('native worker persisted',()=>{const row=table.get('destroy-worker');return row?.status==='running'&&row.pid&&row.harnessSessionId?true:undefined;},SETUP_MS);
 if(down) {
  // Keep the machine/native worker live but make all new transport acquisition fail.
  await writeFile(join(fake,'host-key.pub'),'ssh-ed25519 WRONG');
  await (host as typeof host & {close():Promise<void>}).close();
 }
 const release=FakeHostProvider.prototype.release;
 let held=down;
 t.mock.method(FakeHostProvider.prototype,'release',async function(this:FakeHostProvider,machine:Machine,confirm?:ReleaseObserver){
  if(held) {
   assert.notEqual(table.get('destroy-worker')?.status,'exited','remove without native receipt stays fenced');
   return release.call(new FakeHostProvider({env:f.hub.hostEnvironment,ignoreDelete:true}),machine,confirm);
  }
  return release.call(this,machine,confirm);
 });
 if(down) {
  const first=await cland(f.root,'host','destroy',record.id);assert.equal(first.code,1,first.stderr);
  assert.notEqual(table.get('destroy-worker')?.status,'exited');
  const listed=await cland(f.root,'host','list');assert.match(listed.stdout,/deletion not confirmed/);
  held=false;
 }
 const destroyed=await cland(f.root,'host','destroy',record.id);assert.equal(destroyed.code,0,destroyed.stderr);assert.equal(JSON.parse(destroyed.stdout).state,'destroyed');
 assert.equal(table.get('destroy-worker')?.status,'exited');
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
