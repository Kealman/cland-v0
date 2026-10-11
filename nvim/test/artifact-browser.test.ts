import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';
import { connectUi, eventually, spawnSpoke, startDaemon, tempProject } from '../../hub/test/harness.ts';
import { nvimOrSkip, startClient, type Client } from './harness.ts';

const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';

async function row(c: Client, text: string) {
  await c.lua(`for i,l in ipairs(vim.api.nvim_buf_get_lines(0,0,-1,false)) do if l:find(...,1,true) then vim.api.nvim_win_set_cursor(0,{i,0}); return end end; error('no row: ' .. ...)`, text);
}
async function input(c: Client, prompt: string, value: string) {
  await c.waitScreen(s => s.includes(prompt), prompt);
  await c.input(value + '<CR>');
}

test('Artifacts browser creates v0.2 notes, saves two folder files in place and attaches the folder with s', { skip }, async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const c = await startClient(t, bin, root);
  await c.waitScreen(s => s.includes('hub: connected'), 'connected');
  await c.input('<Esc>:Cland view artifacts general<CR>');
  await c.waitScreen(s => s.includes('Mine') && s.includes('This topic') && s.includes('Kept') && s.includes('Archived'), 'browser sections');
  await c.input('n');
  await input(c, 'File or folder:', 'folder');
  await input(c, 'Kind:', 'note');
  await input(c, 'Title:', 'v0.2 notes');
  await c.waitScreen(s => s.includes('A-1 note · v0.2 notes'), 'new folder');
  const list = (await ui.request({ type: 'artifact.list' })).value as { artifacts: Array<{ id: string; path: string; folder: boolean }> };
  assert.equal(list.artifacts.length, 1);
  const folder = list.artifacts[0]!;
  assert.equal(folder.folder, true);
  await row(c, 'v0.2 notes');
  await c.input('<CR>');
  await c.waitScreen(s => s.includes('index.md'), 'unfolded folder entry');
  for (const [name, bytes] of [['ideas.md', '# Ideas'], ['release.md', '# Release notes']]) {
    await row(c, 'v0.2 notes');
    await c.input('n');
    await input(c, 'File name in folder:', name!);
    await eventually('normal editable file buffer', async () => await c.lua('return vim.bo.buftype == "" and vim.bo.modifiable') || undefined);
    await c.input('i' + bytes + '<Esc>:w<CR>');
    await eventually('saved folder file', async () => (await readFile(join(folder.path, name!), 'utf8').catch(() => '')).trim() === bytes ? true : undefined);
    await c.input('q');
    await c.waitScreen(s => s.includes(name!), 'saved file in tree');
  }
  const contents = (await ui.request({ type: 'artifact.list', artifact: folder.id })).value as { files: string[] };
  assert.deepEqual(contents.files, ['ideas.md', 'index.md', 'release.md']);
  await row(c, 'v0.2 notes');
  await c.input('s');
  await c.waitScreen(s => s.includes('attached: ' + folder.id), 'composer attachment');
  await c.input('Review these notes<CR>');
  await eventually('message carries the folder id', async () => {
    const result = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: Array<{ text: string; artifacts?: Array<{ id: string }> }> };
    return result.messages.find(m => m.text === 'Review these notes' && m.artifacts?.[0]?.id === folder.id);
  });
  const after = (await ui.request({ type: 'artifact.list' })).value as { artifacts: unknown[] };
  assert.equal(after.artifacts.length, 1, 'folder children are files, not indexed artifacts');
});

