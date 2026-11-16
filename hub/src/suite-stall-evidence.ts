import { isFileStartupStall } from './file-startup-watchdog.ts';

export type StallCommandState = {
  commandPid: number | null;
  exit: { code: number | null; signal: NodeJS.Signals | null } | null;
  stdout: 'open' | 'closed'; stderr: 'open' | 'closed';
};

/** Persist this receipt before fallible native inspection or termination. */
export function stallCommandEvidence(reason: string, state: StallCommandState) {
  return {
    cause: `${reason}; command exit ${state.exit ? state.exit.signal ?? state.exit.code : 'pending'}; stdout ${state.stdout}; stderr ${state.stderr}`,
    line: `suite stall command ${JSON.stringify(state)}`,
    startupLine: isFileStartupStall(reason) ? `suite stall startup ${reason}` : undefined,
  };
}
