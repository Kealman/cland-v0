// T3: terminal attachment/key transport, interruption, reconnect, editor restart and negative no-poll windows.
// Screen permutations live in shell-component.test.ts; workbench owns the shared real-hub flow.
import { ownDirectory } from '../../hub/test/process-cleanup.ts';
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createConnection } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { centreOf, nvimOrSkip, startClient, type Client } from './harness.ts';
import { waitInitialSnapshots } from './readiness.ts';
import type { Scenario } from './stub-hub.ts';

const nvim = await nvimOrSkip();

const skip = 'skip' in nvim ? nvim.skip : false;

const bin = 'bin' in nvim ? nvim.bin : '';

const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));

const KEYLOG = fileURLToPath(new URL('./fakes/keylog.ts', import.meta.url));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ts = (min: number) => new Date(Date.UTC(2026, 9, 8, 10, min)).toISOString();

const CAPS = {
  history: 'none',
  usage: 'reliable',
  setModel: 'none',
  approvalRelay: 'none',
  states: { busy: 'reliable', idle: 'reliable', 'waiting for approval': 'reliable', 'waiting for human': 'heuristic' },
};

const proc = (name: string, role: string, state: string, model = 'opus') => ({
  name,
  harness: 'claude-code',
  role,
  model,
  cwd: '/tmp',
  pid: 1,
  harnessId: `${name}-bg`,
  sessionId: `${name}-id`,
  harnessSessionId: null,
  startedAt: ts(0),
  status: 'running',
  state,
  attach: `claude attach ${name}-bg`,
});

function baseScenario(keylog: string): Scenario {
  return {
    inbox: {},
    messages: {
      general: [
        { id: 'm1', from: 'coord-1', fromKind: 'agent', fromRole: 'coordinator', via: 'spoke', to: ['human'], text: 'Starting T-12 with impl-1; the log is in Agents.', ts: ts(1), topic: 'general' },
      ],
      agents: [{ id: 'm2', from: 'impl-1', fromKind: 'agent', fromRole: 'implementer', via: 'spoke', to: ['coord-1'], text: 'T-12 claimed.', ts: ts(2), topic: 'agents' }],
    },
    processes: [proc('coord-1', 'coordinator', 'busy'), proc('impl-1', 'implementer', 'waiting for human', 'sonnet')],
    adapters: { 'claude-code': CAPS },
    items: [
      { id: 'T-12', kind: 'task', title: 'Hub daemon and spoke hello', status: 'in progress', state: 'open', labels: [], assignee: null, parent: null, blocked_by: [], topic: null, branch: null, created: ts(0), updated: ts(0), file: '.cland/tasks/T-12-hub.md', claim: { session: 'impl-1', sessionId: 'impl-1-id', role: 'implementer', claimedAt: ts(1) } },
      { id: 'T-13', kind: 'task', title: 'Codex adapter', status: 'backlog', state: 'open', labels: [], assignee: null, parent: null, blocked_by: [], topic: null, branch: null, created: ts(0), updated: ts(0), file: '.cland/tasks/T-13-codex.md', claim: null },
    ],
    attach: {
      'coord-1': `${JSON.stringify(process.execPath)} ${JSON.stringify(KEYLOG)} ${JSON.stringify(keylog)}`,
      'impl-1': `printf 'attached impl-1\\n'; sleep 600`,
    },
  };
}

type Shell = Client & {
  root: string;
  keylog: string;
  control: (cmd: Record<string, unknown>) => Promise<Record<string, unknown>>;
  /** Change the scenario file: what the next stub hub reads when the client spawns it again. */
  rewrite: (edit: (s: Scenario) => void) => Promise<void>;
  /** The stub hub dies after `rewrite`; the client reconnects to a new one, which reads the file again. */
  reconnect: (edit?: (s: Scenario) => void) => Promise<void>;
};

async function startShell(t: TestContext, edit: (s: Scenario) => void = () => {}, env: Record<string, string> = {}, initialSnapshots = true): Promise<Shell> {
  const dir = await mkdtemp(join(tmpdir(), 'cland-sh-'));
  ownDirectory(t, dir);
  const root = join(dir, 'proj-shell');
  await mkdir(join(root, '.git'), { recursive: true });
  const keylog = join(dir, 'keylog.txt');
  const scenario = baseScenario(keylog);
  edit(scenario);
  const scenarioFile = join(dir, 'scenario.json');
  await writeFile(scenarioFile, JSON.stringify(scenario));
  const controlPath = join(dir, 'ctl.sock');
  const c = await startClient(t, bin, root, {
    CLAND_HUB_TRANSPORT: 'stdio',
    CLAND_COMMAND: JSON.stringify([process.execPath, STUB]),
    CLAND_STUB_SCENARIO: scenarioFile,
    CLAND_STUB_CONTROL: controlPath,
    CLAND_REFRESH_MS: '300',
    ...env,
  });
  const control = async (cmd: Record<string, unknown>) => {
    const until = Date.now() + 10_000;
    while (!existsSync(controlPath)) {
      if (Date.now() > until) throw new Error('the stub hub never opened its control socket');
      await sleep(20);
    }
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const sock = createConnection(controlPath);
      let buf = '';
      let done = false;
      const timer = setTimeout(() => {
        sock.destroy();
        finish(new Error(`the stub hub never answered ${JSON.stringify(cmd)}`));
      }, 10_000);
      const finish = (err: Error | null, value?: Record<string, unknown>) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (err) reject(err);
        else resolve(value ?? {});
      };
      sock.setEncoding('utf8');
      sock.on('data', (d: string) => {
        buf += d;
        if (buf.includes('\n')) {
          sock.end();
          finish(null, JSON.parse(buf.slice(0, buf.indexOf('\n'))) as Record<string, unknown>);
        }
      });
      sock.on('error', (err) => finish(err));
      sock.on('close', () => finish(new Error(`the stub hub closed the control socket without answering ${JSON.stringify(cmd)}`)));
      sock.write(`${JSON.stringify(cmd)}\n`);
    });
  };
  const rewrite = async (change: (s: Scenario) => void) => {
    const now = JSON.parse(await readFile(scenarioFile, 'utf8')) as Scenario;
    change(now);
    await writeFile(scenarioFile, JSON.stringify(now));
  };
  const reconnect = async (change: (s: Scenario) => void = () => {}) => {
    await rewrite(change);
    await control({ exit: true });
    // the new stub listens again once it runs: a control round trip proves it
    const until = Date.now() + 10_000;
    for (;;) {
      try {
        await control({});
        break;
      } catch (err) {
        if (Date.now() > until) throw err;
        await sleep(50);
      }
    }
  };
  await c.waitScreen((s) => s.includes('Starting T-12') && s.includes('coord-1'), 'the workbench on General');
  if (initialSnapshots) await waitInitialSnapshots(c);
  return Object.assign(c, { root, keylog, control, rewrite, reconnect });
}

