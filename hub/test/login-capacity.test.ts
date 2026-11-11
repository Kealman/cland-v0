// T2: in-memory login metadata and PoolRuntime creation seam; no processes or network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sqliteProbe } from './sqlite-probe.ts';
import { loginVerdict } from '../src/host/login-verdicts.ts';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ownDirectory, onCleanup } from './process-cleanup.ts';
import { LoginRecords } from '../src/host/logins.ts';
import type { ReaderOperation } from '../src/host/logins.ts';
import { DatabaseSync } from 'node:sqlite';
import { HostRecords } from '../src/host/records.ts';
import { PoolRuntime, PoolCapacityUnavailable } from '../src/host/pool-runtime.ts';
import { readHostPools } from '../src/host/pools.ts';

function ownMetadata(t:test.TestContext,db:DatabaseSync) {
 const owners:Array<()=>unknown|Promise<unknown>>=[()=>db.close()];
 onCleanup(t,async()=>{
  const failures:unknown[]=[];
  for(const close of owners.reverse())try{await close();}catch(error){failures.push(error);}
  if(failures.length)throw new AggregateError(failures,'capacity fixture cleanup failed');
 });
 return (close:()=>unknown|Promise<unknown>)=>owners.push(close);
}

function fixture(t:test.TestContext, region='fake-1', minimum=0) {
 const db=new DatabaseSync(':memory:');const own=ownMetadata(t,db);const records=new HostRecords(db);own(()=>records.leases.close());
 const settings=readHostPools({agents:{provider:'fake',region,slots:1,min_hosts:minimum,max_hosts:2}});
 const processes:Array<{key:string;host:string;harness:string}>=[];
 const runtime=new PoolRuntime(()=>settings,records,()=>true,()=>processes);
 own(()=>runtime.close());
 const disk=(name:string,exclusive=true,state:'ready'|'creating'='ready')=>{
  records.logins.insert({name,harness:'codex',account:name,kind:'disk',provider:'fake',region:'fake-1',exclusive,volumeId:'volume-'+name,snapshotIds:[],lastSignIn:null});
  if(state==='ready')records.logins.transition(name,'ready');
 };
 const host=(id:string)=>{
  records.insert({id,address:'fake',user:'runner',clientKeyPath:'',knownHosts:''},'fixture');
  records.provisions.ready({id,pool:'agents',provider:'fake',region,size:'fake',created:new Date(0).toISOString(),machine:{id,address:'fake',architecture:'arm64',created:new Date(0).toISOString()},state:'ready'});
 };
 const wait=(harness='codex')=>{
  try{runtime.reserve('agents',harness);assert.fail('expected login wait');}catch(error){assert.ok(error instanceof PoolCapacityUnavailable);assert.equal(error.reason,'waiting for a login '+harness);assert.equal(error.create,false);}
 };
 return {db,records,runtime,processes,disk,host,wait};
}

test('exclusive login in use holds demand growth below max_hosts',t=>{
 const f=fixture(t);f.disk('work');f.host('one');
 f.records.logins.bind('work',{host:'one',role:'writer',volumeId:'volume-work'});
 f.processes.push({key:'full',host:'one',harness:'claude-code'});
 f.wait();assert.equal(f.records.provisions.occupied('agents'),1);
});

for(const [label,region,state] of [['wrong region','fake-2','ready'],['creating','fake-1','creating']] as const)test(label+' login supplies no pool capacity',t=>{
 const f=fixture(t,region);f.disk('work',true,state);f.host('one');f.wait();
 assert.deepEqual(f.records.logins.bindings('work'),[]);
});

test('settled bindings serve first and pending bindings cannot serve',t=>{
 const f=fixture(t);f.disk('work');f.host('one');
 const first=f.runtime.reserve('agents','codex');assert.equal(first.host,'one');first.release();
 f.records.logins.bind('work',{host:'one',role:'writer',volumeId:'volume-work',phase:'pending'});
 f.wait();f.records.logins.settleBinding('work','one');
 const second=f.runtime.reserve('agents','codex');assert.equal(second.host,'one');second.release();
});

