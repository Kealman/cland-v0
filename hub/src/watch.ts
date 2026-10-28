// A folder watch that recovers missed events and survives a place where watching is refused. In a macOS sandbox (Codex's seatbelt, which
// the hub's own tests run in when a sandboxed session runs them) FSEvents is denied: `fs.watch` returns a watcher
// and then reports EMFILE on it. The hub then polls instead: slower to notice a hand edit, never blind to it.
import { watch, type FSWatcher } from 'node:fs';
import type { LogFn } from './log.ts';

/** How often the fallback looks, ms. */
export const POLL_MS = 500;
/** Healthy-watch reconciliation: 5 s keeps recovery below the 15 s observation budget.
 * On 1,415 copied items, unchanged stamps cost ~12 ms median (10–37 ms),
 * zero reads/parses; event-loop delay mean 2.25 ms, max 33 ms on macOS.
 * Use this slower interval to keep all-day metadata traffic modest. */
export const SAFETY_POLL_MS = 5000;

export type FolderWatch = { close: () => void };

/**
 * Watch `dir`: `changed(name)` for each event (`name` null when the platform gives none). When the watch cannot
 * start or fails later, `poll()` runs every `POLL_MS` instead and must find the changes itself; the failure is
 * logged once as `event`. A healthy watch calls `poll()` every `SAFETY_POLL_MS` too.
 */
export function watchFolder(dir: string, handlers: { changed: (name: string | null) => void; poll: () => void }, options: { env?: NodeJS.ProcessEnv; log: LogFn; event: string; unref?: boolean }): FolderWatch {
  let watcher: FSWatcher | null = null;
  let timer: NodeJS.Timeout | null = null;
  let closed = false;
  let failed = false;
  const fallBack = (error: string) => {
    if (closed || failed) return;
    failed = true;
    watcher?.close();
    watcher = null;
    if (timer) clearInterval(timer);
    options.log({ event: options.event, error, polling: POLL_MS });
    timer = setInterval(handlers.poll, POLL_MS);
    timer.unref();
  };
  try {
    // a test's stand-in for a sandbox that refuses the watch
    if ((options.env ?? process.env).CLAND_TEST_WATCH_REFUSED === '1') throw new Error('EMFILE: too many open files, watch');
    watcher = watch(dir, (_event, name) => handlers.changed(name === null ? null : String(name)));
    watcher.on('error', (err) => fallBack(err.message));
    if (options.unref) watcher.unref();
    timer = setInterval(handlers.poll, SAFETY_POLL_MS);
    timer.unref();
  } catch (err) {
    fallBack(err instanceof Error ? err.message : String(err));
  }
  return {
    close: () => {
      closed = true;
      watcher?.close();
      watcher = null;
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
