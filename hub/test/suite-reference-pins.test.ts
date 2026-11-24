// T2: disposable filesystem admission and retirement, with no native launches.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs, { mkdtemp, mkdir, writeFile, readFile, utimes, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { retentionCase } from './suite-retention-fixture.ts';
import { pinSuiteRun, suiteRunPinned, SuiteReferencePins } from '../src/suite-reference-pins.ts';
import { retireSuiteRun } from '../src/suite-raw-coverage.ts';
import { registerCoverageMap } from '../src/suite-coverage.ts';
import { refreshDurations } from './durations.ts';
import { ownedTracker, ownedDatabases } from './owned-tracker.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { parseItem } from '../src/tracker/item.ts';
import { TrackerIndex } from '../src/tracker/index-db.ts';
import { DatabaseSync } from 'node:sqlite';

test('historical keep lookups use the partial index across ten thousand retained items', t => {
  const scope=retentionCase(t);
  return scope.run(async()=>{
    const open=ownedDatabases({requireClose:close=>scope.cleanup(close)});
    let database:DatabaseSync|undefined;
    const index=new TrackerIndex(':memory:',undefined,path=>{database=open(path);return database;});
    scope.cleanup(async()=>index.close());
    const db=database!;
    db.exec(`with recursive retained(n) as (values(1) union all select n+1 from retained where n<10000)
      insert into tracker_items(id,n,file,kind,title,state,assignee,parent,topic,branch,created,updated,hash,source,indexed_at)
      select 'T-'||n,n,'T-'||n||'.md','task','Retained evidence','open',null,null,null,null,'2026-11-19T00:00:00Z','2026-11-19T00:00:00Z','indexed','hand',0 from retained`);
    const prepare=db.prepare.bind(db);
    const definition=prepare("select sql from sqlite_master where name='tracker_pending_criterion_migration'").get() as {sql:string};
    const plans:string[][]=[];
    scope.patch(db,'prepare',(sql:string)=>{
      if(sql.includes('tracker_items')&&sql.includes("hash = ''"))plans.push((prepare(`explain query plan ${sql}`).all() as Array<{detail:string}>).map(row=>row.detail));
      return prepare(sql);
    });
    db.exec('drop index tracker_pending_criterion_migration');
    assert.equal(index.retainsSuiteRun('positive-control'),false);
    assert.ok(plans[0]!.some(detail=>detail==='SCAN tracker_items'),'the control detects a full retained-history scan when the index is absent');
    db.exec(definition.sql);plans.length=0;
    for(let candidate=0;candidate<1024;candidate++)assert.equal(index.retainsSuiteRun(`absent-${candidate}`),false);
    assert.equal(plans.length,1024);
    assert.ok(plans.every(plan=>plan.some(detail=>detail.includes('USING COVERING INDEX tracker_pending_criterion_migration'))),'every production migration query uses the covering partial index');
  });
});

test('criterion-only historical verification protects its raw run through indexed retirement', t => {
  const scope = retentionCase(t);
  return scope.run(async step => {
    const root = await step(async () => {
      const root = await mkdtemp(join(tmpdir(), 'cland-historical-mark-'));
      scope.adoptRoot(root); return root;
    });
    await mkdir(join(root,'.cland/run/suites/criterion-only'), {recursive:true});
    await mkdir(join(root,'.cland/artifacts'), {recursive:true});
    const artifact = join(root,'.cland/artifacts/log');
    await writeFile(artifact,'durable');
    const snapshot = JSON.parse(await readFile(new URL('./fixtures/tracker-snapshot/items.json', import.meta.url), 'utf8')) as {items:Array<{name:string;text:string}>};
    const source = snapshot.items.find(item => item.name.startsWith('T-1000-'))!;
    const item = parseItem(source.text, source.name);
    item.comments = [];
    item.body = '## Acceptance criteria\n- [x] C1. Preserved\n  - verified: reviewer [reviewer] · run criterion-only · 2026-11-18T00:00:00Z';
    const open=ownedDatabases({requireClose:close=>scope.cleanup(close)});
    let index: TrackerIndex | undefined;
    scope.cleanup(async () => { index?.close(); });
    index = new TrackerIndex(join(root,'index.db'),undefined,open);
    index.put(item,{file:source.name,hash:'old',source:'hand',indexedAt:1});
    index.close(); index=undefined;
    const legacy=open(join(root,'index.db'));
    try {legacy.exec('drop table tracker_criterion_runs');} finally {legacy.close();}
    index=new TrackerIndex(join(root,'index.db'),undefined,open);
    assert.equal(index.metaOf(item.fm.id)?.hash,'','older index requests bootstrap reindex before serving');
    assert.equal(index.retainsSuiteRun('not-yet-indexed'),true,'incomplete migration fences every absence');
    index.put(item,{file:source.name,hash:'old',source:'hand',indexedAt:2});
    assert.equal(index.retainsSuiteRun('not-yet-indexed'),false,'positive bootstrap receipt releases unrelated absence');
    assert.equal(index.retainsSuiteRun('criterion-only'),true);
    assert.equal(await retireSuiteRun(root,'criterion-only',[artifact],()=>!index!.retainsSuiteRun('criterion-only'),{remove:true}),false);
    assert.equal(await suiteRunPinned(root,'criterion-only'),false,'keep protection works without a newly written pin');
    assert.equal((await fs.stat(join(root,'.cland/run/suites/criterion-only'))).isDirectory(),true);
    let failed:DatabaseSync|undefined;
    assert.throws(()=>new TrackerIndex(join(root,'failed.db'),undefined,path=>{
      failed=open(path);
      const exec=failed.exec.bind(failed);
      scope.patch(failed,'exec',(sql:string)=>{if(sql.includes('create table tracker_criterion_runs'))throw new Error('planted migration failure');return exec(sql);});
      return failed;
    }),/planted migration failure/);
    assert.equal(failed!.isOpen,false,'constructor closes the captured connection before propagating migration failure');
    await scope.settleResources();
    assert.equal(failed!.isOpen,false,'resource close receipt precedes root/guard release');
  });
});

