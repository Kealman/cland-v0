import type { TestTiming } from './suite-durations.ts';

/** Additive producer metadata. Absence is unknown, including on older runners. */
export type TimingReceipt = { run: string; head: string; tree: string; command: string; step: string; platform: string; samples: TestTiming[] };

/** Shared grammar, also embedded in the hosting hub's remote status program. */
export function parseTimingReceipts(value: unknown): TimingReceipt[] | undefined {
  if (!Array.isArray(value) || value.length > 32) return undefined;
  let count = 0;
  for (const row of value) {
    if (!row || !['run', 'head', 'tree', 'command', 'step', 'platform'].every(key => typeof row[key] === 'string' && row[key].length > 0 && row[key].length <= 8192)
      || !Array.isArray(row.samples) || (count += row.samples.length) > 100000) return undefined;
    for (const sample of row.samples) {
      if (!sample || typeof sample.file !== 'string' || !sample.file || sample.file.length > 8192
        || typeof sample.name !== 'string' || !sample.name || sample.name.length > 8192
        || !Number.isFinite(sample.seconds) || sample.seconds < 0
        || !['pass', 'fail', 'skip', 'todo'].includes(sample.outcome)) return undefined;
    }
  }
  return value;
}

/** Read at most 16 MiB plus one sentinel byte, before collecting JSON. */
export function readTimingReceipts<T>(fs: { openSync(path: string, flags: 'r'): number; readSync(fd: number, bytes: Buffer, offset: number, length: number, position: number): number; closeSync(fd: number): void }, path: string, parse: (value: unknown) => T | undefined, grammar: 'json' | 'jsonl' = 'json'): T | undefined {
  let fd: number | undefined;
  let rows: T | undefined;
  try {
    fd = fs.openSync(path, 'r');
    const bytes = Buffer.alloc(16777217);
    let kept = 0;
    while (kept < bytes.length) {
      const count = fs.readSync(fd, bytes, kept, bytes.length - kept, kept);
      if (!count) break;
      kept += count;
    }
    if (kept <= 16777216) {
      const text = bytes.subarray(0, kept).toString('utf8');
      rows = parse(grammar === 'json' ? JSON.parse(text) : text.trim().split('\n').filter(Boolean).map(line => JSON.parse(line)));
    }
  } catch { /* Missing, oversized or damaged evidence stays unknown. */ }
  finally { if (fd !== undefined) try { fs.closeSync(fd); } catch { rows = undefined; } }
  return rows;
}

/** Native reporter JSONL has samples and one overhead record per worker. */
export function parseReporterTimings(value: unknown): Array<TestTiming | { overheadMs: number }> | undefined {
  if (!Array.isArray(value) || value.length > 100032) return undefined;
  const samples = value.filter(row => !row || !Object.hasOwn(row, 'overheadMs'));
  if (!parseTimingReceipts([{ run: 'reporter', head: 'reporter', tree: 'reporter', command: 'reporter', step: 'reporter', platform: 'reporter', samples }])) return undefined;
  if (value.some(row => row && Object.hasOwn(row, 'overheadMs') && (!Number.isFinite(row.overheadMs) || row.overheadMs < 0))) return undefined;
  return value;
}

/** Called only after reporter close; atomic sidecar survives fixture cleanup. */
export function publishTimingReceipt(fs: Parameters<typeof readTimingReceipts>[0] & { existsSync(path: string): boolean; writeFileSync(path: string, data: string, options: { mode: number }): void; renameSync(from: string, to: string): void }, path: string, receipt: TimingReceipt): void {
  const previous = fs.existsSync(path) ? readTimingReceipts(fs, path, parseTimingReceipts) : [];
  if (!previous) throw new Error('unusable earlier timing receipt');
  const rows = [...previous, receipt];
  if (!parseTimingReceipts(rows)) throw new Error('invalid timing receipt');
  const chunks: string[] = [];
  let kept = 0;
  const append = (chunk: string) => {
    kept += Buffer.byteLength(chunk);
    if (kept > 16777216) throw new Error('timing receipt exceeds byte limit');
    chunks.push(chunk);
  };
  append('[');
  for (const [index, row] of rows.entries()) {
    const { samples, ...owner } = row;
    append((index ? ',' : '') + JSON.stringify(owner).slice(0, -1) + ',"samples":[');
    for (const [at, sample] of samples.entries()) append((at ? ',' : '') + JSON.stringify(sample));
    append(']}');
  }
  append(']');
  const text = chunks.join('');
  fs.writeFileSync(path + '.tmp', text, { mode: 0o600 });
  fs.renameSync(path + '.tmp', path);
}
