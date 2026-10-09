// The CLI run in a launched session's shell (T-49): `$CLAND_SESSION_ID` and `$CLAND_SESSION_NAME` are what the
// adapters put there, and with them every `cland` call is that session's: the hub refuses what only the human may
// do and audits the call under the session's name. A real daemon in a temporary project, real spokes, and the
// commands as child processes.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, clandWithEnv, spawnSpoke, startDaemon, tempProject, type Session } from './harness.ts';

type Audit = { event: string; session: string; sessionId: string | null; role: string | null; tool: string; client?: string; outcome: string; permission?: string };

const audits = async (root: string, tool: string): Promise<Audit[]> =>
  (await readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8'))
    .split('\n')
    .filter((l) => l.startsWith('{'))
    .map((l) => JSON.parse(l) as Audit)
    .filter((e) => e.event === 'audit' && e.tool === tool);

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
  assert.match((await cland(root, 'inbox')).stdout, new RegExp(`^ask ${asked.ask} `), 'the ask is still open');
  const [audit] = (await audits(root, 'topic.answer')).slice(-1);
  assert.deepEqual([audit?.session, audit?.sessionId, audit?.role, audit?.client, audit?.outcome, audit?.permission], ['impl-1', 'sess-impl', 'implementer', 'cli', 'forbidden', 'topic.answer']);

  // the asker itself is no more the human than anyone: the Coordinator's shell is refused its own ask too
  const own = await clandWithEnv(root, shellOf('coord', 'sess-coord'), 'topic', 'answer', asked.ask, '1');
  assert.match(own.stderr, /forbidden: topic\.answer \(only the human may do this; this call is coord \[Coordinator\]'s/);

  // an identity the hub does not know is a session all the same, never the human
  const stranger = await clandWithEnv(root, shellOf('ghost', 'sess-nobody'), 'topic', 'answer', asked.ask, '1');
  assert.match(stranger.stderr, /forbidden: topic\.answer \(only the human may do this; this call is ghost's/);

  // without the variables it is the human's, as before
  const answered = await cland(root, 'topic', 'answer', asked.ask, '1');
  assert.equal(answered.code, 0, answered.stderr);
  assert.doesNotMatch((await cland(root, 'inbox')).stdout, /^ask /m);
  const [human] = (await audits(root, 'topic.answer')).slice(-1);
  assert.deepEqual([human?.session, human?.role, human?.outcome], ['human', 'human', 'ok']);
});

test('the other human-only commands are refused from a session\'s shell, and reading is not: role set and clear, session stop, hygiene unmute; inbox, role list, session list', async (t) => {
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
    [impl, 'impl-1 \\[Implementer\\]', ['session', 'stop', 'coord'], 'session.stop'],
    [impl, 'impl-1 \\[Implementer\\]', ['hub', 'unmute', 'coord', 'impl-1'], 'hygiene.unmute'],
  ] as const) {
    const r = await clandWithEnv(root, env, ...args);
    assert.notEqual(r.code, 0, `${args.join(' ')} is refused`);
    assert.match(r.stderr, new RegExp(`forbidden: ${tool.replace('.', '\\.')} \\(only the human may do this; this call is ${who}'s`), args.join(' '));
    const [audit] = (await audits(root, tool)).slice(-1);
    assert.deepEqual([audit?.session, audit?.outcome], [env.CLAND_SESSION_NAME, 'forbidden'], args.join(' '));
  }
  // nothing moved
  assert.match((await cland(root, 'role', 'list')).stdout, /Implementer .*\n {2}impl-1 \[Implementer\]\n/);

  // reading is the session's too, and allowed
  for (const [args, tool] of [[['inbox'], 'inbox.list'], [['role', 'list'], 'role.list']] as const) {
    const r = await clandWithEnv(root, impl, ...args);
    assert.equal(r.code, 0, r.stderr);
    const [audit] = (await audits(root, tool)).slice(-1);
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
  assert.equal((await cland(root, 'task', 'create', 'Mine', '--assignee', 'impl-1')).code, 0);
  assert.equal((await cland(root, 'task', 'create', 'Not mine')).code, 0);

  const viewed = await clandWithEnv(root, impl, 'task', 'view', 'T-1', '--json');
  assert.equal(viewed.code, 0, viewed.stderr);
  assert.equal((JSON.parse(viewed.stdout) as { item: { title: string } }).item.title, 'Mine');

  const commented = await clandWithEnv(root, impl, 'task', 'comment', 'T-1', 'from my shell');
  assert.equal(commented.code, 0, commented.stderr);
  const after = JSON.parse((await cland(root, 'task', 'view', 'T-1', '--json')).stdout) as { item: { comments: Array<{ author: string; text: string }> } };
  assert.deepEqual(after.item.comments.map((c) => [c.author, c.text]), [['impl-1', 'from my shell']]);
  const [audit] = (await audits(root, 'task.comment')).slice(-1);
  assert.deepEqual([audit?.session, audit?.sessionId, audit?.role, audit?.outcome], ['impl-1', 'sess-impl', 'implementer', 'ok']);

  // an Implementer comments on its own item only
  const other = await clandWithEnv(root, impl, 'task', 'comment', 'T-2', 'not my item');
  assert.notEqual(other.code, 0);
  assert.match(other.stderr, /forbidden: task\.comment/);
});
