// T3: native package-runner processes transport coverage capture and failing selected-test exit receipts.
// Public CLI/socket tests use tiny package fixtures, never the live project's full-suite queue.
import { fixtureEnvironment } from './fixture-environment.ts';
import { serializeTierManifest } from '../src/suite-shards.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { clandWithEnv, connectUi, eventually, inProcessSpoke, projectHub, tempProject } from './harness.ts';
import { writeSuiteFixture, type ResultMessage } from './suite-fixture.ts';
import { ownProcess } from './process-cleanup.ts';
import type { Artifact } from '../src/protocol.ts';
import type { HubStatus } from '../src/protocol.ts';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { onCleanup } from './process-cleanup.ts';

test('integrated dev verify publishes a portable function map once; task verify never captures', async t => {
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  const root = await tempProject(t, 'cland-suite-coverage-native-');
  await writeSuiteFixture(root, 'node hub/test/run-suite.ts');
  const hub = await projectHub(t, root);
  const ui = await connectUi(t, hub.discovery, 'cli');
  await ui.request({ type: 'role.set', session: 'impl', role: 'implementer' });
  await ui.request({ type: 'role.set', session: 'rev', role: 'reviewer' });
  const impl = await inProcessSpoke(t, { discover: true, cwd: root, name: 'impl', sessionId: 'suite-caller', role: 'implementer' });
  await impl.waitForPresence(['impl']);
  const made = await ui.request({ type: 'task.create', size: 'M', title: 'coverage', assignee: 'impl' });
  const item = (made.value as { item: { id: string } }).item.id;
  const madeTopic = await ui.request({ type: 'topic.create', title: 'Coverage', item });
  const topic = (madeTopic.value as { topic: { id: string } }).topic.id;
  const env = { CLAND_SESSION_NAME: 'impl', CLAND_SESSION_ID: 'suite-caller' };
  const f = { root, ui, topic,
    results: async () => {
      const history = await ui.request({ type: 'topic.history', topic });
      return (history.value as { messages: ResultMessage[] }).messages.filter(m => m.text.startsWith('suite result '));
    },
    launch: async (mode: string) => {
      const response = await clandWithEnv(root, env, 'verify', mode, '--report', topic, '--to', 'rev', '--to', 'impl', '--json');
      assert.equal(response.code, 0, response.stderr);
      return JSON.parse(response.stdout) as { id: string };
    },
  };
  const git = async (...args: string[]) => (await promisify(execFile)('git', args, { env: fixtureEnvironment(root, process.env), cwd: root })).stdout.trim();
  await git('init', '--initial-branch=dev');
  await git('config', 'user.name', 'Coverage contract'); await git('config', 'user.email', 'coverage@example.invalid');
  await writeFile(join(root, '.gitignore'), '.cland/\norigin.git/\nsuite.lock*\n');
  await git('add', '.'); await git('commit', '-m', 'candidate');
  await git('init', '--bare', join(root, 'origin.git')); await git('remote', 'add', 'origin', join(root, 'origin.git'));
  await git('push', 'origin', 'dev');
  await git('checkout', 'dev');
  await mkdir(join(f.root, 'hub/test'), { recursive: true });
  await mkdir(join(f.root, 'hub/src/hub'), { recursive: true });
  await mkdir(join(f.root, 'nvim/test'), { recursive: true });
  await writeFile(join(f.root, 'hub/test/run-suite.ts'), `// inheritedLease and reduceCoverage supplied by the imported package runner\nimport { runPackageSuite } from ${JSON.stringify(runner)}; process.exitCode = await runPackageSuite('auto', [], { cwd: process.cwd() });`);
  await writeFile(join(f.root, 'hub/src/hub/covered.ts'), 'export function called() { return 42; }\nexport function never() { return 0; }\n');
  await writeFile(join(f.root, 'hub/test/covered.test.ts'), "import test from 'node:test'; import assert from 'node:assert/strict'; import { called } from '../src/hub/covered.ts'; test('fixture calls function', () => assert.equal(called(), 42));\n");
  for (const file of ['hub/test/scenarios/hub-lifecycle.test.ts', 'hub/test/scenarios/message-tracer.test.ts', 'hub/test/scenarios/startup-smoke.test.ts', 'nvim/test/scenarios/workbench.test.ts']) { await mkdir(join(f.root, file, '..'), { recursive: true }); await writeFile(join(f.root, file), "import test from 'node:test'; test('smoke', () => {});\n"); }
  await writeFile(join(f.root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: Object.fromEntries(['hub/test/covered.test.ts', 'hub/test/scenarios/hub-lifecycle.test.ts', 'hub/test/scenarios/message-tracer.test.ts', 'hub/test/scenarios/startup-smoke.test.ts', 'nvim/test/scenarios/workbench.test.ts'].map(file => [file, 'T3'])) }));
  await git('add', '.'); await git('commit', '-m', 'coverage fixture'); await git('push', 'origin', 'dev');
  const head = await git('rev-parse', 'HEAD');
  const coord = await inProcessSpoke(t, { discover: true, cwd: f.root, name: 'coord', sessionId: 'coverage-coord', role: 'coordinator' });
  onCleanup(t, () => coord.close());
  const launched = await clandWithEnv(f.root, { CLAND_SESSION_NAME: 'coord', CLAND_SESSION_ID: 'coverage-coord' }, 'verify', 'all', '--fresh', '--report', f.topic, '--to', 'rev', '--json');
  assert.equal(launched.code, 0, launched.stderr);
  const submitted = JSON.parse(launched.stdout) as { id: string; pid: number | null };
  if (submitted.pid) ownProcess(t, submitted.pid);
  const result = await eventually('integrated coverage result', async () => (await f.results())[0], 15000).catch(async error => {
    const status = (await f.ui.request({ type: 'hub.status' })).value as HubStatus;
    const log = await readFile(join(f.root, '.cland/run/suites', submitted.id, 'suite.log'), 'utf8');
    throw new Error(`${error.message}\n${JSON.stringify(status.suites)}\n${log}`);
  });
  assert.match(result.text, /exit 0/);
  const artifacts = (await f.ui.request({ type: 'artifact.list', topic: f.topic })).value as { artifacts: Artifact[] };
  const maps = artifacts.artifacts.filter(a => a.title.startsWith('Coverage map '));
  assert.equal(maps.length, 1);
  const map = JSON.parse(await readFile(maps[0]!.path, 'utf8'));
  assert.equal(map.head, head);
  assert.equal(map.tree, ((await f.ui.request({ type: 'hub.status' })).value as HubStatus).suites!.find(job => job.id === JSON.parse(launched.stdout).id)!.tree);
  assert.deepEqual(map.testFiles, ['hub/test/covered.test.ts', 'hub/test/scenarios/hub-lifecycle.test.ts', 'hub/test/scenarios/message-tracer.test.ts', 'hub/test/scenarios/startup-smoke.test.ts']);
  const functions = map.files['hub/src/hub/covered.ts'].functions;
  assert.deepEqual(functions.find((fn: { name: string }) => fn.name === 'called').tests, ['hub/test/covered.test.ts']);
  assert.deepEqual(functions.find((fn: { name: string }) => fn.name === 'never').tests, []);
  await git('checkout', '-b', 'task-coverage');
  await writeFile(join(f.root, 'hub/src/hub/covered.ts'), 'export function called() { return 43; }\nexport function never() { return 0; }\n');
  await git('add', '.'); await git('commit', '-m', 'one function');
  const task = await f.launch('auto');
  const taskResult = await eventually('selected task result', async () => (await f.results()).find(message => message.text.startsWith(`suite result ${task.id}`)), 15000);
  assert.match(taskResult.text, /mode hub-selected/);
  assert.match(taskResult.text, /deciding functions.*called/);
  // The selected run catches this deliberately changed return value.
  assert.match(taskResult.text, /exit 1/);
  const after = (await f.ui.request({ type: 'artifact.list', topic: f.topic })).value as { artifacts: Artifact[] };
  assert.equal(after.artifacts.filter(a => a.title.startsWith('Coverage map ')).length, 1);
});
