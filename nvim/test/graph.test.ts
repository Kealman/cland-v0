// The graph view at the Neovim/stub-hub frame boundary.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]), CLAND_STUB_SCENARIO_JSON: JSON.stringify(scenario) });
  await c.waitScreen(s => s.includes('hub: connected'), 'connected');
  return c;
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
  const highlights = () => c.lua<Record<string, string>>(`local b=vim.api.nvim_get_current_buf(); local lines=vim.api.nvim_buf_get_lines(b,0,-1,false); local out={}; for _,m in ipairs(vim.api.nvim_buf_get_extmarks(b,-1,0,-1,{details=true})) do local text=(lines[m[2]+1] or ''):sub(m[3]+1,m[4].end_col); if text:find('◉',1,true) then out.ready=m[4].hl_group end; if text:find('Linked done',1,true) then out.linked=m[4].hl_group end; if text:find('Tray done',1,true) then out.tray=m[4].hl_group end end; return out`);
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
