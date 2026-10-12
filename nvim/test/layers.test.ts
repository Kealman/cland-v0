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
  let s = await c.waitScreen(s => s.includes(`⚠ ${item} review not clear`) && s.includes('⚠ worker died'), 'real warnings in inbox');
  const inbox = (await c.lua<string[]>("return vim.api.nvim_buf_get_lines(0, 0, -1, false)")).join('\n');
  assert.ok(!inbox.includes('NOW'), inbox);
  assert.match(s, /WATCH/);
  assert.match(s, /needs you\s+0/);
  assert.match(s, /nothing needs you/);
  await c.input(`gg/${item} review not clear<CR>d`);
  await c.waitScreen(s => s.includes('warn events are informational and are not dismissed'), 'warning dismissal refused');
  await c.input('D');
  s = await c.waitScreen(s => s.includes(`⚠ ${item} review not clear`) && s.includes('⚠ worker died'), 'dismiss all retains warnings');
  assert.equal(await c.lua("return require('cland.state').needs_you()"), 0);
  await c.input('<Space>L');
  await c.waitScreen(s => s.includes(`⚠ event · task · ${item} verdict posted review not clear`) && s.includes('⚠ event · session.state · worker died'), 'real warning subscription events in Agents');
  const log = (await c.lua<string[]>("return vim.api.nvim_buf_get_lines(0, 0, -1, false)")).join('\n');
  assert.match(log, new RegExp(`⚠ event · task · ${item} verdict posted review not clear · headless-warning`));
  assert.match(log, /⚠ event · session.state · worker died/);
  assert.equal(await c.lua("return require('cland.state').needs_you()"), 0);
});

test('inbox archive shows departures while the old archive layer stays hidden in both views', { skip }, async t => {
  const ts = new Date().toISOString();
  const c = await start(t, {
    visibility: { inbox: { clear: 'archive' } },
    inbox: { archiveToday: 1, archive: [{ id: 'left', kind: 'request', subject: 'T-1', text: 'declined request', since: ts, ts, reason: 'declined' }], notifications: [
      { id: 'old', kind: 'verdict', result: 'clear', text: 'archived verdict', ts },
      { id: 'book', kind: 'role', text: 'hidden bookkeeping', ts },
      { id: 'idle', kind: 'idle', text: 'watch idle', ts },
    ] },
  });
  await c.input('<Esc><Space>n');
  let s = await c.waitScreen(s => s.includes('watch idle') && s.includes('WATCH'), 'inbox panel');
  assert.ok(!s.includes('archived verdict'));
  await c.input('zR');
  s = await c.waitScreen(s => s.includes('watch idle'), 'ordinary unfold');
  assert.ok(!s.includes('archived verdict'), 'unfold is not an archive request');
  await c.input('A');
  await c.waitScreen(s => s.includes('archive') && s.includes('declined request') && !s.includes('archived verdict') && !s.includes('hidden bookkeeping'), 'explicit archive request');
  await c.input('<Space>N');
  await c.waitScreen(s => s.includes('Inbox · full width') && s.includes('declined request'), 'full width shares archive selection');
  await c.input('A');
  await c.waitScreen(s => !s.includes('declined request') && s.includes('watch idle'), 'archive hidden again');
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"), []);
});

const session = (name: string, state: string, status = 'running') => ({
  name, sessionId: name + '-id', role: 'reviewer', harness: 'codex', state, status,
});

/** Read every rendered row, including those below the attached UI's viewport. */
async function inboxRows(c: Awaited<ReturnType<typeof start>>) {
  return c.lua<{ ids: string[]; text: string }>(`
    local buf = vim.api.nvim_get_current_buf()
    local ids = {}
    local lines = vim.api.nvim_buf_get_lines(buf, 0, -1, false)
    for i = 1, #lines do
      local row = require('cland.panels').row_at(buf, i)
      if row and row.notification then table.insert(ids, row.notification) end
    end
    return { ids = ids, text = table.concat(lines, '\\n') }
  `);
}

