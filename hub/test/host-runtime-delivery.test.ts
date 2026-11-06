// T3: delivered CLI/spoke native processes and dependency installer on a scratch host.
// Lifecycle: TestContext owns native groups; beforeDirectories joins close receipts before owned roots are removed.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, realpath, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, type ExecFileOptionsWithStringEncoding } from 'node:child_process';
import { createHash } from 'node:crypto';
import { beforeDirectories, ownDirectory, ownProcess } from './process-cleanup.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { runtimeBundle, deliverRuntime } from '../src/host/code-delivery.ts';
import { remoteHostLayout, remoteCodeDirectory, remoteSupervisor } from '../src/host/remote-layout.ts';
import { eventually } from './harness.ts';
import { testWaitMs } from './until.ts';
import { VERSION } from '../src/version.ts';
const CLI_VERSION_EXIT_MS=15000;
const INSTALLER_REAP_MS=3000;
const TRANSPORT_SETUP_MS=testWaitMs(45000);
async function exec(t:TestContext,command:string,args:string[],options:ExecFileOptionsWithStringEncoding) {
 // cland-allow-child-env: wrapper receives sealed fixtureEnvironment env from both local callers and adds no environment overlays
 const child=spawn(command,args,{cwd:options.cwd,env:options.env,detached:true,stdio:['ignore','pipe','pipe']});
 let stdout='',stderr='',nativeError:Error|undefined,receipt:{code:number|null;signal:NodeJS.Signals|null}|undefined;
 const closed=new Promise<void>(resolve=>{
  child.once('error',error=>{nativeError=error;});
  child.once('close',(code,signal)=>{receipt={code,signal};resolve();});
 });
 child.stdout.on('data',bytes=>{stdout=(stdout+bytes).slice(-(options.maxBuffer??1024*1024));});
 child.stderr.on('data',bytes=>{stderr=(stderr+bytes).slice(-2000);});
 const stop=ownProcess(t,child.pid);
 let shutdown:Promise<void>|undefined;
 const stopAndJoin=()=>shutdown??=(async()=>{await stop();await eventually('fixture native close receipt',()=>receipt,testWaitMs());})();
 beforeDirectories(t,stopAndJoin);
 let timedOut=false,stopError:unknown;
 const cancel=()=>{void stopAndJoin().catch(error=>{stopError=error;});};
 t.signal.addEventListener('abort',cancel,{once:true});
 const timer=setTimeout(()=>{timedOut=true;cancel();},options.timeout??TRANSPORT_SETUP_MS); // lint-allow-wall-clock: bounded native lifetime; stopAndJoin observes owned closure before fixture removal
 try {
  await closed;
  if(stopError)throw stopError;
  if(nativeError)throw nativeError;
  if(timedOut||t.signal.aborted||receipt!.code!==0)throw Error(`native command incomplete: exit=${receipt!.code} signal=${receipt!.signal} timeout=${timedOut} ${stderr}`);
  return {stdout,stderr};
 }finally{clearTimeout(timer);t.signal.removeEventListener('abort',cancel);await stopAndJoin();}
}
test('C1-C3 whole runtime delivery verifies files, reuses digest and atomically replaces CLI and spoke', {timeout: testWaitMs(60000)}, async t => {
 const root = await mkdtemp(join(tmpdir(),'runtime-delivery-'));
 ownDirectory(t,root);
 const bin=join(root,'bin'); await mkdir(bin);
 const repo=new URL('../../',import.meta.url).pathname;
 // Scripted dependency installer: native runtime imports resolve the installed test dependencies.
 const npm=join(bin,'npm');
 await writeFile(npm,`#!/bin/sh\nprintf '%s\\n' "$*" >> '${root}/npm-calls'\nif [ -f '${root}/fail-npm' ]; then exit 9; fi\nln -s '${repo}node_modules' node_modules\n`,{mode:0o700});
 const env=fixtureEnvironment(root,process.env,{PATH:bin+':'+process.env.PATH});
 const transport={copyFile:async(a:string,b:string)=>{copies++;await copyFile(a,b);},execute:async(script:string)=>{await exec(t,'sh',['-c',script],{cwd:root,env,encoding:'utf8',timeout:TRANSPORT_SETUP_MS,maxBuffer:1024*1024});}};
 let copies=0;
 const bundle=await runtimeBundle(VERSION);
 const codeRoot=join(root,'home/.cland-host/code');
 await deliverRuntime({transport,codeRoot,node:process.execPath,version:VERSION,bundle});
 const target=join(codeRoot,VERSION), first=await realpath(target);
 const manifest=JSON.parse(await readFile(join(target,'runtime-manifest.json'),'utf8'));
 assert.equal(manifest.version,VERSION);
 assert.deepEqual(manifest.files,bundle.files.map(({path,sha256})=>({path,sha256})));
 const layout=remoteHostLayout(join(root,'home'));
 assert.equal(remoteCodeDirectory(layout),target);
 assert.equal(await realpath(remoteSupervisor(layout)),join(first,'hub/src/host/agent/supervisor.sh'));
 for(const path of ['hub/bin/cland.ts','hub/bin/cland-spoke.ts','hub/mod/cland/.claude-plugin/plugin.json']) assert.ok(bundle.files.some(f=>f.path===path),path);
 for(const file of bundle.files) assert.equal(createHash('sha256').update(await readFile(join(target,file.path))).digest('hex'),file.sha256,file.path);
 for(const entry of ['cland.ts','cland-spoke.ts']) {
  const result=await exec(t,process.execPath,[join(target,'hub/bin',entry),'--version'],{cwd:root,env,encoding:'utf8',timeout:CLI_VERSION_EXIT_MS});
  assert.equal(result.stdout.trim(),VERSION);
 }
 assert.equal((await readFile(join(root,'npm-calls'),'utf8')).trim(),'ci -w hub --omit=dev --ignore-scripts');
 await deliverRuntime({transport,codeRoot,node:process.execPath,version:VERSION,bundle});
 assert.equal(copies,1); assert.equal(await realpath(target),first);
 const bytes=Buffer.from('// changed runtime\n');
 const changed={...bundle,files:[...bundle.files,{path:'shared/delivery-marker.ts',sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.toString('base64')}]};
 const broken={...changed,files:changed.files.map(f=>f.path==='shared/delivery-marker.ts'?{...f,sha256:'bad'}:f)};
 await assert.rejects(deliverRuntime({transport,codeRoot,node:process.execPath,version:VERSION,bundle:broken}));
 assert.equal(await realpath(target),first);
 await writeFile(join(root,'fail-npm'),'fail');
 await assert.rejects(deliverRuntime({transport,codeRoot,node:process.execPath,version:VERSION,bundle:changed}));
 assert.equal(await realpath(target),first,'dependency failure leaves old version selected');
 await unlink(join(root,'fail-npm'));
 await deliverRuntime({transport,codeRoot,node:process.execPath,version:VERSION,bundle:changed});
 assert.notEqual(await realpath(target),first);
 assert.equal(await readFile(join(target,'shared/delivery-marker.ts'),'utf8'),'// changed runtime\n');
 assert.equal(await readFile(join(first,'hub/bin/cland.ts'),'utf8'),await readFile(join(target,'hub/bin/cland.ts'),'utf8'),'old readers retain complete tree');
});

