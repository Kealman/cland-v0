// Invite HTTP handlers: no password ever enters dispatch or the journal.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Store } from './store.ts';
import { WebAuth, webSessionCookie } from './web-auth.ts';
import { hashPassword } from './passwords.ts';

export function createWebSignIn(store: Store, auth: WebAuth, now: () => number, origin: string, pageOrigin: (req: IncomingMessage) => string) {
  let stopped = false;
  const work = new Set<Promise<boolean>>();
  const requests = new Set<IncomingMessage>();
  async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    if (!['/invite', '/invite/details', '/invite/register'].includes((req.url ?? '').split('?')[0]!)) return false;
    const url = new URL(req.url!, 'http://localhost');
    if (!['/invite', '/invite/details', '/invite/register'].includes(url.pathname)) return false;
    res.setHeader('Cache-Control', 'no-store');
    const reply = (code: number, value: unknown) => { res.writeHead(code, { 'Content-Type': 'application/json' }).end(JSON.stringify(value)); };
    if (store.users.mode() !== 'users') { reply(404, { error: 'Not found' }); return true; }
    // A navigation GET has no Origin. All API requests require exact Origin.
    if ((url.pathname !== '/invite' || req.headers.origin !== undefined) && req.headers.origin !== pageOrigin(req)) {
      reply(403, { error: 'Foreign Origin' }); return true;
    }
    const post = url.pathname === '/invite/register';
    const method = url.pathname === '/invite' ? 'GET' : 'POST';
    if (req.method !== method) { res.setHeader('Allow', method); reply(405, { error: 'Method not allowed' }); return true; }
    try {
      auth.assertAdmission();
      if (stopped) throw new Error('Sign-in closed');
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
      let body: { token?: unknown; password?: unknown };
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('Invalid registration body'); }
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
