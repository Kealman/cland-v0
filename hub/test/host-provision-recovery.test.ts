// T2: startup reconciliation of persisted lifecycle rows, directory-only provider; no native host.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join,dirname } from 'node:path';
import { mkdir,writeFile,readdir,readFile,rename } from 'node:fs/promises';
import { hostDirectory } from '../../shared/fake-host-directory.ts';
import { restoreProvisionedFakeHosts } from '../src/host/provision-host.ts';
import { projectSshHosts } from '../src/host/registry.ts';
import { HostSecretStore,registerFakeHosts } from '../src/host/records.ts';
import { onCleanup } from './process-cleanup.ts';
import { Store } from '../src/hub/store.ts';
import { FakeHostProvider } from '../src/host/provider/fake.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { tempProject,projectHub,connectUi } from './harness.ts';
for(const state of ['creating','booting','connecting','cloning'] as const)test(`restart retains interrupted ${state} as failed incomplete without replay or release`,async t=>{
 const root=await tempProject(t);await mkdir(join(root,'.cland'),{recursive:true});
 await writeFile(join(root,'.cland/config.toml'),'[hosts.agents]\nprovider="fake"\nsize="fake"\nregion="fake-1"\n');
 const env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root}),provider=new FakeHostProvider({env});
 const acquired=await provider.acquire({project:root,pool:'agents',architecture:'arm64'});assert.equal(acquired.state,'created');if(acquired.state!=='created')return;
 const store=new Store(join(root,'.cland/hub.db'));
 store.hosts.provisions.save({id:'host-interrupted',provider:'fake',pool:'agents',size:'fake',region:'fake-1',state,created:acquired.machine.created,...(state==='creating'?{}:{machine:acquired.machine})});
 store.close();
 const hub=await projectHub(t,root,{CLAND_FAKE_HOST_ROOT:root});
 const ui=await connectUi(t,hub.discovery,'cli');
 const reply=await ui.request({type:'host.list'});assert.equal(reply.ok,true,reply.error);
 const rows=reply.value as Array<{state:string;release:string;reason:string}>;
 assert.equal(rows[0]?.state,'failed');assert.equal(rows[0]?.release,'incomplete');assert.match(rows[0]!.reason,/interrupted/);
 assert.deepEqual((await readdir(dirname(hostDirectory(root,acquired.machine.id)))).filter(name=>name.startsWith('fake-')),[acquired.machine.id],'no acquisition replay');
 assert.equal((await provider.status(acquired.machine)).state,'ready','no release inferred from interrupted checkpoint');
 assert.deepEqual(hub.hostOwner!.hosts,[],'no registration minted from a provision checkpoint');
});

for(const fault of ['changed','unknown','released'] as const)test(`prepopulated membership cannot admit a ${fault} provider identity`,async t=>{
 const root=await tempProject(t),base=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root});
 const provider=new FakeHostProvider({env:base});
 const result=await provider.acquire({project:root,pool:'agents',architecture:'arm64'});assert.equal(result.state,'created');if(result.state!=='created')return;
 const env=fixtureEnvironment(root,base,{CLAND_FAKE_HOST_ROOT:root,CLAND_FAKE_HOSTS:result.machine.address+',legacy-manual'});
 const store=new Store(join(root,'hub.db'));let owner:Awaited<ReturnType<typeof projectSshHosts>>|undefined;
 onCleanup(t,async()=>{await owner?.close();store.close();});
 const fake=hostDirectory(root,result.machine.id);
 new HostSecretStore(root,store.hosts).register({id:'host-rejected',address:result.machine.address,user:'agent',clientKeyPath:join(fake,'client-key'),knownHosts:result.machine.address+' '+await readFile(join(fake,'host-key.pub'),'utf8')});
 const record={id:'host-rejected',provider:'fake',pool:'agents',size:'fake',region:'fake-1',created:result.machine.created,state:'cloning' as const,machine:result.machine};
 store.hosts.provisions.save(record);store.hosts.provisions.ready({...record,state:'ready'});
 if(fault==='changed') {
  const path=join(fake,'provider.json'),native=JSON.parse(await readFile(path,'utf8'));native.machine.created='different native identity';await writeFile(path,JSON.stringify(native));
 } else if(fault==='unknown')await rename(join(fake,'provider.json'),join(fake,'provider-withheld.json'));
 else store.hosts.provisions.save({...record,state:'failed',release:'released'});
 await restoreProvisionedFakeHosts(store.hosts,env);
 const carriers:string[]=[];
 owner=await projectSshHosts({root,records:store.hosts,env,hubSocket:join(root,'hub.sock'),spokeSocket:join(root,'spoke.sock'),log:()=>{},
  createTransport:o=>{carriers.push(o.record.id);return {start:async()=>{},stop:async()=>{},status:()=>({name:o.record.id,state:'up',since:null,lastProbe:null,reconnects:0}),forward:async()=>({socket:'unused'}),unforward:async()=>{}};},
  gitDaemon:async()=>({close:async()=>{}})});
 assert.deepEqual(carriers,[],'rejected identity never constructs a carrier');assert.deepEqual(owner.hosts,[]);
 assert.deepEqual(env.CLAND_FAKE_HOSTS?.split(',').filter(Boolean),['legacy-manual'],'legacy/manual membership is preserved independently');
 assert.equal(store.hosts.get('host-rejected')?.state,'registered','no inferred authority cut');
});

