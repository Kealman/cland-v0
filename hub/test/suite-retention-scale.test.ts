// T4: 50,000 owned directory entries exercise disk-scale retention, not process lifecycle.
// Setup is one owned pass; production retirement supplies its real durability IO.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, utimesSync } from 'node:fs';
import { mkdir, writeFile, readdir, readFile, opendir, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import { SuiteRetention } from '../src/suite-retention.ts';
import { pinSuiteRun } from '../src/suite-reference-pins.ts';
import { projectHub, tempProject, connectUi } from './harness.ts';
import { guardDirectoryRemoval } from './process-cleanup.ts';
import { retentionCase } from './suite-retention-fixture.ts';
import type { SuiteJob } from '../src/hub/suites.ts';
import { testWaitMs, waitTimeoutMs } from './until.ts';

test('live unindexed scheduler pass stays responsive across fifty thousand directories',t=>{
  let hub:Awaited<ReturnType<typeof projectHub>>|undefined,stopping:Promise<void>|undefined;
  const stop=()=>{if(hub)stopping??=hub.stop();return stopping;};
  const scope=retentionCase(t,()=>{void stop()?.catch(()=>{});},{timeoutMs:waitTimeoutMs(testWaitMs(120_000))});
  return scope.run(async step=>{
    scope.cleanup(async()=>{await stop();});
    const {suites,pinned,young,fresh,firstBoundary,finished,removed,ui,item,isComplete}=await scope.wait('live unindexed setup',async()=>{
      const root=await step(async()=>{const root=await tempProject(scope.fixtures,'cland-unindexed-scale-');scope.adoptRoot(root);return root;});
      const suites=join(root,'.cland/run/suites');
      await mkdir(suites,{recursive:true});
      const old=new Date(Date.now()-8*86400000);
      for(let start=0;start<50000;start+=32){
        await step(()=>new Promise<void>(resolve=>setImmediate(resolve)));
        await step(async()=>{
          for(let index=start;index<Math.min(start+32,50000);index++){
            const path=join(suites,`run-${index}`);mkdirSync(path);utimesSync(path,old,old);
          }
        });
      }
      const cursor=await opendir(suites,{bufferSize:32});
      const controls:string[]=[];
      try {for(let index=0;index<3;index++)controls.push((await cursor.read())!.name);}finally{await cursor.close();}
      const [pinned,young,fresh]=controls as [string,string,string];
      for(const id of controls)await writeFile(join(suites,id,'kept'),'control bytes');
      await utimes(join(suites,pinned,'kept'),old,old);await utimes(join(suites,pinned),old,old);
      await utimes(join(suites,fresh),old,old);
      await pinSuiteRun(root,pinned);
      const first=Promise.withResolvers<void>(),finished=Promise.withResolvers<Record<string,unknown>>();
      const firstBoundary=Promise.race([first.promise,finished.promise.then(()=>{throw new Error('unindexed pass completed without a removal receipt');})]);
      void firstBoundary.catch(()=>{});
      const removed=new Set<string>();let complete=false;
      const log=(entry:Record<string,unknown>)=>{
        if(entry.event==='suite-retention'&&entry.removed===true){removed.add(String(entry.id));first.resolve();}
        if(entry.event==='suite-retention-report'){complete=true;finished.resolve(entry);}
        if(entry.event==='suite-retention-incomplete')finished.reject(new Error(`unindexed pass incomplete: ${String(entry.error)}`));
      };
      hub=await step(()=>projectHub(scope.fixtures,root,{}, {log}));
      const ui=await step(()=>connectUi(scope.fixtures,hub!.discovery));
      const created=await ui.request({type:'task.create',size:'S',title:'Live unindexed scale receipt'});
      assert.equal(created.ok,true);
      const item=(created.value as {item:{id:string}}).item.id;
      return {suites,pinned,young,fresh,firstBoundary,finished,removed,ui,item,isComplete:()=>complete};
    });
    await scope.wait('first actual unindexed removal receipt',()=>firstBoundary);
    assert.equal(isComplete(),false);
    const started=performance.now();
    const reply=await ui.request({type:'task.view',item},1000);
    const taskViewMs=performance.now()-started;
    assert.equal(reply.ok,true);
    assert.equal((reply.value as {item:{title:string}}).item.title,'Live unindexed scale receipt');
    assert.ok(taskViewMs<1000,`task.view during unindexed removal took ${taskViewMs} ms`); // lint-allow-wall-clock: real focused socket liveness receipt during the actual serving owner's admitted live unindexed pass, setup excluded.
    assert.equal(isComplete(),false);
    const report=await scope.wait('actual unindexed pass completion receipt',()=>finished.promise);
    const unindexed=report.unindexed as {mode:string;scanned:number;removed:number;wouldRetire:number;reasons:Record<string,number>};
    assert.equal(unindexed.mode,'live');
    assert.equal(unindexed.scanned,4096);
    assert.equal(unindexed.removed,4093);
    assert.equal(removed.size,4093);
    assert.equal(unindexed.wouldRetire,4093);
    assert.equal(unindexed.reasons.pin,1);assert.equal(unindexed.reasons['age-floor'],2);
    const remaining=await readdir(suites);
    assert.equal(remaining.length,50000-4093);
    assert.equal(remaining.some(id=>removed.has(id)),false);
    for(const id of [pinned,young,fresh])assert.equal(await readFile(join(suites,id,'kept'),'utf8'),'control bytes');
    assert.equal(typeof report.durationMs,'number');
    t.diagnostic(JSON.stringify({platform:process.platform,executor:'actual local scheduler; fake native/provider boundaries',roots:50000,scanned:4096,removed:4093,filesRemoved:0,passWallMs:report.durationMs,taskViewMs,boundMs:1000,setupExcluded:true}));
  });
});

test('live mode retires eligible runs in bounded passes over fifty thousand directories while serving task views', t => {
  let stopped = false;
  const largeRootTeardownMs=waitTimeoutMs(testWaitMs(120_000));
  const scope=retentionCase(t,()=>{stopped=true;},{timeoutMs:largeRootTeardownMs});
  return scope.run(async step=>{
  const root = await step(async()=>{const root=await tempProject(scope.fixtures,'cland-retention-scale-');scope.adoptRoot(root);return root;});
  const suites = join(root, '.cland/run/suites');
  await mkdir(suites, { recursive: true });
  await mkdir(join(root, '.cland/artifacts'), { recursive: true });
  const artifact = join(root, '.cland/artifacts/A-1-log');
  await writeFile(artifact, 'durable receipt');
  const sweep = new SuiteRetention(root, 2, {remove:true,passLimit:4096});
  for (let sequence = 0; sequence < 50_000; sequence++) {
    const id = `run-${sequence}`;
    mkdirSync(join(suites, id));
    sweep.remember({ id, sequence, completedAt:new Date(Date.now()-(sequence===4?0:8*86400000)).toISOString(), occasion: sequence % 2 ? 'stage' : 'task', state: 'finished', cleaned: true, reported: true });
  }
  await writeFile(join(suites, 'run-0/kept'), 'referenced run');
  await pinSuiteRun(root,'run-3');
  const referenced = (id: string) => id === 'run-0' || id === 'run-1';
  const artifacts = (id: string) => id === 'run-2' ? [join(root, '.cland/artifacts/missing')] : [artifact];
  const hub = await step(()=>projectHub(scope.fixtures, root));
  const ui = await step(()=>connectUi(scope.fixtures, hub.discovery));
  const created = await ui.request({ type: 'task.create', size: 'M', title: 'Retention liveness receipt' });
  assert.equal(created.ok, true);
  const item = (created.value as { item: { id: string } }).item.id;
  let removed = 0, wouldRetire = 0;
  const firstRemoval = Promise.withResolvers<void>();
  let finished = false;
  const receipt = (_id: string, done: boolean, error?: unknown, decision?: string) => { assert.equal(error, undefined); if(done) {removed++;firstRemoval.resolve();} if(decision==='would-retire'){wouldRetire++;firstRemoval.resolve();} };
  const passes:Array<{wallMs:number;removed:number;filesRemoved:number}>=[];
  const pass=async()=>{const before=removed,started=performance.now();await sweep.drain(referenced,artifacts,receipt,()=>stopped);passes.push({wallMs:performance.now()-started,removed:removed-before,filesRemoved:0});};
  let work = pass().finally(() => { finished = true; });
  scope.cleanup(()=>sweep.close());
  guardDirectoryRemoval(root, async () => { stopped = true; await work; });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([firstRemoval.promise, work.then(() => { throw new Error('drain finished without a removal receipt'); }), new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('first removal receipt missing after 5000 ms')), 5000); })]); // lint-allow-wall-clock: separately bound setup on the first durable removal receipt, with drain joined before fixture removal.
  } finally { clearTimeout(timer); }
  assert.equal(finished, false);
  const started = performance.now();
  const reply = await ui.request({ type: 'task.view', item }, 1000);
  const latency = performance.now() - started;
  assert.equal(reply.ok, true);
  assert.equal((reply.value as { item: { title: string } }).item.title, 'Retention liveness receipt');
  assert.ok(latency < 1000, `task.view receipt ${latency} ms exceeds 1000 ms during retention`); // lint-allow-wall-clock: Coordinator-required real socket liveness bound while the large retention drain remains active.
  assert.equal(finished, false);
  t.diagnostic(`task.view during 50,000-run background drain: ${latency.toFixed(1)} ms; bound 1000 ms; setup excluded`);
  await work;
  assert.equal(removed,4091,'4096 candidates minus two references, one missing artifact, one pin and one young run');
  t.diagnostic(JSON.stringify({platform:process.platform,executor:'local fake root',passes,taskViewMs:latency,boundMs:1000,setupExcluded:true}));
  const expected = Array.from({length:50000},(_,i)=>i).filter(i=>i<5||i>=4096).map(i=>`run-${i}`).sort();
  assert.deepEqual((await readdir(suites)).sort(), expected);
  assert.equal(removed, 4091);
  assert.equal(sweep.snapshot().wouldRetire, 4091);
  assert.equal(sweep.snapshot().kept,9);
  assert.equal(await readFile(join(suites, 'run-0/kept'), 'utf8'), 'referenced run');
  assert.equal(await readFile(artifact, 'utf8'), 'durable receipt');
  });
});

