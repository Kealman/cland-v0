// T2: launch attribution at authenticated dispatch, persisted process and journal seams.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { projectHub, tempProject, dispatcherUi, inProcessSpoke, cland } from './harness.ts';
import type { HarnessProcessView } from '../src/protocol.ts';
import { lifecycleNotice } from '../src/hub/agents-topic.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { withFixtureStore } from './fixture-store.ts';
import { onCleanup } from './process-cleanup.ts';

test('Agents start lines name the recorded launching user and accept legacy records', () => {
  assert.equal(lifecycleNotice({ event: 'session-launched', session: 'worker', harness: 'codex', userId: 'alex-id', userDisplayName: 'Alex Smith' }, name => name)?.text, 'worker started (codex) by Alex Smith');
  assert.equal(lifecycleNotice({ event: 'session-launched', session: 'worker', harness: 'codex' }, name => name)?.text, 'worker started (codex)');
});

test('hub restart reads pre-attribution process and journal fixtures without a user', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const db = new DatabaseSync(join(root, '.cland/hub.db'));
  try {
    db.exec(`create table harness_processes (name text primary key, harness text, role text, model text, cwd text, pid integer, harness_id text, session_id text, harness_session_id text, started_at text, status text);
      insert into harness_processes values ('legacy-worker','codex',null,null,'/tmp',null,null,'legacy-id',null,'2026-01-01T00:00:00Z','stopped');`);
  } finally { db.close(); }
  await writeFile(join(root, '.cland/journal.jsonl'), JSON.stringify({ event: 'session-launched', session: 'legacy-worker', harness: 'codex', agentsNotice: 'legacy-notice', ts: new Date().toISOString() }) + '\n');
  const first = await projectHub(t, root);
  const ui = await dispatcherUi(t, first.dispatcher, root);
  const before = await ui.request({ type: 'session.list' });
  assert.equal(before.ok, true, before.error);
  await ui.close();
  await first.stop();
  const restarted = await projectHub(t, root);
  const next = await dispatcherUi(t, restarted.dispatcher, root);
  const listed = await next.request({ type: 'session.list' });
  const row = (listed.value as { processes: Array<HarnessProcessView & { userId?: string }> }).processes.find(p => p.name === 'legacy-worker');
  assert.ok(row);
  assert.equal(row.userId, undefined);
  assert.equal((row as { userDisplayName?: string }).userDisplayName, undefined);
  const history = await next.request({ type: 'topic.history', topic: 'agents' });
  const notice = (history.value as { messages: Array<{ id: string; text: string }> }).messages.find(m => m.id === 'legacy-notice');
  assert.equal(notice?.text, 'legacy-worker started (codex)');
});

for (const users of [false, true]) test(`launch attribution follows authenticated humans in ${users ? 'users' : 'single'} mode`, async t => {
  const root = await tempProject(t);
  const journal: Record<string, unknown>[] = [];
  const hub = await projectHub(t, root, {}, { log: row => journal.push(row) });
  const local = await dispatcherUi(t, hub.dispatcher, root);
  const db = new DatabaseSync(join(root, '.cland/hub.db'));
  try {
    db.prepare('insert into users values (?,?,?,?,?,?)').run('jane-id', 'jane', 'Jane', 'admin', 'active', 1);
    db.prepare('insert into users values (?,?,?,?,?,?)').run('alex-id', 'alex', 'Alex Smith', 'admin', 'active', 2);
    if (users) db.exec("insert into auth_state values (1,'users',1) on conflict(singleton) do update set mode='users'");
  } finally { db.close(); }
  const alex = await withFixtureStore(join(root, '.cland/hub.db'), close => onCleanup(t, close), async store => store.users.get('alex-id'));
  const web = await dispatcherUi(t, { open: (peer, transport) => hub.dispatcher.open(peer, { ...transport, edge: 'web', user: () => alex }) }, root);
  for (const [client, name, id, display] of [[web, 'web-worker', 'alex-id', 'Alex Smith'], [local, 'cli-worker', 'jane-id', 'Jane']] as const) {
    const result = await client.request({ type: 'session.launch', name, harness: 'codex', userId: 'forged' });
    assert.equal(result.ok, true, result.error);
    const process = (result.value as { process: HarnessProcessView }).process as HarnessProcessView & { userId?: string; userDisplayName?: string };
    assert.equal(process.userId, users ? id : undefined);
    assert.equal(process.userDisplayName, users ? display : undefined);
    assert.equal(journal.find(row => row.event === 'session-launched' && row.session === name)?.userId, users ? id : undefined);
  }
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  await coord.waitForPresence(['coord']);
  const agent = await coord.call<{ process: HarnessProcessView & { userId?: string } }>('session.launch', { name: 'agent-worker', harness: 'codex' });
  assert.equal(agent.process.userId, undefined);
  assert.equal(journal.find(row => row.event === 'session-launched' && row.session === 'agent-worker')?.userId, undefined);
  if (users) {
    const before = (await web.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] };
    const identity = before.processes.find(p => p.name === 'web-worker')!.sessionId;
    assert.equal((await web.request({ type: 'session.stop', session: 'web-worker' })).ok, true);
    const fresh = await web.request({ type: 'session.resume', session: 'web-worker', fresh: true });
    assert.equal(fresh.ok, true, fresh.error);
    const process = (fresh.value as { process: HarnessProcessView }).process;
    assert.equal(process.sessionId, identity);
    assert.equal(process.userId, 'alex-id');
    assert.equal(process.userDisplayName, 'Alex Smith');
    assert.equal(journal.filter(row => row.event === 'session-launched' && row.session === 'web-worker').at(-1)?.userId, 'alex-id');
    const cli = await cland(root, 'session', 'launch', 'named-cli-worker', '--harness', 'codex', '--json');
    assert.equal(cli.code, 0, cli.stderr);
    const saved = JSON.parse(cli.stdout) as { process: HarnessProcessView };
    assert.equal(saved.process.userId, 'jane-id');
    assert.equal(journal.find(row => row.event === 'session-launched' && row.session === 'named-cli-worker')?.userId, 'jane-id');
    await coord.close();
    await web.close();
    await local.close();
    await hub.stop();
    const config = defaultConfig('Launch users');
    config.auth.mode = 'users';
    config.verification.lockPath = join(root, 'suite.lock');
    await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
    const restarted = await projectHub(t, root);
    const ui = await dispatcherUi(t, restarted.dispatcher, root);
    const listed = await ui.request({ type: 'session.list' });
    const processes = (listed.value as { processes: HarnessProcessView[] }).processes;
    assert.equal(processes.find(p => p.name === 'web-worker')?.userId, 'alex-id');
    assert.equal(processes.find(p => p.name === 'agent-worker')?.userId, undefined);
  }
});
