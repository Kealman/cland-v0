// `cland doctor` (spec 4.9, #40) run as the CLI against an initialised temporary project, with the fake harnesses,
// a fake `gh` and a stub Neovim as the only tools on its PATH and a real hub started there; each failure is made on
// disk or in the fakes' environment, and the report is read from stdout and the exit code.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clandWithEnv, startDaemon, tempProject, type CliResult } from './harness.ts';

const FAKES = fileURLToPath(new URL('./fakes/', import.meta.url));
const FAKE_GH_DIR = fileURLToPath(new URL('./fixtures/fake-gh', import.meta.url));
const NVIM_VERSION = (await readFile(new URL('../../nvim/NVIM_VERSION', import.meta.url), 'utf8')).trim();

type Check = { name: string; verdict: 'ok' | 'warn' | 'fail'; detail: string; fix?: string };
type Report = { root: string; version: string; checks: Check[]; summary: { ok: number; warn: number; fail: number } };

const HARNESS_DIRS = { claude: join(FAKES, 'claude-code'), codex: join(FAKES, 'codex'), opencode: join(FAKES, 'opencode') };

/**
 * The doctor's environment: a PATH of the fakes, a folder holding `node` (the fakes run on it) and the system's
 * /usr/bin:/bin, so no real `claude`, `codex`, `opencode`, `gh` or `nvim` on this machine is ever found.
 */
async function toolchain(t: TestContext): Promise<{ env: Record<string, string>; path: (without?: keyof typeof HARNESS_DIRS) => string }> {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'cland-doctor-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const bin = join(dir, 'bin');
  await mkdir(bin);
  await symlink(process.execPath, join(bin, 'node'));
  const nvim = join(dir, 'nvim');
  await writeFile(nvim, `#!/bin/sh\necho "NVIM ${NVIM_VERSION}"\necho "Build type: Release"\n`);
  await chmod(nvim, 0o755);
  const path = (without?: keyof typeof HARNESS_DIRS) =>
    [...Object.entries(HARNESS_DIRS).filter(([k]) => k !== without).map(([, d]) => d), FAKE_GH_DIR, bin, '/usr/bin', '/bin'].join(':');
  const env = {
    PATH: path(),
    CLAND_NVIM: nvim,
    FAKE_CLAUDE_HOME: join(dir, 'claude-home'),
    FAKE_CODEX_HOME: join(dir, 'codex-home'),
    FAKE_OPENCODE_HOME: join(dir, 'opencode-home'),
  };
  return { env, path };
}

const doctor = (root: string, env: Record<string, string>, ...args: string[]): Promise<CliResult> => clandWithEnv(root, env, 'doctor', ...args);

async function report(root: string, env: Record<string, string>): Promise<{ code: number | null; report: Report }> {
  const r = await doctor(root, env, '--json');
  try {
    return { code: r.code, report: JSON.parse(r.stdout) as Report };
  } catch {
    throw new Error(`cland doctor --json printed no JSON (${r.code}):\n${r.stdout}\n${r.stderr}`);
  }
}

const check = (r: Report, name: string): Check => {
  const c = r.checks.find((x) => x.name === name);
  assert.ok(c, `no check named ${name} in ${r.checks.map((x) => x.name).join(', ')}`);
  return c;
};

const notOk = (r: Report) => r.checks.filter((c) => c.verdict !== 'ok').map((c) => `${c.verdict} ${c.name}: ${c.detail} — ${c.fix ?? ''}`);

async function initialised(t: TestContext, env: Record<string, string>): Promise<string> {
  const root = await tempProject(t, 'cland-doctor-proj-');
  const init = await clandWithEnv(root, env, 'init');
  assert.equal(init.code, 0, init.stderr);
  return root;
}

