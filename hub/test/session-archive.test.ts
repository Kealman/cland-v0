// T2: hub rules use real socket frames, in-process harnesses/spokes and one FakeClock.
import { completeJournalLines } from './journal-lines.ts';
import { FakeClock } from './fake-clock.ts';
import { componentHub } from './subscription-hub.ts';
// Archive through the real hub, a real spoke and the human CLI; fakes sit at the harness boundary.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import files from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { sessionRunDirectory } from '../../shared/session-credential.ts';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { ProcessTable } from '../src/adapters/processes.ts';
import { LaunchRecoveryPending } from '../src/adapters/launch-files.ts';
import { fakeHarness } from './fakes/harness.ts';
import { Sessions } from '../src/adapters/sessions.ts';
import { accountFixtureEnvironment } from './account-fixture-env.ts';
import { onCleanup } from './process-cleanup.ts';
import type { HarnessProcessView } from '../src/protocol.ts';
import { cland, connectUi, eventually, inProcessSpoke, tempProject, startHub, dispatcherUi } from './harness.ts';

type List = { processes: HarnessProcessView[]; archived: number };

test('reopening an item during owned archive removal refreshes eligibility before publication', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[sessions]\narchive_after_item = "2s"\narchive_after_stop = "1d"\n');
  const records: Array<Record<string, unknown>> = [];
  const { discovery, clock } = await componentHub(t, root, {}, { log: entry => records.push(entry) });
  const ui = await connectUi(t, discovery);
  await ui.request({ size: 'M', type: 'task.create', title: 'Reopened during cleanup' });
  const launch = await ui.request({ type: 'session.launch', name: 'worker', role: 'implementer', harness: 'codex', item: 'T-1' });
  assert.equal(launch.ok, true, launch.error);
  const process = (launch.value as { process: HarnessProcessView }).process;
  assert.equal((await ui.request({ type: 'session.stop', session: 'worker' })).ok, true);
  assert.equal((await ui.request({ type: 'task.close', item: 'T-1' })).ok, true);
  const directory = sessionRunDirectory(join(root, '.cland'), process.sessionId);
  const release = Promise.withResolvers<void>();
  let removing = false;
  const remove = files.rm;
  t.mock.method(files, 'rm', async (...args: Parameters<typeof files.rm>) => {
    if (args[0] === directory) { removing = true; await release.promise; }
    return remove(...args);
  });
  syncBuiltinESMExports();
  try {
    await clock.advance(2000);
    await eventually('owned archive removal entered', () => removing || undefined);
    const sweeps = records.filter(entry => entry.event === 'session-archive-sweep').length;
    assert.equal((await ui.request({ type: 'task.edit', item: 'T-1', state: 'open' })).ok, true);
    release.resolve();
    await eventually('archive revalidation completed', () => records.filter(entry => entry.event === 'session-archive-sweep').length > sweeps || undefined);
    assert.equal(((await ui.request({ type: 'session.list', archived: true })).value as List).archived, 0);
    assert.deepEqual(((await ui.request({ type: 'session.list' })).value as List).processes.map(p => p.name), ['worker']);
  } finally { release.resolve(); }
});

