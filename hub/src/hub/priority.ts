import { getPriority } from 'node:os';

export type HubPriority = {
  /** Startup niceness; null when the OS probe is unavailable. */
  nice: number | null;
  warning?: { detail: string; fix: string };
};

/** Observe only: lowering inherited niceness can require privileges. */
export function hubPriority(probe: () => number = () => getPriority(0)): HubPriority {
  let nice: number;
  try { nice = probe(); }
  catch { return { nice: null }; }
  if (nice <= 0) return { nice };
  return {
    nice,
    warning: {
      detail: `hub runs below normal priority (nice ${nice}); inherited from its launcher, for example zsh BG_NICE for background jobs; CPU contention can delay hub responses`,
      fix: 'restart at nice 0: from a foreground shell running at nice 0, run `unsetopt BG_NICE` (zsh), then `cland hub stop` and `cland hub start` without `&`',
    },
  };
}
