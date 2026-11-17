// T2: generation isolation with recording Hosts and held asynchronous receipts; no native children.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { OpenCodeAdapter } from '../src/adapters/opencode.ts';
import { CodexAdapter } from '../src/adapters/codex.ts';
import { ClaudeCodeAdapter } from '../src/adapters/claude-code.ts';
import { OpenCodeClient } from '../src/adapters/opencode/client.ts';
import type { AdapterHost, HarnessAdapter, HarnessProcess } from '../src/adapters/contract.ts';
import { hostGenerationKey } from '../src/adapters/processes.ts';
import { localHost } from '../src/host/local.ts';
import { FakeClock } from './fake-clock.ts';
import { tempProject } from './harness.ts';
import { until, testWaitMs } from './until.ts';
import { beforeDirectories, guardDirectoryRemoval } from './process-cleanup.ts';
import { hostFixtureOwner } from './host-fixture-owner.ts';
import { Sessions } from '../src/adapters/sessions.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { HubCore } from '../src/hub/core.ts';
import { claimTransport } from '../src/transport/transport.ts';
import { generationAdapter } from '../src/adapters/generation-adapter.ts';
import { fakeHarness } from './fakes/harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { ScriptedCodex } from './fakes/scripted-codex.ts';


/** Join the complete body before resource/storage disposal and root removal. */
function generationTest(t: TestContext, body: (fixture: {
  root: string; signal: AbortSignal; own: (close: () => void | Promise<void>) => void;
}) => Promise<void>): Promise<void> {
  const lifetime = hostFixtureOwner(t.signal);
  const resources = new AsyncDisposableStack();
  let closed = false;
  beforeDirectories(t, async () => {
    await lifetime.close();
    await resources.disposeAsync();
    closed = true;
  });
  return lifetime.run(async signal => {
    const root = await tempProject(t);
    guardDirectoryRemoval(root, () => { if (!closed) throw new Error('generation fixture drainage unconfirmed; root retained'); });
    signal.throwIfAborted();
    await body({root, signal, own: close => resources.defer(close)});
  });
}

