import { lstat, opendir, realpath, rename, rm, mkdir, open } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { checkpoint } from './host/agent/storage.ts';
import { claimSuiteRetirement, suiteRunPinned } from './suite-reference-pins.ts';

const rawName = 'coverage-map.json.raw';
async function ownedDirectories(paths: string[], kind = 'suite-owned'): Promise<boolean> {
  for (const path of paths) {
    const info = await lstat(path).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (!info) return false;
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`refusing ${kind} path: ${path}`);
  }
  return true;
}

/** Settled writers and current references are checked by the scheduler owner.
 * Rename is the retirement checkpoint: interruption leaves the original whole,
 * or an unreferenced tombstone whose evidence already has durable artifacts.
 * A retry validates the same ownership and artifact receipts before draining it. */
export async function retireSuiteRun(project: string, id: string, artifacts: readonly string[], eligible: () => boolean, options: { remove?: boolean } = {}): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('invalid suite run id');
  const canonical = await realpath(project);
  const cland = join(canonical, '.cland'), runRoot = join(cland, 'run'), suites = join(runRoot, 'suites');
  if (!await ownedDirectories([cland, runRoot, suites, join(cland, 'artifacts')])) return false;
  if (!artifacts.length) return false;
  for (const artifact of artifacts) {
    const path = await realpath(artifact).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (!path || !path.startsWith(join(cland, 'artifacts') + '/')) return false;
    const info = await lstat(path);
    if (!info.isFile()) return false;
  }
  const original = join(suites, id), retired = join(suites, `.retiring-${id}`);
  const pending = await ownedDirectories([retired]);
  const source = pending ? retired : original;
  if (!pending && !await ownedDirectories([original])) return false;
  const coverage = await lstat(join(source, 'coverage-map.json')).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  if (coverage && artifacts.length < 2) return false;
  const receipts = join(runRoot, 'suite-retirement'), receipt = join(receipts, `${id}.json`);
  let required: string[] | undefined;
  const receiptDirectoryExists = await ownedDirectories([receipts], 'suite retirement receipt');
  const receiptInfo = receiptDirectoryExists ? await lstat(receipt).catch(error => { if (error.code === 'ENOENT') return null; throw error; }) : null;
  if (receiptInfo && (!receiptInfo.isFile() || receiptInfo.isSymbolicLink())) throw new Error(`refusing suite retirement receipt path: ${receipt}`);
  const file = receiptInfo ? await open(receipt, 'r') : null;
  if (file) {
    try {
      const buffer = Buffer.alloc(65537);
      const {bytesRead} = await file.read(buffer, 0, buffer.length, 0);
      if (bytesRead === buffer.length) return false;
      const record = JSON.parse(buffer.subarray(0,bytesRead).toString('utf8'));
      if (record.version !== 1 || record.id !== id || !Array.isArray(record.required) || !record.required.every((path: unknown) => typeof path === 'string')) return false;
      required = record.required;
    } finally { await file.close(); }
    if (!required?.length || !required.every(path => artifacts.includes(path))) return false;
  }
  if (!eligible()) return false;
  if (await suiteRunPinned(canonical, id)) return false;
  // Production has no enabling setting. The explicit switch is exercised only
  // on disposable roots; activation requires the report replay and age setting.
  if (options.remove !== true) return true;
  if (!await claimSuiteRetirement(canonical, id)) return false;
  if (!required) {
    await mkdir(receipts, {recursive:true,mode:0o700});
    if (!await ownedDirectories([receipts])) return false;
    await checkpoint(receipt, {version:1,id,required:[...artifacts]});
  }
  if (!pending) {
    if (!await ownedDirectories([original])) return false;
    if (!eligible()) return false;
    await rename(original, retired);
    if (!eligible()) { await rename(retired, original); return false; }
  }
  await rm(retired, { recursive: true, force: true });
  await rm(receipt, {force:true});
  return true;
}
/** Only the literal suite-owned path grants removal authority; never follow links. */
export async function removeRawCoverage(project: string, id: string, layout: 'project' | 'droplet' = 'project'): Promise<number | null> {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('invalid suite run id');
  const canonical = await realpath(project);
  const suites = layout === 'droplet' ? join(canonical, 'runs') : join(canonical, '.cland', 'run', 'suites');
  const run = join(suites, id);
  const raw = join(run, rawName);
  if (!await ownedDirectories([...(layout === 'project' ? [join(canonical, '.cland'), join(canonical, '.cland/run')] : []), suites, run, raw], 'raw coverage')) return null;
  let bytes = 0;
  async function count(path: string): Promise<void> {
    for await (const entry of await opendir(path)) {
      const child = join(path, entry.name);
      const info = await lstat(child);
      if (info.isDirectory()) await count(child);
      else bytes += info.size; // lstat counts links themselves, never their targets.
    }
  }
  await count(raw);
  await rm(raw, { recursive: true, force: true });
  return bytes;
}

