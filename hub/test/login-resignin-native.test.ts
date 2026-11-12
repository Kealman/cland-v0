// T3: fake harness children on two fake SSH hosts prove native error delivery,
// persisted sign-out, subsequent pool placement and retained live native ownership.
// Lifecycle: host-create fixture joins hubs, watchdogs, transports and captured children before roots.
import './cover-quiet.ts';
import {spawn} from "node:child_process";
import {loginFixtureOwners,loginChild} from "./login-fixture-owners.ts";
import {FakeHostProvider} from "../src/host/provider/fake.ts";
import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {writeFile,readFile,open,mkdir} from 'node:fs/promises';
import {assertPublishable} from '../../.agents/skills/qa/qa-demo-policy.ts';
import {nativeLoginEnvironment} from './login-native-environment.ts';
import {fixture} from './login-native-fixture.ts';
import {cland,connectUi,eventually,testWaitMs} from './harness.ts';
import {Store} from '../src/hub/store.ts';
import {ProcessTable} from '../src/adapters/processes.ts';
import {mountedSettledLogin} from './settled-login-fixture.ts';
import {hostDirectory} from '../../shared/fake-host-directory.ts';
import {fixtureEnvironment} from './fixture-environment.ts';
import {loginFilePath} from '../src/host/agent/fake-login-mount.ts';

const cases=[
 ['opencode','provider.auth'],
 ['codex','refresh_token_reused'],
 ['claude-code','authentication_failed'],
] as const;

test('native bound Codex renews its own dead credential home without replacing the disk',async t=>{
 const f=await fixture(t),store=f.own(new Store(join(f.root,'.cland/hub.db'))),owners=loginFixtureOwners(t);
 const created=await cland(f.root,'host','create','agents');assert.equal(created.code,0,created.stderr);const record=JSON.parse(created.stdout),host=f.hub.hostOwner!.hosts.find(host=>host.name===record.id)!;
 await mountedSettledLogin({root:f.root,env:f.env,records:store.hosts.logins,host,machine:record.machine,harness:'codex',beforeStop:f.beforeStop,afterNativeJoin:f.afterNativeJoin});
 const binding=store.hosts.logins.forHost(host.name)[0]!,path=`/cland/auth/codex-${binding.login}`;
 await host.writeFile(join(path,'config.toml'),Buffer.from('cli_auth_credentials_store = "file"\n'),{mode:0o600});
 await host.writeFile(join(path,'login.json'),Buffer.from(JSON.stringify({name:binding.login,token:'SENTINEL-dead-bound-codex',generation:15,signIn:{at:new Date().toISOString(),host:host.name},lastRotation:null,dead:true,turns:[]})),{mode:0o600});
 store.hosts.logins.markSignedOut(binding.login,{reason:'unauthorized',host:host.name});const bindings=store.hosts.logins.bindings(binding.login);
 const child=spawn(process.execPath,[new URL('../bin/cland.ts',import.meta.url).pathname,'login','signin',binding.login],{cwd:f.root,env:fixtureEnvironment(f.root,f.env,{CLAND_FAKE_HOST_ROOT:f.root,CLAND_FAKE_HOSTS:record.machine.address})});
 const joined=loginChild(owners,child);let error='';child.stderr.on('data',bytes=>{error+=String(bytes);});child.stdout.resume();child.stdin.end();assert.equal(await joined(),0,error);
 const row=store.hosts.logins.get(binding.login)!;assert.equal(row.state,'in-use');assert.deepEqual(store.hosts.logins.bindings(binding.login),bindings);assert.equal(row.kind==='disk'&&row.volumeId,binding.volumeId);
 const directory=join(f.root,'volumes',binding.volumeId+'.contents'),login=JSON.parse(await readFile(join(directory,'login.json'),'utf8'));assert.equal(login.dead,false);assert.equal(login.generation,0);assert.notEqual(login.token,'SENTINEL-dead-bound-codex');assert.equal(await readFile(join(directory,'config.toml'),'utf8'),'cli_auth_credentials_store = "file"\n');
 const inventory=await new FakeHostProvider({env:f.env}).listVolumes({project:f.root});assert.equal(inventory.state,'listed');if(inventory.state==='listed'){assert.equal(inventory.volumes.length,1);assert.equal(inventory.volumes[0]!.attachedTo,record.machine.id);}
});

