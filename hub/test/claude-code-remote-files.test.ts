// T2: private remote Claude launch files use a recording Host; no native harness runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { ClaudeCodeAdapter } from '../src/adapters/claude-code.ts';
import type { AdapterHost } from '../src/adapters/contract.ts';
import type { HostCommand } from '../src/host/host.ts';
import { localHost } from '../src/host/local.ts';
import { tempProject } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';

test('remote Claude private credential files are removed only after confirmed stop', async t => {
  const root = await tempProject(t), commands: HostCommand[] = [], state = new Map<string,string>();
  let confirmed = false;
  const machine = { ...localHost(), name: 'f1',
    layout: () => ({ node: '/host/node', cli: '/host/cli', spoke: '/host/spoke', discoveryFile: '/host/hub.json', runDirectory: join(root,'run'), logDirectory: join(root,'log'), modDir: '/host/mod' }),
    run: async (command: HostCommand) => { commands.push(command); return { code: 0, stdout: command.args[0] === '--bg' ? 'claude attach abcdef12' : '[]', stderr: '' }; },
    identity: async (pid:number) => ({pid,pidIdentity:'linux:fixture:1',pidStarted:null}),
    stop: async () => confirmed,
  };
  // Discovery returns the recorded worker; stop refusal must preserve its files.
  machine.run = async command => { commands.push(command); return {code:0,stdout: command.args[0] === '--bg' ? 'claude attach abcdef12' : command.args[0] === 'agents' ? JSON.stringify([{id:'abcdef12',sessionId:'native',pid:987654}]) : '',stderr:''}; };
  const host: AdapterHost = {root,discoveryFile:'/hub/hub.json',node:'/hub/node',cli:'/hub/cli',spoke:'/hub/spoke',log:()=>{},signal:()=>{},exited:()=>{},recordPid:()=>{},hostForLaunch:()=>machine,hostForProcess:()=>machine,adapterState:{read:key=>state.get(key)??null,write:(key,value)=>{state.set(key,value);}}};
  const adapter = new ClaudeCodeAdapter(host,{bin:'/host/claude',env:fixtureEnvironment(root,process.env),pollMs:600000});
  t.after(()=>adapter.close());
  const row = await adapter.spawn({name:'worker',sessionId:'synthetic-session',host:'f1',role:null,model:null,cwd:root,launchToken:'synthetic-private-credential'});
  const args=commands[0]!.args, paths=['--mcp-config','--settings'].map(flag=>args[args.indexOf(flag)+1]!);
  for(const path of paths) { assert.equal((await stat(path)).mode&0o777,0o600); assert.match(await readFile(path,'utf8'),/synthetic-private-credential/); }
  assert.equal(args.join(' ').includes('synthetic-private-credential'),false);
  await assert.rejects(adapter.stop(row),/could not stop/);
  assert.match(adapter.stateReason(row)!,/cleanup-incomplete/);
  for(const path of paths) assert.equal((await stat(path)).isFile(),true);
  confirmed=true;
  await adapter.stop(row);
  assert.equal(adapter.stateReason(row),null);
  for(const path of paths) await assert.rejects(stat(path),{code:'ENOENT'});
});

