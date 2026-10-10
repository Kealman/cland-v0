import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ownDirectory } from '../../hub/test/process-cleanup.ts';
import { nvimOrSkip, startClient } from './harness.ts';
import type { Scenario } from './stub-hub.ts';
import { createConnection } from 'node:net';
import { spawnSpoke, startDaemon, tempProject } from '../../hub/test/harness.ts';

const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';
const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));

async function start(t: TestContext, scenario: Scenario = {}) {
  const root = await mkdtemp(join(tmpdir(), 'cland-palette-'));
  ownDirectory(t, root);
  await mkdir(join(root, '.git'));
  const controlPath = join(root, 'stub.sock');
  const c = await startClient(t, bin, root, {
    CLAND_HUB_TRANSPORT: 'stdio',
    CLAND_COMMAND: JSON.stringify([process.execPath, STUB]),
    CLAND_STUB_SCENARIO_JSON: JSON.stringify({ inbox: {}, ...scenario }),
    CLAND_STUB_CONTROL: controlPath,
  });
  await c.waitScreen(s => s.includes('hub: connected'), 'connected');
  return Object.assign(c, { root, control: (cmd: Record<string, unknown>) => new Promise<Record<string, unknown>>((resolve, reject) => {
    const sock = createConnection(controlPath);
    let text = '';
    sock.setEncoding('utf8');
    sock.on('error', reject);
    sock.on('data', chunk => {
      text += chunk;
      if (text.includes('\n')) { sock.end(); resolve(JSON.parse(text.slice(0, text.indexOf('\n')))); }
    });
    sock.write(`${JSON.stringify(cmd)}\n`);
  }) });
}

test('the palette finds the sessions panel action, displays its key and runs it', { skip }, async t => {
  const c = await start(t);
  await c.input('<Esc><Space>p');
  await c.waitScreen(s => s.includes('palette ›'), 'palette');
  await c.input('sessions panel');
  const s = await c.waitScreen(s => s.includes('Toggle sessions panel') && s.includes('␣s'), 'action and key');
  assert.ok(s.includes('ACTIONS'));
  await c.input('<CR>');
  await c.waitScreen(s => !s.includes('palette ›') && !s.includes('SESSIONS'), 'sessions panel toggled');
  assert.equal(await c.lua("return require('cland.state').S.ui.right"), null);
});

const item = (id: string, title: string, state = 'open') => ({ id, kind: 'task', title, state, labels: [], blocked_by: [], file: `${id}.md` });

test('session events move the selected row between groups and update the chip; stopped sessions fold', { skip }, async t => {
  const process = (name: string, state: string, status = 'running') => ({ name, sessionId: name+'-id', harness: 'codex', model: 'test-model', role: 'reviewer', state, status });
  const c = await start(t, { processes: [process('review', 'busy'), process('rest', 'idle'), process('old', 'unknown', 'stopped')] });
  await c.waitScreen(s => s.includes('WAITING · 0') && s.includes('BUSY · 1') && s.includes('IDLE · 1') && s.includes('stopped (1)'), 'session groups');
  assert.match((await c.screen())[0]!, /sessions +2 /);
  await c.lua(`local b=require('cland.panels').buf('sessions'); for _,w in ipairs(vim.api.nvim_tabpage_list_wins(0)) do if vim.api.nvim_win_get_buf(w)==b then vim.api.nvim_set_current_win(w); for i,l in ipairs(vim.api.nvim_buf_get_lines(b,0,-1,false)) do if l:find('review [',1,true) then vim.api.nvim_win_set_cursor(w,{i,0}); break end end end end`);
  await c.waitScreen(s => s.includes('test-model'), 'selected details');
  await c.control({ emit: { type: 'session.state', session: 'review', sessionId: 'review-id', state: 'waiting for approval', approvalCommand: 'npm test', source: 'hook' } });
  const waiting = await c.waitScreen(s => s.includes('WAITING · 1') && s.includes('BUSY · 0') && s.includes('run: npm test'), 'approval command and moved group');
  assert.match(waiting.split('\n')[0]!, /sessions +2 +1▲/);
  assert.match(String(await c.lua('return vim.api.nvim_get_current_line()')), /review \[Reviewer\]/);
  await c.control({ emit: { type: 'session.state', session: 'review', sessionId: 'review-id', state: 'idle', source: 'hook' } });
  await c.waitScreen(s => s.includes('WAITING · 0') && s.includes('IDLE · 2') && !s.includes('run: npm test'), 'approval cleared');
  assert.match(String(await c.lua('return vim.api.nvim_get_current_line()')), /review \[Reviewer\]/);
  await c.input('/stopped (<CR>za');
  await c.waitScreen(s => s.includes('old [Reviewer]'), 'stopped unfolded');
  await c.input('za');
  await c.waitScreen(s => !s.includes('old [Reviewer]'), 'stopped folded again');
  await c.control({ emit: { type: 'session.process', process: process('review', 'unknown', 'stopped') } });
  const stopped = await c.waitScreen(s => s.includes('stopped (2)'), 'process stopped');
  assert.match(stopped.split('\n')[0]!, /sessions +1 /);
});

