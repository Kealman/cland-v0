// T2: artifact screens replay recorded frames; persistence and send rules live in hub/test/nvim-artifacts-rules.test.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { eventually, tempProject } from './fixture.ts';
import { artifactScreen, skip } from './artifact-screen-fixture.ts';
import { waitInitialSnapshots } from './readiness.ts';
import { stubControl } from './stub-control.ts';

test('recorded frames: keeping an agent artifact updates the thread and palette across unkeep and reconnect', { skip }, async t => {
  const root = await tempProject(t);
  const scene = await artifactScreen(t, root);
  const topic = 'reports';
  scene.scenario.topics!.push({ id: topic, title: 'Reports', status: 'open', standing: false, createdAt: '2026-10-08T10:00:00.000Z', updatedAt: '2026-10-08T10:00:00.000Z' });
  const a = await scene.create({ kind: 'note', title: 'Agent report', topic, content: 'Report bytes' }, { name: 'impl', role: 'implementer', kind: 'agent' });
  const c = await scene.start();
  await waitInitialSnapshots(c);
  await c.waitScreen(s => s.includes('hub: connected'), 'connected');
  await c.lua(`require('cland.layout').show({kind='thread', id=${JSON.stringify(topic)}}, {insert=false})`);
  await c.waitScreen(s => s.includes('1 artifacts'), 'artifact count loaded');
  await eventually('artifact history is rendered before unfolding', async () => await c.lua(`
    local thread = require('cland.views').topic(${JSON.stringify(topic)}).thread
    local win = require('cland.layout').centre()
    for _,m in ipairs(thread.messages) do
      if m.artifact and m.artifact.id == ${JSON.stringify(a.id)} then
        return thread.fold_ready[win] and thread:folded_count(win) > 0
      end
    end
  `) || undefined);
  await c.input('zR');
  await c.waitScreen(s => s.includes(a.id) && s.includes('Agent report'), 'artifact chip');
  const placement = async () => await c.lua(`
    local a = require('cland.artifacts').get(${JSON.stringify(a.id)})
    local thread = require('cland.views').topic(${JSON.stringify(topic)}).thread
    for _,m in ipairs(thread.messages) do if m.artifact and m.artifact.id == ${JSON.stringify(a.id)} then
      return {a.layer, require('cland.thread').layer(m), require('cland.palette').dim('artifacts', a)}
    end end
  `);
  assert.deepEqual(await placement(), ['background', 'background', true]);
  const change = async (kept: boolean) => {
    await scene.change({ type: 'artifact.keep', artifact: a.id, kept });
    const expected = kept ? ['watch', 'watch', false] : ['background', 'background', true];
    await eventually('thread and palette share the updated layer', async () => {
      const actual = await placement();
      return JSON.stringify(actual) === JSON.stringify(expected) ? actual : undefined;
    });
  };
  await change(true);
  await c.lua("require('cland').client:stop(); require('cland').client:start()");
  await c.waitScreen(s => s.includes('hub: connected'), 'reconnected');
  await eventually('kept placement restored', async () => JSON.stringify(await placement()) === JSON.stringify(['watch', 'watch', false]) ? true : undefined);
  await change(false);
});

