// T2: directory-provider inventory and persisted login receipts; no native hosts.
import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {tempProject,eventually,testWaitMs,projectHub} from './harness.ts';
import {mkdir,writeFile} from 'node:fs/promises';
import {settledLogin} from './settled-login-fixture.ts';
import {Store} from '../src/hub/store.ts';
import {FakeClock} from './fake-clock.ts';
import {beforeDirectories} from './process-cleanup.ts';
import {fixtureEnvironment} from './fixture-environment.ts';
import {FakeHostProvider} from '../src/host/provider/fake.ts';
import {LoginReconciliation} from '../src/host/login-reconcile.ts';
import {installLoginRelease} from '../src/host/login-release.ts';
import {LoginSnapshots} from '../src/host/login-snapshots.ts';
import {fakeLockProcesses} from './fakes/lock-processes.ts';

for(const deleted of [false,true])test(`settled fixture login restart follows positive provider volume inventory; deleted=${deleted}`,async t=>{
 const root=await tempProject(t),stack=new AsyncDisposableStack();beforeDirectories(t,()=>stack.disposeAsync());
 await mkdir(join(root,'.cland'),{recursive:true});await writeFile(join(root,'.cland/config.toml'),'[hosts.agents]\nprovider="fake"\nsize="fake"\nregion="fake-1"\nslots=1\nmin_hosts=0\n');
 const clock=new FakeClock(Date.now()),processes=fakeLockProcesses().processes;
 const options={clock,processes,droplet:{processes},lockIdentity:{hostname:'fixture-host',bootId:'fixture-boot',pidNamespace:'fixture-pids'}};
 const env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root}),provider=new FakeHostProvider({env,now:()=>clock.now().getTime()});
 const first=await projectHub(t,root,env,options);stack.defer(()=>first.stop());await first.verificationSettled();
 const store=new Store(join(root,'.cland/hub.db'));stack.defer(()=>store.close());stack.defer(()=>first.stop());store.hosts.logins.useClock(clock);
 await settledLogin(store.hosts.logins,'retained','codex',{provider:'fake',region:'fake-1',project:root,env,clock});
 const row=store.hosts.logins.get('codex-retained');assert.ok(row?.kind==='disk');
 const inventory=await provider.listVolumes({project:root});assert.equal(inventory.state,'listed');if(inventory.state!=='listed')throw Error('fixture inventory unavailable');
 const volume=inventory.volumes.find(volume=>volume.id===row.volumeId);assert.ok(volume,'settled helper must own a real provider volume');
 if(deleted)assert.equal((await provider.deleteVolume(volume)).state,'deleted');
 await first.stop();const second=await projectHub(t,root,env,options);stack.defer(()=>second.stop());await second.verificationSettled();
 const next=store.hosts.logins.get(row.name);assert.ok(next);
 if(deleted){assert.equal(next.state,'signed-out');assert.equal(next.signedOut?.reason,'volume missing');}
 else{assert.ok(next.state==='in-use'||next.state==='ready');assert.equal(next.signedOut,undefined);assert.equal(next.kind==='disk'&&next.volumeId,volume.id);}
});

