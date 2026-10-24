// T3: native Git three-way merge is the contract; no cland hub process is needed.
import './cover-quiet.ts';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fixtureEnvironment } from './fixture-environment.ts';

for (const [firstName, firstText, secondName, secondText] of [
  ['SUITE_USAGE', 'verify classify', 'EXECUTOR_USAGE', 'executor status'],
  ['INIT_USAGE', 'init [dir]', 'UPDATE_USAGE', 'update [dir]'],
] as const) test(`${firstName}/${secondName} help edits survive native Git merge and merge-tree`, t => {
  const root = mkdtempSync(join(tmpdir(), 'cland-usage-merge-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = readFileSync(new URL('../src/cli/usage.ts', import.meta.url), 'utf8');
  // One complete string row per command, with an unchanged blank separator.
  // These used to be neighboring multiline blocks implicated in repeated conflicts.
  const first = source.split('\n').find(line => line.startsWith(`  ${firstName}:`));
  const second = source.split('\n').find(line => line.startsWith(`  ${secondName}:`));
  assert.ok(first);
  assert.ok(second);
  assert.ok(first.includes(firstText) && first.endsWith(','), `${firstName} help occupies one table row`);
  assert.ok(second.includes(secondText) && second.endsWith(','), `${secondName} help occupies one table row`);
  assert.ok(source.includes(`${first}\n\n${second}`), 'independent rows retain a blank merge boundary');
  assert.ok(!first.includes(secondText), 'distinct top-level commands have distinct rows');
  const frozen = readFileSync(new URL('./fixtures/cli-usage/commands.json', import.meta.url), 'utf8');
  const git = (...args: string[]) => execFileSync('git', args, {
    cwd: root, env: fixtureEnvironment(root, process.env), encoding: 'utf8', timeout: 5000,
  }).trim();
  const save = (text: string, fixture: string) => {
    writeFileSync(join(root, 'usage.ts'), text);
    writeFileSync(join(root, 'commands.json'), fixture);
    git('add', 'usage.ts', 'commands.json');
    git('commit', '-qm', 'Help edit');
  };
  git('init', '-qb', 'base');
  save(source, frozen);
  git('checkout', '-qb', 'first-help');
  save(source.replace(first, first.replace(firstText, `${firstText} --first-marker`)),
    frozen.replace(firstText, `${firstText} --first-marker`));
  git('checkout', '-qb', 'second-help', 'base');
  save(source.replace(second, second.replace(secondText, `${secondText} --second-marker`)),
    frozen.replace(secondText, `${secondText} --second-marker`));
  const tree = git('merge-tree', '--write-tree', 'second-help', 'first-help');
  const projected = git('show', `${tree}:usage.ts`);
  assert.match(projected, /--first-marker/);
  assert.match(projected, /--second-marker/);
  const projectedFixture = git('show', `${tree}:commands.json`);
  assert.match(projectedFixture, /--first-marker/);
  assert.match(projectedFixture, /--second-marker/);
  git('merge', '--no-edit', 'first-help');
  assert.equal(git('diff', '--name-only', '--diff-filter=U'), '');
  assert.equal(readFileSync(join(root, 'usage.ts'), 'utf8').trim(), projected);
  assert.equal(readFileSync(join(root, 'commands.json'), 'utf8').trim(), projectedFixture);
});