test('browser folds background and archive, keeps live selection, moves a file into a folder and promotes that folder', { skip }, async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const topic = ((await ui.request({type:'topic.create',title:'Browser notes'})).value as {topic:{id:string}}).topic.id;
  const make = async (title: string, folder = false) => ((await ui.request({ type: 'artifact.create', kind: 'note', title, topic, folder, content: '# ' + title })).value as { artifact: { id: string; path: string } }).artifact;
  const file = await make('Alpha file'), folder = await make('Zebra folder', true);
  const impl = await spawnSpoke({ discover: true, cwd: root, name: 'impl', role: 'implementer' });
  t.after(() => impl.close());
  await impl.waitForPresence(['impl']);
  await ui.request({ type: 'topic.send', topic, text: '@impl show a report' });
  const agent = await impl.call<{ ok: boolean; artifact: { id: string } }>('artifact.create', { kind: 'note', title: 'Background report', topic, content: '# Report' });
  assert.equal(agent.ok, true, JSON.stringify(agent));
  const c = await startClient(t, bin, root);
  await c.waitScreen(s => s.includes('hub: connected'), 'connected');
  await c.input('<Esc>:Cland view artifacts ' + topic + '<CR>');
  await c.waitScreen(s => s.includes('Mine (2)') && s.includes('Implementers (1)'), 'mine and role counts');
  const screen = (await c.screen()).join('\n');
  assert.ok(screen.indexOf('Zebra folder') < screen.indexOf('Alpha file'), 'mine lists folders first');
  assert.ok(!screen.includes('Background report'), 'background is folded even in This topic');
  await row(c, 'more (1)');
  await c.input('<CR>');
  await c.waitScreen(s => s.includes('Background report'), 'unfolded topic background');
  await row(c, 'Background report');
  await c.input('k');
  await c.waitScreen(s => s.includes('Kept (1)'), 'kept section updates');
  assert.ok(await c.lua<boolean>("return vim.api.nvim_get_current_line():find('Background report',1,true) ~= nil"), 'selection follows the artifact after its layer changes');
  const kept = (await ui.request({ type: 'artifact.list', artifact: agent.artifact.id })).value as { artifact: { kept: boolean } };
  assert.equal(kept.artifact.kept, true);
  await c.input('k');
  await c.waitScreen(s => s.includes('Kept (0)'), 'unkeep');
  await row(c, 'Alpha file');
  await c.input('m');
  await input(c, 'Move into folder:', '1');
  await c.waitScreen(s => s.includes('Mine (1)') && !s.includes('Alpha file'), 'absorbed file leaves the browser');
  await row(c, 'Zebra folder');
  await c.input('<CR>');
  const movedName = file.path.split('/').pop()!;
  await c.waitScreen(s => s.includes(movedName), 'moved file in folder');
  await row(c, movedName);
  await c.input('<CR>');
  await c.waitScreen(s => s.includes('# Alpha file'), 'moved file opens');
  await c.input('A edited<Esc>:w<CR>');
  await eventually('editing saves inside folder', async () => (await readFile(join(folder.path, movedName), 'utf8')).includes('edited') || undefined);
  await c.input('q');
  await c.waitScreen(s => s.includes('ARTIFACTS'), 'back in browser');
  await row(c, 'Zebra folder');
  await c.input('p');
  await input(c, 'Promote to project path:', 'docs/notes');
  await c.waitScreen(s => s.includes('promoted: docs/notes'), 'folder promoted');
  assert.match(await readFile(join(root, 'docs/notes', movedName), 'utf8'), /edited/);
  await row(c, 'Zebra folder');
  await c.input('d');
  await c.waitScreen(s => s.includes('Archived (1)') && !s.includes('Zebra folder'), 'archive folded');
  await c.input('A');
  await c.waitScreen(s => s.includes('Zebra folder') && s.includes('archived'), 'explicit archive access');
  assert.match(await readFile(join(folder.path, movedName), 'utf8'), /edited/, 'archive retains human bytes');
});

