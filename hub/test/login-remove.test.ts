// T2: local human socket and directory-only fake provider; no native host process.
import './cover-quiet.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../src/hub/store.ts';
import {onCleanup} from './process-cleanup.ts';
import {mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {projectHub, connectUi, tempProject, eventually, cland} from './harness.ts';
import {FakeClock} from './fake-clock.ts';
import {fakeLockProcesses} from './fakes/lock-processes.ts';
import {writeLoginKey} from '../src/host/login-keys.ts';
import {readSecretsFile} from '../src/remote/secrets.ts';

test('remove key deletes only its encrypted file and metadata, retaining the auth store key',async t=>{
 const root=await tempProject(t);
 const hub=await projectHub(t,root,{}, {clock:new FakeClock(Date.now()),processes:fakeLockProcesses().processes,droplet:{processes:fakeLockProcesses().processes}});
 writeLoginKey(root,'sentinel-project','work','SENTINEL-remove-key');
 const auth=readSecretsFile(root)['auth.key'];
 const store=new Store(join(root,'.cland/hub.db'));onCleanup(t,()=>store.close());
 const rows=store.hosts.logins;
 rows.insert({name:'work',kind:'key',harness:'opencode',account:'work',lastSignIn:null});rows.transition('work','ready');
 const ui=await connectUi(t,hub.discovery,'cli');
 const reply=await ui.request({type:'login.remove',name:'work'});
 assert.equal(reply.ok,true,reply.error);
 assert.equal(existsSync(join(root,'.cland/auth/work.key')),false);
 assert.equal(rows.get('work'),null);
 assert.equal(readSecretsFile(root)['auth.key'],auth);
});

import {FakeHostProvider} from '../src/host/provider/fake.ts';
import {fixtureEnvironment} from './fixture-environment.ts';
import {removeLogin} from '../src/host/login-remove.ts';
import {LoginSnapshots} from '../src/host/login-snapshots.ts';
import {readHostPools} from '../src/host/pools.ts';
import {hostStatus} from '../src/host/status.ts';

async function diskFixture(t:test.TestContext,ignoreVolumeDelete=false,providerName='digitalocean') {
 const root=await tempProject(t);await mkdir(join(root,'.cland'));const resources=new AsyncDisposableStack();onCleanup(t,()=>resources.disposeAsync());const store=new Store(join(root,'.cland/hub.db'));
 resources.defer(()=>store.close());
 const clock=new FakeClock(Date.now()),rows=store.hosts.logins;rows.useClock(clock);
 const env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root});
 const provider=new FakeHostProvider({env,now:()=>clock.now().getTime(),ignoreVolumeDelete});
 const made=await provider.createVolume({project:root,name:'work',region:'fake-1',sizeGiB:1});assert.equal(made.state,'created');if(made.state!=='created')throw Error('fixture volume');
 rows.insert({name:'work',harness:'codex',kind:'disk',account:'work',provider:providerName,region:'fake-1',volumeId:made.volume.id,snapshotIds:[],lastSignIn:null});
 rows.recordStorage('work','agents',{kind:'volume',id:made.volume.id,sizeGiB:1,created:made.volume.created,deleted:null});
 const ids:string[]=[];
 for(let n=0;n<2;n++){await clock.advance(120000);const snap=await provider.snapshotVolume(made.volume);assert.equal(snap.state,'snapshotted');if(snap.state!=='snapshotted')throw Error('fixture snapshot');ids.push(snap.snapshot.id);rows.recordStorage('work','agents',{kind:'snapshot',id:snap.snapshot.id,sizeGiB:1,created:snap.snapshot.created,deleted:null});}
 rows.updateBackup('work',{pending:false},ids);rows.markSignedOut('work',{reason:'fixture sign-in incomplete',host:null});
 const snapshots=new LoginSnapshots({logins:rows,clock,resolve:async()=>({provider,volume:made.volume})});resources.defer(()=>snapshots.close());
 const remove=()=>removeLogin({root,logins:rows,provider:()=>provider,snapshots},'work');
 return {root,store,rows,provider,clock,env,ids,volume:made.volume,remove,dispose:()=>resources.disposeAsync(),own:(cleanup:()=>void|Promise<void>)=>resources.defer(cleanup)};
}

