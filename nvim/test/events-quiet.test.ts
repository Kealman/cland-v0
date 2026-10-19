// T2: screen permutations consume committed protocol frames through stub-client.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nvimOrSkip, startClient } from './stub-client.ts';
import { waitInitialSnapshots } from './readiness.ts';
import type { EventKind, EventRow } from '../../hub/src/protocol.ts';
import { tempProject } from './fixture.ts';

const nvim = await nvimOrSkip();

const skip = 'skip' in nvim ? nvim.skip : false;

const bin = 'bin' in nvim ? nvim.bin : '';

const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));

const kinds: EventKind[] = ['session', 'task', 'verdict', 'suite', 'release', 'artifact', 'usage', 'topic'];

test('one row per verdict counts once in the live inbox, warnings view and saved-filter cold start', { skip }, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.git'), { recursive: true });
  await mkdir(join(root, '.cland'), { recursive: true });
  const path = join(root, '.cland/ui.json');
  await writeFile(path, JSON.stringify({ version: 2, events: { filter: {}, muted: [], last_look: new Date(Date.now() - 86400000).toISOString() } }));
  // Protocol rows captured by the real-hub regression: the richer notification
  // is the canonical verdict, with neither a duplicate task row nor a ×2 count.
  const rows: EventRow[] = ['clear', 'not clear'].map(result => ({
    id: `verdict-${result}`, ts: new Date(Date.now() - 1000).toISOString(), kind: 'verdict',
    subject: { kind: 'item', id: 'T-1' }, item: 'T-1', session: 'rev',
    text: `T-1 review ${result} · rev [reviewer] · run one-row-${result.replace(' ', '-')}`,
    glyph: result === 'not clear' ? '⚠' : '✓', ...(result === 'not clear' ? { warning: true } : {}),
  }));
  const controlPath = join(root, 'control.sock');
  const control = (command: Record<string, unknown>) => new Promise<void>((resolve, reject) => {
    const socket = createConnection(controlPath);
    socket.setEncoding('utf8'); socket.on('error', reject);
    socket.on('data', () => { socket.end(); resolve(); });
    socket.write(JSON.stringify(command) + '\n');
  });
  const scenario = { inbox: {}, events: [] as EventRow[] };
  const env = { CLAND_STUB_CONTROL: controlPath, CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]), CLAND_STUB_SCENARIO_JSON: JSON.stringify(scenario) };
  const c = await startClient(t, bin, root, env);
  await c.waitScreen(s => s.includes('hub: connected'), 'connected');
  await waitInitialSnapshots(c);
  await c.input('<Esc> N');
  await c.waitScreen(s => s.includes('△ 0 new events since your last look · ⚠ 0'), 'initial empty events line');
  await control({ set: { events: [rows[1]] }, emit: { type: 'event', row: rows[1] } });
  await c.waitScreen(s => s.includes('△ 1 new events since your last look · ⚠ 1'), 'one not-clear verdict counted once');
  await control({ set: { events: rows }, emit: { type: 'event', row: rows[0] } });
  await c.waitScreen(s => s.includes('△ 2 new events since your last look · ⚠ 1'), 'clear verdict adds one ordinary event');
  await c.input('Ge3w');
  await c.waitScreen(s => s.includes('kind: verdict · ⚠ warnings only') && s.includes('review not clear'), 'one warning verdict');
  const visible = () => c.lua<EventRow[]>("return require('cland.events').rows");
  assert.deepEqual((await visible()).map(r => r.id), [rows[1]!.id]);
  assert.doesNotMatch((await c.lua<string[]>("return vim.api.nvim_buf_get_lines(0,0,-1,false)")).join('\n'), /verdict posted|×2/);
  await c.input('F3');
  await c.waitScreen(s => s.includes('review clear') && s.includes('review not clear'), 'both verdicts present once');
  assert.equal((await visible()).length, 2);
  await c.input('w');
  await c.waitScreen(s => s.includes('warnings only') && !s.includes('review clear ·'), 'saved warning filter');
  await c.lua("require('cland.ui').changed(); return require('cland.ui').flush()");
  await c.input(':qa!<CR>');
  const cold = await startClient(t, bin, root, { ...env, CLAND_STUB_SCENARIO_JSON: JSON.stringify({ ...scenario, events: rows }) });
  await cold.waitScreen(s => s.includes('hub: connected'), 'cold connected');
  await waitInitialSnapshots(cold);
  await cold.input('<Esc> E');
  await cold.waitScreen(s => s.includes('kind: verdict · ⚠ warnings only') && s.includes('review not clear'), 'saved filter replays one warning row');
  assert.deepEqual((await cold.lua<EventRow[]>("return require('cland.events').rows")).map(r => r.id), [rows[1]!.id]);
});

