import { serializeTierManifest } from '../src/suite-shards.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseSuiteMode, importSpecifiers, nvimHubImports, selectPackageSuite } from '../src/suite-selection.ts';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ownDirectory } from './process-cleanup.ts';

test('hub implementation changes select hub plus Neovim smoke', () => {
  assert.equal(chooseSuiteMode(['hub/src/adapters/codex.ts', 'hub/test/tracker.test.ts']), 'hub-only');
});

test('Neovim implementation changes select Neovim plus hub smoke', () => {
  assert.equal(chooseSuiteMode(['nvim/lua/cland/thread.lua', 'nvim/test/thread.test.ts']), 'nvim-only');
});

for (const path of ['hub/src/protocol.ts', 'hub/src/hub/store.ts', 'hub/test/run-suite.ts', 'hub/test/load-gate.ts', 'hub/test/load-gate-reporter.ts', 'hub/test/harness.ts', 'hub/test/process-cleanup.ts', 'hub/src/suite-selection.ts', 'hub/src/suite-shards.ts', 'hub/package.json', 'hub/tsconfig.json', 'nvim/tsconfig.json', 'hub/src/cli/role.ts', 'hub/src/cli/roles.ts', 'hub/src/tracker/tracker.ts', 'hub/src/hub/visibility.ts']) {
  test(`${path} is shared infrastructure and forces full`, () => assert.equal(chooseSuiteMode([path]), 'full'));
}

for (const [name, paths] of [
  ['empty diff', []],
  ['both packages', ['hub/src/tracker/tracker.ts', 'nvim/lua/cland/thread.lua']],
  ['nvim and docs', ['nvim/README.md', 'README.md']],
  ['root tooling', ['package.json', 'package-lock.json', 'tsconfig.json']],
  ['path traversal', ['hub/src/tracker/../../protocol.ts']],
  ['dot segment', ['nvim/./init.lua']],
  ['crew CLI', ['hub/src/cli/crew.ts']],
  ['adapter event contract', ['hub/src/adapters/contract.ts']],
  ['Neovim transport', ['nvim/lua/cland/hub.lua']],
  ['Neovim event state', ['nvim/lua/cland/state.lua']],
] as const) {
  test(`${name} runs full`, () => assert.equal(chooseSuiteMode(paths), 'full'));
}

for (const path of ['hub/test/tiers.json', 'hub/test/shards.json', 'hub/src/hub/core.ts', 'hub/src/hub/dispatch.ts', 'hub/src/hub/server.ts', 'hub/src/subscriptions.ts', 'hub/src/roles.ts', 'hub/src/crew.ts', 'hub/src/spoke/server.ts', 'hub/src/hub/suites.ts', '.cland/tasks/T-214.md', '.cland/roles.toml', '.cland/crew.toml', 'scripts/check.sh', 'hub/src/new-event.ts', 'docs/agents/tests.md', 'skills/qa/SKILL.md', '.agents/skills/qa/SKILL.md', 'README.md']) {
  test(`${path} selects hub-only by the non-nvim rule`, () => assert.equal(chooseSuiteMode([path]), 'hub-only'));
}

for (const path of ['nvim/test/harness.ts', 'nvim/test/stub-hub.ts', 'nvim/test/rpc.ts', 'nvim/README.md', 'nvim/new-file']) {
  test(`${path} selects nvim-only by the nvim rule`, () => assert.equal(chooseSuiteMode([path]), 'nvim-only'));
}

test('import parser reads static, type, side-effect and literal dynamic imports, ignoring comments and strings', () => {
  assert.deepEqual(importSpecifiers(`
    // import { fake } from '../../hub/comment.ts';
    /* import '../../hub/block.ts'; */
    const example = "import '../../hub/string.ts'";
    import { real } from '../../hub/static.ts';
    import type { Type } from '../../hub/type.ts';
    import '../../hub/side-effect.ts';
    const lazy = await import('../../hub/dynamic.ts');
    import.meta.url;
  `), ['../../hub/static.ts', '../../hub/type.ts', '../../hub/side-effect.ts', '../../hub/dynamic.ts']);
});

