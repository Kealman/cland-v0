import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { clandWithEnv, connectUi, eventually, spawnSpoke, startDaemon, tempProject } from './harness.ts';
import { parseCrew, renderCrew, type CrewConfig } from '../src/crew.ts';

type View = { config: CrewConfig; summary: string };

test('crew idle_from defaults empty and round trips as a top-level canonical list', () => {
  assert.deepEqual(parseCrew('').idle_from, []);
  const config = parseCrew('idle_from = ["t-216", "R-217"]\n[crew.reviewer]\nsize = 3\n');
  assert.deepEqual(config.idle_from, ['C-216', 'C-217']);
  const text = renderCrew(config);
  assert.ok(text.indexOf('idle_from = ["C-216","C-217"]') < text.indexOf('[crew.coordinator]'));
  assert.deepEqual(parseCrew(text), config);
  assert.throws(() => parseCrew('idle_from = ["C-216", "E-216"]'), /duplicate/);
});

test('idle categories are set through the CLI and delivered in order to the Coordinator', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland/tasks'), { recursive: true });
  await writeFile(join(root, '.cland/tasks/C-216-tech-debt.md'), '---\nid: C-216\nkind: category\ntitle: Tech debt\nstate: open\n---\n\nDebt.\n');
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', sessionId: 'coord-id', role: 'coordinator' });
  t.after(() => coord.close());
  const initial = await coord.waitForEvent(e => e.params.meta?.kind === 'role');
  assert.match(initial.params.content, /idle_from is empty.*category work is never taken/);
  const set = await clandWithEnv(root, {}, 'crew', 'set', 'idle_from', 'T-216', '--json');
  assert.equal(set.code, 0, set.stderr);
  assert.deepEqual((JSON.parse(set.stdout) as View).config.idle_from, ['C-216']);
  assert.match((JSON.parse(set.stdout) as View).summary, /idle: C-216 Tech debt/);
  const saved = await readFile(join(root, '.cland/crew.toml'), 'utf8');
  assert.ok(saved.indexOf('idle_from = ["C-216"]') < saved.indexOf('[crew.coordinator]'));
  const bugs = await ui.request({ type: 'task.create', title: 'Bugs', kind: 'category', body: '' });
  assert.equal(bugs.ok, true, JSON.stringify(bugs));
  const bugsId = (bugs.value as { item: { id: string } }).item.id;
  assert.equal((await ui.request({ type: 'crew.set', key: 'idle_from', value: [bugsId, 'r-216'] })).ok, true);
  await eventually('ordered categories delivered live', () => coord.events.find(e => e.params.meta?.kind === 'role' && e.params.content.includes(`${bugsId} Bugs, C-216 Tech debt`)));
  const show = await clandWithEnv(root, {}, 'crew', 'show');
  assert.equal(show.code, 0, show.stderr);
  assert.match(show.stdout, /C-216 Tech debt/);
  const emptied = await clandWithEnv(root, {}, 'crew', 'set', 'idle_from', '[]', '--json');
  assert.equal(emptied.code, 0, emptied.stderr);
  assert.deepEqual((JSON.parse(emptied.stdout) as View).config.idle_from, []);
  await eventually('empty categories delivered live', () => coord.events.filter(e => e.params.meta?.kind === 'role' && /idle_from is empty.*category work is never taken/.test(e.params.content)).length >= 2 ? true : undefined);
});