for (const harness of ['opencode', 'codex', 'claude-code'] as const) test(`${harness} isolates the same id and endpoint while unreachable old cleanup drains`, {timeout:testWaitMs()*2}, async t => {
  const root = await tempProject(t);
  const env = fixtureEnvironment(root, process.env);
  const clock = new FakeClock();
  const held = Promise.withResolvers<boolean>();
  const calls: string[] = [], forwards: string[] = [], clients: ScriptedCodex[] = [];
  let oldEntered = false, oldClosed = false, newChecks = 0;
  const machine = { ...localHost(env), name: 'remote',
    alive: async (p: {pid: number | null}) => { calls.push(`alive:${p.pid}`); if (p.pid === 100) { oldEntered = true; return held.promise; } newChecks++; return true; },
    stop: async () => { calls.push('stop'); return true; },
    forward: async (id: string) => { calls.push('forward'); forwards.push(id); return {socket: join(root, 'native.sock')}; },
    unforward: async () => { calls.push('unforward'); },
  };
  const host: AdapterHost = {root, discoveryFile: join(root,'hub.json'), node:'',cli:'',spoke:'',hostForProcess:()=>machine,
    signal:()=>{},exited:()=>{calls.push('exited');},recordPid:()=>{},log:()=>{}};
  if (harness === 'opencode') {
    await mkdir(join(root,'opencode/worker'),{recursive:true});
    await writeFile(join(root,'opencode/worker/password'),'synthetic');
    t.mock.method(OpenCodeClient.prototype,'request',async()=>({data:[]}));
    t.mock.method(OpenCodeClient.prototype,'events',async(_event:unknown,onOpen:()=>void,signal:AbortSignal)=>{
      onOpen(); if (signal.aborted) return;
      await new Promise<void>(resolve=>signal.addEventListener('abort',()=>resolve(),{once:true}));
    });
  }
  const adapter: HarnessAdapter = harness === 'opencode' ? new OpenCodeAdapter(host,{env,clock,pollMs:100}) : harness === 'codex' ? new CodexAdapter(host,{env,clock,pollMs:100,connect:async()=>{
    const native = new ScriptedCodex(); native.thread='native';clients.push(native);return native;
  }}) : new ClaudeCodeAdapter(host,{env,clock,pollMs:100,agentsMs:0});
  beforeDirectories(t, async()=>{held.resolve(true);await adapter.close();});
  const old: HarnessProcess = {name:'worker',host:'remote',harness,role:null,model:null,cwd:root,pid:100,pidIdentity:'birth-old',harnessId:harness==='opencode'?'http://127.0.0.1:12345':join(root,'native.sock'),harnessSessionId:'native',sessionId:'stable',startedAt:'2026-11-05T00:00:00Z',status:'running'};
  adapter.watch(old);
  if(harness!=='claude-code') await until(()=>forwards.length===1,{what:'old generation forward acquired'});
  // Arm the receipt before advancing the fake polling clock. Do not await the held poll.
  const polling = clock.advance(100);
  await until(()=>oldEntered,{what:'old generation liveness read entered'});
  const atRelease = calls.length;
  const releasing = adapter.releaseUnreachableGeneration!(old).then(receipt=>{oldClosed=true;return receipt;});
  const fresh = {...old,pid:200,pidIdentity:'birth-new',startedAt:old.startedAt};
  adapter.watch(fresh);
  if(harness!=='claude-code') await until(()=>forwards.length===2,{what:'new generation owns a distinct forward'});
  assert.equal(oldClosed,false,'release joins the captured old in-flight read');
  held.resolve(true);
  const receipt = await releasing;
  await polling;
  assert.equal(receipt.generation,hostGenerationKey(old));
  assert.equal(receipt.released,true);
  assert.ok(receipt.dropped.includes('watch'));
  assert.equal(await adapter.releaseUnreachableGeneration!(old),receipt,'repeated release joins its receipt');
  assert.ok(!calls.slice(atRelease).includes('stop'));
  assert.ok(!calls.slice(atRelease).includes('unforward'));
  assert.ok(!calls.slice(atRelease).includes('exited'));
  if(harness!=='claude-code') assert.notEqual(forwards[0],forwards[1],'same native endpoint has separate Host forward ownership');
  if(harness==='codex') {assert.equal(clients[0]?.closed,true);assert.equal(clients[1]?.closed,false);}
  await clock.advance(100);
  await until(()=>newChecks>0,{what:'new generation remains watched after old cleanup completes'});
  assert.equal(calls.filter(call=>call==='alive:100').length,1,'old watch never runs again');
  await adapter.releaseUnreachableGeneration!({...old,pid:300,pidIdentity:'unseen-retained'});
  adapter.unwatch!(fresh.sessionId);
  if(harness==='codex') assert.equal(clients[1]?.closed,true,'id-only unwatch still selects the current generation');
  const checksAtUnwatch = newChecks;
  await clock.advance(100);
  assert.equal(newChecks,checksAtUnwatch,'unseen retained release cannot redirect current routing');
});


test('generation release joins admitted stop and permanently fences metadata and Host callbacks', {timeout:testWaitMs()*2}, async t => {
  const root = await tempProject(t);
  const finish = Promise.withResolvers<void>();
  let entered = false;
  const writes: string[] = [], effects: string[] = [];
  const host: AdapterHost = {root,discoveryFile:'',node:'',cli:'',spoke:'',log:()=>{},
    adapterState:{read:()=>null,write:key=>{writes.push(key);}},
    hostForProcess:()=>({...localHost(fixtureEnvironment(root,process.env)),alive:async()=>{effects.push('alive');return true;}}),
    signal:()=>{effects.push('signal');},recordPid:()=>{},exited:()=>{effects.push('exited');}};
  const make = (scoped: AdapterHost) => Object.assign(fakeHarness('codex'), {
    assertLaunchAvailable:()=>{},detachUnreachable:async()=>[],
    stop:async(p:HarnessProcess)=>{entered=true;await finish.promise;
      scoped.adapterState!.write('stable-id','late');scoped.signal(p.sessionId,{state:'idle',source:'late',at:0});
      await assert.rejects(async()=>scoped.hostForProcess!(p).alive(p),/fenced/);
    },
  });
  const adapter: HarnessAdapter = generationAdapter(make(host),host,make);
  beforeDirectories(t,async()=>{finish.resolve();await adapter.close();});
  const p:HarnessProcess={name:'old',harness:'codex',host:'remote',role:null,model:null,cwd:root,pid:1,pidIdentity:'old',harnessId:null,harnessSessionId:null,sessionId:'stable',startedAt:'same',status:'running'};
  const stop = adapter.stop(p);
  await until(()=>entered,{what:'admitted stop entered'});
  let released = false;
  const drain = adapter.releaseUnreachableGeneration!(p).then(r=>{released=true;return r;});
  await Promise.resolve();
  assert.equal(released,false);
  finish.resolve();await stop;
  const receipt = await drain;
  assert.ok(receipt.dropped.includes('in-flight'));
  assert.deepEqual(writes,[]);assert.deepEqual(effects,[]);
});

