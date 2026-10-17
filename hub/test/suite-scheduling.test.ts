// Public CLI/socket tests use tiny package fixtures, never the live project's full-suite queue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, stat, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, clandWithEnv, connectUi, eventually, startDaemon, spawnSpoke, tempProject, pidAlive, fakeCodex } from './harness.ts';
import { fixture, type ResultMessage } from './suite-fixture.ts';
import { suiteSummary } from '../src/hub/suites.ts';
import { DatabaseSync } from 'node:sqlite';
import { ownProcess } from './process-cleanup.ts';
import type { Artifact } from '../src/protocol.ts';
import type { VerificationQueue, HubStatus } from '../src/protocol.ts';
import type { ItemSummary, ItemView } from '../src/tracker/tracker.ts';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { defaultConfig, parseConfig, renderConfig } from '../src/init/config.ts';
import { cacheRepository, humanRunnerFixture } from './suite-support.ts';


// These tiny workers use project-local compatibility locks, including when run inside the full suite.
for (const budget of [1, 2]) test(`verify queues a second requester without a waiting worker (configured budget ${budget})`, async t => {
  const f = await fixture(t, 'node -e "const fs=require(\'fs\');const p=setInterval(()=>{if(fs.existsSync(\'finish\'))clearInterval(p)},50)"', undefined, '', {}, budget);
  const first = await f.launch();
  assert.equal((await f.ui.request({ type: 'role.set', session: 'other', role: 'implementer' })).ok, true);
  const other = await spawnSpoke({ discover: true, cwd: f.root, name: 'other', sessionId: 'other-caller', role: 'implementer' });
  t.after(() => other.close());
  await other.waitForPresence(['other']);
  await f.spoke.call('send', { to: ['other'], topic: f.topic, text: 'Verify this fixture' });
  await other.waitForEvent(e => e.params.content.includes('Verify this fixture'));
  // Human fixtures can address an existing topic; each request still has a distinct session identity.
  const queued = await clandWithEnv(f.root, { CLAND_SESSION_NAME: 'other', CLAND_SESSION_ID: 'other-caller', CLAND_ROLE: 'implementer' }, 'verify', 'auto', '--report', f.topic, '--to', 'rev', '--json');
  assert.equal(queued.code, 0, queued.stderr);
  const second = JSON.parse(queued.stdout) as { id: string; pid: number | null; position: number; cached?: { run: string; head: string; tree: string } };
  assert.equal(second.pid, null);
  assert.equal(second.position, 1);
  if (budget > 1) assert.match(await readFile(join(f.root, '.cland', 'log', 'hub.log'), 'utf8'), /verification-budget-capped.*\"configured\":2.*\"effective\":1.*T-215/);
  await writeFile(join(f.root, 'finish'), 'ready');
  await eventually('both admitted in order', async () => (await f.results()).length === 2 ? true : undefined);
  assert.deepEqual((await f.results()).map(r => r.id), [`suite:${first.id}`, `suite:${second.id}`]);
});

test('the compatibility lease spans typecheck and tests, so a hand runner waits for both', async t => {
  const waiting = `node -e "const fs=require('fs');fs.writeFileSync('typecheck-entered','');const p=setInterval(()=>{if(fs.existsSync('typecheck-finish'))clearInterval(p)},25)"`;
  const f = await fixture(t, `node -e "const fs=require('fs');fs.writeFileSync('tests-entered','');const p=setInterval(()=>{if(fs.existsSync('finish'))clearInterval(p)},25)"`, waiting);
  await f.launch();
  await eventually('typecheck entered', () => stat(join(f.root, 'typecheck-entered')).then(() => true, () => undefined));
  const locks = [join(f.root, 'suite.lock'), join(f.root, 'suite.lock-nvim')];
  assert.ok(await stat(locks[0]!).then(() => true, () => false), 'typecheck holds the compatibility lock');
  const records = await readdir(`${locks[0]}.runs`);
  assert.equal(records.length, 1, 'one durable record per admitted run');
  const record = JSON.parse(await readFile(join(`${locks[0]}.runs`, records[0]!), 'utf8')) as { pid: number; token: string };
  assert.equal(record.pid, JSON.parse(await readFile(`${locks[0]}.owner`, 'utf8')).pid);
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  const hand = spawn(process.execPath, ['--input-type=module', '-e', `import { runSuite } from ${JSON.stringify(runner)};process.exitCode=await runSuite([['-e', ${JSON.stringify("require('fs').writeFileSync('hand-entered','')")}]], {cwd:${JSON.stringify(f.root)},lockDirs:${JSON.stringify(locks)}})`], {cwd:f.root, stdio:['ignore','ignore','pipe']});
  ownProcess(t, hand.pid!);
  let output = ''; hand.stderr.on('data', b => { output += String(b); });
  const done = new Promise(resolve => hand.once('exit', resolve));
  await eventually('hand run waiting', () => output.includes('waiting for the suite lock') ? true : undefined);
  await writeFile(join(f.root, 'typecheck-finish'), '');
  await eventually('tests entered', () => stat(join(f.root, 'tests-entered')).then(() => true, () => undefined));
  assert.equal(await stat(join(f.root, 'hand-entered')).then(() => true, () => false), false);
  await writeFile(join(f.root, 'finish'), '');
  await eventually('hand admitted after verification', () => stat(join(f.root, 'hand-entered')).then(() => true, () => undefined));
  assert.equal(await done, 0);
});

test('a dead queued requester is cancelled with one posted note even after its role is vacated', async t => {
  const fake = await fakeCodex(t);
  const f = await fixture(t, 'node -e "process.exit(0)"', undefined, '', fake.env, undefined, undefined, startDaemon);
  await cacheRepository(f);
  const green = await f.launch();
  assert.match((await eventually('green before requester death', async () => (await f.results())[0])).text, /exit 0/);
  const created = JSON.parse((await cland(f.root, 'task', 'create', '--size', 'M', 'doomed verification', '--assignee', 'doomed', '--json')).stdout) as {item:{id:string}};
  const topicResult = await f.ui.request({type:'topic.create', title:'Doomed run', item:created.item.id});
  const topic = (topicResult.value as {topic:{id:string}}).topic.id;
  const launched = await f.ui.request({type:'session.launch', name:'doomed', role:'implementer', harness:'codex', item:created.item.id}, 30000);
  assert.equal(launched.ok, true, launched.error);
  const actor = (launched.value as {process:{pid:number; sessionId:string}}).process;
  await mkdir(join(f.root, 'suite.lock'));
  const submission = await clandWithEnv(f.root, {CLAND_SESSION_NAME:'doomed', CLAND_SESSION_ID:actor.sessionId, CLAND_ROLE:'implementer'}, 'verify', 'auto', '--fresh', '--report', topic, '--to', 'rev', '--json');
  assert.equal(submission.code, 0, submission.stderr);
  assert.equal(JSON.parse(submission.stdout).pid, null);
  process.kill(actor.pid, 'SIGKILL');
  const history = async (ui = f.ui) => {
    const result = await ui.request({type:'topic.history', topic});
    return (result.value as {messages:ResultMessage[]}).messages.filter(m => m.text.startsWith('suite result '));
  };
  const result = await eventually('cancelled requester report', async () => (await history())[0]);
  assert.match(result.text, /cancelled: requester died before admission/);
  assert.deepEqual(result.to, ['rev']);
  assert.equal(result.from, 'hub');
  await cland(f.root, 'hub', 'stop');
  const next = await startDaemon(t, f.root, fake.env);
  const ui = await connectUi(t, next.discovery);
  assert.equal((await history(ui)).length, 1);
  const hit = await f.launch();
  assert.equal(hit.cached?.run, green.id, 'requester death preserves green evidence across restart');
  await eventually('green reused after requester death', async () => {
    const result = await ui.request({type:'topic.history', topic:f.topic});
    return (result.value as {messages:ResultMessage[]}).messages.find(m => m.id === `suite:${hit.id}`);
  });
});

test('priority admits integrated dev first, then item rank, preserving the queue through restart', async t => {
  const f = await fixture(t, `node -e "const fs=require('fs');const p=setInterval(()=>{if(fs.existsSync('finish')){fs.unlinkSync('finish');clearInterval(p)}},25)"`, undefined, undefined, undefined, undefined, undefined, startDaemon);
  const git = async (...args: string[]) => promisify(execFile)('git', args, {cwd:f.root});
  await git('init', '--initial-branch=dev');
  await git('config', 'user.name', 'Priority test'); await git('config', 'user.email', 'priority@example.invalid');
  await writeFile(join(f.root, '.gitignore'), '.cland/\nsuite.lock*\nfinish\n');
  await git('add', '.'); await git('commit', '-m', 'base');
  const head = (await git('rev-parse', 'HEAD')).stdout.trim();
  await mkdir(join(f.root, 'suite.lock'));
  const low = await f.launch();
  assert.equal(low.pid, null, 'a hand lock blocks worker admission');
  const created = JSON.parse((await cland(f.root, 'task', 'create', '--size', 'M', 'higher priority', '--assignee', 'high', '--json')).stdout) as {item:{id:string}};
  await cland(f.root, 'task', 'rank', created.item.id, '--top');
  const topicResult = await f.ui.request({type:'topic.create', title:'High priority run', item:created.item.id});
  const highTopic = (topicResult.value as {topic:{id:string}}).topic.id;
  const submit = async (name: string, role: string, topic: string) => {
    assert.equal((await f.ui.request({type:'role.set', session:name, role})).ok, true);
    const spoke = await spawnSpoke({discover:true, cwd:f.root, name, sessionId:`${name}-identity`, role});
    t.after(() => spoke.close()); await spoke.waitForPresence([name]);
    const r = await clandWithEnv(f.root, {CLAND_SESSION_NAME:name, CLAND_SESSION_ID:`${name}-identity`, CLAND_ROLE:role}, 'verify', 'auto', '--report', topic, '--to', 'rev', '--json');
    assert.equal(r.code, 0, r.stderr);
    return JSON.parse(r.stdout) as {id:string;pid:number|null};
  };
  const high = await submit('high', 'implementer', highTopic);
  const integrated = await submit('coord', 'coordinator', f.topic);
  assert.equal(high.pid, null); assert.equal(integrated.pid, null);
  const before = (await f.ui.request({type:'suite.queue'})).value as VerificationQueue;
  assert.deepEqual(before.waiters.map(w => w.id), [integrated.id, high.id, low.id]);
  await cland(f.root, 'hub', 'stop');
  const next = await startDaemon(t, f.root);
  const ui = await connectUi(t, next.discovery);
  type Job = {id:string; state:string; head:string; priority:number; reported:boolean};
  const jobs = async () => (await ui.request({type:'hub.status'})).value as {suites:Job[]};
  assert.equal((await jobs()).suites.filter(j => j.state === 'queued').length, 3);
  assert.deepEqual(((await ui.request({type:'suite.queue'})).value as VerificationQueue).waiters.map(w => w.id), [integrated.id, high.id, low.id]);
  await rm(join(f.root, 'suite.lock'), {recursive:true});
  const running = async (id: string) => {
    await eventually('priority run admitted', async () => (await jobs()).suites.find(j => j.id === id && j.state === 'running'));
    const records = (await jobs()).suites;
    assert.equal(records.filter(j => j.state === 'running').length, 1);
    assert.equal(records.find(j => j.id === id)!.head, head);
    assert.equal(((await ui.request({type:'suite.queue'})).value as VerificationQueue).holder?.id, id);
    await writeFile(join(f.root, 'finish'), '');
    await eventually('priority result settled', async () => (await jobs()).suites.find(j => j.id === id && j.state === 'finished' && j.reported));
  };
  await running(integrated.id);
  await running(high.id);
  await running(low.id);
  for (const topic of [f.topic, highTopic]) {
    const history = await ui.request({type:'topic.history', topic});
    const results = (history.value as {messages:ResultMessage[]}).messages.filter(m => m.text.startsWith('suite result '));
    assert.equal(results.length, topic === f.topic ? 2 : 1);
    for (const result of results) assert.ok(result.text.includes(`head ${head}`));
  }
});

test('a hand-run package holding the old lock occupies admission until it exits', async t => {
  const f = await fixture(t, 'node -e "process.exit(0)"');
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  const locks = [join(f.root, 'suite.lock'), join(f.root, 'suite.lock-nvim')];
  const code = "const fs=require('fs');fs.writeFileSync('hand-entered','');const p=setInterval(()=>{if(fs.existsSync('hand-finish'))clearInterval(p)},25)";
  const hand = spawn(process.execPath, ['--input-type=module', '-e', `import {runSuite} from ${JSON.stringify(runner)};process.exitCode=await runSuite([['-e',${JSON.stringify(code)}]], {cwd:${JSON.stringify(f.root)},lockDirs:${JSON.stringify(locks)}})`], {cwd:f.root,env:{...process.env,CLAND_TEST_SKIP_LOCK:'0'},stdio:'ignore'});
  ownProcess(t, hand.pid!); const done = new Promise(resolve => hand.once('exit',resolve));
  await eventually('hand holds package lock', () => stat(join(f.root,'hand-entered')).then(() => true,() => undefined));
  const job = await f.launch();
  assert.equal(job.pid,null);
  const log = await readFile(join(f.root,'.cland','run','suites',job.id,'suite.log'),'utf8');
  assert.doesNotMatch(log,/\$ npm/,'not even typecheck starts beside a hand run');
  await writeFile(join(f.root,'hand-finish'),''); assert.equal(await done,0);
  const result = await eventually('verify admitted after hand exit',async () => (await f.results())[0]);
  assert.match(result.text,/auto exit 0/);
});

test('a worker lease retains phase place and publishes recovery metadata for both package phases', async t => {
  const f = await fixture(t, `${process.execPath} package.mjs`);
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  const locks = {hub:join(f.root,'suite.lock'),nvim:join(f.root,'suite.lock-nvim')};
  const file = join(f.root,'phases.test.mjs');
  await writeFile(file, `import test from 'node:test'; import assert from 'node:assert/strict'; import {existsSync,writeFileSync,readFileSync} from 'node:fs';test('phase',async()=>{const phase=existsSync('hub-entered')?'nvim':'hub';const owner=JSON.parse(readFileSync(${JSON.stringify(locks.hub+'.owner')},'utf8'));const lease=JSON.parse(process.env.CLAND_SUITE_LEASE);assert.equal(owner.pid,lease.pid);assert.equal(owner.runner.pid,process.ppid);assert.equal(owner.root,process.env.TMPDIR);writeFileSync(phase+'-entered','');while(!existsSync(phase+'-finish'))await new Promise(r=>setTimeout(r,25));});`);
  await writeFile(join(f.root,'package.mjs'), `import {runPackageSuite} from ${JSON.stringify(runner)};process.exitCode=await runPackageSuite('all',[${JSON.stringify(file)}],${JSON.stringify({cwd:f.root,lockDirs:locks})});`);
  const job = await f.launch();
  await eventually('hub phase entered',()=>stat(join(f.root,'hub-entered')).then(()=>true,()=>undefined));
  const hand = spawn(process.execPath,['--input-type=module','-e',`import {runSuite} from ${JSON.stringify(runner)};process.exitCode=await runSuite([['-e',"require('fs').writeFileSync('hand-entered','')"]],${JSON.stringify({cwd:f.root,lockDirs:Object.values(locks)})});`],{cwd:f.root,env:{...process.env,CLAND_TEST_SKIP_LOCK:'0'},stdio:['ignore','ignore','pipe']});
  ownProcess(t,hand.pid!);let log='';hand.stderr.on('data',b=>{log+=String(b)});const done=new Promise(resolve=>hand.once('exit',resolve));
  await eventually('hand waits behind both phases',()=>log.includes('waiting for the suite lock')?true:undefined);
  await writeFile(join(f.root,'hub-finish'),'');
  await eventually('Neovim phase entered',()=>stat(join(f.root,'nvim-entered')).then(()=>true,()=>undefined));
  assert.equal(await stat(join(f.root,'hand-entered')).then(()=>true,()=>false),false);
  await writeFile(join(f.root,'nvim-finish'),'');
  const result=await eventually('both phases finished',async()=>(await f.results())[0]);
  assert.equal(result.id,`suite:${job.id}`);assert.match(result.text,/auto exit 0/);assert.match(result.text,/tests 2; pass 2/);
  assert.equal(await done,0);
});

test('pre-V1 package runners acquire their own compatibility locks without a self-deadlock',async t=>{
  const f=await fixture(t,`${process.execPath} legacy.mjs`);
  const runner=fileURLToPath(new URL('./run-suite.ts',import.meta.url));
  await mkdir(join(f.root,'hub','test'),{recursive:true});
  await writeFile(join(f.root,'hub','test','run-suite.ts'),'// legacy package runner: no worker lease support');
  await writeFile(join(f.root,'legacy.mjs'),`import assert from 'node:assert/strict';import {runSuite} from ${JSON.stringify(runner)};assert.equal(process.env.CLAND_SUITE_LEASE,undefined);process.exitCode=await runSuite([['-e',"console.log('legacy package passed')"]],${JSON.stringify({cwd:f.root,lockDirs:[join(f.root,'suite.lock'),join(f.root,'suite.lock-nvim')]})});`);
  await f.launch();const result=await eventually('legacy result',async()=>(await f.results())[0]);
  assert.match(result.text,/auto exit 0/);assert.match(await readFile(result.artifacts[0]!.path,'utf8'),/legacy package passed/);
});

test('a queued request cannot pass for a different head after its worktree advances', async t => {
  const f = await fixture(t, 'node -e "require(\'fs\').writeFileSync(\'admitted\',\'yes\')"');
  const git = (...args: string[]) => promisify(execFile)('git', args, { cwd: f.root });
  await git('init', '-b', 'dev');
  await git('config', 'user.name', 'Head test');
  await git('config', 'user.email', 'head@example.invalid');
  await git('add', '.'); await git('commit', '-m', 'original build');
  const head = (await git('rev-parse', 'HEAD')).stdout.trim();
  const lock = join(f.root, 'suite.lock');
  await mkdir(lock);
  const job = await f.launch();
  assert.equal(job.pid, null);
  await git('commit', '--allow-empty', '-m', 'advanced build');
  await rm(lock, { recursive: true });
  const result = await eventually('changed-head rejection', async () => (await f.results())[0]);
  assert.match(result.text, /queued head changed/);
  assert.ok(result.text.includes(head));
  assert.match(result.text, /exit 1/);
  await assert.rejects(stat(join(f.root, 'admitted')), { code: 'ENOENT' });
  assert.equal((await f.results()).length, 1);
});
