/** Offline SQL-only companion. No hub starts; output contains sizes/field names only. */
import { DatabaseSync, backup } from 'node:sqlite';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fixtureEnvironment } from './fixture-environment.ts';
const args = process.argv.slice(2);
if (args.includes('--help')) console.log('Usage: node hub/test/measure-history-storage.ts --source PROJECT\nRead-only SQLite backup to private disposable root, aggregate suite-job row/field byte sizes without exporting values. No hub or external service. Allow about 10 seconds; delete the private database after publication.');
else if (args.includes('--source')) {
  const source = resolve(args[args.indexOf('--source') + 1]!);
  const root = await mkdtemp(join(tmpdir(), 'cland-storage-'));
  const sealed = fixtureEnvironment(root, process.env);
  for (const key of Object.keys(process.env)) if (!Object.hasOwn(sealed, key)) delete process.env[key];
  Object.assign(process.env, sealed);
  const live = new DatabaseSync(join(source, '.cland/hub.db'), { readOnly: true });
  try { await backup(live, join(root, 'state.db'), { rate: 256 }); } finally { live.close(); }
  const db = new DatabaseSync(join(root, 'state.db'), { readOnly: true });
  try {
    const aggregate = db.prepare("select count(*) as rows,sum(length(cast(value as blob))) as bytes,max(length(cast(value as blob))) as max from meta where key glob 'suite-job:*'").get()!;
    const n = Number(aggregate.rows);
    const middle = db.prepare("select length(cast(value as blob)) as bytes from meta where key glob 'suite-job:*' order by bytes limit ? offset ?").all(n % 2 ? 1 : 2, Math.max(0, Math.floor((n - 1) / 2)));
    const summary = { rows: n, bytes: Number(aggregate.bytes ?? 0), median: n ? middle.reduce((sum, row) => sum + Number(row.bytes), 0) / middle.length : null, max: aggregate.max ?? null };
    const fields = db.prepare("select j.key as field, count(*) as present, sum(length(cast(j.value as blob))) as bytes, max(length(cast(j.value as blob))) as max from meta m, json_each(m.value,'$.job') j where m.key glob 'suite-job:*' group by j.key order by bytes desc limit 20").all();
    const result = { summary, fields, method: 'Fresh scratch SQLite backup; aggregate JSON field representation byte lengths; overlapping nested fields are not additive; no row values or account data exported' };
    await writeFile(join(root, 'storage-analysis.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ privateRoot: root, ...result }, null, 2));
  } finally { db.close(); }
}
