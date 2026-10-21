import { networkInterfaces } from 'node:os';
import { addressHost, phoneOrigin } from '../web-address.ts';
// The browser's listener is independent of the authenticated spoke edge.
import { once } from 'node:events';
import type { Store } from './store.ts';
import type { LogFn } from '../log.ts';
import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, realpath, rename, stat, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { FRAME_LIMITS_BYTES, BINARY_RESERVED_CLOSE_CODE } from '../protocol.ts';
import type { WebEdgeStatus, WebLinkResult, WebSessionsResult, WebRevokeResult } from '../protocol.ts';
import { WebArtifacts } from './web-artifacts.ts';
import { WebAuth, WEB_SESSION_SECONDS } from './web-auth.ts';
import { realClock, type Clock } from './clock.ts';
import type { Dispatcher } from './dispatch.ts';

export type WebEdge = { status: WebEdgeStatus; link: (qr?: boolean) => WebLinkResult; sessions: () => WebSessionsResult; revoke: (id: string) => Promise<WebRevokeResult>; close: () => Promise<void> };

const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.htm': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.pdf': 'application/pdf', '.wasm': 'application/wasm',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

function allowedHost(req: IncomingMessage, hostsAllowed: string[], origin: string): boolean {
  const hosts = req.rawHeaders.filter((_value, index) => index % 2 === 0 && req.rawHeaders[index]!.toLowerCase() === 'host');
  const port = req.socket.localPort;
  return hosts.length === 1 && [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`, ...hostsAllowed.map(host => `${host}:${port}`), ...(origin ? [new URL(origin).host] : [])].includes(req.headers.host?.toLowerCase() ?? '');
}

async function serveBundle(req: IncomingMessage, res: ServerResponse, dist: string, auth: WebAuth, artifacts: WebArtifacts, hosts: string[], origin: string): Promise<void> {
  // Supply Date directly: Node's automatic Date cache creates a process-global timer.
  res.setHeader('Date', new Date().toUTCString());
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-cache');
  const reply = (code: number, body: string) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.writeHead(code).end(req.method === 'HEAD' ? undefined : body);
  };
  if (!allowedHost(req, hosts, origin)) {
    reply(403, 'Host must name an allowed web address');
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    reply(405, 'Method not allowed');
    return;
  }
  let path: string;
  try { path = decodeURIComponent((req.url ?? '/').split('?')[0]!); }
  catch { reply(400, 'Malformed path'); return; }
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || path.includes('\0') || path.split('/').includes('..')) {
    reply(403, 'Path outside the web bundle');
    return;
  }
  if (path.startsWith('/a/')) {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const file = await artifacts.read(path);
      if (!file) { reply(404, 'Artifact file not found'); return; }
      const mime = MIME[extname(file.name).toLowerCase()] ?? 'application/octet-stream';
      // The response policy applies even when opened outside the workbench iframe.
      res.setHeader('Content-Security-Policy', 'sandbox allow-scripts');
      res.setHeader('Content-Type', mime);
      res.setHeader('Content-Length', file.body.length);
      res.writeHead(200).end(req.method === 'HEAD' ? undefined : file.body);
    } catch { reply(404, 'Artifact file not found'); }
    return;
  }
  if (path === '/auth') {
    res.setHeader('Cache-Control', 'no-store');
    // HEAD must never spend a link (link scanners may issue it).
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); reply(405, 'Method not allowed'); return; }
    const tokens = new URL(req.url!, 'http://localhost').searchParams.getAll('token');
    const session = tokens.length === 1 ? auth.redeem(tokens[0]!) : null;
    if (!session) { reply(401, 'Invalid or expired sign-in link'); return; }
    res.setHeader('Set-Cookie', `${auth.cookieName}=${session}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${WEB_SESSION_SECONDS}${origin && req.headers.host?.toLowerCase() === new URL(origin).host && req.headers.origin === origin ? '; Secure' : ''}`);
    res.setHeader('Location', '/');
    res.writeHead(302).end();
    return;
  }
  const confined = (file: string) => {
    const rel = relative(dist, file);
    return !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`);
  };
  let target = resolve(dist, `.${path}`);
  if (!confined(target)) { reply(403, 'Path outside the web bundle'); return; }
  try {
    let physical: string | null;
    try { physical = await realpath(target); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT' && (error as NodeJS.ErrnoException).code !== 'ENOTDIR') throw error;
      physical = null;
    }
    // Resolve symlinks before deciding whether a SPA route should fall back.
    const bundleRoot = await realpath(dist);
    const inside = (file: string) => {
      const rel = relative(bundleRoot, file);
      return !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`);
    };
    if (physical && !inside(physical)) { reply(403, 'Path outside the web bundle'); return; }
    if ((!physical || !(await stat(physical)).isFile()) && !extname(path)) {
      target = join(dist, 'index.html');
      physical = await realpath(target);
      if (!inside(physical)) { reply(403, 'Path outside the web bundle'); return; }
    }
    if (!physical && target === join(dist, 'index.html')) {
      reply(503, 'The cland web bundle is missing. Run npm run build --workspace web.\n');
      return;
    }
    if (!physical || !(await stat(physical)).isFile()) { reply(404, 'Not found'); return; }
    const body = await readFile(physical);
    const etag = `"${createHash('sha256').update(body).digest('hex')}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Content-Type', MIME[extname(target)] ?? 'application/octet-stream');
    if (path.startsWith('/assets/') && target !== join(dist, 'index.html')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (req.headers['if-none-match']?.split(',').some(tag => tag.trim().replace(/^W\//, '') === etag || tag.trim() === '*')) {
      res.writeHead(304).end();
      return;
    }
    res.setHeader('Content-Length', body.length);
    res.writeHead(200).end(req.method === 'HEAD' ? undefined : body);
  } catch (error) {
    if (['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) {
      if (target === join(dist, 'index.html') || !extname(path)) reply(503, 'The cland web bundle is missing. Run npm run build --workspace web.\n');
      else reply(404, 'Not found');
    } else reply(500, 'Cannot read the web bundle');
  }
}

/** A selected origin never drifts when its port is occupied. The daemon holds the project lock. */
export async function createWebEdge(options: { artifactOpen?: typeof import('node:fs/promises').open; root: string; store: Store; dispatcher: Dispatcher; log?: LogFn; clock?: Clock; stateDir: string; port?: number; bind?: string; origin?: string; dist?: string }): Promise<WebEdge> {
  const clock = options.clock ?? realClock;
  const bind = options.bind ?? '127.0.0.1';
  const origin = options.origin ?? '';
  const pageOrigin = (req: IncomingMessage) => origin && req.headers.host?.toLowerCase() === new URL(origin).host ? origin : `http://${req.headers.host}`;
  const prefix = { path: resolve(options.root), realPath: await realpath(options.root) };
  const auth = new WebAuth(prefix.realPath, options.store, () => clock.now().getTime());
  const artifacts = new WebArtifacts(options.store, auth, prefix, options.artifactOpen);
  const network = bind === '0.0.0.0' || bind === '::'
    ? Object.values(networkInterfaces()).flatMap(rows => rows ?? []).filter(row => !row.internal && !row.address.includes('%') && (bind === '::' || row.family === 'IPv4')).map(row => row.address)
    : [bind];
  const hosts = network.map(addressHost);
  const link = (qr = false) => {
    if (!http.listening) throw new Error('the web edge is unavailable');
    const base = qr ? phoneOrigin(bind, origin, port, network) : `http://${addressHost(bind === '0.0.0.0' || bind === '::' ? '127.0.0.1' : bind)}:${port}`;
    return { url: `${base}/auth?token=${auth.mint()}` };
  };
  const file = join(options.stateDir, 'web-port');
  let port = options.port ?? 0;
  const dist = resolve(options.dist ?? fileURLToPath(new URL('../../../web/dist/', import.meta.url)));
  // Read at welcome: rebuilding the served bundle does not require a hub restart.
  const buildStamp = (): string | null => {
    try {
      const stamp = JSON.parse(readFileSync(join(dist, 'build-stamp.json'), 'utf8')) as { version?: unknown; sources?: unknown };
      return stamp?.version === 1 && typeof stamp.sources === 'string' && /^[a-f0-9]{64}$/.test(stamp.sources) ? stamp.sources : null;
    } catch { return null; }
  };
  const http = createServer((req, res) => { void serveBundle(req, res, dist, auth, artifacts, hosts, origin); });
  const wss = new WebSocketServer({ noServer: true, maxPayload: FRAME_LIMITS_BYTES.json });
  const sockets = new Map<WebSocket, { seen: number; session: string }>();
  http.on('upgrade', (req, socket, head) => {
    const refuse = (code: number, reason: string) => {
      socket.write(`HTTP/1.1 ${code} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
      socket.destroy();
    };
    // Match the actual page origin, including its Host spelling and port.
    if (!allowedHost(req, hosts, origin) || req.headers.origin !== pageOrigin(req)) { refuse(403, 'Forbidden'); return; }
    if (req.url !== '/ws') { refuse(404, 'Not Found'); return; }
    const session = auth.session(req.headers.cookie);
    if (!session) { refuse(401, 'Unauthorized'); return; }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, session, pageOrigin(req), req));
  });
  wss.on('connection', (ws: WebSocket, session: string, page: string, req: IncomingMessage) => {
    const state = { seen: clock.now().getTime(), session };
    sockets.set(ws, state);
    const seen = () => { state.seen = clock.now().getTime(); };
    req.socket.on('data', seen);
    const conversation = options.dispatcher.open({
      sendSerialized: json => { if (ws.readyState === WebSocket.OPEN) ws.send(json); },
      send: frame => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(frame)); },
      close: (code, reason) => ws.close(code, reason),
      isOpen: () => ws.readyState === WebSocket.OPEN,
    }, { authenticated: true, edge: 'web', buildStamp, artifactUrl: id => artifacts.mint(session, id, page) });
    ws.on('message', (data, binary) => {
      if (binary) { ws.close(BINARY_RESERVED_CLOSE_CODE, 'binary frames reserved for streams'); return; }
      conversation.receive(data.toString());
    });
    ws.on('pong', seen);
    ws.on('close', () => {
      req.socket.off('data', seen);
      sockets.delete(ws);
      conversation.closed();
      options.log?.({ event: 'web-session-socket-closed', session });
    });
    ws.on('error', () => { /* close follows */ });
  });
  // Browsers answer protocol pings automatically. Incoming traffic also counts
  // as liveness, including a large frame still arriving at the silence boundary.
  const ping = clock.setInterval(() => {
    for (const [ws, state] of sockets) {
      if (clock.now().getTime() - state.seen >= 60_000) { ws.terminate(); continue; }
      if (ws.readyState === WebSocket.OPEN) ws.ping();
    }
  }, 30_000);
  ping.unref();
  const sessions = (): WebSessionsResult => ({ sessions: auth.sessions().map(session => ({
    ...session, sockets: [...sockets].filter(([ws, state]) => state.session === session.id && ws.readyState === WebSocket.OPEN).length,
  })) });
  const revoke = async (id: string): Promise<WebRevokeResult> => {
    // Delete admission first, then observe every server close before replying. A
    // hard close also covers peers that never complete a close handshake.
    if (!auth.revoke(id)) throw new Error(`unknown web session: ${id}`);
    const closed: Promise<unknown>[] = [];
    for (const [ws, state] of sockets) {
      if (state.session !== id) continue;
      closed.push(once(ws, 'close'));
      ws.terminate();
    }
    await Promise.all(closed);
    return { revoked: id };
  };
  let closing: Promise<void> | undefined;
  const close = () => closing ??= (async () => {
    clock.clearInterval(ping);
    for (const ws of sockets.keys()) ws.terminate();
    await Promise.all([
      new Promise<void>(resolve => wss.close(() => resolve())),
      new Promise<void>((resolve, reject) => {
        if (!http.listening) { resolve(); return; }
        http.close(error => error ? reject(error) : resolve());
        http.closeAllConnections();
      }),
    ]);
  })();
  try {
    if (!port) {
      const kept = Number((await readFile(file, 'utf8').catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return '';
        throw error;
      })).trim());
      if (Number.isInteger(kept) && kept > 0 && kept <= 65535) port = kept;
    }
    await new Promise<void>((resolve, reject) => {
      http.once('error', reject);
      http.listen(port, bind, () => { http.off('error', reject); resolve(); });
    });
    port = (http.address() as AddressInfo).port;
    if (!options.port) {
      await writeFile(`${file}.tmp`, `${port}\n`, { mode: 0o600 });
      await rename(`${file}.tmp`, file);
    }
    return { status: { port, bind: (http.address() as AddressInfo).address, available: true }, link, sessions, revoke, close };
  } catch (error) {
    await close();
    return { status: { port, bind, available: false, reason: error instanceof Error ? error.message : String(error) }, link, sessions, revoke, close };
  }
}
