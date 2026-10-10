// Persistent preferences at the real Neovim process boundary, with the stub hub on stdio.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ownDirectory } from '../../hub/test/process-cleanup.ts';
import { nvimOrSkip, startClient, type Client } from './harness.ts';

const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';
const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'cland-ui-'));
  ownDirectory(t, root);
  await mkdir(join(root, '.cland'));
  return { root, path: join(root, '.cland', 'ui.json') };
}
async function client(t: TestContext, root: string) {
  const c = await startClient(t, bin, root, {
    CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]),
  });
  await c.waitScreen((s) => s.includes('hub: connected'), 'the stub hub connected');
  return c;
}
async function quit(c: Client) {
  const closed = c.rpc.closed;
  await c.lua("vim.cmd('qa!')").catch(() => {});
  await closed;
}
const preferences = `
local ui, l = require('cland.state').S.ui, require('cland.layout')
return { preset = ui.preset, left = ui.left, right = ui.right, dock = ui.dock,
  sizes = ui.sizes, filter = ui.items_filter, release = ui.current_release,
  width = l.win.left and vim.api.nvim_win_get_width(l.win.left),
  right_width = l.win.right and vim.api.nvim_win_get_width(l.win.right),
  dock_height = l.win.dock and vim.api.nvim_win_get_height(l.win.dock) }`;

test('legacy all migrates to board; explicit all cycles and persists separately across a cold start', { skip }, async t => {
  const { root, path } = await fixture(t);
  await writeFile(path, JSON.stringify({ version: 1, panels: { left: true, right: 'sessions', dock: false }, sizes: { left: 48 }, items_filter: 'all', current_release: 'T-109' }));
  const c = await client(t, root);
  assert.equal(await c.lua("return require('cland.items').filter()"), 'board');
  assert.equal(await c.lua("return require('cland.state').S.ui.current_release"), 'T-109');
  assert.deepEqual(await c.lua("return require('cland.state').S.ui.sizes"), { left: 48 });
  await c.lua("vim.api.nvim_set_current_win(require('cland.layout').win.left)");
  await c.input('<Esc>6');
  await c.waitScreen(s => s.includes('all ·'), 'explicit all');
  await c.input('f');
  await c.waitScreen(s => s.includes('board ·'), 'filter cycle wraps to board');
  await c.input('F');
  await c.waitScreen(s => s.includes('all ·'), 'reverse cycle returns to all');
  await quit(c);
  const saved = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(saved.version, 2);
  assert.equal(saved.items_filter, 'all');
  const fresh = await client(t, root);
  assert.equal(await fresh.lua("return require('cland.items').filter()"), 'all');
  assert.equal(await fresh.lua("return require('cland.state').S.ui.current_release"), 'T-109');
  assert.deepEqual(await fresh.lua("return require('cland.state').S.ui.sizes"), { left: 48 });
});

async function resize(c: Client, slot: string, size: number, key: string) {
  await c.lua("vim.api.nvim_set_current_win(require('cland.layout').win[...])", slot);
  await c.input(`<Esc><C-w>${size}${key}`);
  for (let i = 0; i < 200; i++) {
    if (await c.lua("local slot, size = ...; return require('cland.state').S.ui.sizes[slot] == size", slot, size)) return;
    await sleep(20);
  }
  assert.fail(`the human resize ${slot}=${size} was not recorded: ${JSON.stringify(await c.lua(preferences))}`);
}
async function manualSizes(c: Client) {
  await c.input('<Esc>:Cland preset watch<CR>');
  await c.waitScreen((s) => s.includes('preset watch') && s.includes('TOPICS'), 'Watch opened');
  await resize(c, 'left', 48, '|');
  await resize(c, 'right', 46, '|');
  await resize(c, 'dock', 11, '_');
}

