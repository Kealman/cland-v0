import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { cp, mkdir, mkdtemp, writeFile, rm, readFile, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Action, SnapshotImage, Droplet, Key, Region, Size } from '../../../src/executor/droplet/api.ts';

/** Provider boundary: never retains Authorization in its request log. */
export async function fakeDigitalOcean(token: string) {
  const stateRoot = await mkdtemp(join(tmpdir(), 'cland-fake-do-'));
  const run = promisify(execFile);
  const publicKeys = new Map<number, string>();
  let nextAddress = 10;
  const dropletAddresses = new Map<number, string>();
  const addresses: Record<string, string> = {};
  const machineFaults = { ssh: false, sshFailures: 0, startReplyLost: 0, startMarkerOnly: 0, install: false, marker: false, delayMs: 0, delayCommand: '' };
  await writeFile(join(stateRoot, 'addresses.json'), '{}');
  await writeFile(join(stateRoot, 'machine-faults.json'), JSON.stringify(machineFaults));
  const images: SnapshotImage[] = [];
  const machineDirs = new Map<number, string>();
  const imageDirs = new Map<number, string>();
  const transfers: { image: number; region: string; left: number }[] = [];
  const hidden = new Map<number, number>();
  const actions = new Map<number, { action: Action; type: string; polls: number; complete: () => Promise<void> }>();
  const droplets: Droplet[] = [];
  const keys: Key[] = [];
  const sizes: Size[] = [{ slug: 'c-8', available: true, price_hourly: 0.25, disk: 50, regions: ['lon1', 'nyc1'] }];
  const regions: Region[] = [{ slug: 'lon1', available: true, sizes: ['c-8'] }, { slug: 'nyc1', available: true, sizes: ['c-8'] }];
  const requests: { method: string; path: string; body: Record<string, unknown> | null }[] = [];
  const auth = { token };
  const seedSnapshot = async (image: SnapshotImage, key: unknown): Promise<void> => {
    const directory = join(stateRoot, `image-${image.id}`);
    await mkdir(join(directory, 'home/runner'), { recursive: true });
    await writeFile(join(directory, 'home/runner/.cland-image.json'), JSON.stringify(key));
    await mkdir(join(directory, 'var/lib/cloud/scripts/per-boot'), { recursive: true });
    await writeFile(join(directory, 'var/lib/cloud/scripts/per-boot/cland-runner-keys.sh'), '#!/bin/sh\ninstall -d -m 700 /home/runner/.ssh\ninstall -m 600 /root/.ssh/authorized_keys /home/runner/.ssh/authorized_keys\n');
    imageDirs.set(image.id, directory); images.push(image);
  };
  const polls = new Map<number, number>();
  const deleting = new Map<number, number>();
  const account = { status: 'active' };
  const faults = { create: 0, delayMs: 0, delayPath: '', activeAfter: 2, deletePolls: 0, archiveOnDelete: false, keyDeletePolls: 0, keyDeleteFailures: [] as number[], deleteError: 0, deleteFailures: [] as Array<number | 'timeout'>, echoToken: false, actionAfter: 2, failAction: '', deleteSnapshot: 0, visibilityPolls: 0, snapshotAfter: 0, snapshotHiddenPolls: 0, catalogueError: 0, loseDeleteSnapshot: 0, failCatalogueAfterDelete: false };
  let beforeDropletList: (() => Promise<void>) | undefined;
  let beforeKeyList: (() => Promise<void>) | undefined;
  let beforeCreate: (() => Promise<void>) | undefined;
  let beforeSizes: (() => Promise<void>) | undefined;
  let beforeImport: (() => Promise<void>) | undefined;
  let beforeSnapshotDelete: ((id: number) => Promise<void>) | undefined;
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
    if (method === 'GET' && path === '/sizes') { await beforeSizes?.(); return answer(200, { sizes }); }
    if (method === 'GET' && path === '/regions') return answer(200, { regions });
    if (method === 'POST' && path === '/droplets') {
      try { await beforeCreate?.(); } catch { return answer(500, { id: 'lease-missing', message: 'lease not armed before create' }); }
      if (faults.create) return answer(faults.create, { id: 'refused', message: faults.echoToken ? token : 'create refused' });
      const droplet: Droplet = { id: nextId++, name: String(body!.name), tags: body!.tags as string[], created_at: new Date().toISOString(), status: 'new', networks: { v4: [] } };
      const directory = join(stateRoot, `droplet-${droplet.id}`);
      const snapshotDir = imageDirs.get(Number(body!.image));
      if (snapshotDir) await cp(snapshotDir, directory, { recursive: true });
      else await mkdir(join(directory, 'home/runner'), { recursive: true });
      await mkdir(join(directory, 'var/lib'), { recursive: true });
      await writeFile(join(directory, 'var/lib/cland-ready'), '');
      // DO injects each create's new key for root. A snapshot must carry its own
      // surviving per-boot hook to authorize runner; the provider never does it.
      const keysForCreate = (body!.ssh_keys as number[]).map(id => publicKeys.get(id) ?? '').join('\n');
      await mkdir(join(directory, 'root/.ssh'), { recursive: true });
      await writeFile(join(directory, 'root/.ssh/authorized_keys'), keysForCreate);
      if (snapshotDir) {
        const hook = await readFile(join(directory, 'var/lib/cloud/scripts/per-boot/cland-runner-keys.sh'), 'utf8').catch(() => null);
        if (hook) await run('bash', ['-c', hook.replaceAll('/home/runner', join(directory, 'home/runner')).replaceAll('/root/.ssh', join(directory, 'root/.ssh')).replaceAll('-o runner -g runner', '')], { env: { PATH: process.env.PATH, HOME: join(directory, 'home/runner') } });
      } else {
        // Provisioning creates runner and copies the builder's initial key.
        await mkdir(join(directory, 'home/runner/.ssh'), { recursive: true });
        await copyFile(join(directory, 'root/.ssh/authorized_keys'), join(directory, 'home/runner/.ssh/authorized_keys'));
      }
      if (body!.user_data) await writeFile(join(directory, 'user-data.sh'), String(body!.user_data));
      machineDirs.set(droplet.id, directory);
      const address = `203.0.113.${nextAddress++}`;
      addresses[address] = directory; dropletAddresses.set(droplet.id, address);
      await writeFile(join(stateRoot, 'addresses.json'), JSON.stringify(addresses));
      droplets.push(droplet);
      return answer(202, { droplet });
    }
    if (method === 'GET' && path === '/snapshots') {
      if (faults.catalogueError) return answer(faults.catalogueError, { id: 'catalogue_failed', message: 'catalogue unavailable' });
      for (const transfer of [...transfers]) if (--transfer.left <= 0) {
        images.find(image => image.id === transfer.image)?.regions.push(transfer.region);
        transfers.splice(transfers.indexOf(transfer), 1);
      }
      const visible = images.filter(image => {
        const left = hidden.get(image.id) ?? 0;
        if (left > 0) { hidden.set(image.id, left - 1); return false; }
        return true;
      });
      return answer(200, { snapshots: visible });
    }
    const snapshotId = /^\/snapshots\/(\d+)$/.exec(path);
    if (snapshotId && method === 'DELETE') {
      await beforeSnapshotDelete?.(Number(snapshotId[1]));
      if (Number(snapshotId[1]) === faults.deleteSnapshot) return answer(422, { id: 'delete_failed', message: 'snapshot deletion refused' });
      const index = images.findIndex(i => i.id === Number(snapshotId[1])); if (index >= 0) images.splice(index, 1);
      if (Number(snapshotId[1]) === faults.loseDeleteSnapshot) {
        if (faults.failCatalogueAfterDelete) faults.catalogueError = 503;
        req.socket.destroy(); return;
      }
      return answer(204);
    }
    if (method === 'POST' && (path === '/tags' || /^\/tags\/[^/]+\/resources$/.test(path))) return answer(204);
    const dropletAction = /^\/droplets\/(\d+)\/actions$/.exec(path);
    const imageAction = /^\/images\/(\d+)\/actions$/.exec(path);
    if (method === 'POST' && (dropletAction || imageAction)) {
      const resource = Number((dropletAction ?? imageAction)![1]);
      const type = String(body!.type);
      const action: Action = { id: nextId++, status: 'in-progress', resource_id: resource };
      actions.set(action.id, { action, type, polls: 0, complete: async () => {
        if (type === 'snapshot') {
          const create = requests.find(r => r.method === 'POST' && r.path === '/v2/droplets' && r.body?.name === droplets.find(d => d.id === resource)?.name)?.body;
          const image: SnapshotImage = { id: nextId++, name: String(body!.name), resource_id: String(resource), regions: [String(create?.region)], size_gigabytes: 1.5, min_disk_size: 50, created_at: new Date().toISOString() };
          const directory = join(stateRoot, `image-${image.id}`);
          await cp(machineDirs.get(resource)!, directory, { recursive: true });
          imageDirs.set(image.id, directory); images.push(image);
          hidden.set(image.id, faults.snapshotHiddenPolls);
        } else if (type === 'transfer') {
          if (faults.visibilityPolls) transfers.push({ image: resource, region: String(body!.region), left: faults.visibilityPolls });
          else images.find(i => i.id === resource)!.regions.push(String(body!.region));
        }
        else if (type === 'power_off') droplets.find(d => d.id === resource)!.status = 'off';
      } });
      return answer(201, { action });
    }
    const actionId = /^\/actions\/(\d+)$/.exec(path);
    if (method === 'GET' && actionId) {
      const record = actions.get(Number(actionId[1]))!;
      if (record.action.status === 'in-progress' && ++record.polls >= (record.type === 'snapshot' && faults.snapshotAfter ? faults.snapshotAfter : faults.actionAfter)) {
        // Failure injection leaves a partial snapshot so rollback proves image cleanup.
        if (record.type === 'snapshot' || faults.failAction !== record.type) await record.complete();
        record.action.status = faults.failAction === record.type ? 'errored' : 'completed';
      }
      return answer(200, { action: record.action });
    }
    if (method === 'GET' && path === '/actions') return answer(200, { actions: [...actions.values()].map(record => ({ ...record.action, type: record.type })) });
    if (method === 'GET' && path === '/droplets') {
      await beforeDropletList?.();
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
        const failure = faults.deleteFailures.shift();
        if (failure === 'timeout') {
          // Fault injection: exceed the caller's API deadline before returning the delete failure.
          await new Promise(resolve => setTimeout(resolve, 2000));
          return answer(503, { id: 'unavailable', message: 'delete transport delayed' });
        }
        if (failure !== undefined) return answer(failure, { id: 'delete_failed', message: faults.echoToken ? token : 'droplet busy or provider unavailable; try later' });
        if (faults.deleteError) return answer(faults.deleteError, { id: 'delete_failed', message: 'try later' });
        if (!deleting.has(id)) deleting.set(id, faults.deletePolls);
        if (faults.archiveOnDelete) { droplet.status = 'archive'; droplet.tags = []; }
        return answer(204);
      }
      const n = (polls.get(id) ?? 0) + 1;
      polls.set(id, n);
      if (n >= faults.activeAfter && droplet.status !== 'archive') droplet.status = 'active';
      if (n > faults.activeAfter) droplet.networks.v4 = [{ type: 'public', ip_address: dropletAddresses.get(id)! }];
      return answer(200, { droplet });
    }
    if (path === '/account/keys') {
      if (method === 'POST') { await beforeImport?.(); const ssh_key = { id: nextId++, name: String(body!.name), public_key: String(body!.public_key) }; keys.push(ssh_key); publicKeys.set(ssh_key.id, ssh_key.public_key); return answer(201, { ssh_key }); }
      await beforeKeyList?.();
      return answer(200, { ssh_keys: keys });
    }
    const keyId = /^\/account\/keys\/(\d+)$/.exec(path);
    if (keyId && method === 'DELETE') {
      const failure = faults.keyDeleteFailures.shift();
      if (failure !== undefined) return answer(failure, { id: 'key_delete_failed', message: faults.echoToken ? token : 'key deletion refused; try later' });
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
  return { url: `http://127.0.0.1:${address.port}/v2`, account, droplets, keys, sizes, regions, requests, faults, auth, images, stateRoot, machineDirs, imageDirs, machineFaults, seedSnapshot,
    setMachineFaults: async (value: Partial<typeof machineFaults>) => { Object.assign(machineFaults, value); await writeFile(join(stateRoot, 'machine-faults.json'), JSON.stringify(machineFaults)); },
    beforeDropletList: (check: () => Promise<void>) => { beforeDropletList = check; },
    beforeKeyList: (check: () => Promise<void>) => { beforeKeyList = check; },
    beforeSizes: (check: () => Promise<void>) => { beforeSizes = check; },
    beforeCreate: (check: () => Promise<void>) => { beforeCreate = check; },
    beforeImport: (check: () => Promise<void>) => { beforeImport = check; },
    beforeSnapshotDelete: (check: (id: number) => Promise<void>) => { beforeSnapshotDelete = check; },
    close: async () => { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); await rm(stateRoot, { recursive: true, force: true }); },
  };
}
