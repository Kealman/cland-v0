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

test('suite fixture exits and closes its hub and spoke after an ownership cleanup failure', async t => {
  const root = await tempProject(t, 'cland-suite-cleanup-regression-');
  const marker = join(root, 'children.json');
  const childTest = join(root, 'cleanup.test.mjs');
  await writeFile(childTest, `import {test} from 'node:test';
import {writeFile} from 'node:fs/promises';
import cp from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {fixture} from ${JSON.stringify(new URL('./suite-fixture.ts', import.meta.url).href)};
test('forced ownership failure', async t => {
  const f = await fixture(t, 'node -e "process.exit(0)"');
  await writeFile(${JSON.stringify(marker)}, JSON.stringify([f.discovery.pid, f.spoke.pid]));
  const exec = cp.execFileSync;
  // Fail the first ownership probe in teardown, then let later cleanup retry.
  cp.execFileSync = () => {
    cp.execFileSync = exec; syncBuiltinESMExports();
    throw new Error('forced ownership probe failure');
  };
  syncBuiltinESMExports();
});`);
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const child = spawn(process.execPath, ['--test', childTest], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  ownProcess(t, child.pid);
  let output = '';
  child.stdout.on('data', data => { output += String(data); });
  child.stderr.on('data', data => { output += String(data); });
  const done = new Promise<number | null>(resolve => child.once('close', code => resolve(code)));
  const pids = await eventually('fixture children started', () => readFile(marker, 'utf8').then(text => JSON.parse(text) as number[], () => undefined)).catch(error => { throw new Error(`${error.message}: ${output}`); });
  for (const pid of pids) ownProcess(t, pid);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const code = await Promise.race([done, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`fixture file stayed alive after cleanup failure: ${output}`)), 10000);
    })]);
    assert.equal(code, 1, output);
    assert.match(output, /forced ownership probe failure/);
    for (const pid of pids) assert.equal(pidAlive(pid), false, `fixture child ${pid} survived teardown`);
  } finally {
    clearTimeout(timer);
  }
});

test('verify fails a named hung test at the configured per-test timeout', async t => {
  const f = await fixture(t, `${process.execPath} package.mjs`);
  const config = join(f.root, '.cland', 'config.toml');
  await writeFile(config, (await readFile(config, 'utf8')) + '\ntest_timeout = "1s"\n');
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  await writeFile(join(f.root, 'package.mjs'), `import {runSuite} from ${JSON.stringify(runner)}; process.exitCode = await runSuite([['--test', 'hung.test.mjs']], {cwd: ${JSON.stringify(f.root)}, lockDirs: [${JSON.stringify(join(f.root, 'suite.lock'))}, ${JSON.stringify(join(f.root, 'suite.lock-nvim'))}]});`);
  await writeFile(join(f.root, 'hung.test.mjs'), `import {test} from 'node:test'; test('never resolves', async t => {const timer = setInterval(() => {}, 1000); t.after(() => clearInterval(timer)); await new Promise(() => {});});`);
  await f.launch();
  const result = await eventually('hung test times out', async () => (await f.results())[0], 8000);
  assert.match(result.text, /exit 1/);
  const log = await readFile(result.artifacts[0]!.path, 'utf8');
  assert.match(log, /never resolves/);
  assert.match(log, /test timed out after 1000ms/);
});

test('verify kills a silent test tree and spoke, names the last started test and frees admission', async t => {
  const f = await fixture(t, `${process.execPath} package.mjs`);
  const config = join(f.root, '.cland', 'config.toml');
  await writeFile(config, (await readFile(config, 'utf8')) + '\nstall_timeout = "3s"\n');
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  const harness = fileURLToPath(new URL('./harness.ts', import.meta.url));
  const marker = join(f.root, 'pids.json');
  await writeFile(join(f.root, 'package.mjs'), `import {runSuite} from ${JSON.stringify(runner)}; process.exitCode = await runSuite([['--test', 'silent.test.mjs']], {cwd: ${JSON.stringify(f.root)}, lockDirs: [${JSON.stringify(join(f.root, 'suite.lock'))}, ${JSON.stringify(join(f.root, 'suite.lock-nvim'))}]});`);
  await writeFile(join(f.root, 'silent.test.mjs'), `import {test} from 'node:test'; import {spawn} from 'node:child_process'; import {writeFile} from 'node:fs/promises'; import {spawnSpoke} from ${JSON.stringify(harness)};
test('silent with a spoke', async () => {
  const spoke = await spawnSpoke({unconfigured: true});
  const stubborn = spawn(process.execPath, ['-e', "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"], {detached: true, stdio: 'ignore'});
  await writeFile(${JSON.stringify(marker)}, JSON.stringify([process.pid, spoke.pid, stubborn.pid]));
  await new Promise(() => {});
});`);
  const job = await f.launch();
  const pids = await eventually('silent test owns children', () => readFile(marker, 'utf8').then(text => JSON.parse(text) as number[], () => undefined));
  for (const pid of pids) ownProcess(t, pid);
  const result = await eventually('stall reported after cleanup', async () => (await f.results())[0], 20000);
  assert.match(result.text, /exit 1/);
  assert.match(result.text, /stalled: no output for 0\.05 min/);
  assert.match(result.text, /last started tests:.*silent with a spoke/);
  const log = await readFile(result.artifacts[0]!.path, 'utf8');
  assert.match(log, /last started tests:.*silent with a spoke/);
  for (const pid of [...pids, job.pid!]) assert.equal(pidAlive(pid), false, `orphan pid ${pid}`);
  await writeFile(join(f.root, 'package.mjs'), "console.log('successor passed')");
  const next = await f.launch();
  const passed = await eventually('successor admitted after stall', async () => (await f.results()).find(m => m.id === `suite:${next.id}`));
  assert.match(passed.text, /exit 0/);
  assert.equal((await f.results()).length, 2);
});

test('verification timeout policy defaults, validates durations and survives config updates', () => {
  const defaults = defaultConfig('fixture').verification;
  assert.equal(defaults.testTimeoutMs, 120000);
  assert.equal(defaults.stallTimeoutMs, 600000);
  const config = parseConfig('[verification]\ntest_timeout="3m"\nstall_timeout="20m"', 'fixture');
  assert.equal(config.verification.testTimeoutMs, 180000);
  assert.equal(config.verification.stallTimeoutMs, 1200000);
  assert.deepEqual(parseConfig(renderConfig(config), 'fixture'), config);
  for (const key of ['test_timeout', 'stall_timeout']) {
    for (const value of ['"0s"', '"oops"', '1000']) assert.throws(() => parseConfig(`[verification]\n${key}=${value}`, 'fixture'), new RegExp(key));
  }
});

test('verify reaps a captured detached pipe holder after npm exits and preserves an unrelated process', async t => {
  const f = await fixture(t, `${process.execPath} parent.mjs`);
  const config = join(f.root, '.cland', 'config.toml');
  await writeFile(config, (await readFile(config, 'utf8')) + '\nstall_timeout="3s"\n');
  const marker = join(f.root, 'pipe-holder.json');
  await writeFile(join(f.root, 'parent.mjs'), `import {spawn} from 'node:child_process'; import {writeFile} from 'node:fs/promises';
const child = spawn(process.execPath, ['-e', "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"], {detached: true, stdio: 'inherit'});
await writeFile(${JSON.stringify(marker)}, JSON.stringify({parent:process.pid,child:child.pid}));
setInterval(()=>console.log('parent running'),250);
setTimeout(()=>process.exit(0),3000);`);
  const foreign = spawn(process.execPath, ['-e', "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"], { cwd: f.root, detached: true, stdio: 'ignore' });
  ownProcess(t, foreign.pid);
  const job = await f.launch();
  const pids = await eventually('inherited pipe holder started', () => readFile(marker, 'utf8').then(text => JSON.parse(text) as { parent: number; child: number }, () => undefined));
  ownProcess(t, pids.parent); ownProcess(t, pids.child);
  await eventually('command parent exited before its pipe holder', () => !pidAlive(pids.parent) && pidAlive(pids.child) ? true : undefined);
  const result = await eventually('exited-parent stall is reported after reaping', async () => (await f.results()).find(m => m.id === `suite:${job.id}`), 20000);
  assert.match(result.text, /stalled: no output for 0\.05 min/);
  assert.equal(pidAlive(pids.child), false, 'detached inherited-pipe orphan was reaped');
  assert.equal(pidAlive(job.pid!), false);
  assert.equal(pidAlive(foreign.pid!), true, 'unrelated identical command in the same cwd is preserved');
  await writeFile(join(f.root, 'parent.mjs'), "console.log('successor passed')");
  const next = await f.launch();
  assert.match((await eventually('successor after exited-parent stall', async () => (await f.results()).find(m => m.id === `suite:${next.id}`))).text, /exit 0/);
});

test('verify reports unverified fast-exit pipe cleanup once, preserves unrelated processes and admits its successor', async t => {
  const bin = await tempProject(t, 'cland-fast-exit-ps-');
  const ps = (await promisify(execFile)('which', ['ps'])).stdout.trim();
  const armed = join(bin, 'armed'); const snapshot = join(bin, 'snapshot');
  await writeFile(join(bin, 'ps'), `#!${process.execPath}
import {spawnSync} from 'node:child_process'; import {existsSync,writeFileSync} from 'node:fs';
const result=spawnSync(${JSON.stringify(ps)}, process.argv.slice(2), {encoding:'utf8'});
process.stdout.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? '');
if (process.argv.includes('-e') && existsSync(${JSON.stringify(armed)}) && !existsSync(${JSON.stringify(snapshot)})) writeFileSync(${JSON.stringify(snapshot)},'captured');
process.exitCode=result.status ?? 1;`, {mode:0o700});
  const f = await fixture(t, `${process.execPath} fast-parent.mjs`, undefined, '[hygiene]\nloop_breaker_max=2\n', {PATH:`${bin}:${process.env.PATH ?? ''}`});
  const config = join(f.root, '.cland', 'config.toml');
  await writeFile(config, (await readFile(config, 'utf8')) + '\nstall_timeout="3s"\n');
  const marker = join(f.root, 'fast-pids.json');
  await writeFile(join(f.root, 'fast-parent.mjs'), `import {spawn} from 'node:child_process'; import {writeFile} from 'node:fs/promises'; import {existsSync} from 'node:fs'; import {setTimeout as pause} from 'node:timers/promises';
const heartbeat=setInterval(()=>console.log('waiting for ownership snapshot'),100);
await writeFile(${JSON.stringify(armed)}, 'ready');
while(!existsSync(${JSON.stringify(snapshot)})) await pause(5);
const child=spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"],{detached:true,stdio:'inherit'});
await writeFile(${JSON.stringify(marker)},JSON.stringify({parent:process.pid,child:child.pid}));
clearInterval(heartbeat);process.exit(0);`);
  const foreign = spawn(process.execPath, ['-e', "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"], {cwd:f.root, detached:true, stdio:'ignore'});
  ownProcess(t, foreign.pid);
  for (let n=0;n<3;n++) await f.spoke.call('send',{to:['rev'],topic:f.topic,text:`seed ${n}`});
  const job = await f.launch();
  const pids = await eventually('fast pipe holder started after snapshot', () => readFile(marker,'utf8').then(text=>JSON.parse(text) as {parent:number;child:number},()=>undefined));
  ownProcess(t,pids.parent);ownProcess(t,pids.child);
  const warnings = async () => ((await f.ui.request({type:'topic.history',topic:'agents'})).value as {messages:Array<{id:string;severity?:string;text:string}>}).messages.filter(m=>m.id===`suite-cleanup:${job.id}`);
  const notice = await eventually('one cleanup warning',async()=> (await warnings())[0]);
  assert.equal(notice.severity,'warn'); assert.match(notice.text,/cleanup incomplete/);
  await eventually('result is held by mute after warning',async()=> {
    const status=(await f.ui.request({type:'hub.status'})).value as HubStatus;
    return status.suites?.find(s=>s.id===job.id)?.error?.includes('loop breaker') ? true : undefined;
  });
  assert.equal((await f.results()).length,0);
  const inbox = (await f.ui.request({type:'inbox.list'})).value as {messages:Array<{id:string;severity?:string;layer?:string}>};
  const inboxWarnings = inbox.messages.filter(m=>m.id===notice.id);
  assert.equal(inboxWarnings.length,1);assert.equal(inboxWarnings[0]!.severity,'warn');assert.equal(inboxWarnings[0]!.layer,'now');
  const successorMarker = join(f.root,'successor-ran');
  await writeFile(join(f.root,'fast-parent.mjs'),`import {writeFile} from 'node:fs/promises'; await writeFile(${JSON.stringify(successorMarker)},'passed');`);
  const next = await f.launch();
  await eventually('successor admitted while original report is held',()=>readFile(successorMarker,'utf8').then(text=>text==='passed'?true:undefined,()=>undefined));
  assert.equal((await f.ui.request({type:'hygiene.unmute',a:'impl',b:'rev'})).ok,true);
  const result = await eventually('fast-exit incomplete cleanup result', async ()=>(await f.results()).find(m=>m.id===`suite:${job.id}`),20000);
  assert.match(result.text,/exit 1.*stalled:.*cleanup incomplete: unverified inherited-pipe writer/);
  assert.equal(pidAlive(pids.child),true,'unverified writer is preserved rather than falsely claimed reaped');
  assert.equal(pidAlive(foreign.pid!),true);
  assert.match((await eventually('successor after incomplete cleanup',async()=>(await f.results()).find(m=>m.id===`suite:${next.id}`))).text,/exit 0/);
  await f.ui.request({type:'hub.status',flushLogs:true});
  const journal=(await readFile(join(f.root,'.cland/journal.jsonl'),'utf8')).trim().split('\n').map(line=>JSON.parse(line));
  assert.equal(journal.filter(r=>r.event==='verification-cleanup-incomplete'&&r.id===job.id).length,1);
  assert.equal((await warnings()).length,1);
});

