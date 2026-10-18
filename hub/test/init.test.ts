// T3: native Git repositories prove init/update provisioning and committed-tree boundaries.
// Three CLI runs keep the committed-set, idempotent text and old-version contracts.
// Process races, shell hooks and the real Claude binary contract live in init-process.test.ts.
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, lstat, mkdir, readdir, readFile, readlink, rm, symlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { HOOK_EVENTS } from '../src/adapters/claude-code.ts';
import { runUpdate } from '../src/cli/init.ts';
import { checkProject } from '../src/doctor/project.ts';
import { provision } from '../src/init/provision.ts';
import { clandWithEnv, connectUi, projectHub, tempProject } from './harness.ts';
import { captureCli } from './cli-in-process.ts';
import { FakeClock } from './fake-clock.ts';
import { REPO, VERSION, run, runCli, gitRepo, gitStatus, tree, changed, shipped, sh, assertNoMachinePath } from './init-fixture.ts';

test('init writes tracker levels and update preserves a changed or empty ladder', async t => {
  const root = await tempProject(t);
  await gitRepo(root);
  await run(root, 'init');
  const rulePath = join(root, '.cland/RULES.md');
  const customRules = '# Project rules\n\nHuman-owned content.\n';
  await writeFile(rulePath, customRules);
  const crewPath = join(root, '.cland/crew.toml');
  const crew = await readFile(crewPath, 'utf8');
  assert.match(crew, /leads = \[\]/);
  assert.match(crew, /\[crew.coordinator\][\s\S]*?^heartbeat = "1h"$/m);
  assert.match(crew, /\[crew.reviewer\][\s\S]*?size = 1[\s\S]*?keep_context = true/);
  const customCrew = crew.replace('size = 1', 'size = 2');
  await writeFile(crewPath, customCrew);
  await run(root, 'init');
  await run(root, 'update');
  assert.equal(await readFile(rulePath, 'utf8'), customRules);
  assert.equal(await readFile(crewPath, 'utf8'), customCrew, 'init and update preserve project staffing');
  const path = join(root, '.cland/config.toml');
  const initial = await readFile(path, 'utf8');
  assert.match(initial, /\[tracker\]\nlevels = \[\["release","category"\],"epic"\]/);
  await writeFile(path, initial.replace(/levels = \[[^\n]*\]/, 'levels = ["release", "epic"]'));
  const upgraded = await run(root, 'update');
  assert.ok(upgraded.some(change => change.note?.includes('old default rewritten')));
  assert.match(await readFile(path, 'utf8'), /levels = \[\["release","category"\],"epic"\]/);
  for (const levels of ['["initiative", "feature"]', '[]']) {
    await writeFile(path, initial.replace(/levels = \[[^\n]*\]/, `levels = ${levels}`));
    const kept = await run(root, 'update');
    assert.ok(kept.some(change => change.note === `tracker levels kept: ${levels.replace(/ /g, '')}`));
    const changed = await readFile(path, 'utf8');
    assert.match(changed, new RegExp(`\\[tracker\\]\\nlevels = ${levels.replace(/ /g, '').replace(/[\[\]]/g, '\\$&')}`));
    await run(root, 'update');
    assert.equal(await readFile(path, 'utf8'), changed, 'a second update is idempotent');
  }
});

test('init adds qa_default and update keeps a configured QA policy', async t => {
  const root = await tempProject(t);
  await gitRepo(root);
  await run(root, 'init');
  const path = join(root, '.cland/config.toml');
  const initial = await readFile(path, 'utf8');
  assert.match(initial, /approval = "none"/);
  assert.match(initial, /qa_default = \{ scope = "none", when = "per-item" \}/);
  await writeFile(path, initial.replace('scope = "none", when = "per-item"', 'scope = "full", when = "after-stage"').replace('approval = "none"', 'approval = "human"'));
  await run(root, 'update');
  const updated = await readFile(path, 'utf8');
  assert.match(updated, /approval = "human"/);
  assert.match(updated, /qa_default = \{ scope = "full", when = "after-stage" \}/);
  await run(root, 'update');
  assert.equal(await readFile(path, 'utf8'), updated);
});

