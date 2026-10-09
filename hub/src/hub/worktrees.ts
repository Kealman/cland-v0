// Task worktrees in the hub (T-58; T-20 decisions D3, D7, D8): the first claim of an open task makes its branch and
// its worktree, `session.launch` with an item makes them before the session starts there and claims the item for
// it, and the human lists and prunes them. The Git work is the territory module's, under its lock; this module
// decides which items get a worktree, writes the branch into the item and records what it made in the journal
// (`task-worktree`, an Agents notice through the log's tap).
import { realpathSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import type { LogFn } from '../log.ts';
import type { Claim } from '../tracker/index-db.ts';
import type { Actor, ItemView, Tracker } from '../tracker/tracker.ts';
import type { HarnessProcessView } from '../protocol.ts';
import type { LaunchRequest, Sessions } from '../adapters/sessions.ts';
import { commitsAhead, ensureTaskWorktree, hasTerritory, listTaskWorktrees, removeTaskWorktree, taskBase, type TaskWorktree } from '../territory.ts';

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

const real = (path: string): string => {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
};
const inside = (cwd: string, dir: string): boolean => {
  const c = real(cwd);
  const d = real(dir);
  return c === d || c.startsWith(d + sep);
};

/** The slug of an item's file name: `T-12-fix-the-thing.md` → `fix-the-thing`. */
const slugOf = (view: Pick<ItemView, 'id' | 'file'>): string => view.file.replace(/\.md$/, '').replace(new RegExp(`^${view.id}-?`), '');

export class TaskWorktrees {
  readonly #tracker: Tracker;
  readonly #log: LogFn;
  readonly #sessions: () => SessionCwd[];

  constructor(options: { tracker: Tracker; log?: LogFn; sessions?: () => SessionCwd[] }) {
    this.#tracker = options.tracker;
    this.#log = options.log ?? (() => {});
    this.#sessions = options.sessions ?? (() => []);
  }

  get root(): string {
    return this.#tracker.root;
  }

  /** Why an item gets no worktree, or null when it does: an open task, in a project with a territory. */
  #ineligible(view: ItemView): string | null {
    if (view.kind !== 'task') return `${view.id} is ${view.kind === 'epic' ? 'an' : 'a'} ${view.kind}: only a task gets a branch and a worktree`;
    if (view.state !== 'open') return `${view.id} is closed: no worktree`;
    if (!hasTerritory(this.root)) return 'the project has no territory (cland init makes one): no branch or worktree';
    return null;
  }

  /** Make or reuse the worktree of an eligible item; the branch goes into the item, a creation into the journal. */
  #make(view: ItemView, session: string | null): TaskWorktree {
    const worktree = ensureTaskWorktree(this.root, { id: view.id, slug: slugOf(view), branch: view.branch });
    if (view.branch !== worktree.branch) this.#tracker.link(HUB_ACTOR, view.id, { branch: worktree.branch });
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
    return worktree;
  }

  /** After a claim (decision D7): the worktree made or reused, or why there is none. A failure never undoes the claim. */
  afterClaim(id: string, session: string | null): WorktreeOutcome {
    let view: ItemView;
    try {
      view = this.#tracker.view(id);
    } catch (err) {
      return { worktree: null, reason: err instanceof Error ? err.message : String(err) };
    }
    const reason = this.#ineligible(view);
    if (reason !== null) return { worktree: null, reason };
    try {
      return { worktree: this.#make(view, session) };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.#log({ event: 'task-worktree-failed', id, error: message });
      return { worktree: null, reason: `no worktree: ${message}` };
    }
  }

  /**
   * `session.launch` with an item: an Implementer's alone. The worktree is made first (a failure refuses the launch),
   * the session starts in it, and the item's claim is the session's, taken over from the Coordinator's or the
   * human's; another session's claim refuses the launch. An item that gets no worktree launches at the project root.
   */
  async launch(sessions: Sessions, request: LaunchRequest & { item: string }): Promise<{ process: HarnessProcessView; claim: Claim | null } & WorktreeOutcome> {
    if (request.role !== 'implementer') throw new Error('`item` is for an Implementer (--role implementer); a Reviewer or QA session stands in a worktree with cwd');
    if (request.cwd !== undefined) throw new Error('give `item` or `cwd`, not both: an item launches in its own worktree');
    const view = this.#tracker.view(request.item);
    const held = view.claim;
    if (held && held.session !== request.name && held.role !== 'coordinator' && held.sessionId !== 'human') {
      throw new Error(`${view.id} is claimed by ${held.session}${held.role ? ` (${held.role})` : ''}: release it before launching another session for it`);
    }
    const reason = this.#ineligible(view);
    let worktree: TaskWorktree | null = null;
    if (reason === null) {
      try {
        worktree = this.#make(view, request.name);
      } catch (err) {
        throw new Error(`${view.id}: no worktree for the launch: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    const { item: _item, ...launch } = request;
    const process = await sessions.launch({ ...launch, ...(worktree ? { cwd: worktree.path, item: view.id } : {}) });
    const actor: Actor = { id: process.sessionId, name: process.name, role: process.role };
    const { claim } = this.#tracker.claim(actor, view.id, { force: true });
    return { process, claim, worktree, ...(reason !== null ? { reason } : {}) };
  }

  /** The task worktrees with their items and the sessions standing inside. */
  list(): WorktreeEntry[] {
    const root = this.root;
    const sessions = this.#sessions();
    let base: string | null = null;
    try {
      base = taskBase(root);
    } catch {
      base = null;
    }
    return listTaskWorktrees(root).map((w) => {
      let view: ItemView | null = null;
      try {
        view = this.#tracker.view(w.item);
      } catch {
        view = null;
      }
      const names = [...new Set(sessions.filter((s) => inside(s.cwd, w.path)).map((s) => s.name))];
      return {
        item: w.item,
        path: w.path,
        branch: w.branch,
        title: view?.title ?? null,
        kind: view?.kind ?? null,
        state: view?.state ?? null,
        sessions: names,
        base,
        ahead: w.branch ? commitsAhead(root, w.branch, base) : [],
      };
    });
  }

  /** The worktrees `prune` offers: those of closed items. */
  prunable(): WorktreeEntry[] {
    return this.list().filter((w) => w.state === 'closed');
  }

  /** Remove a closed item's worktree and branch; refused while a session stands inside, or for an open item. */
  remove(item: string): { item: string; path: string; branch: string | null } {
    const entry = this.list().find((w) => w.item === item);
    if (!entry) throw new Error(`${item} has no worktree`);
    if (entry.state !== 'closed') throw new Error(`${item} is ${entry.state ?? 'not in the tracker'}: prune removes only the worktrees of closed items`);
    if (entry.sessions.length) throw new Error(`${item}: ${entry.sessions.join(', ')} still ${entry.sessions.length === 1 ? 'stands' : 'stand'} inside its worktree`);
    const removed = removeTaskWorktree(this.root, item);
    this.#log({ event: 'task-worktree-removed', id: item, path: relative(this.root, removed.path), branch: removed.branch, ahead: entry.ahead.length });
    return { item, ...removed };
  }
}