test('events keys, warning/dim presentation, independent mutes, last look and cold persistence', { skip }, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.git'), { recursive: true });
  await mkdir(join(root, '.cland'), { recursive: true });
  const lastLook = new Date(Date.now() - 86400000).toISOString();
  const path = join(root, '.cland/ui.json');
  await writeFile(path, JSON.stringify({ version: 2, plan_seen: {}, panels: { left: false, right: 'sessions', dock: false }, sizes: {}, items_filter: 'board', events: { filter: {}, muted: [], last_look: lastLook }, visibility: { topics: { general: 'pin' } }, other_owner: { keep: 'yes' } }));
  const ts = new Date(Date.now() - 60000).toISOString();
  const rows: EventRow[] = Array.from({ length: 205 }, (_, i) => {
    const kind = kinds[i % 8]!;
    const subject = kind === 'session' || kind === 'usage' ? { kind: 'session' as const, id: 'impl' } : kind === 'artifact' ? { kind: 'artifact' as const, id: 'A-1' } : kind === 'topic' ? { kind: 'topic' as const, id: 'general' } : { kind: 'item' as const, id: 'T-1' };
    return { id: `row-${i}`, ts, glyph: '●', kind, subject, text: `${kind} evidence ${i}`, ...(kind === 'verdict' ? { warning: true, glyph: '⚠' } : {}), ...(kind === 'task' ? { bookkeeping: true, count: 5 } : {}), [subject.kind]: subject.id };
  });
  const note = join(root, 'note.md'); await writeFile(note, 'Note');
  const scenario = { inbox: {}, events: rows, items: [{ id: 'T-1', kind: 'task', title: 'Filter item', state: 'open', status: 'backlog', parent: null, blocked_by: [], labels: [] }], processes: [{ name: 'impl', sessionId: 'impl-id', status: 'stopped', state: 'unknown', harness: 'codex', cwd: root, pid: null }], artifacts: [{ id: 'A-1', kind: 'note', title: 'Filter artifact', path: note, topic: 'general', status: 'shared', creator: 'human', creatorKind: 'human', createdAt: ts }] };
  const controlPath = join(root, 'control.sock');
  const control = (command: Record<string, unknown>) => new Promise<void>((resolve, reject) => {
    const socket = createConnection(controlPath); socket.setEncoding('utf8'); socket.on('error', reject); socket.on('data', () => { socket.end(); resolve(); }); socket.write(JSON.stringify(command) + '\n');
  });
  const env = { CLAND_STUB_CONTROL: controlPath, CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]), CLAND_STUB_SCENARIO_JSON: JSON.stringify(scenario) };
  const c = await startClient(t, bin, root, env, { screenPollMs: 5 });
  await c.waitScreen(s => s.includes('hub: connected'), 'connected');
  await waitInitialSnapshots(c);
  await c.input('<Esc> N');
  await c.waitScreen(s => s.includes('△ 200+ new events since your last look · ⚠ 25'), 'capped inbox count in the empty state');
  await c.input('Ge');
  await c.waitScreen(s => s.includes('events · newest first') && s.includes('task evidence 1 · ×5'), 'events and merged count');
  const allLines = await c.lua<string[]>("return vim.api.nvim_buf_get_lines(0,0,-1,false)");
  assert.ok(allLines.some(l => l.includes('△ your last look') && l.includes('200 new above')));
  const styles = await c.lua<string[]>("local out={}; local lines=vim.api.nvim_buf_get_lines(0,0,-1,false); for _,m in ipairs(vim.api.nvim_buf_get_extmarks(0,vim.api.nvim_create_namespace('cland.panels'),0,-1,{details=true})) do local line=lines[m[2]+1]; if line:find('task evidence 1',1,true) or line:find('verdict evidence 2',1,true) then out[#out+1]=m[4].hl_group end end; return out")
  assert.ok(styles.includes('ClandFaint'));
  assert.ok(styles.includes('ClandAmber'));
  await c.input('  ');
  await c.waitScreen(s => s.includes('△ 0 new events since your last look · ⚠ 0'), 'last look clears inbox count');
  await c.input('Ge');
  for (let i = 0; i < kinds.length; i++) {
    await c.input(String(i + 1));
    await c.waitScreen(s => s.includes(`kind: ${kinds[i]} ·`) && s.includes(`${kinds[i]} evidence`), `kind ${kinds[i]}`);
    assert.ok((await c.lua<EventRow[]>("return require('cland.events').rows")).every(r => r.kind === kinds[i]));
  }
  await c.input('0w');
  await c.waitScreen(s => s.includes('warnings only') && s.includes('verdict evidence') && !s.includes('task evidence'), 'warnings only');
  await c.input('F');
  await c.waitScreen(s => s.includes('kind: all · all levels · subject: any') && s.includes('session evidence'), 'clear filter');
  for (const [prefix, id, kind, text] of [['#', 'T-1', 'item', 'task'], ['@', 'impl', 'session', 'session'], ['/', 'general', 'topic', 'topic'], ['~', 'A-1', 'artifact', 'artifact']]) {
    await c.input('s');
    await c.waitScreen(s => s.includes('palette ›'), 'subject palette');
    await c.input(prefix! + id!);
    await c.waitScreen(s => s.includes(id!), `prefix ${prefix}`);
    await c.input('<CR>');
    await c.waitScreen(s => s.includes(`subject: ${kind} ${id}`) && s.includes(text! + ' evidence'), `subject ${kind}`);
  }
  await c.lua("for i,l in ipairs(vim.api.nvim_buf_get_lines(0,0,-1,false)) do if l:find('artifact evidence',1,true) then vim.api.nvim_win_set_cursor(0,{i,0}); break end end");
  await c.input('gM');
  await c.waitScreen(s => s.includes('1 subjects hidden') && !s.includes('artifact evidence'), 'mute subject');
  await c.lua("for i,l in ipairs(vim.api.nvim_buf_get_lines(0,0,-1,false)) do if l:find('muted artifact A-1',1,true) then vim.api.nvim_win_set_cursor(0,{i,0}); break end end");
  await c.input('gM');
  await c.waitScreen(s => s.includes('artifact evidence') && !s.includes('subjects hidden'), 'restore subject');
  assert.equal(await c.lua("return require('cland.state').S.needs_you"), 0);
  await c.input('F3w');
  await c.waitScreen(s => s.includes('kind: verdict · ⚠ warnings only'), 'persistent filter');
  await control({ emit: { type: 'event', row: { ...rows[3], id: 'live-warning', ts: new Date().toISOString(), warning: true, glyph: '⚠', text: 'live suite warning' } } });
  await c.waitScreen(s => !s.includes('live suite warning'), 'live row respects kind filter');
  await c.input('  ');
  await c.waitScreen(s => s.includes('△ 1 new events since your last look · ⚠ 1'), 'new live warning reaches inbox summary even while filtered');
  await c.input('Ge');
  await c.waitScreen(s => s.includes('kind: verdict · ⚠ warnings only'), 'filter retained after inbox visit');
  await c.lua("require('cland.ui').changed(); return require('cland.ui').flush()");
  const saved = JSON.parse(await readFile(path, 'utf8'));
  assert.deepEqual(saved.visibility, { topics: { general: 'pin' } });
  assert.deepEqual(saved.other_owner, { keep: 'yes' });
  assert.ok(saved.events.last_look > lastLook);
  assert.deepEqual(saved.events.filter, { kinds: ['verdict'], warnings: true });
  assert.deepEqual(saved.events.muted, []);
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"), []);
  await c.input(':qa!<CR>');
  const cold = await startClient(t, bin, root, env, { screenPollMs: 5 });
  await cold.waitScreen(s => s.includes('hub: connected'), 'cold connected');
  await waitInitialSnapshots(cold);
  await cold.input('<Esc> E');
  await cold.waitScreen(s => s.includes('kind: verdict · ⚠ warnings only') && s.includes('verdict evidence'), 'filter survives a cold workbench start');
});

