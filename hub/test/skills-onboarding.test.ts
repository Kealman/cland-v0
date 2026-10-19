// T1 source assertions; T2 Aide settings CLI cases run against an in-process hub with fake adapters.
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import * as usage from '../src/cli/usage.ts';
import { configKeys } from '../src/init/config-set.ts';
import { defaultConfig, parseConfig, renderConfig } from '../src/init/config.ts';
import type { CrewConfig } from '../src/crew.ts';
import { rolesTemplate } from '../src/roles/template.ts';
import { clandWithEnv, connectUi, projectHub, tempProject } from './harness.ts';

const SKILL = new URL('../../.agents/skills/onboarding/', import.meta.url);
const FILES = ['SKILL.md', 'EMPTY.md', 'EXISTING.md', 'WELCOME.md', 'TOUR.md'];
// Open v0.1.4 work owns these commands. A shipped command makes its exception fail.
const PENDING: Record<string, string> = {};
const HELP = Object.values(usage).join('\n');
const COMMANDS = new Set<string>();
for (const line of HELP.split('\n')) {
  const match = /^  ([a-z][a-z-]*)(?: ([a-z][a-z-]*))?(?=\s|$)/.exec(line);
  if (!match) continue;
  COMMANDS.add(match[1]!);
  if (match[2]) COMMANDS.add(`${match[1]} ${match[2]}`);
}

function commandProblems(markdown: string): string[] {
  const problems: string[] = [];
  const keys = configKeys();
  for (const span of markdown.matchAll(/`([^`]+)`/g)) {
    const command = /^cland\s+([a-z][a-z-]*)(?:\s+([a-z][a-z-]*))?(?=\s|$)/.exec(span[1]!);
    if (!command) continue;
    const name = command[2] ? `${command[1]} ${command[2]}` : command[1]!;
    if (!COMMANDS.has(name) && !Object.hasOwn(PENDING, name)) problems.push(`unknown command: cland ${name}`);
    const config = /^cland\s+config\s+set\s+([^\s`]+)/.exec(span[1]!);
    if (config && !keys.includes(config[1]!)) problems.push(`unknown config key: ${config[1]}`);
  }
  return problems;
}

test('onboarding names only shipped commands or explicitly pending release work', async () => {
  for (const [command, item] of Object.entries(PENDING)) {
    assert.ok(!COMMANDS.has(command), `${item}: cland ${command} now ships; remove its pending entry`);
  }
  for (const file of FILES) {
    const markdown = await readFile(new URL(file, SKILL), 'utf8');
    assert.deepEqual(commandProblems(markdown), [], file);
  }
});

test('the onboarding command check rejects unknown commands and config keys', () => {
  assert.deepEqual(commandProblems('`cland crew add` and `cland nonexistent`'), [
    'unknown command: cland crew add', 'unknown command: cland nonexistent',
  ]);
  assert.deepEqual(commandProblems('`cland config set plan.approval "human"`'), []);
  assert.deepEqual(commandProblems('`cland config set plan.unknown "human"`'), ['unknown config key: plan.unknown']);
});

// T1: every shipped skill file is stack-neutral without a hub or CLI process.
test('onboarding verification instructions are independent of npm', async () => {
  for (const file of await readdir(SKILL, { recursive: true, withFileTypes: true })) {
    if (!file.isFile()) continue;
    const markdown = await readFile(join(file.parentPath, file.name), 'utf8');
    assert.doesNotMatch(markdown, /\bnpm\b|\bpretypecheck\b/i, file.name);
  }
});

// T1: source guidance uses the shipped settings commands instead of file edits.
test('onboarding records crew settings through commands', async () => {
  const markdown = await readFile(new URL('SKILL.md', SKILL), 'utf8');
  const crew = markdown.split('## 5. The crew')[1]!.split('## 6.')[0]!;
  assert.ok(crew.includes('cland crew set <key> <value>'));
  assert.ok(crew.includes('cland role launch <role>'));
  for (const file of await readdir(SKILL, { recursive: true, withFileTypes: true })) {
    if (!file.isFile()) continue;
    const text = await readFile(join(file.parentPath, file.name), 'utf8');
    assert.doesNotMatch(text, /\b(?:edit|write|change|update)\b[^\n]*(?:roles|crew)\.toml/i, file.name);
  }
});

