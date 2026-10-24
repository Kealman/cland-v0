// T3: package-runner admission and CLI subprocess contracts; pure selection cases are T1.
import { fixtureEnvironment, runnerFixtureEnvironment } from './fixture-environment.ts';
import { packageShards, serializeTierManifest } from '../src/suite-shards.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { sameSuiteSelection, taskSuiteSelection, chooseSuiteMode, importSpecifiers, nvimHubImports, nvimHubImporters, HUB_SMOKE, NVIM_SMOKE, suitePhases, selectPackageSuite } from '../src/suite-selection.ts';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { glob, mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ownDirectory } from './process-cleanup.ts';

test('hub implementation changes select hub plus Neovim smoke', () => {
  assert.equal(chooseSuiteMode(['hub/src/adapters/codex.ts', 'hub/test/tracker.test.ts']), 'hub-only');
  assert.ok(suitePhases('hub-only').find(phase => phase.name === 'Neovim smoke')!.targets.includes('nvim/test/startup-budget.test.ts'), 'reduced hub runs retain the startup budget');
  assert.equal(chooseSuiteMode(['web/app.ts']), 'web-only', 'web-only diffs retain Neovim smoke');
});

test('Neovim implementation changes select Neovim plus hub smoke', () => {
  assert.equal(chooseSuiteMode(['nvim/lua/cland/thread.lua', 'nvim/test/thread.test.ts']), 'nvim-only');
});

for (const path of ['hub/src/protocol.ts', 'hub/src/hub/store.ts', 'hub/test/run-suite.ts', 'hub/test/load-gate.ts', 'hub/test/load-gate-reporter.ts', 'hub/test/harness.ts', 'hub/test/process-cleanup.ts', 'hub/src/suite-selection.ts', 'hub/src/suite-dev-fetch.ts', 'hub/src/suite-shards.ts', 'hub/package.json', 'hub/tsconfig.json', 'nvim/tsconfig.json', 'hub/src/cli/role.ts', 'hub/src/cli/roles.ts', 'hub/src/tracker/tracker.ts', 'hub/src/hub/visibility.ts']) {
  test(`${path} is shared infrastructure and forces full`, () => assert.equal(chooseSuiteMode([path]), 'full'));
}

for (const [name, paths] of [
  ['shared admission primitives', ['shared/socket-client.ts']],
  ['neutral fixture admission', ['test-support/admission.ts']],
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

test('import parser reads static, side-effect and literal dynamic imports, ignoring comments and strings', () => {
  assert.deepEqual(importSpecifiers(`
    // import { fake } from '../../hub/comment.ts';
    /* import '../../hub/block.ts'; */
    const example = "import '../../hub/string.ts'";
    import { real } from '../../hub/static.ts';
    import type { Type } from '../../hub/type.ts';
    import '../../hub/side-effect.ts';
    const lazy = await import('../../hub/dynamic.ts');
    import.meta.url;
  `), ['../../hub/static.ts', '../../hub/side-effect.ts', '../../hub/dynamic.ts']);
});

test('dependency parser reads literal template imports and helper re-exports', () => {
  assert.deepEqual(importSpecifiers([
    'const lazy = import(`../../hub/src/template.ts`);',
    "export { X } from '../../hub/src/named.ts';",
    "export * from '../../hub/src/star.ts';",
    "export type { X } from '../../hub/src/type.ts';",
  ].join('\n')), ['../../hub/src/template.ts', '../../hub/src/named.ts', '../../hub/src/star.ts']);
  assert.throws(() => importSpecifiers('import(`../../hub/src/${name}.ts`)'), /interpolated dynamic import/);
});

// T1 behavior: type-stripped dependencies never widen runtime selection.
test('type-only declarations are erased while inline type specifiers retain module execution', () => {
  assert.deepEqual(importSpecifiers(`
    import type Default from './default.ts';
    import type * as Types from './namespace.ts';
    export type * from './star-types.ts';
    import { type A, type B as C } from './named-types.ts';
    export { type A, type B as C } from './export-types.ts';
    import { type A, value } from './mixed.ts';
    export { type A, value } from './mixed-export.ts';
    import type from './value-called-type.ts';
    import { type as renamed } from './value-specifier.ts';
    import {} from './empty.ts';
  `), ['./named-types.ts', './export-types.ts', './mixed.ts', './mixed-export.ts', './value-called-type.ts', './value-specifier.ts', './empty.ts']);
});

// T1 behavior through the source dependency graph; no child processes.
test('Neovim type-only imports and helper re-exports do not reach hub sources', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-type-imports-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'nvim/test'), { recursive: true });
  await writeFile(join(root, 'nvim/test/types.test.ts'), "import type { Event } from '../../hub/src/protocol.ts'; import './helper.ts';");
  await writeFile(join(root, 'nvim/test/helper.ts'), "export type { Plan } from '../../hub/src/tracker/plan.ts';");
  assert.deepEqual(await nvimHubImports(root), []);
});

