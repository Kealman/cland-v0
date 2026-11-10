// T2: public session launch over projectHub sockets, recording Host and directory-only provider.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FakeClock } from './fake-clock.ts';
import { fakeLockProcesses } from './fakes/lock-processes.ts';
import { AccountLimits } from '../src/accounts/limits.ts';
import { LoginBinder } from '../src/host/login-binding.ts';
import { projectHub, tempProject, inProcessSpoke, eventually } from './harness.ts';
import { sessionUi } from './session-credential-fixture.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { onCleanup } from './process-cleanup.ts';
import { testHost } from '../src/host/test-host.ts';
import { FakeHostProvider } from '../src/host/provider/fake.ts';
import { Store } from '../src/hub/store.ts';
import { HostSecretStore } from '../src/host/records.ts';
import type { LoginDisk } from '../src/host/agent/resource-types.ts';

async function fixture(t: test.TestContext, limited = false) {
 const root = await tempProject(t);
 const env = fixtureEnvironment(root, process.env, { CLAND_FAKE_HOST_ROOT: root });
 const clock=new FakeClock(Date.now());
 const provider = new FakeHostProvider({ env, now:()=>clock.now().getTime() });
 const acquired = await provider.acquire({project:root,pool:'agents',region:'fake-1',architecture:'x86_64'});
 assert.equal(acquired.state,'created'); if(acquired.state!=='created')throw Error('fixture acquisition failed');
 const machine=acquired.machine;
 await mkdir(join(root,'.cland'),{recursive:true});
 await writeFile(join(root,'.cland/config.toml'),'[hosts.agents]\nprovider="fake"\nsize="fake"\nslots=8\nregion="fake-1"\n');
 await writeFile(join(root,'.cland/roles.toml'),'[implementer.launch]\npool="agents"\n');
 if(limited){
  const metadata=new Store(join(root,'.cland/hub.db'));
  try {new AccountLimits({read:key=>metadata.meta(key),write:(key,value)=>metadata.setMeta(key,value)}).mark('work',{since:clock.now().toISOString(),reason:'fixture exhausted',session:'previous',resetsAt:null});}
  finally {metadata.close();}
 }
 const calls:LoginDisk[]=[];
 const host={...testHost(machine.id,()=>{}),realpath:async(path:string)=>path,statDirectory:async()=>({refusal:null,identity:null}),loginDisk:async(input:LoginDisk)=>{calls.push(input);}};
 const hub=await projectHub(t,root,env as Record<string,string>,{hosts:[host],clock,processes:fakeLockProcesses().processes,droplet:{processes:fakeLockProcesses().processes}});
 const store=new Store(join(root,'.cland/hub.db'));onCleanup(t,()=>store.close());
 new HostSecretStore(root,store.hosts,()=>{}).register({id:machine.id,address:machine.address,user:'fixture',clientKeyPath:'',knownHosts:''});
 store.hosts.provisions.ready({id:machine.id,pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:machine.created,state:'ready',machine});
 const volume=await provider.createVolume({project:root,name:'work-codex',region:'fake-1',sizeGiB:1});
 assert.equal(volume.state,'created');if(volume.state!=='created')throw Error('fixture volume failed');
 store.hosts.logins.insert({name:'work-codex',harness:'codex',account:'work',kind:'disk',provider:'fake',region:'fake-1',volumeId:volume.volume.id,snapshotIds:[],lastSignIn:null});
 store.hosts.logins.transition('work-codex','ready');
 const ui=await sessionUi(t,hub.discovery);
 const launch=(name:string)=>ui.request({type:'session.launch',name,role:'implementer',harness:'codex'});
 return {root,hub,store,provider,machine,volume:volume.volume,calls,launch,ui,host,clock};
}

