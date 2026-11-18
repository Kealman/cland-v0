// T2: registry lifecycle with typed carrier/Git owners; no native process or socket.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { rmdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tempProject } from './harness.ts';
import { beforeDirectories, guardDirectoryRemoval } from './process-cleanup.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { createFakeHost } from './fakes/fake-host.ts';
import { HostRecords, HostSecretStore, hostPaths } from '../src/host/records.ts';
import { projectSshHosts } from '../src/host/registry.ts';
import { VERSION } from '../src/version.ts';
import { remoteHostLayout, remoteCodeDirectory, remoteSupervisor } from '../src/host/remote-layout.ts';
import { caseDeadlines } from './case-deadlines.ts';
import { fakeNativeGuard } from './fake-native-guard.ts';
import { tunnelStatuses, claimTransport } from '../src/transport/transport.ts';

test('legacy revoked records retain unknown time and override stale live carrier status',async t=>{
 const scope=caseDeadlines(t,{ownership:{beforeDirectories,guardDirectoryRemoval}});
 let db:DatabaseSync|undefined,release:(()=>void)|undefined;
 let closing:Promise<void>|undefined;
 const closeResources=()=>closing??=Promise.resolve().then(()=>{release?.();db?.close();});
 scope.fixtures.after(closeResources);
 await scope.run(async step=>{
 const root=await scope.wait('legacy root setup',()=>step(async()=>{const root=await tempProject(scope.fixtures);scope.adoptRoot(root);guardDirectoryRemoval(root,closeResources);return root;}));
 const database=await scope.wait('legacy database setup',()=>step(async()=>{db=new DatabaseSync(':memory:');return db;}));
 database.exec(`create table hosts (id text primary key, transport text not null, address text not null, user text not null, state text not null, secret_digest text not null);
 insert into hosts values ('qa1','ssh','qa1','agent','revoked','synthetic');`);
 const records=new HostRecords(database);
 release=claimTransport(root,{kind:'ssh',host:'qa1',start:async()=>{},stop:async()=>{},wake:()=>{},status:()=>({name:'qa1',state:'up',since:'2026-11-03T00:00:00.000Z',lastProbe:{at:'2026-11-03T00:00:00.000Z',ok:true},reconnects:2})});
 const status=tunnelStatuses(root,records.list())[0]!;
 assert.equal(status.state,'revoked');assert.equal(status.since,null);
 assert.equal((status as typeof status & {revokedAt?:string|null}).revokedAt,null);
 records.revoke('qa1');
 assert.equal(tunnelStatuses(root,new HostRecords(database).list())[0]?.since,null,'repeat revocation cannot invent a legacy timestamp');
 });
});

test('registry never opens a carrier for a revoked host and still starts its registered peer',async t=>{
 const scope=caseDeadlines(t,{ownership:{beforeDirectories,guardDirectoryRemoval}});
 let db:DatabaseSync|undefined,registry:Awaited<ReturnType<typeof projectSshHosts>>|undefined;
 const restorations:Array<()=>void>=[];
 let guard:Awaited<ReturnType<typeof fakeNativeGuard>>|undefined;
 let capturedRoot:string|undefined,closing:Promise<void>|undefined;
 const closeResources=()=>closing??=(async()=>{await registry?.close();db?.close();})();
 scope.fixtures.after(closeResources);
 await scope.run(async step=>{
 try {
 await scope.wait('launch guard setup',()=>step(async()=>{guard=await fakeNativeGuard(restore=>restorations.push(restore));}));
 const root=await scope.wait('registry root setup',()=>step(async()=>{const root=await tempProject(scope.fixtures);capturedRoot=root;scope.adoptRoot(root);guardDirectoryRemoval(root,closeResources);return root;}));
 const records=await scope.wait('registry database setup',()=>step(async()=>{db=new DatabaseSync(':memory:');return new HostRecords(db);}));
 const secrets=new HostSecretStore(root,records);
 for(const id of ['qa1','qa2'])secrets.register({id,address:id,user:'agent',clientKeyPath:'/unused',knownHosts:'synthetic'});
 records.revoke('qa1');
 const env=fixtureEnvironment(root,process.env);
 const started:string[]=[],opened:string[]=[];
 const openedRegistry=await scope.wait('carrier registry setup',()=>step(async()=>{registry=await projectSshHosts({root,records,hubSocket:join(root,'hub.sock'),spokeSocket:join(root,'spoke.sock'),env,log:()=>{},
  createTransport:options=>{opened.push(options.record.id);return {
   start:async()=>{started.push(options.record.id);},stop:async()=>{},
   status:()=>({name:options.record.id,state:'down',since:null,lastProbe:null,reconnects:0}),
   forward:async()=>({socket:'unused'}),unforward:async()=>{},
  };},gitDaemon:async()=>({close:async()=>{}}),
 });return registry;}));
 assert.deepEqual(opened,['qa2']);assert.deepEqual(started,['qa2']);
 await scope.wait('revoked add refusal',()=>step(()=>assert.rejects(openedRegistry.add(records.get('qa1')!),/host registration changed/)));
 assert.deepEqual(opened,['qa2']);
 } finally {
  // Enrolled by the original callback even if acquisition rejects or is cancelled.
  // The scope joins that callback before hooks, then closes resources and roots.
  scope.fixtures.after(async()=>{
   await closeResources();
   if(capturedRoot)await assert.rejects(access(capturedRoot),{code:'ENOENT'},'root removal settled before guard restoration');
   try{guard?.verify();}finally{for(const restore of restorations.reverse())restore();}
  });
 }
 });
});