test('hidden and batched replacement chains retain the selected group and older pages', { skip }, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.git'), { recursive: true });
  const ts = new Date().toISOString();
  const rows: EventRow[] = Array.from({ length: 401 }, (_, i) => ({ id: `row-${i}`, ts, kind: 'task', glyph: '⚑', subject: { kind: 'item', id: 'T-1' }, item: 'T-1', text: i ? `older event ${i}` : 'selected group', count: 1 }));
  const controlPath = join(root, 'control.sock');
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]), CLAND_STUB_CONTROL: controlPath, CLAND_STUB_SCENARIO_JSON: JSON.stringify({ inbox: {}, events: rows, items: [{ id: 'T-1', title: 'Replacement subject', kind: 'task', state: 'open', status: 'backlog', parent: null, blocked_by: [], labels: [], body: 'Replacement detail' }] }) });
  const control = (command: Record<string, unknown>) => new Promise<void>((resolve, reject) => {
    const socket = createConnection(controlPath); socket.setEncoding('utf8'); socket.on('error', reject); socket.on('data', () => { socket.end(); resolve(); }); socket.write(JSON.stringify(command) + '\n');
  });
  await c.waitScreen(s => s.includes('hub: connected'), 'connected');
  await waitInitialSnapshots(c);
  await c.input('<Esc> E');
  await c.waitScreen(s => s.includes('selected group'), 'group loaded');
  await c.input('GA');
  await c.waitScreen(s => s.includes('older event 200') || s.includes('the newest 400 rows'), 'older page appended');
  await c.lua("for i,l in ipairs(vim.api.nvim_buf_get_lines(0,0,-1,false)) do if l:find('selected group',1,true) then vim.api.nvim_win_set_cursor(0,{i,0}); break end end");
  await c.input('<CR>');
  await c.waitScreen(s => s.includes('Replacement detail'), 'subject detail');
  await control({ emits: [
    { type: 'event', row: { ...rows[0], id: 'replacement-2', replaces: 'row-0', count: 2 } },
    { type: 'event', row: { ...rows[0], id: 'replacement-3', replaces: 'replacement-2', count: 3 } },
    { type: 'role.filled', session: 'replacement-barrier', role: 'coordinator', ts },
  ] });
  await c.waitScreen(s => s.includes('replacement-barrier'), 'both hidden replacements processed');
  await c.input('  ');
  await c.waitScreen(s => s.includes('selected group · ×3'), 'one updated group');
  assert.match(await c.lua<string>('return vim.api.nvim_get_current_line()'), /selected group · ×3/, 'Back retains the original group selection');
  const loaded = await c.lua<EventRow[]>("return require('cland.events').rows");
  assert.equal(loaded.filter(r => r.text === 'selected group').length, 1);
  assert.equal(loaded.length, 400);
  await control({ emits: [
    { type: 'event', row: { ...rows[0], id: 'replacement-4', replaces: 'replacement-3', count: 4 } },
    { type: 'event', row: { ...rows[0], id: 'replacement-5', replaces: 'replacement-4', count: 5 } },
  ] });
  await c.waitScreen(s => s.includes('selected group · ×5'), 'batched visible replacements');
  assert.match(await c.lua<string>('return vim.api.nvim_get_current_line()'), /selected group · ×5/);
  await c.input('G');
  await c.waitScreen(s => s.includes('older event 399'), 'older pages retained');
});
