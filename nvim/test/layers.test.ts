import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConnection } from 'node:net';
import { ownDirectory } from '../../hub/test/process-cleanup.ts';
import { connectUi, fakeClaude, spawnSpoke, startDaemon, tempProject } from '../../hub/test/harness.ts';
import { nvimOrSkip, startClient } from './harness.ts';
import type { Scenario } from './stub-hub.ts';
import type { EventRow } from '../../hub/src/protocol.ts';

const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';
const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));

async function start(t: TestContext, scenario: Scenario = {}) {
  const root = await mkdtemp(join(tmpdir(), 'cland-layers-'));
  ownDirectory(t, root);
  await mkdir(join(root, '.git'));
  const controlPath = join(root, 'stub.sock');
  const c = await startClient(t, bin, root, {
    CLAND_HUB_TRANSPORT: 'stdio',
    CLAND_COMMAND: JSON.stringify([process.execPath, STUB]),
    CLAND_STUB_SCENARIO_JSON: JSON.stringify({ inbox: {}, ...scenario }),
    CLAND_STUB_CONTROL: controlPath,
  });
  await c.waitScreen(s => s.includes('hub: connected'), 'connected');
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


test('real bound-topic verdict and death events show warning markers without changing the chip', { skip }, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const { writeFile } = await import('node:fs/promises');
  await writeFile(join(root, '.cland/config.toml'), '[visibility]\ninbox.not_clear = "now"\ninbox.death = "now"\nmessages.not_clear = "now"\n');
  const fake = await fakeClaude(t, { pollMs: 50 });
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  const created = await ui.request({ type: 'task.create', title: 'Warning evidence' });
  assert.equal(created.ok, true, created.error);
  const item = (created.value as { item: { id: string } }).item.id;
  const bound = await ui.request({ type: 'topic.create', title: 'Warning evidence', item });
  assert.equal(bound.ok, true, bound.error);
  const c = await startClient(t, bin, root);
  await c.waitScreen(s => s.includes('hub: connected'), 'real hub connected');
  const verdict = await ui.request({ type: 'task.comment', item, text: 'Fix the warning.', verdict: { verdict: 'review', result: 'not clear', run: 'headless-warning' }, as: { name: 'rev', role: 'reviewer' } });
  assert.equal(verdict.ok, true, verdict.error);
  const launch = await ui.request({ type: 'session.launch', name: 'worker', role: 'implementer', harness: 'claude-code' }, 30_000);
  assert.equal(launch.ok, true, launch.error);
  const subscribed = await coord.call<{ ok: boolean }>('subscribe', { subject: { session: 'worker' }, events: ['session.state'] });
  assert.equal(subscribed.ok, true);
  process.kill((launch.value as { process: { pid: number } }).process.pid, 'SIGKILL');
  await c.input('<Esc><Space>N');
  const s = await c.waitScreen(s => s.includes('nothing needs you'), 'warnings do not enter the inbox');
  assert.doesNotMatch((await c.lua<string[]>("return vim.api.nvim_buf_get_lines(0,0,-1,false)")).join('\n'), /review not clear|worker died|NOTIFICATIONS/);
  assert.match(s, /needs you\s+0/);
  await c.input(' E');
  await c.waitScreen(s => s.includes('review not clear') && s.includes('worker died'), 'real warnings in events');
  const rows = await c.lua<Array<{ warning?: boolean; text: string }>>("return require('cland.events').rows");
  assert.ok(rows.some(r => r.text.includes('review not clear') && r.warning));
  assert.ok(rows.some(r => r.text.includes('worker died') && r.warning));
  assert.equal(await c.lua("return require('cland.state').needs_you()"), 0);
  await c.input('<Space>L');
  await c.waitScreen(s => s.includes(`⚠ event · task · ${item} verdict posted review not clear`) && s.includes('⚠ event · session.state · worker died'), 'real warning subscription events in Agents');
  const log = (await c.lua<string[]>("return vim.api.nvim_buf_get_lines(0, 0, -1, false)")).join('\n');
  assert.match(log, new RegExp(`⚠ event · task · ${item} verdict posted review not clear · headless-warning`));
  assert.match(log, /⚠ event · session.state · worker died/);
  assert.equal(await c.lua("return require('cland.state').needs_you()"), 0);
});

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
  const ts = new Date().toISOString();
  const old = new Date(Date.now() - 8 * 86_400_000).toISOString();
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
  const old = new Date(Date.now() - 8 * 86_400_000).toISOString();
  const recent = new Date().toISOString();
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

