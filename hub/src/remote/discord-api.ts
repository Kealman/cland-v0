import { realClock, type Clock } from '../hub/clock.ts';
import { VERSION } from '../version.ts';
import { redactValue, remoteRedactor, type RemoteRedactor } from './redact.ts';

export type DiscordUser = { id: string; username: string; bot?: boolean };
export type DiscordMessage = {
  id: string; channel_id: string; author: DiscordUser; content: string; timestamp: string;
  type: number; webhook_id?: string; nonce?: string; components?: DiscordActionRow[];
};
export type DiscordButton = { type: 2; style: number; label: string; custom_id?: string; url?: string };
export type DiscordActionRow = { type: 1; components: DiscordButton[] };
export type DiscordMessageInput = { content?: string; components?: DiscordActionRow[]; flags?: number };
export const DISCORD_USER_AGENT = `DiscordBot (https://github.com/Kealman/cland-v0, ${VERSION})`;

/** Sanitized facts only; native fetch exceptions and credential-bearing URLs stay private. */
export class DiscordError extends Error {
  readonly route: string;
  readonly status: number;
  readonly code: number | undefined;
  readonly retryAfter: number | undefined;
  constructor(route: string, status: number, description: string, code?: number, retryAfter?: number) {
    super(`Discord ${route} failed: ${status} ${description}`);
    this.name = 'DiscordError';
    this.route = route; this.status = status; this.code = code; this.retryAfter = retryAfter;
  }
}
export type DiscordApplication = { id: string; flags: number; bot_public: boolean; interactions_endpoint_url: string | null };
export type DiscordSessionStartLimit = { total: number; remaining: number; reset_after: number; max_concurrency: number };
export type DiscordGatewayBot = { url: string; session_start_limit: DiscordSessionStartLimit };
export type DiscordChannel = { id: string; guild_id: string; last_message_id: string | null };
export type DiscordRequestOptions = { signal?: AbortSignal; /** Absolute original-attempt nonce deadline; never renewed by a queue or retry. */ nonceDeadline?: number };
export class DiscordApi {
  readonly #clock: Clock;
  readonly #timeout: number;
  readonly #routes = new Map<string, string>();
  readonly #tails = new Map<string, Promise<void>>();
  readonly #waits = new Map<string, number>();
  #global = 0;
  readonly #exchanges = new Set<(channel: string, ok: boolean) => void>();
  /** Settled message sends/edits, after pacing and retries; no payloads or native errors. */
  onExchange(listener: (channel: string, ok: boolean) => void): () => void { this.#exchanges.add(listener); return () => { this.#exchanges.delete(listener); }; }
  readonly #errors = new Set<(error: DiscordError, channel?: string) => void>();
  onError(listener: (error: DiscordError, channel?: string) => void): () => void { this.#errors.add(listener); return () => { this.#errors.delete(listener); }; }
  readonly #token: string;
  readonly #root: string;
  readonly #redactor: RemoteRedactor;
  constructor(token: string, options: { apiRoot?: string; redactor?: RemoteRedactor; clock?: Clock; timeoutMs?: number } = {}) {
    this.#clock = options.clock ?? realClock; this.#timeout = options.timeoutMs ?? 35_000;
    this.#token = token;
    this.#redactor = options.redactor ?? remoteRedactor();
    this.#redactor.register([token]);
    const override = options.apiRoot ?? process.env.CLAND_DISCORD_API_ROOT;
    let root: URL;
    try { root = new URL(override ?? 'https://discord.com/api/v10'); }
    catch { throw new Error('Discord API root must be an explicit loopback HTTP URL with a port'); }
    if (override !== undefined && (!/^http:\/\/(?:127\.0\.0\.1|\[::1\]):[0-9]+(?:\/|$)/.test(override)
      || root.protocol !== 'http:' || root.port === '0' || !['127.0.0.1', '[::1]'].includes(root.hostname)
      || root.username || root.password || root.search || root.hash))
      throw new Error('Discord API root must be an explicit loopback HTTP URL with a port');
    this.#root = root.href.replace(/\/+$/, '');
  }
  getCurrentApplication(options?: DiscordRequestOptions): Promise<DiscordApplication> {
    return this.#request('GET', '/oauth2/applications/@me', 'GET /oauth2/applications/@me', undefined, options);
  }
  callback(id: string, token: string, content: string, options?: DiscordRequestOptions): Promise<unknown> {
    return this.#request('POST', `/interactions/${encodeURIComponent(id)}/${encodeURIComponent(token)}/callback`, 'POST /interactions/:id/:token/callback',
      { type: 4, data: { content, flags: 64, allowed_mentions: { parse: [] } } }, options);
  }
  defer(id: string, token: string, options?: DiscordRequestOptions): Promise<unknown> {
    return this.#request('POST', `/interactions/${encodeURIComponent(id)}/${encodeURIComponent(token)}/callback`, 'POST /interactions/:id/:token/callback',
      { type: 5, data: { flags: 64, allowed_mentions: { parse: [] } } }, options);
  }
  editOriginal(application: string, token: string, content: string, options?: DiscordRequestOptions): Promise<unknown> {
    return this.#request('PATCH', `/webhooks/${encodeURIComponent(application)}/${encodeURIComponent(token)}/messages/@original`, 'PATCH /webhooks/:application/:token/messages/@original',
      { content, allowed_mentions: { parse: [] } }, options);
  }
  followup(application: string, token: string, content: string, options?: DiscordRequestOptions): Promise<unknown> {
    return this.#request('POST', `/webhooks/${encodeURIComponent(application)}/${encodeURIComponent(token)}`, 'POST /webhooks/:application/:token',
      { content, flags: 64, allowed_mentions: { parse: [] } }, options);
  }
  listCommands(application: string, options?: DiscordRequestOptions): Promise<unknown[]> {
    return this.#request('GET', `/applications/${encodeURIComponent(application)}/commands`, 'GET /applications/:application/commands', undefined, options);
  }
  putCommands(application: string, commands: object[], options?: DiscordRequestOptions): Promise<unknown[]> {
    return this.#request('PUT', `/applications/${encodeURIComponent(application)}/commands`, 'PUT /applications/:application/commands', commands, options);
  }
  getGatewayBot(options?: DiscordRequestOptions): Promise<DiscordGatewayBot> {
    return this.#request('GET', '/gateway/bot', 'GET /gateway/bot', undefined, options);
  }
  getChannel(channel: string, options?: DiscordRequestOptions): Promise<DiscordChannel> {
    return this.#request('GET', `/channels/${encodeURIComponent(channel)}`, 'GET /channels/:channel', undefined, options);
  }
  listMessages(channel: string, page: { before?: string; limit?: number } = {}, options?: DiscordRequestOptions): Promise<DiscordMessage[]> {
    const query = new URLSearchParams();
    if (page.before !== undefined) query.set('before', page.before);
    if (page.limit !== undefined) query.set('limit', String(page.limit));
    return this.#request('GET', `/channels/${encodeURIComponent(channel)}/messages?${query}`, 'GET /channels/:channel/messages', undefined, options);
  }
  createMessage(channel: string, input: DiscordMessageInput & { nonce: string }, options?: DiscordRequestOptions): Promise<DiscordMessage> {
    if (!input.nonce || [...input.nonce].length > 25) return Promise.reject(new DiscordError('POST /channels/:channel/messages', 0, 'nonce must have 1 to 25 characters'));
    return this.#request('POST', `/channels/${encodeURIComponent(channel)}/messages`, 'POST /channels/:channel/messages',
      { ...input, enforce_nonce: true, allowed_mentions: { parse: [] } }, options);
  }
  editMessage(channel: string, message: string, input: DiscordMessageInput, options?: DiscordRequestOptions): Promise<DiscordMessage> {
    return this.#request('PATCH', `/channels/${encodeURIComponent(channel)}/messages/${encodeURIComponent(message)}`,
      'PATCH /channels/:channel/messages/:message', { ...input, allowed_mentions: { parse: [] } }, options);
  }
  addReaction(channel: string, message: string, emoji: string, options?: DiscordRequestOptions): Promise<unknown> {
    return this.#request('PUT', `/channels/${encodeURIComponent(channel)}/messages/${encodeURIComponent(message)}/reactions/${encodeURIComponent(emoji)}/@me`,
      'PUT /channels/:channel/messages/:message/reactions/:emoji/@me', undefined, options);
  }
  async #pause(until: number, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted();
    const ms = until - this.#clock.now().getTime();
    if (ms <= 0) return;
    await new Promise<void>((resolve, reject) => {
      const finish = () => { this.#clock.clearTimeout(timer); signal?.removeEventListener('abort', abort); resolve(); };
      const abort = () => { this.#clock.clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(new DiscordError('REST', 0, 'request aborted')); };
      const timer = this.#clock.setTimeout(finish, ms); timer.unref();
      signal?.addEventListener('abort', abort, { once: true });
    });
  }
  async #request<T>(method: string, path: string, route: string, body?: object, options?: DiscordRequestOptions): Promise<T> {
    body = body === undefined ? undefined : structuredClone(body);
    if (route.includes(':token')) return this.#native(method, path, route, body, options);
    const nonceDeadline = route === 'POST /channels/:channel/messages' ? options?.nonceDeadline ?? this.#clock.now().getTime() + 120_000 : undefined;
    const major = /^\/channels\/([^/?]+)/.exec(path)?.[1] ?? '';
    const logical = `${route}:${major}`;
    const exchange = (ok: boolean) => {
      if (/^\d+$/.test(major) && (route === 'POST /channels/:channel/messages' || route === 'PATCH /channels/:channel/messages/:message'))
        for (const listener of this.#exchanges) listener(major, ok);
    };
    // A queued route resolves its bucket again after the previous owner finishes.
    const routeTail = this.#tails.get(logical) ?? Promise.resolve();
    const done = Promise.withResolvers<void>(); this.#tails.set(logical, done.promise);
    await routeTail;
    const owned = new Set<string>();
    const adopt = (key: string): Promise<void> | undefined => {
      if (owned.has(key)) return;
      owned.add(key);
      const previous = this.#tails.get(key);
      const tail = previous ? Promise.all([previous, done.promise]).then(() => {}) : done.promise;
      this.#tails.set(key, tail);
      void tail.then(() => { if (this.#tails.get(key) === tail) this.#tails.delete(key); });
      return previous;
    };
    try {
      const key = this.#routes.get(logical) ?? logical;
      if (key !== logical) {
        await adopt(key);
      }
      for (let attempt = 0;; attempt++) {
        let due: number;
        while ((due = Math.max(this.#global, this.#waits.get(this.#routes.get(logical) ?? logical) ?? 0)) > this.#clock.now().getTime())
          await this.#pause(due, options?.signal);
        if (nonceDeadline !== undefined && (!Number.isFinite(nonceDeadline) || this.#clock.now().getTime() >= nonceDeadline))
          throw new DiscordError(route, 0, 'nonce proof window expired');
        try { const result = await this.#native<T>(method, path, route, body, options, logical, major, adopt); exchange(true); return result; }
        catch (error) {
          if (!(error instanceof DiscordError)) throw error;
          if ([401, 403, 404].includes(error.status)) throw error;
          if (error.status === 429) continue;
          // Only an enforced, unchanged nonce proves a timed-out POST safe to repeat.
          if (error.status === 0 && attempt === 0 && method === 'POST' && route === 'POST /channels/:channel/messages'
            && (body as { enforce_nonce?: boolean })?.enforce_nonce === true
            && nonceDeadline !== undefined && this.#clock.now().getTime() < nonceDeadline && !options?.signal?.aborted) continue;
          if (attempt < 3 && (error.status >= 500 || error.code === 130000)
            && (nonceDeadline === undefined || this.#clock.now().getTime() < nonceDeadline)) {
            await this.#pause(this.#clock.now().getTime() + Math.min(30_000, 1000 * 2 ** attempt), options?.signal); continue;
          }
          throw error;
        }
      }
    } catch (error) {
      // Editing a deleted native message is job-local, not a failed connection.
      if (!(route === 'PATCH /channels/:channel/messages/:message' && error instanceof DiscordError && error.status === 404)) exchange(false);
      throw error;
    } finally { done.resolve(); if (this.#tails.get(logical) === done.promise) this.#tails.delete(logical); }
  }
  async #native<T>(method: string, path: string, route: string, body?: object, options?: DiscordRequestOptions, logical?: string, major?: string, adopt?: (key: string) => unknown): Promise<T> {
    const deadline = new AbortController();
    const timer = this.#clock.setTimeout(() => deadline.abort(), this.#timeout); timer.unref();
    const signal = options?.signal ? AbortSignal.any([deadline.signal, options.signal]) : deadline.signal;
    try {
      let response: Response;
      try {
        response = await fetch(this.#root + path, { method, redirect: 'error', signal,
          headers: { authorization: `Bot ${this.#token}`, 'user-agent': DISCORD_USER_AGENT, 'content-type': 'application/json', connection: 'close' },
          ...(body ? { body: JSON.stringify(body) } : {}) });
      } catch { throw new DiscordError(route, 0, 'request failed or exceeded its time bound'); }
      if (logical) {
        const bucket = response.headers.get('X-RateLimit-Bucket');
        const key = bucket ? `bucket:${bucket}:${major}` : this.#routes.get(logical) ?? logical;
        if (bucket) { adopt?.(key); this.#routes.set(logical, key); }
        const remaining = response.headers.get('X-RateLimit-Remaining');
        const reset = Number(response.headers.get('X-RateLimit-Reset-After'));
        if (remaining !== null && Number(remaining) === 0 && Number.isFinite(reset) && reset >= 0)
          this.#waits.set(key, this.#clock.now().getTime() + reset * 1000);
      }
      if (response.status === 204 && response.ok) return undefined as T;
      let value: unknown;
      try { value = await response.json(); }
      catch { throw new DiscordError(route, response.status, 'invalid JSON response'); }
      if (!response.ok) {
        const error = value && typeof value === 'object' ? value as Record<string, unknown> : {};
        if (logical && response.status === 429) {
          const seconds = typeof error.retry_after === 'number' && Number.isFinite(error.retry_after) ? error.retry_after : 1;
          const until = this.#clock.now().getTime() + Math.max(1, Math.min(300_000, seconds * 1000));
          if (error.global === true) this.#global = Math.max(this.#global, until);
          else this.#waits.set(this.#routes.get(logical) ?? logical, until);
        }
        throw new DiscordError(route, response.status, route.includes(':token') ? 'interaction request refused' : this.#redactor(typeof error.message === 'string' ? error.message : 'request refused'),
          typeof error.code === 'number' && Number.isInteger(error.code) ? error.code : undefined,
          typeof error.retry_after === 'number' && Number.isFinite(error.retry_after) && error.retry_after >= 0 ? error.retry_after : undefined);
      }
      // Gateway and application URLs are protocol data. Keep them intact while
      // still passing any credential echo through the shared output redactor.
      return redactValue(value, text => text.includes(this.#token) ? this.#redactor.text(text) : text) as T;
    } catch (error) {
      if (error instanceof DiscordError) for (const listener of this.#errors) listener(error, /^\/channels\/(\d+)(?:\/|$)/.exec(path)?.[1]);
      throw error;
    } finally { this.#clock.clearTimeout(timer); }
  }
}
