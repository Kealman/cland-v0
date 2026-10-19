// T2: recorded canonical item frames; store migration rules in nvim-item-prefixes-rules.test.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tempProject } from './fixture.ts';
import { nvimOrSkip, startClient } from './stub-client.ts';
import { waitInitialSnapshots } from './readiness.ts';

const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';
const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));

test('recorded canonical epics resolve legacy item tokens through gI', { skip }, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.git'), { recursive: true });
  const text = 'References T-107 E-107 R-107 Q-107 M-107 S-107 C-107 A-12';
  const c = await startClient(t, bin, root, {
    CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]),
    CLAND_STUB_SCENARIO_JSON: JSON.stringify({ inbox: {}, items: [
      { id: 'E-107', kind: 'epic', title: 'Canonical epic', state: 'open', file: 'T-107-legacy.md', labels: [], blocked_by: [], follows: ['E-108'], parent: null, claim: null, holds: [] },
    ], messages: { general: [{ id: 'm1', from: 'coord', fromKind: 'agent', fromRole: 'coordinator', via: 'spoke', to: ['human'], text, ts: '2026-10-13T00:00:00Z', topic: 'general' }] } }),
  });
  await c.waitScreen(s => s.includes('References T-107') && s.includes('A-12'), 'legacy references in the thread');
  await waitInitialSnapshots(c);
  await c.input('<Esc><C-w>kgg/A-12<CR>');
  assert.equal(await c.lua("return require('cland.motions').token()"), null);
  await c.input('gI');
  await c.waitScreen(s => s.includes('bound to no item'), 'artifact reference has no item target');
  await c.input('gg/T-107<CR>gI');
  await c.waitScreen(s => s.includes('E-107 · item') && s.includes('Canonical epic'), 'canonical epic item view');
  assert.equal(await c.lua("return require('cland.state').S.ui.view.id"), 'E-107');
  assert.match(await c.lua<string>("return table.concat(vim.api.nvim_buf_get_lines(vim.api.nvim_win_get_buf(require('cland.layout').centre()), 0, -1, false), '\\n')"), /follows.*E-108/);
  await c.input('<Space><Space>');
  await c.waitScreen(s => s.includes('References T-107') && s.includes('A-12'), 'thread before alternate command navigation');
  await c.input(':Cland view item R-107<CR>');
  await c.waitScreen(s => s.includes('E-107 · item') && s.includes('Canonical epic'), 'canonical item from an alternate command reference');
  assert.equal(await c.lua("return require('cland.state').S.ui.view.id"), 'E-107');
  await c.input('<Space><Space><C-w>kgg/T-107<CR>');
  await c.waitScreen(s => s.includes('References T-107') && s.includes('A-12'), 'thread restored before inspecting item highlights');
  const groups = await c.lua<string[]>(`local ns = vim.api.nvim_get_namespaces()['cland.thread']; local out = {}; for _, m in ipairs(vim.api.nvim_buf_get_extmarks(0, ns, 0, -1, {details=true})) do if m[4].hl_group == 'ClandBlue' then local line=vim.api.nvim_buf_get_lines(0,m[2],m[2]+1,false)[1]; out[#out+1]=line:sub(m[3]+1,m[4].end_col) end end; return out`);
  for (const prefix of ['T', 'E', 'R', 'Q', 'M', 'S', 'C']) assert.ok(groups.includes(`${prefix}-107`), JSON.stringify(groups));
  assert.ok(!groups.includes('A-12'));
});

test('recorded migrated categories open from old thread references', { skip }, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.git'), { recursive: true });
  const c = await startClient(t, bin, root, {
    CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]),
    CLAND_STUB_SCENARIO_JSON: JSON.stringify({ inbox: {}, items: [
      { id: 'C-3', kind: 'category', title: 'Tech debt', state: 'open', file: 'T-3-tech-debt.md', labels: [], blocked_by: [], parent: null, claim: null, holds: [] },
    ], messages: { general: [{ id: 'm1', from: 'human', fromKind: 'human', via: 'ui', to: ['coordinator'], text: 'Legacy reference T-3 still opens', ts: '2026-10-13T00:00:00Z', topic: 'general' }] } }),
  });
  await c.waitScreen(s => s.includes('Legacy reference T-3'), 'legacy reference in the recorded thread');
  await waitInitialSnapshots(c);
  await c.input('<Esc><C-w>kgg/T-3<CR>gI');
  await c.waitScreen(s => s.includes('C-3 · item') && s.includes('Tech debt'), 'migrated category from old thread id');
  assert.equal(await c.lua("return require('cland.state').S.ui.view.id"), 'C-3');
});
