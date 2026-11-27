import { lstat } from 'node:fs/promises';
import { SUITE_RETENTION_BATCH_SIZE, SUITE_UNINDEXED_RETENTION_REMOVE } from './suite-retention-policy.ts';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { retireSuiteRun, retireSuiteRuns } from './suite-raw-coverage.ts';
import { SUITE_RUNS_PER_OCCASION, suiteRetentionCandidates, suiteRunOldEnough, suiteRetentionReport } from './suite-retention-policy.ts';
import { parseDurationManifest } from './suite-durations.ts';
import { suiteRunPinned } from './suite-reference-pins.ts';
import { UnindexedSuiteRetention } from './suite-unindexed-retention.ts';

type RetentionOptions = {remove?:boolean; removeUnindexed?:boolean; now?:()=>number; minimumAgeMs?:()=>number; indexAbsent?:(id:string)=>boolean; passLimit?:number|(()=>number)};

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
  readonly #options: RetentionOptions;
  readonly #unindexed: UnindexedSuiteRetention;
  readonly root: string;
  readonly keep: number;
  constructor(root: string, keep = SUITE_RUNS_PER_OCCASION, options: RetentionOptions = {}) {
    if (!Number.isSafeInteger(keep) || keep < 1) throw new Error('suite retention must be a positive integer');
    this.root = root; this.keep = keep;
    this.#options = options;
    this.#unindexed = new UnindexedSuiteRetention(root);
  }
  async close():Promise<void> {await this.#draining;await this.#flight;await this.#unindexed.close();}
  #record(id: string, reason: string): void {
    const previous = this.#decisions.get(id);
    if (previous === reason) return;
    if (previous) this.#counts.set(previous, (this.#counts.get(previous) ?? 0) - 1);
    this.#decisions.set(id,reason); this.#counts.set(reason,(this.#counts.get(reason)??0)+1);
  }
  snapshot() {
    return {...suiteRetentionReport(Object.fromEntries(this.#counts),this.#known.size,this.#removed,this.#options.remove?'live':'report'),backlog:this.#pending.size,unindexed:this.#unindexed.snapshot()};
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
  sweep(referenced: (id: string) => boolean, artifacts: (id: string) => ArtifactEvidence[], emit: DecisionReceipt, limit = SUITE_RETENTION_BATCH_SIZE): Promise<void> {
    this.#flight ??= this.#sweep(referenced, artifacts, emit, limit).finally(() => { this.#flight = undefined; });
    return this.#flight;
  }
  drain(referenced: (id: string) => boolean, artifacts: (id: string) => ArtifactEvidence[], emit: DecisionReceipt, stopped: () => boolean): Promise<void> {
    this.#draining ??= (async () => {
      // One pass over the admitted backlog. Refusals rotate, but never cause an
      // infinite retry loop. New checkpoints get their own later pass.
      let remaining = Math.min(this.#pending.size,(typeof this.#options.passLimit==='function'?this.#options.passLimit():this.#options.passLimit)??this.#pending.size);
      while (remaining > 0 && !stopped()) {
        await new Promise<void>(resolve => setImmediate(resolve));
        const limit = Math.min(SUITE_RETENTION_BATCH_SIZE,remaining);
        if (!stopped()) await this.sweep(referenced, artifacts, emit, limit);
        remaining -= limit;
      }
      if(this.#options.indexAbsent&&!stopped())await this.#unindexed.sweep({absent:this.#options.indexAbsent,referenced,now:(this.#options.now??Date.now)(),minimumAgeMs:this.#options.minimumAgeMs?.()??7*86400000,remove:this.#options.remove===true&&(this.#options.removeUnindexed??SUITE_UNINDEXED_RETENTION_REMOVE),stopped,limit:(typeof this.#options.passLimit==='function'?this.#options.passLimit():this.#options.passLimit)??256,emit});
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
    const retirement:Array<{id:string;artifacts:string[];eligible:()=>boolean}>=[];
    const batch: Array<[string, RetainedSuite]> = [];
    for (const [id, run] of this.#pending) {
      batch.push([id, run]);
      if (batch.length >= Math.min(limit,SUITE_RETENTION_BATCH_SIZE)) break;
    }
    for (const [id, run] of batch) {
      // Rotate refusals so a retained run cannot starve the backlog.
      this.#pending.delete(id); this.#pending.set(id, run);
      const pointer = await lstat(join(this.root,'.cland/run/coverage-maps',`${id}.json`)).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
      const eligible = () => run.state === 'finished' && run.cleaned === true && run.reported && !run.accountingPending && !referenced(id) && !pointer;
      if (run.state !== 'finished' || !run.cleaned || !run.reported || run.accountingPending) { this.#record(id,'unsettled'); continue; }
      if (!suiteRunOldEnough(run.completedAt ?? run.finished, (this.#options.now ?? Date.now)(),this.#options.minimumAgeMs?.())) { this.#record(id,'age-floor'); continue; }
      if (!eligible()) { this.#record(id,'reference'); continue; }
      try {
        if (await suiteRunPinned(this.root, id)) { this.#record(id,'pin'); continue; }
        const receipts = artifacts(id);
        const paths = receipts.map(receipt => typeof receipt === 'string' ? receipt : receipt.path);
        if (durationSources.some(source => receipts.some(receipt => typeof receipt === 'string' ? receipt.includes('/' + source + '-') || receipt.endsWith('/' + source) : receipt.id === source))) { this.#record(id,'duration-source'); continue; }
        const coverage = await lstat(join(this.root, '.cland/run/suites', id, 'coverage-map.json')).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
        if (coverage && paths.length < 2) { this.#record(id,'map-artifact-unavailable'); continue; }
        if(this.#options.remove){retirement.push({id,artifacts:paths,eligible});continue;}
        const approved = await retireSuiteRun(this.root, id, paths, eligible, {remove:false});
        this.#record(id,approved?'eligible':'artifact-unavailable');
        if (approved) emit(id,false,undefined,'would-retire');
      } catch (error) { this.#record(id,'unknown'); emit(id, false, error); }
    }
    if(retirement.length) {
      let removed:Awaited<ReturnType<typeof retireSuiteRuns>>;
      try {
        removed=await retireSuiteRuns(this.root,retirement);
      } catch(error) {for(const row of retirement){this.#record(row.id,'unknown');emit(row.id,false,error);}return;}
      for(const row of retirement) {
        const outcome=removed.get(row.id),done=outcome?.removed===true;
        this.#record(row.id,done?'eligible':'unknown');
        if(done){this.#pending.delete(row.id);this.#removed++;}
        emit(row.id,done,outcome?.error??outcome?.cleanupError,done?'removed':undefined);
      }
    }
  }
}
