// T2: real headless Neovim renders an open-only recorded snapshot, without a hub.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { tempProject, eventually } from './fixture.ts';
import { nvimOrSkip, startClient } from './stub-client.ts';
import { waitInitialSnapshots } from './readiness.ts';
import type { Scenario } from './stub-hub.ts';

const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';
const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));
const work = { 'in progress': 0, review: 0, qa: 0 };
const task = (id: number, parent: string, status: string, extra = {}) => ({
  id: `T-${id}`, kind: 'task', title: `Child ${id}`, parent, status,
  state: status === 'done' ? 'closed' : 'open', ...extra,
});
const fixture: Scenario = { summaryLists: true, items: [
  { id: 'R-1', kind: 'release', title: 'Progress release', state: 'open',
    child_counts: { total: 4, done: 1, statuses: { done: 1, 'in progress': 1, backlog: 1, planned: 1 }, work: { ...work, 'in progress': 1 } } },
  { id: 'E-2', kind: 'epic', title: 'Mixed progress', parent: 'R-1', state: 'open', open_blockers: [], blocked_by: ['T-99'],
    child_counts: { total: 5, done: 2, statuses: { done: 2, 'in progress': 1, backlog: 1, planned: 1 }, work: { ...work, 'in progress': 1 } } },
  { id: 'E-3', kind: 'epic', title: 'Completed children', parent: 'R-1', state: 'open', open_blockers: ['T-12'], blocked_by: ['T-12'],
    child_counts: { total: 2, done: 2, statuses: { done: 2 }, work } },
  { id: 'E-4', kind: 'epic', title: 'Closed epic', parent: 'R-1', state: 'closed',
    child_counts: { total: 1, done: 1, statuses: { done: 1 }, work } },
  { id: 'E-5', kind: 'epic', title: 'Planned epic', parent: 'R-1', state: 'open',
    child_counts: { total: 1, done: 0, statuses: { planned: 1 }, work } },
  task(10, 'E-2', 'done'), task(11, 'E-2', 'done'), task(12, 'E-2', 'in progress'),
  task(13, 'E-2', 'backlog', { blocked_by: ['T-99'], open_blockers: [] }),
  task(14, 'E-2', 'planned', { blocked_by: ['T-12'], open_blockers: ['T-12'] }),
  task(15, 'E-3', 'done'), task(16, 'E-3', 'done'), task(17, 'E-4', 'done'), task(18, 'E-5', 'planned'),
  task(19, 'R-1', 'planned'), task(20, 'R-1', 'done'), task(99, '', 'done'),
  { id: 'C-30', kind: 'category', title: 'Ideas', state: 'open',
    child_counts: { total: 2, done: 1, statuses: { done: 1, backlog: 1 }, work } },
  task(31, 'C-30', 'done'), task(32, 'C-30', 'backlog'),
] };

async function start(t: test.TestContext, scenario = fixture) {
  const root = await tempProject(t);
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio',
    CLAND_COMMAND: JSON.stringify([process.execPath, STUB]), CLAND_STUB_SCENARIO_JSON: JSON.stringify(scenario) });
  await waitInitialSnapshots(c);
  await c.input('<Esc><Space>i');
  await c.lua("local l=require('cland.layout'); vim.api.nvim_win_set_width(l.win.left,90)");
  return c;
}

test('board fractions and header include closed children before loading closed rows', { skip }, async t => {
  const c = await start(t);
  await c.waitScreen(s => s.includes('Mixed progress') && s.includes('Completed children'), 'board container rows');
  const board = await c.lua<string>("return table.concat(vim.api.nvim_buf_get_lines(require('cland.panels').buf('items'),0,-1,false),'\\n')");
  assert.match(board, /R-1 Progress release[^\n]*1\/4/);
  assert.match(board, /E-2 Mixed progress[^\n]*2\/5/);
  assert.match(board, /E-3 Completed children[^\n]*2\/2/);
  assert.match(board, /E-5 Planned epic[^\n]*0\/1/);
  assert.match(board, /Direct tasks \(1 loaded\)[^\n]*0\/1 loaded/);
  assert.match((await c.screen()).join('\n'), /board · epics: 2 in work · 1 done/);
  assert.doesNotMatch(board, /Closed epic|Child 1[01567]|Child 20/);
  assert.equal(await c.lua("return require('cland.state').S.closed_items_loaded"), false);
  await c.input('p');
  await c.waitScreen(s => s.includes('epic all · E-2') && s.includes('IN PROGRESS'), 'epic board');
  assert.match((await c.screen()).join('\n'), /board · 2 in work · 2 done/);
});

