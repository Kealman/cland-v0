// T3: a real CLI owns a fake SSH child across socket loss and SIGTERM.
// Every native child and socket joins before the disposable root is removed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type Socket } from 'node:net';
import { spawn } from 'node:child_process';
import { fixtureEnvironment } from './fixture-environment.ts';
import { loginFixtureOwners, loginChild } from './login-fixture-owners.ts';
import { until, testWaitMs, waitTimeoutMs } from './until.ts';
import { processIdentityAsync } from '../src/process-identity.ts';

function nativeExited(pid:number):boolean{try{process.kill(pid,0);return false;}catch(error){return (error as NodeJS.ErrnoException).code==='ESRCH';}}

const SETUP_MS=waitTimeoutMs(testWaitMs()+3000); // readiness observation plus native identity probe
const JOIN_MS=waitTimeoutMs(testWaitMs()); // loginChild's native close receipt
const NATIVE_EXIT_MS=2000;
const CLEANUP_MS=waitTimeoutMs(testWaitMs()+5000); // owned native cleanup plus its close observation
const PHASE_ENVELOPE_MS=SETUP_MS+JOIN_MS+NATIVE_EXIT_MS+CLEANUP_MS;

for(const interruption of ['hub disconnect','CLI cancellation'] as const)test(`terminal sign-in joins native SSH after ${interruption}`,{timeout:PHASE_ENVELOPE_MS},async t=>{
 const owners=loginFixtureOwners(t),root=await mkdtemp(join(tmpdir(),'login-term-'));owners.directory(root);
 const bin=join(root,'bin'),ready=join(root,'ssh-ready');await mkdir(bin);await mkdir(join(root,'.cland'));
 await writeFile(join(bin,'ssh'),`#!${process.execPath}\nimport{writeFileSync,openSync,closeSync}from'node:fs';const fd=openSync(${JSON.stringify(join(root,'held-file'))},'w');process.on('SIGTERM',()=>{closeSync(fd);process.exit(0);});writeFileSync(${JSON.stringify(ready)},JSON.stringify({pid:process.pid,parent:process.ppid}));setInterval(()=>{},1000);\n`,{mode:0o700});
 const env=fixtureEnvironment(root,process.env,{PATH:bin+':/usr/bin:/bin'});
 const sockets=new Set<Socket>();
 let terminalPid=0,reported:{code:unknown;ended:boolean}|undefined;
 const server=createServer(socket=>{
  sockets.add(socket);socket.on('error',()=>{});socket.once('close',()=>sockets.delete(socket));let buffer='';
  socket.on('data',bytes=>{buffer+=String(bytes);let nl:number;while((nl=buffer.indexOf('\n'))>=0){const frame=JSON.parse(buffer.slice(0,nl));buffer=buffer.slice(nl+1);
   if(frame.type==='hello')socket.write(JSON.stringify({type:'welcome',protocol:2})+'\n');
   else if(frame.type==='login.add')socket.write(JSON.stringify({type:'result',id:frame.id,ok:true,value:{name:'work',host:'fake',command:'ssh',args:['-t','fake','fake sign-in']}})+'\n');
   else if(frame.type==='login.signed-in'){reported={code:frame.code,ended:nativeExited(terminalPid)};socket.write(JSON.stringify({type:'result',id:frame.id,ok:true,value:{state:'signed-out'}})+'\n');}
  }});
 });
 owners.defer(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
 owners.defer(async()=>{await Promise.all([...sockets].map(socket=>new Promise<void>(resolve=>{socket.once('close',()=>resolve());socket.destroy();})));});
 const socket=join(root,'hub.sock');await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(socket,resolve);});
 await writeFile(join(root,'.cland/hub.json'),JSON.stringify({root,socket,secret:'synthetic',port:0,pid:process.pid,version:'test'}));
 // cland-allow-child-env: fixtureEnvironment above seals HOME, account and Git state with the scratch SSH PATH as an explicit final overlay; nothing is added after the builder.
 const child=spawn(process.execPath,[new URL('../bin/cland.ts',import.meta.url).pathname,'login','add','codex'],{cwd:root,env,detached:true});
 const joined=loginChild(owners,child);let diagnostics='';child.stderr.on('data',bytes=>{diagnostics+=String(bytes);});child.stdout.resume();child.stdin.end();
 await until(async()=>{const receipt=JSON.parse(await readFile(ready,'utf8'));terminalPid=receipt.pid;assert.equal(receipt.parent,child.pid);return terminalPid>1;},{what:'observed SSH launch receipt'});
 assert.ok(await processIdentityAsync(terminalPid,env),'captured native birth before interruption');
 if(interruption==='hub disconnect')for(const socket of sockets)socket.destroy();else child.kill('SIGTERM');
 assert.equal(await joined(),1,diagnostics);
 await until(()=>nativeExited(terminalPid),{what:'native SSH exit receipt',timeoutMs:NATIVE_EXIT_MS,loadFactor:1});
 assert.equal(nativeExited(terminalPid),true);
 if(interruption==='CLI cancellation')assert.deepEqual(reported,{code:null,ended:true},'completion follows native exit');
});
