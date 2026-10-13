// The vertical board at the Neovim/stub-hub frame boundary.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConnection } from 'node:net';
import { ownDirectory } from '../../hub/test/process-cleanup.ts';
import { nvimOrSkip, startClient } from './harness.ts';
import type { Scenario } from './stub-hub.ts';
const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';
const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));
const task = (id: number, status: string, parent = 'T-2', extra = {}) => ({ id: `T-${id}`, kind: 'task', title: `Row ${id}`, status, state: status === 'done' ? 'closed' : 'open', parent, rank: id * 10, blocked_by: [], file: `T-${id}.md`, body: '- [x] Outside\n## Acceptance criteria\n- [x] C1. First\n  - verified: rev-1 [reviewer] · run r-1 · 2026-10-10T10:00Z\n### Details\n- [ ] Second\n## Notes\n- [x] Outside too', ...extra });
const fixture: Scenario = {
  items: [
    { id: 'T-1', kind: 'release', title: 'Current release', version: '0.1.0', state: 'open' },
    { id: 'T-2', kind: 'epic', title: 'Panels', parent: 'T-1', rank: 20, state: 'open' },
    { id: 'T-3', kind: 'epic', title: 'Tracker', parent: 'T-1', rank: 10, state: 'open' },
    { id: 'T-4', kind: 'release', title: 'Future release', version: '0.2.0', state: 'open' },
    task(10, 'in progress', 'T-2', { claim: { session: 'impl-10' }, verdicts: [{ verdict: 'review', result: 'not clear' }] }),
    task(11, 'review'), task(12, 'qa'), task(13, 'ready', 'T-2', { body: '## Acceptance criteria\n- [X] C1. Done\n  - verified: rev-1 [reviewer] · run r-1 · 2026-10-10T10:00Z' }),
    task(14, 'planned', 'T-2', { rank: 10, blocked_by: ['T-10'] }), task(15, 'planned', 'T-2', { rank: 20 }),
    task(16, 'planned', 'T-3'), task(17, 'backlog'), task(18, 'done'), task(19, 'planned', 'T-4'),
    task(20, 'planned', ''),
  ]
};
async function start(t: TestContext, scenario = fixture) {
  const root = await mkdtemp(join(tmpdir(), 'cland-vboard-')); ownDirectory(t, root); await mkdir(join(root, '.git'));
  const controlPath = join(root, 'stub.sock');
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]), CLAND_STUB_SCENARIO_JSON: JSON.stringify({ inbox: {}, ...scenario }), CLAND_STUB_CONTROL: controlPath });
  await c.waitScreen(s => s.includes('hub: connected'), 'connected');
  await c.input('<Esc><Space>i');
  await c.lua("local l=require('cland.layout'); vim.api.nvim_win_set_width(l.win.left,76)");
  return Object.assign(c, {
    root, control: (cmd: Record<string, unknown>) => new Promise<Record<string, unknown>>((resolve, reject) => {
      const sock = createConnection(controlPath); let text = ''; sock.setEncoding('utf8'); sock.on('error', reject);
      sock.on('data', chunk => { text += chunk; if (text.includes('\n')) { sock.end(); resolve(JSON.parse(text.slice(0, text.indexOf('\n')))); } });
      sock.write(JSON.stringify(cmd) + '\n');
    })
  });
}
const panel = (c: Awaited<ReturnType<typeof start>>) => c.lua<string[]>("return vim.api.nvim_buf_get_lines(require('cland.panels').buf('items'),0,-1,false)");
const categories: Scenario = {
  tracker: { levels: ['release', 'category', 'epic'], ladder: [['release', 'category'], ['epic']] },
  items: [
    { id: 'R-228', kind: 'release', title: 'Working with items', version: '0.1.2', state: 'open' },
    { id: 'E-269', kind: 'epic', title: 'Prefixes and categories', parent: 'R-228', state: 'open' },
    task(318, 'planned', 'E-269'),
    { id: 'C-216', kind: 'category', title: 'Tech debt', state: 'open' },
    { id: 'C-400', kind: 'category', title: 'Ideas', state: 'open' },
    { id: 'C-401', kind: 'category', title: 'Archived category', state: 'closed' },
    { id: 'E-402', kind: 'epic', title: 'Debt epic', parent: 'C-216', state: 'open' },
    task(403, 'backlog', 'E-402', { rank: 20 }),
    task(404, 'backlog', 'C-216', { rank: 10 }),
    task(405, 'done', 'C-216'),
    task(406, 'backlog', 'C-401'),
    task(408, 'planned', ''), task(409, 'review', ''),
  ],
};

