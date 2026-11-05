// T2: Sessions ownership with in-memory remote workers and private-file receipts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sessions } from '../src/adapters/sessions.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { HubCore } from '../src/hub/core.ts';
import { localHost } from '../src/host/local.ts';
import { fakeHarness } from './fakes/harness.ts';
import { tempProject } from './harness.ts';

test('revoke settles every harness through its placed Host and fences later access', async t => {
  const root = await tempProject(t), core = new HubCore(), table = new ProcessTable(':memory:', core.clock);
  const workers = new Set<number>(), files = new Set<string>(), stopped: string[] = [];
  let cut = false;
  const machine = {...localHost(),name:'f1',layout:()=>({runDirectory:'/fake/run',logDirectory:'/fake/log',node:'',cli:'',spoke:'',discoveryFile:''}),
    identity:async(pid:number)=>{assert.equal(cut,false);return {pid,pidIdentity:'linux:boot:'+pid};},
    stop:async(p:{pid:number|null})=>{assert.equal(cut,false);workers.delete(p.pid!);return true;},
    listFolder:async()=>{assert.equal(cut,false);return [];},
    removePath:async(path:string)=>{assert.equal(cut,false);files.delete(path);},
  };
  const sessions = new Sessions({root,core,table,hosts:[machine]});
  t.after(async()=>{await sessions.close();table.close();core.close();core.store.close();});
  for (const [index,harness] of (['claude-code','codex','opencode'] as const).entries()) {
    const fake = fakeHarness(harness,{clock:core.clock});
    const row = {...await fake.spawn({name:harness,role:null,model:null,cwd:root}),host:'f1',pid:index+100,pidIdentity:'linux:boot:'+(index+100)};
    table.put(row);workers.add(row.pid);files.add(harness);
    fake.stop=async p=>{const host=sessions.hostForSession(p.sessionId);assert.equal(await host.stop(p),true);await host.removePath(harness);stopped.push(harness);};
    sessions.register(fake);
  }
  const result=await sessions.settleHostBeforeCut('f1',()=>{cut=true;});
  assert.deepEqual(stopped,['claude-code','codex','opencode']);
  assert.equal(workers.size,0);assert.equal(files.size,0);assert.deepEqual(result.leftovers,[]);assert.equal(result.inventoryComplete,true);
  assert.equal(['claude-code','codex','opencode'].every(name=>table.get(name)?.status==='stopped'),true);
  assert.throws(()=>sessions.hostForSession(table.get('codex')!.sessionId).readFile('/fake/private'),/revoked/);
  assert.throws(()=>sessions.validateLaunchHost({name:'new',host:'f1'}),/revocation/);
});

test('held host settlement follows captured identity through rename and name reuse', async t => {
  const { eventually } = await import('./harness.ts');
  const root=await tempProject(t), core=new HubCore(), table=new ProcessTable(':memory:',core.clock);
  const entered=Promise.withResolvers<void>(), release=Promise.withResolvers<void>();
  const stopped:string[]=[];
  const machine={...localHost(),name:'f1',listFolder:async()=>[]};
  const sessions=new Sessions({root,core,table,hosts:[machine,{...machine,name:'f2'}]});
  t.after(async()=>{release.resolve();await sessions.close();table.close();core.close();core.store.close();});
  const fake=fakeHarness('codex',{clock:core.clock});
  const a={...await fake.spawn({name:'a',cwd:root,model:null,role:null}),host:'f1'};
  const b={...await fake.spawn({name:'b',cwd:root,model:null,role:null}),host:'f1'};
  table.put(a);table.put(b);
  fake.stop=async p=>{if(p.sessionId===a.sessionId){entered.resolve();await release.promise;}stopped.push(p.sessionId);};
  sessions.register(fake);
  const run=sessions.settleHostBeforeCut('f1',()=>{});
  let observed=false;void entered.promise.then(()=>{observed=true;});
  await eventually('first captured stop entered',()=>observed||undefined,1000);
  assert.equal(table.rename(b.sessionId,'renamed'),true);
  const replacement={...await fake.spawn({name:'b',cwd:root,model:null,role:null}),host:'f2'};table.put(replacement);
  release.resolve();const report=await run;
  assert.equal(stopped.includes(replacement.sessionId),false,'replacement never inherits cleanup authorization');
  assert.equal(stopped.includes(b.sessionId)||report.leftovers.some(row=>row.generation===b.sessionId),true);
  assert.equal(table.get('b')?.status,'running');
});