for (const equalHeldAt of [false, true]) test(equalHeldAt
  ? 'equal heldAt instants archive Reviewer and QA with the latest held item'
  : 'item windows follow launch items and the latest verifier work even after holds release; reopening cancels the item clock', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland', 'config.toml'), '[sessions]\narchive_after_item = "2s"\narchive_after_stop = "1d"\n');
  const { discovery, clock, fakes } = await componentHub(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  for (const title of ['Implementer item', 'Earlier held item', 'Latest held item', 'Reopened item']) assert.equal((await ui.request({ size: 'M', type: 'task.create', title })).ok, true);
  for (const [name, role, item] of [['impl', 'implementer', 'T-1'], ['rev', 'reviewer', undefined], ['tester', 'qa', undefined], ['reopened', 'implementer', 'T-4']] as const) {

    const launch = await ui.request({ type: 'session.launch', name, role, harness: 'claude-code', ...(item ? { item } : {}) }, 30000);
    assert.equal(launch.ok, true, launch.error);
    const p = (launch.value as { process: HarnessProcessView }).process;
    if (role === 'reviewer' || role === 'qa') {
      const spoke = await inProcessSpoke(t, { discover: true, cwd: root, name, role, sessionId: p.sessionId });
      t.after(() => spoke.close());
      await spoke.waitForPresence([name]);
      const heldAt = clock.now().toISOString();
      for (const id of ['T-2', 'T-3']) {
        if (!equalHeldAt) await clock.advance(1);
        const held = await spoke.call<{ ok: boolean; holds: Array<{ heldAt: string }> }>('task.hold', { id });
        assert.equal(held.ok, true);
        if (equalHeldAt) assert.deepEqual(held.holds.map(hold => hold.heldAt), [heldAt]);
      }
      if (equalHeldAt) assert.equal((await ui.request({ type: 'task.comment', item: 'T-2', text: 'Unrelated edit must not replay the earlier hold' })).ok, true);
      assert.equal((await spoke.call<{ ok: boolean }>('task.hold', { id: 'T-3', release: true })).ok, true);
    }

    assert.equal((await ui.request({ type: 'session.stop', session: name }, 30000)).ok, true);
  }
  for (const id of ['T-1', 'T-3', 'T-4']) {
    const closed = await ui.request({ type: 'task.close', item: id });
    assert.equal(closed.ok, true, closed.error);
  }
  assert.equal((await ui.request({ type: 'task.edit', item: 'T-4', state: 'open' })).ok, true);
  await clock.advance(1000);
  // A later comment must not restart the item close window.
  assert.equal((await ui.request({ type: 'task.comment', item: 'T-3', text: 'Post-close note' })).ok, true);
  await clock.advance(1001);



  const archive = await eventually('launch item and latest held item archive after close', async () => {
    const list = (await ui.request({ type: 'session.list', archived: true })).value as List;
    return list.archived === 3 ? list : undefined;
  });
  assert.deepEqual(archive.processes.map(p => p.name).sort(), ['impl', 'rev', 'tester']);
  assert.deepEqual(((await ui.request({ type: 'session.list' })).value as List).processes.map(p => p.name), ['reopened']);
  const closed = (await ui.request({ type: 'task.view', item: 'T-3' })).value as { item: { holds: unknown[] } };
  assert.deepEqual(closed.item.holds, [], 'stop releases verifier holds');
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const records = completeJournalLines(await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).filter(Boolean).map(line => JSON.parse(line) as Record<string, unknown>);
  assert.deepEqual(records.filter(r => r.event === 'session-archived').map(r => [r.session, r.by, r.rule]).sort(), [['impl', 'rule', 'item'], ['rev', 'rule', 'item'], ['tester', 'rule', 'item']]);
});

test('250 idle session rows settle for ten minutes and archive at their dated threshold', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland', 'config.toml'), '[sessions]\narchive_after_stop = "11m"\n');
  const clock = new FakeClock();
  const table = new ProcessTable(join(root, '.cland', 'hub.db'));
  for (let i = 0; i < 250; i++) table.put({ name: `crew-${i}`, role: null,
    stoppedAt: clock.now().toISOString(), harness: 'codex', model: null, cwd: root,
    pid: null, harnessId: null, sessionId: `crew-id-${i}`, harnessSessionId: null,
    startedAt: clock.now().toISOString(), status: 'stopped' });
  table.close();
  const records: Array<Record<string, unknown>> = [];
  const { discovery } = await componentHub(t, root, {}, { clock, log: entry => records.push(entry) });
  const ui = await connectUi(t, discovery);
  const sweeps = () => records.filter(r => r.event === 'session-archive-sweep');
  assert.equal(sweeps().length, 1, 'startup sweep completed');
  assert.equal(sweeps()[0]!.rows, 250);
  await clock.advance(600_000);
  assert.equal(((await ui.request({ type: 'session.list' })).value as List).processes.length, 250);
  assert.equal(sweeps().length, 1, 'no full scan during ten idle minutes');
  await clock.advance(59_999);
  assert.equal(((await ui.request({ type: 'session.list', archived: true })).value as List).archived, 0);
  await clock.advance(1);
  const archived = await eventually('dated threshold archive receipt', async () => {
    const list = (await ui.request({ type: 'session.list', archived: true })).value as List;
    return list.archived === 250 ? list : undefined;
  });
  assert.equal(archived.processes.length, 250);
  assert.ok(archived.processes.every(p => p.archivedBy === 'rule' && p.archivedAt === clock.now().toISOString()));
  assert.equal(sweeps().length, 2, 'one sweep at the eligibility threshold');
  await clock.advance(600_000);
  assert.equal(((await ui.request({ type: 'session.list', archived: true })).value as List).archived, 250);
  assert.equal(sweeps().length, 2, 'archived rows need no further polling');
});

