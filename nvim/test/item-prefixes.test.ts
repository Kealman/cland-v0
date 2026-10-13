import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tempProject } from '../../hub/test/harness.ts';
import { nvimOrSkip, startClient } from './harness.ts';
import { waitInitialSnapshots } from './readiness.ts';

const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';
const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));

test('gi on a legacy reference opens the canonical epic and only kind prefixes are item tokens', { skip }, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.git'), { recursive: true });
  const text = 'References T-107 E-107 R-107 Q-107 M-107 S-107 C-107 A-12';
  const c = await startClient(t, bin, root, {
    CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]),
    CLAND_STUB_SCENARIO_JSON: JSON.stringify({ inbox: {}, items: [
      { id: 'E-107', kind: 'epic', title: 'Canonical epic', state: 'open', file: 'T-107-legacy.md', labels: [], blocked_by: [], parent: null, claim: null, holds: [] },
    ], messages: { general: [{ id: 'm1', from: 'coord', fromKind: 'agent', fromRole: 'coordinator', via: 'spoke', to: ['human'], text, ts: '2026-10-13T00:00:00Z', topic: 'general' }] } }),
  });
  await c.waitScreen(s => s.includes('References T-107') && s.includes('A-12'), 'legacy references in the thread');
  await waitInitialSnapshots(c);
  await c.input('<Esc><C-w>kgg/A-12<CR>');
  assert.equal(await c.lua("return require('cland.motions').token()"), null);
  await c.input('gi');
  await c.waitScreen(s => s.includes('bound to no item'), 'artifact reference has no item target');
  await c.input('gg/T-107<CR>gi');
  await c.waitScreen(s => s.includes('E-107 · item') && s.includes('Canonical epic'), 'canonical epic item view');
  assert.equal(await c.lua("return require('cland.state').S.ui.view.id"), 'E-107');
  await c.input('<Space><Space>');
  await c.waitScreen(s => s.includes('References T-107') && s.includes('A-12'), 'thread before alternate command navigation');
  await c.input(':Cland view item R-107<CR>');
  await c.waitScreen(s => s.includes('E-107 · item') && s.includes('Canonical epic'), 'canonical item from an alternate command reference');
  assert.equal(await c.lua("return require('cland.state').S.ui.view.id"), 'E-107');
  await c.input('<Space><Space><C-w>kgg/T-107<CR>');
  await c.waitScreen(s => s.includes('References T-107') && s.includes('A-12'), 'thread restored before inspecting item highlights');
  const groups = await c.lua<string[]>(`local ns = vim.api.nvim_get_namespaces()['cland.thread']; local out = {}; for _, m in ipairs(vim.api.nvim_buf_get_extmarks(0, ns, 0, -1, {details=true})) do if m[4].hl_group == 'ClandBlue' then local line=vim.api.nvim_buf_get_lines(0,m[2],m[2]+1,false)[1]; out[#out+1]=line:sub(m[3]+1,m[4].end_col) end end; return out`);
  for (const prefix of ['T', 'E', 'R', 'Q', 'M', 'S', 'C']) assert.ok(groups.includes(`${prefix}-107`), JSON.stringify(groups));
  assert.ok(!groups.includes('A-12'));
});

test('old ids in topics, inbox and journal open migrated items through a restarted real hub and gi', { skip }, async t => {
  const { cland, connectUi, killDaemon, spawnSpoke, startDaemon } = await import('../../hub/test/harness.ts');
  const { writeFile, readFile } = await import('node:fs/promises');
  const root = await tempProject(t);
  await mkdir(join(root, '.git'), { recursive: true });
  await mkdir(join(root, '.cland/tasks'), { recursive: true });
  await writeFile(join(root, '.cland/tasks/T-3-tech-debt.md'), '---\nid: T-3\nkind: epic\ntitle: Tech debt\nstate: open\n---\nLegacy T-3 body.\n');
  let { discovery } = await startDaemon(t, root);
  let ui = await connectUi(t, discovery);
  let coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'sess-coord' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const topic = await coord.call<{ ok: boolean; topic: { id: string } }>('topic.create', { item: 'T-3', title: 'Legacy work' });
  assert.equal(topic.ok, true);
  assert.equal((await coord.call<{ ok: boolean }>('send', { kind: 'request', request: 'review', subject: 'T-3', topic: topic.topic.id, text: 'Review legacy T-3' })).ok, true);
  await ui.request({ type: 'hub.status', flushLogs: true });
  const journalBefore = await readFile(join(root, '.cland/journal.jsonl'), 'utf8');
  await coord.close();
  await killDaemon(discovery.pid);
  const migration = await cland(root, 'task', 'migrate');
  assert.equal(migration.code, 0, migration.stderr);
  ({ discovery } = await startDaemon(t, root));
  ui = await connectUi(t, discovery);
  coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'sess-coord' });
  await coord.waitForPresence(['coord']);
  const mcp = await coord.call<{ ok: boolean; item: { id: string } }>('task.view', { id: 'T-3' });
  assert.equal(mcp.ok, true); assert.equal(mcp.item.id, 'C-3');
  const edit = await cland(root, 'task', 'edit', 'T-3', '--add-label', 'resolved', '--json');
  assert.equal(edit.code, 0, edit.stderr); assert.equal(JSON.parse(edit.stdout).item.id, 'C-3');
  const history = await ui.request({ type: 'topic.history', topic: topic.topic.id });
  assert.equal((history.value as { topic: { item: string } }).topic.item, 'C-3');
  const inbox = await ui.request({ type: 'inbox.list' });
  const request = (inbox.value as { requests: Array<{ subject: string; topic: { item: string } }> }).requests[0]!;
  assert.equal(request.topic.item, 'C-3');
  assert.equal((await coord.call<{ item: { id: string } }>('task.view', { id: request.subject })).item.id, 'C-3');
  await ui.request({ type: 'hub.status', flushLogs: true });
  assert.ok((await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).startsWith(journalBefore));
  const events = await ui.request({ type: 'events.list', filter: { subject: { kind: 'item', id: 'T-3' } } });
  assert.equal(events.ok, true, events.error);
  assert.ok((events.value as { rows: unknown[] }).rows.length > 0, JSON.stringify(events));
  const c = await startClient(t, bin, root);
  await c.waitScreen(s => s.includes('General'), 'real hub initial screen');
  await ui.request({ type: 'topic.send', topic: 'general', text: 'Legacy reference T-3 still opens' });
  await c.waitScreen(s => s.includes('Legacy reference T-3'), 'legacy reference in real thread');
  await waitInitialSnapshots(c);
  await c.input('<Esc><C-w>kgg/T-3<CR>gi');
  await c.waitScreen(s => s.includes('C-3 · item') && s.includes('Tech debt'), 'migrated category from old thread id');
  assert.equal(await c.lua("return require('cland.state').S.ui.view.id"), 'C-3');
});