test('s preserves composer text, deduplicates attachments and restores them after a refused send', { skip }, async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const a = ((await ui.request({ type: 'artifact.create', kind: 'note', title: 'Retry notes', topic: 'general', content: '# Notes' })).value as { artifact: { id: string } }).artifact;
  const c = await startClient(t, bin, root);
  await c.waitScreen(s => s.includes('hub: connected'), 'connected');
  await c.input('Draft text<Esc>:Cland view artifacts general<CR>');
  await c.waitScreen(s => s.includes('Retry notes') && s.includes('Mine'), 'browser');
  await row(c, 'Retry notes');
  await c.input('s');
  await c.waitScreen(s => s.includes('Draft text') && !s.includes('ARTIFACTS'), 'draft preserved');
  await c.input('<Esc>:Cland view artifacts general<CR>');
  await c.waitScreen(s => s.includes('Mine'), 'browser again');
  await row(c, 'Retry notes');
  await c.input('s');
  await c.waitScreen(s => s.includes('Draft text') && !s.includes('ARTIFACTS'), 'composer again');
  await c.lua("vim.api.nvim_buf_set_lines(0,0,-1,false,{'› ' .. string.rep('x',9000)})");
  await c.input('<CR>');
  await c.waitScreen(s => s.includes('not sent:'), 'refused oversized message');
  assert.equal(await c.lua('return #vim.api.nvim_buf_get_lines(0,0,-1,false)[1]'), 9004, 'refused text is restored');
  await c.lua("vim.api.nvim_buf_set_lines(0,0,-1,false,{'› Retry note'})");
  await c.input('<CR>');
  await eventually('retry carries exactly one attachment', async () => {
    const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: Array<{ text: string; artifacts?: Array<{ id: string }> }> };
    const message = history.messages.find(m => m.text === 'Retry note');
    if (!message) return;
    assert.deepEqual(message.artifacts?.map(x => x.id), [a.id]);
    return true;
  });
  await c.input('Next message<CR>');
  await eventually('accepted attachments are consumed', async () => {
    const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: Array<{ text: string; artifacts?: unknown[] }> };
    const message = history.messages.find(m => m.text === 'Next message');
    if (!message) return;
    assert.equal(message.artifacts?.length ?? 0, 0);
    return true;
  });
});


test('hub artifact layer overrides make reports in other topics visible without unfolding a role', { skip }, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[visibility.artifacts]\nagent = "now"\n');
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const topic = ((await ui.request({type:'topic.create',title:'Other topic'})).value as {topic:{id:string}}).topic.id;
  const impl = await spawnSpoke({ discover: true, cwd: root, name: 'impl', role: 'implementer' });
  t.after(() => impl.close());
  await impl.waitForPresence(['impl']);
  await ui.request({type:'topic.send',topic,text:'@impl share your report'});
  const result = await impl.call<{ok:boolean}>('artifact.create', {kind:'note',title:'Raised report',topic,content:'# Report'});
  assert.equal(result.ok, true, JSON.stringify(result));
  const c = await startClient(t, bin, root);
  await c.waitScreen(s => s.includes('hub: connected'), 'connected');
  await c.input('<Esc>:Cland view artifacts general<CR>');
  await c.waitScreen(s => s.includes('Raised report') && s.includes('Implementers (1)'), 'override shown through By role');
});

test('zR unfolds the background subgroup of a role that also contains a kept artifact', { skip }, async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const topic = ((await ui.request({type:'topic.create',title:'Other reports'})).value as {topic:{id:string}}).topic.id;
  const impl = await spawnSpoke({ discover: true, cwd: root, name: 'impl', role: 'implementer' });
  t.after(() => impl.close());
  await impl.waitForPresence(['impl']);
  await ui.request({type:'topic.send',topic,text:'@impl share reports'});
  const kept = await impl.call<{ok:boolean; artifact:{id:string}}>('artifact.create', {kind:'note',title:'Kept report',topic,content:'# Keep'});
  assert.equal(kept.ok, true, JSON.stringify(kept));
  assert.equal((await ui.request({type:'artifact.keep',artifact:kept.artifact.id})).ok, true);
  const background = await impl.call<{ok:boolean}>('artifact.create', {kind:'note',title:'Other background report',topic,content:'# Background'});
  assert.equal(background.ok, true, JSON.stringify(background));
  const c = await startClient(t, bin, root);
  await c.waitScreen(s => s.includes('hub: connected'), 'connected');
  await c.input('<Esc>:Cland view artifacts general<CR>');
  await c.waitScreen(s => s.includes('Implementers (2)') && s.includes('more (1)'), 'mixed role');
  assert.ok(!(await c.screen()).join('\n').includes('Other background report'));
  await c.input('zR');
  await c.waitScreen(s => s.includes('Other background report'), 'all background subgroups opened');
  await c.input('zM');
  await c.waitScreen(s => !s.includes('Other background report'), 'all background closed');
});