const topBar = (s: string) => s.split('\n')[0] ?? '';

const statusLine = (s: string) => s.split('\n')[43] ?? '';

async function waitUntil(predicate: () => Promise<boolean>, what: string): Promise<void> {
  const until = Date.now() + 5000;
  while (Date.now() < until) {
    if (await predicate()) return;
    await sleep(25);
  }
  assert.fail(`never observed ${what}`);
}

type Req = Record<string, unknown> & { type: string };

const requestsOf = async (c: Shell, type: string): Promise<Req[]> => ((await c.control({ requests: true })).requests as Req[]).filter((f) => f.type === type);

async function onSessionRow(c: Shell, name: string) {
  await c.input('<Esc><Space>s<Space>s');
  await c.waitScreen((s) => s.includes('SESSIONS') && statusLine(s).includes('NORMAL'), 'the sessions panel, focused');
  await c.rpc.request('nvim_exec_lua', `
    local name=...; local panels=require('cland.panels')
    for _,win in ipairs(vim.api.nvim_tabpage_list_wins(0)) do
      local b=vim.api.nvim_win_get_buf(win)
      if vim.b[b].cland_role=='sessions' then
        for line,row in pairs(panels.rows[b] or {}) do
          if row.session==name and not row.detail then
            vim.api.nvim_set_current_win(win)
            vim.api.nvim_win_set_cursor(win,{line,0})
            return
          end
        end
      end
    end
    error('no session row for '..name)
  `, [name]);
}

const topic = (id: string, title: string, status: string, extra: Record<string, unknown> = {}) => ({
  id,
  title,
  status,
  standing: id === 'general' || id === 'agents',
  createdAt: ts(0),
  updatedAt: ts(0),
  item: null,
  unread: 0,
  lastMessageAt: ts(1),
  ...extra,
});

const rightOf = (text: string): string =>
  text
    .split('\n')
    .map((l) => {
      const i = l.lastIndexOf('│');
      return i < 0 ? '' : l.slice(i + 1);
    })
    .join('\n');

const item = (id: string, kind: string, title: string, extra: Record<string, unknown> = {}) => ({
  id,
  kind,
  title,
  ...(kind === 'task' ? {status: 'backlog'} : {}),
  state: 'open',
  labels: [],
  assignee: null,
  parent: null,
  blocked_by: [],
  topic: null,
  branch: null,
  created: ts(0),
  updated: ts(0),
  file: `${id}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`,
  claim: null,
  verdicts: [],
  ...extra,
});

const claimBy = (session: string, role = 'implementer') => ({ session, sessionId: `${session}-id`, role, claimedAt: ts(1) });

const verdict = (kind: string, result: string, run: string, min: number) => ({ verdict: kind, result, by: `${kind === 'qa' ? 'qa-1 [qa]' : 'rev-1 [reviewer]'}`, run, author: kind === 'qa' ? 'qa-1' : 'rev-1', at: ts(min) });

function withItems(s: Scenario): void {
  s.tracker = { levels: ['epic'] };
  s.processes = [...(s.processes ?? []), proc('impl-2', 'implementer', 'busy')];
  s.attach = { ...(s.attach ?? {}), 'impl-2': `printf 'attached impl-2\\n'; sleep 600` };
  s.topics = [
    topic('general', 'General', 'open'),
    topic('agents', 'Agents', 'open'),
    topic('topic-2', 'Items panel work', 'waiting for human', { item: 'T-2' }),
  ];
  // the ask badge counts the open asks in the bound topic (#33), not the topic's status
  const openAsk = (id: string, question: string) => ({ id, topic: { id: 'topic-2', title: 'Items panel work', item: 'T-2' }, question, options: ['yes', 'no'], free: true, from: 'coord-1', label: 'coord-1 [Coordinator]', ts: ts(1) });
  s.inbox = { asks: [openAsk('a-2', 'Tree or flat list?'), openAsk('a-3', 'Show closed items?')], approvals: [], waiting: [] };
  s.items = [
    item('T-1', 'epic', 'Workbench shell'),
    item('T-2', 'task', 'Items panel', { parent: 'T-1', status: 'in progress', claim: claimBy('impl-2'), topic: 'topic-2', branch: 't/2-items-panel', labels: ['ui', 'slice-1'] }),
    item('T-3', 'task', 'Board view', {
      parent: 'T-1',
      status: 'review',
      blocked_by: ['T-4'],
      body: '## Goal\n\nSix columns derived from the item.\n\n- backlog\n- done',
      verdicts: [verdict('review', 'clear', 'r-1', 3), verdict('review', 'not clear', 'r-2', 5)],
      comments: [
        { author: 'impl-2', at: ts(2), text: 'Ready for review.' },
        { author: 'rev-1', at: ts(5), text: 'The qa column is missing.', verdict: verdict('review', 'not clear', 'r-2', 5) },
      ],
    }),
    item('T-4', 'task', 'Item view', { parent: 'T-1', status: 'done', state: 'closed', verdicts: [verdict('review', 'clear', 'r-3', 4), verdict('qa', 'clear', 'q-1', 6)] }),
    item('T-5', 'map', 'Slice 2 map'),
    item('T-6', 'question', 'Which store', { parent: 'T-5', state: 'closed' }),
    item('T-7', 'question', 'Transport', { parent: 'T-5' }),
    item('T-8', 'question', 'Auth scheme', { parent: 'T-5', blocked_by: ['T-7'] }),
    item('T-9', 'question', 'CRDT spike', { parent: 'T-5', assignee: 'sub-1' }),
    item('T-10', 'task', 'Review passed', { parent: 'T-1', status: 'qa', verdicts: [verdict('review', 'clear', 'r-4', 7)] }),
    item('T-11', 'task', 'For the human', { parent: 'T-1', status: 'planned', assignee: 'human' }),
    ...(baseScenario('').items ?? []).map(it => ({...it, parent: 'T-1'})),
  ];
}

