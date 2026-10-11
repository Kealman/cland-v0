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

test('inbox archive is opt-in and stays separate from background in both views', { skip }, async t => {
  const ts = new Date().toISOString();
  const c = await start(t, {
    visibility: { inbox: { clear: 'archive' } },
    inbox: { notifications: [
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
  await c.waitScreen(s => s.includes('ARCHIVE') && s.includes('archived verdict') && !s.includes('hidden bookkeeping'), 'explicit archive request');
  await c.input('<Space>N');
  await c.waitScreen(s => s.includes('Inbox · full width') && s.includes('archived verdict'), 'full width shares archive selection');
  await c.input('A');
  await c.waitScreen(s => !s.includes('archived verdict') && s.includes('watch idle'), 'archive hidden again');
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

test('the notification cap is shared by visible layers and excludes hidden Background and Archive', { skip }, async t => {
  const ts = new Date().toISOString();
  const notifications = Array.from({ length: 60 }, (_, i) => ({
    id: `note-${i}`, kind: i % 2 ? 'idle' : 'plan', text: `visible notification ${i}`, ts,
  }));
  const c = await start(t, {
    visibility: { inbox: { plan: 'now', clear: 'archive' } },
    inbox: { notifications: [...notifications,
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
  assert.doesNotMatch(rows.text, /hidden bookkeeping|archived notification/);
  await c.input('A');
  await c.lua(`assert(vim.wait(5000, function()
    return table.concat(vim.api.nvim_buf_get_lines(0, 0, -1, false), '\\n'):find('archived notification', 1, true) ~= nil
  end))`);
  rows = await inboxRows(c);
  assert.deepEqual(rows.ids, [...now.slice(0, -1), ...watch, 'archived']);
  assert.match(rows.text, /11 earlier · Agents log/);
  assert.doesNotMatch(rows.text, /hidden bookkeeping/);
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