test('recorded frames: Coordinator artifacts in Agents open from the log and its topic list', { skip }, async (t) => {
  const root = await tempProject(t);
  const scene = await artifactScreen(t, root);
  await scene.create({ kind: 'note', title: 'Plan', content: '# Shared plan', topic: 'agents' }, { name: 'coord', role: 'coordinator', kind: 'agent' });
  const c = await scene.start();
  await waitInitialSnapshots(c);
  await c.input('<Esc><Space>L');
  await c.waitScreen((s) => s.includes('▣ A-1 note · Plan') && s.includes('1 artifacts'), 'Agents chip and count');
  assert.equal(await c.lua("return require('cland.views').current_topic()"), 'agents');
  await c.lua(`local b = require('cland.agents_log').buf; for i,l in ipairs(vim.api.nvim_buf_get_lines(b, 0, -1, false)) do if l:find('▣') then vim.api.nvim_set_current_win(require('cland.layout').centre()); vim.api.nvim_win_set_cursor(0, {i,0}); break end end`);
  await c.input('<CR>');
  await c.waitScreen((s) => s.includes('Shared plan') && !s.includes('# Shared plan'), 'Agents artifact rendered');
  assert.deepEqual(await c.lua('return { vim.bo.filetype, vim.bo.readonly, vim.bo.modifiable }'), ['', true, false]);
  await c.input('qga');
  await c.input('zR');
  await c.waitScreen((s) => s.includes('ARTIFACTS') && s.includes('A-1 note · Plan') && s.includes('coord') && s.includes('shared'), 'Agents artifact list');
  await c.lua("for i,l in ipairs(vim.api.nvim_buf_get_lines(0,0,-1,false)) do if l:find('A%-1 ') then vim.api.nvim_win_set_cursor(0,{i,0}); break end end");
  await c.input('<CR>');
  await c.waitScreen((s) => s.includes('Shared plan') && !s.includes('# Shared plan'), 'rendered from Agents list');
});

test('recorded frames: artifact chip opens editable Mermaid source and the browser renderer, topic list and picker open artifacts', { skip }, async (t) => {
  const root = await tempProject(t);
  const scene = await artifactScreen(t, root);
  const a = await scene.create({ kind: 'diagram', title: 'Merge flow', content: 'graph TD\n A-->B', topic: 'general' });
  const opened = join(root, 'opened.txt');
  const opener = join(root, 'opener');
  await writeFile(opener, `#!/bin/sh\nprintf '%s\\n' "$1" >> '${opened}'\n`, { mode: 0o755 });
  const c = await scene.start({ CLAND_OPENER: opener });
  await waitInitialSnapshots(c);
  await c.waitScreen((s) => s.includes('▣ A-1 diagram · Merge flow') && s.includes('1 artifacts'), 'artifact chip and count');
  await c.input('<Esc>');
  await c.lua(`local tv = require('cland.views').topic('general'); for i,l in ipairs(vim.api.nvim_buf_get_lines(tv.thread.buf, 0, -1, false)) do if l:find('▣') then vim.api.nvim_set_current_win(require('cland.layout').centre()); vim.api.nvim_win_set_cursor(0, {i,0}); break end end`);
  await c.input('<CR>');
  await c.waitScreen((s) => s.includes('graph TD'), 'Mermaid source');
  assert.deepEqual(await c.lua('return { vim.bo.filetype, vim.bo.readonly, vim.bo.modifiable }'), ['mermaid', false, true]);
  await c.input('R');
  const renderPath = await eventually('Mermaid browser opener', async () => (await readFile(opened, 'utf8').catch(() => '')).trim() || undefined);
  const rendered = await readFile(renderPath, 'utf8');
  assert.match(rendered, /mermaid@11\.4\.1/);
  assert.match(rendered, /securityLevel: 'strict'/);
  assert.match(rendered, /graph TD\n A--&gt;B/);
  assert.ok(!rendered.includes('\0'), 'the preview preserves source newlines');
  await c.input('<Space><Space>');
  await c.input('ga');
  await c.waitScreen((s) => s.includes('ARTIFACTS') && s.includes('A-1 diagram · Merge flow') && s.includes('human') && s.includes('shared'), 'topic artifact list');
  await c.lua("for i,l in ipairs(vim.api.nvim_buf_get_lines(0,0,-1,false)) do if l:find('A%-1 ') then vim.api.nvim_win_set_cursor(0,{i,0}); break end end");
  await c.input('<CR>');
  await c.waitScreen((s) => s.includes('graph TD'), 'source from list');
  await c.input('<Space>a');
  await c.waitScreen((s) => s.includes('palette ›') && s.includes('A-1 diagram · Merge flow'), 'artifacts picker');
  await c.input('<CR>');
  await c.waitScreen((s) => s.includes('graph TD') && !s.includes('palette ›'), 'source from picker');
  const p = await scene.create({ kind: 'page', title: 'Preview', content: '<h1>Preview</h1>', topic: 'general' });
  await c.input('<Space>a');
  await c.waitScreen((s) => s.includes('A-2 page · Preview'), 'new page in picker');
  await c.input('A-2<CR>');
  await eventually('page browser opener', async () => (await readFile(opened, 'utf8')).includes(p.path) ? true : undefined);
  assert.equal(await readFile(a.path, 'utf8'), 'graph TD\n A-->B');
});