const ASK_OPTIONS = ['the name recorded by the spoke', 'the harness session id', 'ask me later'];

function withInbox(s: Scenario): void {
  s.topics = [
    topic('general', 'General', 'open'),
    topic('agents', 'Agents', 'open'),
    topic('topic-1', 'Spoke identity', 'waiting for human', { item: 'T-12' }),
    topic('topic-5', 'Spoke reconnect: flaky test', 'waiting for human', { unread: 2 }),
  ];
  s.messages = {
    ...s.messages,
    'topic-1': [
      { id: 'a1', from: 'coord-1', fromKind: 'agent', fromRole: 'coordinator', via: 'session', to: [], text: 'Which should win?', ts: ts(1), topic: 'topic-1', ask: { question: 'Which should win?', options: ASK_OPTIONS, free: true, state: 'open' } },
    ],
  };
  s.processes = [proc('coord-1', 'coordinator', 'busy'), proc('impl-1', 'implementer', 'waiting for approval', 'sonnet')];
  s.inbox = {
    asks: [{ id: 'a1', topic: { id: 'topic-1', title: 'Spoke identity', item: 'T-12' }, question: 'Which should win?', options: ASK_OPTIONS, free: true, from: 'coord-1', label: 'coord-1 [Coordinator]', ts: ts(1) }],
    approvals: [{ id: 'cmd1', session: 'impl-1', label: 'impl-1 [Implementer]', harness: 'claude-code', since: ts(2), attach: 'claude attach impl-1-bg' }],
    waiting: [topic('topic-5', 'Spoke reconnect: flaky test', 'waiting for human', { unread: 2 })],
    messages: [{ id: 'waiting-report', topic: { id: 'topic-5', title: 'Spoke reconnect: flaky test' }, text: 'Needs a reply', from: 'coord-1', fromRole: 'coordinator', since: ts(2), layer: 'now' }],
  };
}

async function openInbox(c: Shell): Promise<string> {
  await c.input('<Esc><Space>n');
  return c.waitScreen((x) => x.includes('INBOX') && rightOf(x).includes('ASKS AND APPROVALS') && rightOf(x).includes('? T-12'), 'the inbox panel and its ask row');
}

test('Enter on a session attaches it in the centre in Terminal mode; ␣␣ returns to the thread', { skip }, async (t) => {
  const c = await startShell(t);
  await c.input('<Esc><Space>s<Space>s');
  await c.waitScreen((s) => s.includes('SESSIONS'), 'the sessions panel, focused');
  await c.input('gg/coord-1<CR><CR>');
  let s = await c.waitScreen((x) => x.includes('keylog ready') && statusLine(x).includes('TERMINAL'), 'the attached terminal');
  assert.match(statusLine(s), /TERMINAL {2}coord-1 · session · attached · busy/);
  assert.match(topBar(s), /│ coord-1 \[Coordinator\]/);
  assert.equal(await c.mode(), 't');
  await c.input('<C-\\><C-n><Space><Space>');
  s = await c.waitScreen((x) => topBar(x).includes('│ General') && statusLine(x).includes('General · topic'), 'General again');
  assert.match(centreOf(s), /Starting T-12/);
  // and forward again: the terminal is still attached, not started twice
  await c.input('<Space><Space>');
  s = await c.waitScreen((x) => statusLine(x).includes('coord-1 · session · attached'), 'the session again');
  assert.equal(s.match(/keylog ready/g)?.length, 1);
});

test('each focus chord moves to its neighboring window from Normal, Insert and Terminal mode', { skip }, async (t) => {
  for (const mode of ['n', 'i', 't']) {
    await t.test(mode, async (t) => {
      const c = await startShell(t);
      if (mode === 't') {
        await c.input('<Esc>:Cland view session coord-1<CR>');
        await c.waitScreen((x) => x.includes('keylog ready'), 'the attached session');
      } else {
        await c.input('<Esc>');
      }
      const windows = await c.lua<Record<string, number>>(`
        local origin = vim.api.nvim_get_current_win()
        local wins = { origin = origin }
        for _, pair in ipairs({ {'h', 'left'}, {'j', 'below'}, {'k', 'above'}, {'l', 'right'} }) do
          local buf = vim.api.nvim_create_buf(false, true)
          wins[pair[1]] = vim.api.nvim_open_win(buf, false, { split = pair[2], win = origin })
        end
        return wins
      `);
      for (const direction of ['h', 'j', 'k', 'l']) {
        await c.lua('vim.api.nvim_set_current_win(...)', windows.origin);
        if (mode !== 'n' && await c.mode() !== mode) await c.input(mode === 't' ? 'i' : 'A');
        await waitUntil(async () => await c.mode() === mode, 'the source mode');
        await c.input(`<C-${direction}>`);
        await waitUntil(async () => await c.lua('return vim.api.nvim_get_current_win()') === windows[direction], `${mode}: focus ${direction}`);
        if (mode === 't') assert.equal(await readFile(c.keylog, 'utf8'), '', 'focus keys never reach the harness');
      }
      if (mode === 't') {
        await c.input('<C-h>');
        await waitUntil(async () => await c.mode() === 't', 'returning to the terminal resumes typing');
      }
    });
  }
});

test('focus also leaves Visual, Select, operator-pending and command-line modes', { skip }, async (t) => {
  const c = await startShell(t);
  await c.input('<Esc>');
  const windows = await c.lua<{ origin: number; left: number }>(`
    local origin = vim.api.nvim_get_current_win()
    local buf = vim.api.nvim_create_buf(false, true)
    vim.api.nvim_buf_set_lines(buf, 0, -1, false, {'one two'})
    vim.api.nvim_win_set_buf(origin, buf)
    return { origin = origin, left = vim.api.nvim_open_win(vim.api.nvim_create_buf(false, true), false, { split = 'left', win = origin }) }
  `);
  for (const [keys, mode] of [['v', 'v'], ['v<C-g>', 's'], ['d', 'no'], [':', 'c']]) {
    await c.lua('vim.api.nvim_set_current_win(...); vim.api.nvim_win_set_cursor(0, {1, 0})', windows.origin);
    await c.input(keys!);
    await waitUntil(async () => await c.mode() === mode, mode!);
    await c.input('<C-h>');
    await waitUntil(async () => await c.lua('return vim.api.nvim_get_current_win()') === windows.left, `${mode}: focus left`);
    assert.equal(await c.mode(), 'n');
  }
});

