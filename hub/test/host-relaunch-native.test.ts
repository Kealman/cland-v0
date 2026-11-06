// T3: production Codex adapter, native fake executable/spoke, two fake SSH carriers and socket Git.
// Lifecycle: captured native workers and publishers join before agents/carriers and both disposable roots close.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdtemp, mkdir, writeFile, readFile, unlink, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { sshHostFixture } from './ssh-host-fixture.ts';
import { ownDirectory } from './process-cleanup.ts';
import { createFakeHost, hostControl } from './fakes/fake-host.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { projectHub, eventually, testWaitMs } from './harness.ts';
import { sessionUi } from './session-credential-fixture.ts';
import { CodexAdapter } from '../src/adapters/codex.ts';
import { serveAgent } from '../src/host/agent/server.ts';
import { AgentClient } from '../src/host/agent-client.ts';
import { hostPaths } from '../src/host/records.ts';
import { SshTransport } from '../src/transport/ssh.ts';
import { sshHost } from '../src/host/ssh-host.ts';
import { remoteDiscovery } from '../src/host/discovery.ts';
import { ensureHostClone, hostCloneRoot } from '../src/host/clone.ts';
import { startGitDaemon } from '../src/host/git-daemon.ts';
import { fixtureSocketPath } from '../../test-support/socket-path.ts';
import { territoryGitAsync, territoryPath, refreshTerritoryHook } from '../src/territory.ts';
import { Store } from '../src/hub/store.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { setRoleKey } from '../src/roles/editor.ts';
import type { HarnessProcessView } from '../src/protocol.ts';

