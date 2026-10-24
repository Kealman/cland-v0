import { fileURLToPath } from 'node:url';
// T2: screen permutations consume committed protocol frames through stub-client.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fixtureEnvironment } from '../../test-support/fixture-environment.ts';
import { NVIM_DIR } from '../bin/nvim-path.ts';
import { centreOf, nvimOrSkip, startClient } from './stub-client.ts';
import { tempProject } from './fixture.ts';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';

const nvim = await nvimOrSkip();

const skip = 'skip' in nvim ? nvim.skip : false;

const bin = 'bin' in nvim ? nvim.bin : '';

const composerLines = (c: { lua: <T>(code: string) => Promise<T> }) => c.lua<string[]>("return vim.api.nvim_buf_get_lines(vim.fn.bufnr('cland://composer/general'), 0, -1, false)");

const notice = (s: string): boolean => /^   ▲ /m.test(centreOf(s));

test('the default client environment seals poisoned parent homes, accounts, credentials and Git settings', { skip }, async t => {
  const root = await tempProject(t);
  const poison = {
    HOME: join(root, 'parent-home'), XDG_CONFIG_HOME: join(root, 'parent-config'),
    XDG_DATA_HOME: join(root, 'parent-data'), XDG_STATE_HOME: join(root, 'parent-state'),
    XDG_CACHE_HOME: join(root, 'parent-cache'), CODEX_HOME: join(root, 'parent-codex'),
    CLAUDE_CONFIG_DIR: join(root, 'parent-claude'), OPENCODE_DB: join(root, 'parent.db'),
    OPENAI_API_KEY: 'synthetic-parent-key', ANTHROPIC_API_KEY: 'synthetic-parent-key',
    DIGITALOCEAN_TOKEN: 'synthetic-parent-token', GITHUB_TOKEN: 'synthetic-parent-token',
    SSH_AUTH_SOCK: join(root, 'parent-agent'), GIT_DIR: join(root, 'parent-git'),
    GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'credential.helper', GIT_CONFIG_VALUE_0: 'synthetic-parent-helper',
    GIT_AUTHOR_NAME: 'Parent Identity', GIT_CONFIG_GLOBAL: join(root, 'parent-gitconfig'),
    NVIM_LOG_FILE: join(root, 'parent.log'),
  };
  const parent = process.env;
  // Poison only synthetic scratch inputs; even the red child cannot read real accounts.
  process.env = { ...fixtureEnvironment(root, parent), ...poison };
  let c;
  try {
    c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, fileURLToPath(new URL('./stub-hub.ts', import.meta.url))]) });
  } finally { process.env = parent; }
  const env = await c.lua<Record<string, string>>('return vim.fn.environ()');
  const scratch = dirname(env.HOME!);
  assert.notEqual(env.HOME, poison.HOME);
  assert.match(scratch, /\/cland-nv-[^/]+$/);
  for (const [key, leaf] of Object.entries({ HOME: 'home', XDG_CONFIG_HOME: 'config', XDG_DATA_HOME: 'opencode', XDG_STATE_HOME: 'state', XDG_CACHE_HOME: 'cache', CODEX_HOME: 'codex', CLAUDE_CONFIG_DIR: 'claude' })) {
    assert.equal(env[key], join(scratch, leaf), key);
  }
  assert.equal(env.GIT_AUTHOR_NAME, 'Fixture Test');
  assert.equal(env.GIT_AUTHOR_EMAIL, 'fixture@example.test');
  assert.equal(env.GIT_COMMITTER_NAME, 'Fixture Test');
  assert.equal(env.GIT_COMMITTER_EMAIL, 'fixture@example.test');
  assert.equal(env.GIT_CONFIG_GLOBAL, join(scratch, 'home/.gitconfig'));
  assert.equal(env.GIT_CONFIG_NOSYSTEM, '1');
  assert.equal(env.NVIM_LOG_FILE, join(scratch, 'state/cland-nvim/nvim.log'));
  for (const key of ['OPENCODE_DB', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'DIGITALOCEAN_TOKEN', 'GITHUB_TOKEN', 'SSH_AUTH_SOCK', 'GIT_DIR', 'GIT_CONFIG_COUNT', 'GIT_CONFIG_KEY_0', 'GIT_CONFIG_VALUE_0']) {
    assert.equal(env[key], undefined, key);
  }
});

