import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { execFile, execFileSync } from 'node:child_process';
import { startDaemon, projectHub, connectUi, clandWithEnv, killDaemon, spawnSpoke, eventually } from './harness.ts';
import { ownProcess } from './process-cleanup.ts';
import { fixture } from './remote-fixture.ts';

test('demo frames deliver a named dev commit, preserve command results and stop after restart', async t => {
  const { root, api, env, discovery, ui } = await fixture(t);
  const made = await ui.request({ type: 'task.create', title: 'Demo', kind: 'epic' });
  const epic = (made.value as { item: { id: string } }).item.id;
  const head = execFileSync('git', ['rev-parse', 'dev'], { cwd: root, encoding: 'utf8' }).trim();
  const started = await ui.request({ type: 'demo.start', epic }, 15000);
  assert.equal(started.ok, true, started.error);
  assert.equal((started.value as { commit: string }).commit, head);
  assert.ok((started.value as { lease: string }).lease);
  assert.ok((started.value as { lifetimeMs: number }).lifetimeMs > 0);
  const result = await ui.request({ type: 'demo.exec', epic, command: ['sh', '-c', 'git rev-parse HEAD; printf problem >&2; exit 7'] });
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.value, { stdout: `${head}\n`, stderr: 'problem', code: 7 });
  const cli = await clandWithEnv(root, {}, 'demo', 'exec', epic, '--', 'printf', 'a b');
  assert.equal(cli.code, 0, cli.stderr); assert.equal(cli.stdout, 'a b');
  await killDaemon(discovery.pid);
  const restarted = await startDaemon(t, root, env);
  const next = await connectUi(t, restarted.discovery);
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
});

test('demo authorization, shared slot refusals and verdict cleanup use the same tagged lease', async t => {
  const { root, ui, api } = await fixture(t, { config: 'remote_budget = 1\n' });
  const create = async (title: string) => ((await ui.request({ type: 'task.create', title, kind: 'epic' })).value as { item: { id: string } }).item.id;
  const epic = await create('First demo'), other = await create('Other demo');
  const before = api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length;
  const forbidden = await clandWithEnv(root, { CLAND_SESSION_NAME: 'impl', CLAND_SESSION_ID: 'remote-impl' }, 'demo', 'start', epic);
  assert.equal(forbidden.code, 1); assert.match(forbidden.stderr, /forbidden/);
  assert.equal(api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, before);
  const qa = await spawnSpoke({ discover: true, cwd: root, name: 'qa-demo', sessionId: 'demo-qa', role: 'qa' }); t.after(() => qa.close());
  await qa.waitForPresence(['qa-demo']);
  const actor = { CLAND_SESSION_NAME: 'qa-demo', CLAND_SESSION_ID: 'demo-qa' };
  const noHold = await clandWithEnv(root, actor, 'demo', 'start', epic);
  assert.equal(noHold.code, 1); assert.match(noHold.stderr, /forbidden/);
  assert.equal((await qa.call<{ ok: boolean }>('task.hold', { id: epic })).ok, true);
  const start = await clandWithEnv(root, actor, 'demo', 'start', epic, '--json');
  assert.equal(start.code, 0, start.stderr);
  const blocked = await ui.request({ type: 'demo.start', epic: other });
  assert.equal(blocked.ok, false); assert.match(blocked.error ?? '', /remote budget full/);
  assert.equal(api.droplets.length, 1);
  assert.equal((await qa.call<{ ok: boolean }>('task.comment', { id: epic, verdict: 'qa', result: 'clear', run: 'demo-cleanup' })).ok, true);
  await eventually('verdict destroys demo droplet', async () => api.droplets.length === 0 ? true : undefined);
  assert.ok(api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').every(r => (r.body!.tags as string[]).includes('cland')));
});

for (const bound of ['run timeout', 'machine lifetime']) test(`demo ${bound} destroys the machine through the watchdog even with the hub gone`, async t => {
  const f = await fixture(t, { env: { [bound === 'run timeout' ? 'CLAND_TEST_EXECUTOR_RUN_TIMEOUT_MS' : 'CLAND_TEST_EXECUTOR_LIFETIME_MS']: '2500', CLAND_TEST_EXECUTOR_COLLECTION_MARGIN_MS: '1', CLAND_TEST_DROPLET_WATCHDOG_POLL_MS: '20' } });
  f.api.faults.archiveOnDelete = true; f.api.faults.deletePolls = 2;
  f.api.faults.keyDeleteFailures.push(403);
  const epic = ((await f.ui.request({ type: 'task.create', title: 'Timed demo', kind: 'epic' })).value as { item: { id: string } }).item.id;
  const started = await f.ui.request({ type: 'demo.start', epic });
  assert.equal(started.ok, true, started.error);
  const leaseId = (started.value as { lease: string }).lease;
  const lease = JSON.parse(await readFile(join(f.root, '.cland/run/executor/leases', leaseId, 'lease.json'), 'utf8'));
  ownProcess(t, lease.watchdog.pid);
  await killDaemon(f.discovery.pid);
  await eventually('watchdog deletes expired demo without a hub', async () => f.api.droplets.length === 0 ? true : undefined);
  assert.ok(f.api.requests.some(r => r.method === 'DELETE' && r.path.startsWith('/v2/droplets/')));
});

test('demo daily cap refuses before creating any droplet', async t => {
  const f = await fixture(t, { config: 'daily_spend_usd = 0.001\n' });
  const epic = ((await f.ui.request({ type: 'task.create', title: 'Capped demo', kind: 'epic' })).value as { item: { id: string } }).item.id;
  const started = await f.ui.request({ type: 'demo.start', epic });
  assert.equal(started.ok, false); assert.match(started.error ?? '', /cap|spend|budget/);
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 0);
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

test('successive demo leases select the newest lease and preserve exit 255 at an explicit commit', async t => {
  const f = await fixture(t);
  const epic = ((await f.ui.request({ type: 'task.create', title: 'Repeated demo', kind: 'epic' })).value as { item: { id: string } }).item.id;
  const commit = await f.git('rev-parse', 'dev');
  for (let i = 0; i < 2; i++) {
    const started = await f.ui.request({ type: 'demo.start', epic, commit }); assert.equal(started.ok, true, started.error);
    const output = await f.ui.request({ type: 'demo.exec', epic, command: ['sh', '-c', 'git rev-parse HEAD; exit 255'] });
    assert.equal(output.ok, true, output.error); assert.deepEqual(output.value, { stdout: `${commit}\n`, stderr: '', code: 255 });
    const stopped = await f.ui.request({ type: 'demo.stop', epic }); assert.equal(stopped.ok, true, stopped.error);
    assert.equal((stopped.value as { lease: string }).lease, (started.value as { lease: string }).lease);
    assert.deepEqual(f.api.droplets, []);
  }
});