test('wide session rows and approval commands fit their cells and the chip stays visible on a narrow screen', { skip }, async t => {
  const c = await start(t, { processes: [{ name: 'wide-review', sessionId: 'wide-id', harness: 'codex', model: '界'.repeat(100), role: 'reviewer', status: 'running', state: 'waiting for approval', approvalCommand: 'npm test ' + '界'.repeat(120) }] });
  await c.rpc.request('nvim_ui_try_resize', 80, 30);
  await c.input('<Esc><Space>s<Space>s/wide-review<CR>');
  const screen = await c.waitScreen(s => s.includes('run: npm test'), 'approval details');
  assert.match(screen.split('\n')[0]!, /sessions +1 +1▲/);
  const rows = await c.lua<Array<{ text: string; cells: number; width: number }>>(`
    local out={}
    for _,w in ipairs(vim.api.nvim_tabpage_list_wins(0)) do local b=vim.api.nvim_win_get_buf(w)
      if vim.b[b].cland_role=='sessions' then for _,line in ipairs(vim.api.nvim_buf_get_lines(b,0,-1,false)) do
        out[#out+1]={text=line,cells=vim.api.nvim_strwidth(line),width=vim.api.nvim_win_get_width(w)}
      end end
    end
    return out
  `);
  assert.ok(rows.some(r => r.text.includes('run: npm test') && r.text.endsWith('…')));
  for (const row of rows) assert.ok(row.cells <= row.width, JSON.stringify(row));
});

test('session notices and stop confirmations terminate within budgets of zero, one and two cells', { skip }, async t => {
  const c = await start(t);
  const results = await c.lua<Array<{ ok: boolean; error: string; fits: boolean }>>(`
    local panels=require('cland.panels'); local state=require('cland.state'); local out={}
    local texts={'Unable to stop 界界 session', 'stop review? y stops it · n keeps it'}
    local function bounded(fn)
      debug.sethook(function() error('render exceeded instruction budget') end,'',100000)
      local ok,result=pcall(fn); debug.sethook()
      out[#out+1]={ok=ok,error=ok and '' or tostring(result),fits=ok and result or false}
    end
    for _,text in ipairs(texts) do for width=0,2 do bounded(function()
      for _,line in ipairs(panels.wrap(text,width)) do if vim.api.nvim_strwidth(line)>width then return false end end
      for _,chunk in ipairs(require('cland.bars').fit({{text}},width)) do if vim.api.nvim_strwidth(chunk[1])>width then return false end end
      return true
    end) end end
    local b=panels.buf('sessions')
    for width=1,2 do
      local w=vim.api.nvim_open_win(b,false,{relative='editor',row=1,col=1,width=width,height=12,style='minimal',noautocmd=true})
      for _,kind in ipairs({'notice','confirmation'}) do
        state.S.sessions_note=kind=='notice' and {text=texts[1],group='ClandAmber'} or nil
        state.S.ui.confirm=kind=='confirmation' and {session='review'} or nil
        bounded(function()
          panels.render('sessions',w)
          for _,line in ipairs(vim.api.nvim_buf_get_lines(b,0,-1,false)) do if vim.api.nvim_strwidth(line)>width then return false end end
          return true
        end)
      end
      vim.api.nvim_win_close(w,true)
    end
    state.S.sessions_note=nil; state.S.ui.confirm=nil
    return out
  `);
  assert.equal(results.length, 10);
  for (const result of results) assert.ok(result.ok && result.fits, JSON.stringify(result));
});

