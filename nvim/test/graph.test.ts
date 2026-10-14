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
import { eventually } from '../../hub/test/harness.ts';
import { nvimOrSkip, startClient } from './harness.ts';
import { waitInitialSnapshots } from './readiness.ts';
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
  await waitInitialSnapshots(c);
  return Object.assign(c, {
    control: (cmd: Record<string, unknown>) => new Promise<Record<string, unknown>>((resolve, reject) => {
      const sock = createConnection(controlPath); let text = ''; sock.setEncoding('utf8'); sock.on('error', reject);
      sock.on('data', chunk => { text += chunk; if (text.includes('\n')) { sock.end(); resolve(JSON.parse(text.slice(0, text.indexOf('\n')))); } });
      sock.write(JSON.stringify(cmd) + '\n');
    }),
  });
}

const staged: Scenario = { ...fixture, items: fixture.items!.map(it => it.id === 'T-3' ? { ...it, plan: { stages: [
  { name: 'Foundation', qa: { scope: 'none', when: 'per-item' }, lanes: [['T-11'], ['T-10']] },
  { name: 'Panels', qa: { scope: 'none', when: 'per-item' }, lanes: [['T-12'], ['T-13']] },
] } } : it).concat([
  { id: 'T-11', kind: 'task', title: 'Same stage', status: 'planned', state: 'open', parent: 'T-3', blocked_by: ['T-10'] },
  { id: 'T-12', kind: 'task', title: 'Later stage', status: 'planned', state: 'open', parent: 'T-3', blocked_by: ['T-11'] },
  { id: 'T-13', kind: 'task', title: 'Unlinked planned', status: 'planned', state: 'open', parent: 'T-3', blocked_by: [] },
  { id: 'T-14', kind: 'task', title: 'Unplanned', status: 'planned', state: 'open', parent: 'T-3', blocked_by: [] },
]) };
const graphLines = (c: Awaited<ReturnType<typeof start>>) => c.lua<string[]>("return vim.api.nvim_buf_get_lines(require('cland.graph').b,0,-1,false)");

test('s groups stages in plan order, includes unlinked planned nodes, and names same-stage and backward dependencies', { skip }, async t => {
  const scenario = structuredClone(staged);
  scenario.items = scenario.items!.map(it => it.id === 'T-10' ? { ...it, blocked_by: ['T-12'] } : it);
  const c = await start(t, scenario);
  await c.input('<Esc><Space>G');
  await c.waitScreen(s => s.includes('T-10 S1'), 'tags before grouping');
  await c.input('s');
  await c.waitScreen(s => s.includes('S1 · Foundation') && s.includes('S2 · Panels'), 'stage headings');
  const lines = await graphLines(c);
  assert.match(lines.find(l => l.includes('S2 · Panels'))!, /│/, 'forward edge remains visible beside the stage heading');
  assert.ok(lines.some(l => l.includes('T-11 S1') && l.includes('T-10 S1')), 'first-stage lanes share a band');
  assert.ok(lines.some(l => l.includes('T-12 S2') && l.includes('T-13 S2')), 'unlinked node joins its stage');
  assert.match(lines.join('\n'), /Against the plan: T-12 → T-10/);
  assert.match(lines.join('\n'), /Within a stage: T-10 → T-11/);
  assert.ok(lines.findIndex(l => l.includes('S1 · Foundation')) < lines.findIndex(l => l.includes('S2 · Panels')));
  assert.ok(lines.some(l => l.includes('Unplanned')), 'unplanned nodes remain visible');
  await c.input('o');
  await c.waitScreen(s => s.split('\n').some(l => l.includes('S1 · Foundation') && l.includes('S2 · Panels')), 'stages become columns');
  await c.input('so');
  await c.waitScreen(s => !s.includes('S1 · Foundation') && s.includes('T-10 S1'), 'toggle restores dependency layers and keeps tags');
});

