// T2: hub Sessions shutdown/restart reopens durable ownership across a failed launch.
// Recording Hosts and scripted clients keep every harness and transport boundary fake.
import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {Sessions} from '../src/adapters/sessions.ts';
import {ProcessTable} from '../src/adapters/processes.ts';
import {HubCore} from '../src/hub/core.ts';
import {Store} from '../src/hub/store.ts';
import {fixedRoles, parseRoles} from '../src/roles/config.ts';
import {CodexAdapter} from '../src/adapters/codex.ts';
import {OpenCodeAdapter} from '../src/adapters/opencode.ts';
import {OpenCodeClient} from '../src/adapters/opencode/client.ts';
import {recordingHost} from './recording-host.ts';
import {ScriptedCodex, deferred} from './fakes/scripted-codex.ts';
import {tempProject, eventually} from './harness.ts';
import {fixtureEnvironment} from './fixture-environment.ts';
import {FakeClock} from './fake-clock.ts';
import {fakeNativeGuard} from './fake-native-guard.ts';
import {beforeDirectories, afterCleanup} from './process-cleanup.ts';

for (const harness of ['codex','opencode'] as const) for (const missing of [false,true])
test(`${harness} hub restart ${missing?'holds the role when generation state is missing':'cancels its captured forward before role release'}`, async t => {
  let restore=()=>{};
  const guard=await fakeNativeGuard(value=>{restore=value;});
  afterCleanup(t,()=>{try{guard.verify();}finally{restore();}});
  const root=await tempProject(t,'restart-','/tmp'), env=fixtureEnvironment(root,process.env), clock=new FakeClock(Date.now());
  const exit=deferred<{code:number|null;signal:string|null}>(), release=deferred<void>();
  let stopAllowed=false, restarting=false, nativeClosed=false;
  const forwards=new Set<string>(), cancelled:string[]=[];
  const machine={...recordingHost(root),name:'remote',
    run:async()=>({code:0,stdout:'codex 0.160.0',stderr:''}),
    spawn:async()=>({pid:99191,exited:exit.promise}),
    identity:async(pid:number)=>({pid,pidStarted:'start',pidIdentity:`linux:fixture:${pid}`}),
    stop:async()=>{if(!stopAllowed)return false;nativeClosed=true;exit.resolve({code:0,signal:null});return true;},
    forward:async(id:string)=>{forwards.add(id);return {socket:join(root,'forward.sock')};},
    unforward:async(id:string)=>{if(!restarting)throw new Error('synthetic cancellation unavailable before restart');assert.equal(nativeClosed,true,'native closure precedes forward settlement');cancelled.push(id);await release.promise;forwards.delete(id);},
  };
  t.mock.method(OpenCodeClient.prototype,'request',async(_method:string,path:string)=>{if(path==='/api/session/active')return {data:{}};throw new Error('synthetic handshake failure');});
  const db=join(root,'recovery.db');
  const open=()=>{
    const store=new Store(db), table=new ProcessTable(db), core=new HubCore({store,clock,roles:fixedRoles(parseRoles(`[implementer.launch]\nharness="${harness}"\nsandbox="workspace-write"\nwritable_roots=["."]\nnetwork="none"`))});
    const sessions=new Sessions({root,core,table,hosts:[machine],env,recoveryClock:clock,transportClock:clock});
    const boundary=sessions.host({discoveryFile:join(root,'hub.json'),node:'node',cli:'cli',spoke:'spoke'});
    const native=new ScriptedCodex();native.handlers.set('thread/start',()=>{throw new Error('synthetic handshake failure');});
    const adapter=harness==='codex'?new CodexAdapter(boundary,{env,clock,connect:async()=>native}):new OpenCodeAdapter(boundary,{env,clock,bin:'fake'});
    sessions.register(adapter);
    return {store,table,core,sessions,adapter};
  };
  let active=open();
  beforeDirectories(t,async()=>{release.resolve();stopAllowed=true;restarting=true;await active.sessions.close();active.table.close();active.core.close();active.store.close();for(const id of [...forwards])await machine.unforward(id);});
  await assert.rejects(active.sessions.launch({name:'worker',host:'remote',harness,cwd:root,role:'implementer',model:'test/model'}),/cleanup.*pending/);
  const pending=active.table.pendingStops()[0]!;
  assert.ok(pending.files);assert.equal(forwards.size,1);
  assert.equal(active.store.roleOf('worker'),'implementer');
  // Shutdown joins rejected cleanup; its failure retains the durable recovery owner.
  await assert.rejects(Promise.resolve(active.sessions.close()),/session adapter cleanup failed/);
  if(missing){delete pending.files.settlement;active.table.pendingStop(pending);}
  active.table.close();active.core.close();active.store.close();
  stopAllowed=true;restarting=true;active=open();
  const outcome=eventually('restart settlement boundary observed',()=>missing
    ? active.table.pendingStops()[0]?.error.includes('failed generation state missing')||undefined
    : cancelled.length===1||undefined,{timeoutMs:1000,behaviour:'post-restart cleanup receipt'});
  await clock.advance(5000);await outcome;
  assert.equal(active.table.pendingStops().length,1);
  assert.equal(active.store.roleOf('worker'),'implementer');
  assert.equal(forwards.size,1,'forward remains until its positive cancellation receipt');
  if(missing){assert.deepEqual(cancelled,[]);assert.match(active.table.pendingStops()[0]!.error,/cleanup-incomplete.*failed generation state missing/);}
  else {
    assert.deepEqual(cancelled,[...forwards]);
    const cleared=eventually('durable pending owner cleared after cancellation',()=>active.table.pendingStops().length===0||undefined);
    release.resolve();await cleared;
    assert.equal(forwards.size,0);assert.equal(active.store.roleOf('worker'),null);
    assert.equal(active.adapter.failedLaunchSettlementCount(),0,'durable clearance acknowledges the exact completed recovery cache');
  }
});
