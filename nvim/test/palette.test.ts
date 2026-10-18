// T3: terminal attachment/key transport, Aide attachment and Coordinator answer delivery.
// Screen permutations live in palette-component.test.ts; workbench owns the shared real-hub flow.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ownDirectory } from '../../hub/test/process-cleanup.ts';
import { nvimOrSkip, startClient } from './harness.ts';
import { waitInitialSnapshots } from './readiness.ts';
import type { Scenario } from './stub-hub.ts';
import { createConnection } from 'node:net';
import { spawnSpoke, startDaemon, tempProject } from '../../hub/test/harness.ts';

const nvim = await nvimOrSkip();

const skip = 'skip' in nvim ? nvim.skip : false;

const bin = 'bin' in nvim ? nvim.bin : '';

const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));

async function start(t: TestContext, scenario: Scenario = {}) {
  const root = await mkdtemp(join(tmpdir(), 'cland-palette-'));
  ownDirectory(t, root);
  await mkdir(join(root, '.git'));
  const controlPath = join(root, 'stub.sock');
  const c = await startClient(t, bin, root, {
    CLAND_HUB_TRANSPORT: 'stdio',
    CLAND_COMMAND: JSON.stringify([process.execPath, STUB]),
    CLAND_STUB_SCENARIO_JSON: JSON.stringify({ inbox: {}, ...scenario }),
    CLAND_STUB_CONTROL: controlPath,
  });
  await c.waitScreen(s => s.includes('hub: connected'), 'connected');
  await waitInitialSnapshots(c);
  return Object.assign(c, { root, control: (cmd: Record<string, unknown>) => new Promise<Record<string, unknown>>((resolve, reject) => {
    const sock = createConnection(controlPath);
    let text = '';
    sock.setEncoding('utf8');
    sock.on('error', reject);
    sock.on('data', chunk => {
      text += chunk;
      if (text.includes('\n')) { sock.end(); resolve(JSON.parse(text.slice(0, text.indexOf('\n')))); }
    });
    sock.write(`${JSON.stringify(cmd)}\n`);
  }) });
}

test('Aide launches send role defaults, the project root and optional briefs, avoiding names in processes and presence', { skip }, async t => {
  const c = await start(t, {
    roles: [{role: 'aide', label: 'Aide', exclusive: false, launch: {harness: 'codex', model: 'planning-model', effort: 'high'}}],
    processes: [{name: 'aide-1', role: 'aide', status: 'stopped', state: 'unknown'}],
    presence: [{name: 'aide-2', role: 'aide', state: 'idle'}],
  });
  await c.input('<Esc><Space>A');
  await c.waitScreen(s => s.includes('aide-3') && /model +planning-model/.test(s) && s.includes('brief'), 'Aide launcher defaults');
  await c.input('Help me plan v0.2<CR>');
  await c.waitScreen(s => s.includes('attached aide-3') && s.includes('YOURS · 2'), 'Aide attached above crew groups');
  const frames = async () => ((await c.control({requests: true})).requests as Array<Record<string, unknown>>).filter(f => f.type === 'session.launch');
  const [first] = await frames();
  assert.deepEqual({...first, id: undefined}, {type: 'session.launch', id: undefined, name: 'aide-3', role: 'aide', harness: 'codex', model: 'planning-model', effort: 'high', cwd: c.root, brief: 'Help me plan v0.2'});
  await c.input('<C-l>');
  await c.waitScreen(s => s.includes('NORMAL'), 'panel focus leaves Terminal mode');
  await c.input('a');
  await c.waitScreen(s => s.includes('aide-4') && s.includes('brief'), 'next available Aide name');
  await c.input('<CR>');
  await c.waitScreen(s => s.includes('attached aide-4') && s.includes('YOURS · 3'), 'Aide with no brief');
  const second = (await frames())[1];
  assert.equal(second?.name, 'aide-4');
  assert.equal(second?.brief, undefined, 'an empty brief is omitted');
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"), []);
});

const item = (id: string, title: string, state = 'open') => ({ id, kind: 'task', title, state, labels: [], blocked_by: [], file: `${id}.md` });

