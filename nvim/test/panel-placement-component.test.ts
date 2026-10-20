// T2: panel placement through commands, palette, keys and recorded stub-hub events.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { skip, startShell, baseScenario, ts, requestsOf, statusLine, type Shell } from './shell-fixture.ts';
import { eventually } from './fixture.ts';

test('version-2 panel homes and occupants round-trip without losing import receipts', { skip }, async t => {
  const c = await startShell(t);
  await place(c, 'sessions', 'left');
  await place(c, 'items', 'right');
  await c.lua(`local ui=require('cland.state').S.ui
    ui.plan_seen={['E-789']='plan-receipt'}
    ui.events.last_look='2026-10-20T10:00:00Z'
    require('cland.ui').changed(); assert(require('cland.ui').flush())`);
  const saved = JSON.parse(await readFile(join(c.root, '.cland/ui.json'), 'utf8'));
  assert.equal(saved.version, 2);
  assert.deepEqual(saved.panel_homes, { items: 'right', sessions: 'left', inbox: 'right', topics: 'right' });
  assert.deepEqual(saved.panels, { left: true, left_kind: 'sessions', right: 'items', dock: false });
  assert.deepEqual(saved.plan_seen, { 'E-789': 'plan-receipt' });
  assert.equal(saved.events.last_look, '2026-10-20T10:00:00Z');
  await c.lua("require('cland.ui').load(require('cland.state').S.root); require('cland.layout').build({insert=false})");
  await expectPanel(c, 'left', 'SESSIONS');
  await expectPanel(c, 'right', 'ITEMS');
});

const oldPreferences = {
  version: 2, preset: 'watch', panels: { left: true, right: 'inbox', dock: true },
  sizes: { left: 48, right: 46, dock: 11 }, items_filter: 'work', accounts_folded: true,
  current_release: 'T-109', plan_seen: { 'E-789': 'legacy-plan' },
  events: { filter: { warnings: true }, muted: [{ kind: 'item', id: 'T-12' }], last_look: '2026-10-20T10:00:00Z' },
};
const readPreferences = `local u=require('cland.state').S.ui
  return {preset=u.preset, panels={left=u.left,right=u.right,dock=u.dock}, sizes=u.sizes,
    items_filter=u.items_filter,accounts_folded=u.accounts_folded,current_release=u.current_release,
    plan_seen=u.plan_seen,events=u.events}`;

test('older version-2 preferences load default homes and retain every existing preference', { skip }, async t => {
  const c = await startShell(t);
  await mkdir(join(c.root, '.cland'), { recursive: true });
  await writeFile(join(c.root, '.cland/ui.json'), JSON.stringify(oldPreferences));
  await c.lua("require('cland.ui').load(require('cland.state').S.root); require('cland.layout').build({insert=false})");
  const { version: _, ...expected } = oldPreferences;
  assert.deepEqual(await c.lua(readPreferences), expected);
  assert.deepEqual(await c.lua("return require('cland.state').S.ui.panel_homes"), { items: 'left', sessions: 'right', inbox: 'right', topics: 'right' });
  await expectPanel(c, 'left', 'ITEMS');
  await expectPanel(c, 'right', 'INBOX');
});

test('invalid panel assignments fall back once in amber while other preferences survive', { skip }, async t => {
  const c = await startShell(t);
  await mkdir(join(c.root, '.cland'), { recursive: true });
  const defaults = { items: 'left', sessions: 'right', inbox: 'right', topics: 'right' };
  for (const fields of [
    { panel_homes: { ...defaults, unknown: 'left' } },
    { panel_homes: { ...defaults, sessions: 'middle' } },
    { panel_homes: false },
    { panels: { left: true, left_kind: 'inbox', right: 'inbox', dock: true } },
    { panels: { left: true, left_kind: 'unknown', right: 'inbox', dock: true } },
    { panel_homes: defaults, panels: { left: true, left_kind: 'sessions', right: 'items', dock: true } },
  ]) {
    await writeFile(join(c.root, '.cland/ui.json'), JSON.stringify({ ...oldPreferences, ...fields }));
    // Capture the actual status notices at the public notice boundary, not redraw counts.
    const notices = await c.lua(`local s=require('cland.state'); local say=s.say; local notices={}
      s.say=function(text,group) notices[#notices+1]={text=text,group=group}; say(text,group) end
      require('cland.ui').load(s.S.root); s.say=say
      return notices`);
    assert.deepEqual(notices, [{ text: 'ui.json: invalid panel assignments; using default sides', group: 'ClandAmberBar' }]);
    assert.deepEqual(await c.lua("return require('cland.state').S.ui.panel_homes"), defaults);
    const { version: _, ...expected } = oldPreferences;
    assert.deepEqual(await c.lua(readPreferences), { ...expected, panels: { left: true, right: 'sessions', dock: true } });
  }
});

