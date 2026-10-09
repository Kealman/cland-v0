// The tracker: item files in `.cland/tasks/` are the source of truth, the hub writes them and keeps the
// index (spec 4.6, ADR 0002).
//
// Writes are serialized by construction: every operation reads, changes, writes and indexes with
// synchronous calls, so one runs to completion on the hub's single thread before the next starts.
// Hand edits are picked up by a watcher on the folder (debounced) and re-indexed; last writer wins.
// Nothing is ever committed. No git runs inside an operation either (T-67): verdict freshness comes from the
// freshness cache, and the one fact a verdict write needs from Git (its commit) is resolved before the write. So a
// verdict is written when Git has answered: a request that arrived after it (a plain comment, a close) may be
// written first. The write itself is still one synchronous step.

import { taskBase, territoryPath } from '../territory.ts';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fstatSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, renameSync, statSync, writeFileSync } from 'node:fs';
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
  body?: string;
  labels?: string[];
  assignee?: string | null;
  parent?: string | null;
  blocked_by?: string[];
  topic?: string | null;
  branch?: string | null;
};

export type EditInput = {
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

export class Tracker {
  readonly #root: string;
  readonly #dir: string;
  readonly #index: TrackerIndex;
  readonly #log: LogFn;
  readonly #now: () => Date;
  #watcher: FolderWatch | null = null;
  /** The folder as the last poll saw it (only used when it cannot be watched). */
  #polled = '';
  readonly #pending = new Map<string, NodeJS.Timeout>();
  #rescanTimer: NodeJS.Timeout | null = null;

  /** Tests only: how long a write holds still between its temporary file and the rename (0: not at all). */
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

  constructor(options: { root: string; db: string; log?: LogFn; now?: () => Date; writePauseMs?: number; git?: Git; tipCheckMs?: number; scheduleTips?: TipSchedule }) {
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
      readBase: async (tips) => existsSync(territoryPath(this.#root)) ? await taskBase(this.#root) : tips.has('dev') ? 'dev' : tips.has('main') ? 'main' : null,
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
          const stamp = this.#folderStamp();
          if (stamp === this.#polled) return;
          this.#polled = stamp;
          this.rescan();
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

  stop(): void {
    this.#fresh.stop();
    this.#watcher?.close();
    this.#watcher = null;
    for (const t of this.#pending.values()) clearTimeout(t);
    this.#pending.clear();
    if (this.#rescanTimer) clearTimeout(this.#rescanTimer);
    this.#index.close();
  }

  // ---------------------------------------------------------------- watching

  #schedule(name: string): void {
    const prev = this.#pending.get(name);
    if (prev) clearTimeout(prev);
    this.#pending.set(
      name,
      setTimeout(() => {
        this.#pending.delete(name);
        this.#syncFile(name);
      }, DEBOUNCE_MS),
    );
  }

  #scheduleRescan(): void {
    if (this.#rescanTimer) clearTimeout(this.#rescanTimer);
    this.#rescanTimer = setTimeout(() => {
      this.#rescanTimer = null;
      this.rescan();
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
    if (previous && previous.file !== name && existsSync(join(this.#dir, previous.file))) {
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
    return {
      ...indexed,
      verdictBase: this.#fresh.base(),
      ...item.fm,
      file,
      path: join(TASKS_REL, file),
      body: item.body,
      comments: item.comments,
      verdicts: this.#fresh.annotate(id, item.fm.branch, this.#index.markVerdicts(id, item.comments.flatMap((c) => (c.verdict ? [{ verdict: { ...c.verdict, author: c.author, at: c.at }, key: commentKey(c) }] : [])))),
      claim: this.#index.claimOf(id),
    };
  }

  /** The items, each latest verdict with `current` when the freshness cache knows it (absent: not known yet). */
  freshnessTip(branch: string | null): string | null { return this.#fresh.tip(branch); }

  refreshFreshness(resumed?: <T>(work: () => T) => T): Promise<void> {
    return this.#fresh.refresh(resumed);
  }

  /** The gate selects the latest hub-written verdict per kind; file-only headers cannot replace its evidence.
   * Annotate that selection from the same async cache as view/list, even when a later file header exists. */
  mergeView(rawId: string): ItemView {
    const view = this.view(rawId);
    const evidence = this.#index.mergeVerdicts(view.id, view.comments.flatMap(c => c.verdict ? [{ key: commentKey(c), verdict: { ...c.verdict, author: c.author, at: c.at } }] : []));
    if (evidence.missing) throw new MergeError('verdict-missing', `${view.id}: hub verdict run ${evidence.missing.run}, commit ${evidence.missing.commit ?? 'none'}, is missing or altered in the item file`);
    const hub = evidence.verdicts.map(({ current: _current, ...v }) => v);
    const annotated = this.#fresh.annotate(view.id, view.branch, hub);
    return { ...view, verdicts: [...view.verdicts.filter(v => v.source === 'file'), ...annotated] };
  }

  recordMerge(rawId: string, receipt: MergeReceipt): void { this.#index.recordMerge(this.#require(rawId).id, receipt); }
  mergeReceipt(rawId: string): MergeReceipt | null { return this.#index.mergeReceipt(normalizeId(rawId) ?? rawId); }

  /** Idempotent follow-ups, kept separate so a failure names the step after a successful landing. */
  finishMerge(actor: Actor, rawId: string, comment: string): { step: string; error: string } | null {
    let step = 'close';
    try {
      const id = this.#require(rawId).id;
      checkText(comment, 'comment');
      const view = this.view(id);
      if (view.state !== 'closed' || !view.comments.some(c => c.text === comment)) this.#mutate(id, actor, 'close', item => {
        item.fm.state = 'closed';
        if (!item.comments.some(c => c.text === comment)) item.comments.push({ author: actor.name, at: this.#now().toISOString(), text: comment });
      });
      step = 'release';
      this.#releaseOnClose(id);
      step = 'topic close';
      for (const listener of [...this.#closedListeners]) listener(id);
      return null;
    } catch (err) {
      return { step, error: err instanceof Error ? err.message : String(err) };
    }
  }

  list(filter: ListFilter = {}): ItemSummary[] {
    const claims = this.#index.claims();
    const verdicts = this.#index.verdicts();
    const base = this.#fresh.base();
    return this.#index.list(filter).map((i) => ({ ...i, claim: claims.get(i.id) ?? null, verdictBase: base, verdicts: this.#fresh.annotate(i.id, i.branch, verdicts.get(i.id) ?? []) }));
  }

  // ---------------------------------------------------------------- writing

  /**
   * Write an item's file atomically and index it. `read` is what a change was made from: the hash of the
   * text read and the descriptor it was read through. A hand edit can land between that read and the
   * rename — written to the path (an editor's save-by-rename, or in place before the rename) or into the
   * replaced file in place up to the rename. Either is looked for, just before and just after the rename,
   * and reported: the hub's write is the file, the hand edit is overwritten (last writer wins).
   */
  #write(name: string, item: Item, read?: { id: string; op: string; hash: string; fd: number }, verdictWriter?: Actor): void {
    const text = serializeItem(item);
    // what is indexed is what the file says — the text read back the way a reader (and a rescan) reads it,
    // not the object it was written from: a comment whose text reads back as a verdict is one, everywhere
    const written = parseItem(text, name);
    const path = join(this.#dir, name);
    const tmp = join(this.#dir, `.${name}.${process.pid}.tmp`);
    writeFileSync(tmp, text);
    // a hand edit landing in this window is what the checks around the rename are for; tests widen it
    if (this.#writePauseMs > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, this.#writePauseMs);
    const before = read ? hashOrNull(() => readFileSync(path, 'utf8')) : null;
    renameSync(tmp, path);
    this.#index.put(written, { file: name, hash: hashOf(text), source: 'hub', indexedAt: this.#now().getTime() }, verdictWriter);
    this.#changed(written.fm.id);
    if (read) {
      const replaced = hashOrNull(() => readWhole(read.fd));
      if (before !== read.hash || replaced !== read.hash) {
        this.#log({
          event: 'task-conflict',
          id: read.id,
          file: name,
          winner: 'hub',
          op: read.op,
          note: 'a hand edit landed while the hub was writing this item and was overwritten by the hub write; last writer wins',
        });
      }
    }
  }

  /**
   * Change one item: read its file as it is on disk now (a hand edit the watcher has not reached yet is
   * not lost — it is read, reported, and the change applied on top), apply `change`, write, index.
   */
  #mutate(rawId: string, actor: Actor, op: string, change: (item: Item) => void, verdictWriter?: Actor): ItemView {
    const { id, file } = this.#require(rawId);
    const path = join(this.#dir, file);
    let text: string;
    // held open until the write is done: the file it reads is the one the rename replaces
    let fd: number;
    try {
      fd = openSync(path, 'r');
      text = readWhole(fd);
    } catch {
      this.#dropFile(file);
      throw new TrackerError(`no item ${id} (its file ${join(TASKS_REL, file)} is gone)`);
    }
    try {
      const meta = this.#index.metaOf(id);
      let item: Item;
      try {
        item = parseItem(text, file);
      } catch (err) {
        throw new TrackerError(`${id}: ${join(TASKS_REL, file)} cannot be read (${err instanceof ItemParseError ? err.message : String(err)}); fix the file by hand first`);
      }
      if (meta && meta.hash !== hashOf(text)) {
        this.#log({ event: 'task-conflict', id, file, winner: 'hub', op, note: 'a hand edit not yet indexed was read and the hub write applied on top of it; last writer wins' });
      }
      change(item);
      item.fm.updated = this.#now().toISOString();
      this.#write(file, item, { id, op, hash: hashOf(text), fd }, verdictWriter);
    } finally {
      closeSync(fd);
    }
    this.#log({ event: 'task-written', id, file, op, by: actor.name });
    return this.view(id);
  }

  #ref(raw: string, self: string | null, what: string): string {
    const id = normalizeId(raw);
    if (!id) throw new TrackerError(`${what}: "${raw}" is not an item id (T-<n>)`);
    if (id === self) throw new TrackerError(`${what}: an item cannot reference itself`);
    if (!this.#index.metaOf(id)) throw new TrackerError(`${what}: no item ${id}`);
    return id;
  }

  create(actor: Actor, input: CreateInput): ItemView {
    const title = input.title?.trim();
    if (!title) throw new TrackerError('an item needs a title');
    const kind = input.kind ?? 'task';
    if (!KINDS.includes(kind)) throw new TrackerError(`unknown kind "${kind}" (one of ${KINDS.join(', ')})`);
    checkText(input.body ?? '', 'body');
    const parent = input.parent ? this.#ref(input.parent, null, 'parent') : null;
    const blocked = [...new Set((input.blocked_by ?? []).map((b) => this.#ref(b, null, 'blocked_by')))];
    const topic = input.topic?.trim() || null;
    this.#checkTopic(null, topic);
    const maxFile = Math.max(0, ...readdirSync(this.#dir).map((n) => fileNumber(n) ?? 0));
    const id = this.#index.allocate(maxFile);
    const name = fileNameOf(id, title);
    const now = this.#now().toISOString();
    const item: Item = {
      fm: {
        id,
        kind,
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
      body: input.body?.trim() ?? '',
      comments: [],
    };
    this.#write(name, item);
    this.#log({ event: 'task-written', id, file: name, op: 'create', by: actor.name });
    if (topic !== null) this.#topicBinding?.bound(id, topic);
    return this.view(id);
  }

/**
   * A comment, or a verdict: its commit (given, or the branch tip) is resolved with Git before the write, never inside
   * it. `resumed` wraps the synchronous write that runs after Git answered (the hub times it against its budget).
   */
  async comment(actor: Actor, rawId: string, text: string, verdict?: VerdictInput, resumed?: <T>(write: () => T) => T, currentActor?: () => Actor): Promise<ItemView> {
    const body = (text ?? '').trim();
    if (!body && !verdict) throw new TrackerError('a comment needs text');
    checkText(body, 'comment');
    let v: Verdict | undefined;
    /** Whether this call awaited Git: what follows then runs as a stretch of its own on the event loop. */
    let awaited = false;
    if (verdict) {
      if (!VERDICT_KINDS.includes(verdict.verdict)) throw new TrackerError(`verdict must be ${VERDICT_KINDS.join(' or ')}`);
      if (!RESULTS.includes(verdict.result)) throw new TrackerError(`result must be ${RESULTS.map((r) => `"${r}"`).join(' or ')}`);
      if (!verdict.run?.trim() || /\n/.test(verdict.run)) throw new TrackerError('a verdict needs a run id (one line)');
      v = { verdict: verdict.verdict, result: verdict.result, by: formatVerdictBy(actor.name, actor.role), run: verdict.run.trim() };
      if (verdict.commit !== undefined) {
        if (typeof verdict.commit !== 'string' || !/^[0-9a-f]{4,64}$/i.test(verdict.commit)) throw new TrackerError('commit must be a Git commit SHA');
        awaited = true;
        const commit = await this.#resolve(verdict.commit, `the verdict's commit ${verdict.commit}`);
        if (!commit) throw new TrackerError('commit does not resolve to a Git commit');
        v.commit = commit;
      }
    }
    // the branch tip a verdict without a commit records, read now: the write itself runs no git
    let tip: { branch: string; sha: string | null } | null = null;
    if (v && verdict?.commit === undefined) {
      const branch = this.#index.get(this.#require(rawId).id)?.branch ?? null;
      if (branch) {
        awaited = true;
        tip = { branch, sha: await this.#resolve(`refs/heads/${branch}`, `the tip of branch ${branch}`) };
      }
    }
    // without an await (a plain comment, a verdict with no branch) the write runs in the request's first stretch
    const write = () => {
      const writer = v && currentActor ? currentActor() : actor;
      if (v) v.by = formatVerdictBy(writer.name, writer.role);
      if (tip?.sha) this.#fresh.noteTip(tip.branch, tip.sha);
      return this.#writeComment(writer, rawId, body, v, tip);
    };
    return awaited && resumed ? resumed(write) : write();
  }

  #writeComment(actor: Actor, rawId: string, body: string, v: Verdict | undefined, tip: { branch: string; sha: string | null } | null): ItemView {
    const view = this.#mutate(rawId, actor, v ? 'verdict' : 'comment', (item) => {
      if (v && !v.commit) {
        // a hand edit moved the branch meanwhile: the tip the cache last read for it
        const sha = item.fm.branch === tip?.branch ? tip.sha : this.#fresh.tip(item.fm.branch);
        if (sha) v.commit = sha;
      }
      item.comments.push({ author: actor.name, at: this.#now().toISOString(), text: body, ...(v ? { verdict: v } : {}) });
    }, actor);
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
  }

  /** A ref resolved for a write; Git not answering at all is a typed refusal naming what it could not resolve. */
  async #resolve(ref: string, what: string): Promise<string | null> {
    try {
      return await resolveCommit(this.#git, ref);
    } catch (err) {
      throw new TrackerError(`cannot resolve ${what}: Git did not answer (${err instanceof Error ? err.message.split('\n')[0] : String(err)}); nothing was written, try again`, 'git-unavailable');
    }
  }

  edit(actor: Actor, rawId: string, input: EditInput): ItemView {
    if (input.kind !== undefined && !KINDS.includes(input.kind)) throw new TrackerError(`unknown kind "${input.kind}" (one of ${KINDS.join(', ')})`);
    if (input.state !== undefined && !STATES.includes(input.state)) throw new TrackerError(`unknown state "${input.state}" (open or closed)`);
    if (input.title !== undefined && !input.title.trim()) throw new TrackerError('the title cannot be empty');
    if (input.body !== undefined) checkText(input.body, 'body');
    const view = this.#mutate(rawId, actor, 'edit', (item) => {
      const fm = item.fm;
      if (input.title !== undefined) fm.title = input.title.trim();
      if (input.body !== undefined) item.body = input.body.trim();
      if (input.kind !== undefined) fm.kind = input.kind;
      if (input.state !== undefined) fm.state = input.state;
      if (input.labels !== undefined) fm.labels = uniq(input.labels);
      if (input.add_labels) fm.labels = uniq([...fm.labels, ...input.add_labels]);
      if (input.remove_labels) fm.labels = fm.labels.filter((l) => !input.remove_labels?.includes(l));
      if (input.assignee !== undefined) fm.assignee = input.assignee || null;
    });
    if (input.state === 'closed') {
      this.#releaseOnClose(view.id);
      this.#closed(view.id);
    }
    return input.state === 'closed' ? this.view(view.id) : view;
  }

  close(actor: Actor, rawId: string, comment?: string): ItemView {
    const body = comment?.trim() ?? '';
    checkText(body, 'comment');
    const view = this.#mutate(rawId, actor, 'close', (item) => {
      item.fm.state = 'closed';
      if (body) item.comments.push({ author: actor.name, at: this.#now().toISOString(), text: body });
    });
    this.#releaseOnClose(view.id);
    this.#closed(view.id);
    return this.view(view.id);
  }

  #releaseOnClose(id: string): void {
    const claim = this.#index.claimOf(id);
    if (!claim) return;
    this.#index.setClaim(id, null);
    this.#log({ event: 'task-released', id, session: claim.session, reason: 'closed' });
    this.#changed(id);
  }

  link(actor: Actor, rawId: string, input: LinkInput): ItemView {
    const { id } = this.#require(rawId);
    const parent = input.parent === undefined ? undefined : input.parent === null ? null : this.#ref(input.parent, id, 'parent');
    const add = (input.blocked_by ?? []).map((b) => this.#ref(b, id, 'blocked_by'));
    const remove = (input.unblock ?? []).map((b) => normalizeId(b) ?? b);
    const topic = input.topic === undefined ? undefined : input.topic?.trim() || null;
    if (topic !== undefined) this.#checkTopic(id, topic);
    const view = this.#mutate(id, actor, 'link', (item) => {
      const fm = item.fm;
      if (parent !== undefined) fm.parent = parent;
      fm.blocked_by = uniq([...fm.blocked_by, ...add]).filter((b) => !remove.includes(b));
      if (topic !== undefined) fm.topic = topic;
      if (input.branch !== undefined) fm.branch = input.branch || null;
    });
    if (topic !== undefined) this.#topicBinding?.bound(id, topic);
    return view;
  }

  /** The hub's own write of an item's `topic` field (a binding it already made: `topic.create` with an item). */
  writeTopic(actor: Actor, rawId: string, topic: string | null): ItemView {
    return this.#mutate(rawId, actor, 'link', (item) => {
      item.fm.topic = topic;
    });
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
  writeItem(actor: Actor, op: string, item: Item, existing: { file: string; text: string } | null): 'created' | 'updated' | 'unchanged' {
    if (existing && serializeItem(item) === existing.text) return 'unchanged';
    item.fm.updated = this.#now().toISOString();
    const file = existing?.file ?? fileNameOf(item.fm.id, item.fm.title);
    this.#write(file, item);
    this.#log({ event: 'task-written', id: item.fm.id, file, op, by: actor.name });
    return existing ? 'updated' : 'created';
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
function readWhole(fd: number): string {
  const size = fstatSync(fd).size;
  const buf = Buffer.alloc(size);
  let off = 0;
  while (off < size) {
    const n = readSync(fd, buf, off, size - off, off);
    if (n === 0) break;
    off += n;
  }
  return buf.subarray(0, off).toString('utf8');
}

/** The hash of what `read` returns, or null when it cannot be read (gone). */
function hashOrNull(read: () => string): string | null {
  try {
    return hashOf(read());
  } catch {
    return null;
  }
}

const uniq = (xs: string[]): string[] => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];

/** A text the file format could not hold back unchanged is refused rather than silently mangled. */
function checkText(text: string, what: string): void {
  for (const line of text.split('\n')) {
    if (line.trim() === COMMENTS_HEADING) throw new TrackerError(`the ${what} cannot contain a "${COMMENTS_HEADING}" line: it starts the comments section`);
    if (/^### .+ · \S+\s*$/.test(line)) throw new TrackerError(`the ${what} cannot contain a line shaped like a comment header ("### <author> · <time>")`);
  }
}
