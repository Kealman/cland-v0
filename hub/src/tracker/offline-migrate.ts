// Prefix migration is an offline maintenance operation. Hold the same lock as hub
// startup, so neither a new hub nor a second migrator can race the file/index writes.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { existsSync, appendFileSync, mkdirSync } from 'node:fs';
import { readdir, readFile, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { layout, projectRoot, readDiscovery } from '../project.ts';
import { acquireLockAsync, HubLocked } from '../hub/lock.ts';
import { Journal, journalPath, readJournal } from '../hub/journal.ts';
import { jsonLinesLog } from '../log.ts';
import { defaultConfig, parseConfig } from '../init/config.ts';
import { askHubFrame } from '../cli/socket-client.ts';
import type { FrameActor } from '../cli/actor.ts';
import { validTimestamp } from './criteria.ts';
import { parseItemReference } from './prefixes.ts';
import { fileNumber, parseItem } from './item.ts';
import { Ladder, kindsFor } from './kinds.ts';
import { planMigration, type MigrationPlan, type ClosingTime } from './migrate.ts';
import { Tracker, type Actor } from './tracker.ts';

export async function migrateOffline(cwd: string, dryRun: boolean, caller?: FrameActor): Promise<MigrationPlan> {
  const root = projectRoot(cwd);
  if (await realpath(cwd) !== await realpath(root)) throw new Error('task migrate must run from the project root shell, not a linked worktree or subdirectory');
  const l = layout(root);
  if (!existsSync(l.tasks)) throw new Error('task migrate requires an existing tracker; run cland init before migrating');
  const discovery = readDiscovery(l.discovery);
  if (discovery) {
    const answering = await askHubFrame(discovery, { type: 'hub.status' }, 1000).then(() => true, () => false);
    if (answering) throw new Error('the hub is running; stop the hub before task migrate');
  }
  let lock;
  try { lock = await acquireLockAsync(l.lock); }
  catch (err) {
    if (err instanceof HubLocked) throw new Error('the hub or another migration is running; stop the hub before task migrate');
    throw err;
  }
  try {
    const actor = offlineActor(l.db, caller);
    const config = existsSync(l.config) ? parseConfig(await readFile(l.config, 'utf8'), root) : defaultConfig(root);
    const ladder = new Ladder(config.tracker.levels);
    if (!ladder.roots.includes('category')) throw new Error('task migrate requires category at the root of [tracker] levels; run cland update and restart the hub before stopping it for migration');
    for (const [path, reason] of [
      ['territory.lock', 'merge or territory operation in flight'],
      ['territory.lock.break', 'merge or territory lock recovery in flight'],
      ['tracker.lock', 'tracker write in flight'],
      ['sync.tmp', 'pending cland sync recovery'],
      ['release.tmp', 'pending cland release recovery'],
    ]) if (existsSync(join(l.dir, path!))) throw new Error(`${reason}: ${join(l.dir, path!)}`);
    const names = await readdir(l.tasks);
    const pending = names.find(name => name.startsWith('.criterion-capture-') || name.endsWith('.tmp'));
    if (pending) throw new Error(`tracker write or criterion capture in flight: ${join(l.tasks, pending)}`);
    let highWater = 0;
    const closingTimes = new Map<number, ClosingTime[]>();
    const receipts = new Map<number, string>();
    const addTime = (n: number, time: unknown, source: ClosingTime['source']) => {
      if (typeof time === 'string' && validTimestamp(time)) closingTimes.set(n, [...closingTimes.get(n) ?? [], { time, source }]);
    };
    const indexed = new Map<number, { file: string; hash: string }>();
    if (existsSync(l.db)) {
      const db = new DatabaseSync(l.db, { readOnly: true });
      try {
        const has = (table: string) => !!db.prepare('select name from sqlite_master where type = ? and name = ?').get('table', table);
        if (has('tracker_merges')) {
          const receipt = db.prepare("select m.item_id from tracker_merges m left join tracker_items i on i.id = m.item_id where i.state is null or i.state != 'closed' or m.checkout_recovery is not null limit 1").get();
          if (receipt) throw new Error(`merge receipt prepared but unfinished for ${receipt.item_id}; finish cland merge before task migrate`);
        }
        if (has('tracker_merges')) {
          const columns = new Set(db.prepare('pragma table_info(tracker_merges)').all().map(r => r.name));
          for (const row of db.prepare(`select item_id, commit_sha, ${columns.has('merged_at') ? 'merged_at' : 'null as merged_at'} from tracker_merges`).all()) {
            const n = parseItemReference(String(row.item_id), kindsFor(ladder))?.n;
            if (n !== undefined) { addTime(n, row.merged_at, 'receipt'); receipts.set(n, String(row.commit_sha)); }
          }
        }
        if (has('tracker_meta')) highWater = Number(db.prepare("select value from tracker_meta where key = 'high_water'").get()?.value ?? 0);
        if (has('tracker_items')) {
          for (const row of db.prepare('select n, file, hash from tracker_items').all()) {
            const n = Number(row.n);
            indexed.set(n, { file: String(row.file), hash: String(row.hash) });
            highWater = Math.max(highWater, n);
          }
        }
      } finally { db.close(); }
    }
    const entries = [];
    for (const file of names.filter(name => fileNumber(name, kindsFor(ladder)) !== null)) {
      const text = await readFile(join(l.tasks, file), 'utf8');
      entries.push({ file, item: parseItem(text, file, ladder), hash: createHash('sha256').update(text).digest('hex') });
      highWater = Math.max(highWater, fileNumber(file, kindsFor(ladder))!);
    }
    for (const record of readJournal(journalPath(l.dir), { kinds: ['task-written'] })) {
      if (record.op !== 'close' || typeof record.id !== 'string') continue;
      const n = parseItemReference(record.id, kindsFor(ladder))?.n;
      if (n !== undefined) addTime(n, record.ts, 'journal');
    }
    // Resolve only missing times, never turn a missing receipt/commit into an updated-time guess.
    for (const entry of entries) {
      const n = fileNumber(entry.file, kindsFor(ladder))!;
      if (entry.item.fm.state !== 'closed' || entry.item.fm.closed || closingTimes.has(n)) continue;
      const commit = receipts.get(n);
      if (!commit || !/^[0-9a-f]{4,64}$/i.test(commit)) continue;
      const time = await promisify(execFile)('git', ['show', '-s', '--format=%cI', `${commit}^{commit}`], { cwd: root }).then(r => r.stdout.trim(), () => null);
      addTime(n, time, 'commit');
    }
    const plan = planMigration(entries, highWater + 1, ladder.containers, closingTimes);
    const filesChange = Object.entries(plan).some(([key, value]) => key !== 'unresolved' && value.length);
    const indexCurrent = indexed.size === entries.length && entries.every(entry => {
      const row = indexed.get(fileNumber(entry.file, kindsFor(ladder))!);
      return row?.file === entry.file && row.hash === entry.hash;
    });
    // A crash can publish the last file before indexing it. Only a genuinely
    // current index may take the no-write fast path, even when the file plan is empty.
    if (dryRun || !filesChange && indexCurrent) return plan;
    mkdirSync(l.logDir, { recursive: true });
    const journal = new Journal(journalPath(l.dir));
    const log = journal.tap(jsonLinesLog(line => appendFileSync(l.log, line)));
    const tracker = new Tracker({ root: resolve(root), db: l.db, levels: config.tracker.levels, log });
    try { return await tracker.migrate(actor, closingTimes); }
    finally { await tracker.stop(); await journal.close(); }
  } finally { await lock.release(); }
}

function offlineActor(path: string, caller?: FrameActor): Actor {
  if (!caller) return { id: 'human', name: 'human', role: null, human: true };
  let role: string | null = null;
  let name = caller.name;
  if (existsSync(path)) {
    const db = new DatabaseSync(path, { readOnly: true });
    try {
      if (db.prepare("select name from sqlite_master where type = 'table' and name = 'sessions'").get()) {
        const row = caller.sessionId
          ? db.prepare('select name, role from sessions where session_id = ? order by last_seen desc limit 1').get(caller.sessionId)
          : db.prepare('select name, role from sessions where name = ?').get(name);
        if (row) { role = typeof row.role === 'string' ? row.role : null; name = String(row.name); }
        else if (!caller.shell) return { id: name, name, role: null, human: true };
      }
    } finally { db.close(); }
  }
  if (role !== 'coordinator') throw new Error('forbidden: task.migrate belongs to the Coordinator or the human');
  return { id: caller.sessionId ?? name, name, role };
}
