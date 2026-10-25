// T2: runDoctor check matrices in-process with command replies at the probe boundary.
// Hub rules use in-process hubs and adapters. CLI/process lifecycle contracts live in doctor-cli.test.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, readFile, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, projectHub, tempProject } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { doctor, report, update, initialised, toolchain, check, notOk, HARNESS_DIRS, NVIM_VERSION, probeCalls } from './doctor-fixture.ts';
import { rolesTemplate } from '../src/roles/template.ts';

test('a Claude-only project succeeds without other harnesses or GitHub tooling', async t => {
  const tools = await toolchain(t);
  const root = await initialised(t, tools.env);
  await writeFile(join(root, '.cland', 'roles.toml'), rolesTemplate(['claude-code']));
  const env = { ...tools.env, CLAND_CODEX_BIN: '/missing/codex', CLAND_OPENCODE_BIN: '/missing/opencode', FAKE_GH_LOGGED_OUT: '1' };
  probeCalls.length = 0;
  const good = await report(root, env, ['origin']);
  assert.equal(good.code, 0, notOk(good.report).join('\n'));
  assert.deepEqual(Object.keys(good.report), ['root', 'version', 'checks', 'summary']);
  assert.deepEqual(check(good.report, 'web bundle'), { name: 'web bundle', verdict: 'ok', detail: 'fixture bundle current' });
  for (const name of ['codex', 'opencode']) assert.deepEqual(check(good.report, name), { name, verdict: 'ok', detail: 'not installed; no role uses it' });
  assert.deepEqual(check(good.report, 'gh'), { name: 'gh', verdict: 'ok', detail: 'not needed: no github remote' });
  assert.ok(!probeCalls.some(c => /\/gh$/.test(c.bin)), 'no gh version or auth probe without the github remote');
  const bad = await report(root, { ...env, FAKE_CLAUDE_LOGGED_OUT: '1' }, []);
  assert.equal(bad.code, 1);
  assert.equal(check(bad.report, 'claude-code auth').verdict, 'fail');
  assert.equal(check(bad.report, 'claude-code auth').fix, 'claude auth login');
});

test('doctor without a role file needs any one installed harness', async t => {
  const tools = await toolchain(t);
  const bare = await tempProject(t);
  const project = await initialised(t, tools.env);
  await unlink(join(project, '.cland', 'roles.toml'));
  for (const root of [bare, project]) {
    for (const installed of [false, true]) {
      const result = await report(root, { ...tools.env, CLAND_CLAUDE_BIN: installed ? join(HARNESS_DIRS.claude, 'claude') : '/missing/claude', CLAND_CODEX_BIN: '/missing/codex', CLAND_OPENCODE_BIN: '/missing/opencode' }, []);
      const failures = result.report.checks.filter(c => /^(harnesses|claude-code|codex|opencode)/.test(c.name) && c.verdict === 'fail');
      assert.equal(failures.length, installed ? 0 : 1);
      if (!installed) assert.equal(failures[0]?.detail, 'cland needs at least one harness');
    }
  }
});