test('PANELS-005: manual sizes survive views, presets, hidden panels and a cold restart with filters and scope', { skip }, async (t) => {
  const { root, path } = await fixture(t);
  const c = await client(t, root);
  await manualSizes(c);
  await c.lua("require('cland.items').set_filter('work'); require('cland.state').S.ui.current_release = 'T-109'");
  await c.lua(`local l = require('cland.layout'); l.show({kind='board'}, {insert=false}); l.preset('charting')`);
  assert.equal(await c.lua("return vim.api.nvim_win_get_width(require('cland.layout').win.left)"), 48);
  await c.lua(`local l = require('cland.layout'); l.preset('steady'); l.preset('watch'); l.show({kind='inbox'}, {insert=false})`);
  const before = await c.lua(preferences);
  assert.deepEqual(before, { preset: 'watch', left: true, right: 'inbox', dock: true, sizes: { left: 48, right: 46, dock: 11 }, filter: 'work', release: 'T-109', width: 48, right_width: 46, dock_height: 11 });
  // Screen constraints must not replace a human's preferred size with a temporarily clamped size.
  await c.rpc.request('nvim_ui_try_resize', 75, 20);
  await sleep(100);
  assert.deepEqual(await c.lua("return require('cland.state').S.ui.sizes"), { left: 48, right: 46, dock: 11 });
  await c.rpc.request('nvim_ui_try_resize', 160, 45);
  await sleep(100);
  assert.deepEqual(await c.lua(preferences), before);
  // Exit flushes a pending debounce. A fresh process reads ui.json, without the :restart snapshot.
  await quit(c);
  const data = JSON.parse(await readFile(path, 'utf8')) as { current_release: string };
  assert.equal(data.current_release, 'T-109');
  const fresh = await client(t, root);
  assert.deepEqual(await fresh.lua(preferences), before);
  // Panel toggles supersede the preset, and that custom set also survives a cold start.
  await fresh.lua("require('cland.layout').toggle_dock(); require('cland.layout').right_panel('sessions')");
  const custom = await fresh.lua(preferences);
  await quit(fresh);
  const third = await client(t, root);
  assert.deepEqual(await third.lua(preferences), custom);
});

test('automatic closes preserve every stored size, including a sole board centre; later human resizes persist', { skip }, async (t) => {
  for (const kind of ['board-centre', 'board-centre-undocked', 'centre', 'composer', 'session', 'left', 'right', 'dock', 'untracked', 'stale']) {
    const { root } = await fixture(t);
    const c = await client(t, root);
    await manualSizes(c);
    const expected = { left: 48, right: 46, dock: 11 };
    assert.deepEqual(await c.lua("return require('cland.state').S.ui.sizes"), expected);
    await c.lua(`local kind = ...; local l = require('cland.layout')
      if kind:match('^board%-centre') then
        l.show({kind='board'}, {insert=false})
        if kind == 'board-centre-undocked' then l.toggle_dock() end
      end
      local win = kind == 'untracked' and vim.api.nvim_open_win(vim.api.nvim_create_buf(false, true), false, {split='right', win=l.centre()})
        or kind == 'session' and l.show_split({kind='session', id='missing'}, {focus=false})
        or l.win[kind:match('^board%-centre') and 'centre' or kind]
      if win then vim.api.nvim_win_close(win, true) else l.on_win_closed(99999) end`, kind);
    // Let the real WinClosed, deferred repair and WinResized events run; no human resize occurs.
    await sleep(100);
    assert.deepEqual(await c.lua("return require('cland.state').S.ui.sizes"), expected, `${kind} close must not store automatic geometry`);
    if (kind.startsWith('board-centre')) {
      const repaired = await c.lua<{ width: number; right_width: number }>(preferences);
      assert.equal(repaired.width, 48, 'closing the board centre restores the left width immediately');
      assert.equal(repaired.right_width, 46, 'closing the board centre restores the right width immediately');
    }
    await c.lua("require('cland.layout').preset('watch')");
    const restored = await c.lua<{ width: number; right_width: number; dock_height: number }>(preferences);
    assert.equal(restored.width, 48, `${kind} keeps left preference on reopen`);
    assert.equal(restored.right_width, 46, `${kind} keeps right preference on reopen`);
    assert.equal(restored.dock_height, 11, `${kind} keeps dock preference on reopen`);
    // Real resize events after the close repair still represent a new human preference.
    await resize(c, 'left', 50, '|');
    assert.deepEqual(await c.lua("return require('cland.state').S.ui.sizes"), { ...expected, left: 50 });
  }
});