test('remote Claude shutdown during adoption joins rollback before removing private files',async t=>{
 const root=await tempProject(t),commands:HostCommand[]=[];let adapter:ClaudeCodeAdapter,closing:Promise<void>|undefined,closed=false,released=false;
 const entered=Promise.withResolvers<void>(),release=Promise.withResolvers<void>();
 const {within}=await import('../src/executor/droplet/deadline.ts');
 const machine={...localHost(),name:'f1',layout:()=>({node:'/host/node',cli:'/host/cli',spoke:'/host/spoke',discoveryFile:'/host/hub.json',runDirectory:join(root,'run'),logDirectory:join(root,'log'),modDir:'/host/mod'}),
   run:async(command:HostCommand)=>{commands.push(command);return {code:0,stdout:'claude attach abcdef12',stderr:''};},
   launchClaude:async(command:HostCommand)=>machine.run(command),
   adopt:async()=>{closing=Promise.resolve(adapter.close()).then(()=>{closed=true;});return {process:{pid:987654,pidIdentity:'linux:fixture:1'},job:'abcdef12',session:'native',release:async()=>{assert.ok(commands.some(command=>command.args[0]==='stop'));released=true;}};},
   stop:async()=>{entered.resolve();await release.promise;return true;},
 };
 const host:AdapterHost={root,discoveryFile:'/hub/discovery',node:'/hub/node',cli:'/hub/cli',spoke:'/hub/spoke',log:()=>{},signal:()=>{},exited:()=>{},recordPid:()=>{},hostForLaunch:()=>machine,hostForProcess:()=>machine};
 adapter=new ClaudeCodeAdapter(host,{env:fixtureEnvironment(root,process.env),bin:'/host/claude'});
 const launch=adapter.spawn({name:'worker',host:'f1',role:null,model:null,cwd:root,launchToken:'synthetic-rollback-token'});
 const rejected=assert.rejects(launch,/Claude adapter is closed/);
 try{await within(entered.promise,1000);await new Promise<void>(resolve=>setImmediate(resolve));assert.equal(closed,false,'close retains the admitted worker until rollback joins stop');}
 finally{release.resolve();await within(rejected,1000);await closing;}
 assert.equal(released,true);
 const args=commands[0]!.args;
 for(const flag of ['--mcp-config','--settings'])await assert.rejects(stat(args[args.indexOf(flag)+1]!),{code:'ENOENT'});
});

for(const mode of ['native-refused','native-unknown','release-reply-lost'] as const)test(`Claude ${mode} retains generation files until confirmed release`,async t=>{
 const root=await tempProject(t),commands:HostCommand[]=[];let releases=0,refuse=true;
 const machine={...localHost(),name:'f1',layout:()=>({node:'/host/node',cli:'/host/cli',spoke:'/host/spoke',discoveryFile:'/host/hub.json',runDirectory:join(root,'run'),logDirectory:join(root,'log'),modDir:'/host/mod'}),
   run:async(command:HostCommand)=>{commands.push(command);if(command.args[0]==='stop'&&mode==='native-unknown'&&refuse)throw new Error('native reply unknown');return {code:command.args[0]==='stop'&&mode==='native-refused'&&refuse?1:0,stdout:command.args[0]==='agents'?'[{"id":"abcdef12","sessionId":"native","pid":987654}]':'claude attach abcdef12',stderr:''};},
   launchClaude:async(command:HostCommand)=>machine.run(command),
   adopt:async()=>({process:{pid:987654,pidIdentity:'linux:fixture:1'},job:'abcdef12',session:'native',release:async()=>{releases++;if(mode==='release-reply-lost'&&refuse)throw new Error('Claude release cleanup incomplete: reply lost');}}),
   stop:async()=>true,
 };
 const host:AdapterHost={root,discoveryFile:'/hub/discovery',node:'/hub/node',cli:'/hub/cli',spoke:'/hub/spoke',log:()=>{},signal:()=>{},exited:()=>{},recordPid:()=>{},hostForLaunch:()=>machine,hostForProcess:()=>machine};
 const adapter=new ClaudeCodeAdapter(host,{env:fixtureEnvironment(root,process.env),bin:'/host/claude',pollMs:600000});t.after(()=>adapter.close());
 const row=await adapter.spawn({name:'worker',host:'f1',role:null,model:null,cwd:root,launchToken:'synthetic-retained-token'});
 const args=commands[0]!.args,paths=['--mcp-config','--settings'].map(flag=>args[args.indexOf(flag)+1]!);
 await assert.rejects(adapter.stop(row),mode!=='release-reply-lost'?/native job stop is unconfirmed/:/release cleanup incomplete/);
 assert.equal(releases,mode!=='release-reply-lost'?0:1);
 for(const path of paths)assert.equal((await readFile(path,'utf8')).includes('synthetic-retained-token'),true);
 refuse=false;await adapter.stop(row);assert.equal(releases,mode!=='release-reply-lost'?1:2);
 assert.equal(commands.filter(command=>command.args[0]==='stop').length,mode!=='release-reply-lost'?2:1,'confirmed native stop is not replayed after release failure');
 for(const path of paths)await assert.rejects(stat(path),{code:'ENOENT'});
});

