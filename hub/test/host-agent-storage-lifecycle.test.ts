// T3: real agent listener/readiness needs native self-birth observation.
// Lifecycle: release held recovery, join client/server close, then remove scratch storage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serveAgent } from '../src/host/agent/server.ts';
import { AgentClient } from '../src/host/agent-client.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { testSetupWaitMs } from './until.ts';

test('agent readiness precedes retained recovery and close joins its suspended directory', {timeout:testSetupWaitMs()}, async t=>{
  const root=await mkdtemp(join(tmpdir(),'agent-recovery-'));
  const entered=Promise.withResolvers<void>(),release=Promise.withResolvers<void>();
  let server:Awaited<ReturnType<typeof serveAgent>>|undefined,client:AgentClient|undefined,closed=false,reads=0;
  t.after(async()=>{release.resolve();await client?.close();await server?.close();await rm(root,{recursive:true,force:true});});
  await writeFile(join(root,'boot'),'11111111-1111-1111-1111-111111111111');
  const env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOSTS:'1',CLAND_HOST_BOOT_ID_FILE:join(root,'boot')});
  server=await serveAgent({runDir:root,secret:'synthetic',version:'test',env,checkpointRecoveryIO:{
    async *entries(){try{for(let i=0;i<10000;i++){reads++;yield {name:`retained-${i}.json`,directory:false};}}finally{closed=true;}},
    async unlink(){assert.fail('retained data must survive');},
    async pause(){if(reads===32){entered.resolve();await release.promise;}},
  }});
  await entered.promise;
  client=await AgentClient.connect(server.socket,'synthetic');
  assert.equal(client.hello.version,'test','authenticated readiness survives held recovery');
  assert.equal(reads,32);
  await client.close();client=undefined;
  const closing=server.close();
  try{assert.equal((await stat(root)).isDirectory(),true);assert.equal(closed,false);}
  finally{release.resolve();await closing;}
  assert.equal(closed,true,'close observes directory iterator completion');
  assert.equal(reads,32,'shutdown admits no next retained entry');
});
