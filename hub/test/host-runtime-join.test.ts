// T3: runtime SSH carrier and Git daemon lifecycle, including hub restart.
// The fake transport uses native forwarding children; sshHostFixture joins all writers before removal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join, sep } from 'node:path';
import { access, realpath, stat, writeFile, readFile } from 'node:fs/promises';
import { sshHostFixture } from './ssh-host-fixture.ts';
import { projectHub, connectUi, eventually, testWaitMs } from './harness.ts';
import { Store } from '../src/hub/store.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { hostPaths } from '../src/host/records.ts';
import { territoryGitAsync } from '../src/territory.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { within } from '../src/executor/droplet/deadline.ts';

const SETUP_MS=testWaitMs(45000);
const LAUNCH_MS=5000;
test('fixture disposal joins held repository setup and fences exclude enrollment', {timeout:SETUP_MS},async t=>{
 const entered=Promise.withResolvers<{root:string;signal:AbortSignal}>(),release=Promise.withResolvers<void>();
 let cleanup:(()=>Promise<void>)|undefined,closing:Promise<void>|undefined;
 const close=()=>closing??=cleanup!();
 const setup=sshHostFixture({after:fn=>{cleanup=fn;}},{afterRepositoryInit:async(root,signal)=>{entered.resolve({root,signal});await release.promise;}});
 void setup.catch(()=>{});
 t.after(async()=>{release.resolve();await Promise.allSettled([setup]);if(cleanup)await close();});
 const {root,signal}=await within(entered.promise,SETUP_MS);
 const observed=new Promise<void>(resolve=>signal.addEventListener('abort',()=>resolve(),{once:true}));
 const disposed=close();
 await within(observed,5000);
 assert.equal((await stat(root)).isDirectory(),true,'the admitted Git/FS sequence still owns its root');
 assert.equal((await readFile(join(root,'.git/info/exclude'),'utf8')).includes('/.fixture-sockets/'),false,'exclude continuation has not run');
 release.resolve();
 await assert.rejects(within(setup,5000),/fixture work admission closed/);
 await within(disposed,5000);
 await assert.rejects(access(root),{code:'ENOENT'});
});

test('fixture disposal joins a held clone sequence and fences its later filesystem write', {timeout:SETUP_MS},async t=>{
 const entered=Promise.withResolvers<AbortSignal>(),release=Promise.withResolvers<void>();
 let cleanup:(()=>Promise<void>)|undefined,closing:Promise<void>|undefined;
 const close=()=>closing??=cleanup!();
 const setup=sshHostFixture({after:fn=>{cleanup=fn;}},{startTransport:false});
 void setup.catch(()=>{});
 let sequence:Promise<void>|undefined;
 t.after(async()=>{release.resolve();await Promise.allSettled([setup,...(sequence?[sequence]:[])]);if(cleanup)await close();});
 const f=await setup,clone=join(f.root,'held-clone');
 const git=(args:string[])=>territoryGitAsync(f.root,args,false,undefined,fixtureEnvironment(f.root,process.env,f.env));
 let lateWriteStarted=false;
 sequence=f.runOwned(async(step,signal)=>{
  await step(()=>writeFile(join(f.root,'seed'),'owned clone seed'));
  await step(()=>git(['add','seed']));await step(()=>git(['commit','-m','owned clone seed']));
  await step(()=>git(['clone','--no-hardlinks',f.root,clone]));
  await step(async()=>{entered.resolve(signal);await release.promise;});
  await step(async()=>{lateWriteStarted=true;await writeFile(join(f.root,'late-write'),'must stay fenced');});
 });
 void sequence.catch(()=>{});
 const signal=await within(entered.promise,SETUP_MS);
 const observed=new Promise<void>(resolve=>signal.addEventListener('abort',()=>resolve(),{once:true}));
 const disposed=close();await within(observed,5000);
 assert.equal(await readFile(join(clone,'seed'),'utf8'),'owned clone seed','actual clone completed before disposal admission');
 release.resolve();
 await assert.rejects(within(sequence,5000),/fixture work admission closed/);
 await within(disposed,5000);
 assert.equal(lateWriteStarted,false);
 await assert.rejects(access(f.root),{code:'ENOENT'});
});