test('public wrappers surround routed operations and baseline fallback without recursion', {timeout:testWaitMs()*2}, async t => {
  const root=await tempProject(t);
  const host:AdapterHost={root,discoveryFile:'',node:'',cli:'',spoke:'',log:()=>{},signal:()=>{},recordPid:()=>{},exited:()=>{}};
  const forgotten:string[]=[];
  const make=()=>Object.assign(fakeHarness('codex'),{assertLaunchAvailable:()=>{},detachUnreachable:async()=>[],forget:(id:string)=>{forgotten.push(id);}});
  const adapter:HarnessAdapter=generationAdapter(make(),host,make);
  beforeDirectories(t,()=>adapter.close());
  const forget=adapter.forget!.bind(adapter);
  let wrappers=0;
  adapter.forget=id=>{wrappers++;forget(id);};
  adapter.forget('no-current-generation');
  assert.deepEqual(forgotten,['no-current-generation']);assert.equal(wrappers,1);
  const spawn=adapter.spawn.bind(adapter);
  adapter.spawn=request=>spawn({...request,model:'wrapped'});
  const row=await adapter.spawn({name:'wrapped',role:null,model:null,cwd:root});
  assert.equal(row.model,'wrapped');
  adapter.forget(row.sessionId);
  assert.deepEqual(forgotten,['no-current-generation',row.sessionId]);assert.equal(wrappers,2);
});

test('a fully stopped same-host fresh resume retires old aliases before its late release hook', {timeout:testWaitMs()*2}, async t => {
  const root=await tempProject(t);
  const host:AdapterHost={root,discoveryFile:'',node:'',cli:'',spoke:'',log:()=>{},signal:()=>{},recordPid:()=>{},exited:()=>{}};
  const make=()=>{
    let watched=false;
    return Object.assign(fakeHarness('codex'),{
      assertLaunchAvailable:()=>{},watch:()=>{watched=true;},
      detachUnreachable:async()=>{const dropped:Array<'watch'>=watched?['watch']:[];watched=false;return dropped;},
      resume:async(p:HarnessProcess)=>{watched=false;const process={...p,pid:2,pidIdentity:'new-birth',startedAt:'new-start'};watched=true;return {found:true as const,process,state:'idle' as const};},
    });
  };
  const adapter:HarnessAdapter=generationAdapter(make(),host,make);
  beforeDirectories(t,()=>adapter.close());
  const old:HarnessProcess={name:'worker',harness:'codex',role:null,model:null,cwd:root,pid:1,pidIdentity:'old-birth',harnessId:null,harnessSessionId:null,sessionId:'stable',startedAt:'old-start',status:'running'};
  adapter.watch(old);
  const resumed=await adapter.resume(old,{relaunch:true});assert.equal(resumed.found,true);if(!resumed.found)throw new Error('fresh resume missing');
  const receipt=await adapter.releaseUnreachableGeneration!(old);
  assert.deepEqual(receipt.dropped,[],'the already stopped old generation owns no new watch');
  assert.doesNotThrow(()=>adapter.watch(resumed.process));
  const current=await adapter.releaseUnreachableGeneration!(resumed.process);
  assert.ok(current.dropped.includes('watch'),'the current generation keeps its own watch until its own release');
});


test('missing stopped-owner proof refuses release without touching a replacement carrier', {timeout:testWaitMs()*2}, async t=>{
  const root=await tempProject(t),core=new HubCore(),table=new ProcessTable(':memory:');
  const effects:string[]=[];
  const carrier={kind:'ssh' as const,host:'f1',start:async()=>{},stop:async()=>{},wake:()=>{},status:()=>({name:'f1',state:'down' as const,since:null,lastProbe:null,reconnects:0}),dropForwardLocal:async(ids:readonly string[])=>{effects.push(...ids);}};
  const release=claimTransport(root,carrier);
  const host={...localHost(fixtureEnvironment(root,process.env)),name:'f1',forward:async()=>({socket:join(root,'synthetic-forward')})};
  const sessions=new Sessions({root,core,table,hosts:[host]});
  const adapter=fakeHarness('codex');
  const p={...await adapter.spawn({name:'old',role:null,model:null,cwd:root}),host:'f1'};
  Object.assign(adapter,{releaseUnreachableGeneration:async()=>({generation:hostGenerationKey(p),released:true,dropped:['forward'],forwardIds:['captured-forward']})});
  sessions.register(adapter);
  let releaseReplacement=()=>{};
  beforeDirectories(t,async()=>{await sessions.close();release();releaseReplacement();table.close();core.close();core.store.close();});
  await sessions.host({discoveryFile:'',node:'',cli:'',spoke:''}).hostForProcess!(p).forward('captured-forward',{port:12345});
  release(); // Unregistration is deliberately not a positive unlink/stop receipt.
  await assert.rejects(sessions.releaseUnreachableGeneration(p),/owner unavailable/);
  releaseReplacement=claimTransport(root,{...carrier});
  await assert.rejects(sessions.releaseUnreachableGeneration(p),/owner unavailable/);
  assert.deepEqual(effects,[],'a new carrier cannot inherit the old caller cleanup authority');
});

