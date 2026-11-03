import { realClock, type Clock } from '../hub/clock.ts';
import type { HostRecord } from '../host/records.ts';
export { parseTransportKind } from '../host/transport-kind.ts';
export type { TransportKind } from '../host/transport-kind.ts';
export type HostTunnelStatus = {
  name: string; state: 'up' | 'connecting' | 'down'; since: string | null;
  reason?: string;
  lastProbe: { at: string; ok: boolean } | null; reconnects: number;
};
/** One carrier per registered host. start admits its loop; stop joins all owned I/O.
 * wake interrupts a pending retry after machine wake. status never performs I/O. */
export interface Transport {
  readonly kind: 'ssh'; readonly host: string;
  start(): Promise<void>; stop(): Promise<void>; wake(): void; status(): HostTunnelStatus;
}
const projects = new Map<string, Map<string, Transport>>();
export function claimTransport(root: string, transport: Transport): () => void {
  let hosts = projects.get(root);
  if (!hosts) { hosts = new Map(); projects.set(root, hosts); }
  if (hosts.has(transport.host)) throw new Error('host transport already owned');
  hosts.set(transport.host, transport);
  return () => { hosts.delete(transport.host); if (!hosts.size) projects.delete(root); };
}
export function tunnelStatuses(root: string, hosts: HostRecord[]): HostTunnelStatus[] {
  return hosts.map(host => projects.get(root)?.get(host.id)?.status() ?? {
    name: host.id, state: 'down', since: null, lastProbe: null, reconnects: 0,
  });
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
