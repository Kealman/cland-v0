import { DigitalOceanApi, DigitalOceanError, type Droplet } from './api.ts';
import { matchesLease, type DropletLease, type ReleaseAttention } from './lease.ts';

export class DropletIdentityMismatch extends Error {
  readonly attention: ReleaseAttention;
  constructor(resource: Droplet, lease: DropletLease) {
    const fields: ReleaseAttention['fields'] = [];
    if (resource.name !== lease.name) fields.push('name');
    if (!lease.tags.every(tag => resource.tags.includes(tag))) fields.push('tags');
    super(`droplet identity differs from its lease; refusing deletion (${fields.join(', ')}; provider status ${resource.status})`);
    this.attention = { fields, expected: { name: lease.name, tags: [...lease.tags] }, observed: { name: resource.name, tags: [...resource.tags], status: resource.status } };
  }
}

// Metadata may disappear while an accepted DELETE completes. It never grants
// deletion authority: retain the lease and poll the resource id until a 404.
const deleting = (resource: Droplet, lease: DropletLease): boolean => Boolean(lease.deleteStarted && resource.id === lease.resource && resource.status === 'archive');
async function resource(api: DigitalOceanApi, lease: DropletLease, deadline?: number): Promise<Droplet | null> {
  if (lease.resource === null) return null;
  try {
    const current = await api.droplet(lease.resource, deadline);
    if (!matchesLease(current, lease) && !deleting(current, lease)) throw new DropletIdentityMismatch(current, lease);
    return current;
  } catch (error) { if (error instanceof DigitalOceanError && error.status === 404) return null; throw error; }
}

/** One bounded attempt. A failed create can still have made a resource: always discover by name. */
export async function deleteLeaseResources(api: DigitalOceanApi, lease: DropletLease, deadline?: number): Promise<{ confirmed: boolean; deleted: number[] }> {
  // The per-id response is newer and authoritative for a known resource, even
  // if a tagged listing still contains its pre-deletion metadata.
  const droplets = (await api.droplets('cland', deadline)).filter(d => d.id !== lease.resource);
  const current = await resource(api, lease, deadline);
  if (current) droplets.push(current);
  const owned = droplets.filter(d => matchesLease(d, lease) && !deleting(d, lease));
  for (const droplet of owned) {
    lease.resource ??= droplet.id;
    const deletedAt = new Date().toISOString();
    await api.deleteDroplet(droplet.id, deadline);
    lease.deleteStarted ??= deletedAt;
  }
  for (const key of await api.keys(deadline)) if (key.name === lease.keyName) { lease.keyId ??= key.id; await api.deleteKey(key.id, deadline); }
  const remaining = await api.droplets('cland', deadline);
  const remainingResource = await resource(api, lease, deadline);
  const keys = await api.keys(deadline);
  // A lost create response must not let a watchdog exit before the in-flight create can settle.
  const uncertainCreate = lease.resource === null && lease.createStarted && !lease.createFinished && Date.now() < Math.max(Date.parse(lease.deadline), Date.parse(lease.createStarted) + 30000);
  const uncertainKey = lease.keyId === null && lease.keyImportStarted && !lease.keyImportFinished && Date.now() < Math.max(Date.parse(lease.deadline), Date.parse(lease.keyImportStarted) + 30000);
  return { confirmed: !uncertainCreate && !uncertainKey && !remainingResource && !remaining.some(d => matchesLease(d, lease) || d.id === lease.resource) && !keys.some(k => k.name === lease.keyName), deleted: owned.map(d => d.id) };
}
