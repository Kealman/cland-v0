// T4: 50,000 owned directory entries exercise disk-scale retention, not process lifecycle.
// Setup is one owned pass; there are no per-run files or fsync loops.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SuiteRetention } from '../src/suite-retention.ts';
import { projectHub, tempProject, connectUi } from './harness.ts';
import { guardDirectoryRemoval } from './process-cleanup.ts';
import { retentionCase } from './suite-retention-fixture.ts';
import type { SuiteJob } from '../src/hub/suites.ts';
import { testWaitMs, waitTimeoutMs } from './until.ts';

test('report mode classifies fifty thousand runs and keeps every directory while serving task views', t => {
  const largeRootTeardownMs=waitTimeoutMs(testWaitMs(120_000));
  const scope=retentionCase(t,undefined,{timeoutMs:largeRootTeardownMs});
  return scope.run(async step=>{
  const root = await step(async()=>{const root=await tempProject(scope.fixtures,'cland-retention-scale-');scope.adoptRoot(root);return root;});
  const suites = join(root, '.cland/run/suites');
  await mkdir(suites, { recursive: true });
  await mkdir(join(root, '.cland/artifacts'), { recursive: true });
  const artifact = join(root, '.cland/artifacts/A-1-log');
  await writeFile(artifact, 'durable receipt');
  const sweep = new SuiteRetention(root, 2);
  for (let sequence = 0; sequence < 50_000; sequence++) {
    const id = `run-${sequence}`;
    mkdirSync(join(suites, id));
    sweep.remember({ id, sequence, completedAt:new Date(Date.now()-8*86400000).toISOString(), occasion: sequence % 2 ? 'stage' : 'task', state: 'finished', cleaned: true, reported: true });
  }
  await writeFile(join(suites, 'run-0/kept'), 'referenced run');
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
  let stopped = false;
  const receipt = (_id: string, done: boolean, error?: unknown, decision?: string) => { assert.equal(error, undefined); if(done) removed++; if(decision==='would-retire'){wouldRetire++;firstRemoval.resolve();} };
  let work = sweep.drain(referenced, artifacts, receipt, () => stopped).finally(() => { finished = true; });
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
  assert.equal(wouldRetire,49_993);
  const expected = Array.from({length:50000},(_,i)=>`run-${i}`).sort();
  assert.deepEqual((await readdir(suites)).sort(), expected);
  assert.equal(removed, 0);
  assert.equal(sweep.snapshot().wouldRetire, 49_993);
  assert.equal(sweep.snapshot().kept,7);
  assert.equal(await readFile(join(suites, 'run-0/kept'), 'utf8'), 'referenced run');
  work = sweep.drain(referenced, artifacts, receipt, () => stopped);
  await work;
  assert.deepEqual((await readdir(suites)).sort(), expected);
  assert.equal(removed, 0);
  assert.equal(sweep.snapshot().wouldRetire, 49_993);
  assert.equal(sweep.snapshot().kept,7);
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
    assert.equal(report.removed,0);
    assert.equal(lookups,108,'one indexed title lookup per eligible candidate');
    assert.equal((await readdir(join(f.root,'.cland/run/suites'))).filter(id=>id.startsWith('actual-')).length,128);
    t.diagnostic(JSON.stringify({platform:process.platform,executor:'fake local',artifactRows:50000,lookups,taskViewMs:latency,boundMs:1000,setupExcluded:true}));
  });
});
