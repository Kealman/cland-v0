// T3: real SSH carrier loss, native worker birth, checkout and socket receive-pack lease transfer.
// Lifecycle: each sshHostFixture joins agents, carriers, Git and workers before deleting its root.
import test from 'node:test';
import {withFixtureStore} from './fixture-store.ts';
import {mountedSettledLogin} from './settled-login-fixture.ts';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, unlink,access } from 'node:fs/promises';
import { sshHostFixture } from './ssh-host-fixture.ts';
import { projectHub, eventually, testWaitMs } from './harness.ts';
import { sessionUi } from './session-credential-fixture.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { fakeHarness } from './fakes/harness.ts';
import { hostControl } from './fakes/fake-host.ts';
import { ensureHostClone, hostCloneRoot } from '../src/host/clone.ts';
import { territoryGitAsync, territoryPath, refreshTerritoryHook } from '../src/territory.ts';
import { startGitDaemon } from '../src/host/git-daemon.ts';
import { hostPaths } from '../src/host/records.ts';
import { AgentClient } from '../src/host/agent-client.ts';
import { remoteRedactor } from '../src/remote/redact.ts';
import { Store } from '../src/hub/store.ts';
import { hostRelaunchIntentKey } from '../src/host/relaunch-state.ts';
import { territoryLockHeld } from '../src/territory-lock-context.ts';
import { ProcessTable, hostGenerationKey } from '../src/adapters/processes.ts';
import { setRoleKey } from '../src/roles/editor.ts';
import type { HarnessProcessView } from '../src/protocol.ts';
const NATIVE_COMPLETION_MS=5000;

test('nested provider cleanup joins its captured machine after close rejection and leaves sibling alive',async t=>{
 const first=await sshHostFixture(t,{provider:{region:'fake-1'}});
 let closeNested:(()=>Promise<void>)|undefined,nestedClosed=false;
 const second=await sshHostFixture({after:close=>{closeNested=close;first.addCleanup(async()=>{if(!nestedClosed){await close();nestedClosed=true;}});}},{provider:{root:first.root,project:first.root,region:'fake-1'}});
 const spawn=async(f:typeof first)=>{
  const ready=join(f.fake.home,'cleanup-worker.ready');
  const child=await f.host.spawn({command:process.execPath,args:['-e',"require('fs').writeFileSync(process.argv[1],'ready');setInterval(()=>{},1000)",ready],cwd:f.fake.home,env:fixtureEnvironment(f.root,f.env)});void child.exited.catch(()=>{});
  await eventually('captured fixture worker readiness',()=>readFile(ready,'utf8').then(value=>value==='ready'?true:undefined).catch(()=>undefined),testWaitMs());
  const birth=await f.host.identity(child.pid);assert.ok(birth,'worker has a captured native identity');return {...child,...birth};
 };
 const sibling=await spawn(first),target=await spawn(second);
 const observer=await AgentClient.connect(second.agent.socket,second.secrets.readSecret('f1'));first.addCleanup(()=>observer.close());
 const original=second.agent.close.bind(second.agent);
 let cancelCompletion=false;
 const completion=eventually('captured nested worker native completion receipt',async()=>{
  if(cancelCompletion)return null;
  const receipts=await observer.request('native-receipts',{}) as Array<{pid:number}>;return receipts.some(row=>row.pid===target.pid)?true:undefined;
 },NATIVE_COMPLETION_MS);void completion.catch(()=>{});
 const fault=t.mock.method(second.agent,'close',async()=>{throw Error('planted native owner close rejection');});
 try{
  await assert.rejects(closeNested!(),/SSH fixture cleanup incomplete/);
  await access(second.root);await access(second.paths.secret);
  assert.equal(await completion,true);
  assert.equal(await first.host.alive(sibling),true,'sibling native worker was not a cleanup target');
 }finally{
  cancelCompletion=true;await completion.catch(()=>{});fault.mock.restore();await observer.close();await original();
  const exists=await access(second.root).then(()=>true,()=>false);
  if(exists)await closeNested!();nestedClosed=true;
 }
});

