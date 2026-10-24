// T3: residual stage QA rules: native Git ancestry failures and daemon receipt recovery remain here; the end-to-end core is scenarios/stage-close.test.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { DatabaseSync } from 'node:sqlite';
import type { ItemView } from '../src/tracker/tracker.ts';
import { gitIn } from '../src/tracker/verdict-git.ts';
import { cland, connectUi, eventually, nativeProjectHub, spawnSpoke, startDaemon } from './harness.ts';
import { git, fixture } from './stage-qa-support.ts';
import { accountFixtureEnvironment } from './account-fixture-env.ts';
import { onCleanup } from './process-cleanup.ts';

test('a two-shard Linux stage cover is pending then counts across projectHub restart', async t => {
  const f = await fixture(t, false, 1);
  await f.land();
  assert.equal((await f.verdict()).ok, true);
  const before = await eventually('QA and both platform covers close the pre-restart stage', async () => {
    const stage = (await f.read()).stages![0]!;
    return stage.state === 'closed' && stage.verdict?.current === true && stage.cover?.linux && stage.cover.macos
      && stage.cover.missing.length === 0 && !stage.cover.pending?.length ? stage : undefined;
  });
  assert.deepEqual(before.cover!.missing, []);
  assert.equal(before.verdict!.current, true);
  assert.equal(before.state, 'closed');
  const tested = git(f.root, 'rev-parse', 'dev');
  await f.rev.close(); await f.qa.close(); f.ui.close(); await f.stop();
  // Restart between durable QA publication and the derived closure checkpoint.
  const db = new DatabaseSync(join(f.root, '.cland/hub.db'));
  try { db.prepare("delete from tracker_meta where key like 'stage-closure:%'").run(); }
  finally { db.close(); }
  git(f.root, 'commit', '--allow-empty', '-qm', 'Later dev work');
  const later = git(f.root, 'rev-parse', 'dev');
  const nativeGit = gitIn(f.root, await accountFixtureEnvironment());
  const release = Promise.withResolvers<void>();
  onCleanup(t, () => release.resolve());
  let entered = false;
  const hub = await nativeProjectHub(t, f.root, {}, { git: async (args, input) => {
    if (args[0] === 'merge-base' && args[1] === '--is-ancestor' && args[2] === tested && args[3] === later) {
      entered = true;
      await release.promise;
    }
    return nativeGit(args, input);
  } });
  const ui = await connectUi(t, hub.discovery);
  const read = async () => {
    const response = await ui.request({ type: 'task.plan', item: f.epic.id, op: 'show' });
    assert.equal(response.ok, true, response.error);
    return (response.value as { stages: NonNullable<ItemView['stages']> }).stages[0]!;
  };
  await eventually('restarted hub reaches the held stage ancestry read', () => entered ? true : undefined);
  const pending = await eventually('recorded build tree resolves while ancestry remains held', async () => {
    const stage = await read();
    return stage.cover?.tree === before.cover!.tree ? stage : undefined;
  });
  assert.deepEqual(pending.cover!.missing, [], 'unknown ancestry is not missing Linux evidence');
  assert.deepEqual(pending.cover!.pending, ['Linux droplet']);
  assert.equal(pending.verdict!.current, undefined, 'unknown ancestry is not a stale QA verdict');
  assert.equal(pending.state, 'open', 'pending evidence cannot close the stage');
  const shown = await cland(f.root, 'task', 'plan', 'show', f.epic.id);
  assert.equal(shown.code, 0, shown.stderr);
  assert.match(shown.stdout, /stage cover pending Linux droplet/);
  assert.doesNotMatch(shown.stdout, /missing Linux droplet|stage cover complete/);
  release.resolve();
  const restored = await eventually('restored Linux cover closes the stage after ancestry settles', async () => {
    const stage = await read();
    return stage.state === 'closed' ? stage : undefined;
  }, 3000);
  assert.deepEqual(restored.cover, before.cover);
  assert.equal(restored.cover!.linux, `linux-${tested}`);
  assert.equal(restored.verdict!.current, true);
});