test('the launcher no longer shadows Ctrl+H as Backspace', { skip }, async (t) => {
  const c = await startShell(t);
  await c.input('<Esc>:Cland panel items<CR>:Cland launch scratch<CR>');
  await c.waitScreen(x => x.includes('launch a session') && x.includes('scratch'), 'the launcher');
  const left = await c.lua<number>("return require('cland.layout').win.left");
  await c.input('<C-h>');
  await waitUntil(async () => await c.lua('return vim.api.nvim_get_current_win()') === left, 'focus leaves the launcher');
  assert.equal(await c.mode(), 'n');
});

test('a lone Ctrl+Backslash leaves Terminal mode, the old two-key habit works, and Esc reaches the harness', { skip }, async (t) => {
  const c = await startShell(t);
  await c.input('<Esc>:Cland view session coord-1<CR>');
  await c.waitScreen((x) => x.includes('keylog ready'), 'the attached session');
  await waitUntil(async () => await c.mode() === 't', 'Terminal mode');
  await c.input('<C-\\>');
  await waitUntil(async () => (await c.mode()).startsWith('n'), 'a lone Ctrl+Backslash leaves');
  assert.equal(await readFile(c.keylog, 'utf8'), '');
  await c.input('i');
  await waitUntil(async () => await c.mode() === 't', 'Terminal mode again');
  await c.input('<C-\\><C-n>');
  await waitUntil(async () => (await c.mode()).startsWith('n'), 'the two-key habit leaves');
  assert.equal(await readFile(c.keylog, 'utf8'), '');
  await c.input('i<Esc><M-CR>');
  await waitUntil(async () => (await readFile(c.keylog, 'utf8')).replaceAll('\n', '') === '1b1b0d', 'Esc and Alt+Enter pass through');
  assert.equal(await c.mode(), 't');
});

test('Russian Normal-mode letters follow langmap while the composer keeps Cyrillic text', { skip }, async (t) => {
  const c = await startShell(t);
  await mkdir(join(c.root, '.cland'), { recursive: true });
  await writeFile(join(c.root, '.cland', 'config.toml'), '[keys]\nlayouts = ["ru"]\n');
  await c.reconnect();
  await waitUntil(async () => await c.lua<string>('return vim.o.langmap') !== '', 'the configured layout');
  await c.input('<Esc><C-k>');
  await c.lua("vim.api.nvim_win_set_cursor(0, {1, 0})");
  await c.input('о'); // Russian J: down a line.
  await waitUntil(async () => await c.lua<number>('return vim.api.nvim_win_get_cursor(0)[1]') === 2, 'Russian J moves down');
  await c.input('<C-j>Привет мир<S-CR>вторая строка<M-CR>третья');
  await c.waitScreen(x => x.includes('Привет мир') && x.includes('вторая строка') && x.includes('третья'), 'unchanged Cyrillic composer text and newline keys');
  await c.input('<CR>');
  await c.waitScreen(x => x.includes('you') && x.includes('Привет мир') && x.includes('третья'), 'the Cyrillic message');
  await c.input('<Esc>:Cland view session coord-1<CR>');
  await c.waitScreen(x => x.includes('keylog ready'), 'the terminal with Russian langmap');
  await waitUntil(async () => await c.mode() === 't', 'Terminal mode');
  await c.input('Привет');
  await waitUntil(async () => (await readFile(c.keylog, 'utf8')).replaceAll('\n', '') === 'd09fd180d0b8d0b2d0b5d182', 'unchanged Cyrillic terminal bytes');
});

test('Shift+Enter reaches the session terminal as ESC[13;2u; a paste keeps its tabs', { skip }, async (t) => {
  const c = await startShell(t);
  await c.input('<Esc>:Cland view session coord-1<CR>');
  await c.waitScreen((x) => x.includes('keylog ready'), 'the keylog session');
  const until = Date.now() + 5000;
  while ((await c.mode()) !== 't' && Date.now() < until) await sleep(30);
  assert.equal(await c.mode(), 't');
  await c.input('<S-CR>');
  const hexes = async () => (await readFile(c.keylog, 'utf8')).split('\n').filter(Boolean);
  let seen: string[] = [];
  while (Date.now() < until + 5000) {
    seen = await hexes();
    if (seen.length) break;
    await sleep(30);
  }
  assert.deepEqual(seen, ['1b5b31333b3275'], 'exactly CSI 13;2u');
  await c.rpc.request('nvim_paste', 'a\tb\tc', false, -1);
  const pasted = Buffer.from('a\tb\tc').toString('hex');
  while (Date.now() < until + 10_000) {
    seen = await hexes();
    if (seen.join('').includes(pasted)) break;
    await sleep(30);
  }
  assert.ok(seen.join('').includes(pasted), `the tabs arrive: ${seen.join(' ')}`);
});

test(':restart re-attaches the session terminals instead of ending the sessions', { skip }, async (t) => {
  const c = await startShell(t);
  await c.input('<Esc>:Cland panel sessions left<CR>:Cland panel items right<CR>');
  await c.waitScreen(x => x.includes('SESSIONS') && x.includes('ITEMS'), 'swapped panels before restart');
  await c.input('<Esc>:Cland view session coord-1<CR>');
  await c.waitScreen((x) => x.includes('keylog ready') && statusLine(x).includes('TERMINAL'), 'the attached session');
  const before = await c.control({ requests: true });
  const attaches = (r: Record<string, unknown>) => (r.requests as Array<{ type: string }>).filter((f) => f.type === 'session.attach').length;
  assert.equal(attaches(before), 1);
  const moved = c.restarted();
  await c.input('<C-\\><C-n>:restart<CR>');
  await moved;
  const s = await c.waitScreen((x) => x.includes('keylog ready') && statusLine(x).includes('coord-1 · session · attached'), 'the session attached again after the restart', 20_000);
  assert.match(s, /SESSIONS/, 'the panels as they were');
  assert.deepEqual(await c.lua(`local l=require('cland.layout'); return {
    left=vim.b[vim.api.nvim_win_get_buf(l.win.left)].cland_role,
    right=vim.b[vim.api.nvim_win_get_buf(l.win.right)].cland_role,
    homes=require('cland.state').S.ui.panel_homes}`), {
    left: 'sessions', right: 'items', homes: { items: 'right', sessions: 'left', inbox: 'right', topics: 'right' },
  });
  // the new instance spawned its own stub hub and asked it for the attach command again
  const after = await c.control({ requests: true });
  assert.equal(attaches(after), 1);
  assert.equal(basename(c.root), 'proj-shell');
});

