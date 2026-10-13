import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tempProject } from '../../hub/test/harness.ts';
import { nvimOrSkip, startClient } from './harness.ts';
import { waitInitialSnapshots } from './readiness.ts';
import type { EventRow } from '../../hub/src/protocol.ts';
const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';
const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));
const today = new Date().toISOString();
const yesterday = new Date(Date.now() - 86400000).toISOString();
const rows: EventRow[] = Array.from({ length: 401 }, (_, i) => ({ id: `row-${i}`, ts: i < 200 ? today : yesterday, kind: 'task', glyph: '⚑', subject: { kind: 'item', id: 'T-1' }, item: 'T-1', topic: 'general', session: 'impl', text: `claimed event ${i}` }));

test('Events view opens through the registry, groups days, pages, folds and follows live rows without losing selection', { skip }, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.git'), { recursive: true });
  const path = join(root, 'stub.sock');
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]), CLAND_STUB_SCENARIO_JSON: JSON.stringify({ inbox: {}, events: rows, items: [{ id: 'T-1', title: 'Event subject', kind: 'task', state: 'open', status: 'in progress', labels: [], parent: null, blocked_by: [], body: 'Subject detail' }] }), CLAND_STUB_CONTROL: path });
  const control = (command: Record<string, unknown>) => new Promise<unknown>((resolve, reject) => {
    const socket = createConnection(path); let text = '';
    socket.setEncoding('utf8'); socket.on('error', reject);
    socket.on('data', data => { text += data; if (text.includes('\n')) { socket.end(); resolve(JSON.parse(text.slice(0, text.indexOf('\n')))); } });
    socket.write(`${JSON.stringify(command)}\n`);
  });
  await c.waitScreen(s => s.includes('hub: connected'), 'connected');
  await waitInitialSnapshots(c);
  await c.input('<Esc> E');
  await c.waitScreen(s => s.includes('events · newest first') && s.includes('today') && s.includes('claimed event 0'), 'events first page');
  await c.input('G');
  await c.waitScreen(s => s.includes('claimed event 199') && s.includes('the newest 200 rows'), 'initial 200 rows');
  await c.input('A');
  await c.waitScreen(s => s.includes('claimed event 200') || s.includes('── ' + new Date(yesterday).toLocaleDateString('en-GB', { weekday: 'short' })) || s.includes('the newest 400 rows'), 'older day appended');
  await c.input('G');
  await c.waitScreen(s => s.includes('claimed event 399'), 'older 200 rows');
  await c.lua("for i,l in ipairs(vim.api.nvim_buf_get_lines(0,0,-1,false)) do if l:find('claimed event 0',1,true) then vim.api.nvim_win_set_cursor(0,{i,0}); break end end");
  const selected = await c.lua<string>('return vim.api.nvim_get_current_line()');
  await control({ emit: { type: 'event', row: { ...rows[0], id: 'live', text: 'live event' } } });
  await c.waitScreen(s => s.includes('live event'), 'live row at top');
  assert.equal(await c.lua('return vim.api.nvim_get_current_line()'), selected);
  await c.input('za');
  await c.waitScreen(s => !s.includes('live event') && s.includes('200'), 'folded today');
  await c.input('za');
  await c.waitScreen(s => s.includes('live event'), 'unfolded today');
  await c.lua("local selected=...; for i,l in ipairs(vim.api.nvim_buf_get_lines(0,0,-1,false)) do if l==selected then vim.api.nvim_win_set_cursor(0,{i,0}); break end end", selected);
  await c.input('<CR>');
  await c.waitScreen(s => s.includes('Subject detail') && !s.includes('events · newest first'), 'event subject opened');
  await control({ emits: [
    { type: 'event', row: { ...rows[0], id: 'away', text: 'event while reading the subject' } },
    { type: 'role.filled', session: 'push-barrier', role: 'coordinator', ts: today },
  ] });
  // This later frame in the same pipe confirms the hidden-view push was processed before Back.
  await c.waitScreen(s => s.includes('push-barrier'), 'push delivery barrier');
  await c.input('  ');
  await c.waitScreen(s => s.includes('events · newest first') && s.includes('event while reading the subject'), 'live event retained on subject return');
  assert.equal(await c.lua('return vim.api.nvim_get_current_line()'), selected);
  await c.input('G');
  await c.waitScreen(s => s.includes('claimed event 399'), 'older pages retained on subject return');
  await c.input('gg');
  await c.input('  ');
  await c.waitScreen(s => s.includes('Subject detail') && !s.includes('events · newest first'), 'previous view');
  await c.input(' N');
  await c.waitScreen(s => s.includes('new events since your last look'), 'inbox events line');
  await c.input('Ge');
  await c.waitScreen(s => s.includes('events · newest first'), 'inbox e');
  await c.input('  ');
  await c.lua("local b=vim.api.nvim_get_current_buf(); for i,l in ipairs(vim.api.nvim_buf_get_lines(b,0,-1,false)) do if l:find('new events since your last look',1,true) then vim.api.nvim_win_set_cursor(0,{i,0}); break end end");
  await c.input('<CR>');
  await c.waitScreen(s => s.includes('events · newest first'), 'inbox Enter');
  await c.lua("require('cland.actions').run('global:<leader>E')");
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"), []);
});

