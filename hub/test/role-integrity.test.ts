// T3: native first-turn clause and crashed launch reservation recovery.
// Role integrity under races, expiry, renames and failures (Codex review of #25/#26/#29/#31): the exclusive role is
// never held twice, revocations stick, a failed launch rolls back what it reserved, a handover survives a crash.
// Against a real daemon in a temporary project: spokes over MCP, the UI on the Unix socket, the fake harnesses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, eventually, fakeCodex, nativeProjectHub as projectHub, sleep, startDaemon, tempProject, type FrameClient } from './harness.ts';

type Holder = { name: string; role: string | null; live: boolean };

type RoleList = { roles: Array<{ role: string; holders: Holder[] }>; coordinator: string | null };

const hubLog = (root: string) => readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8');

async function holders(ui: FrameClient, role: string): Promise<string[]> {
  const r = await ui.request({ type: 'role.list' });
  assert.equal(r.ok, true, r.error);
  return ((r.value as RoleList).roles.find((x) => x.role === role)?.holders ?? []).map((h) => h.name);
}

type Harness = { name: string; role: string | null; pid: number | null; sessionId: string; status: string; state: string };

async function launchCodex(ui: FrameClient, name: string, extra: Record<string, unknown> = {}) {
  return ui.request({ type: 'session.launch', name, harness: 'codex', ...extra }, 30_000);
}

const presentAs = (ui: FrameClient, name: string, state: string) =>
  eventually(`${name} present as ${state}`, async () => {
    const s = ((await ui.request({ type: 'hub.status' })).value as { sessions: Array<{ name: string; state: string; role: string | null }> }).sessions.find((x) => x.name === name);
    return s?.state === state ? s : undefined;
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
