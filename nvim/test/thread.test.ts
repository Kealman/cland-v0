// Topic blocks at the Neovim/stub-hub boundary (T-132).
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp } from 'node:fs/promises';
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
const ts = '2026-10-09T10:00:00.000Z';
const msg = (id: string, role = 'coordinator', text = 'Taking T-58.') => ({
  id, from: role === 'human' ? 'human' : role, fromKind: role === 'human' ? 'human' : 'agent',
  fromRole: role === 'human' ? null : role, to: role === 'human' ? ['coordinator'] : ['human'],
  text, ts, topic: 'general', stage: role === 'human' ? 'queued' : null,
});

async function start(t: TestContext, scenario: Scenario, timeZone = 'UTC', charting = true) {
  const root = await mkdtemp(join(tmpdir(), 'cland-thread-'));
  ownDirectory(t, root);
  await mkdir(join(root, '.git'));
  const controlPath = join(root, 'stub.sock');
  const c = await startClient(t, bin, root, {
    TZ: timeZone, CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]),
    CLAND_STUB_SCENARIO_JSON: JSON.stringify({ inbox: {}, ...scenario }), CLAND_STUB_CONTROL: controlPath,
  });
  await c.waitScreen(s => s.includes('hub: connected'), 'connected');
  if (charting) await c.input('<Esc>:Cland preset charting<CR>');
  return Object.assign(c, { control: (cmd: Record<string, unknown>) => new Promise<void>((resolve, reject) => {
    const sock = createConnection(controlPath);
    let text = '';
    sock.setEncoding('utf8');
    sock.on('error', reject);
    sock.on('data', chunk => { text += chunk; if (text.includes('\n')) { sock.end(); resolve(); } });
    sock.write(`${JSON.stringify(cmd)}\n`);
  }) });
}

test('General shows addressees, local day rules, role gutters and the human band', { skip }, async t => {
  const c = await start(t, { messages: { general: [msg('c'), msg('i', 'implementer'), msg('r', 'reviewer'), msg('q', 'qa'), msg('h', 'human', 'Please take T-58.')] } });
  const screen = await c.waitScreen(s => s.includes('coordinator [Coordinator] → you  10:00'), 'the message header');
  assert.match(screen, /── Fri 9 Oct/);
  assert.match(screen, /[▎▌] you → coordinator  10:00 +⌁ queued/);
  const colours = await c.lua<number[]>(`
    local out={}
    for _,g in ipairs({'ClandRoleCoordinator','ClandRoleImplementer','ClandRoleReviewer','ClandRoleQa','ClandRoleHuman'}) do
      out[#out+1]=vim.api.nvim_get_hl(0,{name=g}).fg
    end
    return out
  `);
  assert.deepEqual(colours, [0x35c4a0, 0xbc8cff, 0xf778ba, 0x56d4dd, 0x6aa5ff]);
  assert.equal(await c.lua(`
    local b=require('cland.views').topic('general').thread.buf
    local ns=vim.api.nvim_get_namespaces()['cland.thread']
    local n=0
    for _,m in ipairs(vim.api.nvim_buf_get_extmarks(b,ns,0,-1,{details=true})) do
      if m[4].line_hl_group=='ClandMine' then n=n+1 end
    end
    return n
  `), 2, 'header and body are banded');
});

test('headers and day rules use the local day and daylight-saving offset', { skip }, async t => {
  const c = await start(t, { messages: { general: [
    { ...msg('winter'), ts: '2026-01-01T23:30:00Z' },
    { ...msg('spring'), ts: '2026-03-29T01:30:00Z' },
    { ...msg('summer'), ts: '2026-10-08T22:30:00Z' },
    { ...msg('autumn'), ts: '2026-10-25T01:30:00Z' },
  ] } }, 'Europe/Belgrade');
  const screen = await c.waitScreen(s => s.includes('Sun 25 Oct'), 'the final local day');
  assert.match(screen, /── Fri 2 Jan/);
  assert.match(screen, /── Sun 29 Mar/);
  assert.match(screen, /── Fri 9 Oct/);
  assert.match(screen, /→ you  03:30/);
  assert.match(screen, /→ you  02:30/);
  assert.equal((screen.match(/→ you  00:30/g) ?? []).length, 2);
});

