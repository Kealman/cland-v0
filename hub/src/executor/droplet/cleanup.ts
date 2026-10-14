import { DigitalOceanApi, DigitalOceanError } from './api.ts';
import { matchesLease, type DropletLease } from './lease.ts';

/** One bounded attempt. A failed create can still have made a resource: always discover by name. */
export async function deleteLeaseResources(api: DigitalOceanApi, lease: DropletLease, deadline?: number): Promise<{ confirmed: boolean; deleted: number[] }> {
  const droplets = await api.droplets('cland', deadline);
  if (lease.resource !== null) {
    try {
      const resource = await api.droplet(lease.resource, deadline);
      if (!matchesLease(resource, lease)) throw new Error('droplet identity differs from its lease; refusing deletion');
      if (!droplets.some(d => d.id === resource.id)) droplets.push(resource);
    } catch (error) { if (!(error instanceof DigitalOceanError) || error.status !== 404) throw error; }
  }
  const owned = droplets.filter(d => matchesLease(d, lease));
  for (const droplet of owned) {
    lease.resource ??= droplet.id;
    const deletedAt = new Date().toISOString();
    await api.deleteDroplet(droplet.id, deadline);
    lease.deleteStarted ??= deletedAt;
  }
  for (const key of await api.keys(deadline)) if (key.name === lease.keyName) { lease.keyId ??= key.id; await api.deleteKey(key.id, deadline); }
  const remaining = await api.droplets('cland', deadline);
  const keys = await api.keys(deadline);
  // A lost create response must not let a watchdog exit before the in-flight create can settle.
  const uncertainCreate = lease.resource === null && lease.createStarted && !lease.createFinished && Date.now() < Math.max(Date.parse(lease.deadline), Date.parse(lease.createStarted) + 30000);
  const uncertainKey = lease.keyId === null && lease.keyImportStarted && !lease.keyImportFinished && Date.now() < Math.max(Date.parse(lease.deadline), Date.parse(lease.keyImportStarted) + 30000);
  return { confirmed: !uncertainCreate && !uncertainKey && !remaining.some(d => matchesLease(d, lease) || d.id === lease.resource) && !keys.some(k => k.name === lease.keyName), deleted: owned.map(d => d.id) };
}