test('item prefix opens an item; C-v opens another beside the centre', { skip }, async t => {
  const c = await start(t, { items: [item('T-12', 'Centre item'), item('T-13', 'Split item')] });
  await c.input('<Esc><Space>p#T-12<CR>');
  await c.waitScreen(s => s.includes('T-12 · item'), 'centre item');
  await c.input('<Space>p#T-13<C-v>');
  await c.waitScreen(s => s.includes('Centre item') && s.includes('Split item') && !s.includes('palette ›'), 'item split');
  assert.equal(await c.lua("return require('cland.state').S.ui.view.id"), 'T-12');
  assert.deepEqual(await c.lua(`local ids={}; for _,w in ipairs(vim.api.nvim_tabpage_list_wins(0)) do local b=vim.api.nvim_win_get_buf(w); if vim.b[b].cland_item then ids[#ids+1]=vim.b[b].cland_item end end; table.sort(ids); return ids`), ['T-12', 'T-13']);
});

test('every cland mapping has matching registry metadata; missing keys and drift fail the audit', { skip }, async t => {
  const c = await start(t, { items: [item('T-12', 'Registry item')] });
  // Construct each shipped mapping surface, including floats, expression mappings and terminal keys.
  await c.lua(`
    local p=require('cland.panels'); for _,kind in ipairs({'items','sessions','topics','inbox'}) do p.buf(kind) end
    require('cland.inbox').full_buf(); require('cland.board').buf(); require('cland.item_view').buf('T-12')
    require('cland.agents_log').buffer(); require('cland.launcher').open(); require('cland.launcher').close()
    require('cland').help()
  `);
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"), []);
  const sessionKeys = ['<CR>', '<C-v>', 'l', 'x', 'c', 'za'];
  const sessionActions = await c.lua<Array<{ key: string; mapped: boolean }>>(`
    local a=require('cland.actions'); local b=require('cland.panels').buf('sessions'); local out={}
    for _,entry in ipairs(a.all()) do if entry.id:sub(1,9)=='sessions:' then
      local found=false
      for _,map in ipairs(vim.api.nvim_buf_get_keymap(b,'n')) do if map.desc=='cland: '..entry.title then found=true end end
      out[#out+1]={key=entry.id:sub(10), mapped=found}
    end end
    return out
  `);
  for (const key of sessionKeys) assert.ok(sessionActions.some(a => a.key === key && a.mapped), `${key} declared and installed`);
  await c.input('<Esc><Space>p>Attach selected session');
  await c.waitScreen(s => s.includes('↵ in sessions'), 'panel Enter action in palette');
  await c.input('<Esc>');
  await c.lua("vim.keymap.set('n','zz',function() end,{desc='cland: Missing key'})");
  assert.match(JSON.stringify(await c.lua("return require('cland.actions').audit()")), /unregistered.*zz/);
  await c.lua("vim.keymap.del('n','zz'); vim.keymap.set('n','<leader>s',function() end,{desc='cland: Wrong title'})");
  assert.match(JSON.stringify(await c.lua("return require('cland.actions').audit()")), /disagrees.*sessions panel/i);
  const luaDir = fileURLToPath(new URL('../lua/cland/', import.meta.url));
  for (const name of await readdir(luaDir)) {
    if (!name.endsWith('.lua') || name === 'actions.lua') continue;
    assert.doesNotMatch(await readFile(join(luaDir, name), 'utf8'), /vim\.keymap\.set|nvim_(?:buf_)?set_keymap/, `${name} bypasses the registry`);
  }
  assert.doesNotMatch(await readFile(fileURLToPath(new URL('../init.lua', import.meta.url)), 'utf8'), /vim\.keymap\.set|nvim_(?:buf_)?set_keymap/);
});

