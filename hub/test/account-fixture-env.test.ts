// T2: fixture admission may use the project socket; no hub or harness process.
// Account defaults belong to the worker, even when its first fixture is a subtest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { clandWithEnv, tempProject } from './harness.ts';

test('account isolation outlives the first test that requests a fixture', async t => {
  const keys = ['HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME', 'CLAUDE_CONFIG_DIR', 'CODEX_HOME'];
  let homes: string[] = [];
  await t.test('first fixture', async first => {
    await tempProject(first);
    for (const key of ['DIGITALOCEAN_TOKEN', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GIT_CONFIG_COUNT', 'GIT_CONFIG_SYSTEM']) assert.ok(!(key in process.env), key);
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

test('CLI child environment rejects poisoned HOME, Git config and credential overlays', async t => {
  const root = await tempProject(t);
  const receipt = join(root, 'sealed');
  const probe = join(root, 'probe.mjs');
  const removed = ['DIGITALOCEAN_TOKEN', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GIT_CONFIG_COUNT', 'GIT_CONFIG_PARAMETERS', 'GIT_CONFIG_SYSTEM', 'SSH_AUTH_SOCK', 'NPM_CONFIG_USERCONFIG', 'npm_config_userconfig'];
  await writeFile(probe, `
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
for (const key of ${JSON.stringify(removed)}) assert.ok(!(key in process.env), key);
assert.ok(process.env.HOME === ${JSON.stringify(process.env.HOME)}, 'HOME');
assert.ok(process.env.GIT_CONFIG_GLOBAL === ${JSON.stringify(process.env.GIT_CONFIG_GLOBAL)}, 'GIT_CONFIG_GLOBAL');
assert.ok(process.env.GIT_CONFIG_NOSYSTEM === '1', 'GIT_CONFIG_NOSYSTEM');
writeFileSync(${JSON.stringify(receipt)}, 'sealed');
`);
  const result = await clandWithEnv(root, {
    ...Object.fromEntries(removed.map(key => [key, 'poison'])),
    HOME: join(root, 'poison-home'), GIT_CONFIG_GLOBAL: join(root, 'poison-gitconfig'), GIT_CONFIG_NOSYSTEM: '0',
    NODE_OPTIONS: `--import=${pathToFileURL(probe).href}`,
  }, '--version');
  assert.equal(result.code, 0, result.stderr);
  assert.equal(await readFile(receipt, 'utf8'), 'sealed', 'observe child receipt after its CLI result');
});
