// T2: screen permutations consume committed protocol frames through stub-client.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { centreOf, clock as clockOf } from './stub-client.ts';
import type { Scenario } from './stub-hub.ts';
import { eventually, tempProject } from './fixture.ts';
import { fixtureEnvironment } from '../../test-support/fixture-environment.ts';
import { skip, ts, proc, baseScenario, startShell, requestsOf, onSessionRow, statusLine, type Shell } from './shell-fixture.ts';

const topBar = (s: string) => s.split('\n')[0] ?? '';


test('the chip and inbox header show only the hub count through event floods, messages and resolutions', { skip }, async t => {
  const bound = topic('topic-count', 'Count item', 'open', { item: 'T-12' });
  const c = await startShell(t, s => { s.inbox = {}; s.topics = [topic('general', 'General', 'open'), bound]; });
  await c.input('<Esc><Space>n');
  const count = async (expected: number) => {
    // A round trip is a processing barrier for all preceding pushed frames.
    await c.lua("require('cland').client:request({ type = 'role.list' }, function() vim.g.count_frames_seen = true end); assert(vim.wait(5000, function() return vim.g.count_frames_seen end)); vim.g.count_frames_seen = nil");
    const header = expected === 0 ? 'nothing needs you' : `${expected} need you`;
    const screen = await c.waitScreen(s => rightOf(s).includes(header), `inbox header: ${header}`);
    assert.equal(Number(topBar(screen).match(/needs you\s+(\d+)/)?.[1]), expected, screen);
    if (expected === 0) {
      assert.match(topBar(screen), /✓ needs you 0/);
      assert.match(rightOf(screen), /✓ nothing needs you/);
    }
  };
  const message = (id: string, extra: Record<string, unknown> = {}) => ({ type: 'message', topic: bound,
    message: { id, from: 'coord-1', fromKind: 'agent', fromRole: 'coordinator', to: ['human'], text: id, ts: ts(10), topic: bound.id, ...extra } });
  const ib = { asks: [] as Record<string, unknown>[], approvals: [] as Record<string, unknown>[],
    waiting: [] as Record<string, unknown>[] };
  const inbox = async (needsYou: number) => c.control({ set: { inbox: { ...ib, needsYou } }, emit: { type: 'inbox', inbox: { ...ib, needsYou } } });
  await count(0);
  // Hundreds of informational events never supply a human response count.
  await c.control({ emits: Array.from({ length: 427 }, (_, i) => ({ type: 'event', row: {
    id: `event-${i}`, kind: i % 2 ? 'verdict' : 'session', warning: i % 3 === 0, glyph: '·',
    subject: { kind: 'session', id: 'impl-1' }, text: `event ${i}`, ts: ts(10),
  } })) });
  await inbox(0);
  await count(0);
  // The hub owns the number even when the rows are unchanged and contain no asks.
  await inbox(7);
  await count(7);
  await inbox(0);
  await count(0);
  // The T-165 symptom: 98 unread addressed messages with no actionable rows.
  await c.control({ emits: Array.from({ length: 98 }, (_, i) => message(`ordinary-${i}`)) });
  await count(0);
  const ask = message('ask-new', { ask: { state: 'open', options: ['yes'], free: true } });
  await c.control({ emit: ask });
  await count(0); // The ask message cannot change the count before the hub supplies it.
  ib.asks = [{ id: 'ask-new', topic: bound, question: 'ask-new', options: ['yes'], from: 'coord-1', ts: ts(10) }];
  await inbox(1);
  await count(1);
  await c.control({ emit: ask });
  await count(1);
  ib.approvals = [{ id: 'approval-1', session: 'impl-1', label: 'impl-1 [Implementer]', since: ts(2) }];
  await inbox(2);
  await count(2);
  ib.waiting = [{ ...bound, id: 'topic-waiting', title: 'Waiting decision', status: 'waiting for human' }];
  await inbox(3);
  await count(3);
  await c.control({ emits: [
    { type: 'event', row: { id: 'failed', kind: 'verdict', warning: true, glyph: '⚠', subject: { kind: 'item', id: 'T-12' }, text: 'T-12 review not clear', ts: ts(10) } },
    { type: 'event', row: { id: 'died', kind: 'session', warning: true, glyph: '⚠', subject: { kind: 'session', id: 'impl-2' }, text: 'impl-2 died', ts: ts(10) } },
  ] });
  await count(3);
  await c.control({ emits: Array.from({ length: 100 }, (_, i) => message(`flood-${i}`, { to: i % 2 ? ['human'] : ['coord-1'] })) });
  await count(3);
  await c.input('<Esc>:Cland view thread topic-count<CR>');
  await c.waitScreen(s => topBar(s).includes('│ Count item'), 'reading the topic');
  await count(3); // Reading messages never changes the hub’s count.
  await c.control({ emit: { type: 'ask', topic: bound.id, ask: 'ask-new', card: { state: 'answered' } } });
  ib.asks = [];
  await inbox(2);
  await count(2);
  ib.approvals = [];
  await inbox(1);
  await count(1);
  ib.waiting = [];
  await inbox(0);
  await count(0);
  await c.input('<Esc><C-w>l');
  await c.input('gg/T-12 review not clear<CR>d');
  await count(0);
  await c.input('D');
  await count(0);
});

test('the count stays unknown until the hub says, follows hub.status, and stays unchanged by local answers', { skip }, async t => {
  const c = await startShell(t, s => { withInbox(s); s.inbox!.needsYou = null; });
  const initial = await openInbox(c);
  assert.doesNotMatch(topBar(initial), /needs you\s+\d/);
  assert.doesNotMatch(rightOf(initial), /\d+ need you|nothing needs you/);
  await c.input('<Esc>:Cland view inbox<CR>');
  const full = await c.waitScreen(s => topBar(s).includes('│ Inbox'), 'full inbox without a count');
  assert.doesNotMatch(statusLine(full), /\d+ need you/);
  await c.input('<Esc>:Cland view thread general<CR>');
  await c.waitScreen(s => topBar(s).includes('│ General'), 'back to General');
  await c.control({ set: { holdSnapshots: ['inbox.list'], inbox: { needsYou: 9 } } });
  await c.lua("require('cland').refresh()");
  const status = await c.waitScreen(s => topBar(s).includes('needs you  9 ') && rightOf(s).includes('9 need you'), 'hub.status supplies the count before inbox.list');
  assert.match(rightOf(status), /\? T-12/); // The held rows have not changed.
  await c.control({ set: { holdSnapshots: [] }, releaseSnapshots: ['inbox.list'] });
  const scenario: Scenario = {};
  withInbox(scenario);
  const ib = { ...scenario.inbox, needsYou: 17 };
  await c.control({ set: { inbox: ib }, emit: { type: 'inbox', inbox: ib } });
  await c.waitScreen(s => topBar(s).includes('needs you  17 ') && rightOf(s).includes('17 need you') && rightOf(s).includes('? T-12'), 'inbox event supplies a new count');
  await c.input('<Esc><C-w>l');
  await c.input('gg/T-12<CR>2');
  const answered = await c.waitScreen(s => !rightOf(s).includes('Which should win?') && statusLine(s).includes('answered with 2'), 'answer removes the row');
  assert.match(topBar(answered), /needs you {2}17 /, 'local answer never decrements the hub value');
  assert.match(rightOf(answered), /17 need you/);
  // A payload without a number keeps the last known value rather than deriving one from its rows.
  await c.control({ emit: { type: 'inbox', inbox: { asks: [], approvals: [], waiting: [] } } });
  const retained = await c.waitScreen(s => rightOf(s).includes('archive') && !rightOf(s).includes('ASKS AND APPROVALS') && !rightOf(s).includes('MESSAGES TO YOU'), 'rows replaced without a count');
  assert.match(topBar(retained), /needs you {2}17 /);
  assert.match(rightOf(retained), /17 need you/);
});

test('unread history and live messages never change the chip on startup, refresh or reconnect', { skip }, async t => {
  const bound = topic('topic-count', 'Count item', 'open', { unread: 98 });
  const addressed = (id: string) => ({ id, from: 'impl-1', fromKind: 'agent', to: ['human'], text: id, ts: ts(1), topic: bound.id });
  const history = Array.from({ length: 98 }, (_, i) => addressed(`history-${i}`));
  const c = await startShell(t, s => {
    s.inbox = {};
    s.topics = [topic('general', 'General', 'open'), bound];
    s.messages = { ...s.messages, [bound.id]: history };
  });
  await c.input('<Esc><Space>n');
  await c.waitScreen(s => rightOf(s).includes('nothing needs you'), 'empty inbox despite unread history');
  assert.match((await c.screen())[0] ?? '', /✓ needs you 0/);
  await c.control({ emit: { type: 'message', topic: bound, message: addressed('live') } });
  await c.control({ set: { topics: [topic('general', 'General', 'open'), { ...bound, unread: 99 }] } });
  await c.lua("require('cland').refresh(); assert(vim.wait(5000, function() return next(require('cland').client.snapshots) == nil end))");
  assert.match((await c.screen())[0] ?? '', /✓ needs you 0/);
  await c.reconnect(s => { s.topics = [topic('general', 'General', 'open'), { ...bound, unread: 99 }]; });
  const screen = await c.waitScreen(s => rightOf(s).includes('nothing needs you') && topBar(s).includes('✓ needs you 0'), 'reconnected inbox remains empty');
  assert.match(topBar(screen), /✓ needs you 0/);
});

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
  // Details appear only after the cursor selects the session (T-127).
  assert.doesNotMatch(s, /Claude Code · sonnet/);
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
  s = await named((x) => x.includes('ITEMS') && x.includes('▸ unscheduled (2)'), 'items');
  await c.input('/unscheduled (<CR>za');
  s = await named(x=>x.includes('T-12 Hub daemon'),'unscheduled rows unfolded');
  assert.match(s, /◐ T-12 Hub daemon and spo.* impl-1 ?│/);
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

