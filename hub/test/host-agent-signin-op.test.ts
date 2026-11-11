// T3: native agent socket and fake volume links; writer lifecycle is joined before fixture cleanup.
// No real provider, sudo, mounts, credentials or network.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, symlink, unlink, stat, readlink, lstat, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serveAgent } from '../src/host/agent/server.ts';
import { AgentClient } from '../src/host/agent-client.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { FakeHostProvider } from '../src/host/provider/fake.ts';
import { hostDirectory } from '../../shared/fake-host-directory.ts';
import { sshHost } from '../src/host/ssh-host.ts';
import { localHost } from '../src/host/local.ts';
import { until, testWaitMs } from './until.ts';
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


import { startSignIn } from '../src/host/signin-client.ts';

async function harness(f:Awaited<ReturnType<typeof volumeFixture>>,body:string,processHooks?:import('../src/host/agent/processes.ts').ProcessHooks,expectedIncomplete=false){
 const bin=join(f.root,'bin');await mkdir(bin);
 const script=join(bin,'codex');
 await writeFile(script,`#!${process.execPath}\n${body}`,{mode:0o700});
 // Recreate the agent with a fixture-owned executable path; no account environment.
 await f.client.close();await f.server.close();
 const server=await serveAgent({runDir:join(f.root,'second'),secret:'sentinel',version:'test',processHooks:{...processHooks,afterSpawn:async(pid,directory)=>{f.owners.defer(ownProcess(undefined,pid));await processHooks?.afterSpawn?.(pid,directory);}},env:fixtureEnvironment(f.root,f.env,{CLAND_FAKE_HOST_ROOT:f.env.CLAND_FAKE_HOST_ROOT,CLAND_FAKE_HOSTS:f.env.CLAND_FAKE_HOSTS,CLAND_HOST_BOOT_ID_FILE:f.env.CLAND_HOST_BOOT_ID_FILE,PATH:bin+':'+f.env.PATH})});f.owners.defer(async()=>{if(expectedIncomplete)await assert.rejects(server.close(),/agent cleanup incomplete/);else await server.close();});
 const client=await AgentClient.connect(server.socket,'sentinel');f.owners.defer(()=>client.close());
 return {client,server};
}

test('sign-in streams bounded output, redacts split input echoes and persists its exact close',{timeout:testWaitMs()},async t=>{
 const f=await volumeFixture(t);
 const {client}=await harness(f,`process.stdout.write('visit example.invalid\\n');process.stdin.once('data',bytes=>{const s=bytes.toString().trim();process.stdout.write(s.slice(0,4));setImmediate(()=>{if(require('node:crypto').createHash('sha256').update(s).digest('hex')!=='43c4f71949cba5efa97929e3fafca97675b93ec0a94f45c1888dd518cd86f5d5')process.exit(19);process.stdout.write(s.slice(4)+' accepted\\n');process.exitCode=7;process.stdin.destroy();});});`);
 const host=sshHost({name:'fake-signin',transport:{status:()=>({state:'up'} as any),forward:async()=>({socket:join(f.root,'forward')}),unforward:async()=>{}},connect:async()=>client,layout:{runDirectory:f.root,logDirectory:f.root,discoveryFile:join(f.root,'discovery'),node:process.execPath,cli:'unused',spoke:'unused'}});f.owners.defer(()=>host.close());
 const output:string[]=[];
 await assert.rejects(host.signIn!({harness:'codex',path:'/tmp/invalid-login'},()=>{}),{nativeAdmission:'not-admitted',code:'CLAND_SIGNIN_REFUSED'});
 const run=await host.signIn!({harness:'codex',path:f.disk.path},o=>output.push(o.text));
 await until(()=>output.join('').includes('visit example.invalid'),{what:'sign-in prompt output receipt'});
 await assert.rejects(client.request('signin-write',{admission:'another-admission',text:'sentinel-wrong'}),/admission/);
 await run.write('sentinel-private-input\n');
 let observed=false;void run.closed.then(()=>{observed=true;});
 await until(()=>observed,{what:'durable sign-in close receipt'});
 const close=await run.closed;
 assert.deepEqual(close,{admission:run.admission,state:'closed',code:7,signal:null});
 assert.ok(output.join('').includes('accepted'));
 assert.ok(!output.join('').includes('sentinel-private-input'));
 const receipt=await readFile(join(f.root,'second/signins',run.admission+'.json'),'utf8');
 assert.deepEqual(JSON.parse(receipt),close);
 assert.ok(!receipt.includes('sentinel-private-input'));
 const secret='sentinel-private-input';
 async function scan(path:string):Promise<string[]>{
  const found:string[]=[];
  for(const entry of await readdir(path,{withFileTypes:true})){
   const file=join(path,entry.name);
   if(entry.isDirectory())found.push(...await scan(file));
   else if(entry.isFile()&&(await readFile(file)).includes(Buffer.from(secret)))found.push(file);
  }
  return found;
 }
 const control=join(f.root,'scan-control');await writeFile(control,secret);
 assert.ok((await scan(f.root)).includes(control));await unlink(control);
 assert.deepEqual(await scan(f.root),[],'no raw input in any fixture log, journal or agent file');
});