test('enrolled host socket metadata stays out of a committed and cloned fixture root', {timeout:SETUP_MS},async t=>{
 const f=await sshHostFixture(t,{startTransport:false});
 const git=(args:string[])=>territoryGitAsync(f.root,args,false,undefined,fixtureEnvironment(f.root,process.env,f.env));
 await f.runOwned(async step=>{
 await step(()=>git(['init','--initial-branch=dev']));
 await step(()=>writeFile(join(f.root,'.gitignore'),'.cland\n'));
 await step(()=>writeFile(join(f.root,'seed'),'fixture seed'));
 await step(()=>access(join(f.root,'.fixture-sockets','host-paths')));
 await step(()=>git(['add','.']));await step(()=>git(['commit','-m','fixture seed']));
 const committed=(await step(()=>git(['ls-tree','-r','--name-only','HEAD']))).split('\n');
 assert.ok(committed.includes('seed'),'positive control: ordinary fixture content is committed');
 assert.deepEqual(committed.filter(path=>path.startsWith('.fixture-sockets/')),[],'socket aliases and host markers never enter a Git tree');
 const clone=join(f.root,'clone');await step(()=>git(['clone','--no-hardlinks',f.root,clone]));
 assert.equal(await step(()=>access(join(clone,'seed'))).then(()=>true),true);
 await step(()=>assert.rejects(access(join(clone,'.fixture-sockets')),{code:'ENOENT'}));
 });
});
test('C1/C2 runtime host joins without restart and removal settles rows and closes carrier and Git', {timeout:SETUP_MS},async t=>{
 const f=await sshHostFixture(t,{startTransport:false});
 const registeredDirectory=await realpath(f.paths.socketDirectory);
 assert.ok(registeredDirectory.startsWith(f.root+sep),'registration owns its socket storage before the hub starts');
 const registeredParent=await stat(registeredDirectory);
 assert.equal(registeredParent.uid,process.getuid!());assert.equal(registeredParent.mode&0o777,0o700);
 const hub=await projectHub(t,f.root,{...f.env,CLAND_FAKE_HOSTS:''},{hostConfigurations:{f1:{layout:f.layout,supervisor:f.supervisor}}});
 f.addCleanup(()=>hub.stop());
 const store=new Store(join(f.root,'.cland/hub.db')),table=new ProcessTable(join(f.root,'.cland/hub.db'));
 f.addCleanup(async()=>{table.close();store.close();});
 const record=store.hosts.insert({...f.records.get('f1')!,clientKeyPath:'/fake',knownHosts:'fake'},f.secrets.readSecret('f1'));
 hub.hostEnvironment.CLAND_FAKE_HOSTS='f1';
 assert.ok(hub.hostOwner);
 await hub.hostOwner.add(record);
 assert.equal(hostPaths(f.root,'f1').gitSocket,f.paths.gitSocket,'hub startup does not reroute the registered listener');
 assert.equal((await stat(f.paths.gitSocket)).isSocket(),true,'the real Git listener has bound the original path');
 assert.equal(await realpath(dirname(f.paths.gitSocket)),registeredDirectory);
 const host=hub.hostOwner.hosts[0]!;
 await eventually('runtime carrier up',async()=>{try{return (await host.statDirectory(f.fake.home)).refusal===null||undefined;}catch{return undefined;}},SETUP_MS);
 const ui=await connectUi(t,hub.discovery,'cli');
 const observed=eventually('durable runtime session row',()=>table.get('runtime-worker')?.status==='running'&&table.get('runtime-worker')||undefined,LAUNCH_MS);
 let running;
 try {
   const launched=await ui.request({type:'session.launch',name:'runtime-worker',harness:'codex',cwd:f.fake.home,host:'f1'},LAUNCH_MS);
   assert.equal(launched.ok,true,launched.error);
 } finally { running=await observed; }
 assert.equal(running.host,'f1');
 const settlement=await hub.hostOwner.remove('f1') as {leftovers:unknown[];timedOut:boolean};
 assert.equal(settlement.timedOut,false);assert.deepEqual(settlement.leftovers,[]);
 assert.equal(store.hosts.get('f1')?.state,'revoked');
 assert.equal(table.get('runtime-worker')?.status,'stopped');
 await assert.rejects(host.statDirectory(f.fake.home),/closed|revoked|not up/);
 await assert.rejects(access(f.paths.gitSocket),{code:'ENOENT'});
 assert.deepEqual(hub.hostOwner.hosts,[]);
});

test('C3 runtime registered host reopens on the next hub start', {timeout:SETUP_MS},async t=>{
 const f=await sshHostFixture(t,{startTransport:false});
 const options={hostConfigurations:{f1:{layout:f.layout,supervisor:f.supervisor}}};
 const first=await projectHub(t,f.root,{...f.env,CLAND_FAKE_HOSTS:''},options);f.addCleanup(()=>first.stop());
 const store=new Store(join(f.root,'.cland/hub.db'));f.addCleanup(async()=>store.close());
 const record=store.hosts.insert({...f.records.get('f1')!,clientKeyPath:'/fake',knownHosts:'fake'},f.secrets.readSecret('f1'));
 first.hostEnvironment.CLAND_FAKE_HOSTS='f1';
 await first.hostOwner!.add(record);
 await eventually('first runtime carrier up',async()=>{try{return (await first.hostOwner!.hosts[0]!.statDirectory(f.fake.home)).refusal===null||undefined;}catch{return undefined;}},SETUP_MS);
 await first.stop();
 const second=await projectHub(t,f.root,f.env,options);f.addCleanup(()=>second.stop());
 const reopened=second.hostOwner!.hosts[0]!;
 await eventually('reopened carrier up',async()=>{try{return (await reopened.statDirectory(f.fake.home)).refusal===null||undefined;}catch{return undefined;}},SETUP_MS);
 assert.equal(reopened.name,'f1');assert.equal(store.hosts.get('f1')?.state,'registered');
});
