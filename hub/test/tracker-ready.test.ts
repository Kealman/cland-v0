// T2: verifier holds, identity adoption and readiness scheduling at public tracker/frame seams.
import { sessionWsUi as connectWsUi, sessionUi as connectUi } from './session-credential-fixture.ts';
import { sqliteProbe } from './sqlite-probe.ts';
import { FakeClock } from './fake-clock.ts';
import { parseItem, serializeItem } from '../src/tracker/item.ts';
import { onCleanup } from './process-cleanup.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import files, { mkdir, writeFile } from 'node:fs/promises';
import { eventually, inProcessSpoke, projectHub, startHub, tempProject } from './harness.ts';
import { manualTips } from './freshness-harness.ts';
import { join } from 'node:path';
import { Tracker, type ItemView } from '../src/tracker/tracker.ts';
import { agentsRecord } from '../src/hub/agents-topic.ts';
import { fixedRoles } from '../src/roles/config.ts';

test('verifier holds move status beside the Implementer claim, and release on verdict or explicit release', async t => {
  const database = sqliteProbe();
  const root = await tempProject(t);
  const tracker = new Tracker({ git: async () => null, openDatabase: database.open, root, db: join(root, '.cland', 'hub.db') });
  onCleanup(t, () => tracker.stop());
  const hub = await startHub({ tracker, roles: fixedRoles() });
  onCleanup(t, () => hub.close());
  const ui = await connectWsUi(t, hub);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  for (const [session, role] of [['impl', 'implementer'], ['rev', 'reviewer'], ['qa-1', 'qa']] as const) {
    assert.equal((await ui.request({ type: 'role.set', session, role })).ok, true);
  }
  const made = await ui.request({ size: 'M', type: 'task.create', title: 'Verify', assignee: 'impl' });
  const item = (made.value as { item: ItemView }).item;
  assert.equal((await ui.request({ type: 'task.claim', item: item.id, as: { name: 'impl' } })).ok, true);
  const read = async () => (await ui.request({ type: 'task.view', item: item.id })).value as { item: ItemView & { holds: Array<{ session: string; role: string }> } };
  const claim = (await read()).item.claim;
  for (const [name, status] of [['rev', 'review'], ['qa-1', 'qa']] as const) {
    const held = await ui.request({ type: 'task.hold', item: item.id, as: { name } });
    assert.equal(held.ok, true, JSON.stringify(held));
    const view = (await read()).item;
    assert.equal(view.status, status);
    assert.equal(view.assignee, 'impl');
    assert.deepEqual(view.claim, claim);
    assert.equal(view.holds.some(h => h.session === name), true);
    const event = await ui.waitFor(f => f.type === 'task' && (f.item as typeof view | undefined)?.holds?.some(h => h.session === name) === true);
    assert.deepEqual((event.item as typeof view).claim, claim);
  }
  assert.equal((await read()).item.holds.length, 2);
  assert.equal((await ui.request({ type: 'task.comment', item: item.id, verdict: { verdict: 'review', scope: 'full', result: 'not clear', run: 'rev-1' }, as: { name: 'rev' } })).ok, true);
  assert.deepEqual((await read()).item.holds.map(h => h.session), ['qa-1']);
  assert.equal((await ui.request({ type: 'task.hold', item: item.id, release: true, as: { name: 'qa-1' } })).ok, true);
  assert.deepEqual((await read()).item.holds, []);
  assert.deepEqual((await read()).item.claim, claim);
  const denied = await ui.request({ type: 'task.hold', item: item.id, as: { name: 'impl' } });
  assert.equal(denied.ok, false);
});

