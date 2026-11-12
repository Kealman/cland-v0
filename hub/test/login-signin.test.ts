// T1: injected Host/provider boundaries; no native processes or socket.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { LoginRecords } from '../src/host/logins.ts';
import { prepareLoginSignIn, prepareExistingLoginSignIn, loginSignInCommand } from '../src/host/login-signin.ts';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Host } from '../src/host/host.ts';
import type { HostProvider } from '../src/host/provider/provider.ts';
import { FakeClock } from './fake-clock.ts';
import {LoginSnapshots,snapshotHostIdentity} from '../src/host/login-snapshots.ts';

for(const boundary of ['attach','umount'] as const)test(`new login revalidates recovered admission after held ${boundary}`,async t=>{
 const db=new DatabaseSync(':memory:'),logins=new LoginRecords(db),clock=new FakeClock(),entered=Promise.withResolvers<void>(),gate=Promise.withResolvers<void>(),events:string[]=[];
 const volume={id:'v',name:'disk',project:'/project',region:'fake-1',sizeGiB:1,created:clock.now().toISOString(),attachedTo:null},machine={id:'m',address:'fake',architecture:'arm64' as const,created:volume.created};
 const hold=async(op:string)=>{events.push(op);if(op===boundary){entered.resolve();await gate.promise;}};
 const host={name:'writer',loginDisk:async({op}:{op:string})=>hold(op)} as unknown as Host;
 const provider={createVolume:async()=>({state:'created',volume}),attachVolume:async()=>{await hold('attach');return {state:'attached'};},detachVolume:async()=>{await hold('detach');return {state:'detached'};},snapshotVolume:async()=>{await hold('snapshot');throw Error('stale snapshot');}} as unknown as HostProvider;
 let work:Promise<unknown>|undefined;t.after(async()=>{gate.resolve();await work?.catch(()=>{});db.close();});
 const preparing=prepareLoginSignIn({logins,provider,host,machine,project:'/project',tag:'fixture',region:'fake-1',providerName:'fake',harness:'claude-code',name:'work',clock});
 work=preparing;void work.catch(()=>{});
 if(boundary==='umount'){const pending=await preparing;work=pending.complete(0);void work.catch(()=>{});}
 await entered.promise;logins.interruptSignIn('work');gate.resolve();await assert.rejects(work);
 assert.deepEqual(events,boundary==='attach'?['attach']:['attach','mount','umount']);assert.equal(logins.get('work')?.signedOut?.reason,'sign-in interrupted');assert.throws(()=>logins.beginSignIn('work'),/may still be running/);
});

for(const failure of ['refused attach','unknown mount'] as const)test(`new login preparation distinguishes ${failure}`,async t=>{
 const db=new DatabaseSync(':memory:'),logins=new LoginRecords(db),clock=new FakeClock(),events:string[]=[];t.after(()=>db.close());
 const volume={id:'v',name:'disk',project:'/project',region:'fake-1',sizeGiB:1,created:clock.now().toISOString(),attachedTo:null};
 const host={name:'writer',loginDisk:async()=>{events.push('mount');throw Error('mount outcome unknown');}} as unknown as Host;
 const provider={createVolume:async()=>({state:'created',volume}),attachVolume:async()=>failure==='refused attach'?{state:'refused',reason:'fixture refusal'}:{state:'attached'},detachVolume:async()=>{events.push('detach');return {state:'detached'};}} as unknown as HostProvider;
 await assert.rejects(prepareLoginSignIn({logins,provider,host,machine:{id:'m',address:'fake',architecture:'arm64',created:volume.created},project:'/project',tag:'fixture',region:'fake-1',providerName:'fake',harness:'claude-code',name:'work',clock}));
 assert.equal(logins.get('work')?.signedOut?.reason,failure==='refused attach'?'sign-in failed':'sign-in interrupted');assert.deepEqual(events,failure==='refused attach'?[]:['mount']);
 if(failure==='refused attach')assert.equal(logins.signInFenceReason('work'),'');else assert.throws(()=>logins.beginSignIn('work'),/may still be running/);
});

