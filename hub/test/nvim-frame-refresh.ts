import { recordingKey, type Recording } from '../../nvim/test/frame-fixtures.ts';

type Catalog = Record<string, Recording>;

/** Recording is stricter than an ordinary test run: skips are missing evidence. */
export function assertRecordingRun(file: string, code: number | null, tap: string): void {
  const skipped = /^# skipped (\d+)$/m.exec(tap);
  const tests = /^# tests (\d+)$/m.exec(tap);
  if (code !== 0 || !skipped || !tests || Number(tests[1]) === 0 || Number(skipped[1]) !== 0) {
    throw new Error(`fixture refresh failed: ${file}${skipped && Number(skipped[1]) ? ` (${skipped[1]} skipped tests)` : ''}`);
  }
}

/** Capture and validate the entire refresh before publishing any fixture. */
export async function refreshFrameCatalog(files: readonly string[], retain: boolean, io: {
  catalog: Catalog;
  slices: Map<string, Catalog>;
  capture(file: string): Promise<Recording[]>;
  normalize(recording: Recording): Recording[];
  publish(catalog: Catalog, slices: Map<string, Catalog>): Promise<void>;
}): Promise<number> {
  const catalog = retain ? { ...io.catalog } : {};
  const slices = new Map<string, Catalog>();
  for (const file of files) {
    const captured = await io.capture(file);
    const own = Object.fromEntries(captured.map(r => [recordingKey(r.operation, r.input), r]));
    const expected = Math.max(1, Object.keys(io.slices.get(file) ?? {}).length);
    if (Object.keys(own).length < expected) throw new Error(`fixture refresh failed: ${file} recorded ${Object.keys(own).length} frames; expected at least ${expected}`);
    for (const r of captured) for (const normalized of io.normalize(r)) catalog[recordingKey(normalized.operation, normalized.input)] = normalized;
    if (io.slices.has(file)) slices.set(file, own);
  }
  const count = Object.keys(catalog).length;
  const expected = Object.keys(io.catalog).length;
  if (count < expected) throw new Error(`fixture refresh failed: ${files.join(', ')} recorded ${count} catalog frames; expected at least ${expected}`);
  await io.publish(catalog, slices);
  return count;
}