test('pool launch attaches and mounts a ready login before spawn',async t=>{
 const f=await fixture(t);
 const result=await f.launch('first');assert.equal(result.ok,true,result.error);
 assert.deepEqual(f.calls,[{op:'mount',volume:f.volume.name,path:'/cland/auth/codex-work-codex'}]);
 assert.deepEqual(f.hub.fakes.codex!.spawns[0]!.accountEnv,{CODEX_HOME:'/cland/auth/codex-work-codex'});
 assert.equal(f.store.hosts.logins.get('work-codex')!.state,'in-use');
 assert.deepEqual(f.store.hosts.logins.bindings('work-codex'),[{login:'work-codex',host:f.machine.id,role:'writer',volumeId:f.volume.id,phase:'settled'}]);
 const inventory=await f.provider.listVolumes({project:f.root});assert.equal(inventory.state,'listed');
 if(inventory.state==='listed')assert.equal(inventory.volumes[0]!.attachedTo,f.machine.id);
});

test('second session reuses the binding and records login and account',async t=>{
 const f=await fixture(t);
 for(const name of ['first','second'])assert.equal((await f.launch(name)).ok,true);
 assert.equal(f.calls.length,1);
 const list=await f.ui.request({type:'session.list'});
 const rows=(list.value as {processes:Array<{login?:string;account:string}>}).processes;
 assert.equal(rows.length,2);
 for(const row of rows){assert.equal(row.login,'work-codex');assert.equal(row.account,'work');}
});

test('role account selects a project login without a local account registry',async t=>{
 const f=await fixture(t);
 for(const [name,account,region] of [['a-personal','personal','fake-1'],['b-other-region','work','other-region']]){
  f.store.hosts.logins.insert({name:name!,harness:'codex',account:account!,kind:'disk',provider:'fake',region:region!,volumeId:'volume-ineligible',snapshotIds:[],lastSignIn:null});
  f.store.hosts.logins.transition(name!,'ready');
 }
 await writeFile(join(f.root,'.cland/roles.toml'),'[implementer.launch]\npool="agents"\nharness="codex"\naccount="work"\n');
 const result=await f.launch('pinned');assert.equal(result.ok,true,result.error);
 assert.equal(f.hub.fakes.codex!.spawns[0]!.account,'work');
});

test('mount failure unmounts and detaches before returning login to ready',async t=>{
 const f=await fixture(t);
 f.host.loginDisk=async(input)=>{f.calls.push(input);if(input.op==='mount')throw Error('fixture mount failed');};
 const result=await f.launch('failed');assert.equal(result.ok,false);assert.match(String(result.error),/login work-codex/);
 assert.deepEqual(f.calls.map(c=>c.op),['mount','umount']);
 assert.equal(f.store.hosts.logins.get('work-codex')!.state,'ready');
 const inventory=await f.provider.listVolumes({project:f.root});assert.equal(inventory.state,'listed');
 if(inventory.state==='listed')assert.equal(inventory.volumes[0]!.attachedTo,null);
 assert.equal(f.hub.fakes.codex!.spawns.length,0);
});

test('incomplete rollback retains durable pending fence and refuses later reuse',async t=>{
 const f=await fixture(t);
 f.host.loginDisk=async()=>{throw Error('fixture outcome uncertain');};
 for(const name of ['first','second']){const result=await f.launch(name);assert.equal(result.ok,false);assert.match(String(result.error),/login work-codex: outcome unknown/);}
 assert.equal(f.store.hosts.logins.get('work-codex')!.state,'in-use');
 assert.equal(f.store.hosts.logins.bindings('work-codex')[0]!.phase,'pending');
 assert.equal(f.hub.fakes.codex!.spawns.length,0);
});

test('local launch uses no login even when project disk is ready',async t=>{
 const f=await fixture(t);
 const result=await f.ui.request({type:'session.launch',name:'local',harness:'codex',host:'local'});assert.equal(result.ok,true,result.error);
 assert.equal(f.calls.length,0);assert.equal(f.store.hosts.logins.get('work-codex')!.state,'ready');
 assert.equal(f.hub.fakes.codex!.spawns[0]!.accountEnv,null);
});

test('remote command overlay removes stray harness authentication variables',async()=>{
 const {remoteCommandEnvironment}=await import('../src/host/agent/command-environment.ts');
 const planted={ANTHROPIC_API_KEY:'sentinel',ANTHROPIC_AUTH_TOKEN:'sentinel',OPENAI_API_KEY:'sentinel',CODEX_API_KEY:'sentinel',CODEX_ACCESS_TOKEN:'sentinel',CODEX_HOME:'/cland/auth/codex-work-codex'};
 assert.deepEqual(remoteCommandEnvironment(planted),{CODEX_HOME:'/cland/auth/codex-work-codex'});
});

