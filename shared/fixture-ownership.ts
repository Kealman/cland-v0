// An open private receipt proves a fixture's ownership without inspecting its environment.
import { closeSync, constants, existsSync, lstatSync, mkdirSync, openSync, realpathSync, unlinkSync, writeSync, ftruncateSync } from 'node:fs';
import { lstat, open, realpath, type FileHandle } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { ignoreFixtureStorage } from './fake-layout.ts';
import { allocatedFixtureRoot } from './fixture-sockets.ts';

const beneath = (path: string, root: string) => path !== root && path.startsWith(root + '/');
const nativeCode = (error: unknown): string | null => typeof (error as NodeJS.ErrnoException | null)?.code === 'string' ? (error as NodeJS.ErrnoException).code! : null;
export class FixtureOwnershipRefused extends Error {
  readonly reason: 'unowned-root' | 'receipt-write-failed';
  readonly nativeCode: string | null;
  readonly cleanupCodes: Array<string | null>;
  constructor(reason: 'unowned-root' | 'receipt-write-failed', nativeCode: string | null = null, cleanupCodes: Array<string | null> = [], cause?: unknown) {
    super(reason === 'unowned-root' ? 'fixture ownership requires a fixture-owned scratch root' : 'fixture receipt write failed', { cause });
    this.reason = reason; this.nativeCode = nativeCode; this.cleanupCodes = cleanupCodes;
  }
}
// Resolve existing ancestors too: a missing leaf below a symlink cannot escape.
async function resolvedRoot(path: string): Promise<string> {
  try { return await realpath(path); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || dirname(path) === path) throw error;
    return join(await resolvedRoot(dirname(path)), path.slice(path.lastIndexOf('/') + 1));
  }
}

export type FixtureReceipt = { version: 1; pid: number; born: { min: number; max: number }; roots: string[]; sourceCheckout?: string };
const canonical = (path: string) => { try { return realpathSync(path); } catch { return resolve(path); } };
export const fixtureReceiptDirectory = () => join(canonical(tmpdir()), `cland-fixture-owners-${process.getuid?.() ?? 'unknown'}`);

/** Pass fd to exactly the fixture child, or keep it open in the fixture itself. */
export function fixtureOwnership(roots: string[], sourceCheckout?: string): { path: string; fd: number; bind: (pid: number, earliest?: number, latest?: number) => void; close: () => void; remove: () => void } {
  const owned = roots.map(canonical);
  const root = owned[0];
  if (!root || root === '/' || roots.some(path => !existsSync(path)) ||
      owned.some(path => !allocatedFixtureRoot(path) || path !== root && !beneath(path, root))) {
    throw new FixtureOwnershipRefused('unowned-root');
  }
  // The directory owner removes these after joining every writer, even when
  // SIGKILL prevents this process from running its exit callback.
  const storage = join(root, '.fixture-sockets');
  if (storage) {
    mkdirSync(storage, { mode: 0o700, recursive: true });
    const info = lstatSync(storage);
    if (!info.isDirectory() || info.uid !== process.getuid?.() || (info.mode & 0o077) !== 0) throw new Error('fixture ownership storage is not private');
    ignoreFixtureStorage(storage);
  }
  const dir = join(storage, 'owners');
  mkdirSync(dir, { mode: 0o700, recursive: true });
  const info = lstatSync(dir);
  if (!info.isDirectory() || info.uid !== process.getuid?.() || (info.mode & 0o077) !== 0) throw new Error('fixture ownership directory is not private');
  const path = join(dir, `${randomUUID()}.json`);
  const fd = openSync(path, 'wx+', 0o600);
  const createdAt = Date.now();
  // ps lstart has whole-second precision. A self receipt uses Node's process time origin;
  // a spawned child is bound to the parent's observed spawn interval instead.
  // Linux ps adds integer boot seconds to truncated start ticks, so its lstart
  // can be one second earlier than the parent's wall-clock spawn second too.
  const birth = Math.floor(performance.timeOrigin / 1000);
  const receipt: FixtureReceipt = { version: 1, pid: process.pid, born: { min: birth - 1, max: birth }, roots: owned,
    ...(sourceCheckout === undefined ? {} : { sourceCheckout: canonical(sourceCheckout) }) };
  const save = () => { const text = JSON.stringify(receipt); writeSync(fd, text, 0, 'utf8'); ftruncateSync(fd, Buffer.byteLength(text)); };
  try { save(); }
  catch (cause) {
    const cleanupCodes: Array<string | null> = [];
    try { closeSync(fd); } catch (error) { cleanupCodes.push(nativeCode(error)); }
    try { unlinkSync(path); } catch (error) { if (nativeCode(error) !== 'ENOENT') cleanupCodes.push(nativeCode(error)); }
    throw new FixtureOwnershipRefused('receipt-write-failed', nativeCode(cause), cleanupCodes, cause);
  }
  let closed = false;
  return { path, fd, bind: (pid, earliest = createdAt, latest = Date.now()) => { receipt.pid = pid; receipt.born = { min: Math.floor(earliest / 1000) - 1, max: Math.floor(latest / 1000) }; save(); }, close: () => { if (!closed) { closeSync(fd); closed = true; } }, remove: () => { try { unlinkSync(path); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; } } };
}

