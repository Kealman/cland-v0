import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readDiscovery } from '../../shared/project-discovery.ts';

test('C1 remote discovery accepts socket credentials without a local pid or port; preserves old local shape', t => {
  const root = mkdtempSync(join(tmpdir(), 'discovery-'));
  t.after(() => rmSync(root, {recursive:true,force:true}));
  const file = join(root, 'discovery.json');
  const local = {socket:'/tmp/hub.sock',port:1234,secret:'local',pid:42,version:'old'};
  const remote = {socket:'/tmp/hub.sock',spoke:'ws+unix:/tmp/spoke.sock:/',secret:'host',version:'test',remote:true};
  for (const value of [local, remote]) {
    writeFileSync(file,JSON.stringify(value));
    assert.deepEqual(readDiscovery(file),value);
  }
  for (const value of [{...remote,spoke:undefined},{...remote,spoke:'ws://localhost:1234'},{...remote,secret:undefined},{...remote,socket:3},{...remote,root:'relative'},{...local,pid:undefined},{...local,remote:'true'}]) {
    writeFileSync(file,JSON.stringify(value)); assert.equal(readDiscovery(file),null);
  }
});

import { publishRemoteDiscovery, remoteDiscovery } from '../src/host/discovery.ts';
test('different discovery refuses before a failing overwrite; identical bytes skip the writer',async()=>{
 const candidate=remoteDiscovery('/tmp/host-run','synthetic-host');
 const prior=Buffer.from(JSON.stringify({...candidate,secret:'synthetic-old-host'}));
 let writes=0;
 const client={request:async(op:string)=>{if(op==='readFile')return prior.toString('base64');writes++;throw new Error('synthetic failed overwrite');}};
 await assert.rejects(publishRemoteDiscovery(client,'/unused',candidate),/discovery differs/);
 assert.equal(writes,0);assert.equal(JSON.parse(prior.toString()).secret,'synthetic-old-host');
 const same=Buffer.from(JSON.stringify(candidate,null,2)+'\n');
 await publishRemoteDiscovery({request:async(op:string)=>{assert.equal(op,'readFile');return same.toString('base64');}},'/unused',candidate);
 assert.equal(writes,0);
});
