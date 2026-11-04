// T2: held Host operations prove in-memory failed-launch settlement ownership.
import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {OpenCodeAdapter} from '../src/adapters/opencode.ts';
import {OpenCodeClient} from '../src/adapters/opencode/client.ts';
import {LaunchRecoveryPending} from '../src/adapters/launch-files.ts';
import {localHost} from '../src/host/local.ts';
import {tempProject,eventually} from './harness.ts';
import {fixtureEnvironment} from './fixture-environment.ts';
import {deferred} from './fakes/scripted-opencode.ts';

test('OpenCode failed launch retains a single-flight unforward until its positive receipt',async t=>{
 const root=await tempProject(t),env=fixtureEnvironment(root,process.env);
 const exit=deferred<{code:number|null;signal:string|null}>(),release=deferred<void>();
 let cancellations=0,stops=0;
 const machine={...localHost(env),name:'remote',freePort:async()=>12345,
  spawn:async()=>({pid:99191,exited:exit.promise}),identity:async(pid:number)=>({pid,pidStarted:'start',pidIdentity:'remote:birth'}),
  stop:async()=>{stops++;exit.resolve({code:0,signal:null});return true;},
  forward:async()=>({socket:join(root,'forward.sock')}),unforward:async()=>{cancellations++;await release.promise;}};
 t.mock.method(OpenCodeClient.prototype,'request',async(_method:string,path:string)=>{if(path==='/api/session/active')return {data:{}};throw new Error('synthetic native handshake failure');});
 const adapter=new OpenCodeAdapter({root,discoveryFile:join(root,'hub.json'),node:'node',cli:'cli',spoke:'spoke',hostForLaunch:()=>machine,hostForProcess:()=>machine,durableLaunchRecovery:true,signal:()=>{},recordPid:()=>{},exited:()=>{},log:()=>{}},{env,bin:'fake'});
 t.after(async()=>{release.resolve();await adapter.close();});
 let recovery!:LaunchRecoveryPending;
 try{await adapter.spawn({name:'worker',sessionId:'worker-id',cwd:root,role:null,model:'test/model'});assert.fail('launch must fail');}
 catch(error){assert.ok(error instanceof LaunchRecoveryPending);recovery=error;}
 // The hub owns rollback first, then awaits this captured in-memory callback.
 const {LaunchFiles}=await import('../src/adapters/launch-files.ts');
 const files=LaunchFiles.restore(recovery.files,undefined,machine);
 await files.rollback();assert.equal(stops,1);
 const first=Promise.resolve(recovery.settled()),second=Promise.resolve(recovery.settled());
 await eventually('exact unforward entered',()=>cancellations===1||undefined);
 let settled=false;void first.then(()=>{settled=true;});
 assert.equal(settled,false);
 release.resolve();await Promise.all([first,second]);assert.equal(cancellations,1);assert.equal(settled,true);
});