// T1 behavior: helper traversal attributes a dependency to each importing test.
test('Neovim importer graph follows shared helpers through cycles', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-importer-graph-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'nvim/test/nested'), { recursive: true });
  await writeFile(join(root, 'nvim/test/a.test.ts'), "import './helper.ts';");
  await writeFile(join(root, 'nvim/test/nested/b.test.ts'), "import '../helper.ts';");
  await writeFile(join(root, 'nvim/test/other.test.ts'), "import type { Criterion } from '../../hub/src/tracker/criteria.ts';");
  await writeFile(join(root, 'nvim/test/helper.ts'), "export * from './cycle.ts';");
  await writeFile(join(root, 'nvim/test/cycle.ts'), "import './helper.ts'; export { parse } from '../../hub/src/tracker/criteria.ts';");
  assert.deepEqual(await nvimHubImporters(root), { 'hub/src/tracker/criteria.ts': ['nvim/test/a.test.ts', 'nvim/test/nested/b.test.ts'] });
});

// T1 behavior: neutral helpers must not hide runtime hub dependencies.
test('Neovim importer graph follows neutral admission helpers to the hub boundary', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-neutral-imports-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const dir of ['nvim/test', 'test-support', 'shared']) await mkdir(join(root, dir), { recursive: true });
  await writeFile(join(root, 'nvim/test/client.test.ts'), "import '../../test-support/admission.ts';");
  await writeFile(join(root, 'test-support/admission.ts'), "export * from '../shared/request.ts';");
  await writeFile(join(root, 'shared/request.ts'), "import '../test-support/admission.ts'; import '../hub/src/protocol.ts';");
  assert.deepEqual(await nvimHubImports(root), ['hub/src/protocol.ts']);
});

// T1 behavior: cached receipts must represent the same planned test sets.
test('cache selection equivalence includes Neovim subsets even on hub fallback', () => {
  for (const mode of ['hub-selected', 'full'] as const) {
    const smoke = { mode, files: [], reason: 'smoke', tests: [...HUB_SMOKE] };
    const selected = { ...smoke, nvimTests: [...NVIM_SMOKE, 'nvim/test/importer.test.ts'] };
    assert.equal(sameSuiteSelection(smoke, selected), false);
    assert.equal(sameSuiteSelection(selected, smoke), false);
    assert.equal(sameSuiteSelection(selected, { ...selected, reason: 'same files, different explanation' }), true);
    assert.equal(sameSuiteSelection(selected, { ...selected, nvimTests: [...NVIM_SMOKE, 'nvim/test/other.test.ts'] }), false);
  }
  const first = { mode: 'hub-selected' as const, files: [], reason: 'first', tests: ['hub/test/first.test.ts'] };
  assert.equal(sameSuiteSelection(first, { ...first, tests: ['hub/test/second.test.ts'] }), false);
  assert.equal(sameSuiteSelection(first, { ...first, nvimFull: true }), false);
});

