// The workbench shell (#25) against a stub hub over stdio (`stub-hub.ts`): deterministic topics,
// sessions with states and capability tables, items and events on command. Driven like a human, with
// nvim_input on a 160x45 UI, and read back with screenstring().
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createConnection } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { centreOf, nvimOrSkip, startClient, type Client } from './harness.ts';
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
    messages: {
      general: [
        { id: 'm1', from: 'coord-1', fromKind: 'agent', fromRole: 'coordinator', via: 'spoke', to: ['human'], text: 'Starting T-12 with impl-1; the log is in Agents.', ts: ts(1), topic: 'general' },
      ],
      agents: [{ id: 'm2', from: 'impl-1', fromKind: 'agent', fromRole: 'implementer', via: 'spoke', to: ['coord-1'], text: 'T-12 claimed.', ts: ts(2), topic: 'agents' }],
    },
    processes: [proc('coord-1', 'coordinator', 'busy'), proc('impl-1', 'implementer', 'waiting for human', 'sonnet')],
    adapters: { 'claude-code': CAPS },
    items: [
      { id: 'T-12', kind: 'task', title: 'Hub daemon and spoke hello', state: 'open', labels: [], assignee: null, parent: null, blocked_by: [], topic: null, branch: null, created: ts(0), updated: ts(0), file: '.cland/tasks/T-12-hub.md', claim: { session: 'impl-1', sessionId: 'impl-1-id', role: 'implementer', claimedAt: ts(1) } },
      { id: 'T-13', kind: 'task', title: 'Codex adapter', state: 'open', labels: [], assignee: null, parent: null, blocked_by: [], topic: null, branch: null, created: ts(0), updated: ts(0), file: '.cland/tasks/T-13-codex.md', claim: null },
    ],
    attach: {
      'coord-1': `${JSON.stringify(process.execPath)} ${JSON.stringify(KEYLOG)} ${JSON.stringify(keylog)}`,
      'impl-1': `printf 'attached impl-1\\n'; sleep 600`,
    },
  };
}

type Shell = Client & { root: string; keylog: string; control: (cmd: Record<string, unknown>) => Promise<Record<string, unknown>> };

async function startShell(t: TestContext, edit: (s: Scenario) => void = () => {}, env: Record<string, string> = {}): Promise<Shell> {
  const dir = await mkdtemp(join(tmpdir(), 'cland-sh-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
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
      sock.setEncoding('utf8');
      sock.on('data', (d: string) => {
        buf += d;
        if (buf.includes('\n')) {
          sock.end();
          resolve(JSON.parse(buf.slice(0, buf.indexOf('\n'))) as Record<string, unknown>);
        }
      });
      sock.on('error', reject);
      sock.write(`${JSON.stringify(cmd)}\n`);
    });
  };
  await c.waitScreen((s) => s.includes('Starting T-12') && s.includes('coord-1'), 'the workbench on General');
  return Object.assign(c, { root, keylog, control });
}

const topBar = (s: string) => s.split('\n')[0] ?? '';
const statusLine = (s: string) => s.split('\n')[43] ?? '';

test('the workbench opens on General: top bar with project, view, Coordinator chip, needs you and sessions; sessions panel on the right', { skip }, async (t) => {
  const c = await startShell(t);
  const s = await c.waitScreen((x) => topBar(x).includes('busy') && x.includes('SESSIONS'), 'the top bar and the sessions panel');
  const top = topBar(s);
  assert.match(top, /cland proj-shell │ General/);
  assert.match(top, /● coord-1 Coordinator · Claude Code · opus · busy/);
  assert.match(top, /needs you 0/);
  assert.match(top, /sessions {2}2 /);
  assert.match(s, /SESSIONS/);
  assert.match(s, /coord-1 \[Coordinator\] +free/);
  assert.match(s, /impl-1 \[Implementer\] +T-12/);
  // the adapter declares "waiting for human" heuristic: the panel says so
  assert.match(s, /Claude Code · sonnet\s.*\n.*waiting for human \(heuristic\)/);
  assert.match(statusLine(s), /INSERT {2}General · topic/);
  assert.equal(await c.mode(), 'i', 'the composer has the focus');
});