test('default version layout derives code root and supervisor once',()=>{
 const layout=remoteHostLayout('/home/agent');
 assert.equal(layout.modDir,`/home/agent/.cland-host/code/${VERSION}/hub/mod/cland`);
 assert.equal(remoteHostLayout('/home/agent',{modDir:'/custom/mod'}).modDir,'/custom/mod');
 assert.equal(remoteCodeDirectory(layout),layout.cli.slice(0,-'/hub/bin/cland.ts'.length));
 assert.equal(remoteSupervisor(layout),join(remoteCodeDirectory(layout),'hub/src/host/agent/supervisor.sh'));
});
test('registry startup uses default installed supervisor and cleanup drains all owners after carrier failure',async t=>{
 const root=await tempProject(t),db=new DatabaseSync(':memory:');
 const records=new HostRecords(db),secrets=new HostSecretStore(root,records),fake=await createFakeHost(root,'f1');
 secrets.register({id:'f1',address:'f1',user:'agent',clientKeyPath:join(fake.directory,'client-key'),knownHosts:`f1 ${fake.key}\n`});
 const paths=hostPaths(root,'f1'),calls:string[]=[];let fail=true;
 const registry=await projectSshHosts({root,records,hubSocket:join(root,'hub.sock'),spokeSocket:join(root,'spoke.sock'),env:fixtureEnvironment(root,process.env,{CLAND_FAKE_HOSTS:'f1',CLAND_FAKE_HOST_ROOT:root}),log:()=>{},
  createTransport:options=>{
   assert.equal(options.supervisor,fileURLToPath(new URL('../src/host/agent/supervisor.sh',import.meta.url)));
   return {start:async()=>{await access(options.supervisor);calls.push('start');},stop:async()=>{calls.push('stop');if(fail)throw new Error('synthetic retained socket');},status:()=>({name:'f1',state:'up',since:null,lastProbe:null,reconnects:0}),forward:async()=>({socket:'unused'}),unforward:async()=>{}};
  },gitDaemon:async()=>({close:async()=>{calls.push('git-close');}}),
 });
 beforeDirectories(t,async()=>{fail=false;await registry.close();db.close();if(!paths.socketDirectory.startsWith(root+'/'))await rmdir(paths.socketDirectory).catch(error=>{if(error.code!=='ENOENT')throw error;});});
 assert.equal(registry.hosts[0]!.layout({discoveryFile:'unused',node:'unused',cli:'unused',spoke:'unused'}).modDir,fileURLToPath(new URL('../mod/cland',import.meta.url)));
 assert.equal(registry.hosts[0]?.name,'f1');assert.deepEqual(calls,['start']);
 await assert.rejects(registry.close(),/SSH hosts cleanup failed/);
 assert.deepEqual(calls,['start','stop','git-close']);
 fail=false;await registry.close();assert.deepEqual(calls.slice(-2),['stop','git-close']);
});