test('in-use and creating refusals retain every byte and name the host or running sign-in',async t=>{
 const f=await diskFixture(t);
 // A signed-out login must sign in before it can bind again.
 f.rows.transition('work','creating');
 await assert.rejects(f.remove(),/work.*sign-in.*running/);
 f.rows.transition('work','ready');f.rows.bind('work',{host:'host-sentinel',role:'writer',volumeId:f.volume.id});
 const before=f.rows.get('work');
 await assert.rejects(f.remove(),/host-sentinel/);assert.deepEqual(f.rows.get('work'),before);
 assert.equal((await f.provider.getSnapshot(f.ids[0]!)).state,'found');
 // Host release returns ready; removal records the shared signed-out receipt.
 f.rows.unbind('work','host-sentinel');
 await f.remove();assert.equal(f.rows.get('work'),null);
 assert.deepEqual(await f.provider.listVolumes({project:f.root}),{state:'listed',volumes:[]});
 for(const id of f.ids)assert.equal((await f.provider.getSnapshot(id)).state,'failed');
});

test('unconfirmed volume delete retains exact id and storage accrual, retry completes after restart',async t=>{
 const f=await diskFixture(t,true);
 await assert.rejects(f.remove(),new RegExp(f.volume.id));
 const row=f.rows.get('work');assert.ok(row?.kind==='disk');assert.equal(row.volumeId,f.volume.id);assert.deepEqual(row.snapshotIds,[]);
 assert.deepEqual(row.storage!.items.map(i=>[i.kind,i.deleted!==null]),[['volume',false],['snapshot',true],['snapshot',true]]);
 const cost=async()=> (await hostStatus(f.store.hosts,readHostPools(undefined),[],f.env,f.clock,f.root)).pools.find(p=>p.name==='agents')!.spend.month!;
 const before=await cost();await f.clock.advance(3600000);const after=await cost();assert.ok(after>before);
 const month=f.clock.now().toISOString().slice(0,7),start=Date.parse(month+'-01T00:00:00Z'),end=new Date(start);end.setUTCMonth(end.getUTCMonth()+1);
 assert.ok(Math.abs(after-before-0.1*3600000/(end.getTime()-start))<1e-10,'only the 1 GiB volume keeps accruing');
 const reopened=new Store(join(f.root,'.cland/hub.db'));f.own(()=>reopened.close());
 assert.throws(()=>reopened.hosts.logins.transition('work','creating'),/removal in progress/);
 const provider=new FakeHostProvider({env:f.env,now:()=>f.clock.now().getTime()});
 await removeLogin({root:f.root,logins:reopened.hosts.logins,provider:()=>provider,snapshots:{beginRemoval:async()=>{}}},'work');
 assert.equal(f.rows.get('work'),null);
 assert.equal((await hostStatus(f.store.hosts,readHostPools(undefined),[],f.env,f.clock,f.root)).pools.length,0);
});

test('a lost volume-delete response retries from its captured identity after the volume disappears',async t=>{
 const f=await diskFixture(t);
 const remove=f.provider.deleteVolume.bind(f.provider);let lost=true;
 t.mock.method(f.provider,'deleteVolume',async (volume:Parameters<typeof remove>[0])=>{const result=await remove(volume);if(lost){lost=false;throw Error('lost response after deletion');}return result;});
 await assert.rejects(f.remove(),new RegExp(f.volume.id));
 assert.deepEqual(await f.provider.listVolumes({project:f.root}),{state:'listed',volumes:[]});
 await f.remove();assert.equal(f.rows.get('work'),null);
});

test('concurrent disk removals join one deletion owner',async t=>{
 const f=await diskFixture(t),gate=Promise.withResolvers<void>();let entered=false;
 const original=f.provider.deleteVolume.bind(f.provider);let sends=0;
 t.mock.method(f.provider,'deleteVolume',async(volume:Parameters<typeof original>[0])=>{sends++;entered=true;await gate.promise;return original(volume);});
 const first=f.remove();const second=f.remove();
 f.own(async()=>{gate.resolve();await Promise.allSettled([first,second]);});
 try {await eventually('volume deletion admitted',()=>entered?true:undefined);assert.equal(sends,1);}finally{gate.resolve();}
 assert.deepEqual(await Promise.all([first,second]),[{removed:'work'},{removed:'work'}]);assert.equal(sends,1);
});

