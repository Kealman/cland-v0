// T3: clone/fetch/worktree and discovery cross the fake SSH agent and Git daemon.
// Lifecycle: sshHostFixture joins agents/carrier/commands and asserts an empty process census.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtureSocketPath } from '../../test-support/socket-path.ts';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { AgentClient } from '../src/host/agent-client.ts';
import { projectSshHosts } from '../src/host/registry.ts';
import { tunnelStatuses } from '../src/transport/transport.ts';
import { eventually } from './harness.ts';
import { TaskWorktrees } from '../src/hub/worktrees.ts';
import { Tracker } from '../src/tracker/tracker.ts';
import { FakeClock } from './fake-clock.ts';
import { join } from 'node:path';
import { mkdir,writeFile,readFile,stat,readlink } from 'node:fs/promises';
import { sshHostFixture } from './ssh-host-fixture.ts';
import type { Sessions } from '../src/adapters/sessions.ts';
import { ensureHostClone, hostCloneRoot } from '../src/host/clone.ts';
import { addHostTaskWorktree } from '../src/host/task-worktrees.ts';
import { territoryGitAsync,territoryPath } from '../src/territory.ts';
import { startGitDaemon } from '../src/host/git-daemon.ts';
import { Store } from '../src/hub/store.ts';
import { branchLeasePath } from '../src/host/branch-leases.ts';
import { fileURLToPath } from 'node:url';
import { fixtureEnvironment } from './fixture-environment.ts';

