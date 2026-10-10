// The graph view at the Neovim/stub-hub frame boundary.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConnection } from 'node:net';
import { setTimeout as poll } from 'node:timers/promises';
import { ownDirectory } from '../../hub/test/process-cleanup.ts';
import { nvimOrSkip, startClient } from './harness.ts';
import type { Scenario } from './stub-hub.ts';

const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';
const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));
const fixture: Scenario = { items: [
  { id: 'T-1', kind: 'release', title: 'Current release', version: '0.1.0', state: 'open' },
  { id: 'T-2', kind: 'epic', title: 'Second epic', parent: 'T-1', rank: 20, state: 'open' },
  { id: 'T-3', kind: 'epic', title: 'First epic', parent: 'T-1', rank: 10, state: 'open' },
  { id: 'T-4', kind: 'release', title: 'Future release', version: '0.2.0', state: 'open' },
  { id: 'T-5', kind: 'epic', title: 'Future epic', parent: 'T-4', state: 'open' },
  { id: 'T-6', kind: 'epic', title: 'Closed epic', parent: 'T-1', state: 'closed' },
  { id: 'T-10', kind: 'task', title: 'Hub planned', status: 'planned', state: 'open', parent: 'T-3', blocked_by: [] },
] };
async function start(t: TestContext, scenario = fixture) {
  const root = await mkdtemp(join(tmpdir(), 'cland-graph-'));
  ownDirectory(t, root); await mkdir(join(root, '.git'));
  const controlPath = join(root, 'stub.sock');
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]), CLAND_STUB_SCENARIO_JSON: JSON.stringify(scenario), CLAND_STUB_CONTROL: controlPath });
  await c.waitScreen(s => s.includes('hub: connected'), 'connected');
  return Object.assign(c, {
    control: (cmd: Record<string, unknown>) => new Promise<void>((resolve, reject) => {
      const sock = createConnection(controlPath); let text = ''; sock.setEncoding('utf8'); sock.on('error', reject);
      sock.on('data', chunk => { text += chunk; if (text.includes('\n')) { sock.end(); resolve(); } });
      sock.write(JSON.stringify(cmd) + '\n');
    }),
  });
}
test('Space G opens the first ranked epic; p/P include the release and command opens an empty container', { skip }, async t => {
  const c = await start(t);
  await c.input('<Esc><Space>G');
  await c.waitScreen(s => s.includes('Graph · T-3 First epic'), 'graph opens');
  await c.input('p'); await c.waitScreen(s => s.includes('Graph · T-2 Second epic'), 'next epic');
  await c.input('p'); await c.waitScreen(s => s.includes('Graph · T-1 Current release'), 'release last');
  await c.input('p'); await c.waitScreen(s => s.includes('Graph · T-3 First epic'), 'wrap to first');
  await c.input('P'); await c.waitScreen(s => s.includes('Graph · T-1 Current release'), 'reverse wrap');
  await c.input(':Cland graph T-5<CR>'); await c.waitScreen(s => s.includes('Graph · T-5 Future epic') && s.includes('No children'), 'explicit empty container');
  await c.input('<Space>b');
  assert.equal(await c.lua("return vim.b[vim.api.nvim_get_current_buf()].cland_role"), 'board');
  await c.input('<Space><Space>');
  await c.waitScreen(s => s.includes('Graph · T-5 Future epic'), 'graph returns');
});

