import { hostLeaseRenewable, type ProvisionRecord } from './provision-records.ts';
import type { Clock, ClockTimer } from '../hub/clock.ts';
import { earliestStop, type HostProviderDeclarationState } from './provider/declarations.ts';
import { decidePlacement, harnessWeightMilli, type PlacementHost } from './scheduler.ts';
import type { HostPools } from './pools.ts';
import type { HostRecords } from './records.ts';

export type PoolIdleLifecycle = {
  clock: Clock;
  declarations(record: ProvisionRecord): HostProviderDeclarationState | Promise<HostProviderDeclarationState>;
  destroy(id: string): Promise<unknown>;
};

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
  #configuredSettings: HostPools | undefined;
  readonly records: HostRecords;
  readonly available: (id: string) => boolean;
  readonly outageHold:(host:string)=>boolean;
  readonly onCapacityChanged: () => void;
  readonly processes: () => readonly { key: string; host?: string; harness: string }[];
  constructor(settings: () => HostPools, records: HostRecords, available: (id: string) => boolean, processes: () => readonly { key: string; host?: string; harness: string }[], onCapacityChanged: () => void = () => {}, outageHold:(host:string)=>boolean=()=>false) {
    this.outageHold=outageHold;
    this.onCapacityChanged = onCapacityChanged; this.settings = () => this.#configuredSettings ?? settings(); this.records = records; this.available = available; this.processes = processes;
  }

  #create: ((pool: string, authorize: () => void) => Promise<unknown>) | undefined;
  #flights = new Map<string, Promise<void>>();
  #failed = new Set<string>();
  #closed = false;
  #idleLifecycle: PoolIdleLifecycle | undefined;
  #idle = new Map<string, { since: number; created: string }>();
  #idleTimer: ClockTimer | undefined;
  #declarations = new Map<string, { value?: HostProviderDeclarationState; retry: number }>();
  #declarationReads = new Map<string, Promise<void>>();
  #stopping = new Map<string, Promise<unknown>>();
  start(create: (pool: string, authorize: () => void) => Promise<unknown>, idle?: PoolIdleLifecycle): void { this.#create = create; this.#idleLifecycle = idle; this.reconcile(); }

  #reconcileIdle(): void {
    const lifecycle = this.#idleLifecycle;
    if (!lifecycle) return;
    const { clock } = lifecycle, now = clock.now().getTime();
    clock.clearTimeout(this.#idleTimer);
    let next = Infinity;
    const retained = new Set<string>();
    for (const row of this.records.provisions.active()) {
      const pool = this.settings().pools[row.pool];
      if (!pool || row.state !== 'ready' || this.#stopping.has(row.id) || this.inUse(row.id)) { this.#idle.delete(row.id); continue; }
      retained.add(row.id);
      let idle = this.#idle.get(row.id);
      if (!idle || idle.created !== row.created) { idle = { since: now, created: row.created }; this.#idle.set(row.id, idle); }
      // Unavailable declarations grant no authority to stop a paid machine.
      let deadline: number;
      try {
        let cached = this.#declarations.get(row.provider);
        if (!cached || (cached.value && 'state' in cached.value && cached.retry <= now)) {
          let value: HostProviderDeclarationState | Promise<HostProviderDeclarationState>;
          try { value = lifecycle.declarations(row); }
          catch (error) { value = Promise.reject(error); }
          cached = { retry: now + 60000 };
          this.#declarations.set(row.provider, cached);
          if (value instanceof Promise) {
            const target = cached;
            const work = value.then(result => { target.value = result; }, () => { target.value = { state: 'unavailable', reason: 'provider declarations unavailable' }; }).finally(() => {
              this.#declarationReads.delete(row.provider);
              if (!this.#closed) this.reconcile();
            });
            this.#declarationReads.set(row.provider, work);
          } else cached.value = value;
        }
        const declarations = cached.value;
        if (!declarations) continue;
        if ('state' in declarations) { next = Math.min(next, cached.retry); continue; }
        deadline = earliestStop({ created: Date.parse(row.machine?.created ?? row.created), idleSince: idle.since, idleStopMs: pool.idleStopMs, declarations });
      } catch { continue; }
      if (deadline > now) { next = Math.min(next, deadline); continue; }
      // Fence placement synchronously before entering the confirmed destruction owner.
      const work = Promise.resolve().then(() => lifecycle.destroy(row.id)).catch(error => { console.error(error); }).finally(() => {
        this.#stopping.delete(row.id); this.#idle.delete(row.id);
        if (!this.#closed) { this.reconcile(); this.onCapacityChanged(); }
      });
      this.#stopping.set(row.id, work);
    }
    for (const id of this.#idle.keys()) if (!retained.has(id)) this.#idle.delete(id);
    if (Number.isFinite(next)) {
      this.#idleTimer = clock.setTimeout(() => this.reconcile(), Math.min(2 ** 31 - 1, Math.max(1, next - now)));
      this.#idleTimer.unref();
    }
  }
  configure(settings?: HostPools): void { this.#configuredSettings = settings; this.#failed.clear(); this.reconcile(); }
  reconcile(): void {
    if (this.#closed || !this.#create) return;
    this.#reconcileIdle();
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
  close(): void | Promise<void> { this.#closed = true; this.#idleLifecycle?.clock.clearTimeout(this.#idleTimer); if (this.#flights.size || this.#stopping.size || this.#declarationReads.size) return Promise.all([...this.#flights.values(), ...this.#stopping.values(), ...this.#declarationReads.values()]).then(() => {}); }

  /** One lease policy for manual, minimum and demand-created hosts. */
  inUse(host: string): boolean {
    if(this.outageHold(host))return true;
    const busy = new Set(this.processes().map(p => p.host ?? 'local'));
    for (const [id, weight] of this.#promised) if (weight > 0) busy.add(id);
    if (busy.has(host)) return true;
    const row = this.records.provisions.get(host);
    if (!row || !hostLeaseRenewable(row.state)) return false;
    const minimum = this.settings().pools[row.pool]?.minHosts ?? 0;
    const candidates = [...this.records.provisions.active()].filter(r => r.pool === row.pool && hostLeaseRenewable(r.state) && !this.#stopping.has(r.id));
    candidates.sort((a, b) => Number(busy.has(b.id)) - Number(busy.has(a.id)) || a.created.localeCompare(b.created) || a.id.localeCompare(b.id));
    return candidates.slice(0, minimum).some(r => r.id === host);
  }

  member(host: string, pool: string): boolean {
    const row = this.records.provisions.get(host);
    return !this.#stopping.has(host) && row?.pool === pool && row.state === 'ready' && this.records.get(host)?.state === 'registered' && this.available(host);
  }

  #used(weights: ReturnType<PoolRuntime['settings']>['weights'], credit?: string): Map<string,number> {
    const used = new Map<string, number>();
    const credited = new Set(this.#credits.values());
    if (credit) credited.add(credit);
    for (const p of this.processes()) if (!credited.has(p.key)) used.set(p.host ?? 'local', (used.get(p.host ?? 'local') ?? 0) + harnessWeightMilli(p.harness, weights));
    return used;
  }

  /** Occupied placement capacity, including retained generations and promises. */
  usage(host: string): {usedMilli:number;promisedMilli:number} {
    return {usedMilli:this.#used(this.settings().weights).get(host)??0,promisedMilli:this.#promised.get(host)??0};
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
    const used = this.#used(settings.weights, credit);
    const hosts: PlacementHost[] = [];
    for (const row of this.records.provisions.active()) {
      if (this.#stopping.has(row.id) || row.pool !== name || (pinned && row.id !== pinned)) continue;
      hosts.push({ id: row.id, slots: pool.slots, state: row.state === 'ready' ? (this.records.get(row.id)?.state === 'registered' && this.available(row.id) ? 'ready' : 'unavailable') : (['creating','booting','connecting','cloning'].includes(row.state) ? 'booting' : 'unavailable'), usedMilli: used.get(row.id) ?? 0, promisedMilli: this.#promised.get(row.id) ?? 0 });
    }
    const decision = decidePlacement({ hosts, harness, ...(settings.weights ? { weights: settings.weights } : {}), pool: { min_hosts: pool.minHosts, max_hosts: pool.maxHosts, spread: pool.spread } });
    if (decision.kind !== 'place') {
      throw pinned ? new Error(`host ${pinned} has no room`) : new PoolCapacityUnavailable(name, decision.kind === 'wait' ? decision.reason : 'waiting for a host', decision.kind === 'create');
    }
    const host = decision.host;
    const identity = () => {
      const provision = this.records.provisions.get(host), registration = this.records.get(host);
      if (this.#stopping.has(host) || !provision || provision.state !== 'ready' || registration?.state !== 'registered' || !this.available(host)) throw new Error(`host ${host}: placement changed; not ready`);
      return JSON.stringify([provision.id, provision.pool, provision.provider, provision.size, provision.region, provision.created, provision.machine, registration]);
    };
    const admittedIdentity = identity();
    const validate = () => { if (identity() !== admittedIdentity) throw new Error(`host ${host}: placement identity changed`); };
    const token = Symbol();
    if (credit) this.#credits.set(token, credit);
    this.#promised.set(host, (this.#promised.get(host) ?? 0) + weight);
    this.#idle.delete(host);
    let released = false;
    return { host, validate, release: () => { if (released) return; released = true; this.#credits.delete(token); const left = this.#promised.get(host)! - weight; if (left) this.#promised.set(host, left); else this.#promised.delete(host); try { this.onCapacityChanged(); } catch { /* Notification cannot undo a release. */ } } };
  }
}
