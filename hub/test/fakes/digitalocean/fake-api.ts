import { createServer } from 'node:http';
import type { Droplet, Key, Region, Size } from '../../../src/executor/droplet/api.ts';

/** Provider boundary: never retains Authorization in its request log. */
export async function fakeDigitalOcean(token: string) {
  const droplets: Droplet[] = [];
  const keys: Key[] = [];
  const sizes: Size[] = [{ slug: 'c-8', available: true, price_hourly: 0.25, regions: ['lon1', 'nyc1'] }];
  const regions: Region[] = [{ slug: 'lon1', available: true, sizes: ['c-8'] }, { slug: 'nyc1', available: true, sizes: ['c-8'] }];
  const requests: { method: string; path: string; body: Record<string, unknown> | null }[] = [];
  const auth = { token };
  const polls = new Map<number, number>();
  const deleting = new Map<number, number>();
  const account = { status: 'active' };
  const faults = { create: 0, delayMs: 0, delayPath: '', activeAfter: 2, deletePolls: 0, keyDeletePolls: 0, deleteError: 0, echoToken: false };
  let beforeCreate: (() => Promise<void>) | undefined;
  let beforeImport: (() => Promise<void>) | undefined;
  let nextId = 100;
  const server = createServer(async (req, res) => {
    if (req.headers.authorization !== `Bearer ${auth.token}`) { res.writeHead(401); res.end(JSON.stringify({ id: 'unauthorized', message: 'bad authorization' })); return; }
    const url = new URL(req.url!, 'http://fake');
    const method = req.method!;
    const path = url.pathname.replace(/^\/v2/, '');
    let source = '';
    for await (const chunk of req) source += String(chunk);
    const body = source ? JSON.parse(source) as Record<string, unknown> : null;
    requests.push({ method, path: req.url!, body });
    if (faults.delayMs && (!faults.delayPath || path === faults.delayPath && method === 'POST')) await new Promise(r => setTimeout(r, faults.delayMs));
    const answer = (status: number, value?: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(value === undefined ? '' : JSON.stringify(value)); };
    if (method === 'GET' && path === '/account') return answer(200, { account });
    if (method === 'GET' && path === '/sizes') return answer(200, { sizes });
    if (method === 'GET' && path === '/regions') return answer(200, { regions });
    if (method === 'POST' && path === '/droplets') {
      try { await beforeCreate?.(); } catch { return answer(500, { id: 'lease-missing', message: 'lease not armed before create' }); }
      if (faults.create) return answer(faults.create, { id: 'refused', message: faults.echoToken ? token : 'create refused' });
      const droplet: Droplet = { id: nextId++, name: String(body!.name), tags: body!.tags as string[], created_at: new Date().toISOString(), status: 'new', networks: { v4: [] } };
      droplets.push(droplet);
      return answer(202, { droplet });
    }
    if (method === 'GET' && path === '/droplets') {
      const tag = url.searchParams.get('tag_name');
      for (const [id, left] of deleting) {
        if (left <= 0) { droplets.splice(droplets.findIndex(d => d.id === id), 1); deleting.delete(id); }
        else deleting.set(id, left - 1);
      }
      return answer(200, { droplets: droplets.filter(d => !tag || d.tags.includes(tag)) });
    }
    const dropletId = /^\/droplets\/(\d+)$/.exec(path);
    if (dropletId) {
      const id = Number(dropletId[1]);
      const droplet = droplets.find(d => d.id === id);
      if (!droplet) return answer(404, { id: 'not_found', message: 'absent' });
      if (method === 'DELETE') {
        if (faults.deleteError) return answer(faults.deleteError, { id: 'delete_failed', message: 'try later' });
        if (!deleting.has(id)) deleting.set(id, faults.deletePolls);
        return answer(204);
      }
      const n = (polls.get(id) ?? 0) + 1;
      polls.set(id, n);
      if (n >= faults.activeAfter) droplet.status = 'active';
      if (n > faults.activeAfter) droplet.networks.v4 = [{ type: 'public', ip_address: '203.0.113.10' }];
      return answer(200, { droplet });
    }
    if (path === '/account/keys') {
      if (method === 'POST') { await beforeImport?.(); const ssh_key = { id: nextId++, name: String(body!.name), public_key: String(body!.public_key) }; keys.push(ssh_key); return answer(201, { ssh_key }); }
      return answer(200, { ssh_keys: keys });
    }
    const keyId = /^\/account\/keys\/(\d+)$/.exec(path);
    if (keyId && method === 'DELETE') {
      const i = keys.findIndex(k => k.id === Number(keyId[1]));
      if (i < 0) return answer(404, { id: 'not_found', message: 'absent' });
      if (faults.keyDeletePolls > 0) faults.keyDeletePolls--; else keys.splice(i, 1);
      return answer(204);
    }
    answer(404, { id: 'not_found', message: 'unknown endpoint' });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('fake did not bind');
  return { url: `http://127.0.0.1:${address.port}/v2`, account, droplets, keys, sizes, regions, requests, faults, auth,
    beforeCreate: (check: () => Promise<void>) => { beforeCreate = check; },
    beforeImport: (check: () => Promise<void>) => { beforeImport = check; },
    close: async () => { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); },
  };
}