test('stage verdict refuses premature QA, wrong roles, stale builds, unknown stages and epic criterion marks', async t => {
  const f = await fixture(t);
  assert.match((await f.verdict('clear', { scope: 'full' })).error ?? '', /QA verdict.*scope/i);
  assert.match((await f.verdict()).error ?? '', /all stage items must merge/);
  const review = await f.rev.call<{ ok: boolean; error?: string }>('task.comment', { id: f.epic.id, verdict: 'review', scope: 'full', result: 'clear', run: 'wrong-role', stage: 'Stage 1' });
  assert.equal(review.ok, false); assert.match(review.error ?? '', /only a live QA/);
  // These are unlanded code tasks. Branchless done tasks qualify as evidence-only.
  for (const item of f.items) {
    const claimed = await f.ui.request({ type: 'task.claim', item: item.id });
    assert.equal(claimed.ok, true, claimed.error);
    assert.ok((await f.read(item.id)).branch);
  }
  for (const item of f.items) assert.equal((await f.ui.request({ type: 'task.edit', item: item.id, state: 'closed' })).ok, true);
  assert.match((await f.verdict()).error ?? '', /all stage items must merge/);
  for (const item of f.items) assert.equal((await f.ui.request({ type: 'task.edit', item: item.id, state: 'open' })).ok, true);
  const old = git(f.root, 'rev-parse', 'dev'); await f.land();
  const landed = git(f.root, 'rev-parse', 'dev');
  git(f.root, 'update-ref', 'refs/heads/dev', old, landed);
  assert.match((await f.verdict()).error ?? '', /does not contain every stage merge/);
  git(f.root, 'update-ref', 'refs/heads/dev', landed, old);
  assert.match((await f.verdict('clear', { commit: old })).error ?? '', /exact dev tip/);
  assert.match((await f.verdict('clear', { stage: 'Unknown' })).error ?? '', /no stage/);
  assert.match((await f.verdict('clear', { verified: 'all' })).error ?? '', /does not mark epic criteria/);
  f.plan.stages[0]!.qa.when = 'per-item'; await f.set();
  assert.match((await f.verdict()).error ?? '', /non-none after-stage/);
  assert.equal((await f.read()).comments.length, 0);
  f.plan.items = { [f.items[0]!.id]: { qa: { scope: 'affected', when: 'after-stage' } } }; await f.set();
  const overridden = await f.verdict(); assert.equal(overridden.ok, true, overridden.error);
  const stage = (await f.read()).stages?.[0];
  assert.deepEqual(stage?.qa, { scope: 'affected', when: 'after-stage' });
  assert.equal(stage?.state, 'closed', 'an after-stage override receives integrated QA even under a per-item default');
});

test('changed stage plans, hand-reopened items and altered verdict headers cannot retain stage closure', async t => {
  const f = await fixture(t); await f.land(); assert.equal((await f.verdict()).ok, true);
  f.plan.stages[0]!.qa.scope = 'full'; await f.set(); assert.equal((await f.read()).stages?.[0]?.state, 'open');
  assert.equal((await f.verdict('clear', { run: 'full-scope' })).ok, true);
  const reopen = await f.ui.request({ type: 'task.edit', item: f.items[0]!.id, state: 'open' });
  assert.equal(reopen.ok, false);
  assert.match(reopen.error ?? '', /already merged.*follow-up/s);
  assert.equal((await f.read()).stages?.[0]?.state, 'closed', 'refused API reopen keeps the completed stage');
  // Files remain the tracker source of truth: an external reopen still invalidates stage evidence.
  const childPath = join(f.root, f.items[0]!.path), childSource = await readFile(childPath, 'utf8');
  const reopenedSource = childSource.replace('state: closed', 'state: open').replace('status: done', 'status: backlog');
  assert.notEqual(reopenedSource, childSource);
  await writeFile(childPath, reopenedSource);
  await eventually('hand-reopened child opens the stage', async () => (await f.read()).stages?.[0]?.state === 'open' ? true : undefined);
  await writeFile(childPath, childSource);
  await eventually('restored child closes the stage', async () => (await f.read()).stages?.[0]?.state === 'closed' ? true : undefined);
  const path = join(f.root, f.epic.path), source = await readFile(path, 'utf8');
  assert.match(source, /run: full-scope/);
  await writeFile(path, source.replace('run: full-scope', 'run: hand-forged'));
  assert.match(await readFile(path, 'utf8'), /run: hand-forged/);
  await eventually('altered hub verdict opens the stage', async () => (await f.read()).stages?.[0]?.state === 'open' ? true : undefined);
  await writeFile(path, source.replace('scope: full', 'scope: broken'));
  const broken = await f.verdict(); assert.equal(broken.ok, false);
  assert.match(broken.error ?? '', /scope|valid epic plan/);
});

