// T3: SIGSTOP hub-down CLI fallback proves no signal is sent without acknowledgement; confirmed hub.stop reaps its PID.
import { sessionUi as connectUi, sessionDispatcherUi as dispatcherUi, sessionClandWithEnv as clandWithEnv } from './session-credential-fixture.ts';
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, flushProjectLogs, fakeCodex, pidAlive, readDiscovery, inProcessSpoke, nativeProjectHub as projectHub, eventually, fakeClaude, startDaemon, tempProject, type Session } from './harness.ts';

import { NO_PS } from './native-process.ts';
import { value } from './validation-support.ts';

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
  const s = await inProcessSpoke(t, { discover: true, cwd: root, name, role, sessionId });
  t.after(() => s.close());
  await s.waitForPresence([name]);
  return s;
}

/** The environment of a launched session's shell. */
const shellOf = (name: string, sessionId: string) => ({ CLAND_SESSION_ID: sessionId, CLAND_SESSION_NAME: name });

async function fixture(t: TestContext) {
  const root = await tempProject(t);
  const hub = await projectHub(t, root);
  const ui = await dispatcherUi(t, hub.dispatcher, root);
  const cli = await connectUi(t, hub.discovery, 'cli');
  const coord = await session(t, root, 'coord', 'coordinator', 'sess-coord');
  await session(t, root, 'impl-1', 'implementer', 'sess-impl');
  return { root, ui, cli, coord };
}

