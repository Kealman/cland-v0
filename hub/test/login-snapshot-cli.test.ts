// T2: local CLI snapshots a fake-provider disk through the projectHub socket.
import test from 'node:test';
import assert from 'node:assert/strict';
import {projectHub,tempProject,cland} from './harness.ts';
import {FakeClock} from './fake-clock.ts';
import {fakeLockProcesses} from './fakes/lock-processes.ts';
import {fixtureEnvironment} from './fixture-environment.ts';
import {FakeHostProvider} from '../src/host/provider/fake.ts';
import {Store} from '../src/hub/store.ts';
import {layout} from '../src/project.ts';

test('login snapshot CLI confirms a ready disk and refuses a key with no disk',async t=>{
 const root=await tempProject(t),clock=new FakeClock();
 const env=fixtureEnvironment(root,{}, {CLAND_FAKE_HOST_ROOT:root});
 await projectHub(t,root,env,{clock,processes:fakeLockProcesses().processes,droplet:{processes:fakeLockProcesses().processes}});
 const provider=new FakeHostProvider({env,now:()=>clock.now().getTime()});
 const created=await provider.createVolume({project:root,name:'disk',region:'fake-1',sizeGiB:1});assert.ok(created.state==='created');
 const store=new Store(layout(root).db);
 try{
  store.hosts.logins.insert({name:'work',harness:'codex',account:'work',kind:'disk',provider:'fake',region:'fake-1',volumeId:created.volume.id,snapshotIds:[],lastSignIn:null});store.hosts.logins.transition('work','ready');
  store.hosts.logins.insert({name:'key',harness:'opencode',account:'key',kind:'key',lastSignIn:null});store.hosts.logins.transition('key','ready');
 }finally{store.close();}
 const result=await cland(root,'login','snapshot','work');assert.equal(result.code,0,result.stderr);assert.match(result.stdout,/snapshot confirmed/);
 const read=new Store(layout(root).db);try{const row=read.hosts.logins.get('work');assert.ok(row?.kind==='disk');assert.equal(row.snapshotIds.length,1);}finally{read.close();}
 const key=await cland(root,'login','snapshot','key');assert.equal(key.code,1);assert.match(key.stderr,/key login has no disk/);
 const help=await cland(root,'login','snapshot','--help');assert.equal(help.code,0);assert.match(help.stdout,/login snapshot <name>/);
});
