// T3: Git's native union driver must retain independent appends after skill copying.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { parse } from 'yaml';
import { Report } from '../src/init/files.ts';
import { provisionSkills } from '../src/init/skills.ts';
import { fixtureEnvironment } from './fixture-environment.ts';

test('copied skill provenance retains both branches after a real Git merge', async t => {
  const scratch = await mkdtemp(join(tmpdir(), 'cland-provenance-merge-'));
  t.after(() => rm(scratch, { recursive: true, force: true }));
  const root = join(scratch, 'project');
  await mkdir(root);
  const env = fixtureEnvironment(scratch, process.env);
  await mkdir(env.HOME!, { recursive: true });
  // cland-allow-child-env: fixtureEnvironment above seals scratch root; env HOME is provisioned before native Git
  const git = async (...args: string[]) => (await promisify(execFile)('git', args, { cwd: root, env, timeout: 5000 })).stdout.trim();
  provisionSkills(new Report(root), root);
  const folder = join(root, '.agents/skills/implement');
  const path = join(folder, 'SKILL.md');
  const source = await readFile(path, 'utf8');
  const { metadata } = parse(/^---\n([\s\S]*?)\n---/.exec(source)![1]!) as { metadata: { changes: string } };
  // Exercise the shipped recording convention, including the old inline format.
  const addEntry = async (entry: string) => {
    if (metadata.changes === 'CHANGES') await appendFile(join(folder, 'CHANGES'), `${entry}\n`);
    else await writeFile(path, source.replace(/^(  changes: ).*$/m, `$1${JSON.stringify(`${metadata.changes}; ${entry}`)}`));
    await git('add', '.');
    await git('-c', 'core.hooksPath=', '-c', 'commit.gpgsign=false', 'commit', '-qm', entry);
  };
  await git('init', '-qb', 'base');
  await git('add', '.');
  await git('-c', 'core.hooksPath=', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Base');
  await git('checkout', '-qb', 'first');
  await addEntry('First independent change (T-1)');
  await git('checkout', '-qb', 'second', 'base');
  await addEntry('Second independent change (T-2)');
  // Both prepareMergeBatch and squashTask use merge-tree, then a one-parent commit-tree.
  const tree = (await git('merge-tree', '--write-tree', '--name-only', '-z', 'second', 'first')).split('\0')[0]!;
  const squash = await git('commit-tree', tree, '-p', 'second', '-m', 'Squash landing');
  const recordsPath = `.agents/skills/implement/${metadata.changes === 'CHANGES' ? 'CHANGES' : 'SKILL.md'}`;
  const landed = await git('show', `${squash}:${recordsPath}`);
  assert.match(landed, /First independent change \(T-1\)/);
  assert.match(landed, /Second independent change \(T-2\)/);
  assert.equal(await git('show', '-s', '--format=%P', squash), await git('rev-parse', 'second'));
  await git('-c', 'core.hooksPath=', '-c', 'commit.gpgsign=false', 'merge', '--no-edit', 'first');
  assert.equal(await git('diff', '--name-only', '--diff-filter=U'), '');
  const merged = await readFile(join(folder, metadata.changes === 'CHANGES' ? 'CHANGES' : 'SKILL.md'), 'utf8');
  assert.match(merged, /First independent change \(T-1\)/);
  assert.match(merged, /Second independent change \(T-2\)/);
});