test('cland init provisions exactly the 20 curated skills in its manifest and folders', async t => {
  const root = await tempProject(t, 'cland-init-curated-');
  await gitRepo(root);
  await run(root, 'init');
  const expected = [
    'code-review', 'codebase-design', 'diagnosing-bugs', 'domain-modeling', 'grilling',
    'handover', 'implement', 'merge', 'plan-epic', 'prototype', 'qa', 'release',
    'research', 'retro', 'tdd', 'to-spec', 'to-tickets', 'triage', 'wayfinder', 'writing-for-agents',
  ];
  const skills = join(root, '.agents', 'skills');
  const manifest = JSON.parse(await readFile(join(skills, '.cland-manifest.json'), 'utf8')) as { skills: Record<string, Record<string, string>> };
  assert.deepEqual(Object.keys(manifest.skills).sort(), expected);
  assert.deepEqual((await readdir(skills)).filter(name => name !== '.cland-manifest.json').sort(), expected);
  for (const name of expected) await lstat(join(skills, name, 'SKILL.md'));
  // The init contract also compares every manifest entry with the installed bytes,
  // including nested supporting files, rather than only sampling SKILL.md.
  const installed = await tree(skills);
  installed.delete('.cland-manifest.json');
  const recorded = new Map(Object.entries(manifest.skills).flatMap(([name, files]) =>
    Object.entries(files).map(([rel, hash]) => [`${name}/${rel}`, hash] as const)));
  assert.deepEqual(recorded, installed);
});

