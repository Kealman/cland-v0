// T2: original agent hello compatibility over an in-process Unix socket; no child processes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentClient } from '../src/host/agent-client.ts';
test('new client accepts original protocol-1 hello without capabilities',async()=>{
 const root=await mkdtemp(join(tmpdir(),'agent-client-'));
 const original={protocol:1,version:'previous',pid:123,bootId:'original'};
 const server=createServer(socket=>socket.once('data',bytes=>{const request=JSON.parse(bytes.toString());socket.write(JSON.stringify({id:request.id,ok:true,result:original})+'\n');}));
 let client:AgentClient|undefined;
 try {
  const path=join(root,'agent.sock');await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(path,resolve);});
  client=await AgentClient.connect(path,'synthetic');assert.deepEqual(client.hello,original);
 } finally {await client?.close();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(root,{recursive:true,force:true});}
});
