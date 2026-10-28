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
export type DiscordRequestOptions = { signal?: AbortSignal };
export class DiscordApi {
  readonly #token: string;
  readonly #root: string;
  readonly #redactor: RemoteRedactor;
  constructor(token: string, options: { apiRoot?: string; redactor?: RemoteRedactor } = {}) {
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
  async #request<T>(method: string, path: string, route: string, body?: object, options?: DiscordRequestOptions): Promise<T> {
    const signal = options?.signal ? AbortSignal.any([AbortSignal.timeout(35_000), options.signal]) : AbortSignal.timeout(35_000);
    let response: Response;
    try {
      response = await fetch(this.#root + path, { method, redirect: 'error', signal,
        headers: { authorization: `Bot ${this.#token}`, 'user-agent': DISCORD_USER_AGENT, 'content-type': 'application/json', connection: 'close' },
        ...(body ? { body: JSON.stringify(body) } : {}) });
    } catch { throw new DiscordError(route, 0, 'request failed or exceeded its time bound'); }
    let value: unknown;
    try { value = await response.json(); }
    catch { throw new DiscordError(route, response.status, 'invalid JSON response'); }
    if (!response.ok) {
      const error = value && typeof value === 'object' ? value as Record<string, unknown> : {};
      throw new DiscordError(route, response.status, this.#redactor(typeof error.message === 'string' ? error.message : 'request refused'),
        typeof error.code === 'number' && Number.isInteger(error.code) ? error.code : undefined,
        typeof error.retry_after === 'number' && Number.isFinite(error.retry_after) && error.retry_after >= 0 ? error.retry_after : undefined);
    }
    // Gateway and application URLs are protocol data. Keep them intact while
    // still passing any credential echo through the shared output redactor.
    return redactValue(value, text => text.includes(this.#token) ? this.#redactor.text(text) : text) as T;
  }
}