test('Enter opens each event subject, gi/gt/gs use the row references and the palette opens Events', { skip }, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.git'), { recursive: true });
  const artifactPath = join(root, 'event-note.md');
  await writeFile(artifactPath, '# Event artifact content\n');
  const subjects: EventRow[] = [
    { ...rows[0]!, id: 'item', text: 'item event' },
    { id: 'session', ts: today, glyph: '▶', kind: 'session', subject: { kind: 'session', id: 'impl' }, session: 'impl', text: 'session event' },
    { id: 'topic', ts: today, glyph: '●', kind: 'topic', subject: { kind: 'topic', id: 'general' }, topic: 'general', text: 'topic event' },
    { id: 'artifact', ts: today, glyph: 'A', kind: 'artifact', subject: { kind: 'artifact', id: 'A-1' }, artifact: 'A-1', text: 'artifact event' },
  ];
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]), CLAND_STUB_SCENARIO_JSON: JSON.stringify({ inbox: {}, events: subjects, items: [{ id: 'T-1', title: 'Event target', kind: 'task', state: 'open', status: 'in progress', labels: [], parent: null, blocked_by: [], body: 'Event item body', claim: { session: 'impl' } }], processes: [{ name: 'impl', sessionId: 'impl-id', status: 'stopped', state: 'unknown', harness: 'codex', cwd: root, pid: null }], artifacts: [{ id: 'A-1', kind: 'note', title: 'Event note', path: artifactPath, topic: 'general', status: 'shared', creator: 'human', creatorKind: 'human', createdAt: today }] }) });
  await c.waitScreen(s => s.includes('hub: connected'), 'connected');
  await waitInitialSnapshots(c);
  const select = async (text: string) => {
    await c.input('<Esc> E');
    await c.waitScreen(s => s.includes('events · newest first') && s.includes(text), 'events loaded');
    await c.lua("local text=...; for i,l in ipairs(vim.api.nvim_buf_get_lines(0,0,-1,false)) do if l:find(text,1,true) then vim.api.nvim_win_set_cursor(0,{i,0}); break end end", text);
  };
  await select('item event');
  await c.input('<CR>');
  await c.waitScreen(s => s.includes('Event target') && s.includes('Event item body'), 'Enter item');
  await select('session event');
  await c.input('<CR>');
  await c.waitScreen(s => s.includes('stopped') && !s.includes('events · newest first'), 'Enter session');
  await select('topic event');
  await c.input('<CR>');
  await c.waitScreen(s => s.includes('No messages in General yet'), 'Enter topic');
  await select('artifact event');
  await c.input('<CR>');
  await c.waitScreen(s => s.includes('# Event artifact content'), 'Enter artifact');
  for (const [key, text] of [['gi', 'Event item body'], ['gt', 'No messages in General yet'], ['gs', 'stopped']]) {
    await select('item event');
    await c.input(key!);
    await c.waitScreen(s => s.includes(text!) && !s.includes('events · newest first'), key!);
  }
  await select('artifact event');
  await c.input('gi');
  await c.waitScreen(s => s.includes('event has no item'), 'missing row item');
  await c.input('gt');
  await c.waitScreen(s => s.includes('event has no topic'), 'missing row topic');
  await c.input('gs');
  await c.waitScreen(s => s.includes('event has no session'), 'missing row session');
  await c.input('  ');
  await c.input('<Esc> p');
  await c.waitScreen(s => s.includes('palette ›'), 'palette');
  await c.input('Events view');
  await c.waitScreen(s => s.includes('Events view') && s.includes('␣E'), 'Events action in palette');
  await c.input('<CR>');
  await c.waitScreen(s => s.includes('events · newest first') && !s.includes('palette ›'), 'palette opens events');
});
