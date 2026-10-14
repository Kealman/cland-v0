import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseSuiteMode, importSpecifiers, nvimHubImports, selectPackageSuite } from '../src/suite-selection.ts';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
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

for (const path of ['hub/src/protocol.ts', 'hub/src/hub/store.ts', 'hub/test/run-suite.ts', 'hub/test/harness.ts', 'hub/test/process-cleanup.ts', 'hub/src/suite-selection.ts', 'hub/src/suite-shards.ts', 'hub/package.json', 'hub/tsconfig.json', 'nvim/tsconfig.json', 'hub/src/cli/role.ts', 'hub/src/cli/roles.ts', 'hub/src/tracker/tracker.ts', 'hub/src/hub/visibility.ts']) {
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

for (const path of ['hub/test/shards.json', 'hub/src/hub/core.ts', 'hub/src/hub/dispatch.ts', 'hub/src/hub/server.ts', 'hub/src/subscriptions.ts', 'hub/src/roles.ts', 'hub/src/crew.ts', 'hub/src/spoke/server.ts', 'hub/src/hub/suites.ts', '.cland/tasks/T-214.md', '.cland/roles.toml', '.cland/crew.toml', 'scripts/check.sh', 'hub/src/new-event.ts', 'docs/agents/tests.md', 'skills/qa/SKILL.md', '.agents/skills/qa/SKILL.md', 'README.md']) {
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

test('fetched dev selects committed and working changes, all forces full, and integrated dev stays full', async t => {
  const { root, git } = await gitFixture(t);
  await mkdir(join(root, 'hub', 'src', 'tracker'), { recursive: true });
  await writeFile(join(root, 'hub', 'src', 'tracker', 'tracker.ts'), '// local');
  await git('add', '.'); await git('commit', '-m', 'hub local');
  const selected = await selectPackageSuite(root);
  assert.equal(selected.mode, 'hub-only');
  assert.deepEqual(selected.files, ['hub/src/tracker/tracker.ts']);
  assert.equal((await selectPackageSuite(root, 'all')).mode, 'full');
  await mkdir(join(root, 'nvim', 'lua'), { recursive: true });
  await writeFile(join(root, 'nvim', 'lua', 'thread.lua'), '-- dirty');
  assert.equal((await selectPackageSuite(root)).mode, 'full', 'untracked Neovim code makes the diff mixed');
  await git('checkout', 'dev');
  assert.match((await selectPackageSuite(root)).reason, /integrated dev/);
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
  assert.equal(selection.reason, 'nvim test import hub/src/new-shared.ts');
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
  assert.equal(selection.reason, 'nvim test import hub/src/shared.ts');
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
});

for (const mode of ['hub-only', 'nvim-only'] as const) {
test(`${mode} admission retains both locks through smoke, omits the other package's remaining tests, and all widens the run`, async t => {
  const { root, git } = await gitFixture(t);
  const journal = join(root, 'journal.jsonl');
  const locks = { hub: join(root, 'machine.lock'), nvim: join(root, 'nvim.lock') };
  const files = ['hub/test/local.test.ts', 'hub/test/tracer.test.ts', 'hub/test/daemon.test.ts', 'nvim/test/client.test.ts', 'nvim/test/sessions.test.ts', 'nvim/test/other.test.ts'];
  for (const path of files) {
    await mkdir(join(root, path, '..'), { recursive: true });
    await writeFile(join(root, path), `import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync, appendFileSync, existsSync } from 'node:fs'; test('phase', () => {
      if (process.env.CLAND_TEST_SKIP_LOCK !== '1') for (const lock of ${JSON.stringify(Object.values(locks))}) assert.ok(existsSync(lock), 'both locks held');
      const owner = existsSync(${JSON.stringify(locks.hub + '.owner')}) ? JSON.parse(readFileSync(${JSON.stringify(locks.hub + '.owner')}, 'utf8')) : { token: 'unlocked fixture' };
      appendFileSync(${JSON.stringify(journal)}, JSON.stringify({ file: ${JSON.stringify(path)}, token: owner.token }) + '\\n');
    });`);
  }
  await writeFile(join(root, 'hub/test/shards.json'), JSON.stringify({ version: 1, tests: Object.fromEntries(files.filter(path => path.startsWith('hub/')).map(path => [path, 'machine'])) }));
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
  assert.deepEqual(rows.map(row => row.file).sort(), mode === 'hub-only' ? ['hub/test/daemon.test.ts', 'hub/test/local.test.ts', 'hub/test/tracer.test.ts', 'nvim/test/client.test.ts', 'nvim/test/sessions.test.ts'] : ['hub/test/daemon.test.ts', 'hub/test/tracer.test.ts', 'nvim/test/client.test.ts', 'nvim/test/other.test.ts', 'nvim/test/sessions.test.ts']);
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