test('admission owner shares pending work, checkpoints only success and revalidates after recovery', t => {
  const scope = retentionCase(t);
  return scope.run(async step => {
    const root = await step(async () => {
      const root = await mkdtemp(join(tmpdir(), 'cland-pin-checkpoint-'));
      scope.adoptRoot(root); return root;
    });
    await mkdir(join(root,'.cland/run/suite-references'), {recursive:true});
    const canonical = await fs.realpath(root), records = join(canonical,'.cland/run/suite-references');
    await writeFile(join(records,'unknown'), '');
    const opens = new Map<string,number>();
    const original = fs.open;
    let fail = true;
    scope.patch(fs, 'open', async (...args:Parameters<typeof original>) => {
      const path = String(args[0]);
      if (path.startsWith(records + '/')) opens.set(path, (opens.get(path) ?? 0) + 1);
      if (path === join(records,'failed') && fail) { fail = false; throw new Error('planted admission open failure'); }
      return Reflect.apply(original, fs, args);
    });
    const owner = new SuiteReferencePins(root);
    const first = owner.pin('shared'), second = owner.pin('shared');
    assert.equal(first, second, 'concurrent callers share the entire admission through synced completion');
    await Promise.all([first,second]);
    assert.equal(opens.get(join(records,'shared')), 1);
    await owner.pin('shared');
    assert.equal(opens.get(join(records,'shared')), 1, 'positive checkpoint adds no record I/O');
    await assert.rejects(owner.pin('failed'), /planted admission open failure/);
    await owner.pin('failed');
    await owner.pin('failed');
    assert.equal(opens.get(join(records,'failed')), 2, 'failed acquisition retried once; only its success checkpoints');
    await assert.rejects(owner.pin('unknown'), /unknown reference admission/);
    await assert.rejects(owner.pin('unknown'), /unknown reference admission/);
    assert.equal(opens.get(join(records,'unknown')), 4, 'unknown outcome is rechecked and never becomes a positive checkpoint');
    assert.equal(await readFile(join(records,'unknown'), 'utf8'), '');
    await new SuiteReferencePins(root).pin('shared');
    assert.equal(opens.get(join(records,'shared')), 3, 'a recovered owner revalidates the durable pin');
  });
});

