import { withHostWorktreeCheckpoint, requireUnlockedCaller, addHostTaskWorktree, pruneHostTaskWorktree, hostWorktreeMatches, relaunchHostTaskWorktree } from '../host/task-worktrees.ts';
import { hostCloneRoot } from '../host/clone.ts';
import type { Store } from './store.ts';
import type { Host } from '../host/host.ts';
import { localHost } from '../host/local.ts';
import { legacyWorktreeGit } from '../host/legacy-worktree-git.ts';
import { isCustomRole } from '../names.ts';
// Task worktrees in the hub (T-58; T-20 decisions D3, D7, D8): the first claim of an open task makes its branch and
// its worktree, `session.launch` with an item makes them before the session starts there and claims the item for
// it, and the human lists and prunes them. The Git work is the territory module's, under its lock; this module
// decides which items get a worktree, writes the branch into the item and records what it made in the journal
// (`task-worktree`, an Agents notice through the log's tap). Its Git commands are awaited, never synchronous, and
// run one operation at a time (`#serial`): the territory lock refuses a second holder rather than waiting for it.
import { kindWithArticle } from '../tracker/kinds.ts';
import { join, relative } from 'node:path';
import type { LogFn } from '../log.ts';
import type { Claim } from '../tracker/index-db.ts';
import type { Actor, ItemView, Tracker } from '../tracker/tracker.ts';
import type { HarnessProcessView } from '../protocol.ts';
import type { LaunchRequest, Sessions } from '../adapters/sessions.ts';
import { territoryPath, withTerritoryLockAsync, commitsAhead, ensureTaskWorktree, hasTerritory, listTaskWorktrees, removeTaskWorktree, taskBase, type TaskWorktree, type ExpectedBranch } from '../territory.ts';
import { ToolForbidden } from '../roles/permissions.ts';

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
export type SessionCwd = { name: string; cwd: string; host?: string };

/** The hub writes the branch into the item; the file shows no author for a link. */
const HUB_ACTOR: Actor = { id: 'hub', name: 'hub', role: null };

type PathIdentity = { dev: number; ino: number } | null;
const sameIdentity = (a: PathIdentity, b: PathIdentity): boolean => a === null ? b === null : b !== null && a.dev === b.dev && a.ino === b.ino;

/** Runs the synchronous write a handler resumes into after awaiting Git: the hub times it against its budget (T-67). */
export type Resumed = <T>(write: () => T) => T;
const untimed: Resumed = (write) => write();

/** The slug of an item's file name: `T-12-fix-the-thing.md` → `fix-the-thing`. */
const slugOf = (view: Pick<ItemView, 'id' | 'file'>): string => view.file.replace(/\.md$/, '').replace(new RegExp(`^${view.id}-?`), '');

/** Git operations used by worktree policy. Production keeps the native territory implementation. */
export type WorktreeGit = Pick<typeof import('../territory.ts'),
  'ensureTaskWorktree' | 'taskBase' | 'listTaskWorktrees' | 'commitsAhead' | 'removeTaskWorktree'>;
const nativeGit: WorktreeGit = { ensureTaskWorktree, taskBase, listTaskWorktrees, commitsAhead, removeTaskWorktree };

export class TaskWorktrees {
  readonly #git: WorktreeGit;
  readonly #store: Store | undefined;
  readonly #resolveHost: ((name:string)=>Host) | undefined;
  readonly #host: Host;
  readonly #env: NodeJS.ProcessEnv;
  readonly #hasTerritory: typeof hasTerritory;
  readonly #tracker: Tracker;
  readonly #log: LogFn;
  readonly #sessions: () => SessionCwd[];
  /** The tail of the operations queued so far: each Git operation of the hub starts when the previous one settled. */
  #queue: Promise<unknown> = Promise.resolve();
  /** The items a launch is under way for, from its worktree to its claim, each with its launch's own token: prune
   *  leaves their worktrees alone, a second launch is refused, and only the launch that reserved an item releases it. */
  readonly #launching = new Map<string, symbol>();

