// T2: real cleanup admission, retained roots/seams and positive writer closure.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import cp from 'node:child_process';
import { join } from 'node:path';
import { retentionCase } from './suite-retention-fixture.ts';
import { afterCleanup } from './process-cleanup.ts';

test('rejected resource closure retains the root and installed controls until repair joins its writer', t=>{
  const release=Promise.withResolvers<void>();
  const originalSpawn=cp.spawn,originalWrite=fs.writeFile;
  let root='', installedSpawn:typeof cp.spawn,installedWrite:typeof fs.writeFile;
  let fail=true,independentClosed=false,writerClosed=false,seamWrites=0;
  const scope=retentionCase(t,()=>release.resolve(),{onIncomplete:async(error,repair)=>{
    assert.match(String(error),/retention resources unconfirmed/);
    assert.equal(independentClosed,true,'independent cleanup still runs after another close rejects');
    await assert.rejects(repair.removeOwnedRoot(root),/resource closure unconfirmed; retention root kept/);
    assert.equal(await fs.readFile(join(root,'kept'),'utf8'),'retained root receipt');
    assert.equal(cp.spawn,installedSpawn,'the positively controlled launch guard is still installed');
    assert.equal(fs.writeFile,installedWrite,'the owned filesystem seam is still installed');
    assert.throws(repair.releaseSeams,/resource closure unconfirmed; fixture seams and native guard retained/);
    assert.equal(writerClosed,false);
    fail=false;release.resolve();
    await repair.finishCleanup();
    assert.equal(writerClosed,true,'writer native filesystem completion was observed before root removal');
    assert.equal(seamWrites,1,'the retained seam observed the late writer');
    await assert.rejects(fs.stat(root),{code:'ENOENT'});
    assert.throws(repair.releaseSeams,/resource closure unconfirmed; fixture seams and native guard retained/,'repair continuation must also join');
    assert.equal(cp.spawn,installedSpawn);
    assert.equal(fs.writeFile,installedWrite);
  }});
  afterCleanup(t,async()=>{
    assert.equal(cp.spawn,originalSpawn);
    assert.equal(fs.writeFile,originalWrite);
    await assert.rejects(fs.stat(root),{code:'ENOENT'});
  });
  return scope.run(async step=>{
    const f=await step(()=>scope.unit({machineReceiptsOnly:true}));root=f.root;
    await fs.writeFile(join(root,'kept'),'retained root receipt');
    const write=fs.writeFile;
    scope.patch(fs,'writeFile',(...args:Parameters<typeof write>)=>{if(args[0]===join(root,'writer'))seamWrites++;return Reflect.apply(write,fs,args);});
    installedSpawn=cp.spawn;installedWrite=fs.writeFile;
    const writer=(async()=>{await release.promise;await fs.writeFile(join(root,'writer'),'writer completion receipt');})();
    scope.cleanup(async()=>{independentClosed=true;});
    scope.cleanup(async()=>{if(fail)throw new Error('planted resource close rejection');await writer;writerClosed=true;});
  });
});
