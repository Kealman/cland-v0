// The hub's frame dispatcher: one conversation per connection, transport-agnostic. A transport hands it
// raw frames and a peer to answer through (send a frame, close); the WebSocket edge, the Unix socket edge
// and, later, stdio (#23) share it, so the protocol lives in one place.
//
// A conversation is a spoke (its hello carries a session id) or a client — the UI, the CLI — (its hello
// names the client). A transport that authenticated the peer already (the WebSocket's bearer header) says
// so; otherwise the hello must carry the project's secret.
import { timingSafeEqual } from 'node:crypto';
import type { Connection, HubCore } from './core.ts';
import {
  PROTOCOL_VERSION,
  UPDATE_HINT,
  isAck,
  isClientHello,
  isClientRequest,
  isHello,
  isSpokeRequest,
  parseFrame,
  type HubFrame,
  type HubStatus,
  type Message,
  type RefusalCode,
} from '../protocol.ts';
import type { LogFn } from '../log.ts';
import { actorOf, answerTask, isTaskRequest } from '../tracker/requests.ts';
import type { Tracker } from '../tracker/tracker.ts';

/** How a conversation answers: a frame to the peer, or the end of the connection. */
export type Peer = {
  send: (frame: HubFrame) => void;
  /** End the connection. `code` is a WebSocket close code; a transport without codes ignores it. */
  close: (code: number, reason: string) => void;
  /** Whether frames from the peer still count: false once the connection is closing. */
  isOpen: () => boolean;
};

/** What only the process running the hub can answer: its facts, and stopping it. */
export type Control = {
  status: () => Omit<HubStatus, 'sessions'>;
  stop: () => void;
};

export type Conversation = {
  /** One frame as it arrived on the wire. */
  receive: (raw: string) => void;
  /** The transport closed. */
  closed: () => void;
};

export type DispatcherOptions = {
  core: HubCore;
  secret: string;
  control?: Control;
  /** How long a fresh connection may stay silent before its hello, ms. */
  helloTimeoutMs?: number;
  log?: LogFn;
  /** The project's tracker, answering the `task.*` requests; absent on a hub with no project. */
  tracker?: Tracker;
};

export const secretMatches = (given: string, secret: string): boolean => {
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
};

export class Dispatcher {
  readonly #options: DispatcherOptions;
  readonly #log: LogFn;

  constructor(options: DispatcherOptions) {
    this.#options = options;
    this.#log = options.log ?? (() => {});
  }

  get core(): HubCore {
    return this.#options.core;
  }