test('revoke joins held failed-launch owner and reports it until durable cleanup is cleared', async t => {
  const { FakeClock }=await import('./fake-clock.ts');
  const root=await tempProject(t), core=new HubCore(), table=new ProcessTable(':memory:',core.clock), clock=new FakeClock(Date.now());
  const held=Promise.withResolvers<void>(), entered=Promise.withResolvers<void>();
  let cut=false, remoteReads=0;
  const machine={...localHost(),name:'f1',listFolder:async()=>[],readFile:async()=>{remoteReads++;return Buffer.alloc(0);}};
  const fake=fakeHarness('codex',{clock:core.clock});
  const process={...await fake.spawn({name:'failed',cwd:root,model:null,role:null}),host:'f1'};
  table.pendingStop({process,error:'pending',stages:{stopped:false,rowRemoved:false,roleRolledBack:false}});
  const sessions=new Sessions({root,core,table,hosts:[machine],recoveryClock:clock});
  t.after(async()=>{held.resolve();await sessions.close();table.close();core.close();core.store.close();});
  fake.stop=async()=>{entered.resolve();await held.promise;await sessions.hostForSession(process.sessionId).readFile('/private');};
  sessions.register(fake);
  let observed=false;void entered.promise.then(()=>{observed=true;});
  await clock.advance(5000);assert.equal(observed,true,'pre-existing recovery owner entered');
  const run=sessions.settleHostBeforeCut('f1',()=>{cut=true;},{clock});
  await clock.advance(2000);const report=await run;
  assert.equal(cut,true);
  assert.equal(report.leftovers.some(row=>row.generation===process.sessionId),true,'held cleanup stays named');
  assert.equal(table.pendingStops().length,1);
  held.resolve();await sessions.close();
  assert.equal(remoteReads,0,'late cleanup cannot reach the Host after cut');
});

