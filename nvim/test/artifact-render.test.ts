// T2: rendered artifact buffers and the grid through the recorded stdio client.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { artifactScreen, skip } from './artifact-screen-fixture.ts';
import { tempProject, eventually } from './fixture.ts';
import { waitInitialSnapshots } from './readiness.ts';

const source = '# Artifact heading\nUse **strong**, *soft* and `code`.\n\n```lua\nprint(1)\n```\n- List item\n> Quoted words\n[Brief](https://example.com/very/long/link/tail)\n\n| Name | State |\n|---|---|\n| **Alpha** | ready |';

test('ARTIFACT-001: rendered Markdown is read-only and raw toggles back to the exact editable source', { skip }, async t => {
  const root = await tempProject(t);
  const path = join(root, 'note.md');
  await writeFile(path, source);
  const scene = await artifactScreen(t, root);
  const c = await scene.start();
  await waitInitialSnapshots(c);
  // Audit the existing registry and mappings before installing the artifact mapping.
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"), []);
  await c.lua(`require('cland.artifacts').open({id='A-796',kind='note',creator='human',status='shared',title='Rendering',topic='general',path=...})`, path);
  const screen = await c.waitScreen(s => s.includes('Artifact heading') && !s.includes('# Artifact heading') && s.includes('Use strong, soft and code.') && s.includes('│ Quoted words'), 'rendered artifact grid');
  assert.ok(!screen.includes('# Artifact heading'), screen);
  assert.ok(screen.includes('Use strong, soft and code.'), screen);
  assert.ok(screen.includes('• List item') && screen.includes('│ Quoted words'), screen);
  assert.ok(!screen.includes('```') && !screen.includes('https://example.com'), screen);
  assert.ok(screen.includes('| Alpha | ready |'), screen);
  assert.deepEqual(await c.lua('return {vim.bo.readonly, vim.bo.modifiable, vim.wo.wrap, vim.wo.linebreak, vim.wo.breakindent}'), [true, false, true, true, true]);
  const rendered = await c.lua('return vim.api.nvim_get_current_buf()');
  await c.input('<Space>v');
  await c.waitScreen(s => s.includes('# Artifact heading'), 'raw source');
  assert.deepEqual(await c.lua("return {vim.bo.readonly,vim.bo.modifiable,vim.bo.buftype,table.concat(vim.api.nvim_buf_get_lines(0,0,-1,false),'\\n')}"), [false, true, '', source]);
  await c.input('<Space>v');
  await c.waitScreen(s => s.includes('Use strong, soft and code.') && !s.includes('# Artifact heading'), 'rendered again');
  assert.equal(await c.lua('return vim.api.nvim_get_current_buf()'), rendered);
  await c.input('<Space>v');
  await c.lua("require('cland.artifacts').open('A-796')");
  await c.waitScreen(s => s.includes('Use strong, soft and code.') && !s.includes('# Artifact heading'), 'every open defaults rendered');
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"), []);
});