test('pending message attachments survive both a refused and an accepted ask answer', { skip }, async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const asked = await coord.call<{ok:boolean}>('ask', {topic:'general',question:'Choose the next path',options:['Start','Wait']});
  assert.equal(asked.ok, true, JSON.stringify(asked));
  const a = ((await ui.request({type:'artifact.create',kind:'note',title:'Pending notes',topic:'general',content:'# Notes'})).value as {artifact:{id:string}}).artifact;
  const c = await startClient(t, bin, root);
  await c.waitScreen(s => s.includes('hub: connected'), 'connected');
  await c.input('<Esc>:Cland view artifacts general<CR>');
  await c.waitScreen(s => s.includes('Pending notes') && s.includes('Mine'), 'browser');
  await row(c, 'Pending notes');
  await c.input('s');
  await c.waitScreen(s => s.includes('attached: ' + a.id), 'attachment staged');
  await c.input('<Esc>');
  await c.lua("vim.api.nvim_set_current_win(require('cland.layout').centre())");
  await row(c, 'Choose the next path');
  await c.input('i');
  await c.waitScreen(s => s.includes('answer to:'), 'free answer armed');
  await c.lua("vim.api.nvim_buf_set_lines(0,0,-1,false,{'› ' .. string.rep('x',9000)})");
  await c.input('<CR>');
  await c.waitScreen(s => s.includes('not answered:'), 'answer refused');
  await c.lua("vim.api.nvim_buf_set_lines(0,0,-1,false,{'› Take the first path'})");
  await c.input('<CR>');
  await eventually('free answer accepted', async () => {
    const history = (await ui.request({type:'topic.history',topic:'general'})).value as {messages:Array<{text:string;artifacts?:unknown[]}>};
    const m = history.messages.find(m => m.text === 'Take the first path');
    if (!m) return;
    assert.equal(m.artifacts?.length ?? 0, 0, 'ask answers do not carry staged message artifacts');
    return true;
  });
  await c.input('Here are the notes<CR>');
  await eventually('attachments remain for the next ordinary message', async () => {
    const history = (await ui.request({type:'topic.history',topic:'general'})).value as {messages:Array<{text:string;artifacts?:Array<{id:string}>}>};
    const m = history.messages.find(m => m.text === 'Here are the notes');
    if (!m) return;
    assert.deepEqual(m.artifacts?.map(a => a.id), [a.id]);
    return true;
  });
});

test('s rejects foreign-topic and archived selections, and stale attachments can be cleared before retrying', { skip }, async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const other = ((await ui.request({type:'topic.create',title:'Elsewhere'})).value as {topic:{id:string}}).topic.id;
  const make = async (title: string, topic: string) => ((await ui.request({type:'artifact.create',kind:'note',title,topic,content:'# Notes'})).value as {artifact:{id:string}}).artifact;
  await make('Foreign notes', other);
  const stale = await make('Stale notes', 'general');
  const archived = await make('Archived notes', 'general');
  assert.equal((await ui.request({type:'artifact.archive',artifact:archived.id})).ok, true);
  const c = await startClient(t, bin, root);
  await c.waitScreen(s => s.includes('hub: connected'), 'connected');
  await c.input('<Esc>:Cland view artifacts general<CR>');
  await c.waitScreen(s => s.includes('Foreign notes') && s.includes('Mine'), 'global mine');
  await row(c, 'Foreign notes');
  await c.input('s');
  await c.waitScreen(s => s.includes('open that topic to attach'), 'foreign topic selection rejected');
  assert.equal(await c.lua("return require('cland.state').S.ui.view.kind"), 'artifacts');
  await c.input('A');
  await c.waitScreen(s => s.includes('Archived notes'), 'archive opened');
  await row(c, 'Archived notes');
  await c.input('s');
  await c.waitScreen(s => s.includes('keep it to attach'), 'archived selection rejected');
  await row(c, 'Stale notes');
  await c.input('s');
  await c.waitScreen(s => s.includes('attached: ' + stale.id), 'valid artifact staged');
  assert.equal((await ui.request({type:'artifact.archive',artifact:stale.id})).ok, true);
  await c.input('Send these notes<CR>');
  await c.waitScreen(s => s.includes('not sent:'), 'later invalidation refuses send');
  await c.input('<Esc>:Cland attachments clear<CR>');
  await c.waitScreen(s => s.includes('attachments cleared'), 'clear attachments action');
  await c.input('A<CR>');
  await eventually('draft retries without stale attachment', async () => {
    const history = (await ui.request({type:'topic.history',topic:'general'})).value as {messages:Array<{text:string;artifacts?:unknown[]}>};
    const m = history.messages.find(m => m.text === 'Send these notes');
    if (!m) return;
    assert.equal(m.artifacts?.length ?? 0, 0);
    return true;
  });
});


