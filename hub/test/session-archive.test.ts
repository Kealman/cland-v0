// Archive through the real hub, a real spoke and the human CLI; fakes sit at the harness boundary.
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ProcessTable } from '../src/adapters/processes.ts';
import type { HarnessProcessView } from '../src/protocol.ts';
import { cland, connectUi, fakeClaude, fakeCodex, spawnSpoke, startDaemon, tempProject, eventually } from './harness.ts';
import { preparedProject } from './prepared-project.ts';

type List = { processes: HarnessProcessView[]; archived: number };

test('a real task merge starts the stopped Implementer item window', async t => {
  const root = await preparedProject(t);
  await writeFile(join(root, '.cland', 'config.toml'), '[sessions]\narchive_after_item = "1s"\narchive_after_stop = "1d"\n');
  execFileSync('git', ['add', '.cland/config.toml'], { cwd: root });
  execFileSync('git', ['commit', '-qm', 'Configure cleanup fixture'], { cwd: root });
  const fake = await fakeClaude(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const pushed = await cland(root, 'push');
  assert.equal(pushed.code, 0, pushed.stderr);
  assert.equal((await ui.request({ size: 'M', type: 'task.create', title: 'Archive after landing' })).ok, true);
  const launch = await ui.request({ type: 'session.launch', name: 'impl-merge', role: 'implementer', harness: 'claude-code', item: 'T-1' }, 30000);
  assert.equal(launch.ok, true, launch.error);
  const p = (launch.value as { process: HarnessProcessView }).process;
  await writeFile(join(p.cwd, 'README.md'), 'implemented\n');
  execFileSync('git', ['add', 'README.md'], { cwd: p.cwd });
  execFileSync('git', ['commit', '-qm', 'Implement fixture work'], { cwd: p.cwd });
  assert.equal((await ui.request({ type: 'session.stop', session: p.name }, 30000)).ok, true);
  const merged = await cland(root, 'merge', 'T-1', '--override', 'Exercise archive after a real merge', '--json');
  assert.equal(merged.code, 0, merged.stderr);
  assert.equal((JSON.parse(merged.stdout) as { item: string }).item, 'T-1');
  const archived = await eventually('merged Implementer archives on item window', async () => {
    const list = (await ui.request({ type: 'session.list', archived: true })).value as List;
    return list.processes.find(row => row.name === p.name);
  });
  assert.equal(archived.archivedBy, 'rule');
});

test('item windows follow launch items and the latest verifier work even after holds release; reopening cancels the item clock', async t => {
  const root = await preparedProject(t);
  await writeFile(join(root, '.cland', 'config.toml'), '[sessions]\narchive_after_item = "2s"\narchive_after_stop = "1d"\n');
  const fake = await fakeClaude(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  for (const title of ['Implementer item', 'Earlier held item', 'Latest held item', 'Reopened item']) assert.equal((await ui.request({ size: 'M', type: 'task.create', title })).ok, true);
  for (const [name, role, item] of [['impl', 'implementer', 'T-1'], ['rev', 'reviewer', undefined], ['tester', 'qa', undefined], ['reopened', 'implementer', 'T-4']] as const) {
    const launch = await ui.request({ type: 'session.launch', name, role, harness: 'claude-code', ...(item ? { item } : {}) }, 30000);
    assert.equal(launch.ok, true, launch.error);
    const p = (launch.value as { process: HarnessProcessView }).process;
    if (role === 'reviewer' || role === 'qa') {
      // Wait for the native MCP spoke before connecting the observer.
      await ui.waitFor(f => f.type === 'session.usage' && f.sessionId === p.sessionId);
      const spoke = await spawnSpoke({ discover: true, cwd: root, name, role, sessionId: p.sessionId });
      t.after(() => spoke.close());
      await spoke.waitForPresence([name]);
      for (const id of ['T-2', 'T-3']) assert.equal((await spoke.call<{ ok: boolean }>('task.hold', { id })).ok, true);
      assert.equal((await spoke.call<{ ok: boolean }>('task.hold', { id: 'T-3', release: true })).ok, true);
    }
    assert.equal((await ui.request({ type: 'session.stop', session: name }, 30000)).ok, true);
  }
  for (const id of ['T-1', 'T-3', 'T-4']) {
    const closed = await ui.request({ type: 'task.close', item: id });
    assert.equal(closed.ok, true, closed.error);
  }
  assert.equal((await ui.request({ type: 'task.edit', item: 'T-4', state: 'open' })).ok, true);
  // A later comment must not restart the item close window.
  assert.equal((await ui.request({ type: 'task.comment', item: 'T-3', text: 'Post-close note' })).ok, true);
  const archive = await eventually('launch item and latest held item archive after close', async () => {
    const list = (await ui.request({ type: 'session.list', archived: true })).value as List;
    return list.archived === 3 ? list : undefined;
  });
  assert.deepEqual(archive.processes.map(p => p.name).sort(), ['impl', 'rev', 'tester']);
  assert.deepEqual(((await ui.request({ type: 'session.list' })).value as List).processes.map(p => p.name), ['reopened']);
  const closed = (await ui.request({ type: 'task.view', item: 'T-3' })).value as { item: { holds: unknown[] } };
  assert.deepEqual(closed.item.holds, [], 'stop releases verifier holds');
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const records = (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line) as Record<string, unknown>);
  assert.deepEqual(records.filter(r => r.event === 'session-archived').map(r => [r.session, r.by, r.rule]).sort(), [['impl', 'rule', 'item'], ['rev', 'rule', 'item'], ['tester', 'rule', 'item']]);
});

test('configured stop window archives crew at startup and on the timer, never Aides', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland', 'config.toml'), '[sessions]\narchive_after_item = "1s"\narchive_after_stop = "1s"\n');
  const table = new ProcessTable(join(root, '.cland', 'hub.db'));
  const old = new Date(Date.now() - 86400000).toISOString();
  for (const [name, role, stoppedAt] of [['crew', 'coordinator', old], ['human-aide', 'aide', old], ['legacy', null, null]] as const) {
    table.put({ name, role, stoppedAt, harness: 'claude-code', model: null, cwd: root, pid: null, harnessId: null, sessionId: name + '-id', harnessSessionId: null, startedAt: old, status: 'stopped' });
  }
  table.close();
  const fake = await fakeClaude(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const initial = (await ui.request({ type: 'session.list' })).value as List;
  assert.equal(initial.archived, 1, 'startup archives due rows');
  assert.ok(initial.processes.find(p => p.name === 'legacy')?.stoppedAt, 'first sweep dates a legacy stop without journal reads');
  for (const [name, role] of [['fallback', 'implementer'], ['stopped-aide', 'aide']] as const) {
    assert.equal((await ui.request({ type: 'session.launch', name, role, harness: 'claude-code' }, 30000)).ok, true);
    assert.equal((await ui.request({ type: 'session.stop', session: name }, 30000)).ok, true);
  }
  const archived = await eventually('configured timer archives legacy crew', async () => {
    const list = (await ui.request({ type: 'session.list', archived: true })).value as List;
    return list.archived === 3 ? list : undefined;
  });
  assert.deepEqual(archived.processes.map(p => p.name).sort(), ['crew', 'fallback', 'legacy']);
  assert.ok(archived.processes.every(p => p.archivedBy === 'rule'));
  await eventually('Aide stop window elapses without archiving', async () => {
    const list = (await ui.request({ type: 'session.list' })).value as List;
    const aide = list.processes.find(p => p.name === 'stopped-aide');
    return aide && Date.now() - Date.parse(aide.stoppedAt!) > 1000 || undefined;
  });
  assert.deepEqual(((await ui.request({ type: 'session.list' })).value as List).processes.map(p => p.name).sort(), ['human-aide', 'stopped-aide']);
});

test('prune CLI and Coordinator tool delete only old archived records and retain the journal', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  assert.ok((await coord.client.listTools()).tools.some(tool => tool.name === 'session.prune'));
  const impl = await spawnSpoke({ discover: true, cwd: root, name: 'impl', role: 'implementer' });
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
      // Wait for the native MCP spoke before connecting the observer.
      await ui.waitFor(f => f.type === 'session.usage' && f.sessionId === p.sessionId);
      const holder = await spawnSpoke({ discover: true, cwd: root, name, role: 'implementer', sessionId: p.sessionId });
      t.after(() => holder.close());
      await holder.waitForPresence([name]);
      const claim = await holder.call<{ ok: boolean; error?: string }>('task.claim', { id: 'T-1' });
      assert.equal(claim.ok, true, claim.error);
      await holder.close();
    }
    assert.equal((await ui.request({ type: 'session.stop', session: name }, 30000)).ok, true);
  }
  assert.equal((await ui.request({ type: 'session.archive', session: 'old' })).ok, true);
  await eventually('old stop exceeds prune duration', async () => {
    const list = (await ui.request({ type: 'session.list', archived: true })).value as List;
    return Date.now() - Date.parse(list.processes[0]!.stoppedAt!) > 1000 || undefined;
  });
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
  const records = (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line) as Record<string, unknown>);
  assert.deepEqual(records.filter(r => r.event === 'sessions-pruned').map(r => r.names), [['old']]);
});

