// Plan-driven statuses through the real daemon, CLI and spoke boundaries.
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { copyPreparedProject } from './prepared-project.ts';
import { taskWriteGate } from './tracker-write-gate.ts';
import { withPlan } from '../src/tracker/plan.ts';
import { parseItem, serializeItem } from '../src/tracker/item.ts';
import assert from 'node:assert/strict';
import files, { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { Tracker, type ItemView } from '../src/tracker/tracker.ts';
import type { EpicPlan } from '../src/tracker/plan.ts';
import { cland, connectUi, connectWsUi, eventually, spawnSpoke, startDaemon, startHub, tempProject } from './harness.ts';

async function fixture(t: test.TestContext, approval = false, territory = false, gated = false) {
  const root = await tempProject(t);
  if (territory) await copyPreparedProject(root);
  if (approval) {
    await mkdir(join(root, '.cland'), { recursive: true });
    await writeFile(join(root, '.cland/config.toml'), '[plan]\napproval = "human"\n');
  }
  const gate = gated ? await taskWriteGate(t, root) : undefined;
  const { discovery } = await startDaemon(t, root, gate?.env);
  const ui = await connectUi(t, discovery);
  const create = async (title: string, kind = 'task', parent?: string) => {
    const r = await ui.request({ ...(['task'].includes(kind) ? { size: 'M' } : {}), type: 'task.create', title, kind, parent });
    assert.equal(r.ok, true, r.error);
    return (r.value as { item: ItemView }).item;
  };
  const epic = await create('Planned stages', 'epic');
  const a = await create('First', 'task', epic.id), b = await create('Blocked', 'task', epic.id), c = await create('Later', 'task', epic.id);
  const plan: EpicPlan = { stages: [
    { name: 'first', qa: { scope: 'none', when: 'per-item' }, lanes: [[a.id, b.id]] },
    { name: 'later', qa: { scope: 'none', when: 'per-item' }, lanes: [[c.id]] },
  ] };
  const set = async () => {
    const file = join(root, 'plan.yaml'); await writeFile(file, stringify(plan));
    const r = await cland(root, 'task', 'plan', 'set', epic.id, '--file', file, '--json');
    assert.equal(r.code, 0, r.stderr);
  };
  const read = async (id: string) => ((await ui.request({ type: 'task.view', item: id })).value as { item: ItemView }).item;
  const status = (id: string, expected: string) => eventually(`${id} becomes ${expected}`, async () => (await read(id)).status === expected ? true : undefined);
  return { root, ui, create, epic, a, b, c, plan, set, read, status, gate };
}

test('CLI plan sets only current backlog tasks, preserves hand statuses, and remembers moves across restart', async t => {
  const f = await fixture(t);
  assert.equal((await f.read(f.a.id)).status, 'backlog', 'an epic without a plan moves nothing');
  assert.equal((await f.ui.request({ type: 'task.link', item: f.b.id, blocked_by: [f.a.id] })).ok, true);
  assert.equal((await f.ui.request({ type: 'task.edit', item: f.c.id, status: 'in progress' })).ok, true);
  await f.set(); await f.status(f.a.id, 'planned'); await f.status(f.b.id, 'planned');
  const listed = await cland(f.root, 'task', 'list', '--under', f.epic.id, '--json');
  assert.equal(listed.code, 0, listed.stderr);
  const rows = JSON.parse(listed.stdout).items as ItemView[];
  assert.deepEqual(rows.map(r => r.status), ['planned', 'planned', 'in progress']);
  assert.equal((await f.ui.request({ type: 'task.edit', item: f.a.id, status: 'backlog' })).ok, true);
  const added = await f.create('Joined current stage', 'task', f.epic.id);
  f.plan.stages[0]!.lanes[0]!.push(added.id); await f.set(); await f.status(added.id, 'planned');
  assert.equal((await f.read(f.a.id)).status, 'backlog');
  assert.equal((await f.read(f.c.id)).status, 'in progress');
  f.ui.close(); assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  await startDaemon(t, f.root);
  const again = await cland(f.root, 'task', 'view', f.a.id, '--json');
  assert.equal(JSON.parse(again.stdout).item.status, 'backlog');
});

test('pending approval moves nothing; approval moves backlog tasks and journals one subscribed status event each', async t => {
  const f = await fixture(t, true);
  const coord = await spawnSpoke({ discover: true, cwd: f.root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  assert.equal((await coord.call<{ ok: boolean }>('subscribe', { subject: { subtree: f.epic.id }, events: ['task'] })).ok, true);
  await f.set();
  assert.equal((await f.read(f.epic.id)).approval?.state, 'pending');
  for (const item of [f.a, f.b, f.c]) assert.equal((await f.read(item.id)).status, 'backlog');
  const approve = await cland(f.root, 'task', 'plan', 'approve', f.epic.id, '--json');
  assert.equal(approve.code, 0, approve.stderr);
  await f.status(f.a.id, 'planned'); await f.status(f.b.id, 'planned');
  assert.equal((await f.read(f.c.id)).status, 'backlog');
  await eventually('subscriber receives the current-stage moves', async () => {
    const result = await f.ui.request({ type: 'topic.history', topic: 'agents' });
    const messages = (result.value as { messages: Array<{ text: string; to: string[] }> }).messages;
    const moves = messages.filter(m => m.to.includes('coord') && m.text.includes('status changed backlog → planned'));
    return moves.length === 2 ? moves : undefined;
  }).then(moves => assert.deepEqual(moves.map(m => m.text).sort(), [f.a, f.b].map(i => `event · task · ${i.id} status changed backlog → planned`).sort()));
  assert.equal((await f.ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const journal = (await readFile(join(f.root, '.cland/journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  const moves = journal.filter(row => row.event === 'task-written' && row.op === 'planned');
  assert.deepEqual(moves.map(row => [row.id, row.by]), [[f.a.id, 'hub'], [f.b.id, 'hub']]);
});

test('closed epic stages read closed without task writes; reopening restores derived stages', async t => {
  const f = await fixture(t);
  await f.set(); await f.status(f.a.id, 'planned');
  const epicPath = join(f.root, f.epic.path), text = await readFile(epicPath, 'utf8');
  // A hand close is source-of-truth even without stage or landing evidence.
  await writeFile(epicPath, text.replace('state: open', 'state: closed'));
  await eventually('closed epic indexed', async () => (await f.read(f.epic.id)).state === 'closed' ? true : undefined);
  const shown = await cland(f.root, 'task', 'plan', 'show', f.epic.id, '--json');
  assert.deepEqual(JSON.parse(shown.stdout).stages.map((s: { state: string }) => s.state), ['closed', 'closed']);
  assert.deepEqual((await f.read(f.epic.id)).stages?.map(s => s.state), ['closed', 'closed']);
  assert.equal((await f.read(f.epic.id)).closed, undefined, 'a hand close has no invented card time');
  assert.equal((await f.read(f.c.id)).status, 'backlog');
  assert.equal((await f.ui.request({ type: 'task.edit', item: f.a.id, status: 'backlog' })).ok, true);
  assert.equal((await f.ui.request({ type: 'task.comment', item: f.epic.id, text: 'Closed stage evidence is read-only' })).ok, true);
  assert.equal((await f.read(f.a.id)).status, 'backlog');
  assert.equal((await f.ui.request({ type: 'task.edit', item: f.epic.id, state: 'open' })).ok, true);
  assert.deepEqual((await f.read(f.epic.id)).stages?.map(s => s.state), ['open', 'open']);
  assert.equal((await f.read(f.a.id)).status, 'backlog');
});

for (const qa of [false, true]) test(`landing stage one advances stage two${qa ? ' only after clear stage QA' : ''}`, async t => {
  const f = await fixture(t, false, true);
  if (qa) f.plan.stages[0]!.qa = { scope: 'affected', when: 'after-stage' };
  const active = await f.create('Already in progress', 'task', f.epic.id);
  f.plan.stages[1]!.lanes[0]!.push(active.id);
  assert.equal((await f.ui.request({ type: 'task.edit', item: active.id, status: 'in progress' })).ok, true);
  await f.set(); await f.status(f.a.id, 'planned');
  const rev = await spawnSpoke({ discover: true, cwd: f.root, name: 'rev', role: 'reviewer' });
  t.after(() => rev.close());
  const verifier = await spawnSpoke({ discover: true, cwd: f.root, name: 'qa-stage', role: 'qa' });
  t.after(() => verifier.close());
  for (const item of [f.a, f.b]) {
    const claim = await f.ui.request({ type: 'task.claim', item: item.id });
    assert.equal(claim.ok, true, claim.error);
    const work = (claim.value as { worktree: { path: string } }).worktree.path;
    const git = (...args: string[]) => execFileSync('git', args, { cwd: work, encoding: 'utf8' }).trim();
    await writeFile(join(work, `feature-${item.id}`), 'stage feature\n');
    git('add', `feature-${item.id}`); git('commit', '-qm', 'Stage feature');
    assert.equal((await rev.call<{ ok: boolean }>('task.comment', { id: item.id, verdict: 'review', result: 'clear', run: `review-${item.id}` })).ok, true);
    await f.status(item.id, 'ready');
    const merged = await cland(f.root, 'merge', item.id, '--json');
    assert.equal(merged.code, 0, merged.stderr);
    if (item === f.a || qa) assert.equal((await f.read(f.c.id)).status, 'backlog');
  }
  if (qa) {
    assert.equal((await f.read(f.epic.id)).stages?.[0]?.state, 'open');
    const verdict = await verifier.call<{ ok: boolean; error?: string }>('task.comment', { id: f.epic.id, verdict: 'qa', result: 'clear', stage: 'first', run: 'stage-qa' });
    assert.equal(verdict.ok, true, verdict.error);
  }
  await f.status(f.c.id, 'planned');
  assert.equal((await f.read(active.id)).status, 'in progress');
  assert.equal((await f.read(f.epic.id)).stages?.[0]?.state, 'closed');
});

test('valid hand plans and offline plan changes move only newly joined current-stage tasks', async t => {
  const f = await fixture(t);
  const path = join(f.root, f.epic.path);
  const source = await readFile(path, 'utf8');
  // Write a valid plan as an editor would, before any CLI plan set.
  const item = parseItem(source, f.epic.file);
  item.body = withPlan(item.body, f.plan);
  await writeFile(path, serializeItem(item));
  await f.status(f.a.id, 'planned'); await f.status(f.b.id, 'planned');
  assert.equal((await f.ui.request({ type: 'task.edit', item: f.a.id, status: 'backlog' })).ok, true);
  const added = await f.create('Offline addition', 'task', f.epic.id);
  f.ui.close(); assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  f.plan.stages[0]!.lanes[0]!.push(added.id);
  const offline = parseItem(await readFile(path, 'utf8'), f.epic.file);
  offline.body = withPlan(offline.body, f.plan);
  await writeFile(path, serializeItem(offline));
  const { discovery } = await startDaemon(t, f.root);
  const ui = await connectUi(t, discovery);
  await eventually('startup plans newly joined backlog task', async () => {
    const r = await ui.request({ type: 'task.view', item: added.id });
    return (r.value as { item: ItemView }).item.status === 'planned' ? true : undefined;
  });
  const a = await ui.request({ type: 'task.view', item: f.a.id });
  assert.equal((a.value as { item: ItemView }).item.status, 'backlog');
});

test('stage landing and ten close frames keep a fixed query budget with unrelated items and plans', async t => {
  const { DatabaseSync } = await import('node:sqlite');
  const { serveProject } = await import('../src/hub/daemon.ts');
  const root = await tempProject(t); await copyPreparedProject(root);
  const daemon = await serveProject(root, { log: () => {} });
  t.after(() => daemon.stop());
  assert.ok(daemon.discovery);
  const ui = await connectUi(t, daemon.discovery);
  const create = async (title: string, kind = 'task', parent?: string) => {
    const r = await ui.request({ ...(['task'].includes(kind) ? { size: 'M' } : {}), type: 'task.create', title, kind, parent }); assert.equal(r.ok, true, r.error);
    return (r.value as { item: ItemView }).item;
  };
  const set = async (epic: ItemView, first: ItemView[], later?: ItemView[]) => {
    const plan: EpicPlan = { stages: [{ name: 'first', qa: { scope: 'none', when: 'per-item' }, lanes: [first.map(i => i.id)] },
      ...(later ? [{ name: 'later', qa: { scope: 'none' as const, when: 'per-item' as const }, lanes: [later.map(i => i.id)] }] : [])] };
    assert.equal((await ui.request({ type: 'task.plan', item: epic.id, op: 'set', yaml: stringify(plan) })).ok, true);
  };
  for (let i = 0; i < 64; i++) await create(`Unrelated ${i}`);
  for (let i = 0; i < 8; i++) {
    const epic = await create(`Unrelated epic ${i}`, 'epic');
    await set(epic, [await create(`Unrelated lane ${i}`, 'task', epic.id)]);
  }
  const refusedChildren: string[] = [];
  for (let i = 0; i < 8; i++) {
    const refused = await create(`Unrelated refused epic ${i}`, 'epic');
    const child = await create(`Unrelated refused lane ${i}`, 'task', refused.id);
    refusedChildren.push(child.id);
    const plan: EpicPlan = { stages: [{ name: 'refused', qa: { scope: 'none', when: 'per-item' }, lanes: [[child.id]] }], items: { [child.id]: { qa_criteria: ['C99'] } } };
    const path = join(root, refused.path), item = parseItem(await readFile(path, 'utf8'), refused.file);
    item.body = withPlan(item.body, plan); await writeFile(path, serializeItem(item));
    await eventually('unrelated refused plan indexed', async () => {
      const r = await ui.request({ type: 'task.plan', item: refused.id, op: 'show' });
      return (r.value as { planError?: string }).planError?.includes('no criterion C99') ? true : undefined;
    });
  }
  const epic = await create('Measured epic', 'epic'), first = await create('Measured landing', 'task', epic.id);
  const later: ItemView[] = [];
  for (let i = 0; i < 10; i++) later.push(await create(`Measured close ${i}`, 'task', epic.id));
  await set(epic, [first], later);
  const rev = await spawnSpoke({ discover: true, cwd: root, name: 'rev', role: 'reviewer' }); t.after(() => rev.close());
  const claim = await ui.request({ type: 'task.claim', item: first.id }); assert.equal(claim.ok, true, claim.error);
  const work = (claim.value as { worktree: { path: string } }).worktree.path;
  execFileSync('git', ['commit', '--allow-empty', '-qm', 'Measured landing'], { cwd: work });
  assert.equal((await rev.call<{ ok: boolean }>('task.comment', { id: first.id, verdict: 'review', result: 'clear', run: 'measured-review' })).ok, true);
  const read = async (id: string) => ((await ui.request({ type: 'task.view', item: id })).value as { item: ItemView }).item;
  await eventually('measured task ready', async () => (await read(first.id)).status === 'ready' ? true : undefined);
  let observing = false, queries = 0, turn = 0, refusedReads = 0;
  const checks: Array<{ key: string; turn: number }> = [];
  let ticker: NodeJS.Immediate;
  const tick = () => { turn++; ticker = setImmediate(tick); ticker.unref(); };
  tick(); t.after(() => clearImmediate(ticker));
  const prepare = DatabaseSync.prototype.prepare;
  t.mock.method(DatabaseSync.prototype, 'prepare', function(this: InstanceType<typeof DatabaseSync>, ...args: Parameters<typeof prepare>) {
    if (observing && args[0].includes('tracker_')) queries++;
    const statement = prepare.apply(this, args);
    if (args[0] === 'select criteria_ids from tracker_items where id = ?') {
      const get = statement.get;
      t.mock.method(statement, 'get', function(this: typeof statement, ...bindings: unknown[]) {
        if (observing && refusedChildren.includes(String(bindings[0]))) refusedReads++;
        return Reflect.apply(get, this, bindings);
      });
    }
    if (args[0] === 'select value from tracker_meta where key = ?') {
      const get = statement.get;
      t.mock.method(statement, 'get', function(this: typeof statement, ...bindings: unknown[]) {
        if (observing && String(bindings[0]).startsWith('planned-entry:')) checks.push({ key: String(bindings[0]), turn });
        return Reflect.apply(get, this, bindings);
      });
    }
    return statement;
  });
  observing = true;
  const merged = await cland(root, 'merge', first.id, '--json'); assert.equal(merged.code, 0, merged.stderr);
  await eventually('next stage planned', async () => (await read(later.at(-1)!.id)).status === 'planned' ? true : undefined);
  observing = false;
  assert.equal(refusedReads, 0, 'landing never validates unrelated refused plans');
  t.diagnostic(`one landing: ${queries} tracker queries, ${checks.length} stage checks`);
  assert.ok(queries < 10000, `one landing used ${queries} queries with 64 unrelated items and 8 unrelated plans`);
  assert.ok(checks.length > 0, 'native tracing observed the stage recompute');
  assert.ok(checks.every(c => c.key === `planned-entry:${epic.id.split('-')[1]}`), 'only the affected epic recomputes');
  checks.length = 0; queries = 0; observing = true;
  // All ten requests are submitted together through the frame boundary; storage may span ticks.
  const closed = await Promise.all(later.map(i => ui.request({ type: 'task.close', item: i.id })));
  assert.ok(closed.every(r => r.ok), JSON.stringify(closed.find(r => !r.ok)));
  await new Promise<void>(resolve => setImmediate(resolve));
  // A queued check can still be awaiting its single epic file read.
  await eventually('close recompute drains', async () => {
    const item = await read(epic.id);
    return item.stages?.[1]?.items.length === 10 && checks.length > 0 ? true : undefined;
  });
  observing = false;
  assert.equal(refusedReads, 0, 'close burst never validates unrelated refused plans');
  t.diagnostic(`ten closes: ${queries} tracker queries, ${checks.length} stage checks`);
  assert.equal(new Set(checks.map(c => `${c.key}:${c.turn}`)).size, checks.length, 'at most one recompute per affected epic per tick');
  assert.ok(checks.every(c => c.key === `planned-entry:${epic.id.split('-')[1]}`), 'the burst touches only the affected epic');
  assert.ok(queries < 10000, `ten closes used ${queries} tracker queries`);
});

test('a hand status save during a deferred planned write wins and stays through later recomputes', async t => {
  const f = await fixture(t, false, false, true);
  await f.set(); await f.status(f.b.id, 'planned');
  const added = await f.create('New member', 'task', f.epic.id);
  f.plan.stages[0]!.lanes[0]!.push(added.id);
  await f.gate!.arm();
  const path = join(f.root, f.epic.path), item = parseItem(await readFile(path, 'utf8'), f.epic.file);
  item.body = withPlan(item.body, f.plan); await writeFile(path, serializeItem(item));
  await f.gate!.entered();
  const childPath = join(f.root, added.path), source = await readFile(childPath, 'utf8');
  const saved = source.replace('status: backlog', 'status: review');
  await writeFile(childPath, saved);
  await f.gate!.release();
  await eventually('hand status indexed after deferred write', async () => {
    const r = await f.ui.request({ type: 'task.list', under: f.epic.id });
    return (r.value as { items: ItemView[] }).items.find(i => i.id === added.id)?.status === 'review' ? true : undefined;
  });
  assert.equal(await readFile(childPath, 'utf8'), saved);
  assert.equal((await f.ui.request({ type: 'task.edit', item: added.id, status: 'backlog' })).ok, true);
  const marker = await f.create('Later recompute', 'task', f.epic.id);
  f.plan.stages[0]!.lanes[0]!.push(marker.id); await f.set(); await f.status(marker.id, 'planned');
  assert.equal((await f.read(added.id)).status, 'backlog');
});

test('a late in-place save after the publication hash read retains its status and source', async t => {
  const root = await tempProject(t);
  let editor: files.FileHandle | undefined, path = '', saved = '', captured: string | undefined;
  const save = async () => {
    if (!editor) return;
    await editor.truncate(0); await editor.writeFile(saved, 'utf8'); await editor.close(); editor = undefined;
  };
  const tracker = new Tracker({ root, db: join(root, '.cland/hub.db'), files: { ...files,
    rename: async (from, to) => {
      if (String(from) === path && String(to).endsWith('.conflict')) captured ??= String(to);
      if (String(to) === path && String(from).endsWith('.tmp')) await save();
      await files.rename(from, to);
    },
    unlink: async target => {
      // On the guarded publication path, save through the old editor fd after its final path read.
      if (String(target).endsWith('.tmp')) await save();
      await files.unlink(target);
    },
  } });
  tracker.start(); t.after(() => tracker.stop()); t.after(async () => { await editor?.close(); });
  const hub = await startHub({ tracker }); t.after(() => hub.close());
  const ui = await connectWsUi(t, hub); await ui.request({ type: 'subscribe' });
  const epic = ((await ui.request({ type: 'task.create', title: 'Late editor epic', kind: 'epic' })).value as { item: ItemView }).item;
  const task = ((await ui.request({ size: 'M', type: 'task.create', title: 'Late editor task', parent: epic.id })).value as { item: ItemView }).item;
  path = join(root, task.path); saved = (await readFile(path, 'utf8')).replace('status: backlog', 'status: review');
  editor = await files.open(path, 'r+');
  const plan: EpicPlan = { stages: [{ name: 'current', qa: { scope: 'none', when: 'per-item' }, lanes: [[task.id]] }] };
  assert.equal((await ui.request({ type: 'task.plan', item: epic.id, op: 'set', yaml: stringify(plan) })).ok, true);
  await eventually('late editor save handled', async () => {
    if (editor) return undefined;
    const r = await ui.request({ type: 'task.view', item: task.id });
    return (r.value as { item: ItemView }).item.status === 'review' ? true : undefined;
  });
  assert.equal(await readFile(path, 'utf8'), saved);
  assert.ok(captured, 'guarded publication retains the original editor inode');
  assert.equal(await readFile(captured, 'utf8'), saved);
  // A successful hub-planned publication would have announced a planned status.
  assert.equal(ui.frames.some(f => f.type === 'task' && (f.item as ItemView | undefined)?.id === task.id && (f.item as ItemView).status === 'planned'), false);
  assert.equal((await ui.request({ type: 'task.comment', item: epic.id, text: 'Recompute after the saved status' })).ok, true);
  assert.equal(await readFile(path, 'utf8'), saved);
});

test('an indexed refused candidate recovers when its containing feature is reparented', async t => {
  const root = await tempProject(t); await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[tracker]\nlevels = ["release", "epic", "feature"]\n');
  const { discovery } = await startDaemon(t, root), ui = await connectUi(t, discovery);
  const create = async (title: string, kind: string, parent?: string) => {
    const r = await ui.request({ ...(['task'].includes(kind) ? { size: 'M' } : {}), type: 'task.create', title, kind, parent }); assert.equal(r.ok, true, r.error);
    return (r.value as { item: ItemView }).item;
  };
  const epic = await create('Target', 'epic'), other = await create('Original', 'epic');
  const feature = await create('Containing feature', 'feature', other.id), task = await create('Leaf', 'task', feature.id);
  const path = join(root, epic.path), item = parseItem(await readFile(path, 'utf8'), epic.file, ['release', 'epic', 'feature']);
  item.body = withPlan(item.body, { stages: [{ name: 'recovered', qa: { scope: 'none', when: 'per-item' }, lanes: [[task.id]] }] });
  await writeFile(path, serializeItem(item));
  await eventually('candidate refused outside epic', async () => {
    const r = await ui.request({ type: 'task.plan', item: epic.id, op: 'show' });
    return (r.value as { planError?: string }).planError?.includes('not under epic') ? true : undefined;
  });
  assert.equal((await ui.request({ type: 'task.link', item: feature.id, parent: epic.id })).ok, true);
  await eventually('ancestor reparent recovers candidate and plans its task', async () => {
    const r = await ui.request({ type: 'task.list', under: epic.id });
    return (r.value as { items: ItemView[] }).items.find(i => i.id === task.id)?.status === 'planned' ? true : undefined;
  });
  const recovered = await ui.request({ type: 'task.plan', item: epic.id, op: 'show' });
  assert.equal((recovered.value as { planError?: string }).planError, undefined);
});