test('release versions appear once in the scope, all tree, top bar and item header', { skip }, async t => {
  for (const [title, version, heading, kind = 'release', id = 'R-228'] of [
    ['Working with items', '0.1.2', 'R-228 0.1.2 Working with items'],
    ['v0.1.1', '0.1.1', 'R-228 v0.1.1'],
    ['0.1.0', '0.1.0', 'R-228 0.1.0'],
    ['Unversioned', undefined, 'R-228 Unversioned'],
    ['Configured release', '0.3.0', 'I-228 0.3.0 Configured release', 'initiative', 'I-228'],
  ] as const) {
    await t.test(title, async t => {
      const c = await start(t, { tracker: { levels: [kind, 'epic'] }, items: [
        { id, kind, title, version, state: 'open', file: `${id}-release.md` },
        { id: 'E-269', kind: 'epic', title: 'Prefixes and categories', state: 'open', parent: id },
      ] });
      const screen = await c.waitScreen(s => s.includes('board ·'), 'release scope');
      assert.ok(screen.split('\n')[0]!.includes(heading), 'top bar: ' + screen.split('\n')[0]);
      assert.ok(screen.split('\n').slice(1).some(row => row.split('│')[0]!.trim().startsWith(heading + ' ')), 'scope header: ' + screen);
      await c.input('6');
      const tree = await c.waitScreen(s => s.includes('all · 2 items'), 'all tree');
      assert.ok(tree.split('\n').some(row => row.split('│')[0]!.includes('○ ' + heading)), 'tree: ' + tree);
      assert.ok(tree.includes('E-269 Prefixes and categories'), 'other kinds keep their titles');
      await c.input(`:Cland view item ${id}<CR>`);
      const item = await c.waitScreen(s => s.includes(`${id} · item`) && s.includes(`.cland/tasks/${id}-release.md`), 'release item view');
      assert.ok(item.split('\n').slice(1).some(row => row.split('│')[1]?.trim() === heading), 'item header: ' + item);
      if (title === 'v0.1.1' || title === '0.1.0') {
        assert.ok(!item.includes(`${version} ${title}`), 'a version-only title is never repeated');
      }
    });
  }
});

test('release scope ends with live counts of open categories and their open descendants', { skip }, async t => {
  const c = await start(t, categories);
  const screen = await c.waitScreen(s => s.includes('categories 2 · 3 open · unscheduled 2'), 'category count line');
  assert.match(screen, /R-228 0.1.2 Working with items/);
  assert.match(screen, /T-318 E-269 › Row 318/);
  const lines = await panel(c);
  assert.equal(lines.filter(line => line.trim()).at(-3)?.trim(), 'categories 2 · 3 open · unscheduled 2', 'last content row before the two footer lines');
  await c.control({ emit: { type: 'task', id: 'T-407', item: task(407, 'backlog', 'E-402') } });
  await c.waitScreen(s => s.includes('categories 2 · 4 open · unscheduled 2'), 'new descendant increments the count');
  for (const key of ['2', '1']) {
    await c.input(key);
    await c.waitScreen(s => s.includes(key === '2' ? 'in work ·' : 'board ·'), 'filter changed');
    assert.match((await panel(c)).join('\n'), /categories 2 · 4 open · unscheduled 2/);
  }
  for (const [key, label] of [['gn', 'now'], ['gw', 'watch'], ['gb', 'background'], ['gA', 'archive']]) {
    await c.input(key!);
    await c.waitScreen(s => s.includes(label! + ' ·') && s.includes('categories 2 · 4 open · unscheduled 2'), 'category counts under the layer filter');
  }
  for (const key of ['3', '4', '5']) {
    await c.input(key);
    await c.waitScreen(s => s.includes(({ '3': 'needs you', '4': 'DONE ·', '5': 'map ·' })[key]!), 'filter without categories');
    assert.doesNotMatch((await panel(c)).join('\n'), /categories \d/);
  }
  await c.input('1');
  await c.waitScreen(s => s.includes('categories 2 · 4 open · unscheduled 2'), 'release board restored');
  for (const id of ['C-216', 'C-400']) {
    const item = { ...categories.items!.find(it => it.id === id), state: 'closed' };
    await c.control({ emit: { type: 'task', id, item } });
  }
  await c.waitScreen(s => !s.includes('categories 2 · 4 open · unscheduled 2') && !s.includes('categories 1 ·'), 'no open category hides the category part');
  assert.match((await panel(c)).join('\n'), /unscheduled 2/);
});