test('with no coordinator the chip warns', { skip }, async (t) => {
  const c = await startShell(t, (s) => {
    s.processes = [proc('impl-1', 'implementer', 'idle')];
  });
  await c.waitScreen((x) => topBar(x).includes('no coordinator · messages queue in the hub'), 'the no-coordinator chip');
});

test("the hub's role.vacant turns the chip into the no-coordinator warning at once, and role.filled brings it back", { skip }, async (t) => {
  const c = await startShell(t, (s) => {
    s.coordinator = 'coord-1';
  });
  await c.waitScreen((x) => topBar(x).includes('coord-1') && !topBar(x).includes('no coordinator'), 'the coordinator chip');
  // the hub's word wins over the session rows, which still say coord-1 holds the role
  await c.control({ set: { coordinator: null } });
  await c.control({ emit: { type: 'role.vacant', role: 'coordinator', ts: ts(5) } });
  await c.waitScreen((x) => topBar(x).includes('no coordinator · messages queue in the hub'), 'the warning after role.vacant', 3000);
  await c.control({ set: { coordinator: 'coord-1' } });
  await c.control({ emit: { type: 'role.filled', role: 'coordinator', session: 'coord-1', ts: ts(6) } });
  await c.waitScreen((x) => topBar(x).includes('coord-1') && !topBar(x).includes('no coordinator'), 'the chip after role.filled', 3000);
});

test('each panel toggles with its key; the active right-panel key hides it; the status line names the centre view throughout', { skip }, async (t) => {
  const c = await startShell(t);
  await c.input('<Esc>');
  const named = async (pred: (s: string) => boolean, what: string) => {
    const s = await c.waitScreen(pred, what);
    assert.match(statusLine(s), /General · topic/, `the status line names the view (${what})`);
    return s;
  };
  // sessions is open at start: its key hides it
  await named((s) => s.includes('SESSIONS'), 'sessions');
  await c.input('<Space>s');
  await named((s) => !s.includes('SESSIONS'), 'sessions hidden');
  await c.input('<Space>t');
  let s = await named((x) => x.includes('TOPICS'), 'topics');
  assert.match(s, /OPEN · 2/);
  assert.match(s, /● General/);
  assert.match(s, /≡ Agents/);
  await c.input('<Space>s');
  s = await named((x) => x.includes('SESSIONS') && !x.includes('TOPICS'), 'sessions replacing topics');
  await c.input('<Space>n');
  s = await named((x) => x.includes('INBOX') && !x.includes('SESSIONS'), 'inbox');
  assert.match(s, /✓ nothing needs you/);
  await c.input('<Space>n');
  await named((x) => !x.includes('INBOX'), 'inbox hidden');
  await c.input('<Space>i');
  s = await named((x) => x.includes('ITEMS'), 'items');
  assert.match(s, /◐ T-12 Hub daemon and spo.* impl-1 │/);
  assert.match(s, /○ T-13 Codex adapter/);
  await c.input('<Space>i');
  await named((x) => !x.includes('ITEMS'), 'items hidden');
  await c.input('<Space>T');
  s = await named((x) => x.includes('TOPICS') && x.includes('INBOX'), 'topics docked above the inbox');
  assert.ok(s.indexOf('TOPICS') < s.indexOf('INBOX'), 'the dock sits above');
  await c.input('<Space>T');
  await named((x) => !x.includes('TOPICS') && x.includes('INBOX'), 'the dock hidden, the inbox stays');
  await c.input('<Space>N');
  s = await c.waitScreen((x) => statusLine(x).includes('Inbox · full width'), 'the inbox full width');
  assert.match(topBar(s), /│ Inbox · full width/);
  await c.input('<Space>N');
  await named((x) => topBar(x).includes('│ General'), 'back to General');
});

