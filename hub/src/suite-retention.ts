import { lstat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { retireSuiteRun } from './suite-raw-coverage.ts';
import { SUITE_RUNS_PER_OCCASION, suiteRetentionCandidates, suiteRunOldEnough } from './suite-retention-policy.ts';
import { parseDurationManifest } from './suite-durations.ts';

export type RetainedSuite = { id: string; occasion?: string; sequence?: number; state?: string; cleaned?: boolean; reported: boolean; accountingPending?: boolean; completedAt?: string; finished?: string };
type ArtifactEvidence = string | { id: string; path: string };
type DecisionReceipt = (id: string, removed: boolean, error?: unknown, decision?: 'would-retire' | 'removed') => void;
/** Fed by the scheduler's existing checkpoint walk. No startup directory census,
 * log reads or repeated history sort; one shared bounded admission sweep. */
export class SuiteRetention {
  readonly #recent = new Map<string, RetainedSuite[]>();
  readonly #pending = new Map<string, RetainedSuite>();
  #flight: Promise<void> | undefined;
  #draining: Promise<void> | undefined;
  #durationStamp = '';
  #durationSources: string[] = [];
  readonly #decisions = new Map<string, string>();
  readonly #counts = new Map<string, number>();
  readonly #known = new Set<string>();
  #removed = 0;
  readonly #options: {remove?: boolean; now?: () => number};
  readonly root: string;
  readonly keep: number;
  constructor(root: string, keep = SUITE_RUNS_PER_OCCASION, options: {remove?: boolean; now?: () => number} = {}) {
    if (!Number.isSafeInteger(keep) || keep < 1) throw new Error('suite retention must be a positive integer');
    this.root = root; this.keep = keep;
    this.#options = options;
  }
  #record(id: string, reason: string): void {
    const previous = this.#decisions.get(id);
    if (previous === reason) return;
    if (previous) this.#counts.set(previous, (this.#counts.get(previous) ?? 0) - 1);
    this.#decisions.set(id,reason); this.#counts.set(reason,(this.#counts.get(reason)??0)+1);
  }
  snapshot() {
    const wouldRetire = this.#counts.get('eligible') ?? 0;
    const pending = this.#counts.get('pending') ?? 0;
    return {mode:this.#options.remove?'fixture-removal' as const:'report' as const, total:this.#known.size, classified:this.#decisions.size-pending, pending, kept:this.#decisions.size-pending-wouldRetire, wouldRetire, removed:this.#removed, reasons:Object.fromEntries(this.#counts)};
  }
  remember(run: RetainedSuite): void {
    this.#known.add(run.id);
    const occasion = run.occasion ?? 'task';
    const recent = this.#recent.get(occasion) ?? [];
    const previous = recent.findIndex(row => row.id === run.id);
    if (previous >= 0) recent.splice(previous, 1);
    recent.push(run);
    const expired = new Set(suiteRetentionCandidates(recent.map(row => ({ id: row.id, occasion, sequence: row.sequence ?? 0, settled: true })), new Set(), this.keep));
    const evicted = recent.filter(row => expired.has(row.id));
    this.#recent.set(occasion, recent.filter(row => !expired.has(row.id)));
    for (const row of evicted) { this.#pending.set(row.id, row); this.#record(row.id,'pending'); }
    for (const row of recent) if (!expired.has(row.id)) { this.#pending.delete(row.id); this.#record(row.id,'recent'); }
  }
  sweep(referenced: (id: string) => boolean, artifacts: (id: string) => ArtifactEvidence[], emit: DecisionReceipt, limit = 32): Promise<void> {
    this.#flight ??= this.#sweep(referenced, artifacts, emit, limit).finally(() => { this.#flight = undefined; });
    return this.#flight;
  }
  drain(referenced: (id: string) => boolean, artifacts: (id: string) => ArtifactEvidence[], emit: DecisionReceipt, stopped: () => boolean): Promise<void> {
    this.#draining ??= (async () => {
      // One pass over the admitted backlog. Refusals rotate, but never cause an
      // infinite retry loop. New checkpoints get their own later pass.
      let remaining = this.#pending.size;
      while (remaining > 0 && !stopped()) {
        await new Promise<void>(resolve => setImmediate(resolve));
        const limit = Math.min(32,remaining);
        if (!stopped()) await this.sweep(referenced, artifacts, emit, limit);
        remaining -= limit;
      }
    })().finally(() => { this.#draining = undefined; });
    return this.#draining;
  }
  async #sources(): Promise<string[]> {
    const path = join(this.root, 'hub/test/durations.json');
    const info = await lstat(path).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (!info) return [];
    if (!info.isFile() || info.isSymbolicLink()) throw new Error('suite retention requires a regular duration manifest');
    const stamp = `${info.ino}:${info.mtimeMs}:${info.ctimeMs}:${info.size}`;
    if (stamp !== this.#durationStamp) {
      const chunks: Buffer[] = [];
      let kept = 0, exceeded = false;
      // Enforce the memory bound while reading, then drain before refusing.
      for await (const chunk of createReadStream(path)) {
        if (kept + chunk.length > 8 * 1024 * 1024) exceeded = true;
        if (!exceeded) { chunks.push(chunk); kept += chunk.length; }
      }
      if (exceeded) throw new Error('suite retention duration manifest exceeds 8 MiB; candidates retained');
      const sources = parseDurationManifest(Buffer.concat(chunks, kept).toString('utf8')).source.artifacts;
      if (!Array.isArray(sources) || !sources.every(source => typeof source === 'string')) throw new Error('suite retention duration sources unavailable');
      this.#durationSources = sources;
      this.#durationStamp = stamp;
    }
    return this.#durationSources;
  }
  async #sweep(referenced: (id: string) => boolean, artifacts: (id: string) => ArtifactEvidence[], emit: DecisionReceipt, limit: number): Promise<void> {
    const durationSources = await this.#sources();
    const batch: Array<[string, RetainedSuite]> = [];
    for (const [id, run] of this.#pending) {
      batch.push([id, run]);
      if (batch.length >= limit) break;
    }
    for (const [id, run] of batch) {
      // Rotate refusals so a retained run cannot starve the backlog.
      this.#pending.delete(id); this.#pending.set(id, run);
      const pointer = await lstat(join(this.root,'.cland/run/coverage-maps',`${id}.json`)).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
      const eligible = () => run.state === 'finished' && run.cleaned === true && run.reported && !run.accountingPending && !referenced(id) && !pointer;
      if (run.state !== 'finished' || !run.cleaned || !run.reported || run.accountingPending) { this.#record(id,'unsettled'); continue; }
      if (!suiteRunOldEnough(run.completedAt ?? run.finished, (this.#options.now ?? Date.now)())) { this.#record(id,'age-floor'); continue; }
      if (!eligible()) { this.#record(id,'reference'); continue; }
      try {
        const receipts = artifacts(id);
        const paths = receipts.map(receipt => typeof receipt === 'string' ? receipt : receipt.path);
        if (durationSources.some(source => receipts.some(receipt => typeof receipt === 'string' ? receipt.includes('/' + source + '-') || receipt.endsWith('/' + source) : receipt.id === source))) { this.#record(id,'duration-source'); continue; }
        const coverage = await lstat(join(this.root, '.cland/run/suites', id, 'coverage-map.json')).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
        if (coverage && paths.length < 2) { this.#record(id,'map-artifact-unavailable'); continue; }
        const approved = await retireSuiteRun(this.root, id, paths, eligible, {remove:this.#options.remove === true});
        this.#record(id,approved?'eligible':'artifact-unavailable');
        if (approved && this.#options.remove) { this.#pending.delete(id); this.#removed++; emit(id,true,undefined,'removed'); }
        else if (approved) emit(id,false,undefined,'would-retire');
      } catch (error) { this.#record(id,'unknown'); emit(id, false, error); }
    }
  }
}