async function readerFixture(t:test.TestContext){
 const root=await tempProject(t),stack=new AsyncDisposableStack(),store=new Store(join(root,'hub.db'));
 stack.defer(()=>store.close());beforeDirectories(t,()=>stack.disposeAsync());
 const clock=new FakeClock(Date.now()),r=store.hosts.logins;r.useClock(clock);
 const env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root}),provider=new FakeHostProvider({env,now:()=>clock.now().getTime()});
 const made=await provider.acquire({project:root,pool:'agents',architecture:'x86_64',region:'fake-1'});if(made.state!=='created')throw Error('fixture machine');
 const original=await provider.createVolume({project:root,name:'original',region:'fake-1',sizeGiB:1}),clone=await provider.createVolume({project:root,name:'clone',region:'fake-1',sizeGiB:1});
 if(original.state!=='created'||clone.state!=='created')throw Error('fixture volume');
 r.insert({name:'work',kind:'disk',harness:'codex',account:'work',provider:'fake',region:'fake-1',volumeId:original.volume.id,snapshotIds:[],lastSignIn:null,exclusive:false});r.transition('work','ready');
 const operation={login:'work',host:'unknown',harness:'codex',provider:'fake',project:root,pool:'agents',region:'fake-1',machine:made.machine,name:clone.volume.name,snapshot:'snapshot',phase:'creating' as const};
 r.beginReader(operation);r.saveReader({...operation,volume:clone.volume,phase:'bound'});r.bind('work',{host:'unknown',role:'reader',volumeId:clone.volume.id,phase:'settled'});
 const release=installLoginRelease(store.hosts,{host:()=>undefined,beginRelease:async()=>{},onReleased:()=>{},notice:()=>{}});stack.defer(()=>release.close());
 const owner=new LoginReconciliation({root,records:store.hosts,clock,provider:()=>provider,notice:()=>{},log:()=>{}});stack.defer(()=>owner.close());
 return {root,store,r,clock,provider,owner,stack,original:original.volume,clone:clone.volume,machine:made.machine};
}
for(const missing of [true,false])test(`unknown host reader cleanup survives signed-out metadata; missing original=${missing}`,async t=>{
 const f=await readerFixture(t);
 if(missing)assert.equal((await f.provider.deleteVolume(f.original)).state,'deleted');
 else f.r.markSignedOut('work',{reason:'expired',host:null});
 await f.owner.start();assert.equal(f.r.get('work')?.state,'signed-out');assert.equal(f.r.binding('work','unknown'),null);
 assert.equal(f.r.readerOperation('work','unknown'),null);
 assert.equal(f.r.get('work')?.storage?.items.find(v=>v.id===f.clone.id)?.deleted,f.clock.now().toISOString());
});
test('reader inventory cannot replace the captured native volume birth',async t=>{
 const f=await readerFixture(t),before=f.r.readerOperation('work','unknown'),list=f.provider.listVolumes.bind(f.provider);let deleted=false;
 t.mock.method(f.provider,'listVolumes',async(...args:Parameters<typeof list>)=>{const result=await list(...args);return result.state==='listed'?{...result,volumes:result.volumes.map(v=>v.id===f.clone.id?{...v,created:new Date(Date.parse(v.created)+1).toISOString(),sizeGiB:2}:v)}:result;});
 t.mock.method(f.provider,'deleteVolume',async()=>{deleted=true;return {state:'deleted' as const};});
 await f.owner.start();assert.equal(deleted,false);assert.deepEqual(f.r.readerOperation('work','unknown'),before);
});
test('held reader deletion cannot bless a same-values writer rebind with stale detached inventory',async t=>{
 const f=await readerFixture(t),r=f.r;
 r.bind('work',{host:'z-writer',role:'writer',volumeId:f.original.id,phase:'settled'});
 const writer=r.binding('work','z-writer')!,gate=Promise.withResolvers<void>();let deleting=false;
 const remove=f.provider.deleteVolume.bind(f.provider);
 t.mock.method(f.provider,'deleteVolume',async(...args:Parameters<typeof remove>)=>{if(args[0].id===f.clone.id){deleting=true;await gate.promise;}return remove(...args);});
 const work=f.owner.start();f.stack.defer(async()=>{gate.resolve();await work;});
 await eventually('reader A native deletion held',()=>deleting?true:undefined,testWaitMs());
 r.unbind('work','z-writer');r.bind('work',{host:writer.host,role:writer.role,volumeId:writer.volumeId,phase:'settled'});
 assert.deepEqual(r.binding('work','z-writer'),writer,'rebind preserves public values');
 assert.equal((await f.provider.attachVolume(f.original,f.machine)).state,'attached');
 gate.resolve();await work;
 assert.deepEqual(r.binding('work','z-writer'),writer,'new writer episode remains bound');
 assert.equal(r.get('work')?.state,'in-use');
});
test('writer snapshot-fence wait retains a replacement binding episode',async t=>{
 const f=await readerFixture(t);f.r.unbind('work','unknown');f.r.bind('work',{host:'writer',role:'writer',volumeId:f.original.id,phase:'settled'});
 const gate=Promise.withResolvers<void>();let entered=false;
 const release=installLoginRelease(f.store.hosts,{host:()=>undefined,beginRelease:async()=>{entered=true;await gate.promise;},onReleased:()=>{},notice:()=>{}});f.stack.defer(()=>release.close());
 const work=f.owner.start();f.stack.defer(async()=>{gate.resolve();await work;await f.owner.close();});
 await eventually('writer release fence held',()=>entered?true:undefined,testWaitMs());
 const binding=f.r.binding('work','writer')!;
 f.r.unbind('work','writer');f.r.bind('work',{host:binding.host,role:binding.role,volumeId:binding.volumeId,phase:'settled'});
 await f.provider.attachVolume(f.original,f.machine);gate.resolve();await work;
 assert.deepEqual(f.r.binding('work','writer'),binding);assert.equal(f.r.get('work')?.state,'in-use');
});
test('unknown host delayed detachment is retried through a positive inventory receipt',async t=>{
 const f=await readerFixture(t);await f.provider.attachVolume(f.clone,f.machine);
 await f.owner.start();assert.ok(f.r.binding('work','unknown'));
 await f.provider.detachVolume(f.clone,f.machine);await f.clock.advance(1000);
 await eventually('unknown reader deletion receipt',()=>f.r.get('work')?.storage?.items.find(v=>v.id===f.clone.id)?.deleted?true:undefined,testWaitMs());
 assert.equal(f.r.binding('work','unknown'),null);
});
test('unknown reader deletion intent obtains exact-id deletion receipt after inventory omission',async t=>{
 const f=await readerFixture(t),operation=f.r.readerOperation('work','unknown')!;
 f.r.saveReader({...operation,phase:'deleting'});await f.provider.deleteVolume(f.clone);
 const remove=f.provider.deleteVolume.bind(f.provider);let confirmed=false;
 t.mock.method(f.provider,'deleteVolume',async(...args:Parameters<typeof remove>)=>{assert.equal(args[0].id,f.clone.id);const result=await remove(...args);confirmed=result.state==='deleted';return result;});
 await f.owner.start();assert.equal(confirmed,true);assert.equal(f.r.readerOperation('work','unknown'),null);assert.equal(f.r.binding('work','unknown'),null);
});
test('reconciliation preserves retained snapshot receipt through its release owner',async t=>{
 const f=await readerFixture(t);
 f.r.unbind('work','unknown');f.r.bind('work',{host:'writer',role:'writer',volumeId:f.original.id,phase:'settled'});
 const receipt={id:'snapshot-receipt',volumeId:f.original.id,created:f.clock.now().toISOString()};
 f.r.updateBackup('work',{pending:true,receipt});
 const snapshots=new LoginSnapshots({logins:f.r,clock:f.clock,resolve:async()=>{throw Error('no native snapshot in reconciliation');}});
 f.stack.defer(()=>snapshots.close());
 const release=installLoginRelease(f.store.hosts,{host:()=>undefined,beginRelease:(name,options)=>snapshots.beginRelease(name,options),onReleased:(name,proof)=>snapshots.onReleased(name,proof),notice:()=>{}});
 f.stack.defer(()=>release.close());f.stack.defer(()=>f.owner.close());
 await f.owner.start();const row=f.r.get('work');assert.ok(row?.kind==='disk');assert.deepEqual(row.backup?.receipt,receipt);
});
test('reader-heavy startup uses bounded binding pages without materializing retained bindings',async t=>{
 const f=await readerFixture(t);f.r.unbind('work','unknown');
 f.store.hosts.insert({id:'healthy',address:f.machine.address,user:'agent',clientKeyPath:'unused',knownHosts:'unused'},'synthetic');
 f.store.hosts.provisions.ready({id:'healthy',pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:f.machine.created,state:'ready',machine:f.machine});
 for(let i=0;i<150;i++)f.r.bind('work',{host:'reader-'+String(i).padStart(3,'0'),role:'reader',volumeId:'absent-'+i,phase:'settled'});
 t.mock.method(f.r,'bindings',()=>{throw Error('unbounded binding materialization');});
 const page=f.r.reconciliationBindings.bind(f.r);let pages=0,rows=0;
 t.mock.method(f.r,'reconciliationBindings',(...args:Parameters<typeof page>)=>{const result=page(...args);pages++;rows+=result.length;assert.ok(result.length<=64);return result;});
 await f.owner.start();assert.equal(rows,150);assert.equal(pages,4);
});

