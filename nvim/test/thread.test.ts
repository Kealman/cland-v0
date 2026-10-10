// Topic blocks at the Neovim/stub-hub boundary (T-132).
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConnection } from 'node:net';
import { ownDirectory } from '../../hub/test/process-cleanup.ts';
import { spawnSpoke, startDaemon, tempProject } from '../../hub/test/harness.ts';
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

test('a digit in the thread answers through the real hub with answer_to; the ask and next chip share a header', { skip }, async t => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const asked = await coord.call<{ok: boolean; ask: string}>('ask', { topic: 'general', question: 'Which scope?', options: ['Whole diff', 'Fix only'] });
  assert.equal(asked.ok, true);
  await coord.call('artifact.create', { topic: 'general', kind: 'note', title: 'Review evidence', content: 'Evidence for the choice.' });
  const c = await startClient(t, bin, root);
  await c.waitScreen(s => s.includes('Review evidence') && s.includes('Which scope?'), 'real ask and chip');
  await c.input('<Esc>');
  await c.lua(`
    local t=require('cland.views').topic('general').thread
    vim.api.nvim_set_current_win(require('cland.layout').centre())
    for row in ipairs(t.info) do if t:ask_at(row) then vim.api.nvim_win_set_cursor(0,{row,0}); break end end
  `);
  await c.input('2');
  await coord.waitForEvent(e => e.params.meta?.from_kind === 'human' && e.params.content === 'Fix only' && e.params.meta.answer_to === asked.ask);
  await c.waitScreen(s => s.includes('┃ ✓ 2  Fix only') && s.includes('ask · ✓ answered'), 'answer in place');
  assert.deepEqual(await c.lua(`
    local t=require('cland.views').topic('general').thread
    local ask=t.by_id[...]
    local b=t.block_of[ask.id]
    local headers,targets=0,0
    for _,i in ipairs(b.info) do if i.head then headers=headers+1 end; if i.ask then targets=targets+1 end end
    return {messages=#b.msgs,headers=headers,open_targets=targets,artifact=b.msgs[2].artifact.id}
  `, asked.ask), {messages: 3, headers: 2, open_targets: 0, artifact: 'A-1'});
  await c.lua(`
    local t=require('cland.views').topic('general').thread
    for row,i in ipairs(t.info) do if i.artifact then vim.api.nvim_win_set_cursor(0,{row,0}); break end end
  `);
  await c.input('<CR>');
  await c.waitScreen(s => s.includes('Evidence for the choice.'), 'grouped chip opens its durable source');
});

test('live chip grouping rewrites only its ask, and unrelated senders, intervening messages and days keep headers', { skip }, async t => {
  const ask = (id: string) => ({ ...msg(id), to: [], text: 'Ask ' + id, ask: {state: 'open', options: ['Yes'], free: true} });
  const chip = (id: string) => ({ ...msg(id), to: [], artifact: {id: 'A-' + id, kind: 'note', title: 'Evidence ' + id} });
  const c = await start(t, {messages: {general: [msg('earlier'), ask('live')]}});
  await c.lua(`
    local t=require('cland.views').topic('general').thread
    _G.changes={}; _G.ask_start=t.block_of.live.start
    vim.api.nvim_buf_attach(t.buf,false,{on_lines=function(_,_,_,first,last,newlast) _G.changes[#_G.changes+1]={first,last,newlast} end})
  `);
  await c.control({emit: {type:'message', topic:{id:'general',title:'General'}, message:chip('live-chip')}});
  await c.waitScreen(s => s.includes('Evidence live-chip'), 'live grouped chip');
  assert.deepEqual(await c.lua(`
    local t=require('cland.views').topic('general').thread
    return {changes=#_G.changes,from=_G.changes[1][1],start=_G.ask_start,shared=t.block_of.live==t.block_of['live-chip'],headers=vim.tbl_count(t.block_of.live.heads)}
  `), {changes:1,from:3,start:3,shared:true,headers:1});
  const messages = [ask('other'), {...chip('other-chip'),from:'another-coordinator'}, ask('intervening'), msg('between'), chip('separate'), ask('day'), {...chip('next-day'),ts:'2026-10-10T10:00:00Z'}];
  await c.lua("require('cland.views').topic('general').thread:merge(...)", messages);
  assert.deepEqual(await c.lua(`
    local t=require('cland.views').topic('general').thread
    local out={}
    for _,pair in ipairs({{'other','other-chip'},{'intervening','separate'},{'day','next-day'}}) do out[#out+1]=t.block_of[pair[1]]~=t.block_of[pair[2]] end
    return out
  `), [true,true,true]);
});

test('asks have an amber band, kinds stay visible and a clear verdict is one dimmed row while failures keep notes', { skip }, async t => {
  const c = await start(t, {messages:{general:[
    {...msg('ask'),ask:{state:'open',options:['Yes'],free:true}},
    ...['progress','report','question','decision'].map(kind => ({...msg(kind),kind})),
    {...msg('clear','qa','qa clear T-58\nLong supporting detail'),kind:'report'},
    {...msg('failed','reviewer','review not clear T-58\nC3 failed: the order is wrong.'),kind:'report'},
  ]}});
  const result = await c.lua<{kinds:string[]; clear:string[]; failed:string[]; group:string; band:number; colour:number; bright:number}>(`
    local t=require('cland.views').topic('general').thread
    local kinds={}; for _,id in ipairs({'progress','report','question','decision'}) do kinds[#kinds+1]=t.block_of[id].lines[2] end
    local band=0
    for _,m in ipairs(vim.api.nvim_buf_get_extmarks(t.buf,vim.api.nvim_get_namespaces()['cland.thread'],0,-1,{details=true})) do if m[4].line_hl_group=='ClandAsk' then band=band+1 end end
    return {kinds=kinds,clear=t.block_of.clear.lines,failed=t.block_of.failed.lines,group=t.block_of.clear.info[2].group,band=band,colour=vim.api.nvim_get_hl(0,{name='ClandRoleQaWatch'}).fg,bright=vim.api.nvim_get_hl(0,{name='ClandRoleQa'}).fg}
  `);
  result.kinds.forEach((header,i) => assert.ok(header.endsWith(' · ' + ['progress','report','question','decision'][i])));
  assert.equal(result.clear.length,2,'one message row plus its outside separator');
  assert.match(result.clear[1] ?? '', /✓ qa clear T-58$/);
  assert.ok(result.failed.includes('C3 failed: the order is wrong.'));
  assert.equal(result.group,'ClandRoleQaWatch');
  assert.notEqual(result.colour,result.bright);
  assert.equal(result.band,3,'question, option and hint are banded');
});