test('thread options follow the buffer and an arbitrary scratch split restores global defaults', { skip }, async t => {
  const c = await start(t, { messages: { general: [msg('options')] } }, 'UTC', false);
  const result = await c.lua<{ thread: Record<string, unknown>; scratch: Record<string, unknown>; defaults: Record<string, unknown>; reentered: Record<string, unknown>; reset_again: Record<string, unknown>; global_after: Record<string, unknown> }>(`
    local api=vim.api
    local win=require('cland.layout').centre()
    local names={'statuscolumn','wrap','linebreak','breakindent','breakindentopt'}
    local defaults={statuscolumn='',wrap=true,linebreak=false,breakindent=false,breakindentopt=''}
    for name,value in pairs(defaults) do api.nvim_set_option_value(name,value,{scope='global'}) end
    local buf=api.nvim_create_buf(false,true)
    api.nvim_win_set_buf(win,buf)
    require('cland.layout').apply_view({focus=false,insert=false})
    local function options(w)
      local out={}
      for _,name in ipairs(names) do out[name]=api.nvim_get_option_value(name,{win=w}) end
      return out
    end
    local thread=options(win)
    local scratch=api.nvim_open_win(buf,false,{split='right',win=win})
    local restored=options(scratch)
    api.nvim_win_set_buf(scratch,api.nvim_win_get_buf(win))
    local reentered=options(scratch)
    api.nvim_win_set_buf(scratch,buf)
    local reset_again=options(scratch)
    local global_after={}
    for _,name in ipairs(names) do global_after[name]=api.nvim_get_option_value(name,{scope='global'}) end
    api.nvim_win_close(scratch,true)
    api.nvim_buf_delete(buf,{force=true})
    return {thread=thread,scratch=restored,defaults=defaults,reentered=reentered,reset_again=reset_again,global_after=global_after}
  `);
  assert.deepEqual(result.thread, { statuscolumn: '%!v:lua.ClandThreadGutter()', wrap: true, linebreak: true, breakindent: true, breakindentopt: 'list:-1' });
  assert.deepEqual(result.scratch, result.defaults);
  assert.deepEqual(result.reentered, result.thread);
  assert.deepEqual(result.reset_again, result.defaults);
  assert.deepEqual(result.global_after, result.defaults, 'thread settings never change window-option defaults');
});

test('delayed initial history preserves focused composer modes and an unfocused composer', { skip }, async t => {
  for (const mode of ['i', 'R', 'n', 't']) {
    const c = await start(t, { messages: { general: Array.from({length: 40}, (_,i) => msg(`initial-${i}`, 'implementer', `Initial ${i}${i===39 ? ' '+ 'word '.repeat(30)+'TAIL-END' : ''}`)) }, holdSnapshots: ['topic.history'] }, 'UTC', false);
    await c.control({ waitSnapshot: 'topic.history' });
    await c.input('<Esc>');
    if (mode === 'n') await c.lua("vim.api.nvim_set_current_win(require('cland.layout').centre())");
    else if (mode === 't') await c.lua(`
      local b=vim.api.nvim_create_buf(false,true)
      vim.api.nvim_open_win(b,true,{split='right',win=require('cland.layout').centre()})
      vim.fn.termopen({'cat'})
      vim.cmd('startinsert')
    `);
    else await c.input(mode === 'R' ? 'R' : 'i');
    assert.equal(await c.mode(), mode);
    const win = await c.lua<number>('return vim.api.nvim_get_current_win()');
    await c.control({ releaseSnapshots: ['topic.history'] });
    await c.waitScreen(s => s.includes('TAIL-END'), 'delayed initial history including the wrapped tail');
    assert.equal(await c.mode(), mode, `history preserves ${mode} mode`);
    assert.equal(await c.lua('return vim.api.nvim_get_current_win()'), win, 'history preserves focus');
    const label = { i: 'INSERT', R: 'R', n: 'NORMAL', t: 'TERMINAL' }[mode];
    await c.waitScreen(s => new RegExp(`${label} {2}General`).test(s), 'the original mode remains visible in the status line');
    const position=await c.lua<{row:number;bottom:number}>(`
      local w=require('cland.layout').centre()
      local info=vim.fn.getwininfo(w)[1]
      local last=vim.api.nvim_buf_line_count(vim.api.nvim_win_get_buf(w))
      local line=vim.api.nvim_buf_get_lines(vim.api.nvim_win_get_buf(w),last-1,last,false)[1]
      return {row=vim.fn.screenpos(w,last,#line).row,bottom=info.winrow+info.height-1+(vim.wo[w].winbar~='' and 1 or 0)}
    `);
    assert.equal(position.row, position.bottom, 'initial history follows the tail at the bottom');
  }
});

