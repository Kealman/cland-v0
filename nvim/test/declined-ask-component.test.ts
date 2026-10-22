// T2: declined ask rendering through recorded frames, with no hub runtime.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nvimOrSkip, startClient } from './stub-client.ts';
import { waitInitialSnapshots } from './readiness.ts';
import { stubControl } from './stub-control.ts';
import { eventually, tempProject } from './fixture.ts';
import type { Scenario } from './stub-hub.ts';

const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';
const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));
const ts = '2026-10-22T10:00:00.000Z';
const msg = (id: string, role = 'coordinator', text = 'Question') => ({
  id, from: role === 'human' ? 'human' : role, fromKind: role === 'human' ? 'human' : 'agent',
  fromRole: role === 'human' ? null : role, to: role === 'human' ? ['coordinator'] : [], text, ts, topic: 'general',
});

async function start(t: Parameters<typeof tempProject>[0], scenario: Scenario) {
  const root = await tempProject(t);
  await mkdir(join(root, '.git'));
  const control = join(root, 'control.sock');
  const c = await startClient(t, bin, root, {
    HOME: join(root, 'home'), XDG_CONFIG_HOME: join(root, 'config'), XDG_CACHE_HOME: join(root, 'cache'), XDG_DATA_HOME: join(root, 'data'),
    GIT_CONFIG_GLOBAL: join(root, 'gitconfig'), GIT_CONFIG_NOSYSTEM: '1',
    CLAND_STUB_NOW: ts, CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]),
    CLAND_STUB_SCENARIO_JSON: JSON.stringify({ inbox: {}, ...scenario }), CLAND_STUB_CONTROL: control,
  });
  await waitInitialSnapshots(c);
  await eventually('declined history has rendered', async () => await c.lua<boolean>("return require('cland.views').topic('general').thread.block_of['declined-history'] ~= nil") || undefined);
  await c.input('<Esc>:Cland preset charting<CR>');
  return Object.assign(c, { control: (command: Record<string, unknown>) => stubControl(control, command) });
}

test('declining C4: a declined ask folds in place with its reason on history and live updates', { skip }, async t => {
  const outcome = { status: 'declined', reason: 'QA pending.\nWait for its report.', by: 'human', at: ts };
  const closed = { state: 'answered', options: ['Ship now'], free: false, outcome, answer: 'decline-answer' };
  const c = await start(t, { messages: { general: [
    { ...msg('declined-history'), text: 'Can I ship?', ask: closed },
    { ...msg('decline-answer', 'human', 'declined: QA pending.\nWait for its report.'), answerTo: 'declined-history' },
    { ...msg('declined-live'), text: 'Can I ship now?', ask: { state: 'open', options: ['Ship now'], free: false } },
  ] } });
  const read = (id: string) => c.lua<{ lines: string[]; actionable: boolean }>(`
    local t=require('cland.views').topic('general').thread
    local b=t.block_of[...]
    local actionable=false
    for row=b.start,b.start+#b.lines-1 do if t:ask_at(row+1) then actionable=true end end
    return {lines=b.lines,actionable=actionable}
  `, id);
  const history = await read('declined-history');
  assert.equal(history.lines.length, 2, 'separator and one folded row');
  assert.match(history.lines[1]!, /declined: QA pending\. Wait for its report\./);
  assert.equal(history.actionable, false);
  await c.control({ emit: { type: 'ask', topic: 'general', ask: 'declined-live', card: { ...closed, answer: 'live-answer' } } });
  await c.waitScreen(s => s.includes('declined: QA pending. Wait for its report.'), 'declined reason remains visible');
  await eventually('live ask is folded after its outcome arrives', async () => (await read('declined-live')).lines.length === 2 || undefined);
  const live = await read('declined-live');
  assert.match(live.lines[1]!, /declined: QA pending\. Wait for its report\./);
  assert.equal(live.actionable, false);
  await c.control({ emit: { type: 'message', topic: { id: 'general', title: 'General' }, message: {
    ...msg('live-answer', 'human', 'declined: QA pending.\nWait for its report.'), answerTo: 'declined-live',
  } } });
  await eventually('live answer joins the declined block', async () => await c.lua<boolean>(`
    local t=require('cland.views').topic('general').thread
    return t.by_id['live-answer'] ~= nil and t.block_of['live-answer'] == t.block_of['declined-live']
  `) || undefined);
  assert.equal((await read('declined-live')).lines.length, 2, 'answer delivery keeps a single folded row');
});