test('invalid idle categories are refused on set and ignored individually on hand reload', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const create = async (title: string, kind: string) => {
    const result = await ui.request({ ...(['task'].includes(kind) ? { size: 'M' } : {}), type: 'task.create', title, kind, body: '' });
    assert.equal(result.ok, true, JSON.stringify(result));
    return (result.value as { item: { id: string } }).item.id;
  };
  const debt = await create('Tech debt', 'category');
  const closed = await create('Closed', 'category');
  const task = await create('A task', 'task');
  assert.equal((await ui.request({ type: 'task.close', item: closed })).ok, true);
  const path = join(root, '.cland/crew.toml');
  const original = await readFile(path, 'utf8');
  for (const [value, reason] of [
    [['C-9999'], /no such item/], [[task], /not a category/], [[closed], /category is closed/],
    [[debt, debt.replace('C-', 't-')], /duplicate item id/], [['A-1'], /invalid item id/],
    [[1], /invalid item id/], ['C-1', /must be a list/],
  ] as const) {
    const result = await ui.request({ type: 'crew.set', key: 'idle_from', value });
    assert.equal(result.ok, false, JSON.stringify(result));
    assert.match(String(result.error), reason);
    assert.equal(await readFile(path, 'utf8'), original, 'a refusal preserves the source');
  }
  const validEdit = original.replace('idle_from = []', `idle_from = ["${closed}", "${debt}", "C-9999", "${task}"]`).replace('[crew.reviewer]\npolicy = "pool"\nsize = 1', '[crew.reviewer]\npolicy = "pool"\nsize = 3');
  await writeFile(path, validEdit);
  await eventually('semantic invalid entries published without dropping staffing', async () => {
    const result = await ui.request({ type: 'crew.show' });
    const config = (result.value as View).config;
    return config.idle_ignored?.length === 3 ? true : undefined;
  });
  const show = await clandWithEnv(root, {}, 'crew', 'show', '--json');
  assert.equal(show.code, 0, show.stderr);
  const result = JSON.parse(show.stdout) as View;
  assert.deepEqual(result.config.idle_categories, [{ id: debt, title: 'Tech debt' }]);
  assert.deepEqual(result.config.idle_ignored.map(item => item.reason), ['category is closed', 'no such item', 'item is task, not a category']);
  assert.equal(result.config.crew.reviewer!.size, 3);
  assert.match(result.summary, /ignored .*category is closed/);
  assert.equal(await readFile(path, 'utf8'), validEdit, 'the hub leaves hand edits intact');
  assert.equal((await ui.request({ type: 'task.close', item: debt })).ok, true);
  await eventually('a later category closure updates the same crew file', async () => {
    const result = await ui.request({ type: 'crew.show' });
    return (result.value as View).config.idle_categories.length === 0 ? true : undefined;
  });
});

test('idle validation selects the configured C root beside the release, excluding other root containers', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[tracker]\nlevels = [["release", "docs", "category"], "epic"]\n');
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const create = async (kind: string) => {
    const result = await ui.request({ ...(['task'].includes(kind) ? { size: 'M' } : {}), type: 'task.create', title: kind, kind, body: '' });
    assert.equal(result.ok, true, JSON.stringify(result));
    return (result.value as { item: { id: string } }).item.id;
  };
  const docs = await create('docs');
  const category = await create('category');
  const accepted = await ui.request({ type: 'crew.set', key: 'idle_from', value: [category] });
  assert.equal(accepted.ok, true, JSON.stringify(accepted));
  assert.deepEqual((accepted.value as View).config.idle_categories, [{ id: category, title: 'category' }]);
  const refused = await ui.request({ type: 'crew.set', key: 'idle_from', value: [docs] });
  assert.equal(refused.ok, false);
  assert.match(String(refused.error), /item is docs, not a category/);
});