test('only a changed item close time wakes stopped sessions, and lifecycle stops set a new deadline', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland', 'config.toml'), '[sessions]\narchive_after_item = "2s"\narchive_after_stop = "1d"\n');
  const records: Array<Record<string, unknown>> = [];
  const { discovery, clock } = await componentHub(t, root, {}, { log: entry => records.push(entry) });
  const ui = await connectUi(t, discovery);
  const sweeps = () => records.filter(r => r.event === 'session-archive-sweep').length;
  assert.equal((await ui.request({ size: 'S', type: 'task.create', title: 'Stopped work' })).ok, true);
  const launched = await ui.request({ type: 'session.launch', name: 'worker', role: 'implementer', item: 'T-1', harness: 'codex' });
  assert.equal(launched.ok, true, launched.error);
  assert.equal((await ui.request({ type: 'session.stop', session: 'worker' })).ok, true);
  await clock.advance(0);
  assert.equal(((await ui.request({ type: 'session.list' })).value as List).processes[0]!.status, 'stopped');
  const before = sweeps();
  for (let i = 0; i < 3; i++) {
    assert.equal((await ui.request({ type: 'task.comment', item: 'T-1', text: `Unrelated note ${i}` })).ok, true);
    await clock.advance(15_000);
  }
  assert.equal(sweeps(), before, 'unchanged eligibility does not rescan on item events');
  assert.equal((await ui.request({ type: 'task.close', item: 'T-1' })).ok, true);
  await clock.advance(0);
  const closedSweeps = sweeps();
  assert.equal(closedSweeps, before + 1, 'close schedules the earlier item deadline');
  await clock.advance(1999);
  assert.equal(((await ui.request({ type: 'session.list', archived: true })).value as List).archived, 0);
  await clock.advance(1);
  const archive = await eventually('new item threshold archive receipt', async () => {
    const list = (await ui.request({ type: 'session.list', archived: true })).value as List;
    return list.archived === 1 ? list : undefined;
  });
  assert.equal(archive.processes[0]!.name, 'worker');
  assert.equal(archive.processes[0]!.archivedBy, 'rule');
});

for (const stopWindow of ['1s', '11s']) test(`failed resume cleanup wakes a preserved stopped row with a ${stopWindow} archive deadline`, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland', 'config.toml'), `[sessions]\narchive_after_stop = "${stopWindow}"\n`);
  const clock = new FakeClock();
  const env = await accountFixtureEnvironment();
  const table = new ProcessTable(join(root, '.cland/hub.db'), clock);
  table.put({ name: 'retained', role: null, stoppedAt: clock.now().toISOString(), harness: 'codex', model: null, cwd: root,
    pid: null, harnessId: null, sessionId: 'retained-id', harnessSessionId: 'conversation', startedAt: clock.now().toISOString(), status: 'stopped' });
  const undoFile = join(root, 'deferred-undo');
  const records: Array<Record<string, unknown>> = [];
  let onSweep = () => {};
  // This smaller fixture owns Sessions' native recovery schedule without replacing global I/O timers.
  const hub = await startHub({ clock, env });
  const sessions = new Sessions({ core: hub.core, table, root, env, recoveryClock: clock,
    cleanup: { archiveAfterItemMs: 3600000, archiveAfterStopMs: stopWindow === '1s' ? 1000 : 11000 },
    log: entry => { records.push(entry); if (entry.event === 'session-archive-sweep') onSweep(); } });
  onCleanup(t, async () => { await sessions.close(); table.close(); await hub.close(); });
  const host = sessions.host({ discoveryFile: '', node: '', cli: '', spoke: '' });
  const adapter = fakeHarness('codex', { host, clock });
  // File rollback cannot finish until this scratch file is made available.
  adapter.resume = async process => { throw new LaunchRecoveryPending(process.sessionId,
    { children: [], undo: [{ kind: 'truncate', path: undoFile, size: 0 }] }, () => {}, new Error('deferred resume cleanup')); };
  sessions.register(adapter);
  hub.dispatcher.useSessions(sessions);
  await sessions.sweepArchive();
  const ui = await dispatcherUi(t, hub.dispatcher, root);
  const failed = await ui.request({ type: 'session.resume', session: 'retained', relaunch: true });
  assert.equal(failed.ok, false);
  assert.match(failed.error!, /cleanup is pending/);
  await clock.advance(2000);
  const pending = (await ui.request({ type: 'session.list' })).value as List & { pendingStops: unknown[] };
  assert.equal(pending.pendingStops.length, 1, 'failed cleanup survives normal lifecycle release');
  assert.equal(pending.archived, 0);
  const before = records.filter(r => r.event === 'session-archive-sweep').length;
  let sweepCompleted = false;
  onSweep = () => { sweepCompleted = true; };
  await writeFile(undoFile, 'pending rollback');
  await clock.advance(5000);
  await eventually('durable cleanup settled without an unrelated event', async () => {
    const list = (await ui.request({ type: 'session.list' })).value as List & { pendingStops: unknown[] };
    return list.pendingStops.length === 0 || undefined;
  });
  assert.equal(await readFile(undoFile, 'utf8'), '', 'rollback actually completed');
  await clock.advance(0);
  await eventually('recovery archive sweep completion receipt', () => sweepCompleted || undefined);
  assert.equal(records.filter(r => r.event === 'session-archive-sweep').length, before + 1, 'recovery settlement wakes the archive sweep');
  if (stopWindow === '11s') {
    await clock.advance(3999);
    assert.equal(((await ui.request({ type: 'session.list', archived: true })).value as List).archived, 0);
    await clock.advance(1);
  }
  const archived = await eventually('preserved row archives at the recovery or dated boundary', async () => {
    const list = (await ui.request({ type: 'session.list', archived: true })).value as List;
    return list.archived === 1 ? list : undefined;
  });
  assert.equal(archived.processes[0]!.sessionId, 'retained-id');
  assert.equal(archived.processes[0]!.archivedBy, 'rule');
});

