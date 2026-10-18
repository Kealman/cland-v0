// T2: screen permutations consume committed protocol frames through stub-client.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConnection } from 'node:net';
import { nvimOrSkip, startClient } from './stub-client.ts';
import { waitInitialSnapshots } from './readiness.ts';
import type { Scenario } from './stub-hub.ts';
import type { EventRow } from '../../hub/src/protocol.ts';
import { STUB_NOW } from './fixtures/clock.ts';
import { eventually, tempProject } from './fixture.ts';

const nvim = await nvimOrSkip();

const skip = 'skip' in nvim ? nvim.skip : false;

const bin = 'bin' in nvim ? nvim.bin : '';

const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));

async function start(t: TestContext, scenario: Scenario = {}) {
  const root = await tempProject(t, 'cland-layers-');
  await mkdir(join(root, '.git'));
  const controlPath = join(root, 'stub.sock');
  const c = await startClient(t, bin, root, {
    CLAND_HUB_TRANSPORT: 'stdio',
    CLAND_COMMAND: JSON.stringify([process.execPath, STUB]),
    CLAND_STUB_SCENARIO_JSON: JSON.stringify({ inbox: {}, ...scenario }),
    CLAND_STUB_CONTROL: controlPath,
  });
  await c.waitScreen(s => s.includes('hub: connected'), 'connected');
  await waitInitialSnapshots(c);
  return Object.assign(c, { root, control: (cmd: Record<string, unknown>) => new Promise<Record<string, unknown>>((resolve, reject) => {
    const sock = createConnection(controlPath);
    let text = '';
    sock.setEncoding('utf8');
    sock.on('error', reject);
    sock.on('data', chunk => {
      text += chunk;
      if (text.includes('\n')) { sock.end(); resolve(JSON.parse(text.slice(0, text.indexOf('\n')))); }
    });
    sock.write(`${JSON.stringify(cmd)}\n`);
  }) });
}

test('inbox archive shows departures in both views while events stay outside the inbox', { skip }, async t => {
  const ts = new Date().toISOString();
  const c = await start(t, {
    inbox: { archiveToday: 1, archive: [{ id: 'left', kind: 'request', subject: 'T-1', text: 'declined request', since: ts, ts, reason: 'declined' }] },
    events: [{ id: 'clear', ts, kind: 'verdict', glyph: '✓', subject: { kind: 'item', id: 'T-1' }, text: 'clear verdict' }],
  });
  await c.input('<Esc><Space>n');
  await c.waitScreen(s => s.includes('archive · 1 rows left today'), 'inbox panel');
  await c.input('A');
  await c.waitScreen(s => s.includes('declined request') && !s.includes('clear verdict'), 'explicit archive request');
  await c.input('<Space>N');
  await c.waitScreen(s => s.includes('Inbox · full width') && s.includes('declined request'), 'full width shares archive selection');
  await c.input('A');
  await c.waitScreen(s => !s.includes('declined request'), 'archive hidden again');
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"), []);
});

for (const view of ['panel', 'full']) test(`${view} inbox keeps verdicts, role changes and warnings in the events view`, { skip }, async t => {
  const ts = new Date().toISOString();
  const events: EventRow[] = [
    { id: 'clear', ts, kind: 'verdict', glyph: '✓', subject: { kind: 'item', id: 'T-1' }, text: 'Review clear evidence' },
    { id: 'role', ts, kind: 'session', glyph: '↔', subject: { kind: 'session', id: 'impl' }, text: 'Implementer role changed' },
    { id: 'not-clear', ts, kind: 'verdict', glyph: '⚠', warning: true, subject: { kind: 'item', id: 'T-2' }, text: 'Review not clear evidence' },
    { id: 'death', ts, kind: 'session', glyph: '⚠', warning: true, subject: { kind: 'session', id: 'worker' }, text: 'Worker died evidence' },
  ];
  const c = await start(t, { inbox: { needsYou: 0 }, events });
  await c.input(view === 'panel' ? '<Esc> n' : '<Esc> N');
  await c.waitScreen(s => s.includes('nothing needs you') && s.includes('new events since your last look'), 'empty inbox retains events and archive');
  const lines = await c.lua<string[]>("return vim.api.nvim_buf_get_lines(0,0,-1,false)");
  assert.doesNotMatch(lines.join('\n'), /evidence|NOTIFICATIONS|earlier.*Agents log|D dismiss/);
  assert.match(lines.join('\n'), /archive/);
  await c.input('D');
  assert.deepEqual(await c.lua('return vim.api.nvim_buf_get_lines(0,0,-1,false)'), lines);
  await c.input('e');
  const screen = await c.waitScreen(s => events.every(r => s.includes(r.text)), 'events contain verdict, role and warnings');
  assert.match(screen, /needs you\s+0/);
  const frames = (await c.control({ requests: true })).requests as Array<Record<string, unknown>>;
  assert.deepEqual(frames.filter(f => f.type === 'inbox.dismiss' || f.type === 'inbox.dismiss_all'), []);
});

