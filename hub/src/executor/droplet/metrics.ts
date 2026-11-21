// Pure Linux counters and a synchronous, injected sampler. No native imports:
// the uploaded health entry point owns reads, timers and writes.
export type CpuSample = { totalTicks: number; iowaitTicks: number; stealTicks: number };
function ticks(text: string): number[] | null {
  const values = /^cpu\s+(.+)$/m.exec(text)?.[1]?.trim().split(/\s+/).slice(0, 8).map(Number);
  return values?.length === 8 && values.every(n => Number.isSafeInteger(n) && n >= 0) ? values : null;
}
export function cpuSample(text: string): CpuSample | null {
  const values = ticks(text);
  return values ? { totalTicks: values.reduce((sum, n) => sum + n, 0), iowaitTicks: values[4]!, stealTicks: values[7]! } : null;
}
export function cpuDelta(before: CpuSample | null, after: CpuSample | null) {
  if (!before || !after) return null;
  const totalTicks = after.totalTicks - before.totalTicks, iowaitTicks = after.iowaitTicks - before.iowaitTicks, stealTicks = after.stealTicks - before.stealTicks;
  if (totalTicks <= 0 || iowaitTicks < 0 || stealTicks < 0 || iowaitTicks + stealTicks > totalTicks) return null;
  return { totalTicks, iowaitTicks, stealTicks, iowaitPct: Math.round(iowaitTicks / totalTicks * 10000) / 100, stealPct: Math.round(stealTicks / totalTicks * 10000) / 100 };
}
export function startMachineMetrics(io: {
  now(): number;
  every(ms: number, callback: () => void): () => void;
  read(): { stat: string; loadavg: string };
  write(line: string): void;
}): () => void {
  const read = () => { try { return io.read(); } catch { return { stat: '', loadavg: '' }; } };
  let previous = read(), at = io.now(), stopped = false;
  const cancel = io.every(1000, () => {
    if (stopped) return;
    const current = read(), nextAt = io.now();
    const delta = cpuDelta(cpuSample(previous.stat), cpuSample(current.stat));
    const before = ticks(previous.stat), after = ticks(current.stat);
    const idle = before && after ? after[3]! - before[3]! : -1;
    const busy = delta ? delta.totalTicks - idle - delta.iowaitTicks - delta.stealTicks : -1;
    const load = current.loadavg.trim().split(/\s+/).slice(0, 3).map(Number);
    const receipt = { version: 1, at: nextAt, elapsedMs: nextAt - at,
      load: load.length === 3 && load.every(n => Number.isFinite(n) && n >= 0) ? load : null,
      cpuPct: delta && idle >= 0 && busy >= 0 ? Math.round(busy / delta.totalTicks * 10000) / 100 : null,
      iowaitPct: delta?.iowaitPct ?? null, stealPct: delta?.stealPct ?? null };
    previous = current; at = nextAt;
    // Advisory telemetry cannot change the suite's outcome if its sink closes.
    try { io.write(`suite machine metrics ${JSON.stringify(receipt)}\n`); } catch { /* unavailable sink */ }
  });
  return () => { stopped = true; cancel(); };
}

/** The foreground package owns the timer; there is no separate sampler to reap.
 * The native caller runs both under its existing process-group timeout. */
export async function withMachineMetrics<T>(io: Parameters<typeof startMachineMetrics>[0], command: () => Promise<T>): Promise<T> {
  const stop = startMachineMetrics(io);
  try { return await command(); }
  finally { stop(); }
}

/** Called only after the foreground writer closes; stream with a framing
 * boundary so arbitrary package bytes cannot consume a metric's prefix. */
export function appendMachineMetrics(read: () => string | null, write: (chunk: string) => void): void {
  write('\n');
  for (let chunk = read(); chunk !== null; chunk = read()) write(chunk);
  write('\n');
}

/** TERM never means closed. Bound local drainage, then retain closure authority
 * with the owning machine; only an uninterrupted native close permits done. */
export type PackageCompletion = { state: 'closed'; code: number } | { state: 'incomplete'; signal: string | null };
export async function ownPackage(io: {
  observe(listener: (signal: string) => void): () => void;
  after(ms: number, callback: () => void): () => void;
  launch(): Promise<number>;
  handoff(): void;
}): Promise<PackageCompletion> {
  let signal: string | null = null, cancel: (() => void) | undefined;
  const incomplete = Promise.withResolvers<{ state: 'incomplete'; signal: string | null }>();
  const unsubscribe = io.observe(value => {
    if (signal !== null) return;
    signal = value;
    cancel = io.after(2000, () => incomplete.resolve({ state: 'incomplete', signal }));
  });
  try {
    const native = signal === null ? io.launch().then<PackageCompletion, PackageCompletion>(code => signal === null
      ? { state: 'closed' as const, code } : incomplete.promise,
    () => ({ state: 'incomplete' as const, signal })) : incomplete.promise;
    const result = await Promise.race([native, incomplete.promise]);
    if (result.state === 'incomplete') io.handoff();
    return result;
  } finally { cancel?.(); unsubscribe(); }
}

/** Native shell exit receipt: at most three decimal digits and a newline.
 * Keep a successfully read outcome if close itself fails. */
export function incompletePackageStatus(fs: {
  openSync(path: string, mode: string): number;
  readSync(fd: number, target: Buffer, offset: number, length: number, position: number): number;
  closeSync(fd: number): void;
}, path: string) {
  let fd: number | undefined, nativeExit: number | null = null, diagnostic = '';
  try {
    fd = fs.openSync(path, 'r');
    const bytes = Buffer.alloc(9);
    let kept = 0;
    while (kept < bytes.length) {
      const n = fs.readSync(fd, bytes, kept, bytes.length - kept, kept);
      if (!n) break;
      kept += n;
    }
    const text = bytes.toString('utf8', 0, kept);
    if (/^(?:0|[1-9]\d{0,2})\n$/.test(text) && Number(text.trim()) <= 255) nativeExit = Number(text.trim());
  } catch { diagnostic = '; secondary diagnostic: closure receipt unavailable'; }
  finally { try { if (fd !== undefined) fs.closeSync(fd); } catch { diagnostic += '; secondary diagnostic: closure receipt close failed'; } }
  return { state: 'lost', code: nativeExit || 1, cause: 'package closure incomplete; machine deletion required' + diagnostic,
    packageClosure: { state: 'incomplete', nativeExit } };
}
