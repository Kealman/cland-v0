// T3: native Git merges and squash trees retain parallel skill notes, usage entries and test guides after skill copying.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { Report } from '../src/init/files.ts';
import { provisionSkills } from '../src/init/skills.ts';
import { derivedTestDocIndex } from './generate-test-docs-index.ts';
import { pathToFileURL } from 'node:url';
import { fixtureEnvironment } from './fixture-environment.ts';

test('copied skill provenance retains both branches after a real Git merge', async t => {
  const scratch = await mkdtemp(join(tmpdir(), 'cland-provenance-merge-'));
  t.after(() => rm(scratch, { recursive: true, force: true }));
  const root = join(scratch, 'project');
  await mkdir(root);
  const env = fixtureEnvironment(scratch, process.env);
  await mkdir(env.HOME!, { recursive: true });
  // cland-allow-child-env: fixtureEnvironment above seals scratch root; env HOME is provisioned before native Git
  const git = async (...args: string[]) => (await promisify(execFile)('git', ['-c', 'gc.auto=0', ...args], { cwd: root, env, timeout: 5000 })).stdout.trim();
  provisionSkills(new Report(root), root);
  const folder = join(root, '.agents/skills/implement');
  assert.ok((await readdir(join(folder, 'CHANGES'))).length, 'provenance entries are separate files');
  await cp(new URL('../src/cli/usage/', import.meta.url), join(root, 'usage'), { recursive: true });
  await mkdir(join(root, 'docs/agents/tests'), { recursive: true });
  const addEntry = async (branch: string) => {
    await mkdir(join(root, 'docs/agents/tests'), { recursive: true });
    await writeFile(join(folder, 'CHANGES', `${branch}.md`), `${branch} independent change\n`);
    const usagePath = join(root, 'usage', branch === 'first' ? 'open.ts' : 'push.ts');
    const usageSource = await readFile(usagePath, 'utf8');
    await writeFile(usagePath, usageSource.replace(/;\n$/, ` + '${branch} help\\n';\n`));
    await writeFile(join(root, 'docs/agents/tests', `hub-test-${branch}.test.ts.md`), `# hub/test/${branch}.test.ts\n\n${branch} guidance.\n`);
    await git('add', '.');
    await git('-c', 'core.hooksPath=', '-c', 'commit.gpgsign=false', 'commit', '-qm', branch);
  };
  await git('init', '-qb', 'base');
  await git('add', '.');
  await git('-c', 'core.hooksPath=', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Base');
  await git('checkout', '-qb', 'first');
  await addEntry('first');
  await git('checkout', '-qb', 'second', 'base');
  await addEntry('second');
  // Both prepareMergeBatch and squashTask use merge-tree, then a one-parent commit-tree.
  const tree = (await git('merge-tree', '--write-tree', '--name-only', '-z', 'second', 'first')).split('\0')[0]!;
  const squash = await git('commit-tree', tree, '-p', 'second', '-m', 'Squash landing');
  for (const branch of ['first', 'second']) {
    for (const path of [`.agents/skills/implement/CHANGES/${branch}.md`, `usage/${branch === 'first' ? 'open' : 'push'}.ts`, `docs/agents/tests/hub-test-${branch}.test.ts.md`]) {
      assert.match(await git('show', `${squash}:${path}`), new RegExp(branch));
    }
  }
  assert.equal(await git('show', '-s', '--format=%P', squash), await git('rev-parse', 'second'));
  await git('-c', 'core.hooksPath=', '-c', 'commit.gpgsign=false', 'merge', '--no-edit', 'first');
  assert.equal(await git('diff', '--name-only', '--diff-filter=U'), '');
  const index = derivedTestDocIndex(pathToFileURL(`${join(root, 'docs/agents/tests')}/`));
  for (const branch of ['first', 'second']) assert.ok(index.includes(`hub-test-${branch}.test.ts.md`));
  for (const branch of ['first', 'second']) {
    assert.match(await readFile(join(folder, 'CHANGES', `${branch}.md`), 'utf8'), new RegExp(branch));
    assert.match(await readFile(join(root, 'usage', branch === 'first' ? 'open.ts' : 'push.ts'), 'utf8'), new RegExp(branch));
    assert.match(await readFile(join(root, 'docs/agents/tests', `hub-test-${branch}.test.ts.md`), 'utf8'), new RegExp(branch));
  }
});
