import { decidePlacement, harnessWeightMilli, type PlacementHost } from './scheduler.ts';
import type { HostPools } from './pools.ts';
import type { HostRecords } from './records.ts';

/** Launch promises bridge selection to process publication. Lifecycle owners supply live inventory. */
export class PoolRuntime {
  readonly #promised = new Map<string, number>();
  readonly #credits = new Map<symbol, string>();
  readonly settings: () => HostPools;
  readonly records: HostRecords;
  readonly available: (id: string) => boolean;
  readonly processes: () => readonly { key: string; host?: string; harness: string }[];
  constructor(settings: () => HostPools, records: HostRecords, available: (id: string) => boolean, processes: () => readonly { key: string; host?: string; harness: string }[]) {
    this.settings = settings; this.records = records; this.available = available; this.processes = processes;
  }

  member(host: string, pool: string): boolean {
    const row = this.records.provisions.get(host);
    return row?.pool === pool && row.state === 'ready' && this.records.get(host)?.state === 'registered' && this.available(host);
  }

  reserve(poolName: string, harness: string, pinned?: string, credit?: string): { host: string; validate(): void; release(): void } {
    const settings = this.settings();
    const record = pinned ? this.records.provisions.get(pinned) : null;
    const name = record?.pool ?? poolName;
    // Manually registered Hosts have no declared slot capacity; preserve their admission.
    if (pinned && !record) return { host: pinned, validate() {}, release() {} };
    if (!Object.hasOwn(settings.pools, name)) throw new Error(`unknown host pool ${name}; configured pools: local, ${Object.keys(settings.pools).join(', ')}`);
    const pool = settings.pools[name]!;
    const weight = harnessWeightMilli(harness, settings.weights);
    const used = new Map<string, number>();
    const credited = new Set(this.#credits.values());
    if (credit) credited.add(credit);
    for (const p of this.processes()) if (!credited.has(p.key)) used.set(p.host ?? 'local', (used.get(p.host ?? 'local') ?? 0) + harnessWeightMilli(p.harness, settings.weights));
    const hosts: PlacementHost[] = [];
    for (const row of this.records.provisions.registered()) {
      if (row.pool !== name || (pinned && row.id !== pinned)) continue;
      hosts.push({ id: row.id, slots: pool.slots, state: row.state === 'ready' && this.available(row.id) ? 'ready' : 'unavailable', usedMilli: used.get(row.id) ?? 0, promisedMilli: this.#promised.get(row.id) ?? 0 });
    }
    const decision = decidePlacement({ hosts, harness, ...(settings.weights ? { weights: settings.weights } : {}), pool: { min_hosts: pool.minHosts, max_hosts: pool.maxHosts, spread: pool.spread } });
    if (decision.kind !== 'place') throw new Error(pinned ? `host ${pinned} has no room` : `no host in pool ${name}`);
    const host = decision.host;
    const identity = () => {
      const provision = this.records.provisions.get(host), registration = this.records.get(host);
      if (!provision || provision.state !== 'ready' || registration?.state !== 'registered' || !this.available(host)) throw new Error(`host ${host}: placement changed; not ready`);
      return JSON.stringify([provision.id, provision.pool, provision.provider, provision.size, provision.region, provision.created, provision.machine, registration]);
    };
    const admittedIdentity = identity();
    const validate = () => { if (identity() !== admittedIdentity) throw new Error(`host ${host}: placement identity changed`); };
    const token = Symbol();
    if (credit) this.#credits.set(token, credit);
    this.#promised.set(host, (this.#promised.get(host) ?? 0) + weight);
    let released = false;
    return { host, validate, release: () => { if (released) return; released = true; this.#credits.delete(token); const left = this.#promised.get(host)! - weight; if (left) this.#promised.set(host, left); else this.#promised.delete(host); } };
  }
}