test('a healthy project on a healthy machine: every check ok, plain text, exit 0; then each failure faked names itself and its fix', async (t) => {
  const tools = await toolchain(t);
  const root = await initialised(t, tools.env);
  await startDaemon(t, root);

  await t.test('every check is ok and the exit code is 0', async () => {
    const { code, report: r } = await report(root, tools.env);
    assert.deepEqual(notOk(r), []);
    assert.equal(code, 0);
    const names = r.checks.map((c) => c.name);
    for (const name of ['claude-code', 'claude-code auth', 'codex', 'codex auth', 'opencode', 'opencode auth', 'gh', 'gh auth', 'neovim', 'hub', 'hub.json', 'secret', 'roles.toml', 'config.toml', 'skills', 'skills manifest', 'claude hooks', 'cland mod', 'docs/agents', 'AGENTS.md']) {
      assert.ok(names.includes(name), `the report checks ${name}`);
    }
    assert.match(check(r, 'claude-code').detail, /^2\.1\.294 at .*fakes\/claude-code\/claude \(tested >=2\.1\.294 <2\.2\.0\)$/);
    assert.match(check(r, 'neovim').detail, new RegExp(`^${NVIM_VERSION.replace(/\./g, '\\.')} at `));
    assert.match(check(r, 'hub').detail, /^running: pid \d+, holds the lock, answers hub\.status/);
  });

  await t.test('the text report is plain: one line per check, no ANSI escapes when stdout is not a terminal', async () => {
    const r = await doctor(root, tools.env);
    assert.equal(r.code, 0, r.stdout);
    assert.doesNotMatch(r.stdout, /\x1b\[/);
    const lines = r.stdout.trimEnd().split('\n');
    assert.match(lines[0] ?? '', /^cland doctor \S+ in /);
    assert.match(lines.at(-1) ?? '', /^20 ok, 0 warn, 0 fail$/);
    for (const line of lines.slice(1, -1)) assert.match(line, /^ok {4}\S/);
  });

  await t.test('--json: root, version, checks of name/verdict/detail, the summary', async () => {
    const { report: r } = await report(root, tools.env);
    assert.equal(r.root, root);
    assert.equal(typeof r.version, 'string');
    assert.deepEqual(r.summary, { ok: r.checks.length, warn: 0, fail: 0 });
    for (const c of r.checks) assert.deepEqual(Object.keys(c).sort(), ['detail', 'name', 'verdict']);
  });

  await t.test('a harness version outside the tested range is a warning, not a failure', async () => {
    const { code, report: r } = await report(root, { ...tools.env, FAKE_CLAUDE_VERSION: '2.3.0' });
    const c = check(r, 'claude-code');
    assert.equal(c.verdict, 'warn');
    assert.match(c.detail, /^2\.3\.0 at .* outside the tested range >=2\.1\.294 <2\.2\.0$/);
    assert.ok(c.fix);
    assert.deepEqual(notOk(r).length, 1);
    assert.equal(code, 0);
    const older = await report(root, { ...tools.env, FAKE_CLAUDE_VERSION: '2.1.100' });
    assert.equal(check(older.report, 'claude-code').verdict, 'warn');
    assert.match(check(older.report, 'claude-code').fix ?? '', /upgrade claude to 2\.1\.294/);
  });

  await t.test('a harness missing from the PATH fails with the fix', async () => {
    const { code, report: r } = await report(root, { ...tools.env, PATH: tools.path('codex') });
    const c = check(r, 'codex');
    assert.equal(c.verdict, 'fail');
    assert.equal(c.detail, 'not installed: `codex` is not on the PATH');
    assert.match(c.fix ?? '', /install Codex .*or set CLAND_CODEX_BIN to its path/);
    assert.equal(check(r, 'codex auth').verdict, 'fail');
    assert.equal(code, 1);
    // the adapter's override is honoured
    const viaOverride = await report(root, { ...tools.env, PATH: tools.path('codex'), CLAND_CODEX_BIN: join(HARNESS_DIRS.codex, 'codex') });
    assert.equal(check(viaOverride.report, 'codex').verdict, 'ok');
  });

  await t.test('a harness that is not signed in fails with its login command; OpenCode without credentials warns', async () => {
    const { code, report: r } = await report(root, { ...tools.env, FAKE_CLAUDE_LOGGED_OUT: '1', FAKE_CODEX_LOGGED_OUT: '1', FAKE_OPENCODE_NO_AUTH: '1', FAKE_GH_LOGGED_OUT: '1' });
    assert.deepEqual(
      ['claude-code auth', 'codex auth', 'opencode auth', 'gh auth'].map((n) => [n, check(r, n).verdict, check(r, n).fix]),
      [
        ['claude-code auth', 'fail', 'claude auth login'],
        ['codex auth', 'fail', 'codex login'],
        ['opencode auth', 'warn', 'opencode auth login'],
        ['gh auth', 'fail', 'gh auth login'],
      ],
    );
    assert.equal(code, 1);
  });

  await t.test('Neovim not at the pinned version, or missing', async () => {
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

  await t.test('roles.toml that does not parse fails, naming the TOML error', async () => {
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

  await t.test('config.toml that does not parse fails, naming the TOML error', async () => {
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

  await t.test('a broken skills symlink fails with the fix', async () => {
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
    const update = await clandWithEnv(root, tools.env, 'update');
    assert.equal(update.code, 0, update.stderr);
    const after = await report(root, tools.env);
    assert.deepEqual(notOk(after.report), []);
  });

  await t.test('the managed hooks or AGENTS.md block removed: named failures, fixed by cland update', async () => {
    const settings = join(root, '.claude', 'settings.json');
    await writeFile(settings, '{}\n');
    const agents = join(root, 'AGENTS.md');
    await writeFile(agents, '# Our own instructions\n');
    const { report: r } = await report(root, tools.env);
    assert.equal(check(r, 'claude hooks').verdict, 'fail');
    assert.equal(check(r, 'claude hooks').fix, 'cland update');
    assert.equal(check(r, 'AGENTS.md').verdict, 'fail');
    assert.equal(check(r, 'AGENTS.md').fix, 'cland update');
    assert.equal((await clandWithEnv(root, tools.env, 'update')).code, 0);
    assert.deepEqual(notOk((await report(root, tools.env)).report), []);
  });

  await t.test("the hub's discovery file removed: a named failure with the fix", async () => {
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
});

test('a project with no hub: the hub is a warning (startable), the exit code 0; a folder never initialised fails', async (t) => {
  const tools = await toolchain(t);
  const root = await initialised(t, tools.env);
  const { code, report: r } = await report(root, tools.env);
  assert.equal(check(r, 'hub').verdict, 'warn');
  assert.equal(check(r, 'hub').fix, 'cland hub start');
  assert.equal(check(r, 'hub.json').verdict, 'ok');
  assert.equal(code, 0);

  // a secret others can read
  const started = await startDaemon(t, root);
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
