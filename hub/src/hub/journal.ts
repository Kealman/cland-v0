// The journal (spec 4.2, decision #13): `.cland/journal.jsonl`, the hub's domain events as JSON lines, append-only
// across restarts. The process log (`.cland/log/hub.log`) keeps everything the hub says; the journal keeps what
// happened in the project: messages (their metadata — ids, topic, sender, addressees, length — never the text),
// deliveries moving stage, sessions and roles, claims, topics, hygiene, and the audit records (#30).
//
// Every record is `{ ts, event, … }`, the hub log's own shape: the journal is a filter over the log closure (`tap`),
// so an event is journalled by being logged, with no second call site. `write` is there for a record that is not
// a log line (the audit log calls it, or logs `{ event: 'audit', … }`, which the filter journals too).
import { existsSync, readFileSync } from 'node:fs';
import { open } from 'node:fs/promises';
import { join } from 'node:path';
import type { LogEntry, LogFn } from '../log.ts';
import type { RequestGuard, Resumed } from './budget.ts';

/** The journal's file name inside `.cland/`. */
export const JOURNAL_FILE = 'journal.jsonl';

export const journalPath = (clandDir: string): string => join(clandDir, JOURNAL_FILE);

/**
 * The hub log's events that are domain-level, and so journalled. What is left out is the process's own talk:
 * listeners, sockets, heartbeats, subscriptions, adapter retries, file-watch errors.
 */
export const JOURNALLED: ReadonlySet<string> = new Set([
  // the hub's life
  'hub-started',
  'hub-stopped',
  'config-loaded',
  // messages (metadata only) and their deliveries
  'send',
  'send-refused',
  'human-send',
  'acked',
  'injected',
  'dropped',
  'role-queue-claimed',
  // sessions
  'hello',
  'bye',
  'rename',
  'replaced',
  'kick',
  'refused-role',
  'session-launched',
  'session-stopped',
  'session-resumed',
  'harness-exited',
  'harness-ended',
  'orphan-ended',
  'orphan-preserved',
  'orphan-sweep-failed',
  'orphan-sweep-started',
  'orphan-sweep-completed',
  'turn-failed',
  'harness-redelivered',
  'harness-redelivery-failed',
  'harness-turn-unread',
  'session-state',
  // roles
  'role-assigned',
  'role-cleared',
  'role-clause',
  'role-revoked',
  'role-handover',
  'coordinator-vacant',
  'coordinator-filled',
  // topics
  'topic-created',
  'topic-status',
  // the tracker
  'task-written',
  'task-claimed',
  'task-released',
  'task-conflict',
  'task-removed',
  // task worktrees (T-58)
  'released',
  'release-preview',
  'release-refused',
  'synced',
  'sync-refused',
  'dev-pushed',
  'push-refused',
  'push-outcome-unknown',
  'task-merged',
  'merge-resumed',
  'merge-follow-up-failed',
  'merge-recovery-pending',
  'merge-refused',
  'merge-cleanup-failed',
  'task-worktree',
  'task-worktree-failed',
  'task-worktree-removed',
  'worktree-refused',
  // asks and the inbox (#33)
  'ask',
  'ask-answered',
  'ask-withdrawn',
  'ask-cancelled',
  'notification',
  // hygiene
  'loop-breaker',
  'unmuted',
  'rate-limited',
  // the audit log (#30) and the Agents record's notices
  'audit',
  'refusal',
]);

export type JournalRecord = { ts: string; event: string } & Record<string, unknown>;

/** The native append boundary, injectable to exercise delayed/short/failed disk writes. */
export type JournalFile = {
  stat: () => Promise<{ size: number }>;
  read: (buffer: Buffer, offset: number, length: number, position: number) => Promise<{ bytesRead: number }>;
  write: (buffer: Buffer, offset: number, length: number) => Promise<{ bytesWritten: number }>;
  close: () => Promise<void>;
};
export type JournalOpen = (path: string) => Promise<JournalFile>;

export class Journal {
  readonly #path: string;
  readonly #now: () => Date;
  readonly #report: LogFn;
  readonly #guard: RequestGuard | undefined;
  #file: JournalFile | null = null;
  #tail: Promise<void>;
  #error: Error | null = null;
  #closing: Promise<void> | null = null;