test('both inbox views show newest notifications first with a 50-row cap and earlier-count footer', { skip }, async t => {
  // Equal timestamps also exercise the hub's insertion-order tie break.
  const ts = new Date().toISOString();
  const notes = (count: number) => Array.from({ length: count }, (_, i) => ({
    id: `note-${i}`, kind: 'idle', text: `notification ${i}`, ts,
  }));
  const c = await start(t, { inbox: { notifications: notes(57), needsYou: 0 } });
  await c.input('<Esc><Space>n');
  await c.waitScreen(s => s.includes('notification 56'), 'newest notification in panel');
  const expected = Array.from({ length: 50 }, (_, i) => `note-${56 - i}`);
  let rows = await inboxRows(c);
  assert.deepEqual(rows.ids, expected);
  assert.match(rows.text, /7 earlier · Agents log \(␣L\)/);
  assert.ok(rows.text.indexOf('7 earlier') > rows.text.indexOf('notification 7'), 'footer follows the retained list');
  assert.equal(await c.lua('return #require("cland.state").S.inbox.notifications'), 57, 'rendering retains all notifications');
  assert.equal(await c.lua('return require("cland.state").needs_you()'), 0, 'the cap leaves the hub count unchanged');
  await c.input('<Space>N');
  await c.waitScreen(s => s.includes('Inbox · full width') && s.includes('notification 56'), 'full-width newest notification');
  rows = await inboxRows(c);
  assert.deepEqual(rows.ids, expected);
  assert.match(rows.text, /7 earlier · Agents log \(␣L\)/);

  await c.input('gg/notification 56<CR>d');
  await c.lua(`assert(vim.wait(5000, function()
    return not table.concat(vim.api.nvim_buf_get_lines(0, 0, -1, false), '\\n'):find('notification 56', 1, true)
  end))`);
  rows = await inboxRows(c);
  assert.deepEqual(rows.ids, Array.from({ length: 50 }, (_, i) => `note-${55 - i}`), 'dismissal brings the next earlier notification into view');
  assert.match(rows.text, /6 earlier · Agents log/);

  // D dismisses the whole snapshot, not just the displayed 50.
  await c.input('D');
  await c.lua(`assert(vim.wait(5000, function()
    return not table.concat(vim.api.nvim_buf_get_lines(0, 0, -1, false), '\\n'):find('NOTIFICATIONS', 1, true)
  end))`);
  assert.equal(await c.lua('return #require("cland.state").S.inbox.notifications'), 0);
  assert.doesNotMatch((await inboxRows(c)).text, /earlier · Agents log/);

  for (const count of [49, 50, 51]) {
    await c.control({ emit: { type: 'inbox', inbox: { notifications: notes(count), needsYou: 0 } } });
    await c.waitScreen(s => s.includes(`notification ${count - 1}`), `updated ${count}-notification snapshot`);
    rows = await inboxRows(c);
    assert.deepEqual(rows.ids, Array.from({ length: Math.min(count, 50) }, (_, i) => `note-${count - 1 - i}`));
    if (count > 50) assert.match(rows.text, /1 earlier · Agents log/);
    else assert.doesNotMatch(rows.text, /earlier · Agents log/);
  }
});