test('dependency parser reads literal template imports and helper re-exports', () => {
  assert.deepEqual(importSpecifiers([
    'const lazy = import(`../../hub/src/template.ts`);',
    "export { X } from '../../hub/src/named.ts';",
    "export * from '../../hub/src/star.ts';",
    "export type { X } from '../../hub/src/type.ts';",
  ].join('\n')), ['../../hub/src/template.ts', '../../hub/src/named.ts', '../../hub/src/star.ts', '../../hub/src/type.ts']);
  assert.throws(() => importSpecifiers('import(`../../hub/src/${name}.ts`)'), /interpolated dynamic import/);
});

const exec = promisify(execFile);
async function gitFixture(t: import('node:test').TestContext) {
  const dir = await mkdtemp(join(tmpdir(), 'cland-suite-diff-'));
  ownDirectory(t, dir);
  const root = join(dir, 'work');
  const remote = join(dir, 'origin.git');
  await mkdir(root);
  const git = async (...args: string[]) => (await exec('git', args, { cwd: root })).stdout.trim();
  await git('init', '--initial-branch=dev');
  await git('config', 'user.name', 'Suite test');
  await git('config', 'user.email', 'suite@example.invalid');
  await writeFile(join(root, 'README.md'), 'base');
  await git('add', '.'); await git('commit', '-m', 'base');
  await git('init', '--bare', remote); await git('remote', 'add', 'origin', remote);
  await git('push', 'origin', 'dev');
  await git('checkout', '-b', 't/T-214');
  return { root, git };
}

async function coverageFixture(t: import('node:test').TestContext, prefix = '') {
  const { root, git } = await gitFixture(t);
  const source = prefix + 'export function first() {\n  return 1;\n}\nexport function second() {\n  return 2;\n}\n';
  const shift = prefix.split('\n').length - 1;
  await mkdir(join(root, 'hub/src/hub'), { recursive: true });
  await mkdir(join(root, 'hub/test'), { recursive: true });
  await mkdir(join(root, '.cland/run/coverage-maps'), { recursive: true });
  await writeFile(join(root, '.gitignore'), '.cland/\n');
  await writeFile(join(root, 'hub/src/hub/example.ts'), source);
  for (const file of ['first', 'second', 'changed']) await writeFile(join(root, `hub/test/${file}.test.ts`), '// test\n');
  await git('add', '.'); await git('commit', '-m', 'covered baseline'); await git('push', 'origin', 'HEAD:dev');
  const head = await git('rev-parse', 'HEAD');
  const map = { version: 1, head, tree: await git('rev-parse', 'HEAD^{tree}'), created: new Date(Date.now() - 1000).toISOString(),
    testFiles: ['hub/test/first.test.ts', 'hub/test/second.test.ts', 'hub/test/changed.test.ts'],
    files: { 'hub/src/hub/example.ts': { functions: [
      { name: 'first', start: prefix.length, end: prefix.length + 38, startLine: 1 + shift, endLine: 3 + shift, tests: ['hub/test/first.test.ts'] },
      { name: 'second', start: prefix.length + 39, end: source.length, startLine: 4 + shift, endLine: 6 + shift, tests: ['hub/test/second.test.ts'] },
    ] } } };
  const path = join(root, '.cland/run/map.json');
  await writeFile(path, JSON.stringify(map));
  await writeFile(join(root, '.cland/run/coverage-maps/fixture.json'), JSON.stringify({ artifact: 'A-fixture', path }));
  return { root, git, source, map, save: () => writeFile(path, JSON.stringify(map)) };
}

test('coverage selects the changed function and changed tests with both smoke baselines', async t => {
  const { root, source } = await coverageFixture(t);
  await writeFile(join(root, 'hub/src/hub/example.ts'), source.replace('return 2', 'return 3'));
  await writeFile(join(root, 'hub/test/changed.test.ts'), '// changed test\n');
  const selected = await selectPackageSuite(root);
  assert.equal(selected.mode, 'hub-selected');
  assert.deepEqual(selected.tests, ['hub/test/changed.test.ts', 'hub/test/daemon.test.ts', 'hub/test/second.test.ts', 'hub/test/startup-smoke.test.ts', 'hub/test/tracer.test.ts']);
  assert.match(selected.reason, /coverage/);
  assert.match(JSON.stringify(selected), /second/);
  assert.doesNotMatch(JSON.stringify(selected.tests), /first.test/);
});