test('prune compares stop age even for recently archived rows, keeps young and unarchived rows, and rejects invalid durations', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const table = new ProcessTable(join(root, '.cland', 'hub.db'));
  const now = new Date().toISOString(), old = new Date(Date.now() - 8 * 86400000).toISOString();
  for (const [name, stoppedAt, archivedAt] of [['old', old, now], ['young', now, now], ['unarchived', old, null]] as const) {
    table.put({ name, stoppedAt, archivedAt, archivedBy: archivedAt ? 'hand' : null, harness: 'claude-code', role: 'aide', model: null, cwd: root, pid: null, harnessId: null, sessionId: name + '-id', harnessSessionId: null, startedAt: old, status: 'stopped' });
  }
  table.close();
  const { discovery } = await startDaemon(t, root);
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
  const fake = await fakeClaude(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  assert.ok((await coord.client.listTools()).tools.some(tool => tool.name === 'session.archive'));
  const impl = await spawnSpoke({ discover: true, cwd: root, name: 'impl', role: 'implementer' });
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
  await eventually('Aide receives its role clause', async () => (await fake.log(before.harnessId!)).includes('you hold the role Aide') || undefined);
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
  const journal = (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line) as Record<string, unknown>);
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
  const fake = await fakeCodex(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const before = (await ui.request({ type: 'session.list', archived: true })).value as List;
  assert.equal(before.processes[0]!.archivedBy, by, 'restart retains the archive metadata');
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
  const journal = (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line) as Record<string, unknown>);
  const unarchived = journal.find(e => e.event === 'session-unarchived');
  assert.equal(unarchived?.by, by);
});