test('presets are examples: watch opens items, topics docked over the inbox; steady the board and the inbox', { skip }, async (t) => {
  const c = await startShell(t);
  await c.input('<Esc>:Cland preset watch<CR>');
  let s = await c.waitScreen((x) => x.includes('ITEMS') && x.includes('TOPICS') && x.includes('INBOX'), 'the watch preset');
  assert.match(statusLine(s), /preset watch/);
  // A long transient notice has priority over context; check the context after it expires.
  await c.lua("require('cland.state').S.flash.at = vim.uv.now() - 8001; vim.cmd('redrawstatus')");
  s = await c.waitScreen((x) => statusLine(x).includes('General · topic'), 'the preset context after its notice');
  assert.match(statusLine(s), /General · topic.*preset watch/);
  await c.input(':Cland preset steady<CR>');
  s = await c.waitScreen((x) => topBar(x).includes('Board') && x.includes('INBOX') && !x.includes('ITEMS'), 'the steady preset');
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
    { type: 'inbox', inbox: { asks: [{ id: 'a9', topic: { id: 'general', title: 'General' }, question: `q ${i}\nwith a second line`, options: ['one\ntwo', 'three'], free: true, from: 'coord-1', ts: ts(12) }], approvals: [], waiting: [], needsYou: 1 } },
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
  await c.waitScreen((x) => x.includes('impl-1 stopped'), 'stop accepted');
  await c.input('zRgg/^ . impl-1<CR>');
  const s = await c.waitScreen((x) => x.includes('impl-1 stopped') && /× impl-1 \[Implementer\]/.test(x) && x.includes('unknown · stopped'), 'the stopped row');
  assert.doesNotMatch(s, /stop impl-1\?/);
  const stops = await requestsOf(c, 'session.stop');
  assert.deepEqual(stops.map((f) => f.session), ['impl-1']);
  for (const type of ['session.list', 'hub.status']) assert.equal((await requestsOf(c, type)).length, 2, `${type}: connect and own stop`);
});

test('a session.state unknown event shows unknown; a process that died shows unknown · died', { skip }, async (t) => {
  const c = await startShell(t);
  await onSessionRow(c, 'coord-1');
  await c.control({ emit: { type: 'session.state', session: 'coord-1', sessionId: 'coord-1-id', state: 'unknown', source: 'process', ts: ts(5) } });
  await c.waitScreen((x) => /Claude Code · opus · unknown/.test(x) && /\? coord-1 \[Coordinator\]/.test(x), 'coord-1 unknown');
  await c.control({ emit: { type: 'session.process', process: { ...proc('coord-1', 'coordinator', 'unknown'), status: 'exited', attach: null } } });
  await c.input('zRgg/^ . coord-1<CR>');
  await c.waitScreen((x) => /✗ coord-1 \[Coordinator\]/.test(x) && /Claude Code · opus · unknown · died/.test(x), 'coord-1 died, from its process row event');
});

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

function withTopics(s: Scenario): void {
  s.topics = [
    topic('general', 'General', 'open'),
    topic('agents', 'Agents', 'open'),
    topic('topic-1', 'Spoke reconnect: flaky', 'waiting for human', { unread: 2 }),
    topic('topic-4', 'Codex adapter', 'open', { unread: 3 }),
    topic('topic-2', 'Daemon hello', 'waiting for agent', { item: 'T-12', warning: 'no coordinator' }),
    topic('topic-3', 'cland task CLI', 'closed'),
  ];
  s.inbox = { waiting: [s.topics[2]!] };
  s.items = (s.items ?? []).map((it) => (it.id === 'T-12' ? { ...it, topic: 'topic-2' } : it));
}

const rightOf = (text: string): string =>
  text
    .split('\n')
    .map((l) => {
      const i = l.lastIndexOf('│');
      return i < 0 ? '' : l.slice(i + 1);
    })
    .join('\n');

test('the topics panel groups needs you and open, reveals closed with A, pins what waits for the human, shows unread badges and the warning glyph; Enter opens and reads', { skip }, async (t) => {
  const c = await startShell(t, withTopics);
  await c.input('<Esc><Space>t');
  let s = await c.waitScreen((x) => x.includes('TOPICS') && x.includes('NEEDS YOU · 1'), 'the topics panel');
  assert.doesNotMatch(rightOf(s), /cland task CLI/, '§3.5 Topics: closed entries are Archive');
  await c.input('A');
  s = await c.waitScreen(x => rightOf(x).includes('ARCHIVE · 1') && rightOf(x).includes('cland task CLI'), 'closed topic reachable with A');
  const panel = rightOf(s);
  const order = ['NEEDS YOU · 1', 'Spoke reconnect: flaky', 'OPEN · 4', '● General', '≡ Agents', 'Codex adapter', 'Daemon hello', 'ARCHIVE · 1', 'cland task CLI'].map((w) => panel.indexOf(w));
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

  // :Cland topic close closes the topic in view: §3.5 closed topics move to Archive
  await c.input('<Esc>:Cland topic close<CR>');
  s = await c.waitScreen((x) => statusLine(x).includes('Second one, by command · topic closed') && !/○ Second one, by command/.test(rightOf(x)), 'closed topic hidden from ordinary list');
  await c.input('<Space>t<Space>tA');
  s = await c.waitScreen(x => rightOf(x).includes('ARCHIVE · 2') && rightOf(x).includes('○ Second one, by command'), 'closed topic reachable with A');
  assert.ok(rightOf(s).indexOf('ARCHIVE · 2') < rightOf(s).indexOf('○ Second one, by command'));
  // c on a row in the panel closes that one
  await c.input('<Space>t<Space>t');
  await c.waitScreen((x) => x.includes('TOPICS'), 'the panel, focused');
  await c.input('gg/Pick a free<CR>c');
  await c.waitScreen((x) => rightOf(x).includes('ARCHIVE · 3'), 'the row closed');
  assert.deepEqual((await requestsOf(c, 'topic.close')).map((f) => f.topic), ['topic-8', 'topic-7']);

  // ␣r from a thread clears its wait
  await c.input(':Cland view thread topic-2<CR><Esc><Space>r');
  await c.waitScreen((x) => statusLine(x).includes('Daemon hello · T-12 · topic open'), 'resolved');
  assert.deepEqual((await requestsOf(c, 'topic.resolve')).map((f) => f.topic), ['topic-2']);
});

test('the thread header shows the status, the binding and the warning; a topic event changes it; gI opens the bound item', { skip }, async (t) => {
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

  // gI from the bound topic: its item; gt from the item: back to its topic
  await c.input('<Esc>gI');
  await c.waitScreen((x) => statusLine(x).includes('T-12 · item'), 'the item view of T-12');
  await c.input('gt');
  await c.waitScreen((x) => statusLine(x).includes('Daemon hello · T-12 · topic open'), 'back to the topic');
});

test("the picker's topics kind lists needs you first, with the binding, the warning and the unread count, and filters by title", { skip }, async (t) => {
  const c = await startShell(t, withTopics);
  await c.input('<Esc><Space>p/');
  let s = await c.waitScreen((x) => x.includes('palette ›') && x.includes('TOPICS ·'), 'the picker on topics');
  const first = s.indexOf('● Spoke reconnect: flaky');
  assert.ok(first >= 0 && first < s.indexOf('● General') && s.indexOf('● General') < s.indexOf('○ cland task CLI'), `needs you first:\n${s}`);
  assert.match(s, /● Spoke reconnect: flaky .*needs you · 2 unread/);
  assert.match(s, /◐ Daemon hello .*T-12 · ▲ no coordinator · waiting for agent/);
  await c.input('codex');
  s = await c.waitScreen((x) => /● Codex adapter .*open · 3 unread/.test(x) && !x.includes('Daemon hello'), 'filtered by title');
  await c.input('<CR>');
  await c.waitScreen((x) => topBar(x).includes('│ Codex adapter'), 'the thread opened');
});

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

const leftOf = (text: string): string =>
  text
    .split('\n')
    .map((l) => {
      const i = l.indexOf('│');
      return i < 0 ? '' : l.slice(0, i);
    })
    .join('\n');

const itemRows = (s: string): string[] =>
  leftOf(s)
    .split('\n')
    .map((l) => l.trim().replace(/^[▾▸] /, ''))
    .filter((l) => /^[○●◐◑◆◌◉] T-\d+ /.test(l) || /^(DECIDED|FRONTIER|IN WORK BY SUB-AGENTS|BLOCKED) · \d+$/.test(l));

const idsOf = (rows: string[]): string[] => rows.flatMap(r => r.match(/T-\d+/)?.[0] ?? []);

test('T-80: in work follows explicit status events, including unclaimed review and QA', { skip }, async t => {
  const task = item('T-80', 'task', 'Awaiting review', { status: 'planned', parent: 'T-1' });
  const c = await startShell(t, s => { s.items = [
    item('T-100', 'release', 'Current release', { version: '0.1.0' }),
    item('T-1', 'epic', 'Panels', { parent: 'T-100' }), task,
  ]; });
  await c.input('<Esc><Space>i2');
  await c.lua("vim.api.nvim_win_set_width(require('cland.layout').win.left,60)");
  await c.waitScreen(s => /ITEMS +in work · 1/.test(s) && s.includes('T-80 T-1 › Awaiting review'), 'planned in work');
  for (const status of ['in progress', 'review', 'qa', 'ready', 'done', 'backlog']) {
    await c.control({ emit: { type: 'task', id: task.id, item: { ...task, status, state: status === 'done' ? 'closed' : 'open' } } });
    const active = !['done', 'backlog'].includes(status);
    await c.waitScreen(s => s.includes(`in work · ${active ? 1 : 0}`) && s.includes('T-80 T-1 › Awaiting review') === active, `${status} from a task event`);
  }
});

