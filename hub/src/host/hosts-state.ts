import { liveHostAccrual } from './live-accrual.ts';
import { isDeepStrictEqual } from 'node:util';
import type { HostsStatePool } from '../protocol.ts';
import type { Clock, ClockTimer } from '../hub/clock.ts';
import type { HostRecords } from './records.ts';
import type { ProvisionRecord } from './provision-records.ts';
import type { HostPools } from './pools.ts';

type Options = {
  clock: Clock; records: HostRecords; settings(): HostPools;
  processes(): readonly { name: string; host?: string; status: string }[];
  usage(id: string): { usedMilli: number; promisedMilli: number };
  price(row: ProvisionRecord): number | null;
  outage(id: string): string | null;
  failure(pool: string): string | null;
  publish(rows: HostsStatePool[]): void;
};
/** Cached client projection over current inventory; snapshots perform no provider I/O. */
export class HostsState {
  readonly #o: Options;
  #rows: HostsStatePool[] = [];
  #timer: ClockTimer | undefined;
  #minute: ClockTimer | undefined;
  #at = -Infinity;
  #spendAt = 0;
  #closed = false;
  #loginDirty = false;
  #unsubscribers: (() => void)[] = [];
  constructor(options: Options) { this.#o = options; }
  read = (): HostsStatePool[] => this.#rows;
  async start(): Promise<void> {
    this.#unsubscribers = [this.#o.records.provisions.onChange(this.changed), this.#o.records.logins.onChange(() => {
      this.#loginDirty = true;
      this.changed();
    })];
    if (this.#closed) return;
    this.#spendAt=this.#o.clock.now().getTime();
    this.#flush();
    this.#minute = this.#o.clock.setInterval(() => {
      if ([...this.#o.records.provisions.currentInventory()].length) { this.#spendAt=this.#o.clock.now().getTime(); this.changed(); }
    }, 60_000);
    this.#minute.unref();
  }
  changed = (): void => {
    if (this.#closed || this.#timer) return;
    this.#timer = this.#o.clock.setTimeout(() => { this.#timer = undefined; this.#flush(); }, Math.max(1, 1000 - (this.#o.clock.now().getTime() - this.#at)));
    this.#timer.unref();
  };
  #flush(): void {
    const o = this.#o, settings = o.settings(), now = o.clock.now().getTime();
    const day = Date.parse(new Date(this.#spendAt).toISOString().slice(0,10) + 'T00:00:00Z');
    const inventory = [...o.records.provisions.currentInventory()];
    const processes = o.processes();
    const rows: HostsStatePool[] = Object.entries(settings.pools).sort(([a],[b]) => a.localeCompare(b)).map(([name,pool]) => {
      const provisions = inventory.filter(row => row.pool === name);
      const hosts = provisions.map(row => {
        const priceHourly = o.price(row);
        const created = row.machine?.created ?? row.created;
        return { id: row.id, size: row.size, region: row.region, state: row.state, created,
          sessions: processes.filter(p => p.host === row.id && p.status === 'running').map(p => p.name).sort(), priceHourly,
          spendToday: liveHostAccrual(row,priceHourly,this.#spendAt,day) };
      });
      const outage = provisions.find(row => o.outage(row.id));
      const failure = o.failure(name);
      const alert: HostsStatePool['alert'] = outage ? {kind:'outage',host:outage.id,since:o.outage(outage.id)!} : failure ? {kind:'provider',reason:failure} : null;
      return {name,provider:pool.provider,region:pool.region,hostCount:hosts.length,maxHosts:pool.maxHosts,
        slotsUsed:provisions.reduce((sum,row) => { const usage=o.usage(row.id); return sum+(usage.usedMilli+usage.promisedMilli)/1000; },0),
        slotsTotal:hosts.length*pool.slots,logins:o.records.logins.poolSummary(pool.provider,pool.region,provisions.map(row=>row.id)),alert,hosts};
    });
    // Login metadata is read through login.list. Its consumers need this
    // invalidation even when a binding swap preserves every aggregate count.
    if (isDeepStrictEqual(rows,this.#rows) && this.#at !== -Infinity && !this.#loginDirty) return;
    this.#loginDirty = false;
    this.#rows=rows; this.#at=now; o.publish(rows);
  }
  async close(): Promise<void> {
    this.#closed=true;
    for (const unsubscribe of this.#unsubscribers) unsubscribe();
    this.#o.clock.clearTimeout(this.#timer); this.#o.clock.clearInterval(this.#minute);
  }
}