test('the onboarding Aide sets human epic plan approval through the config CLI', async t => {
  const root = await tempProject(t);
  const path = join(root, '.cland/config.toml');
  const config = defaultConfig('Onboarding');
  config.verification.lockPath = join(root, 'suite.lock');
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(path, renderConfig(config));
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'role.set', session: 'onboarding-aide', role: 'aide' })).ok, true);
  assert.equal(parseConfig(await readFile(path, 'utf8'), root).plan.approval, 'none');

  const result = await clandWithEnv(root, { CLAND_SESSION_NAME: 'onboarding-aide' },
    'config', 'set', 'plan.approval', 'human', '--json');

  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { key: 'plan.approval', value: 'human', applies: 'now' });
  assert.equal(parseConfig(await readFile(path, 'utf8'), root).plan.approval, 'human');
});

test('the onboarding Aide records the stack verification commands verbatim through the config CLI', async t => {
  const root = await tempProject(t);
  const path = join(root, '.cland/config.toml');
  const config = defaultConfig('Onboarding');
  config.verification.lockPath = join(root, 'suite.lock');
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(path, renderConfig(config));
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'role.set', session: 'onboarding-aide', role: 'aide' })).ok, true);

  for (const [key, value] of [
    ['test', 'python3 -m unittest'],
    ['check', 'python3 -m compileall -q .'],
    ['prepare', 'true'],
  ] as const) {
    const result = await clandWithEnv(root, { CLAND_SESSION_NAME: 'onboarding-aide' },
      'config', 'set', `verification.${key}`, value, '--json');
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { key: `verification.${key}`, value, applies: 'now' });
    assert.equal(parseConfig(await readFile(path, 'utf8'), root).verification[key], value);
  }
});

// T2: the CLI is the subject; projectHub supplies the hub and in-process fake harnesses.
test('the onboarding Aide records staffing through the crew CLI', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'role.set', session: 'onboarding-aide', role: 'aide' })).ok, true);
  const env = { CLAND_SESSION_NAME: 'onboarding-aide' };
  // Start away from the recommended values so the readback proves each change.
  for (const [key, value] of [['reviewer.size', 2], ['leads', ['epic']], ['aide.subagents', false]] as const) {
    assert.equal((await ui.request({ type: 'crew.set', key, value })).ok, true);
  }
  for (const [key, value] of [['reviewer.size', '1'], ['leads', '[]'], ['aide.subagents', 'true']]) {
    const result = await clandWithEnv(root, env, 'crew', 'set', key!, value!);
    assert.equal(result.code, 0, result.stderr);
  }
  const show = await clandWithEnv(root, env, 'crew', 'show', '--json');
  assert.equal(show.code, 0, show.stderr);
  const { config } = JSON.parse(show.stdout) as { config: CrewConfig };
  assert.equal(config.crew.reviewer!.size, 1);
  assert.deepEqual(config.leads, []);
  assert.equal(config.crew.aide!.subagents, true);
});

test('the onboarding Aide records launch fields through the role CLI', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/roles.toml'), rolesTemplate(['claude-code']));
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'role.set', session: 'onboarding-aide', role: 'aide' })).ok, true);
  const env = { CLAND_SESSION_NAME: 'onboarding-aide' };
  for (const args of [
    ['implementer', '--harness', 'codex', '--model', '', '--effort', 'high'],
    ['coordinator', '--permissions', 'skip'],
  ]) {
    const result = await clandWithEnv(root, env, 'role', 'launch', ...args);
    assert.equal(result.code, 0, result.stderr);
  }
  const list = await clandWithEnv(root, env, 'role', 'list');
  assert.equal(list.code, 0, list.stderr);
  assert.match(list.stdout, /Implementer.*launch:.*codex.*model harness default.*effort high/);
  assert.match(list.stdout, /Coordinator.*launch:.*permissions skip/);
});

test('the onboarding Aide own launch change returns the next-launch note', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'role.set', session: 'onboarding-aide', role: 'aide' })).ok, true);
  const result = await clandWithEnv(root, { CLAND_SESSION_NAME: 'onboarding-aide' },
    'role', 'launch', 'aide', '--permissions', 'skip');
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /applies from the role's next launch; your own session keeps its settings until its next launch/);
});
