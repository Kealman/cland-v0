// Independent durable search: no merge queue state or worker lifetime is awaited here.
import type { Platform } from '../executor/executor.ts';
import type { Store } from './store.ts';
import type { DevT3Result } from './dev-t3-result.ts';
import type { Clock, ClockTimer } from './clock.ts';
import type { LogFn } from '../log.ts';

export type PlatformSkip = { name: string; reason: string };
export type ProbeVerdict = { result: 'green' | 'red' | 'inconclusive'; reason?: string }
  | { result: 'partial'; executed: 'green' | 'red'; platform: Platform; platformSkips: PlatformSkip[] };
export type ProbeReceipt = { head: string; file: string; reason?: string } & (
  (ProbeVerdict & { run: string; artifact: string; path: string })
  | { result: 'absent'; run: null; artifact: null; path: null; tree: string });
type FileSearch = { file: string; low: number; high: number; phase: 'repeat' | 'baseline' | 'bisect' | 'confirm-green' | 'confirm-red'; receipts: ProbeReceipt[];
  tip?: ProbeReceipt; result?: 'already-fixed' | 'culprit' | 'pre-existing' | 'flake' | 'inconclusive'; culprit?: { head: string; subject: string }; reason?: string };
export type SearchReport = { input: DevT3Result; files: FileSearch[] };
type Search = SearchReport & { reported?: boolean };
export type SearchBoundary = {
  log?: LogFn;
  currentDev(): Promise<string>;
  nonTrackerChanges?(red: string, tip: string): Promise<boolean | null>;
  probe(input: DevT3Result, head: string, file: string, repetition?: 'boundary'): Promise<ProbeReceipt | null>;
  report(report: SearchReport): Promise<void>;
  blocked?(input: DevT3Result, reason: string): void;
};
const executedResult = (receipt: ProbeReceipt) => receipt.result === 'partial' ? receipt.executed : receipt.result;
const exclusions = (receipt: ProbeReceipt) => receipt.result === 'partial'
  ? JSON.stringify([receipt.platform.os, receipt.platform.arch, receipt.platformSkips.map(skip => [skip.name, skip.reason]).sort()]) : '';
