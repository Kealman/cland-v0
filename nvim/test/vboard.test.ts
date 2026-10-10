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
const task = (id: number, status: string, parent = 'T-2', extra = {}) => ({ id: `T-${id}`, kind: 'task', title: `Row ${id}`, status, state: status === 'done' ? 'closed' : 'open', parent, rank: id * 10, blocked_by: [], file: `T-${id}.md`, body: '- [x] Outside\n## Acceptance criteria\n- [x] First\n### Details\n- [ ] Second\n## Notes\n- [x] Outside too', ...extra });
const fixture: Scenario = {
  items: [
    { id: 'T-1', kind: 'release', title: 'Current release', version: '0.1.0', state: 'open' },
    { id: 'T-2', kind: 'epic', title: 'Panels', parent: 'T-1', rank: 20, state: 'open' },
    { id: 'T-3', kind: 'epic', title: 'Tracker', parent: 'T-1', rank: 10, state: 'open' },
    { id: 'T-4', kind: 'release', title: 'Future release', version: '0.2.0', state: 'open' },
    task(10, 'in progress', 'T-2', { claim: { session: 'impl-10' }, verdicts: [{ verdict: 'review', result: 'not clear' }] }),
    task(11, 'review'), task(12, 'qa'), task(13, 'ready', 'T-2', { body: '## Acceptance criteria\n- [X] Done' }),
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
test('archived descendants appear once when archive and unscheduled folds are open', { skip }, async t => {
  const c = await start(t, { items: [
    { id: 'T-1', kind: 'release', title: 'Current release', version: '0.1.0', state: 'open' },
    { id: 'T-2', kind: 'release', title: 'Archived release', version: '0.0.1', state: 'closed' },
    task(3, 'done', 'T-2'),
  ] });
  assert.deepEqual(await c.lua(`local out={}; for _,it in ipairs(require('cland.items').ordered()) do out[#out+1]=it.id end; return out`), ['T-1', 'T-2', 'T-3']);
  assert.deepEqual(await c.lua(`local out={}; for _,it in ipairs(require('cland.vboard').compose().unscheduled) do out[#out+1]=it.id end; return out`), ['T-3']);
  await c.input('zR');
  const rows = await c.lua<string[]>(`local p=require('cland.panels'); local b=p.buf('items'); local out={}; for i=1,vim.api.nvim_buf_line_count(b) do local info=p.row_at(b,i); if info and info.item then out[#out+1]=info.item end end; return out`);
  for (const id of ['T-1', 'T-2', 'T-3']) {
    assert.equal(rows.filter(row => row === id).length, 1, `${id} appears exactly once`);
  }
});
test('background descendants use unscheduled only when no open container is reached', { skip }, async t => {
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
  await c.input('zR');
  const rows = await c.lua<Array<{ item: string; list?: string }>>(`local p=require('cland.panels'); local b=p.buf('items'); local out={}; for i=1,vim.api.nvim_buf_line_count(b) do local info=p.row_at(b,i); if info and info.item then out[#out+1]={item=info.item,list=info.list} end end; return out`);
  for (const it of scenario.items!) {
    assert.equal(rows.filter(row => row.item === it.id).length, 1, `${it.id} appears exactly once`);
  }
  assert.deepEqual(rows.filter(row => row.list === 'unscheduled').map(row => row.item), ['T-3', 'T-6', 'T-7']);
  assert.deepEqual(rows.filter(row => row.list === 'T-2').map(row => row.item), ['T-2', 'T-8', 'T-9']);
  assert.deepEqual(rows.filter(row => row.list === 'T-4').map(row => row.item), ['T-4', 'T-5']);
});
test('the board shows hub sections, epic rank, status glyphs, verdicts, criteria and folded background groups', { skip }, async t => {
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
  assert.match(text, /▸ backlog \(1\)/); assert.match(text, /▸ unscheduled \(1\)/);
  for (const id of ['T-17', 'T-18', 'T-19', 'T-20']) assert.ok(!lines.some(l => new RegExp(` ${id} `).test(l)), `${id} starts hidden`);
  assert.match(text, /epic.*all.*Tracker.*Panels/);
  await c.input('/backlog (<CR>za'); await c.waitScreen(s => s.includes('Row 17'), 'backlog opens');
  await c.input('za'); await c.waitScreen(s => !s.includes('Row 17'), 'backlog closes');
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
  await c.lua(`local id=...; local b=require('cland.panels').buf('items'); local w=vim.fn.bufwinid(b); vim.api.nvim_set_current_win(w); for i, line in ipairs(vim.api.nvim_buf_get_lines(b,0,-1,false)) do if line:find(' '..id..' ',1,true) then vim.api.nvim_win_set_cursor(w,{i,0}); return end end; error('no row '..id)`, id);
}
test('T, K and J send rank operations; only task events and final siblings reorder and move next', { skip }, async t => {
  const rankFixture: Scenario = { ...fixture, items: fixture.items!.filter(it => it.id !== 'T-16').concat(task(21, 'planned')), rankEvents: 'manual' };
  const c = await start(t, rankFixture);
  await select(c, 'T-21'); await c.input('T');
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
  await c.control({ emit: { type: 'task', id: 'T-21', item: rankFixture.items!.find(it => it.id === 'T-21'), siblings: ['T-14', 'T-21', 'T-15', ...final.slice(3)] } });
  await c.waitScreen(s => s.includes('Row 21'), 'J event'); await c.input('K');
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
  const edited = { ...fixture.items!.find(it => it.id === 'T-15'), title: '界'.repeat(100) + ' planned', body: '- [x] Outside\n## Acceptance criteria\n```markdown\n- [ ] Example\n```\n### Nested\n- [X] Verified\n## Notes\n- [ ] Not criteria' };
  await c.control({ set: { items: fixture.items!.map(it => it.id === 'T-15' ? edited : it) }, emit: { type: 'task', id: 'T-15', item: edited } });
  await c.waitScreen(s => /T-15.*1\/1/.test(s), 'updated acceptance section only');
  for (const width of [44, 20, 8, 1]) {
    const budget = await c.lua<{ width: number; rows: Array<{ text: number; mark: number }> }>(`local width=...; local l=require('cland.layout'); vim.api.nvim_win_set_width(l.win.left,width); require('cland.panels').render('items',l.win.left); local b=require('cland.panels').buf('items'); local lines=vim.api.nvim_buf_get_lines(b,0,-1,false); local out={}; for _,line in ipairs(lines) do table.insert(out,{text=vim.api.nvim_strwidth(line),mark=#line}) end; for _,m in ipairs(vim.api.nvim_buf_get_extmarks(b,-1,0,-1,{details=true})) do assert(m[4].end_col<=#lines[m[2]+1]); assert(vim.str_utfindex(lines[m[2]+1],'utf-32',m[3])>=0) end; return {width=vim.api.nvim_win_get_width(l.win.left),rows=out}`, width);
    assert.ok(budget.rows.every(row => row.text <= budget.width), `rows fit ${budget.width} cells`);
  }
});
