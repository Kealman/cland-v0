import { mkdir } from 'node:fs/promises';
import { Store } from '../src/hub/store.ts';
import { HostSecretStore } from '../src/host/records.ts';
import { join } from 'node:path';
// T2: real project socket status; no native SSH, carrier is a status-only fake.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tempProject, projectHub, connectUi } from './harness.ts';
import { claimTransport, updateHostWatches } from '../src/transport/transport.ts';
import { describe } from '../src/cli/hub.ts';
import { testHost } from '../src/host/test-host.ts';
import type { HubStatus } from '../src/protocol.ts';
import { FakeClock } from './fake-clock.ts';
import { caseDeadlines } from './case-deadlines.ts';
import { beforeDirectories, guardDirectoryRemoval } from './process-cleanup.ts';
test('revoked host status retains its revocation time and leaves the other host unchanged', async t=>{
  const scope=caseDeadlines(t,{ownership:{beforeDirectories,guardDirectoryRemoval}});
  await scope.run(async step=>{
  const root=await scope.wait('status root setup',()=>step(async()=>{const root=await tempProject(scope.fixtures);scope.adoptRoot(root);return root;}));
  const clock=new FakeClock(Date.now());
  await scope.wait('host metadata setup',()=>step(async()=>{
    await mkdir(join(root,'.cland'),{recursive:true});
    const store=new Store(join(root,'.cland','hub.db'));
    try {for(const id of ['qa1','qa2'])new HostSecretStore(root,store.hosts).register({id,address:id,user:'agent',clientKeyPath:'/unused',knownHosts:'synthetic'});}
    finally {store.close();}
  }));
  const hub=await scope.wait('status hub setup',()=>step(()=>projectHub(scope.fixtures,root,{}, {clock,hosts:['qa1','qa2'].map(id=>({...testHost(id,()=>{}),layout:()=>({runDirectory:join(root,id),logDirectory:join(root,id,'logs'),node:'',cli:'',spoke:'',discoveryFile:''}),listFolder:async()=>[]}))})));
  const ui=await scope.wait('status client setup',()=>step(()=>connectUi(scope.fixtures,hub.discovery,'cli')));
  const before=(await step(()=>ui.request({type:'hub.status'}))).value as HubStatus;
  const revoked=await step(()=>ui.request({type:'host.revoke',host:'qa1'}));
  assert.equal(revoked.ok,true,revoked.error);
  const after=(await step(()=>ui.request({type:'hub.status',history:true}))).value as HubStatus;
  assert.deepEqual(after.hosts?.[0],{name:'qa1',state:'revoked',since:clock.now().toISOString(),revokedAt:clock.now().toISOString(),lastProbe:null,reconnects:0});
  assert.deepEqual(after.hosts?.[1],before.hosts?.[1]);
  assert.match(await step(()=>describe(after)),new RegExp(`qa1  revoked since ${clock.now().toISOString().replaceAll('.','\\.')}`));
  const reopened=new Store(join(root,'.cland','hub.db'));
  try {
    assert.equal(reopened.hosts.get('qa1')?.revokedAt,clock.now().toISOString(),'revocation time survives storage reopen');
    reopened.hosts.revoke('qa1',new Date(clock.now().getTime()+60000).toISOString());
    assert.equal(reopened.hosts.get('qa1')?.revokedAt,clock.now().toISOString(),'repeat revoke keeps the original time');
  } finally { reopened.close(); }
  assert.match(await step(()=>describe({...after,hosts:[{...after.hosts![0]!,since:null,revokedAt:null}]})),/qa1  revoked since unknown/);
  // A new CLI must still read the previous hosts wire shape from an older hub.
  assert.match(await step(()=>describe({...before,hosts:[{name:'legacy',state:'up',since:'2026-11-03T00:00:00.000Z',lastProbe:null,reconnects:3}]})),/legacy  up since 2026-11-03T00:00:00.000Z.*reconnects 3/);
  });
});
test('C6 hub status exposes tunnel facts and CLI tolerates the previous reply shape', async t=>{
  const root=await tempProject(t);
  await mkdir(join(root,'.cland'),{recursive:true});
  const store = new Store(join(root,'.cland','hub.db'));
  new HostSecretStore(root,store.hosts).register({id:'one',address:'one',user:'agent',clientKeyPath:'/unused',knownHosts:'synthetic'}); store.close();
  const hub=await projectHub(t,root,{}, {hosts:[testHost('one',()=>{})]}), ui=await connectUi(t,hub.discovery);
  let facts: import('../src/transport/transport.ts').HostTunnelStatus={name:'one',state:'up' as const,since:'2026-11-03T00:00:00.000Z',lastProbe:{at:'2026-11-03T00:00:30.000Z',ok:true},reconnects:2};
  const release=claimTransport(root,{kind:'ssh',host:'one',start:async()=>{},stop:async()=>{},wake:()=>{},status:()=>facts});t.after(release);
  // Register metadata only; this fixture never starts SSH.
  const status=(await ui.request({type:'hub.status'})).value as HubStatus;
  assert.deepEqual(status.hosts,[facts]);
  const printed=await describe(status);assert.match(printed,/one.*up.*2026-11-03.*probe.*ok.*reconnects 2/);
  facts={...facts,state:'down',reason:'control endpoint has not closed'};
  // A distinct read shape avoids the normal immediate-repeat answer cache.
  const fenced=(await ui.request({type:'hub.status',history:true})).value as HubStatus;
  assert.equal(fenced.hosts?.[0]?.reason,facts.reason);
  assert.match(await describe(fenced),/down.*control endpoint has not closed/);
  updateHostWatches(root,'one',[{path:'/task',branch:'t/task',state:'fenced',cause:'producer result missing'}]);
  const withWatches=(await ui.request({type:'hub.status',flushLogs:true})).value as HubStatus;
  assert.equal(withWatches.hosts?.[0]?.watches?.[0]?.cause,'producer result missing');
  assert.match(await describe(withWatches),/t\/task.*producer result missing/);
  const {hosts:_hosts,...old}=status;
  assert.doesNotMatch(await describe(old),/hosts:/);
});
