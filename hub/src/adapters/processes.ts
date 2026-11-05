import { createHash } from 'node:crypto';
import { realClock, type Clock } from '../hub/clock.ts';
// The hub's process table (spec 4.3): the harness processes the hub launched, kept in `hub.db` in a table of
// its own, through a connection of its own, so a restarted hub re-finds the sessions that outlived it.
import type { Resumed } from '../hub/worktrees.ts';
import { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../database.ts';
import type { HarnessProcess } from './contract.ts';
import type { SessionUsage } from '../protocol.ts';
import { hostBootChanged } from '../host/process-host.ts';
import type { LaunchFilesState } from './launch-files.ts';
import { processIdentityAsync, type IdentityExited } from '../process-identity.ts';
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
 * Whether a live PID still has the native birth identity captured at launch.
 * Legacy whole-second timestamps alone provide no signalling authority.
 */
export async function sameProcess(p: Pick<HarnessProcess, 'pid' | 'pidStarted' | 'pidIdentity'>, resumed: Resumed = work => work(), env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  if (p.pid === null || !pidAlive(p.pid)) return false;
  if (!p.pidIdentity) return false;
  const identity = await processIdentityAsync(p.pid, env);
  return resumed(() => identity !== null && identity === p.pidIdentity);
}

/** Whether the row still runs: native exited states are absent; unreadable live proof stays conservative.
 * Synthetic callers may inject identity observation; omitted observers retain native exit reporting. */
export async function processAlive(p: Pick<HarnessProcess, 'pid' | 'pidStarted' | 'pidIdentity'>, resumed: Resumed = work => work(), env: NodeJS.ProcessEnv = process.env, readStarted: (pid: number, resumed: Resumed) => Promise<string | null> = (pid, resumed) => processStarted(pid, undefined, resumed, undefined, env), readIdentity: (pid: number, reportExited: IdentityExited) => Promise<string | null> = (pid, reportExited) => processIdentityAsync(pid, env, undefined, reportExited)): Promise<boolean> {
  if (p.pid === null || !pidAlive(p.pid)) return false;
  let exited = false;
  const identity = await readIdentity(p.pid, () => { exited = true; });
  if (resumed(() => exited)) return false;
  if (p.pidIdentity) {
    return resumed(() => identity === null || identity === p.pidIdentity);
  }
  if (!p.pidStarted) return true;
  const now = await readStarted(p.pid, resumed);
  // `ps` failing for a live pid says nothing either way
  return resumed(() => now === null || now === p.pidStarted);
}

const SCHEMA = `
create table if not exists harness_processes (
  name text primary key,
  host text not null default 'local',
  harness text not null,
  role text,
  model text,
  account text,
  account_env text,
  cwd text not null,
  pid integer,
  harness_id text,
  session_id text not null,
  harness_session_id text,
  started_at text not null,
  status text not null,
  pid_started text,
  pid_identity text,
  item text,
  brief text,
  effort text,
  stopped_at text,
  archived_at text,
  archived_by text,
  usage text
);
create index if not exists harness_processes_session on harness_processes (session_id);
create table if not exists harness_pending_stops (
  session_id text primary key,
  recovery_json text not null
);
`;

type Row = Record<string, string | number | null>;

/** Positive old-boot native closure; never permission to signal or erase retained files. */
export type HostRebooted = {bootId: string; launchGeneration?: string};

export type PendingStop = {
  process: HarnessProcess;
  /** An adapter failed before returning a process row. Resource undo survives hub restart. */
  files?: LaunchFilesState;
  /** Failed relaunches retain the prior conversation row for another explicit resume. */
  preserveRow?: boolean;
  /** A failed explicit fresh resume restores its stopped launch row after cleanup. */
  restoreRow?: HarnessProcess;
  error: string;
  stopIntent?: boolean;
  /** Preserves all undo while fencing native/file retries after a proven boot change. */
  hostRebooted?: HostRebooted;
  published?: boolean;
  priorSessionId?: string | null;
  /** Credential provenance survives disagreement between an early hello and the returned adapter identity. */
  ownership?: { credential: string; sessionIds: string[]; anonymousSessionId: string | null };
  stages: { stopped: boolean; rowRemoved: boolean; roleRolledBack: boolean };
  rollback?: { role: string; previous: string | null; previousSessionId: string | null };
};

const toProcess = (r: Row): HarnessProcess => ({
  name: r.name as string,
  host: (r.host as string | null) ?? 'local',
  harness: r.harness as string,
  role: (r.role as string | null) ?? null,
  model: (r.model as string | null) ?? null,
  cwd: r.cwd as string,
  pid: (r.pid as number | null) ?? null,
  harnessId: (r.harness_id as string | null) ?? null,
  sessionId: r.session_id as string,
  harnessSessionId: (r.harness_session_id as string | null) ?? null,
  startedAt: r.started_at as string,
  stoppedAt: (r.stopped_at as string | null) ?? null,
  archivedAt: (r.archived_at as string | null) ?? null,
  archivedBy: (r.archived_by as HarnessProcess['archivedBy']) ?? null,
  status: r.status as HarnessProcess['status'],
  pidStarted: (r.pid_started as string | null) ?? null,
  pidIdentity: (r.pid_identity as string | null) ?? null,
  item: (r.item as string | null) ?? null,
  cleanupItem: (r.cleanup_item as string | null) ?? null,
  cleanupHeldAt: (r.cleanup_held_at as string | null) ?? null,
  launchBrief: (r.brief as string | null) ?? null,
  account: (r.account as string | null) ?? null,
  accountEnv: r.account_env ? JSON.parse(r.account_env as string) as Record<string, string> : null,
  effort: (r.effort as string | null) ?? null,
  usage: r.usage ? JSON.parse(r.usage as string) as SessionUsage : null,
});

export const hostGenerationKey=(p:Pick<HarnessProcess,'sessionId'|'host'|'harness'|'startedAt'|'pid'|'pidIdentity'>):string=>createHash('sha256').update(JSON.stringify([p.sessionId,p.host??'local',p.harness,p.startedAt,p.pid,p.pidIdentity??null])).digest('hex');
export type RetainedHostGeneration = {generation:string;process: HarnessProcess; nativeClosure: 'confirmed' | 'unknown'; hostRebooted?: HostRebooted};

export class ProcessTable {
  readonly #clock: Clock;
  readonly #db: DatabaseSync;
  readonly #listeners = new Set<(process: HarnessProcess, archived: number) => void>();

  constructor(path: string = ':memory:', clock: Clock = realClock, open = (path: string) => new DatabaseSync(path)) {
    this.#clock = clock;
    this.#db = openDatabase(path, open);
    this.#db.exec('pragma journal_mode = wal;');
    this.#db.exec(SCHEMA);
    // additive, as the store's own migrations: a table written before the column existed grows in place
    const columns = new Set((this.#db.prepare('pragma table_info(harness_processes)').all() as Row[]).map((r) => r.name as string));
    if (!columns.has('host_retired')) this.#db.exec('alter table harness_processes add column host_retired integer not null default 0');
    if (!columns.has('host')) this.#db.exec("alter table harness_processes add column host text not null default 'local'");
    if (!columns.has('harness_session_id')) this.#db.exec('alter table harness_processes add column harness_session_id text');
    if (!columns.has('pid_identity')) this.#db.exec('alter table harness_processes add column pid_identity text');
    if (!columns.has('pid_started')) this.#db.exec('alter table harness_processes add column pid_started text');
    if (!columns.has('brief')) this.#db.exec('alter table harness_processes add column brief text');
    for (const column of ['account', 'account_env']) if (!columns.has(column)) this.#db.exec(`alter table harness_processes add column ${column} text`);
    if (!columns.has('effort')) this.#db.exec('alter table harness_processes add column effort text');
    // Old stopped rows remain undated: no journal backfill on startup.
    for (const column of ['stopped_at', 'archived_at', 'archived_by']) if (!columns.has(column)) this.#db.exec(`alter table harness_processes add column ${column} text`);
    this.#db.exec("create index if not exists harness_processes_host on harness_processes(host, status, archived_at)");
    this.#db.exec('create table if not exists harness_host_reboot_closures (generation text primary key, closure_json text not null)');
    this.#db.exec(`create table if not exists harness_host_retirements (
      session_id text primary key, host text not null, process_json text not null
    ); create index if not exists harness_host_retirements_host on harness_host_retirements(host);
    create index if not exists harness_processes_host_harness_status on harness_processes(host,harness,status,host_retired);`);
    if(!this.#db.prepare('pragma table_info(harness_host_retirements)').all().some(row=>row.name==='owner_session_id'))this.#db.exec('alter table harness_host_retirements add column owner_session_id text');
    this.#db.exec('create index if not exists harness_host_retirements_owner on harness_host_retirements(owner_session_id);create index if not exists harness_host_retirements_host_owner on harness_host_retirements(host,owner_session_id)');
    if (!columns.has('item')) this.#db.exec('alter table harness_processes add column item text');
    if (!columns.has('cleanup_item')) this.#db.exec('alter table harness_processes add column cleanup_item text');
    if (!columns.has('cleanup_held_at')) this.#db.exec('alter table harness_processes add column cleanup_held_at text');
    // Older rows carry no usage: absent stays null, never zero.
    if (!columns.has('usage')) this.#db.exec('alter table harness_processes add column usage text');
  }

  /** Every committed row change, including renames: the sessions layer publishes its public view. */
  subscribe(listener: (process: HarnessProcess, archived: number) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #changed(name: string, archived?: number): void {
    const process = this.get(name);
    if (process && this.#listeners.size) {
      const count = archived ?? this.archivedCount();
      for (const listener of this.#listeners) listener(process, count);
    }
  }

  close(): void {
    this.#db.close();
  }

  /** Preserve old terminal ownership before a display row can disappear or be reused. */
  #preserveTerminalHostGeneration(p: HarnessProcess): void {
    if(p.harness!=='opencode'||(p.host??'local')==='local'||!['stopped','exited'].includes(p.status))return;
    const row=this.#db.prepare('select host_retired from harness_processes where name=? and session_id=? and started_at=? and pid is ? and pid_identity is ?').get(p.name,p.sessionId,p.startedAt,p.pid,p.pidIdentity??null);
    if(!row||row.host_retired||this.#hasRetirement(p))return;
    this.retainHostGeneration(p,'unknown');
  }

  /** Record a launched process; a name launched again replaces its old row (the old process is gone or stopped). */
  put(p: HarnessProcess): void {
    const previous=this.get(p.name);
    if(previous&&hostGenerationKey(previous)!==hostGenerationKey(p))this.#preserveTerminalHostGeneration(previous);
    this.#db
      .prepare(
        `insert into harness_processes (host, name, harness, role, model, cwd, pid, harness_id, session_id, harness_session_id, started_at, status, pid_started, pid_identity, item, brief, effort, stopped_at, archived_at, archived_by, cleanup_item, cleanup_held_at, account, account_env, usage) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         on conflict (name) do update set host_retired = 0, host = excluded.host, harness = excluded.harness, role = excluded.role, model = excluded.model, cwd = excluded.cwd, pid = excluded.pid,
           harness_id = excluded.harness_id, session_id = excluded.session_id, harness_session_id = excluded.harness_session_id, started_at = excluded.started_at, status = excluded.status,
           pid_started = excluded.pid_started, pid_identity = excluded.pid_identity, item = excluded.item, brief = excluded.brief, effort = excluded.effort, stopped_at = excluded.stopped_at, archived_at = excluded.archived_at, archived_by = excluded.archived_by, cleanup_item = excluded.cleanup_item, cleanup_held_at = excluded.cleanup_held_at, account = excluded.account, account_env = excluded.account_env, usage = excluded.usage`,
      )
      .run(p.host ?? 'local', p.name, p.harness, p.role, p.model, p.cwd, p.pid, p.harnessId, p.sessionId, p.harnessSessionId, p.startedAt, p.status, p.pidStarted ?? null, p.pidIdentity ?? null, p.item ?? null, p.launchBrief ?? null, p.effort ?? null, p.stoppedAt ?? null, p.archivedAt ?? null, p.archivedBy ?? null, p.cleanupItem ?? null, p.cleanupHeldAt ?? null, p.account ?? null, p.accountEnv ? JSON.stringify(p.accountEnv) : null, p.usage ? JSON.stringify(p.usage) : null);
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
      if(other)this.#preserveTerminalHostGeneration(other);
      this.#db.prepare('delete from harness_processes where name = ?').run(to);
      this.#db.prepare('update harness_processes set name = ? where session_id = ?').run(to, sessionId);
      const renamed=this.get(to)!;
      for(const retained of this.#db.prepare('select * from harness_host_retirements where owner_session_id=? or (owner_session_id is null and session_id=?)').iterate(sessionId,sessionId)) {
        const receipt=this.#readRetirement(retained);
        if(receipt.generation===hostGenerationKey(renamed))this.#db.prepare('update harness_host_retirements set process_json=? where session_id=?').run(JSON.stringify({...receipt.process,name:to}),retained.session_id!);
      }
      this.#db.exec('commit');
    } catch (err) {
      this.#db.exec('rollback');
      throw err;
    }
    this.#changed(to);
    return true;
  }

  update(name: string, change: Partial<Pick<HarnessProcess, 'pid' | 'harnessId' | 'harnessSessionId' | 'model' | 'status' | 'role' | 'pidStarted' | 'pidIdentity' | 'stoppedAt' | 'archivedAt' | 'archivedBy' | 'cleanupItem' | 'cleanupHeldAt'>>): void {
    if (change.status && change.status !== 'running' && change.stoppedAt === undefined) change = { ...change, stoppedAt: this.#clock.now().toISOString() };
    const sets: string[] = [];
    const values: Array<string | number | null> = [];
    const column = { pid: 'pid', harnessId: 'harness_id', harnessSessionId: 'harness_session_id', model: 'model', status: 'status', role: 'role', pidStarted: 'pid_started', pidIdentity: 'pid_identity', stoppedAt: 'stopped_at', archivedAt: 'archived_at', archivedBy: 'archived_by', cleanupItem: 'cleanup_item', cleanupHeldAt: 'cleanup_held_at' } as const;
    for (const [k, v] of Object.entries(change) as Array<[keyof typeof column, string | number | null]>) {
      sets.push(`${column[k]} = ?`);
      values.push(v);
    }
    if (sets.length) {
      this.#db.prepare(`update harness_processes set ${sets.join(', ')} where name = ?`).run(...values, name);
      this.#changed(name);
    }
  }

  /** Keep the latest reported totals on the row itself: they outlive this hub, a stop and an archive. */
  recordUsage(sessionId: string, usage: SessionUsage): void {
    this.#db.prepare('update harness_processes set usage = ? where session_id = ?').run(JSON.stringify(usage), sessionId);
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

  /** Indexed placement query; revoke does not materialize other hosts' retained history. */
  activeOnHost(host: string): HarnessProcess[] {
    return (this.#db.prepare("select * from harness_processes where host = ? and status = 'running' and archived_at is null").all(host) as Row[]).map(toProcess);
  }

  /** Reboot retirement streams stopped generations; display status alone grants no closure. */
  *stoppedOnHost(host: string): Generator<HarnessProcess> {
    for (const row of this.#db.prepare("select * from harness_processes where host = ? and status = 'stopped'").iterate(host)) yield toProcess(row as Row);
  }

  #readRetirement(row: Record<string, unknown>): RetainedHostGeneration {
    const p=JSON.parse(String(row.process_json)) as HarnessProcess&{nativeClosure?:'confirmed'|'unknown';hostRebooted?:HostRebooted};
    // Old storage keys were stable session ids and old receipts were positive stops only.
    const nativeClosure=p.nativeClosure??'confirmed', generation=hostGenerationKey(p);
    if(p.sessionId!==(row.owner_session_id??row.session_id)||p.host!==row.host
      ||(row.owner_session_id!=null&&row.session_id!==generation)
      ||!['confirmed','unknown'].includes(nativeClosure)||p.status!==(nativeClosure==='confirmed'?'stopped':'exited'))throw new Error('retained host generation ownership mismatch');
    if(p.hostRebooted&&!hostBootChanged(p.pidIdentity,p.hostRebooted.bootId))throw new Error('retained reboot closure proof mismatch');
    return {generation,process:p,nativeClosure,...(p.hostRebooted?{hostRebooted:p.hostRebooted}:{})};
  }

  #hasRetirement(p: HarnessProcess): boolean {
    if(this.#db.prepare('select 1 from harness_host_retirements where session_id=?').get(hostGenerationKey(p)))return true;
    const old=this.#db.prepare('select * from harness_host_retirements where session_id=? and owner_session_id is null').get(p.sessionId);
    return !!old&&this.#readRetirement(old).generation===hostGenerationKey(p);
  }

  /** Metadata-only retirement, keyed by captured native generation rather than stable session id. */
  retainHostGeneration(p: HarnessProcess, nativeClosure: 'confirmed' | 'unknown' = 'confirmed', hostRebooted?: HostRebooted): void {
    if(hostRebooted&&!hostBootChanged(p.pidIdentity,hostRebooted.bootId))throw new Error('host boot closure proof mismatch');
    const key=hostGenerationKey(p);
    const identity={name:p.name,host:p.host??'local',harness:p.harness,sessionId:p.sessionId,
      startedAt:p.startedAt,pid:p.pid,pidStarted:p.pidStarted??null,pidIdentity:p.pidIdentity??null,
      harnessId:p.harnessId,harnessSessionId:p.harnessSessionId,cwd:p.cwd,role:p.role,model:p.model};
    const exact=this.#db.prepare('select * from harness_host_retirements where session_id=?').get(key);
    const old=this.#db.prepare('select * from harness_host_retirements where session_id=? and owner_session_id is null').get(p.sessionId);
    hostRebooted ??= (exact&&this.#readRetirement(exact).hostRebooted)||(old&&this.#readRetirement(old).generation===key&&this.#readRetirement(old).hostRebooted)||undefined;
    hostRebooted ??= this.hostGenerationRebooted(p);
    if(hostRebooted){nativeClosure='confirmed';this.#retainHostRebootFence(p,hostRebooted);}
    if((exact&&this.#readRetirement(exact).nativeClosure==='confirmed')||(old&&this.#readRetirement(old).generation===key&&this.#readRetirement(old).nativeClosure==='confirmed'))nativeClosure='confirmed';
    this.#db.prepare('insert or replace into harness_host_retirements(session_id,host,process_json,owner_session_id) values (?,?,?,?)').run(key,p.host??'local',JSON.stringify({...identity,status:nativeClosure==='confirmed'?'stopped':'exited',nativeClosure,...(hostRebooted?{hostRebooted}:{}),accountEnv:null,launchBrief:null,usage:null}),p.sessionId);
    if(old&&this.#readRetirement(old).generation===key)this.#db.prepare('delete from harness_host_retirements where session_id=?').run(p.sessionId);
    if(nativeClosure==='confirmed'&&p.harness==='opencode'&&!hostRebooted) {
      // Once both native generations are positively closed, the new owner takes
      // the same private-file location. Unknown older workers are never released.
      for(const row of this.#db.prepare('select * from harness_host_retirements where owner_session_id=? or (owner_session_id is null and session_id=?)').iterate(p.sessionId,p.sessionId)) {
        const previous=this.#readRetirement(row);
        if(previous.generation!==key&&previous.nativeClosure==='confirmed'&&!previous.hostRebooted&&previous.process.host===p.host&&previous.process.name===p.name)this.#db.prepare('delete from harness_host_retirements where session_id=?').run(row.session_id!);
      }
    }
  }

  #retainHostRebootFence(p: HarnessProcess, proof: HostRebooted): void {
    if(!hostBootChanged(p.pidIdentity,proof.bootId))throw new Error('host boot closure proof mismatch');
    this.#db.prepare('insert or ignore into harness_host_reboot_closures(generation,closure_json) values (?,?)').run(hostGenerationKey(p),JSON.stringify(proof));
  }

  /** Indexed native fence, independent of resource completion; old receipt markers remain readable. */
  hostGenerationRebooted(p: HarnessProcess): HostRebooted | undefined {
    const key=hostGenerationKey(p);
    const fence=this.#db.prepare('select closure_json from harness_host_reboot_closures where generation=?').get(key);
    if(fence){
      const proof=JSON.parse(String(fence.closure_json)) as HostRebooted;
      if(!hostBootChanged(p.pidIdentity,proof.bootId))throw new Error('host boot closure proof mismatch');
      return proof;
    }
    const row=this.#db.prepare('select * from harness_host_retirements where session_id=?').get(key);
    return row?this.#readRetirement(row).hostRebooted:undefined;
  }

  clearHostGeneration(p: HarnessProcess): void {
    // Lazy compatibility: preserve an older resource-row marker before clearing it.
    // A completed resource obligation can never restore native launch/signal authority.
    const rebooted=this.hostGenerationRebooted(p);if(rebooted)this.#retainHostRebootFence(p,rebooted);
    const key=hostGenerationKey(p);
    this.#db.prepare('delete from harness_host_retirements where session_id=?').run(key);
    const old=this.#db.prepare('select * from harness_host_retirements where session_id=? and owner_session_id is null').get(p.sessionId);
    if(old&&this.#readRetirement(old).generation===key)this.#db.prepare('delete from harness_host_retirements where session_id=?').run(p.sessionId);
    const current=this.bySessionId(p.sessionId);
    if(current?.sessionId===p.sessionId&&hostGenerationKey(current)===key)this.#db.prepare('update harness_processes set host_retired=1 where session_id=?').run(p.sessionId);
  }

  /** Explicit retirement only: stream outstanding native generations for this host. */
  *retainedHostGenerations(host: string): Generator<RetainedHostGeneration> {
    const seen=new Set<string>();
    // Prefer normalized receipts over any interrupted old-key migration duplicate.
    for(const migrated of [true,false])for(const row of this.#db.prepare('select * from harness_host_retirements where host=? and owner_session_id is '+(migrated?'not null':'null')).iterate(host)) {
      const receipt=this.#readRetirement(row);if(seen.has(receipt.generation))continue;
      seen.add(receipt.generation);yield receipt;
    }
    // Display statuses alone grant neither cleanup nor signal authority.
    for(const row of this.#db.prepare("select name,host,harness,role,model,cwd,pid,harness_id,session_id,harness_session_id,started_at,status,pid_started,pid_identity from harness_processes where host=? and harness='opencode' and status in ('stopped','exited') and host_retired=0").iterate(host)) {
      const p=toProcess(row as Row),generation=hostGenerationKey(p);if(!seen.has(generation))yield {generation,process:p,nativeClosure:'unknown'};
    }
  }

  all(): HarnessProcess[] {
    return (this.#db.prepare('select * from harness_processes order by started_at, name').all() as Row[]).map(toProcess);
  }

  archivedCount(): number { return Number(this.#db.prepare('select count(*) as n from harness_processes where archived_at is not null').get()!.n); }

  running(): HarnessProcess[] {
    return this.all().filter((p) => p.status === 'running');
  }

  /** One transaction for the whole sweep; observers see only its final row views. */
  archiveBatch(dated: string[], archived: string[], at: string): void {
    this.#db.exec('begin immediate');
    try {
      const date = this.#db.prepare('update harness_processes set stopped_at = ? where name = ? and stopped_at is null');
      const archive = this.#db.prepare("update harness_processes set archived_at = ?, archived_by = 'rule' where name = ?");
      for (const name of dated) date.run(at, name);
      for (const name of archived) archive.run(at, name);
      this.#db.exec('commit');
    } catch (error) { this.#db.exec('rollback'); throw error; }
    const count = this.archivedCount();
    for (const name of new Set([...dated, ...archived])) this.#changed(name, count);
  }

  removeBatch(rows: HarnessProcess[]): void {
    this.#db.exec('begin immediate');
    try {
      const remove = this.#db.prepare('delete from harness_processes where name = ? and session_id = ?');
      for (const row of rows) {this.#preserveTerminalHostGeneration(row);remove.run(row.name, row.sessionId);}
      this.#db.exec('commit');
    } catch (error) { this.#db.exec('rollback'); throw error; }
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