test('unbound renewal interruption retains its native fence without invoking disk cleanup',async()=>{
 const db=new DatabaseSync(':memory:'),r=new LoginRecords(db),clock=new FakeClock(),events:string[]=[];r.useClock(clock);
 r.insert({name:'work',harness:'codex',account:'work',kind:'disk',provider:'fake',region:'fake-1',volumeId:'v',snapshotIds:[],lastSignIn:null});r.markSignedOut('work',{reason:'fixture signed out',host:null});
 const volume={id:'v',name:'disk',project:'/project',region:'fake-1',sizeGiB:1,created:clock.now().toISOString(),attachedTo:'m'},host={name:'temporary',loginDisk:async()=>{events.push('disk effect');}} as unknown as Host;
 const provider={listVolumes:async()=>({state:'listed',volumes:[volume]})} as unknown as HostProvider,owner=new LoginSnapshots({logins:r,clock,resolve:async()=>({host,provider,volume})});
 try{const pending=await prepareExistingLoginSignIn({logins:r,name:'work',provider,host,volume,machine:{id:'m',address:'fake',architecture:'x86_64',created:volume.created},identity:'temporary',clock,snapshots:owner,authorize:()=>{},cleanup:async()=>{events.push('cleanup');}});assert.ok(pending.interrupt);await pending.interrupt();assert.deepEqual(events,[]);assert.equal(r.get('work')?.signedOut?.host,'temporary');assert.throws(()=>r.beginSignIn('work'),/may still be running on host temporary/);}finally{await owner.close();db.close();}
});

test('renewal rate refusal publishes native success and the shared owner retries its pending backup',async()=>{
 const db=new DatabaseSync(':memory:'),r=new LoginRecords(db),clock=new FakeClock(),events:string[]=[];r.useClock(clock);
 r.insert({name:'work',harness:'codex',account:'work',kind:'disk',provider:'fake',region:'fake-1',volumeId:'v',snapshotIds:[],lastSignIn:null});r.transition('work','ready');r.bind('work',{host:'h',role:'writer',volumeId:'v'});r.markSignedOut('work',{reason:'unauthorized',host:'h'});
 const volume={id:'v',name:'disk',project:'/project',region:'fake-1',sizeGiB:1,created:clock.now().toISOString(),attachedTo:'m'},retryAt=new Date(clock.now().getTime()+1000).toISOString();let attempts=0;
 const host={name:'h',loginDisk:async({op}:{op:string})=>{events.push(op);}} as unknown as Host;
 const provider={listVolumes:async()=>({state:'listed',volumes:[volume]}),snapshotVolume:async()=>{attempts++;events.push('snapshot');return attempts===1?{state:'refused',reason:'rate limited',retryAt}:{state:'snapshotted',snapshot:{id:'backup',volumeId:'v',created:clock.now().toISOString()}};}} as unknown as HostProvider;
 const owner=new LoginSnapshots({logins:r,clock,resolve:async()=>({provider,host,volume,identity:'h'})});
 try{const pending=await prepareExistingLoginSignIn({logins:r,name:'work',provider,host,volume,machine:{id:'m',address:'fake',architecture:'x86_64',created:volume.created},identity:'h',clock,snapshots:owner,authorize:()=>{}});const signedIn=await pending.complete(0);assert.equal(signedIn.state,'in-use');assert.ok(signedIn.lastSignIn);assert.equal(signedIn.kind==='disk'&&signedIn.backup?.pending,true);assert.equal(signedIn.kind==='disk'&&signedIn.backup?.retryAt,retryAt);await clock.advance(1000);await owner.close();const row=r.get('work');assert.ok(row?.kind==='disk');assert.deepEqual(row.snapshotIds,['backup']);assert.equal(row.backup?.pending,false);assert.equal(attempts,2);assert.deepEqual(events,['freeze','snapshot','thaw','freeze','snapshot','thaw']);}finally{await owner.close();db.close();}
});

test('active renewal refuses replacing its admitted volume before settlement',()=>{
 const db=new DatabaseSync(':memory:'),r=new LoginRecords(db);
 try{r.insert({name:'work',harness:'codex',account:'work',kind:'disk',provider:'fake',region:'fake-1',volumeId:'v',snapshotIds:[],lastSignIn:null});r.markSignedOut('work',{reason:'fixture signed out',host:null});r.beginSignIn('work');assert.throws(()=>r.updateCreatingDisk('work',{volumeId:'replacement'}),/sign-in admission/);const row=r.get('work');assert.equal(row?.kind==='disk'&&row.volumeId,'v');}finally{db.close();}
});

