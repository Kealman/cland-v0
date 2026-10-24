// T3: UI-launched native harness attach, death and stop.
import { eventually } from './fixture.ts';
import { ownDirectory } from '../../hub/test/process-cleanup.ts';
// The session launcher and the sessions panel (#28) against a real hub: the three fake harnesses (Claude Code,
// Codex, OpenCode, from hub/test/fakes, first on the PATH as the adapter tests put them) are launched from the
// UI, show in the panel with their live state, attach in a terminal on Enter (each fake's attach client prints a
// line of its own), and a killed one turns `unknown` while the hub's log records the death.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectUi, fakeClaude, killDaemon, startDaemon, tempProject } from '../../hub/test/harness.ts';
import { nvimOrSkip, startClient, type Client } from './harness.ts';
import { waitInitialSnapshots } from './readiness.ts';
import { accountFixtureEnvironment } from '../../hub/test/account-fixture-env.ts';

const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';

const FAKE_CODEX_DIR = fileURLToPath(new URL('../../hub/test/fakes/codex', import.meta.url));
const FAKE_OPENCODE_DIR = fileURLToPath(new URL('../../hub/test/fakes/opencode', import.meta.url));

/** A fake's home (its state, the servers it started), its servers killed when the test ends. */
async function fakeHome(t: TestContext, prefix: string): Promise<string> {
  const home = await realpath(await mkdtemp(join(tmpdir(), prefix)));
  const cleanupHome = ownDirectory(undefined, home);
  t.after(async () => {
    const files = await readdir(join(home, 'servers')).catch(() => [] as string[]);
    for (const f of files) {
      const s = JSON.parse(await readFile(join(home, 'servers', f), 'utf8').catch(() => 'null')) as { pid?: number } | null;
      if (s?.pid) await killDaemon(s.pid);
    }
    await cleanupHome();
  });
  return home;
}

const statusLine = (s: string) => s.split('\n')[43] ?? '';
const hubLog = (root: string) => readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8').catch(() => '');

/** Fill the launcher: name, role, then the harness and the model over the role's defaults. */
async function launch(c: Client, name: string, role: string, harness: string, model: string) {
  await c.input('<Space>l');
  await c.waitScreen((x) => x.includes('launch a session'), `the launcher for ${name}`);
  await c.input(`${name}<Tab>${role}<Tab><C-u>${harness}<Tab><C-u>${model}<CR>`);
  await c.waitScreen((x) => !x.includes('launch a session'), `${name} launched (the form closed)`, 30_000);
}

/** The sessions panel focused, in Normal mode, whatever had the focus (a terminal in Terminal mode included). */
async function focusPanel(c: Client) {
  await c.lua("vim.cmd('stopinsert'); vim.api.nvim_set_current_win(require('cland.layout').win.right)");
  await eventually('the sessions panel reaches Normal mode', async () => await c.mode() === 'n' || undefined);
}