test('recorded frames: prompt drafts are editable full buffers, survive hub events, reopen, and send saved text', { skip }, async (t) => {
  const root = await tempProject(t);
  const scene = await artifactScreen(t, root);
  const c = await scene.start();
  await waitInitialSnapshots(c);
  await c.waitScreen(s => s.includes('hub: connected'), 'connected before drafting');
  await c.input('<Esc>:Cland prompt Brief for T-12<CR>');
  await eventually('draft buffer', async () => await c.lua("return vim.b.cland_artifact") || undefined);
  assert.deepEqual(await c.lua("return {vim.bo.modifiable, vim.bo.readonly, vim.bo.buftype, vim.api.nvim_buf_get_lines(0,0,-1,false)}"), [true, false, '', ['']]);
  await c.waitScreen(s => s.includes(':w saves') && s.includes('␣ps send') && !s.includes('read-only'), 'editable draft help');
  await c.input('iFirst line<CR>Second line<Esc>:w<CR>');
  assert.deepEqual(await c.lua('return vim.api.nvim_buf_get_lines(0,0,-1,false)'), ['First line', 'Second line'], (await c.screen()).join('\n'));
  const path = await c.lua<string>('return vim.api.nvim_buf_get_name(0)');
  assert.match(path, /A-\d+-brief-for-t-12\.md$/);
  await eventually('saved prompt', async () => (await readFile(path, 'utf8')).startsWith('First line') || undefined);
  assert.equal(await readFile(path, 'utf8'), 'First line\nSecond line');
  await c.input('A unsaved');
  const before = await c.lua('return {vim.api.nvim_get_current_buf(), vim.api.nvim_win_get_cursor(0), vim.api.nvim_buf_get_lines(0,0,-1,false), vim.fn.mode()}');
  await scene.emit([{ type: 'message', topic: { id: 'general', title: 'General' }, message: { id: 'draft-event', from: 'coord', fromRole: 'coordinator', fromKind: 'agent', via: 'hub', to: [], topic: 'general', ts: '2026-10-08T10:00:00.000Z', text: 'An event while drafting' } }]);
  await eventually('hub event received', async () => await c.lua("return #require('cland.views').topic('general').thread.messages > 0") || undefined);
  assert.deepEqual(await c.lua('return {vim.api.nvim_get_current_buf(), vim.api.nvim_win_get_cursor(0), vim.api.nvim_buf_get_lines(0,0,-1,false), vim.fn.mode()}'), before);
  await c.input('<Esc>q<Space>a');
  await c.waitScreen(s => s.includes('draft') && s.includes('Brief for T-12'), 'draft in picker');
  await c.input('<CR>');
  await c.waitScreen(s => s.includes('First line') && s.includes('Second line'), 'reopened draft');
  await c.input(':Cland prompt send<CR>');
  await eventually('saved sent text', async () => (await readFile(path, 'utf8')) === 'First line\nSecond line unsaved' || undefined);
  await eventually('sent status', async () => await c.lua("return require('cland.artifacts').entries[1].status == 'sent'") || undefined);
  await c.input(':Cland view thread general<CR>');
  await c.waitScreen(s => s.includes('Second line unsaved') && s.includes('▣ A-1 prompt'), 'sent inline text and artifact chip in the thread');
});