test('pending reader intent refuses removal without clearing its owner fence',async t=>{
 const f=await diskFixture(t);
 const machine=await f.provider.acquire({project:f.root,pool:'agents',region:'fake-1',architecture:'x86_64'});assert.equal(machine.state,'created');if(machine.state!=='created')throw Error('fixture machine');
 // beginReader requires a shared disk; reserve before native allocation.
 f.rows.setExclusive('work',false);
 f.rows.beginReader({login:'work',host:machine.machine.id,harness:'codex',provider:'digitalocean',project:f.root,pool:'agents',region:'fake-1',machine:machine.machine,name:'reader-sentinel',snapshot:f.ids[0]!,phase:'creating'});
 await assert.rejects(f.remove(),/pending binding outcome unknown/);
 assert.equal(f.rows.readerOperation('work',machine.machine.id)?.phase,'creating');assert.equal(f.rows.get('work')?.state,'signed-out');
});

test('remove CLI refuses a bound login, then removes ready storage and leaves list after release',async t=>{
 const f=await diskFixture(t,false,'fake');
 await projectHub(t,f.root,f.env,{clock:f.clock,processes:fakeLockProcesses().processes,droplet:{processes:fakeLockProcesses().processes}});
 f.rows.transition('work','creating');f.rows.transition('work','ready');
 f.rows.bind('work',{host:'stopped-host-sentinel',role:'writer',volumeId:f.volume.id});
 const refused=await cland(f.root,'login','remove','work');assert.equal(refused.code,1);assert.match(refused.stderr,/stopped-host-sentinel/);
 f.rows.unbind('work','stopped-host-sentinel');
 const removed=await cland(f.root,'login','remove','work');assert.equal(removed.code,0,removed.stderr);
 const listed=await cland(f.root,'login','list','--json');assert.equal(listed.code,0,listed.stderr);assert.deepEqual(JSON.parse(listed.stdout),[]);
 for(const id of f.ids)assert.equal((await f.provider.getSnapshot(id)).state,'failed');
 assert.deepEqual(await f.provider.listVolumes({project:f.root}),{state:'listed',volumes:[]});
 const help=await cland(f.root,'login','remove','--help');assert.equal(help.code,0);assert.match(help.stdout,/login remove <name>/);
});

test('removal joins an accepted snapshot and deletes its retained receipt before the row',async t=>{
 const f=await diskFixture(t);f.rows.transition('work','creating');f.rows.transition('work','ready');await f.clock.advance(120000);
 const gate=Promise.withResolvers<void>();let accepted=false,settled=false;
 const original=f.provider.snapshotVolume.bind(f.provider);
 t.mock.method(f.provider,'snapshotVolume',async(...args:Parameters<typeof original>)=>{const result=await original(...args);accepted=true;await gate.promise;settled=true;return result;});
 const snapshots=new LoginSnapshots({logins:f.rows,clock:f.clock,resolve:async()=>({provider:f.provider,volume:f.volume})});
 f.own(()=>snapshots.close());
 const snapshot=snapshots.snapshot('work');void snapshot.catch(()=>{});
 f.own(async()=>{gate.resolve();await snapshot.catch(()=>{});});
 await eventually('snapshot provider has accepted the write',()=>accepted?true:undefined);
 const deletion=f.provider.deleteSnapshot.bind(f.provider);
 t.mock.method(f.provider,'deleteSnapshot',async(...args:Parameters<typeof deletion>)=>{assert.equal(settled,true,'accepted snapshot joined before deleting any disk storage');return deletion(...args);});
 const removal=removeLogin({root:f.root,logins:f.rows,provider:()=>f.provider,snapshots},'work');
 f.own(async()=>{gate.resolve();await removal.catch(()=>{});});
 assert.equal(f.rows.get('work')?.signedOut?.reason,'removing');gate.resolve();
 await removal;assert.equal(f.rows.get('work'),null);
});

