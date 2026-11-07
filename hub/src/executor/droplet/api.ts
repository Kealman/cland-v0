import { parseDigitalOceanEndpoint, type DigitalOceanEndpoint } from './endpoint.ts';
import { createHash } from 'node:crypto';
import { realClock, type Clock } from '../../hub/clock.ts';
export type Size = { slug: string; available: boolean; price_hourly: number; regions: string[]; disk?: number };
export type Region = { slug: string; available: boolean; sizes: string[] };
export type Key = { id: number; name: string; public_key: string };
export type Droplet = { id: number; name: string; tags: string[]; created_at: string; status: string; networks: { v4: { type: string; ip_address: string }[] } };
export type CreateDroplet = { name: string; tags: string[]; size: string; region: string; image: string | number; ssh_keys: number[]; user_data?: string };

export type Action = { id: number; status: 'in-progress' | 'completed' | 'errored'; resource_id?: number; type?: string };
export type SnapshotImage = { id: number; name: string; regions: string[]; size_gigabytes: number; min_disk_size: number; created_at: string; resource_id?: string };

export const apiTimeoutMs = (env: NodeJS.ProcessEnv = process.env): number => {
  const value = Number(env.CLAND_TEST_DIGITALOCEAN_TIMEOUT_MS);
  return value > 0 && Number.isFinite(value) ? Math.min(15000, value) : 15000;
};

export class DigitalOceanError extends Error {
  readonly status: number;
  readonly id: string;
  readonly retryAt: number | undefined;
  constructor(status: number, id: string, message: string, retryAt?: number) { super(`DigitalOcean ${status} ${id}: ${message}`); this.status = status; this.id = id; this.retryAt = retryAt; }
}

/** A refused request is never automatically replayed. retryAt is UTC epoch milliseconds. */
export class RateLimited extends DigitalOceanError {
  constructor(retryAt: number | undefined, id = 'rate_limited', message = 'request rate limited') { super(429, id, message, retryAt); }
}

/** Shared by HTTP and the scripted fake. Invalid/missing headers impose no invented provider cooldown. */
export function rateLimited(headers: { get(name: string): string | null }, now: number, id?: string, message?: string): RateLimited {
  const after = headers.get('retry-after');
  const reset = headers.get('ratelimit-reset');
  const seconds = after !== null && /^\d+(?:\.\d+)?$/.test(after.trim()) ? Number(after) : NaN;
  const afterAt = Number.isFinite(seconds) ? now + seconds * 1000 : after ? Date.parse(after) : NaN;
  const resetAt = reset !== null && /^\d+(?:\.\d+)?$/.test(reset.trim()) ? Number(reset) * 1000 : NaN;
  const times = [afterAt, resetAt].filter(time => Number.isFinite(time) && time >= now);
  return new RateLimited(times.length ? Math.max(...times) : undefined, id, message);
}

// A rolling send log enforces the endpoint declaration in every moving minute.
// Hash keys prevent the shared budget registry retaining credentials.
type Budget = { sent: number[]; retryAt: number; limit: number };
const budgets = new WeakMap<Clock, Map<string, Budget>>();
function tokenBudget(clock: Clock, token: string, endpoint: DigitalOceanEndpoint): Budget {
  let tokens = budgets.get(clock);
  if (!tokens) { tokens = new Map(); budgets.set(clock, tokens); }
  const key = createHash('sha256').update(endpoint.base).update('\0').update(token).digest('hex');
  let budget = tokens.get(key);
  if (!budget) { budget = { sent: [], retryAt: 0, limit: endpoint.requestsPerMinute }; tokens.set(key, budget); }
  budget.limit = Math.min(budget.limit, endpoint.requestsPerMinute);
  return budget;
}

/** The mutation may be accepted, but only a GET 404 confirms absence. */
export class DeletionUnconfirmed extends DigitalOceanError {
  readonly path: string;
  readonly accepted: boolean;
  constructor(path: string, accepted: boolean, cause?: unknown) { super(409, 'deletion-unconfirmed', `deletion not confirmed for ${path}`); this.path = path; this.accepted = accepted; if (cause !== undefined) this.cause = cause; }
}

export type ProviderCall = (method: string, path: string, body: unknown, deadline?: number) => Promise<unknown>;