test('release and epic cards preserve aggregate progress and open blocker counts across wrapped resizes', { skip }, async t => {
  const c = await start(t);
  // Force the setup's manual 90-column panel resize to be recorded before the
  // screen expands. This used to depend on when WinResized ran. Steady removes
  // that panel so the responsive right-slot card cannot constrain 72 to 50.
  await c.lua("local l=require('cland.layout'); l.flush_resize(); l.preset('steady')");
  await c.rpc.request('nvim_ui_try_resize', 260, 50);
  await c.input(':Cland explorer R-1<CR>');
  await eventually('release explorer rows', async () => {
    const observed = await c.lua<{ scope: string | false; tree: boolean; rows: string[] }>(`local e=require('cland.explorer'); local w=e.tree_win()
      return {view=require('cland.state').S.ui.view, scope=e.drawn_scope or false,
        tree=w~=-1, rows=e.lines or {}}`);
    assert.ok(observed.scope === 'R-1' && observed.tree
      && observed.rows.some(line => line.includes('Mixed progress'))
      && observed.rows.some(line => line.includes('Completed children')), JSON.stringify(observed));
    return observed;
  }, 1000);
  for (const [id, fraction, breakdown, width] of [
    ['R-1', '1 of 4 done', '1 done · 1 in progress · 1 planned · 1 backlog, 1 blocked', 72],
    ['R-1', '1 of 4 done', '1 done · 1 in progress · 1 planned · 1 backlog, 1 blocked', 42],
    ['E-2', '2 of 5 done', '2 done · 1 in progress · 1 planned · 1 backlog, 1 blocked', 42],
    ['E-3', '2 of 2 done', '2 done', 42],
  ] as const) {
    const counts = fixture.items!.find(it => it.id === id)!.child_counts;
    // Arm the observation before selection/resize. A drawn_key alone can still
    // name a render from the previous geometry; observe the progress itself.
    const drawn = eventually('aggregate progress rendered for ' + id + ' at width ' + width, async () => {
      const observed = await c.lua<{ counts: boolean; selected: string | false; key: string | false;
        drawn: string | false; width: number | false; lines: string[] }>(`
        local id, counts=...; local e=require('cland.explorer'); local card=e.card
        local it=require('cland.state').item(id); local w=e.tree_win()
        local valid=card.win and vim.api.nvim_win_is_valid(card.win)
        return {counts=it~=nil and vim.deep_equal(it.child_counts,counts),
          selected=w~=-1 and e.key_at(vim.api.nvim_win_get_cursor(w)[1]) or false,
          key=card.key or false, drawn=card.drawn_key or false,
          width=valid and vim.api.nvim_win_get_width(card.win) or false,
          lines=valid and vim.api.nvim_buf_get_lines(vim.api.nvim_win_get_buf(card.win),0,-1,false) or {}}
      `, id, counts);
      const diagnostic = JSON.stringify(observed);
      assert.ok(observed.counts && observed.selected === id && observed.key === id
        && observed.drawn === id && observed.width === width, diagnostic);
      const progress = observed.lines.join('\n').split('\nPROGRESS\n')[1]?.split('\n\n')[0];
      assert.ok(progress, diagnostic);
      const text = progress.replace(/\s+/g, ' ').trim();
      assert.ok(text.includes(fraction) && text.includes(breakdown), diagnostic);
      if (id === 'R-1' && width === 42) assert.ok(!progress.includes(breakdown), diagnostic);
      return { text, progress };
    }, 1000);
    await c.lua("local width=...; local e=require('cland.explorer'); e.ui().card_width=width; e.sync(e.tree_win())", width);
    await c.lua(`local id=...; local e=require('cland.explorer'); local w=e.tree_win(); vim.api.nvim_set_current_win(w);
      for n,row in ipairs(e.rows) do if row.key==id then vim.api.nvim_win_set_cursor(w,{n,0}); return end end; error('missing '..id)`, id);
    const { text, progress } = await drawn;
    assert.ok(text.includes(fraction), progress);
    assert.ok(text.includes(breakdown), progress);
    if (id === 'R-1' && width === 42) assert.ok(!progress.includes(breakdown), 'narrow card must exercise a wrapped breakdown');
  }
  assert.equal(await c.lua("return require('cland.state').item('T-10') ~= nil"), false);
  assert.equal(await c.lua("return require('cland.state').S.closed_items_loaded"), false);
});