for (const change of ['dev', 'plan', 'item', 'format'] as const) test(`publication rechecks ${change} changes during a queued stage verdict`, async t => {
  const f = await fixture(t, true, change === 'format' ? 1 : 3); await f.land(); await f.gate!.arm();
  const writing = f.verdict(); await f.gate!.entered();
  if (change === 'dev') git(f.root, 'commit', '--allow-empty', '-qm', 'Changed build');
  else {
    const path = join(f.root, change === 'item' ? f.items[0]!.path : f.epic.path);
    const source = await readFile(path, 'utf8');
    await writeFile(path, change === 'format' ? source.replace('title: Stage demo', 'title: "Stage demo"')
      : change === 'plan' ? source.replace('scope: affected', 'scope: full') : source.replace('state: closed', 'state: open').replace('status: done', 'status: backlog'));
  }
  await f.gate!.release(); const result = await writing;
  assert.equal(result.ok, false); assert.match(result.error ?? '', /changed while writing|all stage items must merge/);
  assert.equal((await f.read()).comments.length, 0);
});

test('stage QA accepts valid hand formatting without weakening publication checks', async t => {
  const f = await fixture(t, false, 1); await f.land();
  const path = join(f.root, f.epic.path), source = await readFile(path, 'utf8');
  await writeFile(path, source.replace('title: Stage demo', 'title: "Stage demo"'));
  const result = await f.verdict(); assert.equal(result.ok, true, result.error);
  assert.equal((await f.read()).stages?.[0]?.state, 'closed');
});

test('stage closure follows dev ancestry: later descendants stay closed, rollback opens, restoration closes', async t => {
  const f = await fixture(t, false, 1);
  const before = git(f.root, 'rev-parse', 'dev'); await f.land();
  assert.equal((await f.verdict()).ok, true);
  const tested = git(f.root, 'rev-parse', 'dev');
  git(f.root, 'commit', '--allow-empty', '-qm', 'Later descendant');
  const later = git(f.root, 'rev-parse', 'dev');
  await eventually('later descendant remains closed', async () => (await f.read()).stages?.[0]?.state === 'closed' ? true : undefined);
  git(f.root, 'update-ref', 'refs/heads/dev', before, later);
  await eventually('rollback opens the stage', async () => (await f.read()).stages?.[0]?.state === 'open' ? true : undefined);
  assert.equal((await f.read()).stages?.[0]?.verdict?.commit, tested, 'historical QA evidence stays recorded');
  git(f.root, 'update-ref', 'refs/heads/dev', later, before);
  await eventually('restoring the descendant closes the stage again', async () => (await f.read()).stages?.[0]?.state === 'closed' ? true : undefined);
});

test('stage QA requests obey the same Lead subtree boundary as ordinary QA requests', async t => {
  const f = await fixture(t, false, 1, true);
  assert.equal((await f.ui.request({ type: 'subscribe' })).ok, true);
  const foreign = await f.ui.request({ type: 'task.create', title: 'Foreign epic', kind: 'epic' });
  assert.equal(foreign.ok, true, foreign.error);
  const other = (foreign.value as { item: ItemView }).item;
  const launched = await f.ui.request({ type: 'session.launch', name: 'lead-one', role: 'lead', item: f.epic.id, harness: 'claude-code' });
  assert.equal(launched.ok, true, launched.error);
  const sessionId = (launched.value as { process: { sessionId: string } }).process.sessionId;
  // Wait for the native MCP spoke before connecting the observer.
  await f.ui.waitFor(f => f.type === 'session.usage' && f.sessionId === sessionId);
  const lead = await spawnSpoke({ discover: true, cwd: f.root, name: 'lead-one', sessionId, assignRole: false }); t.after(() => lead.close());
  for (const suffix of ['', ' stage Stage 1']) {
    const outside = await lead.call<{ ok: boolean; reason?: string }>('send', { to: ['qa-one'], text: `qa request ${other.id}${suffix}\nRead the brief.` });
    assert.equal(outside.ok, false); assert.match(outside.reason ?? '', /subtree/);
    const inside = await lead.call<{ ok: boolean; error?: string }>('send', { to: ['qa-one'], text: `qa request ${f.epic.id}${suffix}\nRead the brief.` });
    assert.equal(inside.ok, true, inside.error);
  }
});

