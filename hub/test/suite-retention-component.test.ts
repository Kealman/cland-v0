// T2: disposable filesystem only; no native executor or provider boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, rename, symlink, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { retireSuiteRun, retireSuiteRuns } from '../src/suite-raw-coverage.ts';
import { SuiteRetention } from '../src/suite-retention.ts';
import { retentionCase } from './suite-retention-fixture.ts';
import fs from 'node:fs/promises';

test('guarded unindexed removal keeps a nested file rewritten after its inventory and rename', t=>{
  const scope=retentionCase(t);
  return scope.run(async step=>{
    const root=await step(async()=>{const root=await mkdtemp(join(tmpdir(),'cland-late-inventory-'));scope.adoptRoot(root);return root;});
    const run=join(root,'.cland/run/suites/old'),nested=join(run,'nested');
    await mkdir(nested,{recursive:true});
    await writeFile(join(nested,'receipt'),'old bytes');
    const old=new Date(Date.now()-8*86400000);
    for(const path of [join(nested,'receipt'),nested,run])await utimes(path,old,old);
    const originalRootMtime=(await fs.stat(run)).mtimeMs;
    const rename=fs.rename;
    let rewritten=false;
    scope.patch(fs,'rename',async(...args:Parameters<typeof rename>)=>{
      const result=await Reflect.apply(rename,fs,args);
      if(String(args[0]).endsWith('/suites/old')&&String(args[1]).endsWith('/.retiring-old')){
        await writeFile(join(String(args[1]),'nested/receipt'),'new bytes');
        rewritten=true;
        assert.equal((await fs.stat(String(args[1]))).mtimeMs,originalRootMtime,'nested rewrite leaves the root mtime unchanged');
      }
      return result;
    });
    const sweep=new SuiteRetention(root,1,{remove:true,removeUnindexed:true,indexAbsent:()=>true});
    scope.cleanup(()=>sweep.close());
    await sweep.drain(()=>false,()=>[],()=>{},()=>false);
    assert.equal(rewritten,true,'the real guarded owner reached rename after durable inventory admission');
    assert.equal(await readFile(join(run,'nested/receipt'),'utf8'),'new bytes');
    assert.deepEqual(await readdir(join(root,'.cland/run/suites')),['old']);
    assert.equal(sweep.snapshot().unindexed.removed,0);
  });
});

test('batch retirement preserves completed outcomes and recovers a mid-batch interruption from durable requirements', t => {
  const scope=retentionCase(t);
  return scope.run(async step=>{
    const root=await step(async()=>{const root=await mkdtemp(join(tmpdir(),'cland-batch-retirement-'));scope.adoptRoot(root);return root;});
    await mkdir(join(root,'.cland/artifacts'),{recursive:true});
    const artifact=join(root,'.cland/artifacts/log');await writeFile(artifact,'durable');
    for(const id of ['first','second'])await mkdir(join(root,'.cland/run/suites',id),{recursive:true});
    const remove=fs.rm;let interrupt=true;
    scope.patch(fs,'rm',async(...args:Parameters<typeof remove>)=>{
      if(String(args[0]).endsWith('/.retiring-second')&&interrupt){interrupt=false;throw new Error('planted mid-batch interruption');}
      return Reflect.apply(remove,fs,args);
    });
    const result=await retireSuiteRuns(root,['first','second'].map(id=>({id,artifacts:[artifact],eligible:()=>true})));
    assert.equal(result.get('first')?.removed,true);
    assert.equal(result.get('second')?.removed,false);
    assert.match(String(result.get('second')?.error),/planted mid-batch interruption/);
    assert.equal(await readFile(join(root,'.cland/run/suite-references/first'),'utf8'),'R');
    assert.equal(await readFile(join(root,'.cland/run/suite-references/second'),'utf8'),'R');
    const receipt=JSON.parse(await readFile(join(root,'.cland/run/suite-retirement/second.json'),'utf8'));
    assert.equal(receipt.version,2);
    assert.deepEqual(receipt.runs.map((row:{id:string})=>row.id),['first','second']);
    assert.equal(await retireSuiteRun(root,'second',[artifact],()=>true,{remove:true}),true);
    assert.deepEqual(await readdir(join(root,'.cland/run/suites')),[]);
  });
});

