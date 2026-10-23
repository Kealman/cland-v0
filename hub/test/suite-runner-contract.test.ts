// T3: real workers and hand runners prove cross-process compatibility leases span
// typecheck, both package phases and pre-V1 runner acquisition without deadlock.
// Live package PID identities also survive legacy/UTC observer timezones.
import { fixtureEnvironment } from './fixture-environment.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, stat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, clandWithEnv, eventually } from './harness.ts';
import { fixture } from './suite-fixture.ts';
import { ownProcess } from './process-cleanup.ts';
import type { VerificationQueue } from '../src/protocol.ts';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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
  const hand = spawn(process.execPath, ['--input-type=module', '-e', `import { runSuite } from ${JSON.stringify(runner)};process.exitCode=await runSuite([['-e', ${JSON.stringify("require('fs').writeFileSync('hand-entered','')")}]], {cwd:${JSON.stringify(f.root)},lockDirs:${JSON.stringify(locks)}})`], { env: fixtureEnvironment(f.root, process.env),cwd:f.root, stdio:['ignore','ignore','pipe']});
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

test('a hand-run package holding the old lock occupies admission until it exits', async t => {
  const f = await fixture(t, 'node -e "process.exit(0)"');
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  const locks = [join(f.root, 'suite.lock'), join(f.root, 'suite.lock-nvim')];
  const code = "const fs=require('fs');fs.writeFileSync('hand-entered','');const p=setInterval(()=>{if(fs.existsSync('hand-finish'))clearInterval(p)},25)";
  const hand = spawn(process.execPath, ['--input-type=module', '-e', `import {runSuite} from ${JSON.stringify(runner)};process.exitCode=await runSuite([['-e',${JSON.stringify(code)}]], {cwd:${JSON.stringify(f.root)},lockDirs:${JSON.stringify(locks)}})`], {cwd:f.root,env: fixtureEnvironment(f.root, process.env, { CLAND_TEST_SKIP_LOCK:'0' }),stdio:'ignore'});
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
  const hand = spawn(process.execPath,['--input-type=module','-e',`import {runSuite} from ${JSON.stringify(runner)};process.exitCode=await runSuite([['-e',"require('fs').writeFileSync('hand-entered','')"]],${JSON.stringify({cwd:f.root,lockDirs:Object.values(locks)})});`],{cwd:f.root,env: fixtureEnvironment(f.root, process.env, { CLAND_TEST_SKIP_LOCK:'0' }),stdio:['ignore','ignore','pipe']});
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


// A live package runner retains its PID identity across legacy/UTC observer timezones.
for (const legacy of [false, true]) test(`verify queue preserves a live ${legacy ? 'legacy' : 'UTC'} package holder across observer timezones`, async t => {
  const f = await fixture(t, 'node -e "process.exit(0)"', undefined, '', { TZ: 'Pacific/Honolulu' });
  const lock = join(f.root, 'suite.lock');
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  const marker = join(f.root, 'hand-started');
  const finish = join(f.root, 'hand-finish');
  const file = join(f.root, 'hand.mjs');
  await writeFile(file, `import test from 'node:test'; import { existsSync, writeFileSync } from 'node:fs'; test('hand holder', async () => { writeFileSync(${JSON.stringify(marker)}, 'ready'); while (!existsSync(${JSON.stringify(finish)})) await new Promise(r => setTimeout(r, 25)); });`);
  const child = spawn(process.execPath, ['--input-type=module', '-e', `import { runPackageSuite } from ${JSON.stringify(runner)}; process.exitCode = await runPackageSuite('all', [${JSON.stringify(file)}], { cwd: ${JSON.stringify(f.root)}, lockDirs: { hub: ${JSON.stringify(lock)}, nvim: ${JSON.stringify(`${lock}-nvim`)} } });`], {
    env: fixtureEnvironment(f.root, process.env, { NODE_TEST_CONTEXT: '', CLAND_TEST_SKIP_LOCK: '0', TZ: 'UTC' }), stdio: ['ignore', 'pipe', 'pipe'],
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

