// T2: directory-only provider and public binder/release seams; no native process.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { Store } from '../src/hub/store.ts';
import { LoginBinder } from '../src/host/login-binding.ts';
import { FakeHostProvider } from '../src/host/provider/fake.ts';
import { testHost } from '../src/host/test-host.ts';
import { tempProject } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { onCleanup } from './process-cleanup.ts';
import { FakeClock } from './fake-clock.ts';
import { installLoginRelease, releaseHostLogins } from '../src/host/login-release.ts';
import { projectHub, connectUi, cland, eventually } from './harness.ts';
import { fakeLockProcesses } from './fakes/lock-processes.ts';
import { destroyHost } from '../src/host/provision-host.ts';
import { LOGIN_RELEASE_RETRY_MS } from '../src/host/login-release-owner.ts';
import { LoginSnapshots } from '../src/host/login-snapshots.ts';

async function fixture(t:test.TestContext,exclusive=false) {
 const root=await tempProject(t);await mkdir(join(root,'.cland'),{recursive:true});const store=new Store(join(root,'.cland/hub.db'));
 const teardown=new AsyncDisposableStack();onCleanup(t,()=>teardown.disposeAsync());teardown.defer(()=>store.close());
 const clock=new FakeClock(Date.now());
 const env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root});
 const provider=new FakeHostProvider({env,now:()=>clock.now().getTime()});
 const binder=new LoginBinder(store.hosts.logins);teardown.defer(()=>binder.close());
 const made=await provider.createVolume({project:root,name:'work',region:'fake-1',sizeGiB:1});if(made.state!=='created')throw Error('fixture volume');
 store.hosts.logins.insert({name:'work',kind:'disk',harness:'codex',account:'work',exclusive,provider:'fake',region:'fake-1',volumeId:made.volume.id,snapshotIds:[],lastSignIn:null});store.hosts.logins.transition('work','ready');
 async function host() {
  const acquired=await provider.acquire({project:root,pool:'agents',region:'fake-1',architecture:'x86_64'});if(acquired.state!=='created')throw Error('fixture machine');
  const host={...testHost(acquired.machine.id,()=>{}),loginDisk:async()=>{}};
  return {host,machine:acquired.machine,bind:(owner=binder)=>owner.bind({host,machine:acquired.machine,provider:()=>provider,providerName:'fake',region:'fake-1',pool:'agents',project:root,harness:'codex',account:null,validate:()=>{},checkAccount:()=>{}})};
 }
 const snapshot=async()=>{await clock.advance(120000);const snap=await provider.snapshotVolume(made.volume);if(snap.state!=='snapshotted')throw Error('fixture snapshot: '+JSON.stringify(snap));store.hosts.logins.updateBackup('work',{pending:false},[snap.snapshot.id]);return snap.snapshot;};
 return {root,store,binder,provider,clock,env,own:(join:()=>void|Promise<void>)=>teardown.defer(join),volume:made.volume,host,snapshot};
}

test('lost clone-create response retains ownership across restart and recovers without another allocation',async t=>{
 const f=await fixture(t),a=await f.host(),b=await f.host();await a.bind();await f.snapshot();
 const create=f.provider.createVolume.bind(f.provider);let allocations=0;
 t.mock.method(f.provider,'createVolume',async(options:Parameters<typeof create>[0])=>{allocations++;await create(options);return {state:'failed',reason:'response lost after commit'};});
 await assert.rejects(b.bind());
 const reopened=new Store(join(f.root,'.cland/hub.db')),binder=new LoginBinder(reopened.hosts.logins);
 onCleanup(t,async()=>{await binder.close();reopened.close();});
 await assert.rejects(b.bind(binder));
 assert.equal(allocations,1,'restart must recover the owned allocation before any new create');
 const inventory=await f.provider.listVolumes({project:f.root});assert.equal(inventory.state,'listed');
 if(inventory.state==='listed')assert.deepEqual(inventory.volumes.map(v=>v.id),[f.volume.id]);
});

