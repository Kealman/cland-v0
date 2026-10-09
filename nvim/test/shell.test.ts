import { ownDirectory } from '../../hub/test/process-cleanup.ts';
// The workbench shell (#25) against a stub hub over stdio (`stub-hub.ts`): deterministic topics,
// sessions with states and capability tables, items and events on command. Driven like a human, with
// nvim_input on a 160x45 UI, and read back with screenstring().
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createConnection } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { centreOf, clock as clockOf, nvimOrSkip, startClient, type Client } from './harness.ts';
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

type Shell = Client & {
  root: string;
  keylog: string;
  control: (cmd: Record<string, unknown>) => Promise<Record<string, unknown>>;
  /** Change the scenario file: what the next stub hub reads when the client spawns it again. */
  rewrite: (edit: (s: Scenario) => void) => Promise<void>;
  /** The stub hub dies after `rewrite`; the client reconnects to a new one, which reads the file again. */
  reconnect: (edit?: (s: Scenario) => void) => Promise<void>;
};

async function startShell(t: TestContext, edit: (s: Scenario) => void = () => {}, env: Record<string, string> = {}): Promise<Shell> {
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
  return Object.assign(c, { root, keylog, control, rewrite, reconnect });
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
  // the name with its role, as the hub labels it (spec 4.4)
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

test('a hub that comes back with coordinator null after a disconnect drops the chip (no ghost Coordinator from a missed role.vacant)', { skip }, async (t) => {
  const c = await startShell(t, (s) => {
    s.coordinator = 'coord-1';
  });
  await c.waitScreen((x) => topBar(x).includes('● coord-1 Coordinator') && !topBar(x).includes('no coordinator'), 'the coordinator chip');
  // the role went vacant while the client was away: no role.vacant event ever reaches it, only hub.status's null;
  // the session rows still name coord-1 as the coordinator, and the hub's word wins
  await c.reconnect((s) => {
    s.coordinator = null;
  });
  await c.waitScreen((x) => topBar(x).includes('no coordinator · messages queue in the hub'), 'the warning after the reconnect', 5000);
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
  // the picker opens on the kind used last (sessions); S-Tab goes back to topics (items · topics · sessions)
  await c.input('<Space>p<S-Tab>Agents<CR>');
  s = await c.waitScreen((x) => statusLine(x).includes('Agents log') && centreOf(x).includes('T-12 claimed.'), 'the Agents log (#34)');
});

test('gi, gt and gs on a reference under the cursor in the thread', { skip }, async (t) => {
  const c = await startShell(t);
  await c.input('<Esc><C-w>k');
  await c.waitScreen((x) => statusLine(x).includes('NORMAL'), 'normal mode in the thread');
  await c.input('gg/T-12<CR>gi');
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

test('the workbench reads sessions and presence once per connect; events update the panel without polling (T-71)', { skip }, async (t) => {
  const c = await startShell(t, (s) => { s.inbox = {}; });
  const asked = async (type: string) => ((await c.control({ requests: true })).requests as Array<{ type: string }>).filter((r) => r.type === type).length;
  await c.input('<Esc>');
  await c.waitScreen((x) => x.includes('SESSIONS'), 'the sessions panel');
  // Beyond the former default timer as well as the accelerated timer used by this fixture.
  await sleep(5500);
  for (const type of ['task.list', 'session.list', 'hub.status', 'role.list', 'inbox.list']) {
    assert.equal(await asked(type), 1, `${type} once on connecting`);
  }
  await c.control({ emits: Array.from({ length: 50 }, (_, i) => ({ type: 'session.state', session: `ghost-${i}`, sessionId: `g${i}`, state: 'busy', source: 'hook', ts: ts(5) })) });
  await c.control({ emit: { type: 'presence', sessions: [{ name: 'manual', sessionId: 'manual-id', role: 'reviewer', state: 'idle' }] } });
  await c.waitScreen((x) => x.includes('manual [Reviewer]'), 'a newly connected spoke');
  await c.control({ emit: { type: 'presence', sessions: [] } });
  await c.waitScreen((x) => !x.includes('manual [Reviewer]'), 'the spoke leaving');
  await c.control({ emit: { type: 'session.usage', session: 'impl-1', sessionId: 'impl-1-id', usage: { total: { totalTokens: 12300, cost: 1.8 } } } });
  await c.waitScreen((x) => x.includes('$1.80'), 'the usage snapshot');
  // An old launch's usage is ignored even when it reuses a current name.
  await c.control({ emit: { type: 'session.usage', session: 'impl-1', sessionId: 'old-launch', usage: { total: { cost: 999 } } } });
  await c.waitScreen((x) => x.includes('$1.80') && !x.includes('$999'), 'usage stays with its launch');
  await c.control({ emit: { type: 'session.process', process: { ...proc('coord-1', 'coordinator', 'unknown'), status: 'exited', attach: null } } });
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

  // then every kind of event the client handles, 50 of each wave in one write, malformed ones among them,
  // while the human is typing
  const item = baseScenario('').items?.[0] ?? {};
  const wave = (i: number): Array<Record<string, unknown>> => [
    { type: 'message', topic: { id: i % 2 ? 'general' : 'agents', title: 'x' }, message: { id: `w${i}`, from: 'coord-1', fromKind: 'agent', fromRole: 'coordinator', via: 'spoke', to: ['human'], text: `wave ${i}\nsecond line`, ts: ts(12), topic: i % 2 ? 'general' : 'agents' } },
    { type: 'delivery', topic: 'general', message: `w${i}`, stage: 'injected' },
    { type: 'topic', topic: { id: 'general', title: 'General', status: i % 3 ? 'open' : 'waiting for human', unread: i, warning: i % 5 ? null : 'no coordinator\nat all' } },
    { type: 'session.state', session: i % 2 ? 'coord-1' : 'nobody', sessionId: 'x', state: i % 2 ? 'busy' : 'idle', source: 'hook', ts: ts(12) },
    { type: 'session.role', session: 'impl-1', role: 'implementer', ts: ts(12) },
    { type: i % 2 ? 'role.vacant' : 'role.filled', role: 'coordinator', session: 'coord-1', ts: ts(12) },
    { type: 'task', id: 'T-12', item: { ...item, title: `Hub daemon ${i}` } },
    { type: 'ask', topic: 'general', ask: 'no-such-ask', card: { state: 'answered' } },
    { type: 'inbox', inbox: { asks: [{ id: 'a9', topic: { id: 'general', title: 'General' }, question: `q ${i}\nwith a second line`, options: ['one\ntwo', 'three'], free: true, from: 'coord-1', ts: ts(12) }], approvals: [], waiting: [], notifications: [{ id: `n${i}`, kind: 'death', text: 'died\nbadly', ts: ts(12) }], needsYou: 1 } },
    // malformed: a handler must not raise into the message area
    { type: 'topic', topic: 'not a table' },
    { type: 'task', id: 'T-99', item: 'nope' },
    { type: 'inbox', inbox: { asks: 'nope' } },
    { type: 'session.state' },
    { type: 'message', topic: { id: 'general' }, message: 'nope' },
  ];
  await c.input('<C-u>');
  await c.input('mid-burst ');
  for (let k = 0; k < 4; k++) {
    await c.control({ emits: Array.from({ length: 50 }, (_, i) => wave(k * 50 + i)).flat() });
  }
  await c.control({ emit: { type: 'message', topic: { id: 'general', title: 'General' }, message: { id: 'end', from: 'coord-1', fromKind: 'agent', fromRole: 'coordinator', via: 'spoke', to: ['human'], text: 'waves done', ts: ts(13), topic: 'general' } } });
  const after = await c.waitScreen((x) => centreOf(x).includes('waves done'), 'the last wave', 20_000);
  assert.doesNotMatch(after, /Press ENTER|E\d+:|Error/);
  assert.equal(await c.mode(), 'i', 'Insert mode in the composer survives the waves');
  await c.input('and done');
  await c.waitScreen((x) => x.includes('› mid-burst and done'), 'the composer keeps what was typed');
  // nothing reached the message area
  const messages = await c.lua<string>("return vim.api.nvim_exec2('messages', { output = true }).output");
  assert.equal(messages.trim(), '', `the message area: ${messages}`);
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
  for (const type of ['session.list', 'hub.status']) assert.equal((await requestsOf(c, type)).length, 2, `${type}: connect and own launch`);
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

test("the launcher's item line sends `item` instead of the directory: the hub starts the Implementer in the item's worktree", { skip }, async (t) => {
  const c = await startShell(t);
  await c.input('<Esc><Space>l');
  await c.waitScreen((x) => x.includes('launch a session') && /item +T-<n>/.test(x), 'the launcher form with its item line');
  // name, role, then past harness, model, directory and effort to the item
  await c.input('impl-7<Tab>implementer<Tab><Tab><Tab><Tab><Tab>T-7<CR>');
  await c.waitScreen((x) => /impl-7 \[Implementer\]/.test(x), 'impl-7 in the panel');
  const [frame] = (await requestsOf(c, 'session.launch')).filter((f) => f.name === 'impl-7');
  assert.equal(frame?.item, 'T-7');
  assert.equal(frame?.role, 'implementer');
  assert.equal(frame?.cwd, undefined, 'the item replaces the directory');
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
  for (const type of ['session.list', 'hub.status']) assert.equal((await requestsOf(c, type)).length, 2, `${type}: connect and own stop`);
});

test('a session.state unknown event shows unknown; a process that died shows unknown · died', { skip }, async (t) => {
  const c = await startShell(t);
  await c.input('<Esc>');
  await c.control({ emit: { type: 'session.state', session: 'coord-1', sessionId: 'coord-1-id', state: 'unknown', source: 'process', ts: ts(5) } });
  await c.waitScreen((x) => /Claude Code · opus · unknown/.test(x) && /\? coord-1 \[Coordinator\]/.test(x), 'coord-1 unknown');
  await c.control({ emit: { type: 'session.process', process: { ...proc('coord-1', 'coordinator', 'unknown'), status: 'exited', attach: null } } });
  await c.waitScreen((x) => /✗ coord-1 \[Coordinator\]/.test(x) && /Claude Code · opus · unknown · died/.test(x), 'coord-1 died, from its process row event');
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

// ------------------------------------------------------------------ the topic model (#32)

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

/** General and Agents, a topic waiting for the human, an open one with unread messages, one waiting for a vacant
 *  Coordinator bound to T-12, and a closed one, in the hub's order. */
function withTopics(s: Scenario): void {
  s.topics = [
    topic('general', 'General', 'open'),
    topic('agents', 'Agents', 'open'),
    topic('topic-1', 'Spoke reconnect: flaky', 'waiting for human', { unread: 2 }),
    topic('topic-4', 'Codex adapter', 'open', { unread: 3 }),
    topic('topic-2', 'Daemon hello', 'waiting for agent', { item: 'T-12', warning: 'no coordinator' }),
    topic('topic-3', 'cland task CLI', 'closed'),
  ];
  s.items = (s.items ?? []).map((it) => (it.id === 'T-12' ? { ...it, topic: 'topic-2' } : it));
}

/** Each row of the screen from its last vertical separator on: the right panel. */
const rightOf = (text: string): string =>
  text
    .split('\n')
    .map((l) => {
      const i = l.lastIndexOf('│');
      return i < 0 ? '' : l.slice(i + 1);
    })
    .join('\n');

test('the topics panel groups needs you, open and closed, pins what waits for the human, shows unread badges and the warning glyph; Enter opens and reads', { skip }, async (t) => {
  const c = await startShell(t, withTopics);
  await c.input('<Esc><Space>t');
  const s = await c.waitScreen((x) => x.includes('TOPICS') && x.includes('NEEDS YOU · 1'), 'the topics panel');
  const panel = rightOf(s);
  const order = ['NEEDS YOU · 1', 'Spoke reconnect: flaky', 'OPEN · 4', '● General', '≡ Agents', 'Codex adapter', 'Daemon hello', 'CLOSED · 1', 'cland task CLI'].map((w) => panel.indexOf(w));
  assert.ok(order.every((at) => at >= 0), `every row is there:\n${panel}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, `grouped, needs you pinned on top:\n${panel}`);
  assert.match(panel, /● Spoke reconnect: flaky +2 /, 'an unread badge');
  assert.match(panel, /● Codex adapter +3 /);
  assert.match(panel, /◐ T-12 Daemon hello +▲ /, 'waiting for an agent, bound, with the warning glyph');
  assert.match(panel, /○ cland task CLI/);
  assert.match(panel, /≡ Agents +log/);
  assert.match(s, /TOPICS +6 topics · 5 unread/);
  assert.match(topBar(s), /▲ needs you {2}1 /, 'the topic waiting for the human counts as needing you');

  // Enter on the pinned topic opens its thread; reading it clears the badge
  await c.input('<Space>t<Space>t');
  await c.waitScreen((x) => x.includes('TOPICS'), 'the panel again, focused');
  await c.input('gg/Spoke<CR><CR>');
  const opened = await c.waitScreen((x) => statusLine(x).includes('Spoke reconnect: flaky · topic waiting for human'), 'the thread');
  assert.match(topBar(opened), /│ Spoke reconnect: flaky/);
  await c.waitScreen((x) => /● Spoke reconnect: flaky/.test(rightOf(x)) && !/Spoke reconnect: flaky +2 /.test(rightOf(x)), 'the badge gone');
  assert.deepEqual((await requestsOf(c, 'topic.read')).map((f) => f.topic), ['topic-1']);
});

test('a message event raises the unread badge of a topic out of view, and opening it reads it', { skip }, async (t) => {
  const c = await startShell(t, withTopics);
  await c.input('<Esc><Space>t');
  await c.waitScreen((x) => /● Codex adapter +3 /.test(rightOf(x)), 'three unread');
  await c.control({ emit: { type: 'message', topic: { id: 'topic-4', title: 'Codex adapter' }, message: { id: 'n1', from: 'impl-1', fromKind: 'agent', fromRole: 'implementer', via: 'session', to: [], text: 'the thread resumes', ts: ts(20), topic: 'topic-4' } } });
  await c.waitScreen((x) => /● Codex adapter +4 /.test(rightOf(x)), 'four unread');
  // a message in the thread in view is read as it arrives
  await c.control({ emit: { type: 'message', topic: { id: 'general', title: 'General' }, message: { id: 'g1', from: 'coord-1', fromKind: 'agent', fromRole: 'coordinator', via: 'session', to: [], text: 'read at once', ts: ts(21), topic: 'general' } } });
  await c.waitScreen((x) => centreOf(x).includes('read at once'), 'the message in General');
  assert.doesNotMatch(rightOf((await c.screen()).join('\n')), /● General +1 /);
  assert.deepEqual((await requestsOf(c, 'topic.read')).map((f) => [f.topic, f.upTo]), [['general', 'g1']]);
  await c.input(':Cland view thread topic-4<CR>');
  await c.waitScreen((x) => topBar(x).includes('│ Codex adapter') && !/Codex adapter +4 /.test(rightOf(x)), 'read once in view');
  assert.deepEqual((await requestsOf(c, 'topic.read')).map((f) => f.topic), ['general', 'topic-4']);
});

test('a topic is created from the panel (n) and with :Cland topic new, closed with :Cland topic close and c in the panel, resolved with ␣r', { skip }, async (t) => {
  const c = await startShell(t, withTopics);
  await c.input('<Esc><Space>t');
  await c.waitScreen((x) => x.includes('TOPICS'), 'the panel, focused');
  await c.input('n');
  await c.waitScreen((x) => x.includes('New topic:'), 'the title prompt');
  await c.input('Pick a free model<CR>');
  let s = await c.waitScreen((x) => topBar(x).includes('│ Pick a free model') && statusLine(x).includes('Pick a free model · topic open'), 'the new topic in the centre');
  assert.match(rightOf(s), /● Pick a free model/);
  await c.input('<Esc>:Cland topic new Second one, by command<CR>');
  await c.waitScreen((x) => topBar(x).includes('│ Second one, by command'), 'the second topic');
  assert.deepEqual((await requestsOf(c, 'topic.create')).map((f) => f.title), ['Pick a free model', 'Second one, by command']);

  // :Cland topic close closes the topic in view: it moves to CLOSED
  await c.input('<Esc>:Cland topic close<CR>');
  s = await c.waitScreen((x) => rightOf(x).includes('CLOSED · 2') && statusLine(x).includes('Second one, by command · topic closed'), 'closed');
  assert.ok(rightOf(s).indexOf('CLOSED · 2') < rightOf(s).indexOf('○ Second one, by command'));
  // c on a row in the panel closes that one
  await c.input('<Space>t<Space>t');
  await c.waitScreen((x) => x.includes('TOPICS'), 'the panel, focused');
  await c.input('gg/Pick a free<CR>c');
  await c.waitScreen((x) => rightOf(x).includes('CLOSED · 3'), 'the row closed');
  assert.deepEqual((await requestsOf(c, 'topic.close')).map((f) => f.topic), ['topic-8', 'topic-7']);

  // ␣r from a thread clears its wait
  await c.input(':Cland view thread topic-2<CR><Esc><Space>r');
  await c.waitScreen((x) => statusLine(x).includes('Daemon hello · T-12 · topic open'), 'resolved');
  assert.deepEqual((await requestsOf(c, 'topic.resolve')).map((f) => f.topic), ['topic-2']);
});

test('the thread header shows the status, the binding and the warning; a topic event changes it; gi opens the bound item', { skip }, async (t) => {
  const c = await startShell(t, withTopics);
  await c.input('<Esc>:Cland view thread topic-2<CR>');
  let s = await c.waitScreen((x) => x.includes('Daemon hello · to @coordinator'), 'the thread of topic-2');
  const header = s.split('\n').find((l) => l.includes('Daemon hello · to @coordinator')) as string;
  assert.match(header, /Daemon hello · to @coordinator +0 artifacts · ga {2}T-12 {2}▲ no coordinator {2}topic waiting for agent/);
  assert.match(statusLine(s), /Daemon hello · T-12 · topic waiting for agent/);

  // the Coordinator took the message and answered: the hub's topic event
  await c.control({ emit: { type: 'topic', topic: topic('topic-2', 'Daemon hello', 'open', { item: 'T-12' }) } });
  s = await c.waitScreen((x) => /Daemon hello · to @coordinator +0 artifacts · ga {2}T-12 {2}topic open/.test(x), 'the header after the event');
  assert.doesNotMatch(s, /no coordinator {2}topic/);

  // gi from the bound topic: its item; gt from the item: back to its topic
  await c.input('<Esc>gi');
  await c.waitScreen((x) => statusLine(x).includes('T-12 · item'), 'the item view of T-12');
  await c.input('gt');
  await c.waitScreen((x) => statusLine(x).includes('Daemon hello · T-12 · topic open'), 'back to the topic');
});

test("the picker's topics kind lists needs you first, with the binding, the warning and the unread count, and filters by title", { skip }, async (t) => {
  const c = await startShell(t, withTopics);
  await c.input('<Esc><Space>p');
  let s = await c.waitScreen((x) => x.includes('pick ›') && x.includes('↵ open thread'), 'the picker on topics');
  const first = s.indexOf('● Spoke reconnect: flaky');
  assert.ok(first >= 0 && first < s.indexOf('● General') && s.indexOf('● General') < s.indexOf('○ cland task CLI'), `needs you first:\n${s}`);
  assert.match(s, /● Spoke reconnect: flaky .*needs you · 2 unread/);
  assert.match(s, /◐ Daemon hello .*T-12 · ▲ no coordinator · waiting for agent/);
  await c.input('codex');
  s = await c.waitScreen((x) => /● Codex adapter .*open · 3 unread/.test(x) && !x.includes('Daemon hello'), 'filtered by title');
  await c.input('<CR>');
  await c.waitScreen((x) => topBar(x).includes('│ Codex adapter'), 'the thread opened');
});

// Items (#36): the panel's tree and filters, the map grouping, the item view, the board, the motions and the
// picker's items kind, over a fixture set of items -----------------------------------------------------------

const item = (id: string, kind: string, title: string, extra: Record<string, unknown> = {}) => ({
  id,
  kind,
  title,
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

/** An epic with three children (claimed with two asks open in its topic; a not-clear review; closed with clear
 *  verdicts), a map with a decided, a frontier, a blocked and an assigned child, an item past review, one assigned
 *  to the human, and the base T-12 (claimed by impl-1) and T-13. */
function withItems(s: Scenario): void {
  s.processes = [...(s.processes ?? []), proc('impl-2', 'implementer', 'busy')];
  s.attach = { ...(s.attach ?? {}), 'impl-2': `printf 'attached impl-2\\n'; sleep 600` };
  s.topics = [
    topic('general', 'General', 'open'),
    topic('agents', 'Agents', 'open'),
    topic('topic-2', 'Items panel work', 'waiting for human', { item: 'T-2' }),
  ];
  // the ask badge counts the open asks in the bound topic (#33), not the topic's status
  const openAsk = (id: string, question: string) => ({ id, topic: { id: 'topic-2', title: 'Items panel work', item: 'T-2' }, question, options: ['yes', 'no'], free: true, from: 'coord-1', label: 'coord-1 [Coordinator]', ts: ts(1) });
  s.inbox = { asks: [openAsk('a-2', 'Tree or flat list?'), openAsk('a-3', 'Show closed items?')], approvals: [], waiting: [], notifications: [] };
  s.items = [
    item('T-1', 'epic', 'Workbench shell'),
    item('T-2', 'task', 'Items panel', { parent: 'T-1', claim: claimBy('impl-2'), topic: 'topic-2', branch: 't/2-items-panel', labels: ['ui', 'slice-1'] }),
    item('T-3', 'task', 'Board view', {
      parent: 'T-1',
      blocked_by: ['T-4'],
      body: '## Goal\n\nSix columns derived from the item.\n\n- backlog\n- done',
      verdicts: [verdict('review', 'clear', 'r-1', 3), verdict('review', 'not clear', 'r-2', 5)],
      comments: [
        { author: 'impl-2', at: ts(2), text: 'Ready for review.' },
        { author: 'rev-1', at: ts(5), text: 'The qa column is missing.', verdict: verdict('review', 'not clear', 'r-2', 5) },
      ],
    }),
    item('T-4', 'task', 'Item view', { parent: 'T-1', state: 'closed', verdicts: [verdict('review', 'clear', 'r-3', 4), verdict('qa', 'clear', 'q-1', 6)] }),
    item('T-5', 'map', 'Slice 2 map'),
    item('T-6', 'question', 'Which store', { parent: 'T-5', state: 'closed' }),
    item('T-7', 'question', 'Transport', { parent: 'T-5' }),
    item('T-8', 'question', 'Auth scheme', { parent: 'T-5', blocked_by: ['T-7'] }),
    item('T-9', 'question', 'CRDT spike', { parent: 'T-5', assignee: 'sub-1' }),
    item('T-10', 'task', 'Review passed', { verdicts: [verdict('review', 'clear', 'r-4', 7)] }),
    item('T-11', 'task', 'For the human', { assignee: 'human' }),
    ...(baseScenario('').items ?? []),
  ];
}

const leftOf = (text: string): string =>
  text
    .split('\n')
    .map((l) => {
      const i = l.indexOf('│');
      return i < 0 ? '' : l.slice(0, i);
    })
    .join('\n');

/** The left panel's rows that show an item or a group header, trimmed. */
const itemRows = (s: string): string[] =>
  leftOf(s)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^[○●◐◑◆◌] T-\d+ /.test(l) || /^[A-Z][A-Z -]+ · \d+$/.test(l));
const idsOf = (rows: string[]): string[] => rows.map((r) => r.split(' ')[1] ?? '');

test('the items panel: a tree of epics and maps with status glyphs, the claim right-aligned and the ask badge; filters 1–5 and f; the map grouping', { skip }, async (t) => {
  const c = await startShell(t, withItems);
  await c.input('<Esc><Space>i');
  let s = await c.waitScreen((x) => x.includes('ITEMS') && x.includes('T-13'), 'the items panel');
  assert.match(s, / ITEMS +all · 13 │/);
  assert.match(leftOf(s), /1 all 2 work 3 you 4 done 5 map/);
  const panel = leftOf(s);
  // the tree: children under their parent, indented, ordered by id; orphans at the root
  assert.match(panel, /^ ○ T-1 Workbench shell +1\/3 $/m, 'an epic with its progress');
  assert.match(panel, /^ {3}◆ T-2 Items panel +impl-2 {2}2 {2}$/m, 'claimed, with the ask badge counting the two open asks in its topic: needs you');
  assert.match(panel, /^ {3}◆ T-3 Board view +$/m, 'a not-clear review verdict: needs you');
  assert.match(panel, /^ {3}● T-4 Item view +$/m, 'closed');
  assert.match(panel, /^ ○ T-5 Slice 2 map +1\/4 $/m);
  assert.match(panel, /^ {3}◌ T-8 Auth scheme +$/m, 'an open blocker');
  assert.match(panel, /^ {3}◑ T-9 CRDT spike +sub-1 $/m, 'assigned');
  assert.match(panel, /^ ◐ T-12 Hub daemon and spo… impl-1 $/m, 'claimed, the session right-aligned');
  assert.deepEqual(idsOf(itemRows(s)), ['T-1', 'T-2', 'T-3', 'T-4', 'T-5', 'T-6', 'T-7', 'T-8', 'T-9', 'T-10', 'T-11', 'T-12', 'T-13']);

  const rowsOf = async (key: string, header: string) => {
    await c.input(key);
    const x = await c.waitScreen((y) => y.includes(` ITEMS`) && new RegExp(`${header} │`).test(y.split('\n')[1] ?? ''), `the ${header} filter`);
    return itemRows(x);
  };
  // 2: in work (claimed or assigned, open)
  assert.deepEqual(idsOf(await rowsOf('2', 'in work · 4')), ['T-2', 'T-9', 'T-11', 'T-12']);
  // 3: needs you
  assert.deepEqual(idsOf(await rowsOf('3', 'needs you · 2')), ['T-2', 'T-3']);
  // 4: done
  assert.deepEqual(idsOf(await rowsOf('4', 'done · 2')), ['T-4', 'T-6']);
  // 5: the map, grouped under headers, ordered by id
  assert.deepEqual(
    (await rowsOf('5', 'map · 1 map')).map((r) => r.replace(/\s+/g, ' ')),
    ['○ T-5 Slice 2 map 1/4', 'DECIDED · 1', '● T-6 Which store', 'FRONTIER · 1', '○ T-7 Transport', 'IN WORK BY SUB-AGENTS · 1', '◑ T-9 CRDT spike sub-1', 'BLOCKED · 1', '◌ T-8 Auth scheme'],
  );
  // f cycles back to all, F goes back
  await c.input('f');
  await c.waitScreen((y) => / ITEMS +all · 13 │/.test(y), 'f: all again');
  await c.input('F');
  await c.waitScreen((y) => / ITEMS +map · 1 map │/.test(y), 'F: map');
  // Enter on a row opens the item view
  await c.input('1');
  await c.waitScreen((y) => / ITEMS +all · 13 │/.test(y), 'all');
  await c.input('gg/T-3 Board<CR><CR>');
  s = await c.waitScreen((y) => statusLine(y).includes('T-3 · item'), 'the item view of T-3');
  assert.match(topBar(s), /│ T-3 Board view/);
});

test('sessions show running token and cost totals; the claiming session total supplies the item cost', { skip }, async (t) => {
  const c = await startShell(t, (s) => {
    s.processes = (s.processes ?? []).map((p) => ({
      ...p,
      usage: p.name === 'coord-1'
        ? { total: { totalTokens: 12300, inputTokens: 9000, outputTokens: 1000, cacheReadTokens: 2300, cacheWriteTokens: 0, reasoningTokens: 0 }, last: { totalTokens: 12 } }
        : { total: { totalTokens: 5000, cost: 1.8 }, last: { totalTokens: 12, cost: 0.25 } },
    }));
  });
  const panel = await c.waitScreen((s) => s.includes('12.3k tok') && s.includes('$1.80'), 'session totals in the panel');
  assert.doesNotMatch(panel, /12 tok|\$0\.25/);
  await c.input('<Esc><Space>s');
  await c.waitScreen((s) => !s.includes('SESSIONS'), 'sessions panel closed');
  await c.input(':Cland view item T-12<CR>');
  const item = await c.waitScreen((s) => /│ cost +\$1\.80/.test(s), 'the claiming session total cost in the item view');
  assert.doesNotMatch(item, /\$0\.25/);
});

test('an item body with a list indented past the window width renders, and Neovim keeps answering', { skip, timeout: 30_000 }, async (t) => {
  const deep = `${' '.repeat(150)}- deep item with a few words to wrap`;
  const c = await startShell(t, (s) => {
    s.items = (s.items ?? []).map((i) => (i.id === 'T-12' ? { ...i, body: `## Plan\n\n- top\n${deep}\n  1. numbered under it\n\nafter the list` } : i));
  });
  await c.input('<Esc>:Cland view item T-12<CR>');
  let s = await c.waitScreen((x) => x.includes('after the list'), 'the item view with the deep list');
  assert.match(s, /^ - top /m);
  // the marker kept at half the body's width, the words wrapped beside it, the fields column untouched
  assert.match(s, /^ {20,}- deep item with a few words to +│ branch/m);
  assert.match(s, /^ {20,}wrap +│ blocked by/m);
  assert.match(s, /^ {3}1\. numbered under it /m);
  // a narrower centre (the items panel opens too): the list still renders
  await c.input('<Space>i');
  s = await c.waitScreen((x) => x.includes('ITEMS') && /│ +- deep item/.test(x) && x.includes('after the list'), 'the items panel beside the item view');
  assert.equal(await c.mode(), 'n');
});

test('the item view after a reconnect: a task.view lost with the hub is fetched again, and a body changed meanwhile shows', { skip }, async (t) => {
  const withBody = (body: string, hold: boolean) => (s: Scenario) => {
    s.holdView = hold;
    s.items = (s.items ?? []).map((i) => (i.id === 'T-12' ? { ...i, body } : i));
  };
  const c = await startShell(t, withBody('the first body', true));
  await c.input('<Esc>:Cland view item T-12<CR>');
  await c.waitScreen((x) => x.includes('loading the item'), 'the item view waiting for task.view');
  // the hub goes away with task.view unanswered; the one that comes back has a new body, `updated` unchanged
  await c.reconnect(withBody('the second body', false));
  await c.waitScreen((x) => x.includes('the second body') && !x.includes('hub exited'), 'the body fetched again after the reconnect', 5000);
  // an edit while disconnected, `updated` unchanged again: the reconnect fetches it
  await c.reconnect(withBody('the third body', false));
  await c.waitScreen((x) => x.includes('the third body'), 'the body changed while away', 5000);
});

test('the item view: the title line, the fields column beside the body, the verdicts latest first, the comments', { skip }, async (t) => {
  const c = await startShell(t, withItems);
  // no panels: the centre is wide enough for the fields column beside the body
  await c.input('<Esc><Space>s');
  await c.waitScreen((x) => !x.includes('SESSIONS'), 'no right panel');
  await c.input(':Cland view item T-3<CR>');
  let s = await c.waitScreen((x) => x.includes('COMMENTS · 2'), 'the item view of T-3 with its comments');
  const rows = s.split('\n');
  const at = (re: RegExp) => rows.findIndex((r) => re.test(r));
  assert.match(s, /^ ◆ T-3 · open · needs you · task +$/m, 'the title line: id and state');
  // the fields column, right of the body, row by row
  assert.match(s, /^ Board view +│ state {6}◆ open · needs you +$/m);
  assert.match(s, /^ \.cland\/tasks\/T-3-board-view\.md · updated .+│ kind {7}task · no labels +$/m);
  assert.match(s, /│ parent {5}T-1 Workbench shell +$/m);
  assert.match(s, /│ assignee {3}— +$/m);
  assert.match(s, /│ claim {6}— +$/m);
  assert.match(s, /│ topic {6}no topic yet +$/m);
  assert.match(s, /│ blocked by T-4 \(closed\) +$/m);
  assert.match(s, /│ blocks {5}— +$/m);
  assert.match(s, /│ cost {7}— +$/m);
  // the body as Markdown text
  assert.ok(at(/^ ## Goal /) > 0 && at(/^ Six columns derived from the item\. /) > at(/^ ## Goal /));
  assert.match(s, /^ - backlog /m);
  // the verdicts: the latest of each kind on top, the earlier below
  assert.match(s, /^ VERDICTS · 2 /m);
  const latest = at(/^ ✗ review not clear · by rev-1 \[Reviewer\] · run r-2 · /);
  const earlier = at(/^ ✓ review clear · by rev-1 \[Reviewer\] · run r-1 · /);
  assert.ok(latest > 0 && earlier > latest && at(/^ earlier /) === latest + 1, 'the latest verdict first');
  // the comments, a verdict comment marked
  assert.match(s, /^ impl-2 {2}\d{4}-\d\d-\d\d \d\d:\d\d +/m);
  assert.match(s, /^ {3}Ready for review\. /m);
  assert.match(s, /^ rev-1 {2}\d{4}-\d\d-\d\d \d\d:\d\d {2}review not clear /m);
  assert.match(s, /^ {3}The qa column is missing\. /m);

  // another item: its claim, topic, branch, labels; the item it blocks
  await c.input(':Cland view item T-2<CR>');
  s = await c.waitScreen((x) => statusLine(x).includes('T-2 · item') && x.includes('COMMENTS · 0'), 'the item view of T-2');
  assert.match(s, /│ kind {7}task · ui, slice-1 +$/m);
  assert.match(s, /│ claim {6}impl-2 \[Implementer\] · since .+$/m);
  assert.match(s, /│ topic {6}Items panel work · waiting for you +$/m);
  assert.match(s, /│ branch {5}t\/2-items-panel +$/m);
  assert.match(s, /^ none yet /m, 'no verdicts');
  await c.input(':Cland view item T-7<CR>');
  s = await c.waitScreen((x) => statusLine(x).includes('T-7 · item') && x.includes('COMMENTS'), 'the item view of T-7');
  assert.match(s, /│ blocks {5}T-8 +$/m);
  assert.match(s, /│ parent {5}T-5 Slice 2 map +$/m);
});

/** The board on screen: the column names, the card ids per column top to bottom, and every cell's text. */
function boardOf(screen: string): { header: string[]; ids: string[][]; text: string[][] } {
  const rows = screen.split('\n');
  const at = rows.findIndex((r) => r.includes('BACKLOG'));
  const cols = (r: string) => r.split('│').map((x) => x.trim());
  const ids: string[][] = [[], [], [], [], [], []];
  const text: string[][] = [[], [], [], [], [], []];
  for (const r of rows.slice(at + 1)) {
    if (!r.includes('│')) break;
    cols(r).forEach((cell, i) => {
      const m = /^(T-\d+)/.exec(cell);
      if (m) ids[i]?.push(m[1] ?? '');
      if (cell) text[i]?.push(cell);
    });
  }
  return { header: at < 0 ? [] : cols(rows[at] ?? ''), ids, text };
}

test('the board: backlog, planned, in progress, review, qa and done derived from state, claims, labels and verdicts; ↵ opens a card', { skip }, async (t) => {
  const c = await startShell(t, withItems);
  await c.input('<Esc><Space>s');
  await c.waitScreen((x) => !x.includes('SESSIONS'), 'no right panel');
  await c.input('<Space>b');
  const s = await c.waitScreen((x) => x.includes('BACKLOG') && statusLine(x).includes('Board'), 'the board');
  const { header, ids, text } = boardOf(s);
  assert.deepEqual(header, ['BACKLOG', 'PLANNED', 'IN PROGRESS', 'REVIEW', 'QA', 'DONE']);
  assert.deepEqual(text.map((col) => col[0]?.split(' ')[0]), ['3', '2', '2', '1', '1', '2'], 'the counts under the names');
  assert.deepEqual(ids, [['T-7', 'T-8', 'T-13'], ['T-9', 'T-11'], ['T-2', 'T-12'], ['T-3'], ['T-10'], ['T-4', 'T-6']]);
  // the marks: the ask, the claim, the assignee, a blocker, the verdicts
  assert.ok(text[2]?.includes('T-2 ? ask') && text[2]?.includes('impl-2') && text[2]?.includes('impl-1'), text[2]?.join(' | '));
  assert.ok(text[1]?.includes('for sub-1') && text[1]?.includes('for human'), text[1]?.join(' | '));
  assert.ok(text[0]?.includes('◌ by T-7'), text[0]?.join(' | '));
  assert.ok(text[3]?.includes('✗ review'), text[3]?.join(' | '));
  assert.ok(text[4]?.includes('✓ review'), text[4]?.join(' | '));
  assert.ok(text[5]?.includes('✓ review') && text[5]?.includes('✓ qa'), text[5]?.join(' | '));
  // a label moves a card: `review` on a claimed item
  await c.control({ emit: { type: 'task', id: 'T-12', item: { ...(baseScenario('').items?.[0] ?? {}), labels: ['review'], verdicts: [] } } });
  await c.waitScreen((x) => JSON.stringify(boardOf(x).ids) === JSON.stringify([['T-7', 'T-8', 'T-13'], ['T-9', 'T-11'], ['T-2'], ['T-3', 'T-12'], ['T-10'], ['T-4', 'T-6']]), 'T-12 in the review column under T-3');
  // ↵ on a card opens its item view
  await c.input('gg/T-10<CR><CR>');
  await c.waitScreen((x) => statusLine(x).includes('T-10 · item'), 'the item view of T-10');
});

test('gi, gt and gs between items, topics and sessions, both ways; a topic event binding an item is followed', { skip }, async (t) => {
  const c = await startShell(t, withItems);
  await c.input('<Esc>:Cland view item T-2<CR>');
  await c.waitScreen((x) => statusLine(x).includes('T-2 · item'), 'T-2');
  // item → its topic
  await c.input('gt');
  await c.waitScreen((x) => statusLine(x).includes('Items panel work · T-2 · topic'), 'gt: the topic bound to T-2');
  // topic → its item
  await c.input('<Esc><C-w>kgi');
  await c.waitScreen((x) => statusLine(x).includes('T-2 · item'), 'gi: the bound item');
  // item → the claiming session; session → its item
  await c.input('gs');
  await c.waitScreen((x) => statusLine(x).includes('impl-2 · session'), 'gs: the claiming session');
  await c.input('gi');
  await c.waitScreen((x) => statusLine(x).includes('T-2 · item'), 'gi: the claimed item');
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
  await c.input('gg/T-12<CR>gi');
  await c.waitScreen((x) => statusLine(x).includes('T-12 · item'), 'gi from the T-12 card');
  await c.input('<Space>b');
  await c.waitScreen((x) => statusLine(x).includes('Board'), 'the board again');
  await c.input('gg/T-2 <CR>gt');
  await c.waitScreen((x) => statusLine(x).includes('Items panel work · T-2 · topic'), 'gt from the T-2 card');
});

test('the tree follows task events: a claim, a new item, a removed file', { skip }, async (t) => {
  const c = await startShell(t, withItems);
  await c.input('<Esc><Space>i');
  await c.waitScreen((x) => x.includes('ITEMS') && x.includes('T-13'), 'the items panel');
  await c.control({ emit: { type: 'task', id: 'T-7', item: item('T-7', 'question', 'Transport', { parent: 'T-5', claim: claimBy('impl-2') }) } });
  await c.waitScreen((x) => /^ {3}◐ T-7 Transport +impl-2 $/m.test(leftOf(x)), 'T-7 claimed');
  await c.control({ emit: { type: 'task', id: 'T-14', item: item('T-14', 'task', 'Born by hand', { parent: 'T-1' }) } });
  await c.waitScreen((x) => /^ {3}○ T-14 Born by hand +$/m.test(leftOf(x)) && / ITEMS +all · 14 │/.test(x), 'T-14 under T-1');
  const rows = idsOf(itemRows(await c.screen().then((l) => l.join('\n'))));
  assert.deepEqual(rows.slice(0, 5), ['T-1', 'T-2', 'T-3', 'T-4', 'T-14'], 'a new child joins its parent, ordered by id');
  await c.control({ emit: { type: 'task', id: 'T-13', item: null } });
  await c.waitScreen((x) => !x.includes('T-13 Codex') && / ITEMS +all · 13 │/.test(x), 'T-13 gone');
});

test("the picker's items kind searches ids, titles and claims; Enter opens the item view", { skip }, async (t) => {
  const c = await startShell(t, withItems);
  await c.input('<Esc><Space>p<S-Tab>');
  let s = await c.waitScreen((x) => x.includes('↵ open the item view'), 'the items kind');
  assert.match(s, /◆ T-2 Items panel {2}impl-2 .*needs you · claim impl-2/);
  assert.match(s, /○ T-13 Codex adapter .*open/);
  await c.input('impl-1');
  s = await c.waitScreen((x) => /◐ T-12 Hub daemon/.test(x) && !/T-2 Items panel/.test(x), 'by claim');
  await c.input('<C-u>Board view');
  s = await c.waitScreen((x) => /◆ T-3 Board view/.test(x) && !/T-12 Hub daemon/.test(x), 'by title');
  await c.input('<C-u>T-11');
  await c.waitScreen((x) => /◑ T-11 For the human/.test(x.split('\n').find((l) => /[○●◐◑◆◌] T-\d/.test(l)) ?? ''), 'by id, T-11 first');
  await c.input('<CR>');
  await c.waitScreen((x) => statusLine(x).includes('T-11 · item'), 'the item view of T-11');
});

// ------------------------------------------------------------------ the Agents log (#34)

/** Agents with an agent-to-agent message and lifecycle notices (a session start, a claim, a mute). */
function withAgentsLog(s: Scenario): void {
  s.messages = {
    ...(s.messages ?? {}),
    agents: [
      { id: 'n1', from: 'hub', fromKind: 'hub', via: 'hub', to: [], text: 'impl-1 [Implementer] started (claude-code, sonnet)', ts: ts(1), topic: 'agents', kind: 'session-start' },
      { id: 'm2', from: 'impl-1', fromKind: 'agent', fromRole: 'implementer', via: 'session', to: ['coord-1'], text: 'T-12 claimed.', ts: ts(2), topic: 'agents' },
      { id: 'n2', from: 'hub', fromKind: 'hub', via: 'hub', to: [], text: 'impl-1 [Implementer] claimed T-12', ts: ts(3), topic: 'agents', kind: 'claim' },
      { id: 'n3', from: 'hub', fromKind: 'hub', via: 'hub', to: ['coord-1', 'impl-1'], text: 'coord-1 [Coordinator] ↔ impl-1 [Implementer] muted: a hard 10-min cool-down', ts: ts(4), topic: 'agents', kind: 'mute', detail: { code: 'hygiene', rule: 'loop', until: ts(14), pair: ['coord-1', 'impl-1'] } },
    ],
  };
}

// ------------------------------------------------------------------ asks and the inbox (#33)

const ASK_OPTIONS = ['the name recorded by the spoke', 'the harness session id', 'ask me later'];

/** An open ask in topic-1 (bound to T-12), an approval, a topic waiting without an ask, three notifications. */
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
    approvals: [{ session: 'impl-1', label: 'impl-1 [Implementer]', harness: 'claude-code', since: ts(2), attach: 'claude attach impl-1-bg' }],
    waiting: [topic('topic-5', 'Spoke reconnect: flaky test', 'waiting for human', { unread: 2 })],
    notifications: [
      { id: 'n1', kind: 'verdict', text: 'T-19 review not clear · rev-1', ts: ts(3), item: 'T-19', session: 'rev-1', result: 'not clear', dismissed: false },
      { id: 'n2', kind: 'role', text: 'rev-1 is Reviewer: assigned', ts: ts(4), session: 'rev-1', dismissed: false },
      { id: 'n3', kind: 'death', text: 'impl-3 [Implementer] died: its harness exited', ts: ts(5), session: 'impl-3', dismissed: false },
    ],
  };
}

test('the Agents log (␣L, :Cland view log) lists messages with sender [Role] → addressee and notices with kind glyphs, and follows message events', { skip }, async (t) => {
  const c = await startShell(t, withAgentsLog);
  // ␣a opens the artifacts kind of the picker; Escape returns to General.
  await c.input('<Esc><Space>a');
  await c.waitScreen((x) => x.includes('pick ›') && x.includes('artifacts'), 'the artifacts picker');
  await c.input('<Esc>');
  assert.match(topBar((await c.screen()).join('\n')), /│ General/);
  await c.input('<Space>L');
  let s = await c.waitScreen((x) => topBar(x).includes('│ Agents log') && centreOf(x).includes('T-12 claimed.'), 'the Agents log');
  const centre = centreOf(s);
  assert.match(centre, /read-only log: lifecycle events and agent-to-agent messages · r on a message replies to its sender/);
  assert.match(centre, new RegExp(`${clockOf(ts(1))} {2}▶ impl-1 \\[Implementer\\] started \\(claude-code, sonnet\\)`));
  assert.match(centre, new RegExp(`${clockOf(ts(2))} {2}impl-1 \\[Implementer\\] → coord-1 \\[Coordinator\\] {2}T-12 claimed\\.`));
  assert.match(centre, /⚑ impl-1 \[Implementer\] claimed T-12/);
  assert.match(centre, /⊘ coord-1 \[Coordinator\] ↔ impl-1 \[Implementer\] muted/);
  const order = ['▶ impl-1', 'T-12 claimed.', '⚑ impl-1', '⊘ coord-1'].map((w) => centre.indexOf(w));
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'oldest first');
  // the hub's message event for agents adds a row
  await c.control({ emit: { type: 'message', topic: { id: 'agents', title: 'Agents' }, message: { id: 'n4', from: 'hub', fromKind: 'hub', via: 'hub', to: [], text: 'impl-1 [Implementer] stopped', ts: ts(5), topic: 'agents', kind: 'session-stop' } } });
  s = await c.waitScreen((x) => centreOf(x).includes('■ impl-1 [Implementer] stopped'), 'the new notice');
  // ␣L again returns; :Cland view log and Agents as a thread open the log
  await c.input('<Space>L');
  await c.waitScreen((x) => topBar(x).includes('│ General'), 'back to General');
  await c.input('<Esc>:Cland view log<CR>');
  await c.waitScreen((x) => topBar(x).includes('│ Agents log'), 'the log by command');
  await c.input('<Space>g');
  await c.waitScreen((x) => topBar(x).includes('│ General'), 'General again');
  await c.input('<Esc>:Cland view thread agents<CR>');
  await c.waitScreen((x) => topBar(x).includes('│ Agents log'), 'Agents as a thread opens the log');
  assert.equal(await c.lua<string>('return vim.b.cland_role'), 'log');
});

test('r on a message in the Agents log prepares a reply to its sender; the hub gets topic.send with replyTo; r on a notice says it has no sender', { skip }, async (t) => {
  const c = await startShell(t, withAgentsLog);
  await c.input('<Esc><Space>L');
  await c.waitScreen((x) => centreOf(x).includes('T-12 claimed.'), 'the Agents log');
  // a notice first: nothing to answer
  await c.input('gg/claimed T-12<CR>r');
  await c.waitScreen((x) => statusLine(x).includes('a hub notice has no sender to answer'), 'the notice refusal');
  assert.equal(await c.lua<string>('return vim.b.cland_role'), 'log');
  // then the agent's message
  await c.input('gg/T-12 claimed<CR>r');
  const s = await c.waitScreen((x) => x.includes('reply to impl-1 [Implementer]'), 'the reply composer');
  assert.match(s, /↩ reply to impl-1 \[Implementer\]/);
  assert.equal(await c.mode(), 'i', 'typing the reply');
  assert.deepEqual(await c.lua<[string, string, string]>('return { vim.b.cland_role, vim.b.cland_reply_to, vim.b.cland_reply_sender }'), ['composer', 'm2', 'impl-1']);
  await c.input('keep T-12 small<CR>');
  await c.waitScreen((x) => statusLine(x).includes('replied to impl-1 [Implementer]'), 'replied');
  const sends = await requestsOf(c, 'topic.send');
  assert.deepEqual(
    sends.map((f) => [f.topic, f.text, f.replyTo]),
    [['agents', 'keep T-12 small', 'm2']],
  );
  // the reply shows in the log, addressed to the sender, and the composer is gone
  await c.waitScreen((x) => centreOf(x).includes('you → impl-1 [Implementer]  keep T-12 small') && !x.includes('↩ reply to'), 'the reply in the log');
});

/** The inbox in the right panel, focused. */
async function openInbox(c: Shell): Promise<string> {
  await c.input('<Esc><Space>n');
  return c.waitScreen((x) => x.includes('INBOX') && rightOf(x).includes('NOTIFICATIONS'), 'the inbox panel');
}

test('the inbox lists asks, approvals, waiting topics and notifications in that order; the top bar counts what needs the human', { skip }, async (t) => {
  const c = await startShell(t, withInbox);
  const s = await openInbox(c);
  const panel = rightOf(s);
  // the asker as everywhere: name [Role], the hub's label
  assert.match(panel, /\? T-12 +coord-1 \[Coordinator\] · /);
  const order = [
    'ASKS · ANSWER HERE',
    '? T-12',
    'Which should win?',
    '1  the name recorded by the',
    '2  the harness session id',
    '3  ask me later',
    'i free answer · ↵ open the topic',
    'APPROVALS · ANSWER IN THE SESSI',
    '▲ impl-1 [Implementer]',
    'WAITING FOR YOU · TOPICS',
    '● Spoke reconnect: flaky te',
    'NOTIFICATIONS · d dismiss · D all',
    '✗ T-19 review not clear · rev-1',
    '↔ rev-1 is Reviewer: assigned',
    '! impl-3 [Implementer] died',
  ].map((w) => panel.indexOf(w));
  assert.ok(order.every((at) => at >= 0), `every row is there:\n${panel}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, `in the design's order:\n${panel}`);
  assert.match(s, /INBOX +3 need you/);
  assert.match(topBar(s), /▲ needs you {2}3 /, 'asks + approvals + waiting topics, from the hub');
  assert.match(statusLine(s), /1-9 answer · i free answer/);
});

test('2 on an ask row answers with option 2: topic.answer goes out, the row leaves and the count drops; d on an ask does nothing', { skip }, async (t) => {
  const c = await startShell(t, withInbox);
  await openInbox(c);
  // d on an ask: nothing is dismissed, a hint says why
  await c.input('gg/Which should<CR>d');
  let s = await c.waitScreen((x) => statusLine(x).includes('asks and approvals are not dismissed'), 'the hint');
  assert.match(rightOf(s), /Which should win\?/);
  assert.deepEqual(await requestsOf(c, 'inbox.dismiss'), []);
  await c.input('2');
  s = await c.waitScreen((x) => !rightOf(x).includes('Which should win?') && topBar(x).includes('needs you  2 '), 'the ask answered');
  assert.deepEqual((await requestsOf(c, 'topic.answer')).map((f) => [f.ask, f.option, f.text]), [['a1', 2, undefined]]);
  assert.doesNotMatch(rightOf(s), /ASKS · ANSWER HERE/);
  assert.match(rightOf(s), /APPROVALS/);
  assert.equal(await c.mode(), 'n', 'answering never leaves the inbox');
});

test('i on an ask opens its topic with the composer armed: Enter sends the text as the free answer', { skip }, async (t) => {
  const c = await startShell(t, withInbox);
  await openInbox(c);
  await c.input('gg/ask me later<CR>i');
  let s = await c.waitScreen((x) => topBar(x).includes('│ Spoke identity') && x.includes('answer to: Which should win?'), 'the composer armed in the topic');
  assert.equal(await c.mode(), 'i');
  await c.input('keep both behind a flag<CR>');
  s = await c.waitScreen((x) => centreOf(x).includes('keep both behind a flag') && !rightOf(x).includes('Which should win?'), 'the free answer sent');
  assert.deepEqual((await requestsOf(c, 'topic.answer')).map((f) => [f.ask, f.option, f.text]), [['a1', undefined, 'keep both behind a flag']]);
  assert.deepEqual(await requestsOf(c, 'topic.send'), [], 'an answer, not a plain message');
  // the composer is a plain composer again
  await c.waitScreen((x) => x.includes('to: Coordinator'), 'the composer disarmed');
  assert.match(s, /answered in your words/);
});

test('Enter on an approval attaches the session in the centre', { skip }, async (t) => {
  const c = await startShell(t, withInbox);
  await openInbox(c);
  await c.input('gg/impl-1 \\[Impl<CR><CR>');
  const s = await c.waitScreen((x) => x.includes('attached impl-1') && statusLine(x).includes('impl-1 · session'), 'impl-1 attached');
  assert.match(topBar(s), /│ impl-1 \[Implementer\]/);
  assert.deepEqual((await requestsOf(c, 'session.attach')).map((f) => f.session), ['impl-1']);
});

test('d dismisses the notification under the cursor, D all of them; asks and approvals stay', { skip }, async (t) => {
  const c = await startShell(t, withInbox);
  await openInbox(c);
  await c.input('gg/rev-1 is Reviewer<CR>d');
  let s = await c.waitScreen((x) => !rightOf(x).includes('rev-1 is Reviewer') && rightOf(x).includes('T-19 review not clear'), 'one dismissed');
  assert.deepEqual((await requestsOf(c, 'inbox.dismiss')).map((f) => f.notification), ['n2']);
  await c.input('D');
  s = await c.waitScreen((x) => !rightOf(x).includes('NOTIFICATIONS'), 'all dismissed');
  assert.equal((await requestsOf(c, 'inbox.dismiss_all')).length, 1);
  assert.match(rightOf(s), /Which should win\?/);
  assert.match(rightOf(s), /▲ impl-1 \[Implementer\]/);
  assert.match(topBar(s), /needs you {2}3 /, 'notifications never counted');
});

test('the ask card in the thread: the question, numbered options and the free-answer hint; 2 on it answers, and the answer shows beneath', { skip }, async (t) => {
  const c = await startShell(t, withInbox);
  await c.input('<Esc>:Cland view thread topic-1<CR>');
  let s = await c.waitScreen((x) => x.includes('┃ 2  the harness session id'), 'the card');
  const card = [`coord-1 [Coordinator]  ${clockOf(ts(1))}`, '┃ Which should win?', '┃ 1  the name recorded by the spoke', '┃ 2  the harness session id', '┃ 3  ask me later', '┃ 1-9 answers · free answer: i'].map((w) => s.indexOf(w));
  assert.ok(card.every((at) => at >= 0), `the card:\n${s}`);
  assert.deepEqual([...card].sort((a, b) => a - b), card);
  assert.match(s, /ask · ▲ waiting for you/);
  await c.input('<Esc><C-w>k');
  await c.waitScreen((x) => statusLine(x).includes('NORMAL'), 'Normal mode in the thread');
  await c.input('gg/the harness<CR>2');
  s = await c.waitScreen((x) => x.includes('┃ ✓ 2  the harness session id') && x.includes('ask · ✓ answered'), 'the card answered');
  assert.deepEqual((await requestsOf(c, 'topic.answer')).map((f) => [f.ask, f.option]), [['a1', 2]]);
  // the answer message under the card
  const at = s.indexOf('┃ answered with 2');
  const you = s.indexOf(' you  ', at);
  assert.ok(at >= 0 && you > at && s.indexOf('the harness session id', you) > you, `the answer beneath the card:\n${s}`);
  assert.match(topBar(s), /needs you {2}2 /);
});

test('a question and options over several lines render as lines in the card and the inbox; a digit on any line of an option answers it', { skip }, async (t) => {
  const question = 'Which should win?\nThe spoke or the harness.';
  const options = ['the name recorded\nby the spoke', 'the harness session id', 'ask me later'];
  const c = await startShell(t, (s) => {
    withInbox(s);
    const a1 = s.messages?.['topic-1']?.[0] as Record<string, unknown>;
    Object.assign(a1, { text: question, ask: { question, options, free: true, state: 'open' } });
    Object.assign(s.inbox?.asks?.[0] ?? {}, { question, options });
  });
  await c.input('<Esc>:Cland view thread topic-1<CR>');
  let s = await c.waitScreen((x) => x.includes('┃ 2  the harness session id'), 'the card');
  const card = ['┃ Which should win?', '┃ The spoke or the harness.', '┃ 1  the name recorded', '┃    by the spoke', '┃ 2  the harness session id'].map((w) => s.indexOf(w));
  assert.ok(card.every((at) => at >= 0), `the card:\n${s}`);
  assert.deepEqual([...card].sort((a, b) => a - b), card);
  await c.input('<Space>n');
  s = await c.waitScreen((x) => rightOf(x).includes('The spoke or the harness.'), 'the inbox with both lines');
  const panel = rightOf(s);
  const rows = ['Which should win?', 'The spoke or the harness.', '1  the name recorded', 'by the spoke', '2  the harness session id'].map((w) => panel.indexOf(w));
  assert.ok(rows.every((at) => at >= 0), `the inbox:\n${panel}`);
  assert.deepEqual([...rows].sort((a, b) => a - b), rows);
  assert.doesNotMatch(c.stderr(), /newlines/);
  // the second line of option 1, in the inbox: 1 answers with it
  await c.input('gg/by the spoke<CR>1');
  await c.waitScreen((x) => statusLine(x).includes('answered with 1'), 'answered with 1');
  assert.deepEqual((await requestsOf(c, 'topic.answer')).map((f) => [f.ask, f.option]), [['a1', 1]]);
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

test('the inbox full width (␣N) shows the same sections and acts the same', { skip }, async (t) => {
  const c = await startShell(t, withInbox);
  await c.input('<Esc><Space>N');
  let s = await c.waitScreen((x) => statusLine(x).includes('Inbox · full width') && centreOf(x).includes('NOTIFICATIONS'), 'the inbox full width');
  const centre = centreOf(s);
  const order = ['ASKS · ANSWER HERE', '1  the name recorded by the spoke', 'APPROVALS', 'WAITING FOR YOU', 'NOTIFICATIONS'].map((w) => centre.indexOf(w));
  assert.ok(order.every((at) => at >= 0), centre);
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(s, /INBOX · FULL WIDTH/);
  await c.input('gg/ask me later<CR>3');
  s = await c.waitScreen((x) => !centreOf(x).includes('ASKS · ANSWER HERE') && centreOf(x).includes('APPROVALS'), 'answered with 3');
  assert.deepEqual((await requestsOf(c, 'topic.answer')).map((f) => [f.ask, f.option]), [['a1', 3]]);
  // an inbox event replaces the rows
  await c.control({ emit: { type: 'inbox', inbox: { asks: [], approvals: [], waiting: [], notifications: [], needsYou: 0 } } });
  s = await c.waitScreen((x) => centreOf(x).includes('✓ nothing needs you') && topBar(x).includes('✓ needs you 0'), 'an empty inbox');
});