test('a refused ordinary send restores artifacts when an ask was armed while its reply was pending', { skip }, async t => {
  const root = await tempProject(t);
  const path = join(root, 'pending.md');
  await writeFile(path, '# Pending');
  const controlPath = join(root, 'stub.sock');
  const control = (cmd: Record<string, unknown>) => new Promise<Record<string, unknown>>((resolve, reject) => {
    const socket = createConnection(controlPath);
    let response = '';
    socket.setEncoding('utf8');
    socket.on('error', reject);
    socket.on('data', chunk => {
      response += chunk;
      if (response.includes('\n')) { socket.end(); resolve(JSON.parse(response.slice(0, response.indexOf('\n')))); }
    });
    socket.write(JSON.stringify(cmd) + '\n');
  });
  const question = 'Decide while sending';
  const c = await startClient(t, bin, root, {
    CLAND_HUB_TRANSPORT: 'stdio',
    CLAND_COMMAND: JSON.stringify([process.execPath, fileURLToPath(new URL('./stub-hub.ts', import.meta.url))]),
    CLAND_STUB_CONTROL: controlPath,
    CLAND_STUB_SCENARIO_JSON: JSON.stringify({send:'hold', artifacts:[{id:'A-1',title:'Pending artifact',kind:'note',path,creator:'human',creatorKind:'human',topic:'general',status:'shared'}],
      messages:{general:[{id:'ask-pending',from:'coord',fromKind:'agent',fromRole:'coordinator',to:['human'],text:question,ts:new Date().toISOString(),topic:'general',ask:{question,options:['Start','Wait'],free:true,state:'open'}}]},
      inbox:{asks:[{id:'ask-pending',question,topic:{id:'general',title:'General'},options:['Start','Wait'],from:'coord',ts:new Date().toISOString()}]}}),
  });
  await c.waitScreen(s => s.includes('hub: connected'), 'stub connected');
  await c.input('<Esc>:Cland view artifacts general<CR>');
  await c.waitScreen(s => s.includes('Pending artifact') && s.includes('Mine'), 'browser');
  await row(c, 'Pending artifact');
  await c.input('s');
  await c.waitScreen(s => s.includes('attached: A-1'), 'artifact staged');
  await c.input('Notes to send<CR>');
  await eventually('ordinary send held', async () => {
    const requests = (await control({requests:true})).requests as Array<Record<string,unknown>>;
    return requests.find(f => f.type === 'topic.send' && f.text === 'Notes to send');
  });
  await c.input('<Esc>');
  await c.lua("vim.api.nvim_set_current_win(require('cland.layout').centre())");
  await row(c, question);
  await c.input('i');
  await c.waitScreen(s => s.includes('answer to:'), 'ask armed during send');
  await control({release:{error:'send refused after ask was armed'},set:{send:'accept'}});
  await c.waitScreen(s => s.includes('not sent: send refused') && s.includes('Notes to send'), 'original text restored');
  await c.input('<CR>');
  await c.waitScreen(s => s.includes('answered in your words') && s.includes('to: Coordinator'), 'restored text sent as answer');
  await c.input('Message with preserved artifact<CR>');
  await eventually('next ordinary frame retains attachment', async () => {
    const requests = (await control({requests:true})).requests as Array<Record<string,unknown>>;
    const frame = requests.find(f => f.type === 'topic.send' && f.text === 'Message with preserved artifact');
    if (!frame) return;
    assert.deepEqual(frame.artifacts, ['A-1']);
    return true;
  });
});