test('recorded frames: p in a topic artifact list promotes it and updates the list and picker marks', { skip }, async (t) => {
  const root = await tempProject(t);
  const scene = await artifactScreen(t, root);
  const a = await scene.create({ kind: 'note', title: 'Keep', content: '# Keep', topic: 'general' });
  const c = await scene.start();
  await waitInitialSnapshots(c);
  await c.waitScreen(s => s.includes('1 artifacts'), 'artifact loaded');
  await c.input('<Esc>');
  await c.lua("vim.api.nvim_set_current_win(require('cland.layout').centre())");
  await c.input('ga');
  await c.waitScreen(s => s.includes('ARTIFACTS') && s.includes(a.id), 'artifact list');
  await c.lua("for i,l in ipairs(vim.api.nvim_buf_get_lines(0,0,-1,false)) do if l:find('A%-1 ') then vim.api.nvim_win_set_cursor(0,{i,0}); break end end");
  await c.input('p');
  await c.waitScreen(s => s.includes('Promote to project path'), 'promote prompt');
  await c.input('docs/keep.md<CR>');
  await c.waitScreen(s => s.includes('promoted: docs/keep.md'), 'promoted list mark');
  assert.equal(await readFile(join(root, 'docs/keep.md'), 'utf8'), '# Keep');
  await c.input('<Space>a');
  await c.waitScreen(s => s.includes('palette ›') && s.includes('promoted: docs/keep.md'), 'promoted picker mark');
});

test('recorded frames: topic lists follow archive events and lists and pickers mark retained entries whose files were deleted', { skip }, async (t) => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[artifacts]\nretention_days = 0\n');
  const scene = await artifactScreen(t, root);
  const topic = 'archive';
  scene.scenario.topics!.push({ id: topic, title: 'Archive', status: 'open', standing: false, createdAt: '2026-10-08T10:00:00.000Z', updatedAt: '2026-10-08T10:00:00.000Z' });
  const a = await scene.create({ kind: 'note', title: 'Old note', content: 'old bytes', topic }, { name: 'coord', role: 'coordinator', kind: 'agent' });
  const c = await scene.start();
  await waitInitialSnapshots(c);
  await c.waitScreen(s => s.includes('hub: connected'), 'connected');
  await c.lua(`require('cland.layout').show({kind='artifacts', id=${JSON.stringify(topic)}}, {insert=false})`);
  await c.input('zR');
  await c.waitScreen(s => s.includes(a.id) && s.includes('shared'), 'shared artifact mark');
  Object.assign(scene.scenario.artifacts![0]!, { status: 'archived' });
  await scene.publish([{ type: 'artifact', artifact: scene.scenario.artifacts![0] }]);
  await c.waitScreen(s => s.includes('Archived (1)') && !s.includes(a.id + ' note'), 'artifact leaves live sections');
  await c.input('A');
  await c.waitScreen(s => s.includes(a.id) && s.includes('archived'), 'live archived artifact mark');
  Object.assign(scene.scenario.artifacts![0]!, { fileDeleted: true });
  await scene.publish();
  await c.lua("require('cland').client:stop(); require('cland').client:start()");
  await c.waitScreen(s => s.includes(a.id) && s.includes('file deleted'), 'deleted list mark after restart');
  await c.input('<Space>a');
  await c.waitScreen(s => s.includes('palette ›') && s.includes('file deleted'), 'deleted picker mark');
  await c.input('<CR>');
  await c.waitScreen(s => s.includes('artifact: file deleted'), 'deleted entry cannot open');
});

