// T3: fake harness children on two fake SSH hosts prove native error delivery,
// persisted sign-out, subsequent pool placement and retained live native ownership.
// Lifecycle: host-create fixture joins hubs, watchdogs, transports and captured children before roots.
import './cover-quiet.ts';
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

for(const [harness,reason] of cases)test(`native ${harness} ${reason} signs out without stopping existing sessions`,async t=>{
 const f=await fixture(t,{loginRoles:true}),store=f.own(new Store(join(f.root,'.cland/hub.db'))),table=f.own(new ProcessTable(join(f.root,'.cland/hub.db')));
 const hosts:import('../src/host/host.ts').Host[]=[];
 const stops:string[]=[],homes:string[]=[];let complete=false;
 const tail=async(path:string)=>{try{const file=await open(path,'r');try{const stat=await file.stat(),bytes=Buffer.alloc(Math.min(3000,stat.size));await file.read(bytes,0,bytes.length,Math.max(0,stat.size-bytes.length));const text=bytes.toString('utf8');assertPublishable(text);return text;}finally{await file.close();}}catch{return 'diagnostic unavailable or publication scan refused';}};
 f.beforeStop(async()=>{if(complete)return;t.diagnostic(JSON.stringify({boundary:'native matrix incomplete',processes:table.all().map(row=>({name:row.name,host:row.host,pid:row.pid,status:row.status,login:row.login})),hub:await tail(join(f.root,'.cland/log/hub.log')),loginStates:store.hosts.logins.list().map(row=>({name:row.name,state:row.state,reason:row.signedOut?.reason})),prompt:homes[0]?await tail(join(homes[0],'native/prompts',`${table.get('first')?.harnessSessionId}.log`)):'not launched',codex:homes[0]?await tail(join(homes[0],'.cland-host/log/codex-first.log')):'not launched',opencode:homes[0]?await tail(join(homes[0],'native',`server-${table.get('first')?.pid}.log`)):'not launched'}));});
 for(let index=0;index<2;index++){
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
  await writeFile(join(directory,'ports.json'),JSON.stringify({'12345':join(home,'session.sock')}));host.freePort=async()=>12345;
  const spawn=host.spawn.bind(host),stop=host.stop.bind(host);
  const decorate=(env:NodeJS.ProcessEnv)=>nativeLoginEnvironment(env,{FAKE_CODEX_HOME:join(home,'codex'),FAKE_CODEX_TURN_MS:'30',FAKE_CLAUDE_HOME:join(home,'claude'),FAKE_CLAUDE_TURN_MS:'30',FAKE_LOGIN_HOME:loginHome,FAKE_LOGIN_ENABLED:'1',FAKE_LOGIN_HOST:host.name,FAKE_OPENCODE_HOME:join(home,'native'),FAKE_OPENCODE_SOCKET:join(home,'session.sock'),FAKE_OPENCODE_TURN_MS:'1'});
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
 const bindings=store.hosts.logins.bindings(first.login!);
 const sent=await ui.request({type:'topic.send',topic:'general',to:['first'],text:'DEAD-LOGIN'});assert.equal(sent.ok,true,sent.error);
 const dead=await eventually('exact native signal persisted on its login',()=>{const row=store.hosts.logins.get(first.login!);return row?.state==='signed-out'&&row.signedOut?.reason===reason?row:undefined;});
 assert.equal(dead.signedOut!.host,hosts[0]!.name);
 assert.deepEqual(store.hosts.logins.bindings(first.login!),bindings);
 const next=await ui.request({type:'session.launch',name:'next',role:'login-worker',harness,cwd:homes[1]!,model:harness==='opencode'?'opencode/fake-paid':undefined},testWaitMs());assert.equal(next.ok,true,next.error);
 const second=await eventually('next native session persisted on alternative host',()=>{const row=table.get('next');return row?.status==='running'&&row.pid&&row.host===hosts[1]!.name?row:undefined;});
 assert.equal(second.host,hosts[1]!.name);assert.equal(table.get('first')!.status,'running');
 assert.deepEqual(stops,[]);assert.equal(await hosts[0]!.alive(first),true);
 assert.equal(table.get('first')!.stoppedAt,null);complete=true;
});