test('durable renewal admission refuses binding changes at the final transaction boundary',()=>{
 const db=new DatabaseSync(':memory:'),r=new LoginRecords(db);
 try{r.insert({name:'work',harness:'codex',account:'work',kind:'disk',provider:'fake',region:'fake-1',volumeId:'v',snapshotIds:[],lastSignIn:null});r.transition('work','ready');r.bind('work',{host:'h',role:'writer',volumeId:'v'});r.markSignedOut('work',{reason:'unauthorized',host:'h'});const token=r.beginSignIn('work');r.unbind('work','h');assert.throws(()=>r.finishSignIn('work',token,'2026-11-11T00:00:00Z'),/binding/);assert.equal(r.get('work')?.state,'creating');}finally{db.close();}
});

for(const changedBirth of [false,true,null])test(`renewal freeze recovery ${changedBirth===null?'refuses absent live host':changedBirth?'refuses another birth':'thaws on the same admitted machine'}`,async()=>{
 const db=new DatabaseSync(':memory:'),r=new LoginRecords(db),clock=new FakeClock();r.useClock(clock);
 const machine={id:'m',address:'fake',architecture:'x86_64' as const,created:clock.now().toISOString()},registration={id:'h',state:'registered'};
 const identity=snapshotHostIdentity(machine,machine.created,registration),volume={id:'v',name:'disk',project:'/project',region:'fake-1',sizeGiB:1,created:clock.now().toISOString(),attachedTo:'m'};
 r.insert({name:'work',harness:'codex',account:'work',kind:'disk',provider:'fake',region:'fake-1',volumeId:'v',snapshotIds:[],lastSignIn:null});r.transition('work','ready');r.bind('work',{host:'h',role:'writer',volumeId:'v'});r.markSignedOut('work',{reason:'unauthorized',host:'h'});
 let restarted=false,snapshotsTaken=0;const events:string[]=[];
 const host={name:'h',loginDisk:async({op}:{op:string})=>{events.push(op);if(op==='thaw'&&!restarted)throw Error('planted incomplete thaw');}} as unknown as Host;
 const provider={listVolumes:async()=>({state:'listed',volumes:[volume]}),snapshotVolume:async()=>{snapshotsTaken++;return {state:'snapshotted',snapshot:{id:'s',volumeId:'v',created:clock.now().toISOString()}};}} as unknown as HostProvider;
 let owner=new LoginSnapshots({logins:r,clock,resolve:async()=>({provider,volume,host,identity})});
 try{
  const pending=await prepareExistingLoginSignIn({logins:r,name:'work',provider,host,volume,clock,snapshots:owner,machine,identity,authorize:()=>{}});
  await assert.rejects(pending.complete(0),/incomplete thaw/);await owner.close();restarted=true;events.length=0;
  const returning=changedBirth===null?undefined:changedBirth?{...machine,created:new Date(Date.parse(machine.created)+1).toISOString()}:machine;
  owner=new LoginSnapshots({logins:r,clock,resolve:async()=>({provider,volume,host,identity:snapshotHostIdentity(returning,returning?machine.created:undefined,registration)})});
  if(changedBirth!==false){await assert.rejects(owner.beginRelease('work'),/identity changed/);assert.deepEqual(events,[]);}
  else {await owner.beginRelease('work');assert.deepEqual(events,['thaw']);const row=r.get('work');assert.equal(row?.kind==='disk'&&row.backup?.freeze,undefined);}
  assert.equal(snapshotsTaken,1,'recovery never resends the provider snapshot');
 }finally{await owner.close();db.close();}
});