for(const terminal of ['stop','exit'] as const)for(const retained of ['pruned-row','pruned-row-alias','pruned-row-replaced-alias','pruned-row-session-symlink','pruned-row-replaced-directory','legacy-row','legacy-pruned','older-unknown','untracked-files'] as const)test(`normal OpenCode ${terminal} retains private files until host retirement after restart (${retained})`,async t=>{
  const { OpenCodeAdapter }=await import('../src/adapters/opencode.ts');
  const { OpenCodeClient }=await import('../src/adapters/opencode/client.ts');
  const { fixtureEnvironment }=await import('./fixture-environment.ts');
  const { join }=await import('node:path');
  const { stat }=await import('node:fs/promises');
  const root=await tempProject(t), storage=await tempProject(t), core=new HubCore();
  const aliased=retained==='pruned-row-alias'||retained==='pruned-row-replaced-alias';
  const remote=aliased?join(root,'remote-alias'):storage;
  if(aliased){const {symlink}=await import('node:fs/promises');await symlink(storage,remote,'dir');}
  const archived=retained.startsWith('pruned-row'),positive=retained==='pruned-row'||retained==='pruned-row-alias';
  const path=join(root,'processes.db'),env=fixtureEnvironment(root,process.env);
  let table=new ProcessTable(path),cut=false,stops=0,nativeAlive=true;
  const {FakeClock}=await import('./fake-clock.ts');const timers=new FakeClock(Date.now());
  const adapterClock={now:()=>new Date(),setTimeout:timers.setTimeout.bind(timers),clearTimeout:timers.clearTimeout.bind(timers),setInterval:timers.setInterval.bind(timers),clearInterval:timers.clearInterval.bind(timers)};
  const ended=Promise.withResolvers<{code:number|null;signal:string|null}>();
  const baseHost=localHost(env);
  const machine={...baseHost,name:'f1',layout:()=>({discoveryFile:join(remote,'hub.json'),runDirectory:remote,logDirectory:remote,node:'',cli:'',spoke:''}),
    identity:async(pid:number)=>({pid,pidIdentity:'linux:fixture:123'}),alive:async()=>nativeAlive,
    spawn:async()=>({pid:987654,exited:ended.promise}),freePort:async()=>12345,
    forward:async()=>({socket:join(remote,'session.sock')}),
    stop:async()=>{assert.equal(cut,false);stops++;nativeAlive=false;ended.resolve({code:0,signal:null});return true;},listFolder:baseHost.listFolder,
  };
  t.mock.method(OpenCodeClient.prototype,'request',async(_method:string,path:string)=>path==='/api/session'?{data:{id:'native-session'}}:{data:{}});
  t.mock.method(OpenCodeClient.prototype,'events',async(_event:unknown,opened:()=>void,signal:AbortSignal)=>{opened();if(!signal.aborted)await new Promise<void>(resolve=>signal.addEventListener('abort',()=>resolve(),{once:true}));});
  let sessions=new Sessions({root,core,table,hosts:[machine],env});
  const register=()=>sessions.register(new OpenCodeAdapter(sessions.host({discoveryFile:join(root,'hub.json'),node:'',cli:'',spoke:''}),{env,bin:'unused-native-bin',clock:adapterClock,pollMs:10}));register();
  t.after(async()=>{await sessions.close();table.close();core.close();core.store.close();});
  const view=await sessions.launch({name:'worker',host:'f1',harness:'opencode',cwd:remote,model:'openai/gpt-5.2'});
  if(terminal==='stop')await sessions.stop(view.name);
  else {
    const {eventually}=await import('./harness.ts');
    const exited=eventually('normal OpenCode exit durable row',()=>table.get(view.name)?.status==='exited'||undefined,1000);
    nativeAlive=false;await timers.advance(10);await exited;
  }
  const config=join(remote,'opencode','worker','opencode.json'),password=join(remote,'opencode','worker','password');
  assert.equal((await stat(config)).isFile(),true);assert.equal((await stat(password)).isFile(),true);
  const stopped=table.get(view.name)!;
  assert.equal(stopped.status,terminal==='stop'?'stopped':'exited');assert.equal(stops,1);
  if(retained==='untracked-files'){const {DatabaseSync}=await import('node:sqlite');const db=new DatabaseSync(path);db.exec('delete from harness_host_retirements;delete from harness_processes');db.close();}
  else if(retained==='older-unknown')table.retainHostGeneration({...stopped,pid:987653,pidIdentity:'linux:fixture:previous',startedAt:new Date(Date.parse(stopped.startedAt)-1).toISOString()},'unknown');
  else if(archived){await sessions.archive(view.name,'human');table.removeBatch([stopped]);}else {const {DatabaseSync}=await import('node:sqlite');const db=new DatabaseSync(path);db.exec('delete from harness_host_retirements; update harness_processes set host_retired=0');db.close();if(retained==='legacy-pruned'){await sessions.archive(view.name,'human');table.removeBatch([stopped]);}}
  if(retained==='pruned-row-replaced-alias'){
    const {cp,unlink,symlink}=await import('node:fs/promises'),foreign=await tempProject(t);
    await cp(join(storage,'opencode'),join(foreign,'opencode'),{recursive:true});await unlink(remote);await symlink(foreign,remote,'dir');
  }else if(retained==='pruned-row-replaced-directory'){
    const {cp,rename}=await import('node:fs/promises'),dir=join(remote,'opencode','worker');await rename(dir,dir+'-original');await cp(dir+'-original',dir,{recursive:true});
  }else if(retained==='pruned-row-session-symlink'){
    const {cp,rename,symlink}=await import('node:fs/promises'),foreign=await tempProject(t),dir=join(remote,'opencode','worker');
    await cp(dir,join(foreign,'worker'),{recursive:true});await rename(dir,dir+'-original');await symlink(join(foreign,'worker'),dir,'dir');
  }
  await sessions.close();table.close();table=new ProcessTable(path);
  sessions=new Sessions({root,core,table,hosts:[machine],env});register();
  const result=await sessions.settleHostBeforeCut('f1',()=>{cut=true;});
  assert.equal(result.inventoryComplete,retained!=='pruned-row-session-symlink','unsafe symlink inventory remains explicitly unknown');
  if(!positive){
    if(retained==='untracked-files')assert.equal(result.leftovers.some(row=>row.generation==='opencode-files:worker'&&row.remaining.some(value=>value.includes('opencode.json')&&value.includes('password'))),true,'untracked private files are named without manufacturing process authority');
    else assert.equal(result.leftovers.some(row=>row.session===stopped.name&&(archived?row.reason.includes('cleanup incomplete'):row.reason.includes('native closure'))),true,'unproven or replaced private ownership remains explicitly incomplete');
    assert.equal((await stat(config)).isFile(),true);assert.equal((await stat(password)).isFile(),true);
  }else{
    assert.deepEqual(result.leftovers,[]);
    await assert.rejects(stat(config),{code:'ENOENT'});await assert.rejects(stat(password),{code:'ENOENT'});
  }
  assert.equal(stops,1,'metadata retirement never signals from recovered stop metadata');
  assert.equal([...table.retainedHostGenerations('f1')].length,retained==='older-unknown'?2:retained==='untracked-files'?0:!positive?1:0);
});