const session = (name: string, state: string, status = 'running') => ({
  name, sessionId: name + '-id', role: 'reviewer', harness: 'codex', state, status,
});

test('sessions show now and watch while background folds behind more (N)', { skip }, async t => {
  const c = await start(t, { processes: [session('working', 'busy'), session('resting', 'idle'), session('finished', 'unknown', 'stopped')] });
  const s = await c.waitScreen(s => s.includes('working [Reviewer]') && s.includes('resting [Reviewer]'), 'visible sessions');
  assert.ok(s.includes('NOW') && s.includes('WATCH') && s.includes('more (1)'), s);
  assert.ok(!s.includes('finished [Reviewer]'));
  await c.input('<Esc><C-l>/more (<CR><Tab>');
  await c.waitScreen(s => s.includes('finished [Reviewer]'), 'background unfolded with Tab');
  await c.input('/finished<CR>zc');
  await c.waitScreen(s => !s.includes('finished [Reviewer]'), 'background closed from its session row');
  assert.match(String(await c.lua('return vim.api.nvim_get_current_line()')), /more \(1\)/, 'closing returns the cursor to its fold header');
  await c.input('<CR>');
  await c.waitScreen(s => s.includes('finished [Reviewer]'), 'Enter unfolds header');
  await c.input('zM');
  await c.waitScreen(s => !s.includes('finished [Reviewer]'), 'all folds closed');
  await c.input('zR');
  await c.waitScreen(s => s.includes('finished [Reviewer]'), 'all background unfolded');
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"), []);
});

test('session folds use hub layers even for live background and explicitly requested archive', { skip }, async t => {
  const c = await start(t, {
    visibility: { sessions: { idle: 'background', stopped: 'archive' } },
    processes: [session('working', 'busy'), session('quiet', 'idle'), session('archived', 'unknown', 'stopped')],
  });
  let s = await c.waitScreen(s => s.includes('working [Reviewer]') && s.includes('more (1)'), 'custom layer placement');
  assert.ok(!s.includes('quiet [Reviewer]') && !s.includes('archived [Reviewer]'));
  await c.input('<Esc><C-l>zR');
  s = await c.waitScreen(s => s.includes('quiet [Reviewer]'), 'live background unfolded');
  assert.ok(!s.includes('archived [Reviewer]'), 'zR does not reach archive');
  await c.input('/quiet<CR>');
  await c.waitScreen(s => s.includes('Codex'), 'selected background session');
  await c.control({ emit: { type: 'session.state', session: 'quiet', sessionId: 'quiet-id', state: 'busy' } });
  await c.waitScreen(s => s.includes('BUSY · 2') && s.includes('more (0)'), 'layer changes on a live frame');
  assert.match(String(await c.lua('return vim.api.nvim_get_current_line()')), /quiet \[Reviewer\]/, 'cursor follows session across layers');
  await c.input('A');
  await c.waitScreen(s => s.includes('ARCHIVE · 1') && s.includes('archived [Reviewer]'), 'explicit session archive');
  await c.input('zM');
  await c.waitScreen(s => s.includes('archived [Reviewer]'), 'folding background leaves requested archive visible');
  await c.input('A');
  await c.waitScreen(s => !s.includes('archived [Reviewer]'), 'archive hidden');
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"), []);
});

test('thread hides seven-day archive until A and keeps recent replies outside archived asks', { skip }, async t => {
  const ts = STUB_NOW;
  const old = new Date(Date.parse(STUB_NOW) - 8 * 86_400_000).toISOString();
  const c = await start(t, { messages: { general: [
    { id: 'old', topic: 'general', from: 'human', fromKind: 'human', to: [], text: 'Old private notes', ts: old },
    { id: 'ask', topic: 'general', from: 'coord', fromKind: 'agent', fromRole: 'coordinator', to: [], text: 'Old question', ts: old, ask: { question: 'Old question', state: 'answered', options: [] } },
    { id: 'answer', topic: 'general', from: 'human', fromKind: 'human', to: [], text: 'Recent answer', ts, answerTo: 'ask' },
    { id: 'recent', topic: 'general', from: 'human', fromKind: 'human', to: [], text: 'Recent notes', ts },
  ] } });
  let s = await c.waitScreen(s => s.includes('Recent notes') && s.includes('Recent answer'), 'recent thread');
  assert.ok(!s.includes('Old private notes') && !s.includes('Old question'), s);
  await c.input('<Esc><C-k>zR');
  assert.ok(!(await c.screen()).join('\n').includes('Old private notes'), 'unfold does not request archive');
  await c.input('A');
  await c.waitScreen(s => s.includes('Old private notes') && s.includes('Old question'), 'archive requested');
  await c.input('A');
  await c.waitScreen(s => s.includes('Recent answer') && !s.includes('Old private notes') && !s.includes('Old question'), 'archive hidden again');
});

