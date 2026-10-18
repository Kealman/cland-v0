// T3: watched criterion saves, allocated ids and Git-head freshness across live hub/client events.
// Screen permutations live in criteria-component.test.ts; workbench owns the shared real-hub flow.
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { startDaemon, tempProject } from '../../hub/test/harness.ts';
import { nvimOrSkip, startClient, type Client } from './harness.ts';
import { waitInitialSnapshots } from './readiness.ts';

const nvim = await nvimOrSkip();

const skip = 'skip' in nvim ? nvim.skip : false;

const bin = 'bin' in nvim ? nvim.bin : '';

const AT = '2026-10-10T10:00Z';

const criterion = (i: number, verified = false, commit = '') => `- [x] C${i}. Criterion ${i}\n  - done: impl-2 · ${AT}${verified ? `\n  - verified: rev-2 [reviewer] · run r-2 · ${AT}${commit ? ` · commit ${commit}` : ''}` : ''}`;

const source = (body: string) => `---\nid: T-2\nkind: task\ntitle: Criteria display\nstate: open\nstatus: in progress\nparent: T-1\ncriterion_seq: 7\ncreated: ${AT}\nupdated: ${AT}\n---\n\n## Acceptance criteria\n${body}\n\n## Notes\nKeep these notes.\n`;

async function buffer(c: Client, module = 'item_view') {
  return c.lua<string[]>(`local m=require('cland.'..(...)); local b=...=='item_view' and m.bufs['T-2'] or m.b; return vim.api.nvim_buf_get_lines(b,0,-1,false)`, module);
}

async function selectCriterion(c: Client, id: string) {
  await c.lua(`local id=...; local b=require('cland.item_view').bufs['T-2']; local w=vim.fn.bufwinid(b); vim.api.nvim_set_current_win(w); for i,line in ipairs(vim.api.nvim_buf_get_lines(b,0,-1,false)) do if line:find(' '..id..'. ',1,true) then vim.api.nvim_win_set_cursor(w,{i,0}); return end end; error('missing '..id)`, id);
}

async function widths(c: Client, module: string) {
  return c.lua<{ width: number; widths: number[] }>(`local name=...; local m=require('cland.'..name); local b=name=='item_view' and m.bufs['T-2'] or name=='panels' and m.buf('items') or m.b; local w=vim.fn.bufwinid(b); local lines=vim.api.nvim_buf_get_lines(b,0,-1,false); local widths={}; for _,line in ipairs(lines) do widths[#widths+1]=vim.api.nvim_strwidth(line) end; for _,mark in ipairs(vim.api.nvim_buf_get_extmarks(b,-1,0,-1,{details=true})) do if mark[4].end_col then assert(mark[4].end_col<=#lines[mark[2]+1]) end end; return {width=vim.api.nvim_win_get_width(w),widths=widths}`, module);
}

async function fractionHighlights(c: Client, module: string) {
  return c.lua<string[]>(`local name=...; local m=require('cland.'..name); local b=name=='panels' and m.buf('items') or m.b; local lines=vim.api.nvim_buf_get_lines(b,0,-1,false); local out={}; for _,mark in ipairs(vim.api.nvim_buf_get_extmarks(b,-1,0,-1,{details=true})) do if mark[4].end_col and lines[mark[2]+1]:sub(mark[3]+1,mark[4].end_col)=='4/4' then out[#out+1]=mark[4].hl_group end end; return out`, module);
}

