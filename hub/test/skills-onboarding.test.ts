// T1 source assertions; T2 Aide settings CLI cases run against an in-process hub with fake adapters.
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import * as usage from '../src/cli/usage.ts';
import { configKeys } from '../src/init/config-set.ts';
import { defaultConfig, parseConfig, renderConfig } from '../src/init/config.ts';
import type { CrewConfig } from '../src/crew.ts';
import { rolesTemplate } from '../src/roles/template.ts';
import { SECRET_NAMES } from '../src/remote/secrets.ts';
import type { HarnessProcessView } from '../src/protocol.ts';
import type { ItemSummary, ItemView } from '../src/tracker/tracker.ts';
import { clandWithEnv, connectUi, inProcessSpoke, projectHub, tempProject } from './harness.ts';
import { FakeClock } from './fake-clock.ts';

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
    const secret = /^cland\s+secret\s+(?:set|unset)\s+(\S+)/.exec(span[1]!)?.[1]
      ?? /^(?:telegram|discord|speech)\.[a-z_]+$/.exec(span[1]!)?.[0];
    if (secret && !(SECRET_NAMES as readonly string[]).includes(secret)) problems.push(`unknown secret name: ${secret}`);
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

test('the onboarding command check rejects unknown commands, config keys and secret names', () => {
  assert.deepEqual(commandProblems('`cland crew add` and `cland nonexistent`'), [
    'unknown command: cland crew add', 'unknown command: cland nonexistent',
  ]);
  assert.deepEqual(commandProblems('`cland config set plan.approval "human"`'), []);
  assert.deepEqual(commandProblems('`cland config set plan.unknown "human"`'), ['unknown config key: plan.unknown']);
  assert.deepEqual(commandProblems('`cland remote status` and `cland secret list` and `telegram.token`'), []);
  assert.deepEqual(commandProblems('`cland secret set telegram.token` and `cland secret unset speech.elevenlabs_key`'), []);
  assert.deepEqual(commandProblems('`cland secret set telegram.unknown`'), ['unknown secret name: telegram.unknown']);
  assert.deepEqual(commandProblems('`cland secret unset nonexistent`'), ['unknown secret name: nonexistent']);
  assert.deepEqual(commandProblems('Setup stores `telegram.tokne` or `speech.unknown_key`.'), [
    'unknown secret name: telegram.tokne', 'unknown secret name: speech.unknown_key',
  ]);
});

// T1: every shipped skill file is stack-neutral without a hub or CLI process.
test('onboarding verification instructions are independent of npm', async () => {
  for (const file of await readdir(SKILL, { recursive: true, withFileTypes: true })) {
    if (!file.isFile()) continue;
    const markdown = await readFile(join(file.parentPath, file.name), 'utf8');
    assert.doesNotMatch(markdown, /\bnpm\b|\bpretypecheck\b/i, file.name);
  }
});