test('no eligible login refuses with harness and pool before spawning',async t=>{
 const f=await fixture(t);
 f.store.hosts.logins.bind('work-codex',{host:'elsewhere',role:'writer',volumeId:f.volume.id});
 const result=await f.launch('empty');assert.equal(result.ok,false);assert.match(String(result.error),/no login codex in pool agents/);
 assert.equal(f.calls.length,0);assert.equal(f.hub.fakes.codex!.spawns.length,0);
});

test('concurrent launches of one harness share one mounted writer',async t=>{
 const f=await fixture(t);
 const results=await Promise.all([f.launch('one'),f.launch('two')]);
 for(const result of results)assert.equal(result.ok,true,result.error);
 assert.equal(f.calls.length,1);assert.equal(f.store.hosts.logins.bindings('work-codex').length,1);
});

test('process login and mount overlay survive reopening the process table',async t=>{
 const f=await fixture(t);assert.equal((await f.launch('persisted')).ok,true);
 const {ProcessTable}=await import('../src/adapters/processes.ts');
 const table=new ProcessTable(join(f.root,'.cland/hub.db'));onCleanup(t,()=>table.close());
 const row=table.get('persisted')!;assert.equal(row.login,'work-codex');assert.equal(row.account,'work');
 assert.deepEqual(row.accountEnv,{CODEX_HOME:'/cland/auth/codex-work-codex'});
});

test('unknown mount outcome fences binding without another native mutation',async t=>{
 const f=await fixture(t);
 f.host.loginDisk=async input=>{f.calls.push(input);throw Object.assign(Error('native outcome unknown'),{code:'CLAND_HOST_OUTCOME_UNKNOWN'});};
 const result=await f.launch('uncertain');assert.equal(result.ok,false);assert.match(String(result.error),/login work-codex: outcome unknown/);
 assert.deepEqual(f.calls.map(c=>c.op),['mount']);
 assert.equal(f.store.hosts.logins.bindings('work-codex')[0]!.phase,'pending');
});

test('item pool launch preserves project account and mount through admission',async t=>{
 const f=await fixture(t);
 await writeFile(join(f.root,'.cland/roles.toml'),'[reviewer.launch]\npool="agents"\nharness="codex"\naccount="work"\n');
 const made=await f.ui.request({type:'task.create',kind:'epic',title:'Login account work'});assert.equal(made.ok,true,made.error);
 const item=(made.value as {item:{id:string}}).item.id;
 const result=await f.ui.request({type:'session.launch',name:'item-review',role:'reviewer',harness:'codex',item});
 assert.equal(result.ok,true,result.error);
 assert.equal(f.hub.fakes.codex!.spawns[0]!.account,'work');
 assert.deepEqual(f.hub.fakes.codex!.spawns[0]!.accountEnv,{CODEX_HOME:'/cland/auth/codex-work-codex'});
 assert.equal((result.value as {process:{login?:string}}).process.login,'work-codex');
});

for(const invalid of ['missing-item','invalid-name','unknown-role'])test(`invalid ${invalid} launch never binds a login`,async t=>{
 const f=await fixture(t);
 const result=await f.ui.request({type:'session.launch',name:invalid==='invalid-name'?'invalid name':'invalid-launch',role:invalid==='unknown-role'?'not-a-role':'implementer',harness:'codex',...(invalid==='missing-item'?{item:'T-999999'}:{})});
 assert.equal(result.ok,false);assert.equal(f.hub.fakes.codex!.spawns.length,0);
 assert.deepEqual(f.calls,[]);assert.equal(f.store.hosts.logins.get('work-codex')!.state,'ready');
});

