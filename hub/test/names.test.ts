import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startHub, spawnSpoke, sleep, waitForAbsence, type Session } from './harness.ts';

test('a session with no requested name gets session-<n> with the lowest free n', async () => {
  const hub = await startHub();
  const one = await spawnSpoke({ hub, sessionId: 'sess-1' });
  const two = await spawnSpoke({ hub, sessionId: 'sess-2' });
  try {
    await one.waitForPresence(['session-1', 'session-2']);
    await one.close();
    const three = await spawnSpoke({ hub, sessionId: 'sess-3' });
    await three.waitForPresence(['session-1', 'session-2']); // the freed 1 is reused
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
    await first.waitForPresence(['rate-cache', 'session-1'], 10_000);
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

test('a restart of the same session takes its name back from the stale spoke, and the stale one does not reconnect', async () => {
  const hub = await startHub();
  const stale = await spawnSpoke({ hub, name: 'alpha', sessionId: 'sess-a' });
  const witness = await spawnSpoke({ hub, name: 'witness', sessionId: 'sess-w' });
  let fresh: Session | null = null;
  try {
    await witness.waitForPresence(['alpha', 'witness']);
    await stale.call('status', { text: 'mid-task' });
    // the same session's spoke restarts while the old socket still stands (an MCP reconnect, a resume)
    fresh = await spawnSpoke({ hub, name: 'alpha', sessionId: 'sess-a' });
    await fresh.waitForPresence(['alpha', 'witness']);
    const who = await fresh.call<{ me: string; sessions: Array<{ name: string; status: string | null }> }>('who');
    assert.equal(who.me, 'alpha', 'the restart is the session: it takes the name, not a generated one');
    assert.deepEqual(who.sessions.filter((d) => d.name === 'alpha').map((d) => d.status), ['mid-task'], 'one holder, and the status followed the name');
    await sleep(300);
    const replaced = await stale.call<{ ok: boolean; error?: string }>('who');
    assert.equal(replaced.ok, false);
    assert.match(replaced.error ?? '', /replaced: a newer spoke of this session took the name/);
    const again = await witness.call<{ sessions: Array<{ name: string }> }>('who');
    assert.equal(again.sessions.filter((d) => d.name === 'alpha').length, 1, 'the stale spoke did not take the name back');
    // a message to the name reaches the fresh spoke, never the stale one
    await witness.call('send', { to: ['alpha'], text: 'which one of you?' });
    await fresh.waitForEvent((e) => e.params.content === 'which one of you?');
    assert.equal(stale.events.length, 0);
  } finally {
    await fresh?.close();
    await stale.close();
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
