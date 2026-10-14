import { ownDirectory } from '../../hub/test/process-cleanup.ts';
// The session launcher and the sessions panel (#28) against a real hub: the three fake harnesses (Claude Code,
// Codex, OpenCode, from hub/test/fakes, first on the PATH as the adapter tests put them) are launched from the
// UI, show in the panel with their live state, attach in a terminal on Enter (each fake's attach client prints a
// line of its own), and a killed one turns `unknown` while the hub's log records the death.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectUi, fakeClaude, fakeCodex, killDaemon, spawnSpoke, startDaemon, tempProject } from '../../hub/test/harness.ts';
import { clock, nvimOrSkip, startClient, type Client } from './harness.ts';
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

// T-365: accounts through the same real-hub, fake-harness UI seam.
async function highlights(c: Client): Promise<Array<{ text: string; group: string }>> {
  return c.lua(`local b=require('cland.panels').bufs.sessions
    local lines=vim.api.nvim_buf_get_lines(b,0,-1,false); local out={}
    for _,m in ipairs(vim.api.nvim_buf_get_extmarks(b,vim.api.nvim_create_namespace('cland.panels'),0,-1,{details=true})) do
      out[#out+1]={text=lines[m[2]+1]:sub(m[3]+1,m[4].end_col),group=m[4].hl_group}
    end
    return out`);
}

test('accounts open above verification, show a fake Codex weekly window and follow pushes without re-reading', { skip }, async t => {
  const root = await tempProject(t);
  const config = join(root, 'config');
  const home = join(root, 'codex-b');
  await mkdir(join(config, 'cland'), { recursive: true });
  await mkdir(home);
  await writeFile(join(config, 'cland', 'accounts.toml'), `[accounts.codex-b]\nharness = "codex"\nhome = ${JSON.stringify(home)}\n[accounts.oc-b]\nharness = "opencode"\n[accounts.unread]\nharness = "claude-code"\n`);
  const fake = await fakeCodex(t);
  const reset = new Date();
  reset.setHours(23, 59, 0, 0);
  const limits = (usedPercent: number) => ({ rateLimits: { primary: { usedPercent, windowDurationMins: 10080, resetsAt: reset.getTime() / 1000 }, secondary: null } });
  const path = join(fake.home, 'rate-limits.json');
  await writeFile(path, JSON.stringify({ [home]: limits(19) }));
  const env = { ...fake.env, XDG_CONFIG_HOME: config };
  const { discovery } = await startDaemon(t, root, env);
  const ui = await connectUi(t, discovery);
  const launch = await ui.request({ type: 'session.launch', name: 'rev-x', role: 'reviewer', harness: 'codex', model: 'gpt-6.1-sol', account: 'codex-b' }, 30000);
  assert.equal(launch.ok, true, launch.error);
  const c = await startClient(t, bin, root, env);
  await waitInitialSnapshots(c);
  await c.lua("vim.api.nvim_set_current_win(require('cland.layout').win.right); vim.api.nvim_win_set_width(0, 80)");
  const shown = await c.waitScreen(s => s.includes(`wk 19% ↻${clock(reset.toISOString())}`), 'weekly account reading');
  assert.ok(shown.indexOf('Accounts') < shown.indexOf('verify:'));
  assert.match(shown, /oc-b\s+no limit data/);
  assert.match(shown, /unread\s+no reading yet/);
  await c.input('<Esc>gg/rev-x<CR>');
  await c.waitScreen(s => s.includes('Codex · gpt-6.1-sol · codex-b'), 'named account in session meta');
  // Fail any subsequent account.list locally: the push alone must update the screen.
  await c.lua(`local c = require('cland').client; local request = c.request
    c.request = function(self, frame, ...) assert(frame.type ~= 'account.list', 'unexpected account re-read'); return request(self, frame, ...) end`);
  await writeFile(path, JSON.stringify({ [home]: limits(91) }));
  assert.equal((await ui.request({ type: 'topic.send', topic: 'general', to: ['rev-x'], text: '@rev-x rate limits only' })).ok, true);
  await c.waitScreen(s => s.includes('wk 91%'), 'account push updates weekly window');
  assert.ok((await highlights(c)).some(m => m.text.includes('wk 91%') && m.group === 'ClandRed'));
  await writeFile(path, JSON.stringify({ [home]: limits(75) }));
  assert.equal((await ui.request({ type: 'topic.send', topic: 'general', to: ['rev-x'], text: '@rev-x rate limits only' })).ok, true);
  await c.waitScreen(s => s.includes('wk 75%'), '75 percent threshold');
  assert.ok((await highlights(c)).some(m => m.text.includes('wk 75%') && m.group === 'ClandAmber'));
  await c.input('ggza');
  await c.waitScreen(s => s.includes('Accounts (3)') && !s.includes('wk 75%'), 'folded accounts');
  await c.lua(`assert(vim.wait(5000,function()
    local ok,d=pcall(function() return vim.json.decode(table.concat(vim.fn.readfile(require('cland.state').S.root..'/.cland/ui.json'),'\\n')) end)
    return ok and d.accounts_folded == true
  end),'accounts fold was not saved')`);
  assert.equal(JSON.parse(await readFile(join(root, '.cland/ui.json'), 'utf8')).accounts_folded, true);
  const moved = c.restarted();
  await c.input(':restart<CR>');
  await moved;
  await waitInitialSnapshots(c);
  await c.waitScreen(s => s.includes('Accounts (3)'), 'fold restored after restart');
  await c.lua("vim.api.nvim_set_current_win(require('cland.layout').win.right)");
  await c.input('ggza');
  await c.waitScreen(s => s.includes('wk 75%') && !s.includes('Accounts (3)'), 'accounts unfolded');

});