test('restart snapshot and restore keep chosen homes and both visible occupants in-process', { skip }, async t => {
  const c = await startShell(t);
  await place(c, 'sessions', 'left');
  await place(c, 'items', 'right');
  await c.lua(`local s=require('cland.state'); local snap=s.snapshot()
    assert(snap.left_kind=='sessions' and snap.right=='items')
    assert(snap.panel_homes.items=='right' and snap.panel_homes.sessions=='left')
    s.reset({root=s.S.root}); s.restore(snap); require('cland.layout').build({insert=false})`);
  await expectPanel(c, 'left', 'SESSIONS');
  await expectPanel(c, 'right', 'ITEMS');
  assert.equal(await c.lua("return require('cland.layout').panel_home('sessions')"), 'left');
  assert.equal(await c.lua("return require('cland.layout').panel_home('items')"), 'right');
});

test('reset command and palette restore default sides and widths immediately without changing open panels', { skip }, async t => {
  const c = await startShell(t);
  for (const entry of ['command', 'palette']) {
    await place(c, 'sessions', 'left');
    await place(c, 'items', 'right');
    await c.lua(`local u=require('cland.state').S.ui
      u.sizes={left=48,right=46,dock=11}; u.items_filter='work'; u.current_release='T-109'
      require('cland.layout').fix()`);
    if (entry === 'command') await c.input(':Cland panel reset<CR>');
    else {
      await c.input('<Space>p>Reset panel layout');
      await c.waitScreen(s => s.includes('Reset panel layout'), 'reset palette action');
      await c.input('<CR>');
    }
    await expectPanel(c, 'left', 'ITEMS');
    await expectPanel(c, 'right', 'SESSIONS');
    const saved = JSON.parse(await readFile(join(c.root, '.cland/ui.json'), 'utf8'));
    assert.deepEqual(saved.panel_homes, { items: 'left', sessions: 'right', inbox: 'right', topics: 'right' });
    assert.deepEqual(saved.panels, { left: true, left_kind: 'items', right: 'sessions', dock: false });
    assert.deepEqual(saved.sizes, { dock: 11 }, 'dock height is preserved');
    assert.equal(saved.items_filter, 'work');
    assert.equal(saved.current_release, 'T-109');
    assert.deepEqual(await c.lua(`local l=require('cland.layout'); return {
      vim.api.nvim_win_get_width(l.win.left),vim.api.nvim_win_get_width(l.win.right)}`), [35, 40]);
  }
  await c.input('<Space>i<Space>s:Cland panel reset<CR>');
  assert.equal(await panel(c, 'left'), '', 'reset keeps Items hidden');
  assert.equal(await panel(c, 'right'), '', 'reset keeps Sessions hidden');
});

test('reset keeps colliding visible panels and their dock open, then toggles use default homes', { skip }, async t => {
  const c = await startShell(t);
  await place(c, 'sessions', 'left');
  await place(c, 'inbox', 'right');
  await c.input('<Space>T:Cland panel reset<CR>');
  await expectPanel(c, 'left', 'SESSIONS');
  await expectPanel(c, 'right', 'INBOX');
  assert.equal(await c.lua("return require('cland.state').S.ui.dock"), true);
  assert.equal(await c.lua("return require('cland.layout').panel_home('sessions')"), 'right');
  await c.lua("require('cland.ui').load(require('cland.state').S.root); require('cland.layout').build({insert=false})");
  await expectPanel(c, 'left', 'SESSIONS');
  await expectPanel(c, 'right', 'INBOX');
  assert.equal(await c.lua("return require('cland.state').S.ui.dock"), true, 'collision and dock survive reloading the reset file');
  await c.input('<Space>s');
  await expectPanel(c, 'right', 'SESSIONS');
  assert.equal(await panel(c, 'left'), '', 'the next toggle follows the reset home');
});

