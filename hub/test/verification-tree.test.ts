import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { candidateTree } from '../src/verification-tree.ts';
import { tempProject } from './harness.ts';

test('candidate provenance keeps Git environments separate and never rewrites their index', async t => {
  const root = await tempProject(t);
  const settings = await tempProject(t);
  const git = async (...args: string[]) => (await promisify(execFile)('git', args, { cwd: root })).stdout.trim();
  await git('init', '-q');
  await writeFile(join(root, '.gitignore'), '.cland/\n');
  await writeFile(join(root, 'source'), 'committed\n');
  await git('add', '.');
  await git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Base');
  const head = await git('rev-parse', 'HEAD');
  const tree = await git('rev-parse', 'HEAD^{tree}');
  await writeFile(join(root, 'scratch'), 'untracked\n');
  const index = await readFile(join(root, '.git/index'));
  const indexPath = join(settings, 'user-index');
  await writeFile(indexPath, index);
  const environments = await Promise.all(['scratch\n', 'other\n'].map(async (rules, i) => {
    const excludes = join(settings, `excludes-${i}`);
    await writeFile(excludes, rules);
    return { ...process.env, GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.excludesFile', GIT_CONFIG_VALUE_0: excludes, GIT_INDEX_FILE: indexPath };
  }));
  assert.deepEqual(await Promise.all(environments.map(env => candidateTree(root, head, env))), [tree, null]);
  assert.deepEqual(await readFile(indexPath), index, 'the caller-provided index is unchanged');
  assert.deepEqual(await readFile(join(root, '.git/index')), index, 'the repository index is unchanged');
});