test('C2 production Codex relaunch crosses owned carriers and consumes a fresh native first input', {timeout:testWaitMs(180_000)}, async t => {
  const privateRoot=await mkdtemp(join(tmpdir(),'cland-T-1614-native-')),removePrivate=ownDirectory(undefined,privateRoot);
  // Fake model think time is fixture setup; no product deadline or behaviour assertion is shortened.
  const context={after:(cleanup:()=>Promise<void>)=>t.after(async()=>{await cleanup();await removePrivate();})};
  const f=await sshHostFixture(context,{env:{FAKE_CODEX_HOME:join(privateRoot,'f1'),FAKE_CODEX_TURN_MS:'20'}});
  const second=await createFakeHost(f.root,'f2');
  const secondRecord=f.secrets.register({id:'f2',address:'f2',user:'agent',clientKeyPath:join(second.directory,'client-key'),knownHosts:`f2 ${second.key}\n`});
  const env=fixtureEnvironment(f.root,process.env,{...f.env,CLAND_FAKE_HOSTS:'f1,f2'});
  const secondEnv=fixtureEnvironment(f.root,process.env,{...env,CLAND_HOST_BOOT_ID_FILE:second.bootId,FAKE_CODEX_HOME:join(privateRoot,'f2')});
  const secondAgent=await serveAgent({runDir:second.run,secret:f.secrets.readSecret('f2'),version:'test',env:secondEnv});
  f.addCleanup(()=>secondAgent.close());
  const secondCarrier=new SshTransport({root:f.root,record:secondRecord,secrets:f.secrets,hubSocket:fixtureSocketPath(f.root,'hub'),spokeSocket:fixtureSocketPath(f.root,'spoke'),remoteRun:second.run,supervisor:f.supervisor,agentCommand:['stub'],env:secondEnv});
  f.addCleanup(()=>secondCarrier.stop());await secondCarrier.start();
  await eventually('f2 carrier owned and up',()=>secondCarrier.status().state==='up'||undefined);
  const cli=new URL('../bin/cland.ts',import.meta.url).pathname,spoke=new URL('../bin/cland-spoke.ts',import.meta.url).pathname;
  const firstLayout={...f.layout,cli,spoke};
  const secondLayout={...firstLayout,discoveryFile:join(second.home,'hub.json'),runDirectory:second.run,logDirectory:join(second.home,'log')};
  const forwards:Array<{host:string;id:string;socket:string}>=[];
  const firstHost={...f.host,layout:()=>firstLayout,forward:async(...args:Parameters<typeof f.host.forward>)=>{const result=await f.host.forward(...args);if(!('socket' in result))throw Error('expected scoped Unix forward');forwards.push({host:'f1',id:args[0],socket:result.socket});return result;}};
  const secondHost=sshHost({name:'f2',transport:secondCarrier,layout:secondLayout,connect:()=>AgentClient.connect(hostPaths(f.root,'f2').agentSocket,f.secrets.readSecret('f2'))});
  const secondForward=secondHost.forward.bind(secondHost);
  secondHost.forward=async(...args)=>{const result=await secondForward(...args);if(!('socket' in result))throw Error('expected scoped Unix forward');forwards.push({host:'f2',id:args[0],socket:result.socket});return result;};
  f.addCleanup(()=>secondHost.close());
  const git=(cwd:string,args:string[])=>territoryGitAsync(cwd,['-c','gc.auto=0',...args],false,undefined,fixtureEnvironment(f.root,process.env,env));
  await git(f.root,['init','--initial-branch=dev']);await writeFile(join(f.root,'seed'),'seed');await writeFile(join(f.root,'.gitignore'),'.cland\nnode_modules\n');await git(f.root,['add','.']);await git(f.root,['commit','-m','seed']);
  await mkdir(join(f.root,'.cland'),{recursive:true});await git(f.root,['clone','--bare',f.root,territoryPath(f.root)]);await refreshTerritoryHook(f.root);
  for(const [host,layout] of [[firstHost,firstLayout],[secondHost,secondLayout]] as const){
    const daemon=await startGitDaemon({host:host.name,socket:hostPaths(f.root,host.name).gitSocket,territory:territoryPath(f.root),env:fixtureEnvironment(f.root,process.env,env),log:()=>{}});f.addCleanup(()=>daemon.close());
    await writeFile(layout.discoveryFile,JSON.stringify(remoteDiscovery(layout.runDirectory,f.secrets.readSecret(host.name))),{mode:0o600});
    const root=hostCloneRoot(layout.runDirectory,f.root);await ensureHostClone({host,root,layout,bundle:async()=>{throw Error('unexpected bundle fallback');}});await mkdir(join(root,'node_modules'));
  }
  const setup=new Store(join(f.root,'.cland/hub.db'));for(const row of f.records.list())setup.hosts.insert({...row,clientKeyPath:'unused',knownHosts:'unused'},f.secrets.readSecret(row.id));setup.close();
  const hub=await projectHub(t,f.root,env,{hasTerritory:async()=>true,hosts:[firstHost,secondHost],adapters:[boundary=>new CodexAdapter(boundary,{bin:new URL('./fakes/codex/codex',import.meta.url).pathname,env:fixtureEnvironment(f.root,process.env,env),spawnDeadlineMs:testWaitMs(60_000)})]});f.addCleanup(()=>hub.stop());
  const roles=join(f.root,'.cland/roles.toml');await writeFile(roles,setRoleKey(await readFile(roles,'utf8'),'implementer','launch','writable_roots',['.']));
  const ui=await sessionUi(t,hub.discovery);
  const created=await ui.request({type:'task.create',size:'M',title:'native cross-host relaunch'});assert.equal(created.ok,true,created.error);const item=(created.value as {item:{id:string}}).item.id;
  const made=await ui.request({type:'artifact.create',kind:'prompt',title:'Native recorded brief',topic:'general',content:'Continue the native relaunch task.'});assert.equal(made.ok,true,made.error);const brief=(made.value as {artifact:{id:string}}).artifact.id;
  const launched=await ui.request({type:'session.launch',name:'worker',role:'implementer',harness:'codex',model:'gpt-fake-1',host:'f1',item,brief},testWaitMs(60_000));assert.equal(launched.ok,true,launched.error);const before=(launched.value as {process:HarnessProcessView}).process;
  const sourceForward=forwards.find(row=>row.host==='f1')!;assert.ok(sourceForward);assert.equal((await lstat(sourceForward.socket)).isSocket(),true);
  const sourceInput=join(privateRoot,'f1/log',`${before.pid}.inputs.jsonl`);
  await eventually('source native input consumed durably',async()=>{const text=await readFile(sourceInput,'utf8').catch(()=>null);return text?.includes('Continue the native relaunch task.')?text:undefined;});
  const table=new ProcessTable(join(f.root,'.cland/hub.db')),records=new Store(join(f.root,'.cland/hub.db'));f.addCleanup(async()=>records.close());f.addCleanup(async()=>table.close());
  const sourceProcess=table.get('worker')!;
  // Raw fixture owner cleanup remains distinct from the released production adapter scope.
  f.addCleanup(async()=>{for(const [host,name] of [[secondHost,'f2'],[firstHost,'f1']] as const){const rows=name==='f1'?[sourceProcess]:table.all().filter(p=>p.host===name);for(const row of rows)if(row.pid!==null&&await host.alive(row))await host.stop(row);const client=await AgentClient.connect(hostPaths(f.root,name).agentSocket,f.secrets.readSecret(name));try{await client.request('flush',{});}finally{await client.close();}}});
  const branch=records.hostWorktrees()[0]!.branch;await git(before.cwd,['commit','--allow-empty','-m','native pushed tip']);const tip=await git(before.cwd,['rev-parse','HEAD']);await eventually('native source branch published',async()=>await git(territoryPath(f.root),['rev-parse',branch])===tip||undefined);
  const claim=(await ui.request({type:'task.view',item})).value as {item:{claim:unknown}};
  const down=eventually('source carrier is down',()=>f.transport.status().state==='down'||undefined);void down.catch(()=>{});await hostControl('kill-master','f1',env);await hostControl('gone','f1',env);await down;
  const moved=await ui.request({type:'session.resume',session:'worker',relaunch:true,host:'f2'},testWaitMs(60_000));assert.equal(moved.ok,true,moved.error);const after=(moved.value as {found:boolean;process:HarnessProcessView}).process;assert.equal((moved.value as {found:boolean}).found,true);
  const received=await eventually('new native first input consumed durably',async()=>{try{const lines=(await readFile(join(privateRoot,'f2/log',`${after.pid}.inputs.jsonl`),'utf8')).trim().split('\n').map(line=>JSON.parse(line) as {text:string});return lines.find(line=>line.text.includes('relaunched on f2 from f1'));}catch{return undefined;}});
  assert.ok(received.text.includes('Continue the native relaunch task.'));assert.ok(received.text.includes(tip));assert.match(received.text,/native conversation history and uncommitted edits were lost/);
  const targetForward=forwards.find(row=>row.host==='f2')!;assert.ok(targetForward);assert.notEqual(targetForward.id,sourceForward.id);
  assert.equal(after.sessionId,before.sessionId);assert.equal(after.item,item);assert.equal(after.role,before.role);assert.notEqual(after.harnessSessionId,before.harnessSessionId);assert.equal(table.get('worker')!.host,'f2');assert.ok(table.get('worker')!.pidIdentity);assert.equal(await git(after.cwd,['rev-parse','HEAD']),tip);
  assert.deepEqual(((await ui.request({type:'task.view',item})).value as {item:{claim:unknown}}).item.claim,claim.item.claim);assert.ok([...table.retainedHostGenerations('f1')].some(row=>row.process.pid===before.pid&&row.nativeClosure==='unknown'));
  await unlink(join(f.fake.directory,'gone'));f.transport.wake();await eventually('source carrier restored for lease refusal',()=>f.transport.status().state==='up'||undefined,testWaitMs(60_000));
  // Carrier up follows restoration of its retained maps: the captured old scoped socket must stay removed.
  await assert.rejects(lstat(sourceForward.socket),{code:'ENOENT'});
  await git(before.cwd,['commit','--allow-empty','-m','old source refused']);await assert.rejects(git(before.cwd,['push','origin',`HEAD:refs/heads/${branch}`]),/not leased to this host/);
  await git(after.cwd,['commit','--allow-empty','-m','new native owner']);const next=await git(after.cwd,['rev-parse','HEAD']);await git(after.cwd,['push','origin',`HEAD:refs/heads/${branch}`]);assert.equal(await git(territoryPath(f.root),['rev-parse',branch]),next);
  assert.equal((await ui.request({type:'session.stop',session:'worker'},testWaitMs(60_000))).ok,true);
});
