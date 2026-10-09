// The tracker: item files in `.cland/tasks/` are the source of truth, the hub writes them and keeps the
// index (spec 4.6, ADR 0002).
//
// One queue owns every read/change/commit cycle and serving-time watcher read. The atomic
// rename completes before indexing, notification and the returned result. Hand edits are last-writer-wins.
// Verdict Git resolution belongs to its admitted operation; later tracker operations wait behind it.

import { taskBase, territoryPath } from '../territory.ts';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, type Stats } from 'node:fs';
import files, { type FileHandle } from 'node:fs/promises';
import type { Resumed } from '../hub/budget.ts';
const untimed: Resumed = work => work();
import { join } from 'node:path';
import { commentKey, TrackerIndex, type Claim, type IndexedItem, type IndexedVerdict, type ListFilter } from './index-db.ts';
import {
  COMMENTS_HEADING,
  fileNameOf,
  fileNumber,
  formatVerdictBy,
  ItemParseError,
  KINDS,
  normalizeId,
  parseItem,
  RESULTS,
  serializeItem,
  STATES,
  VERDICT_KINDS,
  versionRefusal,
  parentingRefusal,
  withReleaseNotes,
  type Comment,
  type GithubRef,
  type Item,
  type Kind,
  type State,
  type Verdict,
  type VerdictKind,
  type VerdictResult,
} from './item.ts';
import type { LogFn } from '../log.ts';
import { gitIn, resolveCommit, type Git } from './verdict-git.ts';
import { MergeError } from '../merge.ts';
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
 */
export type Actor = { id: string; name: string; role: string | null };

export type ItemView = IndexedItem & {
  /** The file, relative to the project root. */
  path: string;
  /** Root-to-item header path, including this item; distinct from the file path. */
  ancestry: Array<Pick<IndexedItem, 'id' | 'kind' | 'title'>>;
  /** The integration branch used for patch-id comparisons, or null when neither exists. */
  verdictBase: string | null;
  body: string;
  comments: Comment[];
  verdicts: IndexedVerdict[];
  claim: Claim | null;
  /** The GitHub issue the item was imported from, when it was. */
  github?: GithubRef;
};

/** A row of `task.list`: the indexed fields, the live claim, and the verdicts in file order (the latest last). */
export type ItemSummary = IndexedItem & { claim: Claim | null; verdicts: IndexedVerdict[]; verdictBase: string | null };

/** An index change, as a subscribed UI hears it (the `task` event): the item as `task.list` shows it, or null when its file is gone. */
export type ItemChange = { id: string; item: ItemSummary | null };

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

export type VerdictInput = { verdict: VerdictKind; result: VerdictResult; run: string; commit?: string };

