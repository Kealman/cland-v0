// The tracker: item files in `.cland/tasks/` are the source of truth, the hub writes them and keeps the
// index (spec 4.6, ADR 0002).
//
// One queue owns every read/change/commit cycle and serving-time watcher read. The atomic
// replacement completes before indexing, notification and the returned result. Criterion writes refuse
// concurrent hand saves; other writes keep their last-writer-wins policy.
// Verdict Git resolution belongs to its admitted operation; later tracker operations wait behind it.

import { PlanError, parsePlan, planInBody, withPlan, type QaPolicy, type EpicPlan } from './plan.ts';
import { compareRank, effectiveRank, rankChanges } from './rank.ts';
import type { MarkedCriterion } from '../protocol.ts';
import { criterionRefusal, criteriaSource, parseCriteria, type Criterion, type CriterionWarning } from './criteria.ts';
import { DEFAULT_LEVELS, kindsFor, kindWithArticle, isPlanningContainer } from './kinds.ts';
import { taskBase, territoryPath } from '../territory.ts';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, linkSync, unlinkSync, mkdirSync, readdirSync, readFileSync, statSync, type Stats } from 'node:fs';
import files, { type FileHandle } from 'node:fs/promises';
import type { Resumed } from '../hub/budget.ts';
import type { SessionHold } from '../protocol.ts';
const untimed: Resumed = work => work();
import { basename, join } from 'node:path';
import { commentKey, TrackerIndex, type Claim, type VerifierHold, type IndexedItem, type IndexedVerdict, type ListFilter } from './index-db.ts';
import {
  COMMENTS_HEADING,
  fileNameOf,
  fileNumber,
  formatVerdictBy,
  ItemParseError,
  UnknownKindError,
  normalizeId,
  parseItem,
  RESULTS,
  serializeItem,
  STATES,
  statusRefusal,
  rankable,
  VERDICT_KINDS,
  versionRefusal,
  parentingRefusal,
  withReleaseNotes,
  type Comment,
  type GithubRef,
  type Item,
  type Kind,
  type State,
  type Status,
  type Verdict,
  type VerdictKind,
  type VerdictResult,
} from './item.ts';
import type { LogFn } from '../log.ts';
import { gitIn, resolveCommit, type Git } from './verdict-git.ts';
import { gateEpicVerdict, incompleteEpicCriteria, gateVerdicts } from './gate-verdicts.ts';
import { MergeError, type MergeCode } from '../merge.ts';
import type { MergeReceipt } from './index-db.ts';
import { Freshness, pending, type TipSchedule } from './freshness.ts';
import { watchFolder, type FolderWatch } from '../watch.ts';

/** How long the watcher waits for a file to settle before reading it. */
export const DEBOUNCE_MS = 100;
/** A hand edit landing this soon after the hub wrote the same item is reported as a conflict. */
export const CONCURRENT_MS = 2000;

/**
 * Who asks: a session or a person at the CLI. `id` is the identity a claim is held by — a session's id,
 * stable across renames, or `human` / `cli:<name>` for the CLI; `name` and `role` are what files show.
 * Wire actors carry explicit `human` provenance because session ids may also begin with `cli:`.
 */
export type Actor = { id: string; name: string; role: string | null; human?: boolean };

type Child = Pick<IndexedItem, 'id' | 'kind' | 'title' | 'state' | 'file'>;

export type ItemView = IndexedItem & {
  /** The file, relative to the project root. */
  path: string;
  /** Root-to-item header path, including this item; distinct from the file path. */
  ancestry: Array<Pick<IndexedItem, 'id' | 'kind' | 'title'>>;
  /** The integration branch used for patch-id comparisons, or null when neither exists. */
  verdictBase: string | null;
  body: string;
  /** Last valid plan; a refused hand save is reported separately. */
  plan: EpicPlan | null;
  /** Effective merge policy, from the nearest containing plan or the project default. */
  qaPolicy?: QaPolicy;
  qaCriteria?: string[];
  planError?: string;
  criteria: Criterion[];
  criteriaWarnings: CriterionWarning[];
  comments: Comment[];
  verdicts: IndexedVerdict[];
  claim: Claim | null;
  holds: VerifierHold[];
  /** The GitHub issue the item was imported from, when it was. */
  github?: GithubRef;
};

/** A row of `task.list`: the indexed fields, the live claim, and the verdicts in file order (the latest last). */
export type ItemSummary = IndexedItem & { layer?: import('../hub/visibility.ts').Layer; claim: Claim | null; holds: VerifierHold[]; verdicts: IndexedVerdict[]; verdictBase: string | null };

/** An index change, as a subscribed UI hears it (the `task` event): the item as `task.list` shows it, or null when its file is gone. */
export type ItemChange = { id: string; item: ItemSummary | null; siblings?: string[]; events?: string[]; previousAncestry?: string[] };

const verdictIdentity = (v: IndexedVerdict): string => JSON.stringify([v.author, v.at, v.verdict, v.result, v.run, v.commit ?? null, v.by]);

export type CreateInput = {
  title: string;
  kind?: Kind;
  version?: string;
  body?: string;
  labels?: string[];
  assignee?: string | null;
  parent?: string | null;
  blocked_by?: string[];
  topic?: string | null;
  branch?: string | null;
};

export type EditInput = {
  status?: Status;
  version?: string | null;
  title?: string;
  body?: string;
  kind?: Kind;
  state?: State;
  labels?: string[];
  add_labels?: string[];
  remove_labels?: string[];
  assignee?: string | null;
};

export type LinkInput = {
  parent?: string | null;
  /** Blockers to add. */
  blocked_by?: string[];
  /** Blockers to remove. */
  unblock?: string[];
  topic?: string | null;
  branch?: string | null;
};

export type VerdictReport = { topic: string | null; text: string; criteria?: MarkedCriterion[] };
export type VerdictInput = { verdict: VerdictKind; result: VerdictResult; run: string; commit?: string; verified?: string; failed?: { criterion: string; note: string }[] };

export class TrackerError extends Error {
  /** `git-unavailable`: Git did not answer a question the write needs (a verdict's commit, a branch tip). */
  readonly code?: 'git-unavailable' | MergeCode;
  constructor(message: string, code?: 'git-unavailable' | MergeCode) {
    super(message);
    if (code) this.code = code;
  }
}

/**
 * The hub's side of an item's `topic` field (spec 4.5): one topic per item and one item per topic, the topic's
 * `item` and the item's `topic` one fact. `task.link` and `task.create` with a topic go through it.
 */
export type TopicBinding = {
  /** Throws why `topic` cannot be bound to `item` (null: an item about to be created). */
  check: (item: string | null, topic: string) => void;
  /** The item's file now names `topic` (null: none): the hub records the binding. */
  bound: (item: string, topic: string | null) => void;
};

const hashOf = (text: string): string => createHash('sha256').update(text).digest('hex');

const TASKS_REL = join('.cland', 'tasks');
const QA_FALLBACK_WARNING = 'QA migration fallback: retired outside any plan; uses [plan] qa_default. The old QA requirement may no longer be met; plan this item or set qa_default to retain it.';

/** Native file boundary: requests only read UTF-8 item text and ordinary stat results. */
export type TrackerFiles = Pick<typeof files, 'open' | 'rename' | 'unlink' | 'link'> & {
  readFile: (path: string, encoding: 'utf8') => Promise<string>;
  writeFile: (path: string, text: string) => Promise<void>;
  readdir: (path: string) => Promise<string[]>;
  stat: (path: string) => Promise<Stats>;
};

export class Tracker {
  readonly levels: readonly string[];
  readonly #qaDefault: QaPolicy;
  get kinds(): string[] { return kindsFor(this.levels); }
  /** The default epic occupies the second configured container level. */
  isPlanContainer(kind: Kind): boolean { return this.levels[1] !== undefined && kind === this.levels[1]; }
  readonly #files: TrackerFiles;
  #queue: Promise<unknown> = Promise.resolve();
  readonly #root: string;
  readonly #dir: string;
  readonly #index: TrackerIndex;
  readonly #log: LogFn;
  readonly #now: () => Date;
  #watcher: FolderWatch | null = null;
  #stopping: Promise<void> | null = null;
  #polling = false;
  #bootstrapping = true;
  readonly #planErrors = new Map<string, string>();
  /** Parsed file candidates, including temporarily invalid plans waiting for dependent hand saves. */
  readonly #planCandidates = new Map<string, { item: Item; source: 'hub' | 'hand'; writer?: Actor }>();
  readonly #background = new Set<Promise<unknown>>();
  readonly #watchResumed: Resumed;
  /** The folder as the last poll saw it (only used when it cannot be watched). */
  #polled = '';
  readonly #pending = new Map<string, NodeJS.Timeout>();
  #rescanTimer: NodeJS.Timeout | null = null;

  /** Tests only: hold a completed temporary write until the test releases it. */
  readonly #writeGate: (() => Promise<void>) | undefined;
  /** Told when an item closes (the hub's close, an edit to `closed`, a hand edit): its topic closes too (spec 4.5). */
  readonly #closedListeners = new Set<(id: string) => void>();
  /** Told after every index change (a write, a hand edit, a removal, a claim): the `task` event. */
  readonly #changeListeners = new Set<(change: ItemChange) => void>();
  /** Told when a verdict comment is written through the hub: the inbox notes it (#33). */
  readonly #verdictListeners = new Set<(id: string, author: string, verdict: Verdict, report?: VerdictReport) => void>();
  /** The hub's topic binding; without one (a tracker on its own) the `topic` field is written as given. */
  #topicBinding: TopicBinding | null = null;
  readonly #git: Git;
  /** Verdict freshness, computed off the request path; the reads only look it up. */
  readonly #fresh: Freshness;
  /** Each item's freshness as last announced: an answer that arrives later is announced only when it differs. */
  readonly #revisions = new Map<string, number>();
  readonly #readyChecks = new Set<string>();
  readonly #readyAgain = new Set<string>();
  readonly #readyRetries = new Map<string, NodeJS.Timeout>();
  readonly #retryCounts = new Map<string, number>();
  readonly #readyErrors = new Map<string, string>();
  readonly #retryDelays = new Map<string, number>();
  readonly #sessionIds = new Map<string, string>();
  readonly #adoptions = new Map<string, Set<string>>();
  #identityOf: (id: string) => string = id => this.#sessionIds.get(id) ?? id;
  #identityAdopted: (name: string, id: string) => void = () => {};
  readonly #announced = new Map<string, ItemSummary>();
  readonly #shown = new Map<string, string>();

