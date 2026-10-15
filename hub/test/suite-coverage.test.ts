import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { findPackageJSON } from 'node:module';
import { fileURLToPath } from 'node:url';
import { tempProject } from './harness.ts';

const exec = promisify(execFile);
const repository = fileURLToPath(new URL('../../', import.meta.url));

test('package capture attributes real CLI, daemon, spoke and fake processes to their test file', async t => {
  const root = await tempProject(t, 'cland-coverage-processes-');
  await mkdir(join(root, 'hub/test'), { recursive: true });
  await mkdir(join(root, 'nvim/test'), { recursive: true });
  await mkdir(join(root, '.cland/run'), { recursive: true });
  // Copy the production entries so raw V8 URLs name this fixture's own sources.
  // No fake dispatcher, spoke transport or CLI is introduced by this proof.
  for (const path of ['hub/src', 'hub/bin', 'hub/test/fakes', 'hub/package.json']) await cp(join(repository, path), join(root, path), { recursive: true, filter: path => !path.endsWith('.test.ts') });
  for (const file of ['harness.ts', 'account-fixture-env.ts', 'hub-resources.ts', 'process-cleanup.ts']) await cp(join(repository, 'hub/test', file), join(root, 'hub/test', file));
  const dependencies = dirname(dirname(findPackageJSON('smol-toml', import.meta.url)!));
  await symlink(dependencies, join(root, 'node_modules'), 'dir');
  await writeFile(join(root, 'package.json'), '{"type":"module"}');
  const file = 'hub/test/processes.test.ts';
  await writeFile(join(root, file), `
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { tempProject, startDaemon, cland, spawnSpoke, FAKE_CODEX_DIR } from './harness.ts';
test('daemon lifecycle and descendant attribution', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const spoke = await spawnSpoke({ discover: true, cwd: root, name: 'coverage-spoke' });
  await spoke.call('who');
  await spoke.close();
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  await promisify(execFile)(join(FAKE_CODEX_DIR, 'codex'), ['--version'], { env: process.env });
  const dir = process.env.NODE_V8_COVERAGE;
  assert.ok(dir.endsWith(Buffer.from(${JSON.stringify(file)}).toString('base64url')), 'per-file directory inherited');
  const urls = [];
  for (const name of await readdir(dir)) if (name.startsWith('coverage-') && name.endsWith('.json')) for (const script of JSON.parse(await readFile(join(dir, name), 'utf8')).result) urls.push(script.url);
  for (const suffix of ['/hub/src/cli/hub.ts', '/hub/src/hub/daemon.ts', '/hub/src/spoke/spoke.ts', '/hub/test/fakes/codex/fake-codex.ts']) assert.ok(urls.some(url => url.endsWith(suffix)), suffix + ' contributes raw coverage');
  await writeFile(${JSON.stringify(join(root, '.cland/run/contributors.json'))}, JSON.stringify(urls.filter(url => url.includes('/hub/'))));
});`);
  const smoke = ['hub/test/tracer.test.ts', 'hub/test/daemon.test.ts', 'nvim/test/client.test.ts', 'nvim/test/sessions.test.ts'];
  for (const path of smoke) await writeFile(join(root, path), "import test from 'node:test'; test('fixture smoke', () => {});\n");
  await writeFile(join(root, 'hub/test/shards.json'), JSON.stringify({ version: 1, tests: Object.fromEntries([file, ...smoke.filter(path => path.startsWith('hub/'))].map(file => [file, 'machine'])) }));
  const output = join(root, '.cland/run/coverage-map.json');
  const selection = { mode: 'full', files: [], reason: 'integrated fixture capture', recordCoverage: { head: 'a'.repeat(40), tree: 'b'.repeat(40), run: 'fixture' } };
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  const code = `import { runPackageSuite } from ${JSON.stringify(runner)}; process.exitCode = await runPackageSuite('auto', [], { cwd: ${JSON.stringify(root)}, lockDirs: ${JSON.stringify({ hub: join(root, 'hub.lock'), nvim: join(root, 'nvim.lock') })} });`;
  const env = { ...process.env, NODE_TEST_CONTEXT: '', CLAND_SUITE_SELECTION: JSON.stringify(selection), CLAND_COVERAGE_OUTPUT: output };
  const result = await exec(process.execPath, ['--input-type=module', '-e', code], { cwd: root, env, maxBuffer: 8 * 1024 * 1024 }).catch(error => { throw new Error(`fixture package failed\n${error.stdout}\n${error.stderr}`); });
  assert.match(result.stdout, /suite coverage map/);
  const map = JSON.parse(await readFile(output, 'utf8'));
  for (const path of ['hub/src/cli/hub.ts', 'hub/src/hub/daemon.ts', 'hub/src/spoke/spoke.ts']) {
    assert.ok(map.files[path]?.functions.some((fn: { tests: string[] }) => fn.tests.includes(file)), `${path} attributed to ${file}`);
    assert.ok(!map.files[path].functions.some((fn: { tests: string[] }) => fn.tests.includes('hub/test/tracer.test.ts')), 'import-only smoke cannot claim descendants');
  }
});