// T1: the tour's stage structure is source-only, without a hub or CLI process.
test('the onboarding tour has nine stages ending with Look now', async () => {
  const markdown = await readFile(new URL('TOUR.md', SKILL), 'utf8');
  const stages = markdown.split(/^## /m).slice(1);
  assert.equal(stages.length, 9);
  assert.match(stages[8]!, /^9\. Remote control\n/);
  assert.match(stages[8]!, /^Look now: the Remotes row in the sessions panel\./m);
  const skill = await readFile(new URL('SKILL.md', SKILL), 'utf8');
  assert.match(skill, /nine stages/);
  for (const [index, stage] of stages.entries()) {
    assert.match(stage, new RegExp(`^${index + 1}\\. `));
    const paragraphs = stage.trim().split(/\n\s*\n/);
    assert.match(paragraphs.at(-1)!, /^Look now: /);
    assert.equal((stage.match(/^Look now: /gm) ?? []).length, 1);
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

// T1: the start/import instructions preserve the human's files and ask for decisions.
test('onboarding stages explicit files and performs start and import without human keystrokes', async () => {
  const markdown = await readFile(new URL('SKILL.md', SKILL), 'utf8');
  const start = markdown.split('## 7. The start')[1]!.split('## 8.')[0]!;
  assert.match(start, /stage only/i);
  assert.match(start, /skip the commit when nothing is staged/i);
  for (const file of await readdir(SKILL, { recursive: true, withFileTypes: true })) {
    if (!file.isFile()) continue;
    const text = await readFile(join(file.parentPath, file.name), 'utf8');
    assert.doesNotMatch(text, /git add\s+(?:-A\b|\.(?=\s|`|$))/, file.name);
    assert.doesNotMatch(text, /pasted? into a terminal|space then l|brief pasted|give the exact step when they agree/i, file.name);
  }
});

// Own-spoke readiness provisions the real file; CLI calls below stay tokenless.
async function aideShell(t: import('node:test').TestContext, root: string) {
  const aide = await inProcessSpoke(t, { cwd: root, discover: true, name: 'onboarding-aide', role: 'aide', sessionId: 'onboarding-aide-id' });
  await aide.call('who');
  return { CLAND_SESSION_NAME: 'onboarding-aide', CLAND_SESSION_ID: 'onboarding-aide-id' };
}

test('the onboarding Aide sets human epic plan approval through the config CLI', async t => {
  const root = await tempProject(t);
  const path = join(root, '.cland/config.toml');
  const config = defaultConfig('Onboarding');
  config.verification.lockPath = join(root, 'suite.lock');
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(path, renderConfig(config));
  await projectHub(t, root);
  const env = await aideShell(t, root);
  assert.equal(parseConfig(await readFile(path, 'utf8'), root).plan.approval, 'none');

  const result = await clandWithEnv(root, env,
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
  await projectHub(t, root);
  const env = await aideShell(t, root);

  for (const [key, value] of [
    ['test', 'python3 -m unittest'],
    ['check', 'python3 -m compileall -q .'],
    ['prepare', 'true'],
  ] as const) {
    const result = await clandWithEnv(root, env,
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
  const env = await aideShell(t, root);
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
  await projectHub(t, root);
  const env = await aideShell(t, root);
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
  await projectHub(t, root);
  const env = await aideShell(t, root);
  const result = await clandWithEnv(root, env,
    'role', 'launch', 'aide', '--permissions', 'skip');
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /applies from the role's next launch; your own session keeps its settings until its next launch/);
});

// T2: the launch CLI uses a fake adapter, with no hub or harness process.
test('the onboarding Aide launches the Coordinator with the first release brief through its own shell', async t => {
  const root = await tempProject(t);
  const { discovery, fakes } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const aide = await inProcessSpoke(t, { cwd: root, discover: true, name: 'onboarding-aide', role: 'aide', sessionId: 'aide-id' });
  await aide.waitForPresence(['onboarding-aide']);
  const result = await clandWithEnv(root, { CLAND_SESSION_NAME: 'onboarding-aide', CLAND_SESSION_ID: 'aide-id' },
    'session', 'launch', 'coord', '--role', 'coordinator', '--brief', 'Work release R-1');
  assert.equal(result.code, 0, result.stderr);
  const ui = await connectUi(t, discovery);
  const listed = await ui.request({ type: 'session.list' });
  assert.equal(listed.ok, true, listed.error);
  const coord = (listed.value as { processes: HarnessProcessView[] }).processes.find(row => row.name === 'coord');
  assert.ok(coord);
  assert.equal(coord.role, 'coordinator');
  assert.equal(coord.status, 'running');
  const spawn = fakes['claude-code']!.spawns.find(row => row.name === 'coord');
  assert.ok(spawn);
  assert.equal(spawn.role, 'coordinator');
  assert.match(spawn.brief!.text, /(?:^|\n)Work release R-1(?:\n|$)/);
});

// T2: the documented import/link/edit CLI flow is the subject; GitHub is a fake gh boundary.
test('the onboarding Aide plans imported open GitHub issues in its first release', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.git/objects'), { recursive: true });
  await mkdir(join(root, '.git/refs'));
  await writeFile(join(root, '.git/HEAD'), 'ref: refs/heads/dev\n');
  await writeFile(join(root, '.git/config'), [
    '[core]\nrepositoryformatversion = 0\nbare = false',
    '[remote "github"]\nurl = git@github.com:acme/widgets.git',
    `[remote "origin"]\nurl = ${join(root, '.cland/territory.git')}`,
  ].join('\n'));
  const issue = (number: number, state: string) => ({
    number, state, title: `Issue ${number}`, body: '', labels: [], comments: 0,
    html_url: `https://github.com/acme/widgets/issues/${number}`, created_at: '2026-01-01T00:00:00Z',
  });
  const open = [issue(10, 'open'), issue(11, 'open')];
  const pull = { ...issue(13, 'open'), pull_request: { url: 'https://api.github.com/repos/acme/widgets/pulls/13' } };
  const fixture = join(root, 'github.json');
  const log = join(root, 'gh.log');
  await writeFile(fixture, JSON.stringify({
    'repos/acme/widgets/issues?state=open&per_page=100': [...open, pull],
    'repos/acme/widgets/issues?state=all&per_page=100': [...open, issue(12, 'closed'), pull],
  }));
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await connectUi(t, discovery);
  const env = await aideShell(t, root);
  const release = await ui.request({ type: 'task.create', kind: 'release', title: 'What next' });
  assert.equal(release.ok, true, release.error);
  assert.equal((release.value as { item: { id: string } }).item.id, 'R-1');
  const importEnv = {
    ...env,
    PATH: [fileURLToPath(new URL('./fixtures/fake-gh/', import.meta.url)), dirname(process.execPath), process.env.PATH ?? ''].join(':'),
    FAKE_GH_FIXTURE: fixture, FAKE_GH_LOG: log,
  };
  const run = async (...args: string[]) => {
    const result = await clandWithEnv(root, importEnv, 'task', ...args);
    assert.equal(result.code, 0, result.stderr);
    return result.stdout;
  };

  const imported = await run('import-github');
  assert.match(imported, /open issues\): 2 issues, 1 pull request skipped/);
  const first = /\b(T-\d+)\s+#10\s+created\s+Issue 10/.exec(imported)?.[1];
  const second = /\b(T-\d+)\s+#11\s+created\s+Issue 11/.exec(imported)?.[1];
  assert.ok(first, imported);
  assert.ok(second, imported);
  assert.notEqual(first, second);
  const listed = JSON.parse(await run('list', '--state', 'open', '--json')) as { items: ItemSummary[] };
  const issues = listed.items.filter(item => item.kind === 'task');
  assert.deepEqual(issues.map(item => [item.id, item.title]).sort((a, b) => a[1]!.localeCompare(b[1]!)), [[first, 'Issue 10'], [second, 'Issue 11']]);
  assert.ok(issues.every(item => item.size == null && item.parent === null));
  const all = await ui.request({ type: 'task.list' });
  assert.equal(all.ok, true, all.error);
  assert.equal((all.value as { items: ItemSummary[] }).items.length, 3, 'only the release and two open issues exist');
  const calls = await readFile(log, 'utf8');
  assert.match(calls, /issues\?state=open&per_page=100/);
  assert.doesNotMatch(calls, /state=all|\/issues\/12/);

  await run('link', first, '--parent', 'R-1');
  await run('edit', first, '--size', 'S', '--status', 'planned');
  const view = await ui.request({ type: 'task.view', item: first });
  assert.equal(view.ok, true, view.error);
  const item = (view.value as { item: ItemView }).item;
  assert.equal(item.github?.number, 10);
  assert.equal(item.parent, 'R-1');
  assert.equal(item.size, 'S');
  assert.equal(item.status, 'planned');
});

// T1: the remote tour's speech instructions use shipped commands.
test('remote tour explains voice notes and the hidden speech key command', async () => {
  const tour = (await readFile(new URL('TOUR.md', SKILL), 'utf8')).split('## 9. Remote control')[1]!;
  assert.ok(tour.includes('cland secret set speech.elevenlabs_key'));
  assert.match(tour, /voice note/i);
  assert.deepEqual(commandProblems(tour), []);
});

test('remote tour includes Discord setup and local approval with shipped commands', async () => {
  const tour = await readFile(new URL('TOUR.md', SKILL), 'utf8');
  for (const text of ['Discord', '/cland pair', 'discord.token', 'Public Bot', 'Message Content', 'Interactions Endpoint URL']) assert.ok(tour.includes(text), `tour includes ${text}`);
  assert.deepEqual(commandProblems(tour), []);
});
