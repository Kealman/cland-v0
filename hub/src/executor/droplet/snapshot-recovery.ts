import { parsePoolName } from '../../host/pool-name.ts';
import type { Provider } from './dependencies.ts';
import { readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { Store } from '../../hub/store.ts';
import type { LogFn } from '../../log.ts';
import { DigitalOceanApi, type Action, type SnapshotImage } from './api.ts';
import { durableJson, runDirectory } from './lease.ts';
import { readSnapshot, snapshotPath, type Snapshot, type SnapshotStorage } from './prepare.ts';

export type SnapshotRecovery = {
  id: string; name: string; started: string; phase: 'build' | 'snapshot' | 'retire' | 'cleanup';
  previous: Snapshot | null; candidate?: Snapshot; builder?: number;
  retirement?: 'unstarted' | 'submitted' | 'accepted' | 'rejected';
  requested: boolean; action?: number; actionState?: Action['status']; seen: number[];
};
const recoveryRoot = (root: string, storage?: SnapshotStorage): string => storage?.recoveryRoot ?? join(root, '.cland/run/executor/snapshot-recovery');
const recoveryPath = (root: string, record: SnapshotRecovery, storage?: SnapshotStorage): string => join(recoveryRoot(root, storage), `${record.id}.json`);
export async function saveRecovery(root: string, record: SnapshotRecovery, storage?: SnapshotStorage): Promise<void> {
  await runDirectory(root, recoveryRoot(root, storage));
  await durableJson(recoveryPath(root, record, storage), record);
}
export async function forgetRecovery(root: string, record: SnapshotRecovery, storage?: SnapshotStorage): Promise<void> { await rm(recoveryPath(root, record, storage), { force: true }); }
export async function readRecoveries(root: string, storage?: SnapshotStorage): Promise<SnapshotRecovery[]> {
  let names: string[];
  try { names = await readdir(recoveryRoot(root, storage)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  const records: SnapshotRecovery[] = [];
  for (const name of names.filter(name => name.endsWith('.json'))) {
    try { records.push(JSON.parse(await readFile(join(recoveryRoot(root, storage), name), 'utf8')) as SnapshotRecovery); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  return records;
}
async function publish(root: string, store: Store | undefined, snapshot: Snapshot, storage?: SnapshotStorage): Promise<void> {
  await durableJson(storage?.recordPath ?? snapshotPath(root), snapshot);
  store?.setMeta('executor-snapshot', JSON.stringify(snapshot));
}
export const snapshotFromBuilder = (image: SnapshotImage, name: string, builder: number): boolean => image.name === name && image.resource_id === String(builder);
const belongs = (image: SnapshotImage, record: SnapshotRecovery): boolean => image.id === record.candidate?.image || record.builder !== undefined && snapshotFromBuilder(image, record.name, record.builder);

/** Each retry establishes provider state before changing an uncertain pointer.
 * Final actions with no visible image keep a tombstone: a delayed catalogue may
 * still reveal a partial image. Ownership uses the builder id, so a later prepare
 * of the same key cannot be mistaken for the failed attempt. */
export async function recoverSnapshot(root: string, record: SnapshotRecovery, store?: Store, env: NodeJS.ProcessEnv = process.env, provider?: Provider, storage?: SnapshotStorage): Promise<boolean> {
  const api = provider ?? new DigitalOceanApi(env);
  if (record.phase === 'retire' && record.candidate) {
    const images = await api.snapshots(); // A failed read leaves publication intact.
    const canRollback = record.retirement === 'unstarted' || record.retirement === 'rejected';
    if (canRollback && record.previous && images.some(image => image.id === record.previous!.image)) {
      await publish(root, store, record.previous, storage);
      record.phase = 'cleanup';
      await saveRecovery(root, record, storage);
    } else {
      // Presence can be stale or a DELETE may still be running. Once submitted,
      // keep the usable replacement and idempotently finish retirement.
      // The saved previous id remains owned even if a catalogue omits it.
      if (record.previous) await api.deleteSnapshot(record.previous.image);
      if (!images.some(image => image.id === record.candidate!.image)) return false;
      await publish(root, store, record.candidate, storage);
      await forgetRecovery(root, record, storage);
      return true;
    }
  }
  if (record.phase !== 'cleanup') { record.phase = 'cleanup'; await saveRecovery(root, record, storage); }
  if (record.requested && record.action === undefined && record.builder !== undefined) {
    const action = (await api.actions()).find(action => action.resource_id === record.builder && action.type === 'snapshot');
    if (action) { record.action = action.id; await saveRecovery(root, record, storage); }
  }
  if (record.action !== undefined) {
    record.actionState = (await api.action(record.action)).status;
    await saveRecovery(root, record, storage);
  }
  const current = await readSnapshot(root, storage);
  const images = await api.snapshots(); // Never convert a failed catalogue to absence.
  const owned = images.filter(image => belongs(image, record) && image.id !== current?.image && image.id !== record.previous?.image);
  for (const image of owned) {
    if (!record.seen.includes(image.id)) { record.seen.push(image.id); await saveRecovery(root, record, storage); }
  }
  // Checkpoint every discovered id before effects; retry retained ids without
  // depending on catalogue membership. Only deleteSnapshot's GET404 settles it.
  for (const id of record.seen) {
    if (id === current?.image || id === record.previous?.image) return false;
    await api.deleteSnapshot(id);
  }
  const remaining = await api.snapshots();
  const settled = !record.requested || record.actionState === 'completed' || record.actionState === 'errored';
  const absent = !remaining.some(image => belongs(image, record));
  if (settled && absent && (!record.requested || record.seen.length)) {
    await forgetRecovery(root, record, storage);
    return true;
  }
  return false;
}
export async function recoverSnapshots(root: string, store: Store | undefined, log: LogFn, env: NodeJS.ProcessEnv = process.env, provider?: Provider, storage?: SnapshotStorage): Promise<void> {
  for (const record of await readRecoveries(root, storage)) {
    try {
      if (await recoverSnapshot(root, record, store, env, provider, storage)) log({ event: 'executor-snapshot-recovered', recovery: record.id, image: record.candidate?.image ?? null });
    } catch { /* Durable ownership survives catalogue, action and deletion refusals. */ }
  }
}

// Distinct executor instances serve pool prepare and periodic reconciliation.
// Claim before inspecting records, so reconciliation never cleans an active build.
const activeStorage = new Set<string>();
export function claimSnapshotStorage(storage: SnapshotStorage): (() => void) | undefined {
  if (activeStorage.has(storage.recordPath)) return undefined;
  activeStorage.add(storage.recordPath);
  return () => { activeStorage.delete(storage.recordPath); };
}
export async function recoverPoolSnapshots(root: string, log: LogFn, env: NodeJS.ProcessEnv, provider: Provider): Promise<void> {
  let names: string[];
  try { names = await readdir(join(root, '.cland/run/hosts')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
  let poolSnapshotStorage: typeof import('../../host/provider/pool-image.ts').poolSnapshotStorage | undefined;
  for (const name of names) {
    if (!name.endsWith('-recovery')) continue;
    let pool: string;
    try { pool = parsePoolName(name.slice(0, -9)); } catch { continue; }
    poolSnapshotStorage ??= (await import('../../host/provider/pool-image.ts')).poolSnapshotStorage;
    const storage = poolSnapshotStorage(root, pool);
    const release = claimSnapshotStorage(storage);
    if (!release) continue;
    try { await recoverSnapshots(root, undefined, log, env, provider, storage); }
    finally { release(); }
  }
}
