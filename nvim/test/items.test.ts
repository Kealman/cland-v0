// T2: recorded hub item snapshots and the headless client; hub rules in nvim-items-rules.test.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { startItems } from './items-replay.ts';
import { skip } from './shell-fixture.ts';
const leftOf = (text: string): string =>
  text
    .split('\n')
    .map((l) => {
      const i = l.indexOf('│');
      return i < 0 ? '' : l.slice(0, i);
    })
    .join('\n');
const statusLine = (s: string) => s.split('\n')[43] ?? '';

test('recorded item trees render closed titles in the done colour', { skip }, async t => {
  const c = await startItems(t, 'closed');
  await c.input('<Esc><Space>i6zR');
  await c.waitScreen(s => s.includes('Closed container') && s.includes('Closed task'), 'closed tree unfolded');
  const marks = await c.lua<Record<string, string>>(`
    local b=require('cland.panels').buf('items'); local lines=vim.api.nvim_buf_get_lines(b,0,-1,false); local out={}
    for _,m in ipairs(vim.api.nvim_buf_get_extmarks(b,-1,0,-1,{details=true})) do
      local text=lines[m[2]+1]:sub(m[3]+1,m[4].end_col)
      for _,title in ipairs({'Closed container','Closed task'}) do
        if text:find(title,1,true) then out[title]=m[4].hl_group end
      end
    end
    return out`);
  assert.deepEqual(marks, { 'Closed container': 'ClandDone', 'Closed task': 'ClandDone' });
});


test('recorded Lead claims appear in epic rows, item fields and session rows', { skip }, async t => {
  const c = await startItems(t, 'lead');
  await c.waitScreen(s => s.includes('General'), 'the workbench');
  await c.input('<Esc><Space>i');
  await c.lua("vim.api.nvim_win_set_width(require('cland.layout').win.left,85)");
  const panel = await c.waitScreen(s => /E-1 Led epic.*lead-1 \[Lead\].*0\/0/.test(s), 'the epic Lead badge');
  assert.match(panel, /lead-1 \[Lead\]/);
  await c.input(':Cland view item T-1<CR>');
  await c.waitScreen(s => /claim.*lead-1 \[Lead\]/.test(s), 'the item claim fields');
  await c.input('<Esc><Space>s');
  await c.waitScreen(s => s.includes('lead-1 [Lead]') && s.includes('E-1'), 'the Lead session and its epic');
});


test('recorded configured containers show counts without entering board cards', { skip }, async t => {
  const c = await startItems(t, 'containers');
  await c.waitScreen(s => s.includes('General'), 'the workbench');
  await c.input('<Esc><Space>i');
  await c.lua("vim.api.nvim_win_set_width(require('cland.layout').win.left,70)");
  await c.input('6zR');
  const panel = await c.waitScreen(s => /F-2 feature.*0\/0/.test(s), 'the configured empty container');
  assert.match(panel, /I-1 initiative +0\/3/);
  assert.match(panel, /M-6 map +0\/0/);
  await c.input('<Space>b');
  const screen = await c.waitScreen(s => s.includes('BACKLOG') && s.includes('T-3'), 'task board card');
  // The panel may still be open, so inspect the board's public column result as well.
  const cards = await c.lua<string[]>('local out = {}; for _, col in pairs(require("cland.board").columns()) do for _, it in ipairs(col) do out[#out+1] = it.id end end; table.sort(out); return out');
  assert.deepEqual(cards, ['T-3']);
  assert.ok(screen.includes('feature'), 'the empty container remains visible in the items panel');
});