test('gp on a stage heading opens its epic plan even when the stage name contains another item id', { skip }, async t => {
  const scenario = structuredClone(staged);
  const epic = scenario.items!.find(it => it.id === 'T-3')!;
  (epic.plan as { stages: { name: string }[] }).stages[1]!.name = 'Panels T-99';
  const c = await start(t, scenario);
  await c.input('<Esc><Space>Gs');
  await c.waitScreen(s => s.includes('S2 · Panels T-99'), 'second stage heading');
  await c.lua("vim.fn.search('S2 · Panels T-99','w'); local line=vim.api.nvim_get_current_line(); vim.api.nvim_win_set_cursor(0,{vim.fn.line('.'),line:find('T-99',1,true)-1})");
  await c.input('gp');
  await c.waitScreen(s => s.includes('Plan of T-3 First epic') && s.includes('S2 · Panels T-99'), 'plan from heading');
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"), []);
});

test('a deeper configured container uses its owning epic plan for tags, grouping and stage navigation', { skip }, async t => {
  const scenario: Scenario = { ...structuredClone(staged), tracker: { levels: ['release', 'epic', 'phase'] } };
  scenario.items = scenario.items!.map(it => it.parent === 'T-3' ? { ...it, parent: 'T-7' } : it);
  scenario.items.push({ id: 'T-7', kind: 'phase', title: 'Nested phase', state: 'open', parent: 'T-3' });
  const itemCount = scenario.items.length;
  const c = await start(t, scenario);
  await eventually('configured levels and task list loaded', async () => await c.lua(`
    local state = require('cland.state')
    return vim.deep_equal(state.S.tracker.levels, {'release', 'epic', 'phase'})
      and #state.S.items == ${itemCount}
      and state.item('T-7') ~= nil
  `) || undefined);
  await c.input('<Esc>:Cland graph T-7<CR>');
  await c.waitScreen(s => s.includes('Graph · T-7 Nested phase') && s.includes('T-10 S1') && s.includes('T-12 S2'), 'nested tags from epic plan');
  await c.input('s');
  await c.waitScreen(s => s.includes('S1 · Foundation') && s.includes('S2 · Panels'), 'nested stage grouping');
  const lines = await graphLines(c);
  assert.ok(lines.some(l => l.includes('T-11 S1') && l.includes('T-10 S1')));
  await c.lua("vim.fn.search('S2 · Panels','w')");
  await c.input('gp');
  await c.waitScreen(s => s.includes('Plan of T-3 First epic'), 'owning epic plan from nested heading');
});

test('live plan changes regroup the graph and preserve the selected node; removing the plan restores dependency layers', { skip }, async t => {
  const scenario = structuredClone(staged);
  const c = await start(t, scenario);
  await c.input('<Esc><Space>Gs');
  await c.waitScreen(s => s.includes('S1 · Foundation'), 'grouped graph');
  await c.lua("vim.fn.search('T-11 S1','w'); local line=vim.api.nvim_get_current_line(); vim.api.nvim_win_set_cursor(0,{vim.fn.line('.'),line:find('T-11',1,true)-1})");
  const epic = scenario.items!.find(it => it.id === 'T-3')!;
  epic.plan = { stages: [
    { name: 'Foundation', qa: { scope: 'none', when: 'per-item' }, lanes: [['T-10']] },
    { name: 'Changed panels', qa: { scope: 'none', when: 'per-item' }, lanes: [['T-12', 'T-11'], ['T-13']] },
  ] };
  await c.control({ set: { items: scenario.items }, emit: { type: 'task', id: epic.id, item: epic } });
  await c.waitScreen(s => s.includes('T-11 S2') && s.includes('Changed panels'), 'changed stage');
  assert.match(await c.lua<string>('return vim.api.nvim_get_current_line()'), /T-11 S2/, 'cursor follows its moved node');
  epic.plan = null;
  await c.control({ set: { items: scenario.items }, emit: { type: 'task', id: epic.id, item: epic } });
  await c.waitScreen(s => !s.includes('S1 · Foundation') && !s.includes('T-11 S2'), 'plan removed');
  assert.match(await c.lua<string>('return vim.api.nvim_get_current_line()'), /T-11/, 'node retained after removal');
  await c.input('s');
  await c.waitScreen(s => s.includes('T-11') && !s.includes('S1 ·'), 'no-plan toggle is safe');
});