test('cland topic answer from a session\'s shell retains its typed refusal and identity', async t => {
  const { root, ui, cli, coord } = await fixture(t);
  const asked = await coord.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Which port?', options: ['a fixed one', 'a free one'] });
  assert.equal(asked.ok, true);
  const refused = await clandWithEnv(root, shellOf('impl-1', 'sess-impl'), 'topic', 'answer', asked.ask, '1');
  assert.notEqual(refused.code, 0);
  assert.match(refused.stderr, /forbidden: topic\.answer \(only the human may do this; this call is impl-1 \[Implementer\]'s, by \$CLAND_SESSION_ID\)/);
  assert.equal(refused.stdout, '');
  const [audit] = (await audits(t, root, 'topic.answer')).slice(-1);
  assert.deepEqual([audit?.session, audit?.sessionId, audit?.role, audit?.client, audit?.outcome, audit?.permission], ['impl-1', 'sess-impl', 'implementer', 'cli', 'forbidden', 'topic.answer']);
  for (const as of [{ name: 'coord', sessionId: 'sess-coord', shell: true }, { name: 'ghost', sessionId: 'sess-nobody', shell: true }, { name: 'ghost', shell: true }]) {
    const own = await cli.request({ type: 'topic.answer', ask: asked.ask, option: 1, as });
    assert.equal(own.ok, false);
    if (as.name === 'ghost' && !as.sessionId) assert.match(own.error ?? '', /session "ghost" credential/);
    else assert.match(own.error ?? '', new RegExp(`only the human may do this; this call is ${as.name}${as.name === 'coord' ? ' \\[Coordinator\\]' : ''}'s`));
  }
  const nameOnly = await clandWithEnv(root, { CLAND_SESSION_NAME: 'ghost' }, 'topic', 'answer', asked.ask, '1');
  assert.notEqual(nameOnly.code, 0);
  assert.match(nameOnly.stderr, /session "ghost" credential is missing or invalid/);
  const ghostTask = await cli.request({ type: 'task.create', size: 'M', title: 'From nobody', as: { name: 'ghost', shell: true } });
  assert.equal(ghostTask.ok, false);
  assert.match(ghostTask.error ?? '', /session "ghost" credential is missing or invalid/);
  const inboxCli = await cland(root, 'inbox');
  assert.equal(inboxCli.code, 0, inboxCli.stderr);
  assert.match(inboxCli.stdout, new RegExp(`^ask ${asked.ask} `, 'm'));
  const inbox = await value<{ asks: Array<{ id: string }> }>(ui, { type: 'inbox.list' });
  assert.ok(inbox.asks.some(ask => ask.id === asked.ask), 'the ask is still open');
  await value(ui, { type: 'topic.answer', ask: asked.ask, option: 1 });
  assert.equal((await value<{ asks: unknown[] }>(ui, { type: 'inbox.list' })).asks.length, 0);
  const [human] = (await audits(t, root, 'topic.answer')).slice(-1);
  assert.deepEqual([human?.session, human?.role, human?.outcome], ['human', 'human', 'ok']);
});

test('human-only shell commands enforce the held role while reads remain allowed', async t => {
  const { root, ui, cli } = await fixture(t);
  for (const [name, sessionId, frame] of [
    ['impl-1', 'sess-impl', { type: 'role.set', session: 'impl-1', role: 'reviewer' }],
    ['coord', 'sess-coord', { type: 'role.set', session: 'impl-1', role: 'reviewer' }],
    ['impl-1', 'sess-impl', { type: 'role.clear', session: 'coord' }],
    ['coord', 'sess-coord', { type: 'session.attach', session: 'impl-1' }],
    ['coord', 'sess-coord', { type: 'session.retry', session: 'impl-1', message: 'no-such-message' }],
    ['impl-1', 'sess-impl', { type: 'hygiene.unmute', a: 'coord', b: 'impl-1' }],
  ] as const) {
    const r = await cli.request({ ...frame, as: { name, sessionId, shell: true } });
    assert.equal(r.ok, false, frame.type);
    assert.match(r.error ?? '', /forbidden: .*only the human may do this/);
    const [audit] = (await audits(t, root, frame.type)).slice(-1);
    assert.deepEqual([audit?.session, audit?.outcome], [name, 'forbidden']);
  }
  const roles = await value<{ roles: Array<{ role: string; holders: Array<{ name: string }> }> }>(ui, { type: 'role.list' });
  assert.ok(roles.roles.find(row => row.role === 'implementer')?.holders.some(holder => holder.name === 'impl-1'), 'nothing moved');
  for (const type of ['inbox.list', 'role.list']) {
    await value(cli, { type, as: { name: 'impl-1', sessionId: 'sess-impl', shell: true } });
    const [audit] = (await audits(t, root, type)).slice(-1);
    assert.deepEqual([audit?.session, audit?.sessionId, audit?.role, audit?.outcome], ['impl-1', 'sess-impl', 'implementer', 'ok']);
  }
  await value(cli, { type: 'session.list', as: { name: 'coord', sessionId: 'sess-coord', shell: true } });
  const listed = await cli.request({ type: 'session.list', as: { name: 'impl-1', sessionId: 'sess-impl', shell: true } });
  assert.equal(listed.ok, true, listed.error);
  const set = await cland(root, 'role', 'set', 'impl-1', 'reviewer');
  assert.equal(set.code, 0, set.stderr);
});

test('cland task view and comment use the shell identity and preserve ownership', async t => {
  const { root, ui } = await fixture(t);
  await value(ui, { type: 'task.create', size: 'M', title: 'Mine', assignee: 'impl-1' });
  await value(ui, { type: 'task.create', size: 'M', title: 'Not mine' });
  const impl = shellOf('impl-1', 'sess-impl');
  const viewed = await clandWithEnv(root, impl, 'task', 'view', 'T-1', '--json');
  assert.equal(viewed.code, 0, viewed.stderr);
  assert.equal(JSON.parse(viewed.stdout).item.title, 'Mine');
  const commented = await clandWithEnv(root, impl, 'task', 'comment', 'T-1', 'from my shell');
  assert.equal(commented.code, 0, commented.stderr);
  const after = await value<{ item: { comments: Array<{ author: string; text: string }> } }>(ui, { type: 'task.view', item: 'T-1' });
  assert.deepEqual(after.item.comments.map(c => [c.author, c.text]), [['impl-1', 'from my shell']]);
  const [audit] = (await audits(t, root, 'task.comment')).slice(-1);
  assert.deepEqual([audit?.session, audit?.sessionId, audit?.role, audit?.outcome], ['impl-1', 'sess-impl', 'implementer', 'ok']);
  const forgedRole = await clandWithEnv(root, { ...impl, CLAND_ROLE: 'coordinator' }, 'task', 'close', 'T-1');
  assert.equal(forgedRole.code, 1);
  assert.match(forgedRole.stderr, /forbidden: task\.close \(Implementer may not use task\.close\)/);
  const other = await clandWithEnv(root, impl, 'task', 'comment', 'T-2', 'not my item');
  assert.notEqual(other.code, 0);
  assert.match(other.stderr, /forbidden: task\.comment/);
});

test('the Coordinator manages the sessions and the hub from its shell; an Implementer may list but cannot mutate sessions or stop the hub', { skip: NO_PS }, async (t) => {
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

  const cli = await connectUi(t, await readDiscovery(root), 'cli');
  for (const [type, fields, permission] of [
    ['session.launch', { name: 'worker-2', harness: 'codex' }, 'session.launch'],
    ['session.stop', { session: 'worker-1' }, 'session.stop'],
    ['session.resume', { session: 'worker-1', relaunch: true }, 'session.resume'],
    ['hub.stop', {}, 'hub.stop'],
  ] as const) {
    const r = await cli.request({ type, ...fields, as: { name: 'impl-1', sessionId: 'sess-impl', shell: true } });
    assert.equal(r.ok, false, `${type} is refused`);
    assert.match(r.error ?? '', new RegExp(`forbidden: ${permission.replace('.', '\\.')} \\(Implementer may not use ${permission.replace('.', '\\.')}\\)`));
  }
  assert.equal(pidAlive(server.pid), true, 'nothing was stopped');

  const implList = await clandWithEnv(root, impl, 'session', 'list');
  assert.equal(implList.code, 0, implList.stderr);
  assert.match(implList.stdout, /^worker-1 .*codex {2}running/);
  const list = await clandWithEnv(root, coord, 'session', 'list');
  assert.equal(list.code, 0, list.stderr);
  assert.match(list.stdout, /^worker-1 .*codex {2}running/);
  const stopped = await clandWithEnv(root, coord, 'session', 'stop', 'worker-1');
  assert.equal(stopped.code, 0, stopped.stderr);
  await eventually('worker PID reaped', () => !pidAlive(server.pid) ? true : undefined);
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
  await eventually('hub PID reaped', () => !pidAlive(hub.pid) ? true : undefined);
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

test('a launched session cannot borrow another identity with `--as`: neither the human nor the Coordinator, it stays itself', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', sessionId: 'sess-coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const launched = await ui.request({ type: 'session.launch', name: 'impl-1', role: 'implementer', harness: 'claude-code' }, 30_000);
  assert.equal(launched.ok, true, launched.error);
  const implId = (launched.value as { process: { sessionId: string } }).process.sessionId;
  await value(ui, { type: 'task.create', size: 'M', title: 'Ship it', assignee: 'impl-1' });

  // the session's own shell runs the CLI, as its Bash tool would
  const run = async (args: string): Promise<string> => {
    assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text: `@impl-1 cland ${args}` })).ok, true);
    const answer = await ui.waitFor((f) => f.type === 'message' && (f.message as { from: string }).from === 'impl-1' && (f.message as { text: string }).text.startsWith(`ran: cland ${args}: `), 30_000);
    return (answer.message as { text: string }).text;
  };
  for (const as of ['human', 'coord']) {
    const out = await run(`task close T-1 --as ${as}`);
    assert.match(out, /: exit 1\n/, out);
    assert.match(out, /forbidden: task\.close \(Implementer may not use task\.close\)/, out);
    const record = (await audits(t, root, 'task.close')).filter((a) => a.tool === 'task.close').at(-1);
    assert.deepEqual([record?.session, record?.sessionId, record?.role, record?.outcome, record?.client], ['impl-1', implId, 'implementer', 'forbidden', 'cli']);
  }
  // on the wire the session id decides, before any name: a frame naming the human with the session's id is the session
  const wire = await ui.request({ type: 'task.close', item: 'T-1', as: { name: 'human', sessionId: implId } });
  assert.equal(wire.ok, false);
  assert.match(wire.error ?? '', /forbidden: task\.close/);
  // what the Implementer may do, it does as itself whatever `--as` says: the claim is held by its own session id
  const claimed = await run('task claim T-1 --as coord --json');
  assert.match(claimed, /: exit 0\n/, claimed);
  const claim = (JSON.parse(claimed.split('\n').find((l) => l.startsWith('{')) as string) as { claim: { session: string; sessionId: string } }).claim;
  assert.deepEqual([claim.session, claim.sessionId], ['impl-1', implId]);
  const view = await value<{ item: { state: string } }>(ui, { type: 'task.view', item: 'T-1' });
  assert.equal(view.item.state, 'open');
});