test('a launched verifier stop releases its hub hold and preserves the Implementer claim', async t => {
  const database = sqliteProbe();
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root, {}, { probes: 'fake', harnesses: 'fake', clock: new FakeClock() });
  const ui = await connectUi(t, discovery!);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  assert.equal((await ui.request({ type: 'role.set', session: 'impl', role: 'implementer' })).ok, true);
  const made = await ui.request({ size: 'M', type: 'task.create', title: 'Stop verifier', assignee: 'impl' });
  const item = (made.value as { item: ItemView }).item;
  assert.equal((await ui.request({ type: 'task.claim', item: item.id, as: { name: 'impl' } })).ok, true);
  const launched = await ui.request({ type: 'session.launch', name: 'rev', role: 'reviewer', harness: 'claude-code' }, 30_000);
  assert.equal(launched.ok, true, launched.error);
  const held = await ui.request({ type: 'task.hold', item: item.id, as: { name: 'rev' } });
  assert.equal(held.ok, true, JSON.stringify(held));
  const read = async () => ((await ui.request({ type: 'task.view', item: item.id })).value as { item: ItemView }).item;
  const claim = (await read()).claim;
  assert.equal((await read()).holds.length, 1);
  assert.equal((await ui.request({ type: 'session.stop', session: 'rev' }, 15_000)).ok, true);
  await eventually('released hold', async () => (await read()).holds.length === 0 ? true : undefined);
  assert.deepEqual((await read()).claim, claim);
  await ui.waitFor(f => f.type === 'task' && (f.item as ItemView | undefined)?.id === item.id && (f.item as ItemView).holds.length === 0 && (f.item as ItemView).status === 'review');
});

for (const pauseAt of ['queue', 'write'] as const) {
  test(`a verifier hold rechecks role after its ${pauseAt} await`, async t => {
    const database = sqliteProbe();
  const root = await tempProject(t);
    let enter!: () => void;
    let release!: () => void;
    const entered = new Promise<void>(done => { enter = done; });
    const released = new Promise<void>(done => { release = done; });
    onCleanup(t, () => release());
    let pause = false;
    const tracker = new Tracker({ git: async () => null, openDatabase: database.open, root, db: join(root, '.cland', 'hub.db'), files: { ...files,
      writeFile: async (...args) => {
        await files.writeFile(...args);
        if (pause) { pause = false; enter(); await released; }
      },
    } });
    onCleanup(t, () => tracker.stop());
    const hub = await startHub({ tracker, roles: fixedRoles() });
    onCleanup(t, () => hub.close());
    const ui = await connectWsUi(t, hub);
    assert.equal((await ui.request({ type: 'role.set', session: 'rev', role: 'reviewer' })).ok, true);
    const made = await ui.request({ size: 'M', type: 'task.create', title: 'Revoked hold' });
    const item = (made.value as { item: ItemView }).item;
    pause = true;
    const earlier = pauseAt === 'queue' ? ui.request({ type: 'task.comment', item: item.id, text: 'Earlier' }) : null;
    if (earlier) await entered;
    const holding = ui.request({ type: 'task.hold', item: item.id, as: { name: 'rev' } });
    if (!earlier) await entered;
    assert.equal((await ui.request({ type: 'role.clear', session: 'rev' })).ok, true);
    release();
    if (earlier) assert.equal((await earlier).ok, true);
    const refused = await holding;
    assert.equal(refused.ok, false);
    const view = ((await ui.request({ type: 'task.view', item: item.id })).value as { item: ItemView }).item;
    assert.equal(view.status, 'backlog');
    assert.deepEqual(view.holds, []);
  });
}