test('retained generation enumeration yields to the deadline and preserves unexecuted obligations',async t=>{
  const {FakeClock}=await import('./fake-clock.ts');
  const root=await tempProject(t),core=new HubCore(),table=new ProcessTable(':memory:'),clock=new FakeClock(Date.now());
  const fake=fakeHarness('opencode'),base=await fake.spawn({name:'retained',cwd:root,role:null,model:null});
  for(let index=0;index<256;index++)table.retainHostGeneration({...base,name:'retained'+index,sessionId:'retained-'+index,host:'f1'});
  let settled=0;
  const adapter=Object.assign(fake,{releaseHostGeneration:async()=>{settled++;}});
  const sessions=new Sessions({root,core,table,hosts:[{...localHost(),name:'f1',listFolder:async()=>[]}]});sessions.register(adapter);
  t.after(async()=>{await sessions.close();table.close();core.close();core.store.close();});
  const run=sessions.settleHostBeforeCut('f1',()=>{}, {clock});
  await clock.advance(2000);const result=await run;
  assert.equal(result.timedOut,true);assert.equal(result.inventoryComplete,false);
  assert.ok(result.leftovers.length>0&&result.leftovers.length<=32,'at most one bounded metadata batch was read before cut');
  assert.equal(settled,0,'unexecuted retirement is never counted as complete');
  await sessions.close();assert.equal([...table.retainedHostGenerations('f1')].length,256,'durable obligations remain for every unexecuted generation');
});

test('retirement keeps distinct native generations of one stable session and clears only its owner',async t=>{
  const root=await tempProject(t),table=new ProcessTable(':memory:');t.after(()=>table.close());
  const base=await fakeHarness('opencode').spawn({name:'worker',cwd:root,model:null,role:null});
  const old={...base,host:'f1',pid:101,pidIdentity:'linux:fixture:101'};
  const current={...old,pid:102,pidIdentity:'linux:fixture:102',startedAt:new Date(Date.parse(old.startedAt)+1).toISOString()};
  table.retainHostGeneration(old,'unknown');table.retainHostGeneration(current);
  assert.equal([...table.retainedHostGenerations('f1')].length,2,'a new native generation never overwrites an unresolved prior generation');
  table.clearHostGeneration(current);
  const remaining=[...table.retainedHostGenerations('f1')];assert.equal(remaining.length,1);assert.equal(remaining[0]?.process.pid,old.pid);assert.equal(remaining[0]?.nativeClosure,'unknown');
});

test('retirement reads the prior stable-session storage shape and normalizes only its exact owner',async t=>{
  const {DatabaseSync}=await import('node:sqlite');const {join}=await import('node:path');
  const root=await tempProject(t),path=join(root,'old-retirement.db');
  const p={...await fakeHarness('opencode').spawn({name:'worker',cwd:root,model:null,role:null}),host:'f1',status:'stopped' as const};
  const old=new DatabaseSync(path);old.exec('create table harness_host_retirements(session_id text primary key,host text not null,process_json text not null)');
  old.prepare('insert into harness_host_retirements values (?,?,?)').run(p.sessionId,p.host,JSON.stringify(p));old.close();
  const table=new ProcessTable(path);t.after(()=>table.close());
  const before=[...table.retainedHostGenerations('f1')];assert.equal(before.length,1);assert.equal(before[0]?.nativeClosure,'confirmed');
  table.retainHostGeneration(p);assert.equal([...table.retainedHostGenerations('f1')].length,1,'normalization does not duplicate an old positive receipt');
  table.clearHostGeneration(p);assert.deepEqual([...table.retainedHostGenerations('f1')],[]);
});

