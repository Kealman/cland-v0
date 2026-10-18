// Role integrity under races, expiry, renames and failures (Codex review of #25/#26/#29/#31): the exclusive role is
// never held twice, revocations stick, a failed launch rolls back what it reserved, a handover survives a crash.
// Against a real daemon in a temporary project: spokes over MCP, the UI on the Unix socket, the fake harnesses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, eventually, fakeCodex, killDaemon, sleep, spawnSpoke, nativeProjectHub as projectHub, startDaemon, tempProject, type FrameClient } from './harness.ts';

type Holder = { name: string; role: string | null; live: boolean };
type RoleList = { roles: Array<{ role: string; holders: Holder[] }>; coordinator: string | null };

const hubLog = (root: string) => readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8');

async function holders(ui: FrameClient, role: string): Promise<string[]> {
  const r = await ui.request({ type: 'role.list' });
  assert.equal(r.ok, true, r.error);
  return ((r.value as RoleList).roles.find((x) => x.role === role)?.holders ?? []).map((h) => h.name);
}

test('a Coordinator remembered past the queue TTL that reconnects after another took the role is refused it; the UI learns', async (t) => {
  const root = await tempProject(t);
  const queueTtlMs = 300;
  const { discovery } = await projectHub(t, root, { CLAND_QUEUE_TTL_MS: String(queueTtlMs) });
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);

  const old = await spawnSpoke({ discover: true, cwd: root, name: 'coord-a', sessionId: 'sess-a', role: 'coordinator' });
  await ui.waitFor((f) => f.type === 'role.filled' && f.session === 'coord-a', 30_000);
  await old.close();
  await ui.waitFor((f) => f.type === 'role.vacant');
  // past the TTL the old holder no longer counts: the human gives the role to another session
  await sleep(1.2 * queueTtlMs); // Expiry: exceed the remembered holder TTL.
  const set = await ui.request({ type: 'role.set', session: 'coord-b', role: 'coordinator' });
  assert.equal(set.ok, true, set.error);
  const b = await spawnSpoke({ discover: true, cwd: root, name: 'coord-b', sessionId: 'sess-b', assignRole: false });
  t.after(() => b.close());
  await ui.waitFor((f) => f.type === 'role.filled' && f.session === 'coord-b', 30_000);

  // the old holder comes back: it is refused the role, not a second Coordinator
  const back = await spawnSpoke({ discover: true, cwd: root, name: 'coord-a', sessionId: 'sess-a', assignRole: false });
  t.after(() => back.close());
  await eventually('refused', () => (/no role: .*coord-a/.test(back.log()) ? true : undefined));
  const revoked = await ui.waitFor((f) => f.type === 'session.role' && f.session === 'coord-a' && f.role === null && f.previous === 'coordinator');
  assert.match(String(revoked.reason), /coord-b/);
  assert.deepEqual(await holders(ui, 'coordinator'), ['coord-b']);
  const status = (await ui.request({ type: 'hub.status' })).value as { coordinator: string | null; sessions: Array<{ name: string }> };
  assert.equal(status.coordinator, 'coord-b');
  assert.ok(!status.sessions.some((s) => s.name === 'coord-a'), 'the stale holder stays off the hub');
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  assert.match(await hubLog(root), /"event":"role-superseded","session":"coord-a"/);
});

type Harness = { name: string; role: string | null; pid: number | null; sessionId: string; status: string; state: string };

async function processes(ui: FrameClient): Promise<Harness[]> {
  const r = await ui.request({ type: 'session.list' });
  assert.equal(r.ok, true, r.error);
  return (r.value as { processes: Harness[] }).processes;
}

async function launchCodex(ui: FrameClient, name: string, extra: Record<string, unknown> = {}) {
  return ui.request({ type: 'session.launch', name, harness: 'codex', ...extra }, 30_000);
}