test('settled generations retire facade and transport proof across relaunch cycles', async t => generationTest(t, async ({root, signal, own}) => {
  const { generationOwnershipCounts } = await import('../src/adapters/generation-adapter.ts');
  const { retainLocalForwardOwner, localForwardOwner, noteTransportStopped, dropHostForwardsLocal } = await import('../src/transport/transport.ts');
  const host: AdapterHost = {root,discoveryFile:'',node:'',cli:'',spoke:'',log:()=>{},signal:()=>{},recordPid:()=>{},exited:()=>{}};
  const make = () => Object.assign(fakeHarness('codex'), {assertLaunchAvailable:()=>{},detachUnreachable:async()=>[]});
  const adapter: HarnessAdapter = generationAdapter(make(), host, make);
  own(() => adapter.close());
  for (let cycle = 0; cycle < 100; cycle++) {
    signal.throwIfAborted();
    const p = await adapter.spawn({name:'worker',role:null,model:null,cwd:root});
    signal.throwIfAborted();
    const carrier = {kind:'ssh' as const,host:'remote',start:async()=>{},stop:async()=>{},wake:()=>{},status:()=>({name:'remote',state:'down' as const,since:null,lastProbe:null,reconnects:0})};
    const unregister = claimTransport(root, carrier);
    own(unregister);
    const owner = localForwardOwner(root, 'remote')!;
    const release = retainLocalForwardOwner(owner, p.sessionId);
    try {
      const receipt = await adapter.releaseUnreachableGeneration!(p);
      assert.equal(await adapter.releaseUnreachableGeneration!({...p}), receipt);
      noteTransportStopped(root, carrier, [p.sessionId]);
      unregister();
      const proof = [{id:p.sessionId,owner}];
      await dropHostForwardsLocal(root, 'remote', proof);
      await dropHostForwardsLocal(root, 'remote', proof);
      await assert.rejects(dropHostForwardsLocal(root, 'remote', [{id:p.sessionId,owner:'unknown'}]), /owner unavailable/);
      release(); release();
      await assert.rejects(dropHostForwardsLocal(root, 'remote', proof), /owner unavailable/);
      adapter.retireGeneration!(p);
      assert.deepEqual(generationOwnershipCounts(adapter), {scopes:0,identities:0,current:0,launching:0,forwards:0});
      assert.throws(() => adapter.watch(p), /fenced/, 'captured process remains fenced without a strong index');
    } finally { release(); unregister(); }
  }
}));

test('Sessions retires captured forward proof only after retained resource settlement', async t => generationTest(t, async ({root, signal, own}) => {
  const { localForwardOwner, noteTransportStopped, dropHostForwardsLocal } = await import('../src/transport/transport.ts');
  signal.throwIfAborted();
  const core = new HubCore();
  own(() => { core.close(); core.store.close(); });
  const table = new ProcessTable(':memory:');
  own(() => table.close());
  const host = {...localHost(fixtureEnvironment(root,process.env)),name:'remote',forward:async()=>({socket:join(root,'synthetic')}),listFolder:async()=>[]};
  const carrier = {kind:'ssh' as const,host:'remote',start:async()=>{},stop:async()=>{},wake:()=>{},status:()=>({name:'remote',state:'down' as const,since:null,lastProbe:null,reconnects:0})};
  const unregister = claimTransport(root,carrier);
  own(unregister);
  const sessions = new Sessions({root,core,table,hosts:[host]});
  own(async()=>{await sessions.close();});
  const adapter = fakeHarness('codex');
  const p = {...await adapter.spawn({name:'worker',role:null,model:null,cwd:root}),host:'remote',status:'stopped' as const};
  let retired = false;
  Object.assign(adapter, {releaseUnreachableGeneration:async()=>({generation:hostGenerationKey(p),released:true,dropped:[],forwardIds:['captured']}),releaseHostGeneration:async()=>{},retireGeneration:()=>{retired=true;}});
  signal.throwIfAborted();
  sessions.register(adapter); table.put(p); table.retainHostGeneration(p,'confirmed');
  await sessions.host({discoveryFile:'',node:'',cli:'',spoke:''}).hostForProcess!(p).forward('captured',{port:12345});
  const proof = [{id:'captured',owner:localForwardOwner(root,'remote')!}];
  noteTransportStopped(root,carrier,['captured']);unregister();
  await sessions.releaseUnreachableGeneration(p);await sessions.releaseUnreachableGeneration(p);
  assert.equal(retired,false);
  const report = await sessions.settleHostBeforeCut('remote',()=>{});
  assert.deepEqual(report.leftovers,[]);assert.equal(report.inventoryComplete,true);
  assert.equal(retired,true);assert.deepEqual([...table.retainedHostGenerations('remote')],[]);
  await assert.rejects(dropHostForwardsLocal(root,'remote',proof),/owner unavailable/);
  await assert.rejects(sessions.releaseUnreachableGeneration(p),/captured local forward owner unavailable/);
}));

