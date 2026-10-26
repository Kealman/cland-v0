import type { PollerProcess, PollerProcesses } from '../../src/remote/poller-lease.ts';

/** Read-only native boundary: no signal/stop operation exists in the lease port. */
export function fakePollerProcesses() {
  const rows = new Map<number, PollerProcess>();
  const reads: number[] = [];
  const processes: PollerProcesses = { inspect: async pid => {
    reads.push(pid);
    return rows.get(pid) ?? { alive: false, started: null, identity: null };
  } };
  return { rows, reads, processes };
}