for(const lost of [false,true])for(const fault of ['delete-response','unbind'] as const)test(`reader release recovers ${fault} failure after restart; lost=${lost}`,async t=>{
 const f=await fixture(t),a=await f.host(),b=await f.host();await a.bind();await f.snapshot();await b.bind();
 const reader=f.store.hosts.logins.bindings('work').find(row=>row.role==='reader')!;
 const hooks={host:(id:string)=>[a,b].find(h=>h.host.name===id)?.host,beginRelease:async()=>{},onReleased:()=>{},notice:()=>{}};
 installLoginRelease(f.store.hosts,hooks);
 const remove=f.provider.deleteVolume.bind(f.provider);
 if(fault==='delete-response'){let lostResponse=true;t.mock.method(f.provider,'deleteVolume',async(volume:Parameters<typeof remove>[0])=>{const receipt=await remove(volume);if(lostResponse){lostResponse=false;throw Error('delete response lost after native commit');}return receipt;});}
 else t.mock.method(f.store.hosts.logins,'unbind',()=>{throw Error('metadata publication failed');});
 const input={records:f.store.hosts,id:b.host.name,root:f.root,provider:f.provider,machine:b.machine,lost};
 if(lost){const finish=await releaseHostLogins(input);await f.provider.release(b.machine);await assert.rejects(finish());}
 else await assert.rejects(releaseHostLogins(input));
 assert.equal(f.store.hosts.logins.bindings('work').length,2,'failed publication retains ownership');
 const reopened=new Store(join(f.root,'.cland/hub.db'));onCleanup(t,()=>reopened.close());installLoginRelease(reopened.hosts,hooks);
 b.host.loginDisk=async()=>{throw Error('restart must not replay confirmed unmount');};
 const finish=await releaseHostLogins({...input,records:reopened.hosts});await finish();
 assert.equal(reopened.hosts.logins.bindings('work').length,1);
 const inventory=await f.provider.listVolumes({project:f.root});assert.equal(inventory.state,'listed');
 if(inventory.state==='listed')assert.equal(inventory.volumes.some(v=>v.id===reader.volumeId),false);
});

test('forced fixture failure joins a held reader creation before storage closes',async t=>{
 const gate=Promise.withResolvers<void>();let work:Promise<unknown>|undefined,settled=false,closed=false,entered=false;
 await t.test('scope ends with admitted reader creation held',async scope=>{
  const f=await fixture(scope),a=await f.host(),b=await f.host();await a.bind();await f.snapshot();
  const stop=f.binder.close.bind(f.binder);f.binder.close=()=>{const joining=stop();gate.resolve();return joining;};
  const close=f.store.close.bind(f.store);f.store.close=()=>{assert.equal(settled,true,'join precedes SQLite close');close();closed=true;};
  const create=f.provider.createVolume.bind(f.provider);
  scope.mock.method(f.provider,'createVolume',async(options:Parameters<typeof create>[0])=>{entered=true;await gate.promise;return create(options);});
  work=b.bind().catch(()=>{}).finally(()=>{settled=true;});
  await eventually('reader creation admitted',()=>entered?true:undefined);
  await assert.rejects(async()=>{throw Error('forced body failure');},/forced body failure/);
 });
 assert.equal(settled,true);assert.equal(closed,true);
});

for(const fault of ['before','after'] as const)test(`failed reader binding publication ${fault} its write cleans its captured clone`,async t=>{
 const f=await fixture(t),a=await f.host(),b=await f.host();await a.bind();await f.snapshot();
 if(fault==='before')t.mock.method(f.store.hosts.logins,'bindReader',()=>{throw Error('binding checkpoint failed');});
 else {const bind=f.store.hosts.logins.bind.bind(f.store.hosts.logins);t.mock.method(f.store.hosts.logins,'bind',(...args:Parameters<typeof bind>)=>{bind(...args);throw Error('binding checkpoint failed');});}
 await assert.rejects(b.bind(),/binding checkpoint failed/);
 const inventory=await f.provider.listVolumes({project:f.root});assert.equal(inventory.state,'listed');
 if(inventory.state==='listed')assert.deepEqual(inventory.volumes.map(v=>v.id),[f.volume.id]);
 assert.equal(f.store.hosts.logins.bindings('work').length,1);
});

