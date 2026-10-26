// T2: trusted fake-messenger ingress and the hub frame protocol; no platform or token.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cland, connectUi, projectHub, tempProject } from './harness.ts';
import { testMessenger } from './fakes/messenger.ts';
import { FakeClock } from './fake-clock.ts';
import type { Inbox } from '../src/protocol.ts';
import { gatewayInbox } from '../src/remote/authority.ts';

async function inbox(local: Awaited<ReturnType<typeof connectUi>>): Promise<Inbox> {
  const result = await local.request({ type: 'inbox.list' });
  assert.equal(result.ok, true, result.error);
  return result.value as Inbox;
}

test('a stranger receives an eight-character pairing code with numeric id and the approve command', async t => {
  const root = await tempProject(t);
  const remote = testMessenger('telegram');
  await projectHub(t, root, {}, { gatewayRemotes: [remote], clock: new FakeClock() });
  const reply = remote.pair({ userId: '12345', chatId: '12345', guildId: null, name: 'Fixture human' });
  assert.ok(reply);
  const code = /code ([A-HJ-NP-Z2-9]{8})/.exec(reply)?.[1];
  assert.ok(code, reply);
  assert.match(reply, /user 12345/);
  assert.ok(reply.includes(`cland remote approve telegram ${code}`));
  assert.match(reply, /ask the project's owner to approve/);
});

for (const [messenger, lifetime] of [['telegram', 3600_000], ['discord', 900_000]] as const) {
  test(`${messenger} pairing rows need the human, expire at ${lifetime} ms and never reach either remote`, async t => {
    const root = await tempProject(t);
    const clock = new FakeClock();
    const remotes = [testMessenger('telegram', 'telegram'), testMessenger('discord', 'discord')];
    const hub = await projectHub(t, root, {}, { gatewayRemotes: remotes, clock });
    const local = await connectUi(t, hub.discovery); // Previous hello shape: no new features required.
    assert.equal((await local.request({ type: 'subscribe' })).ok, true);
    const baseline = (await inbox(local)).needsYou;
    const changed = local.waitFor(frame => frame.type === 'inbox' && (frame.inbox as Inbox).pairings?.some(row => row.userId === '12345') === true);
    void changed.catch(() => {}); // Preserve the assertion failure if setup fails before the armed observer.
    const source = remotes.find(remote => remote.via === messenger)!;
    const identity = { userId: '12345', chatId: '12345', guildId: messenger === 'discord' ? '67890' : null, name: 'Fixture human' };
    const reply = source.pair(identity)!;
    const code = /code ([A-HJ-NP-Z2-9]{8})/.exec(reply)![1]!;
    const list = await inbox(local);
    const row = list.pairings?.find(row => row.code === code);
    assert.ok(row, JSON.stringify({ reply, code, list }));
    assert.equal(list.needsYou, baseline + 1);
    assert.equal(row.layer, 'now');
    assert.equal(row.messenger, messenger);
    assert.equal(row.userId, identity.userId);
    assert.equal(row.chatId, identity.chatId);
    assert.equal(row.guildId, identity.guildId);
    assert.equal(row.text, `Pair ${messenger === 'telegram' ? 'Telegram' : 'Discord'} user 12345 (Fixture human)? code ${code}`);
    assert.equal(row.command, `cland remote approve ${messenger} ${code}`);
    assert.equal(Date.parse(row.expires) - Date.parse(row.since), lifetime);
    for (const remote of remotes) for (const action of [
      { type: 'topic.answer', ask: row.id, option: 1 },
      { type: 'approval.answer', approval: row.id, choice: 'once' },
      { type: 'pairing.approve', pairing: row.id },
    ]) {
      const refused = await remote.client.request(action);
      assert.equal(refused.ok, false);
      assert.equal((refused as { code?: string }).code, 'forbidden', JSON.stringify(refused));
    }
    assert.equal((await inbox(local)).pairings?.[0]?.id, row.id, 'a remote cannot change the waiting pairing');
    await clock.advance(250);
    assert.equal((await changed).type, 'inbox');
    for (const remote of remotes) {
      const listed = await inbox(remote.client);
      assert.equal(listed.pairings, undefined);
      assert.equal(listed.needsYou, baseline);
      const status = await remote.client.request({ type: 'hub.status' });
      assert.equal(status.ok, true);
      assert.equal((status.value as { needsYou: number }).needsYou, baseline);
      assert.ok(!JSON.stringify(remote.client.frames).includes(code), 'no broadcast or read discloses a waiting code to a remote');
    }
    clock.block(lifetime - 251);
    assert.equal((await inbox(local)).pairings?.some(pair => pair.id === row.id), true, 'the code is live one millisecond before expiry');
    await clock.advance(1);
    const expired = await inbox(local);
    assert.deepEqual(expired.pairings, []);
    assert.equal(expired.needsYou, baseline);
    // A new sender gets the released capacity with a fresh, full lifetime.
    assert.match(source.pair({ ...identity, userId: '23456' })!, /code [A-HJ-NP-Z2-9]{8}/);
    const replacement = (await inbox(local)).pairings![0]!;
    assert.equal(replacement.userId, '23456');
    assert.equal(Date.parse(replacement.since), clock.now().getTime());
    assert.equal(Date.parse(replacement.expires) - Date.parse(replacement.since), lifetime);
    await hub.stop();
  });
}

for (const messenger of ['telegram', 'discord'] as const) test(`${messenger} keeps three waiting codes and replies twice per stranger, then stays silent across restart`, async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const remote = testMessenger(messenger, messenger);
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [remote], clock });
  const identity = { userId: '9007199254740993', chatId: '1234567890123456789', guildId: messenger === 'discord' ? '987654321098765432' : null, name: 'Fixture stranger' };
  const since = clock.now().getTime();
  const first = remote.pair(identity);
  assert.ok(first);
  clock.block(1000);
  assert.equal(remote.pair({ ...identity, name: 'Renamed' }), first, 'second reply repeats the same waiting code without extending its lifetime');
  assert.equal(remote.pair(identity), null);
  assert.equal(remote.pair({ ...identity, chatId: '1234567890123456790' }), null, 'changing the chat cannot reset the user reply limit');
  for (const userId of ['2', '3']) assert.match(remote.pair({ ...identity, userId })!, /code [A-HJ-NP-Z2-9]{8}/);
  const fourth = { ...identity, userId: '4' };
  assert.match(remote.pair(fourth)!, /three pairing codes are already waiting/i);
  assert.match(remote.pair(fourth)!, /three pairing codes are already waiting/i);
  assert.equal(remote.pair(fourth), null, 'capacity refusal also consumes the reply allowance');
  const local = await connectUi(t, hub.discovery);
  const rows = (await inbox(local)).pairings!;
  assert.equal(rows.length, 3);
  const original = rows.find(row => row.userId === identity.userId)!;
  assert.equal(original.userId, '9007199254740993');
  assert.equal(original.chatId, identity.chatId);
  assert.equal(Date.parse(original.since), since);
  assert.equal(Date.parse(original.expires), since + (messenger === 'telegram' ? 3600_000 : 900_000));
  assert.equal(new Set(rows.map(row => row.code)).size, 3);
  await hub.stop();
  const restarted = testMessenger(messenger, messenger);
  await projectHub(t, root, {}, { gatewayRemotes: [restarted], clock });
  assert.equal(restarted.pair(identity), null, 'reply counts survive a hub restart');
  assert.match(restarted.pair({ ...identity, userId: '5' })!, /three pairing codes are already waiting/i, 'waiting cap survives restart');
});