for(const fresh of [true,false])test(`${fresh?'fresh':'native'} same-host resume keeps the settled login and mount`,async t=>{
 const f=await fixture(t);assert.equal((await f.launch('resume-worker')).ok,true);
 assert.equal((await f.ui.request({type:'session.stop',session:'resume-worker'})).ok,true);
 const result=await f.ui.request({type:'session.resume',session:'resume-worker',relaunch:true,...(fresh?{fresh:true}:{})});
 assert.equal(result.ok,true,result.error);
 assert.equal((result.value as {process:{login?:string}}).process.login,'work-codex');
 assert.equal(f.calls.length,1);
 const {ProcessTable}=await import('../src/adapters/processes.ts');const table=new ProcessTable(join(f.root,'.cland/hub.db'));onCleanup(t,()=>table.close());
 assert.deepEqual(table.get('resume-worker')!.accountEnv,{CODEX_HOME:'/cland/auth/codex-work-codex'});
});

async function heldBinding(t:test.TestContext,stage:'list'|'attach'|'mount',outcome:'settled'|'unknown') {
 const entered=Promise.withResolvers<void>(),release=Promise.withResolvers<void>(),events:string[]=[];
 let settled=false,enteredHold=false;
 let binding:Promise<unknown>|undefined,closing:Promise<unknown>|undefined,binder:LoginBinder|undefined;
 const close=()=>closing??=Promise.resolve(binder?.close()).then(()=>{events.push('closed');});
 onCleanup(t,async()=>{const draining=close();release.resolve();await Promise.allSettled([binding,draining]);});
 const f=await fixture(t);binder=new LoginBinder(f.store.hosts.logins);
 const hold=async()=>{enteredHold=true;entered.resolve();await release.promise;};
 const uncertain=()=>Object.assign(Error('unknown native outcome'),{code:'CLAND_HOST_OUTCOME_UNKNOWN'});
 if(stage==='list'){
  const list=f.provider.listVolumes.bind(f.provider);
  f.provider.listVolumes=async options=>{await hold();if(outcome==='unknown'){events.push('native-settled');throw uncertain();}const result=await list(options);events.push('native-settled');return result;};
 }else if(stage==='attach'){
  const attach=f.provider.attachVolume.bind(f.provider);
  f.provider.attachVolume=async(volume,machine)=>{await hold();if(outcome==='unknown'){events.push('native-settled');return {state:'failed',reason:'fixture unknown attachment'};}const result=await attach(volume,machine);events.push('native-settled');return result;};
 }else {
  f.host.loginDisk=async input=>{f.calls.push(input);if(input.op==='mount'){await hold();events.push('native-settled');if(outcome==='unknown')throw uncertain();}};
 }
 binding=binder.bind({host:f.host,machine:f.machine,provider:()=>f.provider,providerName:'fake',region:'fake-1',pool:'agents',project:f.root,harness:'codex',account:null,validate:()=>{},checkAccount:()=>{}}).catch(error=>error).finally(()=>{settled=true;});
 await eventually(`held ${stage} producer entered`,()=>enteredHold?true:undefined);
 return {f,events,release,binding,settled:()=>settled,close};
}

for(const stage of ['list','attach','mount'] as const)for(const outcome of ['settled','unknown'] as const)test(`binding close joins held ${stage} to its ${outcome} receipt`,async t=>{
 const held=await heldBinding(t,stage,outcome),closing=held.close();
 await Promise.resolve();held.release.resolve();await Promise.all([held.binding,closing]);
 assert.deepEqual(held.events,['native-settled','closed']);
 const pending=outcome==='unknown'&&stage!=='list';
 assert.equal(held.f.store.hosts.logins.bindings('work-codex')[0]?.phase,pending?'pending':undefined);
 assert.equal(held.f.store.hosts.logins.get('work-codex')!.state,pending?'in-use':'ready');
});

test('a held key login never becomes a disk mount environment',async t=>{
 const f=await fixture(t),binder=new LoginBinder(f.store.hosts.logins);
 f.store.hosts.logins.insert({name:'key-login',kind:'key',harness:'opencode',account:'work',lastSignIn:null});
 f.store.hosts.logins.transition('key-login','ready');f.store.hosts.logins.bind('key-login',{host:f.host.name,role:'writer',volumeId:null});
 await assert.rejects(binder.bind({host:f.host,machine:f.machine,provider:()=>f.provider,providerName:'fake',region:'fake-1',pool:'agents',project:f.root,harness:'opencode',account:null,validate:()=>{},checkAccount:()=>{}}),/incompatible host binding/);
 assert.deepEqual(f.calls,[]);
});

