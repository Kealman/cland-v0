// T2: in-process projectHub with an injected create path; no native host creation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tempProject, projectHub, connectUi } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import type { CreateHost } from '../src/host/provision-host.ts';

test('hub create entry passes its clock and owner to the injected create path',async t=>{
 const root=await tempProject(t),clock=new FakeClock(new Date());
 let received:Parameters<CreateHost>[0]|undefined;
 const options={clock,createHost:async (input:Parameters<CreateHost>[0])=>{
  received=input;
  return {id:'injected-host',pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:clock.now().toISOString(),state:'creating' as const};
 }};
 const hub=await projectHub(t,root,{},options),ui=await connectUi(t,hub.discovery,'cli');
 const result=await ui.request({type:'host.create',pool:'agents'});
 assert.equal(result.ok,true,result.error);
 assert.equal((result.value as {id:string}).id,'injected-host');
 assert.equal(received?.clock,clock);assert.equal(received?.owner,hub.hostOwner);
 assert.equal(received?.root,root);assert.equal(received?.pool,'agents');
});

test('host list accepts its JSON alias and refuses other extra arguments',async t=>{
 const root=await tempProject(t),clock=new FakeClock(new Date());
 const hub=await projectHub(t,root,{CLAND_FAKE_HOST_ROOT:root},{clock,createHost:async o=>{
  const row={id:'unreachable-host',pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:clock.now().toISOString(),state:'unreachable' as const};
  o.records.provisions.save(row);return row;
 }});
 const ui=await connectUi(t,hub.discovery,'cli');
 assert.equal((await ui.request({type:'host.create'})).ok,true);
 const plain=await cland(root,'host','list'),json=await cland(root,'host','list','--json');
 assert.equal(plain.code,0,plain.stderr);assert.equal(json.code,0,json.stderr);
 assert.deepEqual(JSON.parse(json.stdout),JSON.parse(plain.stdout));
 assert.equal(JSON.parse(json.stdout)[0].state,'unreachable');
 const refused=await cland(root,'host','list','--yaml');assert.equal(refused.code,1);assert.match(refused.stderr,/usage:/);
});
import { cland } from './harness.ts';
