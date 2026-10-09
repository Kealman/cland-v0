// Verdict freshness off the request path (T-67). Whether the latest verdict of each kind is `current` for its item's
// branch is a Git question (verdict-git.ts) that can take seconds under load; `task.list`, `task.view` and the `task`
// event only read the answer from here, and a value not yet known is absent ("unknown"), never computed inline.
//
// An answer is kept by what decides it: (verdict commit, branch tip, base, base tip). The branch tips are read with
// one `git for-each-ref` on a timer and soon after every tracker change; a tip that moved changes the key, so nothing
// has to be invalidated by hand: answers for tips no branch has any more are dropped. Missing answers are computed
// one at a time, asynchronously, and the items waiting for them are announced (`settled`) once they are known.
import type { IndexedVerdict } from './index-db.ts';
import type { VerdictKind } from './item.ts';
import type { LogFn } from '../log.ts';
import { branchTips, resolveCommit, taskPatch, verdictBaseOf, type Git } from './verdict-git.ts';

/** How often the branch tips are read, ms. */
export const TIP_CHECK_MS = 2000;
/** How soon after a tracker change the tips are read again, ms (changes in a burst share one read). */
const POKE_MS = 50;

type Want = { commit: string; tip: string; base: string | null; ids: Set<string> };

/** Owns when tip reads run, including the first read; tests can drive and await them by hand. */
export type TipSchedule = (read: () => Promise<void>, intervalMs: number) => { poke: () => void; stop: () => void };

const scheduleTips: TipSchedule = (read, intervalMs) => {
  const timer = setInterval(() => void read(), intervalMs);
  timer.unref();
  let poke: NodeJS.Timeout | null = null;
  void read();
  return {
    poke: () => {
      if (poke) return;
      poke = setTimeout(() => {
        poke = null;
        void read();
      }, POKE_MS);
      poke.unref();
    },
    stop: () => {
      clearInterval(timer);
      if (poke) clearTimeout(poke);
    },
  };
};

export type FreshnessOptions = {
  git: Git;
  log?: LogFn;
  intervalMs?: number;
  scheduleTips?: TipSchedule;
  /** Answers are known for these items now: announce them again. */
  settled: (ids: string[]) => void;
  /** A branch tip or the base moved (or the first read is done): every item's freshness may have changed. */
  tipsMoved: () => void;
};

export class Freshness {
  readonly #git: Git;
  readonly #log: LogFn;
  readonly #intervalMs: number;
  readonly #scheduleTips: TipSchedule;
  readonly #settled: (ids: string[]) => void;
  readonly #tipsMoved: () => void;
  /** Branch → tip as last read; null until the first read. */
  #tips: Map<string, string> | null = null;
  readonly #results = new Map<string, boolean>();
  readonly #wants = new Map<string, Want>();
  /** Task patch ids by (base, base tip, commit): the tip's is shared by the review and the QA verdict. */
  readonly #patches = new Map<string, Promise<string | null>>();
  #working = false;
  /** The worker is due to start: never from inside a read, where its first git would run in the handler. */
  #workSoon = false;
  /** Branches a read did not hold when they were asked about: the read count then, and whether a later read settled it. */
  readonly #missing = new Map<string, { asked: number; absent: boolean }>();
  /** Tip reads started so far. */
  #reads = 0;
  #reading = false;
  #readAgain = false;
  #schedule: ReturnType<TipSchedule> | null = null;
  #stopped = false;
  #failed = false;

  constructor(options: FreshnessOptions) {
    this.#git = options.git;
    this.#log = options.log ?? (() => {});
    this.#intervalMs = options.intervalMs ?? TIP_CHECK_MS;
    this.#scheduleTips = options.scheduleTips ?? scheduleTips;
    this.#settled = options.settled;
    this.#tipsMoved = options.tipsMoved;
  }

  start(): void {
    this.#stopped = false;
    this.#schedule = this.#scheduleTips(() => this.refresh(), this.#intervalMs);
  }

  stop(): void {
    this.#stopped = true;
    this.#workSoon = false;
    this.#schedule?.stop();
    this.#schedule = null;
    this.#wants.clear();
  }

  /** The integration branch patch ids are compared against, as last read; null when neither exists or not read yet. */
  base(): string | null {
    return this.#tips ? verdictBaseOf(this.#tips) : null;
  }

