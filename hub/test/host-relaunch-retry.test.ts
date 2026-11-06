// T3: real SSH carrier loss, native worker birth, checkout and socket receive-pack lease transfer.
// Lifecycle: each sshHostFixture joins agents, carriers, Git and workers before deleting its root.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { sshHostFixture } from './ssh-host-fixture.ts';
import { projectHub, eventually, testWaitMs } from './harness.ts';
import { sessionUi } from './session-credential-fixture.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { fakeHarness } from './fakes/harness.ts';
import { hostControl } from './fakes/fake-host.ts';
import { HOST_ORIGIN, ensureHostClone, hostCloneRoot } from '../src/host/clone.ts';
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

for (const target of ['f2','f3','f4'] as const) test(`retry native refusal onto ${target} preserves prepared ownership`, {timeout:testWaitMs(180_000)}, async t => {
  const secrets:string[]=[];
  const describe=(error:unknown):unknown=>error instanceof Error?{name:error.name,message:error.message,...(error instanceof AggregateError?{errors:[...error.errors].map(describe)}:{})}:String(error);
  const context={after:(cleanup:()=>Promise<void>)=>t.after(async()=>{try{await cleanup();}catch(error){t.diagnostic(remoteRedactor(secrets).text(JSON.stringify(describe(error))).slice(-16384));throw error;}})};
  const f1 = await sshHostFixture(context);
  // The second fixture is nested: join it before the first root can disappear.
  const nested = { after: (cleanup: () => Promise<void>) => { f1.addCleanup(cleanup); } };
  const f2 = await sshHostFixture(nested);
  const f3 = await sshHostFixture(nested);
  const f4 = target==='f4'?await sshHostFixture(nested):undefined;
  secrets.push(...[f1,f2,f3,...(f4?[f4]:[])].map(f=>f.secrets.readSecret('f1')));
  const drainPublishers=async()=>{for(const f of [...(f4?[f4]:[]),f3,f2,f1]){const client=await AgentClient.connect(f.paths.agentSocket,f.secrets.readSecret('f1'));try{await client.request('flush',{});}finally{await client.close();}}};
  const git = (cwd:string,args:string[]) => territoryGitAsync(cwd,['-c','gc.auto=0',...args],false,undefined,fixtureEnvironment(f1.root,process.env,f1.env));
  await git(f1.root,['init','--initial-branch=dev']);
  await writeFile(join(f1.root,'seed'),'seed'); await writeFile(join(f1.root,'.gitignore'),'.cland\nnode_modules\n');
  await git(f1.root,['add','.']); await git(f1.root,['commit','-m','seed']);
  await mkdir(join(f1.root,'.cland'),{recursive:true}); await git(f1.root,['clone','--bare',f1.root,territoryPath(f1.root)]); await refreshTerritoryHook(f1.root);
  const machines = [{f:f1,name:'f1'},{f:f2,name:'f2'},{f:f3,name:'f3'},...(f4?[{f:f4,name:'f4'}]:[])];
  for (const {f,name} of machines) {
    const daemon = await startGitDaemon({host:name,socket:f.paths.gitSocket,territory:territoryPath(f1.root),env:fixtureEnvironment(f1.root,process.env,f1.env),log:()=>{}}); f.addCleanup(()=>daemon.close());
    await writeFile(f.layout.discoveryFile,'synthetic discovery');
    const root=hostCloneRoot(f.layout.runDirectory,f1.root);
    await ensureHostClone({host:f.host,root,layout:{...f.layout,cli:new URL('../bin/cland.ts',import.meta.url).pathname},bundle:async()=>{throw Error('unexpected fallback');}});
    await mkdir(join(root,'node_modules'));
  }
  const store=new Store(join(f1.root,'.cland/hub.db'));
  for (const {f,name} of machines) store.hosts.insert({id:name,address:name,user:'agent',clientKeyPath:'unused',knownHosts:'unused'},f.secrets.readSecret('f1'));
  await mkdir(dirname(hostPaths(f1.root,'f2').secret),{recursive:true,mode:0o700});
  await writeFile(hostPaths(f1.root,'f2').secret,f2.secrets.readSecret('f1'),{mode:0o600});
  await mkdir(dirname(hostPaths(f1.root,'f3').secret),{recursive:true,mode:0o700});
  await writeFile(hostPaths(f1.root,'f3').secret,f3.secrets.readSecret('f1'),{mode:0o600});
  if(f4){await mkdir(dirname(hostPaths(f1.root,'f4').secret),{recursive:true,mode:0o700});await writeFile(hostPaths(f1.root,'f4').secret,f4.secrets.readSecret('f1'),{mode:0o600});}
  store.close();
  let refused=false;
  const spawns:import('../src/adapters/contract.ts').SpawnRequest[]=[];
  const hub=await projectHub(t,f1.root,f1.env,{hasTerritory:async()=>true,hosts:[f1.host,{...f2.host,name:'f2'},{...f3.host,name:'f3'},...(f4?[{...f4.host,name:'f4'}]:[])],adapters:[host=>{
    const adapter=fakeHarness('codex',{host}), spawn=adapter.spawn.bind(adapter);
    adapter.spawn=async(request,resumed,authorize)=>{
      spawns.push(request);
      if ((request.host==='f2' && !refused)||(target==='f4'&&request.host==='f3')) {refused=true;throw new Error('injected native admission refusal');}
      const machine=host.hostForLaunch!(request), p=await spawn(request,resumed,authorize);
      const child=await machine.spawn({command:process.execPath,args:['-e',"require('fs').writeFileSync(process.argv[1],'ready');setInterval(()=>{},1000)",join(request.cwd,'worker.ready')],cwd:request.cwd,env:{}});
      const birth=await machine.identity(child.pid);
      return {...p,host:machine.name,harnessSessionId:randomUUID(),pid:child.pid,pidStarted:birth!.pidStarted ?? null,pidIdentity:birth!.pidIdentity ?? null};
    };
    adapter.stop=async p=>{await host.hostForProcess!(p).stop(p);};
    return Object.assign(adapter,{releaseUnreachableGeneration:async (p:import('../src/adapters/contract.ts').HarnessProcess)=>{
      assert.equal(territoryLockHeld(f1.root),false,'adapter drain must not hold the territory lock');
      const admitted=JSON.parse(owned.meta(hostRelaunchIntentKey(p.sessionId))!); assert.equal(admitted.phase,'admitted'); assert.equal(admitted.sourceGeneration,hostGenerationKey(p));
      return {generation:hostGenerationKey(p),released:true as const,dropped:[],forwardIds:[]};
    }});
  }]}); f1.addCleanup(()=>hub.stop());
  const roles=join(f1.root,'.cland/roles.toml'); await writeFile(roles,setRoleKey(await readFile(roles,'utf8'),'implementer','launch','writable_roots',['.']));
  const ui=await sessionUi(t,hub.discovery);
  const created=await ui.request({type:'task.create',size:'M',kind:'task',title:'relaunch'}); assert.equal(created.ok,true,created.error);
  const item=(created.value as {item:{id:string}}).item.id;
  const artifact=await ui.request({type:'artifact.create',kind:'prompt',title:'Recorded task brief',topic:'general',content:'Continue the task.'}); assert.equal(artifact.ok,true,artifact.error);
  const brief=(artifact.value as {artifact:{id:string}}).artifact.id;
  const launch=await ui.request({type:'session.launch',name:'worker',role:'implementer',harness:'codex',item,host:'f1',brief},testWaitMs(60_000)); assert.equal(launch.ok,true,launch.error);
  const before=(launch.value as {process:HarnessProcessView}).process;
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
  const down=eventually('f1 carrier down receipt',()=>f1.transport.status().state==='down'||undefined); void down.catch(()=>{});
  await hostControl('kill-master','f1',f1.env);
  await hostControl('gone','f1',f1.env);
  await down;
  const moved=await ui.request({type:'session.resume',session:'worker',relaunch:true,host:'f2'},testWaitMs(60_000));
  assert.equal(moved.ok,false); assert.match(String(moved.error),/injected native admission refusal/);
  const failure=JSON.parse(owned.meta(hostRelaunchIntentKey(before.sessionId))!);
  assert.equal(failure.retryable,true,JSON.stringify(failure));
  const prepared=owned.hostWorktrees()[0]!;
  const publisher=await AgentClient.connect(f2.paths.agentSocket,f2.secrets.readSecret('f1'));
  try {await publisher.request('flush',{});} finally {await publisher.close();}
  const watches=JSON.parse(await readFile(join(f2.fake.run,'ref-watches.json'),'utf8'));
  const watch=watches.find((row:{path:string})=>row.path===prepared.path);assert.ok(watch);
  const directory=await f2.host.statDirectory(prepared.path);
  const admin=await git(prepared.path,['rev-parse','--absolute-git-dir']);
  const metadata=await f2.host.statDirectory(admin.trim());
  let advanced=tip;
  if(target==='f2') {
    // An independently published pushed tip advances without touching the fenced checkout.
    const parent=tip.trim();
    const tree=(await git(prepared.root,['rev-parse',parent+'^{tree}'])).trim();
    advanced=await git(prepared.root,['commit-tree',tree,'-p',parent,'-m','advanced pushed tip']);
    await git(prepared.root,['push','origin',`${advanced.trim()}:refs/heads/${branch}`]);
    assert.equal(await git(territoryPath(f1.root),['rev-parse',branch]),advanced);
    assert.ok(prepared.checkout);
    for(const field of ['directory','gitDirectoryBirth'] as const) {
      const birth=prepared.checkout[field]!;
      await assert.rejects(f2.host.worktreeAdd({root:prepared.root,path:prepared.path,branch,reuseOnly:true,checkout:{...prepared.checkout,[field]:{...birth,ino:birth.ino+1}},territory:{path:HOST_ORIGIN,tip:advanced.trim()}}),/checkout.*changed|checkout.*replaced|checkout.*incomplete/);
      assert.equal(await git(prepared.path,['rev-parse','HEAD']),tip);
    }
  }
  await unlink(join(f1.fake.directory,'gone'));f1.transport.wake();
  await eventually('source returned before explicit retry',()=>f1.transport.status().state==='up'||undefined,testWaitMs(60_000));
  for(const host of [undefined,'f1']) {
    const held=await ui.request({type:'session.resume',session:'worker',relaunch:true,...(host?{host}:{})});assert.equal(held.ok,false);assert.match(String(held.error),/fenced/);
  }
  let second:typeof prepared|undefined;
  let secondWatch:unknown, secondIdentity:unknown;
  if(target==='f4') {
    const onward=await ui.request({type:'session.resume',session:'worker',relaunch:true,host:'f3'},testWaitMs(60_000));assert.equal(onward.ok,false);assert.match(String(onward.error),/injected native admission refusal/);
    second=owned.hostWorktrees()[0]!;
    const publisher=await AgentClient.connect(f3.paths.agentSocket,f3.secrets.readSecret('f1'));try{await publisher.request('flush',{});}finally{await publisher.close();}
    secondWatch=JSON.parse(await readFile(join(f3.fake.run,'ref-watches.json'),'utf8'));secondIdentity=await f3.host.statDirectory(second.path);
  }
  const destination=target==='f2'?f2:target==='f3'?f3:f4!;
  const readyPath=join(hostCloneRoot(destination.layout.runDirectory,f1.root),'.cland/worktrees',item,'worker.ready');
  const nativeReady=eventually('retry native worker receipt',()=>readFile(readyPath,'utf8').catch(()=>undefined),testWaitMs(60_000));void nativeReady.catch(()=>{});
  const retry=await ui.request({type:'session.resume',session:'worker',relaunch:true,host:target},testWaitMs(60_000));
  assert.equal(retry.ok,true,retry.error);
  const result=retry.value as {found:boolean;process:HarnessProcessView;notes:string[]};
  assert.equal(result.found,true);assert.equal(table.get('worker')!.host,target);
  assert.equal(join(result.process.cwd,'worker.ready'),readyPath);
  assert.equal(await nativeReady,'ready');
  assert.equal(await git(result.process.cwd,['rev-parse','HEAD']),advanced);
  assert.equal(result.process.sessionId,before.sessionId);
  if(target==='f2') {
    assert.deepEqual(await f2.host.statDirectory(prepared.path),directory);
    assert.equal(await git(prepared.path,['rev-parse','--absolute-git-dir']),admin);
    assert.deepEqual(await f2.host.statDirectory(admin.trim()),metadata);
  } else {
    assert.deepEqual(await f2.host.statDirectory(prepared.path),directory);
    assert.equal(await git(prepared.path,['rev-parse','HEAD']),tip);
    const current=owned.hostWorktrees()[0]! as typeof prepared & {retained?:{tree:unknown;reason:string;refWatch:boolean}[]};
    assert.deepEqual(current.retained?.[0]?.tree,prepared);
    if(second){const flat={...second};delete flat.retained;assert.deepEqual(current.retained?.map(r=>r.tree),[prepared,flat]);assert.ok(current.retained?.every(r=>!r.tree.retained));assert.equal(await git(second.path,['rev-parse','HEAD']),tip);assert.deepEqual(await f3.host.statDirectory(second.path),secondIdentity);assert.deepEqual(JSON.parse(await readFile(join(f3.fake.run,'ref-watches.json'),'utf8')),secondWatch);}
    assert.equal(current.retained?.[0]?.refWatch,true);
    assert.deepEqual(JSON.parse(await readFile(join(f2.fake.run,'ref-watches.json'),'utf8')).find((row:{path:string})=>row.path===prepared.path),watch);
    assert.match(result.process.warning!,/f2.*retained.*ref-watch/);
    const tree=(await git(prepared.path,['rev-parse','HEAD^{tree}'])).trim();
    const refusedTip=(await git(prepared.path,['commit-tree',tree,'-p',tip.trim(),'-m','refused old owner'])).trim();
    await assert.rejects(git(prepared.path,['push','origin',`${refusedTip}:refs/heads/${branch}`]),/not leased to this host/);
  }
  assert.equal(owned.meta(hostRelaunchIntentKey(before.sessionId)),null);
  assert.equal(owned.hostWorktrees()[0]!.phase,'ready');
  await drainPublishers();
});
