import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startHub, spawnSpoke, sleep, waitForAbsence, type Session } from './harness.ts';
import type { Hub } from '../src/hub/server.ts';

test('a session with no requested name gets session-<n> with the lowest n no session has held, and a freed name stays with its session', async () => {
  const hub = await startHub();
  const one = await spawnSpoke({ hub, sessionId: 'sess-1' });
  const two = await spawnSpoke({ hub, sessionId: 'sess-2' });
  try {
    await one.waitForPresence(['session-1', 'session-2']);
    await one.close();
    await waitForAbsence(two, 'session-1');
    const three = await spawnSpoke({ hub, sessionId: 'sess-3' });
    await three.waitForPresence(['session-2', 'session-3']); // session-1 belongs to sess-1, offline or not
    assert.equal((await three.call<{ me: string }>('who')).me, 'session-3');
    await three.close();
  } finally {
    await two.close();
    await hub.close();
  }
});

test('a requested name that is live in ANOTHER session is refused, and the second spoke takes a generated one after its retries', async () => {
  const hub = await startHub();
  const first = await spawnSpoke({ hub, name: 'rate-cache', sessionId: 'sess-first' });
  await first.waitForPresence(['rate-cache']); // the first is on the hub before the second asks for its name
  const second = await spawnSpoke({ hub, name: 'rate-cache', sessionId: 'sess-second' });
  try {
    await second.waitForPresence(['rate-cache', 'session-1'], 10_000);
    const who = await second.call<{ me: string; note?: string }>('who');
    assert.equal(who.me, 'session-1');
    assert.match(who.note ?? '', /"rate-cache" is in use by a live session/);
    assert.match(second.log(), /requested name "rate-cache" in use .* retrying it \(1\/5\)/, 'the name was retried before the fallback');
  } finally {
    await first.close();
    await second.close();
    await hub.close();
  }
});

test('a reserved or malformed requested name is refused with the reason, and the spoke falls back to a generated one', async () => {
  const hub = await startHub({ reservedNames: ['human'] });
  const reserved = await spawnSpoke({ hub, name: 'human', sessionId: 'sess-r' });
  const role = await spawnSpoke({ hub, name: 'reviewer', sessionId: 'sess-role' });
  const bad = await spawnSpoke({ hub, name: 'Not A Name!', sessionId: 'sess-bad' });
  try {
    await reserved.waitForPresence(['session-1', 'session-2', 'session-3']);
    // each spoke's own calls once it is connected (the hub lists a session before its spoke read the welcome)
    for (const s of [role, bad]) await s.waitForPresence(['session-1', 'session-2', 'session-3']);
    assert.match((await reserved.call<{ note?: string }>('who')).note ?? '', /"human" is reserved/);
    assert.match((await role.call<{ note?: string }>('who')).note ?? '', /"reviewer" is reserved/, 'a role name is never a session name');
    assert.match((await bad.call<{ note?: string }>('who')).note ?? '', /must match/);
  } finally {
    await reserved.close();
    await role.close();
    await bad.close();
    await hub.close();
  }
});