for(const mode of ['missing-marker','other-generation','old-error-shape'] as const)test(`missing Claude generation ${mode} grants no cleanup authority`,async t=>{
 const {MissingClaudeGeneration}=await import('../src/host/host.ts');
 const {launchGenerationKey}=await import('../src/adapters/launch-generation.ts');
 const root=await tempProject(t),state=new Map<string,string>(),generation='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';let forgotten=0;
 state.set(launchGenerationKey('worker-session'),generation);
 if(mode!=='missing-marker')state.set('claude-cleanup:worker-session',mode==='other-generation'?'other-generation':generation);
 const machine={...localHost(),name:'f1',adopt:async()=>{if(mode==='old-error-shape')throw new Error('Claude generation receipt missing');throw new MissingClaudeGeneration(generation,async()=>{forgotten++;});},run:async()=>{assert.fail('no native CLI authority');},stop:async()=>{assert.fail('no signal authority');}};
 const host:AdapterHost={root,discoveryFile:'/hub/discovery',node:'/hub/node',cli:'/hub/cli',spoke:'/hub/spoke',log:()=>{},signal:()=>{},exited:()=>{},recordPid:()=>{},hostForProcess:()=>machine,adapterState:{read:key=>state.get(key)??null,write:(key,value)=>{state.set(key,value);}}};
 const adapter=new ClaudeCodeAdapter(host,{env:fixtureEnvironment(root,process.env),pollMs:600000});t.after(()=>adapter.close());
 await assert.rejects(adapter.resume({name:'worker',host:'f1',harness:'claude-code',role:'implementer',model:null,cwd:root,sessionId:'worker-session',harnessId:'job',harnessSessionId:'native',pid:987654,pidIdentity:'linux:fixture:1',startedAt:new Date().toISOString(),status:'running'}),/generation receipt missing/);
 assert.equal(forgotten,0);
});

