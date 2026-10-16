// A small client for one OpenCode 2.x server (`opencode serve`): its HTTP API under `/api`, HTTP Basic with the
// user `opencode` and the server's password, and its server-sent event stream (`GET /api/event`).
// Only the routes the adapter uses (verified against the OpenAPI document of opencode v2.0.24).

/** A model as OpenCode names it: `{providerID, id}`; cland writes it `<providerID>/<id>`. */
export type ModelRef = { providerID: string; id: string };

/** One entry of `GET /api/model`: only the fields the adapter reads. */
export type ModelEntry = { id: string; providerID: string; status?: string; enabled?: boolean; capabilities?: { tools?: boolean }; cost?: Array<{ input?: number; output?: number }> };

/** One event of the stream: `data: {id, type, created, location?, data}`. */
export type ServerEvent = { id?: string; type: string; created?: number; data?: Record<string, unknown> };

/** Pending permission data shared by the SSE event and permission list. */
export type PermissionRequest = { id: string; action?: unknown; source?: unknown };

const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new DOMException('The operation was aborted due to timeout', 'TimeoutError')), timeoutMs);
    timer.unref();
    try {
      const res = await fetch(`${this.url}${path}`, {
        method,
        headers: { authorization: this.#auth, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });
      const text = await res.text();
      if (!res.ok) throw new HttpError(res.status, `${method} ${path}: ${res.status} ${text.slice(0, 300)}`);
      return (text ? JSON.parse(text) : {}) as T;
    } finally { clearTimeout(timer); }
  }

  /** `GET /api/session/{id}`: the session, or null when the server does not know it. */
  async session(id: string): Promise<{ id: string; title?: string; model?: ModelRef; location?: { directory: string } } | null> {
    try {
      return (await this.request<{ data: { id: string; title?: string; model?: ModelRef; location?: { directory: string } } }>('GET', `/api/session/${encodeURIComponent(id)}`)).data;
    } catch (err) {
      if (err instanceof HttpError && err.status === 404) return null;
      throw err;
    }
  }

  async moveSession(id: string, directory: string): Promise<void> {
    await this.request('POST', `/api/session/${encodeURIComponent(id)}/move`, { directory, delivery: 'queue' });
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

  async roleInstruction(sessionId: string, value: string, timeoutMs: number): Promise<void> {
    await this.request('PUT', `/api/experimental/session/${encodeURIComponent(sessionId)}/instructions/entries/cland-role`, { value }, timeoutMs);
  }

  async clearRoleInstruction(sessionId: string, timeoutMs: number): Promise<void> {
    await this.request('DELETE', `/api/experimental/session/${encodeURIComponent(sessionId)}/instructions/entries/cland-role`, undefined, timeoutMs);
  }

  async models(timeoutMs = 10_000): Promise<ModelEntry[]> {
    return (await this.request<{ data: ModelEntry[] }>('GET', '/api/model', undefined, timeoutMs)).data;
  }

  /** `POST /api/session/{id}/prompt`: the server's reply is the admitted inbox item (`msg_…`). */
  async prompt(sessionId: string, text: string, delivery: 'steer' | 'queue', timeoutMs: number): Promise<{ id: string; delivery?: string }> {
    return (await this.request<{ data: { id: string; delivery?: string } }>('POST', `/api/session/${encodeURIComponent(sessionId)}/prompt`, { text, delivery }, timeoutMs)).data;
  }

  /** What the server says the session is doing now: running, and its pending permission requests and forms. */
  async snapshot(sessionId: string): Promise<{ running: boolean; permissions: PermissionRequest[]; forms: string[] }> {
    const sid = encodeURIComponent(sessionId);
    const [active, permissions, forms] = await Promise.all([
      this.request<{ data: Record<string, unknown> }>('GET', '/api/session/active'),
      this.request<{ data: PermissionRequest[] }>('GET', `/api/session/${sid}/permission`),
      this.request<{ data: Array<{ id: string }> }>('GET', `/api/session/${sid}/form`),
    ]);
    return { running: sessionId in (active.data ?? {}), permissions: permissions.data ?? [], forms: (forms.data ?? []).map((f) => f.id) };
  }

  /** v2 permissions reference an assistant tool part; resources contain parsed fragments, not the full command. */
  async approvalCommand(sessionId: string, permission: PermissionRequest): Promise<string | undefined> {
    const fallback = typeof permission.action === 'string' ? permission.action : undefined;
    const source = record(permission.source);
    if (source.type !== 'tool' || typeof source.messageID !== 'string' || typeof source.id !== 'string') return fallback;
    try {
      const response = await this.request<{ data: unknown }>('GET', `/api/session/${encodeURIComponent(sessionId)}/message/${encodeURIComponent(source.messageID)}`);
      const message = record(response.data);
      if (message.type !== 'assistant' || !Array.isArray(message.content)) return fallback;
      const tool = message.content.map(record).find(part => part.type === 'tool' && part.id === source.id);
      if (!tool || typeof tool.name !== 'string') return fallback;
      const state = record(tool.state);
      const command = record(state.input).command;
      return permission.action === 'shell' && tool.name === 'shell' && state.status !== 'streaming' && typeof command === 'string' ? command : tool.name;
    } catch {
      // Missing source data must not hide the waiting state or leak the HTTP response into events.
      return fallback;
    }
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
        if (!data) continue; // a keepalive comment
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

export const KNOWN_GOOD_FREE_MODELS = ['opencode/big-pickle'];

/**
 * The default model when the launch names none: a free one the server lists — zero input and output price,
 * tool calls supported (the spoke's `send` is a tool), active. Prefer the known-good `opencode/big-pickle`,
 * then OpenCode Zen's own (`opencode/…`): they need no key. Null when none: the server's default applies.
 */
export function pickFreeModel(models: ModelEntry[]): ModelRef | null {
  const free = models.filter(
    (m) => m.enabled !== false && (m.status === undefined || m.status === 'active') && m.capabilities?.tools !== false && Array.isArray(m.cost) && m.cost.length > 0 && m.cost.every((c) => c.input === 0 && c.output === 0),
  );
  const preferred = KNOWN_GOOD_FREE_MODELS.map((id) => free.find((m) => formatModel(m) === id)).find(Boolean);
  const pick = preferred ?? free.find((m) => m.providerID === 'opencode') ?? free[0];
  return pick ? { providerID: pick.providerID, id: pick.id } : null;
}
