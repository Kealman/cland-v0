// T3: createHost runs native ssh-keygen; no transport or provider network starts.
// The fixture aborts and joins creation before closing storage and deleting its root.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tempProject, eventually, testWaitMs } from './harness.ts';
import { onCleanup } from './process-cleanup.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { Store } from '../src/hub/store.ts';
import { FakeClock } from './fake-clock.ts';
import { FakeHostProvider } from '../src/host/provider/fake.ts';
import { poolImageKey } from '../src/host/provider/pool-image.ts';
import { createHost } from '../src/host/provision-host.ts';
import { readHostPools } from '../src/host/pools.ts';

test('never-booting creation releases at exactly 300000 ms on the hub clock', {timeout:3*testWaitMs()}, async t=>{
 const root=await tempProject(t,'pg-','/tmp'),clock=new FakeClock(new Date()),env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root});
 await mkdir(join(root,'.cland/run/hosts'),{recursive:true});
 await writeFile(join(root,'.cland/config.toml'),'[hosts.agents]\nprovider="fake"\nsize="fake"\nslots=8\nregion="fake-1"\n');
 await writeFile(join(root,'.cland/run/hosts/agents-image.json'),JSON.stringify({key:await poolImageKey(root,env,'fake')}));
 const store=new Store(join(root,'hub.db')),abort=new AbortController();
 const provider=new FakeHostProvider({env,neverBoot:true,now:()=>clock.now().getTime()});
 await provider.prepare({pool:'agents',key:await poolImageKey(root,env,'fake')});
 let probed=false,settled=false;
 const status=provider.status.bind(provider);
 t.mock.method(provider,'status',async (machine:Parameters<typeof provider.status>[0])=>{const result=await status(machine);probed=true;return result;});
 const creating=createHost({root,pool:'agents',clock,env,records:store.hosts,provider,signal:abort.signal,owner:{} as Parameters<typeof createHost>[0]['owner']}).finally(()=>{settled=true;});
 onCleanup(t,async()=>{abort.abort();await creating;store.close();});
 await eventually('machine boot status observed',()=>probed||settled?true:undefined,testWaitMs());
 if(settled)assert.fail(JSON.stringify(await creating));
 await clock.advance(299999);assert.equal(settled,false);
 await clock.advance(1);
 await eventually('failed creation persisted and returned',()=>settled?true:undefined,testWaitMs());
 const record=await creating;
 assert.equal(record.state,'failed');assert.match(record.reason!,/provisioning gate timed out/);
 assert.equal(record.release,'released');assert.equal(store.hosts.provisions.get(record.id)?.release,'released');
 assert.equal((await provider.status(record.machine!)).state,'gone');
});

import { projectSshHosts } from '../src/host/registry.ts';
import { HostSecretStore } from '../src/host/records.ts';

test('tunnel readiness expires at exactly 300000 ms on its injected clock', {timeout:testWaitMs()}, async t=>{
 const root=await tempProject(t),clock=new FakeClock(new Date()),store=new Store(join(root,'hub.db'));
 let reads=0;
 const owner=await projectSshHosts({root,clock,records:store.hosts,env:fixtureEnvironment(root,{}),hubSocket:join(root,'hub.sock'),spokeSocket:join(root,'spoke.sock'),log:()=>{},
 createTransport:()=>({start:async()=>{},stop:async()=>{},status:()=>{reads++;return {name:'held',state:'down',since:null,lastProbe:null,reconnects:0};},forward:async()=>({socket:'unused'}),unforward:async()=>{}}),gitDaemon:async()=>({close:async()=>{}})});
 const abort=new AbortController();let ready:Promise<void>|undefined;
 onCleanup(t,async()=>{abort.abort();await ready?.catch(()=>{});await owner.close();store.close();});
 await owner.add(new HostSecretStore(root,store.hosts).register({id:'held',address:'held',user:'agent',clientKeyPath:'unused',knownHosts:'unused'}));
 let outcome='pending';
 ready=owner.ready('held',abort.signal).then(()=>{outcome='ready';},error=>{outcome=String(error);});
 await eventually('carrier observed down',()=>reads?true:undefined,testWaitMs());
 await clock.advance(299999);assert.equal(outcome,'pending');
 await clock.advance(1);await ready;
 assert.match(outcome,/host tunnel readiness timed out/);
});

test('settings entry publishes durable creating id before held acquisition completes', {timeout:testWaitMs()}, async t=>{
 const root=await tempProject(t,'pg-','/tmp'),clock=new FakeClock(new Date()),env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root});
 await mkdir(join(root,'.cland/run/hosts'),{recursive:true});
 // Settings come from the hub even when this pool is absent from the disk config.
 await writeFile(join(root,'.cland/config.toml'),'');
 await writeFile(join(root,'.cland/run/hosts/selected-image.json'),JSON.stringify({key:await poolImageKey(root,env,'fake')}));
 const store=new Store(join(root,'hub.db')),provider=new FakeHostProvider({env}),release=Promise.withResolvers<void>();
 let id:string|undefined,acquired=false,settled=false;
 t.mock.method(provider,'acquire',async()=>{acquired=true;await release.promise;return {state:'failed' as const,reason:'held fixture acquisition'};});
 const creating=createHost({root,pool:'selected',settings:readHostPools({selected:{provider:'fake',size:'fake',region:'fake-1',slots:8}}).pools.selected!,clock,env,provider,records:store.hosts,owner:{} as Parameters<typeof createHost>[0]['owner'],onCreating:value=>{
  assert.equal(store.hosts.provisions.get(value)?.state,'creating');id=value;
 }}).finally(()=>{settled=true;});
 onCleanup(t,async()=>{release.resolve();await creating.catch(()=>{});store.close();});
 await eventually('provider acquisition held or producer settled',()=>acquired||settled?true:undefined,testWaitMs());
 assert.equal(acquired,true);assert.ok(id);assert.equal(settled,false);
 assert.equal(store.hosts.provisions.get(id)?.pool,'selected');
 assert.equal(store.hosts.provisions.get(id)?.created,clock.now().toISOString());
 release.resolve();assert.equal((await creating).id,id);
});