test('all five kinds stay in fixed order while the cursor selects the best match; prefixes and Tab narrow them', { skip }, async t => {
  const c = await start(t, {
    items: [item('T-12', 'Nebula')],
    processes: [{ name: 'nebula-session', harness: 'codex', role: 'reviewer', state: 'idle', status: 'running' }],
    artifacts: [{ id: 'A-1', kind: 'note', title: 'Nebula note', creator: 'human', topic: 'general', status: 'shared', path: '/unused.md' }],
    topics: [{ id: 'general', title: 'General', status: 'open' }, { id: 'topic-nebula', title: 'Nebula topic', status: 'open' }],
  });
  await c.input('<Esc><Space>p');
  await c.waitScreen(s => s.includes('palette ›'), 'all kinds');
  await c.lua("assert(vim.wait(5000,function() return #require('cland.qa').state().items==1 and #require('cland.artifacts').all()==1 end))");
  await c.input('<C-u>');
  const headers = await c.lua(`local out={}; for _,b in ipairs(vim.api.nvim_list_bufs()) do if vim.b[b].cland_role~='sessions' then for _,l in ipairs(vim.api.nvim_buf_get_lines(b,0,-1,false)) do local h=l:match('^ ([A-Z]+) ·'); if h then out[#out+1]=h end end end end; return out`);
  assert.deepEqual(headers, ['ACTIONS', 'ITEMS', 'SESSIONS', 'ARTIFACTS', 'TOPICS']);
  await c.input('T-12');
  await c.waitScreen(s => s.includes('T-12 Nebula'), 'exact id match');
  const selected = await c.lua(`for _,w in ipairs(vim.api.nvim_tabpage_list_wins(0)) do local cfg=vim.api.nvim_win_get_config(w); if cfg.relative~='' and not cfg.focusable then local b=vim.api.nvim_win_get_buf(w); return vim.api.nvim_buf_get_lines(b,vim.api.nvim_win_get_cursor(w)[1]-1,vim.api.nvim_win_get_cursor(w)[1],false)[1] end end`);
  assert.match(String(selected), /T-12 Nebula/);
  await c.input('<C-u>');
  for (const prefix of ['>', '#', '@', '~', '/', '']) {
    await c.input('<Tab>');
    assert.equal(await c.lua('return vim.api.nvim_get_current_line()'), prefix);
  }
  await c.input('<Esc><Space>a');
  await c.waitScreen(s => s.includes('A-1 note · Nebula note'), 'artifacts shortcut');
  assert.equal(await c.lua('return vim.api.nvim_get_current_line()'), '~');
  await c.input('<Esc>');
  assert.equal(await c.mode(), 'n');
});

test('session, topic and text-artifact selections open in splits and receive live updates', { skip }, async t => {
  const c = await start(t, {
    processes: [{ name: 'palette-session', harness: 'codex', role: 'reviewer', status: 'running', state: 'idle' }],
    attach: { 'palette-session': "printf 'palette attached\\n'; sleep 600" },
    topics: [{ id: 'general', title: 'General', status: 'open' }, { id: 'topic-split', title: 'Split topic', status: 'open' }],
    messages: { 'topic-split': [{ id: 'm1', from: 'coord', fromKind: 'agent', fromRole: 'coordinator', to: ['human'], text: 'Split topic content', ts: '2026-10-09T12:00:00Z', topic: 'topic-split' }] },
  });
  const path = join(c.root, 'split.md');
  await writeFile(path, '# Split artifact');
  await c.control({ emit: { type: 'artifact', artifact: { id: 'A-1', kind: 'note', title: 'Split artifact', creator: 'human', status: 'shared', topic: 'general', path } } });
  await c.input('<Esc><Space>p@palette-session<C-v>');
  await c.waitScreen(s => s.includes('palette attached'), 'session split attached');
  assert.equal(await c.mode(), 't');
  await c.input('<C-\\><Space>p/Split topic<C-v>');
  await c.waitScreen(s => s.includes('Split topic content'), 'topic split');
  await c.control({ emit: { type: 'message', topic: { id: 'topic-split' }, message: { id: 'm2', from: 'coord', fromKind: 'agent', fromRole: 'coordinator', to: ['human'], text: 'Live split update', ts: '2026-10-09T12:01:00Z', topic: 'topic-split' } } });
  await c.waitScreen(s => s.includes('Live split update'), 'live topic split');
  await c.input('<Space>aA-1<C-v>');
  await c.waitScreen(s => s.includes('# Split artifact'), 'text artifact split');
  assert.equal(await c.lua("return require('cland.state').S.ui.view.id"), 'general');
  assert.equal(await c.lua('return vim.bo.readonly'), false);
});

test('the terminal Shift+Enter action resumes its attached terminal and reaches the harness', { skip }, async t => {
  const c = await start(t, { processes:[{name:'key-session',harness:'codex',status:'running',state:'idle'}] });
  const path = join(c.root, 'terminal-keys');
  const keylog = fileURLToPath(new URL('./fakes/keylog.ts', import.meta.url));
  await c.control({set:{attach:{'key-session':`${JSON.stringify(process.execPath)} ${JSON.stringify(keylog)} ${JSON.stringify(path)}`}}});
  await c.input('<Esc><Space>p@key-session<CR>');
  await c.waitScreen(s => s.includes('keylog ready'), 'terminal key logger attached');
  await c.input('<C-\\><Space>p>Send Shift+Enter to harness<CR>');
  await c.waitScreen(s => s.includes('TERMINAL') && !s.includes('palette ›'), 'terminal action resumed mode');
  // The logger records complete bytes after reading them from its real PTY.
  const until = Date.now() + 5000;
  let bytes = '';
  while (Date.now() < until) {
    bytes = await readFile(path, 'utf8').catch(() => '');
    if (bytes.includes('1b5b31333b3275')) break;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.ok(bytes.includes('1b5b31333b3275'), bytes);
});

test('a palette option reaches the real hub and the Coordinator receives the human answer', { skip }, async t => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const asked = await coord.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Which orbit?', options: ['Choose periapsis', 'Choose apoapsis'] });
  assert.equal(asked.ok, true);
  const c = await startClient(t, bin, root);
  await c.waitScreen(s => s.includes('Which orbit?'), 'ask loaded from hub');
  await c.input('<Esc><Space>p>Choose apoapsis<CR>');
  await coord.waitForEvent(e => e.params.meta?.from_kind === 'human' && e.params.content === 'Choose apoapsis' && e.params.meta.answer_to === asked.ask);
  await c.waitScreen(s => s.includes('answered with 2: Choose apoapsis'), 'real hub accepted answer');
});
