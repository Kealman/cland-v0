import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startHub, spawnSpoke, sleep, waitForAbsence, type Session } from './harness.ts';

const statusIn = (viewer: Session) => async (name: string) => (await viewer.call<{ sessions: Array<{ name: string; status: string | null }> }>('who')).sessions.find((d) => d.name === name)?.status;

test('status is one line others see; a reconnect of the same name keeps it, a fresh name starts with null', async () => {
  const hub = await startHub();
  const alpha = await spawnSpoke({ hub, name: 'alpha', sessionId: 'sess-a' });
  let beta = await spawnSpoke({ hub, name: 'beta', sessionId: 'sess-b' });
  let gamma: Session | null = null;
  try {
    await alpha.waitForPresence(['alpha', 'beta']);
    await beta.waitForPresence(['alpha', 'beta']); // beta's own calls need beta connected, not only listed
    const statusOf = statusIn(alpha);
    const set = await beta.call<{ ok: boolean; status: string }>('status', { text: 'rate-cache: implement #334, tests running' });
    assert.equal(set.status, 'rate-cache: implement #334, tests running');
    assert.equal(await statusOf('beta'), 'rate-cache: implement #334, tests running');
    // the spoke reconnects (a restart, a resume, a hub blip): the name is the same work, the line survives
    await beta.close();
    beta = await spawnSpoke({ hub, name: 'beta', sessionId: 'sess-b' });
    await alpha.waitForPresence(['beta']);
    await beta.waitForPresence(['beta']);
    assert.equal(await statusOf('beta'), 'rate-cache: implement #334, tests running');
    // a name the hub has never seen starts with nothing
    gamma = await spawnSpoke({ hub, name: 'gamma', sessionId: 'sess-g' });
    await alpha.waitForPresence(['gamma']);
    assert.equal(await statusOf('gamma'), null);
    // an emptied status stays empty across a reconnect
    await beta.call('status', { text: '   ' });
    await beta.close();
    beta = await spawnSpoke({ hub, name: 'beta', sessionId: 'sess-b' });
    await alpha.waitForPresence(['beta']);
    assert.equal(await statusOf('beta'), null);
    // a generated name belongs to the session it was generated for: the next unnamed session gets a fresh
    // one and no line, and a session that asks for session-1 BY NAME inherits nobody else's line either
    let anon = await spawnSpoke({ hub, sessionId: 'sess-anon-1' });
    await alpha.waitForPresence(['session-1']);
    await anon.waitForPresence(['session-1']);
    await anon.call('status', { text: "somebody else's work" });
    await anon.close();
    await waitForAbsence(alpha, 'session-1');
    anon = await spawnSpoke({ hub, sessionId: 'sess-anon-2' });
    try {
      await alpha.waitForPresence(['session-2']);
      assert.equal(await statusOf('session-2'), null);
    } finally {
      await anon.close();
    }
    await waitForAbsence(alpha, 'session-2');
    anon = await spawnSpoke({ hub, name: 'session-1', sessionId: 'sess-anon-3' });
    try {
      await alpha.waitForPresence(['session-1']);
      assert.equal(await statusOf('session-1'), null, "another session's line is not inherited with the name");
    } finally {
      await anon.close();
    }
  } finally {
    await alpha.close();
    await beta.close();
    await gamma?.close();
    await hub.close();
  }
});

test('the status follows a rename, and a name unseen for longer than the queue TTL comes back with none', async () => {
  // A fake clock: "unseen for longer than the TTL" is the hub's clock moving past it once the hub has seen the
  // session leave, never a real-time sleep racing the hub's processing of the close on a loaded machine.
  let now = Date.parse('2026-10-08T12:00:00Z');
  const hub = await startHub({ queueTtlMs: 60_000, now: () => new Date(now) });
  const alpha = await spawnSpoke({ hub, name: 'alpha', sessionId: 'sess-a' });
  let beta = await spawnSpoke({ hub, name: 'beta', sessionId: 'sess-b' });
  try {
    await alpha.waitForPresence(['alpha', 'beta']);
    await beta.waitForPresence(['alpha', 'beta']);
    const statusOf = statusIn(alpha);
    await beta.call('status', { text: 'pool-7: integrate' });
    await beta.call('rename', { name: 'pool-7' });
    await alpha.waitForPresence(['pool-7']);
    assert.equal(await statusOf('pool-7'), 'pool-7: integrate');
    // a name unseen for longer than the queue TTL is history: its old line is not restored —
    // and a reconnect right after that finds nothing either (the stale line was dropped, not parked)
    await beta.close();
    await waitForAbsence(alpha, 'pool-7');
    now += 61_000;
    beta = await spawnSpoke({ hub, name: 'pool-7', sessionId: 'sess-b' });
    await alpha.waitForPresence(['pool-7']);
    assert.equal(await statusOf('pool-7'), null);
    await beta.close();
    await waitForAbsence(alpha, 'pool-7');
    beta = await spawnSpoke({ hub, name: 'pool-7', sessionId: 'sess-b' });
    await alpha.waitForPresence(['pool-7']);
    assert.equal(await statusOf('pool-7'), null, 'the stale line does not resurrect on the next blip');
  } finally {
    await alpha.close();
    await beta.close();
    await hub.close();
  }
});

test('a heartbeat keeps a long-lived session inside the status window; a session that never pinged loses its line past the window', async () => {
  // A fake clock: the window is measured against last_seen, which a heartbeat touches.
  let now = Date.parse('2026-10-08T12:00:00Z');
  const hub = await startHub({ queueTtlMs: 60_000, now: () => new Date(now) });
  const alpha = await spawnSpoke({ hub, name: 'alpha', sessionId: 'sess-a' });
  let beta = await spawnSpoke({ hub, name: 'beta', sessionId: 'sess-b', heartbeatMs: 50 }); // pings 20× a second
  let quiet = await spawnSpoke({ hub, name: 'quiet', sessionId: 'sess-q' }); // the default 30 s heartbeat: no ping during this test
  try {
    await alpha.waitForPresence(['alpha', 'beta', 'quiet']);
    await beta.waitForPresence(['beta']);
    await quiet.waitForPresence(['quiet']);
    await beta.call('status', { text: 'still here' });
    await quiet.call('status', { text: 'went quiet' });
    now += 61_000; // both hellos are now older than the window
    await sleep(1_000); // beta pings at the advanced clock; quiet never does
    await beta.close();
    await quiet.close();
    await waitForAbsence(alpha, 'beta');
    await waitForAbsence(alpha, 'quiet');
    beta = await spawnSpoke({ hub, name: 'beta', sessionId: 'sess-b' });
    quiet = await spawnSpoke({ hub, name: 'quiet', sessionId: 'sess-q' });
    await alpha.waitForPresence(['beta', 'quiet']);
    const statusOf = statusIn(alpha);
    assert.equal(await statusOf('beta'), 'still here', 'the heartbeat kept last_seen inside the window');
    assert.equal(await statusOf('quiet'), null, 'without a heartbeat the window closed — the control arm');
  } finally {
    await alpha.close();
    await beta.close();
    await quiet.close();
    await hub.close();
  }
});