test('tracker retained-history rewrites do no repeated admission I/O and admit only the new reference', t => {
  const scope = retentionCase(t);
  return scope.run(async step => {
    const root = await step(async () => {
      const root = await mkdtemp(join(tmpdir(), 'cland-pin-history-'));
      scope.adoptRoot(root); return root;
    });
    const snapshot = JSON.parse(await readFile(new URL('./fixtures/tracker-snapshot/items.json', import.meta.url), 'utf8')) as {source:string;items:Array<{name:string;text:string}>};
    assert.equal(snapshot.source, '96238cb9a');
    const retained = snapshot.items.find(item => item.name.startsWith('T-1000-'))!;
    const source = parseItem(retained.text, retained.name);
    assert.equal(source.comments.filter(comment => comment.verdict).length, 2);
    const canonical = await fs.realpath(root);
    const paths = new Set([root, canonical, join(canonical,'.cland'), join(canonical,'.cland/run'), join(canonical,'.cland/run/suite-references')]);
    let calls = 0;
    const count = <K extends 'realpath' | 'mkdir' | 'lstat' | 'open'>(method:K) => {
      const original = fs[method];
      scope.patch(fs, method, ((...args:Parameters<typeof original>) => {
        const path = String(args[0]);
        if (paths.has(path) || path.startsWith(join(canonical,'.cland/run/suite-references') + '/')) calls++;
        return Reflect.apply(original, fs, args);
      }) as typeof original);
    };
    for (const method of ['realpath','mkdir','lstat','open'] as const) count(method);
    const tracker = ownedTracker({requireClose: close => scope.cleanup(close)}, {
      root, db:join(root,'.cland/tracker.db'), env:fixtureEnvironment(root, {}), git:async () => '', readBase:async () => null,
    });
    const human = {id:'human',name:'human',role:null};
    const item = await tracker.create(human, {title:'Retained corpus',size:'S',body:source.body});
    const runs = new Set(snapshot.items.flatMap(entry => parseItem(entry.text, entry.name).comments.flatMap(comment => comment.verdict ? [comment.verdict.run] : [])));
    assert.ok(runs.size >= 16, 'retained reference history comes from the pinned real-world corpus');
    for (const run of runs) {
      await tracker.comment(human, item.id, 'Copied retained reference', {verdict:'review',scope:'full',result:'clear',run});
    }
    assert.ok(calls > 0, 'positive control: the copied corpus performs real durable admission');
    calls = 0;
    for (let edit = 0; edit < 4; edit++) await tracker.edit(human, item.id, {title:`Retained corpus ${edit}`});
    assert.equal(calls, 0, 'four retained-history writes have zero admission filesystem entry calls');
    await tracker.comment(human, item.id, 'New evidence', {verdict:'review',scope:'full',result:'clear',run:'new-reference'});
    assert.ok(calls > 0 && calls <= 16, `one new reference has a fixed 16-call admission budget; observed ${calls}`);
  });
});

for (const publisher of ['create', 'edit'] as const) test(`tracker ${publisher} body references pin before publication and refuse retired runs`, t => {
  const scope = retentionCase(t);
  return scope.run(async step => {
    const root = await step(async () => {
      const root = await mkdtemp(join(tmpdir(), 'cland-body-pin-'));
      scope.adoptRoot(root); return root;
    });
    await mkdir(join(root, '.cland/artifacts'), {recursive:true});
    const artifact = join(root, '.cland/artifacts/log');
    await writeFile(artifact, 'durable');
    for (const id of ['before', 'after']) await mkdir(join(root, '.cland/run/suites', id), {recursive:true});
    let overlap = false, observed = false;
    const tracker = ownedTracker({requireClose: close => scope.cleanup(close)}, {
      root, db:join(root,'.cland/tracker.db'), env:fixtureEnvironment(root, {}),
      git:async () => '', readBase:async () => null,
      writeGate:async () => {
        if (!overlap) return;
        overlap = false;
        assert.equal(await retireSuiteRun(root, 'before', [artifact], () => true, {remove:true}), false);
        observed = true;
      },
    });
    const human = {id:'human',name:'human',role:null};
    const existing = publisher === 'edit' ? await tracker.create(human, {title:'Existing',size:'S'}) : null;
    const body = (run:string) => `## Acceptance criteria\n- [ ] C1. Preserved\n  - verified: reviewer [reviewer] · run ${run} · ${new Date().toISOString()}`;
    const publish = (run:string) => existing
      ? tracker.edit(human, existing.id, {body:body(run)})
      : tracker.create(human, {title:'Body reference',size:'S',body:body(run)});
    overlap = true;
    const written = await publish('before');
    assert.equal(observed, true);
    assert.equal(written.criteria[0]?.marks.some(mark => mark.kind === 'verified' && mark.run === 'before'), true);
    assert.equal(await retireSuiteRun(root, 'after', [artifact], () => true, {remove:true}), true);
    await assert.rejects(publish('after'), /raw-run reference refused/);
  });
});