test('explicit client inputs reach the launcher without restoring ambient accounts or Git overrides', { skip }, async t => {
  const root = await tempProject(t);
  const parent = process.env;
  process.env = { ...fixtureEnvironment(root, parent), CLAND_FIXTURE_AMBIENT: 'not-requested', FAKE_FIXTURE_AMBIENT: 'not-requested' };
  let c;
  try {
    c = await startClient(t, bin, root, {
      CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, fileURLToPath(new URL('./stub-hub.ts', import.meta.url))]),
      CLAND_FIXTURE_EXPLICIT: 'requested', HOME: join(root, 'untrusted-home'),
      OPENAI_API_KEY: 'synthetic-extra-key', CODEX_API_KEY: 'synthetic-extra-key',
      GIT_WORK_TREE: join(root, 'untrusted-tree'), GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'credential.helper', GIT_CONFIG_VALUE_0: 'synthetic-extra-helper',
    }, { launcher: true });
  } finally { process.env = parent; }
  const env = await c.lua<Record<string, string>>('return vim.fn.environ()');
  assert.equal(env.CLAND_FIXTURE_EXPLICIT, 'requested');
  assert.notEqual(env.HOME, join(root, 'untrusted-home'));
  for (const key of ['CLAND_FIXTURE_AMBIENT', 'FAKE_FIXTURE_AMBIENT', 'OPENAI_API_KEY', 'CODEX_API_KEY', 'GIT_WORK_TREE', 'GIT_CONFIG_COUNT', 'GIT_CONFIG_KEY_0', 'GIT_CONFIG_VALUE_0']) assert.equal(env[key], undefined, key);
});

test('Shift+Enter inserts a newline in the composer; Enter sends both lines as one message', { skip }, async (t) => {
  const root = await tempProject(t);
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, fileURLToPath(new URL('./stub-hub.ts', import.meta.url))]) });
  await c.waitScreen((s) => centreOf(s).includes('No messages in General yet.') && !notice(s), 'the empty General thread, connected');
  await c.input('first line<S-CR>second line');
  assert.deepEqual(await composerLines(c), ['› first line', 'second line']);
  assert.deepEqual(await c.lua('return vim.api.nvim_get_mode()'), { mode: 'i', blocking: false });
  await c.input('<CR>');
  const screen = await c.waitScreen((s) => /^[▎▌] first line *\n[▎▌] second line *$/m.test(centreOf(s)), 'the two-line message');
  assert.match(centreOf(screen), /⌁ queued/);
  assert.deepEqual(await composerLines(c), ['› ']);
});

