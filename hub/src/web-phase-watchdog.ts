import { realClock, type Clock, type ClockTimer } from './hub/clock.ts';
import type { TestProgress } from './suite-progress.ts';
import { projectedWall } from './suite-tier-report.ts';

export function watchWebPhase(options: { fileSeconds: number[]; workers: number; clock?: Clock; stalled: (reason: string) => void }) {
  const clock = options.clock ?? realClock;
  const projected = projectedWall(options.fileSeconds, options.workers);
  const ceilingMs = Math.max(300_000, Math.ceil(projected * 3_000));
  const noProgressMs = 60_000;
  let stopped = false;
  let lastFile = 'unavailable (no start/finish receipt)';
  let idle: ClockTimer;
  const stop = () => { stopped = true; clock.clearTimeout(total); clock.clearTimeout(idle); };
  const fail = (reason: string) => { if (stopped) return; stop(); options.stalled(reason); };
  const silence = () => fail(`Web phase no test progress for ${noProgressMs / 1000} s; last file ${lastFile}`);
  const total = clock.setTimeout(() => fail(`Web phase exceeded ${ceilingMs / 1000} s total ceiling (${projected} s projected wall)`), ceilingMs);
  idle = clock.setTimeout(silence, noProgressMs);
  return {
    progress(row: Pick<TestProgress, 'event' | 'file'>) {
      if (stopped || !['start', 'finish'].includes(row?.event) || typeof row.file !== 'string' || !row.file.startsWith('web/test/')) return;
      lastFile = row.file;
      clock.clearTimeout(idle);
      idle = clock.setTimeout(silence, noProgressMs);
    },
    stop,
  };
}