test('a human resize survives an immediate view or preset operation before WinResized', { skip }, async (t) => {
  const { root } = await fixture(t);
  const c = await client(t, root);
  await manualSizes(c);
  for (const operation of ["l.show({kind='board'}, {insert=false})", "l.preset('charting')", "l.preset('watch')", "l.fix()", "l.build({insert=false})"]) {
    const actual = await c.lua(`local l = require('cland.layout')
      vim.api.nvim_set_current_win(l.win.left)
      vim.cmd('vertical resize 50')
      ${operation}
      return {stored=require('cland.state').S.ui.sizes.left, width=vim.api.nvim_win_get_width(l.win.left)}`);
    assert.deepEqual(actual, { stored: 50, width: 50 }, operation);
    await resize(c, 'left', 48, '|');
  }
});

test('a native panel close flushes the human resize immediately before it', { skip }, async (t) => {
  for (const { slot, kind } of [{ slot: 'left' }, { slot: 'right', kind: 'inbox' }, { slot: 'right', kind: 'sessions' }, { slot: 'right', kind: 'topics' }, { slot: 'dock' }]) {
    const { root } = await fixture(t);
    const c = await client(t, root);
    await manualSizes(c);
    if (kind) await c.lua("if require('cland.state').S.ui.right ~= ... then require('cland.layout').right_panel(...) end", kind);
    const size = slot === 'dock' ? 13 : 50;
    await c.lua(`local slot, size = ...; local l = require('cland.layout')
      vim.api.nvim_set_current_win(l.win[slot])
      vim.cmd((slot == 'dock' and 'resize ' or 'vertical resize ') .. size .. ' | close')`, slot, size);
    await sleep(100);
    const expected = { left: 48, right: 46, dock: 11, [slot]: size };
    assert.deepEqual(await c.lua("return require('cland.state').S.ui.sizes"), expected, `${kind ?? slot} keeps the pre-close resize while hidden`);
    await c.lua("require('cland.layout').preset('watch')");
    const after = await c.lua<{ width: number; right_width: number; dock_height: number }>(preferences);
    assert.equal(after.width, expected.left);
    assert.equal(after.right_width, expected.right);
    assert.equal(after.dock_height, expected.dock);
  }
});

test('same-batch close then resize before repair follows the documented typeahead limitation', { skip }, async (t) => {
  const { root } = await fixture(t);
  const c = await client(t, root);
  await manualSizes(c);
  await c.lua(`local l = require('cland.layout')
    l.show({kind='board'}, {insert=false})
    local split = vim.api.nvim_open_win(vim.api.nvim_create_buf(false, true), true, {split='right', win=l.centre()})
    -- Coordinator's accepted limitation (rev-65-125-3 / A-246): one typeahead batch reaches the
    -- interval before scheduled close repair; hand-typed keys let the event loop repair run first.
    vim.cmd('close | call win_gotoid(' .. l.win.left .. ') | vertical resize 50')
    assert(vim.api.nvim_win_get_width(l.win.left) == 50, 'the queued resize happened before repair')`);
  await sleep(100);
  const after = await c.lua<{ width: number; sizes: object }>(preferences);
  assert.equal(after.width, 48, 'scheduled repair restores the previous manual preference');
  assert.deepEqual(after.sizes, { left: 48, right: 46, dock: 11 });
});

