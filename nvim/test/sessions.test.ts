// T2: recorded sessions/account frames; injected rules in nvim-sessions-rules.test.ts.
// UI-launched native attach/death/stop stays in sessions-lifecycle.test.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { clock, type Client } from './stub-client.ts';
import { proc, skip, startShell } from './shell-fixture.ts';
const startSessions: typeof startShell = (t, edit, env, initialSnapshots) => startShell(t, s => {
  s.accounts = [];
  s.verification = { version: 1, at: '2026-10-19T12:00:00Z', holder: null, waiters: [], metrics: { window: 20, count: 0, wait: { count: 0, medianMs: null, p90Ms: null }, run: { count: 0, medianMs: null, p90Ms: null } } };
  edit?.(s);
}, env, initialSnapshots);
const account = (name: string, harness: string, windows: unknown[] = [], at: string | null = '2026-10-19T12:00:00Z') => ({ name, harness, windows, at, source: at ? { kind: 'poll' } : null, path: null, variable: harness === 'codex' ? 'CODEX_HOME' : 'CLAUDE_CONFIG_DIR' });
const setNow = (c: Client, seconds: number) => c.lua(`local time=os.time; os.time=function(date) if date then return time(date) end return ${seconds} end; require('cland.state').changed()`);
test('recorded session rows show verifier holds and retain claims after release', { skip }, async t => {
  const processes = [proc('rev', 'reviewer', 'idle'), proc('qa-one', 'qa', 'idle')].map(p => ({ ...p, holds: [] as Array<{ item: string; role: string }> }));
  const c = await startSessions(t, s => { s.processes!.push(...processes); });
  const update = async (name: string, role: string, holds: Array<{ id: string; kind: string }> = [], claim?: string) => {
    const process = { ...proc(name, role, 'idle'), holds: [...(claim ? [{ item: claim, role: 'item' }] : []), ...holds.map(h => ({ item: h.id, role: h.kind }))] };
    processes[processes.findIndex(p => p.name === name)] = process;
    await c.control({ set: { processes }, emit: { type: 'session.process', process } });
  };
  const row = (screen: string, name: string) => screen.split('\n').find(line => line.includes(`${name} [`)) ?? '';
  await c.waitScreen(s => row(s, 'rev').includes('free') && row(s, 'qa-one').includes('free'), 'free verifiers');
  for (const [name, role, tag] of [['rev', 'reviewer', 'review'], ['qa-one', 'qa', 'qa']] as const) {
    await update(name, role, [{ id: 'T-1', kind: tag }]);
    await c.waitScreen(s => row(s, name).includes(`T-1 ${tag}`), `${tag} hold in the item column`);
    await update(name, role);
    await c.waitScreen(s => row(s, name).includes('free'), `${name} free after release`);
  }
  await update('rev', 'reviewer', [{ id: 'T-1', kind: 'review' }], 'T-2');
  // Widen the panel so both held items are visible on the grid.
  await c.lua("vim.api.nvim_win_set_width(require('cland.layout').win.right, 65)");
  await c.waitScreen(s => row(s, 'rev').includes('T-2 item, T-1 review'), 'claim before verifier hold');
  await update('rev', 'reviewer', [], 'T-2');
  const claimed = await c.waitScreen(s => row(s, 'rev').includes('T-2 item') && !row(s, 'rev').includes('T-1 review'), 'claim survives verifier release');
  assert.ok(!row(claimed, 'rev').includes('free'));
});


async function highlights(c: Client): Promise<Array<{ text: string; group: string }>> {
  return c.lua(`local b=require('cland.panels').bufs.sessions
    local lines=vim.api.nvim_buf_get_lines(b,0,-1,false); local out={}
    for _,m in ipairs(vim.api.nvim_buf_get_extmarks(b,vim.api.nvim_create_namespace('cland.panels'),0,-1,{details=true})) do
      out[#out+1]={text=lines[m[2]+1]:sub(m[3]+1,m[4].end_col),group=m[4].hl_group}
    end
    return out`);
}