for(const reopen of [false,true])test(`unknown snapshot keeps removal fenced through retry and reconciliation; reopen=${reopen}`,async t=>{
 const f=await diskFixture(t);f.rows.transition('work','creating');f.rows.transition('work','ready');await f.clock.advance(120000);
 const gate=Promise.withResolvers<void>();let accepted:string|undefined;
 const original=f.provider.snapshotVolume.bind(f.provider);
 t.mock.method(f.provider,'snapshotVolume',async(...args:Parameters<typeof original>)=>{const result=await original(...args);assert.equal(result.state,'snapshotted');if(result.state!=='snapshotted')throw Error('fixture snapshot');accepted=result.snapshot.id;await gate.promise;throw Error('lost snapshot reply after provider commit');});
 const snapshots=new LoginSnapshots({logins:f.rows,clock:f.clock,resolve:async()=>({provider:f.provider,volume:f.volume})});f.own(()=>snapshots.close());
 const snapshot=snapshots.snapshot('work');void snapshot.catch(()=>{});f.own(async()=>{gate.resolve();await snapshot.catch(()=>{});});
 await eventually('snapshot provider has committed',()=>accepted?true:undefined);
 const remove=(logins=f.rows,owner=snapshots)=>removeLogin({root:f.root,logins,provider:()=>f.provider,snapshots:owner},'work');
 const first=remove();f.own(async()=>{gate.resolve();await first.catch(()=>{});});gate.resolve();
 await assert.rejects(first,/snapshot.*reconciliation/);
 let rows=f.rows,owner=snapshots;
 if(reopen){await snapshots.close();const next=new Store(join(f.root,'.cland/hub.db'));f.own(()=>next.close());rows=next.hosts.logins;owner=new LoginSnapshots({logins:rows,clock:f.clock,resolve:async()=>({provider:f.provider,volume:f.volume})});f.own(()=>owner.close());}
 await assert.rejects(remove(rows,owner),/snapshot.*reconciliation/);
 assert.ok(rows.get('work'),'unknown snapshot retains the login row');
 const inventory=await f.provider.listVolumes({project:f.root});assert.ok(inventory.state==='listed'&&inventory.volumes.some(v=>v.id===f.volume.id));
 const receipt=await f.provider.getSnapshot(accepted!);assert.ok(receipt.state==='found');
 // Only the snapshot owner can settle its captured admission, with a positive receipt.
 rows.settleSnapshotAdmission('work',{state:'snapshotted',snapshot:receipt.snapshot},f.volume);
 await remove(rows,owner);assert.equal(rows.get('work'),null);assert.equal((await f.provider.getSnapshot(accepted!)).state,'failed');
});

test('forced fixture failure releases held writers and joins them before storage closes',async t=>{
 const f=await diskFixture(t),gate=Promise.withResolvers<void>();let entered=false,settled=false,closed=false;
 const original=f.provider.deleteVolume.bind(f.provider);
 t.mock.method(f.provider,'deleteVolume',async(...args:Parameters<typeof original>)=>{entered=true;await gate.promise;try{return await original(...args);}finally{settled=true;}});
 const close=f.store.close.bind(f.store);
 t.mock.method(f.store,'close',()=>{assert.equal(settled,true,'provider writer joined before SQLite close');close();closed=true;});
 const removal=f.remove();f.own(async()=>{gate.resolve();await removal;});
 await eventually('held volume writer admitted',()=>entered?true:undefined);
 let disposed=false;
 const failed=(async()=>{try{throw Error('forced fixture failure');}finally{await f.dispose();disposed=true;}})();
 void failed.catch(()=>{});
 await eventually('forced-failure cleanup durably closed storage',()=>closed?true:undefined);
 await assert.rejects(failed,/forced fixture failure/);
 assert.equal(disposed,true);assert.equal(settled,true);assert.equal(closed,true);
});

for(const outcome of ['not-sent','refused'] as const)test(`confirmed snapshot ${outcome} releases admission for removal`,async t=>{
 const f=await diskFixture(t);f.rows.transition('work','creating');f.rows.transition('work','ready');
 t.mock.method(f.provider,'snapshotVolume',async()=>outcome==='not-sent'?{state:'not-sent',reason:'snapshot authorization refused'}:{state:'refused',reason:'rate limited',retryAt:new Date(f.clock.now().getTime()+60000).toISOString()});
 const owner=new LoginSnapshots({logins:f.rows,clock:f.clock,resolve:async()=>({provider:f.provider,volume:f.volume})});f.own(()=>owner.close());
 assert.equal((await owner.snapshot('work')).state,outcome);
 assert.doesNotThrow(()=>f.rows.assertSnapshotSettled('work'));
 await removeLogin({root:f.root,logins:f.rows,provider:()=>f.provider,snapshots:owner},'work');
 assert.equal(f.rows.get('work'),null);
});

