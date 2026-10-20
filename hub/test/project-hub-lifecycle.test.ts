// T3: real CLI/spoke stdio crosses native hub socket edges; child test runners prove timer-leak cleanup failures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, connectUi, nativeProjectHub as projectHub, spawnSpoke, startDaemon, tempProject } from './harness.ts';

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
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  const result = await promisify(execFile)(process.execPath, ['--test', script], { encoding: 'utf8', env }).then(result => ({ code: 0, ...result }), error => ({ code: error.code, stdout: error.stdout, stderr: error.stderr }));
  assert.equal(result.code, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /projectHub leaked resources/);
  assert.match(result.stdout, /Timeout/);
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
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  const result = await promisify(execFile)(process.execPath, ['--test', script], { encoding: 'utf8', env }).then(result => ({ code: 0, ...result }), error => ({ code: error.code, stdout: error.stdout, stderr: error.stderr }));
  assert.equal(result.code, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /projectHub leaked resources/);
  assert.match(result.stdout, /Timeout/);
});
