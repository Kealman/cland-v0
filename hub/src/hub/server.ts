// The hub's network edge: one HTTP server, WebSocket upgrades gated by the per-project secret,
// one socket per spoke, every frame handed to the shared dispatcher (`./dispatch.ts`).
import { createServer, type IncomingMessage, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Duplex } from 'node:stream';
import { WebSocketServer, WebSocket } from 'ws';
import { HubCore, type CoreOptions } from './core.ts';
import { Dispatcher, secretMatches, type Control, type DispatcherOptions } from './dispatch.ts';
import { trackerItems } from './topics.ts';
import type { Tracker } from '../tracker/tracker.ts';
import { HEARTBEAT_MS, MAX_FRAME_BYTES } from '../protocol.ts';

/** What the hub is without any listener: the core, the dispatcher every edge opens conversations on, the prune. */
export type HubBaseOptions = CoreOptions & {
  secret: string;
  /** How long a fresh socket may stay silent before its hello, ms. */
  helloTimeoutMs?: number;
  /** How often the retention prune runs, ms (default: daily); it also runs at start. */
  pruneEveryMs?: number;
  artifactRetentionDays?: number;
  /** The request budget and the repeat guard's timings (tests). */
  guard?: DispatcherOptions['guard'];
  requestGuard?: DispatcherOptions['requestGuard'];
  readArtifact?: DispatcherOptions['readArtifact'];
  verification?: DispatcherOptions['verification'];
  journal?: import('./journal.ts').Journal;
  artifactFiles?: DispatcherOptions['artifactFiles'];
  /** `hub.status` and `hub.stop` for clients; absent, clients are told this hub serves no project. */
  control?: Control;
  /** The project's tracker, answering the `task.*` requests; absent on a hub with no project. */
  tracker?: Tracker;
};

export type HubOptions = HubBaseOptions & {
  port: number;
  /** The interface to bind; loopback by default, and cland never binds anything else (ADR 0003). */
  host?: string;
  /** The spokes' heartbeat interval; a socket silent for two of them is closed (default 30 s). */
  heartbeatMs?: number;
};

export type HubBase = {
  core: HubCore;
  /** The frame dispatcher every transport shares; an edge (the WebSocket, the Unix socket, stdio) opens conversations on it. */
  dispatcher: Dispatcher;
  /** Run the retention prune now (the daily job's body). */
  prune: () => number;
  /** Stop the prune and close the store; close the edges first. */
  close: () => Promise<void>;
};

export type Hub = HubBase & {
  url: string;
  port: number;
};

export type WebSocketEdge = { url: string; port: number; close: () => Promise<void> };

const bearerMatches = (header: string | undefined, secret: string): boolean => {
  if (!header) return false;
  const [scheme, token] = header.split(' ', 2);
  if (scheme !== 'Bearer' || !token) return false;
  return secretMatches(token, secret);
};