for(const reopen of [false,true])test(`snapshot receipt recovery restores accounting and partial-delete accrual; reopen=${reopen}`,async t=>{
 const f=await diskFixture(t);f.rows.transition('work','creating');f.rows.transition('work','ready');await f.clock.advance(120000);
 const owner=new LoginSnapshots({logins:f.rows,clock:f.clock,resolve:async()=>({provider:f.provider,volume:f.volume})});f.own(()=>owner.close());
 const observer=new Store(join(f.root,'.cland/hub.db'));f.own(()=>observer.close());
 const record=f.rows.recordStorage.bind(f.rows);let fail=true;
 t.mock.method(f.rows,'recordStorage',(...args:Parameters<typeof record>)=>{if(args[2].kind==='snapshot'&&fail){fail=false;const visible=observer.hosts.logins.get('work');assert.ok(visible?.kind==='disk');assert.equal(visible.backup?.receipt,undefined,'receipt is not published separately from storage settlement');assert.throws(()=>observer.hosts.logins.assertSnapshotSettled('work'),/reconciliation/);throw Error('one-shot snapshot storage write failure');}return record(...args);});
 await assert.rejects(owner.snapshot('work'),/one-shot snapshot storage write failure/);
 const pending=f.rows.get('work');assert.ok(pending?.kind==='disk'&&pending.backup?.receipt);const receipt=pending.backup.receipt;
 let rows=f.rows,snapshots=owner,records=f.store.hosts;
 if(reopen){await owner.close();const next=new Store(join(f.root,'.cland/hub.db'));f.own(()=>next.close());rows=next.hosts.logins;rows.useClock(f.clock);records=next.hosts;snapshots=new LoginSnapshots({logins:rows,clock:f.clock,resolve:async()=>({provider:f.provider,volume:f.volume})});f.own(()=>snapshots.close());}
 assert.equal((await snapshots.snapshot('work')).state,'snapshotted');
 const recovered=rows.get('work');assert.ok(recovered?.kind==='disk');
 assert.deepEqual(recovered.storage!.items.find(item=>item.id===receipt.id),{kind:'snapshot',id:receipt.id,sizeGiB:1,created:receipt.created,deleted:null},'recovered snapshot has its complete storage lifetime');
 assert.doesNotThrow(()=>rows.assertSnapshotSettled('work'));
 const original=f.provider.deleteSnapshot.bind(f.provider);let refuse=true;
 t.mock.method(f.provider,'deleteSnapshot',async(...args:Parameters<typeof original>)=>{const id=typeof args[0]==='string'?args[0]:args[0].id;return id===receipt.id&&refuse?{state:'incomplete',reason:'held confirmed snapshot deletion'}:original(...args);});
 const remove=()=>removeLogin({root:f.root,logins:rows,provider:()=>f.provider,snapshots},'work');
 await assert.rejects(remove(),new RegExp(receipt.id));
 const partial=rows.get('work');assert.ok(partial?.kind==='disk');assert.equal(partial.volumeId,null);assert.deepEqual(partial.snapshotIds,[receipt.id]);
 const cost=async()=>(await hostStatus(records,readHostPools(undefined),[],f.env,f.clock,f.root)).pools.find(pool=>pool.name==='agents')!.spend.month!;
 const before=await cost();await f.clock.advance(3600000);const after=await cost();
 const start=Date.parse(f.clock.now().toISOString().slice(0,7)+'-01T00:00:00Z'),end=new Date(start);end.setUTCMonth(end.getUTCMonth()+1);
 assert.ok(Math.abs(after-before-0.06*3600000/(end.getTime()-start))<1e-10,'only retained snapshot keeps accruing');
 refuse=false;await remove();assert.equal(rows.get('work'),null);
});

test('remove CLI reports remaining volume and persists the real signed-out removal receipt',async t=>{
 const f=await diskFixture(t,true,'fake');
 await projectHub(t,f.root,f.env,{clock:f.clock,processes:fakeLockProcesses().processes,droplet:{processes:fakeLockProcesses().processes}});
 f.rows.transition('work','creating');f.rows.transition('work','ready');
 const ignored=f.provider.deleteVolume.bind(f.provider);
 t.mock.method(FakeHostProvider.prototype,'deleteVolume',ignored);
 const result=await cland(f.root,'login','remove','work');assert.equal(result.code,1);assert.ok(result.stderr.includes(f.volume.id));
 const row=f.rows.get('work');assert.ok(row?.kind==='disk');assert.deepEqual(row.snapshotIds,[]);assert.equal(row.volumeId,f.volume.id);assert.equal(row.state,'signed-out');
 assert.ok(row.signedOut?.id);assert.deepEqual({reason:row.signedOut.reason,host:row.signedOut.host,at:row.signedOut.at},{reason:'removing',host:null,at:f.clock.now().toISOString()});
 assert.equal(f.rows.selectCapacityLogin({harness:'codex',provider:'fake',region:'fake-1'}),null);
 assert.throws(()=>f.rows.transition('work','creating'),/removal in progress/);
});

