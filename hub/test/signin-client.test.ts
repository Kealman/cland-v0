// T1: admission-bound event validation and connection loss with an in-memory transport.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { startSignIn } from '../src/host/signin-client.ts';
import type { AgentClient } from '../src/host/agent-client.ts';
function client(){
 const emitter=new EventEmitter();
 return Object.assign(emitter,{hello:{capabilities:['signin-v1']},async request(_op:string,args:Record<string,unknown>){return {admission:args.admission};}}) as unknown as AgentClient;
}
test('a close receipt for another admission is refused and never settles this run',async()=>{
 const c=client(),run=await startSignIn(c,{harness:'codex',path:'/cland/auth/codex-work'},()=>{});
 c.emit('event',{event:'signin-close',admission:run.admission,receipt:{admission:'another',state:'closed',code:0,signal:null}});
 await assert.rejects(run.closed,{code:'CLAND_NATIVE_INCOMPLETE'});
});
test('connection loss after admission has no native close receipt',async()=>{
 const c=client(),run=await startSignIn(c,{harness:'codex',path:'/cland/auth/codex-work'},()=>{});
 c.emit('closed');
 await assert.rejects(run.closed,{code:'CLAND_NATIVE_INCOMPLETE'});
});
for(const exit of [{code:null,signal:null},{code:null,signal:''},{code:undefined,signal:'SIGTERM'}])test(`malformed close ${JSON.stringify(exit)} stays incomplete`,async()=>{
 const c=client(),run=await startSignIn(c,{harness:'codex',path:'/cland/auth/codex-work'},()=>{});
 c.emit('event',{event:'signin-close',admission:run.admission,receipt:{admission:run.admission,state:'closed',...exit}});
 await assert.rejects(run.closed,{code:'CLAND_NATIVE_INCOMPLETE'});
});
test('missing capability is positively not admitted without a native request',async()=>{
 const c=client();c.hello.capabilities=[];let requests=0;c.request=async()=>{requests++;throw new Error('must not request');};
 await assert.rejects(startSignIn(c,{harness:'codex',path:'/cland/auth/codex-work'},()=>{}),{nativeAdmission:'not-admitted',code:'CLAND_SIGNIN_UNAVAILABLE'});
 assert.equal(requests,0);
});
