// T3: delivered demo commands cross the real worker boundary; restart reconciles its lease,
// detached watchdogs delete machines with the hub gone, and recorder shell processes retain captures.
import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { execFile, execFileSync } from 'node:child_process';
import { startDaemon, nativeProjectHub as projectHub, connectUi, clandWithEnv, killDaemon, eventually } from './harness.ts';
import { ownProcess } from './process-cleanup.ts';
import { fixture } from './remote-fixture.ts';
import { readLease, writeLease } from '../src/executor/droplet/lease.ts';
import { parseConfig, renderConfig } from '../src/init/config.ts';

test('demo frames deliver a named dev commit, preserve command results and stop after restart', async t => {
  const { root, api, env, discovery, ui } = await fixture(t);
  const configPath = join(root, '.cland/config.toml');
  const config = parseConfig(await readFile(configPath, 'utf8'), 'demo commands');
  const commands = { prepare: 'printf admitted-prepare', check: 'printf admitted-check', test: 'printf admitted-test' };
  Object.assign(config.verification, commands, { test_unit: 'printf admitted-unit', test_soak: 'printf admitted-soak' });
  await writeFile(configPath, renderConfig(config));
  api.beforeCreate(async () => {
    Object.assign(config.verification, { prepare: 'false', check: 'false', test: 'false', test_unit: 'false', test_soak: 'false' });
    await writeFile(configPath, renderConfig(config));
  });
  const made = await ui.request({ type: 'task.create', title: 'Demo', kind: 'epic' });
  const epic = (made.value as { item: { id: string } }).item.id;
  const head = execFileSync('git', ['rev-parse', 'dev'], { cwd: root, encoding: 'utf8' }).trim();
  const started = await ui.request({ type: 'demo.start', epic }, 15000);
  assert.equal(started.ok, true, started.error);
  assert.equal((started.value as { commit: string }).commit, head);
  assert.ok((started.value as { lease: string }).lease);
  assert.ok((started.value as { lifetimeMs: number }).lifetimeMs > 0);
  const dir = join(root, '.cland/run/executor/leases', (started.value as { lease: string }).lease);
  const pinned = { ...commands, tiers: { T1: 'printf admitted-unit', T4: 'printf admitted-soak' }, plan: [
    { name: 'check', command: commands.check }, { name: 'T1', command: 'printf admitted-unit' }, { name: 'T4', command: 'printf admitted-soak' },
  ] };
  assert.deepEqual((await readLease(dir)).demo?.commands, pinned);
  const script = await readFile(join(dir, 'run.sh'), 'utf8');
  assert.match(script, /\/bin\/sh -c 'printf admitted-check'/);
  assert.match(script, /tier T1: exit %s/);
  assert.match(script, /tier T4: exit %s/);
  assert.doesNotMatch(script, /\/bin\/sh -c 'false'/);
  const result = await ui.request({ type: 'demo.exec', epic, command: ['sh', '-c', 'git rev-parse HEAD; printf problem >&2; exit 7'] });
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.value, { stdout: `${head}\n`, stderr: 'problem', code: 7 });
  const cli = await clandWithEnv(root, {}, 'demo', 'exec', epic, '--', 'printf', 'a b');
  assert.equal(cli.code, 0, cli.stderr); assert.equal(cli.stdout, 'a b');
  await killDaemon(discovery.pid);
  const restarted = await startDaemon(t, root, env);
  const next = await connectUi(t, restarted.discovery);
  assert.deepEqual((await readLease(dir)).demo?.commands, pinned);
  const stopped = await next.request({ type: 'demo.stop', epic });
  assert.equal(stopped.ok, true, stopped.error);
  assert.deepEqual(api.droplets, []);
  const creates = api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets');
  assert.equal(creates.length, 1);
  assert.ok((creates[0]!.body as { tags: string[] }).tags.includes('cland'));
  assert.ok(api.requests.some(r => r.method === 'DELETE' && r.path.startsWith('/v2/droplets/')));
  const viewed = await next.request({ type: 'task.view', item: epic });
  assert.match(JSON.stringify(viewed.value), /demo.*created/);
  assert.match(JSON.stringify(viewed.value), /demo.*destroyed.*cost/);
  const repeated = await next.request({ type: 'demo.start', epic, commit: head });
  assert.equal(repeated.ok, true, repeated.error);
  assert.notEqual((repeated.value as { lease: string }).lease, (started.value as { lease: string }).lease);
  const exit255 = await next.request({ type: 'demo.exec', epic, command: ['sh', '-c', 'git rev-parse HEAD; exit 255'] });
  assert.equal(exit255.ok, true, exit255.error);
  assert.deepEqual(exit255.value, { stdout: `${head}\n`, stderr: '', code: 255 });
  const newest = await next.request({ type: 'demo.stop', epic });
  assert.equal(newest.ok, true, newest.error);
  assert.equal((newest.value as { lease: string }).lease, (repeated.value as { lease: string }).lease);
  assert.deepEqual(api.droplets, []);
  assert.equal(api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 2);
});

