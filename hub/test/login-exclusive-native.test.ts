// T3: two native fake harnesses behind agent sockets prove reader turns never reach the writer volume.
import './cover-quiet.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { FakeHostProvider } from '../src/host/provider/fake.ts';
import { hostDirectory } from '../../shared/fake-host-directory.ts';
import { serveAgent } from '../src/host/agent/server.ts';
import { AgentClient } from '../src/host/agent-client.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { loginFixtureOwners } from './login-fixture-owners.ts';
import { Store } from '../src/hub/store.ts';
import { LoginBinder } from '../src/host/login-binding.ts';
import { installLoginRelease } from '../src/host/login-release.ts';
import { destroyHost } from '../src/host/provision-host.ts';
import { sshHost } from '../src/host/ssh-host.ts';
import { testWaitMs } from './until.ts';

test('two hosts rotate separate writer and reader files; stop deletes only the reader volume',async t=>{
 const owners=loginFixtureOwners(t),root=await mkdtemp(join(tmpdir(),'login-exclusive-'));owners.directory(root);
 const env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root});
 const provider=new FakeHostProvider({env}),store=new Store(join(root,'hub.db'));owners.defer(()=>store.close());
 const binder=new LoginBinder(store.hosts.logins);owners.defer(()=>binder.close());
 async function host() {
  const acquired=await provider.acquire({project:root,pool:'agents',architecture:'x86_64',region:'fake-1'});if(acquired.state!=='created')throw Error('fixture acquire');
  const machine=acquired.machine,directory=hostDirectory(root,machine.id);
  const hostEnv=fixtureEnvironment(root,env,{CLAND_FAKE_HOST_ROOT:root,CLAND_FAKE_HOSTS:machine.id,CLAND_HOST_BOOT_ID_FILE:join(directory,'boot-id')});
  const server=await serveAgent({runDir:join(directory,'home/.cland-host/run'),secret:'sentinel',version:'test',env:hostEnv});owners.defer(()=>server.close());
  const client=await AgentClient.connect(server.socket,'sentinel');owners.defer(()=>client.close());
  const host=sshHost({name:machine.id,transport:{status:()=>({state:'up'} as any),forward:async()=>({socket:join(root,'forward')}),unforward:async()=>{}},connect:()=>AgentClient.connect(server.socket,'sentinel'),layout:{runDirectory:root,logDirectory:root,discoveryFile:join(root,'discovery'),node:process.execPath,cli:'unused',spoke:'unused'}});owners.defer(()=>host.close());
  store.hosts.insert({id:machine.id,address:machine.address,user:'agent',clientKeyPath:'unused',knownHosts:'unused'},'sentinel');
  store.hosts.provisions.ready({id:machine.id,pool:'agents',provider:'fake',size:'fake',region:'fake-1',created:machine.created,state:'ready',machine});
  const bind=()=>binder.bind({host,machine,provider:()=>provider,providerName:'fake',region:'fake-1',pool:'agents',project:root,harness:'codex',account:null,validate:()=>{},checkAccount:()=>{}});
  const run=async(args:string[])=>{
   const result=await client.request('run-host',{command:process.execPath,args:[resolve('hub/test/fakes/codex/fake-codex.ts'),...args],cwd:root,env:fixtureEnvironment(root,hostEnv,{CODEX_HOME:'/cland/auth/codex-work',FAKE_LOGIN_ENABLED:'1',FAKE_LOGIN_HOST:machine.id}),timeoutMs:testWaitMs()}) as {code:number;stderr:string};
   assert.equal(result.code,0,result.stderr);
  };
  return {host,machine,bind,run};
 }
 const a=await host(),b=await host();
 const made=await provider.createVolume({project:root,name:'work',region:'fake-1',sizeGiB:1});if(made.state!=='created')throw Error('fixture volume');
 store.hosts.logins.insert({name:'work',exclusive:false,harness:'codex',account:'work',kind:'disk',provider:'fake',region:'fake-1',volumeId:made.volume.id,snapshotIds:[],lastSignIn:null});store.hosts.logins.transition('work','ready');
 installLoginRelease(store.hosts,{host:id=>[a,b].find(h=>h.machine.id===id)?.host,beginRelease:async()=>{},onReleased:()=>{},notice:()=>{}});
 await a.bind();await a.run(['login','--device-auth']);
 const contents=await provider.volumeContents(made.volume,a.machine);if(contents.state!=='ready')throw Error('fixture original contents');
 const snapshot=await provider.snapshotVolume(made.volume);if(snapshot.state!=='snapshotted')throw Error('fixture snapshot');
 store.hosts.logins.updateBackup('work',{pending:false},[snapshot.snapshot.id]);
 await b.bind();await a.run(['exec','writer','--session','a']);await b.run(['exec','reader','--session','b']);
 const binding=store.hosts.logins.bindings('work').find(row=>row.role==='reader')!;
 const destroy=async(h:typeof a)=>destroyHost({root,id:h.machine.id,env,records:store.hosts,provider,owner:{hosts:[a.host,b.host],remove:async()=>({inventoryComplete:true,timedOut:false,leftovers:[]})} as unknown as Parameters<typeof destroyHost>[0]['owner'],log:()=>{}});
 assert.equal((await destroy(a)).state,'destroyed');assert.equal((await destroy(b)).state,'destroyed');
 const login=JSON.parse(await readFile(join(contents.directory,'login.json'),'utf8'));
 assert.deepEqual(login.turns.map((row:{host:string})=>row.host),[a.machine.id]);
 const inventory=await provider.listVolumes({project:root});assert.equal(inventory.state,'listed');
 if(inventory.state==='listed'){assert.equal(inventory.volumes.some(v=>v.id===binding.volumeId),false);assert.equal(inventory.volumes.find(v=>v.id===made.volume.id)?.attachedTo,null);}
 assert.equal(store.hosts.logins.get('work')?.state,'ready');
});