for(const failing of [false,true])test(`terminal generation restart retry ${failing?'is durably bounded after failure':'settles and clears its marker'}`,async t=>{
 const {launchGenerationKey}=await import('../src/adapters/launch-generation.ts');
 const root=await tempProject(t),generation='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',state=new Map<string,string>(),calls:string[]=[];
 const row:import('../src/adapters/contract.ts').HarnessProcess={name:'worker',host:'f1',harness:'claude-code',role:'implementer',model:null,cwd:root,sessionId:'terminal-session',harnessId:'abcdef12',harnessSessionId:'native',pid:987654,pidIdentity:'linux:fixture:1',startedAt:new Date().toISOString(),status:'running'};
 state.set(launchGenerationKey(row.sessionId),generation);state.set('claude-terminal:'+row.sessionId,JSON.stringify({generation,attempts:1,cause:'prior native confirmation failed'}));
 let releases=0;
 const machine={...localHost(),name:'f1',layout:()=>({node:'/host/node',cli:'/host/cli',spoke:'/host/spoke',discoveryFile:'/host/hub.json',runDirectory:join(root,'run'),logDirectory:join(root,'log'),modDir:'/host/mod'}),
   adopt:async()=>({process:{pid:row.pid,pidIdentity:row.pidIdentity??null},job:row.harnessId!,session:'native',closed:true,release:async()=>{releases++;},forget:async()=>{}}),
   stop:async()=>true,
   run:async(command:HostCommand)=>{calls.push(command.args[0]!);return {code:failing?1:0,stdout:'',stderr:'synthetic native refusal'};},
 };
 const host:AdapterHost={root,discoveryFile:'/hub/discovery',node:'/hub/node',cli:'/hub/cli',spoke:'/hub/spoke',log:()=>{},signal:()=>{},exited:()=>assert.fail('resume returns settlement to its row owner'),recordPid:()=>{},hostForProcess:()=>machine,adapterState:{read:key=>state.get(key)??null,write:(key,value)=>{state.set(key,value);}}};
 const adapter=new ClaudeCodeAdapter(host,{env:fixtureEnvironment(root,process.env),bin:'/host/claude'});t.after(()=>adapter.close());
 if(failing){
   await assert.rejects(adapter.resume(row),/native job stop is unconfirmed/);
   assert.equal(JSON.parse(state.get('claude-terminal:'+row.sessionId)!).attempts,2);assert.equal(releases,0);
   await adapter.close();
   const restarted=new ClaudeCodeAdapter(host,{env:fixtureEnvironment(root,process.env),bin:'/host/claude'});t.after(()=>restarted.close());
   await assert.rejects(restarted.resume(row),/cleanup-incomplete/);
   assert.deepEqual(calls,['stop','agents'],'another restart cannot spend a third native settlement attempt');
   assert.match(restarted.stateReason(row)!,/cleanup-incomplete/);
 }else{
   assert.equal((await adapter.resume(row)).found,false);assert.equal(releases,1);assert.deepEqual(calls,['stop']);assert.equal(state.get('claude-terminal:'+row.sessionId),'');
 }
});

test('an unconfirmed explicit stop stays held on restart without replaying native cleanup',async t=>{
 const {launchGenerationKey}=await import('../src/adapters/launch-generation.ts');
 const root=await tempProject(t),generation='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',state=new Map<string,string>();
 const row:import('../src/adapters/contract.ts').HarnessProcess={name:'worker',host:'f1',harness:'claude-code',role:'implementer',model:null,cwd:root,sessionId:'held-session',harnessId:'abcdef12',harnessSessionId:'native',pid:987654,pidIdentity:'linux:fixture:1',startedAt:new Date().toISOString(),status:'running'};
 state.set(launchGenerationKey(row.sessionId),generation);state.set('claude-stop-failure:'+row.sessionId+':'+generation,'native tree completion unknown');
 const machine={...localHost(),name:'f1',adopt:async()=>({process:{pid:row.pid,pidIdentity:row.pidIdentity??null},job:row.harnessId!,session:'native',closed:true}),run:async()=>assert.fail('unknown native cleanup is never replayed'),stop:async()=>assert.fail('unknown signal outcome is never replayed')};
 const host:AdapterHost={root,discoveryFile:'/hub/discovery',node:'/hub/node',cli:'/hub/cli',spoke:'/hub/spoke',log:()=>{},signal:()=>{},exited:()=>assert.fail('row stays held'),recordPid:()=>{},hostForProcess:()=>machine,adapterState:{read:key=>state.get(key)??null,write:(key,value)=>{state.set(key,value);}}};
 const adapter=new ClaudeCodeAdapter(host,{env:fixtureEnvironment(root,process.env)});t.after(()=>adapter.close());
 const result=await adapter.resume(row);assert.equal(result.found,false);if(!result.found)assert.equal(result.alive,true);
 assert.match(adapter.stateReason(row)!,/cleanup-incomplete/);
});