test('replacement keeps its assigned forward namespace after older scope retirement', async t => generationTest(t, async ({root, signal, own}) => {
  signal.throwIfAborted();
  const forwarded: string[] = [], removed: string[] = [];
  const machine = {...localHost(fixtureEnvironment(root,process.env)),name:'remote',
    forward:async(id:string)=>{forwarded.push(id);return {socket:join(root,id)};},
    unforward:async(id:string)=>{removed.push(id);}};
  const host: AdapterHost = {root,discoveryFile:'',node:'',cli:'',spoke:'',log:()=>{},signal:()=>{},recordPid:()=>{},exited:()=>{},hostForProcess:()=>machine};
  const make = (scoped: AdapterHost) => Object.assign(fakeHarness('codex'), {
    assertLaunchAvailable:()=>{},detachUnreachable:async()=>[],
    stop:async(p:HarnessProcess)=>{await scoped.hostForProcess!(p).unforward(p.sessionId);},
    watch:(p:HarnessProcess)=>{void scoped.hostForProcess!(p).forward(p.sessionId,{port:12345});},
  });
  const adapter: HarnessAdapter = generationAdapter(make(host),host,make);
  own(()=>adapter.close());
  const old = await adapter.spawn({name:'worker',role:null,model:null,cwd:root});
  signal.throwIfAborted();
  const fresh = {...old,pid:200,pidIdentity:'replacement'};
  adapter.watch(old);adapter.watch(fresh);
  assert.equal(forwarded.length,2);assert.notEqual(forwarded[0],forwarded[1]);
  await adapter.releaseUnreachableGeneration!(old);adapter.retireGeneration!(old);
  await adapter.stop(fresh);
  assert.deepEqual(removed,[forwarded[1]]);
}));

for (const lifecycle of ['relaunch', 'stop-then-spawn', 'restored-stop-then-spawn'] as const) test(`production ${lifecycle} retires superseded local aliases across 100 cycles`, async t => generationTest(t, async ({root, signal, own}) => {
  const { generationOwnershipCounts } = await import('../src/adapters/generation-adapter.ts');
  const host: AdapterHost = {root,discoveryFile:'',node:'',cli:'',spoke:'',log:()=>{},signal:()=>{},recordPid:()=>{},exited:()=>{}};
  let birth = 0;
  const make = () => Object.assign(fakeHarness('codex'), {
    assertLaunchAvailable:()=>{},detachUnreachable:async()=>[],
    resume:async(p:HarnessProcess)=>({found:true as const,process:{...p,pid:++birth,pidIdentity:`birth:${birth}`},state:'idle' as const}),
  });
  const adapter: HarnessAdapter = generationAdapter(make(),host,make);
  own(()=>adapter.close());
  let p = await (lifecycle === 'restored-stop-then-spawn' ? make() : adapter).spawn({name:'worker',role:null,model:null,cwd:root});
  for (let cycle = 0; cycle < 100; cycle++) {
    signal.throwIfAborted();
    const previous = p;
    if (lifecycle === 'relaunch') {
      const result = await adapter.resume(p,{relaunch:true});
      assert.equal(result.found,true);
      if (!result.found) throw new Error('replacement missing');
      p = result.process;
    } else {
      await adapter.stop(p);
      // The stopped current generation is still needed for resume.
      assert.equal(generationOwnershipCounts(adapter).scopes,1);
      p = await adapter.spawn({name:'worker',sessionId:p.sessionId,role:null,model:null,cwd:root});
    }
    assert.deepEqual(generationOwnershipCounts(adapter), {scopes:1,identities:1,current:1,launching:1,forwards:1});
    signal.throwIfAborted();
    assert.throws(()=>adapter.watch(previous),/fenced/);
    assert.doesNotThrow(()=>adapter.watch(p));
  }
}));