const exec = promisify(execFile);
async function gitFixture(t: import('node:test').TestContext) {
  const dir = await mkdtemp(join(tmpdir(), 'cland-suite-diff-'));
  ownDirectory(t, dir);
  const root = join(dir, 'work');
  const remote = join(dir, 'origin.git');
  await mkdir(root);
  const git = async (...args: string[]) => (await exec('git', args, { env: fixtureEnvironment(root, process.env), cwd: root })).stdout.trim();
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

async function coverageFixture(t: import('node:test').TestContext, prefix = '', sourceFile = 'hub/src/hub/example.ts') {
  const { root, git } = await gitFixture(t);
  const source = prefix + 'export function first() {\n  return 1;\n}\nexport function second() {\n  return 2;\n}\n';
  const shift = prefix.split('\n').length - 1;
  await mkdir(join(root, sourceFile, '..'), { recursive: true });
  await mkdir(join(root, 'hub/test'), { recursive: true });
  await mkdir(join(root, '.cland/run/coverage-maps'), { recursive: true });
  await writeFile(join(root, '.gitignore'), '.cland/\n');
  await writeFile(join(root, sourceFile), source);
  for (const file of ['first', 'second', 'changed']) await writeFile(join(root, `hub/test/${file}.test.ts`), '// test\n');
  await git('add', '.'); await git('commit', '-m', 'covered baseline'); await git('push', 'origin', 'HEAD:dev');
  const head = await git('rev-parse', 'HEAD');
  const map = { version: 1, head, tree: await git('rev-parse', 'HEAD^{tree}'), created: new Date(Date.now() - 1000).toISOString(),
    testFiles: ['hub/test/first.test.ts', 'hub/test/second.test.ts', 'hub/test/changed.test.ts'],
    files: { [sourceFile]: { functions: [
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
  assert.deepEqual(selected.tests, ['hub/test/changed.test.ts', 'hub/test/scenarios/hub-lifecycle.test.ts', 'hub/test/scenarios/message-tracer.test.ts', 'hub/test/scenarios/startup-smoke.test.ts', 'hub/test/second.test.ts']);
  assert.match(selected.reason, /coverage/);
  assert.match(JSON.stringify(selected), /second/);
  assert.doesNotMatch(JSON.stringify(selected.tests), /first.test/);
});

async function packageShardsForSelection(root: string, selection: Awaited<ReturnType<typeof selectPackageSuite>>) {
  for (const file of [...HUB_SMOKE, ...NVIM_SMOKE]) { await mkdir(join(root, file, '..'), { recursive: true }); await writeFile(join(root, file), '// smoke'); }
  const paths = [];
  for await (const file of glob(['hub/test/**/*.test.ts', 'nvim/test/**/*.test.ts'], { cwd: root })) paths.push(file);
  await writeFile(join(root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: Object.fromEntries(paths.map(file => [file, [...HUB_SMOKE, ...NVIM_SMOKE].includes(file) ? 'T3' : 'T2'])) }));
  const task = taskSuiteSelection(selection, 't/selection-fixture', 'auto', true);
  return packageShards(root, task.mode, undefined, task, { workers: 1 });
}

test('criteria changes plan only Neovim runtime importers plus smoke and coverage-selected hub tests', async t => {
  const { root, source, git } = await coverageFixture(t, '', 'hub/src/tracker/criteria.ts');
  await mkdir(join(root, 'nvim/test'), { recursive: true });
  await writeFile(join(root, 'nvim/test/direct.test.ts'), "import { first } from '../../hub/src/tracker/criteria.ts';");
  await writeFile(join(root, 'nvim/test/indirect.test.ts'), "import './helper.ts';");
  await writeFile(join(root, 'nvim/test/helper.ts'), "export * from '../../hub/src/tracker/criteria.ts';");
  await writeFile(join(root, 'nvim/test/types.test.ts'), "import type { Criterion } from '../../hub/src/tracker/criteria.ts';");
  await git('add', '.'); await git('commit', '-m', 'importers'); await git('push', 'origin', 'HEAD:dev');
  await writeFile(join(root, 'hub/src/tracker/criteria.ts'), source.replace('return 2', 'return 4'));
  const selection = await selectPackageSuite(root);
  assert.equal(selection.mode, 'hub-selected');
  assert.deepEqual(selection.tests, ['hub/test/second.test.ts', ...HUB_SMOKE].sort());
  assert.deepEqual(selection.nvimTests, [...NVIM_SMOKE, 'nvim/test/direct.test.ts', 'nvim/test/indirect.test.ts'].sort());
  assert.match(selection.reason, /Neovim importers/);
  const phases = await packageShardsForSelection(root, selection);
  assert.deepEqual(phases.at(-1)?.targets, ['nvim/test/direct.test.ts', 'nvim/test/indirect.test.ts']);
  await mkdir(join(root, 'hub/test'), { recursive: true });
  await writeFile(join(root, 'hub/test/harness.ts'), '// changed shared harness');
  const shared = await selectPackageSuite(root);
  assert.equal(shared.mode, 'full');
  assert.equal(shared.nvimTests, undefined);
  assert.deepEqual((await packageShardsForSelection(root, shared)).at(-1)?.targets, ['nvim/test/direct.test.ts', 'nvim/test/indirect.test.ts', 'nvim/test/types.test.ts']);
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
  ['a static hub import', "import { New } from '../../../hub/src/new-shared.ts';"],
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
  assert.match(selection.reason, /^nvim test import hub\/src\/new-shared.ts; coverage map missing; Neovim importers plus smoke$/);
  assert.deepEqual(selection.nvimTests, [...NVIM_SMOKE, 'nvim/test/nested/new.test.ts'].sort());
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
  assert.match(selection.reason, /^nvim test import hub\/src\/shared.ts; coverage map missing; Neovim importers plus smoke$/);
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

test('empty diffs remain full while failed fetch reports use of last known dev', async t => {
  const { root, git } = await gitFixture(t);
  assert.match((await selectPackageSuite(root)).reason, /empty diff/);
  await git('remote', 'set-url', 'origin', join(root, 'missing.git'));
  const selected = await selectPackageSuite(root);
  assert.equal(selected.mode, 'full');
  assert.match(selected.reason, /empty diff/);
  assert.match(selected.fallback!, /last known origin\/dev.*fetch unavailable:/);
  assert.equal(selected.fetchedDev, undefined);
  assert.equal(selected.loadGate, true, 'failed fetch does not bypass the task load gate');
});

// Each CLI spelling crosses the native runner once; its package mode is incidental.
for (const [mode, force] of [['hub-only', '--all'], ['nvim-only', 'all']] as const) {
test(`${mode} integrated package admission retains both locks through smoke and all widens the run`, async t => {
  const { root, git } = await gitFixture(t);
  const journal = join(root, 'journal.jsonl');
  const locks = { hub: join(root, 'machine.lock'), nvim: join(root, 'nvim.lock') };
  const files = ['hub/test/local.test.ts', 'hub/test/scenarios/hub-lifecycle.test.ts', 'hub/test/scenarios/message-tracer.test.ts', 'hub/test/scenarios/startup-smoke.test.ts', 'nvim/test/other.test.ts', ...NVIM_SMOKE];
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
  await git('checkout', '-b', 'package-lock-contract'); await git('merge', 'dev');
  const changed = mode === 'hub-only' ? 'hub/src/tracker/tracker.ts' : 'nvim/lua/cland/thread.lua';
  await mkdir(join(root, changed, '..'), { recursive: true });
  await writeFile(join(root, changed), '// changed');
  await git('add', '.'); await git('commit', '-m', 'local hub change');
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_TEST_CONTEXT: '', CLAND_TEST_SKIP_LOCK: '0' };
  delete env.CLAND_SUITE_SELECTION;
  const code = `import { runPackageSuite } from ${JSON.stringify(runner)}; process.exitCode = await runPackageSuite('auto', [], ${JSON.stringify({ cwd: root, lockDirs: locks })});`;
  const reduced = await exec(process.execPath, ['--input-type=module', '-e', code], { env: runnerFixtureEnvironment(root, env) });
  const rows = (await readFile(journal, 'utf8')).trim().split('\n').map(line => JSON.parse(line) as { file: string; token: string });
  assert.deepEqual(rows.map(row => row.file).sort(), mode === 'hub-only' ? ['hub/test/local.test.ts', 'hub/test/scenarios/hub-lifecycle.test.ts', 'hub/test/scenarios/message-tracer.test.ts', 'hub/test/scenarios/startup-smoke.test.ts', ...NVIM_SMOKE].sort() : ['hub/test/scenarios/hub-lifecycle.test.ts', 'hub/test/scenarios/message-tracer.test.ts', 'hub/test/scenarios/startup-smoke.test.ts', 'nvim/test/other.test.ts', ...NVIM_SMOKE].sort());
  assert.equal(new Set(rows.map(row => row.token)).size, 1, 'one admission spans hub and smoke');
  assert.ok(reduced.stderr.split('\n').some(line => line.startsWith('suite duration ') && line.includes(`mode ${mode}`) && line.includes(changed)), reduced.stderr);
  assert.ok(reduced.stderr.includes(`suite phase ${mode === 'hub-only' ? 'Neovim smoke' : 'hub machine smoke'}; locks held`), reduced.stderr);
  // Together the two modes cover both force-full spellings without repeating
  // the identical cross-product of full package subprocesses.
  await writeFile(journal, '');
  const full = await exec(process.execPath, [runner, force, 'hub/test/scenarios/message-tracer.test.ts'], { cwd: root, env: runnerFixtureEnvironment(root, { ...env, CLAND_TEST_SKIP_LOCK: '1', CLAND_SUITE_SELECTION: JSON.stringify({ mode, files: [changed], reason: 'transported task decision', tiers: ['T1', 'T2'] }) }) });
  assert.match(full.stderr, /mode full/);
  assert.deepEqual((await readFile(journal, 'utf8')).trim().split('\n').map(line => JSON.parse(line).file).sort(), files.slice().sort(), 'force-full overrides both the target and transported task tiers');
});
}

for (const [name, path, reason] of [
  ['protocol', 'hub/src/protocol.ts', /shared contract/],
  ['contract', 'hub/src/adapters/contract.ts', /shared contract/],
  ['package', 'hub/package.json', /package configuration/],
  ['harness', 'hub/test/harness.ts', /suite infrastructure/],
  ['fixture', 'hub/test/new-fixture.ts', /coverage unsupported path/],
  ['runner', 'hub/test/run-suite.ts', /suite infrastructure/],
  ['executor', 'hub/src/executor/new.ts', /coverage shared infrastructure/],
  ['unknown', 'hub/src/new.ts', /coverage source absent from map/],
] as const) {
  test(`coverage falls back for ${name} changes and names the cause`, async t => {
    const { root, git } = await coverageFixture(t);
    await mkdir(join(root, path, '..'), { recursive: true });
    await writeFile(join(root, path), '// new shared or unknown code');
    if (name === 'executor') {
      await mkdir(join(root, 'nvim/test'), { recursive: true });
      await writeFile(join(root, 'nvim/test/importer.test.ts'), `import '../../${path}';`);
      await git('add', 'nvim'); await git('commit', '-m', 'shared infrastructure importer'); await git('push', 'origin', 'HEAD:dev');
    }
    const selection = await selectPackageSuite(root);
    if (name === 'executor') {
      assert.equal(selection.mode, 'full');
      assert.equal(selection.nvimTests, undefined, 'shared infrastructure keeps the full Neovim fallback');
    }
    assert.notEqual(selection.mode, 'hub-selected');
    assert.match(selection.reason, reason);
  });
}

for (const [name, change, reason] of [
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

test('coverage age configuration reports an old map that still maps', async t => {
  const { root, map, source, save } = await coverageFixture(t);
  map.created = new Date(Date.now() - 60000).toISOString(); await save();
  await writeFile(join(root, '.cland/config.toml'), '[verification]\ncoverage_max_age = "30s"\n');
  await writeFile(join(root, 'hub/src/hub/example.ts'), source.replace('return 2', 'return 3'));
  const selected = await selectPackageSuite(root);
  assert.equal(selected.mode, 'hub-selected');
  assert.match(selected.reason, /coverage map age.*limit 30s.*hunks map/);
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
  const top = await selectPackageSuite(root);
  assert.equal(top.mode, 'hub-selected');
  assert.deepEqual(top.tests, [...HUB_SMOKE, 'hub/test/first.test.ts', 'hub/test/second.test.ts'].sort());
  assert.match(top.reason, /file covering tests.*top-level/);
  await writeFile(join(root, 'hub/src/hub/example.ts'), source + 'export function newFunction() { return 3; }\n');
  assert.equal((await selectPackageSuite(root)).mode, 'hub-selected');
  map.files['hub/src/hub/example.ts']!.functions[1]!.tests = []; await save();
  await writeFile(join(root, 'hub/src/hub/example.ts'), source.replace('return 2', 'return 3'));
  const untested = await selectPackageSuite(root);
  assert.equal(untested.mode, 'hub-selected');
  assert.deepEqual(untested.tests, [...HUB_SMOKE, 'hub/test/first.test.ts'].sort());
  assert.match(untested.reason, /file covering tests.*untested function/);
  map.files['hub/src/hub/example.ts']!.functions[1]!.tests = ['hub/test/second.test.ts']; await save();
  await git('add', '.'); await git('commit', '-m', 'intervening function edit'); await git('push', 'origin', 'HEAD:dev');
  await writeFile(join(root, 'hub/src/hub/example.ts'), source.replace('return 2', 'return 4'));
  assert.match((await selectPackageSuite(root)).reason, /coverage hunk changed since map/);
});

test('coverage ignores newer unrelated maps and selects Neovim importers', async t => {
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
  assert.equal(selected.nvimFull, false);
  assert.deepEqual(selected.nvimTests, [...NVIM_SMOKE, 'nvim/test/example.test.ts'].sort());
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

test('task admission adds only changed T3/T4 files, including renamed and untracked files, without expanding on fallback', async t => {
  const { root, git } = await gitFixture(t);
  const tests = { 'hub/test/changed.test.ts': 'T3', 'hub/test/deleted.test.ts': 'T3', 'hub/test/unchanged.test.ts': 'T3', 'nvim/test/soak.test.ts': 'T4' } as const;
  for (const file of Object.keys(tests)) {
    await mkdir(join(root, file, '..'), { recursive: true });
    await writeFile(join(root, file), "import test from 'node:test'; test('old identity', () => {});\n");
  }
  await writeFile(join(root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests }));
  await mkdir(join(root, '.cland/tasks'), { recursive: true });
  await writeFile(join(root, '.cland/tasks/T-214-fixture.md'), '---\nid: T-214\nkind: task\ntitle: Task\nstate: open\nparent: E-1\n---\n');
  await writeFile(join(root, '.cland/tasks/E-1-fixture.md'), '---\nid: E-1\nkind: epic\ntitle: Owner\nstate: open\n---\n');
  await writeFile(join(root, '.cland/config.toml'), '[merge]\nqueue = true\n');
  await git('add', '.'); await git('commit', '-m', 'tier baseline'); await git('push', 'origin', 'HEAD:dev');
  await writeFile(join(root, 'hub/test/changed.test.ts'), "import test from 'node:test'; test('renamed identity', () => {});\n");
  await git('rm', 'hub/test/deleted.test.ts');
  await writeFile(join(root, 'nvim/test/soak.test.ts'), "import test from 'node:test'; test('changed soak', () => {});\n");
  await writeFile(join(root, 'hub/test/new.test.ts'), "import test from 'node:test'; test('new identity', () => {});\n");
  const { 'hub/test/deleted.test.ts': _deleted, ...retained } = tests;
  const current = { ...retained, 'hub/test/new.test.ts': 'T3' as const };
  await writeFile(join(root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: current }));
  const selection = await selectPackageSuite(root);
  assert.deepEqual(selection.durationCheck?.files, ['hub/test/changed.test.ts', 'hub/test/new.test.ts', 'nvim/test/soak.test.ts']);
  assert.equal(selection.durationCheck?.owner, 'E-1');
  assert.deepEqual(selection.tiers, ['T1', 'T2', 'T3', 'T4']);
  const phases = await packageShards(root, selection.mode, undefined, selection);
  assert.deepEqual(phases.flatMap(phase => phase.targets).sort(), selection.durationCheck!.files);
  const { tierSuiteSelection } = await import('../src/suite-selection.ts');
  for (const tier of ['T3', 'T4'] as const) {
    const narrowed = tierSuiteSelection(selection, tier);
    assert.deepEqual((await packageShards(root, narrowed.mode, undefined, narrowed)).flatMap(phase => phase.targets).sort(), tier === 'T3' ? ['hub/test/changed.test.ts', 'hub/test/new.test.ts'] : ['nvim/test/soak.test.ts']);
  }
});

test('task admission requires explicit merge queue protection before reducing tiers', async t => {
  const { root, source } = await coverageFixture(t);
  await writeFile(join(root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: {
    'hub/test/changed.test.ts': 'T2', 'hub/test/first.test.ts': 'T1', 'hub/test/second.test.ts': 'T3',
  } }));
  await writeFile(join(root, 'hub/src/hub/example.ts'), source.replace('return 2', 'return 4'));
  for (const config of [null, '[merge]\nqueue = false\n', '[merge]\nqueue = true\n']) {
    if (config !== null) await writeFile(join(root, '.cland/config.toml'), config);
    const selection = await selectPackageSuite(root);
    assert.deepEqual(selection.tiers, config?.includes('true') ? ['T1', 'T2'] : undefined);
  }
});

test('hub-selected task executes covering T2 tests while process smoke waits for its batch', async t => {
  const { root, git, source } = await coverageFixture(t);
  await writeFile(join(root, '.cland/config.toml'), '[merge]\nqueue = true\n');
  const journal = join(root, '.cland/run/executed');
  const hub = [...['first', 'second', 'changed'].map(name => `hub/test/${name}.test.ts`), ...HUB_SMOKE];
  const nvim = [...['importer', 'other'].map(name => `nvim/test/${name}.test.ts`), ...NVIM_SMOKE];
  await mkdir(join(root, 'nvim/test'), { recursive: true });
  for (const file of [...hub, ...nvim]) { await mkdir(join(root, file, '..'), { recursive: true }); await writeFile(join(root, file), `import test from 'node:test'; import { appendFileSync } from 'node:fs'; test('execution marker', () => appendFileSync(${JSON.stringify(journal)}, ${JSON.stringify(file + '\n')}));\n`); }
  await writeFile(join(root, 'nvim/test/importer.test.ts'), "import '../../hub/src/hub/example.ts';\n" + await readFile(join(root, 'nvim/test/importer.test.ts'), 'utf8'));
  await writeFile(join(root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: Object.fromEntries([...hub, ...nvim].map(file => [file, [...HUB_SMOKE, ...NVIM_SMOKE].includes(file) ? 'T3' : 'T2'])) }));
  await git('add', '.'); await git('commit', '-m', 'executable baselines'); await git('push', 'origin', 'HEAD:dev');
  await writeFile(join(root, 'hub/src/hub/example.ts'), source.replace('return 2', 'return 3'));
  const selection = await selectPackageSuite(root);
  assert.equal(selection.mode, 'hub-selected');
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  const code = `import { runPackageSuite } from ${JSON.stringify(runner)}; process.exitCode = await runPackageSuite('auto', [], ${JSON.stringify({ cwd: root, lockDirs: { hub: join(root, '.cland/run/hub.lock'), nvim: join(root, '.cland/run/nvim.lock') } })});`;
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_TEST_CONTEXT: '', CLAND_SUITE_SELECTION: JSON.stringify(selection) };
  delete env.CLAND_SUITE_LEASE;
  const result = await exec(process.execPath, ['--input-type=module', '-e', code], { cwd: root, env: runnerFixtureEnvironment(root, env) });
  assert.deepEqual((await readFile(journal, 'utf8')).trim().split('\n').sort(), ['hub/test/second.test.ts', 'nvim/test/importer.test.ts']);
  assert.deepEqual(selection.tiers, ['T1', 'T2']);
  assert.match(result.stderr, /suite phase Neovim selected/);
  const duration = result.stderr.split('\n').find(line => line.startsWith('suite duration '));
  assert.match(duration ?? '', /mode hub-selected.*deciding functions.*second/);
  console.log(`one-function fixture: ${duration}`);
});

test('coverage replay includes own tests, reports time share and failures, and names missing-map fallback', async t => {
  const { root, git, source } = await coverageFixture(t);
  await writeFile(join(root, 'hub/test/durations.json'), JSON.stringify({ version: 1, source: { commit: 'fixture', artifacts: [] }, budget: { testSeconds: 5, fileSeconds: 60 }, tests: {}, allow: {}, files: Object.fromEntries([
    ['hub/test/first.test.ts', { seconds: 30, tests: 1 }], ['hub/test/second.test.ts', { seconds: 10, tests: 1 }], ['hub/test/changed.test.ts', { seconds: 2, tests: 1 }], ['hub/test/scenarios/hub-lifecycle.test.ts', { seconds: 1, tests: 1 }], ['hub/test/scenarios/message-tracer.test.ts', { seconds: 1, tests: 1 }], ['hub/test/scenarios/startup-smoke.test.ts', { seconds: 0, tests: 1 }],
  ]) }));
  await git('add', '.'); await git('commit', '-m', 'timing baseline'); await git('push', 'origin', 'HEAD:dev');
  const base = await git('rev-parse', 'HEAD');
  await writeFile(join(root, 'hub/src/hub/example.ts'), source.replace('return 2', 'return 3'));
  await writeFile(join(root, 'hub/test/changed.test.ts'), '// added assertion\n');
  await git('add', '.'); await git('commit', '-m', 'Changed function (T-1)');
  const head = await git('rev-parse', 'HEAD');
  const replay = fileURLToPath(new URL('./selection-replay.ts', import.meta.url));
  const args = [replay, `${base}..${head}`, '--coverage', '--count', '1'];
  const covered = await exec(process.execPath, args, { env: fixtureEnvironment(root, process.env), cwd: root });
  assert.match(covered.stdout, /hub-selected/);
  assert.match(covered.stdout, /31.8%/);
  assert.match(covered.stdout, /second/);
  assert.match(covered.stdout, /0 misses/);
  await mkdir(join(root, '.cland/run/suites/old-run'), { recursive: true });
  await writeFile(join(root, '.cland/run/suites/old-run/suite.log'), 'Branch t/T-1-example\n✖ historical failure (1ms)\nsuite timing {"file":"hub/test/first.test.ts","name":"historical failure","seconds":0.001}\n');
  await assert.rejects(exec(process.execPath, args, { env: fixtureEnvironment(root, process.env), cwd: root }), error => {
    const failed = error as { stdout: string; code: number };
    assert.equal(failed.code, 1); assert.match(failed.stdout, /1 retained run logs/); assert.match(failed.stdout, /hub\/test\/first.test.ts/);
    return true;
  });
  const failures = join(root, '.cland/run/failures.json');
  await writeFile(failures, JSON.stringify({ [head]: ['hub/test/first.test.ts'] }));
  await assert.rejects(exec(process.execPath, [...args, '--failures', failures], { env: fixtureEnvironment(root, process.env), cwd: root }), error => {
    const failed = error as { stdout: string; code: number };
    assert.equal(failed.code, 1); assert.match(failed.stdout, /hub\/test\/first.test.ts/); assert.match(failed.stdout, /1 misses/);
    return true;
  });
  await rm(join(root, '.cland/run/suites/old-run'), { recursive: true });
  await writeFile(failures, JSON.stringify({ [head]: ['nvim/test/scenarios/workbench.test.ts'] }));
  assert.match((await exec(process.execPath, [...args, '--failures', failures], { env: fixtureEnvironment(root, process.env), cwd: root })).stdout, /0 own misses; 0 historical misses/);
  await writeFile(failures, JSON.stringify({ [head]: ['nvim/test/other.test.ts'] }));
  await assert.rejects(exec(process.execPath, [...args, '--failures', failures], { env: fixtureEnvironment(root, process.env), cwd: root }), error => {
    const failed = error as { stdout: string; code: number };
    assert.equal(failed.code, 1); assert.match(failed.stdout, /0 own misses; 1 historical misses/); assert.match(failed.stdout, /outside package Neovim smoke/);
    return true;
  });
  await rm(join(root, '.cland/run/coverage-maps'), { recursive: true });
  const missing = await exec(process.execPath, args, { env: fixtureEnvironment(root, process.env), cwd: root });
  assert.match(missing.stdout, /coverage map missing/);
  assert.match(missing.stdout, /100.0%/);
  assert.match(missing.stdout, /0 misses/);
});

test('a remote fixture diff retains the T4 harness self-tests', async t => {
  const { root } = await gitFixture(t);
  await mkdir(join(root, 'hub/test'), { recursive: true });
  await writeFile(join(root, 'hub/test/remote-fixture.ts'), '// fixture change');
  const selected = await selectPackageSuite(root);
  assert.equal(selected.mode, 'hub-only');
  assert.match(selected.reason, /coverage unsupported path hub\/test\/remote-fixture.ts/);
  const manifest = JSON.parse(await readFile(new URL('./tiers.json', import.meta.url), 'utf8'));
  const { suitePhases } = await import('../src/suite-selection.ts');
  assert.ok(suitePhases(selected.mode)[0]!.targets.includes('hub/test/**/*.test.ts'));
  const plan = await packageShards(fileURLToPath(new URL('../../', import.meta.url)), selected.mode);
  const occasion = await packageShards(fileURLToPath(new URL('../../', import.meta.url)), 'full', undefined,
    { mode: 'full', files: selected.files, reason: 'stage occasion', soak: true, loadGate: true });
  for (const name of ['remote-fixture-lifecycle', 'prepared-project', 'account-fixture-isolation']) {
    const file = `hub/test/${name}.test.ts`;
    assert.equal(manifest.tests[file], 'T4');
    assert.ok(!plan.some(phase => phase.targets.includes(file)), `${file} waits for an occasion`);
    assert.ok(occasion.some(phase => phase.targets.includes(file)), `${file} stays in occasion verification`);
  }
});