for (const boundary of ['poll', 'shutdown', 'stop'] as const) test(`OpenCode remote ${boundary} drains snapshots and subscription before cancelling its forward`, async t => {
 const {FakeClock}=await import('./fake-clock.ts');
 const {fakeHarness}=await import('./fakes/harness.ts');
 const {mkdir,writeFile}=await import('node:fs/promises');
 const root=await tempProject(t),env=fixtureEnvironment(root,process.env),clock=new FakeClock();
 const row={...await fakeHarness('opencode').spawn({name:'worker',role:null,model:null,cwd:root}),host:'remote',pid:99191,pidStarted:'start',pidIdentity:'remote:birth',harnessId:'http://127.0.0.1:12345'};
 await mkdir(join(root,'opencode/worker'),{recursive:true}); await writeFile(join(root,'opencode/worker/password'),'synthetic');
 const snapshots=deferred<void>(),stream=deferred<void>(),cancel=deferred<void>();
 let alive=true,opened=false,snapshotEntered=false,aborted=false,exits=0,cancellations=0,failCancellation=boundary!=='stop';
 let publish:(event:import('../src/adapters/opencode/client.ts').ServerEvent)=>void=()=>{};
 t.mock.method(OpenCodeClient.prototype,'request',async(_method:string,path:string)=>{
  if(path.endsWith('/permission')){snapshotEntered=true;await snapshots.promise;return {data:[]};}
  if(path.endsWith('/form'))return {data:[]};
  return {data:{}};
 });
 t.mock.method(OpenCodeClient.prototype,'events',async(onEvent:typeof publish,onOpen:()=>void,signal:AbortSignal)=>{
  publish=onEvent;signal.addEventListener('abort',()=>{aborted=true;},{once:true});opened=true;onOpen();await stream.promise;
 });
 const machine={...localHost(env),name:'remote',alive:async()=>alive,stop:async()=>{alive=false;return true;},forward:async()=>({socket:join(root,'forward.sock')}),unforward:async()=>{cancellations++;if(failCancellation){failCancellation=false;throw new Error('synthetic cancellation failure');}await cancel.promise;}};
 const logs:Record<string,unknown>[]=[];
 const adapter=new OpenCodeAdapter({root,discoveryFile:join(root,'hub.json'),node:'node',cli:'cli',spoke:'spoke',hostForProcess:()=>machine,signal:()=>{},recordPid:()=>{},exited:()=>{exits++;},log:entry=>logs.push(entry)},{env,clock,pollMs:100});
 t.after(async()=>{snapshots.resolve();stream.resolve();cancel.resolve();await adapter.stop(row);await adapter.close();});
 adapter.watch(row);await eventually('subscription and exact permission snapshot entered',()=>opened&&snapshotEntered||undefined);
 let stopping:Promise<void>|undefined;
 if(boundary==='stop') stopping=adapter.stop(row);
 else if(boundary==='shutdown') publish({type:'session.execution.interrupted',data:{sessionID:row.harnessSessionId,reason:'shutdown'}});
 else {alive=false;await clock.advance(100);}
 await eventually('stream abort observed before drain',()=>aborted||undefined);
 assert.equal(cancellations,0);assert.equal(exits,0);
 snapshots.resolve();
 // Subscription still owns its native close receipt after snapshots settle.
 assert.equal(cancellations,0);
 stream.resolve();
 if(boundary!=='stop') {
  await eventually('failed cancellation recorded',()=>logs.find(log=>String(log.error).includes('synthetic cancellation failure')));
  assert.equal(exits,0);
  await clock.advance(100);
 }
 await eventually('cancellation producer entered',()=>cancellations===(boundary==='stop'?1:2)||undefined);
 assert.equal(exits,0);
 cancel.resolve();
 if(stopping)await stopping;
 else await eventually('exit published only after positive cancellation',()=>exits===1||undefined);
 assert.equal(exits,boundary==='stop'?0:1);
});

test('OpenCode Unix client close aborts active HTTP and SSE and joins native close receipts', async t=>{
 const {createServer}=await import('node:http');
 const {fixtureSocketPath}=await import('../../test-support/socket-path.ts');
 const root=await tempProject(t),socket=fixtureSocketPath(root,'http');
 const peers=new Set<import('node:net').Socket>();
 let pending=false,opened=false;
 const server=createServer((req,res)=>{if(req.url==='/api/event'){res.writeHead(200,{'content-type':'text/event-stream'});res.write(': ready\n\n');}else pending=true;});
 server.on('connection',peer=>{peers.add(peer);peer.once('close',()=>peers.delete(peer));});
 await new Promise<void>(r=>server.listen(socket,r));
 t.after(async()=>{for(const peer of peers)peer.destroy();await new Promise<void>(r=>server.close(()=>r()));});
 const client=new OpenCodeClient('http://127.0.0.1:12345','synthetic',socket);
 const request=client.request('GET','/held').then(()=>false,()=>true);
 const events=client.events(()=>{},()=>{opened=true;},new AbortController().signal).then(()=>false,()=>true);
 await eventually('native held HTTP and subscribed SSE observed',()=>pending&&opened||undefined);
 await client.close();
 assert.equal(await request,true);assert.equal(await events,true);
 await eventually('native server peers closed',()=>peers.size===0||undefined);
 assert.equal(peers.size,0);
 await assert.rejects(client.request('GET','/after-close'),/client closed/);
});