for(const mutation of ['unbind','episode','detach','birth'] as const)test(`renewal fences ${mutation} across held inventory before freeze or snapshot`,async()=>{
 const db=new DatabaseSync(':memory:'),logins=new LoginRecords(db),clock=new FakeClock(),events:string[]=[];
 logins.insert({name:'work',harness:'codex',account:'work',kind:'disk',provider:'fake',region:'fake-1',volumeId:'v',snapshotIds:[],lastSignIn:null});logins.transition('work','ready');logins.bind('work',{host:'h',role:'writer',volumeId:'v'});logins.markSignedOut('work',{reason:'unauthorized',host:'h'});
 const volume={id:'v',name:'disk',project:'/project',region:'fake-1',sizeGiB:1,created:clock.now().toISOString(),attachedTo:'m'};
 const host={name:'h',loginDisk:async({op}:{op:string})=>{events.push(op);}} as unknown as Host;
 const entered=Promise.withResolvers<void>(),gate=Promise.withResolvers<void>();let hold=false,live=volume;
 const provider={listVolumes:async()=>{const captured=live;if(hold){entered.resolve();await gate.promise;}return {state:'listed',volumes:[captured]};},snapshotVolume:async()=>{events.push('snapshot');return {state:'snapshotted',snapshot:{id:'s',volumeId:'v',created:clock.now().toISOString()}};}} as unknown as HostProvider;
 const snapshots=new LoginSnapshots({logins,clock,resolve:async()=>({host,provider,volume})});
 let work:Promise<unknown>|undefined;
 try{
  const pending=await prepareExistingLoginSignIn({logins,name:'work',provider,host,volume,machine:{id:'m',address:'fake',architecture:'x86_64',created:volume.created},identity:'h',clock,snapshots,authorize:()=>{}});hold=true;
  work=pending.complete(0);void work.catch(()=>{});await entered.promise;
  if(mutation==='unbind')logins.unbind('work','h');
  // A replacement private episode has identical public binding values.
  if(mutation==='episode')db.prepare("update login_bindings set episode='replacement' where login='work' and host='h'").run();
  if(mutation==='detach')live={...volume,attachedTo:'different-machine'};
  if(mutation==='birth')live={...volume,created:new Date(Date.parse(volume.created)+1).toISOString()};
  hold=false;gate.resolve();
  // Inventory captured before a provider-side change must be followed by a fresh
  // read before the next effect. Binding mutations are rejected immediately.
  await assert.rejects(work,/binding|birth|attachment/);assert.deepEqual(events,[]);
 }finally{gate.resolve();await work?.catch(()=>{});await snapshots.close();db.close();}
});

test('renewal snapshot owner joins held freeze before release can thaw or shutdown can finish',async()=>{
 const db=new DatabaseSync(':memory:'),logins=new LoginRecords(db),clock=new FakeClock(),events:string[]=[];
 logins.insert({name:'work',harness:'codex',account:'work',kind:'disk',provider:'fake',region:'fake-1',volumeId:'v',snapshotIds:[],lastSignIn:null});logins.transition('work','ready');logins.bind('work',{host:'h',role:'writer',volumeId:'v'});logins.markSignedOut('work',{reason:'unauthorized',host:'h'});
 const entered=Promise.withResolvers<void>(),freeze=Promise.withResolvers<void>();
 const host={name:'h',loginDisk:async({op}:{op:string})=>{events.push(op);if(op==='freeze'){entered.resolve();await freeze.promise;}}} as unknown as Host;
 const volume={id:'v',name:'disk',project:'/project',region:'fake-1',sizeGiB:1,created:clock.now().toISOString(),attachedTo:'m'};
 const provider={listVolumes:async()=>({state:'listed',volumes:[volume]}),snapshotVolume:async()=>{events.push('snapshot');throw Error('release must fence provider');}} as unknown as HostProvider;
 const snapshots=new LoginSnapshots({logins,clock,resolve:async()=>({host,volume,provider})});
 let work:Promise<unknown>|undefined;
 try{
  const pending=await prepareExistingLoginSignIn({logins,name:'work',provider,host,volume,machine:{id:'m',address:'fake',architecture:'x86_64',created:volume.created},identity:'h',clock,authorize:()=>{},snapshots});
  work=pending.complete(0);void work.catch(()=>{});await entered.promise;
  const release=snapshots.beginRelease('work');let released=false;void release.then(()=>{released=true;});
  const closing=snapshots.close();let closed=false;void closing.then(()=>{closed=true;});
  await Promise.resolve();assert.deepEqual(events,['freeze']);assert.equal(released,false);
  assert.equal(closed,false);freeze.resolve();await release;await assert.rejects(work,/releasing|ownership/);await closing;assert.equal(closed,true);
  assert.deepEqual(events,['freeze','thaw']);const row=logins.get('work');assert.equal(row?.kind==='disk'&&row.backup?.freeze,undefined);
 }finally{freeze.resolve();await work?.catch(()=>{});await snapshots.close();db.close();}
});