test('C1/C3/C4/C5 fake host clone, leased worktree tip, failure rollback, persisted record and agent removal',{timeout:20000},async t=>{
 const f=await sshHostFixture(t);
 f.env.DIGITALOCEAN_TOKEN='synthetic-provider-token';f.env.CLAND_HOST_SECRET='synthetic-host-secret';
 assert.equal(f.env.DIGITALOCEAN_TOKEN,'synthetic-provider-token');
 const git=(cwd:string,args:string[])=>territoryGitAsync(cwd,['-c','gc.auto=0',...args],false,undefined,fixtureEnvironment(f.root,f.env,{}));
 await git(f.root,['init','--initial-branch=dev']);
 await writeFile(join(f.root,'seed'),'seed');await writeFile(join(f.root,'.gitignore'),'node_modules\n.cland\n');await git(f.root,['add','seed','.gitignore']);await git(f.root,['commit','-m','seed']);
 await mkdir(join(f.root,'.cland'),{recursive:true});await git(f.root,['clone','--bare',f.root,territoryPath(f.root)]);
 const daemon=await startGitDaemon({host:'f1',socket:f.paths.gitSocket,territory:territoryPath(f.root),env:f.env,log:()=>{}});f.addCleanup(()=>daemon.close());
 const server=createServer(socket=>{let pending='';socket.on('data',chunk=>{pending+=chunk;let n;while((n=pending.indexOf('\n'))>=0){const frame=JSON.parse(pending.slice(0,n));pending=pending.slice(n+1);socket.write(JSON.stringify(frame.type==='hello'?{type:'welcome',protocol:1}:{type:'result',id:frame.id,ok:true,value:{root:'fake-host-receipt',sessions:[]}})+'\n');}});});
 server.listen(fixtureSocketPath(f.root,'hub'));await once(server,'listening');f.addCleanup(()=>new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve())));
 const discovery={remote:true,socket:join(f.fake.run,'hub.sock'),spoke:`ws+unix:${join(f.fake.run,'spoke.sock')}:/`,secret:'synthetic',version:'test'};
 await writeFile(f.layout.discoveryFile,JSON.stringify(discovery),{mode:0o600});
 const layout={...f.layout,cli:fileURLToPath(new URL('../bin/cland.ts',import.meta.url))};
 const root=hostCloneRoot(f.layout.runDirectory,f.root);
 await ensureHostClone({host:f.host,root,layout,bundle:async()=>{throw Error('unexpected fallback');}});
 assert.equal(await git(root,['remote','get-url','origin']),'git://cland/territory.git');
 assert.match(await readFile(await git(root,['config','core.gitProxy']),'utf8'),/host git-proxy/);
 assert.equal((await stat(join(root,'.cland/hub.json'))).mode&0o777,0o600);
 assert.equal(await readFile(join(root,'.cland/hub.json'),'utf8'),JSON.stringify(discovery));
 const unchanged=await readFile(join(root,'.cland/hub.json'),'utf8');
 await ensureHostClone({host:f.host,root,layout,bundle:async()=>{throw Error('unexpected fallback');}});
 assert.equal(await readFile(join(root,'.cland/hub.json'),'utf8'),unchanged);
 const control=await readFile(join(f.fake.run,'git-proxy'),'utf8')+await readFile(join(root,'.git/config'),'utf8');
 for(const value of ['synthetic-host-secret','synthetic-provider-token'])assert.equal(control.includes(value),false);
 await mkdir(join(root,'node_modules'));
 let store=new Store(join(f.root,'records.db'));f.addCleanup(async()=>store.close());
 const tracker=new Tracker({root:f.root,db:join(f.root,'tracker.db'),clock:new FakeClock(),log:()=>{},git:async()=>null});f.addCleanup(()=>tracker.stop());
 await tracker.create({id:'human',name:'human',role:null},{title:'task',kind:'task'});
 const common={project:f.root,root,host:f.host,store,env:f.env,authorize:()=>{}};
 store.hosts.insert({id:'f1',address:'f1',user:'agent',clientKeyPath:'unused',knownHosts:'unused'},'synthetic');
 const worktreePolicy=new TaskWorktrees({tracker,store,host:f.host,resolveHost:()=>f.host,env:f.env,hasTerritory:async()=>true});
 const sessions={validateLaunchHost:()=>f.host,launch:async(request:{name:string;cwd:string})=>({name:request.name,sessionId:'synthetic-worker',role:'implementer',cwd:request.cwd}),stop:async()=>{}} as unknown as Sessions;
 const launched=await worktreePolicy.launch(sessions,{name:'worker',role:'implementer',harness:'codex',item:'T-1',host:'f1'});
 const made=launched.worktree!;assert.equal(launched.process.cwd,made.path);
 assert.equal(await git(made.path,['rev-parse','HEAD']),await git(territoryPath(f.root),['rev-parse','t/T-1-task']));
 assert.match(await readFile(branchLeasePath(f.root),'utf8'),/f1\tt\/T-1-task/);
 assert.equal(await readlink(join(made.path,'node_modules')),join(root,'node_modules'));
 await assert.rejects(addHostTaskWorktree({...common,item:'T-2',branch:'t/T-2-task',host:{...f.host,worktreeAdd:async()=>{throw Error('host worktree refused');}}}),/host worktree refused/);
 assert.equal(await git(territoryPath(f.root),['for-each-ref','--format=%(refname)','refs/heads/t/T-2-task']),'');
 assert.equal((await readFile(branchLeasePath(f.root),'utf8')).includes('t/T-2-task'),false);
 store.close();store=new Store(join(f.root,'records.db'));
 assert.equal(store.hostWorktrees()[0]?.path,made.path);
 const cli=await f.host.run({command:process.execPath,args:[layout.cli,'hub','status','--json'],cwd:made.path,env:{}});
 assert.equal(cli.code,0,cli.stderr);assert.equal(JSON.parse(cli.stdout).root,'fake-host-receipt');
 await tracker.close({id:'synthetic-worker',name:'worker',role:'implementer'},'T-1');
 const worktrees=new TaskWorktrees({tracker,store,resolveHost:()=>f.host,env:f.env,sessions:()=>[{name:'other-host',cwd:made.path,host:'f2'}]});
 const occupied=new TaskWorktrees({tracker,store,resolveHost:()=>f.host,env:f.env,sessions:()=>[{name:'same-host',cwd:made.path,host:'f1'}]});
 assert.match((await occupied.prune(['T-1'])).failed[0]!.error,/still stands|still stand/);
 assert.equal((await worktrees.list())[0]?.path,made.path);
 const retained=store.hostWorktrees()[0]!;
 const pruned=await worktrees.prune(['T-1']);assert.deepEqual(pruned.failed,[]);assert.equal(pruned.removed[0]?.path,made.path);
 assert.equal(await f.host.fileType(made.path),'missing');assert.deepEqual(store.hostWorktrees(),[]);
 store.saveHostWorktree(retained);store.hosts.revoke('f1');store.close();store=new Store(join(f.root,'records.db'));
 const restarted=new TaskWorktrees({tracker,store,resolveHost:()=>f.host,env:f.env});
 await assert.rejects(restarted.list(),/host f1 revoked.*retained worktree/);assert.equal(store.hostWorktrees()[0]?.item,'T-1');
});