test('cland init on an empty repository: git status shows exactly the committed set, with no machine path in it', async (t) => {
  const root = await tempProject(t, 'cland-init-');
  await gitRepo(root);
  const configHome = join(root, 'user-config');
  // CLI contract: argv, JSON output and git status of the committed set.
  const changes = await runCli(root, 'init', { XDG_CONFIG_HOME: configHome });
  assert.equal(await readFile(join(root, '.cland/RULES.md'), 'utf8'), '# Project rules\n<!-- cland: rule high-water 0 -->\n');
  assert.match(await readFile(join(root, '.cland/.gitignore'), 'utf8'), /committed.*RULES\.md|RULES\.md.*are/);
  const roles = await readFile(join(root, '.cland', 'roles.toml'), 'utf8');
  assert.match(roles, /account = "<name>" from ~\/\.config\/cland\/accounts\.toml: one name, never a list/);
  assert.match(roles, /"" or absent uses the harness default/);
  assert.match(roles, /cland init writes no accounts\.toml/);
  for (const role of ['coordinator', 'lead', 'implementer', 'reviewer', 'qa', 'aide']) {
    const table = roles.split(`[${role}.launch]\n`)[1]?.split('\n[')[0];
    assert.ok(table, `${role}: launch defaults are written`);
    assert.match(table, /^# account = ""$/m, role);
  }
  await assert.rejects(lstat(join(configHome, 'cland', 'accounts.toml')), { code: 'ENOENT' });
  await assert.rejects(lstat(join(root, '.cland', 'accounts.toml')), { code: 'ENOENT' });
  assert.ok((await readFile(join(root, '.cland', '.gitignore'), 'utf8')).split('\n').includes('ui.json'));
  assert.ok((await readFile(join(root, '.cland', '.gitignore'), 'utf8')).split('\n').includes('ui.json.lock*'));
  assert.match(await readFile(join(root, '.cland/config.toml'), 'utf8'), /^\[artifacts\]\nretention_days = 30$/m);
  assert.ok(changes.every((c) => c.action === 'created' || c.path === '.cland/hub.db' || c.path.startsWith('.cland/territory.git')), JSON.stringify(changes.filter((c) => c.action !== 'created')));

  const { files: skillFiles } = await shipped();
  const expected = [
    '.agents/skills/.cland-manifest.json',
    ...skillFiles,
    '.claude/settings.json',
    '.claude/skills',
    '.cland/.gitignore',
    '.cland/config.toml',
    '.cland/crew.toml',
    '.cland/roles.toml',
    '.cland/RULES.md',
    '.cland/tasks/.gitkeep',
    'AGENTS.md',
    'docs/agents/domain.md',
    'docs/agents/issue-tracker.md',
    'docs/agents/triage-labels.md',
  ].sort();
  assert.deepEqual(await gitStatus(root), expected);
  assert.ok(skillFiles.length > 30, 'the vendored skills are installed');
  // no CLAUDE.md: it would stop Claude Code from reading AGENTS.md
  await assert.rejects(lstat(join(root, 'CLAUDE.md')));
  // the hub's volatile state is there (the topics) but ignored
  await lstat(join(root, '.cland', 'hub.db'));

  // .claude/skills is a relative symlink to the canonical folder
  assert.equal((await lstat(join(root, '.claude', 'skills'))).isSymbolicLink(), true);
  assert.equal(await readlink(join(root, '.claude', 'skills')), '../.agents/skills');
  await lstat(join(root, '.claude', 'skills', 'tdd', 'SKILL.md'));

  // every managed file or block names the version that wrote it; the vendored skill files carry no mark of their
  // own (upstream's text, byte for byte): the manifest's mark, checked here, covers every file it lists
  for (const f of ['.cland/.gitignore', '.cland/config.toml', '.cland/roles.toml', '.cland/tasks/.gitkeep', 'AGENTS.md', 'docs/agents/domain.md', 'docs/agents/issue-tracker.md', 'docs/agents/triage-labels.md', '.agents/skills/.cland-manifest.json']) {
    assert.match(await readFile(join(root, f), 'utf8'), new RegExp(`managed by cland ${VERSION.replace(/\./g, '\\.')}`), f);
  }
  const settings = JSON.parse(await readFile(join(root, '.claude', 'settings.json'), 'utf8')) as { hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>> };
  assert.deepEqual(Object.keys(settings.hooks).sort(), Object.keys(HOOK_EVENTS).sort());
  for (const [hookEvent, event] of Object.entries(HOOK_EVENTS)) {
    const [entry] = settings.hooks[hookEvent] ?? [];
    assert.match(entry?.hooks[0]?.command ?? '', new RegExp(`\\|\\| cland hook ${event} # managed by cland ${VERSION.replace(/\./g, '\\.')}$`));
  }
  const agents = await readFile(join(root, 'AGENTS.md'), 'utf8');
  assert.match(agents, /^<!-- cland:begin managed by cland [^\n]*-->\n## cland\n/);
  assert.match(agents, /<!-- cland:end -->\n$/);
  for (const rule of ['Obey hub events', '`cland task`', 'Show work through `artifact.create`', 'Sub-agents never use the hub', 'only `cland release` pushes to `github`']) assert.ok(agents.includes(rule), rule);

  // committed files carry no machine path (the project's, the home folder, cland's own checkout)
  for (const f of expected) {
    const path = join(root, f);
    if ((await lstat(path)).isSymbolicLink()) continue;
    const text = await readFile(path, 'utf8');
    for (const machine of [root, homedir(), REPO.replace(/\/$/, '')]) assertNoMachinePath(text, machine, f);
  }
  // Exercise the same assertion on a path in the committed set with the actual home written into it.
  await writeFile(join(root, 'AGENTS.md'), `Read files from ${homedir()}/private.\n`);
  const injected = await readFile(join(root, 'AGENTS.md'), 'utf8');
  assert.throws(() => assertNoMachinePath(injected, homedir(), 'AGENTS.md'), /AGENTS\.md names/);
});

test('cland init on a repository with its own AGENTS.md, CLAUDE.md, settings, docs and skills: theirs stays, only the managed parts are added', async (t) => {
  const root = await tempProject(t, 'cland-init-own-');
  await gitRepo(root);
  const ownAgents = '# Our agents\n\nAlways run `make lint` before committing.\n';
  const ownClaude = '# Claude\n\nPrefer small commits.';
  const ownSettings = { permissions: { allow: ['Bash(make:*)'] }, hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo done >> .stops' }] }], PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: './guard.sh' }] }] }, model: 'opus' };
  const ownDomain = '# Our domain doc\n';
  await mkdir(join(root, '.claude', 'skills', 'mine'), { recursive: true });
  await mkdir(join(root, '.agents', 'skills', 'tdd'), { recursive: true });
  await mkdir(join(root, 'docs', 'agents'), { recursive: true });
  await writeFile(join(root, 'AGENTS.md'), ownAgents);
  await writeFile(join(root, 'CLAUDE.md'), ownClaude);
  await writeFile(join(root, '.claude', 'settings.json'), `${JSON.stringify(ownSettings, null, 2)}\n`);
  await writeFile(join(root, '.claude', 'skills', 'mine', 'SKILL.md'), 'our skill\n');
  await writeFile(join(root, '.agents', 'skills', 'tdd', 'SKILL.md'), 'our own tdd\n');
  await writeFile(join(root, 'docs', 'agents', 'domain.md'), ownDomain);
  await sh(root, 'git add -A && git commit -qm own');
  const before = await tree(root);

  const changes = await run(root, 'init');
  const kept = changes.filter((c) => c.action === 'kept').map((c) => c.path).sort();
  assert.deepEqual(kept, ['.agents/skills/tdd', 'docs/agents/domain.md']);

  // AGENTS.md: theirs first, byte for byte, the block appended
  const agents = await readFile(join(root, 'AGENTS.md'), 'utf8');
  assert.ok(agents.startsWith(`${ownAgents}\n<!-- cland:begin managed by cland ${VERSION} `), agents.slice(0, 200));
  assert.match(agents, /<!-- cland:end -->\n$/);
  // CLAUDE.md: theirs, plus the import with its mark
  assert.equal(await readFile(join(root, 'CLAUDE.md'), 'utf8'), `${ownClaude}\n\n<!-- managed by cland ${VERSION}: Claude Code reads AGENTS.md only through this import while CLAUDE.md exists -->\n@AGENTS.md\n`);
  // settings: every setting and hook of theirs kept, the cland hooks after their own
  const settings = JSON.parse(await readFile(join(root, '.claude', 'settings.json'), 'utf8')) as typeof ownSettings & { hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>> };
  assert.deepEqual(settings.permissions, ownSettings.permissions);
  assert.equal(settings.model, 'opus');
  assert.deepEqual(settings.hooks.PreToolUse, ownSettings.hooks.PreToolUse);
  assert.equal(settings.hooks.Stop?.length, 2);
  assert.deepEqual(settings.hooks.Stop?.[0], ownSettings.hooks.Stop[0]);
  assert.match(settings.hooks.Stop?.[1]?.hooks[0]?.command ?? '', /cland hook turn-end # managed by cland/);
  // their skills folder: kept, with one link per cland skill beside theirs; their own tdd is not replaced
  assert.equal(await readFile(join(root, '.claude', 'skills', 'mine', 'SKILL.md'), 'utf8'), 'our skill\n');
  assert.equal(await readlink(join(root, '.claude', 'skills', 'grilling')), '../../.agents/skills/grilling');
  assert.equal(await readFile(join(root, '.agents', 'skills', 'tdd', 'SKILL.md'), 'utf8'), 'our own tdd\n');
  const manifest = JSON.parse(await readFile(join(root, '.agents', 'skills', '.cland-manifest.json'), 'utf8')) as { skills: Record<string, string[]> };
  assert.ok(!('tdd' in manifest.skills) && 'grilling' in manifest.skills);

  // what changed: only managed paths; every file of theirs that changed is one cland adds a managed part to
  const after = await tree(root);
  const touched = changed(before, after).filter((p) => before.has(p));
  assert.deepEqual(touched, ['.claude/settings.json', 'AGENTS.md', 'CLAUDE.md']);
  assert.equal(after.get('docs/agents/domain.md'), before.get('docs/agents/domain.md'));
});

test('cland init twice changes nothing: the tree is byte-identical, and the second run reports nothing to do', async (t) => {
  const root = await tempProject(t, 'cland-init-twice-');
  await gitRepo(root);
  await writeFile(join(root, 'CLAUDE.md'), '# ours\n');
  await mkdir(join(root, '.claude'), { recursive: true });
  // their own formatting is kept byte for byte when nothing changes
  await writeFile(join(root, '.claude', 'settings.json'), '{"model": "opus"}');
  await run(root, 'init');
  const first = await tree(root);
  const settingsBefore = await lstat(join(root, '.claude', 'settings.json'));
  const changes = await run(root, 'init');
  assert.deepEqual(changes.filter((c) => c.action !== 'unchanged'), []);
  assert.deepEqual(changed(first, await tree(root)), []);
  assert.equal((await lstat(join(root, '.claude', 'settings.json'))).mtimeMs, settingsBefore.mtimeMs, 'not even rewritten');
  const human = await clandWithEnv(root, {}, 'init');
  assert.match(human.stdout, /nothing to change/);
});

test('cland update after a version bump rewrites the managed parts to the new version and touches nothing else', async (t) => {
  const root = await tempProject(t, 'cland-update-');
  await gitRepo(root);
  await writeFile(join(root, 'CLAUDE.md'), '# ours\n');
  const old = { CLAND_VERSION_OVERRIDE: '0.0.1' };
  await run(root, 'init', old);
  assert.match(await readFile(join(root, 'AGENTS.md'), 'utf8'), /managed by cland 0\.0\.1/);

  // the human's own additions after init: text around the block, a hook, a threshold, a file in a skill folder
  const agentsOld = await readFile(join(root, 'AGENTS.md'), 'utf8');
  await writeFile(join(root, 'AGENTS.md'), `# Project rules\n\nUse pnpm.\n\n${agentsOld}\n## After\n\nKeep this.\n`);
  const settingsPath = join(root, '.claude', 'settings.json');
  const settings = JSON.parse(await readFile(settingsPath, 'utf8')) as { hooks: Record<string, unknown[]> };
  settings.hooks.Stop?.push({ hooks: [{ type: 'command', command: 'echo ours' }] });
  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
  const configPath = join(root, '.cland', 'config.toml');
  await writeFile(configPath, (await readFile(configPath, 'utf8')).replace('rate_limit_max = 30', 'rate_limit_max = 50').replace('event_limit_max = 120', 'event_limit_max = 60').replace('event_limit_window_minutes = 10', 'event_limit_window_minutes = 2').replace('retention_days = 30', 'retention_days = 0').replace('layouts = []', 'layouts = ["ru"]').replace('[visibility]\n', '[visibility]\ninbox.idle = "now"\nmessages.agent = "watch"\n'));
  await writeFile(join(root, '.agents', 'skills', 'tdd', 'NOTES.md'), 'ours\n');
  const rolesBefore = await readFile(join(root, '.cland', 'roles.toml'), 'utf8');
  const before = await tree(root);

  await writeFile(join(root, '.cland', '.gitignore'), (await readFile(join(root, '.cland', '.gitignore'), 'utf8')).replace('ui.json\n', ''));
  const changes = await run(root, 'update');
  assert.ok((await readFile(join(root, '.cland', '.gitignore'), 'utf8')).split('\n').includes('ui.json'));
  assert.ok((await readFile(join(root, '.cland', '.gitignore'), 'utf8')).split('\n').includes('ui.json.lock*'));
  const after = await tree(root);
  // the managed parts were rewritten; the skills' contents and roles.toml did not change
  assert.deepEqual(changed(before, after), [
    '.agents/skills/.cland-manifest.json',
    '.cland/.gitignore',
    '.cland/config.toml',
    '.cland/tasks/.gitkeep',
    '.claude/settings.json',
    'AGENTS.md',
    'CLAUDE.md',
    'docs/agents/domain.md',
    'docs/agents/issue-tracker.md',
    'docs/agents/triage-labels.md',
  ]);
  assert.ok(changes.every((c) => c.action !== 'created'), 'update created nothing');
  const domain = await readFile(join(root, 'docs/agents/domain.md'), 'utf8');
  assert.match(domain, /The `\/domain-modeling` skill creates them lazily/);
  assert.doesNotMatch(domain, /grill-with-docs|improve-codebase-architecture/);
  for (const f of changed(before, after)) {
    const text = await readFile(join(root, f), 'utf8');
    assert.match(text, new RegExp(`managed by cland ${VERSION.replace(/\./g, '\\.')}`), f);
    assert.doesNotMatch(text, /managed by cland 0\.0\.1/, f);
  }
  // the human's parts, exactly
  const agents = await readFile(join(root, 'AGENTS.md'), 'utf8');
  assert.ok(agents.startsWith('# Project rules\n\nUse pnpm.\n\n<!-- cland:begin managed by cland '), agents.slice(0, 120));
  assert.ok(agents.endsWith('<!-- cland:end -->\n\n## After\n\nKeep this.\n'));
  assert.equal(agents.match(/cland:begin/g)?.length, 1);
  assert.equal((await readFile(join(root, 'CLAUDE.md'), 'utf8')).match(/@AGENTS\.md/g)?.length, 1);
  const merged = JSON.parse(await readFile(settingsPath, 'utf8')) as { hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>> };
  assert.deepEqual(
    merged.hooks.Stop?.map((e) => e.hooks[0]?.command.replace(/managed by cland .*/, 'managed by cland')),
    ['echo ours', '[ -n "$CLAND_SESSION_NAME" ] || ! command -v cland >/dev/null 2>&1 || cland hook turn-end # managed by cland'],
  );
  assert.match(await readFile(configPath, 'utf8'), /^rate_limit_max = 50$/m);
  assert.match(await readFile(configPath, 'utf8'), /^event_limit_max = 60$/m);
  assert.match(await readFile(configPath, 'utf8'), /^event_limit_window_minutes = 2$/m);
  assert.match(await readFile(configPath, 'utf8'), /^retention_days = 0$/m);
  assert.match(await readFile(configPath, 'utf8'), /^layouts = \["ru"\]$/m);
  assert.match(await readFile(configPath, 'utf8'), /inbox\.idle = "now"/);
  assert.match(await readFile(configPath, 'utf8'), /messages\.agent = "watch"/);

  assert.equal(await readFile(join(root, '.agents', 'skills', 'tdd', 'NOTES.md'), 'utf8'), 'ours\n');
  assert.equal(await readFile(join(root, '.cland', 'roles.toml'), 'utf8'), rolesBefore);

  // and a project cland never initialised is refused
  const bare = await tempProject(t, 'cland-update-bare-');
  const refused = await captureCli(write => runUpdate([], bare, write));
  assert.equal(refused.code, 1);
  assert.match(refused.stderr, /run `cland init` first/);
});

test('a hub started in an initialised project has General and Agents, serves the roles and reads config.toml; the secret is never in a committed file', async (t) => {
  const root = await tempProject(t, 'cland-init-hub-');
  await gitRepo(root);
  await run(root, 'init');
  const configPath = join(root, '.cland', 'config.toml');
  await writeFile(configPath, (await readFile(configPath, 'utf8')).replace('max_text_bytes = 8192', 'max_text_bytes = 4096').replace('layouts = []', 'layouts = ["ru"]').replace(/levels = \[[^\n]+\]/, 'levels = ["initiative", "feature"]'));
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock(), harnesses: 'fake' });
  const ui = await connectUi(t, discovery);
  const statusReply = await ui.request({ type: 'hub.status' });
  assert.deepEqual((statusReply.value as { keys: { layouts: string[] } }).keys, { layouts: ['ru'] });
  assert.deepEqual((statusReply.value as { tracker: { levels: string[] } }).tracker.levels, ['initiative', 'feature']);
  const topics = (await ui.request({ type: 'topic.list' })).value as { topics: Array<{ id: string; title: string }> };
  assert.deepEqual(
    topics.topics.map((x) => [x.id, x.title]),
    [
      ['general', 'General'],
      ['agents', 'Agents'],
    ],
  );
  const roles = (await ui.request({ type: 'role.list' })).value as { roles: Array<{ role: string }> };
  assert.deepEqual(roles.roles.map((r) => r.role).sort(), ['aide', 'coordinator', 'implementer', 'lead', 'qa', 'reviewer']);
  const log = await readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8');
  assert.match(log, /"event":"config-loaded".*"maxTextBytes":4096/);

  // with a hub running, git status still shows only the committed set, and none of it holds the secret
  const secret = (await readFile(join(root, '.cland', 'secret'), 'utf8')).trim();
  assert.match(secret, /^[0-9a-f]{64}$/);
  const status = await gitStatus(root);
  assert.ok(status.every((p) => /^(\.agents\/skills\/|\.claude\/(settings\.json|skills)$|\.cland\/(\.gitignore|config\.toml|crew\.toml|roles\.toml|RULES\.md|tasks\/\.gitkeep)$|AGENTS\.md$|docs\/agents\/)/.test(p)), status.join('\n'));
  for (const f of status) {
    if ((await lstat(join(root, f))).isSymbolicLink()) continue;
    assert.ok(!(await readFile(join(root, f), 'utf8')).includes(secret), `${f} holds the secret`);
  }
});

test('a manifest that is not cland\'s, malformed, or names a path outside its skill is reported, and update deletes nothing', async (t) => {
  const root = await tempProject(t, 'cland-update-manifest-');
  // T1: validation and no-write behavior use the filesystem provisioner directly.
  const initialSource = await tempProject(t, 'cland-valid-source-');
  for (const name of ['tdd', 'grilling']) {
    await mkdir(join(initialSource, name));
    await writeFile(join(initialSource, name, 'SKILL.md'), 'initial release bytes\n');
  }
  provision(root, { territory: false, skillsSource: initialSource });
  const manifestPath = join(root, '.agents', 'skills', '.cland-manifest.json');
  const good = JSON.parse(await readFile(manifestPath, 'utf8')) as { managed: string; skills: Record<string, Record<string, string>> };
  const hash = good.skills.tdd!['SKILL.md']!;
  await writeFile(join(root, 'README.md'), 'ours\n');
  await mkdir(join(root, '.agents', 'skills', 'x'), { recursive: true });
  await writeFile(join(root, '.agents', 'skills', 'x', 'SKILL.md'), 'ours\n');
  const source = await tempProject(t, 'cland-invalid-source-');
  for (const name of ['tdd', 'new-skill']) {
    await mkdir(join(source, name));
    await writeFile(join(source, name, 'SKILL.md'), 'new release bytes\n');
  }
  const bad: Array<[string, unknown]> = [
    ['a path climbing out', { managed: good.managed, skills: { tdd: ['../../../README.md'] } }],
    ['an absolute path', { managed: good.managed, skills: { tdd: [join(root, 'README.md')] } }],
    ['a path into a sibling skill', { managed: good.managed, skills: { tdd: ['../x/SKILL.md'] } }],
    ['a skill name that is a path', { managed: good.managed, skills: { '..': ['README.md'] } }],
    ['a skill name with capitals', { managed: good.managed, skills: { X: ['SKILL.md'] } }],
    ['a list that is not one', { managed: good.managed, skills: { tdd: 'SKILL.md' } }],
    ['no mark: not cland\'s', { managed: 'ours', skills: { tdd: ['SKILL.md'] } }],
    ['not JSON', null],
  ];
  // T1 file validation permutations: both formats share the same path guards.
  for (const [what, rel] of [
    ['climbing out', '../../../README.md'], ['absolute', join(root, 'README.md')],
    ['sibling skill', '../x/SKILL.md'], ['empty', ''], ['dot segment', './SKILL.md'],
    ['empty segment', 'notes//a.md'], ['backslash', 'notes\\a.md'],
  ]) bad.push([`hashed path: ${what}`, { managed: good.managed, skills: { tdd: { [rel!]: hash } } }]);
  for (const malformed of [hash.slice(1), hash + '0', hash.toUpperCase(), 'g'.repeat(64), hash + '\n', null, 1, [], {}]) {
    bad.push([`bad hash ${JSON.stringify(malformed)}`, { managed: good.managed, skills: { tdd: { 'SKILL.md': malformed } } }]);
  }
  for (const entry of [null, 1, true]) bad.push([`neither list nor map: ${entry}`, { managed: good.managed, skills: { tdd: entry } }]);
  for (const [what, manifest] of bad) {
    const text = manifest === null ? '{ not json' : `${JSON.stringify(manifest, null, 2)}\n`;
    await writeFile(manifestPath, text);
    const before = await tree(root);
    const changes = provision(root, { territory: false, skillsSource: source });
    assert.deepEqual(changes.filter((c) => c.action === 'removed'), [], what);
    const report = changes.find((c) => c.path === '.agents/skills/.cland-manifest.json');
    assert.equal(report?.action, 'kept', what);
    assert.match(report?.note ?? '', /manifest/, what);
    // nothing under .agents/ changed, the manifest included; the files the paths name are all still there
    assert.deepEqual(changed(before, await tree(root)).filter((p) => p.startsWith('.agents/') || p === 'README.md'), [], what);
    assert.equal(await readFile(join(root, 'README.md'), 'utf8'), 'ours\n', what);
    assert.equal(await readFile(join(root, '.agents', 'skills', 'x', 'SKILL.md'), 'utf8'), 'ours\n', what);
    await lstat(join(root, '.agents', 'skills', 'tdd', 'SKILL.md'));
    const doctor = (await checkProject(root, { started: async () => null, territoryProblems: () => null })).find(c => c.name === 'skills manifest');
    assert.equal(doctor?.verdict, 'fail', what);
    assert.match(doctor?.detail ?? '', /not valid/, what);
  }
  // a valid manifest again: update works as before
  await writeFile(manifestPath, `${JSON.stringify(good, null, 2)}\n`);
  const changes = provision(root, { territory: false, skillsSource: initialSource });
  assert.equal(changes.find((c) => c.path === '.agents/skills/.cland-manifest.json')?.action, 'unchanged');
  assert.equal((await checkProject(root, { started: async () => null, territoryProblems: () => null })).find(c => c.name === 'skills manifest')?.verdict, 'ok');
});

// T1: the provisioning and doctor file seams need neither Git nor a running hub.
test('legacy skill lists migrate only when every retained file has a known hash', async t => {
  const root = await tempProject(t, 'cland-legacy-hashes-');
  const source = await tempProject(t, 'cland-legacy-source-');
  await mkdir(join(source, 'tdd'));
  await writeFile(join(source, 'tdd', 'SKILL.md'), 'abc');
  await writeFile(join(source, 'tdd', 'NOTES.md'), 'notes v1');
  const update = () => provision(root, { territory: false, skillsSource: source });
  update();
  const target = join(root, '.agents', 'skills');
  const manifestPath = join(target, '.cland-manifest.json');
  const read = async () => JSON.parse(await readFile(manifestPath, 'utf8')) as { managed: string; skills: Record<string, string[] | Record<string, string>> };
  const initial = await read();
  const legacy = { managed: initial.managed, skills: { tdd: ['NOTES.md', 'SKILL.md'] } };
  await writeFile(manifestPath, JSON.stringify(legacy));
  assert.equal((await checkProject(root, { started: async () => null, territoryProblems: () => null })).find(c => c.name === 'skills manifest')?.verdict, 'ok');
  update();
  assert.deepEqual((await read()).skills, initial.skills, 'unchanged cland bytes acquire hashes too');
  assert.equal(((await read()).skills.tdd as Record<string, string>)['SKILL.md'], 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');

  await writeFile(manifestPath, JSON.stringify(legacy));
  const notes = join(target, 'tdd', 'NOTES.md');
  await rm(notes);
  await symlink(join(source, 'tdd', 'NOTES.md'), notes);
  await writeFile(join(source, 'tdd', 'SKILL.md'), 'new skill');
  update();
  assert.deepEqual((await read()).skills.tdd, legacy.skills.tdd, 'refused legacy path retains the list form');
  assert.equal(await readFile(join(target, 'tdd', 'SKILL.md'), 'utf8'), 'new skill', 'other owned files still update');
  assert.equal((await lstat(notes)).isSymbolicLink(), true);
  await rm(notes);
  update();
  const hashed = (await read()).skills.tdd;
  assert.deepEqual(hashed, Object.fromEntries(await tree(join(target, 'tdd'))), 'migrate once no unknown hashes remain');

  await rm(notes);
  await symlink(join(source, 'tdd', 'NOTES.md'), notes);
  await writeFile(join(source, 'tdd', 'NOTES.md'), 'notes v2');
  update();
  assert.deepEqual((await read()).skills.tdd, hashed, 'refused hashed file retains the old hash, not source or target bytes');
  await rm(join(source, 'tdd', 'SKILL.md'));
  update();
  assert.deepEqual((await read()).skills.tdd, { 'NOTES.md': (hashed as Record<string, string>)['NOTES.md'] }, 'failed removal retains the old hash');
});

test('provisioning never writes through a symlink: a managed file, AGENTS.md or a parent folder that is a link is kept, its target untouched', async (t) => {
  const outside = await tempProject(t, 'cland-outside-');
  await writeFile(join(outside, 'target.md'), 'external\n');
  await mkdir(join(outside, 'dir'));
  await writeFile(join(outside, 'dir', 'keep'), 'external\n');
  const was = await tree(outside);

  // a managed skill file replaced by a link to a file outside the project, then `cland update`
  const a = await tempProject(t, 'cland-link-skill-');
  await run(a, 'init');
  const skillMd = join(a, '.agents', 'skills', 'tdd', 'SKILL.md');
  await rm(skillMd);
  await symlink(join(outside, 'target.md'), skillMd);
  let changes = await run(a, 'update');
  let c = changes.find((x) => x.path === '.agents/skills/tdd/SKILL.md');
  assert.equal(c?.action, 'kept');
  assert.match(c?.note ?? '', /^symlink/);
  assert.equal((await lstat(skillMd)).isSymbolicLink(), true);

  // a whole managed skill folder replaced by a link to a folder outside
  await rm(join(a, '.agents', 'skills', 'grilling'), { recursive: true });
  await symlink(join(outside, 'dir'), join(a, '.agents', 'skills', 'grilling'));
  changes = await run(a, 'update');
  c = changes.find((x) => x.path.startsWith('.agents/skills/grilling'));
  assert.equal(c?.action, 'kept');
  assert.match(c?.note ?? '', /^symlink/);

  // AGENTS.md a link to a file outside, before init
  const b = await tempProject(t, 'cland-link-agents-');
  await symlink(join(outside, 'target.md'), join(b, 'AGENTS.md'));
  changes = await run(b, 'init');
  c = changes.find((x) => x.path === 'AGENTS.md');
  assert.equal(c?.action, 'kept');
  assert.match(c?.note ?? '', /^symlink/);

  // docs/agents and .claude links to a folder outside: nothing is written into it
  const d = await tempProject(t, 'cland-link-parent-');
  await mkdir(join(d, 'docs'));
  await symlink(join(outside, 'dir'), join(d, 'docs', 'agents'));
  await symlink(join(outside, 'dir'), join(d, '.claude'));
  changes = await run(d, 'init');
  for (const p of ['docs/agents/domain.md', '.claude/settings.json', '.claude/skills']) {
    c = changes.find((x) => x.path === p);
    assert.equal(c?.action, 'kept', p);
    assert.match(c?.note ?? '', /^symlink/, p);
  }

  assert.deepEqual(changed(was, await tree(outside)), [], 'nothing outside the projects changed');
});

test('init and update merge async sub-agent hooks while keeping user hooks', async t => {
  const root = await tempProject(t);
  await gitRepo(root);
  await mkdir(join(root, '.claude'));
  const own = { matcher: 'Explore', hooks: [{ type: 'command', command: './observe-child.sh' }] };
  await writeFile(join(root, '.claude', 'settings.json'), JSON.stringify({ hooks: { SubagentStart: [own], SubagentStop: [own] } }));
  for (const command of ['init', 'update'] as const) {
    await run(root, command);
    const settings = JSON.parse(await readFile(join(root, '.claude', 'settings.json'), 'utf8')) as { hooks: Record<string, Array<{ hooks: Array<{ command: string; async?: boolean }> }>> };
    for (const [event, signal] of [['SubagentStart', 'subagent-start'], ['SubagentStop', 'subagent-stop']]) {
      assert.equal(settings.hooks[event!]?.length, 2);
      assert.deepEqual(settings.hooks[event!]?.[0], own);
      const added = settings.hooks[event!]?.[1]?.hooks[0];
      assert.equal(added?.async, true);
      assert.ok(added?.command.includes(`cland hook ${signal} # managed by cland`));
    }
  }
});

test('a parent folder replaced by a symlink between the check and the write: the write is refused, nothing lands outside', async (t) => {
  const outside = await tempProject(t, 'cland-outside-');
  await mkdir(join(outside, 'dir'));
  await writeFile(join(outside, 'dir', 'keep'), 'external\n');
  const was = await tree(outside);
  const root = await tempProject(t, 'cland-link-race-');
  await mkdir(join(root, '.claude'));

  const nativeOpen = fs.openSync;
  let swapped = false;
  const mock = t.mock.method(fs, 'openSync', (...args: Parameters<typeof fs.openSync>) => {
    if (!swapped && String(args[0]).startsWith(join(root, '.claude', '.')) && String(args[0]).endsWith('.cland-tmp')) {
      swapped = true;
      fs.renameSync(join(root, '.claude'), join(root, '.claude-moved'));
      fs.symlinkSync(join(outside, 'dir'), join(root, '.claude'));
    }
    return nativeOpen(...args);
  });
  syncBuiltinESMExports();
  let changes: Awaited<ReturnType<typeof run>>;
  try { changes = await run(root, 'init'); }
  finally { mock.mock.restore(); syncBuiltinESMExports(); }
  assert.ok(swapped, 'the parent is replaced after validation, before the temporary write');
  const c = changes.find((x) => x.path === '.claude/settings.json');
  assert.equal(c?.action, 'kept', JSON.stringify(c));
  assert.match(c?.note ?? '', /^symlink: \.claude /);
  assert.deepEqual(changed(was, await tree(outside)), [], 'nothing outside the project changed');
});
