// T2: remote cleanup ownership with recording Hosts and scripted Codex; no native child.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { beforeDirectories, afterCleanup, guardDirectoryRemoval } from './process-cleanup.ts';
import { join } from 'node:path';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { CodexAdapter } from '../src/adapters/codex.ts';
import { Sessions } from '../src/adapters/sessions.ts';
import { HubCore } from '../src/hub/core.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { fixedRoles, parseRoles } from '../src/roles/config.ts';
import { localHost } from '../src/host/local.ts';
import type { Host } from '../src/host/host.ts';
import { FakeClock } from './fake-clock.ts';
import { ScriptedCodex, deferred } from './fakes/scripted-codex.ts';
import { tempProject, eventually } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';

async function fixture(t: TestContext, withRoles = false, durable = true) {
  const root = await tempProject(t, 'cx-', '/tmp');
  const storage = await tempProject(t, 'cx-r-', '/tmp');
  const gates = new Set<() => void>();
  const afterDrain: Array<() => unknown | Promise<unknown>> = [];
  let drained = false, storageClosed = false;
  const gate = () => {
    const held = deferred<void>();
    const release = () => { gates.delete(release); held.resolve(); };
    gates.add(release);
    return {promise: held.promise, resolve: release};
  };
  for (const path of [root, storage]) guardDirectoryRemoval(path, () => {
    assert.equal(drained, true, 'Sessions drained before root removal');
    assert.equal(storageClosed, true, 'storage closed before root removal');
  });
  const mapped = (path: string) => path.replace(root, storage);
  const clock = new FakeClock(Date.now());
  const base = localHost(fixtureEnvironment(root,process.env));
  const native = new ScriptedCodex(); native.thread = 'cleanup-thread';
  native.handlers.set('thread/start', () => ({thread: {id:native.thread,status:{type:'idle'}}}));
  const exited = deferred<{code:number|null;signal:string|null}>();
  const calls: string[] = [];
  let alive = true, revoked = false, stopAllowed = true, unforwardAllowed = true;
  let forwardGate: Promise<void> | undefined;
  let unforwardGate: Promise<void> | undefined;
  const host: Host = {...base,name:'f1',
    makeDirectory: (path,mode) => base.makeDirectory(mapped(path),mode),
    writeFile: (path,bytes,options) => base.writeFile(mapped(path),bytes,options),
    readFile: path => base.readFile(mapped(path)),
    fileType: path => base.fileType(mapped(path)),
    stat: path => base.stat(mapped(path)),
    statDirectory: path => base.statDirectory(mapped(path)),
    run: async () => ({code:0,stdout:'codex 0.160.0',stderr:''}),
    spawn: async () => ({pid:process.pid,exited:exited.promise}),
    identity: async pid => ({pid,pidStarted:'start',pidIdentity:`linux:remote:${pid}`}),
    alive: async () => alive,
    forward: async (_id,endpoint) => { calls.push('forward'); if(forwardGate) await forwardGate; return endpoint; },
    unforward: async () => { calls.push('unforward'); if(unforwardGate)await unforwardGate; if(!unforwardAllowed) throw new Error('cancel refused'); },
    stop: async () => { calls.push('remote-stop'); if(revoked) throw new Error('host f1 revoked'); if(!stopAllowed) return false; alive=false;exited.resolve({code:0,signal:null});return true; },
    removePath: async (...args) => { calls.push('remote-remove'); return base.removePath(mapped(args[0]),args[1]); },
  };
  const core = new HubCore({clock,...(withRoles?{roles:fixedRoles(parseRoles('[implementer.launch]\nharness="codex"\nsandbox="workspace-write"\nwritable_roots=["."]\nnetwork="none"'))}:{})}); const table = new ProcessTable();
  const local: Host = {...base,stop:async()=>{calls.push('LOCAL-STOP');throw new Error('local stop forbidden');},removePath:async()=>{calls.push('LOCAL-REMOVE');throw new Error('local undo forbidden');}};
  const sessions = new Sessions({root,core,table,hosts:[local,host],recoveryClock:clock,transportClock:clock,env:fixtureEnvironment(root,process.env)});
  const boundary=sessions.host({discoveryFile:join(root,'.cland/hub.json'),node:process.execPath,cli:'/fake/cli',spoke:'/fake/spoke'});
  boundary.durableLaunchRecovery = durable;
  const reportExit = boundary.exited;
  boundary.exited = (...args) => { calls.push('exited'); reportExit(...args); };
  let connectGate: Promise<void> | undefined;
  let currentNative = native;
  const adapter = new CodexAdapter(boundary,{clock,pollMs:10,env:fixtureEnvironment(root,process.env),connect:async()=>{calls.push('connect');if(connectGate)await connectGate;currentNative.closed=false;return currentNative;}});
  sessions.register(adapter);
  beforeDirectories(t, async () => {
    for (const release of gates) release();
    revoked = false; stopAllowed = true; unforwardAllowed = true;
    await sessions.close();
    drained = true;
    assert.equal(existsSync(root) && existsSync(storage), true, 'writer drain precedes root removal');
    for (const check of afterDrain) await check();
    table.close(); core.close(); core.store.close();
    storageClosed = true;
  });
  return {root,storage,clock,core,native,gate,afterDrain,
    get drained(){return drained;},get storageClosed(){return storageClosed;},calls,adapter,sessions,table,host,exited,
    get alive(){return alive;},set alive(value:boolean){alive=value;},
    revoke(){revoked=true;},allowStop(value:boolean){stopAllowed=value;},allowUnforward(value:boolean){unforwardAllowed=value;},
    holdUnforward(gate:Promise<void>|undefined){unforwardGate=gate;},
    holdForward(gate:Promise<void>|undefined){forwardGate=gate;},holdConnect(gate:Promise<void>|undefined){connectGate=gate;},useNative(value:ScriptedCodex){currentNative=value;}};
}