test('A retrieves old messages beyond the latest 200 and hides them again', { skip }, async t => {
  const old = new Date(Date.parse(STUB_NOW) - 8 * 86_400_000).toISOString();
  const recent = STUB_NOW;
  const messages = Array.from({ length: 205 }, (_, i) => ({ id: `m-${i}`, topic: 'general', from: 'human', fromKind: 'human', to: [], text: `History ${i}`, ts: i < 5 ? old : recent }));
  const c = await start(t, { messages: { general: messages } });
  await c.waitScreen(s => s.includes('History 204'), 'latest page');
  await c.input('<Esc><C-k>A');
  await c.lua("return vim.wait(5000,function() return require('cland.views').topic('general').thread.by_id['m-0'] ~= nil end,20)");
  assert.deepEqual(await c.lua("local ids={}; for _,m in ipairs(require('cland.views').topic('general').thread.messages) do ids[#ids+1]=m.id end; return ids"), messages.map(m => m.id));
  await c.input('gg');
  await c.waitScreen(s => s.includes('History 0'), 'archive older than first page');
  await c.input('A');
  await c.waitScreen(s => !s.includes('History 0'), 'archive hidden again');
});

test('items honor hub layers in the board and explicit layer filters, including live changes', { skip }, async t => {
  const c = await start(t, { visibility: { items: { backlog: 'now', active: 'background', done: 'archive' } }, items: [
    { id: 'T-1', kind: 'release', title: 'Current', version: '0.1.0', state: 'open' },
    { id: 'T-2', kind: 'task', title: 'Raised backlog', parent: 'T-1', status: 'backlog', state: 'open' },
    { id: 'T-3', kind: 'task', title: 'Quiet active', parent: 'T-1', status: 'in progress', state: 'open' },
    { id: 'T-4', kind: 'task', title: 'Archived done', parent: 'T-1', status: 'done', state: 'closed' },
    { id: 'T-5', kind: 'task', title: 'Watch planned', parent: 'T-1', status: 'planned', state: 'open' },
  ] });
  await c.input('<Esc><Space>i<C-h>/Direct tasks (<CR>zo');
  let s = await c.waitScreen(s => s.includes('Raised backlog') && s.includes('Watch planned'), 'foreground items');
  assert.ok(!s.includes('Quiet active') && !s.includes('Archived done'), s);
  await c.input('zR');
  s = await c.waitScreen(s => s.includes('Quiet active'), 'background unfolded');
  assert.ok(!s.includes('Archived done'), 'ordinary unfold excludes archive');
  await c.input('gn');
  s = await c.waitScreen(s => s.includes('now ·') && s.includes('Raised backlog') && !s.includes('Watch planned') && !s.includes('Quiet active'), 'now filter');
  assert.ok(!s.includes('Watch planned') && !s.includes('Quiet active'));
  await c.input('gw');
  s = await c.waitScreen(s => s.includes('watch ·') && s.includes('Watch planned'), 'watch filter');
  assert.ok(!s.includes('Raised backlog'));
  await c.input('gA');
  await c.waitScreen(s => s.includes('archive ·') && s.includes('Archived done'), 'explicit archive filter');
  await c.input('gb');
  await c.waitScreen(s => s.includes('background ·') && s.includes('Quiet active'), 'background filter');
  await c.control({ set: { visibility: { items: { active: 'watch' } } } });
  await c.control({ emit: { type: 'task', id: 'T-3', item: { id: 'T-3', kind: 'task', title: 'Quiet active', parent: 'T-1', status: 'in progress', state: 'open' } } });
  await c.waitScreen(s => !s.includes('Quiet active'), 'live layer leaves background');
  await c.input('gw');
  await c.waitScreen(s => s.includes('Quiet active'), 'live layer joins watch');
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"), []);
});

