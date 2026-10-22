// A small client for one OpenCode 2.x server (`opencode serve`): its HTTP API under `/api`, HTTP Basic with the
// user `opencode` and the server's password, and its server-sent event stream (`GET /api/event`).
// Only the routes the adapter uses (verified against the OpenAPI document of opencode v2.0.24).
import { randomUUID } from 'node:crypto';

/** OpenCode's model reference; cland writes `<providerID>/<id>#<variant>` when a variant is selected. */
export type ModelRef = { providerID: string; id: string; variant?: string };

/** One entry of `GET /api/model`: only the fields the adapter reads. */
export type ModelEntry = { id: string; providerID: string; variants?: Array<{ id: string }>; status?: string; enabled?: boolean; capabilities?: { tools?: boolean }; cost?: Array<{ input?: number; output?: number }> };

/** One event of the stream: `data: {id, type, created, location?, data}`. */
export type ServerEvent = { id?: string; type: string; created?: number; data?: Record<string, unknown> };

/** Pending permission data shared by the SSE event and permission list. */
export type PermissionRequest = { id: string; action?: unknown; source?: unknown; resources?: unknown };
export type PermissionRule = { action: string; resource: string; effect: 'allow' | 'deny' | 'ask' };

const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** With no native identity, retain only a TUI waiting episode; it can never address a reply endpoint. */
export function permissionRequest(value: unknown): PermissionRequest {
  const p = record(value);
  return typeof p.id === 'string' && p.id ? { id: p.id, action: p.action, resources: p.resources, source: p.source } : { id: `unrecognized:${randomUUID()}` };
}

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
  async session(id: string): Promise<{ id: string; title?: string; model?: ModelRef; permissions?: PermissionRule[]; location?: { directory: string } } | null> {
    try {
      return (await this.request<{ data: { id: string; title?: string; model?: ModelRef; permissions?: PermissionRule[]; location?: { directory: string } } }>('GET', `/api/session/${encodeURIComponent(id)}`)).data;
    } catch (err) {
      if (err instanceof HttpError && err.status === 404) return null;
      throw err;
    }
  }

  async moveSession(id: string, directory: string): Promise<void> {
    await this.request('POST', `/api/session/${encodeURIComponent(id)}/move`, { directory, delivery: 'queue' });
  }

  async createSession(body: { id?: string; title: string; model: ModelRef | null; directory: string; permissions?: PermissionRule[] }): Promise<{ id: string; model?: ModelRef }> {
    const r = await this.request<{ data: { id: string; model?: ModelRef } }>('POST', '/api/session', {
      ...(body.id ? { id: body.id } : {}),
      title: body.title,
      ...(body.model ? { model: body.model } : {}),
      location: { directory: body.directory },
      ...(body.permissions?.length ? { permissions: body.permissions } : {}),
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
  async prompt(sessionId: string, text: string, delivery: 'steer' | 'queue', timeoutMs: number, id?: string): Promise<{ id: string; delivery?: string }> {
    return (await this.request<{ data: { id: string; delivery?: string } }>('POST', `/api/session/${encodeURIComponent(sessionId)}/prompt`, { ...(id ? { id } : {}), text, delivery }, timeoutMs)).data;
  }

  /** What the server says the session is doing now: running, and its pending permission requests and forms. */
  async snapshot(sessionId: string): Promise<{ running: boolean; permissions: PermissionRequest[]; forms: string[] }> {
    const sid = encodeURIComponent(sessionId);
    const [active, permissions, forms] = await Promise.all([
      this.request<{ data: Record<string, unknown> }>('GET', '/api/session/active'),
      this.request<{ data: PermissionRequest[] }>('GET', `/api/session/${sid}/permission`),
      this.request<{ data: Array<{ id: string }> }>('GET', `/api/session/${sid}/form`),
    ]);
    return { running: Object.hasOwn(active.data ?? {}, sessionId), permissions: (Array.isArray(permissions.data) ? permissions.data : [null]).map(permissionRequest), forms: (forms.data ?? []).map((f) => f.id) };
  }

  /** One allowlisted description for both the waiting state and the approval record. */
  async approvalDetails(sessionId: string, permission: PermissionRequest): Promise<{ command: string | undefined; subject: import('../../protocol.ts').ApprovalSubject | null }> {
    const action = typeof permission.action === 'string' ? permission.action : undefined;
    const resources = permission.resources;
    const valid = !!permission.id && !!action && Array.isArray(resources) && resources.every(r => typeof r === 'string');
    let command = action;
    let shell = false;
    const source = record(permission.source);
    if (source.type === 'tool' && typeof source.messageID === 'string' && source.messageID && typeof source.id === 'string' && source.id) {
      try {
        const response = await this.request<{ data: unknown }>('GET', `/api/session/${encodeURIComponent(sessionId)}/message/${encodeURIComponent(source.messageID)}`);
        const message = record(response.data);
        if (message.type === 'assistant' && Array.isArray(message.content)) {
          const tool = message.content.map(record).find(part => part.type === 'tool' && part.id === source.id);
          const state = record(tool?.state);
          const input = record(state.input);
          shell = action === 'shell' && tool?.name === 'shell' && typeof state.status === 'string' && state.status !== 'streaming' && typeof input.command === 'string';
          if (shell) command = input.command as string;
          else if (typeof tool?.name === 'string') command = tool.name;
        }
      } catch {
        // Neither native error bodies nor other tool input may leave this boundary.
      }
    }
    const subject = !valid || action === 'shell' && !shell ? null : action === 'shell' ? { command: command! } : { command: action!, files: resources as string[] };
    // The hub caps serialized subjects at 64 KiB. A truncated description cannot authorize the original action.
    return { command, subject: subject && Buffer.byteLength(JSON.stringify(subject)) <= 64 * 1024 ? subject : null };
  }

  /** Rejection reports use the same safe description, even for TUI-only permissions. */
  async approvalCommand(sessionId: string, permission: PermissionRequest): Promise<string | undefined> {
    return (await this.approvalDetails(sessionId, permission)).command;
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
  const hash = model.lastIndexOf('#');
  const variant = hash >= 0 ? model.slice(hash + 1) : undefined;
  if (hash >= 0) model = model.slice(0, hash);
  const slash = model.indexOf('/');
  return { ...(slash > 0 ? { providerID: model.slice(0, slash), id: model.slice(slash + 1) } : { providerID: 'opencode', id: model }), ...(variant ? { variant } : {}) };
}

export const formatModel = (m: ModelRef): string => `${m.providerID}/${m.id}${m.variant ? `#${m.variant}` : ''}`;

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