test('unknown create without inventory receipt stays fenced rather than allocating again',async t=>{
 const f=await fixture(t),a=await f.host(),b=await f.host();await a.bind();await f.snapshot();let sends=0;
 t.mock.method(f.provider,'createVolume',async()=>{sends++;return {state:'failed',reason:'unknown create outcome'};});
 await assert.rejects(b.bind());await assert.rejects(b.bind(),/outcome unknown/);
 assert.equal(sends,1);assert.equal(f.store.hosts.logins.hasPendingBinding('work'),true);
 f.store.hosts.logins.unbind('work',a.host.name);
 const c=await f.host();await assert.rejects(c.bind(),/no login codex/);
 assert.throws(()=>f.store.hosts.logins.setExclusive('work',true),/outcome unknown/);
});

test('confirmed clone-create refusal permits retry without an unknown-outcome fence',async t=>{
 const f=await fixture(t),a=await f.host(),b=await f.host();await a.bind();await f.snapshot();
 const create=f.provider.createVolume.bind(f.provider);let first=true;
 t.mock.method(f.provider,'createVolume',async(options:Parameters<typeof create>[0])=>{if(first){first=false;return {state:'refused',reason:'fixture rate refusal'};}return create(options);});
 await assert.rejects(b.bind());assert.equal(f.store.hosts.logins.hasPendingBinding('work'),false);
 await b.bind();assert.equal(f.store.hosts.logins.bindings('work').length,2);
});

test('host release recovers an unbound create intent retained after lost response',async t=>{
 const f=await fixture(t),a=await f.host(),b=await f.host();await a.bind();await f.snapshot();
 const create=f.provider.createVolume.bind(f.provider);
 t.mock.method(f.provider,'createVolume',async(options:Parameters<typeof create>[0])=>{await create(options);throw Error('lost create response');});
 await assert.rejects(b.bind());
 assert.ok(f.store.hosts.logins.boundHosts('',64).includes(b.host.name),'restart discovery includes unbound intent');
 await releaseHostLogins({records:f.store.hosts,id:b.host.name,root:f.root,provider:f.provider,machine:b.machine});
 const inventory=await f.provider.listVolumes({project:f.root});assert.equal(inventory.state,'listed');
 if(inventory.state==='listed')assert.deepEqual(inventory.volumes.map(v=>v.id),[f.volume.id]);
 assert.equal(f.store.hosts.logins.readerForHost(b.host.name,'codex'),null);
});

for(const state of ['destroying','destroyed'] as const)test(`installed owner recovers an unbound reader on ${state} host after reopen`,async t=>{
 const f=await fixture(t),a=await f.host(),b=await f.host();await a.bind();await f.snapshot();
 const create=f.provider.createVolume.bind(f.provider);
 t.mock.method(f.provider,'createVolume',async(options:Parameters<typeof create>[0])=>{await create(options);throw Error('create response lost');});
 await assert.rejects(b.bind());
 f.store.hosts.insert({id:b.host.name,address:b.machine.address,user:'fixture',clientKeyPath:'unused',knownHosts:'unused'},'sentinel');
 f.store.hosts.provisions.ready({id:b.host.name,pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:b.machine.created,state:'ready',machine:b.machine});
 const nativeOwner={hosts:[b.host],remove:async()=>({inventoryComplete:true,timedOut:false,leftovers:[]})} as unknown as Parameters<typeof destroyHost>[0]['owner'];
 const originalInput={root:f.root,id:b.host.name,env:f.env,clock:f.clock,provider:f.provider,records:f.store.hosts,owner:nativeOwner,log:()=>{}};
 let held=true,retries=0;const remove=f.provider.deleteVolume.bind(f.provider);
 t.mock.method(f.provider,'deleteVolume',async(volume:Parameters<typeof remove>[0])=>held?{state:'incomplete',reason:'held deletion'}:remove(volume));
 const prior=installLoginRelease(f.store.hosts,{clock:f.clock,retry:()=>{retries++;return destroyHost(originalInput);},host:()=>b.host,beginRelease:async()=>{},onReleased:()=>{},notice:()=>{}});f.own(()=>prior.close());
 assert.equal((await destroyHost(originalInput)).release,'incomplete');
 await f.clock.advance(LOGIN_RELEASE_RETRY_MS);await prior.close();assert.ok(retries>0,'failed unbound cleanup owns an automatic retry');
 held=false;
 if(state==='destroyed'){await f.provider.release(b.machine);f.store.hosts.provisions.save({...f.store.hosts.provisions.get(b.host.name)!,state:'destroyed'});}
 const reopened=new Store(join(f.root,'.cland/hub.db'));f.own(()=>reopened.close());
 const input={root:f.root,id:b.host.name,env:f.env,clock:f.clock,provider:f.provider,records:reopened.hosts,owner:{hosts:[b.host],remove:async()=>({inventoryComplete:true,timedOut:false,leftovers:[]})} as unknown as Parameters<typeof destroyHost>[0]['owner'],log:()=>{}};
 const owner=installLoginRelease(reopened.hosts,{clock:f.clock,retry:()=>destroyHost(input),host:()=>b.host,beginRelease:async()=>{},onReleased:()=>{},notice:()=>{}});f.own(()=>owner.close());
 await f.clock.advance(LOGIN_RELEASE_RETRY_MS);await owner.close();
 assert.equal(reopened.hosts.logins.readerForHost(b.host.name,'codex'),null,'installed retry completed owned cleanup');
 assert.equal(reopened.hosts.provisions.get(b.host.name)?.state,'destroyed');
 const inventory=await f.provider.listVolumes({project:f.root});assert.equal(inventory.state,'listed');
 if(inventory.state==='listed')assert.deepEqual(inventory.volumes.map(v=>v.id),[f.volume.id]);
});