test('the remote inbox projection preserves the previous wire shape from an older hub', () => {
  const old: Inbox = { asks: [], approvals: [], plans: [], requests: [], messages: [], waiting: [], needsYou: 2 };
  assert.deepEqual(gatewayInbox(old), old);
});

test('the CLI inbox lists waiting pairings with ids and the command to copy', async t => {
  const root = await tempProject(t);
  const remote = testMessenger('telegram');
  await projectHub(t, root, {}, { gatewayRemotes: [remote], clock: new FakeClock() });
  const reply = remote.pair({ userId: '12345', chatId: '12345', guildId: null, name: 'Fixture human' })!;
  const code = /code ([A-HJ-NP-Z2-9]{8})/.exec(reply)![1]!;
  const listed = await cland(root, 'inbox');
  assert.equal(listed.code, 0, listed.stderr);
  assert.ok(listed.stdout.includes(`pairing:telegram:${code}`), listed.stdout);
  assert.ok(listed.stdout.includes(`Pair Telegram user 12345 (Fixture human)? code ${code}`), listed.stdout);
  assert.ok(listed.stdout.includes(`cland remote approve telegram ${code}`), listed.stdout);
  assert.match(listed.stdout, /needs you: 1/);
});

test('pairing callbacks keep registered secrets out of inbox identity text after gateway integration', async t => {
  const root = await tempProject(t);
  const fabricated = 'made-up-pairing-display-secret';
  const remote = testMessenger('telegram');
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [remote], clock: new FakeClock(), syntheticRemoteSecrets: { 'discord.token': fabricated } });
  const local = await connectUi(t, hub.discovery);
  const reply = remote.pair({ userId: '12345', chatId: '12345', guildId: null, name: `Fixture ${fabricated}` });
  assert.ok(reply && /code [A-HJ-NP-Z2-9]{8}/.test(reply), 'the merged gateway still binds the pairing callback');
  const listed = await inbox(local);
  assert.equal(listed.pairings?.[0]?.name, 'Fixture [redacted]');
  assert.ok(!JSON.stringify(listed).includes(fabricated), 'no registered secret enters the local pairing frame');
  assert.ok(!reply.includes(fabricated), 'the private reply contains only safe pairing facts');
  assert.equal((await remote.client.request({ type: 'hub.status' })).ok, true, 'the redacting gateway remains serving');
});