test(':restart restores a C-v split attachment as a split beside the centre, not a hidden terminal', { skip }, async (t) => {
  const c = await startShell(t);
  await onSessionRow(c, 'impl-1');
  await c.input('<C-v>');
  await c.waitScreen((x) => x.includes('attached impl-1') && statusLine(x).includes('TERMINAL'), 'impl-1 in a split');
  const moved = c.restarted();
  await c.input('<C-\\><C-n>:restart<CR>');
  await moved;
  const s = await c.waitScreen((x) => x.includes('attached impl-1') && topBar(x).includes('│ General') && x.includes('Starting T-12'), 'the split attached again beside General', 20_000);
  assert.match(s, /SESSIONS/, 'the panels as they were');
  const wins = await c.lua<Array<{ name: string; term: boolean; session: string | null }>>(`
    local out = {}
    for _, w in ipairs(vim.api.nvim_tabpage_list_wins(0)) do
      local b = vim.api.nvim_win_get_buf(w)
      if vim.api.nvim_win_get_config(w).relative == '' then
        out[#out + 1] = { name = vim.api.nvim_buf_get_name(b), term = vim.bo[b].buftype == 'terminal', session = vim.b[b].cland_session or vim.NIL }
      end
    end
    return out`);
  assert.ok(wins.some((w) => w.name === 'cland://topic/general'), `the centre shows General: ${JSON.stringify(wins)}`);
  assert.deepEqual(wins.filter((w) => w.term).map((w) => w.session), ['impl-1'], `one split terminal, impl-1: ${JSON.stringify(wins)}`);
});

for (const distraction of ['launch notice', 'prefix-sharing name']) test(`session row selection ignores a ${distraction}`, { skip }, async t => {
  const c = await startShell(t, s => {
    if (distraction === 'prefix-sharing name') s.processes = [proc('other-impl-1', 'implementer', 'busy'), proc('impl-1', 'implementer', 'idle')];
    else s.adapters = { ...s.adapters, codex: { ...CAPS, approvalRelay: 'reliable' } };
  });
  const name = distraction === 'launch notice' ? 'rev-2' : 'impl-1';
  if (distraction === 'launch notice') {
    await c.input('<Esc><Space>l');
    await c.waitScreen(x => x.includes('launch a session'), 'launcher');
    await c.input('rev-2<Tab>reviewer<CR>');
    await c.waitScreen(x => x.includes('launched rev-2 [Reviewer]'), 'notice containing the exact session label');
  } else {
    await c.waitScreen(x => x.includes('other-impl-1 [Implementer]') && x.includes('impl-1 [Implementer]'), 'both names');
  }
  await onSessionRow(c, name);
  await c.input('c');
  await c.waitScreen(x => x.includes('capability table'), 'capabilities of the selected session');
  const lines = await c.lua<string[]>('return vim.api.nvim_buf_get_lines(0,0,-1,false)');
  const role = distraction === 'launch notice' ? 'Reviewer' : 'Implementer';
  const harness = distraction === 'launch notice' ? 'Codex' : 'Claude Code';
  assert.ok(lines.some(line => line.trim() === `${name} [${role}] · ${harness} · capability table`), lines.join('\n'));
});

