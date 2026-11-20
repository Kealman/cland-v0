import { quarantineResults } from '../suite-quarantine.ts';
import { suiteProgress, type TestProgress } from '../suite-progress.ts';
import { quarantineProposal, type FlakeObservation } from './soak-quarantine.ts';
import type { TopicNotice } from './core.ts';
import type { Store } from './store.ts';
import type { Suites } from './suites.ts';
import { verificationSteps } from '../verification-plan.ts';
import type { VerificationCommands } from '../verification-commands.ts';
import { completeTierPlanReason, parseTierReceipts } from '../verification-tier-receipts.ts';

type Receipt = Awaited<ReturnType<Suites['receipt']>>;
type History = Record<string, { observations: FlakeObservation[]; proposed?: boolean }>;

/** Only the producing owner's complete native steps identify the failed commands.
 * Missing/legacy metadata grants no rerun authority. Keep the admitted prepare
 * and check, and replay the original commands for the failed runtime steps. */
export function flakyRerunCommands(job: Pick<Receipt['job'], 'id' | 'head' | 'tree' | 'commands' | 'tierReceipts' | 'shards'>): VerificationCommands | null {
  if (!job.commands || !job.tree) return null;
  let plan;
  try { plan = verificationSteps(job.commands); } catch { return null; }
  const failedSteps = (owner: Pick<Receipt['job'], 'id' | 'tree' | 'tierReceipts'>) => {
    const rows = parseTierReceipts(owner.tierReceipts);
    if (!rows?.length || rows.some(row => row.run !== owner.id || row.tree !== owner.tree || row.completion !== 'complete'
      || ![0, 1].includes(row.exit ?? -1) || !plan.some(step => row.tier === (step.name === 'check' ? 'T0' : step.name) && row.command === step.command))) return null;
    if (plan.some(step => !rows.some(row => row.tier === (step.name === 'check' ? 'T0' : step.name) && row.command === step.command))) return null;
    return plan.filter(step => rows.some(row => row.tier === (step.name === 'check' ? 'T0' : step.name) && row.command === step.command && row.exit === 1));
  };
  let failed;
  if (job.shards) {
    if (job.shards.length < 2 || new Set(job.shards.map(shard => shard.id)).size !== job.shards.length) return null;
    // A group does not produce its children's runtime receipts. Validate each
    // captured child owner independently; never relabel a child run as its parent.
    const names = new Set<string>();
    for (const shard of job.shards) {
      if (shard.parentRun !== job.id || shard.head !== job.head || shard.tree !== job.tree || shard.state !== 'finished' || !shard.reported
        || shard.cached || shard.cancelled || shard.requesterDied || shard.timedOut || shard.outcome?.notRun
        || ![0, 1].includes(shard.outcome?.code ?? -1) || JSON.stringify(shard.commands) !== JSON.stringify(job.commands)) return null;
      const steps = failedSteps(shard);
      if (!steps || Boolean(steps.length) !== (shard.outcome?.code === 1)) return null;
      for (const step of steps) names.add(step.name);
    }
    const parentRows = parseTierReceipts(job.tierReceipts);
    if (job.tierReceipts && (!parentRows || parentRows.some(row => row.run !== job.id || row.tree !== job.tree || row.tier !== 'T0'
      || row.command !== job.commands!.check || row.exit !== 0 || row.completion !== 'complete'))) return null;
    failed = plan.filter(step => names.has(step.name));
  } else failed = failedSteps(job);
  if (!failed) return null;
  if (!failed.length || failed.some(step => step.name === 'check')) return null;
  return { ...structuredClone(job.commands), plan: plan.filter(step => step.name === 'check' || failed.includes(step)) };
}

/** True only when every original failure has executed passing evidence on the unchanged tree. */
export function passingFlakyRepeat(failures: string[], failed: Pick<Receipt, 'job'>, repeat: Receipt, commands?: VerificationCommands): boolean {
  if (!failures.length || !failed.job.tree || failed.job.tree !== repeat.job.tree || failed.job.cached || repeat.job.cached
    || repeat.job.cancelled || repeat.job.requesterDied || repeat.job.timedOut || repeat.job.state !== 'finished'
    || !repeat.job.reported || repeat.job.outcome?.notRun || repeat.job.outcome?.code !== 0) return false;
  if (commands && (JSON.stringify(repeat.job.commands) !== JSON.stringify(commands) || completeTierPlanReason(repeat.job) !== null)) return false;
  const progress = suiteProgress(repeat.log, 0);
  if (!progress) return false;
  const rows: TestProgress[] = [];
  for (const line of repeat.log.split('\n').filter(line => line.startsWith('suite progress '))) {
    let row: TestProgress;
    try { row = JSON.parse(line.slice('suite progress '.length)) as TestProgress; } catch { return false; }
    if (!row || typeof row.file !== 'string' || typeof row.name !== 'string' || typeof row.id !== 'string' || !Number.isInteger(row.nesting) || row.nesting < 0
      || !Number.isFinite(row.at) || !['start', 'finish'].includes(row.event)) return false;
    if (row.event === 'finish' && (!['pass', 'fail', 'skip', 'todo', 'cancelled'].includes(row.outcome ?? '') || !Number.isFinite(row.seconds) || row.seconds! < 0)) return false;
    rows.push(row);
  }
  for (const identity of failures) {
    const separator = identity.indexOf('::');
    const file = identity.slice(0, separator), name = identity.slice(separator + 2);
    if (!progress.completed.some(row => row.file === file && row.name === name && row.outcome === 'pass')) return false;
    if (rows.some(row => row.file === file && row.event === 'finish' && row.outcome !== 'pass')
      || progress.unfinished.some(row => row.file === file) || quarantineResults(repeat.log).some(row => row.file === file && row.outcome !== 'pass')) return false;
  }
  return true;
}

export function recordBatchFlakes(store: Store, batch: string, failures: string[], failed: Receipt, repeat: Receipt, notice: (notice: TopicNotice) => void): boolean {
  if (!passingFlakyRepeat(failures, failed, repeat)) return false;
  const log = (receipt: Receipt) => {
    const artifact = store.resolveArtifact(receipt.job.artifact!);
    if (!artifact) throw new Error('batch flake log artifact unavailable');
    return { artifact: artifact.id, path: artifact.path };
  };
  store.transaction(() => {
    const history = JSON.parse(store.meta('batch-flakes') ?? '{}') as History;
    for (const identity of failures) {
      const entry = history[identity] ??= { observations: [] };
      if (!entry.observations.some(observation => observation.batch === batch)) entry.observations.push({ batch, run: failed.job.id, tree: failed.job.tree!, log: log(failed),
        rerun: { run: repeat.job.id, head: repeat.job.head, tree: repeat.job.tree!, log: log(repeat) } });
      if (entry.observations.length >= 2 && !entry.proposed) {
        notice(quarantineProposal({ identity, run: failed.job.id, tree: failed.job.tree!, log: log(failed), observations: entry.observations.slice(0, 2) }));
        entry.proposed = true;
      }
    }
    store.setMeta('batch-flakes', JSON.stringify(history));
  });
  return true;
}
