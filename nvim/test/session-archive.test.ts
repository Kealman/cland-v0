// Archive keys and projections through the headless client and the stub protocol.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tempProject } from '../../hub/test/harness.ts';
import { nvimOrSkip, startClient } from './harness.ts';

const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';
const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));

test('d archives a stopped Aide, A fetches its archive, r restores it, and live/unlaunched rows refuse d', { skip }, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.git'), { recursive: true });
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/ui.json'), JSON.stringify({ visibility: { sessions: { muted: 'mute' } } }));
  const old = { name: 'old-aide', label: 'old-aide [Aide]', role: 'aide', harness: 'claude-code', sessionId: 'old-id', pid: null, cwd: root, status: 'stopped', state: 'unknown', startedAt: '2026-10-12T00:00:00Z' };
  const muted = { ...old, name: 'muted', label: 'muted [Implementer]', sessionId: 'muted-id', role: 'implementer', layer: 'archive' };
  const older = { ...old, name: 'older', label: 'older [Aide]', sessionId: 'older-id', archived: true, archivedAt: '2026-10-11T00:00:00Z' };
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]), CLAND_STUB_SCENARIO_JSON: JSON.stringify({ inbox: {}, processes: [old, muted, older], presence: [{ name: 'manual', role: 'implementer', state: 'idle', sessionId: 'manual-id' }] }) });
  await c.waitScreen(s => s.includes('hub: connected'), 'connected');
  await c.input('<Esc>');
  await c.lua("vim.cmd('stopinsert'); vim.api.nvim_set_current_win(require('cland.layout').win.right); vim.api.nvim_win_set_width(0, 90)");
  await c.input('gg/old-aide<CR>d');
  await c.waitScreen(s => s.includes('old-aide archived · A shows the archive'), 'archive outcome');
  assert.equal(await c.lua("return require('cland.state').counts().total"), 2, 'archived rows leave every count');
  assert.equal(await c.lua("for _, s in ipairs(require('cland.state').sessions()) do if s.name == 'old-aide' then return true end end return false"), false);
  assert.equal(await c.lua("for _, s in ipairs(require('cland.picker').BUILD.sessions()) do if s.value == 'old-aide' then return true end end return false"), false, 'palette sessions exclude archive');
  await c.input('A');
  await c.waitScreen(s => s.includes('ARCHIVE · 3') && s.includes('older [Aide]') && s.includes('old-aide [Aide]') && s.includes('muted'), 'fetched and muted archive rows');
  const archive = await c.lua<string[]>("local b=require('cland.panels').bufs.sessions; return vim.api.nvim_buf_get_lines(b,0,-1,false)");
  const heading = archive.findIndex(l => l.includes('ARCHIVE'));
  assert.ok(archive.findIndex(l => l.includes('old-aide [Aide]')) > heading);
  assert.ok(archive.findIndex(l => l.includes('old-aide [Aide]')) < archive.findIndex(l => l.includes('older [Aide]')), 'archive is newest first');
  await c.input('gg/old-aide.*Aide<CR>r');
  await c.waitScreen(s => s.includes('old-aide resumed'), 'archive row resumed');
  assert.equal(await c.lua("return require('cland.state').session('old-aide').live"), true);
  assert.equal(await c.lua("return require('cland.state').counts().total"), 3);
  await c.input('gg/old-aide.*Aide<CR>d');
  await c.waitScreen(s => s.includes('stop it first with x'), 'live refusal');
  await c.input('gg/manual<CR>d');
  await c.waitScreen(s => s.includes('there is no record to archive'), 'unlaunched refusal');
  await c.input('<Space>?');
  await c.waitScreen(s => s.includes('d archive') && s.includes('A show/hide archive'), 'archive actions in Keys');
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"), []);
});
