import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { EventEmitter } from 'node:events';
import { isDeepStrictEqual } from 'node:util';
import type { Socket } from 'node:net';
import type { TestContext } from 'node:test';
import type { TgMessage, TgUpdate, TgUser, TgInlineKeyboardMarkup, TgReplyMarkup, TgEntity, TgReplyParameters } from '../../../src/remote/telegram-api.ts';
import { remoteRedactor } from '../../../src/remote/redact.ts';
import { realClock, type Clock, type ClockTimer } from '../../../src/hub/clock.ts';
import { onCleanup } from '../../process-cleanup.ts';
import { abortable, within } from '../../../src/executor/droplet/deadline.ts';

/** Fabricated credential only; the fake never reads the environment or a secrets file. */
export const TELEGRAM_TEST_TOKEN = '123456789:cland_fixture_telegram_0000000000';
const BOT: TgUser = { id: 123456789, is_bot: true, first_name: 'cland fixture', username: 'cland_fixture_bot' };
const HUMAN: TgUser = { id: 101, is_bot: false, first_name: 'Fixture human' };
const STRANGER: TgUser = { id: 202, is_bot: false, first_name: 'Fixture stranger' };

function reply(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(status, { 'content-type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
}

// Independent Bot API formatting restriction: only emphasis may share characters
// with another entity, and code/pre cannot participate in any nesting.
function legalEntities(entities: Array<{ type: string; offset: number; length: number }>): boolean {
  const emphasis = new Set(['bold', 'italic', 'underline', 'strikethrough', 'spoiler']);
  for (let i = 0; i < entities.length; i++) for (let j = i + 1; j < entities.length; j++) {
    const a = entities[i]!, b = entities[j]!;
    const endA = a.offset + a.length, endB = b.offset + b.length;
    if (endA <= b.offset || endB <= a.offset) continue;
    const contained = a.offset <= b.offset && endA >= endB || b.offset <= a.offset && endB >= endA;
    if (!contained || [a.type, b.type].some(type => type === 'pre' || type === 'code')
      || !emphasis.has(a.type) && !emphasis.has(b.type)) return false;
  }
  return true;
}

function keyboardMarkup(value: TgInlineKeyboardMarkup): TgInlineKeyboardMarkup {
  let remaining = 300;
  const rows = [];
  for (const row of value.inline_keyboard) {
    for (const button of row) {
      const bytes = Buffer.byteLength(button.callback_data, 'utf8');
      if (bytes < 1 || bytes > 64) throw new Error('Invalid callback data');
    }
    const kept = row.slice(0, Math.min(12, remaining));
    remaining -= kept.length;
    if (kept.length) rows.push(kept);
  }
  return { inline_keyboard: rows };
}

export type FakePollReceipt = { id: number; params: Record<string, unknown>; stalled: boolean };
export type FakeRequestReceipt = { id: number; method: string; params: Record<string, unknown> };
export type FakeConnectionReceipt = { id: number; method: string };
type PendingPoll = FakePollReceipt & { res: ServerResponse; timer?: ClockTimer; ended: boolean };
type FaultResponse = 'redirect' | 'invalid-json' | 'malformed-error' | 'disconnect' | 'accept-disconnect' | 'hold' | 'hold-after-send';
type Fault = { method: string; code: number; echoToken: boolean; description?: string; retryAfter?: number; response?: FaultResponse };

function observe<T>(events: EventEmitter, event: string, accepts: (value: T) => boolean, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const cleanup = () => { events.off(event, received); signal.removeEventListener('abort', aborted); };
    const received = (value: T) => { if (accepts(value)) { cleanup(); resolve(value); } };
    const aborted = () => { cleanup(); reject(new Error('fake Telegram observation aborted or exceeded its time bound')); };
    events.on(event, received);
    signal.addEventListener('abort', aborted, { once: true });
    if (signal.aborted) aborted();
  });
}

type FakeOptions = { clock?: Clock; setupClock?: Clock; signal?: AbortSignal; publishListening?: boolean; port?: number };

