/** Coordinator maintenance: dry-run first; deletion unlinks reviewed aliases only. */
import { opendir, lstat } from 'node:fs/promises';
import { appendFileSync, closeSync, fsyncSync, lstatSync, openSync, readFileSync, readlinkSync, realpathSync, unlinkSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { fixtureClass, fixturePatterns, planFixtureEntry, type AliasClosure } from '../../shared/fixture-cleanup-plan.ts';
import { readAliasClosure } from '../../shared/fixture-alias-closure.ts';
import { fixtureEnvironment } from '../../test-support/fixture-environment.ts';

type Row = { path: string; class: string; device: number; inode: number; eligible: boolean; reason: string; proof: AliasClosure | null;
  bytes: number; complete: boolean; mtime: number; live: boolean | null };
export type CleanupPlan = { version: 1; root: string; rows: Row[]; counts: { candidates: number; eligible: number; kept: number }; classes: Record<string, unknown> };

/** lstat only, never follows aliases or opens fixture file contents (including databases). */
async function bytesBelow(path: string): Promise<{ bytes: number; complete: boolean }> {
  let bytes = 0, complete = true;
  async function visit(path: string): Promise<void> {
    try {
      const info = await lstat(path); bytes += info.size;
      if (info.isDirectory()) for await (const entry of await opendir(path)) await visit(join(path, entry.name));
    } catch { complete = false; }
  }
  await visit(path); return { bytes, complete };
}
export async function fixtureCleanupPlan(root: string, references: string[] | null = null, names?: ReadonlySet<string>): Promise<CleanupPlan> {
  root = realpathSync(root);
  const rows: Row[] = [];
  for await (const entry of await opendir(root)) {
    if (names && !names.has(entry.name)) continue;
    const kind = fixtureClass(entry.name); if (!kind) continue;
    const path = join(root, entry.name);
    const info = await lstat(path), proof = readAliasClosure(path);
    const size = await bytesBelow(path);
    const targets = [path];
    if (info.isSymbolicLink()) { try { const target = readlinkSync(path); if (target.startsWith('/')) targets.push(target); } catch { /* unavailable link target */ } }
    const live = references === null ? null : references.some(ref => targets.some(target => ref === target || ref.startsWith(target + '/')));
    rows.push({ path, class: kind, device: info.dev, inode: info.ino, ...planFixtureEntry(entry.name, proof), proof, ...size, mtime: info.mtimeMs, live });
  }
  rows.sort((a, b) => a.path.localeCompare(b.path));
  const classes = Object.fromEntries(Object.entries(fixturePatterns).map(([kind, pattern]) => {
    const selected = rows.filter(row => row.class === kind);
    return [kind, { pattern, count: selected.length, bytes: selected.reduce((sum, row) => sum + row.bytes, 0),
      bytesComplete: selected.every(row => row.complete), oldestMtime: selected.length ? new Date(Math.min(...selected.map(row => row.mtime))).toISOString() : null,
      newestMtime: selected.length ? new Date(Math.max(...selected.map(row => row.mtime))).toISOString() : null,
      live: selected.some(row => row.live === true) ? true : references === null ? null : false }];
  }));
  const eligible = rows.filter(row => row.eligible).length;
  return { version: 1, root, rows, counts: { candidates: rows.length, eligible, kept: rows.length - eligible }, classes };
}

/** Exactly one literal from the dry-run plan; no recursive removal, glob or target traversal. */
export function removeLiteralFixture(plan: CleanupPlan, path: string, receipt: string): void {
  if (plan.version !== 1 || resolve(path) !== path || dirname(path) !== plan.root || realpathSync(plan.root) !== plan.root || fixtureClass(basename(path)) !== 'alias') throw Error('literal alias outside plan');
  const row = plan.rows.find(row => row.path === path);
  const proof = readAliasClosure(path), info = lstatSync(path);
  if (!row?.eligible || !row.proof || !proof || info.dev !== row.device || info.ino !== row.inode || JSON.stringify(proof) !== JSON.stringify(row.proof)) throw Error('alias retained: missing or changed closure proof');
  const targetRoot = dirname(proof.target), receiptParent = realpathSync(dirname(receipt));
  if (receiptParent === targetRoot || receiptParent.startsWith(targetRoot + '/') || receipt === path) throw Error('receipt must be outside fixture root');
  const fd = openSync(receipt, 'ax', 0o600);
  const record = (value: unknown) => { appendFileSync(fd, JSON.stringify(value) + '\n'); fsyncSync(fd); };
  try {
    record({ event: 'removing', path, proof, device: row.device, inode: row.inode });
    unlinkSync(path);
    record({ event: 'removed', path, device: row.device, inode: row.inode });
  } finally { closeSync(fd); }
}

/** A failed/partial OS inventory is unknown, never evidence of no holders. */
function openReferences(scratch: string): string[] | null {
  const result = spawnSync('/usr/sbin/lsof', ['-nP', '-Fn'], { env: fixtureEnvironment(scratch, process.env), encoding: 'utf8', timeout: 30_000, maxBuffer: 8 * 1024 * 1024 });
  return result.error || result.status !== 0 || result.stderr.trim() ? null : result.stdout.split('\n').filter(line => line.startsWith('n/')).map(line => line.slice(1));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, root, scratch, literal, receipt] = process.argv.slice(2);
  if (mode === '--help') console.log('Coordinator only. Dry run: cleanup-native-fixtures.ts --dry-run ROOT SCRATCH\nUnlink one reviewed alias: cleanup-native-fixtures.ts --remove-literal PLAN.json SCRATCH LITERAL RECEIPT.jsonl\nSCRATCH isolates HOME/XDG/Git and credentials. Only positive alias closure receipts authorize unlink; historical roots stay kept. One lsof census is advisory: errors mean unknown holders. Byte totals include directory and symlink sizes without following links; incomplete scans are labelled. Real removal requires a reviewed plan and a quiet native slot.');
  else if (mode === '--dry-run' && root && scratch) console.log(JSON.stringify(await fixtureCleanupPlan(root, openReferences(scratch)), null, 2));
  else if (mode === '--remove-literal' && root && scratch && literal && receipt) removeLiteralFixture(JSON.parse(readFileSync(root, 'utf8')), literal, receipt);
  else throw Error('use --help for cleanup-native-fixtures.ts usage');
}