test('recorded account pushes update weekly windows and preserve saved folds', { skip }, async t => {
  const reset = new Date('2026-10-19T21:59:00Z');
  const reading = (percent: number) => account('codex-b', 'codex', [{ id: 'weekly', label: 'wk', usedPercent: percent, resetsAt: reset.toISOString(), windowMins: 10080 }]);
  const accounts = [reading(19), account('oc-b', 'opencode'), account('unread', 'claude-code', [], null)];
  const c = await startSessions(t, s => {
    s.accounts = accounts;
    s.processes = [{ ...proc('rev-x', 'reviewer', 'idle', 'gpt-6.1-sol'), harness: 'codex', account: 'codex-b' }];
  });
  const root = c.root;
  await setNow(c, Date.parse('2026-10-19T12:00:00Z') / 1000);
  await c.lua("vim.api.nvim_set_current_win(require('cland.layout').win.right); vim.api.nvim_win_set_width(0, 80)");
  const shown = await c.waitScreen(s => s.includes(`wk 19% ↻${clock(reset.toISOString())}`) && s.includes('codex-b') && s.includes('oc-b') && s.includes('unread') && s.includes('verify:'), 'weekly reading and all account rows above verification');
  assert.ok(shown.indexOf('Accounts') < shown.indexOf('verify:'));
  assert.match(shown, /oc-b\s+no limit data/);
  assert.match(shown, /unread\s+no reading yet/);
  await c.input('<Esc>gg/rev-x<CR>');
  await c.waitScreen(s => s.includes('Codex · gpt-6.1-sol · codex-b'), 'named account in session meta');
  await c.lua(`local c = require('cland').client; local request = c.request
    c.request = function(self, frame, ...) assert(frame.type ~= 'account.list', 'unexpected account re-read'); return request(self, frame, ...) end`);
  await c.control({ emit: { type: 'account', account: reading(91) } });
  await c.waitScreen(s => s.includes('wk 91%'), 'account push updates weekly window');
  assert.ok((await highlights(c)).some(m => m.text.includes('wk 91%') && m.group === 'ClandRed'));
  await c.control({ emit: { type: 'account', account: reading(75) } });
  await c.waitScreen(s => s.includes('wk 75%'), '75 percent threshold');
  assert.ok((await highlights(c)).some(m => m.text.includes('wk 75%') && m.group === 'ClandAmber'));
  await c.input('ggza');
  await c.waitScreen(s => s.includes('Accounts (3)') && !s.includes('wk 75%'), 'folded accounts');
  await c.lua(`assert(vim.wait(5000,function()
    local ok,d=pcall(function() return vim.json.decode(table.concat(vim.fn.readfile(require('cland.state').S.root..'/.cland/ui.json'),'\\n')) end)
    return ok and d.accounts_folded == true
  end),'accounts fold was not saved')`);
  assert.equal(JSON.parse(await readFile(join(root, '.cland/ui.json'), 'utf8')).accounts_folded, true);
  // Exercise the same persisted preference restore without restarting a native server.
  await c.lua(`local state=require('cland.state'); state.S.ui.accounts_folded=false
    require('cland.ui').load(state.S.root); state.changed()`);
  await c.waitScreen(s => s.includes('Accounts (3)'), 'fold restored');
  await c.lua("vim.api.nvim_set_current_win(require('cland.layout').win.right)");
  await c.input('ggza');
  await c.waitScreen(s => s.includes('wk 75%') && !s.includes('Accounts (3)'), 'accounts unfolded');
});

test('recorded source windows preserve severity, local resets, stale age and wrapping', { skip }, async t => {
  const env = { TZ: 'Asia/Kolkata' };
  const now = Date.parse('2026-10-19T12:00:00Z');
  const today = new Date(now + 60_000).toISOString();
  const tomorrow = new Date(now + 86400_000).toISOString();
  const later = new Date(now + 14 * 86400_000).toISOString();
  const local = (iso: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: env.TZ, ...options }).format(new Date(iso));
  const time = (iso: string) => local(iso, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const date = new Date(now + 14 * 86400_000 + 5.5 * 3600_000).toISOString().slice(0, 10);
  const windows = [
    { kind: 'five_hour', percentUsed: 12.4, resetsAt: today, severity: 'warning' },
    { kind: 'seven_day', percentUsed: 3, resetsAt: tomorrow, severity: 'critical' },
    { kind: 'Fable', percentUsed: 98, resetsAt: later, severity: 'normal' },
  ];
  const sourceWindows = windows.map(w => ({ id: w.kind, label: w.kind === 'five_hour' ? '5h' : w.kind === 'seven_day' ? 'wk' : w.kind, usedPercent: w.percentUsed, resetsAt: w.resetsAt, severity: w.severity }));
  const c = await startSessions(t, s => {
    s.accounts = [account('claude-a', 'claude-code', sourceWindows, new Date(now - 31 * 60_000).toISOString()), account('default:claude-code', 'claude-code', sourceWindows, new Date(now).toISOString())];
    s.processes = [{ ...proc('impl-a', 'implementer', 'idle'), account: 'claude-a' }, proc('impl-default', 'implementer', 'idle')];
  }, env);
  await setNow(c, now / 1000);
  await c.lua("vim.api.nvim_set_current_win(require('cland.layout').win.right); vim.api.nvim_win_set_width(0, 100)");
  const stale = await c.waitScreen(s => s.includes('31m') && s.includes('Fable 98%') && s.includes('claude-a') && s.includes('default:claude-code'), 'both account rows with three windows and stale age');
  assert.match(stale, /claude-a\s+5h 12%/);
  assert.ok(stale.includes(`↻${time(today)}`));
  assert.ok(stale.includes(`↻${local(tomorrow, { weekday: 'short' })} ${time(tomorrow)}`));
  assert.ok(stale.includes(`↻${date}`));
  assert.ok(stale.indexOf('claude-a') < stale.indexOf('default:claude-code'));
  const dim = await highlights(c);
  assert.ok(dim.some(m => m.text.includes('31m') && m.group === 'ClandDim'));
  assert.ok(dim.some(m => m.text.includes('5h 12%') && m.group === 'ClandDim'));
  // Fresh default reading: the source's grade takes precedence even at a 98% share.
  assert.ok(dim.some(m => m.text.includes('5h 12%') && m.group === 'ClandAmber'));
  assert.ok(dim.some(m => m.text.includes('wk 3%') && m.group === 'ClandRed'));
  assert.ok(dim.some(m => m.text.includes('Fable 98%') && m.group === 'ClandText'));
  await c.input('<Esc>gg/impl-default<CR>');
  await c.waitScreen(s => s.includes('Claude Code ·') && s.includes('impl-default'), 'default session expanded');
  const meta = await c.lua<string[]>(`local b=require('cland.panels').bufs.sessions; local out={}
    for _,line in ipairs(vim.api.nvim_buf_get_lines(b,0,-1,false)) do if line:match('^   Claude Code') then out[#out+1]=line end end
    return out`);
  assert.equal(meta.length, 1);
  assert.doesNotMatch(meta[0]!, /default:|claude-a/);
  await c.lua("vim.api.nvim_win_set_width(0, 30); require('cland.state').changed()");
  const narrow = await c.waitScreen(s => s.includes('31m') && s.includes('claude-a') && s.includes('default:claude-code') && s.split('Fable 98%').length === 3, 'both account rows with wrapped windows');
  assert.ok(narrow.includes(`↻${date}`));
  const lines = await c.lua<Array<{ text: string; width: number }>>(`local out={}
    for _,line in ipairs(vim.api.nvim_buf_get_lines(require('cland.panels').bufs.sessions,0,-1,false)) do
      if line:find('verify:',1,true) then break end
      out[#out+1]={text=line,width=vim.api.nvim_strwidth(line)}
    end
    return out`);
  assert.ok(lines.every(line => line.width <= 30), JSON.stringify(lines));
  assert.equal(lines.filter(line => line.text.includes('Fable 98%')).length, 2);
  assert.ok(lines.some(line => /^   wk 3%/.test(line.text)), 'whole windows wrap to indented continuation lines');
  assert.ok(lines.every(line => !line.text.includes('…')), `wrapping retains all source text: ${JSON.stringify(lines)}`);
});

