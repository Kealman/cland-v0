import { decidePlacement, harnessWeightMilli, type PlacementHost } from './scheduler.ts';
import type { HostPools } from './pools.ts';
import type { HostRecords } from './records.ts';

export class PoolCreationNotAdmitted extends Error {}

export class PoolCapacityUnavailable extends Error {
  readonly pool: string;
  readonly reason: string;
  readonly create: boolean;
  constructor(pool: string, reason = 'waiting for a host', create = false) { super(`no host in pool ${pool}`); this.pool = pool; this.reason = reason; this.create = create; }
}

/** Launch promises bridge selection to process publication. Lifecycle owners supply live inventory. */
export class PoolRuntime {
  readonly #promised = new Map<string, number>();
  readonly #credits = new Map<symbol, string>();
  readonly settings: () => HostPools;
  readonly records: HostRecords;
  readonly available: (id: string) => boolean;
  readonly onCapacityChanged: () => void;
  readonly processes: () => readonly { key: string; host?: string; harness: string }[];
  constructor(settings: () => HostPools, records: HostRecords, available: (id: string) => boolean, processes: () => readonly { key: string; host?: string; harness: string }[], onCapacityChanged: () => void = () => {}) {
    this.onCapacityChanged = onCapacityChanged; this.settings = settings; this.records = records; this.available = available; this.processes = processes;
  }

  #create: ((pool: string, authorize: () => void) => Promise<unknown>) | undefined;
  #flights = new Map<string, Promise<void>>();
  #failed = new Set<string>();
  #closed = false;
  start(create: (pool: string, authorize: () => void) => Promise<unknown>): void { this.#create = create; this.reconcile(); }
  configure(): void { this.#failed.clear(); this.reconcile(); }
  reconcile(): void {
    if (this.#closed || !this.#create) return;
    for (const [name, pool] of Object.entries(this.settings().pools)) {
      const rows = [...this.records.provisions.active()].filter(row => row.pool === name);
      const capacity = rows.filter(row => row.state !== 'destroying').length;
      if (capacity < pool.minHosts && this.records.provisions.occupied(name) < pool.maxHosts) this.#scale(name);
    }
  }
  demand(cause: PoolCapacityUnavailable, authorize: () => void): void {
    if (cause.create) this.#scale(cause.pool, authorize);
  }
  #scale(name: string, authorize?: () => void): void {
    if (this.#closed || !this.#create || this.#flights.has(name) || this.#failed.has(name)) return;
    const pool = this.settings().pools[name];
    if (!pool || this.records.provisions.occupied(name) >= pool.maxHosts) return;
    // Capture admission before calling a creator which can synchronously publish records.
    const work = Promise.resolve().then(() => this.#create!(name, authorize ?? (() => {
      const pool = this.settings().pools[name];
      const capacity = [...this.records.provisions.active()].filter(row => row.pool === name && row.state !== 'destroying').length;
      if (!pool || capacity >= pool.minHosts) throw new Error(`pool ${name} minimum demand ended`);
    }))).then(result => {
      if ((result as {state?:string})?.state !== 'ready') this.#failed.add(name);
    }, error => { if (!(error instanceof PoolCreationNotAdmitted)) this.#failed.add(name); }).finally(() => {
      this.#flights.delete(name);
      if (!this.#closed) { this.reconcile(); this.onCapacityChanged(); }
    });
    this.#flights.set(name, work);
  }
  close(): void | Promise<void> { this.#closed = true; if (this.#flights.size) return Promise.all(this.#flights.values()).then(() => {}); }

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
    for (const row of this.records.provisions.active()) {
      if (row.pool !== name || (pinned && row.id !== pinned)) continue;
      hosts.push({ id: row.id, slots: pool.slots, state: row.state === 'ready' ? (this.records.get(row.id)?.state === 'registered' && this.available(row.id) ? 'ready' : 'unavailable') : (['creating','booting','connecting','cloning'].includes(row.state) ? 'booting' : 'unavailable'), usedMilli: used.get(row.id) ?? 0, promisedMilli: this.#promised.get(row.id) ?? 0 });
    }
    const decision = decidePlacement({ hosts, harness, ...(settings.weights ? { weights: settings.weights } : {}), pool: { min_hosts: pool.minHosts, max_hosts: pool.maxHosts, spread: pool.spread } });
    if (decision.kind !== 'place') {
      throw pinned ? new Error(`host ${pinned} has no room`) : new PoolCapacityUnavailable(name, decision.kind === 'wait' ? decision.reason : 'waiting for a host', decision.kind === 'create');
    }
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
    return { host, validate, release: () => { if (released) return; released = true; this.#credits.delete(token); const left = this.#promised.get(host)! - weight; if (left) this.#promised.set(host, left); else this.#promised.delete(host); try { this.onCapacityChanged(); } catch { /* Notification cannot undo a release. */ } } };
  }
}
