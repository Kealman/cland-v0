// T3: native pinned SSH admission, delivered runtime, supervisor, tunnel and OpenCode lifecycle.
// projectHub owns the hub; beforeDirectories stops it then joins every fixture process before removal.
import test from 'node:test';
import {readyLogin} from './settled-login-fixture.ts';
import assert from 'node:assert/strict';
import { mkdir, writeFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tempProject, projectHub, cland, eventually, testWaitMs } from './harness.ts';
import { beforeDirectories, cleanupOwnedProcesses, fixtureProcessCensus, onCleanup, guardDirectoryRemoval } from './process-cleanup.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { Store } from '../src/hub/store.ts';
import { watchdogStopped } from '../src/executor/droplet/watchdog.ts';
import { drainFixtureOwners } from './host-watchdog-drain.ts';
import { stopHostWatchdog, type HostWatchdogIdentity } from '../src/host/host-watchdog.ts';
import { fakeHarness } from './fakes/harness.ts';
import { OpenCodeAdapter } from '../src/adapters/opencode.ts';
const SETUP_MS=testWaitMs(60000);
export async function fixture(t:test.TestContext,options:{lease?:string; fakeCodex?:boolean; loginRoles?:boolean;cardSignIn?:Pick<import('./harness.ts').ProjectHubOptions,'gatewayRemotes'|'registerHubCards'|'prepareLogin'>}={}) {
 const root=await tempProject(t,'hc-','/tmp');
 const beforeStop:Array<()=>Promise<void>>=[],afterNativeJoin:Array<()=>Promise<void>>=[],handles:Array<()=>unknown>=[];
 onCleanup(t,async()=>{
  const errors:unknown[]=[];
  for(const stop of [...beforeStop].reverse())try{await stop();}catch(error){errors.push(error);}
  for(const close of [...handles].reverse())try{await close();}catch(error){errors.push(error);}
  if(errors.length)throw new AggregateError(errors,'create fixture resource drainage failed');
 });
 const own=<T extends {close():unknown}>(handle:T):T=>{handles.push(()=>handle.close());return handle;};
 const bin=join(root,'bin');await mkdir(bin);
 await symlink(new URL('./fakes/fake-ssh.ts',import.meta.url).pathname,join(bin,'ssh'));
 await symlink(new URL('./fakes/fake-scp.ts',import.meta.url).pathname,join(bin,'scp'));
 await writeFile(join(bin,'setsid'),'#!/bin/sh\nexec "$@"\n',{mode:0o700});
 if(options.cardSignIn)for(const [name,path] of [['claude','claude-code/fake-claude.ts'],['codex','codex/fake-codex.ts'],['opencode','opencode/fake-opencode.ts']]){
  const environment=new URL('./fixture-environment.ts',import.meta.url).href,entry=new URL('./fakes/'+path,import.meta.url).pathname;
  // Same final-builder pattern as the native login fixtures: opt-ins and mapped
  // account paths are explicit overlays, never inherited through fake SSH.
  await writeFile(join(bin,name!),`#!${process.execPath}\nimport {fixtureEnvironment,scratchAccountEnvironment} from ${JSON.stringify(environment)};\nimport {realpathSync} from 'node:fs';\nimport {relative,isAbsolute,dirname,join,basename} from 'node:path';\nconst project=${JSON.stringify(root)},root=realpathSync(project),harness=${JSON.stringify(name)};\nconst owned=value=>{if(value===undefined)return;const path=realpathSync(value),r=relative(root,path);if(r==='..'||r.startsWith('../')||isAbsolute(r))throw Error('fake account path outside owned root');return path;};\nconst account=harness==='claude'?{CLAUDE_CONFIG_DIR:owned(process.env.CLAUDE_CONFIG_DIR)}:harness==='codex'?{CODEX_HOME:owned(process.env.CODEX_HOME)}:{};\nconst sealed=fixtureEnvironment(root,process.env,{...account,FAKE_LOGIN_ENABLED:'1',FAKE_LOGIN_HOST:'card-fixture',FAKE_HARNESS_CALL_LOG:${JSON.stringify(join(root,'login-calls.jsonl'))}});\nconst paths=harness==='opencode'?{openCodeDatabase:join(owned(dirname(process.env.OPENCODE_DB)),basename(process.env.OPENCODE_DB))}:{};\nconst env=scratchAccountEnvironment(root,sealed,paths);\nif(!process.execve)throw Error('native execve unavailable');\nprocess.execve(process.execPath,[process.execPath,${JSON.stringify(entry)},...process.argv.slice(2)],env);\n`,{mode:0o700});
 }
 const repo=new URL('../../',import.meta.url).pathname;
 await writeFile(join(bin,'npm'),`#!/bin/sh\nln -s '${repo}node_modules' node_modules\n`,{mode:0o700});
 const env=fixtureEnvironment(root,process.env,{PATH:bin+':'+process.env.PATH,CLAND_FAKE_HOST_ROOT:root,CLAND_SSH_BIN:new URL('./fakes/fake-ssh.ts',import.meta.url).pathname,CLAND_SCP_BIN:new URL('./fakes/fake-scp.ts',import.meta.url).pathname});
 await mkdir(join(root,'.cland'),{recursive:true});
 await writeFile(join(root,'.cland/config.toml'),(options.lease?'[hosts]\nlease="'+options.lease+'"\n':'')+'[hosts.agents]\nprovider="fake"\nsize="fake"\nslots=8\nmin_hosts=0\nregion="fake-1"\n');
 const git=async(...args:string[])=>promisify(execFile)('git',args,{cwd:root,env:fixtureEnvironment(root,env)});
 await git('init','--initial-branch=main');
 await writeFile(join(root,'seed'),'territory seed\n');await git('add','seed');await git('commit','-m','seed');
 await git('clone','--bare',root,join(root,'.cland/territory.git'));
 await git('--git-dir='+join(root,'.cland/territory.git'),'config','cland.managed','true');
 if(options.fakeCodex){const metadata=own(new Store(join(root,'.cland/hub.db')));await readyLogin(root,env,metadata.hosts.logins);}
 if(options.loginRoles)await writeFile(join(root,'.cland/roles.toml'),`[custom.login-worker]
clause="Work."
[custom.login-worker.launch]
pool="agents"
harness="opencode"
[custom.login-source]
clause="Work."
[custom.login-source.launch]
pool="agents"
harness="opencode"
`);
 const hub=await projectHub(t,root,env as Record<string,string>,{...options.cardSignIn,adapters:[...(options.fakeCodex ? [((host:import('../src/adapters/contract.ts').AdapterHost,clock:import('../src/hub/clock.ts').Clock)=>fakeHarness('codex',{host,clock}))] : []),boundary=>new OpenCodeAdapter(boundary,{bin:new URL('./fakes/opencode/opencode',import.meta.url).pathname,env:fixtureEnvironment(root,env),stopGraceMs:50})]});
 const stops=[()=>hub.stop()];
 let safeToRemove=false;
 guardDirectoryRemoval(root,()=>{if(!safeToRemove)throw Error('fixture writer closure unconfirmed; root retained');});
 beforeDirectories(t,async()=>{
  const errors:unknown[]=[],watchdogs:HostWatchdogIdentity[]=[];
  let captured=false,hubsClosed=0;
  try {
   const store=new Store(join(root,'.cland/hub.db'));
   try{for(const row of store.hosts.provisions.list()){const identity=store.hosts.leases.get(row.id)?.watchdog;if(identity)watchdogs.push(identity);}}
   finally{await store.hosts.leases.close();store.close();}
   captured=true;
  }catch(error){errors.push(error);}
  const result=await drainFixtureOwners([
   ...[...stops].reverse().map(stop=>async()=>{await stop();hubsClosed++;}),
   ...watchdogs.map(identity=>()=>stopHostWatchdog(identity,env)),
  ],()=>cleanupOwnedProcesses(fixtureProcessCensus(root)),async()=>{
   const proof=await Promise.allSettled(watchdogs.map(identity=>watchdogStopped(identity,env)));
   await eventually('fixture native children closed',()=>fixtureProcessCensus(root).filter(p=>p.pid!==process.pid).length===0?true:undefined,testWaitMs());
   return captured&&hubsClosed===stops.length&&proof.every(result=>result.status==='fulfilled'&&result.value);
  });
  errors.push(...result.errors);
  if(result.drained)for(const cleanup of [...afterNativeJoin].reverse())try{await cleanup();}catch(error){errors.push(error);}
  safeToRemove=result.drained&&errors.length===0;
  if(errors.length)throw new AggregateError(errors,'fixture drain failed');
 });
 const prepared=await cland(root,'host','prepare','agents');assert.equal(prepared.code,0,prepared.stderr);
 return {root,hub,env,stops,own,beforeStop:(work:()=>Promise<void>)=>beforeStop.push(work),afterNativeJoin:(work:()=>Promise<void>)=>afterNativeJoin.push(work)};
}