test('nothing loads from the user configuration: every sourced script is the bundled runtime or nvim/', { skip }, async (t) => {
  const root = await tempProject(t);
  const state = join(root, 'state');
  await mkdir(join(state, 'cland'), { recursive: true });
  await writeFile(join(state, 'cland/spend.json'), 'hub spend');
  const c = await startClient(t, bin, root, { DIGITALOCEAN_TOKEN: 'test-token-not-real', XDG_STATE_HOME: state, CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, fileURLToPath(new URL('./stub-hub.ts', import.meta.url))]) }, { launcher: true });
  await c.waitScreen((s) => s.includes('General'), 'the client');
  const out = await c.rpc.request<{ output: string }>('nvim_exec2', 'scriptnames', { output: true });
  const runtime = realpathSync(await c.lua<string>('return vim.env.VIMRUNTIME'));
  const own = realpathSync(NVIM_DIR);
  const paths = out.output
    .split('\n')
    .map((l) => l.replace(/^\s*\d+:\s*/, '').trim())
    .filter(Boolean)
    .map((p) => p.replace(/^~/, process.env.HOME ?? '~'));
  assert.ok(paths.length > 0);
  assert.ok(paths.includes(join(own, 'init.lua')) || paths.some((p) => realpathSync(p) === join(own, 'init.lua')), `init.lua is sourced:\n${out.output}`);
  const foreign = paths.filter((p) => {
    const real = realpathSync(p);
    return !real.startsWith(`${runtime}/`) && !real.startsWith(`${own}/`);
  });
  assert.deepEqual(foreign, [], `scripts from outside the runtime and nvim/:\n${out.output}`);
  const appname = await c.lua<string>('return vim.env.NVIM_APPNAME');
  assert.equal(appname, 'cland-nvim');
  assert.equal(await c.lua('return vim.env.DIGITALOCEAN_TOKEN == nil'), true, 'the launched Neovim client has no executor credential');
  assert.equal(await c.lua("return vim.fn.stdpath('state')"), join(state, 'cland-nvim'));
  assert.deepEqual(await readdir(join(state, 'cland')), ['spend.json'], 'opening the workbench leaves only hub files in the hub state directory');
  assert.equal(await readFile(join(state, 'cland/spend.json'), 'utf8'), 'hub spend');
  // the ADR 0005 mitigations are in force
  assert.equal(await c.lua('return vim.o.termpastefilter'), 'BS,ESC,DEL');
  assert.equal(await c.lua('return vim.o.scrollback'), 10000);
  assert.equal(await c.lua('return vim.o.cmdheight'), 1);
  assert.equal(await c.lua("return vim.fn.maparg('<S-CR>', 't', false, true).desc"), 'cland: Send Shift+Enter to harness');
});

test('the workbench launcher isolates Neovim state and migrates only its legacy files once', { skip }, async t => {
  const root = await tempProject(t);
  const state = join(root, 'state');
  const old = join(state, 'cland');
  const current = join(state, 'cland-nvim');
  await mkdir(join(old, 'restart'), { recursive: true });
  await mkdir(join(current, 'restart'), { recursive: true });
  await writeFile(join(old, 'spend.json'), 'hub spend');
  await writeFile(join(old, 'accounts.json'), 'hub accounts');
  await writeFile(join(old, 'nvim.log'), 'old Neovim log');
  await writeFile(join(old, 'ui.json'), 'legacy UI');
  await writeFile(join(old, 'restart/project.json'), 'legacy restart');
  await writeFile(join(old, 'restart/existing.json'), 'older restart');
  await writeFile(join(current, 'restart/existing.json'), 'newer restart');
  await writeFile(join(old, 'restart/unknown.txt'), 'unowned');
  const env = {
    CLAND_HUB_TRANSPORT: 'stdio',
    CLAND_COMMAND: JSON.stringify([process.execPath, fileURLToPath(new URL('./stub-hub.ts', import.meta.url))]),
    XDG_STATE_HOME: state, XDG_DATA_HOME: join(root, 'data'), XDG_CONFIG_HOME: join(root, 'config'),
    NVIM_LOG_FILE: join(old, 'nvim.log'), NVIM_APPNAME: 'cland',
  };
  const c = await startClient(t, bin, root, env, { launcher: true });
  const paths = await c.lua<{ state: string; data: string; config: string; log: string }>(`
    return { state = vim.fn.stdpath('state'), data = vim.fn.stdpath('data'),
      config = vim.fn.stdpath('config'), log = vim.env.NVIM_LOG_FILE }
  `);
  assert.deepEqual(paths, { state: current, data: join(root, 'data/cland-nvim'), config: join(root, 'config/cland-nvim'), log: join(current, 'nvim.log') });
  await c.lua("vim.fn.writefile({'new Neovim log'}, vim.env.NVIM_LOG_FILE)");
  assert.equal(await readFile(join(current, 'ui.json'), 'utf8'), 'legacy UI');
  assert.equal(await readFile(join(current, 'restart/project.json'), 'utf8'), 'legacy restart');
  assert.equal(await readFile(join(current, 'restart/existing.json'), 'utf8'), 'newer restart');
  assert.deepEqual((await readdir(old)).sort(), ['accounts.json', 'nvim.log', 'restart', 'spend.json']);
  assert.deepEqual((await readdir(join(old, 'restart'))).sort(), ['existing.json', 'unknown.txt']);
  assert.equal(await readFile(join(old, 'spend.json'), 'utf8'), 'hub spend');
  assert.equal(await readFile(join(old, 'accounts.json'), 'utf8'), 'hub accounts');
  assert.equal(await readFile(join(old, 'nvim.log'), 'utf8'), 'old Neovim log');
  assert.match(c.stderr(), /cland-nvim: migrated .*ui.json.*restart\/project.json/);
  assert.equal(c.stderr().split('\n').filter(line => line.startsWith('cland-nvim: migrated ')).length, 1);
  // Even a subsequently recreated legacy file must never overwrite the migrated preference.
  await writeFile(join(old, 'ui.json'), 'recreated legacy UI');
  const again = await startClient(t, bin, root, env, { launcher: true });
  assert.equal(await readFile(join(current, 'ui.json'), 'utf8'), 'legacy UI');
  assert.equal(await readFile(join(old, 'ui.json'), 'utf8'), 'recreated legacy UI');
  assert.doesNotMatch(again.stderr(), /cland-nvim: migrated/);
});


