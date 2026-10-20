// Finalized concurrent-edit sources have a bounded lifetime; temporary sources and
// recovery intents belong to the tracker recovery protocol and are never pruned here.
import { lstat, readFile, readdir, unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';

export const CONFLICT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const CONFLICT_PRUNE_INTERVAL_MS = 60 * 60 * 1000;
const capturePattern = /^([A-Z]-\d+-[^/]+\.md)\.[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.conflict$/;
const intentPattern = /^\.criterion-capture-[a-f0-9-]+\.json$/;
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT';

async function namesIn(dir: string): Promise<string[]> {
  try { return await readdir(dir); }
  catch (error) { if (missing(error)) return []; throw error; }
}

/** Off the request path. UUID capture names are never reused by the hub. Recent
 * inode changes protect a freshly promoted source even when its original mtime is old.
 * Abort is checked after every await, so shutdown cannot start another deletion. */
export async function pruneConflictCaptures(dir: string, now: number, signal?: AbortSignal): Promise<number> {
  const names = await namesIn(dir);
  if (signal?.aborted) return 0;
  const protectedSources = new Set<string>();
  for (const name of names.filter(name => intentPattern.test(name))) {
    try {
      const value: unknown = JSON.parse(await readFile(join(dir, name), 'utf8'));
      if (signal?.aborted) return 0;
      // An unreadable or incomplete intent cannot justify deleting any recovery source.
      if (!value || typeof value !== 'object' || !Object.hasOwn(value, 'captured')) throw new Error(`invalid capture intent: ${name}`);
      const captured = (value as { captured?: unknown }).captured;
      if (typeof captured !== 'string' || !captured || basename(captured) !== captured) throw new Error(`invalid capture intent: ${name}`);
      protectedSources.add(captured);
    } catch (error) { if (!missing(error)) throw error; }
    if (signal?.aborted) return 0;
  }
  let pruned = 0;
  for (const name of names) {
    if (signal?.aborted) break;
    if (!capturePattern.test(name) || protectedSources.has(name)) continue;
    const path = join(dir, name);
    try {
      const info = await lstat(path);
      if (signal?.aborted) break;
      if (!info.isFile() || now - Math.max(info.mtimeMs, info.ctimeMs, info.birthtimeMs) <= CONFLICT_RETENTION_MS) continue;
      await unlink(path);
      pruned++;
    } catch (error) { if (!missing(error)) throw error; }
  }
  return pruned;
}

/** Read-only snapshot for doctor; vanished captures are normal during pruning. */
export async function inspectConflictCaptures(dir: string): Promise<{ count: number; differing: string[] }> {
  let count = 0;
  const differing: string[] = [];
  for (const name of (await namesIn(dir)).sort()) {
    const item = capturePattern.exec(name)?.[1];
    if (!item) continue;
    let captured: Buffer;
    try {
      if (!(await lstat(join(dir, name))).isFile()) continue;
      captured = await readFile(join(dir, name));
    } catch (error) { if (missing(error)) continue; throw error; }
    count++;
    try {
      if (!captured.equals(await readFile(join(dir, item)))) differing.push(name);
    } catch (error) { if (missing(error)) differing.push(`${name} (item missing)`); else throw error; }
  }
  return { count, differing };
}