test('fetched dev selects committed and working changes, all forces full, and integrated dev stays full', async t => {
  const { root, git } = await gitFixture(t);
  await mkdir(join(root, 'hub', 'src', 'tracker'), { recursive: true });
  await writeFile(join(root, 'hub', 'src', 'tracker', 'tracker.ts'), '// local');
  await git('add', '.'); await git('commit', '-m', 'hub local');
  const selected = await selectPackageSuite(root);
  assert.equal(selected.mode, 'hub-only');
  assert.equal(selected.loadGate, true);
  assert.deepEqual(selected.files, ['hub/src/tracker/tracker.ts']);
  const fullTask = await selectPackageSuite(root, 'all');
  assert.equal(fullTask.mode, 'full');
  assert.equal(fullTask.loadGate, true);
  await mkdir(join(root, 'nvim', 'lua'), { recursive: true });
  await writeFile(join(root, 'nvim', 'lua', 'thread.lua'), '-- dirty');
  assert.equal((await selectPackageSuite(root)).mode, 'full', 'untracked Neovim code makes the diff mixed');
  await git('checkout', 'dev');
  const integrated = await selectPackageSuite(root);
  assert.match(integrated.reason, /integrated dev/);
  assert.equal(integrated.loadGate, undefined);
});

for (const [form, source] of [
  ['a static hub import', "import type { New } from '../../../hub/src/new-shared.ts';"],
  ['a literal template hub import', 'const lazy = import(`../../../hub/src/new-shared.ts`);'],
] as const) {
test(`adding ${form} in a nested Neovim test widens selection at admission`, async t => {
  const { root, git } = await gitFixture(t);
  await mkdir(join(root, 'nvim/test/nested'), { recursive: true });
  const testFile = join(root, 'nvim/test/nested/new.test.ts');
  await writeFile(testFile, '// no shared imports');
  await git('add', '.'); await git('commit', '-m', 'Neovim baseline'); await git('push', 'origin', 'HEAD:dev');
  await mkdir(join(root, 'hub/src'), { recursive: true });
  await writeFile(join(root, 'hub/src/new-shared.ts'), '// change');
  assert.equal((await selectPackageSuite(root)).mode, 'hub-only');
  await writeFile(testFile, source);
  const imports = await nvimHubImports(root);
  assert.deepEqual(imports, ['hub/src/new-shared.ts']);
  assert.equal(chooseSuiteMode(['hub/src/new-shared.ts'], imports), 'full');
  await git('add', 'nvim'); await git('commit', '-m', 'New shared import'); await git('push', 'origin', 'HEAD:dev');
  const selection = await selectPackageSuite(root);
  assert.deepEqual(selection.files, ['hub/src/new-shared.ts']);
  assert.equal(selection.mode, 'full');
  assert.match(selection.reason, /^nvim test import hub\/src\/new-shared.ts; coverage map missing$/);
});

}

for (const [form, source] of [
  ['import', "import '../../hub/src/shared.ts';"],
  ['named re-export', "export { X } from '../../hub/src/shared.ts';"],
  ['star re-export', "export * from '../../hub/src/shared.ts';"],
] as const) {
test(`helper ${form} widens full selection, handles cycles and stops at the hub boundary`, async t => {
  const { root, git } = await gitFixture(t);
  await mkdir(join(root, 'nvim/test/nested'), { recursive: true });
  await mkdir(join(root, 'hub/src'), { recursive: true });
  await writeFile(join(root, 'nvim/test/nested/new.test.ts'), "import { helper } from '../helper.ts';");
  await writeFile(join(root, 'nvim/test/helper.ts'), "import './nested/new.test.ts';");
  await writeFile(join(root, 'hub/src/shared.ts'), "import './internal.ts';");
  await git('add', '.'); await git('commit', '-m', 'helper baseline'); await git('push', 'origin', 'HEAD:dev');
  await writeFile(join(root, 'hub/src/shared.ts'), "import './internal.ts'; // changed");
  assert.equal((await selectPackageSuite(root)).mode, 'hub-only');
  await writeFile(join(root, 'nvim/test/helper.ts'), "import './nested/new.test.ts'; " + source);
  await git('add', 'nvim'); await git('commit', '-m', 'helper imports shared hub source'); await git('push', 'origin', 'HEAD:dev');
  const imports = await nvimHubImports(root);
  assert.deepEqual(imports, ['hub/src/shared.ts']);
  assert.equal(chooseSuiteMode(['hub/src/internal.ts'], imports), 'hub-only');
  const selection = await selectPackageSuite(root);
  assert.equal(selection.mode, 'full');
  assert.match(selection.reason, /^nvim test import hub\/src\/shared.ts; coverage map missing$/);
});

}