test('narrow stage bands continue with stage headings and retain dependency diagnostics', { skip }, async t => {
  const scenario = structuredClone(staged);
  const epic = scenario.items!.find(it => it.id === 'T-3')!;
  const plan = epic.plan as { stages: { lanes: string[][] }[] };
  for (let id = 20; id < 26; id++) {
    plan.stages[0]!.lanes.push([`T-${id}`]);
    scenario.items!.push({ id: `T-${id}`, kind: 'task', title: 'Parallel', status: 'planned', state: 'open', parent: 'T-3', blocked_by: [] });
  }
  scenario.items = scenario.items!.map(it => it.id === 'T-10' ? { ...it, blocked_by: ['T-12'] } : it);
  const c = await start(t, scenario);
  await c.input('<Esc><Space>s<Space>Gs');
  await c.waitScreen(s => s.includes('S1 · Foundation'), 'stage bands');
  await c.rpc.request('nvim_ui_try_resize', 80, 45);
  await c.waitScreen(s => s.includes('continuations ↳'), 'narrow stage wraps');
  const lines = await graphLines(c);
  assert.ok(lines.filter(l => l.includes('S1 · Foundation')).length > 1, 'continuations name the same stage');
  assert.match(lines.join('\n'), /Against the plan: T-12 → T-10/);
  assert.match(lines.join('\n'), /Within a stage: T-10 → T-11/);
  assert.ok(await c.lua<boolean>("local b=require('cland.graph').b; local w=vim.api.nvim_win_get_width(vim.fn.bufwinid(b)); for _,line in ipairs(vim.api.nvim_buf_get_lines(b,0,-1,false)) do if vim.api.nvim_strwidth(line)>w then return false end end; return true"), 'vertical stage bands fit the window');
});
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