for(const removeUnindexed of [undefined,false,true])test(`unindexed ${removeUnindexed===undefined?'production default':removeUnindexed?'fixture deletion':'reporting'} uses newest inventory age and preserves keep controls`, t => {
  const scope = retentionCase(t);
  return scope.run(async step => {
    const root = await step(async () => {
      const root = await mkdtemp(join(tmpdir(),'cland-unindexed-retention-'));
      scope.adoptRoot(root); return root;
    });
    const { pinSuiteRun } = await import('../src/suite-reference-pins.ts');
    const suites = join(root,'.cland/run/suites');
    await mkdir(join(root,'.cland/artifacts'),{recursive:true});
    const old = new Date(Date.now()-8*86400000);
    for (const id of ['absent','indexed','referenced','pinned','young','new-file','oversized']) {
      await mkdir(join(suites,id),{recursive:true});
      await writeFile(join(suites,id,'receipt'),'original bytes');
      if(id!=='new-file'&&id!=='young')await utimes(join(suites,id,'receipt'),old,old);
      if (id !== 'young') await utimes(join(suites,id),old,old);
    }
    const deep=[join(suites,'oversized')];
    for(let depth=0;depth<17;depth++){const path=join(deep.at(-1)!,'child');await mkdir(path);deep.push(path);}
    for(const path of deep.reverse())await utimes(path,old,old);
    await pinSuiteRun(root,'pinned');
    const live=removeUnindexed!==false;
    const sweep = new SuiteRetention(root,1,{remove:true,...(removeUnindexed===undefined?{}:{removeUnindexed}),indexAbsent:id=>id!=='indexed'});
    scope.cleanup(()=>sweep.close());
    await sweep.drain(id=>id==='referenced',()=>[],()=>{},()=>false);
    const kept=['indexed','new-file','oversized','pinned','referenced','young',...(live?[]:['absent'])].sort();
    assert.deepEqual((await readdir(suites)).sort(),kept);
    for (const id of kept) assert.equal(await readFile(join(suites,id,'receipt'),'utf8'),'original bytes');
    assert.equal(sweep.snapshot().unindexed.mode,live?'live':'report');
    assert.equal(sweep.snapshot().unindexed.wouldRetire,1);
    assert.equal(sweep.snapshot().unindexed.removed,live?1:0);
    assert.deepEqual(sweep.snapshot().unindexed.reasons,{indexed:1,reference:1,pin:1,'age-floor':2,'inventory-bound':1,eligible:1});
    assert.deepEqual((await readdir(join(root,'.cland/run/suite-references'))).sort(),live?['absent','pinned']:['pinned'],'report mode creates no retirement claim');
    const inventories = (await readdir(join(root,'.cland/artifacts'))).filter(name=>name.startsWith('suite-retention-'));
    assert.equal(inventories.length,1);
    const inventory = JSON.parse(await readFile(join(root,'.cland/artifacts',inventories[0]!), 'utf8'));
    assert.deepEqual(inventory.runs.map((run:{id:string})=>run.id),['absent']);
    assert.equal(inventory.runs[0].files,1);
    assert.equal(inventory.runs[0].bytes,14);
    assert.equal(inventory.runs[0].indexAbsent,true);
  });
});

test('retirement uses durable artifacts and preserves an already referenced run through guarded removal', t => {
  const scope = retentionCase(t);
  return scope.run(async step => {
  const root = await step(async () => {
    const acquired = await mkdtemp(join(tmpdir(), 'cland-suite-retention-'));
    scope.adoptRoot(acquired);
    scope.fixtures.after(() => rm(acquired, { recursive: true, force: true }));
    return acquired;
  });
  const run = join(root, '.cland/run/suites/old');
  await mkdir(run, { recursive: true });
  await writeFile(join(run, 'suite.log'), 'original receipt');
  let referenced = false;
  const artifact = join(root, '.cland/artifacts/log.txt');
  await mkdir(join(root, '.cland/artifacts'), { recursive: true });
  assert.equal(await retireSuiteRun(root, 'old', [artifact], () => !referenced, { remove: true }), false);
  assert.equal(await readFile(join(run, 'suite.log'), 'utf8'), 'original receipt');
  await writeFile(artifact, 'original receipt');
  referenced = true;
  assert.equal(await retireSuiteRun(root, 'old', [artifact], () => !referenced, { remove: true }), false);
  assert.equal(await readFile(join(run, 'suite.log'), 'utf8'), 'original receipt');
  referenced = false;
  assert.equal(await retireSuiteRun(root, 'old', [artifact], () => !referenced, { remove: true }), true);
  assert.deepEqual(await readdir(join(root, '.cland/run/suites')), []);
  assert.equal(await retireSuiteRun(root, 'old', [artifact], () => !referenced, { remove: true }), false);
  assert.equal(await readFile(artifact, 'utf8'), 'original receipt');
  });
});