test('release board/work/done exclude categories and loose items; a parent event lowers the loose count', { skip }, async t => {
  const c = await start(t, categories);
  for (const [key, label] of [['1', 'board · 1 in work · 0 done'], ['2', 'in work · 1'], ['4', 'DONE · 0']]) {
    await c.input(key!);
    const screen = await c.waitScreen(s => s.includes(label!), 'scoped ' + key);
    assert.doesNotMatch(screen, /Row 40[34589]|unscheduled \(/);
  }
  await c.input('1');
  const moved = task(408, 'planned', 'E-269');
  await c.control({ set: { items: categories.items!.map(it => it.id === 'T-408' ? moved : it) } });
  await c.control({ emit: { type: 'task', id: 'T-408', item: moved } });
  await c.waitScreen(s => s.includes('T-408 E-269 › Row 408') && s.includes('categories 2 · 3 open · unscheduled 1'), 'parent event moves the row and count together');
  assert.equal(await c.lua("return require('cland.state').item('T-408').parent"), 'E-269');
});

test('count line omits zero parts and disappears when both groups are empty', { skip }, async t => {
  const c = await start(t, categories);
  for (const id of ['T-408', 'T-409']) await c.control({ emit: { type: 'task', id, item: null } });
  await c.waitScreen(s => s.includes('categories 2 · 3 open') && !s.includes('unscheduled 2'), 'no unscheduled part');
  assert.equal((await panel(c)).filter(line => line.trim()).at(-3)?.trim(), 'categories 2 · 3 open');
  for (const id of ['E-402', 'T-403', 'T-404']) await c.control({ emit: { type: 'task', id, item: null } });
  await c.waitScreen(s => s.includes('categories 2') && !s.includes('3 open'), 'empty categories omit the open part');
  assert.equal((await panel(c)).filter(line => line.trim()).at(-3)?.trim(), 'categories 2');
  for (const id of ['C-216', 'C-400']) await c.control({ emit: { type: 'task', id, item: { ...categories.items!.find(it => it.id === id), state: 'closed' } } });
  await c.waitScreen(s => !s.includes('categories 2') && !s.includes('categories 1'), 'both groups empty');
  assert.doesNotMatch((await panel(c)).join('\n'), /categories \d|unscheduled \d/);
  await c.control({ emit: { type: 'task', id: 'T-408', item: task(408, 'planned', '') } });
  await c.waitScreen(s => s.includes('unscheduled 1'), 'unscheduled-only line');
  assert.equal((await panel(c)).filter(line => line.trim()).at(-3)?.trim(), 'unscheduled 1');
  await c.input('/unscheduled 1<CR><CR>');
  await c.waitScreen(s => s.includes('all ·') && s.includes('▸ unscheduled (1)'), 'unscheduled-only Enter reaches all');
  assert.match(String(await c.lua('return vim.api.nvim_get_current_line()')), /^ unscheduled 1$/);
});

test('without an open release the board keeps its unscheduled view', { skip }, async t => {
  const c = await start(t, { items: [task(1, 'planned', ''), task(2, 'review', '')] });
  const screen = await c.waitScreen(s => s.includes('no open container: unscheduled') && s.includes('unscheduled (2)'), 'no-release fallback');
  assert.doesNotMatch(screen, /categories \d/);
  await c.input('/unscheduled (<CR>za');
  await c.waitScreen(s => s.includes('Row 1') && s.includes('Row 2'), 'fallback loose tasks unfolded');
});

test('category roots follow the configured ladder and the count line belongs only to release scope', { skip }, async t => {
  const c = await start(t, {
    tracker: { levels: ['release', 'initiative', 'epic'], ladder: [['release', 'initiative'], ['epic']] },
    items: [
      { id: 'R-1', kind: 'release', title: 'Release', version: '0.1.2', state: 'open' },
      { id: 'E-2', kind: 'epic', title: 'Epic scope', parent: 'R-1', state: 'open' },
      { id: 'I-3', kind: 'initiative', title: 'Root peer', state: 'open' },
      task(4, 'backlog', 'I-3'),
    ],
  });
  await c.waitScreen(s => s.includes('categories 1 · 1 open'), 'custom root kind counted');
  await c.input('e');
  await c.waitScreen(s => s.includes('E-2 Epic scope') && !s.includes('categories 1 · 1 open'), 'epic scope without count line');
  await c.input('6');
  await c.waitScreen(s => s.includes('all · 4 items') && s.includes('I-3 Root peer'), 'all under epic scope retains the ordinary tree');
  assert.doesNotMatch((await panel(c)).join('\n'), /categories \d/);
});

test('Enter reaches folded categories in all, za reveals ranked open items, and help lists the action', { skip }, async t => {
  const c = await start(t, categories);
  await c.waitScreen(s => s.includes('categories 2 · 3 open · unscheduled 2'), 'count line before navigation');
  await c.input('/categories 2<CR><CR>');
  const screen = await c.waitScreen(s => s.includes('all ·') && /▸ ○ C-216 Tech debt +3 open/.test(s), 'folded categories under all');
  assert.match(screen, /▸ ○ C-400 Ideas +0 open/);
  assert.doesNotMatch(screen, /Row 40[345]/);
  assert.match(String(await c.lua('return vim.api.nvim_get_current_line()')), /categories 2 · 3 open · unscheduled 2/, 'cursor on the categories heading');
  await c.input('/unscheduled (<CR>za');
  const loose = await c.waitScreen(s => s.includes('Row 408') && s.includes('Row 409'), 'unscheduled unfolded under all');
  assert.ok(loose.indexOf('unscheduled (2)') > loose.indexOf('C-400 Ideas'), 'unscheduled follows categories');
  await c.input('za/C-216<CR>za');
  const expanded = await c.waitScreen(s => /▾ ○ C-216 Tech debt/.test(s) && s.includes('T-403 Row 403'), 'category unfolded');
  assert.ok(expanded.indexOf('T-404 Row 404') < expanded.indexOf('T-403 Row 403'), 'open descendants follow rank');
  assert.doesNotMatch(expanded, /T-405 Row 405/, 'closed items stay out of the open section');
  assert.match(String(await c.lua('return vim.api.nvim_get_current_line()')), /C-216 Tech debt/, 'cursor follows the category fold');
  await c.input('za');
  await c.waitScreen(s => /▸ ○ C-216 Tech debt/.test(s) && !s.includes('T-403 Row 403'), 'category folded again');
  await c.input('<Space>?');
  await c.waitScreen(s => s.includes('Open row or show categories in all'), 'Enter action in key help');
  await c.input('q<Space>p>Open row or show categories');
  await c.waitScreen(s => s.includes('Open row or show categories in all') && s.includes('↵ in items'), 'Enter action in palette');
});
test('release board excludes legacy trees and done orphans; all reveals every item at 80 and 120 columns', { skip }, async t => {
  const scenario: Scenario = { items: [
    { id: 'T-130', kind: 'release', title: 'Current release', version: '0.1.0', state: 'open' },
    { id: 'T-107', kind: 'epic', title: 'Current epic', parent: 'T-130', state: 'open' },
    task(167, 'planned', 'T-107'), task(168, 'done', 'T-107'),
    { id: 'T-140', kind: 'release', title: 'Archived release', version: '0.0.1', state: 'closed' },
    task(141, 'planned', 'T-140'), task(142, 'done', 'T-140'),
    { id: 'T-19', kind: 'epic', title: 'Old epic', state: 'open' },
    { id: 'T-20', kind: 'epic', title: 'Old followups', state: 'open' },
    task(21, 'done', 'T-19'), task(22, 'planned', 'T-20'),
    { id: 'T-1', kind: 'map', title: 'Old map', state: 'closed' },
    { id: 'T-2', kind: 'question', title: 'Old question', parent: 'T-1', state: 'closed' },
    task(3, 'done', 'T-1'), task(30, 'planned', ''), task(31, 'done', ''),
    task(32, 'done', '', { state: 'open' }),
  ] };
  const c = await start(t, scenario);
  assert.equal(await c.lua("return require('cland.items').filter()"), 'board', 'fresh projects default to the scoped board');
  assert.deepEqual(await c.lua(`local out={}; for _,it in ipairs(require('cland.vboard').compose().unscheduled) do out[#out+1]=it.id end; return out`), []);
  for (const width of [80, 120]) {
    await c.rpc.request('nvim_ui_try_resize', width, 45);
    await c.lua("local s=require('cland.state'); s.S.ui.items_folds={}; require('cland.items').set_filter('board')");
    await c.waitScreen(s => s.includes('board · 1 in work · 1 done'), 'scoped board summary');
    const text = (await panel(c)).join('\n');
    assert.doesNotMatch(text, /unscheduled \(/);
    assert.match(text, /unscheduled 1/);
    assert.doesNotMatch(text, /T-30 Row 30/, '§3.5: unscheduled planned work is Background until unfolded');
    for (const id of ['T-19', 'T-20', 'T-140', 'T-1', 'T-31', 'T-32']) assert.doesNotMatch(text, new RegExp(` ${id} `));
    await c.lua("require('cland.vboard').fold('all open')");
    await c.waitScreen(s => s.includes('Row 168'), 'scoped folds opened');
    const rows = () => c.lua<string[]>(`local p=require('cland.panels'); local b=p.buf('items'); local out={}; for i=1,vim.api.nvim_buf_line_count(b) do local info=p.row_at(b,i); if info and info.item then out[#out+1]=info.item end end; return out`);
    assert.deepEqual(await rows(), ['T-130', 'T-167', 'T-107', 'T-168'], 'unfolding also reveals scoped background containers and done work');
    const columns = await c.lua(`local out={}; for status,list in pairs(require('cland.board').columns()) do out[status]={}; for _,it in ipairs(list) do out[status][#out[status]+1]=it.id end end; return out`);
    assert.deepEqual(columns, { backlog: [], planned: ['T-167'], 'in progress': [], review: [], qa: [], ready: [], done: ['T-168'] });
    await c.input('6zR');
    await c.waitScreen(s => s.includes('all ·'), 'explicit all filter');
    assert.deepEqual((await rows()).sort(), scenario.items!.map(it => String(it.id)).sort(), 'all lists every item exactly once after unfolding');
    const budget = await c.lua<{ width: number; widths: number[] }>(`local p=require('cland.panels'); local b=p.buf('items'); local w=vim.fn.bufwinid(b); local lines=vim.api.nvim_buf_get_lines(b,0,-1,false); local widths={}; for _,line in ipairs(lines) do widths[#widths+1]=vim.api.nvim_strwidth(line) end; for _,m in ipairs(vim.api.nvim_buf_get_extmarks(b,-1,0,-1,{details=true})) do assert(m[4].end_col<=#lines[m[2]+1]) end; return {width=vim.api.nvim_win_get_width(w), widths=widths}`);
    assert.ok(budget.widths.every(w => w <= budget.width), `panel rows fit at ${width} columns`);
  }
});
test('archived ancestry stays scheduled and the scoped done filter includes closed epic tasks', { skip }, async t => {
  const scenario: Scenario = { items: [
    { id: 'T-1', kind: 'release', title: 'Current release', version: '0.1.0', state: 'open' },
    { id: 'T-2', kind: 'release', title: 'Archived release', version: '0.0.1', state: 'closed' },
    task(3, 'planned', 'T-2'),
    { id: 'T-4', kind: 'epic', title: 'Closed current epic', parent: 'T-1', state: 'closed' },
    task(5, 'done', 'T-4'),
    { id: 'T-6', kind: 'epic', title: 'Closed archived epic', parent: 'T-2', state: 'closed' },
    task(7, 'done', 'T-6'),
    { id: 'T-8', kind: 'epic', title: 'Open archived epic', parent: 'T-2', state: 'open' },
    task(9, 'planned', 'T-8'),
  ] };
  const c = await start(t, scenario);
  assert.deepEqual(await c.lua(`return require('cland.vboard').compose().unscheduled`), []);
  assert.equal(await c.lua(`return require('cland.items').release_of(require('cland.state').item('T-9')).id`), 'T-2');
  await c.input('4');
  await c.waitScreen(s => s.includes('DONE · 1') && s.includes('Row 5'), 'done below a closed current epic');
  const text = (await panel(c)).join('\n');
  assert.doesNotMatch(text, /Row [379]/);
  await c.input('6zR');
  await c.waitScreen(s => s.includes('all · 9 items'), 'all trees unfolded');
  const rows = await c.lua<string[]>(`local p=require('cland.panels'); local b=p.buf('items'); local out={}; for i=1,vim.api.nvim_buf_line_count(b) do local info=p.row_at(b,i); if info and info.item then out[#out+1]=info.item end end; return out`);
  assert.deepEqual(rows.sort(), scenario.items!.map(it => String(it.id)).sort());
});
test('an open scope under an archived release stays out of unscheduled and appears once in all', { skip }, async t => {
  const c = await start(t, { items: [
    { id: 'T-1', kind: 'release', title: 'Current release', version: '0.1.0', state: 'open' },
    { id: 'T-2', kind: 'release', title: 'Archived release', version: '0.0.1', state: 'closed' },
    task(3, 'done', 'T-2'),
    { id: 'T-8', kind: 'epic', title: 'Open archived epic', parent: 'T-2', state: 'open' },
    task(9, 'planned', 'T-8'),
  ] });
  await c.input('ezR');
  await c.waitScreen(s => s.includes('T-8 Open archived epic') && !s.includes('unscheduled ('), 'archived epic scope');
  assert.equal(await c.lua("return require('cland.items').scope().id"), 'T-8');
  const text = (await panel(c)).join('\n');
  assert.doesNotMatch(text, /T-2 Archived release|Row 3/);
  await c.input('6zR');
  await c.waitScreen(s => s.includes('all · 5 items'), 'explicit all tree');
  assert.equal((await panel(c)).filter(line => line.includes('T-8 ')).length, 1, 'selected scope has no duplicate header');
  await c.input('1E');
  await c.waitScreen(s => s.includes('T-1 0.1.0 Current release') && !s.includes('T-8 Open archived epic'), 'original scope');
  assert.equal(await c.lua("return require('cland.items').scope().id"), 'T-1');
});
test('the board shows hub sections, rank, glyphs, verdicts and criteria; all reaches unscheduled work', { skip }, async t => {
  const c = await start(t);
  await c.waitScreen(s => s.includes('board · 7 in work · 1 done'), 'board summary');
  await c.waitScreen(s => s.includes('1/2'), 'criteria fetched');
  const lines = await panel(c); const text = lines.join('\n');
  for (const [status, count] of [['IN PROGRESS', 1], ['REVIEW', 1], ['QA', 1], ['READY', 1], ['PLANNED', 3]]) assert.match(text, new RegExp(`${status} · ${count}`));
  assert.match(text, /◐ T-10.*✗ review.*1\/2/);
  assert.match(text, /◉ T-11.*for Reviewer.*1\/2/);
  assert.match(text, /◉ T-13.*1\/1/);
  assert.match(text, /◌ T-14/);
  assert.match(text, /○ T-16.*next/);
  assert.ok(text.indexOf('T-16') < text.indexOf('T-14'), 'epic rank precedes task rank');
  assert.match(text, /▸ backlog \(1\)/); assert.doesNotMatch(text, /unscheduled \(/); assert.match(text, /unscheduled 1/);
  assert.doesNotMatch(text, /T-20 Row 20/, '§3.5: planned outside the current release is Background');
  for (const id of ['T-17', 'T-18', 'T-19']) assert.ok(!lines.some(l => new RegExp(` ${id} `).test(l)), `${id} starts hidden`);
  assert.match(text, /epic.*all.*Tracker.*Panels/);
  await c.input('/backlog (<CR>za'); await c.waitScreen(s => s.includes('Row 17'), 'backlog opens');
  await c.input('za'); await c.waitScreen(s => !s.includes('Row 17'), 'backlog closes');
  await c.input('/unscheduled 1<CR><CR>');
  await c.waitScreen(s => s.includes('all ·') && s.includes('unscheduled (1)'), 'all rendered');
  await c.input('/unscheduled (<CR>za'); await c.waitScreen(s => s.includes('Row 20'), 'unscheduled planned work reachable in all');
  await c.input('1');
  await c.waitScreen(s => s.includes('board · 7'), 'board restored');
  const glyphs = await c.lua<Record<string, string>>(`local out={}; local b=require('cland.panels').buf('items'); local lines=vim.api.nvim_buf_get_lines(b,0,-1,false); for _,m in ipairs(vim.api.nvim_buf_get_extmarks(b,-1,0,-1,{details=true})) do local text=(lines[m[2]+1] or ''):sub(m[3]+1,m[4].end_col); if text=='◉' or text=='1/1' or text=='next' then out[(lines[m[2]+1] or ''):match('T%-%d+')..':'..text]=m[4].hl_group end end; return out`);
  assert.equal(glyphs['T-11:◉'], 'ClandAmber'); assert.equal(glyphs['T-13:◉'], 'ClandGreen'); assert.equal(glyphs['T-13:1/1'], 'ClandGreen'); assert.equal(glyphs['T-16:next'], 'ClandTeal');
  await c.input('<Space>i<Space>s<Space>b');
  await c.waitScreen(s => s.includes('Card') || s.includes('Row 13'), 'centre status columns');
  assert.deepEqual(await c.lua(`local out={}; for status,list in pairs(require('cland.board').columns()) do out[status]={}; for _,it in ipairs(list) do table.insert(out[status],it.id) end end; return out`), {
    backlog: ['T-17'], planned: ['T-16', 'T-14', 'T-15'], 'in progress': ['T-10'], review: ['T-11'], qa: ['T-12'], ready: ['T-13'], done: ['T-18']
  });
  await c.input('p'); await c.waitScreen(s => !s.includes('T-14') && s.includes('T-16'), 'same epic tab in columns');
  await c.input('<Space>b<Space>i'); await c.waitScreen(s => s.includes('PLANNED · 1') && /T-16.*next/.test(s), 'epic tab shared by vertical view');
});

async function select(c: Awaited<ReturnType<typeof start>>, id: string) {
  // Connected precedes the items snapshot and its render. Select only once that row exists.
  await c.waitScreen(screen => screen.split('\n').some(line => line.includes(' ' + id + ' ')), 'rendered item row ' + id);
  await c.lua(`local id=...; local b=require('cland.panels').buf('items'); local w=vim.fn.bufwinid(b); vim.api.nvim_set_current_win(w); for i, line in ipairs(vim.api.nvim_buf_get_lines(b,0,-1,false)) do if line:find(' '..id..' ',1,true) then vim.api.nvim_win_set_cursor(w,{i,0}); return end end; error('no row '..id)`, id);
}
test('T, K and J send rank operations; only task events and final siblings reorder and move next', { skip }, async t => {
  const rankFixture: Scenario = { ...fixture, items: fixture.items!.filter(it => it.id !== 'T-16').concat(task(21, 'planned')), rankEvents: 'manual', holdSnapshots: ['task.rank'] };
  const c = await start(t, rankFixture);
  await select(c, 'T-21'); await c.input('T');
  // Input acceptance is earlier than the stub receiving the request. Wait at that seam.
  await c.control({ waitSnapshot: 'task.rank' });
  await c.control({ releaseSnapshots: ['task.rank'] });
  const received = await c.control({ requests: true });
  const ranks = (received.requests as Array<Record<string, unknown>>).filter(f => f.type === 'task.rank');
  assert.equal(ranks.length, 1); assert.equal(ranks[0]?.item, 'T-21'); assert.equal(ranks[0]?.top, true);
  let lines = await panel(c); assert.ok(lines.find(l => l.includes('T-15'))?.includes('next'));
  assert.ok(lines.findIndex(l => l.includes('T-15')) < lines.findIndex(l => l.includes('T-21')), 'result alone does not reorder');
  const final = ['T-21', 'T-14', 'T-15', 'T-10', 'T-11', 'T-12', 'T-13', 'T-17', 'T-18'];
  // The final siblings order is authoritative before numeric ranks from all changed events arrive.
  await c.control({ emit: { type: 'task', id: 'T-21', item: rankFixture.items!.find(it => it.id === 'T-21'), siblings: final } });
  await c.waitScreen(s => /T-21.*next/.test(s), 'event moves next');
  lines = await panel(c); assert.ok(lines.findIndex(l => l.includes('T-21')) < lines.findIndex(l => l.includes('T-15')));
  assert.match(String(await c.lua('return vim.api.nvim_get_current_line()')), /T-21/, 'cursor follows moved item');
  await c.input('J');
  await c.control({ waitSnapshot: 'task.rank' });
  await c.control({ releaseSnapshots: ['task.rank'] });
  await c.control({ emit: { type: 'task', id: 'T-21', item: rankFixture.items!.find(it => it.id === 'T-21'), siblings: ['T-14', 'T-21', 'T-15', ...final.slice(3)] } });
  await c.waitScreen(s => /Row 14[\s\S]*Row 21/.test(s), 'J event reorders the siblings');
  assert.match(String(await c.lua('return vim.api.nvim_get_current_line()')), /T-21/, 'cursor follows J');
  await c.input('K');
  await c.control({ waitSnapshot: 'task.rank' });
  await c.control({ releaseSnapshots: ['task.rank'] });
  const frames = ((await c.control({ requests: true })).requests as Array<Record<string, unknown>>).filter(f => f.type === 'task.rank');
  assert.equal(frames[1]?.after, 'T-14'); assert.equal(frames[2]?.before, 'T-14');
  await c.control({ set: { rankError: 'rank refused' } }); await c.input('T');
  await c.waitScreen(s => s.includes('rank refused'), 'rank refusal');
  assert.ok((await panel(c)).findIndex(l => l.includes('T-14')) < (await panel(c)).findIndex(l => l.includes('T-21')), 'refusal preserves order');
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"), []);
});
test('e and E select configured open containers, persist through ui.json and recover a missing pick', { skip }, async t => {
  const c = await start(t);
  await c.input('e'); await c.waitScreen(s => s.includes('Tracker') && !s.includes('Row 10'), 'Tracker scope');
  await c.lua("require('cland.ui').flush()");
  const data = JSON.parse(await readFile(join(c.root, '.cland/ui.json'), 'utf8'));
  assert.equal(data.current_release, 'T-3');
  await c.input('<Esc>:qa!<CR>');
  await new Promise<void>(resolve => c.process.exitCode === null ? c.process.once('exit', () => resolve()) : resolve());
  const fresh = await startClient(t, bin, c.root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]), CLAND_STUB_SCENARIO_JSON: JSON.stringify(fixture) });
  await fresh.waitScreen(s => s.includes('hub: connected') && s.includes('Row 16'), 'cold restart');
  assert.equal(await fresh.lua("return require('cland.items').scope().id"), 'T-3');
  assert.ok(!(await fresh.screen()).join('\n').includes('Row 10'));
  await fresh.input('<Esc><C-h>E'); await fresh.waitScreen(s => s.includes('Row 10'), 'previous scope');
  await fresh.lua("require('cland.state').S.ui.current_release='T-999'; require('cland.state').changed()");
  await fresh.waitScreen(s => s.includes('Current release') && s.includes('Row 10'), 'fallback');
  assert.equal(await fresh.lua("return require('cland.items').scope().id"), 'T-1');
});