test('startup cursor decodes only active disks across retained signed-out history',async t=>{
 const root=await tempProject(t),store=new Store(join(root,'hub.db'));beforeDirectories(t,()=>store.close());
 const r=store.hosts.logins;
 for(let i=0;i<200;i++){
  r.insert({name:'old-'+i,kind:'disk',harness:'codex',account:'old',provider:'fake',region:'fake-1',volumeId:'old',snapshotIds:[],lastSignIn:null});r.transition('old-'+i,'signed-out');
 }
 r.insert({name:'active',kind:'disk',harness:'codex',account:'work',provider:'fake',region:'fake-1',volumeId:'live',snapshotIds:[],lastSignIn:null});r.transition('active','ready');
 const parse=JSON.parse;let decoded=0;t.mock.method(JSON,'parse',(...args:Parameters<typeof JSON.parse>)=>{decoded++;return parse(...args);});
 assert.deepEqual([...r.reconciliationDisks()].map(row=>row.name),['active']);assert.equal(decoded,1);
});

for(const phase of ['settled','pending','creating','deleted'] as const)test(`detached reader deletion has a provider receipt and storage stamp; phase=${phase}`,async t=>{
 const pending=phase!=='settled';
 const root=await tempProject(t),store=new Store(join(root,'hub.db')),clock=new FakeClock(Date.now());
 const stack=new AsyncDisposableStack();stack.defer(()=>store.close());beforeDirectories(t,()=>stack.disposeAsync());
 const env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root}),provider=new FakeHostProvider({env,now:()=>clock.now().getTime()});
 const r=store.hosts.logins;r.useClock(clock);
 const acquired=await provider.acquire({project:root,pool:'agents',architecture:'x86_64',region:'fake-1'});assert.equal(acquired.state,'created');if(acquired.state!=='created')throw Error('fixture machine');
 const machine=acquired.machine;
 store.hosts.insert({id:'reader',address:machine.address,user:'agent',clientKeyPath:'unused',knownHosts:'unused'},'synthetic');
 store.hosts.provisions.ready({id:'reader',pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:machine.created,state:'ready',machine});
 const created=await provider.createVolume({project:root,name:'original',region:'fake-1',sizeGiB:1});assert.equal(created.state,'created');if(created.state!=='created')throw Error('fixture volume');
 const clone=await provider.createVolume({project:root,name:'clone',region:'fake-1',sizeGiB:1});assert.equal(clone.state,'created');if(clone.state!=='created')throw Error('fixture clone');
 r.insert({name:'work',kind:'disk',harness:'codex',account:'work',provider:'fake',region:'fake-1',volumeId:created.volume.id,snapshotIds:[],lastSignIn:null,exclusive:false});r.transition('work','ready');
 r.bind('work',{host:'reader',role:'reader',volumeId:clone.volume.id,phase:phase==='pending'?'pending':'settled'});
 if(phase==='creating'||phase==='deleted'){
  const operation={login:'work',host:'reader',harness:'codex',provider:'fake',project:root,pool:'agents',region:'fake-1',machine,name:clone.volume.name,snapshot:'snapshot',phase:'creating' as const};
  r.beginReader(operation);if(phase==='deleted')r.saveReader({...operation,phase:'deleted',volume:clone.volume});
 }
 r.recordStorage('work','agents',{kind:'volume',id:clone.volume.id,sizeGiB:1,created:clone.volume.created,deleted:null});
 const release=installLoginRelease(store.hosts,{host:()=>undefined,beginRelease:async()=>{},onReleased:()=>{},notice:()=>{}});stack.defer(()=>release.close());
 const owner=new LoginReconciliation({root,records:store.hosts,clock,provider:()=>provider,notice:()=>{},log:()=>{}});stack.defer(()=>owner.close());
 const remove=provider.deleteVolume.bind(provider);let confirmed=false;
 t.mock.method(provider,'deleteVolume',async(...args:Parameters<typeof remove>)=>{const receipt=await remove(...args);confirmed=receipt.state==='deleted';return receipt;});
 await owner.start();
 assert.equal(confirmed,!pending);
 assert.equal(r.get('work')?.state,pending?'in-use':'ready');
 assert.equal(r.get('work')?.storage?.items[0]?.deleted,pending?null:clock.now().toISOString());
 const inventory=await provider.listVolumes({project:root});assert.equal(inventory.state,'listed');if(inventory.state==='listed')assert.equal(inventory.volumes.some(v=>v.id===clone.volume.id),pending);
});