test('verify keeps a slow command alive while partial stderr output continues', async t => {
  const f = await fixture(t, `node -e "let n=0;const timer=setInterval(()=>{process.stderr.write('.');if(++n===25)clearInterval(timer)},200)"`);
  const config = join(f.root, '.cland', 'config.toml');
  await writeFile(config, (await readFile(config, 'utf8')) + '\nstall_timeout="3s"\n');
  const job = await f.launch();
  const result = await eventually('partial output prevents stall', async () => (await f.results()).find(m => m.id === `suite:${job.id}`));
  assert.match(result.text, /exit 0/);
  assert.doesNotMatch(await readFile(result.artifacts[0]!.path, 'utf8'), /stalled:/);
});

test('verify card follows branch jobs through finish and cache, updates the UI silently and survives restart', async t => {
  const f = await fixture(t, 'node -e "process.exit(0)"');
  const git = await cacheRepository(f);
  const head = await git('rev-parse', 'HEAD');
  const made = await f.ui.request({ size: 'M', type: 'task.create', title: 'Branch card', branch: 'candidate' });
  const item = (made.value as { item: ItemView }).item;
  await f.ui.request({ type: 'subscribe' });
  await f.spoke.call('subscribe', { subject: { item: item.id }, events: ['task'], digest: 'now' });
  const from = f.ui.frames.length;
  const job = await f.launch();
  const report = await eventually('first result', async () => (await f.results())[0]);
  const card = await eventually('branch verify has the log artifact', async () => {
    const list = await f.ui.request({ type: 'task.list' });
    const card = (list.value as { items: ItemSummary[] }).items.find(i => i.id === item.id);
    return card?.verify?.id === job.id && card.verify.artifact ? card : undefined;
  });
  assert.deepEqual(card.verify, { executor: 'local', id: job.id, state: 'finished', result: 'passed', head, finished: card.verify!.finished, artifact: report.artifacts[0]!.id });
  assert.equal(card.verify!.executor, 'local');
  assert.ok(card.verify!.finished);
  const frames = f.ui.frames.slice(from).filter(frame => frame.type === 'task' && (frame.item as ItemSummary)?.id === item.id);
  assert.equal(frames.filter(frame => (frame.item as ItemSummary).verify?.result === 'passed').length, 1, 'one terminal card, including the artifact');
  for (const frame of frames) assert.equal((frame as { events?: unknown }).events, undefined);
  assert.equal(f.spoke.events.filter(n => n.params.content.includes(item.id)).length, 0, 'no item event delivery');
  const detail = await f.ui.request({ type: 'task.view', item: item.id });
  assert.deepEqual((detail.value as { item: ItemView }).item.verify, card.verify);
  assert.equal(JSON.parse((await cland(f.root, 'task', 'view', item.id, '--json')).stdout).item.verify.executor, 'local');
  const cached = await f.launch();
  assert.equal(cached.cached?.run, job.id);
  await eventually('cached card', async () => {
    const list = await f.ui.request({ type: 'task.list' });
    const card = (list.value as { items: ItemSummary[] }).items.find(i => i.id === item.id);
    return card?.verify?.id === cached.id && card.verify.artifact ? card : undefined;
  });
  assert.match((await cland(f.root, 'task', 'view', item.id)).stdout, /verify +.*passed.*cached/);
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  await startDaemon(t, f.root);
  const after = JSON.parse((await cland(f.root, 'task', 'list', '--json')).stdout).items.find((i: { id: string }) => i.id === item.id);
  assert.equal(after.verify.id, cached.id);
  assert.deepEqual(after.verify.cached, cached.cached);
});

for (const result of ['failed', 'cancelled'] as const) test(`verify card exposes ${result} by item, with queued results left null`, async t => {
  const f = await fixture(t, 'node -e "process.exit(1)"');
  const read = async () => ((await f.ui.request({ type: 'task.list' })).value as { items: ItemSummary[] }).items[0]!;
  assert.equal((await read()).verify, null);
  if (result === 'cancelled') await mkdir(join(f.root, 'suite.lock'));
  const job = await f.launch();
  if (result === 'cancelled') {
    const queued = (await read()).verify!;
    assert.equal(queued.id, job.id);
    assert.equal(queued.state, 'queued');
    assert.equal(queued.result, null);
    assert.equal(queued.finished, null);
    assert.equal(queued.artifact, null);
    assert.equal((await f.ui.request({ type: 'suite.cancel', suite: job.id })).ok, true);
  }
  const card = await eventually(`${result} card with artifact`, async () => {
    const card = await read();
    return card.verify?.result === result && card.verify.artifact ? card : undefined;
  });
  assert.equal(card.verify!.state, 'finished');
  assert.ok(card.verify!.finished);
  assert.equal(card.verify!.id, job.id);
});

test('verify refuses every unclassified hub test before reserving a queue slot, then admits classifications', async t => {
  const f = await fixture(t, 'node -e "process.exit(0)"');
  await mkdir(join(f.root, 'hub/test'), { recursive: true });
  await mkdir(join(f.root, 'hub/src'), { recursive: true });
  await writeFile(join(f.root, 'hub/test/new.test.ts'), 'setTimeout(() => {}, 1);\n');
  await writeFile(join(f.root, 'hub/src/new.test.ts'), '// another test\n');
  await writeFile(join(f.root, 'hub/test/shards.json'), JSON.stringify({ version: 1, tests: {} }));
  // A hand holder makes an incorrectly admitted request remain observable in the queue.
  await mkdir(join(f.root, 'suite.lock'));
  const before = await f.ui.request({ type: 'hub.status' });
  const failed = await f.ui.request({ type: 'suite.start', mode: 'all', cwd: f.root, report: f.topic, to: ['rev', 'impl'] });
  assert.equal(failed.ok, false, JSON.stringify(failed));
  assert.equal((failed as { code?: string }).code, 'verify-shards');
  assert.deepEqual((failed as { files?: string[] }).files, ['hub/src/new.test.ts', 'hub/test/new.test.ts']);
  assert.ok(failed.error!.includes('"hub/src/new.test.ts": "machine",'));
  assert.ok(failed.error!.includes('"hub/test/new.test.ts": "machine",'));
  const status = await f.ui.request({ type: 'hub.status' });
  assert.deepEqual((status.value as HubStatus).suites, (before.value as HubStatus).suites, 'refusal creates no durable suite');
  const queue = await f.ui.request({ type: 'suite.queue' });
  assert.deepEqual((queue.value as VerificationQueue).waiters, []);
  const cli = await clandWithEnv(f.root, f.env, 'verify', 'all', '--report', f.topic, '--to', 'rev', '--json');
  assert.notEqual(cli.code, 0);
  assert.match(cli.stderr, /verify-shards.*unclassified hub tests/s);
  assert.equal((await f.results()).length, 0, 'refusal publishes no suite result');
  await writeFile(join(f.root, 'hub/test/shards.json'), JSON.stringify({ version: 1, tests: {
    'hub/src/new.test.ts': 'free', 'hub/test/new.test.ts': 'free',
  } }));
  const resource = await f.ui.request({ type: 'suite.start', mode: 'all', cwd: f.root, report: f.topic, to: ['rev', 'impl'] });
  assert.equal(resource.ok, false);
  assert.match(resource.error!, /free hub test touches machine resources/);
  await writeFile(join(f.root, 'hub/test/shards.json'), JSON.stringify({ version: 1, tests: {
    'hub/src/new.test.ts': 'machine', 'hub/test/new.test.ts': 'machine',
  } }));
  const job = await f.launch();
  assert.equal(job.pid, null);
  assert.equal(job.position, 1, 'refused requests consume no queue position');
  await rm(join(f.root, 'suite.lock'), { recursive: true });
  const result = await eventually('classified suite passed', async () => (await f.results())[0]);
  assert.match(result.text, /all exit 0/);
});

for (const capture of ['before change', 'after change'] as const) test(`verify classifies the submitted head without a queue slot when HEAD is captured ${capture}`, async t => {
  const bin = await tempProject(t, 'cland-suite-shard-head-');
  const realGit = (await promisify(execFile)('which', ['git'])).stdout.trim();
  await writeFile(join(bin, 'git'), `#!${process.execPath}
import { existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
const args = process.argv.slice(2);
if (args.join(' ') === 'rev-parse HEAD' && existsSync('hold-head')) {
  const captured = ${JSON.stringify(capture)} === 'before change' ? spawnSync(${JSON.stringify(realGit)}, args, { encoding: 'utf8' }) : null;
  writeFileSync('head-held', 'held');
  while (!existsSync('release-head')) await pause(25);
  const result = captured ?? spawnSync(${JSON.stringify(realGit)}, args, { encoding: 'utf8' });
  process.stdout.write(result.stdout); process.stderr.write(result.stderr); process.exitCode = result.status ?? 1;
} else process.exitCode = spawnSync(${JSON.stringify(realGit)}, args, { stdio: 'inherit' }).status ?? 1;
`, { mode: 0o700 });
  const f = await fixture(t, 'node -e "process.exit(0)"', undefined, '', { PATH: `${bin}:${process.env.PATH ?? ''}` });
  const git = (...args: string[]) => promisify(execFile)(realGit, args, { cwd: f.root });
  await git('init', '-b', 'dev');
  await git('config', 'user.name', 'Shard head test'); await git('config', 'user.email', 'shards@example.invalid');
  await writeFile(join(f.root, '.gitignore'), '.cland/\nsuite.lock*\nhold-head\nhead-held\nrelease-head\n');
  await mkdir(join(f.root, 'hub/test'), { recursive: true });
  await writeFile(join(f.root, 'hub/test/shards.json'), JSON.stringify({ version: 1, tests: {} }));
  await git('add', '.'); await git('commit', '-m', 'Classified baseline');
  await mkdir(join(f.root, 'suite.lock'));
  await writeFile(join(f.root, 'hold-head'), 'hold');
  const pending = f.ui.request({ type: 'suite.start', mode: 'all', cwd: f.root, report: f.topic, to: ['rev', 'impl'] });
  await eventually('head capture held', () => stat(join(f.root, 'head-held')).then(() => true, () => undefined));
  await writeFile(join(f.root, 'hub/test/advanced.test.ts'), '// unclassified new head\n');
  await git('add', 'hub'); await git('commit', '-m', 'Advance to unclassified head');
  // The worktree is now classified, so immutable-head lint / the final HEAD fence must decide.
  await writeFile(join(f.root, 'hub/test/shards.json'), JSON.stringify({ version: 1, tests: { 'hub/test/advanced.test.ts': 'free' } }));
  await writeFile(join(f.root, 'release-head'), 'release');
  const failed = await pending;
  assert.equal(failed.ok, false, JSON.stringify(failed));
  assert.match(failed.error!, capture === 'before change' ? /head changed during submission/ : /verify-shards.*advanced\.test\.ts/s);
  const status = await f.ui.request({ type: 'hub.status' });
  assert.deepEqual((status.value as HubStatus).suites, [], 'head change cannot reserve a suite');
  const queue = await f.ui.request({ type: 'suite.queue' });
  assert.deepEqual((queue.value as VerificationQueue).waiters, []);
});

test('scratch daemon defaults to fixture leases when the project has no verification override', async t => {
  const root = await tempProject(t, 'cland-scratch-lease-');
  const { discovery } = await startDaemon(t, root, { TZ: 'Pacific/Honolulu' });
  const lock = join(root, 'suite.lock');
  await mkdir(lock);
  await writeFile(`${lock}.owner`, JSON.stringify({ pid: process.pid, started: null, token: 'scratch', worktree: root, since: '2026-10-12T00:00:00Z' }));
  const ui = await connectUi(t, discovery);
  const q = (await ui.request({ type: 'suite.queue' })).value as VerificationQueue;
  assert.equal(q.holder?.kind, 'hand run');
  assert.equal(q.holder?.pid, process.pid);
  assert.equal(q.holder?.worktree, root);
});