test('a layout flush defers while another writer owns ui.json and preserves its pin', { skip }, async t => {
  const { readFile, writeFile, rm } = await import('node:fs/promises');
  const c = await start(t);
  const path = join(c.root, '.cland/ui.json');
  await mkdir(join(c.root, '.cland'), { recursive: true });
  await mkdir(`${path}.lock`);
  await writeFile(join(`${path}.lock`, '00000000-0000-0000-0000-000000000001.owner'), String(process.pid));
  await c.lua("require('cland.items').set_filter('watch')");
  assert.equal(await c.lua("return require('cland.ui').flush()"), false);
  await writeFile(path, JSON.stringify({ visibility: { topics: { general: 'pin' } } }));
  await rm(`${path}.lock`, { recursive: true });
  assert.equal(await c.lua("return require('cland.ui').flush()"), true);
  const saved = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(saved.items_filter, 'watch');
  assert.equal(saved.visibility.topics.general, 'pin');
});

test('stale UI recovery preserves a competing replacement and treats EPERM as alive', { skip }, async t => {
  const { readFile, writeFile, rm } = await import('node:fs/promises');
  const { spawn } = await import('node:child_process');
  const dead = spawn(process.execPath, ['-e', '']);
  const deadPid = dead.pid!;
  await new Promise<void>(resolve => dead.once('exit', () => resolve()));
  const c = await start(t);
  const path = join(c.root, '.cland/ui.json');
  const lock = `${path}.lock`;
  const staleName = '00000000-0000-0000-0000-000000000001.owner';
  const replacement = '00000000-0000-0000-0000-000000000002.owner';
  await c.lua("require('cland.ui').flush()");
  const result = await c.lua(`
    local lock,stale,replacement,pid,deadPid = ...
    vim.fn.mkdir(lock,'p'); vim.fn.writefile({tostring(deadPid)},lock..'/'..stale)
    local uv=vim.uv; local unlink=uv.fs_unlink; local raced=false
    uv.fs_unlink=function(path)
      if path == lock..'/'..stale and not raced then
        raced=true
        assert(unlink(path)); assert(uv.fs_rmdir(lock)); assert(uv.fs_mkdir(lock,448))
        vim.fn.writefile({tostring(pid)},lock..'/'..replacement)
      end
      return unlink(path)
    end
    require('cland.items').set_filter('watch')
    require('cland.ui').changed()
    local ok,flushed=pcall(require('cland.ui').flush)
    uv.fs_unlink=unlink
    if not ok then error(flushed) end
    return {raced=raced,flushed=flushed}
  `, lock, staleName, replacement, process.pid, deadPid);
  assert.deepEqual(result, { raced: true, flushed: false });
  assert.equal((await readFile(join(lock, replacement), 'utf8')).trim(), String(process.pid));
  await rm(join(lock, replacement));
  await writeFile(join(lock, staleName), String(deadPid));
  assert.equal(await c.lua(`
    local uv=vim.uv; local kill=uv.kill
    uv.kill=function() return nil,'operation not permitted','EPERM' end
    local ok,flushed=pcall(require('cland.ui').flush)
    uv.kill=kill
    if not ok then error(flushed) end
    return flushed
  `), false);
  assert.equal((await readFile(join(lock, staleName), 'utf8')).trim(), String(deadPid), 'an uncertain holder is preserved');
  await rm(lock, { recursive: true });
  assert.equal(await c.lua("return require('cland.ui').flush()"), true);
});

test('the human mutes a topic and pins a Reviewer through keys, then a cold UI restores both', { skip }, async t => {
  const { readFile } = await import('node:fs/promises');
  const scenario: Scenario = { processes: [session('quiet-reviewer', 'idle')], messages: { general: [
    { id: 'report', topic: 'general', from: 'coord', fromRole: 'coordinator', fromKind: 'agent', to: [], text: 'Coordinator notes', ts: new Date().toISOString() },
  ] } };
  const c = await start(t, scenario);
  await c.input('<Esc><Space>t<C-l>');
  // Connection precedes topic snapshot rendering; search only after the target row exists.
  await c.waitScreen(s => s.includes('TOPICS') && /● General/.test(s), 'topic row ready for mute');
  await c.input('/General<CR>gM');
  await c.waitScreen(s => s.includes('more (1)'), 'topic mute applied to its thread');
  await c.input('<Space>s<C-l>');
  await c.waitScreen(s => s.includes('SESSIONS') && s.includes('quiet-reviewer [Reviewer]'), 'Reviewer row ready for pin');
  await c.input('/quiet-reviewer<CR>gP');
  await c.waitScreen(s => s.includes('NOW · 1') && s.includes('quiet-reviewer [Reviewer]'), 'Reviewer pinned');
  await c.lua("require('cland.layout').preset('watch')");
  await c.input('<C-h><C-h>gw');
  const closed = c.rpc.closed;
  await c.lua("vim.cmd('qa!')").catch(() => {});
  await closed;
  const saved = JSON.parse(await readFile(join(c.root, '.cland/ui.json'), 'utf8'));
  assert.equal(saved.visibility.topics.general, 'mute');
  assert.equal(saved.visibility.sessions['quiet-reviewer'], 'pin');
  assert.equal(saved.items_filter, 'watch', 'layer filter persisted');
  assert.equal(saved.preset, 'watch', 'layout flush preserves hub-owned choices');
  const fresh = await startClient(t, bin, c.root, {
    CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]), CLAND_STUB_SCENARIO_JSON: JSON.stringify(scenario),
  });
  await fresh.waitScreen(s => s.includes('hub: connected') && s.includes('more (1)'), 'topic mute restored');
  assert.equal(await fresh.lua("return require('cland.items').filter()"), 'watch');
  await fresh.input('<Esc><Space>s<C-l>');
  await fresh.waitScreen(s => s.includes('NOW · 1') && s.includes('quiet-reviewer [Reviewer]'), 'Reviewer pin restored');
  await fresh.input('/quiet-reviewer<CR>gP');
  await fresh.waitScreen(s => s.includes('NOW · 0') && s.includes('WATCH · 1'), 'pin toggles back to watch');
  assert.deepEqual(await fresh.lua("return require('cland.actions').audit()"), []);
});