test('crew CLI and protocol validate changes, reload hand edits, and retain the last good policy with a notice', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const path = join(root, '.cland/crew.toml');
  const initial = await readFile(path, 'utf8');
  const show = async () => {
    const result = await ui.request({ type: 'crew.show' });
    assert.equal(result.ok, true, JSON.stringify(result));
    return result.value as View;
  };
  const defaults = (await show()).config;
  assert.deepEqual(defaults.leads, []);
  assert.equal(defaults.crew.implementer!.stop_after, 'merge');
  assert.equal(defaults.crew.reviewer!.keep_context, true);
  assert.equal(defaults.crew.aide!.size, null);
  for (const [role, rule] of Object.entries(defaults.crew)) assert.equal(rule.subagents, role === 'coordinator' || role === 'lead');
  const set = await clandWithEnv(root, {}, 'crew', 'set', 'reviewer.size', '2', '--json');
  assert.equal(set.code, 0, set.stderr);
  assert.match((JSON.parse(set.stdout) as View).summary, /rev pool 2/);
  const cliShow = await clandWithEnv(root, {}, 'crew', 'show');
  assert.equal(cliShow.code, 0, cliShow.stderr);
  assert.match(cliShow.stdout, /rev pool 2/);
  await eventually('crew event reaches UI', () => ui.frames.find(f => f.type === 'crew' && String(f.summary).includes('rev pool 2')));
  const saved = await readFile(path, 'utf8');
  for (const [key, value] of [['reviewer.size', 0], ['reviewer.size', 1.5], ['reviewer.size', '2'], ['reviewer.policy', ['pool']], ['reviewer.policy', 'unknown'], ['qa.size', 2], ['reviewer.keep_context', 'true'], ['implementer.stop_after', 'exit'], ['reviewer.harness', 'codex'], ['unknown.size', 2], ['leads', ['task']], ['leads', ['epic', 'epic']]] as const) {
    const refused = await ui.request({ type: 'crew.set', key, value });
    assert.equal(refused.ok, false, `${key}=${JSON.stringify(value)} ${JSON.stringify(refused)}`);
    assert.equal(await readFile(path, 'utf8'), saved);
  }
  const leads = await clandWithEnv(root, {}, 'crew', 'set', 'leads', '["epic"]', '--json');
  assert.equal(leads.code, 0, leads.stderr);
  const good = await readFile(path, 'utf8');
  await writeFile(path, good.replace('size = 2', 'size = 3'));
  await eventually('hand edit reloaded', async () => (await show()).config.crew.reviewer!.size === 3 ? true : undefined);
  const status = await ui.request({ type: 'hub.status' });
  assert.match((status.value as { crew: View }).crew.summary, /rev pool 3.*leads: epic/);
  for (const broken of ['[crew.reviewer]\nsize = 0\n', '[crew.reviewer\n', 'model = "codex"\n', '[crew.reviewer]\nkeep_context = 1\n']) {
    const previous = ui.frames.length;
    await writeFile(path, broken);
    await eventually('refusal recorded', () => ui.frames.slice(previous).find(f => f.type === 'message' && String((f.message as { text?: string })?.text).includes('crew refused')));
    assert.equal((await show()).config.crew.reviewer!.size, 3);
    const rejectedSet = await ui.request({ type: 'crew.set', key: 'reviewer.size', value: 4 });
    assert.equal(rejectedSet.ok, false);
    assert.equal(await readFile(path, 'utf8'), broken);
  }
  await unlink(path);
  await eventually('missing file refusal', async () => {
    const result = await ui.request({ type: 'topic.history', topic: 'agents' });
    return JSON.stringify(result.value).includes('ENOENT') ? true : undefined;
  });
  assert.equal((await show()).config.crew.reviewer!.size, 3);
  await writeFile(path, initial);
  await eventually('restored policy reloaded', async () => (await show()).config.crew.reviewer!.size === 1 ? true : undefined);
});

test('crew set observes the session role boundary from CLI', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  for (const [name, role, allowed] of [['coord', 'coordinator', true], ['aide-one', 'aide', true], ['impl', 'implementer', false], ['rev', 'reviewer', false], ['qa-one', 'qa', false]] as const) {
    assert.equal((await ui.request({ type: 'role.set', session: name, role })).ok, true);
    const result = await clandWithEnv(root, { CLAND_SESSION_NAME: name }, 'crew', 'set', 'reviewer.size', '2');
    assert.equal(result.code, allowed ? 0 : 1, result.stderr);
    if (!allowed) assert.match(result.stderr, /forbidden.*crew.set/);
    const show = await clandWithEnv(root, { CLAND_SESSION_NAME: name }, 'crew', 'show', '--json');
    assert.equal(show.code, 0, show.stderr);
  }
});

test('non-table crew values are refused and cannot replace the last good staffing', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  assert.equal((await ui.request({ type: 'crew.set', key: 'reviewer.size', value: 3 })).ok, true);
  await eventually('last good staffing published', () => ui.frames.find(f => f.type === 'crew' && (f.config as CrewConfig)?.crew.reviewer?.size === 3));
  const path = join(root, '.cland/crew.toml');
  // smol-toml represents dates and times as objects; arrays are objects as well.
  for (const value of ['1979-05-27', '1979-05-27T07:32:00Z', '1979-05-27T07:32:00', '07:32:00', '[]', '[{}]']) {
    for (const text of [`crew = ${value}\n`, `[crew]\nreviewer = ${value}\n`]) {
      const previous = ui.frames.length;
      await writeFile(path, text);
      // A crew event may still be arriving from the preceding valid set. Only
      // the refusal notice proves this invalid hand edit has been processed.
      await eventually('invalid source refused', () => ui.frames.slice(previous).find(f => f.type === 'message' && String((f.message as { text?: string })?.text).includes('crew refused')));
      const show = await ui.request({ type: 'crew.show' });
      assert.equal((show.value as View).config.crew.reviewer!.size, 3, `invalid source replaced the last good crew: ${text}`);
      assert.ok(ui.frames.slice(previous).some(f => f.type === 'message' && String((f.message as { text?: string })?.text).includes('crew refused')), 'broken source emits a refusal notice');
    }
  }
});
