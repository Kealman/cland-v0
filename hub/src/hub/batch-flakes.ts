import { quarantineResults } from '../suite-quarantine.ts';
import { suiteProgress, type TestProgress } from '../suite-progress.ts';
import { quarantineProposal, type FlakeObservation } from './soak-quarantine.ts';
import type { TopicNotice } from './core.ts';
import type { Store } from './store.ts';
import type { Suites } from './suites.ts';

type Receipt = Awaited<ReturnType<Suites['receipt']>>;
type History = Record<string, { observations: FlakeObservation[]; proposed?: boolean }>;

/** True only when every original failure has executed passing evidence on the unchanged tree. */
export function recordBatchFlakes(store: Store, batch: string, failures: string[], failed: Receipt, repeat: Receipt, notice: (notice: TopicNotice) => void): boolean {
  if (!failures.length || !failed.job.tree || failed.job.tree !== repeat.job.tree || failed.job.cached || repeat.job.cached
    || repeat.job.cancelled || repeat.job.requesterDied || repeat.job.outcome?.code !== 0) return false;
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