export class TrackerError extends Error {
  /** `git-unavailable`: Git did not answer a question the write needs (a verdict's commit, a branch tip). */
  readonly code?: 'git-unavailable';
  constructor(message: string, code?: 'git-unavailable') {
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

/** Native file boundary: requests only read UTF-8 item text and ordinary stat results. */
export type TrackerFiles = Pick<typeof files, 'open' | 'rename' | 'unlink'> & {
  readFile: (path: string, encoding: 'utf8') => Promise<string>;
  writeFile: (path: string, text: string) => Promise<void>;
  readdir: (path: string) => Promise<string[]>;
  stat: (path: string) => Promise<Stats>;
};

export class Tracker {
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
  readonly #background = new Set<Promise<unknown>>();
  readonly #watchResumed: Resumed;
  /** The folder as the last poll saw it (only used when it cannot be watched). */
  #polled = '';
  readonly #pending = new Map<string, NodeJS.Timeout>();
  #rescanTimer: NodeJS.Timeout | null = null;

  /** Tests only: async pause between the temporary write and rename. */
  readonly #writePauseMs: number;
  /** Told when an item closes (the hub's close, an edit to `closed`, a hand edit): its topic closes too (spec 4.5). */
  readonly #closedListeners = new Set<(id: string) => void>();
  /** Told after every index change (a write, a hand edit, a removal, a claim): the `task` event. */
  readonly #changeListeners = new Set<(change: ItemChange) => void>();
  /** Told when a verdict comment is written through the hub: the inbox notes it (#33). */
  readonly #verdictListeners = new Set<(id: string, author: string, verdict: Verdict) => void>();
  /** The hub's topic binding; without one (a tracker on its own) the `topic` field is written as given. */
  #topicBinding: TopicBinding | null = null;
  readonly #git: Git;
  /** Verdict freshness, computed off the request path; the reads only look it up. */
  readonly #fresh: Freshness;
  /** Each item's freshness as last announced: an answer that arrives later is announced only when it differs. */
  readonly #shown = new Map<string, string>();

  constructor(options: { watchResumed?: Resumed; files?: TrackerFiles; root: string; db: string; log?: LogFn; now?: () => Date; writePauseMs?: number; git?: Git; tipCheckMs?: number; scheduleTips?: TipSchedule }) {
    this.#files = options.files ?? files;
    this.#watchResumed = options.watchResumed ?? untimed;
    this.#root = options.root;
    this.#writePauseMs = options.writePauseMs ?? 0;
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
      settled: (ids) => ids.forEach((id) => this.#announce(id, true)),
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
    this.#fresh.poke();
    this.#announce(id, false);
  }

  /** Every item's freshness may have moved with a branch tip: announce the ones whose known answers changed. */
  #tipsMoved(): void {
    for (const item of this.list()) if (item.verdicts.length) this.#announce(item.id, true);
  }

  /**
   * The `task` event for `id`. `ifMoved`: only when its freshness changed from what was last announced and none of
   * it is still being computed (that announces itself once known), so a tip read does not flood the UI.
   */
  #announce(id: string, ifMoved: boolean): void {
    const indexed = this.#index.get(id);
    const item: ItemSummary | null = indexed ? { ...indexed, claim: this.#index.claimOf(id), verdicts: this.#fresh.annotate(id, indexed.branch, this.#index.verdicts().get(id) ?? []), verdictBase: this.#fresh.base() } : null;
    const shown = item ? JSON.stringify([item.verdictBase, item.verdicts.map((v) => v.current ?? null)]) : '';
    if (ifMoved && (this.#shown.get(id) === shown || (item && pending(item.verdicts)))) return;
    if (item) this.#shown.set(id, shown);
    else this.#shown.delete(id);
    if (this.#changeListeners.size === 0) return;
    for (const listener of [...this.#changeListeners]) {
      try {
        listener({ id, item });
      } catch (err) {
        this.#log({ event: 'task-change-listener-failed', id, error: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  /** Listen to verdict comments written through the hub; returns the unsubscribe. */
  onVerdict(listener: (id: string, author: string, verdict: Verdict) => void): () => void {
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

  /** Bring the index level with the folder, then watch it. */
  start(): void {
    this.rescan();
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
    } catch {
      this.#dropFile(name);
      return;
    }
    const id = normalizeId(`T-${fileNumber(name)}`);
    const previous = id ? this.#index.metaOf(id) : null;
    this.#indexFile(name, text, !!(previous && previous.file !== name && existsSync(join(this.#dir, previous.file))));
  }

  #indexFile(name: string, text: string, duplicate: boolean): void {
    const hash = hashOf(text);
    const knownId = this.#index.idOfFile(name);
    const known = knownId ? this.#index.metaOf(knownId) : null;
    if (known && known.hash === hash) return;
    let item: Item;
    try {
      item = parseItem(text, name);
    } catch (err) {
      this.#log({ event: 'task-unreadable', file: name, error: err instanceof Error ? err.message : String(err) });
      return;
    }
    const id = item.fm.id;
    // the id moved out of this file (someone rewrote it by hand): the old row goes
    if (knownId && knownId !== id) {
      this.#index.remove(knownId);
      this.#changed(knownId);
    }
    const previous = this.#index.metaOf(id);
    if (previous && duplicate) {
      this.#log({ event: 'task-duplicate-id', id, files: [previous.file, name], indexed: name });
    }
    const now = this.#now().getTime();
    if (previous?.source === 'hub' && now - previous.indexedAt < CONCURRENT_MS) {
      this.#log({ event: 'task-conflict', id, file: name, winner: 'hand', note: `a hand edit replaced the hub's write of ${new Date(previous.indexedAt).toISOString()}; last writer wins` });
    }
    const wasOpen = this.#index.get(id)?.state === 'open';
    this.#index.put(item, { file: name, hash, source: 'hand', indexedAt: now });
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
        else this.#log({ event: 'task-unreadable', file: name, error: String(err) });
      });
    }
    return resumed(() => {
      let id: string;
      try { id = parseItem(text, name).fm.id; }
      catch (err) { this.#log({ event: 'task-unreadable', file: name, error: String(err) }); return; }
      const previous = this.#index.metaOf(id);
      if (!previous || previous.file === name) { this.#indexFile(name, text, false); return; }
      return this.#files.stat(join(this.#dir, previous.file)).then(() => true, () => false)
        .then(duplicate => resumed(() => this.#indexFile(name, text, duplicate)));
    });
  }

  #dropFile(name: string): void {
    const id = this.#index.idOfFile(name);
    if (!id) return;
    this.#index.remove(id);
    this.#log({ event: 'task-removed', id, file: name });
    this.#changed(id);
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
      item = parseItem(readFileSync(join(this.#dir, file), 'utf8'), file);
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
      return resumed(() => {
        let view: ItemView;
        try { view = this.#viewOf(id, file, parseItem(text, file)); }
        catch (err) { throw new TrackerError(`${id}: ${join(TASKS_REL, file)} cannot be read: ${err instanceof Error ? err.message : String(err)}`); }
        // Evidence and claims are read after the file await, within the same tracker admission.
        return evidence ? this.#mergeViewOf(view) : view;
      });
    }, resumed);
  }

  #viewOf(id: string, file: string, item: Item): ItemView {
    const indexed = this.#index.get(id);
    if (!indexed) throw new TrackerError(`no item ${id}`);
    return {
      ...indexed,
      verdictBase: this.#fresh.base(),
      ...item.fm,
      file,
      path: join(TASKS_REL, file),
      ancestry: this.#ancestry(item),
      body: item.body,
      comments: item.comments,
      verdicts: this.#fresh.annotate(id, item.fm.branch, this.#index.markVerdicts(id, item.comments.flatMap((c) => (c.verdict ? [{ verdict: { ...c.verdict, author: c.author, at: c.at }, key: commentKey(c) }] : [])))),
      claim: this.#index.claimOf(id),
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
    const hub = evidence.verdicts.map(({ current: _current, ...v }) => v);
    const annotated = this.#fresh.annotate(view.id, view.branch, hub);
    return { ...view, verdicts: [...view.verdicts.filter(v => v.source === 'file'), ...annotated] };
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
        await this.#mutate(id, actor, 'close', item => {
          item.fm.state = 'closed';
          if (!item.comments.some(c => c.text === comment)) item.comments.push({ author: actor.name, at: this.#now().toISOString(), text: comment });
        }, resumed);
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
    return this.#index.list(filter).map((i) => ({ ...i, claim: claims.get(i.id) ?? null, verdictBase: base, verdicts: this.#fresh.annotate(i.id, i.branch, verdicts.get(i.id) ?? []) }));
  }

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
  async #write(name: string, item: Item, resumed: Resumed, read?: { id: string; op: string; hash: string; fd: FileHandle }, verdictWriter?: Actor, beforeCommit?: () => void): Promise<Item> {
    const text = serializeItem(item);
    const written = parseItem(text, name);
    const path = join(this.#dir, name);
    const tmp = join(this.#dir, `.${name}.${process.pid}.tmp`);
    try {
      await this.#files.writeFile(tmp, text);
      // No fsync was used by the synchronous implementation: completion promises atomic replacement,
      // not survival of power loss. A process crash before rename leaves the previous item intact.
      if (this.#writePauseMs > 0) await new Promise<void>(done => setTimeout(done, this.#writePauseMs));
      const before = read ? await this.#files.readFile(path, 'utf8').then(text => resumed(() => hashOf(text)), () => null) : null;
      await resumed(() => { beforeCommit?.(); return this.#files.rename(tmp, path); });
      const replaced = read ? await readWhole(read.fd, resumed).then(text => resumed(() => hashOf(text)), () => null) : null;
      return resumed(() => {
        this.#index.put(written, { file: name, hash: hashOf(text), source: 'hub', indexedAt: this.#now().getTime() }, verdictWriter);
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

  /** Called only with the tracker queue held: always read the latest committed file. */
  async #mutate(rawId: string, actor: Actor, op: string, change: (item: Item) => void, resumed: Resumed, verdictWriter?: Actor, beforeCommit?: () => void): Promise<ItemView> {
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
        try { item = parseItem(text, file); }
        catch (err) { throw new TrackerError(`${id}: ${join(TASKS_REL, file)} cannot be read (${err instanceof ItemParseError ? err.message : String(err)}); fix the file by hand first`); }
        if (meta && meta.hash !== hashOf(text)) this.#log({ event: 'task-conflict', id, file, winner: 'hub', op, note: 'a hand edit not yet indexed was read and the hub write applied on top of it; last writer wins' });
        change(item);
        item.fm.updated = this.#now().toISOString();
        return this.#write(file, item, resumed, { id, op, hash: hashOf(text), fd }, verdictWriter, beforeCommit);
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
    const refusal = parentingRefusal(kind, indexed.kind);
    if (refusal) throw new TrackerError(`${refusal} (parent ${parent})`);
  }

  create(actor: Actor, input: CreateInput, resumed: Resumed = untimed, authorize: () => void = () => {}): Promise<ItemView> {
    return this.#serial(() => this.#create(actor, input, resumed, authorize), resumed);
  }

  async #create(actor: Actor, input: CreateInput, resumed: Resumed, authorize: () => void): Promise<ItemView> {
    const title = input.title?.trim();
    if (!title) throw new TrackerError('an item needs a title');
    const kind = input.kind ?? 'task';
    if (!KINDS.includes(kind)) throw new TrackerError(`unknown kind "${kind}" (one of ${KINDS.join(', ')})`);
    if (input.version !== undefined) {
      const refusal = versionRefusal(kind, input.version);
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
        body: kind === 'release' ? withReleaseNotes(input.body ?? '') : input.body?.trim() ?? '',
        comments: [],
      };
      const written = await this.#write(name, item, resumed, undefined, undefined, () => { authorize(); this.#checkTopic(id, topic); });
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
    let tip: { branch: string; sha: string | null } | null = null;
    // Git resolution belongs to this admitted operation; later writes and views wait behind it.
    const write = () => {
      const writer = currentActor ? currentActor() : actor;
      if (v) v.by = formatVerdictBy(writer.name, writer.role);
      if (tip?.sha) this.#fresh.noteTip(tip.branch, tip.sha);
      return this.#writeComment(writer, rawId, body, v, tip, resumed, currentActor ? () => {
        const now = currentActor();
        if (now.id !== writer.id || now.name !== writer.name || now.role !== writer.role) throw new TrackerError('comment writer changed while the item was being written; nothing was written, retry');
      } : undefined);
    };
    if (v && verdict?.commit !== undefined) {
      return this.#resolve(verdict.commit, `the verdict's commit ${verdict.commit}`).then(commit => resumed(() => {
        if (!commit) throw new TrackerError('commit does not resolve to a Git commit');
        v!.commit = commit;
        return write();
      }));
    }
    if (v) {
      const branch = this.#index.get(this.#require(rawId).id)?.branch ?? null;
      if (branch) return this.#resolve(`refs/heads/${branch}`, `the tip of branch ${branch}`).then(sha => resumed(() => {
        tip = { branch, sha };
        return write();
      }));
    }
    return write();
  }

  async #writeComment(actor: Actor, rawId: string, body: string, v: Verdict | undefined, tip: { branch: string; sha: string | null } | null, resumed: Resumed, beforeCommit?: () => void): Promise<ItemView> {
    const view = await this.#mutate(rawId, actor, v ? 'verdict' : 'comment', (item) => {
      if (v && !v.commit) {
        // a hand edit moved the branch meanwhile: the tip the cache last read for it
        const sha = item.fm.branch === tip?.branch ? tip.sha : this.#fresh.tip(item.fm.branch);
        if (sha) v.commit = sha;
      }
      item.comments.push({ author: actor.name, at: this.#now().toISOString(), text: body, ...(v ? { verdict: v } : {}) });
    }, resumed, actor, beforeCommit);
    return resumed(() => {
      // what is announced is what the file records, however it came: a structured verdict, or a text that reads back
      // as one (its header lines), so every verdict on record is a notification
      const recorded = view.comments.at(-1)?.verdict;
      if (recorded) {
        for (const listener of [...this.#verdictListeners]) {
          try {
            listener(view.id, actor.name, recorded);
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

  edit(actor: Actor, rawId: string, input: EditInput, resumed: Resumed = untimed, authorize: () => void = () => {}): Promise<ItemView> {
    return this.#serial(async () => {
      if (input.kind !== undefined && !KINDS.includes(input.kind)) throw new TrackerError(`unknown kind "${input.kind}" (one of ${KINDS.join(', ')})`);
      if (input.state !== undefined && !STATES.includes(input.state)) throw new TrackerError(`unknown state "${input.state}" (open or closed)`);
      if (input.title !== undefined && !input.title.trim()) throw new TrackerError('the title cannot be empty');
      if (input.body !== undefined) checkText(input.body, 'body');
      const view = await this.#mutate(rawId, actor, 'edit', (item) => {
        const fm = item.fm;
        if (input.title !== undefined) fm.title = input.title.trim();
        if (input.body !== undefined) item.body = input.body.trim();
        if (input.kind !== undefined && input.kind !== fm.kind) {
          this.#checkParent(input.kind, fm.parent);
          for (const child of this.#index.list().filter(child => child.parent === fm.id)) {
            const refusal = parentingRefusal(child.kind, input.kind);
            if (refusal) throw new TrackerError(`${refusal} (child ${child.id})`);
          }
          if (fm.version !== undefined && input.version !== null) {
            const refusal = versionRefusal(input.kind, fm.version);
            if (refusal) throw new TrackerError(refusal);
          }
          fm.kind = input.kind;
          if (fm.kind === 'release') item.body = withReleaseNotes(item.body);
        }
        if (input.version !== undefined) {
          if (input.version === null) delete fm.version;
          else {
            const refusal = versionRefusal(fm.kind, input.version);
            if (refusal) throw new TrackerError(refusal);
            fm.version = input.version;
          }
        }
        if (input.state !== undefined) fm.state = input.state;
        if (input.labels !== undefined) fm.labels = uniq(input.labels);
        if (input.add_labels) fm.labels = uniq([...fm.labels, ...input.add_labels]);
        if (input.remove_labels) fm.labels = fm.labels.filter((l) => !input.remove_labels?.includes(l));
        if (input.assignee !== undefined) fm.assignee = input.assignee || null;
      }, resumed, undefined, authorize);
      return resumed(() => {
        if (input.state === 'closed') {
          this.#releaseOnClose(view.id);
          this.#closed(view.id);
        }
        return { ...view, claim: this.#index.claimOf(view.id) };
      });
    }, resumed);
  }

  close(actor: Actor, rawId: string, comment?: string, resumed: Resumed = untimed, authorize: () => void = () => {}): Promise<ItemView> {
    return this.#serial(async () => {
      const body = comment?.trim() ?? '';
      checkText(body, 'comment');
      const view = await this.#mutate(rawId, actor, 'close', (item) => {
        item.fm.state = 'closed';
        if (body) item.comments.push({ author: actor.name, at: this.#now().toISOString(), text: body });
      }, resumed, undefined, authorize);
      return resumed(() => {
        this.#releaseOnClose(view.id);
        this.#closed(view.id);
        return { ...view, claim: this.#index.claimOf(view.id) };
      });
    }, resumed);
  }

  #releaseOnClose(id: string): void {
    const claim = this.#index.claimOf(id);
    if (!claim) return;
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
        out.push({ file, text, item: parseItem(text, file) });
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
        return resumed(() => ({ file, text, item: parseItem(text, file) }));
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
    const prepare = (): Promise<'created' | 'updated' | 'unchanged'> => {
      authorize();
      if (existing && serializeItem(item) === existing.text) return Promise.resolve('unchanged');
      item.fm.updated = this.#now().toISOString();
      return this.#write(file, item, resumed, undefined, undefined, authorize).then(() => resumed(() => {
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

  /** The live claim is an index fact, read without opening the item file. */
  claimOf(rawId: string): Claim | null { return this.#index.claimOf(this.#require(rawId).id); }

  /** Take (or with `release`, let go of) the live hold on an item. Only the hub knows of it; the file is untouched. */
  claim(actor: Actor, rawId: string, options: { release?: boolean; force?: boolean } = {}): { id: string; claim: Claim | null } {
    const { id } = this.#require(rawId);
    const held = this.#index.claimOf(id);
    // held by identity, never by name: a name moves with a rename and can be taken by another session
    const other = held && held.sessionId !== actor.id;
    if (other && !options.force) {
      throw new TrackerError(`${id} is claimed by ${held.session}${held.role ? ` (${held.role})` : ''} since ${held.claimedAt}; force takes it over`);
    }
    if (options.release) {
      if (held) {
        this.#index.setClaim(id, null);
        this.#log({ event: 'task-released', id, session: held.session, sessionId: held.sessionId, by: actor.name });
        this.#changed(id);
      }
      return { id, claim: null };
    }
    if (held && !other) {
      // the holder again, perhaps renamed since: the claim keeps its time and shows the name it has now
      if (held.session === actor.name && held.role === actor.role) return { id, claim: held };
      const renamed: Claim = { ...held, session: actor.name, role: actor.role };
      this.#index.setClaim(id, renamed);
      this.#changed(id);
      return { id, claim: renamed };
    }
    const claim: Claim = { session: actor.name, sessionId: actor.id, role: actor.role, claimedAt: this.#now().toISOString() };
    this.#index.setClaim(id, claim);
    this.#changed(id);
    this.#log({ event: 'task-claimed', id, session: actor.name, sessionId: actor.id, role: actor.role, ...(other ? { took: held.session } : {}) });
    return { id, claim };
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
