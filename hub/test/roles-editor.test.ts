import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, open, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseRoles } from '../src/roles/config.ts';
import { setRoleKey, writeRolesFile } from '../src/roles/editor.ts';

test('setting a launch key replaces only its value and preserves the human file bytes', () => {
  const before = '# human file\r\n[aide.launch] # launch\r\n  model  =  "old#model"  # keep me\r\nharness = "codex"\r\neffort = "high"\r\n\r\n[reviewer.launch]\r\nharness = "codex"';
  const expected = '# human file\r\n[aide.launch] # launch\r\n  model  =  "new\\\"model"  # keep me\r\nharness = "codex"\r\neffort = "high"\r\n\r\n[reviewer.launch]\r\nharness = "codex"';
  assert.equal(setRoleKey(before, 'aide', 'launch', 'model', 'new"model'), expected);
});

test('a launch value can be cleared and its trailing comment explicitly replaced or removed', () => {
  const before = '[aide.launch]\nharness = "codex"\nmodel = "old" # old comment\n';
  assert.equal(setRoleKey(before, 'aide', 'launch', 'model', '', "the human's choice"), '[aide.launch]\nharness = "codex"\nmodel = "" # the human\'s choice\n');
  assert.equal(setRoleKey(before, 'aide', 'launch', 'model', '', ''), '[aide.launch]\nharness = "codex"\nmodel = ""\n');
});

test('a missing key is inserted inside its table and a missing launch table follows the role tables', () => {
  const before = '# settings\n[aide.launch]\nharness = "codex"\n[qa.launch]\nharness = "codex"\n';
  assert.equal(setRoleKey(before, 'aide', 'launch', 'model', 'new'), '# settings\n[aide.launch]\nharness = "codex"\nmodel = "new"\n[qa.launch]\nharness = "codex"\n');
  const missing = '[aide]\nclause = "own clause"\n[aide.permissions]\ntools = ["send"]\n[qa.launch]\nharness = "codex"\n';
  assert.equal(setRoleKey(missing, 'aide', 'launch', 'harness', 'codex'), '[aide]\nclause = "own clause"\n[aide.permissions]\ntools = ["send"]\n[aide.launch]\nharness = "codex"\n[qa.launch]\nharness = "codex"\n');
});

test('bracketed lines in basic and literal multiline clauses never become headers or settings', () => {
  for (const quote of ['"""', "'''"]) {
    const clause = `[aide]\nclause = ${quote}\n[aide.launch]\nmodel = "clause content"\n[qa.permissions] # still clause content\n${quote}\n`;
    const launch = '[aide.launch]\nharness = "codex"\nmodel = "old"\n';
    assert.equal(setRoleKey(clause + launch, 'aide', 'launch', 'model', 'new'), clause + '[aide.launch]\nharness = "codex"\nmodel = "new"\n');
    assert.equal(setRoleKey(clause, 'aide', 'launch', 'harness', 'codex'), clause + '[aide.launch]\nharness = "codex"\n');
  }
});

test('tools gains grants in caller order and replaces the complete multiline value', () => {
  const before = '[aide.launch]\nharness = "codex"\n[aide.permissions]\ntools = [\n  "send", # old grant\n  "who",\n] # keep comment\n';
  const after = setRoleKey(before, 'aide', 'permissions', 'tools', ['send', 'who', 'session.launch']);
  assert.equal(after, '[aide.launch]\nharness = "codex"\n[aide.permissions]\ntools = ["send","who","session.launch"] # keep comment\n');
  assert.deepEqual(parseRoles(after).get('aide')?.permissions.tools, ['send', 'who', 'session.launch']);
});

test('invalid harnesses and grants return the key-specific roles parser error', () => {
  const before = '[aide.launch]\nharness = "codex"\n';
  assert.throws(() => setRoleKey(before, 'aide', 'launch', 'harness', 'unknown'), { message: 'aide.launch.harness must be one of claude-code, codex, opencode' });
  assert.throws(() => setRoleKey(before, 'aide', 'permissions', 'tools', ['not-a-tool']), /aide\.permissions\.tools/);
  const custom = '[aide.launch]\nharness = "test"\n';
  assert.equal(parseRoles(custom).get('aide')?.launch.harness, 'test', 'ordinary parser callers retain custom adapters');
  assert.equal(parseRoles(custom, null, ['test']).get('aide')?.launch.harness, 'test');
  assert.throws(() => parseRoles(custom, null, ['codex']), { message: 'aide.launch.harness must be one of codex' });
});

test('quoted table and setting names, escaped quotes and brackets in comments are preserved', () => {
  const before = '# [qa.launch]\n["aide" . \'launch\'] # table\nharness = "codex"\n"model" = "old\\\"#still-string" # original\neffort = \'high\'';
  assert.equal(setRoleKey(before, 'aide', 'launch', 'model', 'new'), '# [qa.launch]\n["aide" . \'launch\'] # table\nharness = "codex"\n"model" = "new" # original\neffort = \'high\'');
  assert.equal(setRoleKey('[qa.launch]\nharness = "codex"', 'qa', 'launch', 'effort', ''), '[qa.launch]\nharness = "codex"\neffort = ""\n');
  assert.equal(setRoleKey('', 'aide', 'launch', 'harness', 'codex'), '[aide.launch]\nharness = "codex"\n');
});

test('the writer atomically replaces the file and refuses a change made after its caller read it', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-roles-editor-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'roles.toml');
  const original = '[aide.launch]\nharness = "codex"\nmodel = "old"\n';
  await writeFile(path, original);
  const held = await open(path, 'r');
  t.after(() => held.close());
  const next = setRoleKey(await readFile(path, 'utf8'), 'aide', 'launch', 'model', 'new');
  await writeRolesFile(path, original, next);
  assert.equal(await readFile(path, 'utf8'), '[aide.launch]\nharness = "codex"\nmodel = "new"\n');
  assert.equal(await held.readFile('utf8'), original, 'a reader with the old inode sees the complete old file');
  const newer = '# edited by the human\n' + next;
  await writeFile(path, newer);
  await assert.rejects(writeRolesFile(path, next, original), { message: 'roles.toml changed while setting it; retry' });
  assert.equal(await readFile(path, 'utf8'), newer);
  assert.deepEqual(await readdir(root), ['roles.toml'], 'no temporary files survive either outcome');
  await assert.rejects(writeRolesFile(path, newer, '[aide.launch]\nharness = "unknown"\n'), /aide\.launch\.harness/);
  assert.equal(await readFile(path, 'utf8'), newer, 'invalid candidates never reach the human file');
});
