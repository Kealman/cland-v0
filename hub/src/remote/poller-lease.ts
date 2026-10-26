import { randomUUID } from 'node:crypto';
import { realClock, type Clock } from '../hub/clock.ts';
import { systemProcesses } from '../system-processes.ts';
import type { RemoteState, PollerOwner } from './state.ts';

export type PollerProcess = { alive: boolean; started: string | null; identity: string | null };
/** Inspection only. Token conflicts never authorize signalling another process. */
export type PollerProcesses = { inspect(pid: number, timeoutMs?: number): Promise<PollerProcess> };
export type GatewayLease = { acquire(signal: AbortSignal): Promise<void>; release(): void | Promise<void> };

export function nativePollerProcesses(env: NodeJS.ProcessEnv): PollerProcesses {
  return { inspect: async (pid, timeoutMs = 3000) => {
    try {
      let exited = false;
      const rows = await systemProcesses(undefined, Date.now() + Math.min(3000, timeoutMs), [pid], false, env, gone => { if (gone === pid) exited = true; });
      const row = rows.find(row => row.pid === pid);
      if (row) return { alive: true, started: row.started, identity: row.identity ?? null };
      if (exited) return { alive: false, started: null, identity: null };
      // An unreadable native identity or an incomplete process listing is not death.
      try { process.kill(pid, 0); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') return { alive: false, started: null, identity: null }; }
    } catch { /* probe errors preserve the holder; native errors may contain secrets */ }
    return { alive: true, started: null, identity: null };
  } };
}

const cancelled = () => new Error('gateway stopped while waiting for the poller lease');

/** A single project-wide owner in hub.db, independent of messenger/token values. */
export class PollerLease implements GatewayLease {
  readonly #state: RemoteState;
  readonly #clock: Clock;
  readonly #pid: number;
  readonly #processes: PollerProcesses;
  readonly #owner = randomUUID();
  #started = false;

  constructor(state: RemoteState, options: { clock?: Clock; pid?: number; processes: PollerProcesses }) {
    this.#state = state; this.#clock = options.clock ?? realClock;
    this.#pid = options.pid ?? process.pid; this.#processes = options.processes;
  }

  async acquire(signal: AbortSignal): Promise<void> {
    if (this.#started) throw new Error('poller lease already started');
    this.#started = true;
    const deadline = this.#clock.now().getTime() + 60_000;
    if (signal.aborted) throw cancelled();
    const own = await this.#processes.inspect(this.#pid, 3000);
    if (signal.aborted) throw cancelled();
    if (!own.alive || !own.started || !own.identity) throw new Error('cannot verify gateway poller process identity');
    const holder: PollerOwner = { owner: this.#owner, pid: this.#pid, started: own.started, identity: own.identity };
    for (;;) {
      if (signal.aborted) throw cancelled();
      const previous = this.#state.pollerLease();
      let available = previous === null;
      if (previous) {
        const remaining = deadline - this.#clock.now().getTime();
        if (remaining <= 0) throw new Error('gateway poller lease held for 60 seconds; another consumer of the token');
        const observed = await this.#processes.inspect(previous.pid, Math.min(3000, remaining));
        if (signal.aborted) throw cancelled();
        // Matching or unreadable birth preserves the holder, even at the same ps second.
        available = !observed.alive || !!previous.identity && !!observed.identity && observed.identity !== previous.identity;
      }
      if (this.#clock.now().getTime() <= deadline && available && this.#state.takePollerLease(holder, previous?.owner ?? null)) return;
      const remaining = deadline - this.#clock.now().getTime();
      if (remaining <= 0) throw new Error('gateway poller lease held for 60 seconds; another consumer of the token');
      await this.#wait(Math.min(1000, remaining), signal);
    }
  }

  #wait(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const abort = () => { this.#clock.clearTimeout(timer); signal.removeEventListener('abort', abort); reject(cancelled()); };
      const timer = this.#clock.setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
      timer.unref();
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    });
  }
  release(): void { this.#state.releasePollerLease(this.#owner); }
}
