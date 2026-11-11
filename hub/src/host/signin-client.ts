import { randomUUID } from 'node:crypto';
import type { AgentClient } from './agent-client.ts';
import { SIGNIN_CAPABILITY, SIGNIN_CHUNK_BYTES, SIGNIN_OUTPUT_BYTES, signInNotAdmitted, parseSignInClose, type SignInInput, type SignInOutput, type SignInClose, type SignInRun } from './agent/signin-types.ts';
const incomplete=()=>Object.assign(new Error('sign-in native close incomplete'),{code:'CLAND_NATIVE_INCOMPLETE'});
/** Captured connection and admission never migrate to a reconnect. */
export async function startSignIn(client:AgentClient,input:SignInInput,onOutput:(output:SignInOutput)=>void):Promise<SignInRun>{
 if(!client.hello.capabilities?.includes(SIGNIN_CAPABILITY))throw signInNotAdmitted('CLAND_SIGNIN_UNAVAILABLE','agent signin-v1 capability unavailable');
 const admission=randomUUID(),done=Promise.withResolvers<SignInClose>();
 let bytes=0,settled=false;
 void done.promise.catch(()=>{});
 const cleanup=()=>{client.off('event',event);client.off('closed',lost);};
 const fail=()=>{if(!settled){settled=true;cleanup();done.reject(incomplete());}};
 const lost=()=>fail();
 const event=(frame:Record<string,unknown>)=>{
  if(frame.admission!==admission)return;
  if(frame.event==='signin-output'){
   if(typeof frame.text!=='string'||!['stdout','stderr'].includes(String(frame.stream)))return fail();
   const length=Buffer.byteLength(frame.text);bytes+=length;
   if(length>SIGNIN_CHUNK_BYTES||bytes>SIGNIN_OUTPUT_BYTES)return fail();
   try{onOutput({admission,stream:frame.stream as 'stdout'|'stderr',text:frame.text});}catch{fail();}
  }else if(frame.event==='signin-incomplete'){fail();
  }else if(frame.event==='signin-close'){
   let r:SignInClose;try{r=parseSignInClose(frame.receipt,admission);}catch{return fail();}
   settled=true;cleanup();done.resolve(r);
  }
 };
 client.on('event',event);client.once('closed',lost);
 try{const result=await client.request('signin-start',{...input,admission}) as {admission:string};if(result?.admission!==admission)throw incomplete();}
 catch(error){fail();if((error as {nativeAdmission?:unknown})?.nativeAdmission==='not-admitted')throw error;throw incomplete();}
 return {admission,closed:done.promise,async write(text){if(settled)throw new Error('sign-in closed');await client.request('signin-write',{admission,text});},async cancel(){if(!settled){try{await client.request('signin-cancel',{admission});}catch{fail();}}return done.promise;}};
}