test('absent ui.json silently defaults; unreadable or corrupt files notify without hiding inbox answers', { skip }, async (t) => {
  for (const content of [null, 'directory', '{broken', '{"version":1,"panels":false}', '{"version":2}']) {
    const { root, path } = await fixture(t);
    if (content === 'directory') await mkdir(path);
    else if (content !== null) await writeFile(path, content);
    const c = await client(t, root);
    const info = await c.lua<{ right: string; left: boolean; filter: string; sizes: object }>(preferences);
    assert.equal(info.right, 'sessions');
    assert.equal(info.left, false);
    assert.equal(info.filter, 'board');
    assert.deepEqual(info.sizes, {});
    const notice = await c.lua<string | null>("return require('cland.state').S.flash and require('cland.state').S.flash.text or vim.NIL");
    if (content === null) assert.equal(notice, null, 'a fresh project is silent');
    else assert.match(notice ?? '', /ui.json unreadable or invalid; using default layout/);
    await c.input('<Esc><Space>n');
    const screen = await c.waitScreen((s) => s.includes('INBOX'), 'the focused inbox');
    assert.match(screen.split('\n')[43] ?? '', /1-9 answer · i free answer/);
    if (content !== null) assert.match(screen.split('\n')[43] ?? '', /ui.json/);
    assert.doesNotMatch(c.stderr(), /Error|stack traceback/);
  }
});

test('a long centre context cannot displace the inbox answer hint or preference notice at 160 or 80 columns', { skip }, async (t) => {
  const { root, path } = await fixture(t);
  await writeFile(path, '{broken');
  const c = await client(t, root);
  await c.lua(`local s = require('cland.state'); s.topic('general').title =
    'T-119: Containers from config: levels replace hard-coded container kinds; containers with open children cannot close 界界界界'; s.changed()`);
  await c.input('<Esc><Space>n');
  for (const columns of [160, 80]) {
    await c.rpc.request('nvim_ui_try_resize', columns, 45);
    const screen = await c.waitScreen((s) => s.includes('INBOX'), `the inbox at ${columns} columns`);
    const status = screen.split('\n')[43] ?? '';
    assert.match(status, /1-9 answer · i free answer/, `answer keys at ${columns} columns`);
    assert.match(status, /ui.json/, `preference notice at ${columns} columns`);
    if (columns === 160) assert.match(status, /T-119:.*…/, 'the context is visibly truncated');
    const budget = await c.lua<{ rendered: number; columns: number }>(`return {
      rendered = vim.api.nvim_strwidth(vim.api.nvim_eval_statusline((require('cland.bars').status():gsub('%%=', '')),
        {maxwidth=1000, fillchar=' '}).str), columns = vim.o.columns }`);
    assert.ok(budget.rendered <= budget.columns, `all segments share the ${columns}-cell budget`);
  }
});

test('writes debounce; a process interrupted before rename preserves the previous complete file', { skip }, async (t) => {
  const { root, path } = await fixture(t);
  const c = await client(t, root);
  await c.lua("require('cland.layout').preset('charting'); require('cland.ui').changed(); require('cland.ui').flush()");
  const previous = await readFile(path, 'utf8');
  await c.lua("require('cland.items').set_filter('done')");
  assert.equal(await readFile(path, 'utf8'), previous, 'no synchronous write on a preference change');
  await sleep(350);
  assert.equal((JSON.parse(await readFile(path, 'utf8')) as { items_filter: string }).items_filter, 'done');
  const complete = await readFile(path, 'utf8');
  // Halt at the actual rename boundary after the temp file was written and closed, then kill the process.
  await c.lua(`vim.uv.fs_rename = function() vim.wait(10000, function() return false end); return nil, 'interrupted' end
    require('cland.items').set_filter('map')`);
  for (let i = 0; i < 100; i++) {
    if ((await readdir(join(root, '.cland'))).some((f) => f.endsWith('.tmp'))) break;
    await sleep(20);
  }
  assert.ok((await readdir(join(root, '.cland'))).some((f) => f.endsWith('.tmp')), 'write reached its temporary file');
  c.process.kill('SIGKILL');
  await c.rpc.closed;
  assert.equal(await readFile(path, 'utf8'), complete);
  const fresh = await client(t, root);
  assert.equal(await fresh.lua("return require('cland.items').filter()"), 'done');
});