for(const fence of ['pending','release','snapshot','removal-admission','snapshot-admission'])test(`sign-in refuses retained ${fence} ownership`,()=>{
 const db=new DatabaseSync(':memory:');
 const logins=new LoginRecords(db);
 try {
 logins.insert({name:'work',harness:'codex',account:'work',kind:'disk',provider:'fake',region:'fake-1',volumeId:'v',snapshotIds:[],lastSignIn:null});logins.transition('work','ready');
 if(fence==='pending')logins.bind('work',{host:'h',role:'writer',volumeId:'v',phase:'pending'});
 if(fence==='release')logins.updateBackup('work',{pending:false,releasing:true});
 if(fence==='snapshot')logins.updateBackup('work',{pending:true,freeze:{host:'h',identity:'held-freeze',volumeId:'v'}});
 logins.markSignedOut('work',{reason:'unauthorized',host:'h'});
 if(fence==='removal-admission')logins.beginRemove('work');
 if(fence==='snapshot-admission')logins.beginSnapshotAdmission('work','v');
 const before=logins.get('work');assert.throws(()=>logins.beginSignIn('work'),/ownership|outcome|snapshot|removal/);assert.deepEqual(logins.get('work'),before);
 }finally{db.close();}
});

test('finish sign-in refuses a newly acquired ownership fence without publishing ready',()=>{
 const db=new DatabaseSync(':memory:');const logins=new LoginRecords(db);
 try{logins.insert({name:'work',harness:'codex',account:'work',kind:'disk',provider:'fake',region:'fake-1',volumeId:'v',snapshotIds:[],lastSignIn:null});logins.markSignedOut('work',{reason:'fixture signed out',host:null});const admission=logins.beginSignIn('work');logins.beginSnapshotAdmission('work','v');assert.throws(()=>logins.finishSignIn('work',admission,'2026-11-11T00:00:00Z'),/snapshot/);assert.equal(logins.get('work')!.state,'creating');}finally{db.close();}
});

test('a queued backup without native admission does not strand signed-out renewal',()=>{
 const db=new DatabaseSync(':memory:'),r=new LoginRecords(db);try{r.insert({name:'work',harness:'codex',account:'work',kind:'disk',provider:'fake',region:'fake-1',volumeId:'v',snapshotIds:[],lastSignIn:null});r.updateBackup('work',{pending:true});r.markSignedOut('work',{reason:'fixture signed out',host:null});assert.ok(r.beginSignIn('work'));}finally{db.close();}
});

test('renewing a mounted login snapshots under freeze and keeps the writer mounted',async t=>{
 const db=new DatabaseSync(':memory:');let snapshots:LoginSnapshots|undefined;t.after(async()=>{await snapshots?.close();db.close();});const logins=new LoginRecords(db),events:string[]=[],clock=new FakeClock();logins.useClock(clock);
 const volume={id:'v',name:'disk',project:'/project',region:'fake-1',sizeGiB:1,created:clock.now().toISOString(),attachedTo:'m'};
 logins.insert({name:'work',harness:'codex',account:'work',kind:'disk',provider:'fake',region:'fake-1',volumeId:'v',snapshotIds:[],lastSignIn:null});logins.transition('work','ready');logins.bind('work',{host:'h',role:'writer',volumeId:'v',phase:'settled'});logins.markSignedOut('work',{reason:'unauthorized',host:'h'});
 const provider={listVolumes:async()=>({state:'listed',volumes:[volume]}),snapshotVolume:async()=>{events.push('snapshot');return {state:'snapshotted',snapshot:{id:'s',volumeId:'v',created:clock.now().toISOString()}};}} as unknown as HostProvider;
 const host={name:'h',loginDisk:async({op}:{op:string})=>{events.push(op);}} as unknown as Host;
 snapshots=new LoginSnapshots({logins,clock,resolve:async()=>({host,volume,provider})});
 const pending=await prepareExistingLoginSignIn({logins,name:'work',provider,host,volume,machine:{id:'m',address:'fake',architecture:'x86_64',created:volume.created},identity:'h',clock,snapshots,authorize:()=>{}});
 assert.equal(pending.path,'/cland/auth/codex-work');assert.deepEqual(events,[]);
 const row=await pending.complete(0);assert.equal(row.state,'in-use');assert.equal(row.lastSignIn,clock.now().toISOString());assert.deepEqual(events,['freeze','snapshot','thaw']);assert.equal(logins.bindings('work')[0]!.volumeId,'v');
});

