// T3: native agent socket and fake volume links; writer lifecycle is joined before fixture cleanup.
// No real provider, sudo, mounts, credentials or network.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, symlink, unlink, stat, readlink, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serveAgent } from '../src/host/agent/server.ts';
import { AgentClient } from '../src/host/agent-client.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { FakeHostProvider } from '../src/host/provider/fake.ts';
import { hostDirectory } from '../../shared/fake-host-directory.ts';
import { sshHost } from '../src/host/ssh-host.ts';
import { localHost } from '../src/host/local.ts';
import { until } from './until.ts';
import { loginFixtureOwners as fixtureOwners } from './login-fixture-owners.ts';
import { ownProcess } from './process-cleanup.ts';

async function fixtureRoot(owners: ReturnType<typeof fixtureOwners>, prefix: string) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  // Registered first, disposed last: all writer joins run before root removal.
  // AsyncDisposableStack still attempts this disposal when another join rejects.
  owners.directory(root);
  return root;
}

async function volumeFixture(t: TestContext, processHooks?: import('../src/host/agent/processes.ts').ProcessHooks) {
  const owners=fixtureOwners(t);
  const root=await fixtureRoot(owners, 'ldt-');
  const providerEnv=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root});
  const provider=new FakeHostProvider({env:providerEnv});
  const acquired=await provider.acquire({project:'p',pool:'agents',architecture:'x86_64'});
  assert.equal(acquired.state,'created');if(acquired.state!=='created')throw new Error('machine setup');
  const created=await provider.createVolume({project:'p',name:'login-volume',region:'fake-1',sizeGiB:1});
  assert.equal(created.state,'created');if(created.state!=='created')throw new Error('volume setup');
  assert.equal((await provider.attachVolume(created.volume,acquired.machine)).state,'attached');
  const directory=hostDirectory(root,acquired.machine.id);
  const env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root,CLAND_FAKE_HOSTS:acquired.machine.id,CLAND_HOST_BOOT_ID_FILE:join(directory,'boot-id')});
  const server=await serveAgent({runDir:join(directory,'home/.cland-host/run'),secret:'sentinel',version:'test',env,...(processHooks?{processHooks}:{})});owners.defer(()=>server.close());
  const client=await AgentClient.connect(server.socket,'sentinel');owners.defer(()=>client.close());
  const disk={op:'mount',volume:'login-volume',path:'/cland/auth/codex-work'};
  await client.request('login-disk',disk);
  const mapped=join(directory,disk.path);
  await writeFile(join(mapped,'login.json'),'sentinel-login');
  return {owners,root,env,server,client,disk,mapped};
}

test('login file publication shares the attached fake mount and leaves ordinary paths unchanged',async t=>{
 const f=await volumeFixture(t);
 const bytes=Buffer.from('cli_auth_credentials_store = "file"\n').toString('base64');
 const path=f.disk.path+'/config.toml';
 const plan=await f.client.request('prepare-publishFile',{path,bytes,options:{mode:0o600}}) as {token:string};
 await f.client.request('commit-prepared',{token:plan.token});
 assert.equal(await readFile(join(f.mapped,'config.toml'),'utf8'),'cli_auth_credentials_store = "file"\n');
 const ordinary=join(f.root,'ordinary');
 await f.client.request('writeFile',{path:ordinary,bytes});
 assert.equal(await readFile(ordinary,'utf8'),'cli_auth_credentials_store = "file"\n');
 await assert.rejects(f.client.request('writeFile',{path:f.disk.path+'/../escape',bytes}),/bad-argument/);
 await symlink(ordinary,join(f.mapped,'link'));
 await assert.rejects(f.client.request('writeFile',{path:f.disk.path+'/link',bytes}),/bad-argument/);
 assert.equal(await readFile(ordinary,'utf8'),'cli_auth_credentials_store = "file"\n');
});

