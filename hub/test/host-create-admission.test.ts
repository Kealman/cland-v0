// T2: local CLI and socket admission, directory-only fake provider.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fakeOnlyFixture } from './fake-only-fixture.ts';
import { tempProject, projectHub, cland } from './harness.ts';

test('C4 create refuses an unprepared pool naming host prepare', async t => {
 const root=await tempProject(t);
 await mkdir(join(root,'.cland'),{recursive:true});
 await writeFile(join(root,'.cland/config.toml'),'[hosts.agents]\nprovider="fake"\nsize="fake"\nslots=8\nregion="fake-1"\n');
 await projectHub(t,root,{CLAND_FAKE_HOST_ROOT:root});
 const result=await cland(root,'host','create','agents');
 assert.equal(result.code,1);
 assert.match(result.stderr,/cland host prepare/);
});

test('C5 host help lists create and list',async t=>{
 const root=await tempProject(t);
 const help=await cland(root,'host','--help');assert.equal(help.code,0,help.stderr);
 assert.match(help.stdout,/host create \[pool\]/);assert.match(help.stdout,/host list/);
});

test('C4 create refuses a prepared image after harness pins change',async t=>{
 const root=await tempProject(t);await mkdir(join(root,'.cland'),{recursive:true});
 const path=join(root,'.cland/config.toml');
 const text='[hosts]\nharnesses={opencode="1.0.0"}\n[hosts.agents]\nprovider="fake"\nsize="fake"\nslots=8\nregion="fake-1"\n';
 await writeFile(path,text);await projectHub(t,root,{CLAND_FAKE_HOST_ROOT:root});
 assert.equal((await cland(root,'host','prepare','agents')).code,0);
 await writeFile(path,text.replace('1.0.0','2.0.0'));
 const result=await cland(root,'host','create','agents');
 assert.equal(result.code,1);assert.match(result.stderr,/cland host prepare agents/);
});

test('DigitalOcean create requires a prepared pool before acquisition API calls',async t=>{
 const root=await tempProject(t);await mkdir(join(root,'.cland'),{recursive:true});
 await writeFile(join(root,'.cland/config.toml'),'[hosts.do]\nprovider="digitalocean"\nsize="s-2vcpu-4gb"\nregion="lon1"\n');
 await projectHub(t,root);
 let calls=0;
 t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error('provider network forbidden in admission fixture');});
 await assert.rejects(fetch('https://fixture.invalid/admission-control'),/provider network forbidden/);
 assert.equal(calls,1,'positive control intercepts a fetch before exercising create');calls=0;
 const result=await cland(root,'host','create','do');
 assert.equal(result.code,1);assert.match(result.stderr,/host prepare/);
 assert.equal(calls,0,'refusal precedes every provider API call');
});

test('pre-row admission refusal acquires nothing and publishes no provision record',async t=>{
 const {createHost}=await import('../src/host/provision-host.ts');
 const {FakeHostProvider}=await import('../src/host/provider/fake.ts');
 const {Store}=await import('../src/hub/store.ts');
 const {onCleanup}=await import('./process-cleanup.ts');
 const root=await tempProject(t);await mkdir(join(root,'.cland'),{recursive:true});
 await writeFile(join(root,'.cland/config.toml'),'[hosts.agents]\nprovider="fake"\nsize="fake"\nslots=1\nmin_hosts=0\nregion="fake-1"\n');
 const hub=await projectHub(t,root,{CLAND_FAKE_HOST_ROOT:root});
 const prepared=await cland(root,'host','prepare','agents');assert.equal(prepared.code,0,prepared.stderr);
 const store=new Store(join(root,'.cland/hub.db'));onCleanup(t,()=>store.close());
 const provider=new FakeHostProvider({env:hub.hostEnvironment});let admitted=0,acquired=0;
 t.mock.method(provider,'acquire',async()=>{acquired++;throw Error('acquisition must not run');});
 await assert.rejects(createHost({root,pool:'agents',env:hub.hostEnvironment,records:store.hosts,owner:hub.hostOwner!,provider,admit:()=>{admitted++;throw Error('latest admission refused');}}),/latest admission refused/);
 assert.equal(admitted,1);assert.equal(acquired,0);assert.deepEqual(store.hosts.provisions.list(),[]);
});

test('DigitalOcean SSH bootstrap pins identity and ignores ungated overrides',async t=>fakeOnlyFixture(t,async root=>{
 const {provisionSsh}=await import('../src/host/provision-ssh.ts');
 const {readFile,stat}=await import('node:fs/promises');
 const known=join(root,'known_hosts');
 const env:NodeJS.ProcessEnv={CLAND_SSH_BIN:'recording-ssh'};
 const calls:Array<{binary:string;args:string[];input?:string|undefined}>=[];
 const record={id:'host-do',pool:'agents',provider:'digitalocean',size:'c-8',region:'lon1',created:'2026-11-08T00:00:00Z',state:'booting' as const,machine:{id:'123',address:'192.0.2.17',architecture:'x86_64' as const,created:'2026-11-08T00:00:00Z'},ssh:{clientKeyPath:join(root,'provider-client-key'),knownHosts:'192.0.2.17 ssh-ed25519 pinned-material\n',home:'/home/agent',node:'node'}};
 const transport=await provisionSsh(record,known,env,async(binary,args,_env,input)=>{calls.push({binary,args,input});});
 await transport.probe(1000);
 assert.equal(calls[0]!.binary,'ssh');assert.equal(calls[0]!.args[calls[0]!.args.indexOf('-i')+1],record.ssh.clientKeyPath);
 assert.ok(calls[0]!.args.includes('agent@192.0.2.17'));assert.ok(calls[0]!.args.includes('StrictHostKeyChecking=yes'));
 assert.equal(calls[0]!.input,'true\n');assert.equal(await readFile(known,'utf8'),record.ssh.knownHosts);assert.equal((await stat(known)).mode&0o777,0o600);
}));
