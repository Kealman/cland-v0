// The hub's network edge: one HTTP server, WebSocket upgrades gated by the per-project secret,
// one socket per spoke, frames parsed and handed to the core.
import { createServer, type IncomingMessage, type Server as HttpServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Duplex } from 'node:stream';
import { WebSocketServer, WebSocket } from 'ws';
import { HubCore, type Connection, type CoreOptions } from './core.ts';
import { HEARTBEAT_MS, MAX_FRAME_BYTES, isHello, isSpokeRequest, parseFrame, type HubFrame, type Message, type RefusalCode } from '../protocol.ts';

export type HubOptions = CoreOptions & {
  port: number;
  /** The interface to bind; loopback by default, and cland never binds anything else (ADR 0003). */
  host?: string;
  secret: string;
  /** How long a fresh socket may stay silent before its hello, ms. */
  helloTimeoutMs?: number;
  /** How often the retention prune runs, ms (default: daily); it also runs at start. */
  pruneEveryMs?: number;
  /** The spokes' heartbeat interval; a socket silent for two of them is closed (default 30 s). */
  heartbeatMs?: number;
};

export type Hub = {
  url: string;
  port: number;
  core: HubCore;
  /** Run the retention prune now (the daily job's body). */
  prune: () => number;
  close: () => Promise<void>;
};

const bearerMatches = (header: string | undefined, secret: string): boolean => {
  if (!header) return false;
  const [scheme, token] = header.split(' ', 2);
  if (scheme !== 'Bearer' || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
};

const refuseFrame = (code: RefusalCode, message: string): HubFrame => ({ type: 'error', code, message });

export async function createHub(options: HubOptions): Promise<Hub> {
  const core = new HubCore(options);
  const log = options.log ?? (() => {});
  const http: HttpServer = createServer((_req, res) => {
    res.writeHead(404).end();
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_FRAME_BYTES });
  const sockets = new Set<WebSocket>();
  const lastSeen = new Map<WebSocket, number>();
  const heartbeatMs = options.heartbeatMs ?? HEARTBEAT_MS;

  http.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (!bearerMatches(req.headers.authorization, options.secret)) {
      log({ event: 'refused', code: 'unauthorized', from: req.socket.remoteAddress });
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    sockets.add(ws);
    lastSeen.set(ws, Date.now());
    let name: string | null = null;
    let connection: Connection | null = null;
    // Bytes arriving are a live peer: a large frame arriving slowly must not be cut off by the heartbeat sweep.
    req.socket.on('data', () => {
      if (lastSeen.has(ws)) lastSeen.set(ws, Date.now());
    });
    const sendFrame = (frame: HubFrame) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(frame));
    };
    const refuse = (code: RefusalCode, message: string) => {
      sendFrame(refuseFrame(code, message));
      ws.close(4000, code);
    };
    const helloTimer = setTimeout(() => {
      if (name === null) refuse('bad-hello', 'no hello received');
    }, options.helloTimeoutMs ?? 5000);

    ws.on('message', (data) => {
      lastSeen.set(ws, Date.now());
      const frame = parseFrame(data.toString());
      if (!frame) {
        refuse('bad-hello', 'not a frame');
        return;
      }
      if (name === null) {
        if (!isHello(frame)) {
          refuse('bad-hello', 'first frame must be a hello');
          return;
        }
        clearTimeout(helloTimer);
        const deliver = (message: Message) => sendFrame({ type: 'deliver', message });
        const result = core.hello(frame, deliver, (reason, code) => ws.close(code ?? 4001, reason));
        if (!result.ok) {
          log({ event: 'refused', code: result.code, requested: frame.name ?? null });
          refuse(result.code, result.message);
          return;
        }
        name = result.name;
        connection = result.connection;
        sendFrame({ type: 'welcome', name, presence: core.presence(), ...(connection.role !== null ? { role: connection.role } : {}) });
        core.flushQueued(name);
        return;
      }
      if (!isSpokeRequest(frame)) {
        const id = typeof frame.id === 'string' ? frame.id : '?';
        sendFrame({ type: 'result', id, ok: false, error: `unknown request type "${String(frame.type)}"` });
        return;
      }
      try {
        switch (frame.type) {
          case 'who':
            sendFrame({ type: 'result', id: frame.id, ok: true, value: { me: name, sessions: core.presence() } });
            break;
          case 'history':
            sendFrame({ type: 'result', id: frame.id, ok: true, value: { messages: core.history(name, frame.limit, frame.with) } });
            break;
          case 'status':
            core.setStatus(name, frame.text);
            sendFrame({ type: 'result', id: frame.id, ok: true, value: { status: connection?.status ?? null } });
            break;
          case 'rename': {
            const r = core.rename(name, frame.name);
            if (r.ok) {
              name = r.name;
              sendFrame({ type: 'result', id: frame.id, ok: true, value: { name: r.name } });
            } else sendFrame({ type: 'result', id: frame.id, ok: false, error: r.error });
            break;
          }
          case 'ping':
            core.ping(name);
            sendFrame({ type: 'result', id: frame.id, ok: true, value: { pong: true } });
            break;
          case 'send': {
            const { outcomes } = core.sendFromSession(name, frame.to, frame.text, frame.replyTo);
            sendFrame({ type: 'result', id: frame.id, ok: true, value: { outcomes } });
            break;
          }
        }
      } catch (err) {
        sendFrame({ type: 'result', id: frame.id, ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    });

    ws.on('close', () => {
      clearTimeout(helloTimer);
      sockets.delete(ws);
      lastSeen.delete(ws);
      if (connection !== null) core.disconnect(connection);
    });
    ws.on('error', () => {
      /* close follows; nothing to do */
    });
  });

  try {
    await new Promise<void>((resolve, reject) => {
      http.once('error', reject);
      http.listen(options.port, options.host ?? '127.0.0.1', () => resolve());
    });
  } catch (err) {
    // nothing may outlive a hub that never listened
    core.store.close();
    throw err;
  }
  core.prune();
  const pruneTimer = setInterval(() => core.prune(), options.pruneEveryMs ?? 24 * 60 * 60 * 1000);
  pruneTimer.unref();
  // Two missed heartbeats: the socket is dead as far as the hub is concerned — close it, which lets a
  // live spoke reconnect with a fresh hello.
  const heartbeatTimer = setInterval(() => {
    const now = Date.now();
    for (const [ws, seen] of lastSeen) {
      if (now - seen > 2 * heartbeatMs) {
        log({ event: 'heartbeat-timeout', silentMs: now - seen });
        // a close handshake would wait on the very peer that went silent; terminate closes now
        lastSeen.delete(ws);
        ws.terminate();
      }
    }
  }, heartbeatMs);
  heartbeatTimer.unref();

  const address = http.address() as AddressInfo;
  const host = options.host ?? '127.0.0.1';
  const url = `ws://${host.includes(':') ? `[${host}]` : host}:${address.port}`;
  log({ event: 'listening', url });

  return {
    url,
    port: address.port,
    core,
    prune: () => core.prune(),
    close: async () => {
      clearInterval(pruneTimer);
      clearInterval(heartbeatTimer);
      for (const ws of sockets) ws.terminate();
      wss.close();
      await new Promise<void>((resolve) => http.close(() => resolve()));
      core.store.close();
    },
  };
}