/** A refused optional receipt grants no authority and must not end a serving hub.
 * Native/cleanup metadata comes from the producer; unknown causes stay unknown.
 */
export function registerFixtureOwnership(roots: string[], sourceCheckout?: string) {
  try { return { outcome: 'registered' as const, owner: fixtureOwnership(roots, sourceCheckout) }; }
  catch (error) {
    return { outcome: 'refused' as const, diagnostic: {
      event: 'fixture-ownership-refused' as const, outcome: 'refused' as const, root: roots[0] ?? null,
      reason: error instanceof FixtureOwnershipRefused ? error.reason : 'unknown',
      nativeCode: error instanceof FixtureOwnershipRefused ? error.nativeCode : nativeCode(error),
      cleanupCodes: error instanceof FixtureOwnershipRefused ? error.cleanupCodes : [],
    } };
  }
}

/** Accept root-local private receipts only; never follow foreign roots or symlinks. */
export async function readFixtureReceipt(path: string): Promise<FixtureReceipt | null> {
  if (!/^[0-9a-f-]{36}\.json$/.test(path.slice(path.lastIndexOf('/') + 1))) return null;
  const localStorage = dirname(dirname(path));
  const localRoot = dirname(localStorage);
  const local = localStorage === join(localRoot, '.fixture-sockets') && dirname(path) === join(localStorage, 'owners');
  // Global receipts predate scratch-only registration and provide no safe root boundary.
  if (!local || localRoot === '/') return null;
  let file: FileHandle | undefined;
  try {
    if (local) {
      if (await realpath(localRoot) !== localRoot) return null;
      const storage = await lstat(localStorage);
      if (!storage.isDirectory() || storage.uid !== process.getuid?.() || (storage.mode & 0o077) !== 0) return null;
    }
    const dir = await lstat(dirname(path));
    if (!dir.isDirectory() || dir.uid !== process.getuid?.() || (dir.mode & 0o077) !== 0) return null;
    file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const info = await file.stat();
    if (!info.isFile() || info.uid !== process.getuid?.() || (info.mode & 0o077) !== 0 || info.size > 16_384) return null;
    const bytes = Buffer.alloc(16_385);
    let kept = 0;
    while (kept < bytes.length) {
      const { bytesRead } = await file.read(bytes, kept, bytes.length - kept, null);
      if (!bytesRead) break;
      kept += bytesRead;
    }
    if (kept > 16_384) return null;
    const value = JSON.parse(bytes.subarray(0, kept).toString('utf8'));
    // Association metadata grants no directory authority. Never stat, traverse or
    // resolve it here: the checkout may already be gone when a receipt is read.
    if (value.sourceCheckout !== undefined && (typeof value.sourceCheckout !== 'string' || value.sourceCheckout === '/' || !value.sourceCheckout.startsWith('/') || resolve(value.sourceCheckout) !== value.sourceCheckout)) return null;
    if (local && !value.roots?.includes(localRoot)) return null;
    if (!Array.isArray(value.roots)) return null;
    for (const root of value.roots) {
      if (typeof root !== 'string' || !root.startsWith('/') || (root !== localRoot && !beneath(root, localRoot)) || await resolvedRoot(root) !== root) return null;
    }
    return value.version === 1 && Number.isSafeInteger(value.pid) && value.pid > 1 && Number.isSafeInteger(value.born?.min) && Number.isSafeInteger(value.born?.max) && value.born.min <= value.born.max && Array.isArray(value.roots) && value.roots.length > 0 && value.roots.every((root: unknown) => typeof root === 'string' && root.startsWith('/')) ? value : null;
  } catch { return null; }
  finally { await file?.close(); }
}
