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