test('a release with only unloaded closed epics does not count blocked direct tasks as progress members', { skip }, async t => {
  const c = await start(t, { summaryLists: true, items: [
    { id: 'R-1', kind: 'release', title: 'Completed release', state: 'open',
      child_counts: { total: 1, done: 1, statuses: { done: 1 }, work } },
    { id: 'E-2', kind: 'epic', title: 'Closed epic', parent: 'R-1', state: 'closed',
      child_counts: { total: 1, done: 1, statuses: { done: 1 }, work } },
    task(10, 'E-2', 'done'),
    task(19, 'R-1', 'planned', { blocked_by: ['T-98'], open_blockers: ['T-98'] }),
  ] });
  await c.rpc.request('nvim_ui_try_resize', 260, 50);
  await c.input(':Cland explorer R-1<CR>');
  await eventually('completed release card drawn', async () => await c.lua<boolean>(
    "local e=require('cland.explorer'); return e.card.key=='R-1' and e.card.drawn_key=='R-1'") || undefined);
  const text = await c.lua<string>("return table.concat(require('cland.explorer').card.lines,'\\n')");
  assert.match(text, /1 of 1 done/);
  assert.doesNotMatch(text, /blocked\n|\d+ blocked/);
  assert.equal(await c.lua("return require('cland.state').item('E-2') ~= nil"), false);
  assert.equal(await c.lua("return require('cland.state').S.closed_items_loaded"), false);
});

test('scoped release details and category rows count the aggregate child level', { skip }, async t => {
  const c = await start(t);
  await c.rpc.request('nvim_ui_try_resize', 260, 50);
  await c.input(':Cland explorer R-1<CR>');
  await c.waitScreen(s => s.includes('Mixed progress') && s.includes('Direct tasks ('), 'scoped release details');
  const tree = () => c.lua<string>("local e=require('cland.explorer'); return table.concat(vim.api.nvim_buf_get_lines(e.b,0,-1,false),'\\n')");
  assert.match(await tree(), /epics 1\/4/);
  await c.input(':Cland explorer C-30<CR>');
  await c.waitScreen(s => s.includes('C-30 Ideas'), 'expanded category row');
  assert.match(await tree(), /C-30 Ideas[^\n]*1 open · 1 done/);
  assert.equal(await c.lua("return require('cland.state').S.closed_items_loaded"), false);
});

test('graph container badges and plan panel fractions include unloaded closed children', { skip }, async t => {
  const c = await start(t);
  await c.input(':Cland graph R-1<CR>');
  await c.waitScreen(s => s.includes('Mixed progress') && s.includes('in work'), 'graph container badges');
  const graph = await c.lua<string>("return table.concat(vim.api.nvim_buf_get_lines(require('cland.graph').b,0,-1,false),'\\n')");
  assert.match(graph, /2\/5 · 1 in work/);
  assert.match(graph, /2\/2 · 0 in work/);
  const planPanel = eventually('anchored plan panel header and metadata', async () => await c.lua<boolean>(`
    local p=require('cland.panels'); local b=p.buf('items'); if not b then return false end
    local row=p.row_at(b,1); local section=p.row_at(b,2)
    local line=vim.api.nvim_buf_get_lines(b,0,1,false)[1] or ''
    return row and row.item=='E-2' and not row.fold and section and section.section=='in progress'
      and line:match('^ E%-2 Mixed progress%s')~=nil`) || undefined);
  await c.input(':Cland view plan E-2<CR>');
  await planPanel;
  const panel = await c.lua<string>("return table.concat(vim.api.nvim_buf_get_lines(require('cland.panels').buf('items'),0,-1,false),'\\n')");
  assert.match(panel, /^ E-2 Mixed progress[^\n]*2\/5/);
  assert.equal(await c.lua("return require('cland.state').S.closed_items_loaded"), false);
});

test('the plan workflow summary labels loaded counts and omits unloaded closed stage members', { skip }, async t => {
  const c = await start(t, { ...fixture, items: fixture.items!.map(it => it.id === 'E-2' ? { ...it,
    plan: { stages: [{ name: 'Current', lanes: [['T-10', 'T-12', 'T-14']], qa: { scope: 'none', when: 'per-item' } }] },
    stages: [{ name: 'Current', items: ['T-10', 'T-12', 'T-14'], state: 'open' }],
  } : it) });
  await c.rpc.request('nvim_ui_try_resize', 300, 50);
  await c.input(':Cland view plan E-2<CR>');
  await c.waitScreen(s => s.includes('PROGRESS · stage 1 of 1'), 'plan workflow summary');
  const text = await c.lua<string>("return table.concat(vim.api.nvim_buf_get_lines(require('cland.plan').bufs['E-2'],0,-1,false),'\\n')");
  assert.match(text, /loaded:/);
  assert.match(text, /1 planned/);
  assert.doesNotMatch(text, /2 planned/);
  assert.equal(await c.lua("return require('cland.state').item('T-10') ~= nil"), false);
});