test('key warnings name the Ghostty LF binding and tty erase collision, with fixes', async t => {
  const tools = await toolchain(t);
  const root = await initialised(t, tools.env);
  await projectHub(t, root, {}, { clock: new FakeClock(), harnesses: 'fake', probes: 'fake' });
  const fixture = join(root, 'keys-fixtures');
  await mkdir(join(fixture, 'ghostty'), { recursive: true });
  const config = join(fixture, 'ghostty', 'config');
  const stty = join(fixture, 'stty');
  const erase = join(fixture, 'stty-output');
  await writeFile(stty, '#!/bin/sh\ncat "$CLAND_TEST_STTY_OUTPUT"\n');
  await chmod(stty, 0o755);
  const env = { ...tools.env, HOME: fixture, XDG_CONFIG_HOME: fixture, PATH: `${fixture}:${tools.env.PATH}`, CLAND_TEST_STTY_OUTPUT: erase };
  await writeFile(config, '# a comment\nkeybind = shift+enter=text:\\n\n');
  await writeFile(erase, 'speed 9600 baud; erase = ^H; kill = ^U;\n');
  const bad = await report(root, env);
  assert.equal(check(bad.report, 'Ghostty Shift+Enter').verdict, 'warn');
  assert.match(check(bad.report, 'Ghostty Shift+Enter').fix ?? '', /remove.*shift\+enter/);
  assert.equal(check(bad.report, 'tty erase').verdict, 'warn');
  assert.match(check(bad.report, 'tty erase').fix ?? '', /stty erase/);
  const plain = await doctor(root, env);
  assert.match(plain.stdout, /warn.*Ghostty Shift\+Enter.*fix:/);
  assert.match(plain.stdout, /warn.*tty erase.*fix:/);
  await writeFile(config, '# keybind = shift+enter=text:\\n\nkeybind = shift+enter=text:hello\n');
  await writeFile(erase, 'speed 9600 baud; erase = ^?; kill = ^U;\n');
  const good = await report(root, env);
  assert.ok(!good.report.checks.some(c => c.name === 'Ghostty Shift+Enter' || c.name === 'tty erase'));
  for (const [label, text, warning] of [
    ['later safe override', 'keybind = shift+enter=text:\\n\nkeybind = shift+enter=csi:13;2u\n', false],
    ['later unbind', 'keybind = shift+enter=text:\\n\nkeybind = shift+enter=unbind\n', false],
    ['clear bindings', 'keybind = shift+enter=text:\\n\nkeybind = clear\n', false],
    ['quoted LF', 'keybind = "shift+enter=text:\\n"\n', true],
    ['invalid uppercase key', 'KEYBIND = shift+enter=text:\\n\n', false],
    ['plain LF', 'keybind = shift+enter=text:\\n\n', true],
  ] as const) {
    await writeFile(config, text);
    const value = await report(root, env);
    assert.equal(value.report.checks.some(c => c.name === 'Ghostty Shift+Enter'), warning, label);
  }
  await writeFile(config, 'keybind = shift+enter=text:\\n\n');
  const modern = join(fixture, 'ghostty', 'config.ghostty');
  await writeFile(modern, 'keybind = shift+enter=csi:13;2u\n');
  assert.ok(!(await report(root, env)).report.checks.some(c => c.name === 'Ghostty Shift+Enter'), 'modern filename overrides legacy config');
  await writeFile(config, 'keybind = shift+enter=csi:13;2u\n');
  await writeFile(modern, 'keybind = "shift+enter=text:\\n"\n');
  assert.ok((await report(root, env)).report.checks.some(c => c.name === 'Ghostty Shift+Enter'), 'modern filename may also override a safe binding with LF');
  await rm(modern);
  await rm(config);
  await writeFile(erase, 'not a tty\n');
  const missing = await report(root, env);
  assert.ok(!missing.report.checks.some(c => c.name === 'Ghostty Shift+Enter' || c.name === 'tty erase'));
});

test('a harness missing from the PATH fails with the fix', async t => {
  const tools = await toolchain(t);
  const root = await initialised(t, tools.env);
  await projectHub(t, root, {}, { clock: new FakeClock(), harnesses: 'fake', probes: 'fake' });
  const { code, report: r } = await report(root, { ...tools.env, PATH: tools.path('codex') });
  const c = check(r, 'codex');
  assert.equal(c.verdict, 'fail');
  assert.equal(c.detail, 'not installed: `codex` is not on the PATH or in its installer folders');
  assert.match(c.fix ?? '', /install Codex .*or set CLAND_CODEX_BIN to its path/);
  assert.equal(check(r, 'codex auth').verdict, 'fail');
  assert.equal(code, 1);
  // the adapter's override is honoured
  const viaOverride = await report(root, { ...tools.env, PATH: tools.path('codex'), CLAND_CODEX_BIN: join(HARNESS_DIRS.codex, 'codex') });
  assert.equal(check(viaOverride.report, 'codex').verdict, 'ok');
});

test('a missing OpenCode binary points to the v2 installer', async t => {
  const tools = await toolchain(t);
  const root = await initialised(t, tools.env, true);
  await projectHub(t, root, {}, { clock: new FakeClock(), harnesses: 'fake', probes: 'fake' });
  const missing = await doctor(root, { ...tools.env, PATH: tools.path('opencode') });
  assert.equal(missing.code, 1);
  assert.match(missing.stdout, /fail\s+opencode\s+not installed:.*https:\/\/opencode\.ai\/v2\/install/);
});

