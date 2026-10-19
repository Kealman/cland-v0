// T2: merge rule failures, verdict permissions and request accounting with injected Git and FakeClock.
import { beforeDirectories, onCleanup } from './process-cleanup.ts';
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { until, startHub } from './harness.ts';
import { componentProject, human } from './merge-component-support.ts';
import { RequestGuard } from '../src/hub/budget.ts';
import type { ItemView } from '../src/tracker/tracker.ts';
import { review } from './merge-support.ts';

test('injected merge freshness fan-out is measured as a resumed 400 ms stretch', async (t) => {
  const f = await componentProject(t);
  const { tracker, ui, rev, records, facts, clock, merges } = f;
  const work = await f.ticket();
  await review(rev, work.id);
  const created = await ui.request({ size: 'M', type: 'task.create', title: 'A branch that will appear', branch: 't/later' });
  assert.equal(created.ok, true, created.error);
  const id = (created.value as { item: { id: string } }).item.id;
  const tip = facts.heads.get(work.branch!)!;
  assert.equal((await rev.call<{ ok: boolean }>('task.comment', { id, verdict: 'review', scope: 'full', result: 'clear', run: 'later', commit: tip })).ok, true);
  await until(async () => {
    await tracker.refreshFreshness();
    return tracker.view(id).verdicts[0]?.current === false;
  }, { what: 'missing branch settled stale' });
  // The manual tip scheduler has no background poke to drain.
  await tracker.refreshFreshness();
  facts.heads.set('t/later', tip);
  // A real task-event subscriber is a public boundary; only the guard clock is synthetic.
  tracker.onChange(change => { if (change.id === id) clock.block(400); });
  const guard = new RequestGuard({ now: () => clock.now().getTime(), log: r => records.push(r) });
  const response = await guard.measure('merge', 'human', () => merges.merge(work.id, human, guard.resumer('merge', 'human')));
  assert.ok('commit' in response);
  assert.ok(records.some(r => r.event === 'slow-request' && r.tool === 'merge' && r.phase === 'resumed' && Number(r.ms) >= 400), JSON.stringify(records));
});


test('in-process verdict writes use the role held after injected Git resolves', async (t) => {
  for (const role of ['implementer', 'coordinator']) await t.test(role, async t => {
    let reached = false;
    const release = Promise.withResolvers<void>();
    let paused = false;
    const f = await componentProject(t, { git: real => async (args, input) => {
      if (paused && args[0] === 'rev-parse') { reached = true; await release.promise; }
      return real(args, input);
    } });
    const { tracker, ui, rev, facts, merges } = f;
    const work = await f.ticket();
    paused = true;
    const writing = rev.call<{ ok: boolean; code?: string; error?: string }>('task.comment', { id: work.id, verdict: 'review', scope: 'full', result: 'clear', run: 'role-await' });
    try {
      await until(() => reached, { what: 'verdict commit lookup paused' });
      assert.equal((await ui.request({ type: 'role.set', session: 'rev', role })).ok, true);
    } finally { release.resolve(); }
    const result = await writing;
    if (role === 'implementer') {
      assert.equal(result.ok, false, JSON.stringify(result));
      assert.equal(result.code, 'forbidden');
      const refs = [...facts.heads];
      await assert.rejects(merges.merge(work.id, human, work => work()), /review-missing/);
      assert.deepEqual([...facts.heads], refs, 'a gate refusal moves no ref');
    } else {
      assert.equal(result.ok, true, result.error);
      const verdict = tracker.view(work.id).verdicts[0];
      assert.equal(verdict?.writer?.role, 'coordinator');
      assert.equal(verdict?.by, 'rev [coordinator]');
      const refs = [...facts.heads];
      await assert.rejects(merges.merge(work.id, human, work => work()), /review-role/);
      assert.deepEqual([...facts.heads], refs, 'a gate refusal moves no ref');
    }
  });
});


test('in-process release and topic closure failures retry only remaining merge steps', async (t) => {
  for (const step of ['release', 'topic close']) {
    await t.test(step, async t => {
      const f = await componentProject(t);
      const { root, tracker, ui, rev, facts, merges } = f;
      const work = await f.ticket();
      await review(rev, work.id);
      const before = facts.landings.length;
      const topic = await ui.request({ type: 'topic.create', title: 'Follow-ups', item: work.id });
      assert.equal(topic.ok, true, topic.error);
      let repair: () => void | Promise<void> = () => {};
      if (step === 'release') {
        const db = new DatabaseSync(join(root, '.cland', 'hub.db'));
        onCleanup(t, () => db.close());
        db.exec("create trigger fail_release before delete on tracker_claims begin select raise(abort, 'release failure'); end");
        repair = () => db.exec('drop trigger fail_release');
      } else if (step === 'topic close') {
        const db = new DatabaseSync(join(root, '.cland', 'hub.db'));
        onCleanup(t, () => db.close());
        db.exec("create trigger fail_topic before update of status on topics when old.item = 'T-1' begin select raise(abort, 'topic closure failure'); end");
        repair = () => db.exec('drop trigger fail_topic');
      }
      const first = await merges.merge(work.id, human, work => work()) as { commit: string; followUp?: { step: string; error: string } };
      assert.equal(first.followUp?.step, step);
      assert.ok(first.followUp?.error.includes('merged, follow-up failed:'));
      assert.equal(facts.heads.get('dev'), first.commit);
      assert.equal(tracker.view(work.id).state, 'closed');
      await repair();
      const done = await merges.merge(work.id, human, work => work()) as { commit: string; followUp?: unknown };
      assert.equal(done.commit, first.commit);
      assert.equal(done.followUp, undefined);
      assert.equal(facts.landings.length - before, 1);
      assert.equal(tracker.view(work.id).claim, null);
      assert.equal(facts.worktrees.has(work.id), false, 'successful retry removes the worktree');
      assert.equal(facts.heads.has(work.branch!), false, 'successful retry removes the task branch');
      const history = await ui.request({ type: 'topic.history', topic: (topic.value as { topic: { id: string } }).topic.id });
      assert.equal((history.value as { topic: { status: string } }).topic.status, 'closed');
    });
  }
});

