// T2: public recorded frames rendered by headless Neovim; no running hub or harness.
import test from 'node:test';
import { fixtureSocketPath } from '../../test-support/socket-path.ts';
import { stubControl } from './stub-control.ts';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { nvimOrSkip, startClient } from './stub-client.ts';
import { tempProject } from './fixture.ts';
import { waitInitialSnapshots } from './readiness.ts';
const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false, bin = 'bin' in nvim ? nvim.bin : '';
const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));
const ts = '2026-10-22T10:00:00.000Z';

test('first user sees own messages as you and same-name users by display name, with old wire fallback', { skip }, async t => {
  const root = await tempProject(t), control = fixtureSocketPath(root, 'control.sock');
  const message = (id: string, userId?: string, userDisplayName?: string) => ({ id, from: 'same-name', fromKind: 'human', to: [], text: id + ' words', ts, topic: 'general', userId, userDisplayName });
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]),
    CLAND_STUB_CONTROL: control, CLAND_STUB_SCENARIO_JSON: JSON.stringify({ users: [{ id: 'first' }, { id: 'second' }], messages: { general: [] } }) });
  await waitInitialSnapshots(c);
  for (const m of [message('own', 'first', 'Same Name'), message('other', 'second', 'Same Name'), message('old', 'second')]) await stubControl(control, { emit: { type: 'message', topic: { id: 'general', title: 'General' }, message: m } });
  const thread = () => c.lua<string[]>("return vim.api.nvim_buf_get_lines(require('cland.views').topic('general').thread.buf,0,-1,false)");
  await c.waitScreen(s => s.includes('own words') && s.includes('other words') && s.includes('old words'), 'all authored rows rendered');
  await c.waitScreen(s => s.includes('Same Name'), 'other author display name rendered');
  const lines = (await thread()).join('\n');
  assert.match(lines, /you[^\n]*\n[^\n]*own words/);
  assert.match(lines, /Same Name[^\n]*\n[^\n]*other words/);
  assert.match(lines, /you[^\n]*\n[^\n]*old words/);
});
