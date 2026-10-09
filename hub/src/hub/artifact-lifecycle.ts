// Artifact promotion and retention own their I/O reservations. Topic moves stay synchronous;
// operations re-read the index after I/O, so a close/reopen is never overwritten by a stale artifact.
import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { Artifact } from '../protocol.ts';
import type { Store } from './store.ts';
import { ArtifactError } from './artifacts.ts';

export type Resumed = <T>(body: () => T) => T;
export type ArtifactPromotion = { artifact: Artifact; followUp?: { error: string } };
export type ArtifactFiles = Pick<typeof fs, 'copyFile' | 'mkdir' | 'lstat' | 'realpath' | 'unlink' | 'link'>;
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
  readonly #store: Store;
  readonly #root: string | undefined;
  readonly #files: ArtifactFiles;
  readonly #changed: (a: Artifact) => void;
  readonly #busy = new Set<string>();

  constructor(store: Store, root: string | undefined, changed: (a: Artifact) => void, files: ArtifactFiles = fs) {
    this.#store = store; this.#root = root; this.#changed = changed; this.#files = files;
  }

  #available(id: string): Artifact {
    const a = this.#store.artifact(id);
    if (!a || a.fileDeleted) throw new ArtifactError('artifact-unavailable', 'no artifact file is available');
    if (a.promoted) throw new ArtifactError('artifact-path', `already promoted: ${a.promoted}`);
    return a;
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

  promote(id: string, path: string, authorize: () => void, resumed: Resumed = direct): Promise<ArtifactPromotion> {
    return run(this.#promote(id, path, authorize), resumed);
  }

  *#promote(id: string, path: string, authorize: () => void): IO<ArtifactPromotion> {
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
      // Exclusive copy refuses existing files and dangling symlinks; never replace the human's bytes.
      yield* wait(this.#files.copyFile(a.path, destination, constants.COPYFILE_EXCL));
      copied = true;
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
        try { yield* wait(this.#files.unlink(destination)); }
        catch (rollback) { throw new AggregateError([err, rollback], `promotion failed and rollback could not remove ${destination}; remove this unindexed copy before retrying`); }
      }
      throw err;
    } finally {
      this.#busy.delete(id);
    }
  }

  #expired(a: Artifact, cutoff: number): boolean {
    return !a.promoted && !a.fileDeleted && a.status === 'archived' &&
      typeof a.archivedAt === 'string' && Date.parse(a.archivedAt) <= cutoff;
  }

  cleanup(retentionDays: number, now = Date.now(), resumed: Resumed = direct): Promise<void> {
    return run(this.#cleanup(now - retentionDays * 86_400_000), resumed);
  }

  /** Delete then update the index, retaining a hard link until the commit. A reopen or failed
   * index write restores the original path. Interrupted cleanup and failed housekeeping retry
   * from the deterministic .retained link, including when the topic reopened before the sweep.
   */
  *#cleanup(cutoff: number): IO<void> {
    const failures: unknown[] = [];
    for (const snapshot of this.#store.artifacts()) {
      if (this.#busy.has(snapshot.id)) continue;
      this.#busy.add(snapshot.id);
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
  return typeof err === 'object' && err !== null && 'code' in err && err.code === code;
}