test('C2 bundle fallback copies over the pinned master and retains socket origin',{timeout:10000},async t=>{
 const f=await sshHostFixture(t);f.env.CLAND_SCP_BIN=fileURLToPath(new URL('./fakes/fake-scp.ts',import.meta.url));
 const git=(cwd:string,args:string[])=>territoryGitAsync(cwd,['-c','gc.auto=0',...args],false,undefined,fixtureEnvironment(f.root,f.env,{}));
 await git(f.root,['init','--initial-branch=dev']);await writeFile(join(f.root,'seed'),'seed');await git(f.root,['add','seed']);await git(f.root,['commit','-m','seed']);
 const bundle=join(f.root,'source.bundle');await git(f.root,['bundle','create',bundle,'--branches','HEAD']);
 await writeFile(f.layout.discoveryFile,'synthetic discovery');
 const root=join(f.fake.home,'fallback/project'),layout={...f.layout,cli:fileURLToPath(new URL('../bin/cland.ts',import.meta.url))};
 let copies=0;
 const host={...f.host,run:async(command:Parameters<typeof f.host.run>[0])=>command.args.includes('clone')&&command.args.includes('git://cland/territory.git')?{code:128,stdout:'',stderr:'injected daemon refusal'}:f.host.run(command)};
 await ensureHostClone({host,root,layout,bundle:async destination=>{await f.transport.copyFile(bundle,destination);copies++;}});
 assert.equal(copies,1);assert.equal(await git(root,['remote','get-url','origin']),'git://cland/territory.git');
 assert.equal(await git(root,['rev-parse','HEAD']),await git(f.root,['rev-parse','HEAD']));
 await assert.rejects(f.transport.copyFile(bundle,'/outside/destination'),/destination refused/);
 await f.transport.stop();await assert.rejects(f.transport.copyFile(bundle,join(f.fake.run,'copy.bundle')),/tunnel is not up/);
});

test('accepted checkout keeps its durable ownership when ready checkpoint fails',{timeout:10000},async t=>{
 const f=await sshHostFixture(t);
 const git=(cwd:string,args:string[])=>territoryGitAsync(cwd,['-c','gc.auto=0',...args],false,undefined,fixtureEnvironment(f.root,f.env,{}));
 await git(f.root,['init','--initial-branch=dev']);await writeFile(join(f.root,'seed'),'seed');await git(f.root,['add','seed']);await git(f.root,['commit','-m','seed']);
 await mkdir(join(f.root,'.cland'),{recursive:true});await git(f.root,['clone','--bare',f.root,territoryPath(f.root)]);
 const daemon=await startGitDaemon({host:'f1',socket:f.paths.gitSocket,territory:territoryPath(f.root),env:f.env,log:()=>{}});f.addCleanup(()=>daemon.close());
 await writeFile(f.layout.discoveryFile,'synthetic discovery');
 const root=hostCloneRoot(f.layout.runDirectory,f.root),layout={...f.layout,cli:fileURLToPath(new URL('../bin/cland.ts',import.meta.url))};
 await ensureHostClone({host:f.host,root,layout,bundle:async()=>{throw Error('unexpected fallback');}});
 const store=new Store(join(f.root,'fault-records.db'));f.addCleanup(async()=>store.close());
 const faultStore={hostWorktrees:()=>store.hostWorktrees(),deleteHostWorktree:(id:string)=>store.deleteHostWorktree(id),saveHostWorktree:(row:Parameters<Store['saveHostWorktree']>[0])=>{if(row.phase==='ready')throw Error('ready checkpoint refused');store.saveHostWorktree(row);}};
 await assert.rejects(addHostTaskWorktree({project:f.root,root,host:f.host,item:'T-3',branch:'t/T-3-fault',store:faultStore,env:f.env,authorize:()=>{}}),/ready checkpoint refused/);
 assert.equal(store.hostWorktrees()[0]?.phase,'adding');
 const path=join(root,'.cland/worktrees/T-3');
 assert.equal(await git(path,['rev-parse','HEAD']),await git(territoryPath(f.root),['rev-parse','t/T-3-fault']));
 assert.match(await readFile(branchLeasePath(f.root),'utf8'),/f1\tt\/T-3-fault/);
});