test('missing volume signs out while failed inventory preserves rows and retries once',async t=>{
 const root=await tempProject(t),store=new Store(join(root,'hub.db')),clock=new FakeClock();
 const stack=new AsyncDisposableStack();stack.defer(()=>store.close());beforeDirectories(t,()=>stack.disposeAsync());
 const env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root});
 const provider=new FakeHostProvider({env}),notices:string[]=[];
 const r=store.hosts.logins;r.useClock(clock);
 r.insert({name:'work',kind:'disk',harness:'codex',account:'work',provider:'fake',region:'fake-1',volumeId:'missing',snapshotIds:[],lastSignIn:null});r.transition('work','ready');
 const list=provider.listVolumes.bind(provider);let failed=true;
 t.mock.method(provider,'listVolumes',async(...args:Parameters<typeof list>)=>failed?{state:'failed' as const,reason:'offline'}:list(...args));
 const owner=new LoginReconciliation({root,records:store.hosts,clock,provider:()=>provider,notice:text=>notices.push(text),log:()=>{}});
 stack.defer(()=>owner.close());
 const before=r.get('work');await owner.start();assert.deepEqual(r.get('work'),before);
 await owner.start();assert.equal(notices.length,1);failed=false;
 await clock.advance(1000);
 await eventually('retry signed-out receipt',()=>r.get('work')?.state==='signed-out'?true:undefined,testWaitMs());
 const receipt=r.get('work')!.signedOut!;assert.match(receipt.id,/^[0-9a-f-]{36}$/);
 assert.deepEqual(receipt,{id:receipt.id,reason:'volume missing',host:null,at:clock.now().toISOString()});
});