test('nodes use hub status, asks, claims, latest verdict and parsed criteria; done tray nodes fold and dim', { skip }, async t => {
  const c = await start(t, { ...fixture,
    inbox: { asks: [{ id: 'ask-1', topic: { id: 'topic-10' }, question: 'Choose?' }] },
    items: fixture.items!.map(it => it.id === 'T-10' ? { ...it,
      claim: { session: 'impl-10', role: 'implementer' }, topic: 'topic-10',
      body: '## Acceptance criteria\n- [x] First\n- [x] Second\n- [x] Third',
      criteria: [
        { id: 'C1', checked: true, marks: [{ kind: 'done' }] },
        { id: 'C2', checked: true, marks: [{ kind: 'verified' }] },
        { id: 'C3', checked: true, marks: [{ kind: 'failed' }] },
      ],
      verdicts: [{ verdict: 'review', result: 'clear' }, { verdict: 'qa', result: 'not clear' }],
    } : it).concat([
      { id: 'T-11', kind: 'task', title: 'Hub ready', status: 'ready', state: 'open', parent: 'T-3', blocked_by: ['T-10'],
        claim: { session: 'review-11', role: 'reviewer' }, verdicts: [{ verdict: 'review', result: 'not clear' }],
        body: '## Acceptance criteria\n- [x] First\n- [ ] Second' },
      { id: 'T-12', kind: 'task', title: 'Linked done', status: 'done', state: 'closed', parent: 'T-3', blocked_by: ['T-11'] },
      { id: 'T-13', kind: 'task', title: 'Tray done', status: 'done', state: 'closed', parent: 'T-3', blocked_by: [] },
    ]) });
  await c.input('<Esc><Space>G');
  await c.waitScreen(s => s.includes('1/3') && s.includes('1/2'), 'criteria fetched');
  const text = () => c.lua<string>("return table.concat(vim.api.nvim_buf_get_lines(vim.api.nvim_get_current_buf(),0,-1,false),'\\n')");
  const shown = await text();
  assert.match(shown, /○ T-10 Hub planned/);
  assert.match(shown, /◉ T-11 ◌ Hub ready/);
  for (const expected of ['?1', 'impl-10', '✗ qa', 'review-11', '1 done folded', '● T-12 Linked done']) assert.ok(shown.includes(expected), expected);
  assert.ok(!shown.includes('Tray done'));
  assert.ok(!shown.includes('✓ review'), 'only latest verdict shown');
  const highlights = () => c.lua<Record<string, string>>(`local b=vim.api.nvim_get_current_buf(); local lines=vim.api.nvim_buf_get_lines(b,0,-1,false); local out={}; for _,m in ipairs(vim.api.nvim_buf_get_extmarks(b,vim.api.nvim_create_namespace('cland.graph'),0,-1,{details=true})) do local text=(lines[m[2]+1] or ''):sub(m[3]+1,m[4].end_col); if text:find('◉',1,true) then out.ready=m[4].hl_group end; if text:find('Linked done',1,true) then out.linked=m[4].hl_group end; if text:find('Tray done',1,true) then out.tray=m[4].hl_group end end; return out`);
  assert.deepEqual(await highlights(), { ready: 'ClandGreen', linked: 'ClandDim' });
  await c.input('d'); await c.waitScreen(s => s.includes('Tray done'), 'done unfolds');
  assert.equal((await highlights()).tray, 'ClandDim');
  await c.input('d'); await c.waitScreen(s => !s.includes('Tray done'), 'done folds again');
});