test('nodes use summary criteria and readable done titles with green glyphs; done tray still folds', { skip }, async t => {
  const c = await start(t, { ...fixture,
    inbox: { asks: [{ id: 'ask-1', topic: { id: 'topic-10' }, question: 'Choose?' }] },
    items: fixture.items!.map(it => it.id === 'T-10' ? { ...it,
      claim: { session: 'impl-10', role: 'implementer' }, topic: 'topic-10',
      body: '## Acceptance criteria\n- [x] First\n- [x] Second\n- [x] Third',
      criteria: { total: 3, done: 1, verified: 1, stale: 1, failed: 0 },
      verdicts: [{ verdict: 'review', result: 'clear' }, { verdict: 'qa', result: 'not clear' }],
    } : it).concat([
      { id: 'T-11', kind: 'task', title: 'Hub ready', status: 'ready', state: 'open', parent: 'T-3', blocked_by: ['T-10'],
        claim: { session: 'review-11', role: 'reviewer' }, verdicts: [{ verdict: 'review', result: 'not clear' }],
        body: '## Acceptance criteria\n- [x] First\n- [ ] Second', criteria: { total: 2, done: 0, verified: 0, stale: 0, failed: 0 } },
      { id: 'T-12', kind: 'task', title: 'Linked done', status: 'done', state: 'closed', parent: 'T-3', blocked_by: ['T-11'] },
      { id: 'T-13', kind: 'task', title: 'Tray done', status: 'done', state: 'closed', parent: 'T-3', blocked_by: [] },
    ]) });
  await c.input('<Esc><Space>G');
  await c.waitScreen(s => s.includes('1/3') && s.includes('0/2'), 'summary criteria drawn');
  const text = () => c.lua<string>("return table.concat(vim.api.nvim_buf_get_lines(vim.api.nvim_get_current_buf(),0,-1,false),'\\n')");
  const shown = await text();
  assert.match(shown, /○ T-10 Hub planned/);
  assert.match(shown, /◉ T-11 ◌ Hub ready/);
  for (const expected of ['?1', 'impl-10', '✗ qa', 'review-11', '1 done folded', '● T-12 Linked done']) assert.ok(shown.includes(expected), expected);
  assert.ok(!shown.includes('Tray done'));
  assert.ok(!shown.includes('✓ review'), 'only latest verdict shown');
  const highlights = () => c.lua<Record<string, string>>(`local b=vim.api.nvim_get_current_buf(); local lines=vim.api.nvim_buf_get_lines(b,0,-1,false); local out={}; for _,m in ipairs(vim.api.nvim_buf_get_extmarks(b,vim.api.nvim_create_namespace('cland.graph'),0,-1,{details=true})) do local text=(lines[m[2]+1] or ''):sub(m[3]+1,m[4].end_col); if text:find('◉',1,true) then out.ready=m[4].hl_group end; if text:find('Linked done',1,true) then out.linked=m[4].hl_group end; if text:find('Tray done',1,true) then out.tray=m[4].hl_group end end; return out`);
  assert.deepEqual(await highlights(), { ready: 'ClandGreen', linked: 'ClandDone' });
  await c.input('d'); await c.waitScreen(s => s.includes('Tray done'), 'done unfolds');
  assert.equal((await highlights()).tray, 'ClandDone');
  await c.input('d'); await c.waitScreen(s => !s.includes('Tray done'), 'done folds again');
  assert.match(await text(), /1 stale/);
  const done = await c.lua(`local b=require('cland.graph').b; local lines=vim.api.nvim_buf_get_lines(b,0,-1,false); local out={}; for _,m in ipairs(vim.api.nvim_buf_get_extmarks(b,vim.api.nvim_create_namespace('cland.graph'),0,-1,{details=true})) do if lines[m[2]+1]:find('Linked done',1,true) then local text=lines[m[2]+1]:sub(m[3]+1,m[4].end_col); if text=='●' then out.glyph=m[4].hl_group end end end; for _,name in ipairs({'ClandDone','ClandDoneBar','ClandDoneChip'}) do local h=vim.api.nvim_get_hl(0,{name=name}); out[name]={fg=h.fg,strikethrough=h.strikethrough or false} end; return out`);
  assert.deepEqual(done, { glyph: 'ClandGreen', ClandDone: { fg: 0x98bfa2, strikethrough: false }, ClandDoneBar: { fg: 0x98bfa2, strikethrough: false }, ClandDoneChip: { fg: 0x98bfa2, strikethrough: false } });
  const frames = await c.control({ requests: true });
  assert.equal((frames.requests as Array<{ type: string }>).filter(f => f.type === 'task.view').length, 0);
});

