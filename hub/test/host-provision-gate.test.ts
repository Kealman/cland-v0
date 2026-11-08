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
 const acquire=provider.acquire.bind(provider);
 t.mock.method(provider,'acquire',async(input:Parameters<typeof provider.acquire>[0])=>{const lease=store.hosts.leases.get(store.hosts.provisions.list()[0]!.id);assert.equal(lease?.deadline,new Date(clock.now().getTime()+43200000).toISOString());return acquire(input);});
 const status=provider.status.bind(provider);
 t.mock.method(provider,'status',async (machine:Parameters<typeof provider.status>[0])=>{const result=await status(machine);probed=true;return result;});
 const creating=createHost({root,pool:'agents',clock,env,records:store.hosts,provider,signal:abort.signal,owner:{} as Parameters<typeof createHost>[0]['owner']}).finally(()=>{settled=true;});
 onCleanup(t,async()=>{abort.abort();await creating;await store.hosts.leases.close();store.close();});
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

for(const outcome of ['refused','unknown'] as const)test(`acquire ${outcome} pins cancellation authority without confusing an unknown outcome`,async t=>{
 const root=await tempProject(t),clock=new FakeClock(),env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root});
 await mkdir(join(root,'.cland/run/hosts'),{recursive:true});
 await writeFile(join(root,'.cland/config.toml'),'[hosts]\nlease="30s"\n[hosts.agents]\nprovider="fake"\nsize="fake"\nslots=8\n');
 await writeFile(join(root,'.cland/run/hosts/agents-image.json'),JSON.stringify({key:await poolImageKey(root,env,'fake')}));
 const store=new Store(join(root,'hub.db')),fake=new FakeHostProvider({env});
 onCleanup(t,async()=>{await store.hosts.leases.close();store.close();});
 let calls=0;
 const provider={...fake,declarations:{...fake.declarations,prices:{fake:{livePerHour:2,idleComputePerHour:0,idlePerHour:0}}},createAdmission:()=>({state:'allowed' as const}),acquire:async()=>{calls++;if(outcome==='unknown')throw Error('lost provider reply');return {state:'refused',reason:'no machine admitted',retryAt:clock.now().toISOString()};}} as unknown as NonNullable<Parameters<typeof createHost>[0]['provider']>;
 const result=await createHost({root,clock,env,provider,records:store.hosts,owner:{} as Parameters<typeof createHost>[0]['owner']});
 assert.equal(calls,1);assert.equal(result.state,'failed');
 const {spendPath}=await import('../src/executor/droplet/spend.ts');
 const ledger=JSON.parse(await (await import('node:fs/promises')).readFile(spendPath(env),'utf8'));
 if(outcome==='refused'){assert.equal(result.nonAcquisition?.kind,'provider-refused');assert.equal(result.release,'released');assert.equal(store.hosts.leases.get(result.id),null);assert.equal(ledger.entries[0].cost,0);}
 else {assert.equal(result.acquisition,'pending');assert.equal(result.release,'incomplete');assert.ok(store.hosts.leases.get(result.id));assert.equal(ledger.entries[0].cost,null);await assert.rejects(store.hosts.leases.cancel(result.id,{root,env,clock}),/non-acquisition receipt/);}
});