/** Own every native resource before binding, including abandoned setup. */
export function fakeTelegramFixture(t: TestContext, options: FakeOptions = {}) {
  const clock = options.clock ?? realClock;
  const events = new EventEmitter();
  const lifetime = new AbortController();
  const redact = remoteRedactor([TELEGRAM_TEST_TOKEN]);
  const messages: TgMessage[] = [];
  const forceReplyMessages = new Set<number>();
  let commands: unknown[] = [];
  let updates: TgUpdate[] = [];
  const requests: Array<{ method: string; params: Record<string, unknown> }> = [];
  const faults: Fault[] = [];
  const sends: Array<{ id: number; chat: string; at: number }> = [];
  const inFlight = new Map<string, number>();
  const maxInFlight: Record<string, number> = {};
  const releases = new Map<number, () => void>();
  const pendingPolls = new Map<number, PendingPoll>();
  const closedPolls = new Set<number>();
  const heldRequests = new Map<number, FakeConnectionReceipt>();
  let stall = false;
  let nextPoll = 1;
  let nextMessage = 1;
  let nextUpdate = 1;
  let nextPress = 1;
  const presses = new Map<string, number>();
  let redirectsFollowed = 0;
  const nativeListening = Promise.withResolvers<void>();
  const listening = Promise.withResolvers<void>();
  const nativeClosed = Promise.withResolvers<void>();
  const connections = new Map<Socket, Promise<void>>();
  const handlers = new Set<Promise<void>>();
  let didListen = false, didClose = false, invoked = false;
  let nativeError: string | null = null;
  const receipt = (poll: PendingPoll): FakePollReceipt => ({ id: poll.id, params: structuredClone(poll.params), stalled: poll.stalled });
  const available = () => updates.slice(0, 100);
  const finish = (poll: PendingPoll, status = 200) => {
    if (poll.ended) return;
    poll.ended = true;
    clock.clearTimeout(poll.timer);
    reply(poll.res, status, status === 200 ? { ok: true, result: available() }
      : { ok: false, error_code: status, description: 'Fake Telegram stopped' });
  };
  const wake = () => {
    for (const poll of pendingPolls.values()) if (!poll.stalled && available().length) finish(poll);
  };
  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      if (lifetime.signal.aborted) { req.destroy(); res.destroy(); return; }
      if (req.method === 'GET' && req.url === '/control/state') return reply(res, 200, {
        messages, requests, sends, maxInFlight, pendingPolls: [...pendingPolls.values()].map(receipt), heldRequests: [...heldRequests.values()], redirectsFollowed,
      });
      if (req.url === '/redirect-target') {
        redirectsFollowed++;
        return reply(res, 200, { ok: true, result: BOT });
      }
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      if (lifetime.signal.aborted) return;
      const params = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as Record<string, unknown>;
      if (req.method === 'POST' && req.url === '/control/say') {
        const user = params.user === 'stranger' ? STRANGER : HUMAN;
        const message: TgMessage = { message_id: nextMessage++, date: 1_793_044_800,
          chat: { id: user.id, type: 'private' }, from: user, text: String(params.text ?? '') };
        const update: TgUpdate = { update_id: nextUpdate++, message };
        updates.push(redact.value(update));
        wake();
        return reply(res, 200, update);
      }
      if (req.method === 'POST' && req.url === '/control/press') {
        const message = messages.find(message => message.message_id === params.message_id && message.chat.id === params.chat_id);
        const markup = message?.reply_markup;
        const button = markup && 'inline_keyboard' in markup ? markup.inline_keyboard[Number(params.row)]?.[Number(params.column)] : undefined;
        if (!message || !button) return reply(res, 400, { error: 'no button at that message, row and column' });
        const id = `press-${nextPress++}`;
        presses.set(id, clock.now().getTime());
        const update: TgUpdate = { update_id: nextUpdate++, callback_query: {
          id, from: params.user === 'stranger' ? STRANGER : HUMAN,
          message: structuredClone(message), data: button.callback_data,
        } };
        updates.push(update);
        wake();
        return reply(res, 200, update);
      }
      if (req.method === 'POST' && req.url === '/control/commands') {
        if (!Array.isArray(params.commands)) return reply(res, 400, { error: 'commands must be an array' });
        commands = structuredClone(params.commands);
        return reply(res, 200, { commands });
      }
      // Fault-injection boundary: deliberately permits unlisted/malformed update bodies.
      if (req.method === 'POST' && req.url === '/control/update') {
        const update = redact.value({ ...params, update_id: nextUpdate++ }) as TgUpdate;
        updates.push(update);
        wake();
        return reply(res, 200, update);
      }
      if (req.method === 'POST' && req.url === '/control/duplicate') {
        const update = updates.find(update => update.update_id === params.update_id);
        if (!update) return reply(res, 404, { error: 'no queued update with that id' });
        updates.push(structuredClone(update));
        wake();
        return reply(res, 200, { duplicated: update.update_id });
      }
      if (req.method === 'POST' && req.url === '/control/membership') {
        if (params.status !== 'member' && params.status !== 'kicked') return reply(res, 400, { error: 'status must be member or kicked' });
        const user = params.user === 'stranger' ? STRANGER : HUMAN;
        const update: TgUpdate = { update_id: nextUpdate++, my_chat_member: {
          chat: { id: user.id, type: 'private' }, from: user, date: 1_793_044_800,
          old_chat_member: { user: BOT, status: 'member' },
          new_chat_member: { user: BOT, status: params.status, ...(params.status === 'kicked' ? { until_date: 0 } : {}) },
        } };
        updates.push(update);
        wake();
        return reply(res, 200, update);
      }
      if (req.method === 'POST' && req.url === '/control/stall') {
        if (typeof params.enabled !== 'boolean') return reply(res, 400, { error: 'enabled must be boolean' });
        stall = params.enabled;
        return reply(res, 200, { enabled: stall });
      }
      if (req.method === 'POST' && req.url === '/control/release-polls') {
        const released = [...pendingPolls.values()].filter(poll => !poll.ended).map(poll => poll.id);
        for (const poll of pendingPolls.values()) finish(poll);
        return reply(res, 200, { released });
      }
      if (req.method === 'POST' && req.url === '/control/release-requests') {
        if (!Array.isArray(params.ids)) return reply(res, 400, { error: 'ids must be an array' });
        const released = params.ids.filter(id => typeof id === 'number' && releases.has(id));
        for (const id of released) releases.get(id)!();
        return reply(res, 200, { released });
      }
      if (req.method === 'POST' && req.url === '/control/fault') {
        if (typeof params.method !== 'string' || typeof params.code !== 'number' || !Number.isInteger(params.code) || params.code < 300 || params.code > 599)
          return reply(res, 400, { error: 'fault needs a method and HTTP error code' });
        const response = params.response;
        if (response !== undefined && !['redirect', 'invalid-json', 'malformed-error', 'disconnect', 'accept-disconnect', 'hold', 'hold-after-send'].includes(String(response)))
          return reply(res, 400, { error: 'unsupported fault response' });
        const retryAfter = params.retry_after;
        if (params.description !== undefined && (typeof params.description !== 'string' || params.description.length > 4_000))
          return reply(res, 400, { error: 'description must be a string of at most 4000 characters' });
        if (retryAfter !== undefined && (typeof retryAfter !== 'number' || !Number.isInteger(retryAfter) || retryAfter < 0))
          return reply(res, 400, { error: 'retry_after must be nonnegative integer seconds' });
        faults.push({ method: params.method, code: params.code, echoToken: params.echoToken === true,
          ...(typeof params.description === 'string' ? { description: params.description } : {}),
          ...(typeof retryAfter === 'number' ? { retryAfter } : {}),
          ...(typeof response === 'string' ? { response: response as FaultResponse } : {}),
        });
        return reply(res, 200, { armed: true });
      }
      const route = /^\/bot([^/]+)\/([A-Za-z]+)$/.exec(req.url ?? '');
      if (req.method !== 'POST' || !route || route[1] !== TELEGRAM_TEST_TOKEN)
        return reply(res, 401, { ok: false, error_code: 401, description: 'Unauthorized' });
      const method = route[2]!;
      const connection = { id: requests.length + 1, method };
      req.socket.once('close', () => { heldRequests.delete(connection.id); events.emit('connection-closed', connection); });
      if (method === 'sendMessage' || method === 'sendRichMessage' || method === 'setMessageReaction') {
        const chat = String(params.chat_id);
        sends.push({ id: connection.id, chat, at: clock.now().getTime() });
        const active = (inFlight.get(chat) ?? 0) + 1;
        inFlight.set(chat, active);
        maxInFlight[chat] = Math.max(maxInFlight[chat] ?? 0, active);
        res.once('close', () => inFlight.set(chat, inFlight.get(chat)! - 1));
      }
      requests.push({ method, params: redact.value(params) });
      events.emit('request', { ...connection, params: redact.value(params) });
      let loseReceipt = false;
      let holdAfterSend = false;
      const faultIndex = faults.findIndex(fault => fault.method === method);
      if (faultIndex >= 0) {
        const fault = faults.splice(faultIndex, 1)[0]!;
        // A deliberate echo exercises the client's error boundary; never capture it.
        if (fault.response === 'hold') {
          await new Promise<void>(resolve => {
            const release = () => { releases.delete(connection.id); heldRequests.delete(connection.id); resolve(); };
            releases.set(connection.id, release);
            res.once('close', release);
            heldRequests.set(connection.id, connection);
            events.emit('request-held', connection);
          });
          if (res.destroyed || lifetime.signal.aborted) return;
        } else if (fault.response === 'accept-disconnect') loseReceipt = true;
        else if (fault.response === 'hold-after-send' && method === 'sendMessage') holdAfterSend = true;
        else {
          if (fault.response === 'disconnect') { res.destroy(); return; }
          if (fault.response === 'redirect') return reply(res, fault.code, {}, { location: '/redirect-target' });
          if (fault.response === 'invalid-json') {
            res.writeHead(fault.code, { 'content-type': 'application/json' });
            res.end(`invalid JSON ${TELEGRAM_TEST_TOKEN}`);
            return;
          }
          if (fault.response === 'malformed-error') return reply(res, fault.code, { ok: false,
            error_code: { value: TELEGRAM_TEST_TOKEN }, description: { value: TELEGRAM_TEST_TOKEN }, parameters: { retry_after: TELEGRAM_TEST_TOKEN } });
          return reply(res, fault.code, { ok: false, error_code: fault.code,
            description: `${fault.description ?? 'Forced fake refusal'}${fault.echoToken ? ` ${TELEGRAM_TEST_TOKEN}` : ''}`,
            ...(fault.retryAfter !== undefined ? { parameters: { retry_after: fault.retryAfter } } : {}),
          }, fault.retryAfter !== undefined ? { 'retry-after': String(fault.retryAfter) } : {});
        }
      }
      if (method === 'getMyCommands' || method === 'setMyCommands') {
        if ((params.scope as { type?: string })?.type !== 'all_private_chats') return reply(res, 400, { ok: false, error_code: 400, description: 'Private scope required' });
        if (method === 'setMyCommands') {
          if (!Array.isArray(params.commands)) return reply(res, 400, { ok: false, error_code: 400, description: 'Missing commands' });
          commands = structuredClone(params.commands);
        }
        return reply(res, 200, { ok: true, result: method === 'getMyCommands' ? commands : true });
      }
      if (method === 'getMe') return reply(res, 200, { ok: true, result: BOT });
      if (method === 'setMessageReaction') return reply(res, 200, { ok: true, result: true });
      if (method === 'answerCallbackQuery') {
        const pressedAt = presses.get(String(params.callback_query_id));
        if (pressedAt === undefined || clock.now().getTime() - pressedAt > 150_000)
          return reply(res, 400, { ok: false, error_code: 400, description: 'Bad Request: query is too old' });
        return reply(res, 200, { ok: true, result: true });
      }
      if (method === 'editMessageText') {
        const message = messages.find(message => message.message_id === params.message_id && String(message.chat.id) === String(params.chat_id));
        if (!message) return reply(res, 400, { ok: false, error_code: 400, description: 'Bad Request: message to edit not found' });
        if (forceReplyMessages.has(message.message_id))
          return reply(res, 400, { ok: false, error_code: 400, description: "Bad Request: message can't be edited" });
        if (typeof params.text !== 'string' || params.entities !== undefined
          && (!Array.isArray(params.entities) || !legalEntities(params.entities)))
          return reply(res, 400, { ok: false, error_code: 400, description: 'Invalid text or entities' });
        const markup = params.reply_markup ? keyboardMarkup(params.reply_markup as TgInlineKeyboardMarkup) : message.reply_markup;
        const entities = params.entities as TgEntity[] | undefined;
        if (message.text === params.text && isDeepStrictEqual(message.entities ?? [], entities ?? [])
          && isDeepStrictEqual(message.reply_markup, markup))
          return reply(res, 400, { ok: false, error_code: 400, description: 'Bad Request: message is not modified' });
        message.text = redact.text(params.text);
        if (entities) message.entities = redact.value(entities);
        else delete message.entities;
        if (markup) message.reply_markup = redact.value(markup);
        if (loseReceipt) { res.destroy(); return; }
        return reply(res, 200, { ok: true, result: message });
      }
      if (method === 'getUpdates') {
        if (typeof params.offset === 'number') updates = updates.filter(update => update.update_id >= Number(params.offset));
        if (!stall && (available().length || !Number(params.timeout))) return reply(res, 200, { ok: true, result: available() });
        const poll: PendingPoll = { id: nextPoll++, params: redact.value(params), stalled: stall, res, ended: false };
        pendingPolls.set(poll.id, poll);
        res.once('close', () => {
          clock.clearTimeout(poll.timer);
          pendingPolls.delete(poll.id);
          closedPolls.add(poll.id);
          events.emit('poll-closed', poll.id);
        });
        if (!stall) poll.timer = clock.setTimeout(() => finish(poll), Math.min(50, Number(params.timeout)) * 1_000);
        events.emit('poll', receipt(poll));
        return;
      }
      if (method === 'sendMessage' || method === 'sendRichMessage') {
        const rich = params.rich_message as { markdown?: unknown } | undefined;
        const text = method === 'sendMessage' ? params.text : rich?.markdown;
        if (typeof text !== 'string') return reply(res, 400, { ok: false, error_code: 400, description: 'Missing text or rich_message.markdown' });
        if (method === 'sendMessage' && params.entities !== undefined
          && (!Array.isArray(params.entities) || !legalEntities(params.entities)))
          return reply(res, 400, { ok: false, error_code: 400, description: 'Invalid Telegram entity nesting' });
        const markup = params.reply_markup as TgReplyMarkup | undefined;
        const replyParameters = params.reply_parameters as TgReplyParameters | undefined;
        const repliedTo = replyParameters && messages.find(message => message.message_id === replyParameters.message_id
          && String(message.chat.id) === String(params.chat_id));
        if (replyParameters && !repliedTo) return reply(res, 400, { ok: false, error_code: 400, description: 'Bad Request: message to reply not found' });
        const message: TgMessage = redact.value({ message_id: nextMessage++, date: 1_793_044_800,
          chat: { id: Number(params.chat_id), type: 'private' }, from: BOT, text,
          ...(params.entities ? { entities: params.entities as TgEntity[] } : {}),
          ...(markup ? { reply_markup: 'inline_keyboard' in markup ? keyboardMarkup(markup) : markup } : {}),
          ...(repliedTo ? { reply_to_message: structuredClone(repliedTo) } : {}),
        });
        if (markup && 'force_reply' in markup && markup.force_reply) forceReplyMessages.add(message.message_id);
        messages.push(message);
        if (loseReceipt) { res.destroy(); return; }
        if (holdAfterSend) {
          heldRequests.set(connection.id, connection);
          events.emit('request-held', connection); // Accepted effect, deliberately missing response.
          return;
        }
        return reply(res, 200, { ok: true, result: message });
      }
      return reply(res, 404, { ok: false, error_code: 404, description: 'Unknown method' });
    } catch { reply(res, 400, { ok: false, error_code: 400, description: 'Invalid fake request' }); }
  }
  const server = createServer((req, res) => {
    const work = handle(req, res);
    handlers.add(work);
    void work.then(() => handlers.delete(work), () => handlers.delete(work));
  });
  server.on('connection', peer => {
    const closed = Promise.withResolvers<void>();
    connections.set(peer, closed.promise);
    peer.once('close', () => { connections.delete(peer); closed.resolve(); });
    peer.on('error', () => peer.destroy());
    if (lifetime.signal.aborted) peer.destroy();
  });
  server.once('listening', () => {
    didListen = true;
    nativeListening.resolve();
    if (options.publishListening !== false) listening.resolve();
  });
  server.once('close', () => { didClose = true; nativeClosed.resolve(); });
  server.on('error', error => {
    nativeError = (error as NodeJS.ErrnoException).code ?? 'unknown';
    listening.reject(new Error(`fake Telegram listen failed: ${nativeError}`));
  });
  void listening.promise.catch(() => {});
  let closing: Promise<void> | undefined;
  const close = () => closing ??= (async () => {
    lifetime.abort();
    for (const poll of pendingPolls.values()) finish(poll, 503);
    for (const peer of connections.keys()) peer.destroy();
    let closed: Promise<void> = Promise.resolve();
    if (invoked && !didClose) {
      server.close(error => {
        if (error && (error as NodeJS.ErrnoException).code === 'ERR_SERVER_NOT_RUNNING' && !didListen) {
          didClose = true;
          nativeClosed.resolve();
        }
      });
      closed = nativeClosed.promise;
    } else if (!invoked) didClose = true;
    const results = await Promise.allSettled([
      within(closed, 1_000, realClock, () => new Error('fake Telegram native server close incomplete after 1000 ms')),
      within((async () => {
        while (connections.size || handlers.size) await Promise.allSettled([...connections.values(), ...handlers]);
      })(), 1_000, realClock, () => new Error('fake Telegram connection/handler drainage incomplete after 1000 ms')),
    ]);
    const failures = results.filter(result => result.status === 'rejected').map(result => result.reason);
    if (failures.length) throw new AggregateError(failures, 'fake Telegram disposal incomplete');
  })();
  onCleanup(t, close);
  let starting: Promise<ReturnType<typeof client>> | undefined;
  const client = (port: number) => ({
    url: `http://127.0.0.1:${port}`,
    waitForRequest: (method: string, accepts: (receipt: FakeRequestReceipt) => boolean = () => true, signal = AbortSignal.timeout(5_000)) =>
      observe<FakeRequestReceipt>(events, 'request', receipt => receipt.method === method && accepts(receipt), AbortSignal.any([signal, lifetime.signal])),
    waitForHeldRequest: (method: string, signal = AbortSignal.timeout(5_000)) => observe<FakeConnectionReceipt>(events,
      'request-held', receipt => receipt.method === method, AbortSignal.any([signal, lifetime.signal])),
    waitForConnectionClose: (method: string, signal = AbortSignal.timeout(5_000)) => observe<FakeConnectionReceipt>(events,
      'connection-closed', receipt => receipt.method === method, AbortSignal.any([signal, lifetime.signal])),
    waitForPoll: (signal = AbortSignal.timeout(5_000)) => observe<FakePollReceipt>(events, 'poll', () => true,
      AbortSignal.any([signal, lifetime.signal])),
    waitForPollClose: (id: number, signal = AbortSignal.timeout(5_000)) => closedPolls.has(id) ? Promise.resolve(id)
      : observe<number>(events, 'poll-closed', closed => closed === id, AbortSignal.any([signal, lifetime.signal])),
    close,
  });
  const start = () => starting ??= (async () => {
    const signal = AbortSignal.any([t.signal, lifetime.signal, ...(options.signal ? [options.signal] : [])]);
    try {
      const ready = within(abortable(listening.promise, signal), 1_000, options.setupClock ?? realClock,
        () => new Error('fake Telegram listening receipt deadline reached'));
      void ready.catch(() => {});
      signal.throwIfAborted();
      invoked = true;
      server.listen({ port: options.port ?? 0, host: '127.0.0.1', signal: lifetime.signal });
      await ready;
      signal.throwIfAborted();
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('fake Telegram did not bind loopback');
      return client(address.port);
    } catch (error) {
      const reason = signal.aborted ? 'fake Telegram setup aborted' : redact(error instanceof Error ? error.message : String(error));
      await close();
      throw new Error(reason);
    }
  })();
  return {
    start, close,
    listening: () => within(nativeListening.promise, 1_000, realClock, () => new Error('fake Telegram native listening receipt missing')),
    receipts: () => ({ listening: didListen, closed: didClose, connections: connections.size, handlers: handlers.size, nativeError }),
  };
}

export async function fakeTelegram(t: TestContext, options: FakeOptions = {}) { return fakeTelegramFixture(t, options).start(); }

/** One bounded control boundary covers headers and the complete JSON/text body. */
export async function telegramControl<T>(root: string, operation: string, params?: object) {
  const response = await fetch(`${root}/control/${operation}`, { signal: AbortSignal.timeout(5_000),
    ...(params ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(params) } : {}),
  });
  const text = await response.text();
  return { status: response.status, body: JSON.parse(text) as T, text };
}
