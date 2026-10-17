import type { Provider } from './dependencies.ts';
import { mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { Store } from '../../hub/store.ts';
import type { LogFn } from '../../log.ts';
import { DigitalOceanApi, type Action, type SnapshotImage } from './api.ts';
import { durableJson } from './lease.ts';
import { readSnapshot, snapshotPath, type Snapshot } from './prepare.ts';

export type SnapshotRecovery = {
  id: string; name: string; started: string; phase: 'build' | 'snapshot' | 'retire' | 'cleanup';
  previous: Snapshot | null; candidate?: Snapshot; builder?: number;
  retirement?: 'unstarted' | 'submitted' | 'accepted' | 'rejected';
  requested: boolean; action?: number; actionState?: Action['status']; seen: number[];
};
const recoveryRoot = (root: string): string => join(root, '.cland/run/executor/snapshot-recovery');
const recoveryPath = (root: string, record: SnapshotRecovery): string => join(recoveryRoot(root), `${record.id}.json`);
export async function saveRecovery(root: string, record: SnapshotRecovery): Promise<void> {
  await mkdir(recoveryRoot(root), { recursive: true, mode: 0o700 });
  await durableJson(recoveryPath(root, record), record);
}
export async function forgetRecovery(root: string, record: SnapshotRecovery): Promise<void> { await rm(recoveryPath(root, record), { force: true }); }
export async function readRecoveries(root: string): Promise<SnapshotRecovery[]> {
  let names: string[];
  try { names = await readdir(recoveryRoot(root)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  const records: SnapshotRecovery[] = [];
  for (const name of names.filter(name => name.endsWith('.json'))) {
    try { records.push(JSON.parse(await readFile(join(recoveryRoot(root), name), 'utf8')) as SnapshotRecovery); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  return records;
}
async function publish(root: string, store: Store | undefined, snapshot: Snapshot): Promise<void> {
  await durableJson(snapshotPath(root), snapshot);
  store?.setMeta('executor-snapshot', JSON.stringify(snapshot));
}
const belongs = (image: SnapshotImage, record: SnapshotRecovery): boolean => image.id === record.candidate?.image || image.name === record.name && image.resource_id === String(record.builder);

/** Each retry establishes provider state before changing an uncertain pointer.
 * Final actions with no visible image keep a tombstone: a delayed catalogue may
 * still reveal a partial image. Ownership uses the builder id, so a later prepare
 * of the same key cannot be mistaken for the failed attempt. */
export async function recoverSnapshot(root: string, record: SnapshotRecovery, store?: Store, env: NodeJS.ProcessEnv = process.env, provider?: Provider): Promise<boolean> {
  const api = provider ?? new DigitalOceanApi(env);
  if (record.phase === 'retire' && record.candidate) {
    let images = await api.snapshots(); // A failed read leaves publication intact.
    const canRollback = record.retirement === 'unstarted' || record.retirement === 'rejected';
    if (canRollback && record.previous && images.some(image => image.id === record.previous!.image)) {
      await publish(root, store, record.previous);
      record.phase = 'cleanup';
      await saveRecovery(root, record);
    } else {
      // Presence can be stale or a DELETE may still be running. Once submitted,
      // keep the usable replacement and idempotently finish retirement.
      if (record.previous && images.some(image => image.id === record.previous!.image)) {
        await api.deleteSnapshot(record.previous.image);
        images = await api.snapshots();
        if (images.some(image => image.id === record.previous!.image)) return false;
      }
      if (!images.some(image => image.id === record.candidate!.image)) return false;
      await publish(root, store, record.candidate);
      await forgetRecovery(root, record);
      return true;
    }
  }
  if (record.phase !== 'cleanup') { record.phase = 'cleanup'; await saveRecovery(root, record); }
  if (record.requested && record.action === undefined && record.builder !== undefined) {
    const action = (await api.actions()).find(action => action.resource_id === record.builder && action.type === 'snapshot');
    if (action) { record.action = action.id; await saveRecovery(root, record); }
  }
  if (record.action !== undefined) {
    record.actionState = (await api.action(record.action)).status;
    await saveRecovery(root, record);
  }
  const current = await readSnapshot(root);
  const images = await api.snapshots(); // Never convert a failed catalogue to absence.
  const owned = images.filter(image => belongs(image, record) && image.id !== current?.image && image.id !== record.previous?.image);
  for (const image of owned) {
    if (!record.seen.includes(image.id)) { record.seen.push(image.id); await saveRecovery(root, record); }
    await api.deleteSnapshot(image.id);
  }
  const remaining = await api.snapshots();
  const settled = !record.requested || record.actionState === 'completed' || record.actionState === 'errored';
  const absent = !remaining.some(image => belongs(image, record));
  if (settled && absent && (!record.requested || record.seen.length)) {
    await forgetRecovery(root, record);
    return true;
  }
  return false;
}
export async function recoverSnapshots(root: string, store: Store | undefined, log: LogFn, env: NodeJS.ProcessEnv = process.env, provider?: Provider): Promise<void> {
  for (const record of await readRecoveries(root)) {
    try {
      if (await recoverSnapshot(root, record, store, env, provider)) log({ event: 'executor-snapshot-recovered', recovery: record.id, image: record.candidate?.image ?? null });
    } catch { /* Durable ownership survives catalogue, action and deletion refusals. */ }
  }
}