test('presets keep chosen homes and open their panel set on those homes', { skip }, async t => {
  const c = await startShell(t);
  await place(c, 'sessions', 'left');
  await place(c, 'items', 'right');
  await place(c, 'inbox', 'left');
  await c.input(':Cland preset watch<CR>');
  await expectPanel(c, 'left', 'INBOX');
  await expectPanel(c, 'right', 'ITEMS');
  assert.equal(await c.lua("return require('cland.state').S.ui.dock"), true);
  assert.deepEqual(await c.lua("return require('cland.state').S.ui.panel_homes"), { items: 'right', sessions: 'left', inbox: 'left', topics: 'right' });
  await c.input(':Cland preset charting<CR>');
  await expectPanel(c, 'right', 'ITEMS');
  assert.equal(await panel(c, 'left'), '');
  await c.input(':Cland preset steady<CR>');
  await expectPanel(c, 'left', 'INBOX');
  assert.equal(await panel(c, 'right'), '');
  await place(c, 'inbox', 'right');
  await c.input(':Cland preset watch<CR>');
  await expectPanel(c, 'right', 'INBOX');
  assert.equal(await panel(c, 'left'), '', 'Inbox takes priority when both requested panels share a home');
  assert.equal(await c.lua("return require('cland.layout').panel_home('items')"), 'right');
});

// Read the rendered window, including its winbar, rather than a global title or launch reply.
async function panel(c: Shell, side: 'left' | 'right') {
  return c.lua<string>(`local w = require('cland.layout').win[...]
    if not w or not vim.api.nvim_win_is_valid(w) then return '' end
    return require('cland.bars').winbar(w) .. '\\n' .. table.concat(vim.api.nvim_buf_get_lines(vim.api.nvim_win_get_buf(w), 0, -1, false), '\\n')`, side);
}

async function expectPanel(c: Shell, side: 'left' | 'right', text: string) {
  const rendered = await eventually(`${side} panel contains ${text}`, async () => {
    const textNow = await panel(c, side);
    return textNow.includes(text) ? textNow : undefined;
  });
  assert.ok(rendered.includes(text));
}

async function place(c: Shell, kind: string, side: 'left' | 'right') {
  await c.input(`<Esc>:Cland panel ${kind} ${side}<CR>`);
  await expectPanel(c, side, kind.toUpperCase());
}

for (const [kind, key] of [['items', 'i'], ['inbox', 'n'], ['sessions', 's'], ['topics', 't']]) {
  test(`${kind}: gm and its palette action move the panel; its key toggles on the new home`, { skip }, async t => {
    const c = await startShell(t);
    await place(c, kind!, 'left');
    await c.input('gm');
    await expectPanel(c, 'right', kind!.toUpperCase());
    assert.equal(await panel(c, 'left'), '', 'moving closes the old side');
    await c.input(`<Space>${key}`);
    await eventually('panel hidden on the right', async () => (await panel(c, 'right')) === '' || undefined);
    assert.equal(await panel(c, 'right'), '');
    await c.input(`<Space>${key}`);
    await expectPanel(c, 'right', kind!.toUpperCase());
    const title = `Move ${kind} to the other side`;
    await c.input(`<Space>p>${title}`);
    await c.waitScreen(s => s.includes(title), 'registered move in palette');
    await c.input('<CR>');
    await expectPanel(c, 'left', kind!.toUpperCase());
    assert.equal(await panel(c, 'right'), '', 'palette uses the same move rule');
    await c.input(`<Space>${key}`);
    await eventually('panel hidden on the left', async () => (await panel(c, 'left')) === '' || undefined);
    assert.equal(await panel(c, 'left'), '');
    await c.input(`<Space>${key}<Space>?`);
    await c.waitScreen(s => s.includes(title) && s.includes('gm'), 'move title and key in help');
    assert.deepEqual(await c.lua("return require('cland.actions').audit()"), []);
  });
}