test('appends touch only new lines, delivery changes no text, and retention removes only the oldest block', { skip }, async t => {
  const messages = Array.from({ length: 199 }, (_, i) => msg(`m${i}`, 'human', `Body ${i}\nsecond line`));
  const c = await start(t, { messages: { general: messages } });
  await c.waitScreen(s => s.includes('Body 198'), 'history loaded');
  await c.lua("require('cland.layout').show_split_view({kind='thread',id='general'})");
  await c.lua(`
    local b=vim.fn.bufnr('cland://topic/general')
    _G.thread_changes={}
    vim.api.nvim_buf_attach(b,false,{on_lines=function(_,_,_,first,last,newlast)
      _G.thread_changes[#_G.thread_changes+1]={first,last,newlast}
    end})
    _G.before_lines=vim.api.nvim_buf_get_lines(b,0,-1,false)
  `);
  await c.control({ emit: { type: 'message', topic: { id: 'general', title: 'General' }, message: msg('m199', 'human', 'new body\nsecond line') } });
  await c.waitScreen(s => s.includes('new body'), 'appended message');
  const append = await c.lua<{ changes: number[][]; before: string[]; after: string[] }>(`
    return {changes=_G.thread_changes,before=_G.before_lines,after=vim.api.nvim_buf_get_lines(vim.fn.bufnr('cland://topic/general'),0,-1,false)}
  `);
  assert.deepEqual(append.changes, [[796, 796, 800]]);
  assert.deepEqual(append.after.slice(0, 796), append.before);
  await c.lua('_G.thread_changes={}');
  await c.control({ emit: { type: 'delivery', topic: 'general', message: 'm199', stage: 'injected' } });
  await c.waitScreen(s => s.includes('✓✓ injected'), 'stage updated');
  assert.deepEqual(await c.lua('return _G.thread_changes'), []);
  await c.control({ emit: { type: 'delivery', topic: 'general', message: 'm199', stage: 'queued' } });
  assert.equal(await c.lua("return require('cland.views').topic('general').thread.by_id.m199.stage"), 'injected');
  await c.control({ emit: { type: 'message', topic: { id: 'general', title: 'General' }, message: msg('m200', 'human', 'latest body\nsecond line') } });
  await c.waitScreen(s => s.includes('latest body'), 'latest message');
  assert.deepEqual(await c.lua(`
    local t=require('cland.views').topic('general').thread
    return {count=#t.messages,first=t.messages[1].id,changes=_G.thread_changes}
  `), { count: 200, first: 'm1', changes: [[800,800,804],[0,4,0]] });
});

test('200 message rewrites and steady-state appends stay within the rendering budget', { skip }, async t => {
  const text = Array.from({ length: 8 }, (_, i) => `Line ${i}: keep T-58 whole and preserve all of this text at narrow widths.`).join('\n');
  const c = await start(t, { messages: { general: Array.from({ length: 200 }, (_, i) => msg(`cost${i}`, i % 3 === 0 ? 'human' : 'implementer', text)) } });
  await c.waitScreen(s => s.includes('Line 7:'), 'history loaded');
  const costs = await c.lua<{ append: number; rewrite: number }>(`
    local t=require('cland.views').topic('general').thread
    local function median(n,fn)
      local samples={}
      for i=1,n do local start=vim.uv.hrtime(); fn(i); samples[i]=(vim.uv.hrtime()-start)/1e6 end
      table.sort(samples); return samples[math.ceil(n/2)]
    end
    local rewrite=median(15,function() t:render(); vim.cmd('redraw!') end)
    local append=median(31,function(i)
      t:add({id='cost-new-'..i,from='human',fromKind='human',to={'coordinator'},ts='2026-10-09T10:01:00Z',text='new line\\nsecond line',stage='queued'})
    end)
    return {append=append,rewrite=rewrite}
  `);
  t.diagnostic(`200 messages: append ${costs.append.toFixed(3)} ms (includes eviction); rewrite and redraw ${costs.rewrite.toFixed(3)} ms`);
  assert.ok(costs.append < 5, `append CI budget: ${costs.append} ms`);
  assert.ok(costs.rewrite < 75, `full rewrite CI budget: ${costs.rewrite} ms`);
});

