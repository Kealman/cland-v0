// T3: native Git merges independent per-test documentation edits in a sealed scratch repository.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { appendFile, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { before, test } from 'node:test';
import { promisify } from 'node:util';
import { assertTestAdmission } from '../../test-support/admission.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { assertTestDocIndex } from './test-docs-index.ts';

before(() => assertTestAdmission());

test('independent test documentation paragraphs merge without conflict', async t => {
  const scratch = await mkdtemp(join(tmpdir(), 'cland-test-docs-merge-'));
  t.after(() => rm(scratch, { recursive: true, force: true }));
  const root = join(scratch, 'project');
  await mkdir(root);
  await cp(new URL('../../docs/agents/tests/', import.meta.url), join(root, 'docs'), { recursive: true });
  const env = fixtureEnvironment(scratch, process.env);
  await mkdir(env.HOME!, { recursive: true });
  // cland-allow-child-env: fixtureEnvironment seals all Git launches; HOME is provisioned above and every child is awaited.
  const git = async (...args: string[]) => (await promisify(execFile)('git', ['-c', 'core.hooksPath=', '-c', 'commit.gpgsign=false', ...args], { cwd: root, env, timeout: 5000 })).stdout.trim();
  await git('init', '-qb', 'base');
  await git('add', '.');
  await git('commit', '-qm', 'Base test documentation');
  for (const [branch, file, paragraph] of [
    ['first', 'web-test-palette.test.ts.md', 'Independent palette regression.'],
    ['second', 'web-test-topics.test.ts.md', 'Independent topics regression.'],
  ]) {
    await git('checkout', '-qb', branch!, 'base');
    const path = join(root, 'docs', file!);
    assert.ok((await readFile(path, 'utf8')).length > 0, 'edit an existing per-test document');
    await appendFile(path, `\n${paragraph}\n`);
    await git('add', '.');
    await git('commit', '-qm', branch!);
  }
  await git('merge', '--no-edit', 'first');
  assert.equal(await git('diff', '--name-only', '--diff-filter=U'), '');
  assert.match(await readFile(join(root, 'docs/web-test-palette.test.ts.md'), 'utf8'), /Independent palette regression\./);
  assert.match(await readFile(join(root, 'docs/web-test-topics.test.ts.md'), 'utf8'), /Independent topics regression\./);
});

for (const mode of ['merge', 'merge-tree', 'rebase'] as const) {
  test(`parallel index additions and shared per-test paragraphs survive ${mode}`, async t => {
    const scratch = await mkdtemp(join(tmpdir(), 'cland-test-docs-union-'));
    t.after(() => rm(scratch, { recursive: true, force: true }));
    const root = join(scratch, 'project');
    const docs = join(root, 'docs/agents/tests');
    await mkdir(docs, { recursive: true });
    const attributes = await readFile(new URL('../../.gitattributes', import.meta.url), 'utf8');
    await writeFile(join(root, '.gitattributes'), attributes);
    const env = fixtureEnvironment(scratch, process.env);
    await mkdir(env.HOME!, { recursive: true });
    // cland-allow-child-env: fixtureEnvironment seals bounded Git children; all commands exit before scratch teardown.
    const git = async (...args: string[]) => (await promisify(execFile)('git', ['-c', 'core.hooksPath=', '-c', 'commit.gpgsign=false', ...args], { cwd: root, env, timeout: 5000 })).stdout.trim();
    const row = (name: string) => `| [\`hub/test/${name}.test.ts\`](../../../hub/test/${name}.test.ts) | [Notes](hub-test-${name}.test.ts.md) |`;
    const writeDoc = (name: string, body: string) => writeFile(join(docs, `hub-test-${name}.test.ts.md`), `# hub/test/${name}.test.ts\n\n${body}\n`);
    const baseIndex = `# Test-file guidance\n\n| Test file | Guidance |\n| --- | --- |\n${row('existing')}\n`;
    await writeDoc('existing', 'Existing shared guidance.');
    await writeFile(join(docs, 'index.md'), baseIndex);
    await git('init', '-qb', 'base');
    await git('add', '.');
    await git('commit', '-qm', 'Base guidance and shipped attributes');
    for (const branch of ['first', 'second']) {
      await git('checkout', '-qb', branch, 'base');
      await writeDoc(branch, `${branch} independent guidance.`);
      await writeDoc('shared', `${branch} shared new guidance.`);
      await appendFile(join(docs, 'hub-test-existing.test.ts.md'), `\n${branch} shared extension.\n`);
      await writeFile(join(docs, 'index.md'), `${baseIndex}${row(branch)}\n${row('shared')}\n`);
      await git('add', '.');
      await git('commit', '-qm', branch);
    }
    if (mode === 'merge-tree') {
      // Exact object-merge flags used by prepareMergeBatch and ordinary cland merge.
      const tree = (await git('merge-tree', '--write-tree', '--name-only', '-z', 'second', 'first')).split('\0')[0]!;
      await git('read-tree', '--reset', '-u', tree);
    } else if (mode === 'rebase') {
      await git('rebase', 'first');
    } else {
      await git('merge', '--no-edit', 'first');
    }
    assert.equal(await git('diff', '--name-only', '--diff-filter=U'), '');
    assertTestDocIndex(await readFile(join(docs, 'index.md'), 'utf8'),
      (await readdir(docs)).filter(name => name !== 'index.md'));
    for (const branch of ['first', 'second']) {
      assert.match(await readFile(join(docs, `hub-test-${branch}.test.ts.md`), 'utf8'), new RegExp(`${branch} independent guidance\\.`));
      assert.match(await readFile(join(docs, 'hub-test-shared.test.ts.md'), 'utf8'), new RegExp(`${branch} shared new guidance\\.`));
      assert.match(await readFile(join(docs, 'hub-test-existing.test.ts.md'), 'utf8'), new RegExp(`${branch} shared extension\\.`));
    }
  });
}