for (const publisher of ['verdict', 'criterion'] as const) test(`${publisher} publication pins before its final write and refuses retirement`, t => {
  const scope = retentionCase(t);
  return scope.run(async step => {
    const root = await step(async () => {
      const root = await mkdtemp(join(tmpdir(), 'cland-tracker-pin-'));
      scope.adoptRoot(root); return root;
    });
    await mkdir(join(root, '.cland/artifacts'), {recursive:true});
    const artifact = join(root, '.cland/artifacts/log');
    await writeFile(artifact, 'durable');
    for (const id of ['before', 'after']) await mkdir(join(root, '.cland/run/suites', id), {recursive:true});
    let overlap = false, observed = false;
    const tracker = ownedTracker({requireClose: close => scope.cleanup(close)}, {
      root, db:join(root,'.cland/tracker.db'), env:fixtureEnvironment(root, {}),
      git:async () => '', readBase:async () => null,
      writeGate:async () => {
        if (overlap) {
          overlap = false;
          assert.equal(await retireSuiteRun(root, 'before', [artifact], () => true, {remove:true}), false);
          observed = true;
        }
      },
    });
    const human = {id:'human',name:'human',role:null};
    const reviewer = {id:'reviewer',name:'reviewer',role:'reviewer'};
    const item = await tracker.create(human, {title:'Pinned evidence',size:'S',body:'## Acceptance criteria\n- [ ] C1. Evidence survives'});
    const publish = (run:string) => publisher === 'verdict'
      ? tracker.comment(human, item.id, 'reviewed', {verdict:'review',scope:'full',result:'clear',run})
      : tracker.criterion(reviewer, item.id, {op:'verify',criterion:'C1',run});
    overlap = true;
    await publish('before');
    assert.equal(observed, true);
    assert.equal(await retireSuiteRun(root, 'after', [artifact], () => true, {remove:true}), true);
    await assert.rejects(publish('after'), /raw-run reference refused/);
  });
});

for (const publisher of ['coverage', 'duration'] as const) test(`${publisher} publication pins before writing and refuses a retired raw run`, t => {
  const scope = retentionCase(t);
  return scope.run(async step => {
    const root = await step(async () => {
      const root = await mkdtemp(join(tmpdir(), 'cland-publisher-pin-'));
      scope.adoptRoot(root); return root;
    });
    await mkdir(join(root, '.cland/artifacts'), {recursive:true});
    await mkdir(join(root, 'hub/test'), {recursive:true});
    const artifact = join(root, '.cland/artifacts/log');
    await writeFile(artifact, 'durable');
    for (const id of ['before', 'after']) {
      const run = join(root, '.cland/run/suites', id);
      await mkdir(run, {recursive:true});
      await writeFile(join(run, 'suite.log'), 'Head fixture\nsuite timing {"file":"hub/test/example.test.ts","name":"example","seconds":0.01}\nFinished: exit 0\n');
    }
    const publish = (id: string) => publisher === 'coverage'
      ? registerCoverageMap(root, id, {artifact:'A-1',path:artifact,created:new Date().toISOString(),head:'fixture'}, 1, () => {})
      : refreshDurations(root, [join(root, '.cland/run/suites', id, 'suite.log')]);
    const original = fs.writeFile;
    let observed = false;
    scope.patch(fs, 'writeFile', async (...args: Parameters<typeof original>) => {
      if (args[0] === join(root, '.cland/run/coverage-maps/before.json.tmp') || args[0] === join(root, 'hub/test/durations.json')) {
        assert.equal(await retireSuiteRun(root, 'before', [artifact], () => true, {remove:true}), false);
        observed = true;
      }
      return Reflect.apply(original, fs, args);
    });
    await publish('before');
    assert.equal(observed, true);
    assert.equal(await retireSuiteRun(root, 'before', [artifact], () => true, {remove:true}), false);
    assert.equal(await retireSuiteRun(root, 'after', [artifact], () => true, {remove:true}), true);
    await assert.rejects(publish('after'), /raw-run reference refused/);
  });
});

test('an interrupted unknown pin never ages out on recovery', t => {
  const scope = retentionCase(t);
  return scope.run(async step => {
    const root = await step(async () => {
      const root = await mkdtemp(join(tmpdir(), 'cland-unknown-pin-'));
      scope.adoptRoot(root); return root;
    });
    await mkdir(join(root, '.cland/run/suites/old'), {recursive:true});
    await mkdir(join(root, '.cland/run/suite-references'), {recursive:true});
    await mkdir(join(root, '.cland/artifacts'), {recursive:true});
    const record = join(root, '.cland/run/suite-references/old');
    await writeFile(record, '');
    await utimes(record, new Date(0), new Date(0));
    const artifact = join(root, '.cland/artifacts/log');
    await writeFile(artifact, 'durable');
    assert.equal(await suiteRunPinned(root, 'old'), true);
    assert.equal(await retireSuiteRun(root, 'old', [artifact], () => true, {remove:true}), false);
    await assert.rejects(pinSuiteRun(root, 'old'), /unknown reference admission/);
    assert.equal(await readFile(record, 'utf8'), '');
  });
});

