// T3: hook CLI stdin completion and native exit, alongside status/doctor Unix socket frames.
// Lifecycle: own the hook subprocess, close stdin, join native exit before deleting its scratch root.
import { execFile } from 'node:child_process';
import { fixtureEnvironment } from './fixture-environment.ts';
import { ownProcess } from './process-cleanup.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tempProject, clandWithEnv } from './harness.ts';
import { fixtureSocketPath } from '../../test-support/socket-path.ts';

test('C3 status, doctor and hook reach remote CLAND_HUB_FILE socket without a local pid', async t=>{
 const root=await tempProject(t);
 const socket=fixtureSocketPath(root,'remote-cli');
 assert.ok(Buffer.byteLength(socket)+1<=104);
 const frames:Record<string,unknown>[]=[];
 const sockets=new Set<import('node:net').Socket>();
 const server=createServer(peer=>{
  sockets.add(peer);peer.on('close',()=>sockets.delete(peer));
  let pending='';peer.on('data',chunk=>{pending+=chunk;let end;while((end=pending.indexOf('\n'))>=0){const frame=JSON.parse(pending.slice(0,end));pending=pending.slice(end+1);frames.push(frame);
   peer.write(JSON.stringify(frame.type==='hello'?{type:'welcome',protocol:2}:{type:'result',id:frame.id,ok:false,error:'synthetic remote request observed'})+'\n');
  }});
 });
 await new Promise<void>(r=>server.listen(socket,r));
 t.after(async()=>{for(const peer of sockets)peer.destroy();await new Promise<void>(r=>server.close(()=>r()));});
 await mkdir(join(root,'.cland'),{recursive:true});
 const file=join(root,'remote.json');
 await writeFile(file,JSON.stringify({remote:true,socket,spoke:`ws+unix:${socket}:/`,secret:'synthetic-host',version:'test'}));
 for(const args of [['hub','status'],['doctor'],['hook','idle','--session','worker']]) {
  frames.length=0;
  const result=args[0]!=='hook' ? await clandWithEnv(root,{CLAND_HUB_FILE:file},...args) : await new Promise((resolve,reject)=>{
   const child=execFile(process.execPath,[new URL('../bin/cland.ts',import.meta.url).pathname,...args],{cwd:root,env:fixtureEnvironment(root,process.env,{CLAND_HUB_FILE:file}),timeout:3000},(error,stdout,stderr)=>error?reject(error):resolve({stdout,stderr}));
   ownProcess(t,child.pid);child.stdin!.end('{}');
  });
  assert.ok(frames.some(f=>f.type==='hello'),JSON.stringify({args,result,frames}));
  const expected=args[0]==='hub'?'hub.status':args[0]==='doctor'?'hub.status':'session.signal';
  assert.ok(frames.some(f=>f.type===expected),JSON.stringify({args,result,frames}));
 }
});
