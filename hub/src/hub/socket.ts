// The hub's Unix socket edge, for the UI and the CLI: JSON-lines frames, the secret in the hello (ADR 0003).
import { timingSafeEqual } from 'node:crypto';
import { chmodSync, rmSync } from 'node:fs';
import { createServer, type Socket } from 'node:net';
import type { HubCore } from './core.ts';
import { MAX_FRAME_BYTES, PROTOCOL_VERSION, UPDATE_HINT, isClientHello, isClientRequest, parseFrame, type HubFrame, type HubStatus, type RefusalCode } from '../protocol.ts';
import type { LogFn } from '../log.ts';

export type SocketEdgeOptions = {
  path: string;
  secret: string;
  core: HubCore;
  /** The hub's own facts for `hub.status`, minus the sessions. */
  status: () => Omit<HubStatus, 'sessions'>;
  /** A client asked the hub to stop; called after the result is written. */
  onStop: () => void;
  helloTimeoutMs?: number;
  log?: LogFn;
};

export type SocketEdge = { close: () => Promise<void> };

const secretMatches = (given: string, secret: string): boolean => {
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
};

/** Bind the socket at `path`, replacing a stale file there: the caller has made sure no live hub owns it. */
export async function createSocketEdge(options: SocketEdgeOptions): Promise<SocketEdge> {
  const log = options.log ?? (() => {});
  const clients = new Set<Socket>();

  const server = createServer((socket) => {
    clients.add(socket);
    socket.setEncoding('utf8');
    let welcomed = false;
    let buffer = '';
    const send = (frame: HubFrame) => {
      if (!socket.destroyed) socket.write(`${JSON.stringify(frame)}\n`);
    };
    const refuse = (code: RefusalCode, message: string) => {
      log({ event: 'refused', edge: 'socket', code });
      send({ type: 'error', code, message });
      socket.end();
    };
    const helloTimer = setTimeout(() => {
      if (!welcomed) refuse('bad-hello', 'no hello received');
    }, options.helloTimeoutMs ?? 5000);

    const onLine = (line: string) => {
      const frame = parseFrame(line);
      if (!frame) return refuse('bad-hello', 'not a frame');
      if (!welcomed) {
        clearTimeout(helloTimer);
        if (!isClientHello(frame)) return refuse('bad-hello', 'first frame must be a hello with the secret');
        if (!secretMatches(frame.secret, options.secret)) return refuse('unauthorized', "the secret does not match this project's hub");
        if (frame.protocol !== PROTOCOL_VERSION) return refuse('version', `protocol ${frame.protocol} is not the hub's ${PROTOCOL_VERSION} — ${UPDATE_HINT}`);
        welcomed = true;
        log({ event: 'client', client: frame.client });
        send({ type: 'welcome', name: frame.client, presence: options.core.presence() });
        return;
      }
      if (!isClientRequest(frame)) {
        const id = typeof frame.id === 'string' ? frame.id : '?';
        send({ type: 'result', id, ok: false, error: `unknown request type "${String(frame.type)}"` });
        return;
      }
      switch (frame.type) {
        case 'hub.status':
          send({ type: 'result', id: frame.id, ok: true, value: { ...options.status(), sessions: options.core.presence() } satisfies HubStatus });
          break;
        case 'hub.stop':
          log({ event: 'stop-requested', edge: 'socket' });
          send({ type: 'result', id: frame.id, ok: true, value: { stopping: true } });
          options.onStop();
          break;
      }
    };

    socket.on('data', (chunk: string) => {
      buffer += chunk;
      if (Buffer.byteLength(buffer) > MAX_FRAME_BYTES) {
        refuse('bad-hello', `frame over ${MAX_FRAME_BYTES} bytes`);
        socket.destroy();
        return;
      }
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0 && !socket.destroyed) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (line) onLine(line);
      }
    });
    socket.on('close', () => {
      clearTimeout(helloTimer);
      clients.delete(socket);
    });
    socket.on('error', () => {
      /* close follows */
    });
  });

  rmSync(options.path, { force: true });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.path, () => resolve());
  });
  // only this user may even try the secret
  chmodSync(options.path, 0o600);
  log({ event: 'listening', socket: options.path });

  return {
    close: async () => {
      for (const c of clients) c.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      rmSync(options.path, { force: true });
    },
  };
}
