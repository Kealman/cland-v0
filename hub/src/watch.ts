// A folder watch that survives a place where watching is refused. In a macOS sandbox (Codex's seatbelt, which
// the hub's own tests run in when a sandboxed session runs them) FSEvents is denied: `fs.watch` returns a watcher
// and then reports EMFILE on it. The hub then polls instead: slower to notice a hand edit, never blind to it.
import { watch, type FSWatcher } from 'node:fs';
import type { LogFn } from './log.ts';

/** How often the fallback looks, ms. */
export const POLL_MS = 500;

export type FolderWatch = { close: () => void };

/**
 * Watch `dir`: `changed(name)` for each event (`name` null when the platform gives none). When the watch cannot
 * start or fails later, `poll()` runs every `POLL_MS` instead and must find the changes itself; the failure is
 * logged once as `event`.
 */
export function watchFolder(dir: string, handlers: { changed: (name: string | null) => void; poll: () => void }, options: { env?: NodeJS.ProcessEnv; log: LogFn; event: string; unref?: boolean }): FolderWatch {
  let watcher: FSWatcher | null = null;
  let timer: NodeJS.Timeout | null = null;
  let closed = false;
  const fallBack = (error: string) => {
    watcher?.close();
    watcher = null;
    if (closed || timer) return;
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