/** The hub with no listener yet: a stdio-only hub is this and nothing more. */
export function createHubBase(options: HubBaseOptions): HubBase {
  const tracker = options.tracker;
  const core = new HubCore({ ...options, ...(tracker ? {
    items: trackerItems(tracker),
    topLevel: () => tracker.levels[0]!,
    sessionHolds: sessionId => tracker.sessionHolds(sessionId),
  } : {}) });
  // closing a unit of work closes its topic (spec 4.5)
  const unwatchEvents = options.tracker?.onChange(change => core.publishTask(change));
  const unwatchItems = options.tracker?.onClosed((id) => core.itemClosed(id));
  // `task.link` and `task.create` with a topic bind through the topics (one each side); items closed while no hub ran
  const unbindTopics = options.tracker?.bindTopicsThrough(core.topicBinding());
  core.reconcileBindings();
  // Verdict reports remain readable in their topic; subscribed events cover lead delivery.
  const unwatchVerdicts = options.tracker?.onVerdict((id, author, v, report, human) => {
    core.clearPendingVerification(author, id);
    if (human) core.inbox.verdict(id);
    if (report) core.noticeInTopic(report.topic ?? 'agents', {
      kind: 'report', text: `${id}${v.stage ? ` stage ${v.stage}` : ''} ${v.verdict} ${v.result} · ${v.by} · run ${v.run}${report.text ? `\n\n${report.text}` : ''}`,
      detail: { item: id, session: author, verdict: v.verdict, result: v.result, run: v.run, ...(v.stage ? { stage: v.stage } : {}) },
      ...(report.criteria !== undefined ? { criteria: report.criteria } : {}),
    });
  });
  const dispatcher = new Dispatcher({
    core,
    ...(options.journal ? { journal: options.journal } : {}),
    ...(options.verification ? { verification: options.verification } : {}),
    ...(options.artifactFiles ? { artifactFiles: options.artifactFiles } : {}),
    secret: options.secret,
    ...(options.log ? { log: options.log } : {}),
    ...(options.control ? { control: options.control } : {}),
    ...(options.tracker ? { tracker: options.tracker } : {}),
    ...(options.helloTimeoutMs !== undefined ? { helloTimeoutMs: options.helloTimeoutMs } : {}),
    ...(options.readArtifact ? { readArtifact: options.readArtifact } : {}),
    ...(options.guard ? { guard: options.guard } : {}),
    ...(options.requestGuard ? { requestGuard: options.requestGuard } : {}),
  });
  core.prune();
  // Background from start, even for a stdio-only hub. Readiness never awaits filesystem retention.
  let cleanup: Promise<void> | null = null;
  let closing = false;
  const cleanupArtifacts = () => {
    if (closing || cleanup) return;
    cleanup = dispatcher.artifacts.cleanup(options.artifactRetentionDays ?? 30).catch(err => {
      try { options.log?.({ event: 'artifact-cleanup-failed', error: err instanceof Error ? err.message : String(err) }); }
      catch { /* a failed error logger must not kill background retention or prevent retry */ }
    }).finally(() => { cleanup = null; });
  };
  const cleanupStart = setImmediate(cleanupArtifacts);
  const pruneTimer = setInterval(() => { core.prune(); cleanupArtifacts(); }, options.pruneEveryMs ?? 24 * 60 * 60 * 1000);
  pruneTimer.unref();
  return {
    core,
    ...(options.journal ? { journal: options.journal } : {}),
    dispatcher,
    prune: () => { const gone = core.prune(); cleanupArtifacts(); return gone; },
    close: async () => {
      closing = true;
      clearImmediate(cleanupStart);
      clearInterval(pruneTimer);
      core.close();
      await dispatcher.close();
      await cleanup;
      unwatchEvents?.();
      unwatchItems?.();
      unbindTopics?.();
      unwatchVerdicts?.();
      core.store.close();
    },
  };
}

/** The WebSocket edge for spokes on `host:port`; rejects when it cannot listen, leaving nothing bound. */
export async function createWebSocketEdge(
  dispatcher: Dispatcher,
  options: { port: number; host?: string; secret: string; heartbeatMs?: number; log?: HubBaseOptions['log'] },
): Promise<WebSocketEdge> {
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

  await new Promise<void>((resolve, reject) => {
    http.once('error', reject);
    http.listen(options.port, options.host ?? '127.0.0.1', () => resolve());
  });
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
    close: async () => {
      clearInterval(heartbeatTimer);
      for (const ws of sockets) ws.terminate();
      wss.close();
      await new Promise<void>((resolve) => http.close(() => resolve()));
    },
  };
}

/** A hub listening for spokes on its WebSocket: the base and the edge, closed together. */
export async function createHub(options: HubOptions): Promise<Hub> {
  const base = createHubBase(options);
  let edge: WebSocketEdge;
  try {
    edge = await createWebSocketEdge(base.dispatcher, options);
  } catch (err) {
    // nothing may outlive a hub that never listened
    await base.close();
    throw err;
  }
  return {
    ...base,
    url: edge.url,
    port: edge.port,
    close: async () => {
      await edge.close();
      await base.close();
    },
  };
}
