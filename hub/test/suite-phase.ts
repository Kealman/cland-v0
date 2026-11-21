import type { Clock } from '../src/hub/clock.ts';
import type { TestProgress } from '../src/suite-progress.ts';
import { watchWebPhase } from '../src/web-phase-watchdog.ts';
import { watchFileStartup } from '../src/file-startup-watchdog.ts';
import { stallCommandEvidence, type StallCommandState } from '../src/suite-stall-evidence.ts';
import { startupOwnerLine } from '../src/suite-startup-owner.ts';

export type RepetitionProgressObserver = (owner: string, row: TestProgress) => void;
const MAX_PROGRESS_LINE_BYTES = 64 * 1024;

/** One phase joins its timeout cleanup before publishing its native exit. */
export function watchSuitePhase(options: {
  exit: Promise<number>; startupMs: number; clock?: Clock;
  web?: { fileSeconds: number[]; workers: number };
  commandState: () => StallCommandState;
  report: (line: string) => void;
  owner: { id: string; report: (line: string) => void };
  stalled: (reason: string) => Promise<void>;
  observed?: (row: TestProgress) => void;
}) {
  let cleanup: Promise<void> | undefined;
  let pending = '';
  let pendingBytes = 0;
  let discarding = false;
  const stalled = (reason: string) => {
    if (cleanup) return;
    const evidence = stallCommandEvidence(reason, options.commandState());
    options.report(evidence.line);
    if (evidence.startupLine) options.report(evidence.startupLine);
    options.report(evidence.cause);
    cleanup = options.stalled(reason);
    void cleanup.catch(() => {});
  };
  const web = options.web ? watchWebPhase({ ...options.web, ...(options.clock ? { clock: options.clock } : {}), stalled }) : undefined;
  const startup = watchFileStartup({ timeoutMs: options.startupMs, ...(options.clock ? { clock: options.clock } : {}), stalled });
  const stop = () => { web?.stop(); startup.stop(); };
  const progress = (row: TestProgress) => {
    web?.progress(row); startup.progress(row);
    options.observed?.(row);
  };
  options.owner.report(startupOwnerLine({ id: options.owner.id, event: 'start' }));
  const result = options.exit.finally(stop).then(async code => {
    await cleanup;
    return cleanup ? 1 : code;
  });
  void result.catch(() => {});
  return {
    stop, result,
    get bufferedBytes() { return Buffer.byteLength(pending); },
    output(text: string) {
      let offset = 0;
      while (offset < text.length) {
        const newline = text.indexOf('\n', offset);
        const end = newline < 0 ? text.length : newline;
        if (!discarding) {
          const part = text.slice(offset, end);
          const bytes = Buffer.byteLength(part);
          if (pendingBytes + bytes > MAX_PROGRESS_LINE_BYTES) {
            pending = ''; pendingBytes = 0; discarding = true;
          } else { pending += part; pendingBytes += bytes; }
        }
        if (newline < 0) break;
        if (!discarding && pending.startsWith('suite progress ')) {
          try { progress(JSON.parse(pending.slice('suite progress '.length)) as TestProgress); }
          catch { /* Torn reporter output supplies no receipt. */ }
        }
        pending = ''; pendingBytes = 0; discarding = false;
        offset = end + 1;
      }
    },
    finished() { stop(); options.owner.report(startupOwnerLine({ id: options.owner.id, event: 'finish' })); },
    progress,
  };
}
