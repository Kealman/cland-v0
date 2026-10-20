import { realClock, type Clock } from '../../hub/clock.ts';
import type { Provider } from './dependencies.ts';
import { DigitalOceanError, type Droplet } from './api.ts';
import { matchesLease, type DropletLease, type ReleaseAttention } from './lease.ts';
import { pause } from './watchdog.ts';

export class DropletIdentityMismatch extends Error {
  readonly attention: ReleaseAttention;
  constructor(resource: Droplet, lease: DropletLease) {
    const fields: ReleaseAttention['fields'] = [];
    if (resource.id !== lease.resource) fields.push('id');
    if (resource.name !== lease.name) fields.push('name');
    if (!lease.tags.every(tag => resource.tags.includes(tag))) fields.push('tags');
    super(`droplet identity differs from its lease; refusing deletion (${fields.join(', ')}; provider status ${resource.status})`);
    this.attention = { fields, expected: { id: lease.resource, name: lease.name, tags: [...lease.tags] }, observed: { id: resource.id, name: resource.name, tags: [...resource.tags], status: resource.status } };
  }
}

export class DropletDeletionTimeout extends Error {
  readonly attention: ReleaseAttention;
  constructor(resource: Droplet, lease: DropletLease) {
    super(`droplet deletion confirmation timed out; provider status ${resource.status}`);
    this.attention = { ...new DropletIdentityMismatch(resource, lease).attention, reason: 'deletion-timeout' };
  }
}

// Metadata may disappear while an accepted DELETE completes. It never grants
// deletion authority: retain the lease and poll the resource id until a 404.
const deleting = (resource: Droplet, lease: DropletLease): boolean => Boolean(lease.deleteStarted && resource.id === lease.resource && resource.name === lease.name);
async function resource(api: Provider, lease: DropletLease, deadline: number | undefined, onMismatch: ((attention: ReleaseAttention) => void | Promise<void>) | undefined, deletionTimeoutMs: number, clock: Clock, wait: (ms: number) => Promise<void>): Promise<Droplet | null> {
  if (lease.resource === null) return null;
  try {
    let current = await api.droplet(lease.resource, deadline);
    let until: number | undefined;
    for (;;) {
      const mismatch = new DropletIdentityMismatch(current, lease);
      if (mismatch.attention.fields.includes('id') || mismatch.attention.fields.includes('name')) throw mismatch;
      // Only an empty tag set is a destroy transition. Populated foreign tags
      // remain an identity refusal even after an accepted DELETE.
      if (mismatch.attention.fields.includes('tags') && current.tags.length > 0) throw mismatch;
      const failure = lease.deleteStarted ? new DropletDeletionTimeout(current, lease) : mismatch;
      // An accepted deletion has the same bound whether tags vanish or remain.
      if (lease.deleteStarted && clock.now().getTime() >= Date.parse(lease.deleteStarted) + deletionTimeoutMs) throw failure;
      if (matchesLease(current, lease)) return current;
      // An earlier delete (including the watchdog's) can strip tags before its
      // acknowledgement is recorded, while the provider still reports active.
      // Observe only: empty tags never grant permission to DELETE.
      if (until === undefined) {
        // The attempt deadline is not the provider's deletion deadline. The
        // hub's sweep can continue short attempts without resetting this bound.
        until = lease.deleteStarted ? Date.parse(lease.deleteStarted) + deletionTimeoutMs
          : lease.state === 'releasing' ? clock.now().getTime() + deletionTimeoutMs
          : Math.min(deadline ?? Infinity, clock.now().getTime() + 2000);
        await onMismatch?.(mismatch.attention);
      }
      if (clock.now().getTime() >= until) throw failure;
      if ((lease.deleteStarted || lease.state === 'releasing') && deadline !== undefined) return current;
      await wait(Math.min(100, Math.max(0, until - clock.now().getTime())));
      if (clock.now().getTime() >= until) throw failure;
      try { current = await api.droplet(lease.resource, until); }
      catch (error) {
        if (error instanceof DigitalOceanError && error.id === 'deadline') throw failure;
        throw error;
      }
    }
  } catch (error) { if (error instanceof DigitalOceanError && error.status === 404) return null; throw error; }
}

/** One bounded attempt. A failed create can still have made a resource: always discover by name. */
export async function deleteLeaseResources(api: Provider, lease: DropletLease, deadline?: number, onMismatch?: (attention: ReleaseAttention) => void | Promise<void>, deletionTimeoutMs = 300000, clock: Clock = realClock, wait: (ms: number) => Promise<void> = ms => pause(ms, clock)): Promise<{ confirmed: boolean; deleted: number[] }> {
  // The per-id response is newer and authoritative for a known resource, even
  // if a tagged listing still contains its pre-deletion metadata.
  const droplets = (await api.droplets('cland', deadline)).filter(d => d.id !== lease.resource);
  const current = await resource(api, lease, deadline, onMismatch, deletionTimeoutMs, clock, wait);
  if (current) droplets.push(current);
  const owned = droplets.filter(d => matchesLease(d, lease) && !deleting(d, lease));
  for (const droplet of owned) {
    lease.resource ??= droplet.id;
    const deletedAt = clock.now().toISOString();
    await api.deleteDroplet(droplet.id, deadline);
    lease.deleteStarted ??= deletedAt;
  }
  for (const key of await api.keys(deadline)) if (key.name === lease.keyName) { lease.keyId ??= key.id; await api.deleteKey(key.id, deadline); }
  const remaining = await api.droplets('cland', deadline);
  const remainingResource = await resource(api, lease, deadline, onMismatch, deletionTimeoutMs, clock, wait);
  const keys = await api.keys(deadline);
  // A lost create response must not let a watchdog exit before the in-flight create can settle.
  const uncertainCreate = lease.resource === null && lease.createStarted && !lease.createFinished && clock.now().getTime() < Math.max(Date.parse(lease.deadline), Date.parse(lease.createStarted) + 30000);
  const uncertainKey = lease.keyId === null && lease.keyImportStarted && !lease.keyImportFinished && clock.now().getTime() < Math.max(Date.parse(lease.deadline), Date.parse(lease.keyImportStarted) + 30000);
  return { confirmed: !uncertainCreate && !uncertainKey && !remainingResource && !remaining.some(d => matchesLease(d, lease) || d.id === lease.resource) && !keys.some(k => k.name === lease.keyName), deleted: owned.map(d => d.id) };
}