test('interpolated dynamic imports fail closed to full admission', async t => {
  const { root, git } = await gitFixture(t);
  await mkdir(join(root, 'nvim/test'), { recursive: true });
  await writeFile(join(root, 'nvim/test/new.test.ts'), 'import(`../../hub/src/${name}.ts`);');
  await git('add', '.'); await git('commit', '-m', 'unresolved shared dependency'); await git('push', 'origin', 'HEAD:dev');
  await writeFile(join(root, 'README.md'), 'changed');
  const selection = await selectPackageSuite(root);
  assert.equal(selection.mode, 'full');
  assert.match(selection.reason, /interpolated dynamic import cannot be resolved safely/);
});

test('empty diffs and failed fetches run full with their reason, never using a stale dev ref', async t => {
  const { root, git } = await gitFixture(t);
  assert.match((await selectPackageSuite(root)).reason, /empty diff/);
  await git('remote', 'set-url', 'origin', join(root, 'missing.git'));
  const selected = await selectPackageSuite(root);
  assert.equal(selected.mode, 'full');
  assert.match(selected.reason, /fetch\/diff unavailable/);
  assert.equal(selected.loadGate, true, 'failed fetch does not bypass the task load gate');
});

for (const mode of ['hub-only', 'nvim-only'] as const) {
test(`${mode} admission retains both locks through smoke, omits the other package's remaining tests, and all widens the run`, async t => {
  const { root, git } = await gitFixture(t);
  const journal = join(root, 'journal.jsonl');
  const locks = { hub: join(root, 'machine.lock'), nvim: join(root, 'nvim.lock') };
  const files = ['hub/test/local.test.ts', 'hub/test/tracer.test.ts', 'hub/test/daemon.test.ts', 'hub/test/startup-smoke.test.ts', 'nvim/test/client.test.ts', 'nvim/test/sessions.test.ts', 'nvim/test/other.test.ts'];
  for (const path of files) {
    await mkdir(join(root, path, '..'), { recursive: true });
    await writeFile(join(root, path), `import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync, appendFileSync, existsSync } from 'node:fs'; test('phase', () => {
      if (process.env.CLAND_TEST_SKIP_LOCK !== '1') for (const lock of ${JSON.stringify(Object.values(locks))}) assert.ok(existsSync(lock), 'both locks held');
      const owner = existsSync(${JSON.stringify(locks.hub + '.owner')}) ? JSON.parse(readFileSync(${JSON.stringify(locks.hub + '.owner')}, 'utf8')) : { token: 'unlocked fixture' };
      appendFileSync(${JSON.stringify(journal)}, JSON.stringify({ file: ${JSON.stringify(path)}, token: owner.token }) + '\\n');
    });`);
  }
  await writeFile(join(root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: Object.fromEntries(files.map(path => [path, 'T3'])) }));
  await writeFile(join(root, '.gitignore'), 'journal.jsonl\n*.lock*\n');
  await git('checkout', 'dev'); await git('add', '.'); await git('commit', '-m', 'fixture tests'); await git('push', 'origin', 'dev');
  await git('checkout', 't/T-214'); await git('merge', 'dev');
  const changed = mode === 'hub-only' ? 'hub/src/tracker/tracker.ts' : 'nvim/lua/cland/thread.lua';
  await mkdir(join(root, changed, '..'), { recursive: true });
  await writeFile(join(root, changed), '// changed');
  await git('add', '.'); await git('commit', '-m', 'local hub change');
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_TEST_CONTEXT: '', CLAND_TEST_SKIP_LOCK: '0' };
  delete env.CLAND_SUITE_SELECTION;
  const code = `import { runPackageSuite } from ${JSON.stringify(runner)}; process.exitCode = await runPackageSuite('auto', [], ${JSON.stringify({ cwd: root, lockDirs: locks })});`;
  const reduced = await exec(process.execPath, ['--input-type=module', '-e', code], { env });
  const rows = (await readFile(journal, 'utf8')).trim().split('\n').map(line => JSON.parse(line) as { file: string; token: string });
  assert.deepEqual(rows.map(row => row.file).sort(), mode === 'hub-only' ? ['hub/test/daemon.test.ts', 'hub/test/local.test.ts', 'hub/test/startup-smoke.test.ts', 'hub/test/tracer.test.ts', 'nvim/test/client.test.ts', 'nvim/test/sessions.test.ts'] : ['hub/test/daemon.test.ts', 'hub/test/startup-smoke.test.ts', 'hub/test/tracer.test.ts', 'nvim/test/client.test.ts', 'nvim/test/other.test.ts', 'nvim/test/sessions.test.ts']);
  assert.equal(new Set(rows.map(row => row.token)).size, 1, 'one admission spans hub and smoke');
  assert.ok(reduced.stderr.split('\n').some(line => line.startsWith('suite duration ') && line.includes(`mode ${mode}`) && line.includes(changed)), reduced.stderr);
  assert.ok(reduced.stderr.includes(`suite phase ${mode === 'hub-only' ? 'Neovim smoke' : 'hub machine smoke'}; locks held`), reduced.stderr);
  // Both force-full CLI spellings override targets and transported selections.
  for (const force of ['--all', 'all']) {
    await writeFile(journal, '');
    const full = await exec(process.execPath, [runner, force, 'hub/test/tracer.test.ts'], { cwd: root, env: { ...env, CLAND_TEST_SKIP_LOCK: '1', CLAND_SUITE_SELECTION: JSON.stringify({ mode, files: [changed], reason: 'transported decision' }) } });
    assert.match(full.stderr, /mode full/);
    assert.match(await readFile(journal, 'utf8'), /nvim\/test\/other.test.ts/);
    assert.match(await readFile(journal, 'utf8'), /hub\/test\/local.test.ts/);
  }
});
}