test('pending acquire checkpoints unknown at five minutes and destroys a late identity', {timeout:3*testWaitMs()},async t=>{
 const root=await tempProject(t,'pg-','/tmp'),clock=new FakeClock(new Date()),env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root});
 await mkdir(join(root,'.cland/run/hosts'),{recursive:true});
 await writeFile(join(root,'.cland/config.toml'),'[hosts.agents]\nprovider="fake"\nsize="fake"\nslots=8\nregion="fake-1"\n');
 const key=await poolImageKey(root,env,'fake');
 await writeFile(join(root,'.cland/run/hosts/agents-image.json'),JSON.stringify({key}));
 const store=new Store(join(root,'hub.db')),provider=new FakeHostProvider({env,now:()=>clock.now().getTime()}),release=Promise.withResolvers<void>();
 await provider.prepare({pool:'agents',key});
 const acquire=provider.acquire.bind(provider);let called=false,done=false;const notices:string[]=[];
 t.mock.method(provider,'acquire',async (input:Parameters<typeof provider.acquire>[0])=>{called=true;await release.promise;return acquire(input);});
 let creating:ReturnType<typeof createHost>|undefined;
 onCleanup(t,async()=>{release.resolve();try{await creating;}finally{try{await store.hosts.leases.close();}finally{store.close();}}});
 creating=createHost({root,clock,env,records:store.hosts,provider,owner:{} as Parameters<typeof createHost>[0]['owner'],onBootFailure:row=>notices.push(row.id)}).finally(()=>{done=true;});
 void creating.catch(()=>{});
 await eventually('acquire entered',()=>called?true:undefined);
 const id=store.hosts.provisions.list()[0]!.id;
 await clock.advance(299999);assert.deepEqual(notices,[]);assert.equal(done,false);
 await clock.advance(1);
 assert.equal(store.hosts.provisions.get(id)?.state,'failed');assert.equal(store.hosts.provisions.get(id)?.acquisition,'pending');
 assert.equal(store.hosts.provisions.occupied('agents'),1);assert.deepEqual(notices,[id]);assert.equal(done,false);
 await clock.advance(60000);assert.equal(store.hosts.provisions.occupied('agents'),1);assert.deepEqual(notices,[id]);
 release.resolve();const row=await creating;
 assert.equal(row.release,'released');assert.equal((await provider.status(row.machine!)).state,'gone');assert.deepEqual(notices,[id]);
 const {destroyHost}=await import('../src/host/provision-host.ts');
 const destroyed=await destroyHost({root,id,clock,env,records:store.hosts,provider,owner:{} as Parameters<typeof destroyHost>[0]['owner'],log:()=>{}});
 assert.equal(destroyed.state,'destroyed');assert.ok(destroyed.machineDeletionRead);assert.equal(store.hosts.provisions.occupied('agents'),0);
});

for(const phase of ['status','ssh'] as const)test(`identified machine ${phase} is cancelled at its boot deadline and deletion confirmed`,{timeout:3*testWaitMs()},async t=>{
 const root=await tempProject(t,'pg-','/tmp'),clock=new FakeClock(new Date()),ssh=join(root,'held-ssh'),marker=join(root,'ssh-entered');
 const env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root,CLAND_TEST_HOST_BOOT_MS:'1000',CLAND_SSH_BIN:ssh});
 await mkdir(join(root,'.cland/run/hosts'),{recursive:true});
 await writeFile(join(root,'.cland/config.toml'),'[hosts.agents]\nprovider="fake"\nsize="fake"\nslots=8\nregion="fake-1"\n');
 const key=await poolImageKey(root,env,'fake');await writeFile(join(root,'.cland/run/hosts/agents-image.json'),JSON.stringify({key}));
 await writeFile(ssh,`#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(marker)},'entered');setInterval(()=>{},1000);\n`,{mode:0o700});
 const store=new Store(join(root,'hub.db')),provider=new FakeHostProvider({env,now:()=>clock.now().getTime()}),abort=new AbortController();
 let creating:ReturnType<typeof createHost>|undefined,entered=false,joined=false;
 onCleanup(t,async()=>{abort.abort();try{await creating;}finally{try{await store.hosts.leases.close();}finally{store.close();}}});
 await provider.prepare({pool:'agents',key});
 const originalStatus=provider.status.bind(provider);
 if(phase==='status')t.mock.method(provider,'status',async (_machine:Parameters<typeof provider.status>[0],scope:Parameters<typeof provider.status>[1])=>{
  assert.ok(scope?.signal);entered=true;
  try{await new Promise<void>((_resolve,reject)=>scope.signal!.addEventListener('abort',()=>reject(scope.signal!.reason),{once:true}));}
  finally{joined=true;}
  return {state:'ready' as const};
 });
 creating=createHost({root,clock,env,records:store.hosts,provider,signal:abort.signal,owner:{} as Parameters<typeof createHost>[0]['owner']});void creating.catch(()=>{});
 await eventually('known-machine probe entered',async()=>{
  const observed=phase==='status'?entered:await import('node:fs/promises').then(fs=>fs.readFile(marker,'utf8').then(value=>value==='entered',()=>false));
  return observed?true:undefined;
 });
 // The probe may begin after acquisition I/O, but the same clock has not advanced.
 await clock.advance(999);assert.equal(store.hosts.provisions.list()[0]!.state,'booting');
 await clock.advance(1);const row=await creating;
 assert.equal(row.release,'released');assert.equal((await originalStatus(row.machine!)).state,'gone');
 if(phase==='status')assert.equal(joined,true);
 else assert.match(row.reason!,/SIGKILL|timed out/);
});