test('the client agrees with the shared rank fixture and applies the final siblings event', { skip }, async t => {
  const fixture = JSON.parse(await readFile(new URL('../../hub/test/fixtures/rank-order.json', import.meta.url), 'utf8')) as { items: Array<{ id: string; rank?: number }>; order: string[] };
  const rows = fixture.items.map(it => item(it.id, 'task', `Ranked ${it.id}`, { ...it, status: 'planned' }));
  const c = await startShell(t, s => { s.items = rows; });
  await c.input('<Esc><Space>i/unscheduled (<CR>za');
  await c.waitScreen(s => s.includes('Ranked T-11'), 'rank fixture');
  assert.deepEqual(idsOf(itemRows((await c.screen()).join('\n'))), fixture.order);
  const order = ['T-11', 'T-3', 'T-4', 'T-1', 'T-2', 'T-10'];
  await c.control({ emit: { type: 'task', id: 'T-11', item: rows.find(it => it.id === 'T-11'), siblings: order } });
  await c.waitScreen(s => JSON.stringify(idsOf(itemRows(s))) === JSON.stringify(order), 'final sibling order');
});

test('configured levels choose the lowest semver release; all folds closed trees and work stays in scope', { skip }, async t => {
  const c = await startShell(t, s => {
    s.tracker = { levels: ['initiative', 'feature', 'component'] };
    s.items = [
      item('T-1', 'initiative', 'Later', { version: '1.10.0' }),
      item('T-2', 'initiative', 'Stable', { version: '1.2.0' }),
      item('T-3', 'initiative', 'Current beta two', { version: '1.2.0-beta.2+build' }),
      item('T-4', 'initiative', 'Beta ten', { version: '1.2.0-beta.10' }),
      item('T-5', 'initiative', 'Unversioned'),
      item('T-6', 'initiative', 'Archived', { version: '0.1.0', state: 'closed' }),
      item('T-7', 'feature', 'Open feature', { parent: 'T-3' }),
      item('T-8', 'component', 'Closed component', { parent: 'T-7', state: 'closed' }),
      item('T-9', 'task', 'Folded done task', { parent: 'T-8', status: 'done', state: 'closed' }),
      item('T-10', 'task', 'Current work', { parent: 'T-7', status: 'review', rank: -10 }),
      item('T-11', 'task', 'Future work', { parent: 'T-1', status: 'planned' }),
      item('T-12', 'task', 'Archived task', { parent: 'T-6', status: 'done', state: 'closed' }),
      item('T-13', 'task', 'Loose work', { status: 'qa' }),
    ];
  });
  await c.input('<Esc><Space>i');
  await c.lua("vim.api.nvim_win_set_width(require('cland.layout').win.left,65)");
  await c.input('/^ ▸.*T-7<CR>zo');
  let screen = await c.waitScreen(s => s.includes('Current beta two') && s.includes('T-10 T-7 › Current work'), 'current configured release');
  assert.match(topBar(screen), /Current beta two/);
  assert.match(leftOf(screen), /T-3 1\.2\.0-beta\.2\+build Current beta two/);
  assert.doesNotMatch(leftOf(screen), /Closed component|T-5 Unversioned/);
  assert.doesNotMatch(leftOf(screen), /Folded done task|Future work|Archived task/);
  await c.input('6');
  await c.waitScreen(s => s.includes('▸ ● T-8 Closed component'), 'all contains closed component');
  await c.input('/T-8 Closed<CR>za');
  await c.waitScreen(s => s.includes('T-9 Folded done task'), 'closed component unfolds in all');
  await c.input('za');
  await c.waitScreen(s => !s.includes('T-9 Folded done task'), 'closed component folds');
  await c.input('2');
  await c.waitScreen(s => s.includes('in work · 1'), 'work filter redrawn');
  screen = await c.waitScreen(s => idsOf(itemRows(s)).includes('T-10'), 'current work only');
  assert.deepEqual(idsOf(itemRows(screen)), ['T-10']);
  assert.doesNotMatch(leftOf(screen), /unscheduled \(/);
  await c.input('4');
  screen = await c.waitScreen(s => s.includes('done · 1') && s.includes('Folded done task'), 'current done tasks including closed parents');
  assert.deepEqual(idsOf(itemRows(screen)), ['T-9']);
  await c.control({ emit: { type: 'task', id: 'T-3', item: item('T-3', 'initiative', 'Current beta two', { version: '1.2.0-beta.2', state: 'closed' }) } });
  await c.waitScreen(s => topBar(s).includes('Beta ten') && s.includes('done · 0'), 'scope changes on task event');
});

test('the board reads all seven statuses, scopes open parents, and filters its header by parent', { skip }, async t => {
  const statuses = ['backlog', 'planned', 'in progress', 'review', 'qa', 'ready', 'done'];
  const tasks = statuses.map((status, i) => item(`T-${i + 10}`, 'task', `Card ${status}`, { parent: 'T-2', status, state: status === 'done' ? 'closed' : 'open' }));
  const other = item('T-30', 'task', 'Other parent card', { parent: 'T-3', status: 'planned' });
  const c = await startShell(t, s => { s.items = [
    item('T-1', 'release', 'Current release', { version: '0.1.0' }),
    item('T-2', 'epic', 'Panels', { parent: 'T-1' }),
    item('T-3', 'epic', 'Tracker', { parent: 'T-1' }),
    item('T-4', 'epic', 'Closed epic', { parent: 'T-1', state: 'closed' }),
    item('T-5', 'release', 'Future release', { version: '0.2.0' }),
    ...tasks, other,
    item('T-31', 'task', 'Closed epic card', { parent: 'T-4', status: 'done', state: 'closed' }),
    item('T-32', 'task', 'Future card', { parent: 'T-5', status: 'planned' }),
    item('T-33', 'task', 'Unscheduled card', { status: 'review' }),
  ]; });
  await c.input('<Esc><Space>s<Space>b');
  const screen = await c.waitScreen(s => s.includes('READY') && s.includes('Card ready'), 'seven status columns');
  assert.deepEqual(boardOf(screen).header, statuses.map(s => s.toUpperCase()));
  assert.deepEqual(boardOf(screen).ids, [['T-10'], ['T-11', 'T-30'], ['T-12'], ['T-13'], ['T-14'], ['T-15'], ['T-16']]);
  assert.match(screen, /parents: all.*T-2 Panels.*T-3 Tracker/);
  await c.input('p');
  await c.waitScreen(s => !s.includes('T-30') && s.includes('T-13'), 'Panels parent filter');
  await c.input('p');
  await c.waitScreen(s => s.includes('T-30') && !s.includes('T-13'), 'Tracker parent filter');
  await c.control({ emit: { type: 'task', id: 'T-3', item: item('T-3', 'epic', 'Tracker', { parent: 'T-1', state: 'closed' }) } });
  await c.waitScreen(s => !s.includes('T-30') && s.includes('T-13'), 'closed parent leaves and invalid filter resets');
  for (const status of statuses.slice(1)) {
    const moving = { ...tasks[0], status, state: status === 'done' ? 'closed' : 'open' };
    await c.control({ emit: { type: 'task', id: moving.id, item: moving } });
    await c.waitScreen(s => boardOf(s).ids[statuses.indexOf(status)]?.includes('T-10') === true, `${status} column from task event`);
  }
  await c.control({ emit: { type: 'task', id: 'T-10', item: { ...tasks[0], status: 'done', state: 'closed' }, siblings: ['T-16', 'T-10', 'T-11', 'T-12', 'T-13', 'T-14', 'T-15'] } });
  await c.waitScreen(s => JSON.stringify(boardOf(s).ids[6]) === JSON.stringify(['T-16', 'T-10']), 'final sibling order in the board');
  assert.equal(await c.lua('return #require("cland.actions").audit()'), 0);
});

test('the items panel: vertical sections, hub glyphs, right-aligned claims and counted asks; filters 1–6 and f; map grouping', { skip }, async (t) => {
  const c = await startShell(t, withItems);
  await c.input('<Esc><Space>i');
  await c.lua("vim.api.nvim_win_set_width(require('cland.layout').win.left,70)");
  // The header can render before the resized rows and inbox badges do.
  let s = await c.waitScreen(x => x.includes('board · 5 in work · 1 done') && x.includes('backlog (1)')
    && /^ ◐ T-2 T-1 › Items panel +impl-2 \?2$/m.test(leftOf(x)), 'vertical board with claim and both asks');
  let panel = leftOf(s);
  assert.match(panel, /epic all/);
  assert.match(panel, /^ T-1 Workbench shell +1\/7\s*$/m, 'scope keeps child progress');
  assert.match(panel, /^ ◐ T-2 T-1 › Items panel +impl-2 \?2$/m, 'claim and two counted open asks, over the hub status');
  assert.match(panel, /^ ◉ T-3 T-1 › Board view +✗ review$/m, 'failed verdict leaves the hub review glyph');
  assert.doesNotMatch(panel, /T-4 T-1 › Item view/, 'done starts hidden');
  assert.match(panel, /^ ◐ T-12 T-1 › Hub daemon and spoke hello +impl-1$/m, 'claim remains right-aligned');
  assert.deepEqual(idsOf(itemRows(s)), ['T-2','T-12','T-3','T-10','T-11']);
  await c.input('/backlog (<CR>za');
  await c.waitScreen(x=>x.includes('T-13 T-1 › Codex adapter'),'backlog unfolds');
  assert.doesNotMatch(leftOf((await c.screen()).join('\n')), /unscheduled \(|T-5 Slice 2 map/);

  const rowsOf = async (key: string, header: string) => {
    await c.input(key);
    const x = await c.waitScreen((y) => y.includes(` ITEMS`) && new RegExp(`${header} │`).test(y.split('\n')[1] ?? ''), `the ${header} filter`);
    return itemRows(x);
  };
  // 2: in work reads the explicit task status
  assert.deepEqual(idsOf(await rowsOf('2', 'in work · 5')), ['T-2', 'T-12', 'T-3', 'T-10', 'T-11']);
  // 3: needs you
  assert.deepEqual(idsOf(await rowsOf('3', 'needs you · 2')), ['T-2', 'T-3']);
  // 4: done
  assert.deepEqual(idsOf(await rowsOf('4', 'done · 1')), ['T-4']);
  // 5: the map, grouped under headers, ordered by id
  assert.deepEqual(
    (await rowsOf('5', 'map · 1 map')).map((r) => r.replace(/\s+/g, ' ')),
    ['○ T-5 Slice 2 map 1/4', 'DECIDED · 1', '● T-6 Which store', 'FRONTIER · 1', '○ T-7 Transport', 'IN WORK BY SUB-AGENTS · 1', '◑ T-9 CRDT spike sub-1', 'BLOCKED · 1', '◌ T-8 Auth scheme'],
  );
  // f reaches explicit all, then board; F returns through all to map.
  await c.input('f');
  await c.waitScreen((y) => / ITEMS +all · 13 items │/.test(y), 'f: explicit all');
  await c.input('f');
  await c.waitScreen((y) => / ITEMS +board · 5 in work · 1 done │/.test(y), 'f: board again');
  await c.input('F');
  await c.waitScreen((y) => / ITEMS +all · 13 items │/.test(y), 'F: all');
  await c.input('F');
  await c.waitScreen((y) => / ITEMS +map · 1 map │/.test(y), 'F: map');
  // Enter on a row opens the item view
  await c.input('1');
  await c.waitScreen((y) => / ITEMS +board · 5 in work · 1 done │/.test(y), 'board');
  await c.input('gg/T-3 T-1 › Board<CR><CR>');
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
  await onSessionRow(c, 'coord-1');
  let panel = await c.waitScreen((s) => s.includes('12.3k tok'), 'selected token total');
  assert.doesNotMatch(panel, /12 tok|\$0\.25/);
  await c.input('gg/^ . impl-1<CR>');
  panel = await c.waitScreen((s) => s.includes('$1.80') && !s.includes('12.3k tok'), 'selected cost total');
  assert.doesNotMatch(panel, /\$0\.25/);
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
  assert.match(s, /^ ◉ T-3 · open · review · task +$/m, 'the title line: id and state');
  // the fields column, right of the body, row by row
  assert.match(s, /^ Board view +│ state {6}◉ open · review +$/m);
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

function boardOf(screen: string): { header: string[]; ids: string[][]; text: string[][] } {
  const rows = screen.split('\n');
  const at = rows.findIndex((r) => r.includes('BACKLOG'));
  const cols = (r: string) => r.split('│').map((x) => x.trim());
  const ids: string[][] = [[], [], [], [], [], [], []];
  const text: string[][] = [[], [], [], [], [], [], []];
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

test('the board: explicit task statuses and badges; ↵ opens a card', { skip }, async (t) => {
  const c = await startShell(t, withItems);
  await c.input('<Esc><Space>s');
  await c.waitScreen((x) => !x.includes('SESSIONS'), 'no right panel');
  await c.input('<Space>b');
  const s = await c.waitScreen((x) => x.includes('BACKLOG') && statusLine(x).includes('Board'), 'the board');
  const { header, ids, text } = boardOf(s);
  assert.deepEqual(header, ['BACKLOG', 'PLANNED', 'IN PROGRESS', 'REVIEW', 'QA', 'READY', 'DONE']);
  assert.deepEqual(text.map((col) => col[0]?.split(' ')[0]), ['1', '1', '2', '1', '1', '0', '1'], 'the counts under the names');
  assert.deepEqual(ids, [['T-13'], ['T-11'], ['T-2', 'T-12'], ['T-3'], ['T-10'], [], ['T-4']]);
  // the marks: the ask, the claim, the assignee, a blocker, the verdicts
  assert.ok(text[2]?.includes('T-2 ? ask') && text[2]?.includes('impl-2') && text[2]?.includes('impl-1'), text[2]?.join(' | '));
  assert.ok(text[1]?.includes('for human'), text[1]?.join(' | '));
  assert.ok(text[3]?.includes('✗ review'), text[3]?.join(' | '));
  assert.ok(text[4]?.includes('✓ review'), text[4]?.join(' | '));
  assert.ok(text[6]?.includes('✓ review') && text[6]?.includes('✓ qa'), text[6]?.join(' | '));
  // the hub's status moves a card despite a retained Implementer claim
  await c.control({ emit: { type: 'task', id: 'T-12', item: { ...(baseScenario('').items?.[0] ?? {}), parent: 'T-1', status: 'review', labels: [], verdicts: [] } } });
  await c.waitScreen((x) => JSON.stringify(boardOf(x).ids) === JSON.stringify([['T-13'], ['T-11'], ['T-2'], ['T-3', 'T-12'], ['T-10'], [], ['T-4']]), 'T-12 in the review column under T-3');
  // ↵ on a card opens its item view
  await c.input('gg/T-10<CR><CR>');
  await c.waitScreen((x) => statusLine(x).includes('T-10 · item'), 'the item view of T-10');
});

test('a delayed items snapshot keeps a newer claim, new item and removed file', { skip }, async (t) => {
  const c = await startShell(t, withItems);
  await c.input('<Esc><Space>i');
  await c.waitScreen(x=>x.includes('backlog (1)'),'board initial folds');
  await c.input('6zR');
  await c.lua("vim.api.nvim_win_set_width(require('cland.layout').win.left,70)");
  await c.waitScreen(x => x.includes('T-7 Transport') && x.includes('T-13 Codex adapter'), 'all-items tree');
  await c.control({ set: { holdSnapshots: ['task.list'] } });
  await c.lua("require('cland').refresh()");
  // The control socket's barrier proves the old answer was captured before the events.
  await c.control({ waitSnapshot: 'task.list' });
  await c.control({ emits: [
    { type: 'task', id: 'T-7', item: item('T-7', 'question', 'Transport', { parent: 'T-5', claim: claimBy('impl-2') }) },
    { type: 'task', id: 'T-14', item: item('T-14', 'task', 'New item') },
    { type: 'task', id: 'T-13', item: null },
  ] });
  const newer = (x: string) => /^ +◐ T-7 Transport +impl-2\s*$/m.test(leftOf(x)) && x.includes('T-14 New item') && !leftOf(x).includes('T-13');
  await c.waitScreen(newer, 'the newer task events');
  await c.control({ releaseSnapshots: ['task.list'] });
  await c.lua("assert(vim.wait(5000, function() return next(require('cland').client.pending) == nil end))");
  assert.ok(newer((await c.screen()).join('\n')), 'the late list must keep the newer board rows');
});

test('events already reflected in a delayed items snapshot are idempotent; a failed snapshot keeps live items', { skip }, async (t) => {
  const c = await startShell(t, withItems);
  await c.input('<Esc><Space>i');
  await c.waitScreen(x=>x.includes('backlog (1)'),'board initial folds');
  await c.input('6zR');
  await c.lua("vim.api.nvim_win_set_width(require('cland.layout').win.left,70)");
  await c.waitScreen(x => x.includes('T-7 Transport') && x.includes('T-13 Codex adapter'), 'all-items tree');
  const changed = item('T-7', 'question', 'Transport', { parent: 'T-5', claim: claimBy('impl-2') });
  const added = item('T-14', 'task', 'New item');
  const scenario = baseScenario(''); withItems(scenario);
  const reflected = (scenario.items ?? []).filter((it) => it.id !== 'T-13' && it.id !== 'T-7').concat(changed, added);
  for (const error of [undefined, 'snapshot failed']) {
    await c.control({ set: { holdSnapshots: ['task.list'], items: reflected } });
    await c.lua("require('cland').refresh()");
    await c.control({ waitSnapshot: 'task.list' });
    await c.control({ emits: [
      { type: 'task', id: 'T-7', item: changed }, { type: 'task', id: 'T-14', item: added }, { type: 'task', id: 'T-13', item: null },
    ] });
    await c.waitScreen((x) => x.includes('T-14 New item') && !leftOf(x).includes('T-13'), 'the live updates');
    await c.control({ releaseSnapshots: ['task.list'], snapshotError: error });
    await c.lua("assert(vim.wait(5000, function() return next(require('cland').client.pending) == nil end))");
    const screen = leftOf((await c.screen()).join('\n'));
    assert.equal(screen.match(/T-14 New item/g)?.length, 1);
    assert.equal(screen.match(/T-7 Transport/g)?.length, 1);
    assert.ok(!screen.includes('T-13'));
    assert.equal(await c.lua("return vim.tbl_count(require('cland').client.snapshots)"), 0, 'completed requests release their journals');
  }
});

test('failed-launch cleanup removes its identity live and during delayed session snapshots without removing a new name owner', { skip }, async t => {
  const c = await startShell(t);
  await c.control({ set: { holdSnapshots: ['session.list'] } });
  await c.lua("require('cland').refresh_sessions()");
  await c.control({ waitSnapshot: 'session.list' });
  await c.control({ emit: { type: 'session.cleanup', sessionId: 'impl-1-id', state: 'pending stop' } });
  await c.lua("assert(vim.wait(5000, function() for _, p in ipairs(require('cland.state').S.processes) do if p.sessionId == 'impl-1-id' then return false end end return true end))");
  const replacement = { ...proc('impl-1', 'implementer', 'idle'), sessionId: 'replacement-id' };
  await c.control({ emits: [
    { type: 'session.process', process: replacement },
    { type: 'session.cleanup', sessionId: 'impl-1-id', state: 'settled' },
  ] });
  await c.control({ releaseSnapshots: ['session.list'], set: { holdSnapshots: [] } });
  await c.lua("assert(vim.wait(5000, function() return next(require('cland').client.pending) == nil end))");
  const identities = await c.lua<string[]>("local ids = {}; for _, p in ipairs(require('cland.state').S.processes) do ids[#ids+1] = p.sessionId end; return ids");
  assert.deepEqual(identities.sort(), ['coord-1-id', 'replacement-id']);
});

test('disconnect releases snapshot journals even when another refresh is queued', { skip }, async (t) => {
  const c = await startShell(t, withItems);
  await c.control({ set: { holdSnapshots: ['task.list', 'session.list'] } });
  await c.lua("require('cland').refresh(); require('cland').refresh()");
  await c.control({ waitSnapshot: 'task.list' });
  await c.control({ waitSnapshot: 'session.list' });
  await c.reconnect((s) => { s.items = [item('T-14', 'task', 'After reconnect')]; });
  await c.input('<Esc><Space>i');
  // Reconnecting precedes the item snapshot; an early search cannot be replayed when its heading arrives.
  await c.waitScreen((x) => x.includes('unscheduled (1)'), 'unscheduled heading after reconnect');
  await c.input('/unscheduled (<CR>za');
  await c.waitScreen((x) => x.includes('T-14 After reconnect'), 'fresh items after reconnect');
  assert.equal(await c.lua("return vim.tbl_count(require('cland').client.snapshots)"), 0, 'no journal belongs to the dead connection');
  assert.equal(await c.lua("return vim.tbl_count(require('cland').client.pending)"), 0, 'queued refreshes never request on the dead connection');
});

test('topic replay after reconnect preserves fresh metadata and counts only messages after the snapshot watermark', { skip }, async (t) => {
  const cached = topic('topic-live', 'Cached title', 'open', { unread: 5, lastMessageAt: ts(1) });
  const c = await startShell(t, (s) => { s.topics = [topic('general', 'General', 'open'), cached]; });
  await c.reconnect((s) => {
    s.topics = [topic('general', 'General', 'open'), { ...cached, title: 'Fresh title', status: 'waiting for human', unread: 10, lastMessageAt: ts(5) }];
    s.holdSnapshots = ['topic.list'];
  });
  await c.control({ waitSnapshot: 'topic.list' });
  const message = (id: string, at: string) => ({ type: 'message', topic: { id: cached.id, title: 'Fresh title' }, message: { id, from: 'impl-1', fromKind: 'agent', text: 'Count once', ts: at } });
  await c.control({ emits: [message('already-counted', ts(4)), message('new-message', ts(6)), message('new-message', ts(6))] });
  await c.control({ releaseSnapshots: ['topic.list'] });
  await c.lua("assert(vim.wait(5000, function() return next(require('cland').client.pending) == nil end))");
  const data = await c.lua<{ topics: Array<{ id: string; title: string; status: string; unread: number }> }>("return require('cland.qa').state()");
  const live = data.topics.find((x) => x.id === cached.id);
  assert.equal(live?.title, 'Fresh title');
  assert.equal(live?.status, 'waiting for human');
  assert.equal(live?.unread, 11, 'fresh count plus one unique message beyond its watermark');
});

test('an unanswered items snapshot records only relevant frames and restarts at its deadline', { skip }, async (t) => {
  const c = await startShell(t, withItems);
  await c.control({ set: { holdSnapshots: ['task.list'] } });
  await c.lua("require('cland.hub').SNAPSHOT_TIMEOUT_MS = 100; require('cland').refresh()");
  await c.control({ waitSnapshot: 'task.list' });
  await c.control({ emits: Array.from({ length: 100 }, () => ({ type: 'session.usage', sessionId: 'unrelated', usage: {} })) });
  await c.lua("require('cland').client:request({ type = 'role.list' }, function() vim.g.unrelated_seen = true end); assert(vim.wait(5000, function() return vim.g.unrelated_seen end))");
  assert.equal(await c.lua("local count = 0; for journal in pairs(require('cland').client.snapshots) do count = count + #(journal.events or journal) end; return count"), 0, 'unrelated frames are never recorded');
  await c.control({ waitSnapshot: 'task.list', snapshotCount: 2 });
  await c.control({ releaseSnapshots: ['task.list'], set: { holdSnapshots: [] } });
  await c.lua("assert(vim.wait(5000, function() return next(require('cland').client.pending) == nil end))");
  assert.equal(await c.lua("return vim.tbl_count(require('cland').client.snapshots)"), 0);
});

test('an items snapshot restarts when its recording reaches the event cap', { skip }, async (t) => {
  const c = await startShell(t, withItems);
  await c.control({ set: { holdSnapshots: ['task.list'] } });
  await c.lua("require('cland.hub').SNAPSHOT_MAX_EVENTS = 2; require('cland').refresh()");
  await c.control({ waitSnapshot: 'task.list' });
  const latest = item('T-14', 'task', 'New item 3');
  await c.control({ set: { items: [latest] }, emits: [1, 2, 3].map((n) => ({ type: 'task', id: 'T-14', item: item('T-14', 'task', `New item ${n}`) })) });
  await c.control({ waitSnapshot: 'task.list', snapshotCount: 2 });
  await c.control({ releaseSnapshots: ['task.list'], set: { holdSnapshots: [] } });
  await c.lua("assert(vim.wait(5000, function() return next(require('cland').client.pending) == nil end))");
  await c.input('<Esc><Space>i/unscheduled (<CR>za');
  await c.waitScreen((s) => s.includes('T-14 New item 3') && !leftOf(s).includes('T-13'), 'the replacement snapshot; the cancelled old reply is ignored');
  assert.equal(await c.lua("return vim.tbl_count(require('cland').client.snapshots)"), 0);
});

test('a single oversized relevant frame restarts a snapshot without retaining its bytes', { skip }, async (t) => {
  const c = await startShell(t, withItems);
  await c.control({ set: { holdSnapshots: ['task.list'] } });
  await c.lua("require('cland.hub').SNAPSHOT_MAX_BYTES = 512; require('cland').refresh()");
  await c.control({ waitSnapshot: 'task.list' });
  const latest = item('T-14', 'task', 'Large frame', { body: 'x'.repeat(1024) });
  await c.control({ set: { items: [latest] }, emit: { type: 'task', id: latest.id, item: latest } });
  await c.control({ waitSnapshot: 'task.list', snapshotCount: 2 });
  assert.equal(await c.lua("local bytes = 0; for journal in pairs(require('cland').client.snapshots) do bytes = bytes + journal.bytes end; return bytes"), 0);
  await c.control({ releaseSnapshots: ['task.list'], set: { holdSnapshots: [] } });
  await c.lua("assert(vim.wait(5000, function() return next(require('cland').client.pending) == nil end))");
  await c.input('<Esc><Space>i/unscheduled (<CR>za');
  await c.waitScreen((s) => s.includes('T-14 Large frame'), 'a fresh snapshot after the byte cap');
});

test('messages sharing the snapshot watermark use a fresh unread count', { skip }, async (t) => {
  const original = topic('topic-live', 'Live title', 'open', { unread: 10, lastMessageAt: ts(5) });
  const c = await startShell(t, (s) => { s.topics = [topic('general', 'General', 'open'), original]; });
  await c.control({ set: { holdSnapshots: ['topic.list'] } });
  await c.lua("require('cland').refresh()");
  await c.control({ waitSnapshot: 'topic.list' });
  // One newer message has the same clock millisecond as the snapshot's last message. Only the next
  // authoritative count tells whether this id was already represented in the first snapshot.
  await c.control({ set: { holdSnapshots: [], topics: [topic('general', 'General', 'open'), { ...original, unread: 11 }] }, emit: { type: 'message', topic: { id: original.id, title: original.title }, message: { id: 'equal-time', from: 'impl-1', fromKind: 'agent', ts: ts(5), text: 'Same millisecond' } } });
  await c.control({ releaseSnapshots: ['topic.list'] });
  await c.lua("assert(vim.wait(5000, function() return next(require('cland').client.pending) == nil end))");
  const data = await c.lua<{ topics: Array<{ id: string; unread: number }> }>("return require('cland.qa').state()");
  assert.equal(data.topics.find((x) => x.id === original.id)?.unread, 11);
});

test('overlapping delayed panel snapshots keep topic, session, artifact and inbox events', { skip }, async (t) => {
  const types = ['topic.list', 'session.list', 'hub.status', 'artifact.list', 'inbox.list'];
  const oldTopic = topic('topic-live', 'Live topic', 'open');
  const artifact = { id: 'A-1', kind: 'note', title: 'Live artifact', creator: 'coord-1', status: 'shared', topic: 'general', time: ts(1), path: '/unused.md' };
  const c = await startShell(t, (s) => {
    s.topics = [topic('general', 'General', 'open'), topic('agents', 'Agents', 'open'), oldTopic];
    s.artifacts = [artifact];
    s.coordinator = 'coord-1';
    s.inbox = { asks: [{ id: 'a-2', question: 'Old ask', topic: { id: 'general', title: 'General' }, from: 'coord-1', options: ['Yes'], free: true, ts: ts(1) }] };
    s.holdSnapshots = types;
  }, {}, false); // This case deliberately acts on live events before its initial snapshots land.
  for (const type of types) await c.control({ waitSnapshot: type });
  const latestTopic = { ...oldTopic, title: 'Updated topic', status: 'waiting for human' };
  await c.control({ emits: [
    { type: 'topic', topic: latestTopic },
    { type: 'session.process', process: proc('coord-1', 'coordinator', 'busy') },
    { type: 'session.state', session: 'coord-1', state: 'idle' },
    { type: 'session.role', session: 'coord-1', role: 'implementer' },
    { type: 'session.usage', sessionId: 'coord-1-id', usage: { total: { cost: 2.40 } } },
    { type: 'presence', sessions: [{ name: 'external', role: 'qa', state: 'idle' }] },
    { type: 'role.vacant', role: 'coordinator' },
    { type: 'artifact', artifact: { ...artifact, status: 'archived' } },
    { type: 'inbox', inbox: { asks: [], approvals: [], waiting: [], needsYou: 0 } },
  ] });
  await c.waitScreen(x => x.includes('coord-1 [Implementer]'), 'live session row');
  await onSessionRow(c, 'coord-1');
  await c.waitScreen((x) => x.includes('coord-1 [Implementer]') && x.includes('$2.40'), 'the live session');
  // This second topics snapshot already contains the status event. Its journal must be independent
  // from the first request's; the stub releases the newer answer before the older one.
  await c.control({ set: {
    topics: [topic('general', 'General', 'open'), topic('agents', 'Agents', 'open'), latestTopic],
    processes: [{ ...proc('coord-1', 'implementer', 'idle'), usage: { total: { cost: 2.40 } } }],
    presence: [{ name: 'external', role: 'qa', state: 'idle' }], coordinator: null,
    inbox: { asks: [], approvals: [], waiting: [] },
    artifacts: [{ ...artifact, status: 'archived' }],
  } });
  await c.lua("require('cland').refresh()");
  await c.control({ waitSnapshot: 'topic.list', snapshotCount: 2 });
  await c.control({ emit: { type: 'message', topic: { id: 'topic-live', title: latestTopic.title }, message: { id: 'm-live', from: 'impl-1', fromKind: 'agent', text: 'Unread once', ts: ts(3) } } });
  await c.lua("assert(vim.wait(5000, function() local t = require('cland.state').topic('topic-live'); return t and t.unread == 1 end))");
  await c.control({ releaseSnapshots: types, set: { holdSnapshots: [] } });
  await c.lua("assert(vim.wait(5000, function() return next(require('cland').client.pending) == nil end))");
  await c.input('<Esc><Space>t');
  const topics = await c.waitScreen((x) => x.includes('TOPICS'), 'the topics panel');
  assert.ok(topics.includes('Updated topic'), 'the late list keeps the topic update');
  const data = await c.lua<{ topics: Array<{ id: string; unread: number; status: string }>; sessions: Array<{ name: string; role: string; state: string }>; asks: unknown[]; needs_you: number; coordinator?: string }>("return require('cland.qa').state()");
  assert.equal(data.topics.find((x) => x.id === 'topic-live')?.unread, 1, 'message-derived unread count is preserved, never incremented twice');
  assert.equal(data.topics.find((x) => x.id === 'topic-live')?.status, 'waiting for human');
  assert.equal(data.sessions.find((x) => x.name === 'coord-1')?.role, 'implementer');
  assert.equal(data.sessions.find((x) => x.name === 'coord-1')?.state, 'idle');
  assert.ok(data.sessions.some((x) => x.name === 'external'));
  assert.equal(data.coordinator, undefined);
  assert.deepEqual(data.asks, []);
  assert.equal(data.needs_you, 0);
  await c.input(':Cland view artifacts general<CR>');
  const folded = await c.waitScreen((x) => x.includes('ARTIFACTS'), 'artifact list');
  assert.ok(!folded.includes('Live artifact'), 'archived artifacts stay folded until explicitly revealed');
  await c.input('A');
  const artifacts = await c.waitScreen((x) => x.includes('Live artifact'), 'archived artifact');
  assert.ok(artifacts.includes('archived'), 'the late artifact list keeps the event metadata');
  assert.equal(await c.lua("return vim.tbl_count(require('cland').client.snapshots)"), 0);
});

test('the vertical board follows task events: a claim, a new backlog row, a removed file', { skip }, async (t) => {
  const c = await startShell(t, withItems);
  await c.input('<Esc><Space>i');
  await c.waitScreen(x=>x.includes('backlog (1)'),'board');
  await c.input('/backlog (<CR>za');
  await c.waitScreen(x=>x.includes('T-13 T-1 › Codex adapter'),'backlog visible');
  await c.lua("vim.api.nvim_win_set_width(require('cland.layout').win.left,70)");
  await c.waitScreen((x) => x.includes('ITEMS') && x.includes('T-13 T-1 › Codex adapter'), 'the items panel');
  const scenario = baseScenario(''); withItems(scenario);
  const claimed = item('T-13', 'task', 'Codex adapter', { parent: 'T-1', status: 'in progress', claim: claimBy('impl-2') });
  const claimedItems = scenario.items!.map(it => it.id === claimed.id ? claimed : it);
  // The hub projects placements from the current tracker, so its snapshot source must match each event.
  await c.control({ set: { items: claimedItems }, emit: { type: 'task', id: claimed.id, item: claimed } });
  await c.waitScreen((x) => /^ ◐ T-13 T-1 › Codex adapter +impl-2\s*$/m.test(leftOf(x)), 'T-13 claimed');
  const added = item('T-14', 'task', 'Born by hand', { parent: 'T-1' });
  const addedItems = claimedItems.concat(added);
  await c.control({ set: { items: addedItems }, emit: { type: 'task', id: added.id, item: added } });
  await c.waitScreen((x) => /^ ○ T-14 T-1 › Born by hand +$/m.test(leftOf(x)) && x.includes('backlog (1)'), 'T-14 in the parent backlog');
  const rows = idsOf(itemRows(await c.screen().then((l) => l.join('\n'))));
  assert.deepEqual(rows.slice(0, 7), ['T-2','T-12','T-13','T-3','T-10','T-11','T-14'], 'new child joins its parent backlog, ordered by rank then id');
  await c.control({ set: { items: addedItems.filter(it => it.id !== claimed.id) }, emit: { type: 'task', id: claimed.id, item: null } });
  await c.waitScreen((x) => !leftOf(x).includes('T-13') && / ITEMS +board · 5 in work · 1 done │/.test(x) && x.includes('backlog (1)'), 'T-13 gone');

});

test("the picker's items kind searches ids, titles and claims; Enter opens the item view", { skip }, async (t) => {
  const c = await startShell(t, withItems);
  await c.input('<Esc><Space>p#');
  let s = await c.waitScreen((x) => x.includes('ITEMS ·'), 'the items kind');
  assert.match(s, /◆ T-2 Items panel {2}impl-2 .*in progress · claim impl-2/);
  assert.match(s, /○ T-13 Codex adapter .*backlog/);
  await c.input('impl-1');
  s = await c.waitScreen((x) => /◐ T-12 Hub daemon/.test(x) && !/T-2 Items panel/.test(x), 'by claim');
  await c.input('<C-u>#Board view');
  s = await c.waitScreen((x) => /◆ T-3 Board view/.test(x) && !/T-12 Hub daemon/.test(x), 'by title');
  await c.input('<C-u>#T-11');
  await c.waitScreen((x) => /○ T-11 For the human/.test(x.split('\n').find((l) => /[○●◐◑◆◌] T-\d/.test(l)) ?? ''), 'by id, T-11 first');
  await c.input('<CR>');
  await c.waitScreen((x) => statusLine(x).includes('T-11 · item'), 'the item view of T-11');
});

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

test('the Agents log (␣L, :Cland view log) lists messages with sender [Role] → addressee and notices with kind glyphs, and follows message events', { skip }, async (t) => {
  const c = await startShell(t, withAgentsLog);
  // ␣a opens the artifacts kind of the picker; Escape returns to General.
  await c.input('<Esc><Space>a');
  await c.waitScreen((x) => x.includes('palette ›') && x.includes('artifacts'), 'the artifacts picker');
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

async function openInbox(c: Shell): Promise<string> {
  await c.input('<Esc><Space>n');
  return c.waitScreen((x) => x.includes('INBOX') && rightOf(x).includes('ASKS AND APPROVALS') && rightOf(x).includes('? T-12'), 'the inbox panel and its ask row');
}

test('the inbox puts asks and approvals first, messages next and events outside the inbox; the chip is hub-owned', { skip }, async (t) => {
  const c = await startShell(t, withInbox);
  const s = await openInbox(c);
  const panel = rightOf(s);
  const order = ['ASKS AND APPROVALS', '▲ impl-1', '? T-12', 'MESSAGES TO YOU'].map(w => panel.indexOf(w));
  assert.ok(order.every(at => at >= 0), panel);
  assert.deepEqual([...order].sort((a,b) => a-b), order);
  assert.match(topBar(s), /▲ needs you {2}3 /);
  assert.doesNotMatch(panel, /1  the name recorded/);
});

test('2 on an ask row answers with option 2: topic.answer goes out, the row leaves and the count drops; d on an ask does nothing', { skip }, async (t) => {
  const c = await startShell(t, withInbox);
  await openInbox(c);
  // d on an ask: nothing is dismissed, a hint says why
  await c.input('gg/T-12<CR>d');
  let s = await c.waitScreen((x) => statusLine(x).includes('answer this ask: 1-9 chooses an option, i or r gives a free answer'), 'the protected ask answer hint');
  assert.match(rightOf(s), /\? T-12/);
  assert.deepEqual(await requestsOf(c, 'inbox.dismiss'), []);
  assert.deepEqual(await requestsOf(c, 'inbox.decline'), []);
  assert.deepEqual(await requestsOf(c, 'inbox.read'), []);
  await c.input('2');
  s = await c.waitScreen((x) => !rightOf(x).includes('Which should win?') && topBar(x).includes('needs you  2 '), 'the ask answered');
  assert.deepEqual((await requestsOf(c, 'topic.answer')).map((f) => [f.ask, f.option, f.text]), [['a1', 2, undefined]]);
  assert.doesNotMatch(rightOf(s), /Which should win/);
  assert.match(rightOf(s), /APPROVALS/);
  assert.equal(await c.mode(), 'n', 'answering never leaves the inbox');
});

test('i on an ask opens its topic with the composer armed: Enter sends the text as the free answer', { skip }, async (t) => {
  const c = await startShell(t, withInbox);
  await openInbox(c);
  await c.input('gg/T-12<CR>i');
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

test('the inbox has no notification rows or dismissal keys', { skip }, async t => {
  const c = await startShell(t, withInbox);
  await openInbox(c);
  const before = await c.lua('return vim.api.nvim_buf_get_lines(0,0,-1,false)');
  await c.input('D');
  assert.deepEqual(await c.lua('return vim.api.nvim_buf_get_lines(0,0,-1,false)'), before);
  assert.doesNotMatch((before as string[]).join('\n'), /NOTIFICATIONS|D dismiss|earlier.*Agents log/);
  assert.deepEqual(await requestsOf(c, 'inbox.dismiss'), []);
  assert.deepEqual(await requestsOf(c, 'inbox.dismiss_all'), []);
});

test('the ask card in the thread: the question, numbered options and the free-answer hint; 2 on it answers, and the answer shows beneath', { skip }, async (t) => {
  const c = await startShell(t, withInbox);
  await c.input('<Esc>:Cland view thread topic-1<CR>');
  let s = await c.waitScreen((x) => x.includes('┃ 2  the harness session id'), 'the card');
  const card = [`coord-1 [Coordinator] → you  ${clockOf(ts(1))}`, '┃ Which should win?', '┃ 1  the name recorded by the spoke', '┃ 2  the harness session id', '┃ 3  ask me later', '┃ 1-9 answers · free answer: i'].map((w) => s.indexOf(w));
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
  const you = s.indexOf(' you → coord-1  ', at);
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
  await c.input('gg/T-12<CR>');
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

test('a delayed topic history keeps an ask card answered by a newer event', { skip }, async (t) => {
  const c = await startShell(t, withInbox);
  await c.control({ set: { holdSnapshots: ['topic.history'] } });
  await c.input('<Esc>:Cland view thread topic-1<CR>');
  await c.control({ waitSnapshot: 'topic.history' });
  await c.control({ emit: { type: 'ask', topic: 'topic-1', ask: 'a1', card: { question: 'Which should win?', options: ASK_OPTIONS, free: true, state: 'answered', option: 3, answer: 'ans-1' } } });
  // A read request after the event is a client-side processing barrier even before history adds the card.
  await c.lua("require('cland').client:request({ type = 'role.list' }, function() vim.g.ask_event_seen = true end); assert(vim.wait(5000, function() return vim.g.ask_event_seen end))");
  await c.control({ releaseSnapshots: ['topic.history'] });
  await c.lua("assert(vim.wait(5000, function() return next(require('cland').client.pending) == nil end))");
  const screen = (await c.screen()).join('\n');
  assert.ok(screen.includes('ask · ✓ answered'), 'the old history must keep the newer answered card');
  assert.ok(!screen.includes('ask · ▲ waiting for you'));
});

test('the inbox full width (␣N) shows the same sections and acts the same', { skip }, async (t) => {
  const c = await startShell(t, withInbox);
  await c.input('<Esc><Space>N');
  let s = await c.waitScreen((x) => statusLine(x).includes('Inbox · full width') && centreOf(x).includes('MESSAGES TO YOU'), 'the inbox full width');
  const centre = centreOf(s);
  const order = ['ASKS AND APPROVALS', '▲ impl-1', '? T-12', 'MESSAGES TO YOU'].map((w) => centre.indexOf(w));
  assert.ok(order.every((at) => at >= 0), centre);
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(s, /INBOX · FULL WIDTH/);
  await c.input('gg/T-12<CR>3');
  s = await c.waitScreen((x) => !centreOf(x).includes('Which should win') && centreOf(x).includes('APPROVALS'), 'answered with 3');
  assert.deepEqual((await requestsOf(c, 'topic.answer')).map((f) => [f.ask, f.option]), [['a1', 3]]);
  // an inbox event replaces the rows
  await c.control({ emit: { type: 'inbox', inbox: { asks: [], approvals: [], waiting: [], needsYou: 0 } } });
  s = await c.waitScreen((x) => centreOf(x).includes('✓ nothing needs you') && topBar(x).includes('✓ needs you 0'), 'an empty inbox');
});

test('visibility overrides drive thread folds, palette dimming and session counts; the needs-you chip remains hub-owned', { skip }, async t => {
  const c = await startShell(t, s => {
    s.visibility = { inbox: { idle: 'now' }, messages: { agent: 'now' }, sessions: { idle: 'now' }, items: { backlog: 'watch' } };
    s.inbox = { asks: [], approvals: [], waiting: [] };
    s.items!.push(item('R-1', 'release', 'Backlog scope', { version: '1.0.0' }));
    s.items!.find(it => it.id === 'T-13')!.parent = 'R-1';
    s.messages!.general!.push({ id: 'raised', from: 'impl-1', fromKind: 'agent', fromRole: 'implementer', to: ['coord-1'], kind: 'report', text: 'Raised agent report', topic: 'general', ts: ts(12) });
    s.processes![1]!.state = 'idle';
  });
  await c.waitScreen(s => /needs you\s+0/.test(topBar(s)), 'an idle session never contributes to needsYou');
  const values = await c.lua<{ message: string; idle: string; backlog: string; dim: boolean; now: number }>(`local s = require('cland.state'); local t = require('cland.views').topic('general').thread; return {message = t.blocks[#t.blocks].layer, idle = s.session('impl-1').layer, backlog = s.item('T-13').layer, dim = require('cland.palette').dim('items', s.item('T-13')), now = s.counts().now}`);
  assert.equal(values.message, 'now');
  assert.equal(values.idle, 'now');
  assert.equal(values.backlog, 'watch');
  assert.equal(values.dim, false);
  assert.equal(values.now, 2);
  // The same classified-now row cannot override a hub count of zero.
  await c.control({ emit: { type: 'inbox', inbox: { asks: [], approvals: [], waiting: [], needsYou: 0 } } });
  await c.waitScreen(s => /needs you\s+0/.test(topBar(s)), 'the chip obeys the hub after visibility overrides');
});

test('a current-release change updates other item placements and palette dimming without a snapshot reload', { skip }, async t => {
  const first = { id: 'T-201', kind: 'release', title: 'First release', state: 'open', version: '0.1.0', parent: null };
  const next = { id: 'T-202', kind: 'release', title: 'Next release', state: 'open', version: '0.2.0', parent: null };
  const work = { id: 'T-203', kind: 'task', title: 'Future work', state: 'open', status: 'in progress', parent: next.id };
  const c = await startShell(t, s => { s.items!.push(first, next, work); });
  assert.equal(await c.lua("return require('cland.palette').dim('items', require('cland.state').item('T-203'))"), true);
  await c.control({ set: { items: [ { ...first, state: 'closed' }, next, work ] } });
  await c.control({ emit: { type: 'task', id: first.id, item: { ...first, state: 'closed' } } });
  assert.equal(await c.lua("return vim.wait(5000, function() return require('cland.state').item('T-203').layer == 'now' end, 10)"), true);
  assert.equal(await c.lua("return require('cland.palette').dim('items', require('cland.state').item('T-203'))"), false);
});

for (const [status, role, layer, count] of [['stopped', 'implementer', 'background', 1], ['exited', 'implementer', 'background', 1], ['stopped', 'aide', 'now', 2]] as const) {
  test(`live ${role} ${status} keeps palette and session count consistent after its state event`, { skip }, async t => {
    const c = await startShell(t, s => {
      s.visibility = { sessions: { idle: 'now' } };
      s.processes![1] = proc('impl-1', role, 'idle');
    });
    const ended = { ...proc('impl-1', role, 'unknown'), status, attach: null };
    await c.control({ set: { processes: [proc('coord-1', 'coordinator', 'busy'), ended] } });
    await c.control({ emits: [
      { type: 'session.process', process: ended },
      { type: 'session.state', session: 'impl-1', sessionId: 'impl-1-id', state: 'unknown', source: status === 'stopped' ? 'stopped' : 'process', ts: ts(12) },
    ] });
    assert.equal(await c.lua(`return vim.wait(5000, function() local s = require('cland.state').session('impl-1'); return s.status == '${status}' and s.state == 'unknown' end, 10)`), true);
    const observed = await c.lua<{ layer: string; dim: boolean; count: number }>("local s = require('cland.state'); return {layer = s.session('impl-1').layer, dim = require('cland.palette').dim('sessions', s.session('impl-1')), count = s.counts().now}");
    assert.deepEqual(observed, { layer, dim: layer === 'background', count });
  });
}

test('verifier rows show the latest hold plus others and dim pending work until its hold frame', { skip }, async t => {
  const reviewer = { ...proc('reviewer', 'reviewer', 'idle'), holds: [
    { item: 'T-a', role: 'review', heldAt: ts(1) },
    { item: 'T-b', role: 'review', heldAt: ts(2) },
  ], pending: { item: 'T-other', kind: 'review' } };
  const qa = { ...proc('qa', 'qa', 'idle'), holds: [], pending: { item: 'T-c', kind: 'qa' } };
  const claim = { ...proc('impl', 'implementer', 'idle'), holds: [{ item: 'T-d', role: 'item' }] };
  const c = await startShell(t, s => { s.processes = [reviewer, qa, claim]; });
  await onSessionRow(c, 'reviewer');
  const screen = await c.waitScreen(s => /reviewer.*T-b review \+1/.test(s) && s.includes('   T-a review'), 'latest verifier hold and count');
  assert.match(screen, /T-c qa/);
  assert.match(screen, /impl.*T-d item/);
  assert.ok(screen.indexOf('   T-b review') < screen.indexOf('   T-a review'), 'details retain roles and run newest first');
  assert.doesNotMatch(screen, /T-other/);
  const attr = (item: string) => c.lua<number>(`
    local item = ...
    for r = 1, vim.o.lines do for col = 1, vim.o.columns - #item do
      local text = ''
      for k = 0, #item - 1 do text = text .. vim.fn.screenstring(r, col + k) end
      if text == item then return vim.fn.screenattr(r, col) end
    end end
    error('item absent from screen')
  `, item);
  const dim = await attr('T-c'), normal = await attr('T-d');
  assert.notEqual(dim, normal, 'the pending item has a dim screen attribute');
  const held = { ...qa, holds: [{ item: 'T-c', role: 'qa', heldAt: ts(3) }], pending: null };
  await c.control({ set: { processes: [reviewer, held, claim] }, emit: { type: 'session.process', process: held } });
  await c.waitScreen(s => /qa.*T-c qa/.test(s), 'pending item replaced by hold');
  // The text stays the same; screen attributes prove the frame changed its colour.
  await eventually('held item uses normal colour', async () => await attr('T-c') === normal || undefined);
  assert.equal(await c.lua('return #require("cland.actions").audit()'), 0);
});

// The frame and rendered-header seams are the T-1008 acceptance criteria. Only time is faked.
async function snapshotClock(c: Shell) {
  await c.lua(`
    local clock = { now = 0, timers = {} }
    _G.snapshot_clock = clock
    vim.defer_fn = function(fn, ms)
      local timer = { at = clock.now + ms, fn = fn, closed = false }
      function timer:is_closing() return self.closed end
      function timer:stop() self.closed = true end
      function timer:close() self.closed = true end
      clock.timers[#clock.timers + 1] = timer
      return timer
    end
  `);
  return { advance: async (ms: number) => {
    await c.lua(`
      local clock = _G.snapshot_clock
      local target = clock.now + ...
      while true do
        local next_timer
        for _, timer in ipairs(clock.timers) do
          if not timer.closed and timer.at <= target and (not next_timer or timer.at < next_timer.at) then next_timer = timer end
        end
        if not next_timer then break end
        clock.now = next_timer.at
        next_timer.closed = true
        next_timer.fn()
        local drained = false
        vim.schedule(function() drained = true end)
        assert(vim.wait(5000, function() return drained end), 'scheduled timer callback drains')
      end
      clock.now = target
    `, ms);
  } };
}

test('a late original items answer completes startup after its deadline instead of being discarded', { skip }, async t => {
  const envRoot = await tempProject(t);
  const c = await startShell(t, withItems, fixtureEnvironment(envRoot, process.env));
  const clock = await snapshotClock(c);
  await c.control({ set: { holdSnapshots: ['task.list'] } });
  await c.lua("require('cland.state').S.items_loaded = false; require('cland').refresh()");
  await c.control({ waitSnapshot: 'task.list' });
  const before = await requestsOf(c, 'task.list');
  await clock.advance(30000);
  await c.control({ waitSnapshot: 'task.list', snapshotCount: 2 });
  assert.equal((await requestsOf(c, 'task.list')).length, before.length + 1);
  await c.control({ releaseSnapshots: ['task.list'], snapshotOrder: 'oldest', snapshotLimit: 1 });
  // The round trip proves the original result was processed, even when its callback was discarded.
  await c.lua("local seen=false; require('cland').client:request({type='role.list'},function() seen=true end); assert(vim.wait(5000,function() return seen end))");
  assert.equal(await c.lua("return require('cland.state').S.items_loaded"), true, 'a reply after 30 s still installs its items');
  await clock.advance(600000);
  assert.equal((await requestsOf(c, 'task.list')).length, before.length + 1, 'the answered snapshot never retries again');
});

test('only a missing snapshot retries with backoff, and its oldest late answer retains live task events', { skip }, async t => {
  const envRoot = await tempProject(t);
  const c = await startShell(t, withItems, fixtureEnvironment(envRoot, process.env));
  const clock = await snapshotClock(c);
  await c.control({ set: { holdSnapshots: ['task.list'] } });
  await c.lua("require('cland').refresh()");
  await c.control({ waitSnapshot: 'task.list' });
  const fullTypes = ['hub.status', 'task.list', 'topic.list', 'topic.history', 'events.list', 'session.list', 'artifact.list', 'rule.list', 'account.list'];
  const counts = async () => Object.fromEntries(await Promise.all(fullTypes.map(async type => [type, (await requestsOf(c, type)).length])));
  const before = await counts();
  await clock.advance(30000);
  await c.control({ waitSnapshot: 'task.list', snapshotCount: 2 });
  await clock.advance(59999);
  assert.equal((await requestsOf(c, 'task.list')).length, before['task.list']! + 1, 'no second retry at the old 30 s cadence');
  await clock.advance(1);
  await c.control({ waitSnapshot: 'task.list', snapshotCount: 3 });
  await clock.advance(660000); // retries at 210, 450 and 750 seconds; the gap caps at 300 seconds
  await c.control({ waitSnapshot: 'task.list', snapshotCount: 6 });
  assert.equal((await requestsOf(c, 'task.list')).length, before['task.list']! + 5);
  await clock.advance(299999);
  assert.equal((await requestsOf(c, 'task.list')).length, before['task.list']! + 5);
  await clock.advance(1);
  await c.control({ waitSnapshot: 'task.list', snapshotCount: 7 });
  const latest = item('T-14', 'task', 'New item 3');
  await c.control({ set: { items: [latest] }, emit: { type: 'task', id: latest.id, item: latest } });
  await c.control({ releaseSnapshots: ['task.list'], snapshotOrder: 'oldest', snapshotLimit: 1 });
  await c.lua("assert(vim.wait(5000, function() return next(require('cland').client.snapshots) == nil end), 'late answer completes snapshot')");
  assert.equal(await c.lua("return require('cland.state').item('T-14').title"), 'New item 3');
  const after = await counts();
  assert.deepEqual(after, { ...before, 'task.list': before['task.list']! + 6 }, 'answered lists are never re-requested by a missing read');
  await clock.advance(600000);
  assert.deepEqual(await counts(), after, 'ten idle minutes send no whole-state reads');
});

test('a reconnect reads each startup list once then settles for ten fake minutes while task events update the explorer', { skip }, async t => {
  const envRoot = await tempProject(t);
  const c = await startShell(t, withItems, fixtureEnvironment(envRoot, process.env));
  const clock = await snapshotClock(c);
  const reconnected = c.reconnect();
  await c.waitScreen(s => s.includes('hub: reconnecting'), 'old transport disconnected before retry');
  await clock.advance(250);
  await reconnected;
  await c.waitScreen(s => topBar(s).includes('coord-1') && s.includes('hub: connected'), 'replacement connection');
  await c.lua("assert(vim.wait(5000,function() local c=require('cland').client; return c:connected() and next(c.pending)==nil end), 'all reconnect replies installed')");
  const types = ['hub.status', 'task.list', 'topic.list', 'topic.history', 'events.list', 'session.list', 'artifact.list', 'rule.list', 'account.list'];
  const counts = async () => Object.fromEntries(await Promise.all(types.map(async type => [type, (await requestsOf(c, type)).length])));
  // Both cached topic views (General and Agents) have their own history snapshot.
  const expected = Object.fromEntries(types.map(type => [type, type === 'topic.history' ? 2 : 1]));
  assert.deepEqual(await counts(), expected);
  await clock.advance(600000);
  assert.deepEqual(await counts(), expected, 'no full reads during ten idle minutes');
  await c.input('<Esc><Space>e');
  await c.input('zR');
  await c.lua("assert(vim.wait(5000,function() return require('cland.state').S.closed_items_loaded == true end), 'human-demand closed snapshot installed')");
  const afterDemand = { ...expected, 'task.list': 2 };
  assert.deepEqual(await counts(), afterDemand, 'expanding all deliberately fetches closed summaries once');
  assert.deepEqual((await requestsOf(c, 'task.list')).map(f => [f.projection, f.state]), [['summary','open'],['summary','closed']]);
  const latest = item('T-14', 'task', 'New item 3');
  await c.control({ set: { items: [latest] }, emit: { type: 'task', id: latest.id, item: latest } });
  await c.waitScreen(s => s.includes('New item 3'), 'task event renders its explorer row');
  assert.deepEqual(await counts(), afterDemand, 'task event never reloads any whole-state list');
  await clock.advance(600000);
  assert.deepEqual(await counts(), afterDemand, 'no full reads during ten idle minutes after human demand and task events');
});

test('the header shows sessions and Coordinator while the startup items list is delayed', { skip }, async t => {
  const envRoot = await tempProject(t);
  const c = await startShell(t, s => { withItems(s); s.holdSnapshots = ['task.list', 'hub.status']; }, fixtureEnvironment(envRoot, process.env), false);
  await c.control({ waitSnapshot: 'task.list' });
  await c.control({ waitSnapshot: 'hub.status' });
  const screen = await c.waitScreen(s => topBar(s).includes('coord-1 Coordinator') && /sessions\s+3/.test(topBar(s)), 'session.list independently fills the header');
  assert.doesNotMatch(topBar(screen), /no coordinator/);
  assert.equal(await c.lua("return require('cland.state').S.items_loaded"), false, 'task.list is still pending');
  await c.input('<Esc><Space>e');
  await c.waitScreen(s => s.includes('loading the items'), 'explorer is still waiting for items');
  await c.control({ set: { holdSnapshots: [] }, releaseSnapshots: ['task.list', 'hub.status'] });
  await c.waitScreen(s => !s.includes('loading the items') && topBar(s).includes('coord-1 Coordinator'), 'items arrive without resetting the header');
});
