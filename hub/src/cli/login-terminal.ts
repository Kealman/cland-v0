import { createConnection } from 'node:net';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import type { Discovery } from '../project.ts';
import type { LoginAddInput } from '../host/login-signin.ts';
import { terminalEnvironment } from '../host/attach.ts';
import { sessionOf } from '../../../shared/frame-actor.ts';

/** Keep one authenticated connection through native close and final disk receipt. */
export async function terminalLogin(d: Discovery, input: LoginAddInput | {name:string;signin:true}, env: NodeJS.ProcessEnv, output: { onAdmitted?: (name: string) => void; stdout?: 'inherit' | 'stderr' } = {}): Promise<number> {
 if(sessionOf(env)) throw Error('login add requires the local human CLI');
 const socket=createConnection(d.socket);socket.setEncoding('utf8');
 let buffer='', closed=false,nativeClosed=true,cancellation:Error|undefined;
 let stopTerminal:((reason:Error)=>void)|undefined;
 const cancel=(reason:Error)=>{cancellation??=reason;if(stopTerminal)stopTerminal(cancellation);else socket.destroy();};
 const interrupted=()=>cancel(Error('terminal sign-in cancelled'));
 const removeSignals=()=>{for(const signal of ['SIGINT','SIGTERM','SIGHUP'] as const)process.removeListener(signal,interrupted);};
 for(const signal of ['SIGINT','SIGTERM','SIGHUP'] as const)process.on(signal,interrupted);
 const pending=new Map<string,{resolve:(value:unknown)=>void;reject:(error:Error)=>void}>();
 let welcomeResolve:()=>void=()=>{},welcomeReject:(error:Error)=>void=()=>{};
 const welcome=new Promise<void>((resolve,reject)=>{welcomeResolve=resolve;welcomeReject=reject;});
 const fail=(error:Error)=>{welcomeReject(error);for(const waiter of pending.values())waiter.reject(error);pending.clear();cancel(error);};
 socket.on('connect',()=>socket.write(JSON.stringify({type:'hello',protocol:2,client:'cli',secret:d.secret})+'\n'));
 socket.on('error',fail);
 socket.on('close',()=>{closed=true;fail(Error('hub disconnected during login sign-in'));});
 socket.on('data',chunk=>{
  buffer+=chunk;
  let nl:number;
  while((nl=buffer.indexOf('\n'))>=0) {
   const line=buffer.slice(0,nl);buffer=buffer.slice(nl+1);
   let frame;try{frame=JSON.parse(line);}catch{fail(Error('invalid hub login reply'));socket.destroy();return;}
   if(frame.type==='welcome')welcomeResolve();
   if(frame.type==='error')fail(Error(String(frame.message)));
   if(frame.type==='result') {const waiter=pending.get(frame.id);if(waiter){pending.delete(frame.id);if(frame.ok)waiter.resolve(frame.value);else waiter.reject(Error(frame.error));}}
  }
 });
 const request=(frame:object,timeoutMs=600000)=>new Promise<unknown>((resolve,reject)=>{
  if(closed){reject(Error('hub connection closed'));return;}
  const id=randomUUID(),timer=setTimeout(()=>{pending.delete(id);reject(Error('hub login request timed out'));socket.destroy();},timeoutMs);
  pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});socket.write(JSON.stringify({...frame,id})+'\n');
 });
 const helloTimer=setTimeout(()=>{fail(Error('hub login handshake timed out'));socket.destroy();},30000);
 try {
  await welcome;
  clearTimeout(helloTimer);
  const frame='signin' in input?{type:'login.signin',name:input.name}:{type:'login.add',...input};
  const plan=await request(frame) as {name:string;host:string;command:string;args:string[]};
  if(typeof plan.name!=='string'||!/^[a-z0-9][a-z0-9-]{0,31}$/.test(plan.name)||plan.command!=='ssh'||!Array.isArray(plan.args)||plan.args.some(arg=>typeof arg!=='string'))throw Error('invalid login terminal plan');
  output.onAdmitted?.(plan.name);
  if(cancellation)throw cancellation;
  nativeClosed=false;
  const code=await new Promise<number|null>((resolve,reject)=>{
   let child:ReturnType<typeof spawn>;
   try{child=spawn(plan.command,plan.args,{env:terminalEnvironment(env),stdio:output.stdout==='stderr'?[0,2,2]:'inherit'});}catch(error){nativeClosed=true;reject(error);return;}
   let failure:Error|undefined,stopping=false,incomplete=false;
   let escalation:ReturnType<typeof setTimeout>|undefined,deadline:ReturnType<typeof setTimeout>|undefined;
   stopTerminal=reason=>{
    failure??=reason;if(stopping||nativeClosed)return;stopping=true;
    child.kill('SIGTERM');
    escalation=setTimeout(()=>{if(!nativeClosed)child.kill('SIGKILL');},2000);
    deadline=setTimeout(()=>{incomplete=true;reject(Error(`terminal cleanup incomplete; native exit=${child.exitCode} signal=${child.signalCode}`));},5000);
   };
   child.once('error',error=>{failure=error;});
   child.once('close',code=>{
    nativeClosed=true;clearTimeout(escalation);clearTimeout(deadline);
    if(incomplete){removeSignals();socket.destroy();}
    if(failure)reject(failure);else resolve(code);
   });
  }).catch(async error=>{if(nativeClosed&&!closed)await request({type:'login.signed-in',name:plan.name,code:null});throw error;});
  await request({type:'login.signed-in',name:plan.name,code});
  (output.stdout==='stderr'?process.stderr:process.stdout).write(`${plan.name}\t${code===0?'ready':'signed-out'}\n`);
  return code??1;
 } finally {clearTimeout(helloTimer);if(nativeClosed){removeSignals();socket.destroy();}}
}