  /** Something changed in the tracker: read the tips again soon. */
  poke(): void {
    if (!this.#stopped) this.#schedule?.poke();
  }

  /** A branch's tip as last read; null when it has none or nothing was read yet. */
  tip(branch: string | null): string | null {
    return branch ? (this.#tips?.get(branch) ?? null) : null;
  }

  /** A tip the hub just resolved itself (a verdict's commit): known at once, without waiting for the next read. */
  noteTip(branch: string, tip: string): void {
    if (!this.#tips || this.#tips.get(branch) === tip) return;
    this.#tips.set(branch, tip);
    this.#prune();
  }

  /**
   * `verdicts` with `current` on the latest of each kind, from the cache. An answer not known yet is left absent and
   * computed in the background; the item (`id`) is announced through `settled` once it is.
   */
  annotate(id: string, branch: string | null, verdicts: IndexedVerdict[]): IndexedVerdict[] {
    if (!verdicts.length) return verdicts;
    const latest = new Map<VerdictKind, number>();
    verdicts.forEach((v, i) => latest.set(v.verdict, i));
    return verdicts.map((v, i) => {
      if (latest.get(v.verdict) !== i) return v;
      const current = this.#current(id, branch, v.commit);
      return current === undefined ? v : { ...v, current };
    });
  }

  #current(id: string, branch: string | null, commit: string | undefined): boolean | undefined {
    if (!commit || !branch || !/^[0-9a-f]{4,64}$/i.test(commit)) return false;
    const tips = this.#tips;
    if (!tips) return undefined;
    const tip = tips.get(branch);
    if (tip === undefined) {
      // a branch the last read did not hold may be new: unknown until a read started after this question finds none
      let missing = this.#missing.get(branch);
      if (!missing) {
        missing = { asked: this.#reads, absent: false };
        this.#missing.set(branch, missing);
        this.poke();
      }
      return missing.absent ? false : undefined;
    }
    if (commit === tip) return true;
    const base = verdictBaseOf(tips);
    const key = keyOf(commit, tip, base, base ? (tips.get(base) ?? null) : null);
    const known = this.#results.get(key);
    if (known !== undefined) return known;
    if (id) {
      const want = this.#wants.get(key) ?? { commit, tip, base, ids: new Set<string>() };
      want.ids.add(id);
      this.#wants.set(key, want);
      this.#startWork();
    }
    return undefined;
  }

  #startWork(): void {
    if (this.#working || this.#workSoon || this.#stopped) return;
    this.#workSoon = true;
    setImmediate(() => {
      this.#workSoon = false;
      void this.#work();
    });
  }

  /** Read the branch tips (one at a time; a request while reading reads once more after). */
  async refresh(): Promise<void> {
    if (this.#stopped) return;
    if (this.#reading) {
      this.#readAgain = true;
      return;
    }
    this.#reading = true;
    try {
      do {
        this.#readAgain = false;
        const seq = ++this.#reads;
        let read: Map<string, string> | null;
        try {
          read = await branchTips(this.#git);
        } catch (err) {
          this.#fail('read', err);
          return;
        }
        if (this.#stopped) return;
        const next = read ?? new Map<string, string>();
        const moved = this.#tips === null || !sameTips(this.#tips, next);
        this.#tips = next;
        // a branch asked about before this read started and still missing has none: stale from now on
        let settled = false;
        for (const [branch, missing] of this.#missing) {
          if (next.has(branch)) this.#missing.delete(branch);
          else if (!missing.absent && missing.asked < seq) settled = missing.absent = true;
        }
        if (moved) this.#prune();
        if (moved || settled) this.#tipsMoved();
      } while (this.#readAgain && !this.#stopped);
    } finally {
      this.#reading = false;
    }
  }

  /** Drop answers, waits and patch ids for tips no branch has any more. */
  #prune(): void {
    const tips = this.#tips;
    if (!tips) return;
    const live = new Set(tips.values());
    const base = verdictBaseOf(tips);
    const baseKey = `${base ?? ''} ${base ? (tips.get(base) ?? '') : ''}`;
    const alive = (key: string) => {
      const [, tip, b, bt] = key.split(' ');
      return live.has(tip!) && `${b} ${bt}` === baseKey;
    };
    for (const key of [...this.#results.keys()]) if (!alive(key)) this.#results.delete(key);
    for (const key of [...this.#wants.keys()]) if (!alive(key)) this.#wants.delete(key);
    for (const key of [...this.#patches.keys()]) if (!key.startsWith(`${baseKey} `)) this.#patches.delete(key);
  }

  /** Compute the missing answers, one at a time. */
  async #work(): Promise<void> {
    if (this.#working) return;
    this.#working = true;
    try {
      for (;;) {
        if (this.#stopped) return;
        const next = this.#wants.entries().next();
        if (next.done) return;
        const [key, want] = next.value;
        let value: boolean | null;
        try {
          value = await this.#compute(want);
        } catch (err) {
          this.#fail('compute', err);
          value = null;
        }
        // a tip that moved meanwhile dropped the wait: its answer is for nobody
        if (this.#wants.get(key) !== want) continue;
        this.#wants.delete(key);
        if (value === null || this.#stopped) continue;
        this.#results.set(key, value);
        this.#settled([...want.ids]);
      }
    } finally {
      this.#working = false;
    }
  }

  /** Compare the whole task diff, not just the last commit's patch, against each commit's own merge base. */
  async #compute(want: Want): Promise<boolean> {
    const resolved = await resolveCommit(this.#git, want.commit);
    if (!resolved) return false;
    if (resolved === want.tip) return true;
    if (!want.base) return false;
    const reviewed = await this.#patch(want.base, resolved);
    return reviewed !== null && reviewed === (await this.#patch(want.base, want.tip));
  }

  #patch(base: string, sha: string): Promise<string | null> {
    const tips = this.#tips;
    const key = `${base} ${tips?.get(base) ?? ''} ${sha}`;
    let patch = this.#patches.get(key);
    if (!patch) {
      patch = taskPatch(this.#git, base, sha);
      this.#patches.set(key, patch);
      // a failure is not kept: the next want asks again
      patch.catch(() => this.#patches.delete(key));
    }
    return patch;
  }

  /** Git could not answer at all: said once per streak, so a hub under load does not flood its log. */
  #fail(what: string, err: unknown): void {
    if (this.#failed) return;
    this.#failed = true;
    this.#log({ event: 'freshness-failed', what, error: err instanceof Error ? err.message : String(err) });
    setTimeout(() => (this.#failed = false), 60_000).unref();
  }
}

/** Whether a latest verdict of `annotated` (from `annotate`) still waits for its answer. */
export function pending(annotated: IndexedVerdict[]): boolean {
  return annotated.some((v, i) => v.current === undefined && !annotated.slice(i + 1).some((w) => w.verdict === v.verdict));
}

const keyOf = (commit: string, tip: string, base: string | null, baseTip: string | null): string => [commit, tip, base ?? '', baseTip ?? ''].join(' ');

function sameTips(a: ReadonlyMap<string, string>, b: ReadonlyMap<string, string>): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) if (b.get(k) !== v) return false;
  return true;
}