test('hub startup reconciliation preserves removal claim and unsettled snapshot admission',async t=>{
 const f=await diskFixture(t,false,'fake');f.rows.transition('work','creating');f.rows.transition('work','ready');
 f.rows.beginSnapshotAdmission('work',f.volume.id);
 await assert.rejects(f.remove(),/snapshot.*reconciliation/);
 const before=f.rows.get('work');assert.ok(before?.signedOut?.id);
 const options={clock:f.clock,processes:fakeLockProcesses().processes,droplet:{processes:fakeLockProcesses().processes}};
 const first=await projectHub(t,f.root,f.env,options);await first.verificationSettled();await first.stop();
 const second=await projectHub(t,f.root,f.env,options);await second.verificationSettled();
 assert.deepEqual(f.rows.get('work'),before,'reconciliation preserves exact removal and snapshot metadata');
 assert.throws(()=>f.rows.transition('work','creating'),/removal in progress/);
 assert.throws(()=>f.rows.assertSnapshotSettled('work'),/snapshot.*reconciliation/);
 const result=await cland(f.root,'login','remove','work');assert.equal(result.code,1);assert.match(result.stderr,/snapshot.*reconciliation/);
 const inventory=await f.provider.listVolumes({project:f.root});assert.ok(inventory.state==='listed'&&inventory.volumes.some(volume=>volume.id===f.volume.id));
 for(const id of f.ids)assert.equal((await f.provider.getSnapshot(id)).state,'found');
});

for(const reopen of [false,true])for(const partial of [false,true])test(`direct removal repairs failed snapshot accounting; reopen=${reopen}; partial=${partial}`,async t=>{
 const f=await diskFixture(t);f.rows.transition('work','creating');f.rows.transition('work','ready');await f.clock.advance(120000);
 const owner=new LoginSnapshots({logins:f.rows,clock:f.clock,resolve:async()=>({provider:f.provider,volume:f.volume})});f.own(()=>owner.close());
 const record=f.rows.recordStorage.bind(f.rows);let fail=true;
 t.mock.method(f.rows,'recordStorage',(...args:Parameters<typeof record>)=>{if(args[2].kind==='snapshot'&&fail){fail=false;throw Error('one-shot snapshot storage write failure');}return record(...args);});
 await assert.rejects(owner.snapshot('work'),/one-shot snapshot storage write failure/);
 const before=f.rows.get('work');assert.ok(before?.kind==='disk'&&before.backup?.receipt);const receipt=before.backup.receipt;
 let rows=f.rows,snapshots=owner;
 if(reopen){await owner.close();const next=new Store(join(f.root,'.cland/hub.db'));f.own(()=>next.close());rows=next.hosts.logins;rows.useClock(f.clock);snapshots=new LoginSnapshots({logins:rows,clock:f.clock,resolve:async()=>({provider:f.provider,volume:f.volume})});f.own(()=>snapshots.close());}
 let held=partial;const original=f.provider.deleteSnapshot.bind(f.provider);
 t.mock.method(f.provider,'deleteSnapshot',async(...args:Parameters<typeof original>)=>{const id=typeof args[0]==='string'?args[0]:args[0].id;return held&&id===receipt.id?{state:'incomplete',reason:'held deletion after receipt repair'}:original(...args);});
 const remove=()=>removeLogin({root:f.root,logins:rows,provider:()=>f.provider,snapshots},'work');
 if(partial){
  await assert.rejects(remove(),new RegExp(receipt.id));
  const retained=rows.get('work');assert.ok(retained?.kind==='disk');assert.deepEqual(retained.snapshotIds,[receipt.id]);assert.equal(retained.volumeId,null);
  assert.deepEqual(retained.storage!.items.find(item=>item.id===receipt.id),{kind:'snapshot',id:receipt.id,sizeGiB:1,created:receipt.created,deleted:null});
  assert.doesNotThrow(()=>rows.assertSnapshotSettled('work'));held=false;
 }
 await remove();assert.equal(rows.get('work'),null);
 assert.equal((await f.provider.getSnapshot(receipt.id)).state,'failed');
});