for(const kind of ['shared','key'] as const)test(kind+' login permits every pool host and further growth',t=>{
 const f=fixture(t);const harness=kind==='key'?'opencode':'codex';
 if(kind==='key'){f.records.logins.insert({name:'work',harness:'opencode',account:'work',kind:'key',lastSignIn:null});f.records.logins.transition('work','ready');}
 else {f.disk('work',false);f.records.logins.bind('work',{host:'elsewhere',role:'reader',volumeId:'clone'});}
 for(const id of ['one','two']){f.host(id);const reservation=f.runtime.reserve('agents',harness,id);assert.equal(reservation.host,id);reservation.release();}
 f.records.provisions.save({...f.records.provisions.get('two')!,state:'destroyed'});
 f.processes.push({key:'full',host:'one',harness:'claude-code'});
 assert.throws(()=>f.runtime.reserve('agents',harness),error=>error instanceof PoolCapacityUnavailable && error.create);
});

test('minimum creates hosts without any login',async t=>{
 const f=fixture(t,'fake-1',1);let created=0;
 f.runtime.start(async(_pool,authorize)=>{authorize();created++;f.host('minimum');return f.records.provisions.get('minimum');});
 await f.runtime.close();assert.equal(created,1);assert.deepEqual(f.records.logins.list(),[]);
});


test('login verdict classifies a retained signed-out binding and refuses region drift',t=>{
 const f=fixture(t);f.disk('work');f.records.logins.bind('work',{host:'one',role:'writer',volumeId:'volume-work'});
 assert.equal(loginVerdict(f.records.logins,{host:'one',harness:'codex',provider:'fake',region:'fake-1'}),'serves');
 assert.equal(loginVerdict(f.records.logins,{host:'one',harness:'codex',provider:'fake',region:'fake-2'}),'no-login');
 const select=f.records.logins.heldForLaunch.bind(f.records.logins);
 t.mock.method(f.records.logins,'heldForLaunch',(input:Parameters<typeof select>[0])=>select(input).map(row=>({...row,login:{...row.login,state:'signed-out' as const}})));
 assert.equal(loginVerdict(f.records.logins,{host:'one',harness:'codex',provider:'fake',region:'fake-1'}),'signed-out');
});

test('demand create rechecks login capacity at the creator admission boundary',async t=>{
 const f=fixture(t);f.disk('work');let cause:PoolCapacityUnavailable|undefined;
 try{f.runtime.reserve('agents','codex');}catch(error){assert.ok(error instanceof PoolCapacityUnavailable);cause=error;}
 assert.equal(cause?.create,true);let effects=0;
 f.runtime.start(async(_pool,authorize)=>{f.records.logins.bind('work',{host:'competitor',role:'writer',volumeId:'volume-work'});authorize();effects++;});
 f.runtime.demand(cause!,()=>{});await f.runtime.close();assert.equal(effects,0);assert.equal(f.records.provisions.occupied('agents'),0);
});