for (const input of ['renamed', 'alias'] as const) test(`duration refresh pins a ${input} raw log input`, t => {
  const scope = retentionCase(t);
  return scope.run(async step => {
    const root = await step(async () => {
      const root = await mkdtemp(join(tmpdir(), 'cland-duration-input-'));
      scope.adoptRoot(root); return root;
    });
    await mkdir(join(root, '.cland/run/suites/old'), {recursive:true});
    await mkdir(join(root, '.cland/artifacts'), {recursive:true});
    await mkdir(join(root, 'hub/test'), {recursive:true});
    const raw = join(root, '.cland/run/suites/old/other.log');
    await writeFile(raw, 'Head fixture\nsuite timing {"file":"hub/test/example.test.ts","name":"example","seconds":0.01}\nFinished: exit 0\n');
    const path = input === 'alias' ? join(root, 'alias.log') : raw;
    if (input === 'alias') await symlink(raw, path);
    await refreshDurations(root, [path]);
    const artifact = join(root, '.cland/artifacts/log');
    await writeFile(artifact, 'durable');
    assert.equal(await retireSuiteRun(root, 'old', [artifact], () => true, {remove:true}), false);
  });
});

test('a durable publisher pin retains its run through retirement and recovery', t => {
  const scope = retentionCase(t);
  return scope.run(async step => {
    const root = await step(async () => {
      const root = await mkdtemp(join(tmpdir(), 'cland-reference-pins-'));
      scope.adoptRoot(root);
      return root;
    });
    await mkdir(join(root, '.cland/run/suites/old'), {recursive:true});
    await mkdir(join(root, '.cland/artifacts'), {recursive:true});
    const artifact = join(root, '.cland/artifacts/log');
    await writeFile(artifact, 'durable evidence');
    await writeFile(join(root, '.cland/run/suites/old/suite.log'), 'raw evidence');
    await pinSuiteRun(root, 'old');
    // No write follows the pin: models interruption at the publisher boundary.
    assert.equal(await retireSuiteRun(root, 'old', [artifact], () => true, {remove:true}), false);
    await pinSuiteRun(root, 'old');
    assert.equal(await retireSuiteRun(root, 'old', [artifact], () => true, {remove:true}), false);
    assert.equal(await readFile(join(root, '.cland/run/suites/old/suite.log'), 'utf8'), 'raw evidence');
  });
});

test('duration refresh consumes the pinned run when its input alias changes after resolution', t => {
  const scope = retentionCase(t);
  return scope.run(async step => {
    const root = await step(async () => {
      const root = await mkdtemp(join(tmpdir(), 'cland-duration-alias-swap-'));
      scope.adoptRoot(root); return root;
    });
    await mkdir(join(root, '.cland/artifacts'), {recursive:true});
    await mkdir(join(root, 'hub/test'), {recursive:true});
    for (const run of ['pinned', 'replacement']) {
      await mkdir(join(root, '.cland/run/suites', run), {recursive:true});
      await writeFile(join(root, '.cland/run/suites', run, 'suite.log'), `Head fixture\nsuite timing {"file":"hub/test/example.test.ts","name":"${run}","seconds":0.01}\nFinished: exit 0\n`);
    }
    const alias = join(root, 'alias.log');
    await symlink(join(root, '.cland/run/suites/pinned/suite.log'), alias);
    const original = fs.realpath;
    let changed = false;
    scope.patch(fs, 'realpath', async (...args: Parameters<typeof original>) => {
      const captured = await Reflect.apply(original, fs, args);
      if (args[0] === alias && !changed) {
        await fs.unlink(alias);
        await symlink(join(root, '.cland/run/suites/replacement/suite.log'), alias);
        changed = true;
      }
      return captured;
    });
    const manifest = await refreshDurations(root, [alias]);
    assert.equal(changed, true);
    assert.deepEqual(manifest.tests, {'hub/test/example.test.ts::pinned':0.01});
    const artifact = join(root, '.cland/artifacts/log');
    await writeFile(artifact, 'durable');
    assert.equal(await retireSuiteRun(root, 'pinned', [artifact], () => true, {remove:true}), false);
    assert.equal(await retireSuiteRun(root, 'replacement', [artifact], () => true, {remove:true}), true);
  });
});