test('Enter on a session attaches it in the centre in Terminal mode; ␣␣ returns to the thread', { skip }, async (t) => {
  const c = await startShell(t);
  await c.input('<Esc><Space>s<Space>s');
  await c.waitScreen((s) => s.includes('SESSIONS'), 'the sessions panel, focused');
  // the first row is coord-1
  await c.input('gg<CR>');
  let s = await c.waitScreen((x) => x.includes('keylog ready') && statusLine(x).includes('TERMINAL'), 'the attached terminal');
  assert.match(statusLine(s), /TERMINAL {2}coord-1 · session · attached · busy/);
  assert.match(topBar(s), /│ coord-1 \[coordinator\]/);
  assert.equal(await c.mode(), 't');
  await c.input('<C-\\><C-n><Space><Space>');
  s = await c.waitScreen((x) => topBar(x).includes('│ General') && statusLine(x).includes('General · topic'), 'General again');
  assert.match(centreOf(s), /Starting T-12/);
  // and forward again: the terminal is still attached, not started twice
  await c.input('<Space><Space>');
  s = await c.waitScreen((x) => statusLine(x).includes('coord-1 · session · attached'), 'the session again');
  assert.equal(s.match(/keylog ready/g)?.length, 1);
});

test('the picker: ␣p opens on topics, typing narrows, Tab switches to sessions, Enter opens', { skip }, async (t) => {
  const c = await startShell(t);
  await c.input('<Esc><Space>p');
  let s = await c.waitScreen((x) => x.includes('pick ›') && x.includes('↵ open thread'), 'the picker on topics');
  assert.match(s, /● General/);
  assert.match(s, /≡ Agents/);
  await c.input('age');
  s = await c.waitScreen((x) => !/● General/.test(x) && /≡ Agents/.test(x), 'only Agents');
  await c.input('<Tab>');
  s = await c.waitScreen((x) => x.includes('↵ attach in centre'), 'the sessions kind');
  await c.input('<C-u>impl');
  s = await c.waitScreen((x) => /impl-1 \[Implementer\]  Claude Code/.test(x) && !/coord-1 \[Coordinator\]  Claude Code/.test(x), 'only impl-1');
  await c.input('<CR>');
  s = await c.waitScreen((x) => x.includes('attached impl-1') && statusLine(x).includes('TERMINAL  impl-1 · session'), 'impl-1 attached, Terminal mode');
  assert.doesNotMatch(s, /pick ›/, 'the picker closed');
  // Enter on a topic opens its thread
  await c.input('<C-\\><C-n>');
  await c.waitScreen((x) => statusLine(x).includes('NORMAL  impl-1'), 'Normal mode in the terminal');
  await c.input('<Space>p<Tab>Agents<CR>');
  s = await c.waitScreen((x) => statusLine(x).includes('Agents · topic') && centreOf(x).includes('T-12 claimed.'), 'the Agents thread');
});

test('gi, gt and gs on a reference under the cursor in the thread', { skip }, async (t) => {
  const c = await startShell(t);
  await c.input('<Esc><C-w>k');
  await c.waitScreen((x) => statusLine(x).includes('NORMAL'), 'normal mode in the thread');
  await c.input('gg/T-12<CR>gi');
  let s = await c.waitScreen((x) => statusLine(x).includes('T-12 · item'), 'the item view of T-12');
  assert.match(topBar(s), /│ T-12 Hub daemon and spoke hello/);
  assert.match(s, /claim {5}impl-1/);
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
  await c.waitScreen((x) => statusLine(x).includes('Agents · topic') && centreOf(x).includes('T-12 claimed.'), 'the Agents topic');
  // gi from a session row in the panel: its claimed item
  await c.input('<Space>s<Space>s');
  await c.waitScreen((x) => x.includes('SESSIONS'), 'sessions panel');
  await c.input('gg/impl-1<CR>gi');
  await c.waitScreen((x) => statusLine(x).includes('T-12 · item'), 'T-12 from the impl-1 row');
});

test('presets are examples: watch opens items, topics docked over the inbox; steady the board and the inbox', { skip }, async (t) => {
  const c = await startShell(t);
  await c.input('<Esc>:Cland preset watch<CR>');
  let s = await c.waitScreen((x) => x.includes('ITEMS') && x.includes('TOPICS') && x.includes('INBOX'), 'the watch preset');
  assert.match(statusLine(s), /General · topic.*preset watch/);
  await c.input(':Cland preset steady<CR>');
  s = await c.waitScreen((x) => statusLine(x).includes('Board') && x.includes('INBOX') && !x.includes('ITEMS'), 'the steady preset');
  assert.match(topBar(s), /│ Board/);
  // still toggles afterwards
  await c.input('<Space>i');
  await c.waitScreen((x) => x.includes('ITEMS'), 'items after a preset');
});

