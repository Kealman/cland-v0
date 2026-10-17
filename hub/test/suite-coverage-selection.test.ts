// T1: coverage decisions use fixed maps and git diff replies, without processes or clocks.
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { coverageSelection, type CoverageMap } from '../src/suite-coverage.ts';

async function fixture(t: import('node:test').TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'cland-coverage-selection-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'hub/test'), { recursive: true });
  for (const file of ['first', 'second', 'changed']) await writeFile(join(root, `hub/test/${file}.test.ts`), '// test');
  const map: CoverageMap = { version: 1, head: 'a'.repeat(40), tree: 'b'.repeat(40), created: '2026-10-10T00:00:00Z',
    testFiles: ['hub/test/first.test.ts', 'hub/test/second.test.ts'], files: { 'hub/src/example.ts': { functions: [
      { name: 'first', start: 10, end: 30, startLine: 2, endLine: 4, tests: ['hub/test/first.test.ts'] },
      { name: 'second', start: 40, end: 60, startLine: 6, endLine: 8, tests: ['hub/test/second.test.ts'] },
      { name: 'untested', start: 70, end: 90, startLine: 10, endLine: 12, tests: [] },
    ] } } };
  const select = (change: string, intervening = '', age = 1000, ancestor = true) => coverageSelection(root,
    ['hub/src/example.ts', 'hub/test/changed.test.ts'], 'base', async (...args) => {
      if (args[0] === 'merge-base') { if (!ancestor) throw new Error('not ancestor'); return ''; }
      return args.includes(map.head) ? intervening : change;
    }, 172800000, { maps: [{ map, pointer: { artifact: 'A-fixture', path: 'fixture-map.json' } }], at: Date.parse(map.created) + age, nearest: false });
  return { root, map, select };
}

test('top-level insertions select every covering test in the file and name the widening', async t => {
  const { select } = await fixture(t);
  const selected = await select('@@ -0,0 +1 @@\n+const setting = true;');
  assert.ok(!('fallback' in selected));
  assert.deepEqual(selected.tests, ['hub/test/changed.test.ts', 'hub/test/first.test.ts', 'hub/test/second.test.ts']);
  assert.match(selected.notes.join('; '), /file covering tests.*top-level/);
});

test('untested function edits select the other covering tests in that file, with empty files falling back', async t => {
  const { map, select } = await fixture(t);
  const selected = await select('@@ -11 +11 @@\n-return 1;\n+return 2;');
  assert.ok(!('fallback' in selected));
  assert.deepEqual(selected.tests, ['hub/test/changed.test.ts', 'hub/test/first.test.ts', 'hub/test/second.test.ts']);
  assert.match(selected.notes.join('; '), /file covering tests.*untested function/);
  for (const fn of map.files['hub/src/example.ts']!.functions) fn.tests = [];
  assert.deepEqual(await select('@@ -0,0 +1 @@'), { fallback: 'coverage file has no covering tests: hub/src/example.ts' });
});

test('an old ancestor map selects translated hunks and reports its age, but unmappable hunks still fall back', async t => {
  const { select } = await fixture(t);
  const oldAge = 259200000;
  const selected = await select('@@ -9 +9 @@', '@@ -1,0 +2,2 @@', oldAge);
  assert.ok(!('fallback' in selected));
  assert.deepEqual(selected.tests, ['hub/test/changed.test.ts', 'hub/test/second.test.ts']);
  assert.match(selected.notes.join('; '), /age 259200s.*limit 172800s.*hunks map/);
  assert.deepEqual(await select('@@ -3 +3 @@', '@@ -1,0 +2,2 @@', oldAge), { fallback: 'coverage hunk changed since map: hub/src/example.ts:3' });
  assert.deepEqual(await select('@@ -7 +7 @@', '', oldAge, false), { fallback: 'coverage map has no ancestor of task merge base' });
});