test('items honor hub layers in the board and explicit layer filters, including live changes', { skip }, async t => {
  const c = await start(t, { visibility: { items: { backlog: 'now', active: 'background', done: 'archive' } }, items: [
    { id: 'T-1', kind: 'release', title: 'Current', version: '0.1.0', state: 'open' },
    { id: 'T-2', kind: 'task', title: 'Raised backlog', parent: 'T-1', status: 'backlog', state: 'open' },
    { id: 'T-3', kind: 'task', title: 'Quiet active', parent: 'T-1', status: 'in progress', state: 'open' },
    { id: 'T-4', kind: 'task', title: 'Archived done', parent: 'T-1', status: 'done', state: 'closed' },
    { id: 'T-5', kind: 'task', title: 'Watch planned', parent: 'T-1', status: 'planned', state: 'open' },
  ] });
  await c.input('<Esc><Space>i<C-h>');
  let s = await c.waitScreen(s => s.includes('Raised backlog') && s.includes('Watch planned'), 'foreground items');
  assert.ok(!s.includes('Quiet active') && !s.includes('Archived done'), s);
  await c.input('zR');
  s = await c.waitScreen(s => s.includes('Quiet active'), 'background unfolded');
  assert.ok(!s.includes('Archived done'), 'ordinary unfold excludes archive');
  await c.input('gn');
  s = await c.waitScreen(s => s.includes('now ·') && s.includes('Raised backlog'), 'now filter');
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
  await c.input('<Esc><Space>i');
  await c.waitScreen(s => s.includes('Raised done'), 'done promoted to Watch through a closed epic');
  assert.ok((await panel()).includes('Raised done'));
  assert.deepEqual(await c.lua("local out={}; for _,it in ipairs(require('cland.board').columns().done) do out[#out+1]=it.id end; return out"), [], 'the centre board keeps its open-parent scope even when done is promoted to Watch');
  await c.input(':Cland view plan T-2<CR>');
  await c.waitScreen(s => s.includes('Plan of'), 'plan');
  assert.ok((await panel()).includes('Raised done'));
  await c.control({ set: { visibility: { items: { done: 'background' } } } });
  await c.control({ emit: { type: 'task', id: 'T-3', item: { id: 'T-3', kind: 'task', title: 'Raised done', parent: 'T-2', topic: 'general', state: 'closed', status: 'done' } } });
  await c.lua("return vim.wait(100,function() return false end,10)");
  assert.ok(!(await panel()).includes('Raised done'));
  await c.input('<Space>t<C-l>/General<CR>gP');
  assert.equal(await c.lua("return vim.wait(5000,function() return require('cland.state').item('T-3').layer == 'now' end,20)"), true, 'topic pin promotes the done item');
  await c.input(':Cland view plan T-2<CR>');
  await c.waitScreen(s => s.includes('Plan of'), 'pinned plan');
  await c.lua("return vim.wait(100,function() return false end,10)");
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
  const panel = async () => {
    await c.lua("return vim.wait(100, function() return false end, 10)");
    return c.lua<string>("return table.concat(vim.api.nvim_buf_get_lines(require('cland.panels').buf('items'),0,-1,false),'\\n')");
  };
  let text = await panel();
  assert.ok(text.includes('T-5') && !text.includes('T-3') && !text.includes('T-4'), text);
  await c.input('zR');
  text = await panel();
  assert.ok(text.includes('T-4') && !text.includes('T-3'), text);
  await c.input('gn');
  text = await panel();
  assert.ok(!text.includes('T-4') && !text.includes('T-3') && !text.includes('T-5'), text);
  await c.input('gw');
  assert.ok((await panel()).includes('T-5'));
  await c.input('gb');
  assert.ok((await panel()).includes('T-4'));
  await c.input('gA');
  assert.ok((await panel()).includes('T-3'));
});