test('an ask option runs through the inbox hub path and vanishes after the hub accepts the answer', { skip }, async t => {
  const c = await start(t, { inbox: { asks: [{ id: 'ask-nebula', question: 'Which nebula?', topic: { id: 'general', title: 'General', item: null }, options: ['Approve nebula', 'Defer nebula'], from: 'coord', ts: '2026-10-09T12:00:00Z' }] } });
  await c.input('<Esc><Space>p>Approve nebula');
  await c.waitScreen(s => s.includes('Answer ask General · 1 Approve nebula') && s.includes('1 on the ask'), 'ask action');
  await c.input('<CR>');
  await c.waitScreen(s => s.includes('answered with 1: Approve nebula'), 'accepted answer');
  const frames = (await c.control({ requests: true })).requests as Array<Record<string, unknown>>;
  assert.equal(frames.filter(f => f.type === 'topic.answer' && f.ask === 'ask-nebula' && f.option === 1).length, 1);
  assert.deepEqual(await c.lua("return require('cland.state').S.inbox.asks"), []);
  await c.input('<Space>p>nebula');
  await c.waitScreen(s => s.includes('(no match)'), 'answered ask absent');
  await c.input('<Esc>');
  assert.equal(await c.mode(), 'n');
});

test('all five kinds stay in fixed order while the cursor selects the best match; prefixes and Tab narrow them', { skip }, async t => {
  const c = await start(t, {
    items: [item('T-12', 'Nebula')],
    processes: [{ name: 'nebula-session', harness: 'codex', role: 'reviewer', state: 'idle', status: 'running' }],
    artifacts: [{ id: 'A-1', kind: 'note', title: 'Nebula note', creator: 'human', topic: 'general', status: 'shared', path: '/unused.md' }],
    topics: [{ id: 'general', title: 'General', status: 'open' }, { id: 'topic-nebula', title: 'Nebula topic', status: 'open' }],
  });
  await c.input('<Esc><Space>p');
  await c.waitScreen(s => s.includes('palette ›'), 'all kinds');
  await c.lua("assert(vim.wait(5000,function() return #require('cland.qa').state().items==1 and #require('cland.artifacts').all()==1 end))");
  await c.input('<C-u>');
  const headers = await c.lua(`local out={}; for _,b in ipairs(vim.api.nvim_list_bufs()) do if vim.b[b].cland_role~='sessions' then for _,l in ipairs(vim.api.nvim_buf_get_lines(b,0,-1,false)) do local h=l:match('^ ([A-Z]+) ·'); if h then out[#out+1]=h end end end end; return out`);
  assert.deepEqual(headers, ['ACTIONS', 'ITEMS', 'SESSIONS', 'ARTIFACTS', 'TOPICS']);
  await c.input('T-12');
  await c.waitScreen(s => s.includes('T-12 Nebula'), 'exact id match');
  const selected = await c.lua(`for _,w in ipairs(vim.api.nvim_tabpage_list_wins(0)) do local cfg=vim.api.nvim_win_get_config(w); if cfg.relative~='' and not cfg.focusable then local b=vim.api.nvim_win_get_buf(w); return vim.api.nvim_buf_get_lines(b,vim.api.nvim_win_get_cursor(w)[1]-1,vim.api.nvim_win_get_cursor(w)[1],false)[1] end end`);
  assert.match(String(selected), /T-12 Nebula/);
  await c.input('<C-u>');
  for (const prefix of ['>', '#', '@', '~', '/', '']) {
    await c.input('<Tab>');
    assert.equal(await c.lua('return vim.api.nvim_get_current_line()'), prefix);
  }
  await c.input('<Esc><Space>a');
  await c.waitScreen(s => s.includes('A-1 note · Nebula note'), 'artifacts shortcut');
  assert.equal(await c.lua('return vim.api.nvim_get_current_line()'), '~');
  await c.input('<Esc>');
  assert.equal(await c.mode(), 'n');
});