test('source windows keep severity, local resets and stale age, wrap at 30 columns and leave default sessions unnamed', { skip }, async t => {
  const root = await tempProject(t);
  const config = join(root, 'config');
  await mkdir(join(config, 'cland'), { recursive: true });
  await writeFile(join(config, 'cland', 'accounts.toml'), '[accounts.claude-a]\nharness = "claude-code"\n');
  const fake = await fakeClaude(t);
  // Use a non-UTC zone to exercise reset conversion at the same UI boundary.
  const env = { ...fake.env, XDG_CONFIG_HOME: config, CLAUDE_CONFIG_DIR: config, TZ: 'Asia/Kolkata' };
  const { discovery } = await startDaemon(t, root, env);
  const ui = await connectUi(t, discovery);
  const launch = async (name: string, account?: string) => {
    const r = await ui.request({ type: 'session.launch', name, harness: 'claude-code', role: 'implementer', account }, 30000);
    assert.equal(r.ok, true, r.error);
    return (r.value as { process: { sessionId: string } }).process;
  };
  const named = await launch('impl-a', 'claude-a');
  const plain = await launch('impl-default');
  const now = Date.now();
  const today = new Date(now + 60_000).toISOString();
  const tomorrow = new Date(now + 86400_000).toISOString();
  const later = new Date(now + 14 * 86400_000).toISOString();
  const local = (iso: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: env.TZ, ...options }).format(new Date(iso));
  const time = (iso: string) => local(iso, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const date = new Date(now + 14 * 86400_000 + 5.5 * 3600_000).toISOString().slice(0, 10);
  const windows = [
    { kind: 'five_hour', percentUsed: 12.4, resetsAt: today, severity: 'warning' },
    { kind: 'seven_day', percentUsed: 3, resetsAt: tomorrow, severity: 'critical' },
    { kind: 'Fable', percentUsed: 98, resetsAt: later, severity: 'normal' },
  ];
  const signal = async (name: string, id: string, at: number) => {
    const r = await ui.request({ type: 'session.signal', session: name, launch: id, event: 'mod-measure', at, payload: { rateLimits: windows } });
    assert.equal(r.ok, true, r.error);
  };
  await signal('impl-a', named.sessionId, now - 31 * 60_000);
  await signal('impl-default', plain.sessionId, now);
  const c = await startClient(t, bin, root, env);
  await waitInitialSnapshots(c);
  await c.lua("vim.api.nvim_set_current_win(require('cland.layout').win.right); vim.api.nvim_win_set_width(0, 100)");
  const stale = await c.waitScreen(s => s.includes('31m') && s.includes('Fable 98%'), 'three windows and stale age');
  assert.match(stale, /claude-a\s+5h 12%/);
  assert.ok(stale.includes(`↻${time(today)}`));
  assert.ok(stale.includes(`↻${local(tomorrow, { weekday: 'short' })} ${time(tomorrow)}`));
  assert.ok(stale.includes(`↻${date}`));
  assert.ok(stale.indexOf('claude-a') < stale.indexOf('default:claude-code'));
  const dim = await highlights(c);
  assert.ok(dim.some(m => m.text.includes('31m') && m.group === 'ClandDim'));
  assert.ok(dim.some(m => m.text.includes('5h 12%') && m.group === 'ClandDim'));
  // Fresh default reading: the source's grade takes precedence even at a 98% share.
  assert.ok(dim.some(m => m.text.includes('5h 12%') && m.group === 'ClandAmber'));
  assert.ok(dim.some(m => m.text.includes('wk 3%') && m.group === 'ClandRed'));
  assert.ok(dim.some(m => m.text.includes('Fable 98%') && m.group === 'ClandText'));
  await c.input('<Esc>gg/impl-default<CR>');
  await c.waitScreen(s => s.includes('Claude Code ·') && s.includes('impl-default'), 'default session expanded');
  const meta = await c.lua<string[]>(`local b=require('cland.panels').bufs.sessions; local out={}
    for _,line in ipairs(vim.api.nvim_buf_get_lines(b,0,-1,false)) do if line:match('^   Claude Code') then out[#out+1]=line end end
    return out`);
  assert.equal(meta.length, 1);
  assert.doesNotMatch(meta[0]!, /default:|claude-a/);
  await c.lua("vim.api.nvim_win_set_width(0, 30); require('cland.state').changed()");
  const narrow = await c.waitScreen(s => s.includes('Fable 98%') && s.includes('31m'), 'wrapped windows');
  assert.ok(narrow.includes(`↻${date}`));
  const lines = await c.lua<Array<{ text: string; width: number }>>(`local out={}
    for _,line in ipairs(vim.api.nvim_buf_get_lines(require('cland.panels').bufs.sessions,0,-1,false)) do
      if line:find('verify:',1,true) then break end
      out[#out+1]={text=line,width=vim.api.nvim_strwidth(line)}
    end
    return out`);
  assert.ok(lines.every(line => line.width <= 30), JSON.stringify(lines));
  assert.equal(lines.filter(line => line.text.includes('Fable 98%')).length, 2);
  assert.ok(lines.some(line => /^   wk 3%/.test(line.text)), 'whole windows wrap to indented continuation lines');
  assert.ok(lines.every(line => !line.text.includes('…')), 'wrapping retains all source text');
});
