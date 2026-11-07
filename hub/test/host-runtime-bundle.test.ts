// T1: runtime source manifest and whitelist; no processes or services.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runtimeBundle } from '../src/host/code-delivery.ts';
import { createHash } from 'node:crypto';
import { VERSION } from '../src/version.ts';
test('runtime manifest carries the hub lock, CLI, spoke and Claude mod with verified digests', async()=>{
 const bundle=await runtimeBundle(VERSION);
 for(const path of ['package.json','package-lock.json','hub/package.json','hub/bin/cland.ts','hub/bin/cland-spoke.ts','hub/mod/cland/.claude-plugin/plugin.json','hub/src/host/cland-auth.sh'])assert.ok(bundle.files.some(f=>f.path===path),path);
 assert.equal(new Set(bundle.files.map(f=>f.path)).size,bundle.files.length);
 for(const f of bundle.files){
  assert.equal(f.sha256,createHash('sha256').update(await readFile(new URL('../../'+f.path,import.meta.url))).digest('hex'));
  assert.equal(createHash('sha256').update(Buffer.from(f.bytes,'base64')).digest('hex'),f.sha256);
  assert.ok(!/(?:^|\/)(?:node_modules|test|\.env|\.cland)(?:\/|$)/.test(f.path));
 }
});

import { mkdtemp, mkdir, copyFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deliverRuntime } from '../src/host/code-delivery.ts';
for(const cleanupConfirmed of [true,false]) test(`upload abort ${cleanupConfirmed?'reclaims joined input':'retains input identity on incomplete cleanup'}`,async t=>{
 const root=await mkdtemp(join(tmpdir(),'runtime-upload-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const codeRoot=join(root,'code'),controller=new AbortController();
 let input='',joined=false,executions=0;
 const transport={copyFile:async(source:string,destination:string)=>{
  input=destination;await copyFile(source,destination);joined=true;controller.abort();
 },execute:async(script:string)=>{
  if(++executions===1){await mkdir(codeRoot);throw Error('cache miss');}
  assert.ok(joined,'copy writer joined before cleanup');assert.ok(script.includes(input),'cleanup pins exact uploaded input');
  if(!cleanupConfirmed)throw Error('transport unavailable');
  await rm(input);
 }};
 await assert.rejects(deliverRuntime({transport,codeRoot,node:'node',version:VERSION,bundle:{version:VERSION,files:[]},signal:controller.signal}),error=>{
  if(!cleanupConfirmed){assert.equal((error as {name:string}).name,'RuntimeDeliveryIncomplete');assert.equal((error as {remoteInput:string}).remoteInput,input);}
  return true;
 });
 assert.equal(executions,2,'cleanup was attempted');
 assert.deepEqual(await readdir(codeRoot),cleanupConfirmed?[]:[input.split('/').at(-1)]);
});