const KEY = 'dev-t3-searches';
export class DevT3Search {
  readonly store: Store;
  readonly boundary: SearchBoundary;
  #work: Promise<void> | null = null;
  #timer: ClockTimer | null = null;
  #closed = false;
  constructor(store: Store, boundary: SearchBoundary) { this.store = store; this.boundary = boundary; }
  #read(): Search[] { return JSON.parse(this.store.meta(KEY) ?? '[]') as Search[]; }
  accept(input: DevT3Result): void {
    if (input.result !== 'red') return;
    const searches = this.#read();
    if (searches.some(search => search.input.run === input.run)) return;
    searches.push({ input, files: input.failingFiles.map(file => ({ file, low: -1, high: (input.merges?.length ?? 0) - 1, phase: 'repeat', receipts: [] })) });
    this.store.setMeta(KEY, JSON.stringify(searches));
  }
  start(clock: Clock): void {
    this.#timer = clock.setInterval(() => { void this.tick(); }, 1000); this.#timer.unref();
  }
  tick(): Promise<void> {
    if (this.#closed) return Promise.resolve();
    return this.#work ??= this.#advance().catch(error => {
      const reason = String(error); this.store.setMeta('dev-t3-search-error', reason);
      const input = this.#read().find(search => !search.reported)?.input;
      if (input) this.boundary.blocked?.(input, reason);
    }).catch(error => {
      try { this.boundary.log?.({ event: 'dev-t3-search-report-failed', error: String(error) }); }
      catch { /* a failed logger must not reject a background tick */ }
    }).finally(() => { this.#work = null; });
  }
  async #advance(): Promise<void> {
    const search = this.#read().find(search => !search.reported);
    if (!search) return;
    const save = () => {
      // accept() may add another periodic result while a probe/report is awaiting I/O.
      const all = this.#read(); all[all.findIndex(s => s.input.run === search.input.run)] = search;
      this.store.setMeta(KEY, JSON.stringify(all));
    };
    // Upgrade an unreported pre-confirmation checkpoint before allowing blame.
    for (const file of search.files) if (file.result === 'culprit' && file.phase === 'bisect') {
      delete file.result; delete file.culprit; file.phase = 'confirm-green';
    }
    // Revalidate the live tip before history and again before reporting. Older
    // persisted searches have no tip receipt, so they pass through this gate too.
    const candidates = search.files.filter(file => !file.result || file.result === 'culprit' || file.result === 'already-fixed');
    const tip = candidates.length ? await this.boundary.currentDev() : null;
    if (candidates.length && !tip) throw new Error('current dev tip unavailable');
    const stale = candidates.find(file => file.tip?.head !== tip);
    const file = stale ?? search.files.find(file => !file.result);
    if (file) {
      const { input } = search;
      if (stale) {
        const receipt = await this.boundary.probe(input, tip!, file.file);
        if (!receipt || this.#closed) return;
        file.receipts.push(receipt);
        if (receipt.head !== tip || receipt.file !== file.file || receipt.result === 'inconclusive' || receipt.result === 'absent') {
          file.result = 'inconclusive'; file.reason = receipt.reason ?? 'current dev tip evidence unavailable'; delete file.culprit;
        } else {
          file.tip = receipt;
          const result = executedResult(receipt);
          if (result === 'green') {
            await this.#classifyGreen(input, file, receipt);
            delete file.culprit;
          } else {
            if (file.result === 'already-fixed') {
              delete file.result; delete file.reason;
              file.phase = 'repeat'; file.low = -1; file.high = (input.merges?.length ?? 0) - 1;
            }
            if (file.phase === 'repeat' && tip === input.head) file.phase = 'baseline';
          }
        }
        save(); return;
      }
      if (file.phase !== 'repeat' && (!input.previousGreenHead || !input.merges?.length || input.merges.at(-1)?.head !== input.head)) {
        file.result = 'inconclusive'; file.reason = 'baseline or complete landed range unavailable'; save(); return;
      }
      const confirming = file.phase === 'confirm-green' || file.phase === 'confirm-red';
      const index = file.phase === 'repeat' || file.phase === 'confirm-red' ? file.high
        : file.phase === 'baseline' ? -1 : file.phase === 'confirm-green' ? file.low : Math.floor((file.low + file.high) / 2);
      const head = file.phase === 'repeat' ? input.head : index < 0 ? input.previousGreenHead! : input.merges![index]!.head;
      let receipt: ProbeReceipt | null;
      try { receipt = await this.boundary.probe(input, head, file.file, confirming ? 'boundary' : undefined); }
      catch (error) { file.result = 'inconclusive'; file.reason = String(error); save(); return; }
      if (!receipt || this.#closed) return;
      const earlier = file.receipts.find(receipt => receipt.head === head);
      const comparable = file.receipts.find(receipt => receipt.result !== 'absent');
      const result = executedResult(receipt);
      file.receipts.push(receipt);
      if (receipt.head !== head || receipt.file !== file.file || receipt.result === 'inconclusive') { file.result = 'inconclusive'; file.reason = receipt.reason ?? 'probe identity or evidence unavailable'; }
      else if (comparable && exclusions(comparable) !== exclusions(receipt)) {
        file.result = 'inconclusive'; file.reason = 'platform exclusion set or platform changed or missing across compared commits';
      } else if (confirming) {
        if (!earlier || executedResult(earlier) !== result || receipt.run !== null && earlier.run === receipt.run) {
          file.result = 'inconclusive'; file.reason = `flaky boundary: ${head} was ${earlier ? executedResult(earlier) : 'unavailable'}, repeated ${result}; fresh matching pair required`;
        } else if (file.phase === 'confirm-green') file.phase = 'confirm-red';
        else { file.result = 'culprit'; file.culprit = input.merges![file.high]!; }
      } else if (file.phase === 'repeat') {
        if (result === 'green') {
          file.result = receipt.result === 'partial' ? 'inconclusive' : 'flake';
          if (receipt.result === 'partial') file.reason = 'platform exclusions leave the original failure unreproduced; excluded tests not executed';
        }
        else if (receipt.result === 'absent') { file.result = 'inconclusive'; file.reason = 'requested failing file absent at red head'; }
        else file.phase = 'baseline';
      } else if (file.phase === 'baseline') {
        if (result === 'red') file.result = 'pre-existing';
        else file.phase = 'bisect';
      } else if (result === 'red') file.high = index;
      else file.low = index;
      if (!file.result && file.phase === 'bisect' && file.high - file.low === 1) file.phase = 'confirm-green';
      save(); return;
    }
    // Old checkpoints may already say fixed without repository evidence.
    for (const file of search.files) if (file.result === 'already-fixed' && file.tip) {
      await this.#classifyGreen(search.input, file, file.tip);
    }
    // Idempotent boundary filing/reporting permits retry after a crash between it and this checkpoint.
    await this.boundary.report(search);
    search.reported = true; save();
  }
  async #classifyGreen(input: DevT3Result, file: FileSearch, receipt: ProbeReceipt): Promise<void> {
    const changed = receipt.head === input.head ? false : await this.boundary.nonTrackerChanges?.(input.head, receipt.head);
    if (receipt.result === 'partial') {
      file.result = 'inconclusive'; file.reason = 'current dev tip has platform exclusions; excluded tests not executed';
    } else if (changed === true) {
      file.result = 'already-fixed'; file.reason = `already fixed on dev at ${receipt.head}`;
    } else if (changed === false) {
      file.result = 'flake';
      file.reason = `not reproduced (intermittent): red run ${input.run} at ${input.head}; green run ${receipt.run} at ${receipt.head}; only tracker, docs, QA briefs or duration-baseline changes after red head`;
    } else {
      file.result = 'inconclusive'; file.reason = 'non-tracker change history unavailable';
    }
  }
  async close(clock: Clock): Promise<void> {
    this.#closed = true; if (this.#timer) clock.clearInterval(this.#timer); await this.#work;
  }
}


/** Inspect commits, not an endpoint diff: a code edit followed by a revert counts.
 * Tracker, docs, QA briefs and duration baselines supply no source-fix evidence.
 * Missing ancestry or Git evidence must never imply that a failure was fixed. */
export async function nonTrackerChanges(git: (args: string[]) => Promise<string | null>, red: string, tip: string): Promise<boolean | null> {
  try {
    if ((await git(['merge-base', red, tip]))?.trim() !== red) return null;
    const paths = await git(['log', '--format=', '--name-only', '-z', '--full-history', '-m', '--no-renames', `${red}..${tip}`, '--', '.', ':(exclude).cland/tasks']);
    return paths === null ? null : paths.split('\0').map(path => path.trim()).some(path =>
      path.length > 0 && !path.startsWith('docs/') && !path.startsWith('qa/briefs/') && path !== 'hub/test/durations.json');
  } catch { return null; }
}
