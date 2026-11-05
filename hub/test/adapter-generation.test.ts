// T2: generation isolation with recording Hosts and held asynchronous receipts; no native children.
import test from 'node:test';
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
import { beforeDirectories } from './process-cleanup.ts';
import { Sessions } from '../src/adapters/sessions.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
import { HubCore } from '../src/hub/core.ts';
import { claimTransport } from '../src/transport/transport.ts';
import { generationAdapter } from '../src/adapters/generation-adapter.ts';
import { fakeHarness } from './fakes/harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { ScriptedCodex } from './fakes/scripted-codex.ts';

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