test('all login filesystem operations use the attached fake mount and retain logical paths',async t=>{
 const f=await volumeFixture(t),nested=f.disk.path+'/nested';
 await f.client.request('makeDirectory',{path:nested,mode:0o700});
 assert.equal((await stat(join(f.mapped,'nested'))).isDirectory(),true);
 assert.equal(await f.client.request('fileType',{path:nested}),'directory');
 assert.deepEqual(await f.client.request('statDirectory',{path:nested}),{refusal:null,identity:{dev:(await stat(join(f.mapped,'nested'))).dev,ino:(await stat(join(f.mapped,'nested'))).ino}});
 const bytes=Buffer.from('synthetic-data').toString('base64');
 await f.client.request('writeFile',{path:nested+'/data',bytes});
 assert.equal(await f.client.request('readFile',{path:nested+'/data'}),bytes);
 assert.deepEqual(await f.client.request('listFolder',{path:nested}),['data']);
 assert.equal((await f.client.request('stat',{path:nested+'/data'}) as {size:number}).size,14);
 assert.equal(await f.client.request('realpath',{path:nested}),nested);
 assert.equal(await f.client.request('fileType',{path:f.disk.path}),'directory');
 await f.client.request('removePath',{path:nested+'/data'});
 await f.client.request('removePath',{path:nested,options:{directory:true}});
 assert.equal(await f.client.request('fileType',{path:nested}),'missing');
});

for(const orphan of [false,true])test(`login-disk closes only disk users in ${orphan?'retained orphan':'live parent'} trees`,async t=>{
  const f=await volumeFixture(t);
  const script=join(f.root,'tree.cjs'),ready=join(f.root,'tree-ready'),exit=join(f.root,'exit-parent');
  await writeFile(script,`const fs=require('fs');if(process.argv[2]==='child'){fs.openSync(${JSON.stringify(join(f.mapped,'login.json'))},'r');process.send(process.pid);setInterval(()=>{},1000);}else{const child=require('child_process').fork(__filename,['child'],{stdio:['ignore','ignore','ignore','ipc']});child.once('message',pid=>fs.writeFileSync(${JSON.stringify(ready)},String(pid)));fs.watch(${JSON.stringify(f.root)},()=>{if(fs.existsSync(${JSON.stringify(exit)}))process.exit(0)});setInterval(()=>{},1000);}`);
  const parent=await f.client.request('spawn',{command:process.execPath,args:[script],cwd:f.root,env:fixtureEnvironment(f.root,f.env)}) as {pid:number;identity:string};f.owners.defer(ownProcess(undefined,parent.pid));
  let child=0;
  await until(async()=>{child=Number(await readFile(ready,'utf8'));return child>1;},{what:'descendant file-open receipt'});
  f.owners.defer(ownProcess(undefined,child));
  const childIdentity=await f.client.request('identity',{pid:child});assert.equal(typeof childIdentity,'string');
  // Persist the exact descendant birth while ancestry is intact.
  const prepared=await f.client.request('prepare-stop',parent) as {token:string};
  await f.client.request('abort-prepared',{token:prepared.token});
  if(orphan){await writeFile(exit,'exit');await until(async()=>{const rows=await f.client.request('processes',{}) as any[];return rows.some(row=>row.pid===parent.pid&&row.rootExitObserved===true&&row.targets?.some((target:any)=>target.pid===child));},{what:'native root exit with retained descendant receipt'});}
  await f.client.request('login-disk',{...f.disk,op:'umount'});
  assert.equal(await f.client.request('alive',{pid:child,identity:childIdentity}),false,'exact disk-user birth exited');
  if(!orphan)assert.equal(await f.client.request('alive',parent),true,'outside-disk parent remains alive');
  await assert.rejects(readFile(join(f.mapped,'login.json')),{code:'ENOENT'});
});