  constructor(path: string, now: () => Date = () => new Date(), options: { open?: JournalOpen; log?: LogFn; guard?: RequestGuard } = {}) {
    this.#path = path;
    this.#now = now;
    this.#report = options.log ?? (() => {});
    this.#guard = options.guard;
    const resumed = this.#resumer('journal.open');
    this.#tail = (async () => {
      const opening = resumed(() => this.#attempt(() => (options.open ?? (path => open(path, 'a+')))(path)));
      const file = await opening;
      const stats = resumed(() => this.#attempt(() => { this.#file = file; return file.stat(); }));
      const { size } = await stats;
      const reading = resumed(() => this.#attempt(() => {
        if (size === 0) return null;
        const last = Buffer.alloc(1);
        return { last, pending: file.read(last, 0, 1, size - 1) };
      }));
      if (reading) {
        await reading.pending;
        await resumed(() => reading.last[0] !== 0x0a ? this.#writeAll(Buffer.from('\n'), resumed) : undefined);
      }
    })().catch(err => resumed(() => { if (err !== this.#error) this.#failed(err); }));
  }

  #resumer(tool: string): Resumed { return this.#guard?.resumer(tool) ?? (work => work()); }

  #failed(err: unknown): void {
    this.#error = err instanceof Error ? err : new Error(String(err));
    try { this.#report({ event: 'journal-failed', path: this.#path, error: this.#error.message }); }
    catch { /* reporting failure must not reject the queue or prevent handle cleanup */ }
  }

  /** Native initiation can throw before returning a promise: report inside its caller's scope. */
  #attempt<T>(work: () => T): T {
    try { return work(); }
    catch (err) { this.#failed(err); throw this.#error; }
  }

  /** Called inside one resumed scope; every next write begins in the preceding write's resumed continuation. */
  async #writeAll(buf: Buffer, resumed: Resumed): Promise<void> {
    let off = 0;
    let writing: Promise<{ bytesWritten: number }> | null = this.#attempt(() => this.#file!.write(buf, 0, buf.length));
    while (writing) {
      const result = await writing;
      writing = resumed(() => this.#attempt(() => {
        if (result.bytesWritten <= 0) throw new Error('journal append made no progress');
        off += result.bytesWritten;
        return off < buf.length ? this.#file!.write(buf, off, buf.length - off) : null;
      }));
    }
  }

  get path(): string { return this.#path; }

  /** Enqueue a serialized record in call order. Accepted records drain on close; no durability acknowledgement. */
  write(record: { event: string } & Record<string, unknown>): void {
    if (this.#closing || this.#error) return;
    const bytes = Buffer.from(`${JSON.stringify({ ts: this.#now().toISOString(), ...record })}\n`);
    const resumed = this.#resumer('journal.append');
    this.#tail = this.#tail.then(() => resumed(() => this.#error ? undefined : this.#writeAll(bytes, resumed)))
      .catch(err => resumed(() => { if (err !== this.#error) this.#failed(err); }));
  }

  tap(log: LogFn): LogFn {
    return (entry: LogEntry) => {
      log(entry);
      if (typeof entry.event === 'string' && JOURNALLED.has(entry.event)) {
        try { this.write(entry as { event: string } & Record<string, unknown>); }
        catch (err) { log({ event: 'journal-failed', error: err instanceof Error ? err.message : String(err) }); }
      }
    };
  }

  /** Drain records accepted before this call without closing the sink. Later producers may keep appending. */
  async flush(): Promise<void> {
    await this.#tail;
    if (this.#error) throw this.#error;
  }

  /** Drain once, then close the handle. Failure is reported and rejects stop rather than claiming a flush. */
  close(): Promise<void> {
    if (this.#closing) return this.#closing;
    const resumed = this.#resumer('journal.close');
    this.#closing = (async () => {
      await this.#tail;
      const closing = resumed(() => {
        try { return this.#file?.close(); }
        catch (err) {
          // A native initiation error and its report belong to this same continuation.
          this.#file = null;
          this.#failed(err);
          throw this.#error;
        }
      });
      let failure: unknown;
      try { await closing; } catch (err) { failure = err; }
      return resumed(() => {
        if (failure !== undefined) this.#failed(failure);
        this.#file = null;
        if (this.#error) throw this.#error;
      });
    })();
    return this.#closing;
  }

}

export type JournalQuery = {
  /** Records at or after this instant (ISO, or a duration back from now: `10m`, `2h`, `1d`). */
  since?: string;
  /** Only these events (`send`, `loop-breaker`, `audit`, …). */
  kinds?: string[];
};

/** `10m`, `2h`, `3d`, `30s` back from `now`; an ISO date as given; null when it is neither. */
export function sinceInstant(since: string, now: Date = new Date()): Date | null {
  const m = /^(\d+)\s*(s|m|h|d)$/.exec(since.trim());
  if (m) {
    const unit = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2] as 's' | 'm' | 'h' | 'd'];
    return new Date(now.getTime() - Number(m[1]) * unit);
  }
  const d = new Date(since);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Read the journal's records, oldest first, filtered; a line that does not parse is skipped. */
export function readJournal(path: string, query: JournalQuery = {}, now: Date = new Date()): JournalRecord[] {
  if (!existsSync(path)) return [];
  let since: Date | null = null;
  if (query.since !== undefined) {
    since = sinceInstant(query.since, now);
    if (!since) throw new Error(`--since ${query.since}: not a time (an ISO date, or 30s, 10m, 2h, 1d)`);
  }
  const kinds = query.kinds?.length ? new Set(query.kinds) : null;
  const out: JournalRecord[] = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let r: JournalRecord;
    try {
      r = JSON.parse(line) as JournalRecord;
    } catch {
      continue;
    }
    if (since && !(new Date(r.ts).getTime() >= since.getTime())) continue;
    if (kinds && !kinds.has(r.event)) continue;
    out.push(r);
  }
  return out;
}