test('a 2,000-line artifact bounds parsing before first paint and reuses spans for its file version', { skip }, async t => {
  const root = await tempProject(t);
  const path = join(root, 'long.markdown');
  const text = Array.from({ length: 250 }, (_, i) => `# Section ${i}\nUse **strong** and [brief](https://example.com/${i}).\n- List item\n> Quoted words\n\n\`\`\`lua\nprint(${i})\n\`\`\``).join('\n');
  assert.equal(text.split('\n').length, 2000);
  await writeFile(path, text);
  const scene = await artifactScreen(t, root);
  const c = await scene.start();
  await waitInitialSnapshots(c);
  await c.input('<Esc>');
  const result = await c.lua<{ ms: number; parsers: number; screen: string; parsedLines: number; height: number }>(`
    local original=vim.treesitter.get_string_parser
    _G.artifact_parsers=0
    _G.artifact_parsed_lines=0
    vim.treesitter.get_string_parser=function(...)
      _G.artifact_parsers=_G.artifact_parsers+1
      local text=...
      local _,lines=text:gsub('\\n','')
      _G.artifact_parsed_lines=_G.artifact_parsed_lines+lines
      return original(...)
    end
    local started=vim.uv.hrtime()
    require('cland.artifacts').open({id='A-797',kind='note',creator='human',status='shared',title='Long note',topic='general',path=...})
    vim.cmd('redraw!')
    local screen=''
    for r=3,5 do for c=1,80 do screen=screen..vim.fn.screenstring(r,c) end end
    return {ms=(vim.uv.hrtime()-started)/1e6,parsers=_G.artifact_parsers,screen=screen,parsedLines=_G.artifact_parsed_lines,height=vim.api.nvim_win_get_height(0)}
  `, path);
  assert.ok(result.screen.includes('Section 0') && !result.screen.includes('# Section 0'), result.screen);
  assert.ok(result.screen.includes('Use strong and brief.'), result.screen);
  assert.ok(result.parsers > 0);
  assert.equal(result.parsedLines, result.height + 4, 'first paint parses only the visible rows plus four source rows');
  assert.ok(result.parsedLines < 2000, 'the remainder is deferred until after first paint');
  assert.ok(result.ms < 200, `gross first-screen guard: ${result.ms.toFixed(2)} ms`);
  t.diagnostic(`2,000-line first rendered grid: ${result.ms.toFixed(2)} ms; first-paint parsed rows ${result.parsedLines} / 2000`);
  await c.input('G');
  await c.waitScreen(s => s.includes('Section 249') && !s.includes('# Section 249') && s.includes('print(249)'), 'deferred final screen rendered');
  const parsed = await c.lua<number>('return _G.artifact_parsers');
  await c.lua("require('cland.artifacts').open('A-797')");
  assert.equal(await c.lua('return _G.artifact_parsers'), parsed, 'unchanged version parses nothing');
  await c.input('gg<Space>v');
  await c.lua("vim.api.nvim_buf_set_lines(0,0,1,false,{'# Revised section'}); vim.cmd('write')");
  await c.input('<Space>v');
  await c.waitScreen(s => s.includes('Revised section') && !s.includes('# Revised'), 'saved version rendered');
  assert.ok(await c.lua<number>('return _G.artifact_parsers') > parsed, 'a saved version extracts new spans');
});

test('the artifact projection cache distinguishes path, mtime and size independently', { skip }, async t => {
  const root = await tempProject(t);
  const path = join(root, 'version.md');
  await writeFile(path, '# Cached heading');
  const scene = await artifactScreen(t, root);
  const c = await scene.start();
  await waitInitialSnapshots(c);
  const counts = await c.lua<number[]>(`
    local path=...
    local raw=vim.fn.bufadd(path)
    vim.fn.bufload(raw)
    vim.bo[raw].fixendofline=false
    vim.bo[raw].endofline=false
    local md=require('cland.thread_md')
    local render=md.render
    local calls=0
    md.render=function(...) calls=calls+1; return render(...) end
    local projection=require('cland.artifact_md')
    local counts={}
    local function show()
      local b=projection.buffer(vim.api.nvim_buf_get_name(raw),80,raw)
      assert(vim.bo[b].readonly and not vim.bo[b].modifiable)
      assert(#vim.api.nvim_buf_get_extmarks(b,vim.api.nvim_get_namespaces()['cland.artifact_md'],0,-1,{})>0)
      counts[#counts+1]=calls
    end
    vim.uv.fs_utime(path,10,10)
    show(); show()
    -- Change only mtime; the bytes and path are identical.
    vim.uv.fs_utime(path,20,20)
    show()
    -- Change size while retaining exactly the same mtime and path.
    vim.api.nvim_buf_set_lines(raw,0,-1,false,{'# A longer cached heading'})
    vim.api.nvim_buf_call(raw,function() vim.cmd('silent write!') end)
    vim.uv.fs_utime(path,20,20)
    show()
    -- Change path while retaining the same bytes, mtime and size.
    local next_path=path..'.markdown'
    vim.fn.writefile({'# A longer cached heading'},next_path,'b')
    vim.uv.fs_utime(next_path,20,20)
    vim.api.nvim_buf_set_name(raw,next_path)
    show()
    md.render=render
    return counts
  `, path);
  assert.deepEqual(counts, [1, 1, 2, 3, 4]);
});