test('top-bar chips reopen Inbox and Sessions on their chosen side, including a vacant Coordinator', { skip }, async t => {
  const c = await startShell(t, s => { s.coordinator = null; });
  await place(c, 'items', 'right');
  for (const [kind, key, chip] of [['inbox', 'n', 2], ['sessions', 's', 3], ['sessions', 's', 1]] as const) {
    await place(c, kind, 'left');
    await c.input(`<Space>${key}`);
    await eventually('left panel hidden before chip click', async () => (await panel(c, 'left')) === '' || undefined);
    await c.lua('ClandTopClick(...)', chip);
    await expectPanel(c, 'left', kind.toUpperCase());
    await expectPanel(c, 'right', 'ITEMS');
    // Clicking again keeps the visible panel open.
    await c.lua('ClandTopClick(...)', chip);
    await expectPanel(c, 'left', kind.toUpperCase());
  }
});

test('gp reopens Items on the right and a scoped palette action reopens Sessions on the left', { skip }, async t => {
  const c = await startShell(t, s => {
    s.items![0] = { ...s.items![0], parent: 'T-2' };
    s.items!.push({ id: 'T-2', kind: 'epic', title: 'Panel homes', state: 'open', plan: null });
  });
  await place(c, 'sessions', 'left');
  await c.input('gg/impl-1<CR><Space>s');
  await c.input('<Space>p>Session adapter capabilities<CR>');
  await c.waitScreen(s => s.includes('capabilities') && s.includes('state signals'), 'scoped palette action ran');
  await expectPanel(c, 'left', 'SESSIONS');
  await c.input('q');
  await place(c, 'items', 'right');
  await c.input('<Space>i:Cland view item T-12<CR>');
  await c.waitScreen(s => statusLine(s).includes('T-12'), 'item view before gp');
  await c.input('gp');
  await c.waitScreen(s => statusLine(s).includes('T-2 · epic plan'), 'gp opens its epic plan');
  await expectPanel(c, 'right', 'ITEMS');
  await expectPanel(c, 'left', 'SESSIONS');
});

test('Normal and Terminal focus chords reach swapped panels from the centre without a harness process', { skip }, async t => {
  const c = await startShell(t);
  await place(c, 'sessions', 'left');
  await place(c, 'items', 'right');
  await c.input(':Cland view board<CR>');
  // An in-memory terminal exercises Terminal-mode mappings at T2; no shell or attach process.
  await c.lua(`local b=vim.api.nvim_create_buf(false,true)
    vim.api.nvim_win_set_buf(require('cland.layout').win.centre,b)
    vim.api.nvim_open_term(b,{})`);
  for (const mode of ['n', 't']) {
    for (const [key, side] of [['h', 'left'], ['l', 'right']]) {
      await c.lua("vim.api.nvim_set_current_win(require('cland.layout').win.centre)");
      await c.input(mode === 't' ? 'i' : '<C-\\><C-n>');
      await eventually(`${mode} ${key} source mode ready`, async () => {
        const actual = await c.mode();
        if (actual[0] !== mode) throw new Error(`mode ${actual}, buffer ${await c.lua('return vim.bo.buftype')}`);
        return true;
      });
      await c.input(`<C-${key}>`);
      await eventually(`${mode} focus ${side}`, async () => await c.lua("return vim.api.nvim_get_current_win() == require('cland.layout').win[...]", side) || undefined);
      assert.equal(await c.lua("return vim.b.cland_role"), side === 'left' ? 'sessions' : 'items');
    }
  }
});

