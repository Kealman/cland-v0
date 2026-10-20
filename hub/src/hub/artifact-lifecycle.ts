import { realClock, type Clock } from './clock.ts';
// Artifact promotion and retention own their I/O reservations. Topic moves stay synchronous;
// operations re-read the index after I/O, so a close/reopen is never overwritten by a stale artifact.
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { Artifact } from '../protocol.ts';
import type { Store } from './store.ts';
import { folderName } from './artifact-folder.ts';
import { ArtifactError } from './artifacts.ts';

export type Resumed = <T>(body: () => T) => T;
export type ArtifactOperationResult = { artifact: Artifact; followUp?: { error: string } };
export type ArtifactFiles = Pick<typeof fs, 'copyFile' | 'mkdir' | 'lstat' | 'readdir' | 'realpath' | 'unlink' | 'link' | 'rename' | 'rm'>;
const direct: Resumed = body => body();
type IO<T> = Generator<Promise<unknown>, T, unknown>;

/** The scheduler supplies exactly the result of the yielded promise. */
function* wait<T>(promise: Promise<T>): IO<T> { return (yield promise) as T; }

/** Each whole continuation after I/O, including failures/finally, is one measured resumed scope. */
async function run<T>(operation: IO<T>, resumed: Resumed): Promise<T> {
  let step = operation.next();
  while (!step.done) {
    let value: unknown;
    try { value = await step.value; }
    catch (err) { step = resumed(() => operation.throw(err)); continue; }
    step = resumed(() => operation.next(value));
  }
  return step.value;
}

export class ArtifactLifecycle {
  readonly #clock: Clock;
  readonly #store: Store;
  readonly #root: string | undefined;
  readonly #files: ArtifactFiles;
  readonly #changed: (a: Artifact) => void;
  readonly #busy = new Set<string>();

  constructor(store: Store, root: string | undefined, changed: (a: Artifact) => void, files: ArtifactFiles = fs, clock: Clock = realClock) {
    this.#clock = clock;
    this.#store = store; this.#root = root; this.#changed = changed; this.#files = files;
  }

  #available(id: string, allowPromoted = false): Artifact {
    const a = this.#store.artifact(id);
    if (this.#deleting(a)) throw new ArtifactError('artifact-busy', 'this artifact has an interrupted deletion; retry after recovery');
    if (!a || a.fileDeleted) throw new ArtifactError('artifact-unavailable', 'no artifact file is available');
    if (a.movedTo) throw new ArtifactError('artifact-path', 'this artifact was absorbed into a folder; edit its folder instead');
    if (a.promoted && !allowPromoted) throw new ArtifactError('artifact-path', `already promoted: ${a.promoted}`);
    return a;
  }