for (const outcome of ['confirmed', 'unknown'] as const) test(`superseded local scope keeps pending stop until ${outcome} closure`, async t => generationTest(t, async ({root, signal, own}) => {
  const { generationOwnershipCounts } = await import('../src/adapters/generation-adapter.ts');
  const finish = Promise.withResolvers<void>();
  // Release a held stop before joining the body if this test is cancelled.
  t.signal.addEventListener('abort',()=>finish.resolve(),{once:true});
  const host: AdapterHost = {root,discoveryFile:'',node:'',cli:'',spoke:'',log:()=>{},signal:()=>{},recordPid:()=>{},exited:()=>{}};
  const make = () => Object.assign(fakeHarness('codex'), {
    assertLaunchAvailable:()=>{},detachUnreachable:async()=>[],stop:async()=>{
      await finish.promise;
      if (outcome === 'unknown') throw new Error('native closure unknown');
    },
  });
  const adapter: HarnessAdapter = generationAdapter(make(),host,make);
  own(()=>{finish.resolve();return adapter.close();});
  const old = await adapter.spawn({name:'worker',role:null,model:null,cwd:root});
  signal.throwIfAborted();
  const stopping = adapter.stop(old);
  void stopping.catch(()=>{});
  await adapter.spawn({name:'worker',sessionId:old.sessionId,role:null,model:null,cwd:root});
  assert.equal(generationOwnershipCounts(adapter).scopes,2,'pending native closure is retained');
  finish.resolve();
  if (outcome === 'unknown') await assert.rejects(stopping,/native closure unknown/);
  else await stopping;
  assert.equal(generationOwnershipCounts(adapter).scopes,outcome === 'confirmed' ? 1 : 2);
}));

for (const harness of ['opencode', 'codex', 'claude-code'] as const) test(`${harness} retires 100 rejected spawns before native acquisition`, async t => generationTest(t, async ({root, signal, own}) => {
  const { generationOwnershipCounts } = await import('../src/adapters/generation-adapter.ts');
  signal.throwIfAborted();
  const host: AdapterHost = {root,discoveryFile:join(root,'.cland/hub.json'),node:'',cli:'',spoke:'',log:()=>{},signal:()=>{},recordPid:()=>{},exited:()=>{},
    hostForLaunch:()=>{throw new Error('placement refused before acquisition');}};
  const env = fixtureEnvironment(root,process.env);
  const adapter: HarnessAdapter = harness === 'codex' ? new CodexAdapter(host,{env}) : harness === 'opencode' ? new OpenCodeAdapter(host,{env}) : new ClaudeCodeAdapter(host,{env,agentsMs:0});
  own(()=>adapter.close());
  for (let attempt = 0; attempt < 100; attempt++) {
    signal.throwIfAborted();
    await assert.rejects(adapter.spawn({name:'worker',role:null,model:null,cwd:root}),/placement refused before acquisition/);
    assert.deepEqual(generationOwnershipCounts(adapter),{scopes:0,identities:0,current:0,launching:0,forwards:0});
  }
}));

