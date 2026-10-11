// The hub's process table (spec 4.3): the harness processes the hub launched, kept in `hub.db` in a table of
// its own, through a connection of its own, so a restarted hub re-finds the sessions that outlived it.
import type { Resumed } from '../hub/worktrees.ts';
import { DatabaseSync } from 'node:sqlite';
import type { HarnessProcess } from './contract.ts';
import type { LaunchFilesState } from './launch-files.ts';
import { processStartedAsync as processStarted } from '../hub/lock.ts';

export { processStarted };

/** Whether a pid is a live process (one this user may not signal counts as alive). */
export function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/**
 * Whether the process a row names is still the one the hub launched: its pid is alive and was started when the
 * row says (`ps -o lstart=`, recorded at spawn, as the hub lock does). A pid reused by another process is not it.
 * A row with no recorded start time cannot be verified: false, so nothing is ever signalled on a guess.
 */
export async function sameProcess(p: Pick<HarnessProcess, 'pid' | 'pidStarted'>, resumed: Resumed = work => work()): Promise<boolean> {
  if (p.pid === null || !pidAlive(p.pid)) return false;
  if (!p.pidStarted) return false;
  const started = await processStarted(p.pid, undefined, resumed);
  return resumed(() => started === p.pidStarted);
}

/** Whether the row's process still runs: its pid is alive and, when its start time was recorded, started then. */
export async function processAlive(p: Pick<HarnessProcess, 'pid' | 'pidStarted'>, resumed: Resumed = work => work()): Promise<boolean> {
  if (p.pid === null || !pidAlive(p.pid)) return false;
  if (!p.pidStarted) return true;
  const now = await processStarted(p.pid, undefined, resumed);
  // `ps` failing for a live pid says nothing either way
  return resumed(() => now === null || now === p.pidStarted);
}

const SCHEMA = `
create table if not exists harness_processes (
  name text primary key,
  harness text not null,
  role text,
  model text,
  cwd text not null,
  pid integer,
  harness_id text,
  session_id text not null,
  harness_session_id text,
  started_at text not null,
  status text not null,
  pid_started text,
  item text
);
create index if not exists harness_processes_session on harness_processes (session_id);
create table if not exists harness_pending_stops (
  session_id text primary key,
  recovery_json text not null
);
`;

type Row = Record<string, string | number | null>;

export type PendingStop = {
  process: HarnessProcess;
  /** An adapter failed before returning a process row. Resource undo survives hub restart. */
  files?: LaunchFilesState;
  /** Failed relaunches retain the prior conversation row for another explicit resume. */
  preserveRow?: boolean;
  error: string;
  stopIntent?: boolean;
  published?: boolean;
  priorSessionId?: string | null;
  /** Credential provenance survives disagreement between an early hello and the returned adapter identity. */
  ownership?: { credential: string; sessionIds: string[]; anonymousSessionId: string | null };
  stages: { stopped: boolean; rowRemoved: boolean; roleRolledBack: boolean };
  rollback?: { role: string; previous: string | null; previousSessionId: string | null };
};

const toProcess = (r: Row): HarnessProcess => ({
  name: r.name as string,
  harness: r.harness as string,
  role: (r.role as string | null) ?? null,
  model: (r.model as string | null) ?? null,
  cwd: r.cwd as string,
  pid: (r.pid as number | null) ?? null,
  harnessId: (r.harness_id as string | null) ?? null,
  sessionId: r.session_id as string,
  harnessSessionId: (r.harness_session_id as string | null) ?? null,
  startedAt: r.started_at as string,
  status: r.status as HarnessProcess['status'],
  pidStarted: (r.pid_started as string | null) ?? null,
  item: (r.item as string | null) ?? null,
});

export class ProcessTable {
  readonly #db: DatabaseSync;
  readonly #listeners = new Set<(process: HarnessProcess) => void>();

