// The hub's network edge: one HTTP server, WebSocket upgrades gated by the per-project secret,
// one socket per spoke, every frame handed to the shared dispatcher (`./dispatch.ts`).
import { createServer, type IncomingMessage, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Duplex } from 'node:stream';
import { WebSocketServer, WebSocket } from 'ws';
import { HubCore, type CoreOptions } from './core.ts';
import { Dispatcher, secretMatches, type Control } from './dispatch.ts';
import type { Tracker } from '../tracker/tracker.ts';
import { HEARTBEAT_MS, MAX_FRAME_BYTES } from '../protocol.ts';

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
  /** `hub.status` and `hub.stop` for clients; absent, clients are told this hub serves no project. */
  control?: Control;
  /** The project's tracker, answering the `task.*` requests; absent on a hub with no project. */
  tracker?: Tracker;
};

export type Hub = {
  url: string;
  port: number;
  core: HubCore;
  /** The frame dispatcher every transport shares; another edge (the Unix socket, stdio) opens conversations on it. */
  dispatcher: Dispatcher;
  /** Run the retention prune now (the daily job's body). */
  prune: () => number;
  close: () => Promise<void>;
};

const bearerMatches = (header: string | undefined, secret: string): boolean => {
  if (!header) return false;
  const [scheme, token] = header.split(' ', 2);
  if (scheme !== 'Bearer' || !token) return false;
  return secretMatches(token, secret);
};

export async function createHub(options: HubOptions): Promise<Hub> {
  const core = new HubCore(options);
  const log = options.log ?? (() => {});
  const dispatcher = new Dispatcher({
    core,
    secret: options.secret,
    log,
    ...(options.control ? { control: options.control } : {}),
    ...(options.tracker ? { tracker: options.tracker } : {}),
    ...(options.helloTimeoutMs !== undefined ? { helloTimeoutMs: options.helloTimeoutMs } : {}),
  });
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
    // Bytes arriving are a live peer: a large frame arriving slowly must not be cut off by the heartbeat sweep.
    req.socket.on('data', () => {
      if (lastSeen.has(ws)) lastSeen.set(ws, Date.now());
    });
    const conversation = dispatcher.open(
      {
        send: (frame) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(frame));
        },
        close: (code, reason) => ws.close(code, reason),
        isOpen: () => ws.readyState === WebSocket.OPEN,
      },
      // the upgrade checked the bearer secret already
      { authenticated: true, edge: 'websocket' },
    );
    ws.on('message', (data) => {
      lastSeen.set(ws, Date.now());
      conversation.receive(data.toString());
    });
    ws.on('close', () => {
      sockets.delete(ws);
      lastSeen.delete(ws);
      conversation.closed();
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
    dispatcher,
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
