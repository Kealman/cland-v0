// The tracker: item files in `.cland/tasks/` are the source of truth, the hub writes them and keeps the
// index (spec 4.6, ADR 0002).
//
// Writes are serialized by construction: every operation reads, changes, writes and indexes with
// synchronous calls, so one runs to completion on the hub's single thread before the next starts.
// Hand edits are picked up by a watcher on the folder (debounced) and re-indexed; last writer wins.
// Nothing is ever committed.
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fstatSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, renameSync, watch, writeFileSync, type FSWatcher } from 'node:fs';
import { join } from 'node:path';
import { TrackerIndex, type Claim, type IndexedItem, type ListFilter } from './index-db.ts';
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
  body: string;
  comments: Comment[];
  verdicts: Array<Verdict & { author: string; at: string }>;
  claim: Claim | null;
  /** The GitHub issue the item was imported from, when it was. */
  github?: GithubRef;
};

export type ItemSummary = IndexedItem & { claim: Claim | null };

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

export type VerdictInput = { verdict: VerdictKind; result: VerdictResult; run: string };

export class TrackerError extends Error {}

const hashOf = (text: string): string => createHash('sha256').update(text).digest('hex');

const TASKS_REL = join('.cland', 'tasks');

export class Tracker {
  readonly #root: string;
  readonly #dir: string;
  readonly #index: TrackerIndex;
  readonly #log: LogFn;
  readonly #now: () => Date;
  #watcher: FSWatcher | null = null;
  readonly #pending = new Map<string, NodeJS.Timeout>();
  #rescanTimer: NodeJS.Timeout | null = null;

  /** Tests only: how long a write holds still between its temporary file and the rename (0: not at all). */
  readonly #writePauseMs: number;
  /** Told when an item closes (the hub's close, an edit to `closed`, a hand edit): its topic closes too (spec 4.5). */
  readonly #closedListeners = new Set<(id: string) => void>();

  constructor(options: { root: string; db: string; log?: LogFn; now?: () => Date; writePauseMs?: number }) {
    this.#root = options.root;
    this.#writePauseMs = options.writePauseMs ?? 0;
    this.#dir = join(options.root, TASKS_REL);
    this.#log = options.log ?? (() => {});
    this.#now = options.now ?? (() => new Date());
    mkdirSync(this.#dir, { recursive: true });
    this.#index = new TrackerIndex(options.db);
  }

  /** Listen to items closing; returns the unsubscribe. */
  onClosed(listener: (id: string) => void): () => void {
    this.#closedListeners.add(listener);
    return () => this.#closedListeners.delete(listener);
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
    this.#watcher = watch(this.#dir, (_event, name) => {
      if (name === null) this.#scheduleRescan();
      else if (fileNumber(String(name)) !== null) this.#schedule(String(name));
    });
    this.#watcher.on('error', (err) => {
      this.#log({ event: 'task-watch-error', error: err.message });
    });
  }

  stop(): void {
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
    if (knownId && knownId !== id) this.#index.remove(knownId);
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
    if (wasOpen && item.fm.state === 'closed') this.#closed(id);
  }

  #dropFile(name: string): void {
    const id = this.#index.idOfFile(name);
    if (!id) return;
    this.#index.remove(id);
    this.#log({ event: 'task-removed', id, file: name });
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
      ...item.fm,
      file,
      path: join(TASKS_REL, file),
      body: item.body,
      comments: item.comments,
      verdicts: item.comments.flatMap((c) => (c.verdict ? [{ ...c.verdict, author: c.author, at: c.at }] : [])),
      claim: this.#index.claimOf(id),
    };
  }

  list(filter: ListFilter = {}): ItemSummary[] {
    const claims = this.#index.claims();
    return this.#index.list(filter).map((i) => ({ ...i, claim: claims.get(i.id) ?? null }));
  }

  // ---------------------------------------------------------------- writing

  /**
   * Write an item's file atomically and index it. `read` is what a change was made from: the hash of the
   * text read and the descriptor it was read through. A hand edit can land between that read and the
   * rename — written to the path (an editor's save-by-rename, or in place before the rename) or into the
   * replaced file in place up to the rename. Either is looked for, just before and just after the rename,
   * and reported: the hub's write is the file, the hand edit is overwritten (last writer wins).
   */
  #write(name: string, item: Item, read?: { id: string; op: string; hash: string; fd: number }): void {
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
    this.#index.put(written, { file: name, hash: hashOf(text), source: 'hub', indexedAt: this.#now().getTime() });
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
  #mutate(rawId: string, actor: Actor, op: string, change: (item: Item) => void): ItemView {
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
      this.#write(file, item, { id, op, hash: hashOf(text), fd });
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
        topic: input.topic ?? null,
        branch: input.branch ?? null,
        created: now,
        updated: now,
      },
      body: input.body?.trim() ?? '',
      comments: [],
    };
    this.#write(name, item);
    this.#log({ event: 'task-written', id, file: name, op: 'create', by: actor.name });
    return this.view(id);
  }

  comment(actor: Actor, rawId: string, text: string, verdict?: VerdictInput): ItemView {
    const body = (text ?? '').trim();
    if (!body && !verdict) throw new TrackerError('a comment needs text');
    checkText(body, 'comment');
    let v: Verdict | undefined;
    if (verdict) {
      if (!VERDICT_KINDS.includes(verdict.verdict)) throw new TrackerError(`verdict must be ${VERDICT_KINDS.join(' or ')}`);
      if (!RESULTS.includes(verdict.result)) throw new TrackerError(`result must be ${RESULTS.map((r) => `"${r}"`).join(' or ')}`);
      if (!verdict.run?.trim() || /\n/.test(verdict.run)) throw new TrackerError('a verdict needs a run id (one line)');
      v = { verdict: verdict.verdict, result: verdict.result, by: formatVerdictBy(actor.name, actor.role), run: verdict.run.trim() };
    }
    return this.#mutate(rawId, actor, verdict ? 'verdict' : 'comment', (item) => {
      item.comments.push({ author: actor.name, at: this.#now().toISOString(), text: body, ...(v ? { verdict: v } : {}) });
    });
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
  }

  link(actor: Actor, rawId: string, input: LinkInput): ItemView {
    const { id } = this.#require(rawId);
    const parent = input.parent === undefined ? undefined : input.parent === null ? null : this.#ref(input.parent, id, 'parent');
    const add = (input.blocked_by ?? []).map((b) => this.#ref(b, id, 'blocked_by'));
    const remove = (input.unblock ?? []).map((b) => normalizeId(b) ?? b);
    return this.#mutate(id, actor, 'link', (item) => {
      const fm = item.fm;
      if (parent !== undefined) fm.parent = parent;
      fm.blocked_by = uniq([...fm.blocked_by, ...add]).filter((b) => !remove.includes(b));
      if (input.topic !== undefined) fm.topic = input.topic || null;
      if (input.branch !== undefined) fm.branch = input.branch || null;
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
      }
      return { id, claim: null };
    }
    if (held && !other) {
      // the holder again, perhaps renamed since: the claim keeps its time and shows the name it has now
      if (held.session === actor.name && held.role === actor.role) return { id, claim: held };
      const renamed: Claim = { ...held, session: actor.name, role: actor.role };
      this.#index.setClaim(id, renamed);
      return { id, claim: renamed };
    }
    const claim: Claim = { session: actor.name, sessionId: actor.id, role: actor.role, claimedAt: this.#now().toISOString() };
    this.#index.setClaim(id, claim);
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
