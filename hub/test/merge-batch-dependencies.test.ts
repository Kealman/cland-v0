// T3: native Git checkout and removal must preserve the shared dependency install.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, realpath, readFile, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fixtureEnvironment } from './fixture-environment.ts';
import { ownDirectory } from './process-cleanup.ts';
import { territoryGitAsync } from '../src/territory.ts';
import { checkoutMergeBatch, removeMergeBatch } from '../src/hub/merge-batch-territory.ts';
import { DevT3Probes } from '../src/hub/dev-t3-probe.ts';
import { suiteUnit } from './suite-unit-fixture.ts';

for (const kind of ['batch', 'periodic probe'] as const) test(`${kind} checkout shares dependencies and removal preserves the root install`, async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-batch-deps-'));
  ownDirectory(t, root);
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
  await git(['init', '-b', 'dev']); await git(['add', '.']); await git(['commit', '-qm', 'fixture']);
  const head = await git(['rev-parse', 'HEAD']);
  const candidate = { base: head, head, tree: await git(['rev-parse', 'HEAD^{tree}']), cwd: join(root, '.cland/run/merge-batches', 'dev-t3-fixture'), budgetLines: [] };
  const f = kind === 'periodic probe' ? await suiteUnit(t) : null;
  const repository = f ? new DevT3Probes(f.store, f.suites, root, env).repository : null;
  const checkout = () => repository ? repository.checkout(candidate) : checkoutMergeBatch(root, candidate, env);
  await checkout();
  assert.equal((await lstat(join(candidate.cwd, 'node_modules'))).isSymbolicLink(), true);
  for (const path of Object.keys(packages)) assert.equal(await realpath(join(candidate.cwd, path)), await realpath(join(root, path)));
  assert.equal(createRequire(join(candidate.cwd, 'web/test/fixture.js'))('playwright-core'), 'dependency sentinel');
  await checkout(); // persisted checkout must prepare/validate dependencies too
  if (repository) await repository.remove(candidate); else await removeMergeBatch(root, candidate, env);
  for (const path of Object.keys(packages)) assert.match(await readFile(join(root, path, 'index.js'), 'utf8'), /dependency sentinel/);
  await assert.rejects(lstat(candidate.cwd), { code: 'ENOENT' });
});
