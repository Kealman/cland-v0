import { realClock, type Clock } from '../../hub/clock.ts';
import type { Provider } from './dependencies.ts';
import { DeletionUnconfirmed, DigitalOceanError, type Droplet } from './api.ts';
import { mergeDeletions, matchesLease, type DropletLease, type ReleaseAttention } from './lease.ts';
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

const trackedLease = (lease: DropletLease, row: { id: number; started?: string }): DropletLease => {
  const view = { ...lease, resource: row.id };
  delete view.deleteStarted;
  if (row.started) view.deleteStarted = row.started;
  return view;
};

/** One bounded attempt. A failed create can still have made a resource: always discover by name. */
export async function deleteLeaseResources(api: Provider, lease: DropletLease, deadline?: number, onMismatch?: (attention: ReleaseAttention) => void | Promise<void>, deletionTimeoutMs = 300000, clock: Clock = realClock, wait: (ms: number) => Promise<void> = ms => pause(ms, clock), checkpoint: () => Promise<void> = async () => {}): Promise<{ confirmed: boolean; deleted: number[] }> {
  const tracking = mergeDeletions(lease);
  const discover = async () => {
    for (const d of await api.droplets('cland', deadline)) if (matchesLease(d, lease) && !tracking.droplets.some(row => row.id === d.id)) tracking.droplets.push({ id: d.id });
    for (const k of await api.keys(deadline)) if (k.name === lease.keyName && !tracking.keys.includes(k.id)) tracking.keys.push(k.id);
    // Record every discovered identity before starting any mutation.
    await checkpoint();
  };
  await discover();
  const deleted: number[] = [];
  for (const row of tracking.droplets) {
    const view = trackedLease(lease, row);
    const current = await resource(api, view, deadline, onMismatch, deletionTimeoutMs, clock, wait);
    if (!current || !matchesLease(current, view) || deleting(current, view)) continue;
    lease.resource ??= row.id;
    const deletedAt = clock.now().toISOString();
    const accepted = async () => {
      row.started ??= deletedAt;
      lease.deleteStarted ??= deletedAt;
      await checkpoint();
    };
    try { await api.deleteDroplet(row.id, deadline, accepted); await accepted(); }
    catch (error) { if (!(error instanceof DeletionUnconfirmed)) throw error; if (error.accepted) await accepted(); }
    deleted.push(row.id);
  }
  for (const id of tracking.keys) {
    let key;
    try { key = await api.key(id, deadline); }
    catch (error) { if (error instanceof DigitalOceanError && error.status === 404) continue; throw error; }
    if (key.id !== id || key.name !== lease.keyName) throw new Error('SSH key identity differs from its lease; refusing deletion');
    lease.keyId ??= id;
    try { await api.deleteKey(id, deadline); }
    catch (error) { if (!(error instanceof DeletionUnconfirmed)) throw error; }
  }
  await discover();
  let pending: ReleaseAttention | undefined;
  // Lists can discover identities, but only per-id 404 can discharge them.
  for (const row of tracking.droplets) {
    const view = trackedLease(lease, row);
    const current = await resource(api, view, deadline, onMismatch, deletionTimeoutMs, clock, wait);
    if (current) pending = { reason: 'deletion-unconfirmed', fields: [], expected: { id: row.id, name: lease.name, tags: lease.tags }, observed: { id: current.id, name: current.name, tags: [...current.tags], status: current.status } };
  }
  for (const id of tracking.keys) {
    try { const key = await api.key(id, deadline); pending = { reason: 'deletion-unconfirmed', fields: [], expected: { id, name: lease.keyName, tags: [] }, observed: { id: key.id, name: key.name, tags: [], status: 'present' } }; }
    catch (error) { if (!(error instanceof DigitalOceanError) || error.status !== 404) throw error; }
  }
  const uncertainCreate = lease.resource === null && lease.createStarted && !lease.createFinished && clock.now().getTime() < Math.max(Date.parse(lease.deadline), Date.parse(lease.createStarted) + 30000);
  const uncertainKey = lease.keyId === null && lease.keyImportStarted && !lease.keyImportFinished && clock.now().getTime() < Math.max(Date.parse(lease.deadline), Date.parse(lease.keyImportStarted) + 30000);
  if (pending) { lease.attention = pending; await onMismatch?.(pending); }
  return { confirmed: !pending && !uncertainCreate && !uncertainKey, deleted };
}