test('close joins admitted inventory and concurrent callers share the pass',async t=>{
 const root=await tempProject(t),store=new Store(join(root,'hub.db')),clock=new FakeClock();
 const stack=new AsyncDisposableStack();stack.defer(()=>store.close());beforeDirectories(t,()=>stack.disposeAsync());
 const env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root}),provider=new FakeHostProvider({env});
 const gate=Promise.withResolvers<void>();
 let reads=0,closed=false;
 t.mock.method(provider,'listVolumes',async()=>{reads++;await gate.promise;return {state:'listed' as const,volumes:[]};});
 store.hosts.logins.insert({name:'work',kind:'disk',harness:'codex',account:'work',provider:'fake',region:'fake-1',volumeId:'missing',snapshotIds:[],lastSignIn:null});store.hosts.logins.transition('work','ready');
 const owner=new LoginReconciliation({root,records:store.hosts,clock,provider:()=>provider,notice:()=>{},log:()=>{}});
 stack.defer(async()=>{gate.resolve();await owner.close();});
 const work=owner.start();assert.equal(owner.start(),work);
 await eventually('inventory admitted',()=>reads===1?true:undefined,testWaitMs());
 const closing=owner.close().then(()=>{closed=true;});assert.equal(closed,false);
 gate.resolve();await closing;await work;assert.equal(reads,1);
 assert.equal(store.hosts.logins.get('work')?.state,'signed-out');
 await clock.advance(1000);assert.equal(reads,1);
});