test('configured stop window archives crew at startup and on the timer, never Aides', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland', 'config.toml'), '[sessions]\narchive_after_item = "1s"\narchive_after_stop = "1s"\n');
  const table = new ProcessTable(join(root, '.cland', 'hub.db'));
  const fixtureClock = new FakeClock();
  const old = new Date(fixtureClock.now().getTime() - 86400000).toISOString();
  for (const [name, role, stoppedAt] of [['crew', 'coordinator', old], ['human-aide', 'aide', old], ['legacy', null, null]] as const) {
    table.put({ name, role, stoppedAt, harness: 'claude-code', model: null, cwd: root, pid: null, harnessId: null, sessionId: name + '-id', harnessSessionId: null, startedAt: old, status: 'stopped' });
  }
  table.close();
  const { discovery, clock, fakes } = await componentHub(t, root);
  const ui = await connectUi(t, discovery);
  const initial = (await ui.request({ type: 'session.list' })).value as List;
  assert.equal(initial.archived, 1, 'startup archives due rows');
  assert.ok(initial.processes.find(p => p.name === 'legacy')?.stoppedAt, 'first sweep dates a legacy stop without journal reads');
  for (const [name, role] of [['fallback', 'implementer'], ['stopped-aide', 'aide']] as const) {
    assert.equal((await ui.request({ type: 'session.launch', name, role, harness: 'claude-code' }, 30000)).ok, true);

    assert.equal((await ui.request({ type: 'session.stop', session: name }, 30000)).ok, true);
  }
  await clock.advance(1001);
  const archived = await eventually('configured timer archives legacy crew', async () => {
    const list = (await ui.request({ type: 'session.list', archived: true })).value as List;
    return list.archived === 3 ? list : undefined;
  });
  assert.deepEqual(archived.processes.map(p => p.name).sort(), ['crew', 'fallback', 'legacy']);
  assert.ok(archived.processes.every(p => p.archivedBy === 'rule'));
  await clock.advance(1001);
  assert.deepEqual(((await ui.request({ type: 'session.list' })).value as List).processes.map(p => p.name).sort(), ['human-aide', 'stopped-aide']);
});