test('first artifact open projects an existing modified editor buffer without losing its unsaved source', { skip }, async t => {
  const root = await tempProject(t);
  const path = join(root, 'already-open.md');
  await writeFile(path, '# Saved on disk');
  const scene = await artifactScreen(t, root);
  const c = await scene.start();
  await waitInitialSnapshots(c);
  await c.input('<Esc>');
  const raw = await c.lua<number>(`
    local path=...
    vim.api.nvim_set_current_win(require('cland.layout').centre())
    vim.cmd('edit '..vim.fn.fnameescape(path))
    vim.api.nvim_buf_set_lines(0,0,-1,false,{'# Unsaved in editor'})
    return vim.api.nvim_get_current_buf()
  `, path);
  await c.lua("require('cland.artifacts').open({id='A-798',kind='note',creator='human',status='shared',title='Existing source',topic='general',path=...})", path);
  const screen = await c.waitScreen(s => (s.includes('Unsaved in editor') || s.includes('Saved on disk')) && !s.includes('# Saved') && !s.includes('# Unsaved'), 'existing source rendered');
  assert.ok(screen.includes('Unsaved in editor') && !screen.includes('Saved on disk'), screen);
  await c.input('<Space>v');
  assert.equal(await c.lua('return vim.api.nvim_get_current_buf()'), raw);
  assert.deepEqual(await c.lua("return {vim.bo.modified,vim.bo.modifiable,vim.bo.readonly,vim.api.nvim_buf_get_lines(0,0,-1,false)}"), [true, true, false, ['# Unsaved in editor']]);
  await c.input('<Space>v');
  await c.waitScreen(s => s.includes('Unsaved in editor') && !s.includes('# Unsaved'), 'unsaved source remains rendered');
});