test('a harness that is not signed in fails with its login command; OpenCode without credentials warns', async t => {
  const tools = await toolchain(t);
  const root = await initialised(t, tools.env, true);
  await projectHub(t, root, {}, { clock: new FakeClock(), harnesses: 'fake', probes: 'fake' });
  const { code, report: r } = await report(root, { ...tools.env, FAKE_CLAUDE_LOGGED_OUT: '1', FAKE_CODEX_LOGGED_OUT: '1', FAKE_OPENCODE_NO_AUTH: '1', FAKE_GH_LOGGED_OUT: '1' });
  assert.deepEqual(
    ['claude-code auth', 'codex auth', 'opencode auth', 'gh auth'].map((n) => [n, check(r, n).verdict, check(r, n).fix]),
    [
      ['claude-code auth', 'fail', 'claude auth login'],
      ['codex auth', 'fail', 'codex login'],
      ['opencode auth', 'warn', `OPENCODE_DB='${join(tools.env.HOME!, '.local', 'share', 'cland', 'opencode', 'opencode.db')}' opencode auth login --standalone`],
      ['gh auth', 'fail', 'gh auth login'],
    ],
  );
  assert.equal(code, 1);
});

test('Neovim not at the pinned version, or missing', async t => {
  const tools = await toolchain(t);
  const root = await initialised(t, tools.env);
  await projectHub(t, root, {}, { clock: new FakeClock(), harnesses: 'fake', probes: 'fake' });
  const other = join(root, 'old-nvim');
  await writeFile(other, '#!/bin/sh\necho "NVIM v0.10.0"\n');
  await chmod(other, 0o755);
  const wrong = await report(root, { ...tools.env, CLAND_NVIM: other });
  assert.equal(check(wrong.report, 'neovim').verdict, 'warn');
  assert.match(check(wrong.report, 'neovim').detail, new RegExp(`v0\\.10\\.0 .* cland pins ${NVIM_VERSION.replace(/\./g, '\\.')}`));
  await unlink(other);
  const gone = await report(root, { ...tools.env, CLAND_NVIM: other });
  assert.equal(check(gone.report, 'neovim').verdict, 'fail');
});

// T2: the public doctor report, with injected machine probes and real project files.
test('doctor warns for every role and unknown skill while accepting project-owned skills', async t => {
  const tools = await toolchain(t);
  const root = await initialised(t, tools.env);
  const local = join(root, '.agents/skills/project-check');
  await mkdir(local);
  await writeFile(join(local, 'SKILL.md'), '# Project check\n');
  await mkdir(join(root, '.agents/skills/empty-skill'));
  await symlink('missing-target', join(root, '.agents/skills/broken-skill'));
  const file = join(root, '.cland/roles.toml');
  const roles = await readFile(file, 'utf8');
  await writeFile(file, roles
    .replace('skills = ["implement", "tdd", "diagnosing-bugs"]', 'skills = ["implement", "project-check", "grill-me", "empty-skill", "broken-skill"]')
    .replace('skills = ["code-review"]', 'skills = ["code-review", "grill-me"]'));
  const result = await report(root, tools.env, []);
  assert.equal(result.code, 0, notOk(result.report).join('\n'));
  const warnings = result.report.checks.filter(c => c.name.startsWith('role skills '));
  assert.deepEqual(warnings.map(c => [c.name, c.verdict, c.detail]), [
    ['role skills implementer', 'warn', 'implementer names unavailable skills: grill-me, empty-skill, broken-skill'],
    ['role skills reviewer', 'warn', 'reviewer names unavailable skills: grill-me'],
  ]);
  for (const warning of warnings) assert.match(warning.fix ?? '', /\.cland\/roles\.toml/);
  await writeFile(file, roles);
  assert.deepEqual((await report(root, tools.env, [])).report.checks.filter(c => c.name.startsWith('role skills ')), []);
});

test('roles.toml that does not parse fails, naming the TOML error', async t => {
  const tools = await toolchain(t);
  const root = await initialised(t, tools.env);
  await projectHub(t, root, {}, { clock: new FakeClock(), harnesses: 'fake', probes: 'fake' });
  const path = join(root, '.cland', 'roles.toml');
  const good = await readFile(path, 'utf8');
  await writeFile(path, `${good}\n[reviewer\nharness = "codex"\n`);
  try {
    const { code, report: r } = await report(root, tools.env);
    const c = check(r, 'roles.toml');
    assert.equal(c.verdict, 'fail');
    assert.match(c.detail, /^does not parse: .*line \d+/i);
    assert.match(c.fix ?? '', /fix \.cland\/roles\.toml/);
    assert.equal(code, 1);
  } finally {
    await writeFile(path, good);
  }
});