test('login-disk holds writer admission through the final unlink boundary',async t=>{
  let entered=false;const release=Promise.withResolvers<void>();
  const f=await volumeFixture(t,{beforeSignals:async()=>{entered=true;await release.promise;}});
  f.owners.defer(async()=>{release.resolve();});
  const writer=await f.client.request('spawn',{command:process.execPath,args:['-e','setInterval(()=>{},1000)'],cwd:f.mapped,env:fixtureEnvironment(f.root,f.env)}) as {pid:number;identity:string};f.owners.defer(ownProcess(undefined,writer.pid));
  const second=await AgentClient.connect(f.server.socket,'sentinel');f.owners.defer(()=>second.close());
  const unmount=f.client.request('login-disk',{...f.disk,op:'umount'});
  // Attach rejection handling immediately; teardown releases the held operation first.
  void unmount.catch(()=>{});
  try {
    await until(()=>entered,{what:'disk-user signal owner reached'});
    const spawn=second.request('spawn',{command:process.execPath,args:['-e','setInterval(()=>{},1000)'],cwd:f.mapped,env:fixtureEnvironment(f.root,f.env)});
    void spawn.then(row=>f.owners.defer(ownProcess(undefined,(row as {pid:number}).pid)),()=>{});
    await assert.rejects(spawn,{code:'CLAND_AGENT_ADMISSION_REFUSED'});
  } finally {release.resolve();await unmount;}
});

async function heldWriterFixture(t:TestContext) {
  let spawned=false, disposing=false, observedPid:number|undefined, nativeExitObserved=false;
  let stopObserved=async()=>{};
  const release=Promise.withResolvers<void>();
  const joined:string[]=[];
  const f=await volumeFixture(t,{afterSpawn:async(pid)=>{
    // This launch is independently owned before readiness becomes observable.
    observedPid=pid;stopObserved=ownProcess(undefined,pid);
    if(disposing)await stopObserved();
    spawned=true;
    await release.promise;
  }});
  // If connect fails before dispatch, the held operation has no native child.
  f.owners.defer(async()=>{release.resolve();});
  const second=await AgentClient.connect(f.server.socket,'sentinel');
  f.owners.defer(async()=>{await second.close();joined.push('client closed');});
  let spawn:Promise<unknown>|undefined;
  let spawnFailure: unknown;
  f.owners.diagnostic(() => { if (spawnFailure) throw spawnFailure; });
  f.owners.defer(async()=>{
    disposing=true;release.resolve();
    // Keep the client until its admitted request settles; public rejection does
    // not discard the independently captured native cleanup.
    try {await spawn;} catch (error) {spawnFailure=error;}
    await stopObserved();await stat(f.root);
    if (observedPid !== undefined) {
      const {observeProcesses}=await import('../src/host/agent/native.ts');
      nativeExitObserved=(await observeProcesses([observedPid],f.env)).get(observedPid)?.ended === true;
    }
    joined.push('native joined');
  });
  spawn=second.request('spawn',{command:process.execPath,args:['-e','setInterval(()=>{},1000)'],cwd:f.mapped,env:fixtureEnvironment(f.root,f.env)});
  void spawn.catch(()=>{});
  return {...f,second,release,spawn,joined,spawned:()=>spawned,observedPid:()=>observedPid,nativeExitObserved:()=>nativeExitObserved};
}

test('login-disk joins a previously admitted writer before its disk census',async t=>{
  const f=await heldWriterFixture(t);
  let unmount:Promise<unknown>|undefined;
  try {
    await until(f.spawned,{what:'native writer launch held before admission reply'});
    unmount=f.client.request('login-disk',{...f.disk,op:'umount'});void unmount.catch(()=>{});
    const probe=await AgentClient.connect(f.server.socket,'sentinel');f.owners.defer(()=>probe.close());
    await until(async()=>{try{await probe.request('makeDirectory',{path:join(f.root,'probe')});return false;}catch(e){return (e as NodeJS.ErrnoException).code==='CLAND_AGENT_ADMISSION_REFUSED';}},{what:'exclusive disk admission receipt'});
    assert.equal(await readFile(join(f.mapped,'login.json'),'utf8'),'sentinel-login');
  } finally {
    f.release.resolve();
    const writer=await f.spawn as {pid:number;identity:string};
    if(unmount){await unmount;assert.equal(await f.client.request('alive',writer),false);}
  }
});

