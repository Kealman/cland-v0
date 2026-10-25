import { recordingKey, type Recording } from '../../nvim/test/frame-fixtures.ts';

type Catalog = Record<string, Recording>;

/** Recording is stricter than an ordinary test run: skips are missing evidence. */
export function assertRecordingRun(file: string, code: number | null, tap: string): void {
  const skipped = /^# skipped (\d+)$/m.exec(tap);
  const tests = /^# tests (\d+)$/m.exec(tap);
  const passed = /^# pass (\d+)$/m.exec(tap);
  const incomplete = ['fail', 'cancelled', 'todo'].some(kind => {
    const count = new RegExp(`^# ${kind} (\\d+)$`, 'm').exec(tap);
    return !count || Number(count[1]) !== 0;
  });
  if (code !== 0 || !skipped || !tests || !passed || incomplete
    || Number(tests[1]) === 0 || Number(skipped[1]) !== 0 || Number(passed[1]) !== Number(tests[1])) {
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
  if (!files.length) throw new Error('fixture refresh failed: no consumer files');
  const catalog = retain ? { ...io.catalog } : {};
  const slices = new Map<string, Catalog>();
  for (const file of files) {
    const captured = await io.capture(file);
    const own = Object.fromEntries(captured.map(r => [recordingKey(r.operation, r.input), r]));
    // Successful consumer assertions prove completeness; scheduling can coalesce
    // requests and change the number of distinct keys even for the same tests.
    if (!captured.length) throw new Error(`fixture refresh failed: ${file} recorded 0 frames; expected at least 1`);
    for (const r of captured) for (const normalized of io.normalize(r)) catalog[recordingKey(normalized.operation, normalized.input)] = normalized;
    if (io.slices.has(file)) slices.set(file, own);
  }
  const count = Object.keys(catalog).length;
  await io.publish(catalog, slices);
  return count;
}