test('untracked agent launch records are named without acquiring process authority',async t=>{
  const {join}=await import('node:path');const {mkdir,writeFile}=await import('node:fs/promises');
  const {fixtureEnvironment}=await import('./fixture-environment.ts');const {AGENT_LAUNCH_DIRECTORY}=await import('../src/host/agent/processes.ts');
  const root=await tempProject(t),remote=await tempProject(t),core=new HubCore(),table=new ProcessTable(':memory:');
  const generation='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',directory=join(remote,'run',AGENT_LAUNCH_DIRECTORY,generation);
  await mkdir(directory,{recursive:true});await writeFile(join(directory,'admission.json'),'{}');
  let signals=0;
  const host={...localHost(fixtureEnvironment(root,process.env)),name:'f1',layout:()=>({discoveryFile:join(remote,'hub.json'),runDirectory:join(remote,'run'),logDirectory:remote,node:'',cli:'',spoke:''}),stop:async()=>{signals++;throw new Error('untracked records grant no signal authority');}};
  const sessions=new Sessions({root,core,table,hosts:[host]});t.after(async()=>{await sessions.close();table.close();core.close();core.store.close();});
  const result=await sessions.settleHostBeforeCut('f1',()=>{});
  assert.equal(result.inventoryComplete,true);assert.equal(result.leftovers.some(row=>row.generation==='agent-launch:'+generation&&row.remaining.includes('agent launch records')),true);
  assert.equal(signals,0);
});


