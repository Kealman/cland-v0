// T3: native Git checkout and removal must preserve the shared dependency install.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, realpath, readFile, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fixtureEnvironment } from './fixture-environment.ts';
import { ownDirectory, beforeDirectories, guardDirectoryRemoval } from './process-cleanup.ts';
import { caseDeadlines } from './case-deadlines.ts';
import { territoryGitAsync } from '../src/territory.ts';
import { checkoutMergeBatch, removeMergeBatch } from '../src/hub/merge-batch-territory.ts';
import { DevT3Probes } from '../src/hub/dev-t3-probe.ts';
import { suiteUnit } from './suite-unit-fixture.ts';
import { committedTreeOrThrow } from '../src/verification-tree.ts';

for (const kind of ['batch', 'periodic probe'] as const) test(`${kind} checkout shares dependencies and removal preserves the root install`, t => {
  const scope = caseDeadlines(t, { ownership: { beforeDirectories, guardDirectoryRemoval } });
  return scope.run(async step => {
  const { root, env, candidate, packages } = await step(() => scope.wait('native fixture setup', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cland-batch-deps-'));
  ownDirectory(scope.fixtures, root);
  scope.adoptRoot(root);
  const env = fixtureEnvironment(root, process.env);
  const git = (args: string[]) => territoryGitAsync(root, args, false, undefined, env);
  const packages = { 'node_modules/@modelcontextprotocol/sdk': { version: '1.0.0' }, 'node_modules/playwright-core': { version: '1.0.0' } };
  await writeFile(join(root, 'package.json'), '{}');
  await writeFile(join(root, 'package-lock.json'), JSON.stringify({ packages }));
  await writeFile(join(root, '.gitignore'), 'node_modules\n.cland\n');
  for (const path of Object.keys(packages)) {
    await mkdir(join(root, path), { recursive: true });
    await writeFile(join(root, path, 'package.json'), JSON.stringify({ version: '1.0.0', main: 'index.js' }));
    await writeFile(join(root, path, 'index.js'), 'module.exports = "dependency sentinel";');
  }
  await writeFile(join(root, 'node_modules/.package-lock.json'), JSON.stringify({ packages }));
  await mkdir(join(root, '.cland/tasks'), { recursive: true });
  await writeFile(join(root, '.cland/tasks/T-1.md'), 'fixture task');
  await writeFile(join(root, '.cland/RULES.md'), 'fixture rules');
  await git(['init', '-b', 'dev']); await git(['add', '.']);
  await git(['add', '-f', '.cland/tasks/T-1.md', '.cland/RULES.md']);
  await git(['commit', '-qm', 'fixture']);
  const head = await git(['rev-parse', 'HEAD']);
  const tree = await committedTreeOrThrow(root, head, env);
  assert.notEqual(tree, await git(['rev-parse', 'HEAD^{tree}']));
  const candidate = { base: head, head, tree, cwd: join(root, '.cland/run/merge-batches', 'dev-t3-fixture'), budgetLines: [] };
  return { root, env, candidate, packages };
  }));
  const f = kind === 'periodic probe' ? await step(() => scope.wait('probe owner setup', () => suiteUnit(scope.fixtures))) : null;
  const repository = f ? new DevT3Probes(f.store, f.suites, root, env).repository : null;
  const checkout = () => repository ? repository.checkout(candidate) : checkoutMergeBatch(root, candidate, env);
  await step(() => scope.wait('native candidate checkout', checkout));
  assert.equal((await step(() => scope.wait('dependency symlink receipt', () => lstat(join(candidate.cwd, 'node_modules'))))).isSymbolicLink(), true);
  for (const path of Object.keys(packages)) {
    const actual = await step(() => scope.wait('candidate dependency receipt', () => realpath(join(candidate.cwd, path))));
    const expected = await step(() => scope.wait('root dependency receipt', () => realpath(join(root, path))));
    assert.equal(actual, expected);
  }
  assert.equal(createRequire(join(candidate.cwd, 'web/test/fixture.js'))('playwright-core'), 'dependency sentinel');
  await step(() => scope.wait('persisted checkout ownership', checkout));
  await step(() => scope.wait('guarded candidate removal', () => repository ? repository.remove(candidate) : removeMergeBatch(root, candidate, env)));
  for (const path of Object.keys(packages)) assert.match(await step(() => scope.wait('root dependency sentinel', () => readFile(join(root, path, 'index.js'), 'utf8'))), /dependency sentinel/);
  await step(() => scope.wait('candidate removal receipt', () => assert.rejects(lstat(candidate.cwd), { code: 'ENOENT' })));
  });
});