test('archived hits are dimmed, matches are blue and wide rows fit the shared display-cell budget', { skip }, async t => {
  const c = await start(t, {
    items: [item('T-12', '界'.repeat(120) + 'Nebula', 'closed')],
    processes: [{ name: 'nebula-stopped', harness: 'codex', state: 'unknown', status: 'stopped' }],
    topics: [{ id: 'general', title: 'General', status: 'open' }, { id: 'topic-nebula', title: 'Nebula closed topic', status: 'closed' }],
  });
  await c.rpc.request('nvim_ui_try_resize', 80, 30);
  for (const query of ['#T-12', '@nebula', '/Nebula']) {
    await c.input('<Esc><Space>p' + query);
    await c.waitScreen(s => s.includes('palette ›'), 'palette');
    const marks = await c.lua<Array<{ text: string; groups: string[]; cells: number; width: number }>>(`
      local out={}; local ns=vim.api.nvim_get_namespaces()['cland.palette']
      for _,w in ipairs(vim.api.nvim_tabpage_list_wins(0)) do
        local cfg=vim.api.nvim_win_get_config(w)
        if cfg.relative~='' and not cfg.focusable then
          local b=vim.api.nvim_win_get_buf(w); local lines=vim.api.nvim_buf_get_lines(b,0,-1,false)
          local marks=vim.api.nvim_buf_get_extmarks(b,ns,0,-1,{details=true})
          for i,line in ipairs(lines) do
            local groups={}; local right=0
            for _,m in ipairs(marks) do if m[2]==i-1 then
              if m[4].hl_group then groups[#groups+1]=m[4].hl_group end
              for _,ch in ipairs(m[4].virt_text or {}) do right=right+vim.api.nvim_strwidth(ch[1]) end
            end end
            out[#out+1]={text=line,groups=groups,cells=vim.api.nvim_strwidth(line)+right,width=cfg.width}
          end
        end
      end
      return out
    `);
    const hit = marks.find(m => m.groups.includes('ClandPickMatch'));
    assert.ok(hit, JSON.stringify(marks));
    assert.ok(hit.groups.includes('ClandDim'), JSON.stringify(marks));
    assert.ok(hit.cells <= hit.width, JSON.stringify(marks));
    const colors = await c.lua("return {vim.api.nvim_get_hl(0,{name='ClandPickMatch'}).fg,vim.api.nvim_get_hl(0,{name='ClandBlue'}).fg}");
    assert.deepEqual(colors, [0x6aa5ff, 0x6aa5ff]);
    await c.input('<Esc>');
  }
});

