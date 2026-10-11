// Stage QA through the daemon, real verifier spokes, CLI and local-territory merges.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stringify } from 'yaml';
import type { ItemView } from '../src/tracker/tracker.ts';
import type { EpicPlan } from '../src/tracker/plan.ts';
import { cland, clandWithEnv, connectUi, eventually, fakeClaude, spawnSpoke, startDaemon, tempProject } from './harness.ts';
import { taskWriteGate } from './tracker-write-gate.ts';

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
async function fixture(t: test.TestContext, gated = false, count = 3, launchLead = false, ancestryFailure = false) {
  const root = await tempProject(t);
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.name', 'Test'); git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'commit.gpgsign', 'false');
  await writeFile(join(root, 'README.md'), 'project\n'); git(root, 'add', '.'); git(root, 'commit', '-qm', 'Initial');
  assert.equal((await cland(root, 'init')).code, 0);
  const gate = gated ? await taskWriteGate(t, root) : undefined;
  const fake = launchLead ? await fakeClaude(t) : undefined;
  const failAncestry = join(root, '.cland', 'fail-ancestry');
  const bin = join(root, '.cland', 'ancestry-bin');
  if (ancestryFailure) {
    await mkdir(bin);
    await writeFile(join(bin, 'git'), '#!/bin/sh\nif [ "$1" = "merge-base" ] && [ "$2" = "--is-ancestor" ] && [ -f "$CLAND_TEST_ANCESTRY_FAIL" ]; then kill -TERM "$$"; fi\nexec /usr/bin/git "$@"\n', { mode: 0o755 });
  }
  const { discovery } = await startDaemon(t, root, { ...gate?.env, ...fake?.env,
    ...(ancestryFailure ? { PATH: `${bin}:${process.env.PATH}`, CLAND_TEST_ANCESTRY_FAIL: failAncestry } : {}) });
  const ui = await connectUi(t, discovery);
  const rev = await spawnSpoke({ discover: true, cwd: root, name: 'rev', role: 'reviewer', sessionId: 'review-session' });
  const qa = await spawnSpoke({ discover: true, cwd: root, name: 'qa-one', role: 'qa', sessionId: 'qa-session' });
  t.after(async () => { await rev.close(); await qa.close(); });
  const create = async (title: string, kind = 'task', parent?: string, body?: string) => {
    const r = await ui.request({ type: 'task.create', title, kind, parent, body }); assert.equal(r.ok, true, r.error);
    return (r.value as { item: ItemView }).item;
  };
  const epic = await create('Stage demo', 'epic', undefined, '## Definition of done\n- [ ] C1. The integrated demo works');
  const items = await Promise.all(['First', 'Second', 'Third'].slice(0, count).map(title => create(title, 'task', epic.id)));
  const plan: EpicPlan = { stages: [{ name: 'Stage 1', qa: { scope: 'affected', when: 'after-stage' }, lanes: count === 1 ? [[items[0]!.id]] : [[items[0]!.id, items[1]!.id], [items[2]!.id]] }] };
  const set = async () => { const r = await ui.request({ type: 'task.plan', item: epic.id, op: 'set', yaml: stringify(plan) }); assert.equal(r.ok, true, r.error); };
  await set();
  const read = async (id = epic.id) => ((await ui.request({ type: 'task.view', item: id })).value as { item: ItemView }).item;
  const land = async () => {
    for (const [i, item] of items.entries()) {
      const r = await ui.request({ type: 'task.claim', item: item.id }); assert.equal(r.ok, true, r.error);
      const work = (r.value as { worktree: { path: string } }).worktree.path;
      await writeFile(join(work, `feature-${i}`), `feature ${i}\n`); git(work, 'add', `feature-${i}`); git(work, 'commit', '-qm', `Feature ${i}`);
      assert.equal((await rev.call<{ ok: boolean }>('task.comment', { id: item.id, verdict: 'review', result: 'clear', run: `review-${i}` })).ok, true);
      await eventually('review makes after-stage item ready', async () => (await read(item.id)).status === 'ready' ? true : undefined);
      const merged = await ui.request({ type: 'merge', item: item.id }, 30_000); assert.equal(merged.ok, true, merged.error);
      assert.equal((await read(item.id)).verdicts.some(v => v.verdict === 'qa'), false);
    }
  };
  const verdict = (result = 'clear', extra: Record<string, unknown> = {}) => qa.call<{ ok: boolean; error?: string; item?: ItemView }>('task.comment', { id: epic.id, verdict: 'qa', result, stage: 'Stage 1', run: `stage-${result}`, ...extra });
  return { root, ui, rev, qa, epic, items, plan, set, read, land, verdict, gate, failAncestry };
}