test('config.toml that does not parse fails, naming the TOML error', async t => {
  const tools = await toolchain(t);
  const root = await initialised(t, tools.env);
  await projectHub(t, root, {}, { clock: new FakeClock(), harnesses: 'fake', probes: 'fake' });
  const path = join(root, '.cland', 'config.toml');
  const good = await readFile(path, 'utf8');
  await writeFile(path, `${good}\nmax_text_bytes = = 3\n`);
  try {
    const { report: r } = await report(root, tools.env);
    assert.equal(check(r, 'config.toml').verdict, 'fail');
    assert.match(check(r, 'config.toml').detail, /^does not parse: /);
  } finally {
    await writeFile(path, good);
  }
});

test('a broken skills symlink fails with the fix', async t => {
  const tools = await toolchain(t);
  const root = await initialised(t, tools.env);
  await projectHub(t, root, {}, { clock: new FakeClock(), harnesses: 'fake', probes: 'fake' });
  const link = join(root, '.claude', 'skills');
  await unlink(link);
  await symlink('../.agents/nowhere', link);
  try {
    const { code, report: r } = await report(root, tools.env);
    const c = check(r, 'skills');
    assert.equal(c.verdict, 'fail');
    assert.equal(c.detail, '.claude/skills is a broken symlink (to ../.agents/nowhere)');
    assert.equal(c.fix, 'rm .claude/skills, then cland update');
    assert.equal(code, 1);
  } finally {
    await unlink(link);
    await symlink('../.agents/skills', link);
  }
  // cland's own link, broken because its target went: `cland update` alone repairs it
  await rm(join(root, '.agents', 'skills'), { recursive: true });
  const { report: r } = await report(root, tools.env);
  assert.equal(check(r, 'skills').fix, 'cland update');
  assert.equal(check(r, 'skills manifest').verdict, 'fail');
  const updated = await update(root);
  assert.equal(updated.code, 0, updated.stderr);
  const after = await report(root, tools.env);
  assert.deepEqual(notOk(after.report), []);
});

test('the managed hooks or AGENTS.md block removed: named failures, fixed by cland update', async t => {
  const tools = await toolchain(t);
  const root = await initialised(t, tools.env);
  await projectHub(t, root, {}, { clock: new FakeClock(), harnesses: 'fake', probes: 'fake' });
  const settings = join(root, '.claude', 'settings.json');
  await writeFile(settings, '{}\n');
  const agents = join(root, 'AGENTS.md');
  await writeFile(agents, '# Our own instructions\n');
  const { report: r } = await report(root, tools.env);
  assert.equal(check(r, 'claude hooks').verdict, 'fail');
  assert.equal(check(r, 'claude hooks').fix, 'cland update');
  assert.equal(check(r, 'AGENTS.md').verdict, 'fail');
  assert.equal(check(r, 'AGENTS.md').fix, 'cland update');
  assert.equal((await update(root)).code, 0);
  assert.deepEqual(notOk((await report(root, tools.env)).report), []);
});

test("the hub's discovery file removed: a named failure with the fix", async t => {
  const tools = await toolchain(t);
  const root = await initialised(t, tools.env);
  await projectHub(t, root, {}, { clock: new FakeClock(), harnesses: 'fake', probes: 'fake' });
  await unlink(join(root, '.cland', 'hub.json'));
  const { code, report: r } = await report(root, tools.env);
  const hub = check(r, 'hub');
  assert.equal(hub.verdict, 'fail');
  assert.match(hub.detail, /^pid \d+ holds \.cland\/hub\.lock, but \.cland\/hub\.json is missing/);
  assert.match(hub.fix ?? '', /^stop pid \d+ \(kill \d+\), then cland hub start$/);
  assert.equal(check(r, 'hub.json').verdict, 'fail');
  assert.equal(code, 1);
  const text = await doctor(root, tools.env);
  assert.match(text.stdout, /^fail {2}hub\.json +missing while pid \d+ holds the hub lock — fix: kill \d+, then cland hub start/m);
});

