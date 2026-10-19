// T2: recorded request/reply frames; real hub/CLI and journal assertions live in hub/test/nvim-inbox-requests-rules.test.ts.
import test from 'node:test';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nvimOrSkip, startClient, tempProject } from './stub-client.ts';
import { stubControl } from './stub-control.ts';
import { STUB_NOW } from './fixtures/clock.ts';
const nvim = await nvimOrSkip(), skip = 'skip' in nvim ? nvim.skip : false, bin = 'bin' in nvim ? nvim.bin : '';
const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));
test('recorded frames: the chip equals cland inbox before and after an Aide review request is replied to', { skip }, async t => {
  const root = await tempProject(t), controlPath = join(root, 'stub.sock');
  const before = { needsYou: 1, requests: [{ id: 'review-request', request: 'review', subject: 'T-1', from: 'aide-1', text: 'Review the demo', ts: STUB_NOW, since: STUB_NOW, topic: { id: 'general', title: 'General' } }] };
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]), CLAND_STUB_CONTROL: controlPath, CLAND_STUB_SCENARIO_JSON: JSON.stringify({ inbox: before }) });
  await c.waitScreen(s => /needs you\s+1\b/.test(s.split('\n')[0] ?? ''), 'chip counts the real request snapshot');
  await c.lua("require('cland.layout').right_panel('inbox')");
  await c.waitScreen(s => /INBOX.*1 need you/.test(s), 'existing inbox tolerates the new lists');
  const after = { needsYou: 0, requests: [] };
  await stubControl(controlPath, { set: { inbox: after }, emit: { type: 'inbox', inbox: after } });
  await c.waitScreen(s => /needs you\s+0\b/.test(s.split('\n')[0] ?? '') && /nothing needs you/.test(s), 'reply snapshot clears chip and inbox');
});