test('close after accepted Claude launch result re-adopts before rollback and joins settlement',async t=>{
 const {within}=await import('../src/executor/droplet/deadline.ts');
 const root=await tempProject(t),entered=Promise.withResolvers<void>(),release=Promise.withResolvers<void>(),commands:HostCommand[]=[];let adopts=0,stops=0,releases=0;
 const machine={...localHost(),name:'f1',layout:()=>({node:'/host/node',cli:'/host/cli',spoke:'/host/spoke',discoveryFile:'/host/hub.json',runDirectory:join(root,'run'),logDirectory:join(root,'log'),modDir:'/host/mod'}),
   launchClaude:async(command:HostCommand)=>{commands.push(command);entered.resolve();await release.promise;return {code:0,stdout:'claude attach abcdef12',stderr:''};},
   adopt:async()=>{adopts++;return {process:{pid:987654,pidIdentity:'linux:fixture:1'},job:'abcdef12',session:'native',release:async()=>{releases++;}};},
   run:async(command:HostCommand)=>{commands.push(command);return {code:0,stdout:'',stderr:''};},stop:async()=>{stops++;return true;},
 };
 const state=new Map<string,string>();
 const host:AdapterHost={root,discoveryFile:'/hub/discovery',node:'/hub/node',cli:'/hub/cli',spoke:'/hub/spoke',log:()=>{},signal:()=>{},exited:()=>{},recordPid:()=>{},hostForLaunch:()=>machine,hostForProcess:()=>machine,adapterState:{read:key=>state.get(key)??null,write:(key,value)=>{state.set(key,value);}}};
 const adapter=new ClaudeCodeAdapter(host,{env:fixtureEnvironment(root,process.env),bin:'/host/claude'});
 const launch=adapter.spawn({name:'worker',host:'f1',role:null,model:null,cwd:root,launchToken:'synthetic-held-result-token'});
 const rejected=assert.rejects(launch,/Claude adapter is closed/);let closing:Promise<void>|void;
 try{await within(entered.promise,1000);closing=adapter.close();release.resolve();await rejected;await closing;}
 finally{release.resolve();await Promise.allSettled([launch,Promise.resolve(adapter.close())]);}
 assert.ok(adopts>=1);assert.equal(stops,1);assert.equal(releases,1);
 const args=commands[0]!.args;for(const flag of ['--mcp-config','--settings'])await assert.rejects(stat(args[args.indexOf(flag)+1]!),{code:'ENOENT'});
});

test('captured and reconstructed failed-launch callbacks share one native settlement producer',async t=>{
 const {LaunchRecoveryPending}=await import('../src/adapters/launch-files.ts');const {within}=await import('../src/executor/droplet/deadline.ts');
 const root=await tempProject(t),state=new Map<string,string>(),entered=Promise.withResolvers<void>(),release=Promise.withResolvers<void>();let first=true,stops=0,releases=0;
 const machine={...localHost(),name:'f1',layout:()=>({node:'/host/node',cli:'/host/cli',spoke:'/host/spoke',discoveryFile:'/host/hub.json',runDirectory:join(root,'run'),logDirectory:join(root,'log'),modDir:'/host/mod'}),
   launchClaude:async()=>({code:0,stdout:'claude attach abcdef12',stderr:''}),adopt:async()=>{if(first){first=false;throw new Error('planted adoption failure');}return {process:{pid:987654,pidIdentity:'linux:fixture:1'},job:'abcdef12',session:'native',release:async()=>{releases++;}};},
   run:async()=>({code:0,stdout:'',stderr:''}),stop:async()=>{stops++;entered.resolve();await release.promise;return true;},
 };
 const host:AdapterHost={root,discoveryFile:'/hub/discovery',node:'/hub/node',cli:'/hub/cli',spoke:'/hub/spoke',durableLaunchRecovery:true,log:()=>{},signal:()=>{},exited:()=>{},recordPid:()=>{},hostForLaunch:()=>machine,hostForProcess:()=>machine,adapterState:{read:key=>state.get(key)??null,write:(key,value)=>{state.set(key,value);}}};
 const adapter=new ClaudeCodeAdapter(host,{env:fixtureEnvironment(root,process.env),bin:'/host/claude'});t.after(()=>adapter.close());
 const error=await adapter.spawn({name:'worker',host:'f1',sessionId:'pinned-session',role:null,model:null,cwd:root,launchToken:'synthetic-single-flight-token'}).then(()=>assert.fail('launch must fail'),error=>error);
 assert.ok(error instanceof LaunchRecoveryPending);assert.deepEqual(error.files,{undo:[],children:[]});
 const record=JSON.parse(state.get('claude-failed:pinned-session')!);assert.equal(JSON.stringify(record).includes('synthetic-single-flight-token'),false);
 const firstCallback=Promise.resolve(error.settled()),fallback=Promise.resolve(adapter.settleFailedLaunch(record.process));
 try{await within(entered.promise,1000);assert.equal(stops,1);assert.equal(releases,0);}finally{release.resolve();await Promise.all([firstCallback,fallback]);}
 assert.equal(stops,1);assert.equal(releases,1);
 const terminal=JSON.parse(state.get('claude-failed:pinned-session')!);assert.equal(terminal.phase,'settled');assert.equal(terminal.process.accountEnv,null);
 await adapter.settleFailedLaunch(record.process);assert.equal(stops,1,'terminal receipt grants no repeated native signal');
});