for (const harness of ['codex', 'opencode'] as const) test(`local ${harness} failed spawn retires only after durable file rollback and its producer receipt`, async t => generationTest(t, async ({root, signal, own}) => {
  const { generationOwnershipCounts } = await import('../src/adapters/generation-adapter.ts');
  const { LaunchRecoveryPending, LaunchFiles } = await import('../src/adapters/launch-files.ts');
  signal.throwIfAborted();
  const env = fixtureEnvironment(root,process.env), files = localHost(env);
  let nativeAttempts = 0, refuseUndo = false;
  const machine = {...files,
    run:async()=>({code:0,signal:null,stdout:'codex 0.160.0',stderr:''}),
    freePort:async()=>12345,
    spawn:async()=>{nativeAttempts++;refuseUndo=true;throw new Error('native launch refused');},
    removePath:async(...args:Parameters<typeof files.removePath>)=>{if(refuseUndo)throw new Error('rollback held');await files.removePath(...args);},
  };
  const host: AdapterHost = {root,discoveryFile:join(root,'.cland/hub.json'),node:process.execPath,cli:'',spoke:'',log:()=>{},signal:()=>{},recordPid:()=>{},exited:()=>{},durableLaunchRecovery:true,hostForLaunch:()=>machine,hostForProcess:()=>machine};
  const adapter = harness === 'codex' ? new CodexAdapter(host,{env}) : new OpenCodeAdapter(host,{env});
  own(()=>adapter.close());
  let pending: InstanceType<typeof LaunchRecoveryPending> | undefined;
  try { await adapter.spawn({name:'worker',role:null,model:null,cwd:root}); }
  catch (error) { assert.ok(error instanceof LaunchRecoveryPending);pending=error; }
  assert.ok(pending);assert.equal(nativeAttempts,1);
  assert.equal(generationOwnershipCounts(adapter).scopes,1,'durable pending obligation retains its scope');
  const rollback = LaunchFiles.restore(pending.files,undefined,machine);
  await assert.rejects(rollback.rollback(),/rollback held/);
  assert.equal(generationOwnershipCounts(adapter).scopes,1,'failed cleanup is not a settlement receipt');
  refuseUndo=false;
  await rollback.rollback();
  assert.equal(generationOwnershipCounts(adapter).scopes,1,'file undo alone does not retire remaining transport settlement');
  await pending.settled();
  assert.deepEqual(generationOwnershipCounts(adapter),{scopes:0,identities:0,current:0,launching:0,forwards:0});
}));

test('unknown failed-spawn outcome stays retained across replacement until its producer settles', async t => generationTest(t, async ({root, own}) => {
  const { generationOwnershipCounts } = await import('../src/adapters/generation-adapter.ts');
  const host: AdapterHost = {root,discoveryFile:'',node:'',cli:'',spoke:'',log:()=>{},signal:()=>{},recordPid:()=>{},exited:()=>{}};
  let attempts=0,settle: (() => void) | undefined;
  const make = (scoped: AdapterHost) => {
    const adapter=Object.assign(fakeHarness('codex'),{assertLaunchAvailable:()=>{},detachUnreachable:async()=>[]});
    const spawn=adapter.spawn.bind(adapter);
    adapter.spawn=async request=>{if(++attempts===1){settle=()=>scoped.spawnFailureSettled?.();throw new Error('launch outcome unknown');}return spawn(request);};
    return adapter;
  };
  const adapter: HarnessAdapter=generationAdapter(make(host),host,make);
  own(()=>adapter.close());
  await assert.rejects(adapter.spawn({name:'worker',role:null,model:null,cwd:root}),/launch outcome unknown/);
  assert.equal(generationOwnershipCounts(adapter).scopes,1);
  await adapter.spawn({name:'worker',role:null,model:null,cwd:root});
  assert.equal(generationOwnershipCounts(adapter).scopes,2,'replacement is no proof of failed-launch settlement');
  assert.ok(settle);settle();
  assert.deepEqual(generationOwnershipCounts(adapter),{scopes:1,identities:1,current:1,launching:1,forwards:1},'late settlement removes only its captured failed scope');
}));

test('local Claude retires repeated failed spawns after prepared-file rollback', async t => generationTest(t, async ({root, signal, own}) => {
  const { generationOwnershipCounts } = await import('../src/adapters/generation-adapter.ts');
  signal.throwIfAborted();
  const env=fixtureEnvironment(root,process.env),files=localHost(env);
  let writes=0,commands=0;
  const machine={...files,
    writeFile:async(...args:Parameters<typeof files.writeFile>)=>{writes++;await files.writeFile(...args);},
    run:async()=>{commands++;return {code:1,signal:null,stdout:'',stderr:'synthetic native refusal'};},
  };
  const host: AdapterHost={root,discoveryFile:join(root,'.cland/hub.json'),node:process.execPath,cli:'',spoke:'',log:()=>{},signal:()=>{},recordPid:()=>{},exited:()=>{},hostForLaunch:()=>machine,hostForProcess:()=>machine};
  const adapter=new ClaudeCodeAdapter(host,{env,agentsMs:0});
  own(()=>adapter.close());
  for(let attempt=0;attempt<10;attempt++){
    signal.throwIfAborted();
    await assert.rejects(adapter.spawn({name:'worker',role:null,model:null,cwd:root}),/synthetic native refusal/);
    assert.deepEqual(generationOwnershipCounts(adapter),{scopes:0,identities:0,current:0,launching:0,forwards:0});
  }
  assert.ok(writes>0,'prepared-file acquisition positive control');
  assert.equal(commands,10,'every synthetic native refusal was observed');
}));


