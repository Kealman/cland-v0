// T3: command stall, cancellation and inherited-pipe cleanup prove real process-tree termination.
// Public CLI/socket tests use tiny package fixtures, never the live project's full-suite queue.
import { completeJournalLines } from './journal-lines.ts';
import { fixtureEnvironment, runnerFixtureEnvironment } from './fixture-environment.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, stat, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, clandWithEnv, connectUi, eventually, startDaemon, spawnSpoke, tempProject, pidAlive, fakeCodex } from './harness.ts';
import { fixture, type ResultMessage } from './suite-fixture.ts';
import { suiteSummary } from '../src/hub/suites.ts';
import { DatabaseSync } from 'node:sqlite';
import { systemProcesses } from '../src/system-processes.ts';
import { ownProcess, onCleanup, cleanupProcesses } from './process-cleanup.ts';
import { until } from './until.ts';
import type { Artifact } from '../src/protocol.ts';
import type { VerificationQueue, HubStatus } from '../src/protocol.ts';
import type { ItemSummary, ItemView } from '../src/tracker/tracker.ts';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { defaultConfig, parseConfig, renderConfig } from '../src/init/config.ts';
import { cacheRepository, humanRunnerFixture } from './suite-support.ts';


test('suite fixture exits and closes its hub and spoke after an ownership cleanup failure', async t => {
  const root = await tempProject(t, 'cland-suite-cleanup-regression-');
  const marker = join(root, 'children.json');
  const childTest = join(root, 'cleanup.test.mjs');
  await writeFile(childTest, `import {test} from 'node:test';
import {writeFile} from 'node:fs/promises';
import cp from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {fixture} from ${JSON.stringify(new URL('./suite-fixture.ts', import.meta.url).href)};
import {startDaemon} from ${JSON.stringify(new URL('./harness.ts', import.meta.url).href)};
test('forced ownership failure', async t => {
  const f = await fixture(t, 'node -e "process.exit(0)"', undefined, undefined, undefined, undefined, undefined, startDaemon);
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
  const child = spawn(process.execPath, ['--test', childTest], { env: runnerFixtureEnvironment(root, env), stdio: ['ignore', 'pipe', 'pipe'] });
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
  const fault = process.env.CLAND_TEST_HUNG_CLEANUP_FAULT;
  let f: Awaited<ReturnType<typeof fixture>>;
  let job: Awaited<ReturnType<typeof f.launch>> | undefined;
  // Run before fixture socket/hub disposal. The worker owns its captured tree
  // and phase roots; wait for its terminal cleanup receipt before removing them.
  onCleanup(t, async () => {
    if (!job) return;
    if (!(await f.results()).some(row => row.id === `suite:${job!.id}`)) {
      const cancelled = await f.ui.request({ type: 'suite.cancel', suite: job.id });
      assert.equal(cancelled.ok, true, cancelled.error);
    }
    await eventually('hung fixture terminal cleanup receipt', async () => (await f.results()).find(row => row.id === `suite:${job!.id}`));
  });
  f = await fixture(t, `${process.execPath} package.mjs`, undefined, { verification: `test_timeout="${fault ? '120s' : '1s'}"` });
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  const marker = join(f.root, 'hung-pids.json');
  await writeFile(join(f.root, 'package.mjs'), `import {runSuite} from ${JSON.stringify(runner)}; process.exitCode = await runSuite([['--test', 'hung.test.mjs']], {cwd: ${JSON.stringify(f.root)}, lockDirs: [${JSON.stringify(join(f.root, 'suite.lock'))}, ${JSON.stringify(join(f.root, 'suite.lock-nvim'))}]});`);
  await writeFile(join(f.root, 'hung.test.mjs'), `import {test} from 'node:test'; import {writeFile} from 'node:fs/promises';
  test('never resolves', async t => {const timer = setInterval(() => {}, 1000); t.after(() => clearInterval(timer));
    await writeFile(${JSON.stringify(marker)}, JSON.stringify([process.ppid, process.pid]));
    await new Promise(() => {});
  });`);
  job = await f.launch();
  const pids = await eventually('hung runner and worker PID receipt', () => readFile(marker, 'utf8').then(text => JSON.parse(text) as number[], () => undefined));
  if (fault === 'split') {
    const receipt = JSON.stringify({ root: f.root, pids });
    const split = receipt.indexOf('"pids":') + '"pids":'.length;
    process.stdout.write('hung fixture failure receipt ' + receipt.slice(0, split));
    await until(() => stat(join(f.root, 'receipt-continue')).then(() => true, () => false), { what: 'parent observed incomplete receipt', timeoutMs: 15000 });
    process.stdout.write(receipt.slice(split) + '\n');
  } else if (fault) console.log('hung fixture failure receipt ' + JSON.stringify({ root: f.root, pids }));
  if (fault === 'setup') assert.fail('deliberate hung fixture setup failure');
  for (const pid of pids) ownProcess(t, pid);
  if (fault === 'assertion' || fault === 'split') assert.fail(`deliberate hung fixture ${fault} failure`);
  const result = await eventually('hung test times out', async () => (await f.results()).find(row => row.id === `suite:${job!.id}`), 8000);
  assert.match(result.text, /exit 1/);
  const log = await readFile(result.artifacts[0]!.path, 'utf8');
  assert.match(log, /never resolves/);
  assert.match(log, /test timed out after 1000ms/);
  for (const pid of pids) assert.equal(pidAlive(pid), false, `hung fixture PID ${pid} survived timeout`);
});

for (const fault of ['setup', 'assertion', 'split']) test(`hung fixture reaps its runner and worker after ${fault} failure`, async t => {
  const root = await tempProject(t, 'cland-hung-cleanup-control-');
  // This enclosing test must also survive a missing/torn setup receipt. Scope
  // all nested fixtures beneath its root and discover writers before removal.
  onCleanup(t, () => cleanupProcesses(root, [], undefined, undefined, undefined, { discover: true }));
  const child = spawn(process.execPath, ['--test', '--test-name-pattern=^verify fails a named hung test', fileURLToPath(import.meta.url)], {
    cwd: root, env: runnerFixtureEnvironment(root, { ...process.env, NODE_TEST_CONTEXT: undefined, CLAND_TEST_HUNG_CLEANUP_FAULT: fault, TMPDIR: root, TMP: root, TEMP: root }), detached: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  ownProcess(t, child.pid);
  let output = '';
  let closed = false;
  child.stdout.on('data', data => { output += String(data); });
  child.stderr.on('data', data => { output += String(data); });
  const done = new Promise<number | null>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', code => { closed = true; resolve(code); });
  });
  void done.catch(() => {});
  onCleanup(t, async () => { await until(() => closed, { what: 'nested hung fixture pipes drained' }); await done; });
  // A pipe chunk/prefix is not the completed newline-delimited PID receipt.
  let held: { root: string; pids: number[] } | undefined;
  let resumed = false;
  await until(async () => {
    for (const line of output.split('\n').slice(0, -1)) {
      const at = line.indexOf('hung fixture failure receipt ');
      if (at < 0) continue;
      try {
        const value = JSON.parse(line.slice(at + 'hung fixture failure receipt '.length));
        if (typeof value.root === 'string' && value.root.startsWith(root + '/') && Array.isArray(value.pids)
          && value.pids.length === 2 && value.pids[0] !== value.pids[1] && value.pids.every((pid: unknown) => Number.isSafeInteger(pid) && Number(pid) > 0)) held = value;
      } catch { /* wait for a complete valid receipt */ }
    }
    if (fault === 'split' && !resumed && !held) {
      const partial = /hung fixture failure receipt \{"root":("(?:[^"\\]|\\.)*"),"pids":/.exec(output);
      if (partial) {
        const fixtureRoot = JSON.parse(partial[1]!) as string;
        assert.ok(fixtureRoot.startsWith(root + '/'));
        await writeFile(join(fixtureRoot, 'receipt-continue'), 'observed incomplete receipt');
        resumed = true;
      }
    }
    return held !== undefined || closed;
  }, { what: 'nested hung fixture complete PID receipt', timeoutMs: 15000 }).catch(error => {
    throw new Error(`${error.message}; exit ${child.exitCode}; signal ${child.signalCode}; tail: ${output.slice(-4000)}`);
  });
  assert.ok(held, `incomplete PID receipt; exit ${child.exitCode}; signal ${child.signalCode}; tail: ${output.slice(-4000)}`);
  if (fault === 'split') assert.equal(resumed, true, 'parent observed partial receipt before accepting the full line');
  for (const pid of held.pids) ownProcess(t, pid);
  await until(() => closed, { what: 'nested hung fixture exited', timeoutMs: 15000 });
  assert.equal(await done, 1, output);
  assert.ok(output.includes(`deliberate hung fixture ${fault} failure`), output);
  for (const pid of held.pids) assert.equal(pidAlive(pid), false, `hung fixture PID ${pid} survived ${fault} failure`);
  await assert.rejects(stat(held.root), { code: 'ENOENT' });
});

test('verify kills a silent test tree and spoke, names the last started test and frees admission', async t => {
  const f = await fixture(t, `${process.execPath} package.mjs`, undefined, { verification: 'stall_timeout="3s"' });
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
  const f = await fixture(t, `${process.execPath} parent.mjs`, undefined, { verification: 'stall_timeout="3s"' });
  const marker = join(f.root, 'pipe-holder.json');
  await writeFile(join(f.root, 'parent.mjs'), `import {spawn} from 'node:child_process'; import {writeFile} from 'node:fs/promises';
const child = spawn(process.execPath, ['-e', "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"], {detached: true, stdio: 'inherit'});
await writeFile(${JSON.stringify(marker)}, JSON.stringify({parent:process.pid,child:child.pid}));
setInterval(()=>console.log('parent running'),250);
setTimeout(()=>process.exit(0),3000);`);
  const foreign = spawn(process.execPath, ['-e', "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"], { env: fixtureEnvironment(f.root, process.env), cwd: f.root, detached: true, stdio: 'ignore' });
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
  // T3: real parent exit/reparenting determines whether the worker can prove pipe ownership.
  const bin = await tempProject(t, 'cland-fast-exit-ps-');
  // cland-allow-child-env: read-only which lookup for the process-table wrapper; no account or Git operation
  const ps = (await promisify(execFile)('which', ['ps'])).stdout.trim();
  const armed = join(bin, 'armed'); const snapshot = join(bin, 'snapshot');
  await writeFile(join(bin, 'ps'), `#!${process.execPath}
import {spawnSync} from 'node:child_process'; import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {until} from ${JSON.stringify(new URL('./until.ts', import.meta.url).href)};
import {pidAlive} from ${JSON.stringify(new URL('../src/project.ts', import.meta.url).href)};
import {parseProcessTable} from ${JSON.stringify(new URL('../src/process-table.ts', import.meta.url).href)};
// Match the native cleanup probe's buffer: ps eww includes every process's
// environment, which exceeds spawnSync's 1 MiB default on a busy Mac.
const result=spawnSync(${JSON.stringify(ps)}, process.argv.slice(2), {encoding:'utf8',maxBuffer:32*1024*1024});
if (process.argv.includes('-e') && existsSync(${JSON.stringify(armed)}) && !existsSync(${JSON.stringify(snapshot)})) {
  const parent=Number(readFileSync(${JSON.stringify(armed)},'utf8'));
  if (result.status===0 && parseProcessTable(result.stdout).some(row=>row.pid===parent)) {
    writeFileSync(${JSON.stringify(snapshot)},'captured');
    // Keep this pre-child snapshot in flight until ancestry is gone. Otherwise a
    // later capture can own the child while its parent yields in writeFile below.
    await until(()=>!pidAlive(parent),{what:'fast parent exited before ownership observation resumes'});
  }
}
process.stdout.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? '');
process.exitCode=result.status ?? 1;`, {mode:0o700});
  const f = await fixture(t, `${process.execPath} fast-parent.mjs`, undefined, { text: '[hygiene]\nloop_breaker_max=2\n', verification: 'stall_timeout="3s"' }, {PATH:`${bin}:${process.env.PATH ?? ''}`});
  const marker = join(f.root, 'fast-pids.json');
  await writeFile(join(f.root, 'fast-parent.mjs'), `import {spawn} from 'node:child_process'; import {writeFile} from 'node:fs/promises'; import {existsSync} from 'node:fs';
import {until} from ${JSON.stringify(new URL('./until.ts', import.meta.url).href)};
const heartbeat=setInterval(()=>console.log('waiting for ownership snapshot'),100);
await writeFile(${JSON.stringify(armed)}, String(process.pid));
await until(()=>existsSync(${JSON.stringify(snapshot)}),{what:'ownership snapshot captured before pipe holder starts'});
const child=spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"],{detached:true,stdio:'inherit'});
await writeFile(${JSON.stringify(marker)},JSON.stringify({parent:process.pid,child:child.pid}));
clearInterval(heartbeat);process.exit(0);`);
  const foreign = spawn(process.execPath, ['-e', "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"], { env: fixtureEnvironment(f.root, process.env),cwd:f.root, detached:true, stdio:'ignore'});
  ownProcess(t, foreign.pid);
  for (let n=0;n<3;n++) await f.spoke.call('send',{to:['rev'],topic:f.topic,text:`seed ${n}`});
  const job = await f.launch();
  const pids = await eventually('fast pipe holder started after snapshot', () => readFile(marker,'utf8').then(text=>JSON.parse(text) as {parent:number;child:number},()=>undefined));
  ownProcess(t,pids.parent);ownProcess(t,pids.child);
  await eventually('fast parent exited with its unverified pipe holder alive',()=>!pidAlive(pids.parent)&&pidAlive(pids.child)?true:undefined);
  // The warning follows the worker's stall watchdog and process/lease cleanup.
  // Give that teardown its own bound so it cannot consume the warning's receipt wait.
  await eventually('fast-exit worker cleanup receipt', () =>
    readFile(join(f.root,'.cland/run/suites',job.id,'result.json'),'utf8').catch(() => undefined), 30000);
  const warnings = async () => ((await f.ui.request({type:'topic.history',topic:'agents'})).value as {messages:Array<{id:string;severity?:string;text:string}>}).messages.filter(m=>m.id===`suite-cleanup:${job.id}`);
  const notice = await eventually('one cleanup warning',async()=> (await warnings())[0]);
  assert.equal(notice.severity,'warn'); assert.match(notice.text,/cleanup incomplete/);
  await eventually('result is held by mute after warning',async()=> {
    const status=(await f.ui.request({type:'hub.status', history: true})).value as HubStatus;
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
  await f.ui.request({type:'hub.status', history: true,flushLogs:true});
  const journal=completeJournalLines(await readFile(join(f.root,'.cland/journal.jsonl'), 'utf8')).map(line=>JSON.parse(line));
  assert.equal(journal.filter(r=>r.event==='verification-cleanup-incomplete'&&r.id===job.id).length,1);
  assert.equal((await warnings()).length,1);
});

test('verify keeps a slow command alive while partial stderr output continues', async t => {
  const f = await fixture(t, `node -e "let n=0;const timer=setInterval(()=>{process.stderr.write('.');if(++n===25)clearInterval(timer)},200)"`, undefined, { verification: 'stall_timeout="3s"' });
  const job = await f.launch();
  const result = await eventually('partial output prevents stall', async () => (await f.results()).find(m => m.id === `suite:${job.id}`));
  assert.match(result.text, /exit 0/);
  assert.doesNotMatch(await readFile(result.artifacts[0]!.path, 'utf8'), /stalled:/);
});

// A direct command supervisor fixture isolates shell pipeline ownership from hub admission.
test('stall timeout reaps the shell pipeline process tree', async t => {
  const root = await tempProject(t, 'cland-shell-stall-');
  const commandModule = new URL('../src/suite-command.ts', import.meta.url).href;
  const resultPath = join(root, 'command-result.json');
  const script = `import {suiteCommand} from ${JSON.stringify(commandModule)};
import {writeFile} from 'node:fs/promises';
const outcome = await suiteCommand('echo $$ > shell.pid; sleep 999 | cat', ${JSON.stringify(root)}, {
  ...process.env, CLAND_SUITE_LIMITS_CWD: ${JSON.stringify(root)},
  CLAND_SUITE_LIMITS: JSON.stringify({stallTimeoutMs: 3000})
});
await writeFile(${JSON.stringify(resultPath)}, JSON.stringify(outcome));`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', script], { env: fixtureEnvironment(root, process.env), stdio: ['ignore', 'pipe', 'pipe'] });
  ownProcess(t, child.pid);
  const done = new Promise<number | null>(resolve => child.once('close', resolve));
  const shell = await eventually('shell pipeline started', () => readFile(join(root, 'shell.pid'), 'utf8').then(Number, () => undefined));
  ownProcess(t, shell);
  const pipeline = await eventually('both pipeline children started', async () => {
    const children = (await systemProcesses()).filter(row => row.parent === shell);
    return children.length === 2 ? children : undefined;
  });
  for (const row of pipeline) ownProcess(t, row.pid);
  const outcome = await eventually('command cleanup receipt', () => readFile(resultPath, 'utf8').then(text => JSON.parse(text) as {code: number; cause: string}, () => undefined), 10000);
  assert.equal(await done, 0);
  assert.equal(outcome.code, 1);
  assert.match(outcome.cause, /stalled: no output for 0\.05 min/);
  assert.doesNotMatch(outcome.cause, /cleanup incomplete/);
  for (const pid of [shell, ...pipeline.map(row => row.pid)]) {
    await eventually('pipeline PID reaped', () => !pidAlive(pid) ? true : undefined);
    assert.equal(pidAlive(pid), false, `pipeline pid ${pid} survived stall cleanup`);
  }
});
