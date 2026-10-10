// Task worktrees in the hub (T-58; T-20 decisions D3, D7, D8): the first claim of an open task makes its branch and
// its worktree, `session.launch` with an item makes them before the session starts there and claims the item for
// it, and the human lists and prunes them. The Git work is the territory module's, under its lock; this module
// decides which items get a worktree, writes the branch into the item and records what it made in the journal
// (`task-worktree`, an Agents notice through the log's tap). Its Git commands are awaited, never synchronous, and
// run one operation at a time (`#serial`): the territory lock refuses a second holder rather than waiting for it.
import { kindWithArticle } from '../tracker/kinds.ts';
import { realpath, stat } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import type { LogFn } from '../log.ts';
import type { Claim } from '../tracker/index-db.ts';
import type { Actor, ItemView, Tracker } from '../tracker/tracker.ts';
import type { HarnessProcessView } from '../protocol.ts';
import type { LaunchRequest, Sessions } from '../adapters/sessions.ts';
import { commitsAhead, ensureTaskWorktree, hasTerritory, listTaskWorktrees, removeTaskWorktree, taskBase, type TaskWorktree, type ExpectedBranch } from '../territory.ts';

/** What a claim or a launch made of the item's worktree: the worktree, or why there is none. */
export type WorktreeOutcome = { worktree: TaskWorktree | null; reason?: string };

/** A row of `cland worktree list`: the worktree, its item as the tracker has it, and the sessions standing inside. */
export type WorktreeEntry = {
  item: string;
  path: string;
  branch: string | null;
  title: string | null;
  kind: string | null;
  /** The item's state; null when the tracker has no such item. */
  state: string | null;
  sessions: string[];
  base: string | null;
  /** The branch's commits the base lacks, newest first (`<sha> <subject>`). */
  ahead: string[];
};

/** A session somewhere on disk: a connected spoke's, or a launched harness's. */
export type SessionCwd = { name: string; cwd: string };

/** The hub writes the branch into the item; the file shows no author for a link. */
const HUB_ACTOR: Actor = { id: 'hub', name: 'hub', role: null };

const real = async (path: string): Promise<string> => {
  try {
    return await realpath(path);
  } catch {
    return resolve(path);
  }
};

type PathIdentity = { dev: number; ino: number } | null;
const identity = async (path: string, resumed: Resumed): Promise<PathIdentity> => {
  try { const value = await stat(path); return resumed(() => ({ dev: value.dev, ino: value.ino })); }
  catch (err) {
    return resumed(() => {
      if (['ENOENT', 'ENOTDIR'].includes((err as NodeJS.ErrnoException).code ?? '')) return null;
      throw err;
    });
  }
};
const sameIdentity = (a: PathIdentity, b: PathIdentity): boolean => a === null ? b === null : b !== null && a.dev === b.dev && a.ino === b.ino;

/** Runs the synchronous write a handler resumes into after awaiting Git: the hub times it against its budget (T-67). */
export type Resumed = <T>(write: () => T) => T;
const untimed: Resumed = (write) => write();

/** The slug of an item's file name: `T-12-fix-the-thing.md` → `fix-the-thing`. */
const slugOf = (view: Pick<ItemView, 'id' | 'file'>): string => view.file.replace(/\.md$/, '').replace(new RegExp(`^${view.id}-?`), '');

export class TaskWorktrees {
  readonly #tracker: Tracker;
  readonly #log: LogFn;
  readonly #sessions: () => SessionCwd[];
  /** The tail of the operations queued so far: each Git operation of the hub starts when the previous one settled. */
  #queue: Promise<unknown> = Promise.resolve();
  /** The items a launch is under way for, from its worktree to its claim, each with its launch's own token: prune
   *  leaves their worktrees alone, a second launch is refused, and only the launch that reserved an item releases it. */
  readonly #launching = new Map<string, symbol>();

  constructor(options: { tracker: Tracker; log?: LogFn; sessions?: () => SessionCwd[] }) {
    this.#tracker = options.tracker;
    this.#log = options.log ?? (() => {});
    this.#sessions = options.sessions ?? (() => []);
  }

  get root(): string {
    return this.#tracker.root;
  }