test('message Markdown conceals headings, code and links and highlights visible item ids', { skip }, async t => {
  const text = '## Plan\nUse `history` and [the brief](https://example.com/brief).\n- take **T-58**\n```lua\nprint(1)\n```';
  const c = await start(t, { messages: { general: [msg('markdown', 'coordinator', text)] } });
  await c.lua("vim.api.nvim_set_current_win(require('cland.layout').centre())");
  await c.input('gg');
  const screen = await c.waitScreen(s => s.includes('Use history and the brief.'), 'concealed Markdown');
  assert.match(screen, /• take T-58/);
  assert.match(screen, /  print\(1\)/);
  assert.ok(!screen.includes('## Plan') && !screen.includes('```'));
  const groups = await c.lua<string[]>(`
    local b=vim.fn.bufnr('cland://topic/general')
    local groups={}
    for _,m in ipairs(vim.api.nvim_buf_get_extmarks(b,vim.api.nvim_get_namespaces()['cland.thread'],0,-1,{details=true})) do
      if m[4].hl_group then groups[#groups+1]=m[4].hl_group end
    end
    return groups
  `);
  for (const group of ['ClandHeading', 'ClandCode', 'ClandLink', 'ClandBlue']) assert.ok(groups.includes(group), group);
});

test('reference links and narrow table header links keep destinations and Markdown styling', { skip }, async t => {
  const destination = 'https://example.com/reference';
  const c = await start(t, { messages: { general: [
    msg('references', 'coordinator', `[brief][ref] and [ref][] and [ref].\n\n[ref]: ${destination}`),
    msg('header-links', 'coordinator', '| **Item** | [State](https://example.com/state) | Description |\n|---|---|---|\n| T-58 | open | ' + 'detail '.repeat(10) + '|'),
  ] } });
  await c.lua('vim.o.columns=80');
  await c.input('<Esc><Space>i');
  await c.lua("vim.api.nvim_set_current_win(require('cland.layout').centre())");
  await c.input('gg');
  await c.waitScreen(s => s.includes('Item: T-58') && s.includes('State: open'), 'stacked Markdown headers');
  const rows = await c.lua<Array<{line: string; links: Array<{destination: string}>}>>(`
    local t=require('cland.views').topic('general').thread
    local out={}
    for r,l in ipairs(vim.api.nvim_buf_get_lines(t.buf,0,-1,false)) do
      if l:find('[brief]',1,true) or l:find('State',1,true) then out[#out+1]={line=l,links=t.info[r].links} end
    end
    return out
  `);
  assert.deepEqual(rows[0]?.links.map(l => l.destination), [destination, destination, destination]);
  assert.deepEqual(rows[1]?.links.map(l => l.destination), ['https://example.com/state']);
  assert.ok(!rows[1]?.line.includes('https://'), 'header destination is compacted too');
});

test('header-only tables retain content and table fitting uses concealed cell widths', { skip }, async t => {
  const destination = 'https://example.com/' + 'long-destination/'.repeat(10);
  const c = await start(t, { messages: { general: [
    msg('header-only', 'coordinator', '| ' + 'wide '.repeat(20) + 'HEADER-END | State |\n|---|---|'),
    msg('visually-small', 'coordinator', `| [Item](${destination}) | State |\n|---|---|\n| T-58 | open |`),
  ] } });
  await c.lua('vim.o.columns=80');
  await c.input('<Esc><Space>i');
  await c.lua("vim.api.nvim_set_current_win(require('cland.layout').centre())");
  await c.input('gg');
  const screen = await c.waitScreen(s => s.includes('HEADER-END'), 'wide header-only content survives');
  assert.match(screen, /\| Item +\| State +\|/);
  assert.match(screen, /\| T-58 +\| open +\|/);
  assert.ok(!screen.includes('long-destination'));
});

test('duplicate references and autolinks retain their destination and label ranges', { skip }, async t => {
  const c = await start(t, { messages: { general: [
    msg('duplicate', 'coordinator', '[a]\n\n[a]: /first\n[a]: /second'),
    msg('autolinks', 'coordinator', 'Autolinks <https://example.com> <a@example.com>'),
  ] } });
  await c.lua("vim.api.nvim_set_current_win(require('cland.layout').centre())");
  await c.input('gg');
  await c.waitScreen(s => s.includes('Autolinks'), 'autolink body');
  const rows = await c.lua<Array<{line: string; links: Array<{col: number; end_col: number; destination: string}>}>>(`
    local thread=require('cland.views').topic('general').thread
    local out={}
    for r,line in ipairs(vim.api.nvim_buf_get_lines(thread.buf,0,-1,false)) do
      out[#out+1]={line=line,links=thread.info[r].links or {}}
    end
    return out
  `);
  assert.deepEqual(rows.find(r => r.line === '[a]')?.links.map(l => l.destination), ['/first']);
  const auto = rows.find(r => r.line.startsWith('Autolinks '));
  assert.deepEqual(auto?.links.map(l => [auto.line.slice(l.col, l.end_col), l.destination]), [
    ['https://example.com', 'https://example.com'], ['a@example.com', 'mailto:a@example.com'],
  ]);
});

