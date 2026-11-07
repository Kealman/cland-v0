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
