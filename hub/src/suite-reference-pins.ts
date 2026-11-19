import { lstat, mkdir, open, realpath, link } from 'node:fs/promises';
import { SUITE_RETENTION_BATCH_SIZE } from './suite-retention-policy.ts';
import { constants } from 'node:fs';
import { join, resolve } from 'node:path';

/** Immutable admission records: P pins forever, R fences future publishers.
 * Empty, malformed or interrupted records are never reclaimed by age.
 * O_EXCL chooses the winner across processes before either side proceeds.
 */
async function fence(root: string, id: string, desired?: 'P' | 'R'): Promise<'P' | 'R' | 'unknown' | 'absent'> {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('invalid suite run id');
  let directory = await realpath(root);
  for (const part of ['.cland', 'run', 'suite-references']) {
    const parentPath = directory;
    directory = join(directory, part);
    if (desired) {
      await mkdir(directory, {mode:0o700}).catch(error => { if (error.code !== 'EEXIST') throw error; });
      const parent = await open(parentPath, 'r');
      try { await parent.sync(); } finally { await parent.close(); }
    }
    const info = await lstat(directory).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (!info) return 'absent';
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('refusing linked suite reference directory');
  }
  const path = join(directory, id);
  let created = false;
  const file = await (desired ? open(path, constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
    .then(file => { created = true; return file; }, error => {
      if (error.code !== 'EEXIST') throw error;
      return open(path, constants.O_RDWR | constants.O_NOFOLLOW);
    }) : open(path, constants.O_RDONLY | constants.O_NOFOLLOW).catch(error => { if (error.code === 'ENOENT') return null; throw error; }));
  if (!file) return 'absent';
  try {
    if (!(await file.stat()).isFile()) throw new Error('refusing nonregular suite reference record');
    if (created) await file.writeFile(desired!);
    // Readers also sync: another publisher must never rely on unsynced bytes.
    if (desired) await file.sync();
    const buffer = Buffer.alloc(2);
    const {bytesRead} = await file.read(buffer, 0, 2, 0);
    const value = bytesRead === 1 ? buffer.toString('utf8', 0, 1) : '';
    if (desired) {
      const parent = await open(directory, 'r');
      try { await parent.sync(); } finally { await parent.close(); }
    }
    return value === 'P' || value === 'R' ? value : 'unknown';
  } finally { await file.close(); }
}

export async function suiteRunPinned(root: string, id: string): Promise<boolean> {
  const state = await fence(root, id);
  return state === 'P' || state === 'unknown';
}

export async function pinSuiteRun(root: string, id: string): Promise<void> {
  if (await fence(root, id, 'P') !== 'P') throw new Error(`suite run ${id} is retired or has unknown reference admission; raw-run reference refused`);
}

/** Verdict run labels predate suite ids and may contain spaces or punctuation.
 * Only literal suite identities can name a root owned by retention. */
export async function pinSuiteReference(root: string, id: string): Promise<void> {
  if (/^[A-Za-z0-9_-]+$/.test(id)) await pinSuiteRun(root, id);
}

/** One tracker lifetime owns its positive admission checkpoint. Durable records
 * are immutable, so a synced success needs no further I/O in this owner.
 * Recovery starts empty and revalidates lazily; failure never seeds success. */
export class SuiteReferencePins {
  readonly #root: string;
  readonly #completed = new Set<string>();
  readonly #pending = new Map<string, Promise<void>>();
  constructor(root: string) { this.#root = root; }
  pin(id: string): Promise<void> {
    if (!/^[A-Za-z0-9_-]+$/.test(id) || this.#completed.has(id)) return Promise.resolve();
    const pending = this.#pending.get(id);
    if (pending) return pending;
    const work = pinSuiteReference(this.#root, id)
      .then(() => { this.#completed.add(id); })
      .finally(() => { this.#pending.delete(id); });
    this.#pending.set(id, work);
    return work;
  }
}

/** Raw duration inputs can belong to another checkout; pin their actual owner
 * before opening the input. Durable artifact inputs need no raw-root pin. */
export async function pinSuiteLog(path: string): Promise<string> {
  const pin = async (input: string) => {
    const match = /^(.*)\/\.cland\/run\/suites\/([^/]+)\/.+$/.exec(input);
    if (!match) return;
    if (!/^[A-Za-z0-9_-]+$/.test(match[2]!)) throw new Error('raw-run reference refused: unsupported suite directory');
    await pinSuiteRun(match[1]!, match[2]!);
  };
  // Pin lexical ownership first, even if retirement already removed the input.
  await pin(resolve(path));
  const canonical = await realpath(path);
  if (canonical !== resolve(path)) await pin(canonical);
  // Consumption must use this captured identity, never reopen the caller's
  // mutable alias after pinning the run that alias used to name.
  return canonical;
}

/** Inspection never claims retirement. Removal claims remain after deletion so
 * a delayed publisher cannot resurrect a reference to a removed raw run. */
export async function claimSuiteRetirement(root: string, id: string): Promise<boolean> {
  return await fence(root, id, 'R') === 'R';
}

/** One synced immutable R inode can fence an entire bounded batch. Each link
 * competes atomically with P creation. No deletion starts before the directory
 * sync makes every successful link durable; a crash earlier only retains runs. */
export async function claimSuiteRetirements(root:string, ids:readonly string[]):Promise<Set<string>> {
  if(ids.length>SUITE_RETENTION_BATCH_SIZE)throw new Error('retirement claim batch exceeds 32');
  const canonical=await realpath(root),directory=join(canonical,'.cland/run/suite-references');
  const claimed=new Set<string>();
  let anchor:string|undefined;
  for(const id of ids) {
    if(!/^[A-Za-z0-9_-]+$/.test(id))throw new Error('invalid suite run id');
    if(!anchor) {
      if(await claimSuiteRetirement(canonical,id)){anchor=id;claimed.add(id);}
      continue;
    }
    try {await link(join(directory,anchor),join(directory,id));claimed.add(id);}
    catch(error) {
      if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;
      if(await claimSuiteRetirement(canonical,id))claimed.add(id);
    }
  }
  if(anchor) {
    const parent=await open(directory,'r');
    try {await parent.sync();} finally {await parent.close();}
  }
  return claimed;
}