for (const release of ['verdict', 'explicit'] as const) {
  test(`hello adopts a pre-hello verifier hold and claim; ${release} releases that hold`, async t => {
    const database = sqliteProbe();
  const root = await tempProject(t);
    const tracker = new Tracker({ git: async () => null, openDatabase: database.open, root, db: join(root, '.cland', 'hub.db') });
    onCleanup(t, () => tracker.stop());
    const hub = await startHub({ tracker, roles: fixedRoles() });
    onCleanup(t, () => hub.close());
    const ui = await connectWsUi(t, hub);
    assert.equal((await ui.request({ type: 'role.set', session: 'rev', role: 'implementer' })).ok, true);
    const made = await ui.request({ size: 'M', type: 'task.create', title: 'Pre-hello verification', assignee: 'rev' });
    const item = (made.value as { item: ItemView }).item;
    const claimed = await ui.request({ type: 'task.claim', item: item.id, as: { name: 'rev' } });
    assert.equal(claimed.ok, true, JSON.stringify(claimed));
    assert.equal((await ui.request({ type: 'role.set', session: 'rev', role: 'reviewer' })).ok, true);
    assert.equal((await ui.request({ type: 'task.hold', item: item.id, as: { name: 'rev' } })).ok, true);
    const read = async () => ((await ui.request({ type: 'task.view', item: item.id })).value as { item: ItemView }).item;
    const before = await read();
    assert.equal(before.holds[0]?.sessionId, 'name:rev');
    const rev = await inProcessSpoke(t, { hub, name: 'rev', sessionId: 'rev-adopted', role: 'reviewer' });
    onCleanup(t, () => rev.close());
    await rev.waitForPresence(['rev']);
    const adopted = await read();
    assert.equal(adopted.holds[0]?.sessionId, 'rev-adopted');
    assert.equal(adopted.holds[0]?.heldAt, before.holds[0]?.heldAt);
    assert.equal(adopted.claim?.sessionId, 'rev-adopted');
    assert.equal(adopted.claim?.claimedAt, before.claim?.claimedAt);
    const result = release === 'verdict'
      ? await rev.call<{ ok: boolean }>('task.comment', { id: item.id, verdict: 'review', scope: 'full', result: 'not clear', run: 'adopted' })
      : await rev.call<{ ok: boolean }>('task.hold', { id: item.id, release: true });
    assert.equal(result.ok, true);
    assert.deepEqual((await read()).holds, []);
    assert.deepEqual((await read()).claim, adopted.claim);
  });
}