test('session, topic and text-artifact selections open in splits and receive live updates', { skip }, async t => {
  const c = await start(t, {
    processes: [{ name: 'palette-session', harness: 'codex', role: 'reviewer', status: 'running', state: 'idle' }],
    attach: { 'palette-session': "printf 'palette attached\\n'; sleep 600" },
    topics: [{ id: 'general', title: 'General', status: 'open' }, { id: 'topic-split', title: 'Split topic', status: 'open' }],
    messages: { 'topic-split': [{ id: 'm1', from: 'coord', text: 'Split topic content', ts: '2026-10-09T12:00:00Z', topic: 'topic-split' }] },
  });
  const path = join(c.root, 'split.md');
  await writeFile(path, '# Split artifact');
  await c.control({ emit: { type: 'artifact', artifact: { id: 'A-1', kind: 'note', title: 'Split artifact', creator: 'human', status: 'shared', topic: 'general', path } } });
  await c.input('<Esc><Space>p@palette-session<C-v>');
  await c.waitScreen(s => s.includes('palette attached'), 'session split attached');
  assert.equal(await c.mode(), 't');
  await c.input('<C-\\><Space>p/Split topic<C-v>');
  await c.waitScreen(s => s.includes('Split topic content'), 'topic split');
  await c.control({ emit: { type: 'message', topic: { id: 'topic-split' }, message: { id: 'm2', from: 'coord', text: 'Live split update', ts: '2026-10-09T12:01:00Z', topic: 'topic-split' } } });
  await c.waitScreen(s => s.includes('Live split update'), 'live topic split');
  await c.input('<Space>aA-1<C-v>');
  await c.waitScreen(s => s.includes('# Split artifact'), 'text artifact split');
  assert.equal(await c.lua("return require('cland.state').S.ui.view.id"), 'general');
  assert.equal(await c.lua('return vim.bo.readonly'), true);
});

test('later modules register stable action ids and keys; unkeyed preset commands say no key', { skip }, async t => {
  const c = await start(t);
  await c.lua(`local a=require('cland.actions'); a.register({id='custom.open', title='Custom module action', keys={{lhs='<leader>x', modes='n'},{lhs='<leader>X', modes='n'}}}); local function run() require('cland.state').say('custom action ran') end; a.map('n','<leader>x',run); a.map('n','<leader>X',run)`);
  await c.input('<Esc><Space>X');
  await c.waitScreen(s => s.includes('custom action ran'), 'second registered key');
  await c.input('<Esc><Space>p>Custom module');
  await c.waitScreen(s => s.includes('Custom module action') && s.includes('␣x'), 'registered extension key');
  await c.input('<CR>');
  await c.waitScreen(s => s.includes('custom action ran'), 'extension action ran');
  await c.input('<Space>p>Preset: watch');
  await c.waitScreen(s => s.includes('Preset: watch') && s.includes('no key'), 'unkeyed command');
  await c.input('<CR>');
  await c.waitScreen(s => s.includes('preset watch:'), 'preset command ran');
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"), []);
});

test('a local palette action uses its panel row while a split action uses the focused topic', { skip }, async t => {
  const c = await start(t, { topics: [{id:'general',title:'General',status:'open'}, {id:'topic-selected',title:'Selected topic',status:'open'}] });
  await c.input('<Esc><Space>tgg/Selected topic<CR><C-h><Space>p>Close selected topic<CR>');
  await c.waitScreen(s => s.includes('closed: Selected topic'), 'selected panel topic closed');
  await c.input('<Space>p/Selected topic<C-v>');
  await c.waitScreen(s => s.includes('Selected topic · to @coordinator'), 'selected topic split');
  await c.input('<Space>p>Resolve this topic<CR>');
  await c.waitScreen(s => s.includes('resolved: Selected topic is open'), 'focused split resolved');
  const frames = (await c.control({requests:true})).requests as Array<Record<string, unknown>>;
  assert.deepEqual(frames.filter(f => f.type === 'topic.close' || f.type === 'topic.resolve').map(f => [f.type,f.topic]), [['topic.close','topic-selected'],['topic.resolve','topic-selected']]);
});