test('release graph containers show child completion and active task counts, including the done tray', { skip }, async t => {
  const scenario: Scenario = { ...fixture, items: fixture.items!.concat([
    { id: 'T-99', kind: 'map', title: 'Release collection', state: 'open' },
    ...['done', 'in progress', 'review', 'qa', 'ready', 'planned', 'backlog'].map((status, i) => ({
      id: `T-${20 + i}`, kind: 'task', title: status, status, state: status === 'done' ? 'closed' : 'open', parent: 'T-2',
    })),
    { id: 'T-30', kind: 'task', title: 'Finished', state: 'closed', status: 'done', parent: 'T-6' },
    { id: 'T-31', kind: 'task', title: 'Also finished', state: 'closed', status: 'done', parent: 'T-6' },
    { id: 'T-32', kind: 'question', title: 'Decided', state: 'closed', parent: 'T-2' },
  ]).map(it => it.id === 'T-1' ? { ...it, parent: 'T-99' } : it) };
  const c = await start(t, scenario);
  await c.input('<Esc>:Cland graph T-1<CR>');
  await c.waitScreen(s => s.includes('1/7 · 4 in work') && s.includes('1 done folded'), 'epic task counts');
  await c.input('d');
  await c.waitScreen(s => s.includes('Closed epic') && s.includes('2/2 · 0 in work'), 'done epic full title and fraction');
  const titles = await c.lua(`local b=require('cland.graph').b; local lines=vim.api.nvim_buf_get_lines(b,0,-1,false); for _,m in ipairs(vim.api.nvim_buf_get_extmarks(b,vim.api.nvim_create_namespace('cland.graph'),0,-1,{details=true})) do if lines[m[2]+1]:sub(m[3]+1,m[4].end_col)=='Closed epic' then return m[4].hl_group end end`);
  assert.equal(titles, 'ClandDone');
  const active = { ...scenario.items!.find(it => it.id === 'T-25'), id: 'T-25', status: 'review' };
  await c.control({ emit: { type: 'task', id: active.id, item: active } });
  await c.waitScreen(s => s.includes('1/7 · 5 in work'), 'child event updates the container label');
  await c.input(':Cland graph T-99<CR>');
  await c.waitScreen(s => s.includes('1/3 · 5 in work'), 'release counts epics and active tasks throughout its subtree');
  const frames = await c.control({ requests: true });
  assert.equal((frames.requests as Array<{ type: string }>).filter(f => f.type === 'task.view').length, 0);
});