test('missing reader volume without a deletion intent retains binding ownership',async t=>{
 const f=await fixture(t),a=await f.host(),b=await f.host();await a.bind();await f.snapshot();await b.bind();
 installLoginRelease(f.store.hosts,{host:id=>[a,b].find(h=>h.host.name===id)?.host,beginRelease:async()=>{},onReleased:()=>{},notice:()=>{}});
 t.mock.method(f.provider,'listVolumes',async()=>({state:'listed',volumes:[f.volume]}));
 await assert.rejects(releaseHostLogins({records:f.store.hosts,id:b.host.name,root:f.root,provider:f.provider,machine:b.machine}));
 assert.equal(f.store.hosts.logins.bindings('work').length,2);
});

test('deleting intent with an omitted but existing clone still requires exact provider deletion',async t=>{
 const f=await fixture(t),a=await f.host(),b=await f.host();await a.bind();await f.snapshot();await b.bind();
 installLoginRelease(f.store.hosts,{host:id=>[a,b].find(h=>h.host.name===id)?.host,beginRelease:async()=>{},onReleased:()=>{},notice:()=>{}});
 t.mock.method(f.provider,'deleteVolume',async()=>({state:'incomplete',reason:'exact provider deletion unconfirmed'}));
 const input={records:f.store.hosts,id:b.host.name,root:f.root,provider:f.provider,machine:b.machine};
 await assert.rejects(releaseHostLogins(input));
 t.mock.method(f.provider,'listVolumes',async()=>({state:'listed',volumes:[f.volume]}));
 await assert.rejects(releaseHostLogins(input),'inventory omission must not settle deletion');
 assert.equal(f.store.hosts.logins.bindings('work').length,2);
});