test('interrupted removal revalidates its persisted map artifact requirements', t=>{
  const scope=retentionCase(t);
  return scope.run(async step=>{
    const root=await step(async()=>{
      const acquired=await mkdtemp(join(tmpdir(),'cland-retention-checkpoint-'));
      scope.adoptRoot(acquired);scope.fixtures.after(()=>rm(acquired,{recursive:true,force:true}));return acquired;
    });
    const run=join(root,'.cland/run/suites/old'),tombstone=join(await fs.realpath(root),'.cland/run/suites/.retiring-old');
    await mkdir(run,{recursive:true});await mkdir(join(root,'.cland/artifacts'),{recursive:true});
    const log=join(root,'.cland/artifacts/log'),map=join(root,'.cland/artifacts/map');
    await writeFile(log,'log receipt');await writeFile(map,'map receipt');await writeFile(join(run,'coverage-map.json'),'retained map');
    await writeFile(join(run,'coverage-download.log'),'retained download failure');
    const original=fs.rm;let interrupt=true;
    scope.patch(fs,'rm',async (...args:Parameters<typeof original>)=>{
      if(args[0]===tombstone&&interrupt){interrupt=false;throw new Error('planted removal interruption');}
      return Reflect.apply(original,fs,args);
    });
    await assert.rejects(retireSuiteRun(root,'old',[log,map],()=>true,{remove:true}),/planted removal interruption/);
    await rm(map);
    assert.equal(await retireSuiteRun(root,'old',[log],()=>true,{remove:true}),false);
    assert.equal(await readFile(join(tombstone,'coverage-map.json'),'utf8'),'retained map');
    assert.equal(await readFile(join(tombstone,'coverage-download.log'),'utf8'),'retained download failure');
    await writeFile(map,'map receipt');
    assert.equal(await retireSuiteRun(root,'old',[log,map],()=>true,{remove:true}),true);
    assert.deepEqual(await readdir(join(root,'.cland/run/suites')),[]);
  });
});

test('retirement resumes an interrupted deletion and refuses linked ownership roots', t => {
  const scope = retentionCase(t);
  return scope.run(async step => {
  const root = await step(async () => {
    const acquired = await mkdtemp(join(tmpdir(), 'cland-retention-recovery-'));
    scope.adoptRoot(acquired);
    scope.fixtures.after(() => rm(acquired, { recursive: true, force: true }));
    return acquired;
  });
  const suites = join(root, '.cland/run/suites');
  await mkdir(join(suites, 'old'), { recursive: true });
  const artifact = join(root, '.cland/artifacts/receipt');
  await mkdir(join(root, '.cland/artifacts'), { recursive: true });
  await writeFile(artifact, 'durable');
  await rename(join(suites, 'old'), join(suites, '.retiring-old'));
  assert.equal(await retireSuiteRun(root, 'old', [artifact], () => true, { remove: true }), true);
  await symlink(join(root, '.cland/artifacts'), join(suites, 'linked'));
  await assert.rejects(retireSuiteRun(root, 'linked', [artifact], () => true, { remove: true }), /refusing suite-owned path/);
  assert.equal(await readFile(artifact, 'utf8'), 'durable');
  });
});

test('admission retention shares its sweep and preserves coverage pointers and duration sources', t => {
  const scope = retentionCase(t);
  return scope.run(async step => {
  const root = await step(async () => {
    const acquired = await mkdtemp(join(tmpdir(), 'cland-retention-index-'));
    scope.adoptRoot(acquired);
    scope.fixtures.after(() => rm(acquired, { recursive: true, force: true }));
    return acquired;
  });
  const sweep = new SuiteRetention(root, 1, {remove:true});
  for (const dir of ['.cland/run/suites', '.cland/artifacts', '.cland/run/coverage-maps', 'hub/test']) await mkdir(join(root, dir), { recursive: true });
  const artifact = join(root, '.cland/artifacts/moved-log.txt');
  await writeFile(artifact, 'durable');
  await writeFile(join(root, 'hub/test/durations.json'), JSON.stringify({ source: { artifacts: ['A-1'] } }));
  for (const [sequence, id] of ['duration', 'pointer', 'old', 'latest'].entries()) {
    await mkdir(join(root, '.cland/run/suites', id));
    sweep.remember({ id, sequence, state: 'finished', cleaned: true, reported: true, completedAt:new Date(Date.now()-8*86400000).toISOString() });
  }
  await writeFile(join(root, '.cland/run/coverage-maps/pointer.json'), '{}');
  const paths = (id: string) => id === 'duration' ? [{ id: 'A-1', path: artifact }] : [join(root, '.cland/artifacts/other.txt')];
  await writeFile(join(root, '.cland/artifacts/other.txt'), 'durable');
  const removed: string[] = [];
  const first = sweep.sweep(() => false, paths, (id, done) => { if (done) removed.push(id); });
  assert.equal(sweep.sweep(() => false, paths, () => assert.fail('overlapping sweep')), first);
  await first;
  assert.deepEqual(removed, ['old']);
  assert.deepEqual((await readdir(join(root, '.cland/run/suites'))).sort(), ['duration', 'latest', 'pointer']);
  });
});