test('palette and command place each of the four panels on either side', { skip }, async t => {
  const c = await startShell(t);
  await c.input('<Esc><Space>p>sessions panel');
  await c.waitScreen(s => s.includes('Toggle sessions panel'), 'legacy toggle title query');
  await c.input('<CR>');
  await c.waitScreen(s => !s.includes('SESSIONS'), 'legacy title query toggles Sessions off');
  assert.deepEqual(await c.lua("return require('cland.qa').state().panels"), { left: false, dock: false, kinds: {} });
  for (const kind of ['items', 'inbox', 'sessions', 'topics']) {
    for (const side of ['left', 'right'] as const) {
      const title = `${kind[0]!.toUpperCase()}${kind.slice(1)} on the ${side}`;
      await c.input(`<Esc><Space>p>${title}`);
      await c.waitScreen(s => s.includes(title), title + ' offered in palette');
      await c.input('<CR>');
      await c.waitScreen(s => !s.includes(title) && s.includes(kind.toUpperCase()), title + ' applied');
      assert.match(await panel(c, side), new RegExp(kind.toUpperCase()));
      const other = side === 'left' ? 'right' : 'left';
      await place(c, kind, other);
      await place(c, kind, side);
    }
  }
});

test('swapped Sessions and Items repaint their rows after session.state and task frames', { skip }, async t => {
  const c = await startShell(t);
  await place(c, 'sessions', 'left');
  await c.input('gg/impl-1<CR>');
  await expectPanel(c, 'left', 'waiting for human');
  await place(c, 'items', 'right');
  await c.input('6/unscheduled (<CR>za');
  await expectPanel(c, 'right', 'Hub daemon');
  await c.control({ emit: { type: 'session.state', session: 'impl-1', sessionId: 'impl-1-id', state: 'waiting for approval', source: 'hook', ts: ts(5) } });
  await expectPanel(c, 'left', 'waiting for approval');
  const item = { ...baseScenario('').items![0], title: 'Changed live row' };
  await c.control({ emit: { type: 'task', id: 'T-12', item } });
  await expectPanel(c, 'right', 'Changed live row');
  assert.deepEqual(await c.lua("return require('cland.qa').state().panels"), {
    left: true, right: 'items', dock: false, kinds: { left: 'sessions', right: 'items' },
  });
});

test('moving a panel clears its old side; replacing one on a shared home keeps both homes', { skip }, async t => {
  const c = await startShell(t);
  await place(c, 'sessions', 'left');
  assert.equal(await panel(c, 'right'), '', 'moving Sessions removes the old window');
  await place(c, 'items', 'left');
  await c.input('<Space>s');
  await expectPanel(c, 'left', 'SESSIONS');
  assert.equal(await panel(c, 'right'), '');
  await c.input('<Space>i');
  await expectPanel(c, 'left', 'ITEMS');
  await place(c, 'items', 'right');
  assert.equal(await panel(c, 'left'), '', 'Items is never displayed twice');
  await c.input('<Space>i');
  await eventually('Items hidden on its new home', async () => (await panel(c, 'right')) === '' || undefined);
  await c.input('<Space>i');
  await expectPanel(c, 'right', 'ITEMS');
  // Topics may also occupy the legacy dock. Explicit placement removes that duplicate.
  await c.input('<Space>T');
  await c.waitScreen(s => s.includes('TOPICS') && s.includes('ITEMS'), 'topics dock above the existing panel');
  await place(c, 'topics', 'left');
  assert.equal(await c.lua("return require('cland.qa').state().panels.dock"), false);
  assert.equal(await c.lua("return require('cland.layout').win.dock == nil"), true);
});

