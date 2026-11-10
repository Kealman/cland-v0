// T1: login records through in-memory SQLite; no native processes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { LoginRecords, LoginBindingRefused } from '../src/host/logins.ts';

test('disk and key login rows round-trip every field without key disk properties', t => {
 const db = new DatabaseSync(':memory:'); t.after(() => db.close());
 const records = new LoginRecords(db);
 const disk = records.insert({name:'work',harness:'codex',account:'work-account',kind:'disk',provider:'fake',region:'fake-1',volumeId:'vol-1',snapshotIds:['snap-1'],lastSignIn:'2026-11-09T00:00:00Z'});
 assert.deepEqual(records.get('work'),{name:'work',harness:'codex',account:'work-account',kind:'disk',provider:'fake',region:'fake-1',volumeId:'vol-1',snapshotIds:['snap-1'],lastSignIn:'2026-11-09T00:00:00Z',exclusive:true,state:'creating'});
 const key = records.insert({name:'key',harness:'opencode',account:'key-account',kind:'key',lastSignIn:null});
 assert.deepEqual(key,{name:'key',harness:'opencode',account:'key-account',kind:'key',lastSignIn:null,state:'creating'});
 assert.deepEqual(records.list(),[key,disk]);
});

const diskInput = {name:'work',harness:'codex',account:'work',kind:'disk',provider:'fake',region:'fake-1',volumeId:'v1',snapshotIds:[],lastSignIn:null} as const;
test('change notifications identify row saves and binding-only mutations for legacy listeners',t=>{
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());const records=new LoginRecords(db);
 records.insert({...diskInput,exclusive:false,snapshotIds:[]});
 const names:string[]=[];let legacyCalls=0;
 const unsubscribe=records.onChange(name=>names.push(name));
 const legacy=records.onChange(()=>{legacyCalls++;});
 records.transition('work','ready');
 records.bind('work',{host:'writer',role:'writer',volumeId:'v1',phase:'pending'});
 records.settleBinding('work','writer');
 records.bind('work',{host:'reader',role:'reader',volumeId:'v2',phase:'pending'});
 records.unbind('work','reader');
 assert.deepEqual(names,['work','work','work','work','work']);assert.equal(legacyCalls,5);
 unsubscribe();legacy();records.unbind('work','writer');assert.equal(names.length,5);assert.equal(legacyCalls,5);
});
for (const current of ['creating','ready','in-use','signed-out'] as const) {
 for (const target of ['creating','ready','in-use','signed-out'] as const) {
  const allowed = {creating:['ready','signed-out'],ready:['in-use'],'in-use':['ready','signed-out'],'signed-out':['creating']}[current];
  if ((allowed as readonly string[]).includes(target)) continue;
  test(`refuses login transition from ${current} to ${target} naming current state`, t => {
   const db=new DatabaseSync(':memory:');t.after(()=>db.close());const r=new LoginRecords(db);
   r.insert({...diskInput,snapshotIds:[]});
   if(current!=='creating')r.transition('work','ready');
   if(current==='in-use'||current==='signed-out')r.bind('work',{host:'h1',role:'writer',volumeId:'v1'});
   if(current==='signed-out')r.transition('work','signed-out');
   assert.throws(()=>r.transition('work',target),new RegExp('from '+current));
   assert.equal(r.get('work')!.state,current);
  });
 }
}
test('creating is neither free nor bound; bindings enforce exclusive writer and non-exclusive readers', t=>{
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());const r=new LoginRecords(db);
 r.insert({...diskInput,snapshotIds:[]});assert.deepEqual(r.free(),[]);assert.deepEqual(r.bindings('work'),[]);
 assert.throws(()=>r.bind('work',{host:'h1',role:'writer',volumeId:'v1'}),/creating/);
 r.transition('work','ready');assert.equal(r.free().length,1);
 r.bind('work',{host:'h1',role:'writer',volumeId:'v1'});assert.deepEqual(r.free(),[]);
 assert.throws(()=>r.bind('work',{host:'h2',role:'reader',volumeId:'v2'}),/exclusive/);
 r.unbind('work','h1');assert.equal(r.get('work')!.state,'ready');
 r.bind('work',{host:'h1',role:'writer',volumeId:'v1'});r.transition('work','signed-out');
 assert.deepEqual(r.bindings('work'),[]);r.transition('work','creating');r.transition('work','ready');
 r.insert({...diskInput,name:'shared',exclusive:false,snapshotIds:[]});r.transition('shared','ready');
 r.bind('shared',{host:'h1',role:'reader',volumeId:'copy1'});r.bind('shared',{host:'h2',role:'reader',volumeId:'copy2'});
 assert.equal(r.bindings('shared').length,2);r.unbind('shared','h1');assert.equal(r.get('shared')!.state,'in-use');
});
test('login syntax, uniqueness, harness and key disk constraints name their rules', t=>{
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());const r=new LoginRecords(db);
 for(const name of ['', 'Upper','-name','a'.repeat(33)])assert.throws(()=>r.insert({...diskInput,name,snapshotIds:[]}),/name must match/);
 r.insert({...diskInput,snapshotIds:[]});assert.throws(()=>r.insert({...diskInput,snapshotIds:[]}),/unique/);
 assert.throws(()=>r.insert({...diskInput,name:'bad',harness:'other' as 'codex',snapshotIds:[]}),/harness must/);
 assert.throws(()=>r.insert({name:'bad-key',kind:'key',harness:'codex',account:'x',lastSignIn:null}),/opencode/);
 assert.throws(()=>r.insert({name:'bad-key',kind:'key',harness:'opencode',account:'x',lastSignIn:null,volumeId:'v1'} as never),/no disk properties/);
});

for (const [scenario,code] of [
 ['disk volume missing','disk-volume-required'],
 ['writer volume differs','writer-volume-mismatch'],
 ['reader uses original volume','reader-volume-mismatch'],
 ['key has volume','key-volume'],
 ['exclusive second binding','exclusive-writer'],
 ['second writer','writer-conflict'],
] as const) test(`binding invariant: ${scenario} is a typed refusal with no partial write`, t=>{
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());const r=new LoginRecords(db);
 if(scenario==='key has volume')r.insert({name:'work',harness:'opencode',account:'key-account',kind:'key',lastSignIn:null});
 else r.insert({...diskInput,exclusive:scenario==='exclusive second binding',snapshotIds:[]});
 r.transition('work','ready');
 if(scenario==='exclusive second binding'||scenario==='second writer')r.bind('work',{host:'h1',role:'writer',volumeId:'v1'});
 const before=r.get('work'),bindings=r.bindings('work');
 assert.throws(()=>r.bind('work',{host:'h2',role:scenario==='reader uses original volume'?'reader':'writer',volumeId:scenario==='disk volume missing'?null:scenario==='writer volume differs'?'other':'v1'}),
  error=>error instanceof LoginBindingRefused && error.code===code);
 assert.deepEqual(r.get('work'),before);assert.deepEqual(r.bindings('work'),bindings);
});