test('a 20,000-line artifact yields to keys, bounds render work and caches the settled projection', { skip }, async t => {
  const root = await tempProject(t);
  const path = join(root, 'very-long.md');
  const text = Array.from({ length: 2500 }, (_, i) => `# Slice ${i}\nUse **strong** and [brief](https://example.com/${i}).\n- List item\n> Quoted words\n\n\`\`\`lua\nprint(${i})\n\`\`\``).join('\n');
  assert.equal(text.split('\n').length, 20000);
  await writeFile(path, text);
  const c = await (await artifactScreen(t, root)).start();
  await waitInitialSnapshots(c);
  await c.input('<Esc>');
  const first = await c.lua<{ pending: boolean; ms: number; rows: number; height: number; screen: string }>(`
    _G.long_artifact={parsers=0,rows=0,async=0,slices={},key=false,first=true,reused={}}
    local audit=_G.long_artifact
    local active
    local function wrap(fn)
      local label=active and active.lang
      return function(...)
        local parent=active
        local source=debug.getinfo(fn,'S').source
        local pipeline=source:find('cland/thread_md.lua',1,true) or source:find('cland/artifact_md.lua',1,true) or source:find('treesitter/languagetree.lua',1,true)
        local slice={work=0,marks=0,rows=0,lang=label,pipeline=pipeline~=nil,parser=false}
        active=slice
        local started=vim.uv.hrtime()
        local result={fn(...)}
        slice.ms=(vim.uv.hrtime()-started)/1e6
        active=parent
        if slice.work>0 or slice.marks>0 or slice.rows>0 or slice.parser or slice.pipeline then slice.recorded=true; audit.slices[#audit.slices+1]=slice end
        return unpack(result)
      end
    end
    local schedule,defer=vim.schedule,vim.defer_fn
    vim.schedule=function(fn) return schedule(wrap(fn)) end
    vim.defer_fn=function(fn,ms) return defer(wrap(fn),ms) end
    local set_lines,set_mark=vim.api.nvim_buf_set_lines,vim.api.nvim_buf_set_extmark
    vim.api.nvim_buf_set_lines=function(b,a,z,strict,lines)
      if active and vim.b[b].cland_rendered then active.rows=active.rows+#lines end
      return set_lines(b,a,z,strict,lines)
    end
    vim.api.nvim_buf_set_extmark=function(b,...)
      if active and vim.b[b].cland_rendered then active.marks=active.marks+1 end
      return set_mark(b,...)
    end
    local observed=setmetatable({},{__mode='k'})
    local observe
    observe=function(parser,root)
      if observed[parser] then return parser end
      observed[parser]=true
      local included=parser.set_included_regions
      local previous=0
      parser.set_included_regions=function(self,regions)
        if active then active.parser=true end
        assert(#regions<=64,'bounded injected-region setup')
        if root then
          local last=regions[1][1][4]
          assert(last-previous<=128,'bounded Markdown prefix extension')
          previous=last
        end
        return included(self,regions)
      end
      local add=parser.add_child
      parser.add_child=function(self,...)
        audit.parsers=audit.parsers+1
        if active then active.parser=true end
        return observe(add(self,...),false)
      end
      local parse=parser.parse
      local calls=0
      parser.parse=function(self,range,done)
        if active then active.lang=self:lang(); active.parser=true end
        if done then audit.async=audit.async+1 end
        calls=calls+1
        local synchronous=false
        local result=parse(self,range,done and function(...)
          synchronous=true
          return done(...)
        end)
        if calls>1 and synchronous and active then audit.reused[#audit.reused+1]=active end
        return result
      end
      return parser
    end
    local get_parser=vim.treesitter.get_string_parser
    vim.treesitter.get_string_parser=function(text,...)
      audit.parsers=audit.parsers+1
      if active then active.parser=true end
      -- Count source rows only before first paint. Re-scanning a full document
      -- in a parser spy would itself add unbounded work to the measured slice.
      if audit.first then
        local _,rows=text:gsub('\\n','')
        audit.rows=audit.rows+rows
      end
      return observe(get_parser(text,...),true)
    end
    local md=require('cland.thread_md')
    local render=md.render
    md.render=function(text,cells,work,...)
      local observed=work and function()
        if active then active.work=active.work+1 end
        return work()
      end
      return render(text,cells,observed,...)
    end
    local projection=require('cland.artifact_md')
    local buffer=projection.buffer
    projection.buffer=function(...)
      local started=vim.uv.hrtime()
      local result=buffer(...)
      audit.initialSliceMs=math.max(audit.initialSliceMs or 0,(vim.uv.hrtime()-started)/1e6)
      return result
    end
    vim.on_key(function(key)
      if key=='j' then audit.key=vim.b.cland_render_pending==true end
    end,vim.api.nvim_create_namespace('long-artifact-key'))
    local started=vim.uv.hrtime()
    require('cland.artifacts').open({id='A-1003',kind='note',creator='human',status='shared',title='Very long note',topic='general',path=...})
    vim.cmd('redraw!')
    local screen=''
    for r=3,5 do for col=1,80 do screen=screen..vim.fn.screenstring(r,col) end end
    local first={pending=vim.b.cland_render_pending==true,ms=(vim.uv.hrtime()-started)/1e6,rows=audit.rows,height=vim.api.nvim_win_get_height(0),screen=screen}
    audit.first=false
    vim.api.nvim_input('j')
    return first
  `, path);
  assert.ok(first.screen.includes('Slice 0') && !first.screen.includes('# Slice 0'), first.screen);
  assert.equal(first.rows, first.height + 4, 'first grid parses only the viewport plus four source rows');
  assert.ok(first.ms < 200, `gross first-screen guard: ${first.ms.toFixed(3)} ms`);
  assert.equal(first.pending, true, 'whole-document work remains deferred after first paint');
  await eventually('key handled before the rendered projection completes', async () => await c.lua('return _G.long_artifact.key and vim.api.nvim_win_get_cursor(0)[1]==2') ? true : undefined);
  await eventually('final decoration receipt', async () => await c.lua('return vim.b.cland_render_pending==false') ? true : undefined);
  for (const [keys, heading, code] of [['gg', 'Slice 0', 'print(0)'], ['10001Gzt', 'Slice 1250', 'print(1250)'], ['G', 'Slice 2499', 'print(2499)']]) {
    await c.input(keys!);
    const screen = await c.waitScreen(s => s.includes(heading!) && s.includes(code!) && !s.includes('# Slice') && !s.includes('```'), `settled ${heading} grid`);
    assert.ok(screen.includes('Use strong and brief.'), screen);
  }
  const audit = await c.lua<{ initialSliceMs: number; reused: { recorded?: boolean }[]; parsers: number; async: number; slices: { work: number; rows: number; marks: number; ms: number }[] }>('return _G.long_artifact');
  assert.ok(audit.reused.length > 0, 'fixture exercises synchronous reused-parser turns');
  assert.ok(audit.reused.every(s => s.recorded), 'every synchronous reused-parser turn is in the timing audit');
  assert.ok(audit.async > 0, 'whole-document parser uses asynchronous slices');
  assert.ok(audit.slices.length > 1);
  assert.ok(Math.max(...audit.slices.map(s => s.work)) <= 256, 'at most 256 extraction/projection steps per slice');
  assert.ok(Math.max(...audit.slices.map(s => s.rows)) <= 128, 'at most 128 projected buffer rows per slice');
  assert.ok(Math.max(...audit.slices.map(s => s.marks)) <= 256, 'at most 256 decorations per slice');
  const maximumSliceMs = Math.max(audit.initialSliceMs, ...audit.slices.map(s => s.ms));
  assert.ok(maximumSliceMs < 1000, 'gross one-second slice guard under load');
  await c.lua("require('cland.artifacts').open('A-1003')");
  assert.equal(await c.lua('return _G.long_artifact.parsers'), audit.parsers, 'unchanged 20,000-line version creates zero new parsers');
  t.diagnostic(`20,000-line render: first ${first.ms.toFixed(3)} ms; ${audit.slices.length} slices; max slice ${maximumSliceMs.toFixed(3)} ms; initial render ${audit.initialSliceMs.toFixed(3)} ms; worst ${JSON.stringify(audit.slices.toSorted((a,b) => b.ms-a.ms).slice(0,3))}; max work ${Math.max(...audit.slices.map(s => s.work))}; max rows ${Math.max(...audit.slices.map(s => s.rows))}; max marks ${Math.max(...audit.slices.map(s => s.marks))}; parsers ${audit.parsers}; async ${audit.async}`);
});