test('an item already claimed by another worker refuses before binding',async t=>{
 const f=await fixture(t);
 const made=await f.ui.request({type:'task.create',title:'Claim owner',size:'M'});assert.equal(made.ok,true,made.error);
 const item=(made.value as {item:{id:string}}).item.id;
 const first=await f.ui.request({type:'session.launch',name:'owner',role:'implementer',harness:'codex',host:'local',item});assert.equal(first.ok,true,first.error);
 for(const name of ['other','invalid name']){
  const second=await f.ui.request({type:'session.launch',name,role:'implementer',harness:'codex',item});
  assert.equal(second.ok,false);assert.match(String(second.error),/claimed by owner/);
 }
 assert.deepEqual(f.calls,[]);assert.equal(f.store.hosts.logins.get('work-codex')!.state,'ready');
});

test('idle item handoff keeps the bound project account without a registry lookup',async t=>{
 const f=await fixture(t);
 await writeFile(join(f.root,'.cland/roles.toml'),'[reviewer.launch]\npool="agents"\nharness="codex"\naccount="work"\n');
 const launch=await f.ui.request({type:'session.launch',name:'reviewer-one',role:'reviewer',harness:'codex'});assert.equal(launch.ok,true,launch.error);
 const before=(launch.value as {process:import('../src/protocol.ts').HarnessProcessView}).process;
 const peer=await inProcessSpoke(t,{cwd:f.root,discover:true,name:before.name,role:'reviewer',sessionId:before.sessionId,assignRole:false});await peer.waitForPresence([before.name]);
 f.hub.fakes.codex!.idle(before.name);
 const made=await f.ui.request({type:'task.create',kind:'epic',title:'Keep bound account'});assert.equal(made.ok,true,made.error);
 const item=(made.value as {item:{id:string}}).item.id;
 const reused=await f.ui.request({type:'session.launch',name:'reviewer-two',role:'reviewer',harness:'codex',item});assert.equal(reused.ok,true,reused.error);
 const after=(reused.value as {process:import('../src/protocol.ts').HarnessProcessView}).process;
 assert.equal(after.sessionId,before.sessionId);assert.equal(after.login,'work-codex');assert.equal(after.account,'work');
 assert.equal(f.calls.length,1);assert.equal(f.hub.fakes.codex!.spawns.length,1);
});

for(const mismatch of ['provider','region'] as const)test(`settled binding with another ${mismatch} is refused without native effects`,async t=>{
 const f=await fixture(t),binder=new LoginBinder(f.store.hosts.logins);
 f.store.hosts.logins.bind('work-codex',{host:f.host.name,role:'writer',volumeId:f.volume.id});
 await assert.rejects(binder.bind({host:f.host,machine:f.machine,provider:()=>f.provider,providerName:mismatch==='provider'?'another':'fake',region:mismatch==='region'?'another':'fake-1',pool:'agents',project:f.root,harness:'codex',account:null,validate:()=>{},checkAccount:()=>{}}),/incompatible host binding/);
 assert.deepEqual(f.calls,[]);
});

test('an unpinned already-limited login account refuses before native binding effects',async t=>{
 const f=await fixture(t,true);
 const attach=FakeHostProvider.prototype.attachVolume,list=FakeHostProvider.prototype.listVolumes;
 let attachments=0,inventories=0;
 t.mock.method(FakeHostProvider.prototype,'listVolumes',async function(this:FakeHostProvider,...args:Parameters<FakeHostProvider['listVolumes']>){inventories++;return list.apply(this,args);});
 t.mock.method(FakeHostProvider.prototype,'attachVolume',async function(this:FakeHostProvider,...args:Parameters<FakeHostProvider['attachVolume']>){attachments++;return attach.apply(this,args);});
 const result=await f.launch('limited');assert.equal(result.ok,false);assert.match(String(result.error),/account work is limited/);
 assert.equal((result as {code?:string}).code,'account-limited');
 assert.equal(inventories,0);assert.equal(attachments,0);assert.deepEqual(f.calls,[]);
 assert.equal(f.store.hosts.logins.get('work-codex')!.state,'ready');assert.deepEqual(f.store.hosts.logins.bindings('work-codex'),[]);
 assert.equal(f.hub.fakes.codex!.spawns.length,0);
});