test('recorded frames: folder chips open their entry and old moved-file chips open inside the folder', { skip }, async t => {
  const root = await tempProject(t);
  const scene = await artifactScreen(t, root);
  const folder = await scene.create({ kind: 'note', title: 'Folder', topic: 'general', folder: true, content: '# Folder entry' });
  const source = await scene.create({ kind: 'note', title: 'Source', topic: 'general', content: '# Moved note' });
  const c = await scene.start();
  await waitInitialSnapshots(c);
  await c.waitScreen(s => s.includes('Folder') && s.includes('Source'), 'folder and source chips');
  await c.lua(`require('cland.artifacts').open(${JSON.stringify(folder.id)})`);
  await c.waitScreen(s => s.includes('Folder entry') && !s.includes('# Folder entry'), 'folder entry');
  await c.input('q');
  await scene.change({ type: 'artifact.move', artifact: source.id, folder: folder.id, name: 'moved.md' });
  await eventually('live source redirect', async () => await c.lua(`return require('cland.artifacts').get(${JSON.stringify(source.id)}).movedTo ~= nil`) || undefined);
  await c.lua(`require('cland.artifacts').open(${JSON.stringify(source.id)})`);
  await c.waitScreen(s => s.includes('Moved note') && !s.includes('# Moved note'), 'old chip resolves to the moved file');
  await c.input('<Space>v');
  assert.equal(await c.lua('return vim.api.nvim_buf_get_name(0)'), join(folder.path, 'moved.md'));
  assert.deepEqual(await c.lua(`local a = require('cland.artifacts').all(); local ids = {}; for _,x in ipairs(a) do ids[#ids+1] = x.id end; return ids`), [folder.id]);
});


test('recorded frames: moving an already-open prompt rebinds its editable buffer before the next save', { skip }, async t => {
  const root = await tempProject(t);
  const scene = await artifactScreen(t, root);
  const make = (folder = false) => scene.create({ kind: 'prompt', title: 'Draft', topic: 'general', status: 'draft', content: 'Draft bytes', folder });
  const source = await make(), folder = await make(true);
  const c = await scene.start();
  await waitInitialSnapshots(c);
  await c.waitScreen(s => s.includes('hub: connected'), 'connected');
  await eventually('source artifact list loaded', async () => await c.lua(`return require('cland.artifacts').get(${JSON.stringify(source.id)}) ~= nil`) || undefined);
  await c.lua(`require('cland.artifacts').open(${JSON.stringify(source.id)})`);
  await c.waitScreen(s => s.includes('Draft bytes'), 'editable draft');
  await c.lua("vim.api.nvim_buf_set_lines(0, 0, -1, false, {'Unsaved moved bytes'})");
  const destination = join(folder.path, 'moved.md');
  await scene.change({ type: 'artifact.move', artifact: source.id, folder: folder.id, name: 'moved.md' });
  await eventually('open buffer rebound', async () => await c.lua('return vim.api.nvim_buf_get_name(0)') === destination ? true : undefined);
  await c.input(':w<CR>');
  await eventually('save reaches moved file', async () => (await readFile(destination, 'utf8')).includes('Unsaved moved bytes') ? true : undefined);
  await assert.rejects(readFile(source.path), { code: 'ENOENT' });
});

test('recorded frames: a draft moved while disconnected resolves and rebinds on reconnect before saving', { skip }, async t => {
  const root = await tempProject(t);
  const scene = await artifactScreen(t, root);
  const make = (folder = false) => scene.create({ kind: 'prompt', title: 'Draft', topic: 'general', status: 'draft', content: 'Draft bytes', folder });
  const source = await make(), folder = await make(true);
  const c = await scene.start();
  await waitInitialSnapshots(c);
  await c.waitScreen(s => s.includes('hub: connected'), 'connected');
  await eventually('source artifact list loaded', async () => await c.lua(`return require('cland.artifacts').get(${JSON.stringify(source.id)}) ~= nil`) || undefined);
  await c.lua(`require('cland.artifacts').open(${JSON.stringify(source.id)})`);
  await c.waitScreen(s => s.includes('Draft bytes'), 'editable draft');
  await c.lua("vim.api.nvim_buf_set_lines(0, 0, -1, false, {'Unsaved moved bytes'})");
  await c.lua("require('cland').client:stop()");
  scene.disconnect();
  const destination = join(folder.path, 'moved.md');
  await scene.change({ type: 'artifact.move', artifact: source.id, folder: folder.id, name: 'moved.md' });
  assert.equal(await c.lua('return vim.api.nvim_buf_get_name(0)'), source.path);
  await scene.reconnect();
  await c.lua("require('cland').client:start()");
  await eventually('open buffer rebound after reconnect', async () => await c.lua('return vim.api.nvim_buf_get_name(0)') === destination ? true : undefined);
  await c.input(':w<CR>');
  await eventually('save reaches moved file', async () => (await readFile(destination, 'utf8')).includes('Unsaved moved bytes') ? true : undefined);
  await assert.rejects(readFile(source.path), { code: 'ENOENT' });
});