test('capacity selection bounds decoded rows and indexed query work over retained metadata',t=>{
 const probe=sqliteProbe(),db=probe.open(':memory:');const own=ownMetadata(t,db);const records=new HostRecords(db);own(()=>records.leases.close());
 db.exec('begin');
 for(let i=0;i<10000;i++){
  const name='history-'+i;records.logins.insert({name,harness:'codex',account:'work',kind:'disk',provider:'fake',region:'other',volumeId:'v-'+i,snapshotIds:[],lastSignIn:null});
  records.logins.transition(name,i%2===0?'signed-out':'ready');
 }
 records.logins.insert({name:'wanted',harness:'codex',account:'work',kind:'disk',provider:'fake',region:'fake-1',volumeId:'wanted-volume',snapshotIds:[],lastSignIn:null});records.logins.transition('wanted','ready');db.exec('commit');
 let decoded=0;const parse=JSON.parse;
 t.mock.method(JSON,'parse',((source:string)=>{const row=parse(source);if(row?.name)decoded++;return row;}) as typeof JSON.parse);
 records.logins.list();assert.equal(decoded,10001,'decode positive control');decoded=0;
 let queries=0;const plans:string[]=[];
 probe.trace(t,function(sql,method,bindings){queries++;assert.equal(method,'get');plans.push(...probe.prepare.call(this,'explain query plan '+sql).all(...bindings as import('node:sqlite').SQLInputValue[]).map(row=>String(row.detail)));});
 assert.equal(records.logins.selectCapacityLogin({harness:'codex',provider:'fake',region:'fake-1'})?.name,'wanted');
 assert.equal(decoded,1);assert.equal(queries,2);assert.ok(plans.some(plan=>plan.includes('login_capacity_launch')));assert.ok(plans.every(plan=>!/^SCAN |USE TEMP B-TREE/.test(plan)),plans.join('\n'));
});

test('pinned account with no free login cannot authorize host growth',t=>{
 const f=fixture(t);f.disk('other');
 assert.throws(()=>f.runtime.reserve('agents','codex',undefined,undefined,'wanted'),error=>error instanceof PoolCapacityUnavailable&&error.reason==='waiting for a login codex'&&!error.create);
});

test('pinned account skips incompatible healthy binding for compatible bindable host',t=>{
 const f=fixture(t);f.disk('other');f.disk('wanted');f.host('bound');f.host('free');
 f.records.logins.bind('other',{host:'bound',role:'writer',volumeId:'volume-other'});
 const reservation=f.runtime.reserve('agents','codex',undefined,undefined,'wanted');
 assert.equal(reservation.host,'free');reservation.release();
});

test('demand retains the admitted account pin after a competing bind',async t=>{
 const f=fixture(t);f.disk('wanted');f.disk('other');let cause:PoolCapacityUnavailable|undefined;
 try{f.runtime.reserve('agents','codex',undefined,undefined,'wanted');}catch(error){assert.ok(error instanceof PoolCapacityUnavailable);cause=error;}
 assert.equal(cause?.create,true);let effects=0;
 f.runtime.start(async(_pool,authorize)=>{f.records.logins.bind('wanted',{host:'competitor',role:'writer',volumeId:'volume-wanted'});authorize();effects++;});
 f.runtime.demand(cause!,()=>{});await f.runtime.close();assert.equal(effects,0);
});


const readerIntent=(login:string,host:string):ReaderOperation=>({login,host,harness:'codex',provider:'fake',project:'scratch',pool:'agents',region:'fake-1',machine:{id:host,address:'fake',architecture:'arm64',created:new Date(0).toISOString()},name:'reader-'+host,snapshot:'snapshot',phase:'creating'});
const readerVolume=(op:ReaderOperation)=>({id:'clone-'+op.host,name:op.name,project:op.project,region:op.region,created:new Date(0).toISOString(),sizeGiB:1,attachedTo:null});

