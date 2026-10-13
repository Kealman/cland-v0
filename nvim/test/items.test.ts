// The items panel, the item view and the board (#36) against a real hub: item files written by hand into
// `.cland/tasks`, claims taken through `cland task claim`, the hub's index and its `task` events. The panel
// follows a hand edit within a second; `e` opens the file and a save re-indexes it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, clandWithEnv, fakeClaude, startDaemon, tempProject } from '../../hub/test/harness.ts';
import { nvimOrSkip, startClient } from './harness.ts';
import { waitInitialSnapshots } from './readiness.ts';

const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';

const AT = '2026-10-08T10:00:00.000Z';

/** An item file as the tracker writes it (spec 4.6): frontmatter, the body, the comments. */
function itemFile(id: string, title: string, fm: Record<string, string> = {}, rest = ''): string {
  const fields: Record<string, string> = { id, kind: 'task', title, state: 'open', labels: '[]', assignee: 'null', parent: 'null', blocked_by: '[]', topic: 'null', branch: 'null', created: AT, updated: AT, ...fm };
  return `---\n${Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n${rest ? `\n${rest}\n` : ''}`;
}

const verdictComment = (who: string, role: string, kind: string, result: string, run: string, min: number, text: string) =>
  `### ${who} · 2026-10-08T10:${String(min).padStart(2, '0')}:00.000Z\n\nverdict: ${kind}\nresult: ${result}\nby: ${who} [${role}]\nrun: ${run}\n\n${text}\n`;

const FIXTURE: Record<string, string> = {
  'T-1-workbench-shell.md': itemFile('T-1', 'Workbench shell', { kind: 'epic' }),
  'T-2-items-panel.md': itemFile('T-2', 'Items panel', { parent: 'T-1', branch: 't/2-items-panel' }),
  'T-3-board-view.md': itemFile(
    'T-3',
    'Board view',
    { parent: 'T-1', status: 'review' },
    `Six columns derived from the item.\n\n## Comments\n\n### impl-1 · 2026-10-08T10:02:00.000Z\n\nReady for review.\n\n${verdictComment('rev-1', 'reviewer', 'review', 'not clear', 'r-2', 5, 'The qa column is missing.')}`,
  ),
  'T-4-item-view.md': itemFile('T-4', 'Item view', { parent: 'T-1', state: 'closed' }, `## Comments\n\n${verdictComment('rev-1', 'reviewer', 'review', 'clear', 'r-3', 4, 'Fine.')}\n${verdictComment('qa-1', 'qa', 'qa', 'clear', 'q-1', 6, 'Checked.')}`),
  'T-5-slice-2-map.md': itemFile('T-5', 'Slice 2 map', { kind: 'map' }),
  'T-6-which-store.md': itemFile('T-6', 'Which store', { kind: 'question', parent: 'T-5', state: 'closed' }),
  'T-7-transport.md': itemFile('T-7', 'Transport', { kind: 'question', parent: 'T-5' }),
  'T-8-auth-scheme.md': itemFile('T-8', 'Auth scheme', { kind: 'question', parent: 'T-5', blocked_by: '[T-7]' }),
  'T-9-review-passed.md': itemFile('T-9', 'Review passed', {parent: 'T-1', status: 'qa'}, `## Comments\n\n${verdictComment('rev-1', 'reviewer', 'review', 'clear', 'r-4', 7, 'Good.')}`),
};

const leftOf = (text: string): string =>
  text
    .split('\n')
    .map((l) => {
      const i = l.indexOf('│');
      return i < 0 ? '' : l.slice(0, i);
    })
    .join('\n');
const statusLine = (s: string) => s.split('\n')[43] ?? '';

test('the all tree keeps closed container and task titles in the done colour', { skip }, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland/tasks'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[tracker]\nlevels = ["release", "epic"]\n');
  for (const [id, title, fields] of [
    ['T-1', 'Current release', { kind: 'release', version: '1.0.0' }],
    ['T-2', 'Closed container', { kind: 'epic', parent: 'T-1', state: 'closed' }],
    ['T-3', 'Closed task', { parent: 'T-2', state: 'closed' }],
  ] as const) await writeFile(join(root, `.cland/tasks/${id}-item.md`), itemFile(id, title, fields));
  await startDaemon(t, root);
  const c = await startClient(t, bin, root);
  await waitInitialSnapshots(c);
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

