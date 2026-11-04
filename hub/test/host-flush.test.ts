// T1: publication admission waits on the owner and refuses unknown or mismatched facts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { flushHostBranch } from '../src/host/flush.ts';
import type { Host } from '../src/host/host.ts';
const before='a'.repeat(40),head='b'.repeat(40);
const row={item:'T-1',host:'fake',root:'/host',path:'/host/task',branch:'t/task',tip:before};
function fake(flush:()=>Promise<void>,read=()=>head):Pick<Host,'name'|'run'|'flushBranch'>{return {name:'fake',flushBranch:flush,run:async command=>{assert.equal(command.cwd,row.path);assert.ok(['rev-parse','symbolic-ref'].includes(command.args[0]!));return {code:0,stdout:command.args[0]==='symbolic-ref'?row.branch:read(),stderr:''};}};}
test('unpublished host HEAD waits for the leased flush before territory admission',async()=>{
  const gate=Promise.withResolvers<void>();let territory=before,entered=false;
  const host=fake(async()=>{entered=true;await gate.promise;territory=head;});
  const pending=flushHostBranch(host,row,async()=>territory,head);
  await Promise.resolve();await Promise.resolve();assert.equal(entered,true);assert.equal(territory,before);
  gate.resolve();assert.equal(await pending,head);assert.equal(territory,head);
});
for(const reason of ['watch fenced: native outcome unknown','lease failure','agent unavailable'])test(`flush refuses ${reason} with both heads`,async()=>{
  await assert.rejects(flushHostBranch(fake(async()=>{throw new Error(reason);}),row,async()=>before),error=>{
    assert.match(String(error),/host-flush-refused/);assert.ok(String(error).includes(reason));assert.ok(String(error).includes(head));assert.ok(String(error).includes(before));return true;
  });
});
test('a successful flush with a differing territory head is refused',async()=>{
 await assert.rejects(flushHostBranch(fake(async()=>{}),row,async()=>before,head),new RegExp(`worktree HEAD ${head}; territory HEAD ${before}`));
});
test('reported HEAD is checked against the captured owner and never used as authority',async()=>{
 let pushed=false;await assert.rejects(flushHostBranch(fake(async()=>{pushed=true;}),row,async()=>head,before),/reported HEAD changed/);assert.equal(pushed,false);
});
test('a moving worktree cannot acquire a receipt for a previous head',async()=>{
 let current=head;await assert.rejects(flushHostBranch(fake(async()=>{current=before;},()=>current),row,async()=>head),/HEAD changed during flush/);
});
test('older Host implementation explicitly refuses flush without a local fallback',async()=>{
 const host=fake(async()=>{});delete host.flushBranch;await assert.rejects(flushHostBranch(host,row,async()=>head),/agent flush capability unavailable/);
});

test('wire validation accepts additive CLI HEAD reports and the previous request shape',async()=>{
 const {validateToolFrame}=await import('../src/tool-arguments.ts');
 for(const extra of [{},{worktreeHead:head}]){
  validateToolFrame({type:'suite.start',id:'v',mode:'auto',cwd:'/task',...extra});
  validateToolFrame({type:'task.edit',id:'r',item:'T-1',status:'ready',...extra});
 }
 assert.throws(()=>validateToolFrame({type:'suite.start',id:'v',mode:'auto',cwd:'/task',worktreeHead:1}),/worktreeHead/);
});

test('status renders pending and named snapshot leftovers while accepting the previous hub shape',async()=>{
 const {describe}=await import('../src/cli/hub.ts');
 const old={pid:1,port:0,socket:'/socket',version:'old',root:'/root',startedAt:'2026-11-04T00:00:00Z',uptimeMs:0,sessions:[]};
 assert.doesNotMatch(await describe(old),/snapshot leftovers/);
 assert.match(await describe({...old,hostSnapshotLeftovers:null}),/snapshot leftovers: pending/);
 const shown=await describe({...old,hostSnapshotLeftovers:[{path:'/snapshot',cause:'Git lock index.lock'}]});
 assert.match(shown,/snapshot leftovers: 1/);assert.match(shown,/\/snapshot · Git lock index.lock/);
});

