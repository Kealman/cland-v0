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
  const moduleName = (name: string) => name.replace('_USAGE', '').toLowerCase();
  const firstFile = `${moduleName(firstName)}.ts`;
  const secondFile = `${moduleName(secondName)}.ts`;
  const first = readFileSync(new URL(`../src/cli/usage/${firstFile}`, import.meta.url), 'utf8');
  const second = readFileSync(new URL(`../src/cli/usage/${secondFile}`, import.meta.url), 'utf8');
  assert.ok(first.includes(firstText));
  assert.ok(second.includes(secondText));
  assert.ok(!first.includes(secondText), 'distinct top-level commands have distinct modules');
  const frozen = readFileSync(new URL('./fixtures/cli-usage/commands.json', import.meta.url), 'utf8');
  const git = (...args: string[]) => execFileSync('git', ['-c', 'gc.auto=0', ...args], {
    cwd: root, env: fixtureEnvironment(root, process.env), encoding: 'utf8', timeout: 5000,
  }).trim();
  const save = (firstSource: string, secondSource: string, fixture: string) => {
    writeFileSync(join(root, firstFile), firstSource);
    writeFileSync(join(root, secondFile), secondSource);
    writeFileSync(join(root, 'commands.json'), fixture);
    git('add', firstFile, secondFile, 'commands.json');
    git('commit', '-qm', 'Help edit');
  };
  git('init', '-qb', 'base');
  save(first, second, frozen);
  git('checkout', '-qb', 'first-help');
  save(first.replace(firstText, `${firstText} --first-marker`), second,
    frozen.replace(firstText, `${firstText} --first-marker`));
  git('checkout', '-qb', 'second-help', 'base');
  save(first, second.replace(secondText, `${secondText} --second-marker`),
    frozen.replace(secondText, `${secondText} --second-marker`));
  const tree = git('merge-tree', '--write-tree', 'second-help', 'first-help');
  const projectedFirst = git('show', `${tree}:${firstFile}`);
  const projectedSecond = git('show', `${tree}:${secondFile}`);
  assert.match(projectedFirst, /--first-marker/);
  assert.match(projectedSecond, /--second-marker/);
  const projectedFixture = git('show', `${tree}:commands.json`);
  assert.match(projectedFixture, /--first-marker/);
  assert.match(projectedFixture, /--second-marker/);
  git('merge', '--no-edit', 'first-help');
  assert.equal(git('diff', '--name-only', '--diff-filter=U'), '');
  assert.equal(readFileSync(join(root, firstFile), 'utf8').trim(), projectedFirst);
  assert.equal(readFileSync(join(root, secondFile), 'utf8').trim(), projectedSecond);
  assert.equal(readFileSync(join(root, 'commands.json'), 'utf8').trim(), projectedFixture);
});
