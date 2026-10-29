// T3: one paired Telegram/Discord hub, modal answer, media, restart and fatal isolation.
// Rules: discord-cards, discord-inbound-media, telegram-voice, telegram-liveness (T2).
// Three projectHub starts, sequential: initial, 30-second restart, four-minute restart.
// No daemon processes or browsers; native loopback HTTP/ws and production frame port.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { remotesFixture } from '../remotes-fixture.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inProcessSpoke, connectUi, until } from '../harness.ts';
import type { Inbox, TopicMessage, RemoteStatusResult } from '../../src/protocol.ts';
import type { TgMessage } from '../../src/remote/telegram-api.ts';
import { DISCORD_IDS as ids } from '../fakes/discord/fake-api.ts';
import { control } from '../telegram-polling-fixture.ts';
import { driveTelegram } from '../telegram-pacing-fixture.ts';

test('Both remotes share answers, media, restart catch-up and isolate revoked Telegram', async t => {
  const { owner, clock, exchange, root, tg, speech, discord, telegram, start } = await remotesFixture(t);
  let hub: Awaited<ReturnType<typeof start>>;
  await exchange.fake.control('configure', { interval: 1000000, sendLimit: 1000, sendWindow: 0, reactionWindow: 0 });
  hub = await start();
  await until(async () => (await exchange.fake.control('state')).gateway.identifies === 1, { what: 'native Discord READY', timeoutMs: 2000 });
  await exchange.fake.control('dispatch', { op: 1, d: null });
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  let ui = await connectUi(t, hub!.discovery, 'nvim');
  const history = async () => ((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages;
  const tgMessages = async () => (await control<{ messages: TgMessage[] }>(tg.url, 'state')).messages;
  const drive = <T>(work: Promise<T>) => driveTelegram(clock, telegram, work);
  const ask = await coord.call<{ ask: string }>('ask', { topic: 'general', question: 'Integrated choice?', options: ['Keep'], free: true });
  await clock.advance(250);
  await drive(until(() => discord.messagesForAsk(ask.ask).length === 1 && telegram.messagesForAsk(ask.ask).length === 1,
    { what: 'both native cards durably mapped', timeoutMs: 2000 }));
  const message = discord.messagesForAsk(ask.ask)[0]!.messageId;
  const click = await exchange.fake.control('interact', { message_id: message, custom_id: `ask:${ask.ask}:other` });
  await until(async () => !!(await exchange.fake.control('state')).interactions.find(r => r.id === click.id)?.callbacks.length,
    { what: 'native modal receipt', timeoutMs: 2000 });
  const modal = (await exchange.fake.control('state')).interactions.find(r => r.id === click.id)!.callbacks[0] as { type: number; data: { custom_id: string } };
  assert.equal(modal.type, 9);
  await exchange.fake.control('interact', { message_id: message, custom_id: modal.data.custom_id, modal_text: 'Ship together' });
  await drive(until(async () => (await tgMessages()).some(m => m.text?.includes('Ship together') && m.reply_markup && 'inline_keyboard' in m.reply_markup && m.reply_markup.inline_keyboard.length === 0),
    { what: 'Telegram outcome edit', timeoutMs: 2000 }));
  const answers = (await history()).filter(m => m.answerTo === ask.ask);
  assert.equal(answers.length, 1); assert.equal(answers[0]!.text, 'Ship together');
  assert.equal(answers[0]!.from, 'human'); assert.equal(answers[0]!.via, 'discord');
  const saved = (await history()).filter(m => m.id === ask.ask);
  assert.equal(saved.length, 1);
  const outcome = saved[0]!.ask!.outcome!;
  assert.equal(outcome.status, 'answered');
  assert.equal(outcome.text, 'Ship together');
  assert.equal(saved[0]!.ask!.outcome!.via, 'discord');
  const inbox = (await ui.request({ type: 'inbox.list', archive: true })).value as Inbox;
  assert.ok(inbox.archive?.some(row => row.id === ask.ask && row.reason === 'answered'));
  for (const platform of ['telegram', 'discord'] as const) {
    for (const kind of ['photo', 'voice'] as const) {
      t.diagnostic(`${platform} ${kind}`);
      const bytes = Buffer.from(`${platform} original ${kind}`);
      const caption = `${platform} photo`;
      const expected = kind === 'voice' ? `🎤 heard ${platform === 'telegram' ? 'Telegram' : 'Discord'}` : caption;
      if (platform === 'telegram') {
        await control(tg.url, 'media', { items: [{ kind, duration: 12, ...(kind === 'photo' ? { caption } : {}), content: bytes.toString('base64') }] });
      } else {
        const id = `integrated-${kind}`;
        await exchange.fake.control('cdn', { id, content: bytes.toString('base64') });
        const native = await exchange.fake.control('say', { content: kind === 'photo' ? caption : '', ...(kind === 'voice' ? { flags: 8192 } : {}),
          attachments: [{ id, filename: kind === 'photo' ? 'photo.png' : 'voice.ogg', content_type: kind === 'photo' ? 'image/png' : 'audio/ogg',
            size: bytes.length, ...(kind === 'voice' ? { duration_secs: 12 } : {}), url: `${exchange.fake.url}/cdn/${id}` }] });
        await exchange.fake.control('dispatch', { op: 0, t: 'MESSAGE_CREATE', d: { ...native, attachments: [{ id, filename: kind === 'photo' ? 'photo.png' : 'voice.ogg', content_type: kind === 'photo' ? 'image/png' : 'audio/ogg', size: bytes.length, ...(kind === 'voice' ? { duration_secs: 12 } : {}), url: `${exchange.fake.url}/cdn/${id}` }] } });
      }
      await drive(until(async () => (await history()).some(m => m.text === expected), { what: `${platform} ${kind} stored`, timeoutMs: 1500 }));
      const rows = (await history()).filter(m => m.text === expected);
      assert.equal(rows.length, 1); assert.equal(rows[0]!.via, platform);
      assert.equal(rows[0]!.artifacts?.length, 1);
      assert.deepEqual(await readFile(rows[0]!.artifacts![0]!.path), bytes);
      const mark = platform === 'telegram' ? 'you (Telegram)' : 'you (Discord)';
      await drive(until(async () => platform === 'telegram'
        ? (await exchange.fake.control('state')).messages.some(m => m.content.includes(mark) && m.content.includes(expected))
        : (await tgMessages()).some(m => (m.caption ?? m.text ?? '').includes(mark) && (m.caption ?? m.text ?? '').includes(expected)),
      { what: `${platform} ${kind} cross-remote native receipt`, timeoutMs: 3000 }));
      const copies = platform === 'telegram'
        ? (await exchange.fake.control('state')).messages.filter(m => m.content.includes(mark) && m.content.includes(expected))
        : (await tgMessages()).filter(m => (m.caption ?? m.text ?? '').includes(mark) && (m.caption ?? m.text ?? '').includes(expected));
      assert.equal(copies.length, 1);
      const digest = createHash('sha256').update(bytes).digest('hex');
      const dcUploads = (await exchange.fake.control('state')).uploads;
      const tgUploads = (await control<{ uploads: Array<{ digest: string; size: number; method: string }> }>(tg.url, 'state')).uploads;
      const destination = platform === 'telegram' ? dcUploads.filter(u => u.sha256 === digest) : tgUploads.filter(u => u.digest === digest);
      assert.equal(destination.length, 1); assert.equal(destination[0]!.size, bytes.length);
      assert.equal(platform === 'telegram' ? tgUploads.filter(u => u.digest === digest).length : dcUploads.filter(u => u.sha256 === digest).length, 0, 'no source-platform file echo');
      if (platform === 'telegram') assert.equal((copies[0] as { attachments?: unknown[] }).attachments?.length, 1);
      else assert.ok((copies[0] as TgMessage).photo?.length || (copies[0] as TgMessage).document);

      await clock.advance(1000);
    }
  }
  assert.equal(speech.requests.length, 2);
  const open = await coord.call<{ ask: string }>('ask', { topic: 'general', question: 'Still open across restart?', options: ['Continue'] });
  await clock.advance(250);
  await drive(until(() => discord.messagesForAsk(open.ask).length === 1 && telegram.messagesForAsk(open.ask).length === 1,
    { what: 'open cards before restart', timeoutMs: 2000 }));
  await coord.close();
  for (const delay of [30000, 240000]) {
    const oldDiscord = discord.messagesForAsk(open.ask).map(m => m.messageId);
    const oldTelegram = telegram.messagesForAsk(open.ask).map(m => m.messageId);
    const closes = (await exchange.fake.control('state')).gateway.closes.length;
    ui.close();
    await hub!.stop();
    await until(async () => (await exchange.fake.control('state')).gateway.closes.length === closes + 1,
      { what: 'native Discord socket close before downtime clock', timeoutMs: 2000 });
    const offline = await exchange.fake.control('say', { content: `Discord offline ${delay}` });
    if (delay === 30000) {
      await exchange.fake.control('interact', { message_id: oldDiscord.at(-1), custom_id: `ask:${open.ask}:1` });
      await exchange.fake.control('dispatch', { op: 0, t: 'MESSAGE_CREATE', d: offline });
    }
    await control(tg.url, 'say', { text: `Telegram offline ${delay}` });
    await clock.advance(delay);
    hub = await start();
    if (delay === 240000) {
      await until(async () => discord.get('discord.session') === null && (await exchange.fake.control('state')).gateway.closes.length === closes + 2,
        { what: 'expired Resume cleared session and native socket closed', timeoutMs: 2000 });
      await clock.advance(5000);
    }
    ui = await connectUi(t, hub!.discovery, 'nvim');
    const paced = new Set<string>();
    await until(async () => {
      // A newly settled reaction is the receipt from which the Discord lane's
      // remaining 250 ms wait can be advanced, once per operation.
      for (const job of discord.outbox()) if (job.source?.startsWith('discord.reaction:') && job.state === 'sent' && !paced.has(job.id)) {
        paced.add(job.id); await clock.advance(250);
      }
      const jobs = telegram.outbox();
      if (!jobs.some(j => j.state === 'sending')) {
        const waits = jobs.filter(j => j.state === 'queued').map(() => Math.max(Number(telegram.get('telegram.outbox.holdUntil') ?? 0), Number(telegram.get('telegram.outbox.last:101') ?? -Infinity) + 1000) - clock.now().getTime()).filter(ms => ms > 0);
        if (waits.length) await clock.advance(Math.min(...waits));
      }
      const rows = await history();
      return rows.some(m => m.text.startsWith(`Discord offline ${delay}`)) && rows.some(m => m.text.startsWith(`Telegram offline ${delay}`))
        && discord.messagesForAsk(open.ask).length > oldDiscord.length
        && (delay === 30000 || telegram.messagesForAsk(open.ask).length > oldTelegram.length)
        && oldDiscord.every(id => discord.outbox().some(j => j.kind === 'edit' && j.target === id && j.state === 'sent'))
        && (delay === 30000 || oldTelegram.every(id => telegram.outbox().some(j => j.kind === 'edit' && j.target === `101:${id}` && j.state === 'sent')));
    }, { what: `both restart inputs and card retirement ${delay}`, timeoutMs: 4000 }).catch(async error => { t.diagnostic(JSON.stringify({ rows: (await history()).map(m => m.text), dc: discord.messagesForAsk(open.ask), tg: telegram.messagesForAsk(open.ask), dj: discord.outbox().map(j => [j.kind,j.target,j.state]), tj: telegram.outbox().map(j => [j.kind,j.target,j.state]), gateway: (await exchange.fake.control('state')).gateway })); throw error; });
    const rows = await history();
    for (const platform of ['Discord', 'Telegram']) {
      const caught = rows.filter(m => m.text.startsWith(`${platform} offline ${delay}`));
      assert.equal(caught.length, 1); assert.ok(caught[0]!.text.includes(`written on ${platform}`), caught[0]!.text);
    }
    const native = await exchange.fake.control('state');
    for (const id of oldDiscord) { assert.equal(native.messages.find(m => m.id === id)!.content, '↓ Re-sent below'); assert.deepEqual(native.messages.find(m => m.id === id)!.components, []); }
    if (delay === 30000) { assert.equal(native.gateway.resumes, 1); assert.equal(telegram.messagesForAsk(open.ask).length, oldTelegram.length); }
    else {
      assert.equal(native.gateway.identifies, 2);
      const messages = await tgMessages();
      for (const id of oldTelegram) assert.ok(messages.find(m => String(m.message_id) === id)!.text?.includes('↓ Re-sent below'));
    }
    const pending = (await ui.request({ type: 'inbox.list' })).value as Inbox;
    assert.ok(pending.asks.some(a => a.id === open.ask));
  }
  const nextPoll = exchange.run(signal => tg.waitForPoll(signal));
  await control(tg.url, 'release-polls', {});
  const poll = await nextPoll;
  await control(tg.url, 'fault', { method: 'getUpdates', code: 401 });
  const closed = exchange.run(signal => tg.waitForPollClose(poll.id, signal));
  await control(tg.url, 'release-polls', {});
  assert.equal(await closed, poll.id);
  const status = async () => (await ui.request({ type: 'remote.status' })).value as RemoteStatusResult;
  await until(async () => (await status()).remotes.find(r => r.messenger === 'telegram')?.connection === 'disabled',
    { what: 'revoked Telegram terminal status', timeoutMs: 2000 });
  assert.equal((await status()).remotes.find(r => r.messenger === 'telegram')!.stopCause, 'token');
  assert.ok((await history()).some(m => m.text.includes('wrong or revoked token (401)')));
  const input = await exchange.fake.control('say', { content: 'Discord still receives' });
  await exchange.fake.control('dispatch', { op: 0, t: 'MESSAGE_CREATE', d: input });
  await until(async () => (await history()).some(m => m.text === 'Discord still receives'), { what: 'Discord input after Telegram revoke', timeoutMs: 2000 });
  assert.equal((await history()).filter(m => m.text === 'Discord still receives').length, 1);
  const sent = await ui.request({ type: 'topic.send', topic: 'general', text: 'Discord still sends' });
  assert.equal(sent.ok, true);
  await until(async () => (await exchange.fake.control('state')).messages.some(m => m.content.includes('Discord still sends')),
    { what: 'Discord outbound after Telegram revoke', timeoutMs: 2000 });
  assert.equal((await exchange.fake.control('state')).messages.filter(m => m.content.includes('Discord still sends')).length, 1);
  assert.equal((await history()).filter(m => m.artifacts?.length).length, 4, 'restarts never duplicate media');
  for (const expected of ['telegram photo', '🎤 heard Telegram']) assert.equal((await exchange.fake.control('state')).messages.filter(m => m.content.includes('you (Telegram)') && m.content.includes(expected)).length, 1);
  for (const expected of ['discord photo', '🎤 heard Discord']) assert.equal((await tgMessages()).filter(m => (m.caption ?? m.text ?? '').includes('you (Discord)') && (m.caption ?? m.text ?? '').includes(expected)).length, 1);
  await hub!.stop();
  await owner.dispose();
});