for(const route of ['binder','unbound-release'] as const)test(`final reader ${route} recovery clears snapshot release and resumes pending backup`,async t=>{
 const f=await fixture(t),a=await f.host(),b=await f.host();await a.bind();await f.snapshot();await b.bind();
 const scheduler=new LoginSnapshots({logins:f.store.hosts.logins,clock:f.clock,resolve:async row=>{const listed=await f.provider.listVolumes({project:f.root});if(listed.state!=='listed')throw Error('fixture inventory');const volume=listed.volumes.find(v=>v.id===row.volumeId);if(!volume)throw Error('fixture original volume');return {provider:f.provider,volume};}});f.own(()=>scheduler.close());
 const owner=installLoginRelease(f.store.hosts,{clock:f.clock,host:id=>[a,b].find(h=>h.host.name===id)?.host,beginRelease:(name,options)=>scheduler.beginRelease(name,options),onReleased:(name,receipt)=>scheduler.onReleased(name,receipt),notice:()=>{}});f.own(()=>owner.close());
 const unbind=f.store.hosts.logins.unbind.bind(f.store.hosts.logins);let fail=true;
 t.mock.method(f.store.hosts.logins,'unbind',(name:string,host:string)=>{if(host===b.host.name&&fail){fail=false;throw Error('unbind publication failed');}unbind(name,host);});
 const input=(h:typeof a)=>({records:f.store.hosts,id:h.host.name,root:f.root,provider:f.provider,machine:h.machine});
 await assert.rejects(releaseHostLogins(input(b)));await releaseHostLogins(input(a));
 const before=f.store.hosts.logins.get('work');assert.ok(before?.kind==='disk'&&before.backup?.releasing);
 await f.clock.advance(120000);
 f.store.hosts.logins.updateBackup('work',{...before.backup,pending:true,lastAt:new Date(f.clock.now().getTime()-86400000).toISOString()});
 if(route==='binder')await assert.rejects(b.bind(),/previous reader allocation recovered/);
 else {unbind('work',b.host.name);await releaseHostLogins(input(b));}
 const released=f.store.hosts.logins.get('work');assert.ok(released?.kind==='disk');assert.equal(released.backup?.releasing,false);
 await f.clock.advance(1);
 await eventually('pending backup durably completed after final-reader release',()=>{const row=f.store.hosts.logins.get('work');return row?.kind==='disk'&&row.backup?.pending===false&&row.backup.lastAt===f.clock.now().toISOString()?true:undefined;});
});

test('non-exclusive login binds a writer and a reader cloned from its latest snapshot',async t=>{
 const f=await fixture(t),a=await f.host(),b=await f.host();
 await a.bind();await f.snapshot();const latest=await f.snapshot();
 let source:unknown;const create=f.provider.createVolume.bind(f.provider);
 t.mock.method(f.provider,'createVolume',async (options:Parameters<typeof create>[0])=>{source=options.fromSnapshot;return create(options);});
 await b.bind();
 const bindings=f.store.hosts.logins.bindings('work');
 assert.equal(bindings.find(row=>row.host===a.machine.id)?.role,'writer');
 const reader=bindings.find(row=>row.host===b.machine.id)!;assert.equal(reader.role,'reader');assert.notEqual(reader.volumeId,f.volume.id);
 assert.equal(typeof source==='string'?source:(source as {id:string}).id,latest.id);
 const inventory=await f.provider.listVolumes({project:f.root});assert.equal(inventory.state,'listed');
 if(inventory.state==='listed')assert.equal(inventory.volumes.find(v=>v.id===reader.volumeId)?.attachedTo,b.machine.id);
});

test('reader release deletes its clone before removing the binding, retaining the writer',async t=>{
 const f=await fixture(t),a=await f.host(),b=await f.host();await a.bind();await f.snapshot();await b.bind();
 const reader=f.store.hosts.logins.bindings('work').find(row=>row.role==='reader')!;
 installLoginRelease(f.store.hosts,{host:id=>[a,b].find(h=>h.host.name===id)?.host,beginRelease:async()=>{},onReleased:()=>{},notice:()=>{}});
 await releaseHostLogins({records:f.store.hosts,id:b.host.name,root:f.root,provider:f.provider,machine:b.machine});
 const inventory=await f.provider.listVolumes({project:f.root});assert.equal(inventory.state,'listed');
 if(inventory.state==='listed'){assert.equal(inventory.volumes.some(v=>v.id===reader.volumeId),false);assert.equal(inventory.volumes.find(v=>v.id===f.volume.id)?.attachedTo,a.machine.id);}
 assert.deepEqual(f.store.hosts.logins.bindings('work').map(row=>row.role),['writer']);
});