test('default board and plan show done items promoted by config and a topic pin', { skip }, async t => {
  const c = await start(t, { visibility: { items: { done: 'watch' } }, items: [
    { id: 'T-1', kind: 'release', title: 'Current', state: 'open' },
    { id: 'T-2', kind: 'epic', title: 'Finished epic', parent: 'T-1', state: 'closed', plan: { stages: [{ name: 'Done', qa: { scope: 'none', when: 'per-item' }, lanes: [['T-3']] }] } },
    { id: 'T-3', kind: 'task', title: 'Raised done', parent: 'T-2', topic: 'general', state: 'closed', status: 'done' },
  ] });
  const panel = () => c.lua<string>("return table.concat(vim.api.nvim_buf_get_lines(require('cland.panels').buf('items'),0,-1,false),'\\n')");
  await c.input('<Esc><Space>i/^ ▸.*T-2<CR>zo');
  await c.waitScreen(s => s.includes('Raised done'), 'done promoted to Watch through a closed epic');
  assert.ok((await panel()).includes('Raised done'));
  assert.deepEqual(await c.lua("local out={}; for _,it in ipairs(require('cland.board').columns().done) do out[#out+1]=it.id end; return out"), [], 'the centre board keeps its open-parent scope even when done is promoted to Watch');
  await c.input(':Cland view plan T-2<CR>');
  await c.waitScreen(s => s.includes('Plan of'), 'plan');
  assert.ok((await panel()).includes('Raised done'));
  await c.control({ set: { visibility: { items: { done: 'background' } } } });
  await c.control({ emit: { type: 'task', id: 'T-3', item: { id: 'T-3', kind: 'task', title: 'Raised done', parent: 'T-2', topic: 'general', state: 'closed', status: 'done' } } });
  await c.lua("return vim.wait(5000,function() local b=require('cland.panels').buf('items'); return b and not table.concat(vim.api.nvim_buf_get_lines(b,0,-1,false),'\\n'):find('Raised done',1,true) end,10)");
  assert.ok(!(await panel()).includes('Raised done'));
  await c.input('<Space>t<C-l>/General<CR>gP');
  assert.equal(await c.lua("return vim.wait(5000,function() return require('cland.state').item('T-3').layer == 'now' end,20)"), true, 'topic pin promotes the done item');
  await c.input(':Cland view plan T-2<CR>');
  await c.waitScreen(s => s.includes('Plan of'), 'pinned plan');
  await c.lua("return vim.wait(5000,function() local b=require('cland.panels').buf('items'); return b and table.concat(vim.api.nvim_buf_get_lines(b,0,-1,false),'\\n'):find('Raised done',1,true) end,10)");
  assert.ok((await panel()).includes('Raised done'), 'topic pin raises a done task into the ordinary plan');
});

test('plan items use layer filters and fold background independently of workflow status', { skip }, async t => {
  const c = await start(t, { visibility: { items: { active: 'archive', backlog: 'background' } }, items: [
    { id: 'T-1', kind: 'release', title: 'Current', state: 'open' },
    { id: 'T-2', kind: 'epic', title: 'Layer plan', parent: 'T-1', state: 'open', plan: { stages: [{ name: 'Work', qa: { scope: 'none', when: 'per-item' }, lanes: [['T-3', 'T-4', 'T-5']] }] } },
    { id: 'T-3', kind: 'task', title: 'Archived active', parent: 'T-2', state: 'open', status: 'in progress' },
    { id: 'T-4', kind: 'task', title: 'Background backlog', parent: 'T-2', state: 'open', status: 'backlog' },
    { id: 'T-5', kind: 'task', title: 'Watching planned', parent: 'T-2', state: 'open', status: 'planned' },
  ] });
  await c.input('<Esc>:Cland view plan T-2<CR>');
  await c.input('<C-h>');
  const panel = (filter: string, includes: string[], excludes: string[]) => eventually('plan items panel has the requested layer state', async () => {
    const shown = await c.lua<{ ready: boolean; filter: string; text: string }>(`local s=require('cland.state'); local p=require('cland.plan'); local b=require('cland.panels').buf('items'); local v=s.S.ui.view; local d=p.detail['T-2']; return {ready=v.kind=='plan' and v.id=='T-2' and d~=nil and d.plan~=nil and s.item('T-3')~=nil and s.item('T-4')~=nil and s.item('T-5')~=nil, filter=s.S.ui.items_filter, text=b and vim.api.nvim_buf_is_valid(b) and table.concat(vim.api.nvim_buf_get_lines(b,0,-1,false),'\\n') or ''}`);
    return shown.ready && shown.filter === filter && includes.every(id => shown.text.includes(id)) && excludes.every(id => !shown.text.includes(id)) ? shown.text : undefined;
  });
  let text = await panel('board', ['T-5'], ['T-3', 'T-4']);
  assert.ok(text.includes('T-5') && !text.includes('T-3') && !text.includes('T-4'), text);
  await c.input('zR');
  text = await panel('board', ['T-4'], ['T-3']);
  assert.ok(text.includes('T-4') && !text.includes('T-3'), text);
  await c.input('gn');
  text = await panel('now', [], ['T-4', 'T-3', 'T-5']);
  assert.ok(!text.includes('T-4') && !text.includes('T-3') && !text.includes('T-5'), text);
  await c.input('gw');
  assert.ok((await panel('watch', ['T-5'], [])).includes('T-5'));
  await c.input('gb');
  assert.ok((await panel('background', ['T-4'], [])).includes('T-4'));
  await c.input('gA');
  assert.ok((await panel('archive', ['T-3'], [])).includes('T-3'));
});