test('native closes clear only their side and rebuilding a sole centre keeps swapped panels', { skip }, async t => {
  const c = await startShell(t);
  for (const side of ['left', 'right'] as const) {
    for (const close of [':q<CR>', '<C-w>c']) {
      await place(c, 'sessions', 'left');
      await place(c, 'items', 'right');
      await c.lua("vim.api.nvim_set_current_win(require('cland.layout').win[...])", side);
      await c.input(close);
      await eventually(`${side} native close repaired`, async () => {
        const p = await c.lua<{ left: boolean; right?: string }>("return require('cland.qa').state().panels");
        return side === 'left' ? p.left === false || undefined : p.right === undefined || undefined;
      });
      assert.equal(await panel(c, side), '');
      await expectPanel(c, side === 'left' ? 'right' : 'left', side === 'left' ? 'ITEMS' : 'SESSIONS');
    }
  }
  await place(c, 'sessions', 'left');
  await place(c, 'items', 'right');
  await c.input(':Cland view board<CR>');
  await c.waitScreen(s => s.includes('Board ·'), 'sole centre is the board');
  const oldCentre = await c.lua<number>("return require('cland.layout').win.centre");
  await c.lua("vim.api.nvim_set_current_win(require('cland.layout').win.centre)");
  await c.input('<C-w>c');
  await eventually('centre is recreated with its board buffer', async () => await c.lua(`local l=require('cland.layout')
    local w=l.win.centre
    return w ~= ... and w ~= nil and vim.api.nvim_win_is_valid(w) and vim.b[vim.api.nvim_win_get_buf(w)].cland_role == 'board'`, oldCentre) || undefined);
  await expectPanel(c, 'left', 'SESSIONS');
  await expectPanel(c, 'right', 'ITEMS');
});

test('Sessions keys on the left and Items filters, folds and Enter on the right retain their context', { skip }, async t => {
  // Refuse attach at the stub edge: the T2 assertion is row routing to the centre,
  // while real terminal attachment is already covered at T3 by shell.test.ts.
  const c = await startShell(t, s => { s.attach = {}; });
  await place(c, 'sessions', 'left');
  await c.input('gg/impl-1<CR>c');
  await c.waitScreen(s => s.includes('capabilities') && s.includes('state signals'), 'Sessions c opens capabilities');
  await c.input('q');
  await c.input('x');
  await expectPanel(c, 'left', 'stop impl-1?');
  await c.input('n');
  await eventually('stop confirmation cancelled', async () => !(await panel(c, 'left')).includes('stop impl-1?') || undefined);
  await c.input('gg/impl-1<CR>');
  await c.lua("assert(require('cland.panels').row_at(vim.api.nvim_get_current_buf(), vim.api.nvim_win_get_cursor(0)[1]).session == 'impl-1')");
  await c.input('<CR>');
  await c.waitScreen(s => s.includes('cannot attach impl-1'), 'Sessions Enter opens the selected session in centre');
  assert.deepEqual(await c.lua("return require('cland.qa').state().view"), { kind: 'session', id: 'impl-1' });
  await place(c, 'items', 'right');
  for (const [digit, label] of ['board', 'in work', 'needs you', 'done', 'map', 'all'].entries()) {
    await c.input(String(digit + 1));
    await expectPanel(c, 'right', label + ' ·');
  }
  await c.input('/unscheduled (<CR>za');
  await expectPanel(c, 'right', 'T-13 Codex');
  await c.input('/T-13<CR><CR>');
  await c.waitScreen(s => statusLine(s).includes('T-13') && s.includes('Codex adapter'), 'Items Enter opens its selected item');
  assert.deepEqual(await c.lua("return require('cland.qa').state().view"), { kind: 'item', id: 'T-13' });
});

test('Inbox digits and Topics n work on the left', { skip }, async t => {
  const c = await startShell(t, s => {
    s.inbox = { asks: [{ id: 'placement-ask', topic: { id: 'general', title: 'General' }, question: 'Choose a side',
      options: ['left', 'right'], free: true, from: 'coord-1', ts: ts(1) }] };
  });
  await place(c, 'inbox', 'left');
  // The question is clipped at the left side's default width; select its visible topic.
  await c.input('gg/General<CR>');
  await c.input('2');
  await c.waitScreen(s => statusLine(s).includes('answered with 2'), 'left Inbox answers the ask');
  assert.equal((await requestsOf(c, 'topic.answer')).at(-1)?.option, 2);
  await place(c, 'topics', 'left');
  await c.input('nFrom left panel<CR>');
  await c.waitScreen(s => s.includes('From left panel') && s.includes('to: Coordinator'), 'new topic opens in centre');
  assert.equal((await requestsOf(c, 'topic.create')).at(-1)?.title, 'From left panel');
});
