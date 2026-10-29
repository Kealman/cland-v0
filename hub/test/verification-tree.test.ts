import { fixtureEnvironment } from './fixture-environment.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { candidateTree, committedTree, committedTreeOrThrow } from '../src/verification-tree.ts';
import { prepareMergeBatch } from '../src/hub/merge-batch-territory.ts';
import { eventually, tempProject } from './harness.ts';

test('strict historical identity retains Git failure output while cache lookup returns null', async t => {
  // T3: real Git failure-output contract, without a fake executable.
  const root = await tempProject(t);
  await promisify(execFile)('git', ['init', '-q'], { env: fixtureEnvironment(root, process.env), cwd: root });
  await assert.rejects(() => committedTreeOrThrow(root, 'missing-candidate'), error => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /git read-tree missing-candidate failed/);
    assert.match(error.message, /stdout: \(empty\); stderr: fatal:/);
    assert.match(error.message, /missing-candidate/);
    return true;
  });
  assert.equal(await committedTree(root, 'missing-candidate'), null);
});

test('diagnostic candidate hashing excludes tracker versions differing from HEAD and live files', async t => {
  // T3: real Git index safety contract; in-memory Git cannot reproduce rm's refusal.
  const root = await tempProject(t);
  const git = async (...args: string[]) => (await promisify(execFile)('git', args, { env: fixtureEnvironment(root, process.env), cwd: root })).stdout.trim();
  await git('init', '-qb', 'dev');
  await git('config', 'user.name', 'Test');
  await git('config', 'user.email', 'test@example.com');
  await git('config', 'commit.gpgsign', 'false');
  await mkdir(join(root, '.cland/tasks'), { recursive: true });
  await writeFile(join(root, 'source'), 'code\n');
  const paths = ['.cland/tasks/T-1.md', '.cland/RULES.md'];
  for (const path of paths) await writeFile(join(root, path), 'base\n');
  await git('add', '.'); await git('commit', '-qm', 'Base');
  const base = await git('rev-parse', 'HEAD');
  for (const path of paths) await writeFile(join(root, path), 'candidate\n');
  await git('add', '.');
  const tip = await git('commit-tree', await git('write-tree'), '-p', base, '-m', 'Member');
  await git('update-ref', 'refs/heads/t/1', tip);
  await git('reset', '--hard', base);
  for (const path of paths) await writeFile(join(root, path), 'live tracker update\n');
  const index = await readFile(join(root, '.git/index'));
  // The independent expected tree contains only the literal source blob.
  const blob = await git('rev-parse', `${base}:source`);
  const candidate = await prepareMergeBatch(root, 'omit-0', [{ item: 'T-1', branch: 't/1', head: tip, verdictBase: 'dev', enqueued: '2026-10-19T00:00:00Z', by: { id: 'coord', name: 'coord', role: 'coordinator' } }], process.env, undefined, base);
  assert.ok(await committedTree(root, candidate.head), 'fresh unreferenced commit has an identity');
  assert.equal(await git('ls-tree', candidate.tree), `100644 blob ${blob}\tsource`);
  assert.deepEqual(await readFile(join(root, '.git/index')), index);
  assert.equal(await git('rev-parse', 'HEAD'), base);
  for (const path of paths) assert.equal(await readFile(join(root, path), 'utf8'), 'live tracker update\n');
});

for (const change of ['tracker', 'rulebook', 'source', 'dirty source', 'strict head'] as const) {
  test(`candidate hashing observes an overlapping ${change} change`, async t => {
    const root = await tempProject(t);
    const bin = await tempProject(t);
    const realGit = (await promisify(execFile)('which', ['git'], { env: fixtureEnvironment(root, process.env) })).stdout.trim();
    const git = async (...args: string[]) => (await promisify(execFile)(realGit, args, { env: fixtureEnvironment(root, process.env), cwd: root })).stdout.trim();
    await git('init', '-q');
    await git('config', 'user.name', 'Test');
    await git('config', 'user.email', 'test@example.com');
    await git('config', 'commit.gpgsign', 'false');
    await mkdir(join(root, '.cland/tasks'), { recursive: true });
    await writeFile(join(root, 'source'), 'committed\n');
    await git('add', '.'); await git('commit', '-qm', 'Base');
    const head = await git('rev-parse', 'HEAD');
    const tree = await committedTree(root, head);
    const held = join(bin, 'held'), release = join(bin, 'release');
    await writeFile(join(bin, 'git'), `#!${process.execPath}
import { existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
const args = process.argv.slice(2);
if (args[0] === 'read-tree' && !existsSync(${JSON.stringify(held)})) {
  writeFileSync(${JSON.stringify(held)}, '');
  const deadline = Date.now() + 5000;
  while (!existsSync(${JSON.stringify(release)}) && Date.now() < deadline) await pause(10);
  if (!existsSync(${JSON.stringify(release)})) process.exit(97);
}
process.exitCode = spawnSync(${JSON.stringify(realGit)}, args, { stdio: 'inherit' }).status ?? 1;
`, { mode: 0o700 });
    const pending = candidateTree(root, change === 'strict head' ? head : undefined, { ...process.env, PATH: `${bin}:${process.env.PATH ?? ''}` });
    let result: string | null = null;
    try {
      await eventually('immutable hash captured its head', () => stat(held).then(() => true, () => undefined));
      const path = change === 'tracker' || change === 'strict head' ? '.cland/tasks/note.md' : change === 'rulebook' ? '.cland/RULES.md' : 'source';
      await writeFile(join(root, path), 'overlapping change\n');
      if (change !== 'dirty source') {
        await git('add', path); await git('commit', '-qm', 'Overlap');
        assert.notEqual(await git('rev-parse', 'HEAD'), head);
      }
    } finally { await writeFile(release, ''); result = await pending; }
    assert.equal(result, change === 'tracker' || change === 'rulebook' ? tree : null);
  });
}