test('doctor refuses a readable secret and an uninitialised folder', async (t) => {
  const tools = await toolchain(t);
  const root = await initialised(t, tools.env);
  // a secret others can read
  const started = await projectHub(t, root, {}, { clock: new FakeClock(), harnesses: 'fake', probes: 'fake' });
  await chmod(join(root, '.cland', 'secret'), 0o644);
  const loose = await report(root, tools.env);
  assert.equal(check(loose.report, 'secret').verdict, 'fail');
  assert.equal(check(loose.report, 'secret').fix, 'chmod 600 .cland/secret');
  assert.ok(started.discovery.pid > 0);

  const bare = await tempProject(t, 'cland-doctor-bare-');
  const none = await report(bare, tools.env);
  assert.equal(check(none.report, 'project').verdict, 'fail');
  assert.equal(check(none.report, 'project').fix, `cland init ${bare}`);
  assert.equal(none.code, 1);
});

test('a stale hub.json naming a dead pid while a live hub holds the lock is a failure naming the holder', async (t) => {
  const tools = await toolchain(t);
  const root = await initialised(t, tools.env);
  const { discovery } = await projectHub(t, root, {}, { clock: new FakeClock(), harnesses: 'fake', probes: 'fake' });
  const dead = 2_147_483_647;
  const path = join(root, '.cland', 'hub.json');
  await writeFile(path, JSON.stringify({ ...JSON.parse(await readFile(path, 'utf8')), pid: dead }));
  const { code, report: r } = await report(root, tools.env);
  const hub = check(r, 'hub');
  assert.equal(hub.verdict, 'fail');
  assert.match(hub.detail, new RegExp(`pid ${discovery.pid} holds \\.cland/hub\\.lock`));
  assert.match(hub.detail, new RegExp(`names pid ${dead}`));
  assert.match(hub.fix ?? '', new RegExp(`kill ${discovery.pid}`));
  assert.match(hub.fix ?? '', /rm \.cland\/hub\.json/);
  assert.equal(check(r, 'hub.json').verdict, 'fail');
  assert.equal(code, 1);
});

test('a skill entry in the project\'s own .claude/skills/ is ok only as a folder (or a link to one) holding SKILL.md', async (t) => {
  const tools = await toolchain(t);
  const root = await initialised(t, tools.env);
  await unlink(join(root, '.claude', 'skills'));
  await mkdir(join(root, '.claude', 'skills'));
  assert.equal((await update(root)).code, 0);
  assert.equal(check((await report(root, tools.env)).report, 'skills').verdict, 'ok');
  const entry = join(root, '.claude', 'skills', 'grilling');

  await unlink(entry);
  await writeFile(entry, 'not a skill\n');
  let c = check((await report(root, tools.env)).report, 'skills');
  assert.equal(c.verdict, 'fail', 'a regular file');
  assert.match(c.detail, /grilling/);

  await unlink(entry);
  const empty = join(root, 'empty');
  await mkdir(empty);
  await symlink(empty, entry);
  c = check((await report(root, tools.env)).report, 'skills');
  assert.equal(c.verdict, 'fail', 'a link to a folder without SKILL.md');
  assert.match(c.detail, /grilling/);
});

test('doctor names isolated OpenCode databases and standalone login, and warns about default-database accounts', async t => {
  const tools = await toolchain(t);
  const root = await initialised(t, tools.env);
  const data = join(root, 'data');
  const config = join(root, 'config');
  await mkdir(join(config, 'cland'), { recursive: true });
  await mkdir(data, { recursive: true });
  await writeFile(join(config, 'cland', 'accounts.toml'), `[accounts.shared]\nharness = "opencode"\ndata_home = ${JSON.stringify(data)}\n[accounts.private]\nharness = "opencode"\ndb = ${JSON.stringify(join(data, 'private.db'))}\n`);
  const { report: r } = await report(root, { ...tools.env, XDG_CONFIG_HOME: config, XDG_DATA_HOME: data, OPENCODE_DB: join(root, 'ignored.db') });
  const own = check(r, 'opencode database');
  assert.equal(own.verdict, 'ok');
  assert.ok(own.detail.includes(join(data, 'cland', 'opencode', 'opencode.db')));
  assert.match(own.detail, /OPENCODE_DB=.*opencode auth login --standalone/);
  assert.match(own.detail, /no login needed for the free default/i);
  const probes = probeCalls.filter(call => call.bin.endsWith('/opencode') && call.args[0] === 'auth').map(({ args, database }) => ({ args, database }));
  assert.deepEqual(probes.slice(-2), [
    { args: ['auth', 'list', '--standalone', '--format', 'json'], database: join(data, 'cland', 'opencode', 'opencode.db') },
    { args: ['auth', 'list', '--standalone', '--format', 'json'], database: join(data, 'opencode', 'opencode.db') },
  ]);
  const shared = check(r, 'opencode database shared');
  assert.equal(shared.verdict, 'warn');
  assert.match(shared.detail, /background service.*resume/);
  assert.ok(shared.detail.includes(join(data, 'opencode', 'opencode.db')));
  assert.equal(check(r, 'opencode database private').verdict, 'ok');
  const fallback = await report(root, { ...tools.env, XDG_DATA_HOME: '' });
  assert.ok(check(fallback.report, 'opencode database').detail.includes(join(tools.env.HOME!, '.local', 'share', 'cland', 'opencode', 'opencode.db')));
});

