// Real tip reads, scheduled by the test instead of a wall-clock timer or tracker-change poke.
import type { TestContext } from 'node:test';
import { serveProject } from '../src/hub/daemon.ts';
import type { TipSchedule } from '../src/tracker/freshness.ts';

export function manualTips() {
  let read: (() => Promise<void>) | null = null;
  const scheduleTips: TipSchedule = (refresh) => {
    read = refresh;
    return { poke: () => {}, stop: () => { read = null; } };
  };
  return {
    scheduleTips,
    refresh: async () => {
      if (!read) throw new Error('tip scheduler is not running');
      await read();
    },
  };
}

/** Real hub sockets and child CLI commands, with tip reads driven in this process. */
export async function startFreshnessDaemon(t: TestContext, root: string) {
  const tips = manualTips();
  const daemon = await serveProject(root, { scheduleTips: tips.scheduleTips });
  t.after(() => daemon.stop());
  if (!daemon.discovery) throw new Error('freshness daemon has no listeners');
  await tips.refresh();
  return { discovery: daemon.discovery, refresh: tips.refresh };
}