const presentAs = (ui: FrameClient, name: string, state: string) =>
  eventually(`${name} present as ${state}`, async () => {
    const s = ((await ui.request({ type: 'hub.status' })).value as { sessions: Array<{ name: string; state: string; role: string | null }> }).sessions.find((x) => x.name === name);
    return s?.state === state ? s : undefined;
  });

test('two launches for the Coordinator at once: the role is reserved before the spawn, so the second is refused at once', async (t) => {
  const root = await tempProject(t);
  // Force a completed first turn before launch acceptance, as a loaded hub's receive batch can do.
  const fake = await fakeCodex(t, { env: { FAKE_CODEX_COMPLETE_FIRST_TURN_BEFORE_RESPONSE: '1' } });
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const [one, two] = await Promise.all([launchCodex(ui, 'coord-1', { role: 'coordinator' }), launchCodex(ui, 'coord-2', { role: 'coordinator' })]);
  assert.equal(one.ok, true, one.error);
  assert.equal(two.ok, false);
  assert.match(two.error ?? '', /crew\.coordinator: singleton size 1 reached \(coord-1\)/);
  // the human's assignment is refused as well
  const set = await ui.request({ type: 'role.set', session: 'other', role: 'coordinator' });
  assert.match(set.error ?? '', /held by coord-1/);
  await presentAs(ui, 'coord-1', 'idle');
  assert.deepEqual(await holders(ui, 'coordinator'), ['coord-1']);
  assert.deepEqual((await processes(ui)).map((p) => p.name), ['coord-1']);
});

test('a launch that fails after its spoke connected gives the role back: no Coordinator is left reserved offline', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t, { env: { FAKE_CODEX_FAIL_FIRST_TURN: '1' } });
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const failed = await launchCodex(ui, 'coord', { role: 'coordinator' });
  assert.equal(failed.ok, false);
  assert.match(failed.error ?? '', /refused the first turn/);
  // the spoke had connected (an early hello) and taken the role; it is rolled back
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  assert.ok((await hubLog(root)).includes('"event":"hello","name":"coord"'), 'the spoke said hello before the first turn failed');
  await eventually('no holder', async () => ((await holders(ui, 'coordinator')).length === 0 ? true : undefined));
  assert.equal(((await ui.request({ type: 'hub.status' })).value as { coordinator: string | null }).coordinator, null);
  const set = await ui.request({ type: 'role.set', session: 'next', role: 'coordinator' });
  assert.equal(set.ok, true, set.error);
});

test('a launch for the role the name already holds carries the clause once: in the first turn, never injected again', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'role.set', session: 'rev-1', role: 'reviewer' })).ok, true);
  const launched = await launchCodex(ui, 'rev-1', { role: 'reviewer' });
  assert.equal(launched.ok, true, launched.error);
  const pid = (launched.value as { process: Harness }).process.pid as number;
  await presentAs(ui, 'rev-1', 'idle');
  await eventually('the first role clause is recorded', async () => {
    await ui.request({ type: 'hub.status', flushLogs: true });
    return (await hubLog(root)).includes('"event":"role-clause","session":"rev-1"') ? true : undefined;
  });
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const clauses = (await hubLog(root)).split('\n').filter((l) => l.includes('"event":"role-clause"') && l.includes('"session":"rev-1"'));
  assert.equal(clauses.length, 1, clauses.join('\n'));
  await sleep(100);
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  assert.equal((await hubLog(root)).split('\n').filter(line => line.includes('"event":"role-clause"') && line.includes('"session":"rev-1"')).length, 1, 'still one clause after settling');
  assert.match(clauses[0] as string, /"reason":"assigned at launch \(first turn\)"/);
  assert.equal(((await fake.log(pid)).match(/you hold the role Reviewer/g) ?? []).length, 1, 'the clause was handed over once');
});

