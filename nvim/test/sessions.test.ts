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
import { connectUi, fakeClaude, killDaemon, spawnSpoke, startDaemon, tempProject } from '../../hub/test/harness.ts';
import { nvimOrSkip, startClient, type Client } from './harness.ts';
import { waitInitialSnapshots } from './readiness.ts';

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
  const until = Date.now() + 5000;
  while ((await c.mode()) !== 'n' && Date.now() < until) await new Promise((r) => setTimeout(r, 30));
}

test('the sessions item column shows verifier holds and returns to free on release', { skip }, async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ size: 'M', type: 'task.create', title: 'Panel holds' })).ok, true);
  const rev = await spawnSpoke({ discover: true, cwd: root, name: 'rev', sessionId: 'rev-id', role: 'reviewer' });
  const qa = await spawnSpoke({ discover: true, cwd: root, name: 'qa-one', sessionId: 'qa-id', role: 'qa' });
  t.after(async () => { await rev.close(); await qa.close(); });
  await rev.waitForPresence(['rev', 'qa-one']);
  const c = await startClient(t, bin, root);
  const row = (screen: string, name: string) => screen.split('\n').find(line => line.includes(`${name} [`)) ?? '';
  await c.waitScreen(s => row(s, 'rev').includes('free') && row(s, 'qa-one').includes('free'), 'free verifiers');
  for (const [session, name, tag] of [[rev, 'rev', 'review'], [qa, 'qa-one', 'qa']] as const) {
    assert.equal((await session.call<{ ok: boolean }>('task.hold', { id: 'T-1' })).ok, true);
    await c.waitScreen(s => row(s, name).includes(`T-1 ${tag}`), `${tag} hold in the item column`);
    assert.equal((await session.call<{ ok: boolean }>('task.hold', { id: 'T-1', release: true })).ok, true);
    await c.waitScreen(s => row(s, name).includes('free'), `${name} free after release`);
  }
  // A retained claim beside verifier work: the claim is displayed first.
  assert.equal((await ui.request({ size: 'M', type: 'task.create', title: 'Claim beside review', assignee: 'rev' })).ok, true);
  assert.equal((await ui.request({ type: 'role.set', session: 'rev', role: 'implementer' })).ok, true);
  const claim = await rev.call<{ ok: boolean }>('task.claim', { id: 'T-2' });
  assert.equal(claim.ok, true, JSON.stringify(claim));
  assert.equal((await ui.request({ type: 'role.set', session: 'rev', role: 'reviewer' })).ok, true);
  assert.equal((await rev.call<{ ok: boolean }>('task.hold', { id: 'T-1' })).ok, true);
  // Widen the panel so both held items are visible on the grid.
  await c.lua("vim.api.nvim_win_set_width(require('cland.layout').win.right, 65)");
  await c.waitScreen(s => row(s, 'rev').includes('T-2 item, T-1 review'), 'claim before verifier hold');
  assert.equal((await rev.call<{ ok: boolean }>('task.hold', { id: 'T-1', release: true })).ok, true);
  const claimed = await c.waitScreen(s => row(s, 'rev').includes('T-2 item') && !row(s, 'rev').includes('T-1 review'), 'claim survives verifier release');
  assert.ok(!row(claimed, 'rev').includes('free'));
});

test('Claude Code, Codex and OpenCode sessions launched from the UI show in the panel with live state, attach on Enter, and a killed one turns unknown with the death in the hub log', { skip, timeout: 180_000 }, async (t) => {
  const root = await tempProject(t);
  const claude = await fakeClaude(t);
  const codexHome = await fakeHome(t, 'fake-codex-');
  const opencodeHome = await fakeHome(t, 'fake-opencode-');
  const env = {
    ...claude.env,
    PATH: `${FAKE_CODEX_DIR}:${FAKE_OPENCODE_DIR}:${claude.env.PATH}`,
    FAKE_CODEX_HOME: codexHome,
    FAKE_CODEX_TURN_MS: '300',
    FAKE_OPENCODE_HOME: opencodeHome,
    FAKE_OPENCODE_TURN_MS: '300',
  };
  const { discovery } = await startDaemon(t, root, env);
  const ui = await connectUi(t, discovery);
  const c = await startClient(t, bin, root, { ...env, CLAND_REFRESH_MS: '500' });
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
  for (const name of ['coord', 'rev', 'impl']) assert.match(log, new RegExp(`"event":"session-launched","session":"${name}"`));

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
  process.kill(session.pid, 'SIGKILL');
  await focusPanel(c);
  await c.input('zRgg/^ . coord \\[<CR>');
  await c.waitScreen((x) => /✗ coord \[Coordinator\]/.test(x) && x.includes('unknown · died'), 'coord unknown after its death', 15_000);
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