const oldBoot='11111111-1111-1111-1111-111111111111',newBoot='22222222-2222-2222-2222-222222222222';
for(const harness of ['claude-code','codex','opencode'] as const)for(const pending of ['none','native','files'] as const)test(`changed-boot closure retains ${harness} resources without native cleanup (${pending})`,async t=>{
  const {join}=await import('node:path');
  const {mkdir,writeFile,readFile}=await import('node:fs/promises');
  const {FakeClock}=await import('./fake-clock.ts');
  const {fixtureEnvironment}=await import('./fixture-environment.ts');
  const {launchGenerationKey}=await import('../src/adapters/launch-generation.ts');
  const root=await tempProject(t),remote=await tempProject(t),core=new HubCore(),clock=new FakeClock(Date.now());
  const path=join(root,'processes.db'),privateFile=join(remote,'outside-run','credential');
  const run=join(remote,'run'),generation='33333333-3333-3333-3333-333333333333';
  await mkdir(join(remote,'outside-run'),{recursive:true});await writeFile(privateFile,'private retained data');
  if(harness==='claude-code'){await mkdir(join(run,'claude'),{recursive:true});await writeFile(join(run,'claude',generation+'.json'),'{}');}
  let nativeCalls=0,adapterCalls=0,cut=false;
  const base=localHost(fixtureEnvironment(root,process.env)),forbidden=async()=>{nativeCalls++;throw new Error('no native authority after reboot');};
  const machine={...base,name:'f1',layout:()=>({discoveryFile:join(remote,'hub.json'),runDirectory:run,logDirectory:remote,node:'',cli:'',spoke:''}),identity:forbidden,processes:forbidden,stop:forbidden,adopt:forbidden};
  let table=new ProcessTable(path),sessions=new Sessions({root,core,table,hosts:[machine],recoveryClock:clock});
  const fake=fakeHarness(harness,{clock:core.clock});
  const p={...await fake.spawn({name:'worker',cwd:remote,model:null,role:null}),host:'f1',pid:987654,pidIdentity:`linux:${oldBoot}:123`};
  const install=()=>{fake.stop=async()=>{adapterCalls++;throw new Error('adapter stop forbidden');};sessions.register(Object.assign(fake,{settleFailedLaunch:async()=>{adapterCalls++;throw new Error('adapter native settlement forbidden');}}));};
  if(pending==='none')table.put(p);else table.pendingStop({process:p,error:'interrupted launch',stages:{stopped:false,rowRemoved:false,roleRolledBack:false},...(pending==='files'?{files:{undo:[{kind:'remove' as const,path:privateFile}],children:[{pid:p.pid,pidStarted:null,pidIdentity:p.pidIdentity,graceMs:0}]}}:{})});
  if(pending!=='none'){await sessions.close();sessions=new Sessions({root,core,table,hosts:[machine],recoveryClock:clock});}
  install();core.store.setMeta(launchGenerationKey(p.sessionId),generation);
  t.after(async()=>{await sessions.close();table.close();core.close();core.store.close();});
  sessions.retainHostGeneration(p,{cause:'host-rebooted',bootId:newBoot});
  assert.equal(nativeCalls,0);assert.equal(adapterCalls,0);
  assert.equal((await readFile(privateFile,'utf8')),'private retained data');
  if(pending==='none')table.update(p.name,{status:'exited'});
  else {assert.equal(table.pendingStops()[0]?.hostRebooted?.bootId,newBoot);if(pending==='files')assert.equal(table.pendingStops()[0]?.files?.undo[0]?.path,privateFile);}
  await sessions.close();table.close();table=new ProcessTable(path);
  sessions=new Sessions({root,core,table,hosts:[machine],recoveryClock:clock});install();
  await clock.advance(5000);
  const retained=[...table.retainedHostGenerations('f1')];
  assert.equal(retained.length,1);assert.equal(retained[0]?.nativeClosure,'confirmed');assert.equal(retained[0]?.hostRebooted?.launchGeneration,generation);
  const report=await sessions.settleHostBeforeCut('f1',()=>{cut=true;},{clock});
  assert.equal(cut,true);assert.equal(report.timedOut,false);assert.equal(report.inventoryComplete,true);
  assert.equal(report.leftovers.some(row=>row.session===p.name&&row.remaining.some(part=>part.includes('private'))),true);
  assert.equal(report.leftovers.some(row=>row.remaining.some(part=>part.includes('worker'))),false,'positive reboot closure never reports an unknown worker');
  assert.equal(nativeCalls,0);assert.equal(adapterCalls,0);assert.equal((await readFile(privateFile,'utf8')),'private retained data');
  if(pending!=='none')assert.equal(table.pendingStops().length,1,'resource ownership is never silently dropped');
  assert.equal([...table.retainedHostGenerations('f1')].length,1);
});

test('changed-boot receipt rejects same boot, malformed proof, foreign and replaced owners',async t=>{
  const root=await tempProject(t),core=new HubCore(),table=new ProcessTable(),sessions=new Sessions({root,core,table,hosts:[{...localHost(),name:'f1',listFolder:async()=>[]}]});
  t.after(async()=>{await sessions.close();table.close();core.close();core.store.close();});
  const fake=fakeHarness('claude-code',{clock:core.clock}),p={...await fake.spawn({name:'worker',cwd:root,model:null,role:null}),host:'f1',pid:123,pidIdentity:`linux:${oldBoot}:1`};
  sessions.register(fake);table.put(p);
  for(const bootId of [oldBoot,'invalid','',newBoot+' '])assert.throws(()=>sessions.retainHostGeneration(p,{cause:'host-rebooted',bootId}),/not proven/);
  for(const changed of [{host:'local'},{host:'other'},{pid:124},{sessionId:'foreign'},{pidIdentity:`linux:malformed:1`}])assert.throws(()=>sessions.retainHostGeneration({...p,...changed},{cause:'host-rebooted',bootId:newBoot}),/unavailable|ownership changed/);
  assert.equal([...table.retainedHostGenerations('f1')].length,0);
  const captured=sessions.hostForSession(p.sessionId);
  sessions.retainHostGeneration(p,{cause:'host-rebooted',bootId:newBoot});
  assert.throws(()=>captured.stop(p),/old-generation native operations/);
  const report=await sessions.settleHostBeforeCut('f1',()=>{});
  assert.equal(report.leftovers.some(row=>row.reason.includes('reboot confirmed native closure')),true,'revoke before exit publication cannot stop old-boot rows');
  assert.throws(()=>sessions.retainHostGeneration(p,{cause:'host-rebooted',bootId:newBoot}),/unavailable/);
});

