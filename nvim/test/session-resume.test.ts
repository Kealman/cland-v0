// Resume keys, confirmations and palette actions at the headless Neovim/stub-hub seam.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tempProject } from '../../hub/test/harness.ts';
import { nvimOrSkip, startClient } from './harness.ts';

const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';
const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));

test('r resumes stopped rows with an outcome, offers f/n/Esc, and Resume session is in the palette and Keys', { skip }, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.git'), { recursive: true });
  const path = join(root, 'stub.sock');
  const row = { name: 'old', label: 'old [Implementer]', role: 'implementer', harness: 'claude-code', model: 'claude-fake', sessionId: 'old-id', pid: null, cwd: root, status: 'stopped', state: 'unknown', startedAt: '2026-10-12T00:00:00Z', layer: 'now' };
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]), CLAND_STUB_SCENARIO_JSON: JSON.stringify({ inbox: {}, processes: [row], resumeNotes: ['T-1 claim was not restored'], holdSnapshots: ['session.resume'] }), CLAND_STUB_CONTROL: path });
  const control = (command: Record<string, unknown>) => new Promise<{ requests?: Array<Record<string, unknown>> }>((resolve, reject) => {
    const socket = createConnection(path); let text = '';
    socket.setEncoding('utf8'); socket.on('error', reject);
    socket.on('data', data => { text += data; if (text.includes('\n')) { socket.end(); resolve(JSON.parse(text.slice(0, text.indexOf('\n')))); } });
    socket.write(`${JSON.stringify(command)}\n`);
  });
  await c.waitScreen(s => s.includes('hub: connected'), 'stopped row');
  await c.input('<Esc>');
  await c.lua("vim.cmd('stopinsert'); vim.api.nvim_set_current_win(require('cland.layout').win.right); vim.api.nvim_win_set_width(0, 90)");
  await c.waitScreen(s => s.includes('more (1)'), 'stopped heading before unfolding');
  await c.input('zR');
  await c.waitScreen(s => s.includes('old [Implementer]'), 'stopped row expanded');
  await c.input('gg/old<CR>r');
  await c.waitScreen(s => s.includes('resuming old…'), 'pending resume note');
  await control({ releaseSnapshots: ['session.resume'] });
  await c.waitScreen(s => s.includes('old resumed') && s.includes('T-1 claim was not restored'), 'resume outcome note');
  let requests = (await control({ requests: true })).requests!.filter(f => f.type === 'session.resume');
  assert.equal(requests.length, 1);
  assert.equal(requests[0]!.session, 'old');
  assert.equal(requests[0]!.relaunch, true);
  await c.input('r');
  await c.waitScreen(s => s.includes('old is running'), 'live row refuses resume');
  assert.equal((await control({ requests: true })).requests!.filter(f => f.type === 'session.resume').length, 1);

  await control({ set: { processes: [row], resumeReason: 'conversation gone', resumeBrief: 'A-1', holdSnapshots: [] } });
  await c.lua("require('cland').refresh_sessions()");
  await c.lua("assert(vim.wait(5000, function() return not require('cland.state').session('old').live end), 'stopped row has not refreshed')");
  await c.waitScreen(s => s.includes('stopped'), 'stopped row refreshed');
  for (const cancel of ['n', '<Esc>']) {
    await c.input('r');
    await c.waitScreen(s => s.includes('cannot resume old: conversation gone') && s.includes('f launches it fresh with its brief') && s.includes('n keeps it') && s.includes('stopped'), 'fresh offer');
    await c.input(cancel);
    await c.waitScreen(s => !s.includes('f launches it fresh'), 'fresh offer dismissed');
  }
  requests = (await control({ requests: true })).requests!.filter(f => f.type === 'session.resume');
  assert.ok(requests.every(f => f.fresh !== true), 'cancellation never launches fresh');
  await c.input('<Space>?');
  await c.waitScreen(s => s.includes('Resume session') && s.includes('Launch session fresh'), 'registered resume and confirmation keys in Keys');
  await c.input('q<Space>p');
  await c.input('>Resume session');
  await c.waitScreen(s => s.includes('Resume session') && s.includes('palette'), 'resume in palette');
  await c.input('<CR>');
  await c.waitScreen(s => s.includes('f launches it fresh'), 'palette resumes selected session');
  await c.input('f');
  await c.waitScreen(s => s.includes('old launched fresh'), 'fresh launch outcome');
  requests = (await control({ requests: true })).requests!.filter(f => f.type === 'session.resume');
  assert.equal(requests.at(-1)!.fresh, true);
  await c.lua("vim.cmd('Cland session resume old')");
  await c.waitScreen(s => s.includes('old is running'), 'named session action');
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"), []);
});