test('a retained answer becomes standalone when its older ask leaves the 200-message window', { skip }, async t => {
  const ask = { ...msg('old-ask'), ts: '2026-10-08T10:00:00Z', text: 'Expired question', ask: { state: 'answered', options: ['chosen option'], free: true, option: 1 } };
  const answer = { ...msg('answer', 'human', 'Retained answer'), ts: '2026-10-09T10:00:00Z', answerTo: 'old-ask' };
  const c = await start(t, { messages: { general: [ask, answer, ...Array.from({ length: 198 }, (_, i) => ({ ...msg(`filler${i}`), ts: '2026-10-09T11:00:00Z' }))] } });
  assert.equal(await c.lua("return #require('cland.views').topic('general').thread.messages"), 200);
  assert.equal(await c.lua("return require('cland.views').topic('general').thread.by_id['old-ask'] ~= nil"), true, 'the ask starts in the live window');
  await c.control({ emit: { type: 'message', topic: { id: 'general', title: 'General' }, message: { ...msg('new'), ts: '2026-10-09T12:00:00Z' } } });
  await c.waitScreen(s => s.includes('Taking T-58.'), 'live append');
  await c.lua("vim.api.nvim_set_current_win(require('cland.layout').centre())");
  await c.input('gg');
  await c.waitScreen(s => s.includes('Retained answer'), 'the retained answer');
  assert.equal(await c.lua("return #require('cland.views').topic('general').thread.messages"), 200);
  const lines = await c.lua<string[]>("return vim.api.nvim_buf_get_lines(vim.fn.bufnr('cland://topic/general'),0,-1,false)");
  assert.ok(!lines.some(l => l.includes('Expired question')));
  assert.equal(lines.filter(l => l === 'Retained answer').length, 1);
  assert.equal(await c.lua(`
    local b=vim.fn.bufnr('cland://topic/general')
    local n=0
    for _,m in ipairs(vim.api.nvim_buf_get_extmarks(b,vim.api.nvim_get_namespaces()['cland.thread'],0,-1,{details=true})) do
      if m[4].virt_lines then n=n+1 end
    end
    return n
  `), 1, 'one rule for the retained local day after live eviction');
  await c.control({ emit: { type: 'delivery', topic: 'general', message: 'answer', stage: 'injected' } });
  await c.waitScreen(s => s.includes('✓✓ injected'), 'retained answer delivery');
});