  constructor(options: { qaDefault?: QaPolicy; levels?: readonly string[]; watchResumed?: Resumed; files?: TrackerFiles; root: string; db: string; log?: LogFn; now?: () => Date; writeGate?: () => Promise<void>; git?: Git; tipCheckMs?: number; scheduleTips?: TipSchedule }) {
    this.#qaDefault = options.qaDefault ?? { scope: 'none', when: 'per-item' };
    this.levels = Object.freeze([...(options.levels ?? DEFAULT_LEVELS)]);
    this.#files = options.files ?? files;
    this.#watchResumed = options.watchResumed ?? untimed;
    this.#root = options.root;
    this.#writeGate = options.writeGate;
    this.#dir = join(options.root, TASKS_REL);
    this.#log = options.log ?? (() => {});
    this.#now = options.now ?? (() => new Date());
    mkdirSync(this.#dir, { recursive: true });
    this.#index = new TrackerIndex(options.db);
    this.#git = options.git ?? gitIn(options.root);
    this.#fresh = new Freshness({
      git: this.#git,
      readBase: async (tips) => await this.#files.stat(territoryPath(this.#root)).then(() => true, () => false) ? await taskBase(this.#root) : tips.has('dev') ? 'dev' : tips.has('main') ? 'main' : null,
      log: this.#log,
      ...(options.tipCheckMs !== undefined ? { intervalMs: options.tipCheckMs } : {}),
      ...(options.scheduleTips ? { scheduleTips: options.scheduleTips } : {}),
      settled: (ids) => ids.forEach((id) => { this.#announce(id, true); this.#scheduleReady(id); }),
      tipsMoved: () => this.#tipsMoved(),
    });
  }

  /** The project root the tracker's folder lies in. */
  get root(): string {
    return this.#root;
  }

  /** Route the `topic` field through the hub's binding; returns the undo. */
  bindTopicsThrough(binding: TopicBinding): () => void {
    this.#topicBinding = binding;
    return () => {
      if (this.#topicBinding === binding) this.#topicBinding = null;
    };
  }

  /** Ask the binding whether `topic` may be `item`'s; its refusal is the asker's error. */
  #checkTopic(item: string | null, topic: string | null): void {
    if (topic === null || !this.#topicBinding) return;
    try {
      this.#topicBinding.check(item, topic);
    } catch (err) {
      throw new TrackerError(err instanceof Error ? err.message : String(err));
    }
  }

  /** Listen to items closing; returns the unsubscribe. */
  onClosed(listener: (id: string) => void): () => void {
    this.#closedListeners.add(listener);
    return () => this.#closedListeners.delete(listener);
  }

  /** Listen to index changes; returns the unsubscribe. */
  onChange(listener: (change: ItemChange) => void): () => void {
    this.#changeListeners.add(listener);
    return () => this.#changeListeners.delete(listener);
  }

  /** The index changed for `id`: the `task` event, and a fresh look at the branch tips (a verdict may need one). */
  #changed(id: string): void {
    this.#revisions.set(id, (this.#revisions.get(id) ?? 0) + 1);
    this.#fresh.poke();
    this.#announce(id, false);
    this.#scheduleReady(id);
    // Reparenting/removing any ancestor can change a task's plan even when no plan text changes.
    for (const child of this.#index.list()) {
      if (child.kind !== 'task' || !this.#ancestorIds(child.parent).includes(id)) continue;
      this.#revisions.set(child.id, (this.#revisions.get(child.id) ?? 0) + 1);
      this.#scheduleReady(child.id);
    }
  }

  /** Every item's freshness may have moved with a branch tip: announce the ones whose known answers changed. */
  #tipsMoved(): void {
    for (const item of this.list()) if (item.verdicts.length || item.status === 'ready') { this.#announce(item.id, true); this.#scheduleReady(item.id); }
  }

  /** Freshness, verdicts and branch changes converge on one queued workflow check. */
  #scheduleReady(id: string, retry = false): void {
    if (!retry) { this.#retryCounts.delete(id); this.#readyErrors.delete(id); }
    const indexed = this.#index.get(id);
    if (this.#readyRetries.has(id)) return;
    if (this.#readyChecks.has(id)) { this.#readyAgain.add(id); return; }
    if (this.#stopping || indexed?.kind !== 'task' || indexed.state !== 'open'
      || (!indexed.branch && !this.#index.verdicts().get(id)?.length) || (!this.#index.verdicts().get(id)?.length && indexed.status !== 'ready')) return;
    this.#readyChecks.add(id);
    this.#runBackground(() => this.#serial(async () => {
      try { await this.#checkReady(id); }
      catch (err) { this.#watchResumed(() => {
        this.#readyErrors.set(id, err instanceof Error ? err.message : String(err));
        this.#readyAgain.add(id);
      }); throw err; }
      finally { this.#watchResumed(() => {
        this.#readyChecks.delete(id);
        if (!this.#readyAgain.delete(id)) { this.#retryDelays.delete(id); this.#retryCounts.delete(id); this.#readyErrors.delete(id); return; }
        if (this.#stopping) return;
        const attempts = (this.#retryCounts.get(id) ?? 0) + 1;
        this.#retryCounts.set(id, attempts);
        if (attempts >= 10) {
          this.#log({ event: 'task-ready-paused', id, attempts, error: this.#readyErrors.get(id) ?? 'readiness evidence kept changing' });
          this.#retryDelays.delete(id);
          return;
        }
        const delay = Math.min((this.#retryDelays.get(id) ?? 25) * 2, 1000);
        this.#retryDelays.set(id, delay);
        const timer = setTimeout(() => this.#watchResumed(() => {
          this.#readyRetries.delete(id);
          this.#scheduleReady(id, true);
        }), delay);
        timer.unref();
        this.#readyRetries.set(id, timer);
      }); }
    }, this.#watchResumed));
  }

  #readyStatus(view: ItemView): Status | null {
    if (view.kind !== 'task' || view.state !== 'open') return null;
    try {
      if (!view.branch) throw new MergeError('merge-branch', `${view.id} has no branch`);
      gateVerdicts(this.#mergeViewOf(view));
      return 'ready';
    } catch (err) {
      if (!(err instanceof MergeError)) throw err;
      // An unchanged rebase may be awaiting its patch-id; keep the last settled status until known.
      if (err.code.endsWith('-pending')) return null;
      return view.status === 'ready' ? 'in progress' : null;
    }
  }

  async #checkReady(id: string): Promise<void> {
    const resumed = this.#watchResumed;
    const { file, revision } = resumed(() => ({ ...this.#require(id), revision: this.#revisions.get(id) }));
    const text = await this.#files.readFile(join(this.#dir, file), 'utf8');
    const checking = resumed(() => {
      const parsed = parseItem(text, file, this.levels);
      const prepare = () => {
        const current = this.#viewOf(id, file, parsed);
        const desired = this.#readyStatus(current);
        if (!desired || current.status === desired) return;
        return this.#mutate(id, { id: 'hub', name: 'hub', role: null }, 'ready', item => {
          const now = this.#viewOf(id, file, item);
          if (this.#readyStatus(now) !== desired) throw new ReadyChanged();
          this.#setStatus(item, desired);
        }, resumed, undefined, undefined, undefined, async () => {
          // Native writes may yield for seconds. Re-read Git and file evidence just before rename;
          // a verdict, hand edit or commit observed after preparation invalidates that preparation.
          const latest = await this.#files.readFile(join(this.#dir, file), 'utf8');
          await this.#fresh.refresh(resumed);
          const afterGit = await this.#files.readFile(join(this.#dir, file), 'utf8');
          await this.#refreshPlans(resumed(() => parseItem(afterGit, file, this.levels)), resumed);
          resumed(() => {
            const now = this.#viewOf(id, file, parseItem(afterGit, file, this.levels));
            if (this.#revisions.get(id) !== revision || afterGit !== latest || latest !== text || this.#readyStatus(now) !== desired) throw new ReadyChanged();
          });
        });
      };
      // Split the budget only at actual ancestor I/O; a parent may be a release
      // with no plan to read. Otherwise parsing and mutation admission stay together.
      const refresh = this.#refreshPlans(parsed, resumed);
      return refresh ? refresh.then(() => resumed(prepare)) : prepare();
    });
    try { await checking; }
    catch (err) { resumed(() => {
      if (!(err instanceof ReadyChanged)) throw err;
      this.#readyErrors.set(id, 'readiness evidence changed during the check');
      this.#readyAgain.add(id);
      // Re-read on the next queue admission. Watcher/index events also converge on this check.
    }); }
  }

  /**
   * The `task` event for `id`. `ifMoved`: only when its freshness changed from what was last announced and none of
   * it is still being computed (that announces itself once known), so a tip read does not flood the UI.
   */
  #announce(id: string, ifMoved: boolean, siblings?: string[]): void {
    const indexed = this.#index.get(id);
    const item: ItemSummary | null = indexed ? { ...indexed, claim: this.#index.claimOf(id), holds: this.#index.holdsOf(id), verdicts: this.#annotateVerdicts(id, indexed.kind, indexed.branch, this.#index.verdicts().get(id) ?? []), verdictBase: this.#fresh.base() } : null;
    const shown = item ? JSON.stringify([item.verdictBase, item.verdicts.map((v) => v.current ?? null)]) : '';
    if (ifMoved && (this.#shown.get(id) === shown || (item && pending(item.verdicts)))) return;
    const previous = this.#announced.get(id);
    // Keep the pre-change path before removal/reparenting changes the indexed tree.
    const previousAncestry: string[] = [];
    for (let ancestor: string | null | undefined = previous?.id; ancestor && !previousAncestry.includes(ancestor); ancestor = this.#announced.get(ancestor)?.parent) previousAncestry.push(ancestor);
    const events: string[] = [];
    if (previous && item) {
      if (previous.status !== item.status) events.push(`status changed ${previous.status ?? 'none'} → ${item.status ?? 'none'}`);
      if (item.claim && (!previous.claim || !this.sameSession(previous.claim.sessionId, item.claim.sessionId))) events.push(`claimed by ${item.claim.session}`);
      const remaining = new Map<string, number>();
      for (const verdict of previous.verdicts) {
        const key = verdictIdentity(verdict);
        remaining.set(key, (remaining.get(key) ?? 0) + 1);
      }
      for (const verdict of item.verdicts) {
        const key = verdictIdentity(verdict), count = remaining.get(key) ?? 0;
        if (count) remaining.set(key, count - 1);
        else events.push(`verdict posted ${verdict.verdict} ${verdict.result} · ${verdict.run}`);
      }
      if (previous.state !== 'closed' && item.state === 'closed') events.push('closed');
    }
    if (item) this.#announced.set(id, item);
    else this.#announced.delete(id);
    if (item) this.#shown.set(id, shown);
    else this.#shown.delete(id);
    if (this.#changeListeners.size === 0) return;
    for (const listener of [...this.#changeListeners]) {
      try {
        listener({ id, item, ...(previousAncestry.length ? { previousAncestry } : {}), ...(siblings ? { siblings } : {}), ...(events.length ? { events } : {}) });
      } catch (err) {
        this.#log({ event: 'task-change-listener-failed', id, error: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  /** Listen to verdict comments written through the hub; returns the unsubscribe. */
  onVerdict(listener: (id: string, author: string, verdict: Verdict, report?: VerdictReport) => void): () => void {
    this.#verdictListeners.add(listener);
    return () => this.#verdictListeners.delete(listener);
  }

  #closed(id: string): void {
    for (const listener of [...this.#closedListeners]) {
      try {
        listener(id);
      } catch (err) {
        this.#log({ event: 'task-close-listener-failed', id, error: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  /** Startup-only recovery: an interrupted capture must not make its item disappear from the index. */
  #recoverCriterionCaptures(): void {
    for (const marker of readdirSync(this.#dir).filter(name => /^\.criterion-capture-[a-f0-9-]+\.json$/.test(name))) {
      const intent = join(this.#dir, marker);
      try {
        const value = JSON.parse(readFileSync(intent, 'utf8')) as { file?: unknown; captured?: unknown };
        if (typeof value.file !== 'string' || typeof value.captured !== 'string' || basename(value.file) !== value.file || basename(value.captured) !== value.captured || fileNumber(value.file) === null || !value.captured.startsWith(`${value.file}.`) || !value.captured.endsWith('.conflict')) throw new Error('invalid criterion capture intent');
        const path = join(this.#dir, value.file);
        try {
          linkSync(join(this.#dir, value.captured), path);
          this.#log({ event: 'task-criterion-recovered', file: value.file, source: value.captured });
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== 'EEXIST' && !((err as NodeJS.ErrnoException).code === 'ENOENT' && existsSync(path))) throw err;
        }
        unlinkSync(intent);
      } catch (err) {
        this.#log({ event: 'task-criterion-recovery-failed', file: marker, error: String(err) });
      }
    }
  }

  /** Bring the index level with the folder, then watch it. */
  start(): void {
    this.#recoverCriterionCaptures();
    this.rescan();
    // Membership is checked after every file has been indexed, including newly added children.
    this.#bootstrapping = false;
    this.rescan();
    // Unchanged cached files skip #changed; every indexed item still needs a restart baseline.
    for (const item of this.list()) this.#announced.set(item.id, item);
    this.#watcher = watchFolder(
      this.#dir,
      {
        changed: (name) => {
          if (name === null) this.#scheduleRescan();
          else if (fileNumber(name) !== null) this.#schedule(name);
        },
        // every file is read only when the folder's listing or a file's time or size moved
        poll: () => {
          if (this.#polling || this.#stopping) return;
          this.#polling = true;
          this.#runBackground(() => this.#serial(async () => {
            try {
              const stamp = await this.#folderStampAsync();
              await this.#watchResumed(() => {
                if (stamp === this.#polled) return;
                this.#polled = stamp;
                return this.#rescanAsync(this.#watchResumed);
              });
            } finally { this.#watchResumed(() => { this.#polling = false; }); }
          }, this.#watchResumed));
        },
      },
      { log: this.#log, event: 'task-watch-error' },
    );
    this.#polled = this.#folderStamp();
    this.#fresh.start();
  }

  /** The item files with their times and sizes: what a poll compares when the folder cannot be watched. */
  #folderStamp(): string {
    try {
      return this.#itemFiles()
        .map((name) => {
          try {
            const s = statSync(join(this.#dir, name));
            return `${name}:${s.mtimeMs}:${s.size}:${s.ino}`;
          } catch {
            return name;
          }
        })
        .join('|');
    } catch {
      return '';
    }
  }

  stop(): Promise<void> {
    if (this.#stopping) return this.#stopping;
    this.#fresh.stop();
    this.#watcher?.close();
    this.#watcher = null;
    for (const t of this.#pending.values()) clearTimeout(t);
    this.#pending.clear();
    for (const retry of this.#readyRetries.values()) clearTimeout(retry);
    this.#readyRetries.clear();
    if (this.#rescanTimer) clearTimeout(this.#rescanTimer);
    this.#stopping = (async () => {
      await Promise.allSettled([...this.#background]);
      await this.#queue.catch(() => {});
      this.#index.close();
    })();
    return this.#stopping;
  }

  // ---------------------------------------------------------------- watching

  #schedule(name: string): void {
    const prev = this.#pending.get(name);
    if (prev) clearTimeout(prev);
    this.#pending.set(
      name,
      setTimeout(() => {
        this.#pending.delete(name);
        this.#runBackground(() => this.#syncFileAsync(name, this.#watchResumed));
      }, DEBOUNCE_MS),
    );
  }

  #scheduleRescan(): void {
    if (this.#rescanTimer) clearTimeout(this.#rescanTimer);
    this.#rescanTimer = setTimeout(() => {
      this.#rescanTimer = null;
      this.#runBackground(() => this.rescanAsync(this.#watchResumed));
    }, DEBOUNCE_MS);
  }

  #itemFiles(): string[] {
    return readdirSync(this.#dir)
      .filter((n) => fileNumber(n) !== null)
      .sort((a, b) => (fileNumber(a) ?? 0) - (fileNumber(b) ?? 0) || a.localeCompare(b));
  }

  /** The whole folder against the index: every file read, every row whose file is gone dropped. */
  rescan(): void {
    const files = this.#itemFiles();
    for (const name of files) this.#syncFile(name);
    const present = new Set(files);
    for (const id of this.#index.ids()) {
      const meta = this.#index.metaOf(id);
      if (meta && !present.has(meta.file)) this.#dropFile(meta.file);
    }
  }

  /** Re-read one file and index it if it changed outside the hub; the hub's own writes come back unchanged. */
  #syncFile(name: string): void {
    const path = join(this.#dir, name);
    let text: string;
    try {
      text = readFileSync(path, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') this.#dropFile(name);
      else this.#indexFailure(name, err);
      return;
    }
    const id = normalizeId(`T-${fileNumber(name)}`);
    const previous = id ? this.#index.metaOf(id) : null;
    this.#indexFile(name, text, !!(previous && previous.file !== name && existsSync(join(this.#dir, previous.file))));
  }

  #indexFile(name: string, text: string, duplicate: boolean, resumed?: Resumed): void | Promise<void> {
    const hash = hashOf(text);
    const knownId = this.#index.idOfFile(name);
    const known = knownId ? this.#index.metaOf(knownId) : null;
    let item: Item;
    try {
      item = parseItem(text, name, this.levels);
    } catch (err) {
      this.#indexFailure(name, err);
      return;
    }
    if (known && known.hash === hash) {
      const indexed = this.#index.get(knownId!);
      if (indexed?.kind !== 'task' || indexed.status !== undefined) {
        this.#plansAfterIndex(item, 'hand');
        return;
      }
    }
    const id = item.fm.id;
    // the id moved out of this file (someone rewrote it by hand): the old row goes
    if (knownId && knownId !== id) {
      this.#index.remove(knownId);
      this.#planCandidates.delete(knownId);
      this.#changed(knownId);
    }
    const prior = this.#index.get(id);
    if (prior && prior.kind !== item.fm.kind) {
      try { this.#checkKindChange(prior.kind, item.fm.kind, this.#index.children(id)); }
      catch (err) { this.#log({ event: 'task-parenting-warning', file: name, error: err instanceof Error ? err.message : String(err) }); }
    }
    const statusBasis = prior;
    const migrated = this.#normalizeStatus(item, statusBasis);
    if (migrated && resumed) {
      const wasOpen = this.#index.get(id)?.state === 'open';
      return this.#write(name, item, resumed).then(() => resumed(() => {
        this.#log({ event: 'task-status-migrated', id, file: name });
        this.#log({ event: 'task-reindexed', id, file: name, source: 'hand' });
        if (wasOpen && item.fm.state === 'closed') this.#closed(id);
      }));
    }
    const previous = this.#index.metaOf(id);
    if (previous && duplicate) {
      this.#log({ event: 'task-duplicate-id', id, files: [previous.file, name], indexed: name });
    }
    const now = this.#now().getTime();
    if (previous?.source === 'hub' && now - previous.indexedAt < CONCURRENT_MS) {
      this.#log({ event: 'task-conflict', id, file: name, winner: 'hand', note: `a hand edit replaced the hub's write of ${new Date(previous.indexedAt).toISOString()}; last writer wins` });
    }
    const wasOpen = prior?.state === 'open';
    this.#index.put(item, { file: name, hash, source: 'hand', indexedAt: now });
    this.#plansAfterIndex(item, 'hand');
    if (migrated) {
      // Bootstrap indexes synchronously before the hub serves requests. Its migrations still write through
      // the same queue, reading again with the pre-scan state so an offline close/reopen keeps its meaning.
      this.#runBackground(() => this.#serial(() => this.#mutate(id, { id: 'hub', name: 'hub', role: null }, 'status migration',
        current => { this.#normalizeStatus(current, statusBasis); }, this.#watchResumed), this.#watchResumed));
    }
    this.#log({ event: 'task-reindexed', id, file: name, source: 'hand' });
    this.#changed(id);
    if (wasOpen && item.fm.state === 'closed') this.#closed(id);
  }

  #runBackground(work: () => Promise<unknown>): void {
    if (this.#stopping) return;
    const run = this.#watchResumed(work);
    this.#background.add(run);
    void run.then(() => this.#watchResumed(() => this.#background.delete(run)), err => this.#watchResumed(() => {
      this.#background.delete(run);
      this.#log({ event: 'task-watch-error', error: err instanceof Error ? err.message : String(err) });
    }));
  }

  async #folderStampAsync(): Promise<string> {
    const resumed = this.#watchResumed;
    try {
      const names = await this.#files.readdir(this.#dir);
      const stamps = await resumed(() => Promise.all(names.filter(n => fileNumber(n) !== null).sort().map(async name => {
        try {
          const info = await this.#files.stat(join(this.#dir, name));
          return resumed(() => `${name}:${info.mtimeMs}:${info.size}:${info.ino}`);
        } catch { return resumed(() => name); }
      })));
      return resumed(() => stamps.join('|'));
    } catch { return resumed(() => ''); }
  }

  /** One admitted scan owns its listing and reads; later mutations cannot interleave a renamed path. */
  rescanAsync(resumed: Resumed = untimed): Promise<void> {
    return this.#serial(() => this.#rescanAsync(resumed), resumed);
  }

  async #rescanAsync(resumed: Resumed): Promise<void> {
    const names = await this.#files.readdir(this.#dir);
    return resumed(() => {
      const candidates = new Set([...names.filter(n => fileNumber(n) !== null), ...this.#index.ids().flatMap(id => {
        const meta = this.#index.metaOf(id);
        return meta ? [meta.file] : [];
      })]);
      const files = candidates.values();
      const next = (): Promise<void> => {
        const file = files.next();
        if (file.done) return Promise.resolve();
        return this.#readWatchedFile(file.value, resumed).then(() => resumed(next));
      };
      return next();
    });
  }

  #syncFileAsync(name: string, resumed: Resumed): Promise<void> {
    return this.#serial(() => this.#readWatchedFile(name, resumed), resumed);
  }

  async #readWatchedFile(name: string, resumed: Resumed): Promise<void> {
    let text: string;
    try { text = await this.#files.readFile(join(this.#dir, name), 'utf8'); }
    catch (err) {
      return resumed(() => {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') this.#dropFile(name);
        else this.#indexFailure(name, err);
      });
    }
    return resumed(() => {
      let id: string;
      try { id = parseItem(text, name, this.levels).fm.id; }
      catch (err) { this.#indexFailure(name, err); return; }
      const previous = this.#index.metaOf(id);
      if (!previous || previous.file === name) return this.#indexFile(name, text, false, resumed);
      return this.#files.stat(join(this.#dir, previous.file)).then(() => true, () => false)
        .then(duplicate => resumed(() => this.#indexFile(name, text, duplicate, resumed)));
    });
  }

  #dropFile(name: string): void {
    const id = this.#index.idOfFile(name);
    if (!id) return;
    this.#index.remove(id);
    this.#planCandidates.delete(id);
    this.#planErrors.delete(id);
    if (!this.#bootstrapping) this.#retryPlans();
    this.#log({ event: 'task-removed', id, file: name });
    this.#changed(id);
  }

  #indexFailure(name: string, err: unknown): void {
    const error = err instanceof Error ? err.message : String(err);
    if (err instanceof UnknownKindError) this.#dropFile(name);
    this.#log({ event: 'task-unreadable', file: name, error });
  }

  #validPlan(item: Item): EpicPlan | null {
    const plan = planInBody(item.body);
    if (!plan) return null;
    if (!this.isPlanContainer(item.fm.kind)) throw new PlanError('a plan belongs only to an epic');
    for (const stage of plan.stages) for (const lane of stage.lanes) for (const id of lane) {
      const child = this.#index.get(id);
      if (!child) throw new PlanError(`${id}: no such plan item`);
      if (child.kind !== 'task') throw new PlanError(`${id}: a lane item must be a task`);
      const seen = new Set<string>();
      let parent = child.parent;
      while (parent && parent !== item.fm.id && !seen.has(parent)) {
        seen.add(parent);
        parent = this.#index.get(parent)?.parent ?? null;
      }
      if (parent !== item.fm.id) throw new PlanError(`${id}: plan item is not under epic ${item.fm.id}`);
    }
    for (const [id, override] of Object.entries(plan.items ?? {})) {
      const ids = this.#index.criterionIds(id);
      for (const criterion of override.qa_criteria ?? []) if (!ids.includes(criterion)) throw new PlanError(`${id}: no criterion ${criterion}`);
    }
    return plan;
  }

  #planState(item: Item): { plan: EpicPlan | null; planError?: string } {
    try { return { plan: this.#validPlan(item) }; }
    catch (err) {
      if (!(err instanceof PlanError)) throw err;
      return { plan: this.#index.plan(item.fm.id), planError: err.message };
    }
  }

  #plansAfterIndex(item: Item, source: 'hub' | 'hand', writer?: Actor): void {
    if (this.isPlanContainer(item.fm.kind)) this.#planCandidates.set(item.fm.id, { item, source, ...(writer ? { writer } : {}) });
    else this.#planCandidates.delete(item.fm.id);
    if (this.#bootstrapping) return;
    this.#acceptPlan(item, source, writer);
    // Criterion, kind or parent changes can make a previously refused epic candidate valid.
    this.#retryPlans(item.fm.id);
  }

  #retryPlans(except?: string): void {
    for (const [id, candidate] of this.#planCandidates) {
      if (id !== except) this.#acceptPlan(candidate.item, candidate.source, candidate.writer);
    }
  }

  #acceptPlan(item: Item, source: 'hub' | 'hand', writer?: Actor): { plan: EpicPlan | null; planError?: string } {
    const state = this.#planState(item), id = item.fm.id;
    if (state.planError) {
      if (this.#planErrors.get(id) !== state.planError) this.#log({ event: 'task-plan-refused', id, file: this.#index.metaOf(id)?.file, error: state.planError, source });
      this.#planErrors.set(id, state.planError);
      return state;
    }
    const recovered = this.#planErrors.delete(id);
    const previous = this.#index.plan(id);
    if (JSON.stringify(previous) === JSON.stringify(state.plan)) {
      // A read can observe a refused save before the watcher indexes it. Restoring
      // the same accepted bytes clears only the detail error, so views need an event.
      if (recovered) this.#announce(id, false);
      return state;
    }
    this.#index.rememberPlan(id, state.plan);
    // A changed epic policy invalidates prepared readiness writes for its tasks too.
    for (const child of this.#index.list()) {
      if (child.kind === 'task' && this.#ancestorIds(child.parent).includes(id)) this.#changed(child.id);
    }
    this.#log({ event: 'task-plan-changed', id, by: writer?.name ?? (source === 'hand' ? 'hand' : 'hub'), source, previous, plan: state.plan });
    return state;
  }

  /** Plans use the same admitted read/modify/publication cycle as other item writes. */
  setPlan(actor: Actor, rawId: string, yaml: string, resumed: Resumed = untimed, authorize: () => void = () => {}): Promise<ItemView> {
    return this.#serial(() => {
      checkText(yaml, 'plan YAML');
      let plan: EpicPlan;
      try { plan = parsePlan(yaml); }
      catch (err) { throw new TrackerError(err instanceof Error ? err.message : String(err)); }
      return this.#mutate(rawId, actor, 'plan set', item => {
        if (!this.isPlanContainer(item.fm.kind)) throw new TrackerError('a plan belongs only to an epic');
        item.body = withPlan(item.body, plan);
      }, resumed, undefined, authorize);
    }, resumed);
  }

  /** Explicit, resumable migration: write the plan before removing each legacy label. */
  migrateQa(actor: Actor, resumed: Resumed = untimed, authorize: () => void = () => {}): Promise<{ migrated: string[]; fallback: string[]; report: string }> {
    return this.#serial(async () => {
      const migrated: string[] = [], fallback: string[] = [];
      const labelled: Item[] = [];
      // Warnings live in task comments, atomically with retirement. Recover them on every retry,
      // including after restart, so an interrupted response never hides an already changed policy.
      for (const row of resumed(() => this.#index.list())) {
        const text = await this.#files.readFile(join(this.#dir, row.file), 'utf8');
        const item = resumed(() => parseItem(text, row.file, this.levels));
        if (item.comments.some(c => c.text === QA_FALLBACK_WARNING)) fallback.push(row.id);
        if (item.fm.labels.includes('qa-required')) labelled.push(item);
      }
      for (const item of labelled) {
        const id = item.fm.id;
        await this.#refreshPlans(item, resumed);
        const epic = resumed(() => this.#ancestorIds(item.fm.parent).find(id => this.#index.plan(id) !== null));
        if (item.fm.kind === 'task' && epic) {
          await this.#mutate(epic, actor, 'qa migration', parent => {
            const state = this.#planState(parent);
            if (state.planError || !state.plan) throw new TrackerError(`${epic}: fix the plan before migrating QA: ${state.planError ?? 'no plan'}`);
            const plan = structuredClone(state.plan);
            if (!plan.stages.some(s => s.lanes.some(lane => lane.includes(id)))) {
              let name = 'Legacy QA';
              while (plan.stages.some(s => s.name === name)) name += ' migration';
              plan.stages.push({ name, qa: { scope: 'affected', when: 'per-item' }, lanes: [[id]] });
            }
            plan.items ??= {};
            const prior = plan.items[id]?.qa ?? plan.stages.find(s => s.lanes.some(lane => lane.includes(id)))!.qa;
            plan.items[id] = { ...plan.items[id], qa: { scope: prior.scope === 'none' ? 'affected' : prior.scope, when: 'per-item' } };
            parent.body = withPlan(parent.body, plan);
          }, resumed, undefined, authorize);
          migrated.push(id);
        } else {
          if (!fallback.includes(id)) fallback.push(id);
          resumed(() => this.#log({ event: 'task-qa-migration-fallback', id, report: QA_FALLBACK_WARNING, by: actor.name }));
        }
        const outside = !(item.fm.kind === 'task' && epic);
        await this.#mutate(id, actor, 'qa migration', current => {
          if (outside && !current.comments.some(c => c.text === QA_FALLBACK_WARNING)) current.comments.push({ author: actor.name, at: this.#now().toISOString(), text: QA_FALLBACK_WARNING });
          current.fm.labels = current.fm.labels.filter(label => label !== 'qa-required');
        }, resumed, undefined, authorize);
      }
      return resumed(() => {
        const report = `Migrated plan QA overrides: ${migrated.join(', ') || 'none'}.` +
          `\nRetired outside any plan (including earlier runs): ${fallback.join(', ') || 'none'}. Those retirements used [plan] qa_default; their old QA requirement may no longer be met. Check their plan or set qa_default to retain it.`;
        this.#log({ event: 'task-qa-migrated', migrated, fallback, report, by: actor.name });
        return { migrated, fallback, report };
      });
    }, resumed);
  }

  // ---------------------------------------------------------------- reading

  #require(rawId: string): { id: string; file: string } {
    const id = normalizeId(rawId);
    if (!id) throw new TrackerError(`"${rawId}" is not an item id (T-<n>)`);
    const meta = this.#index.metaOf(id);
    if (!meta) throw new TrackerError(`no item ${id}`);
    return { id, file: meta.file };
  }

  view(rawId: string): ItemView {
    const { id, file } = this.#require(rawId);
    const indexed = this.#index.get(id);
    if (!indexed) throw new TrackerError(`no item ${id}`);
    // the file is the truth; the index's row is only how it was found
    let item: Item;
    try {
      item = parseItem(readFileSync(join(this.#dir, file), 'utf8'), file, this.levels);
    } catch (err) {
      throw new TrackerError(`${id}: ${join(TASKS_REL, file)} cannot be read: ${err instanceof Error ? err.message : String(err)}`);
    }
    return this.#viewOf(id, file, item);
  }

  viewAsync(rawId: string, resumed: Resumed = untimed): Promise<ItemView> {
    return this.#readViewAsync(rawId, resumed, false);
  }

  mergeViewAsync(rawId: string, resumed: Resumed = untimed): Promise<ItemView> {
    return this.#readViewAsync(rawId, resumed, true);
  }

  #readViewAsync(rawId: string, resumed: Resumed, evidence: boolean): Promise<ItemView> {
    return this.#serial(async () => {
      const { id, file } = this.#require(rawId);
      let text: string;
      try {
        text = await this.#files.readFile(join(this.#dir, file), 'utf8');
      } catch (err) {
        return resumed(() => { throw new TrackerError(`${id}: ${join(TASKS_REL, file)} cannot be read: ${err instanceof Error ? err.message : String(err)}`); });
      }
      await this.#refreshPlans(resumed(() => parseItem(text, file, this.levels)), resumed);
      return resumed(() => {
        let view: ItemView;
        try { view = this.#viewOf(id, file, parseItem(text, file, this.levels)); }
        catch (err) { throw new TrackerError(`${id}: ${join(TASKS_REL, file)} cannot be read: ${err instanceof Error ? err.message : String(err)}`); }
        // Evidence and claims are read after the file await, within the same tracker admission.
        return evidence ? this.#mergeViewOf(view) : view;
      });
    }, resumed);
  }

  #ancestorIds(parent: string | null): string[] {
    const ids: string[] = [];
    while (parent && !ids.includes(parent)) {
      ids.push(parent);
      parent = this.#index.get(parent)?.parent ?? null;
    }
    return ids;
  }

  #refreshPlans(item: Item, resumed: Resumed): Promise<void> | void {
    const ancestors = resumed(() => this.#ancestorIds(item.fm.parent).flatMap(id => {
      const meta = this.#index.metaOf(id);
      return meta && this.isPlanContainer(this.#index.get(id)!.kind) ? [{ id, file: meta.file }] : [];
    }));
    if (!ancestors.length) return;
    return (async () => {
      for (const { id, file } of ancestors) {
        const text = await this.#files.readFile(join(this.#dir, file), 'utf8');
        resumed(() => {
          const parent = parseItem(text, file, this.levels);
          this.#planCandidates.set(id, { item: parent, source: 'hand' });
          this.#acceptPlan(parent, 'hand');
        });
      }
    })();
  }

  #qaFor(item: Item): { qaPolicy: QaPolicy; qaCriteria: string[] } {
    for (const id of this.#ancestorIds(item.fm.parent)) {
      const plan = this.#index.plan(id);
      const stage = plan?.stages.find(s => s.lanes.some(lane => lane.includes(item.fm.id)));
      if (stage) return { qaPolicy: plan!.items?.[item.fm.id]?.qa ?? stage.qa, qaCriteria: plan!.items?.[item.fm.id]?.qa_criteria ?? [] };
    }
    return { qaPolicy: this.#qaDefault, qaCriteria: [] };
  }

  #viewOf(id: string, file: string, item: Item, source: 'file' | 'proposal' = 'file'): ItemView {
    this.#normalizeStatus(item);
    const indexed = this.#index.get(id);
    if (!indexed) throw new TrackerError(`no item ${id}`);
    if (source === 'file' && this.isPlanContainer(item.fm.kind)) this.#planCandidates.set(id, { item, source: 'hand' });
    return {
      ...indexed,
      verdictBase: this.#fresh.base(),
      ...item.fm,
      rank: effectiveRank(item.fm),
      file,
      path: join(TASKS_REL, file),
      ancestry: this.#ancestry(item),
      body: item.body,
      // A read may see a valid hand save before its watcher turn. Retain and journal that exact plan
      // before showing it, so a following invalid save cannot restore an older version.
      // Gate previews are unpublished proposals, so they must not retain or journal a plan.
      ...(source === 'file' ? this.#acceptPlan(item, 'hand') : this.#planState(item)),
      ...parseCriteria(item.body, this.levels.includes(item.fm.kind)),
      ...this.#qaFor(item),
      comments: item.comments,
      verdicts: this.#annotateVerdicts(id, item.fm.kind, item.fm.branch, this.#index.markVerdicts(id, item.comments.flatMap((c) => (c.verdict ? [{ verdict: { ...c.verdict, author: c.author, at: c.at }, key: commentKey(c) }] : [])))),
      claim: this.#index.claimOf(id), holds: this.#index.holdsOf(id),
    };
  }

  #ancestry(item: Item): ItemView['ancestry'] {
    const path: ItemView['ancestry'] = [];
    const seen = new Set<string>();
    let node: Pick<IndexedItem, 'id' | 'kind' | 'title' | 'parent'> | null = item.fm;
    // Legacy/hand-edited parents may be missing or cyclic; never hang a read.
    while (node && !seen.has(node.id)) {
      seen.add(node.id);
      path.push({ id: node.id, kind: node.kind, title: node.title });
      node = node.parent ? this.#index.get(node.parent) : null;
    }
    return path.reverse();
  }

  /** The items, each latest verdict with `current` when the freshness cache knows it (absent: not known yet). */
  freshnessTip(branch: string | null): string | null { return this.#fresh.tip(branch); }

  refreshFreshness(resumed?: <T>(work: () => T) => T): Promise<void> {
    return this.#fresh.refresh(resumed);
  }

  /** The gate selects the latest hub-written verdict per kind; file-only headers cannot replace its evidence.
   * Annotate that selection from the same async cache as view/list, even when a later file header exists. */
  mergeView(rawId: string): ItemView {
    return this.#mergeViewOf(this.view(rawId));
  }

  #mergeViewOf(view: ItemView): ItemView {
    const evidence = this.#index.mergeVerdicts(view.id, view.comments.flatMap(c => c.verdict ? [{ key: commentKey(c), verdict: { ...c.verdict, author: c.author, at: c.at } }] : []));
    if (evidence.missing) throw new MergeError('verdict-missing', `${view.id}: hub verdict run ${evidence.missing.run}, commit ${evidence.missing.commit ?? 'none'}, is missing or altered in the item file`);
    const hub = evidence.verdicts.map(({ current: _current, ...v }) => ({ ...v,
      ...(v.writer ? { writer: { ...v.writer, sessionId: this.#identityOf(v.writer.sessionId) } } : {}),
    }));
    const annotated = this.#annotateVerdicts(view.id, view.kind, view.branch, hub);
    return { ...view, claim: view.claim ? { ...view.claim, sessionId: this.#identityOf(view.claim.sessionId) } : null, verdicts: [...view.verdicts.filter(v => v.source === 'file'), ...annotated] };
  }

  /** An epic verdict covers the exact integration build, including empty commits; task patch equivalence does not apply. */
  #annotateVerdicts(id: string, kind: Kind, branch: string | null, verdicts: IndexedVerdict[]): IndexedVerdict[] {
    if (!isPlanningContainer(kind, this.levels)) return this.#fresh.annotate(id, branch, verdicts);
    const tip = this.#fresh.tip('dev');
    return verdicts.map((v, i) => verdicts.slice(i + 1).some(w => w.verdict === v.verdict) ? v : { ...v, current: !!tip && v.commit === tip });
  }

  #checkEpicClose(view: ItemView, tip: string | null): void {
    try {
      const evidence = this.#mergeViewOf({ ...view, kind: this.levels[1]! });
      gateEpicVerdict({ ...evidence, verdicts: evidence.verdicts.map(v => ({ ...v, current: !!tip && v.commit === tip })) });
    }
    catch (err) {
      if (err instanceof MergeError) throw new TrackerError(err.message, err.code);
      throw err;
    }
  }

  /** Every planning-container close rereads the build and original item before publication. */
  async #epicCloseEvidence(id: string, source: string, resumed: Resumed, verifyBuild = true): Promise<{ tip: string | null; view: ItemView }> {
    const tip = verifyBuild ? await this.#resolve('refs/heads/dev', 'the epic demo build on dev') : null;
    const { file } = resumed(() => this.#require(id));
    const text = await this.#files.readFile(join(this.#dir, file), 'utf8');
    return resumed(() => {
      const live = parseItem(text, file, this.levels);
      if (serializeItem(live) !== source) throw new TrackerError(`${id}: epic evidence changed while closing; retry`);
      return { tip, view: this.#viewOf(id, file, live) };
    });
  }

  recordMerge(rawId: string, receipt: MergeReceipt): void { this.#index.recordMerge(this.#require(rawId).id, receipt); }
  mergeReceipt(rawId: string): MergeReceipt | null { return this.#index.mergeReceipt(normalizeId(rawId) ?? rawId); }

  /** Idempotent follow-ups, kept separate so a failure names the step after a successful landing. */
  finishMerge(actor: Actor, rawId: string, comment: string, resumed: Resumed = untimed): Promise<{ step: string; error: string } | null> {
    return this.#serial(async () => {
      let step = 'close';
      try {
        const id = this.#require(rawId).id;
        checkText(comment, 'comment');
        let closing!: { id: string; kind: Kind };
        let children: Child[] = [];
        await this.#mutate(id, actor, 'close', item => {
          closing = { id: item.fm.id, kind: item.fm.kind };
          item.fm.state = 'closed';
          this.#setStatus(item, 'done');
          if (!item.comments.some(c => c.text === comment)) item.comments.push({ author: actor.name, at: this.#now().toISOString(), text: comment });
        }, resumed, undefined, () => this.#checkClose(closing.id, closing.kind, children), undefined, async () => {
          if (this.levels.includes(closing.kind)) children = await this.#scanChildren(closing.id, resumed);
        });
        return resumed(() => {
          step = 'release';
          this.#releaseOnClose(id);
          step = 'topic close';
          for (const listener of [...this.#closedListeners]) listener(id);
          return null;
        });
      } catch (err) { return resumed(() => ({ step, error: err instanceof Error ? err.message : String(err) })); }
    }, resumed);
  }

  list(filter: ListFilter = {}): ItemSummary[] {
    if (filter.under !== undefined) filter = { ...filter, under: this.#require(filter.under).id };
    const claims = this.#index.claims();
    const verdicts = this.#index.verdicts();
    const base = this.#fresh.base();
    return this.#index.list(filter).map((i) => ({ ...i, claim: claims.get(i.id) ?? null, holds: this.#index.holdsOf(i.id), verdictBase: base, verdicts: this.#annotateVerdicts(i.id, i.kind, i.branch, verdicts.get(i.id) ?? []) }));
  }

  /** Session work reads indexed ownership; item bodies and verdict provenance are irrelevant. */
  sessionHolds(sessionId: string): SessionHold[] {
    // Session disconnects can still publish presence after the tracker has begun shutdown.
    if (this.#stopping) return [];
    const claims: SessionHold[] = [], holds: SessionHold[] = [];
    for (const [item, claim] of this.#index.indexedClaims()) {
      if (this.sameSession(claim.sessionId, sessionId)) claims.push({ item, role: 'item' });
    }
    for (const [item, verifiers] of this.#index.indexedHolds()) {
      for (const hold of verifiers) if (this.sameSession(hold.sessionId, sessionId)) {
        holds.push({ item, role: hold.role === 'reviewer' ? 'review' : 'qa' });
      }
    }
    return [...claims, ...holds];
  }

  /** Routing reads only committed index facts, without reading item files or yielding. */
  itemLead(id: string): { state: string; claim: Claim | null } | null {
    const item = this.#index.get(id);
    return item ? { state: item.state, claim: this.#index.claimOf(id) } : null;
  }

  hasProvisionalSession(name: string): boolean { return this.#index.provisionalSessions().includes(`name:${name}`); }

  // ---------------------------------------------------------------- writing

  /** Admit every operation on one tail: file names and frontmatter ids can change while work waits. */
  #serial<T>(work: () => Promise<T> | T, resumed: Resumed): Promise<T> {
    if (this.#stopping) return Promise.reject(new TrackerError('tracker is stopping'));
    const run = this.#queue.then(() => resumed(work), () => resumed(work));
    this.#queue = run.catch(() => {});
    return run;
  }

  /**
   * Write an item's file atomically and index it. `read` is what a change was made from: the hash of the
   * text read and the file handle it was read through. A hand edit can land between that read and the
   * rename — written to the path (an editor's save-by-rename, or in place before the rename) or into the
   * replaced file in place up to the rename. Either is looked for, just before and just after the rename,
   * and reported: the hub's write is the file, the hand edit is overwritten (last writer wins).
   */
  async #write(name: string, item: Item, resumed: Resumed, read?: { id: string; op: string; hash: string; fd: FileHandle; captured?: string }, verdictWriter?: Actor, beforeCommit?: () => void, committed?: () => void, beforeRename?: () => Promise<void>, planWriter?: Actor): Promise<Item> {
    this.#normalizeStatus(item);
    const text = serializeItem(item);
    const written = parseItem(text, name, this.levels);
    this.#validPlan(written);
    const path = join(this.#dir, name);
    const tmp = join(this.#dir, `.${name}.${process.pid}.tmp`);
    try {
      await this.#files.writeFile(tmp, text);
      // No fsync was used by the synchronous implementation: completion promises atomic replacement,
      // not survival of power loss. A process crash before rename leaves the previous item intact.
      if (this.#writeGate) await this.#writeGate();
      const before = read ? await this.#files.readFile(path, 'utf8').then(text => resumed(() => hashOf(text)), () => null) : null;
      if (beforeRename) await resumed(beforeRename);
      if (read?.op === 'criterion' && before !== read.hash) throw new TrackerError(`${read.id}: concurrent hand edit; criterion write refused, retry`);
      if (read?.op === 'criterion') await this.#replaceCriterion(path, tmp, read.hash, resumed, beforeCommit, path => { read.captured = path; });
      else await resumed(() => { beforeCommit?.(); return this.#files.rename(tmp, path); });
      const replacedText = read ? await readWhole(read.fd, resumed).catch(() => null) : null;
      const replaced = replacedText === null ? null : resumed(() => hashOf(replacedText));
      if (read?.op === 'criterion' && replaced !== read.hash) throw new TrackerError(`${read.id}: concurrent in-place hand edit; criterion write refused, recover ${read.captured} and retry`);
      return resumed(() => {
        if (read?.captured) this.#log({ event: 'task-criterion-source', id: read.id, path: read.captured, note: 'retained source protects late saves through an already open editor handle' });
        this.#index.put(written, { file: name, hash: hashOf(text), source: 'hub', indexedAt: this.#now().getTime() }, verdictWriter ? { ...verdictWriter, id: this.#sessionId(verdictWriter.id) } : undefined);
        this.#plansAfterIndex(written, 'hub', planWriter);
        committed?.();
        this.#changed(written.fm.id);
        if (read && (before !== read.hash || replaced !== read.hash)) {
          this.#log({ event: 'task-conflict', id: read.id, file: name, winner: 'hub', op: read.op,
            note: 'a hand edit landed while the hub was writing this item and was overwritten by the hub write; last writer wins' });
        }
        return written;
      });
    } catch (err) {
      // A failed temporary write or rename must not masquerade as a committed item.
      await resumed(() => this.#files.unlink(tmp)).catch(() => {});
      return resumed(() => { throw err; });
    }
  }

  /** Capture the source before publishing without replacement: an editor's save can never be overwritten.
   * Tracker readers stay queued during the brief gap. A conflict retains the captured source for recovery. */
  async #replaceCriterion(path: string, tmp: string, expected: string, resumed: Resumed, authorize?: () => void, capturedSource?: (path: string) => void): Promise<void> {
    const captureId = randomUUID();
    const captured = `${path}.${captureId}.conflict`;
    const intent = join(this.#dir, `.criterion-capture-${captureId}.json`);
    await this.#files.writeFile(`${intent}.tmp`, JSON.stringify({ file: basename(path), captured: basename(captured) }));
    await this.#files.rename(`${intent}.tmp`, intent);
    await resumed(() => { authorize?.(); return this.#files.rename(path, captured); });
    resumed(() => capturedSource?.(captured));
    try {
      const before = await this.#files.readFile(captured, 'utf8');
      if (resumed(() => hashOf(before)) !== expected) throw new TrackerError('concurrent hand edit; criterion write refused, retry');
      // link fails with EEXIST if an editor saved at the original path after we captured it.
      await resumed(() => { authorize?.(); return this.#files.link(tmp, path); });
      const after = await this.#files.readFile(captured, 'utf8');
      if (resumed(() => hashOf(after)) !== expected) throw new TrackerError('concurrent in-place hand edit; criterion write refused');
      // Keep the inode: an editor may still hold it open and complete an in-place save later.
      await this.#files.unlink(tmp);
      await this.#files.unlink(intent);
    } catch (err) {
      // Restore only an absent path. A newer save at the path always wins; retain the captured source too.
      try { await this.#files.link(captured, path); }
      catch (restore) { if ((restore as NodeJS.ErrnoException).code !== 'EEXIST') throw new TrackerError(`criterion write failed; recover ${captured}: ${String(restore)}`); }
      await this.#files.unlink(intent).catch(() => {});
      if (err instanceof TrackerError) throw new TrackerError(`${err.message}; captured source: ${captured}; recover and retry`);
      if ((err as NodeJS.ErrnoException).code === 'EEXIST') throw new TrackerError(`concurrent hand save; criterion write refused, retry; captured source: ${captured}`);
      throw err;
    }
  }

  /** Called only with the tracker queue held: always read the latest committed file. */
  async #mutate(rawId: string, actor: Actor, op: string, change: (item: Item) => void, resumed: Resumed, verdictWriter?: Actor, beforeCommit?: () => void, committed?: () => void, beforeRename?: () => Promise<void>): Promise<ItemView> {
    const { id, file } = this.#require(rawId);
    const path = join(this.#dir, file);
    let fd: FileHandle;
    try { fd = await this.#files.open(path, 'r'); }
    catch (err) {
      return resumed(() => {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') this.#dropFile(file);
        throw new TrackerError(`${id}: cannot open ${join(TASKS_REL, file)} (${err instanceof Error ? err.message : String(err)})`);
      });
    }
    let result: { written: Item } | { error: unknown };
    try {
      const text = await resumed(() => readWhole(fd, resumed));
      const written = await resumed(() => {
        const meta = this.#index.metaOf(id);
        let item: Item;
        try { item = parseItem(text, file, this.levels); }
        catch (err) { throw new TrackerError(`${id}: ${join(TASKS_REL, file)} cannot be read (${err instanceof ItemParseError ? err.message : String(err)}); fix the file by hand first`); }
        if (meta && meta.hash !== hashOf(text)) this.#log({ event: 'task-conflict', id, file, winner: 'hub', op, note: 'a hand edit not yet indexed was read and the hub write applied on top of it; last writer wins' });
        change(item);
        item.fm.updated = this.#now().toISOString();
        return this.#write(file, item, resumed, { id, op, hash: hashOf(text), fd }, verdictWriter, beforeCommit, committed, beforeRename, actor);
      });
      result = { written };
    } catch (error) { result = { error }; }
    // Publication, result construction and the close's synchronous prefix are one continuation.
    return resumed(async () => {
      try {
        if ('error' in result) throw result.error;
        this.#log({ event: 'task-written', id, file, op, by: actor.name });
        return this.#viewOf(id, file, result.written);
      } finally { await fd.close(); }
    });
  }

  #ref(raw: string, self: string | null, what: string): string {
    const id = normalizeId(raw);
    if (!id) throw new TrackerError(`${what}: "${raw}" is not an item id (T-<n>)`);
    if (id === self) throw new TrackerError(`${what}: an item cannot reference itself`);
    if (!this.#index.metaOf(id)) throw new TrackerError(`${what}: no item ${id}`);
    return id;
  }

  #checkParent(kind: Kind, parent: string | null): void {
    if (parent === null) return;
    const indexed = this.#index.get(parent);
    if (!indexed) throw new TrackerError(`parent: no item ${parent}`);
    const refusal = parentingRefusal(kind, indexed.kind, this.levels);
    if (refusal) throw new TrackerError(`${refusal} (parent ${parent})`);
  }

  create(actor: Actor, input: CreateInput, resumed: Resumed = untimed, authorize: () => void = () => {}): Promise<ItemView> {
    return this.#serial(() => this.#create(actor, input, resumed, authorize), resumed);
  }

  async #create(actor: Actor, input: CreateInput, resumed: Resumed, authorize: () => void): Promise<ItemView> {
    const title = input.title?.trim();
    if (!title) throw new TrackerError('an item needs a title');
    const kind = input.kind ?? 'task';
    if (!this.kinds.includes(kind)) throw new TrackerError(`unknown kind "${kind}" (one of ${this.kinds.join(', ')})`);
    if (input.version !== undefined) {
      const refusal = versionRefusal(kind, input.version, this.levels);
      if (refusal) throw new TrackerError(refusal);
    }
    checkText(input.body ?? '', 'body');
    const parent = input.parent ? this.#ref(input.parent, null, 'parent') : null;
    this.#checkParent(kind, parent);
    const blocked = [...new Set((input.blocked_by ?? []).map((b) => this.#ref(b, null, 'blocked_by')))];
    const topic = input.topic?.trim() || null;
    this.#checkTopic(null, topic);
    const names = await this.#files.readdir(this.#dir);
    return resumed(async () => {
      const maxFile = Math.max(0, ...names.map((n) => fileNumber(n) ?? 0));
      const id = this.#index.allocate(maxFile);
      const name = fileNameOf(id, title);
      const now = this.#now().toISOString();
      const item: Item = {
        fm: {
          id,
          kind,
          ...(input.version !== undefined ? { version: input.version } : {}),
          title,
          state: 'open',
          labels: uniq(input.labels ?? []),
          assignee: input.assignee ?? null,
          parent,
          blocked_by: blocked,
          topic,
          branch: input.branch ?? null,
          created: now,
          updated: now,
        },
        body: kind === this.levels[0] ? withReleaseNotes(input.body ?? '') : input.body?.trim() ?? '',
        comments: [],
      };
      const written = await this.#write(name, item, resumed, undefined, undefined, () => { authorize(); this.#checkTopic(id, topic); }, undefined, undefined, actor);
      return resumed(() => {
        this.#log({ event: 'task-written', id, file: name, op: 'create', by: actor.name });
        if (topic !== null) this.#topicBinding?.bound(id, topic);
        return this.#viewOf(id, name, written);
      });
    });
  }

  /**
   * A comment, or a verdict: its commit (given, or the branch tip) is resolved with Git before the write, never inside
   * it. `resumed` times each synchronous continuation after Git and file I/O.
   */
  comment(actor: Actor, rawId: string, text: string, verdict?: VerdictInput, resumed: Resumed = untimed, currentActor?: () => Actor): Promise<ItemView> {
    return this.#serial(() => this.#comment(actor, rawId, text, verdict, resumed, currentActor), resumed);
  }

  #comment(actor: Actor, rawId: string, text: string, verdict: VerdictInput | undefined, resumed: Resumed, currentActor?: () => Actor): Promise<ItemView> {
    this.#ensureSession(actor);
    const body = (text ?? '').trim();
    if (!body && !verdict) throw new TrackerError('a comment needs text');
    checkText(body, 'comment');
    let v: Verdict | undefined;
    if (verdict) {
      if (!VERDICT_KINDS.includes(verdict.verdict)) throw new TrackerError(`verdict must be ${VERDICT_KINDS.join(' or ')}`);
      if (!RESULTS.includes(verdict.result)) throw new TrackerError(`result must be ${RESULTS.map((r) => `"${r}"`).join(' or ')}`);
      if (!verdict.run?.trim() || /\n/.test(verdict.run)) throw new TrackerError('a verdict needs a run id (one line)');
      v = { verdict: verdict.verdict, result: verdict.result, by: formatVerdictBy(actor.name, actor.role), run: verdict.run.trim() };
      if (verdict.commit !== undefined) {
        if (typeof verdict.commit !== 'string' || !/^[0-9a-f]{4,64}$/i.test(verdict.commit)) throw new TrackerError('commit must be a Git commit SHA');
      }
    }
    const marking = verdict?.verified !== undefined || verdict?.failed !== undefined;
    const checkMarks = (writer: Actor) => {
      if (!marking) return;
      const reason = criterionRefusal('verify', { role: writer.role, human: writer.human ?? (writer.role === null), claimed: false });
      if (reason) throw new TrackerError(reason);
      if (!/^\S+$/.test(v?.run ?? '')) throw new TrackerError('verify needs a run id (no whitespace)');
      if (verdict?.verified !== undefined && (typeof verdict.verified !== 'string' || !/^(?:all|C[1-9]\d*(?:,C[1-9]\d*)*)$/.test(verdict.verified))) throw new TrackerError('verified must be criterion ids such as C1,C3 or all');
      if (verdict?.verified !== undefined && v?.result !== 'clear') throw new TrackerError('verified requires a clear verdict');
      if (verdict?.failed !== undefined) {
        if (v?.result !== 'not clear') throw new TrackerError('failed requires a not-clear verdict');
        if (!Array.isArray(verdict.failed) || !verdict.failed.length) throw new TrackerError('failed must be a nonempty list of { criterion, note }');
        for (const failure of verdict.failed) {
          if (!failure || typeof failure.criterion !== 'string' || !/^C[1-9]\d*$/.test(failure.criterion)) throw new TrackerError('failed criterion must be an id such as C1');
          if (typeof failure.note !== 'string' || !failure.note.trim() || /[\r\n]/.test(failure.note)) throw new TrackerError('fail needs a note (one line)');
          checkText(failure.note, 'failure note');
        }
        if (new Set(verdict.failed.map(f => f.criterion)).size !== verdict.failed.length) throw new TrackerError('failed criterion ids must be unique');
      }
    };
    checkMarks(actor);
    let tip: { branch: string; sha: string | null } | null = null;
    // Git resolution belongs to this admitted operation; later writes and views wait behind it.
    const write = () => {
      const writer = currentActor ? currentActor() : actor;
      this.#ensureSession(writer);
      checkMarks(writer);
      if (v) v.by = formatVerdictBy(writer.name, writer.role);
      if (tip?.sha) this.#fresh.noteTip(tip.branch, tip.sha);
      return this.#writeComment(writer, rawId, body, v, tip, resumed, () => {
        checkMarks(writer);
        if (!currentActor) return;
        const now = currentActor();
        this.#ensureSession(now);
        if (now.id !== writer.id || now.name !== writer.name || now.role !== writer.role || now.human !== writer.human) throw new TrackerError('comment writer changed while the item was being written; nothing was written, retry');
      }, verdict);
    };
    if (v && verdict?.commit !== undefined) {
      return this.#resolve(verdict.commit, `the verdict's commit ${verdict.commit}`).then(commit => resumed(() => {
        if (!commit) throw new TrackerError('commit does not resolve to a Git commit');
        v!.commit = commit;
        return write();
      }));
    }
    if (v) {
      const indexed = this.#index.get(this.#require(rawId).id);
      const branch = isPlanningContainer(indexed?.kind, this.levels) ? 'dev' : indexed?.branch ?? null;
      if (branch) return this.#resolve(`refs/heads/${branch}`, `the tip of branch ${branch}`).then(sha => resumed(() => {
        tip = { branch, sha };
        return write();
      }));
    }
    return write();
  }

  async #writeComment(actor: Actor, rawId: string, body: string, v: Verdict | undefined, tip: { branch: string; sha: string | null } | null, resumed: Resumed, beforeCommit?: () => void, input?: VerdictInput): Promise<ItemView> {
    const marking = input?.verified !== undefined || input?.failed !== undefined;
    const marked: MarkedCriterion[] = [];
    const view = await this.#mutate(rawId, actor, marking ? 'criterion' : v ? 'verdict' : 'comment', (item) => {
      if (v && !v.commit) {
        // a hand edit moved the branch meanwhile: the tip the cache last read for it
        const branch = isPlanningContainer(item.fm.kind, this.levels) ? 'dev' : item.fm.branch;
        const sha = branch === tip?.branch ? tip.sha : this.#fresh.tip(branch);
        if (sha) v.commit = sha;
      }
      if (marking) {
        const criteria = this.#prepareCriteria(item).criteria;
        const verified = input?.verified === 'all' ? criteria.map(c => c.id!) : input?.verified?.split(',') ?? [];
        for (const id of new Set(verified)) {
          this.#changeCriterion(item, actor, { op: 'verify', criterion: id, run: v!.run });
          marked.push({ id, mark: 'verified' });
        }
        for (const failure of input?.failed ?? []) {
          this.#changeCriterion(item, actor, { op: 'fail', criterion: failure.criterion, note: failure.note });
          marked.push({ id: failure.criterion, mark: 'failed', note: failure.note.trim() });
        }
      }
      const summary = marked.length ? `Criteria: ${marked.map(c => `${c.id} ${c.mark}${c.note ? ` (${c.note})` : ''}`).join(', ')}.` : '';
      item.comments.push({ author: actor.name, at: this.#now().toISOString(), text: [body, summary].filter(Boolean).join('\n\n'), ...(v ? { verdict: v } : {}) });
      if (v?.result === 'not clear') {
        this.#setStatus(item, 'in progress');
        if (this.levels.includes(item.fm.kind)) item.fm.state = 'open';
      }
    }, resumed, actor, beforeCommit, v ? () => this.#index.setHold(normalizeId(rawId) ?? rawId, this.#sessionId(actor.id), null) : undefined);
    return resumed(() => {
      for (const c of marked) this.#criterionEvent(view.id, c.id, c.mark);
      // what is announced is what the file records, however it came: a structured verdict, or a text that reads back
      // as one (its header lines), so every verdict on record is a notification
      const recorded = view.comments.at(-1)?.verdict;
      if (recorded) {
        for (const listener of [...this.#verdictListeners]) {
          try {
            listener(view.id, actor.name, recorded, v ? { topic: view.topic, text: view.comments.at(-1)!.text, ...(marking ? { criteria: marked } : {}) } : undefined);
          } catch (err) {
            this.#log({ event: 'task-verdict-listener-failed', id: view.id, error: err instanceof Error ? err.message : String(err) });
          }
        }
      }
      return view;
    });
  }

  /** A ref resolved for a write; Git not answering at all is a typed refusal naming what it could not resolve. */
  async #resolve(ref: string, what: string): Promise<string | null> {
    try {
      return await resolveCommit(this.#git, ref);
    } catch (err) {
      throw new TrackerError(`cannot resolve ${what}: Git did not answer (${err instanceof Error ? err.message.split('\n')[0] : String(err)}); nothing was written, try again`, 'git-unavailable');
    }
  }

  /** Missing legacy status is initialized here, including durable claims. Hand edits keep state and status
   * together: a changed state is a close/reopen event; otherwise the edited status determines the state. */
  #normalizeStatus(item: Item, previous: IndexedItem | null = this.#index.get(item.fm.id)): boolean {
    const fm = item.fm;
    if (fm.kind !== 'task') return false;
    const before = [fm.state, fm.status];
    if (fm.status === undefined) this.#setStatus(item, fm.state === 'closed' ? 'done' : this.#index.claimOf(fm.id) ? 'in progress' : 'backlog');
    else if ((fm.status === 'done') !== (fm.state === 'closed')) {
      this.#setStatus(item, previous && previous.state !== fm.state ? fm.state === 'closed' ? 'done' : 'backlog' : fm.status);
    }
    return before[0] !== fm.state || before[1] !== fm.status;
  }

  /** The hub owns workflow transitions. Keeping state with status prevents a done/open split. */
  #setStatus(item: Item, status: Status): void {
    if (item.fm.kind !== 'task') return;
    item.fm.status = status;
    item.fm.state = status === 'done' ? 'closed' : 'open';
  }

  /** One directory pass after the final write await: disk parents, not lagging index rows, own discovery. */
  async #scanChildren(id: string, resumed: Resumed): Promise<Child[]> {
    const names = await this.#files.readdir(this.#dir);
    const settled = await resumed(() => Promise.allSettled(names.filter(name => fileNumber(name) !== null).map(async file => {
      try {
        const text = await this.#files.readFile(join(this.#dir, file), 'utf8');
        return resumed(() => ({ ...parseItem(text, file, this.levels).fm, file }));
      } catch (err) {
        return resumed(() => { throw new TrackerError(`${join(TASKS_REL, file)} cannot be read (${err instanceof Error ? err.message : String(err)})`); });
      }
    })));
    return resumed(() => {
      const failures = settled.filter(result => result.status === 'rejected');
      if (failures.length) throw new TrackerError(`${id}: cannot validate children: ${failures.map(result => result.reason instanceof Error ? result.reason.message : String(result.reason)).join('; ')}; fix their files first`);
      return settled.flatMap(result => result.status === 'fulfilled' && result.value.parent === id ? [result.value] : []);
    });
  }

  /** Every hub kind change preserves the children's parenting rule, including closed children. */
  #checkKindChange(previous: Kind | undefined, next: Kind, children: readonly Child[]): void {
    if (previous === undefined || previous === next) return;
    for (const child of children) {
      const refusal = parentingRefusal(child.kind, next, this.levels);
      if (refusal) throw new TrackerError(`${refusal} (child ${child.id})`);
    }
  }

  #checkClose(id: string, kind: Kind, children: readonly Child[]): void {
    if (!this.levels.includes(kind)) return;
    const open = children.filter(child => child.state === 'open');
    if (open.length) throw new TrackerError(`${id}: cannot close ${kindWithArticle(kind)} with open children: ${open.map(child => `${child.id} ${child.title} (${join(TASKS_REL, child.file)})`).join(', ')}; close or move them first`);
  }

  edit(actor: Actor, rawId: string, input: EditInput, resumed: Resumed = untimed, authorize: () => void = () => {}): Promise<ItemView> {
    return this.#serial(async () => {
      if (input.kind !== undefined && !this.kinds.includes(input.kind)) throw new TrackerError(`unknown kind "${input.kind}" (one of ${this.kinds.join(', ')})`);
      if (input.state !== undefined && !STATES.includes(input.state)) throw new TrackerError(`unknown state "${input.state}" (open or closed)`);
      if (input.title !== undefined && !input.title.trim()) throw new TrackerError('the title cannot be empty');
      if (input.body !== undefined) checkText(input.body, 'body');
      let closing: { id: string; kinds: Kind[] } | undefined;
      let changingKind: { id: string; previous: Kind; next: Kind } | undefined;
      let epicEvidence: ItemView | undefined;
      let epicSource: string | undefined;
      let epicTip: string | null = null;
      let children: Child[] = [];
      const view = await this.#mutate(rawId, actor, 'edit', (item) => {
        const fm = item.fm;
        const previousKind = fm.kind;
        const previousState = fm.state;
        if (isPlanningContainer(previousKind, this.levels) || isPlanningContainer(input.kind, this.levels)) epicSource = serializeItem(item);
        if (input.title !== undefined) fm.title = input.title.trim();
        if (input.body !== undefined) item.body = input.body.trim();
        if (input.kind !== undefined && input.kind !== fm.kind) {
          this.#checkParent(input.kind, fm.parent);
          changingKind = { id: fm.id, previous: fm.kind, next: input.kind };
          if (fm.version !== undefined && input.version !== null) {
            const refusal = versionRefusal(input.kind, fm.version, this.levels);
            if (refusal) throw new TrackerError(refusal);
          }
          fm.kind = input.kind;
          if (fm.kind === this.levels[0]) item.body = withReleaseNotes(item.body);
        }
        if (input.version !== undefined) {
          if (input.version === null) delete fm.version;
          else {
            const refusal = versionRefusal(fm.kind, input.version, this.levels);
            if (refusal) throw new TrackerError(refusal);
            fm.version = input.version;
          }
        }
        if (!rankable(fm.kind, this.levels)) delete fm.rank;
        if (fm.kind !== 'task') delete fm.status;
        else this.#normalizeStatus(item);
        if (input.state !== undefined) {
          const changed = fm.state !== input.state;
          fm.state = input.state;
          if (input.state === 'closed') this.#setStatus(item, 'done');
          else if (changed) this.#setStatus(item, 'backlog');
        }
        if (input.status !== undefined) {
          const refusal = statusRefusal(fm.kind, input.status);
          if (refusal) throw new TrackerError(refusal);
          if (input.state !== undefined && (input.status === 'done') !== (input.state === 'closed')) throw new TrackerError('state and status disagree');
          this.#setStatus(item, input.status);
        }
        if (input.labels !== undefined) fm.labels = uniq(input.labels);
        if (input.add_labels) fm.labels = uniq([...fm.labels, ...input.add_labels]);
        if (input.remove_labels) fm.labels = fm.labels.filter((l) => !input.remove_labels?.includes(l));
        if (input.assignee !== undefined) fm.assignee = input.assignee || null;
        if (fm.state === 'closed' && (previousState === 'open' || input.state === 'closed' || input.status === 'done')) {
          closing = { id: fm.id, kinds: [previousKind, fm.kind] };
          if (closing.kinds.some(kind => isPlanningContainer(kind, this.levels))) epicEvidence = this.#viewOf(fm.id, this.#require(fm.id).file, { ...item, fm: { ...fm, kind: this.levels[1]! } }, 'proposal');
        }
      }, resumed, undefined, () => {
        authorize();
        if (closing) for (const kind of closing.kinds) this.#checkClose(closing.id, kind, children);
        if (changingKind) this.#checkKindChange(changingKind.previous, changingKind.next, children);
        if (epicEvidence) this.#checkEpicClose(epicEvidence, epicTip);
      }, undefined, async () => {
        const id = changingKind?.id ?? (closing?.kinds.some(kind => this.levels.includes(kind)) ? closing.id : undefined);
        if (epicEvidence) {
          const refreshed = await this.#epicCloseEvidence(epicEvidence.id, epicSource!, resumed);
          resumed(() => { epicTip = refreshed.tip; });
        }
        if (id) children = await this.#scanChildren(id, resumed);
      });
      return resumed(() => {
        if (view.state === 'closed') {
          this.#releaseOnClose(view.id);
          this.#closed(view.id);
        }
        return { ...view, claim: this.#index.claimOf(view.id) };
      });
    }, resumed);
  }

  #criterionEvent(id: string, criterion: string, mark: string): void {
    for (const listener of [...this.#changeListeners]) {
      try { listener({ id, item: this.list().find(i => i.id === id)!, events: [`criterion marked ${criterion} ${mark}`] }); }
      catch (err) { this.#log({ event: 'task-listener-error', id, error: String(err) }); }
    }
  }

  #prepareCriteria(item: Item) {
    if (item.fm.kind !== 'task' && !this.levels.includes(item.fm.kind)) throw new TrackerError('criteria operations require a task or container');
    const parsed = criteriaSource(item.body, this.levels.includes(item.fm.kind));
    if (parsed.criteriaWarnings.length) throw new TrackerError('fix malformed criterion sub-items before changing criteria');
    const ids = parsed.criteria.flatMap(c => c.id ? [c.id] : []);
    if (new Set(ids).size !== ids.length) throw new TrackerError('duplicate criterion ids; fix the section first');
    let sequence = Math.max(item.fm.criterion_seq ?? 0, ...ids.map(id => Number(id.slice(1))));
    const allocate = () => {
      sequence++;
      if (!Number.isSafeInteger(sequence)) throw new TrackerError('criterion ids exhausted');
      return `C${sequence}`;
    };
    const lines = item.body.split(/\r?\n/);
    for (const [index, c] of parsed.criteria.entries()) {
      if (c.id) continue;
      c.id = allocate();
      const source = parsed.sources[index]!;
      lines[source.start] = lines[source.start]!.replace(/^( *[-*+] \[[ xX]\])(?:[ \t]+)?/, `$1 ${c.id}. `);
    }
    item.fm.criterion_seq = sequence;
    item.body = lines.join('\n');
    return criteriaSource(item.body, this.levels.includes(item.fm.kind));
  }

  #changeCriterion(item: Item, actor: Actor, input: { op: string; criterion?: string; text?: string; note?: string; run?: string }): string {
    const parsed = this.#prepareCriteria(item);
    if (input.op === 'add' && parsed.insertionInFence) throw new TrackerError('cannot add a criterion inside an unclosed Markdown code fence; close the fence first');
    const lines = item.body.split(/\r?\n/);
    const id = item.fm.id;
    let criterion = input.criterion!;
    if (input.op === 'add') {
      criterion = `C${(item.fm.criterion_seq ?? 0) + 1}`;
      if (!Number.isSafeInteger(Number(criterion.slice(1)))) throw new TrackerError('criterion ids exhausted');
      item.fm.criterion_seq = Number(criterion.slice(1));
      const block = [`- [ ] ${criterion}. ${input.text!.trim().replace(/\r?\n/g, '\n  ')}`];
      if (parsed.hasSection) lines.splice(parsed.sectionEnd, 0, ...block);
      else lines.push('', '## Acceptance criteria', '', ...block);
    } else {
      const at = parsed.criteria.findIndex(c => c.id === criterion);
      if (at < 0) throw new TrackerError(`no criterion ${criterion} on ${id}`);
      const c = parsed.criteria[at]!, source = parsed.sources[at]!;
      let marks = c.marks;
      let text = c.text;
      let checked = c.marks.some(m => m.kind === 'done');
      const timestamp = this.#now().toISOString();
      if (input.op === 'done') {
        marks = [...marks.filter(m => m.kind !== 'done' && m.kind !== 'failed'), { kind: 'done', by: actor.name, at: timestamp }];
        checked = true;
      } else if (input.op === 'verify') {
        marks = [...marks.filter(m => m.kind !== 'failed'), { kind: 'verified', by: formatVerdictBy(actor.name, actor.role), at: timestamp, run: input.run! }];
      } else if (input.op === 'fail') {
        marks = [{ kind: 'failed', by: formatVerdictBy(actor.name, actor.role), at: timestamp, note: input.note!.trim() }];
        checked = false;
        this.#setStatus(item, 'in progress');
        if (this.levels.includes(item.fm.kind)) item.fm.state = 'open';
      } else if (input.op === 'edit') text = input.text!.trim();
      const indent = ' '.repeat(source.indent);
      const block = input.op === 'remove' ? [] : [
        `${indent}- [${checked ? 'x' : ' '}] ${criterion}. ${text.replace(/\r?\n/g, `\n${indent}  `)}`,
        ...marks.map(m => `${indent}  - ${m.kind}: ${m.by} · ${m.kind === 'verified' ? `run ${m.run} · ` : ''}${m.at}${m.kind === 'failed' ? ` · note ${m.note}` : ''}`),
      ];
      for (const line of [...source.lines].reverse()) lines.splice(line, 1);
      lines.splice(source.start, 0, ...block);
    }
    item.body = lines.join('\n');
    return criterion;
  }

  /** Criteria share the tracker queue and reauthorize after every file await. */
  criterion(actor: Actor, rawId: string, input: { op: string; criterion?: string; text?: string; note?: string; run?: string }, resumed: Resumed = untimed, authorize: () => void = () => {}): Promise<ItemView> {
    return this.#serial(async () => {
      const id = this.#require(rawId).id;
      const check = () => {
        authorize();
        const human = actor.human ?? (actor.role === null && (actor.id === 'human' || actor.id.startsWith('cli:')));
        const claimant = this.#index.claimOf(id);
        const reason = criterionRefusal(input.op, { role: actor.role, human, claimed: !!claimant && this.sameSession(claimant.sessionId, actor.id) });
        if (reason) throw new TrackerError(reason);
      };
      check();
      if (input.op !== 'add' && !/^C[1-9]\d*$/.test(input.criterion ?? '')) throw new TrackerError('criterion must be an id such as C1');
      if (input.op === 'verify' && !/^\S+$/.test(input.run ?? '')) throw new TrackerError('verify needs a run id (no whitespace)');
      if (input.op === 'fail' && (!input.note?.trim() || /[\r\n]/.test(input.note))) throw new TrackerError('fail needs a note (one line)');
      if (input.op === 'add' || input.op === 'edit') {
        if (!input.text?.trim()) throw new TrackerError(`${input.op} needs criterion text`);
        checkText(input.text, 'criterion text');
      }
      let criterion = input.criterion!;
      const view = await this.#mutate(id, actor, 'criterion', item => {
        criterion = this.#changeCriterion(item, actor, input);
      }, resumed, undefined, check);
      return resumed(() => {
        this.#criterionEvent(id, criterion, input.op === 'verify' ? 'verified' : input.op === 'fail' ? 'failed' : input.op);
        return view;
      });
    }, resumed);
  }

  close(actor: Actor, rawId: string, comment?: string, resumed: Resumed = untimed, authorize: () => void = () => {}, override?: string): Promise<ItemView> {
    return this.#serial(async () => {
      const checkOverride = () => {
        authorize();
        if (override !== undefined) {
          if (!actor.human || actor.role !== null) throw new TrackerError("only the human shell may override epic QA");
          if (!override.trim()) throw new TrackerError("an override needs a reason");
        }
      };
      checkOverride();
      const body = comment?.trim() ?? '';
      checkText(body, 'comment');
      let closing!: { id: string; kind: Kind };
      let children: Child[] = [];
      let evidence: ItemView | undefined;
      let source: string | undefined;
      let epicTip: string | null = null;
      const view = await this.#mutate(rawId, actor, 'close', (item) => {
        closing = { id: item.fm.id, kind: item.fm.kind };
        if (isPlanningContainer(closing.kind, this.levels)) source = serializeItem(item);
        item.fm.state = 'closed';
        this.#setStatus(item, 'done');
        if (body) item.comments.push({ author: actor.name, at: this.#now().toISOString(), text: body });
      }, resumed, undefined, () => {
        checkOverride();
        this.#checkClose(closing.id, closing.kind, children);
        if (evidence) {
          if (override === undefined) this.#checkEpicClose(evidence, epicTip);
          else this.#log({ event: 'epic-close-overridden', id: closing.id, by: actor.name, override: override.trim(), criteria: incompleteEpicCriteria(evidence, evidence.verdicts.filter(v => v.source === 'hub' && v.verdict === 'qa').at(-1)) });
        }
      }, undefined, async () => {
        if (isPlanningContainer(closing.kind, this.levels)) {
          const refreshed = await this.#epicCloseEvidence(closing.id, source!, resumed, override === undefined);
          resumed(() => { epicTip = refreshed.tip; evidence = refreshed.view; });
        }
        if (this.levels.includes(closing.kind)) children = await this.#scanChildren(closing.id, resumed);
      });
      return resumed(() => {
        this.#releaseOnClose(view.id);
        this.#closed(view.id);
        return { ...view, claim: this.#index.claimOf(view.id) };
      });
    }, resumed);
  }

  #releaseOnClose(id: string): void {
    for (const hold of this.#index.holdsOf(id)) this.#index.setHold(id, hold.sessionId, null);
    const claim = this.#index.claimOf(id);
    if (!claim) { this.#changed(id); return; }
    this.#index.setClaim(id, null);
    this.#log({ event: 'task-released', id, session: claim.session, reason: 'closed' });
    this.#changed(id);
  }

  link(actor: Actor, rawId: string, input: LinkInput, resumed: Resumed = untimed, authorize: () => void = () => {}): Promise<ItemView> {
    return this.#serial(async () => {
      const { id } = this.#require(rawId);
      const parent = input.parent === undefined ? undefined : input.parent === null ? null : this.#ref(input.parent, id, 'parent');
      const add = (input.blocked_by ?? []).map((b) => this.#ref(b, id, 'blocked_by'));
      const remove = (input.unblock ?? []).map((b) => normalizeId(b) ?? b);
      const topic = input.topic === undefined ? undefined : input.topic?.trim() || null;
      if (topic !== undefined) this.#checkTopic(id, topic);
      const view = await this.#mutate(id, actor, 'link', (item) => {
        const fm = item.fm;
        if (parent !== undefined) { this.#checkParent(fm.kind, parent); fm.parent = parent; }
        fm.blocked_by = uniq([...fm.blocked_by, ...add]).filter((b) => !remove.includes(b));
        if (topic !== undefined) fm.topic = topic;
        if (input.branch !== undefined) fm.branch = input.branch || null;
      }, resumed, undefined, () => { authorize(); this.#checkTopic(id, topic ?? null); });
      return resumed(() => {
        if (topic !== undefined) this.#topicBinding?.bound(id, topic);
        return view;
      });
    }, resumed);
  }

  /** Ranking holds the same queue as all other tracker writes. Disk ranks are checked again after
   * every temporary-write await; an external move refuses rather than committing a stale plan. */
  rank(actor: Actor, rawId: string, input: { top?: boolean; before?: string; after?: string }, resumed: Resumed = untimed, authorize: () => void = () => {}): Promise<{ item: ItemView; changed: string[]; siblings: string[] }> {
    return this.#serial(async () => {
      if (input.top !== undefined && typeof input.top !== 'boolean') throw new TrackerError('top must be a boolean');
      for (const key of ['before', 'after'] as const) if (input[key] !== undefined && typeof input[key] !== 'string') throw new TrackerError(`${key} must be an item id`);
      if (Number(input.top === true) + Number(input.before !== undefined) + Number(input.after !== undefined) !== 1) throw new TrackerError('rank needs exactly one of top, before or after');
      const id = this.#require(rawId).id;
      // Drain all reads, index external edits and only then capture a plan.
      await this.#rescanAsync(resumed);
      let records = await resumed(() => this.#rankRecords(resumed));
      const changed: string[] = [];
      // Planning, fingerprinting and the first dispatch have no await between them.
      const prepared = resumed(() => {
        const plan = (() => {
          authorize();
          const item = records.find(row => row.id === id);
          if (!item) throw new TrackerError(`no item ${id}`);
          if (!rankable(item.kind, this.levels)) throw new TrackerError('rank belongs only to tasks and containers below the top level');
          const siblings = records.filter(row => row.parent === item.parent).sort(compareRank);
          const rest = siblings.filter(row => row.id !== id);
          let slot = 0;
          const reference = input.before ?? input.after;
          if (reference !== undefined) {
            const target = records.find(row => row.id === normalizeId(reference));
            if (!target) throw new TrackerError(`no item ${reference}`);
            if (target.id === id) throw new TrackerError('an item cannot be ranked relative to itself');
            if (target.parent !== item.parent) throw new TrackerError('rank target must have the same parent');
            slot = rest.findIndex(row => row.id === target.id) + (input.after !== undefined ? 1 : 0);
          }
          const order = rest.map(row => row.id);
          order.splice(slot, 0, id);
          if (order.every((value, index) => value === siblings[index]?.id)) return { changes: new Map<string, number>(), order, parent: item.parent };
          const changes = rankChanges(rest, item, slot, new Set(siblings.filter(row => rankable(row.kind, this.levels)).map(row => row.id)));
          return { changes, order, parent: item.parent };
        })();
        const fingerprint = (rows: typeof records): string => JSON.stringify(rows.filter(row => row.parent === plan.parent || row.id === id).sort(compareRank));
        const state = { expected: fingerprint(records) };
        // Neighbors first, moved item last; a failed batch reports its committed prefix.
        const writes = [...plan.changes].sort(([a], [b]) => Number(a === id) - Number(b === id));
        const dispatch = (index: number): Promise<ItemView> => {
          const write = writes[index];
          if (!write) return this.#readRankView(id, resumed);
          const [writingId, rank] = write;
          return this.#mutate(writingId, actor, 'rank', item => { item.fm.rank = rank; }, resumed, undefined,
            () => {
              authorize();
              if (fingerprint(records) !== state.expected) throw new TrackerError('siblings changed while ranking; retry with their current order');
            }, () => { changed.push(writingId); }, async () => { records = await this.#rankRecords(resumed); }).then(() => resumed(() => {
              // The update and the next native dispatch are one continuous stretch too.
              records.find(row => row.id === writingId)!.rank = rank;
              state.expected = fingerprint(records);
              return dispatch(index + 1);
            }));
        };
        return { plan, state, fingerprint, pending: dispatch(0) };
      });
      try {
        const item = await prepared.pending;
        records = await resumed(() => this.#rankRecords(resumed));
        return resumed(() => {
          authorize();
          if (prepared.fingerprint(records) !== prepared.state.expected) throw new TrackerError('siblings changed while ranking; retry with their current order');
          if (changed.length) this.#announce(id, false, prepared.plan.order);
          return { item, changed, siblings: prepared.plan.order };
        });
      } catch (err) {
        return resumed(() => {
          const error = err instanceof Error ? err : new TrackerError(String(err));
          error.message += `; rank writes committed: ${changed.join(', ') || 'none'}`;
          throw error;
        });
      }
    }, resumed);
  }

  /** Reads remain inside rank's admission (calling viewAsync here would queue behind ourselves). */
  async #readRankView(id: string, resumed: Resumed): Promise<ItemView> {
    const { file } = this.#require(id);
    const text = await this.#files.readFile(join(this.#dir, file), 'utf8');
    return resumed(() => this.#viewOf(id, file, parseItem(text, file, this.levels)));
  }

  async #rankRecords(resumed: Resumed): Promise<Array<{ id: string; kind: Kind; parent: string | null; rank: number; file: string }>> {
    const names = await this.#files.readdir(this.#dir);
    const settled = await resumed(() => Promise.allSettled(names.filter(name => fileNumber(name) !== null).map(async file => {
      const text = await this.#files.readFile(join(this.#dir, file), 'utf8');
      return resumed(() => {
        const fm = parseItem(text, file, this.levels).fm;
        return { id: fm.id, kind: fm.kind, parent: fm.parent, rank: effectiveRank(fm), file };
      });
    })));
    return resumed(() => {
      const failed = settled.find(result => result.status === 'rejected');
      if (failed?.status === 'rejected') throw new TrackerError(`cannot read sibling ranks: ${String(failed.reason)}`);
      return settled.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
    });
  }

  /** The hub's own write of an item's `topic` field (a binding it already made: `topic.create` with an item). */
  writeTopic(actor: Actor, rawId: string, topic: string | null, resumed: Resumed = untimed, authorize: () => void = () => {}): Promise<ItemView> {
    return this.#serial(async () => {
      return this.#mutate(rawId, actor, 'link', (item) => {
        if (item.fm.state === 'closed') throw new TrackerError(`${item.fm.id} is closed: a closed unit of work gets no new topic`);
        if (item.fm.topic !== null && item.fm.topic !== topic) throw new TrackerError(`${item.fm.id} already has a topic`);
        item.fm.topic = topic;
      }, resumed, undefined, authorize);
    }, resumed);
  }