test('vertical layers turn sideways; reduction, cycles and outside blockers are visible', { skip }, async t => {
  const c = await start(t, { ...fixture, items: fixture.items!.concat([
    { id: 'T-11', kind: 'task', title: 'Middle', status: 'review', state: 'open', parent: 'T-3', blocked_by: ['T-10'] },
    { id: 'T-12', kind: 'task', title: 'Last', status: 'backlog', state: 'open', parent: 'T-3', blocked_by: ['T-10', 'T-11'] },
    { id: 'T-13', kind: 'task', title: 'Outside', status: 'qa', state: 'open', parent: 'T-3', blocked_by: ['T-99'] },
    { id: 'T-20', kind: 'task', title: 'Cycle A', status: 'in progress', state: 'open', parent: 'T-3', blocked_by: ['T-21'] },
    { id: 'T-21', kind: 'task', title: 'Cycle B', status: 'planned', state: 'open', parent: 'T-3', blocked_by: ['T-20'] },
  ]) });
  await c.input('<Esc><Space>s<Space>G');
  await c.waitScreen(s => s.includes('Graph · T-3'), 'graph opens');
  const lines = () => c.lua<string[]>("return vim.api.nvim_buf_get_lines(vim.api.nvim_get_current_buf(),0,-1,false)");
  const vertical = await lines();
  assert.ok(vertical.findIndex(l => l.includes('T-10')) < vertical.findIndex(l => l.includes('T-11')));
  assert.ok(vertical.findIndex(l => l.includes('T-11')) < vertical.findIndex(l => l.includes('T-12')));
  assert.match(vertical.join('\n'), /Implied by longer paths: T-10 → T-12/);
  assert.match(vertical.join('\n'), /Left out to break a cycle: T-\d+ → T-\d+/);
  assert.match(vertical.join('\n'), /Blockers outside T-3: T-99 → T-13/);
  assert.ok(!vertical.join('').includes('┼'));
  await c.input('o');
  await c.waitScreen(s => s.split('\n').some(l => l.includes('T-10') && l.includes('T-11') && l.includes('T-12')), 'sideways layers render');
  const horizontal = await lines();
  assert.ok(horizontal.some(l => l.includes('T-10') && l.includes('T-11') && l.includes('T-12')), 'successive layers are side by side');
  assert.equal(await c.lua('return vim.wo.wrap'), false, 'canvas rows stay intact for sideways scrolling');
  await c.input('r');
  await c.waitScreen(s => s.includes('0 hidden') && !s.includes('Implied by longer paths:'), 'implied edges render');
  assert.ok(!(await lines()).join('\n').includes('Implied by longer paths:'));
  await c.input('ro');
  await c.waitScreen(s => s.includes('1 hidden') && !s.split('\n').some(l => l.includes('T-10') && l.includes('T-11') && l.includes('T-12')), 'vertical reduced layers render');
  assert.deepEqual(await lines(), vertical);
});

test('parent cycling follows configured container levels, excludes closed branches, and falls back to the release', { skip }, async t => {
  const c = await start(t, { ...fixture, tracker: { levels: ['release', 'epic', 'phase'] },
    items: fixture.items!.concat([
      { id: 'T-7', kind: 'phase', title: 'Open phase', state: 'open', parent: 'T-3' },
      { id: 'T-8', kind: 'phase', title: 'Archived phase', state: 'open', parent: 'T-6' },
    ]) });
  await c.input('<Esc>:Cland graph<CR>');
  for (const id of ['T-3', 'T-7', 'T-2', 'T-1', 'T-3']) {
    await c.waitScreen(s => s.includes('Graph · ' + id), 'cycle to ' + id);
    await c.input('p');
  }
  await c.input(':Cland graph T-10<CR>');
  await c.waitScreen(s => s.includes('T-10 is not a known container'), 'leaf refused');
  assert.match(await c.lua<string>("return table.concat(vim.api.nvim_buf_get_lines(vim.api.nvim_get_current_buf(),0,-1,false),'\\n')"), /Graph · T-7/);
});

test('a release without open descendant containers is the only parent', { skip }, async t => {
  const c = await start(t, { items: fixture.items!.filter(it => it.kind === 'release') });
  await c.input('<Esc><Space>G');
  await c.waitScreen(s => s.includes('Graph · T-1 Current release') && s.includes('No children'), 'release fallback');
  await c.input('pP'); await c.waitScreen(s => s.includes('Graph · T-1 Current release'), 'only release');
});

test('a tracker with no release opens an empty graph safely', { skip }, async t => {
  const c = await start(t, { items: [] });
  await c.input('<Esc><Space>G');
  await c.waitScreen(s => s.includes('Graph · No current release') && s.includes('No children'), 'no release');
  await c.input('p'); await c.waitScreen(s => s.includes('graph: no open container'), 'empty cycle');
});


// Every wait observes the rendered node/buffer or a completed detail response;
// the polling interval never decides whether a redraw has happened.
type GraphClient = Awaited<ReturnType<typeof start>>;
async function waitRendered<T>(c: GraphClient, code: string, accepts: (value: T) => boolean, what: string) {
  const until = Date.now() + 10_000;
  let last: T | undefined;
  while (Date.now() < until) {
    last = await c.lua<T>(code);
    if (accepts(last)) return last;
    await poll(20);
  }
  assert.fail(`${what}: ${JSON.stringify(last)}\n${c.stderr()}`);
}
async function node(c: GraphClient, id: string, keys?: string) {
  if (keys) await c.input(keys);
  await c.waitScreen(s => s.includes('GRAPH ' + id + ' '), 'winbar selects ' + id);
  assert.equal(await c.lua("return require('cland.graph').node_at()"), id, 'cursor sits on selected glyph');
}
const task = (id: number, blockers: string[], extra = {}) => ({ id: `T-${id}`, kind: 'task', title: `Node ${id}`,
  parent: 'T-3', state: 'open', status: 'planned', blocked_by: blockers, ...extra });
