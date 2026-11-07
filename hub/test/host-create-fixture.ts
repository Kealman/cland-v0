// T3: native pinned SSH admission, delivered runtime, supervisor, tunnel and OpenCode lifecycle.
// projectHub owns the hub; beforeDirectories stops it then joins every fixture process before removal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tempProject, projectHub, cland, eventually, testWaitMs } from './harness.ts';
import { beforeDirectories, cleanupOwnedProcesses, fixtureProcessCensus, onCleanup } from './process-cleanup.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { OpenCodeAdapter } from '../src/adapters/opencode.ts';
const SETUP_MS=testWaitMs(60000);
export async function fixture(t:test.TestContext) {
 const root=await tempProject(t,'hc-','/tmp');
 const beforeStop:Array<()=>Promise<void>>=[],handles:Array<()=>unknown>=[];
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
 const repo=new URL('../../',import.meta.url).pathname;
 await writeFile(join(bin,'npm'),`#!/bin/sh\nln -s '${repo}node_modules' node_modules\n`,{mode:0o700});
 const env=fixtureEnvironment(root,process.env,{PATH:bin+':'+process.env.PATH,CLAND_FAKE_HOST_ROOT:root,CLAND_SSH_BIN:new URL('./fakes/fake-ssh.ts',import.meta.url).pathname,CLAND_SCP_BIN:new URL('./fakes/fake-scp.ts',import.meta.url).pathname});
 await mkdir(join(root,'.cland'),{recursive:true});
 await writeFile(join(root,'.cland/config.toml'),'[hosts.agents]\nprovider="fake"\nsize="fake"\nregion="fake-1"\n');
 const git=async(...args:string[])=>promisify(execFile)('git',args,{cwd:root,env:fixtureEnvironment(root,env)});
 await git('init','--initial-branch=main');
 await writeFile(join(root,'seed'),'territory seed\n');await git('add','seed');await git('commit','-m','seed');
 await git('clone','--bare',root,join(root,'.cland/territory.git'));
 await git('--git-dir='+join(root,'.cland/territory.git'),'config','cland.managed','true');
 const hub=await projectHub(t,root,env as Record<string,string>,{adapters:[boundary=>new OpenCodeAdapter(boundary,{bin:new URL('./fakes/opencode/opencode',import.meta.url).pathname,env:fixtureEnvironment(root,env),stopGraceMs:50})]});
 const stops=[()=>hub.stop()];
 beforeDirectories(t,async()=>{for(const stop of stops.reverse())await stop();await cleanupOwnedProcesses(fixtureProcessCensus(root));await eventually('fixture native children closed',()=>fixtureProcessCensus(root).filter(p=>p.pid!==process.pid).length===0?true:undefined,testWaitMs());assert.deepEqual(fixtureProcessCensus(root).filter(p=>p.pid!==process.pid),[]);});
 const prepared=await cland(root,'host','prepare','agents');assert.equal(prepared.code,0,prepared.stderr);
 return {root,hub,env,stops,own,beforeStop:(work:()=>Promise<void>)=>beforeStop.push(work)};
}