test('durable remote handshake recovery retains Host and retries forward cancellation before settlement',async t=>{
  const f=await fixture(t);
  const mirrored = join(f.root,'.cland/log/codex-failed.log');
  await mkdir(join(f.root,'.cland/log'),{recursive:true});
  await writeFile(mirrored,'hub file survives');
  f.native.handlers.set('thread/start',()=>{throw new Error('handshake refused');});
  f.allowUnforward(false);
  await assert.rejects(f.sessions.launch({name:'failed',host:'f1',harness:'codex',cwd:f.root}),/cleanup.*pending/);
  assert.equal(f.table.pendingStops()[0]?.process.host,'f1');
  assert.ok(f.calls.includes('remote-stop'));
  assert.ok(f.calls.includes('remote-remove'));
  assert.equal(f.calls.some(call=>call.startsWith('LOCAL')),false);
  f.allowUnforward(true);
  const recovered=eventually('durable settlement after forward cleanup',()=>f.table.pendingStops().length===0||undefined);
  await f.clock.advance(5000);await recovered;
  assert.equal(f.table.pendingStops().length,0);
  assert.equal(f.calls.filter(call=>call==='unforward').length,2);
  assert.equal(await readFile(mirrored,'utf8'),'hub file survives');
  assert.doesNotThrow(()=>process.kill(process.pid,0),'colliding local process survives');
});

for(const stage of ['forward','connect','subscription'] as const)test(`stop joins held remote reconnect ${stage}`,async t=>{
  const f=await fixture(t);
  const row=await f.adapter.spawn({name:'worker',role:null,model:null,cwd:f.root,host:'f1'});
  f.adapter.watch(row);
  f.native.close(); f.native.removeAllListeners();
  const replacement=new ScriptedCodex();replacement.thread=f.native.thread;f.useNative(replacement);
  const gate=f.gate();let entered=false;
  if(stage==='forward')f.holdForward(gate.promise.then(()=>{}));
  if(stage==='connect')f.holdConnect(gate.promise.then(()=>{}));
  if(stage==='subscription') {
    const request=replacement.request.bind(replacement);
    replacement.request=async <T>(method:string,params:Record<string,unknown>):Promise<T>=>{if(method==='thread/resume'){entered=true;await gate.promise;}return request<T>(method,params);};
  }
  const before=f.calls.length;
  await f.clock.advance(10);
  await eventually('held reconnect acquisition',()=>stage==='subscription'?entered||undefined:f.calls.slice(before).includes(stage==='forward'?'forward':'connect')||undefined);
  let stopped=false;
  const stop=f.adapter.stop(row).then(()=>{stopped=true;});
  await eventually('remote native stop receipt',()=>f.calls.includes('remote-stop')||undefined);
  assert.equal(stopped,false,'stop cannot outrun the acquired producer');
  gate.resolve();await stop;
  assert.equal(stopped,true);
  if(stage!=='forward')assert.equal(replacement.closed,true);
  else assert.equal(f.calls.filter(call=>call==='connect').length,1,'stopping cancels forward acquisition before opening a client');
  assert.equal(f.calls.at(-1),'remote-remove');
});

test('confirmed remote death retains failed forward cleanup until the retry receipt',async t=>{
  const f=await fixture(t);
  const row=await f.adapter.spawn({name:'worker',role:null,model:null,cwd:f.root,host:'f1'});
  f.adapter.watch(row);f.allowUnforward(false);f.alive=false;
  await f.clock.advance(10);
  await eventually('failed terminal cancellation',()=>f.calls.includes('unforward')||undefined);
  assert.equal(f.calls.includes('exited'),false,'death waits for the forward cleanup receipt');
  f.allowUnforward(true);
  const released=eventually('terminal forward retry receipt',()=>f.calls.includes('exited')||undefined);
  await f.clock.advance(1000);await released;
  await f.adapter.close();
  assert.equal(f.calls.filter(call=>call==='unforward').length,2,'close finds no retained successful forward');
});


