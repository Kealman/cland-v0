// T2: runtime registry ownership through typed carriers; no native children.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { testWaitMs } from './until.ts';
import { tempProject } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { HostRecords, HostSecretStore } from '../src/host/records.ts';
import { projectSshHosts } from '../src/host/registry.ts';

test('runtime add opens the same owners and reopens a registered host after close',async t=>{
 const root=await tempProject(t),db=new DatabaseSync(':memory:');
 const records=new HostRecords(db),secrets=new HostSecretStore(root,records),calls:string[]=[];
 const options={root,records,hubSocket:join(root,'hub.sock'),spokeSocket:join(root,'spoke.sock'),env:fixtureEnvironment(root,{}),log:()=>{},
 createTransport:()=>({start:async()=>{calls.push('start');},stop:async()=>{calls.push('stop');},status:()=>({name:'f1',state:'up' as const,since:null,lastProbe:null,reconnects:0}),forward:async()=>({socket:'unused'}),unforward:async()=>{}}),
 gitDaemon:async()=>{calls.push('git-open');return {close:async()=>{calls.push('git-close');}};}};
 const owner=await projectSshHosts(options);t.after(async()=>{await owner.close();db.close();});
 const record=secrets.register({id:'f1',address:'f1',user:'agent',clientKeyPath:join(root,'key'),knownHosts:'fake'});
 await owner.add({state:record.state,user:record.user,address:record.address,transport:record.transport,id:record.id});
 assert.equal(owner.hosts[0]?.name,'f1');assert.deepEqual(calls,['git-open','start']);
 await owner.close();
 const reopened=await projectSshHosts(options);t.after(()=>reopened.close());
 assert.equal(reopened.hosts[0]?.name,'f1');assert.deepEqual(calls.slice(-2),['git-open','start']);
});

test('runtime removal settles before carrier and Git closure and refuses later add',async t=>{
 const root=await tempProject(t),db=new DatabaseSync(':memory:');
 const records=new HostRecords(db),secrets=new HostSecretStore(root,records),calls:string[]=[];
 const record=secrets.register({id:'f1',address:'f1',user:'agent',clientKeyPath:join(root,'key'),knownHosts:'fake'});
 const owner=await projectSshHosts({root,records,hubSocket:join(root,'hub.sock'),spokeSocket:join(root,'spoke.sock'),env:fixtureEnvironment(root,{}),log:()=>{},
 settle:async id=>{calls.push('settle');records.revoke(id);return {leftovers:[]};},
 createTransport:()=>({start:async()=>{},stop:async()=>{calls.push('stop');},status:()=>({name:'f1',state:'up',since:null,lastProbe:null,reconnects:0}),forward:async()=>({socket:'unused'}),unforward:async()=>{}}),
 gitDaemon:async()=>({close:async()=>{calls.push('git-close');}})});
 t.after(async()=>{await owner.close();db.close();});
 assert.deepEqual(await owner.remove(record.id),{leftovers:[]});
 assert.deepEqual(calls,['settle','stop','git-close']);assert.deepEqual(owner.hosts,[]);
 await assert.rejects(owner.add(record),/registration changed/);
});

// Runtime ownership seams use explicit receipts; no native carrier is started.
async function runtimeFixture(t: Parameters<typeof tempProject>[0]) {
 const root=await tempProject(t),db=new DatabaseSync(':memory:');
 const records=new HostRecords(db),secrets=new HostSecretStore(root,records),calls:string[]=[];
 const controls={start:async()=>{},stop:async()=>{},publish:()=>{},release:()=>{}};
 const owner=await projectSshHosts({root,records,hubSocket:join(root,'hub.sock'),spokeSocket:join(root,'spoke.sock'),env:fixtureEnvironment(root,{}),log:()=>{},
  onAdd:()=>{calls.push('publish');controls.publish();},onRemove:()=>{calls.push('unpublish');},
  settle:async id=>{calls.push('settle');records.revoke(id);return {inventoryComplete:true,timedOut:false,leftovers:[]};},
  createTransport:()=>({start:async()=>{calls.push('start');await controls.start();},stop:async()=>{calls.push('stop');await controls.stop();},status:()=>({name:'f1',state:'up',since:null,lastProbe:null,reconnects:0}),forward:async()=>({socket:'unused'}),unforward:async()=>{}}),
  gitDaemon:async()=>{calls.push('git-open');return {close:async()=>{calls.push('git-close');}};}});
 t.after(async()=>{controls.release();controls.stop=async()=>{};await owner.close();db.close();});
 const record=secrets.register({id:'f1',address:'f1',user:'agent',clientKeyPath:join(root,'key'),knownHosts:'fake'});
 return {owner,record,records,calls,controls};
}

