// The journal (spec 4.2, decision #13): `.cland/journal.jsonl`, the hub's domain events as JSON lines, append-only
// across restarts. The process log (`.cland/log/hub.log`) keeps everything the hub says; the journal keeps what
// happened in the project: messages (their metadata — ids, topic, sender, addressees, length — never the text),
// deliveries moving stage, sessions and roles, claims, topics, hygiene, and the audit records (#30).
//
// Every record is `{ ts, event, … }`, the hub log's own shape: the journal is a filter over the log closure (`tap`),
// so an event is journalled by being logged, with no second call site. `write` is there for a record that is not
// a log line (the audit log calls it, or logs `{ event: 'audit', … }`, which the filter journals too).
import { closeSync, existsSync, fstatSync, openSync, readFileSync, readSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import type { LogEntry, LogFn } from '../log.ts';

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

export class Journal {
  readonly #path: string;
  readonly #now: () => Date;
  #fd: number | null;

  /** Opens `path` for appending (created when missing): a restart adds lines after the last one, never truncates. */
  constructor(path: string, now: () => Date = () => new Date()) {
    this.#path = path;
    this.#now = now;
    this.#fd = openSync(path, 'a+');
    // a previous run cut off mid-line (a crash, a full disk): the next record starts on a line of its own
    const size = fstatSync(this.#fd).size;
    if (size > 0) {
      const last = Buffer.alloc(1);
      readSync(this.#fd, last, 0, 1, size - 1);
      if (last[0] !== 0x0a) this.#writeAll('\n');
    }
  }

  /** Write all of `text`: a short write is continued until every byte is out. */
  #writeAll(text: string): void {
    if (this.#fd === null) return;
    const buf = Buffer.from(text);
    let off = 0;
    while (off < buf.length) off += writeSync(this.#fd, buf, off, buf.length - off);
  }

  get path(): string {
    return this.#path;
  }

  /** Append one record, `{ ts, event, … }` (a `ts` of its own wins). Nothing once closed. */
  write(record: { event: string } & Record<string, unknown>): void {
    if (this.#fd === null) return;
    this.#writeAll(`${JSON.stringify({ ts: this.#now().toISOString(), ...record })}\n`);
  }

  /** The log closure that also journals: every entry goes to `log`, the domain-level ones to the journal too. */
  tap(log: LogFn): LogFn {
    return (entry: LogEntry) => {
      log(entry);
      if (typeof entry.event === 'string' && JOURNALLED.has(entry.event)) {
        try {
          this.write(entry as { event: string } & Record<string, unknown>);
        } catch (err) {
          log({ event: 'journal-failed', error: err instanceof Error ? err.message : String(err) });
        }
      }
    };
  }

  close(): void {
    if (this.#fd === null) return;
    closeSync(this.#fd);
    this.#fd = null;
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