test('generated ragged tables preserve every header and cell text and target in projection order', { skip }, async t => {
  type Cell = { text: string; destination: string };
  type Projection = { lines: string[]; metadata: Array<{links: Array<{col: number; end_col: number; destination: string}>}> };
  const widths = [40, 78, 118, 512];
  const tables = Array.from({ length: 12 }, (_, seed) => {
    const headers = Array.from({ length: 2 + seed % 4 }, (_, column): Cell => ({
      text: 'H' + seed + '_' + column,
      destination: 'https://example.com/header/' + seed + '/' + column,
    }));
    const rows = [1, headers.length - 1, headers.length, headers.length + 1, headers.length + 3].map((count, row) =>
      Array.from({ length: count }, (_, column): Cell => ({
        text: 'C' + seed + '_' + row + '_' + column + ' ' + 'payload '.repeat((seed + row + column) % 4 + 1).trimEnd(),
        destination: 'https://example.com/cell/' + seed + '/' + row + '/' + column,
      })),
    );
    const source = (cells: Cell[], header = false) => '| ' + cells.map(cell =>
      '[' + (header ? '**' + cell.text + '**' : cell.text) + '](' + cell.destination + ')').join(' | ') + ' |';
    return { headers, rows, source: [source(headers, true), '| ' + headers.map(() => '---').join(' | ') + ' |', ...rows.map(row => source(row))].join('\n') };
  });
  const c = await start(t, { messages: { general: [msg('projection-seam')] } });
  const projections = await c.lua<Projection[][]>(`
    local bodies,widths=...
    local result={}
    for i,body in ipairs(bodies) do
      result[i]={}
      for k,width in ipairs(widths) do
        local lines,_,metadata=require('cland.thread_md').render(body,width)
        result[i][k]={lines=lines,metadata=metadata}
      end
    end
    return result
  `, tables.map(table => table.source), widths);
  let stacked = 0, full = 0;
  for (const [i, table] of tables.entries()) {
    for (const [k, width] of widths.entries()) {
      const projection = projections[i]![k]!;
      const isFull = projection.lines[0]?.startsWith('| ') ?? false;
      const expected: Cell[] = [];
      if (isFull) { full++; expected.push(...table.headers, ...table.rows.flat()); }
      else {
        stacked++;
        for (const row of table.rows) {
          for (let column = 0; column < Math.max(table.headers.length, row.length); column++) {
            if (table.headers[column]) expected.push(table.headers[column]!);
            if (row[column]) expected.push(row[column]!);
          }
        }
      }
      const actual = projection.metadata.flatMap((metadata, row) => metadata.links.map(link => ({
        text: Buffer.from(projection.lines[row]!).subarray(link.col, link.end_col).toString(), destination: link.destination,
      })));
      assert.deepEqual(actual, expected, 'table ' + i + ', width ' + width + ': ordered text and destinations');
      assert.deepEqual(projection.lines.join('\n').match(/[HC]\d+_\d+(?:_\d+)?/g), expected.map(cell => cell.text.split(' ')[0]),
        'table ' + i + ', width ' + width + ': every source cell remains in the buffer');
      if (width === 512) assert.ok(isFull, 'wide projection uses complete rows');
    }
  }
  assert.ok(stacked > 0 && full > 0, 'both layouts exercised');
});

test('unclosed fences are isolated, rejected bodies stay plain, and append parses only fresh text', { skip }, async t => {
  const c = await start(t, { messages: { general: [msg('open', 'implementer', '```lua\nlocal value = 1'), msg('next', 'coordinator', '## Still a heading\n**T-58**')] } });
  await c.lua("vim.api.nvim_set_current_win(require('cland.layout').centre())");
  await c.input('gg');
  await c.waitScreen(s => s.includes('Still a heading') && !s.includes('## Still'), 'heading after unclosed fence');
  await c.lua(`
    _G.body_parses={}
    local original=vim.treesitter.get_string_parser
    vim.treesitter.get_string_parser=function(text,lang,...)
      _G.body_parses[#_G.body_parses+1]=text
      if text:find('REJECT-BODY',1,true) then error('parser rejected body') end
      return original(text,lang,...)
    end
  `);
  const fresh = '## FRESH-BODY\n[brief](https://example.com/fresh)';
  await c.control({ emit: { type: 'message', topic: { id: 'general', title: 'General' }, message: msg('fresh', 'coordinator', fresh) } });
  await c.waitScreen(s => s.includes('FRESH-BODY'), 'fresh body');
  assert.deepEqual(await c.lua('return _G.body_parses'), [fresh + '\n'], 'one parse on append');
  await c.control({ emit: { type: 'message', topic: { id: 'general', title: 'General' }, message: msg('repeat', 'coordinator', fresh) } });
  await c.lua("require('cland.views').topic('general').thread:render()");
  assert.deepEqual(await c.lua('return _G.body_parses'), [fresh + '\n'], 'text cache survives repeated bodies and full rewrites');
  const rejected = '## REJECT-BODY\n[raw](https://example.com/raw)';
  await c.control({ emit: { type: 'message', topic: { id: 'general', title: 'General' }, message: msg('rejected', 'coordinator', rejected) } });
  await c.waitScreen(s => s.includes('## REJECT-BODY') && s.includes('[raw](https://example.com/raw)'), 'plain rejected body');
  await c.lua("require('cland.views').topic('general').thread:render()");
  assert.deepEqual(await c.lua('return _G.body_parses'), [fresh + '\n', rejected + '\n'], 'failed parses are cached too');
});

