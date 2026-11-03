import { lstat, opendir, realpath, rm } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

const rawName = 'coverage-map.json.raw';
/** Only the literal suite-owned path grants removal authority; never follow links. */
export async function removeRawCoverage(project: string, id: string, layout: 'project' | 'droplet' = 'project'): Promise<number | null> {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('invalid suite run id');
  const canonical = await realpath(project);
  const suites = layout === 'droplet' ? join(canonical, 'runs') : join(canonical, '.cland', 'run', 'suites');
  const run = join(suites, id);
  const raw = join(run, rawName);
  for (const path of [...(layout === 'project' ? [join(canonical, '.cland'), join(canonical, '.cland/run')] : []), suites, run, raw]) {
    const info = await lstat(path).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (!info) return null;
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`refusing raw coverage path: ${path}`);
  }
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
