import type { WaitingLaunch } from '../protocol.ts';

/** In-memory ownership seam. The durable successor can store records independently of retry closures. */
export class WaitingLaunches {
  readonly #rows = new Map<string, { row: WaitingLaunch; retry: (authorize: () => void) => Promise<void>; cancelled: boolean; flight: Promise<void> | null }>();
  #work: Promise<void> | null = null;
  #again = false;
  #closed = false;
  readonly changed: (row: WaitingLaunch, end?: string) => void;
  constructor(changed: (row: WaitingLaunch, end?: string) => void) { this.changed = changed; }
  list(): WaitingLaunch[] { return [...this.#rows.values()].map(entry => ({ ...entry.row })); }
  has(name: string): boolean { return this.#rows.has(name); }
  add(row: WaitingLaunch, retry: (authorize: () => void) => Promise<void>): void {
    if (this.has(row.name)) throw new Error(`session "${row.name}" is waiting: ${this.#rows.get(row.name)!.row.reason}`);
    this.#rows.set(row.name, { row: { ...row }, retry, cancelled: false, flight: null });
    this.changed(row);
    void this.capacityChanged();
  }
  reason(name: string, reason: string): void {
    const entry = this.#rows.get(name);
    if (!entry || entry.row.reason === reason) return;
    entry.row = { ...entry.row, reason }; this.changed(entry.row);
  }
  drop(name: string, end = 'cancelled'): WaitingLaunch | null {
    const entry = this.#rows.get(name);
    if (!entry) return null;
    entry.cancelled = true; this.#rows.delete(name); this.changed(entry.row, end);
    return entry.row;
  }
  async cancel(name: string): Promise<WaitingLaunch | null> {
    const entry = this.#rows.get(name);
    if (!entry) return null;
    entry.cancelled = true;
    await entry.flight?.catch(() => {});
    return this.drop(name);
  }
  capacityChanged(): void {
    if (this.#closed || !this.#rows.size) return;
    this.#again = true;
    if (this.#work) return;
    this.#work = Promise.resolve().then(async () => {
      while (this.#again && !this.#closed) {
        this.#again = false;
        for (const [name, entry] of this.#rows) {
          if (this.#closed) break;
          const authorize = () => { if (this.#closed || entry.cancelled || this.#rows.get(name) !== entry) throw new Error('waiting launch cancelled'); };
          const flight = Promise.resolve().then(() => { authorize(); return entry.retry(authorize); });
          entry.flight = flight;
          try { await flight; authorize(); this.#rows.delete(name); this.changed(entry.row, 'placed'); }
          catch { /* The retry owner records changed waiting reasons or a terminal refusal. */ }
          finally { entry.flight = null; }
        }
      }
    }).finally(() => {
      this.#work = null;
      // A notification can arrive after the last loop check but before this handoff.
      if (this.#again && !this.#closed) this.capacityChanged();
    });
  }
  close(): void | Promise<void> {
    this.#closed = true;
    for (const entry of this.#rows.values()) entry.cancelled = true;
    if (this.#work) return this.#work.then(() => { this.#rows.clear(); });
    this.#rows.clear();
  }
}
