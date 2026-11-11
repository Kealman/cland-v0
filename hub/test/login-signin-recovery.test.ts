// T2: restart ordering and durable interrupted-sign-in metadata, no native terminal.
import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {projectHub,tempProject,connectUi} from './harness.ts';
import {Store} from '../src/hub/store.ts';
import {FakeClock} from './fake-clock.ts';
import {fakeLockProcesses} from './fakes/lock-processes.ts';
import {loginMetadataOwners} from './login-metadata-owners.ts';
import {recoverLoginSignIns,settleLoginSignInsForHost} from '../src/host/login-signin.ts';
import {HostRecords} from '../src/host/records.ts';
import {sqliteProbe} from './sqlite-probe.ts';

test('startup sign-in recovery reads only indexed admissions across retained login history',async t=>{
 const probe=sqliteProbe(),db=probe.open(':memory:'),records=new HostRecords(db),r=records.logins,clock=new FakeClock();r.useClock(clock);
 try{
 for(let n=0;n<1000;n++){const name=`history-${n}`;r.insert({name,harness:'opencode',account:name,kind:'key',lastSignIn:null});r.markSignedOut(name,{reason:'fixture signed out',host:null});}
 r.insert({name:'work',harness:'codex',account:'work',kind:'disk',provider:'fake',region:'fake-1',volumeId:'v',snapshotIds:[],lastSignIn:null});r.markSignedOut('work',{reason:'fixture signed out',host:null});const token=r.beginSignIn('work');r.captureSignInHost('work',token,{id:'writer',machine:{id:'m',address:'fake',architecture:'x86_64',created:clock.now().toISOString()}});
 const parse=JSON.parse;let decoded=0,queries=0,returned=0;const plans:string[]=[];
 t.mock.method(JSON,'parse',((text:string)=>{const row=parse(text);if(row?.name)decoded++;return row;}) as typeof JSON.parse);
 r.list();assert.equal(decoded,1001,'history decode positive control');decoded=0;
 probe.trace(t,function(sql,method,bindings,value){queries++;if(method==='get'||method==='all'){returned+=Array.isArray(value)?value.length:value===undefined?0:1;plans.push(...probe.prepare.call(this,'explain query plan '+sql).all(...bindings as import('node:sqlite').SQLInputValue[]).map(row=>String(row.detail)));}});
 recoverLoginSignIns(records);assert.ok(decoded<10,`decoded ${decoded}`);assert.ok(returned<25,`returned ${returned}`);assert.ok(queries<25,`queries ${queries}`);assert.ok(plans.some(plan=>plan.includes('login_signin_active')));assert.ok(plans.some(plan=>plan.includes('login_signin_host')));assert.ok(plans.every(plan=>!/^SCAN logins\b/.test(plan)));assert.equal(r.get('work')?.signedOut?.reason,'sign-in interrupted');
 }finally{await records.leases.close();db.close();}
});

test('interrupted admission stays fenced across time and replacement births until its exact machine deletion receipt',async t=>{
 const root=await tempProject(t),owners=loginMetadataOwners(t,root),clock=new FakeClock(Date.now()),processes=fakeLockProcesses().processes;await owners.start(()=>projectHub(t,root,{}, {clock,processes,droplet:{processes}}));const store=owners.store(new Store(join(root,'.cland/hub.db')));
 const r=store.hosts.logins;r.useClock(clock);
 const machine={id:'m',address:'fake',architecture:'x86_64' as const,created:clock.now().toISOString()};
 r.insert({name:'work',harness:'codex',account:'work',kind:'disk',provider:'fake',region:'fake-1',volumeId:'v',snapshotIds:[],lastSignIn:null});r.markSignedOut('work',{reason:'fixture signed out',host:null});
 const token=r.beginSignIn('work');r.captureSignInHost('work',token,{id:'writer',machine});
 recoverLoginSignIns(store.hosts);assert.equal(r.get('work')?.signedOut?.host,'writer');assert.throws(()=>r.beginSignIn('work'),/may still be running on host writer/);assert.throws(()=>r.finishSignIn('work',token,clock.now().toISOString()),/admission/);
 t.mock.method(clock,'now',()=>new Date(Date.parse(machine.created)+7*86400000));assert.throws(()=>r.beginSignIn('work'),/may still be running/,'elapsed time never settles native work');
 const provision={id:'writer',pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:machine.created,state:'destroyed' as const,machine};
 store.hosts.provisions.save(provision);settleLoginSignInsForHost(store.hosts,'writer');assert.throws(()=>r.beginSignIn('work'),/may still be running/,'no deletion receipt');
 store.hosts.provisions.save({...provision,machine:{...machine,created:new Date(Date.parse(machine.created)+1).toISOString()},machineDeletionRead:'fixture replacement deletion receipt'});settleLoginSignInsForHost(store.hosts,'writer');assert.throws(()=>r.beginSignIn('work'),/may still be running/,'replacement birth grants no authority');
 store.hosts.provisions.save({...provision,machineDeletionRead:'fixture exact machine deletion receipt'});settleLoginSignInsForHost(store.hosts,'writer');assert.equal(r.signInFenceReason('work'),'');assert.ok(r.beginSignIn('work'));
});

test('restart reverts an admitted renewal without native effects, retains bindings and refuses the old token',async t=>{
 const root=await tempProject(t),clock=new FakeClock(Date.now()),processes=fakeLockProcesses().processes;
 const options={clock,processes,droplet:{processes}};
 const owners=loginMetadataOwners(t,root);let hub=await owners.start(()=>projectHub(t,root,{},options));const store=owners.store(new Store(join(root,'.cland/hub.db')));const r=store.hosts.logins;r.useClock(clock);
 r.insert({name:'work',harness:'codex',account:'work',kind:'disk',provider:'fake',region:'fake-1',volumeId:'v',snapshotIds:[],lastSignIn:null});r.transition('work','ready');r.bind('work',{host:'writer',role:'writer',volumeId:'v'});r.markSignedOut('work',{reason:'unauthorized',host:'writer'});
 const bindings=r.bindings('work'),token=r.beginSignIn('work');
 r.captureSignInHost('work',token,{id:'writer',machine:{id:'m',address:'fake',architecture:'x86_64',created:clock.now().toISOString()}});
 // This durable admission has no current terminal owner, as after an abrupt loss.
 await hub.stop();hub=await owners.start(()=>projectHub(t,root,{},options));
 const row=r.get('work')!;assert.equal(row.state,'signed-out');assert.equal(row.signedOut?.reason,'sign-in interrupted');assert.deepEqual(r.bindings('work'),bindings);assert.equal(row.lastSignIn,null);assert.deepEqual(row.kind==='disk'&&row.snapshotIds,[]);
 assert.throws(()=>r.finishSignIn('work',token,clock.now().toISOString()),/admission/);
 const ui=await connectUi(t,hub.discovery,'cli'),inbox=(await ui.request({type:'inbox.list'})).value as {asks:{question:string}[]};
 assert.equal(inbox.asks.filter(ask=>ask.question.startsWith('Login work')).length,1);
 assert.ok(inbox.asks.find(ask=>ask.question.startsWith('Login work'))!.question.includes('may still be running on host writer'));
 assert.throws(()=>r.beginSignIn('work'),/may still be running/);
});