test('login-disk held-spawn setup rejection joins native admission before client close',async t=>{
  const f=await heldWriterFixture(t);
  await assert.rejects(async()=>{
    await until(f.spawned,{what:'captured native launch before planted setup rejection'});
    await f.second.close();
    await assert.rejects(f.spawn!,/agent closed/);
    throw new Error('planted setup rejection');
  },/planted setup rejection/);
  const pid=f.observedPid();assert.equal(typeof pid,'number');
  const alias = await readlink(join(f.root,'.fixture-sockets/alias'));
  await lstat(alias);
  await assert.rejects(f.owners.disposeAsync(),/agent closed/);
  assert.deepEqual(f.joined,['native joined','client closed']);
  await assert.rejects(stat(f.root),{code:'ENOENT'});
  await assert.rejects(lstat(alias),{code:'ENOENT'},'owned external socket alias removed before reciprocal record');
  assert.equal(f.nativeExitObserved(),true,'captured child has a positive native exit observation before its boot-id root is removed');
});

test('login-disk joins completion persistence and exit publication before replying',async t=>{
  const publication=Promise.withResolvers<void>(),joining=Promise.withResolvers<void>();
  let publicationHeld=false;
  const f=await volumeFixture(t,{
    beforeExitPublication:async()=>{publicationHeld=true;await publication.promise;},
    beforeCompletionJoin:async()=>{joining.resolve();},
  });
  f.owners.defer(async()=>{publication.resolve();});
  const writer=await f.client.request('spawn',{command:process.execPath,args:['-e','setInterval(()=>{},1000)'],cwd:f.mapped,env:fixtureEnvironment(f.root,f.env)}) as {pid:number;identity:string};f.owners.defer(ownProcess(undefined,writer.pid));
  let published=false;
  f.client.on('event',frame=>{if(frame.event==='process-exited'&&frame.pid===writer.pid&&frame.identity===writer.identity)published=true;});
  await f.client.request('signal',{...writer,signal:'SIGTERM'});
  await until(()=>publicationHeld,{what:'native completion persisted but exit publication held'});
  const unmount=f.client.request('login-disk',{...f.disk,op:'umount'});void unmount.catch(()=>{});
  try {
    const first=await Promise.race([joining.promise.then(()=> 'join'),unmount.then(()=> 'unmount')]);
    assert.equal(first,'join','unmount joins the exact native completion owner');
    assert.equal(await readFile(join(f.mapped,'login.json'),'utf8'),'sentinel-login');
  } finally {publication.resolve();await unmount;}
  assert.equal(published,true,'exit publication precedes unmount reply');
});

test('login-disk joins its owned close callback when kernel exit precedes native publication',async t=>{
  const release=Promise.withResolvers<void>(),joining=Promise.withResolvers<void>();
  let held=false,published=false;
  const f=await volumeFixture(t,{
    beforeNativeClose:async()=>{held=true;await release.promise;},
    beforeCompletionJoin:async()=>{joining.resolve();},
  });
  f.owners.defer(async()=>{release.resolve();});
  const writer=await f.client.request('spawn',{command:process.execPath,args:['-e','setInterval(()=>{},1000)'],cwd:f.mapped,env:fixtureEnvironment(f.root,f.env)}) as {pid:number;identity:string};f.owners.defer(ownProcess(undefined,writer.pid));
  f.client.on('event',frame=>{if(frame.event==='process-exited'&&frame.pid===writer.pid&&frame.identity===writer.identity)published=true;});
  const observer=await AgentClient.connect(f.server.socket,'sentinel');f.owners.defer(()=>observer.close());
  const unmount=f.client.request('login-disk',{...f.disk,op:'umount'});void unmount.catch(()=>{});
  try {
    await until(()=>held,{what:'owned native close held before root exit publication'});
    const first=await Promise.race([joining.promise.then(()=> 'join'),unmount.then(()=> 'reply',()=> 'refusal')]);
    assert.equal(first,'join','kernel exit joins the captured native owner rather than losing authority');
    const rows=await observer.request('processes',{}) as Array<{pid:number;authority:string;rootExitObserved?:boolean}>;
    const row=rows.find(row=>row.pid===writer.pid);assert.ok(row);
    assert.equal(row.authority,'owned','pending owned completion retains its captured authority');
    assert.notEqual(row.rootExitObserved,true,'hook holds the exact missing publication boundary');
    assert.equal(await readFile(join(f.mapped,'login.json'),'utf8'),'sentinel-login');
  } finally {release.resolve();await unmount;}
  assert.equal(published,true,'owned close publication precedes unmount reply');
  assert.equal(await observer.request('alive',writer),false);
});