test('copy refuses master loss during native admission without an independent connection',{timeout:10000},async t=>{
 const f=await sshHostFixture(t);f.env.CLAND_SCP_BIN=fileURLToPath(new URL('./fakes/fake-scp-master-loss.ts',import.meta.url));
 const source=join(f.root,'source.bundle');await writeFile(source,'synthetic bundle');
 await assert.rejects(f.transport.copyFile(source,join(f.fake.run,'lost.bundle')),/host copy failed/);
 const attempt=JSON.parse(await readFile(join(f.fake.directory,'copy-attempt.json'),'utf8'));
 assert.equal(attempt.proxycommand,'false');assert.equal(attempt.controlmaster,'no');
 assert.equal(await f.host.fileType(join(f.fake.directory,'independent-connection')),'missing');
});

test('carrier stays ready while territory clone is held and task add reports clone failure',{timeout:10000},async t=>{
 const f=await sshHostFixture(t);await f.host.close();await f.transport.stop();f.env.CLAND_SCP_BIN=fileURLToPath(new URL('./fakes/fake-scp.ts',import.meta.url));
 const git=(cwd:string,args:string[])=>territoryGitAsync(cwd,['-c','gc.auto=0',...args],false,undefined,fixtureEnvironment(f.root,f.env,{}));
 await git(f.root,['init','--initial-branch=dev']);await writeFile(join(f.root,'seed'),'seed');await git(f.root,['add','seed']);await git(f.root,['commit','-m','seed']);
 await mkdir(join(f.root,'.cland'),{recursive:true});await git(f.root,['clone','--bare',f.root,territoryPath(f.root)]);await git(territoryPath(f.root),['config','cland.managed','true']);
 const registry=await projectSshHosts({root:f.root,records:f.records,hubSocket:fixtureSocketPath(f.root,'hub'),spokeSocket:fixtureSocketPath(f.root,'spoke'),env:f.env,log:()=>{},configurations:{f1:{home:f.fake.home,layout:{...f.layout,cli:fileURLToPath(new URL('../bin/cland.ts',import.meta.url))},supervisor:f.supervisor}}});
 f.addCleanup(registry.close);
 await eventually('carrier ready independently of clone',()=>tunnelStatuses(f.root,f.records.list())[0]?.state==='up'||undefined,3000);
 const host=registry.hosts[0]!,run=host.run.bind(host);let release!:()=>void;let cloneEntered=false;
 const gate=new Promise<void>(r=>release=r);
 host.run=async command=>{if(command.args.includes('clone')){cloneEntered=true;await gate;throw Error('injected held clone failure');}return run(command);};
 const root=hostCloneRoot(f.layout.runDirectory,f.root);
 const launch=assert.rejects(host.worktreeAdd({root,path:join(root,'.cland/worktrees/T-9'),branch:'t/T-9',territory:{path:'git://cland/territory.git',tip:await git(f.root,['rev-parse','HEAD'])}}),/host f1: territory clone failed/);
 try {await eventually('clone attempt entered',()=>cloneEntered||undefined,3000);assert.equal(tunnelStatuses(f.root,f.records.list())[0]?.state,'up');}
 finally {release();}
 await launch;assert.equal(tunnelStatuses(f.root,f.records.list())[0]?.state,'up');
 host.run=run;
 await host.worktreeAdd({root,path:join(root,'.cland/worktrees/T-9'),branch:'t/T-9',territory:{path:'git://cland/territory.git',tip:await git(f.root,['rev-parse','HEAD'])}});
 assert.equal(await git(join(root,'.cland/worktrees/T-9'),['rev-parse','HEAD']),await git(f.root,['rev-parse','HEAD']));
});

