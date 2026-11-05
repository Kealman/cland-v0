// Shared fixture construction for a process table written before host placement.
import type { DatabaseSync } from 'node:sqlite';

/** Remove only the placement column and its dependent indexes from an owned fixture. */
export function removeProcessHostColumn(db: DatabaseSync): void {
  if(!db.prepare('pragma table_info(harness_processes)').all().some(column=>column.name==='host'))return;
  for(const index of db.prepare('pragma index_list(harness_processes)').all()) {
    if(db.prepare('select name from pragma_index_info(?)').all(String(index.name)).some(column=>column.name==='host')) {
      db.exec('drop index "'+String(index.name).replaceAll('"','""')+'"');
    }
  }
  db.exec('alter table harness_processes drop column host');
}
