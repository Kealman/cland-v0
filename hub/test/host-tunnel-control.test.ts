// T2: foreign-machine ownership is rejected at the test control socket boundary; no processes.
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { once } from 'node:events';
import { mkdir, writeFile, symlink, realpath, access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tempProject } from './harness.ts';
import { onCleanup } from './process-cleanup.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { FakeHostProvider } from '../src/host/provider/fake.ts';
import { Store } from '../src/hub/store.ts';
import { hostDirectory } from '../../shared/fake-host-directory.ts';
import { createFakeHost } from '../../shared/fake-host-machine.ts';
import { fixtureSocketPath } from '../../shared/fixture-sockets.ts';
import { hostOwner } from './fakes/fake-ssh-common.ts';
import { tunnelControl } from './fakes/host-tunnel-control.ts';
for(const scenario of ['foreign-directory','foreign-project','foreign-pool','marker-alias'] as const)test(`tunnel control refuses ${scenario} before contacting its master`,async t=>{
 const root=await tempProject(t,'tc-'),foreign=await tempProject(t,'tf-');
 const env=fixtureEnvironment(root,{}, {CLAND_FAKE_HOST_ROOT:root});
 const p=new FakeHostProvider({env:fixtureEnvironment(foreign,{}, {CLAND_FAKE_HOST_ROOT:foreign})});
 const result=await p.acquire({project:foreign,pool:'agents',architecture:'arm64'});assert.equal(result.state,'created');if(result.state!=='created')return;
 const machine=result.machine,foreignDirectory=hostDirectory(foreign,machine.address),directory=hostDirectory(root,machine.address);
 if(scenario==='foreign-directory')await symlink(await realpath(foreignDirectory),directory);
 else{
  await createFakeHost(root,machine.address);
  await writeFile(join(directory,'provider.json'),JSON.stringify({machine,project:scenario==='foreign-project'?foreign:root,pool:scenario==='foreign-pool'?'other':'agents',readyAt:0,neverBoot:false}));
 }
 const owner=await hostOwner(directory),control=fixtureSocketPath(foreign,'foreign-master');
 let contacts=0;
 const server=net.createServer({allowHalfOpen:true},socket=>{socket.on('data',()=>{contacts++;});socket.on('end',()=>socket.end('ok\n'));});
 onCleanup(t,()=>new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve())));
 server.listen(control);await once(server,'listening');
 await writeFile(join(directory,'master-control'),JSON.stringify({owner,control,token:'fake-control-token'}));
 await mkdir(join(root,'.cland'),{recursive:true});
 await writeFile(join(root,'.cland/config.toml'),'[hosts.agents]\nprovider="fake"\nsize="fake"\nslots=8\n');
 const store=new Store(join(root,'.cland/hub.db'));
 store.hosts.provisions.save({id:'owned-row',provider:'fake',pool:'agents',size:'fake',region:'fake-1',created:machine.created,state:'connecting',machine});store.close();
 if(scenario==='marker-alias'){await writeFile(join(foreign,'victim'),'preserved');await symlink(join(foreign,'victim'),join(directory,'tunnel-down'));}
 await assert.rejects(tunnelControl(root,'owned-row','down',env),scenario==='marker-alias'?/EEXIST/:/owned storage|project or pool/);
 assert.equal(contacts,0,'foreign master received no request');
 if(scenario==='marker-alias')assert.equal(await readFile(join(foreign,'victim'),'utf8'),'preserved');
 else await assert.rejects(access(join(directory,'tunnel-down')),{code:'ENOENT'});
});