test('login-disk mounts only this fake machine attachment through the SSH Host', async t => {
  const owners=fixtureOwners(t);
  const root = await fixtureRoot(owners, 'ldv-');
  const base = fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root});
  const provider = new FakeHostProvider({env:base});
  const a = await provider.acquire({project:'p',pool:'agents',architecture:'x86_64'});
  const b = await provider.acquire({project:'p',pool:'agents',architecture:'x86_64'});
  const v = await provider.createVolume({project:'p',name:'login-volume',region:'fake-1',sizeGiB:1});
  assert.equal(a.state,'created'); assert.equal(b.state,'created'); assert.equal(v.state,'created');
  if(a.state!=='created'||b.state!=='created'||v.state!=='created')return;
  const directory=hostDirectory(root,a.machine.id);
  const env=fixtureEnvironment(root,base,{CLAND_FAKE_HOST_ROOT:root,CLAND_FAKE_HOSTS:a.machine.id,CLAND_HOST_BOOT_ID_FILE:join(directory,'boot-id')});
  const agentOptions={runDir:join(directory,'home/.cland-host/run'),secret:'sentinel',version:'test',env};
  let server=await serveAgent(agentOptions);owners.defer(()=>server.close());
  const host=sshHost({name:a.machine.id,transport:{status:()=>({state:'up'} as any),forward:async ()=>({socket:join(root,'forward')}),unforward:async()=>{}},connect:()=>AgentClient.connect(server.socket,'sentinel'),layout:{runDirectory:root,logDirectory:root,discoveryFile:join(root,'discovery'),node:process.execPath,cli:'unused',spoke:'unused'}});
  owners.defer(()=>host.close());
  const input={op:'mount' as const,volume:'login-volume',path:'/cland/auth/codex-work'};

  try {
    await assert.rejects(host.loginDisk!(input),{code:'wrong-volume'});
    assert.equal((await provider.attachVolume(v.volume,b.machine)).state,'attached');
    await assert.rejects(host.loginDisk!(input),{code:'wrong-volume'});
    assert.equal((await provider.detachVolume(v.volume,b.machine)).state,'detached');
    assert.equal((await provider.attachVolume(v.volume,a.machine)).state,'attached');
    await host.loginDisk!(input);
    const mapped=join(directory,input.path);
    await writeFile(join(mapped,'login.json'),'sentinel-login');
    const contents=await provider.volumeContents(v.volume,a.machine); assert.equal(contents.state,'ready');
    if(contents.state==='ready')assert.equal(await readFile(join(contents.directory,'login.json'),'utf8'),'sentinel-login');
    const writer=await host.spawn({command:process.execPath,args:['-e',`const fs=require('fs');fs.openSync(${JSON.stringify(join(mapped,'login.json'))},'r');fs.writeFileSync(${JSON.stringify(join(root,'writer-ready'))},'ready');setInterval(()=>{},1000)`],cwd:root,env:fixtureEnvironment(root,env)});owners.defer(ownProcess(undefined,writer.pid));
    const outsider=await host.spawn({command:process.execPath,args:['-e',`require('fs').writeFileSync(${JSON.stringify(join(root,'outside-ready'))},'ready');setInterval(()=>{},1000)`],cwd:root,env:fixtureEnvironment(root,env)});owners.defer(ownProcess(undefined,outsider.pid));
    await until(async()=>await readFile(join(root,'writer-ready'),'utf8')==='ready' && await readFile(join(root,'outside-ready'),'utf8')==='ready',{what:'both native children ready'});
    let writerClosed=false;void writer.exited.then(()=>{writerClosed=true;});
    await host.loginDisk!({...input,op:'umount'});
    assert.equal(writerClosed,true,'unmount joins native writer exit');
    assert.equal(await host.alive({pid:outsider.pid}),true,'outside process remains alive');
    await assert.rejects(readFile(join(mapped,'login.json')),{code:'ENOENT'});
    await symlink(root,mapped);
    await assert.rejects(host.loginDisk!(input),{code:'bad-argument'});
    await unlink(mapped);
    await assert.rejects(localHost(env).loginDisk!(input),{code:'wrong-volume'});
    await host.loginDisk!(input);
    const recovered=await host.spawn({command:process.execPath,args:['-e',`require('fs').writeFileSync(${JSON.stringify(join(root,'recovered-ready'))},'ready');setInterval(()=>{},1000)`],cwd:mapped,env:fixtureEnvironment(root,env)});owners.defer(ownProcess(undefined,recovered.pid));
    await until(async()=>await readFile(join(root,'recovered-ready'),'utf8')==='ready',{what:'captured writer ready before agent restart'});
    await host.close();await server.close();server=await serveAgent(agentOptions);
    const restarted=await AgentClient.connect(server.socket,'sentinel');
    try {
      await assert.rejects(restarted.request('login-disk',{...input,op:'umount'}),{code:'writers-remain'});
      assert.equal(await readFile(join(mapped,'login.json'),'utf8'),'sentinel-login','unknown native ownership retains mount');
      assert.equal(await restarted.request('alive',{pid:recovered.pid,identity:await restarted.request('identity',{pid:recovered.pid})}),true);
    } finally {await restarted.close();}
  } finally {await owners.disposeAsync();}
});