test('the notification cap is shared by visible layers and is unchanged by the departure archive', { skip }, async t => {
  const ts = new Date().toISOString();
  const notifications = Array.from({ length: 60 }, (_, i) => ({
    id: `note-${i}`, kind: i % 2 ? 'idle' : 'plan', text: `visible notification ${i}`, ts,
  }));
  const c = await start(t, {
    visibility: { inbox: { plan: 'now', clear: 'archive' } },
    inbox: { archiveToday: 1, archive: [
      { id: 'departed', kind: 'request', subject: 'T-1', text: 'departed request', since: ts, ts, reason: 'declined' },
    ], notifications: [...notifications,
      { id: 'book', kind: 'role', text: 'hidden bookkeeping', ts },
      { id: 'archived', kind: 'verdict', result: 'clear', text: 'archived notification', ts },
    ] },
  });
  await c.input('<Esc><Space>N');
  await c.waitScreen(s => s.includes('visible notification 58'), 'mixed notification layers');
  let rows = await inboxRows(c);
  const now = Array.from({ length: 25 }, (_, i) => `note-${58 - i * 2}`);
  const watch = Array.from({ length: 25 }, (_, i) => `note-${59 - i * 2}`);
  assert.deepEqual(rows.ids, [...now, ...watch]);
  assert.match(rows.text, /10 earlier · Agents log/);
  assert.doesNotMatch(rows.text, /hidden bookkeeping|archived notification|departed request/);
  await c.input('A');
  await c.lua(`assert(vim.wait(5000, function()
    return table.concat(vim.api.nvim_buf_get_lines(0, 0, -1, false), '\\n'):find('departed request', 1, true) ~= nil
  end))`);
  rows = await inboxRows(c);
  assert.deepEqual(rows.ids, [...now, ...watch], 'departures do not spend the notification row budget');
  assert.match(rows.text, /10 earlier · Agents log/);
  assert.match(rows.text, /departed request/);
  assert.match(rows.text, /declined/);
  assert.doesNotMatch(rows.text, /hidden bookkeeping|archived notification/);
});

for (const view of ['panel', 'full width']) {
  test(`the ${view} inbox keeps the selected notification on live insertion`, { skip }, async t => {
    const ts = new Date().toISOString();
    const note = (id: string) => ({ id, kind: 'idle', text: `notification ${id}`, ts, item: 'T-1', session: 'same-session' });
    const c = await start(t, { inbox: { notifications: [note('A'), note('B')], needsYou: 0 } });
    await c.input(view === 'panel' ? '<Esc><Space>n' : '<Esc><Space>N');
    await c.waitScreen(s => s.includes('notification B'), 'initial newest notification');
    await c.input('gg/notification B<CR>');
    const selected = () => c.lua<string | null>(`
      local buf = vim.api.nvim_get_current_buf()
      local row = require('cland.panels').row_at(buf, vim.api.nvim_win_get_cursor(0)[1])
      return row and row.notification
    `);
    assert.equal(await selected(), 'B');
    const inserted = { notifications: [note('A'), note('B'), note('C')], needsYou: 0 };
    await c.control({ set: { inbox: inserted }, emit: { type: 'inbox', inbox: inserted } });
    await c.waitScreen(s => s.includes('notification C'), 'live insertion');
    assert.equal(await selected(), 'B', 'the cursor follows its notification ID');
    await c.input('d');
    await c.lua(`assert(vim.wait(5000, function()
      return not table.concat(vim.api.nvim_buf_get_lines(0, 0, -1, false), '\\n'):find('notification B', 1, true)
    end))`);
    assert.deepEqual((await inboxRows(c)).ids, ['C', 'A'], 'd dismissed B, not the newly inserted C');

    await c.input('gg/notification A<CR>');
    assert.equal(await selected(), 'A');
    const capped = {
      notifications: [note('A'), ...Array.from({ length: 50 }, (_, i) => note(`new-${i}`))], needsYou: 0,
    };
    await c.control({ set: { inbox: capped }, emit: { type: 'inbox', inbox: capped } });
    await c.lua(`assert(vim.wait(5000, function()
      return table.concat(vim.api.nvim_buf_get_lines(0, 0, -1, false), '\\n'):find('1 earlier', 1, true) ~= nil
    end))`);
    assert.match(String(await c.lua('return vim.api.nvim_get_current_line()')), /1 earlier · Agents log/, 'an evicted selection lands on the non-actionable footer');
    assert.equal(await selected(), null);
    await c.input('d');
    await c.waitScreen(s => s.includes('d dismisses a notification'), 'footer cannot dismiss another notification');
    assert.equal(await c.lua('return #require("cland.state").S.inbox.notifications'), 51);
  });
}

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