  // ---------------------------------------------------------------- imports

  /** Every readable item file with its text, parsed (the GitHub import finds its items by their `github` reference). */
  files(): Array<{ file: string; text: string; item: Item }> {
    const out: Array<{ file: string; text: string; item: Item }> = [];
    for (const file of this.#itemFiles()) {
      try {
        const text = readFileSync(join(this.#dir, file), 'utf8');
        out.push({ file, text, item: parseItem(text, file, this.levels) });
      } catch {
        /* gone or unreadable: the watcher reports it */
      }
    }
    return out;
  }

  filesAsync(resumed: Resumed = untimed): Promise<Array<{ file: string; text: string; item: Item }>> {
    return this.#serial(() => this.#filesAsync(resumed), resumed);
  }

  async #filesAsync(resumed: Resumed): Promise<Array<{ file: string; text: string; item: Item }>> {
    const names = await this.#files.readdir(this.#dir);
    const found = await resumed(() => Promise.all(names.filter(n => fileNumber(n) !== null).map(async file => {
      try {
        const text = await this.#files.readFile(join(this.#dir, file), 'utf8');
        return resumed(() => ({ file, text, item: parseItem(text, file, this.levels) }));
      } catch { return null; } // unreadable files are reported by the watcher
    })));
    return resumed(() => found.filter(item => item !== null));
  }

  /** Synchronous batch admission reserves the import lookup/ID space before its first await. */
  serializeImports<T>(work: (batch: TrackerImportBatch) => Promise<T>, resumed: Resumed): Promise<T> {
    return this.#serial(() => work({
      filesAsync: (timing = resumed) => this.#filesAsync(timing),
      reserveIdAsync: (timing = resumed) => this.#reserveIdAsync(timing),
      writeItem: (actor, op, item, existing, timing = resumed, authorize = () => {}) => this.#writeItem(actor, op, item, existing, timing, authorize),
    }), resumed);
  }

  reserveIdAsync(resumed: Resumed = untimed): Promise<string> {
    return this.#serial(() => this.#reserveIdAsync(resumed), resumed);
  }

  async #reserveIdAsync(resumed: Resumed): Promise<string> {
    const names = await this.#files.readdir(this.#dir);
    return resumed(() => this.#index.allocate(Math.max(0, ...names.map(n => fileNumber(n) ?? 0))));
  }

  /** Reserve the next item id before its file exists (an import numbers a whole batch before it links it). */
  reserveId(): string {
    const maxFile = Math.max(0, ...readdirSync(this.#dir).map((n) => fileNumber(n) ?? 0));
    return this.#index.allocate(maxFile);
  }

  /**
   * Write an item built outside the tracker's own operations (`cland task import-github`). `existing` is the
   * file it replaces, with that file's text, or null for a new item. Nothing is written when the text would
   * not change, so `updated` moves only with a real change.
   */
  writeItem(actor: Actor, op: string, item: Item, existing: { file: string; text: string } | null, resumed: Resumed = untimed, authorize: () => void = () => {}): Promise<'created' | 'updated' | 'unchanged'> {
    return this.#serial(() => this.#writeItem(actor, op, item, existing, resumed, authorize), resumed);
  }

  async #writeItem(actor: Actor, op: string, item: Item, existing: { file: string; text: string } | null, resumed: Resumed, authorize: () => void): Promise<'created' | 'updated' | 'unchanged'> {
    const file = existing?.file ?? fileNameOf(item.fm.id, item.fm.title);
    const previousItem = existing ? parseItem(existing.text, file, this.levels) : null;
    const previous = previousItem?.fm ?? null;
    const closing = previous?.state === 'open' && item.fm.state === 'closed';
    const changingKind = previous !== null && previous.kind !== item.fm.kind;
    const closingEpic = closing && [previous?.kind, item.fm.kind].some(kind => isPlanningContainer(kind, this.levels));
    let epicEvidence: { tip: string | null; view: ItemView } | undefined;
    let children: Child[] = [];
    const refresh = async () => {
      if (closingEpic) {
        const refreshed = await this.#epicCloseEvidence(item.fm.id, serializeItem(previousItem!), resumed);
        resumed(() => { epicEvidence = refreshed; });
      }
      if (changingKind || closing && previous && [previous.kind, item.fm.kind].some(kind => this.levels.includes(kind))) children = await this.#scanChildren(item.fm.id, resumed);
    };
    const check = () => {
      authorize();
      if (closing && previous) {
        this.#checkClose(item.fm.id, previous.kind, children);
        this.#checkClose(item.fm.id, item.fm.kind, children);
      }
      this.#checkKindChange(previous?.kind, item.fm.kind, children);
      if (epicEvidence) {
        if (isPlanningContainer(previous?.kind, this.levels)) this.#checkEpicClose(epicEvidence.view, epicEvidence.tip);
        this.#checkEpicClose(this.#viewOf(item.fm.id, file, { ...item, fm: { ...item.fm, kind: this.levels[1]! } }, 'proposal'), epicEvidence.tip);
      }
    };
    const prepare = (): Promise<'created' | 'updated' | 'unchanged'> => {
      authorize();
      this.#normalizeStatus(item);
      if (existing && serializeItem(item) === existing.text) return Promise.resolve('unchanged');
      item.fm.updated = this.#now().toISOString();
      return this.#write(file, item, resumed, undefined, undefined, check, undefined, refresh, actor).then(() => resumed(() => {
        this.#log({ event: 'task-written', id: item.fm.id, file, op, by: actor.name });
        return existing ? 'updated' : 'created';
      }));
    };
    if (!existing) return prepare();
    const latest = await this.#files.readFile(join(this.#dir, existing.file), 'utf8');
    return resumed(() => {
      if (latest !== existing.text) throw new TrackerError(`${item.fm.id} changed while importing; retry the import`);
      return prepare();
    });
  }

  /**
   * A role moved (#31): the claims its previous holder held (by session id) are held by the new one, keeping their
   * time. Returns an undo that puts them back, for a move that did not complete.
   */
  moveClaims(fromSessionId: string, to: { name: string; id: string; role: string | null }): { items: string[]; undo: () => void } {
    const moved = this.#index.moveClaims(fromSessionId, { session: to.name, sessionId: to.id, role: to.role });
    if (moved.length) this.#log({ event: 'task-claims-moved', items: moved.map((m) => m.item), from: moved[0]?.was.session, to: to.name, sessionId: to.id });
    // the UI hears each moved claim as a `task` event (#36), and again if the move is undone
    for (const m of moved) this.#changed(m.item);
    return {
      items: moved.map((m) => m.item),
      undo: () =>
        moved.forEach((m) => {
          this.#index.setClaim(m.item, m.was);
          this.#changed(m.item);
        }),
    };
  }

  /** The hub's authoritative mapping also compares gate evidence before durable adoption succeeds. */
  useSessionIdentity(identityOf: (id: string) => string, adopted: (name: string, id: string) => void = () => {}): void {
    this.#identityOf = identityOf;
    this.#identityAdopted = adopted;
    this.reconcileSessionIdentities();
  }

  /** Indexed ownership checks use the same authoritative identity as the gate. */
  sameSession(left: string, right: string): boolean { return this.#identityOf(left) === this.#identityOf(right); }

  /** Rebuild fences from durable rows before work is admitted, even without a new spoke hello. */
  reconcileSessionIdentities(): void {
    for (const alias of this.#index.provisionalSessions()) {
      const actual = this.#identityOf(alias);
      if (actual !== alias) this.adoptSession(alias.slice(5), actual);
    }
  }

  /** Failed adoption fences work until the same queued transaction succeeds. */
  adoptSession(name: string, sessionId: string): void {
    if (sessionId === `name:${name}` || sessionId === 'unknown') return;
    const names = this.#adoptions.get(sessionId) ?? new Set<string>();
    names.add(name);
    this.#adoptions.set(sessionId, names);
    this.#runBackground(() => this.#serial(() => this.#adopt(sessionId), this.#watchResumed));
  }

  #adopt(sessionId: string): void {
    const names = this.#adoptions.get(sessionId);
    if (!names) return;
    for (const name of names) {
      let changed: string[];
      try { changed = this.#index.adoptSession(name, sessionId); }
      catch (err) { throw new TrackerError(`session identity adoption failed for ${name}: ${err instanceof Error ? err.message : String(err)}; retry`); }
      // Publication follows the SQLite commit: a partial failure never changes the working identity.
      this.#sessionIds.set(`name:${name}`, sessionId);
      for (const id of changed) this.#changed(id);
      this.#identityAdopted(name, sessionId);
      names.delete(name);
    }
    this.#adoptions.delete(sessionId);
  }

  #ensureSession(actor: Actor): void {
    const pending = this.#adoptions.has(actor.id) ? actor.id
      : [...this.#adoptions].find(([, names]) => actor.id.startsWith('name:') && names.has(actor.id.slice(5)))?.[0];
    if (pending) this.#adopt(pending);
  }

  #sessionId(id: string): string { return this.#identityOf(id); }

  /** Stop/death releases verification work; the Implementer's claim remains independent. */
  releaseHolds(sessionId: string, name?: string): void {
    this.#runBackground(() => this.#serial(() => {
      const released = new Set(this.#index.releaseHolds(this.#sessionId(sessionId)));
      // A role-known session before its first hello is identified by name, as claims are.
      if (name) for (const id of this.#index.releaseHolds(`name:${name}`)) released.add(id);
      for (const id of released) this.#changed(id);
    }, this.#watchResumed));
  }

  hold(actor: Actor, rawId: string, release = false, resumed: Resumed = untimed, authorize: () => void = () => {}): Promise<{ id: string; holds: VerifierHold[] }> {
    return this.#serial(async () => {
      const { id } = this.#require(rawId);
      const check = () => {
        this.#ensureSession(actor);
        authorize();
        if (actor.role !== 'reviewer' && actor.role !== 'qa') throw new TrackerError('only Reviewer and QA sessions take verifier holds');
        if (actor.id === 'human' || actor.id.startsWith('cli:')) throw new TrackerError('a verifier hold needs a hub session');
        if (!release && this.#index.get(id)?.state !== 'open') throw new TrackerError(`${id} is closed`);
      };
      check();
      if (release) {
        this.#index.setHold(id, this.#sessionId(actor.id), null);
        this.#changed(id);
      } else {
        const hold: VerifierHold = { session: actor.name, sessionId: this.#sessionId(actor.id), role: actor.role as VerifierHold['role'],
          heldAt: this.#index.holdsOf(id).find(h => h.sessionId === this.#sessionId(actor.id))?.heldAt ?? this.#now().toISOString() };
        await this.#mutate(id, actor, 'hold', item => this.#setStatus(item, hold.role === 'reviewer' ? 'review' : 'qa'), resumed, undefined, check,
          () => this.#index.setHold(id, this.#sessionId(actor.id), { ...hold, sessionId: this.#sessionId(actor.id) }));
      }
      return resumed(() => ({ id, holds: this.#index.holdsOf(id) }));
    }, resumed);
  }

  /** The live claim is an index fact, read without opening the item file. */
  claimOf(rawId: string): Claim | null { return this.#index.claimOf(this.#require(rawId).id); }

  /** Claims share the file queue: an Implementer's or Aide's new claim persists in progress before it is announced. */
  claim(actor: Actor, rawId: string, options: { release?: boolean; force?: boolean } = {}, resumed: Resumed = untimed, authorize: () => void = () => {}): Promise<{ id: string; claim: Claim | null }> {
    return this.#serial(async () => {
      authorize();
      const { id } = this.#require(rawId);
      const check = () => {
        this.#ensureSession(actor);
        authorize();
        const held = this.#index.claimOf(id);
        if (!options.release && actor.role === 'lead') {
          const item = this.#index.get(id);
          if (item?.state !== 'open' || !this.levels.includes(item.kind)) throw new TrackerError('a Lead needs an open configured container');
          const other = this.list().find(item => item.id !== id && item.claim && this.sameSession(item.claim.sessionId, actor.id));
          if (other) throw new TrackerError(`a Lead holds one node: ${actor.name} already claims ${other.id}`);
          if (held && !this.sameSession(held.sessionId, actor.id) && held.role === 'lead') throw new TrackerError(`${id} is claimed by ${held.session} (lead): release it first`);
        }
        if (held && held.sessionId !== this.#sessionId(actor.id) && !options.force) {
          throw new TrackerError(`${id} is claimed by ${held.session}${held.role ? ` (${held.role})` : ''} since ${held.claimedAt}; force takes it over`);
        }
        return held;
      };
      const held = check();
      if (options.release) {
        if (held) {
          this.#index.setClaim(id, null);
          this.#log({ event: 'task-released', id, session: held.session, sessionId: held.sessionId, by: actor.name });
          this.#changed(id);
        }
        return { id, claim: null };
      }
      if (held?.sessionId === this.#sessionId(actor.id) && held.session === actor.name && held.role === actor.role) return { id, claim: held };
      const claim: Claim = { session: actor.name, sessionId: this.#sessionId(actor.id), role: actor.role,
        claimedAt: held?.sessionId === this.#sessionId(actor.id) ? held.claimedAt : this.#now().toISOString() };
      const persist = (actor.role === 'implementer' || actor.role === 'aide') && this.#index.get(id)?.kind === 'task';
      if (persist) {
        await this.#mutate(id, actor, 'claim', item => this.#setStatus(item, 'in progress'), resumed, undefined, () => { check(); }, () => this.#index.setClaim(id, { ...claim, sessionId: this.#sessionId(actor.id) }));
      }
      return resumed(() => {
        if (!persist) { this.#index.setClaim(id, { ...claim, sessionId: this.#sessionId(actor.id) }); this.#changed(id); }
        this.#log({ event: 'task-claimed', id, session: actor.name, sessionId: this.#sessionId(actor.id), role: actor.role,
          ...(held && held.sessionId !== this.#sessionId(actor.id) ? { took: held.session } : {}) });
        return { id, claim: this.#index.claimOf(id) };
      });
    }, resumed);
  }
}

/** The whole file behind `fd`, from its start, as it is now. */
async function readWhole(fd: FileHandle, resumed: Resumed): Promise<string> {
  const info = await fd.stat();
  return resumed(() => {
    const buf = Buffer.alloc(info.size);
    let off = 0;
    const next = (): Promise<string> => {
      if (off >= info.size) return Promise.resolve(buf.subarray(0, off).toString('utf8'));
      return fd.read(buf, off, info.size - off, off).then(result => resumed(() => {
        const { bytesRead } = result;
        off += bytesRead;
        if (bytesRead === 0) return buf.subarray(0, off).toString('utf8');
        return next();
      }));
    };
    return next();
  });
}

class ReadyChanged extends Error {}

const uniq = (xs: string[]): string[] => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];

/** A text the file format could not hold back unchanged is refused rather than silently mangled. */
function checkText(text: string, what: string): void {
  for (const line of text.split('\n')) {
    if (line.trim() === COMMENTS_HEADING) throw new TrackerError(`the ${what} cannot contain a "${COMMENTS_HEADING}" line: it starts the comments section`);
    if (/^### .+ · \S+\s*$/.test(line)) throw new TrackerError(`the ${what} cannot contain a line shaped like a comment header ("### <author> · <time>")`);
  }
}

/** Only the import callback can use these unqueued operations while it owns the global tail. */
export type TrackerImportBatch = Pick<Tracker, 'filesAsync' | 'reserveIdAsync' | 'writeItem'>;