test('actual scheduler retention stays responsive beside fifty thousand artifact records', t=>{
  const scope=retentionCase(t);
  return scope.run(async step=>{
    const f=await step(()=>scope.unit({machineReceiptsOnly:true}));
    const run=await step(()=>f.launch({fresh:true}));
    await step(()=>f.finish(run.id));
    const template=(await f.jobs())[0]!;
    await mkdir(join(f.root,'.cland/artifacts'),{recursive:true});
    const log=join(f.root,'.cland/artifacts/log');
    await writeFile(log,'durable receipt');
    f.store.updateArtifact({...f.store.artifact(template.artifact!)!,path:log});
    f.store.transaction(()=>{
      for(let i=0;i<50000;i++) f.store.registerArtifact(id=>({id,title:`unrelated-${i}`,kind:'file',path:log,creator:'hub',time:f.clock.now().toISOString(),topic:'other',status:'shared'}),()=>{});
    });
    const jobs:SuiteJob[]=[];
    for(let i=0;i<128;i++){
      const id=`actual-${i}`,dir=join(f.root,'.cland/run/suites',id);
      await mkdir(dir,{recursive:true});
      jobs.push({...template,id,sequence:i,log:join(dir,'suite.log'),result:join(dir,'result.json'),gate:join(dir,'ready'),completedAt:new Date(f.clock.now().getTime()-8*86400000).toISOString()});
    }
    await step(()=>f.reopen(jobs));
    const hub=await step(()=>projectHub(scope.fixtures,f.root));
    const ui=await step(()=>connectUi(scope.fixtures,hub.discovery));
    const created=await ui.request({type:'task.create',size:'M',title:'Actual scheduler liveness'});
    assert.equal(created.ok,true);
    const item=(created.value as {item:{id:string}}).item.id;
    scope.patch(f.store,'artifactIndex',()=>assert.fail('global artifact history decoded'));
    const lookup=f.store.artifactByTitle.bind(f.store),first=Promise.withResolvers<void>();
    let lookups=0,finished=false;
    scope.patch(f.store,'artifactByTitle',(...args:Parameters<typeof lookup>)=>{lookups++;const result=lookup(...args);first.resolve();return result;});
    const done=f.when(()=>f.logs.find(row=>row.event==='suite-retention-report')).then(report=>{finished=true;return report;});
    f.suites.startRetention();
    await scope.wait('actual indexed callback receipt',()=>first.promise);
    assert.equal(finished,false);
    const started=performance.now();
    const reply=await ui.request({type:'task.view',item},1000);
    const latency=performance.now()-started;
    assert.equal(reply.ok,true);
    assert.equal((reply.value as {item:{title:string}}).item.title,'Actual scheduler liveness');
    assert.ok(latency<1000,`actual scheduler task.view ${latency} ms exceeds 1000 ms`); // lint-allow-wall-clock: required real socket reply while actual scheduler callbacks classify beside 50,000 artifact rows.
    assert.equal(finished,false);
    const report=await scope.wait('actual scheduler classification report',()=>done);
    assert.equal(report.wouldRetire,108);
    assert.equal(report.kept,20);
    assert.equal(report.removed,108);
    assert.equal(lookups,108,'one indexed title lookup per eligible candidate');
    assert.equal((await readdir(join(f.root,'.cland/run/suites'))).filter(id=>id.startsWith('actual-')).length,20);
    t.diagnostic(JSON.stringify({platform:process.platform,executor:'fake local',artifactRows:50000,lookups,taskViewMs:latency,boundMs:1000,setupExcluded:true}));
  });
});