test('the epic row, item fields and sessions panel show its launched Lead', { skip }, async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[tracker]\nlevels = ["epic"]\n');
  await startDaemon(t, root, fake.env);
  const created = await cland(root, 'task', 'create', 'Led epic', '--kind', 'epic');
  assert.equal(created.code, 0, created.stderr);
  const launched = await clandWithEnv(root, fake.env, 'session', 'launch', 'lead-1', '--role', 'lead', '--item', 'T-1', '--harness', 'claude-code');
  assert.equal(launched.code, 0, launched.stderr);
  const c = await startClient(t, bin, root);
  await waitInitialSnapshots(c);
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

test('configured containers with no children show container counts in the panel and stay outside board cards', { skip }, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland/tasks'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[tracker]\nlevels = ["initiative", "feature"]\n');
  for (const [id, kind] of [['T-1', 'initiative'], ['T-2', 'feature'], ['T-3', 'task'], ['T-4', 'question'], ['T-5', 'spec'], ['T-6', 'map']]) {
    await writeFile(join(root, `.cland/tasks/${id}-${kind}.md`), itemFile(id!, kind!, { kind: kind!, ...(['task', 'question', 'spec'].includes(kind!) ? {parent: 'T-1'} : {}) }));
  }
  await startDaemon(t, root);
  const c = await startClient(t, bin, root);
  await waitInitialSnapshots(c);
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

test('against a real hub: the tree, the map grouping, the item view and the board from hand-written item files; a hand edit shows within a second; e edits the file and a save re-indexes', { skip }, async (t) => {
  const root = await tempProject(t);
  const tasks = join(root, '.cland', 'tasks');
  await mkdir(tasks, { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[tracker]\nlevels = ["epic"]\n');
  for (const [name, text] of Object.entries(FIXTURE)) await writeFile(join(tasks, name), text);
  await startDaemon(t, root);
  const claimed = await cland(root, 'task', 'claim', 'T-2', '--as', 'impl-1', '--role', 'implementer');
  assert.equal(claimed.code, 0, claimed.stderr);

  const c = await startClient(t, bin, root);
  await waitInitialSnapshots(c);
  await c.waitScreen((s) => s.includes('General'), 'the workbench');
  await c.input('<Esc><Space>i');
  await c.lua("vim.api.nvim_win_set_width(require('cland.layout').win.left,70)");
  let s = await c.waitScreen((x) => x.includes('Review passed') && /T-2 E-1 › Items panel +impl-1/.test(x), 'the items panel with the claim');
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
  const written = Date.now();
  await writeFile(join(tasks, 'T-10-born-by-hand.md'), itemFile('T-10', 'Born by hand', { parent: 'T-5', kind: 'question' }));
  await c.waitScreen((x) => /^ +○ Q-10 Born by hand +$/m.test(leftOf(x)), 'Q-10 in the panel', 3000);
  const took = Date.now() - written;
  assert.ok(took < 1000, `the panel followed the file in ${took} ms`);

  // e opens the file in a normal buffer; a save re-indexes it
  await c.input(':Cland view item T-7<CR>');
  await c.waitScreen((x) => statusLine(x).includes('Q-7 · item') && x.includes('COMMENTS · 0'), 'the item view of Q-7');
  await c.input('e');
  await c.waitScreen((x) => statusLine(x).includes('editing .cland/tasks/T-7-transport.md'), 'the file open');
  assert.equal(await c.lua<string>('return vim.fn.expand("%:t")'), 'T-7-transport.md');
  assert.equal(await c.lua<string>('return vim.bo.buftype'), '');
  await c.input(':%s/^title: Transport$/title: Transport over QUIC/<CR>:w<CR>');
  const saved = Date.now();
  await c.waitScreen((x) => /^ +○ Q-7 Transport over QUIC +$/m.test(leftOf(x)), 'the new title in the panel', 3000);
  const took2 = Date.now() - saved;
  assert.ok(took2 < 1000, `the panel followed the save in ${took2} ms`);
  const list = JSON.parse((await cland(root, 'task', 'list', '--json')).stdout) as { items: Array<{ id: string; title: string }> };
  assert.equal(list.items.find((i) => i.id === 'Q-7')?.title, 'Transport over QUIC', 'the hub re-indexed the save');
});


test('the item view shows verdict commits, red stale marks, and file-only provenance', { skip }, async (t) => {
  const root = await tempProject(t);
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  git('init', '-b', 'main');
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 'test@example.com');
  await writeFile(join(root, 'feature'), 'base\n');
  git('add', 'feature');
  git('commit', '-m', 'base');
  git('checkout', '-b', 't/test');
  await writeFile(join(root, 'feature'), 'feature\n');
  git('add', 'feature');
  git('commit', '-m', 'feature');
  const sha = git('rev-parse', 'HEAD');
  await startDaemon(t, root);
  const created = await cland(root, 'task', 'create', '--size', 'M', 'Reviewed', '--branch', 't/test', '--json');
  assert.equal(created.code, 0, created.stderr);
  const item = JSON.parse(created.stdout).item as { path: string };
  const recorded = await cland(root, 'task', 'comment', 'T-1', 'Checked.', '--verdict', 'review', '--scope', 'full', '--result', 'clear', '--run', 'r-1');
  assert.equal(recorded.code, 0, recorded.stderr);
  const file = join(root, item.path);
  await writeFile(file, (await readFile(file, 'utf8')) + '\n' + verdictComment('qa-1', 'qa', 'qa', 'clear', 'q-1', 6, 'Imported.'));
  await writeFile(join(root, 'feature'), 'changed\n');
  git('add', 'feature');
  git('commit', '-m', 'changed');
  const c = await startClient(t, bin, root);
  await waitInitialSnapshots(c);
  await c.waitScreen((s) => s.includes('General'), 'the workbench');
  await c.input('<Esc>:Cland view item T-1<CR>');
  const screen = await c.waitScreen((s) => s.includes('VERDICTS · 2') && s.includes('stale'), 'the stale verdict');
  assert.match(screen, new RegExp(sha.slice(0, 8)));
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