test('native sign-in of unbound Claude, Codex and OpenCode disks reuses and detaches each volume',async t=>{
 const f=await fixture(t),store=f.own(new Store(join(f.root,'.cland/hub.db'))),owners=loginFixtureOwners(t);
 const created=await cland(f.root,'host','create','agents');assert.equal(created.code,0,created.stderr);
 const record=JSON.parse(created.stdout),provider=new FakeHostProvider({env:f.env});
 for(const harness of ['claude-code','codex','opencode'] as const){
  const result=await provider.createVolume({project:f.root,name:`renew-${harness}`,region:'fake-1',sizeGiB:1});assert.equal(result.state,'created');if(result.state!=='created')throw Error('fixture volume not created');
  const name=`renew-${harness}`;
  store.hosts.logins.insert({name,harness,account:name,kind:'disk',provider:'fake',region:'fake-1',volumeId:result.volume.id,snapshotIds:[],lastSignIn:null});store.hosts.logins.markSignedOut(name,{reason:'fixture signed out',host:null});
  const child=spawn(process.execPath,[new URL('../bin/cland.ts',import.meta.url).pathname,'login','signin',name],{cwd:f.root,env:fixtureEnvironment(f.root,f.env,{CLAND_FAKE_HOST_ROOT:f.root,CLAND_FAKE_HOSTS:record.machine.address})});
  const joined=loginChild(owners,child);let error='';child.stderr.on('data',bytes=>{error+=String(bytes);});child.stdout.resume();child.stdin.end('SENTINEL-code\n');assert.equal(await joined(),0,error);
  const row=store.hosts.logins.get(name)!;assert.equal(row.state,'ready');assert.ok(row.lastSignIn);assert.deepEqual(store.hosts.logins.bindings(name),[]);assert.equal(row.kind==='disk'&&row.volumeId,result.volume.id);assert.equal(row.kind==='disk'&&row.snapshotIds.length,1);
  const inventory=await provider.listVolumes({project:f.root});assert.equal(inventory.state,'listed');if(inventory.state!=='listed')throw Error('fixture inventory unavailable');assert.equal(inventory.volumes.length,['claude-code','codex','opencode'].indexOf(harness)+1);assert.equal(inventory.volumes.find(v=>v.id===result.volume.id)!.attachedTo,null);
  const login=JSON.parse(await readFile(join(f.root,'volumes',result.volume.id+'.contents','login.json'),'utf8'));assert.equal(login.dead,false);
 }
});