test('reusable optional flush contract waits for the exact operation and covers local absence',async()=>{
 const {optionalFlushHostContract}=await import('./host-contract.ts');
 const {localHost}=await import('../src/host/local.ts');await optionalFlushHostContract(localHost());
 const entered=Promise.withResolvers<[string,string]>(),settled=Promise.withResolvers<void>();
 const operation=optionalFlushHostContract({flushBranch:async(path,branch)=>{entered.resolve([path,branch]);await settled.promise;}},{path:'/owned/task',branch:'t/task'});
 assert.deepEqual(await entered.promise,['/owned/task','t/task']);settled.resolve();await operation;
});
test('reusable optional flush contract names capability absence before sending any flush request',async()=>{
 const {optionalFlushHostContract}=await import('./host-contract.ts');
 const {sshHost}=await import('../src/host/ssh-host.ts');const {EventEmitter}=await import('node:events');
 const {PREPARED_HOST_CAPABILITY}=await import('../src/host/agent/protocol.ts');
 const calls:string[]=[];
 const client=Object.assign(new EventEmitter(),{hello:{protocol:1,version:'old',pid:1,bootId:'old',capabilities:[PREPARED_HOST_CAPABILITY]},request:async(op:string)=>{calls.push(op);return [];},close:async()=>{client.emit('closed');}});
 const host=sshHost({name:'fake',transport:{status:()=>({state:'up'}) as ReturnType<import('../src/transport/ssh.ts').SshTransport['status']>,forward:async()=>{throw new Error('unused');},unforward:async()=>{}},connect:async()=>client as unknown as import('../src/host/agent-client.ts').AgentClient,layout:{node:'node',cli:'/cli',spoke:'/spoke',runDirectory:'/run',logDirectory:'/logs',discoveryFile:'/discovery'}});
 try{await optionalFlushHostContract(host,{path:'/owned/task',branch:'t/task',refusal:/ref-flush-v1 capability unavailable/});assert.deepEqual(calls,['processes','native-receipts']);}
 finally{await host.close();}
});

test('reusable optional flush contract drives SSH drain before the matching watch receipt',async()=>{
 const {optionalFlushHostContract}=await import('./host-contract.ts');const {sshHost}=await import('../src/host/ssh-host.ts');const {EventEmitter}=await import('node:events');
 const {PREPARED_HOST_CAPABILITY}=await import('../src/host/agent/protocol.ts');
 const {REF_FLUSH_CAPABILITY,REF_WATCH_STATUS_CAPABILITY}=await import('../src/host/agent/watch.ts');
 const entered=Promise.withResolvers<unknown>(),drained=Promise.withResolvers<void>();const calls:string[]=[];let complete=false;
 const client=Object.assign(new EventEmitter(),{hello:{protocol:1,version:'current',pid:1,bootId:'current',capabilities:[PREPARED_HOST_CAPABILITY,REF_FLUSH_CAPABILITY,REF_WATCH_STATUS_CAPABILITY]},request:async(op:string,args:unknown)=>{
  calls.push(op);if(op==='flush'){entered.resolve(args);await drained.promise;complete=true;return null;}
  if(op==='watch-status')return complete?[{path:'/owned/task',branch:'t/task',state:'watching'}]:[];
  return [];
 },close:async()=>{client.emit('closed');}});
 const host=sshHost({name:'fake',transport:{status:()=>({state:'up'}) as ReturnType<import('../src/transport/ssh.ts').SshTransport['status']>,forward:async()=>{throw new Error('unused');},unforward:async()=>{}},connect:async()=>client as unknown as import('../src/host/agent-client.ts').AgentClient,layout:{node:'node',cli:'/cli',spoke:'/spoke',runDirectory:'/run',logDirectory:'/logs',discoveryFile:'/discovery'}});
 try{
  const operation=optionalFlushHostContract(host,{path:'/owned/task',branch:'t/task'});
  assert.deepEqual(await entered.promise,{path:'/owned/task'});drained.resolve();await operation;
  assert.deepEqual(calls,['processes','native-receipts','flush','watch-status']);assert.equal(complete,true);
 }finally{drained.resolve();await host.close();}
});