test('sign-in admission retains bindings, fences competing attempts and publishes renewed in-use state',()=>{
 const db=new DatabaseSync(':memory:'),logins=new LoginRecords(db);
 try {
 logins.insert({name:'work',harness:'codex',account:'work',kind:'disk',provider:'fake',region:'fake-1',volumeId:'v',snapshotIds:[],lastSignIn:null});
 logins.transition('work','ready');logins.bind('work',{host:'h',role:'writer',volumeId:'v',phase:'settled'});
 logins.markSignedOut('work',{reason:'unauthorized',host:'h'});
 const before=logins.bindings('work');
 const admission=logins.beginSignIn('work');
 assert.equal(logins.get('work')!.signedOut,undefined);assert.deepEqual(logins.bindings('work'),before);
 assert.throws(()=>logins.beginSignIn('work'),/signed-out/);
 assert.throws(()=>logins.finishSignIn('work','wrong','2026-11-11T00:00:00.000Z'),/admission/);
 const row=logins.finishSignIn('work',admission,'2026-11-11T00:00:00.000Z');
 assert.equal(row.state,'in-use');assert.equal(row.lastSignIn,'2026-11-11T00:00:00.000Z');assert.deepEqual(logins.bindings('work'),before);
 }finally{db.close();}
});

test('all harness sign-in plans contain only the documented home and native arguments',()=>{
 assert.equal(loginSignInCommand('codex','/cland/auth/codex-work'),"CODEX_HOME='/cland/auth/codex-work' codex login --device-auth");
 assert.equal(loginSignInCommand('claude-code','/cland/auth/claude-code-work'),"CLAUDE_CONFIG_DIR='/cland/auth/claude-code-work' claude auth login");
 assert.equal(loginSignInCommand('opencode','/cland/auth/opencode-work'),"OPENCODE_DB='/cland/auth/opencode-work/opencode.db' opencode auth login");
});
test('production harness command sources contain no logout commands',async()=>{
 const root=new URL('../src/',import.meta.url).pathname;
 async function scan(path:string):Promise<void>{for(const entry of await readdir(path,{withFileTypes:true})){
  const file=join(path,entry.name);if(entry.isDirectory())await scan(file);else if(entry.name.endsWith('.ts'))assert.doesNotMatch(await readFile(file,'utf8'),/codex\s+logout|claude\s+auth\s+logout|\/logout/);
 }}
 await scan(root);
});

for(const code of [1,null]) test(`failed terminal sign-in ${code} keeps a detached signed-out disk`,async t=>{
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());const logins=new LoginRecords(db);
 let mounted=false,attached=false,snapshots=0;
 const volume={id:'volume-1',project:'/project',name:'disk',region:'lon1',sizeGiB:1,created:'2026-11-10T00:00:00.000Z',attachedTo:null};
 const provider={createVolume:async()=>({state:'created',volume}),attachVolume:async()=>{attached=true;return {state:'attached'};},detachVolume:async()=>{attached=false;return {state:'detached'};},snapshotVolume:async()=>{snapshots++;throw Error('unexpected');}} as unknown as HostProvider;
 const host={name:'host-a',loginDisk:async({op}:{op:string})=>{mounted=op==='mount';}} as unknown as Host;
 const pending=await prepareLoginSignIn({logins,provider,host,machine:{id:'machine-a',address:'fake',architecture:'arm64',created:volume.created},project:'/project',tag:'cland-test',region:'lon1',providerName:'fake',harness:'claude-code',clock:new FakeClock(Date.parse(volume.created))});
 assert.equal(mounted,true);assert.equal(attached,true);
 const row=await pending.complete(code);
 assert.equal(row.state,'signed-out');assert.ok(row.signedOut?.id);assert.equal(row.signedOut.reason,'sign-in failed');assert.equal(row.signedOut.host,null);assert.equal(row.lastSignIn,null);assert.equal(row.kind==='disk'&&row.volumeId,'volume-1');
 assert.equal(mounted,false);assert.equal(attached,false);assert.equal(snapshots,0);
});

