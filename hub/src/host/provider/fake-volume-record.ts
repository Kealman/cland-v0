import type { Volume, VolumeSnapshot } from './provider.ts';

export type FakeVolumeRecord = { volume: Volume; lastSnapshotAt?: number; snapshot?: VolumeSnapshot };
export function isFakeVolumeId(value: unknown): value is string {
  return typeof value === 'string' && /^volume-[a-f0-9-]+$/.test(value);
}
function object(value: unknown): value is { [key: string]: unknown } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function text(value: unknown): value is string { return typeof value === 'string' && value.length > 0; }
function time(value: unknown): value is string { return text(value) && Number.isFinite(Date.parse(value)); }

/** All retained-state readers share this fence. Unknown attachment ownership or
 * an unpaired snapshot receipt must never become permission to mutate. */
export function parseFakeVolumeRecord(bytes: string, expectedId: string): FakeVolumeRecord {
  const record: unknown = JSON.parse(bytes);
  if (!object(record) || !object(record.volume)) throw new Error('invalid fake volume record');
  const v = record.volume;
  if (!isFakeVolumeId(v.id) || v.id !== expectedId || !text(v.project) || !text(v.name) || !text(v.region)
      || typeof v.sizeGiB !== 'number' || !Number.isSafeInteger(v.sizeGiB) || v.sizeGiB <= 0 || !time(v.created)
      || !(v.attachedTo === null || text(v.attachedTo))) throw new Error('invalid fake volume record');
  const hasTime = Object.hasOwn(record, 'lastSnapshotAt'), hasSnapshot = Object.hasOwn(record, 'snapshot');
  if (hasTime !== hasSnapshot) throw new Error('unpaired fake snapshot receipt');
  if (hasSnapshot) {
    const s = record.snapshot, at = record.lastSnapshotAt;
    if (typeof at !== 'number' || !Number.isSafeInteger(at) || at < 0 || !object(s) || !text(s.id)
        || s.volumeId !== v.id || !time(s.created) || Date.parse(s.created) !== at) throw new Error('invalid fake snapshot receipt');
  }
  return record as FakeVolumeRecord;
}