test('prune CLI and Coordinator tool delete only old archived records and retain the journal', async t => {
  const root = await tempProject(t);
  const { discovery, clock, fakes } = await componentHub(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  assert.ok((await coord.client.listTools()).tools.some(tool => tool.name === 'session.prune'));
  const impl = await inProcessSpoke(t, { discover: true, cwd: root, name: 'impl', role: 'implementer' });
  t.after(() => impl.close());
  await impl.waitForPresence(['impl']);
  const forbidden = await impl.call<{ ok: boolean; code: string }>('session.prune', { olderThan: '1s' });
  assert.deepEqual([forbidden.ok, forbidden.code], [false, 'forbidden']);
  assert.equal((await ui.request({ size: 'M', type: 'task.create', title: 'Retained item after prune', assignee: 'old' })).ok, true);
  for (const name of ['old', 'keep']) {
    const launch = await ui.request({ type: 'session.launch', name, role: name === 'old' ? 'implementer' : 'aide', harness: 'claude-code' }, 30000);
    assert.equal(launch.ok, true, launch.error);
    if (name === 'old') {
      const p = (launch.value as { process: HarnessProcessView }).process;
      const holder = await inProcessSpoke(t, { discover: true, cwd: root, name, role: 'implementer', sessionId: p.sessionId });
      t.after(() => holder.close());
      await holder.waitForPresence([name]);
      const claim = await holder.call<{ ok: boolean; error?: string }>('task.claim', { id: 'T-1' });
      assert.equal(claim.ok, true, claim.error);
      await holder.close();
    }

    assert.equal((await ui.request({ type: 'session.stop', session: name }, 30000)).ok, true);
  }
  assert.equal((await ui.request({ type: 'session.archive', session: 'old' })).ok, true);
  await clock.advance(1001);
  const dry = await cland(root, 'session', 'prune', '--older-than', '1s', '--dry-run', '--json');
  assert.equal(dry.code, 0, dry.stderr);
  assert.deepEqual(JSON.parse(dry.stdout), { names: ['old'], dryRun: true });
  assert.equal(((await ui.request({ type: 'session.list', archived: true })).value as List).archived, 1);
  const pruned = await coord.call<{ ok: boolean; names: string[]; dryRun: boolean }>('session.prune', { olderThan: '1s' });
  assert.equal(pruned.ok, true);
  assert.deepEqual(pruned.names, ['old']);
  assert.equal(((await ui.request({ type: 'session.list', archived: true })).value as List).archived, 0);
  assert.deepEqual(((await ui.request({ type: 'session.list' })).value as List).processes.map(p => p.name), ['keep']);
  const item = (await ui.request({ type: 'task.view', item: 'T-1' })).value as { item: { title: string; claim: unknown } };
  assert.equal(item.item.title, 'Retained item after prune');
  assert.equal(item.item.claim, null, 'prune removes the session claim without deleting the item');
  assert.equal((await ui.request({ type: 'session.resume', session: 'old' })).ok, false);
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const journal = await cland(root, 'hub', 'journal', '--json');
  assert.equal(journal.code, 0, journal.stderr);
  assert.match(journal.stdout, /session-launched/);
  assert.match(journal.stdout, /old/);
  const records = completeJournalLines(await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).filter(Boolean).map(line => JSON.parse(line) as Record<string, unknown>);
  assert.deepEqual(records.filter(r => r.event === 'sessions-pruned').map(r => r.names), [['old']]);
});

test('prune compares stop age even for recently archived rows, keeps young and unarchived rows, and rejects invalid durations', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const table = new ProcessTable(join(root, '.cland', 'hub.db'));
  const fixtureClock = new FakeClock();
  const now = fixtureClock.now().toISOString(), old = new Date(fixtureClock.now().getTime() - 8 * 86400000).toISOString();
  for (const [name, stoppedAt, archivedAt] of [['old', old, now], ['young', now, now], ['unarchived', old, null]] as const) {
    table.put({ name, stoppedAt, archivedAt, archivedBy: archivedAt ? 'hand' : null, harness: 'claude-code', role: 'aide', model: null, cwd: root, pid: null, harnessId: null, sessionId: name + '-id', harnessSessionId: null, startedAt: old, status: 'stopped' });
  }
  table.close();
  const { discovery, clock, fakes } = await componentHub(t, root);
  const ui = await connectUi(t, discovery);
  for (const olderThan of ['0s', '-1d', '7days', '1.5h', '999999999999999999d']) {
    assert.equal((await ui.request({ type: 'session.prune', olderThan })).ok, false, olderThan);
  }
  const dry = await cland(root, 'session', 'prune', '--older-than', '7d', '--dry-run', '--json');
  assert.equal(dry.code, 0, dry.stderr);
  assert.deepEqual(JSON.parse(dry.stdout), { names: ['old'], dryRun: true });
  const prune = await cland(root, 'session', 'prune', '--older-than', '7d', '--json');
  assert.equal(prune.code, 0, prune.stderr);
  assert.deepEqual(JSON.parse(prune.stdout), { names: ['old'], dryRun: false });
  assert.deepEqual(((await ui.request({ type: 'session.list', archived: true })).value as List).processes.map(p => p.name), ['young']);
  assert.deepEqual(((await ui.request({ type: 'session.list' })).value as List).processes.map(p => p.name), ['unarchived']);
});

