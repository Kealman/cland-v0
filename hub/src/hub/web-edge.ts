// The browser's listener is independent of the authenticated spoke edge.
import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, realpath, rename, stat, writeFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { MAX_FRAME_BYTES } from '../protocol.ts';
import type { WebEdgeStatus, WebLinkResult } from '../protocol.ts';
import { WebAuth, WEB_SESSION_SECONDS } from './web-auth.ts';
import { realClock, type Clock } from './clock.ts';
import type { Dispatcher } from './dispatch.ts';

export type WebEdge = { status: WebEdgeStatus; link: () => WebLinkResult; close: () => Promise<void> };

const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

function allowedHost(req: IncomingMessage): boolean {
  const hosts = req.rawHeaders.filter((_value, index) => index % 2 === 0 && req.rawHeaders[index]!.toLowerCase() === 'host');
  const port = req.socket.localPort;
  return hosts.length === 1 && [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`].includes(req.headers.host?.toLowerCase() ?? '');
}

async function serveBundle(req: IncomingMessage, res: ServerResponse, dist: string, auth: WebAuth): Promise<void> {
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
  if (!allowedHost(req)) {
    reply(403, 'Host must name this loopback web port');
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
  if (path === '/auth') {
    res.setHeader('Cache-Control', 'no-store');
    // HEAD must never spend a link (link scanners may issue it).
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); reply(405, 'Method not allowed'); return; }
    const tokens = new URL(req.url!, 'http://localhost').searchParams.getAll('token');
    const session = tokens.length === 1 ? auth.redeem(tokens[0]!) : null;
    if (!session) { reply(401, 'Invalid or expired sign-in link'); return; }
    res.setHeader('Set-Cookie', `${auth.cookieName}=${session}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${WEB_SESSION_SECONDS}`);
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
export async function createWebEdge(options: { root: string; dispatcher: Dispatcher; clock?: Clock; stateDir: string; port?: number; dist?: string }): Promise<WebEdge> {
  const clock = options.clock ?? realClock;
  const auth = new WebAuth(await realpath(options.root), () => clock.now().getTime());
  const link = () => {
    if (!http.listening) throw new Error('the web edge is unavailable');
    return { url: `http://127.0.0.1:${port}/auth?token=${auth.mint()}` };
  };
  const file = join(options.stateDir, 'web-port');
  let port = options.port ?? 0;
  const dist = resolve(options.dist ?? fileURLToPath(new URL('../../../web/dist/', import.meta.url)));
  const http = createServer((req, res) => { void serveBundle(req, res, dist, auth); });
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_FRAME_BYTES });
  const sockets = new Map<WebSocket, boolean>();
  http.on('upgrade', (req, socket, head) => {
    const refuse = (code: number, reason: string) => {
      socket.write(`HTTP/1.1 ${code} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
      socket.destroy();
    };
    // Match the actual page origin, including its Host spelling and port.
    if (!allowedHost(req) || req.headers.origin !== `http://${req.headers.host}`) { refuse(403, 'Forbidden'); return; }
    if (req.url !== '/ws') { refuse(404, 'Not Found'); return; }
    if (!auth.accepts(req.headers.cookie)) { refuse(401, 'Unauthorized'); return; }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
  });
  wss.on('connection', (ws: WebSocket) => {
    sockets.set(ws, true);
    const conversation = options.dispatcher.open({
      send: frame => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(frame)); },
      close: (code, reason) => ws.close(code, reason),
      isOpen: () => ws.readyState === WebSocket.OPEN,
    }, { authenticated: true, edge: 'web' });
    ws.on('message', data => conversation.receive(data.toString()));
    ws.on('pong', () => sockets.set(ws, true));
    ws.on('close', () => { sockets.delete(ws); conversation.closed(); });
    ws.on('error', () => { /* close follows */ });
  });
  // Browsers cannot send protocol pings themselves. Two missed server pings
  // reap a disconnected page without requiring application keepalive frames.
  const ping = clock.setInterval(() => {
    for (const [ws, alive] of sockets) {
      if (!alive) { ws.terminate(); continue; }
      sockets.set(ws, false);
      if (ws.readyState === WebSocket.OPEN) ws.ping();
    }
  }, 30_000);
  ping.unref();
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
      http.listen(port, '127.0.0.1', () => { http.off('error', reject); resolve(); });
    });
    port = (http.address() as AddressInfo).port;
    if (!options.port) {
      await writeFile(`${file}.tmp`, `${port}\n`, { mode: 0o600 });
      await rename(`${file}.tmp`, file);
    }
    return { status: { port, available: true }, link, close };
  } catch (error) {
    await close();
    return { status: { port, available: false, reason: error instanceof Error ? error.message : String(error) }, link, close };
  }
}