test('local login set CLI changes idle disks and refuses an in-use disk; list shows every host',async t=>{
 const f=await fixture(t),hub=await projectHub(t,f.root,{}, {clock:new FakeClock(Date.now()),processes:fakeLockProcesses().processes,droplet:{processes:fakeLockProcesses().processes}});
 const changed=await cland(f.root,'login','set','work','--exclusive','false');assert.equal(changed.code,0,changed.stderr);
 const ui=await connectUi(t,hub.discovery,'cli');
 const a=await f.host(),b=await f.host();await a.bind();await f.snapshot();await b.bind();
 for(const value of ['true','false']){const refused=await cland(f.root,'login','set','work','--exclusive',value);assert.equal(refused.code,1);assert.match(refused.stderr,/in-use/);}
 const list=await ui.request({type:'login.list'});assert.equal(list.ok,true,list.error);
 assert.deepEqual((list.value as Array<{bindings:Array<{host:string}>}>)[0]!.bindings.map(row=>row.host).sort(),[a.host.name,b.host.name].sort());
});

test('exclusive login refuses a second host and attached-elsewhere refusal preserves metadata',async t=>{
 const f=await fixture(t,true),a=await f.host(),b=await f.host();await a.bind();
 await assert.rejects(b.bind(),/no login codex in pool agents/);
 const g=await fixture(t,true),c=await g.host(),before=g.store.hosts.logins.get('work');
 t.mock.method(g.provider,'attachVolume',async()=>({state:'refused',reason:'attached elsewhere'}));
 await assert.rejects(c.bind(),/attachment refused.*attached elsewhere/);
 assert.deepEqual(g.store.hosts.logins.get('work'),before);assert.deepEqual(g.store.hosts.logins.bindings('work'),[]);
});

test('reader without snapshot refuses naming the login and missing snapshot',async t=>{
 const f=await fixture(t),a=await f.host(),b=await f.host();await a.bind();
 await assert.rejects(b.bind(),/login work: missing snapshot/);
 assert.equal(f.store.hosts.logins.bindings('work').length,1);
});

test('reader deletion without a receipt retains the binding until confirmed',async t=>{
 const f=await fixture(t),a=await f.host(),b=await f.host();await a.bind();await f.snapshot();await b.bind();
 installLoginRelease(f.store.hosts,{host:id=>[a,b].find(h=>h.host.name===id)?.host,beginRelease:async()=>{},onReleased:()=>{},notice:()=>{}});
 const remove=f.provider.deleteVolume.bind(f.provider);let held=true;
 t.mock.method(f.provider,'deleteVolume',async (volume:Parameters<typeof remove>[0])=>held?{state:'incomplete',reason:'fixture missing receipt'}:remove(volume));
 const input={records:f.store.hosts,id:b.host.name,root:f.root,provider:f.provider,machine:b.machine};
 await assert.rejects(releaseHostLogins(input),/release unconfirmed/);assert.equal(f.store.hosts.logins.bindings('work').length,2);
 held=false;await releaseHostLogins(input);assert.equal(f.store.hosts.logins.bindings('work').length,1);
});

test('lost reader host deletes its clone only after detached inventory',async t=>{
 const f=await fixture(t),a=await f.host(),b=await f.host();await a.bind();await f.snapshot();await b.bind();
 const reader=f.store.hosts.logins.bindings('work').find(row=>row.role==='reader')!;
 b.host.loginDisk=async()=>{throw Error('lost host must receive no native operation');};
 installLoginRelease(f.store.hosts,{host:id=>[a,b].find(h=>h.host.name===id)?.host,beginRelease:async()=>{},onReleased:()=>{},notice:()=>{}});
 const finish=await releaseHostLogins({records:f.store.hosts,id:b.host.name,root:f.root,provider:f.provider,machine:b.machine,lost:true});
 await assert.rejects(finish(),/detach unconfirmed/);assert.equal(f.store.hosts.logins.bindings('work').length,2);
 assert.equal((await f.provider.release(b.machine)).state,'released');await finish();
 const inventory=await f.provider.listVolumes({project:f.root});assert.equal(inventory.state,'listed');
 if(inventory.state==='listed')assert.equal(inventory.volumes.some(v=>v.id===reader.volumeId),false);
 assert.equal(f.store.hosts.logins.bindings('work').length,1);
});
