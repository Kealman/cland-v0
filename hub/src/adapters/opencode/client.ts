// A small client for one OpenCode 2.x server (`opencode serve`): its HTTP API under `/api`, HTTP Basic with the
// user `opencode` and the server's password, and its server-sent event stream (`GET /api/event`).
// Only the routes the adapter uses (verified against the OpenAPI document of opencode v2.0.24).

/** A model as OpenCode names it: `{providerID, id}`; cland writes it `<providerID>/<id>`. */
export type ModelRef = { providerID: string; id: string };

/** One entry of `GET /api/model`: only the fields the adapter reads. */
export type ModelEntry = { id: string; providerID: string; status?: string; enabled?: boolean; capabilities?: { tools?: boolean }; cost?: Array<{ input?: number; output?: number }> };

/** One event of the stream: `data: {id, type, created, location?, data}`. */
export type ServerEvent = { id?: string; type: string; created?: number; data?: Record<string, unknown> };

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export class OpenCodeClient {
  readonly url: string;
  readonly #auth: string;

  constructor(url: string, password: string) {
    this.url = url.replace(/\/+$/, '');
    this.#auth = `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}`;
  }

  async request<T>(method: string, path: string, body?: unknown, timeoutMs = 10_000): Promise<T> {
    const res = await fetch(`${this.url}${path}`, {
      method,
      headers: { authorization: this.#auth, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    if (!res.ok) throw new HttpError(res.status, `${method} ${path}: ${res.status} ${text.slice(0, 300)}`);
    return (text ? JSON.parse(text) : {}) as T;
  }

  /** `GET /api/session/{id}`: the session, or null when the server does not know it. */
  async session(id: string): Promise<{ id: string; title?: string; model?: ModelRef } | null> {
    try {
      return (await this.request<{ data: { id: string; title?: string; model?: ModelRef } }>('GET', `/api/session/${encodeURIComponent(id)}`)).data;
    } catch (err) {
      if (err instanceof HttpError && err.status === 404) return null;
      throw err;
    }
  }

  async createSession(body: { id?: string; title: string; model: ModelRef | null; directory: string }): Promise<{ id: string; model?: ModelRef }> {
    const r = await this.request<{ data: { id: string; model?: ModelRef } }>('POST', '/api/session', {
      ...(body.id ? { id: body.id } : {}),
      title: body.title,
      ...(body.model ? { model: body.model } : {}),
      location: { directory: body.directory },
    });
    return r.data;
  }

  async models(): Promise<ModelEntry[]> {
    return (await this.request<{ data: ModelEntry[] }>('GET', '/api/model')).data;
  }

  /** `POST /api/session/{id}/prompt`: the server's reply is the admitted inbox item (`msg_…`). */
  async prompt(sessionId: string, text: string, delivery: 'steer' | 'queue', timeoutMs: number): Promise<{ id: string; delivery?: string }> {
    return (await this.request<{ data: { id: string; delivery?: string } }>('POST', `/api/session/${encodeURIComponent(sessionId)}/prompt`, { text, delivery }, timeoutMs)).data;
  }

  /** What the server says the session is doing now: running, and its pending permission requests and forms. */
  async snapshot(sessionId: string): Promise<{ running: boolean; permissions: string[]; forms: string[] }> {
    const sid = encodeURIComponent(sessionId);
    const [active, permissions, forms] = await Promise.all([
      this.request<{ data: Record<string, unknown> }>('GET', '/api/session/active'),
      this.request<{ data: Array<{ id: string }> }>('GET', `/api/session/${sid}/permission`),
      this.request<{ data: Array<{ id: string }> }>('GET', `/api/session/${sid}/form`),
    ]);
    return { running: sessionId in (active.data ?? {}), permissions: (permissions.data ?? []).map((p) => p.id), forms: (forms.data ?? []).map((f) => f.id) };
  }

  /**
   * Subscribe to the event stream. `onOpen` runs once the server accepted the subscription (so a snapshot taken
   * then misses nothing); the promise settles when the stream ends, or rejects when it could not be opened.
   * The stream is live-only: what happens while it is down is not replayed.
   */
  async events(onEvent: (e: ServerEvent) => void, onOpen: () => void, signal: AbortSignal): Promise<void> {
    const res = await fetch(`${this.url}/api/event`, { headers: { authorization: this.#auth, accept: 'text/event-stream' }, signal });
    if (!res.ok || !res.body) throw new HttpError(res.status, `GET /api/event: ${res.status}`);
    onOpen();
    const decoder = new TextDecoder();
    let buffer = '';
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      buffer += decoder.decode(chunk, { stream: true });
      let end: number;
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const data = block
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).replace(/^ /, ''))
          .join('\n');
        if (!data) continue; // a heartbeat comment
        try {
          const parsed = JSON.parse(data) as ServerEvent;
          if (typeof parsed.type === 'string') onEvent(parsed);
        } catch {
          /* not an event */
        }
      }
    }
  }
}

/** `<providerID>/<id>` (the provider is everything before the first `/`; a bare id is OpenCode Zen's). */
export function parseModel(model: string): ModelRef {
  const slash = model.indexOf('/');
  return slash > 0 ? { providerID: model.slice(0, slash), id: model.slice(slash + 1) } : { providerID: 'opencode', id: model };
}

export const formatModel = (m: ModelRef): string => `${m.providerID}/${m.id}`;

/**
 * The default model when the launch names none: a free one the server lists — zero input and output price,
 * tool calls supported (the spoke's `send` is a tool), active. Prefer the known-good `opencode/big-pickle`,
 * then OpenCode Zen's own (`opencode/…`): they need no key. Null when none: the server's default applies.
 */
export function pickFreeModel(models: ModelEntry[]): ModelRef | null {
  const free = models.filter(
    (m) => m.enabled !== false && (m.status === undefined || m.status === 'active') && m.capabilities?.tools !== false && Array.isArray(m.cost) && m.cost.length > 0 && m.cost.every((c) => c.input === 0 && c.output === 0),
  );
  const pick = free.find((m) => m.providerID === 'opencode' && m.id === 'big-pickle') ?? free.find((m) => m.providerID === 'opencode') ?? free[0];
  return pick ? { providerID: pick.providerID, id: pick.id } : null;
}