test('topic actions in an Agents reply use Agents rather than its synthetic composer id', { skip }, async t => {
  const c = await start(t, { messages: { agents: [
    {id:'agent-message',from:'impl-1',fromKind:'agent',fromRole:'implementer',text:'Reply context probe',ts:'2026-10-09T12:00:00Z',topic:'agents'},
  ] } });
  await c.input('<Esc><Space>L');
  await c.waitScreen(s => s.includes('Reply context probe'), 'Agents message');
  await c.input('gg/Reply context probe<CR>r');
  await c.waitScreen(s => s.includes('reply to impl-1'), 'Agents reply composer');
  await c.input('<Esc><Space>p>Resolve this topic<CR>');
  await c.waitScreen(s => s.includes('resolved: Agents is open'), 'resolve Agents');
  await c.input('<Space>p>Draft a prompt<CR>');
  await c.waitScreen(s => s.includes('open a thread to draft a prompt'), 'Agents prompt refusal');
  const frames = (await c.control({requests:true})).requests as Array<Record<string, unknown>>;
  assert.deepEqual(frames.filter(f => f.type === 'topic.resolve').map(f => f.topic), ['agents']);
  assert.equal(frames.some(f => f.type === 'artifact.create'), false);
});

test('the newline action resumes Insert mode in the composer before executing its native key', { skip }, async t => {
  const c = await start(t);
  await c.input('alpha<Esc><Space>p>Newline in message<CR>');
  await c.waitScreen(s => !s.includes('palette ›') && s.includes('INSERT'), 'composer action resumed Insert mode');
  await c.input('beta');
  await c.waitScreen(s => s.includes('beta'), 'text after newline');
  const lines = await c.lua<string[]>("return vim.api.nvim_buf_get_lines(0,0,-1,false)");
  assert.ok(lines.length >= 2, JSON.stringify(lines));
  assert.equal(lines[0], '› alpha');
  assert.ok(lines.slice(1).join('\n').includes('beta'), JSON.stringify(lines));
});

test('the terminal Shift+Enter action resumes its attached terminal and reaches the harness', { skip }, async t => {
  const c = await start(t, { processes:[{name:'key-session',harness:'codex',status:'running',state:'idle'}] });
  const path = join(c.root, 'terminal-keys');
  const keylog = fileURLToPath(new URL('./fakes/keylog.ts', import.meta.url));
  await c.control({set:{attach:{'key-session':`${JSON.stringify(process.execPath)} ${JSON.stringify(keylog)} ${JSON.stringify(path)}`}}});
  await c.input('<Esc><Space>p@key-session<CR>');
  await c.waitScreen(s => s.includes('keylog ready'), 'terminal key logger attached');
  await c.input('<C-\\><Space>p>Send Shift+Enter to harness<CR>');
  await c.waitScreen(s => s.includes('TERMINAL') && !s.includes('palette ›'), 'terminal action resumed mode');
  // The logger records complete bytes after reading them from its real PTY.
  const until = Date.now() + 5000;
  let bytes = '';
  while (Date.now() < until) {
    bytes = await readFile(path, 'utf8').catch(() => '');
    if (bytes.includes('1b5b31333b3275')) break;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.ok(bytes.includes('1b5b31333b3275'), bytes);
});

test('a failed live palette render closes it and reports one status-line notice', { skip }, async t => {
  const c = await start(t);
  await c.input('<Esc><Space>p~');
  await c.waitScreen(s => s.includes('palette ›'), 'palette before malformed event');
  await c.control({emit:{type:'artifact',artifact:{id:'A-1',kind:'note',title:'Incomplete hub artifact',topic:'general'}}});
  await c.waitScreen(s => !s.includes('palette ›') && s.includes('palette:'), 'visible render failure');
  assert.equal(await c.mode(), 'n');
});

test('a palette option reaches the real hub and the Coordinator receives the human answer', { skip }, async t => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const asked = await coord.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Which orbit?', options: ['Choose periapsis', 'Choose apoapsis'] });
  assert.equal(asked.ok, true);
  const c = await startClient(t, bin, root);
  await c.waitScreen(s => s.includes('Which orbit?'), 'ask loaded from hub');
  await c.input('<Esc><Space>p>Choose apoapsis<CR>');
  await coord.waitForEvent(e => e.params.meta?.from_kind === 'human' && e.params.content === 'Choose apoapsis' && e.params.meta.answer_to === asked.ask);
  await c.waitScreen(s => s.includes('answered with 2: Choose apoapsis'), 'real hub accepted answer');
});