test('held installer fixture teardown joins writer before removing its root',{timeout:testWaitMs(60000)},async t=>{
 const outer=await mkdtemp(join(tmpdir(),'runtime-cancel-'));ownDirectory(t,outer);
 const ready=join(outer,'installer-ready'),stopped=join(outer,'installer-stopped');
 let installerPid:number|undefined;
 let delivery:Promise<void>|undefined,stopInstaller:(()=>Promise<void>)|undefined;
 beforeDirectories(t,async()=>{await delivery?.catch(()=>{});});
 await t.test('fixture scope ends with installer held',async fixture=>{
  const root=join(outer,'host');await mkdir(root);
  ownDirectory(fixture,root,{beforeRemove:async()=>{
   const receipt=await eventually('installer native ESRCH receipt before root removal',()=>{
    if(!installerPid)return undefined;
    try{process.kill(installerPid,0);return undefined;}catch(error){if((error as NodeJS.ErrnoException).code==='ESRCH')return {code:'ESRCH'};throw error;}
   },INSTALLER_REAP_MS);
   assert.deepEqual(receipt,{code:'ESRCH'});await writeFile(stopped,'closed');
  }});
  const bin=join(root,'bin');await mkdir(bin);
  await writeFile(join(bin,'npm'),`#!${process.execPath}\nconst fs=require('node:fs');const timer=setInterval(()=>fs.writeFileSync(${JSON.stringify(join(root,'heartbeat'))},'writing'),20);process.on('SIGTERM',()=>{clearInterval(timer);fs.writeFileSync(${JSON.stringify(stopped)},'closed');process.exit(0);});fs.writeFileSync(${JSON.stringify(ready)},JSON.stringify({pid:process.pid}));\n`,{mode:0o700});
  const env=fixtureEnvironment(root,process.env,{PATH:bin+':'+process.env.PATH});
  const transport={copyFile,execute:async(script:string)=>{await exec(fixture,'sh',['-c',script],{cwd:root,env,encoding:'utf8',timeout:TRANSPORT_SETUP_MS});}};
  delivery=deliverRuntime({transport,node:process.execPath,codeRoot:join(root,'code'),version:VERSION});
  void delivery.catch(()=>{});
  const receipt=await eventually('held npm installer native receipt',async()=>{try{return JSON.parse(await readFile(ready,'utf8')) as {pid:number};}catch{return undefined;}},testWaitMs());
  installerPid=receipt.pid;stopInstaller=ownProcess(t,receipt.pid); // outer emergency owner also joins the red-control writer
  // Returning tears down the fixture while delivery is pending: teardown must cancel it.
 });
 await stopInstaller?.();
 await assert.rejects(delivery!);
 await assert.rejects(readFile(join(outer,'host/heartbeat')), {code:'ENOENT'});
 assert.equal(await readFile(stopped,'utf8'),'closed');
});
