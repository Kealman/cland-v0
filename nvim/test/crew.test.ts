// T2: recorded crew snapshots and events; real CLI/reload/refusal rules live in hub/test/nvim-crew-rules.test.ts.
import test from 'node:test';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nvimOrSkip, startClient, tempProject } from './stub-client.ts';
import { waitInitialSnapshots } from './readiness.ts';
import { stubControl } from './stub-control.ts';
const nvim = await nvimOrSkip(), skip = 'skip' in nvim ? nvim.skip : false, bin = 'bin' in nvim ? nvim.bin : '';
const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));
test('recorded frames: sessions header follows crew CLI and hand edits, retaining the last good summary on refusal and refresh', { skip }, async t => {
  const root = await tempProject(t), path = join(root, 'stub.sock');
  const crew = (size: number, leads: string) => ({ config: {}, summary: `rev pool ${size} · leads: ${leads}` });
  const initial = crew(1, 'none'), updated = crew(2, 'none'), hand = crew(2, 'epic');
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]), CLAND_STUB_CONTROL: path, CLAND_STUB_SCENARIO_JSON: JSON.stringify({ crew: initial }) });
  await waitInitialSnapshots(c);
  await c.input('<Space>s');
  await c.lua("vim.api.nvim_win_set_width(require('cland.layout').win.right, 80)");
  await c.waitScreen(s => s.includes('rev pool 1'), 'initial crew in the sessions header');
  const publish = (value: ReturnType<typeof crew>) => stubControl(path, { set: { crew: value }, emit: { type: 'crew', ...value } });
  await publish(updated);
  await c.waitScreen(s => s.includes('rev pool 2'), 'crew set updates the header');
  await publish(hand);
  await c.waitScreen(s => s.includes('rev pool 2') && s.includes('leads: epic'), 'hand edit updates the header');
  // The hub-rule test proves refusal retention. Here the refusal event arrives before status refresh.
  await stubControl(path, { emit: { type: 'message', topic: { id: 'agents', title: 'Agents' }, message: { id: 'crew-refusal', from: 'hub', fromKind: 'hub', via: 'hub', to: ['coordinator'], topic: 'agents', ts: '2026-10-08T10:00:00.000Z', text: 'crew refused: keeping the last good crew' } } });
  await c.lua("local done = false; require('cland').client:request({ type = 'hub.status' }, function(err) assert(not err, err); done = true end); assert(vim.wait(5000, function() return done end))");
  await c.lua("require('cland').refresh_sessions()");
  await c.waitScreen(s => s.includes('rev pool 2') && s.includes('leads: epic'), 'last good summary survives a status refresh');
  await publish(updated);
  await c.waitScreen(s => s.includes('rev pool 2') && s.includes('leads: none'), 'valid file restores the summary');
});