test('sign-in cancel joins descendants and durable close before unmount',{timeout:testWaitMs()},async t=>{
 const f=await volumeFixture(t);
 const entered=Promise.withResolvers<void>(),release=Promise.withResolvers<void>();
 const {client}=await harness(f,`const child=require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:['ignore','inherit','inherit']});child.once('spawn',()=>process.stdout.write('tree ready\\n'));process.stdin.resume();`,{beforeNativeClose:async()=>{entered.resolve();await release.promise;}});
 f.owners.defer(()=>release.resolve());
 const output:string[]=[];
 const run=await startSignIn(client,{harness:'codex',path:f.disk.path},o=>output.push(o.text));
 await until(()=>output.join('').includes('tree ready'),{what:'descendant launch receipt'});
 let unmounted=false;
 const unmount=client.request('login-disk',{...f.disk,op:'umount'}).then(()=>{unmounted=true;});
 const cancel=run.cancel();
 let held=false;void entered.promise.then(()=>{held=true;});
 await until(()=>held,{what:'native close checkpoint barrier'});
 assert.equal(unmounted,false);
 assert.equal((await lstat(f.mapped)).isSymbolicLink(),true);
 release.resolve();
 const close=await cancel;
 assert.equal(close.admission,run.admission);assert.equal(close.state,'closed');assert.equal(close.signal,'SIGTERM');
 assert.deepEqual(JSON.parse(await readFile(join(f.root,'second/signins',run.admission+'.json'),'utf8')),close);
 await unmount;assert.equal(unmounted,true);
});

test('sign-in output overflow terminates with an explicit bounded close outcome',{timeout:testWaitMs()},async t=>{
 const f=await volumeFixture(t);
 const {client}=await harness(f,`process.stdin.once('data',()=>{process.stdout.write('x'.repeat(70*1024));});process.stdout.write('ready\\n');process.stdin.resume();`);
 const output:string[]=[];
 const run=await startSignIn(client,{harness:'codex',path:f.disk.path},o=>{assert.ok(Buffer.byteLength(o.text)<=4096);output.push(o.text);});
 await until(()=>output.join('').includes('ready'),{what:'overflow harness input readiness'});
 await run.write('go\n');
 let observed=false;void run.closed.then(()=>{observed=true;});
 await until(()=>observed,{what:'overflow durable close receipt'});
 const close=await run.closed;
 assert.equal(close.outcome,'output-limit');
 assert.ok(Buffer.byteLength(output.join(''))<=65536);
});


test('post-release rejection retains descendant birth and refuses unmount',{timeout:testWaitMs()},async t=>{
 const f=await volumeFixture(t),ready=join(f.root,'escaped-child');let child=0;
 const {client}=await harness(f,`const child=require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});child.once('spawn',()=>require('node:fs').writeFileSync(${JSON.stringify(ready)},String(child.pid)));process.stdin.resume();`,{afterRelease:async()=>{
  await until(async()=>{child=Number(await readFile(ready,'utf8'));return child>1;},{what:'independent-stdio descendant receipt'});
  f.owners.defer(ownProcess(undefined,child));throw new Error('synthetic post-release fault');
 }},true);
 await assert.rejects(startSignIn(client,{harness:'codex',path:f.disk.path},()=>{}),{code:'CLAND_NATIVE_INCOMPLETE'});
 assert.equal(typeof await client.request('identity',{pid:child}),'string');
 await until(async()=>{const persisted=JSON.parse(await readFile(join(f.root,'second/processes.json'),'utf8')) as Array<{targets?:Array<{pid:number}>}>;return persisted.some(row=>row.targets?.some(target=>target.pid===child));},{what:'retained descendant durable birth'});
 const rows=await client.request('processes',{}) as Array<{targets?:Array<{pid:number}>}>;
 assert.ok(rows.some(row=>row.targets?.some(target=>target.pid===child)));
 await assert.rejects(client.request('login-disk',{...f.disk,op:'umount'}),{code:'writers-remain'});
 assert.equal((await lstat(f.mapped)).isSymbolicLink(),true);
});

test('failed native-close publication emits incomplete and refuses a waiting unmount',{timeout:testWaitMs()},async t=>{
 const f=await volumeFixture(t),held=Promise.withResolvers<void>(),release=Promise.withResolvers<void>();
 const {client}=await harness(f,`process.stdout.write('ready\\n');process.stdin.once('data',()=>{process.stdin.destroy();});`,{beforeExitPublication:async()=>{held.resolve();await release.promise;throw new Error('synthetic exit-publication fault');}},true);
 f.owners.defer(()=>release.resolve());
 let prompt=false;const run=await startSignIn(client,{harness:'codex',path:f.disk.path},()=>{prompt=true;});
 await until(()=>prompt,{what:'publication-fault harness prompt'});
 await run.write('finish\n');
 let checkpoint=false;void held.promise.then(()=>{checkpoint=true;});await until(()=>checkpoint,{what:'native close publication held'});
 const unmount=client.request('login-disk',{...f.disk,op:'umount'});void unmount.catch(()=>{});
 assert.equal((await lstat(f.mapped)).isSymbolicLink(),true);
 release.resolve();
 await assert.rejects(run.closed,{code:'CLAND_NATIVE_INCOMPLETE'});
 await assert.rejects(unmount,{code:'writers-remain'});
 assert.equal((await lstat(f.mapped)).isSymbolicLink(),true);
});