test('three review-only merges, one stage QA on dev, not-clear/retry, restart and separate epic demo', async t => {
  const f = await fixture(t);
  await f.land();
  assert.equal((await f.read()).stages?.[0]?.state, 'open');
  const clear = await f.verdict(); assert.equal(clear.ok, true, clear.error);
  const view = await f.read();
  assert.equal(view.stages?.[0]?.state, 'closed'); assert.equal(view.state, 'open');
  assert.equal(view.criteria[0]?.marks.length, 0, 'stage evidence cannot verify the separate epic demo');
  assert.equal(view.stages?.[0]?.verdict?.commit, git(f.root, 'rev-parse', 'dev'));
  const shown = JSON.parse((await cland(f.root, 'task', 'plan', 'show', f.epic.id, '--json')).stdout);
  assert.equal(shown.stages[0].state, 'closed');
  const close = await f.ui.request({ type: 'task.close', item: f.epic.id });
  assert.equal(close.ok, false); assert.match(close.error ?? '', /no hub-written qa verdict/);
  assert.equal((await f.verdict('not clear')).ok, true);
  assert.equal((await f.read()).stages?.[0]?.state, 'open');
  // The CLI carries stage as a verdict field and uses a real connected QA session's identity.
  const retry = await clandWithEnv(f.root, { CLAND_SESSION_NAME: 'qa-one', CLAND_ROLE: 'qa' }, 'task', 'comment', f.epic.id, 'Stage cases pass', '--verdict', 'qa', '--result', 'clear', '--run', 'stage-retry', '--stage', 'Stage 1', '--json');
  assert.equal(retry.code, 0, retry.stderr);
  git(f.root, 'commit', '--allow-empty', '-qm', 'Later stage work');
  await eventually('later dev builds preserve completed stage evidence', async () => (await f.read()).stages?.[0]?.state === 'closed' ? true : undefined);
  await f.rev.close(); await f.qa.close(); f.ui.close(); assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  const { discovery } = await startDaemon(t, f.root); const ui = await connectUi(t, discovery);
  const persisted = await eventually('restarted hub checks stage build ancestry', async () => {
    const item = ((await ui.request({ type: 'task.view', item: f.epic.id })).value as { item: ItemView }).item;
    return item.stages?.[0]?.state === 'closed' ? item : undefined;
  });
  assert.equal(persisted.stages?.[0]?.state, 'closed'); assert.equal(persisted.stages?.[0]?.verdict?.run, 'stage-retry');
  const qa = await spawnSpoke({ discover: true, cwd: f.root, name: 'qa-two', role: 'qa', sessionId: 'qa-session-two' }); t.after(() => qa.close());
  assert.equal((await qa.call<{ ok: boolean }>('task.comment', { id: f.epic.id, verdict: 'qa', result: 'clear', run: 'epic-demo', verified: 'all' })).ok, true);
  assert.equal((await ui.request({ type: 'task.close', item: f.epic.id })).ok, true);
});

test('stage verdict refuses premature QA, wrong roles, stale builds, unknown stages and epic criterion marks', async t => {
  const f = await fixture(t);
  assert.match((await f.verdict()).error ?? '', /all stage items must merge/);
  const review = await f.rev.call<{ ok: boolean; error?: string }>('task.comment', { id: f.epic.id, verdict: 'review', result: 'clear', run: 'wrong-role', stage: 'Stage 1' });
  assert.equal(review.ok, false); assert.match(review.error ?? '', /only a live QA/);
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

test('changed stage plans, reopened items and altered verdict headers cannot retain stage closure', async t => {
  const f = await fixture(t); await f.land(); assert.equal((await f.verdict()).ok, true);
  f.plan.stages[0]!.qa.scope = 'full'; await f.set(); assert.equal((await f.read()).stages?.[0]?.state, 'open');
  assert.equal((await f.verdict('clear', { run: 'full-scope' })).ok, true);
  assert.equal((await f.ui.request({ type: 'task.edit', item: f.items[0]!.id, state: 'open' })).ok, true);
  assert.equal((await f.read()).stages?.[0]?.state, 'open');
  assert.equal((await f.ui.request({ type: 'task.edit', item: f.items[0]!.id, state: 'closed' })).ok, true);
  assert.equal((await f.read()).stages?.[0]?.state, 'closed');
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
  const foreign = await f.ui.request({ type: 'task.create', title: 'Foreign epic', kind: 'epic' });
  assert.equal(foreign.ok, true, foreign.error);
  const other = (foreign.value as { item: ItemView }).item;
  const launched = await f.ui.request({ type: 'session.launch', name: 'lead-one', role: 'lead', item: f.epic.id, harness: 'claude-code' });
  assert.equal(launched.ok, true, launched.error);
  const sessionId = (launched.value as { process: { sessionId: string } }).process.sessionId;
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