test('pending capacity counter follows every binding and reader writer and transaction rollback',t=>{
 const f=fixture(t);f.disk('work',false);const logins=f.records.logins;
 const check=(expected:number)=>{
  const direct=f.db.prepare("select (select count(*) from login_bindings where login='work' and phase='pending')+(select count(*) from login_readers where login='work' and phase in ('creating','deleted')) as n").get()!.n;
  assert.equal(f.db.prepare("select pending_bindings as n from logins where name='work'").get()!.n,direct);
  assert.equal(direct,expected);assert.equal(logins.hasPendingBinding('work'),expected>0);
 };
 check(0);logins.setExclusive('work',true);check(0);logins.setExclusive('work',false);check(0);
 logins.bind('work',{host:'writer',role:'writer',volumeId:'volume-work',phase:'pending'});check(1);
 logins.settleBinding('work','writer');check(0);logins.unbind('work','writer');check(0);
 const refused=readerIntent('work','refused');logins.beginReader(refused);check(1);logins.refuseReader(refused);check(0);
 const operation=readerIntent('work','reader');logins.beginReader(operation);check(1);
 const allocated={...operation,volume:readerVolume(operation)};logins.saveReader(allocated);check(1);
 logins.bindReader(allocated);check(1);logins.settleBinding('work','reader');check(0);
 logins.saveReader({...allocated,phase:'deleting'});check(0);
 logins.saveReader({...allocated,phase:'deleted'});check(1);
 logins.updateBackup('work',{pending:false,releasing:true});
 assert.throws(()=>logins.completeReader({...allocated,phase:'deleted'}),/release owner unavailable/);check(1);
 const release=logins.onReaderRelease(()=>{});logins.completeReader({...allocated,phase:'deleted'});release();check(0);
 logins.bind('work',{host:'rollback',role:'writer',volumeId:'volume-work',phase:'pending'});check(1);
 logins.unbind('work','rollback');check(0);
});

test('capacity index bounds visits across same-region rejected rows and agrees with pending fences',t=>{
 const probe=sqliteProbe(),db=probe.open(':memory:');const own=ownMetadata(t,db);const records=new HostRecords(db);own(()=>records.leases.close());
 const logins=records.logins;db.exec('begin');
 for(let i=0;i<10000;i++){
  const name='blocked-'+String(i).padStart(5,'0');
  logins.insert({name,harness:'codex',account:'work',kind:'disk',provider:'fake',region:'fake-1',exclusive:false,volumeId:i%4===0?null:'volume-'+name,snapshotIds:[],lastSignIn:null});logins.transition(name,'ready');
  if(i%4===1)logins.bind(name,{host:'pending-'+i,role:'writer',volumeId:'volume-'+name,phase:'pending'});
  if(i%4>=2){const op=readerIntent(name,'intent-'+i);logins.beginReader(op);if(i%4===3)logins.saveReader({...op,volume:readerVolume(op),phase:'deleted'});}
 }
 logins.insert({name:'wanted',harness:'codex',account:'work',kind:'disk',provider:'fake',region:'fake-1',volumeId:'wanted-volume',snapshotIds:[],lastSignIn:null});logins.transition('wanted','ready');db.exec('commit');
 let visits=0,observing=false;db.function('capacity_visit',(_name:unknown)=>{visits++;return 1;});
 // Count every candidate before any residual filter; positive control proves a
 // full same-region walk is observable independently of output decodes.
 db.prepare("select count(*) from logins not indexed where capacity_visit(name) and json_extract(record,'$.region')='fake-1'").get();assert.equal(visits,10001);visits=0;
 probe.mock(t,function(this:DatabaseSync,sql:string){return probe.prepare.call(this,observing&&sql.startsWith('select record from logins')?sql.replace(' where ',' where capacity_visit(name) and '):sql);});
 for(const account of [null,'work','missing']){
  visits=0;observing=true;const selected=logins.selectCapacityLogin({harness:'codex',provider:'fake',region:'fake-1',account});observing=false;
  assert.equal(selected?.name,account==='missing'?undefined:'wanted');assert.ok(visits<=1,`visited ${visits} rejected candidates`);
 }
 for(const row of db.prepare('select name,pending_bindings from logins order by name').all()){
  const direct=db.prepare("select (select count(*) from login_bindings where login=? and phase='pending')+(select count(*) from login_readers where login=? and phase in ('creating','deleted')) as n").get(row.name!,row.name!)!.n;
  assert.equal(row.pending_bindings,direct);assert.equal(logins.hasPendingBinding(String(row.name)),Number(direct)>0);
 }
});


