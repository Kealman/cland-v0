// T2: rendered artifact buffers and the grid through the recorded stdio client.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { artifactScreen, skip } from './artifact-screen-fixture.ts';
import { tempProject } from './fixture.ts';
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