const cursorFixture: Scenario = { ...fixture, items: fixture.items!.filter(it => it.id !== 'T-10').concat([
  task(10, []), task(11, []), task(12, ['T-10']), task(13, ['T-11']), task(14, ['T-12', 'T-13']),
  task(15, []), task(16, []), task(17, []), task(18, []), task(19, [], { status: 'done', state: 'closed' }),
]) };

test('node motions follow both orientations and the tray; focus colors only incident edges without rewriting', { skip }, async t => {
  const c = await start(t, cursorFixture);
  await c.input('<Esc><Space>s<Space>G');
  await node(c, 'T-10');
  const tick = await c.lua("return vim.api.nvim_buf_get_changedtick(require('cland.graph').b)");
  const edges = await c.lua<{ from: string; lit: boolean }[]>(`local g=require('cland.graph'); local out={}; local ns=vim.api.nvim_create_namespace('cland.graph.focus')
    local marks=vim.api.nvim_buf_get_extmarks(g.b,ns,0,-1,{details=true})
    for edge,cells in pairs(g.model.edge_cells) do local lit=false
      for _,cell in ipairs(cells) do for _,m in ipairs(marks) do
        if m[4].hl_group=='ClandBlue' and m[2]==cell[1] and m[3]<=g.model.bytecol[cell[1]][cell[2]]
          and m[4].end_col>g.model.bytecol[cell[1]][cell[2]] then lit=true end
      end end
      out[#out+1]={from=g.model.layout.chains[edge].path[1],lit=lit}
    end; return out`);
  assert.ok(Array.isArray(edges));
  for (const edge of edges) assert.equal(edge.lit, edge.from === 'T-10');
  for (const [keys, id] of [['l', 'T-11'], ['h', 'T-10'], ['$', 'T-11'], ['^', 'T-10'],
    ['j', 'T-12'], ['l', 'T-13'], ['k', 'T-11'], ['jj', 'T-14'], ['j', 'T-15'],
    ['l', 'T-16'], ['h', 'T-15'], ['j', 'T-18'], ['k', 'T-15'], ['k', 'T-14'], ['gg', 'T-10'], ['G', 'T-14']]) await node(c, id!, keys);
  assert.equal(await c.lua("return vim.api.nvim_buf_get_changedtick(require('cland.graph').b)"), tick, 'motions do not write buffer');
  await c.input('o');
  await waitRendered(c, "return require('cland.graph').model.orient", v => v === 'horizontal', 'sideways render');
  for (const [keys, id] of [['^', 'T-10'], ['j', 'T-11'], ['k', 'T-10'], ['l', 'T-12'], ['j', 'T-13'],
    ['h', 'T-11'], ['$', 'T-14'], ['^', 'T-10']]) await node(c, id!, keys);
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"), []);
});

