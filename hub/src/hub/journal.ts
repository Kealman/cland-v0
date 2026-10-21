// The journal (spec 4.2, decision #13): `.cland/journal.jsonl`, the hub's domain events as JSON lines, append-only
// across restarts. The process log (`.cland/log/hub.log`) keeps everything the hub says; the journal keeps what
// happened in the project: messages (their metadata — ids, topic, sender, addressees, length — never the text),
// deliveries moving stage, sessions and roles, claims, topics, hygiene, and the audit records (#30).
//
// Every record is `{ ts, event, … }`, the hub log's own shape: the journal is a filter over the log closure (`tap`),
// so an event is journalled by being logged, with no second call site. `write` is there for a record that is not
// a log line (the audit log calls it, or logs `{ event: 'audit', … }`, which the filter journals too).
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { open } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import type { EventKind, EventRow, EventsPage } from '../protocol.ts';
import type { LogEntry, LogFn } from '../log.ts';
import type { RequestGuard, Resumed } from './budget.ts';

/** The journal's file name inside `.cland/`. */
export const JOURNAL_FILE = 'journal.jsonl';

export const journalPath = (clandDir: string): string => join(clandDir, JOURNAL_FILE);

/**
 * The hub log's events that are domain-level, and so journalled. What is left out is the process's own talk:
 * listeners, sockets, keepalives, subscriptions, adapter retries, file-watch errors.
 */
