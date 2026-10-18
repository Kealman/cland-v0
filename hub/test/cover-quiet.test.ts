// T3 integration: process-lifecycle proof of cover-quiet admission across a real
// integrated worker and the CLI, from startup before fixtures through worker
// completion and slot release. The existing 25 ms barrier poll is unchanged;
// T-684's lint baseline owns it.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { connectUi, eventually, nativeProjectHub as projectHub, tempProject } from './harness.ts';
import { processStarted } from '../src/hub/lock.ts';
import { ownProcess } from './process-cleanup.ts';
import type { Holder } from '../src/suite-lock.ts';
import { fixture } from './suite-fixture.ts';
import { cacheRepository } from './suite-support.ts';

async function cover(t: TestContext, integrated = true) {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery, 'cli');
  const lock = join(root, 'suite.lock');
  const started = processStarted(process.pid)!;
  const lease = { pid: process.pid, started, token: 'cover-token' };
  await mkdir(lock);
  await writeFile(`${lock}.owner`, JSON.stringify({ ...lease, since: new Date().toISOString(), ...(integrated ? { integrated: 'cover-run' } : {}) }));
  return { root, ui, lock, lease };
}

const harness = new URL('./harness.ts', import.meta.url).href;
const nvimHarness = new URL('../../nvim/test/harness.ts', import.meta.url).href;
const runner = new URL('./run-suite.ts', import.meta.url).href;
async function target(t: TestContext, cwd: string, module: string, env: NodeJS.ProcessEnv = {}, code = "console.log('target reached')") {
  const tmp = await tempProject(t);
  const childEnv = { ...process.env, NODE_TEST_CONTEXT: '', TMPDIR: tmp, TMP: tmp, TEMP: tmp, ...env };
  const result = await new Promise<{ code: number; stdout: string; stderr: string }>(resolve => {
    const child = execFile(process.execPath, ['--input-type=module', '-e', `import {test} from 'node:test'; await import(${JSON.stringify(module)}); test('admitted target', async () => { ${code} });`], { cwd, env: childEnv, timeout: 15000 }, (error, stdout, stderr) => resolve({ code: error ? Number(error.code) || 1 : 0, stdout, stderr }));
    ownProcess(t, child.pid);
  });
  return { ...result, tmp };
}

const external = (root: string): NodeJS.ProcessEnv => ({ CLAND_HUB_FILE: join(root, '.cland', 'hub.json'), CLAND_SUITE_LEASE: '', CLAND_TEST_IGNORE_COVER: '' });

test('read-only test admission refuses an integrated local cover without joining the queue', async t => {
  const { ui, lease } = await cover(t);
  const result = await ui.request({ type: 'suite.slot', check: true });
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /cover-quiet.*cover-run/);
  assert.equal((await ui.request({ type: 'suite.slot', check: true, lease })).ok, true, 'the live cover worker is admitted');
  for (const wrong of [{ ...lease, token: 'another-run' }, { ...lease, started: 'reused-pid' }, { ...lease, pid: process.pid + 1 }]) {
    assert.match((await ui.request({ type: 'suite.slot', check: true, lease: wrong })).error ?? '', /cover-quiet/);
  }
  const queue = await ui.request({ type: 'suite.queue' });
  assert.deepEqual((queue.value as { waiters: unknown[] }).waiters, []);
});

for (const [name, module] of [['hub', harness], ['Neovim', nvimHarness]]) test(`${name} targeted startup exits cover-quiet before creating any fixture`, async t => {
  const { root } = await cover(t);
  const result = await target(t, root, module!, external(root));
  assert.notEqual(result.code, 0);
  assert.match(result.stderr + result.stdout, /cover-quiet.*cover-run/);
  assert.doesNotMatch(result.stdout, /target reached/);
  assert.deepEqual(await readdir(result.tmp), [], 'even account fixture setup waits for admission');
});

test('Neovim package entry refuses cover-quiet before creating a runner root or starting its target', async t => {
  const { root, lock } = await cover(t);
  const result = await target(t, root, runner, external(root), `const {runSuite} = await import(${JSON.stringify(runner)}); await runSuite([['-e', "console.log('target reached')"]], {cwd: ${JSON.stringify(root)}, lockDir: ${JSON.stringify(lock)}});`);
  assert.notEqual(result.code, 0);
  assert.match(result.stderr + result.stdout, /cover-quiet.*cover-run/);
  assert.doesNotMatch(result.stdout, /target reached/);
  assert.deepEqual(await readdir(result.tmp), []);
});

test('inherited cover workers and the human override pass targeted startup', async t => {
  const { root, lock, lease } = await cover(t);
  for (const exemption of [{ CLAND_SUITE_LEASE: JSON.stringify({ ...lease, dirs: [lock] }) }, { CLAND_TEST_IGNORE_COVER: '1' }]) {
    const result = await target(t, root, harness, { ...external(root), ...exemption });
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /target reached/);
  }
});