for (const legacy of [false, true]) test(`verify queue preserves a live ${legacy ? 'legacy' : 'UTC'} package holder across observer timezones`, async t => {
  const f = await fixture(t, 'node -e "process.exit(0)"', undefined, '', { TZ: 'Pacific/Honolulu' });
  const lock = join(f.root, 'suite.lock');
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  const marker = join(f.root, 'hand-started');
  const finish = join(f.root, 'hand-finish');
  const file = join(f.root, 'hand.mjs');
  await writeFile(file, `import test from 'node:test'; import { existsSync, writeFileSync } from 'node:fs'; test('hand holder', async () => { writeFileSync(${JSON.stringify(marker)}, 'ready'); while (!existsSync(${JSON.stringify(finish)})) await new Promise(r => setTimeout(r, 25)); });`);
  const child = spawn(process.execPath, ['--input-type=module', '-e', `import { runPackageSuite } from ${JSON.stringify(runner)}; process.exitCode = await runPackageSuite('all', [${JSON.stringify(file)}], { cwd: ${JSON.stringify(f.root)}, lockDirs: { hub: ${JSON.stringify(lock)}, nvim: ${JSON.stringify(`${lock}-nvim`)} } });`], {
    env: { ...process.env, NODE_TEST_CONTEXT: '', CLAND_TEST_SKIP_LOCK: '0', TZ: 'UTC' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  ownProcess(t, child.pid);
  let output = '';
  child.stdout.on('data', data => { output += String(data); });
  child.stderr.on('data', data => { output += String(data); });
  const done = new Promise<number | null>((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  t.after(async () => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM'); await done; });
  await eventually('live package holder', () => readFile(marker, 'utf8').then(() => true, () => undefined));
  if (legacy) for (const dir of [lock, `${lock}-nvim`]) {
    const owner = JSON.parse(await readFile(`${dir}.owner`, 'utf8'));
    delete owner.startedUtc;
    await writeFile(`${dir}.owner`, JSON.stringify(owner));
    await writeFile(join(dir, 'holder.json'), JSON.stringify(owner));
  }
  const owner = JSON.parse(await readFile(`${lock}.owner`, 'utf8')) as { pid: number; since: string; token: string };
  assert.equal(owner.pid, child.pid);
  assert.equal((await f.ui.request({ type: 'subscribe' })).ok, true);
  const queue = (await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue;
  assert.equal(queue.holder?.kind, 'hand run', output);
  assert.equal(queue.holder?.pid, child.pid);
  assert.equal(queue.holder?.worktree, f.root);
  assert.equal(queue.holder?.since, owner.since);
  const cli = await clandWithEnv(f.root, f.env, 'verify', 'queue', '--json');
  assert.equal(cli.code, 0, cli.stderr);
  assert.equal((JSON.parse(cli.stdout) as VerificationQueue).holder?.pid, child.pid);
  const text = await cland(f.root, 'verify', 'queue');
  assert.equal(text.code, 0, text.stderr);
  assert.ok(text.stdout.includes(`since ${owner.since}`), text.stdout);
  await f.ui.waitFor(frame => frame.type === 'verification.queue' && (frame.queue as VerificationQueue).holder?.pid === child.pid);
  const waiting = await f.launch();
  assert.equal(waiting.pid, null, 'hub admission must leave the live hand holder alone');
  assert.equal(child.signalCode, null, output);
  assert.equal(JSON.parse(await readFile(`${lock}.owner`, 'utf8')).token, owner.token);
  await writeFile(finish, 'done');
  assert.equal(await done, 0, output);
  await eventually('queued run completes after hand release', async () => (await f.results())[0]);
});

test('verify queue shows a hand holder, ordered waiters and unknown ETA; survives restart', async t => {
  const f = await fixture(t, 'node -e "process.exit(0)"');
  const lock = join(f.root, 'suite.lock');
  await mkdir(lock);
  await writeFile(join(lock, 'holder.json'), JSON.stringify({ pid: process.pid, started: null, since: new Date().toISOString(), token: 'hand', worktree: '/hand/worktree' }));
  const first = await f.launch();
  assert.equal((await f.ui.request({ type: 'subscribe' })).ok, true);
  await f.ui.waitFor(frame => frame.type === 'verification.queue' && (frame.queue as VerificationQueue).waiters.some(w => w.id === first.id));
  assert.equal(first.pid, null);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'other', role: 'implementer' })).ok, true);
  const other = await spawnSpoke({ discover: true, cwd: f.root, name: 'other', sessionId: 'queue-other', role: 'implementer' });
  t.after(() => other.close()); await other.waitForPresence(['other']);
  const item = JSON.parse((await cland(f.root, 'task', 'create', '--size', 'M', 'other queue request', '--assignee', 'other', '--json')).stdout) as { item: { id: string } };
  const topic = await f.ui.request({ type: 'topic.create', title: 'Other queue request', item: item.item.id });
  const otherTopic = (topic.value as { topic: { id: string } }).topic.id;
  const submitted = await clandWithEnv(f.root, { CLAND_SESSION_NAME: 'other', CLAND_SESSION_ID: 'queue-other' }, 'verify', 'all', '--report', otherTopic, '--to', 'rev', '--json');
  assert.equal(submitted.code, 0, submitted.stderr);
  const second = JSON.parse(submitted.stdout) as { id: string };
  const check = async () => {
    const cli = await clandWithEnv(f.root, f.env, 'verify', 'queue', '--json');
    assert.equal(cli.code, 0, cli.stderr);
    const q = JSON.parse(cli.stdout) as VerificationQueue;
    assert.equal(q.version, 1);
    assert.equal(q.holder?.kind, 'hand run');
    assert.equal(q.holder?.pid, process.pid);
    assert.equal(q.holder?.worktree, '/hand/worktree');
    assert.deepEqual(q.waiters.map(w => [w.id, w.position, w.session]), [[first.id, 1, 'impl'], [second.id, 2, 'other']]);
    assert.ok(q.waiters.every(w => w.waitMs >= 0 && w.etaMs === null));
    assert.equal(q.metrics.window, 20); assert.equal(q.metrics.run.count, 0);
    const text = await cland(f.root, 'verify', 'queue');
    assert.equal(text.code, 0, text.stderr);
    assert.match(text.stdout, /local: hand run/); assert.match(text.stdout, /1\. impl.*wait .*ETA unknown/);
    const invalid = await cland(f.root, 'verify', 'queue', '--fresh');
    assert.notEqual(invalid.code, 0);
  };
  await check();
  await cland(f.root, 'hub', 'stop'); await startDaemon(t, f.root);
  await check();
});

test('verify records wait/run timings, zero-time cache hits, recent median/p90 and a mode-aware ETA', async t => {
  const f = await fixture(t, `node -e "const fs=require('fs');fs.appendFileSync('executions','run\\n');const p=setInterval(()=>{if(fs.existsSync('finish'))clearInterval(p)},25)"`, undefined, '[hygiene]\nrate_limit_max = 100\nloop_breaker_max = 100\n');
  const git = await cacheRepository(f);
  await git('config', 'user.name', 'Metrics test');
  // Fixture signals are outside the candidate tree, so completing a run can seed the cache.
  await writeFile(join(f.root, '.gitignore'), (await readFile(join(f.root, '.gitignore'), 'utf8')) + 'finish\n');
  await git('add', '.gitignore'); await git('commit', '-m', 'ignore completion signal');
  const lock = join(f.root, 'suite.lock');
  await mkdir(lock);
  const first = await f.launch();
  const waiting = await f.ui.request({ type: 'suite.queue' });
  assert.equal(waiting.ok, true, waiting.error);
  assert.ok((waiting.value as VerificationQueue).waiters[0]!.waitMs > 0);
  await rm(lock, { recursive: true });
  await eventually('running queue holder', async () => {
    const q = (await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue;
    return q.holder?.id === first.id && q.holder.runMs !== null ? q : undefined;
  });
  await writeFile(join(f.root, 'finish'), '');
  await eventually('measured execution', async () => (await f.results())[0]);
  const measured = (await f.ui.request({ type: 'hub.status' })).value as HubStatus;
  const run = measured.suites!.find(j => j.id === first.id)!;
  assert.ok(run.waitMs! > 0); assert.ok(run.runMs! > 0);
  assert.ok(run.admittedAt && run.completedAt);
  await mkdir(lock);
  const hit = await f.launch();
  assert.equal(hit.cached?.run, first.id);
  await eventually('zero-time cache completion', async () => (await f.results())[1]);
  const status = (await f.ui.request({ type: 'hub.status', flushLogs: true })).value as HubStatus;
  const cached = status.suites!.find(j => j.id === hit.id)!;
  assert.equal(cached.waitMs, 0); assert.equal(cached.runMs, 0);
  assert.equal(cached.finished, run.finished, 'expiry still refers to original completion');
  assert.notEqual(cached.completedAt, run.completedAt, 'metrics refer to this request');
  assert.equal(run.executor, 'local');
  assert.ok(run.platform);
  assert.equal(cached.executor, run.executor);
  assert.deepEqual(cached.platform, run.platform);
  const stats = status.verification!.metrics;
  assert.equal(stats.count, 2);
  assert.equal(stats.run.count, 2);
  assert.equal(stats.run.medianMs, run.runMs! / 2);
  assert.equal(stats.run.p90Ms, run.runMs);
  assert.equal(stats.wait.medianMs, run.waitMs! / 2);
  assert.equal(stats.wait.p90Ms, run.waitMs);
  const journal = (await readFile(join(f.root, '.cland', 'journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line) as Record<string, unknown>);
  const recorded = journal.filter(e => e.event === 'verification-timing');
  assert.equal(recorded.length, 2);
  assert.equal(recorded.find(e => e.id === hit.id)?.runMs, 0);
  for (const id of [first.id, hit.id]) for (const event of ['verification-timing', 'suite-result']) {
    const entry = journal.find(e => e.id === id && e.event === event);
    assert.equal(entry?.executor, 'local');
    assert.deepEqual(entry?.platform, run.platform);
  }
  await writeFile(join(lock, 'holder.json'), JSON.stringify({ pid: process.pid, started: null, since: new Date().toISOString(), token: 'hand' }));
  const fresh = await f.launch('all', '--fresh');
  const queue = (await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue;
  assert.equal(queue.waiters[0]!.id, fresh.id);
  assert.equal(queue.waiters[0]!.expectedRunMs, run.runMs, 'cache zeros do not shorten executed-run estimates');
  assert.ok(queue.waiters[0]!.etaMs !== null && queue.waiters[0]!.etaMs! >= 0);
  assert.equal((await f.ui.request({type:'role.set', session:'next', role:'implementer'})).ok, true);
  const nextSpoke = await spawnSpoke({discover:true, cwd:f.root, name:'next', sessionId:'metrics-next', role:'implementer'});
  t.after(() => nextSpoke.close()); await nextSpoke.waitForPresence(['next']);
  await f.spoke.call('send', {to:['next'], topic:f.topic, text:'Verify the metrics fixture'});
  await nextSpoke.waitForEvent(e => e.params.content.includes('Verify the metrics fixture'));
  const nextRequest = await clandWithEnv(f.root, {CLAND_SESSION_NAME:'next', CLAND_SESSION_ID:'metrics-next'}, 'verify', 'all', '--fresh', '--report', f.topic, '--to','rev','--json');
  assert.equal(nextRequest.code, 0, nextRequest.stderr);
  const nextJob = JSON.parse(nextRequest.stdout) as {id:string};
  const ordered = (await f.ui.request({type:'suite.queue'})).value as VerificationQueue;
  assert.deepEqual(ordered.waiters.map(w => w.id), [fresh.id, nextJob.id]);
  assert.equal(ordered.waiters[1]!.etaMs! - ordered.waiters[0]!.etaMs!, run.runMs, 'second ETA includes the first execution duration');
  await cland(f.root, 'hub', 'stop');
  const next = await startDaemon(t, f.root);
  const ui = await connectUi(t, next.discovery);
  const restored = (await ui.request({ type: 'hub.status' })).value as HubStatus;
  assert.deepEqual(restored.verification!.metrics, stats);
  assert.equal(restored.suites!.find(j => j.id === first.id)!.runMs, run.runMs);
  assert.equal((await ui.request({ type: 'suite.cancel', suite: fresh.id })).ok, true);
  assert.equal((await ui.request({ type: 'suite.cancel', suite: nextJob.id })).ok, true);
  await eventually('queued cancellation measured', async () => {
    const s = (await ui.request({ type: 'hub.status' })).value as HubStatus;
    const cancelled = s.suites!.find(j => j.id === fresh.id)!;
    if (!cancelled.reported) return undefined;
    assert.equal(cancelled.runMs, 0); assert.ok(cancelled.waitMs! > 0);
    return true;
  });
  await rm(lock, {recursive:true});
  const replacement = await f.launch('all', '--fresh');
  await eventually('new green after fresh cancellation', async () => ((await ui.request({type:'hub.status'})).value as HubStatus).suites!.find(j => j.id === replacement.id && j.reported));
  await mkdir(lock);
  for (let n = 0; n < 20; n++) {
    const hit = await f.launch();
    assert.equal(hit.cached?.run, replacement.id);
    await eventually('cache timing settled', async () => ((await ui.request({type:'hub.status'})).value as HubStatus).suites!.find(j => j.id === hit.id && j.reported));
  }
  const bounded = (await ui.request({ type: 'suite.queue' })).value as VerificationQueue;
  assert.equal(bounded.waiters.length, 0, 'hits complete even while the compatibility lock is held');
  assert.deepEqual(bounded.metrics, { window: 20, count: 20, wait: { count: 20, medianMs: 0, p90Ms: 0 }, run: { count: 20, medianMs: 0, p90Ms: 0 } });
});

test('auto suite reports the fetched diff decision and transports it to the package; --all forces full', async t => {
  const f = await fixture(t, 'node -e "console.log(process.env.CLAND_SUITE_SELECTION)"');
  const exec = promisify(execFile);
  const git = async (...args: string[]) => exec('git', args, { cwd: f.root });
  const remote = join(f.root, 'origin.git');
  await git('init', '--initial-branch=dev');
  await git('config', 'user.name', 'Suite report test'); await git('config', 'user.email', 'suite@example.invalid');
  await writeFile(join(f.root, '.gitignore'), '.cland/\norigin.git/\nsuite.lock*\n');
  await git('add', '.'); await git('commit', '-m', 'base');
  await git('init', '--bare', remote); await git('remote', 'add', 'origin', remote); await git('push', 'origin', 'dev');
  await git('checkout', '-b', 't/T-214');
  await mkdir(join(f.root, 'hub', 'src', 'tracker'), { recursive: true });
  await writeFile(join(f.root, 'hub', 'src', 'tracker', 'tracker.ts'), '// package-local change');
  await git('add', '.'); await git('commit', '-m', 'hub change');
  await f.launch('auto');
  const reduced = await eventually('auto result', async () => (await f.results())[0]);
  assert.match(reduced.text, /mode hub-only; all paths outside nvim\/; deciding files \["hub\/src\/tracker\/tracker.ts"\]/);
  const log = await readFile(reduced.artifacts[0]!.path, 'utf8');
  assert.match(log, /"mode":"hub-only","files":\["hub\/src\/tracker\/tracker.ts"\]/);
  await f.launch('--all');
  const full = await eventually('forced full result', async () => (await f.results())[1]);
  assert.match(full.text, /mode full; --all \/ all forces full/);
  assert.match(full.text, /deciding files \["hub\/src\/tracker\/tracker.ts"\]/);
});

for (const cap of [768, 384]) {
test(`a broad deciding-file list publishes once below the ${cap}-byte cap and stays complete in the log`, async t => {
  const f = await fixture(t, 'node -e "process.exit(0)"', undefined, `[hygiene]\nmax_text_bytes = ${cap}\n`);
  const exec = promisify(execFile);
  const git = async (...args: string[]) => exec('git', args, { cwd: f.root });
  const remote = join(f.root, 'origin.git');
  await git('init', '--initial-branch=dev');
  await git('config', 'user.name', 'Suite report test'); await git('config', 'user.email', 'suite@example.invalid');
  await writeFile(join(f.root, '.gitignore'), '.cland/\norigin.git/\nsuite.lock*\n');
  await git('add', '.'); await git('commit', '-m', 'base');
  await git('init', '--bare', remote); await git('remote', 'add', 'origin', remote); await git('push', 'origin', 'dev');
  await git('checkout', '-b', 't/T-214');
  await mkdir(join(f.root, 'nvim', 'test'), { recursive: true });
  const names = Array.from({ length: 150 }, (_, n) => `nvim/test/${String(n).padStart(3, '0')}-${'界'.repeat(40)}.test.ts`);
  for (const name of names) await writeFile(join(f.root, name), '// local test');
  await f.launch('auto');
  const result = await eventually('bounded report publication', async () => (await f.results())[0]);
  assert.ok(Buffer.byteLength(result.text, 'utf8') <= cap);
  assert.match(result.text, /mode nvim-only/);
  assert.match(result.text, /all paths under nvim\//);
  assert.match(result.text, /full list in log/);
  assert.ok(!result.text.includes('�'));
  assert.match(result.text, /Executor local · \S+ \S+ · Node v[\d.]+ · Neovim none/);
  const log = await readFile(result.artifacts[0]!.path, 'utf8');
  assert.ok(names.every(name => log.includes(name)), 'every deciding path remains in the log');
  await eventually('bounded report settled', async () => {
    const status = await f.ui.request({ type: 'hub.status' });
    return (status.value as { suites: Array<{ reported: boolean }> }).suites.every(job => job.reported) ? true : undefined;
  });
  assert.equal((await f.results()).length, 1);
});
}

test('suite CLI exits before its worker, posts one artifact-backed result as caller, and rejects duplicate active runs', async t => {
  // Artificial work: leave the package running while the caller exits and duplicate admission is refused.
  const f = await fixture(t, 'node -e "setTimeout(()=>{console.log(\'ℹ tests 2\\nℹ pass 2\\nℹ fail 0\')},1200)"');
  const job = await f.launch();
  assert.equal(job.position, 1);
  assert.equal((await f.results()).length, 0, 'caller exited while package command is still running');
  const duplicate = await clandWithEnv(f.root, f.env, 'suite', '--report', f.topic, '--to', 'rev');
  assert.notEqual(duplicate.code, 0);
  assert.match(duplicate.stderr, /already has a suite/);
  const result = await eventually('suite completion', async () => (await f.results())[0]);
  assert.equal(result.id, `suite:${job.id}`);
  assert.equal(result.from, 'impl'); assert.equal(result.fromRole, 'implementer');
  assert.deepEqual(result.to.sort(), ['impl', 'rev']);
  assert.match(result.text, /all exit 0/); assert.match(result.text, /tests 2; pass 2; fail 0/);
  assert.match(result.text, /Executor local · \S+ \S+ · Node v[\d.]+ · Neovim none/);
  const artifact = result.artifacts[0]!;
  assert.equal(artifact.creator, 'impl');
  assert.match(await readFile(artifact.path, 'utf8'), /\$ npm run typecheck/);
  assert.match(await readFile(artifact.path, 'utf8'), /\$ npm test/);
  assert.equal((await f.results()).length, 1);
});

test('suite worker SIGKILL produces one crash result with its log', async t => {
  // Artificial hold: this test kills or cancels the worker before the 30-second failure ceiling.
  const f = await fixture(t, 'node -e "setTimeout(()=>{},30000)"');
  const job = await f.launch();
  await eventually('package test started', async () => {
    const log = await readFile(join(f.root, '.cland', 'run', 'suites', job.id, 'suite.log'), 'utf8');
    return log.includes('$ npm test') ? true : undefined;
  });
  process.kill(job.pid!, 'SIGKILL');
  const result = await eventually('crash report', async () => (await f.results())[0]);
  assert.match(result.text, /worker killed by SIGKILL/);
  assert.equal(result.artifacts.length, 1);
  assert.equal((await f.results()).length, 1);
});

test('suite cancel defaults to the caller’s active run, stops its child and posts one cancelled result', async t => {
  // Artificial hold: this test kills or cancels the worker before the 30-second failure ceiling.
  const f = await fixture(t, 'node -e "require(\'fs\').writeFileSync(\'child-pid\',String(process.pid));setTimeout(()=>{},30000)"');
  const job = await f.launch();
  const child = await eventually('package child started', async () => readFile(join(f.root, 'child-pid'), 'utf8').then(Number, () => undefined));
  ownProcess(t, child);
  const cancelled = await clandWithEnv(f.root, f.env, 'suite', 'cancel', '--json');
  assert.equal(cancelled.code, 0, cancelled.stderr);
  assert.equal(JSON.parse(cancelled.stdout).id, job.id);
  const result = await eventually('cancelled result', async () => (await f.results())[0]);
  assert.equal(result.id, `suite:${job.id}`);
  assert.match(result.text, /exit 143; cancelled/);
  assert.equal(result.from, 'impl');
  assert.deepEqual(result.to.sort(), ['impl', 'rev']);
  await eventually('cancelled processes stopped', () => !pidAlive(job.pid!) && !pidAlive(child) ? true : undefined);
  const receipt = JSON.parse(await readFile(join(f.root, '.cland', 'run', 'suites', job.id, 'result.json'), 'utf8'));
  assert.equal(receipt.code, 143);
  assert.match(receipt.cause, /SIGTERM/);
  assert.equal((await f.results()).length, 1);
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  const next = await startDaemon(t, f.root);
  const ui = await connectUi(t, next.discovery);
  const history = await ui.request({ type: 'topic.history', topic: f.topic });
  assert.equal((history.value as { messages: ResultMessage[] }).messages.filter(m => m.id === `suite:${job.id}`).length, 1);
});

test('suite cancel refuses another session’s run while the human can cancel it by id', async t => {
  // Artificial hold: this test kills or cancels the worker before the 30-second failure ceiling.
  const f = await fixture(t, 'node -e "setTimeout(()=>{},30000)"', undefined, '[hygiene]\nmax_text_bytes = 384\n');
  const rev = await spawnSpoke({ discover: true, cwd: f.root, name: 'rev', sessionId: 'suite-reviewer', role: 'reviewer' });
  t.after(() => rev.close());
  await rev.waitForPresence(['rev']);
  const job = await f.launch();
  const refused = await clandWithEnv(f.root, { CLAND_SESSION_NAME: 'rev', CLAND_SESSION_ID: 'suite-reviewer' }, 'suite', 'cancel', job.id);
  assert.notEqual(refused.code, 0);
  assert.match(refused.stderr, /cannot cancel another session’s suite/);
  assert.equal(pidAlive(job.pid!), true);
  assert.equal((await f.results()).length, 0);
  const cancelled = await cland(f.root, 'suite', 'cancel', job.id, '--json');
  assert.equal(cancelled.code, 0, cancelled.stderr);
  const result = await eventually('human cancellation report', async () => (await f.results())[0]);
  assert.equal(result.from, 'impl');
  assert.deepEqual(result.to.sort(), ['impl', 'rev']);
  assert.match(result.text, /exit 143; cancelled/);
  assert.ok(Buffer.byteLength(result.text, 'utf8') <= 384);
  const repeated = await cland(f.root, 'suite', 'cancel', job.id);
  assert.equal(repeated.code, 0, repeated.stderr);
  assert.equal((await f.results()).length, 1);
  const missing = await clandWithEnv(f.root, f.env, 'suite', 'cancel');
  assert.notEqual(missing.code, 0);
  assert.match(missing.stderr, /no suite queued or running/);
});

test('verify cancel removes a pid-null queued job while an unrelated submission is held, preserving the holder’s lock', async t => {
  const bin = await tempProject(t, 'cland-suite-held-git-');
  const git = (await promisify(execFile)('which', ['git'])).stdout.trim();
  await writeFile(join(bin, 'git'), `#!${process.execPath}
import { existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
if (existsSync('hold-git')) { writeFileSync('git-held', 'held'); while (!existsSync('release-git')) await pause(25); }
const result = spawnSync(${JSON.stringify(git)}, process.argv.slice(2), { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
`, { mode: 0o700 });
  const f = await fixture(t, 'node queued.mjs', undefined, '', { PATH: `${bin}:${process.env.PATH ?? ''}` });
  const lock = join(f.root, 'suite.lock');
  await mkdir(lock);
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  await writeFile(join(f.root, 'queued.mjs'), `import { runSuite } from ${JSON.stringify(runner)}; process.exitCode = await runSuite([['-e', "require('fs').writeFileSync('admitted','yes')"]], { lockDir: ${JSON.stringify(lock)}, cwd: ${JSON.stringify(f.root)} });`);
  const job = await f.launch();
  assert.equal(job.pid, null);
  const other = join(f.root, 'other');
  await mkdir(other);
  await writeFile(join(other, 'hold-git'), 'hold');
  await writeFile(join(other, 'package.json'), JSON.stringify({ scripts: { typecheck: 'node -e "process.exit(0)"', test: 'node -e "process.exit(0)"' } }));
  const submission = f.ui.request({ type: 'suite.start', mode: 'all', cwd: other, report: f.topic, to: ['impl', 'rev'] }, 15000);
  await eventually('unrelated submission held in git', async () => stat(join(other, 'git-held')).then(() => true, () => undefined));
  const cancellation = clandWithEnv(f.root, f.env, 'verify', 'cancel', job.id);
  let cancelled;
  try {
    await eventually('queued cancellation reported before unrelated submission resumes', async () => (await f.results()).find(m => m.id === `suite:${job.id}`), 5000);
    cancelled = await cancellation;
  } finally {
    await writeFile(join(other, 'release-git'), 'release');
    const submitted = await submission;
    assert.equal(submitted.ok, true, submitted.error);
    const pid = (submitted.value as { pid: number | null }).pid;
    if (pid) ownProcess(t, pid);
    await cancellation;
  }
  assert.equal(cancelled.code, 0, cancelled.stderr);
  const status = await f.ui.request({ type: 'hub.status' });
  const queued = (status.value as { suites: Array<{ id: string; pid: number | null; state: string }> }).suites.find(s => s.id === job.id)!;
  assert.equal(queued.pid, null);
  assert.equal(queued.state, 'finished');
  const result = await eventually('queued cancellation result', async () => (await f.results()).find(m => m.id === `suite:${job.id}`));
  assert.match(result.text, /exit 143; cancelled/);
  assert.equal((await stat(lock)).isDirectory(), true, 'manual holder lock remains intact');
  await assert.rejects(stat(join(f.root, 'admitted')), { code: 'ENOENT' });
  await assert.rejects(stat(join(f.root, '.cland', 'run', 'suites', job.id, 'result.json')), { code: 'ENOENT' });
  assert.equal((await f.results()).filter(m => m.id === `suite:${job.id}`).length, 1);
});

test('suite cancel cleans a running lock runner’s children and temporary root before publishing', async t => {
  const f = await fixture(t, 'node running.mjs');
  const lock = join(f.root, 'suite.lock');
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  await writeFile(join(f.root, 'running.mjs'), `import { runSuite } from ${JSON.stringify(runner)}; process.exitCode = await runSuite([['--test', 'holding.mjs']], { lockDirs: ${JSON.stringify([lock, `${lock}-nvim`])}, cwd: ${JSON.stringify(f.root)} });`);
  // Artificial hold: cancellation ends this child; the 30-second timer is a failure ceiling.
  await writeFile(join(f.root, 'holding.mjs'), `import test from 'node:test'; import { writeFile } from 'node:fs/promises'; test('holding', async () => { await writeFile(${JSON.stringify(join(f.root, 'holder.json'))}, JSON.stringify({ pid: process.pid, root: process.env.TMPDIR })); await new Promise(r => setTimeout(r, 30000)); });`);
  const job = await f.launch();
  const holder = await eventually('runner child started', async () => readFile(join(f.root, 'holder.json'), 'utf8').then(text => JSON.parse(text) as { pid: number; root: string }, () => undefined));
  ownProcess(t, holder.pid);
  const cancelled = await clandWithEnv(f.root, f.env, 'suite', 'cancel', job.id);
  assert.equal(cancelled.code, 0, cancelled.stderr);
  const result = await eventually('running runner cancellation result', async () => (await f.results())[0]);
  assert.match(result.text, /exit 143; cancelled/);
  assert.equal(pidAlive(holder.pid), false);
  await assert.rejects(stat(lock), { code: 'ENOENT' });
  await assert.rejects(stat(holder.root), { code: 'ENOENT' });
  assert.deepEqual(await readdir(`${lock}.queue`), []);
  assert.equal((await f.results()).length, 1);
});

test('cancelled results held by reporting permissions survive restart and publish once', async t => {
  // Artificial hold: this test kills or cancels the worker before the 30-second failure ceiling.
  const f = await fixture(t, 'node -e "setTimeout(()=>{},30000)"');
  const job = await f.launch();
  await eventually('worker test started', async () => (await readFile(join(f.root, '.cland', 'run', 'suites', job.id, 'suite.log'), 'utf8')).includes('$ npm test') ? true : undefined);
  assert.equal((await f.ui.request({ type: 'role.clear', session: 'impl' })).ok, true);
  const cancelled = await clandWithEnv(f.root, f.env, 'suite', 'cancel', job.id);
  assert.equal(cancelled.code, 0, cancelled.stderr);
  await eventually('cancellation report held', async () => {
    const status = await f.ui.request({ type: 'hub.status' });
    return (status.value as { suites: Array<{ error: string | null }> }).suites[0]?.error?.includes('forbidden') ? true : undefined;
  });
  assert.equal((await f.results()).length, 0);
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  const next = await startDaemon(t, f.root);
  const ui = await connectUi(t, next.discovery);
  assert.equal((await ui.request({ type: 'role.set', session: 'impl', role: 'implementer' })).ok, true);
  const result = await eventually('cancelled result after restart', async () => {
    const history = await ui.request({ type: 'topic.history', topic: f.topic });
    return (history.value as { messages: ResultMessage[] }).messages.find(m => m.id === `suite:${job.id}`);
  });
  assert.match(result.text, /exit 143; cancelled/);
  assert.deepEqual(result.to.sort(), ['impl', 'rev']);
  const repeated = await cland(f.root, 'suite', 'cancel', job.id);
  assert.equal(repeated.code, 0, repeated.stderr);
  const history = await ui.request({ type: 'topic.history', topic: f.topic });
  assert.equal((history.value as { messages: ResultMessage[] }).messages.filter(m => m.id === `suite:${job.id}`).length, 1);
});

test('a worker killed while the hub is down is reported after restart and its package children are cleaned', async t => {
  // Artificial hold: this test kills or cancels the worker before the 30-second failure ceiling.
  const f = await fixture(t, 'node -e "require(\'fs\').writeFileSync(\'child-pid\',String(process.pid));setTimeout(()=>{},30000)"');
  const job = await f.launch();
  const child = await eventually('package child identity', async () => readFile(join(f.root, 'child-pid'), 'utf8').then(Number, () => undefined));
  ownProcess(t, child);
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  process.kill(job.pid!, 'SIGKILL');
  const next = await startDaemon(t, f.root);
  const ui = await connectUi(t, next.discovery);
  const result = await eventually('recovered crash report', async () => {
    const r = await ui.request({ type: 'topic.history', topic: f.topic });
    return (r.value as { messages: ResultMessage[] }).messages.find(m => m.id === `suite:${job.id}`);
  });
  assert.match(result.text, /worker disappeared \(killed or crashed without an exit receipt\)/);
  await eventually('package child stopped', () => !pidAlive(child) ? true : undefined);
});

test('typecheck failure stops before tests and reports the failure', async t => {
  const f = await fixture(t, 'node -e "console.log(\'should not run\')"', 'node -e "console.error(\'typecheck failed\');process.exit(7)"');
  await f.launch();
  const result = await eventually('failure report', async () => (await f.results())[0]);
  assert.match(result.text, /all exit 7/);
  const log = await readFile(result.artifacts[0]!.path, 'utf8');
  assert.match(log, /typecheck failed/); assert.doesNotMatch(log, /\$ npm test/);
});

test('submission requires caller artifact and send permissions before spawning', async t => {
  const f = await fixture(t, 'node -e "process.exit(0)"');
  const refused = await clandWithEnv(f.root, f.env, 'suite', '--report', 'general', '--to', 'rev');
  assert.notEqual(refused.code, 0); assert.match(refused.stderr, /own item topic/);
  const human = await clandWithEnv(f.root, f.env, 'suite', '--report', f.topic);
  assert.notEqual(human.code, 0); assert.match(human.stderr, /forbidden.*send/);
  assert.equal((await f.results()).length, 0);
});

test('hub restart recovers a worker that outlives it, without replaying the result', async t => {
  // Artificial work: the worker must outlive the hub stop/restart to prove recovery without replay.
  const f = await fixture(t, 'node -e "setTimeout(()=>{console.log(\'ℹ tests 1\\nℹ pass 1\')},1800)"');
  const job = await f.launch();
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  const { discovery } = await startDaemon(t, f.root);
  const ui = await connectUi(t, discovery);
  const history = async () => {
    const r = await ui.request({ type: 'topic.history', topic: f.topic });
    return (r.value as { messages: ResultMessage[] }).messages.filter(m => m.id === `suite:${job.id}`);
  };
  const results = await eventually('restart result', async () => { const r = await history(); return r.length ? r : undefined; });
  assert.equal(results.length, 1); assert.match(results[0]!.text, /all exit 0/);
  assert.match(results[0]!.text, /Executor local · \S+ \S+ · Node v[\d.]+ · Neovim none/);
  const recoveredStatus = (await ui.request({ type: 'hub.status' })).value as HubStatus;
  assert.equal(recoveredStatus.suites!.find(run => run.id === job.id)!.executor, 'local');
  assert.equal(recoveredStatus.suites!.find(run => run.id === job.id)!.platform?.nvim, 'none');
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  const next = await startDaemon(t, f.root);
  const nextUi = await connectUi(t, next.discovery);
  const r = await nextUi.request({ type: 'topic.history', topic: f.topic });
  assert.equal((r.value as { messages: ResultMessage[] }).messages.filter(m => m.id === `suite:${job.id}`).length, 1);
});

test('revoked report permissions hold the result until restored, without a duplicate', async t => {
  const f = await fixture(t, 'node -e "const fs=require(\'fs\');const p=setInterval(()=>{if(fs.existsSync(\'finish\'))clearInterval(p)},50)"');
  await f.launch();
  assert.equal((await f.ui.request({ type: 'role.clear', session: 'impl' })).ok, true);
  await writeFile(join(f.root, 'finish'), 'ready');
  await eventually('report held by permissions', async () => {
    const status = await f.ui.request({ type: 'hub.status' });
    const jobs = (status.value as { suites: Array<{ error: string | null }> }).suites;
    return jobs.some(job => job.error?.includes('forbidden')) ? true : undefined;
  });
  assert.equal((await f.results()).length, 0);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'implementer' })).ok, true);
  await eventually('report after restoring permissions', async () => (await f.results())[0]);
  assert.equal((await f.results()).length, 1);
});

test('a muted named recipient keeps the single result pending across restart until all recipients can receive it', async t => {
  const f = await fixture(t, 'node -e "const fs=require(\'fs\');const p=setInterval(()=>{if(fs.existsSync(\'finish\'))clearInterval(p)},50)"', undefined, '[hygiene]\nloop_breaker_max = 2\n');
  for (let n = 0; n < 3; n++) await f.spoke.call('send', { to: ['rev'], topic: f.topic, text: `seed ${n}` });
  const job = await f.launch();
  await writeFile(join(f.root, 'finish'), 'ready');
  await eventually('recipient refusal retained', async () => {
    const status = await f.ui.request({ type: 'hub.status' });
    const record = (status.value as { suites: Array<{ reported: boolean; error: string | null }> }).suites[0]!;
    return !record.reported && record.error?.includes('loop breaker') ? true : undefined;
  });
  assert.equal((await f.results()).length, 0, 'no partial topic post or caller delivery');
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  const next = await startDaemon(t, f.root);
  const ui = await connectUi(t, next.discovery);
  assert.equal((await ui.request({ type: 'hygiene.unmute', a: 'impl', b: 'rev' })).ok, true);
  const result = await eventually('complete recipient delivery after restart', async () => {
    const r = await ui.request({ type: 'topic.history', topic: f.topic });
    return (r.value as { messages: ResultMessage[] }).messages.find(m => m.id === `suite:${job.id}`);
  });
  assert.deepEqual(result.to.sort(), ['impl', 'rev']);
  const history = await ui.request({ type: 'topic.history', topic: f.topic });
  assert.equal((history.value as { messages: ResultMessage[] }).messages.filter(m => m.id === `suite:${job.id}`).length, 1);
  const artifacts = await ui.request({ type: 'artifact.list', topic: f.topic });
  assert.equal((artifacts.value as { artifacts: unknown[] }).artifacts.length, 1);
});

test('a muted suite report follows its moved log after unmute and publishes once', async t => {
  const f = await fixture(t, 'node -e "console.log(\'ℹ tests 1\\nℹ pass 1\\nℹ fail 0\')"', undefined, '[hygiene]\nloop_breaker_max = 2\n');
  for (let n = 0; n < 3; n++) await f.spoke.call('send', { to: ['rev'], topic: f.topic, text: `seed ${n}` });
  const job = await f.launch();
  await eventually('suite report paused after log registration', async () => {
    const status = await f.ui.request({ type: 'hub.status' });
    const record = (status.value as { suites: Array<{ reported: boolean; error: string | null }> }).suites[0]!;
    return !record.reported && record.error?.includes('loop breaker') ? true : undefined;
  });
  assert.equal((await f.results()).length, 0);
  const listed = await f.ui.request({ type: 'artifact.list', topic: f.topic });
  assert.equal(listed.ok, true, listed.error);
  const logs = (listed.value as { artifacts: Artifact[] }).artifacts;
  assert.equal(logs.length, 1, 'the pending report has registered one log');
  const log = logs[0]!;
  const original = await readFile(log.path, 'utf8');
  const created = await f.ui.request({ type: 'artifact.create', kind: 'file', title: 'Suite logs', topic: f.topic, folder: true });
  assert.equal(created.ok, true, created.error);
  const folder = (created.value as { artifact: Artifact }).artifact;
  const moved = await f.ui.request({ type: 'artifact.move', artifact: log.id, folder: folder.id, name: 'suite.log' });
  assert.equal(moved.ok, true, moved.error);
  const path = join(folder.path, 'suite.log');
  assert.equal(await readFile(path, 'utf8'), original);
  await assert.rejects(stat(log.path), { code: 'ENOENT' });
  assert.equal((await f.ui.request({ type: 'hygiene.unmute', a: 'impl', b: 'rev' })).ok, true);
  const result = await eventually('suite publication with moved log', async () => (await f.results())[0]);
  assert.equal(result.id, `suite:${job.id}`);
  assert.deepEqual(result.to.sort(), ['impl', 'rev']);
  assert.match(result.text, /all exit 0/);
  assert.match(result.text, /tests 1; pass 1; fail 0/);
  assert.ok(result.text.includes(`Log ${log.id}: ${path}`));
  assert.equal(result.artifacts.length, 1);
  assert.equal(result.artifacts[0]!.id, log.id);
  assert.equal(result.artifacts[0]!.path, path);
  assert.equal(await readFile(result.artifacts[0]!.path, 'utf8'), original);
  await eventually('suite report receipt settled', async () => {
    const status = await f.ui.request({ type: 'hub.status' });
    return (status.value as { suites: Array<{ reported: boolean }> }).suites.every(record => record.reported) ? true : undefined;
  });
  assert.equal((await f.results()).length, 1);
  const artifacts = await f.ui.request({ type: 'artifact.list', topic: f.topic });
  assert.equal((artifacts.value as { artifacts: Artifact[] }).artifacts.length, 1, 'only the destination folder is listed; no replacement log was created');
});

test('failure cleanup preserves a live worker whose recorded start identity is unavailable', async t => {
  const f = await fixture(t, 'node -e "const fs=require(\'fs\');const p=setInterval(()=>{if(fs.existsSync(\'finish\'))clearInterval(p)},50)"');
  const job = await f.launch();
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  const db = new DatabaseSync(join(f.root, '.cland', 'hub.db'));
  try {
    const value = db.prepare("select value from meta where key = 'suite-jobs'").get() as { value: string };
    const records = JSON.parse(value.value) as Array<{ started: string | null; outcome: { code: number; cause: string } | null }>;
    records[0]!.started = null;
    records[0]!.outcome = { code: 1, cause: 'fixture admission failed without a readable identity' };
    db.prepare("update meta set value = ? where key = 'suite-jobs'").run(JSON.stringify(records));
  } finally { db.close(); }
  const next = await startDaemon(t, f.root);
  const ui = await connectUi(t, next.discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const restored = new DatabaseSync(join(f.root, '.cland', 'hub.db'), { readOnly: true });
  try {
    const cleanupError = () => {
      const value = restored.prepare("select value from meta where key = 'suite-jobs'").get() as { value: string };
      return (JSON.parse(value.value) as Array<{ id: string; error: string | null }>).find(record => record.id === job.id)?.error;
    };
    // Subscribe before reading: cleanup may finish before connection, between the
    // read and the wait, or later. Buffered task events cover the latter two cases.
    if (!cleanupError()?.includes('process preserved')) {
      await ui.waitFor(frame => frame.type === 'task' && (frame.item as ItemSummary | null)?.verify?.id === job.id
        && (frame.item as ItemSummary).verify?.state === 'finished', 15000);
    }
    assert.match(cleanupError() ?? '', /suite cleanup waiting for a verified worker identity; process preserved/);
  } finally { restored.close(); }
  assert.equal(pidAlive(job.pid!), true);
  const initial = await ui.request({ type: 'topic.history', topic: f.topic });
  assert.equal((initial.value as { messages: ResultMessage[] }).messages.filter(m => m.id === `suite:${job.id}`).length, 0);
  await writeFile(join(f.root, 'finish'), 'ready');
  await eventually('worker naturally completed', () => !pidAlive(job.pid!) ? true : undefined);
});

test('restart recognizes a committed result even if its run receipt did not settle', async t => {
  const f = await fixture(t, 'node -e "process.exit(0)"');
  const job = await f.launch();
  await eventually('initial result', async () => (await f.results())[0]);
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  // Storage boundary: reconstruct the checkpoint immediately before the report's receipt update.
  const db = new DatabaseSync(join(f.root, '.cland', 'hub.db'));
  try {
    const value = db.prepare("select value from meta where key = 'suite-jobs'").get() as { value: string };
    const jobs = JSON.parse(value.value) as Array<{ reported: boolean; artifact: string | null }>;
    for (const record of jobs) { record.reported = false; record.artifact = null; }
    db.prepare("update meta set value = ? where key = 'suite-jobs'").run(JSON.stringify(jobs));
  } finally { db.close(); }
  const next = await startDaemon(t, f.root);
  const ui = await connectUi(t, next.discovery);
  await eventually('receipt reconciled', async () => {
    const status = await ui.request({ type: 'hub.status' });
    return (status.value as { suites: Array<{ reported: boolean }> }).suites.every(job => job.reported) ? true : undefined;
  });
  const history = await ui.request({ type: 'topic.history', topic: f.topic });
  assert.equal((history.value as { messages: ResultMessage[] }).messages.filter(m => m.id === `suite:${job.id}`).length, 1);
  const artifacts = await ui.request({ type: 'artifact.list', topic: f.topic });
  assert.equal((artifacts.value as { artifacts: unknown[] }).artifacts.length, 1);
});

test('suite summary adds both phases and bounds failure excerpts', () => {
  assert.equal(suiteSummary('ℹ tests 2\nℹ pass 1\nℹ fail 1\n✖ broken\n# tests 3\n# pass 3\n# fail 0\n'), 'tests 5; pass 4; fail 1\nFailures:\n✖ broken');
});

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
  const queued = await clandWithEnv(f.root, { CLAND_SESSION_NAME: 'other', CLAND_SESSION_ID: 'other-caller', CLAND_ROLE: 'implementer' }, 'verify', 'all', '--report', f.topic, '--to', 'rev', '--json');
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
  const f = await fixture(t, 'node -e "process.exit(0)"', undefined, '', fake.env);
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
  const submission = await clandWithEnv(f.root, {CLAND_SESSION_NAME:'doomed', CLAND_SESSION_ID:actor.sessionId, CLAND_ROLE:'implementer'}, 'verify', 'all', '--fresh', '--report', topic, '--to', 'rev', '--json');
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
  const f = await fixture(t, `node -e "const fs=require('fs');const p=setInterval(()=>{if(fs.existsSync('finish')){fs.unlinkSync('finish');clearInterval(p)}},25)"`);
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
    const r = await clandWithEnv(f.root, {CLAND_SESSION_NAME:name, CLAND_SESSION_ID:`${name}-identity`, CLAND_ROLE:role}, 'verify', 'all', '--report', topic, '--to', 'rev', '--json');
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
  assert.match(result.text,/all exit 0/);
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
  assert.equal(result.id,`suite:${job.id}`);assert.match(result.text,/all exit 0/);assert.match(result.text,/tests 2; pass 2/);
  assert.equal(await done,0);
});

test('pre-V1 package runners acquire their own compatibility locks without a self-deadlock',async t=>{
  const f=await fixture(t,`${process.execPath} legacy.mjs`);
  const runner=fileURLToPath(new URL('./run-suite.ts',import.meta.url));
  await mkdir(join(f.root,'hub','test'),{recursive:true});
  await writeFile(join(f.root,'hub','test','run-suite.ts'),'// legacy package runner: no worker lease support');
  await writeFile(join(f.root,'legacy.mjs'),`import assert from 'node:assert/strict';import {runSuite} from ${JSON.stringify(runner)};assert.equal(process.env.CLAND_SUITE_LEASE,undefined);process.exitCode=await runSuite([['-e',"console.log('legacy package passed')"]],${JSON.stringify({cwd:f.root,lockDirs:[join(f.root,'suite.lock'),join(f.root,'suite.lock-nvim')]})});`);
  await f.launch();const result=await eventually('legacy result',async()=>(await f.results())[0]);
  assert.match(result.text,/all exit 0/);assert.match(await readFile(result.artifacts[0]!.path,'utf8'),/legacy package passed/);
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

test('worker cleanup removes a borrowed root when its package runner dies during mkdir', async t => {
  const f = await fixture(t, `${process.execPath} borrowed-crash.mjs`);
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  const locks = [join(f.root, 'suite.lock'), join(f.root, 'suite.lock-nvim')];
  const marker = join(f.root, 'created-root.json');
  await writeFile(join(f.root, 'borrowed-crash.mjs'), `import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const mkdir = fs.mkdir;
fs.mkdir = async (...args) => {
  const result = await mkdir(...args);
  const root = String(args[0]);
  if (root.split('/').at(-1).startsWith('cland-suite-') && !existsSync(${JSON.stringify(marker)})) {
    await fs.writeFile(${JSON.stringify(marker)}, JSON.stringify({ root, pid: process.pid }));
    process.kill(process.pid, 'SIGKILL');
  }
  return result;
};
syncBuiltinESMExports();
const { runSuite } = await import(${JSON.stringify(runner)});
process.exitCode = await runSuite([], ${JSON.stringify({ cwd: f.root, lockDirs: locks })});
`);
  const job = await f.launch();
  const created = await eventually('borrowed root creation crashed', async () => readFile(marker, 'utf8').then(text => JSON.parse(text) as { root: string; pid: number }, () => undefined));
  t.after(() => rm(created.root, { recursive: true, force: true }));
  const result = await eventually('worker reports package crash after cleanup', async () => (await f.results()).find(m => m.id === `suite:${job.id}`));
  assert.doesNotMatch(result.text, /all exit 0/);
  assert.equal(pidAlive(created.pid), false);
  await assert.rejects(stat(created.root), { code: 'ENOENT' });
  for (const lock of locks) {
    await assert.rejects(stat(lock), { code: 'ENOENT' });
    await assert.rejects(stat(`${lock}.owner`), { code: 'ENOENT' });
  }
  assert.deepEqual(await readdir(`${locks[0]}.runs`), [], 'crashed package record is removed after cleanup');
  const next = await f.launch();
  const passed = await eventually('successor borrows a clean lease', async () => (await f.results()).find(m => m.id === `suite:${next.id}`));
  assert.match(passed.text, /all exit 0/);
});

for (const holder of ['live', 'stale'] as const) test(`admission stays responsive and bounds a held ps probe for a ${holder} compatibility holder`, async t => {
  const bin = await tempProject(t, 'cland-held-admission-ps-');
  const ps = (await promisify(execFile)('which', ['ps'])).stdout.trim();
  const held = join(bin, 'held');
  const release = join(bin, 'release');
  const probe = join(bin, 'probe-pid');
  await writeFile(join(bin, 'ps'), `#!${process.execPath}
import { existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
if (existsSync(${JSON.stringify(held)})) {
  writeFileSync(${JSON.stringify(probe)}, String(process.pid));
  while (!existsSync(${JSON.stringify(release)})) await pause(25);
}
const result = spawnSync(${JSON.stringify(ps)}, process.argv.slice(2), { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
`, { mode: 0o700 });
  const f = await fixture(t, 'node -e "process.exit(0)"', undefined, '', { PATH: `${bin}:${process.env.PATH ?? ''}` });
  const lock = join(f.root, 'suite.lock');
  await mkdir(lock);
  const job = await f.launch();
  assert.equal(job.pid, null);
  const started = (await promisify(execFile)(ps, ['-o', 'lstart=', '-p', String(process.pid)])).stdout.trim().replace(/\s+/g, ' ');
  await writeFile(`${lock}.owner`, JSON.stringify({ pid: holder === 'live' ? process.pid : 2147483647, started, token: 'held-compatibility-probe', since: new Date().toISOString() }));
  await writeFile(held, 'hold');
  try {
    const pid = await eventually('admission probe held', async () => readFile(probe, 'utf8').then(Number, () => undefined));
    const status = await f.ui.request({ type: 'hub.status' }, 500);
    assert.equal(status.ok, true);
    const cancel = await f.ui.request({ type: 'suite.cancel', suite: job.id }, 500);
    assert.equal(cancel.ok, true, cancel.error);
    await eventually('held admission probe terminated at its deadline', () => !pidAlive(pid) ? true : undefined, 7000);
  } finally {
    await writeFile(release, 'release');
  }
});

test('admission recovers a borrowed planned root after the worker dies during package mkdir', async t => {
  const f = await fixture(t, `${process.execPath} paused-borrow.mjs`);
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  const locks = [join(f.root, 'suite.lock'), join(f.root, 'suite.lock-nvim')];
  const marker = join(f.root, 'planned-root');
  await writeFile(join(f.root, 'paused-borrow.mjs'), `import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const mkdir = fs.mkdir;
fs.mkdir = async (...args) => {
  const result = await mkdir(...args);
  const root = String(args[0]);
  if (root.split('/').at(-1).startsWith('cland-suite-') && !existsSync(${JSON.stringify(marker)})) {
    await fs.writeFile(${JSON.stringify(marker)}, root);
    // Artificial hold: kill the worker while borrowed-root publication is in flight.
    await new Promise(resolve => setTimeout(resolve, 30000));
  }
  return result;
};
syncBuiltinESMExports();
const { runSuite } = await import(${JSON.stringify(runner)});
process.exitCode = await runSuite([], ${JSON.stringify({ cwd: f.root, lockDirs: locks })});
`);
  const job = await f.launch();
  const root = await eventually('borrowed planned root exists', async () => readFile(marker, 'utf8').catch(() => undefined));
  t.after(() => rm(root, { recursive: true, force: true }));
  process.kill(job.pid!, 'SIGKILL');
  const failed = await eventually('worker crash reported', async () => (await f.results()).find(m => m.id === `suite:${job.id}`));
  assert.doesNotMatch(failed.text, /all exit 0/);
  const next = await f.launch();
  const passed = await eventually('successor admitted after stale recovery', async () => (await f.results()).find(m => m.id === `suite:${next.id}`));
  assert.match(passed.text, /all exit 0/);
  await assert.rejects(stat(root), { code: 'ENOENT' });
  for (const lock of locks) await assert.rejects(stat(`${lock}.owner`), { code: 'ENOENT' });
  assert.deepEqual(await readdir(`${locks[0]}.runs`), [], 'stale and successful records are removed');
});

test('cancel removes an admitted worker’s compatibility FIFO ticket without releasing a racing hand holder', async t => {
  const bin = await tempProject(t, 'cland-worker-lease-race-');
  const ps = (await promisify(execFile)('which', ['ps'])).stdout.trim();
  const hold = join(bin, 'hold-worker');
  const entered = join(bin, 'worker-held');
  const release = join(bin, 'release-worker');
  await writeFile(join(bin, 'ps'), `#!${process.execPath}
import { existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
const args = process.argv.slice(2);
// Startup no longer warms the hub's async self probe. Hold only the worker's
// self probe, so admission can still read the hub's own identity.
const parent = spawnSync(${JSON.stringify(ps)}, ['-o', 'command=', '-p', String(process.ppid)], { encoding: 'utf8' });
if (existsSync(${JSON.stringify(hold)}) && args.at(-1) === String(process.ppid) && parent.stdout?.includes('/hub/suite-worker.ts')) {
  writeFileSync(${JSON.stringify(entered)}, String(process.ppid));
  while (!existsSync(${JSON.stringify(release)})) await pause(25);
}
const result = spawnSync(${JSON.stringify(ps)}, args, { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
`, { mode: 0o700 });
  const f = await fixture(t, 'node -e "require(\'fs\').writeFileSync(\'admitted\',\'yes\')"', undefined, '', { PATH: `${bin}:${process.env.PATH ?? ''}` });
  await writeFile(hold, 'hold');
  const job = await f.launch();
  assert.ok(job.pid);
  await eventually('worker paused before compatibility acquisition', async () => readFile(entered, 'utf8').then(pid => Number(pid) === job.pid ? true : undefined, () => undefined));
  const lock = join(f.root, 'suite.lock');
  try { await mkdir(lock); }
  finally { await writeFile(release, 'release'); }
  await eventually('admitted worker has a legacy FIFO ticket', async () => readdir(`${lock}.queue`).then(files => files.length === 1 ? true : undefined, () => undefined));
  const cancelled = await clandWithEnv(f.root, f.env, 'verify', 'cancel', job.id, '--json');
  assert.equal(cancelled.code, 0, cancelled.stderr);
  const result = await eventually('queued worker cancellation posted', async () => (await f.results()).find(m => m.id === `suite:${job.id}`));
  assert.match(result.text, /exit 143; cancelled/);
  assert.deepEqual(result.to.sort(), ['impl', 'rev']);
  assert.deepEqual(await readdir(`${lock}.queue`), []);
  assert.equal(pidAlive(job.pid), false);
  assert.equal((await stat(lock)).isDirectory(), true);
  await assert.rejects(stat(join(f.root, 'admitted')), { code: 'ENOENT' });
  assert.equal((await f.results()).filter(m => m.id === `suite:${job.id}`).length, 1);
});

test('suite report includes locked shard duration, free duration and queue waits', () => {
  const summary = suiteSummary('ℹ tests 2\nℹ pass 2\nverification queue wait 12.30s\nshard duration hub free 1.00s; workers 1; resource free; machine wait 0.00s\nshard duration hub machine 55.00s; workers 4; resource machine; machine wait 0.03s\nsuite duration 57.00s; lock wait 0.10s; peak 1m load 8.00\n');
  assert.match(summary, /verification queue wait 12.30s/);
  assert.match(summary, /shard duration hub machine 55.00s/);
  assert.match(summary, /shard duration hub free 1.00s/);
  assert.match(summary, /suite duration 57.00s; lock wait 0.10s/);
});

async function cacheRepository(f: Awaited<ReturnType<typeof fixture>>) {
  const git = async (...args: string[]) => (await promisify(execFile)('git', args, { cwd: f.root })).stdout.trim();
  await git('init', '--initial-branch=dev');
  await git('config', 'user.name', 'Cache test'); await git('config', 'user.email', 'cache@example.invalid');
  await writeFile(join(f.root, '.gitignore'), '.cland/\norigin.git/\nexecutions\nsuite.lock*\n');
  await git('add', '.'); await git('commit', '-m', 'candidate');
  await git('init', '--bare', join(f.root, 'origin.git')); await git('remote', 'add', 'origin', join(f.root, 'origin.git'));
  await git('push', 'origin', 'dev');
  await git('checkout', '-b', 'candidate');
  return git;
}

test('verify reuses a green candidate tree after a tracker-only commit and reports original provenance', async t => {
  const f = await fixture(t, `node -e "require('fs').appendFileSync('executions','run\\n')"`);
  const git = await cacheRepository(f);
  const a = await git('rev-parse', 'HEAD');
  const original = await f.launch();
  const green = await eventually('original green', async () => (await f.results())[0]);
  assert.match(green.text, /exit 0/, green.text);
  const status = await f.ui.request({ type: 'hub.status' });
  assert.ok((status.value as { suites: Array<{ tree?: string }> }).suites[0]?.tree, JSON.stringify(status.value));
  const same = await f.launch();
  assert.equal(same.pid, null);
  assert.equal(same.cached?.run, original.id);
  const repeated = await eventually('same-head cached result', async () => (await f.results())[1]);
  assert.match(repeated.text, /cached/);
  assert.equal(repeated.text.split('\n').find(line => line.startsWith('Executor ')), green.text.split('\n').find(line => line.startsWith('Executor ')));
  assert.ok(repeated.text.includes(original.id) && repeated.text.includes(a));
  await git('checkout', 'dev');
  await writeFile(join(f.root, '.cland', 'tasks', 'cache-note.md'), 'tracker-only');
  await git('add', '-f', '.cland/tasks/cache-note.md'); await git('commit', '-m', 'tracker only');
  await git('push', 'origin', 'dev'); await git('checkout', 'candidate'); await git('merge', 'dev', '--no-edit');
  const b = await git('rev-parse', 'HEAD');
  assert.notEqual(a, b);
  const tracker = await f.launch();
  assert.equal(tracker.cached?.run, original.id);
  assert.equal(tracker.cached?.tree, same.cached?.tree);
  const result = await eventually('tracker cache result', async () => (await f.results())[2]);
  assert.ok(result.text.includes(`head ${b}`));
  assert.ok(result.text.includes(`Original run ${original.id}`) && result.text.includes(`head ${a}`));
  assert.equal(await readFile(join(f.root, 'executions'), 'utf8'), 'run\n');
  await writeFile(join(f.root, 'source.txt'), 'changed source');
  await git('add', 'source.txt'); await git('commit', '-m', 'source change');
  const changed = await f.launch();
  assert.equal(changed.cached, undefined);
  await eventually('changed tree ran', async () => (await f.results())[3]);
  assert.equal(await readFile(join(f.root, 'executions'), 'utf8'), 'run\nrun\n');
});

for (const cancellation of ['requester', 'head change'] as const) test(`a fresh attempt cancelled by ${cancellation} preserves the original green cache evidence`, async t => {
  const f = await fixture(t, `node -e "require('fs').appendFileSync('executions','run\\n')"`);
  const git = await cacheRepository(f);
  const original = await f.launch();
  assert.match((await eventually('original green', async () => (await f.results())[0])).text, /exit 0/);
  await mkdir(join(f.root, 'suite.lock'));
  const fresh = await f.launch('all', '--fresh');
  assert.equal(fresh.pid, null);
  assert.equal(fresh.cached, undefined);
  if (cancellation === 'requester') {
    const cancelled = await clandWithEnv(f.root, f.env, 'verify', 'cancel', fresh.id);
    assert.equal(cancelled.code, 0, cancelled.stderr);
  } else {
    await git('commit', '--allow-empty', '-m', 'same tree at a new head');
    await rm(join(f.root, 'suite.lock'), { recursive: true });
  }
  assert.match((await eventually('fresh cancellation', async () => (await f.results())[1])).text, /cancelled/);
  const hit = await f.launch();
  assert.equal(hit.cached?.run, original.id);
  assert.equal(hit.pid, null);
  const result = await eventually('original green reused', async () => (await f.results())[2]);
  assert.ok(result.text.includes(`Original run ${original.id}`), result.text);
  assert.equal(await readFile(join(f.root, 'executions'), 'utf8'), 'run\n');
});

test('verify --fresh runs despite a green cache and cache hits do not extend expiry', async t => {
  const f = await fixture(t, `node -e "require('fs').appendFileSync('executions','run\\n')"`, undefined, '', {}, 1, 0.1);
  await cacheRepository(f);
  const first = await f.launch();
  await eventually('first completion', async () => (await f.results())[0]);
  const forced = await f.launch('all', '--fresh');
  assert.equal(forced.cached, undefined);
  assert.notEqual(forced.id, first.id);
  await eventually('fresh completion', async () => (await f.results())[1]);
  const cached = await f.launch();
  assert.equal(cached.cached?.run, forced.id);
  await eventually('cached completion', async () => (await f.results())[2]);
  await new Promise(resolve => setTimeout(resolve, 6100)); // Expiry: exceed the configured 0.1-minute cache lifetime without refreshing it.
  const expired = await f.launch();
  assert.equal(expired.cached, undefined);
  await eventually('expired completion', async () => (await f.results())[3]);
  assert.equal(await readFile(join(f.root, 'executions'), 'utf8'), 'run\nrun\nrun\n');
});

test('dirty candidates bypass green cache and cannot seed a later clean result', async t => {
  const f = await fixture(t, `node -e "require('fs').appendFileSync('executions','run\\n')"`);
  const git = await cacheRepository(f);
  await writeFile(join(f.root, 'source.txt'), 'untracked');
  const dirty = await f.launch();
  assert.equal(dirty.cached, undefined);
  await eventually('dirty completion', async () => (await f.results())[0]);
  await git('add', 'source.txt'); await git('commit', '-m', 'clean candidate');
  const clean = await f.launch();
  assert.equal(clean.cached, undefined);
  await eventually('clean completion', async () => (await f.results())[1]);
  await writeFile(join(f.root, 'source.txt'), 'unstaged');
  const unstaged = await f.launch();
  assert.equal(unstaged.cached, undefined);
  await eventually('unstaged completion', async () => (await f.results())[2]);
  await git('add', 'source.txt');
  const staged = await f.launch();
  assert.equal(staged.cached, undefined);
  await eventually('staged completion', async () => (await f.results())[3]);
  await git('restore', '--staged', '--worktree', 'source.txt');
  const restored = await f.launch();
  assert.equal(restored.cached?.run, clean.id);
  await eventually('restored cache', async () => (await f.results())[4]);
  assert.equal(await readFile(join(f.root, 'executions'), 'utf8'), 'run\nrun\nrun\nrun\n');
});

test('cache survives hub restart, separates effective modes, and never reuses a failed run', async t => {
  const f = await fixture(t, `node -e "require('fs').appendFileSync('executions','run\\n');process.exit(require('fs').existsSync('.cland/fail')?1:0)"`);
  const pkg = JSON.parse(await readFile(join(f.root, 'package.json'), 'utf8'));
  pkg.workspaces = ['hub'];
  await writeFile(join(f.root, 'package.json'), JSON.stringify(pkg));
  await mkdir(join(f.root, 'hub'));
  await writeFile(join(f.root, 'hub', 'package.json'), JSON.stringify({ name: 'hub', scripts: { test: `node -e "require('fs').appendFileSync('../executions','run\\n')"` } }));
  const git = await cacheRepository(f);
  await mkdir(join(f.root, 'hub', 'src', 'tracker'), { recursive: true });
  await writeFile(join(f.root, 'hub', 'src', 'tracker', 'example.ts'), '// change');
  await git('add', 'hub'); await git('commit', '-m', 'hub-only change');
  await writeFile(join(f.root, '.cland', 'fail'), 'fail');
  const failed = await f.launch();
  assert.match((await eventually('failed run', async () => (await f.results())[0])).text, /exit 1/);
  await rm(join(f.root, '.cland', 'fail'));
  const green = await f.launch();
  assert.equal(green.cached, undefined);
  assert.notEqual(green.id, failed.id);
  assert.match((await eventually('green run', async () => (await f.results())[1])).text, /exit 0/);
  await writeFile(join(f.root, '.cland', 'fail'), 'fail');
  const freshFailure = await f.launch('all', '--fresh');
  assert.equal(freshFailure.cached, undefined);
  assert.match((await eventually('fresh failure', async () => (await f.results())[2])).text, /exit 1/);
  await rm(join(f.root, '.cland', 'fail'));
  const recoveredGreen = await f.launch();
  assert.equal(recoveredGreen.cached, undefined, 'a fresh failure supersedes the old green');
  await eventually('recovered green', async () => (await f.results())[3]);
  const reduced = await f.launch('hub');
  assert.equal(reduced.cached, undefined, 'full and hub-only have separate keys');
  await eventually('reduced run', async () => (await f.results())[4]);
  const reducedAgain = await f.launch('auto');
  assert.equal(reducedAgain.cached?.run, reduced.id, 'auto resolves to the same effective mode');
  await eventually('reduced cache', async () => (await f.results())[5]);
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  const next = await startDaemon(t, f.root);
  const ui = await connectUi(t, next.discovery, 'cli');
  await f.spoke.waitForPresence(['impl']);
  const recovered = await f.launch();
  assert.equal(recovered.cached?.run, recoveredGreen.id);
  const result = await eventually('recovered cache result', async () => {
    const history = await ui.request({ type: 'topic.history', topic: f.topic });
    return (history.value as { messages: ResultMessage[] }).messages.find(m => m.id === `suite:${recovered.id}`);
  });
  assert.match(result.text, /cached/);
  assert.equal(await readFile(join(f.root, 'executions'), 'utf8'), 'run\nrun\nrun\nrun\nrun\n');
});

test('a bounded cached report retains both heads, original run and candidate tree', async t => {
  const f = await fixture(t, 'node -e "process.exit(0)"', undefined, '[hygiene]\nmax_text_bytes = 384\n');
  const git = await cacheRepository(f);
  const original = await f.launch();
  await eventually('bounded original', async () => (await f.results())[0]);
  await git('commit', '--allow-empty', '-m', 'same tree');
  const head = await git('rev-parse', 'HEAD');
  const hit = await f.launch();
  assert.equal(hit.cached?.run, original.id);
  const result = await eventually('bounded cache', async () => (await f.results())[1]);
  assert.ok(Buffer.byteLength(result.text) <= 384);
  assert.ok(result.text.includes('cached') && result.text.includes(head) && result.text.includes(original.id) && result.text.includes(hit.cached!.head) && result.text.includes(hit.cached!.tree));
  assert.equal(result.artifacts.length, 1);
  assert.match(result.text, /Executor local · \S+ \S+ · Node v[\d.]+ · Neovim none/);
  await eventually('bounded cache settled', async () => {
    const status = await f.ui.request({ type: 'hub.status' });
    return (status.value as { suites: Array<{ reported: boolean }> }).suites.every(j => j.reported) ? true : undefined;
  });
  assert.equal((await f.results()).length, 2);
});

test('a package subdirectory cannot borrow root-tree cache evidence for different npm scripts', async t => {
  const f = await fixture(t, 'node -e "process.exit(0)"');
  await mkdir(join(f.root, 'other-package'));
  await writeFile(join(f.root, 'other-package', 'package.json'), JSON.stringify({ scripts: { typecheck: 'node -e "process.exit(0)"', test: 'node -e "process.exit(1)"' } }));
  await cacheRepository(f);
  await f.launch();
  assert.match((await eventually('root green', async () => (await f.results())[0])).text, /exit 0/);
  const response = await clandWithEnv(join(f.root, 'other-package'), f.env, 'verify', 'all', '--report', f.topic, '--to', 'rev', '--json');
  assert.equal(response.code, 0, response.stderr);
  const subdirectory = JSON.parse(response.stdout) as { id: string; cached?: unknown; pid?: number };
  if (subdirectory.pid) ownProcess(t, subdirectory.pid);
  assert.equal(subdirectory.cached, undefined);
  assert.match((await eventually('package failure', async () => (await f.results())[1])).text, /exit 1/);
});

async function humanRunnerFixture(t: import('node:test').TestContext) {
  const f = await fixture(t, `${process.execPath} crew.mjs`);
  await writeFile(join(f.root, 'crew.mjs'), `import { existsSync, writeFileSync } from 'node:fs';
writeFileSync('crew-started', 'yes'); while (!existsSync('crew-finish')) await new Promise(r => setTimeout(r, 25));`);
  await writeFile(join(f.root, 'human.test.mjs'), `import test from 'node:test'; import { writeFileSync, existsSync } from 'node:fs';
test('tiny human target', async () => { writeFileSync('human-started', 'yes'); while (existsSync('human-hold') && !existsSync('human-finish')) await new Promise(r => setTimeout(r, 25)); });`);
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  const locks = { hub: join(f.root, 'suite.lock'), nvim: join(f.root, 'suite.lock-nvim') };
  await writeFile(join(f.root, 'human-entry.mjs'), `import { runPackageSuite } from ${JSON.stringify(runner)};
process.exitCode = await runPackageSuite(process.env.CLAND_SUITE_LEASE ? 'all' : 'hub', ['human.test.mjs', ...process.argv.slice(2)], ${JSON.stringify({ cwd: f.root, lockDirs: locks })});`);
  const start = (extra: string[] = [], envExtra: NodeJS.ProcessEnv = {}) => {
    const env: NodeJS.ProcessEnv = { ...process.env, CLAND_HUB_FILE: join(f.root, '.cland', 'hub.json'), CLAND_TEST_SKIP_LOCK: '0', NODE_TEST_CONTEXT: '', ...envExtra };
    delete env.CLAND_SESSION_NAME; delete env.CLAND_SESSION_ID; delete env.CLAND_ROLE; delete env.CLAND_SUITE_LEASE;
    Object.assign(env, envExtra);
    const child = spawn(process.execPath, ['human-entry.mjs', ...extra], { cwd: f.root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    ownProcess(t, child.pid!);
    let output = '';
    child.stdout.on('data', chunk => { output += String(chunk); }); child.stderr.on('data', chunk => { output += String(chunk); });
    const done = new Promise<number | null>((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
    t.after(async () => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM'); await done; });
    return { child, done, output: () => output };
  };
  const queue = async () => (await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue;
  const journal = async () => {
    assert.equal((await f.ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
    return (await readFile(join(f.root, '.cland', 'journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line) as Record<string, unknown>);
  };
  return { ...f, start, queue, journal, locks };
}

test('a human package runner waits in the hub order and takes the compatibility slot after admission', async t => {
  const f = await humanRunnerFixture(t);
  await f.launch();
  await eventually('crew holder started', async () => await stat(join(f.root, 'crew-started')).catch(() => undefined));
  await writeFile(join(f.root, 'human-hold'), 'yes');
  const human = f.start();
  await eventually('human queue diagnostic', () => human.output().includes('waiting for the suite queue: place 1 of 1') ? true : undefined);
  assert.match(human.output(), /ETA ~/);
  const cli = await cland(f.root, 'verify', 'queue', '--json');
  assert.equal(cli.code, 0, cli.stderr);
  const q = JSON.parse(cli.stdout) as VerificationQueue;
  assert.equal(q.waiters[0]?.session, 'human'); assert.equal(q.waiters[0]?.kind, 'hand run');
  await assert.rejects(stat(join(f.root, 'human-started')), { code: 'ENOENT' });
  await writeFile(join(f.root, 'crew-finish'), 'yes');
  await eventually('human admitted and running', async () => await stat(join(f.root, 'human-started')).catch(() => undefined));
  assert.equal((await f.queue()).holder?.session, 'human');
  const admitted = await cland(f.root, 'verify', 'queue');
  assert.equal(admitted.code, 0, admitted.stderr);
  assert.match(admitted.stdout, /^local: human ·/);
  await writeFile(join(f.root, 'human-finish'), 'yes');
  assert.equal(await human.done, 0, human.output());
  await eventually('human slot left', async () => (await f.journal()).find(e => e.event === 'verification-human-left'));
  const events = await f.journal();
  assert.ok(events.some(e => e.event === 'verification-human-queued'));
  assert.ok(events.some(e => e.event === 'verification-human-admitted' && Number(e.waitMs) > 0));
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) test(`an interrupted human waiter leaves the hub queue on ${signal}`, async t => {
  const f = await humanRunnerFixture(t);
  await mkdir(f.locks.hub); // An isolated ownerless compatibility holder keeps admission closed.
  const human = f.start();
  await eventually('human queued', async () => (await f.queue()).waiters.find(w => w.session === 'human'));
  human.child.kill(signal);
  assert.equal(await human.done, signal === 'SIGINT' ? 130 : 143, human.output());
  await eventually('human waiter removed', async () => (await f.queue()).waiters.length === 0 ? true : undefined);
  assert.ok(await stat(f.locks.hub), 'interruption preserves the unrelated holder');
  assert.ok((await f.journal()).some(e => e.event === 'verification-human-left' && e.reason === 'connection closed'));
});

test('a forced human package runner starts beside a holder and journals the exact bypass', async t => {
  const f = await humanRunnerFixture(t);
  await f.launch();
  await eventually('crew holder started', async () => await stat(join(f.root, 'crew-started')).catch(() => undefined));
  const forced = f.start(['--force']);
  assert.equal(await forced.done, 0, forced.output());
  assert.ok(await stat(join(f.root, 'human-started')));
  await assert.rejects(stat(join(f.root, 'crew-finish')), { code: 'ENOENT' });
  const events = await f.journal();
  const entry = events.find(e => e.event === 'verification-forced');
  assert.equal(entry?.worktree, f.root); assert.equal(entry?.mode, 'hub-only');
  assert.equal((entry?.holder as VerificationQueue['holder'])?.session, 'impl');
  assert.equal(events.some(e => e.event === 'verification-human-queued'), false);
  await writeFile(join(f.root, 'crew-finish'), 'yes');
  await eventually('crew finished', async () => (await f.results())[0]);
});

test('session-shell and inherited-worker package runners never request a human slot', async t => {
  const f = await humanRunnerFixture(t);
  const session = f.start([], { CLAND_SESSION_NAME: 'isolated-session' });
  assert.equal(await session.done, 0, session.output());
  assert.doesNotMatch(session.output(), /suite queue|no hub queue/);
  // The real worker acquires and exports its verified lease to this package runner.
  await mkdir(join(f.root, 'hub', 'test'), { recursive: true });
  await writeFile(join(f.root, 'hub', 'test', 'run-suite.ts'), await readFile(fileURLToPath(new URL('./run-suite.ts', import.meta.url)), 'utf8'));
  await writeFile(join(f.root, 'package.json'), JSON.stringify({ scripts: { typecheck: 'node -e "process.exit(0)"', test: `${process.execPath} human-entry.mjs` } }));
  await f.launch();
  const result = await eventually('borrowed human entry finished', async () => (await f.results())[0]);
  assert.match(result.text, /all exit 0/);
  assert.equal((await f.journal()).some(e => e.event === 'verification-human-queued'), false);
});

test('a human slot reserves admission briefly and releases a client that never takes its lease', async t => {
  const f = await humanRunnerFixture(t);
  const client = await connectUi(t, f.discovery, 'cli');
  const input = { type: 'suite.slot', mode: 'hub-only', cwd: f.root, head: 'fixture-head', pid: process.pid, token: 'abandoned-human' };
  assert.equal((await client.request(input)).ok, true);
  await eventually('human reservation admitted', async () => (await f.queue()).holder?.session === 'human' ? true : undefined);
  assert.equal((await f.queue()).holder?.kind, 'hand run');
  await eventually('human grace expired', async () => (await f.journal()).find(e => e.event === 'verification-human-left' && e.reason === 'admission grace expired'));
  assert.equal((await f.queue()).holder, null);
  assert.equal((await client.request(input)).ok, false, 'an expired client cannot silently restart its abandoned request');
});

test('without an answering hub plain human runs retain the lease and --force runs unlocked', async t => {
  const f = await humanRunnerFixture(t);
  await mkdir(f.locks.hub);
  const missing = { CLAND_HUB_FILE: join(f.root, 'no-hub.json') };
  const normal = f.start([], missing);
  await eventually('no hub fallback waiting on compatibility lock', () => normal.output().includes('waiting for the suite lock') ? true : undefined);
  assert.match(normal.output(), /no hub queue is in use; using the compatibility lease/);
  const forced = f.start(['--force'], missing);
  assert.equal(await forced.done, 0, forced.output());
  assert.match(forced.output(), /no hub queue is in use; --force runs unlocked/);
  assert.ok(await stat(f.locks.hub));
  await rm(f.locks.hub, { recursive: true });
  assert.equal(await normal.done, 0, normal.output());
  assert.equal((await f.journal()).some(e => e.event === 'verification-forced' || e.event === 'verification-human-queued'), false);
});

test('frames admit integrated dev, then a human slot, then ranked item work', async t => {
  const f = await fixture(t, `${process.execPath} admission.mjs`);
  const git = async (...args: string[]) => promisify(execFile)('git', args, { cwd: f.root });
  await writeFile(join(f.root, 'admission.mjs'), `import { appendFileSync, existsSync, readFileSync } from 'node:fs';
const n = existsSync('admissions') ? readFileSync('admissions', 'utf8').trim().split('\\n').length + 1 : 1;
appendFileSync('admissions', n + '\\n'); while (!existsSync('finish-' + n)) await new Promise(r => setTimeout(r, 25));`);
  await git('init', '--initial-branch=dev');
  await git('config', 'user.name', 'Admission test');
  await git('config', 'user.email', 'admission@example.invalid');
  await writeFile(join(f.root, '.gitignore'), '.cland/\nsuite.lock*\nadmissions\nfinish-*\n');
  await git('add', '.'); await git('commit', '-m', 'base');
  await mkdir(join(f.root, 'suite.lock'));
  const submit = async (name: string) => {
    const r = await f.ui.request({ type: 'suite.start', as: { name }, mode: 'all', fresh: true, cwd: f.root, report: f.topic, to: ['rev'] });
    assert.equal(r.ok, true, JSON.stringify(r));
    const job = r.value as { id: string; pid: number | null };
    assert.equal(job.pid, null);
    return job;
  };
  const ranked = await submit('impl');
  const human = await connectUi(t, f.discovery, 'cli');
  const slot = await human.request({ type: 'suite.slot', mode: 'hub-only', cwd: f.root, head: 'fixture-head', pid: process.pid, token: 'priority-human' });
  assert.equal(slot.ok, true, JSON.stringify(slot));
  const humanId = (slot.value as { id: string }).id;
  assert.equal((await f.ui.request({ type: 'role.set', session: 'coord', role: 'coordinator' })).ok, true);
  const coord = await spawnSpoke({ discover: true, cwd: f.root, name: 'coord', sessionId: 'coord-admission', role: 'coordinator' });
  t.after(() => coord.close()); await coord.waitForPresence(['coord']);
  const integrated = await submit('coord');
  const queue = async () => (await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue;
  assert.deepEqual((await queue()).waiters.map(w => w.id), [integrated.id, humanId, ranked.id]);
  await rm(join(f.root, 'suite.lock'), { recursive: true });
  await eventually('integrated dev admitted first', async () => (await queue()).holder?.id === integrated.id ? true : undefined);
  await eventually('first worker executing', async () => (await readFile(join(f.root, 'admissions'), 'utf8').catch(() => '')) === '1\n' ? true : undefined);
  assert.deepEqual((await queue()).waiters.map(w => w.id), [humanId, ranked.id]);
  await writeFile(join(f.root, 'finish-1'), 'yes');
  await eventually('human admitted second', async () => (await queue()).holder?.id === humanId ? true : undefined);
  assert.equal((await queue()).holder?.session, 'human');
  assert.deepEqual((await queue()).waiters.map(w => w.id), [ranked.id]);
  assert.equal(await readFile(join(f.root, 'admissions'), 'utf8'), '1\n', 'ranked worker has not started');
  human.close();
  await eventually('ranked item admitted last', async () => (await queue()).holder?.id === ranked.id ? true : undefined);
  await eventually('second worker executing', async () => (await readFile(join(f.root, 'admissions'), 'utf8')) === '1\n2\n' ? true : undefined);
  assert.deepEqual((await queue()).waiters, []);
  await writeFile(join(f.root, 'finish-2'), 'yes');
  await eventually('both exact-head results posted', async () => (await f.results()).length === 2 ? true : undefined);
  const head = (await git('rev-parse', 'HEAD')).stdout.trim();
  for (const result of await f.results()) {
    assert.match(result.text, /exit 0/);
    assert.ok(result.text.includes(`head ${head}`));
  }
});

test('human slots retain enqueue order ahead of ranked item requests', async t => {
  const f = await humanRunnerFixture(t);
  await mkdir(f.locks.hub);
  const first = await connectUi(t, f.discovery, 'cli');
  const input = { type: 'suite.slot', mode: 'hub-only', cwd: f.root, head: 'fixture-head', pid: process.pid, token: 'first-human' };
  const a = (await first.request(input)).value as { id: string };
  const job = await f.launch();
  const second = await connectUi(t, f.discovery, 'cli');
  const b = (await second.request({ ...input, token: 'second-human' })).value as { id: string };
  assert.deepEqual((await f.queue()).waiters.map(w => w.id), [a.id, b.id, job.id]);
  first.close(); second.close();
  await eventually('both human sockets left', async () => (await f.queue()).waiters.length === 1 ? true : undefined);
  await writeFile(join(f.root, 'crew-finish'), 'yes');
  await rm(f.locks.hub, { recursive: true });
  await eventually('ranked worker finished', async () => (await f.results())[0]);
});