/** Only this call scope holds the token. Transport failures never expose fetch's request. */
export class DigitalOceanApi {
  readonly #env: NodeJS.ProcessEnv;
  readonly #clock: Clock;
  readonly #callProvider: ProviderCall | undefined;
  readonly #signal: AbortSignal | undefined;
  constructor(env: NodeJS.ProcessEnv = process.env, clock: Clock = realClock, callProvider?: ProviderCall, signal?: AbortSignal) { this.#callProvider = callProvider; this.#clock = clock; this.#env = env; this.#signal = signal; }
  async #admit<T>(budget: Budget, send: () => Promise<T>, deadline?: number): Promise<T> {
    for (;;) {
      this.#signal?.throwIfAborted();
      const now = this.#clock.now().getTime();
      if (deadline !== undefined && now >= deadline) throw new DigitalOceanError(0, 'deadline', 'request deadline reached');
      budget.sent = budget.sent.filter(time => time > now - 60000);
      const next = Math.max(budget.retryAt, budget.sent.length >= budget.limit ? budget.sent[0]! + 60000 : now);
      if (next <= now) { budget.sent.push(now); return send(); }
      await new Promise<void>((resolve, reject) => {
        const finish = () => { this.#signal?.removeEventListener('abort', abort); resolve(); };
        const timer = this.#clock.setTimeout(finish, Math.min(2147483647, Math.min(next, deadline ?? Infinity) - now));
        const abort = () => { this.#clock.clearTimeout(timer); this.#signal?.removeEventListener('abort', abort); reject(this.#signal?.reason); };
        this.#signal?.addEventListener('abort', abort, { once: true });
      });
    }
  }
  async #call<T>(method: string, path: string, body?: unknown, deadline?: number): Promise<T> {
    const token = this.#env.DIGITALOCEAN_TOKEN;
    if (!token) throw new Error('DIGITALOCEAN_TOKEN is required');
    const endpoint = parseDigitalOceanEndpoint(this.#env.CLAND_DIGITALOCEAN_API);
    const base = endpoint.base;
    const budget = tokenBudget(this.#clock, token, endpoint);
    return this.#admit(budget, () => this.#send<T>(token, budget, base, method, path, body, deadline), deadline);
  }
  async #send<T>(token: string, budget: Budget, base: string, method: string, path: string, body?: unknown, deadline?: number): Promise<T> {
    this.#signal?.throwIfAborted();
    if (this.#callProvider) {
      try { return await this.#callProvider(method, path, body, deadline) as T; }
      catch (error) { if (error instanceof RateLimited && error.retryAt !== undefined) budget.retryAt = Math.max(budget.retryAt, error.retryAt); throw error; }
    }
    const url = new URL(`${base}${path}`);
    const redact = (value: unknown): string => String(value ?? '').split(token).join('[redacted]');
    const remaining = deadline === undefined ? Infinity : deadline - this.#clock.now().getTime();
    const transportTimeout = apiTimeoutMs(this.#env);
    const timeout = Math.ceil(Math.min(transportTimeout, remaining));
    if (timeout <= 0) throw new DigitalOceanError(0, 'deadline', 'request deadline reached');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new DOMException('The operation was aborted due to timeout', 'TimeoutError')), timeout);
    timer.unref();
    const signal = this.#signal ? AbortSignal.any([controller.signal, this.#signal]) : controller.signal;
    try {
      const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal, redirect: 'error' });
      if (response.status === 429) {
        const refusal = rateLimited(response.headers, this.#clock.now().getTime());
        if (refusal.retryAt !== undefined) budget.retryAt = Math.max(budget.retryAt, refusal.retryAt);
        let diagnostics: unknown;
        try { diagnostics = await response.json(); } catch { /* A 429 stays typed even without JSON. */ }
        const value = diagnostics !== null && typeof diagnostics === 'object' && !Array.isArray(diagnostics) ? diagnostics as Record<string, unknown> : {};
        throw new RateLimited(refusal.retryAt, value?.id === undefined ? undefined : redact(value.id), value?.message === undefined ? undefined : redact(value.message));
      }
      if (response.status === 204) return undefined as T;
      let value: Record<string, unknown>;
      try { value = await response.json() as Record<string, unknown>; }
      catch (error) {
        if (signal.aborted) throw error;
        throw new DigitalOceanError(response.status, 'response', 'invalid JSON response');
      }
      if (!response.ok) throw new DigitalOceanError(response.status, redact(value.id), redact(value.message), response.status === 422 ? rateLimited(response.headers, this.#clock.now().getTime()).retryAt : undefined);
      return value as T;
    } catch (error) {
      this.#signal?.throwIfAborted();
      if (error instanceof DigitalOceanError) throw error;
      if (signal.aborted && remaining <= transportTimeout) throw new DigitalOceanError(0, 'deadline', 'request deadline reached');
      throw new DigitalOceanError(0, 'transport', 'request failed or exceeded its time bound');
    } finally { clearTimeout(timer); }
  }
  async #list<T>(path: string, field: string, deadline?: number): Promise<T[]> {
    const values: T[] = [];
    let page = 1;
    for (;;) {
      const result = await this.#call<Record<string, unknown>>('GET', `${path}${path.includes('?') ? '&' : '?'}per_page=200&page=${page}`, undefined, deadline);
      if (!Array.isArray(result[field])) throw new DigitalOceanError(0, 'response', `missing ${field}`);
      values.push(...result[field] as T[]);
      // Only a page number is followed; provider-controlled URLs cannot receive the token.
      const next = (result.links as { pages?: { next?: string } } | undefined)?.pages?.next;
      if (!next) return values;
      if (++page > 10000) throw new DigitalOceanError(0, 'response', 'pagination limit reached');
    }
  }
  async image(id: string | number, deadline?: number): Promise<unknown> { return (await this.#call<{ image: unknown }>('GET', `/images/${encodeURIComponent(id)}`, undefined, deadline)).image; }
  async account(deadline?: number): Promise<unknown> { return (await this.#call<{ account: unknown }>('GET', '/account', undefined, deadline)).account; }
  sizes(deadline?: number): Promise<Size[]> { return this.#list('/sizes', 'sizes', deadline); }
  regions(deadline?: number): Promise<Region[]> { return this.#list('/regions', 'regions', deadline); }
  droplets(tag: string, deadline?: number): Promise<Droplet[]> { return this.#list(`/droplets?tag_name=${encodeURIComponent(tag)}`, 'droplets', deadline); }
  keys(deadline?: number): Promise<Key[]> { return this.#list('/account/keys', 'ssh_keys', deadline); }
  async create(input: CreateDroplet, deadline?: number): Promise<Droplet> { return (await this.#call<{ droplet: Droplet }>('POST', '/droplets', input, deadline)).droplet; }
  async droplet(id: number, deadline?: number): Promise<Droplet> { return (await this.#call<{ droplet: Droplet }>('GET', `/droplets/${id}`, undefined, deadline)).droplet; }
  async key(id: number, deadline?: number): Promise<Key> { return (await this.#call<{ ssh_key: Key }>('GET', `/account/keys/${id}`, undefined, deadline)).ssh_key; }
  async importKey(name: string, publicKey: string, deadline?: number): Promise<Key> { return (await this.#call<{ ssh_key: Key }>('POST', '/account/keys', { name, public_key: publicKey }, deadline)).ssh_key; }
  async deleteDroplet(id: number, deadline?: number, accepted?: () => Promise<void>): Promise<void> { await this.#confirmedDelete(`/droplets/${id}`, deadline, accepted); }
  async deleteKey(id: number, deadline?: number, accepted?: () => Promise<void>): Promise<void> { await this.#confirmedDelete(`/account/keys/${id}`, deadline, accepted); }
  async dropletAction(id: number, type: 'power_off' | 'snapshot', name?: string, deadline?: number): Promise<Action> { return (await this.#call<{ action: Action }>('POST', `/droplets/${id}/actions`, { type, ...(name ? { name } : {}) }, deadline)).action; }
  async action(id: number, deadline?: number): Promise<Action> { return (await this.#call<{ action: Action }>('GET', `/actions/${id}`, undefined, deadline)).action; }
  actions(deadline?: number): Promise<Action[]> { return this.#list('/actions', 'actions', deadline); }
  async snapshots(deadline?: number): Promise<SnapshotImage[]> {
    // The snapshots endpoint represents ids as strings; create and image actions use numbers.
    return (await this.#list<SnapshotImage>('/snapshots?resource_type=droplet', 'snapshots', deadline)).map(image => ({ ...image, id: Number(image.id) }));
  }
  async snapshot(id: number, deadline?: number): Promise<SnapshotImage> { return (await this.#call<{ snapshot: SnapshotImage }>('GET', `/snapshots/${id}`, undefined, deadline)).snapshot; }
  async transferImage(id: number, region: string, deadline?: number): Promise<Action> { return (await this.#call<{ action: Action }>('POST', `/images/${id}/actions`, { type: 'transfer', region }, deadline)).action; }
  async tagImage(id: number, tag: string, deadline?: number): Promise<void> { await this.#call('POST', '/tags', { name: tag }, deadline); await this.#call('POST', `/tags/${encodeURIComponent(tag)}/resources`, { resources: [{ resource_id: String(id), resource_type: 'image' }] }, deadline); }
  deleteSnapshot(id: number, deadline?: number): Promise<void> { return this.#confirmedDelete(`/snapshots/${id}`, deadline); }
  async #confirmedDelete(path: string, deadline?: number, checkpoint?: () => Promise<void>): Promise<void> {
    let accepted = true;
    try { await this.#call('DELETE', path, undefined, deadline); }
    catch (error) { if (!(error instanceof DigitalOceanError) || error.status !== 404) throw error; accepted = false; }
    if (accepted) await checkpoint?.();
    try { await this.#call('GET', path, undefined, deadline); }
    catch (error) { if (error instanceof DigitalOceanError && error.status === 404) return; throw new DeletionUnconfirmed(path, accepted, error); }
    throw new DeletionUnconfirmed(path, accepted);
  }
}