  open(peer: Peer, transport: { authenticated: boolean; edge: string }): Conversation {
    const core = this.#options.core;
    const log = this.#log;
    let kind: 'spoke' | 'client' | null = null;
    let done = false;
    let name: string | null = null;
    let connection: Connection | null = null;

    const refuse = (code: RefusalCode, message: string) => {
      if (done) return;
      done = true;
      clearTimeout(helloTimer);
      peer.send({ type: 'error', code, message });
      peer.close(4000, code);
    };
    const helloTimer = setTimeout(() => {
      if (kind === null) refuse('bad-hello', 'no hello received');
    }, this.#options.helloTimeoutMs ?? 5000);

    const hello = (frame: Record<string, unknown>) => {
      clearTimeout(helloTimer);
      if (!transport.authenticated && !(typeof frame.secret === 'string' && secretMatches(frame.secret, this.#options.secret))) {
        log({ event: 'refused', edge: transport.edge, code: 'unauthorized' });
        return refuse('unauthorized', "the secret does not match this project's hub");
      }
      if (isHello(frame)) {
        const deliver = (message: Message): boolean => {
          if (!peer.isOpen()) return false;
          peer.send({ type: 'deliver', id: message.id, message });
          return true;
        };
        const result = core.hello(frame, deliver, (reason, code) => peer.close(code ?? 4001, reason));
        if (!result.ok) {
          log({ event: 'refused', edge: transport.edge, code: result.code, requested: frame.name ?? null });
          return refuse(result.code, result.message);
        }
        kind = 'spoke';
        name = result.name;
        connection = result.connection;
        peer.send({ type: 'welcome', name, presence: core.presence(), ...(connection.role !== null ? { role: connection.role } : {}) });
        core.flushQueued(name);
        return;
      }
      if (isClientHello(frame)) {
        if (frame.protocol !== PROTOCOL_VERSION) return refuse('version', `protocol ${frame.protocol} is not the hub's ${PROTOCOL_VERSION} — ${UPDATE_HINT}`);
        kind = 'client';
        log({ event: 'client', edge: transport.edge, client: frame.client });
        peer.send({ type: 'welcome', name: frame.client, presence: core.presence() });
        return;
      }
      refuse('bad-hello', 'first frame must be a hello');
    };

    const spokeRequest = (frame: Record<string, unknown>, me: string) => {
      if (!isSpokeRequest(frame)) {
        const id = typeof frame.id === 'string' ? frame.id : '?';
        peer.send({ type: 'result', id, ok: false, error: `unknown request type "${String(frame.type)}"` });
        return;
      }
      try {
        switch (frame.type) {
          case 'who':
            peer.send({ type: 'result', id: frame.id, ok: true, value: { me, sessions: core.presence() } });
            break;
          case 'history':
            peer.send({ type: 'result', id: frame.id, ok: true, value: { messages: core.history(me, frame.limit, frame.with) } });
            break;
          case 'status':
            core.setStatus(me, frame.text);
            peer.send({ type: 'result', id: frame.id, ok: true, value: { status: connection?.status ?? null } });
            break;
          case 'rename': {
            const r = core.rename(me, frame.name);
            if (r.ok) {
              name = r.name;
              peer.send({ type: 'result', id: frame.id, ok: true, value: { name: r.name } });
            } else peer.send({ type: 'result', id: frame.id, ok: false, error: r.error });
            break;
          }
          case 'ping':
            core.ping(me);
            peer.send({ type: 'result', id: frame.id, ok: true, value: { pong: true } });
            break;
          case 'send': {
            const { outcomes } = core.sendFromSession(me, frame.to, frame.text, frame.replyTo);
            peer.send({ type: 'result', id: frame.id, ok: true, value: { outcomes } });
            break;
          }
        }
      } catch (err) {
        peer.send({ type: 'result', id: frame.id, ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    };

    const clientRequest = (frame: Record<string, unknown>) => {
      if (!isClientRequest(frame)) {
        const id = typeof frame.id === 'string' ? frame.id : '?';
        peer.send({ type: 'result', id, ok: false, error: `unknown request type "${String(frame.type)}"` });
        return;
      }
      const control = this.#options.control;
      if (!control) {
        peer.send({ type: 'result', id: frame.id, ok: false, error: 'this hub is not serving a project: no status or stop here' });
        return;
      }
      switch (frame.type) {
        case 'hub.status':
          peer.send({ type: 'result', id: frame.id, ok: true, value: { ...control.status(), sessions: core.presence() } satisfies HubStatus });
          break;
        case 'hub.stop':
          log({ event: 'stop-requested', edge: transport.edge });
          peer.send({ type: 'result', id: frame.id, ok: true, value: { stopping: true } });
          control.stop();
          break;
      }
    };

    return {
      receive: (raw) => {
        if (done) return;
        const frame = parseFrame(raw);
        if (!frame) return refuse('bad-hello', 'not a frame');
        if (kind === null) return hello(frame);
        if (kind === 'spoke') {
          // A replaced or closing socket's buffered frames would act under a name it no longer holds.
          if (!peer.isOpen() || connection === null || !core.isCurrent(connection)) {
            log({ event: 'stale-frame', edge: transport.edge, name, type: frame.type });
            return;
          }
          if (isAck(frame)) return core.ack(connection, frame.id);
          // a spoke always acts as its own session
          if (isTaskRequest(frame)) return peer.send(answerTask(this.#options.tracker, frame, { name: connection.name, role: connection.role }));
          return spokeRequest(frame, name as string);
        }
        // a client's frame may name who it acts as
        if (isTaskRequest(frame)) return peer.send(answerTask(this.#options.tracker, frame, actorOf(frame, 'human')));
        clientRequest(frame);
      },
      closed: () => {
        done = true;
        clearTimeout(helloTimer);
        if (connection !== null) core.disconnect(connection);
      },
    };
  }
}
