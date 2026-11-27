// T2: actual scheduler callbacks on owned SQLite/filesystem state; executors are fake.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { join } from 'node:path';
import { retentionCase } from './suite-retention-fixture.ts';
import type { SuiteJob } from '../src/hub/suites.ts';
import { heartbeatDigest } from '../src/hub/heartbeat.ts';
import { testSetupWaitMs } from './until.ts';

async function seeded(scope: ReturnType<typeof retentionCase>, step: <T>(work:()=>Promise<T>)=>Promise<T>, evidence?: Partial<SuiteJob>, passLimit?: number) {
  return scope.wait('complete scheduler seeded setup',async()=>{
  const f = await step(() => scope.unit({machineReceiptsOnly:true, ...(passLimit===undefined?{}:{suiteRetentionPassLimit:passLimit})}));
  const run = await step(() => f.launch({fresh:true}));
  await step(() => f.finish(run.id));
  const template = (await f.jobs())[0]!;
  await fs.mkdir(join(f.root,'.cland/artifacts'),{recursive:true});
  const log = join(f.root,'.cland/artifacts/log');
  await fs.writeFile(log,'durable receipt');
  f.store.updateArtifact({...f.store.artifact(template.artifact!)!,path:log});
  f.store.transaction(() => {
    for(let i=0;i<2048;i++) f.store.registerArtifact(id=>({id,title:`unrelated-${i}`,kind:'file',path:log,creator:'hub',time:f.clock.now().toISOString(),topic:'other',status:'shared'}),()=>{});
  });
  const jobs: SuiteJob[]=[];
  for(let i=0;i<22;i++) {
    const id=`retention-${i}`, directory=join(f.root,'.cland/run/suites',id);
    await fs.mkdir(directory,{recursive:true});
    jobs.push({...template,id,sequence:i,log:join(directory,'suite.log'),result:join(directory,'result.json'),gate:join(directory,'ready'),completedAt:new Date(f.clock.now().getTime()-8*86400000).toISOString(),...(i===0?evidence:{})});
  }
  await step(() => f.reopen(jobs));
  return {f,log};
  },testSetupWaitMs());
}

test('idle scheduler continues bounded retention passes without suite launches', t => {
  const scope=retentionCase(t,undefined,{timeoutMs:testSetupWaitMs()});
  return scope.run(async step=>{
    const {f}=await seeded(scope,step,undefined,1);
    f.logs.length=0;
    const report=(count:number)=>f.when(()=>{
      const reports=f.logs.filter(row=>row.event==='suite-retention-report');
      return reports.length>=count?reports[count-1]:undefined;
    });
    const first=report(1);
    f.suites.startRetention();
    assert.equal((await scope.wait('first bounded pass',()=>first,testSetupWaitMs())).removed,1);
    const second=report(2);
    await f.clock.advance(120000);
    assert.equal((await scope.wait('scheduled bounded pass',()=>second,testSetupWaitMs())).removed,2);
    assert.equal(f.logs.filter(row=>row.event==='suite-retention-start').length,2);
    for(const row of f.logs.filter(row=>row.event==='suite-retention-report')) {
      assert.ok((row.unindexed as {scanned:number}).scanned<=1);
    }
    assert.equal((await fs.readdir(join(f.root,'.cland/run/suites'))).filter(id=>id.startsWith('retention-')).length,20);
    for(let count=3;count<=24;count++) {
      const next=report(count);
      await f.clock.advance(120000);
      const row=await scope.wait('scheduled directory discovery receipt',()=>next,testSetupWaitMs());
      assert.ok((row.unindexed as {scanned:number}).scanned<=1);
      if(!(row.unindexed as {continuing:boolean}).continuing)break;
    }
    const progress=JSON.parse(f.store.meta('suite-retention-progress')!);
    assert.equal(progress.backlog,0);
    assert.equal(progress.unindexed.continuing,false,'bounded scheduled passes reach directory EOF');
    const digest=heartbeatDigest(f.store,[],1000,f.clock.now().getTime(),0,1000);
    assert.match(digest.text,/indexed backlog 0 .*removed 2/);
    assert.match(digest.text,/discovery complete/);
  });
});

