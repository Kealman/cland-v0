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
  constructor(status: number, id: string, message: string) { super(`DigitalOcean ${status} ${id}: ${message}`); this.status = status; this.id = id; }
}

export type ProviderCall = (method: string, path: string, body: unknown, deadline?: number) => Promise<unknown>;

/** Only this call scope holds the token. Transport failures never expose fetch's request. */
export class DigitalOceanApi {
  readonly #env: NodeJS.ProcessEnv;
  readonly #clock: Clock;
  readonly #callProvider: ProviderCall | undefined;
  readonly #signal: AbortSignal | undefined;
  constructor(env: NodeJS.ProcessEnv = process.env, clock: Clock = realClock, callProvider?: ProviderCall, signal?: AbortSignal) { this.#callProvider = callProvider; this.#clock = clock; this.#env = env; this.#signal = signal; }
  async #call<T>(method: string, path: string, body?: unknown, deadline?: number): Promise<T> {
    const token = this.#env.DIGITALOCEAN_TOKEN;
    if (!token) throw new Error('DIGITALOCEAN_TOKEN is required');
    if (this.#callProvider) return await this.#callProvider(method, path, body, deadline) as T;
    const base = this.#env.CLAND_DIGITALOCEAN_API ?? 'https://api.digitalocean.com/v2';
    const url = new URL(`${base.replace(/\/$/, '')}${path}`);
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
      if (response.status === 204) return undefined as T;
      let value: Record<string, unknown>;
      try { value = await response.json() as Record<string, unknown>; }
      catch (error) {
        if (signal.aborted) throw error;
        throw new DigitalOceanError(response.status, 'response', 'invalid JSON response');
      }
      if (!response.ok) throw new DigitalOceanError(response.status, redact(value.id), redact(value.message));
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
  async account(deadline?: number): Promise<unknown> { return (await this.#call<{ account: unknown }>('GET', '/account', undefined, deadline)).account; }
  sizes(deadline?: number): Promise<Size[]> { return this.#list('/sizes', 'sizes', deadline); }
  regions(deadline?: number): Promise<Region[]> { return this.#list('/regions', 'regions', deadline); }
  droplets(tag: string, deadline?: number): Promise<Droplet[]> { return this.#list(`/droplets?tag_name=${encodeURIComponent(tag)}`, 'droplets', deadline); }
  keys(deadline?: number): Promise<Key[]> { return this.#list('/account/keys', 'ssh_keys', deadline); }
  async create(input: CreateDroplet, deadline?: number): Promise<Droplet> { return (await this.#call<{ droplet: Droplet }>('POST', '/droplets', input, deadline)).droplet; }
  async droplet(id: number, deadline?: number): Promise<Droplet> { return (await this.#call<{ droplet: Droplet }>('GET', `/droplets/${id}`, undefined, deadline)).droplet; }
  async importKey(name: string, publicKey: string, deadline?: number): Promise<Key> { return (await this.#call<{ ssh_key: Key }>('POST', '/account/keys', { name, public_key: publicKey }, deadline)).ssh_key; }
  async deleteDroplet(id: number, deadline?: number): Promise<void> { await this.#delete(`/droplets/${id}`, deadline); }
  async deleteKey(id: number, deadline?: number): Promise<void> { await this.#delete(`/account/keys/${id}`, deadline); }
  async dropletAction(id: number, type: 'power_off' | 'snapshot', name?: string, deadline?: number): Promise<Action> { return (await this.#call<{ action: Action }>('POST', `/droplets/${id}/actions`, { type, ...(name ? { name } : {}) }, deadline)).action; }
  async action(id: number, deadline?: number): Promise<Action> { return (await this.#call<{ action: Action }>('GET', `/actions/${id}`, undefined, deadline)).action; }
  actions(deadline?: number): Promise<Action[]> { return this.#list('/actions', 'actions', deadline); }
  async snapshots(deadline?: number): Promise<SnapshotImage[]> {
    // The snapshots endpoint represents ids as strings; create and image actions use numbers.
    return (await this.#list<SnapshotImage>('/snapshots?resource_type=droplet', 'snapshots', deadline)).map(image => ({ ...image, id: Number(image.id) }));
  }
  async transferImage(id: number, region: string, deadline?: number): Promise<Action> { return (await this.#call<{ action: Action }>('POST', `/images/${id}/actions`, { type: 'transfer', region }, deadline)).action; }
  async tagImage(id: number, tag: string, deadline?: number): Promise<void> { await this.#call('POST', '/tags', { name: tag }, deadline); await this.#call('POST', `/tags/${encodeURIComponent(tag)}/resources`, { resources: [{ resource_id: String(id), resource_type: 'image' }] }, deadline); }
  deleteSnapshot(id: number, deadline?: number): Promise<void> { return this.#delete(`/snapshots/${id}`, deadline); }
  async #delete(path: string, deadline?: number): Promise<void> { try { await this.#call('DELETE', path, undefined, deadline); } catch (err) { if (!(err instanceof DigitalOceanError) || err.status !== 404) throw err; } }
}
