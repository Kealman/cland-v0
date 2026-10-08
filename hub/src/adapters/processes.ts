// The hub's process table (spec 4.3): the harness processes the hub launched, kept in `hub.db` in a table of
// its own, through a connection of its own, so a restarted hub re-finds the sessions that outlived it.
import { DatabaseSync } from 'node:sqlite';
import type { HarnessProcess } from './contract.ts';

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
  status text not null
);
create index if not exists harness_processes_session on harness_processes (session_id);
`;

type Row = Record<string, string | number | null>;

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
});

export class ProcessTable {
  readonly #db: DatabaseSync;

  constructor(path: string = ':memory:') {
    this.#db = new DatabaseSync(path);
    this.#db.exec('pragma journal_mode = wal; pragma busy_timeout = 2000;');
    this.#db.exec(SCHEMA);
    // additive, as the store's own migrations: a table written before the column existed grows in place
    const columns = new Set((this.#db.prepare('pragma table_info(harness_processes)').all() as Row[]).map((r) => r.name as string));
    if (!columns.has('harness_session_id')) this.#db.exec('alter table harness_processes add column harness_session_id text');
  }

  close(): void {
    this.#db.close();
  }

  /** Record a launched process; a name launched again replaces its old row (the old process is gone or stopped). */
  put(p: HarnessProcess): void {
    this.#db
      .prepare(
        `insert into harness_processes (name, harness, role, model, cwd, pid, harness_id, session_id, harness_session_id, started_at, status) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         on conflict (name) do update set harness = excluded.harness, role = excluded.role, model = excluded.model, cwd = excluded.cwd, pid = excluded.pid,
           harness_id = excluded.harness_id, session_id = excluded.session_id, harness_session_id = excluded.harness_session_id, started_at = excluded.started_at, status = excluded.status`,
      )
      .run(p.name, p.harness, p.role, p.model, p.cwd, p.pid, p.harnessId, p.sessionId, p.harnessSessionId, p.startedAt, p.status);
  }

  update(name: string, change: Partial<Pick<HarnessProcess, 'pid' | 'harnessId' | 'harnessSessionId' | 'model' | 'status'>>): void {
    const sets: string[] = [];
    const values: Array<string | number | null> = [];
    const column = { pid: 'pid', harnessId: 'harness_id', harnessSessionId: 'harness_session_id', model: 'model', status: 'status' } as const;
    for (const [k, v] of Object.entries(change) as Array<[keyof typeof column, string | number | null]>) {
      sets.push(`${column[k]} = ?`);
      values.push(v);
    }
    if (sets.length) this.#db.prepare(`update harness_processes set ${sets.join(', ')} where name = ?`).run(...values, name);
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
}