test('scheduler live retention uses bounded indexed lookups and guarded deletion', t => {
  const scope=retentionCase(t);
  return scope.run(async step=>{
    const {f}=await seeded(scope,step);
    scope.patch(f.store,'artifactIndex',()=>assert.fail('retention decoded global artifact history'));
    const lookup=f.store.artifactByTitle.bind(f.store);
    let lookups=0;
    const link=fs.link;
    let batchLinks=0;
    scope.patch(fs,'link',async(...args:Parameters<typeof link>)=>{batchLinks++;return Reflect.apply(link,fs,args);});
    scope.patch(f.store,'artifactByTitle',(...args:Parameters<typeof lookup>)=>{lookups++;return lookup(...args);});
    const observed=f.when(()=>f.logs.find(row=>row.event==='suite-retention-report'));
    f.suites.startRetention();
    const report=await scope.wait('scheduler report receipt',()=>observed);
    await f.suites.settled();
    assert.equal(report.mode,'live');
    assert.equal(typeof report.durationMs,'number','the serving owner reports the full admitted pass wall time');
    assert.equal(report.total,22);
    assert.equal(report.wouldRetire,2);
    assert.equal(report.kept,20);
    assert.equal(report.removed,2);
    assert.equal(batchLinks,3,'one shared durable claim link and two requirement links for two retirements');
    assert.equal(lookups,2,'two candidates visit one indexed coverage row each, independent of 2048 unrelated artifacts');
    assert.equal((await fs.readdir(join(f.root,'.cland/run/suites'))).filter(id=>id.startsWith('retention-')).length,20);
  });
});

for(const [kind,evidence] of Object.entries({
  integrated:{integrated:true}, batch:{batch:{id:'preserved-batch',members:[]}},
  cover:{cover:{status:'green',cause:null,tests:[]}}, probe:{devT3Probe:{key:'preserved-probe',files:[]}},
} satisfies Record<string,Partial<SuiteJob>>)) test(`scheduler live retention conservatively preserves old ${kind} evidence`,t=>{
  const scope=retentionCase(t);
  return scope.run(async step=>{
    const {f}=await seeded(scope,step,evidence);
    const observed=f.when(()=>f.logs.find(row=>row.event==='suite-retention-report'));
    f.suites.startRetention();
    const report=await scope.wait('conservative evidence classification receipt',()=>observed);
    assert.equal(report.wouldRetire,1);
    assert.equal(report.kept,21);
    assert.equal(report.removed,1);
    assert.equal((await fs.readdir(join(f.root,'.cland/run/suites'))).filter(id=>id.startsWith('retention-')).length,21);
    assert.equal((await fs.stat(join(f.root,'.cland/run/suites/retention-0'))).isDirectory(),true);
  });
});

test('scheduler close joins retained filesystem work after an earlier cleanup rejection', t => {
  const release=Promise.withResolvers<void>();
  const scope=retentionCase(t,()=>release.resolve(),{timeoutMs:testSetupWaitMs()});
  return scope.run(async step=>{
    const {f,log}=await seeded(scope,step);
    const entered=Promise.withResolvers<void>(), failed=Promise.withResolvers<void>();
    const original=fs.realpath;
    let hold=true;
    scope.patch(fs,'realpath',async (...args:Parameters<typeof original>)=>{
      if(args[0]===log&&hold){hold=false;entered.resolve();await release.promise;}
      return Reflect.apply(original,fs,args);
    });
    f.suites.startRetention();
    await scope.wait('retention filesystem admission',()=>entered.promise,testSetupWaitMs());
    const starts=f.logs.filter(row=>row.event==='suite-retention-start').length;
    f.suites.startRetention();
    await f.clock.advance(600000);
    f.suites.startRetention();
    assert.equal(f.logs.filter(row=>row.event==='suite-retention-start').length,starts,'held filesystem work excludes launch and scheduled overlap');
    const clear=f.clock.clearInterval.bind(f.clock), failure=new Error('planted earlier close rejection');
    let reject=true;
    scope.patch(f.clock,'clearInterval',(...args:Parameters<typeof clear>)=>{
      if(reject){reject=false;failed.resolve();throw failure;}
      return clear(...args);
    });
    let closed=false;
    const closing=f.suites.close().then(()=>{closed=true;return null;},error=>{closed=true;return error;});
    await scope.wait('earlier close rejection receipt',()=>failed.promise,testSetupWaitMs());
    assert.equal(closed,false,'close cannot settle before its admitted filesystem owner');
    release.resolve();
    assert.equal(await scope.wait('close joined retention and preserved failure',()=>closing,testSetupWaitMs()),failure);
    assert.equal(closed,true);
    await f.clock.advance(600000);
    assert.equal(f.logs.filter(row=>row.event==='suite-retention-start').length,starts,'closed scheduler admits no timer work');
    assert.equal((await fs.readdir(join(f.root,'.cland/run/suites'))).filter(id=>id.startsWith('retention-')).length,22);
  });
});