// T-51: a harness may run more than one spoke for one session (Codex starts one per thread of its app-server; an
// MCP reconnect leaves the old socket standing). Closing the older one left the harness calling tools on a spoke that
// refused them for good.
test('a second spoke of the same session joins it: both are answered as the session, deliveries go to the newest, and to the one that is left when it goes', async () => {
  const hub = await startHub();
  const first = await spawnSpoke({ hub, name: 'alpha', sessionId: 'sess-a' });
  const witness = await spawnSpoke({ hub, name: 'witness', sessionId: 'sess-w' });
  let second: Session | null = null;
  try {
    await witness.waitForPresence(['alpha', 'witness']);
    await first.call('status', { text: 'mid-task' });
    second = await spawnSpoke({ hub, name: 'alpha', sessionId: 'sess-a' });
    await second.waitForPresence(['alpha', 'witness']);
    const who = await second.call<{ me: string; sessions: Array<{ name: string; status: string | null }> }>('who');
    assert.equal(who.me, 'alpha', 'the second spoke is the session: its name, not a generated one');
    assert.deepEqual(who.sessions.filter((d) => d.name === 'alpha').map((d) => d.status), ['mid-task'], 'one session, with the status it had');

    // the first spoke still stands and still is the session: its calls are answered, and what it sets is the session's
    await sleep(300);
    const still = await first.call<{ ok: boolean; me?: string; error?: string }>('who');
    assert.equal(still.ok, true, still.error);
    assert.equal(still.me, 'alpha');
    assert.equal((await first.call<{ ok: boolean }>('status', { text: 'set through the first spoke' })).ok, true);
    const seen = await witness.call<{ sessions: Array<{ name: string; status: string | null }> }>('who');
    assert.deepEqual(seen.sessions.filter((d) => d.name === 'alpha').map((d) => d.status), ['set through the first spoke'], 'one holder of the name');

    // a message to the name reaches the newest spoke, once
    await witness.call('send', { to: ['alpha'], text: 'which one of you?' });
    await second.waitForEvent((e) => e.params.content === 'which one of you?');
    assert.equal(first.events.filter((e) => e.params.content === 'which one of you?').length, 0);

    // the newest goes: the session stays, and its deliveries go to the spoke that is left
    await second.close();
    second = null;
    await witness.call('send', { to: ['alpha'], text: 'and now?' });
    await first.waitForEvent((e) => e.params.content === 'and now?');
    assert.equal((await witness.call<{ sessions: Array<{ name: string }> }>('who')).sessions.filter((d) => d.name === 'alpha').length, 1);

    // the last one goes: the session is offline
    await first.close();
    await witness.waitForPresence(['witness']);
  } finally {
    await second?.close();
    await first.close();
    await witness.close();
    await hub.close();
  }
});

test('a spoke refused name-in-use runs generated while the holder lives, and gets its name again once the holder is gone', async () => {
  const hub = await startHub();
  const holder = await spawnSpoke({ hub, name: 'impl-1', sessionId: 'sess-other' });
  await holder.waitForPresence(['impl-1']);
  let mine = await spawnSpoke({ hub, name: 'impl-1', sessionId: 'sess-mine' });
  try {
    await mine.waitForPresence(['session-1'], 10_000); // after NAME_RETRIES refusals of the requested name
    assert.equal((await mine.call<{ me: string }>('who')).me, 'session-1');
    await mine.close();
    await holder.close();
    // the holder is gone (its close may still be in flight — the retries cover that): the next start is impl-1 again
    mine = await spawnSpoke({ hub, name: 'impl-1', sessionId: 'sess-mine' });
    await mine.waitForPresence(['impl-1'], 10_000);
    assert.equal((await mine.call<{ me: string }>('who')).me, 'impl-1');
  } finally {
    await mine.close();
    await holder.close();
    await hub.close();
  }
});

test('rename claims a new name under the rules, and the old name stops resolving', async () => {
  const hub = await startHub();
  const alpha = await spawnSpoke({ hub, name: 'alpha', sessionId: 'sess-a' });
  const beta = await spawnSpoke({ hub, name: 'beta', sessionId: 'sess-b' });
  try {
    await alpha.waitForPresence(['alpha', 'beta']);
    await beta.waitForPresence(['alpha', 'beta']);
    for (const [name, reason] of [
      ['Rate Cache', /must match/],
      ['all', /reserved/],
      ['qa', /reserved/],
      ['beta', /in use by a live session/],
    ] as const) {
      const r = await alpha.call<{ ok: boolean; error?: string }>('rename', { name });
      assert.equal(r.ok, false, name);
      assert.match(r.error ?? '', reason);
    }
    const ok = await alpha.call<{ ok: boolean; name: string }>('rename', { name: 'rate-cache' });
    assert.deepEqual(ok, { ok: true, name: 'rate-cache' });
    assert.equal((await alpha.call<{ me: string }>('who')).me, 'rate-cache');
    const sent = await beta.call<{ outcomes: Array<{ to: string; outcome: string }> }>('send', { to: ['alpha', 'rate-cache'], text: 'hi' });
    assert.deepEqual(sent.outcomes.map((o) => `${o.to}:${o.outcome}`), ['alpha:unknown', 'rate-cache:delivered']);
    await alpha.waitForEvent((e) => e.params.content === 'hi');
    await waitForAbsence(beta, 'alpha', 100);
  } finally {
    await alpha.close();
    await beta.close();
    await hub.close();
  }
});

