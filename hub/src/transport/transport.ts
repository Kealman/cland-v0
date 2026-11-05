import { randomUUID } from 'node:crypto';
import { realClock, type Clock } from '../hub/clock.ts';
import type { HostRecord } from '../host/records.ts';
export { parseTransportKind } from '../host/transport-kind.ts';
export type { TransportKind } from '../host/transport-kind.ts';
export type HostTunnelStatus = {
  name: string; state: 'up' | 'connecting' | 'down'; since: string | null;
  reason?: string;
  watches?: Array<{path:string;branch:string;state:string;cause?:string}>;
  lastProbe: { at: string; ok: boolean } | null; reconnects: number;
};
/** One carrier per registered host. start admits its loop; stop joins all owned I/O.
 * wake interrupts a pending retry after machine wake. status never performs I/O. */
export interface Transport {
  readonly kind: 'ssh'; readonly host: string;
  /** Local inventory/socket release only; never invokes a mux or remote agent. */
  dropForwardLocal?(ids: readonly string[]): Promise<void>;
  start(): Promise<void>; stop(): Promise<void>; wake(): void; status(): HostTunnelStatus;
}
const watches=new Map<string,Map<string,NonNullable<HostTunnelStatus['watches']>>>();
export function updateHostWatches(root:string,host:string,rows:NonNullable<HostTunnelStatus['watches']>){
  let project=watches.get(root);if(!project){project=new Map();watches.set(root,project);}project.set(host,rows);
}
type RegisteredTransport = { transport: Transport; owner: string };
const projects = new Map<string, Map<string, RegisteredTransport>>();
const stoppedOwners = new Map<string, { root: string; host: string; ids: Set<string> }>();
export type LocalForwardOwner = { id: string; owner: string };
export function localForwardOwner(root: string, host: string): string | null { return projects.get(root)?.get(host)?.owner ?? null; }
/** Published only after the carrier joined every writer and observed local removal. */
export function noteTransportStopped(root: string, transport: Transport, ids: readonly string[]): void {
  const registered = projects.get(root)?.get(transport.host);
  if (registered?.transport !== transport) throw new Error('transport stop owner changed');
  stoppedOwners.set(registered.owner, { root, host: transport.host, ids: new Set(ids) });
}
export function claimTransport(root: string, transport: Transport): () => void {
  let hosts = projects.get(root);
  if (!hosts) { hosts = new Map(); projects.set(root, hosts); }
  if (hosts.has(transport.host)) throw new Error('host transport already owned');
  const registered = { transport, owner: randomUUID() };
  hosts.set(transport.host, registered);
  return () => { if (hosts.get(transport.host) !== registered) return; watches.get(root)?.delete(transport.host);if(!watches.get(root)?.size)watches.delete(root);hosts.delete(transport.host); if (!hosts.size) projects.delete(root); };
}
/** Sessions owns this step after adapter drain, before destination admission. */
export async function dropHostForwardsLocal(root: string, host: string, forwards: readonly LocalForwardOwner[]): Promise<void> {
  const active = projects.get(root)?.get(host);
  const pending: string[] = [];
  for (const { id, owner } of forwards) {
    if (active?.owner === owner) { pending.push(id); continue; }
    const stopped = stoppedOwners.get(owner);
    if (stopped?.root !== root || stopped.host !== host || !stopped.ids.has(id)) throw new Error(`host ${host}: local forward cleanup owner unavailable`);
  }
  if (!pending.length) return;
  if (!active?.transport.dropForwardLocal) throw new Error(`host ${host}: local forward cleanup unavailable`);
  await active.transport.dropForwardLocal(pending);
}

export function tunnelStatuses(root: string, hosts: HostRecord[]): HostTunnelStatus[] {
  return hosts.map(host => ({...(projects.get(root)?.get(host.id)?.transport.status() ?? {
    name: host.id, state: 'down', since: null, lastProbe: null, reconnects: 0,
  }),...(watches.get(root)?.get(host.id)?{watches:watches.get(root)!.get(host.id)!}:{})}));
}
/** Pure backoff policy: +/-20% jitter, hard 30s cap; uptime uses the same clock. */
export class ReconnectPolicy {
  #attempt = 0; #up: number | null = null; #observed: number | null = null;
  readonly #random: () => number; readonly #clock: Pick<Clock, 'now'>;
  constructor(clock: Pick<Clock, 'now'> = realClock, random = Math.random) { this.#clock = clock; this.#random = random; }
  failed(): number { return Math.round(Math.min(30000, Math.min(30000, 1000 * 2 ** Math.min(this.#attempt++, 5)) * (0.8 + 0.4 * this.#random()))); }
  connected(): void { const now = this.#clock.now().getTime(); this.#up = now; }
  disconnected(): void { const now = this.#clock.now().getTime(); if (this.#up !== null && now - this.#up >= 30000) this.#attempt = 0; this.#up = null; }
  observe(): boolean { const now = this.#clock.now().getTime(); const old = this.#observed; this.#observed = now; return old !== null && (now < old || now - old > 5000); }
}