for (const [name, path, reason] of [
  ['protocol', 'hub/src/protocol.ts', /shared contract/],
  ['contract', 'hub/src/adapters/contract.ts', /shared contract/],
  ['package', 'hub/package.json', /package configuration/],
  ['harness', 'hub/test/harness.ts', /nvim test import|coverage unsupported path/],
  ['fixture', 'hub/test/new-fixture.ts', /coverage unsupported path/],
  ['runner', 'hub/test/run-suite.ts', /suite infrastructure/],
  ['executor', 'hub/src/executor/new.ts', /coverage shared infrastructure/],
  ['unknown', 'hub/src/new.ts', /coverage source absent from map/],
] as const) {
  test(`coverage falls back for ${name} changes and names the cause`, async t => {
    const { root } = await coverageFixture(t);
    await mkdir(join(root, path, '..'), { recursive: true });
    await writeFile(join(root, path), '// new shared or unknown code');
    const selection = await selectPackageSuite(root);
    assert.notEqual(selection.mode, 'hub-selected');
    assert.match(selection.reason, reason);
  });
}

for (const [name, change, reason] of [
  ['stale', (map: Awaited<ReturnType<typeof coverageFixture>>['map']) => { map.created = new Date(Date.now() - 172800001).toISOString(); }, /coverage map stale/],
  ['future timestamp', (map: Awaited<ReturnType<typeof coverageFixture>>['map']) => { map.created = new Date(Date.now() + 60000).toISOString(); }, /coverage map stale/],
  ['unrelated head', (map: Awaited<ReturnType<typeof coverageFixture>>['map']) => { map.head = 'f'.repeat(40); }, /coverage map has no ancestor/],
  ['invalid map', (map: Awaited<ReturnType<typeof coverageFixture>>['map']) => { map.files['hub/src/hub/example.ts']!.functions[0]!.startLine = -1; }, /coverage map missing/],
] as const) {
  test(`${name} maps fall back conservatively`, async t => {
    const { root, map, source, save } = await coverageFixture(t);
    change(map); await save();
    await writeFile(join(root, 'hub/src/hub/example.ts'), source.replace('return 2', 'return 3'));
    const selection = await selectPackageSuite(root);
    assert.equal(selection.mode, 'hub-only'); assert.match(selection.reason, reason);
  });
}

