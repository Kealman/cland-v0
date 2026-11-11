import { loginVerdict } from './login-verdicts.ts';
import type { ProvisionLoginDemand } from './login-binding.ts';
import { HostProviderRetry } from './boot-gate.ts';
import { hostLeaseRenewable, type ProvisionRecord } from './provision-records.ts';
import type { Clock, ClockTimer } from '../hub/clock.ts';
import { earliestStop, type HostProviderDeclarationState } from './provider/declarations.ts';
import { decidePlacement, harnessWeightMilli, type PlacementHost } from './scheduler.ts';
import type { HostPools } from './pools.ts';
import type { HostRecords } from './records.ts';

// Acquisition ownership excludes mutable settlement/readiness checkpoints.
const provisionOwnership = (row:ProvisionRecord):string => JSON.stringify([row.id,row.pool,row.provider,row.size,row.region,row.created,row.machine,row.acquisition]);

export type PoolIdleLifecycle = {
  clock: Clock;
  busyHost?(id: string): boolean;
  failed?(record: ProvisionRecord): void;
  declarations(record: ProvisionRecord): HostProviderDeclarationState | Promise<HostProviderDeclarationState>;
  destroy(id: string): Promise<unknown>;
};

export class PoolCreationNotAdmitted extends Error {}

export class PoolCapacityUnavailable extends Error {
  readonly pool: string;
  readonly reason: string;
  readonly create: boolean;
  readonly harness: string | undefined;
  readonly account: string | null;
  constructor(pool: string, reason = 'waiting for a host', create = false, harness?: string, account: string|null=null) { super(`no host in pool ${pool}`); this.pool = pool; this.reason = reason; this.create = create; this.harness = harness; this.account = account; }
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