test('a role changed while a relaunch is under way stays changed: resume never writes back the role it started from', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const launched = await launchCodex(ui, 'coord', { role: 'coordinator' });
  assert.equal(launched.ok, true, launched.error);
  await presentAs(ui, 'coord', 'idle');
  await killDaemon((launched.value as { process: Harness }).process.pid as number);
  await eventually('exited', async () => ((await processes(ui)).find((p) => p.name === 'coord')?.status === 'exited' ? true : undefined));

  // the relaunch and the human's assignment race: the assignment lands while the adapter starts the new app-server
  const [resumed, set] = await Promise.all([ui.request({ type: 'session.resume', session: 'coord', relaunch: true }, 30_000), ui.request({ type: 'role.set', session: 'coord', role: 'implementer' })]);
  assert.equal(set.ok, true, set.error);
  assert.equal(resumed.ok, true, resumed.error);
  assert.equal((await processes(ui)).find((p) => p.name === 'coord')?.role, 'implementer');
  const present = await presentAs(ui, 'coord', 'idle');
  assert.equal(present.role, 'implementer');
});

test('a renamed session keeps its revocation: its process-table row follows the rename, and a relaunch is not granted the old role', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const launched = await launchCodex(ui, 'coord', { role: 'coordinator' });
  assert.equal(launched.ok, true, launched.error);
  await presentAs(ui, 'coord', 'idle');
  // the session renames itself (its model calls `rename`)
  assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text: 'rename to boss', to: ['coord'] })).ok, true);
  await ui.waitFor((f) => f.type === 'message' && (f.message as { from: string; text: string }).from === 'boss' && (f.message as { text: string }).text === 'pong: rename to boss', 15_000);
  const rows = await processes(ui);
  assert.deepEqual(rows.map((p) => [p.name, p.role]), [['boss', 'coordinator']]);

  // the human revokes it; it dies; a relaunch under its name is not granted the role back
  assert.equal((await ui.request({ type: 'role.clear', session: 'boss' })).ok, true);
  assert.equal((await processes(ui)).find((p) => p.name === 'boss')?.role, null);
  await killDaemon((launched.value as { process: Harness }).process.pid as number);
  await eventually('exited', async () => ((await processes(ui)).find((p) => p.name === 'boss')?.status === 'exited' ? true : undefined));
  const resumed = await ui.request({ type: 'session.resume', session: 'boss', relaunch: true }, 30_000);
  assert.equal(resumed.ok, true, resumed.error);
  await eventually('the relaunched spoke refused', async () => ((await hubLog(root)).includes('"event":"refused-role","name":"boss"') ? true : undefined));
  const status = (await ui.request({ type: 'hub.status' })).value as { sessions: Array<{ name: string }>; coordinator: string | null };
  assert.equal(status.coordinator, null);
  assert.ok(!status.sessions.some((s) => s.name === 'boss'));
});

test('a hub that dies between a launch reserving the Coordinator and its spawn gives the role back at its next start', async (t) => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const first = await startDaemon(t, root, { ...fake.env, CLAND_TEST_CRASH_AT: 'launch-reserved' });
  const ui = await connectUi(t, first.discovery);
  await ui.request({ type: 'session.launch', name: 'coord', role: 'coordinator', harness: 'codex' }, 5000).catch(() => undefined);
  await eventually('the hub is gone', () => {
    try {
      process.kill(first.discovery.pid, 0);
      return undefined;
    } catch {
      return true;
    }
  });
  // The store persists the reservation; its queued diagnostic may be lost at SIGKILL.

  const second = await startDaemon(t, root, fake.env);
  const again = await connectUi(t, second.discovery);
  assert.deepEqual(await holders(again, 'coordinator'), []);
  assert.equal((await again.request({ type: 'hub.status', flushLogs: true })).ok, true);
  assert.match(await hubLog(root), /"event":"role-reservation-released","session":"coord","role":"coordinator"[^\n]*"reason":"interrupted"/);
  // the role is free: another launch for it goes through
  const launched = await again.request({ type: 'session.launch', name: 'coord-2', role: 'coordinator', harness: 'codex' }, 30_000);
  assert.equal(launched.ok, true, launched.error);
});
