import assert from 'node:assert/strict';
import test from 'node:test';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { execFile, execFileSync } from 'node:child_process';
import { startDaemon, connectUi, clandWithEnv, killDaemon, spawnSpoke, eventually } from './harness.ts';
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

test('the demo recorder runs a headless case remotely and retains captures and executor accounting locally', async t => {
  const f = await fixture(t);
  await mkdir(join(f.root, 'hub/bin'), { recursive: true });
  const stub = join(f.root, 'hub/bin/cland.ts');
  await writeFile(stub, `#!/usr/bin/env node
const fs=require('fs'),path=require('path');
if(process.argv[2]!=='--headless'||process.argv[3]!=='--qa')process.exit(3);
const out=process.argv[process.argv.indexOf('--out')+1];
fs.mkdirSync(out,{recursive:true});const capture=path.join(out,'DEMO-001.screen.txt');
fs.writeFileSync(capture,'remote grid');console.log(JSON.stringify({result:'PASS',evidence:[capture]}));
`);
  await chmod(stub, 0o755);
  await f.git('add', 'hub/bin/cland.ts'); await f.git('commit', '-qm', 'Demo headless fixture');
  await f.git('update-ref', 'refs/heads/dev', await f.git('rev-parse', 'HEAD'));
  const epic = ((await f.ui.request({ type: 'task.create', title: 'Recorded demo', kind: 'epic' })).value as { item: { id: string } }).item.id;
  const start = await f.ui.request({ type: 'demo.start', epic }); assert.equal(start.ok, true, start.error);
  const recorded = await promisify(execFile)('sh', [resolve('.agents/skills/qa/qa-record.sh'), 'run', epic, 'demo-recorder', 'DEMO-001'], {
    cwd: f.root, env: { ...process.env, CLAND_SESSION_NAME: '', CLAND_SESSION_ID: '', CLAND_HUB_FILE: join(f.root, '.cland/hub.json'), CLAND: resolve('hub/bin/cland.ts'), QA_DEMO_EPIC: epic }, maxBuffer: 1024 * 1024 });
  const line = JSON.parse(recorded.stdout);
  assert.equal(line.item, epic);
  assert.equal(line.result, 'PASS'); assert.equal(line.executor, 'droplet');
  assert.equal(line.evidence[0], `.cland/qa/${epic}/demo-recorder/DEMO-001.screen.txt`);
  assert.equal(line.build, await f.git('rev-parse', 'dev'));
  assert.equal(typeof line.lifetime_ms, 'number'); assert.equal(typeof line.cost_usd, 'number');
  assert.equal(await readFile(join(f.root, line.evidence[0]), 'utf8'), 'remote grid');
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