export function rawCoverageOwner(output: string, remoteHome?: string): { project: string; id: string; layout: 'project' | 'droplet' } {
  const path = resolve(output);
  const run = dirname(path), suites = dirname(run), clandRun = dirname(suites), cland = dirname(clandRun);
  if (remoteHome && basename(path) === 'coverage-map.json' && suites === resolve(remoteHome, 'runs') && /^[A-Za-z0-9_-]+$/.test(basename(run))) return { project: remoteHome, id: basename(run), layout: 'droplet' };
  if (basename(path) !== 'coverage-map.json' || basename(suites) !== 'suites' || basename(clandRun) !== 'run' || basename(cland) !== '.cland' || !/^[A-Za-z0-9_-]+$/.test(basename(run))) throw new Error('coverage output must be .cland/run/suites/<id>/coverage-map.json');
  return { project: dirname(cland), id: basename(run), layout: 'project' };
}

type Run = { id: string; state?: string; cleaned?: boolean; reported: boolean; shards?: Run[] };
/** Seeded during the scheduler's existing index walk; admissions visit only
 * pending terminal identities, at most 32 per admission. No directory census. */
export class RawCoverageSweep {
  readonly #done: Set<string>;
  readonly #pending = new Set<string>();
  #flight: Promise<void> | undefined;
  readonly project: string;
  readonly checkpoint: (ids: string[]) => void;
  readonly wasSwept: (id: string) => boolean;
  constructor(project: string, completed: string[] = [], checkpoint: (ids: string[]) => void = () => {}, wasSwept: (id: string) => boolean = () => false) {
    this.project = project; this.checkpoint = checkpoint; this.wasSwept = wasSwept;
    this.#done = new Set(completed);
  }
  remember(job: Run): void {
    if (job.state === 'finished' && job.cleaned && job.reported && !this.#done.has(job.id) && !this.wasSwept(job.id)) this.#pending.add(job.id);
    for (const shard of job.shards ?? []) this.remember(shard);
  }
  sweep(emit: (line: string) => Promise<void>): Promise<void> {
    this.#flight ??= this.#sweep(emit).finally(() => { this.#flight = undefined; });
    return this.#flight;
  }
  async #sweep(emit: (line: string) => Promise<void>): Promise<void> {
    const batch: string[] = [];
    for (const id of this.#pending) { batch.push(id); if (batch.length === 32) break; }
    const completed: string[] = [];
    for (const id of batch) {
      try {
        const bytes = await removeRawCoverage(this.project, id);
        if (bytes !== null) await emit(`suite raw coverage sweep ${id}; removed ${bytes} bytes\n`);
        this.#pending.delete(id);
        this.#done.add(id);
        completed.push(id);
      } catch (error) {
        this.#pending.delete(id); this.#pending.add(id); // A refused root cannot starve later runs.
        await emit(`suite raw coverage sweep ${id}; retained: ${String(error)}\n`);
      }
    }
    if (completed.length) this.checkpoint(completed);
  }
}