  #deleting(a: Artifact | null): boolean {
    return !!a?.deletion || !!a?.folder && this.#store.movedArtifacts().some(child => child.movedTo?.folder === a.id && child.deletion);
  }

  *#destination(path: string): IO<{ root: string; path: string }> {
    if (!this.#root) throw new ArtifactError('artifact-unavailable', 'this hub serves no project for artifacts');
    if (typeof path !== 'string' || !path.trim() || isAbsolute(path) || path.includes('\0')) throw new ArtifactError('artifact-path', 'use a project-relative destination');
    const parts = path.split(/[\\/]/);
    if (parts.some(p => p === '..' || p.toLowerCase() === '.cland' || p.toLowerCase() === '.git')) throw new ArtifactError('artifact-path', 'destination must stay in the project, outside .cland and .git');
    const root = yield* wait(this.#files.realpath(this.#root));
    const destination = resolve(root, path);
    this.#confined(root, destination);
    // Never descend through symlinks. Recursive mkdir could create directories outside the repo.
    let parent = root;
    for (const p of relative(root, dirname(destination)).split(sep).filter(Boolean)) {
      parent = join(parent, p);
      try { yield* wait(this.#files.mkdir(parent)); }
      catch (err) { if (!hasCode(err, 'EEXIST')) throw err; }
      const stat = yield* wait(this.#files.lstat(parent));
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new ArtifactError('artifact-path', 'destination parents must be real project directories');
    }
    return { root, path: destination };
  }

  #confined(root: string, path: string): void {
    const rel = relative(root, path);
    if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel) ||
        rel.split(sep).some(p => p.toLowerCase() === '.cland' || p.toLowerCase() === '.git')) {
      throw new ArtifactError('artifact-path', 'destination must stay in the project, outside .cland and .git');
    }
  }

  promote(id: string, path: string, authorize: () => void, resumed: Resumed = direct): Promise<ArtifactOperationResult> {
    return run(this.#promote(id, path, authorize), resumed);
  }

  *#copyFolder(source: string, destination: string, root: string, authorize: () => void): IO<void> {
    const info = yield* wait(this.#files.lstat(source));
    if (!info.isDirectory() || info.isSymbolicLink()) throw new ArtifactError('artifact-source', 'artifact folders must be real directories');
    const names = yield* wait(this.#files.readdir(source));
    for (const name of names.sort()) {
      authorize();
      const from = join(source, name), to = join(destination, name);
      this.#confined(root, to);
      const child = yield* wait(this.#files.lstat(from));
      if (child.isSymbolicLink() || (!child.isDirectory() && !child.isFile())) throw new ArtifactError('artifact-source', 'artifact folders contain only regular files and directories, without symbolic links');
      if (child.isDirectory()) {
        yield* wait(this.#files.mkdir(to));
        yield* this.#copyFolder(from, to, root, authorize);
      } else {
        yield* wait(this.#files.copyFile(from, to, constants.COPYFILE_EXCL));
      }
      this.#confined(root, yield* wait(this.#files.realpath(to)));
    }
  }

  *#promote(id: string, path: string, authorize: () => void): IO<ArtifactOperationResult> {
    authorize();
    const a = this.#available(id);
    if (this.#busy.has(id)) throw new ArtifactError('artifact-busy', 'this artifact has an operation in progress; retry');
    this.#busy.add(id); // reserve before the first I/O, also against cleanup
    let destination: string | undefined;
    let copied = false;
    try {
      const prepared = yield* this.#destination(path);
      destination = prepared.path;
      authorize(); this.#available(id);
      // Exclusive creation reserves the entire destination. A partial tree is ours to
      // remove on failure; an existing directory, file or symlink is never touched.
      if (a.folder) {
        yield* wait(this.#files.mkdir(destination)); copied = true;
        yield* this.#copyFolder(a.path, destination, prepared.root, authorize);
        const entry = join(destination, folderName(a.entry));
        const info = yield* wait(this.#files.lstat(entry));
        if (!info.isFile() || info.isSymbolicLink()) throw new ArtifactError('artifact-source', 'the folder entry must be a regular file');
      } else {
        yield* wait(this.#files.copyFile(a.path, destination, constants.COPYFILE_EXCL)); copied = true;
      }
      const actual = yield* wait(this.#files.realpath(destination));
      this.#confined(prepared.root, actual);
      authorize();
      const current = this.#available(id); // topic may have closed or reopened during the copy
      const next: Artifact = { ...current, promoted: path, status: 'shared' };
      delete next.archivedAt;
      this.#store.updateArtifact(next);
      // Publication follows the commit. Its failure cannot roll back committed bytes alone.
      try { this.#changed(next); }
      catch (err) { return { artifact: next, followUp: { error: err instanceof Error ? err.message : String(err) } }; }
      return { artifact: next };
    } catch (err) {
      // A copied destination is ours alone. Roll it back if authorisation or the index commit failed.
      if (copied && destination) {
        try { yield* wait(a.folder ? this.#files.rm(destination, { recursive: true }) : this.#files.unlink(destination)); }
        catch (rollback) { throw new AggregateError([err, rollback], `promotion failed and rollback could not remove ${destination}; remove this unindexed copy before retrying`); }
      }
      throw err;
    } finally {
      this.#busy.delete(id);
    }
  }

  keep(id: string, kept: boolean): Artifact {
    const current = this.#available(id, true);
    const next: Artifact = { ...current, kept };
    if (kept && next.status === 'archived') {
      next.status = 'shared'; delete next.archivedAt; delete next.explicitArchive;
    } else if (!kept && this.#store.topic(next.topic)?.status === 'closed' && !this.#store.humanArtifact(next)) {
      next.status = 'archived'; next.archivedAt = this.#clock.now().toISOString();
    }
    this.#store.updateArtifact(next); this.#changed(next);
    return next;
  }

  archive(id: string): Artifact {
    const current = this.#available(id, true);
    const next: Artifact = { ...current, status: 'archived', archivedAt: this.#clock.now().toISOString(), explicitArchive: true };
    this.#store.updateArtifact(next); this.#changed(next);
    return next;
  }

  /** Human deletion keeps a tombstone for history. Reserve the owning folder too:
   * moving, promoting and retention must not change its path during the delete. */
  delete(id: string, authorize: () => void, resumed: Resumed = direct): Promise<ArtifactOperationResult> {
    return run(this.#delete(id, authorize), resumed);
  }

  *#delete(id: string, authorize: () => void): IO<ArtifactOperationResult> {
    authorize();
    const source = this.#store.artifact(id), resolved = this.#store.resolveArtifact(id);
    if (!source || !resolved || resolved.fileDeleted) throw new ArtifactError('artifact-unavailable', 'no artifact file is available');
    const ids = [id, ...(source.movedTo ? [source.movedTo.folder] : [])];
    if (ids.some(key => this.#busy.has(key) || this.#deleting(this.#store.artifact(key)))) throw new ArtifactError('artifact-busy', 'an artifact has an operation in progress; retry');
    if (!this.#root) throw new ArtifactError('artifact-unavailable', 'this hub serves no project for artifacts');
    for (const key of ids) this.#busy.add(key);
    const storage = join(this.#root, '.cland', 'artifact-deletions');
    const backup = join(storage, id + '-' + randomUUID());
    let committed = false, intent = false;
    try {
      if (source.movedTo) {
        const owner = this.#store.artifact(source.movedTo.folder)!;
        const info = yield* wait(this.#files.lstat(owner.path));
        if (!info.isDirectory() || info.isSymbolicLink()) throw new ArtifactError('artifact-path', 'the folder must be a real directory');
      }
      yield* wait(this.#files.mkdir(storage, { recursive: true }));
      const storageInfo = yield* wait(this.#files.lstat(storage));
      if (!storageInfo.isDirectory() || storageInfo.isSymbolicLink()) throw new ArtifactError('artifact-path', 'deletion storage must be a real directory');
      authorize();
      this.#store.updateArtifact({ ...this.#store.artifact(id)!, deletion: { path: resolved.path, backup } }); intent = true;
      yield* wait(this.#files.rename(resolved.path, backup));
      authorize();
      const current = this.#store.artifact(id)!;
      const next = { ...current, fileDeleted: true };
      this.#store.updateArtifact(next); committed = true;
      this.#changed(next);
      if (source.movedTo) this.#changed(this.#store.artifact(source.movedTo.folder)!);
      if (source.folder) {
        for (const moved of this.#store.movedArtifacts()) {
          if (moved.movedTo?.folder === id) this.#changed({ ...moved, fileDeleted: true });
        }
      }
      yield* this.#finishDeletion(next);
      return { artifact: this.#store.resolveArtifact(id)! };
    } catch (err) {
      if (committed) return { artifact: this.#store.resolveArtifact(id)!, followUp: { error: err instanceof Error ? err.message : String(err) } };
      if (intent) {
        try { yield* this.#recoverDeletion(this.#store.artifact(id)!); }
        catch (recovery) { throw new AggregateError([err, recovery], `deletion failed and rollback could not restore ${resolved.path}; preserve the live path and ${backup}, and recover both before retrying`); }
      }
      throw err;
    } finally { for (const key of ids) this.#busy.delete(key); }
  }

  #clearDeletion(id: string): void {
    const next = { ...this.#store.artifact(id)! };
    delete next.deletion;
    this.#store.updateArtifact(next);
  }

  *#removeOriginal(moved: Artifact, bytes: string): IO<void> {
    const original = yield* wait(this.#files.lstat(moved.path).catch(err => { if (hasCode(err, 'ENOENT')) return null; throw err; }));
    if (!original || !original.isFile() || original.isSymbolicLink()) return;
    const target = yield* wait(this.#files.lstat(bytes).catch(err => { if (hasCode(err, 'ENOENT')) return null; throw err; }));
    if (target?.isFile() && original.dev === target.dev && original.ino === target.ino) yield* this.#unlinkIfPresent(moved.path);
  }

  *#finishDeletion(a: Artifact): IO<void> {
    const backup = a.deletion!.backup;
    // A committed move may still have its old hard link. Remove only the same inode;
    // a new file recreated at the old path belongs to the human and must survive.
    if (a.movedTo) yield* this.#removeOriginal(a, backup);
    if (a.folder) {
      for (const moved of this.#store.movedArtifacts()) {
        if (moved.movedTo?.folder === a.id) yield* this.#removeOriginal(moved, join(backup, folderName(moved.movedTo.path)));
      }
    }
    yield* wait(this.#files.rm(backup, { recursive: !!a.folder, force: true }));
    this.#clearDeletion(a.id);
  }

  *#recoverDeletion(a: Artifact): IO<void> {
    if (a.fileDeleted) { yield* this.#finishDeletion(a); return; }
    const { backup, path } = a.deletion!;
    const retained = yield* wait(this.#files.lstat(backup).catch(err => { if (hasCode(err, 'ENOENT')) return null; throw err; }));
    if (retained) {
      const live = yield* wait(this.#files.lstat(path).catch(err => { if (hasCode(err, 'ENOENT')) return null; throw err; }));
      if (live) {
        if (a.folder || live.dev !== retained.dev || live.ino !== retained.ino) throw new ArtifactError('artifact-busy', 'both live and deletion backup exist; recover them before retrying');
        // A previous exclusive restoration may have committed before unlink failed.
        yield* this.#unlinkIfPresent(backup);
      } else if (a.folder) yield* wait(this.#files.rename(backup, path));
      else {
        // Exclusive restoration also protects a save arriving after the lstat.
        yield* wait(this.#files.link(backup, path));
        yield* this.#unlinkIfPresent(backup);
      }
    }
    this.#clearDeletion(a.id);
  }

  move(id: string, folder: string, name: string | undefined, authorize: () => void, resumed: Resumed = direct): Promise<ArtifactOperationResult> {
    return run(this.#move(id, folder, name, authorize), resumed);
  }

  *#move(id: string, folder: string, name: string | undefined, authorize: () => void): IO<ArtifactOperationResult> {
    authorize();
    const source = this.#available(id), target = this.#available(folder);
    if (source.folder) throw new ArtifactError('artifact-path', 'moving a folder into a folder is not supported');
    if (!target.folder) throw new ArtifactError('artifact-path', 'the destination must be a folder artifact');
    if (this.#store.humanArtifact(source) && !this.#store.humanArtifact(target)) {
      throw new ArtifactError('artifact-path', 'the human’s or an Aide’s file must move into a human or Aide folder');
    }
    if (target.status === 'archived') throw new ArtifactError('artifact-unavailable', 'the destination folder is archived');
    const fileName = folderName(name ?? source.path.split(sep).pop());
    if (fileName.includes('/')) throw new ArtifactError('artifact-path', 'move name must be a single file name');
    if (this.#busy.has(id) || this.#busy.has(folder)) throw new ArtifactError('artifact-busy', 'an artifact has an operation in progress; retry');
    this.#busy.add(id); this.#busy.add(folder);
    const destination = join(target.path, fileName);
    let linked = false, committed = false;
    try {
      const info = yield* wait(this.#files.lstat(target.path));
      if (!info.isDirectory() || info.isSymbolicLink()) throw new ArtifactError('artifact-path', 'the folder must be a real directory');
      const sourceInfo = yield* wait(this.#files.lstat(source.path));
      if (!sourceInfo.isFile() || sourceInfo.isSymbolicLink()) throw new ArtifactError('artifact-path', 'the source must be a regular file');
      authorize(); this.#available(id); this.#available(folder);
      // An exclusive hard link reserves the destination without overwriting any existing bytes.
      yield* wait(this.#files.link(source.path, destination)); linked = true;
      const linkedInfo = yield* wait(this.#files.lstat(destination));
      if (!linkedInfo.isFile() || linkedInfo.isSymbolicLink()) throw new ArtifactError('artifact-path', 'the source changed while moving');
      authorize();
      const current = this.#available(id);
      const next: Artifact = { ...current, status: 'moved', movedTo: { folder, path: fileName } };
      if (this.#available(folder).status === 'archived') throw new ArtifactError('artifact-unavailable', 'the destination folder was archived during the move');
      this.#store.updateArtifact(next); committed = true;
      this.#changed(next); this.#changed(this.#available(folder));
      yield* wait(this.#files.unlink(source.path));
      return { artifact: this.#store.resolveArtifact(id)! };
    } catch (err) {
      if (committed) return { artifact: this.#store.resolveArtifact(id)!, followUp: { error: err instanceof Error ? err.message : String(err) } };
      if (!committed) {
        if (linked) yield* wait(this.#files.unlink(destination));
      }
      throw err;
    } finally { this.#busy.delete(id); this.#busy.delete(folder); }
  }

  *#cleanupFolder(snapshot: Artifact, cutoff: number): IO<void> {
    const backup = snapshot.path + '.retained';
    let retained = false;
    const missing = (err: unknown) => hasCode(err, 'ENOENT');
    try {
      const info = yield* wait(this.#files.lstat(backup).catch(err => { if (missing(err)) return null; throw err; }));
      if (info) {
        if (!info.isDirectory() || info.isSymbolicLink()) throw new ArtifactError('artifact-path', 'retained folder must be a real directory');
        if (this.#store.artifact(snapshot.id)?.fileDeleted) {
          yield* wait(this.#files.rm(backup, { recursive: true, force: true })); return;
        }
        const live = yield* wait(this.#files.lstat(snapshot.path).catch(err => { if (missing(err)) return null; throw err; }));
        if (live) throw new ArtifactError('artifact-busy', 'both live and retained folders exist; recover them before sweeping');
        yield* wait(this.#files.rename(backup, snapshot.path));
      }
      const current = this.#store.artifact(snapshot.id);
      if (!current || !this.#expired(current, cutoff) || current.archivedAt !== snapshot.archivedAt) return;
      const live = yield* wait(this.#files.lstat(snapshot.path).catch(err => { if (missing(err)) return null; throw err; }));
      if (!live) { this.#markDeleted(current); return; }
      if (!live.isDirectory() || live.isSymbolicLink()) throw new ArtifactError('artifact-path', 'artifact folder must be a real directory');
      yield* wait(this.#files.rename(snapshot.path, backup)); retained = true;
      const latest = this.#store.artifact(snapshot.id);
      if (latest && this.#expired(latest, cutoff) && latest.archivedAt === snapshot.archivedAt) this.#markDeleted(latest);
      else { yield* wait(this.#files.rename(backup, snapshot.path)); retained = false; return; }
      yield* wait(this.#files.rm(backup, { recursive: true, force: true })); retained = false;
    } catch (err) {
      if (retained && !this.#store.artifact(snapshot.id)?.fileDeleted) yield* wait(this.#files.rename(backup, snapshot.path));
      throw err;
    }
  }

  #expired(a: Artifact, cutoff: number): boolean {
    return !a.kept && !this.#store.humanArtifact(a) && !a.movedTo && !a.promoted && !a.fileDeleted && a.status === 'archived' &&
      typeof a.archivedAt === 'string' && Date.parse(a.archivedAt) <= cutoff;
  }

  cleanup(retentionDays: number, now = this.#clock.now().getTime(), resumed: Resumed = direct): Promise<void> {
    return run(this.#cleanup(now - retentionDays * 86_400_000), resumed);
  }

  /** Delete then update the index, retaining a hard link until the commit. A reopen or failed
   * index write restores the original path. Interrupted cleanup and failed housekeeping retry
   * from the deterministic .retained link, including when the topic reopened before the sweep.
   */
  *#cleanup(cutoff: number): IO<void> {
    const failures: unknown[] = [];
    // Only indexed intent grants ownership of manual-delete backups. Never infer it
    // from a filename inside a folder, where .retained is a valid human filename.
    for (const a of [...this.#store.artifacts(), ...this.#store.movedArtifacts()]) {
      if (!a.deletion) continue;
      const ids = [a.id, ...(a.movedTo ? [a.movedTo.folder] : [])];
      if (ids.some(id => this.#busy.has(id))) continue;
      for (const id of ids) this.#busy.add(id);
      try { yield* this.#recoverDeletion(a); }
      catch (err) { failures.push(err); }
      finally { for (const id of ids) this.#busy.delete(id); }
    }
    for (const moved of this.#store.movedArtifacts()) {
      const owner = moved.movedTo!.folder;
      if (this.#busy.has(moved.id) || this.#busy.has(owner)) continue;
      this.#busy.add(moved.id); this.#busy.add(owner);
      try {
        const target = this.#store.resolveArtifact(moved.id);
        if (!target || target.fileDeleted || this.#deleting(this.#store.artifact(owner))) continue;
        yield* this.#removeOriginal(moved, target.path);
      }
      catch (err) { failures.push(err); }
      finally { this.#busy.delete(moved.id); this.#busy.delete(owner); }
    }
    for (const snapshot of this.#store.artifacts()) {
      if (this.#deleting(snapshot) || this.#busy.has(snapshot.id)) continue;
      this.#busy.add(snapshot.id);
      if (snapshot.folder) {
        try { yield* this.#cleanupFolder(snapshot, cutoff); }
        catch (err) { failures.push(err); }
        finally { this.#busy.delete(snapshot.id); }
        continue;
      }
      const backup = snapshot.path + '.retained';
      let retained = false;
      let removed = false;
      try {
        if (snapshot.fileDeleted) {
          yield* this.#unlinkIfPresent(backup);
          continue;
        }
        // Recover before eligibility checking: an open topic can also have interrupted deletion.
        let recovered = true;
        try { yield* wait(this.#files.link(backup, snapshot.path)); }
        catch (err) {
          if (hasCode(err, 'ENOENT')) recovered = false;
          else if (!hasCode(err, 'EEXIST')) throw err;
        }
        const current = this.#store.artifact(snapshot.id);
        if (!current || !this.#expired(current, cutoff) || current.archivedAt !== snapshot.archivedAt) {
          if (recovered) yield* this.#unlinkIfPresent(backup);
          continue;
        }
        try { yield* wait(this.#files.link(snapshot.path, backup)); }
        catch (err) {
          if (hasCode(err, 'ENOENT')) {
            const latest = this.#store.artifact(snapshot.id);
            if (latest && this.#expired(latest, cutoff)) this.#markDeleted(latest);
            continue;
          }
          if (!hasCode(err, 'EEXIST')) throw err;
        }
        retained = true;
        const eligible = this.#store.artifact(snapshot.id);
        if (eligible && this.#expired(eligible, cutoff) && eligible.archivedAt === snapshot.archivedAt) {
          yield* wait(this.#files.unlink(snapshot.path));
          removed = true;
          const latest = this.#store.artifact(snapshot.id);
          if (latest && this.#expired(latest, cutoff) && latest.archivedAt === snapshot.archivedAt) this.#markDeleted(latest);
          else {
            yield* wait(this.#files.link(backup, snapshot.path));
            removed = false;
          }
        }
        yield* this.#unlinkIfPresent(backup);
        retained = false;
      } catch (err) {
        failures.push(err);
        // Restoration may fail too (e.g. a read-only directory); leave the recovery link for retry.
        try {
          if (removed && retained && !this.#store.artifact(snapshot.id)?.fileDeleted) {
            yield* wait(this.#files.link(backup, snapshot.path));
            removed = false;
          }
          if (retained && !removed) yield* this.#unlinkIfPresent(backup);
        } catch (recovery) { failures.push(recovery); }
      } finally {
        this.#busy.delete(snapshot.id);
      }
    }
    if (failures.length) throw new AggregateError(failures, `artifact cleanup failed: ${failures.map(e => e instanceof Error ? e.message : String(e)).join('; ')}`);
  }

  #markDeleted(a: Artifact): void {
    const next: Artifact = { ...a, fileDeleted: true };
    this.#store.updateArtifact(next);
    this.#changed(next);
  }

  *#unlinkIfPresent(path: string): IO<void> {
    try { yield* wait(this.#files.unlink(path)); }
    catch (err) { if (!hasCode(err, 'ENOENT')) throw err; }
  }
}

function hasCode(err: unknown, code: string): boolean {
  // cland-allow-in: Filesystem error codes may be inherited from an Error subclass.
  return typeof err === 'object' && err !== null && 'code' in err && err.code === code;
}
