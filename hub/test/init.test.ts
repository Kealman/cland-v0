// `cland init` and `cland update` (spec 4.9, #39) run as the CLI against fixture repositories in temporary folders;
// the results are read back from disk and `git status`, never from inside cland. A hub started in the initialised
// project and a fake Claude Code launched there check that what was provisioned is what they use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, lstat, mkdir, readdir, readFile, readlink, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOOK_EVENTS } from '../src/adapters/claude-code.ts';
import { CLI_ENTRY, clandWithEnv, connectUi, eventually, fakeClaude, startDaemon, tempProject, type CliResult } from './harness.ts';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const SOURCE_SKILLS = join(REPO, '.agents', 'skills');
const VERSION = (JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version;

test('init writes tracker levels and update preserves a changed or empty ladder', async t => {
  const root = await tempProject(t);
  await gitRepo(root);
  await run(root, 'init');
  const crewPath = join(root, '.cland/crew.toml');
  const crew = await readFile(crewPath, 'utf8');
  assert.match(crew, /leads = \[\]/);
  assert.match(crew, /\[crew.reviewer\][\s\S]*?size = 1[\s\S]*?keep_context = true/);
  const customCrew = crew.replace('size = 1', 'size = 2');
  await writeFile(crewPath, customCrew);
  await run(root, 'init');
  await run(root, 'update');
  assert.equal(await readFile(crewPath, 'utf8'), customCrew, 'init and update preserve project staffing');
  const path = join(root, '.cland/config.toml');
  const initial = await readFile(path, 'utf8');
  assert.match(initial, /\[tracker\]\nlevels = \["release","epic"\]/);
  for (const levels of ['["initiative", "feature"]', '[]']) {
    await writeFile(path, initial.replace(/levels = \[[^\n]*\]/, `levels = ${levels}`));
    await run(root, 'update');
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

type Change = { path: string; action: string; note?: string };

const sh = (cwd: string, command: string, env: Record<string, string> = {}): Promise<{ code: number; stdout: string; stderr: string }> =>
  new Promise((resolve) =>
    execFile('sh', ['-c', command], { cwd, env: { ...process.env, ...env }, encoding: 'utf8' }, (err, stdout, stderr) => resolve({ code: err ? Number(err.code ?? 1) : 0, stdout, stderr })),
  );

async function gitRepo(root: string): Promise<void> {
  const r = await sh(root, 'git init -q && git config user.email t@example.com && git config user.name t');
  assert.equal(r.code, 0, r.stderr);
}

async function run(root: string, command: 'init' | 'update', env: Record<string, string> = {}): Promise<Change[]> {
  const r: CliResult = await clandWithEnv(root, env, command, '--json');
  assert.equal(r.code, 0, `cland ${command}: ${r.stderr}`);
  return (JSON.parse(r.stdout) as { changes: Change[] }).changes;
}

/** What `git status` shows as new or changed, one path per file (untracked folders expanded). */
async function gitStatus(root: string): Promise<string[]> {
  const r = await sh(root, 'git status --porcelain -uall');
  return r.stdout
    .split('\n')
    .filter(Boolean)
    .map((l) => l.slice(3))
    .sort();
}

/** Every file and symlink under `root` but `.git/` and the hub's volatile state, by its content hash (a link: its target). */
async function tree(root: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const walk = async (rel: string) => {
    for (const e of await readdir(join(root, rel), { withFileTypes: true })) {
      const path = rel ? `${rel}/${e.name}` : e.name;
      if (path === '.git' || /^\.cland\/(hub\.db|hub\.json|hub\.lock|hub\.sock|secret|log)/.test(path)) continue;
      if (e.isSymbolicLink()) out.set(path, `-> ${await readlink(join(root, path))}`);
      else if (e.isDirectory()) await walk(path);
      else out.set(path, createHash('sha256').update(await readFile(join(root, path))).digest('hex'));
    }
  };
  await walk('');
  return out;
}

const changed = (a: Map<string, string>, b: Map<string, string>): string[] =>
  [...new Set([...a.keys(), ...b.keys()])].filter((k) => a.get(k) !== b.get(k)).sort();

/** The skills cland ships, and every file of theirs as a project path. */
async function shipped(): Promise<{ names: string[]; files: string[] }> {
  const names: string[] = [];
  const files: string[] = [];
  for (const e of await readdir(SOURCE_SKILLS, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    names.push(e.name);
    for (const f of await readdir(join(SOURCE_SKILLS, e.name), { recursive: true, withFileTypes: true })) {
      if (f.isFile()) files.push(`.agents/skills/${join(f.parentPath, f.name).slice(SOURCE_SKILLS.length + 1)}`);
    }
  }
  return { names: names.sort(), files: files.sort() };
}

test('cland init on an empty repository: git status shows exactly the committed set, with no machine path in it', async (t) => {
  const root = await tempProject(t, 'cland-init-');
  await gitRepo(root);
  const changes = await run(root, 'init');
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
    for (const machine of [root, homedir(), REPO.replace(/\/$/, '')]) assert.ok(!text.includes(machine), `${f} names ${machine}`);
  }
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
  assert.equal(await readlink(join(root, '.claude', 'skills', 'grill-me')), '../../.agents/skills/grill-me');
  assert.equal(await readFile(join(root, '.agents', 'skills', 'tdd', 'SKILL.md'), 'utf8'), 'our own tdd\n');
  const manifest = JSON.parse(await readFile(join(root, '.agents', 'skills', '.cland-manifest.json'), 'utf8')) as { skills: Record<string, string[]> };
  assert.ok(!('tdd' in manifest.skills) && 'grill-me' in manifest.skills);

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
  const refused = await clandWithEnv(bare, {}, 'update');
  assert.equal(refused.code, 1);
  assert.match(refused.stderr, /run `cland init` first/);
});

test('a hub started in an initialised project has General and Agents, serves the roles and reads config.toml; the secret is never in a committed file', async (t) => {
  const root = await tempProject(t, 'cland-init-hub-');
  await gitRepo(root);
  await run(root, 'init');
  const configPath = join(root, '.cland', 'config.toml');
  await writeFile(configPath, (await readFile(configPath, 'utf8')).replace('max_text_bytes = 8192', 'max_text_bytes = 4096').replace('layouts = []', 'layouts = ["ru"]').replace(/levels = \[[^\n]+\]/, 'levels = ["initiative", "feature"]'));
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const statusReply = await ui.request({ type: 'hub.status' });
  assert.deepEqual((statusReply.value as { keys: { layouts: string[] } }).keys, { layouts: ['ru'] });
  assert.deepEqual((statusReply.value as { tracker: { levels: string[] } }).tracker, { levels: ['initiative', 'feature'] });
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
  assert.ok(status.every((p) => /^(\.agents\/skills\/|\.claude\/(settings\.json|skills)$|\.cland\/(\.gitignore|config\.toml|crew\.toml|roles\.toml|tasks\/\.gitkeep)$|AGENTS\.md$|docs\/agents\/)/.test(p)), status.join('\n'));
  for (const f of status) {
    if ((await lstat(join(root, f))).isSymbolicLink()) continue;
    assert.ok(!(await readFile(join(root, f), 'utf8')).includes(secret), `${f} holds the secret`);
  }
});

test('the project hook runs `cland hook` from the PATH for a session started by hand, and stands aside in a session the hub launched', async (t) => {
  const root = await tempProject(t, 'cland-init-hook-');
  await gitRepo(root);
  await run(root, 'init');
  const settings = JSON.parse(await readFile(join(root, '.claude', 'settings.json'), 'utf8')) as { hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>> };
  const command = settings.hooks.SessionStart?.[0]?.hooks[0]?.command ?? '';
  // a `cland` on the PATH that records how it was called
  const bin = join(root, '.tmp-bin');
  await mkdir(bin);
  const calls = join(root, '.tmp-calls');
  await writeFile(join(bin, 'cland'), `#!/bin/sh\necho "$@" >> '${calls}'\n`);
  await chmod(join(bin, 'cland'), 0o755);
  const path = `${bin}:${dirname(process.execPath)}:/usr/bin:/bin`;

  const byHand = await sh(root, command, { PATH: path, CLAND_SESSION_NAME: '' });
  assert.equal(byHand.code, 0, byHand.stderr);
  assert.equal(await readFile(calls, 'utf8'), 'hook session-start\n');

  const launched = await sh(root, command, { PATH: path, CLAND_SESSION_NAME: 'coord' });
  assert.equal(launched.code, 0);
  assert.equal(await readFile(calls, 'utf8'), 'hook session-start\n', 'the launch injected its own hooks: the project one does nothing');

  const noCland = await sh(root, command, { PATH: '/usr/bin:/bin', CLAND_SESSION_NAME: '' });
  assert.equal(noCland.code, 0, 'cland not installed: the hook does nothing and fails nothing');
  assert.equal(noCland.stderr, '');
});

test('a Claude Code session launched in the initialised project gets the project hooks and reads AGENTS.md: directly, and through the import once CLAUDE.md exists', async (t) => {
  const root = await tempProject(t, 'cland-init-cc-');
  await gitRepo(root);
  await run(root, 'init');
  const fake = await fakeClaude(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const block = (await readFile(join(root, 'AGENTS.md'), 'utf8')).trim();

  type Context = { instructions: Array<{ file: string; text: string }>; hooks: Record<string, string[]> };
  const launch = async (name: string): Promise<Context> => {
    const r = await ui.request({ type: 'session.launch', name, harness: 'claude-code' }, 30_000);
    assert.equal(r.ok, true, r.error);
    const id = (r.value as { process: { harnessId: string } }).process.harnessId;
    return eventually(`${name}'s context`, async () => JSON.parse(await readFile(join(fake.home, 'jobs', `${id}.context.json`), 'utf8')) as Context);
  };

  const first = await launch('cc-1');
  assert.deepEqual(first.instructions.map((i) => i.file), ['AGENTS.md']);
  assert.equal(first.instructions[0]?.text.trim(), block);
  // each hook event runs the project's hook and the one the launch injected (naming the session and the hub)
  for (const [hookEvent, event] of Object.entries(HOOK_EVENTS)) {
    const commands = first.hooks[hookEvent] ?? [];
    assert.equal(commands.length, 2, hookEvent);
    assert.match(commands[0] ?? '', new RegExp(`cland hook ${event} # managed by cland`));
    assert.match(commands[1] ?? '', new RegExp(`'hook' '${event}' '--session' 'cc-1'`));
  }

  // a CLAUDE.md appears: init adds the import, and the next session reads AGENTS.md through it
  await writeFile(join(root, 'CLAUDE.md'), '# ours\n');
  await run(root, 'init');
  const second = await launch('cc-2');
  assert.deepEqual(second.instructions.map((i) => i.file), ['CLAUDE.md', 'AGENTS.md']);
  assert.equal(second.instructions[1]?.text.trim(), block);
});

// ------------------------------------------------------------------ the manifest, symlinks and ownership (review of #39)

test('a manifest that is not cland\'s, malformed, or names a path outside its skill is reported, and update deletes nothing', async (t) => {
  const root = await tempProject(t, 'cland-update-manifest-');
  await gitRepo(root);
  await run(root, 'init');
  const manifestPath = join(root, '.agents', 'skills', '.cland-manifest.json');
  const good = JSON.parse(await readFile(manifestPath, 'utf8')) as { managed: string; skills: Record<string, string[]> };
  await writeFile(join(root, 'README.md'), 'ours\n');
  await mkdir(join(root, '.agents', 'skills', 'x'), { recursive: true });
  await writeFile(join(root, '.agents', 'skills', 'x', 'SKILL.md'), 'ours\n');
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
  for (const [what, manifest] of bad) {
    const text = manifest === null ? '{ not json' : `${JSON.stringify(manifest, null, 2)}\n`;
    await writeFile(manifestPath, text);
    const before = await tree(root);
    const changes = await run(root, 'update');
    assert.deepEqual(changes.filter((c) => c.action === 'removed'), [], what);
    const report = changes.find((c) => c.path === '.agents/skills/.cland-manifest.json');
    assert.equal(report?.action, 'kept', what);
    assert.match(report?.note ?? '', /manifest/, what);
    // nothing under .agents/ changed, the manifest included; the files the paths name are all still there
    assert.deepEqual(changed(before, await tree(root)).filter((p) => p.startsWith('.agents/') || p === 'README.md'), [], what);
    assert.equal(await readFile(join(root, 'README.md'), 'utf8'), 'ours\n', what);
    assert.equal(await readFile(join(root, '.agents', 'skills', 'x', 'SKILL.md'), 'utf8'), 'ours\n', what);
    await lstat(join(root, '.agents', 'skills', 'tdd', 'SKILL.md'));
  }
  // a valid manifest again: update works as before
  await writeFile(manifestPath, `${JSON.stringify(good, null, 2)}\n`);
  const changes = await run(root, 'update');
  assert.equal(changes.find((c) => c.path === '.agents/skills/.cland-manifest.json')?.action, 'unchanged');
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
  await rm(join(a, '.agents', 'skills', 'grill-me'), { recursive: true });
  await symlink(join(outside, 'dir'), join(a, '.agents', 'skills', 'grill-me'));
  changes = await run(a, 'update');
  c = changes.find((x) => x.path.startsWith('.agents/skills/grill-me'));
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

test('a parent folder replaced by a symlink between the check and the write: the write is refused, nothing lands outside', async (t) => {
  const outside = await tempProject(t, 'cland-outside-');
  await mkdir(join(outside, 'dir'));
  await writeFile(join(outside, 'dir', 'keep'), 'external\n');
  const was = await tree(outside);
  const root = await tempProject(t, 'cland-link-race-');
  await mkdir(join(root, '.claude'));

  // the write of .claude/settings.json holds still after its checks, before its temporary file exists; meanwhile the
  // folder is swapped for a link to a folder outside
  const child = spawn(process.execPath, [CLI_ENTRY, 'init', '--json'], {
    cwd: root,
    env: { ...process.env, CLAND_TEST_INIT_WRITE_PAUSE_MS: '1500', CLAND_TEST_INIT_WRITE_PAUSE_PATH: join('.claude', 'settings.json') },
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (c: Buffer) => (stdout += String(c)));
  const paused = new Promise<void>((resolve) =>
    child.stderr.on('data', (c: Buffer) => {
      stderr += String(c);
      if (stderr.includes('test pause before writing')) resolve();
    }),
  );
  const exited = new Promise<number | null>((resolve) => child.on('close', resolve));
  await paused;
  await rename(join(root, '.claude'), join(root, '.claude-moved'));
  await symlink(join(outside, 'dir'), join(root, '.claude'));
  assert.equal(await exited, 0, stderr);

  const c = (JSON.parse(stdout) as { changes: Change[] }).changes.find((x) => x.path === '.claude/settings.json');
  assert.equal(c?.action, 'kept', JSON.stringify(c));
  assert.match(c?.note ?? '', /^symlink: \.claude /);
  assert.deepEqual(changed(was, await tree(outside)), [], 'nothing outside the project changed');
});

test('a file of the human\'s inside a managed skill is never adopted: a later release shipping that path reports a conflict and keeps it', async (t) => {
  const root = await tempProject(t, 'cland-update-conflict-');
  const v1 = await tempProject(t, 'cland-skills-v1-');
  await mkdir(join(v1, 'tdd'));
  await writeFile(join(v1, 'tdd', 'SKILL.md'), 'tdd v1\n');
  await run(root, 'init', { CLAND_SKILLS_SOURCE_OVERRIDE: v1 });
  await writeFile(join(root, '.agents', 'skills', 'tdd', 'NOTES.md'), 'ours\n');

  // the next release ships tdd/NOTES.md
  const v2 = await tempProject(t, 'cland-skills-v2-');
  await mkdir(join(v2, 'tdd'));
  await writeFile(join(v2, 'tdd', 'SKILL.md'), 'tdd v2\n');
  await writeFile(join(v2, 'tdd', 'NOTES.md'), 'cland notes\n');
  const manifestOf = async () => (JSON.parse(await readFile(join(root, '.agents', 'skills', '.cland-manifest.json'), 'utf8')) as { skills: Record<string, string[]> }).skills;
  for (let i = 0; i < 2; i++) {
    const changes = await run(root, 'update', { CLAND_SKILLS_SOURCE_OVERRIDE: v2 });
    const c = changes.find((x) => x.path === '.agents/skills/tdd/NOTES.md');
    assert.equal(c?.action, 'kept', `run ${i + 1}`);
    assert.match(c?.note ?? '', /conflict/);
    assert.equal(await readFile(join(root, '.agents', 'skills', 'tdd', 'NOTES.md'), 'utf8'), 'ours\n');
    assert.equal(await readFile(join(root, '.agents', 'skills', 'tdd', 'SKILL.md'), 'utf8'), 'tdd v2\n');
    assert.deepEqual((await manifestOf()).tdd, ['SKILL.md'], 'not adopted');
  }
  // the human removes theirs: cland's is installed and managed from then on
  await rm(join(root, '.agents', 'skills', 'tdd', 'NOTES.md'));
  await run(root, 'update', { CLAND_SKILLS_SOURCE_OVERRIDE: v2 });
  assert.equal(await readFile(join(root, '.agents', 'skills', 'tdd', 'NOTES.md'), 'utf8'), 'cland notes\n');
  assert.deepEqual((await manifestOf()).tdd, ['NOTES.md', 'SKILL.md']);
});
