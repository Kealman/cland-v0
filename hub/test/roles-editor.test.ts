// T1: source-preserving roles edits through the public editor and atomic writer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, open, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse } from 'smol-toml';
import { parseRoles } from '../src/roles/config.ts';
import { CHOSEN, migrateAideTools, projectSetUp, setRoleKey, writeRolesFile } from '../src/roles/editor.ts';
import { setRoleLaunch } from '../src/roles/launch.ts';
import { rolesTemplate } from '../src/roles/template.ts';

test('switching Claude-only roles to Codex writes their sandbox defaults (T-872)', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-role-launch-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'roles.toml');
  const expected = {
    coordinator: 'danger-full-access', lead: 'danger-full-access',
    implementer: 'workspace-write', reviewer: 'read-only', qa: 'danger-full-access', aide: 'workspace-write',
  };
  await writeFile(path, rolesTemplate(['claude-code']));
  const saved: Record<string, unknown> = {};
  const effective: Record<string, unknown> = {};
  for (const role of Object.keys(expected)) {
    await setRoleLaunch(path, role, { harness: 'codex' }, work => work(), () => {}, {});
    const text = await readFile(path, 'utf8');
    saved[role] = (parse(text)[role] as { launch: { sandbox?: string } }).launch.sandbox;
    const launch = parseRoles(text).get(role)!.launch;
    assert.equal(launch.harness, 'codex', role);
    effective[role] = launch.sandbox?.mode;
  }
  assert.deepEqual(saved, expected, 'defaults are written, not inherited from the compatibility parser');
  assert.deepEqual(effective, expected, 'a fresh read uses the saved defaults');
});

test('role harness round trips preserve every explicit sandbox choice (T-872)', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-role-sandbox-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'roles.toml');
  const roles = [...parseRoles(rolesTemplate(['claude-code'])).keys()];
  // T1: exercise every role's launch edits without repeatedly parsing unrelated default clauses and grants.
  const template = roles.map(role => `[${role}.launch]\nharness = "claude-code"\n`).join('');
  for (const mode of ['read-only', 'workspace-write', 'danger-full-access', '']) {
    const setting = `"sandbox" = '${mode}' # explicit choice\n`;
    let text = template;
    for (const role of roles) text = text.replace(`[${role}.launch]\n`, `[${role}.launch]\n${setting}`);
    await writeFile(path, text);
    for (const harness of ['codex', 'claude-code', 'codex']) {
      for (const role of roles) {
        const { result } = await setRoleLaunch(path, role, { harness }, work => work(), () => {}, {});
        assert.equal(result.launch.sandbox?.mode ?? null, mode || null, `${role}/${harness}/${mode}`);
      }
      const saved = await readFile(path, 'utf8');
      assert.equal(saved.split(setting).length - 1, 6, 'explicit keys and comments remain byte-identical');
      for (const role of roles) assert.equal(parseRoles(saved).get(role)!.launch.sandbox?.mode ?? null, mode || null, role);
    }
  }
});

test('project setup requires the chosen harness comment in valid roles TOML', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-project-setup-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.cland'));
  const path = join(root, '.cland', 'roles.toml');
  assert.equal(await projectSetUp(root), false, 'missing roles');
  for (const [text, expected] of [
    ['[aide.launch]\nharness = "codex"\n', false],
    ['[aide.launch]\nharness = "codex" # the human\'s favourite, chosen in cland setup\n', true],
    ['[aide.launch]\nharness = "codex" # the human\'s favourite, chosen in cland setup\nbroken = [\n', false],
    ['[aide.launch]\nharness = 3 # the human\'s favourite, chosen in cland setup\n', false],
    ['[qa.launch]\nharness = "codex" # the human\'s favourite, chosen in cland setup\n', false],
    ['[aide.launch]\n# the human\'s favourite, chosen in cland setup\nharness = "codex"\n', false],
    ['[aide.launch]\nharness = "codex"\nmodel = "gpt-5" # the human\'s favourite, chosen in cland setup\n', false],
    ['[aide]\nclause = \'\'\'\n[aide.launch]\nharness = "codex" # the human\'s favourite, chosen in cland setup\n\'\'\'\n[aide.launch]\nharness = "codex"\n', false],
    ['["aide" . \'launch\']\r\n"harness" = \'codex\'  # the human\'s favourite, chosen in cland setup\r\n', true],
  ] as const) {
    await writeFile(path, text);
    assert.equal(await projectSetUp(root), expected, text);
    assert.equal(await readFile(path, 'utf8'), text, 'the predicate never edits roles');
  }
  await writeFile(path, setRoleKey('[aide.launch]\nharness = "codex"\n', 'aide', 'launch', 'harness', 'claude-code', CHOSEN));
  assert.equal(await projectSetUp(root), true, 'setup can write the exported mark through the editor');
});

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

test('the Aide migration retains multiline grant comments regardless of table order', () => {
  const restriction = '- You cannot ask the human, resolve a topic\'s wait, launch, stop or resume sessions, merge, hand over a role, release, sync or `cland push`: the Coordinator owns those operations.';
  const role = `[aide]\nclause = '''\n${restriction}\n'''\n`;
  const launch = '[aide.launch]\nharness = "codex"\n';
  const permissions = '["aide" . \'permissions\'] # my grants\n"tools" = [\n  "who", # keep ] and # marks\n  "session.stop",\n] # end tools\n';
  for (const text of [role + launch + permissions, permissions + launch + role]) {
    const migration = migrateAideTools(text);
    assert.deepEqual(migration.added, ['session.launch', 'session.resume', 'task.import', 'push']);
    assert.equal(migration.customClause, false);
    assert.ok(migration.text.includes('  "who", # keep ] and # marks\n  "session.stop",\n'));
    assert.ok(migration.text.includes('] # end tools\n'));
    assert.ok(!parseRoles(migration.text).get('aide')!.clause.includes(restriction));
    assert.deepEqual(parseRoles(migration.text).get('aide')!.permissions.tools, ['who', 'session.stop', 'session.launch', 'session.resume', 'task.import', 'push']);
  }
});

test('the Aide migration preserves custom clauses and CRLF bytes', () => {
  const before = '# custom file\r\n[aide]\r\nclause = """\r\n[aide.permissions]\r\n# cland: aide-tools-0.1.4 migrated\r\nMy own restriction.\r\n"""\r\n[aide.launch]\r\nharness = "codex"\r\n[aide.permissions] # real grants\r\ntools = ["who"] # keep\r\n';
  const expected = '# custom file\r\n[aide]\r\nclause = """\r\n[aide.permissions]\r\n# cland: aide-tools-0.1.4 migrated\r\nMy own restriction.\r\n"""\r\n[aide.launch]\r\nharness = "codex"\r\n[aide.permissions] # real grants\r\n# cland: aide-tools-0.1.4 migrated\r\ntools = ["who","session.launch","session.stop","session.resume","task.import","push"] # keep\r\n';
  const migration = migrateAideTools(before);
  assert.equal(migration.text, expected);
  assert.equal(migration.customClause, true);
  assert.equal(migrateAideTools(expected).text, expected);
});
