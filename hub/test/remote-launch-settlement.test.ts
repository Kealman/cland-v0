// T2: fresh adapter instances settle failed launches using recording Hosts and scripted clients.
import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {CodexAdapter} from '../src/adapters/codex.ts';
import {OpenCodeAdapter} from '../src/adapters/opencode.ts';
import {OpenCodeClient} from '../src/adapters/opencode/client.ts';
import type {AdapterHost, HarnessAdapter, HarnessProcess} from '../src/adapters/contract.ts';
import {LaunchFiles, LaunchRecoveryPending} from '../src/adapters/launch-files.ts';
import {recordingHost} from './recording-host.ts';
import {ScriptedCodex, deferred} from './fakes/scripted-codex.ts';
import {tempProject, eventually} from './harness.ts';
import {fixtureEnvironment} from './fixture-environment.ts';
import {fakeNativeGuard} from './fake-native-guard.ts';
import {afterCleanup, beforeDirectories} from './process-cleanup.ts';
import {generationOwnershipCounts} from '../src/adapters/generation-adapter.ts';

for (const harness of ['codex','opencode'] as const) for (const overlapping of [false,true]) test(`${harness} ${overlapping?'overlapping generations cancel only the saved forward':'fresh adapter settles the captured failed forward and refuses missing generation state'}`, async t => {
  let restore = () => {};
  const guard = await fakeNativeGuard(value => {restore=value;});
  afterCleanup(t, () => {try {guard.verify();} finally {restore();}});
  const root=await tempProject(t,'settle-','/tmp'), env=fixtureEnvironment(root,process.env);
  const release=deferred<void>();
  let refuse=true;
  const acquired:string[]=[], cancelled:string[]=[];
  const machine={...recordingHost(root),name:'remote',
    run:async()=>({code:0,stdout:'codex 0.160.0',stderr:''}),
    forward:async(id:string)=>{acquired.push(id);return {socket:join(root,'forward.sock')};},
    unforward:async(id:string)=>{cancelled.push(id);if(refuse)throw new Error('synthetic cancellation failure');await release.promise;},
  };
  const host:AdapterHost={root,discoveryFile:join(root,'hub.json'),node:'node',cli:'cli',spoke:'spoke',hostForLaunch:()=>machine,hostForProcess:()=>machine,durableLaunchRecovery:true,signal:()=>{},recordPid:()=>{},exited:()=>{},log:()=>{}};
  const native=new ScriptedCodex();
  native.handlers.set('thread/start',()=>{throw new Error('synthetic handshake failure');});
  t.mock.method(OpenCodeClient.prototype,'request',async(_method:string,path:string)=>{if(path==='/api/session/active')return {data:{}};throw new Error('synthetic handshake failure');});
  const make=():HarnessAdapter=>harness==='codex'?new CodexAdapter(host,{env,connect:async()=>native}):new OpenCodeAdapter(host,{env,bin:'fake'});
  const original=make(), fresh=overlapping?original:make();
  const count=()=> (fresh as CodexAdapter|OpenCodeAdapter).failedLaunchSettlementCount();
  beforeDirectories(t, async()=>{refuse=false;release.resolve();for(const row of await machine.processes())await machine.stop({...await machine.identity(row.pid),pid:row.pid});await original.close();if(fresh!==original)await fresh.close();});
  let recovery!:LaunchRecoveryPending;
  try {await original.spawn({name:'worker',sessionId:'worker-id',host:'remote',cwd:root,role:null,model:'test/model'});assert.fail('launch must fail');}
  catch(error){assert.ok(error instanceof LaunchRecoveryPending);recovery=error;}
  const saved=JSON.parse(JSON.stringify(recovery.files));
  const child=recovery.files.children[0]!;
  const row:HarnessProcess={name:'worker',sessionId:recovery.sessionId,host:'remote',harness,role:null,model:null,cwd:root,pid:child.pid,pidStarted:child.pidStarted,pidIdentity:child.pidIdentity??null,harnessId:null,harnessSessionId:null,startedAt:new Date().toISOString(),status:'stopped'};
  await LaunchFiles.restore(saved,undefined,machine).rollback();
  if(overlapping){
    let replacement!:LaunchRecoveryPending;
    try{await original.spawn({name:'worker',sessionId:row.sessionId,host:'remote',cwd:root,role:null,model:'test/model'});assert.fail('replacement must fail');}
    catch(error){assert.ok(error instanceof LaunchRecoveryPending);replacement=error;}
    await LaunchFiles.restore(replacement.files,undefined,machine).rollback();
    assert.equal(acquired.length,2);assert.notEqual(acquired[0],acquired[1],'newer generation has a separate Host namespace');
  }
  const before=generationOwnershipCounts(fresh);
  assert.equal(typeof fresh.settleFailedLaunch,'function','fresh adapters must implement durable settlement');
  const settle=(files:unknown)=>Promise.resolve().then(()=>Reflect.apply(fresh.settleFailedLaunch!,fresh,[row,files]));
  await assert.rejects(settle({undo:[],children:[]}),/cleanup-incomplete.*(missing|unavailable)/);
  assert.equal(count(),0,'missing metadata creates no recovery producer');
  await assert.rejects(settle(saved),/synthetic cancellation failure/);
  assert.equal(count(),1);fresh.acknowledgeFailedLaunch?.(row,saved);assert.equal(count(),1,'rejected producer remains owned after premature acknowledgement');
  refuse=false;
  const work=settle(saved);
  let settled=false;void work.then(()=>{settled=true;},()=>{});
  await eventually('captured forward cancellation admitted',()=>cancelled.length===2||undefined);
  assert.deepEqual(cancelled,[acquired[0],acquired[0]],'retry cancels only the captured forward, including beside a newer namespace');
  assert.deepEqual(generationOwnershipCounts(fresh),before,'recovery creates no native scope or aliases');
  fresh.acknowledgeFailedLaunch?.(row,saved);assert.equal(count(),1,'pending producer remains owned');
  assert.equal(settled,false,'settlement waits for positive cancellation');
  release.resolve();await work;
  assert.equal(settled,true);
  assert.equal(count(),1,'positive cancellation remains cached until durable acknowledgement');
  fresh.acknowledgeFailedLaunch?.(row,saved);assert.equal(count(),0,'durable acknowledgement releases completed recovery metadata');
  assert.deepEqual(generationOwnershipCounts(fresh),before);
  await assert.rejects(settle(saved),/generation is retired/);
  assert.equal(cancelled.length,2,'captured retired owner cannot cancel again');
});
