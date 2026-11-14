// T2: local socket diagnostics against an in-process hub and scripted provider.
import './cover-quiet.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir, writeFile, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {projectHub, tempProject, connectUi, flushProjectLogs} from './harness.ts';
import {FakeClock} from './fake-clock.ts';
import {fakeLockProcesses} from './fakes/lock-processes.ts';
import {fakeDigitalOcean} from './fakes/digitalocean/fake-api.ts';
import {onCleanup} from './process-cleanup.ts';
import {testMessenger} from './fakes/messenger.ts';
import {authenticatedWeb} from './web-frame-client.ts';

test('setup reads unconfigured DigitalOcean token with additive filter and no provider calls', async t => {
 const root=await tempProject(t),processes=fakeLockProcesses().processes;
 const hub=await projectHub(t,root,{}, {clock:new FakeClock(Date.now()),processes,droplet:{processes}});
 const local=await connectUi(t,hub.discovery,'cli');
 const reply=await local.request({type:'host.providers',provider:'digitalocean'});
 assert.equal(reply.ok,true,reply.error);
 assert.deepEqual(reply.value,{providers:[{provider:'digitalocean',tokenNeeded:true,present:false,fingerprint:null}]});
 const old=await local.request({type:'host.providers'});
 assert.deepEqual(old.value,{providers:[]});
});

test('C1/C3 provider diagnostics expose only the hub token fingerprint without provider requests', async t => {
 const root=await tempProject(t),clock=new FakeClock(Date.now()),processes=fakeLockProcesses().processes;
 const token='cland-test-provider-diagnostics';
 const api=await fakeDigitalOcean(token,{machine:'scripted',clock,testContext:t});
 onCleanup(t,()=>api.close());
 await mkdir(join(root,'.cland'),{recursive:true});
 await writeFile(join(root,'.cland/config.toml'),'[hosts.agents]\nprovider="digitalocean"\nmin_hosts=0\n[hosts.second]\nprovider="digitalocean"\nmin_hosts=0\n');
 const hub=await projectHub(t,root,{}, {clock,processes,droplet:{processes,api:api.provider},syntheticProvider:{token,api:api.provider}});
 const local=await connectUi(t,hub.discovery,'cli');
 const before=structuredClone(api.requests);
 const reply=await local.request({type:'host.providers'});
 assert.equal(reply.ok,true,reply.error);
 assert.deepEqual(reply.value,{providers:[{provider:'digitalocean',tokenNeeded:true,present:true,fingerprint:'aea02ac771f2'}]});
 assert.deepEqual(api.requests,before);
 await flushProjectLogs(t,root);
 for(const output of [JSON.stringify(local.frames),await readFile(join(root,'.cland/log/hub.log'),'utf8'),await readFile(join(root,'.cland/journal.jsonl'),'utf8')])assert.equal(output.includes(token),false);
});

test('C2 provider diagnostics distinguish absent tokens and providers needing none', async t => {
 const root=await tempProject(t),processes=fakeLockProcesses().processes;
 await mkdir(join(root,'.cland'),{recursive:true});
 await writeFile(join(root,'.cland/config.toml'),'[hosts.agents]\nprovider="digitalocean"\nmin_hosts=0\n[hosts.localfake]\nprovider="fake"\nmin_hosts=0\n');
 const hub=await projectHub(t,root,{}, {clock:new FakeClock(Date.now()),processes,droplet:{processes}});
 const local=await connectUi(t,hub.discovery,'nvim');
 const reply=await local.request({type:'host.providers'});
 assert.equal(reply.ok,true,reply.error);
 assert.deepEqual(reply.value,{providers:[
  {provider:'digitalocean',tokenNeeded:true,present:false,fingerprint:null},
  {provider:'fake',tokenNeeded:false,present:false,fingerprint:null},
 ]});
});

test('C4 provider diagnostics refuse sessions authenticated web and remote ingress', async t => {
 const root=await tempProject(t),processes=fakeLockProcesses().processes,remote=testMessenger();
 const hub=await projectHub(t,root,{}, {clock:new FakeClock(Date.now()),processes,droplet:{processes},gatewayRemotes:[remote]});
 const local=await connectUi(t,hub.discovery,'cli'),web=await authenticatedWeb(t,local);
 const launched=await local.request({type:'session.launch',name:'worker',role:'implementer',harness:'codex'});
 assert.equal(launched.ok,true,launched.error);
 const {sessionId}=launched.value as {sessionId:string};
 const credential=hub.fakes.codex!.spawns.at(-1)!.launchToken!;
 for(const [client,extra] of [[web,{}],[remote.client,{}],[local,{as:{name:'worker',sessionId,shell:true,credential}}]] as const){
  const reply=await client.request({type:'host.providers',...extra});
  assert.equal(reply.ok,false);assert.match(reply.error!,/forbidden|human|local|permission|authority/i);
 }
 const result=await local.request({type:'host.providers'});
 assert.equal(result.ok,true,result.error);assert.deepEqual(result.value,{providers:[]});
});