test('coverage age configuration narrows the validity window', async t => {
  const { root, map, source, save } = await coverageFixture(t);
  map.created = new Date(Date.now() - 60000).toISOString(); await save();
  await writeFile(join(root, '.cland/config.toml'), '[verification]\ncoverage_max_age = "30s"\n');
  await writeFile(join(root, 'hub/src/hub/example.ts'), source.replace('return 2', 'return 3'));
  assert.match((await selectPackageSuite(root)).reason, /coverage map stale.*limit 30s/);
});

test('coverage config parsing uses the owning environment without changing the host', async t => {
  const { root, source } = await coverageFixture(t);
  const hostMargin = process.env.CLAND_TEST_EXECUTOR_MARGIN_MS;
  await writeFile(join(root, '.cland/config.toml'), '[verification]\nlifetime = "3m"\nrun_timeout = "1m"\n');
  await writeFile(join(root, 'hub/src/hub/example.ts'), source.replace('return 2', 'return 3'));
  const selection = await selectPackageSuite(root, 'auto', { ...process.env, CLAND_TEST_EXECUTOR_MARGIN_MS: '1000' });
  assert.equal(selection.mode, 'hub-selected', selection.reason);
  assert.equal(process.env.CLAND_TEST_EXECUTOR_MARGIN_MS, hostMargin);
});

test('coverage translates function hunks across unrelated insertions and deletions since its head', async t => {
  const { root, git, source } = await coverageFixture(t);
  const moved = '// inserted on dev\n// another insertion\n' + source;
  await writeFile(join(root, 'hub/src/hub/example.ts'), moved);
  await git('add', '.'); await git('commit', '-m', 'move source on dev'); await git('push', 'origin', 'HEAD:dev');
  await writeFile(join(root, 'hub/src/hub/example.ts'), moved.replace('return 2', 'return 5'));
  const inserted = await selectPackageSuite(root);
  assert.equal(inserted.mode, 'hub-selected');
  assert.ok(inserted.tests!.includes('hub/test/second.test.ts'));
  assert.ok(!inserted.tests!.includes('hub/test/first.test.ts'));
  await writeFile(join(root, 'hub/src/hub/example.ts'), source);
  await git('add', '.'); await git('commit', '-m', 'delete preceding comments'); await git('push', 'origin', 'HEAD:dev');
  await writeFile(join(root, 'hub/src/hub/example.ts'), source.replace('return 1', 'return 6'));
  const deleted = await selectPackageSuite(root);
  assert.equal(deleted.mode, 'hub-selected');
  assert.ok(deleted.tests!.includes('hub/test/first.test.ts'));
});

test('coverage widens for top-level edits, new top-level functions, untested functions and intervening edits', async t => {
  const { root, git, map, source, save } = await coverageFixture(t);
  await writeFile(join(root, 'hub/src/hub/example.ts'), '// top level\n' + source);
  assert.match((await selectPackageSuite(root)).reason, /coverage top-level|coverage function untested/);
  await writeFile(join(root, 'hub/src/hub/example.ts'), source + 'export function newFunction() { return 3; }\n');
  assert.notEqual((await selectPackageSuite(root)).mode, 'hub-selected');
  map.files['hub/src/hub/example.ts']!.functions[1]!.tests = []; await save();
  await writeFile(join(root, 'hub/src/hub/example.ts'), source.replace('return 2', 'return 3'));
  assert.match((await selectPackageSuite(root)).reason, /coverage function untested/);
  map.files['hub/src/hub/example.ts']!.functions[1]!.tests = ['hub/test/second.test.ts']; await save();
  await git('add', '.'); await git('commit', '-m', 'intervening function edit'); await git('push', 'origin', 'HEAD:dev');
  await writeFile(join(root, 'hub/src/hub/example.ts'), source.replace('return 2', 'return 4'));
  assert.match((await selectPackageSuite(root)).reason, /coverage hunk changed since map/);
});

