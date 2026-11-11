// T1: atomic provision checkpoint and revoke against one in-memory database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { HostRecords } from '../src/host/records.ts';
import { ProvisionRecords, type ProvisionRecord } from '../src/host/provision-records.ts';
const record:ProvisionRecord={id:'host-one',pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:'2026-11-07T00:00:00Z',state:'cloning',machine:{id:'fake-one',address:'fake-one',created:'2026-11-07T00:00:00Z',architecture:'arm64'}};
function fixture(t:test.TestContext) {
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 const hosts=new HostRecords(db),provisions=new ProvisionRecords(db);
 hosts.insert({id:record.id,address:'fake-one',user:'agent',clientKeyPath:'unused',knownHosts:'unused'},'synthetic');
 provisions.save(record);return {hosts,provisions};
}
test('ready checkpoint refuses a registration revoked at the held final boundary',t=>{
 const f=fixture(t);f.hosts.revoke(record.id);
 assert.throws(()=>f.provisions.ready({...record,state:'ready'}),/revoked|registration/);
 assert.equal(f.provisions.get(record.id)?.state,'failed');assert.equal(f.hosts.get(record.id)?.state,'revoked');
});
test('revocation after ready atomically replaces the provision state',t=>{
 const f=fixture(t);f.provisions.ready({...record,state:'ready'});
 assert.equal(f.provisions.get(record.id)?.state,'ready');f.hosts.revoke(record.id);
 assert.equal(f.provisions.get(record.id)?.state,'failed');assert.equal(f.provisions.get(record.id)?.reason,'host revoked');
});
test('ready checkpoint refuses a different durable machine address',t=>{
 const f=fixture(t);
 assert.throws(()=>f.provisions.ready({...record,state:'ready',machine:{...record.machine!,address:'other'}}),/registration/);
 assert.equal(f.provisions.get(record.id)?.state,'cloning');
});

test('startup inventory streams only current registrations while retaining failed history',t=>{
 const f=fixture(t);
 f.provisions.save({...record,id:'unregistered',state:'failed',release:'incomplete'});
 assert.deepEqual([...f.provisions.registered()].map(row=>row.id),[record.id]);
 f.hosts.revoke(record.id);
 assert.deepEqual([...f.provisions.registered()],[]);
 assert.equal(f.provisions.list().length,2,'explicit inventory still retains both records');
});

test('minimum holding selects only the configured number of ready hosts in that pool',t=>{
 const f=fixture(t);f.provisions.ready({...record,state:'ready'});
 f.hosts.insert({id:'host-two',address:'fake-two',user:'agent',clientKeyPath:'unused',knownHosts:'unused'},'synthetic-two');
 f.provisions.ready({...record,id:'host-two',state:'ready',machine:{...record.machine!,address:'fake-two'}});
 assert.equal(f.provisions.heldByMinimum('host-one','agents',1),true);
 assert.equal(f.provisions.heldByMinimum('host-two','agents',1),false);
 assert.equal(f.provisions.heldByMinimum('host-one','other',1),false);
 assert.equal(f.provisions.heldByMinimum('host-one','agents',0),false);
});

test('state observers see committed readiness and departure, isolate failures and unsubscribe', t => {
 const f=fixture(t), seen:unknown[]=[];
 f.provisions.onChange(()=>{throw Error('observer fault');});
 const unsubscribe=f.provisions.onChange((id,previous,state)=>seen.push([id,previous,state,f.provisions.get(id)?.state]));
 f.provisions.ready({...record,state:'ready'});
 f.provisions.save({...record,state:'destroying'});
 assert.deepEqual(seen,[[record.id,'cloning','ready','ready'],[record.id,'ready','destroying','destroying']]);
 unsubscribe();f.provisions.save({...record,state:'destroyed'});
 assert.equal(seen.length,2);
});

test('active inventory reads only non-terminal rows despite retained history',t=>{
 const f=fixture(t);
 for(let i=0;i<10000;i++)f.provisions.save({...record,id:`history-${i}`,state:i%2?'failed':'destroyed',release:'released'});
 const states=['creating','booting','connecting','cloning','ready','destroying'] as const;
 for(const state of states) {
  const row={...record,id:state,state};
  if(state==='ready') {f.hosts.insert({id:state,address:'fake-one',user:'agent',clientKeyPath:'unused',knownHosts:'unused'},'synthetic');f.provisions.ready(row);}
  else f.provisions.save(row);
 }
 let reads=0;
 const parse=JSON.parse;
 t.mock.method(JSON,'parse',(...args:Parameters<typeof JSON.parse>)=>{reads++;return parse(...args);});
 const rows=[...f.provisions.active()];
 assert.deepEqual(rows.map(row=>row.state).sort(),[...states,'cloning'].sort());
 assert.equal(f.provisions.occupied('agents'),7);
 assert.equal(reads,7,'retained terminal rows are never decoded by active or occupied');
});

