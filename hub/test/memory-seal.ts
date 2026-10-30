import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { sealSuiteJob } from '../src/hub/suite-isolation.ts';
import type { SuiteJob } from '../src/hub/suites.ts';

/** Only the disposable backup is opened writable; each archived row is bounded separately. */
export function sealMemoryDatabase(path: string, root: string): { activeRows: number; finishedHistoryRows: number } {
  const db = new DatabaseSync(path);
  try {
    db.exec('begin');
    const active = JSON.parse((db.prepare("select value from meta where key = 'suite-jobs'").get() as { value: string } | undefined)?.value ?? '[]') as SuiteJob[];
    const update = db.prepare('update meta set value = ? where key = ?');
    update.run(JSON.stringify(active.map(job => sealSuiteJob(job, root))), 'suite-jobs');
    let finishedHistoryRows = 0;
    for (const row of db.prepare("select key, value from meta where key glob 'suite-job:*'").iterate() as Iterable<{ key: string; value: string }>) {
      const entry = JSON.parse(row.value) as { position: number; job: SuiteJob };
      update.run(JSON.stringify({ ...entry, job: sealSuiteJob(entry.job, root) }), row.key);
      finishedHistoryRows++;
    }
    const updateArtifact = db.prepare('update artifacts set value = ? where number = ?');
    for (const row of db.prepare('select number, value from artifacts').iterate() as Iterable<{ number: number; value: string }>) {
      const artifact = JSON.parse(row.value);
      artifact.path = join(root, '.cland', 'artifacts', `excluded-${row.number}`);
      delete artifact.movedTo;
      delete artifact.entry;
      updateArtifact.run(JSON.stringify(artifact), row.number);
    }
    db.exec("delete from meta where key glob 'pending-verification:*' or key glob 'executor-*'");
    // Old copies may predate the summary triggers; force the production backfill.
    db.exec("delete from suite_job_summaries; delete from meta where key = 'suite-summary-index-v1'");
    db.exec('commit');
    return { activeRows: active.length, finishedHistoryRows };
  } finally { db.close(); }
}