test("a new unnamed session never takes an offline session's generated name, and never sees what was queued for it", async () => {
  const hub = await startHub();
  const witness = await spawnSpoke({ hub, name: 'witness', sessionId: 'sess-w' });
  let first = await spawnSpoke({ hub, sessionId: 'sess-first' });
  let newcomer: Session | null = null;
  try {
    await witness.waitForPresence(['witness', 'session-1']);
    await first.close();
    await waitForAbsence(witness, 'session-1');
    const sent = await witness.call<{ outcomes: Array<{ outcome: string }> }>('send', { to: ['session-1'], text: 'for the first session only' });
    assert.equal(sent.outcomes[0]?.outcome, 'queued');

    newcomer = await spawnSpoke({ hub, sessionId: 'sess-newcomer' });
    await newcomer.waitForPresence(['session-2']);
    assert.equal((await newcomer.call<{ me: string }>('who')).me, 'session-2', 'the offline name stays with its session');
    const history = await newcomer.call<{ messages: unknown[] }>('history');
    assert.deepEqual(history.messages, [], "no history of another session's name");
    await sleep(100);
    assert.equal(newcomer.events.length, 0, 'nothing queued for session-1 reached the newcomer');

    // the first session comes back with no name requested: the hub knows it by its session id
    first = await spawnSpoke({ hub, sessionId: 'sess-first' });
    await first.waitForEvent((e) => e.params.content === 'for the first session only');
    assert.equal((await first.call<{ me: string }>('who')).me, 'session-1');
  } finally {
    await newcomer?.close();
    await first.close();
    await witness.close();
    await hub.close();
  }
});

test('a generated name a session renamed away from is never handed to a new session, which sees none of its history', async () => {
  const hub = await startHub();
  const witness = await spawnSpoke({ hub, name: 'witness', sessionId: 'sess-w' });
  const first = await spawnSpoke({ hub, sessionId: 'sess-first' });
  let newcomer: Session | null = null;
  try {
    await witness.waitForPresence(['witness', 'session-1']);
    await first.waitForPresence(['witness', 'session-1']);
    await witness.call('send', { to: ['session-1'], text: 'for the first session only' });
    await first.waitForEvent((e) => e.params.content === 'for the first session only');
    await first.call('send', { to: ['witness'], text: 'from the first session' });
    assert.deepEqual(await first.call('rename', { name: 'alpha' }), { ok: true, name: 'alpha' });

    newcomer = await spawnSpoke({ hub, sessionId: 'sess-newcomer' });
    await newcomer.waitForPresence(['alpha', 'session-2']);
    assert.equal((await newcomer.call<{ me: string }>('who')).me, 'session-2', 'session-1 appears in the history: it is never reused');
    const history = await newcomer.call<{ messages: Array<{ text: string }> }>('history');
    assert.deepEqual(history.messages, [], "no history of another session's name");
  } finally {
    await newcomer?.close();
    await first.close();
    await witness.close();
    await hub.close();
  }
});

test('an unnamed spoke keeps its accepted name across reconnects, even to a hub that lost its memory', async () => {
  const hub = await startHub();
  const port = hub.port;
  const other = await spawnSpoke({ hub, sessionId: 'sess-other' });
  await other.waitForPresence(['session-1']);
  const spoke = await spawnSpoke({ hub, sessionId: 'sess-mine' });
  let second: Hub | null = null;
  try {
    await spoke.waitForPresence(['session-1', 'session-2']);
    assert.equal((await spoke.call<{ me: string }>('who')).me, 'session-2');
    await other.close();
    await hub.close();
    // a fresh in-memory store knows no names: the spoke asks for the one it was given
    second = await startHub({ port });
    await spoke.waitForPresence(['session-2'], 10_000);
    assert.equal((await spoke.call<{ me: string }>('who')).me, 'session-2');
  } finally {
    await spoke.close();
    await other.close();
    await second?.close();
  }
});
