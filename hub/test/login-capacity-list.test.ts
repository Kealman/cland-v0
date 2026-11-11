// T2: capacity via local CLI and projectHub; no native hosts.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {Store} from '../src/hub/store.ts';
import {layout} from '../src/project.ts';
import {projectHub,tempProject,connectUi,cland} from './harness.ts';
import {FakeClock} from './fake-clock.ts';
import {fakeLockProcesses} from './fakes/lock-processes.ts';

test('capacity counts regional exclusive disks and unlimited shared and key logins',async t=>{
 const root=await tempProject(t);
 await mkdir(join(root,'.cland'),{recursive:true});
 await writeFile(join(root,'.cland/config.toml'),'[hosts.agents]\nprovider="fake"\nregion="fake-1"\nslots=4\nmin_hosts=0\nmax_hosts=3\n');
 const clock=new FakeClock(Date.now());
 const hub=await projectHub(t,root,{}, {clock,processes:fakeLockProcesses().processes,droplet:{processes:fakeLockProcesses().processes}});
 const store=new Store(layout(root).db);
 try {
  for(const [name,region] of [['one','fake-1'],['two','fake-1'],['elsewhere','fake-2']]){
   store.hosts.logins.insert({name:name!,harness:'codex',account:name!,kind:'disk',provider:'fake',region:region!,volumeId:name!,snapshotIds:[],lastSignIn:null});store.hosts.logins.transition(name!,'ready');
  }
  store.hosts.logins.insert({name:'shared',harness:'claude-code',account:'shared',kind:'disk',exclusive:false,provider:'fake',region:'fake-1',volumeId:'shared',snapshotIds:[],lastSignIn:null});store.hosts.logins.transition('shared','ready');
  store.hosts.logins.insert({name:'key',harness:'opencode',account:'key',kind:'key',lastSignIn:null});store.hosts.logins.transition('key','ready');
  store.hosts.logins.recordStorage('one','agents',{kind:'volume',id:'one',sizeGiB:1,created:clock.now().toISOString(),deleted:null});
 }finally{store.close();}
 const ui=await connectUi(t,hub.discovery,'cli');
 const json=await cland(root,'login','list','--json');assert.equal(json.code,0,json.stderr);
 assert.doesNotMatch(json.stdout,/storage_through|storage_pool|9999-12-31/);
 const result=await ui.request({type:'host.status'});assert.equal(result.ok,true,result.error);
 assert.doesNotMatch(JSON.stringify(result.value),/storage_through|storage_pool|9999-12-31/);
 assert.deepEqual((result.value as {pools:{capacity:unknown}[]}).pools[0]!.capacity,{'claude-code':3,codex:2,opencode:3});
 const text=await cland(root,'login','list');assert.equal(text.code,0,text.stderr);
 for(const line of ['capacity agents/codex: 2','capacity agents/claude-code: 3','capacity agents/opencode: 3'])assert.ok(text.stdout.includes(line),line);
 const changed=new Store(layout(root).db);
 try{
  changed.hosts.logins.bind('one',{host:'h1',role:'writer',volumeId:'one'});
  changed.hosts.logins.bind('two',{host:'h2',role:'writer',volumeId:'two',phase:'pending'});
  changed.hosts.logins.bind('shared',{host:'h1',role:'writer',volumeId:'shared'});
  changed.hosts.logins.bind('key',{host:'h1',role:'writer',volumeId:null});
 }finally{changed.close();}
 const bound=await ui.request({type:'host.status'});assert.equal(bound.ok,true,bound.error);
 assert.deepEqual((bound.value as {pools:{capacity:unknown}[]}).pools[0]!.capacity,{'claude-code':3,codex:0,opencode:3});
});