for(const boundary of ['restore','automatic registration'] as const)for(const fault of ['interrupted','failed','released'] as const)test(`no-registration ${fault} machine stays fenced during ${boundary}`,async t=>{
 const root=await tempProject(t),base=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root});
 const provider=new FakeHostProvider({env:base});
 const acquired=await provider.acquire({project:root,pool:'agents',architecture:'arm64'});
 const legacy=await provider.acquire({project:root,pool:'manual',architecture:'arm64'});
 assert.equal(acquired.state,'created');assert.equal(legacy.state,'created');if(acquired.state!=='created'||legacy.state!=='created')return;
 const env=fixtureEnvironment(root,base,{CLAND_FAKE_HOST_ROOT:root,CLAND_FAKE_HOSTS:acquired.machine.address});
 const store=new Store(join(root,'hub.db'));let runtime:Awaited<ReturnType<typeof projectSshHosts>>|undefined;onCleanup(t,async()=>{await runtime?.close();store.close();});
 store.hosts.provisions.save({id:'host-before-registration',provider:'fake',pool:'agents',size:'fake',region:'fake-1',created:acquired.machine.created,machine:acquired.machine,state:fault==='interrupted'?'connecting':'failed',...(fault==='released'?{release:'released' as const}:{})});
 if(fault==='released')assert.equal((await provider.release(acquired.machine)).state,'released');
 assert.equal(store.hosts.get('host-before-registration'),null);
 if(boundary==='restore') {
  store.hosts.provisions.reconcileInterrupted();
  await restoreProvisionedFakeHosts(store.hosts,env);
  assert.deepEqual(env.CLAND_FAKE_HOSTS?.split(',').filter(Boolean),[],'captured machine is removed before automatic registration');
 }
 assert.doesNotThrow(()=>registerFakeHosts(root,store.hosts,env,()=>{}),'released keys are never read');
 assert.equal(store.hosts.get(acquired.machine.address),null,'physical alias is never auto-registered');
 assert.equal(store.hosts.get('host-before-registration'),null,'checkpoint grants no registration');
 const carriers:string[]=[];
 const owner=await projectSshHosts({root,records:store.hosts,env,hubSocket:join(root,'hub.sock'),spokeSocket:join(root,'spoke.sock'),log:()=>{},
  createTransport:o=>{carriers.push(o.record.id);throw Error('unexpected carrier admission');},gitDaemon:async()=>({close:async()=>{}})});
 runtime=owner;
 assert.deepEqual(carriers,[]);assert.deepEqual(owner.hosts,[],'no runtime Host admitted');
 env.CLAND_FAKE_HOSTS=[env.CLAND_FAKE_HOSTS,legacy.machine.address].filter(Boolean).join(',');
 registerFakeHosts(root,store.hosts,env,()=>{});
 assert.deepEqual(store.hosts.list().map(row=>row.id),[legacy.machine.address],'independent manual host still registers');
 assert.equal((await provider.status(acquired.machine)).state,fault==='released'?'gone':'ready','no inferred release');
});