test('recorded hard-limit pushes show and clear account marks', { skip }, async t => {
  const resetDate = new Date('2026-10-20T00:01:00Z');
  const reset = resetDate.toISOString();
  const accounts = [account('codex-a', 'codex', [{ id: 'weekly', label: 'wk', usedPercent: 0, resetsAt: reset }]), account('oc-b', 'opencode')];
  const c = await startSessions(t, s => { s.accounts = accounts; }, { TZ: 'UTC' });
  await c.lua("vim.api.nvim_set_current_win(require('cland.layout').win.right); vim.api.nvim_win_set_width(0, 80)");
  await c.waitScreen(s => s.includes('codex-a') && s.includes('oc-b'), 'accounts listed');
  // A mark and its removal must reach the panel through events alone.
  await c.lua(`local c=require('cland').client; local request=c.request
    c.request=function(self,frame,...) assert(frame.type~='account.list','unexpected account re-read'); return request(self,frame,...) end`);
  const setNow = async (seconds: number) => c.lua(`local time=os.time
    os.time=function(date) if date then return time(date) end return ${seconds} end
    require('cland.state').changed()`);
  await setNow(resetDate.getTime() / 1000 - 30); // 00:00:30, on the reset's day.
  for (const reading of accounts) await c.control({ emit: { type: 'account', account: { ...reading, limited: { since: '2026-10-19T12:00:00Z', reason: 'usageLimitExceeded', session: reading.name, resetsAt: reading.name === 'codex-a' ? reset : null } } } });
  const screen = await c.waitScreen(s => s.includes('codex-a  ✗ limited · ↻00:01') && s.includes('oc-b  ✗ limited · until cleared'), 'limited account lines');
  assert.match(screen, /limited/);
  await setNow(resetDate.getTime() / 1000 - 120); // 23:59, before the reset's day.
  const weekday = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short' }).format(resetDate);
  await c.waitScreen(s => s.includes(`codex-a  ✗ limited · ↻${weekday} 00:01`) && s.includes('oc-b  ✗ limited · until cleared'), 'next-day limited account reset');
  const red = await highlights(c);
  for (const name of ['codex-a', 'oc-b']) assert.ok(red.some(m => m.text.includes(name) && m.group === 'ClandRed'));
  assert.ok(red.some(m => m.text.includes('until cleared') && m.group === 'ClandRed'));
  // Freshness after clearing uses the real account-reading time, not the simulated midnight.
  await setNow(Date.parse('2026-10-19T12:00:00Z') / 1000);
  for (const reading of accounts) await c.control({ emit: { type: 'account', account: reading } });
  await c.waitScreen(s => !s.includes('✗ limited') && s.includes('oc-b  no limit data'), 'cleared account event');
  const cleared = await highlights(c);
  for (const name of ['codex-a', 'oc-b']) {
    assert.ok(cleared.some(m => m.text.includes(name) && m.group === 'ClandBold'));
    assert.ok(!cleared.some(m => m.text.includes(name) && m.group === 'ClandRed'));
  }
});