test('artifact browser and palette fetch the next page only on human demand', { skip }, async t => {
  const root = await tempProject(t);
  const scene = await artifactScreen(t, root);
  scene.scenario.artifactPageSize = 2;
  for (let n = 1; n <= 7; n++) await scene.create({ kind: 'note', title: `Paged note ${n}`, topic: 'general', content: 'Page content' });
  const c = await scene.start();
  await waitInitialSnapshots(c);
  await eventually('first artifact page installed', async () => await c.lua("return #require('cland.artifacts').entries") === 2 || undefined);
  assert.deepEqual(await c.lua("return vim.tbl_map(function(a) return a.id end,require('cland.artifacts').entries)"), ['A-7', 'A-6']);
  await c.lua("require('cland.layout').show({kind='artifacts',id='general'},{insert=false})");
  await c.waitScreen(s => s.includes('Paged note 4'), 'browser next page rendered');
  assert.equal(await c.lua("return #require('cland.artifacts').entries"), 4);
  await c.lua("require('cland.palette').open({query='~'})");
  await c.waitScreen(s => s.includes('Paged note 2'), 'palette next page rendered');
  assert.equal(await c.lua("return #require('cland.artifacts').entries"), 6);
  await c.input('<C-n><C-n><C-n><C-n><C-n><C-n>');
  await c.waitScreen(s => s.includes('Paged note 1'), 'palette scroll loads final page');
  assert.equal(await c.lua("return #require('cland.artifacts').entries"), 7);
});


test('archived General thread follows byte-capped pages shorter than the row limit', { skip }, async t => {
  const root = await tempProject(t);
  const scene = await artifactScreen(t, root);
  scene.scenario.historyPageSize = 2;
  scene.scenario.rules = [{number:1,title:'Paged origin',scope:'all',date:'2026-10-09',status:'active',origin:'message:general/page-0',reason:'Keep the origin',text:'Read the complete origin'}];
  scene.scenario.messages = {general: Array.from({length: 5}, (_, i) => ({id: `page-${i}`, from: 'human', fromKind: 'human', via: 'hub', to: [], text: `Complete message ${i}`, ts: '2026-10-09T10:00:00.000Z', topic: 'general'}))};
  const c = await scene.start();
  await c.waitScreen(s => s.includes('Complete message 4'), 'latest General page');
  assert.equal(await c.lua("return #require('cland.views').topic('general').thread.messages"), 2);
  await c.lua("vim.api.nvim_set_current_win(require('cland.layout').centre())");
  await c.input('A');
  await eventually('all General pages are installed', async () => await c.lua("return #require('cland.views').topic('general').thread.messages") === 5 || undefined);
  await c.input('gg');
  await c.waitScreen(s => s.includes('Complete message 0'), 'oldest complete message from next pages');
  assert.deepEqual(await c.lua("return vim.tbl_map(function(m) return m.text end,require('cland.views').topic('general').thread.messages)"), Array.from({length: 5}, (_, i) => `Complete message ${i}`));
  await c.input('<Esc> R');
  await c.waitScreen(s => s.includes('Paged origin'), 'rule list still renders');
  await c.input('j<CR>');
  await c.waitScreen(s => s.includes('Origin: General'), 'rule origin follows byte-capped next pages');
  await c.input('gt');
  await c.waitScreen(s => s.includes('Complete message 0') && !s.includes('Rulebook ·'), 'rule origin opens the complete older message');
});