  #create: ((pool: string, authorize: () => void, demand?:()=>readonly ProvisionLoginDemand[]) => Promise<unknown>) | undefined;
  #demand:((pool:string)=>readonly ProvisionLoginDemand[])|undefined;
  #flights = new Map<string, Promise<void>>();
  #failed = new Set<string>();
  #retries = new Map<string, { count: number; until: number; timer: ClockTimer }>();
  #providerRetries = new Map<string, {until:number;timer:ClockTimer}>();
  #closed = false;
  #poolSettings = new Map<string,string>();
  #unsubscribeLogins: (() => void) | undefined;
  #unsubscribeReady: (() => void) | undefined;
  #idleLifecycle: PoolIdleLifecycle | undefined;
  #idle = new Map<string, { since: number; created: string }>();
  #idleTimer: ClockTimer | undefined;
  #declarations = new Map<string, { value?: HostProviderDeclarationState; retry: number }>();
  #declarationReads = new Map<string, Promise<void>>();
  #stopping = new Map<string, Promise<unknown>>();
  start(create: (pool: string, authorize: () => void, demand?:()=>readonly ProvisionLoginDemand[]) => Promise<unknown>, idle?: PoolIdleLifecycle, demand?: (pool:string)=>readonly ProvisionLoginDemand[]): void { this.#create = create; this.#demand = demand; this.#idleLifecycle = idle;
    this.#poolSettings = new Map(Object.entries(this.settings().pools).map(([name,pool])=>[name,JSON.stringify(pool)]));
    this.#unsubscribeReady?.();
    this.#unsubscribeReady = this.records.provisions.onChange((id,_previous,state)=>{
      if(state!=='ready')return;
      const pool=this.records.provisions.get(id)?.pool;
      if(pool){this.#idleLifecycle?.clock.clearTimeout(this.#retries.get(pool)?.timer);this.#retries.delete(pool);this.#failed.delete(pool);}
    });
    this.#unsubscribeLogins?.();
    this.#unsubscribeLogins=this.records.logins.onChange(()=>{if(!this.#closed)this.onCapacityChanged();});
    this.reconcile(); }

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
  configure(settings?: HostPools): void {
    this.#configuredSettings = settings;
    for (const [name, retry] of this.#retries) {
      if (this.#poolSettings.get(name) === JSON.stringify(this.settings().pools[name])) continue;
      this.#idleLifecycle?.clock.clearTimeout(retry.timer); this.#retries.delete(name);
    }
    this.#poolSettings = new Map(Object.entries(this.settings().pools).map(([name,pool])=>[name,JSON.stringify(pool)]));
    this.#failed.clear(); this.reconcile();
  }
  #retry(name: string, retryAt?: string): void {
    const clock = this.#idleLifecycle?.clock;
    if (!clock) { this.#failed.add(name); return; }
    if (retryAt && Number.isFinite(Date.parse(retryAt))) {
      clock.clearTimeout(this.#providerRetries.get(name)?.timer);
      const until=Math.max(clock.now().getTime()+1,Date.parse(retryAt));
      const wake=()=>{
        const remaining=until-clock.now().getTime();
        if(remaining>0){const timer=clock.setTimeout(wake,Math.min(2**31-1,remaining));timer.unref();this.#providerRetries.set(name,{until,timer});return;}
        this.#providerRetries.delete(name);
        if(!this.#closed){this.reconcile();this.onCapacityChanged();}
      };
      const timer=clock.setTimeout(wake,Math.min(2**31-1,until-clock.now().getTime()));timer.unref();
      this.#providerRetries.set(name,{until,timer});return;
    }
    const previous = this.#retries.get(name);
    clock.clearTimeout(previous?.timer);
    const count = (previous?.count ?? 0) + 1;
    const until = clock.now().getTime() + Math.min(1800000, 60000 * 2 ** Math.min(5, count - 1));
    const timer = clock.setTimeout(() => { if (!this.#closed) { this.reconcile(); this.onCapacityChanged(); } }, Math.min(2 ** 31 - 1, until - clock.now().getTime()));
    timer.unref(); this.#retries.set(name, {count, until, timer});
  }
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
    if (cause.create) this.#scale(cause.pool, () => {
      authorize();
      const pool=this.settings().pools[cause.pool];
      if(cause.harness && (!pool || !this.records.logins.selectCapacityLogin({harness:cause.harness,provider:pool.provider,region:pool.region,account:cause.account})))throw new PoolCreationNotAdmitted('login capacity changed');
    });
  }
  #scale(name: string, authorize?: () => void): void {
    if (this.#closed || !this.#create || this.#flights.has(name) || this.#failed.has(name)) return;
    const pool = this.settings().pools[name];
    if (Math.max(this.#retries.get(name)?.until ?? 0,this.#providerRetries.get(name)?.until ?? 0) > (this.#idleLifecycle?.clock.now().getTime() ?? 0)) return;
    if (!pool || this.records.provisions.occupied(name) >= pool.maxHosts) return;
    // Capture admission before calling a creator which can synchronously publish records.
    const work = Promise.resolve().then(() => this.#create!(name, authorize ?? (() => {
      const pool = this.settings().pools[name];
      const capacity = [...this.records.provisions.active()].filter(row => row.pool === name && row.state !== 'destroying').length;
      if (!pool || capacity >= pool.minHosts) throw new Error(`pool ${name} minimum demand ended`);
    }),()=>this.#demand?.(name)??[])).then(async result => {
      if (this.#closed) return;
      const row = result as ProvisionRecord & { retryAt?: string };
      if (row?.state === 'ready') {
        this.#idleLifecycle?.clock.clearTimeout(this.#retries.get(name)?.timer); this.#retries.delete(name);
      } else if (row?.state === 'failed' || row?.retryAt) {
        if (row?.machine && !row.retryAt) {
          let notice:ProvisionRecord|undefined=row;
          let retry=true;
          const ownership=provisionOwnership(row);
          try {
            if(!this.#idleLifecycle)throw Error('host cleanup owner unavailable');
            const deleted=await this.#idleLifecycle.destroy(row.id) as ProvisionRecord|undefined;
            if(deleted?.state!=='destroyed')throw Error('host deletion not confirmed');
          } catch {
            // A cleanup refusal retains this record; other slots still follow backoff.
            const current=this.records.provisions.get(row.id);
            const owned=current && provisionOwnership(current)===ownership;
            if(!owned || current.state==='ready')retry=false;
            if(owned && (current.state==='failed'||current.state==='destroying') && current.release!=='released'){
              const retained:ProvisionRecord={...current,state:'failed',release:'incomplete',failure:{code:'cleanup-unavailable'},reason:'host cleanup unavailable; machine retained'};
              this.records.provisions.save(retained);
              notice=current.failure?.code==='cleanup-unavailable'?undefined:retained;
            } else notice=undefined;
          }
          if(retry)this.#retry(name);
          if(notice)this.#idleLifecycle?.failed?.(notice);
        } else this.#retry(name,row?.retryAt);
      } else this.#failed.add(name);
    }, error => { if (!(error instanceof PoolCreationNotAdmitted)) this.#retry(name, error instanceof HostProviderRetry ? error.retryAt : undefined); }).catch(error => { if (!this.#failed.has(name) && !(error instanceof PoolCreationNotAdmitted)) this.#retry(name); }).finally(() => {
      this.#flights.delete(name);
      if (!this.#closed) { this.reconcile(); this.onCapacityChanged(); }
    });
    this.#flights.set(name, work);
  }
  close(): void | Promise<void> { this.#closed = true; this.#unsubscribeReady?.(); this.#unsubscribeLogins?.(); for(const retry of this.#providerRetries.values()) this.#idleLifecycle?.clock.clearTimeout(retry.timer); for (const retry of this.#retries.values()) this.#idleLifecycle?.clock.clearTimeout(retry.timer); this.#idleLifecycle?.clock.clearTimeout(this.#idleTimer); if (this.#flights.size || this.#stopping.size || this.#declarationReads.size) return Promise.all([...this.#flights.values(), ...this.#stopping.values(), ...this.#declarationReads.values()]).then(() => {}); }

  /** One lease policy for manual, minimum and demand-created hosts. */
  inUse(host: string): boolean {
    if(this.#idleLifecycle?.busyHost?.(host))return true;
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

  reserve(poolName: string, harness: string, pinned?: string, credit?: string, account: string|null=null): { host: string; validate(): void; release(): void } {
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
    const decision = decidePlacement({ hosts, harness, verdict: host => {const row=this.records.provisions.get(host.id)!;return loginVerdict(this.records.logins, {host:host.id,harness,provider:row.provider,region:row.region,account});}, canCreate: () => this.records.logins.selectCapacityLogin({harness,provider:pool.provider,region:pool.region,account}) !== null, ...(settings.weights ? { weights: settings.weights } : {}), pool: { min_hosts: pool.minHosts, max_hosts: pool.maxHosts, spread: pool.spread } });
    if (decision.kind !== 'place') {
      throw pinned ? new Error(`host ${pinned} has no room`) : new PoolCapacityUnavailable(name, decision.kind === 'wait' ? decision.reason : 'waiting for a host', decision.kind === 'create', harness, account);
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