test('a transient ancestry failure retries and recovers at the same dev SHA without erasing its verdict', async t => {
  const f = await fixture(t, false, 1, false, true);
  await f.land(); assert.equal((await f.verdict()).ok, true);
  const tested = git(f.root, 'rev-parse', 'dev');
  await writeFile(f.failAncestry, '');
  git(f.root, 'commit', '--allow-empty', '-qm', 'Descendant while Git cannot answer ancestry');
  const descendant = git(f.root, 'rev-parse', 'dev');
  await eventually('the real ancestry subprocess fails before Git is restored', async () => {
    const log = await readFile(join(f.root, '.cland', 'log', 'hub.log'), 'utf8');
    return log.split('\n').filter(line => line.startsWith('{')).some(line => {
      const event = JSON.parse(line) as { event: string; what?: string };
      return event.event === 'freshness-failed' && event.what === 'compute';
    }) ? true : undefined;
  });
  const open = await eventually('failed ancestry is stale, never clear', async () => {
    const item = await f.read();
    return item.stages?.[0]?.verdict?.current === false ? item : undefined;
  });
  assert.equal(open.stages?.[0]?.state, 'open'); assert.equal(open.stages?.[0]?.verdict?.commit, tested);
  await rm(f.failAncestry);
  await eventually('successful background ancestry closes the stage', async () => (await f.read()).stages?.[0]?.state === 'closed' ? true : undefined);
  assert.equal(git(f.root, 'rev-parse', 'dev'), descendant, 'Git recovery needs no new build');
});

test('stage receipt hashes remain compatible with legacy parent ids', async t => {
  const f = await fixture(t, false, 1, undefined, undefined, startDaemon);
  await f.land();
  const clear = await f.verdict();
  assert.equal(clear.ok, true, clear.error);
  const view = await f.read();
  const child = await f.read(f.items[0]!.id);
  const receipt = (await f.ui.request({ type: 'task.view', item: child.id })).value as { item: ItemView };
  const dev = git(f.root, 'rev-parse', 'dev');
  // This is the pre-prefix snapshot shape: task lane spellings and landing facts used T-n parents.
  const legacyParent = `T-${f.epic.id.split('-')[1]}`;
  const facts = [{ id: child.id, state: 'closed', parent: legacyParent, kind: 'task', commit: dev, base: 'dev', belongs: true }];
  const { createHash } = await import('node:crypto');
  const legacyHash = createHash('sha256').update(JSON.stringify([f.plan.stages[0], [[child.id, null]], facts])).digest('hex');
  assert.equal(view.stages?.[0]?.verdict?.stage_hash, legacyHash);
  assert.equal(view.stages?.[0]?.verdict?.commit, dev);
  assert.equal(receipt.item.parent, f.epic.id);
  const stopped = await cland(f.root, 'hub', 'stop');
  assert.equal(stopped.code, 0, stopped.stderr);
  const { discovery } = await startDaemon(t, f.root);
  const ui = await connectUi(t, discovery);
  const restored = await eventually('restarted hub checks legacy stage build ancestry', async () => {
    const item = ((await ui.request({ type: 'task.view', item: legacyParent })).value as { item: ItemView }).item;
    return item.stages?.[0]?.state === 'closed' ? item : undefined;
  });
  assert.equal(restored.stages?.[0]?.state, 'closed');
  assert.equal(restored.stages?.[0]?.verdict?.stage_hash, legacyHash);
});