test('graph progress follows configured ladder peers and counts only tasks at the leaf container level', { skip }, async t => {
  const c = await start(t, { tracker: { levels: ['initiative', 'feature'], ladder: [['initiative', 'category'], ['feature', 'track']] }, items: [
    { id: 'T-9', kind: 'map', title: 'Portfolio', state: 'open' },
    { id: 'T-1', kind: 'initiative', title: 'Configured root', parent: 'T-9', state: 'open' },
    { id: 'T-2', kind: 'feature', title: 'Active feature', parent: 'T-1', state: 'open' },
    { id: 'T-3', kind: 'feature', title: 'Done feature', parent: 'T-1', state: 'closed' },
    { id: 'T-4', kind: 'track', title: 'Done peer', parent: 'T-1', state: 'closed' },
    ...['done', 'review', 'planned'].map((status, i) => ({ id: `T-${10 + i}`, kind: 'task', title: status,
      status, state: status === 'done' ? 'closed' : 'open', parent: 'T-2' })),
    { id: 'T-13', kind: 'question', title: 'Done question', state: 'closed', parent: 'T-2' },
    { id: 'T-14', kind: 'task', title: 'Direct task', state: 'open', status: 'qa', parent: 'T-1' },
    { id: 'T-15', kind: 'question', title: 'Root question', state: 'closed', parent: 'T-1' },
  ] });
  await c.input('<Esc>:Cland graph T-1<CR>');
  await c.waitScreen(s => s.includes('1/3 · 1 in work'), 'feature excludes its decided question and planned activity');
  await c.input(':Cland graph T-9<CR>');
  await c.waitScreen(s => s.includes('2/3 · 2 in work'), 'root counts both configured child kinds and descendant activity');
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

test('Enter, gI, gt and gs use the graph node and Space Space restores it for each parent', { skip }, async t => {
  const c = await start(t, { ...cursorFixture,
    topics: [{ id: 'topic-12', title: 'Node topic', item: 'T-12' }],
    processes: [{ name: 'impl-12', label: 'Worker', role: 'implementer', status: 'running', state: 'idle' }],
    attach: { 'impl-12': "printf 'Worker attached'; sleep 600" },
    items: cursorFixture.items!.map(it => it.id === 'T-12' ? { ...it, status: 'in progress', topic: 'topic-12', claim: { session: 'impl-12', role: 'implementer' }, title: 'Unicode 界 title with 100% complete and a very long description which the canvas clips' } : it),
  });
  await c.input('<Esc><Space>G'); await node(c, 'T-12');
  assert.match(await c.lua<string>("return require('cland.graph').winbar(vim.api.nvim_get_current_win())"), /Unicode 界 title with 100%% complete.*canvas clips/);
  for (const [keys, kind, id] of [['<CR>', 'item', 'T-12'], ['gI', 'item', 'T-12'], ['gt', 'thread', 'topic-12'], ['gs', 'session', 'impl-12']]) {
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
  await waitRendered(c, "return require('cland.graph').window_width", v => v === 120, 'resized graph window');
  visible(await view());
  await node(c, 'T-10', '^'); visible(await view());
});

test('visible hub updates retain the node through reflow; no-op task details and unrelated events write nothing', { skip }, async t => {
  const scenario = { ...cursorFixture, items: cursorFixture.items!.map(it => it.id === 'T-10' ? { ...it, criteria: { total: 1, done: 0, verified: 0, stale: 0, failed: 0 } } : it) };
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
  const reflow = { ...updated, criteria: { total: 1, done: 1, verified: 1, stale: 0, failed: 0 }, body: '## Acceptance criteria\n- [x] C1. Check\n  - verified: qa-1 [qa] · run q-1 · 2026-10-10T10:00Z', verdicts: [{ verdict: 'review', result: 'clear', current: true }] };
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
  await c.control({ emits: [{ type: 'task', id: longer.id, item: longer }, { type: 'inbox', inbox: { asks: [{ id: 'ask-10', topic: { id: 'topic-10' }, question: 'Choose?' }] } }] });
  await c.waitScreen(s => s.includes('?1'), 'ask badge'); await node(c, 'T-14');
  assert.equal(await c.lua("return require('cland.graph').model.nodes['T-14'].row"), movedRow, 'existing badge rows remain stable');
  const noOp = { ...longer, updated: '2026-10-10T13:00:00Z', comments: [{ author: 'coord', at: '2026-10-10T13:00:00Z', text: 'Invisible comment' }] };
  const stable = await c.lua(`local g=require('cland.graph'); return {tick=vim.api.nvim_buf_get_changedtick(g.b), marks=vim.api.nvim_buf_get_extmarks(g.b,vim.api.nvim_create_namespace('cland.graph.focus'),0,-1,{details=true})}`);
  scenario.items = scenario.items!.map(it => it.id === updated.id ? noOp : it);
  await c.control({ set: { items: scenario.items } });
  await c.control({ emit: { type: 'task', id: noOp.id, item: noOp } });
  await waitRendered(c, `local d=require('cland.state').item('T-10'); local g=require('cland.graph'); return d and d.comments[1] and d.comments[1].text=='Invisible comment' and g.model.nodes['T-14']~=nil`, v => v === true, 'no-op summary applied');
  // Read in the next RPC after the response's scheduled render.
  assert.deepEqual(await c.lua(`local g=require('cland.graph'); return {tick=vim.api.nvim_buf_get_changedtick(g.b), marks=vim.api.nvim_buf_get_extmarks(g.b,vim.api.nvim_create_namespace('cland.graph.focus'),0,-1,{details=true})}`), stable);
  await c.control({ emit: { type: 'task', id: 'T-5', item: { ...fixture.items!.find(it => it.id === 'T-5'), title: 'Unrelated change' } } });
  await waitRendered(c, "return require('cland.state').item('T-5').title", v => v === 'Unrelated change', 'unrelated event applied');
  assert.deepEqual(await c.lua(`local g=require('cland.graph'); return {tick=vim.api.nvim_buf_get_changedtick(g.b), marks=vim.api.nvim_buf_get_extmarks(g.b,vim.api.nvim_create_namespace('cland.graph.focus'),0,-1,{details=true})}`), stable);
  await node(c, 'T-14');
});