test('sliced artifacts retain whole-document Markdown context and discard superseded work', { skip }, async t => {
  const root = await tempProject(t);
  const path = join(root, 'context.md');
  const text = ['# Whole context', '[Read][far]', '```text', ...Array.from({ length: 300 }, () => '# Literal code'), '```', '| Label | Value |', '|---|---|', ...Array.from({ length: 300 }, (_, i) => `| **Row ${i}** | ready |`), '', '```lua', `vim.cmd('echo \"nested\"')`, '```', '```markdown', '**Inner bold** [Nested](https://example.com/nested)', '```', '', '> let nested = 1', '> echo nested', '', 'local combined = [[', '', 'joined]]', '', '[far]: https://example.com/destination'].join('\n');
  await writeFile(path, text);
  const c = await (await artifactScreen(t, root)).start();
  await waitInitialSnapshots(c);
  await c.input('<Esc>');
  await c.lua(`
    local queries={}
    for _,path in ipairs(vim.treesitter.query.get_files('markdown','injections')) do
      queries[#queries+1]=table.concat(vim.fn.readfile(path),'\\n')
    end
    queries[#queries+1]=[=[
      ((paragraph (inline) @injection.content)
        (#set! injection.language "lua") (#set! injection.combined))
      ((block_quote) @injection.content
        (#set! injection.language "vim") (#set! injection.include-children))
      ((block_quote) @injection.content (#set! injection.language "c"))
    ]=]
    vim.treesitter.query.set('markdown','injections',table.concat(queries,'\\n'))
    local md=require('cland.thread_md')
    local render=md.render_async
    md.render_async=function(text,cells,done,valid)
      return render(text,cells,function(lines,spans,metadata)
        _G.context_projection={lines=lines,spans=spans,metadata=metadata}
        done(lines,spans,metadata)
      end,valid)
    end
  `);
  await c.lua("require('cland.artifacts').open({id='A-1003-context',kind='note',creator='human',status='shared',title='Context',topic='general',path=...})", path);
  await eventually('context projection fully decorated', async () => await c.lua('return vim.b.cland_render_pending==false') ? true : undefined);
  assert.deepEqual(await c.lua(`
    local fresh=assert(loadfile(vim.api.nvim_get_runtime_file('lua/cland/thread_md.lua',false)[1]))()
    local lines,spans,metadata=fresh.render(table.concat(vim.fn.readfile(...),'\\n'),vim.api.nvim_win_get_width(0))
    local function canonical(values)
      local out={}
      for _,value in ipairs(values) do out[#out+1]=vim.inspect(value) end
      table.sort(out)
      return out
    end
    local api=vim.api
    local oracle=api.nvim_create_buf(false,true)
    api.nvim_buf_set_lines(oracle,0,-1,false,lines)
    local ns=api.nvim_create_namespace('cland.artifact_md')
    for _,span in ipairs(spans) do api.nvim_buf_set_extmark(oracle,ns,span.row,span.col,span.opts) end
    local function styles(b)
      local out={}
      for _,mark in ipairs(api.nvim_buf_get_extmarks(b,ns,0,-1,{details=true})) do
        out[#out+1]={mark[2],mark[3],mark[4]}
      end
      return canonical(out)
    end
    local applied=vim.deep_equal(styles(0),styles(oracle))
    api.nvim_buf_delete(oracle,{force=true})
    return {vim.deep_equal(lines,vim.api.nvim_buf_get_lines(0,0,-1,false)),
      vim.deep_equal(canonical(spans),canonical(_G.context_projection.spans)),
      vim.deep_equal(metadata,_G.context_projection.metadata),applied}
  `, path), [true,true,true,true], 'sliced text, styles/conceal and link metadata match the existing whole-document renderer');
  await c.input('gg');
  let screen = await c.waitScreen(s => s.includes('Whole context') && s.includes('Read') && s.includes('# Literal code') && !s.includes('[far]') && !s.includes('```'), 'reference resolves across slices and headings remain literal inside the long fence');
  assert.ok(!screen.includes('# Whole context'), screen);
  await c.input('G');
  screen = await c.waitScreen(s => /\| Row 299 +\| ready \|/.test(s) && !s.includes('**Row') && !s.includes('```'), 'long table fully projected');
  assert.ok(/\| Row 299 +\| ready \|/.test(screen), screen);
  await c.lua(`
    local path=...
    -- Queue one old version, then replace it before its deferred callbacks run.
    vim.fn.writefile({'# Superseded', unpack(vim.fn.readfile(path))},path)
    require('cland.artifacts').open('A-1003-context')
    assert(vim.b.cland_render_pending)
    vim.fn.writefile({'# Replacement', 'Use **current** text.'},path)
    require('cland.artifacts').open('A-1003-context')
  `, path);
  await c.input('gg');
  await c.waitScreen(s => s.includes('Replacement') && s.includes('Use current text.') && !s.includes('# Replacement'), 'replacement version rendered');
  // The barrier follows the already queued stale-version callback on the loop.
  await c.lua('_G.stale_artifact_drained=false; vim.defer_fn(function() _G.stale_artifact_drained=true end,0)');
  await eventually('stale callback barrier', async () => await c.lua('return _G.stale_artifact_drained') ? true : undefined);
  screen = (await c.screen()).join('\n');
  assert.ok(screen.includes('Replacement') && !screen.includes('Superseded') && !screen.includes('Literal code'), screen);
  assert.deepEqual(await c.lua('return {vim.bo.readonly,vim.bo.modifiable}'), [true, false]);
});