for(const volumeId of ['old','new'])test(`held old inventory cannot sign out a newly published ready identity; volume=${volumeId}`,async t=>{
 const root=await tempProject(t),store=new Store(join(root,'hub.db')),clock=new FakeClock();
 const stack=new AsyncDisposableStack();stack.defer(()=>store.close());
 beforeDirectories(t,()=>stack.disposeAsync());
 const r=store.hosts.logins;r.insert({name:'work',kind:'disk',harness:'codex',account:'work',provider:'fake',region:'fake-1',volumeId:'old',snapshotIds:[],lastSignIn:null});r.transition('work','ready');
 const env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root}),provider=new FakeHostProvider({env});
 const gate=Promise.withResolvers<void>();let entered=false;
 t.mock.method(provider,'listVolumes',async()=>{entered=true;await gate.promise;return {state:'listed' as const,volumes:[]};});
 const owner=new LoginReconciliation({root,records:store.hosts,clock,provider:()=>provider,notice:()=>{},log:()=>{}});
 stack.defer(async()=>{gate.resolve();await owner.close();});
 const work=owner.start();await eventually('old inventory held',()=>entered?true:undefined,testWaitMs());
 r.markSignedOut('work',{reason:'expired',host:null});r.transition('work','creating');r.updateCreatingDisk('work',{volumeId});r.transition('work','ready');
 gate.resolve();await work;assert.equal(r.get('work')?.state,'ready');assert.equal(r.get('work')?.signedOut,undefined);
});

test('fixture disposal joins work and closes storage after an earlier close rejection',async t=>{
 const root=await tempProject(t),stack=new AsyncDisposableStack(),store=new Store(join(root,'hub.db'));
 let storageClosed=false;const close=store.close.bind(store);stack.defer(()=>{close();storageClosed=true;});beforeDirectories(t,()=>stack.disposeAsync());
 const clock=new FakeClock(),env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root}),provider=new FakeHostProvider({env});
 const owner=new LoginReconciliation({root,records:store.hosts,clock,provider:()=>provider,notice:()=>{},log:()=>{}});
 stack.defer(async()=>{await owner.close();throw Error('planted post-join close rejection');});
 await owner.start();await assert.rejects(stack.disposeAsync(),/planted post-join close rejection/);assert.equal(storageClosed,true);
});

test('signed-out receipt retains bindings, removes capacity and clears on sign-in',async t=>{
 const root=await tempProject(t),store=new Store(join(root,'hub.db')),clock=new FakeClock();
 beforeDirectories(t,()=>store.close());const r=store.hosts.logins;r.useClock(clock);
 r.insert({name:'work',kind:'disk',harness:'codex',account:'work',provider:'fake',region:'fake-1',volumeId:'v1',snapshotIds:[],lastSignIn:null});
 r.transition('work','ready');r.bind('work',{host:'host',role:'writer',volumeId:'v1',phase:'settled'});
 const bindings=r.bindings('work');r.markSignedOut('work',{reason:'volume missing',host:null});
 const first=r.get('work')!.signedOut!;assert.match(first.id,/^[0-9a-f-]{36}$/);
 assert.deepEqual(first,{id:first.id,reason:'volume missing',host:null,at:clock.now().toISOString()});
 assert.equal(r.get('work')?.state,'signed-out');assert.deepEqual(r.bindings('work'),bindings);
 assert.equal(r.selectCapacityLogin({harness:'codex',provider:'fake',region:'fake-1'}),null);
 r.transition('work','creating');assert.equal(r.get('work')?.signedOut,undefined);
 r.transition('work','ready');r.markSignedOut('work',{reason:'expired',host:'host'});
 assert.notEqual(r.get('work')?.signedOut?.id,first.id);assert.equal(r.get('work')?.signedOut?.at,first.at);
 assert.equal(r.get('work')?.state,'signed-out');
});