test('a session.state event updates the chip while the human types in the composer, and Insert mode survives', { skip }, async (t) => {
  const c = await startShell(t);
  await c.input('half a thought');
  await c.control({ emit: { type: 'session.state', session: 'coord-1', sessionId: 'coord-1-id', state: 'waiting for approval', source: 'hook', ts: ts(5) } });
  const s = await c.waitScreen((x) => topBar(x).includes('▲ coord-1 Coordinator · Claude Code · opus · waiting for approval'), 'the chip in its new state');
  assert.match(s, /▲ coord-1 \[Coordinator\]/);
  assert.equal(await c.mode(), 'i');
  await c.input(' and more');
  const lines = await c.lua<string[]>("return vim.api.nvim_buf_get_lines(vim.fn.bufnr('cland://composer/general'), 0, -1, false)");
  assert.deepEqual(lines, ['› half a thought and more']);
});

test('a burst of hub events never raises a hit-enter prompt', { skip }, async (t) => {
  const c = await startShell(t);
  const long = Array.from({ length: 60 }, (_, i) => `line ${i} ${'x'.repeat(150)}`).join('\n');
  for (let i = 0; i < 40; i++) {
    await c.control({ emit: { type: 'message', topic: { id: 'general', title: 'General' }, message: { id: `b${i}`, from: 'coord-1', fromKind: 'agent', fromRole: 'coordinator', via: 'spoke', to: ['human'], text: i === 39 ? 'burst done' : long, ts: ts(10), topic: 'general' } } });
    await c.control({ emit: { type: 'session.state', session: i % 2 ? 'coord-1' : 'ghost', sessionId: 'x', state: i % 2 ? 'busy' : 'idle', source: 'hook', ts: ts(10) } });
    await c.control({ emit: { type: 'delivery', topic: 'general', message: `nobody-${i}`, stage: 'delivered' } });
  }
  await c.control({ emit: { type: 'message', topic: { id: 'new-topic', title: 'A topic nobody listed' }, message: { id: 'z', from: 'x', text: 'y', ts: ts(11), topic: 'new-topic' } } });
  const s = await c.waitScreen((x) => centreOf(x).includes('burst done'), 'the last message');
  assert.doesNotMatch(s, /Press ENTER/);
  assert.equal(await c.mode(), 'i');
  await c.input('still typing');
  await c.waitScreen((x) => x.includes('› still typing'), 'the composer answers');
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

test(':restart re-attaches the session terminals instead of ending the sessions', { skip }, async (t) => {
  const c = await startShell(t);
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
  // the new instance spawned its own stub hub and asked it for the attach command again
  const after = await c.control({ requests: true });
  assert.equal(attaches(after), 1);
  assert.equal(basename(c.root), 'proj-shell');
});

// The session launcher and the sessions panel (#28) ---------------------------------------------------

type Req = Record<string, unknown> & { type: string };
const requestsOf = async (c: Shell, type: string): Promise<Req[]> => ((await c.control({ requests: true })).requests as Req[]).filter((f) => f.type === type);

/** The sessions panel, focused, its cursor on the first row naming `name`. */
async function onSessionRow(c: Shell, name: string) {
  await c.input('<Esc><Space>s<Space>s');
  await c.waitScreen((s) => s.includes('SESSIONS') && statusLine(s).includes('NORMAL'), 'the sessions panel, focused');
  await c.input(`gg/${name}<CR>`);
}

test('the launcher: ␣l opens the form, a role fills its launch defaults, typed values win, Enter submits session.launch; the session shows in the panel', { skip }, async (t) => {
  const c = await startShell(t);
  await c.input('<Esc><Space>l');
  await c.waitScreen((x) => x.includes('launch a session') && x.includes('↵ launch'), 'the launcher form');
  assert.equal(await c.mode(), 'i', 'the form takes typing at once');
  await c.input('rev-2<Tab>reviewer<Tab>');
  let s = await c.waitScreen((x) => /harness +codex/.test(x) && /model +gpt-6\.1-sol/.test(x) && /effort +high/.test(x), "the reviewer's launch defaults");
  assert.match(s, /directory +\/\S+/, 'the working directory defaults to the project root');
  // over the default model: the typed one goes out
  await c.input('<Tab><C-u>gpt-x<CR>');
  s = await c.waitScreen((x) => !x.includes('launch a session') && /rev-2 \[Reviewer\] +free/.test(x), 'rev-2 in the panel');
  assert.match(s, /Codex · gpt-x · idle/);
  assert.match(s, /launched rev-2 \[Reviewer\] · Codex ·/);
  const [frame] = await requestsOf(c, 'session.launch');
  assert.deepEqual({ ...frame, id: undefined, cwd: undefined }, { type: 'session.launch', id: undefined, name: 'rev-2', role: 'reviewer', harness: 'codex', model: 'gpt-x', effort: 'high', cwd: undefined });
  assert.match(String(frame?.cwd), /proj-shell$/);

  // a role alone: its defaults are what goes out
  await c.input('<Esc><Space>l');
  await c.waitScreen((x) => x.includes('launch a session'), 'the launcher again');
  await c.input('qa-2<Tab>qa<CR>');
  await c.waitScreen((x) => /qa-2 \[QA\] +free/.test(x), 'qa-2 in the panel');
  const second = (await requestsOf(c, 'session.launch'))[1];
  assert.equal(second?.harness, 'codex');
  assert.equal(second?.model, 'gpt-6-astra');
  assert.equal(second?.effort, 'high');
  // a harness that is not the role's drops the model and effort meant for the role's
  await c.input('<Esc><Space>l');
  await c.waitScreen((x) => x.includes('launch a session'), 'the launcher a third time');
  await c.input('qa-3<Tab>qa<Tab><C-u>opencode<Tab>');
  s = await c.waitScreen((x) => /harness +opencode/.test(x) && !/model +gpt-6-astra/.test(x) && !/effort +high/.test(x), 'the model cleared for OpenCode');
  await c.input('<Esc>');
  await c.waitScreen((x) => !x.includes('launch a session'), 'the form closed with Esc');
  assert.equal((await requestsOf(c, 'session.launch')).length, 2, 'Esc launches nothing');
});

test('the launcher shows what the hub refuses in the form and the panel, never a hit-enter prompt; a roleless launch asks first', { skip }, async (t) => {
  const c = await startShell(t, (s) => {
    s.launchError = 'role "coordinator" is held by coord-1 [Coordinator] (live): one session holds it at a time';
  });
  await c.input('<Esc><Space>l');
  await c.waitScreen((x) => x.includes('launch a session'), 'the launcher form');
  await c.input('coord-2<Tab>coordinator<CR>');
  const s = await c.waitScreen((x) => x.includes('launch coord-2 refused: role'), 'the refusal in the panel');
  assert.match(s, /launch a session/, 'the form stays open to fix it');
  assert.match(s, /role "coordinator" is held by coord-1/);
  assert.doesNotMatch(s, /Press ENTER/);
  assert.equal(await c.mode(), 'i');
  // no role: the first Enter warns, the second launches
  await c.control({ set: { launchError: '' } });
  await c.input('<Esc><Space>l');
  await c.waitScreen((x) => x.includes('launch a session'), 'the launcher again');
  await c.input('loner<CR>');
  await c.waitScreen((x) => x.includes('Enter again'), 'the roleless warning');
  assert.equal((await requestsOf(c, 'session.launch')).filter((f) => f.name === 'loner').length, 0);
  await c.input('<CR>');
  await c.waitScreen((x) => /loner +free/.test(x), 'loner in the panel');
  const [frame] = (await requestsOf(c, 'session.launch')).filter((f) => f.name === 'loner');
  assert.equal(frame?.role, undefined);
});

test('the sessions panel: c shows the capability table, C-v attaches in a vertical split, l opens the launcher', { skip }, async (t) => {
  const c = await startShell(t);
  await onSessionRow(c, 'impl-1');
  await c.input('c');
  let s = await c.waitScreen((x) => x.includes('capability table'), 'the capability table');
  assert.match(s, /impl-1 \[Implementer\] · Claude Code · capability table/);
  assert.match(s, /waiting for human +heuristic/);
  assert.match(s, /busy +reliable/);
  assert.match(s, /approvalRelay +none/);
  await c.input('q');
  await c.waitScreen((x) => !x.includes('capability table'), 'the float closed');
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

test('x asks on a line in the panel; n keeps the session, y sends session.stop and the row turns unknown · stopped', { skip }, async (t) => {
  const c = await startShell(t);
  await onSessionRow(c, 'impl-1');
  await c.input('x');
  await c.waitScreen((x) => x.includes('stop impl-1? y stops it · n keeps it'), 'the confirmation line');
  assert.doesNotMatch((await c.screen()).join('\n'), /Press ENTER|\[Y\]es/);
  await c.input('n');
  await c.waitScreen((x) => !x.includes('stop impl-1?'), 'kept');
  assert.equal((await requestsOf(c, 'session.stop')).length, 0);
  await c.input('gg/impl-1<CR>x');
  await c.waitScreen((x) => x.includes('stop impl-1?'), 'asked again');
  await c.input('y');
  const s = await c.waitScreen((x) => x.includes('impl-1 stopped') && /× impl-1 \[Implementer\]/.test(x) && x.includes('unknown · stopped'), 'the stopped row');
  assert.doesNotMatch(s, /stop impl-1\?/);
  const stops = await requestsOf(c, 'session.stop');
  assert.deepEqual(stops.map((f) => f.session), ['impl-1']);
});

test('a session.state unknown event shows unknown; a process that died shows unknown · died', { skip }, async (t) => {
  const c = await startShell(t);
  await c.input('<Esc>');
  await c.control({ emit: { type: 'session.state', session: 'coord-1', sessionId: 'coord-1-id', state: 'unknown', source: 'process', ts: ts(5) } });
  await c.waitScreen((x) => /Claude Code · opus · unknown/.test(x) && /\? coord-1 \[Coordinator\]/.test(x), 'coord-1 unknown');
  const procs = baseScenario('').processes ?? [];
  await c.control({ set: { processes: procs.map((p) => (p.name === 'coord-1' ? { ...p, status: 'exited', state: 'unknown', attach: null } : p)) } });
  await c.waitScreen((x) => /✗ coord-1 \[Coordinator\]/.test(x) && /Claude Code · opus · unknown · died/.test(x), 'coord-1 died, at the next refresh');
});

test("the picker's sessions kind: waiting ones first, filters by name, role and harness, Enter attaches", { skip }, async (t) => {
  const c = await startShell(t, (s) => {
    s.processes = [...(s.processes ?? []), { ...proc('rev-1', 'reviewer', 'idle', 'gpt-6.1-sol'), harness: 'codex' }];
    s.adapters = { ...s.adapters, codex: { ...CAPS, states: { ...CAPS.states, 'waiting for human': 'reliable' } } };
    s.attach = { ...s.attach, 'rev-1': `printf 'attached rev-1\\n'; sleep 600` };
  });
  await c.input('<Esc><Space>p<Tab>');
  let s = await c.waitScreen((x) => x.includes('↵ attach in centre') && x.includes('rev-1 [Reviewer]  Codex'), 'the sessions kind');
  const at = (re: RegExp) => s.split('\n').findIndex((l) => re.test(l));
  assert.ok(at(/impl-1 \[Implementer\]  Claude Code/) < at(/coord-1 \[Coordinator\]  Claude Code/), 'the waiting session first');
  assert.ok(at(/coord-1 \[Coordinator\]  Claude Code/) < at(/rev-1 \[Reviewer\]  Codex/), 'busy before idle');
  assert.match(s, /sonnet · waiting for human \(heuristic\)/);
  await c.input('codex');
  s = await c.waitScreen((x) => /rev-1 \[Reviewer\]  Codex/.test(x) && !/impl-1 \[Implementer\]  Claude/.test(x) && !/coord-1 \[Coordinator\]  Claude/.test(x), 'only the Codex session');
  await c.input('<C-u>Implementer');
  s = await c.waitScreen((x) => /impl-1 \[Implementer\]  Claude/.test(x) && !/rev-1 \[Reviewer\]  Codex/.test(x) && !/coord-1 \[Coordinator\]  Claude/.test(x), 'only the implementer');
  await c.input('<C-u>rev<CR>');
  await c.waitScreen((x) => x.includes('attached rev-1') && statusLine(x).includes('TERMINAL  rev-1 · session'), 'rev-1 attached');
});