test('changed boot fences an already-admitted failed-stop continuation before its Host stop',async t=>{
  const {FakeClock}=await import('./fake-clock.ts');
  const {eventually}=await import('./harness.ts');
  const root=await tempProject(t),core=new HubCore(),table=new ProcessTable(),clock=new FakeClock(Date.now());
  const held=Promise.withResolvers<void>(),entered=Promise.withResolvers<void>();let nativeStops=0;
  const machine={...localHost(),name:'f1',listFolder:async()=>[],stop:async()=>{nativeStops++;return true;}};
  const fake=fakeHarness('codex',{clock:core.clock}),p={...await fake.spawn({name:'worker',cwd:root,model:null,role:null}),host:'f1',pid:123,pidIdentity:`linux:${oldBoot}:1`};
  table.pendingStop({process:p,error:'pending',stages:{stopped:false,rowRemoved:false,roleRolledBack:false}});
  const sessions=new Sessions({root,core,table,hosts:[machine],recoveryClock:clock});
  t.after(async()=>{held.resolve();await sessions.close();table.close();core.close();core.store.close();});
  fake.stop=async(process,resumed=work=>work())=>{entered.resolve();await held.promise;await resumed(()=>machine.stop());};sessions.register(fake);
  let admitted=false;void entered.promise.then(()=>{admitted=true;});
  await clock.advance(5000);assert.equal(admitted,true,'native cleanup owner entered before reboot proof');
  sessions.retainHostGeneration(p,{cause:'host-rebooted',bootId:newBoot});
  const fenced=eventually('durable failed cleanup retains the reboot fence',()=>table.pendingStops()[0]?.error.includes('resource retirement remains pending')||undefined,1000);
  held.resolve();await fenced;await clock.advance(5000);
  assert.equal(nativeStops,0);assert.equal(table.pendingStops().length,1);assert.equal(table.pendingStops()[0]?.hostRebooted?.bootId,newBoot);
});

test('reboot receipts preserve distinct Claude generations of the same stable session',async t=>{
  const root=await tempProject(t),core=new HubCore(),table=new ProcessTable(),sessions=new Sessions({root,core,table,hosts:[{...localHost(),name:'f1'}]});
  t.after(async()=>{await sessions.close();table.close();core.close();core.store.close();});
  const fake=fakeHarness('claude-code',{clock:core.clock}),first={...await fake.spawn({name:'worker',cwd:root,model:null,role:null}),host:'f1',pid:123,pidIdentity:`linux:${oldBoot}:1`};
  sessions.register(fake);table.put(first);sessions.retainHostGeneration(first,{cause:'host-rebooted',bootId:newBoot});
  const second={...first,pid:124,pidIdentity:`linux:${oldBoot}:2`};table.put(second);sessions.retainHostGeneration(second,{cause:'host-rebooted',bootId:newBoot});
  assert.equal([...table.retainedHostGenerations('f1')].length,2,'shared display name never discards an older Claude receipt');
  table.clearHostGeneration(second);const remaining=[...table.retainedHostGenerations('f1')];assert.equal(remaining.length,1);assert.equal(remaining[0]?.process.pid,first.pid);
});