for(const typed of [false,true])test(`Claude ${typed?'typed non-admission':'untyped lookalike error'} ${typed?'rolls back without adoption':'stays supervised'}`,async t=>{
 const {LaunchRecoveryPending}=await import('../src/adapters/launch-files.ts');const {MissingClaudeGeneration}=await import('../src/host/host.ts');
 const root=await tempProject(t),state=new Map<string,string>();let generation='',adopts=0,launches=0;
 const machine={...localHost(),name:'f1',layout:()=>({node:'/host/node',cli:'/host/cli',spoke:'/host/spoke',discoveryFile:'/host/hub.json',runDirectory:join(root,'run'),logDirectory:join(root,'log'),modDir:'/host/mod'}),
   launchClaude:async(_command:HostCommand,id:string)=>{launches++;generation=id;throw Object.assign(new Error('CLAND_AGENT_ADMISSION_REFUSED'),typed?{code:'CLAND_AGENT_ADMISSION_REFUSED'}:{});},
   adopt:async()=>{adopts++;if(typed)assert.fail('positive non-admission has no native worker');throw new MissingClaudeGeneration(generation,async()=>assert.fail('missing receipt grants no cleanup authority'));},
   run:async()=>assert.fail('no replay or discovery'),
 };
 const host:AdapterHost={root,discoveryFile:'/hub/discovery',node:'/hub/node',cli:'/hub/cli',spoke:'/hub/spoke',durableLaunchRecovery:true,log:()=>{},signal:()=>{},exited:()=>{},recordPid:()=>{},hostForLaunch:()=>machine,hostForProcess:()=>machine,adapterState:{read:key=>state.get(key)??null,write:(key,value)=>{state.set(key,value);}}};
 const adapter=new ClaudeCodeAdapter(host,{env:fixtureEnvironment(root,process.env),bin:'/host/claude'});t.after(()=>adapter.close());
 const error=await adapter.spawn({name:'worker',host:'f1',sessionId:'refused-session',role:null,model:null,cwd:root,launchToken:'synthetic-refusal-token'}).then(()=>assert.fail('launch refuses'),error=>error);
 assert.ok(error instanceof LaunchRecoveryPending);const before=JSON.parse(state.get('claude-failed:refused-session')!);
 if(typed){await error.settled();assert.equal(adopts,0);await assert.rejects(stat(before.privateDirectory),{code:'ENOENT'});}
 else{await assert.rejects(Promise.resolve(error.settled()),/generation receipt missing/);assert.equal(adopts,1);assert.equal(before.phase,'launching');assert.ok((await readFile(join(before.privateDirectory,'settings.json'),'utf8')).includes('synthetic-refusal-token'));}
 assert.equal(launches,1);
});
