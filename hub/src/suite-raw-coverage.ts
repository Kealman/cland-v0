import { lstat, opendir, realpath, rename, rm, mkdir, open, link } from 'node:fs/promises';
import { SUITE_RETENTION_BATCH_SIZE } from './suite-retention-policy.ts';
import { randomUUID } from 'node:crypto';
import { basename, dirname, join, resolve } from 'node:path';
import { checkpoint } from './host/agent/storage.ts';
import { claimSuiteRetirement, claimSuiteRetirements, suiteRunPinned } from './suite-reference-pins.ts';
import { suiteInventoryUnchanged, type RetirementInventory } from './suite-retirement-inventory.ts';

const rawName = 'coverage-map.json.raw';
const preparedBatches=new WeakMap<object,{root:string;ids:ReadonlySet<string>}>();
type RetirementCandidate={id:string;artifacts:readonly string[];eligible:()=>boolean;inventory?:RetirementInventory};
type RetirementOutcome={removed:boolean;error?:unknown;cleanupError?:unknown};
async function ownedDirectories(paths: string[], kind = 'suite-owned'): Promise<boolean> {
  for (const path of paths) {
    const info = await lstat(path).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (!info) return false;
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`refusing ${kind} path: ${path}`);
  }
  return true;
}

/** Indexed writer settlement and references come from scheduler admission.
 * Unindexed candidates carry bounded metadata revalidated before removal.
 * Rename is the retirement checkpoint: interruption leaves the original whole,
 * or an unreferenced tombstone whose evidence already has durable artifacts.
 * A retry validates the same ownership and artifact receipts before draining it. */
export async function retireSuiteRun(project: string, id: string, artifacts: readonly string[], eligible: () => boolean, options: { remove?: boolean; inventory?: RetirementInventory; prepared?:object } = {}): Promise<boolean> {
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
  if (options.inventory) {
    const file=await open(artifacts[0]!, 'r');
    try {
      const buffer=Buffer.alloc(2*1024*1024+1),{bytesRead}=await file.read(buffer,0,buffer.length,0);
      if(bytesRead===buffer.length)return false;
      const inventory=JSON.parse(buffer.subarray(0,bytesRead).toString('utf8'));
      if(inventory.version!==1||inventory.event!=='suite-retirement-inventory'||!inventory.runs?.some((row:RetirementInventory)=>row.id===id&&JSON.stringify(row)===JSON.stringify(options.inventory)))return false;
    } finally {await file.close();}
    if(!await suiteInventoryUnchanged(source,options.inventory)||!eligible())return false;
  } else if (coverage && artifacts.length < 2) return false;
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
      const row=record.version===2&&Array.isArray(record.runs)?record.runs.find((row:{id:string})=>row.id===id):record;
      if (![1,2].includes(record.version) || row?.id !== id || !Array.isArray(row.required) || !row.required.every((path: unknown) => typeof path === 'string')) return false;
      required = row.required;
    } finally { await file.close(); }
    if (!required?.length || !required.every(path => artifacts.includes(path))) return false;
  }
  if (!eligible()) return false;
  if (await suiteRunPinned(canonical, id)) return false;
  // Both indexed artifacts and unindexed inventories use the same exclusive
  // admission claim and guarded rename/removal owner.
  if (options.remove !== true) return true;
  const prepared=options.prepared?preparedBatches.get(options.prepared):undefined;
  if (!(prepared?.root===canonical&&prepared.ids.has(id)) && !await claimSuiteRetirement(canonical, id)) return false;
  if (!required) {
    await mkdir(receipts, {recursive:true,mode:0o700});
    if (!await ownedDirectories([receipts])) return false;
    await checkpoint(receipt, {version:1,id,required:[...artifacts]});
  }
  if (!pending) {
    if (!await ownedDirectories([original])) return false;
    if (!eligible()) return false;
    if (options.inventory && !await suiteInventoryUnchanged(original,options.inventory)) return false;
    await rename(original, retired);
    if (!eligible()) { await rename(retired, original); return false; }
  }
  if(options.inventory) {
    let unchanged:boolean;
    try {unchanged=await suiteInventoryUnchanged(retired,options.inventory)&&eligible();}
    catch(error) {
      if(!pending) {
        try {await rename(retired,original);}
        catch(cleanupError) {throw new AggregateError([error,cleanupError],'inventory revalidation and rollback failed',{cause:error});}
      }
      throw error;
    }
    if(!unchanged){if(!pending)await rename(retired,original);return false;}
  }
  await rm(retired, { recursive: true, force: true });
  await rm(receipt, {force:true});
  return true;
}

/** Guard inspection precedes batch admission. The token carries only a positive
 * in-process receipt, never authority reconstructed from serialized flags.
 * Every per-id hard link points to one synced full requirement checkpoint. */
export async function retireSuiteRuns(project:string,candidates:readonly RetirementCandidate[]):Promise<Map<string,RetirementOutcome>> {
  if(candidates.length>SUITE_RETENTION_BATCH_SIZE)throw new Error('retirement batch exceeds 32');
  const canonical=await realpath(project),approved:RetirementCandidate[]=[];
  for(const row of candidates)if(await retireSuiteRun(canonical,row.id,row.artifacts,row.eligible,{...(row.inventory?{inventory:row.inventory}:{})}))approved.push(row);
  const claimed=await claimSuiteRetirements(canonical,approved.map(row=>row.id));
  const rows=approved.filter(row=>claimed.has(row.id));
  const result=new Map<string,RetirementOutcome>();
  if(!rows.length)return result;
  const directory=join(canonical,'.cland/run/suite-retirement');
  await mkdir(directory,{recursive:true,mode:0o700});
  if(!await ownedDirectories([directory],'suite retirement receipt'))return result;
  const batch=join(directory,`.batch-${randomUUID()}.json`);
  await checkpoint(batch,{version:2,runs:rows.map(row=>({id:row.id,required:[...row.artifacts]}))});
  try {
    for(const row of rows)await link(batch,join(directory,`${row.id}.json`)).catch(error=>{if(error.code!=='EEXIST')throw error;});
    const parent=await open(directory,'r');
    try {await parent.sync();} finally {await parent.close();}
    const token={};preparedBatches.set(token,{root:canonical,ids:claimed});
    try {
      for(const row of rows) {
        try {result.set(row.id,{removed:await retireSuiteRun(canonical,row.id,row.artifacts,row.eligible,{remove:true,...(row.inventory?{inventory:row.inventory}:{}),prepared:token})});}
        catch(error){result.set(row.id,{removed:false,error});}
      }
    } finally {preparedBatches.delete(token);}
  } finally {
    try {await rm(batch,{force:true});}
    catch(cleanupError){for(const [id,outcome] of result)result.set(id,{...outcome,cleanupError});}
  }
  return result;
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
