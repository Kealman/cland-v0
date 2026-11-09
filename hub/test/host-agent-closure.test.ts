// T1: source-only closure regeneration and installed-startup import census; no processes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { generateAgentClosure } from '../bin/generate-host-agent-closure.ts';
import { runtimePath } from '../src/host/agent/package.ts';
test('closure admits exactly the two owner-bound neutral leaves and refuses their extra imports',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'agent-leaves-'));
 const put=async(path:string,source:string)=>{const target=resolve(root,path);await mkdir(dirname(target),{recursive:true});await writeFile(target,source);};
 const entry='hub/src/host/agent/entry.ts';
 try {
  await put(entry,"import './clock.ts';import './fake-layout.ts';");
  await put('shared/unapproved.ts','export const value=1;');
  await put('shared/executor-credentials.ts','export const value=1;');
  await put('hub/src/host/agent/server.ts','export const value=1;');
  for(const name of ['clock','fake-layout']) {
   await put(`hub/src/host/agent/${name}.ts`,`export * from '../../../../shared/${name}.ts';`);
   await put(`shared/${name}.ts`,'export const value=1;');
  }
  const closure=await generateAgentClosure(root);
  assert.deepEqual(closure.files.map(row=>row.path).sort(),[entry,'hub/src/host/agent/clock.ts','hub/src/host/agent/fake-layout.ts','shared/clock.ts','shared/fake-layout.ts'].sort());
  for(const name of ['clock','fake-layout']) {
   assert.equal(runtimePath(`shared/${name}.ts`),true);
   assert.equal(runtimePath(`shared/${name}-extra.ts`),false);
   for(const spec of ['./unapproved.ts','../hub/src/host/agent/server.ts','./executor-credentials.ts',name==='clock'?'./fake-layout.ts':'./clock.ts']) {
    await put(`shared/${name}.ts`,`import '${spec}';`);
    await assert.rejects(generateAgentClosure(root),/agent source escapes runtime boundary/);
   }
   await put(`shared/${name}.ts`,'export const value=1;');
   await put(`shared/${name}-extra.ts`,'export const value=1;');
   await put(`hub/src/host/agent/${name}.ts`,`export * from '../../../../shared/${name}-extra.ts';`);
   await assert.rejects(generateAgentClosure(root),/agent source escapes runtime boundary/);
   await put(`hub/src/host/agent/${name}.ts`,`export * from '../../../../shared/${name}.ts';`);
   await put(entry,`import '../../../../shared/${name}.ts';`);
   await assert.rejects(generateAgentClosure(root),/agent source escapes runtime boundary/);
   await put(entry,"import './clock.ts';import './fake-layout.ts';");
  }
 } finally {await rm(root,{recursive:true,force:true});}
});
test('committed agent closure matches the complete source and native asset graph',async()=>{
 const actual=await generateAgentClosure();
 const committed=JSON.parse(await readFile(new URL('../src/host/agent/closure.json',import.meta.url),'utf8'));
 assert.deepEqual(committed,actual,'run node hub/bin/generate-host-agent-closure.ts');
 assert.ok(actual.files.some(file=>file.path.endsWith('/bootstrap.ts')));
 assert.ok(actual.files.some(file=>file.path.endsWith('/supervisor.sh')));
});
test('host registry startup imports no development-only package',async()=>{
 const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
 const devOnly=new Set(Object.keys(pkg.devDependencies).filter(key=>!Object.hasOwn(pkg.dependencies,key)));
 const seen=new Set<string>();
 async function visit(path:string){
  if(seen.has(path))return;seen.add(path);
  const source=ts.createSourceFile(path,await readFile(path,'utf8'),ts.ScriptTarget.Latest,true);
  for(const node of source.statements){
   if(!ts.isImportDeclaration(node)&&!ts.isExportDeclaration(node))continue;
   if(ts.isImportDeclaration(node)&&node.importClause?.isTypeOnly)continue;
   if(ts.isExportDeclaration(node)&&node.isTypeOnly)continue;
   if(!node.moduleSpecifier||!ts.isStringLiteral(node.moduleSpecifier))continue;
   const spec=node.moduleSpecifier.text;
   const name=spec.startsWith('@')?spec.split('/').slice(0,2).join('/'):spec.split('/')[0]!;
   assert.ok(!devOnly.has(name),`${path}: startup imports ${name}`);
   if(spec.startsWith('.')&&spec.endsWith('.ts'))await visit(resolve(dirname(path),spec));
  }
 }
 await visit(fileURLToPath(new URL('../src/host/registry.ts',import.meta.url)));
});

import { signalAgentChild } from '../src/host/agent/restart.ts';
test('restart requires exact fresh native birth and refuses reused or inherited PID authority',async()=>{
 const sent:number[]=[];
 const signal=(pid:number)=>{sent.push(pid);};
 const birth='linux:11111111-1111-1111-1111-111111111111:100';
 assert.equal(await signalAgentChild(123,birth,{},async()=>({identity:birth,ended:false}),signal),true);
 assert.deepEqual(sent,[123]);sent.length=0;
 for(const observation of [{identity:birth.replace(':100',':101'),ended:false},{identity:null,ended:false},{identity:null,ended:true}]){
  assert.equal(await signalAgentChild(123,birth,{},async()=>observation,signal),false);
 }
 assert.equal(await signalAgentChild(123,'',{},async()=>({identity:birth,ended:false}),signal),false);
 assert.deepEqual(sent,[]);
});

import { restoreAdoptedWorkers } from '../src/host/agent-client.ts';
import { CLAUDE_RESTORE_CAPABILITY } from '../src/host/agent/claude.ts';
test('recovery handshake preserves previous hello shape and gates the additive restore operation',async()=>{
 const requests:unknown[]=[];
 const hello={protocol:1,version:'old',pid:123,bootId:'original'};
 const request=async(...args:unknown[])=>{requests.push(args);return null;};
 await restoreAdoptedWorkers({hello,request});assert.deepEqual(requests,[]);
 let report:unknown;await restoreAdoptedWorkers({hello:{...hello,capabilities:[CLAUDE_RESTORE_CAPABILITY]},request},value=>{report=value;});
 assert.equal(report,null,'older null report remains unknown, never zero incomplete');
 assert.deepEqual(requests,[['restore-claude',{report:true}]]);
});