test('occupied keeps unresolved failed acquisitions and frees only positive receipts',t=>{
 const f=fixture(t);const {machine:_machine,...bare}=record;f.provisions.save({...bare,state:'failed',acquisition:'pending'});
 assert.equal(f.provisions.occupied('agents'),1);
 f.provisions.save({...record,state:'failed',release:'incomplete'});
 assert.equal(f.provisions.occupied('agents'),1);
 f.provisions.save({...record,state:'failed',release:'released'});
 assert.equal(f.provisions.occupied('agents'),0);
 for(const kind of ['not-called','provider-refused'] as const){
  f.provisions.save({...bare,state:'failed',nonAcquisition:{kind,at:record.created}});
  assert.equal(f.provisions.occupied('agents'),0);
 }
 f.provisions.save({...record,state:'failed',acquisition:'pending',nonAcquisition:{kind:'not-called',at:record.created}});
 assert.equal(f.provisions.occupied('agents'),1,'contradictory receipt cannot free a live machine or pending acquire');
});

test('idle pool close stays synchronous for construction rollback',async t=>{
 const {PoolRuntime}=await import('../src/host/pool-runtime.ts');
 const {readHostPools}=await import('../src/host/pools.ts');
 const f=fixture(t);
 const runtime=new PoolRuntime(()=>readHostPools(undefined),f.hosts,()=>false,()=>[]);
 assert.equal(runtime.close(),undefined);
});

test('occupied rejects relative receipt dates exactly like host spend',t=>{
 const f=fixture(t);const {machine:_machine,...bare}=record;
 f.provisions.save({...bare,state:'failed',nonAcquisition:{kind:'not-called',at:'now'}});
 assert.equal(f.provisions.occupied('agents'),1);
});

test('occupied decodes only unreleased anomalies after 10000 released or destroyed records',t=>{
 const f=fixture(t);const {machine:_machine,...bare}=record;
 for(let i=0;i<10000;i++)f.provisions.save({...record,id:`old-${i}`,state:i%2?'failed':'destroyed',release:'released'});
 f.provisions.save({...bare,id:'pending',state:'failed',acquisition:'pending'});
 f.provisions.save({...record,id:'retained',state:'failed',release:'incomplete'});
 f.provisions.save({...bare,id:'positive',state:'failed',nonAcquisition:{kind:'provider-refused',at:record.created}});
 let reads=0;const parse=JSON.parse;
 t.mock.method(JSON,'parse',(...args:Parameters<typeof JSON.parse>)=>{reads++;return parse(...args);});
 assert.equal(f.provisions.occupied('agents'),3,'fixture cloning plus two unresolved anomalies');
 assert.equal(reads,3,'only pending, retained and positive unreleased candidates are decoded');
});

test('current inventory matches occupied including acquired failures and excluding positive non-acquisition',t=>{
 const f=fixture(t);
 f.provisions.save({...record,id:'failed-acquired',state:'failed',release:'incomplete'});
 f.provisions.save({id:'not-acquired',pool:'agents',provider:'fake',size:'fake',region:'fake',created:record.created,state:'failed',nonAcquisition:{kind:'not-called',at:record.created}});
 f.provisions.save({...record,id:'released',state:'destroyed',release:'released'});
 const rows=[...f.provisions.currentInventory()].filter(row=>row.pool==='agents');
 assert.deepEqual(rows.map(row=>row.id).sort(),['failed-acquired','host-one']);
 assert.equal(rows.length,f.provisions.occupied('agents'));
});

test('usage and reserve share retained-generation and placement-promise capacity',async t=>{
 const {PoolRuntime}=await import('../src/host/pool-runtime.ts');
 const {readHostPools}=await import('../src/host/pools.ts');
 const f=fixture(t);f.provisions.ready({...record,state:'ready'});
 const runtime=new PoolRuntime(()=>readHostPools({agents:{provider:'fake',slots:1,min_hosts:0,max_hosts:1}}),f.hosts,()=>true,()=>[{key:'retained',host:record.id,harness:'codex'}]);
 f.hosts.logins.insert({name:'capacity',harness:'codex',account:'work',kind:'disk',provider:record.provider,region:record.region,volumeId:'volume-capacity',snapshotIds:[],lastSignIn:null});
 f.hosts.logins.transition('capacity','ready');
 const promise=runtime.reserve('agents','codex');
 try {
  assert.deepEqual(runtime.usage(record.id),{usedMilli:500,promisedMilli:500});
  assert.throws(()=>runtime.reserve('agents','codex'),/no host/);
 } finally {promise.release();}
 assert.deepEqual(runtime.usage(record.id),{usedMilli:500,promisedMilli:0});
});
