// T3: real CLI/spoke stdio crosses native hub socket edges; child test runners prove timer-leak cleanup failures.
import { runnerFixtureEnvironment } from './fixture-environment.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, connectUi, nativeProjectHub as projectHub, projectHub as fixtureHub, spawnSpoke, startDaemon, tempProject } from './harness.ts';
import { lockHostIdentity } from '../src/hub/lock-identity.ts';
import { readLock } from '../src/hub/lock.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { FakeClock } from './fake-clock.ts';
import { fixtureWork } from './fixture-work.ts';
import { testWaitMs, waitTimeoutMs } from './until.ts';

async function assertTimerLeak(root: string, script: string, name: string) {
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  const reporter = new URL('./hub-cleanup-reporter.ts', import.meta.url).pathname;
  const result = await promisify(execFile)(process.execPath, ['--test', `--test-reporter=${reporter}`, script], {
    encoding: 'utf8', env: runnerFixtureEnvironment(root, env),
    timeout: Math.ceil(waitTimeoutMs(testWaitMs(30_000))), killSignal: 'SIGKILL', maxBuffer: 65_536,
  }).then(result => ({ code: 0, signal: null, ...result }), error => ({ code: error.code, signal: error.signal, stdout: error.stdout, stderr: error.stderr }));
  const diagnostic = `incomplete leak control: exit ${result.code}, signal ${result.signal}; tail: ${(result.stdout + result.stderr).slice(-4000)}`;
  assert.equal(result.code, 1, diagnostic);
  const failure = result.stdout.trim().split('\n').map((line: string) => JSON.parse(line)).find((row: { name: string }) => row.name === name);
  assert.ok(failure, diagnostic);
  assert.equal(failure.error.failureType, 'hookFailed', diagnostic);
  assert.equal(failure.error.cause.code, 'ERR_ASSERTION', diagnostic);
  assert.equal(failure.error.cause.operator, 'deepStrictEqual', diagnostic);
  assert.deepEqual(failure.error.cause.expected, { resources: [], listeners: [] }, diagnostic);
  assert.ok(failure.error.cause.actual.resources.includes('Timeout'), diagnostic);
}

test('projectHub explicitly opts into native lock identity with fake infrastructure probes', async t => {
  await fixtureWork(t).run(async work => {
    const root = await work.root(() => tempProject(t));
    const expected = await work.step(() => lockHostIdentity(process.platform, undefined, fixtureEnvironment(root, process.env)));
    await work.acquire(() => fixtureHub(t, root, {}, { clock: new FakeClock(), lockIdentity: 'native' }), hub => hub.dispose());
    assert.deepEqual(readLock(join(root, '.cland/hub.lock'))?.hostIdentity, expected);
  });
});

for (const start of [projectHub, startDaemon]) test(`${start.name}: CLI, spoke, Unix socket and WebSocket share the project`, async t => {
  const root = await tempProject(t);
  const { discovery } = await start(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  assert.match(await readFile(join(root, '.cland/log/hub.log'), 'utf8'), /"event":"config-loaded"/);
  const spoke = await spawnSpoke({ cwd: root, discover: true, name: 'impl', role: 'implementer' });
  t.after(() => spoke.close());
  await spoke.waitForPresence(['impl']);
  const result = await cland(root, 'task', 'create', '--size', 'S', 'Tracer', '--json');
  assert.equal(result.code, 0, result.stderr);
  const id = JSON.parse(result.stdout).item.id;
  for (const client of [ui]) {
    const view = await client.request({ type: 'task.view', item: id });
    assert.equal(view.ok, true, view.error);
    assert.equal((view.value as { item: { title: string } }).item.title, 'Tracer');
  }
  assert.equal((await spoke.call<{ item: { title: string } }>('task.view', { id })).item.title, 'Tracer');
});

test('projectHub cleanup fails when a hub timer is deliberately retained', async t => {
  const root = await tempProject(t);
  const harness = new URL('./harness.ts', import.meta.url).href;
  const script = join(root, 'leak.mjs');
  await writeFile(script, `import { test } from 'node:test';
import { projectHub, tempProject } from ${JSON.stringify(harness)};
test('leaked hub timer', async t => {
 const original = globalThis.clearInterval;
 let retained;
 globalThis.clearInterval = timer => { if (!retained) { retained = timer; timer.unref(); } else original(timer); };
 await projectHub(t, await tempProject(t));
 t.after(() => { globalThis.clearInterval = original; original(retained); });
});\n`);
  await assertTimerLeak(root, script, 'leaked hub timer');
});

test('projectHub cleanup detects a timer retained during a direct dispatcher request', async t => {
  const root = await tempProject(t);
  const harness = new URL('./harness.ts', import.meta.url).href;
  const script = join(root, 'request-leak.mjs');
  await writeFile(script, `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatcherUi, projectHub, tempProject } from ${JSON.stringify(harness)};
test('leaked request timer', async t => {
 const root = await tempProject(t);
 const { dispatcher } = await projectHub(t, root);
 let retained;
 const ui = await dispatcherUi(t, { open(transport, options) {
  return dispatcher.open({ ...transport, send(frame) {
   if (frame.type === 'result' && !retained) retained = setInterval(() => {}, 60000).unref();
   transport.send(frame);
  } }, options);
 } }, root);
 assert.equal((await ui.request({ type: 'hub.status' })).ok, true);
 assert.ok(retained, 'request reached the response boundary');
 t.after(() => clearInterval(retained));
});\n`);
  await assertTimerLeak(root, script, 'leaked request timer');
});
