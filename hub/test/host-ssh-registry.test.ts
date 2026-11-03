// T2: registry lifecycle with typed carrier/Git owners; no native process or socket.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { rmdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tempProject } from './harness.ts';
import { beforeDirectories } from './process-cleanup.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { createFakeHost } from './fakes/fake-host.ts';
import { HostRecords, HostSecretStore, hostPaths } from '../src/host/records.ts';
import { projectSshHosts } from '../src/host/registry.ts';
import { remoteHostLayout, remoteCodeDirectory, remoteSupervisor } from '../src/host/remote-layout.ts';

test('default version layout derives code root and supervisor once',()=>{
 const layout=remoteHostLayout('/home/agent');
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
 assert.equal(registry.hosts[0]?.name,'f1');assert.deepEqual(calls,['start']);
 await assert.rejects(registry.close(),/SSH hosts cleanup failed/);
 assert.deepEqual(calls,['start','stop','git-close']);
 fail=false;await registry.close();assert.deepEqual(calls.slice(-2),['stop','git-close']);
});
