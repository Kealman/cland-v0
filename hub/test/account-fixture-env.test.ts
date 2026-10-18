// T2: fixture admission may use the project socket; no hub or harness process.
// Account defaults belong to the worker, even when its first fixture is a subtest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { tempProject } from './harness.ts';

test('account isolation outlives the first test that requests a fixture', async t => {
  const keys = ['XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'CLAUDE_CONFIG_DIR', 'CODEX_HOME'];
  let homes: string[] = [];
  await t.test('first fixture', async first => {
    await tempProject(first);
    homes = keys.map(key => {
      assert.ok(process.env[key], `${key} must have a fixture default`);
      return process.env[key]!;
    });
  });
  await t.test('later fixture', async later => {
    await tempProject(later);
    for (const [index, key] of keys.entries()) {
      assert.ok(process.env[key] === homes[index], `${key} must retain the same worker default`);
      assert.ok((await stat(homes[index]!)).isDirectory(), `${key} must survive the first fixture's cleanup`);
    }
  });
});