test('verdict results are red/green and the registry gi opens a concealed item reference', { skip }, async t => {
  const c = await start(t, { items: [{ id: 'T-58', title: 'Markdown target', state: 'open', kind: 'task' }], messages: { general: [
    msg('fail', 'reviewer', 'review not clear T-58\nA criterion failed.'),
    msg('pass', 'qa', 'qa clear T-58'),
    msg('target', 'coordinator', 'See **T-58**.'),
  ] } });
  const marks = await c.lua<Array<{line: string; group: string}>>(`
    local b=vim.fn.bufnr('cland://topic/general')
    local out={}
    for _,m in ipairs(vim.api.nvim_buf_get_extmarks(b,vim.api.nvim_get_namespaces()['cland.thread'],0,-1,{details=true})) do
      if m[4].hl_group=='ClandRed' or m[4].hl_group=='ClandGreen' then
        out[#out+1]={line=vim.api.nvim_buf_get_lines(b,m[2],m[2]+1,false)[1],group=m[4].hl_group}
      end
    end
    return out
  `);
  assert.equal(marks[0]?.line, 'review not clear T-58');
  assert.equal(marks[0]?.group, 'ClandRed');
  assert.match(marks[1]?.line ?? '', /qa \[QA\].*· report  ✓ qa clear T-58$/);
  assert.equal(marks[1]?.group, 'ClandGreen');
  await c.lua(`
    local w=require('cland.layout').centre()
    vim.api.nvim_set_current_win(w)
    for r,l in ipairs(vim.api.nvim_buf_get_lines(vim.api.nvim_win_get_buf(w),0,-1,false)) do
      if l=='See **T-58**.' then vim.api.nvim_win_set_cursor(w,{r,l:find('T-58',1,true)-1}) end
    end
  `);
  await c.input('gi');
  await c.waitScreen(s => s.includes('Markdown target'), 'gi item view');
  assert.deepEqual(await c.lua('return require("cland.actions").audit()'), []);
});