test('duplicate runtime add retains the published owner without reacquiring or closing it',async t=>{
 const f=await runtimeFixture(t),host=await f.owner.add(f.record);
 await assert.rejects(f.owner.add(f.record),/already open/);
 assert.deepEqual(f.owner.hosts,[host]);assert.deepEqual(f.calls,['git-open','start','publish']);
 await f.owner.close();assert.deepEqual(f.calls,['git-open','start','publish','stop','git-close']);
});

test('failed runtime publication joins rollback before allowing another add', {timeout:testWaitMs()},async t=>{
 const f=await runtimeFixture(t),entered=Promise.withResolvers<void>(),release=Promise.withResolvers<void>();
 f.controls.release=()=>release.resolve();
 f.controls.publish=()=>{throw new Error('publication refused');};
 f.controls.stop=async()=>{entered.resolve();await release.promise;};
 const failed=assert.rejects(f.owner.add(f.record).catch(error=>{f.calls.push('add-rejected');throw error;}),/publication refused/);
 await entered.promise;
 assert.deepEqual(f.owner.hosts,[]);assert.deepEqual(f.calls,['git-open','start','publish','stop']);
 f.controls.publish=()=>{};
 const retry=f.owner.add(f.record).then(host=>{f.calls.push('retry-resolved');return host;});
 release.resolve();await failed;
 const host=await retry;
 assert.deepEqual(f.owner.hosts,[host]);
 assert.deepEqual(f.calls,['git-open','start','publish','stop','git-close','add-rejected','git-open','start','publish','retry-resolved']);
});

test('failed runtime remove retains ownership and retries cleanup before unpublishing',async t=>{
 const f=await runtimeFixture(t),host=await f.owner.add(f.record);f.calls.length=0;
 f.controls.stop=async()=>{throw new Error('carrier close incomplete');};
 await assert.rejects(f.owner.remove('f1'),/cleanup incomplete/);
 assert.equal(f.records.get('f1')?.state,'revoked');assert.deepEqual(f.owner.hosts,[host]);
 assert.deepEqual(f.calls,['settle','stop','git-close']);
 f.controls.stop=async()=>{};
 assert.deepEqual(await f.owner.remove('f1'),{inventoryComplete:true,timedOut:false,leftovers:[]});
 assert.deepEqual(f.owner.hosts,[]);assert.deepEqual(f.calls,['settle','stop','git-close','settle','stop','git-close','unpublish']);
});

test('shutdown joins an in-flight runtime add and prevents its publication', {timeout:testWaitMs()},async t=>{
 const f=await runtimeFixture(t),entered=Promise.withResolvers<void>(),release=Promise.withResolvers<void>();
 f.controls.release=()=>release.resolve();
 f.controls.start=async()=>{entered.resolve();await release.promise;};
 const failed=assert.rejects(f.owner.add(f.record).catch(error=>{f.calls.push('add-rejected');throw error;}),/registration changed while opening/);
 await entered.promise;
 const closed=f.owner.close().then(()=>{f.calls.push('close-resolved');});
 assert.deepEqual(f.calls,['git-open','start']);
 release.resolve();await failed;await closed;
 assert.deepEqual(f.owner.hosts,[]);assert.deepEqual(f.calls,['git-open','start','stop','git-close','add-rejected','close-resolved']);
 await assert.rejects(f.owner.add(f.record),/owner stopped/);
});
