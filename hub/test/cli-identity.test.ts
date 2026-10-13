// The CLI run in a launched session's shell (T-49): `$CLAND_SESSION_ID` and `$CLAND_SESSION_NAME` are what the
// adapters put there, and with them every `cland` call is that session's: the hub refuses what only the human may
// do and audits the call under the session's name. A real daemon in a temporary project, real spokes, and the
// commands as child processes.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, flushProjectLogs, clandWithEnv, fakeCodex, NO_PS, pidAlive, readDiscovery, spawnSpoke, startDaemon, tempProject, type Session } from './harness.ts';

type Audit = { event: string; session: string; sessionId: string | null; role: string | null; tool: string; client?: string; outcome: string; permission?: string };

const audits = async (t: TestContext, root: string, tool: string): Promise<Audit[]> => {
  await flushProjectLogs(t, root);
  return (await readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8'))
    .split('\n')
    .filter((l) => l.startsWith('{'))
    .map((l) => JSON.parse(l) as Audit)
    .filter((e) => e.event === 'audit' && e.tool === tool);
};

async function session(t: TestContext, root: string, name: string, role: string, sessionId: string): Promise<Session> {
  const s = await spawnSpoke({ discover: true, cwd: root, name, role, sessionId });
  t.after(() => s.close());
  await s.waitForPresence([name]);
  return s;
}

/** The environment of a launched session's shell. */
const shellOf = (name: string, sessionId: string) => ({ CLAND_SESSION_ID: sessionId, CLAND_SESSION_NAME: name });

test('cland topic answer from a session\'s shell is refused with the typed error: the ask stays open and the audit names the session', async (t) => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  const coord = await session(t, root, 'coord', 'coordinator', 'sess-coord');
  await session(t, root, 'impl-1', 'implementer', 'sess-impl');
  const asked = await coord.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Which port?', options: ['a fixed one', 'a free one'] });
  assert.equal(asked.ok, true, JSON.stringify(asked));
  const impl = shellOf('impl-1', 'sess-impl');

  const refused = await clandWithEnv(root, impl, 'topic', 'answer', asked.ask, '1');
  assert.notEqual(refused.code, 0);
  assert.match(refused.stderr, /forbidden: topic\.answer \(only the human may do this; this call is impl-1 \[Implementer\]'s, by \$CLAND_SESSION_ID\)/);
  assert.equal(refused.stdout, '');
  assert.match((await cland(root, 'inbox')).stdout, new RegExp(`^ask ${asked.ask} `, 'm'), 'the ask is still open');
  const [audit] = (await audits(t, root, 'topic.answer')).slice(-1);
  assert.deepEqual([audit?.session, audit?.sessionId, audit?.role, audit?.client, audit?.outcome, audit?.permission], ['impl-1', 'sess-impl', 'implementer', 'cli', 'forbidden', 'topic.answer']);

  // the asker itself is no more the human than anyone: the Coordinator's shell is refused its own ask too
  const own = await clandWithEnv(root, shellOf('coord', 'sess-coord'), 'topic', 'answer', asked.ask, '1');
  assert.match(own.stderr, /forbidden: topic\.answer \(only the human may do this; this call is coord \[Coordinator\]'s/);

  // an identity the hub does not know is a session all the same, never the human
  const stranger = await clandWithEnv(root, shellOf('ghost', 'sess-nobody'), 'topic', 'answer', asked.ask, '1');
  assert.match(stranger.stderr, /forbidden: topic\.answer \(only the human may do this; this call is ghost's/);

  // ... and so is a name alone that the hub never heard of (a stale or made-up $CLAND_SESSION_NAME, no id): refused,
  // never promoted to the human
  const nameOnly = await clandWithEnv(root, { CLAND_SESSION_NAME: 'ghost' }, 'topic', 'answer', asked.ask, '1');
  assert.notEqual(nameOnly.code, 0);
  assert.match(nameOnly.stderr, /forbidden: topic\.answer \(only the human may do this; this call is ghost's/);
  const [ghost] = (await audits(t, root, 'topic.answer')).slice(-1);
  assert.deepEqual([ghost?.session, ghost?.role, ghost?.outcome], ['ghost', null, 'forbidden']);
  const ghostTask = await clandWithEnv(root, { CLAND_SESSION_NAME: 'ghost' }, 'task', 'create', '--size', 'M', 'From nobody');
  assert.notEqual(ghostTask.code, 0);
  assert.match(ghostTask.stderr, /forbidden: task\.create \(a session with no role has no tools\)/);
  assert.match((await cland(root, 'inbox')).stdout, new RegExp(`^ask ${asked.ask} `, 'm'), 'the ask is still open');

  // without the variables it is the human's, as before
  const answered = await cland(root, 'topic', 'answer', asked.ask, '1');
  assert.equal(answered.code, 0, answered.stderr);
  assert.doesNotMatch((await cland(root, 'inbox')).stdout, /^ask /m);
  const [human] = (await audits(t, root, 'topic.answer')).slice(-1);
  assert.deepEqual([human?.session, human?.role, human?.outcome], ['human', 'human', 'ok']);
});

test('the other human-only commands are refused from a session\'s shell, the Coordinator\'s included, and reading is not: role set and clear, session attach and retry, hub unmute; inbox, role list', async (t) => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  await session(t, root, 'coord', 'coordinator', 'sess-coord');
  await session(t, root, 'impl-1', 'implementer', 'sess-impl');
  const impl = shellOf('impl-1', 'sess-impl');
  const coord = shellOf('coord', 'sess-coord');

  for (const [env, who, args, tool] of [
    [impl, 'impl-1 \\[Implementer\\]', ['role', 'set', 'impl-1', 'reviewer'], 'role.set'],
    [coord, 'coord \\[Coordinator\\]', ['role', 'set', 'impl-1', 'reviewer'], 'role.set'],
    [impl, 'impl-1 \\[Implementer\\]', ['role', 'clear', 'coord'], 'role.clear'],
    [coord, 'coord \\[Coordinator\\]', ['session', 'attach', 'impl-1'], 'session.attach'],
    [coord, 'coord \\[Coordinator\\]', ['session', 'retry', 'impl-1', 'no-such-message'], 'session.retry'],
    [impl, 'impl-1 \\[Implementer\\]', ['hub', 'unmute', 'coord', 'impl-1'], 'hygiene.unmute'],
  ] as const) {
    const r = await clandWithEnv(root, env, ...args);
    assert.notEqual(r.code, 0, `${args.join(' ')} is refused`);
    assert.match(r.stderr, new RegExp(`forbidden: ${tool.replace('.', '\\.')} \\(only the human may do this; this call is ${who}'s`), args.join(' '));
    const [audit] = (await audits(t, root, tool)).slice(-1);
    assert.deepEqual([audit?.session, audit?.outcome], [env.CLAND_SESSION_NAME, 'forbidden'], args.join(' '));
  }
  // nothing moved
  assert.match((await cland(root, 'role', 'list')).stdout, /Implementer .*\n {2}impl-1 \[Implementer\]\n/);

  // reading is the session's too, and allowed
  for (const [args, tool] of [[['inbox'], 'inbox.list'], [['role', 'list'], 'role.list']] as const) {
    const r = await clandWithEnv(root, impl, ...args);
    assert.equal(r.code, 0, r.stderr);
    const [audit] = (await audits(t, root, tool)).slice(-1);
    assert.deepEqual([audit?.session, audit?.sessionId, audit?.role, audit?.outcome], ['impl-1', 'sess-impl', 'implementer', 'ok'], args.join(' '));
  }
  // what the permission table knows is decided by the table: the Coordinator may list the launched sessions, an Implementer may not
  assert.equal((await clandWithEnv(root, coord, 'session', 'list')).code, 0);
  const listed = await clandWithEnv(root, impl, 'session', 'list');
  assert.match(listed.stderr, /forbidden: session\.launch \(Implementer may not/);

  // the human's own calls are untouched
  const set = await cland(root, 'role', 'set', 'impl-1', 'reviewer');
  assert.equal(set.code, 0, set.stderr);
});

test('cland task view and task comment from a session\'s shell work as the session: the comment\'s author is the session, within its role\'s scope', async (t) => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  await session(t, root, 'impl-1', 'implementer', 'sess-impl');
  const impl = shellOf('impl-1', 'sess-impl');
  assert.equal((await cland(root, 'task', 'create', '--size', 'M', 'Mine', '--assignee', 'impl-1')).code, 0);
  assert.equal((await cland(root, 'task', 'create', '--size', 'M', 'Not mine')).code, 0);

  const viewed = await clandWithEnv(root, impl, 'task', 'view', 'T-1', '--json');
  assert.equal(viewed.code, 0, viewed.stderr);
  assert.equal((JSON.parse(viewed.stdout) as { item: { title: string } }).item.title, 'Mine');

  const commented = await clandWithEnv(root, impl, 'task', 'comment', 'T-1', 'from my shell');
  assert.equal(commented.code, 0, commented.stderr);
  const after = JSON.parse((await cland(root, 'task', 'view', 'T-1', '--json')).stdout) as { item: { comments: Array<{ author: string; text: string }> } };
  assert.deepEqual(after.item.comments.map((c) => [c.author, c.text]), [['impl-1', 'from my shell']]);
  const [audit] = (await audits(t, root, 'task.comment')).slice(-1);
  assert.deepEqual([audit?.session, audit?.sessionId, audit?.role, audit?.outcome], ['impl-1', 'sess-impl', 'implementer', 'ok']);

  // an Implementer comments on its own item only
  const other = await clandWithEnv(root, impl, 'task', 'comment', 'T-2', 'not my item');
  assert.notEqual(other.code, 0);
  assert.match(other.stderr, /forbidden: task\.comment/);
});

test('the Coordinator manages the sessions and the hub from its shell, by the permission table: it lists, stops and resumes a launched session and stops the hub; an Implementer is refused each', { skip: NO_PS }, async (t) => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  await startDaemon(t, root, fake.env);
  await session(t, root, 'coord', 'coordinator', 'sess-coord');
  await session(t, root, 'impl-1', 'implementer', 'sess-impl');
  const impl = shellOf('impl-1', 'sess-impl');
  const coord = shellOf('coord', 'sess-coord');

  // the Coordinator launches from its shell, as it does in a real project
  const launched = await clandWithEnv(root, coord, 'session', 'launch', 'worker-1', '--harness', 'codex');
  assert.equal(launched.code, 0, launched.stderr);
  const [server] = await fake.servers();
  assert.ok(server, 'the launched session runs');

  for (const [args, permission] of [
    [['session', 'launch', 'worker-2', '--harness', 'codex'], 'session.launch'],
    [['session', 'list'], 'session.launch'],
    [['session', 'stop', 'worker-1'], 'session.stop'],
    [['session', 'resume', 'worker-1', '--relaunch'], 'session.resume'],
    [['hub', 'stop'], 'hub.stop'],
  ] as const) {
    const r = await clandWithEnv(root, impl, ...args);
    assert.notEqual(r.code, 0, `${args.join(' ')} is refused`);
    assert.match(r.stderr, new RegExp(`forbidden: ${permission.replace('.', '\\.')} \\(Implementer may not use ${permission.replace('.', '\\.')}\\)`), args.join(' '));
  }
  assert.equal(pidAlive(server.pid), true, 'nothing was stopped');

  const list = await clandWithEnv(root, coord, 'session', 'list');
  assert.equal(list.code, 0, list.stderr);
  assert.match(list.stdout, /^worker-1 .*codex {2}running/);
  const stopped = await clandWithEnv(root, coord, 'session', 'stop', 'worker-1');
  assert.equal(stopped.code, 0, stopped.stderr);
  assert.equal(pidAlive(server.pid), false);
  const [stopAudit] = (await audits(t, root, 'session.stop')).slice(-1);
  assert.deepEqual([stopAudit?.session, stopAudit?.role, stopAudit?.client, stopAudit?.outcome], ['coord', 'coordinator', 'cli', 'ok']);
  const resumed = await clandWithEnv(root, coord, 'session', 'resume', 'worker-1', '--relaunch');
  assert.equal(resumed.code, 0, resumed.stderr);
  assert.equal((await fake.servers()).length, 1, 'relaunched');
  assert.equal((await clandWithEnv(root, coord, 'session', 'stop', 'worker-1')).code, 0);

  // the hub's restart after a merge is the Coordinator's
  const hub = await readDiscovery(root);
  const hubStopped = await clandWithEnv(root, coord, 'hub', 'stop');
  assert.equal(hubStopped.code, 0, hubStopped.stderr);
  assert.equal(pidAlive(hub.pid), false);
});

test('cland hub stop from a session\'s shell signals nothing when the hub does not answer: only a confirmed request, or the human, may fall back to the signal', async (t) => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  await session(t, root, 'coord', 'coordinator', 'sess-coord');
  await session(t, root, 'impl-1', 'implementer', 'sess-impl');
  const hub = await readDiscovery(root);
  // a hub that takes the connection and never answers
  process.kill(hub.pid, 'SIGSTOP');
  t.after(() => {
    if (pidAlive(hub.pid)) process.kill(hub.pid, 'SIGCONT');
  });
  try {
    for (const env of [shellOf('impl-1', 'sess-impl'), shellOf('coord', 'sess-coord'), { CLAND_SESSION_NAME: 'ghost' }]) {
      const r = await clandWithEnv(root, env, 'hub', 'stop');
      assert.equal(r.code, 1, r.stdout);
      assert.match(r.stderr, new RegExp(`the hub did not confirm hub\\.stop .*this shell is session ${env.CLAND_SESSION_NAME}'s .*pid ${hub.pid} is not signalled`));
    }
  } finally {
    process.kill(hub.pid, 'SIGCONT');
  }
  // no signal was left pending: the hub goes on and answers
  const status = await cland(root, 'hub', 'status');
  assert.equal(status.code, 0, status.stderr);
  assert.equal(pidAlive(hub.pid), true);
});
