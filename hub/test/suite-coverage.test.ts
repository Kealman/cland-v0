// T3: package capture attributes real hub/spoke/CLI descendant coverage across the hub's lifecycle.
import { serializeTierManifest } from '../src/suite-shards.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, readFile, stat, symlink, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { findPackageJSON } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tempProject } from './harness.ts';
import { reduceCoverage } from '../src/suite-coverage.ts';
import { fixtureSource, sourceFixtureFiles } from './source-fixture.ts';
import { fixtureEnvironment } from './fixture-environment.ts';

const exec = promisify(execFile);
const repository = fileURLToPath(new URL('../../', import.meta.url));

for (const append of ['0', '1']) test(`Web-only coverage preserves the map and test exit code (append=${append})`, async t => {
  const root = await tempProject(t, 'cland-coverage-web-');
  const file = 'web/test/smoke.test.ts';
  await mkdir(join(root, 'web/test'), { recursive: true });
  await mkdir(join(root, 'hub/test'), { recursive: true });
  await writeFile(join(root, 'web/test/prerequisite.ts'), 'export const webPrerequisite = async () => ({ available: true, executablePath: process.execPath });');
  await writeFile(join(root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: { [file]: 'Web' } }));
  const output = join(root, 'coverage-map.json');
  const previous = JSON.stringify({ version: 1, head: 'a'.repeat(40), tree: 'b'.repeat(40), created: '2026-10-20T00:00:00.000Z', testFiles: ['hub/test/previous.test.ts'], files: {} }) + '\n';
  await writeFile(output, previous);
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  const env = fixtureEnvironment(root, process.env, {
    NODE_TEST_CONTEXT: '', CLAND_TEST_SKIP_LOCK: '1', CLAND_COVERAGE_OUTPUT: output, CLAND_COVERAGE_APPEND: append,
    CLAND_SUITE_SELECTION: JSON.stringify({ mode: 'full', files: [], reason: 'Web coverage fixture', recordCoverage: { head: 'a'.repeat(40), tree: 'b'.repeat(40), run: 'fixture' } }),
  });
  for (const expected of [0, 1]) {
    await writeFile(join(root, file), `import test from 'node:test'; import assert from 'node:assert/strict'; test('Web fixture', () => assert.equal(${expected}, 0));`);
    const result = await exec(process.execPath, [runner, '--tier', 'Web'], { cwd: root, env, timeout: 10_000 })
      .then(value => ({ ...value, code: 0 }), error => {
        if (typeof error.code !== 'number') throw error;
        return { code: error.code as number, stdout: String(error.stdout), stderr: String(error.stderr) };
      });
    assert.equal(result.code, expected, result.stdout + result.stderr);
    assert.match(result.stdout, /Web fixture/);
    assert.doesNotMatch(result.stdout, /suite coverage map/);
    assert.equal(await readFile(output, 'utf8'), previous);
    await assert.rejects(stat(`${output}.raw`), { code: 'ENOENT' });
  }
});

test('coverage receipts follow owner start times when a pid is reused, independent of test order', async t => {
  const root = await tempProject(t, 'cland-coverage-reused-pid-');
  const raw = join(root, 'raw');
  const first = 'hub/test/first.test.ts';
  const second = 'hub/test/second.test.ts';
  const source = 'hub/src/example.ts';
  await mkdir(join(root, 'hub/src'), { recursive: true });
  await writeFile(join(root, source), 'export function first() { return 1; }\nexport function second() { return 2; }\n');
  for (const [file, started, timestamp, covered] of [[first, 900, 1000, 'first'], [second, 1900, 2000, 'second']] as const) {
    const dir = join(raw, Buffer.from(file).toString('base64url'));
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'owner.json'), JSON.stringify({ pid: 42, started }));
    await writeFile(join(raw, `coverage-42-${timestamp}-0.json`), JSON.stringify({ result: [{ url: pathToFileURL(join(root, source)).href,
      functions: ['first', 'second'].map((functionName, i) => ({ functionName, ranges: [{ startOffset: 7 + i * 37, endOffset: 36 + i * 37, count: functionName === covered ? 1 : 0 }] })) }] }));
  }
  const map = await reduceCoverage(root, raw, { head: 'a'.repeat(40), tree: 'b'.repeat(40), run: 'fixture' }, [second, first]);
  assert.deepEqual(map.files[source]!.functions.map(fn => [fn.name, fn.tests]), [['first', [first]], ['second', [second]]]);
  for (const [file, timestamp] of [[first, 1000], [second, 2000]] as const) {
    assert.ok(await readFile(join(raw, Buffer.from(file).toString('base64url'), `coverage-42-${timestamp}-0.json`)));
  }
});