test('resize bursts project once at final width and stale closed/reused windows do nothing', { skip }, async t => {
  const text = '| Item | Description |\n|---|---|\n| T-58 | ' + 'detail '.repeat(10) + '|';
  const c = await start(t, { messages: { general: [msg('table-width', 'coordinator', text)] } });
  await c.lua(`
    local api=vim.api
    local t=require('cland.views').topic('general').thread
    local w=api.nvim_open_win(t.buf,false,{split='right',win=require('cland.layout').centre()})
    _G.width_win=w
    _G.width_changes={}
    api.nvim_buf_attach(t.buf,false,{on_lines=function(_,_,_,first,last,newlast)
      _G.width_changes[#_G.width_changes+1]={first,last,newlast}
    end})
    for _,width in ipairs({40,45,50}) do
      api.nvim_win_set_width(w,width)
      api.nvim_exec_autocmds('WinResized',{})
    end
  `);
  const burst = await c.lua<{ changes: number[][]; width: number; rendered: number }>(`
    local t=require('cland.views').topic('general').thread
    return {changes=_G.width_changes,width=t:_width(),rendered=t.body_width}
  `);
  assert.equal(burst.changes.length, 1, 'one projection for the synchronous resize burst');
  assert.equal(burst.rendered, burst.width, 'callback measures final live window width');
  await c.lua('vim.api.nvim_win_close(_G.width_win,true)');
  for (const transition of ['close', 'reuse']) {
    await c.lua(`
      local api=vim.api
      local t=require('cland.thread').new({id='stale-${transition}',title='Stale'})
      t:merge({{id='stale-message',from='coordinator',fromKind='agent',fromRole='coordinator',to={'human'},text='${text.replaceAll('\n', '\\n')}',ts='2026-10-09T10:00:00Z'}})
      local w=api.nvim_open_win(t.buf,false,{split='right',win=require('cland.layout').centre()})
      _G.stale_changes=0
      api.nvim_buf_attach(t.buf,false,{on_lines=function() _G.stale_changes=_G.stale_changes+1 end})
      api.nvim_win_set_width(w,40)
      api.nvim_exec_autocmds('WinResized',{})
      ${transition === 'close' ? 'api.nvim_win_close(w,true)' : 'api.nvim_win_set_buf(w,api.nvim_create_buf(false,true)); _G.reused_win=w'}
    `);
    assert.equal(await c.lua('return _G.stale_changes'), 0, `${transition} invalidates the queued window`);
    if (transition === 'reuse') await c.lua('vim.api.nvim_win_close(_G.reused_win,true)');
  }
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
  return Object.assign(c, { control: (cmd: Record<string, unknown>) => new Promise<Record<string, unknown>>((resolve, reject) => {
    const sock = createConnection(controlPath);
    let text = '';
    sock.setEncoding('utf8');
    sock.on('error', reject);
    sock.on('data', chunk => { text += chunk; if (text.includes('\n')) { sock.end(); resolve(JSON.parse(text.slice(0, text.indexOf('\n')))); } });
    sock.write(`${JSON.stringify(cmd)}\n`);
  }) });
}

test('General shows addressees, local day rules, role gutters and the human band', { skip }, async t => {
  const c = await start(t, { messages: { general: [msg('c'), msg('i', 'implementer'), msg('r', 'reviewer'), msg('q', 'qa'), msg('h', 'human', 'Please take T-58.')] } });
  const screen = await c.waitScreen(s => s.includes('coordinator [Coordinator] → you  10:00'), 'the message header');
  assert.match(screen, /── Fri 9 Oct/);
  assert.match(screen, /[▎▌] you → coordinator  10:00 · message +⌁ queued/);
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
    local names={'statuscolumn','wrap','linebreak','breakindent','breakindentopt','conceallevel','concealcursor','foldmethod','foldtext','foldenable','foldlevel','foldminlines','foldcolumn','fillchars'}
    local defaults={statuscolumn='',wrap=true,linebreak=false,breakindent=false,breakindentopt='',conceallevel=0,concealcursor='',foldmethod='indent',foldtext='foldtext()',foldenable=false,foldlevel=7,foldminlines=3,foldcolumn='1',fillchars='fold:-,vert:|'}
    api.nvim_win_call(win,function()
      for name,value in pairs(defaults) do api.nvim_set_option_value(name,value,{scope='global'}) end
    end)
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
    api.nvim_win_call(win,function()
      for _,name in ipairs(names) do global_after[name]=api.nvim_get_option_value(name,{scope='global'}) end
    end)
    api.nvim_win_close(scratch,true)
    api.nvim_buf_delete(buf,{force=true})
    return {thread=thread,scratch=restored,defaults=defaults,reentered=reentered,reset_again=reset_again,global_after=global_after}
  `);
  assert.deepEqual(result.thread, { statuscolumn: '%!v:lua.ClandThreadGutter()', wrap: true, linebreak: true, breakindent: true, breakindentopt: 'list:-1', conceallevel: 2, concealcursor: 'nc', foldmethod: 'manual', foldtext: 'v:lua.ClandThreadFoldText()', foldenable: true, foldlevel: 0, foldminlines: 0, foldcolumn: '0', fillchars: 'fold: ' });
  assert.deepEqual(result.scratch, result.defaults);
  assert.deepEqual(result.reentered, result.thread);
  assert.deepEqual(result.reset_again, result.defaults);
  assert.deepEqual(result.global_after, result.defaults, 'thread settings never change window-option defaults');
});

test('background fold reconstruction leaves the focused board alone and rejects non-thread windows', { skip }, async t => {
  const c = await start(t, { messages: { general: [
    { ...msg('agent-a', 'implementer'), to: ['reviewer'] },
    { ...msg('agent-b', 'reviewer'), to: ['implementer'] },
  ] }, items: [
    { id: 'T-1', kind: 'release', title: 'Release', state: 'open' },
    { id: 'T-2', kind: 'epic', title: 'Epic', parent: 'T-1', state: 'open' },
    { id: 'T-14', kind: 'task', title: 'First', parent: 'T-2', status: 'planned', state: 'open', rank: 10 },
    { id: 'T-21', kind: 'task', title: 'Selected', parent: 'T-2', status: 'planned', state: 'open', rank: 20 },
  ], rankEvents: 'manual' }, 'UTC', false);
  await c.input('<Esc><Space>i');
  await c.waitScreen(s => s.includes('Selected'), 'board rows');
  const result = await c.lua<{ before: unknown; after: unknown; wrong_window: number; resets: number }>(`
    local api=vim.api
    local thread=require('cland.views').topic('general').thread
    local board=require('cland.layout').win.left
    api.nvim_set_current_win(board)
    api.nvim_set_option_value('foldmethod','manual',{scope='local',win=board})
    vim.cmd('2,3fold')
    for row,line in ipairs(api.nvim_buf_get_lines(api.nvim_win_get_buf(board),0,-1,false)) do
      if line:find(' T-21 ',1,true) then api.nvim_win_set_cursor(board,{row,0}) end
    end
    local function snapshot()
      local folds={}
      for row=1,api.nvim_buf_line_count(api.nvim_win_get_buf(board)) do
        folds[#folds+1]={vim.fn.foldlevel(row),vim.fn.foldclosed(row),vim.fn.foldclosedend(row)}
      end
      return {win=api.nvim_get_current_win(),mode=api.nvim_get_mode().mode,cursor=api.nvim_win_get_cursor(board),line=api.nvim_get_current_line(),folds=folds}
    end
    local before=snapshot()
    local command=vim.cmd
    local wrong_window,resets=0,0
    vim.cmd=function(text)
      if text:find('fold') or text:find('zE') then
        if api.nvim_get_current_buf()~=thread.buf then wrong_window=wrong_window+1 end
      end
      local value=command(text)
      if text=='normal! zE' then
        resets=resets+1
        for row=1,api.nvim_buf_line_count(thread.buf) do
          assert(vim.fn.foldlevel(row)==0,'reset actually removes every manual fold')
        end
      end
      return value
    end
    local ok,err=pcall(function()
      thread:render()
      thread:_build_folds(require('cland.layout').centre(), thread.fold_states[require('cland.layout').centre()])
      thread:_build_folds(board, {})
      assert(not thread:fold('zM'),'fold keys reject the focused non-thread window')
      assert(next(thread:_fold_states(board))==nil,'fold-state reads reject non-thread windows')
      assert(thread:folded_count(board)==0,'fold counts reject non-thread windows')
    end)
    vim.cmd=command
    if not ok then error(err) end
    return {before=before,after=snapshot(),wrong_window=wrong_window,resets=resets}
  `);
  assert.equal(result.wrong_window, 0, 'fold handlers never execute on a non-thread window');
  assert.ok(result.resets > 0, 'the real-run thread was reset and rebuilt while the board was focused');
  assert.deepEqual(result.after, result.before, 'board folds, cursor, selection, mode and focus survive background reconstruction');
  await c.input('T');
  const received = await c.control({ requests: true });
  const ranks = (received.requests as Array<Record<string, unknown>>).filter(frame => frame.type === 'task.rank');
  assert.equal(ranks[0]?.item, 'T-21', 'board rank key still selects its item after background fold work');
  assert.equal(ranks[0]?.top, true);
  const item = { id: 'T-21', kind: 'task', title: 'Selected', parent: 'T-2', status: 'planned', state: 'open', rank: 20 };
  await c.control({ emit: { type: 'task', id: 'T-21', item, siblings: ['T-21', 'T-14'] } });
  await c.waitScreen(s => /T-21.*next/.test(s), 'rank event moves selected item first');
  await c.input('J');
  await c.control({ emit: { type: 'task', id: 'T-21', item, siblings: ['T-14', 'T-21'] } });
  await c.waitScreen(s => /T-14.*next/.test(s), 'rank event moves selected item second');
  await c.input('K');
  const final = await c.control({ requests: true });
  const moves = (final.requests as Array<Record<string, unknown>>).filter(frame => frame.type === 'task.rank');
  assert.equal(moves[1]?.after, 'T-14');
  assert.equal(moves[2]?.before, 'T-14');
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
  const text = '## Plan\nLine 1: **T-58** and `history`\n- keep words aligned under the bullet\n[brief](https://example.com/a/long/destination)\n```lua\nlocal value = 1\nprint(value)\n```';
  const c = await start(t, { messages: { general: Array.from({ length: 200 }, (_, i) => msg(`cost${i}`, i % 3 === 0 ? 'human' : 'implementer', text)) } });
  await c.waitScreen(s => s.includes('print(value)'), 'history loaded');
  const costs = await c.lua<{ append: number; rewrite: number; cold: number; coldParses: number; warmParses: number }>(`
    local t=require('cland.views').topic('general').thread
    local function median(n,fn)
      local samples={}
      for i=1,n do local start=vim.uv.hrtime(); fn(i); samples[i]=(vim.uv.hrtime()-start)/1e6 end
      table.sort(samples); return samples[math.ceil(n/2)]
    end
    local api=vim.api
    local original=vim.treesitter.get_string_parser
    local parses=0
    vim.treesitter.get_string_parser=function(...) parses=parses+1; return original(...) end
    local win=require('cland.layout').centre()
    local cold_thread=require('cland.thread').new({id='cold-cost',title='Cold'})
    api.nvim_win_set_buf(win,cold_thread.buf)
    local cold_messages=vim.deepcopy(t.messages)
    for i,m in ipairs(cold_messages) do m.text=m.text..'\\nCold '..i end
    local start=vim.uv.hrtime()
    cold_thread:merge(cold_messages); vim.cmd('redraw!')
    local cold=(vim.uv.hrtime()-start)/1e6
    local coldParses=parses
    api.nvim_win_set_buf(win,t.buf)
    api.nvim_buf_delete(cold_thread.buf,{force=true})
    parses=0
    local rewrite=median(15,function() t:render(); vim.cmd('redraw!') end)
    local warmParses=parses
    vim.treesitter.get_string_parser=original
    local append=median(31,function(i)
      t:add({id='cost-new-'..i,from='human',fromKind='human',to={'coordinator'},ts='2026-10-09T10:01:00Z',text='## New '..i..'\\nUse \`history\` and **T-58**',stage='queued'})
    end)
    return {append=append,rewrite=rewrite,cold=cold,coldParses=coldParses,warmParses=warmParses}
  `);
  t.diagnostic(`200 messages: append ${costs.append.toFixed(3)} ms (includes eviction); rewrite and redraw ${costs.rewrite.toFixed(3)} ms`);
  t.diagnostic(`Cold distinct-body render ${costs.cold.toFixed(3)} ms / ${costs.coldParses} parses; warm render ${costs.warmParses} parses`);
  assert.equal(costs.coldParses, 200);
  assert.equal(costs.warmParses, 0);
  assert.ok(costs.append <= 2, `append budget: ${costs.append} ms`);
  assert.ok(costs.rewrite <= 35, `warm rewrite budget: ${costs.rewrite} ms`);
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
    for _,i in ipairs(t.info) do groups[#groups+1]={group=i.group,header=i.head and i.head.id,ask=i.ask and i.ask.id,artifact=i.artifact and i.artifact.id,links=i.links,layer=i.b and i.b.layer} end
    local folds=vim.api.nvim_win_call(require('cland.layout').centre(),function()
      local out={}
      for _,run in ipairs(t:_runs()) do
        local first,last=run.first.start+2,run.last.start+run.last.n
        local ids={}; for _,m in ipairs(run.messages) do ids[#ids+1]=m.id end
        out[#out+1]={first=first,last=last,ids=ids,open=vim.fn.foldclosed(first)==-1}
      end
      return out
    end)
    return {lines=vim.api.nvim_buf_get_lines(t.buf,0,-1,false),marks=marks,groups=groups,folds=folds}
  `;
  type Snapshot = { lines: string[]; marks: Array<Record<string, unknown>>; groups: unknown[]; folds: unknown[] };
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
        messages.push({ ...msg(`chip-${id}`), ts: `2026-10-${day.toString().padStart(2, '0')}T10:00:00Z`, to: [], artifact: { id: `A-${seed}-${day}-${i}`, kind: 'note', title: 'Ask evidence' } });
        if (answered) messages.push({ ...msg(`answer-${id}`, 'human', `Answer ${id}\nkept body`), ts: `2026-10-${(day + 1).toString().padStart(2, '0')}T09:00:00Z`, answerTo: id });
      }
      const bodies = ['Body **T-58**\n[brief](https://example.com/long/destination)', 'Body `history`\n- list text', 'Body fenced\n```lua\nprint(1)\n```', 'Body unclosed\n```sh\nnot a later message', 'Body table\n\n| Item | Description |\n|---|---|\n| T-58 | ' + 'detail '.repeat(10) + '|', 'Body multiline [the\nbrief](https://example.com/multiline)', 'Body references [brief][ref] and [ref][]\n\n[ref]: https://example.com/reference', 'Body header-only\n\n| ' + 'wide '.repeat(20) + '| **State** |\n|---|---|', 'Body duplicates [a]\n\n[a]: /first\n[a]: /second', 'Body autolinks <https://example.com> <a@example.com>', 'Body sparse\n\n| First | [Second](https://example.com/second) |\n|---|---|\n| short |\n| ' + 'long '.repeat(16) + '| present |', 'Body surplus\n\n| First | [Second](https://example.com/second) |\n|---|---|\n| short | [extra](https://example.com/extra) | [surplus](https://example.com/surplus) |\n| ' + 'long '.repeat(16) + '| present | tail |', 'Body linked headers\n\n| [Item](https://example.com/' + 'long/'.repeat(15) + ') | **State** |\n|---|---|\n| T-58 | open |'];
      for (let i = 0; i < 62; i++) messages.push({ ...msg(`generated-${seed}-${number++}`, i % 13 === 0 ? 'qa' : i % 3 === 0 ? 'human' : 'implementer', i % 13 === 0 ? (i % 2 ? 'qa not clear T-58\nC3 failed: preserve this note.' : 'qa clear T-58\nDetails omitted from compact clear verdict.') : bodies[i % bodies.length]), kind: ['report', 'question', 'decision', 'progress'][i % 4], to: [i % 3 === 0 ? 'coordinator' : 'reviewer'], ts: `2026-10-${day.toString().padStart(2, '0')}T11:00:00Z` });
    }
    // Cover exactly 200 messages and oversized snapshots requiring initial trimming.
    messages.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
    const c = await start(t, { messages: { general: messages.slice(0, seed === 1 ? 200 : 200 + seed) } }, 'UTC', false);
    await c.lua(`vim.o.columns=${seed % 2 ? 80 : 120}`);
    await c.waitScreen(s => s.includes('Body'), 'generated history');
    const compare = async (label: string) => {
      const incremental = normalise(await c.lua<Snapshot>(snapshot));
      await c.lua(`
        local t=require('cland.views').topic('general').thread
        local win=require('cland.layout').centre()
        local oracle=require('cland.thread').new({id='differential',title=t.topic.title})
        _G.thread_oracle=oracle
        local states=t:_fold_states(win)
        vim.api.nvim_win_set_buf(win,oracle.buf)
        oracle:merge(t.messages)
        oracle:_build_folds(win,states)
      `);
      const full = normalise(await c.lua<Snapshot>(snapshot));
      await c.lua(`
        local t=require('cland.views').topic('general').thread
        local win=require('cland.layout').centre()
        vim.api.nvim_win_set_buf(win,t.buf)
        vim.api.nvim_buf_delete(_G.thread_oracle.buf,{force=true})
        _G.thread_oracle=nil
      `);
      for (let i = 0; i < Math.max(incremental.lines.length, full.lines.length); i++) {
        assert.equal(incremental.lines[i], full.lines[i], `${label}: line ${i}`);
      }
      assert.deepEqual(incremental.groups, full.groups, label + ': row metadata');
      assert.deepEqual(incremental.folds, full.folds, label + ': fold membership, ranges and window state');
      for (let i = 0; i < Math.max(incremental.marks.length, full.marks.length); i++) {
        assert.deepEqual(incremental.marks[i], full.marks[i], `${label}: extmark ${i}`);
      }
    };
    await c.lua(`
      local t=require('cland.views').topic('general').thread
      local states={}
      for i,r in ipairs(t:_runs()) do if i%2==0 then for _,m in ipairs(r.messages) do states[m.id]=true end end end
      t:_build_folds(require('cland.layout').centre(),states)
    `);
    await compare(`seed ${seed}: initial history and trimming equal full render`);
    for (let step = 0; step < 24; step++) {
      const day = 11 + Math.floor(step / 8);
      const phase = step % 8;
      const isAsk = phase === 1 || phase === 4 || phase === 6;
      const answerTo = phase === 2 || phase === 7 ? `live-${seed}-${step - 1}` : undefined;
      const append = {
        ...msg(`live-${seed}-${step}`, isAsk || phase === 5 ? 'coordinator' : 'human', `Live ${seed}/${step}\n**T-58** and [brief](https://example.com/${step})\n${step % 2 ? '```lua\nprint(1)\n```' : '- list `history`'}`),
        ts: `2026-10-${day}T12:00:00Z`, answerTo,
        ...(phase === 5 ? { to: [], artifact: { id: `A-live-${seed}-${step}`, kind: 'note', title: `Live ${seed}/${step}` } } : {}),
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


test('one message layer rule covers the Messages table and every never-fold boundary', { skip }, async t => {
  const c = await start(t, { messages: { general: [msg('layers')] } });
  const cases = [
    [msg('human', 'human'), 'now'],
    [msg('addressed', 'implementer'), 'now'],
    [msg('coordinator-report', 'coordinator'), 'now'],
    [{ ...msg('report-kind'), kind: 'report' }, 'now'],
    [{ ...msg('ask'), to: ['reviewer'], ask: {state: 'open'} }, 'now'],
    [{ ...msg('answer', 'implementer'), to: ['reviewer'], answerTo: 'unknown' }, 'now'],
    [{ ...msg('clear', 'reviewer', 'review clear T-58'), to: ['implementer'] }, 'watch'],
    [{ ...msg('not-clear', 'qa', 'qa not clear T-58'), to: ['implementer'] }, 'now'],
    [{ ...msg('aide', 'aide'), to: ['implementer'] }, 'now'],
    [{ ...msg('to-aide', 'implementer'), to: ['human-aide'] }, 'now'],
    [{ ...msg('exchange', 'implementer'), to: ['reviewer'] }, 'background'],
    [{ ...msg('artifact', 'implementer'), to: [], artifact: {id:'A-1'} }, 'background'],
    [{ ...msg('attached-report'), to: [], artifact: {id:'A-1'}, artifacts: [{id:'A-1'}] }, 'now'],
    [{ ...msg('empty-attachments'), to: [], artifacts: [] }, 'now'],
    [{ ...msg('event'), fromKind: 'hub', kind: 'event', to: ['coordinator'] }, 'background'],
    [{ ...msg('progress', 'implementer'), kind: 'progress', to: ['coordinator'] }, 'background'],
    // Archive and overrides are deferred to T-115: old retained messages use the same rule.
    [{ ...msg('old', 'implementer'), ts: '2020-01-01T00:00:00Z', to: ['reviewer'] }, 'background'],
  ];
  const layers = await c.lua<string[]>(`
    require('cland.state').S.presence={{name='human-aide',role='aide'}}
    local out={}
    for _,m in ipairs(...) do out[#out+1]=require('cland.thread').layer(m) end
    return out
  `, cases.map(row => row[0]));
  assert.deepEqual(layers, cases.map(row => row[1]));
});

test('fold membership survives extension, split, eviction, union and rewrites per window', { skip }, async t => {
  const agent = (id: string, seconds: number) => ({ ...msg(id, 'implementer', 'Background ' + id), to: ['reviewer'], ts: `2026-10-09T10:00:${String(seconds).padStart(2, '0')}Z` });
  const c = await start(t, { messages: { general: [agent('a', 10), agent('b', 20), agent('c', 30), agent('d', 40)] } });
  await c.lua(`
    local api=vim.api
    local t=require('cland.views').topic('general').thread
    _G.foldwin=require('cland.layout').centre()
    api.nvim_set_current_win(_G.foldwin)
    api.nvim_win_set_cursor(0,{2,0})
    t:fold('zo')
    _G.otherwin=api.nvim_open_win(t.buf,false,{split='right',win=_G.foldwin})
  `);
  const compare = async (label: string, expected: boolean[]) => {
    const snapshot = `
      local t=_G.thread_oracle or require('cland.views').topic('general').thread
      local win=_G.oraclewin or _G.foldwin
      return vim.api.nvim_win_call(win,function()
        local folds={}
        for _,r in ipairs(t:_runs()) do
          local first,last=r.first.start+2,r.last.start+r.last.n
          local ids={}; for _,m in ipairs(r.messages) do ids[#ids+1]=m.id end
          folds[#folds+1]={first=first,last=last,ids=ids,open=vim.fn.foldclosed(first)==-1}
        end
        return {folds=folds,count=t:folded_count(win)}
      end)
    `;
    const live = await c.lua<{folds: Array<{open:boolean}>}>(snapshot);
    assert.deepEqual(live.folds.map(f => f.open), expected, label);
    await c.lua(`
      local t=require('cland.views').topic('general').thread
      local states=t:_fold_states(_G.foldwin)
      local oracle=require('cland.thread').new({id='fold-oracle',title='Oracle'})
      _G.thread_oracle=oracle
      _G.oraclewin=vim.api.nvim_open_win(oracle.buf,false,{split='below',win=_G.foldwin})
      oracle:merge(t.messages)
      oracle:_build_folds(_G.oraclewin,states)
    `);
    assert.deepEqual(await c.lua(snapshot), live, label + ': full reference fold projection');
    await c.lua(`
      vim.api.nvim_win_close(_G.oraclewin,true)
      vim.api.nvim_buf_delete(_G.thread_oracle.buf,{force=true})
      _G.thread_oracle,_G.oraclewin=nil,nil
    `);
  };
  await compare('initial open run', [true]);
  assert.equal(await c.lua("return require('cland.views').topic('general').thread:folded_count(_G.otherwin)"), 4, 'other window stays folded');
  await c.lua("require('cland.views').topic('general').thread:add(...)", agent('e', 50));
  await compare('appended member inherits open', [true]);
  await c.lua("require('cland.views').topic('general').thread:merge({...})", { ...msg('separator', 'human'), ts: '2026-10-09T10:00:25Z' });
  await compare('human arriving mid-run splits into two open runs', [true, true]);
  // Exercise joining independent states after a separator leaves the retained model.
  await c.lua(`
    local t=require('cland.views').topic('general').thread
    vim.api.nvim_set_current_win(_G.foldwin)
    vim.api.nvim_win_set_cursor(0,{t.block_of.c.start+2,0}); t:fold('zc')
    for i,m in ipairs(t.messages) do if m.id=='separator' then table.remove(t.messages,i); break end end
    t.by_id.separator=nil
    -- Rewrite reads the old block membership before projecting the retained model.
    t:render()
  `);
  await compare('rejoined run takes union of open and closed halves', [true]);
  await c.lua(`
    local module=require('cland.thread')
    module.LIMIT=5
    require('cland.views').topic('general').thread:add(...)
    module.LIMIT=200
  `, agent('f', 55));
  await compare('first member eviction preserves open run', [true]);
  await c.lua("require('cland.views').topic('general').thread:render()");
  await compare('full rewrite preserves open run', [true]);
  await c.lua(`
    local api=vim.api
    local t=require('cland.views').topic('general').thread
    _G.hidden_scratch=api.nvim_create_buf(false,true)
    api.nvim_set_current_win(_G.foldwin)
    api.nvim_win_set_buf(_G.foldwin,_G.hidden_scratch)
    require('cland.thread').LIMIT=2
  `);
  for (const [id, second] of [['g', 56], ['h', 57], ['i', 58]] as const) {
    await c.lua("require('cland.views').topic('general').thread:add(...)", agent(id, second));
  }
  await c.lua(`
    local api=vim.api
    local t=require('cland.views').topic('general').thread
    -- Both windows are hidden: no rendering path can carry the open state.
    api.nvim_set_current_win(_G.otherwin)
    api.nvim_win_set_buf(_G.otherwin,_G.hidden_scratch)
  `);
  for (const [id, second] of [['j', 59], ['k', 59]] as const) {
    await c.lua("require('cland.views').topic('general').thread:add(...)", agent(id, second));
  }
  await c.lua(`
    local api=vim.api
    local t=require('cland.views').topic('general').thread
    require('cland.thread').LIMIT=200
    api.nvim_set_current_win(_G.foldwin)
    api.nvim_win_set_buf(_G.foldwin,t.buf)
  `);
  await compare('hidden continuing run stays open after every original member is evicted', [true]);
  await c.lua(`
    local t=require('cland.views').topic('general').thread
    vim.api.nvim_win_set_buf(_G.otherwin,t.buf)
    vim.api.nvim_buf_delete(_G.hidden_scratch,{force=true})
  `);
  assert.equal(await c.lua("return require('cland.views').topic('general').thread:folded_count(_G.otherwin)"), 2, 'independent hidden window stays closed through complete eviction');
  const states = await c.lua<Record<string, Record<string, boolean>>>(`
    local t=require('cland.views').topic('general').thread
    return {open=t.fold_states[_G.foldwin],closed=t.fold_states[_G.otherwin]}
  `);
  assert.deepEqual(states, {open:{j:true,k:true},closed:{j:false,k:false}}, 'evicted ids are garbage-collected from both window states');
});