test('capacity migration backfills both fences and preserves counts across reopen',async t=>{
 const root=await mkdtemp(join(tmpdir(),'login-capacity-'));ownDirectory(t,root);
 const path=join(root,'metadata.db');let db=new DatabaseSync(path);onCleanup(t,()=>db.close());let logins=new LoginRecords(db);
 for(const name of ['binding','creating','deleted','settled']){
  logins.insert({name,harness:'codex',account:'work',kind:'disk',exclusive:false,provider:'fake',region:'fake-1',volumeId:'volume-'+name,snapshotIds:[],lastSignIn:null});logins.transition(name,'ready');
 }
 logins.bind('binding',{host:'b',role:'writer',volumeId:'volume-binding',phase:'pending'});
 const creating=readerIntent('creating','c'),deleted=readerIntent('deleted','d');logins.beginReader(creating);logins.beginReader(deleted);logins.saveReader({...deleted,volume:readerVolume(deleted),phase:'deleted'});
 logins.bind('settled',{host:'s',role:'writer',volumeId:'volume-settled'});
 const publicRows=logins.list(),publicBindings=publicRows.map(row=>logins.bindings(row.name));
 // Model the landed pre-counter schema, retaining both types of unresolved work.
 db.exec('drop trigger login_bindings_capacity_insert; drop trigger login_bindings_capacity_delete; drop trigger login_bindings_capacity_update; drop trigger login_readers_capacity_insert; drop trigger login_readers_capacity_delete; drop trigger login_readers_capacity_update; drop index login_capacity_launch; alter table logins drop column pending_bindings');
 db.close();db=new DatabaseSync(path);logins=new LoginRecords(db);
 for(let reopen=0;reopen<2;reopen++){
  assert.deepEqual(logins.list(),publicRows);assert.deepEqual(publicRows.map(row=>logins.bindings(row.name)),publicBindings);
  for(const [name,count] of [['binding',1],['creating',1],['deleted',1],['settled',0]] as const){assert.equal(db.prepare('select pending_bindings as n from logins where name=?').get(name)!.n,count);assert.equal(logins.hasPendingBinding(name),count>0);}
  db.close();db=new DatabaseSync(path);logins=new LoginRecords(db);
 }
 logins.settleBinding('binding','b');logins.refuseReader(creating);logins.completeReader({...deleted,volume:readerVolume(deleted),phase:'deleted'});
 assert.ok(db.prepare('select pending_bindings as n from logins').all().every(row=>row.n===0));
});

test('verdict reads only held bindings and eligible capacity across pending reader history',t=>{
 const probe=sqliteProbe(),db=probe.open(':memory:');const own=ownMetadata(t,db);const records=new HostRecords(db);own(()=>records.leases.close());
 const logins=records.logins;db.exec('begin');
 for(let i=0;i<2000;i++){const name='blocked-'+i;logins.insert({name,harness:'codex',account:'work',kind:'disk',provider:'fake',region:'fake-1',exclusive:false,volumeId:'volume-'+i,snapshotIds:[],lastSignIn:null});logins.transition(name,'ready');logins.beginReader(readerIntent(name,'reader-'+i));}
 db.exec('commit');let visits=0,queries=0,decodes=0;db.function('capacity_visit',(_name:unknown)=>{visits++;return 1;});
 db.prepare('select count(*) from logins not indexed where capacity_visit(name)').get();assert.equal(visits,2000);visits=0;
 probe.mock(t,function(this:DatabaseSync,sql:string){return probe.prepare.call(this,sql.startsWith('select record from logins')?sql.replace(' where ',' where capacity_visit(name) and '):sql);});
 probe.trace(t,()=>{queries++;});const parse=JSON.parse;t.mock.method(JSON,'parse',((source:string)=>{const value=parse(source);if(value?.name)decodes++;return value;}) as typeof JSON.parse);
 assert.equal(loginVerdict(logins,{host:'absent',harness:'codex',provider:'fake',region:'fake-1',account:'work'}),'no-login');
 assert.equal(visits,0);assert.equal(queries,3);assert.equal(decodes,0);
});