test('an older-page rendered artifact survives reconnect and visibility while detail reads are held', { skip }, async t => {
  const root = await tempProject(t);
  const scene = await artifactScreen(t, root);
  scene.scenario.artifactPageSize = 2;
  for (let n = 1; n <= 4; n++) await scene.create({ kind: 'note', title: `Retained note ${n}`, topic: 'general', ...(n === 2 ? {folder:true} : {}), content: `# Retained heading ${n}\nExact source ${n}` });
  const c = await scene.start();
  const control = (frame: Record<string, unknown>) => stubControl(join(root, 'artifact-stub.sock'), frame);
  await eventually('startup artifact page', async () => await c.lua("return #require('cland.artifacts').entries") === 2 || undefined);
  await c.lua("require('cland.layout').show({kind='artifacts',id='general'},{insert=false})");
  await c.waitScreen(s => s.includes('Retained note 1'), 'older page installed');
  await c.lua("require('cland.artifacts').open('A-1')");
  await c.waitScreen(s => s.includes('Retained heading 1') && !s.includes('# Retained heading 1'), 'older artifact rendered');
  assert.equal(await c.lua("return require('cland.artifacts').bufs['A-1'] == nil"), true, 'rendered opens have no raw buffer');
  await c.lua("require('cland.artifacts').open('A-2','index.md',{split=true}); vim.api.nvim_set_current_win(require('cland.layout').centre())");
  await c.waitScreen(s => s.includes('Retained heading 1') && s.includes('Retained heading 2'), 'older centre and split folder child rendered');
  for (const refresh of ['reconnect', 'visibility']) {
    await control({set:{holdSnapshots:['artifact.list']}});
    if (refresh === 'reconnect') {
      scene.scenario.holdSnapshots = ['artifact.list'];
      await scene.reconnect();
      const previous = await stat(join(root, 'artifact-stub.sock'));
      await c.lua("require('cland').client:stop(); require('cland').client:start()");
      await eventually('new control socket after reconnect', async () => {
        const current = await stat(join(root, 'artifact-stub.sock')).catch(() => undefined);
        return current && current.ino !== previous.ino || undefined;
      });
    } else await control({emit:{type:'visibility',surface:'artifacts',target:'A-3',mode:'pin'}});
    await control({waitSnapshot:'artifact.list'});
    await control({releaseSnapshots:['artifact.list']});
    await eventually('first page replaced before detail completes', async () => await c.lua("return require('cland.artifacts').loading == false and require('cland.artifacts').before == 'A-3'") || undefined);
    await control({waitSnapshot:'artifact.list',snapshotCount:2});
    await c.lua("require('cland.layout').apply_view(); require('cland.artifacts').toggle()");
    await c.waitScreen(s => s.includes('# Retained heading 1'), 'raw view survives refresh before detail receipt');
    assert.equal(await c.lua("local separator=...; return table.concat(vim.api.nvim_buf_get_lines(0,0,-1,false),separator)", '\n'), '# Retained heading 1\nExact source 1');
    await c.lua("require('cland.artifacts').toggle()");
    await c.waitScreen(s => s.includes('Retained heading 1') && !s.includes('# Retained heading 1'), 'rendered view survives refresh');
    await c.lua("for _,w in ipairs(vim.api.nvim_list_wins()) do local b=vim.api.nvim_win_get_buf(w); if vim.b[b].cland_artifact=='A-2' then vim.api.nvim_set_current_win(w); require('cland.artifacts').toggle(); break end end");
    await c.waitScreen(s => s.includes('# Retained heading 2'), 'raw folder child survives delayed detail');
    await c.lua("require('cland.artifacts').toggle(); vim.api.nvim_set_current_win(require('cland.layout').centre())");
    await c.waitScreen(s => s.includes('Retained heading 1') && s.includes('Retained heading 2') && !s.includes('# Retained heading'), 'both rendered identities survive');
    await control({set:{holdSnapshots:[]},releaseSnapshots:['artifact.list']});
  }
});
