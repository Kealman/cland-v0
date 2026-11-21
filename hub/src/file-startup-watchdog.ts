import { realClock, type Clock, type ClockTimer } from './hub/clock.ts';
import type { TestProgress } from './suite-progress.ts';
import { waitTimeoutMs } from './suite-wait-budget.ts';

/** Startup/import readiness, independent of test behaviour and output volume. */
export function fileStartupTimeoutMs(stallTimeoutMs: number, loadFactor?: number, env: NodeJS.ProcessEnv = process.env): number {
  // Omitting the factor samples the current shared policy. Converting an absent
  // environment value to NaN must not silently turn setup headroom into factor 1.
  if (loadFactor !== undefined && (!Number.isFinite(loadFactor) || loadFactor < 1)) throw new Error('file startup load factor must be finite and at least 1; omit it to sample current load');
  return Math.min(stallTimeoutMs / 2, waitTimeoutMs(30_000, loadFactor, env));
}

/** Local commands carry a cause; delivered-tree phases carry the same log fact. */
export function isFileStartupStall(text: string): boolean {
  return /(?:^|\n|: )(?:suite stall startup )?stalled: [^\n]+ no test started within [\d.]+ s(?:;|\r?$)/m.test(text);
}

export function watchFileStartup(options: { timeoutMs: number; clock?: Clock; stalled: (reason: string) => void }) {
  const clock = options.clock ?? realClock;
  const pending = new Map<string, { file: string; scope: TestProgress['scope']; timer: ClockTimer }>();
  const seen = new Set<string>();
  let stopped = false;
  // Existing reporter IDs carry admission identity: <reporter UUID>:<sequence>.
  const reporter = (id: string) => id.slice(0, Math.max(0, id.lastIndexOf(':')));
  const stop = () => {
    stopped = true;
    for (const entry of pending.values()) clock.clearTimeout(entry.timer);
    pending.clear();
  };
  return {
    stop,
    progress(row: TestProgress) {
      if (stopped || typeof row.id !== 'string' || typeof row.file !== 'string' || typeof row.name !== 'string') return;
      if (row.event === 'start' && row.type === 'file' && !seen.has(row.id)) {
        seen.add(row.id);
        pending.set(row.id, { file: row.file, scope: row.scope, timer: clock.setTimeout(() => {
          stop();
          options.stalled(`stalled: ${row.file} no test started within ${options.timeoutMs / 1000} s`);
        }, options.timeoutMs) });
      } else if (row.event === 'start' && (row.type === 'test' || row.type === 'suite')) {
        for (const [id, entry] of pending) if (entry.file === row.file && entry.scope === row.scope && reporter(id) === reporter(row.id)) {
          clock.clearTimeout(entry.timer); pending.delete(id);
        }
      } else if (row.event === 'finish' && row.type === 'file' && ['pass', 'fail', 'skip', 'todo'].includes(row.outcome ?? '')) {
        const entry = pending.get(row.id);
        if (entry?.file === row.file && entry.scope === row.scope) { clock.clearTimeout(entry.timer); pending.delete(row.id); }
      }
    },
  };
}
