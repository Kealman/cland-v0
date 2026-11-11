import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import type { ChildProcess } from 'node:child_process';
import type { AgentProcesses } from './processes.ts';
import { checkpoint } from './storage.ts';
import { loginFilePath } from './fake-login-mount.ts';
import { signInCommand } from './signin-command.ts';
import { SignInRedactor } from './signin-redactor.ts';
import { SIGNIN_OUTPUT_BYTES, SIGNIN_CHUNK_BYTES, SIGNIN_RECEIPT_CACHE, signInNotAdmitted, parseSignInClose, type SignInInput, type SignInClose } from './signin-types.ts';
const incomplete=()=>Object.assign(new Error('sign-in native close incomplete'),{code:'CLAND_NATIVE_INCOMPLETE'});
/** One instance per authenticated peer; no PID or serialized flag grants ownership. */
export function signIns(runDir:string,env:NodeJS.ProcessEnv,processes:AgentProcesses,enter:()=>((()=>void)&{incomplete?:()=>void}),emit:(frame:unknown)=>void){
 const runs=new Map<string,ReturnType<typeof createRun>>();
 const receipts=new Map<string,SignInClose>();
 let closing=false;
 function createRun(admission:string,release:(()=>void)&{incomplete?:()=>void}){
  const done=Promise.withResolvers<SignInClose>();void done.promise.catch(()=>{});
  const ready=Promise.withResolvers<{pid:number;identity:string}>();void ready.promise.catch(()=>{});
  let child:ChildProcess|undefined,exit:{code:number|null;signal:string|null}|undefined,bytes=0,sent=0,limited=false,settled=false;
  let finishing:Promise<void>|undefined,stopping:Promise<void>|undefined;
  let nativeAdmitted=false,accepted=false,failed=false,nativeEnded=false;
  const failure=()=>{if(failed)return;failed=true;release.incomplete?.();emit({event:'signin-incomplete',admission});ready.reject(incomplete());done.reject(incomplete());};
  const streams={stdout:{decoder:new StringDecoder('utf8'),redactor:new SignInRedactor()},stderr:{decoder:new StringDecoder('utf8'),redactor:new SignInRedactor()}};
  const output=(stream:'stdout'|'stderr',text:string)=>{
   if(sent+Buffer.byteLength(text)>SIGNIN_OUTPUT_BYTES){limited=true;void cancel();return;}sent+=Buffer.byteLength(text);
   let chunk='',size=0;
   for(const char of text){const n=Buffer.byteLength(char);if(size+n>SIGNIN_CHUNK_BYTES){emit({event:'signin-output',admission,stream,text:chunk});chunk='';size=0;}chunk+=char;size+=n;}
   if(chunk)emit({event:'signin-output',admission,stream,text:chunk});
  };
  const finish=()=>finishing??=(async()=>{
   if(failed||!accepted||!exit)throw incomplete();
   for(const stream of ['stdout','stderr'] as const){const s=streams[stream];output(stream,s.redactor.push(s.decoder.end())+s.redactor.finish());}
   const receipt=parseSignInClose({admission,state:'closed',...exit,...(limited?{outcome:'output-limit' as const}:{})},admission);
   await mkdir(join(runDir,'signins'),{recursive:true,mode:0o700});
   await checkpoint(join(runDir,'signins',admission+'.json'),receipt);
   settled=true;release();runs.delete(admission);receipts.set(admission,receipt);
   if(receipts.size>SIGNIN_RECEIPT_CACHE)receipts.delete(receipts.keys().next().value!);
   child=undefined;
   emit({event:'signin-close',admission,receipt});done.resolve(receipt);
  })().catch(failure);
  const cancel=()=>stopping??=(async()=>{
   if(failed)throw incomplete();
   const process=await ready.promise;
   if(settled)return;
   if(finishing){await finishing;return;}
   if(!await processes.stop(process)){if(finishing){await finishing;return;}throw incomplete();}
   // stop joins the same native completion owner; the exact code is already captured.
   await finish();
  })().catch(failure);
  return {closed:done.promise,admitted(){nativeAdmitted=true;},isAdmitted:()=>nativeAdmitted,accept(process:{pid:number;identity:string}){accepted=true;ready.resolve(process);if(exit&&!failed)void(nativeEnded?finish():cancel());},failed:failure,connected(value:ChildProcess){
   child=value;child.stdin?.on('error',()=>{});
   for(const stream of ['stdout','stderr'] as const)child[stream]?.on('data',(chunk:Buffer)=>{
    if(limited)return;bytes+=chunk.length;
    if(bytes>SIGNIN_OUTPUT_BYTES){limited=true;void cancel();return;}
    const s=streams[stream];output(stream,s.redactor.push(s.decoder.write(chunk)));
   });
  },nativeClosed(value:{code:number|null;signal:string|null;ended:boolean}){exit={code:value.code,signal:value.signal};nativeEnded=value.ended;if(accepted&&!failed)void(value.ended?finish():cancel());},
  async write(text:unknown){
   if(failed||settled||!child?.stdin||typeof text!=='string'||text.includes('\0'))throw new Error('sign-in input refused');
   for(const s of Object.values(streams))s.redactor.register(text);
   await new Promise<void>((resolve,reject)=>child!.stdin!.write(text,error=>error?reject(new Error('sign-in input failed')):resolve()));
  },cancel};
 }
 const get=(args:Record<string,unknown>)=>{const r=runs.get(String(args.admission));if(!r)throw new Error('sign-in admission not owned');return r;};
 return {async start(args:Record<string,unknown>){
  let admission:string,plan:ReturnType<typeof signInCommand>,release:(()=>void)&{incomplete?:()=>void};
  try{
   if(closing)throw new Error('sign-in owner closing');
   if(typeof args.admission!=='string'||! /^[a-f0-9-]{36}$/.test(args.admission)||runs.has(args.admission)||receipts.has(args.admission))throw new Error('invalid sign-in admission');
   if(runs.size>=SIGNIN_RECEIPT_CACHE)throw new Error('sign-in active capacity reached');
   admission=args.admission;plan=signInCommand(args as SignInInput);release=enter();
  }catch{throw signInNotAdmitted('CLAND_SIGNIN_REFUSED','sign-in validation or writer admission refused');}
  const run=createRun(admission,release);runs.set(admission,run);
  try{
   const cwd=await loginFilePath(String(args.path),env);
   const process=await processes.spawn({command:plan.command,args:plan.args,cwd,env:{...env,[plan.key]:plan.value}},undefined,{launchId:admission,accepted:async()=>{}},{admitted:run.admitted,connected:run.connected,closed:run.nativeClosed,failed:run.failed});
   run.accept(process);return {admission};
  }catch{
   if(run.isAdmitted()){run.failed();throw incomplete();}
   // No native process was observed. Reject local promises without poisoning disk admission.
   runs.delete(admission);release();throw signInNotAdmitted('CLAND_SIGNIN_SPAWN_REFUSED','sign-in refused before native admission');
  }
 },async write(args:Record<string,unknown>){await get(args).write(args.text);return null;},async cancel(args:Record<string,unknown>){const receipt=receipts.get(String(args.admission));if(receipt)return receipt;const r=get(args);await r.cancel();return r.closed;},retained(){return {active:runs.size,receipts:receipts.size};},async close(){
  closing=true;
  const outcomes=await Promise.allSettled([...runs.values()].map(async r=>{await r.cancel();await r.closed;}));
  const failures=outcomes.filter((outcome):outcome is PromiseRejectedResult=>outcome.status==='rejected').map(outcome=>outcome.reason);
  if(failures.length)throw Object.assign(new AggregateError(failures,'sign-in shutdown incomplete'),{code:'CLAND_NATIVE_INCOMPLETE'});
 }};
}