  constructor(path: string = ':memory:') {
    this.#db = new DatabaseSync(path);
    this.#db.exec('pragma journal_mode = wal; pragma busy_timeout = 2000;');
    this.#db.exec(SCHEMA);
    // additive, as the store's own migrations: a table written before the column existed grows in place
    const columns = new Set((this.#db.prepare('pragma table_info(harness_processes)').all() as Row[]).map((r) => r.name as string));
    if (!columns.has('harness_session_id')) this.#db.exec('alter table harness_processes add column harness_session_id text');
    if (!columns.has('pid_started')) this.#db.exec('alter table harness_processes add column pid_started text');
    if (!columns.has('item')) this.#db.exec('alter table harness_processes add column item text');
  }

  /** Every committed row change, including renames: the sessions layer publishes its public view. */
  subscribe(listener: (process: HarnessProcess) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #changed(name: string): void {
    const process = this.get(name);
    if (process) for (const listener of this.#listeners) listener(process);
  }

  close(): void {
    this.#db.close();
  }

  /** Record a launched process; a name launched again replaces its old row (the old process is gone or stopped). */
  put(p: HarnessProcess): void {
    this.#db
      .prepare(
        `insert into harness_processes (name, harness, role, model, cwd, pid, harness_id, session_id, harness_session_id, started_at, status, pid_started, item) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         on conflict (name) do update set harness = excluded.harness, role = excluded.role, model = excluded.model, cwd = excluded.cwd, pid = excluded.pid,
           harness_id = excluded.harness_id, session_id = excluded.session_id, harness_session_id = excluded.harness_session_id, started_at = excluded.started_at, status = excluded.status,
           pid_started = excluded.pid_started, item = excluded.item`,
      )
      .run(p.name, p.harness, p.role, p.model, p.cwd, p.pid, p.harnessId, p.sessionId, p.harnessSessionId, p.startedAt, p.status, p.pidStarted ?? null, p.item ?? null);
    this.#changed(p.name);
  }

  /**
   * The session `sessionId` was renamed: its row moves to the new name. A row left under that name by another
   * session that no longer runs is replaced; one that still runs keeps it (false).
   */
  rename(sessionId: string, to: string): boolean {
    const row = this.#db.prepare('select name from harness_processes where session_id = ?').get(sessionId) as Row | undefined;
    if (!row || row.name === to) return false;
    const other = this.get(to);
    if (other && other.status === 'running') return false;
    this.#db.exec('begin immediate');
    try {
      this.#db.prepare('delete from harness_processes where name = ?').run(to);
      this.#db.prepare('update harness_processes set name = ? where session_id = ?').run(to, sessionId);
      this.#db.exec('commit');
    } catch (err) {
      this.#db.exec('rollback');
      throw err;
    }
    this.#changed(to);
    return true;
  }

  update(name: string, change: Partial<Pick<HarnessProcess, 'pid' | 'harnessId' | 'harnessSessionId' | 'model' | 'status' | 'role' | 'pidStarted'>>): void {
    const sets: string[] = [];
    const values: Array<string | number | null> = [];
    const column = { pid: 'pid', harnessId: 'harness_id', harnessSessionId: 'harness_session_id', model: 'model', status: 'status', role: 'role', pidStarted: 'pid_started' } as const;
    for (const [k, v] of Object.entries(change) as Array<[keyof typeof column, string | number | null]>) {
      sets.push(`${column[k]} = ?`);
      values.push(v);
    }
    if (sets.length) {
      this.#db.prepare(`update harness_processes set ${sets.join(', ')} where name = ?`).run(...values, name);
      this.#changed(name);
    }
  }

  get(name: string): HarnessProcess | null {
    const row = this.#db.prepare('select * from harness_processes where name = ?').get(name) as Row | undefined;
    return row ? toProcess(row) : null;
  }

  /** By cland's session id, or the harness's own. */
  bySessionId(sessionId: string): HarnessProcess | null {
    const row = this.#db.prepare('select * from harness_processes where session_id = ? or harness_session_id = ? order by started_at desc limit 1').get(sessionId, sessionId) as Row | undefined;
    return row ? toProcess(row) : null;
  }

  all(): HarnessProcess[] {
    return (this.#db.prepare('select * from harness_processes order by started_at, name').all() as Row[]).map(toProcess);
  }

  running(): HarnessProcess[] {
    return this.all().filter((p) => p.status === 'running');
  }

  /** Failed launch ownership is keyed by identity, so it cannot replace a name's accepted process. */
  pendingStops(): PendingStop[] {
    return (this.#db.prepare('select recovery_json from harness_pending_stops').all() as Row[])
      .map(row => {
        const entry = JSON.parse(row.recovery_json as string) as PendingStop;
        return { ...entry, stages: entry.stages ?? { stopped: false, rowRemoved: false, roleRolledBack: false } };
      });
  }

  pendingStop(entry: PendingStop): void {
    // Quarantine and recovery ownership commit together: no crash can leave a failed launch running
    // without its cleanup receipt. Removal waits until verified exit, and can be retried independently.
    this.#db.exec('begin immediate');
    try {
      // Keep publication ownership with quarantine, including a put whose observer threw
      // after committing. A name conflict with no owned row must never end its owner's subscriptions.
      const published = entry.published || !!this.#db.prepare('select 1 from harness_processes where session_id = ?').get(entry.process.sessionId);
      this.#db.prepare('insert or replace into harness_pending_stops (session_id, recovery_json) values (?, ?)')
        .run(entry.process.sessionId, JSON.stringify({ ...entry, published, process: { ...entry.process, status: 'stopped' } }));
      if (!entry.preserveRow) this.#db.prepare("update harness_processes set status = 'stopped' where session_id = ?").run(entry.process.sessionId);
      this.#db.exec('commit');
      entry.published = published;
    } catch (error) {
      this.#db.exec('rollback');
      throw error;
    }
  }

  clearPendingStop(sessionId: string): void {
    this.#db.prepare('delete from harness_pending_stops where session_id = ?').run(sessionId);
  }

  /** Row removal and its checkpoint share a transaction: recovery never observes only one. */
  removePendingRow(entry: PendingStop): void {
    const completed = { ...entry, stages: { ...entry.stages, rowRemoved: true } };
    this.#db.exec('begin immediate');
    try {
      if (!entry.preserveRow) this.#db.prepare('delete from harness_processes where session_id = ?').run(entry.process.sessionId);
      this.#db.prepare('insert or replace into harness_pending_stops (session_id, recovery_json) values (?, ?)')
        .run(entry.process.sessionId, JSON.stringify(completed));
      this.#db.exec('commit');
    } catch (error) { this.#db.exec('rollback'); throw error; }
    entry.stages.rowRemoved = true;
  }

}