test('coverage ignores newer unrelated maps and retains the package Neovim phase', async t => {
  const { root, git, source, map } = await coverageFixture(t);
  const path = join(root, '.cland/run/unrelated.json');
  await writeFile(path, JSON.stringify({ ...map, head: 'f'.repeat(40), created: new Date(Date.now() + 1000).toISOString() }));
  await writeFile(join(root, '.cland/run/coverage-maps/unrelated.json'), JSON.stringify({ artifact: 'A-unrelated', path }));
  await mkdir(join(root, 'nvim/test'), { recursive: true });
  await writeFile(join(root, 'nvim/test/example.test.ts'), "import { first } from '../../hub/src/hub/example.ts';\n");
  await git('add', '.'); await git('commit', '-m', 'shared Neovim dependency'); await git('push', 'origin', 'HEAD:dev');
  await writeFile(join(root, 'hub/src/hub/example.ts'), source.replace('return 2', 'return 5'));
  const selected = await selectPackageSuite(root);
  assert.equal(selected.mode, 'hub-selected');
  assert.equal(selected.coverage?.artifact, 'A-fixture');
  assert.equal(selected.nvimFull, true);
  assert.ok(selected.tests!.includes('hub/test/second.test.ts'));
});

test('coverage maps a function after earlier source lines were deleted on dev', async t => {
  const { root, git, source } = await coverageFixture(t, '// old header\n');
  const moved = source.replace('// old header\n', '');
  await writeFile(join(root, 'hub/src/hub/example.ts'), moved);
  await git('add', '.'); await git('commit', '-m', 'remove header'); await git('push', 'origin', 'HEAD:dev');
  await writeFile(join(root, 'hub/src/hub/example.ts'), moved.replace('return 1', 'return 5'));
  const selected = await selectPackageSuite(root);
  assert.equal(selected.mode, 'hub-selected');
  assert.ok(selected.tests!.includes('hub/test/first.test.ts'));
  assert.ok(!selected.tests!.includes('hub/test/second.test.ts'));
});

test('a missing map explicitly falls back to the package rule', async t => {
  const { root } = await gitFixture(t);
  await mkdir(join(root, 'hub/src/hub'), { recursive: true });
  await writeFile(join(root, 'hub/src/hub/unknown.ts'), 'export function changed() {}');
  const selection = await selectPackageSuite(root);
  assert.equal(selection.mode, 'hub-only');
  assert.match(selection.reason, /coverage map missing/);
});

test('hub-selected executes covering tests and both smoke baselines, omitting unrelated tests', async t => {
  const { root, git, source } = await coverageFixture(t);
  const journal = join(root, '.cland/run/executed');
  const hub = ['first', 'second', 'changed', 'daemon', 'tracer', 'startup-smoke'].map(name => `hub/test/${name}.test.ts`);
  const nvim = ['client', 'sessions', 'other'].map(name => `nvim/test/${name}.test.ts`);
  await mkdir(join(root, 'nvim/test'), { recursive: true });
  for (const file of [...hub, ...nvim]) await writeFile(join(root, file), `import test from 'node:test'; import { appendFileSync } from 'node:fs'; test('execution marker', () => appendFileSync(${JSON.stringify(journal)}, ${JSON.stringify(file + '\n')}));\n`);
  await writeFile(join(root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: Object.fromEntries([...hub, ...nvim].map(file => [file, 'T3'])) }));
  await git('add', '.'); await git('commit', '-m', 'executable baselines'); await git('push', 'origin', 'HEAD:dev');
  await writeFile(join(root, 'hub/src/hub/example.ts'), source.replace('return 2', 'return 3'));
  const selection = await selectPackageSuite(root);
  assert.equal(selection.mode, 'hub-selected');
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  const code = `import { runPackageSuite } from ${JSON.stringify(runner)}; process.exitCode = await runPackageSuite('auto', [], ${JSON.stringify({ cwd: root, lockDirs: { hub: join(root, '.cland/run/hub.lock'), nvim: join(root, '.cland/run/nvim.lock') } })});`;
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_TEST_CONTEXT: '', CLAND_SUITE_SELECTION: JSON.stringify(selection) };
  delete env.CLAND_SUITE_LEASE;
  const result = await exec(process.execPath, ['--input-type=module', '-e', code], { cwd: root, env });
  assert.deepEqual((await readFile(journal, 'utf8')).trim().split('\n').sort(), ['hub/test/daemon.test.ts', 'hub/test/second.test.ts', 'hub/test/startup-smoke.test.ts', 'hub/test/tracer.test.ts', 'nvim/test/client.test.ts', 'nvim/test/sessions.test.ts']);
  assert.match(result.stderr, /suite phase Neovim smoke/);
  const duration = result.stderr.split('\n').find(line => line.startsWith('suite duration '));
  assert.match(duration ?? '', /mode hub-selected.*deciding functions.*second/);
  console.log(`one-function fixture: ${duration}`);
});

