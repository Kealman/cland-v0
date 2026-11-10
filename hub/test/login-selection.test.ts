// T2: indexed SQLite metadata selection and legacy migration; no process, socket or real login.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { LoginRecords } from '../src/host/logins.ts';
import { sqliteProbe } from './sqlite-probe.ts';
import { ownDirectory, onCleanup } from './process-cleanup.ts';

const disk=(name:string,harness:'codex'|'opencode'|'claude-code'='codex',region='wanted',account='work')=>({name,harness,account,kind:'disk' as const,provider:'fake',region,volumeId:`volume-${name}`,snapshotIds:[`snapshot-${name}-old`,`snapshot-${name}-new`],lastSignIn:null});

test('launch selection has fixed indexed query and decode work across ten thousand retained logins',async t=>{
 // Coordinator6ee8b256: new domain has no live corpus; fake-only data is required.
 const root=await mkdtemp(join(tmpdir(),'login-selection-'));ownDirectory(t,root);
 const probe=sqliteProbe(),db=probe.open(join(root,'metadata.db'));onCleanup(t,()=>db.close());
 const records=new LoginRecords(db);
 db.exec('begin');
 try {
  for(let i=0;i<10000;i++){
   const name=`history-${String(i).padStart(5,'0')}`,harness=(['codex','opencode','claude-code'] as const)[i%3]!;
   records.insert(disk(name,harness,`other-${i%4}`,`account-${i%7}`));
   if(i%4<2)records.transition(name,'signed-out');else if(i%4===2)records.transition(name,'ready');
  }
  records.insert(disk('wanted'));records.transition('wanted','ready');
  records.insert(disk('other-account','codex','wanted','z-personal'));records.transition('other-account','ready');
  db.exec('commit');
 }catch(error){db.exec('rollback');throw error;}
 let observing=false,queries=0,decoded=0,historyDecoded=0;
 const plans:string[]=[];
 probe.trace(t,function(sql,method,bindings){
  if(!observing)return;queries++;
  assert.ok(method==='all'||method==='get','hot path only reads');
  plans.push(...probe.prepare.call(this,'explain query plan '+sql).all(...bindings as SQLInputValue[]).map(row=>String(row.detail)));
 });
 const parse=JSON.parse;
 const spy=t.mock.method(JSON,'parse',((source:string,...args:Parameters<typeof JSON.parse> extends [string,...infer R]?R:never)=>{
  const value=parse(source,...args);
  if(value&&typeof value==='object'&&typeof value.name==='string'){decoded++;if(value.name.startsWith('history-'))historyDecoded++;}
  return value;
 }) as typeof JSON.parse);
 // Positive control before hot-path checks: a retained-history scan must be seen.
 records.list();assert.equal(historyDecoded,10000);t.diagnostic('decode guard positive control observed all10000 history rows');
 const select=(account:string|null)=>{
  queries=0;decoded=0;historyDecoded=0;plans.length=0;observing=true;
  try{return records.selectForLaunch({host:'target',harness:'codex',provider:'fake',region:'wanted',account});}
  finally{observing=false;}
 };
 for(const account of [null,'work']){
  const result=select(account);assert.equal(result.ready?.name,'wanted');assert.deepEqual(result.held,[]);
  assert.equal(queries,2);assert.equal(decoded,1);assert.equal(historyDecoded,0);
  assert.ok(plans.some(plan=>plan.includes('login_bindings_launch')));assert.ok(plans.some(plan=>plan.includes('login_ready_launch')));
  assert.ok(plans.every(plan=>!/^SCAN |USE TEMP B-TREE/.test(plan)),plans.join('\n'));
 }
 records.bind('wanted',{host:'target',role:'writer',volumeId:'volume-wanted'});
 let result=select(null);assert.equal(result.held[0]!.login.name,'wanted');assert.equal(result.ready,null);assert.equal(queries,1);assert.equal(decoded,1);assert.equal(historyDecoded,0);
 records.insert(disk('conflict'));records.transition('conflict','ready');records.bind('conflict',{host:'target',role:'writer',volumeId:'volume-conflict'});
 result=select(null);assert.equal(result.held.length,2);assert.equal(result.ready,null);assert.equal(queries,1);assert.equal(decoded,2);assert.equal(historyDecoded,0);
 spy.mock.restore();
});

test('stage-one login database migrates private binding harness and indexes without changing public rows',async t=>{
 const root=await mkdtemp(join(tmpdir(),'login-selection-migration-'));ownDirectory(t,root);
 const db=new DatabaseSync(join(root,'metadata.db'));onCleanup(t,()=>db.close());
 const old=new LoginRecords(db);old.insert(disk('old'));old.transition('old','ready');old.bind('old',{host:'target',role:'writer',volumeId:'volume-old'});
 old.insert({name:'key-old',kind:'key',harness:'opencode',account:'work',lastSignIn:null});
 const rows=old.list(),bindings=old.bindings('old');
 // Schema-only downgrade models stage1; every row was written via public API.
 db.exec('drop index if exists login_bindings_launch; drop index if exists login_ready_launch; drop index if exists login_bindings_pending');
 if(db.prepare('pragma table_info(login_bindings)').all().some(row=>row.name==='harness'))db.exec('alter table login_bindings drop column harness');
 db.exec('alter table login_bindings drop column phase');
 const exec=db.exec.bind(db);
 const fault=t.mock.method(db,'exec',((sql:string)=>{if(sql.startsWith('create index if not exists login_bindings_launch'))throw Error('forced migration index failure');return exec(sql);}) as typeof db.exec);
 assert.throws(()=>new LoginRecords(db),/forced migration index failure/);
 assert.equal(db.prepare('pragma table_info(login_bindings)').all().some(row=>row.name==='harness'),false,'failed index creation rolls back private column/backfill');
 assert.deepEqual(old.list(),rows);fault.mock.restore();
 const migrated=new LoginRecords(db);assert.deepEqual(migrated.list(),rows);assert.deepEqual(migrated.bindings('old'),bindings);
 assert.equal(db.prepare('select harness from login_bindings where login=?').get('old')!.harness,'codex');
 assert.equal(migrated.selectForLaunch({host:'target',harness:'codex',provider:'fake',region:'wanted',account:null}).held[0]!.login.name,'old');
});
