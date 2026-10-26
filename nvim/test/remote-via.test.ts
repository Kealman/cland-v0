// T2: public recorded frames rendered by headless Neovim; no running hub or harness.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nvimOrSkip, startClient } from './stub-client.ts';
import { tempProject } from './fixture.ts';
import { waitInitialSnapshots } from './readiness.ts';
import { stubControl } from './stub-control.ts';
const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false, bin = 'bin' in nvim ? nvim.bin : '';
const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));
const ts = '2026-10-22T10:00:00.000Z';

test('remote message and ask rows and Inbox outcomes name Telegram and Discord, retaining old outcomes', { skip }, async t => {
  const root = await tempProject(t), control = join(root, 'control.sock');
  const message = (id: string, text: string, via: string) => ({ id, from: 'human', fromKind: 'human', to: ['coord'], text, ts, topic: 'general', via });
  const outcome = { status: 'answered', text: 'Continue', by: 'human', at: ts, via: 'telegram' };
  const card = { question: 'Remote direction?', options: ['Continue'], free: true, state: 'answered', outcome };
  const archive = [
    { kind: 'ask', id: 'ask-remote', subject: 'general', text: card.question, since: ts, ts, reason: 'answered', outcome },
    { kind: 'approval', id: 'approval-remote', subject: 'worker', text: 'echo source', since: ts, ts, reason: 'answered', outcome: { choice: 'once', by: 'human', at: ts, via: 'telegram' } },
    { kind: 'ask', id: 'old-ask', subject: 'general', text: 'Previous hub', since: ts, ts, reason: 'answered', outcome: { status: 'answered', text: 'Legacy answer', by: 'human', at: ts } },
  ];
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]), CLAND_STUB_CONTROL: control,
    CLAND_STUB_SCENARIO_JSON: JSON.stringify({ messages: { general: [message('remote-message', 'From the phone', 'telegram'), message('discord-message', 'Other phone', 'discord'), { id: 'ask-remote', from: 'coord', fromKind: 'agent', to: [], via: 'session', text: card.question, ts, topic: 'general', ask: card }] }, inbox: { archive, archiveToday: 3 } }) });
  await waitInitialSnapshots(c);
  const thread = () => c.lua<string[]>("return vim.api.nvim_buf_get_lines(require('cland.views').topic('general').thread.buf,0,-1,false)");
  await c.waitScreen(s => s.includes('via Telegram') && s.includes('via Discord'), 'remote source labels rendered');
  const lines = (await thread()).join('\n');
  assert.match(lines, /you.*via Telegram/);
  assert.match(lines, /you.*via Discord/);
  assert.match(lines, /coord.*via Telegram/);
  await c.input('<Esc> N');
  await c.input('A');
  await c.waitScreen(s => s.includes('Legacy answer') && s.includes('via Telegram'), 'archive outcomes rendered with legacy fallback');
  const inbox = (await c.lua<string[]>("return vim.api.nvim_buf_get_lines(0,0,-1,false)")).join('\n');
  assert.match(inbox, /Continue.*via Telegram/);
  assert.match(inbox, /approved once.*via Telegram/);
  assert.match(inbox, /Legacy answer/);
  assert.doesNotMatch(inbox, /nil|undefined/);
  // A closed approval arriving during this visit folds with the source too.
  const record = { id: 'worker-id:remote', session: 'worker', sessionId: 'worker-id', label: 'worker', harness: 'codex', kind: 'command', subject: { command: 'echo remote' }, command: 'echo remote', choices: ['once'], answerIn: 'hub', since: ts, state: 'pending' };
  await stubControl(control, { emit: { type: 'approval', approval: record } });
  await c.waitScreen(s => s.includes('echo remote'), 'pending approval row');
  await stubControl(control, { emit: { type: 'approval', approval: { ...record, state: 'closed', outcome: { choice: 'once', by: 'human', at: ts, via: 'discord' } } } });
  await c.waitScreen(s => s.includes('via Discord'), 'closed approval source');
  assert.match((await c.lua<string[]>("return vim.api.nvim_buf_get_lines(0,0,-1,false)")).join('\n'), /via Discord/);
});