test('coverage replay includes own tests, reports time share and failures, and names missing-map fallback', async t => {
  const { root, git, source } = await coverageFixture(t);
  await writeFile(join(root, 'hub/test/durations.json'), JSON.stringify({ version: 1, source: { commit: 'fixture', artifacts: [] }, budget: { testSeconds: 5, fileSeconds: 60 }, tests: {}, allow: {}, files: Object.fromEntries([
    ['hub/test/first.test.ts', { seconds: 30, tests: 1 }], ['hub/test/second.test.ts', { seconds: 10, tests: 1 }], ['hub/test/changed.test.ts', { seconds: 2, tests: 1 }], ['hub/test/daemon.test.ts', { seconds: 1, tests: 1 }], ['hub/test/tracer.test.ts', { seconds: 1, tests: 1 }], ['hub/test/startup-smoke.test.ts', { seconds: 0, tests: 1 }],
  ]) }));
  await git('add', '.'); await git('commit', '-m', 'timing baseline'); await git('push', 'origin', 'HEAD:dev');
  const base = await git('rev-parse', 'HEAD');
  await writeFile(join(root, 'hub/src/hub/example.ts'), source.replace('return 2', 'return 3'));
  await writeFile(join(root, 'hub/test/changed.test.ts'), '// added assertion\n');
  await git('add', '.'); await git('commit', '-m', 'Changed function (T-1)');
  const head = await git('rev-parse', 'HEAD');
  const replay = fileURLToPath(new URL('./selection-replay.ts', import.meta.url));
  const args = [replay, `${base}..${head}`, '--coverage', '--count', '1'];
  const covered = await exec(process.execPath, args, { cwd: root });
  assert.match(covered.stdout, /hub-selected/);
  assert.match(covered.stdout, /31.8%/);
  assert.match(covered.stdout, /second/);
  assert.match(covered.stdout, /0 misses/);
  await mkdir(join(root, '.cland/run/suites/old-run'), { recursive: true });
  await writeFile(join(root, '.cland/run/suites/old-run/suite.log'), 'Branch t/T-1-example\n✖ historical failure (1ms)\nsuite timing {"file":"hub/test/first.test.ts","name":"historical failure","seconds":0.001}\n');
  await assert.rejects(exec(process.execPath, args, { cwd: root }), error => {
    const failed = error as { stdout: string; code: number };
    assert.equal(failed.code, 1); assert.match(failed.stdout, /1 retained run logs/); assert.match(failed.stdout, /hub\/test\/first.test.ts/);
    return true;
  });
  const failures = join(root, '.cland/run/failures.json');
  await writeFile(failures, JSON.stringify({ [head]: ['hub/test/first.test.ts'] }));
  await assert.rejects(exec(process.execPath, [...args, '--failures', failures], { cwd: root }), error => {
    const failed = error as { stdout: string; code: number };
    assert.equal(failed.code, 1); assert.match(failed.stdout, /hub\/test\/first.test.ts/); assert.match(failed.stdout, /1 misses/);
    return true;
  });
  await rm(join(root, '.cland/run/suites/old-run'), { recursive: true });
  await writeFile(failures, JSON.stringify({ [head]: ['nvim/test/sessions.test.ts'] }));
  assert.match((await exec(process.execPath, [...args, '--failures', failures], { cwd: root })).stdout, /0 own misses; 0 historical misses/);
  await writeFile(failures, JSON.stringify({ [head]: ['nvim/test/other.test.ts'] }));
  await assert.rejects(exec(process.execPath, [...args, '--failures', failures], { cwd: root }), error => {
    const failed = error as { stdout: string; code: number };
    assert.equal(failed.code, 1); assert.match(failed.stdout, /0 own misses; 1 historical misses/); assert.match(failed.stdout, /outside package Neovim smoke/);
    return true;
  });
  await rm(join(root, '.cland/run/coverage-maps'), { recursive: true });
  const missing = await exec(process.execPath, args, { cwd: root });
  assert.match(missing.stdout, /coverage map missing/);
  assert.match(missing.stdout, /100.0%/);
  assert.match(missing.stdout, /0 misses/);
});