for (const mode of ['timing', 'timing-parented', 'retry'] as const) {
  const timing = mode !== 'retry';
  test(`ready ${timing ? `counts parse, decision and mutation admission as one continuation${mode === 'timing-parented' ? ' with a release parent' : ''}` : 'retries invalidated preparations with bounded backoff'}`, async t => {
    const database = sqliteProbe();
  const root = await tempProject(t);
    const time = new FakeClock();
    const tips = manualTips();
    const records: Array<Record<string, unknown>> = [];
    const agents = agentsRecord();
    let fail = true;
    let clock = 0;
    let slowOpen = false;
    let slowAdmission = false;
    let armRead = false;
    let readyId: string | null = null;
    let disrupt = 0;
    const attempts: number[] = [];
    let releaseWrite: (() => void) | undefined;
    onCleanup(t, () => releaseWrite?.());
    const { RequestGuard } = await import('../src/hub/budget.ts');
    const guard = new RequestGuard({ now: () => clock, log: r => records.push(r) });
    const tracker = new Tracker({ watch: () => ({ close() {} }), git: async args => {
        if (args[0] === "for-each-ref") return `${"a".repeat(40)} refs/heads/dev\n${"b".repeat(40)} refs/heads/t/ready`;
        if (args[0] === "rev-parse") return "b".repeat(40);
        if (args[0] === "merge-base") return "a".repeat(40);
        if (args[0] === "diff") return "reviewed patch";
        if (args[0] === "patch-id") return "stable-patch";
        return null;
      }, clock: time, openDatabase: database.open, root, db: join(root, '.cland', 'hub.db'), scheduleTips: tips.scheduleTips,
      parse: (...args) => {
        const parsed = parseItem(...args);
        if (slowOpen) { slowOpen = false; slowAdmission = true; clock += 200; }
        return parsed;
      },
      watchResumed: guard.resumer('tracker.ready', 'timing'),
      log: agents.tap(entry => { records.push(entry); if (entry.event === 'task-written' && entry.op === 'verdict') armRead = true; }),
      files: { ...files,
        readFile: async (...args) => {
          const text = await files.readFile(...args);
          if (timing && armRead && text.includes('result: clear') && tracker.list().find(row => row.id === readyId)?.verdicts[0]?.current === true) { armRead = false; slowOpen = true; }
          if (disrupt) { disrupt--; return `${text}\n`; }
          return text;
        },
        open: (...args) => {
          if (slowAdmission) { slowAdmission = false; clock += 100; }
          return files.open(...args);
        },
        writeFile: async (path, text) => {
          await files.writeFile(path, text);
          if (mode === 'retry' && fail && text.includes('status: ready\n')) {
            attempts.push(time.now().getTime());
            disrupt = 2;
            if (attempts.length === 1) {
              // An unrelated timer is pending before this write completes and the retry is
              // scheduled. One 50 ms advance must not be mistaken for a completed retry.
              await new Promise<void>(resolve => {
                releaseWrite = resolve;
                time.setTimeout(resolve, 100);
              });
            }
          }
        },
      },
    });
    tracker.start();
    onCleanup(t, () => tracker.stop());
    const hub = await startHub({ tracker, roles: fixedRoles(), clock: time });
    onCleanup(t, () => hub.close());
    agents.attach(hub.core);
    const ui = await connectWsUi(t, hub);
    assert.equal((await ui.request({ type: 'role.set', session: 'rev', role: 'reviewer' })).ok, true);
    const rev = await inProcessSpoke(t, { hub, name: 'rev', role: 'reviewer' });
    onCleanup(t, () => rev.close());
    const made = await ui.request({ size: 'M', type: 'task.create', title: 'Ready continuation' });
    const item = (made.value as { item: ItemView }).item;
    readyId = item.id;
    if (mode === 'timing-parented') {
      const parent = await ui.request({ type: 'task.create', title: 'Release parent', kind: 'release' });
      assert.equal(parent.ok, true, parent.error);
      const release = (parent.value as { item: ItemView }).item;
      const linked = await ui.request({ type: 'task.link', item: item.id, parent: release.id });
      assert.equal(linked.ok, true, linked.error);
    }
    const path = join(root, item.path);
    const document = parseItem(await files.readFile(path, 'utf8'));
    document.fm.branch = 't/ready';
    await writeFile(path, serializeItem(document));
    await tracker.rescanAsync();
    await tips.refresh();
    assert.equal((await rev.call<{ ok: boolean }>('task.comment', { id: item.id, verdict: 'review', scope: 'full', result: 'clear', run: mode })).ok, true);
    if (timing) {
      await eventually('ready', async () => tracker.list().find(row => row.id === readyId)?.status === 'ready' ? true : undefined);
      assert.deepEqual(records.filter(r => r.event === 'slow-request').map(r => [r.tool, r.phase, r.ms]), [['tracker.ready', 'resumed', 300]], JSON.stringify({ clock, slowOpen, slowAdmission, armRead }));
    } else {
      await eventually('first ready attempt', () => attempts.length === 1 || undefined);
      const advanceUntilAttempt = (retry: number) => eventually('ready retry completed', async () => {
        if (attempts.length === retry + 1) return true;
        // Pending timers can belong to other work, and retry scheduling follows async I/O.
        // Keep driving the clock until the attempt itself is observed.
        if (time.pending > 0) await time.advance(Math.min(25 * 2 ** retry, 1000));
        return attempts.length === retry + 1 || undefined;
      });
      for (let i = 1; i < 4; i++) {
        await advanceUntilAttempt(i);
      }
      assert.ok(attempts.length <= 4, `unbounded retries: ${attempts.length}`);
      assert.ok(attempts.every((at, i) => i === 0 || at - attempts[i - 1]! >= 40), 'every retry backs off');
      for (let i = 4; i < 10; i++) {
        await advanceUntilAttempt(i);
      }
      await eventually('retry limit recorded', () => records.some(r => r.event === 'task-ready-paused') || undefined);
      await time.advance(1100); // Beyond the maximum readiness retry backoff.
      assert.equal(attempts.length, 10, 'attempts stop at the limit');
      const history = await ui.request({ type: 'topic.history', topic: 'agents' });
      const messages = (history.value as { messages: Array<{ kind?: string; text: string }> }).messages;
      const paused = messages.filter(m => m.kind === 'ready-paused');
      assert.equal(paused.length, 1);
      assert.match(paused[0]!.text, /T-1.*readiness evidence changed/);
      fail = false;
      assert.equal((await ui.request({ type: 'task.edit', item: item.id, body: 'new item event' })).ok, true);
      await eventually('event restarts ready', async () => tracker.list().find(row => row.id === readyId)?.status === 'ready' ? true : undefined);
    }
  });
}

