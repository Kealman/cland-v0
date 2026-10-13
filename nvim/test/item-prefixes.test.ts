import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tempProject } from '../../hub/test/harness.ts';
import { nvimOrSkip, startClient } from './harness.ts';

const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';
const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));

test('gi on a legacy reference opens the canonical epic and only kind prefixes are item tokens', { skip }, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.git'), { recursive: true });
  const text = 'References T-107 E-107 R-107 Q-107 M-107 S-107 C-107 A-12';
  const c = await startClient(t, bin, root, {
    CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]),
    CLAND_STUB_SCENARIO_JSON: JSON.stringify({ inbox: {}, items: [
      { id: 'E-107', kind: 'epic', title: 'Canonical epic', state: 'open', file: 'T-107-legacy.md', labels: [], blocked_by: [], parent: null, claim: null, holds: [] },
    ], messages: { general: [{ id: 'm1', from: 'coord', fromKind: 'agent', fromRole: 'coordinator', via: 'spoke', to: ['human'], text, ts: '2026-10-13T00:00:00Z', topic: 'general' }] } }),
  });
  await c.waitScreen(s => s.includes('References T-107') && s.includes('A-12'), 'legacy references in the thread');
  await c.input('<Esc><C-w>kgg/A-12<CR>');
  assert.equal(await c.lua("return require('cland.motions').token()"), null);
  await c.input('gi');
  await c.waitScreen(s => s.includes('bound to no item'), 'artifact reference has no item target');
  await c.input('gg/T-107<CR>gi');
  await c.waitScreen(s => s.includes('E-107 · item') && s.includes('Canonical epic'), 'canonical epic item view');
  assert.equal(await c.lua("return require('cland.state').S.ui.view.id"), 'E-107');
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