test('Claude Code, Codex and OpenCode sessions launched from the UI show in the panel with live state, attach on Enter, and a killed one turns unknown with the death in the hub log', { skip, timeout: 180_000 }, async (t) => {
  const root = await tempProject(t);
  const claude = await fakeClaude(t, { reexecGraceMs: 100 });
  const codexHome = await fakeHome(t, 'fake-codex-');
  const opencodeHome = await fakeHome(t, 'fake-opencode-');
  // Launch and attach must share account identity as well as fake state homes.
  // Each child still applies its final sealing filter to these explicit inputs.
  const env = await accountFixtureEnvironment({
    ...claude.env,
    PATH: `${FAKE_CODEX_DIR}:${FAKE_OPENCODE_DIR}:${claude.env.PATH}`,
    FAKE_CODEX_HOME: codexHome,
    FAKE_CODEX_TURN_MS: '30',
    FAKE_CODEX_REFUSE_MS: '150',
    FAKE_OPENCODE_HOME: opencodeHome,
    FAKE_OPENCODE_TURN_MS: '30',
  });
  const { discovery } = await startDaemon(t, root, env);
  const ui = await connectUi(t, discovery);
  const c = await startClient(t, bin, root, { ...env, CLAND_REFRESH_MS: '500' });
  const clientEnv = await c.lua<Record<string, string>>('return vim.fn.environ()');
  for (const key of ['FAKE_CLAUDE_HOME', 'FAKE_CODEX_HOME', 'FAKE_OPENCODE_HOME', 'CLAUDE_CONFIG_DIR', 'CODEX_HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME']) {
    assert.equal(clientEnv[key], env[key], `${key} is shared by launch and attach`);
  }
  await c.waitScreen((x) => x.includes('SESSIONS') && statusLine(x).includes('hub: connected'), 'the workbench, connected');
  await waitInitialSnapshots(c);
  await c.input('<Esc>');

  await launch(c, 'coord', 'coordinator', 'claude-code', 'claude-fake-1');
  await launch(c, 'rev', 'reviewer', 'codex', 'gpt-fake-2');
  await launch(c, 'impl', 'implementer', 'opencode', 'opencode/fake-free');
  await c.waitScreen(x => /coord \[Coordinator\]/.test(x) && /rev \[Reviewer\]/.test(x) && /impl \[Implementer\]/.test(x), 'three session rows');
  for (const [name, model] of [['coord','claude-fake-1'], ['rev','gpt-fake-2'], ['impl','opencode/fake-free']]) {
    await focusPanel(c);
    await c.input(`gg/^ . ${name} \\[<CR>`);
    const s = await c.waitScreen(x => x.includes(model!) && /idle|busy/.test(x), `${name} selected with model`, 30000);
    assert.doesNotMatch(s, /refused/);
  }
  const launchedLogs = await ui.request({ type: 'hub.status', flushLogs: true });
  assert.equal(launchedLogs.ok, true, launchedLogs.error);
  const log = await hubLog(root);
  const records = log.split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line) as { event: string; session?: string; account?: string | null });
  for (const name of ['coord', 'rev', 'impl']) {
    const launched = records.find(record => record.event === 'session-launched' && record.session === name);
    assert.ok(launched, `launch record for ${name}`);
    assert.equal(launched.account, null, 'an unpinned launch records no named account');
  }

  // Enter attaches in the centre: each fake's attach client prints its line in the terminal
  const attached: Array<[string, RegExp]> = [
    ['coord', /fake claude attached to [0-9a-f]{8} \(coord\)/],
    ['rev', /fake codex attached to thread \S+ \(\w+\)/],
    ['impl', /fake opencode TUI on http:\/\/127\.0\.0\.1:\d+ session ses_/],
  ];
  for (const [name, printed] of attached) {
    await focusPanel(c);
    await c.input(`gg/^ . ${name} \\[<CR><CR>`);
    await c.waitScreen((x) => printed.test(x) && x.includes(`${name} · session`), `${name} attached in the centre`, 15_000);
  }

  // the Claude Code session's process dies: unknown in the panel, harness-exited in the hub's log
  const [session] = await claude.sessions();
  assert.ok(session, 'the fake Claude Code session runs');
  await focusPanel(c);
  await c.input('zRgg/^ . coord \\[<CR>');
  const published = c.waitScreen((x) => /✗ coord \[Coordinator\]/.test(x) && x.includes('unknown · died'), 'coord unknown after its death', 15_000);
  process.kill(session.pid, 'SIGKILL');
  await killDaemon(session.pid);
  await published;
  const deathLogs = await ui.request({ type: 'hub.status', flushLogs: true });
  assert.equal(deathLogs.ok, true, deathLogs.error);
  assert.match(await hubLog(root), /"event":"harness-exited","session":"coord"/);

  // x then y stops the Codex session through the hub
  await focusPanel(c);
  await c.input('gg/^ . rev \\[<CR>x');
  await c.waitScreen((x) => x.includes('stop rev? y stops it'), 'the confirmation line');
  await c.input('y');
  await c.waitScreen((x) => x.includes('rev stopped'), 'stop accepted', 15000);
  await c.input('gg/^ . rev \\[<CR>');
  await c.waitScreen((x) => x.includes('rev stopped') && /× rev \[Reviewer\]/.test(x), 'rev stopped', 15_000);
  const stoppedLogs = await ui.request({ type: 'hub.status', flushLogs: true });
  assert.equal(stoppedLogs.ok, true, stoppedLogs.error);
  assert.match(await hubLog(root), /"event":"session-stopped","session":"rev"/);
});

