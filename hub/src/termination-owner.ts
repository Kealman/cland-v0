// Every endProcess caller shares PID reservations, including callers in other projects.
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { acquireLockAsync, HubLocked, type AsyncHubLock } from './hub/lock.ts';
import type { Resumed } from './hub/worktrees.ts';

// Deliberately independent of project roots and TMPDIR overrides. PID reservations are
// stronger than identity reservations: a reused PID waits, then is reverified by endProcess.
const directory = join('/tmp', `cland-termination-${process.getuid?.() ?? 'user'}`);
const sleep = () => new Promise(resolve => setTimeout(resolve, 25));
// A failed local cleanup must not discard its nonce-owned handles. The process retains
// them until release succeeds; an exiting CLI leaves dead-holder recovery to the next caller.
const recovering = new Set<TerminationOwner>();
let retry: NodeJS.Timeout | null = null;
function retryReleases(): void {
  if (retry || !recovering.size) return;
  retry = setTimeout(async () => {
    await Promise.allSettled([...recovering].map(owner => owner.release()));
    retry = null;
    retryReleases();
  }, 100);
  retry.unref();
}

export class TerminationOwner {
  #locks = new Map<number, AsyncHubLock>();
  #resumed: Resumed;
  #deadline: number;
  constructor(resumed: Resumed, deadline: number) { this.#resumed = resumed; this.#deadline = deadline; }

  async #take(pid: number, deadline = this.#deadline): Promise<boolean> {
    if (this.#resumed(() => this.#locks.has(pid))) return true;
    try {
      const lock = await acquireLockAsync(join(directory, String(pid)), this.#resumed, Math.min(deadline, this.#deadline));
      return this.#resumed(() => { this.#locks.set(pid, lock); return true; });
    } catch (err) {
      if (err instanceof HubLocked) return false;
      throw err;
    }
  }

  async acquire(pids: number[]): Promise<void> {
    const ordered = this.#resumed(() => [...pids].sort((a, b) => a - b));
    await mkdir(directory, { recursive: true, mode: 0o700 });
    // Never wait with a partially reserved initial tree: overlapping root/child callers
    // must be able to finish acquiring their whole tree without a lock cycle.
    for (;;) {
      let acquired = true;
      for (const pid of ordered) {
        if (!await this.#take(pid)) { acquired = false; break; }
      }
      if (acquired) return;
      await this.release();
      await sleep();
    }
  }

  async capture(pid: number, deadline?: number): Promise<void> {
    // A newly discovered descendant cannot claim an ancestor, so it can finish while
    // this owner retains its existing tree. Keep the same inspection deadline.
    while (!await this.#take(pid, deadline)) await sleep();
  }

  async release(): Promise<void> {
    const locks = this.#resumed(() => [...this.#locks.entries()]);
    const results = await Promise.allSettled(locks.map(async ([pid, lock]) => {
      await lock.release();
      this.#resumed(() => { if (this.#locks.get(pid) === lock) this.#locks.delete(pid); });
    }));
    this.#resumed(() => {
      if (this.#locks.size) { recovering.add(this); retryReleases(); }
      else recovering.delete(this);
      const failure = results.find(result => result.status === 'rejected');
      if (failure?.status === 'rejected') throw failure.reason;
    });
  }
}