test('doctor warns about free OpenCode training and its missing OS sandbox without failing', async t => {
  const tools = await toolchain(t);
  const root = await initialised(t, tools.env, true);
  const clock = new FakeClock();
  const { discovery } = await projectHub(t, root, tools.env, { clock, harnesses: 'fake', probes: 'fake' });
  const free = await report(root, tools.env);
  assert.equal(free.code, 0);
  const ui = await connectUi(t, discovery);
  // This launch has no admitted timer delay. Await its native I/O receipt with the
  // virtual clock frozen, so scheduler deadlines cannot outrun pending I/O.
  const launched = await ui.request({ type: 'session.launch', name: 'free-role', role: 'implementer' });
  assert.equal(launched.ok, true, 'doctor warnings do not refuse the launch');
  assert.equal(check(free.report, 'opencode model implementer').verdict, 'warn');
  assert.match(check(free.report, 'opencode model implementer').detail, /free.*may.*train.*code/i);
  assert.equal(check(free.report, 'opencode sandbox implementer').verdict, 'warn');
  assert.match(check(free.report, 'opencode sandbox implementer').detail, /no OS sandbox.*rules/i);
  const path = join(root, '.cland', 'roles.toml');
  const roles = await readFile(path, 'utf8');
  await writeFile(path, roles.replace('model = ""', 'model = "big-pickle#high"'));
  assert.equal(check((await report(root, tools.env)).report, 'opencode model implementer').verdict, 'warn');
  await writeFile(path, roles.replace('model = ""', 'model = "openai/paid-model"'));
  const paid = await report(root, tools.env);
  assert.equal(paid.code, 0);
  assert.ok(!paid.report.checks.some(c => c.name === 'opencode model implementer'));
  assert.equal(check(paid.report, 'opencode sandbox implementer').verdict, 'warn');
  await writeFile(path, roles.replace('harness = "opencode"', 'harness = "codex"'));
  assert.ok(!(await report(root, tools.env)).report.checks.some(c => /^opencode (model|sandbox) /.test(c.name)));
});


test('doctor counts live captures and names differing bytes and missing items without pruning', async t => {
  const tools = await toolchain(t);
  const root = await initialised(t, tools.env);
  const dir = join(root, '.cland/tasks');
  await mkdir(dir, { recursive: true });
  const uuid = '00000000-0000-4000-8000-000000000000';
  const same = `T-1-same.md.${uuid}.conflict`, changed = `T-2-changed.md.${uuid}.conflict`, missing = `T-3-missing.md.${uuid}.conflict`;
  assert.deepEqual(check((await report(root, tools.env, [])).report, 'tracker conflicts'), { name: 'tracker conflicts', verdict: 'ok', detail: '0 live captures; 0 differ from current item files' });
  await writeFile(join(dir, 'T-1-same.md'), 'same');
  await writeFile(join(dir, same), 'same');
  await writeFile(join(dir, 'T-2-changed.md'), 'current');
  await writeFile(join(dir, changed), 'saved');
  await writeFile(join(dir, missing), 'orphaned');
  await writeFile(join(dir, 'unrelated.conflict'), 'ignored');
  await writeFile(join(dir, `T-4-pending.md.${uuid}.tmp`), 'pending');
  const row = check((await report(root, tools.env, [])).report, 'tracker conflicts');
  assert.equal(row.verdict, 'warn');
  assert.equal(row.detail, `3 live captures; 2 differ from current item files: ${changed}, ${missing} (item missing)`);
  const plain = await doctor(root, tools.env);
  assert.ok(plain.stdout.includes(row.detail), plain.stdout);
  assert.equal(await readFile(join(dir, changed), 'utf8'), 'saved');
  assert.equal(await readFile(join(dir, 'T-2-changed.md'), 'utf8'), 'current');
});