test('Enter, gi, gt and gs use the graph node and Space Space restores it for each parent', { skip }, async t => {
  const c = await start(t, { ...cursorFixture,
    topics: [{ id: 'topic-12', title: 'Node topic', item: 'T-12' }],
    processes: [{ name: 'impl-12', label: 'Worker', role: 'implementer', status: 'running', state: 'idle' }],
    attach: { 'impl-12': "printf 'Worker attached'; sleep 600" },
    items: cursorFixture.items!.map(it => it.id === 'T-12' ? { ...it, status: 'in progress', topic: 'topic-12', claim: { session: 'impl-12', role: 'implementer' }, title: 'Unicode 界 title with 100% complete and a very long description which the canvas clips' } : it),
  });
  await c.input('<Esc><Space>G'); await node(c, 'T-12');
  assert.match(await c.lua<string>("return require('cland.graph').winbar(vim.api.nvim_get_current_win())"), /Unicode 界 title with 100%% complete.*canvas clips/);
  for (const [keys, kind, id] of [['<CR>', 'item', 'T-12'], ['gi', 'item', 'T-12'], ['gt', 'thread', 'topic-12'], ['gs', 'session', 'impl-12']]) {
    await c.input(keys!);
    await waitRendered<{ kind: string; id: string }>(c, 'return require("cland.state").S.ui.view', v => v.kind === kind && v.id === id, keys + ' dispatch');
    if (kind === 'session') await c.waitScreen(s => s.includes('Worker attached'), 'claiming session attached');
    assert.ok((await c.mode()).startsWith('n'), 'node actions open in Normal mode');
    await c.input('<Space><Space>'); await node(c, 'T-12');
  }
  await c.input('l'); await node(c, 'T-13');
  await c.input('p'); await c.waitScreen(s => s.includes('Graph · T-2'), 'other parent');
  await c.input('P'); await node(c, 'T-13');
});

test('sideways scrolling keeps the selected label visible at 80 columns, including return and resize', { skip }, async t => {
  const c = await start(t, { ...fixture, items: fixture.items!.filter(it => it.id !== 'T-10').concat(
    Array.from({ length: 8 }, (_, i) => task(10 + i, i ? [`T-${9 + i}`] : []))) });
  await c.input('<Esc><Space>s<Space>G'); await node(c, 'T-10');
  await c.rpc.request('nvim_ui_try_resize', 80, 45);
  await c.input('o$'); await node(c, 'T-17');
  const view = () => c.lua<{ left: number; col: number; width: number; nodeWidth: number }>(`local g=require('cland.graph'); local w=vim.fn.bufwinid(g.b); local n=g.model.nodes[g.item_at()]
    return {left=vim.api.nvim_win_call(w,vim.fn.winsaveview).leftcol,col=n.col,width=vim.api.nvim_win_get_width(w),nodeWidth=n.width}`);
  const visible = (v: Awaited<ReturnType<typeof view>>) => { assert.ok(v.col >= v.left); assert.ok(v.col + v.nodeWidth <= v.left + v.width); };
  const v = await view(); assert.ok(v.left > 0); visible(v);
  await c.input('<CR>'); await c.waitScreen(s => s.includes('T-17 NODE 17'), 'item opens');
  await c.input('<Space><Space>'); await node(c, 'T-17'); visible(await view());
  await c.rpc.request('nvim_ui_try_resize', 120, 45);
  await waitRendered(c, "return require('cland.graph').model.nodes['T-17'].width", v => v === 40, 'resized nodes');
  visible(await view());
  await node(c, 'T-10', '^'); visible(await view());
});

