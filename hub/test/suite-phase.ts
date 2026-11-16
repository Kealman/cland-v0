import type { Clock } from '../src/hub/clock.ts';
import type { TestProgress } from '../src/suite-progress.ts';
import { watchWebPhase } from '../src/web-phase-watchdog.ts';
import { watchFileStartup } from '../src/file-startup-watchdog.ts';
import { stallCommandEvidence, type StallCommandState } from '../src/suite-stall-evidence.ts';
import { startupOwnerLine } from '../src/suite-startup-owner.ts';

/** One phase joins its timeout cleanup before publishing its native exit. */
export function watchSuitePhase(options: {
  exit: Promise<number>; startupMs: number; clock?: Clock;
  web?: { fileSeconds: number[]; workers: number };
  commandState: () => StallCommandState;
  report: (line: string) => void;
  owner: { id: string; report: (line: string) => void };
  stalled: (reason: string) => Promise<void>;
}) {
  let cleanup: Promise<void> | undefined;
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
  options.owner.report(startupOwnerLine({ id: options.owner.id, event: 'start' }));
  const result = options.exit.finally(stop).then(async code => {
    await cleanup;
    return cleanup ? 1 : code;
  });
  void result.catch(() => {});
  return {
    stop, result,
    finished() { stop(); options.owner.report(startupOwnerLine({ id: options.owner.id, event: 'finish' })); },
    progress(row: TestProgress) { web?.progress(row); startup.progress(row); },
  };
}