test('criteria follow same-timestamp task edits and every row/highlight fits a narrow Unicode panel', { skip }, async t => {
  const c = await start(t);
  await c.waitScreen(s => s.includes('1/2'), 'initial criteria');
  const edited = { ...fixture.items!.find(it => it.id === 'T-15'), title: '界'.repeat(100) + ' planned', body: '- [x] Outside\n## Acceptance criteria\n```markdown\n- [ ] Example\n```\n### Nested\n- [X] C1. Verified\n  - verified: qa-1 [qa] · run q-1 · 2026-10-10T10:00Z\n## Notes\n- [ ] Not criteria' };
  await c.control({ set: { items: fixture.items!.map(it => it.id === 'T-15' ? edited : it) }, emit: { type: 'task', id: 'T-15', item: edited } });
  await c.waitScreen(s => /T-15.*1\/1/.test(s), 'updated acceptance section only');
  for (const width of [44, 20, 8, 1]) {
    const budget = await c.lua<{ width: number; rows: Array<{ text: number; mark: number }> }>(`local width=...; local l=require('cland.layout'); vim.api.nvim_win_set_width(l.win.left,width); require('cland.panels').render('items',l.win.left); local b=require('cland.panels').buf('items'); local lines=vim.api.nvim_buf_get_lines(b,0,-1,false); local out={}; for _,line in ipairs(lines) do table.insert(out,{text=vim.api.nvim_strwidth(line),mark=#line}) end; for _,m in ipairs(vim.api.nvim_buf_get_extmarks(b,-1,0,-1,{details=true})) do assert(m[4].end_col<=#lines[m[2]+1]); assert(vim.str_utfindex(lines[m[2]+1],'utf-32',m[3])>=0) end; return {width=vim.api.nvim_win_get_width(l.win.left),rows=out}`, width);
    assert.ok(budget.rows.every(row => row.text <= budget.width), `rows fit ${budget.width} cells`);
  }
});


