import { AsyncLocalStorage } from 'node:async_hooks';
import cp from 'node:child_process';
import files from 'node:fs/promises';
import { basename } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { parseProcessTable } from '../src/process-table.ts';
import type { stageCase } from './stage-case-fixture.ts';

type Step = { kind: string; started: number; completed?: number; code?: number | null; signal?: string | null; selector?: 'all' | 'pids' | 'parents' | 'births'; entries?: number; stdoutLines?: number; parsedRows?: number; selectedPids?: number; rowOutputTruncated?: boolean; procBefore?: number; procAfter?: number };
export type InspectionTrace = { steps: Step[]; omitted: number; proc: { calls: number; first?: number; last?: number; subtotalMs: number; failures: number } };
export const inspectionReceipt = (): InspectionTrace => ({ steps: [], omitted: 0, proc: { calls: 0, subtotalMs: 0, failures: 0 } });

/** Fixture observer only: producing native close receipts, no signal authority
 * and no copied process-table parser. Every collection has a fixed bound. */
export function pruneInspectionTrace(scope: ReturnType<typeof stageCase>) {
  const active = new AsyncLocalStorage<InspectionTrace>();
  const add = (trace: InspectionTrace, step: Step) => {
    if (trace.steps.length >= 512) { trace.omitted++; return undefined; }
    trace.steps.push(step); return step;
  };
  const spawn = cp.spawn;
  scope.patch(cp, 'spawn', (...args: Parameters<typeof cp.spawn>) => {
    const trace = active.getStore(), bin = basename(String(args[0]));
    const argv = Array.isArray(args[1]) ? args[1].map(String) : [];
    const step = trace && ['ps', 'pgrep', 'perl'].includes(bin) ? add(trace, {
      kind: bin, started: performance.now(), procBefore: trace.proc.calls,
      ...(bin === 'ps' ? { selector: argv.includes('-e') ? 'all' as const : 'pids' as const }
        : bin === 'pgrep' ? { selector: 'parents' as const } : { selector: 'births' as const }),
    }) : undefined;
    const snapshot = bin === 'ps' && argv.includes('pid=,ppid=,pgid=,lstart=,stat=,command=');
    const selected = argv.includes('-p') ? argv[argv.indexOf('-p') + 1] : undefined;
    if (step && bin === 'ps' && selected !== undefined) step.selectedPids = selected.split(',').length;
    // cland-allow-child-env: transparent observer preserves the native producer's final sealed options.
    const child = Reflect.apply(spawn, cp, args);
    if (step) {
      let lines = 0, entries = 0, pending = '', pendingBytes = 0, overflow = false;
      const decoder = new StringDecoder('utf8');
      const consume = (text: string) => {
        for (const part of text.split(/(?<=\n)/)) {
          if (overflow) { if (part.endsWith('\n')) { overflow = false; lines++; } continue; }
          const bytes = Buffer.byteLength(part);
          if (pendingBytes + bytes > 65536) {
            step.rowOutputTruncated = true; pending = ''; pendingBytes = 0;
            overflow = !part.endsWith('\n'); if (!overflow) lines++;
            continue;
          }
          pending += part; pendingBytes += bytes;
          if (pending.endsWith('\n')) {
            lines++; if (snapshot) entries += parseProcessTable(pending).length;
            pending = ''; pendingBytes = 0;
          }
        }
      };
      child.stdout?.on('data', (chunk: string | Buffer) => {
        if (bin !== 'ps') return;
        consume(decoder.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      });
      child.once('close', (code, signal) => {
        step.completed = performance.now(); step.code = code; step.signal = signal; step.procAfter = trace!.proc.calls;
        if (bin === 'ps') {
          consume(decoder.end());
          if (pending) { lines++; if (snapshot) entries += parseProcessTable(pending).length; }
          // Keep the previous raw-line field for retained diagnostic readers.
          step.entries = lines; step.stdoutLines = lines; if (snapshot) step.parsedRows = entries;
        }
      });
    }
    return child;
  });
  const read = files.readFile;
  scope.patch(files, 'readFile', async (...args: Parameters<typeof read>) => {
    const trace = active.getStore();
    if (!trace || !/^\/proc\/(?:\d+\/stat|sys\/kernel\/random\/boot_id)$/.test(String(args[0]))) return Reflect.apply(read, files, args);
    const started = performance.now(); trace.proc.calls++; trace.proc.first ??= started;
    try { return await Reflect.apply(read, files, args); }
    catch (error) { trace.proc.failures++; throw error; }
    finally { trace.proc.last = performance.now(); trace.proc.subtotalMs += trace.proc.last - started; }
  });
  const kill = process.kill;
  scope.patch(process, 'kill', (pid: number, signal?: NodeJS.Signals | number) => {
    const trace = active.getStore();
    const step = trace && signal !== 0 ? add(trace, { kind: `signal:${String(signal ?? 'SIGTERM')}`, started: performance.now() }) : undefined;
    try { return kill(pid, signal); }
    finally { if (step) step.completed = performance.now(); }
  });
  return {
    run: <T>(trace: InspectionTrace, work: () => Promise<T>) => active.run(trace, work),
    checkpoint: <T>(trace: InspectionTrace, work: () => Promise<T>) => {
      const step = add(trace, { kind: 'ownership-checkpoint', started: performance.now() });
      return work().finally(() => { if (step) step.completed = performance.now(); });
    },
  };
}