test('injected merge logging failures retain the landed commit and retry only follow-ups', async (t) => {
  let failing = true;
  const f = await componentProject(t, { sink: entry => {
    if (failing && ['task-merged', 'merge-follow-up-failed'].includes(String(entry.event))) throw new Error('record sink unavailable');
  } });
  const { rev, facts, merges } = f;
  const work = await f.ticket();
  await review(rev, work.id);
  const before = facts.landings.length;
  const result = await merges.merge(work.id, human, work => work()) as { commit: string; followUp?: { step: string } };
  assert.equal(result.followUp?.step, 'record');
  assert.equal(facts.heads.get('dev'), result.commit);
  failing = false;
  const retry = await merges.merge(work.id, human, work => work()) as { commit: string };
  assert.equal(retry.commit, result.commit);
  assert.equal(facts.landings.length - before, 1);
});

// Drive the real registered teardown before its owned directory cleanup, including partial acquisition.
test('component fixture drains startup and close failures before removing its root', async t => {
  for (const failure of ['startup', 'close'] as const) await t.test(failure, async t => {
    const hooks: Array<() => Promise<void>> = [];
    const fixtureContext = { signal: t.signal, after: (hook: () => Promise<void>) => hooks.push(hook) } as unknown as TestContext;
    let acquired: Parameters<typeof startHub>[0] | undefined;
    let root = '', closeCalls = 0;
    const starting = componentProject(fixtureContext, { start: async options => {
      assert.ok(options);
      acquired = options;
      root = options.tracker!.root;
      if (failure === 'startup') throw new Error('controlled startup failure');
      const hub = await startHub(options);
      const close = hub.close;
      hub.close = async () => { await close(); if (++closeCalls === 1) throw new Error('controlled close failure'); };
      return hub;
    } });
    let fixture: Awaited<ReturnType<typeof componentProject>> | undefined;
    if (failure === 'startup') await assert.rejects(starting, /controlled startup failure/);
    else {
      fixture = await starting;
      await assert.rejects(fixture.stop(), /controlled close failure/);
    }
    let inspected = false;
    beforeDirectories(fixtureContext, async () => {
      try {
        assert.ok(existsSync(root), 'root remains until writers are observed stopped');
        assert.throws(() => acquired!.tracker!.list(), /not open/, 'tracker database is closed before root removal');
        assert.throws(() => acquired!.store!.mergeQueue(), /not open/, 'hub store is closed before root removal');
        inspected = true;
      } finally {
        // Red runs still stop leaked writers before the directory cleanup runs.
        await acquired!.tracker!.stop();
        try { acquired!.store!.mergeQueue(); acquired!.store!.close(); } catch { /* already closed */ }
      }
    });
    for (const hook of hooks) await hook();
    assert.equal(inspected, true);
    assert.equal(existsSync(root), false);
    if (failure === 'close') assert.equal(closeCalls, 2, 'failed hub close is retried');
  });
});

test('component fixture drains cancelled socket startup before removing its root', async t => {
  const hooks: Array<() => Promise<void>> = [], controller = new AbortController();
  const fixtureContext = { signal: controller.signal, after: (hook: () => Promise<void>) => hooks.push(hook) } as unknown as TestContext;
  const release = Promise.withResolvers<void>();
  let acquired: Parameters<typeof startHub>[0] | undefined, entered = false, inspected = false;
  const starting = componentProject(fixtureContext, { start: async options => {
    assert.ok(options);
    acquired = options;
    const hub = await startHub(options);
    entered = true;
    await release.promise;
    return hub;
  } });
  const cancelled = assert.rejects(starting, /controlled cancellation/);
  onCleanup(t, async () => { release.resolve(); await cancelled; for (const hook of hooks) await hook(); });
  await until(() => entered, { what: 'socket acquired but startup return held' });
  const root = acquired!.tracker!.root;
  beforeDirectories(fixtureContext, () => {
    assert.ok(existsSync(root), 'drain inspection precedes root removal');
    assert.throws(() => acquired!.tracker!.list(), /not open/);
    assert.throws(() => acquired!.store!.mergeQueue(), /not open/);
    inspected = true;
  });
  controller.abort(new Error('controlled cancellation'));
  const cleaning = hooks[0]!();
  // Cleanup must await the pending socket acquisition before touching its lower resources/root.
  await Promise.resolve();
  assert.equal(inspected, false);
  assert.ok(existsSync(root));
  release.resolve();
  await cancelled;
  await cleaning;
  assert.equal(inspected, true);
  assert.equal(existsSync(root), false);
});