  constructor(options: { store?: Store; resolveHost?: (name:string)=>Host; host?: Host; git?: WorktreeGit; hasTerritory?: typeof hasTerritory; env?: NodeJS.ProcessEnv; tracker: Tracker; log?: LogFn; sessions?: () => SessionCwd[] }) {
    this.#store=options.store;this.#resolveHost=options.resolveHost;
    this.#env = options.env ?? process.env;
    this.#host = options.host ?? localHost(this.#env);
    this.#git = options.git ? legacyWorktreeGit(options.git, this.#host) : nativeGit;
    this.#hasTerritory = options.hasTerritory ?? hasTerritory;
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
    if (!(await this.#hasTerritory(this.root, this.#env))) return 'the project has no territory (cland init makes one): no branch or worktree';
    return null;
  }

  /** Make or reuse the worktree of an eligible item; the branch goes into the item, a creation into the journal. */
  async #make(view: ItemView, session: string | null, resumed: Resumed = untimed, authorize: () => void = () => {}, host: Host = this.#host): Promise<TaskWorktree> {
    const remote=this.#store?.hosts.get(host.name);
    const worktree = remote ? await addHostTaskWorktree({project:this.root,root:hostCloneRoot(host.layout({discoveryFile:'',node:'',cli:'',spoke:''}).runDirectory,this.root),host,item:view.id,branch:view.branch ?? `t/${view.id}-${slugOf(view)}`,store:this.#store!,env:this.#env,authorize:()=>resumed(authorize)}) : await this.#git.ensureTaskWorktree(this.root, { id: view.id, slug: slugOf(view), branch: view.branch }, resumed, authorize, this.#env, host);
    // the item as it is now: it may have changed while Git worked
    const current = await this.#tracker.viewAsync(view.id, resumed);
    resumed(authorize);
    if (current.branch !== worktree.branch) await resumed(() => this.#tracker.link(HUB_ACTOR, view.id, { branch: worktree.branch }, resumed, authorize));
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

  /** Short admission lock precedes adapter drain, which must never wait while holding this lock. */
  async admitRelaunch(item: string, from: string, host: Host, admit: () => void, retry?: import('../host/task-worktrees.ts').HostWorktreeRecord) {
    requireUnlockedCaller(this.root);
    const destination=host.name;
    return this.serial(() => withHostWorktreeCheckpoint(this.root, async () => {
      if (this.#store?.hosts.get(destination)?.state !== 'registered') throw new Error('cross-host relaunch requires a registered destination host');
      const view = await this.#tracker.viewAsync(item);
      const ineligible=await this.#ineligible(view);
      const fresh=this.#tracker.summary(item);
      if (ineligible || !fresh || fresh.kind!=='task' || fresh.state!=='open') throw new Error(`${item}: cross-host relaunch requires an open task with a territory`);
      const old = this.#store!.hostWorktrees().find(row => row.item === item);
      if (!old || old.phase==='removing' || (retry ? !hostWorktreeMatches(old,retry) || !old.checkout : old.host !== from || old.phase === 'adding')) throw new Error(`${item}: original worktree ownership is unavailable or needs reconciliation`);
      if(this.#store?.hosts.get(destination)?.state!=='registered')throw new Error('cross-host relaunch requires a registered destination host');
      admit();
    }));
  }

  /** Caller owns admitted native generation; no later connectivity observation undoes that admission. */
  relaunchElsewhere(item: string, from: string, host: Host, authorize: () => void, retry?: import('../host/task-worktrees.ts').HostWorktreeRecord) {
    return this.serial(async () => {
      if (this.#store?.hosts.get(host.name)?.state !== 'registered') throw new Error('cross-host relaunch requires a registered destination host');
      return relaunchHostTaskWorktree({project:this.root,root:hostCloneRoot(host.layout({discoveryFile:'',node:'',cli:'',spoke:''}).runDirectory,this.root),host,item,from,store:this.#store,env:this.#env,authorize,...(retry?{retry}:{})});
    });
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
  async launch(sessions: Sessions, request: LaunchRequest & { item: string }, resumed: Resumed = untimed, authorize?: () => void): Promise<{ process: HarnessProcessView; claim: Claim | null; note?: string } & WorktreeOutcome> {
    const launchHost = sessions.validateLaunchHost(request);
    if (request.role !== 'implementer' && request.role !== 'lead' && request.role !== 'reviewer' && request.role !== 'qa' && !isCustomRole(request.role)) throw new Error('`item` is for an Implementer, custom worker, Lead, Reviewer or QA');
    if (request.cwd !== undefined) throw new Error('give `item` or `cwd`, not both: an item launches in its own worktree');
    const view = await this.#tracker.viewAsync(request.item, resumed);
    resumed(() => authorize?.());
    const verifier = request.role === 'reviewer' || request.role === 'qa';
    if (verifier && view.state !== 'open') throw new Error(`${view.id} is closed: no verifier launch`);
    if (request.role === 'lead' && (view.state !== 'open' || !this.#tracker.ladder.canLead(view.kind))) {
      throw new Error('a Lead needs an open configured container');
    }
    if (request.role === 'implementer' || isCustomRole(request.role)) resumed(() => this.#tracker.assertPlanLaunch(view.id));
    const originalAuthorize = authorize;
    authorize = () => resumed(() => {
      originalAuthorize?.();
      if (request.role === 'implementer' || isCustomRole(request.role)) this.#tracker.assertPlanLaunch(view.id);
    });
    // A matching offline claimant can launch onto its own node; Sessions.launch still refuses a live name.
    // Other claims yield only from the Coordinator or human, as before.
    const yields = (held: Claim | null): boolean => !held || (held.session === request.name && held.role === request.role) || held.role === 'coordinator' || held.sessionId === 'human';
    const other = (held: Claim) => `${view.id} is claimed by ${held.session}${held.role ? ` (${held.role})` : ''}`;
    if (!verifier && !yields(view.claim)) throw new Error(`${other(view.claim as Claim)}: release it before launching another session for it`);
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
        if (verifier && now.state !== 'open') throw new Error(`${view.id} is closed: no verifier launch`);
        if (request.role === 'lead' && (now.state !== 'open' || !this.#tracker.ladder.canLead(now.kind))) throw new Error('a Lead needs an open configured container');
        const reason = await this.#ineligible(now);
        resumed(() => authorize?.());
        let worktree: TaskWorktree | null = null;
        if (reason === null) {
          try {
            worktree = await this.#make(now, request.name, resumed, authorize, launchHost);
          } catch (err) {
            if (err instanceof ToolForbidden) throw err;
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
      if (verifier) {
        // Verifiers keep the launch reservation, but take only a verifier hold when accepting work.
        const process = await sessions.launch({ ...request, item: view.id, cwd: sessions.retainedPool(request.role) ? this.root : worktree?.path ?? this.root }, resumed, authorize);
        return { process, claim: null, worktree, ...(reason ? { reason } : {}) };
      }
      const launched = await this.#launchIn(sessions, request, view.id, worktree, reason, yields, other, resumed, authorize);
      return launched;
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
    const process = await sessions.launch({ ...launch, cwd: worktree?.path ?? this.root, item: id }, resumed, authorize);
    // Claim admission and its final status write both recheck the hold and the launch grant.
    let lost: Claim | null = null;
    let taken: { claim: Claim | null };
    try {
      const actor: Actor = { id: process.sessionId, name: process.name, role: process.role };
      // The adapter can settle before its first hello. Adopt provisional ownership before claim() reads it.
      resumed(() => this.#tracker.adoptSession(process.name, process.sessionId));
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
      if (err instanceof ToolForbidden) { err.message += `; ${stopped}`; throw err; }
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
        return { sessions: this.#sessions().filter(s=>(s.host ?? 'local')===this.#host.name), indexed: entries.map(entry => items.find(item => item.id === entry.item)) };
      });
      const views: Array<ItemView | null> = [];
      for (const entry of entries) {
        try {
          const view = await this.#tracker.viewAsync(entry.item, resumed);
          resumed(() => views.push(view));
        } catch { resumed(() => views.push(null)); }
      }
      const [cwds, dirs, cwdIdentities, dirIdentities, occupants] = await Promise.all([
        Promise.all(sessions.map(s => this.#host.realpath(s.cwd))),
        Promise.all(entries.map(w => this.#host.realpath(w.path))),
        Promise.all(sessions.map(s => this.#host.statDirectory(s.cwd).then(info => info.identity))),
        Promise.all(entries.map(w => this.#host.statDirectory(w.path).then(info => info.identity))),
        Promise.all(entries.map(w => this.#host.occupants(w.path, sessions))),
      ]);
      const observed = resumed(() => {
        // Sessions may enter/leave while paths or item files are read. Only use a still-current snapshot.
        const now = this.#sessions().filter(s=>(s.host ?? 'local')===this.#host.name);
        if (now.length !== sessions.length || now.some((s, i) => s.name !== sessions[i]!.name || s.cwd !== sessions[i]!.cwd)) return null;
        const current = this.#tracker.list();
        if (entries.some((entry, i) => {
          const item = current.find(item => item.id === entry.item);
          return item?.updated !== indexed[i]?.updated || item?.state !== indexed[i]?.state || item?.file !== indexed[i]?.file;
        })) return null;
        return entries.map((entry, i) => ({
          view: views[i]!,
          sessions: occupants[i]!,
          validate: async () => {
            // The territory's final lstat check also awaited: resolve aliases again after it, before Git.
            const [currentCwds, currentDir, inside] = await Promise.all([
              Promise.all(sessions.map(s => this.#host.realpath(s.cwd))),
              this.#host.realpath(entry.path),
              this.#host.occupants(entry.path, sessions),
            ]);
            // Detect a previously resolved alias or target replaced while a sibling lookup awaited.
            const [currentCwdIdentities, currentDirIdentity] = await Promise.all([
              Promise.all(sessions.map(s => this.#host.statDirectory(s.cwd).then(info => info.identity))),
              this.#host.statDirectory(entry.path).then(info => info.identity),
            ]);
            resumed(() => {
              const latest = this.#tracker.list().find(item => item.id === entry.item);
              if (latest?.updated !== indexed[i]?.updated || latest?.state !== indexed[i]?.state || latest?.file !== indexed[i]?.file) throw new Error(`${entry.item} changed during prune: keeps its worktree and branch; try again`);
              const now = this.#sessions().filter(s=>(s.host ?? 'local')===this.#host.name);
              if (now.length !== sessions.length || now.some((s, i) => s.name !== sessions[i]!.name || s.cwd !== sessions[i]!.cwd)) throw new Error(`${entry.item}: session locations changed during prune; recheck who stands inside its worktree`);
              if (currentDir !== dirs[i] || !sameIdentity(currentDirIdentity, dirIdentities[i]!)) throw new Error(`${entry.item}: worktree identity or containment changed during prune; kept`);
              // Check session identity before refusing occupancy; report both facts when they coincide.
              const occupantRefusal = inside.length ? `${inside.join(', ')} now ${inside.length === 1 ? 'stands' : 'stand'} inside its worktree` : null;
              if (currentCwds.some((cwd, i) => cwd !== cwds[i] || !sameIdentity(currentCwdIdentities[i]!, cwdIdentities[i]!))) throw new Error(`${entry.item}: session path identity changed during prune; recheck who stands inside its worktree${occupantRefusal ? `; ${occupantRefusal}` : ''}`);
              if (occupantRefusal) throw new Error(`${entry.item}: ${occupantRefusal}`);
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
    const base = await this.#git.taskBase(root, undefined, this.#env).catch(() => null);
    const found: Array<Awaited<ReturnType<typeof listTaskWorktrees>>[number] & { ahead: string[] }> = [];
    for (const w of await this.#git.listTaskWorktrees(root, this.#env)) found.push({ ...w, ahead: w.branch ? await this.#git.commitsAhead(root, w.branch, base, this.#env) : [] });
    const observed = await this.#observe(found, resumed);
    const remote:WorktreeEntry[]=[];
    for(const row of this.#store?.hostWorktrees() ?? []) {
      const view=await this.#tracker.viewAsync(row.item,resumed).catch(()=>null);
      const registered=this.#store?.hosts.get(row.host);
      if(!registered||registered.state!=='registered')throw new Error(`host ${row.host} ${registered?.state ?? 'gone'}: retained worktree ${row.item} unavailable`);
      const host=this.#resolveHost?.(row.host);if(!host)throw new Error(`host ${row.host} unavailable for worktree listing`);
      const sessions=await host.occupants(row.path,this.#sessions().filter(s=>s.host===row.host));
      remote.push({item:row.item,path:row.path,branch:row.branch,title:view?.title??null,kind:view?.kind??null,state:view?.state??null,sessions,base:null,ahead:await this.#git.commitsAhead(territoryPath(this.root),row.branch,base,this.#env)});
    }

    return resumed(() => {
      return [...remote,...found.map((w, i): WorktreeEntry => {
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
      })];
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
        const done = await this.#git.removeTaskWorktree(this.root, item, async () => {
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
        }, expected, resumed, this.#env, this.#host);
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
          const remote=this.#store?.hostWorktrees().find(row=>row.item===item);
          if(remote) {
            const host=this.#resolveHost?.(remote.host);if(!host)throw new Error(`host ${remote.host} unavailable for prune`);
            const expected=expectedBranches.get(item);
            await pruneHostTaskWorktree({project:this.root,row:remote,host,store:this.#store!,env:this.#env,...(expected?{expected}:{}),validate:async()=>{
              await this.#tracker.viewAsync(item,resumed);
              const fresh=()=>{if(this.#tracker.summary(item)?.state!=='closed'||this.#launching.has(item))throw new Error(`${item}: no longer prunable`);};
              fresh();
              if((await host.occupants(remote.path,this.#sessions().filter(s=>s.host===remote.host))).length)throw new Error(`${item}: occupied worktree`);
              fresh();
              return fresh;
            }});
            removed.push({item,path:remote.path,branch:remote.branch});continue;
          }
          const done = await this.#git.removeTaskWorktree(this.root, item, async () => {
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
          }, expectedBranches.get(item), resumed, this.#env, this.#host);
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