for (const outcome of ['running','refused','no-login'] as const) test(`C2/C3 admitted host relaunch ${outcome} keeps durable native and checkout ownership`, {timeout:testWaitMs(180_000)}, async t => {
  const secrets:string[]=[];
  const describe=(error:unknown):unknown=>error instanceof Error?{name:error.name,message:error.message,...(error instanceof AggregateError?{errors:[...error.errors].map(describe)}:{})}:String(error);
  const context={after:(cleanup:()=>Promise<void>)=>t.after(async()=>{try{await cleanup();}catch(error){t.diagnostic(remoteRedactor(secrets).text(JSON.stringify(describe(error))).slice(-16384));throw error;}})};
  const afterNativeJoin:Array<()=>Promise<void>>=[];
  const f1 = await sshHostFixture(context,{provider:{region:'fake-1'},afterNativeJoin:async()=>{const stack=new AsyncDisposableStack();for(const close of afterNativeJoin)stack.defer(close);await stack.disposeAsync();}});
  // The second fixture is nested: join it before the first root can disappear.
  const nested = { after: (cleanup: () => Promise<void>) => { f1.addCleanup(cleanup); } };
  const f2 = await sshHostFixture(nested,{provider:{root:f1.root,project:f1.root,region:'fake-1'}});
  assert.ok(f1.machine);assert.ok(f2.machine);
  secrets.push(f1.secrets.readSecret('f1'),f2.secrets.readSecret('f1'));
  const drainPublishers=async()=>{for(const f of [f2,f1]){const client=await AgentClient.connect(f.paths.agentSocket,f.secrets.readSecret('f1'));try{await client.request('flush',{});}finally{await client.close();}}};
  const git = (cwd:string,args:string[]) => territoryGitAsync(cwd,['-c','gc.auto=0',...args],false,undefined,fixtureEnvironment(f1.root,process.env,f1.env));
  await git(f1.root,['init','--initial-branch=dev']);
  await writeFile(join(f1.root,'seed'),'seed'); await writeFile(join(f1.root,'.gitignore'),'.cland\nnode_modules\n');
  await git(f1.root,['add','.']); await git(f1.root,['commit','-m','seed']);
  await mkdir(join(f1.root,'.cland'),{recursive:true}); await git(f1.root,['clone','--bare',f1.root,territoryPath(f1.root)]); await refreshTerritoryHook(f1.root);
  const machines = [{f:f1,name:'f1'},{f:f2,name:'f2'}];
  for (const {f,name} of machines) {
    const daemon = await startGitDaemon({host:name,socket:f.paths.gitSocket,territory:territoryPath(f1.root),env:fixtureEnvironment(f1.root,process.env,f1.env),log:()=>{}}); f.addCleanup(()=>daemon.close());
    await writeFile(f.layout.discoveryFile,'synthetic discovery');
    const root=hostCloneRoot(f.layout.runDirectory,f1.root);
    await ensureHostClone({host:f.host,root,layout:{...f.layout,cli:new URL('../bin/cland.ts',import.meta.url).pathname},bundle:async()=>{throw Error('unexpected fallback');}});
    await mkdir(join(root,'node_modules'));
  }
  await withFixtureStore(join(f1.root,'.cland/hub.db'),close=>f1.addCleanup(close),async store=>{
  await writeFile(join(f1.root,'.cland/config.toml'),'[hosts.agents]\nprovider="fake"\nslots=8\nregion="fake-1"\n');
  for (const {f,name} of machines) {
    store.hosts.insert({id:name,address:f.machine!.address,user:'agent',clientKeyPath:'unused',knownHosts:'unused'},f.secrets.readSecret('f1'));
    if(name==='f1'||outcome!=='no-login')await mountedSettledLogin({root:f1.root,env:f1.env,records:store.hosts.logins,host:{...f.host,name},machine:f.machine!,harness:'codex',account:'work',beforeStop:close=>f1.addCleanup(close),afterNativeJoin:close=>afterNativeJoin.push(close)});
  }
  await mkdir(dirname(hostPaths(f1.root,'f2').secret),{recursive:true,mode:0o700});
  await writeFile(hostPaths(f1.root,'f2').secret,f2.secrets.readSecret('f1'),{mode:0o600});
  });
  let observerFailed=false;
  const spawns:import('../src/adapters/contract.ts').SpawnRequest[]=[];
  const hub=await projectHub(t,f1.root,f1.env,{hasTerritory:async()=>true,log:entry=>{if(outcome==='running'&&entry.event==='session-launched'&&String(entry.cwd).startsWith(f2.fake.home)){observerFailed=true;throw Error('injected post-publication observer failure');}},hosts:[f1.host,{...f2.host,name:'f2'}],adapters:[host=>{
    const adapter=fakeHarness('codex',{host}), spawn=adapter.spawn.bind(adapter);
    adapter.spawn=async(request,resumed,authorize)=>{
      spawns.push(request);
      if (request.host==='f2' && outcome==='refused') throw new Error('injected native admission refusal');
      const machine=host.hostForLaunch!(request), p=await spawn(request,resumed,authorize);
      const child=await machine.spawn({command:process.execPath,args:['-e',"require('fs').writeFileSync(process.argv[1],'ready');setInterval(()=>{},1000)",join(request.cwd,'worker.ready')],cwd:request.cwd,env:{}});
      const birth=await machine.identity(child.pid);
      return {...p,host:machine.name,harnessSessionId:randomUUID(),pid:child.pid,pidStarted:birth!.pidStarted ?? null,pidIdentity:birth!.pidIdentity ?? null};
    };
    adapter.stop=async p=>{await host.hostForProcess!(p).stop(p);};
    return Object.assign(adapter,{releaseUnreachableGeneration:async (p:import('../src/adapters/contract.ts').HarnessProcess)=>{
      assert.equal(territoryLockHeld(f1.root),false,'adapter drain must not hold the territory lock');
      const admitted=JSON.parse(owned.meta(hostRelaunchIntentKey(p.sessionId))!); assert.equal(admitted.phase,'admitted'); assert.equal(admitted.sourceGeneration,hostGenerationKey(p));
      await unlink(join(f1.fake.directory,'gone')); f1.transport.wake();
      await eventually('original host returns after durable admission',()=>f1.transport.status().state==='up'||undefined,testWaitMs(60_000));
      return {generation:hostGenerationKey(p),released:true as const,dropped:[],forwardIds:[]};
    }});
  }]}); f1.addCleanup(()=>hub.stop());
  const placementRecords=new Store(join(f1.root,'.cland/hub.db'));
  try { for(const {name,f} of machines){placementRecords.hosts.provisions.ready({id:name,pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:f.machine!.created,state:'ready',machine:f.machine!});} } finally {placementRecords.close();}
  const roles=join(f1.root,'.cland/roles.toml'); await writeFile(roles,setRoleKey(await readFile(roles,'utf8'),'implementer','launch','writable_roots',['.']));
  const ui=await sessionUi(t,hub.discovery);
  const created=await ui.request({type:'task.create',size:'M',kind:'task',title:'relaunch'}); assert.equal(created.ok,true,created.error);
  const item=(created.value as {item:{id:string}}).item.id;
  const artifact=await ui.request({type:'artifact.create',kind:'prompt',title:'Recorded task brief',topic:'general',content:'Continue the task.'}); assert.equal(artifact.ok,true,artifact.error);
  const brief=(artifact.value as {artifact:{id:string}}).artifact.id;
  const launch=await ui.request({type:'session.launch',name:'worker',role:'implementer',harness:'codex',item,host:'f1',brief},testWaitMs(60_000)); assert.equal(launch.ok,true,launch.error);
  const before=(launch.value as {process:HarnessProcessView}).process;
  assert.equal(before.login,'codex-f1');assert.equal(before.account,'work');
  assert.deepEqual(spawns[0]!.accountEnv,{CODEX_HOME:'/cland/auth/codex-codex-f1'});
  await eventually('f1 native worker first-input receipt',()=>readFile(join(before.cwd,'worker.ready'),'utf8').catch(()=>undefined));
  await unlink(join(before.cwd,'worker.ready'));
  await git(before.cwd,['commit','--allow-empty','-m','pushed task commit']);
  const tip=await git(before.cwd,['rev-parse','HEAD']);
  const table=new ProcessTable(join(f1.root,'.cland/hub.db')); f1.addCleanup(async()=>table.close());
  const owned=new Store(join(f1.root,'.cland/hub.db')); f1.addCleanup(async()=>owned.close());
  const branch=owned.hostWorktrees()[0]!.branch;
  await eventually('territory exact pushed tip',async()=>await git(territoryPath(f1.root),['rev-parse',branch])===tip||undefined);
  const topic=await ui.request({type:'topic.create',title:'Relaunch context',item}); assert.equal(topic.ok,true,topic.error);
  const subscription=await ui.request({type:'event.subscribe',subject:{item},events:['task'],as:{name:'worker',sessionId:before.sessionId,role:'implementer'}}); assert.equal(subscription.ok,true,subscription.error);
  const subscriptions=owned.subscriptions(before.sessionId);
  const claim=(await ui.request({type:'task.view',item})).value;
  const down=eventually('f1 carrier down receipt',()=>f1.transport.status().state==='down'||undefined); void down.catch(()=>{});
  await hostControl('kill-master',f1.machine.address,f1.env);
  await hostControl('gone',f1.machine.address,f1.env);
  await down;
  const moved=await ui.request({type:'session.resume',session:'worker',relaunch:true,host:'f2'},testWaitMs(60_000));
  if(outcome==='no-login') {
    assert.equal(moved.ok,false);assert.match(String(moved.error),/no login codex in pool agents/);
    assert.equal(spawns.length,1);assert.equal(table.get('worker')!.host,'f1');
    await drainPublishers();return;
  }
  if(outcome==='refused') {
    assert.equal(moved.ok,false); assert.match(String(moved.error),/failed; destination remains fenced.*injected native admission refusal/);
    assert.equal(table.get('worker')!.host,'f1'); assert.equal(owned.hostWorktrees()[0]!.host,'f2'); assert.equal(owned.hostWorktrees()[0]!.phase,'adding');
    const failed=JSON.parse(owned.meta(hostRelaunchIntentKey(before.sessionId))!); assert.equal(failed.phase,'failed'); assert.match(failed.failure,/injected native admission refusal/);
    for(const host of [undefined,'f2','f3']) {const retry=await ui.request({type:'session.resume',session:'worker',relaunch:true,...(host?{host}:{})});assert.equal(retry.ok,false);assert.match(String(retry.error),host==='f2'?/injected native admission refusal/:host==='f3'?/unknown host|not registered|unavailable/:/fenced/);}
    assert.equal(spawns.length,3); assert.equal(owned.hostWorktrees()[0]!.host,'f2');
    await drainPublishers();
    return;
  }
  assert.equal(moved.ok,true,moved.error); assert.equal(observerFailed,true);
  const result=moved.value as {found:boolean;process:HarnessProcessView;notes:string[]}; assert.equal(result.found,true);
  const after=result.process;
  assert.equal(after.login,'codex-f2');assert.equal(after.account,'work');
  assert.deepEqual(spawns[1]!.accountEnv,{CODEX_HOME:'/cland/auth/codex-codex-f2'});
  assert.deepEqual(table.get('worker')!.accountEnv,{CODEX_HOME:'/cland/auth/codex-codex-f2'});
  await eventually('f2 native worker receipt',()=>readFile(join(after.cwd,'worker.ready'),'utf8').catch(()=>undefined));
  assert.equal(after.sessionId,before.sessionId); assert.equal(after.role,before.role); assert.equal(after.item,before.item); assert.notEqual(after.harnessSessionId,before.harnessSessionId);
  assert.equal(table.get('worker')!.host,'f2'); assert.equal(table.get('worker')!.status,'running'); assert.equal(table.get('worker')!.launchBrief,brief); assert.equal(await git(after.cwd,['rev-parse','HEAD']),tip);
  assert.ok([...table.retainedHostGenerations('f1')].some(row=>row.process.pid===before.pid&&row.nativeClosure==='unknown'));
  assert.match(spawns[1]!.brief!.text,/Continue the task\./); assert.match(spawns[1]!.brief!.text,/relaunched on f2 from f1/); assert.match(spawns[1]!.brief!.text,/native conversation history and uncommitted edits were lost/); assert.ok(spawns[1]!.brief!.text.includes(tip)); assert.equal(spawns[1]!.resumeConversation,undefined);
  assert.match(after.warning!,/native conversation history/);
  const listed=(await ui.request({type:'session.list'})).value as {processes:HarnessProcessView[]}; assert.match(listed.processes[0]!.warning!,/native conversation history/);
  const later=(await ui.request({type:'task.view',item})).value;
  assert.deepEqual((later as {item:{claim:unknown}}).item.claim,(claim as {item:{claim:unknown}}).item.claim);
  assert.equal((later as {item:{topic:string}}).item.topic,(claim as {item:{topic:string}}).item.topic);
  assert.deepEqual(owned.subscriptions(after.sessionId),subscriptions);
  assert.equal(owned.meta(hostRelaunchIntentKey(after.sessionId)),null);
  assert.equal(owned.hostWorktrees()[0]!.phase,'ready');
  // The original carrier returned during drain; the committed move still fences its pushes.
  await git(before.cwd,['commit','--allow-empty','-m','old owner refused']);
  await assert.rejects(git(before.cwd,['push','origin',`HEAD:refs/heads/${branch}`]),/not leased to this host/);
  await git(after.cwd,['commit','--allow-empty','-m','new owner']);
  const next=await git(after.cwd,['rev-parse','HEAD']); await git(after.cwd,['push','origin',`HEAD:refs/heads/${branch}`]); assert.equal(await git(territoryPath(f1.root),['rev-parse',branch]),next);
  await drainPublishers();
});