test('login-disk uses exactly sudo -n helper op volume path and preserves typed helper failures', async t => {
  const owners=fixtureOwners(t);
  const root=await fixtureRoot(owners, 'lds-'); const bin=join(root,'bin');await mkdir(bin);
  await writeFile(join(root,'boot'),'11111111-1111-1111-1111-111111111111');
  const receipt=join(root,'arguments');const status=join(root,'status');await writeFile(status,'0');
  await writeFile(join(bin,'sudo'),`#!/bin/sh\nprintf '%s\\n' "$@" > '${receipt}'\nread -r status < '${status}'\nexit "$status"\n`,{mode:0o755});
  const env=fixtureEnvironment(root,process.env,{PATH:bin+':'+process.env.PATH,CLAND_FAKE_HOSTS:'1',CLAND_HOST_BOOT_ID_FILE:join(root,'boot')});
  const server=await serveAgent({runDir:join(root,'run'),secret:'sentinel',version:'test',env});
  owners.defer(()=>server.close());
  const client=await AgentClient.connect(server.socket,'sentinel');owners.defer(()=>client.close());
  try {
    const input={op:'freeze',volume:'login-volume',path:'/cland/auth/codex-work'};
    await client.request('login-disk',input);
    assert.equal(await readFile(receipt,'utf8'),'-n\n/usr/local/sbin/cland-auth\nfreeze\nlogin-volume\n/cland/auth/codex-work\n');
    for(const [exit,code] of [[2,'bad-argument'],[3,'wrong-volume'],[4,'writers-remain'],[5,'busy'],[6,'writers-remain']] as const) {
      await writeFile(status,String(exit));await assert.rejects(client.request('login-disk',input),{code});
    }
  } finally {await owners.disposeAsync();}
});

test('login-disk rejects malformed paths and volume names before invoking a helper', async t => {
  const owners=fixtureOwners(t);
  const root = await fixtureRoot(owners, 'ld-');
  await writeFile(join(root, 'boot'), '11111111-1111-1111-1111-111111111111');
  const bin = join(root, 'bin'); await mkdir(bin);
  const receipt = join(root, 'sudo-called');
  await writeFile(join(bin, 'sudo'), `#!/bin/sh\nprintf called > '${receipt}'\n`, {mode:0o755});
  const env = fixtureEnvironment(root, process.env, {PATH:bin+':'+process.env.PATH, CLAND_FAKE_HOSTS:'1', CLAND_HOST_BOOT_ID_FILE:join(root,'boot')});
  const server = await serveAgent({runDir:join(root,'run'), secret:'sentinel', version:'test', env});
  owners.defer(()=>server.close());
  const client = await AgentClient.connect(server.socket, 'sentinel');owners.defer(()=>client.close());
  try {
    for (const [volume,path] of [['volume','/tmp/login'],['volume','/cland/auth/../root'],['volume','/cland/auth/codex-work/child'],['../volume','/cland/auth/codex-work'],['volume\n','/cland/auth/codex-work'],['volume','/cland/auth/codex-work\n']]) {
      await assert.rejects(client.request('login-disk',{op:'mount',volume,path}), {code:'bad-argument'});
    }
    await assert.rejects(readFile(receipt), {code:'ENOENT'});
  } finally {await owners.disposeAsync();}
});