for(const scenario of ['ready-full','ready-partial','signed-out-partial'] as const)test(`removal suppresses unusable sign-in cards and preserves genuine notice; ${scenario}`,async t=>{
 const partial=scenario!=='ready-full',f=await diskFixture(t,partial,'fake');
 f.rows.transition('work','creating');f.rows.transition('work','ready');
 if(scenario==='signed-out-partial')f.rows.markSignedOut('work',{reason:'unauthorized',host:'genuine-host'});
 const before=f.rows.get('work')!.signedOut;
 const options={clock:f.clock,processes:fakeLockProcesses().processes,droplet:{processes:fakeLockProcesses().processes}};
 const first=await projectHub(t,f.root,f.env,options),ui=await connectUi(t,first.discovery,'cli');
 const prior=JSON.parse(f.store.meta('login-signin-cards')??'{}').work as {id:string}|undefined;
 if(before){assert.ok(prior);assert.equal(f.store.ask(prior.id)?.state,'open');assert.ok(f.store.message(`login-signed-out:${before.id}`));}
 const native=f.provider.deleteVolume.bind(f.provider);let episode:NonNullable<import('../src/host/logins.ts').Login['signedOut']>|undefined;
 t.mock.method(FakeHostProvider.prototype,'deleteVolume',async(volume:Parameters<typeof native>[0])=>{episode=f.rows.get('work')?.signedOut;return native(volume);});
 const result=await cland(f.root,'login','remove','work');assert.equal(result.code,partial?1:0,result.stderr);assert.ok(episode);
 const assertUi=async(client:typeof ui)=>{
  const active=JSON.parse(f.store.meta('login-signin-cards')??'{}');assert.equal(active.work,undefined,'removing login has no active sign-in card');
  const inbox=(await client.request({type:'inbox.list'})).value as {asks:Array<{question:string}>};assert.ok(!inbox.asks.some(ask=>ask.question==='Login work is signed out. Sign in again?'));
  if(before){assert.equal(f.store.ask(prior!.id)?.state,'withdrawn');assert.ok(f.store.message(`login-signed-out:${before.id}`),'earlier genuine notice remains');assert.deepEqual(f.rows.get('work')?.signedOut,before);}
  else assert.equal(f.store.message(`login-signed-out:${episode!.id}`),null,'removal never publishes a sign-in notice');
 };
 await assertUi(ui);await first.stop();
 const second=await projectHub(t,f.root,f.env,options),next=await connectUi(t,second.discovery,'cli');await assertUi(next);
 if(partial)assert.throws(()=>f.rows.transition('work','creating'),/removal in progress/);
});

test('sign-in card eligibility uses removal claim rather than sign-out reason text',async()=>{
 const {HubCore}=await import('../src/hub/core.ts'),{LoginCards}=await import('../src/host/login-cards.ts');
 const store=new Store(':memory:'),core=new HubCore({store,clock:new FakeClock(Date.now())});
 try {
  const rows=store.hosts.logins;
  rows.insert({name:'work',kind:'key',harness:'opencode',account:'work',lastSignIn:null});rows.markSignedOut('work',{reason:'removing',host:null});
  const episode=rows.get('work')!.signedOut!;
  const cards=new LoginCards(store,core.cards,{notice:(name,e)=>core.noticeTo('agents',{id:`login-signed-out:${e.id}`,kind:'login-signed-out',text:`Login ${name} is signed out`})});
  cards.signedOut('work');const id=JSON.parse(store.meta('login-signin-cards')!).work.id;
  assert.equal(store.ask(id)?.state,'open','reason text alone leaves genuine sign-in eligible');
  const unlisten=rows.onChange(name=>queueMicrotask(()=>cards.loginChanged(name)));
  try {rows.beginRemove('work');await eventually('claim notification withdraws persisted card',()=>store.ask(id)?.state==='withdrawn'?true:undefined);}finally{unlisten();}
  assert.equal(rows.isRemoving('work'),true);assert.equal(store.ask(id)?.state,'withdrawn','already-signed-out claim change notifies the card owner');
  assert.equal(JSON.parse(store.meta('login-signin-cards')!).work,undefined);
  assert.deepEqual(rows.get('work')!.signedOut,episode);assert.ok(store.message(`login-signed-out:${episode.id}`));
 }finally{store.close();}
});