test('report mode retains every directory while classifying candidates', t => {
  const scope = retentionCase(t);
  return scope.run(async step => {
    const root = await step(async () => {
      const acquired = await mkdtemp(join(tmpdir(), 'cland-retention-report-'));
      scope.adoptRoot(acquired);
      scope.fixtures.after(() => rm(acquired, { recursive: true, force: true }));
      return acquired;
    });
    await mkdir(join(root, '.cland/run/suites/old'), {recursive:true});
    await mkdir(join(root, '.cland/artifacts'), {recursive:true});
    await writeFile(join(root, '.cland/artifacts/log'), 'receipt');
    const sweep = new SuiteRetention(root, 1);
    const completedAt = new Date(Date.now() - 8 * 86400000).toISOString();
    sweep.remember({id:'old',sequence:0,state:'finished',cleaned:true,reported:true,completedAt});
    sweep.remember({id:'new',sequence:1,state:'finished',cleaned:true,reported:true,completedAt});
    await sweep.drain(() => false, () => [join(root,'.cland/artifacts/log')], () => {}, () => false);
    assert.deepEqual(await readdir(join(root,'.cland/run/suites')), ['old']);
    assert.equal(sweep.snapshot().wouldRetire, 1);
    assert.equal(sweep.snapshot().removed, 0);
  });
});

test('tombstone recovery preserves map requirements when an artifact disappears', t => {
  const scope = retentionCase(t);
  return scope.run(async step => {
    const root = await step(async () => {
      const acquired = await mkdtemp(join(tmpdir(), 'cland-retention-map-'));
      scope.adoptRoot(acquired);
      scope.fixtures.after(() => rm(acquired, {recursive:true,force:true}));
      return acquired;
    });
    const tombstone = join(root,'.cland/run/suites/.retiring-old');
    await mkdir(tombstone,{recursive:true});
    await mkdir(join(root,'.cland/artifacts'),{recursive:true});
    const log=join(root,'.cland/artifacts/log'), map=join(root,'.cland/artifacts/map');
    await writeFile(log,'receipt');
    await writeFile(join(tombstone,'coverage-map.json'),'only map bytes');
    assert.equal(await retireSuiteRun(root,'old',[log],()=>true,{remove:true}),false);
    assert.equal(await readFile(join(tombstone,'coverage-map.json'),'utf8'),'only map bytes');
    await writeFile(map,'only map bytes');
    assert.equal(await retireSuiteRun(root,'old',[log,map],()=>true,{remove:true}),true);
    assert.deepEqual(await readdir(join(root,'.cland/run/suites')),[]);
  });
});

for(const linked of ['directory','file'] as const) test(`retirement retry refuses a linked receipt ${linked} and preserves external evidence`,t=>{
  const scope=retentionCase(t);
  return scope.run(async step=>{
    const root=await step(async()=>{
      const root=await mkdtemp(join(tmpdir(),'cland-retention-linked-receipt-'));
      scope.adoptRoot(root);scope.fixtures.after(()=>rm(root,{recursive:true,force:true}));return root;
    });
    const tombstone=join(root,'.cland/run/suites/.retiring-old'),receipts=join(root,'.cland/run/suite-retirement');
    await mkdir(tombstone,{recursive:true});await mkdir(join(root,'.cland/artifacts'),{recursive:true});
    await mkdir(join(root,'external'));
    const artifact=join(root,'.cland/artifacts/log'),external=join(root,'external/old.json');
    await writeFile(artifact,'durable log');await writeFile(join(tombstone,'kept'),'run retained receipt');
    const bytes=JSON.stringify({version:1,id:'old',required:[artifact]});await writeFile(external,bytes);
    if(linked==='directory')await symlink(join(root,'external'),receipts);
    else {await mkdir(receipts);await symlink(external,join(receipts,'old.json'));}
    await assert.rejects(retireSuiteRun(root,'old',[artifact],()=>true,{remove:true}),/refusing suite retirement receipt/);
    assert.equal(await readFile(external,'utf8'),bytes,'external receipt bytes survive the actual guarded cleanup');
    assert.equal(await readFile(join(tombstone,'kept'),'utf8'),'run retained receipt');
  });
});