test('human criterion keys preserve marks and removed ids; panel, cards and graph refresh from 3/4 to green 4/4', { skip }, async t => {
  const root=await tempProject(t); await mkdir(join(root,'.cland/tasks'),{recursive:true});
  await writeFile(join(root,'.cland/config.toml'),'[tracker]\nlevels = ["epic"]\n');
  await writeFile(join(root,'.cland/tasks/T-1-epic.md'),`---\nid: T-1\nkind: epic\ntitle: Criteria epic\nstate: open\ncreated: ${AT}\nupdated: ${AT}\n---\n`);
  const path=join(root,'.cland/tasks/T-2-criteria.md');
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  git('init', '-q', '-b', 'dev'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.com'); git('config', 'commit.gpgsign', 'false');
  git('commit', '--allow-empty', '-qm', 'Display build');
  const head = git('rev-parse', 'HEAD');
  await writeFile(path,source([1,2,3,4].map(i=>criterion(i,i<4,head)).join('\n')).replace('status: in progress', 'status: in progress\nbranch: dev'));
  await startDaemon(t,root); const c=await startClient(t,bin,root);
  await c.waitScreen(s=>s.includes('hub: connected'),'connected');
  await waitInitialSnapshots(c);
  await c.input('<Esc><Space>i');
  await c.lua("vim.api.nvim_win_set_width(require('cland.layout').win.left,60)");
  await c.waitScreen(s=>/T-2.*3\/4/.test(s),'initial panel 3/4');
  await c.input(':Cland view item T-2<CR>');
  await c.waitScreen(s=>s.includes('◐ C4. Criterion 4'),'done fourth criterion');
  await selectCriterion(c,'C4'); await c.input('ce<C-u>Edited fourth<CR>');
  await c.waitScreen(s=>s.includes('◐ C4. Edited fourth'),'human edits criterion');
  assert.match(await readFile(path,'utf8'),/C4\. Edited fourth\n  - done: impl-2/);
  await c.input('caAdded criterion<CR>');
  await c.waitScreen(s=>s.includes('○ C8. Added criterion'),'id after highest allocated');
  await selectCriterion(c,'C8'); await c.input('cd');
  await c.waitScreen(s=>s.includes('Remove C8'),'remove confirmation'); await c.input('2<CR>');
  await c.waitScreen(s=>!(s.includes('C8. Added criterion')) && s.includes('Edited fourth'),'removed');
  await c.input('caNext criterion<CR>'); await c.waitScreen(s=>s.includes('○ C9. Next criterion'),'removed id never reused');
  await selectCriterion(c,'C9'); await c.input('cd'); await c.waitScreen(s=>s.includes('Remove C9'),'confirmation'); await c.input('2<CR>');
  await c.waitScreen(s=>!s.includes('C9. Next criterion') && s.includes('Edited fourth'),'removed again');
  // Hand saves retain their timestamp; task events must invalidate the fraction anyway.
  const updated=(await readFile(path,'utf8')).replace('- [x] C4. Edited fourth\n  - done: impl-2 · '+AT,'- [x] C4. Edited fourth\n  - done: impl-2 · '+AT+'\n  - verified: qa-2 [qa] · run q-2 · '+AT+' · commit '+head);
  await writeFile(path,updated);
  await c.waitScreen(s=>s.includes('● C4. Edited fourth'),'verification event refreshes item');
  for(const width of [80,120]) {
    await c.rpc.request('nvim_ui_try_resize',width,45);
    await c.lua("require('cland.layout').preset('charting'); vim.api.nvim_set_current_win(require('cland.layout').win.left)");
    await c.waitScreen(s=>/T-2.*4\/4/.test(s),'panel 4/4');
    assert.deepEqual(await fractionHighlights(c,'panels'),['ClandGreen']);
    let budget=await widths(c,'panels'); assert.ok(budget.widths.every(w=>w<=budget.width));
    await c.lua("local l=require('cland.layout'); l.preset('steady'); if require('cland.state').S.ui.right then l.right_panel(require('cland.state').S.ui.right) end; l.show({kind='board'},{insert=false})");
    await c.waitScreen(s=>s.includes('4/4'),'board 4/4');
    assert.deepEqual(await fractionHighlights(c,'board'),['ClandGreen']);
    budget=await widths(c,'board'); assert.ok(budget.widths.every(w=>w<=budget.width),`board fits ${width}: ${JSON.stringify(budget)}`);
    await c.input(':Cland graph T-1<CR>'); await c.waitScreen(s=>s.includes('4/4'),'graph 4/4');
  }
  git('commit', '--allow-empty', '-qm', 'New display build');
  await c.input(':Cland view item T-2<CR>');
  await c.waitScreen(s=>s.includes('stale verified:'),'head movement makes verification stale');
  assert.ok((await buffer(c)).join('\n').includes('◌ C4. Edited fourth'));
  await c.lua("local l=require('cland.layout'); l.preset('steady'); if require('cland.state').S.ui.right then l.right_panel(require('cland.state').S.ui.right) end; l.show({kind='board'},{insert=false})");
  await c.waitScreen(s=>s.includes('0/4') && s.includes('4 stale'),'board excludes stale verification');
  await c.lua("require('cland.layout').preset('charting')");
  await c.waitScreen(s=>/T-2.*0\/4.*4 stale/.test(s),'panel excludes stale verification');
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"),[]);
});

test('the shown explorer card refreshes criteria after a watched save that preserves updated', {skip}, async t => {
  const root=await tempProject(t);
  await mkdir(join(root,'.cland/tasks'),{recursive:true});
  await writeFile(join(root,'.cland/config.toml'),'[tracker]\nlevels = ["epic"]\n');
  await writeFile(join(root,'.cland/tasks/T-1-epic.md'),`---\nid: T-1\nkind: epic\ntitle: Criteria epic\nstate: open\ncreated: ${AT}\nupdated: ${AT}\n---\n`);
  const git=(...args:string[])=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
  git('init','-q','-b','dev'); git('config','user.name','Test'); git('config','user.email','test@example.com'); git('config','commit.gpgsign','false');
  git('commit','--allow-empty','-qm','Card criteria build');
  const head=git('rev-parse','HEAD');
  const path=join(root,'.cland/tasks/T-2-criteria.md');
  const initial=source([1,2,3,4].map(i=>criterion(i,i<4,head)).join('\n')).replace('status: in progress','status: in progress\nbranch: dev');
  await writeFile(path,initial);
  await startDaemon(t,root);
  const c=await startClient(t,bin,root,{}, {centre:'explorer'});
  await c.rpc.request('nvim_ui_try_resize',200,50);
  await waitInitialSnapshots(c);
  await c.input(':Cland explorer E-1<CR>');
  await c.waitScreen(s=>s.includes('Criteria display'),'epic tasks');
  await c.input('j<CR>');
  await c.waitScreen(s=>s.includes('3 of 4 verified')&&s.includes('◐ C4 Criterion 4'),'card has unverified fourth criterion');
  const timestamp=await c.lua("return require('cland.state').item('T-2').updated");
  await writeFile(path,initial.replace(criterion(4),criterion(4,true,head)));
  await c.waitScreen(s=>s.includes('4 of 4 verified')&&s.includes('● C4 Criterion 4'),'same-timestamp watched save refreshes the card mark');
  assert.equal(await c.lua("return require('cland.state').item('T-2').updated"),timestamp,'watched save kept the timestamp');
  assert.equal(await c.lua("return require('cland.explorer').card.key"),'T-2','only the shown card follows the save');
});
