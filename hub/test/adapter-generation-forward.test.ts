// T3: legacy/scoped forward ids coexist through the real SSH mux contract.
// Lifecycle: sshHostFixture joins its Host, transport, agent and all fixture writers before removal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stat, readFile, writeFile } from 'node:fs/promises';
import net from 'node:net';
import { join } from 'node:path';
import { Sessions } from '../src/adapters/sessions.ts';
import { ProcessTable, hostGenerationKey } from '../src/adapters/processes.ts';
import { HubCore } from '../src/hub/core.ts';
import { fakeHarness } from './fakes/harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { hostControl } from './fakes/fake-host.ts';
import { sshHostFixture } from './ssh-host-fixture.ts';
import { eventually } from './harness.ts';
import { testWaitMs } from './until.ts';

test('legacy session forward remains removable beside a generation-scoped forward', {timeout: testWaitMs() * 3}, async t => {
  const f = await sshHostFixture(t,{startTransport:false});
  await f.transport.start();
  await eventually('authenticated legacy-forward fixture ready',()=>f.transport.status().state==='up'||undefined);
  const legacy = await f.host.forward('legacy-session', {port:12345});
  const scoped = await f.host.forward('legacy-session:generation-new', {port:12345});
  assert.ok('socket' in legacy && 'socket' in scoped);
  assert.notEqual(legacy.socket, scoped.socket);
  assert.equal((await stat(legacy.socket)).isSocket(), true);
  assert.equal((await stat(scoped.socket)).isSocket(), true);
  await f.host.unforward('legacy-session');
  await assert.rejects(stat(legacy.socket), {code:'ENOENT'});
  assert.equal((await stat(scoped.socket)).isSocket(), true);
  await f.host.unforward('legacy-session:generation-new');
  await assert.rejects(stat(scoped.socket), {code:'ENOENT'});
});


test('Sessions drops unreachable forward inventory locally and reconnect restores only the replacement', {timeout:testWaitMs()*6}, async t => {
  const f=await sshHostFixture(t,{startTransport:false});
  const argv=join(f.root,'ssh-argv.jsonl'),wrapper=join(f.root,'ssh-record');
  await writeFile(wrapper,`#!${process.execPath}\nimport {appendFileSync} from 'node:fs'; appendFileSync(${JSON.stringify(argv)},JSON.stringify(process.argv.slice(2))+'\\n'); await import(${JSON.stringify(new URL('./fakes/fake-ssh.ts',import.meta.url).pathname)});\n`,{mode:0o700});
  Object.assign(f.env,fixtureEnvironment(f.root,f.env,{CLAND_SSH_BIN:wrapper}));
  const peers=new Set<net.Socket>();
  const server=net.createServer({allowHalfOpen:true},socket=>{peers.add(socket);socket.on('error',()=>socket.destroy());socket.once('close',()=>peers.delete(socket));socket.pipe(socket);});
  f.addCleanup(async()=>{for(const peer of peers)peer.destroy();await new Promise<void>(resolve=>server.close(()=>resolve()));});
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(join(f.fake.home,'session.sock'),resolve);});
  await f.transport.start();await eventually('authenticated forward owner ready',()=>f.transport.status().state==='up'||undefined);
  const core=new HubCore(),table=new ProcessTable(':memory:');
  const sessions=new Sessions({root:f.root,core,table,hosts:[f.host]});
  f.addCleanup(async()=>{await sessions.close();table.close();core.close();core.store.close();});
  const adapter=fakeHarness('codex');
  const p={...await adapter.spawn({name:'old',role:null,model:null,cwd:f.root}),host:'f1'};
  Object.assign(adapter,{releaseUnreachableGeneration:async(process:typeof p)=>({generation:hostGenerationKey(process),released:true,dropped:['forward'],forwardIds:[process.sessionId===p.sessionId?'old-generation':'new-generation']})});
  sessions.register(adapter);
  const admitted=sessions.host({discoveryFile:'',node:'',cli:'',spoke:''}).hostForProcess!(p);
  const legacy=await admitted.forward('old-generation',{port:12345}),fresh=await admitted.forward('new-generation',{port:12345});
  assert.ok('socket' in legacy&&'socket' in fresh);
  const commands=async()=> (await readFile(argv,'utf8')).trim().split('\n').map(line=>JSON.parse(line) as string[]);
  const before=(await commands()).length;assert.ok(before>0,'native SSH capture positive control');
  await sessions.releaseUnreachableGeneration(p);await sessions.releaseUnreachableGeneration(p);
  assert.equal((await commands()).length,before,'local drop sends no SSH/mux/agent operation');
  await assert.rejects(stat(legacy.socket),{code:'ENOENT'});assert.equal((await stat(fresh.socket)).isSocket(),true);
  const oldMaster=JSON.parse(await readFile(join(f.fake.directory,'master-control'),'utf8')).token;
  await hostControl('kill-master','f1',f.env);
  const exchange=()=>new Promise<string>((resolve,reject)=>{
    const socket=net.createConnection({path:fresh.socket,allowHalfOpen:true});peers.add(socket);let output='';
    socket.setTimeout(testWaitMs(),()=>socket.destroy(new Error('replacement forward exchange deadline')));
    socket.once('error',reject);socket.once('close',()=>peers.delete(socket));socket.on('connect',()=>socket.end('new-generation-proof'));socket.on('data',bytes=>{output+=bytes;});socket.on('end',()=>{socket.destroy();resolve(output);});
  });
  await eventually('replacement master restored exact retained forward',async()=>{
    if(f.transport.status().state!=='up'||JSON.parse(await readFile(join(f.fake.directory,'master-control'),'utf8')).token===oldMaster)return undefined;
    try{return await exchange()==='new-generation-proof'||undefined;}catch{return undefined;}
  });
  assert.equal(await exchange(),'new-generation-proof');
  await assert.rejects(stat(legacy.socket),{code:'ENOENT'});
  const restored=(await commands()).slice(before).filter(args=>args.includes('forward'));
  assert.ok(restored.some(args=>args.some(arg=>arg.includes(fresh.socket))),'new generation has a positive forward installation receipt');
  assert.equal(restored.some(args=>args.some(arg=>arg.includes(legacy.socket))),false,'dropped inventory never reinstalls');
  await f.transport.stop();
  await sessions.releaseUnreachableGeneration(p);
  const replacement={...p,sessionId:'replacement-native-generation',pidIdentity:'replacement-birth'};
  await sessions.releaseUnreachableGeneration(replacement);
  await sessions.releaseUnreachableGeneration(replacement);
  await assert.rejects(stat(fresh.socket),{code:'ENOENT'});
  assert.equal(f.transport.status().state,'down','a positive stopped owner remains consumable after unregistration');
});