test('an attach client that ended is not reused: Enter and C-v run the attach command again', { skip }, async (t) => {
  let runs = '';
  const c = await startShell(t, (s) => {
    runs = join(dirname(s.attach?.['coord-1']?.split(' ').at(-1)?.replace(/"/g, '') ?? tmpdir()), 'runs.txt');
    // an attach client that ends at once (the session went away, the harness's attach failed)
    s.attach = { ...s.attach, 'impl-1': `echo run >> ${JSON.stringify(runs)}; printf 'attach ended\\n'` };
  });
  const count = async () => (existsSync(runs) ? (await readFile(runs, 'utf8')).split('\n').filter(Boolean).length : 0);
  const until = async (n: number, what: string) => {
    const deadline = Date.now() + 5000;
    while ((await count()) < n && Date.now() < deadline) await sleep(30);
    assert.equal(await count(), n, what);
  };
  await c.input('<Esc>:Cland view session impl-1<CR>');
  await c.waitScreen((x) => x.includes('attach ended') && x.includes('[Process exited 0]'), 'the attach client ended');
  await until(1, 'one attach run');
  await c.input('<C-\\><C-n><Space><Space>');
  await c.waitScreen((x) => statusLine(x).includes('General · topic'), 'General');
  // Enter on the row again: not the finished terminal, a new attach
  await onSessionRow(c, 'impl-1');
  await c.input('<CR>');
  await until(2, 'Enter ran the attach command again');
  await c.waitScreen((x) => statusLine(x).includes('impl-1 · session'), 'impl-1 in the centre');
  await c.input('<C-\\><C-n><Space><Space>');
  await c.waitScreen((x) => statusLine(x).includes('General · topic'), 'General again');
  // C-v too
  await onSessionRow(c, 'impl-1');
  await c.input('<C-v>');
  await until(3, 'C-v ran the attach command again');
});

test("the picker's sessions kind: waiting ones first, filters by name, role and harness, Enter attaches", { skip }, async (t) => {
  const c = await startShell(t, (s) => {
    s.processes = [...(s.processes ?? []), { ...proc('rev-1', 'reviewer', 'idle', 'gpt-6.1-sol'), harness: 'codex' }];
    s.adapters = { ...s.adapters, codex: { ...CAPS, approvalRelay: 'reliable', states: { ...CAPS.states, 'waiting for human': 'reliable' } } };
    s.attach = { ...s.attach, 'rev-1': `printf 'attached rev-1\\n'; sleep 600` };
  });
  await c.input('<Esc><Space>p@');
  let s = await c.waitScreen((x) => x.includes('SESSIONS ·') && x.includes('rev-1 [Reviewer]  Codex'), 'the sessions kind');
  const at = (re: RegExp) => s.split('\n').findIndex((l) => re.test(l));
  assert.ok(at(/impl-1 \[Implementer\]  Claude Code/) < at(/coord-1 \[Coordinator\]  Claude Code/), 'the waiting session first');
  assert.ok(at(/coord-1 \[Coordinator\]  Claude Code/) < at(/rev-1 \[Reviewer\]  Codex/), 'busy before idle');
  assert.match(s, /sonnet · waiting for human \(heuristic\)/);
  await c.input('codex');
  s = await c.waitScreen((x) => /rev-1 \[Reviewer\]  Codex/.test(x) && !/impl-1 \[Implementer\]  Claude/.test(x) && !/coord-1 \[Coordinator\]  Claude/.test(x), 'only the Codex session');
  await c.input('<C-u>@Implementer');
  s = await c.waitScreen((x) => /impl-1 \[Implementer\]  Claude/.test(x) && !/rev-1 \[Reviewer\]  Codex/.test(x) && !/coord-1 \[Coordinator\]  Claude/.test(x), 'only the implementer');
  await c.input('<C-u>@rev<CR>');
  await c.waitScreen((x) => x.includes('attached rev-1') && statusLine(x).includes('TERMINAL  rev-1 · session'), 'rev-1 attached');
});

test('Enter on an approval attaches the session in the centre', { skip }, async (t) => {
  const c = await startShell(t, withInbox);
  await openInbox(c);
  await c.input('gg/▲ impl-1<CR><CR>');
  const s = await c.waitScreen((x) => x.includes('attached impl-1') && statusLine(x).includes('impl-1 · session'), 'impl-1 attached');
  assert.match(topBar(s), /│ impl-1 \[Implementer\]/);
  assert.deepEqual((await requestsOf(c, 'session.attach')).map((f) => f.session), ['impl-1']);
});

test('an ask answered while the client was away shows answered after the reconnect, and a digit on it does nothing', { skip }, async (t) => {
  const c = await startShell(t, withInbox);
  await c.input('<Esc>:Cland view thread topic-1<CR>');
  await c.waitScreen((x) => x.includes('ask · ▲ waiting for you'), 'the open card');
  await c.reconnect((s) => {
    const a1 = s.messages?.['topic-1']?.[0] as Record<string, unknown>;
    a1.ask = { question: 'Which should win?', options: ASK_OPTIONS, free: true, state: 'answered', option: 3, answer: 'ans-1' };
    s.messages!['topic-1']!.push({ id: 'ans-1', from: 'human', fromKind: 'human', via: 'cli', to: ['coord-1'], text: 'ask me later', ts: ts(2), topic: 'topic-1', answerTo: 'a1', stage: 'delivered' });
    s.inbox!.asks = [];
  });
  const s = await c.waitScreen((x) => x.includes('ask · ✓ answered') && x.includes('┃ ✓ 3  ask me later'), 'the card answered after the reconnect', 5000);
  assert.doesNotMatch(s, /1-9 answers · free answer: i/);
  await c.input('<Esc><C-w>k');
  await c.waitScreen((x) => statusLine(x).includes('NORMAL'), 'Normal mode in the thread');
  await c.input('gg/the harness<CR>2');
  await sleep(300);
  assert.equal((await requestsOf(c, 'topic.answer')).length, 0, 'no answer to an ask that is no longer open');
});

test('an ask closed while the client was away, now older than the history the reconnect reads: its card closes, a digit on it does nothing', { skip }, async (t) => {
  const c = await startShell(t, withInbox);
  await c.input('<Esc>:Cland view thread topic-1<CR>');
  await c.waitScreen((x) => x.includes('ask · ▲ waiting for you'), 'the open card');
  await c.reconnect((s) => {
    // the ask's message is past the latest messages the history returns; the inbox no longer lists it
    s.messages!['topic-1'] = [{ id: 'later-1', from: 'coord-1', fromKind: 'session', fromRole: 'coordinator', via: 'spoke', to: ['human'], text: 'much later', ts: ts(5), topic: 'topic-1' }];
    s.inbox!.asks = [];
  });
  const s = await c.waitScreen((x) => x.includes('much later') && x.includes('ask · closed'), 'the cached card closed after the reconnect', 5000);
  assert.doesNotMatch(s, /1-9 answers · free answer: i/);
  assert.doesNotMatch(s, /ask · ▲ waiting for you/);
  await c.input('<Esc><C-w>k');
  await c.waitScreen((x) => statusLine(x).includes('NORMAL'), 'Normal mode in the thread');
  await c.input('gg/the harness<CR>2');
  await sleep(300);
  assert.equal((await requestsOf(c, 'topic.answer')).length, 0, 'no answer to an ask that is no longer open');
});

test('a send the hub refuses comes back to the composer; a held send that fails goes back ahead of what was typed since', { skip }, async (t) => {
  const c = await startShell(t, (s) => {
    s.send = 'refuse';
  });
  const composer = () => c.lua<string[]>("return vim.api.nvim_buf_get_lines(vim.fn.bufnr('cland://composer/general'), 0, -1, false)");
  await c.input('far too long<CR>');
  await c.waitScreen((x) => centreOf(x).includes('not sent: the message is larger than 8192 bytes'), 'the refusal');
  assert.deepEqual(await composer(), ['› far too long']);
  await c.control({ set: { send: 'hold' } });
  await c.input('<C-u>');
  await c.lua("require('cland.views').topic('general').composer:set_text('')");
  await c.input('first<CR>');
  await sleep(200);
  assert.deepEqual(await composer(), ['› ']);
  await c.input('second');
  await c.control({ release: { error: 'the hub is stopping' } });
  await c.waitScreen((x) => centreOf(x).includes('not sent: the hub is stopping'), 'the late refusal');
  assert.deepEqual(await composer(), ['› first', 'second']);
  assert.equal(await c.mode(), 'i');
});

test('the workbench reads sessions and presence once per connect; events update the panel without polling (T-71)', { skip }, async (t) => {
  const c = await startShell(t, (s) => { s.inbox = {}; });
  const asked = async (type: string) => ((await c.control({ requests: true })).requests as Array<{ type: string }>).filter((r) => r.type === type).length;
  await c.input('<Esc>');
  await c.waitScreen((x) => x.includes('SESSIONS'), 'the sessions panel');
  // Beyond the former default timer as well as the accelerated timer used by this fixture.
  const formerRefreshMs = 5000;
  await sleep(1.1 * formerRefreshMs); // Negative: span the removed production poll, as well as this fixture's 300 ms timer.
  for (const type of ['task.list', 'session.list', 'hub.status', 'role.list', 'inbox.list']) {
    assert.equal(await asked(type), 1, `${type} once on connecting`);
  }
  await c.control({ emits: Array.from({ length: 50 }, (_, i) => ({ type: 'session.state', session: `ghost-${i}`, sessionId: `g${i}`, state: 'busy', source: 'hook', ts: ts(5) })) });
  await c.control({ emit: { type: 'presence', sessions: [{ name: 'manual', sessionId: 'manual-id', role: 'reviewer', state: 'idle' }] } });
  await c.waitScreen((x) => x.includes('manual [Reviewer]'), 'a newly connected spoke');
  await c.control({ emit: { type: 'presence', sessions: [] } });
  await c.waitScreen((x) => !x.includes('manual [Reviewer]'), 'the spoke leaving');
  await onSessionRow(c, 'impl-1');
  await c.control({ emit: { type: 'session.usage', session: 'impl-1', sessionId: 'impl-1-id', usage: { total: { totalTokens: 12300, cost: 1.8 } } } });
  await c.waitScreen((x) => x.includes('$1.80'), 'the usage snapshot');
  // An old launch's usage is ignored even when it reuses a current name.
  await c.control({ emit: { type: 'session.usage', session: 'impl-1', sessionId: 'old-launch', usage: { total: { cost: 999 } } } });
  await c.waitScreen((x) => x.includes('$1.80') && !x.includes('$999'), 'usage stays with its launch');
  await c.control({ emit: { type: 'session.process', process: { ...proc('coord-1', 'coordinator', 'unknown'), status: 'exited', attach: null } } });
  await c.input('zR');
  await c.waitScreen(x => x.includes('✗ coord-1'), 'exited row unfolded');
  await c.input('gg/coord-1<CR>');
  await c.waitScreen((x) => x.includes('unknown · died'), 'the exited process');
  assert.equal(await c.lua("return require('cland.state').session('coord-1').attach"), null);
  await c.control({ emit: { type: 'session.process', process: { ...proc('coord-1', 'coordinator', 'idle'), name: 'renamed' } } });
  await c.waitScreen((x) => x.includes('renamed [Coordinator]'), 'a renamed process');
  assert.equal(await c.lua("return require('cland.state').session('coord-1')"), null);
  await c.control({ emit: { type: 'session.role', session: 'impl-1', role: 'qa', ts: ts(5) } });
  await c.waitScreen((x) => x.includes('impl-1 [QA]'), 'the assigned role');
  for (const type of ['session.list', 'hub.status', 'role.list', 'inbox.list']) assert.equal(await asked(type), 1, `${type} never asked by events`);
  await c.reconnect();
  await c.waitScreen((x) => x.includes('coord-1 [Coordinator]') && !x.includes('renamed [Coordinator]'), 'the reconnect snapshot');
  for (const type of ['session.list', 'hub.status', 'inbox.list']) assert.equal(await asked(type), 1, `${type} once in the new connection`);
});

test('gI, gt and gs between items, topics and sessions, both ways; a topic event binding an item is followed', { skip }, async (t) => {
  const c = await startShell(t, withItems);
  await c.input('<Esc>:Cland view item T-2<CR>');
  await c.waitScreen((x) => statusLine(x).includes('T-2 · item'), 'T-2');
  // item → its topic
  await c.input('gt');
  await c.waitScreen((x) => statusLine(x).includes('Items panel work · T-2 · topic'), 'gt: the topic bound to T-2');
  // topic → its item
  await c.input('<Esc><C-w>kgI');
  await c.waitScreen((x) => statusLine(x).includes('T-2 · item'), 'gI: the bound item');
  // item → the claiming session; session → its item
  await c.input('gs');
  await c.waitScreen((x) => statusLine(x).includes('impl-2 · session'), 'gs: the claiming session');
  await c.input('gI');
  await c.waitScreen((x) => statusLine(x).includes('T-2 · item'), 'gI: the claimed item');
  // an unbound item: no topic is created
  await c.input(':Cland view item T-13<CR>');
  await c.waitScreen((x) => statusLine(x).includes('T-13 · item'), 'T-13');
  await c.input('gt');
  await c.waitScreen((x) => statusLine(x).includes('gt: T-13 has no topic yet'), 'no topic yet');
  assert.equal((await requestsOf(c, 'topic.create')).length, 0, 'gt creates no topic');
  // an agent's topic.create with a binding: the topic event, then the item's own `task` event; both follow
  const t13 = (baseScenario('').items ?? [])[1] ?? {};
  await c.control({ emit: { type: 'topic', topic: topic('topic-9', 'Codex adapter work', 'open', { item: 'T-13' }) } });
  await c.control({ emit: { type: 'task', id: 'T-13', item: { ...t13, topic: 'topic-9', verdicts: [] } } });
  await c.waitScreen((x) => /topic {6}Codex adapter work · open/.test(x), 'the item view shows the new topic');
  await c.input('gt');
  await c.waitScreen((x) => statusLine(x).includes('Codex adapter work · T-13 · topic'), 'gt: the new topic');
  // from the items panel row and from a board card
  await c.input('<Esc><Space>i');
  await c.waitScreen((x) => x.includes('ITEMS'), 'the items panel');
  await c.input('gg/T-12<CR>gs');
  await c.waitScreen((x) => statusLine(x).includes('impl-1 · session'), 'gs from the T-12 row');
  await c.input('<Space>b');
  await c.waitScreen((x) => statusLine(x).includes('Board'), 'the board');
  await c.input('gg/T-12<CR>gI');
  await c.waitScreen((x) => statusLine(x).includes('T-12 · item'), 'gI from the T-12 card');
  await c.input('<Space>b');
  await c.waitScreen((x) => statusLine(x).includes('Board'), 'the board again');
  await c.input('gg/T-2 <CR>gt');
  await c.waitScreen((x) => statusLine(x).includes('Items panel work · T-2 · topic'), 'gt from the T-2 card');
});

test('the sessions panel: c shows the capability table, C-v attaches in a vertical split, l opens the launcher', { skip }, async (t) => {
  const c = await startShell(t, s => {
    s.processes = [...s.processes!, { ...proc('codex-1', 'reviewer', 'idle', 'gpt-6.1-sol'), harness: 'codex' }];
    s.adapters = { ...s.adapters, codex: { ...CAPS, approvalRelay: 'reliable', states: { ...CAPS.states, 'waiting for human': 'reliable' } } };
  });
  await onSessionRow(c, 'impl-1');
  await c.input('c');
  let s = await c.waitScreen((x) => x.includes('capability table'), 'the capability table');
  assert.match(s, /impl-1 \[Implementer\] · Claude Code · capability table/);
  assert.match(s, /waiting for human +heuristic/);
  assert.match(s, /busy +reliable/);
  assert.match(s, /approvalRelay +none/);
  await c.input('q');
  await c.waitScreen((x) => !x.includes('capability table'), 'the float closed');
  await onSessionRow(c, 'codex-1');
  await c.input('c');
  s = await c.waitScreen(x => x.includes('Codex · capability table'), 'the Codex capability table');
  assert.match(s, /approvalRelay +reliable/);
  await c.input('q');
  await c.waitScreen(x => !x.includes('capability table'), 'the Codex float closed');
  await c.input('gg/coord-1<CR><C-v>');
  s = await c.waitScreen((x) => x.includes('keylog ready') && statusLine(x).includes('TERMINAL'), 'coord-1 in a split');
  const wins = await c.lua<Array<{ name: string; term: boolean }>>(`
    local out = {}
    for _, w in ipairs(vim.api.nvim_tabpage_list_wins(0)) do
      local b = vim.api.nvim_win_get_buf(w)
      if vim.api.nvim_win_get_config(w).relative == '' then
        out[#out + 1] = { name = vim.api.nvim_buf_get_name(b), term = vim.bo[b].buftype == 'terminal' }
      end
    end
    return out`);
  assert.ok(wins.some((w) => w.name === 'cland://topic/general'), `the centre still shows General: ${JSON.stringify(wins)}`);
  assert.equal(wins.filter((w) => w.term).length, 1, 'one terminal window beside it');
  assert.equal(await c.mode(), 't');
  // l in the panel opens the launcher
  await c.input('<C-\\><C-n>');
  await onSessionRow(c, 'coord-1');
  await c.input('l');
  await c.waitScreen((x) => x.includes('launch a session'), 'the launcher from the panel');
});

test('gI, gt and gs on a reference under the cursor in the thread', { skip }, async (t) => {
  const c = await startShell(t);
  await c.input('<Esc><C-w>k');
  await c.waitScreen((x) => statusLine(x).includes('NORMAL'), 'normal mode in the thread');
  await c.input('gg/T-12<CR>gI');
  let s = await c.waitScreen((x) => statusLine(x).includes('T-12 · item'), 'the item view of T-12');
  assert.match(topBar(s), /│ T-12 Hub daemon and spoke hello/);
  assert.match(s, /claim +impl-1 \[Implementer\] · since/);
  // from the item view: gs is the session claiming it
  await c.input('gs');
  s = await c.waitScreen((x) => statusLine(x).includes('impl-1 · session'), 'impl-1 from the item');
  await c.input('<Space><Space>');
  await c.waitScreen((x) => statusLine(x).includes('T-12 · item'), 'back on the item');
  await c.input('<Space>g<Esc>');
  await c.waitScreen((x) => statusLine(x).includes('NORMAL  General · topic'), 'General');
  await c.input('<C-w>k');
  await c.input('gg/impl-1<CR>gs');
  s = await c.waitScreen((x) => statusLine(x).includes('impl-1 · session'), 'impl-1 from the thread');
  await c.input('<Space><Space>');
  await c.waitScreen((x) => statusLine(x).includes('General · topic'), 'back in General');
  await c.input('<C-w>k');
  await c.input('gg/Agents<CR>gt');
  await c.waitScreen((x) => statusLine(x).includes('Agents log') && centreOf(x).includes('T-12 claimed.'), 'the Agents topic, as its log (#34)');
  // gI from a session row in the panel: its claimed item
  await c.input('<Space>s<Space>s');
  await c.waitScreen((x) => x.includes('SESSIONS'), 'sessions panel');
  await c.input('gg/impl-1<CR>gI');
  await c.waitScreen((x) => statusLine(x).includes('T-12 · item'), 'T-12 from the impl-1 row');
});

test('the palette: prefixes narrow topics, Tab from items reaches sessions and Enter opens', { skip }, async (t) => {
  const c = await startShell(t);
  await c.input('<Esc><Space>p/');
  let s = await c.waitScreen(x => x.includes('palette ›') && x.includes('TOPICS ·'), 'topics prefix');
  assert.match(s, /● General/);
  assert.match(s, /≡ Agents/);
  await c.input('age');
  s = await c.waitScreen(x => !/● General/.test(x) && /≡ Agents/.test(x), 'only Agents');
  await c.input('<Esc><Space>p#<Tab>');
  await c.waitScreen(x => x.includes('SESSIONS ·'), 'Tab from items to sessions');
  await c.input('impl');
  s = await c.waitScreen(x => /impl-1 \[Implementer\]  Claude Code/.test(x) && !/coord-1 \[Coordinator\]  Claude Code/.test(x), 'only impl-1');
  await c.input('<CR>');
  s = await c.waitScreen(x => x.includes('attached impl-1') && statusLine(x).includes('TERMINAL  impl-1 · session'), 'impl-1 attached, Terminal mode');
  assert.doesNotMatch(s, /palette ›/, 'the palette closed');
  await c.input('<C-\\><C-n>');
  await c.waitScreen(x => statusLine(x).includes('NORMAL  impl-1'), 'Normal mode in terminal');
  await c.input('<Space>p/Agents<CR>');
  await c.waitScreen(x => statusLine(x).includes('Agents log') && centreOf(x).includes('T-12 claimed.'), 'Agents log');
});