test('registry close quiesces disconnected clone settlement and retains incomplete native ownership',{timeout:10000},async t=>{
 const f=await sshHostFixture(t);await f.host.close();await f.transport.stop();
 const git=(cwd:string,args:string[])=>territoryGitAsync(cwd,['-c','gc.auto=0',...args],false,undefined,fixtureEnvironment(f.root,f.env,{}));
 await git(f.root,['init','--initial-branch=dev']);await writeFile(join(f.root,'seed'),'seed');await git(f.root,['add','seed']);await git(f.root,['commit','-m','seed']);
 await mkdir(join(f.root,'.cland'),{recursive:true});await git(f.root,['clone','--bare',f.root,territoryPath(f.root)]);await git(territoryPath(f.root),['config','cland.managed','true']);
 const registry=await projectSshHosts({root:f.root,records:f.records,hubSocket:fixtureSocketPath(f.root,'hub'),spokeSocket:fixtureSocketPath(f.root,'spoke'),env:f.env,log:()=>{},configurations:{f1:{home:f.fake.home,layout:{...f.layout,cli:fileURLToPath(new URL('../bin/cland.ts',import.meta.url))},supervisor:f.supervisor}}});
 const hold=f.holdRunCancellation();
 const leaves=(error:unknown):unknown[]=>error instanceof AggregateError?error.errors.flatMap(leaves):[error];
 f.addCleanup(async()=>{hold.release();await registry.close().catch(error=>{if(!leaves(error).some(e=>(e as NodeJS.ErrnoException).code==='CLAND_HOST_OUTCOME_UNKNOWN'))throw error;});});
 await eventually('carrier ready for disconnected clone',()=>tunnelStatuses(f.root,f.records.list())[0]?.state==='up'||undefined,3000);
 const client=await AgentClient.connect(f.agent.socket,f.secrets.readSecret('f1'));f.addCleanup(()=>client.close());
 const host=registry.hosts[0]!,run=host.run.bind(host),marker=join(f.fake.home,'clone-writer');
 host.run=command=>command.args.includes('clone')?run({...command,command:process.execPath,args:['-e',`require('fs').writeFileSync(process.argv[1],String(process.pid));setInterval(()=>{},1000)`,marker]}):run(command);
 const root=hostCloneRoot(f.layout.runDirectory,f.root);
 const launch=host.worktreeAdd({root,path:join(root,'.cland/worktrees/T-10'),branch:'t/T-10'}).then(value=>({value}),error=>({error}));
 const pid=await eventually('admitted clone writer file receipt',async()=>{try{return Number(await readFile(marker,'utf8'))||undefined;}catch{return undefined;}},3000);
 hold.disconnect();await eventually('disconnected clone cancellation held',()=>hold.entered()||undefined,3000);
 let closeError:unknown;
 const closing=registry.close().catch(error=>{closeError=error;});
 try {
  await eventually('registry close incomplete receipt',()=>closeError||undefined,1500);
  assert.ok(leaves(closeError).some(e=>(e as NodeJS.ErrnoException).code==='CLAND_HOST_OUTCOME_UNKNOWN'));
  assert.ok('error' in await launch);
  assert.ok(await client.request('identity',{pid}),'native writer remains owned while cancellation is held');
  assert.equal(await readFile(marker,'utf8'),String(pid),'storage remains intact');
 } finally {
  registry.quiesce();hold.release();await closing;await launch;
  await eventually('native cancellation durable result',async()=>{try{return JSON.parse(await readFile(join(f.fake.run,'prepared-results',hold.token()+'.json'),'utf8')).outcome.state==='accepted'||undefined;}catch{return undefined;}},3000);
  assert.equal(await client.request('identity',{pid}),null);
 }
});
