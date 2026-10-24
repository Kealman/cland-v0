// T3: native Git merges independent per-test documentation edits in a sealed scratch repository.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { appendFile, cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { before, test } from 'node:test';
import { promisify } from 'node:util';
import { assertTestAdmission } from '../../test-support/admission.ts';
import { fixtureEnvironment } from './fixture-environment.ts';

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