test('candidate inputs exclude only tracker items and the rulebook for committed and dirty trees', async t => {
  const root = await tempProject(t);
  const git = async (...args: string[]) => (await promisify(execFile)('git', args, { env: fixtureEnvironment(root, process.env), cwd: root })).stdout.trim();
  const commit = async () => {
    await git('add', '.');
    await git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Candidate');
    return git('rev-parse', 'HEAD');
  };
  await git('init', '-q');
  await mkdir(join(root, '.cland/tasks'), { recursive: true });
  await mkdir(join(root, 'docs'));
  await writeFile(join(root, 'source'), 'source\n');
  const head = await commit();
  const tree = await candidateTree(root, head);
  assert.ok(tree);
  for (const path of ['.cland/tasks/note.md', '.cland/RULES.md']) await writeFile(join(root, path), 'administrative\n');
  assert.equal(await candidateTree(root, head), tree, 'untracked administrative writes do not dirty the candidate');
  await git('add', '.');
  assert.equal(await candidateTree(root, head), tree, 'staged administrative writes do not dirty the candidate');
  const advanced = await commit();
  assert.equal(await committedTree(root, advanced), tree);
  assert.equal(await candidateTree(root, undefined), tree);
  assert.equal(await candidateTree(root, head), null, 'explicit submitted heads stay strict');
  for (const path of ['docs/guide.md', '.cland/config.toml', '.cland/RULES.md.extra', 'source']) {
    const before = await candidateTree(root, undefined);
    await writeFile(join(root, path), 'changed suite input\n');
    assert.equal(await candidateTree(root, undefined), null, path);
    const changed = await commit();
    assert.notEqual(await committedTree(root, changed), before, path);
  }
});

test('candidate provenance keeps Git environments separate and never rewrites their index', async t => {
  const root = await tempProject(t);
  const settings = await tempProject(t);
  const git = async (...args: string[]) => (await promisify(execFile)('git', args, { env: fixtureEnvironment(root, process.env), cwd: root })).stdout.trim();
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
  assert.deepEqual(await Promise.all(environments.map(env => committedTree(root, head, env))), [tree, tree], 'historical stage evidence resolves the committed tree even with an untracked file');
  assert.deepEqual(await readFile(indexPath), index, 'the caller-provided index is unchanged');
  assert.deepEqual(await readFile(join(root, '.git/index')), index, 'the repository index is unchanged');
});

test('periodic green-tip history distinguishes tracker commits from non-tracker edits and reverts', async t => {
  const { nonTrackerChanges } = await import('../src/hub/dev-t3-search.ts');
  const root = await tempProject(t);
  const git = async (args: string[]) => (await promisify(execFile)('git', ['-c', 'gc.auto=0', ...args], { env: fixtureEnvironment(root, process.env), cwd: root })).stdout.trim();
  await git(['init', '-qb', 'dev']);
  await git(['config', 'user.name', 'Test']);
  await git(['config', 'user.email', 'test@example.com']);
  await git(['config', 'commit.gpgsign', 'false']);
  const commit = async () => { await git(['add', '.']); await git(['commit', '-qm', 'Fixture']); return git(['rev-parse', 'HEAD']); };
  await mkdir(join(root, '.cland/tasks'), { recursive: true });
  await writeFile(join(root, 'source'), 'original');
  const red = await commit();
  await writeFile(join(root, '.cland/tasks/item.md'), 'tracker');
  const tracker = await commit();
  assert.equal(await nonTrackerChanges(git, red, tracker), false);
  await writeFile(join(root, 'source'), 'edited');
  const code = await commit();
  assert.equal(await nonTrackerChanges(git, red, code), true);
  await writeFile(join(root, 'source'), 'original');
  const reverted = await commit();
  assert.equal(await nonTrackerChanges(git, red, reverted), true, 'intervening code changes count despite identical endpoint source');
  await writeFile(join(root, '.cland/RULES.md'), 'rule');
  const rulebook = await commit();
  assert.equal(await nonTrackerChanges(git, reverted, rulebook), true, 'rulebook is outside tracker items');
  assert.equal(await nonTrackerChanges(git, rulebook, red), null, 'a rewritten dev without red ancestry supplies no fix evidence');
  assert.equal(await nonTrackerChanges(async () => null, red, code), null);
  assert.equal(await nonTrackerChanges(async () => { throw new Error('unavailable'); }, red, code), null);
});
