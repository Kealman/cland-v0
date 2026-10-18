// T2: screen permutations consume committed protocol frames through stub-client.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { Rule } from '../../hub/src/rules/rulebook.ts';
import { nvimOrSkip, startClient } from './stub-client.ts';
import { tempProject } from './fixture.ts';

const nvim = await nvimOrSkip();

const skip = 'skip' in nvim ? nvim.skip : false;

const bin = 'bin' in nvim ? nvim.bin : '';

test('a push during the initial snapshot stays current, and Enter on a rule event selects that rule', { skip }, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.git'));
  const controlPath = join(root, 'control.sock');
  const rule: Rule = { number: 1, title: 'Snapshot rule', text: 'Initial text.', scope: 'all', date: '2026-10-15', status: 'active', origin: 'session:helper', reason: 'initial' };
  const live: Rule = { ...rule, number: 2, title: 'Live rule', text: 'Current text.' };
  const event = { id: 'rule-event', ts: new Date().toISOString(), kind: 'rule', glyph: '§', subject: { kind: 'rule', id: '2' }, text: 'rule 2 changed' };
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, fileURLToPath(new URL('./stub-hub.ts', import.meta.url))]), CLAND_STUB_CONTROL: controlPath, CLAND_STUB_SCENARIO_JSON: JSON.stringify({ holdSnapshots: ['rule.list'], rules: [rule], events: [event] }) });
  const control = (command: Record<string, unknown>) => new Promise<void>((resolve, reject) => {
    const socket = createConnection(controlPath); let text = '';
    socket.setEncoding('utf8'); socket.on('error', reject);
    socket.on('data', data => { text += data; if (text.includes('\n')) { socket.end(); resolve(); } });
    socket.write(`${JSON.stringify(command)}\n`);
  });
  await c.waitScreen(s => s.includes('hub: connected'), 'stub connected');
  await control({ waitSnapshot: 'rule.list' });
  await control({ emit: { type: 'rules.changed', rules: [rule, live] } });
  await c.input('<Esc> R');
  await c.waitScreen(s => s.includes('Live rule'), 'live push before snapshot');
  await control({ releaseSnapshots: ['rule.list'] });
  await c.lua("assert(vim.wait(2000,function() for j in pairs(require('cland').client.snapshots) do if j.request.type=='rule.list' then return false end end; return true end))");
  await c.waitScreen(s => s.includes('Live rule') && s.includes('Snapshot rule'), 'live state survives older snapshot');
  await c.input(' E');
  await c.waitScreen(s => s.includes('rule 2 changed'), 'rule event');
  await c.input('ggjjj<CR>');
  await c.waitScreen(s => s.includes('Rulebook ·') && s.includes('Live rule'), 'event opens Rulebook');
  assert.match(await c.lua<string>('return vim.api.nvim_get_current_line()'), /rule 2/);
  await c.input('<CR>');
  await c.waitScreen(s => s.includes('Origin: helper'), 'Aide origin name');
});
