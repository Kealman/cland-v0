// Invite HTTP handlers: no password ever enters dispatch or the journal.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Store } from './store.ts';
import { WebAuth, webSessionCookie } from './web-auth.ts';
import { hashPassword, verifyPassword } from './passwords.ts';

export function createWebSignIn(store: Store, auth: WebAuth, now: () => number, origin: string, pageOrigin: (req: IncomingMessage) => string, revoke: (id: string) => Promise<unknown>) {
  let stopped = false;
  const failures = new Map<string, { count: number; until: number }>();
  const dummyHash = `scrypt$${'0'.repeat(64)}$${'0'.repeat(128)}`;
  function failed(keys: string[]) {
    for (const key of keys) {
      const count = (failures.get(key)?.count ?? 0) + 1;
      failures.delete(key);
      failures.set(key, { count, until: now() + Math.min(900_000, 1000 * 2 ** Math.min(20, Math.max(0, count - 5))) });
    }
    while (failures.size > 10_000) failures.delete(failures.keys().next().value!);
  }
  const work = new Set<Promise<boolean>>();
  const requests = new Set<IncomingMessage>();
  async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const path = (req.url ?? '').split('?')[0]!;
    const users = store.users.mode() === 'users';
    if (path === '/' && users && (req.method === 'GET' || req.method === 'HEAD') && !auth.accepts(req.headers.cookie)) {
      res.setHeader('Cache-Control', 'no-store'); res.writeHead(302, { Location: '/signin' }).end(); return true;
    }
    if (path === '/signin/status') {
      res.setHeader('Cache-Control', 'no-store');
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ required: users && !auth.accepts(req.headers.cookie) })); return true;
    }
    if (!['/invite', '/invite/details', '/invite/register', '/signin', '/signin/password', '/signout'].includes(path)) return false;
    const url = new URL(req.url!, 'http://localhost');

    res.setHeader('Cache-Control', 'no-store');
    const reply = (code: number, value: unknown) => { res.writeHead(code, { 'Content-Type': 'application/json' }).end(JSON.stringify(value)); };
    if (store.users.mode() !== 'users') { reply(404, { error: 'Not found' }); return true; }
    // A navigation GET has no Origin. All API requests require exact Origin.
    if ((!['/invite', '/signin'].includes(url.pathname) || req.headers.origin !== undefined) && req.headers.origin !== pageOrigin(req)) {
      reply(403, { error: 'Foreign Origin' }); return true;
    }
    const post = ['/invite/register', '/signin/password'].includes(url.pathname);
    const method = ['/invite', '/signin'].includes(url.pathname) ? 'GET' : 'POST';
    if (req.method !== method) { res.setHeader('Allow', method); reply(405, { error: 'Method not allowed' }); return true; }
    try {
      auth.assertAdmission();
      if (stopped) throw new Error('Sign-in closed');
      if (url.pathname === '/signin') return false;
      if (url.pathname === '/signout') {
        const session = auth.session(req.headers.cookie);
        if (!session) { reply(401, { error: 'Sign-in required' }); return true; }
        await revoke(session);
        reply(200, { ok: true }); return true;
      }
      if (!post) {
        const tokens = url.searchParams.getAll('token');
        const user = store.users.checkInvite(tokens.length === 1 ? tokens[0]! : '', now());
        if (url.pathname === '/invite') return false; // Valid navigation serves the isolated React view.
        reply(200, { name: user.name, displayName: user.displayName }); return true;
      }
      if (req.headers['content-type'] !== 'application/json') { reply(415, { error: 'JSON required' }); return true; }
      const chunks: Buffer[] = [];
      let size = 0;
      req.setTimeout(5000, () => req.destroy());
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 8192) { reply(413, { error: 'Body too large' }); return true; }
        chunks.push(Buffer.from(chunk));
      }
      req.setTimeout(0);
      let body: { token?: unknown; password?: unknown; name?: unknown };
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('Invalid registration body'); }
      if (url.pathname === '/signin/password') {
        const refusal = () => reply(401, { error: 'Name or password is incorrect' });
        if (!body || typeof body.name !== 'string' || typeof body.password !== 'string' || body.name.length > 128) { refusal(); return true; }
        for (const [key, row] of failures) if (row.until + 900_000 < now()) failures.delete(key);
        const keys = [`user:${body.name}`, `address:${req.socket.remoteAddress ?? ''}`];
        if (keys.some(key => { const row = failures.get(key); return row && row.count >= 5 && row.until > now(); })) { refusal(); return true; }
        const user = store.users.byName(body.name);
        const hash = user ? store.users.password(user.id) : null;
        const valid = await verifyPassword(body.password, hash ?? dummyHash);
        auth.assertAdmission();
        if (stopped || res.destroyed) throw new Error('Sign-in closed');
        if (!valid || !user || user.state !== 'active' || store.users.password(user.id) !== hash) { failed(keys); refusal(); return true; }
        const token = auth.issue(user.id);
        for (const key of keys) failures.delete(key);
        res.setHeader('Set-Cookie', webSessionCookie(auth, token, req, origin));
        reply(200, { ok: true }); return true;
      }
      if (!body || typeof body.token !== 'string' || typeof body.password !== 'string') throw new Error('Invalid registration body');
      store.users.checkInvite(body.token, now());
      const hash = await hashPassword(body.password);
      auth.assertAdmission();
      if (stopped || res.destroyed) throw new Error('Sign-in closed');
      const token = store.users.registerPassword(body.token, hash, now(), user => auth.issue(user.id));
      res.setHeader('Set-Cookie', webSessionCookie(auth, token, req, origin));
      reply(200, { ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const safe = /^(unknown invite|used invite|revoked invite|expired invite|Password must contain|Invalid registration body|browser sign-in transition|Sign-in closed)/.test(message);
      reply(400, { error: safe ? message : 'Registration failed' });
    }
    return true;
  }
  return {
    handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
      requests.add(req);
      const operation = handle(req, res);
      work.add(operation);
      void operation.finally(() => { work.delete(operation); requests.delete(req); }).catch(() => {});
      return operation;
    },
    async close(): Promise<void> { stopped = true; for (const req of requests) if (!req.complete) req.destroy(); await Promise.allSettled(work); },
  };
}
