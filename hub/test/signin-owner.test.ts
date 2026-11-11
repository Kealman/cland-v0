// T1: operation ownership with an in-memory native adapter; no processes or sockets.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { signIns } from '../src/host/agent/signin.ts';
import type { AgentProcesses } from '../src/host/agent/processes.ts';
type IO=NonNullable<Parameters<AgentProcesses['spawn']>[3]>;
async function fixture(t:TestContext,admitNative:(io:IO)=>Promise<{pid:number;identity:string}>){
 const root=await mkdtemp(join(tmpdir(),'signin-owner-'));t.after(()=>rm(root,{recursive:true,force:true}));
 let holds=0;const events:unknown[]=[];
 const native={spawn:async(_args:unknown,_log:unknown,_admission:unknown,io:IO)=>admitNative(io),stop:async()=>false} as unknown as AgentProcesses;
 const owner=signIns(root,{},native,()=>{holds++;return()=>{holds--;};},event=>events.push(event));
 return {owner,events,holds:()=>holds};
}
test('uncertain rejection after native admission retains the operation and disk hold',async t=>{
 const f=await fixture(t,async io=>{io.admitted();throw new Error('post-spawn fault');});
 await assert.rejects(f.owner.start({admission:randomUUID(),harness:'codex',path:'/cland/auth/codex-work'}),{code:'CLAND_NATIVE_INCOMPLETE'});
 assert.equal(f.holds(),1);assert.equal(f.owner.retained().active,1);
 await assert.rejects(f.owner.close(),{code:'CLAND_NATIVE_INCOMPLETE'});
});
test('native completion failure reaches the peer and retains writer admission',async t=>{
 let captured:IO|undefined;
 const f=await fixture(t,async io=>{captured=io;io.admitted();return {pid:123,identity:'fresh'};});
 const admission=randomUUID();await f.owner.start({admission,harness:'codex',path:'/cland/auth/codex-work'});
 captured!.failed(new Error('native publication fault'));
 assert.deepEqual(f.events,[{event:'signin-incomplete',admission}]);assert.equal(f.holds(),1);
 await assert.rejects(f.owner.close(),{code:'CLAND_NATIVE_INCOMPLETE'});
});
test('settled native objects retire and only a bounded receipt cache remains',async t=>{
 let captured:IO|undefined;
 const f=await fixture(t,async io=>{captured=io;io.admitted();return {pid:123,identity:'fresh'};});
 for(let i=0;i<40;i++){
  const admission=randomUUID();await f.owner.start({admission,harness:'codex',path:'/cland/auth/codex-work'});
  captured!.closed({code:0,signal:null,ended:true});
  const receipt=await f.owner.cancel({admission});assert.equal(receipt.admission,admission);
  assert.equal(f.owner.retained().active,0);assert.ok(f.owner.retained().receipts<=32);assert.equal(f.holds(),0);
 }
 await f.owner.close();
});
test('peer shutdown joins another run receipt checkpoint after one run fails',async t=>{
 const admitted:IO[]=[];
 const f=await fixture(t,async io=>{admitted.push(io);io.admitted();return {pid:admitted.length,identity:'fresh'};});
 const failed=randomUUID(),closing=randomUUID();
 await f.owner.start({admission:failed,harness:'codex',path:'/cland/auth/codex-work'});
 await f.owner.start({admission:closing,harness:'codex',path:'/cland/auth/codex-work'});
 admitted[0]!.failed(new Error('one run is incomplete'));
 admitted[1]!.closed({code:0,signal:null,ended:true});
 try{
  await assert.rejects(f.owner.close(),{code:'CLAND_NATIVE_INCOMPLETE'});
  assert.ok(f.events.some(event=>(event as {event:string;admission:string}).event==='signin-close'&&(event as {admission:string}).admission===closing),'shutdown joins every started receipt checkpoint before reporting failure');
  assert.equal(f.owner.retained().active,1);assert.equal(f.holds(),1);
 }finally{
  // Independent of the shutdown under test: never remove a root with a receipt writer.
  await f.owner.cancel({admission:closing});
 }
});