test('category tasks leave the release unscheduled fold and root peers never cycle as release scopes', { skip }, async t => {
  const categoryFixture: Scenario = { tracker: { levels: ['release', 'epic'], ladder: [['release', 'category'], ['epic']] }, items: [
    { id: 'R-1', kind: 'release', title: 'Release scope', state: 'open', version: '1.0.0', parent: null },
    { id: 'C-2', kind: 'category', title: 'Docs category', state: 'open', parent: null },
    task(10, 'planned', 'R-1', { title: 'Scheduled work' }),
    task(11, 'planned', 'C-2', { title: 'Category work' }),
    task(12, 'planned', '', { title: 'Unparented work' }),
    task(13, 'planned', 'M-3', { title: 'Map child' }),
    { id: 'M-3', kind: 'map', title: 'Map root', state: 'open', parent: null },
  ] };
  const c = await start(t, categoryFixture);
  await c.waitScreen(s => s.includes('Scheduled work') && s.includes('unscheduled 2'), 'release board and no-parent count');
  await c.input('/unscheduled 2<CR><CR>');
  await c.waitScreen(s => s.includes('all ·') && s.includes('unscheduled (2)'), 'all rendered');
  await c.input('/unscheduled (<CR>za');
  const screen = await c.waitScreen(s => s.includes('Unparented work') && s.includes('Map root'), 'unfolded unscheduled items');
  assert.ok(!screen.includes('Category work'));
  assert.ok(screen.includes('Map child'), 'all retains the unscheduled map tree');
  assert.deepEqual(await c.lua("local out={}; for _,it in ipairs(require('cland.items').scopes()) do out[#out+1]=it.id end; return out"), ['R-1']);
  assert.equal(await c.lua("return require('cland.items').is_container(require('cland.state').item('C-2'))"), true);
  await c.input('e');
  assert.equal(await c.lua("return require('cland.items').scope().id"), 'R-1');
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"), []);
});