test('disk sign-in stays creating until unmount, snapshot and detach receipts', async t => {
 const db = new DatabaseSync(':memory:'); t.after(() => db.close());
 const logins = new LoginRecords(db), events: string[] = [];
 const volume = {id:'volume-123',project:'/project',name:'disk',region:'lon1',sizeGiB:1,created:'2026-11-10T00:00:00Z',attachedTo:null};
 let config = '';
 const host = {name:'host-a',loginDisk:async ({op}: {op:string})=>{events.push(op);},publishFile:async (_path:string,bytes:Uint8Array)=>{config=Buffer.from(bytes).toString();return true;}} as unknown as Host;
 const provider = {createVolume:async (input:unknown)=>{assert.deepEqual(input,{project:'/project',name:'cland-test-codex-1',region:'lon1',sizeGiB:1});return {state:'created',volume};},attachVolume:async()=>({state:'attached'}),snapshotVolume:async()=>{events.push('snapshot');return {state:'snapshotted',snapshot:{id:'snapshot-1',volumeId:volume.id,created:volume.created}};},detachVolume:async()=>{events.push('detach');return {state:'detached'};}} as unknown as HostProvider;
 const clock=new FakeClock(Date.parse(volume.created));
 logins.useClock(clock);
 const pending=await prepareLoginSignIn({logins,provider,host,machine:{id:'machine-a',address:'fake',architecture:'arm64',created:volume.created},project:'/project',tag:'cland-test',region:'lon1',providerName:'fake',harness:'codex',clock});
 assert.equal(pending.name,'codex-1'); assert.equal(pending.path,'/cland/auth/codex-codex-1');
 assert.equal(logins.get(pending.name)?.state,'creating'); assert.deepEqual(logins.free(),[]); assert.deepEqual(logins.bindings(pending.name),[]);
 assert.equal(config,'cli_auth_credentials_store = "file"\n');
 await pending.complete(0);
 const row=logins.get(pending.name)!;
 assert.equal(row.state,'ready'); assert.equal(row.lastSignIn,'2026-11-10T00:00:00.000Z');
 assert.deepEqual(row.kind==='disk'&&row.snapshotIds,['snapshot-1']);
 assert.deepEqual(events,['mount','umount','snapshot','detach']);
});

test('sign-in records volume and snapshot lifetime receipts in the admitted pool',async t=>{
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());const logins=new LoginRecords(db);
 const created='2026-11-10T00:00:00Z',clock=new FakeClock(Date.parse(created));logins.useClock(clock);
 const volume={id:'v',project:'/project',name:'disk',region:'lon1',sizeGiB:1,created,attachedTo:null};
 const host={name:'h',loginDisk:async()=>{},publishFile:async()=>true} as unknown as Host;
 const provider={createVolume:async()=>({state:'created',volume}),attachVolume:async()=>({state:'attached'}),snapshotVolume:async()=>({state:'snapshotted',snapshot:{id:'s',volumeId:'v',created}}),detachVolume:async()=>({state:'detached'})} as unknown as HostProvider;
 const pending=await prepareLoginSignIn({logins,provider,host,machine:{id:'m',address:'fake',architecture:'arm64',created},project:'/project',tag:'fixture',region:'lon1',providerName:'fake',harness:'codex',pool:'agents',clock});
 const row=await pending.complete(0);
 assert.deepEqual(row.storage,{pool:'agents',items:[{kind:'volume',id:'v',sizeGiB:1,created,deleted:null},{kind:'snapshot',id:'s',sizeGiB:1,created,deleted:null}]});
 logins.deleteStorage(row.name,'snapshot','s');
 assert.equal(logins.get(row.name)!.storage!.items[1]!.deleted,'2026-11-10T00:00:00.000Z');
 await clock.advance(22*86400000);
 logins.recordStorage(row.name,'agents',{kind:'snapshot',id:'next',sizeGiB:1,created:clock.now().toISOString(),deleted:null});
 assert.deepEqual(logins.get(row.name)!.storage!.items.map(item=>item.id),['v','next']);
 assert.throws(()=>logins.useClock(new FakeClock(Date.parse(created))),/clock already set/);
});