test('workbench autostart waits for the recorded operator restart window before invoking the CLI', { skip }, async t => {
  const root = await tempProject(t);
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, fileURLToPath(new URL('./stub-hub.ts', import.meta.url))]) });
  await c.waitScreen(s => centreOf(s).includes('No messages in General yet.') && !notice(s), 'stub connected');
  const stoppedAt = Date.parse('2026-10-19T21:33:40Z');
  // Recorded marker contract: CLI tests cover the writer; this client consumes fixture data.
  await mkdir(join(root, '.cland/run'), { recursive: true });
  await writeFile(join(root, '.cland/run/hub-stop.json'), JSON.stringify({ expiresAt: stoppedAt + 30_000 }));
  const result = await c.lua<{ inside: number[]; after: number; command: string[] }>(`
    local Hub = require('cland.hub')
    local gettimeofday, defer, system = vim.uv.gettimeofday, vim.defer_fn, vim.system
    local now, timers, commands = ..., {}, {}
    local function advance(ms)
      local target = now + ms
      while timers[1] and timers[1].at <= target do
        local timer = table.remove(timers, 1)
        now = timer.at
        timer.fn()
      end
      now = target
    end
    vim.uv.gettimeofday = function() return math.floor(now / 1000), (now % 1000) * 1000 end
    vim.defer_fn = function(fn, ms)
      timers[#timers + 1] = { at = now + ms, fn = fn }
      table.sort(timers, function(a, b) return a.at < b.at end)
      return {}
    end
    vim.system = function(cmd) commands[#commands + 1] = cmd; return {} end
    local client = Hub.new({ root = ${JSON.stringify(root)}, cli = { 'fixture-cland' } })
    local ok, value = pcall(function()
      client:start()
      local inside = { #commands }
      advance(12000); inside[#inside + 1] = #commands
      advance(17999); inside[#inside + 1] = #commands
      advance(5001)
      return { inside = inside, after = #commands, command = commands[1] }
    end)
    client:stop()
    vim.uv.gettimeofday, vim.defer_fn, vim.system = gettimeofday, defer, system
    assert(ok, value)
    return value
  `, stoppedAt);
  assert.deepEqual(result.inside, [0, 0, 0], 'no hub start before the 30 s window expires, including the incident at +12 s');
  assert.equal(result.after, 1, 'fallback starts after the window');
  assert.deepEqual(result.command, ['fixture-cland', 'hub', 'start', '--autostart', '--client', 'nvim']);
});