test('targeted startup passes without a project hub or with an ordinary local holder', async t => {
  const root = await tempProject(t);
  const standalone = await target(t, root, harness, external(root));
  assert.equal(standalone.code, 0, standalone.stderr);
  await mkdir(join(root, '.cland'));
  await writeFile(join(root, '.cland', 'hub.json'), JSON.stringify({ socket: join(root, 'absent.sock'), secret: 'fixture', port: 1, pid: process.pid, version: 'fixture' }));
  const absent = await target(t, root, harness, external(root));
  assert.equal(absent.code, 0, absent.stderr);
  const ordinary = await cover(t, false);
  const result = await target(t, ordinary.root, nvimHarness, external(ordinary.root));
  assert.equal(result.code, 0, result.stderr);
});

// The silent-hub deadline is covered with a fake clock at T2 in test-admission.test.ts.
for (const behavior of ['closed', 'legacy-refusal', 'unsupported'] as const) test(`a connected ${behavior} project hub keeps targeted fixtures unstarted`, async t => {
  const root = await tempProject(t);
  const socketPath = join(root, 'admission.sock');
  const server = createServer(socket => {
    socket.setEncoding('utf8');
    let buffer = '';
    socket.on('data', chunk => {
      buffer += chunk;
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const frame = JSON.parse(buffer.slice(0, nl)); buffer = buffer.slice(nl + 1);
        if (frame.type === 'hello') socket.write(JSON.stringify({ type: 'welcome', protocol: 2 }) + '\n');
        else if (frame.type === 'suite.slot') {
          if (behavior === 'closed') socket.end();
          else if (behavior === 'legacy-refusal' || behavior === 'unsupported') socket.write(JSON.stringify({ type: 'result', id: frame.id, ok: false, error: behavior === 'legacy-refusal' ? 'forbidden: suite.slot (only the human may do this)' : 'unknown request type "suite.slot"' }) + '\n');
        }
      }
    });
  });
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(socketPath, resolve); });
  await mkdir(join(root, '.cland'));
  await writeFile(join(root, '.cland', 'hub.json'), JSON.stringify({ socket: socketPath, secret: 'fixture', port: 1, pid: process.pid, version: 'fixture' }));
  const result = await target(t, root, harness, external(root));
  assert.notEqual(result.code, 0);
  assert.match(result.stderr + result.stdout, behavior === 'closed' ? /hub closed/ : /lacks the read-only suite.slot\/check capability; restart the hub with T-475/);
  assert.doesNotMatch(result.stdout, /target reached/);
  assert.deepEqual(await readdir(result.tmp), []);
});

test('borrowed package leases keep the integrated run identity for other project hubs', async t => {
  const { lock, lease } = await cover(t);
  const holder: Holder = { ...lease, since: new Date().toISOString() };
  // A fresh package process borrows and republishes the same compatibility fence.
  const result = await target(t, process.cwd(), new URL('../src/suite-lock.ts', import.meta.url).href, { ...external('/no-project-hub'), CLAND_SUITE_LEASE: JSON.stringify({ ...lease, dirs: [lock] }) }, `const {borrowLease} = await import(${JSON.stringify(new URL('../src/suite-lock.ts', import.meta.url).href)}); const leases = await borrowLease([${JSON.stringify(lock)}], ${JSON.stringify(holder)}); if (!leases) throw Error('not borrowed');`);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(JSON.parse(await readFile(`${lock}.owner`, 'utf8')).integrated, 'cover-run');
});

test('an integrated local worker protects its cover while admitting its own targeted harness', async t => {
  const f = await fixture(t, `${process.execPath} cover.mjs`);
  // This tiny package borrows the worker lease but does not publish coverage maps.
  await writeFile(join(f.root, 'cover.mjs'), `import {existsSync, writeFileSync} from 'node:fs';
import {test} from 'node:test';
await import(${JSON.stringify(harness)});
test('cover worker', async () => {
writeFileSync('.cland/worker-entered', 'yes');
while (!existsSync('.cland/worker-finish')) await new Promise(r => setTimeout(r, 25));
writeFileSync('.cland/worker-completed', 'yes');
});`);
  const git = await cacheRepository(f);
  await git('checkout', 'dev');
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  const run = await f.launch('all', '--executor', 'local');
  await eventually('integrated worker admitted its own harness', async () => readFile(join(f.root, '.cland', 'worker-entered'), 'utf8').catch(() => undefined));
  const unrelated = await target(t, f.root, harness, external(f.root));
  assert.notEqual(unrelated.code, 0);
  assert.ok((unrelated.stderr + unrelated.stdout).includes(`cover-quiet: integrated run ${run.id}`), unrelated.stderr + unrelated.stdout);
  await writeFile(join(f.root, '.cland', 'worker-finish'), 'yes');
  await eventually('integrated worker completion receipt', async () => readFile(join(f.root, '.cland', 'worker-completed'), 'utf8').catch(() => undefined));
  const receipt = await eventually('integrated worker durable result receipt', async () => readFile(join(f.root, '.cland', 'run', 'suites', run.id, 'result.json'), 'utf8').then(text => JSON.parse(text) as { code: number }, () => undefined));
  assert.equal(receipt.code, 0);
  const result = await eventually('integrated cover report', async () => (await f.results()).find(m => m.id === `suite:${run.id}`));
  assert.match(result.text, /all exit 0/);
  const after = await target(t, f.root, harness, external(f.root));
  assert.equal(after.code, 0, after.stderr);
});