test('login-disk incomplete helper retains durable mutation ownership across agent restart',async t=>{
  const owners=fixtureOwners(t);
  const root=await fixtureRoot(owners, 'ldi-');
  await writeFile(join(root,'boot'),'11111111-1111-1111-1111-111111111111');
  const env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOSTS:'1',CLAND_HOST_BOOT_ID_FILE:join(root,'boot')});
  let invocations=0;
  const options={runDir:join(root,'run'),secret:'sentinel',version:'test',env,loginDiskCommand:async()=>{invocations++;return {code:null,stdout:'',stderr:'',error:'synthetic cleanup incomplete: child did not close'};}};
  let server=await serveAgent(options);owners.defer(async()=>{await assert.rejects(server.close(),/incomplete/);});
  const client=await AgentClient.connect(server.socket,'sentinel');owners.defer(()=>client.close());
  const disk={op:'freeze',volume:'volume',path:'/cland/auth/codex-work'};
  await assert.rejects(client.request('login-disk',disk),{code:'CLAND_NATIVE_INCOMPLETE'});
  await assert.rejects(client.request('login-disk',disk),{code:'CLAND_AGENT_ADMISSION_REFUSED'});
  await assert.rejects(client.request('writeFile',{path:join(root,'unsafe'),bytes:''}),{code:'CLAND_AGENT_ADMISSION_REFUSED'});
  assert.equal(invocations,1,'unfinished helper is never retried');
  await client.close();await assert.rejects(server.close(),/incomplete/);
  server=await serveAgent(options);
  const restarted=await AgentClient.connect(server.socket,'sentinel');owners.defer(()=>restarted.close());
  await assert.rejects(restarted.request('login-disk',disk),{code:'CLAND_AGENT_ADMISSION_REFUSED'});
  await assert.rejects(restarted.request('prepare-spawn',{}),{code:'CLAND_AGENT_ADMISSION_REFUSED'});
  assert.equal(await restarted.request('stop',{pid:2147483647,identity:'absent-fixture-birth'}),false,'native cleanup stays available behind the writer fence');
  assert.equal(invocations,1,'recovery retains the checkpoint without launching a helper');
});

test('login-disk fixture closes its server after rejected connect and attempts every cleanup join',async t=>{
  const owners=fixtureOwners(t);
  const root=await fixtureRoot(owners, 'ldc-');
  await writeFile(join(root,'boot'),'11111111-1111-1111-1111-111111111111');
  const env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOSTS:'1',CLAND_HOST_BOOT_ID_FILE:join(root,'boot')});
  const server=await serveAgent({runDir:join(root,'run'),secret:'sentinel',version:'test',env});
  const joined:string[]=[];
  owners.defer(async()=>{await server.close();await stat(root);joined.push('server closed');});
  owners.defer(async()=>{joined.push('other child joined');});
  owners.diagnostic(async()=>{joined.push('failed child joined');throw new Error('planted cleanup failure');});
  await assert.rejects(AgentClient.connect(server.socket,'wrong-secret'),/secret/);
  await assert.rejects(owners.disposeAsync(),/planted cleanup failure/);
  await assert.rejects(stat(root),{code:'ENOENT'},'root removed despite rejected cleanup join');
  assert.deepEqual(joined,['failed child joined','other child joined','server closed']);
  await assert.rejects(AgentClient.connect(server.socket,'sentinel'),/ENOENT|ECONNREFUSED|agent closed/);
});
