// An open private receipt proves a fixture's ownership without inspecting its environment.
import { closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, unlinkSync, writeSync, ftruncateSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

export type FixtureReceipt = { version: 1; pid: number; born: { min: number; max: number }; roots: string[] };
const canonical = (path: string) => { try { return realpathSync(path); } catch { return resolve(path); } };
export const fixtureReceiptDirectory = () => join(canonical(tmpdir()), `cland-fixture-owners-${process.getuid?.() ?? 'unknown'}`);

/** Pass fd to exactly the fixture child, or keep it open in the fixture itself. */
export function fixtureOwnership(roots: string[]): { path: string; fd: number; bind: (pid: number, earliest?: number, latest?: number) => void; close: () => void; remove: () => void } {
  const dir = fixtureReceiptDirectory();
  mkdirSync(dir, { mode: 0o700, recursive: true });
  const info = lstatSync(dir);
  if (!info.isDirectory() || info.uid !== process.getuid?.() || (info.mode & 0o077) !== 0) throw new Error('fixture ownership directory is not private');
  const path = join(dir, `${randomUUID()}.json`);
  const fd = openSync(path, 'wx+', 0o600);
  const createdAt = Date.now();
  // ps lstart has whole-second precision. A self receipt uses Node's process time origin;
  // a spawned child is bound to the parent's observed spawn interval instead.
  const birth = Math.floor(performance.timeOrigin / 1000);
  const receipt: FixtureReceipt = { version: 1, pid: process.pid, born: { min: birth - 1, max: birth }, roots: roots.map(canonical) };
  const save = () => { const text = JSON.stringify(receipt); writeSync(fd, text, 0, 'utf8'); ftruncateSync(fd, Buffer.byteLength(text)); };
  save();
  let closed = false;
  return { path, fd, bind: (pid, earliest = createdAt, latest = Date.now()) => { receipt.pid = pid; receipt.born = { min: Math.floor(earliest / 1000), max: Math.floor(latest / 1000) }; save(); }, close: () => { if (!closed) { closeSync(fd); closed = true; } }, remove: () => { try { unlinkSync(path); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; } } };
}

/** Only paths in our private receipt directory are read; symlinks and loose files fail closed. */
export function readFixtureReceipt(path: string): FixtureReceipt | null {
  if (dirname(path) !== fixtureReceiptDirectory() || !/^[0-9a-f-]{36}\.json$/.test(path.slice(path.lastIndexOf('/') + 1))) return null;
  let fd: number | undefined;
  try {
    const dir = lstatSync(dirname(path));
    if (!dir.isDirectory() || dir.uid !== process.getuid?.() || (dir.mode & 0o077) !== 0) return null;
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const info = fstatSync(fd);
    if (!info.isFile() || info.uid !== process.getuid?.() || (info.mode & 0o077) !== 0 || info.size > 16_384) return null;
    const value = JSON.parse(readFileSync(fd, 'utf8'));
    return value.version === 1 && Number.isSafeInteger(value.pid) && value.pid > 1 && Number.isSafeInteger(value.born?.min) && Number.isSafeInteger(value.born?.max) && value.born.min <= value.born.max && Array.isArray(value.roots) && value.roots.length > 0 && value.roots.every((root: unknown) => typeof root === 'string' && root.startsWith('/')) ? value : null;
  } catch { return null; }
  finally { if (fd !== undefined) closeSync(fd); }
}