export const JOURNALLED: ReadonlySet<string> = new Set([
  'executor-snapshot-recovered',
  'executor-prepared',
  'executor-prepare-failed',
  'executor-reaped',
  'executor-sweep',
  'verification-executor-fallback',
  'verification-executor-reclaimed',
  'verification-sharding-skipped',
  'verification-cleanup-incomplete',
  'executor-watchdog-fired',
  'executor-watchdog-rearmed',
  'executor-lease-released',
  'executor-lease-active',
  'executor-release-unconfirmed',
  'executor-release-retry',
  'executor-reconcile-failed',
  'verification-timing',
  'verification-wait',
  'verification-cover-classified',
  'verification-admitted',
  'verification-submission',
  'verification-human-queued',
  'verification-human-admitted',
  'verification-human-left',
  'verification-forced',
  'event-announced',
  'suite-result',
  // the hub's life
  'hub-started',
  'hub-stopped',
  'config-loaded',
  'config-reloaded',
  'config-reload-failed',
  'config-reload-warning',
  'config-unreadable',
  // messages (metadata only) and their deliveries
  'event-delivery',
  'event-limited',
  'send',
  'send-refused',
  'human-send',
  'acked',
  'injected',
  'dropped',
  'digest-released',
  'inject-uncertain',
  'inject-retry',
  'role-queue-claimed',
  // sessions
  'hello',
  'bye',
  'rename',
  'replaced',
  'kick',
  'refused-role',
  'session-launched',
  'session-model',
  'session-usage',
  'account-limits',
  'account-limited',
  'account-limit-lifted',
  'account-polled',
  'account-poll-failed',
  'subagent-launched',
  'session-reused',
  'session-archived',
  'sessions-pruned',
  'session-unarchived',
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
  'claude-signed-out',
  'harness-redelivered',
  'harness-redelivery-failed',
  'harness-turn-unread',
  'session-state',
  // roles
  'role-assigned',
  'role-taken-at-launch',
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
  'tracker-storage-stalled',
  'tracker-storage-fatal',
  'tracker-storage-abandoned',
  'task-plan-changed',
  'task-plan-approved',
  'task-qa-migrated',
  'task-migrated',
  'task-qa-migration-fallback',
  'task-plan-refused',
  'task-unreadable',
  'task-parenting-warning',
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
  'merge-criteria-overridden',
  'epic-close-overridden',
  'merge-cleanup-failed',
  'task-worktree',
  'task-worktree-failed',
  'task-worktree-removed',
  'worktree-refused',
  // asks and the inbox (#33)
  'ask',
  'ask-answered',
  'ask-forwarded',
  'ask-withdrawn',
  'ask-cancelled',
  'notification',
  'inbox-departure',
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

/** One recorded child launch, attributed to its parent session and item. */
export type SubagentRecord = {
  ts: string; session: string; sessionId: string; harness: string; model: string;
  agentId?: string; agentType?: string;
};

export class Journal {
  #revision = 0;
  /** Changes synchronously when a producer accepts a record, before async disk I/O. */
  get revision(): number { return this.#revision; }
  readonly #path: string;
  readonly #now: () => Date;
  readonly #report: LogFn;
  readonly #guard: RequestGuard | undefined;
  #file: JournalFile | null = null;
  #tail: Promise<void>;
  #error: Error | null = null;
  #closing: Promise<void> | null = null;
  readonly #subagents = new Map<string, SubagentRecord[]>();

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
      // Restore once before queued producers append. Item reads must never scan
      // the accumulated journal again, or a crew's read burst pins the hub.
      if (size) await this.#restoreSubagents(size, resumed);
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
    this.#revision++;
    const bytes = Buffer.from(`${JSON.stringify({ ts: this.#now().toISOString(), ...record })}\n`);
    const child = record.event === 'subagent-launched' ? JSON.parse(bytes.toString()) as JournalRecord : null;
    const resumed = this.#resumer('journal.append');
    this.#tail = this.#tail.then(async () => {
      if (this.#error) return;
      await resumed(() => this.#writeAll(bytes, resumed));
      if (child) resumed(() => this.#rememberSubagent(child));
    })
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

  /** Read fixed-size blocks backwards; a cursor excludes the last returned row's start byte. */
  async events(before?: string, limit = 200, project: (row: EventRow, record: JournalRecord) => EventRow | null = row => row): Promise<EventsPage> {
    const resumed = this.#resumer('events.list');
    await this.flush();
    const file = this.#file!;
    const size = (await resumed(() => file.stat())).size;
    const continuation = before?.startsWith('events:') ? JSON.parse(Buffer.from(before.slice(7), 'base64url').toString()) : null;
    if (continuation && (!Array.isArray(continuation.skip) || continuation.skip.some((v: unknown) => !Array.isArray(v) || typeof v[0] !== 'string' || !Array.isArray(v[1]) || typeof v[1][0] !== 'number' || typeof v[1][1] !== 'number'))) throw new Error('invalid events cursor');
    let end = continuation ? continuation.end : before === undefined ? size : Number(before);
    if (!Number.isSafeInteger(end) || end < 0 || end > size) throw new Error('invalid events cursor');
    const rows: EventRow[] = [];
    let cursor: string | null = null;
    let overflow: number | undefined;
    const excluded = new Map<string, [number, number]>(continuation?.skip ?? []);
    const groups = new Map<string, EventRow>();
    const result = (more: boolean): EventsPage => ({ rows, more, before: overflow === undefined ? cursor : 'events:' + Buffer.from(JSON.stringify({ end: overflow, skip: [...excluded, ...rows.map(r => [eventKey(r), [Date.parse(r.ts), Date.parse(r.firstTs ?? r.ts)]] as const)] })).toString('base64url') });
    const accept = (record: JournalRecord, start: number, end: number): boolean => {
      const raw = eventRow(record, String(start));
      const row = raw && project(raw, record);
      if (!row) return false;
      const time = Date.parse(row.ts), key = eventKey(row);
      for (const [k, range] of excluded) if (range[1] - time > 60000) excluded.delete(k);
      const skipped = excluded.get(key);
      if (skipped !== undefined && skipped[1] - time <= 60000 && skipped[0] >= time) return false;
      if (skipped !== undefined) excluded.delete(key);
      const group = groups.get(key);
      if (group && Date.parse(group.firstTs ?? group.ts) - time <= 60000 && Date.parse(group.ts) >= time) {
        group.count = (group.count ?? 1) + 1;
        group.firstTs = row.ts;
        if (overflow === undefined) cursor = String(start);
        return false;
      }
      if (rows.length < cap) {
        groups.set(key, row); rows.push(row); cursor = String(start);
        return false;
      }
      overflow ??= end;
      // Finish every selected group's 60-second window before returning. Interleaved
      // rows remain behind the cursor; excluded groups prevent cross-page duplicates.
      return time < Math.min(...rows.map(r => Date.parse(r.firstTs ?? r.ts))) - 60000;
    };
    let suffix = Buffer.alloc(0);
    let skipLine = false;
    const cap = Math.min(200, Math.max(1, limit));
    while (end > 0) {
      const start = Math.max(0, end - 32768);
      const block = Buffer.alloc(end - start);
      let got = 0;
      while (got < block.length) {
        const read = await resumed(() => file.read(block, got, block.length - got, start + got));
        if (!read.bytesRead) throw new Error('journal read made no progress');
        got += read.bytesRead;
      }
      const page = resumed((): EventsPage | undefined => {
        const data = Buffer.concat([block, suffix]);
        let lineEnd = data.length;
        for (let i = data.length - 1; i >= 0; i--) {
          if (data[i] !== 10) continue;
          const lineStart = i + 1;
          if (!skipLine && lineStart < lineEnd) {
            let record: JournalRecord | undefined;
            try { record = JSON.parse(data.subarray(lineStart, lineEnd).toString()); } catch { /* damaged/partial records are skipped */ }
            if (record && accept(record, start + lineStart, start + lineEnd)) return result(true);
          }
          skipLine = false;
          lineEnd = i;
        }
        suffix = data.subarray(0, lineEnd);
        // A damaged or oversized record cannot make the reader retain the whole file.
        if (skipLine || suffix.length > 1024 * 1024) { suffix = Buffer.alloc(0); skipLine = true; }
      });
      if (page) return page;
      end = start;
    }
    if (!skipLine && suffix.length) {
      try {
        accept(JSON.parse(suffix.toString()), 0, suffix.length);
      } catch { /* damaged records are skipped */ }
    }
    return result(overflow !== undefined);
  }

  #rememberSubagent(r: JournalRecord): void {
    if (!r || r.event !== 'subagent-launched' || typeof r.item !== 'string') return;
    if (typeof r.ts !== 'string' || typeof r.session !== 'string' || typeof r.sessionId !== 'string' || typeof r.harness !== 'string') return;
    const rows = this.#subagents.get(r.item) ?? [];
    rows.push({ ts: r.ts, session: r.session, sessionId: r.sessionId, harness: r.harness,
      model: typeof r.model === 'string' && r.model ? r.model : 'unreported',
      ...(typeof r.agentId === 'string' ? { agentId: r.agentId } : {}),
      ...(typeof r.agentType === 'string' ? { agentType: r.agentType } : {}),
    });
    this.#subagents.set(r.item, rows);
  }

  async #restoreSubagents(size: number, resumed: Resumed): Promise<void> {
    const input = resumed(() => createReadStream(this.#path, { end: size - 1 }));
    const lines = createInterface({ input, crlfDelay: Infinity });
    try {
      for await (const line of lines) resumed(() => {
        let r: JournalRecord;
        try { r = JSON.parse(line); } catch { return; }
        this.#rememberSubagent(r);
      });
    } finally {
      lines.close();
      input.destroy();
    }
  }

  /** Child models restored once at startup, then indexed after each successful append. */
  async subagents(item: string): Promise<SubagentRecord[]> {
    await this.flush();
    return (this.#subagents.get(item) ?? []).map(row => ({ ...row }));
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

/** Translate announced rows and usable historical domain records; no database backfill. */
export function eventRow(r: JournalRecord, offset = ''): EventRow | null {
  if (!r || typeof r.ts !== 'string' || !Number.isFinite(Date.parse(r.ts))) return null;
  const value = (key: string) => typeof r[key] === 'string' ? r[key] as string : undefined;
  let kind: EventKind;
  let subject: EventRow['subject'] | undefined;
  let text = value('text');
  let glyph = '●';
  const item = value('item'), session = value('session') ?? value('name') ?? (r.event === 'role-handover' ? value('to') : undefined), topic = value('topic'), artifact = value('artifact');
  if (r.event === 'event-announced') {
    // Hub-written verdicts also journal their richer notification (reviewer and
    // run). Keep the task announcement for subscribers, but project it only for
    // file-authored verdicts, which have no notification. This applies to old
    // journals as well as live pushes, before filtering or 60-second grouping.
    if (r.kind === 'task' && r.verdict && (r.verdict as { source?: string }).source !== 'file') return null;
    const announced = r.subject as Record<string, string> | undefined;
    if (!announced) return null;
    kind = r.kind === 'session.state' ? 'session' : r.kind === 'task' && r.verdict ? 'verdict' : r.kind as EventKind;
    if (r.lifecycle === 'waiting for approval') return null;
    subject = announced.rule ? { kind: 'rule', id: announced.rule } : artifact ? { kind: 'artifact', id: artifact } : announced.item ? { kind: 'item', id: announced.item } : announced.session ? { kind: 'session', id: announced.session } : announced.topic ? { kind: 'topic', id: announced.topic } : undefined;
  } else if (r.event === 'notification') {
    kind = r.kind === 'executor-fallback' ? 'suite' : r.kind === 'verdict' ? 'verdict' : r.kind === 'release' ? 'release' : r.kind === 'plan' ? 'task' : 'session';
    subject = item ? { kind: 'item', id: item } : session ? { kind: 'session', id: session } : undefined;
  } else if (r.event === 'tracker-storage-fatal') {
    kind = 'task'; subject = item ? { kind: 'item', id: item } : { kind: 'topic', id: 'agents' }; glyph = '⚠';
  } else if (r.event === 'verification-cleanup-incomplete') {
    kind = 'suite'; subject = item ? { kind: 'item', id: item } : topic ? { kind: 'topic', id: topic } : undefined;
    text = `verify ${r.id}: ${r.cause}`; glyph = '⚠';
  } else if (r.event === 'suite-result' || (r.event === 'verification-timing' && r.outcome)) {
    kind = 'suite'; subject = item ? { kind: 'item', id: item } : session ? { kind: 'session', id: session } : topic ? { kind: 'topic', id: topic } : undefined;
    const outcome = r.outcome as { code?: number; cause?: string };
    text = `${r.mode} · ${r.branch} · ${outcome.code === 0 ? 'passed' : 'failed'} · ${String(r.counts ?? 'counts unavailable').split('\n')[0]}`;
    glyph = outcome.code === 0 ? '✓' : '✗';
  } else if (r.event === 'released') {
    kind = 'release'; subject = item ? { kind: 'item', id: item } : { kind: 'topic', id: topic ?? 'general' };
    text ??= `released ${r.version ?? r.tag ?? ''}`;
  } else {
    // New session/task/topic events have their own one-line announcement.
    if (r.eventsVersion && !['session-resumed', 'task-merged', 'merge-resumed', 'topic-created', 'topic-status', 'task-plan-changed', 'task-plan-approved'].includes(r.event)) return null;
    if (r.eventsVersion && r.event === 'topic-status' && ['waiting for human', 'closed'].includes(String(r.to))) return null;
    if (['session-launched', 'session-resumed', 'session-stopped', 'session-archived', 'session-unarchived', 'harness-exited', 'harness-ended', 'session-state', 'role-handover'].includes(r.event)) {
      kind = 'session'; subject = session ? { kind: 'session', id: session } : undefined;
      text ??= `${session} ${r.event.replace('session-', '')}${r.state ? ` ${r.state}` : ''}`;
    } else if (['task-claimed', 'task-merged', 'merge-resumed', 'task-plan-changed', 'task-plan-approved'].includes(r.event)) {
      kind = 'task'; const id = item ?? value('id'); subject = id ? { kind: 'item', id } : undefined;
      text ??= r.event === 'task-claimed' ? `${id} claimed by ${session ?? r.by ?? '?'}` : r.event.startsWith('task-plan-') ? `${id} ${r.event.replace('task-', '').replaceAll('-', ' ')} by ${r.by ?? '?'}` : `${id} merged onto ${r.base ?? 'dev'}`;
    } else if (['topic-created', 'topic-status'].includes(r.event)) {
      kind = 'topic'; const id = topic ?? value('id'); subject = id ? { kind: 'topic', id } : undefined;
      text ??= `${id} ${r.to ?? r.status ?? 'created'}`;
    } else return null;
  }
  if (!subject || !text || !['session','task','verdict','suite','release','artifact','usage','topic','heartbeat','rule'].includes(kind)) return null;
  if (kind === 'artifact') glyph = 'A';
  else if (kind === 'usage') glyph = '$';
  else if (kind === 'release') glyph = '◈';
  else if (r.kind === 'executor-fallback' || r.kind === 'account-limited') glyph = '⚠';
  else if (kind === 'verdict') glyph = (r.verdict as { result?: string } | undefined)?.result === 'not clear' || r.result === 'not clear' || text.includes('not clear') ? '⚠' : '✓';
  else if (kind === 'suite') { /* the outcome above owns the suite glyph */ }
  else if (kind === 'session' && (r.lifecycle === 'died' || r.kind === 'death' || /died|harness-exited/.test(text))) glyph = '⚠';
  else if (kind === 'session' && /launched|resumed/.test(text)) glyph = '▶';
  else if (kind === 'session' && /stopped/.test(text)) glyph = '■';
  else if (kind === 'session' && /idle/.test(text)) glyph = '○';
  else if (kind === 'session' && /handover|handed .* over/.test(text)) glyph = '⇄';
  else if (kind === 'task' && /claimed/.test(text)) glyph = '⚑';
  else if (kind === 'task' && /plan/.test(text)) glyph = '▤';
  else if (kind === 'task' && /criterion|criteria/.test(text)) glyph = '◐';
  else if (kind === 'task' && /status/.test(text)) glyph = '◉';
  const warning = r.severity === 'warn' || glyph === '⚠' || kind === 'suite' && r.branch === 'dev' && glyph === '✗';
  const bookkeeping = !warning && (['session-launched', 'session-resumed', 'session-stopped', 'task-claimed'].includes(r.event) || kind === 'session' && /launched|resumed|stopped/.test(text) || kind === 'task' && /claimed|status changed|criterion|criteria/.test(text) || kind === 'topic' && /closed/.test(text));
  return { ...(warning ? { warning: true } : {}), ...(bookkeeping ? { bookkeeping: true } : {}), id: value('rowId') ?? `journal:${offset}`, ts: r.ts, kind, subject, text: text.replace(/[\r\n]+/g, ' '), glyph: warning ? '⚠' : glyph, ...(item ? { item } : {}), ...(session ? { session } : {}), ...(topic ? { topic } : {}), ...(artifact ? { artifact } : {}), [subject.kind]: subject.id };
}

/** Equality is the announced kind, subject and one-line content; presentation is not part of it. */
export function eventKey(row: EventRow): string {
  return createHash('sha256').update(JSON.stringify([row.kind, row.subject, row.text, ...(['heartbeat', 'rule'].includes(row.kind) ? [row.id] : [])])).digest('hex');
}
