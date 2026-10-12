import test from 'node:test';
import assert from 'node:assert/strict';
import { createConnection } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tempProject } from '../../hub/test/harness.ts';
import { nvimOrSkip, startClient, type Client } from './harness.ts';
const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';
const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));
const at = (minutes: number) => new Date(Date.now() - minutes * 60000).toISOString();
async function select(c: Client, text: string) {
  await c.lua("local text=...; for i,l in ipairs(vim.api.nvim_buf_get_lines(0,0,-1,false)) do if l:find(text,1,true) then vim.api.nvim_win_set_cursor(0,{i,0}); return end end; error('missing '..text)", text);
  await c.input('<Ignore>');
}
function control(path: string, command: Record<string, unknown>) {
  return new Promise<void>((resolve, reject) => {
    const socket = createConnection(path);
    socket.on('error', reject);
    socket.on('data', () => { socket.end(); resolve(); });
    socket.write(JSON.stringify(command) + '\n');
  });
}
for (const view of ['panel', 'full']) test(`${view} inbox shows four now sections, folds five rows and expands only the selected ask or command`, { skip }, async t => {
  const root = await tempProject(t), path = join(root, 'stub.sock');
  const topic = { id: 'general', title: 'General' };
  const scenario = {
    inbox: {
      asks: [
        { id: 'a1', topic, question: 'Choose a path?\nFull question', options: ['Continue', 'Stop'], free: true, from: 'coord', fromRole: 'coordinator', since: at(2), ts: at(2), layer: 'now' },
      ],
      approvals: [{ id: 'cmd', session: 'worker', label: 'worker', role: 'implementer', since: at(3), command: 'npm test\nwith full command', layer: 'now' }],
      plans: [{ id: 'T-1', title: 'Build plan', subject: 'T-1', stages: 2, lanes: 3, items: 4, since: at(4), layer: 'now' }],
      requests: [{ id: 'req', request: 'review', subject: 'T-1', topic, text: 'Review the build\nOnly first line', from: 'aide', fromRole: 'aide', since: at(5), layer: 'now' }],
      messages: Array.from({ length: 7 }, (_, i) => ({ id: `m${i}`, topic, subject: 'general', text: `Message ${i}`, from: 'qa', fromRole: 'qa', since: at(6 + i), layer: 'now' })),
    }, items: [{ id: 'T-1', title: 'Build plan', kind: 'epic', state: 'open', labels: [], parent: null, blocked_by: [], plan: { stages: [{ name: 'Build', lanes: [['T-2']], qa: { scope: 'none', when: 'after-stage' } }] }, approval: { required: true, state: 'pending' } }],
  };
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]), CLAND_STUB_SCENARIO_JSON: JSON.stringify(scenario), CLAND_STUB_CONTROL: path });
  await c.waitScreen(s => s.includes('hub: connected'), 'connected');
  await c.input(view === 'panel' ? '<Esc> n' : '<Esc> N');
  let screen = await c.waitScreen(s => s.includes('MESSAGES TO YOU') && s.includes('▸ 2 more'), 'four sections');
  const order = ['ASKS AND APPROVALS', 'PLAN APPROVALS', 'REQUESTS TO YOU', 'MESSAGES TO YOU'].map(s => screen.indexOf(s));
  assert.ok(order.every(n => n >= 0)); assert.deepEqual([...order].sort((a,b) => a-b), order);
  assert.doesNotMatch(screen, /Hidden watch ask|Full question|Only first line|Message 5|Message 6/);
  assert.match(screen, /2 m/);
  const fold = await c.lua<string>("local out={}; local b=vim.api.nvim_get_current_buf(); for i,l in ipairs(vim.api.nvim_buf_get_lines(b,0,-1,false)) do local info=require('cland.panels').row_at(b,i); if info and info.inbox_fold then out[#out+1]=l:sub(2) end end; return table.concat(out)");
  assert.match(fold, /▸ 2 more · the oldest waits 12 m, since \d\d:\d\d/);
  const roles = await c.lua<string[]>("local marks=vim.api.nvim_buf_get_extmarks(0,vim.api.nvim_get_namespaces()['cland.panels'],0,-1,{details=true}); local out={}; for _,m in ipairs(marks) do out[#out+1]=m[4].hl_group end; return out");
  assert.ok(roles.includes('ClandRoleCoordinator')); assert.ok(roles.includes('ClandRoleImplementer'));
  assert.ok(roles.includes('ClandRoleAide')); assert.ok(roles.includes('ClandRoleQa'));
  await select(c, '? General');
  await c.waitScreen(s => s.includes('Full question') && s.includes('Continue') && s.includes('i free answer'), 'ask selected');
  await select(c, 'npm test');
  await c.waitScreen(s => s.includes('with full command') && !s.includes('Full question'), 'command selected and ask collapsed');
  await select(c, '2 more'); await c.input('za');
  await c.waitScreen(s => s.includes('Message 5') && s.includes('Message 6') && s.includes('▾ 2 more'), 'seven rows unfolded');
  await c.input('za'); await c.waitScreen(s => !s.includes('Message 5') && s.includes('▸ 2 more'), 'folded again');
  // A newer incoming row preserves the selected older row, so its action remains correct.
  await select(c, '✓ T-1');
  const inserted = { ...scenario.inbox, needsYou: 12, requests: [{ ...scenario.inbox.requests[0], id: 'new', text: 'New request', since: at(0) }, ...scenario.inbox.requests] };
  await control(path, { set: { inbox: inserted }, emit: { type: 'inbox', inbox: inserted } });
  await c.waitScreen(s => /REQUESTS TO YOU\s+2/.test(s), 'live insertion');
  assert.equal(await c.lua("local b=vim.api.nvim_get_current_buf(); return require('cland.panels').row_at(b,vim.api.nvim_win_get_cursor(0)[1]).inbox_key"), 'request:req');
  const capped = { ...inserted, needsYou: 17, requests: [...Array.from({ length: 6 }, (_, i) => ({ ...scenario.inbox.requests[0], id: `latest-${i}`, text: `Latest ${i}`, since: at(0) })), ...scenario.inbox.requests] };
  await control(path, { set: { inbox: capped }, emit: { type: 'inbox', inbox: capped } });
  await c.waitScreen(s => /REQUESTS TO YOU\s+7/.test(s), 'selection pushed beyond the cap');
  assert.equal(await c.lua("local b=vim.api.nvim_get_current_buf(); return require('cland.panels').row_at(b,vim.api.nvim_win_get_cursor(0)[1]).inbox_fold"), 'requests to you');
  await select(c, 'Build plan'); await c.input('<CR>');
  await c.waitScreen(s => s.includes('awaiting your approval'), 'Enter opens the plan');
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"), []);
});

test('waiting ages advance on the local clock with no inbox request or hub frame', { skip }, async t => {
  const root = await tempProject(t), path = join(root, 'stub.sock');
  const since = new Date(Date.now() - 55000).toISOString();
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]), CLAND_STUB_CONTROL: path, CLAND_STUB_SCENARIO_JSON: JSON.stringify({ inbox: { messages: [{ id: 'm', topic: { id: 'general', title: 'General' }, from: 'qa', text: 'Aging row', since, layer: 'now' }] } }) });
  await c.waitScreen(s => s.includes('hub: connected'), 'connected'); await c.input('<Esc> N');
  await c.waitScreen(s => /Aging row.*0 m/.test(s), 'initial age');
  await c.waitScreen(s => /Aging row.*1 m/.test(s), 'age reaches one minute', 10000);
  const calls = await new Promise<Array<{ type: string }>>((resolve, reject) => {
    const socket = createConnection(path); let data = ''; socket.on('error', reject); socket.on('data', b => { data += b; if (data.includes('\n')) { socket.end(); resolve(JSON.parse(data).requests); } }); socket.write('{"requests":true}\n');
  });
  assert.equal(calls.filter(f => f.type === 'inbox.list').length, 1, 'the local timer does not fetch snapshots');
});