for (const bound of ['run timeout', 'machine lifetime']) test(`demo ${bound} destroys the machine through the watchdog even with the hub gone`, async t => {
  // Product deadlines include acquire and delivery. Give setup its own budget;
  // accelerate the persisted deadline only once delivery and hub shutdown finish.
  const setupMs = 60000;
  const f = await fixture(t, { env: { [bound === 'run timeout' ? 'CLAND_TEST_EXECUTOR_RUN_TIMEOUT_MS' : 'CLAND_TEST_EXECUTOR_LIFETIME_MS']: String(setupMs), CLAND_TEST_DROPLET_MACHINE_MS: '2000', CLAND_TEST_EXECUTOR_COLLECTION_MARGIN_MS: '1', CLAND_TEST_DROPLET_WATCHDOG_POLL_MS: '20' } });
  f.api.faults.archiveOnDelete = true; f.api.faults.deletePolls = 2;
  f.api.faults.keyDeleteFailures.push(403);
  const epic = ((await f.ui.request({ type: 'task.create', title: 'Timed demo', kind: 'epic' })).value as { item: { id: string } }).item.id;
  const beforeStart = Date.now();
  const started = await f.ui.request({ type: 'demo.start', epic }, 20000);
  assert.equal(started.ok, true, started.error);
  const leaseId = (started.value as { lease: string }).lease;
  const dir = join(f.root, '.cland/run/executor/leases', leaseId);
  const lease = await readLease(dir);
  const originalDeadline = Date.parse(lease.deadline);
  if (bound === 'run timeout') {
    assert.ok(originalDeadline >= beforeStart + setupMs && originalDeadline <= Date.parse(lease.created) + setupMs,
      'demo run timeout starts before acquire and delivery');
  } else {
    assert.equal(originalDeadline, Date.parse(lease.created) + setupMs,
      'machine lifetime starts at lease creation');
  }
  assert.equal(lease.execution?.delivered, true);
  assert.equal(lease.demo?.ready, true);
  ownProcess(t, lease.watchdog!.pid);
  await killDaemon(f.discovery.pid);
  assert.equal(f.api.droplets.length, 1, 'machine remains live before the accelerated deadline');
  const deadline = new Date(Date.now() + 250).toISOString();
  await writeLease(f.root, { ...lease, deadline });
  await eventually('watchdog deletes expired demo without a hub', async () => f.api.droplets.length === 0 ? true : undefined);
  assert.ok(f.api.requests.some(r => r.method === 'DELETE' && r.path.startsWith('/v2/droplets/')));
  const receipt = await eventually('detached watchdog confirms deletion', async () => {
    try { return JSON.parse(await readFile(join(dir, 'watchdog.json'), 'utf8')) as { fired: string; confirmedAt: string }; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
  });
  assert.ok(Date.parse(receipt.fired) >= Date.parse(deadline), 'watchdog waits for the persisted deadline');
  assert.ok(Date.parse(receipt.confirmedAt) >= Date.parse(receipt.fired), 'watchdog confirms provider absence after firing');
});

async function recorderFixture(t: TestContext) {
  const f = await fixture(t, { hub: projectHub });
  await mkdir(join(f.root, 'hub/bin'), { recursive: true });
  const stub = join(f.root, 'hub/bin/cland.ts');
  await writeFile(join(f.root, 'hub/bin/cland'), await readFile(resolve('hub/bin/cland')));
  await chmod(join(f.root, 'hub/bin/cland'), 0o755);
  await writeFile(stub, `#!/usr/bin/env node
const fs=require('fs'),path=require('path');
if(process.argv[2]!=='--headless'||process.argv[3]!=='--qa')process.exit(3);
const out=process.argv[process.argv.indexOf('--out')+1];
fs.mkdirSync(out,{recursive:true});const capture=path.join(out,'rulebook-rows.screen.txt');
fs.writeFileSync(capture,'remote grid');const evidence=[capture];
console.error('remote headless stderr');
if(process.argv.includes('qa/cases/BROKEN-001.lua')){console.log('invalid case JSON');process.exit(2);}
if(process.argv.includes('qa/cases/COLLISION-001.lua'))evidence.push(capture);
const final=path.join(out,'DEMO-001.screen.txt');fs.writeFileSync(final,'final grid');evidence.push(final);
console.log(JSON.stringify({result:'PASS',evidence,message:out}));
`);
  await chmod(stub, 0o755);
  await f.git('add', 'hub/bin'); await f.git('commit', '-qm', 'Demo headless fixture');
  await f.git('update-ref', 'refs/heads/dev', await f.git('rev-parse', 'HEAD'));
  const epic = ((await f.ui.request({ type: 'task.create', title: 'Recorded demo', kind: 'epic' })).value as { item: { id: string } }).item.id;
  const start = await f.ui.request({ type: 'demo.start', epic }); assert.equal(start.ok, true, start.error);
  const record = (run: string, id: string) => promisify(execFile)('sh', [resolve('.agents/skills/qa/qa-record.sh'), 'run', epic, run, id], {
    cwd: f.root, env: { ...process.env, CLAND_SESSION_NAME: '', CLAND_SESSION_ID: '', CLAND_HUB_FILE: join(f.root, '.cland/hub.json'), CLAND: resolve('hub/bin/cland.ts'), QA_DEMO_EPIC: epic }, maxBuffer: 1024 * 1024 });
  return { ...f, epic, record };
}

test('the demo recorder runs a headless case remotely and retains captures and executor accounting locally', async t => {
  const f = await recorderFixture(t);
  const { epic } = f;
  const launcher = await f.ui.request({ type: 'demo.exec', epic, command: ['sh', '-c', 'command -v cland; cland --headless --qa qa/cases/DEMO-001.lua --out "$HOME/launcher-check"'] });
  assert.equal(launcher.ok, true, launcher.error);
  const output = launcher.value as { code: number; stdout: string; stderr: string };
  assert.equal(output.code, 0, output.stderr);
  assert.match(output.stdout.split('\n')[0]!, /\/cland\/hub\/bin\/cland$/);
  assert.equal(JSON.parse(output.stdout.trim().split('\n').at(-1)!).result, 'PASS');
  const recorded = await f.record('demo-recorder', 'DEMO-001');
  const line = JSON.parse(recorded.stdout);
  assert.equal(line.item, epic);
  assert.equal(line.result, 'PASS'); assert.equal(line.executor, 'droplet');
  assert.deepEqual(line.evidence, [`.cland/qa/${epic}/demo-recorder/rulebook-rows.screen.txt`, `.cland/qa/${epic}/demo-recorder/DEMO-001.screen.txt`]);
  assert.equal(line.build, await f.git('rev-parse', 'dev'));
  assert.equal(typeof line.lifetime_ms, 'number'); assert.equal(typeof line.cost_usd, 'number');
  assert.equal(await readFile(join(f.root, line.evidence[0]), 'utf8'), 'remote grid');
  assert.equal(await readFile(join(f.root, line.evidence[1]), 'utf8'), 'final grid');
  const cleaned = await f.ui.request({ type: 'demo.exec', epic, command: ['node', '-e', "process.stdout.write(String(require('fs').existsSync(process.argv[1])))", line.message] });
  assert.equal(cleaned.ok, true, cleaned.error);
  assert.equal((cleaned.value as { stdout: string }).stdout, 'false', 'validated captures are removed remotely');
  const stopped = await f.ui.request({ type: 'demo.stop', epic }); assert.equal(stopped.ok, true, stopped.error);
});

test('demo recorder failures persist diagnostics and keep remote captures for recovery', async t => {
  const f = await recorderFixture(t);
  const { epic } = f;
  for (const [run, id, error] of [['local-copy', 'DEMO-001', /EEXIST/], ['malformed-result', 'BROKEN-001', /JSON/], ['collision', 'COLLISION-001', /duplicate capture name: rulebook-rows.screen.txt/]] as const) {
    if (run === 'local-copy') await mkdir(join(f.root, '.cland/qa', epic, run, 'rulebook-rows.screen.txt'), { recursive: true });
    const recorded = await f.record(run, id).then(() => assert.fail('recorder should fail'), error => error);
    assert.equal(recorded.code, 2, recorded.stderr);
    const line = JSON.parse(recorded.stdout);
    assert.equal(line.result, 'BLOCKED'); assert.deepEqual(line.evidence, []);
    assert.match(line.message, error);
    assert.match(line.stderr, /remote headless stderr/);
    assert.match(line.remote_output, /cland-demo-case-/);
    const retained = await f.ui.request({ type: 'demo.exec', epic, command: ['node', '-e', "process.stdout.write(require('fs').readFileSync(require('path').join(process.argv[1],'rulebook-rows.screen.txt'),'utf8'))", line.remote_output] });
    assert.equal(retained.ok, true, retained.error);
    assert.equal((retained.value as { stdout: string }).stdout, 'remote grid');
    const lines = (await readFile(join(f.root, '.cland/qa/runs.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    assert.deepEqual(lines.at(-1), line, 'diagnostics are persisted, not only printed');
    const cleanup = await f.ui.request({ type: 'demo.exec', epic, command: ['node', '-e', "require('fs').rmSync(process.argv[1],{recursive:true,force:true})", line.remote_output] });
    assert.equal(cleanup.ok, true, cleanup.error);
  }
  const stopped = await f.ui.request({ type: 'demo.stop', epic }); assert.equal(stopped.ok, true, stopped.error);
});