  /** Run `operation` after every operation queued before it, whatever their outcome. */
  serial<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.#queue.then(operation, operation);
    this.#queue = run.catch(() => {});
    return run;
  }

  /** Why an item gets no worktree, or null when it does: an open task, in a project with a territory. */
  async #ineligible(view: ItemView): Promise<string | null> {
    if (view.kind !== 'task') return `${view.id} is ${kindWithArticle(view.kind)}: only a task gets a branch and a worktree`;
    if (view.state !== 'open') return `${view.id} is closed: no worktree`;
    if (!(await hasTerritory(this.root))) return 'the project has no territory (cland init makes one): no branch or worktree';
    return null;
  }

  /** Make or reuse the worktree of an eligible item; the branch goes into the item, a creation into the journal. */
  async #make(view: ItemView, session: string | null, resumed: Resumed = untimed): Promise<TaskWorktree> {
    const worktree = await ensureTaskWorktree(this.root, { id: view.id, slug: slugOf(view), branch: view.branch }, resumed);
    // the item as it is now: it may have changed while Git worked
    const current = await this.#tracker.viewAsync(view.id, resumed);
    if (current.branch !== worktree.branch) await resumed(() => this.#tracker.link(HUB_ACTOR, view.id, { branch: worktree.branch }, resumed));
    resumed(() => {
      if (worktree.createdWorktree) {
        this.#log({
          event: 'task-worktree',
          id: view.id,
          branch: worktree.branch,
          path: relative(this.root, worktree.path),
          base: worktree.base,
          createdBranch: worktree.createdBranch,
          ...(session ? { session } : {}),
        });
      }
    });
    return worktree;
  }

  /** After a claim (decision D7): the worktree made or reused, or why there is none. A failure never undoes the claim. */
  afterClaim(id: string, session: string | null, resumed: Resumed = untimed): Promise<WorktreeOutcome> {
    return this.serial(async () => {
      let view: ItemView;
      try {
        view = await this.#tracker.viewAsync(id, resumed);
      } catch (err) {
        return resumed(() => ({ worktree: null, reason: err instanceof Error ? err.message : String(err) }));
      }
      const reason = await this.#ineligible(view);
      if (reason !== null) return { worktree: null, reason };
      try {
        return { worktree: await this.#make(view, session, resumed) };
      } catch (err) {
        return resumed(() => {
          const message = err instanceof Error ? err.message : String(err);
          this.#log({ event: 'task-worktree-failed', id, error: message });
          return { worktree: null, reason: `no worktree: ${message}` };
        });
      }
    });
  }

  /**
   * `session.launch` with an item: an Implementer, or a Lead on an open configured container. The task worktree is made first (a failure refuses the launch),
   * the session starts in it, and the item's claim is the session's, taken over from the Coordinator's or the
   * human's; another session's claim refuses the launch. So does one another session took while the harness started:
   * the session just launched is stopped, the claim left with its holder. An item that gets no worktree launches at
   * the project root; a Lead records its node in process.item without a task worktree.
   */
  async launch(sessions: Sessions, request: LaunchRequest & { item: string }, resumed: Resumed = untimed, authorize?: () => void): Promise<{ process: HarnessProcessView; claim: Claim | null } & WorktreeOutcome> {
    if (request.role !== 'implementer' && request.role !== 'lead') throw new Error('`item` is for an Implementer (--role implementer) or Lead (--role lead); a Reviewer or QA session stands in a worktree with cwd');
    if (request.cwd !== undefined) throw new Error('give `item` or `cwd`, not both: an item launches in its own worktree');
    const view = await this.#tracker.viewAsync(request.item, resumed);
    if (request.role === 'lead' && (view.state !== 'open' || !this.#tracker.levels.includes(view.kind))) {
      throw new Error('a Lead needs an open configured container');
    }
    // a claim the launch may take over: none, the Coordinator's, the human's, or one under the new session's name
    const yields = (held: Claim | null): boolean => !held || (request.role !== 'lead' && held.session === request.name) || held.role === 'coordinator' || held.sessionId === 'human';
    const other = (held: Claim) => `${view.id} is claimed by ${held.session}${held.role ? ` (${held.role})` : ''}`;
    if (!yields(view.claim)) throw new Error(`${other(view.claim as Claim)}: release it before launching another session for it`);
    const token = Symbol(request.name);
    const release = () => {
      if (this.#launching.get(view.id) === token) this.#launching.delete(view.id);
    };
    // in the queue, after any prune queued before it: the reservation is tested and taken in the same step as the
    // worktree is made, so of two launches for one item only one goes on, and a prune queued after it leaves the
    // worktree alone until the claim is the session's
    const { reason, worktree } = await this.serial(async () => {
      if (this.#launching.has(view.id)) throw new Error(`${view.id}: another session is being launched for it`);
      this.#launching.set(view.id, token);
      try {
        const now = await this.#tracker.viewAsync(view.id, resumed);
        if (request.role === 'lead' && (now.state !== 'open' || !this.#tracker.levels.includes(now.kind))) throw new Error('a Lead needs an open configured container');
        const reason = await this.#ineligible(now);
        let worktree: TaskWorktree | null = null;
        if (reason === null) {
          try {
            worktree = await this.#make(now, request.name, resumed);
          } catch (err) {
            throw new Error(`${view.id}: no worktree for the launch: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
        return { reason, worktree };
      } catch (err) {
        release();
        throw err;
      }
    });
    try {
      return await this.#launchIn(sessions, request, view.id, worktree, reason, yields, other, resumed, authorize);
    } finally {
      release();
    }
  }

  /** The launch itself, once its worktree is made and the item marked as launching: spawn, then claim. */
  async #launchIn(
    sessions: Sessions,
    request: LaunchRequest & { item: string },
    id: string,
    worktree: TaskWorktree | null,
    reason: string | null,
    yields: (held: Claim | null) => boolean,
    other: (held: Claim) => string,
    resumed: Resumed,
    authorize?: () => void,
  ): Promise<{ process: HarnessProcessView; claim: Claim | null } & WorktreeOutcome> {
    const { item: _item, ...launch } = request;
    const process = await sessions.launch({ ...launch, ...(worktree ? { cwd: worktree.path, item: id } : request.role === 'lead' ? { cwd: this.root, item: id } : {}) }, resumed, authorize);
    // Claim admission and its final status write both recheck the hold and the launch grant.
    let lost: Claim | null = null;
    let taken: { claim: Claim | null };
    try {
      const actor: Actor = { id: process.sessionId, name: process.name, role: process.role };
      taken = await this.#tracker.claim(actor, id, { force: true }, resumed, () => {
        authorize?.();
        const held = this.#tracker.claimOf(id);
        if (!yields(held) && held?.sessionId !== process.sessionId) {
          lost = held;
          this.#log({ event: 'launch-claim-lost', id, session: process.name, holder: held?.session ?? null });
          throw new Error(other(held!));
        }
      });
    } catch (err) {
      const stopped = await sessions.stop(process.name, resumed).then(
        () => `${process.name} was stopped`,
        (err: unknown) => `stopping ${process.name} failed (${err instanceof Error ? err.message : String(err)}): stop it by hand`,
      );
      if (lost) throw new Error(`${other(lost)}, taken while ${process.name} started: launch refused, the claim stays with its holder; ${stopped}`);
      throw new Error(`launch claim failed (${err instanceof Error ? err.message : String(err)}); ${stopped}`);
    }
    return { process, claim: taken.claim, worktree, ...(reason !== null ? { reason } : {}) };
  }

  /** The task worktrees with their items and the sessions standing inside. */
  list(resumed: Resumed = untimed): Promise<WorktreeEntry[]> {
    return this.serial(() => this.#list(resumed));
  }

  /** Resolve containment after queued item reads; return a live check for the final step before removal. */
  async #observe(entries: Array<{ item: string; path: string }>, resumed: Resumed): Promise<Array<{ view: ItemView | null; sessions: string[]; validate: () => Promise<void> }>> {
    for (;;) {
      const { sessions, indexed } = resumed(() => {
        const items = this.#tracker.list();
        return { sessions: this.#sessions(), indexed: entries.map(entry => items.find(item => item.id === entry.item)) };
      });
      const views: Array<ItemView | null> = [];
      for (const entry of entries) {
        try {
          const view = await this.#tracker.viewAsync(entry.item, resumed);
          resumed(() => views.push(view));
        } catch { resumed(() => views.push(null)); }
      }
      const [cwds, dirs, cwdIdentities, dirIdentities] = await Promise.all([
        Promise.all(sessions.map(s => real(s.cwd))),
        Promise.all(entries.map(w => real(w.path))),
        Promise.all(sessions.map(s => identity(s.cwd, resumed))),
        Promise.all(entries.map(w => identity(w.path, resumed))),
      ]);
      const observed = resumed(() => {
        // Sessions may enter/leave while paths or item files are read. Only use a still-current snapshot.
        const now = this.#sessions();
        if (now.length !== sessions.length || now.some((s, i) => s.name !== sessions[i]!.name || s.cwd !== sessions[i]!.cwd)) return null;
        const current = this.#tracker.list();
        if (entries.some((entry, i) => {
          const item = current.find(item => item.id === entry.item);
          return item?.updated !== indexed[i]?.updated || item?.state !== indexed[i]?.state || item?.file !== indexed[i]?.file;
        })) return null;
        return entries.map((entry, i) => ({
          view: views[i]!,
          sessions: [...new Set(sessions.filter((_, n) => cwds[n] === dirs[i] || cwds[n]!.startsWith(dirs[i] + sep)).map(s => s.name))],
          validate: async () => {
            // The territory's final lstat check also awaited: resolve aliases again after it, before Git.
            const [currentCwds, currentDir] = await Promise.all([
              Promise.all(sessions.map(s => real(s.cwd))),
              real(entry.path),
            ]);
            // Detect a previously resolved alias or target replaced while a sibling lookup awaited.
            const [currentCwdIdentities, currentDirIdentity] = await Promise.all([
              Promise.all(sessions.map(s => identity(s.cwd, resumed))),
              identity(entry.path, resumed),
            ]);
            resumed(() => {
              const latest = this.#tracker.list().find(item => item.id === entry.item);
              if (latest?.updated !== indexed[i]?.updated || latest?.state !== indexed[i]?.state || latest?.file !== indexed[i]?.file) throw new Error(`${entry.item} changed during prune: keeps its worktree and branch; try again`);
              const now = this.#sessions();
              if (now.length !== sessions.length || now.some((s, i) => s.name !== sessions[i]!.name || s.cwd !== sessions[i]!.cwd)) throw new Error(`${entry.item}: session locations changed during prune; recheck who stands inside its worktree`);
              if (currentDir !== dirs[i] || !sameIdentity(currentDirIdentity, dirIdentities[i]!)) throw new Error(`${entry.item}: worktree identity or containment changed during prune; kept`);
              const inside = [...new Set(sessions.filter((_, n) => currentCwds[n] === currentDir || currentCwds[n]!.startsWith(currentDir + sep)).map(s => s.name))];
              if (inside.length) throw new Error(`${entry.item}: ${inside.join(', ')} now ${inside.length === 1 ? 'stands' : 'stand'} inside its worktree`);
              if (currentCwds.some((cwd, i) => cwd !== cwds[i] || !sameIdentity(currentCwdIdentities[i]!, cwdIdentities[i]!))) throw new Error(`${entry.item}: session path identity changed during prune; recheck who stands inside its worktree`);
            });
          },
        }));
      });
      if (observed) return observed;
    }
  }

  /** Git's facts first, then queued item reads and the current sessions. */
  async #list(resumed: Resumed): Promise<WorktreeEntry[]> {
    const root = this.root;
    const base = await taskBase(root).catch(() => null);
    const found: Array<Awaited<ReturnType<typeof listTaskWorktrees>>[number] & { ahead: string[] }> = [];
    for (const w of await listTaskWorktrees(root)) found.push({ ...w, ahead: w.branch ? await commitsAhead(root, w.branch, base) : [] });
    const observed = await this.#observe(found, resumed);
    return resumed(() => {
      return found.map((w, i): WorktreeEntry => {
        const { view, sessions } = observed[i]!;
        return {
          item: w.item,
          path: w.path,
          branch: w.branch,
          title: view?.title ?? null,
          kind: view?.kind ?? null,
          state: view?.state ?? null,
          sessions,
          base,
          ahead: w.ahead,
        };
      });
    });
  }

  /** The worktrees `prune` offers: those of closed items. */
  async prunable(resumed: Resumed = untimed): Promise<WorktreeEntry[]> {
    return (await this.list(resumed)).filter((w) => w.state === 'closed');
  }

  /**
   * Remove closed items' worktrees and branches, from one listing: each is refused while a session stands inside,
   * for an open item, while a launch for it is under way, or when Git refuses (changes in the worktree). What the
   * listing said is checked again under the territory lock right before each removal: the item reopened or a session
   * that entered while Git was read keeps the worktree (rev-6 on T-58).
   */
  /** Finish a merged task's branch deletion even if an earlier prune removed only its worktree. */
  async pruneMerged(item: string, expected: ExpectedBranch, resumed: Resumed): Promise<Awaited<ReturnType<TaskWorktrees['prune']>>> {
    const pruned = await this.prune([item], resumed, new Map([[item, expected]]));
    if (pruned.failed[0]?.error !== `${item} has no worktree`) return pruned;
    return this.serial(async () => {
      try {
        const done = await removeTaskWorktree(this.root, item, async () => {
          const view = await this.#tracker.viewAsync(item, resumed);
          return resumed(() => {
            const indexed = this.#tracker.list().find(row => row.id === item);
            const validate = () => {
              const now = this.#tracker.list().find(row => row.id === item);
              if (now?.updated !== indexed?.updated || now?.state !== indexed?.state) throw new Error(`${item} changed during prune: keeps its branch; try again`);
              if (this.#launching.has(item)) throw new Error(`${item}: a session is being launched in its worktree`);
            };
            if (this.#launching.has(item)) throw new Error(`${item}: a session is being launched in its worktree`);
            if (view.state !== 'closed') throw new Error(`${item} reopened: prune keeps its branch`);
            return validate;
          });
        }, expected, resumed);
        return resumed(() => ({ removed: [{ item, ...done }], failed: [] }));
      } catch (err) {
        return resumed(() => ({ removed: [], failed: [{ item, error: err instanceof Error ? err.message : String(err) }] }));
      }
    });
  }

  prune(items: string[], resumed: Resumed = untimed, expectedBranches: ReadonlyMap<string, ExpectedBranch> = new Map()): Promise<{ removed: Array<{ item: string; path: string; branch: string | null }>; failed: Array<{ item: string; error: string }> }> {
    return this.serial(async () => {
      const entries = await this.#list(resumed);
      const removed: Array<{ item: string; path: string; branch: string | null }> = [];
      const failed: Array<{ item: string; error: string }> = [];
      for (const item of items) {
        try {
          const entry = resumed(() => {
            const entry = entries.find((w) => w.item === item);
            if (!entry) throw new Error(`${item} has no worktree`);
            if (entry.state !== 'closed') throw new Error(`${item} is ${entry.state ?? 'not in the tracker'}: prune removes only the worktrees of closed items`);
            if (entry.sessions.length) throw new Error(`${item}: ${entry.sessions.join(', ')} still ${entry.sessions.length === 1 ? 'stands' : 'stand'} inside its worktree`);
            return entry;
          });
          const done = await removeTaskWorktree(this.root, item, async () => {
            const observed = await this.#observe([entry], resumed);
            return resumed(() => {
              const { view, sessions: now, validate } = observed[0]!;
              if (this.#launching.has(item)) throw new Error(`${item}: a session is being launched in its worktree`);
              if (view?.state !== 'closed') throw new Error(`${item} is ${view?.state ?? 'not in the tracker'} now: prune removes only the worktrees of closed items`);
              if (now.length) throw new Error(`${item}: ${now.join(', ')} now ${now.length === 1 ? 'stands' : 'stand'} inside its worktree`);
              return async () => {
                await validate();
                resumed(() => { if (this.#launching.has(item)) throw new Error(`${item}: a session is being launched in its worktree`); });
              };
            });
          }, expectedBranches.get(item), resumed);
          resumed(() => {
            this.#log({ event: 'task-worktree-removed', id: item, path: relative(this.root, done.path), branch: done.branch, ahead: entry.ahead.length });
            removed.push({ item, ...done });
          });
        } catch (err) {
          resumed(() => failed.push({ item, error: err instanceof Error ? err.message : String(err) }));
        }
      }
      return { removed, failed };
    });
  }
}