test('recorded item frames render trees, map groups, details, board and edited files', { skip }, async (t) => {
  const c = await startItems(t, 'tree');
  const root = c.root;
  await c.waitScreen((s) => s.includes('General'), 'the workbench');
  await c.input('<Esc><Space>i');
  await c.lua("vim.api.nvim_win_set_width(require('cland.layout').win.left,70)");
  // WinResized schedules the panel render: the old-width badge can be visible
  // inside the wider window before it reaches the resized panel's right edge.
  let s = await c.waitScreen((x) => x.includes('Review passed') && /^ ◐ T-2 E-1 › Items panel +impl-1$/m.test(leftOf(x)), 'the resized items panel with the claim');
  const panel = leftOf(s);
  assert.match(panel, /^ E-1 Workbench shell +1\/4\s*$/m);
  assert.match(panel, /^ ◐ T-2 E-1 › Items panel +impl-1$/m);
  assert.match(panel, /^ ◉ T-3 E-1 › Board view +✗ review$/m, 'a not-clear review stays review with a failed verdict mark');
  assert.doesNotMatch(panel, /T-4 E-1 › Item view/, 'done is hidden from the board');
  await c.input('4');
  await c.waitScreen(x => /● T-4 E-1 › Item view/.test(x), 'done filter reveals the closed row');
  await c.input('6');
  await c.waitScreen(x => x.includes('unscheduled (1)'), 'all groups the unparented map');
  await c.input('/unscheduled (<CR>za');
  await c.waitScreen(x => /M-5 Slice 2 map/.test(x), 'all reaches the unparented map');

  // the map grouping
  await c.input('5');
  s = await c.waitScreen((x) => x.includes('DECIDED · 1'), 'the map filter');
  const map = leftOf(s)
    .split('\n')
    .map((l) => l.trim().replace(/^[▾▸] /, '').replace(/\s+/g, ' '))
    .filter((l) => /^[○●◐◑◆◌] [MQ]-\d+ |^[A-Z][A-Z -]+ · \d+$/.test(l));
  assert.deepEqual(map, ['○ M-5 Slice 2 map 1/3', 'DECIDED · 1', '● Q-6 Which store', 'FRONTIER · 1', '○ Q-7 Transport', 'IN WORK BY SUB-AGENTS · 0', 'BLOCKED · 1', '◌ Q-8 Auth scheme']);
  await c.input('1');

  await c.lua("vim.api.nvim_win_set_width(require('cland.layout').win.left,35)");
  // the item view: the file through task.view
  await c.input(':Cland view item T-3<CR>');
  s = await c.waitScreen((x) => x.includes('COMMENTS · 2'), 'the item view of T-3');
  assert.match(s, /◉ T-3 · open · review · task/);
  assert.match(s, /parent {5}E-1 Workbench shell/);
  assert.match(s, /Six columns derived from the item\./);
  assert.match(s, /✗ review not clear · by rev-1 \[Reviewer\] · run r-2/);
  assert.match(s, /Ready for review\./);
  assert.match(s, /\.cland\/tasks\/T-3-board-view\.md/);

  // the board
  await c.input('<Space>b');
  s = await c.waitScreen((x) => x.includes('BACKLOG') && statusLine(x).includes('Board'), 'the board');
  const rows = s.split('\n');
  const at = rows.findIndex((r) => r.includes('BACKLOG'));
  const ids: string[][] = [[], [], [], [], [], [], []];
  for (const r of rows.slice(at + 1)) {
    const cells = r.split('│').slice(1);
    if (cells.length < 7) break;
    cells.slice(0, 7).forEach((cell, i) => {
      const m = /^\s*(T-\d+)/.exec(cell);
      if (m) ids[i]?.push(m[1] ?? '');
    });
  }
  assert.deepEqual(ids, [[], [], ['T-2'], ['T-3'], ['T-9'], [], ['T-4']]);

  // a file written by hand shows in the panel within a second
  await c.input('<Space>b');
  await c.waitScreen((x) => statusLine(x).includes('T-3 · item'), 'the board closed');
  await c.lua("vim.api.nvim_win_set_width(require('cland.layout').win.left,70)");
  await c.input('<Esc><C-h>6zR<C-l>');
  await c.waitScreen(x => /○ Q-7 Transport/.test(leftOf(x)), 'map children in the all-items tree');
  await c.pushItems('added');
  await c.waitScreen(x => /^ +○ Q-10 Born by hand +$/m.test(leftOf(x)), 'Q-10 in the panel within one second', 1000);

  // e opens the file in a normal buffer; a save re-indexes it
  await c.input(':Cland view item T-7<CR>');
  await c.waitScreen((x) => statusLine(x).includes('Q-7 · item') && x.includes('COMMENTS · 0'), 'the item view of Q-7');
  await c.input('e');
  await c.waitScreen((x) => statusLine(x).includes('editing .cland/tasks/T-7-transport.md'), 'the file open');
  assert.equal(await c.lua<string>('return vim.fn.expand("%:t")'), 'T-7-transport.md');
  assert.equal(await c.lua<string>('return vim.bo.buftype'), '');
  await c.input(':%s/^title: Transport$/title: Transport over QUIC/<CR>:w<CR>');
  await c.pushItems('saved');
  await c.waitScreen(x => /^ +○ Q-7 Transport over QUIC +$/m.test(leftOf(x)), 'the new title in the panel within one second', 1000);
  assert.match(await readFile(join(root, '.cland/tasks/T-7-transport.md'), 'utf8'), /title: Transport over QUIC/);
});

test('recorded verdict frames retain commit, stale colour and provenance', { skip }, async (t) => {
  const c = await startItems(t, 'verdicts');
  await c.waitScreen((s) => s.includes('General'), 'the workbench');
  await c.input('<Esc>:Cland view item T-1<CR>');
  const screen = await c.waitScreen((s) => s.includes('VERDICTS · 2') && s.includes('stale'), 'the stale verdict');
  assert.match(screen, /aaaaaaaa/);
  assert.match(screen, /from the file/);
  assert.match(screen, /from the hub/);
  const redStale = await c.lua<boolean>(`
    for _, b in ipairs(vim.api.nvim_list_bufs()) do
      if vim.api.nvim_buf_get_name(b) == 'cland://item/T-1' then
        local lines = vim.api.nvim_buf_get_lines(b, 0, -1, false)
        for _, mark in ipairs(vim.api.nvim_buf_get_extmarks(b, -1, 0, -1, {details=true})) do
          local d = mark[4]
          if d.hl_group == 'ClandRed' and (lines[mark[2]+1] or ''):sub(mark[3]+1, d.end_col):find('stale', 1, true) then return true end
        end
      end
    end
    return false`);
  assert.equal(redStale, true, 'stale is highlighted red in the item buffer');
});