for(const [harness,reason] of cases)for(const relaunch of (harness==='opencode'?[false,true]:[false]))test(`native ${harness} sign-in renews the mounted writer with relaunch ${relaunch}`,async t=>{
 const f=await fixture(t,{loginRoles:true}),store=f.own(new Store(join(f.root,'.cland/hub.db'))),table=f.own(new ProcessTable(join(f.root,'.cland/hub.db')));
 const hosts:import('../src/host/host.ts').Host[]=[];
 const stops:string[]=[],homes:string[]=[],loginHomes:string[]=[];let complete=false;
 const tail=async(path:string)=>{try{const file=await open(path,'r');try{const stat=await file.stat(),bytes=Buffer.alloc(Math.min(3000,stat.size));await file.read(bytes,0,bytes.length,Math.max(0,stat.size-bytes.length));const text=bytes.toString('utf8');assertPublishable(text);return text;}finally{await file.close();}}catch{return 'diagnostic unavailable or publication scan refused';}};
 f.beforeStop(async()=>{if(complete)return;t.diagnostic(JSON.stringify({boundary:'native matrix incomplete',processes:table.all().map(row=>({name:row.name,host:row.host,pid:row.pid,status:row.status,login:row.login})),hub:await tail(join(f.root,'.cland/log/hub.log')),loginStates:store.hosts.logins.list().map(row=>({name:row.name,state:row.state,reason:row.signedOut?.reason})),prompt:homes[0]?await tail(join(homes[0],'native/prompts',`${table.get('first')?.harnessSessionId}.log`)):'not launched',opencode:homes[0]?await tail(join(homes[0],'native',`server-${table.get('first')?.pid}.log`)):'not launched'}));});
 for(let index=0;index<1;index++){
  const created=await cland(f.root,'host','create','agents');assert.equal(created.code,0,created.stderr);
  const record=JSON.parse(created.stdout),host=f.hub.hostOwner!.hosts.find(host=>host.name===record.id)!;
  hosts.push(host);
  await mountedSettledLogin({root:f.root,env:f.env,records:store.hosts.logins,host,machine:record.machine,harness,beforeStop:f.beforeStop,afterNativeJoin:f.afterNativeJoin});
  const binding=store.hosts.logins.forHost(host.name)[0]!,path=`/cland/auth/${harness}-${binding.login}`;
  await host.writeFile(join(path,'login.json'),Buffer.from(JSON.stringify({name:binding.login,token:'SENTINEL-native-login',generation:0,signIn:{at:new Date().toISOString(),host:host.name},lastRotation:null,dead:false,turns:[]})),{mode:0o600});
  const directory=hostDirectory(f.root,record.machine.id),home=join(directory,'home');homes.push(home);
  // The shared ct- alias plus the remote run suffix exceeds Codex's socket cap.
  // Keep only this matrix's launch files in a short directory inside the owned host home.
  const layout=host.layout.bind(host),runDirectory=join(home,'r');await mkdir(runDirectory);
  if(harness==='codex')Object.defineProperty(host,'layout',{value:(boundary:Parameters<typeof host.layout>[0])=>({...layout(boundary),runDirectory})});
  const hostEnv=fixtureEnvironment(f.root,f.env,{CLAND_FAKE_HOST_ROOT:f.root,CLAND_FAKE_HOSTS:record.machine.id,CLAND_HOST_BOOT_ID_FILE:join(directory,'boot-id')});
  const loginHome=await loginFilePath(path,hostEnv);
  loginHomes.push(loginHome);
  let generation=0;
  host.freePort=async()=>{const port=12345+generation++;await writeFile(join(directory,'ports.json'),JSON.stringify({[port]:join(home,`session-${port}.sock`)}));return port;};
  const spawn=host.spawn.bind(host),stop=host.stop.bind(host);
  const decorate=(env:NodeJS.ProcessEnv)=>nativeLoginEnvironment(env,{FAKE_CODEX_HOME:join(home,'codex'),FAKE_CODEX_TURN_MS:'30',FAKE_CLAUDE_HOME:join(home,'claude'),FAKE_CLAUDE_TURN_MS:'30',FAKE_LOGIN_HOME:loginHome,FAKE_LOGIN_ENABLED:'1',FAKE_LOGIN_HOST:host.name,FAKE_OPENCODE_HOME:join(home,'native'),FAKE_OPENCODE_SOCKET:join(home,`session-${12344+generation}.sock`),FAKE_OPENCODE_TURN_MS:'1'});
  host.spawn=(command,options)=>spawn({...command,env:decorate(command.env)},options);
  // sshHost keys Claude admission by command identity; retain that object.
  const run=host.run.bind(host);host.run=command=>run(Object.assign(command,{env:decorate(command.env)}));
  const launchClaude=host.launchClaude?.bind(host);if(launchClaude)host.launchClaude=(command,generation)=>launchClaude({...command,env:decorate(command.env)},generation);
  host.stop=(...args)=>{stops.push(host.name);return stop(...args);};
 }
 const ui=await connectUi(t,f.hub.discovery,'cli');
 const launched=await ui.request({type:'session.launch',name:'first',role:'login-source',host:hosts[0]!.name,harness,cwd:homes[0]!,model:harness==='opencode'?'opencode/fake-paid':undefined},testWaitMs());assert.equal(launched.ok,true,launched.error);
 const first=await eventually('native first session durably persisted',()=>{const row=table.get('first');return row?.status==='running'&&row.pid&&row.harnessSessionId?row:undefined;});
 if(harness==='opencode')await eventually('native OpenCode subscribed to its event stream',async()=>{try{return (await readFile(join(homes[0]!,'native',`server-${first.pid}.log`),'utf8')).includes('event stream subscribed')?true:undefined;}catch{return undefined;}});
 if(relaunch){const configPath=join(f.root,'.cland/config.toml');await writeFile(configPath,'# managed by cland\n'+await readFile(configPath,'utf8'));const configured=await ui.request({type:'config.set',key:'hosts.relaunch_after_signin',value:true});assert.equal(configured.ok,true,configured.error);assert.deepEqual(configured.value,{key:'hosts.relaunch_after_signin',value:true,applies:'now'});}
 const bindings=store.hosts.logins.bindings(first.login!);
 const sent=await ui.request({type:'topic.send',topic:'general',to:['first'],text:'DEAD-LOGIN'});assert.equal(sent.ok,true,sent.error);
 const dead=await eventually('exact native signal persisted on its login',()=>{const row=store.hosts.logins.get(first.login!);return row?.state==='signed-out'&&row.signedOut?.reason===reason?row:undefined;});
 assert.equal(dead.signedOut!.host,hosts[0]!.name);
 assert.deepEqual(store.hosts.logins.bindings(first.login!),bindings);
 const before=await new FakeHostProvider({env:f.env}).listVolumes({project:f.root});
 const owners=loginFixtureOwners(t);
 const child=spawn(process.execPath,[new URL('../bin/cland.ts',import.meta.url).pathname,'login','signin',first.login!],{cwd:f.root,env:fixtureEnvironment(f.root,f.env,{CLAND_FAKE_HOST_ROOT:f.root,CLAND_FAKE_HOSTS:store.hosts.get(hosts[0]!.name)!.address})});
 const joined=loginChild(owners,child);let output='',error='';child.stdout.on('data',bytes=>{output+=String(bytes);});child.stderr.on('data',bytes=>{error+=String(bytes);});child.stdin.end(harness==='claude-code'?'SENTINEL-code\n':undefined);
 assert.equal(await joined(),0,error);assert.match(output,/ready/);
 const resumed=table.get('first')!;assert.equal(resumed.harnessSessionId,first.harnessSessionId);assert.equal(resumed.cwd,first.cwd);assert.equal(resumed.sessionId,first.sessionId);assert.equal(resumed.status,'running');if(relaunch)assert.notEqual(resumed.pid,first.pid);else assert.equal(resumed.pid,first.pid);
 const renewed=store.hosts.logins.get(first.login!)!;assert.equal(renewed.state,'in-use');assert.ok(renewed.lastSignIn);assert.deepEqual(store.hosts.logins.bindings(first.login!),bindings);
 assert.equal(JSON.parse(await readFile(join(loginHomes[0]!,'login.json'),'utf8')).dead,false,'native login home renewed');
 const after=await new FakeHostProvider({env:f.env}).listVolumes({project:f.root});
 assert.equal(before.state,'listed');assert.equal(after.state,'listed');
 if(before.state==='listed'&&after.state==='listed')assert.deepEqual(after.volumes.map(v=>v.id),before.volumes.map(v=>v.id));
 const turn=await ui.request({type:'topic.send',topic:'general',to:['first'],text:'renewed-turn'});assert.equal(turn.ok,true,turn.error);
 const volume=renewed.kind==='disk'?renewed.volumeId:null;assert.ok(volume);
 const login=await eventually('renewed native turn persisted on the same volume',async()=>{const row=JSON.parse(await readFile(join(f.root,'volumes',volume+'.contents','login.json'),'utf8'));return row.turns.some((turn:{session:string})=>turn.session===first.harnessSessionId)?row:undefined;});
 assert.equal(login.dead,false);assert.ok(login.generation>0);
 assert.equal(table.get('first')!.stoppedAt,null);complete=true;
});