test('100 settled failed spawns leave only the later successful generation indexed', async t => generationTest(t, async ({root, signal, own}) => {
  const { generationOwnershipCounts } = await import('../src/adapters/generation-adapter.ts');
  const { withSpawnSettlement } = await import('../src/adapters/launch-settlement.ts');
  signal.throwIfAborted();
  const host: AdapterHost={root,discoveryFile:'',node:'',cli:'',spoke:'',log:()=>{},signal:()=>{},recordPid:()=>{},exited:()=>{}};
  let attempts=0;
  const make=(scoped:AdapterHost)=>{
    const adapter=Object.assign(fakeHarness('codex'),{assertLaunchAvailable:()=>{},detachUnreachable:async()=>[]});
    const spawn=adapter.spawn.bind(adapter);
    adapter.spawn=request=>withSpawnSettlement(()=>scoped.spawnFailureSettled?.(),async acquiring=>{
      if(++attempts<=100)throw new Error('settled refusal');
      acquiring();return spawn(request);
    });
    return adapter;
  };
  const adapter:HarnessAdapter=generationAdapter(make(host),host,make);
  own(()=>adapter.close());
  for(let attempt=0;attempt<100;attempt++){
    signal.throwIfAborted();
    await assert.rejects(adapter.spawn({name:'worker',role:null,model:null,cwd:root}),/settled refusal/);
    assert.equal(generationOwnershipCounts(adapter).scopes,0);
  }
  const p=await adapter.spawn({name:'worker',role:null,model:null,cwd:root});
  assert.doesNotThrow(()=>adapter.watch(p));
  assert.deepEqual(generationOwnershipCounts(adapter),{scopes:1,identities:1,current:1,launching:1,forwards:1});
}));

test('facade close preserves an unreturned failed launch until its rollback owner settles', async t => generationTest(t, async ({root, signal, own}) => {
  const { generationOwnershipCounts } = await import('../src/adapters/generation-adapter.ts');
  const { LaunchRecoveryPending } = await import('../src/adapters/launch-files.ts');
  const { stat } = await import('node:fs/promises');
  signal.throwIfAborted();
  const path=join(root,'owned-credential-copy');
  await writeFile(path,'synthetic fixture credential');
  const release=Promise.withResolvers<void>();
  signal.addEventListener('abort',()=>release.resolve(),{once:true});
  let entered=false,transientClosed=false;
  let spawning:Promise<HarnessProcess>|undefined,closing:Promise<void>|void;
  const host:AdapterHost={root,discoveryFile:'',node:'',cli:'',spoke:'',log:()=>{},signal:()=>{},recordPid:()=>{},exited:()=>{},hostForLaunch:()=>localHost(fixtureEnvironment(root,process.env))};
  const make=(scoped:AdapterHost)=>Object.assign(fakeHarness('codex'),{
    assertLaunchAvailable:()=>{},detachUnreachable:async()=>[],
    spawn:async(request:Parameters<HarnessAdapter['spawn']>[0])=>{
      const captured=scoped.hostForLaunch!(request);
      const failure=new LaunchRecoveryPending('unreturned-generation',{undo:[],children:[]},async()=>{
        await captured.removePath(path);
        scoped.spawnFailureSettled?.();
      },new Error('failed adoption'));
      entered=true;
      await release.promise;
      throw failure;
    },
    close:async()=>{transientClosed=true;},
  });
  const adapter:HarnessAdapter=generationAdapter(make(host),host,make);
  own(async()=>{release.resolve();await spawning?.catch(()=>{});if(closing)await closing;await adapter.close();});
  spawning=adapter.spawn({name:'worker',role:null,model:null,cwd:root});
  void spawning.catch(()=>{});
  await until(()=>entered,{what:'failed launch captured its rollback Host before close'});
  closing=adapter.close();
  await until(()=>transientClosed,{what:'native transient close acknowledged before failure delivery'});
  release.resolve();
  let pending:InstanceType<typeof LaunchRecoveryPending>|undefined;
  await assert.rejects(spawning,error=>{assert.ok(error instanceof LaunchRecoveryPending);pending=error;return true;});
  if(closing)await closing;
  assert.equal((await stat(path)).isFile(),true,'rollback obligation still owns its credential copy');
  assert.equal(generationOwnershipCounts(adapter).scopes,1,'transient close cannot retire a pending durable rollback owner');
  assert.ok(pending);
  await pending.settled();
  await assert.rejects(stat(path),{code:'ENOENT'});
  assert.deepEqual(generationOwnershipCounts(adapter),{scopes:0,identities:0,current:0,launching:0,forwards:0});
}));