for (const qaRequired of [false, true]) {
  test(`ready tells the claimant only about changed missing done marks, with per-item QA=${qaRequired}`, async t => {
    const root = await tempProject(t);
    await mkdir(join(root, '.cland'), { recursive: true });
    if (qaRequired) await writeFile(join(root, '.cland/config.toml'), '[plan]\nqa_default = {scope = "affected", when = "per-item"}\n');
    const sha = 'b'.repeat(40);
    const tips = manualTips();
    const options = { clock: new FakeClock(), scheduleTips: tips.scheduleTips,
      git: async (args: string[]) => {
        if (args[0] === 'for-each-ref') return `${'a'.repeat(40)} refs/heads/dev\n${sha} refs/heads/t/ready`;
        if (args[0] === 'rev-parse') return args.at(-1)?.match(/^([0-9a-f]{40})\^/)?.[1] ?? sha;
        if (args[0] === 'merge-base') return 'a'.repeat(40);
        if (args[0] === 'diff') return 'reviewed patch';
        if (args[0] === 'patch-id') return 'stable-patch';
        return null;
      }, readBase: async () => 'dev',
    };
    let hub = await projectHub(t, root, {}, options);
    let ui = await connectUi(t, hub.discovery);
    const impl = await inProcessSpoke(t, { discover: true, cwd: root, name: 'impl', sessionId: 'claimant', role: 'implementer' });
    const rev = await inProcessSpoke(t, { discover: true, cwd: root, name: 'rev', sessionId: 'reviewer', role: 'reviewer' });
    const qa = await inProcessSpoke(t, { discover: true, cwd: root, name: 'qa-1', sessionId: 'qa', role: 'qa' });
    const item = ((await ui.request({ size: 'S', type: 'task.create', title: 'Forgotten done marks', assignee: 'impl', branch: 't/ready',
      body: '## Acceptance criteria\n- [ ] First\n- [ ] Second\n- [ ] Third' })).value as { item: ItemView }).item;
    const topic = ((await ui.request({ type: 'topic.create', item: item.id, title: 'Done marks' })).value as { topic: { id: string } }).topic;
    const claimed = await impl.call<{ ok: boolean; error?: string }>('task.claim', { id: item.id });
    assert.equal(claimed.ok, true, claimed.error);
    const read = async () => ((await ui.request({ type: 'task.view', item: item.id })).value as { item: ItemView }).item;
    const notices = async () => {
      const history = await ui.request({ type: 'topic.history', topic: topic.id });
      return (history.value as { messages: Array<{ text: string; from: string; to: string[]; topic: string }> }).messages
        .filter(m => m.text.includes('ready is waiting only on your done marks'));
    };
    const review = async (run: string, verified: string, commit = sha) => {
      const result = await rev.call<{ ok: boolean; error?: string }>('task.comment', { id: item.id,
        verdict: 'review', scope: 'full', result: 'clear', run, verified, commit });
      assert.equal(result.ok, true, result.error);
      await tips.refresh();
    };
    // A clear source verdict with incomplete current verification must stay silent.
    await review('stale-criteria', 'all', 'c'.repeat(40));
    await review('partial-criteria', 'C1');
    await eventually('old criterion verification is stale', async () => (await read()).criteria[1]?.marks
      .some(m => m.kind === 'verified' && m.current === false) || undefined);
    assert.deepEqual(await notices(), []);
    const delivered = impl.waitForEvent(e => JSON.stringify(e).includes('ready is waiting only on your done marks'));
    await review('all-criteria', 'all');
    if (qaRequired) {
      // Required QA must also be clear before a notice can claim done is the only gap.
      assert.equal((await qa.call<{ ok: boolean }>('task.comment', { id: item.id, verdict: 'qa', result: 'not clear', run: 'qa-red' })).ok, true);
      assert.deepEqual(await notices(), []);
      assert.equal((await qa.call<{ ok: boolean }>('task.comment', { id: item.id, verdict: 'qa', result: 'clear', run: 'qa-green' })).ok, true);
    }
    await eventually('durable claimant notice', async () => {
      await options.clock.advance(100);
      return (await notices()).length === 1 || undefined;
    });
    await delivered;
    const first = await notices();
    assert.equal(first.length, 1);
    assert.equal(first[0]!.from, 'hub');
    assert.deepEqual(first[0]!.to, ['impl']);
    assert.equal(first[0]!.topic, topic.id);
    for (const [id, text] of [['C1', 'First'], ['C2', 'Second'], ['C3', 'Third']]) {
      assert.ok(first[0]!.text.includes(`${id}: ${text}`));
      assert.ok(first[0]!.text.includes(`cland task criterion ${item.id} done ${id}`));
    }
    assert.notEqual((await read()).status, 'ready');
    // A new verdict and a tip refresh recheck the unchanged set, without another notice.
    await review('same-missing-set', 'all');
    assert.equal((await impl.call<{ ok: boolean }>('task.criterion', { id: item.id, op: 'done', criterion: 'C1' })).ok, true);
    await eventually('notice for changed missing set', async () => { await options.clock.advance(100); return (await notices()).length === 2 || undefined; });
    const changed = (await notices()).at(-1)!;
    assert.ok(!changed.text.includes('done C1'));
    assert.ok(changed.text.includes('done C2'));
    assert.ok(changed.text.includes('done C3'));
    // A replacement claimant must learn about the same blocker independently.
    assert.equal((await impl.call<{ ok: boolean }>('task.claim', { id: item.id, release: true })).ok, true);
    assert.equal((await ui.request({ type: 'task.edit', item: item.id, assignee: 'impl-next' })).ok, true);
    const replacement = await inProcessSpoke(t, { discover: true, cwd: root, name: 'impl-next', sessionId: 'replacement-claimant', role: 'implementer' });
    const handedOver = replacement.waitForEvent(e => JSON.stringify(e).includes('ready is waiting only on your done marks'));
    assert.equal((await replacement.call<{ ok: boolean }>('task.claim', { id: item.id })).ok, true);
    await eventually('notice for replacement claimant', async () => {
      await options.clock.advance(100);
      return (await notices()).length === 3 || undefined;
    });
    await handedOver;
    const transferred = (await notices()).at(-1)!;
    assert.deepEqual(transferred.to, ['impl-next']);
    assert.ok(!transferred.text.includes('done C1'));
    assert.ok(transferred.text.includes('done C2'));
    assert.ok(transferred.text.includes('done C3'));
    // Reopen the store in-process; the same missing set must retain its deduplication.
    await impl.close(); await rev.close(); await qa.close(); await replacement.close(); await hub.stop();
    hub = await projectHub(t, root, {}, options);
    await tips.refresh();
    ui = await connectUi(t, hub.discovery);
    const next = await inProcessSpoke(t, { discover: true, cwd: root, name: 'impl-next', sessionId: 'replacement-claimant', role: 'implementer' });
    assert.equal((await next.call<{ ok: boolean }>('task.criterion', { id: item.id, op: 'done', criterion: 'C2' })).ok, true);
    await eventually('notice after restart for remaining criterion', async () => { await options.clock.advance(100); return (await notices()).length === 4 || undefined; });
    const remaining = (await notices()).at(-1)!;
    assert.ok(!remaining.text.includes('done C1'));
    assert.ok(!remaining.text.includes('done C2'));
    assert.ok(remaining.text.includes('done C3'));
    assert.equal((await next.call<{ ok: boolean }>('task.criterion', { id: item.id, op: 'done', criterion: 'C3' })).ok, true);
    await eventually('ready after all done marks', async () => { await options.clock.advance(100); return (await read()).status === 'ready' || undefined; });
    assert.equal((await notices()).length, 4);
    assert.ok((await read()).criteria.every(c => c.marks.some(m => m.kind === 'done')));
  });
}
