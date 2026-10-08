// A client of Codex's app-server on its Unix socket (`codex app-server --listen unix://PATH`): JSON-RPC 2.0 messages
// (without the `jsonrpc` field, as Codex sends them) over a WebSocket on the socket. Research `harness-surfaces` §2.2:
// plain JSON lines on the socket get no answer; the socket speaks WebSocket.
//
// A request that got no answer is ambiguous (the server may have accepted it): callers never replay a turn on
// their own after a timeout or a disconnect.
import { EventEmitter } from 'node:events';
import WebSocket from 'ws';

export class RpcError extends Error {
  readonly code: number;
  readonly data: unknown;
  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = 'RpcError';
    this.code = code;
    this.data = data;
  }
}

/** A request that went out and got no answer: by its deadline, or before the connection closed. The server may have
 *  acted on it. Never a request that could not be sent. */
export class RpcNoAnswer extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RpcNoAnswer';
  }
}

/** A request the server sent to its clients (an approval, a question): the adapter never answers one. */
export type ServerRequest = { id: string | number; method: string; params: Record<string, unknown> };

type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: NodeJS.Timeout };

export type ClientInfo = { name: string; title?: string; version: string };

/**
 * One connection. Events: `notification` (method, params), `serverRequest` (ServerRequest), `close`.
 */
export class AppServerClient extends EventEmitter {
  readonly #socket: WebSocket;
  readonly #pending = new Map<number, Pending>();
  readonly #timeoutMs: number;
  #nextId = 0;
  #closed = false;

  private constructor(socket: WebSocket, timeoutMs: number) {
    super();
    this.#socket = socket;
    this.#timeoutMs = timeoutMs;
    socket.on('message', (data) => {
      let frame: unknown;
      try {
        frame = JSON.parse(String(data));
      } catch {
        this.#fail(new Error('the app-server sent a frame that is not JSON'));
        socket.close(1002);
        return;
      }
      this.#receive(frame);
    });
    socket.on('error', (err) => this.#fail(err));
    socket.on('close', () => {
      this.#closed = true;
      this.#fail(new RpcNoAnswer('the app-server connection closed; a pending request may have been accepted'));
      this.emit('close');
    });
  }

  get closed(): boolean {
    return this.#closed;
  }

  /** Connect to the socket and initialize. Rejects when nothing listens there. */
  static async connect(socketPath: string, options: { client: ClientInfo; timeoutMs?: number; connectTimeoutMs?: number }): Promise<AppServerClient> {
    const timeoutMs = options.timeoutMs ?? 30_000;
    // Codex closes Unix-socket upgrades that advertise permessage-deflate (seen by BCAS with 0.153.4)
    const socket = new WebSocket(`ws+unix://${socketPath}:/`, { perMessageDeflate: false, handshakeTimeout: options.connectTimeoutMs ?? 5000 });
    const client = new AppServerClient(socket, timeoutMs);
    try {
      await new Promise<void>((resolve, reject) => {
        const opened = () => {
          socket.off('error', failed);
          socket.off('close', ended);
          resolve();
        };
        const failed = (err: Error) => {
          socket.off('open', opened);
          socket.off('close', ended);
          reject(err);
        };
        const ended = () => failed(new Error('the app-server closed the connection before it opened'));
        socket.once('open', opened);
        socket.once('error', failed);
        socket.once('close', ended);
      });
      await client.request('initialize', { clientInfo: options.client, capabilities: { experimentalApi: true } });
      socket.send(JSON.stringify({ method: 'initialized' }));
      return client;
    } catch (err) {
      client.close();
      throw err;
    }
  }

  request<T = unknown>(method: string, params: Record<string, unknown>, timeoutMs = this.#timeoutMs): Promise<T> {
    if (this.#closed || this.#socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error('the app-server is not connected'));
    const id = ++this.#nextId;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new RpcNoAnswer(`the app-server did not answer ${method} within ${timeoutMs} ms; it may have accepted it`));
      }, timeoutMs);
      this.#pending.set(id, { resolve: (value) => resolve(value as T), reject, timer });
      this.#socket.send(JSON.stringify({ id, method, params }), (err) => {
        if (err) this.#reject(id, err);
      });
    });
  }

  close(): void {
    this.#closed = true;
    this.#fail(new RpcNoAnswer('the app-server client closed; a pending request may have been accepted'));
    if (this.#socket.readyState === WebSocket.CONNECTING) this.#socket.terminate();
    else this.#socket.close();
  }

  #receive(frame: unknown): void {
    if (frame === null || typeof frame !== 'object') return;
    const message = frame as Record<string, unknown>;
    if (typeof message.method === 'string') {
      const params = (message.params ?? {}) as Record<string, unknown>;
      if (typeof message.id === 'string' || typeof message.id === 'number') this.emit('serverRequest', { id: message.id, method: message.method, params } satisfies ServerRequest);
      else this.emit('notification', message.method, params);
      return;
    }
    if (typeof message.id !== 'number') return;
    const pending = this.#pending.get(message.id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.#pending.delete(message.id);
    if (message.error && typeof message.error === 'object') {
      const e = message.error as { code: number; message: string; data?: unknown };
      pending.reject(new RpcError(e.code, e.message, e.data));
    } else pending.resolve(message.result);
  }

  #reject(id: number, err: Error): void {
    const pending = this.#pending.get(id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.#pending.delete(id);
    pending.reject(err);
  }

  #fail(err: Error): void {
    for (const id of [...this.#pending.keys()]) this.#reject(id, err);
  }
}