test('archive refuses live and unlaunched rows, hides stopped rows, retains their journal, and resume restores them', async t => {
  const root = await tempProject(t);
  const { discovery, clock, fakes } = await componentHub(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  assert.ok((await coord.client.listTools()).tools.some(tool => tool.name === 'session.archive'));
  const impl = await inProcessSpoke(t, { discover: true, cwd: root, name: 'impl', role: 'implementer' });
  t.after(() => impl.close());
  await impl.waitForPresence(['impl']);
  const forbidden = await impl.call<{ ok: boolean; code: string }>('session.archive', { session: 'old' });
  assert.equal(forbidden.ok, false);
  assert.equal(forbidden.code, 'forbidden');
  const unlaunched = await ui.request({ type: 'session.archive', session: 'impl' });
  assert.equal(unlaunched.ok, false);
  assert.match(unlaunched.error!, /no session.*was launched/);
  const launched = await ui.request({ type: 'session.launch', name: 'old', role: 'aide', harness: 'claude-code' }, 30_000);
  assert.equal(launched.ok, true, launched.error);
  const before = (launched.value as { process: HarnessProcessView }).process;
  assert.match(fakes['claude-code']!.spawns.at(-1)!.clause!, /you hold the role Aide/);
  const live = await ui.request({ type: 'session.archive', session: 'old' });
  assert.equal(live.ok, false);
  assert.match(live.error!, /stop it first/);
  const stopped = await ui.request({ type: 'session.stop', session: 'old' }, 30_000);
  assert.equal(stopped.ok, true, stopped.error);
  assert.ok((stopped.value as { process: HarnessProcessView }).process.stoppedAt);
  // A pin cannot put an explicitly archived row back in a live group.
  assert.equal((await ui.request({ type: 'visibility.set', surface: 'sessions', target: 'old', mode: 'pin' })).ok, true);
  const archived = await coord.call<{ ok: boolean; error?: string; process: HarnessProcessView }>('session.archive', { session: 'old' });
  assert.equal(archived.ok, true, archived.error);
  assert.equal(archived.process.archived, true);
  assert.equal(archived.process.layer, 'archive');
  assert.equal(archived.process.archivedBy, 'hand');
  const event = await ui.waitFor(f => f.type === 'session.process' && (f.process as HarnessProcessView).archived === true);
  assert.equal((event.process as HarnessProcessView).name, 'old');
  const list = (await ui.request({ type: 'session.list' })).value as List;
  assert.deepEqual(list.processes, []);
  assert.equal(list.archived, 1);
  assert.deepEqual(((await ui.request({ type: 'session.list', archived: true })).value as List).processes.map(p => p.name), ['old']);
  for (const archived of [false, true]) {
    const result = await cland(root, 'session', 'list', '--json', ...(archived ? ['--archived'] : []));
    assert.equal(result.code, 0, result.stderr);
    const rows = JSON.parse(result.stdout) as List;
    assert.equal(rows.archived, 1);
    assert.deepEqual(rows.processes.map(p => p.name), archived ? ['old'] : []);
  }
  const text = await cland(root, 'session', 'list', '--archived');
  assert.equal(text.code, 0, text.stderr);
  assert.match(text.stdout, /old \[Aide\]/);
  // Repeating the human CLI archive is idempotent and does not erase earlier lifecycle records.
  const repeat = await cland(root, 'session', 'archive', 'old', '--json');
  assert.equal(repeat.code, 0, repeat.stderr);
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const journal = completeJournalLines(await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).filter(Boolean).map(line => JSON.parse(line) as Record<string, unknown>);
  for (const event of ['session-launched', 'session-stopped', 'session-archived']) assert.ok(journal.some(e => e.event === event && e.session === 'old'), event);
  const mark = journal.filter(e => e.event === 'session-archived' && e.session === 'old');
  assert.equal(mark.length, 1);
  assert.deepEqual([mark[0]!.sessionId, mark[0]!.by, mark[0]!.actor], [before.sessionId, 'hand', 'coord']);
  const resumed = await ui.request({ type: 'session.resume', session: 'old', relaunch: true }, 30_000);
  assert.equal(resumed.ok, true, resumed.error);
  const after = resumed.value as { found: boolean; process: HarnessProcessView };
  assert.equal(after.found, true);
  assert.equal(after.process.archived, false);
  assert.equal(after.process.archivedAt, null);
  assert.equal(after.process.stoppedAt, null);
  assert.equal(after.process.sessionId, before.sessionId);
  assert.deepEqual(((await ui.request({ type: 'session.list' })).value as List).processes.map(p => p.name), ['old']);
  assert.deepEqual(((await ui.request({ type: 'session.list', archived: true })).value as List).processes, []);
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  assert.match(await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8'), /"event":"session-unarchived"/);
});

test('migration retains old stopped rows without reading the journal, and name reuse clears archive metadata', async t => {
  const root = await tempProject(t);
  const path = join(root, 'old.db');
  const db = new DatabaseSync(path);
  db.exec(`create table harness_processes (name text primary key, harness text not null, role text, model text, cwd text not null, pid integer, harness_id text, session_id text not null, started_at text not null, status text not null);
    insert into harness_processes values ('old', 'claude-code', 'aide', null, '.', null, null, 'old-id', '2026-01-01T00:00:00Z', 'stopped');`);
  db.close();
  const table = new ProcessTable(path);
  t.after(() => table.close());
  const row = table.get('old')!;
  assert.equal(row.sessionId, 'old-id');
  assert.equal(row.stoppedAt, null);
  assert.equal(row.usage, null, 'a row written before the usage column stays valid without totals');
  table.update('old', { archivedAt: '2026-10-13T00:00:00Z', archivedBy: 'rule' });
  assert.equal(table.get('old')!.archivedBy, 'rule');
  table.put({ ...row, sessionId: 'new-id', status: 'running' });
  assert.equal(table.get('old')!.archivedAt, null);
  assert.equal(table.get('old')!.archivedBy, null);
});

for (const by of ['hand', 'rule'] as const) test(`fresh resume clears a durable ${by} archive after a refused native resume`, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const table = new ProcessTable(join(root, '.cland', 'hub.db'));
  table.put({ name: 'old', harness: 'codex', role: 'aide', model: 'gpt-fake-1', cwd: root, pid: null, harnessId: null, sessionId: 'old-id', harnessSessionId: null, startedAt: '2026-01-01T00:00:00Z', status: 'exited', stoppedAt: '2026-01-02T00:00:00Z', archivedAt: '2026-01-03T00:00:00Z', archivedBy: by, launchBrief: 'Continue this archived work.' });
  table.close();
  const { discovery, clock, fakes } = await componentHub(t, root);
  const ui = await connectUi(t, discovery);
  const before = (await ui.request({ type: 'session.list', archived: true })).value as List;
  assert.equal(before.processes[0]!.archivedBy, by, 'restart retains the archive metadata');
  fakes.codex!.scriptResume('old', 'gone');
  const failed = await ui.request({ type: 'session.resume', session: 'old', relaunch: true });
  assert.equal(failed.ok, true, failed.error);
  const offer = failed.value as { found: boolean; process: HarnessProcessView; fresh: { brief: string } };
  assert.equal(offer.found, false);
  assert.equal(offer.process.archived, true, 'a failed resume retains the mark');
  assert.equal(offer.fresh.brief, 'Continue this archived work.');
  const fresh = await cland(root, 'session', 'resume', 'old', '--fresh', '--json');
  assert.equal(fresh.code, 0, fresh.stderr);
  const after = JSON.parse(fresh.stdout) as { found: boolean; process: HarnessProcessView };
  assert.equal(after.found, true);
  assert.equal(after.process.archived, false);
  assert.equal(after.process.sessionId, 'old-id');
  assert.deepEqual(((await ui.request({ type: 'session.list', archived: true })).value as List).processes, []);
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const journal = completeJournalLines(await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).filter(Boolean).map(line => JSON.parse(line) as Record<string, unknown>);
  const unarchived = journal.find(e => e.event === 'session-unarchived');
  assert.equal(unarchived?.by, by);
});