test('package capture retains real process coverage and a successful exit beside truncated JSON', async t => {
  const root = await tempProject(t, 'cland-coverage-processes-');
  await mkdir(join(root, 'hub/test'), { recursive: true });
  await mkdir(join(root, 'nvim/test'), { recursive: true });
  await mkdir(join(root, '.cland/run'), { recursive: true });
  // Copy the production entries so raw V8 URLs name this fixture's own sources.
  // No fake dispatcher, spoke transport or CLI is introduced by this proof.
  // C1: a previously unknown harness dependency must travel with the carrier.
  // Plant through the source reader, leaving the repository and copy entries alone.
  const planted = 'hub/test/planted-carrier-module.ts';
  const readSource = async (file: string): Promise<string | undefined> => {
    if (file === planted) return "import { writeFileSync } from 'node:fs';\nwriteFileSync(new URL('../../.cland/run/planted.txt', import.meta.url), 'import closure');\n";
    const text = await fixtureSource(repository)(file);
    return file === 'hub/test/harness.ts' ? text + "\nimport './planted-carrier-module.ts';\n" : text;
  };
  // Executable entries launched through URLs/shell wrappers are graph roots;
  // package metadata and the shell wrapper are the only non-import assets.
  const entries = ['hub/test/harness.ts', 'hub/test/cover-quiet.ts', 'hub/bin/cland.ts', 'hub/bin/cland-spoke.ts', 'hub/test/fakes/codex/fake-codex.ts'];
  const assets = ['package.json', 'hub/package.json', 'hub/test/fakes/codex/codex'];
  for (const file of await sourceFixtureFiles(readSource, entries, assets)) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    if (assets.includes(file)) await cp(join(repository, file), join(root, file));
    else await writeFile(join(root, file), (await readSource(file))!);
  }
  const dependencies = dirname(dirname(findPackageJSON('smol-toml', import.meta.url)!));
  await symlink(dependencies, join(root, 'node_modules'), 'dir');
  const file = 'hub/test/processes.test.ts';
  await writeFile(join(root, file), `
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { tempProject, startDaemon, cland, spawnSpoke, FAKE_CODEX_DIR } from './harness.ts';
test('daemon lifecycle and descendant attribution', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  assert.equal(discovery.version, JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')).version);
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
  await writeFile(join(dir, 'coverage-0-truncated.json'), '{"result":[{"url":"'.padEnd(163840, 'x'));
  // Exercise actual receipt I/O failures without depending on a deletion race.
  await symlink(join(dir, 'absent'), join(dir, 'coverage-0-missing.json'));
  await writeFile(join(dir, '..', 'coverage-0-unclaimable.json'), '{"result":[]}');
  const blocked = 'coverage-' + process.pid + '-' + Date.now() + '-999.json';
  await writeFile(join(dir, '..', blocked), '{"result":[]}');
  await mkdir(join(dir, blocked));
  await writeFile(${JSON.stringify(join(root, '.cland/run/contributors.json'))}, JSON.stringify(urls.filter(url => url.includes('/hub/'))));
});`);
  const smoke = ['hub/test/tracer.test.ts', 'hub/test/daemon.test.ts', 'nvim/test/client.test.ts', 'nvim/test/sessions.test.ts'];
  for (const path of smoke) await writeFile(join(root, path), "import test from 'node:test'; test('fixture smoke', () => {});\n");
  await writeFile(join(root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: Object.fromEntries([file, ...smoke].map(file => [file, 'T3'])) }));
  const output = join(root, '.cland/run/coverage-map.json');
  const selection = { mode: 'full', files: [], reason: 'integrated fixture capture', recordCoverage: { head: 'a'.repeat(40), tree: 'b'.repeat(40), run: 'fixture' } };
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  const code = `import { runPackageSuite } from ${JSON.stringify(runner)}; process.exitCode = await runPackageSuite('auto', [], { cwd: ${JSON.stringify(root)}, lockDirs: ${JSON.stringify({ hub: join(root, 'hub.lock'), nvim: join(root, 'nvim.lock') })} });`;
  const env = { ...process.env, NODE_TEST_CONTEXT: '', CLAND_SUITE_SELECTION: JSON.stringify(selection), CLAND_COVERAGE_OUTPUT: output };
  const result = await exec(process.execPath, ['--input-type=module', '-e', code], { cwd: root, env, maxBuffer: 8 * 1024 * 1024 }).catch(error => { throw new Error(`fixture package failed\n${error.stdout}\n${error.stderr}`); });
  assert.match(result.stdout, /suite coverage map/);
  assert.equal(await readFile(join(root, '.cland/run/planted.txt'), 'utf8'), 'import closure', 'the planted harness dependency executes inside the coverage carrier');
  assert.match(result.stderr, /suite coverage: skipping .*coverage-0-truncated\.json \(163840 bytes\): invalid JSON/);
  assert.match(result.stderr, /suite coverage: skipping .*coverage-0-missing\.json: Error: ENOENT/);
  assert.match(result.stderr, /suite coverage: skipping .*coverage-0-unclaimable\.json: unclaimable receipt/);
  assert.match(result.stderr, /suite coverage: skipping .*coverage-\d+-\d+-999\.json: Error:/);
  const map = JSON.parse(await readFile(output, 'utf8'));
  for (const path of ['hub/src/cli/hub.ts', 'hub/src/hub/daemon.ts', 'hub/src/spoke/spoke.ts']) {
    assert.ok(map.files[path]?.functions.some((fn: { tests: string[] }) => fn.tests.includes(file)), `${path} attributed to ${file}`);
    assert.ok(!map.files[path].functions.some((fn: { tests: string[] }) => fn.tests.includes('hub/test/tracer.test.ts')), 'import-only smoke cannot claim descendants');
  }
});