test('generated live appends, ask evictions and delivery changes equal a full render', { skip }, async t => {
  // A public Neovim snapshot includes the virtual decorations and row gutters, not extmark ids.
  const snapshot = `
    local t=_G.thread_oracle or require('cland.views').topic('general').thread
    local marks={}
    for _,m in ipairs(vim.api.nvim_buf_get_extmarks(t.buf,vim.api.nvim_get_namespaces()['cland.thread'],0,-1,{details=true})) do
      marks[#marks+1]={row=m[2],col=m[3],details=m[4]}
    end
    local groups={}
    for _,i in ipairs(t.info) do groups[#groups+1]={group=i.group,header=i.head and i.head.id,ask=i.ask and i.ask.id,artifact=i.artifact and i.artifact.id} end
    return {lines=vim.api.nvim_buf_get_lines(t.buf,0,-1,false),marks=marks,groups=groups}
  `;
  type Snapshot = { lines: string[]; marks: Array<Record<string, unknown>>; groups: unknown[] };
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]));
    return value;
  };
  const markKey = (m: Record<string, unknown>) => JSON.stringify(canonical(m));
  const normalise = (s: Snapshot) => ({ ...s, marks: s.marks.sort((a, b) => markKey(a).localeCompare(markKey(b))) });
  for (let seed = 1; seed <= 4; seed++) {
    const messages: Array<Record<string, unknown>> = [];
    let number = 0;
    for (let day = 8; day <= 10; day++) {
      // Several early asks ensure unanswered and answered cards both cross the eviction boundary.
      for (let i = 0; i < 5; i++) {
        const id = `ask-${seed}-${day}-${i}`;
        const answered = (seed + i) % 2 === 0;
        messages.push({ ...msg(id), ts: `2026-10-${day.toString().padStart(2, '0')}T10:00:00Z`, ask: { state: answered ? 'answered' : 'closed', options: ['choice'], free: true, option: answered ? 1 : null } });
        if (answered) messages.push({ ...msg(`answer-${id}`, 'human', `Answer ${id}\nkept body`), ts: `2026-10-${(day + 1).toString().padStart(2, '0')}T09:00:00Z`, answerTo: id });
      }
      for (let i = 0; i < 62; i++) messages.push({ ...msg(`generated-${seed}-${number++}`, i % 3 === 0 ? 'human' : 'implementer', `Body ${i}\nsecond line`), ts: `2026-10-${day.toString().padStart(2, '0')}T11:00:00Z` });
    }
    // Cover exactly 200 messages and oversized snapshots requiring initial trimming.
    messages.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
    const c = await start(t, { messages: { general: messages.slice(0, seed === 1 ? 200 : 200 + seed) } }, 'UTC', false);
    await c.waitScreen(s => s.includes('Body'), 'generated history');
    const compare = async (label: string) => {
      const incremental = normalise(await c.lua<Snapshot>(snapshot));
      await c.lua(`
        local t=require('cland.views').topic('general').thread
        local win=require('cland.layout').centre()
        local oracle=require('cland.thread').new({id='differential',title=t.topic.title})
        _G.thread_oracle=oracle
        vim.api.nvim_win_set_buf(win,oracle.buf)
        oracle:merge(t.messages)
      `);
      const full = normalise(await c.lua<Snapshot>(snapshot));
      await c.lua(`
        local t=require('cland.views').topic('general').thread
        local win=require('cland.layout').centre()
        vim.api.nvim_win_set_buf(win,t.buf)
        vim.api.nvim_buf_delete(_G.thread_oracle.buf,{force=true})
        _G.thread_oracle=nil
      `);
      assert.deepEqual(incremental, full, label);
    };
    await compare(`seed ${seed}: initial history and trimming equal full render`);
    for (let step = 0; step < 24; step++) {
      const day = 11 + Math.floor(step / 8);
      const phase = step % 8;
      const isAsk = phase === 1 || phase === 4 || phase === 6;
      const answerTo = phase === 2 || phase === 7 ? `live-${seed}-${step - 1}` : undefined;
      const append = {
        ...msg(`live-${seed}-${step}`, isAsk ? 'coordinator' : 'human', `Live ${seed}/${step}\nbody`),
        ts: `2026-10-${day}T12:00:00Z`, answerTo,
        ...(isAsk ? { ask: { state: phase === 4 ? 'closed' : 'open', options: ['choice'], free: true } } : {}),
      };
      const boundary = await c.lua<string>(`
        local t=require('cland.views').topic('general').thread
        for _,m in ipairs(t.messages) do if m.fromKind=='human' then return m.id end end
      `);
      await c.control({ emits: [
        { type: 'message', topic: { id: 'general', title: 'General' }, message: append },
        { type: 'delivery', topic: 'general', message: append.id, stage: step % 2 === 0 ? 'injected' : 'delivered' },
        { type: 'delivery', topic: 'general', message: boundary, stage: 'injected' },
        { type: 'delivery', topic: 'general', message: boundary, stage: 'queued' },
      ] });
      // Flush through RPC and compare both presentations of the same retained messages.
      await c.waitScreen(s => s.includes(`Live ${seed}/${step}`), 'generated append');
      await compare(`seed ${seed}, live append ${step}: incremental presentation equals full render`);
    }
  }
});