for(const storage of ['independent-fence','prior-resource-marker'] as const)test(`completed metadata retirement never reopens a captured old-boot Host before cut or restart (${storage})`,async t=>{
  const {join}=await import('node:path');const {mkdir,writeFile,readFile}=await import('node:fs/promises');
  const {fixtureEnvironment}=await import('./fixture-environment.ts');const {eventually}=await import('./harness.ts');
  const root=await tempProject(t),remote=await tempProject(t),core=new HubCore(),path=join(root,'processes.db');
  let table=new ProcessTable(path),nativeCalls=0,cut=false;
  const entered=Promise.withResolvers<void>(),release=Promise.withResolvers<void>();
  const privateFile=join(remote,'outside-run','password'),readable=join(remote,'readable');
  await mkdir(join(remote,'outside-run'));await writeFile(privateFile,'private');await writeFile(readable,'read remains authorised');
  const base=localHost(fixtureEnvironment(root,process.env));
  const target={...base,name:'f1',layout:()=>({discoveryFile:join(remote,'hub.json'),runDirectory:join(remote,'run'),logDirectory:remote,node:'',cli:'',spoke:''}),
    listFolder:async()=>{entered.resolve();await release.promise;return [];}};
  const machine=new Proxy(target,{get(target,key){if(['stop','run','spawn','launchClaude','adopt'].includes(String(key)))return ()=>{nativeCalls++;throw new Error('underlying native call reached');};return Reflect.get(target,key);}});
  let sessions=new Sessions({root,core,table,hosts:[machine]});
  t.after(async()=>{release.resolve();await sessions.close();table.close();core.close();core.store.close();});
  const fake=fakeHarness('opencode',{clock:core.clock}),p={...await fake.spawn({name:'worker',cwd:remote,model:null,role:null}),host:'f1',pid:123,pidIdentity:`linux:${oldBoot}:1`};
  sessions.register(Object.assign(fake,{releaseHostGeneration:async(_p:unknown,authorize:()=>void)=>{authorize();await base.removePath(privateFile);authorize();}}));
  table.put(p);const captured=sessions.hostForSession(p.sessionId);
  sessions.retainHostGeneration(p,{cause:'host-rebooted',bootId:newBoot});table.update(p.name,{status:'exited'});
  if(storage==='prior-resource-marker'){const {DatabaseSync}=await import('node:sqlite');const old=new DatabaseSync(path);old.exec('delete from harness_host_reboot_closures');old.close();}
  let boundary=false;void entered.promise.then(()=>{boundary=true;});
  const report=sessions.settleHostBeforeCut('f1',()=>{cut=true;});
  await eventually('post-retirement inventory entered',()=>boundary||undefined,1000);
  assert.equal((await base.fileType(privateFile)),'missing','metadata deletion completed');
  assert.equal([...table.retainedHostGenerations('f1')].length,0,'resource receipt is durably cleared');assert.equal(cut,false);
  const command={command:'never-execute',args:[],cwd:remote,env:fixtureEnvironment(root,process.env)};
  const refused=()=>{for(const op of [()=>captured.stop(p),()=>captured.run(command),()=>captured.spawn(command),()=>captured.launchClaude!(command,'33333333-3333-3333-3333-333333333333'),()=>captured.adopt!('33333333-3333-3333-3333-333333333333')])assert.throws(op,/old-generation native operations|revoked/);};
  refused();assert.equal(nativeCalls,0);assert.equal(Buffer.from(await captured.readFile(readable)).toString(),'read remains authorised');
  release.resolve();assert.equal((await report).leftovers.length,0);assert.equal(cut,true);refused();assert.equal(nativeCalls,0);
  await sessions.close();table.close();table=new ProcessTable(path);sessions=new Sessions({root,core,table,hosts:[machine]});
  const recovered=sessions.hostForSession(p.sessionId);
  assert.equal([...table.retainedHostGenerations('f1')].length,0);assert.equal(table.hostGenerationRebooted(p)?.bootId,newBoot,'native fence survives resource completion and storage reopen');
  for(const op of [()=>recovered.stop(p),()=>recovered.run(command),()=>recovered.spawn(command),()=>recovered.launchClaude!(command,'33333333-3333-3333-3333-333333333333'),()=>recovered.adopt!('33333333-3333-3333-3333-333333333333')])assert.throws(op,/old-generation native operations/);
  assert.equal(nativeCalls,0);assert.equal((await readFile(readable,'utf8')),'read remains authorised');
  const replacement={...p,pid:124,pidIdentity:`linux:${newBoot}:2`};table.put(replacement);
  assert.equal(table.hostGenerationRebooted(replacement),undefined,'a new native birth never inherits the old fence');
  assert.throws(()=>sessions.hostForSession(replacement.sessionId).run(command),/underlying native call reached/);assert.equal(nativeCalls,1,'positive control reaches the fake native boundary for the new birth');
  assert.throws(()=>recovered.run(command),/old-generation native operations/);assert.equal(nativeCalls,1,'captured old birth stays fenced after row replacement');
});