test('host execution maps mounted login environment while retaining logical input',async t=>{
 const f=await fixture(t);
 const {hostDirectory}=await import('../../shared/fake-host-directory.ts');
 const {symlink}=await import('node:fs/promises');
 const {mountedOpenCodeDatabase}=await import('../src/accounts/registry.ts');
 const execution=await import('../src/host/agent/command-environment.ts');
 assert.equal(typeof execution.loginExecutionEnvironment,'function');
 assert.equal((await f.provider.attachVolume(f.volume,f.machine)).state,'attached');
 const contents=await f.provider.volumeContents(f.volume,f.machine);assert.equal(contents.state,'ready');if(contents.state!=='ready')throw Error('fixture volume contents unavailable');
 const machineRoot=hostDirectory(f.root,f.machine.id),logical='/cland/auth/codex-work-codex';
 await mkdir(join(machineRoot,'cland/auth'),{recursive:true});await symlink(contents.directory,join(machineRoot,'cland/auth/codex-work-codex'));
 const nativeEnv=fixtureEnvironment(f.root,process.env,{CLAND_FAKE_HOST_ROOT:f.root,CLAND_FAKE_HOSTS:f.machine.id,CLAND_HOST_BOOT_ID_FILE:join(machineRoot,'boot-id')});
 const input={CODEX_HOME:logical,CLAUDE_CONFIG_DIR:logical,OPENCODE_DB:mountedOpenCodeDatabase(logical),OPENAI_API_KEY:'sentinel-only'};
 const mapped=await execution.loginExecutionEnvironment(input,nativeEnv);
 assert.deepEqual(mapped,{CODEX_HOME:contents.directory,CLAUDE_CONFIG_DIR:contents.directory,OPENCODE_DB:mountedOpenCodeDatabase(contents.directory)});
 assert.equal(input.CODEX_HOME,logical);assert.equal(input.OPENCODE_DB,mountedOpenCodeDatabase(logical));
 const real=await execution.loginExecutionEnvironment({CODEX_HOME:logical},{});assert.deepEqual(real,{CODEX_HOME:logical});
});

test('held binding body failure drains before borrowed storage closes',async t=>{
 let held:Awaited<ReturnType<typeof heldBinding>>|undefined,storeClosed=false;
 onCleanup(t,async()=>{held?.release.resolve();await held?.binding;if(held&&!storeClosed){held.f.store.close();storeClosed=true;}});
 await t.test('scope returns after rejection with mount held',async scope=>{
  held=await heldBinding(scope,'mount','unknown');
  const close=held.f.store.close.bind(held.f.store);
  held.f.store.close=()=>{try{assert.equal(held!.settled(),true,'borrowed storage closes after producer drainage');}finally{close();storeClosed=true;}};
  await assert.rejects(async()=>{throw Error('forced fixture body rejection');},/forced fixture body rejection/);
 });
 assert.equal(held!.settled(),true);assert.equal(storeClosed,true);
});

test('explicit empty account overrides role pin and selects and reuses an unpinned login',async t=>{
 const f=await fixture(t);
 await writeFile(join(f.root,'.cland/roles.toml'),'[implementer.launch]\npool="agents"\nharness="codex"\naccount="other-account"\n');
 for(const name of ['empty-first','empty-second']){
  const result=await f.ui.request({type:'session.launch',name,role:'implementer',harness:'codex',account:''});
  assert.equal(result.ok,true,result.error);
  const process=(result.value as {process:import('../src/protocol.ts').HarnessProcessView}).process;
  assert.equal(process.account,'work');assert.equal(process.login,'work-codex');
 }
 assert.equal(f.calls.length,1);assert.equal(f.hub.fakes.codex!.spawns.length,2);
 for(const spawn of f.hub.fakes.codex!.spawns)assert.deepEqual(spawn.accountEnv,{CODEX_HOME:'/cland/auth/codex-work-codex'});
});
