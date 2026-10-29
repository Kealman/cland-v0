import { createHash } from 'node:crypto';
import { fakeGateway } from './gateway.ts';
import { EventEmitter } from 'node:events';
import { abortable, within } from '../../../src/executor/droplet/deadline.ts';
import { createServer, type ServerResponse, type IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import { onCleanup } from '../../process-cleanup.ts';
import type { TestContext } from 'node:test';
import { realClock, type Clock } from '../../../src/hub/clock.ts';
import { redactValue, remoteRedactor } from '../../../src/remote/redact.ts';
import { DISCORD_USER_AGENT } from '../../../src/remote/discord-api.ts';
import type { DiscordActionRow, DiscordApplication, DiscordSessionStartLimit, DiscordMessage } from '../../../src/remote/discord-api.ts';

export const DISCORD_TEST_TOKEN = 'fictional_discord_fixture_credential';
export const DISCORD_IDS = {
  application: '90071992547409931', guild: '90071992547409932', channel: '90071992547409933',
  secondChannel: '90071992547409934', human: '90071992547409935', member: '90071992547409936', administrator: '90071992547409940',
  bot: '90071992547409937', role: '90071992547409938', webhook: '90071992547409939',
} as const;
type Ping = { users: string[]; roles: string[]; everyone: boolean };
type Request = { method: string; path: string; body: Record<string, unknown>; userAgentValid: boolean };
export type DiscordState = { uploads: Array<{ message: string; name: string; size: number; sha256: string }>;  reactions: Array<{ channel: string; message: string; user: string; emoji: string }>; interactions: Array<{ id: string; at: number; loseCallbackResponse?: boolean; callbackTimes: number[]; callbacks: object[]; edits: object[]; followups: object[] }>; commands: object[]; commandWrites: number; messages: DiscordMessage[]; requests: Request[]; pings: Ping[]; redirectsFollowed: number; rateLimits: number; gateway: { identifies: number; resumes: number; validResume: boolean; heartbeats: number; payloads: number; validIdentify: boolean; closes: number[] }; members: Array<{ user_id: string; guild_id: string; permissions: string }> };

function reply(res: ServerResponse, status: number, body: unknown): void {
  if (!res.headersSent) res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

/** In-process fake; no accounts, filesystem, inherited credentials or child launches. */
type FakeOptions = { publicOrigin?: string; onCallback?: (id: string, type: number) => void | Promise<void>; clock?: Clock; setupClock?: Clock; signal?: AbortSignal; publishListening?: boolean; publishHeld?: boolean; publishGatewayListening?: boolean; publishGatewayClose?: boolean };
export function discordFixtureOwner(t: TestContext, options: FakeOptions = {}) {
  const lifetime = new AbortController();
  const serving = Promise.withResolvers<void>();
  const nativeListening = Promise.withResolvers<void>();
  const nativeHeld = Promise.withResolvers<void>();
  const nativeClosed = Promise.withResolvers<void>();
  const observers = new Set<Promise<unknown>>();
  let didListen = false, didClose = false, invoked = false;
  void serving.promise.catch(() => {});
  const events = new EventEmitter();
  const clock = options.clock ?? realClock;
  const secrets = remoteRedactor([DISCORD_TEST_TOKEN]);
  if (options.publicOrigin) {
    const origin = new URL(options.publicOrigin);
    if (origin.protocol !== 'https:' || !origin.hostname.endsWith('.invalid') || origin.origin !== options.publicOrigin)
      throw new Error('fake public origin must be an HTTPS .invalid origin without credentials, path, query or fragment');
  }
  const scrub = secrets.text;
  const captureText = (text: string) => !options.publicOrigin ? scrub(text) : text.split(/(\b[a-z][a-z0-9+.-]*:\/\/\S+)/gi)
    .map(part => part === options.publicOrigin ? part : scrub(part)).join('');
  const redact = Object.assign(secrets, { text: captureText, value: <T>(value: T): T => redactValue(value, captureText) });
  const state: DiscordState = { uploads: [], reactions: [], interactions: [], commands: [], commandWrites: 0, messages: [], requests: [], pings: [], redirectsFollowed: 0, rateLimits: 0, gateway: { identifies: 0, resumes: 0, validResume: false, heartbeats: 0, payloads: 0, validIdentify: false, closes: [] },

    members: [{ user_id: DISCORD_IDS.human, guild_id: DISCORD_IDS.guild, permissions: '8' },
      { user_id: DISCORD_IDS.member, guild_id: DISCORD_IDS.guild, permissions: '0' }] };
  const interactionTokens = new Map<string, { id: string; at: number; loseCallbackResponse?: boolean; callbackTimes: number[]; callbacks: object[]; edits: object[]; followups: object[] }>();
  const nativeAttachments = new Map<string, DiscordMessage['attachments']>();
  const cdn = new Map<string, { content: string; expired?: boolean; redirect?: string; hold?: boolean; refresh?: string }>();
  const cdnClosed: string[] = [];
  const cdnRequests: Array<{ id: string; authorization: boolean }> = [];
  const faults: Array<Record<string, unknown>> = [];
  const held = new Map<number, () => void>();
  let nextHold = 1;
  let gatewayUrl: string | undefined;
  let application: DiscordApplication = { id: DISCORD_IDS.application, flags: 1 << 18, bot_public: false, interactions_endpoint_url: null };
  let sessionStartLimit: DiscordSessionStartLimit = { total: 1000, remaining: 1000, reset_after: 86400000, max_concurrency: 1 };
  let nextId = 90071992547410000n;
  const buckets = new Map<string, { used: number; reset: number }>();
  let sendLimit = 5, sendWindow = 5000, reactionWindow = 250;
  const nonces = new Map<string, { at: number; message: DiscordMessage }>();
  const sockets = new Map<Socket, Promise<void>>();
  const handlers = new Set<Promise<void>>();
  function pings(body: Record<string, unknown>): Ping {
    const content = String(body.content ?? '');
    const parse = (body.allowed_mentions as { parse?: string[] } | undefined)?.parse ?? ['users', 'roles', 'everyone'];
    return { users: parse.includes('users') ? [...content.matchAll(/<@!?(\d+)>/g)].map(m => m[1]!) : [],
      roles: parse.includes('roles') ? [...content.matchAll(/<@&(\d+)>/g)].map(m => m[1]!) : [],
      everyone: parse.includes('everyone') && /@everyone|@here/.test(content) };
  }
  const nativeMessage = (message: DiscordMessage, refresh = false): DiscordMessage => ({ ...message,
    ...(nativeAttachments.get(message.id) ? { attachments: nativeAttachments.get(message.id)!.map(file => {
      const id = file.url.split('/cdn/')[1], fresh = id && cdn.get(id)?.refresh;
      return refresh && fresh ? { ...file, url: file.url.slice(0, file.url.lastIndexOf('/') + 1) + fresh } : file;
    }) } : {}),
  });
  async function handle(req: IncomingMessage, res: ServerResponse) {
    if (lifetime.signal.aborted) { req.destroy(); res.destroy(); return; }
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    if (lifetime.signal.aborted) return;
    const raw = Buffer.concat(chunks);
    const type = req.headers['content-type'] ?? '';
    const uploads: Array<{ name: string; bytes: Buffer }> = [];
    let body: Record<string, unknown>;
    if (type.startsWith('multipart/form-data')) {
      const form = await new Response(raw, { headers: { 'content-type': type } }).formData();
      body = JSON.parse(String(form.get('payload_json')));
      for (const [key, value] of form) if (key.startsWith('files[') && typeof value !== 'string') uploads.push({ name: value.name, bytes: Buffer.from(await value.arrayBuffer()) });
      if (uploads.length > 10 || uploads.some(f => f.bytes.length > 20 * 1024 * 1024) || raw.length > 25 * 1024 * 1024) return reply(res, 400, { code: 50035 });
    } else body = JSON.parse(raw.toString() || '{}') as Record<string, unknown>;
    const path = new URL(req.url!, 'http://127.0.0.1');
    if (path.pathname === '/control/cdn') {
      if (typeof body.id === 'string') cdn.set(body.id, body as { content: string; expired?: boolean; redirect?: string; hold?: boolean; refresh?: string });
      return reply(res, 200, { requests: cdnRequests, closed: cdnClosed });
    }
    if (path.pathname.startsWith('/cdn/')) {
      const id = path.pathname.slice(5), file = cdn.get(id);
      cdnRequests.push({ id, authorization: !!req.headers.authorization });
      if (file?.hold) {
        await new Promise<void>(resolve => {
          const hold = nextHold++;
          const release = () => { held.delete(hold); resolve(); };
          held.set(hold, release); events.emit('held', hold);
          res.once('close', () => { cdnClosed.push(id); release(); });
        });
        if (res.destroyed) return;
      }
      if (!file || file.expired) return reply(res, 403, {});
      if (file.redirect) { res.writeHead(302, { location: file.redirect }); res.end(); return; }
      res.end(Buffer.from(file.content, 'base64')); return;
    }
    if (path.pathname === '/control/state') return reply(res, 200, redact.value(state));
    if (path.pathname === '/control/fault') { faults.push(body); return reply(res, 200, {}); }
    if (path.pathname === '/control/release') {
      for (const release of held.values()) release();
      held.clear();
      return reply(res, 200, {});
    }
    if (path.pathname === '/redirect-target') { state.redirectsFollowed++; return reply(res, 200, {}); }
    if (path.pathname === '/control/interact') {
      const id = String(nextId++), token = `synthetic_interaction_${id}`;
      const record = { id, loseCallbackResponse: body.lose_callback_response === true, message: typeof body.message_id === 'string' ? body.message_id : undefined, at: clock.now().getTime(), callbackTimes: [] as number[], callbacks: [] as object[], edits: [] as object[], followups: [] as object[] };
      state.interactions.push(record); interactionTokens.set(token, record);
      const user = body.user === 'member' ? DISCORD_IDS.member : body.user === 'administrator' ? DISCORD_IDS.administrator : DISCORD_IDS.human;
      gateway.dispatch({ op: 0, t: 'INTERACTION_CREATE', s: Number(nextId % 100000n), d: {
        id, token, application_id: DISCORD_IDS.application, type: body.modal_text !== undefined ? 5 : body.custom_id ? 3 : 2,
        ...(body.custom_id ? { message: { id: body.message_id } } : {}),
        guild_id: body.guild_id === null ? undefined : DISCORD_IDS.guild,
        channel_id: body.channel_id ?? DISCORD_IDS.channel, channel: { type: body.channel_type ?? 0 },
        member: { user: { id: user, username: body.user === 'member' ? 'Fixture member' : 'Fixture human' } },
        data: body.custom_id ? { custom_id: body.custom_id, ...(body.modal_text !== undefined ? { components: [{ type: 18, component: { type: 4, custom_id: 'answer', value: body.modal_text } }] } : {}) } : { name: 'cland', options: [{ name: body.command ?? 'pair', type: 1, ...(typeof body.text === 'string' ? { options: [{ name: 'text', type: 3, value: body.text }] } : {}) }] },
      } });
      return reply(res, 200, { id });
    }
    const callback = /^\/interactions\/(\d+)\/([^/]+)\/callback$/.exec(path.pathname);
    const edit = /^\/webhooks\/(\d+)\/([^/]+)\/messages\/@original$/.exec(path.pathname);
    const followup = req.method === 'POST' ? /^\/webhooks\/(\d+)\/([^/]+)$/.exec(path.pathname) : null;
    if (callback || edit || followup) {
      const record = interactionTokens.get((callback ?? edit ?? followup)![2]!);
      if (!record || (callback && record.id !== callback[1]) || ((edit ?? followup) && (edit ?? followup)![1] !== DISCORD_IDS.application)) return reply(res, 404, { code: 10062 });
      const content = callback ? (body.data as { content?: unknown } | undefined)?.content : body.content;
      if (content !== undefined && [...String(content)].length > 2000) return reply(res, 400, { code: 50035 });
      if (callback) {
        if (clock.now().getTime() - record.at >= 3000) return reply(res, 404, { code: 10062 });
        if (record.callbacks.length) return reply(res, 400, { code: 40060 });
        await options.onCallback?.(record.id, Number(body.type));
        record.callbackTimes.push(clock.now().getTime());
        record.callbacks.push(redact.value(body));
        if (record.loseCallbackResponse) { req.socket.destroy(); return; }
        if (body.type === 7) {
          const message = state.messages.find(m => m.id === (record as typeof record & { message?: string }).message);
          if (message) Object.assign(message, redact.value(body.data));
        }
      } else {
        if (!record.callbacks.length || clock.now().getTime() - record.at >= 900000) return reply(res, 404, { code: 10015 });
        if (followup) record.followups.push(redact.value(body)); else record.edits.push(redact.value(body));
      }
      return reply(res, 200, {});
    }
    if (path.pathname === '/control/delete') {
      const index = state.messages.findIndex(m => m.id === body.message_id);
      if (index >= 0) state.messages.splice(index, 1);
      return reply(res, 200, {});
    }
    if (path.pathname === '/control/drop') { gateway.drop(); return reply(res, 200, {}); }
    if (path.pathname === '/control/close') { gateway.closeCode(Number(body.code)); return reply(res, 200, {}); }
    if (path.pathname === '/control/dispatch') { gateway.dispatch(body); return reply(res, 200, {}); }
    if (path.pathname === '/control/configure') {
      gateway.configure(body);
      if (typeof body.sendLimit === 'number') sendLimit = body.sendLimit;
      if (typeof body.sendWindow === 'number') sendWindow = body.sendWindow;
      if (typeof body.reactionWindow === 'number') reactionWindow = body.reactionWindow;
      if (Array.isArray(body.commands)) state.commands = body.commands;
      if (typeof body.gatewayUrl === 'string') gatewayUrl = body.gatewayUrl;
      application = { ...application, ...body.application as Partial<DiscordApplication>, id: DISCORD_IDS.application };
      if (body.session_start_limit) sessionStartLimit = body.session_start_limit as DiscordSessionStartLimit;
      return reply(res, 200, {});
    }
    if (path.pathname === '/control/say') {
      const posted: DiscordMessage[] = [];
      for (const content of Array.isArray(body.contents) ? body.contents : [body.content ?? '']) {
      const user = String(body.user ?? 'human');
      const author = user === 'human' ? { id: DISCORD_IDS.human, username: 'Fixture human' }
        : user === 'member' ? { id: DISCORD_IDS.member, username: 'Fixture member' }
        : { id: DISCORD_IDS.bot, username: 'Fixture bot', bot: true };
      const message: DiscordMessage = { id: String(nextId++), channel_id: String(body.channel_id ?? DISCORD_IDS.channel),
        author, content: String(content), timestamp: clock.now().toISOString(), type: 0,
        ...(typeof body.reply_to === 'string' ? { type: 19, message_reference: { message_id: body.reply_to } } : {}),
        ...(typeof body.flags === 'number' ? { flags: body.flags } : {}),
        ...(Array.isArray(body.attachments) ? { attachments: body.attachments as NonNullable<DiscordMessage['attachments']> } : {}),
        ...(user === 'webhook' ? { webhook_id: DISCORD_IDS.webhook } : {}) };
      nativeAttachments.set(message.id, message.attachments);
      state.messages.push(redact.value(message));
      posted.push(message);
      }
      return reply(res, 200, redact.value(Array.isArray(body.contents) ? posted : posted[0]));
    }
    if (req.headers.authorization !== `Bot ${DISCORD_TEST_TOKEN}`) return reply(res, 401, { code: 0, message: 'Unauthorized' });
    state.requests.push(redact.value({ method: req.method!, path: path.pathname + path.search, body, userAgentValid: req.headers['user-agent'] === DISCORD_USER_AGENT }));
    const rateMatch = /^\/channels\/(\d+)\/messages(?:\/\d+\/reactions\/[^/]+\/@me)?$/.exec(path.pathname);
    const reaction = path.pathname.includes('/reactions/');
    if (rateMatch && ((req.method === 'POST') || reaction)) {
      const key = `${reaction ? 'reaction' : 'message'}:${rateMatch[1]}`;
      const now = clock.now().getTime(), window = reaction ? reactionWindow : sendWindow, limit = reaction ? 1 : sendLimit;
      let bucket = buckets.get(key);
      if (!bucket || now >= bucket.reset) { bucket = { used: 0, reset: now + window }; buckets.set(key, bucket); }
      res.setHeader('X-RateLimit-Bucket', reaction ? 'reaction' : 'message');
      res.setHeader('X-RateLimit-Reset-After', (bucket.reset - now) / 1000);
      if (bucket.used >= limit) { state.rateLimits++; return reply(res, 429, { retry_after: (bucket.reset - now) / 1000 }); }
      bucket.used++;
      res.setHeader('X-RateLimit-Remaining', limit - bucket.used);

    }
    const fault = !faults[0]?.method || faults[0].method === req.method ? faults.shift() : undefined;
    if (fault) {
      if (typeof fault.bucket === 'string') res.setHeader('X-RateLimit-Bucket', fault.bucket);
      if (fault.response === 'redirect') { res.writeHead(302, { location: '/redirect-target' }); res.end(); return; }
      if (fault.response === 'disconnect') { req.socket.destroy(); return; }
      if (fault.response === 'holdStored') { /* held after persistence below */ }
      else if (fault.response === 'hold' || fault.response === 'holdHeaders') {
        if (fault.response === 'holdHeaders') { res.writeHead(200, { 'content-type': 'application/json' }); res.flushHeaders(); }
        await new Promise<void>(resolve => {
          const id = nextHold++;
          const release = () => { held.delete(id); resolve(); };
          held.set(id, release);
          nativeHeld.resolve();
          if (options.publishHeld !== false) events.emit('held', id);
          res.once('close', release);
        });
        if (res.destroyed) return;
      } else if (fault.response !== 'holdStored') {
        if (fault.status === 429) state.rateLimits++;
        return reply(res, Number(fault.status ?? 500), { code: fault.code ?? 0,
          message: fault.echoToken ? DISCORD_TEST_TOKEN : 'Injected fault', retry_after: fault.retry_after, global: fault.global });
      }
    }
      if (reaction) {
        const parts = path.pathname.split('/');
        const receipt = { channel: parts[2]!, message: parts[4]!, user: DISCORD_IDS.bot, emoji: decodeURIComponent(parts[6]!) };
        if (!state.reactions.some(r => JSON.stringify(r) === JSON.stringify(receipt))) state.reactions.push(receipt);
        return reply(res, 204, {});
      }
    if (path.pathname === `/applications/${DISCORD_IDS.application}/commands`) {
      if (req.method === 'PUT') { state.commands = body as unknown as object[]; state.commandWrites++; }
      return reply(res, 200, state.commands);
    }
    if (path.pathname === '/oauth2/applications/@me') return reply(res, 200, application);
    if (path.pathname === '/gateway/bot') return reply(res, 200, { url: gatewayUrl ?? `ws://127.0.0.1:${(server.address() as { port: number }).port}`, session_start_limit: sessionStartLimit });
    const channelMatch = /^\/channels\/(\d+)$/.exec(path.pathname);
    if (channelMatch && [DISCORD_IDS.channel, DISCORD_IDS.secondChannel].some(id => id === channelMatch[1])) {
      return reply(res, 200, { id: channelMatch[1], guild_id: DISCORD_IDS.guild,
        last_message_id: state.messages.filter(m => m.channel_id === channelMatch[1]).at(-1)?.id ?? null });
    }
    const match = /^\/channels\/(\d+)\/messages(?:\/(\d+))?$/.exec(path.pathname);
    if (!match) return reply(res, 404, { code: 10003, message: 'Unknown route' });
    const channel = match[1]!;
    if (![DISCORD_IDS.channel, DISCORD_IDS.secondChannel].some(id => id === channel)) return reply(res, 404, { code: 10003 });
    if (req.method === 'GET') {
      if (match[2]) {
        const message = state.messages.find(m => m.id === match[2] && m.channel_id === channel);
        return reply(res, message ? 200 : 404, message ? nativeMessage(message, true) : { code: 10008 });
      }
      const before = path.searchParams.get('before');
      const limit = Number(path.searchParams.get('limit') ?? 50);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) return reply(res, 400, { code: 50035 });
      return reply(res, 200, state.messages.filter(m => m.channel_id === channel && (!before || BigInt(m.id) < BigInt(before))).reverse().slice(0, limit).map(m => nativeMessage(m)));
    }
    const components = body.components as DiscordActionRow[] | undefined;
    if ((body.content !== undefined && [...String(body.content)].length > 2000)
      || (components && (components.length > 5 || components.some(row => row.components.length > 5
        || row.components.some(button => [...button.label].length > 80 || [...(button.custom_id ?? '')].length > 100)))))
      return reply(res, 400, { code: 50035, message: 'Invalid Form Body' });
    if (req.method === 'POST') {
      const key = `${DISCORD_IDS.bot}:${String(body.nonce)}`;
      const old = nonces.get(key);
      if (body.enforce_nonce && old && clock.now().getTime() - old.at < 300_000) return reply(res, 200, old.message);
      const reference = body.message_reference as { message_id: string; fail_if_not_exists?: boolean } | undefined;
      const target = reference && state.messages.find(m => m.id === reference.message_id && m.channel_id === channel);
      if (reference && !target && reference.fail_if_not_exists !== false) return reply(res, 400, { code: 10008 });
      const message: DiscordMessage = { ...(target ? { message_reference: { message_id: target.id } } : {}), id: String(nextId++), channel_id: channel,
        author: { id: DISCORD_IDS.bot, username: 'Fixture bot', bot: true }, content: String(body.content ?? ''),
        timestamp: clock.now().toISOString(), type: 0,
        ...(typeof body.flags === 'number' ? { flags: body.flags } : {}),
        ...(Array.isArray(body.attachments) ? { attachments: body.attachments as NonNullable<DiscordMessage['attachments']> } : {}), nonce: String(body.nonce), ...(components ? { components } : {}) };
      if (uploads.length) message.attachments = uploads.map((file, id) => {
        const key = `upload-${message.id}-${id}`;
        cdn.set(key, { content: file.bytes.toString('base64') });
        return { id: String(id), filename: file.name, size: file.bytes.length, url: `${url}/cdn/${key}` };
      });
      state.messages.push(redact.value(message));
      for (const file of uploads) state.uploads.push({ message: message.id, name: redact.text(file.name), size: file.bytes.length, sha256: createHash('sha256').update(file.bytes).digest('hex') });
      nonces.set(key, { at: clock.now().getTime(), message });
      state.pings.push(pings(body));
      if (fault?.response === 'holdStored') {
        await new Promise<void>(resolve => {
          const id = nextHold++; const release = () => { held.delete(id); resolve(); };
          held.set(id, release); nativeHeld.resolve();
          if (options.publishHeld !== false) events.emit('held', id);
          res.once('close', release);
        });
        if (res.destroyed) return;
      }
      return reply(res, 200, redact.value(message));
    }
    if (req.method === 'PATCH') {
      const message = state.messages.find(m => m.id === match[2] && m.channel_id === channel);
      if (!message) return reply(res, 404, { code: 10008 });
      if (components !== undefined) message.components = redact.value(components);
      if (body.content !== undefined) message.content = redact.text(String(body.content));
      state.pings.push(pings(body));
      return reply(res, 200, message);
    }
    return reply(res, 404, {});
  }
  const server = createServer((req, res) => {
    const work = handle(req, res).catch(() => { if (!res.destroyed) reply(res, 400, { message: 'Invalid request' }); });
    handlers.add(work); void work.finally(() => handlers.delete(work));
  });
  const gateway = fakeGateway(server, clock);
  state.gateway = gateway.state;
  server.on('connection', socket => {
    const closed = Promise.withResolvers<void>();
    sockets.set(socket, closed.promise);
    socket.once('close', () => { sockets.delete(socket); closed.resolve(); });
    socket.on('error', () => socket.destroy());
    if (lifetime.signal.aborted) socket.destroy();
  });
  server.on('listening', () => {
    didListen = true;
    nativeListening.resolve();
    if (lifetime.signal.aborted) { server.close(); return; }
    if (options.publishListening !== false) serving.resolve();
  });
  server.on('close', () => { didClose = true; nativeClosed.resolve(); });
  server.on('error', () => serving.reject(new Error('Discord fake native listen failed')));
  let closing: Promise<void> | undefined;
  const close = () => closing ??= (async () => {
    lifetime.abort();
    for (const release of held.values()) release();
    held.clear();
    for (const socket of sockets.keys()) socket.destroy();
    if (!invoked) { didClose = true; nativeClosed.resolve(); }
    else if (!didClose) server.close(error => {
      if (error && (error as NodeJS.ErrnoException).code === 'ERR_SERVER_NOT_RUNNING' && !didListen) {
        didClose = true; nativeClosed.resolve();
      }
    });
    const results = await Promise.allSettled([
      within(gateway.close(), 2000, realClock, () => new Error('Discord fake gateway close incomplete')),
      within(nativeClosed.promise, 2000, realClock, () => new Error('Discord fake native close incomplete')),
      within((async () => {
        while (sockets.size || handlers.size) await Promise.allSettled([...sockets.values(), ...handlers]);
      })(), 2000, realClock, () => new Error('Discord fake socket/handler drainage incomplete')),
      within(Promise.allSettled([...observers]), 2000, realClock, () => new Error('Discord fake observer drainage incomplete')),
    ]);
    const failures = results.filter(r => r.status === 'rejected').map(r => r.reason);
    if (failures.length) throw new AggregateError(failures, 'Discord fake disposal incomplete');
  })();
  onCleanup(t, close);
  let url = '';
  async function control(operation: 'cdn', body?: object): Promise<{ requests: Array<{ id: string; authorization: boolean }>; closed: string[] }>;
  async function control(operation: 'state'): Promise<DiscordState>;
  async function control(operation: 'interact', body: object): Promise<{ id: string }>;
  async function control(operation: 'say', body: { contents: string[] }): Promise<DiscordMessage[]>;
  async function control(operation: 'say', body: object): Promise<DiscordMessage>;
  async function control(operation: 'configure' | 'fault' | 'release' | 'dispatch' | 'close' | 'drop' | 'delete', body: object): Promise<Record<string, never>>;
  async function control(operation: string, body?: object): Promise<unknown> {
    const deadline = new AbortController();
    const timer = setTimeout(() => deadline.abort(), 2000);
    try {
    const response = await fetch(`${url}/control/${operation}`, {
      method: body ? 'POST' : 'GET', ...(body ? { body: JSON.stringify(body) } : {}),
      headers: { connection: 'close' }, signal: AbortSignal.any([lifetime.signal, deadline.signal]),
    });
    if (!response.ok) throw new Error('Discord fake control request refused');
    return await response.json();
    } finally { clearTimeout(timer); }
  }
  function observeNative<T>(work: Promise<T>): Promise<T> {
    const observation = within(abortable(work, lifetime.signal), 2000)
      .finally(() => observers.delete(observation));
    observers.add(observation);
    return observation;
  }
  const receipts = () => ({ listening: didListen, closed: didClose, connections: sockets.size,
    handlers: handlers.size, observers: observers.size, held: held.size });
  function gatewayCloseObservation(signal = t.signal): Promise<void> {
    const published = options.publishGatewayClose === false ? new Promise<void>(() => {}) : gateway.closed;
    const observation = within(abortable(published, AbortSignal.any([signal, lifetime.signal])), 1000, options.setupClock ?? realClock,
      () => new Error('Discord fake gateway close receipt deadline reached')).finally(() => observers.delete(observation));
    observers.add(observation);
    return observation;
  }
  const client = () => ({ gatewayReceipts: gateway.receipts, closeGateway: gateway.close, waitForGatewayClose: gatewayCloseObservation, url, ids: DISCORD_IDS, control, close, receipts,
    held: () => observeNative(nativeHeld.promise),
    waitForHold(signal = AbortSignal.timeout(2000)): Promise<number> {
      const pending = Promise.withResolvers<number>();
      const receive = (id: number) => pending.resolve(id);
      events.once('held', receive);
      const combined = AbortSignal.any([signal, lifetime.signal]);
      const observation = within(abortable(pending.promise, combined), 1000, options.setupClock ?? realClock,
        () => new Error('Discord fake hold receipt deadline reached'))
        .catch(error => { throw new Error(combined.aborted ? 'Discord fake observation aborted' : String(error)); })
        .finally(() => { events.off('held', receive); observers.delete(observation); });
      observers.add(observation);
      return observation;
    },
  });
  let starting: Promise<ReturnType<typeof client>> | undefined;
  const start = () => starting ??= (async () => {
    const signal = AbortSignal.any([lifetime.signal, t.signal, ...(options.signal ? [options.signal] : [])]);
    try {
      const ready = within(abortable(serving.promise, signal), 1000, options.setupClock ?? realClock,
        () => new Error('Discord fake listening receipt deadline reached'));
      void ready.catch(() => {});
      const gatewayReady = within(abortable(options.publishGatewayListening === false ? new Promise<void>(() => {}) : gateway.listening, signal),
        1000, options.setupClock ?? realClock, () => new Error('Discord fake gateway listening receipt deadline reached'));
      void gatewayReady.catch(() => {});
      signal.throwIfAborted();
      invoked = true;
      server.listen({ port: 0, host: '127.0.0.1', signal: lifetime.signal });
      await Promise.all([ready, gatewayReady]);
      signal.throwIfAborted();
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Discord fake did not bind loopback');
      url = `http://127.0.0.1:${address.port}`;
      return client();
    } catch (error) {
      const reason = signal.aborted ? 'Discord fake setup aborted' : redact(String(error));
      await close();
      throw new Error(reason);
    }
  })();
  return { start, close, receipts,
    listening: () => observeNative(nativeListening.promise),
    gatewayListening: () => observeNative(gateway.listening),
    gatewayReceipts: gateway.receipts,
  };
}

export async function fakeDiscordFixture(t: TestContext, options: FakeOptions = {}) {
  return discordFixtureOwner(t, options).start();
}