test('revoked remote recovery reports its pinned Host and preserves pending ownership',async t=>{
  const f=await fixture(t);f.allowStop(false);
  f.native.handlers.set('thread/start',()=>{throw new Error('handshake refused');});
  await assert.rejects(f.sessions.launch({name:'revoked',host:'f1',harness:'codex',cwd:f.root}),/cleanup.*pending/);
  assert.equal(f.table.pendingStops()[0]?.process.host,'f1');
  f.revoke();
  const refused=eventually('revoked cleanup diagnostic receipt',()=>f.table.pendingStops()[0]?.error.includes('host f1 revoked')||undefined);
  await f.clock.advance(5000);await refused;
  assert.match(f.table.pendingStops()[0]!.error,/cleanup-incomplete on host f1/);
  assert.equal(f.calls.some(call=>call.startsWith('LOCAL')),false);
});


test('async Codex settlement precedes recovery-row and role release',async t=>{
  const f=await fixture(t,true);
  const gate=f.gate();f.holdUnforward(gate.promise);
  let closes=0;
  const nativeClose=f.native.close.bind(f.native);
  f.native.close=()=>{closes++;nativeClose();};
  // Fail after the connection is attached, so both native ownership paths are exercised.
  f.native.handlers.set('turn/start',()=>{throw new Error('handshake refused');});
  const launch=assert.rejects(f.sessions.launch({name:'owned',host:'f1',harness:'codex',cwd:f.root,role:'implementer'}),/handshake refused/);
  await eventually('unforward producer admitted',()=>f.calls.includes('unforward')||undefined);
  assert.equal(f.table.pendingStops().length,1,'recovery row retained before unforward receipt');
  assert.equal(f.core.store.roleOf('owned'),'implementer','role retained before unforward receipt');
  assert.equal(closes,1,'native client closes once before awaiting cancellation');
  await f.clock.advance(5000); // Admit the deferred retry while settlement is held.
  assert.equal(closes,1,'concurrent deferred recovery cannot close the client again');
  gate.resolve();await launch;
  assert.equal(closes,1,'settlement completion cannot close the client again');
  assert.deepEqual(f.table.pendingStops(),[]);
  assert.equal(f.core.store.roleOf('owned'),null);
});


test('standalone Codex deferred rollback cancels its forward after native cleanup',async t=>{
  const f=await fixture(t,false,false);f.allowStop(false);
  f.native.handlers.set('thread/start',()=>{throw new Error('handshake refused');});
  await assert.rejects(f.adapter.spawn({name:'standalone',host:'f1',cwd:f.root,role:null,model:null}),/cleanup is pending/);
  assert.equal(f.calls.includes('unforward'),false,'a live child retains its forward');
  f.allowStop(true);
  await eventually('standalone deferred cancellation receipt',()=>f.calls.includes('unforward')||undefined,2000);
  await f.adapter.close();
  assert.equal(f.calls.filter(call=>call==='unforward').length,1);
});


for (const stage of ['subscription', 'settlement'] as const) test(`forced failure releases held ${stage} before fixture storage and roots`, async t => {
  const hooks: Array<() => unknown | Promise<unknown>> = [];
  const scope = {after: (hook: () => unknown | Promise<unknown>) => hooks.push(hook)} as unknown as TestContext;
  const cleanup = async () => {for (const hook of hooks) await hook();};
  t.after(cleanup);
  const f = await fixture(scope, stage === 'settlement');
  const gate = f.gate();
  const receipt = join(f.storage, 'producer-finished');
  let entered = false;
  let launch: Promise<void> | undefined;
  if (stage === 'subscription') {
    const row = await f.adapter.spawn({name:'worker',role:null,model:null,cwd:f.root,host:'f1'});
    f.adapter.watch(row);f.native.close();f.native.removeAllListeners();
    const replacement = new ScriptedCodex();replacement.thread = f.native.thread;f.useNative(replacement);
    const request = replacement.request.bind(replacement);
    replacement.request = async <T>(method: string, params: Record<string, unknown>): Promise<T> => {
      if (method === 'thread/resume') {entered = true;await gate.promise;await writeFile(receipt,'finished');}
      return request<T>(method,params);
    };
    await f.clock.advance(10);
  } else {
    f.holdUnforward(gate.promise.then(async () => {await writeFile(receipt,'finished');}));
    f.native.handlers.set('thread/start',()=>{throw new Error('controlled handshake failure');});
    launch = assert.rejects(f.sessions.launch({name:'owned',host:'f1',harness:'codex',cwd:f.root,role:'implementer'}),/controlled handshake failure/);
  }
  f.afterDrain.push(async () => {
    await launch;
    assert.equal(await readFile(receipt,'utf8'),'finished','positive producer completion precedes storage close');
    assert.doesNotThrow(()=>f.table.pendingStops(),'storage is open at the drain receipt');
  });
  afterCleanup(scope, () => {
    assert.equal(f.drained,true);assert.equal(f.storageClosed,true);
    assert.equal(existsSync(f.root),false);assert.equal(existsSync(f.storage),false);
  });
  const failure = new Error('forced assertion failure before explicit gate release');
  await assert.rejects(async () => {
    try {
      await eventually('held producer admitted before forced failure',()=>stage==='subscription'?entered||undefined:f.calls.includes('unforward')||undefined);
      throw failure;
    } finally {await cleanup();}
  }, error => error === failure);
});