test('x asks before deleting; cancel keeps bytes and confirm updates the browser and topic chips', { skip }, async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const a = ((await ui.request({type:'artifact.create',kind:'note',title:'Disposable notes',topic:'general',content:'# Keep until confirmed'})).value as {artifact:{id:string;path:string}}).artifact;
  await ui.request({type:'topic.send',topic:'general',text:'Notes attached',artifacts:[a.id]});
  const c = await startClient(t, bin, root);
  await c.waitScreen(s => s.includes('hub: connected'), 'connected');
  await c.input('<Esc>:Cland view artifacts general<CR>');
  await c.waitScreen(s => s.includes('Disposable notes') && s.includes('Mine'), 'browser');
  await row(c, 'Disposable notes');
  // inputlist blocks synchronous RPC reads until answered; queue the choice with x.
  await c.lua("local select = vim.ui.select; vim.ui.select = function(items, opts, done) vim.g.delete_prompt = opts.prompt; select(items, opts, done) end");
  await c.input('x1<CR>');
  await c.waitScreen(s => s.includes('Mine (1)'), 'cancelled deletion');
  assert.match(await c.lua<string>('return vim.g.delete_prompt'), new RegExp('Delete ' + a.id));
  assert.equal(await readFile(a.path, 'utf8'), '# Keep until confirmed');
  await c.input('x2<CR>');
  await c.waitScreen(s => s.includes('Mine (0)'), 'deleted artifact leaves active browser');
  await assert.rejects(readFile(a.path), {code:'ENOENT'});
  await c.input('A');
  await c.waitScreen(s => s.includes('Disposable notes') && s.includes('file deleted'), 'deleted tombstone in archive');
  await c.input(':Cland view thread general<CR>');
  await c.waitScreen(s => s.includes('Disposable notes') && s.includes('file deleted'), 'topic chip marked deleted');
  const lines = await c.lua<string[]>("return vim.api.nvim_buf_get_lines(require('cland.views').topic('general').thread.buf,0,-1,false)");
  const chips = lines.filter(l => l.includes('▣ ' + a.id));
  assert.equal(chips.length, 2);
  assert.ok(chips.every(l => l.includes('file deleted')), 'creation and attachment chips reflect deletion');
});

test('deletion updates an already-open attachment-only chip when creation is outside retained history', { skip }, async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const a = ((await ui.request({type:'artifact.create',kind:'note',title:'Older notes',topic:'general',content:'old'})).value as {artifact:{id:string}}).artifact;
  for (let i = 0; i < 200; i++) await ui.request({type:'topic.send',topic:'general',text:'History padding ' + i});
  await ui.request({type:'topic.send',topic:'general',text:'Latest attachment',artifacts:[a.id]});
  const c = await startClient(t, bin, root);
  await c.waitScreen(s => s.includes('hub: connected') && s.includes('Older notes'), 'attachment-only history');
  const chips = await c.lua<number>("local count = 0; for _, l in ipairs(vim.api.nvim_buf_get_lines(require('cland.views').topic('general').thread.buf,0,-1,false)) do if l:find('▣ ' .. ...,1,true) then count = count + 1 end end; return count", a.id);
  assert.equal(chips, 1, 'the creation chip is not loaded');
  assert.equal((await ui.request({type:'artifact.delete',artifact:a.id})).ok, true);
  await c.waitScreen(s => s.includes('Older notes · file deleted'), 'live attachment-only deletion mark');
});