test('visible hub updates retain the node through reflow; no-op task details and unrelated events write nothing', { skip }, async t => {
  const scenario = { ...cursorFixture, items: cursorFixture.items!.map(it => it.id === 'T-10' ? { ...it, body: '## Acceptance criteria\n- [ ] Check' } : it) };
  const c = await start(t, scenario);
  await c.input('<Esc><Space>G'); await node(c, 'T-10');
  await c.waitScreen(s => s.includes('0/1'), 'initial fraction');
  const before = await c.lua("return vim.api.nvim_buf_get_changedtick(require('cland.graph').b)");
  const updated = { ...scenario.items!.find(it => it.id === 'T-10'), id: 'T-10', updated: '2026-10-10T12:00:00Z', status: 'in progress', claim: { session: 'impl-10', role: 'implementer' } };
  scenario.items = scenario.items!.map(it => it.id === updated.id ? updated : it);
  await c.control({ set: { items: scenario.items } });
  await c.control({ emit: { type: 'task', id: updated.id, item: updated } });
  await c.waitScreen(s => s.includes('impl-10'), 'claim is drawn'); await node(c, 'T-10');
  assert.ok((await c.lua<number>("return vim.api.nvim_buf_get_changedtick(require('cland.graph').b)")) > Number(before));
  const reflow = { ...updated, body: '## Acceptance criteria\n- [x] Check', verdicts: [{ verdict: 'review', result: 'clear', current: true }] };
  scenario.items = scenario.items!.map(it => it.id === updated.id ? reflow : it);
  await c.control({ set: { items: scenario.items } });
  await c.control({ emit: { type: 'task', id: reflow.id, item: reflow } });
  await c.waitScreen(s => s.includes('1/1') && s.includes('✓ review'), 'same-timestamp detail changes visible'); await node(c, 'T-10');
  await node(c, 'T-14', 'jj');
  const geometry = await c.lua<number>("return require('cland.graph').model.nodes['T-14'].row");
  const taller = { ...scenario.items!.find(it => it.id === 'T-12'), id: 'T-12', claim: { session: 'impl-12', role: 'implementer' } };
  scenario.items = scenario.items!.map(it => it.id === taller.id ? taller : it);
  await c.control({ set: { items: scenario.items } });
  await c.control({ emit: { type: 'task', id: taller.id, item: taller } });
  await c.waitScreen(s => s.includes('impl-12'), 'neighbor claim grows layer'); await node(c, 'T-14');
  assert.ok(await c.lua<number>("return require('cland.graph').model.nodes['T-14'].row") > geometry, 'cursor follows reflow');
  const movedRow = await c.lua("return require('cland.graph').model.nodes['T-14'].row");
  const longer = { ...reflow, topic: 'topic-10' };
  scenario.items = scenario.items!.map(it => it.id === updated.id ? longer : it);
  await c.control({ set: { items: scenario.items } });
  await c.control({ emits: [{ type: 'task', id: longer.id, item: longer }, { type: 'inbox', inbox: { asks: [{ id: 'ask-10', topic: { id: 'topic-10' }, question: 'Choose?' }], notifications: [] } }] });
  await c.waitScreen(s => s.includes('?1'), 'ask badge'); await node(c, 'T-14');
  assert.equal(await c.lua("return require('cland.graph').model.nodes['T-14'].row"), movedRow, 'existing badge rows remain stable');
  const noOp = { ...longer, updated: '2026-10-10T13:00:00Z', comments: [{ author: 'coord', at: '2026-10-10T13:00:00Z', text: 'Invisible comment' }] };
  const stable = await c.lua(`local g=require('cland.graph'); return {tick=vim.api.nvim_buf_get_changedtick(g.b), marks=vim.api.nvim_buf_get_extmarks(g.b,vim.api.nvim_create_namespace('cland.graph.focus'),0,-1,{details=true})}`);
  scenario.items = scenario.items!.map(it => it.id === updated.id ? noOp : it);
  await c.control({ set: { items: scenario.items } });
  await c.control({ emit: { type: 'task', id: noOp.id, item: noOp } });
  await waitRendered(c, `local d=require('cland.item_view').detail['T-10']; local g=require('cland.graph'); return d and d.comments[1] and d.comments[1].text=='Invisible comment' and not require('cland.item_view').pending['T-10'] and g.model.nodes['T-14']~=nil`, v => v === true, 'no-op detail completes');
  // Read in the next RPC after the response's scheduled render.
  assert.deepEqual(await c.lua(`local g=require('cland.graph'); return {tick=vim.api.nvim_buf_get_changedtick(g.b), marks=vim.api.nvim_buf_get_extmarks(g.b,vim.api.nvim_create_namespace('cland.graph.focus'),0,-1,{details=true})}`), stable);
  await c.control({ emit: { type: 'task', id: 'T-5', item: { ...fixture.items!.find(it => it.id === 'T-5'), title: 'Unrelated change' } } });
  await waitRendered(c, "return require('cland.state').item('T-5').title", v => v === 'Unrelated change', 'unrelated event applied');
  assert.deepEqual(await c.lua(`local g=require('cland.graph'); return {tick=vim.api.nvim_buf_get_changedtick(g.b), marks=vim.api.nvim_buf_get_extmarks(g.b,vim.api.nvim_create_namespace('cland.graph.focus'),0,-1,{details=true})}`), stable);
  await node(c, 'T-14');
});
